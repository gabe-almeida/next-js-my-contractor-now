/**
 * Lead Accounting Service
 *
 * WHY: Centralizes all lead status/disposition changes with full audit trail.
 *      Ensures consistent history recording regardless of where changes originate.
 *
 * WHEN: Use this service for ANY lead status or disposition change, whether from:
 *       - Admin UI actions
 *       - System/worker automated processes
 *       - Webhook callbacks from buyers
 *
 * HOW: Import and call the appropriate method. All methods automatically:
 *      - Validate status transitions
 *      - Record to lead_status_history table
 *      - Update the lead record atomically
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import {
  LeadStatus,
  LeadDisposition,
  ChangeSource,
  LeadStatusHistory,
  Lead
} from '@/types/database';

// Valid status transitions map
// Matches actual worker flow: PENDING → PROCESSING → SOLD/REJECTED/DELIVERY_FAILED
const VALID_STATUS_TRANSITIONS: Record<string, LeadStatus[]> = {
  [LeadStatus.PENDING]: [LeadStatus.PROCESSING, LeadStatus.REJECTED, LeadStatus.SCRUBBED, LeadStatus.DUPLICATE],
  [LeadStatus.PROCESSING]: [LeadStatus.SOLD, LeadStatus.REJECTED, LeadStatus.EXPIRED, LeadStatus.DELIVERY_FAILED, LeadStatus.SCRUBBED],
  [LeadStatus.AUCTIONED]: [LeadStatus.SOLD, LeadStatus.REJECTED, LeadStatus.EXPIRED, LeadStatus.SCRUBBED],
  [LeadStatus.SOLD]: [LeadStatus.SCRUBBED], // Can only scrub after sold
  [LeadStatus.REJECTED]: [LeadStatus.PROCESSING, LeadStatus.SCRUBBED], // Can reprocess or scrub
  [LeadStatus.EXPIRED]: [LeadStatus.PROCESSING, LeadStatus.SCRUBBED], // Can reprocess or scrub
  [LeadStatus.DELIVERY_FAILED]: [LeadStatus.PROCESSING, LeadStatus.REJECTED, LeadStatus.SCRUBBED], // Can retry, reject, or scrub
  [LeadStatus.SCRUBBED]: [], // Terminal state
  [LeadStatus.DUPLICATE]: [], // Terminal state
};

// Valid disposition transitions map
const VALID_DISPOSITION_TRANSITIONS: Record<string, LeadDisposition[]> = {
  [LeadDisposition.NEW]: [LeadDisposition.DELIVERED, LeadDisposition.DISPUTED],
  [LeadDisposition.DELIVERED]: [LeadDisposition.RETURNED, LeadDisposition.DISPUTED],
  [LeadDisposition.RETURNED]: [LeadDisposition.CREDITED, LeadDisposition.DISPUTED, LeadDisposition.WRITTEN_OFF],
  [LeadDisposition.DISPUTED]: [LeadDisposition.RETURNED, LeadDisposition.CREDITED, LeadDisposition.DELIVERED, LeadDisposition.WRITTEN_OFF],
  [LeadDisposition.CREDITED]: [], // Terminal state
  [LeadDisposition.WRITTEN_OFF]: [], // Terminal state
};

export interface StatusChangeParams {
  leadId: string;
  newStatus: LeadStatus;
  newDisposition?: LeadDisposition;
  reason: string;
  adminUserId?: string;
  changeSource?: ChangeSource;
  ipAddress?: string;
}

export interface CreditParams {
  leadId: string;
  creditAmount: number;
  reason: string;
  adminUserId: string;
  ipAddress?: string;
}

export interface StatusChangeResult {
  success: boolean;
  lead?: Lead;
  historyEntry?: LeadStatusHistory;
  error?: string;
}

/**
 * Validates if a status transition is allowed
 */
export function isValidStatusTransition(
  currentStatus: LeadStatus,
  newStatus: LeadStatus
): boolean {
  const validTransitions = VALID_STATUS_TRANSITIONS[currentStatus] || [];
  return validTransitions.includes(newStatus);
}

