/**
 * Admin Payout Calculation API Route
 *
 * WHY: Allows admin to manually trigger weekly payout calculation.
 * WHEN: Admin clicks "Run Calculation" button in payout management.
 * HOW: Calls the payout calculation job and returns results.
 */

import { NextRequest, NextResponse } from 'next/server';
import { calculateWeeklyPayouts, previewWeeklyPayouts } from '@/lib/jobs/payout-calculation';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    // Parse request body for options
    const body = await request.json().catch(() => ({}));
    const preview = body.preview === true;

    if (preview) {
      // Preview mode - doesn't create payouts
      const result = await previewWeeklyPayouts();
      return NextResponse.json({
        success: result.success,
        data: result,
        preview: true
      });
    }

    // Run actual calculation
    const result = await calculateWeeklyPayouts();

    logger.info('Payout calculation completed via admin API', {
      payoutsCreated: result.payoutsCreated,
      totalAmount: result.totalPayoutAmount
    });

    return NextResponse.json({
      success: result.success,
      data: result
    });
  } catch (error) {
    logger.error('Failed to run payout calculation', {
      error: (error as Error).message
    });
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
