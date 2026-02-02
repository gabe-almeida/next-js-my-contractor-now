'use client';

/**
 * Affiliate Payout History Page
 *
 * WHY: Affiliates need to track their payment history and current balance.
 *      Shows pending, processing, and completed payouts.
 *
 * WHEN: Accessed from affiliate dashboard or navigation menu.
 *
 * HOW: Fetches payout data from API, displays in table format with
 *      balance summary cards at the top.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import {
  AdminPageHeader,
  AdminDataTable,
  StatusBadge,
  type TableColumn,
} from '@/components/admin/ui';
import {
  RefreshCw,
  DollarSign,
  Clock,
  CheckCircle,
  Wallet,
  AlertCircle,
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface AffiliateBalance {
  availableBalance: number;
  pendingPayoutAmount: number;
  totalPaidAmount: number;
  minimumPayout: number;
  paymentMethod: string | null;
  canRequestPayout: boolean;
}

interface Payout {
  id: string;
  periodStart: string;
  periodEnd: string;
  grossAmount: number;
  adjustments: number;
  netAmount: number;
  callCount: number;
  leadCount: number;
  status: string;
  scheduledDate: string | null;
  paidAt: string | null;
  paymentReference: string | null;
  createdAt: string;
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

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function formatDateRange(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

function getStatusColor(status: string): 'yellow' | 'blue' | 'green' | 'red' | 'gray' {
  switch (status) {
    case 'PENDING':
      return 'yellow';
    case 'PROCESSING':
      return 'blue';
    case 'COMPLETED':
      return 'green';
    case 'FAILED':
      return 'red';
    default:
      return 'gray';
  }
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function AffiliatePayoutsPage() {
  const router = useRouter();
  const [balance, setBalance] = useState<AffiliateBalance | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchData = useCallback(async () => {
    setLoading(true);
    const token = localStorage.getItem('affiliate_token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const [balanceRes, payoutsRes] = await Promise.all([
        fetch('/api/affiliates/balance', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch('/api/affiliates/payouts', {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      const [balanceData, payoutsData] = await Promise.all([
        balanceRes.json(),
        payoutsRes.json()
      ]);

      if (balanceData.success) {
        setBalance(balanceData.data);
      }

      if (payoutsData.success) {
        setPayouts(payoutsData.data || []);
      }

      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error fetching payout data:', error);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Table columns
  const columns: TableColumn<Payout>[] = useMemo(
    () => [
      {
        key: 'period',
        header: 'Period',
        sortable: true,
        render: (payout) => (
          <div>
            <div className="text-sm font-medium text-gray-900">
              {formatDateRange(payout.periodStart, payout.periodEnd)}
            </div>
            <div className="text-xs text-gray-500">
              Created {formatDate(payout.createdAt)}
            </div>
          </div>
        ),
      },
      {
        key: 'earnings',
        header: 'Earnings',
        sortable: false,
        render: (payout) => (
          <div className="text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-500">{payout.callCount} calls</span>
              {payout.leadCount > 0 && (
                <span className="text-gray-500">+ {payout.leadCount} leads</span>
              )}
            </div>
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
                {payout.adjustments > 0 ? '+' : ''}{formatCurrency(payout.adjustments)} adj.
              </div>
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

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <AdminPageHeader
        title="Payout History"
        description="Track your earnings and payment history"
        lastUpdated={lastRefresh}
        actions={
          <Button
            variant="outline"
            onClick={fetchData}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Available Balance */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-100 rounded-lg">
              <Wallet className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Available Balance</p>
              <p className="text-2xl font-bold text-gray-900">
                {loading ? '...' : formatCurrency(balance?.availableBalance || 0)}
              </p>
            </div>
          </div>
        </div>

        {/* Pending Payouts */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Pending Payouts</p>
              <p className="text-2xl font-bold text-gray-900">
                {loading ? '...' : formatCurrency(balance?.pendingPayoutAmount || 0)}
              </p>
            </div>
          </div>
        </div>

        {/* Total Paid */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <CheckCircle className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Paid</p>
              <p className="text-2xl font-bold text-gray-900">
                {loading ? '...' : formatCurrency(balance?.totalPaidAmount || 0)}
              </p>
            </div>
          </div>
        </div>

        {/* Payment Method */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-lg ${balance?.paymentMethod ? 'bg-green-100' : 'bg-gray-100'}`}>
              {balance?.paymentMethod ? (
                <DollarSign className="h-6 w-6 text-green-600" />
              ) : (
                <AlertCircle className="h-6 w-6 text-gray-400" />
              )}
            </div>
            <div>
              <p className="text-sm text-gray-500">Payment Method</p>
              <p className="text-lg font-semibold text-gray-900">
                {loading ? '...' : (balance?.paymentMethod || 'Not configured')}
              </p>
              {!balance?.paymentMethod && !loading && (
                <button
                  onClick={() => router.push('/affiliate/settings')}
                  className="text-xs text-emerald-600 hover:underline"
                >
                  Set up now
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Minimum Payout Notice */}
      {balance && !balance.canRequestPayout && balance.availableBalance > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-800">
                Minimum Payout Not Met
              </p>
              <p className="text-sm text-yellow-700 mt-1">
                You need at least {formatCurrency(balance.minimumPayout)} to receive a payout.
                {!balance.paymentMethod && ' Please also configure your payment method in settings.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Payouts Table */}
      <AdminDataTable<Payout>
        data={payouts}
        loading={loading}
        keyField="id"
        columns={columns}
        title="Payment History"
        searchPlaceholder="Search payouts..."
        searchFields={['status']}
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
        emptyMessage="No payouts yet. Keep driving traffic to earn commissions!"
      />

      {/* How Payouts Work */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">How Payouts Work</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <span className="text-emerald-600 font-bold">1</span>
            </div>
            <div>
              <p className="font-medium text-gray-900">Earn Commissions</p>
              <p className="text-sm text-gray-500">
                Generate qualified calls and leads to earn commissions.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <span className="text-emerald-600 font-bold">2</span>
            </div>
            <div>
              <p className="font-medium text-gray-900">Weekly Calculation</p>
              <p className="text-sm text-gray-500">
                Payouts are calculated every Monday for the previous week.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <span className="text-emerald-600 font-bold">3</span>
            </div>
            <div>
              <p className="font-medium text-gray-900">Receive Payment</p>
              <p className="text-sm text-gray-500">
                Approved payouts are sent via your configured payment method.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
