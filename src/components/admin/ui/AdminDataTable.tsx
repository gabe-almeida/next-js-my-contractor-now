'use client';

/**
 * AdminDataTable - Reusable data table for admin pages
 *
 * WHY: Single source of truth for all admin list views (DRY principle).
 * WHEN: Used on Services, Buyers, Affiliates, Transactions pages.
 * HOW: Configurable columns, sorting, filtering, pagination, and actions.
 */

import { useState, useMemo, ReactNode, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { AdminSearch, AdminSelect, AdminFilterBar } from './AdminSearch';
import { StatusBadge } from './AdminBadge';
import {
  Eye,
  Edit,
  Trash2,
  Download,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ToggleLeft,
  ToggleRight,
  MoreVertical,
} from 'lucide-react';

// Column definition type
export interface TableColumn<T> {
  key: string;
  header: string;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render?: (item: T, index: number) => ReactNode;
}

// Filter option type
export interface FilterOption {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

// Row action type
export interface RowAction<T> {
  key: string;
  icon: ReactNode;
  label: string;
  onClick: (item: T) => void;
  variant?: 'default' | 'danger' | 'success';
  show?: (item: T) => boolean;
}

interface AdminDataTableProps<T> {
  // Data
  data: T[];
  loading?: boolean;
  keyField: keyof T;

  // Columns
  columns: TableColumn<T>[];

  // Header
  title?: string;
  subtitle?: string;

  // Search & Filters
  searchPlaceholder?: string;
  searchFields?: (keyof T)[];
  filters?: FilterOption[];

  // Sorting
  defaultSortField?: string;
  defaultSortDirection?: 'asc' | 'desc';

  // Pagination
  itemsPerPage?: number;

  // Actions
  onRowClick?: (item: T) => void;
  onExport?: () => void;
  rowActions?: RowAction<T>[];

  // Toggle action (special case for active/inactive)
  onToggleActive?: (item: T) => void;
  activeField?: keyof T;

  // Empty state
  emptyMessage?: string;
  emptyAction?: ReactNode;
}

export function AdminDataTable<T extends Record<string, any>>({
  data,
  loading = false,
  keyField,
  columns,
  title,
  subtitle,
  searchPlaceholder = 'Search...',
  searchFields = [],
  filters = [],
  defaultSortField,
  defaultSortDirection = 'desc',
  itemsPerPage = 10,
  onRowClick,
  onExport,
  rowActions = [],
  onToggleActive,
  activeField,
  emptyMessage = 'No data found.',
  emptyAction,
}: AdminDataTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState(defaultSortField || '');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(defaultSortDirection);
  const [openActionMenu, setOpenActionMenu] = useState<string | null>(null);

  // Filter and sort data
  const filteredAndSortedData = useMemo(() => {
    let filtered = [...data];

    // Search filter
    if (searchQuery && searchFields.length > 0) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((item) =>
        searchFields.some((field) => {
          const value = item[field];
          if (typeof value === 'string') {
            return value.toLowerCase().includes(query);
          }
          if (typeof value === 'number') {
            return value.toString().includes(query);
          }
          return false;
        })
      );
    }

    // Apply filters
    Object.entries(filterValues).forEach(([key, value]) => {
      if (value && value !== 'ALL') {
        filtered = filtered.filter((item) => {
          const itemValue = item[key];
          // Handle boolean fields (like active)
          if (typeof itemValue === 'boolean') {
            return itemValue === (value === 'true');
          }
          return String(itemValue) === value;
        });
      }
    });

    // Sort
    if (sortField) {
      filtered.sort((a, b) => {
        const aValue = a[sortField];
        const bValue = b[sortField];

        if (aValue == null && bValue == null) return 0;
        if (aValue == null) return 1;
        if (bValue == null) return -1;

        // Handle dates
        if (aValue instanceof Date && bValue instanceof Date) {
          return sortDirection === 'asc'
            ? aValue.getTime() - bValue.getTime()
            : bValue.getTime() - aValue.getTime();
        }

        // Handle strings
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortDirection === 'asc'
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        }

        // Handle numbers
        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [data, searchQuery, searchFields, filterValues, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filteredAndSortedData.slice(startIndex, startIndex + itemsPerPage);

  // Reset to page 1 when filters change
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  }, []);

  const handleFilterChange = useCallback((key: string, value: string) => {
    setFilterValues((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  }, []);

  // Sort handler
  const handleSort = useCallback((field: string) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  }, [sortField]);

  // Sort icon component
  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3.5 w-3.5 text-gray-400" />;
    return sortDirection === 'asc' ? (
      <ArrowUp className="h-3.5 w-3.5 text-orange-500" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 text-orange-500" />
    );
  };

  // Loading skeleton
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
        {(title || onExport) && (
          <div className="flex items-center justify-between mb-4">
            {title && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
                {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
              </div>
            )}
            {onExport && (
              <Button variant="outline" onClick={onExport} className="text-sm">
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            )}
          </div>
        )}

        {(searchFields.length > 0 || filters.length > 0) && (
          <AdminFilterBar>
            {searchFields.length > 0 && (
              <div className="flex-1 min-w-[200px]">
                <AdminSearch
                  value={searchQuery}
                  onChange={handleSearchChange}
                  placeholder={searchPlaceholder}
                />
              </div>
            )}
            {filters.map((filter) => (
              <AdminSelect
                key={filter.key}
                value={filterValues[filter.key] || 'ALL'}
                onChange={(v) => handleFilterChange(filter.key, v)}
                options={[{ value: 'ALL', label: filter.label }, ...filter.options]}
              />
            ))}
          </AdminFilterBar>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50/80 border-b border-gray-100">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider
                    ${column.align === 'center' ? 'text-center' : column.align === 'right' ? 'text-right' : 'text-left'}
                    ${column.sortable ? 'cursor-pointer hover:bg-gray-100/50 transition-colors' : ''}
                    ${column.width || ''}`}
                  onClick={() => column.sortable && handleSort(column.key)}
                >
                  <div className={`flex items-center gap-1.5 ${column.align === 'center' ? 'justify-center' : column.align === 'right' ? 'justify-end' : ''}`}>
                    {column.header}
                    {column.sortable && <SortIcon field={column.key} />}
                  </div>
                </th>
              ))}
              {(rowActions.length > 0 || onToggleActive) && (
                <th className="px-4 py-3.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-[100px]">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (rowActions.length > 0 || onToggleActive ? 1 : 0)}
                  className="px-4 py-12 text-center text-gray-500"
                >
                  <div className="flex flex-col items-center gap-3">
                    <span>{emptyMessage}</span>
                    {emptyAction}
                  </div>
                </td>
              </tr>
            ) : (
              paginatedData.map((item, index) => (
                <tr
                  key={String(item[keyField])}
                  className={`hover:bg-orange-50/30 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                  onClick={() => onRowClick?.(item)}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`px-4 py-4 ${column.align === 'center' ? 'text-center' : column.align === 'right' ? 'text-right' : ''}`}
                    >
                      {column.render ? column.render(item, index) : (
                        <span className="text-sm text-gray-900">{String(item[column.key] ?? '-')}</span>
                      )}
                    </td>
                  ))}
                  {(rowActions.length > 0 || onToggleActive) && (
                    <td className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        {/* Toggle button */}
                        {onToggleActive && activeField && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onToggleActive(item)}
                            className="p-1.5 h-auto"
                          >
                            {item[activeField] ? (
                              <ToggleRight className="h-5 w-5 text-green-600" />
                            ) : (
                              <ToggleLeft className="h-5 w-5 text-gray-400" />
                            )}
                          </Button>
                        )}

                        {/* Row actions */}
                        {rowActions.length > 0 && rowActions.length <= 2 ? (
                          // Show inline if 2 or fewer actions
                          rowActions.map((action) => {
                            if (action.show && !action.show(item)) return null;
                            return (
                              <Button
                                key={action.key}
                                variant="ghost"
                                size="sm"
                                onClick={() => action.onClick(item)}
                                className={`p-1.5 h-auto ${
                                  action.variant === 'danger'
                                    ? 'text-red-600 hover:text-red-700 hover:bg-red-50'
                                    : action.variant === 'success'
                                    ? 'text-green-600 hover:text-green-700 hover:bg-green-50'
                                    : 'text-gray-500 hover:text-orange-600 hover:bg-orange-50'
                                }`}
                                title={action.label}
                              >
                                {action.icon}
                              </Button>
                            );
                          })
                        ) : rowActions.length > 2 ? (
                          // Show dropdown menu if more than 2 actions
                          <div className="relative">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setOpenActionMenu(openActionMenu === String(item[keyField]) ? null : String(item[keyField]))}
                              className="p-1.5 h-auto"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                            {openActionMenu === String(item[keyField]) && (
                              <div className="absolute right-0 mt-1 w-36 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
                                {rowActions.map((action) => {
                                  if (action.show && !action.show(item)) return null;
                                  return (
                                    <button
                                      key={action.key}
                                      onClick={() => {
                                        action.onClick(item);
                                        setOpenActionMenu(null);
                                      }}
                                      className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg ${
                                        action.variant === 'danger' ? 'text-red-600' : 'text-gray-700'
                                      }`}
                                    >
                                      {action.icon}
                                      {action.label}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        ) : null}
                      </div>
                    </td>
                  )}
                </tr>
              ))
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
                {Math.min(startIndex + itemsPerPage, filteredAndSortedData.length)}
              </span>{' '}
              of <span className="font-medium text-gray-700">{filteredAndSortedData.length}</span> results
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

// Export helper icons for column renders
export { Eye, Edit, Trash2, ToggleLeft, ToggleRight };
