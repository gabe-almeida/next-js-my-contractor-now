/**
 * Affiliate Stats API
 *
 * GET /api/affiliates/stats - Get dashboard statistics
 * Requires affiliate authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAffiliateToken } from '@/lib/services/affiliate-service';
import { getAffiliateStats } from '@/lib/services/affiliate-commission-service';

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

    const stats = await getAffiliateStats(affiliateId);

    return NextResponse.json({
      success: true,
      data: {
        // Earnings - field names match frontend expectations
        totalEarnings: stats.totalEarned,
        pendingEarnings: stats.pendingCommissions,
        approvedCommissions: stats.approvedCommissions,
        availableBalance: stats.availableForWithdrawal,
        // Traffic stats
        totalClicks: stats.totalClicks,
        totalConversions: stats.totalConversions,
        conversionRate: Math.round(stats.conversionRate * 10000) / 100, // As percentage
        activeLinks: stats.activeLinks
      }
    });

  } catch (error) {
    console.error('Get affiliate stats error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get statistics'
    }, { status: 500 });
  }
}
