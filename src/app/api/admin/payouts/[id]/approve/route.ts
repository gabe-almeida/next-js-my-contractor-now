/**
 * Admin Payout Approve API Route
 *
 * WHY: Allows admin to approve a pending payout.
 * WHEN: Admin clicks "Approve" on a pending payout.
 * HOW: Updates payout status from PENDING to PROCESSING.
 */

import { NextRequest, NextResponse } from 'next/server';
import { approvePayout } from '@/lib/services/affiliate-payment-service';
import { logger } from '@/lib/logger';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // TODO: Get admin user ID from session
    const adminUserId = 'admin';

    const payout = await approvePayout(id, adminUserId);

    logger.info('Payout approved via admin API', {
      payoutId: id,
      adminUserId
    });

    return NextResponse.json({
      success: true,
      data: payout
    });
  } catch (error) {
    logger.error('Failed to approve payout', {
      error: (error as Error).message
    });
    return NextResponse.json(
      { success: false, error: 'Failed to approve payout' },
      { status: 500 }
    );
  }
}
