/**
 * Analytics Service
 *
 * WHY: Centralizes analytics queries for affiliates, buyers, and admin.
 *      Provides consistent data aggregation for dashboards and reports.
 *
 * WHEN: Use this service for:
 *       - Affiliate analytics dashboard
 *       - Admin performance reports
 *       - Buyer performance tracking
 *       - Time-series data for charts
 *
 * HOW: Import and call the appropriate method. All methods:
 *      - Accept date range parameters for filtering
 *      - Return typed results for TypeScript safety
 *      - Use Prisma's aggregate functions for efficient queries
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

// =====================================
// TYPE DEFINITIONS
// =====================================

export interface DateRangeFilter {
  startDate: Date;
  endDate: Date;
}

export interface AffiliateAnalytics {
  summary: {
    totalCalls: number;
    qualifiedCalls: number;
    totalEarnings: number;
    avgCallDuration: number;
    conversionRate: number;
  };
  dailyData: DailyDataPoint[];
  campaignBreakdown: CampaignStats[];
}

export interface DailyDataPoint {
  date: string; // ISO date string YYYY-MM-DD
  calls: number;
  qualifiedCalls: number;
  earnings: number;
  avgDuration: number;
}

export interface CampaignStats {
  campaignId: string;
  campaignName: string;
  serviceType: string;
  calls: number;
  qualifiedCalls: number;
  earnings: number;
  conversionRate: number;
}

export interface BuyerAnalytics {
  summary: {
    totalCalls: number;
    acceptedCalls: number;
    avgBidAmount: number;
    totalSpend: number;
    avgCallDuration: number;
  };
  dailyData: DailyDataPoint[];
}

export interface AdminOverviewAnalytics {
  summary: {
    totalCalls: number;
    qualifiedCalls: number;
    totalRevenue: number;
    totalPayouts: number;
    platformMargin: number;
    avgAuctionTime: number;
  };
  dailyData: DailyDataPoint[];
  topAffiliates: AffiliateRanking[];
  topBuyers: BuyerRanking[];
  serviceBreakdown: ServiceStats[];
}

export interface AffiliateRanking {
  affiliateId: string;
  name: string;
  email: string;
  calls: number;
  qualifiedCalls: number;
  earnings: number;
  conversionRate: number;
}

export interface BuyerRanking {
  buyerId: string;
  name: string;
  calls: number;
  acceptedCalls: number;
  totalSpend: number;
  avgBidAmount: number;
}

export interface ServiceStats {
  serviceTypeId: string;
  serviceName: string;
  calls: number;
  qualifiedCalls: number;
  revenue: number;
  avgBid: number;
}

// =====================================
// AFFILIATE ANALYTICS
// =====================================

/**
 * Get comprehensive analytics for an affiliate
 *
 * WHY: Affiliates need to see their performance over time to optimize campaigns.
 * WHEN: Loading affiliate analytics dashboard.
 * HOW: Aggregate call data with date grouping and campaign breakdown.
 */
export async function getAffiliateAnalytics(
  affiliateId: string,
  dateRange: DateRangeFilter,
  campaignId?: string
): Promise<AffiliateAnalytics> {
  try {
    const where: any = {
      affiliateId,
      createdAt: {
        gte: dateRange.startDate,
        lte: dateRange.endDate,
      },
    };

    if (campaignId) {
      where.campaignId = campaignId;
    }

    // Get summary statistics
    const [callStats, earningsStats] = await Promise.all([
      prisma.call.aggregate({
        where,
        _count: { id: true },
        _avg: { connectedDurationSeconds: true },
      }),
      prisma.call.aggregate({
        where: { ...where, isBillable: true },
        _count: { id: true },
        _sum: { affiliatePayout: true },
      }),
    ]);

    const totalCalls = callStats._count.id;
    const qualifiedCalls = earningsStats._count.id;
    const totalEarnings = Number(earningsStats._sum.affiliatePayout) || 0;
    const avgCallDuration = callStats._avg.connectedDurationSeconds || 0;
    const conversionRate = totalCalls > 0 ? (qualifiedCalls / totalCalls) * 100 : 0;

    // Get daily time series data
    const dailyData = await getDailyCallDataForAffiliate(affiliateId, dateRange, campaignId);

    // Get campaign breakdown
    const campaignBreakdown = await getCampaignBreakdownForAffiliate(affiliateId, dateRange);

    logger.info('Fetched affiliate analytics', {
      affiliateId,
      totalCalls,
      dateRange: { start: dateRange.startDate, end: dateRange.endDate },
    });

    return {
      summary: {
        totalCalls,
        qualifiedCalls,
        totalEarnings,
        avgCallDuration,
        conversionRate,
      },
      dailyData,
      campaignBreakdown,
    };
  } catch (error) {
    logger.error('Failed to fetch affiliate analytics', {
      affiliateId,
      error: (error as Error).message,
    });
    throw error;
  }
}

