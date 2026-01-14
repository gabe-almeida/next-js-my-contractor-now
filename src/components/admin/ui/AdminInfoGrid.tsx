'use client';

/**
 * AdminInfoGrid - Key-value information grid for detail pages
 *
 * WHY: Provides consistent styling for displaying entity details.
 * WHEN: Used on detail pages to show buyer info, affiliate info, etc.
 * HOW: Renders a responsive grid of key-value pairs with optional icons.
 */

import { memo, ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

export interface InfoItem {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
}

interface AdminInfoGridProps {
  items: InfoItem[];
  columns?: 1 | 2 | 3;
}

export const AdminInfoGrid = memo(function AdminInfoGrid({
  items,
  columns = 2,
}: AdminInfoGridProps) {
  const gridCols: Record<number, string> = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  };

  return (
    <div className={`grid ${gridCols[columns]} gap-x-8 gap-y-4`}>
      {items.map((item, index) => {
        const Icon = item.icon;
        return (
          <div key={index} className="flex items-center gap-3">
            {Icon && (
              <div className="p-2 bg-gray-50 rounded-lg shrink-0">
                <Icon className="h-4 w-4 text-gray-400" />
              </div>
            )}
            <div className="min-w-0">
              <dt className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">
                {item.label}
              </dt>
              <dd className="text-sm font-medium text-gray-900 truncate">
                {item.value}
              </dd>
            </div>
          </div>
        );
      })}
    </div>
  );
});
