/**
 * Single Invoice API Route
 *
 * WHY: Provides CRUD operations for individual invoices.
 *
 * WHEN: GET - Retrieve invoice with full details (line items, payments, history)
 *       PATCH - Update draft invoice details
 *       DELETE - Delete draft invoice
 *
 * HOW: Uses InvoiceService for operations with proper status validation.
 */

import { NextResponse } from 'next/server';
import { withMiddleware, EnhancedRequest } from '@/lib/middleware';
import { logger } from '@/lib/logger';
import { successResponse, errorResponse } from '@/lib/utils';
import { prisma } from '@/lib/prisma';
import { captureApiError } from '@/lib/sentry';
import {
  getInvoice,
  updateInvoice,
  addLineItems,
  removeLineItem,
  type LineItemInput,
} from '@/lib/services/invoice-service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/invoices/[id]
 *
 * Retrieves a single invoice with all related data.
 */
async function handleGetInvoice(
  req: EnhancedRequest,
  context: RouteContext
): Promise<NextResponse> {
  const { requestId } = req.context;
  const { id } = await context.params;

  try {
    const invoice = await getInvoice(id);

    if (!invoice) {
      return NextResponse.json(
        errorResponse('NOT_FOUND', 'Invoice not found', undefined, undefined, requestId),
        { status: 404 }
      );
    }

    return NextResponse.json(
      successResponse(
        {
          invoice,
          buyer: invoice.buyer,
          affiliate: invoice.affiliate,
        },
        requestId
      )
    );
  } catch (error) {
    captureApiError(error, {
      route: '/api/admin/invoices/[id]',
      action: 'GET',
      extra: { requestId, invoiceId: id },
    });
    logger.error('Failed to fetch invoice', {
      error: (error as Error).message,
      invoiceId: id,
      requestId,
    });

    return NextResponse.json(
      errorResponse('FETCH_ERROR', 'Failed to fetch invoice', undefined, undefined, requestId),
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/invoices/[id]
 *
 * Updates a draft invoice. Can update notes, payment terms, adjustments,
 * and add/remove line items.
 */
async function handleUpdateInvoice(
  req: EnhancedRequest,
  context: RouteContext
): Promise<NextResponse> {
  const { requestId } = req.context;
  const { id } = await context.params;
  const user = (req as any).user;

  try {
    const body = await req.json();
    const { notes, buyerNotes, paymentTermsDays, adjustments, addItems, removeItemIds } = body;

    // Check invoice exists and is editable
    const existing = await prisma.invoice.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!existing) {
      return NextResponse.json(
        errorResponse('NOT_FOUND', 'Invoice not found', undefined, undefined, requestId),
        { status: 404 }
      );
    }

    if (existing.status !== 'DRAFT') {
      return NextResponse.json(
        errorResponse(
          'INVALID_STATUS',
          `Cannot update invoice with status ${existing.status}. Only DRAFT invoices can be edited.`,
          undefined,
          undefined,
          requestId
        ),
        { status: 400 }
      );
    }

    // Remove line items if requested
    if (removeItemIds && Array.isArray(removeItemIds)) {
      for (const itemId of removeItemIds) {
        const removeResult = await removeLineItem(id, itemId, user.id);
        if (!removeResult.success) {
          return NextResponse.json(
            errorResponse('UPDATE_ERROR', removeResult.error || 'Failed to remove line item', undefined, undefined, requestId),
            { status: 400 }
          );
        }
      }
    }

    // Add line items if requested
    if (addItems && Array.isArray(addItems) && addItems.length > 0) {
      const addResult = await addLineItems(id, addItems as LineItemInput[], user.id);
      if (!addResult.success) {
        return NextResponse.json(
          errorResponse('UPDATE_ERROR', addResult.error || 'Failed to add line items', undefined, undefined, requestId),
          { status: 400 }
        );
      }
    }

    // Update other fields
    const hasFieldUpdates =
      notes !== undefined ||
      buyerNotes !== undefined ||
      paymentTermsDays !== undefined ||
      adjustments !== undefined;

    if (hasFieldUpdates) {
      const updateResult = await updateInvoice(
        id,
        {
          notes,
          buyerNotes,
          paymentTermsDays,
          adjustments,
        },
        user.id
      );

      if (!updateResult.success) {
        return NextResponse.json(
          errorResponse('UPDATE_ERROR', updateResult.error || 'Failed to update invoice', undefined, undefined, requestId),
          { status: 400 }
        );
      }
    }

    // Fetch updated invoice
    const updatedInvoice = await getInvoice(id);

    logger.info('Invoice updated via API', {
      invoiceId: id,
      invoiceNumber: updatedInvoice?.invoiceNumber,
      adminId: user.id,
      requestId,
    });

    return NextResponse.json(successResponse({ invoice: updatedInvoice }, requestId));
  } catch (error) {
    captureApiError(error, {
      route: '/api/admin/invoices/[id]',
      action: 'PATCH',
      extra: { requestId, invoiceId: id },
    });
    logger.error('Failed to update invoice', {
      error: (error as Error).message,
      invoiceId: id,
      requestId,
    });

    return NextResponse.json(
      errorResponse('UPDATE_ERROR', 'Failed to update invoice', undefined, undefined, requestId),
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/invoices/[id]
 *
 * Deletes a draft invoice. Only DRAFT invoices can be deleted.
 */
async function handleDeleteInvoice(
  req: EnhancedRequest,
  context: RouteContext
): Promise<NextResponse> {
  const { requestId } = req.context;
  const { id } = await context.params;
  const user = (req as any).user;

  try {
    // Check invoice exists and is deletable
    const existing = await prisma.invoice.findUnique({
      where: { id },
      select: { id: true, status: true, invoiceNumber: true },
    });

    if (!existing) {
      return NextResponse.json(
        errorResponse('NOT_FOUND', 'Invoice not found', undefined, undefined, requestId),
        { status: 404 }
      );
    }

    if (existing.status !== 'DRAFT') {
      return NextResponse.json(
        errorResponse(
          'INVALID_STATUS',
          `Cannot delete invoice with status ${existing.status}. Only DRAFT invoices can be deleted.`,
          undefined,
          undefined,
          requestId
        ),
        { status: 400 }
      );
    }

    // Delete invoice (cascade deletes line items, payments, history)
    await prisma.invoice.delete({
      where: { id },
    });

    logger.info('Invoice deleted via API', {
      invoiceId: id,
      invoiceNumber: existing.invoiceNumber,
      adminId: user.id,
      requestId,
    });

    return NextResponse.json(successResponse({ deleted: true, invoiceId: id }, requestId));
  } catch (error) {
    captureApiError(error, {
      route: '/api/admin/invoices/[id]',
      action: 'DELETE',
      extra: { requestId, invoiceId: id },
    });
    logger.error('Failed to delete invoice', {
      error: (error as Error).message,
      invoiceId: id,
      requestId,
    });

    return NextResponse.json(
      errorResponse('DELETE_ERROR', 'Failed to delete invoice', undefined, undefined, requestId),
      { status: 500 }
    );
  }
}

// Export handlers with admin authentication
export const GET = withMiddleware(handleGetInvoice, {
  rateLimiter: 'admin',
  enableLogging: true,
  requireAuth: true,
  enableCors: true,
});

export const PATCH = withMiddleware(handleUpdateInvoice, {
  rateLimiter: 'admin',
  enableLogging: true,
  requireAuth: true,
  enableCors: true,
});

export const DELETE = withMiddleware(handleDeleteInvoice, {
  rateLimiter: 'admin',
  enableLogging: true,
  requireAuth: true,
  enableCors: true,
});