/**
 * Get daily call data for time series charts
 */
async function getDailyCallDataForAffiliate(
  affiliateId: string,
  dateRange: DateRangeFilter,
  campaignId?: string
): Promise<DailyDataPoint[]> {
  const where: any = {
    affiliateId,
    createdAt: {
      gte: dateRange.startDate,
      lte: dateRange.endDate,
    },
  };

  if (campaignId) {
    where.campaignId = campaignId;
  }

  // Get all calls in range
  const calls = await prisma.call.findMany({
    where,
    select: {
      createdAt: true,
      isBillable: true,
      affiliatePayout: true,
      connectedDurationSeconds: true,
    },
  });

  // Group by date
  const dailyMap = new Map<string, {
    calls: number;
    qualifiedCalls: number;
    earnings: number;
    totalDuration: number;
  }>();

  // Initialize all dates in range
  const currentDate = new Date(dateRange.startDate);
  while (currentDate <= dateRange.endDate) {
    const dateKey = currentDate.toISOString().split('T')[0];
    dailyMap.set(dateKey, { calls: 0, qualifiedCalls: 0, earnings: 0, totalDuration: 0 });
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Aggregate calls by date
  for (const call of calls) {
    const dateKey = call.createdAt.toISOString().split('T')[0];
    const data = dailyMap.get(dateKey);
    if (data) {
      data.calls++;
      if (call.isBillable) {
        data.qualifiedCalls++;
        data.earnings += Number(call.affiliatePayout) || 0;
      }
      data.totalDuration += call.connectedDurationSeconds || 0;
    }
  }

  // Convert to array
  return Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({
      date,
      calls: data.calls,
      qualifiedCalls: data.qualifiedCalls,
      earnings: data.earnings,
      avgDuration: data.calls > 0 ? data.totalDuration / data.calls : 0,
    }));
}

/**
 * Get campaign breakdown for affiliate
 */
async function getCampaignBreakdownForAffiliate(
  affiliateId: string,
  dateRange: DateRangeFilter
): Promise<CampaignStats[]> {
  const calls = await prisma.call.findMany({
    where: {
      affiliateId,
      createdAt: {
        gte: dateRange.startDate,
        lte: dateRange.endDate,
      },
      campaignId: { not: null },
    },
    select: {
      campaignId: true,
      isBillable: true,
      affiliatePayout: true,
      campaign: {
        select: {
          name: true,
          serviceType: {
            select: { displayName: true },
          },
        },
      },
    },
  });

  // Group by campaign
  const campaignMap = new Map<string, {
    name: string;
    serviceType: string;
    calls: number;
    qualifiedCalls: number;
    earnings: number;
  }>();

  for (const call of calls) {
    if (!call.campaignId) continue;

    let data = campaignMap.get(call.campaignId);
    if (!data) {
      data = {
        name: call.campaign?.name || 'Unknown',
        serviceType: call.campaign?.serviceType?.displayName || 'Unknown',
        calls: 0,
        qualifiedCalls: 0,
        earnings: 0,
      };
      campaignMap.set(call.campaignId, data);
    }

    data.calls++;
    if (call.isBillable) {
      data.qualifiedCalls++;
      data.earnings += Number(call.affiliatePayout) || 0;
    }
  }

  return Array.from(campaignMap.entries())
    .map(([campaignId, data]) => ({
      campaignId,
      campaignName: data.name,
      serviceType: data.serviceType,
      calls: data.calls,
      qualifiedCalls: data.qualifiedCalls,
      earnings: data.earnings,
      conversionRate: data.calls > 0 ? (data.qualifiedCalls / data.calls) * 100 : 0,
    }))
    .sort((a, b) => b.earnings - a.earnings);
}

// =====================================
// ADMIN ANALYTICS
// =====================================

/**
 * Get admin overview analytics
 *
 * WHY: Admin needs to see platform-wide performance metrics.
 * WHEN: Loading admin analytics dashboard.
 * HOW: Aggregate all call data with rankings and breakdowns.
 */
