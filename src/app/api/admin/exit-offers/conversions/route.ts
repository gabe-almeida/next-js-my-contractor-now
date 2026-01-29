/**
 * Exit Offers Conversions API Route
 *
 * WHY: List exit offer conversions with lead attribution for admin review
 * WHEN: Admin views conversions table in Partner Offers tab
 * HOW: Query ExitOfferConversion with lead join, paginate, filter by date
 */

import { NextResponse } from 'next/server';
import { withMiddleware, EnhancedRequest } from '@/lib/middleware';
import { logger } from '@/lib/logger';
import { successResponse, errorResponse } from '@/lib/utils';
import { prisma } from '@/lib/prisma';
import { captureApiError } from '@/lib/sentry';

type TimeframeOption = '7d' | '30d' | '90d' | 'all';

interface ConversionItem {
  id: string;
  receivedAt: string;
  convertedAt: string | null;
  transactionId: string;
  payout: number;
  status: string;
  affSub: string | null;
  affSub2: string | null;
  leadNotFound: boolean;
  lead: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    affiliateRef: string | null;
  } | null;
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
 * Extract affiliate ref from lead compliance data
 */
function getAffiliateRef(complianceData: string | null): string | null {
  if (!complianceData) return null;

  try {
    const parsed = JSON.parse(complianceData);
    return parsed?.attribution?.ref || null;
  } catch {
    return null;
  }
}

/**
 * Extract first/last name from lead form data
 */
function getLeadName(formData: string | null): { firstName: string | null; lastName: string | null } {
  if (!formData) return { firstName: null, lastName: null };

  try {
    const parsed = JSON.parse(formData);
    return {
      firstName: parsed?.firstName || parsed?.first_name || null,
      lastName: parsed?.lastName || parsed?.last_name || null
    };
  } catch {
    return { firstName: null, lastName: null };
  }
}

/**
 * GET /api/admin/exit-offers/conversions
 *
 * Query params:
 * - offerType: string (default: 'adt_home_security')
 * - timeframe: 7d | 30d | 90d | all (default: 30d)
 * - page: number (default: 1)
 * - limit: number (default: 20, max: 100)
 * - status: string (optional, filter by status)
 * - leadNotFound: boolean (optional, filter by lead not found)
 */
async function handleGetConversions(req: EnhancedRequest): Promise<NextResponse> {
  const { requestId } = req.context;

  try {
    const url = new URL(req.url);
    const offerType = url.searchParams.get('offerType') || 'adt_home_security';
    const timeframe = (url.searchParams.get('timeframe') || '30d') as TimeframeOption;
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
    const status = url.searchParams.get('status');
    const leadNotFoundParam = url.searchParams.get('leadNotFound');
    const skip = (page - 1) * limit;

    // Validate timeframe
    if (!['7d', '30d', '90d', 'all'].includes(timeframe)) {
      return NextResponse.json(
        errorResponse('INVALID_TIMEFRAME', 'Timeframe must be 7d, 30d, 90d, or all', { timeframe }, 'timeframe', requestId),
        { status: 400 }
      );
    }

    const startDate = getStartDate(timeframe);

    // Build where clause
    const whereClause: {
      offerType: string;
      receivedAt?: { gte: Date };
      status?: string;
      leadNotFound?: boolean;
    } = {
      offerType
    };

    if (startDate) {
      whereClause.receivedAt = { gte: startDate };
    }

    if (status) {
      whereClause.status = status;
    }

    if (leadNotFoundParam !== null) {
      whereClause.leadNotFound = leadNotFoundParam === 'true';
    }

    // Get conversions with lead data
    const [conversions, totalCount] = await Promise.all([
      prisma.exitOfferConversion.findMany({
        where: whereClause,
        include: {
          lead: {
            select: {
              id: true,
              formData: true,
              complianceData: true
            }
          }
        },
        orderBy: { receivedAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.exitOfferConversion.count({ where: whereClause })
    ]);

    // Format conversions
    const formattedConversions: ConversionItem[] = conversions.map(conv => {
      const leadName = conv.lead ? getLeadName(conv.lead.formData) : { firstName: null, lastName: null };
      const affiliateRef = conv.lead ? getAffiliateRef(conv.lead.complianceData) : null;

      return {
        id: conv.id,
        receivedAt: conv.receivedAt.toISOString(),
        convertedAt: conv.convertedAt?.toISOString() || null,
        transactionId: conv.transactionId,
        payout: Number(conv.payout),
        status: conv.status,
        affSub: conv.affSub,
        affSub2: conv.affSub2,
        leadNotFound: conv.leadNotFound,
        lead: conv.lead ? {
          id: conv.lead.id,
          firstName: leadName.firstName,
          lastName: leadName.lastName,
          affiliateRef
        } : null
      };
    });

    const result = {
      conversions: formattedConversions,
      pagination: {
        page,
        limit,
        total: totalCount,
        hasMore: skip + limit < totalCount,
        totalPages: Math.ceil(totalCount / limit)
      },
      filters: {
        offerType,
        timeframe,
        status,
        leadNotFound: leadNotFoundParam
      }
    };

    return NextResponse.json(successResponse(result, requestId));

  } catch (error) {
    captureApiError(error, { route: '/api/admin/exit-offers/conversions', action: 'GET' });
    logger.error('Exit offers conversions fetch error', {
      error: (error as Error).message,
      stack: (error as Error).stack,
      requestId
    });

    return NextResponse.json(
      errorResponse('FETCH_ERROR', 'Failed to fetch exit offers conversions', undefined, undefined, requestId),
      { status: 500 }
    );
  }
}

export const GET = withMiddleware(handleGetConversions, {
  rateLimiter: 'admin',
  enableLogging: true,
  requireAuth: true,
  enableCors: true
});
