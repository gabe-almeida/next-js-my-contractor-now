'use client';

/**
 * AdminCard - Reusable stat card for admin dashboard
 *
 * WHY: Provides consistent visual styling for metric cards across admin panel.
 * WHEN: Used to display stats like Total Leads, Revenue, Pending counts.
 * HOW: Renders a card with icon, value, label, and optional trend indicator.
 */

import { memo } from 'react';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

type AccentColor = 'orange' | 'green' | 'red' | 'yellow' | 'blue' | 'gray';

interface AdminCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  accent?: AccentColor;
  trend?: string;
  trendUp?: boolean;
  subtitle?: string;
  loading?: boolean;
}

const accentStyles: Record<AccentColor, { icon: string; value: string; bg: string }> = {
  orange: {
    icon: 'text-orange-500',
    value: 'text-gray-900',
    bg: 'bg-orange-50',
  },
  green: {
    icon: 'text-emerald-500',
    value: 'text-emerald-600',
    bg: 'bg-emerald-50',
  },
  red: {
    icon: 'text-red-500',
    value: 'text-red-600',
    bg: 'bg-red-50',
  },
  yellow: {
    icon: 'text-amber-500',
    value: 'text-amber-600',
    bg: 'bg-amber-50',
  },
  blue: {
    icon: 'text-blue-500',
    value: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  gray: {
    icon: 'text-gray-500',
    value: 'text-gray-900',
    bg: 'bg-gray-50',
  },
};

export const AdminCard = memo(function AdminCard({
  title,
  value,
  icon: Icon,
  accent = 'gray',
  trend,
  trendUp,
  subtitle,
  loading = false,
}: AdminCardProps) {
  const styles = accentStyles[accent];

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
        <div className="animate-pulse">
          <div className="flex items-center justify-between mb-3">
            <div className="h-4 bg-gray-200 rounded w-24"></div>
            <div className="h-8 w-8 bg-gray-200 rounded-lg"></div>
          </div>
          <div className="h-8 bg-gray-200 rounded w-16"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-500 uppercase tracking-wide">
          {title}
        </span>
        <div className={`p-2 rounded-lg ${styles.bg}`}>
          <Icon className={`h-5 w-5 ${styles.icon}`} />
        </div>
      </div>

      <div className="flex items-end justify-between">
        <div>
          <div className={`text-2xl font-bold ${styles.value}`}>
            {value}
          </div>
          {subtitle && (
            <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
          )}
        </div>

        {trend && (
          <div className={`flex items-center text-sm font-medium ${
            trendUp ? 'text-emerald-600' : 'text-red-600'
          }`}>
            {trendUp ? (
              <TrendingUp className="h-4 w-4 mr-1" />
            ) : (
              <TrendingDown className="h-4 w-4 mr-1" />
            )}
            {trend}
          </div>
        )}
      </div>
    </div>
  );
});