export async function getAdminOverviewAnalytics(
  dateRange: DateRangeFilter
): Promise<AdminOverviewAnalytics> {
  try {
    const where = {
      createdAt: {
        gte: dateRange.startDate,
        lte: dateRange.endDate,
      },
    };

    // Get summary statistics
    const [totalStats, billableStats, auctionStats] = await Promise.all([
      prisma.call.aggregate({
        where,
        _count: { id: true },
        _avg: { connectedDurationSeconds: true },
      }),
      prisma.call.aggregate({
        where: { ...where, isBillable: true },
        _count: { id: true },
        _sum: {
          buyerCharge: true,
          affiliatePayout: true,
          platformMargin: true,
        },
      }),
      prisma.call.aggregate({
        where: { ...where, auctionDurationMs: { not: null } },
        _avg: { auctionDurationMs: true },
      }),
    ]);

    const summary = {
      totalCalls: totalStats._count.id,
      qualifiedCalls: billableStats._count.id,
      totalRevenue: Number(billableStats._sum.buyerCharge) || 0,
      totalPayouts: Number(billableStats._sum.affiliatePayout) || 0,
      platformMargin: Number(billableStats._sum.platformMargin) || 0,
      avgAuctionTime: auctionStats._avg.auctionDurationMs || 0,
    };

    // Get daily data
    const dailyData = await getDailyCallDataForAdmin(dateRange);

    // Get top affiliates
    const topAffiliates = await getTopAffiliates(dateRange);

    // Get top buyers
    const topBuyers = await getTopBuyers(dateRange);

    // Get service breakdown
    const serviceBreakdown = await getServiceBreakdown(dateRange);

    logger.info('Fetched admin overview analytics', {
      totalCalls: summary.totalCalls,
      dateRange: { start: dateRange.startDate, end: dateRange.endDate },
    });

    return {
      summary,
      dailyData,
      topAffiliates,
      topBuyers,
      serviceBreakdown,
    };
  } catch (error) {
    logger.error('Failed to fetch admin analytics', {
      error: (error as Error).message,
    });
    throw error;
  }
}

/**
 * Get daily call data for admin dashboard
 */
async function getDailyCallDataForAdmin(dateRange: DateRangeFilter): Promise<DailyDataPoint[]> {
  const calls = await prisma.call.findMany({
    where: {
      createdAt: {
        gte: dateRange.startDate,
        lte: dateRange.endDate,
      },
    },
    select: {
      createdAt: true,
      isBillable: true,
      buyerCharge: true,
      connectedDurationSeconds: true,
    },
  });

  // Group by date
  const dailyMap = new Map<string, {
    calls: number;
    qualifiedCalls: number;
    earnings: number;
    totalDuration: number;
  }>();

  // Initialize all dates in range
  const currentDate = new Date(dateRange.startDate);
  while (currentDate <= dateRange.endDate) {
    const dateKey = currentDate.toISOString().split('T')[0];
    dailyMap.set(dateKey, { calls: 0, qualifiedCalls: 0, earnings: 0, totalDuration: 0 });
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Aggregate calls by date
  for (const call of calls) {
    const dateKey = call.createdAt.toISOString().split('T')[0];
    const data = dailyMap.get(dateKey);
    if (data) {
      data.calls++;
      if (call.isBillable) {
        data.qualifiedCalls++;
        data.earnings += Number(call.buyerCharge) || 0;
      }
      data.totalDuration += call.connectedDurationSeconds || 0;
    }
  }

  return Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({
      date,
      calls: data.calls,
      qualifiedCalls: data.qualifiedCalls,
      earnings: data.earnings,
      avgDuration: data.calls > 0 ? data.totalDuration / data.calls : 0,
    }));
}

/**
 * Get top performing affiliates
 */
