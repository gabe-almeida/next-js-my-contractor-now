/**
 * Invoice Service
 *
 * WHY: Centralizes all invoice CRUD operations with proper validation.
 *      Ensures data integrity (polymorphic constraint) and prevents double-invoicing.
 *
 * WHEN: Use this service for:
 *       - Creating new invoices (buyer or affiliate)
 *       - Updating draft invoices
 *       - Adding/removing line items
 *       - Fetching invoice data with related entities
 *
 * HOW: Import and call the appropriate method. All methods enforce the
 *      polymorphic constraint (exactly ONE of buyerId OR affiliateId).
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { InvoiceType, InvoiceStatus, Prisma, type InvoiceLineItem } from '@prisma/client';
import Decimal from 'decimal.js';
import { toDecimal, roundCurrency, sumBids } from '@/lib/utils/decimal-helpers';
import { getNextInvoiceNumber } from './invoice-number-service';

/** Type alias for Decimal instance */
type DecimalType = InstanceType<typeof Decimal>;

/** Prisma JSON input type */
type JsonInput = Prisma.InputJsonValue | undefined;

/** Line item input for creating invoices */
export interface LineItemInput {
  leadId?: string;
  callId?: string;
  description: string;
  quantity?: number;
  unitPrice: number | DecimalType;
  itemType?: string;
  metadata?: Record<string, unknown>;
}

/** Invoice creation input */
export interface CreateInvoiceInput {
  type: InvoiceType;
  buyerId?: string;
  affiliateId?: string;
  periodStart: Date;
  periodEnd: Date;
  paymentTermsDays?: number;
  notes?: string;
  buyerNotes?: string;
  lineItems: LineItemInput[];
}

/** Invoice update input (draft only) */
export interface UpdateInvoiceInput {
  notes?: string;
  buyerNotes?: string;
  paymentTermsDays?: number;
  adjustments?: number | DecimalType;
}

/** Result type for invoice operations */
export interface InvoiceResult {
  success: boolean;
  invoice?: {
    id: string;
    invoiceNumber: string;
    type: InvoiceType;
    status: InvoiceStatus;
    total: DecimalType;
    balance: DecimalType;
  };
  error?: string;
}

/**
 * Validates the polymorphic constraint: exactly ONE of buyerId OR affiliateId
 *
 * @param buyerId - Buyer ID (for RECEIVABLE invoices)
 * @param affiliateId - Affiliate ID (for PAYABLE invoices)
 * @param type - Invoice type
 * @returns Error message if invalid, null if valid
 */
function validatePolymorphicConstraint(
  buyerId: string | undefined | null,
  affiliateId: string | undefined | null,
  type: InvoiceType
): string | null {
  const hasBuyer = !!buyerId;
  const hasAffiliate = !!affiliateId;

  if (hasBuyer && hasAffiliate) {
    return 'Invoice cannot have both buyerId and affiliateId';
  }

  if (!hasBuyer && !hasAffiliate) {
    return 'Invoice must have either buyerId or affiliateId';
  }

  if (type === 'RECEIVABLE' && !hasBuyer) {
    return 'RECEIVABLE invoice must have buyerId';
  }

  if (type === 'PAYABLE' && !hasAffiliate) {
    return 'PAYABLE invoice must have affiliateId';
  }

  return null;
}

/**
 * Calculates invoice totals from line items
 *
 * @param lineItems - Array of line items
 * @param adjustments - Additional adjustments (credits/debits)
 * @returns Calculated totals
 */
function calculateTotals(
  lineItems: { amount: number | DecimalType }[],
  adjustments: number | DecimalType = 0
) {
  const subtotal = roundCurrency(
    sumBids(lineItems.map((item) => toDecimal(item.amount)))
  );
  const adjustmentAmount = roundCurrency(toDecimal(adjustments));
  const total = roundCurrency(subtotal.plus(adjustmentAmount));

  return {
    subtotal,
    adjustments: adjustmentAmount,
    total,
    balance: total, // Balance equals total for new invoices
  };
}

/**
 * Creates a new invoice
 *
 * Validates polymorphic constraint and generates unique invoice number.
 * Line items can include leads, calls, or manual entries.
 *
 * @param input - Invoice creation data
 * @param adminId - Admin creating the invoice
 * @returns Result with created invoice or error
 */
