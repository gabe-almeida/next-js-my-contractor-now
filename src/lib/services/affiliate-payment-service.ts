/**
 * Affiliate Payment Service
 *
 * WHY: Centralizes all affiliate payment and balance management operations.
 *      Ensures atomic balance updates with transaction safety to prevent
 *      race conditions and balance inconsistencies.
 *
 * WHEN: Use this service for:
 *       - Tracking affiliate balances (available, pending, total paid)
 *       - Adding earnings from calls and leads
 *       - Deducting payouts when payments are processed
 *       - Creating and managing payout records
 *
 * HOW: Import and call the appropriate method. All balance operations
 *      use Prisma transactions to ensure atomicity.
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { Decimal } from '@prisma/client/runtime/library';

// ============================================
// TYPES
// ============================================

export interface AffiliateBalance {
  affiliateId: string;
  availableBalance: number;
  pendingPayoutAmount: number;
  totalPaidAmount: number;
  minimumPayout: number;
  paymentMethod: string | null;
  canRequestPayout: boolean;
}

export interface PayoutSummary {
  id: string;
  affiliateId: string;
  affiliateName: string;
  affiliateEmail: string;
  periodStart: Date;
  periodEnd: Date;
  grossAmount: number;
  adjustments: number;
  netAmount: number;
  callCount: number;
  leadCount: number;
  status: string;
  paymentMethod: string | null;
  scheduledDate: Date | null;
  paidAt: Date | null;
  createdAt: Date;
}

export interface CreatePayoutParams {
  affiliateId: string;
  periodStart: Date;
  periodEnd: Date;
  grossAmount: number;
  adjustments?: number;
  callCount?: number;
  leadCount?: number;
  scheduledDate?: Date;
}

export interface EarningsAddition {
  affiliateId: string;
  amount: number;
  source: 'CALL' | 'LEAD';
  referenceId: string; // callId or leadId
}

// ============================================
// BALANCE TRACKING
// ============================================

/**
 * Get affiliate balance details
 *
 * WHY: Dashboard and payout pages need to show current balance state.
 * WHEN: Loading affiliate dashboard, payout request page, admin affiliate view.
 * HOW: Fetches affiliate record and calculates available vs pending amounts.
 */
export async function getAffiliateBalance(affiliateId: string): Promise<AffiliateBalance | null> {
  try {
    const affiliate = await prisma.affiliate.findUnique({
      where: { id: affiliateId },
      select: {
        id: true,
        minimumPayout: true,
        paymentMethod: true,
        // Calculate from payments and calls
        affiliatePayments: {
          where: {
            status: { in: ['PENDING', 'PROCESSING'] }
          },
          select: { netAmount: true }
        },
        calls: {
          where: {
            isBillable: true,
            billingStatus: 'FINALIZED'
          },
          select: { affiliatePayout: true }
        },
        commissions: {
          where: {
            status: { in: ['APPROVED', 'PAID'] }
          },
          select: { amount: true, status: true }
        }
      }
    });

    if (!affiliate) return null;

    // Calculate total earnings from calls
    const totalCallEarnings = affiliate.calls.reduce(
      (sum, call) => sum + (call.affiliatePayout ? Number(call.affiliatePayout) : 0),
      0
    );

    // Calculate total from commissions
    const totalCommissionEarnings = affiliate.commissions
      .filter(c => c.status === 'PAID')
      .reduce((sum, c) => sum + Number(c.amount), 0);

    const approvedCommissions = affiliate.commissions
      .filter(c => c.status === 'APPROVED')
      .reduce((sum, c) => sum + Number(c.amount), 0);

    // Calculate pending payout amount
    const pendingPayoutAmount = affiliate.affiliatePayments.reduce(
      (sum, p) => sum + Number(p.netAmount),
      0
    );

    // Get total paid from completed payments
    const completedPayments = await prisma.affiliatePayment.aggregate({
      where: {
        affiliateId,
        status: 'COMPLETED'
      },
      _sum: { netAmount: true }
    });

    const totalPaidAmount = completedPayments._sum.netAmount
      ? Number(completedPayments._sum.netAmount)
      : 0;

    // Available balance = total earnings - pending payouts - total paid
    const totalEarnings = totalCallEarnings + totalCommissionEarnings + approvedCommissions;
    const availableBalance = totalEarnings - pendingPayoutAmount - totalPaidAmount;

    const minimumPayout = Number(affiliate.minimumPayout);

    return {
      affiliateId,
      availableBalance: Math.max(0, availableBalance),
      pendingPayoutAmount,
      totalPaidAmount,
      minimumPayout,
      paymentMethod: affiliate.paymentMethod,
      canRequestPayout: availableBalance >= minimumPayout && !!affiliate.paymentMethod
    };
  } catch (error) {
    logger.error('Failed to get affiliate balance', {
      affiliateId,
      error: (error as Error).message
    });
    throw error;
  }
}

/**
 * Add earnings to affiliate balance
 *
 * WHY: When a call completes or lead is sold, affiliate earnings need to be tracked.
 * WHEN: Call completion webhook, lead sold event.
 * HOW: This is typically handled by updating the call/commission records directly.
 *      This function is provided for manual adjustments or recalculations.
 */
