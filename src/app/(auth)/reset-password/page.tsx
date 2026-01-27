'use client';

/**
 * Reset Password Page
 *
 * WHY: Allow users to set new password via reset link.
 * WHEN: User clicks reset link from email.
 * HOW: Verify token, submit new password, redirect to login.
 */

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/fields';
import { Lock, ArrowLeft, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  // Verify token on mount
  useEffect(() => {
    async function verifyToken() {
      if (!token) {
        setVerifying(false);
        return;
      }

      try {
        const response = await fetch(`/api/auth/reset-password?token=${token}`);
        const data = await response.json();

        if (data.success && data.valid) {
          setTokenValid(true);
        }
      } catch (err) {
        console.error('Token verification failed:', err);
      } finally {
        setVerifying(false);
      }
    }

    verifyToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to reset password');
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-orange-400 to-orange-500">
        <div className="text-center text-white">
          <Loader2 className="animate-spin h-8 w-8 mx-auto mb-4" />
          <p>Verifying reset link...</p>
        </div>
      </div>
    );
  }

  // Invalid or missing token
  if (!token || !tokenValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-orange-400 to-orange-500 py-12 px-4">
        <div className="max-w-md w-full">
          <div className="bg-white shadow-xl rounded-lg p-8 text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <h2 className="text-lg font-medium text-gray-900 mb-2">Invalid Reset Link</h2>
            <p className="text-sm text-gray-600 mb-6">
              This password reset link is invalid or has expired. Please request a new one.
            </p>
            <Button
              onClick={() => router.push('/forgot-password')}
              className="w-full py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 transition-colors"
            >
              Request new link
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-orange-400 to-orange-500 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        {/* Back Button */}
        <button
          onClick={() => router.push('/login')}
          className="mb-6 flex items-center text-white hover:text-orange-100 transition-colors"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back to login
        </button>

        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">My Contractor Now</h1>
          <p className="mt-2 text-sm text-orange-100">
            Create new password
          </p>
        </div>

        {/* Card */}
        <div className="bg-white shadow-xl rounded-lg p-8">
          {success ? (
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <h2 className="text-lg font-medium text-gray-900 mb-2">Password Reset Complete</h2>
              <p className="text-sm text-gray-600 mb-6">
                Your password has been successfully reset. You can now sign in with your new password.
              </p>
              <Button
                onClick={() => router.push('/login')}
                className="w-full py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 transition-colors"
              >
                Sign in
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-start">
                  <AlertCircle className="h-5 w-5 text-red-400 mr-3 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <TextInput
                type="password"
                value={password}
                onChange={setPassword}
                label="New password"
                required
                icon={<Lock className="h-5 w-5 text-gray-400" />}
                placeholder="Enter new password"
              />

              <TextInput
                type="password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                label="Confirm password"
                required
                icon={<Lock className="h-5 w-5 text-gray-400" />}
                placeholder="Confirm new password"
              />

              <p className="text-xs text-gray-500">
                Password must be at least 8 characters long.
              </p>

              <Button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin h-4 w-4 mr-2" />
                    Resetting...
                  </>
                ) : (
                  'Reset password'
                )}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
