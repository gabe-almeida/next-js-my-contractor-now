'use client';

import { useState, useEffect } from 'react';
import { Eye, Copy, Check, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type {
  FieldMappingConfig,
  PayloadPreviewResult,
  TransformError,
} from '@/types/field-mapping';
import {
  generatePayloadPreview,
  getSampleLeadData,
} from '@/lib/field-mapping/configuration-service';

/**
 * PayloadPreview Component
 *
 * WHY: Show admin exactly what JSON will be sent to buyer
 * WHEN: In the field mapping editor to validate configuration
 * HOW: Generate PING and POST payloads using sample data
 */
export interface PayloadPreviewProps {
  config: FieldMappingConfig;
  buyerName?: string;
  serviceTypeName?: string;
}

export function PayloadPreview({
  config,
  buyerName,
  serviceTypeName,
}: PayloadPreviewProps) {
  const [activeTab, setActiveTab] = useState<'ping' | 'post'>('ping');
  const [preview, setPreview] = useState<PayloadPreviewResult | null>(null);
  const [copied, setCopied] = useState(false);

  // Generate preview whenever config changes
  useEffect(() => {
    const sampleData = getSampleLeadData();
    const result = generatePayloadPreview(config, sampleData);
    setPreview(result);
  }, [config]);

  const handleCopy = async () => {
    if (!preview) return;
    const payload = activeTab === 'ping' ? preview.pingPayload : preview.postPayload;
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRefresh = () => {
    const sampleData = getSampleLeadData();
    const result = generatePayloadPreview(config, sampleData);
    setPreview(result);
  };

  if (!preview) {
    return (
      <div className="border border-gray-200 rounded-lg p-6 text-center text-gray-500">
        Loading preview...
      </div>
    );
  }

  const currentPayload = activeTab === 'ping' ? preview.pingPayload : preview.postPayload;
  const hasErrors = preview.errors.length > 0;

  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-orange-600" />
            <h3 className="font-semibold text-gray-900">
              Payload Preview
            </h3>
            {buyerName && (
              <span className="text-sm text-gray-500">
                for {buyerName}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              className="text-gray-600"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="text-gray-600"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mt-3">
          <button
            type="button"
            onClick={() => setActiveTab('ping')}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'ping'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            PING ({preview.stats.pingFieldCount} fields)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('post')}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'post'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            POST ({preview.stats.postFieldCount} fields)
          </button>
        </div>
      </div>

      {/* Errors */}
      {hasErrors && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-3">
          <h4 className="text-sm font-medium text-red-800 mb-1">
            Transform Errors
          </h4>
          <ul className="text-xs text-red-700 space-y-1">
            {preview.errors.map((error: TransformError, i: number) => (
              <li key={i}>
                <strong>{error.sourceField}</strong>
                {error.transform && ` (${error.transform})`}: {error.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* JSON Preview */}
      <div className="p-4">
        <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto text-xs font-mono">
          {JSON.stringify(currentPayload, null, 2) || '{}'}
        </pre>
      </div>

      {/* Stats */}
      <div className="bg-gray-50 border-t border-gray-200 px-4 py-3">
        <div className="flex items-center gap-4 text-xs text-gray-600 flex-wrap">
          <span>
            <strong>{preview.stats.pingFieldCount}</strong> PING fields
          </span>
          <span>
            <strong>{preview.stats.postFieldCount}</strong> POST fields
          </span>
          <span>
            <strong>{preview.stats.staticFieldCount}</strong> static fields
          </span>
          <span>
            <strong>{preview.stats.complianceFieldCount}</strong> compliance
          </span>
        </div>
      </div>

      {/* Sample Data Info */}
      <div className="bg-orange-50 border-t border-orange-200 px-4 py-2">
        <p className="text-xs text-orange-700">
          <strong>Note:</strong> This preview uses sample lead data. Actual payloads
          will contain real lead information.
        </p>
      </div>
    </div>
  );
}
