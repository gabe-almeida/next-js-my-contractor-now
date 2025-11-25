'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { 
  TestTube, 
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
  requiresTrustedForm: boolean;
  requiresJornaya: boolean;
  ping: {
    templateId: string | null;
    hasTemplate: boolean;
    payload: any;
    errors: string[];
    warnings: string[];
    mappingCount: number;
  };
  post: {
    templateId: string | null;
    hasTemplate: boolean;
    payload: any;
    errors: string[];
    warnings: string[];
    mappingCount: number;
  };
  sourceData: {
    original: any;
    enriched: any;
    withCompliance: any;
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
      const response = await fetch('/api/admin/test-payloads');
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
        headers: { 'Content-Type': 'application/json' },
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
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getStatusColor = (errors: string[], warnings: string[]) => {
    if (errors.length > 0) return 'text-red-600';
    if (warnings.length > 0) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getStatusIcon = (errors: string[], warnings: string[]) => {
    if (errors.length > 0) return <XCircle className="w-4 h-4" />;
    if (warnings.length > 0) return <AlertTriangle className="w-4 h-4" />;
    return <CheckCircle className="w-4 h-4" />;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <TestTube className="w-8 h-8 text-blue-600" />
            Payload Testing Lab
          </h1>
          <p className="mt-2 text-gray-600">
            Test and validate payload transformations for each lead buyer without sending actual requests
          </p>
        </div>

        {/* Test Configuration */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Test Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Service Type Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Service Type
                </label>
                <select
                  value={selectedService}
                  onChange={(e) => handleServiceChange(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  className="flex items-center gap-2 px-6"
                >
                  <Play className="w-4 h-4" />
                  {loading ? 'Testing...' : 'Run Test'}
                </Button>
                
                {testResults && (
                  <Button
                    variant="outline"
                    onClick={exportResults}
                    className="flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Export
                  </Button>
                )}
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
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                placeholder="Enter lead data as JSON..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Test Results */}
        {testResults && (
          <div className="space-y-6">
            
            {/* Results Header */}
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Test Results</h2>
              
              <div className="flex gap-2">
                <Button
                  variant={viewMode === 'ping' ? 'default' : 'outline'}
                  onClick={() => setViewMode('ping')}
                  className="px-4 py-2"
                >
                  PING Payloads
                </Button>
                <Button
                  variant={viewMode === 'post' ? 'default' : 'outline'}
                  onClick={() => setViewMode('post')}
                  className="px-4 py-2"
                >
                  POST Payloads
                </Button>
              </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-sm font-medium">Total Buyers</span>
                  </div>
                  <div className="text-2xl font-bold mt-1">{testResults.length}</div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm font-medium">Success</span>
                  </div>
                  <div className="text-2xl font-bold mt-1 text-green-600">
                    {testResults.filter(r => 
                      (viewMode === 'ping' ? r.ping.errors : r.post.errors).length === 0
                    ).length}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    <span className="text-sm font-medium">Warnings</span>
                  </div>
                  <div className="text-2xl font-bold mt-1 text-yellow-600">
                    {testResults.filter(r => 
                      (viewMode === 'ping' ? r.ping.warnings : r.post.warnings).length > 0
                    ).length}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span className="text-sm font-medium">Errors</span>
                  </div>
                  <div className="text-2xl font-bold mt-1 text-red-600">
                    {testResults.filter(r => 
                      (viewMode === 'ping' ? r.ping.errors : r.post.errors).length > 0
                    ).length}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Buyer Results */}
            <div className="space-y-4">
              {testResults.map(result => {
                const currentView = viewMode === 'ping' ? result.ping : result.post;
                const isExpanded = expandedBuyer === result.buyerId;
                
                return (
                  <Card key={result.buyerId}>
                    <CardHeader 
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => setExpandedBuyer(isExpanded ? null : result.buyerId)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={getStatusColor(currentView.errors, currentView.warnings)}>
                            {getStatusIcon(currentView.errors, currentView.warnings)}
                          </div>
                          
                          <div>
                            <CardTitle className="text-lg">{result.buyerName}</CardTitle>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant={result.active ? 'default' : 'secondary'}>
                                {result.active ? 'Active' : 'Inactive'}
                              </Badge>
                              {result.requiresTrustedForm && (
                                <Badge variant="outline">TrustedForm</Badge>
                              )}
                              {result.requiresJornaya && (
                                <Badge variant="outline">Jornaya</Badge>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-sm text-gray-600">
                            {currentView.mappingCount} mappings
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            {currentView.hasTemplate ? (
                              <Badge variant="default">Has Template</Badge>
                            ) : (
                              <Badge variant="destructive">No Template</Badge>
                            )}
                            <Eye className="w-4 h-4 text-gray-400" />
                          </div>
                        </div>
                      </div>
                    </CardHeader>

                    {isExpanded && (
                      <CardContent className="pt-0">
                        <div className="space-y-4">
                          
                          {/* Errors & Warnings */}
                          {(currentView.errors.length > 0 || currentView.warnings.length > 0) && (
                            <div className="space-y-2">
                              {currentView.errors.map((error, idx) => (
                                <div key={idx} className="flex items-center gap-2 text-red-600 text-sm">
                                  <XCircle className="w-4 h-4" />
                                  {error}
                                </div>
                              ))}
                              {currentView.warnings.map((warning, idx) => (
                                <div key={idx} className="flex items-center gap-2 text-yellow-600 text-sm">
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
                            <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-auto text-xs">
                              {JSON.stringify(currentView.payload, null, 2)}
                            </pre>
                          </div>

                          {/* Source Data */}
                          <details className="mt-4">
                            <summary className="cursor-pointer font-medium text-gray-700 hover:text-gray-900">
                              View Source Data
                            </summary>
                            <div className="mt-2 grid grid-cols-1 lg:grid-cols-3 gap-4">
                              <div>
                                <h5 className="text-sm font-medium text-gray-600 mb-1">Original</h5>
                                <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto max-h-40">
                                  {JSON.stringify(result.sourceData.original, null, 2)}
                                </pre>
                              </div>
                              <div>
                                <h5 className="text-sm font-medium text-gray-600 mb-1">Enriched</h5>
                                <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto max-h-40">
                                  {JSON.stringify(result.sourceData.enriched, null, 2)}
                                </pre>
                              </div>
                              <div>
                                <h5 className="text-sm font-medium text-gray-600 mb-1">With Compliance</h5>
                                <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto max-h-40">
                                  {JSON.stringify(result.sourceData.withCompliance, null, 2)}
                                </pre>
                              </div>
                            </div>
                          </details>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}