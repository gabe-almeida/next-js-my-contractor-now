/**
 * Affiliate API - Stats Endpoint
 *
 * WHY: Provides aggregated performance statistics for affiliates.
 *      Enables quick dashboard views and performance monitoring.
 *
 * WHEN: Use this endpoint to:
 *       - Get summary statistics for dashboard
 *       - Monitor performance over time periods
 *       - Track earnings and conversion rates
 *
 * HOW: Authenticate with API key + secret, then query stats data.
 *
 * GET /api/v1/affiliate/stats
 * Query params:
 *   - period (today, week, month, all - default: month)
 *   - from (ISO date string - overrides period)
 *   - to (ISO date string - overrides period)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  withAffiliateAuth,
  AffiliateApiContext,
  handleCorsOptions
} from '@/lib/middleware/affiliate-api-auth';

type Period = 'today' | 'week' | 'month' | 'all';

/**
 * Handle CORS preflight
 */
export async function OPTIONS() {
  return handleCorsOptions();
}

/**
 * GET /api/v1/affiliate/stats
 *
 * Get aggregated statistics for authenticated affiliate.
 */
export const GET = withAffiliateAuth(
  async (request: NextRequest, context: AffiliateApiContext) => {
    const { affiliateId } = context;
    const { searchParams } = new URL(request.url);

    // Parse date range
    const period = (searchParams.get('period') || 'month') as Period;
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');

    // Calculate date range
    const { startDate, endDate } = calculateDateRange(period, fromParam, toParam);

    // Fetch all stats in parallel
    const [callStats, leadStats, campaignStats] = await Promise.all([
      getCallStats(affiliateId, startDate, endDate),
      getLeadStats(affiliateId, startDate, endDate),
      getCampaignStats(affiliateId, startDate, endDate)
    ]);

    // Calculate totals
    const totalEarnings = callStats.totalEarnings + leadStats.totalEarnings;
    const pendingEarnings = callStats.pendingEarnings + leadStats.pendingEarnings;

    return NextResponse.json({
      success: true,
      data: {
        period: {
          type: fromParam || toParam ? 'custom' : period,
          start: startDate?.toISOString() || null,
          end: endDate?.toISOString() || null
        },
        summary: {
          totalEarnings,
          pendingEarnings,
          paidEarnings: leadStats.paidEarnings
        },
        calls: {
          total: callStats.totalCalls,
          qualified: callStats.qualifiedCalls,
          qualificationRate: callStats.totalCalls > 0
            ? (callStats.qualifiedCalls / callStats.totalCalls * 100).toFixed(2)
            : '0.00',
          avgDuration: callStats.avgDuration,
          earnings: callStats.totalEarnings,
          pendingEarnings: callStats.pendingEarnings
        },
        leads: {
          total: leadStats.totalLeads,
          converted: leadStats.convertedLeads,
          conversionRate: leadStats.totalLeads > 0
            ? (leadStats.convertedLeads / leadStats.totalLeads * 100).toFixed(2)
            : '0.00',
          earnings: leadStats.totalEarnings,
          pendingEarnings: leadStats.pendingEarnings,
          paidEarnings: leadStats.paidEarnings,
          byStatus: leadStats.byStatus
        },
        campaigns: campaignStats
      },
      timestamp: new Date().toISOString()
    });
  }
);

/**
 * Calculate date range based on period or explicit dates
 */
function calculateDateRange(
  period: Period,
  fromParam: string | null,
  toParam: string | null
): { startDate: Date | null; endDate: Date | null } {
  // If explicit dates provided, use them
  if (fromParam || toParam) {
    return {
      startDate: fromParam ? new Date(fromParam) : null,
      endDate: toParam ? new Date(toParam) : null
    };
  }

  const now = new Date();

  switch (period) {
    case 'today':
      return {
        startDate: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
        endDate: null
      };
    case 'week':
      return {
        startDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        endDate: null
      };
    case 'month':
      return {
        startDate: new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()),
        endDate: null
      };
    case 'all':
    default:
      return { startDate: null, endDate: null };
  }
}

/**
 * Get call statistics for affiliate
 */
async function getCallStats(
  affiliateId: string,
  startDate: Date | null,
  endDate: Date | null
): Promise<{
  totalCalls: number;
  qualifiedCalls: number;
  avgDuration: number;
  totalEarnings: number;
  pendingEarnings: number;
}> {
  const dateFilter: any = {};
  if (startDate) dateFilter.gte = startDate;
  if (endDate) dateFilter.lte = endDate;

  const where: any = { affiliateId };
  if (Object.keys(dateFilter).length > 0) {
    where.createdAt = dateFilter;
  }

  // Get aggregated call stats
  const [stats, qualifiedCount] = await Promise.all([
    prisma.call.aggregate({
      where,
      _count: { id: true },
      _sum: {
        affiliatePayout: true,
        connectedDurationSeconds: true
      },
      _avg: {
        connectedDurationSeconds: true
      }
    }),
    prisma.call.count({
      where: { ...where, isBillable: true }
    })
  ]);

  // Get pending earnings (unbilled calls that are qualified)
  const pendingStats = await prisma.call.aggregate({
    where: {
      ...where,
      isQualified: true,
      billingStatus: 'PENDING'
    },
    _sum: { affiliatePayout: true }
  });

  return {
    totalCalls: stats._count.id,
    qualifiedCalls: qualifiedCount,
    avgDuration: Math.round(stats._avg.connectedDurationSeconds || 0),
    totalEarnings: stats._sum.affiliatePayout
      ? Number(stats._sum.affiliatePayout)
      : 0,
    pendingEarnings: pendingStats._sum.affiliatePayout
      ? Number(pendingStats._sum.affiliatePayout)
      : 0
  };
}

