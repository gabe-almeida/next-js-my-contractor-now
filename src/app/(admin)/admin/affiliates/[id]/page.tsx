'use client';

/**
 * Admin Affiliate Detail Page
 *
 * WHY: Provides detailed view of individual affiliate with management actions.
 * WHEN: Admin clicks on an affiliate from the list to view details.
 * HOW: Fetches affiliate details, stats, and profile using shared admin components.
 */

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import {
  AdminDetailPageHeader,
  AdminSection,
  AdminStatGrid,
  AdminInfoGrid,
  StatusBadge
} from '@/components/admin/ui';
import {
  CheckCircle,
  XCircle,
  User,
  Mail,
  Phone as PhoneIcon,
  Globe,
  Calendar,
  DollarSign,
  Link as LinkIcon,
  MousePointerClick,
  Award,
  PhoneCall,
  CreditCard
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
  // Tracking number stats
  trackingNumbers: number;
  trackingNumbersTollFree: number;
  trackingNumbersLocal: number;
  trackingNumbersMonthlyCost: number;
  totalTrackingCalls: number;
  totalQualifiedCalls: number;
}

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
      const response = await fetch(`/api/admin/affiliates/${id}`, {
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`
        }
      });
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
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`
        }
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
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`
        }
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
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="flex items-center gap-4 mb-6">
            <div className="h-8 w-8 bg-gray-200 rounded-lg" />
            <div className="h-8 bg-gray-200 rounded w-1/3" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-20 bg-gray-200 rounded-xl" />
            ))}
          </div>
          <div className="h-64 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!affiliate) {
    return (
      <div className="space-y-6">
        <AdminDetailPageHeader
          title="Affiliate Not Found"
          backHref="/admin/affiliates"
          backLabel="Back to Affiliates"
        />

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm py-12 text-center">
          <User className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Affiliate Not Found
          </h3>
          <p className="text-sm text-gray-500 mb-6">
            The affiliate you are looking for does not exist or has been removed.
          </p>
          <Button
            onClick={() => router.push('/admin/affiliates')}
            variant="outline"
          >
            Back to Affiliates
          </Button>
        </div>
      </div>
    );
  }

  // Stats for AdminStatGrid
  const statItems = stats ? [
    {
      label: 'Total Earnings',
      value: formatCurrency(stats.totalEarnings),
      icon: DollarSign,
      accent: 'green' as const,
    },
    {
      label: 'Pending',
      value: formatCurrency(stats.pendingEarnings),
      icon: DollarSign,
      accent: 'yellow' as const,
    },
    {
      label: 'Available',
      value: formatCurrency(stats.availableBalance),
      icon: DollarSign,
      accent: 'blue' as const,
    },
    {
      label: 'Tracking #s',
      value: stats.trackingNumbers.toString(),
      icon: PhoneCall,
      accent: 'purple' as const,
    },
    {
      label: 'Twilio Cost/mo',
      value: formatCurrency(stats.trackingNumbersMonthlyCost),
      icon: CreditCard,
      accent: 'red' as const,
    },
    {
      label: 'Total Calls',
      value: stats.totalTrackingCalls.toLocaleString(),
      icon: PhoneIcon,
      accent: 'blue' as const,
    },
  ] : [];

  // Profile info items
  const profileInfoItems = [
    { label: 'Name', value: `${affiliate.firstName} ${affiliate.lastName}`, icon: User },
    { label: 'Email', value: affiliate.email, icon: Mail },
    { label: 'Phone', value: affiliate.phone || '-', icon: PhoneIcon },
    {
      label: 'Website',
      value: affiliate.website ? (
        <a href={affiliate.website} target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline">
          {affiliate.website}
        </a>
      ) : '-',
      icon: Globe
    },
    { label: 'Commission Rate', value: `${(affiliate.commissionRate * 100).toFixed(0)}%`, icon: DollarSign },
    { label: 'Joined', value: formatDate(affiliate.createdAt), icon: Calendar },
    ...(affiliate.approvedAt ? [{ label: 'Approved', value: formatDate(affiliate.approvedAt), icon: CheckCircle }] : []),
    // Tracking number breakdown if they have any
    ...(stats && stats.trackingNumbers > 0 ? [
      {
        label: 'Tracking Numbers',
        value: `${stats.trackingNumbers} (${stats.trackingNumbersTollFree} toll-free, ${stats.trackingNumbersLocal} local)`,
        icon: PhoneCall
      },
      {
        label: 'Call Stats',
        value: `${stats.totalTrackingCalls.toLocaleString()} total / ${stats.totalQualifiedCalls.toLocaleString()} qualified`,
        icon: Award
      }
    ] : [])
  ];

  // Map status to StatusBadge status type
  const mapStatus = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'ACTIVE';
      case 'PENDING': return 'PENDING';
      case 'SUSPENDED': return 'REJECTED';
      default: return 'INACTIVE';
    }
  };

  // Prepare badges for the detail header
  const badges = [
    {
      label: affiliate.status,
      variant: affiliate.status === 'ACTIVE' ? 'green' as const :
               affiliate.status === 'PENDING' ? 'yellow' as const : 'gray' as const
    }
  ];

  // Header actions
  const headerActions = (
    <div className="flex gap-2">
      {affiliate.status === 'PENDING' && (
        <Button
          onClick={handleApprove}
          disabled={actionLoading}
          className="gap-2 bg-emerald-500 hover:bg-emerald-600"
        >
          <CheckCircle className="h-4 w-4" />
          Approve
        </Button>
      )}
      {affiliate.status === 'ACTIVE' && (
        <Button
          onClick={handleSuspend}
          disabled={actionLoading}
          variant="outline"
          className="gap-2 text-red-600 border-red-300 hover:bg-red-50"
        >
          <XCircle className="h-4 w-4" />
          Suspend
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <AdminDetailPageHeader
        title={`${affiliate.firstName} ${affiliate.lastName}`}
        subtitle={affiliate.email}
        backHref="/admin/affiliates"
        backLabel="Back to Affiliates"
        badges={badges}
        onRefresh={fetchData}
        actions={headerActions}
      />

      {/* Stats Cards */}
      {stats && <AdminStatGrid stats={statItems} columns={6} />}

      {/* Profile Details */}
      <AdminSection title="Profile Details">
        <AdminInfoGrid items={profileInfoItems} columns={2} />
      </AdminSection>
    </div>
  );
}
