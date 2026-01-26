/**
 * Invoice Stats API Route
 *
 * WHY: Provides summary statistics for invoices dashboard.
 *
 * WHEN: GET - Retrieve invoice stats and aging report
 *
 * HOW: Aggregates invoice data from database with proper filtering.
 */

import { NextResponse } from 'next/server';
import { withMiddleware, EnhancedRequest } from '@/lib/middleware';
import { logger } from '@/lib/logger';
import { successResponse, errorResponse } from '@/lib/utils';
import { prisma } from '@/lib/prisma';
import { captureApiError } from '@/lib/sentry';
import { InvoiceType, InvoiceStatus } from '@prisma/client';
import Decimal from 'decimal.js';

/**
 * GET /api/admin/invoices/stats
 *
 * Returns comprehensive invoice statistics including:
 * - Total counts by status
 * - Outstanding amounts
 * - Aging report (30/60/90 days)
 * - Recent activity
 */
async function handleGetStats(req: EnhancedRequest): Promise<NextResponse> {
  const { requestId } = req.context;
  const url = new URL(req.url);

  try {
    // Optional type filter
    const typeParam = url.searchParams.get('type') as InvoiceType | null;

    const baseWhere = typeParam ? { type: typeParam } : {};

    // Get counts by status
    const statusCounts = await prisma.invoice.groupBy({
      by: ['status'],
      where: baseWhere,
      _count: true,
      _sum: {
        total: true,
        balance: true,
      },
    });

    // Build status summary
    const byStatus: Record<
      string,
      { count: number; totalAmount: number; outstandingAmount: number }
    > = {};
    for (const s of statusCounts) {
      byStatus[s.status] = {
        count: s._count,
        totalAmount: Number(s._sum.total || 0),
        outstandingAmount: Number(s._sum.balance || 0),
      };
    }

    // Get total outstanding
    const outstandingResult = await prisma.invoice.aggregate({
      where: {
        ...baseWhere,
        status: { in: ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] },
      },
      _sum: {
        balance: true,
        total: true,
      },
      _count: true,
    });

    // Get aging report (invoices past due)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const sixtyDaysAgo = new Date(today);
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const ninetyDaysAgo = new Date(today);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // Overdue invoices by age
    const [overdue0to30, overdue31to60, overdue61to90, overdueOver90] = await Promise.all([
      // 0-30 days overdue
      prisma.invoice.aggregate({
        where: {
          ...baseWhere,
          status: { in: ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] },
          dueDate: {
            lt: today,
            gte: thirtyDaysAgo,
          },
        },
        _sum: { balance: true },
        _count: true,
      }),
      // 31-60 days overdue
      prisma.invoice.aggregate({
        where: {
          ...baseWhere,
          status: { in: ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] },
          dueDate: {
            lt: thirtyDaysAgo,
            gte: sixtyDaysAgo,
          },
        },
        _sum: { balance: true },
        _count: true,
      }),
      // 61-90 days overdue
      prisma.invoice.aggregate({
        where: {
          ...baseWhere,
          status: { in: ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] },
          dueDate: {
            lt: sixtyDaysAgo,
            gte: ninetyDaysAgo,
          },
        },
        _sum: { balance: true },
        _count: true,
      }),
      // Over 90 days overdue
      prisma.invoice.aggregate({
        where: {
          ...baseWhere,
          status: { in: ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] },
          dueDate: {
            lt: ninetyDaysAgo,
          },
        },
        _sum: { balance: true },
        _count: true,
      }),
    ]);

    const agingReport = {
      current: {
        count: overdue0to30._count,
        amount: Number(overdue0to30._sum.balance || 0),
      },
      days31to60: {
        count: overdue31to60._count,
        amount: Number(overdue31to60._sum.balance || 0),
      },
      days61to90: {
        count: overdue61to90._count,
        amount: Number(overdue61to90._sum.balance || 0),
      },
      over90: {
        count: overdueOver90._count,
        amount: Number(overdueOver90._sum.balance || 0),
      },
    };

    // Get receivables vs payables breakdown
    const [receivablesStats, payablesStats] = await Promise.all([
      prisma.invoice.aggregate({
        where: {
          type: 'RECEIVABLE',
          status: { in: ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] },
        },
        _sum: { balance: true },
        _count: true,
      }),
      prisma.invoice.aggregate({
        where: {
          type: 'PAYABLE',
          status: { in: ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] },
        },
        _sum: { balance: true },
        _count: true,
      }),
    ]);

    // Recent activity (last 7 days)
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [recentInvoices, recentPayments] = await Promise.all([
      prisma.invoice.count({
        where: {
          ...baseWhere,
          createdAt: { gte: sevenDaysAgo },
        },
      }),
      prisma.invoicePayment.aggregate({
        where: {
          createdAt: { gte: sevenDaysAgo },
        },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    // Total counts
    const totalInvoices = statusCounts.reduce((sum, s) => sum + s._count, 0);

    const response = successResponse(
      {
        summary: {
          totalInvoices,
          totalOutstanding: Number(outstandingResult._sum.balance || 0),
          outstandingCount: outstandingResult._count,
          totalBilled: Number(outstandingResult._sum.total || 0),
        },
        byStatus,
        agingReport,
        byType: {
          receivables: {
            count: receivablesStats._count,
            outstanding: Number(receivablesStats._sum.balance || 0),
          },
          payables: {
            count: payablesStats._count,
            outstanding: Number(payablesStats._sum.balance || 0),
          },
        },
        recentActivity: {
          invoicesCreated: recentInvoices,
          paymentsReceived: recentPayments._count,
          paymentsAmount: Number(recentPayments._sum.amount || 0),
          period: '7 days',
        },
      },
      requestId
    );

    return NextResponse.json(response);
  } catch (error) {
    captureApiError(error, {
      route: '/api/admin/invoices/stats',
      action: 'GET',
      extra: { requestId },
    });
    logger.error('Failed to fetch invoice stats', {
      error: (error as Error).message,
      requestId,
    });

    return NextResponse.json(
      errorResponse('FETCH_ERROR', 'Failed to fetch invoice stats', undefined, undefined, requestId),
      { status: 500 }
    );
  }
}

// Export handler with admin authentication
export const GET = withMiddleware(handleGetStats, {
  rateLimiter: 'admin',
  enableLogging: true,
  requireAuth: true,
  enableCors: true,
});
