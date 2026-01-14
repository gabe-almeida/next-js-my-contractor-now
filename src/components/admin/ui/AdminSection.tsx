'use client';

/**
 * AdminSection - Content section wrapper for admin pages
 *
 * WHY: Provides consistent section styling with title and optional actions.
 * WHEN: Used to wrap content sections on detail pages and dashboards.
 * HOW: Renders a card-like container with optional header and actions.
 */

import { memo, ReactNode } from 'react';

interface AdminSectionProps {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}

export const AdminSection = memo(function AdminSection({
  title,
  description,
  actions,
  children,
  className = '',
  noPadding = false,
}: AdminSectionProps) {
  return (
    <div className={`bg-white rounded-xl border border-gray-100 shadow-sm ${className}`}>
      {(title || actions) && (
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              {title && (
                <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
              )}
              {description && (
                <p className="text-sm text-gray-500 mt-0.5">{description}</p>
              )}
            </div>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
          </div>
        </div>
      )}
      <div className={noPadding ? '' : 'p-6'}>{children}</div>
    </div>
  );
});
