'use client';

/**
 * Payload Testing Lab Page
 *
 * WHY: Test and validate payload transformations without sending actual requests.
 * WHEN: Admin needs to debug or verify buyer field mappings.
 * HOW: Fetches service types and runs payload tests against buyer configurations.
 */

import { useState, useEffect } from 'react';
import { AdminPageHeader, AdminSection, StatusBadge } from '@/components/admin/ui';
import { Button } from '@/components/ui/Button';
import {
  Play,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Code,
  Eye,
  Download
} from 'lucide-react';

interface ServiceType {
  id: string;
  name: string;
  activeBuyers: number;
  sampleData: any;
}

interface PayloadTestResult {
  buyerId: string;
  buyerName: string;
  buyerApiUrl: string;
  active: boolean;
  requiresTrustedForm?: boolean;
  requiresJornaya?: boolean;
  error?: string;
  ping?: {
    templateId?: string | null;
    hasTemplate?: boolean;
    payload?: any;
    errors?: string[];
    warnings?: string[];
    mappingCount?: number;
    error?: string;
  };
  post?: {
    templateId?: string | null;
    hasTemplate?: boolean;
    payload?: any;
    errors?: string[];
    warnings?: string[];
    mappingCount?: number;
    error?: string;
  };
  sourceData?: {
    original?: any;
    enriched?: any;
    withCompliance?: any;
  };
}

