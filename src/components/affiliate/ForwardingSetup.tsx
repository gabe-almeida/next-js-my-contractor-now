/**
 * ForwardingSetup Component
 *
 * WHY: Affiliates using external call tracking (Ringba, Retreaver, etc.) need to
 *      configure forwarding to our ingress numbers. This component guides them
 *      through the setup process and displays their forwarding configuration.
 *
 * WHEN: Displayed in the affiliate campaigns page when an affiliate chooses
 *       to forward calls from their own tracking system instead of using
 *       our platform-provisioned numbers.
 *
 * HOW:
 *   1. Shows available ingress numbers
 *   2. Affiliate selects forwarding option
 *   3. API creates forwarding configuration
 *   4. Component displays forwarding instructions with copy-to-clipboard
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Copy, Check, Phone, Settings, AlertCircle, Loader2, Info } from 'lucide-react';

// =====================================
// TYPE DEFINITIONS
// =====================================

interface ForwardingConfig {
  id: string;
  campaignId: string;
  campaignName: string;
  ingressPhoneNumber: string;
  ingressPhoneNumberDisplay: string | null;
  forwardingIdentifier: string;
  sipUsername?: string;
  sipPassword?: string;
  sipRealm?: string;
  status: 'ACTIVE' | 'PENDING' | 'RELEASED';
  createdAt: string;
}

interface IngressNumber {
  id: string;
  phoneNumber: string;
  phoneNumberDisplay: string | null;
  active: boolean;
  usageCount: number;
}

interface ForwardingSetupProps {
  affiliateId: string;
  campaignId: string;
  campaignName: string;
  existingConfig?: ForwardingConfig | null;
  onConfigCreated?: (config: ForwardingConfig) => void;
  onConfigReleased?: () => void;
}

// =====================================
// COPY BUTTON COMPONENT
// =====================================

function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = value;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 px-2 py-1 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
      title={`Copy ${label || 'value'}`}
    >
      {copied ? (
        <>
          <Check className="h-4 w-4 text-green-600" />
          <span className="text-green-600">Copied!</span>
        </>
      ) : (
        <>
          <Copy className="h-4 w-4" />
          <span>Copy</span>
        </>
      )}
    </button>
  );
}

// =====================================
// MAIN COMPONENT
// =====================================

export default function ForwardingSetup({
  affiliateId,
  campaignId,
  campaignName,
  existingConfig: initialConfig,
  onConfigCreated,
  onConfigReleased,
}: ForwardingSetupProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<ForwardingConfig | null>(initialConfig || null);
  const [ingressNumbers, setIngressNumbers] = useState<IngressNumber[]>([]);
  const [selectedIngressId, setSelectedIngressId] = useState<string>('');
  const [generateSipCredentials, setGenerateSipCredentials] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  // =====================================
  // LOAD INGRESS NUMBERS
  // =====================================

  const loadIngressNumbers = useCallback(async () => {
    try {
      const response = await fetch('/api/affiliate/forwarding/ingress-numbers');
      if (!response.ok) {
        throw new Error('Failed to load ingress numbers');
      }
      const data = await response.json();
      setIngressNumbers(data.numbers || []);
    } catch (err) {
      console.error('Failed to load ingress numbers:', err);
    }
  }, []);

  useEffect(() => {
    if (!config) {
      loadIngressNumbers();
    }
  }, [config, loadIngressNumbers]);

  // =====================================
  // CREATE FORWARDING CONFIG
  // =====================================

  const handleCreateConfig = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/affiliate/forwarding/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          affiliateId,
          campaignId,
          ingressNumberId: selectedIngressId || undefined,
          generateSipCredentials,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create forwarding configuration');
      }

      const newConfig: ForwardingConfig = {
        id: data.trackingNumber.id,
        campaignId,
        campaignName,
        ingressPhoneNumber: data.forwardingConfig.ingressPhoneNumber,
        ingressPhoneNumberDisplay: data.forwardingConfig.ingressPhoneNumberDisplay,
        forwardingIdentifier: data.forwardingConfig.forwardingIdentifier,
        sipUsername: data.forwardingConfig.sipUsername,
        sipPassword: data.forwardingConfig.sipPassword,
        sipRealm: data.forwardingConfig.sipRealm,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      };

      setConfig(newConfig);
      setShowInstructions(true);
      onConfigCreated?.(newConfig);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // =====================================
  // RELEASE FORWARDING CONFIG
  // =====================================

  const handleReleaseConfig = async () => {
    if (!config || !confirm('Are you sure you want to release this forwarding configuration? Active calls will not be affected, but new calls will no longer be tracked.')) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/affiliate/forwarding/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackingNumberId: config.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to release forwarding configuration');
      }

      setConfig(null);
      onConfigReleased?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // =====================================
  // RENDER: EXISTING CONFIGURATION
  // =====================================

  if (config) {
    return (
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-green-600" />
              <h3 className="font-semibold text-gray-900">Forwarding Active</h3>
            </div>
            <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
              {config.status}
            </span>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Ingress Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Forward calls to this number:
            </label>
            <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border">
              <span className="font-mono text-lg font-semibold text-gray-900">
                {config.ingressPhoneNumberDisplay || config.ingressPhoneNumber}
              </span>
              <CopyButton value={config.ingressPhoneNumber} label="phone number" />
            </div>
          </div>

          {/* Forwarding Identifier */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Forwarding Identifier (use in SIP headers):
            </label>
            <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border">
              <code className="text-sm text-gray-800 break-all">
                {config.forwardingIdentifier}
              </code>
              <CopyButton value={config.forwardingIdentifier} label="identifier" />
            </div>
          </div>

          {/* SIP Credentials (if generated) */}
          {config.sipUsername && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-2 mb-3">
                <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-yellow-800">SIP Credentials</h4>
                  <p className="text-sm text-yellow-700">
                    Save these credentials securely. The password will not be shown again.
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Username:</span>
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-mono">{config.sipUsername}</code>
                    <CopyButton value={config.sipUsername} label="username" />
                  </div>
                </div>
                {config.sipPassword && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Password:</span>
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono">{config.sipPassword}</code>
                      <CopyButton value={config.sipPassword} label="password" />
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Realm:</span>
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-mono">{config.sipRealm}</code>
                    <CopyButton value={config.sipRealm || ''} label="realm" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Setup Instructions */}
          <button
            onClick={() => setShowInstructions(!showInstructions)}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            <Info className="h-4 w-4" />
            {showInstructions ? 'Hide' : 'Show'} Setup Instructions
          </button>

          {showInstructions && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
              <h4 className="font-medium text-blue-900">How to configure your call tracking system:</h4>

              <div className="space-y-4 text-sm text-blue-800">
                <div>
                  <h5 className="font-semibold mb-1">Option 1: SIP Headers (Recommended)</h5>
                  <p className="mb-2">Configure your system to forward calls with these SIP headers:</p>
                  <div className="bg-white rounded p-2 font-mono text-xs space-y-1">
                    <div className="flex justify-between">
                      <span>X-Affiliate-ID: {affiliateId}</span>
                      <CopyButton value={`X-Affiliate-ID: ${affiliateId}`} />
                    </div>
                    <div className="flex justify-between">
                      <span>X-Campaign-ID: {campaignId}</span>
                      <CopyButton value={`X-Campaign-ID: ${campaignId}`} />
                    </div>
                  </div>
                </div>

                <div>
                  <h5 className="font-semibold mb-1">Option 2: URL Parameters</h5>
                  <p className="mb-2">Or append these parameters to the forwarding URL:</p>
                  <div className="bg-white rounded p-2 font-mono text-xs break-all">
                    <div className="flex justify-between">
                      <span>?affiliate_id={affiliateId}&campaign_id={campaignId}</span>
                      <CopyButton value={`?affiliate_id=${affiliateId}&campaign_id=${campaignId}`} />
                    </div>
                  </div>
                </div>

                <div>
                  <h5 className="font-semibold mb-1">Option 3: Forwarding Identifier</h5>
                  <p className="mb-2">Or use the full forwarding identifier in a single header:</p>
                  <div className="bg-white rounded p-2 font-mono text-xs">
                    <div className="flex justify-between">
                      <span>X-Forwarding-ID: {config.forwardingIdentifier}</span>
                      <CopyButton value={`X-Forwarding-ID: ${config.forwardingIdentifier}`} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-blue-200">
                <p className="text-xs text-blue-700">
                  <strong>Ringba users:</strong> In your Target settings, set the Destination Number
                  to {config.ingressPhoneNumberDisplay || config.ingressPhoneNumber} and add the
                  SIP headers under &quot;Custom SIP Headers&quot;.
                </p>
              </div>
            </div>
          )}

          {/* Release Button */}
          <div className="pt-4 border-t border-gray-200">
            <button
              onClick={handleReleaseConfig}
              disabled={loading}
              className="text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50"
            >
              {loading ? 'Releasing...' : 'Release Forwarding Configuration'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =====================================
  // RENDER: SETUP FORM
  // =====================================

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-gray-600" />
          <h3 className="font-semibold text-gray-900">Forward from Your Own Number</h3>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Use your own call tracking system (Ringba, Retreaver, etc.) and forward calls to us.
        </p>
      </div>

      <div className="p-4 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Ingress Number Selection */}
        {ingressNumbers.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ingress Number (Optional)
            </label>
            <select
              value={selectedIngressId}
              onChange={(e) => setSelectedIngressId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Auto-select best available</option>
              {ingressNumbers.map((num) => (
                <option key={num.id} value={num.id} disabled={!num.active}>
                  {num.phoneNumberDisplay || num.phoneNumber}
                  {!num.active ? ' (unavailable)' : ''}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Leave empty to automatically select the best ingress number.
            </p>
          </div>
        )}

        {/* SIP Credentials Option */}
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            id="generateSipCredentials"
            checked={generateSipCredentials}
            onChange={(e) => setGenerateSipCredentials(e.target.checked)}
            className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <div>
            <label htmlFor="generateSipCredentials" className="text-sm font-medium text-gray-700">
              Generate SIP Credentials
            </label>
            <p className="text-xs text-gray-500">
              Enable this if your system requires SIP authentication for forwarding.
            </p>
          </div>
        </div>

        {/* Campaign Info */}
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-sm">
            <span className="text-gray-600">Campaign: </span>
            <span className="font-medium text-gray-900">{campaignName}</span>
          </div>
        </div>

        {/* Submit Button */}
        <button
          onClick={handleCreateConfig}
          disabled={loading}
          className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Setting up...
            </>
          ) : (
            <>
              <Phone className="h-4 w-4" />
              Set Up Forwarding
            </>
          )}
        </button>
      </div>
    </div>
  );
}
