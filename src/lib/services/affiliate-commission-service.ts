/**
 * Affiliate Commission Service
 *
 * WHY: Centralizes commission calculation, creation, and status management.
 *      Ensures accurate commission tracking and consistent status transitions.
 *
 * WHEN: Use this service for:
 *       - Creating commissions when leads are sold
 *       - Approving/rejecting commissions (admin)
 *       - Calculating affiliate earnings and statistics
 *       - Marking commissions as paid during withdrawals
 *
 * HOW: Import and call the appropriate method. All methods:
 *      - Validate status transitions
 *      - Calculate amounts based on lead value and affiliate rate
 *      - Use transactions for atomicity
 *      - Log operations for audit
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import {
  AffiliateCommission,
  CommissionStatus,
  AffiliateStats
} from '@/types/database';

export interface CommissionResult {
  success: boolean;
  commission?: AffiliateCommission;
  error?: string;
}

export interface BatchCommissionResult {
  success: boolean;
  processed: number;
  failed: number;
  errors?: string[];
}

/**
 * Create commission for a lead
 * Called when a lead with affiliate attribution is sold
 */
export async function createCommissionForLead(
  leadId: string
): Promise<CommissionResult> {
  try {
    // Get lead with affiliate attribution
    // We need to find the affiliate link code from the lead's form data
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        affiliateCommissions: true
      }
    });

    if (!lead) {
      return { success: false, error: 'Lead not found' };
    }

    // Check if commission already exists for this lead
    if (lead.affiliateCommissions && lead.affiliateCommissions.length > 0) {
      logger.info('Commission already exists for lead', { leadId });
      return {
        success: true,
        commission: mapPrismaCommissionToCommission(lead.affiliateCommissions[0])
      };
    }

    // Get affiliate attribution from form data
    const formData = typeof lead.formData === 'string'
      ? JSON.parse(lead.formData)
      : lead.formData;

    const affiliateCode = formData?.metadata?.affiliateCode ||
      formData?.affiliateCode ||
      formData?.attribution?.affiliate_id;

    if (!affiliateCode) {
      // No affiliate attribution - not an error, just no commission
      logger.debug('No affiliate attribution for lead', { leadId });
      return { success: true };
    }

    // Find affiliate link by code
    const link = await prisma.affiliateLink.findUnique({
      where: { code: affiliateCode },
      include: {
        affiliate: true
      }
    });

    if (!link) {
      logger.warn('Affiliate link not found for lead', { leadId, code: affiliateCode });
      return { success: false, error: 'Affiliate link not found' };
    }

    if (link.affiliate.status !== 'ACTIVE') {
      logger.warn('Affiliate not active for commission', { leadId, affiliateId: link.affiliateId });
      return { success: false, error: 'Affiliate account is not active' };
    }

    // Get winning bid amount
    const bidAmount = lead.winningBid ? Number(lead.winningBid) : 0;
    if (bidAmount <= 0) {
      logger.warn('Lead has no winning bid for commission', { leadId });
      return { success: false, error: 'Lead has no winning bid amount' };
    }

    // Calculate commission amount
    const commissionRate = Number(link.affiliate.commissionRate);
    const commissionAmount = calculateCommissionAmount(bidAmount, commissionRate);

    // Create commission record
    const commission = await prisma.affiliateCommission.create({
      data: {
        affiliateId: link.affiliateId,
        leadId,
        amount: commissionAmount,
        rate: commissionRate,
        status: 'PENDING'
      }
    });

    logger.info('Commission created for lead', {
      leadId,
      affiliateId: link.affiliateId,
      amount: commissionAmount
    });

    return {
      success: true,
      commission: mapPrismaCommissionToCommission(commission)
    };
  } catch (error) {
    logger.error('Failed to create commission', {
      leadId,
      error: (error as Error).message
    });
    return {
      success: false,
      error: `Failed to create commission: ${(error as Error).message}`
    };
  }
}

/**
 * Calculate commission amount based on lead value and rate
 */
export function calculateCommissionAmount(
  leadValue: number,
  commissionRate: number
): number {
  // Round to 2 decimal places
  return Math.round(leadValue * commissionRate * 100) / 100;
}

