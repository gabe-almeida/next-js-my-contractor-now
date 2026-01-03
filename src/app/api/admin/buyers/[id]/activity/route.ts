/**
 * Buyer Activity API Route
 *
 * WHY: Aggregate transaction data for buyer activity dashboard
 * WHEN: Admin views buyer detail page Activity tab
 * HOW: Query Transaction model, aggregate stats, return with pagination
 */

import { NextResponse } from 'next/server';
import { withMiddleware, EnhancedRequest } from '@/lib/middleware';
import { RedisCache } from '@/config/redis';
import { logger } from '@/lib/logger';
import { successResponse, errorResponse } from '@/lib/utils';
import { prisma } from '@/lib/prisma';

type TimeframeOption = '24h' | '7d' | '30d' | '90d';

interface ActivitySummary {
  totalPings: number;
  totalPosts: number;
  leadsWon: number;
  leadsLost: number;
  winRate: number;
  avgBidAmount: number | null;
  avgResponseTime: number | null;
  totalRevenue: number;
}

interface TrendPoint {
  date: string;
  value: number;
}

interface TransactionItem {
  id: string;
  leadId: string;
  actionType: 'PING' | 'POST' | 'PING_WEBHOOK' | 'POST_WEBHOOK' | 'STATUS_UPDATE';
  status: string;
  bidAmount: number | null;
  responseTime: number | null;
  won: boolean;
  createdAt: string;
}

/**
 * Calculate start date based on timeframe
 */
