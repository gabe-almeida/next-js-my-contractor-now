/**
 * Buyer Scrub Reconciliation API Route
 *
 * WHY: Processes buyer scrubs when leads are returned/rejected after invoicing.
 *      Networks like Modernize scrub ~10% of leads at reconciliation time.
 *
 * WHEN: POST - Process scrubbed leads, creating credits for next invoice
 *
 * HOW: Uses ScrubReconciliationService to validate and process scrubs.
 */

import { NextResponse } from 'next/server';
import { withMiddleware, EnhancedRequest } from '@/lib/middleware';
import { logger } from '@/lib/logger';
import { successResponse, errorResponse } from '@/lib/utils';
import { prisma } from '@/lib/prisma';
import { captureApiError } from '@/lib/sentry';
import {
  processBuyerScrubs,
  validateScrubLeads,
  getPendingCredits,
} from '@/lib/services/scrub-reconciliation-service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/admin/buyers/[id]/scrub-reconciliation
 *
 * Processes scrubbed leads reported by a buyer.
 * For each valid lead:
 * - Updates disposition to CREDITED
 * - Records in lead status history
 * - Returns summary of credits for next invoice
 *
 * Body:
 * - leadIds: string[] - Array of lead IDs to scrub
 * - reason: string - Reason for scrub (e.g., "invalid contact", "duplicate")
 * - validateOnly?: boolean - If true, only validates without processing
 */
async function handleScrubReconciliation(
  req: EnhancedRequest,
  context: RouteContext
): Promise<NextResponse> {
  const { requestId } = req.context;
  const { id: buyerId } = await context.params;
  const user = (req as any).user;

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

    const body = await req.json();
    const { leadIds, reason, validateOnly } = body;

    // Validate required fields
    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json(
        errorResponse(
          'VALIDATION_ERROR',
          'leadIds must be a non-empty array of lead IDs',
          undefined,
          'leadIds',
          requestId
        ),
        { status: 400 }
      );
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return NextResponse.json(
        errorResponse(
          'VALIDATION_ERROR',
          'Scrub reason is required',
          undefined,
          'reason',
          requestId
        ),
        { status: 400 }
      );
    }

    // Validate leads first
    const validation = await validateScrubLeads(buyerId, leadIds);

    // If validation only, return results
    if (validateOnly) {
      return NextResponse.json(
        successResponse(
          {
            buyer: {
              id: buyer.id,
              name: buyer.displayName || buyer.name,
            },
            validation: {
              totalSubmitted: leadIds.length,
              valid: validation.totalValid,
              invalid: validation.totalInvalid,
              validLeads: validation.valid,
              invalidLeads: validation.invalid,
            },
            estimatedCredit: validation.valid.reduce(
              (sum, l) => sum + (l.winningBid || 0),
              0
            ),
          },
          requestId
        )
      );
    }

    // Check if there are valid leads to process
    if (validation.totalValid === 0) {
      return NextResponse.json(
        errorResponse(
          'NO_VALID_LEADS',
          'No valid leads to process. Check the validation results.',
          { invalidLeads: validation.invalid },
          undefined,
          requestId
        ),
        { status: 400 }
      );
    }

    // Process the scrubs (only valid leads)
    const validLeadIds = validation.valid.map((l) => l.leadId);
    const result = await processBuyerScrubs(buyerId, validLeadIds, user.id, reason.trim());

    if (!result.success) {
      return NextResponse.json(
        errorResponse(
          'SCRUB_ERROR',
          result.error || 'Failed to process scrubs',
          undefined,
          undefined,
          requestId
        ),
        { status: 400 }
      );
    }

    // Get pending credits after processing
    const pendingCredits = await getPendingCredits(buyerId);

    logger.info('Buyer scrub reconciliation processed', {
      buyerId,
      buyerName: buyer.displayName || buyer.name,
      submitted: leadIds.length,
      processed: result.processed,
      failed: result.failed,
      totalCredit: result.totalCredit.toString(),
      adminId: user.id,
      requestId,
    });

    return NextResponse.json(
      successResponse(
        {
          buyer: {
            id: buyer.id,
            name: buyer.displayName || buyer.name,
            expectedScrubRate: buyer.expectedScrubRate?.toNumber(),
          },
          processed: {
            submitted: leadIds.length,
            successful: result.processed,
            failed: result.failed,
            totalCredit: result.totalCredit.toNumber(),
          },
          results: result.results,
          validation: {
            invalid: validation.invalid,
          },
          pendingCredits: {
            count: pendingCredits.length,
            totalAmount: pendingCredits.reduce(
              (sum, l) => sum + (l.creditAmount?.toNumber() || l.winningBid?.toNumber() || 0),
              0
            ),
          },
          message: `Successfully processed ${result.processed} scrubbed leads. $${result.totalCredit.toFixed(2)} in credits will be applied to the next invoice.`,
        },
        requestId
      )
    );
  } catch (error) {
    captureApiError(error, {
      route: '/api/admin/buyers/[id]/scrub-reconciliation',
      action: 'POST',
      extra: { requestId, buyerId },
    });
    logger.error('Failed to process scrub reconciliation', {
      error: (error as Error).message,
      buyerId,
      requestId,
    });

    return NextResponse.json(
      errorResponse('SCRUB_ERROR', 'Failed to process scrub reconciliation', undefined, undefined, requestId),
      { status: 500 }
    );
  }
}

// Export handler with admin authentication
export const POST = withMiddleware(handleScrubReconciliation, {
  rateLimiter: 'admin',
  enableLogging: true,
  requireAuth: true,
  enableCors: true,
});
