/**
 * Buyer Scrub Stats API Route
 *
 * WHY: Provides scrub rate statistics for a buyer.
 *      Compares actual scrub rate against expected rate.
 *
 * WHEN: GET - Retrieve scrub rate stats for a buyer in a period
 *
 * HOW: Uses ScrubReconciliationService to calculate actual vs expected rates.
 */

import { NextResponse } from 'next/server';
import { withMiddleware, EnhancedRequest } from '@/lib/middleware';
import { logger } from '@/lib/logger';
import { successResponse, errorResponse } from '@/lib/utils';
import { prisma } from '@/lib/prisma';
import { captureApiError } from '@/lib/sentry';
import {
  getScrubRateStats,
  getPendingCredits,
} from '@/lib/services/scrub-reconciliation-service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/buyers/[id]/scrub-stats
 *
 * Returns scrub rate statistics for a buyer.
 * Optionally filter by period with periodStart and periodEnd query params.
 */
async function handleGetScrubStats(
  req: EnhancedRequest,
  context: RouteContext
): Promise<NextResponse> {
  const { requestId } = req.context;
  const { id: buyerId } = await context.params;
  const url = new URL(req.url);

  try {
    // Verify buyer exists
    const buyer = await prisma.buyer.findUnique({
      where: { id: buyerId },
      select: {
        id: true,
        name: true,
        displayName: true,
        expectedScrubRate: true,
      },
    });

    if (!buyer) {
      return NextResponse.json(
        errorResponse('NOT_FOUND', 'Buyer not found', undefined, undefined, requestId),
        { status: 404 }
      );
    }

    // Parse date range (default to last 30 days)
    const periodEndParam = url.searchParams.get('periodEnd');
    const periodStartParam = url.searchParams.get('periodStart');

    const periodEnd = periodEndParam ? new Date(periodEndParam) : new Date();
    const periodStart = periodStartParam
      ? new Date(periodStartParam)
      : new Date(periodEnd.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get scrub rate stats
    const stats = await getScrubRateStats(buyerId, periodStart, periodEnd);

    if (!stats) {
      return NextResponse.json(
        errorResponse('FETCH_ERROR', 'Failed to calculate scrub stats', undefined, undefined, requestId),
        { status: 500 }
      );
    }

    // Get pending credits
    const pendingCredits = await getPendingCredits(buyerId);

    // Get historical scrub rates (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const historicalLeads = await prisma.lead.groupBy({
      by: ['disposition'],
      where: {
        winningBuyerId: buyerId,
        createdAt: { gte: sixMonthsAgo },
      },
      _count: true,
    });

    const historicalTotal = historicalLeads.reduce((sum, h) => sum + h._count, 0);
    const historicalScrubbed = historicalLeads.find((h) => h.disposition === 'CREDITED')?._count || 0;
    const historicalRate = historicalTotal > 0 ? historicalScrubbed / historicalTotal : 0;

    // Determine status based on expected rate
    const expectedRate = buyer.expectedScrubRate?.toNumber() || 0;
    let status: 'normal' | 'warning' | 'critical' = 'normal';
    if (expectedRate > 0) {
      if (stats.actualRate > expectedRate * 1.5) {
        status = 'critical';
      } else if (stats.actualRate > expectedRate * 1.2) {
        status = 'warning';
      }
    }

    return NextResponse.json(
      successResponse(
        {
          buyer: {
            id: buyer.id,
            name: buyer.displayName || buyer.name,
            expectedScrubRate: expectedRate,
          },
          period: {
            start: periodStart.toISOString(),
            end: periodEnd.toISOString(),
          },
          stats: {
            totalLeads: stats.totalLeads,
            scrubbedLeads: stats.scrubbedLeads,
            actualRate: stats.actualRate,
            actualRatePercent: (stats.actualRate * 100).toFixed(2) + '%',
            expectedRate: stats.expectedRate,
            expectedRatePercent: (stats.expectedRate * 100).toFixed(2) + '%',
            exceedsExpected: stats.exceedsExpected,
            difference: stats.difference,
            differencePercent: (stats.difference * 100).toFixed(2) + '%',
            totalValue: stats.totalValue.toNumber(),
            creditedValue: stats.creditedValue.toNumber(),
          },
          historical: {
            period: '6 months',
            totalLeads: historicalTotal,
            scrubbedLeads: historicalScrubbed,
            rate: historicalRate,
            ratePercent: (historicalRate * 100).toFixed(2) + '%',
          },
          pendingCredits: {
            count: pendingCredits.length,
            totalAmount: pendingCredits.reduce(
              (sum, l) => sum + (l.creditAmount?.toNumber() || l.winningBid?.toNumber() || 0),
              0
            ),
          },
          status,
          alerts:
            status === 'critical'
              ? [`Scrub rate (${(stats.actualRate * 100).toFixed(1)}%) significantly exceeds expected rate (${(expectedRate * 100).toFixed(1)}%)`]
              : status === 'warning'
              ? [`Scrub rate (${(stats.actualRate * 100).toFixed(1)}%) exceeds expected rate (${(expectedRate * 100).toFixed(1)}%)`]
              : [],
        },
        requestId
      )
    );
  } catch (error) {
    captureApiError(error, {
      route: '/api/admin/buyers/[id]/scrub-stats',
      action: 'GET',
      extra: { requestId, buyerId },
    });
    logger.error('Failed to fetch scrub stats', {
      error: (error as Error).message,
      buyerId,
      requestId,
    });

    return NextResponse.json(
      errorResponse('FETCH_ERROR', 'Failed to fetch scrub stats', undefined, undefined, requestId),
      { status: 500 }
    );
  }
}

// Export handler with admin authentication
export const GET = withMiddleware(handleGetScrubStats, {
  rateLimiter: 'admin',
  enableLogging: true,
  requireAuth: true,
  enableCors: true,
});
