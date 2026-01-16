/**
 * Admin Payout Stats API Route
 *
 * WHY: Provides summary statistics for the payout management dashboard.
 * WHEN: Admin loads payout management page.
 * HOW: Aggregates payout data by status and date range.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    // Get start of current month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Aggregate stats in parallel
    const [pendingStats, processingStats, completedStats] = await Promise.all([
      prisma.affiliatePayment.aggregate({
        where: { status: 'PENDING' },
        _count: { id: true },
        _sum: { netAmount: true }
      }),
      prisma.affiliatePayment.aggregate({
        where: { status: 'PROCESSING' },
        _count: { id: true },
        _sum: { netAmount: true }
      }),
      prisma.affiliatePayment.aggregate({
        where: {
          status: 'COMPLETED',
          paidAt: { gte: monthStart }
        },
        _count: { id: true },
        _sum: { netAmount: true }
      })
    ]);

    return NextResponse.json({
      success: true,
      data: {
        pendingCount: pendingStats._count.id,
        pendingAmount: pendingStats._sum.netAmount
          ? Number(pendingStats._sum.netAmount)
          : 0,
        processingCount: processingStats._count.id,
        processingAmount: processingStats._sum.netAmount
          ? Number(processingStats._sum.netAmount)
          : 0,
        completedThisMonth: completedStats._count.id,
        completedAmountThisMonth: completedStats._sum.netAmount
          ? Number(completedStats._sum.netAmount)
          : 0
      }
    });
  } catch (error) {
    logger.error('Failed to get payout stats', {
      error: (error as Error).message
    });
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