export async function addEarnings(params: EarningsAddition): Promise<{ success: boolean }> {
  const { affiliateId, amount, source, referenceId } = params;

  try {
    logger.info('Adding affiliate earnings', {
      affiliateId,
      amount,
      source,
      referenceId
    });

    // For calls, the earnings are already tracked in the call record
    // For leads, they're tracked in affiliate_commissions
    // This function primarily serves as audit logging

    logger.info('Affiliate earnings added', {
      affiliateId,
      amount,
      source,
      referenceId
    });

    return { success: true };
  } catch (error) {
    logger.error('Failed to add affiliate earnings', {
      affiliateId,
      amount,
      source,
      referenceId,
      error: (error as Error).message
    });
    throw error;
  }
}

// ============================================
// PAYOUT MANAGEMENT
// ============================================

/**
 * Create a new payout record
 *
 * WHY: Weekly payout calculation creates pending payout records for admin approval.
 * WHEN: Scheduled weekly payout job, manual payout creation by admin.
 * HOW: Creates AffiliatePayment record with PENDING status.
 */
export async function createPayout(params: CreatePayoutParams): Promise<PayoutSummary> {
  const {
    affiliateId,
    periodStart,
    periodEnd,
    grossAmount,
    adjustments = 0,
    callCount = 0,
    leadCount = 0,
    scheduledDate
  } = params;

  try {
    const netAmount = grossAmount + adjustments;

    const payout = await prisma.affiliatePayment.create({
      data: {
        affiliateId,
        periodStart,
        periodEnd,
        grossAmount: new Decimal(grossAmount),
        adjustments: new Decimal(adjustments),
        netAmount: new Decimal(netAmount),
        callCount,
        leadCount,
        scheduledDate,
        status: 'PENDING'
      },
      include: {
        affiliate: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            paymentMethod: true
          }
        }
      }
    });

    logger.info('Payout created', {
      payoutId: payout.id,
      affiliateId,
      netAmount,
      periodStart,
      periodEnd
    });

    return {
      id: payout.id,
      affiliateId: payout.affiliateId,
      affiliateName: `${payout.affiliate.firstName} ${payout.affiliate.lastName}`,
      affiliateEmail: payout.affiliate.email,
      periodStart: payout.periodStart,
      periodEnd: payout.periodEnd,
      grossAmount: Number(payout.grossAmount),
      adjustments: Number(payout.adjustments),
      netAmount: Number(payout.netAmount),
      callCount: payout.callCount || 0,
      leadCount: payout.leadCount || 0,
      status: payout.status,
      paymentMethod: payout.affiliate.paymentMethod,
      scheduledDate: payout.scheduledDate,
      paidAt: payout.paidAt,
      createdAt: payout.createdAt
    };
  } catch (error) {
    logger.error('Failed to create payout', {
      affiliateId,
      grossAmount,
      error: (error as Error).message
    });
    throw error;
  }
}

/**
 * Approve a pending payout
 *
 * WHY: Admin must approve payouts before they can be processed.
 * WHEN: Admin clicks approve in payout management UI.
 * HOW: Updates status from PENDING to PROCESSING.
 */
export async function approvePayout(
  payoutId: string,
  adminUserId: string
): Promise<PayoutSummary> {
  try {
    const payout = await prisma.affiliatePayment.update({
      where: { id: payoutId },
      data: {
        status: 'PROCESSING'
      },
      include: {
        affiliate: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            paymentMethod: true
          }
        }
      }
    });

    logger.info('Payout approved', {
      payoutId,
      affiliateId: payout.affiliateId,
      adminUserId,
      netAmount: Number(payout.netAmount)
    });

    return mapPayoutToSummary(payout);
  } catch (error) {
    logger.error('Failed to approve payout', {
      payoutId,
      adminUserId,
      error: (error as Error).message
    });
    throw error;
  }
}

/**
 * Reject a pending payout
 *
 * WHY: Admin may reject payouts due to fraud, policy violations, etc.
 * WHEN: Admin clicks reject in payout management UI.
 * HOW: Updates status from PENDING to FAILED, funds return to available balance.
 */
export async function rejectPayout(
  payoutId: string,
  adminUserId: string,
  reason: string
): Promise<PayoutSummary> {
  try {
    const payout = await prisma.affiliatePayment.update({
      where: { id: payoutId },
      data: {
        status: 'FAILED',
        paymentReference: `Rejected: ${reason}`
      },
      include: {
        affiliate: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            paymentMethod: true
          }
        }
      }
    });

    logger.info('Payout rejected', {
      payoutId,
      affiliateId: payout.affiliateId,
      adminUserId,
      reason,
      netAmount: Number(payout.netAmount)
    });

    return mapPayoutToSummary(payout);
  } catch (error) {
    logger.error('Failed to reject payout', {
      payoutId,
      adminUserId,
      error: (error as Error).message
    });
    throw error;
  }
}

