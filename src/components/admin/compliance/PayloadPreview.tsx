'use client';

import { useState } from 'react';
import { Eye, EyeOff, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ComplianceFieldMappings } from '@/lib/templates/types';

export interface PayloadPreviewProps {
  mappings: ComplianceFieldMappings;
  buyerName?: string;
}

/**
 * Shows a live preview of the payload that will be sent to the buyer
 * with the configured compliance field mappings
 */
export function PayloadPreview({ mappings, buyerName = 'the buyer' }: PayloadPreviewProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  // Generate sample payload
  const generateSamplePayload = (): Record<string, any> => {
    const payload: Record<string, any> = {
      // Standard lead fields (examples)
      zip_code: '90210',
      homeowner: 'yes',
      service_type: 'windows',
      // ... buyer-specific mapped fields would be here
    };

    // Add TrustedForm fields
    if (mappings.trustedForm?.certUrl) {
      mappings.trustedForm.certUrl.forEach(fieldName => {
        payload[fieldName] = 'https://cert.trustedform.com/abc-123-def-456';
      });
    }

    if (mappings.trustedForm?.certId) {
      mappings.trustedForm.certId.forEach(fieldName => {
        payload[fieldName] = 'abc-123-def-456';
      });
    }

    // Add Jornaya fields
    if (mappings.jornaya?.leadId) {
      mappings.jornaya.leadId.forEach(fieldName => {
        payload[fieldName] = 'jornaya-leadid-789';
      });
    }

    // Add ActiveProspect fields
    if (mappings.activeProspect?.leadId) {
      mappings.activeProspect.leadId.forEach(fieldName => {
        payload[fieldName] = 'activeprospect-leadid-12345';
      });
    }

    if (mappings.activeProspect?.campaignId) {
      mappings.activeProspect.campaignId.forEach(fieldName => {
        payload[fieldName] = 'campaign-abc-xyz';
      });
    }

    // Add TCPA fields
    if (mappings.tcpa?.consent) {
      mappings.tcpa.consent.forEach(fieldName => {
        payload[fieldName] = true;
      });
    }

    if (mappings.tcpa?.timestamp) {
      mappings.tcpa.timestamp.forEach(fieldName => {
        payload[fieldName] = '2025-10-20T15:30:00Z';
      });
    }

    // Add technical fields
    if (mappings.technical?.ipAddress) {
      mappings.technical.ipAddress.forEach(fieldName => {
        payload[fieldName] = '192.168.1.100';
      });
    }

    if (mappings.technical?.userAgent) {
      mappings.technical.userAgent.forEach(fieldName => {
        payload[fieldName] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...';
      });
    }

    if (mappings.technical?.timestamp) {
      mappings.technical.timestamp.forEach(fieldName => {
        payload[fieldName] = '2025-10-20T15:30:00Z';
      });
    }

    // Add geo fields
    if (mappings.geo?.latitude) {
      mappings.geo.latitude.forEach(fieldName => {
        payload[fieldName] = 34.0522;
      });
    }

    if (mappings.geo?.longitude) {
      mappings.geo.longitude.forEach(fieldName => {
        payload[fieldName] = -118.2437;
      });
    }

    if (mappings.geo?.city) {
      mappings.geo.city.forEach(fieldName => {
        payload[fieldName] = 'Beverly Hills';
      });
    }

    if (mappings.geo?.state) {
      mappings.geo.state.forEach(fieldName => {
        payload[fieldName] = 'CA';
      });
    }

    return payload;
  };

  const samplePayload = generateSamplePayload();
  const payloadJson = JSON.stringify(samplePayload, null, 2);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(payloadJson);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Count total compliance fields
  const countComplianceFields = () => {
    let count = 0;
    if (mappings.trustedForm?.certUrl) count += mappings.trustedForm.certUrl.length;
    if (mappings.trustedForm?.certId) count += mappings.trustedForm.certId.length;
    if (mappings.jornaya?.leadId) count += mappings.jornaya.leadId.length;
    if (mappings.activeProspect?.leadId) count += mappings.activeProspect.leadId.length;
    if (mappings.activeProspect?.campaignId) count += mappings.activeProspect.campaignId.length;
    if (mappings.tcpa?.consent) count += mappings.tcpa.consent.length;
    if (mappings.tcpa?.timestamp) count += mappings.tcpa.timestamp.length;
    if (mappings.technical?.ipAddress) count += mappings.technical.ipAddress.length;
    if (mappings.technical?.userAgent) count += mappings.technical.userAgent.length;
    if (mappings.technical?.timestamp) count += mappings.technical.timestamp.length;
    if (mappings.geo?.latitude) count += mappings.geo.latitude.length;
    if (mappings.geo?.longitude) count += mappings.geo.longitude.length;
    if (mappings.geo?.city) count += mappings.geo.city.length;
    if (mappings.geo?.state) count += mappings.geo.state.length;
    return count;
  };

  const complianceFieldCount = countComplianceFields();

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-white border-b border-blue-200">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-gray-900 flex items-center space-x-2">
              <Eye className="h-4 w-4 text-blue-600" />
              <span>Payload Preview</span>
            </h4>
            <p className="text-xs text-gray-500 mt-0.5">
              Example payload that will be sent to {buyerName}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {complianceFieldCount} compliance fields
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <>
                  <EyeOff className="h-4 w-4 mr-1" />
                  Hide
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-1" />
                  Show
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Payload Content */}
      {isExpanded && (
        <div className="p-4">
          <div className="relative">
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs font-mono max-h-96 overflow-y-auto">
              <code>{payloadJson}</code>
            </pre>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={copyToClipboard}
              className="absolute top-2 right-2 bg-gray-800 hover:bg-gray-700 text-white"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 mr-1" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3 mr-1" />
                  Copy
                </>
              )}
            </Button>
          </div>

          {/* Field Count Summary */}
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
            {mappings.trustedForm && (
              <div className="bg-white rounded-md p-2 border border-blue-100">
                <div className="text-xs font-medium text-gray-500">TrustedForm</div>
                <div className="text-sm font-semibold text-gray-900">
                  {(mappings.trustedForm.certUrl?.length || 0) + (mappings.trustedForm.certId?.length || 0)} fields
                </div>
              </div>
            )}
            {mappings.jornaya && (
              <div className="bg-white rounded-md p-2 border border-blue-100">
                <div className="text-xs font-medium text-gray-500">Jornaya</div>
                <div className="text-sm font-semibold text-gray-900">
                  {mappings.jornaya.leadId?.length || 0} fields
                </div>
              </div>
            )}
            {mappings.activeProspect && (
              <div className="bg-white rounded-md p-2 border border-blue-100">
                <div className="text-xs font-medium text-gray-500">ActiveProspect</div>
                <div className="text-sm font-semibold text-gray-900">
                  {(mappings.activeProspect.leadId?.length || 0) + (mappings.activeProspect.campaignId?.length || 0)} fields
                </div>
              </div>
            )}
            {mappings.tcpa && (
              <div className="bg-white rounded-md p-2 border border-blue-100">
                <div className="text-xs font-medium text-gray-500">TCPA</div>
                <div className="text-sm font-semibold text-gray-900">
                  {(mappings.tcpa.consent?.length || 0) + (mappings.tcpa.timestamp?.length || 0)} fields
                </div>
              </div>
            )}
            {mappings.geo && (
              <div className="bg-white rounded-md p-2 border border-blue-100">
                <div className="text-xs font-medium text-gray-500">Location</div>
                <div className="text-sm font-semibold text-gray-900">
                  {(mappings.geo.latitude?.length || 0) +
                   (mappings.geo.longitude?.length || 0) +
                   (mappings.geo.city?.length || 0) +
                   (mappings.geo.state?.length || 0)} fields
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
