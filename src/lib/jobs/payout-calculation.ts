/**
 * Payout Calculation Job
 *
 * WHY: Automates weekly payout calculations for affiliates.
 *      Aggregates earnings from calls and leads into payout records.
 *
 * WHEN: Run weekly (e.g., every Monday at midnight) via cron or manual trigger.
 *       Can also be triggered manually by admin.
 *
 * HOW:
 *   1. Get all active affiliates with earnings above minimum payout
 *   2. Calculate earnings from billable calls and approved commissions
 *   3. Create AffiliatePayment records with PENDING status
 *   4. Mark processed calls/commissions as included in payout
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { createPayout } from '@/lib/services/affiliate-payment-service';
import { Decimal } from '@prisma/client/runtime/library';

// ============================================
// TYPES
// ============================================

export interface PayoutCalculationResult {
  success: boolean;
  processedAffiliates: number;
  payoutsCreated: number;
  totalPayoutAmount: number;
  skippedBelowMinimum: number;
  errors: string[];
  details: {
    affiliateId: string;
    affiliateName: string;
    callEarnings: number;
    leadEarnings: number;
    totalEarnings: number;
    payoutCreated: boolean;
    reason?: string;
  }[];
}

export interface PayoutPeriod {
  start: Date;
  end: Date;
}

// ============================================
// MAIN JOB FUNCTION
// ============================================

/**
 * Calculate and create weekly payouts for all eligible affiliates
 *
 * WHY: Main entry point for weekly payout processing.
 * WHEN: Called by cron job or admin manual trigger.
 * HOW: Iterates through affiliates, calculates earnings, creates payouts.
 */
export async function calculateWeeklyPayouts(
  periodOverride?: PayoutPeriod
): Promise<PayoutCalculationResult> {
  const result: PayoutCalculationResult = {
    success: true,
    processedAffiliates: 0,
    payoutsCreated: 0,
    totalPayoutAmount: 0,
    skippedBelowMinimum: 0,
    errors: [],
    details: []
  };

  // Calculate period (previous week by default)
  const period = periodOverride || getLastWeekPeriod();

  logger.info('Starting weekly payout calculation', {
    periodStart: period.start,
    periodEnd: period.end
  });

  try {
    // Get all active affiliates with payment method configured
    const affiliates = await prisma.affiliate.findMany({
      where: {
        status: 'ACTIVE',
        paymentMethod: { not: null }
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        minimumPayout: true,
        paymentMethod: true
      }
    });

    logger.info(`Processing ${affiliates.length} active affiliates`);

    for (const affiliate of affiliates) {
      try {
        const earnings = await calculateAffiliateEarnings(affiliate.id, period);
        result.processedAffiliates++;

        const detail = {
          affiliateId: affiliate.id,
          affiliateName: `${affiliate.firstName} ${affiliate.lastName}`,
          callEarnings: earnings.callEarnings,
          leadEarnings: earnings.leadEarnings,
          totalEarnings: earnings.totalEarnings,
          payoutCreated: false,
          reason: undefined as string | undefined
        };

        // Check minimum payout threshold
        const minimumPayout = Number(affiliate.minimumPayout);
        if (earnings.totalEarnings < minimumPayout) {
          detail.reason = `Below minimum payout ($${minimumPayout})`;
          result.skippedBelowMinimum++;
          result.details.push(detail);
          continue;
        }

        // Check if payout already exists for this period
        const existingPayout = await prisma.affiliatePayment.findFirst({
          where: {
            affiliateId: affiliate.id,
            periodStart: period.start,
            periodEnd: period.end,
            status: { not: 'FAILED' }
          }
        });

        if (existingPayout) {
          detail.reason = 'Payout already exists for this period';
          result.details.push(detail);
          continue;
        }

        // Create payout record
        await createPayout({
          affiliateId: affiliate.id,
          periodStart: period.start,
          periodEnd: period.end,
          grossAmount: earnings.totalEarnings,
          adjustments: 0,
          callCount: earnings.callCount,
          leadCount: earnings.leadCount
        });

        detail.payoutCreated = true;
        result.payoutsCreated++;
        result.totalPayoutAmount += earnings.totalEarnings;
        result.details.push(detail);

        logger.info('Payout created for affiliate', {
          affiliateId: affiliate.id,
          amount: earnings.totalEarnings,
          callCount: earnings.callCount,
          leadCount: earnings.leadCount
        });
      } catch (error) {
        const errorMessage = `Failed to process affiliate ${affiliate.id}: ${(error as Error).message}`;
        result.errors.push(errorMessage);
        logger.error(errorMessage);
      }
    }

    logger.info('Weekly payout calculation completed', {
      processedAffiliates: result.processedAffiliates,
      payoutsCreated: result.payoutsCreated,
      totalPayoutAmount: result.totalPayoutAmount,
      skippedBelowMinimum: result.skippedBelowMinimum,
      errors: result.errors.length
    });

    return result;
  } catch (error) {
    result.success = false;
    result.errors.push(`Critical error: ${(error as Error).message}`);
    logger.error('Weekly payout calculation failed', {
      error: (error as Error).message
    });
    return result;
  }
}

// ============================================
// EARNINGS CALCULATION
// ============================================

interface AffiliateEarnings {
  callEarnings: number;
  leadEarnings: number;
  totalEarnings: number;
  callCount: number;
  leadCount: number;
}

