'use client';

/**
 * Buyer Call Settings Tab Component
 *
 * WHY: Provides admin interface for configuring buyer call acceptance settings.
 *      Part of the pay-per-call system enabling contractors/networks to receive calls.
 *
 * WHEN: Rendered when admin selects "Call Settings" tab on buyer detail page.
 *
 * HOW: Fetches current settings from API, displays form sections, validates
 *      inputs client-side, and saves to API on submit.
 */

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { AdminSection, AdminSelect } from '@/components/admin/ui';
import { HoursOfOperationEditor, HoursOfOperation } from './HoursOfOperationEditor';
import {
  Phone,
  DollarSign,
  Clock,
  Settings,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Save
} from 'lucide-react';

// =====================================
// TYPE DEFINITIONS
// =====================================

interface DayHours {
  active: boolean;
  start: string;
  end: string;
}

interface CallSettings {
  acceptsCalls: boolean;
  callBidAmount: number;
  callMinBid: number;
  callMaxBid: number;
  callForwardingNumber: string | null;
  callBackupNumber: string | null;
  callDailyCap: number;
  callRingTimeout: number;
  timezone: string;
  hoursOfOperation: HoursOfOperation;
  requireIvrQualification: boolean;
  acceptWithoutCallerId: boolean;
  allowCascade: boolean;
}

interface BuyerCallSettingsTabProps {
  buyerId: string;
  buyerType: 'CONTRACTOR' | 'NETWORK';
}

interface ValidationErrors {
  callForwardingNumber?: string;
  callBackupNumber?: string;
  callBidAmount?: string;
  callMinBid?: string;
  callMaxBid?: string;
  callRingTimeout?: string;
  hours?: Record<string, string>;
}

// =====================================
// CONSTANTS
// =====================================

const TIMEZONE_OPTIONS = [
  { value: 'America/New_York', label: 'Eastern (ET)' },
  { value: 'America/Chicago', label: 'Central (CT)' },
  { value: 'America/Denver', label: 'Mountain (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific (PT)' },
  { value: 'America/Phoenix', label: 'Arizona (MST)' },
  { value: 'America/Anchorage', label: 'Alaska (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii (HST)' }
];

const DEFAULT_SETTINGS: CallSettings = {
  acceptsCalls: false,
  callBidAmount: 25,
  callMinBid: 5,
  callMaxBid: 100,
  callForwardingNumber: null,
  callBackupNumber: null,
  callDailyCap: 0,
  callRingTimeout: 25,
  timezone: 'America/New_York',
  hoursOfOperation: {
    monday: { active: true, start: '08:00', end: '18:00' },
    tuesday: { active: true, start: '08:00', end: '18:00' },
    wednesday: { active: true, start: '08:00', end: '18:00' },
    thursday: { active: true, start: '08:00', end: '18:00' },
    friday: { active: true, start: '08:00', end: '18:00' },
    saturday: { active: false, start: '09:00', end: '17:00' },
    sunday: { active: false, start: '09:00', end: '17:00' }
  },
  requireIvrQualification: true,
  acceptWithoutCallerId: false,
  allowCascade: true
};

// =====================================
// HELPER FUNCTIONS
// =====================================

/**
 * Format phone number for display
 */
function formatPhoneDisplay(phone: string | null): string {
  if (!phone) return '';
  // If E.164 format (+1XXXXXXXXXX), convert to (XXX) XXX-XXXX
  const match = phone.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  if (match) {
    return `(${match[1]}) ${match[2]}-${match[3]}`;
  }
  return phone;
}

/**
 * Validate phone number format
 */
function isValidPhone(phone: string): boolean {
  if (!phone) return true;
  // Accept formats: (XXX) XXX-XXXX, XXX-XXX-XXXX, XXXXXXXXXX, +1XXXXXXXXXX
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  return /^(\+1)?[2-9]\d{9}$/.test(cleaned);
}

// =====================================
// COMPONENT
// =====================================