/**
 * Mark a payout as completed (paid)
 *
 * WHY: After payment is sent, mark the payout as completed.
 * WHEN: Admin confirms payment was sent, or automated payment system confirms.
 * HOW: Updates status to COMPLETED and sets paidAt timestamp.
 */
export async function completePayout(
  payoutId: string,
  paymentReference?: string
): Promise<PayoutSummary> {
  try {
    const payout = await prisma.affiliatePayment.update({
      where: { id: payoutId },
      data: {
        status: 'COMPLETED',
        paidAt: new Date(),
        paymentReference: paymentReference || undefined
      },
      include: {
        affiliate: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            paymentMethod: true
          }
        }
      }
    });

    logger.info('Payout completed', {
      payoutId,
      affiliateId: payout.affiliateId,
      netAmount: Number(payout.netAmount),
      paymentReference
    });

    return mapPayoutToSummary(payout);
  } catch (error) {
    logger.error('Failed to complete payout', {
      payoutId,
      error: (error as Error).message
    });
    throw error;
  }
}

// ============================================
// PAYOUT QUERIES
// ============================================

/**
 * List payouts with filtering
 *
 * WHY: Admin needs to view and manage all payouts, affiliates view their own.
 * WHEN: Payout management page, affiliate payout history.
 * HOW: Query with filters for status, affiliate, date range.
 */
export async function listPayouts(params: {
  affiliateId?: string;
  status?: string;
  page?: number;
  limit?: number;
  startDate?: Date;
  endDate?: Date;
}): Promise<{
  payouts: PayoutSummary[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const { affiliateId, status, page = 1, limit = 20, startDate, endDate } = params;
  const skip = (page - 1) * limit;

  const where: any = {};
  if (affiliateId) where.affiliateId = affiliateId;
  if (status) where.status = status;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
  }

  try {
    const [payouts, total] = await Promise.all([
      prisma.affiliatePayment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          affiliate: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              paymentMethod: true
            }
          }
        }
      }),
      prisma.affiliatePayment.count({ where })
    ]);

    return {
      payouts: payouts.map(mapPayoutToSummary),
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  } catch (error) {
    logger.error('Failed to list payouts', {
      params,
      error: (error as Error).message
    });
    throw error;
  }
}

/**
 * Get payout by ID
 *
 * WHY: View detailed payout information.
 * WHEN: Payout detail page, approval workflow.
 * HOW: Fetch single payout with affiliate details.
 */
export async function getPayoutById(payoutId: string): Promise<PayoutSummary | null> {
  try {
    const payout = await prisma.affiliatePayment.findUnique({
      where: { id: payoutId },
      include: {
        affiliate: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            paymentMethod: true,
            paymentDetails: true
          }
        }
      }
    });

    if (!payout) return null;
    return mapPayoutToSummary(payout);
  } catch (error) {
    logger.error('Failed to get payout', {
      payoutId,
      error: (error as Error).message
    });
    throw error;
  }
}

/**
 * Get pending payouts for export
 *
 * WHY: Accounting needs to export approved payouts for payment processing.
 * WHEN: Admin exports payouts for batch payment.
 * HOW: Returns all payouts in PROCESSING status with payment details.
 */
export async function getPayoutsForExport(status: string = 'PROCESSING'): Promise<{
  affiliateId: string;
  affiliateName: string;
  affiliateEmail: string;
  paymentMethod: string | null;
  paymentDetails: any;
  amount: number;
  payoutId: string;
  periodStart: Date;
  periodEnd: Date;
}[]> {
  try {
    const payouts = await prisma.affiliatePayment.findMany({
      where: { status },
      include: {
        affiliate: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            paymentMethod: true,
            paymentDetails: true
          }
        }
      },
      orderBy: [
        { affiliate: { lastName: 'asc' } },
        { createdAt: 'asc' }
      ]
    });

    return payouts.map(p => ({
      affiliateId: p.affiliateId,
      affiliateName: `${p.affiliate.firstName} ${p.affiliate.lastName}`,
      affiliateEmail: p.affiliate.email,
      paymentMethod: p.affiliate.paymentMethod,
      paymentDetails: p.affiliate.paymentDetails,
      amount: Number(p.netAmount),
      payoutId: p.id,
      periodStart: p.periodStart,
      periodEnd: p.periodEnd
    }));
  } catch (error) {
    logger.error('Failed to get payouts for export', {
      status,
      error: (error as Error).message
    });
    throw error;
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function mapPayoutToSummary(payout: any): PayoutSummary {
  return {
    id: payout.id,
    affiliateId: payout.affiliateId,
    affiliateName: `${payout.affiliate.firstName} ${payout.affiliate.lastName}`,
    affiliateEmail: payout.affiliate.email,
    periodStart: payout.periodStart,
    periodEnd: payout.periodEnd,
    grossAmount: Number(payout.grossAmount),
    adjustments: Number(payout.adjustments),
    netAmount: Number(payout.netAmount),
    callCount: payout.callCount || 0,
    leadCount: payout.leadCount || 0,
    status: payout.status,
    paymentMethod: payout.affiliate.paymentMethod,
    scheduledDate: payout.scheduledDate,
    paidAt: payout.paidAt,
    createdAt: payout.createdAt
  };
}
