'use client';

/**
 * Transactions Admin Page
 *
 * WHY: Monitor all buyer API transactions and responses
 * WHEN: Admin needs to view transaction logs and debug issues
 * HOW: Fetches from /api/admin/transactions, displays with real-time updates
 */

import { useState, useEffect, useMemo } from 'react';
import { Transaction } from '@/types';
import { TransactionActionType, TransactionStatus } from '@/types/database';
import { Button } from '@/components/ui/Button';
import {
  AdminPageHeader,
  AdminCard,
  AdminDataTable,
  StatusBadge,
  type TableColumn,
  type RowAction,
} from '@/components/admin/ui';
import {
  Eye,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  ArrowUpDown,
  Zap,
  Activity,
} from 'lucide-react';
import { useRealTimeUpdates } from '@/hooks/useRealTimeUpdates';

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  // Real-time updates
  const { updates, isConnected } = useRealTimeUpdates({ enabled: true });

  // Fetch real transactions from API
  const fetchTransactions = async () => {
    setLoading(true);

    try {
      const params = new URLSearchParams({
        limit: '200',
        page: '1',
      });

      const response = await fetch(`/api/admin/transactions?${params}`, {
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch transactions');
      }

      const data = await response.json();
      const fetchedTransactions: Transaction[] = (data.data?.transactions || []).map(
        (tx: any) => ({
          id: tx.id,
          leadId: tx.leadId,
          buyerId: tx.buyerId,
          buyerName: tx.buyerName,
          buyerDisplayName: tx.buyerDisplayName,
          actionType: tx.actionType as TransactionActionType,
          payload: {
            zipCode: tx.leadZipCode,
            serviceType: tx.serviceDisplayName || tx.serviceType,
          },
          response:
            tx.status === 'SUCCESS'
              ? {
                  success: true,
                  bidAmount: tx.bidAmount,
                  message: 'Lead processed successfully',
                }
              : tx.status === 'FAILED'
              ? {
                  success: false,
                  error: tx.errorMessage || 'Transaction failed',
                  code: 'ERROR',
                }
              : undefined,
          status: tx.status as TransactionStatus,
          responseTime: tx.responseTime || 0,
          errorMessage: tx.errorMessage,
          complianceIncluded: tx.complianceIncluded,
          trustedFormPresent: tx.trustedFormPresent,
          jornayaPresent: tx.jornayaPresent,
          createdAt: new Date(tx.createdAt),
        })
      );

      setTransactions(fetchedTransactions);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error fetching transactions:', error);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const handleViewDetails = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
  };

  const handleExport = () => {
    const headers = [
      'ID',
      'Timestamp',
      'Action',
      'Buyer',
      'Lead ID',
      'Status',
      'Response Time',
    ];
    const rows = transactions.map((tx) => [
      tx.id,
      tx.createdAt.toISOString(),
      tx.actionType,
      tx.buyerDisplayName || tx.buyerName || tx.buyerId,
      tx.leadId,
      tx.status,
      `${tx.responseTime}ms`,
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Calculate summary stats
  const stats = useMemo(() => {
    const total = transactions.length;
    const successful = transactions.filter(
      (t) => t.status === TransactionStatus.SUCCESS
    ).length;
    const failed = transactions.filter(
      (t) => t.status === TransactionStatus.FAILED
    ).length;
    const avgResponseTime =
      transactions.reduce((sum, t) => sum + (t.responseTime ?? 0), 0) / total || 0;

    return {
      total,
      successful,
      failed,
      avgResponseTime: Math.round(avgResponseTime),
    };
  }, [transactions]);

  // Table columns
  const columns: TableColumn<Transaction>[] = useMemo(
    () => [
      {
        key: 'createdAt',
        header: 'Timestamp',
        sortable: true,
        render: (tx) => (
          <div>
            <div className="text-sm font-medium text-gray-900">
              {tx.createdAt.toLocaleDateString()}
            </div>
            <div className="text-xs text-gray-400">
              {tx.createdAt.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </div>
          </div>
        ),
      },
      {
        key: 'actionType',
        header: 'Action',
        sortable: true,
        render: (tx) => (
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${
              tx.actionType === 'PING'
                ? 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20'
                : 'bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-600/20'
            }`}
          >
            {tx.actionType}
          </span>
        ),
      },
      {
        key: 'buyerId',
        header: 'Buyer',
        sortable: true,
        render: (tx) => (
          <span className="text-sm font-medium text-gray-900">
            {tx.buyerDisplayName || tx.buyerName || tx.buyerId}
          </span>
        ),
      },
      {
        key: 'leadId',
        header: 'Lead ID',
        render: (tx) => (
          <span className="text-xs font-mono text-gray-600" title={tx.leadId}>
            {tx.leadId.substring(0, 8)}...
          </span>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        sortable: true,
        render: (tx) => <StatusBadge status={tx.status} />,
      },
      {
        key: 'responseTime',
        header: 'Response',
        sortable: true,
        align: 'right',
        render: (tx) => {
          const time = tx.responseTime ?? 0;
          const color =
            time < 1000
              ? 'text-emerald-600'
              : time < 3000
              ? 'text-amber-600'
              : 'text-red-600';
          return <span className={`text-sm font-semibold ${color}`}>{time}ms</span>;
        },
      },
    ],
    []
  );

  // Row actions
  const rowActions: RowAction<Transaction>[] = useMemo(
    () => [
      {
        key: 'view',
        icon: <Eye className="h-4 w-4" />,
        label: 'View Details',
        onClick: handleViewDetails,
      },
    ],
    []
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <AdminPageHeader
        title="Transaction Log"
        description="Monitor all buyer API transactions and responses"
        lastUpdated={lastRefresh}
        actions={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg">
              <div
                className={`h-2 w-2 rounded-full ${
                  isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                }`}
              ></div>
              <span className="text-xs text-gray-600">
                {isConnected ? 'Live' : 'Disconnected'}
              </span>
            </div>
            <Button
              variant="outline"
              onClick={fetchTransactions}
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <AdminCard
          title="Total Transactions"
          value={stats.total}
          icon={ArrowUpDown}
          accent="gray"
        />
        <AdminCard
          title="Successful"
          value={stats.successful}
          icon={CheckCircle}
          accent="green"
        />
        <AdminCard
          title="Failed"
          value={stats.failed}
          icon={XCircle}
          accent="red"
        />
        <AdminCard
          title="Avg Response"
          value={`${stats.avgResponseTime}ms`}
          icon={Zap}
          accent="orange"
        />
      </div>

      {/* Transactions Table */}
      <AdminDataTable<Transaction>
        data={transactions}
        loading={loading}
        keyField="id"
        columns={columns}
        title="Transactions"
        searchPlaceholder="Search by ID, lead ID, or buyer..."
        searchFields={['id', 'leadId', 'buyerId', 'buyerName', 'buyerDisplayName']}
        filters={[
          {
            key: 'status',
            label: 'All Status',
            options: [
              { value: 'SUCCESS', label: 'Success' },
              { value: 'FAILED', label: 'Failed' },
              { value: 'PENDING', label: 'Pending' },
              { value: 'TIMEOUT', label: 'Timeout' },
              { value: 'INFO', label: 'Info' },
            ],
          },
          {
            key: 'actionType',
            label: 'All Actions',
            options: [
              { value: 'PING', label: 'Ping' },
              { value: 'POST', label: 'Post' },
            ],
          },
        ]}
        defaultSortField="createdAt"
        defaultSortDirection="desc"
        itemsPerPage={20}
        rowActions={rowActions}
        onExport={handleExport}
        emptyMessage="No transactions found."
      />

      {/* Transaction Details Modal */}
      {selectedTransaction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Transaction Details
                </h3>
                <p className="text-sm text-gray-500 font-mono mt-1">
                  {selectedTransaction.id}
                </p>
              </div>
              <Button variant="ghost" onClick={() => setSelectedTransaction(null)}>
                <XCircle className="h-5 w-5" />
              </Button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-3">Basic Information</h4>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Lead ID:</dt>
                      <dd className="font-mono text-gray-900">
                        {selectedTransaction.leadId}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Buyer:</dt>
                      <dd className="text-gray-900">
                        {selectedTransaction.buyerDisplayName ||
                          selectedTransaction.buyerName ||
                          selectedTransaction.buyerId}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Action:</dt>
                      <dd>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            selectedTransaction.actionType === 'PING'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-purple-100 text-purple-800'
                          }`}
                        >
                          {selectedTransaction.actionType}
                        </span>
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-3">Performance</h4>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Status:</dt>
                      <dd>
                        <StatusBadge status={selectedTransaction.status} />
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Response Time:</dt>
                      <dd
                        className={`font-semibold ${
                          (selectedTransaction.responseTime ?? 0) < 1000
                            ? 'text-emerald-600'
                            : (selectedTransaction.responseTime ?? 0) < 3000
                            ? 'text-amber-600'
                            : 'text-red-600'
                        }`}
                      >
                        {selectedTransaction.responseTime}ms
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Timestamp:</dt>
                      <dd className="text-gray-900">
                        {selectedTransaction.createdAt.toLocaleString()}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-2">Request Payload</h4>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
                  {JSON.stringify(selectedTransaction.payload, null, 2)}
                </pre>
              </div>

              {selectedTransaction.response && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Response Data</h4>
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
                    {JSON.stringify(selectedTransaction.response, null, 2)}
                  </pre>
                </div>
              )}

              {selectedTransaction.errorMessage && (
                <div>
                  <h4 className="font-medium text-red-900 mb-2">Error Details</h4>
                  <div className="bg-red-50 border border-red-200 p-4 rounded-lg text-sm text-red-700">
                    {selectedTransaction.errorMessage}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
