/**
 * Admin Payout Complete API Route
 *
 * WHY: Allows admin to mark a payout as paid/completed.
 * WHEN: Admin clicks "Mark Paid" on a processing payout.
 * HOW: Updates payout status from PROCESSING to COMPLETED with payment reference.
 */

import { NextRequest, NextResponse } from 'next/server';
import { completePayout } from '@/lib/services/affiliate-payment-service';
import { logger } from '@/lib/logger';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const paymentReference = body.paymentReference || undefined;

    const payout = await completePayout(id, paymentReference);

    logger.info('Payout completed via admin API', {
      payoutId: id,
      paymentReference
    });

    return NextResponse.json({
      success: true,
      data: payout
    });
  } catch (error) {
    logger.error('Failed to complete payout', {
      error: (error as Error).message
    });
    return NextResponse.json(
      { success: false, error: 'Failed to complete payout' },
      { status: 500 }
    );
  }
}
