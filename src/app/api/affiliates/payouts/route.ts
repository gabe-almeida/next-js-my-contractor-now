/**
 * Affiliate Payouts API Route
 *
 * WHY: Provides payout history for affiliates.
 * WHEN: Called when loading affiliate payout page.
 * HOW: Returns paginated list of payouts for the authenticated affiliate.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAffiliateToken } from '@/lib/services/affiliate-service';
import { listPayouts } from '@/lib/services/affiliate-payment-service';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    // Verify affiliate authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const verification = verifyAffiliateToken(token);

    if (!verification.valid || !verification.affiliateId) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      );
    }

    const affiliateId = verification.affiliateId;

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const status = searchParams.get('status') || undefined;

    // Get payouts for this affiliate
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
    logger.error('Failed to get affiliate payouts', {
      error: (error as Error).message
    });
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
