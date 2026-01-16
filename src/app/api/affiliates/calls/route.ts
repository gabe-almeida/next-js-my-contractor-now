/**
 * Affiliate Calls API
 *
 * WHY: Provides affiliate access to their call history with filtering and pagination.
 *      Essential for the affiliate portal calls page and dashboard.
 *
 * WHEN: GET - Loading calls list, filtering by campaign/status, paginating
 *
 * HOW: Uses verifyAffiliateToken for auth, Prisma for data with joins to campaign.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAffiliateToken } from '@/lib/services/affiliate-service';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { captureApiError } from '@/lib/sentry';

/**
 * WHY: Extracts and verifies affiliate ID from request authorization header.
 * WHEN: Every API request that requires affiliate authentication.
 * HOW: Parse Bearer token, verify JWT, return affiliate ID or error.
 */
function getAffiliateIdFromRequest(request: NextRequest): {
  affiliateId: string | null;
  error: string | null;
} {
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { affiliateId: null, error: 'Authorization required' };
  }

  const token = authHeader.substring(7);
  const verification = verifyAffiliateToken(token);

  if (!verification.valid) {
    return { affiliateId: null, error: verification.error || 'Invalid token' };
  }

  return { affiliateId: verification.affiliateId!, error: null };
}

/**
 * GET /api/affiliates/calls
 *
 * Returns affiliate's call history with pagination and filtering.
 *
 * Query parameters:
 * - page (default: 1)
 * - limit (default: 20, max: 100)
 * - campaignId (optional)
 * - status (optional: COMPLETED, NO_ANSWER, etc.)
 * - isBillable (optional: true/false)
 * - startDate (optional: ISO date string)
 * - endDate (optional: ISO date string)
 */
export async function GET(request: NextRequest) {
  try {
    const { affiliateId, error } = getAffiliateIdFromRequest(request);

    if (!affiliateId) {
      return NextResponse.json({
        success: false,
        error
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);

    // Parse pagination params
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const skip = (page - 1) * limit;

    // Parse filter params
    const campaignId = searchParams.get('campaignId');
    const status = searchParams.get('status');
    const isBillableParam = searchParams.get('isBillable');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build where clause
    const where: Record<string, unknown> = {
      affiliateId
    };

    if (campaignId) {
      where.campaignId = campaignId;
    }

    if (status) {
      where.status = status;
    }

    if (isBillableParam !== null) {
      where.isBillable = isBillableParam === 'true';
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        (where.createdAt as Record<string, Date>).gte = new Date(startDate);
      }
      if (endDate) {
        (where.createdAt as Record<string, Date>).lte = new Date(endDate);
      }
    }

    // Fetch calls with campaign info
    const [calls, total] = await Promise.all([
      prisma.call.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          createdAt: true,
          callerPhone: true,
          callerPhoneDisplay: true,
          callerCity: true,
          callerState: true,
          totalDurationSeconds: true,
          connectedDurationSeconds: true,
          status: true,
          isBillable: true,
          affiliatePayout: true,
          recordingStatus: true,
          campaignId: true,
          campaign: {
            select: {
              id: true,
              name: true,
              serviceType: {
                select: { name: true, displayName: true }
              }
            }
          }
        }
      }),
      prisma.call.count({ where })
    ]);

    // Format response
    const formattedCalls = calls.map(call => ({
      id: call.id,
      createdAt: call.createdAt.toISOString(),
      callerPhone: call.callerPhone,
      callerPhoneDisplay: call.callerPhoneDisplay,
      callerCity: call.callerCity,
      callerState: call.callerState,
      totalDurationSeconds: call.totalDurationSeconds,
      connectedDurationSeconds: call.connectedDurationSeconds,
      status: call.status,
      isBillable: call.isBillable,
      affiliatePayout: call.affiliatePayout ? Number(call.affiliatePayout) : null,
      recordingStatus: call.recordingStatus,
      campaign: call.campaign ? {
        id: call.campaign.id,
        name: call.campaign.name,
        serviceType: call.campaign.serviceType?.displayName || call.campaign.serviceType?.name
      } : null
    }));

    logger.info('Fetched affiliate calls', {
      affiliateId,
      page,
      limit,
      total,
      filters: { campaignId, status, isBillable: isBillableParam }
    });

    return NextResponse.json({
      success: true,
      data: formattedCalls,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (err) {
    captureApiError(err, { route: '/api/affiliates/calls', action: 'GET' });
    logger.error('Failed to fetch affiliate calls', {
      error: (err as Error).message
    });
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch calls'
    }, { status: 500 });
  }
}
