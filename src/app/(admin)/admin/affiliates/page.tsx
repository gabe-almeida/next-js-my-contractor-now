'use client';

/**
 * Admin Affiliates List Page
 *
 * WHY: Provides admin oversight of all affiliates in the program.
 * WHEN: Admin needs to view, approve, or manage affiliates.
 * HOW: Fetches affiliates from API, displays using AdminDataTable with actions.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import {
  AdminPageHeader,
  AdminDataTable,
  StatusBadge,
  type TableColumn,
  type RowAction,
} from '@/components/admin/ui';
import {
  RefreshCw,
  Eye,
  CheckCircle,
  XCircle,
  Users,
  DollarSign,
} from 'lucide-react';

interface Affiliate {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  commissionRate: number;
  totalEarnings: number;
  createdAt: string;
}

export default function AdminAffiliatesPage() {
  const router = useRouter();
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchAffiliates = useCallback(async () => {
    setLoading(true);

    try {
      const params = new URLSearchParams({ page: '1', limit: '200' });
      const response = await fetch(`/api/admin/affiliates?${params}`, {
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`,
        },
      });
      const data = await response.json();

      if (data.success) {
        setAffiliates(data.data || []);
        setLastRefresh(new Date());
      }
    } catch (error) {
      console.error('Error fetching affiliates:', error);
      setAffiliates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAffiliates();
  }, [fetchAffiliates]);

  const handleApprove = async (affiliate: Affiliate) => {
    try {
      const response = await fetch(`/api/admin/affiliates/${affiliate.id}/approve`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`,
        },
      });
      const data = await response.json();

      if (data.success) {
        fetchAffiliates();
      }
    } catch (error) {
      console.error('Error approving affiliate:', error);
    }
  };

  const handleSuspend = async (affiliate: Affiliate) => {
    if (!confirm('Are you sure you want to suspend this affiliate?')) return;

    try {
      const response = await fetch(`/api/admin/affiliates/${affiliate.id}/suspend`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`,
        },
      });
      const data = await response.json();

      if (data.success) {
        fetchAffiliates();
      }
    } catch (error) {
      console.error('Error suspending affiliate:', error);
    }
  };

  const handleViewDetails = (affiliate: Affiliate) => {
    router.push(`/admin/affiliates/${affiliate.id}`);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Table columns
  const columns: TableColumn<Affiliate>[] = useMemo(
    () => [
      {
        key: 'name',
        header: 'Affiliate',
        sortable: true,
        render: (affiliate) => (
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-50 rounded-lg">
              <Users className="h-4 w-4 text-orange-600" />
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-900">
                {affiliate.firstName} {affiliate.lastName}
              </div>
              <div className="text-xs text-gray-500">{affiliate.email}</div>
            </div>
          </div>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        sortable: true,
        render: (affiliate) => <StatusBadge status={affiliate.status} />,
      },
      {
        key: 'commissionRate',
        header: 'Commission',
        sortable: true,
        align: 'center',
        render: (affiliate) => (
          <span className="inline-flex items-center justify-center min-w-[48px] px-2 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-700">
            {(affiliate.commissionRate * 100).toFixed(0)}%
          </span>
        ),
      },
      {
        key: 'totalEarnings',
        header: 'Total Earnings',
        sortable: true,
        align: 'right',
        render: (affiliate) => (
          <span className="text-sm font-medium text-emerald-600">
            {formatCurrency(affiliate.totalEarnings)}
          </span>
        ),
      },
      {
        key: 'createdAt',
        header: 'Joined',
        sortable: true,
        render: (affiliate) => {
          const date = new Date(affiliate.createdAt);
          return (
            <div>
              <div className="text-sm text-gray-900">{date.toLocaleDateString()}</div>
              <div className="text-xs text-gray-400">
                {date.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
          );
        },
      },
    ],
    []
  );

  // Row actions with conditional display
  const rowActions: RowAction<Affiliate>[] = useMemo(
    () => [
      {
        key: 'view',
        icon: <Eye className="h-4 w-4" />,
        label: 'View Details',
        onClick: handleViewDetails,
      },
      {
        key: 'approve',
        icon: <CheckCircle className="h-4 w-4" />,
        label: 'Approve',
        onClick: handleApprove,
        variant: 'success',
        show: (affiliate) => affiliate.status === 'PENDING',
      },
      {
        key: 'suspend',
        icon: <XCircle className="h-4 w-4" />,
        label: 'Suspend',
        onClick: handleSuspend,
        variant: 'danger',
        show: (affiliate) => affiliate.status === 'ACTIVE',
      },
    ],
    []
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <AdminPageHeader
        title="Affiliates"
        description="Manage affiliate program members"
        lastUpdated={lastRefresh}
        actions={
          <Button
            variant="outline"
            onClick={fetchAffiliates}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />

      {/* Affiliates Table */}
      <AdminDataTable<Affiliate>
        data={affiliates}
        loading={loading}
        keyField="id"
        columns={columns}
        title="Affiliates"
        searchPlaceholder="Search by name or email..."
        searchFields={['firstName', 'lastName', 'email']}
        filters={[
          {
            key: 'status',
            label: 'All Status',
            options: [
              { value: 'PENDING', label: 'Pending' },
              { value: 'ACTIVE', label: 'Active' },
              { value: 'SUSPENDED', label: 'Suspended' },
            ],
          },
        ]}
        defaultSortField="createdAt"
        defaultSortDirection="desc"
        itemsPerPage={20}
        rowActions={rowActions}
        onRowClick={handleViewDetails}
        emptyMessage="No affiliates found."
      />
    </div>
  );
}
