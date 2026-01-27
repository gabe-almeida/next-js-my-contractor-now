/**
 * Admin Calls API
 *
 * WHY: Provides admin access to all calls in the system with filtering.
 * WHEN: Admin navigates to /admin/calls page.
 * HOW: Fetches calls with pagination, filtering by status/date/buyer.
 */

import { NextResponse } from 'next/server';
import { withMiddleware, EnhancedRequest } from '@/lib/middleware';
import { logger } from '@/lib/logger';
import { successResponse, errorResponse } from '@/lib/utils';
import { prisma } from '@/lib/prisma';
import { captureApiError } from '@/lib/sentry';

async function handleGetCalls(req: EnhancedRequest): Promise<NextResponse> {
  const { requestId } = req.context;

  try {
    const searchParams = req.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status');
    const buyerId = searchParams.get('buyerId');
    const affiliateId = searchParams.get('affiliateId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build where clause
    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (buyerId) {
      where.winningBuyerId = buyerId;
    }

    if (affiliateId) {
      where.affiliateId = affiliateId;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    // Fetch calls with relations
    const [calls, total] = await Promise.all([
      prisma.call.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          twilioCallSid: true,
          createdAt: true,
          status: true,
          disposition: true,
          callerPhone: true,
          callerPhoneDisplay: true,
          callerCity: true,
          callerState: true,
          callerZip: true,
          totalDurationSeconds: true,
          connectedDurationSeconds: true,
          isBillable: true,
          winningBid: true,
          affiliatePayout: true,
          buyerCharge: true,
          auctionDurationMs: true,
          eligibleBuyersCount: true,
          cascadeAttempts: true,
          recordingStatus: true,
          campaign: {
            select: {
              id: true,
              name: true,
            },
          },
          serviceType: {
            select: {
              id: true,
              name: true,
              displayName: true,
            },
          },
          trackingNumber: {
            select: {
              id: true,
              phoneNumber: true,
              phoneNumberDisplay: true,
            },
          },
          affiliate: {
            select: {
              id: true,
              companyName: true,
            },
          },
          winningBuyer: {
            select: {
              id: true,
              name: true,
              displayName: true,
              type: true,
            },
          },
        },
      }),
      prisma.call.count({ where }),
    ]);

    // Calculate stats
    const stats = {
      total,
      completed: calls.filter((c) => c.status === 'COMPLETED').length,
      billable: calls.filter((c) => c.isBillable).length,
      totalRevenue: calls.reduce((sum, c) => sum + Number(c.buyerCharge || 0), 0),
    };

    return NextResponse.json(
      successResponse(
        {
          calls,
          stats,
          pagination: {
            total,
            limit,
            offset,
            hasMore: offset + limit < total,
          },
        },
        requestId
      )
    );
  } catch (error) {
    captureApiError(error, { route: '/api/admin/calls', action: 'GET' });
    logger.error('Admin calls fetch error', {
      error: (error as Error).message,
      stack: (error as Error).stack,
      requestId,
    });

    return NextResponse.json(
      errorResponse('FETCH_ERROR', 'Failed to fetch calls', undefined, undefined, requestId),
      { status: 500 }
    );
  }
}

export const GET = withMiddleware(handleGetCalls, {
  rateLimiter: 'admin',
  enableLogging: true,
  requireAuth: true,
  enableCors: true,
});
