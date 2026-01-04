/**
 * Affiliate Withdrawal Service
 *
 * WHY: Centralizes withdrawal request creation, processing, and balance management.
 *      Ensures accurate balance calculations and consistent payout workflows.
 *
 * WHEN: Use this service for:
 *       - Creating withdrawal requests
 *       - Processing withdrawals (admin)
 *       - Calculating available balance
 *       - Viewing withdrawal history
 *
 * HOW: Import and call the appropriate method. All methods:
 *      - Validate balance availability
 *      - Enforce minimum withdrawal amounts
 *      - Mark commissions as paid when withdrawal completes
 *      - Log operations for audit
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import {
  AffiliateWithdrawal,
  WithdrawalStatus,
  CreateWithdrawalRequest
} from '@/types/database';
import { markCommissionsAsPaid } from './affiliate-commission-service';

// Withdrawal configuration
const MINIMUM_WITHDRAWAL_AMOUNT = 50; // $50 minimum

export interface WithdrawalResult {
  success: boolean;
  withdrawal?: AffiliateWithdrawal;
  error?: string;
}

/**
 * Create a withdrawal request
 */
export async function createWithdrawalRequest(
  affiliateId: string,
  data: CreateWithdrawalRequest
): Promise<WithdrawalResult> {
  try {
    // Validate affiliate
    const affiliate = await prisma.affiliate.findUnique({
      where: { id: affiliateId }
    });

    if (!affiliate) {
      return { success: false, error: 'Affiliate not found' };
    }

    if (affiliate.status !== 'ACTIVE') {
      return { success: false, error: 'Affiliate account is not active' };
    }

    // Validate minimum amount
    if (data.amount < MINIMUM_WITHDRAWAL_AMOUNT) {
      return {
        success: false,
        error: `Minimum withdrawal amount is $${MINIMUM_WITHDRAWAL_AMOUNT}`
      };
    }

    // Get available balance
    const availableBalance = await getAvailableBalance(affiliateId);

    if (data.amount > availableBalance) {
      return {
        success: false,
        error: `Insufficient balance. Available: $${availableBalance.toFixed(2)}`
      };
    }

    // Check for pending withdrawals
    const pendingWithdrawal = await prisma.affiliateWithdrawal.findFirst({
      where: {
        affiliateId,
        status: { in: ['REQUESTED', 'PROCESSING'] }
      }
    });

    if (pendingWithdrawal) {
      return {
        success: false,
        error: 'You have a pending withdrawal request. Please wait for it to be processed.'
      };
    }

    // Create withdrawal request
    const withdrawal = await prisma.affiliateWithdrawal.create({
      data: {
        affiliateId,
        amount: data.amount,
        method: data.method,
        methodDetails: data.methodDetails || null,
        status: 'REQUESTED'
      }
    });

    logger.info('Withdrawal request created', {
      affiliateId,
      withdrawalId: withdrawal.id,
      amount: data.amount,
      method: data.method
    });

    return {
      success: true,
      withdrawal: mapPrismaWithdrawalToWithdrawal(withdrawal)
    };
  } catch (error) {
    logger.error('Failed to create withdrawal request', {
      affiliateId,
      error: (error as Error).message
    });
    return {
      success: false,
      error: `Failed to create withdrawal: ${(error as Error).message}`
    };
  }
}

/**
 * Get available balance for an affiliate
 * Available = APPROVED commissions - pending/processing withdrawals
 */
export async function getAvailableBalance(affiliateId: string): Promise<number> {
  // Get sum of APPROVED commissions (not yet paid)
  const approvedCommissions = await prisma.affiliateCommission.aggregate({
    where: {
      affiliateId,
      status: 'APPROVED'
    },
    _sum: { amount: true }
  });

  const approved = Number(approvedCommissions._sum.amount) || 0;

  // Subtract pending/processing withdrawals
  const pendingWithdrawals = await prisma.affiliateWithdrawal.aggregate({
    where: {
      affiliateId,
      status: { in: ['REQUESTED', 'PROCESSING'] }
    },
    _sum: { amount: true }
  });

  const pending = Number(pendingWithdrawals._sum.amount) || 0;

  return Math.max(0, approved - pending);
}

/**
 * Get withdrawals for an affiliate
 */
