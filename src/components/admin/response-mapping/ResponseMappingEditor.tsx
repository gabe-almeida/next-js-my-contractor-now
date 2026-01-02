'use client';

import { useState } from 'react';
import { Settings2, ChevronDown, ChevronRight, RotateCcw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StatusMappingGroup } from './StatusMappingGroup';
import { ResponseMappingPreview } from './ResponseMappingPreview';
import {
  ResponseMappingConfig,
  PingStatusMappings,
  PostStatusMappings,
} from '@/types/response-mapping';
import {
  DEFAULT_RESPONSE_MAPPING_CONFIG,
  DEFAULT_PING_MAPPINGS,
  DEFAULT_POST_MAPPINGS,
  DEFAULT_BID_AMOUNT_FIELDS,
} from '@/lib/buyers/default-response-mappings';

export interface ResponseMappingEditorProps {
  value: ResponseMappingConfig | null;
  onChange: (config: ResponseMappingConfig | null) => void;
  buyerName?: string;
  disabled?: boolean;
}

/**
 * WHY: Admins need to configure how the system interprets buyer responses,
 * as different networks use different terminology for the same concepts.
 *
 * WHEN: Used in BuyerForm when setting up or editing a buyer's configuration.
 *
 * HOW: Provides collapsible sections for PING mappings, POST mappings,
 * bid amount fields, and HTTP status code handling.
 */
