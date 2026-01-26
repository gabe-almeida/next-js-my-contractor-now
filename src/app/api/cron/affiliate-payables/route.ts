/**
 * Monthly Affiliate Payable Generation Cron Job
 *
 * WHY: Automatically creates PAYABLE invoices for affiliates based on their
 *      approved commissions from the previous month. This ensures consistent
 *      and timely affiliate payment processing.
 *
 * WHEN: Runs on the 1st of each month at midnight UTC via Render cron scheduler.
 *       Schedule: 0 0 1 * *
 *
 * HOW: For each active affiliate with APPROVED commissions from the previous month:
 *      1. Gets all APPROVED commissions that aren't yet on an invoice
 *      2. Creates a PAYABLE invoice with line items for each commission/lead
 *      3. Sets dueDate to Net 30 from invoice creation
 *
 * SECURITY: Requires CRON_SECRET header to prevent unauthorized execution.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { captureApiError } from '@/lib/sentry';
import { createInvoice, type LineItemInput } from '@/lib/services/invoice-service';
import { toDecimal, roundCurrency } from '@/lib/utils/decimal-helpers';

/** System admin ID for automated invoice creation */
const SYSTEM_ADMIN_ID = 'system-cron';

/** Verify cron secret for authentication */
function verifyCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;

  // If CRON_SECRET is not set, reject all requests
  if (!cronSecret) {
    logger.warn('[CronAffiliatePayables] CRON_SECRET not configured');
    return false;
  }

  const providedSecret = request.headers.get('x-cron-secret');
  return providedSecret === cronSecret;
}

/**
 * Get the date range for the previous month
 */
function getPreviousMonthRange(): { start: Date; end: Date } {
  const now = new Date();
  const firstOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Last day of previous month is day 0 of current month
  const lastOfPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0);
  lastOfPreviousMonth.setHours(23, 59, 59, 999);

  // First day of previous month
  const firstOfPreviousMonth = new Date(
    lastOfPreviousMonth.getFullYear(),
    lastOfPreviousMonth.getMonth(),
    1
  );
  firstOfPreviousMonth.setHours(0, 0, 0, 0);

  return {
    start: firstOfPreviousMonth,
    end: lastOfPreviousMonth,
  };
}

/**
 * Get a system admin ID for automated operations
 * Falls back to finding any admin user if system account doesn't exist
 */
async function getSystemAdminId(): Promise<string | null> {
  // Try to find a system admin or any active admin
  const admin = await prisma.adminUser.findFirst({
    where: { active: true },
    select: { id: true },
    orderBy: { createdAt: 'asc' }, // Get the oldest/first admin
  });

  return admin?.id || null;
}

