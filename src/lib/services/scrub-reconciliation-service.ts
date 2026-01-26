/**
 * Scrub Reconciliation Service
 *
 * WHY: Handles buyer scrub reconciliation when leads are returned/rejected after invoicing.
 *      Networks like Modernize scrub ~10% of leads at reconciliation time.
 *
 * WHEN: Use this service when:
 *       - A buyer reports scrubbed/invalid leads
 *       - Processing bulk scrub reports (CSV upload)
 *       - Checking actual vs expected scrub rates
 *
 * HOW: Admin uploads scrubbed lead IDs, service validates them and:
 *      1. Updates lead disposition to CREDITED
 *      2. Records status history for audit trail
 *      3. Queues credits for next invoice
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import Decimal from 'decimal.js';
import { toDecimal, roundCurrency, sumBids } from '@/lib/utils/decimal-helpers';

/** Type alias for Decimal instance */
type DecimalType = InstanceType<typeof Decimal>;

/** Scrub result for a single lead */
export interface ScrubLeadResult {
  leadId: string;
  success: boolean;
  creditAmount?: number;
  originalInvoiceNumber?: string;
  error?: string;
}

/** Overall scrub processing result */
export interface ScrubProcessingResult {
  success: boolean;
  processed: number;
  failed: number;
  totalCredit: DecimalType;
  results: ScrubLeadResult[];
  error?: string;
}

/** Scrub rate statistics */
export interface ScrubRateStats {
  totalLeads: number;
  scrubbedLeads: number;
  actualRate: number;
  expectedRate: number;
  exceedsExpected: boolean;
  difference: number;
  totalValue: DecimalType;
  creditedValue: DecimalType;
}

/**
 * Processes buyer scrubs for a list of leads
 *
 * For each scrubbed lead:
 * 1. Validates lead belongs to buyer and was invoiced
 * 2. Updates Lead.disposition to CREDITED
 * 3. Records in lead status history
 * 4. Returns summary of credits to queue for next invoice
 *
 * @param buyerId - Buyer reporting the scrubs
 * @param scrubbedLeadIds - Array of lead IDs being scrubbed
 * @param adminId - Admin processing the scrub
 * @param reason - Reason for scrub (e.g., "invalid contact", "duplicate")
 * @returns Processing result with credit totals
 */
