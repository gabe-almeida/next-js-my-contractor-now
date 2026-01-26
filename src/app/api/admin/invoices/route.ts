/**
 * Invoices API Route
 *
 * WHY: Provides list and create endpoints for invoices.
 *      Supports filtering by status, type, buyer, affiliate, and date range.
 *
 * WHEN: GET - List invoices with optional filters
 *       POST - Create new invoice with line items
 *
 * HOW: Uses InvoiceService for CRUD operations with proper validation.
 */

import { NextResponse } from 'next/server';
import { withMiddleware, EnhancedRequest } from '@/lib/middleware';
import { logger } from '@/lib/logger';
import { successResponse, errorResponse } from '@/lib/utils';
import { prisma } from '@/lib/prisma';
import { captureApiError } from '@/lib/sentry';
import {
  createInvoice,
  getInvoices,
  getUninvoicedLeads,
  type CreateInvoiceInput,
  type LineItemInput,
} from '@/lib/services/invoice-service';
import { InvoiceType, InvoiceStatus } from '@prisma/client';

/**
 * GET /api/admin/invoices
 *
 * Lists invoices with filtering and pagination.
 * Includes summary stats (totalOutstanding, totalOverdue, overdueCount).
 */
async function handleGetInvoices(req: EnhancedRequest): Promise<NextResponse> {
  const { requestId } = req.context;
  const url = new URL(req.url);

  try {
    // Parse query parameters
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = Math.min(parseInt(url.searchParams.get('pageSize') || '20'), 100);
    const type = url.searchParams.get('type') as InvoiceType | null;
    const statusParam = url.searchParams.get('status');
    const buyerId = url.searchParams.get('buyerId');
    const affiliateId = url.searchParams.get('affiliateId');
    const periodStart = url.searchParams.get('periodStart');
    const periodEnd = url.searchParams.get('periodEnd');

    // Parse status (can be comma-separated for multiple)
    let status: InvoiceStatus | InvoiceStatus[] | undefined;
    if (statusParam) {
      const statuses = statusParam.split(',') as InvoiceStatus[];
      status = statuses.length === 1 ? statuses[0] : statuses;
    }

    // Get invoices
    const result = await getInvoices({
      type: type || undefined,
      status,
      buyerId: buyerId || undefined,
      affiliateId: affiliateId || undefined,
      periodStart: periodStart ? new Date(periodStart) : undefined,
      periodEnd: periodEnd ? new Date(periodEnd) : undefined,
      page,
      pageSize,
    });

    // Calculate summary stats
    const [outstandingStats, overdueStats] = await Promise.all([
      prisma.invoice.aggregate({
        where: { status: { in: ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] } },
        _sum: { balance: true },
      }),
      prisma.invoice.aggregate({
        where: { status: 'OVERDUE' },
        _sum: { balance: true },
        _count: true,
      }),
    ]);

    const response = successResponse(
      {
        invoices: result.invoices,
        pagination: result.pagination,
        summary: {
          totalOutstanding: outstandingStats._sum.balance || 0,
          totalOverdue: overdueStats._sum.balance || 0,
          overdueCount: overdueStats._count || 0,
        },
      },
      requestId
    );

    return NextResponse.json(response);
  } catch (error) {
    captureApiError(error, {
      route: '/api/admin/invoices',
      action: 'GET',
      extra: { requestId },
    });
    logger.error('Failed to fetch invoices', {
      error: (error as Error).message,
      requestId,
    });

    return NextResponse.json(
      errorResponse('FETCH_ERROR', 'Failed to fetch invoices', undefined, undefined, requestId),
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/invoices
 *
 * Creates a new invoice. For buyer invoices, auto-includes all uninvoiced leads
 * in the date range if no line items provided.
 */
async function handleCreateInvoice(req: EnhancedRequest): Promise<NextResponse> {
  const { requestId } = req.context;
  const user = (req as any).user;

  try {
    const body = await req.json();
    const { type, buyerId, affiliateId, periodStart, periodEnd, paymentTermsDays, notes, buyerNotes, lineItems } = body;

    // Validate required fields
    if (!type || !['RECEIVABLE', 'PAYABLE'].includes(type)) {
      return NextResponse.json(
        errorResponse('VALIDATION_ERROR', 'Invalid invoice type. Must be RECEIVABLE or PAYABLE', undefined, 'type', requestId),
        { status: 400 }
      );
    }

    if (!periodStart || !periodEnd) {
      return NextResponse.json(
        errorResponse('VALIDATION_ERROR', 'Period start and end dates are required', undefined, undefined, requestId),
        { status: 400 }
      );
    }

    const parsedPeriodStart = new Date(periodStart);
    const parsedPeriodEnd = new Date(periodEnd);

    if (parsedPeriodStart > parsedPeriodEnd) {
      return NextResponse.json(
        errorResponse('VALIDATION_ERROR', 'Period start must be before period end', undefined, undefined, requestId),
        { status: 400 }
      );
    }

    // Build line items
    let invoiceLineItems: LineItemInput[] = lineItems || [];

    // For buyer invoices without line items, auto-include uninvoiced leads
    if (type === 'RECEIVABLE' && buyerId && invoiceLineItems.length === 0) {
      const uninvoicedLeads = await getUninvoicedLeads(buyerId, parsedPeriodStart, parsedPeriodEnd);

      if (uninvoicedLeads.length === 0) {
        return NextResponse.json(
          errorResponse('NO_LEADS', 'No uninvoiced leads found for this buyer in the specified period', undefined, undefined, requestId),
          { status: 400 }
        );
      }

      invoiceLineItems = uninvoicedLeads.map((lead) => ({
        leadId: lead.id,
        description: `Lead - ${lead.serviceType?.displayName || lead.serviceType?.name || 'Unknown Service'} (${lead.zipCode})`,
        quantity: 1,
        unitPrice: lead.winningBid?.toNumber() || 0,
        itemType: 'LEAD',
        metadata: {
          zipCode: lead.zipCode,
          serviceType: lead.serviceType?.name,
          createdAt: lead.createdAt,
        },
      }));
    }

    // Validate we have line items
    if (invoiceLineItems.length === 0) {
      return NextResponse.json(
        errorResponse('VALIDATION_ERROR', 'Invoice must have at least one line item', undefined, undefined, requestId),
        { status: 400 }
      );
    }

    // Create invoice input
    const input: CreateInvoiceInput = {
      type,
      buyerId: type === 'RECEIVABLE' ? buyerId : undefined,
      affiliateId: type === 'PAYABLE' ? affiliateId : undefined,
      periodStart: parsedPeriodStart,
      periodEnd: parsedPeriodEnd,
      paymentTermsDays: paymentTermsDays || 30,
      notes,
      buyerNotes,
      lineItems: invoiceLineItems,
    };

    const result = await createInvoice(input, user.id);

    if (!result.success) {
      return NextResponse.json(
        errorResponse('CREATE_ERROR', result.error || 'Failed to create invoice', undefined, undefined, requestId),
        { status: 400 }
      );
    }

    logger.info('Invoice created via API', {
      invoiceId: result.invoice?.id,
      invoiceNumber: result.invoice?.invoiceNumber,
      type,
      buyerId,
      affiliateId,
      lineItemCount: invoiceLineItems.length,
      adminId: user.id,
      requestId,
    });

    return NextResponse.json(successResponse({ invoice: result.invoice }, requestId), { status: 201 });
  } catch (error) {
    captureApiError(error, {
      route: '/api/admin/invoices',
      action: 'POST',
      extra: { requestId },
    });
    logger.error('Failed to create invoice', {
      error: (error as Error).message,
      requestId,
    });

    return NextResponse.json(
      errorResponse('CREATE_ERROR', 'Failed to create invoice', undefined, undefined, requestId),
      { status: 500 }
    );
  }
}

// Export handlers with admin authentication
export const GET = withMiddleware(handleGetInvoices, {
  rateLimiter: 'admin',
  enableLogging: true,
  requireAuth: true,
  enableCors: true,
});

export const POST = withMiddleware(handleCreateInvoice, {
  rateLimiter: 'admin',
  enableLogging: true,
  requireAuth: true,
  enableCors: true,
});
