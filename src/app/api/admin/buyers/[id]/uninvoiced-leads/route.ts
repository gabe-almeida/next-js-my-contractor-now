/**
 * Uninvoiced Leads API Route
 *
 * WHY: Returns leads sold to a buyer that haven't been invoiced yet.
 *      Used when creating new invoices to auto-populate line items.
 *
 * WHEN: GET - List uninvoiced leads for a buyer in a date range
 *
 * HOW: Queries leads that don't have any non-cancelled invoice line items.
 */

import { NextResponse } from 'next/server';
import { withMiddleware, EnhancedRequest } from '@/lib/middleware';
import { logger } from '@/lib/logger';
import { successResponse, errorResponse } from '@/lib/utils';
import { prisma } from '@/lib/prisma';
import { captureApiError } from '@/lib/sentry';
import { getUninvoicedLeads } from '@/lib/services/invoice-service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/buyers/[id]/uninvoiced-leads
 *
 * Returns leads sold to this buyer that haven't been invoiced.
 * Requires periodStart and periodEnd query parameters.
 */
async function handleGetUninvoicedLeads(
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
      select: { id: true, name: true, displayName: true },
    });

    if (!buyer) {
      return NextResponse.json(
        errorResponse('NOT_FOUND', 'Buyer not found', undefined, undefined, requestId),
        { status: 404 }
      );
    }

    // Parse date range
    const periodStartParam = url.searchParams.get('periodStart');
    const periodEndParam = url.searchParams.get('periodEnd');

    if (!periodStartParam || !periodEndParam) {
      return NextResponse.json(
        errorResponse(
          'VALIDATION_ERROR',
          'periodStart and periodEnd query parameters are required',
          undefined,
          undefined,
          requestId
        ),
        { status: 400 }
      );
    }

    const periodStart = new Date(periodStartParam);
    const periodEnd = new Date(periodEndParam);

    if (isNaN(periodStart.getTime()) || isNaN(periodEnd.getTime())) {
      return NextResponse.json(
        errorResponse(
          'VALIDATION_ERROR',
          'Invalid date format. Use ISO 8601 format (YYYY-MM-DD)',
          undefined,
          undefined,
          requestId
        ),
        { status: 400 }
      );
    }

    if (periodStart > periodEnd) {
      return NextResponse.json(
        errorResponse(
          'VALIDATION_ERROR',
          'periodStart must be before periodEnd',
          undefined,
          undefined,
          requestId
        ),
        { status: 400 }
      );
    }

    // Get uninvoiced leads
    const leads = await getUninvoicedLeads(buyerId, periodStart, periodEnd);

    // Calculate summary
    const summary = {
      totalLeads: leads.length,
      totalValue: leads.reduce((sum, lead) => sum + (lead.winningBid?.toNumber() || 0), 0),
    };

    return NextResponse.json(
      successResponse(
        {
          buyer: {
            id: buyer.id,
            name: buyer.displayName || buyer.name,
          },
          period: {
            start: periodStart.toISOString(),
            end: periodEnd.toISOString(),
          },
          leads: leads.map((lead) => ({
            id: lead.id,
            zipCode: lead.zipCode,
            serviceType: lead.serviceType,
            winningBid: lead.winningBid?.toNumber() || 0,
            createdAt: lead.createdAt,
          })),
          summary,
        },
        requestId
      )
    );
  } catch (error) {
    captureApiError(error, {
      route: '/api/admin/buyers/[id]/uninvoiced-leads',
      action: 'GET',
      extra: { requestId, buyerId },
    });
    logger.error('Failed to fetch uninvoiced leads', {
      error: (error as Error).message,
      buyerId,
      requestId,
    });

    return NextResponse.json(
      errorResponse('FETCH_ERROR', 'Failed to fetch uninvoiced leads', undefined, undefined, requestId),
      { status: 500 }
    );
  }
}

// Export handler with admin authentication
export const GET = withMiddleware(handleGetUninvoicedLeads, {
  rateLimiter: 'admin',
  enableLogging: true,
  requireAuth: true,
  enableCors: true,
});
