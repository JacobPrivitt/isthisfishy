'use client';

import { useEffect, useState } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import axios from 'axios';

interface BillingInfo {
  plan: string;
  monthly_checks_limit: number;
  checks_used_this_month: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  can_use_family_mode: boolean;
  family_members_count: number;
  family_members_limit: number;
}

interface UsageInfo {
  plan: string;
  checks_used: number;
  checks_limit: number;
  remaining: number;
  can_check: boolean;
}

export default function DashboardPage() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      router.push('/sign-in');
      return;
    }

    const fetchBillingInfo = async () => {
      try {
        setLoading(true);
        const token = await getToken();

        const [billingRes, usageRes] = await Promise.all([
          axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/billing/info`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/billing/usage`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        setBilling(billingRes.data.billing_info);
        setUsage(usageRes.data);
      } catch (err) {
        console.error('Error fetching billing info:', err);
        setError('Failed to load billing information.');
      } finally {
        setLoading(false);
      }
    };

    fetchBillingInfo();
  }, [isLoaded, isSignedIn, router, user]);

  if (!isLoaded || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Welcome Section */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-gray-900">Welcome back, {user?.firstName}!</h1>
          <p className="text-gray-600 mt-2">Manage your account, subscription, and billing below.</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-8">
            {error}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-8">
          {/* Current Plan Card */}
          <div className="bg-white rounded-lg shadow-sm p-8">
            <h2 className="text-2xl font-bold mb-4">Current Plan</h2>
            {billing ? (
              <>
                <div className="mb-6">
                  <p className="text-gray-600">Active Plan</p>
                  <p className="text-4xl font-bold text-indigo-600 capitalize">{billing.plan}</p>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Monthly Checks</span>
                    <span className="font-semibold">{billing.monthly_checks_limit}</span>
                  </div>
                  {billing.can_use_family_mode && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Family Members</span>
                      <span className="font-semibold">
                        {billing.family_members_count} / {billing.family_members_limit}
                      </span>
                    </div>
                  )}
                </div>

                <button className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 font-semibold">
                  Manage Subscription
                </button>
              </>
            ) : (
              <p className="text-gray-600">Unable to load billing information.</p>
            )}
          </div>

          {/* Usage Card */}
          <div className="bg-white rounded-lg shadow-sm p-8">
            <h2 className="text-2xl font-bold mb-4">This Month's Usage</h2>
            {usage ? (
              <>
                <div className="mb-6">
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-600">Checks Used</span>
                    <span className="font-semibold">
                      {usage.checks_used} / {usage.checks_limit}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        usage.remaining > usage.checks_limit * 0.2
                          ? 'bg-green-500'
                          : usage.remaining > 0
                          ? 'bg-yellow-500'
                          : 'bg-red-500'
                      }`}
                      style={{
                        width: `${Math.min((usage.checks_used / usage.checks_limit) * 100, 100)}%`,
                      }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    {usage.can_check
                      ? `${usage.remaining} checks remaining`
                      : 'You have reached your limit. Upgrade to continue.'}
                  </p>
                </div>

                {!usage.can_check && (
                  <button className="w-full bg-amber-600 text-white py-2 rounded-lg hover:bg-amber-700 font-semibold">
                    Upgrade Plan
                  </button>
                )}
              </>
            ) : (
              <p className="text-gray-600">Unable to load usage information.</p>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-12 grid md:grid-cols-3 gap-6">
          <a href="/pricing" className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow text-center">
            <h3 className="font-semibold text-lg mb-2">View All Plans</h3>
            <p className="text-gray-600">See all available subscription options.</p>
          </a>

          <a href="#" className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow text-center">
            <h3 className="font-semibold text-lg mb-2">Billing History</h3>
            <p className="text-gray-600">View invoices and payment history.</p>
          </a>

          <a href="/user-profile" className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow text-center">
            <h3 className="font-semibold text-lg mb-2">Account Settings</h3>
            <p className="text-gray-600">Manage your profile and preferences.</p>
          </a>
        </div>
      </div>
    </div>
  );
}
