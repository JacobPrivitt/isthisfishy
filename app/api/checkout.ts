import Stripe from 'stripe';
import { NextRequest, NextResponse } from 'next/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

// Plan pricing in cents
const PLAN_PRICES = {
  free: 0,
  plus: 499, // $4.99
  pro: 999,  // $9.99
  family: 799, // $7.99
  business: 1299, // $12.99
};

export async function POST(request: NextRequest) {
  try {
    const { product_id, plan_name } = await request.json();

    if (!product_id || !plan_name) {
      return NextResponse.json(
        { error: 'Product ID and plan name are required' },
        { status: 400 }
      );
    }

    const price = PLAN_PRICES[plan_name.toLowerCase() as keyof typeof PLAN_PRICES];

    if (price === undefined) {
      return NextResponse.json(
        { error: 'Invalid plan name' },
        { status: 400 }
      );
    }

    // Skip checkout for free plan
    if (price === 0) {
      return NextResponse.json(
        { error: 'Free plan does not require payment' },
        { status: 400 }
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product: product_id,
            unit_amount: price,
            recurring: {
              interval: 'month',
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_DOMAIN || 'https://isthisfishy.com'}/dashboard?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_DOMAIN || 'https://isthisfishy.com'}/pricing?canceled=true`,
      allow_promotion_codes: true,
    });

    return NextResponse.json({ sessionId: session.id });
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
