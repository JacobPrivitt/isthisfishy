'use client';

import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    description: 'Perfect for getting started',
    checks: 10,
    features: [
      '10 checks per month',
      'Basic link analysis',
      'Email notifications',
    ],
    cta: 'Get Started',
    stripe_product_id: '',
  },
  {
    id: 'plus',
    name: 'Plus',
    price: 4.99,
    description: 'For regular users',
    checks: 100,
    features: [
      '100 checks per month',
      'Advanced link analysis',
      'Priority support',
      'Email notifications',
    ],
    cta: 'Upgrade Now',
    stripe_product_id: process.env.NEXT_PUBLIC_STRIPE_PRODUCT_PLUS || '',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 9.99,
    description: 'For power users',
    checks: 'Unlimited',
    features: [
      'Unlimited checks',
      'Advanced link analysis',
      'Priority support',
      'Custom rules',
      'API access',
    ],
    cta: 'Upgrade Now',
    stripe_product_id: process.env.NEXT_PUBLIC_STRIPE_PRODUCT_PRO || '',
    popular: true,
  },
  {
    id: 'family',
    name: 'Family',
    price: 7.99,
    description: 'Protect your whole family',
    checks: 200,
    features: [
      'Up to 5 family members',
      '200 checks per month per member',
      'Shared dashboard',
      'Parental controls',
      'Priority support',
    ],
    cta: 'Upgrade Now',
    stripe_product_id: process.env.NEXT_PUBLIC_STRIPE_PRODUCT_FAMILY || '',
  },
  {
    id: 'business',
    name: 'Business',
    price: 12.99,
    description: 'For teams & organizations',
    checks: 'Unlimited',
    features: [
      'Unlimited checks',
      'Team management',
      'Advanced analytics',
      'Dedicated support',
      'SSO & SAML',
    ],
    cta: 'Contact Sales',
    stripe_product_id: process.env.NEXT_PUBLIC_STRIPE_PRODUCT_BUSINESS || '',
  },
];

export default function PricingPage() {
  const { isSignedIn } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

  const handleUpgrade = async (productId: string, planName: string) => {
    if (!isSignedIn) {
      window.location.href = '/sign-up';
      return;
    }

    if (!productId) {
      alert('This plan is not yet available for online purchase. Please contact support.');
      return;
    }

    setLoading(productId);

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: productId,
          plan_name: planName,
        }),
      });

      const { sessionId } = await response.json();
      const stripe = await stripePromise;
      
      if (stripe) {
        await stripe.redirectToCheckout({ sessionId });
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to start checkout. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div>
      {/* Pricing Header */}
      <section className="bg-gradient-to-r from-indigo-600 to-cyan-500 text-white py-16 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-5xl font-bold mb-4">Simple, Transparent Pricing</h1>
          <p className="text-xl opacity-90">Choose the plan that works for you.</p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-8">
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`relative bg-white rounded-lg shadow-sm overflow-hidden transition-transform hover:shadow-lg ${
                  plan.popular ? 'lg:scale-105 ring-2 ring-indigo-600' : ''
                }`}
              >
                {plan.popular && (
                  <div className="bg-indigo-600 text-white py-2 text-center text-sm font-semibold">
                    Most Popular
                  </div>
                )}

                <div className="p-6">
                  <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                  <p className="text-gray-600 text-sm mb-4">{plan.description}</p>

                  <div className="mb-6">
                    <div className="text-4xl font-bold">
                      ${plan.price.toFixed(2)}
                      {plan.price > 0 && <span className="text-lg text-gray-600">/mo</span>}
                    </div>
                    <p className="text-gray-600 text-sm mt-2">
                      {typeof plan.checks === 'number' ? `${plan.checks} checks/month` : `${plan.checks} checks`}
                    </p>
                  </div>

                  <button
                    onClick={() => handleUpgrade(plan.stripe_product_id, plan.name)}
                    disabled={loading === plan.stripe_product_id}
                    className={`w-full py-2 rounded-lg font-semibold transition-colors ${
                      plan.popular
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                        : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                    } ${loading === plan.stripe_product_id ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {loading === plan.stripe_product_id ? 'Loading...' : plan.cta}
                  </button>

                  <ul className="mt-6 space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm">
                        <span className="text-green-500 font-bold">✓</span>
                        <span className="text-gray-600">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-16 text-center">
            <p className="text-gray-600 mb-4">
              All plans include a 7-day free trial. No credit card required.
            </p>
            <p className="text-gray-600">
              Questions? <a href="#" className="text-indigo-600 hover:text-indigo-700 font-semibold">Contact our sales team</a>
            </p>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-12">Frequently Asked Questions</h2>

          <div className="space-y-8">
            <div>
              <h3 className="text-xl font-semibold mb-2">Can I cancel anytime?</h3>
              <p className="text-gray-600">Yes! Cancel your subscription anytime from your dashboard. No long-term contracts.</p>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-2">Can I upgrade or downgrade anytime?</h3>
              <p className="text-gray-600">Absolutely. Changes take effect immediately and we'll prorate any charges or credits.</p>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-2">Do you offer discounts for annual billing?</h3>
              <p className="text-gray-600">Yes! Contact our sales team for annual billing discounts.</p>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-2">What payment methods do you accept?</h3>
              <p className="text-gray-600">We accept all major credit cards, debit cards, and digital wallets through Stripe.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
