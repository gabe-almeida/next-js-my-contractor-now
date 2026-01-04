/**
 * Admin Withdrawals API
 *
 * GET /api/admin/withdrawals - List all withdrawal requests
 * Requires admin authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateAdminAuth } from '@/lib/security';
import {
  getAllWithdrawals,
  getWithdrawalStats
} from '@/lib/services/affiliate-withdrawal-service';
import { WithdrawalStatus } from '@/types/database';

export async function GET(request: NextRequest) {
  try {
    // Validate admin auth
    const authResult = await validateAdminAuth(request);
    if (!authResult.valid) {
      return NextResponse.json({
        success: false,
        error: authResult.error || 'Unauthorized'
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const status = searchParams.get('status') as WithdrawalStatus | null;
    const affiliateId = searchParams.get('affiliateId');

    // Get withdrawals and stats
    const [result, stats] = await Promise.all([
      getAllWithdrawals({
        page,
        limit,
        status: status || undefined,
        affiliateId: affiliateId || undefined
      }),
      getWithdrawalStats()
    ]);

    // Format withdrawals for admin view
    const withdrawals = result.withdrawals.map(w => ({
      id: w.id,
      affiliateId: w.affiliateId,
      amount: w.amount,
      method: w.method,
      status: w.status,
      processedAt: w.processedAt,
      processedBy: w.processedBy,
      notes: w.notes,
      createdAt: w.createdAt,
      affiliate: w.affiliate ? {
        email: (w.affiliate as any).email,
        firstName: (w.affiliate as any).firstName,
        lastName: (w.affiliate as any).lastName
      } : null
    }));

    return NextResponse.json({
      success: true,
      data: withdrawals,
      stats: {
        totalRequested: stats.totalRequested,
        totalProcessing: stats.totalProcessing,
        totalCompleted: stats.totalCompleted,
        totalFailed: stats.totalFailed,
        pendingAmount: stats.pendingAmount
      },
      pagination: {
        page: result.page,
        totalPages: result.totalPages,
        total: result.total
      }
    });

  } catch (error) {
    console.error('Get admin withdrawals error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get withdrawals'
    }, { status: 500 });
  }
}
