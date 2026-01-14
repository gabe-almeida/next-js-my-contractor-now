'use client';

/**
 * AdminStatGrid - Grid of stat cards for detail pages
 *
 * WHY: Provides consistent stat card styling across all detail pages.
 * WHEN: Used on buyer detail, affiliate detail, and other detail pages.
 * HOW: Renders a responsive grid of stat cards with consistent styling.
 */

import { memo, ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

export interface StatItem {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  accent?: 'gray' | 'green' | 'blue' | 'orange' | 'purple' | 'red' | 'yellow';
}

interface AdminStatGridProps {
  stats: StatItem[];
  columns?: 2 | 3 | 4 | 5 | 6;
  loading?: boolean;
}

const accentColors: Record<NonNullable<StatItem['accent']>, { icon: string; value: string; bg: string }> = {
  gray: { icon: 'text-gray-500', value: 'text-gray-900', bg: 'bg-gray-50' },
  green: { icon: 'text-emerald-500', value: 'text-emerald-600', bg: 'bg-emerald-50' },
  blue: { icon: 'text-blue-500', value: 'text-blue-600', bg: 'bg-blue-50' },
  orange: { icon: 'text-orange-500', value: 'text-orange-600', bg: 'bg-orange-50' },
  purple: { icon: 'text-purple-500', value: 'text-purple-600', bg: 'bg-purple-50' },
  red: { icon: 'text-red-500', value: 'text-red-600', bg: 'bg-red-50' },
  yellow: { icon: 'text-amber-500', value: 'text-amber-600', bg: 'bg-amber-50' },
};

export const AdminStatGrid = memo(function AdminStatGrid({
  stats,
  columns = 4,
  loading = false,
}: AdminStatGridProps) {
  const gridCols: Record<number, string> = {
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5',
    6: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6',
  };

  if (loading) {
    return (
      <div className={`grid ${gridCols[columns]} gap-4`}>
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-2/3 mb-3"></div>
            <div className="h-8 bg-gray-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`grid ${gridCols[columns]} gap-4`}>
      {stats.map((stat, index) => {
        const colors = accentColors[stat.accent || 'gray'];
        const Icon = stat.icon;

        return (
          <div
            key={index}
            className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">{stat.label}</span>
              {Icon && (
                <div className={`p-1.5 rounded-lg ${colors.bg}`}>
                  <Icon className={`h-4 w-4 ${colors.icon}`} />
                </div>
              )}
            </div>
            <div className={`text-2xl font-bold ${colors.value}`}>
              {stat.value}
            </div>
          </div>
        );
      })}
    </div>
  );
});
