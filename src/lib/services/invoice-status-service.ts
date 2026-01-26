/**
 * Invoice Status Service
 *
 * WHY: Manages invoice status transitions with state machine validation.
 *      Ensures only valid transitions occur and maintains full audit trail.
 *
 * WHEN: Use this service for ANY invoice status change, whether from:
 *       - Admin UI actions (send, cancel, dispute)
 *       - System automated processes (overdue marking)
 *       - Payment processing (partial/full payment)
 *
 * HOW: Call changeInvoiceStatus() with invoice ID and new status.
 *      Service validates transition, updates status, and records history.
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { InvoiceStatus, Prisma } from '@prisma/client';

/** Valid status transitions map (state machine) */
const VALID_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  DRAFT: ['SENT', 'CANCELLED'],
  SENT: ['PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED', 'DISPUTED'],
  PARTIALLY_PAID: ['PAID', 'OVERDUE', 'DISPUTED'],
  PAID: [], // Terminal state
  OVERDUE: ['PARTIALLY_PAID', 'PAID', 'CANCELLED', 'DISPUTED'],
  CANCELLED: [], // Terminal state
  DISPUTED: ['SENT', 'PAID', 'CANCELLED'], // Can resolve dispute
};

/** Change source types */
export type ChangeSource = 'ADMIN' | 'SYSTEM' | 'WEBHOOK';

/** Parameters for status change */
export interface StatusChangeParams {
  invoiceId: string;
  newStatus: InvoiceStatus;
  reason?: string;
  adminId?: string;
  changeSource?: ChangeSource;
  ipAddress?: string;
}

/** Result of status change operation */
export interface StatusChangeResult {
  success: boolean;
  invoice?: {
    id: string;
    invoiceNumber: string;
    status: InvoiceStatus;
    issuedAt: Date | null;
    dueDate: Date | null;
  };
  error?: string;
}

/**
 * Validates if a status transition is allowed
 *
 * @param currentStatus - Current invoice status
 * @param newStatus - Proposed new status
 * @returns true if transition is valid
 */
export function isValidStatusTransition(
  currentStatus: InvoiceStatus,
  newStatus: InvoiceStatus
): boolean {
  const validTransitions = VALID_TRANSITIONS[currentStatus] || [];
  return validTransitions.includes(newStatus);
}

/**
 * Gets valid next statuses for an invoice
 *
 * @param currentStatus - Current status
 * @returns Array of valid next statuses
 */
export function getValidNextStatuses(currentStatus: InvoiceStatus): InvoiceStatus[] {
  return VALID_TRANSITIONS[currentStatus] || [];
}

/**
 * Checks if a status is terminal (no further transitions allowed)
 *
 * @param status - Status to check
 * @returns true if terminal status
 */
export function isTerminalStatus(status: InvoiceStatus): boolean {
  return VALID_TRANSITIONS[status]?.length === 0;
}

/**
 * Adds days to a date
 *
 * @param date - Starting date
 * @param days - Number of days to add
 * @returns New date
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Changes invoice status with full validation and history recording
 *
 * This is the primary method for changing invoice status. It:
 * 1. Validates the transition is allowed
 * 2. Updates the invoice record with relevant dates
 * 3. Creates a history entry
 * 4. All within a transaction for atomicity
 *
 * @param params - Status change parameters
 * @returns Result with updated invoice or error
 */
