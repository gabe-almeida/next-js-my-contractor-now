'use client';

/**
 * Admin Payouts Management Page
 *
 * WHY: Admins need to review, approve, and manage affiliate payouts.
 *      Provides workflow for approving/rejecting payouts and exporting for payment.
 *
 * WHEN: Admin clicks "Payouts" in navigation or needs to process affiliate payments.
 *
 * HOW: Fetches pending payouts, allows bulk actions, and provides export functionality.
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
  CheckCircle,
  XCircle,
  Download,
  DollarSign,
  Users,
  Clock,
  AlertCircle,
  Play,
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface Payout {
  id: string;
  affiliateId: string;
  affiliateName: string;
  affiliateEmail: string;
  periodStart: string;
  periodEnd: string;
  grossAmount: number;
  adjustments: number;
  netAmount: number;
  callCount: number;
  leadCount: number;
  status: string;
  paymentMethod: string | null;
  scheduledDate: string | null;
  paidAt: string | null;
  createdAt: string;
}

interface PayoutStats {
  pendingCount: number;
  pendingAmount: number;
  processingCount: number;
  processingAmount: number;
  completedThisMonth: number;
  completedAmountThisMonth: number;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}

function formatDateRange(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function AdminPayoutsPage() {
  const router = useRouter();
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [stats, setStats] = useState<PayoutStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [selectedPayouts, setSelectedPayouts] = useState<string[]>([]);
  const [processingAction, setProcessingAction] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [payoutsRes, statsRes] = await Promise.all([
        fetch('/api/admin/payouts', {
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`
          }
        }),
        fetch('/api/admin/payouts/stats', {
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`
          }
        })
      ]);

      const [payoutsData, statsData] = await Promise.all([
        payoutsRes.json(),
        statsRes.json()
      ]);

      if (payoutsData.success) {
        setPayouts(payoutsData.data || []);
      }

      if (statsData.success) {
        setStats(statsData.data);
      }

      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error fetching payout data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApprove = async (payout: Payout) => {
    if (!confirm(`Approve payout of ${formatCurrency(payout.netAmount)} for ${payout.affiliateName}?`)) {
      return;
    }

    setProcessingAction(true);
    try {
      const response = await fetch(`/api/admin/payouts/${payout.id}/approve`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`
        }
      });
      const data = await response.json();

      if (data.success) {
        fetchData();
      } else {
        alert(data.error || 'Failed to approve payout');
      }
    } catch (error) {
      console.error('Error approving payout:', error);
      alert('Failed to approve payout');
    } finally {
      setProcessingAction(false);
    }
  };

  const handleReject = async (payout: Payout) => {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;

    setProcessingAction(true);
    try {
      const response = await fetch(`/api/admin/payouts/${payout.id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`
        },
        body: JSON.stringify({ reason })
      });
      const data = await response.json();

      if (data.success) {
        fetchData();
      } else {
        alert(data.error || 'Failed to reject payout');
      }
    } catch (error) {
      console.error('Error rejecting payout:', error);
      alert('Failed to reject payout');
    } finally {
      setProcessingAction(false);
    }
  };

  const handleMarkPaid = async (payout: Payout) => {
    const reference = prompt('Enter payment reference (optional):');

    setProcessingAction(true);
    try {
      const response = await fetch(`/api/admin/payouts/${payout.id}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`
        },
        body: JSON.stringify({ paymentReference: reference })
      });
      const data = await response.json();

      if (data.success) {
        fetchData();
      } else {
        alert(data.error || 'Failed to mark payout as paid');
      }
    } catch (error) {
      console.error('Error completing payout:', error);
      alert('Failed to mark payout as paid');
    } finally {
      setProcessingAction(false);
    }
  };

  const handleExport = async () => {
    try {
      const response = await fetch('/api/admin/payouts/export?status=PROCESSING', {
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`
        }
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payouts-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error exporting payouts:', error);
      alert('Failed to export payouts');
    }
  };

  const handleRunCalculation = async () => {
    if (!confirm('Run weekly payout calculation? This will create pending payouts for all eligible affiliates.')) {
      return;
    }

    setProcessingAction(true);
    try {
      const response = await fetch('/api/admin/payouts/calculate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`
        }
      });
      const data = await response.json();

      if (data.success) {
        alert(`Created ${data.data.payoutsCreated} payouts totaling ${formatCurrency(data.data.totalPayoutAmount)}`);
        fetchData();
      } else {
        alert(data.error || 'Failed to run payout calculation');
      }
    } catch (error) {
      console.error('Error running calculation:', error);
      alert('Failed to run payout calculation');
    } finally {
      setProcessingAction(false);
    }
  };

  // Table columns
  const columns: TableColumn<Payout>[] = useMemo(
    () => [
      {
        key: 'affiliate',
        header: 'Affiliate',
        sortable: true,
        render: (payout) => (
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-50 rounded-lg">
              <Users className="h-4 w-4 text-orange-600" />
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-900">
                {payout.affiliateName}
              </div>
              <div className="text-xs text-gray-500">{payout.affiliateEmail}</div>
            </div>
          </div>
        ),
      },
      {
        key: 'period',
        header: 'Period',
        sortable: true,
        render: (payout) => (
          <div className="text-sm text-gray-900">
            {formatDateRange(payout.periodStart, payout.periodEnd)}
          </div>
        ),
      },
      {
        key: 'earnings',
        header: 'Earnings',
        sortable: false,
        render: (payout) => (
          <div className="text-sm">
            <span className="text-gray-500">
              {payout.callCount} calls
              {payout.leadCount > 0 && ` + ${payout.leadCount} leads`}
            </span>
          </div>
        ),
      },
      {
        key: 'netAmount',
        header: 'Amount',
        sortable: true,
        align: 'right',
        render: (payout) => (
          <div>
            <div className="text-sm font-semibold text-emerald-600">
              {formatCurrency(payout.netAmount)}
            </div>
            {payout.adjustments !== 0 && (
              <div className="text-xs text-gray-500">
                Gross: {formatCurrency(payout.grossAmount)}
              </div>
            )}
          </div>
        ),
      },
      {
        key: 'paymentMethod',
        header: 'Payment',
        sortable: true,
        render: (payout) => (
          <div className="text-sm">
            {payout.paymentMethod ? (
              <span className="capitalize">{payout.paymentMethod}</span>
            ) : (
              <span className="text-red-500">Not configured</span>
            )}
          </div>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        sortable: true,
        render: (payout) => (
          <div>
            <StatusBadge status={payout.status} />
            {payout.paidAt && (
              <div className="text-xs text-gray-500 mt-1">
                Paid {formatDate(payout.paidAt)}
              </div>
            )}
          </div>
        ),
      },
    ],
    []
  );

  // Row actions
  const rowActions: RowAction<Payout>[] = useMemo(
    () => [
      {
        key: 'approve',
        icon: <CheckCircle className="h-4 w-4" />,
        label: 'Approve',
        onClick: handleApprove,
        variant: 'success',
        show: (payout) => payout.status === 'PENDING',
      },
      {
        key: 'reject',
        icon: <XCircle className="h-4 w-4" />,
        label: 'Reject',
        onClick: handleReject,
        variant: 'danger',
        show: (payout) => payout.status === 'PENDING',
      },
      {
        key: 'markPaid',
        icon: <DollarSign className="h-4 w-4" />,
        label: 'Mark Paid',
        onClick: handleMarkPaid,
        variant: 'success',
        show: (payout) => payout.status === 'PROCESSING',
      },
    ],
    []
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <AdminPageHeader
        title="Payout Management"
        description="Review and process affiliate payouts"
        lastUpdated={lastRefresh}
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleRunCalculation}
              disabled={loading || processingAction}
              className="gap-2"
            >
              <Play className="h-4 w-4" />
              Run Calculation
            </Button>
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={loading || processingAction}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button
              variant="outline"
              onClick={fetchData}
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Pending Approval</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats?.pendingCount || 0}
              </p>
              <p className="text-sm text-yellow-600">
                {formatCurrency(stats?.pendingAmount || 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <AlertCircle className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Ready to Pay</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats?.processingCount || 0}
              </p>
              <p className="text-sm text-blue-600">
                {formatCurrency(stats?.processingAmount || 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Completed This Month</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats?.completedThisMonth || 0}
              </p>
              <p className="text-sm text-green-600">
                {formatCurrency(stats?.completedAmountThisMonth || 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-lg">
              <DollarSign className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Outstanding</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(
                  (stats?.pendingAmount || 0) + (stats?.processingAmount || 0)
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Payouts Table */}
      <AdminDataTable<Payout>
        data={payouts}
        loading={loading}
        keyField="id"
        columns={columns}
        title="Payouts"
        searchPlaceholder="Search by affiliate name or email..."
        searchFields={['affiliateName', 'affiliateEmail']}
        filters={[
          {
            key: 'status',
            label: 'All Status',
            options: [
              { value: 'PENDING', label: 'Pending' },
              { value: 'PROCESSING', label: 'Processing' },
              { value: 'COMPLETED', label: 'Completed' },
              { value: 'FAILED', label: 'Failed' },
            ],
          },
        ]}
        defaultSortField="createdAt"
        defaultSortDirection="desc"
        itemsPerPage={20}
        rowActions={rowActions}
        emptyMessage="No payouts found. Run the payout calculation to generate pending payouts."
      />
    </div>
  );
}
