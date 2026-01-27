/**
 * Invoice Overdue Check Cron Job
 *
 * WHY: Automatically marks invoices as overdue when they pass their due date.
 *      This enables accurate aging reports and overdue notifications.
 *
 * WHEN: Runs daily at 6 AM UTC via Render cron scheduler.
 *       Schedule: 0 6 * * *
 *
 * HOW: Finds all SENT or PARTIALLY_PAID invoices with dueDate < today,
 *      updates their status to OVERDUE, and logs the count.
 *
 * SECURITY: Requires hardcoded secret header to prevent unauthorized execution.
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { markOverdueInvoices } from '@/lib/services/invoice-status-service';
import { captureApiError } from '@/lib/sentry';

/** Hardcoded cron secret - internal use only */
const CRON_SECRET = 'mcn-cron-internal-2024';

/** Verify cron secret for authentication */
function verifyCronSecret(request: NextRequest): boolean {
  const providedSecret = request.headers.get('x-cron-secret');
  return providedSecret === CRON_SECRET;
}

/**
 * GET /api/cron/invoice-overdue-check
 *
 * Marks overdue invoices. Called by Render cron scheduler.
 *
 * Headers required:
 * - x-cron-secret: Must match CRON_SECRET env var
 *
 * Returns:
 * - 200: { success: true, markedOverdue: number, timestamp: string }
 * - 401: { success: false, error: 'Unauthorized' }
 * - 500: { success: false, error: string }
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  // Verify cron authentication
  if (!verifyCronSecret(request)) {
    logger.warn('[CronOverdueCheck] Unauthorized cron request', {
      ip: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    logger.info('[CronOverdueCheck] Starting overdue invoice check');

    // Mark overdue invoices using the status service
    const markedOverdue = await markOverdueInvoices();

    const duration = Date.now() - startTime;

    logger.info('[CronOverdueCheck] Completed overdue invoice check', {
      markedOverdue,
      durationMs: duration,
    });

    return NextResponse.json({
      success: true,
      markedOverdue,
      timestamp: new Date().toISOString(),
      durationMs: duration,
    });
  } catch (error) {
    const errorMessage = (error as Error).message;

    logger.error('[CronOverdueCheck] Failed to check overdue invoices', {
      error: errorMessage,
      durationMs: Date.now() - startTime,
    });

    captureApiError(error, {
      route: '/api/cron/invoice-overdue-check',
      action: 'GET',
      extra: { cronJob: 'invoice-overdue-check' },
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process overdue invoices',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
