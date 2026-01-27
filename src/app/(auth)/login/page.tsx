'use client';

/**
 * Unified Login Page
 *
 * WHY: Single login page for all user types (admin, affiliate, contractor).
 *      System detects user type and redirects to appropriate dashboard.
 *
 * WHEN: Any user accessing /login or needing to authenticate.
 *
 * HOW: Email/password form → API detects user type → stores token → redirects
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { TextInput, EmailInput } from '@/components/ui/fields';
import { Mail, Lock, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';

type UserType = 'admin' | 'affiliate' | 'contractor';

export default function UnifiedLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Login failed');
      }

      const { token, userType, redirectPath } = data.data;

      // Store token with user-type-specific key for backwards compatibility
      // Also store as generic 'auth_token' for unified access
      const tokenKey = getTokenKey(userType);
      localStorage.setItem(tokenKey, token);
      localStorage.setItem('auth_token', token);
      localStorage.setItem('user_type', userType);

      // Set cookies for middleware auth
      document.cookie = `${tokenKey}=${token}; path=/; max-age=604800`;
      document.cookie = `auth_token=${token}; path=/; max-age=604800`;
      document.cookie = `user_type=${userType}; path=/; max-age=604800`;

      // Redirect to appropriate dashboard
      router.push(redirectPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-orange-400 to-orange-500 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="mb-6 flex items-center text-white hover:text-orange-100 transition-colors"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back
        </button>

        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">My Contractor Now</h1>
          <p className="mt-2 text-sm text-orange-100">
            Sign in to your account
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white shadow-xl rounded-lg p-8">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-start">
                <AlertCircle className="h-5 w-5 text-red-400 mr-3 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <EmailInput
              value={email}
              onChange={setEmail}
              label="Email address"
              required
              icon={<Mail className="h-5 w-5 text-gray-400" />}
              placeholder="you@example.com"
            />

            <TextInput
              type="password"
              value={password}
              onChange={setPassword}
              label="Password"
              required
              icon={<Lock className="h-5 w-5 text-gray-400" />}
              placeholder="Enter your password"
            />

            <Button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin h-4 w-4 mr-2" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </Button>
          </form>
        </div>

        {/* Footer links */}
        <div className="mt-6 text-center space-y-2">
          <p className="text-sm text-white">
            Want to become an affiliate?{' '}
            <a href="/affiliate" className="font-medium text-white underline hover:text-orange-100">
              Sign up here
            </a>
          </p>
          <p className="text-sm text-white">
            Need help?{' '}
            <a href="mailto:support@mycontractornow.com" className="font-medium text-white underline hover:text-orange-100">
              Contact support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Get the token storage key for a user type
 * Maintains backwards compatibility with existing token keys
 */
function getTokenKey(userType: UserType): string {
  switch (userType) {
    case 'admin':
      return 'admin_token';
    case 'affiliate':
      return 'affiliate_token';
    case 'contractor':
      return 'contractor_token';
    default:
      return 'auth_token';
  }
}
