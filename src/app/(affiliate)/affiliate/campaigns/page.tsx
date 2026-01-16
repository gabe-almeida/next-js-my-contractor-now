'use client';

/**
 * Affiliate Campaigns Page
 *
 * WHY: Shows affiliate their active campaigns with tracking numbers.
 *      Central hub for managing call tracking campaigns and phone numbers.
 *
 * WHEN: User navigates to /affiliate/campaigns from the sidebar.
 *
 * HOW: Fetches campaigns from API, displays with tracking number copy buttons,
 *      payout info, and today's call statistics.
 */

import { useState, useEffect, useCallback } from 'react';
import { AdminStatGrid, StatItem } from '@/components/admin/ui/AdminStatGrid';
import { AdminBadge } from '@/components/admin/ui/AdminBadge';
import { Button } from '@/components/ui/Button';
import {
  Copy,
  Check,
  Phone,
  Plus,
  AlertCircle,
  Clock,
  DollarSign,
  Loader2,
  Megaphone
} from 'lucide-react';

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  serviceType: { name: string; displayName: string };
  status: string;
  callBasePayout: number | null;
  minCallDuration: number;
  trackingNumber: {
    id: string;
    phoneNumber: string;
    phoneNumberDisplay: string | null;
    provisioningStatus: string;
    totalCalls: number;
    totalQualifiedCalls: number;
  } | null;
  todayStats: {
    calls: number;
    qualifiedCalls: number;
    earnings: number;
  };
}

/**
 * WHY: Format phone number for display.
 * WHEN: Displaying tracking numbers.
 * HOW: Use phoneNumberDisplay if available, otherwise format E.164.
 */