export function BuyerCallSettingsTab({ buyerId, buyerType }: BuyerCallSettingsTabProps) {
  const [settings, setSettings] = useState<CallSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isDirty, setIsDirty] = useState(false);

  // Fetch settings on mount
  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/admin/buyers/${buyerId}/call-settings`, {
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load call settings');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to load settings');
      }

      setSettings({
        ...result.data,
        callForwardingNumber: formatPhoneDisplay(result.data.callForwardingNumber),
        callBackupNumber: formatPhoneDisplay(result.data.callBackupNumber)
      });
      setIsDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [buyerId]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Validate settings client-side
  const validateSettings = useCallback((): boolean => {
    const newErrors: ValidationErrors = {};

    // Phone validation
    if (settings.acceptsCalls && !settings.callForwardingNumber) {
      newErrors.callForwardingNumber = 'Primary phone number is required when accepting calls';
    } else if (settings.callForwardingNumber && !isValidPhone(settings.callForwardingNumber)) {
      newErrors.callForwardingNumber = 'Invalid phone format. Use (XXX) XXX-XXXX';
    }

    if (settings.callBackupNumber && !isValidPhone(settings.callBackupNumber)) {
      newErrors.callBackupNumber = 'Invalid phone format. Use (XXX) XXX-XXXX';
    }

    // Bid validation
    if (settings.callMinBid < 5 || settings.callMinBid > 500) {
      newErrors.callMinBid = 'Must be between $5 and $500';
    }
    if (settings.callMaxBid < 5 || settings.callMaxBid > 500) {
      newErrors.callMaxBid = 'Must be between $5 and $500';
    }
    if (settings.callBidAmount < 5 || settings.callBidAmount > 500) {
      newErrors.callBidAmount = 'Must be between $5 and $500';
    }
    if (settings.callMinBid > settings.callMaxBid) {
      newErrors.callMinBid = 'Min bid cannot exceed max bid';
    }
    if (settings.callBidAmount < settings.callMinBid || settings.callBidAmount > settings.callMaxBid) {
      newErrors.callBidAmount = 'Bid must be between min and max';
    }

    // Ring timeout validation
    if (settings.callRingTimeout < 10 || settings.callRingTimeout > 60) {
      newErrors.callRingTimeout = 'Must be between 10 and 60 seconds';
    }

    // Hours validation
    const hoursErrors: Record<string, string> = {};
    Object.entries(settings.hoursOfOperation).forEach(([day, hours]) => {
      if (!hours.active) return;
      const [startH, startM] = hours.start.split(':').map(Number);
      const [endH, endM] = hours.end.split(':').map(Number);
      const startMins = startH * 60 + startM;
      const endMins = endH * 60 + endM;
      if (endMins - startMins < 60) {
        hoursErrors[day] = 'End must be at least 1 hour after start';
      }
    });
    if (Object.keys(hoursErrors).length > 0) {
      newErrors.hours = hoursErrors;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [settings]);

  // Save settings
  const handleSave = async () => {
    if (!validateSettings()) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const response = await fetch(`/api/admin/buyers/${buyerId}/call-settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`
        },
        body: JSON.stringify(settings)
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to save settings');
      }

      setSettings({
        ...result.data,
        callForwardingNumber: formatPhoneDisplay(result.data.callForwardingNumber),
        callBackupNumber: formatPhoneDisplay(result.data.callBackupNumber)
      });
      setSuccess('Call settings saved successfully');
      setIsDirty(false);

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  // Handle field changes
  const updateField = <K extends keyof CallSettings>(field: K, value: CallSettings[K]) => {
    setSettings(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
    // Clear specific error when field changes
    if (field in errors) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3" />
        <div className="bg-gray-100 rounded-xl h-64" />
        <div className="bg-gray-100 rounded-xl h-48" />
        <div className="bg-gray-100 rounded-xl h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Save Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Phone className="h-5 w-5 text-orange-500" />
          <h3 className="text-lg font-semibold text-gray-900">Call Settings</h3>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchSettings}
            disabled={loading}
            className="p-2 text-gray-400 hover:text-gray-600"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Button
            onClick={handleSave}
            disabled={saving || !isDirty}
            loading={saving}
            loadingText="Saving..."
            className="bg-orange-500 hover:bg-orange-600 gap-2"
          >
            <Save className="h-4 w-4" />
            Save Changes
          </Button>
        </div>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2 text-red-800">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-2 text-green-800">
          <CheckCircle className="h-5 w-5 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Acceptance Settings Section */}
      <AdminSection
        title="Acceptance Settings"
        description="Control whether this buyer receives calls and set bidding preferences"
      >
        <div className="space-y-6">
          {/* Accept Calls Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <label className="font-medium text-gray-900">Accept Calls</label>
              <p className="text-sm text-gray-500 mt-0.5">
                Enable to include this buyer in call auctions
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.acceptsCalls}
                onChange={(e) => updateField('acceptsCalls', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500" />
            </label>
          </div>

          {/* Bid Settings Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <DollarSign className="h-4 w-4 inline mr-1" />
                Bid Amount
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  min={5}
                  max={500}
                  step={1}
                  value={settings.callBidAmount}
                  onChange={(e) => updateField('callBidAmount', Number(e.target.value))}
                  className={`w-full pl-7 pr-3 py-2 border rounded-md focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 ${
                    errors.callBidAmount ? 'border-red-300' : 'border-gray-200'
                  }`}
                />
              </div>
              {errors.callBidAmount && (
                <p className="text-xs text-red-600 mt-1">{errors.callBidAmount}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Min Bid</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  min={5}
                  max={500}
                  step={1}
                  value={settings.callMinBid}
                  onChange={(e) => updateField('callMinBid', Number(e.target.value))}
                  className={`w-full pl-7 pr-3 py-2 border rounded-md focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 ${
                    errors.callMinBid ? 'border-red-300' : 'border-gray-200'
                  }`}
                />
              </div>
              {errors.callMinBid && (
                <p className="text-xs text-red-600 mt-1">{errors.callMinBid}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Bid</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  min={5}
                  max={500}
                  step={1}
                  value={settings.callMaxBid}
                  onChange={(e) => updateField('callMaxBid', Number(e.target.value))}
                  className={`w-full pl-7 pr-3 py-2 border rounded-md focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 ${
                    errors.callMaxBid ? 'border-red-300' : 'border-gray-200'
                  }`}
                />
              </div>
              {errors.callMaxBid && (
                <p className="text-xs text-red-600 mt-1">{errors.callMaxBid}</p>
              )}
            </div>
          </div>

          {/* Daily Cap */}
          <div className="max-w-xs">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Daily Call Cap
            </label>
            <input
              type="number"
              min={0}
              value={settings.callDailyCap}
              onChange={(e) => updateField('callDailyCap', Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter 0 for unlimited calls per day
            </p>
          </div>
        </div>
      </AdminSection>

      {/* Call Routing Section */}
      <AdminSection
        title="Call Routing"
        description="Configure phone numbers for receiving calls"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Phone className="h-4 w-4 inline mr-1" />
                Primary Number *
              </label>
              <input
                type="tel"
                value={settings.callForwardingNumber || ''}
                onChange={(e) => updateField('callForwardingNumber', e.target.value || null)}
                placeholder="(555) 123-4567"
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 ${
                  errors.callForwardingNumber ? 'border-red-300' : 'border-gray-200'
                }`}
              />
              {errors.callForwardingNumber && (
                <p className="text-xs text-red-600 mt-1">{errors.callForwardingNumber}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Main number where calls will be forwarded
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Phone className="h-4 w-4 inline mr-1" />
                Backup Number
              </label>
              <input
                type="tel"
                value={settings.callBackupNumber || ''}
                onChange={(e) => updateField('callBackupNumber', e.target.value || null)}
                placeholder="(555) 987-6543"
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 ${
                  errors.callBackupNumber ? 'border-red-300' : 'border-gray-200'
                }`}
              />
              {errors.callBackupNumber && (
                <p className="text-xs text-red-600 mt-1">{errors.callBackupNumber}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Used if primary number fails (optional)
              </p>
            </div>
          </div>

          <div className="max-w-xs">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Clock className="h-4 w-4 inline mr-1" />
              Ring Timeout (seconds)
            </label>
            <input
              type="number"
              min={10}
              max={60}
              value={settings.callRingTimeout}
              onChange={(e) => updateField('callRingTimeout', Number(e.target.value))}
              className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 ${
                errors.callRingTimeout ? 'border-red-300' : 'border-gray-200'
              }`}
            />
            {errors.callRingTimeout && (
              <p className="text-xs text-red-600 mt-1">{errors.callRingTimeout}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              How long to ring before trying next buyer (10-60 seconds)
            </p>
          </div>
        </div>
      </AdminSection>

      {/* Hours of Operation Section */}
      <AdminSection
        title="Hours of Operation"
        description="Set when this buyer is available to receive calls"
      >
        <div className="space-y-4">
          <div className="max-w-xs">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Clock className="h-4 w-4 inline mr-1" />
              Timezone
            </label>
            <AdminSelect
              value={settings.timezone}
              onChange={(value) => updateField('timezone', value)}
              options={TIMEZONE_OPTIONS}
              icon={false}
            />
          </div>

          <HoursOfOperationEditor
            hours={settings.hoursOfOperation}
            onChange={(hours) => updateField('hoursOfOperation', hours)}
            errors={errors.hours}
          />
        </div>
      </AdminSection>

      {/* Call Preferences Section */}
      <AdminSection
        title="Call Preferences"
        description="Additional call handling options"
      >
        <div className="space-y-4">
          <label className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
            <input
              type="checkbox"
              checked={settings.requireIvrQualification}
              onChange={(e) => updateField('requireIvrQualification', e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
            />
            <div>
              <span className="font-medium text-gray-900">Require IVR Pre-qualification</span>
              <p className="text-sm text-gray-500 mt-0.5">
                Only receive calls that have been qualified through an IVR flow
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
            <input
              type="checkbox"
              checked={settings.acceptWithoutCallerId}
              onChange={(e) => updateField('acceptWithoutCallerId', e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
            />
            <div>
              <span className="font-medium text-gray-900">Accept Calls Without Caller ID</span>
              <p className="text-sm text-gray-500 mt-0.5">
                Include this buyer in auctions for calls with blocked/unknown caller ID
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
            <input
              type="checkbox"
              checked={settings.allowCascade}
              onChange={(e) => updateField('allowCascade', e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
            />
            <div>
              <span className="font-medium text-gray-900">Allow Cascade (Backup Buyer)</span>
              <p className="text-sm text-gray-500 mt-0.5">
                Receive calls that another buyer did not answer (secondary routing)
              </p>
            </div>
          </label>
        </div>
      </AdminSection>

      {/* Unsaved Changes Warning */}
      {isDirty && (
        <div className="fixed bottom-4 right-4 bg-orange-50 border border-orange-200 rounded-lg p-4 shadow-lg flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-orange-500" />
          <span className="text-sm text-orange-800">You have unsaved changes</span>
          <Button
            onClick={handleSave}
            loading={saving}
            size="sm"
            className="bg-orange-500 hover:bg-orange-600"
          >
            Save
          </Button>
        </div>
      )}
    </div>
  );
}