export async function changeInvoiceStatus(
  params: StatusChangeParams
): Promise<StatusChangeResult> {
  const {
    invoiceId,
    newStatus,
    reason,
    adminId,
    changeSource = 'ADMIN',
    ipAddress,
  } = params;

  try {
    // Get current invoice
    const currentInvoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!currentInvoice) {
      return { success: false, error: 'Invoice not found' };
    }

    const currentStatus = currentInvoice.status;

    // Validate status transition
    if (!isValidStatusTransition(currentStatus, newStatus)) {
      const validOptions = getValidNextStatuses(currentStatus);
      return {
        success: false,
        error: `Invalid status transition from ${currentStatus} to ${newStatus}. Valid transitions: ${validOptions.join(', ') || 'none (terminal state)'}`,
      };
    }

    // Require admin for manual changes
    if (changeSource === 'ADMIN' && !adminId) {
      return { success: false, error: 'Admin ID required for manual status changes' };
    }

    // Build update data based on new status
    const updateData: Prisma.InvoiceUpdateInput = {
      status: newStatus,
    };

    // Set relevant dates based on status
    if (newStatus === 'SENT') {
      const now = new Date();
      updateData.issuedAt = now;
      updateData.sentAt = now;
      updateData.sentBy = adminId ? { connect: { id: adminId } } : undefined;
      updateData.dueDate = addDays(now, currentInvoice.paymentTermsDays);
    }

    if (newStatus === 'CANCELLED') {
      updateData.cancelledAt = new Date();
      updateData.cancelledBy = adminId ? { connect: { id: adminId } } : undefined;
      if (reason) {
        updateData.cancellationReason = reason;
      }
    }

    if (newStatus === 'PAID') {
      updateData.paidInFullAt = new Date();
    }

    // Perform atomic update with optimistic locking
    const result = await prisma.$transaction(async (tx) => {
      // Use updateMany with version check for optimistic locking
      const updateResult = await tx.invoice.updateMany({
        where: {
          id: invoiceId,
          status: currentStatus, // Only update if status hasn't changed
        },
        data: updateData,
      });

      // If no rows updated, status changed between read and write
      if (updateResult.count === 0) {
        throw new Error(
          `Race condition: Invoice status changed from ${currentStatus} before update could complete. Please retry.`
        );
      }

      // Fetch updated invoice
      const updatedInvoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          issuedAt: true,
          dueDate: true,
        },
      });

      // Record history
      await tx.invoiceStatusHistory.create({
        data: {
          invoiceId,
          oldStatus: currentStatus,
          newStatus,
          reason,
          changedById: adminId || null,
          changeSource,
          ipAddress: ipAddress || null,
        },
      });

      return updatedInvoice;
    });

    logger.info('Invoice status changed', {
      invoiceId,
      invoiceNumber: result?.invoiceNumber,
      oldStatus: currentStatus,
      newStatus,
      adminId,
      changeSource,
    });

    return {
      success: true,
      invoice: result
        ? {
            id: result.id,
            invoiceNumber: result.invoiceNumber,
            status: result.status,
            issuedAt: result.issuedAt,
            dueDate: result.dueDate,
          }
        : undefined,
    };
  } catch (error) {
    logger.error('Failed to change invoice status', {
      invoiceId,
      newStatus,
      error: (error as Error).message,
    });

    return {
      success: false,
      error: `Failed to change status: ${(error as Error).message}`,
    };
  }
}

/**
 * Sends an invoice (transitions from DRAFT to SENT)
 *
 * Convenience method that handles all the SENT status setup.
 *
 * @param invoiceId - Invoice to send
 * @param adminId - Admin performing the action
 * @param ipAddress - Optional IP address for audit
 * @returns Result with sent invoice or error
 */
export async function sendInvoice(
  invoiceId: string,
  adminId: string,
  ipAddress?: string
): Promise<StatusChangeResult> {
  return changeInvoiceStatus({
    invoiceId,
    newStatus: 'SENT',
    adminId,
    changeSource: 'ADMIN',
    ipAddress,
    reason: 'Invoice sent to recipient',
  });
}

/**
 * Cancels an invoice (transitions to CANCELLED)
 *
 * @param invoiceId - Invoice to cancel
 * @param adminId - Admin performing the action
 * @param reason - Required reason for cancellation
 * @param ipAddress - Optional IP address for audit
 * @returns Result with cancelled invoice or error
 */
export async function cancelInvoice(
  invoiceId: string,
  adminId: string,
  reason: string,
  ipAddress?: string
): Promise<StatusChangeResult> {
  if (!reason || reason.trim().length === 0) {
    return { success: false, error: 'Cancellation reason is required' };
  }

  return changeInvoiceStatus({
    invoiceId,
    newStatus: 'CANCELLED',
    adminId,
    reason,
    changeSource: 'ADMIN',
    ipAddress,
  });
}

/**
 * Marks invoices as overdue (system-triggered)
 *
 * Finds all SENT or PARTIALLY_PAID invoices past due date and marks overdue.
 *
 * @returns Number of invoices marked overdue
 */
export async function markOverdueInvoices(): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find overdue invoices
  const overdueInvoices = await prisma.invoice.findMany({
    where: {
      status: { in: ['SENT', 'PARTIALLY_PAID'] },
      dueDate: { lt: today },
    },
    select: { id: true, invoiceNumber: true, status: true },
  });

  let count = 0;

  for (const invoice of overdueInvoices) {
    const result = await changeInvoiceStatus({
      invoiceId: invoice.id,
      newStatus: 'OVERDUE',
      changeSource: 'SYSTEM',
      reason: 'Invoice past due date',
    });

    if (result.success) {
      count++;
      logger.info('Invoice marked overdue', {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
      });
    }
  }

  return count;
}

/**
 * Gets the full status history for an invoice
 *
 * @param invoiceId - Invoice ID
 * @returns Array of status history entries
 */
export async function getInvoiceStatusHistory(invoiceId: string) {
  return prisma.invoiceStatusHistory.findMany({
    where: { invoiceId },
    include: {
      changedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}
