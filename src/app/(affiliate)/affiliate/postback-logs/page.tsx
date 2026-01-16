'use client';

/**
 * Postback Logs Page
 *
 * WHY: Allows affiliates to view their postback delivery history
 *      for debugging and verifying integrations work correctly.
 *
 * WHEN: Affiliate wants to check if postbacks are being delivered.
 *
 * HOW: Fetches postback logs from API with filtering and pagination.
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  ExternalLink,
  Filter
} from 'lucide-react';

interface PostbackLog {
  id: string;
  timestamp: string;
  success: boolean;
  attempt: number;
  statusCode?: number;
  error?: string;
  retryScheduled?: boolean;
  call: {
    id: string;
    callSid: string;
    status: string;
    campaign?: string;
    payout: number | null;
    createdAt: string;
  } | null;
}

interface Summary {
  total: number;
  successful: number;
  failed: number;
  successRate: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export default function PostbackLogsPage() {
  const [logs, setLogs] = useState<PostbackLog[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    fetchLogs();
  }, [page, statusFilter]);

  const fetchLogs = async () => {
    const token = localStorage.getItem('affiliate_token');
    if (!token) return;

    setLoading(true);

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20'
      });

      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }

      const response = await fetch(`/api/affiliates/postback/logs?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();

      if (data.success) {
        setLogs(data.data.logs);
        setSummary(data.data.summary);
        setPagination(data.data.pagination);
      }
    } catch (error) {
      console.error('Error fetching postback logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Postback Logs</h1>
          <p className="mt-1 text-sm text-gray-500">
            View your postback delivery history
          </p>
        </div>
        <Button
          onClick={fetchLogs}
          variant="outline"
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-500">Total Postbacks</div>
            <div className="text-2xl font-bold">{summary.total}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-500">Successful</div>
            <div className="text-2xl font-bold text-green-600">
              {summary.successful}
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-500">Failed</div>
            <div className="text-2xl font-bold text-red-600">
              {summary.failed}
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-500">Success Rate</div>
            <div className="text-2xl font-bold">{summary.successRate}%</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Status:</span>
          </div>
          <div className="flex gap-2">
            {['all', 'success', 'failed'].map(status => (
              <button
                key={status}
                onClick={() => {
                  setStatusFilter(status);
                  setPage(1);
                }}
                className={`px-3 py-1 rounded-full text-sm ${
                  statusFilter === status
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              No postback logs
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Postback logs will appear here when calls qualify for payout.
            </p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Timestamp
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Call
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Campaign
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payout
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(log.timestamp)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {log.success ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Success
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        <XCircle className="h-3 w-3 mr-1" />
                        Failed
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {log.call ? (
                      <a
                        href={`/affiliate/calls/${log.call.id}`}
                        className="text-sm text-emerald-600 hover:text-emerald-700 flex items-center"
                      >
                        {log.call.callSid.slice(0, 12)}...
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </a>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {log.call?.campaign || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {log.call?.payout != null
                      ? `$${log.call.payout.toFixed(2)}`
                      : '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    <div className="max-w-xs">
                      {log.statusCode && (
                        <span className="text-xs text-gray-400 mr-2">
                          HTTP {log.statusCode}
                        </span>
                      )}
                      {log.attempt > 1 && (
                        <span className="text-xs bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded mr-2">
                          Attempt {log.attempt}
                        </span>
                      )}
                      {log.error && (
                        <span className="text-xs text-red-600" title={log.error}>
                          {log.error.slice(0, 50)}
                          {log.error.length > 50 && '...'}
                        </span>
                      )}
                      {log.retryScheduled && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                          Retry scheduled
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <Button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                variant="outline"
                size="sm"
              >
                Previous
              </Button>
              <Button
                onClick={() => setPage(p => p + 1)}
                disabled={!pagination.hasMore}
                variant="outline"
                size="sm"
              >
                Next
              </Button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing page <span className="font-medium">{pagination.page}</span> of{' '}
                  <span className="font-medium">{pagination.totalPages}</span>
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  variant="outline"
                  size="sm"
                >
                  Previous
                </Button>
                <Button
                  onClick={() => setPage(p => p + 1)}
                  disabled={!pagination.hasMore}
                  variant="outline"
                  size="sm"
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Help Text */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex">
          <AlertCircle className="h-5 w-5 text-blue-400 mr-3" />
          <div>
            <h4 className="text-sm font-medium text-blue-800">
              About Postback Delivery
            </h4>
            <p className="mt-1 text-sm text-blue-700">
              Postbacks are sent when your calls qualify for payout. If delivery fails,
              we automatically retry up to 3 times with increasing delays.
              Check your postback URL configuration in{' '}
              <a href="/affiliate/settings" className="underline">Settings</a> if you're
              seeing consistent failures.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
