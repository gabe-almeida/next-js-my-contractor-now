'use client';

/**
 * LeadTable - Modern lead management table
 *
 * WHY: Central table for viewing and managing leads in admin panel.
 * WHEN: Displayed on the leads management page.
 * HOW: Renders filterable, sortable table with pagination.
 */

import { useState, useMemo } from 'react';
import { Lead, LeadStatus } from '@/types';
import { LeadDisposition } from '@/types/database';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/admin/ui';
import {
  Eye,
  Download,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { AdminSearch, AdminSelect, AdminFilterBar } from '@/components/admin/ui';

// Extended lead type from API response with flattened formData
interface AdminLead extends Omit<Lead, 'formData' | 'winningBuyer'> {
  formData: {
    firstName?: string;
    lastName?: string;
    zipCode?: string;
    email?: string;
    phone?: string;
    projectScope?: string;
    timeframe?: string;
    budget?: string;
    ownsHome?: boolean;
  };
  winningBuyer?: { id: string; name: string } | null;
  pingCount?: number;
}

interface LeadTableProps {
  leads: Lead[] | AdminLead[];
  loading?: boolean;
  onViewDetails: (leadId: string) => void;
  onExport?: () => void;
}

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All Status' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'SOLD', label: 'Sold' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'SCRUBBED', label: 'Scrubbed' },
  { value: 'DUPLICATE', label: 'Duplicate' },
];

const DISPOSITION_OPTIONS = [
  { value: 'ALL', label: 'All Disposition' },
  { value: 'NEW', label: 'New' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'RETURNED', label: 'Returned' },
  { value: 'DISPUTED', label: 'Disputed' },
  { value: 'CREDITED', label: 'Credited' },
  { value: 'WRITTEN_OFF', label: 'Written Off' },
];

export function LeadTable({
  leads,
  loading = false,
  onViewDetails,
  onExport,
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
    let filtered = leads.filter((lead) => {
      const adminLead = lead as AdminLead;
      const firstName = adminLead.formData?.firstName?.toLowerCase() || '';
      const lastName = adminLead.formData?.lastName?.toLowerCase() || '';
      const searchLower = searchQuery.toLowerCase();

      const matchesSearch =
        searchQuery === '' ||
        lead.zipCode.includes(searchQuery) ||
        lead.serviceType?.name.toLowerCase().includes(searchLower) ||
        firstName.includes(searchLower) ||
        lastName.includes(searchLower);

      const matchesStatus = statusFilter === 'ALL' || lead.status === statusFilter;
      const matchesDisposition =
        dispositionFilter === 'ALL' || (lead as any).disposition === dispositionFilter;

      return matchesSearch && matchesStatus && matchesDisposition;
    });

    filtered.sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];

      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [leads, searchQuery, statusFilter, dispositionFilter, sortField, sortDirection]);

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

  const SortIcon = ({ field }: { field: keyof Lead }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3.5 w-3.5 text-gray-400" />;
    return sortDirection === 'asc' ? (
      <ArrowUp className="h-3.5 w-3.5 text-orange-500" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 text-orange-500" />
    );
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-10 bg-gray-100 rounded-lg w-full"></div>
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-14 bg-gray-50 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header & Filters */}
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Leads</h3>
          <Button
            variant="outline"
            onClick={onExport}
            className="text-sm"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        <AdminFilterBar>
          <div className="flex-1 min-w-[200px]">
            <AdminSearch
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search by name, ZIP, or service..."
            />
          </div>
          <AdminSelect
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as LeadStatus | 'ALL')}
            options={STATUS_OPTIONS}
          />
          <AdminSelect
            value={dispositionFilter}
            onChange={(v) => setDispositionFilter(v as LeadDisposition | 'ALL')}
            options={DISPOSITION_OPTIONS}
            icon={false}
          />
        </AdminFilterBar>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50/80 border-b border-gray-100">
              <th
                className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 transition-colors"
                onClick={() => handleSort('createdAt')}
              >
                <div className="flex items-center gap-1.5">
                  Created
                  <SortIcon field="createdAt" />
                </div>
              </th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                First Name
              </th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Last Name
              </th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Service
              </th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                ZIP
              </th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Sold To
              </th>
              <th className="px-4 py-3.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Pinged
              </th>
              <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Bid
              </th>
              <th className="px-4 py-3.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {paginatedLeads.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-gray-500">
                  No leads found matching your filters.
                </td>
              </tr>
            ) : (
              paginatedLeads.map((lead) => {
                const adminLead = lead as AdminLead;
                const firstName = adminLead.formData?.firstName || '-';
                const lastName = adminLead.formData?.lastName || '-';
                const buyerName = adminLead.winningBuyer?.name || '-';
                const pingCount = adminLead.pingCount ?? 0;

                return (
                  <tr
                    key={lead.id}
                    className="hover:bg-orange-50/30 transition-colors cursor-pointer"
                    onClick={() => onViewDetails(lead.id)}
                  >
                    <td className="px-4 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {new Date(lead.createdAt).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-gray-400">
                        {new Date(lead.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm font-medium text-gray-900">
                      {firstName}
                    </td>
                    <td className="px-4 py-4 text-sm font-medium text-gray-900">
                      {lastName}
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm font-medium text-gray-900">
                        {lead.serviceType?.name || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm font-mono text-gray-600">{lead.zipCode}</span>
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={lead.status} />
                    </td>
                    <td className="px-4 py-4">
                      {buyerName !== '-' ? (
                        <span className="text-sm font-medium text-orange-600">{buyerName}</span>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700">
                        {pingCount}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      {lead.winningBid ? (
                        <span className="text-sm font-semibold text-emerald-600">
                          ${Number(lead.winningBid).toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onViewDetails(lead.id)}
                        className="text-gray-500 hover:text-orange-600 hover:bg-orange-50"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-5 py-4 border-t border-gray-100 bg-gray-50/30">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Showing <span className="font-medium text-gray-700">{startIndex + 1}</span> to{' '}
              <span className="font-medium text-gray-700">
                {Math.min(startIndex + itemsPerPage, filteredAndSortedLeads.length)}
              </span>{' '}
              of{' '}
              <span className="font-medium text-gray-700">{filteredAndSortedLeads.length}</span>{' '}
              results
            </p>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`min-w-[32px] h-8 px-2 text-sm font-medium rounded-md transition-colors ${
                        currentPage === pageNum
                          ? 'bg-orange-500 text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-3"
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