export async function getWithdrawalsByAffiliateId(
  affiliateId: string,
  params?: {
    page?: number;
    limit?: number;
    status?: WithdrawalStatus;
  }
): Promise<{
  withdrawals: AffiliateWithdrawal[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const page = params?.page || 1;
  const limit = params?.limit || 20;
  const skip = (page - 1) * limit;

  const where: any = { affiliateId };
  if (params?.status) {
    where.status = params.status;
  }

  const [withdrawals, total] = await Promise.all([
    prisma.affiliateWithdrawal.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' }
    }),
    prisma.affiliateWithdrawal.count({ where })
  ]);

  return {
    withdrawals: withdrawals.map(mapPrismaWithdrawalToWithdrawal),
    total,
    page,
    totalPages: Math.ceil(total / limit)
  };
}

/**
 * Get all withdrawals (admin view)
 */
export async function getAllWithdrawals(params?: {
  page?: number;
  limit?: number;
  status?: WithdrawalStatus;
  affiliateId?: string;
}): Promise<{
  withdrawals: AffiliateWithdrawal[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const page = params?.page || 1;
  const limit = params?.limit || 50;
  const skip = (page - 1) * limit;

  const where: any = {};
  if (params?.status) {
    where.status = params.status;
  }
  if (params?.affiliateId) {
    where.affiliateId = params.affiliateId;
  }

  const [withdrawals, total] = await Promise.all([
    prisma.affiliateWithdrawal.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        affiliate: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      }
    }),
    prisma.affiliateWithdrawal.count({ where })
  ]);

  return {
    withdrawals: withdrawals.map(mapPrismaWithdrawalToWithdrawal),
    total,
    page,
    totalPages: Math.ceil(total / limit)
  };
}

/**
 * Process withdrawal (admin action)
 * Transitions: REQUESTED -> PROCESSING -> COMPLETED/FAILED
 */
export async function processWithdrawal(
  withdrawalId: string,
  action: 'start_processing' | 'complete' | 'fail',
  notes?: string,
  adminUserId?: string
): Promise<WithdrawalResult> {
  try {
    const withdrawal = await prisma.affiliateWithdrawal.findUnique({
      where: { id: withdrawalId }
    });

    if (!withdrawal) {
      return { success: false, error: 'Withdrawal not found' };
    }

    let newStatus: WithdrawalStatus;
    let data: any = {};

    switch (action) {
      case 'start_processing':
        if (withdrawal.status !== WithdrawalStatus.REQUESTED) {
          return { success: false, error: 'Withdrawal is not in REQUESTED status' };
        }
        newStatus = WithdrawalStatus.PROCESSING;
        break;

      case 'complete':
        if (withdrawal.status !== WithdrawalStatus.PROCESSING) {
          return { success: false, error: 'Withdrawal is not in PROCESSING status' };
        }
        newStatus = WithdrawalStatus.COMPLETED;
        data.processedAt = new Date();
        data.processedBy = adminUserId;

        // Mark corresponding commissions as PAID
        await markApprovedCommissionsAsPaid(
          withdrawal.affiliateId,
          Number(withdrawal.amount)
        );
        break;

      case 'fail':
        if (![WithdrawalStatus.REQUESTED, WithdrawalStatus.PROCESSING].includes(withdrawal.status as WithdrawalStatus)) {
          return { success: false, error: 'Withdrawal cannot be failed' };
        }
        newStatus = WithdrawalStatus.FAILED;
        data.processedAt = new Date();
        data.processedBy = adminUserId;
        break;

      default:
        return { success: false, error: 'Invalid action' };
    }

    const updated = await prisma.affiliateWithdrawal.update({
      where: { id: withdrawalId },
      data: {
        status: newStatus,
        notes: notes || withdrawal.notes,
        ...data
      }
    });

    logger.info('Withdrawal processed', {
      withdrawalId,
      action,
      newStatus,
      adminUserId
    });

    return {
      success: true,
      withdrawal: mapPrismaWithdrawalToWithdrawal(updated)
    };
  } catch (error) {
    logger.error('Failed to process withdrawal', {
      withdrawalId,
      action,
      error: (error as Error).message
    });
    return {
      success: false,
      error: `Failed to process withdrawal: ${(error as Error).message}`
    };
  }
}

/**
 * Mark approved commissions as paid up to the withdrawal amount
 */