export async function processBuyerScrubs(
  buyerId: string,
  scrubbedLeadIds: string[],
  adminId: string,
  reason: string
): Promise<ScrubProcessingResult> {
  if (!scrubbedLeadIds || scrubbedLeadIds.length === 0) {
    return {
      success: false,
      processed: 0,
      failed: 0,
      totalCredit: new Decimal(0),
      results: [],
      error: 'No lead IDs provided',
    };
  }

  const results: ScrubLeadResult[] = [];
  let totalCredit = new Decimal(0);

  try {
    // Get leads with their invoice line items
    const leads = await prisma.lead.findMany({
      where: {
        id: { in: scrubbedLeadIds },
        winningBuyerId: buyerId,
      },
      include: {
        invoiceLineItems: {
          include: {
            invoice: {
              select: {
                id: true,
                invoiceNumber: true,
                status: true,
              },
            },
          },
        },
      },
    });

    // Build lookup for quick validation
    const leadMap = new Map(leads.map((l) => [l.id, l]));

    // Process each lead
    for (const leadId of scrubbedLeadIds) {
      const lead = leadMap.get(leadId);

      // Validate lead exists and belongs to buyer
      if (!lead) {
        results.push({
          leadId,
          success: false,
          error: 'Lead not found or does not belong to this buyer',
        });
        continue;
      }

      // Check if already credited
      if (lead.disposition === 'CREDITED') {
        results.push({
          leadId,
          success: false,
          error: 'Lead already credited',
        });
        continue;
      }

      // Check if lead was invoiced
      const invoicedItem = lead.invoiceLineItems.find(
        (li) => li.invoice.status !== 'CANCELLED'
      );

      if (!invoicedItem) {
        results.push({
          leadId,
          success: false,
          error: 'Lead has not been invoiced',
        });
        continue;
      }

      // Get credit amount (original winning bid or invoiced amount)
      const creditAmount = roundCurrency(
        toDecimal(lead.winningBid || invoicedItem.amount)
      );

      try {
        // Update lead in transaction
        await prisma.$transaction(async (tx) => {
          // Update lead disposition
          await tx.lead.update({
            where: { id: leadId },
            data: {
              disposition: 'CREDITED',
              creditAmount: creditAmount.toNumber(),
              creditIssuedAt: new Date(),
              creditIssuedById: adminId,
            },
          });

          // Record in lead status history
          await tx.leadStatusHistory.create({
            data: {
              leadId,
              adminUserId: adminId,
              oldStatus: lead.status,
              newStatus: lead.status, // Status doesn't change
              oldDisposition: lead.disposition,
              newDisposition: 'CREDITED',
              reason: `Buyer scrub: ${reason}`,
              creditAmount: creditAmount.toNumber(),
              changeSource: 'ADMIN',
            },
          });
        });

        totalCredit = totalCredit.plus(creditAmount);
        results.push({
          leadId,
          success: true,
          creditAmount: creditAmount.toNumber(),
          originalInvoiceNumber: invoicedItem.invoice.invoiceNumber,
        });
      } catch (error) {
        results.push({
          leadId,
          success: false,
          error: `Failed to process: ${(error as Error).message}`,
        });
      }
    }

    const processed = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    logger.info('Buyer scrubs processed', {
      buyerId,
      totalSubmitted: scrubbedLeadIds.length,
      processed,
      failed,
      totalCredit: totalCredit.toString(),
      adminId,
      reason,
    });

    return {
      success: true,
      processed,
      failed,
      totalCredit: roundCurrency(totalCredit),
      results,
    };
  } catch (error) {
    logger.error('Failed to process buyer scrubs', {
      buyerId,
      leadCount: scrubbedLeadIds.length,
      error: (error as Error).message,
    });

    return {
      success: false,
      processed: 0,
      failed: scrubbedLeadIds.length,
      totalCredit: new Decimal(0),
      results,
      error: `Failed to process scrubs: ${(error as Error).message}`,
    };
  }
}

/**
 * Gets scrub rate statistics for a buyer within a period
 *
 * Compares actual scrub rate against expected rate configured for buyer.
 *
 * @param buyerId - Buyer ID
 * @param periodStart - Start of period
 * @param periodEnd - End of period
 * @returns Scrub rate statistics
 */