export function ResponseMappingEditor({
  value,
  onChange,
  buyerName,
  disabled = false
}: ResponseMappingEditorProps) {
  // Use defaults if no config provided
  const config = value || DEFAULT_RESPONSE_MAPPING_CONFIG;

  // Expand/collapse sections
  const [expandedSections, setExpandedSections] = useState({
    pingMappings: true,
    postMappings: true,
    bidFields: false,
    statusField: false,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const resetToDefaults = () => {
    if (confirm('Reset all response mappings to defaults? This cannot be undone.')) {
      onChange(null); // null means "use defaults"
    }
  };

  const updateConfig = (updates: Partial<ResponseMappingConfig>) => {
    onChange({ ...config, ...updates });
  };

  const updatePingMappings = (category: keyof PingStatusMappings, values: string[]) => {
    updateConfig({
      pingMappings: {
        ...config.pingMappings,
        [category]: values
      }
    });
  };

  const updatePostMappings = (category: keyof PostStatusMappings, values: string[]) => {
    updateConfig({
      postMappings: {
        ...config.postMappings,
        [category]: values
      }
    });
  };

  const updateBidFields = (fields: string[]) => {
    updateConfig({ bidAmountFields: fields });
  };

  const updateStatusField = (field: string) => {
    updateConfig({ statusField: field });
  };

  // Section component for consistent UI
  const Section = ({
    title,
    icon,
    description,
    sectionKey,
    children
  }: {
    title: string;
    icon: React.ReactNode;
    description: string;
    sectionKey: keyof typeof expandedSections;
    children: React.ReactNode;
  }) => {
    const isExpanded = expandedSections[sectionKey];

    return (
      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
        <button
          type="button"
          onClick={() => toggleSection(sectionKey)}
          className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center space-x-3">
            <div className="text-green-600">{icon}</div>
            <div className="text-left">
              <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
              <p className="text-xs text-gray-500">{description}</p>
            </div>
          </div>
          {isExpanded ? (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronRight className="h-5 w-5 text-gray-400" />
          )}
        </button>

        {isExpanded && (
          <div className="p-4 space-y-4 bg-white">
            {children}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <Settings2 className="h-5 w-5 text-green-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Response Mapping Configuration
            </h2>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Configure how the system interprets responses from {buyerName || 'this buyer'}.
            Map buyer-specific status codes to internal statuses.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={resetToDefaults}
          disabled={disabled}
          className="flex items-center space-x-1"
        >
          <RotateCcw className="h-4 w-4" />
          <span>Reset to Defaults</span>
        </Button>
      </div>

      {/* Using Defaults Notice */}
      {!value && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <Settings2 className="h-5 w-5 text-green-600 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-green-900">
                Using Default Mappings
              </h4>
              <p className="text-xs text-green-700 mt-1">
                This buyer is using the system default response mappings. These defaults
                cover 80%+ of common buyer terminology. Customize only if needed.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Preview */}
      <ResponseMappingPreview config={config} buyerName={buyerName} />

      {/* Status Field Configuration */}
      <Section
        title="Status Field"
        icon={<Settings2 className="h-5 w-5" />}
        description="Which field in the response contains the status"
        sectionKey="statusField"
      >
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status Field Path
            </label>
            <input
              type="text"
              value={config.statusField}
              onChange={(e) => updateStatusField(e.target.value)}
              placeholder="status"
              disabled={disabled}
              className="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Use dot notation for nested fields (e.g., &quot;result.status&quot;)
            </p>
          </div>
        </div>
      </Section>

      {/* PING Status Mappings */}
      <Section
        title="PING Response Mappings"
        icon={<Settings2 className="h-5 w-5" />}
        description="Map buyer status values to internal PING statuses"
        sectionKey="pingMappings"
      >
        <StatusMappingGroup
          label="Accepted / Interested"
          description="Status values that mean the buyer wants to bid on this lead"
          statusType="accepted"
          statusColor="green"
          values={config.pingMappings.accepted}
          onChange={(values) => updatePingMappings('accepted', values)}
          examples={DEFAULT_PING_MAPPINGS.accepted.slice(0, 8)}
          disabled={disabled}
        />

        <StatusMappingGroup
          label="Rejected / Not Interested"
          description="Status values that mean the buyer is passing on this lead"
          statusType="rejected"
          statusColor="yellow"
          values={config.pingMappings.rejected}
          onChange={(values) => updatePingMappings('rejected', values)}
          examples={DEFAULT_PING_MAPPINGS.rejected.slice(0, 8)}
          disabled={disabled}
        />

        <StatusMappingGroup
          label="Error / Failed"
          description="Status values indicating a technical error occurred"
          statusType="error"
          statusColor="red"
          values={config.pingMappings.error}
          onChange={(values) => updatePingMappings('error', values)}
          examples={DEFAULT_PING_MAPPINGS.error.slice(0, 8)}
          disabled={disabled}
        />
      </Section>

      {/* POST Status Mappings */}
      <Section
        title="POST Response Mappings"
        icon={<Settings2 className="h-5 w-5" />}
        description="Map buyer status values to internal POST statuses"
        sectionKey="postMappings"
      >
        <StatusMappingGroup
          label="Delivered / Success"
          description="Status values confirming successful lead delivery"
          statusType="delivered"
          statusColor="green"
          values={config.postMappings.delivered}
          onChange={(values) => updatePostMappings('delivered', values)}
          examples={DEFAULT_POST_MAPPINGS.delivered.slice(0, 8)}
          disabled={disabled}
        />

        <StatusMappingGroup
          label="Failed / Rejected"
          description="Status values indicating the lead was rejected or failed"
          statusType="failed"
          statusColor="red"
          values={config.postMappings.failed}
          onChange={(values) => updatePostMappings('failed', values)}
          examples={DEFAULT_POST_MAPPINGS.failed.slice(0, 8)}
          disabled={disabled}
        />

        <StatusMappingGroup
          label="Duplicate"
          description="Status values indicating the lead was already received"
          statusType="duplicate"
          statusColor="yellow"
          values={config.postMappings.duplicate}
          onChange={(values) => updatePostMappings('duplicate', values)}
          examples={DEFAULT_POST_MAPPINGS.duplicate.slice(0, 8)}
          disabled={disabled}
        />

        <StatusMappingGroup
          label="Invalid"
          description="Status values indicating the lead data was invalid"
          statusType="invalid"
          statusColor="orange"
          values={config.postMappings.invalid}
          onChange={(values) => updatePostMappings('invalid', values)}
          examples={DEFAULT_POST_MAPPINGS.invalid.slice(0, 8)}
          disabled={disabled}
        />
      </Section>

      {/* Bid Amount Fields */}
      <Section
        title="Bid Amount Fields"
        icon={<Settings2 className="h-5 w-5" />}
        description="Field names to check for bid amount in PING responses"
        sectionKey="bidFields"
      >
        <StatusMappingGroup
          label="Bid Amount Field Names"
          description="List of field names to search for bid amount (checked in order)"
          statusType="bid"
          statusColor="blue"
          values={config.bidAmountFields}
          onChange={updateBidFields}
          examples={DEFAULT_BID_AMOUNT_FIELDS.slice(0, 10)}
          disabled={disabled}
        />
      </Section>

      {/* Warning about custom config */}
      {value && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-amber-900">
                Custom Configuration Active
              </h4>
              <p className="text-xs text-amber-700 mt-1">
                This buyer has custom response mappings. If you experience issues,
                try resetting to defaults which cover most common buyer terminology.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Help Text */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-gray-900 mb-2">
          How does response mapping work?
        </h4>
        <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
          <li>The system checks buyer responses against configured status mappings</li>
          <li>Case-insensitive matching is used (e.g., &quot;ACCEPTED&quot; = &quot;accepted&quot;)</li>
          <li>If a status doesn&apos;t match any mapping, it defaults to rejected/failed</li>
          <li>Bid amounts are extracted by checking fields in the configured order</li>
          <li>Changes take effect immediately for new requests</li>
          <li>Cache is automatically invalidated when configuration is saved</li>
        </ul>
      </div>
    </div>
  );
}
