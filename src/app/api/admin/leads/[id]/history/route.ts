/**
 * Lead Status History API Endpoint
 *
 * WHY: Provides audit trail visibility for super admins to see all status/disposition
 *      changes for a lead, including who made the change and when.
 *
 * WHEN: Called when viewing lead details to display the Status History section.
 *
 * HOW: Queries LeadStatusHistory table and returns enriched records with admin user info.
 */

import { NextResponse } from 'next/server';
import { withMiddleware, EnhancedRequest } from '@/lib/middleware';
import { logger } from '@/lib/logger';
import { successResponse, errorResponse } from '@/lib/utils';
import { getLeadStatusHistory } from '@/lib/services/lead-accounting-service';

async function handleGetHistory(
  req: EnhancedRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const { requestId } = req.context;
  const { id } = params;

  try {
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        errorResponse('INVALID_ID', 'Invalid lead ID format', { id }, 'id', requestId),
        { status: 400 }
      );
    }

    // Get history using centralized service
    const history = await getLeadStatusHistory(id);

    // Format response for frontend
    const formattedHistory = history.map(entry => ({
      id: entry.id,
      timestamp: entry.createdAt,
      oldStatus: entry.oldStatus,
      newStatus: entry.newStatus,
      oldDisposition: entry.oldDisposition,
      newDisposition: entry.newDisposition,
      reason: entry.reason,
      creditAmount: entry.creditAmount,
      changeSource: entry.changeSource,
      changedBy: entry.adminUser
        ? { id: entry.adminUser.id, name: entry.adminUser.name, email: entry.adminUser.email }
        : { id: null, name: 'System', email: null },
      ipAddress: entry.ipAddress
    }));

    return NextResponse.json(
      successResponse({ leadId: id, history: formattedHistory }, requestId)
    );

  } catch (error) {
    logger.error('Lead history fetch error', {
      error: (error as Error).message,
      stack: (error as Error).stack,
      requestId,
      leadId: id
    });

    return NextResponse.json(
      errorResponse('FETCH_ERROR', 'Failed to fetch lead history', undefined, undefined, requestId),
      { status: 500 }
    );
  }
}

export const GET = withMiddleware(handleGetHistory, {
  rateLimiter: 'admin',
  enableLogging: true,
  requireAuth: true,
  enableCors: true
});