export default function PayloadTestingPage() {
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [selectedService, setSelectedService] = useState<string>('');
  const [customLeadData, setCustomLeadData] = useState<string>('');
  const [testResults, setTestResults] = useState<PayloadTestResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedBuyer, setExpandedBuyer] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'ping' | 'post'>('ping');

  useEffect(() => {
    fetchServiceTypes();
  }, []);

  const fetchServiceTypes = async () => {
    try {
      const response = await fetch('/api/admin/test-payloads', {
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`
        }
      });
      const data = await response.json();

      if (data.success) {
        setServiceTypes(data.serviceTypes);
        if (data.serviceTypes.length > 0) {
          setSelectedService(data.serviceTypes[0].id);
          setCustomLeadData(JSON.stringify(data.serviceTypes[0].sampleData, null, 2));
        }
      }
    } catch (error) {
      console.error('Failed to fetch service types:', error);
    }
  };

  const runPayloadTest = async () => {
    if (!selectedService) return;

    setLoading(true);
    try {
      let leadData;
      try {
        leadData = JSON.parse(customLeadData);
      } catch {
        alert('Invalid JSON in lead data');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/admin/test-payloads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`
        },
        body: JSON.stringify({
          serviceTypeId: selectedService,
          leadData
        })
      });

      const data = await response.json();

      if (data.success) {
        setTestResults(data.results);
      } else {
        alert('Test failed: ' + data.error);
      }
    } catch (error) {
      console.error('Test error:', error);
      alert('Test failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleServiceChange = (serviceId: string) => {
    setSelectedService(serviceId);
    setTestResults(null);

    const service = serviceTypes.find(s => s.id === serviceId);
    if (service) {
      setCustomLeadData(JSON.stringify(service.sampleData, null, 2));
    }
  };

  const exportResults = () => {
    if (!testResults) return;

    const exportData = {
      timestamp: new Date().toISOString(),
      serviceType: serviceTypes.find(s => s.id === selectedService)?.name,
      results: testResults
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payload-test-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusColor = (errors?: string[], warnings?: string[]) => {
    if (errors && errors.length > 0) return 'text-red-600';
    if (warnings && warnings.length > 0) return 'text-amber-600';
    return 'text-emerald-600';
  };

  const getStatusIcon = (errors?: string[], warnings?: string[]) => {
    if (errors && errors.length > 0) return <XCircle className="w-4 h-4" />;
    if (warnings && warnings.length > 0) return <AlertTriangle className="w-4 h-4" />;
    return <CheckCircle className="w-4 h-4" />;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <AdminPageHeader
        title="Payload Testing Lab"
        description="Test and validate payload transformations for each lead buyer without sending actual requests"
        actions={
          testResults && (
            <Button variant="outline" onClick={exportResults} className="gap-2">
              <Download className="h-4 w-4" />
              Export Results
            </Button>
          )
        }
      />

      {/* Test Configuration */}
      <AdminSection title="Test Configuration">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Service Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Service Type
            </label>
            <select
              value={selectedService}
              onChange={(e) => handleServiceChange(e.target.value)}
              className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
            >
              {serviceTypes.map(service => (
                <option key={service.id} value={service.id}>
                  {service.name} ({service.activeBuyers} active buyers)
                </option>
              ))}
            </select>
          </div>

          {/* Test Controls */}
          <div className="flex items-end gap-3">
            <Button
              onClick={runPayloadTest}
              disabled={loading || !selectedService}
              className="gap-2 bg-orange-500 hover:bg-orange-600"
            >
              <Play className="w-4 h-4" />
              {loading ? 'Testing...' : 'Run Test'}
            </Button>
          </div>
        </div>

        {/* Lead Data Editor */}
        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Lead Data (JSON)
          </label>
          <textarea
            value={customLeadData}
            onChange={(e) => setCustomLeadData(e.target.value)}
            rows={10}
            className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-mono text-sm transition-colors"
            placeholder="Enter lead data as JSON..."
          />
        </div>
      </AdminSection>

      {/* Test Results */}
      {testResults && (
        <div className="space-y-6">
          {/* Results Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Test Results</h2>

            <div className="flex gap-2">
              <Button
                variant={viewMode === 'ping' ? 'default' : 'outline'}
                onClick={() => setViewMode('ping')}
                className={viewMode === 'ping' ? 'bg-orange-500 hover:bg-orange-600' : ''}
              >
                PING Payloads
              </Button>
              <Button
                variant={viewMode === 'post' ? 'default' : 'outline'}
                onClick={() => setViewMode('post')}
                className={viewMode === 'post' ? 'bg-orange-500 hover:bg-orange-600' : ''}
              >
                POST Payloads
              </Button>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-sm font-medium text-gray-500">Total Buyers</span>
              </div>
              <div className="text-2xl font-bold mt-1">{(testResults || []).length}</div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                <span className="text-sm font-medium text-gray-500">Success</span>
              </div>
              <div className="text-2xl font-bold mt-1 text-emerald-600">
                {(testResults || []).filter(r => {
                  const errors = viewMode === 'ping' ? r.ping?.errors : r.post?.errors;
                  return !errors || errors.length === 0;
                }).length}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                <span className="text-sm font-medium text-gray-500">Warnings</span>
              </div>
              <div className="text-2xl font-bold mt-1 text-amber-600">
                {(testResults || []).filter(r => {
                  const warnings = viewMode === 'ping' ? r.ping?.warnings : r.post?.warnings;
                  return warnings && warnings.length > 0;
                }).length}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span className="text-sm font-medium text-gray-500">Errors</span>
              </div>
              <div className="text-2xl font-bold mt-1 text-red-600">
                {(testResults || []).filter(r => {
                  const errors = viewMode === 'ping' ? r.ping?.errors : r.post?.errors;
                  return errors && errors.length > 0;
                }).length}
              </div>
            </div>
          </div>

          {/* Buyer Results */}
          <div className="space-y-4">
            {(testResults || []).map(result => {
              const currentView = viewMode === 'ping' ? result.ping : result.post;
              const isExpanded = expandedBuyer === result.buyerId;
              const errors = currentView?.errors || [];
              const warnings = currentView?.warnings || [];

              return (
                <div key={result.buyerId} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <div
                    className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => setExpandedBuyer(isExpanded ? null : result.buyerId)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={getStatusColor(errors, warnings)}>
                          {getStatusIcon(errors, warnings)}
                        </div>

                        <div>
                          <h3 className="text-base font-semibold text-gray-900">{result.buyerName}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <StatusBadge status={result.active ? 'ACTIVE' : 'INACTIVE'} />
                            {result.requiresTrustedForm && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                                TrustedForm
                              </span>
                            )}
                            {result.requiresJornaya && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700">
                                Jornaya
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right flex items-center gap-4">
                        <div>
                          <div className="text-sm text-gray-600">
                            {currentView?.mappingCount ?? 0} mappings
                          </div>
                          <div className="mt-1">
                            {currentView?.hasTemplate ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700">
                                Has Template
                              </span>
                            ) : currentView?.payload ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700">
                                Has Mappings
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-700">
                                No Template
                              </span>
                            )}
                          </div>
                        </div>
                        <Eye className="w-4 h-4 text-gray-400" />
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-gray-100">
                      <div className="pt-4 space-y-4">
                        {/* Top-level error */}
                        {result.error && (
                          <div className="flex items-center gap-2 text-red-600 text-sm">
                            <XCircle className="w-4 h-4" />
                            {result.error}
                          </div>
                        )}

                        {/* Errors & Warnings */}
                        {(errors.length > 0 || warnings.length > 0) && (
                          <div className="space-y-2">
                            {errors.map((error, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-red-600 text-sm">
                                <XCircle className="w-4 h-4" />
                                {error}
                              </div>
                            ))}
                            {warnings.map((warning, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-amber-600 text-sm">
                                <AlertTriangle className="w-4 h-4" />
                                {warning}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Payload Preview */}
                        <div>
                          <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                            <Code className="w-4 h-4" />
                            {viewMode.toUpperCase()} Payload
                          </h4>
                          <pre className="bg-gray-900 text-emerald-400 p-4 rounded-lg overflow-auto text-xs">
                            {JSON.stringify(currentView?.payload || {}, null, 2)}
                          </pre>
                        </div>

                        {/* Source Data */}
                        {result.sourceData && (
                          <details className="mt-4">
                            <summary className="cursor-pointer font-medium text-gray-700 hover:text-gray-900">
                              View Source Data
                            </summary>
                            <div className="mt-2 grid grid-cols-1 lg:grid-cols-3 gap-4">
                              <div>
                                <h5 className="text-sm font-medium text-gray-600 mb-1">Original</h5>
                                <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto max-h-40">
                                  {JSON.stringify(result.sourceData.original || {}, null, 2)}
                                </pre>
                              </div>
                              <div>
                                <h5 className="text-sm font-medium text-gray-600 mb-1">Enriched</h5>
                                <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto max-h-40">
                                  {JSON.stringify(result.sourceData.enriched || {}, null, 2)}
                                </pre>
                              </div>
                              <div>
                                <h5 className="text-sm font-medium text-gray-600 mb-1">With Compliance</h5>
                                <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto max-h-40">
                                  {JSON.stringify(result.sourceData.withCompliance || {}, null, 2)}
                                </pre>
                              </div>
                            </div>
                          </details>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