export async function getScrubRateStats(
  buyerId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<ScrubRateStats | null> {
  const buyer = await prisma.buyer.findUnique({
    where: { id: buyerId },
    select: { expectedScrubRate: true },
  });

  if (!buyer) {
    return null;
  }

  const leads = await prisma.lead.findMany({
    where: {
      winningBuyerId: buyerId,
      createdAt: {
        gte: periodStart,
        lte: periodEnd,
      },
    },
    select: {
      id: true,
      disposition: true,
      winningBid: true,
      creditAmount: true,
    },
  });

  const totalLeads = leads.length;
  if (totalLeads === 0) {
    return {
      totalLeads: 0,
      scrubbedLeads: 0,
      actualRate: 0,
      expectedRate: buyer.expectedScrubRate?.toNumber() || 0,
      exceedsExpected: false,
      difference: 0,
      totalValue: new Decimal(0),
      creditedValue: new Decimal(0),
    };
  }

  const scrubbedLeads = leads.filter((l) => l.disposition === 'CREDITED');
  const actualRate = scrubbedLeads.length / totalLeads;
  const expectedRate = buyer.expectedScrubRate?.toNumber() || 0;

  const totalValue = roundCurrency(
    sumBids(leads.map((l) => toDecimal(l.winningBid || 0)))
  );

  const creditedValue = roundCurrency(
    sumBids(scrubbedLeads.map((l) => toDecimal(l.creditAmount || l.winningBid || 0)))
  );

  return {
    totalLeads,
    scrubbedLeads: scrubbedLeads.length,
    actualRate,
    expectedRate,
    exceedsExpected: actualRate > expectedRate,
    difference: actualRate - expectedRate,
    totalValue,
    creditedValue,
  };
}

/**
 * Gets pending credits for a buyer (credited leads not yet on a credit invoice)
 *
 * @param buyerId - Buyer ID
 * @returns Array of credited leads waiting to be invoiced
 */
export async function getPendingCredits(buyerId: string) {
  return prisma.lead.findMany({
    where: {
      winningBuyerId: buyerId,
      disposition: 'CREDITED',
      // Not already on a credit line item
      invoiceLineItems: {
        none: {
          itemType: 'SCRUB_CREDIT',
          invoice: {
            status: { not: 'CANCELLED' },
          },
        },
      },
    },
    include: {
      serviceType: {
        select: { name: true, displayName: true },
      },
      invoiceLineItems: {
        include: {
          invoice: {
            select: {
              id: true,
              invoiceNumber: true,
            },
          },
        },
        where: {
          itemType: 'LEAD',
        },
      },
    },
    orderBy: { creditIssuedAt: 'asc' },
  });
}

/**
 * Creates credit line items for scrubbed leads on the next invoice
 *
 * This is called when creating a new invoice to automatically include
 * any pending credits from scrubbed leads.
 *
 * @param buyerId - Buyer ID
 * @returns Array of line item data ready to add to invoice
 */
export async function generateCreditLineItems(buyerId: string) {
  const pendingCredits = await getPendingCredits(buyerId);

  return pendingCredits.map((lead) => {
    const originalInvoice = lead.invoiceLineItems[0]?.invoice;
    const creditAmount = roundCurrency(
      toDecimal(lead.creditAmount || lead.winningBid || 0)
    );

    return {
      leadId: lead.id,
      description: `Credit: Lead scrubbed${originalInvoice ? ` (ref: ${originalInvoice.invoiceNumber})` : ''}`,
      quantity: 1,
      unitPrice: creditAmount.negated().toNumber(), // Negative for credit
      amount: creditAmount.negated().toNumber(),
      itemType: 'SCRUB_CREDIT' as const,
      metadata: {
        originalLeadId: lead.id,
        originalInvoiceId: originalInvoice?.id,
        originalInvoiceNumber: originalInvoice?.invoiceNumber,
        creditedAt: lead.creditIssuedAt,
        serviceType: lead.serviceType?.displayName || lead.serviceType?.name,
      },
    };
  });
}

/**
 * Validates a list of lead IDs for scrubbing
 *
 * Checks that all leads:
 * - Exist
 * - Belong to the buyer
 * - Have been invoiced
 * - Are not already credited
 *
 * @param buyerId - Buyer ID
 * @param leadIds - Lead IDs to validate
 * @returns Validation results
 */
export async function validateScrubLeads(buyerId: string, leadIds: string[]) {
  const leads = await prisma.lead.findMany({
    where: { id: { in: leadIds } },
    include: {
      invoiceLineItems: {
        include: {
          invoice: {
            select: { status: true },
          },
        },
      },
    },
  });

  const results = leadIds.map((leadId) => {
    const lead = leads.find((l) => l.id === leadId);

    if (!lead) {
      return { leadId, valid: false, error: 'Lead not found' };
    }

    if (lead.winningBuyerId !== buyerId) {
      return { leadId, valid: false, error: 'Lead does not belong to this buyer' };
    }

    if (lead.disposition === 'CREDITED') {
      return { leadId, valid: false, error: 'Lead already credited' };
    }

    const hasNonCancelledInvoice = lead.invoiceLineItems.some(
      (li) => li.invoice.status !== 'CANCELLED'
    );

    if (!hasNonCancelledInvoice) {
      return { leadId, valid: false, error: 'Lead has not been invoiced' };
    }

    return {
      leadId,
      valid: true,
      winningBid: lead.winningBid?.toNumber(),
    };
  });

  return {
    valid: results.filter((r) => r.valid),
    invalid: results.filter((r) => !r.valid),
    totalValid: results.filter((r) => r.valid).length,
    totalInvalid: results.filter((r) => !r.valid).length,
  };
}
