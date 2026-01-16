/**
 * Admin Payouts API Route
 *
 * WHY: Provides payout listing and management for admin users.
 * WHEN: Admin loads payout management page.
 * HOW: Returns paginated list of all payouts with optional filters.
 */

import { NextRequest, NextResponse } from 'next/server';
import { listPayouts } from '@/lib/services/affiliate-payment-service';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const status = searchParams.get('status') || undefined;
    const affiliateId = searchParams.get('affiliateId') || undefined;

    // Get payouts
    const result = await listPayouts({
      affiliateId,
      status,
      page,
      limit
    });

    return NextResponse.json({
      success: true,
      data: result.payouts,
      pagination: {
        page: result.page,
        totalPages: result.totalPages,
        total: result.total
      }
    });
  } catch (error) {
    logger.error('Failed to list payouts', {
      error: (error as Error).message
    });
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