/**
 * Validates if a disposition transition is allowed
 */
export function isValidDispositionTransition(
  currentDisposition: LeadDisposition,
  newDisposition: LeadDisposition
): boolean {
  const validTransitions = VALID_DISPOSITION_TRANSITIONS[currentDisposition] || [];
  return validTransitions.includes(newDisposition);
}

/**
 * Get valid next statuses for a lead
 */
export function getValidNextStatuses(currentStatus: LeadStatus): LeadStatus[] {
  return VALID_STATUS_TRANSITIONS[currentStatus] || [];
}

/**
 * Get valid next dispositions for a lead
 */
export function getValidNextDispositions(currentDisposition: LeadDisposition): LeadDisposition[] {
  return VALID_DISPOSITION_TRANSITIONS[currentDisposition] || [];
}

/**
 * Changes lead status with full history recording
 *
 * This is the primary method for changing lead status. It:
 * 1. Validates the transition is allowed
 * 2. Updates the lead record
 * 3. Creates a history entry
 * 4. All within a transaction for atomicity
 */
export async function changeLeadStatus(
  params: StatusChangeParams
): Promise<StatusChangeResult> {
  const {
    leadId,
    newStatus,
    newDisposition,
    reason,
    adminUserId,
    changeSource = ChangeSource.ADMIN,
    ipAddress
  } = params;

  try {
    // Get current lead
    const currentLead = await prisma.lead.findUnique({
      where: { id: leadId }
    });

    if (!currentLead) {
      return { success: false, error: 'Lead not found' };
    }

    const currentStatus = currentLead.status as LeadStatus;
    const currentDisposition = currentLead.disposition as LeadDisposition;

    // Validate status transition
    if (!isValidStatusTransition(currentStatus, newStatus)) {
      return {
        success: false,
        error: `Invalid status transition from ${currentStatus} to ${newStatus}. Valid transitions: ${getValidNextStatuses(currentStatus).join(', ') || 'none'}`
      };
    }

    // Validate disposition transition if provided
    if (newDisposition && !isValidDispositionTransition(currentDisposition, newDisposition)) {
      return {
        success: false,
        error: `Invalid disposition transition from ${currentDisposition} to ${newDisposition}. Valid transitions: ${getValidNextDispositions(currentDisposition).join(', ') || 'none'}`
      };
    }

    // Require reason for admin changes
    if (changeSource === ChangeSource.ADMIN && !reason) {
      return { success: false, error: 'Reason is required for admin status changes' };
    }

    // Perform atomic update with optimistic locking to prevent race conditions
    // The updateMany with status check ensures we only update if status hasn't changed
    const result = await prisma.$transaction(async (tx) => {
      // Use updateMany with status check for optimistic locking
      const updateResult = await tx.lead.updateMany({
        where: {
          id: leadId,
          status: currentStatus // Only update if status is still what we read
        },
        data: {
          status: newStatus,
          ...(newDisposition && { disposition: newDisposition })
        }
      });

      // If no rows updated, status changed between read and write (race condition)
      if (updateResult.count === 0) {
        throw new Error(`Race condition: Lead status changed from ${currentStatus} before update could complete. Please retry.`);
      }

      // Fetch the updated lead for return
      const updatedLead = await tx.lead.findUnique({
        where: { id: leadId }
      });

      // Create history entry
      const historyEntry = await tx.leadStatusHistory.create({
        data: {
          leadId,
          adminUserId: adminUserId || null,
          oldStatus: currentStatus,
          newStatus,
          oldDisposition: currentDisposition,
          newDisposition: newDisposition || null,
          reason,
          changeSource,
          ipAddress: ipAddress || null
        }
      });

      return { lead: updatedLead, historyEntry };
    });

    logger.info('Lead status changed', {
      leadId,
      oldStatus: currentStatus,
      newStatus,
      oldDisposition: currentDisposition,
      newDisposition,
      adminUserId,
      changeSource
    });

    return {
      success: true,
      lead: result.lead as unknown as Lead,
      historyEntry: result.historyEntry as unknown as LeadStatusHistory
    };

  } catch (error) {
    logger.error('Failed to change lead status', {
      leadId,
      newStatus,
      error: (error as Error).message
    });

    return {
      success: false,
      error: `Failed to change status: ${(error as Error).message}`
    };
  }
}

