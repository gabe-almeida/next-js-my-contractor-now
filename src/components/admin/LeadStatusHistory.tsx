'use client';

/**
 * Lead Status History Component
 *
 * WHY: Displays a timeline of all status/disposition changes for a lead,
 *      showing who made changes and when - essential for audit trail visibility.
 *
 * WHEN: Used in the Lead Detail view to show administrators the complete
 *       history of a lead's lifecycle.
 *
 * HOW: Fetches history from API and renders as a timeline with icons/badges.
 */

import { useState, useEffect } from 'react';
import {
  Clock,
  User,
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw,
  DollarSign,
  ArrowRight
} from 'lucide-react';

interface HistoryEntry {
  id: string;
  timestamp: string;
  oldStatus: string | null;
  newStatus: string;
  oldDisposition: string | null;
  newDisposition: string | null;
  reason: string | null;
  creditAmount: number | null;
  changeSource: 'SYSTEM' | 'ADMIN' | 'WEBHOOK';
  changedBy: {
    id: string | null;
    name: string;
    email: string | null;
  };
  ipAddress: string | null;
}

interface LeadStatusHistoryProps {
  leadId: string;
  onRefresh?: () => void;
}

const STATUS_ICONS: Record<string, typeof CheckCircle> = {
  PENDING: Clock,
  PROCESSING: RefreshCw,
  AUCTIONED: CheckCircle,
  SOLD: CheckCircle,
  REJECTED: XCircle,
  EXPIRED: AlertCircle,
  SCRUBBED: XCircle,
  DUPLICATE: AlertCircle
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'text-yellow-500',
  PROCESSING: 'text-blue-500',
  AUCTIONED: 'text-green-500',
  SOLD: 'text-green-600',
  REJECTED: 'text-red-500',
  EXPIRED: 'text-gray-500',
  SCRUBBED: 'text-red-600',
  DUPLICATE: 'text-orange-500'
};

const DISPOSITION_COLORS: Record<string, string> = {
  NEW: 'bg-gray-100 text-gray-700',
  DELIVERED: 'bg-green-100 text-green-700',
  RETURNED: 'bg-yellow-100 text-yellow-700',
  DISPUTED: 'bg-orange-100 text-orange-700',
  CREDITED: 'bg-blue-100 text-blue-700',
  WRITTEN_OFF: 'bg-red-100 text-red-700'
};

export function LeadStatusHistory({ leadId, onRefresh }: LeadStatusHistoryProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/leads/${leadId}/history`, {
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch history');
      }

      const data = await response.json();
      setHistory(data.data?.history || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [leadId]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    };
  };

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse flex space-x-4">
            <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center">
        <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
        <p className="text-red-600">{error}</p>
        <button
          onClick={fetchHistory}
          className="mt-2 text-blue-600 hover:underline text-sm"
        >
          Try again
        </button>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No status history available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Status History</h3>
        <button
          onClick={() => { fetchHistory(); onRefresh?.(); }}
          className="text-sm text-blue-600 hover:underline flex items-center space-x-1"
        >
          <RefreshCw className="h-3 w-3" />
          <span>Refresh</span>
        </button>
      </div>

      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>

        {/* Timeline entries */}
        <div className="space-y-6">
          {history.map((entry, index) => {
            const StatusIcon = STATUS_ICONS[entry.newStatus] || Clock;
            const statusColor = STATUS_COLORS[entry.newStatus] || 'text-gray-500';
            const { date, time } = formatDate(entry.timestamp);

            return (
              <div key={entry.id} className="relative pl-10">
                {/* Icon */}
                <div className={`absolute left-0 w-8 h-8 rounded-full bg-white border-2 flex items-center justify-center ${statusColor.replace('text-', 'border-')}`}>
                  <StatusIcon className={`h-4 w-4 ${statusColor}`} />
                </div>

                {/* Content */}
                <div className="bg-gray-50 rounded-lg p-4">
                  {/* Status change */}
                  <div className="flex items-center space-x-2 mb-2">
                    {entry.oldStatus && (
                      <>
                        <span className="font-medium text-gray-600">
                          {entry.oldStatus}
                        </span>
                        <ArrowRight className="h-4 w-4 text-gray-400" />
                      </>
                    )}
                    <span className={`font-semibold ${statusColor}`}>
                      {entry.newStatus}
                    </span>
                  </div>

                  {/* Disposition change */}
                  {(entry.oldDisposition || entry.newDisposition) && (
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-xs text-gray-500">Disposition:</span>
                      {entry.oldDisposition && (
                        <>
                          <span className={`text-xs px-2 py-0.5 rounded ${DISPOSITION_COLORS[entry.oldDisposition] || 'bg-gray-100'}`}>
                            {entry.oldDisposition}
                          </span>
                          <ArrowRight className="h-3 w-3 text-gray-400" />
                        </>
                      )}
                      {entry.newDisposition && (
                        <span className={`text-xs px-2 py-0.5 rounded ${DISPOSITION_COLORS[entry.newDisposition] || 'bg-gray-100'}`}>
                          {entry.newDisposition}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Credit amount */}
                  {entry.creditAmount && (
                    <div className="flex items-center space-x-2 mb-2 text-green-600">
                      <DollarSign className="h-4 w-4" />
                      <span className="font-medium">${entry.creditAmount.toFixed(2)} credit issued</span>
                    </div>
                  )}

                  {/* Reason */}
                  {entry.reason && (
                    <p className="text-sm text-gray-700 mb-2 italic">
                      "{entry.reason}"
                    </p>
                  )}

                  {/* Meta info */}
                  <div className="flex items-center justify-between text-xs text-gray-500 mt-3 pt-2 border-t border-gray-200">
                    <div className="flex items-center space-x-1">
                      <User className="h-3 w-3" />
                      <span>{entry.changedBy.name}</span>
                      <span className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-600">
                        {entry.changeSource}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Clock className="h-3 w-3" />
                      <span>{date} at {time}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