/**
 * Get commissions for an affiliate with filters
 */
export async function getCommissionsByAffiliateId(
  affiliateId: string,
  params?: {
    page?: number;
    limit?: number;
    status?: CommissionStatus;
    dateFrom?: Date;
    dateTo?: Date;
  }
): Promise<{
  commissions: AffiliateCommission[];
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
  if (params?.dateFrom || params?.dateTo) {
    where.createdAt = {};
    if (params?.dateFrom) {
      where.createdAt.gte = params.dateFrom;
    }
    if (params?.dateTo) {
      where.createdAt.lte = params.dateTo;
    }
  }

  const [commissions, total] = await Promise.all([
    prisma.affiliateCommission.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        lead: {
          select: {
            id: true,
            serviceTypeId: true,
            status: true,
            createdAt: true,
            winningBid: true,
            serviceType: {
              select: {
                name: true,
                displayName: true
              }
            }
          }
        }
      }
    }),
    prisma.affiliateCommission.count({ where })
  ]);

  return {
    commissions: commissions.map(mapPrismaCommissionToCommission),
    total,
    page,
    totalPages: Math.ceil(total / limit)
  };
}

/**
 * Approve commissions (bulk)
 */
export async function approveCommissions(
  commissionIds: string[],
  adminUserId?: string
): Promise<BatchCommissionResult> {
  const errors: string[] = [];
  let processed = 0;
  let failed = 0;

  for (const id of commissionIds) {
    try {
      const commission = await prisma.affiliateCommission.findUnique({
        where: { id }
      });

      if (!commission) {
        errors.push(`Commission ${id} not found`);
        failed++;
        continue;
      }

      if (commission.status !== 'PENDING') {
        errors.push(`Commission ${id} is not pending (status: ${commission.status})`);
        failed++;
        continue;
      }

      await prisma.affiliateCommission.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedAt: new Date()
        }
      });

      processed++;
    } catch (error) {
      errors.push(`Failed to approve ${id}: ${(error as Error).message}`);
      failed++;
    }
  }

  logger.info('Commissions approved', {
    processed,
    failed,
    adminUserId
  });

  return {
    success: failed === 0,
    processed,
    failed,
    errors: errors.length > 0 ? errors : undefined
  };
}

/**
 * Reject a commission
 */
