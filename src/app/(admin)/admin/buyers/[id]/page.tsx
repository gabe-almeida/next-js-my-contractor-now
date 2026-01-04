'use client';

/**
 * Buyer Detail Page
 *
 * WHY: Central view for buyer configuration, activity history, and coverage
 * WHEN: Admin clicks on a buyer from the list or navigates directly
 * HOW: Fetch buyer data from API, render tabbed interface with sub-components
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { BuyerActivityTab } from '@/components/admin/BuyerActivityTab';
import { BuyerServiceCoverageTab } from '@/components/admin/BuyerServiceCoverageTab';
import {
  ArrowLeft,
  AlertCircle,
  RefreshCw,
  Building2,
  Activity,
  MapPin,
  Globe,
  Clock,
  Mail,
  Phone,
  User,
  CheckCircle,
  XCircle,
  Shield
} from 'lucide-react';

type TabType = 'details' | 'activity' | 'coverage';

interface BuyerData {
  id: string;
  name: string;
  displayName: string | null;
  type: 'CONTRACTOR' | 'NETWORK';
  apiUrl: string;
  authType: string;
  credentialKeys: string[];
  active: boolean;
  pingTimeout: number;
  postTimeout: number;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  businessEmail: string | null;
  businessPhone: string | null;
  serviceConfigs: Array<{
    id: string;
    serviceTypeId: string;
    serviceName: string;
    minBid: number;
    maxBid: number;
    requiresTrustedForm: boolean;
    requiresJornaya: boolean;
    active: boolean;
  }>;
  stats: {
    zipCodeCount: number;
    leadsWon: number;
    totalTransactions: number;
  };
  createdAt: string;
  updatedAt: string;
}

export default function BuyerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const buyerId = params.id as string;

  const [activeTab, setActiveTab] = useState<TabType>('details');
  const [buyer, setBuyer] = useState<BuyerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBuyer = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/admin/buyers/${buyerId}`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Buyer not found');
        }
        throw new Error('Failed to fetch buyer data');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to fetch buyer');
      }

      setBuyer(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [buyerId]);

  useEffect(() => {
    if (buyerId) {
      fetchBuyer();
    }
  }, [buyerId, fetchBuyer]);

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'details', label: 'Details', icon: <Building2 className="h-4 w-4" /> },
    { id: 'activity', label: 'Activity', icon: <Activity className="h-4 w-4" /> },
    { id: 'coverage', label: 'ZIP Coverage', icon: <MapPin className="h-4 w-4" /> }
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="flex items-center space-x-4 mb-6">
            <div className="h-8 w-8 bg-gray-200 rounded" />
            <div className="h-8 bg-gray-200 rounded w-1/3" />
          </div>

          <div className="flex space-x-1 mb-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 w-24 bg-gray-200 rounded" />
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded" />
            ))}
          </div>

          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            onClick={() => router.push('/admin/buyers')}
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">Buyer Details</h1>
        </div>

        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2 text-red-800">
              <AlertCircle className="h-5 w-5" />
              <span className="font-medium">Failed to load buyer</span>
            </div>
            <p className="text-red-700 mt-2">{error}</p>
            <Button
              variant="outline"
              onClick={fetchBuyer}
              className="mt-3 border-red-300 text-red-700 hover:bg-red-100"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!buyer) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            onClick={() => router.push('/admin/buyers')}
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">Buyer Not Found</h1>
        </div>

        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Buyer Not Found
            </h3>
            <p className="text-gray-500 mb-6">
              The buyer you are looking for does not exist or has been removed.
            </p>
            <Button
              onClick={() => router.push('/admin/buyers')}
              variant="outline"
            >
              Back to Buyers
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            onClick={() => router.push('/admin/buyers')}
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">
                {buyer.displayName || buyer.name}
              </h1>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  buyer.type === 'NETWORK'
                    ? 'bg-purple-100 text-purple-800'
                    : 'bg-blue-100 text-blue-800'
                }`}
              >
                {buyer.type}
              </span>
              {buyer.active ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Active
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                  <XCircle className="h-3 w-3 mr-1" />
                  Inactive
                </span>
              )}
            </div>
            <p className="text-gray-500 mt-1">{buyer.name}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          onClick={fetchBuyer}
          className="text-gray-400 hover:text-gray-600"
          title="Refresh"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'details' && (
        <BuyerDetailsContent buyer={buyer} />
      )}

      {activeTab === 'activity' && (
        <BuyerActivityTab
          buyerId={buyer.id}
          buyerName={buyer.displayName || buyer.name}
        />
      )}

      {activeTab === 'coverage' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button
              onClick={() => router.push(`/admin/buyers/${buyer.id}/zip-codes`)}
              className="flex items-center gap-2"
            >
              <MapPin className="h-4 w-4" />
              Manage ZIP Codes
            </Button>
          </div>
          <BuyerServiceCoverageTab
            buyerId={buyer.id}
            buyerName={buyer.displayName || buyer.name}
            buyerType={buyer.type}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Buyer Details Content Component
 *
 * WHY: Display buyer configuration info in organized sections
 * WHEN: Details tab is active
 * HOW: Render buyer data in card-based layout
 */