/**
 * Get lead/commission statistics for affiliate
 */
async function getLeadStats(
  affiliateId: string,
  startDate: Date | null,
  endDate: Date | null
): Promise<{
  totalLeads: number;
  convertedLeads: number;
  totalEarnings: number;
  pendingEarnings: number;
  paidEarnings: number;
  byStatus: Record<string, { count: number; amount: number }>;
}> {
  const dateFilter: any = {};
  if (startDate) dateFilter.gte = startDate;
  if (endDate) dateFilter.lte = endDate;

  const where: any = { affiliateId };
  if (Object.keys(dateFilter).length > 0) {
    where.createdAt = dateFilter;
  }

  // Get grouped stats by status
  const groupedStats = await prisma.affiliateCommission.groupBy({
    by: ['status'],
    where,
    _count: { id: true },
    _sum: { amount: true }
  });

  // Calculate totals
  let totalLeads = 0;
  let totalEarnings = 0;
  let pendingEarnings = 0;
  let paidEarnings = 0;
  const byStatus: Record<string, { count: number; amount: number }> = {};

  for (const stat of groupedStats) {
    const count = stat._count.id;
    const amount = stat._sum.amount ? Number(stat._sum.amount) : 0;

    totalLeads += count;
    byStatus[stat.status] = { count, amount };

    if (stat.status === 'PAID') {
      paidEarnings += amount;
      totalEarnings += amount;
    } else if (stat.status === 'APPROVED') {
      pendingEarnings += amount;
      totalEarnings += amount;
    } else if (stat.status === 'PENDING') {
      pendingEarnings += amount;
    }
    // REJECTED doesn't count toward earnings
  }

  // Get converted leads (leads with SOLD status that have commissions)
  const convertedLeads = byStatus['APPROVED']?.count || 0 +
    (byStatus['PAID']?.count || 0);

  return {
    totalLeads,
    convertedLeads,
    totalEarnings,
    pendingEarnings,
    paidEarnings,
    byStatus
  };
}

/**
 * Get per-campaign statistics
 */
async function getCampaignStats(
  affiliateId: string,
  startDate: Date | null,
  endDate: Date | null
): Promise<
  Array<{
    campaignId: string;
    campaignName: string;
    serviceType: string;
    calls: number;
    qualifiedCalls: number;
    earnings: number;
  }>
> {
  const dateFilter: any = {};
  if (startDate) dateFilter.gte = startDate;
  if (endDate) dateFilter.lte = endDate;

  const where: any = {
    affiliateId,
    campaignId: { not: null }
  };
  if (Object.keys(dateFilter).length > 0) {
    where.createdAt = dateFilter;
  }

  // Get calls grouped by campaign
  const callsByCampaign = await prisma.call.groupBy({
    by: ['campaignId'],
    where,
    _count: { id: true },
    _sum: { affiliatePayout: true }
  });

  // Get qualified calls grouped by campaign
  const qualifiedByCampaign = await prisma.call.groupBy({
    by: ['campaignId'],
    where: { ...where, isBillable: true },
    _count: { id: true }
  });

  // Create map for qualified counts
  const qualifiedMap = new Map(
    qualifiedByCampaign.map(c => [c.campaignId, c._count.id])
  );

  // Get campaign details
  const campaignIds = callsByCampaign
    .map(c => c.campaignId)
    .filter((id): id is string => id !== null);

  const campaigns = await prisma.campaign.findMany({
    where: { id: { in: campaignIds } },
    include: {
      serviceType: {
        select: { displayName: true }
      }
    }
  });

  const campaignMap = new Map(campaigns.map(c => [c.id, c]));

  // Build result
  return callsByCampaign
    .filter(c => c.campaignId !== null)
    .map(c => {
      const campaign = campaignMap.get(c.campaignId!);
      return {
        campaignId: c.campaignId!,
        campaignName: campaign?.name || 'Unknown',
        serviceType: campaign?.serviceType?.displayName || 'Unknown',
        calls: c._count.id,
        qualifiedCalls: qualifiedMap.get(c.campaignId) || 0,
        earnings: c._sum.affiliatePayout ? Number(c._sum.affiliatePayout) : 0
      };
    })
    .sort((a, b) => b.earnings - a.earnings);
}
