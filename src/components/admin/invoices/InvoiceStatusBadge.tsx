'use client';

/**
 * InvoiceStatusBadge - Colored badge for invoice status display
 *
 * WHY: Provides consistent visual representation of invoice statuses across the admin UI.
 * WHEN: Used in invoice tables, detail pages, and anywhere invoice status is displayed.
 * HOW: Maps InvoiceStatus enum values to specific colors for quick visual recognition.
 *
 * Color Mapping:
 * - DRAFT: gray (not finalized)
 * - SENT: blue (active, awaiting payment)
 * - PARTIALLY_PAID: yellow (in progress)
 * - PAID: green (completed)
 * - OVERDUE: red (requires attention)
 * - CANCELLED: gray (voided)
 * - DISPUTED: orange (needs resolution)
 */

import { memo } from 'react';
import { AdminBadge } from '../ui/AdminBadge';

// Invoice status types matching Prisma enum
export type InvoiceStatus =
  | 'DRAFT'
  | 'SENT'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'OVERDUE'
  | 'CANCELLED'
  | 'DISPUTED';

// Color mapping for invoice statuses
const statusColorMap: Record<InvoiceStatus, 'green' | 'red' | 'yellow' | 'blue' | 'orange' | 'purple' | 'gray'> = {
  DRAFT: 'gray',
  SENT: 'blue',
  PARTIALLY_PAID: 'yellow',
  PAID: 'green',
  OVERDUE: 'red',
  CANCELLED: 'gray',
  DISPUTED: 'orange',
};

// Human-readable labels for statuses
const statusLabelMap: Record<InvoiceStatus, string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  PARTIALLY_PAID: 'Partially Paid',
  PAID: 'Paid',
  OVERDUE: 'Overdue',
  CANCELLED: 'Cancelled',
  DISPUTED: 'Disputed',
};

interface InvoiceStatusBadgeProps {
  /** The invoice status to display */
  status: InvoiceStatus | string;
  /** Optional: Show days overdue for OVERDUE status */
  daysOverdue?: number;
}

export const InvoiceStatusBadge = memo(function InvoiceStatusBadge({
  status,
  daysOverdue,
}: InvoiceStatusBadgeProps) {
  // Normalize status to uppercase for safety
  const normalizedStatus = status.toUpperCase() as InvoiceStatus;
  const color = statusColorMap[normalizedStatus] || 'gray';
  const label = statusLabelMap[normalizedStatus] || status.replace(/_/g, ' ');

  // Show days overdue if applicable
  const displayText = normalizedStatus === 'OVERDUE' && daysOverdue !== undefined
    ? `${label} (${daysOverdue} days)`
    : label;

  return (
    <AdminBadge color={color}>
      {displayText}
    </AdminBadge>
  );
});

export default InvoiceStatusBadge;