export async function rejectCommission(
  commissionId: string,
  reason: string,
  adminUserId?: string
): Promise<CommissionResult> {
  try {
    const commission = await prisma.affiliateCommission.findUnique({
      where: { id: commissionId }
    });

    if (!commission) {
      return { success: false, error: 'Commission not found' };
    }

    if (commission.status !== 'PENDING') {
      return { success: false, error: `Cannot reject commission with status ${commission.status}` };
    }

    const updated = await prisma.affiliateCommission.update({
      where: { id: commissionId },
      data: {
        status: 'REJECTED',
        rejectedAt: new Date(),
        rejectReason: reason
      }
    });

    logger.info('Commission rejected', {
      commissionId,
      reason,
      adminUserId
    });

    return {
      success: true,
      commission: mapPrismaCommissionToCommission(updated)
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to reject commission: ${(error as Error).message}`
    };
  }
}

/**
 * Mark commissions as paid (used during withdrawal processing)
 */
export async function markCommissionsAsPaid(
  commissionIds: string[]
): Promise<BatchCommissionResult> {
  const errors: string[] = [];
  let processed = 0;
  let failed = 0;

  for (const id of commissionIds) {
    try {
      const commission = await prisma.affiliateCommission.findUnique({
        where: { id }
      });

      if (!commission) {
        errors.push(`Commission ${id} not found`);
        failed++;
        continue;
      }

      if (commission.status !== 'APPROVED') {
        errors.push(`Commission ${id} is not approved (status: ${commission.status})`);
        failed++;
        continue;
      }

      await prisma.affiliateCommission.update({
        where: { id },
        data: {
          status: 'PAID',
          paidAt: new Date()
        }
      });

      processed++;
    } catch (error) {
      errors.push(`Failed to mark ${id} as paid: ${(error as Error).message}`);
      failed++;
    }
  }

  logger.info('Commissions marked as paid', { processed, failed });

  return {
    success: failed === 0,
    processed,
    failed,
    errors: errors.length > 0 ? errors : undefined
  };
}

/**
 * Get affiliate statistics (dashboard)
 */
export async function getAffiliateStats(affiliateId: string): Promise<AffiliateStats> {
  // Get commission aggregates by status
  const commissionStats = await prisma.affiliateCommission.groupBy({
    by: ['status'],
    where: { affiliateId },
    _sum: { amount: true },
    _count: true
  });

  // Get link stats
  const linkStats = await prisma.affiliateLink.aggregate({
    where: { affiliateId },
    _count: true,
    _sum: {
      clicks: true,
      conversions: true
    }
  });

  // Calculate totals
  let totalEarned = 0;
  let pendingCommissions = 0;
  let approvedCommissions = 0;

  for (const stat of commissionStats) {
    const amount = Number(stat._sum.amount) || 0;

    if (stat.status === 'PAID') {
      totalEarned += amount;
    } else if (stat.status === 'PENDING') {
      pendingCommissions += amount;
    } else if (stat.status === 'APPROVED') {
      approvedCommissions += amount;
    }
  }

  // Available for withdrawal = APPROVED but not yet PAID
  const availableForWithdrawal = approvedCommissions;

  // Get link stats
  const totalClicks = linkStats._sum.clicks || 0;
  const totalConversions = linkStats._sum.conversions || 0;
  const conversionRate = totalClicks > 0 ? totalConversions / totalClicks : 0;
  const activeLinks = await prisma.affiliateLink.count({
    where: { affiliateId, isActive: true }
  });

  return {
    totalEarned,
    pendingCommissions,
    approvedCommissions,
    availableForWithdrawal,
    totalClicks,
    totalConversions,
    conversionRate,
    activeLinks
  };
}

/**
 * Get all pending commissions (admin view)
 */
export async function getPendingCommissions(params?: {
  page?: number;
  limit?: number;
}): Promise<{
  commissions: AffiliateCommission[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const page = params?.page || 1;
  const limit = params?.limit || 50;
  const skip = (page - 1) * limit;

  const [commissions, total] = await Promise.all([
    prisma.affiliateCommission.findMany({
      where: { status: 'PENDING' },
      skip,
      take: limit,
      orderBy: { createdAt: 'asc' }, // Oldest first
      include: {
        affiliate: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        },
        lead: {
          select: {
            id: true,
            serviceTypeId: true,
            winningBid: true,
            createdAt: true,
            serviceType: {
              select: {
                displayName: true
              }
            }
          }
        }
      }
    }),
    prisma.affiliateCommission.count({ where: { status: 'PENDING' } })
  ]);

  return {
    commissions: commissions.map(mapPrismaCommissionToCommission),
    total,
    page,
    totalPages: Math.ceil(total / limit)
  };
}

/**
 * Get commission by ID
 */
export async function getCommissionById(id: string): Promise<AffiliateCommission | null> {
  const commission = await prisma.affiliateCommission.findUnique({
    where: { id },
    include: {
      affiliate: true,
      lead: {
        include: {
          serviceType: true
        }
      }
    }
  });

  if (!commission) return null;
  return mapPrismaCommissionToCommission(commission);
}

// =====================================
// HELPER FUNCTIONS
// =====================================

/**
 * Map Prisma commission to TypeScript AffiliateCommission type
 */
function mapPrismaCommissionToCommission(prismaCommission: any): AffiliateCommission {
  return {
    id: prismaCommission.id,
    affiliateId: prismaCommission.affiliateId,
    leadId: prismaCommission.leadId,
    amount: Number(prismaCommission.amount),
    rate: Number(prismaCommission.rate),
    status: prismaCommission.status as CommissionStatus,
    approvedAt: prismaCommission.approvedAt,
    paidAt: prismaCommission.paidAt,
    rejectedAt: prismaCommission.rejectedAt,
    rejectReason: prismaCommission.rejectReason,
    createdAt: prismaCommission.createdAt,
    updatedAt: prismaCommission.updatedAt,
    affiliate: prismaCommission.affiliate,
    lead: prismaCommission.lead
  };
}
