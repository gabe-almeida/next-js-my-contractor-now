'use client';

/**
 * Buyer Call PING Settings Section Component
 *
 * WHY: Provides admin interface for configuring network buyer call PING settings.
 *      Networks like Modernize and HomeAdvisor need PING URLs and field mappings.
 *
 * WHEN: Rendered as a section within the Call Settings tab for NETWORK buyers.
 *
 * HOW: Displays PING URL input, field mapping editor (reuses lead mapping pattern),
 *      and allows testing the PING configuration with sample call data.
 */

import { useState, useCallback } from 'react';
import { AdminSection } from '@/components/admin/ui';
import { Button } from '@/components/ui/Button';
import {
  Globe,
  Code,
  Play,
  CheckCircle,
  AlertCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Copy,
  Plus,
  Trash2,
  Info,
} from 'lucide-react';

// =====================================
// TYPE DEFINITIONS
// =====================================

export interface CallFieldMapping {
  id: string;
  sourceField: string;
  targetField: string;
  transform?: string;
  valueMap?: Record<string, string>;
  required?: boolean;
  defaultValue?: string;
}

export interface CallPingSettings {
  callPingUrl: string | null;
  callFieldMappings: {
    version: string;
    mappings: CallFieldMapping[];
    pingStaticFields?: Record<string, unknown>;
  } | null;
  callPingTimeout: number;
}

interface BuyerCallPingSettingsSectionProps {
  settings: CallPingSettings;
  onUpdate: (settings: Partial<CallPingSettings>) => void;
  buyerId: string;
  serviceTypeId?: string;
  errors?: {
    callPingUrl?: string;
    callFieldMappings?: string;
  };
}

// =====================================
// CONSTANTS
// =====================================

/**
 * Available source fields from call data
 */
const CALL_SOURCE_FIELDS = [
  { value: 'callerPhone', label: 'Caller Phone', type: 'string' },
  { value: 'callerZip', label: 'Caller ZIP Code', type: 'string' },
  { value: 'callerCity', label: 'Caller City', type: 'string' },
  { value: 'callerState', label: 'Caller State', type: 'string' },
  { value: 'callerName', label: 'Caller Name', type: 'string' },
  { value: 'isQualified', label: 'Is Qualified', type: 'boolean' },
  { value: 'twilioCallSid', label: 'Twilio Call SID', type: 'string' },
  { value: 'serviceType.name', label: 'Service Type Name', type: 'string' },
  { value: 'serviceType.displayName', label: 'Service Type Display Name', type: 'string' },
  { value: 'campaign.name', label: 'Campaign Name', type: 'string' },
  { value: 'ivr.ownsHome', label: 'IVR: Owns Home', type: 'boolean' },
  { value: 'ivr.timeframe', label: 'IVR: Timeframe', type: 'string' },
  { value: 'createdAt', label: 'Call Created At', type: 'date' },
];

/**
 * Available transforms
 */
const TRANSFORM_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'phone.digitsOnly', label: 'Phone: Digits Only' },
  { value: 'phone.e164', label: 'Phone: E.164 Format' },
  { value: 'boolean.yesNo', label: 'Boolean: Yes/No' },
  { value: 'boolean.trueFalse', label: 'Boolean: true/false' },
  { value: 'boolean.numeric', label: 'Boolean: 1/0' },
  { value: 'string.uppercase', label: 'String: UPPERCASE' },
  { value: 'string.lowercase', label: 'String: lowercase' },
  { value: 'string.titleCase', label: 'String: Title Case' },
  { value: 'date.iso', label: 'Date: ISO Format' },
  { value: 'date.timestamp', label: 'Date: Unix Timestamp' },
];

/**
 * Default PING timeout in milliseconds
 */
const DEFAULT_PING_TIMEOUT_MS = 2000;

// =====================================
// COMPONENT
// =====================================

