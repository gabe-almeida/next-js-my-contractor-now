'use client';

/**
 * Affiliate Signup Page
 *
 * WHY: Allows new affiliates to register for the program.
 * WHEN: New users want to become affiliates and earn commissions.
 * HOW: Collects required info, creates pending affiliate account,
 *      shows success message that admin approval is required.
 */

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { TextInput, EmailInput, PhoneInput, TextAreaInput } from '@/components/ui/fields';
import { User, Mail, Lock, Phone, Globe, AlertCircle, CheckCircle } from 'lucide-react';

export default function AffiliateSignupPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    phone: '',
    website: '',
    marketingChannels: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePhoneChange = (cleanValue: string) => {
    setFormData(prev => ({ ...prev, phone: cleanValue }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Validate password strength
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/affiliates/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: formData.phone || undefined,
          website: formData.website || undefined,
          marketingChannels: formData.marketingChannels || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Signup failed');
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 text-center">
          <div className="bg-emerald-50 rounded-full h-16 w-16 flex items-center justify-center mx-auto">
            <CheckCircle className="h-8 w-8 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">
            Application Submitted!
          </h2>
          <p className="text-gray-600">
            Thank you for applying to our affiliate program. Your application is being reviewed
            and you will receive an email once your account is approved.
          </p>
          <Link
            href="/affiliate/login"
            className="inline-block text-emerald-600 hover:text-emerald-500 font-medium"
          >
            Return to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Become an Affiliate
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Earn commissions by referring customers to our platform
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-start">
              <AlertCircle className="h-5 w-5 text-red-400 mr-3 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            {/* Name fields */}
            <div className="grid grid-cols-2 gap-4">
              <TextInput
                value={formData.firstName}
                onChange={(value) => setFormData(prev => ({ ...prev, firstName: value }))}
                label="First name"
                required
                nameOnly
                capitalizeWords
                icon={<User className="h-5 w-5 text-gray-400" />}
                variant="emerald"
              />
              <TextInput
                value={formData.lastName}
                onChange={(value) => setFormData(prev => ({ ...prev, lastName: value }))}
                label="Last name"
                required
                nameOnly
                capitalizeWords
                variant="emerald"
              />
            </div>

            {/* Email */}
            <EmailInput
              value={formData.email}
              onChange={(value) => setFormData(prev => ({ ...prev, email: value }))}
              label="Email address"
              required
              icon={<Mail className="h-5 w-5 text-gray-400" />}
              placeholder="you@example.com"
              variant="emerald"
            />

            {/* Password fields */}
            <TextInput
              type="password"
              value={formData.password}
              onChange={(value) => setFormData(prev => ({ ...prev, password: value }))}
              label="Password"
              required
              icon={<Lock className="h-5 w-5 text-gray-400" />}
              placeholder="At least 8 characters"
              variant="emerald"
            />

            <TextInput
              type="password"
              value={formData.confirmPassword}
              onChange={(value) => setFormData(prev => ({ ...prev, confirmPassword: value }))}
              label="Confirm password"
              required
              icon={<Lock className="h-5 w-5 text-gray-400" />}
              variant="emerald"
            />

            {/* Phone - Required */}
            <PhoneInput
              value={formData.phone}
              onChange={handlePhoneChange}
              label="Phone number"
              required
              icon={<Phone className="h-5 w-5 text-gray-400" />}
              showValidation
              variant="emerald"
            />

            {/* Optional fields */}
            <TextInput
              type="url"
              value={formData.website}
              onChange={(value) => setFormData(prev => ({ ...prev, website: value }))}
              label="Website or social media"
              icon={<Globe className="h-5 w-5 text-gray-400" />}
              placeholder="https://..."
              variant="emerald"
            />

            <TextAreaInput
              value={formData.marketingChannels}
              onChange={(value) => setFormData(prev => ({ ...prev, marketingChannels: value }))}
              label="How will you promote us?"
              rows={3}
              placeholder="e.g., blog, YouTube, email list, social media..."
              variant="emerald"
            />
          </div>

          <div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Submitting...' : 'Submit Application'}
            </Button>
          </div>

          <div className="text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link
                href="/affiliate/login"
                className="font-medium text-emerald-600 hover:text-emerald-500"
              >
                Sign in
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
