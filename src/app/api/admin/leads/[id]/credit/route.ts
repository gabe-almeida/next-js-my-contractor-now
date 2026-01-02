/**
 * Lead Credit Issuance API Endpoint
 *
 * WHY: Allows super admins to issue credits/refunds for scrubbed or returned leads.
 *      Creates an auditable record of the credit with user attribution.
 *
 * WHEN: After a lead has been scrubbed/returned and contractor needs to be credited.
 *
 * HOW: Uses centralized lead-accounting-service to validate and record the credit.
 */

import { NextResponse } from 'next/server';
import { withMiddleware, EnhancedRequest } from '@/lib/middleware';
import { RedisCache } from '@/config/redis';
import { logger } from '@/lib/logger';
import { successResponse, errorResponse } from '@/lib/utils';
import { issueCredit } from '@/lib/services/lead-accounting-service';

async function handleIssueCredit(
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

    const body = await req.json();
    const { creditAmount, reason, adminUserId } = body;

    // Validate required fields
    if (!creditAmount || creditAmount <= 0) {
      return NextResponse.json(
        errorResponse('INVALID_AMOUNT', 'Credit amount must be greater than 0', { creditAmount }, 'creditAmount', requestId),
        { status: 400 }
      );
    }

    if (!reason || reason.trim().length === 0) {
      return NextResponse.json(
        errorResponse('MISSING_REASON', 'Reason is required for credit issuance', undefined, 'reason', requestId),
        { status: 400 }
      );
    }

    if (!adminUserId) {
      return NextResponse.json(
        errorResponse('MISSING_ADMIN', 'Admin user ID is required', undefined, 'adminUserId', requestId),
        { status: 400 }
      );
    }

    // Issue credit using centralized service
    const result = await issueCredit({
      leadId: id,
      creditAmount: parseFloat(creditAmount),
      reason: reason.trim(),
      adminUserId,
      ipAddress: req.context.ip
    });

    if (!result.success) {
      return NextResponse.json(
        errorResponse('CREDIT_FAILED', result.error || 'Failed to issue credit', undefined, undefined, requestId),
        { status: 400 }
      );
    }

    // Clear related caches
    await RedisCache.delete(`lead:${id}`);

    logger.info('Credit issued for lead', {
      leadId: id,
      creditAmount,
      adminUserId,
      requestId
    });

    return NextResponse.json(
      successResponse({
        leadId: id,
        creditAmount: result.lead?.creditAmount,
        disposition: result.lead?.disposition,
        creditIssuedAt: result.lead?.creditIssuedAt,
        historyEntry: {
          id: result.historyEntry?.id,
          createdAt: result.historyEntry?.createdAt
        }
      }, requestId)
    );

  } catch (error) {
    logger.error('Credit issuance error', {
      error: (error as Error).message,
      stack: (error as Error).stack,
      requestId,
      leadId: id
    });

    return NextResponse.json(
      errorResponse('CREDIT_ERROR', 'Failed to issue credit', undefined, undefined, requestId),
      { status: 500 }
    );
  }
}

export const POST = withMiddleware(handleIssueCredit, {
  rateLimiter: 'admin',
  enableLogging: true,
  requireAuth: true,
  validateContentType: true,
  enableCors: true
});
