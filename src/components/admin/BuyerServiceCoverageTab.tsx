'use client';

/**
 * Buyer Service Coverage Tab Component
 *
 * WHY: Display contractor's service configuration and ZIP code coverage
 * WHEN: Rendered in buyer detail page for CONTRACTOR type buyers
 * HOW: Fetch from service-config API, display services and coverage stats
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import {
  MapPin,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Settings,
  Hash,
  Globe,
  Loader2
} from 'lucide-react';

interface BuyerServiceCoverageTabProps {
  buyerId: string;
  buyerName: string;
  buyerType: string;
}

interface ServiceConfig {
  serviceTypeId: string;
  serviceName: string;
  serviceDisplayName: string;
  serviceActive: boolean;
  configActive: boolean;
  nationwide: boolean; // Participates in all leads regardless of ZIP
  minBid: number;
  maxBid: number;
  requiresTrustedForm: boolean;
  requiresJornaya: boolean;
  totalZipCodes: number;
  activeZipCodes: number;
  createdAt: string;
}

interface CoverageData {
  buyerId: string;
  buyerName: string;
  buyerType: string;
  buyerActive: boolean;
  services: ServiceConfig[];
  summary: {
    totalServices: number;
    activeServices: number;
    totalZipCodes: number;
    activeZipCodes: number;
    hasNoZipCodes: boolean;
  };
}

export function BuyerServiceCoverageTab({
  buyerId,
  buyerName,
  buyerType
}: BuyerServiceCoverageTabProps) {
  const [data, setData] = useState<CoverageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingService, setUpdatingService] = useState<string | null>(null);

  const toggleActive = async (serviceTypeId: string, currentValue: boolean) => {
    try {
      setUpdatingService(serviceTypeId);

      const response = await fetch(`/api/admin/buyers/${buyerId}/service-config`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`
        },
        body: JSON.stringify({
          serviceTypeId,
          active: !currentValue
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update service configuration');
      }

      // Update local state
      setData(prev => {
        if (!prev) return prev;
        const newActiveCount = prev.services.filter(s =>
          s.serviceTypeId === serviceTypeId ? !currentValue : s.configActive
        ).length;
        return {
          ...prev,
          services: prev.services.map(s =>
            s.serviceTypeId === serviceTypeId
              ? { ...s, configActive: !currentValue }
              : s
          ),
          summary: {
            ...prev.summary,
            activeServices: newActiveCount
          }
        };
      });
    } catch (err) {
      console.error('Error toggling active:', err);
      alert('Failed to update active setting');
    } finally {
      setUpdatingService(null);
    }
  };

  const toggleNationwide = async (serviceTypeId: string, currentValue: boolean) => {
    try {
      setUpdatingService(serviceTypeId);

      const response = await fetch(`/api/admin/buyers/${buyerId}/service-config`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`
        },
        body: JSON.stringify({
          serviceTypeId,
          nationwide: !currentValue
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update service configuration');
      }

      // Update local state
      setData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          services: prev.services.map(s =>
            s.serviceTypeId === serviceTypeId
              ? { ...s, nationwide: !currentValue }
              : s
          )
        };
      });
    } catch (err) {
      console.error('Error toggling nationwide:', err);
      alert('Failed to update nationwide setting');
    } finally {
      setUpdatingService(null);
    }
  };

  const fetchCoverage = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/admin/buyers/${buyerId}/service-config`, {
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch service configuration');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch service configuration');
      }

      setData(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [buyerId]);

  useEffect(() => {
    fetchCoverage();
  }, [fetchCoverage]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  };

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">{error}</p>
          <button
            onClick={fetchCoverage}
            className="mt-2 text-red-600 hover:text-red-800 flex items-center gap-1"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          Service Coverage for {buyerName}
        </h3>
        <button
          onClick={fetchCoverage}
          className="p-2 text-gray-400 hover:text-gray-600"
          title="Refresh"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Warning if no ZIP codes and no nationwide services */}
      {data?.summary.hasNoZipCodes && !data?.services.some(s => s.nationwide) && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-yellow-800">No Service Zones Configured</p>
            <p className="text-sm text-yellow-700 mt-1">
              This buyer has no ZIP code coverage configured and no services set to &quot;Nationwide&quot;.
              They will not receive any leads until service zones are added or Nationwide Coverage is enabled.
            </p>
          </div>
        </div>
      )}

      {/* Info if nationwide is enabled */}
      {data?.services.some(s => s.nationwide) && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 flex items-start gap-3">
          <Globe className="h-5 w-5 text-indigo-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-indigo-800">Nationwide Coverage Enabled</p>
            <p className="text-sm text-indigo-700 mt-1">
              This buyer has Nationwide Coverage enabled for {data.services.filter(s => s.nationwide).length} service(s).
              They will participate in all leads for those services regardless of ZIP code.
              Leads are filtered via their PING response (accept/reject).
            </p>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-gray-400" />
              <div className="text-sm text-gray-500">Services</div>
            </div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {loading ? '-' : data?.summary.totalServices || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <div className="text-sm text-gray-500">Active Services</div>
            </div>
            <div className="text-2xl font-bold text-green-600 mt-1">
              {loading ? '-' : data?.summary.activeServices || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-blue-500" />
              <div className="text-sm text-gray-500">Total ZIP Codes</div>
            </div>
            <div className="text-2xl font-bold text-blue-600 mt-1">
              {loading ? '-' : data?.summary.totalZipCodes?.toLocaleString() || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-purple-500" />
              <div className="text-sm text-gray-500">Active ZIP Codes</div>
            </div>
            <div className="text-2xl font-bold text-purple-600 mt-1">
              {loading ? '-' : data?.summary.activeZipCodes?.toLocaleString() || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Services List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Configured Services</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ) : data?.services.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No services configured for this contractor
            </div>
          ) : (
            <div className="space-y-4">
              {data?.services.map((service) => (
                <div
                  key={service.serviceTypeId}
                  className="border rounded-lg p-4 hover:bg-gray-50"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {service.configActive ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-400" />
                      )}
                      <div>
                        <div className="font-medium text-gray-900">
                          {service.serviceDisplayName}
                        </div>
                        <div className="text-sm text-gray-500">
                          Bid Range: {formatCurrency(service.minBid)} - {formatCurrency(service.maxBid)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-blue-600">
                        {service.totalZipCodes.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500">ZIP codes</div>
                    </div>
                  </div>

                  {/* Service Active Toggle */}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t">
                    <div className="flex items-center gap-2">
                      {service.configActive ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-400" />
                      )}
                      <span className="text-sm font-medium text-gray-700">Service Active</span>
                      <span className="text-xs text-gray-500">
                        {service.configActive ? '(Receiving leads)' : '(Not receiving leads)'}
                      </span>
                    </div>
                    <button
                      onClick={() => toggleActive(service.serviceTypeId, service.configActive)}
                      disabled={updatingService === service.serviceTypeId}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${
                        service.configActive ? 'bg-green-600' : 'bg-gray-200'
                      } ${updatingService === service.serviceTypeId ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      {updatingService === service.serviceTypeId ? (
                        <Loader2 className="h-4 w-4 animate-spin absolute left-1/2 -translate-x-1/2 text-white" />
                      ) : (
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            service.configActive ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      )}
                    </button>
                  </div>

                  {/* Nationwide Toggle */}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t">
                    <div className="flex items-center gap-2">
                      <Globe className={`h-4 w-4 ${service.nationwide ? 'text-indigo-600' : 'text-gray-400'}`} />
                      <span className="text-sm font-medium text-gray-700">Nationwide Coverage</span>
                      <span className="text-xs text-gray-500">
                        {service.nationwide ? '(All ZIP codes)' : '(ZIP codes required)'}
                      </span>
                    </div>
                    <button
                      onClick={() => toggleNationwide(service.serviceTypeId, service.nationwide)}
                      disabled={updatingService === service.serviceTypeId}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                        service.nationwide ? 'bg-indigo-600' : 'bg-gray-200'
                      } ${updatingService === service.serviceTypeId ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      {updatingService === service.serviceTypeId ? (
                        <Loader2 className="h-4 w-4 animate-spin absolute left-1/2 -translate-x-1/2 text-white" />
                      ) : (
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            service.nationwide ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      )}
                    </button>
                  </div>

                  {/* Compliance badges */}
                  <div className="flex flex-wrap gap-2 mt-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      service.requiresTrustedForm
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      TrustedForm: {service.requiresTrustedForm ? 'Required' : 'Not Required'}
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      service.requiresJornaya
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      Jornaya: {service.requiresJornaya ? 'Required' : 'Not Required'}
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      service.serviceActive
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      Service: {service.serviceActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action hint */}
      {data && !data.summary.hasNoZipCodes && (
        <div className="text-sm text-gray-500 text-center">
          Use the ZIP Codes tab to manage individual ZIP code assignments for this buyer.
        </div>
      )}
    </div>
  );
}
