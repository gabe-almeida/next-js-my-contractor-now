'use client';

/**
 * Buyer Detail Page
 *
 * WHY: Central view for buyer configuration, activity history, coverage, and call settings
 * WHEN: Admin clicks on a buyer from the list or navigates directly
 * HOW: Fetch buyer data from API, render tabbed interface with sub-components
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import {
  AdminDetailPageHeader,
  AdminTabNav,
  AdminSection,
  AdminStatGrid,
  AdminInfoGrid,
  StatusBadge
} from '@/components/admin/ui';
import { BuyerActivityTab } from '@/components/admin/BuyerActivityTab';
import { BuyerServiceCoverageTab } from '@/components/admin/BuyerServiceCoverageTab';
import { BuyerCallSettingsTab } from '@/components/admin/BuyerCallSettingsTab';
import {
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
  Shield,
  FileText,
  Award
} from 'lucide-react';

type TabType = 'details' | 'activity' | 'coverage' | 'call-settings';

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

      const response = await fetch(`/api/admin/buyers/${buyerId}`, {
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`
        }
      });

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

  const tabs = [
    { id: 'details' as TabType, label: 'Details', icon: <Building2 className="h-4 w-4" /> },
    { id: 'activity' as TabType, label: 'Activity', icon: <Activity className="h-4 w-4" /> },
    { id: 'coverage' as TabType, label: 'ZIP Coverage', icon: <MapPin className="h-4 w-4" /> },
    { id: 'call-settings' as TabType, label: 'Call Settings', icon: <Phone className="h-4 w-4" /> }
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="flex items-center gap-4 mb-6">
            <div className="h-8 w-8 bg-gray-200 rounded-lg" />
            <div className="h-8 bg-gray-200 rounded w-1/3" />
          </div>

          <div className="flex gap-2 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 w-24 bg-gray-200 rounded-lg" />
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-xl" />
            ))}
          </div>

          <div className="h-64 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <AdminDetailPageHeader
          title="Buyer Details"
          backHref="/admin/buyers"
          backLabel="Back to Buyers"
        />

        <div className="bg-red-50 rounded-xl border border-red-200 p-6">
          <div className="flex items-center gap-2 text-red-800">
            <AlertCircle className="h-5 w-5" />
            <span className="font-medium">Failed to load buyer</span>
          </div>
          <p className="text-red-700 mt-2">{error}</p>
          <Button
            variant="outline"
            onClick={fetchBuyer}
            className="mt-4 gap-2 border-red-300 text-red-700 hover:bg-red-100"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (!buyer) {
    return (
      <div className="space-y-6">
        <AdminDetailPageHeader
          title="Buyer Not Found"
          backHref="/admin/buyers"
          backLabel="Back to Buyers"
        />

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm py-12 text-center">
          <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Buyer Not Found
          </h3>
          <p className="text-sm text-gray-500 mb-6">
            The buyer you are looking for does not exist or has been removed.
          </p>
          <Button
            onClick={() => router.push('/admin/buyers')}
            variant="outline"
          >
            Back to Buyers
          </Button>
        </div>
      </div>
    );
  }

  // Prepare badges for the detail header
  const badges = [
    {
      label: buyer.type,
      variant: buyer.type === 'NETWORK' ? 'purple' as const : 'orange' as const
    },
    {
      label: buyer.active ? 'Active' : 'Inactive',
      variant: buyer.active ? 'green' as const : 'gray' as const
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <AdminDetailPageHeader
        title={buyer.displayName || buyer.name}
        subtitle={buyer.name}
        backHref="/admin/buyers"
        backLabel="Back to Buyers"
        badges={badges}
        onRefresh={fetchBuyer}
      />

      {/* Tab Navigation */}
      <AdminTabNav
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as TabType)}
      />

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
              className="gap-2 bg-orange-500 hover:bg-orange-600"
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

      {activeTab === 'call-settings' && (
        <BuyerCallSettingsTab
          buyerId={buyer.id}
          buyerType={buyer.type}
        />
      )}
    </div>
  );
}