/**
 * GET /api/cron/affiliate-payables
 *
 * Generates monthly affiliate payable invoices. Called by Render cron scheduler.
 *
 * Headers required:
 * - x-cron-secret: Must match CRON_SECRET env var
 *
 * Returns:
 * - 200: { success: true, invoicesCreated: number, affiliatesProcessed: number, ... }
 * - 401: { success: false, error: 'Unauthorized' }
 * - 500: { success: false, error: string }
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  // Verify cron authentication
  if (!verifyCronSecret(request)) {
    logger.warn('[CronAffiliatePayables] Unauthorized cron request', {
      ip: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    logger.info('[CronAffiliatePayables] Starting monthly affiliate payable generation');

    // Get system admin ID for creating invoices
    const adminId = await getSystemAdminId();
    if (!adminId) {
      logger.error('[CronAffiliatePayables] No admin user found for invoice creation');
      return NextResponse.json(
        { success: false, error: 'No admin user found for invoice creation' },
        { status: 500 }
      );
    }

    const { start: periodStart, end: periodEnd } = getPreviousMonthRange();

    logger.info('[CronAffiliatePayables] Processing period', {
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
    });

    // Find all active affiliates with APPROVED commissions in the period
    // that are not yet on a PAYABLE invoice
    const affiliatesWithCommissions = await prisma.affiliate.findMany({
      where: {
        status: 'ACTIVE',
        commissions: {
          some: {
            status: 'APPROVED',
            approvedAt: {
              gte: periodStart,
              lte: periodEnd,
            },
            // Not already on a non-cancelled PAYABLE invoice
            lead: {
              invoiceLineItems: {
                none: {
                  invoice: {
                    type: 'PAYABLE',
                    affiliateId: { not: null },
                    status: { not: 'CANCELLED' },
                  },
                },
              },
            },
          },
        },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        companyName: true,
      },
    });

    let invoicesCreated = 0;
    let commissionsIncluded = 0;
    const errors: string[] = [];

    // Process each affiliate
    for (const affiliate of affiliatesWithCommissions) {
      try {
        // Get approved commissions for this affiliate in the period
        const commissions = await prisma.affiliateCommission.findMany({
          where: {
            affiliateId: affiliate.id,
            status: 'APPROVED',
            approvedAt: {
              gte: periodStart,
              lte: periodEnd,
            },
            // Not already on a PAYABLE invoice line item
            lead: {
              invoiceLineItems: {
                none: {
                  invoice: {
                    type: 'PAYABLE',
                    affiliateId: affiliate.id,
                    status: { not: 'CANCELLED' },
                  },
                },
              },
            },
          },
          include: {
            lead: {
              select: {
                id: true,
                zipCode: true,
                createdAt: true,
                winningBid: true,
                serviceType: {
                  select: {
                    name: true,
                    displayName: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        });

        if (commissions.length === 0) {
          continue; // No commissions to invoice
        }

        // Build line items from commissions
        const lineItems: LineItemInput[] = commissions.map((commission) => {
          const serviceType =
            commission.lead.serviceType?.displayName ||
            commission.lead.serviceType?.name ||
            'Lead';
          const leadDate = commission.lead.createdAt.toLocaleDateString();

          return {
            leadId: commission.leadId,
            description: `Commission: ${serviceType} lead (${commission.lead.zipCode}) - ${leadDate}`,
            quantity: 1,
            unitPrice: roundCurrency(toDecimal(commission.amount)).toNumber(),
            itemType: 'COMMISSION',
            metadata: {
              commissionId: commission.id,
              leadWinningBid: commission.lead.winningBid?.toString(),
              commissionRate: commission.rate.toString(),
              serviceType: commission.lead.serviceType?.name,
            },
          };
        });

        // Create the PAYABLE invoice
        const result = await createInvoice(
          {
            type: 'PAYABLE',
            affiliateId: affiliate.id,
            periodStart,
            periodEnd,
            paymentTermsDays: 30, // Net 30
            notes: `Auto-generated monthly affiliate payable for ${periodStart.toLocaleString('default', { month: 'long', year: 'numeric' })}`,
            lineItems,
          },
          adminId
        );

        if (result.success) {
          invoicesCreated++;
          commissionsIncluded += commissions.length;

          logger.info('[CronAffiliatePayables] Created payable invoice', {
            invoiceId: result.invoice?.id,
            invoiceNumber: result.invoice?.invoiceNumber,
            affiliateId: affiliate.id,
            affiliateName: `${affiliate.firstName} ${affiliate.lastName}`,
            commissionCount: commissions.length,
            total: result.invoice?.total.toString(),
          });
        } else {
          errors.push(
            `Failed to create invoice for affiliate ${affiliate.id}: ${result.error}`
          );
          logger.error('[CronAffiliatePayables] Failed to create invoice', {
            affiliateId: affiliate.id,
            error: result.error,
          });
        }
      } catch (affiliateError) {
        const errorMessage = (affiliateError as Error).message;
        errors.push(`Error processing affiliate ${affiliate.id}: ${errorMessage}`);
        logger.error('[CronAffiliatePayables] Error processing affiliate', {
          affiliateId: affiliate.id,
          error: errorMessage,
        });
      }
    }

    const duration = Date.now() - startTime;

    logger.info('[CronAffiliatePayables] Completed affiliate payable generation', {
      affiliatesProcessed: affiliatesWithCommissions.length,
      invoicesCreated,
      commissionsIncluded,
      errorsCount: errors.length,
      durationMs: duration,
    });

    return NextResponse.json({
      success: errors.length === 0,
      affiliatesProcessed: affiliatesWithCommissions.length,
      invoicesCreated,
      commissionsIncluded,
      period: {
        start: periodStart.toISOString(),
        end: periodEnd.toISOString(),
      },
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
      durationMs: duration,
    });
  } catch (error) {
    const errorMessage = (error as Error).message;

    logger.error('[CronAffiliatePayables] Failed to generate affiliate payables', {
      error: errorMessage,
      durationMs: Date.now() - startTime,
    });

    captureApiError(error, {
      route: '/api/cron/affiliate-payables',
      action: 'GET',
      extra: { cronJob: 'affiliate-payables' },
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate affiliate payables',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
