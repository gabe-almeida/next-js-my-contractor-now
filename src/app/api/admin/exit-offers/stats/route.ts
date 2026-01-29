/**
 * Exit Offers Stats API Route
 *
 * WHY: Aggregate exit offer click/conversion data for admin dashboard
 * WHEN: Admin views buyer Partner Offers tab or exit offers analytics
 * HOW: Query ExitOfferClick and ExitOfferConversion models, aggregate stats
 */

import { NextResponse } from 'next/server';
import { withMiddleware, EnhancedRequest } from '@/lib/middleware';
import { RedisCache } from '@/config/redis';
import { logger } from '@/lib/logger';
import { successResponse, errorResponse } from '@/lib/utils';
import { prisma } from '@/lib/prisma';
import { captureApiError } from '@/lib/sentry';

type TimeframeOption = '7d' | '30d' | '90d' | 'all';

interface ExitOfferStats {
  offerType: string;
  offerProvider: string;
  timeframe: TimeframeOption;
  clicks: number;
  conversions: number;
  conversionRate: number;
  totalRevenue: number;
  avgPayout: number | null;
  leadNotFoundCount: number;
  byTrafficSource: Array<{
    source: string;
    clicks: number;
    conversions: number;
    revenue: number;
  }>;
}

/**
 * Calculate start date based on timeframe
 */
function getStartDate(timeframe: TimeframeOption): Date | null {
  if (timeframe === 'all') return null;

  const now = new Date();
  switch (timeframe) {
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case '90d':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
}

/**
 * GET /api/admin/exit-offers/stats
 *
 * Query params:
 * - offerType: string (default: 'adt_home_security')
 * - timeframe: 7d | 30d | 90d | all (default: 30d)
 */
async function handleGetStats(req: EnhancedRequest): Promise<NextResponse> {
  const { requestId } = req.context;

  try {
    const url = new URL(req.url);
    const offerType = url.searchParams.get('offerType') || 'adt_home_security';
    const timeframe = (url.searchParams.get('timeframe') || '30d') as TimeframeOption;

    // Validate timeframe
    if (!['7d', '30d', '90d', 'all'].includes(timeframe)) {
      return NextResponse.json(
        errorResponse('INVALID_TIMEFRAME', 'Timeframe must be 7d, 30d, 90d, or all', { timeframe }, 'timeframe', requestId),
        { status: 400 }
      );
    }

    // Check cache (5 minute TTL)
    const cacheKey = `exit-offers-stats:${offerType}:${timeframe}`;
    const cached = await RedisCache.get<ExitOfferStats>(cacheKey);
    if (cached) {
      return NextResponse.json(successResponse(cached, requestId));
    }

    const startDate = getStartDate(timeframe);
    const dateFilter = startDate ? { gte: startDate } : undefined;

    // Get click and conversion counts
    const [clickCount, conversionData, leadNotFoundCount] = await Promise.all([
      prisma.exitOfferClick.count({
        where: {
          offerType,
          ...(dateFilter && { clickedAt: dateFilter })
        }
      }),
      prisma.exitOfferConversion.aggregate({
        where: {
          offerType,
          ...(dateFilter && { receivedAt: dateFilter })
        },
        _count: { id: true },
        _sum: { payout: true },
        _avg: { payout: true }
      }),
      prisma.exitOfferConversion.count({
        where: {
          offerType,
          leadNotFound: true,
          ...(dateFilter && { receivedAt: dateFilter })
        }
      })
    ]);

    const conversions = conversionData._count.id || 0;
    const totalRevenue = conversionData._sum.payout ? Number(conversionData._sum.payout) : 0;
    const avgPayout = conversionData._avg.payout ? Number(conversionData._avg.payout) : null;
    const conversionRate = clickCount > 0 ? Math.round((conversions / clickCount) * 1000) / 10 : 0;

    // Get stats by traffic source
    const clicksBySource = await prisma.exitOfferClick.groupBy({
      by: ['trafficSource'],
      where: {
        offerType,
        ...(dateFilter && { clickedAt: dateFilter })
      },
      _count: { id: true }
    });

    const conversionsBySource = await prisma.exitOfferConversion.groupBy({
      by: ['affSub'],
      where: {
        offerType,
        ...(dateFilter && { receivedAt: dateFilter })
      },
      _count: { id: true },
      _sum: { payout: true }
    });

    // Merge clicks and conversions by source
    const sourceMap = new Map<string, { clicks: number; conversions: number; revenue: number }>();

    for (const click of clicksBySource) {
      sourceMap.set(click.trafficSource, {
        clicks: click._count.id,
        conversions: 0,
        revenue: 0
      });
    }

    for (const conv of conversionsBySource) {
      const source = conv.affSub || 'Unknown';
      const existing = sourceMap.get(source);
      if (existing) {
        existing.conversions = conv._count.id;
        existing.revenue = conv._sum.payout ? Number(conv._sum.payout) : 0;
      } else {
        sourceMap.set(source, {
          clicks: 0,
          conversions: conv._count.id,
          revenue: conv._sum.payout ? Number(conv._sum.payout) : 0
        });
      }
    }

    const byTrafficSource = Array.from(sourceMap.entries())
      .map(([source, data]) => ({ source, ...data }))
      .sort((a, b) => b.revenue - a.revenue);

    // Get offer provider from first conversion/click
    const sampleRecord = await prisma.exitOfferConversion.findFirst({
      where: { offerType },
      select: { offerProvider: true }
    }) || await prisma.exitOfferClick.findFirst({
      where: { offerType },
      select: { offerProvider: true }
    });

    const result: ExitOfferStats = {
      offerType,
      offerProvider: sampleRecord?.offerProvider || 'px',
      timeframe,
      clicks: clickCount,
      conversions,
      conversionRate,
      totalRevenue,
      avgPayout,
      leadNotFoundCount,
      byTrafficSource
    };

    // Cache for 5 minutes
    await RedisCache.set(cacheKey, result, 300);

    return NextResponse.json(successResponse(result, requestId));

  } catch (error) {
    captureApiError(error, { route: '/api/admin/exit-offers/stats', action: 'GET' });
    logger.error('Exit offers stats fetch error', {
      error: (error as Error).message,
      stack: (error as Error).stack,
      requestId
    });

    return NextResponse.json(
      errorResponse('FETCH_ERROR', 'Failed to fetch exit offers stats', undefined, undefined, requestId),
      { status: 500 }
    );
  }
}

export const GET = withMiddleware(handleGetStats, {
  rateLimiter: 'admin',
  enableLogging: true,
  requireAuth: true,
  enableCors: true
});
