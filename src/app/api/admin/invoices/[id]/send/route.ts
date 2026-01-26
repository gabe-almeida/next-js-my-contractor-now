/**
 * Send Invoice API Route
 *
 * WHY: Transitions invoice from DRAFT to SENT status.
 *      Sets issuedAt, dueDate based on payment terms.
 *
 * WHEN: POST - Send invoice (marks as SENT, starts Net 30 countdown)
 *
 * HOW: Uses InvoiceStatusService for validated status transitions.
 */

import { NextResponse } from 'next/server';
import { withMiddleware, EnhancedRequest } from '@/lib/middleware';
import { logger } from '@/lib/logger';
import { successResponse, errorResponse } from '@/lib/utils';
import { captureApiError } from '@/lib/sentry';
import { sendInvoice } from '@/lib/services/invoice-status-service';
import { getInvoice } from '@/lib/services/invoice-service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/admin/invoices/[id]/send
 *
 * Sends an invoice, transitioning it from DRAFT to SENT.
 * Sets issuedAt to now and dueDate to now + paymentTermsDays.
 */
async function handleSendInvoice(
  req: EnhancedRequest,
  context: RouteContext
): Promise<NextResponse> {
  const { requestId } = req.context;
  const { id } = await context.params;
  const user = (req as any).user;
  const ipAddress = req.context.ip;

  try {
    // Send the invoice
    const result = await sendInvoice(id, user.id, ipAddress);

    if (!result.success) {
      return NextResponse.json(
        errorResponse(
          'SEND_ERROR',
          result.error || 'Failed to send invoice',
          undefined,
          undefined,
          requestId
        ),
        { status: 400 }
      );
    }

    // Fetch full invoice for response
    const invoice = await getInvoice(id);

    logger.info('Invoice sent via API', {
      invoiceId: id,
      invoiceNumber: result.invoice?.invoiceNumber,
      dueDate: result.invoice?.dueDate,
      adminId: user.id,
      requestId,
    });

    return NextResponse.json(
      successResponse(
        {
          invoice: {
            ...result.invoice,
            ...invoice,
          },
          message: 'Invoice sent successfully',
        },
        requestId
      )
    );
  } catch (error) {
    captureApiError(error, {
      route: '/api/admin/invoices/[id]/send',
      action: 'POST',
      extra: { requestId, invoiceId: id },
    });
    logger.error('Failed to send invoice', {
      error: (error as Error).message,
      invoiceId: id,
      requestId,
    });

    return NextResponse.json(
      errorResponse('SEND_ERROR', 'Failed to send invoice', undefined, undefined, requestId),
      { status: 500 }
    );
  }
}

// Export handler with admin authentication
export const POST = withMiddleware(handleSendInvoice, {
  rateLimiter: 'admin',
  enableLogging: true,
  requireAuth: true,
  enableCors: true,
});