function getStartDate(timeframe: TimeframeOption): Date {
  const now = new Date();
  switch (timeframe) {
    case '24h':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case '90d':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
}

/**
 * Group transactions by date for trend data
 */
function groupByDate(
  transactions: Array<{ createdAt: Date; responseTime: number | null; bidAmount: any }>
): TrendPoint[] {
  const grouped: Record<string, { count: number; totalResponseTime: number; totalBid: number }> = {};

  for (const tx of transactions) {
    const dateKey = tx.createdAt.toISOString().split('T')[0];
    if (!grouped[dateKey]) {
      grouped[dateKey] = { count: 0, totalResponseTime: 0, totalBid: 0 };
    }
    grouped[dateKey].count++;
    grouped[dateKey].totalResponseTime += tx.responseTime || 0;
    grouped[dateKey].totalBid += Number(tx.bidAmount) || 0;
  }

  return Object.entries(grouped)
    .map(([date, data]) => ({
      date,
      value: Math.round(data.totalResponseTime / data.count),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * GET /api/admin/buyers/[id]/activity
 *
 * Query params:
 * - timeframe: 24h | 7d | 30d | 90d (default: 7d)
 * - page: number (default: 1)
 * - limit: number (default: 20)
 */
async function handleGetActivity(
  req: EnhancedRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const { requestId } = req.context;
  const { id: buyerId } = params;

  try {
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(buyerId)) {
      return NextResponse.json(
        errorResponse('INVALID_ID', 'Invalid buyer ID format', { id: buyerId }, 'id', requestId),
        { status: 400 }
      );
    }

    // Parse query params
    const url = new URL(req.url);
    const timeframe = (url.searchParams.get('timeframe') || '7d') as TimeframeOption;
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
    const skip = (page - 1) * limit;

    // Validate timeframe
    if (!['24h', '7d', '30d', '90d'].includes(timeframe)) {
      return NextResponse.json(
        errorResponse('INVALID_TIMEFRAME', 'Timeframe must be 24h, 7d, 30d, or 90d', { timeframe }, 'timeframe', requestId),
        { status: 400 }
      );
    }

    // Check cache
    const cacheKey = `buyer-activity:${buyerId}:${timeframe}:${page}:${limit}`;
    const cached = await RedisCache.get<Record<string, unknown>>(cacheKey);
    if (cached) {
      return NextResponse.json(successResponse(cached, requestId));
    }

    const startDate = getStartDate(timeframe);

    // Verify buyer exists
    const buyer = await prisma.buyer.findUnique({
      where: { id: buyerId },
      select: { id: true, name: true }
    });

    if (!buyer) {
      return NextResponse.json(
        errorResponse('BUYER_NOT_FOUND', 'Buyer not found', { id: buyerId }, 'id', requestId),
        { status: 404 }
      );
    }

    // Get transaction counts by type
    const [pingCount, postCount] = await Promise.all([
      prisma.transaction.count({
        where: { buyerId, actionType: 'PING', createdAt: { gte: startDate } }
      }),
      prisma.transaction.count({
        where: { buyerId, actionType: 'POST', createdAt: { gte: startDate } }
      })
    ]);

    // Get leads won (where this buyer is the winning buyer)
    const leadsWon = await prisma.lead.count({
      where: { winningBuyerId: buyerId, createdAt: { gte: startDate } }
    });

    // Get leads participated but lost (PING transactions where lead has different winner)
    const participatedLeadIds = await prisma.transaction.findMany({
      where: { buyerId, actionType: 'PING', status: 'SUCCESS', createdAt: { gte: startDate } },
      select: { leadId: true },
      distinct: ['leadId']
    });

    const leadsLost = await prisma.lead.count({
      where: {
        id: { in: participatedLeadIds.map(t => t.leadId) },
        winningBuyerId: { not: buyerId },
        status: { in: ['SOLD', 'AUCTIONED'] }
      }
    });

    // Get average bid amount and response time
    const avgStats = await prisma.transaction.aggregate({
      where: {
        buyerId,
        actionType: 'PING',
        status: 'SUCCESS',
        createdAt: { gte: startDate }
      },
      _avg: {
        bidAmount: true,
        responseTime: true
      }
    });

    // Calculate total revenue (sum of winning bids)
    const revenueData = await prisma.lead.aggregate({
      where: { winningBuyerId: buyerId, createdAt: { gte: startDate } },
      _sum: { winningBid: true }
    });

    // Calculate win rate
    const totalParticipated = participatedLeadIds.length;
    const winRate = totalParticipated > 0 ? Math.round((leadsWon / totalParticipated) * 100) : 0;

    // Build summary
    const summary: ActivitySummary = {
      totalPings: pingCount,
      totalPosts: postCount,
      leadsWon,
      leadsLost,
      winRate,
      avgBidAmount: avgStats._avg.bidAmount ? Number(avgStats._avg.bidAmount) : null,
      avgResponseTime: avgStats._avg.responseTime ? Math.round(avgStats._avg.responseTime) : null,
      totalRevenue: revenueData._sum.winningBid ? Number(revenueData._sum.winningBid) : 0
    };

    // Get trend data (response times by day)
    const trendTransactions = await prisma.transaction.findMany({
      where: { buyerId, actionType: 'PING', createdAt: { gte: startDate } },
      select: { createdAt: true, responseTime: true, bidAmount: true },
      orderBy: { createdAt: 'asc' }
    });

    const responseTimeTrend = groupByDate(trendTransactions);

    // Get recent transactions with pagination
    const [transactions, totalTransactions] = await Promise.all([
      prisma.transaction.findMany({
        where: { buyerId, createdAt: { gte: startDate } },
        select: {
          id: true,
          leadId: true,
          actionType: true,
          status: true,
          bidAmount: true,
          responseTime: true,
          createdAt: true,
          lead: {
            select: {
              winningBuyerId: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.transaction.count({
        where: { buyerId, createdAt: { gte: startDate } }
      })
    ]);

    // Format transactions
    const formattedTransactions: TransactionItem[] = transactions.map(tx => ({
      id: tx.id,
      leadId: tx.leadId,
      actionType: tx.actionType as TransactionItem['actionType'],
      status: tx.status,
      bidAmount: tx.bidAmount ? Number(tx.bidAmount) : null,
      responseTime: tx.responseTime,
      won: tx.lead?.winningBuyerId === buyerId,
      createdAt: tx.createdAt.toISOString()
    }));

    const result = {
      buyerId,
      buyerName: buyer.name,
      timeframe,
      summary,
      trends: {
        responseTime: responseTimeTrend
      },
      recentTransactions: formattedTransactions,
      pagination: {
        page,
        limit,
        total: totalTransactions,
        hasMore: skip + limit < totalTransactions
      }
    };

    // Cache for 5 minutes
    await RedisCache.set(cacheKey, JSON.stringify(result), 300);

    return NextResponse.json(successResponse(result, requestId));

  } catch (error) {
    logger.error('Buyer activity fetch error', {
      error: (error as Error).message,
      stack: (error as Error).stack,
      requestId,
      buyerId
    });

    return NextResponse.json(
      errorResponse('FETCH_ERROR', 'Failed to fetch buyer activity', undefined, undefined, requestId),
      { status: 500 }
    );
  }
}

export const GET = withMiddleware(handleGetActivity, {
  rateLimiter: 'admin',
  enableLogging: true,
  requireAuth: true,
  enableCors: true
});
