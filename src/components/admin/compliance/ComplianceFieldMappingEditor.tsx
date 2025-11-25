'use client';

import { useState } from 'react';
import { Shield, ChevronDown, ChevronRight, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ComplianceFieldGroup } from './ComplianceFieldGroup';
import { PayloadPreview } from './PayloadPreview';
import { ComplianceFieldMappings } from '@/lib/templates/types';

export interface ComplianceFieldMappingEditorProps {
  value: ComplianceFieldMappings;
  onChange: (mappings: ComplianceFieldMappings) => void;
  buyerName?: string;
  disabled?: boolean;
}

/**
 * Main editor for configuring compliance field mappings
 * Provides an organized, sectioned UI for all compliance data types
 */
export function ComplianceFieldMappingEditor({
  value,
  onChange,
  buyerName,
  disabled = false
}: ComplianceFieldMappingEditorProps) {
  // Expand/collapse sections
  const [expandedSections, setExpandedSections] = useState({
    trustedForm: true,
    jornaya: true,
    activeProspect: false,
    tcpa: false,
    technical: false,
    geo: false
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const resetToDefaults = () => {
    if (confirm('Reset all compliance field mappings to defaults? This cannot be undone.')) {
      onChange(getDefaultMappings());
    }
  };

  // Get default mappings
  const getDefaultMappings = (): ComplianceFieldMappings => ({
    trustedForm: {
      certUrl: ['xxTrustedFormCertUrl', 'trusted_form_cert_url'],
      certId: ['xxTrustedFormToken', 'trusted_form_token']
    },
    jornaya: {
      leadId: ['universal_leadid', 'jornaya_leadid', 'leadid']
    },
    activeProspect: {
      leadId: ['activeprospect_leadid', 'ap_leadid'],
      campaignId: ['campaign_id', 'ap_campaign']
    },
    tcpa: {
      consent: ['tcpa_consent', 'opt_in_consent', 'marketing_consent'],
      timestamp: ['consent_timestamp']
    },
    technical: {
      ipAddress: ['ip_address', 'client_ip'],
      userAgent: ['user_agent', 'browser_info'],
      timestamp: ['submission_timestamp']
    },
    geo: {
      latitude: ['latitude'],
      longitude: ['longitude'],
      city: ['city'],
      state: ['state']
    }
  });

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
            <div className="text-blue-600">{icon}</div>
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
            <Shield className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Compliance Field Mappings
            </h2>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Configure custom field names for compliance data sent to {buyerName || 'this buyer'}.
            Leave empty to use defaults.
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

      {/* Payload Preview */}
      <PayloadPreview mappings={value} buyerName={buyerName} />

      {/* TrustedForm Section */}
      <Section
        title="TrustedForm"
        icon={<Shield className="h-5 w-5" />}
        description="Lead certificate validation and compliance tracking"
        sectionKey="trustedForm"
      >
        <ComplianceFieldGroup
          label="Certificate URL"
          description="Field names for the TrustedForm certificate URL"
          fieldNames={value.trustedForm?.certUrl || []}
          onChange={(certUrl) =>
            onChange({
              ...value,
              trustedForm: { ...value.trustedForm, certUrl }
            })
          }
          placeholder="trustedform_cert_url"
          examples={[
            'xxTrustedFormCertUrl',
            'trusted_form_cert_url',
            'tf_certificate',
            'certificate_url'
          ]}
          disabled={disabled}
        />

        <ComplianceFieldGroup
          label="Certificate ID / Token"
          description="Field names for the TrustedForm certificate ID or token"
          fieldNames={value.trustedForm?.certId || []}
          onChange={(certId) =>
            onChange({
              ...value,
              trustedForm: { ...value.trustedForm, certId }
            })
          }
          placeholder="trustedform_token"
          examples={[
            'xxTrustedFormToken',
            'trusted_form_token',
            'tf_cert_id',
            'certificate_token'
          ]}
          disabled={disabled}
        />
      </Section>

      {/* Jornaya Section */}
      <Section
        title="Jornaya LeadID"
        icon={<Shield className="h-5 w-5" />}
        description="Universal lead identifier for fraud prevention"
        sectionKey="jornaya"
      >
        <ComplianceFieldGroup
          label="LeadID"
          description="Field names for the Jornaya LeadID token"
          fieldNames={value.jornaya?.leadId || []}
          onChange={(leadId) =>
            onChange({
              ...value,
              jornaya: { ...value.jornaya, leadId }
            })
          }
          placeholder="universal_leadid"
          examples={[
            'universal_leadid',
            'jornaya_leadid',
            'leadid',
            'jornaya_token',
            'lead_identifier'
          ]}
          disabled={disabled}
        />
      </Section>

      {/* ActiveProspect LeadiD Section */}
      <Section
        title="ActiveProspect LeadiD"
        icon={<Shield className="h-5 w-5" />}
        description="Lead tracking and campaign attribution"
        sectionKey="activeProspect"
      >
        <ComplianceFieldGroup
          label="Lead ID"
          description="Field names for the ActiveProspect LeadiD tracking"
          fieldNames={value.activeProspect?.leadId || []}
          onChange={(leadId) =>
            onChange({
              ...value,
              activeProspect: { ...value.activeProspect, leadId }
            })
          }
          placeholder="activeprospect_leadid"
          examples={[
            'activeprospect_leadid',
            'ap_leadid',
            'leadid_token'
          ]}
          disabled={disabled}
        />

        <ComplianceFieldGroup
          label="Campaign ID"
          description="Field names for the campaign identifier"
          fieldNames={value.activeProspect?.campaignId || []}
          onChange={(campaignId) =>
            onChange({
              ...value,
              activeProspect: { ...value.activeProspect, campaignId }
            })
          }
          placeholder="campaign_id"
          examples={[
            'campaign_id',
            'ap_campaign',
            'campaign_token'
          ]}
          disabled={disabled}
        />
      </Section>

      {/* TCPA Section */}
      <Section
        title="TCPA Consent"
        icon={<Shield className="h-5 w-5" />}
        description="Telephone Consumer Protection Act compliance"
        sectionKey="tcpa"
      >
        <ComplianceFieldGroup
          label="Consent Flag"
          description="Field names for the TCPA consent boolean"
          fieldNames={value.tcpa?.consent || []}
          onChange={(consent) =>
            onChange({
              ...value,
              tcpa: { ...value.tcpa, consent }
            })
          }
          placeholder="tcpa_consent"
          examples={[
            'tcpa_consent',
            'opt_in_consent',
            'marketing_consent',
            'consent_status',
            'opted_in'
          ]}
          disabled={disabled}
        />

        <ComplianceFieldGroup
          label="Consent Timestamp"
          description="Field names for when consent was given"
          fieldNames={value.tcpa?.timestamp || []}
          onChange={(timestamp) =>
            onChange({
              ...value,
              tcpa: { ...value.tcpa, timestamp }
            })
          }
          placeholder="consent_timestamp"
          examples={[
            'consent_timestamp',
            'opt_in_time',
            'consent_date'
          ]}
          disabled={disabled}
        />
      </Section>

      {/* Technical Data Section */}
      <Section
        title="Technical Data"
        icon={<Shield className="h-5 w-5" />}
        description="IP address, user agent, and timestamps"
        sectionKey="technical"
      >
        <ComplianceFieldGroup
          label="IP Address"
          description="Field names for the user's IP address"
          fieldNames={value.technical?.ipAddress || []}
          onChange={(ipAddress) =>
            onChange({
              ...value,
              technical: { ...value.technical, ipAddress }
            })
          }
          placeholder="ip_address"
          examples={[
            'ip_address',
            'client_ip',
            'source_ip',
            'ip'
          ]}
          disabled={disabled}
        />

        <ComplianceFieldGroup
          label="User Agent"
          description="Field names for the browser/device information"
          fieldNames={value.technical?.userAgent || []}
          onChange={(userAgent) =>
            onChange({
              ...value,
              technical: { ...value.technical, userAgent }
            })
          }
          placeholder="user_agent"
          examples={[
            'user_agent',
            'browser_info',
            'browser_string',
            'user_agent_string',
            'agent'
          ]}
          disabled={disabled}
        />

        <ComplianceFieldGroup
          label="Submission Timestamp"
          description="Field names for when the lead was submitted"
          fieldNames={value.technical?.timestamp || []}
          onChange={(timestamp) =>
            onChange({
              ...value,
              technical: { ...value.technical, timestamp }
            })
          }
          placeholder="submission_timestamp"
          examples={[
            'submission_timestamp',
            'received_at',
            'submit_timestamp',
            'timestamp'
          ]}
          disabled={disabled}
        />
      </Section>

      {/* Geo Location Section */}
      <Section
        title="Geo Location"
        icon={<Shield className="h-5 w-5" />}
        description="Geographic coordinates and location data"
        sectionKey="geo"
      >
        <ComplianceFieldGroup
          label="Latitude"
          description="Field names for geographic latitude"
          fieldNames={value.geo?.latitude || []}
          onChange={(latitude) =>
            onChange({
              ...value,
              geo: { ...value.geo, latitude }
            })
          }
          placeholder="latitude"
          examples={[
            'latitude',
            'lat',
            'geo_lat',
            'location_lat'
          ]}
          disabled={disabled}
        />

        <ComplianceFieldGroup
          label="Longitude"
          description="Field names for geographic longitude"
          fieldNames={value.geo?.longitude || []}
          onChange={(longitude) =>
            onChange({
              ...value,
              geo: { ...value.geo, longitude }
            })
          }
          placeholder="longitude"
          examples={[
            'longitude',
            'lng',
            'lon',
            'geo_lon',
            'location_lon'
          ]}
          disabled={disabled}
        />

        <ComplianceFieldGroup
          label="City"
          description="Field names for city name"
          fieldNames={value.geo?.city || []}
          onChange={(city) =>
            onChange({
              ...value,
              geo: { ...value.geo, city }
            })
          }
          placeholder="city"
          examples={[
            'city',
            'city_name',
            'customer_city',
            'location_city'
          ]}
          disabled={disabled}
        />

        <ComplianceFieldGroup
          label="State"
          description="Field names for state/province"
          fieldNames={value.geo?.state || []}
          onChange={(state) =>
            onChange({
              ...value,
              geo: { ...value.geo, state }
            })
          }
          placeholder="state"
          examples={[
            'state',
            'state_code',
            'customer_state',
            'location_state'
          ]}
          disabled={disabled}
        />
      </Section>

      {/* Help Text */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-blue-900 mb-2">
          How does this work?
        </h4>
        <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
          <li>Each compliance data point can be sent to multiple field names</li>
          <li>This ensures compatibility if the buyer uses different field naming conventions</li>
          <li>If no field names are configured, system defaults will be used</li>
          <li>Field names can only contain letters, numbers, underscores, and hyphens</li>
          <li>Changes apply immediately to all new leads sent to this buyer</li>
        </ul>
      </div>
    </div>
  );
}
