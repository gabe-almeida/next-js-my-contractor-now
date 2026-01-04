/**
 * Affiliate Commissions API
 *
 * GET /api/affiliates/commissions - List affiliate's commissions
 * Requires affiliate authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAffiliateToken } from '@/lib/services/affiliate-service';
import { getCommissionsByAffiliateId, getAffiliateStats } from '@/lib/services/affiliate-commission-service';
import { CommissionStatus } from '@/types/database';

/**
 * Extracts and verifies affiliate ID from request
 */
function getAffiliateIdFromRequest(request: NextRequest): {
  affiliateId: string | null;
  error: string | null;
} {
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { affiliateId: null, error: 'Authorization required' };
  }

  const token = authHeader.substring(7);
  const verification = verifyAffiliateToken(token);

  if (!verification.valid) {
    return { affiliateId: null, error: verification.error || 'Invalid token' };
  }

  return { affiliateId: verification.affiliateId!, error: null };
}

export async function GET(request: NextRequest) {
  try {
    const { affiliateId, error } = getAffiliateIdFromRequest(request);

    if (!affiliateId) {
      return NextResponse.json({
        success: false,
        error
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    const status = searchParams.get('status') as CommissionStatus | null;
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    // Fetch commissions and stats in parallel
    const [result, stats] = await Promise.all([
      getCommissionsByAffiliateId(affiliateId, {
        page,
        limit,
        status: status || undefined,
        dateFrom: dateFrom ? new Date(dateFrom) : undefined,
        dateTo: dateTo ? new Date(dateTo) : undefined
      }),
      getAffiliateStats(affiliateId)
    ]);

    // Format commissions with lead info (privacy-safe)
    const commissions = result.commissions.map(commission => ({
      id: commission.id,
      leadId: commission.leadId,
      amount: commission.amount,
      rate: commission.rate,
      status: commission.status,
      approvedAt: commission.approvedAt,
      paidAt: commission.paidAt,
      createdAt: commission.createdAt,
      // Include limited lead info
      lead: commission.lead ? {
        serviceType: (commission.lead as any).serviceType?.displayName,
        status: (commission.lead as any).status
      } : null
    }));

    return NextResponse.json({
      success: true,
      data: commissions,
      pagination: {
        page: result.page,
        totalPages: result.totalPages,
        total: result.total
      },
      totals: {
        pending: stats.pendingCommissions,
        approved: stats.approvedCommissions,
        paid: stats.totalEarned - stats.pendingCommissions - stats.approvedCommissions
      }
    });

  } catch (error) {
    console.error('Get affiliate commissions error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get commissions'
    }, { status: 500 });
  }
}
