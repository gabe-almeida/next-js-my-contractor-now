'use client';

/**
 * API Access Settings Component
 *
 * WHY: Allows affiliates to generate and manage their API credentials
 *      for programmatic access to their data.
 *
 * WHEN: Displayed on the affiliate settings page.
 *
 * HOW: Fetches current API key status, allows generation/revocation of credentials.
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import {
  Key,
  Copy,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff,
  ExternalLink
} from 'lucide-react';

interface ApiAccessSettingsProps {
  token: string;
}

interface ApiCredentials {
  apiKey: string;
  apiSecret: string;
}

export default function ApiAccessSettings({ token }: ApiAccessSettingsProps) {
  const [hasCredentials, setHasCredentials] = useState(false);
  const [maskedKey, setMaskedKey] = useState<string | null>(null);
  const [newCredentials, setNewCredentials] = useState<ApiCredentials | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState<'key' | 'secret' | null>(null);

  useEffect(() => {
    fetchApiStatus();
  }, []);

  const fetchApiStatus = async () => {
    try {
      const response = await fetch('/api/affiliates/api-credentials', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();

      if (data.success) {
        setHasCredentials(data.data.hasCredentials);
        setMaskedKey(data.data.maskedKey);
      }
    } catch (err) {
      console.error('Error fetching API status:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    setError('');
    setSuccess('');
    setGenerating(true);

    try {
      const response = await fetch('/api/affiliates/api-credentials', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to generate credentials');
      }

      setNewCredentials(data.data.credentials);
      setHasCredentials(true);
      setMaskedKey(data.data.maskedKey);
      setSuccess(
        'API credentials generated! Save your API Secret now - it will not be shown again.'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate credentials');
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = async () => {
    if (!confirm('Are you sure? This will invalidate your current API credentials.')) {
      return;
    }

    setError('');
    setSuccess('');
    setRevoking(true);

    try {
      const response = await fetch('/api/affiliates/api-credentials', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to revoke credentials');
      }

      setHasCredentials(false);
      setMaskedKey(null);
      setNewCredentials(null);
      setSuccess('API credentials revoked successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke credentials');
    } finally {
      setRevoking(false);
    }
  };

  const copyToClipboard = async (text: string, type: 'key' | 'secret') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">API Access</h3>
        </div>
        <div className="px-4 py-8 flex justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">API Access</h3>
          <a
            href="/docs/api/affiliate-api-v1.md"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
          >
            View API Docs <ExternalLink className="h-4 w-4" />
          </a>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Use API credentials to access your data programmatically
        </p>
      </div>

      <div className="px-4 py-5 sm:p-6 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 flex items-start">
            <AlertCircle className="h-5 w-5 text-red-400 mr-2 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-md p-3 flex items-start">
            <CheckCircle className="h-5 w-5 text-green-400 mr-2 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-green-700">{success}</p>
          </div>
        )}

        {/* New Credentials Display */}
        {newCredentials && (
          <div className="bg-amber-50 border border-amber-200 rounded-md p-4 space-y-3">
            <div className="flex items-center gap-2 text-amber-800">
              <AlertCircle className="h-5 w-5" />
              <span className="font-medium">Save your credentials now!</span>
            </div>
            <p className="text-sm text-amber-700">
              Your API Secret will only be shown once. Store it securely.
            </p>

            <div className="space-y-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  API Key
                </label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-white border border-gray-300 rounded px-3 py-2 text-sm font-mono">
                    {newCredentials.apiKey}
                  </code>
                  <button
                    onClick={() => copyToClipboard(newCredentials.apiKey, 'key')}
                    className="p-2 text-gray-500 hover:text-gray-700"
                    title="Copy API Key"
                  >
                    {copied === 'key' ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <Copy className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  API Secret
                </label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-white border border-gray-300 rounded px-3 py-2 text-sm font-mono">
                    {showSecret
                      ? newCredentials.apiSecret
                      : '*'.repeat(newCredentials.apiSecret.length)}
                  </code>
                  <button
                    onClick={() => setShowSecret(!showSecret)}
                    className="p-2 text-gray-500 hover:text-gray-700"
                    title={showSecret ? 'Hide Secret' : 'Show Secret'}
                  >
                    {showSecret ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                  <button
                    onClick={() =>
                      copyToClipboard(newCredentials.apiSecret, 'secret')
                    }
                    className="p-2 text-gray-500 hover:text-gray-700"
                    title="Copy API Secret"
                  >
                    {copied === 'secret' ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <Copy className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Current Credentials Status */}
        {hasCredentials && !newCredentials && (
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-md">
            <Key className="h-5 w-5 text-gray-400" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">
                API Key: {maskedKey}
              </p>
              <p className="text-xs text-gray-500">
                Credentials are active. Regenerate to get new ones.
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          {hasCredentials ? (
            <>
              <Button
                onClick={handleGenerate}
                disabled={generating}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${generating ? 'animate-spin' : ''}`}
                />
                {generating ? 'Regenerating...' : 'Regenerate Credentials'}
              </Button>
              <Button
                onClick={handleRevoke}
                disabled={revoking}
                variant="outline"
                className="border-red-300 text-red-600 hover:bg-red-50"
              >
                {revoking ? 'Revoking...' : 'Revoke Credentials'}
              </Button>
            </>
          ) : (
            <Button
              onClick={handleGenerate}
              disabled={generating}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Key className="h-4 w-4 mr-2" />
              {generating ? 'Generating...' : 'Generate API Credentials'}
            </Button>
          )}
        </div>

        {/* Usage Example */}
        {hasCredentials && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h4 className="text-sm font-medium text-gray-900 mb-2">
              Quick Start
            </h4>
            <pre className="bg-gray-900 text-gray-100 rounded-md p-3 text-xs overflow-x-auto">
              {`curl -H "Authorization: Bearer API_KEY:API_SECRET" \\
  https://api.mycontractornow.com/api/v1/affiliate/stats`}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
