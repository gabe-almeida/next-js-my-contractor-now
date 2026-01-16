/**
 * Affiliate Balance API Route
 *
 * WHY: Provides affiliate balance information for the payout page.
 * WHEN: Called when loading affiliate payout/balance page.
 * HOW: Returns available balance, pending payouts, total paid, and payout eligibility.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAffiliateToken } from '@/lib/services/affiliate-service';
import { getAffiliateBalance } from '@/lib/services/affiliate-payment-service';
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

    // Get balance information
    const balance = await getAffiliateBalance(affiliateId);

    if (!balance) {
      return NextResponse.json(
        { success: false, error: 'Affiliate not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: balance
    });
  } catch (error) {
    logger.error('Failed to get affiliate balance', {
      error: (error as Error).message
    });
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
