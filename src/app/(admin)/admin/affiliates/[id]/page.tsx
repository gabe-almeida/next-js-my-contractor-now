'use client';

/**
 * Admin Affiliate Detail Page
 *
 * WHY: Provides detailed view of individual affiliate with management actions.
 * WHEN: Admin clicks on an affiliate from the list to view details.
 * HOW: Fetches affiliate details, stats, links, commissions, and withdrawals.
 */

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import {
  ArrowLeft,
  RefreshCw,
  CheckCircle,
  XCircle,
  User,
  Mail,
  Phone,
  Globe,
  Calendar,
  DollarSign,
  Link as LinkIcon,
  MousePointerClick
} from 'lucide-react';

interface Affiliate {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  website: string | null;
  status: string;
  commissionRate: number;
  createdAt: string;
  approvedAt: string | null;
  approvedBy: string | null;
}

interface Stats {
  totalEarnings: number;
  pendingEarnings: number;
  availableBalance: number;
  totalClicks: number;
  totalConversions: number;
  totalLinks: number;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  ACTIVE: 'bg-green-100 text-green-800',
  SUSPENDED: 'bg-red-100 text-red-800',
};

export default function AdminAffiliateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [affiliate, setAffiliate] = useState<Affiliate | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);

    try {
      const response = await fetch(`/api/admin/affiliates/${id}`);
      const data = await response.json();

      if (data.success) {
        // Extract affiliate data and stats from nested response
        const { stats: affiliateStats, ...affiliateData } = data.data;
        setAffiliate(affiliateData);
        setStats(affiliateStats);
      }
    } catch (error) {
      console.error('Error fetching affiliate:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleApprove = async () => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/admin/affiliates/${id}/approve`, {
        method: 'POST'
      });
      const data = await response.json();
      if (data.success) {
        fetchData();
      }
    } catch (error) {
      console.error('Error approving affiliate:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSuspend = async () => {
    if (!confirm('Are you sure you want to suspend this affiliate?')) return;

    setActionLoading(true);
    try {
      const response = await fetch(`/api/admin/affiliates/${id}/suspend`, {
        method: 'POST'
      });
      const data = await response.json();
      if (data.success) {
        fetchData();
      }
    } catch (error) {
      console.error('Error suspending affiliate:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!affiliate) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Affiliate not found</p>
        <Link href="/admin/affiliates">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Affiliates
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/admin/affiliates">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {affiliate.firstName} {affiliate.lastName}
            </h1>
            <p className="text-sm text-gray-500">{affiliate.email}</p>
          </div>
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[affiliate.status]}`}>
            {affiliate.status}
          </span>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {affiliate.status === 'PENDING' && (
            <Button
              onClick={handleApprove}
              disabled={actionLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Approve
            </Button>
          )}
          {affiliate.status === 'ACTIVE' && (
            <Button
              onClick={handleSuspend}
              disabled={actionLoading}
              variant="outline"
              className="text-red-600 border-red-300 hover:bg-red-50"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Suspend
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-green-500" />
              <div className="ml-3">
                <p className="text-xs text-gray-500">Total Earnings</p>
                <p className="text-lg font-bold">{formatCurrency(stats.totalEarnings)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-yellow-500" />
              <div className="ml-3">
                <p className="text-xs text-gray-500">Pending</p>
                <p className="text-lg font-bold">{formatCurrency(stats.pendingEarnings)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-blue-500" />
              <div className="ml-3">
                <p className="text-xs text-gray-500">Available</p>
                <p className="text-lg font-bold">{formatCurrency(stats.availableBalance)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <LinkIcon className="h-8 w-8 text-purple-500" />
              <div className="ml-3">
                <p className="text-xs text-gray-500">Links</p>
                <p className="text-lg font-bold">{stats.totalLinks}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <MousePointerClick className="h-8 w-8 text-indigo-500" />
              <div className="ml-3">
                <p className="text-xs text-gray-500">Clicks</p>
                <p className="text-lg font-bold">{stats.totalClicks.toLocaleString()}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <User className="h-8 w-8 text-emerald-500" />
              <div className="ml-3">
                <p className="text-xs text-gray-500">Conversions</p>
                <p className="text-lg font-bold">{stats.totalConversions.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Profile Details */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Profile Details</h3>
        </div>
        <div className="px-4 py-5 sm:p-6">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            <div className="flex items-center">
              <User className="h-5 w-5 text-gray-400 mr-3" />
              <div>
                <dt className="text-sm text-gray-500">Name</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {affiliate.firstName} {affiliate.lastName}
                </dd>
              </div>
            </div>
            <div className="flex items-center">
              <Mail className="h-5 w-5 text-gray-400 mr-3" />
              <div>
                <dt className="text-sm text-gray-500">Email</dt>
                <dd className="text-sm font-medium text-gray-900">{affiliate.email}</dd>
              </div>
            </div>
            <div className="flex items-center">
              <Phone className="h-5 w-5 text-gray-400 mr-3" />
              <div>
                <dt className="text-sm text-gray-500">Phone</dt>
                <dd className="text-sm font-medium text-gray-900">{affiliate.phone || '-'}</dd>
              </div>
            </div>
            <div className="flex items-center">
              <Globe className="h-5 w-5 text-gray-400 mr-3" />
              <div>
                <dt className="text-sm text-gray-500">Website</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {affiliate.website ? (
                    <a href={affiliate.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      {affiliate.website}
                    </a>
                  ) : '-'}
                </dd>
              </div>
            </div>
            <div className="flex items-center">
              <DollarSign className="h-5 w-5 text-gray-400 mr-3" />
              <div>
                <dt className="text-sm text-gray-500">Commission Rate</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {(affiliate.commissionRate * 100).toFixed(0)}%
                </dd>
              </div>
            </div>
            <div className="flex items-center">
              <Calendar className="h-5 w-5 text-gray-400 mr-3" />
              <div>
                <dt className="text-sm text-gray-500">Joined</dt>
                <dd className="text-sm font-medium text-gray-900">{formatDate(affiliate.createdAt)}</dd>
              </div>
            </div>
            {affiliate.approvedAt && (
              <div className="flex items-center">
                <CheckCircle className="h-5 w-5 text-gray-400 mr-3" />
                <div>
                  <dt className="text-sm text-gray-500">Approved</dt>
                  <dd className="text-sm font-medium text-gray-900">{formatDate(affiliate.approvedAt)}</dd>
                </div>
              </div>
            )}
          </dl>
        </div>
      </div>
    </div>
  );
}
