/**
 * Affiliate Analytics API
 *
 * GET /api/affiliates/analytics - Get analytics data for affiliate dashboard
 *
 * WHY: Provides time-series and summary data for affiliate analytics page.
 * WHEN: Loading affiliate analytics dashboard with charts.
 * HOW: Uses analytics service to aggregate call data with date filtering.
 *
 * Query parameters:
 *   - startDate: ISO date string (required)
 *   - endDate: ISO date string (required)
 *   - campaignId: Filter by specific campaign (optional)
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAffiliateToken } from '@/lib/services/affiliate-service';
import { getAffiliateAnalytics } from '@/lib/services/analytics-service';
import { captureApiError } from '@/lib/sentry';
import { logger } from '@/lib/logger';

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
      return NextResponse.json(
        { success: false, error },
        { status: 401 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    const campaignId = searchParams.get('campaignId') || undefined;

    // Validate date parameters
    if (!startDateStr || !endDateStr) {
      return NextResponse.json(
        { success: false, error: 'startDate and endDate are required' },
        { status: 400 }
      );
    }

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { success: false, error: 'Invalid date format' },
        { status: 400 }
      );
    }

    // Set time boundaries for full day coverage
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    // Fetch analytics data
    const analytics = await getAffiliateAnalytics(
      affiliateId,
      { startDate, endDate },
      campaignId
    );

    logger.info('Affiliate analytics fetched', {
      affiliateId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      campaignId,
      totalCalls: analytics.summary.totalCalls,
    });

    return NextResponse.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    captureApiError(error, { route: '/api/affiliates/analytics', action: 'GET' });
    logger.error('Affiliate analytics error:', { error: (error as Error).message });

    return NextResponse.json(
      { success: false, error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}
