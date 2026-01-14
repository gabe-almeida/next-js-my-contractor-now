'use client';

/**
 * AdminBadge - Consistent badge styling for status indicators
 *
 * WHY: Centralizes badge styling for consistent UI across admin panel.
 * WHEN: Used for lead status, disposition, transaction status, etc.
 * HOW: Maps status values to color schemes automatically.
 */

import { memo } from 'react';

type BadgeVariant = 'status' | 'disposition' | 'default';

interface AdminBadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  color?: 'green' | 'red' | 'yellow' | 'blue' | 'orange' | 'purple' | 'gray';
}

const colorStyles = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  red: 'bg-red-50 text-red-700 ring-red-600/20',
  yellow: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  blue: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  orange: 'bg-orange-50 text-orange-700 ring-orange-600/20',
  purple: 'bg-purple-50 text-purple-700 ring-purple-600/20',
  gray: 'bg-gray-50 text-gray-700 ring-gray-600/20',
};

export const AdminBadge = memo(function AdminBadge({
  children,
  color = 'gray',
}: AdminBadgeProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ring-1 ring-inset ${colorStyles[color]}`}>
      {children}
    </span>
  );
});

// Status badge with automatic color mapping
const statusColorMap: Record<string, AdminBadgeProps['color']> = {
  // Lead statuses
  PENDING: 'yellow',
  PROCESSING: 'blue',
  AUCTIONED: 'blue',
  AUCTION_COMPLETE: 'green',
  SOLD: 'green',
  POSTED: 'purple',
  REJECTED: 'red',
  EXPIRED: 'gray',
  FAILED: 'red',
  DELIVERY_FAILED: 'red',
  SCRUBBED: 'red',
  DUPLICATE: 'orange',
  // Generic active/inactive
  ACTIVE: 'green',
  INACTIVE: 'gray',
  // Affiliate statuses
  SUSPENDED: 'red',
  // Transaction statuses
  SUCCESS: 'green',
  TIMEOUT: 'orange',
  INFO: 'blue',
};

interface StatusBadgeProps {
  status: string;
}

export const StatusBadge = memo(function StatusBadge({ status }: StatusBadgeProps) {
  const color = statusColorMap[status] || 'gray';
  const displayText = status.replace(/_/g, ' ');

  return (
    <AdminBadge color={color}>
      {displayText}
    </AdminBadge>
  );
});

// Disposition badge with automatic color mapping
const dispositionColorMap: Record<string, AdminBadgeProps['color']> = {
  NEW: 'blue',
  DELIVERED: 'green',
  RETURNED: 'yellow',
  DISPUTED: 'orange',
  CREDITED: 'purple',
  WRITTEN_OFF: 'red',
};

interface DispositionBadgeProps {
  disposition: string;
}

export const DispositionBadge = memo(function DispositionBadge({ disposition }: DispositionBadgeProps) {
  const color = dispositionColorMap[disposition] || 'gray';
  const displayText = disposition.replace(/_/g, ' ');

  return (
    <AdminBadge color={color}>
      {displayText}
    </AdminBadge>
  );
});