/**
 * Issues credit for a lead (typically after scrubbing/return)
 *
 * This automatically:
 * 1. Updates disposition to CREDITED
 * 2. Records the credit amount
 * 3. Creates history entry
 */
export async function issueCredit(
  params: CreditParams
): Promise<StatusChangeResult> {
  const { leadId, creditAmount, reason, adminUserId, ipAddress } = params;

  try {
    // Get current lead
    const currentLead = await prisma.lead.findUnique({
      where: { id: leadId }
    });

    if (!currentLead) {
      return { success: false, error: 'Lead not found' };
    }

    const currentDisposition = currentLead.disposition as LeadDisposition;

    // Validate disposition allows credit
    if (!isValidDispositionTransition(currentDisposition, LeadDisposition.CREDITED)) {
      return {
        success: false,
        error: `Cannot issue credit for lead with disposition ${currentDisposition}. Lead must be RETURNED or DISPUTED first.`
      };
    }

    // Validate credit amount
    if (creditAmount <= 0) {
      return { success: false, error: 'Credit amount must be greater than 0' };
    }

    // Perform atomic update with optimistic locking
    const result = await prisma.$transaction(async (tx) => {
      // Use updateMany with disposition check to prevent race conditions
      const updateResult = await tx.lead.updateMany({
        where: {
          id: leadId,
          disposition: currentDisposition // Only update if disposition hasn't changed
        },
        data: {
          disposition: LeadDisposition.CREDITED,
          creditAmount,
          creditIssuedAt: new Date(),
          creditIssuedById: adminUserId
        }
      });

      // If no rows updated, disposition changed between read and write
      if (updateResult.count === 0) {
        throw new Error(`Race condition: Lead disposition changed from ${currentDisposition} before credit could be issued. Please retry.`);
      }

      // Fetch updated lead for return
      const updatedLead = await tx.lead.findUnique({
        where: { id: leadId }
      });

      // Create history entry
      const historyEntry = await tx.leadStatusHistory.create({
        data: {
          leadId,
          adminUserId,
          oldStatus: currentLead.status,
          newStatus: currentLead.status, // Status doesn't change
          oldDisposition: currentDisposition,
          newDisposition: LeadDisposition.CREDITED,
          reason,
          creditAmount,
          changeSource: ChangeSource.ADMIN,
          ipAddress: ipAddress || null
        }
      });

      return { lead: updatedLead, historyEntry };
    });

    logger.info('Credit issued for lead', {
      leadId,
      creditAmount,
      adminUserId
    });

    return {
      success: true,
      lead: result.lead as unknown as Lead,
      historyEntry: result.historyEntry as unknown as LeadStatusHistory
    };

  } catch (error) {
    logger.error('Failed to issue credit', {
      leadId,
      creditAmount,
      error: (error as Error).message
    });

    return {
      success: false,
      error: `Failed to issue credit: ${(error as Error).message}`
    };
  }
}

/**
 * Gets the full status history for a lead
 */
export async function getLeadStatusHistory(
  leadId: string
): Promise<LeadStatusHistory[]> {
  const history = await prisma.leadStatusHistory.findMany({
    where: { leadId },
    include: {
      adminUser: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  return history as unknown as LeadStatusHistory[];
}

/**
 * Records a system-triggered status change (no admin user)
 *
 * Use this for automated changes from workers, webhooks, etc.
 */
export async function recordSystemStatusChange(
  leadId: string,
  oldStatus: LeadStatus,
  newStatus: LeadStatus,
  reason: string,
  source: ChangeSource = ChangeSource.SYSTEM
): Promise<void> {
  await prisma.leadStatusHistory.create({
    data: {
      leadId,
      adminUserId: null,
      oldStatus,
      newStatus,
      reason,
      changeSource: source
    }
  });
}