export async function createInvoice(
  input: CreateInvoiceInput,
  adminId: string
): Promise<InvoiceResult> {
  // Validate polymorphic constraint
  const constraintError = validatePolymorphicConstraint(
    input.buyerId,
    input.affiliateId,
    input.type
  );
  if (constraintError) {
    return { success: false, error: constraintError };
  }

  // Validate line items
  if (!input.lineItems || input.lineItems.length === 0) {
    return { success: false, error: 'Invoice must have at least one line item' };
  }

  try {
    // Check for double-invoicing
    const leadIds = input.lineItems
      .filter((item) => item.leadId)
      .map((item) => item.leadId as string);

    if (leadIds.length > 0) {
      const existingItems = await prisma.invoiceLineItem.findMany({
        where: {
          leadId: { in: leadIds },
          invoice: { status: { not: 'CANCELLED' } },
        },
        include: { invoice: { select: { invoiceNumber: true } } },
      });

      if (existingItems.length > 0) {
        const conflicts = existingItems.map(
          (i) => `Lead ${i.leadId} already on invoice ${i.invoice.invoiceNumber}`
        );
        return {
          success: false,
          error: `Leads already invoiced: ${conflicts.join(', ')}`,
        };
      }
    }

    // Generate invoice number
    const invoiceNumber = await getNextInvoiceNumber(input.type);

    // Prepare line items with calculated amounts
    const preparedLineItems = input.lineItems.map((item) => {
      const quantity = item.quantity || 1;
      const unitPrice = roundCurrency(toDecimal(item.unitPrice));
      const amount = roundCurrency(unitPrice.times(quantity));

      return {
        leadId: item.leadId,
        callId: item.callId,
        description: item.description,
        quantity,
        unitPrice: unitPrice.toNumber(),
        amount: amount.toNumber(),
        itemType: item.itemType || 'LEAD',
        metadata: item.metadata as JsonInput,
      };
    });

    // Calculate totals
    const totals = calculateTotals(preparedLineItems);

    // Get payment terms from buyer if applicable
    let paymentTermsDays = input.paymentTermsDays || 30;
    if (input.buyerId && !input.paymentTermsDays) {
      const buyer = await prisma.buyer.findUnique({
        where: { id: input.buyerId },
        select: { paymentTermsDays: true },
      });
      if (buyer?.paymentTermsDays) {
        paymentTermsDays = buyer.paymentTermsDays;
      }
    }

    // Create invoice with line items in transaction
    const invoice = await prisma.$transaction(async (tx) => {
      const created = await tx.invoice.create({
        data: {
          invoiceNumber,
          type: input.type,
          buyerId: input.buyerId,
          affiliateId: input.affiliateId,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          subtotal: totals.subtotal.toNumber(),
          adjustments: totals.adjustments.toNumber(),
          taxAmount: 0,
          total: totals.total.toNumber(),
          balance: totals.balance.toNumber(),
          paymentTermsDays,
          notes: input.notes,
          buyerNotes: input.buyerNotes,
          createdById: adminId,
          lineItems: {
            create: preparedLineItems,
          },
        },
        include: {
          lineItems: true,
        },
      });

      // Record initial status in history
      await tx.invoiceStatusHistory.create({
        data: {
          invoiceId: created.id,
          oldStatus: null,
          newStatus: 'DRAFT',
          reason: 'Invoice created',
          changedById: adminId,
          changeSource: 'ADMIN',
        },
      });

      return created;
    });

    logger.info('Invoice created', {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      type: invoice.type,
      buyerId: invoice.buyerId,
      affiliateId: invoice.affiliateId,
      total: totals.total.toString(),
      lineItemCount: preparedLineItems.length,
      adminId,
    });

    return {
      success: true,
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        type: invoice.type,
        status: invoice.status,
        total: totals.total,
        balance: totals.balance,
      },
    };
  } catch (error) {
    logger.error('Failed to create invoice', {
      type: input.type,
      buyerId: input.buyerId,
      affiliateId: input.affiliateId,
      error: (error as Error).message,
    });

    return {
      success: false,
      error: `Failed to create invoice: ${(error as Error).message}`,
    };
  }
}

/**
 * Updates a draft invoice
 *
 * Only DRAFT invoices can be updated. For sent invoices, create adjustments.
 *
 * @param invoiceId - Invoice to update
 * @param input - Update data
 * @param adminId - Admin performing update
 * @returns Result with updated invoice or error
 */
