/**
 * Affiliate Payables API Route
 *
 * WHY: Provides summary of amounts owed to an affiliate.
 *      Shows both pending commissions and formal payable invoices.
 *
 * WHEN: GET - Retrieve payables summary for an affiliate
 *
 * HOW: Aggregates data from both AffiliatePayment and Invoice (PAYABLE type).
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
 * GET /api/admin/affiliates/[id]/payables
 *
 * Returns comprehensive payables summary for an affiliate including:
 * - Pending commissions (unpaid leads)
 * - Outstanding invoices (PAYABLE type)
 * - Payment history
 * - Due dates
 */
async function handleGetPayables(
  req: EnhancedRequest,
  context: RouteContext
): Promise<NextResponse> {
  const { requestId } = req.context;
  const { id: affiliateId } = await context.params;

  try {
    // Verify affiliate exists
    const affiliate = await prisma.affiliate.findUnique({
      where: { id: affiliateId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        companyName: true,
        email: true,
        paymentTerms: true,
      },
    });

    if (!affiliate) {
      return NextResponse.json(
        errorResponse('NOT_FOUND', 'Affiliate not found', undefined, undefined, requestId),
        { status: 404 }
      );
    }

    // Get invoice aggregates (PAYABLE type)
    const [invoiceTotals, invoicesByStatus, recentInvoices] = await Promise.all([
      // Overall totals for payable invoices
      prisma.invoice.aggregate({
        where: {
          affiliateId,
          type: 'PAYABLE',
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
        where: {
          affiliateId,
          type: 'PAYABLE',
        },
        _count: true,
        _sum: {
          balance: true,
        },
      }),

      // Recent payable invoices
      prisma.invoice.findMany({
        where: {
          affiliateId,
          type: 'PAYABLE',
        },
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          total: true,
          balance: true,
          periodStart: true,
          periodEnd: true,
          dueDate: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    // Get AffiliatePayment records (operational payout tracking)
    // Uses netAmount instead of amount (correct field name per schema)
    const [pendingPayouts, completedPayouts] = await Promise.all([
      // Pending payouts
      prisma.affiliatePayment.aggregate({
        where: {
          affiliateId,
          status: { in: ['PENDING', 'PROCESSING'] },
        },
        _sum: { netAmount: true },
        _count: true,
      }),

      // Completed payouts (last 90 days)
      prisma.affiliatePayment.findMany({
        where: {
          affiliateId,
          status: 'COMPLETED',
          paidAt: {
            gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
          },
        },
        select: {
          id: true,
          netAmount: true,
          periodStart: true,
          periodEnd: true,
          paidAt: true,
          paymentMethod: true,
        },
        orderBy: { paidAt: 'desc' },
        take: 10,
      }),
    ]);

    // Get unpaid commissions from AffiliateCommission table
    const unpaidCommissions = await prisma.affiliateCommission.aggregate({
      where: {
        affiliateId,
        status: 'PENDING',
      },
      _sum: {
        amount: true,
      },
      _count: true,
    });

    // Calculate outstanding amounts
    const outstandingInvoices = await prisma.invoice.aggregate({
      where: {
        affiliateId,
        type: 'PAYABLE',
        status: { in: ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] },
      },
      _sum: { balance: true },
      _count: true,
    });

    // Build status summary
    const byStatus: Record<string, { count: number; balance: number }> = {};
    for (const s of invoicesByStatus) {
      byStatus[s.status] = {
        count: s._count,
        balance: Number(s._sum.balance || 0),
      };
    }

    // Calculate next due date
    const nextDueInvoice = await prisma.invoice.findFirst({
      where: {
        affiliateId,
        type: 'PAYABLE',
        status: { in: ['SENT', 'PARTIALLY_PAID'] },
        dueDate: { gte: new Date() },
      },
      select: {
        dueDate: true,
        balance: true,
      },
      orderBy: { dueDate: 'asc' },
    });

    return NextResponse.json(
      successResponse(
        {
          affiliate: {
            id: affiliate.id,
            name:
              `${affiliate.firstName} ${affiliate.lastName}`.trim() ||
              affiliate.companyName ||
              affiliate.email,
            email: affiliate.email,
            paymentTerms: affiliate.paymentTerms,
          },
          summary: {
            totalInvoiced: Number(invoiceTotals._sum.total || 0),
            totalPaid: Number(invoiceTotals._sum.amountPaid || 0),
            totalOutstanding: Number(outstandingInvoices._sum.balance || 0),
            outstandingInvoiceCount: outstandingInvoices._count,
            pendingPayouts: {
              count: pendingPayouts._count,
              amount: Number(pendingPayouts._sum?.netAmount || 0),
            },
            unpaidCommissions: {
              leadCount: unpaidCommissions._count,
              amount: Number(unpaidCommissions._sum?.amount || 0),
            },
          },
          nextDue: nextDueInvoice
            ? {
                dueDate: nextDueInvoice.dueDate,
                amount: Number(nextDueInvoice.balance),
              }
            : null,
          byStatus,
          recentInvoices: recentInvoices.map((inv) => ({
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            status: inv.status,
            total: Number(inv.total),
            balance: Number(inv.balance),
            periodStart: inv.periodStart,
            periodEnd: inv.periodEnd,
            dueDate: inv.dueDate,
            createdAt: inv.createdAt,
          })),
          recentPayouts: completedPayouts.map((pmt) => ({
            id: pmt.id,
            amount: Number(pmt.netAmount),
            periodStart: pmt.periodStart,
            periodEnd: pmt.periodEnd,
            paidAt: pmt.paidAt,
            paymentMethod: pmt.paymentMethod,
          })),
        },
        requestId
      )
    );
  } catch (error) {
    captureApiError(error, {
      route: '/api/admin/affiliates/[id]/payables',
      action: 'GET',
      extra: { requestId, affiliateId },
    });
    logger.error('Failed to fetch affiliate payables', {
      error: (error as Error).message,
      affiliateId,
      requestId,
    });

    return NextResponse.json(
      errorResponse('FETCH_ERROR', 'Failed to fetch affiliate payables', undefined, undefined, requestId),
      { status: 500 }
    );
  }
}

// Export handler with admin authentication
export const GET = withMiddleware(handleGetPayables, {
  rateLimiter: 'admin',
  enableLogging: true,
  requireAuth: true,
  enableCors: true,
});
