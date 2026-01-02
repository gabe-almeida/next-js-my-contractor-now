'use client';

import { useState } from 'react';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';
import { ResponseMappingConfig } from '@/types/response-mapping';

export interface ResponseMappingPreviewProps {
  config: ResponseMappingConfig;
  buyerName?: string;
}

/**
 * WHY: Admins need to quickly see how the current configuration will interpret
 * common buyer responses without having to test with live data.
 *
 * WHEN: Displayed in ResponseMappingEditor to provide real-time feedback.
 *
 * HOW: Shows example buyer responses and how they would be mapped to
 * internal statuses based on the current configuration.
 */
export function ResponseMappingPreview({
  config,
  buyerName
}: ResponseMappingPreviewProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Sample responses to show mapping
  const samplePingResponses = [
    { input: 'accepted', type: 'ping' },
    { input: 'interested', type: 'ping' },
    { input: 'bid', type: 'ping' },
    { input: 'rejected', type: 'ping' },
    { input: 'no_bid', type: 'ping' },
    { input: 'error', type: 'ping' },
  ];

  const samplePostResponses = [
    { input: 'delivered', type: 'post' },
    { input: 'success', type: 'post' },
    { input: 'sold', type: 'post' },
    { input: 'failed', type: 'post' },
    { input: 'duplicate', type: 'post' },
    { input: 'invalid', type: 'post' },
  ];

  const normalizeStatus = (status: string, type: 'ping' | 'post'): string => {
    const normalized = status.toLowerCase().trim();

    if (type === 'ping') {
      if (config.pingMappings.accepted.some(s => s.toLowerCase() === normalized)) {
        return 'accepted';
      }
      if (config.pingMappings.rejected.some(s => s.toLowerCase() === normalized)) {
        return 'rejected';
      }
      if (config.pingMappings.error.some(s => s.toLowerCase() === normalized)) {
        return 'error';
      }
      return 'unknown → rejected';
    }

    if (type === 'post') {
      if (config.postMappings.delivered.some(s => s.toLowerCase() === normalized)) {
        return 'delivered';
      }
      if (config.postMappings.failed.some(s => s.toLowerCase() === normalized)) {
        return 'failed';
      }
      if (config.postMappings.duplicate.some(s => s.toLowerCase() === normalized)) {
        return 'duplicate';
      }
      if (config.postMappings.invalid.some(s => s.toLowerCase() === normalized)) {
        return 'invalid';
      }
      return 'unknown → failed';
    }

    return 'unknown';
  };

  const getStatusColor = (status: string): string => {
    if (status.includes('accepted') || status.includes('delivered')) {
      return 'text-green-700 bg-green-100';
    }
    if (status.includes('rejected') || status.includes('duplicate')) {
      return 'text-yellow-700 bg-yellow-100';
    }
    if (status.includes('error') || status.includes('failed') || status.includes('invalid')) {
      return 'text-red-700 bg-red-100';
    }
    return 'text-gray-700 bg-gray-100';
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center space-x-2">
          {isExpanded ? (
            <EyeOff className="h-4 w-4 text-gray-500" />
          ) : (
            <Eye className="h-4 w-4 text-gray-500" />
          )}
          <span className="text-sm font-medium text-gray-700">
            Preview Mapping Results
          </span>
        </div>
        <span className="text-xs text-gray-500">
          {isExpanded ? 'Click to hide' : 'Click to preview'}
        </span>
      </button>

      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* PING Mappings Preview */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              PING Response Mapping
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {samplePingResponses.map(({ input }, idx) => {
                const result = normalizeStatus(input, 'ping');
                return (
                  <div
                    key={idx}
                    className="flex items-center space-x-2 text-xs"
                  >
                    <code className="px-2 py-1 bg-gray-100 rounded font-mono text-gray-700">
                      {input}
                    </code>
                    <ArrowRight className="h-3 w-3 text-gray-400" />
                    <span className={`px-2 py-1 rounded font-medium ${getStatusColor(result)}`}>
                      {result}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* POST Mappings Preview */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              POST Response Mapping
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {samplePostResponses.map(({ input }, idx) => {
                const result = normalizeStatus(input, 'post');
                return (
                  <div
                    key={idx}
                    className="flex items-center space-x-2 text-xs"
                  >
                    <code className="px-2 py-1 bg-gray-100 rounded font-mono text-gray-700">
                      {input}
                    </code>
                    <ArrowRight className="h-3 w-3 text-gray-400" />
                    <span className={`px-2 py-1 rounded font-medium ${getStatusColor(result)}`}>
                      {result}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Configuration Summary */}
          <div className="pt-3 border-t border-gray-200">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-gray-500">Status Field:</span>
                <code className="block font-mono text-gray-900 mt-1">
                  {config.statusField}
                </code>
              </div>
              <div>
                <span className="text-gray-500">Accepted Values:</span>
                <span className="block text-green-700 font-medium mt-1">
                  {config.pingMappings.accepted.length}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Rejected Values:</span>
                <span className="block text-yellow-700 font-medium mt-1">
                  {config.pingMappings.rejected.length}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Bid Fields:</span>
                <span className="block text-blue-700 font-medium mt-1">
                  {config.bidAmountFields.length}
                </span>
              </div>
            </div>
          </div>

          {/* Test Input */}
          <TestInput config={config} />
        </div>
      )}
    </div>
  );
}

/**
 * Interactive test input for admins to try custom status values
 */
function TestInput({ config }: { config: ResponseMappingConfig }) {
  const [testValue, setTestValue] = useState('');
  const [testType, setTestType] = useState<'ping' | 'post'>('ping');

  const normalizeStatus = (status: string, type: 'ping' | 'post'): string => {
    const normalized = status.toLowerCase().trim();

    if (type === 'ping') {
      if (config.pingMappings.accepted.some(s => s.toLowerCase() === normalized)) {
        return 'accepted';
      }
      if (config.pingMappings.rejected.some(s => s.toLowerCase() === normalized)) {
        return 'rejected';
      }
      if (config.pingMappings.error.some(s => s.toLowerCase() === normalized)) {
        return 'error';
      }
      return 'unknown (defaults to rejected)';
    }

    if (config.postMappings.delivered.some(s => s.toLowerCase() === normalized)) {
      return 'delivered';
    }
    if (config.postMappings.failed.some(s => s.toLowerCase() === normalized)) {
      return 'failed';
    }
    if (config.postMappings.duplicate.some(s => s.toLowerCase() === normalized)) {
      return 'duplicate';
    }
    if (config.postMappings.invalid.some(s => s.toLowerCase() === normalized)) {
      return 'invalid';
    }
    return 'unknown (defaults to failed)';
  };

  const getStatusColor = (status: string): string => {
    if (status.includes('accepted') || status.includes('delivered')) {
      return 'text-green-700 bg-green-100 border-green-300';
    }
    if (status.includes('rejected') || status.includes('duplicate')) {
      return 'text-yellow-700 bg-yellow-100 border-yellow-300';
    }
    if (status.includes('error') || status.includes('failed') || status.includes('invalid')) {
      return 'text-red-700 bg-red-100 border-red-300';
    }
    return 'text-gray-700 bg-gray-100 border-gray-300';
  };

  const result = testValue ? normalizeStatus(testValue, testType) : null;

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
      <h5 className="text-xs font-semibold text-gray-700 mb-2">
        Test a Status Value
      </h5>
      <div className="flex items-center space-x-2">
        <select
          value={testType}
          onChange={(e) => setTestType(e.target.value as 'ping' | 'post')}
          className="px-2 py-1.5 text-xs border border-gray-300 rounded-md bg-white"
        >
          <option value="ping">PING</option>
          <option value="post">POST</option>
        </select>
        <input
          type="text"
          value={testValue}
          onChange={(e) => setTestValue(e.target.value)}
          placeholder="Enter status to test..."
          className="flex-1 px-3 py-1.5 text-xs font-mono border border-gray-300 rounded-md"
        />
        {result && (
          <>
            <ArrowRight className="h-4 w-4 text-gray-400" />
            <span className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(result)}`}>
              {result}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