/**
 * Calculate earnings for a single affiliate within a period
 *
 * WHY: Need to aggregate all earning sources for accurate payout calculation.
 * WHEN: Called for each affiliate during payout calculation.
 * HOW: Queries calls and commissions within the period that haven't been paid.
 */
async function calculateAffiliateEarnings(
  affiliateId: string,
  period: PayoutPeriod
): Promise<AffiliateEarnings> {
  // Get billable calls in period that haven't been included in a payout yet
  const callEarnings = await prisma.call.aggregate({
    where: {
      affiliateId,
      isBillable: true,
      billingStatus: 'FINALIZED',
      createdAt: {
        gte: period.start,
        lte: period.end
      },
      // Only include calls not yet included in a payout
      affiliatePayout: { not: null }
    },
    _sum: { affiliatePayout: true },
    _count: { id: true }
  });

  // Get approved commissions in period that haven't been paid
  const commissionEarnings = await prisma.affiliateCommission.aggregate({
    where: {
      affiliateId,
      status: 'APPROVED',
      createdAt: {
        gte: period.start,
        lte: period.end
      }
    },
    _sum: { amount: true },
    _count: { id: true }
  });

  const callAmount = callEarnings._sum.affiliatePayout
    ? Number(callEarnings._sum.affiliatePayout)
    : 0;
  const leadAmount = commissionEarnings._sum.amount
    ? Number(commissionEarnings._sum.amount)
    : 0;

  return {
    callEarnings: callAmount,
    leadEarnings: leadAmount,
    totalEarnings: callAmount + leadAmount,
    callCount: callEarnings._count.id,
    leadCount: commissionEarnings._count.id
  };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get the previous week's date range (Monday-Sunday)
 *
 * WHY: Standard weekly payout period.
 * WHEN: Called when no period override is provided.
 * HOW: Calculates previous Monday 00:00:00 to Sunday 23:59:59.
 */
function getLastWeekPeriod(): PayoutPeriod {
  const now = new Date();
  const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.

  // Calculate days since last Monday
  const daysSinceMonday = currentDay === 0 ? 6 : currentDay - 1;

  // Start of this week (Monday 00:00:00)
  const thisWeekStart = new Date(now);
  thisWeekStart.setDate(now.getDate() - daysSinceMonday);
  thisWeekStart.setHours(0, 0, 0, 0);

  // Start of last week (previous Monday 00:00:00)
  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);

  // End of last week (Sunday 23:59:59)
  const lastWeekEnd = new Date(thisWeekStart);
  lastWeekEnd.setMilliseconds(-1);

  return {
    start: lastWeekStart,
    end: lastWeekEnd
  };
}

/**
 * Get current week's date range (Monday-today)
 *
 * WHY: Useful for previewing current week's earnings before payout.
 * WHEN: Admin wants to see current week's pending earnings.
 * HOW: Calculates current Monday to now.
 */
export function getCurrentWeekPeriod(): PayoutPeriod {
  const now = new Date();
  const currentDay = now.getDay();
  const daysSinceMonday = currentDay === 0 ? 6 : currentDay - 1;

  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - daysSinceMonday);
  weekStart.setHours(0, 0, 0, 0);

  return {
    start: weekStart,
    end: now
  };
}

/**
 * Preview payout calculation without creating records
 *
 * WHY: Admin can preview what payouts would be created before running.
 * WHEN: Admin clicks "Preview" in payout management UI.
 * HOW: Runs same calculation logic but doesn't create records.
 */
export async function previewWeeklyPayouts(
  periodOverride?: PayoutPeriod
): Promise<PayoutCalculationResult> {
  const result: PayoutCalculationResult = {
    success: true,
    processedAffiliates: 0,
    payoutsCreated: 0,
    totalPayoutAmount: 0,
    skippedBelowMinimum: 0,
    errors: [],
    details: []
  };

  const period = periodOverride || getLastWeekPeriod();

  try {
    const affiliates = await prisma.affiliate.findMany({
      where: {
        status: 'ACTIVE',
        paymentMethod: { not: null }
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        minimumPayout: true
      }
    });

    for (const affiliate of affiliates) {
      try {
        const earnings = await calculateAffiliateEarnings(affiliate.id, period);
        result.processedAffiliates++;

        const detail = {
          affiliateId: affiliate.id,
          affiliateName: `${affiliate.firstName} ${affiliate.lastName}`,
          callEarnings: earnings.callEarnings,
          leadEarnings: earnings.leadEarnings,
          totalEarnings: earnings.totalEarnings,
          payoutCreated: false,
          reason: undefined as string | undefined
        };

        const minimumPayout = Number(affiliate.minimumPayout);
        if (earnings.totalEarnings < minimumPayout) {
          detail.reason = `Below minimum payout ($${minimumPayout})`;
          result.skippedBelowMinimum++;
        } else {
          detail.payoutCreated = true;
          result.payoutsCreated++;
          result.totalPayoutAmount += earnings.totalEarnings;
        }

        result.details.push(detail);
      } catch (error) {
        result.errors.push(`Failed to calculate for ${affiliate.id}: ${(error as Error).message}`);
      }
    }

    return result;
  } catch (error) {
    result.success = false;
    result.errors.push(`Critical error: ${(error as Error).message}`);
    return result;
  }
}
