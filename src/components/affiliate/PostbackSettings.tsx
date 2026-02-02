'use client';

/**
 * Postback Settings Component
 *
 * WHY: Allows affiliates to configure postback URLs for real-time
 *      conversion notifications when calls are qualified.
 *
 * WHEN: Displayed on the affiliate settings page.
 *
 * HOW: Fetches current postback config, allows testing and updating.
 */

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import {
  Webhook,
  AlertCircle,
  CheckCircle,
  TestTube2,
  Loader2,
  ExternalLink
} from 'lucide-react';

interface PostbackSettingsProps {
  token: string;
}

interface PostbackConfig {
  postbackUrl: string | null;
  postbackMethod: string;
  enabled: boolean;
}

interface TestResult {
  success: boolean;
  statusCode?: number;
  responseBody?: string;
  error?: string;
}

export default function PostbackSettings({ token }: PostbackSettingsProps) {
  const [config, setConfig] = useState<PostbackConfig>({
    postbackUrl: null,
    postbackMethod: 'POST',
    enabled: false
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [postbackUrl, setPostbackUrl] = useState('');
  const [postbackMethod, setPostbackMethod] = useState('POST');
  const [enabled, setEnabled] = useState(false);

  const fetchConfig = useCallback(async () => {
    try {
      const response = await fetch('/api/affiliates/postback', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();

      if (data.success) {
        setConfig(data.data);
        setPostbackUrl(data.data.postbackUrl || '');
        setPostbackMethod(data.data.postbackMethod || 'POST');
        setEnabled(data.data.enabled);
      }
    } catch (err) {
      console.error('Error fetching postback config:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSave = async () => {
    setError('');
    setSuccess('');
    setTestResult(null);
    setSaving(true);

    try {
      const response = await fetch('/api/affiliates/postback', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          postbackUrl: enabled ? postbackUrl.trim() : null,
          postbackMethod: postbackMethod,
          enabled
        })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to save postback settings');
      }

      setConfig(data.data);
      setSuccess(data.message || 'Postback settings saved successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!postbackUrl.trim()) {
      setError('Please enter a postback URL first');
      return;
    }

    setError('');
    setSuccess('');
    setTestResult(null);
    setTesting(true);

    try {
      const response = await fetch('/api/affiliates/postback/test', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          postbackUrl: postbackUrl.trim(),
          postbackMethod
        })
      });

      const data = await response.json();
      setTestResult(data.data);

      if (data.success) {
        setSuccess('Test postback sent successfully!');
      } else {
        setError(data.message || 'Test postback failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send test');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Postback / Webhook</h3>
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
          <h3 className="text-lg font-medium text-gray-900">
            Postback / Webhook
          </h3>
          <a
            href="/affiliate/postback-logs"
            className="text-sm text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
          >
            View Logs <ExternalLink className="h-4 w-4" />
          </a>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Receive real-time notifications when your calls convert
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

        {/* Enable Toggle */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
          <div className="flex items-center gap-3">
            <Webhook className="h-5 w-5 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-900">
                Enable Postback Notifications
              </p>
              <p className="text-xs text-gray-500">
                Receive HTTP callbacks when calls qualify
              </p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={e => setEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
          </label>
        </div>

        {/* URL and Method */}
        {enabled && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Postback URL
              </label>
              <input
                type="url"
                value={postbackUrl}
                onChange={e => setPostbackUrl(e.target.value)}
                placeholder="https://your-tracking.com/postback"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                We'll send conversion data to this URL when calls qualify
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                HTTP Method
              </label>
              <select
                value={postbackMethod}
                onChange={e => setPostbackMethod(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="POST">POST (JSON body)</option>
                <option value="GET">GET (Query parameters)</option>
              </select>
            </div>

            {/* Test Result */}
            {testResult && (
              <div
                className={`p-3 rounded-md ${
                  testResult.success
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-red-50 border border-red-200'
                }`}
              >
                <h4
                  className={`text-sm font-medium ${
                    testResult.success ? 'text-green-800' : 'text-red-800'
                  }`}
                >
                  Test Result
                </h4>
                <dl className="mt-2 text-xs space-y-1">
                  {testResult.statusCode && (
                    <div className="flex">
                      <dt className="w-24 font-medium text-gray-600">
                        Status Code:
                      </dt>
                      <dd>{testResult.statusCode}</dd>
                    </div>
                  )}
                  {testResult.error && (
                    <div className="flex">
                      <dt className="w-24 font-medium text-gray-600">Error:</dt>
                      <dd className="text-red-700">{testResult.error}</dd>
                    </div>
                  )}
                  {testResult.responseBody && (
                    <div>
                      <dt className="font-medium text-gray-600 mb-1">
                        Response:
                      </dt>
                      <dd className="bg-white border rounded p-2 font-mono text-xs overflow-x-auto">
                        {testResult.responseBody.slice(0, 200)}
                        {testResult.responseBody.length > 200 && '...'}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            )}

            {/* Payload Example */}
            <div className="pt-4 border-t border-gray-200">
              <h4 className="text-sm font-medium text-gray-900 mb-2">
                Example Payload
              </h4>
              <pre className="bg-gray-900 text-gray-100 rounded-md p-3 text-xs overflow-x-auto">
                {JSON.stringify(
                  {
                    event: 'call.qualified',
                    timestamp: '2025-01-16T12:00:00.000Z',
                    affiliateId: 'aff_xxx',
                    call: {
                      id: 'call_xxx',
                      callSid: 'CA123...',
                      campaignName: 'Windows - Q1',
                      serviceType: 'Windows',
                      callerZip: '90210',
                      status: 'COMPLETED',
                      isBillable: true,
                      duration: 180,
                      payout: 30.0
                    }
                  },
                  null,
                  2
                )}
              </pre>
            </div>
          </>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : null}
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>

          {enabled && postbackUrl && (
            <Button
              onClick={handleTest}
              disabled={testing}
              variant="outline"
            >
              {testing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <TestTube2 className="h-4 w-4 mr-2" />
              )}
              {testing ? 'Testing...' : 'Send Test'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
