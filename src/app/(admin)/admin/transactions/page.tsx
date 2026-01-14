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

// Related transactions for modal (PING and POST for same lead)
interface TransactionPair {
  ping: Transaction | null;
  post: Transaction | null;
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [relatedTransactions, setRelatedTransactions] = useState<TransactionPair | null>(null);
  const [activeSection, setActiveSection] = useState<'ping' | 'post'>('ping');
  const [activeTab, setActiveTab] = useState<'request' | 'response'>('request');

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

    // Find related PING and POST transactions for the same lead
    const leadTransactions = transactions.filter(t => t.leadId === transaction.leadId);
    const pingTx = leadTransactions.find(t => t.actionType === 'PING') || null;
    const postTx = leadTransactions.find(t => t.actionType === 'POST') || null;

    setRelatedTransactions({ ping: pingTx, post: postTx });

    // Set active section based on what was clicked
    setActiveSection(transaction.actionType === 'POST' ? 'post' : 'ping');
    setActiveTab('request');
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
      {selectedTransaction && relatedTransactions && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Transaction Details
                </h3>
                <p className="text-sm text-gray-500 font-mono mt-1">
                  Lead: {selectedTransaction.leadId}
                </p>
              </div>
              <Button variant="ghost" onClick={() => {
                setSelectedTransaction(null);
                setRelatedTransactions(null);
              }}>
                <XCircle className="h-5 w-5" />
              </Button>
            </div>

            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-3">Basic Information</h4>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Lead ID:</dt>
                      <dd className="font-mono text-gray-900 text-xs">
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
                      <dt className="text-gray-500">Timestamp:</dt>
                      <dd className="text-gray-900">
                        {selectedTransaction.createdAt.toLocaleString()}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-3">Transaction Summary</h4>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <dt className="text-gray-500">PING:</dt>
                      <dd>
                        {relatedTransactions.ping ? (
                          <StatusBadge status={relatedTransactions.ping.status} />
                        ) : (
                          <span className="text-gray-400 text-xs">Not found</span>
                        )}
                      </dd>
                    </div>
                    <div className="flex justify-between items-center">
                      <dt className="text-gray-500">POST:</dt>
                      <dd>
                        {relatedTransactions.post ? (
                          <StatusBadge status={relatedTransactions.post.status} />
                        ) : (
                          <span className="text-gray-400 text-xs">Not found</span>
                        )}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>

              {/* PING Section */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-blue-50 px-4 py-3 border-b border-blue-100">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-blue-900 flex items-center gap-2">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
                        PING
                      </span>
                      {relatedTransactions.ping && (
                        <>
                          <StatusBadge status={relatedTransactions.ping.status} />
                          <span className="text-xs text-gray-500 ml-2">
                            {relatedTransactions.ping.responseTime}ms
                          </span>
                        </>
                      )}
                    </h4>
                  </div>
                </div>

                {relatedTransactions.ping ? (
                  <div className="p-4">
                    <div className="flex gap-2 mb-4">
                      <button
                        onClick={() => { setActiveSection('ping'); setActiveTab('request'); }}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                          activeSection === 'ping' && activeTab === 'request'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        Request
                      </button>
                      <button
                        onClick={() => { setActiveSection('ping'); setActiveTab('response'); }}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                          activeSection === 'ping' && activeTab === 'response'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        Response
                      </button>
                    </div>

                    {activeSection === 'ping' && activeTab === 'request' && (
                      <pre className="bg-gray-900 text-emerald-400 p-4 rounded-lg text-xs overflow-x-auto max-h-64">
                        {JSON.stringify(relatedTransactions.ping.payload, null, 2)}
                      </pre>
                    )}

                    {activeSection === 'ping' && activeTab === 'response' && (
                      <pre className="bg-gray-900 text-emerald-400 p-4 rounded-lg text-xs overflow-x-auto max-h-64">
                        {relatedTransactions.ping.response
                          ? JSON.stringify(relatedTransactions.ping.response, null, 2)
                          : relatedTransactions.ping.errorMessage
                          ? JSON.stringify({ error: relatedTransactions.ping.errorMessage }, null, 2)
                          : 'No response data'}
                      </pre>
                    )}
                  </div>
                ) : (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    No PING transaction found for this lead
                  </div>
                )}
              </div>

              {/* POST Section */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-purple-50 px-4 py-3 border-b border-purple-100">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-purple-900 flex items-center gap-2">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-purple-100 text-purple-800">
                        POST
                      </span>
                      {relatedTransactions.post && (
                        <>
                          <StatusBadge status={relatedTransactions.post.status} />
                          <span className="text-xs text-gray-500 ml-2">
                            {relatedTransactions.post.responseTime}ms
                          </span>
                        </>
                      )}
                    </h4>
                  </div>
                </div>

                {relatedTransactions.post ? (
                  <div className="p-4">
                    <div className="flex gap-2 mb-4">
                      <button
                        onClick={() => { setActiveSection('post'); setActiveTab('request'); }}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                          activeSection === 'post' && activeTab === 'request'
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        Request
                      </button>
                      <button
                        onClick={() => { setActiveSection('post'); setActiveTab('response'); }}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                          activeSection === 'post' && activeTab === 'response'
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        Response
                      </button>
                    </div>

                    {activeSection === 'post' && activeTab === 'request' && (
                      <pre className="bg-gray-900 text-emerald-400 p-4 rounded-lg text-xs overflow-x-auto max-h-64">
                        {JSON.stringify(relatedTransactions.post.payload, null, 2)}
                      </pre>
                    )}

                    {activeSection === 'post' && activeTab === 'response' && (
                      <pre className="bg-gray-900 text-emerald-400 p-4 rounded-lg text-xs overflow-x-auto max-h-64">
                        {relatedTransactions.post.response
                          ? JSON.stringify(relatedTransactions.post.response, null, 2)
                          : relatedTransactions.post.errorMessage
                          ? JSON.stringify({ error: relatedTransactions.post.errorMessage }, null, 2)
                          : 'No response data'}
                      </pre>
                    )}
                  </div>
                ) : (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    No POST transaction found for this lead
                  </div>
                )}
              </div>

              {/* Error Details (if applicable for selected transaction) */}
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
