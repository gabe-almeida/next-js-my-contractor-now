'use client';

/**
 * Affiliate Dashboard Stats Component
 *
 * WHY: Provides visual summary of affiliate performance metrics.
 * WHEN: Displayed on affiliate dashboard for quick performance overview.
 * HOW: Fetches stats from API, displays as card grid with icons and values.
 */

import { DollarSign, Clock, Wallet, MousePointerClick, Users } from 'lucide-react';

interface StatsData {
  totalEarnings: number;
  pendingEarnings: number;
  availableBalance: number;
  totalClicks: number;
  totalConversions: number;
  conversionRate: number;
}

interface DashboardStatsProps {
  stats: StatsData | null;
  loading?: boolean;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

export function DashboardStats({ stats, loading }: DashboardStatsProps) {
  const statCards = [
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

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
        {[...Array(5)].map((_, i) => (
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
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
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
