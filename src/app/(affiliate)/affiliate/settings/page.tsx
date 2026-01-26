'use client';

/**
 * Affiliate Settings Page
 *
 * WHY: Allows affiliates to manage their profile, security, API access,
 *      and postback notification settings.
 *
 * WHEN: Affiliate needs to update any account settings.
 *
 * HOW: Organized into sections for profile, password, API access, and postbacks.
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { TextInput, EmailInput, PhoneInput } from '@/components/ui/fields';
import {
  User,
  Mail,
  Phone,
  Globe,
  Lock,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import ApiAccessSettings from '@/components/affiliate/ApiAccessSettings';
import PostbackSettings from '@/components/affiliate/PostbackSettings';

interface Profile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  website: string | null;
  paymentMethod: string | null;
  paymentDetails: Record<string, string> | null;
}

export default function AffiliateSettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [token, setToken] = useState<string | null>(null);

  // Profile form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    const storedToken = localStorage.getItem('affiliate_token');
    setToken(storedToken);

    const fetchProfile = async () => {
      if (!storedToken) return;

      try {
        const response = await fetch('/api/affiliates/me', {
          headers: { Authorization: `Bearer ${storedToken}` }
        });
        const data = await response.json();

        if (data.success && data.data) {
          setProfile(data.data);
          setFirstName(data.data.firstName);
          setLastName(data.data.lastName);
          setPhone(data.data.phone || '');
          setWebsite(data.data.website || '');
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      const response = await fetch('/api/affiliates/me', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim() || null,
          website: website.trim() || null
        })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to update profile');
      }

      setSuccess('Profile updated successfully!');
      setProfile(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    setChangingPassword(true);

    try {
      const response = await fetch('/api/affiliates/me', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to change password');
      }

      setPasswordSuccess('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordError(
        err instanceof Error ? err.message : 'Failed to change password'
      );
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your profile and account settings
        </p>
      </div>

      {/* Profile and Password Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile Settings */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">
              Profile Information
            </h3>
          </div>
          <div className="px-4 py-5 sm:p-6">
            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-3 flex items-start">
                <AlertCircle className="h-5 w-5 text-red-400 mr-2 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {success && (
              <div className="mb-4 bg-green-50 border border-green-200 rounded-md p-3 flex items-start">
                <CheckCircle className="h-5 w-5 text-green-400 mr-2 mt-0.5" />
                <p className="text-sm text-green-700">{success}</p>
              </div>
            )}

            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div>
                <EmailInput
                  value={profile?.email || ''}
                  onChange={() => {}}
                  label="Email"
                  disabled
                  icon={<Mail className="h-5 w-5 text-gray-400" />}
                  helperText="Email cannot be changed"
                  variant="emerald"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <TextInput
                  value={firstName}
                  onChange={setFirstName}
                  label="First Name"
                  nameOnly
                  capitalizeWords
                  icon={<User className="h-5 w-5 text-gray-400" />}
                  variant="emerald"
                />
                <TextInput
                  value={lastName}
                  onChange={setLastName}
                  label="Last Name"
                  nameOnly
                  capitalizeWords
                  variant="emerald"
                />
              </div>

              <PhoneInput
                value={phone}
                onChange={setPhone}
                label="Phone"
                icon={<Phone className="h-5 w-5 text-gray-400" />}
                variant="emerald"
              />

              <TextInput
                type="url"
                value={website}
                onChange={setWebsite}
                label="Website"
                icon={<Globe className="h-5 w-5 text-gray-400" />}
                placeholder="https://"
                variant="emerald"
              />

              <Button
                type="submit"
                disabled={saving}
                className="w-full bg-emerald-600 hover:bg-emerald-700"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </form>
          </div>
        </div>

        {/* Password Change */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">
              Change Password
            </h3>
          </div>
          <div className="px-4 py-5 sm:p-6">
            {passwordError && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-3 flex items-start">
                <AlertCircle className="h-5 w-5 text-red-400 mr-2 mt-0.5" />
                <p className="text-sm text-red-700">{passwordError}</p>
              </div>
            )}

            {passwordSuccess && (
              <div className="mb-4 bg-green-50 border border-green-200 rounded-md p-3 flex items-start">
                <CheckCircle className="h-5 w-5 text-green-400 mr-2 mt-0.5" />
                <p className="text-sm text-green-700">{passwordSuccess}</p>
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <TextInput
                type="password"
                value={currentPassword}
                onChange={setCurrentPassword}
                label="Current Password"
                icon={<Lock className="h-5 w-5 text-gray-400" />}
                variant="emerald"
              />

              <TextInput
                type="password"
                value={newPassword}
                onChange={setNewPassword}
                label="New Password"
                icon={<Lock className="h-5 w-5 text-gray-400" />}
                placeholder="At least 8 characters"
                variant="emerald"
              />

              <TextInput
                type="password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                label="Confirm New Password"
                icon={<Lock className="h-5 w-5 text-gray-400" />}
                variant="emerald"
              />

              <Button
                type="submit"
                disabled={changingPassword}
                className="w-full bg-emerald-600 hover:bg-emerald-700"
              >
                {changingPassword ? 'Changing...' : 'Change Password'}
              </Button>
            </form>
          </div>
        </div>
      </div>

      {/* API Access and Postback Row */}
      {token && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ApiAccessSettings token={token} />
          <PostbackSettings token={token} />
        </div>
      )}
    </div>
  );
}