function formatPhoneNumber(phone: string, display?: string | null): string {
  if (display) return display;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

/**
 * WHY: Format currency for display.
 * WHEN: Displaying payout amounts.
 * HOW: Use Intl.NumberFormat for consistent USD formatting.
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}

export default function AffiliateCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [provisioningId, setProvisioningId] = useState<string | null>(null);

  /**
   * WHY: Fetch campaigns from API.
   * WHEN: Page load and after provisioning.
   * HOW: GET request with Bearer token authentication.
   */
  const fetchCampaigns = useCallback(async () => {
    const token = localStorage.getItem('affiliate_token');
    if (!token) {
      setError('Please log in to view your campaigns');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/affiliates/campaigns', {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || 'Failed to fetch campaigns');
        return;
      }

      setCampaigns(data.data);
    } catch (err) {
      setError('Failed to load campaigns. Please try again.');
      console.error('Error fetching campaigns:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  /**
   * WHY: Copy tracking number to clipboard.
   * WHEN: User clicks copy button.
   * HOW: Use Clipboard API with visual feedback.
   */
  const copyPhoneNumber = async (campaign: Campaign) => {
    if (!campaign.trackingNumber) return;

    const displayNumber = formatPhoneNumber(
      campaign.trackingNumber.phoneNumber,
      campaign.trackingNumber.phoneNumberDisplay
    );

    await navigator.clipboard.writeText(displayNumber);
    setCopiedId(campaign.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  /**
   * WHY: Provision a new tracking number for a campaign.
   * WHEN: User clicks "Get Tracking Number" button.
   * HOW: POST request to provisioning API, then refresh campaigns.
   */
  const provisionNumber = async (campaignId: string) => {
    setProvisioningId(campaignId);
    const token = localStorage.getItem('affiliate_token');

    try {
      const res = await fetch('/api/affiliates/tracking-numbers/provision', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ campaignId, tollFree: true })
      });

      const data = await res.json();

      if (!data.success) {
        alert(data.error || 'Failed to provision number');
        return;
      }

      // Refresh campaigns to show new number
      await fetchCampaigns();
    } catch (err) {
      alert('Failed to provision tracking number. Please try again.');
      console.error('Error provisioning number:', err);
    } finally {
      setProvisioningId(null);
    }
  };

  // Calculate summary stats
  const summaryStats: StatItem[] = [
    {
      label: 'Active Campaigns',
      value: campaigns.filter(c => c.status === 'APPROVED').length,
      icon: Megaphone,
      accent: 'green'
    },
    {
      label: 'Tracking Numbers',
      value: campaigns.filter(c => c.trackingNumber?.provisioningStatus === 'ACTIVE').length,
      icon: Phone,
      accent: 'blue'
    },
    {
      label: "Today's Calls",
      value: campaigns.reduce((sum, c) => sum + c.todayStats.calls, 0),
      icon: Clock,
      accent: 'purple'
    },
    {
      label: "Today's Earnings",
      value: formatCurrency(campaigns.reduce((sum, c) => sum + c.todayStats.earnings, 0)),
      icon: DollarSign,
      accent: 'green'
    }
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <AdminStatGrid stats={[]} columns={4} loading={true} />
        <div className="bg-white rounded-xl border border-gray-100 p-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 text-gray-400 animate-spin" />
            <span className="ml-3 text-gray-500">Loading campaigns...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 rounded-xl p-8 text-center">
        <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-red-800 mb-2">Error Loading Campaigns</h3>
        <p className="text-red-600">{error}</p>
        <Button className="mt-4" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <AdminStatGrid stats={summaryStats} columns={4} />

      {/* Campaign Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Your Campaigns</h2>
        </div>

        {campaigns.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
            <Megaphone className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Campaigns Yet</h3>
            <p className="text-gray-500 mb-4">
              You haven&apos;t been assigned to any campaigns yet. Contact your account manager
              to get started.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {campaigns.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                copiedId={copiedId}
                provisioningId={provisioningId}
                onCopy={copyPhoneNumber}
                onProvision={provisionNumber}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Campaign Card Component
 *
 * WHY: Displays individual campaign with tracking number and stats.
 * WHEN: Rendered for each campaign in the list.
 * HOW: Shows campaign info, payout, tracking number, and actions.
 */
interface CampaignCardProps {
  campaign: Campaign;
  copiedId: string | null;
  provisioningId: string | null;
  onCopy: (campaign: Campaign) => void;
  onProvision: (campaignId: string) => void;
}

function CampaignCard({
  campaign,
  copiedId,
  provisioningId,
  onCopy,
  onProvision
}: CampaignCardProps) {
  const hasActiveNumber = campaign.trackingNumber?.provisioningStatus === 'ACTIVE';
  const isPending = campaign.trackingNumber?.provisioningStatus === 'PENDING' ||
    campaign.trackingNumber?.provisioningStatus === 'PROVISIONING';
  const isProvisioning = provisioningId === campaign.id;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">{campaign.name}</h3>
            <p className="text-sm text-gray-500">{campaign.serviceType.displayName}</p>
          </div>
          <AdminBadge color={campaign.status === 'APPROVED' ? 'green' : 'yellow'}>
            {campaign.status}
          </AdminBadge>
        </div>
      </div>

      {/* Payout Info */}
      <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Payout</span>
          <span className="font-semibold text-emerald-600">
            {campaign.callBasePayout
              ? `${formatCurrency(campaign.callBasePayout)} per qualified call`
              : 'Revenue share'}
          </span>
        </div>
        {campaign.minCallDuration > 0 && (
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-gray-400">Min duration</span>
            <span className="text-xs text-gray-600">
              {Math.floor(campaign.minCallDuration / 60)}m {campaign.minCallDuration % 60}s
            </span>
          </div>
        )}
      </div>

      {/* Tracking Number */}
      <div className="px-5 py-4">
        {hasActiveNumber && campaign.trackingNumber ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-emerald-500" />
                <span className="font-mono text-lg text-gray-900">
                  {formatPhoneNumber(
                    campaign.trackingNumber.phoneNumber,
                    campaign.trackingNumber.phoneNumberDisplay
                  )}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onCopy(campaign)}
              >
                {copiedId === campaign.id ? (
                  <>
                    <Check className="h-4 w-4 mr-1 text-emerald-600" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-1" />
                    Copy
                  </>
                )}
              </Button>
            </div>

            {/* Today's Stats */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100">
              <div className="text-center">
                <p className="text-lg font-semibold text-gray-900">
                  {campaign.todayStats.calls}
                </p>
                <p className="text-xs text-gray-500">Calls</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-emerald-600">
                  {campaign.todayStats.qualifiedCalls}
                </p>
                <p className="text-xs text-gray-500">Qualified</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-gray-900">
                  {formatCurrency(campaign.todayStats.earnings)}
                </p>
                <p className="text-xs text-gray-500">Earned</p>
              </div>
            </div>
          </div>
        ) : isPending ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 text-gray-400 animate-spin mr-2" />
            <span className="text-gray-500">Provisioning number...</span>
          </div>
        ) : (
          <div className="text-center py-2">
            <p className="text-sm text-gray-500 mb-3">
              Get a tracking number to start receiving calls
            </p>
            <Button
              onClick={() => onProvision(campaign.id)}
              disabled={isProvisioning || campaign.status !== 'APPROVED'}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isProvisioning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Provisioning...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Get Tracking Number
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