export async function updateInvoice(
  invoiceId: string,
  input: UpdateInvoiceInput,
  adminId: string
): Promise<InvoiceResult> {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { lineItems: true },
    });

    if (!invoice) {
      return { success: false, error: 'Invoice not found' };
    }

    if (invoice.status !== 'DRAFT') {
      return {
        success: false,
        error: `Cannot update invoice with status ${invoice.status}. Only DRAFT invoices can be edited.`,
      };
    }

    // Recalculate totals if adjustments changed
    let updateData: Prisma.InvoiceUpdateInput = {};

    if (input.adjustments !== undefined) {
      const totals = calculateTotals(
        invoice.lineItems.map((li) => ({ amount: toDecimal(li.amount) })),
        input.adjustments
      );
      updateData = {
        ...updateData,
        adjustments: totals.adjustments.toNumber(),
        total: totals.total.toNumber(),
        balance: totals.balance.toNumber(),
      };
    }

    if (input.notes !== undefined) {
      updateData.notes = input.notes;
    }

    if (input.buyerNotes !== undefined) {
      updateData.buyerNotes = input.buyerNotes;
    }

    if (input.paymentTermsDays !== undefined) {
      updateData.paymentTermsDays = input.paymentTermsDays;
    }

    const updated = await prisma.invoice.update({
      where: { id: invoiceId },
      data: updateData,
    });

    logger.info('Invoice updated', {
      invoiceId,
      invoiceNumber: updated.invoiceNumber,
      adminId,
    });

    return {
      success: true,
      invoice: {
        id: updated.id,
        invoiceNumber: updated.invoiceNumber,
        type: updated.type,
        status: updated.status,
        total: toDecimal(updated.total),
        balance: toDecimal(updated.balance),
      },
    };
  } catch (error) {
    logger.error('Failed to update invoice', {
      invoiceId,
      error: (error as Error).message,
    });

    return {
      success: false,
      error: `Failed to update invoice: ${(error as Error).message}`,
    };
  }
}

/**
 * Adds line items to a draft invoice
 *
 * Validates leads are not already invoiced and recalculates totals.
 *
 * @param invoiceId - Invoice to add items to
 * @param lineItems - Line items to add
 * @param adminId - Admin performing action
 * @returns Result with updated invoice or error
 */
export async function addLineItems(
  invoiceId: string,
  lineItems: LineItemInput[],
  adminId: string
): Promise<InvoiceResult> {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { lineItems: true },
    });

    if (!invoice) {
      return { success: false, error: 'Invoice not found' };
    }

    if (invoice.status !== 'DRAFT') {
      return {
        success: false,
        error: 'Can only add line items to DRAFT invoices',
      };
    }

    // Check for double-invoicing
    const leadIds = lineItems
      .filter((item) => item.leadId)
      .map((item) => item.leadId as string);

    if (leadIds.length > 0) {
      const existingItems = await prisma.invoiceLineItem.findMany({
        where: {
          leadId: { in: leadIds },
          invoice: { status: { not: 'CANCELLED' } },
        },
        include: { invoice: { select: { invoiceNumber: true } } },
      });

      if (existingItems.length > 0) {
        const conflicts = existingItems.map(
          (i) => `Lead ${i.leadId} already on invoice ${i.invoice.invoiceNumber}`
        );
        return {
          success: false,
          error: `Leads already invoiced: ${conflicts.join(', ')}`,
        };
      }
    }

    // Prepare new line items
    const preparedLineItems = lineItems.map((item) => {
      const quantity = item.quantity || 1;
      const unitPrice = roundCurrency(toDecimal(item.unitPrice));
      const amount = roundCurrency(unitPrice.times(quantity));

      return {
        invoiceId,
        leadId: item.leadId,
        callId: item.callId,
        description: item.description,
        quantity,
        unitPrice: unitPrice.toNumber(),
        amount: amount.toNumber(),
        itemType: item.itemType || 'LEAD',
        metadata: item.metadata as JsonInput,
      };
    });

    // Add line items and recalculate totals
    await prisma.$transaction(async (tx) => {
      await tx.invoiceLineItem.createMany({
        data: preparedLineItems,
      });

      // Get all line items and recalculate
      const allLineItems = await tx.invoiceLineItem.findMany({
        where: { invoiceId },
      });

      const totals = calculateTotals(
        allLineItems.map((li) => ({ amount: toDecimal(li.amount) })),
        toDecimal(invoice.adjustments)
      );

      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          subtotal: totals.subtotal.toNumber(),
          total: totals.total.toNumber(),
          balance: totals.balance.toNumber(),
        },
      });
    });

    const updated = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    logger.info('Line items added to invoice', {
      invoiceId,
      invoiceNumber: updated?.invoiceNumber,
      addedCount: preparedLineItems.length,
      adminId,
    });

    return {
      success: true,
      invoice: updated
        ? {
            id: updated.id,
            invoiceNumber: updated.invoiceNumber,
            type: updated.type,
            status: updated.status,
            total: toDecimal(updated.total),
            balance: toDecimal(updated.balance),
          }
        : undefined,
    };
  } catch (error) {
    logger.error('Failed to add line items', {
      invoiceId,
      error: (error as Error).message,
    });

    return {
      success: false,
      error: `Failed to add line items: ${(error as Error).message}`,
    };
  }
}

/**
 * Removes a line item from a draft invoice
 *
 * @param invoiceId - Invoice to remove item from
 * @param lineItemId - Line item to remove
 * @param adminId - Admin performing action
 * @returns Result with updated invoice or error
 */
