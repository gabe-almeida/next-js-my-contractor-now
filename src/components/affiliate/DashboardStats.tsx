'use client';

/**
 * Affiliate Dashboard Stats Component
 *
 * WHY: Provides visual summary of affiliate performance metrics.
 *      Includes both lead and call stats for unified earnings view.
 *
 * WHEN: Displayed on affiliate dashboard for quick performance overview.
 *
 * HOW: Receives stats from parent, displays as card grid with icons and values.
 *      Supports both lead-only and combined lead+call stats.
 */

import { DollarSign, Clock, Wallet, MousePointerClick, Users, Phone, CheckCircle } from 'lucide-react';

interface StatsData {
  // Lead stats
  totalEarnings: number;
  pendingEarnings: number;
  availableBalance: number;
  totalClicks: number;
  totalConversions: number;
  conversionRate: number;
  // Call stats (optional for backward compatibility)
  callsToday?: number;
  callsThisWeek?: number;
  callsThisMonth?: number;
  callEarningsToday?: number;
  callEarningsThisWeek?: number;
  callEarningsThisMonth?: number;
  qualifiedCallsToday?: number;
  qualifiedCallsThisWeek?: number;
  qualifiedCallsThisMonth?: number;
}

interface DashboardStatsProps {
  stats: StatsData | null;
  loading?: boolean;
  showCallStats?: boolean;
}

/**
 * WHY: Format currency for display.
 * WHEN: Displaying monetary amounts.
 * HOW: Use Intl.NumberFormat for consistent USD formatting.
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

/**
 * WHY: Format number for display.
 * WHEN: Displaying count metrics.
 * HOW: Use Intl.NumberFormat for consistent number formatting.
 */
function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

export function DashboardStats({ stats, loading, showCallStats = false }: DashboardStatsProps) {
  // Build stat cards based on whether call stats are included
  const leadStatCards = [
    {
      name: 'Total Earnings',
      value: stats ? formatCurrency(stats.totalEarnings) : '$0.00',
      icon: DollarSign,
      color: 'bg-emerald-500',
      description: 'Lifetime commissions earned',
    },
    {
      name: 'Pending',
      value: stats ? formatCurrency(stats.pendingEarnings) : '$0.00',
      icon: Clock,
      color: 'bg-yellow-500',
      description: 'Awaiting approval',
    },
    {
      name: 'Available',
      value: stats ? formatCurrency(stats.availableBalance) : '$0.00',
      icon: Wallet,
      color: 'bg-blue-500',
      description: 'Ready to withdraw',
    },
    {
      name: 'Total Clicks',
      value: stats ? formatNumber(stats.totalClicks) : '0',
      icon: MousePointerClick,
      color: 'bg-purple-500',
      description: 'All-time link clicks',
    },
    {
      name: 'Conversions',
      value: stats ? formatNumber(stats.totalConversions) : '0',
      icon: Users,
      color: 'bg-indigo-500',
      description: stats ? `${stats.conversionRate.toFixed(1)}% rate` : '0% rate',
    },
  ];

  // If showing call stats, add call-specific cards
  const callStatCards = showCallStats ? [
    {
      name: "Today's Calls",
      value: stats?.callsToday !== undefined ? formatNumber(stats.callsToday) : '0',
      icon: Phone,
      color: 'bg-orange-500',
      description: `${stats?.qualifiedCallsToday || 0} qualified`,
    },
    {
      name: "Today's Call Earnings",
      value: stats?.callEarningsToday !== undefined
        ? formatCurrency(stats.callEarningsToday)
        : '$0.00',
      icon: CheckCircle,
      color: 'bg-teal-500',
      description: 'From qualified calls',
    },
  ] : [];

  const statCards = [...leadStatCards, ...callStatCards];
  const gridCols = showCallStats ? 'lg:grid-cols-7' : 'lg:grid-cols-5';

  if (loading) {
    return (
      <div className={`grid grid-cols-1 gap-5 sm:grid-cols-2 ${gridCols}`}>
        {[...Array(showCallStats ? 7 : 5)].map((_, i) => (
          <div key={i} className="bg-white overflow-hidden shadow rounded-lg animate-pulse">
            <div className="p-5">
              <div className="flex items-center">
                <div className="h-12 w-12 bg-gray-200 rounded-md"></div>
                <div className="ml-5 w-full">
                  <div className="h-4 bg-gray-200 rounded w-20 mb-2"></div>
                  <div className="h-6 bg-gray-200 rounded w-24"></div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 gap-5 sm:grid-cols-2 ${gridCols}`}>
      {statCards.map((stat) => {
        const Icon = stat.icon;
        return (
          <div key={stat.name} className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className={`flex-shrink-0 ${stat.color} rounded-md p-3`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      {stat.name}
                    </dt>
                    <dd className="text-lg font-semibold text-gray-900">
                      {stat.value}
                    </dd>
                  </dl>
                </div>
              </div>
              <div className="mt-2">
                <p className="text-xs text-gray-500">{stat.description}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