function BuyerDetailsContent({ buyer }: { buyer: BuyerData }) {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value);

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-gray-500">Total Transactions</div>
            <div className="text-2xl font-bold text-gray-900">
              {buyer.stats.totalTransactions.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-gray-500">Leads Won</div>
            <div className="text-2xl font-bold text-green-600">
              {buyer.stats.leadsWon.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-gray-500">ZIP Codes</div>
            <div className="text-2xl font-bold text-gray-900">
              {buyer.stats.zipCodeCount.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-gray-500">Service Configs</div>
            <div className="text-2xl font-bold text-gray-900">
              {buyer.serviceConfigs.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* API Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Globe className="h-5 w-5" />
            API Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-500">API URL</div>
              <div className="text-gray-900 font-mono text-sm break-all">
                {buyer.apiUrl}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Authentication Type</div>
              <div className="text-gray-900 capitalize">{buyer.authType}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                PING Timeout
              </div>
              <div className="text-gray-900">{buyer.pingTimeout}ms</div>
            </div>
            <div>
              <div className="text-sm text-gray-500 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                POST Timeout
              </div>
              <div className="text-gray-900">{buyer.postTimeout}ms</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact Information */}
      {(buyer.contactName || buyer.contactEmail || buyer.contactPhone ||
        buyer.businessEmail || buyer.businessPhone) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5" />
              Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {buyer.contactName && (
                <div>
                  <div className="text-sm text-gray-500">Contact Name</div>
                  <div className="text-gray-900">{buyer.contactName}</div>
                </div>
              )}
              {buyer.contactEmail && (
                <div>
                  <div className="text-sm text-gray-500 flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    Contact Email
                  </div>
                  <div className="text-gray-900">{buyer.contactEmail}</div>
                </div>
              )}
              {buyer.contactPhone && (
                <div>
                  <div className="text-sm text-gray-500 flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    Contact Phone
                  </div>
                  <div className="text-gray-900">{buyer.contactPhone}</div>
                </div>
              )}
              {buyer.businessEmail && (
                <div>
                  <div className="text-sm text-gray-500 flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    Business Email
                  </div>
                  <div className="text-gray-900">{buyer.businessEmail}</div>
                </div>
              )}
              {buyer.businessPhone && (
                <div>
                  <div className="text-sm text-gray-500 flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    Business Phone
                  </div>
                  <div className="text-gray-900">{buyer.businessPhone}</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Service Configurations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Service Configurations
          </CardTitle>
        </CardHeader>
        <CardContent>
          {buyer.serviceConfigs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No service configurations found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-2 text-sm font-medium text-gray-500">
                      Service
                    </th>
                    <th className="text-left py-3 px-2 text-sm font-medium text-gray-500">
                      Bid Range
                    </th>
                    <th className="text-left py-3 px-2 text-sm font-medium text-gray-500">
                      Compliance
                    </th>
                    <th className="text-left py-3 px-2 text-sm font-medium text-gray-500">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {buyer.serviceConfigs.map((config) => (
                    <tr
                      key={config.id}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="py-3 px-2 text-sm text-gray-900">
                        {config.serviceName}
                      </td>
                      <td className="py-3 px-2 text-sm text-gray-900">
                        {formatCurrency(config.minBid)} - {formatCurrency(config.maxBid)}
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex gap-2">
                          {config.requiresTrustedForm && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                              TrustedForm
                            </span>
                          )}
                          {config.requiresJornaya && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                              Jornaya
                            </span>
                          )}
                          {!config.requiresTrustedForm && !config.requiresJornaya && (
                            <span className="text-gray-400 text-xs">None</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        {config.active ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                            Inactive
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Timestamps */}
      <div className="text-sm text-gray-500 flex items-center gap-6">
        <span>Created: {new Date(buyer.createdAt).toLocaleString()}</span>
        <span>Updated: {new Date(buyer.updatedAt).toLocaleString()}</span>
      </div>
    </div>
  );
}