export async function removeLineItem(
  invoiceId: string,
  lineItemId: string,
  adminId: string
): Promise<InvoiceResult> {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { lineItems: true },
    });

    if (!invoice) {
      return { success: false, error: 'Invoice not found' };
    }

    if (invoice.status !== 'DRAFT') {
      return {
        success: false,
        error: 'Can only remove line items from DRAFT invoices',
      };
    }

    const lineItem = invoice.lineItems.find((li) => li.id === lineItemId);
    if (!lineItem) {
      return { success: false, error: 'Line item not found on this invoice' };
    }

    // Must have at least one line item
    if (invoice.lineItems.length <= 1) {
      return {
        success: false,
        error: 'Invoice must have at least one line item',
      };
    }

    // Remove line item and recalculate
    await prisma.$transaction(async (tx) => {
      await tx.invoiceLineItem.delete({
        where: { id: lineItemId },
      });

      const remainingItems = await tx.invoiceLineItem.findMany({
        where: { invoiceId },
      });

      const totals = calculateTotals(
        remainingItems.map((li) => ({ amount: toDecimal(li.amount) })),
        toDecimal(invoice.adjustments)
      );

      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          subtotal: totals.subtotal.toNumber(),
          total: totals.total.toNumber(),
          balance: totals.balance.toNumber(),
        },
      });
    });

    const updated = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    logger.info('Line item removed from invoice', {
      invoiceId,
      invoiceNumber: updated?.invoiceNumber,
      lineItemId,
      adminId,
    });

    return {
      success: true,
      invoice: updated
        ? {
            id: updated.id,
            invoiceNumber: updated.invoiceNumber,
            type: updated.type,
            status: updated.status,
            total: toDecimal(updated.total),
            balance: toDecimal(updated.balance),
          }
        : undefined,
    };
  } catch (error) {
    logger.error('Failed to remove line item', {
      invoiceId,
      lineItemId,
      error: (error as Error).message,
    });

    return {
      success: false,
      error: `Failed to remove line item: ${(error as Error).message}`,
    };
  }
}

/**
 * Gets an invoice with full details
 *
 * @param invoiceId - Invoice ID
 * @returns Invoice with line items, payments, and history
 */
export async function getInvoice(invoiceId: string) {
  return prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      buyer: {
        select: {
          id: true,
          name: true,
          displayName: true,
          billingEmail: true,
          billingAddress: true,
        },
      },
      affiliate: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          companyName: true,
        },
      },
      lineItems: {
        include: {
          lead: {
            select: {
              id: true,
              zipCode: true,
              createdAt: true,
              serviceType: { select: { name: true, displayName: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
      payments: {
        include: {
          recordedBy: {
            select: { id: true, name: true },
          },
        },
        orderBy: { paymentDate: 'desc' },
      },
      statusHistory: {
        include: {
          changedBy: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
      createdBy: {
        select: { id: true, name: true, email: true },
      },
    },
  });
}

/**
 * Gets invoices with filtering and pagination
 *
 * @param options - Filter and pagination options
 * @returns Paginated invoice list
 */
export async function getInvoices(options: {
  type?: InvoiceType;
  status?: InvoiceStatus | InvoiceStatus[];
  buyerId?: string;
  affiliateId?: string;
  periodStart?: Date;
  periodEnd?: Date;
  page?: number;
  pageSize?: number;
}) {
  const {
    type,
    status,
    buyerId,
    affiliateId,
    periodStart,
    periodEnd,
    page = 1,
    pageSize = 20,
  } = options;

  const where: Prisma.InvoiceWhereInput = {};

  if (type) where.type = type;
  if (status) {
    where.status = Array.isArray(status) ? { in: status } : status;
  }
  if (buyerId) where.buyerId = buyerId;
  if (affiliateId) where.affiliateId = affiliateId;
  if (periodStart) where.periodStart = { gte: periodStart };
  if (periodEnd) where.periodEnd = { lte: periodEnd };

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: {
        buyer: { select: { id: true, name: true, displayName: true } },
        affiliate: {
          select: { id: true, firstName: true, lastName: true, companyName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.invoice.count({ where }),
  ]);

  return {
    invoices,
    pagination: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

/**
 * Gets uninvoiced leads for a buyer within a date range
 *
 * @param buyerId - Buyer ID
 * @param periodStart - Start of billing period
 * @param periodEnd - End of billing period
 * @returns Array of uninvoiced leads with details
 */
export async function getUninvoicedLeads(
  buyerId: string,
  periodStart: Date,
  periodEnd: Date
) {
  return prisma.lead.findMany({
    where: {
      winningBuyerId: buyerId,
      status: 'SOLD',
      createdAt: {
        gte: periodStart,
        lte: periodEnd,
      },
      // Not already on a non-cancelled invoice
      invoiceLineItems: {
        none: {
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
    },
    orderBy: { createdAt: 'asc' },
  });
}
