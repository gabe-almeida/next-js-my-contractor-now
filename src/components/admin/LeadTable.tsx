'use client';

import { useState, useMemo } from 'react';
import { Lead, LeadStatus } from '@/types';
import { LeadDisposition } from '@/types/database';
import { Button } from '@/components/ui/Button';
import { 
  Eye, 
  Search, 
  Filter, 
  Download,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown
} from 'lucide-react';

interface LeadTableProps {
  leads: Lead[];
  loading?: boolean;
  onViewDetails: (leadId: string) => void;
  onExport?: () => void;
}

export function LeadTable({ 
  leads, 
  loading = false, 
  onViewDetails, 
  onExport 
}: LeadTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'ALL'>('ALL');
  const [dispositionFilter, setDispositionFilter] = useState<LeadDisposition | 'ALL'>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<keyof Lead>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const itemsPerPage = 10;

  // Filter and sort leads
  const filteredAndSortedLeads = useMemo(() => {
    let filtered = leads.filter(lead => {
      const matchesSearch = searchQuery === '' ||
        lead.zipCode.includes(searchQuery) ||
        lead.serviceType?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.id.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === 'ALL' || lead.status === statusFilter;
      const matchesDisposition = dispositionFilter === 'ALL' ||
        (lead as any).disposition === dispositionFilter;

      return matchesSearch && matchesStatus && matchesDisposition;
    });

    // Sort leads
    filtered.sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [leads, searchQuery, statusFilter, dispositionFilter, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedLeads.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedLeads = filteredAndSortedLeads.slice(startIndex, startIndex + itemsPerPage);

  const handleSort = (field: keyof Lead) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getStatusBadge = (status: LeadStatus) => {
    const styles: Record<string, string> = {
      PENDING: 'status-indicator status-pending',
      PROCESSING: 'status-indicator status-processing',
      AUCTIONED: 'status-indicator status-success',
      AUCTION_COMPLETE: 'status-indicator status-success',
      SOLD: 'status-indicator status-posted',
      POSTED: 'status-indicator status-posted',
      REJECTED: 'status-indicator status-failed',
      EXPIRED: 'status-indicator status-failed',
      FAILED: 'status-indicator status-failed',
      SCRUBBED: 'px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800',
      DUPLICATE: 'px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-800'
    };

    return (
      <span className={styles[status] || 'status-indicator status-pending'}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  const getDispositionBadge = (disposition: string | undefined) => {
    if (!disposition) return null;

    const styles: Record<string, string> = {
      NEW: 'bg-gray-100 text-gray-700',
      DELIVERED: 'bg-green-100 text-green-700',
      RETURNED: 'bg-yellow-100 text-yellow-700',
      DISPUTED: 'bg-orange-100 text-orange-700',
      CREDITED: 'bg-blue-100 text-blue-700',
      WRITTEN_OFF: 'bg-red-100 text-red-700'
    };

    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded ${styles[disposition] || 'bg-gray-100'}`}>
        {disposition.replace('_', ' ')}
      </span>
    );
  };

  const getComplianceIndicator = (lead: Lead) => {
    const hasTrustedForm = !!lead.trustedFormCertId;
    const hasJornaya = !!lead.jornayaLeadId;
    
    if (hasTrustedForm && hasJornaya) {
      return <span className="text-green-600 text-xs">✓ Full</span>;
    } else if (hasTrustedForm || hasJornaya) {
      return <span className="text-yellow-600 text-xs">◐ Partial</span>;
    } else {
      return <span className="text-red-600 text-xs">✗ None</span>;
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex space-x-4">
                <div className="h-4 bg-gray-200 rounded flex-1"></div>
                <div className="h-4 bg-gray-200 rounded w-20"></div>
                <div className="h-4 bg-gray-200 rounded w-24"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Lead Management</h3>
          <Button
            variant="outline"
            onClick={onExport}
            className="flex items-center space-x-2"
          >
            <Download className="h-4 w-4" />
            <span>Export</span>
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search leads by ID, ZIP, or service..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as LeadStatus | 'ALL')}
              className="border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="ALL">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="PROCESSING">Processing</option>
              <option value="AUCTIONED">Auctioned</option>
              <option value="SOLD">Sold</option>
              <option value="REJECTED">Rejected</option>
              <option value="EXPIRED">Expired</option>
              <option value="SCRUBBED">Scrubbed</option>
              <option value="DUPLICATE">Duplicate</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <select
              value={dispositionFilter}
              onChange={(e) => setDispositionFilter(e.target.value as LeadDisposition | 'ALL')}
              className="border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="ALL">All Disposition</option>
              <option value="NEW">New</option>
              <option value="DELIVERED">Delivered</option>
              <option value="RETURNED">Returned</option>
              <option value="DISPUTED">Disputed</option>
              <option value="CREDITED">Credited</option>
              <option value="WRITTEN_OFF">Written Off</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th 
                className="cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('id')}
              >
                <div className="flex items-center space-x-1">
                  <span>Lead ID</span>
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th 
                className="cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('createdAt')}
              >
                <div className="flex items-center space-x-1">
                  <span>Created</span>
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th>Service</th>
              <th>ZIP Code</th>
              <th>Status</th>
              <th>Disposition</th>
              <th>Compliance</th>
              <th>Winning Bid</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {paginatedLeads.map((lead) => (
              <tr key={lead.id} className="hover:bg-gray-50">
                <td className="font-mono text-sm">
                  {lead.id.slice(0, 8)}...
                </td>
                <td>
                  {new Date(lead.createdAt).toLocaleDateString()}
                  <div className="text-xs text-gray-500">
                    {new Date(lead.createdAt).toLocaleTimeString()}
                  </div>
                </td>
                <td>
                  <div className="font-medium">{lead.serviceType?.name || 'Unknown'}</div>
                  <div className="text-xs text-gray-500">
                    {lead.ownsHome ? 'Homeowner' : 'Renter'}
                  </div>
                </td>
                <td className="font-mono">{lead.zipCode}</td>
                <td>{getStatusBadge(lead.status)}</td>
                <td>{getDispositionBadge((lead as any).disposition)}</td>
                <td>{getComplianceIndicator(lead)}</td>
                <td>
                  {lead.winningBid ? (
                    <span className="font-medium text-green-600">
                      ${lead.winningBid.toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onViewDetails(lead.id)}
                    className="flex items-center space-x-1"
                  >
                    <Eye className="h-3 w-3" />
                    <span>View</span>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-6 py-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredAndSortedLeads.length)} of {filteredAndSortedLeads.length} results
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
    </div>
  );
}