/**
 * Buyer Details Content Component
 *
 * WHY: Display buyer configuration info in organized sections
 * WHEN: Details tab is active
 * HOW: Render buyer data using shared admin components
 */
function BuyerDetailsContent({ buyer }: { buyer: BuyerData }) {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value);

  // Stats for AdminStatGrid
  const stats = [
    {
      label: 'Total Transactions',
      value: buyer.stats.totalTransactions.toLocaleString(),
      icon: FileText,
    },
    {
      label: 'Leads Won',
      value: buyer.stats.leadsWon.toLocaleString(),
      icon: Award,
      accent: 'green' as const,
    },
    {
      label: 'ZIP Codes',
      value: buyer.stats.zipCodeCount.toLocaleString(),
      icon: MapPin,
      accent: 'orange' as const,
    },
    {
      label: 'Service Configs',
      value: buyer.serviceConfigs.length.toString(),
      icon: Shield,
      accent: 'blue' as const,
    },
  ];

  // API Configuration info items
  const apiInfoItems = [
    { label: 'API URL', value: <span className="font-mono text-sm break-all">{buyer.apiUrl}</span>, icon: Globe },
    { label: 'Authentication Type', value: <span className="capitalize">{buyer.authType}</span>, icon: Shield },
    { label: 'PING Timeout', value: `${buyer.pingTimeout}ms`, icon: Clock },
    { label: 'POST Timeout', value: `${buyer.postTimeout}ms`, icon: Clock },
  ];

  // Contact info items (only include non-null values)
  const contactInfoItems = [
    buyer.contactName && { label: 'Contact Name', value: buyer.contactName, icon: User },
    buyer.contactEmail && { label: 'Contact Email', value: buyer.contactEmail, icon: Mail },
    buyer.contactPhone && { label: 'Contact Phone', value: buyer.contactPhone, icon: Phone },
    buyer.businessEmail && { label: 'Business Email', value: buyer.businessEmail, icon: Mail },
    buyer.businessPhone && { label: 'Business Phone', value: buyer.businessPhone, icon: Phone },
  ].filter(Boolean) as Array<{ label: string; value: string; icon: any }>;

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <AdminStatGrid stats={stats} />

      {/* API Configuration */}
      <AdminSection title="API Configuration">
        <AdminInfoGrid items={apiInfoItems} columns={2} />
      </AdminSection>

      {/* Contact Information */}
      {contactInfoItems.length > 0 && (
        <AdminSection title="Contact Information">
          <AdminInfoGrid items={contactInfoItems} columns={3} />
        </AdminSection>
      )}

      {/* Service Configurations */}
      <AdminSection title="Service Configurations">
        {buyer.serviceConfigs.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-500">
            No service configurations found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Service
                  </th>
                  <th className="text-left py-3 px-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Bid Range
                  </th>
                  <th className="text-left py-3 px-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Compliance
                  </th>
                  <th className="text-left py-3 px-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {buyer.serviceConfigs.map((config) => (
                  <tr
                    key={config.id}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <td className="py-3 px-2 text-sm font-medium text-gray-900">
                      {config.serviceName}
                    </td>
                    <td className="py-3 px-2 text-sm text-gray-900">
                      {formatCurrency(config.minBid)} - {formatCurrency(config.maxBid)}
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex gap-2">
                        {config.requiresTrustedForm && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                            TrustedForm
                          </span>
                        )}
                        {config.requiresJornaya && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700">
                            Jornaya
                          </span>
                        )}
                        {!config.requiresTrustedForm && !config.requiresJornaya && (
                          <span className="text-gray-400 text-xs">None</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <StatusBadge status={config.active ? 'ACTIVE' : 'INACTIVE'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminSection>

      {/* Timestamps */}
      <div className="text-sm text-gray-500 flex items-center gap-6">
        <span>Created: {new Date(buyer.createdAt).toLocaleString()}</span>
        <span>Updated: {new Date(buyer.updatedAt).toLocaleString()}</span>
      </div>
    </div>
  );
}
