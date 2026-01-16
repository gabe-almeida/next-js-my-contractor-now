/**
 * Admin Payout Reject API Route
 *
 * WHY: Allows admin to reject a pending payout.
 * WHEN: Admin clicks "Reject" on a pending payout.
 * HOW: Updates payout status from PENDING to FAILED with reason.
 */

import { NextRequest, NextResponse } from 'next/server';
import { rejectPayout } from '@/lib/services/affiliate-payment-service';
import { logger } from '@/lib/logger';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Parse request body
    const body = await request.json();
    const reason = body.reason;

    if (!reason) {
      return NextResponse.json(
        { success: false, error: 'Rejection reason is required' },
        { status: 400 }
      );
    }

    // TODO: Get admin user ID from session
    const adminUserId = 'admin';

    const payout = await rejectPayout(id, adminUserId, reason);

    logger.info('Payout rejected via admin API', {
      payoutId: id,
      adminUserId,
      reason
    });

    return NextResponse.json({
      success: true,
      data: payout
    });
  } catch (error) {
    logger.error('Failed to reject payout', {
      error: (error as Error).message
    });
    return NextResponse.json(
      { success: false, error: 'Failed to reject payout' },
      { status: 500 }
    );
  }
}