async function markApprovedCommissionsAsPaid(
  affiliateId: string,
  amount: number
): Promise<void> {
  // Get approved commissions ordered by creation date (FIFO)
  const commissions = await prisma.affiliateCommission.findMany({
    where: {
      affiliateId,
      status: 'APPROVED'
    },
    orderBy: { createdAt: 'asc' }
  });

  let remainingAmount = amount;
  const commissionIdsToMark: string[] = [];

  for (const commission of commissions) {
    if (remainingAmount <= 0) break;

    const commissionAmount = Number(commission.amount);
    if (commissionAmount <= remainingAmount) {
      commissionIdsToMark.push(commission.id);
      remainingAmount -= commissionAmount;
    }
  }

  if (commissionIdsToMark.length > 0) {
    await markCommissionsAsPaid(commissionIdsToMark);
  }
}

/**
 * Get withdrawal by ID
 */
export async function getWithdrawalById(id: string): Promise<AffiliateWithdrawal | null> {
  const withdrawal = await prisma.affiliateWithdrawal.findUnique({
    where: { id },
    include: {
      affiliate: true
    }
  });

  if (!withdrawal) return null;
  return mapPrismaWithdrawalToWithdrawal(withdrawal);
}

/**
 * Cancel a withdrawal request (affiliate action)
 * Only works for REQUESTED status
 */
export async function cancelWithdrawal(
  withdrawalId: string,
  affiliateId: string
): Promise<WithdrawalResult> {
  try {
    const withdrawal = await prisma.affiliateWithdrawal.findUnique({
      where: { id: withdrawalId }
    });

    if (!withdrawal) {
      return { success: false, error: 'Withdrawal not found' };
    }

    if (withdrawal.affiliateId !== affiliateId) {
      return { success: false, error: 'Unauthorized' };
    }

    if (withdrawal.status !== 'REQUESTED') {
      return {
        success: false,
        error: 'Can only cancel withdrawals that are still in REQUESTED status'
      };
    }

    // Delete the withdrawal request
    await prisma.affiliateWithdrawal.delete({
      where: { id: withdrawalId }
    });

    logger.info('Withdrawal cancelled', { withdrawalId, affiliateId });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Failed to cancel withdrawal: ${(error as Error).message}`
    };
  }
}

/**
 * Get withdrawal statistics for admin dashboard
 */
export async function getWithdrawalStats(): Promise<{
  totalRequested: number;
  totalProcessing: number;
  totalCompleted: number;
  totalFailed: number;
  pendingAmount: number;
}> {
  const stats = await prisma.affiliateWithdrawal.groupBy({
    by: ['status'],
    _count: true,
    _sum: { amount: true }
  });

  let totalRequested = 0;
  let totalProcessing = 0;
  let totalCompleted = 0;
  let totalFailed = 0;
  let pendingAmount = 0;

  for (const stat of stats) {
    const count = stat._count;

    switch (stat.status) {
      case 'REQUESTED':
        totalRequested = count;
        pendingAmount += Number(stat._sum.amount) || 0;
        break;
      case 'PROCESSING':
        totalProcessing = count;
        pendingAmount += Number(stat._sum.amount) || 0;
        break;
      case 'COMPLETED':
        totalCompleted = count;
        break;
      case 'FAILED':
        totalFailed = count;
        break;
    }
  }

  return {
    totalRequested,
    totalProcessing,
    totalCompleted,
    totalFailed,
    pendingAmount
  };
}

// =====================================
// HELPER FUNCTIONS
// =====================================

/**
 * Map Prisma withdrawal to TypeScript AffiliateWithdrawal type
 */
function mapPrismaWithdrawalToWithdrawal(prismaWithdrawal: any): AffiliateWithdrawal {
  return {
    id: prismaWithdrawal.id,
    affiliateId: prismaWithdrawal.affiliateId,
    amount: Number(prismaWithdrawal.amount),
    method: prismaWithdrawal.method,
    methodDetails: prismaWithdrawal.methodDetails,
    status: prismaWithdrawal.status as WithdrawalStatus,
    processedAt: prismaWithdrawal.processedAt,
    processedBy: prismaWithdrawal.processedBy,
    notes: prismaWithdrawal.notes,
    createdAt: prismaWithdrawal.createdAt,
    updatedAt: prismaWithdrawal.updatedAt,
    affiliate: prismaWithdrawal.affiliate
  };
}
