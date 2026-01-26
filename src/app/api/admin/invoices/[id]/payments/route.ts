/**
 * Invoice Payments API Route
 *
 * WHY: Manages payment records for invoices.
 *      Supports partial and full payments with concurrency control.
 *
 * WHEN: GET - List payments for an invoice
 *       POST - Record a new payment
 *
 * HOW: Uses PaymentService with optimistic locking to prevent race conditions.
 */

import { NextResponse } from 'next/server';
import { withMiddleware, EnhancedRequest } from '@/lib/middleware';
import { logger } from '@/lib/logger';
import { successResponse, errorResponse } from '@/lib/utils';
import { prisma } from '@/lib/prisma';
import { captureApiError } from '@/lib/sentry';
import {
  recordPayment,
  getInvoicePayments,
  getPaymentSummary,
  isValidPaymentMethod,
} from '@/lib/services/payment-service';
import { PaymentMethod } from '@prisma/client';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/invoices/[id]/payments
 *
 * Lists all payments for an invoice with summary stats.
 */
async function handleGetPayments(
  req: EnhancedRequest,
  context: RouteContext
): Promise<NextResponse> {
  const { requestId } = req.context;
  const { id } = await context.params;

  try {
    // Verify invoice exists
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      select: { id: true, invoiceNumber: true },
    });

    if (!invoice) {
      return NextResponse.json(
        errorResponse('NOT_FOUND', 'Invoice not found', undefined, undefined, requestId),
        { status: 404 }
      );
    }

    // Get payments and summary
    const [payments, summary] = await Promise.all([
      getInvoicePayments(id),
      getPaymentSummary(id),
    ]);

    return NextResponse.json(
      successResponse(
        {
          invoiceId: id,
          invoiceNumber: invoice.invoiceNumber,
          payments,
          summary,
        },
        requestId
      )
    );
  } catch (error) {
    captureApiError(error, {
      route: '/api/admin/invoices/[id]/payments',
      action: 'GET',
      extra: { requestId, invoiceId: id },
    });
    logger.error('Failed to fetch invoice payments', {
      error: (error as Error).message,
      invoiceId: id,
      requestId,
    });

    return NextResponse.json(
      errorResponse('FETCH_ERROR', 'Failed to fetch payments', undefined, undefined, requestId),
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/invoices/[id]/payments
 *
 * Records a new payment against an invoice.
 * Uses optimistic locking to prevent concurrent payment issues.
 */
async function handleRecordPayment(
  req: EnhancedRequest,
  context: RouteContext
): Promise<NextResponse> {
  const { requestId } = req.context;
  const { id } = await context.params;
  const user = (req as any).user;

  try {
    const body = await req.json();
    const { amount, paymentDate, paymentMethod, referenceNumber, bankAccount, notes } = body;

    // Validate required fields
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        errorResponse(
          'VALIDATION_ERROR',
          'Payment amount must be a positive number',
          undefined,
          'amount',
          requestId
        ),
        { status: 400 }
      );
    }

    if (!paymentDate) {
      return NextResponse.json(
        errorResponse(
          'VALIDATION_ERROR',
          'Payment date is required',
          undefined,
          'paymentDate',
          requestId
        ),
        { status: 400 }
      );
    }

    if (!paymentMethod || !isValidPaymentMethod(paymentMethod)) {
      return NextResponse.json(
        errorResponse(
          'VALIDATION_ERROR',
          'Invalid payment method. Must be one of: WIRE, ACH, CHECK, PAYPAL, CREDIT_CARD, OTHER',
          undefined,
          'paymentMethod',
          requestId
        ),
        { status: 400 }
      );
    }

    // Record the payment
    const result = await recordPayment(id, amount, user.id, {
      paymentDate: new Date(paymentDate),
      paymentMethod: paymentMethod as PaymentMethod,
      referenceNumber,
      bankAccount,
      notes,
    });

    if (!result.success) {
      return NextResponse.json(
        errorResponse(
          'PAYMENT_ERROR',
          result.error || 'Failed to record payment',
          undefined,
          undefined,
          requestId
        ),
        { status: 400 }
      );
    }

    logger.info('Payment recorded via API', {
      invoiceId: id,
      invoiceNumber: result.invoice?.invoiceNumber,
      paymentId: result.payment?.id,
      amount,
      newStatus: result.invoice?.status,
      newBalance: result.invoice?.balance?.toString(),
      adminId: user.id,
      requestId,
    });

    return NextResponse.json(
      successResponse(
        {
          payment: result.payment,
          invoice: result.invoice,
          message: 'Payment recorded successfully',
        },
        requestId
      ),
      { status: 201 }
    );
  } catch (error) {
    captureApiError(error, {
      route: '/api/admin/invoices/[id]/payments',
      action: 'POST',
      extra: { requestId, invoiceId: id },
    });
    logger.error('Failed to record payment', {
      error: (error as Error).message,
      invoiceId: id,
      requestId,
    });

    return NextResponse.json(
      errorResponse('PAYMENT_ERROR', 'Failed to record payment', undefined, undefined, requestId),
      { status: 500 }
    );
  }
}

// Export handlers with admin authentication
export const GET = withMiddleware(handleGetPayments, {
  rateLimiter: 'admin',
  enableLogging: true,
  requireAuth: true,
  enableCors: true,
});

export const POST = withMiddleware(handleRecordPayment, {
  rateLimiter: 'admin',
  enableLogging: true,
  requireAuth: true,
  enableCors: true,
});
