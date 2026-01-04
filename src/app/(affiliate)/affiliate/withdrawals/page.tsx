'use client';

/**
 * Affiliate Withdrawals Page
 *
 * WHY: Allows affiliates to request withdrawals of their approved commissions.
 * WHEN: Affiliate has sufficient balance and wants to receive payment.
 * HOW: Shows available balance, withdrawal form, and history.
 */

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { RefreshCw, Wallet, DollarSign, AlertCircle, CheckCircle } from 'lucide-react';

interface Withdrawal {
  id: string;
  amount: number;
  method: string;
  status: string;
  createdAt: string;
  processedAt: string | null;
  notes: string | null;
}

interface Stats {
  availableBalance: number;
}

const STATUS_COLORS: Record<string, string> = {
  REQUESTED: 'bg-yellow-100 text-yellow-800',
  PROCESSING: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
};

const PAYMENT_METHODS = [
  { value: 'PAYPAL', label: 'PayPal' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'CHECK', label: 'Check' },
];

export default function AffiliateWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('PAYPAL');
  const [methodDetails, setMethodDetails] = useState('');

  const fetchData = useCallback(async () => {
    const token = localStorage.getItem('affiliate_token');
    if (!token) return;

    setLoading(true);

    try {
      const [withdrawalsRes, statsRes] = await Promise.all([
        fetch('/api/affiliates/withdrawals', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/affiliates/stats', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      const [withdrawalsData, statsData] = await Promise.all([
        withdrawalsRes.json(),
        statsRes.json()
      ]);

      if (withdrawalsData.success) {
        setWithdrawals(withdrawalsData.data);
      }

      if (statsData.success) {
        setStats({ availableBalance: statsData.data.availableBalance });
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const withdrawalAmount = parseFloat(amount);

    if (isNaN(withdrawalAmount) || withdrawalAmount < 50) {
      setError('Minimum withdrawal amount is $50');
      return;
    }

    if (stats && withdrawalAmount > stats.availableBalance) {
      setError('Insufficient balance');
      return;
    }

    if (!methodDetails.trim()) {
      setError('Please provide payment details');
      return;
    }

    setSubmitting(true);

    try {
      const token = localStorage.getItem('affiliate_token');
      const response = await fetch('/api/affiliates/withdrawals', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: withdrawalAmount,
          method,
          methodDetails: methodDetails.trim()
        })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to submit withdrawal request');
      }

      setSuccess('Withdrawal request submitted successfully!');
      setAmount('');
      setMethodDetails('');
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Withdrawals</h1>
          <p className="mt-1 text-sm text-gray-500">
            Request payouts for your approved commissions
          </p>
        </div>
        <Button
          variant="outline"
          onClick={fetchData}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Request Withdrawal Form */}
        <div className="lg:col-span-1">
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Request Withdrawal</h3>
            </div>
            <div className="px-4 py-5 sm:p-6">
              {/* Available Balance */}
              <div className="mb-6 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                <div className="flex items-center">
                  <Wallet className="h-8 w-8 text-emerald-600" />
                  <div className="ml-3">
                    <p className="text-sm text-emerald-600 font-medium">Available Balance</p>
                    <p className="text-2xl font-bold text-emerald-900">
                      {stats ? formatCurrency(stats.availableBalance) : '-'}
                    </p>
                  </div>
                </div>
              </div>

              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-3 flex items-start">
                  <AlertCircle className="h-5 w-5 text-red-400 mr-2 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {success && (
                <div className="mb-4 bg-green-50 border border-green-200 rounded-md p-3 flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-400 mr-2 mt-0.5" />
                  <p className="text-sm text-green-700">{success}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Amount ($)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <DollarSign className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="number"
                      min="50"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                      placeholder="50.00"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Minimum: $50.00</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Method
                  </label>
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    {PAYMENT_METHODS.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Details
                  </label>
                  <textarea
                    value={methodDetails}
                    onChange={(e) => setMethodDetails(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder={
                      method === 'PAYPAL'
                        ? 'Enter your PayPal email address'
                        : method === 'BANK_TRANSFER'
                        ? 'Enter bank name, account number, routing number'
                        : 'Enter mailing address for check'
                    }
                  />
                </div>

                <Button
                  type="submit"
                  disabled={submitting || !stats || stats.availableBalance < 50}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Request Withdrawal'}
                </Button>
              </form>
            </div>
          </div>
        </div>

        {/* Withdrawal History */}
        <div className="lg:col-span-2">
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Withdrawal History</h3>
            </div>
            <div className="px-4 py-5 sm:p-6">
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto"></div>
                  <p className="mt-2 text-sm text-gray-500">Loading...</p>
                </div>
              ) : withdrawals.length === 0 ? (
                <div className="text-center py-8">
                  <Wallet className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No withdrawal requests yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Amount
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Method
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Requested
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Processed
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {withdrawals.map((withdrawal) => (
                        <tr key={withdrawal.id}>
                          <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                            {formatCurrency(withdrawal.amount)}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                            {withdrawal.method.replace('_', ' ')}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[withdrawal.status] || 'bg-gray-100 text-gray-800'}`}>
                              {withdrawal.status}
                            </span>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(withdrawal.createdAt)}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(withdrawal.processedAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
