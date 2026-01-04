'use client';

import { useState, useEffect } from 'react';
import { Transaction } from '@/types';
import { TransactionActionType, TransactionStatus } from '@/types/database';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { 
  Search, 
  Filter, 
  Download,
  Eye,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useRealTimeUpdates } from '@/hooks/useRealTimeUpdates';

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TransactionStatus | 'ALL'>('ALL');
  const [actionFilter, setActionFilter] = useState<'ALL' | 'PING' | 'POST'>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const itemsPerPage = 20;

  // Real-time updates
  const { updates, isConnected } = useRealTimeUpdates({ enabled: true });

  // Mock data - replace with actual API calls
  useEffect(() => {
    const fetchTransactions = async () => {
      setLoading(true);
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock transaction data
      const mockTransactions: Transaction[] = Array.from({ length: 100 }, (_, i) => {
        const isRecent = i < 20;
        const statuses: TransactionStatus[] = [TransactionStatus.SUCCESS, TransactionStatus.FAILED, TransactionStatus.PENDING, TransactionStatus.TIMEOUT];
        const status = statuses[Math.floor(Math.random() * 4)] ?? TransactionStatus.PENDING;
        const actionTypes: TransactionActionType[] = [TransactionActionType.PING, TransactionActionType.POST];
        const actionType = actionTypes[Math.floor(Math.random() * 2)] ?? TransactionActionType.PING;
        
        return {
          id: `txn-${String(i + 1).padStart(6, '0')}`,
          leadId: `lead-${String(Math.floor(Math.random() * 1000) + 1).padStart(4, '0')}`,
          buyerId: `buyer-${Math.floor(Math.random() * 3) + 1}`,
          actionType,
          payload: {
            zipCode: String(Math.floor(Math.random() * 90000) + 10000),
            serviceType: ['Windows', 'Bathrooms', 'Roofing'][Math.floor(Math.random() * 3)],
            ...(actionType === TransactionActionType.PING ? { bidRequest: true } : { leadData: 'full_lead_data' })
          },
          response: status === TransactionStatus.SUCCESS ? {
            success: true,
            bidAmount: actionType === TransactionActionType.PING ? Math.floor(Math.random() * 80) + 20 : undefined,
            message: 'Lead processed successfully'
          } : status === TransactionStatus.FAILED ? {
            success: false,
            error: 'Invalid lead data',
            code: 'VALIDATION_ERROR'
          } : undefined,
          status,
          responseTime: Math.floor(Math.random() * 5000) + 500,
          errorMessage: status === TransactionStatus.FAILED ? 'Validation failed: Missing required field' : undefined,
          complianceIncluded: Math.random() > 0.2,
          trustedFormPresent: Math.random() > 0.3,
          jornayaPresent: Math.random() > 0.4,
          createdAt: new Date(Date.now() - (isRecent ? Math.random() * 60 * 60 * 1000 : Math.random() * 7 * 24 * 60 * 60 * 1000))
        };
      });
      
      setTransactions(mockTransactions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
      setLoading(false);
    };

    fetchTransactions();
  }, []);

  // Filter transactions
  const filteredTransactions = transactions.filter(transaction => {
    const matchesSearch = searchQuery === '' || 
      transaction.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      transaction.leadId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      transaction.buyerId.toLowerCase().includes(searchQuery.toLowerCase());
      
    const matchesStatus = statusFilter === 'ALL' || transaction.status === statusFilter;
    const matchesAction = actionFilter === 'ALL' || transaction.actionType === actionFilter;
    
    return matchesSearch && matchesStatus && matchesAction;
  });

  // Pagination
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedTransactions = filteredTransactions.slice(startIndex, startIndex + itemsPerPage);

  const getStatusIcon = (status: TransactionStatus) => {
    switch (status) {
      case 'SUCCESS':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'FAILED':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'PENDING':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'TIMEOUT':
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      case 'INFO':
        return <AlertCircle className="h-4 w-4 text-blue-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: TransactionStatus) => {
    const styles: Record<TransactionStatus, string> = {
      [TransactionStatus.SUCCESS]: 'status-indicator status-success',
      [TransactionStatus.FAILED]: 'status-indicator status-failed',
      [TransactionStatus.PENDING]: 'status-indicator status-pending',
      [TransactionStatus.TIMEOUT]: 'status-indicator status-failed',
      [TransactionStatus.INFO]: 'status-indicator status-info'
    };

    return <span className={styles[status]}>{status}</span>;
  };

  const getBuyerName = (buyerId: string) => {
    const buyerNames: Record<string, string> = {
      'buyer-1': 'HomeAdvisor',
      'buyer-2': 'Modernize',
      'buyer-3': 'Angi'
    };
    return buyerNames[buyerId] || buyerId;
  };

  const handleViewDetails = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
  };

  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 1000);
  };

  const handleExport = () => {
    console.log('Exporting transactions...');
  };

  // Calculate summary stats
  const totalTransactions = filteredTransactions.length;
  const successfulTransactions = filteredTransactions.filter(t => t.status === TransactionStatus.SUCCESS).length;
  const failedTransactions = filteredTransactions.filter(t => t.status === TransactionStatus.FAILED).length;
  const avgResponseTime = filteredTransactions.reduce((sum, t) => sum + (t.responseTime ?? 0), 0) / totalTransactions || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transaction Log</h1>
          <p className="text-gray-500">Monitor all buyer API transactions and responses</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
            <span className="text-xs text-gray-500">
              {isConnected ? 'Live' : 'Disconnected'}
            </span>
          </div>
          
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center space-x-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
          
          <Button
            variant="outline"
            onClick={handleExport}
            className="flex items-center space-x-2"
          >
            <Download className="h-4 w-4" />
            <span>Export</span>
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Total Transactions</p>
                <p className="text-2xl font-bold text-gray-900">{totalTransactions}</p>
              </div>
              <Filter className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Successful</p>
                <p className="text-2xl font-bold text-green-600">{successfulTransactions}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Failed</p>
                <p className="text-2xl font-bold text-red-600">{failedTransactions}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Avg Response</p>
                <p className="text-2xl font-bold text-blue-600">{Math.round(avgResponseTime)}ms</p>
              </div>
              <Clock className="h-8 w-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by transaction ID, lead ID, or buyer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div className="flex space-x-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as TransactionStatus | 'ALL')}
                className="border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="ALL">All Status</option>
                <option value="SUCCESS">Success</option>
                <option value="FAILED">Failed</option>
                <option value="PENDING">Pending</option>
                <option value="TIMEOUT">Timeout</option>
                <option value="INFO">Info</option>
              </select>
              
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value as 'ALL' | 'PING' | 'POST')}
                className="border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="ALL">All Actions</option>
                <option value="PING">PING</option>
                <option value="POST">POST</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Transaction ID</th>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>Buyer</th>
                  <th>Lead ID</th>
                  <th>Status</th>
                  <th>Response Time</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i}>
                      <td><div className="h-4 bg-gray-200 rounded animate-pulse"></div></td>
                      <td><div className="h-4 bg-gray-200 rounded animate-pulse"></div></td>
                      <td><div className="h-4 bg-gray-200 rounded animate-pulse"></div></td>
                      <td><div className="h-4 bg-gray-200 rounded animate-pulse"></div></td>
                      <td><div className="h-4 bg-gray-200 rounded animate-pulse"></div></td>
                      <td><div className="h-4 bg-gray-200 rounded animate-pulse"></div></td>
                      <td><div className="h-4 bg-gray-200 rounded animate-pulse"></div></td>
                      <td><div className="h-4 bg-gray-200 rounded animate-pulse"></div></td>
                    </tr>
                  ))
                ) : (
                  paginatedTransactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td className="font-mono text-sm">
                        {transaction.id}
                      </td>
                      <td>
                        {transaction.createdAt.toLocaleDateString()}
                        <div className="text-xs text-gray-500">
                          {transaction.createdAt.toLocaleTimeString()}
                        </div>
                      </td>
                      <td>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          transaction.actionType === 'PING' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-purple-100 text-purple-800'
                        }`}>
                          {transaction.actionType}
                        </span>
                      </td>
                      <td>{getBuyerName(transaction.buyerId)}</td>
                      <td className="font-mono text-sm text-gray-600">
                        {transaction.leadId}
                      </td>
                      <td>
                        <div className="flex items-center space-x-1">
                          {getStatusIcon(transaction.status)}
                          {getStatusBadge(transaction.status)}
                        </div>
                      </td>
                      <td>
                        <span className={`font-medium ${
                          (transaction.responseTime ?? 0) < 1000 ? 'text-green-600' :
                          (transaction.responseTime ?? 0) < 3000 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {transaction.responseTime ?? 0}ms
                        </span>
                      </td>
                      <td>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(transaction)}
                          className="flex items-center space-x-1"
                        >
                          <Eye className="h-3 w-3" />
                          <span>View</span>
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredTransactions.length)} of {filteredTransactions.length} results
                </div>
                
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  <span className="text-sm text-gray-700">
                    Page {currentPage} of {totalPages}
                  </span>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transaction Details Modal */}
      {selectedTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Transaction Details</h3>
                <Button
                  variant="ghost"
                  onClick={() => setSelectedTransaction(null)}
                >
                  ×
                </Button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-gray-900">Basic Information</h4>
                  <dl className="mt-2 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Transaction ID:</dt>
                      <dd className="font-mono">{selectedTransaction.id}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Lead ID:</dt>
                      <dd className="font-mono">{selectedTransaction.leadId}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Buyer:</dt>
                      <dd>{getBuyerName(selectedTransaction.buyerId)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Action:</dt>
                      <dd>{selectedTransaction.actionType}</dd>
                    </div>
                  </dl>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-900">Performance</h4>
                  <dl className="mt-2 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Status:</dt>
                      <dd>{getStatusBadge(selectedTransaction.status)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Response Time:</dt>
                      <dd>{selectedTransaction.responseTime}ms</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Timestamp:</dt>
                      <dd>{selectedTransaction.createdAt.toLocaleString()}</dd>
                    </div>
                  </dl>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Request Payload</h4>
                <pre className="bg-gray-100 p-4 rounded text-sm overflow-x-auto">
                  {JSON.stringify(selectedTransaction.payload, null, 2)}
                </pre>
              </div>
              
              {selectedTransaction.response && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Response Data</h4>
                  <pre className="bg-gray-100 p-4 rounded text-sm overflow-x-auto">
                    {JSON.stringify(selectedTransaction.response, null, 2)}
                  </pre>
                </div>
              )}
              
              {selectedTransaction.errorMessage && (
                <div>
                  <h4 className="font-medium text-red-900 mb-2">Error Details</h4>
                  <div className="bg-red-50 border border-red-200 p-4 rounded text-sm text-red-700">
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