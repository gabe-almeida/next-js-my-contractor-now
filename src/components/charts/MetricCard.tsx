'use client';

import { ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface TrendObject {
  value: number;
  label?: string;
  direction?: 'up' | 'down';
}

interface MetricCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  trend?: number | TrendObject;
  trendLabel?: string;
  description?: string;
  className?: string;
  loading?: boolean;
}

export function MetricCard({
  title,
  value,
  icon,
  trend,
  trendLabel,
  description,
  className = '',
  loading = false
}: MetricCardProps) {
  if (loading) {
    return (
      <div className={'bg-white rounded-lg shadow p-6 animate-pulse ' + className}>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
            <div className="h-8 bg-gray-200 rounded w-32 mt-2"></div>
            <div className="h-4 bg-gray-200 rounded w-20 mt-2"></div>
          </div>
          <div className="flex-shrink-0 ml-4">
            <div className="p-3 bg-gray-200 rounded-lg w-10 h-10"></div>
          </div>
        </div>
      </div>
    );
  }
  // Extract trend value and properties whether it's a number or TrendObject
  const trendValue = typeof trend === 'object' ? trend.value : trend;
  const trendDirection = typeof trend === 'object' ? trend.direction : undefined;
  const trendLabelText = typeof trend === 'object' ? trend.label : trendLabel;

  // Determine effective direction (explicit direction overrides value-based)
  const getEffectiveDirection = (): 'up' | 'down' | 'neutral' => {
    if (trendDirection) return trendDirection === 'up' ? 'up' : 'down';
    if (trendValue === undefined || trendValue === 0) return 'neutral';
    return trendValue > 0 ? 'up' : 'down';
  };

  const effectiveDirection = getEffectiveDirection();

  const getTrendIcon = () => {
    if (effectiveDirection === 'neutral') {
      return <Minus className="h-4 w-4 text-gray-400" />;
    }
    return effectiveDirection === 'up' ? (
      <TrendingUp className="h-4 w-4 text-green-500" />
    ) : (
      <TrendingDown className="h-4 w-4 text-red-500" />
    );
  };

  const getTrendColor = () => {
    if (effectiveDirection === 'neutral') return 'text-gray-500';
    return effectiveDirection === 'up' ? 'text-green-600' : 'text-red-600';
  };

  const trendColorClass = getTrendColor();

  return (
    <div className={'bg-white rounded-lg shadow p-6 ' + className}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
          {(trendValue !== undefined || description) && (
            <div className="mt-2 flex items-center">
              {trendValue !== undefined && (
                <>
                  {getTrendIcon()}
                  <span className={'ml-1 text-sm font-medium ' + trendColorClass}>
                    {trendValue > 0 ? '+' : ''}{trendValue}%
                  </span>
                  {trendLabelText && (
                    <span className="ml-1 text-sm text-gray-500">{trendLabelText}</span>
                  )}
                </>
              )}
              {description && !trendValue && (
                <span className="text-sm text-gray-500">{description}</span>
              )}
            </div>
          )}
        </div>
        {icon && (
          <div className="flex-shrink-0 ml-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              {icon}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
