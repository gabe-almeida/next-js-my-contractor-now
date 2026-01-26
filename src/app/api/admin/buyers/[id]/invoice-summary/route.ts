/**
 * Buyer Invoice Summary API Route
 *
 * WHY: Provides a summary of all invoices for a specific buyer.
 *      Shows outstanding balance, payment history, and invoice breakdown.
 *
 * WHEN: GET - Retrieve invoice summary for a buyer
 *
 * HOW: Aggregates invoice data filtered by buyer ID.
 */

import { NextResponse } from 'next/server';
import { withMiddleware, EnhancedRequest } from '@/lib/middleware';
import { logger } from '@/lib/logger';
import { successResponse, errorResponse } from '@/lib/utils';
import { prisma } from '@/lib/prisma';
import { captureApiError } from '@/lib/sentry';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/buyers/[id]/invoice-summary
 *
 * Returns comprehensive invoice summary for a buyer including:
 * - Outstanding balance
 * - Total billed
 * - Total paid
 * - Invoice counts by status
 * - Recent invoices
 */
async function handleGetInvoiceSummary(
  req: EnhancedRequest,
  context: RouteContext
): Promise<NextResponse> {
  const { requestId } = req.context;
  const { id: buyerId } = await context.params;

  try {
    // Verify buyer exists
    const buyer = await prisma.buyer.findUnique({
      where: { id: buyerId },
      select: {
        id: true,
        name: true,
        displayName: true,
        billingEmail: true,
        paymentTermsDays: true,
      },
    });

    if (!buyer) {
      return NextResponse.json(
        errorResponse('NOT_FOUND', 'Buyer not found', undefined, undefined, requestId),
        { status: 404 }
      );
    }

    // Get invoice aggregates
    const [totals, statusCounts, recentInvoices, paymentHistory] = await Promise.all([
      // Overall totals
      prisma.invoice.aggregate({
        where: {
          buyerId,
          status: { not: 'CANCELLED' },
        },
        _sum: {
          total: true,
          amountPaid: true,
          balance: true,
        },
        _count: true,
      }),

      // Counts by status
      prisma.invoice.groupBy({
        by: ['status'],
        where: { buyerId },
        _count: true,
        _sum: {
          balance: true,
        },
      }),

      // Recent invoices
      prisma.invoice.findMany({
        where: { buyerId },
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          total: true,
          balance: true,
          issuedAt: true,
          dueDate: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),

      // Recent payments
      prisma.invoicePayment.findMany({
        where: {
          invoice: { buyerId },
        },
        select: {
          id: true,
          amount: true,
          paymentDate: true,
          paymentMethod: true,
          invoice: {
            select: {
              invoiceNumber: true,
            },
          },
        },
        orderBy: { paymentDate: 'desc' },
        take: 10,
      }),
    ]);

    // Build status summary
    const byStatus: Record<string, { count: number; balance: number }> = {};
    for (const s of statusCounts) {
      byStatus[s.status] = {
        count: s._count,
        balance: Number(s._sum.balance || 0),
      };
    }

    // Calculate outstanding (non-paid, non-cancelled)
    const outstandingResult = await prisma.invoice.aggregate({
      where: {
        buyerId,
        status: { in: ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] },
      },
      _sum: { balance: true },
      _count: true,
    });

    // Check for overdue invoices
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const overdueResult = await prisma.invoice.aggregate({
      where: {
        buyerId,
        status: { in: ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] },
        dueDate: { lt: today },
      },
      _sum: { balance: true },
      _count: true,
    });

    return NextResponse.json(
      successResponse(
        {
          buyer: {
            id: buyer.id,
            name: buyer.displayName || buyer.name,
            billingEmail: buyer.billingEmail,
            paymentTermsDays: buyer.paymentTermsDays,
          },
          summary: {
            totalInvoices: totals._count,
            totalBilled: Number(totals._sum.total || 0),
            totalPaid: Number(totals._sum.amountPaid || 0),
            totalOutstanding: Number(outstandingResult._sum.balance || 0),
            outstandingCount: outstandingResult._count,
            overdueAmount: Number(overdueResult._sum.balance || 0),
            overdueCount: overdueResult._count,
          },
          byStatus,
          recentInvoices: recentInvoices.map((inv) => ({
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            status: inv.status,
            total: Number(inv.total),
            balance: Number(inv.balance),
            issuedAt: inv.issuedAt,
            dueDate: inv.dueDate,
            createdAt: inv.createdAt,
          })),
          recentPayments: paymentHistory.map((pmt) => ({
            id: pmt.id,
            amount: Number(pmt.amount),
            paymentDate: pmt.paymentDate,
            paymentMethod: pmt.paymentMethod,
            invoiceNumber: pmt.invoice.invoiceNumber,
          })),
        },
        requestId
      )
    );
  } catch (error) {
    captureApiError(error, {
      route: '/api/admin/buyers/[id]/invoice-summary',
      action: 'GET',
      extra: { requestId, buyerId },
    });
    logger.error('Failed to fetch buyer invoice summary', {
      error: (error as Error).message,
      buyerId,
      requestId,
    });

    return NextResponse.json(
      errorResponse('FETCH_ERROR', 'Failed to fetch invoice summary', undefined, undefined, requestId),
      { status: 500 }
    );
  }
}

// Export handler with admin authentication
export const GET = withMiddleware(handleGetInvoiceSummary, {
  rateLimiter: 'admin',
  enableLogging: true,
  requireAuth: true,
  enableCors: true,
});
