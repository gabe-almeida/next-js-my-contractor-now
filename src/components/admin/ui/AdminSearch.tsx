'use client';

/**
 * AdminSearch - Search and filter inputs for admin tables
 *
 * WHY: Consistent search/filter styling with orange focus states.
 * WHEN: Used above data tables for filtering content.
 * HOW: Provides search input and select dropdowns with unified styling.
 */

import { memo } from 'react';
import { Search, Filter } from 'lucide-react';

interface AdminSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const AdminSearch = memo(function AdminSearch({
  value,
  onChange,
  placeholder = 'Search...',
}: AdminSearchProps) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg
                   text-sm text-gray-900 placeholder-gray-400
                   focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500
                   transition-colors duration-150"
      />
    </div>
  );
});

interface AdminSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  icon?: boolean;
}

export const AdminSelect = memo(function AdminSelect({
  value,
  onChange,
  options,
  icon = true,
}: AdminSelectProps) {
  return (
    <div className="relative">
      {icon && (
        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`appearance-none bg-white border border-gray-200 rounded-lg
                   text-sm text-gray-700 py-2.5 pr-10
                   focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500
                   transition-colors duration-150 cursor-pointer
                   ${icon ? 'pl-10' : 'pl-4'}`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
        <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
});

interface AdminFilterBarProps {
  children: React.ReactNode;
}

export const AdminFilterBar = memo(function AdminFilterBar({ children }: AdminFilterBarProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 p-4 bg-gray-50/50 rounded-xl border border-gray-100">
      {children}
    </div>
  );
});
