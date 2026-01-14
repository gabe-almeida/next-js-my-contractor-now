'use client';

/**
 * AdminDetailPageHeader - Header for detail pages (buyer detail, affiliate detail, etc.)
 *
 * WHY: Provides consistent header styling for all admin detail pages with back navigation.
 * WHEN: Used at the top of detail pages like /admin/buyers/[id], /admin/affiliates/[id].
 * HOW: Renders back button, title, badges, status, and action buttons.
 */

import { memo, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { ArrowLeft, RefreshCw } from 'lucide-react';

interface BadgeConfig {
  label: string;
  variant: 'blue' | 'purple' | 'green' | 'gray' | 'red' | 'orange' | 'yellow';
}

interface AdminDetailPageHeaderProps {
  title: string;
  subtitle?: string;
  badges?: BadgeConfig[];
  backHref?: string;
  backLabel?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  actions?: ReactNode;
}

const badgeStyles: Record<BadgeConfig['variant'], string> = {
  blue: 'bg-blue-100 text-blue-800',
  purple: 'bg-purple-100 text-purple-800',
  green: 'bg-green-100 text-green-800',
  gray: 'bg-gray-100 text-gray-600',
  red: 'bg-red-100 text-red-800',
  orange: 'bg-orange-100 text-orange-800',
  yellow: 'bg-amber-100 text-amber-800',
};

export const AdminDetailPageHeader = memo(function AdminDetailPageHeader({
  title,
  subtitle,
  badges = [],
  backHref,
  backLabel = 'Back',
  onRefresh,
  refreshing = false,
  actions,
}: AdminDetailPageHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (backHref) {
      router.push(backHref);
    } else {
      router.back();
    }
  };

  return (
    <div className="mb-6">
      {/* Orange accent line */}
      <div className="h-1 w-12 bg-gradient-to-r from-orange-400 to-orange-500 rounded-full mb-4" />

      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          {/* Back button */}
          <Button
            variant="ghost"
            onClick={handleBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 -ml-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{backLabel}</span>
          </Button>

          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                {title}
              </h1>
              {badges.map((badge, index) => (
                <span
                  key={index}
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeStyles[badge.variant]}`}
                >
                  {badge.label}
                </span>
              ))}
            </div>
            {subtitle && (
              <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {onRefresh && (
            <Button
              variant="ghost"
              onClick={onRefresh}
              disabled={refreshing}
              className="text-gray-400 hover:text-gray-600"
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          )}
          {actions}
        </div>
      </div>
    </div>
  );
});