async function getTopAffiliates(dateRange: DateRangeFilter): Promise<AffiliateRanking[]> {
  const calls = await prisma.call.findMany({
    where: {
      createdAt: {
        gte: dateRange.startDate,
        lte: dateRange.endDate,
      },
      affiliateId: { not: null },
    },
    select: {
      affiliateId: true,
      isBillable: true,
      affiliatePayout: true,
      affiliate: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  // Group by affiliate
  const affiliateMap = new Map<string, {
    name: string;
    email: string;
    calls: number;
    qualifiedCalls: number;
    earnings: number;
  }>();

  for (const call of calls) {
    if (!call.affiliateId) continue;

    let data = affiliateMap.get(call.affiliateId);
    if (!data) {
      data = {
        name: `${call.affiliate?.firstName || ''} ${call.affiliate?.lastName || ''}`.trim(),
        email: call.affiliate?.email || '',
        calls: 0,
        qualifiedCalls: 0,
        earnings: 0,
      };
      affiliateMap.set(call.affiliateId, data);
    }

    data.calls++;
    if (call.isBillable) {
      data.qualifiedCalls++;
      data.earnings += Number(call.affiliatePayout) || 0;
    }
  }

  return Array.from(affiliateMap.entries())
    .map(([affiliateId, data]) => ({
      affiliateId,
      name: data.name || data.email,
      email: data.email,
      calls: data.calls,
      qualifiedCalls: data.qualifiedCalls,
      earnings: data.earnings,
      conversionRate: data.calls > 0 ? (data.qualifiedCalls / data.calls) * 100 : 0,
    }))
    .sort((a, b) => b.earnings - a.earnings)
    .slice(0, 10);
}

/**
 * Get top performing buyers
 */
async function getTopBuyers(dateRange: DateRangeFilter): Promise<BuyerRanking[]> {
  const calls = await prisma.call.findMany({
    where: {
      createdAt: {
        gte: dateRange.startDate,
        lte: dateRange.endDate,
      },
      winningBuyerId: { not: null },
      isBillable: true,
    },
    select: {
      winningBuyerId: true,
      winningBid: true,
      buyerCharge: true,
      winningBuyer: {
        select: {
          name: true,
          displayName: true,
        },
      },
    },
  });

  // Group by buyer
  const buyerMap = new Map<string, {
    name: string;
    calls: number;
    acceptedCalls: number;
    totalSpend: number;
    totalBid: number;
  }>();

  for (const call of calls) {
    if (!call.winningBuyerId) continue;

    let data = buyerMap.get(call.winningBuyerId);
    if (!data) {
      data = {
        name: call.winningBuyer?.displayName || call.winningBuyer?.name || 'Unknown',
        calls: 0,
        acceptedCalls: 0,
        totalSpend: 0,
        totalBid: 0,
      };
      buyerMap.set(call.winningBuyerId, data);
    }

    data.calls++;
    data.acceptedCalls++;
    data.totalSpend += Number(call.buyerCharge) || 0;
    data.totalBid += Number(call.winningBid) || 0;
  }

  return Array.from(buyerMap.entries())
    .map(([buyerId, data]) => ({
      buyerId,
      name: data.name,
      calls: data.calls,
      acceptedCalls: data.acceptedCalls,
      totalSpend: data.totalSpend,
      avgBidAmount: data.calls > 0 ? data.totalBid / data.calls : 0,
    }))
    .sort((a, b) => b.totalSpend - a.totalSpend)
    .slice(0, 10);
}

/**
 * Get service type breakdown
 */
async function getServiceBreakdown(dateRange: DateRangeFilter): Promise<ServiceStats[]> {
  const calls = await prisma.call.findMany({
    where: {
      createdAt: {
        gte: dateRange.startDate,
        lte: dateRange.endDate,
      },
      serviceTypeId: { not: null },
    },
    select: {
      serviceTypeId: true,
      isBillable: true,
      buyerCharge: true,
      winningBid: true,
      serviceType: {
        select: { displayName: true },
      },
    },
  });

  // Group by service
  const serviceMap = new Map<string, {
    name: string;
    calls: number;
    qualifiedCalls: number;
    revenue: number;
    totalBid: number;
  }>();

  for (const call of calls) {
    if (!call.serviceTypeId) continue;

    let data = serviceMap.get(call.serviceTypeId);
    if (!data) {
      data = {
        name: call.serviceType?.displayName || 'Unknown',
        calls: 0,
        qualifiedCalls: 0,
        revenue: 0,
        totalBid: 0,
      };
      serviceMap.set(call.serviceTypeId, data);
    }

    data.calls++;
    if (call.isBillable) {
      data.qualifiedCalls++;
      data.revenue += Number(call.buyerCharge) || 0;
      data.totalBid += Number(call.winningBid) || 0;
    }
  }

  return Array.from(serviceMap.entries())
    .map(([serviceTypeId, data]) => ({
      serviceTypeId,
      serviceName: data.name,
      calls: data.calls,
      qualifiedCalls: data.qualifiedCalls,
      revenue: data.revenue,
      avgBid: data.qualifiedCalls > 0 ? data.totalBid / data.qualifiedCalls : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

// =====================================
// UTILITY FUNCTIONS
// =====================================

/**
 * Get date range preset
 */
export function getDateRangePreset(preset: 'today' | '7d' | '30d' | '90d' | 'ytd'): DateRangeFilter {
  const now = new Date();
  const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  let startDate: Date;

  switch (preset) {
    case 'today':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      break;
    case '7d':
      startDate = new Date(endDate.getTime() - 6 * 24 * 60 * 60 * 1000);
      startDate.setHours(0, 0, 0, 0);
      break;
    case '30d':
      startDate = new Date(endDate.getTime() - 29 * 24 * 60 * 60 * 1000);
      startDate.setHours(0, 0, 0, 0);
      break;
    case '90d':
      startDate = new Date(endDate.getTime() - 89 * 24 * 60 * 60 * 1000);
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'ytd':
      startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      break;
    default:
      startDate = new Date(endDate.getTime() - 29 * 24 * 60 * 60 * 1000);
      startDate.setHours(0, 0, 0, 0);
  }

  return { startDate, endDate };
}
