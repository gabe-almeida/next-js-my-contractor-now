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
  Hash
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

  const fetchCoverage = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/admin/buyers/${buyerId}/service-config`);

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

      {/* Warning if no ZIP codes */}
      {data?.summary.hasNoZipCodes && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-yellow-800">No Service Zones Configured</p>
            <p className="text-sm text-yellow-700 mt-1">
              This contractor has no ZIP code coverage configured. They will not receive
              any leads until service zones are added.
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

                  {/* Compliance badges */}
                  <div className="flex gap-2 mt-3">
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
