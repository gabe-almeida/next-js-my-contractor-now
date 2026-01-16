/**
 * Admin Call Analytics API
 *
 * GET /api/admin/analytics/calls - Get call-specific analytics for admin dashboard
 *
 * WHY: Provides call performance analytics separate from lead analytics.
 * WHEN: Loading admin call analytics dashboard with charts and rankings.
 * HOW: Uses analytics service to aggregate call data with date filtering.
 *
 * Query parameters:
 *   - startDate: ISO date string (required)
 *   - endDate: ISO date string (required)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminOverviewAnalytics } from '@/lib/services/analytics-service';
import { captureApiError } from '@/lib/sentry';
import { logger } from '@/lib/logger';
import { verifyJwtToken } from '@/lib/security';

/**
 * Verify admin authentication from request
 */
function verifyAdminAuth(request: NextRequest): {
  valid: boolean;
  error?: string;
} {
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false, error: 'Authorization required' };
  }

  const token = authHeader.substring(7);
  const verification = verifyJwtToken(token);

  if (!verification.valid) {
    return { valid: false, error: verification.error || 'Invalid token' };
  }

  // Verify admin role
  if (verification.payload?.role !== 'admin') {
    return { valid: false, error: 'Admin access required' };
  }

  return { valid: true };
}

export async function GET(request: NextRequest) {
  try {
    const authResult = verifyAdminAuth(request);

    if (!authResult.valid) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: 401 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');

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
    const analytics = await getAdminOverviewAnalytics({ startDate, endDate });

    logger.info('Admin call analytics fetched', {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      totalCalls: analytics.summary.totalCalls,
    });

    return NextResponse.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    captureApiError(error, { route: '/api/admin/analytics/calls', action: 'GET' });
    logger.error('Admin call analytics error:', { error: (error as Error).message });

    return NextResponse.json(
      { success: false, error: 'Failed to fetch call analytics' },
      { status: 500 }
    );
  }
}
