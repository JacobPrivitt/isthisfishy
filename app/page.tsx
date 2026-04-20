'use client';

import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';

export default function Home() {
  const { isSignedIn } = useAuth();

  return (
    <div>
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-indigo-600 to-cyan-500 text-white py-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold mb-6">
            Stay Safe Online
          </h1>
          <p className="text-xl md:text-2xl mb-8 opacity-90">
            IsThisFishy uses AI to detect phishing links, scams, and malicious content in real-time.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/pricing"
              className="bg-white text-indigo-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100"
            >
              View Plans
            </Link>
            {!isSignedIn && (
              <Link
                href="/sign-up"
                className="bg-indigo-800 text-white px-8 py-3 rounded-lg font-semibold hover:bg-indigo-900 border-2 border-white"
              >
                Get Started
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-16">How It Works</h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-lg shadow-sm">
              <div className="w-12 h-12 bg-indigo-600 text-white rounded-lg flex items-center justify-center mb-4 text-xl font-bold">
                1
              </div>
              <h3 className="text-xl font-semibold mb-2">Install Extension</h3>
              <p className="text-gray-600">Add our Chrome extension to start real-time protection.</p>
            </div>

            <div className="bg-white p-8 rounded-lg shadow-sm">
              <div className="w-12 h-12 bg-indigo-600 text-white rounded-lg flex items-center justify-center mb-4 text-xl font-bold">
                2
              </div>
              <h3 className="text-xl font-semibold mb-2">Scan Links</h3>
              <p className="text-gray-600">Every link you hover over is analyzed by our AI engine.</p>
            </div>

            <div className="bg-white p-8 rounded-lg shadow-sm">
              <div className="w-12 h-12 bg-indigo-600 text-white rounded-lg flex items-center justify-center mb-4 text-xl font-bold">
                3
              </div>
              <h3 className="text-xl font-semibold mb-2">Get Alerts</h3>
              <p className="text-gray-600">Instant warnings before you click on dangerous content.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-8">Enterprise-Grade Security</h2>
          <p className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto">
            Your data is encrypted end-to-end. We use industry-standard security practices and never sell your information.
          </p>
          
          <div className="grid md:grid-cols-3 gap-8 text-left">
            <div>
              <h3 className="text-lg font-semibold mb-2">🔒 End-to-End Encryption</h3>
              <p className="text-gray-600">All your data is encrypted using military-grade standards.</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">✅ Regular Audits</h3>
              <p className="text-gray-600">Third-party security audits ensure our platform is always safe.</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">🚀 AI Detection</h3>
              <p className="text-gray-600">Machine learning keeps up with evolving threats in real-time.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-indigo-600 text-white py-16 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-4">Ready to Stay Safe?</h2>
          <p className="text-xl mb-8 opacity-90">Join thousands of users protecting themselves online.</p>
          <Link
            href={isSignedIn ? '/dashboard' : '/sign-up'}
            className="bg-white text-indigo-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 inline-block"
          >
            {isSignedIn ? 'Go to Dashboard' : 'Start Free Trial'}
          </Link>
        </div>
      </section>
    </div>
  );
}
