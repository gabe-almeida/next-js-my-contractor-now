'use client';

/**
 * AdminPageHeader - Consistent page header for admin pages
 *
 * WHY: Provides uniform header styling across all admin pages.
 * WHEN: Used at the top of every admin page.
 * HOW: Renders title, description, action buttons, and optional timestamp.
 */

import { memo, ReactNode } from 'react';

interface AdminPageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  lastUpdated?: Date;
}

export const AdminPageHeader = memo(function AdminPageHeader({
  title,
  description,
  actions,
  lastUpdated,
}: AdminPageHeaderProps) {
  return (
    <div className="mb-6">
      {/* Orange accent line */}
      <div className="h-1 w-12 bg-gradient-to-r from-orange-400 to-orange-500 rounded-full mb-4" />

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-sm text-gray-500">{description}</p>
          )}
        </div>

        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-gray-400">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          {actions}
        </div>
      </div>
    </div>
  );
});
