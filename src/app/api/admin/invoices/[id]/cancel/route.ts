/**
 * Cancel Invoice API Route
 *
 * WHY: Transitions invoice to CANCELLED status with required reason.
 *      Cancelled invoices cannot be modified further.
 *
 * WHEN: POST - Cancel invoice with reason
 *
 * HOW: Uses InvoiceStatusService for validated status transitions.
 */

import { NextResponse } from 'next/server';
import { withMiddleware, EnhancedRequest } from '@/lib/middleware';
import { logger } from '@/lib/logger';
import { successResponse, errorResponse } from '@/lib/utils';
import { captureApiError } from '@/lib/sentry';
import { cancelInvoice } from '@/lib/services/invoice-status-service';
import { getInvoice } from '@/lib/services/invoice-service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/admin/invoices/[id]/cancel
 *
 * Cancels an invoice. Requires a reason for cancellation.
 * Valid from: DRAFT, SENT, OVERDUE, DISPUTED
 */
async function handleCancelInvoice(
  req: EnhancedRequest,
  context: RouteContext
): Promise<NextResponse> {
  const { requestId } = req.context;
  const { id } = await context.params;
  const user = (req as any).user;
  const ipAddress = req.context.ip;

  try {
    const body = await req.json();
    const { reason } = body;

    // Validate reason is provided
    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return NextResponse.json(
        errorResponse(
          'VALIDATION_ERROR',
          'Cancellation reason is required',
          undefined,
          'reason',
          requestId
        ),
        { status: 400 }
      );
    }

    // Cancel the invoice
    const result = await cancelInvoice(id, user.id, reason.trim(), ipAddress);

    if (!result.success) {
      return NextResponse.json(
        errorResponse(
          'CANCEL_ERROR',
          result.error || 'Failed to cancel invoice',
          undefined,
          undefined,
          requestId
        ),
        { status: 400 }
      );
    }

    // Fetch full invoice for response
    const invoice = await getInvoice(id);

    logger.info('Invoice cancelled via API', {
      invoiceId: id,
      invoiceNumber: result.invoice?.invoiceNumber,
      reason,
      adminId: user.id,
      requestId,
    });

    return NextResponse.json(
      successResponse(
        {
          invoice,
          message: 'Invoice cancelled successfully',
        },
        requestId
      )
    );
  } catch (error) {
    captureApiError(error, {
      route: '/api/admin/invoices/[id]/cancel',
      action: 'POST',
      extra: { requestId, invoiceId: id },
    });
    logger.error('Failed to cancel invoice', {
      error: (error as Error).message,
      invoiceId: id,
      requestId,
    });

    return NextResponse.json(
      errorResponse('CANCEL_ERROR', 'Failed to cancel invoice', undefined, undefined, requestId),
      { status: 500 }
    );
  }
}

// Export handler with admin authentication
export const POST = withMiddleware(handleCancelInvoice, {
  rateLimiter: 'admin',
  enableLogging: true,
  requireAuth: true,
  enableCors: true,
});