export function BuyerCallPingSettingsSection({
  settings,
  onUpdate,
  buyerId,
  serviceTypeId,
  errors,
}: BuyerCallPingSettingsSectionProps) {
  const [showMappingEditor, setShowMappingEditor] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    payload?: Record<string, unknown>;
    response?: Record<string, unknown>;
    responseTimeMs?: number;
  } | null>(null);
  const [testing, setTesting] = useState(false);

  // Initialize field mappings if null
  const mappings = settings.callFieldMappings?.mappings || [];
  const pingStaticFields = settings.callFieldMappings?.pingStaticFields || {};

  /**
   * Add a new field mapping
   */
  const addMapping = useCallback(() => {
    const newMapping: CallFieldMapping = {
      id: `mapping-${Date.now()}`,
      sourceField: '',
      targetField: '',
      required: false,
    };

    const newMappings = [...mappings, newMapping];
    onUpdate({
      callFieldMappings: {
        version: '1.0',
        mappings: newMappings,
        pingStaticFields,
      },
    });
  }, [mappings, pingStaticFields, onUpdate]);

  /**
   * Update a field mapping
   */
  const updateMapping = useCallback(
    (id: string, field: keyof CallFieldMapping, value: unknown) => {
      const newMappings = mappings.map((m) =>
        m.id === id ? { ...m, [field]: value } : m
      );
      onUpdate({
        callFieldMappings: {
          version: '1.0',
          mappings: newMappings,
          pingStaticFields,
        },
      });
    },
    [mappings, pingStaticFields, onUpdate]
  );

  /**
   * Remove a field mapping
   */
  const removeMapping = useCallback(
    (id: string) => {
      const newMappings = mappings.filter((m) => m.id !== id);
      onUpdate({
        callFieldMappings: {
          version: '1.0',
          mappings: newMappings,
          pingStaticFields,
        },
      });
    },
    [mappings, pingStaticFields, onUpdate]
  );

  /**
   * Test PING with sample data
   */
  const testPing = useCallback(async () => {
    if (!settings.callPingUrl) {
      setTestResult({
        success: false,
        message: 'PING URL is required',
      });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const response = await fetch(`/api/admin/buyers/${buyerId}/test-call-ping`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serviceTypeId,
          callPingUrl: settings.callPingUrl,
          callFieldMappings: settings.callFieldMappings,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setTestResult({
          success: true,
          message: `PING successful (${result.responseTimeMs}ms)`,
          payload: result.payload,
          response: result.response,
          responseTimeMs: result.responseTimeMs,
        });
      } else {
        setTestResult({
          success: false,
          message: result.error || 'PING failed',
          payload: result.payload,
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Test failed',
      });
    } finally {
      setTesting(false);
    }
  }, [buyerId, serviceTypeId, settings.callPingUrl, settings.callFieldMappings]);

  /**
   * Copy JSON payload to clipboard
   */
  const copyPayload = useCallback(() => {
    if (testResult?.payload) {
      navigator.clipboard.writeText(JSON.stringify(testResult.payload, null, 2));
    }
  }, [testResult?.payload]);

  return (
    <AdminSection
      title="Network PING Configuration"
      description="Configure real-time bidding (RTB) settings for network buyers"
    >
      <div className="space-y-6">
        {/* PING URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <Globe className="h-4 w-4 inline mr-1" />
            Call PING URL *
          </label>
          <input
            type="url"
            value={settings.callPingUrl || ''}
            onChange={(e) => onUpdate({ callPingUrl: e.target.value || null })}
            placeholder="https://api.network.com/calls/ping"
            className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 ${
              errors?.callPingUrl ? 'border-red-300' : 'border-gray-200'
            }`}
          />
          {errors?.callPingUrl && (
            <p className="text-xs text-red-600 mt-1">{errors.callPingUrl}</p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            The endpoint where call PING requests will be sent for real-time bidding
          </p>
        </div>

        {/* PING Timeout */}
        <div className="max-w-xs">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <Clock className="h-4 w-4 inline mr-1" />
            PING Timeout (ms)
          </label>
          <input
            type="number"
            min={500}
            max={5000}
            step={100}
            value={settings.callPingTimeout || DEFAULT_PING_TIMEOUT_MS}
            onChange={(e) => onUpdate({ callPingTimeout: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            Maximum time to wait for PING response (500-5000ms). Default: 2000ms
          </p>
        </div>

        {/* Field Mappings Toggle */}
        <div className="border border-gray-200 rounded-lg">
          <button
            type="button"
            onClick={() => setShowMappingEditor(!showMappingEditor)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
          >
            <div className="flex items-center gap-2">
              <Code className="h-4 w-4 text-gray-500" />
              <span className="font-medium text-gray-900">Field Mappings</span>
              <span className="text-sm text-gray-500">({mappings.length} configured)</span>
            </div>
            {showMappingEditor ? (
              <ChevronUp className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            )}
          </button>

          {showMappingEditor && (
            <div className="px-4 pb-4 border-t border-gray-200">
              {/* Info Box */}
              <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg flex gap-2">
                <Info className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium">How field mappings work:</p>
                  <ul className="mt-1 list-disc list-inside space-y-1">
                    <li>Source Field: Data from the call (e.g., callerZip)</li>
                    <li>Target Field: Name the network expects (e.g., postalCode)</li>
                    <li>Transform: Optional formatting (e.g., phone digits only)</li>
                  </ul>
                </div>
              </div>

              {/* Mapping List */}
              <div className="mt-4 space-y-3">
                {mappings.length === 0 ? (
                  <p className="text-sm text-gray-500 py-4 text-center">
                    No field mappings configured. Using default mappings.
                  </p>
                ) : (
                  mappings.map((mapping) => (
                    <div
                      key={mapping.id}
                      className="grid grid-cols-12 gap-2 items-start p-3 bg-gray-50 rounded-lg"
                    >
                      {/* Source Field */}
                      <div className="col-span-3">
                        <label className="block text-xs font-medium text-gray-500 mb-1">
                          Source
                        </label>
                        <select
                          value={mapping.sourceField}
                          onChange={(e) => updateMapping(mapping.id, 'sourceField', e.target.value)}
                          className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                        >
                          <option value="">Select...</option>
                          {CALL_SOURCE_FIELDS.map((field) => (
                            <option key={field.value} value={field.value}>
                              {field.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Target Field */}
                      <div className="col-span-3">
                        <label className="block text-xs font-medium text-gray-500 mb-1">
                          Target
                        </label>
                        <input
                          type="text"
                          value={mapping.targetField}
                          onChange={(e) => updateMapping(mapping.id, 'targetField', e.target.value)}
                          placeholder="postalCode"
                          className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                        />
                      </div>

                      {/* Transform */}
                      <div className="col-span-3">
                        <label className="block text-xs font-medium text-gray-500 mb-1">
                          Transform
                        </label>
                        <select
                          value={mapping.transform || ''}
                          onChange={(e) => updateMapping(mapping.id, 'transform', e.target.value || undefined)}
                          className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                        >
                          {TRANSFORM_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Required + Delete */}
                      <div className="col-span-3 flex items-end gap-2">
                        <label className="flex items-center gap-1 text-sm py-1.5">
                          <input
                            type="checkbox"
                            checked={mapping.required || false}
                            onChange={(e) => updateMapping(mapping.id, 'required', e.target.checked)}
                            className="h-3.5 w-3.5 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                          />
                          <span className="text-gray-600">Required</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => removeMapping(mapping.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Add Mapping Button */}
              <button
                type="button"
                onClick={addMapping}
                className="mt-3 flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700"
              >
                <Plus className="h-4 w-4" />
                Add Field Mapping
              </button>
            </div>
          )}
        </div>

        {/* Test PING Section */}
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium text-gray-900 flex items-center gap-2">
              <Play className="h-4 w-4" />
              Test PING
            </h4>
            <Button
              onClick={testPing}
              disabled={!settings.callPingUrl || testing}
              loading={testing}
              loadingText="Testing..."
              size="sm"
              className="bg-orange-500 hover:bg-orange-600"
            >
              Send Test PING
            </Button>
          </div>

          {testResult && (
            <div
              className={`p-3 rounded-lg ${
                testResult.success
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-red-50 border border-red-200'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                {testResult.success ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-600" />
                )}
                <span
                  className={`font-medium ${
                    testResult.success ? 'text-green-800' : 'text-red-800'
                  }`}
                >
                  {testResult.message}
                </span>
              </div>

              {testResult.payload && (
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-500">Request Payload:</span>
                    <button
                      onClick={copyPayload}
                      className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
                    >
                      <Copy className="h-3 w-3" />
                      Copy
                    </button>
                  </div>
                  <pre className="text-xs bg-white p-2 rounded border border-gray-200 overflow-x-auto max-h-32">
                    {JSON.stringify(testResult.payload, null, 2)}
                  </pre>
                </div>
              )}

              {testResult.response && (
                <div className="mt-3">
                  <span className="text-xs font-medium text-gray-500">Response:</span>
                  <pre className="text-xs bg-white p-2 rounded border border-gray-200 overflow-x-auto max-h-32 mt-1">
                    {JSON.stringify(testResult.response, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AdminSection>
  );
}

export default BuyerCallPingSettingsSection;
