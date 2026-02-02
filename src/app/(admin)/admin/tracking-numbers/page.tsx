'use client';

/**
 * Admin Tracking Numbers Page
 *
 * WHY: Shows all tracking numbers across affiliates with cost and usage info.
 * WHEN: Admin navigates to /admin/tracking-numbers.
 * HOW: Fetches from API, displays in table with filtering and stats.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AdminPageHeader, AdminSection, AdminStatGrid } from '@/components/admin/ui';
import { Button } from '@/components/ui/Button';
import {
  RefreshCw,
  AlertCircle,
  Phone,
  DollarSign,
  AlertTriangle,
  User,
  ChevronRight,
  Copy,
  Check
} from 'lucide-react';

interface TrackingNumber {
  id: string;
  phoneNumber: string;
  phoneNumberDisplay: string | null;
  provisioningStatus: string;
  isTollFree: boolean;
  monthlyCost: number;
  totalCalls: number;
  totalQualifiedCalls: number;
  recentCalls: number;
  isInactive: boolean;
  createdAt: string;
  affiliate: { id: string; name: string; email: string } | null;
  campaign: { id: string; name: string } | null;
  serviceType: { id: string; name: string } | null;
}

interface Summary {
  totalNumbers: number;
  tollFreeCount: number;
  localCount: number;
  totalMonthlyCost: number;
  inactiveNumbers: number;
  inactiveMonthlyCost: number;
  potentialSavings: number;
  totalCalls: number;
  totalQualifiedCalls: number;
}

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

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-700',
    PENDING: 'bg-yellow-100 text-yellow-700',
    PROVISIONING: 'bg-blue-100 text-blue-700',
    RELEASED: 'bg-gray-100 text-gray-700',
    FAILED: 'bg-red-100 text-red-700'
  };
  return colors[status] || 'bg-gray-100 text-gray-700';
}

export default function AdminTrackingNumbersPage() {
  const router = useRouter();
  const [trackingNumbers, setTrackingNumbers] = useState<TrackingNumber[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/tracking-numbers', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token') || ''}`
        }
      });

      const data = await response.json();

      if (data.success) {
        setTrackingNumbers(data.data.trackingNumbers);
        setSummary(data.data.summary);
      } else {
        setError(data.error || 'Failed to load tracking numbers');
      }
    } catch (err) {
      setError('Failed to load tracking numbers');
      console.error('Error fetching tracking numbers:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const copyPhoneNumber = async (tn: TrackingNumber) => {
    const displayNumber = formatPhoneNumber(tn.phoneNumber, tn.phoneNumberDisplay);
    await navigator.clipboard.writeText(displayNumber);
    setCopiedId(tn.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filter tracking numbers
  const filteredNumbers = trackingNumbers.filter(tn => {
    if (filter === 'active') return tn.provisioningStatus === 'ACTIVE' && !tn.isInactive;
    if (filter === 'inactive') return tn.isInactive;
    return true;
  });

  // Stats for grid
  const statItems = summary ? [
    {
      label: 'Active Numbers',
      value: summary.totalNumbers.toString(),
      icon: Phone,
      accent: 'blue' as const
    },
    {
      label: 'Monthly Cost',
      value: formatCurrency(summary.totalMonthlyCost),
      icon: DollarSign,
      accent: 'green' as const
    },
    {
      label: 'Inactive (30d)',
      value: summary.inactiveNumbers.toString(),
      icon: AlertTriangle,
      accent: 'yellow' as const
    },
    {
      label: 'Potential Savings',
      value: formatCurrency(summary.potentialSavings),
      icon: DollarSign,
      accent: 'red' as const
    }
  ] : [];

  if (loading) {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          title="Tracking Numbers"
          description="Manage all tracking numbers and Twilio costs"
        />
        <div className="animate-pulse space-y-4">
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded-xl" />
            ))}
          </div>
          <div className="h-96 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          title="Tracking Numbers"
          description="Manage all tracking numbers and Twilio costs"
        />
        <AdminSection noPadding>
          <div className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-red-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Data</h3>
            <p className="text-gray-500 mb-4">{error}</p>
            <Button onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </AdminSection>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Tracking Numbers"
        description="Manage all tracking numbers and Twilio costs"
        actions={
          <div className="flex gap-2">
            <Link href="/admin/tracking-numbers/costs">
              <Button variant="outline">
                <DollarSign className="h-4 w-4 mr-2" />
                Cost Dashboard
              </Button>
            </Link>
            <Button onClick={fetchData} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        }
      />

      {/* Stats Grid */}
      {summary && <AdminStatGrid stats={statItems} columns={4} />}

      {/* Filter Tabs */}
      <div className="flex gap-2">
        <Button
          variant={filter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('all')}
        >
          All ({trackingNumbers.length})
        </Button>
        <Button
          variant={filter === 'active' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('active')}
        >
          Active ({trackingNumbers.filter(tn => tn.provisioningStatus === 'ACTIVE' && !tn.isInactive).length})
        </Button>
        <Button
          variant={filter === 'inactive' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('inactive')}
          className={filter === 'inactive' ? 'bg-yellow-500 hover:bg-yellow-600' : ''}
        >
          <AlertTriangle className="h-4 w-4 mr-1" />
          Inactive ({summary?.inactiveNumbers || 0})
        </Button>
      </div>

      {/* Tracking Numbers Table */}
      <AdminSection noPadding>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone Number</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Affiliate</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Campaign</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Monthly Cost</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Calls</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Last 30d</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredNumbers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                    No tracking numbers found
                  </td>
                </tr>
              ) : (
                filteredNumbers.map((tn) => (
                  <tr
                    key={tn.id}
                    className={`hover:bg-gray-50 ${tn.isInactive ? 'bg-yellow-50' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">
                          {formatPhoneNumber(tn.phoneNumber, tn.phoneNumberDisplay)}
                        </span>
                        <button
                          onClick={() => copyPhoneNumber(tn)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          {copiedId === tn.id ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </button>
                        {tn.isTollFree && (
                          <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                            Toll-Free
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {tn.affiliate ? (
                        <Link
                          href={`/admin/affiliates/${tn.affiliate.id}`}
                          className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                        >
                          <User className="h-3 w-3" />
                          {tn.affiliate.name}
                        </Link>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {tn.campaign?.name || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(tn.provisioningStatus)}`}>
                          {tn.provisioningStatus}
                        </span>
                        {tn.isInactive && (
                          <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Inactive
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                      {formatCurrency(tn.monthlyCost)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-600">
                      {tn.totalCalls.toLocaleString()}
                      <span className="text-gray-400"> / {tn.totalQualifiedCalls.toLocaleString()}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-sm font-medium ${tn.recentCalls === 0 ? 'text-red-500' : 'text-green-600'}`}>
                        {tn.recentCalls.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatDate(tn.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/affiliates/${tn.affiliate?.id}`}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </AdminSection>

      {/* Legend */}
      <div className="text-xs text-gray-500 flex items-center gap-4">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-yellow-100 border border-yellow-300" />
          Inactive = No calls in last 30 days
        </span>
        <span>Total Calls = All time / Qualified</span>
      </div>
    </div>
  );
}
