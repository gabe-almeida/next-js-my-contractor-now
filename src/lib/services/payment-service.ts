/**
 * Payment Service
 *
 * WHY: Handles recording payments against invoices with proper concurrency control.
 *      Prevents overpayment and race conditions when multiple admins record payments.
 *
 * WHEN: Use this service when:
 *       - Recording a payment received from a buyer
 *       - Recording a payment made to an affiliate
 *       - Viewing payment history for an invoice
 *
 * HOW: Call recordPayment() with invoice ID, amount, and payment details.
 *      Uses optimistic locking via version field to prevent concurrent updates.
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { PaymentMethod, InvoiceStatus, Prisma } from '@prisma/client';
import Decimal from 'decimal.js';
import { toDecimal, roundCurrency } from '@/lib/utils/decimal-helpers';

/** Type alias for Decimal instance */
type DecimalType = InstanceType<typeof Decimal>;

/** Payment input data */
export interface PaymentData {
  paymentDate: Date;
  paymentMethod: PaymentMethod;
  referenceNumber?: string;
  bankAccount?: string;
  notes?: string;
}

/** Result of payment recording */
export interface PaymentResult {
  success: boolean;
  payment?: {
    id: string;
    amount: DecimalType;
    paymentDate: Date;
    paymentMethod: PaymentMethod;
  };
  invoice?: {
    id: string;
    invoiceNumber: string;
    status: InvoiceStatus;
    balance: DecimalType;
    amountPaid: DecimalType;
  };
  error?: string;
}

/**
 * Records a payment against an invoice
 *
 * Handles partial and full payments with optimistic locking to prevent
 * race conditions. Automatically updates invoice status based on balance.
 *
 * @param invoiceId - Invoice to record payment against
 * @param amount - Payment amount (must be positive, not exceed balance)
 * @param adminId - Admin recording the payment
 * @param data - Payment details (method, date, reference)
 * @returns Result with payment record and updated invoice
 *
 * @example
 * const result = await recordPayment(
 *   'invoice-123',
 *   new Decimal(500),
 *   'admin-456',
 *   {
 *     paymentDate: new Date(),
 *     paymentMethod: 'ACH',
 *     referenceNumber: 'ACH-789'
 *   }
 * );
 */
export async function recordPayment(
  invoiceId: string,
  amount: DecimalType | number | string,
  adminId: string,
  data: PaymentData
): Promise<PaymentResult> {
  const paymentAmount = roundCurrency(toDecimal(amount));

  // Validate amount is positive
  if (paymentAmount.lessThanOrEqualTo(0)) {
    return { success: false, error: 'Payment amount must be greater than 0' };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Get current invoice with lock
      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        select: {
          id: true,
          invoiceNumber: true,
          balance: true,
          amountPaid: true,
          total: true,
          status: true,
          version: true,
        },
      });

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      // Validate invoice status allows payment
      const invalidStatuses: InvoiceStatus[] = ['DRAFT', 'CANCELLED', 'PAID'];
      if (invalidStatuses.includes(invoice.status)) {
        throw new Error(`Cannot record payment for invoice with status ${invoice.status}`);
      }

      const currentBalance = toDecimal(invoice.balance);
      const currentAmountPaid = toDecimal(invoice.amountPaid);

      // Validate payment doesn't exceed balance
      if (paymentAmount.greaterThan(currentBalance)) {
        throw new Error(
          `Payment amount ($${paymentAmount.toFixed(2)}) exceeds invoice balance ($${currentBalance.toFixed(2)})`
        );
      }

      // Calculate new values
      const newBalance = roundCurrency(currentBalance.minus(paymentAmount));
      const newAmountPaid = roundCurrency(currentAmountPaid.plus(paymentAmount));

      // Determine new status
      let newStatus: InvoiceStatus;
      if (newBalance.isZero()) {
        newStatus = 'PAID';
      } else if (invoice.status === 'OVERDUE') {
        // Stay overdue if was overdue and still has balance
        newStatus = 'OVERDUE';
      } else {
        newStatus = 'PARTIALLY_PAID';
      }

      // Update invoice with optimistic lock check
      const updated = await tx.invoice.updateMany({
        where: {
          id: invoiceId,
          version: invoice.version, // Optimistic lock
        },
        data: {
          amountPaid: newAmountPaid.toNumber(),
          balance: newBalance.toNumber(),
          status: newStatus,
          paidInFullAt: newStatus === 'PAID' ? new Date() : null,
          version: { increment: 1 },
        },
      });

      if (updated.count === 0) {
        throw new Error(
          'Invoice was modified by another user. Please refresh and try again.'
        );
      }

      // Create payment record
      const payment = await tx.invoicePayment.create({
        data: {
          invoiceId,
          amount: paymentAmount.toNumber(),
          paymentDate: data.paymentDate,
          paymentMethod: data.paymentMethod,
          referenceNumber: data.referenceNumber,
          bankAccount: data.bankAccount,
          notes: data.notes,
          recordedById: adminId,
        },
      });

      // Record status change if status changed
      if (invoice.status !== newStatus) {
        await tx.invoiceStatusHistory.create({
          data: {
            invoiceId,
            oldStatus: invoice.status,
            newStatus,
            reason: `Payment of $${paymentAmount.toFixed(2)} recorded`,
            changedById: adminId,
            changeSource: 'ADMIN',
          },
        });
      }

      // Fetch updated invoice for response
      const updatedInvoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          balance: true,
          amountPaid: true,
        },
      });

      return { payment, updatedInvoice };
    });

    logger.info('Payment recorded', {
      invoiceId,
      invoiceNumber: result.updatedInvoice?.invoiceNumber,
      paymentId: result.payment.id,
      amount: paymentAmount.toString(),
      newStatus: result.updatedInvoice?.status,
      adminId,
    });

    return {
      success: true,
      payment: {
        id: result.payment.id,
        amount: paymentAmount,
        paymentDate: result.payment.paymentDate,
        paymentMethod: result.payment.paymentMethod,
      },
      invoice: result.updatedInvoice
        ? {
            id: result.updatedInvoice.id,
            invoiceNumber: result.updatedInvoice.invoiceNumber,
            status: result.updatedInvoice.status,
            balance: toDecimal(result.updatedInvoice.balance),
            amountPaid: toDecimal(result.updatedInvoice.amountPaid),
          }
        : undefined,
    };
  } catch (error) {
    logger.error('Failed to record payment', {
      invoiceId,
      amount: paymentAmount.toString(),
      error: (error as Error).message,
    });

    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Gets all payments for an invoice
 *
 * @param invoiceId - Invoice ID
 * @returns Array of payment records with admin info
 */
export async function getInvoicePayments(invoiceId: string) {
  return prisma.invoicePayment.findMany({
    where: { invoiceId },
    include: {
      recordedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: { paymentDate: 'desc' },
  });
}

/**
 * Gets payment summary statistics for an invoice
 *
 * @param invoiceId - Invoice ID
 * @returns Payment summary
 */
export async function getPaymentSummary(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      invoiceNumber: true,
      total: true,
      amountPaid: true,
      balance: true,
      status: true,
      payments: {
        select: {
          id: true,
          amount: true,
          paymentDate: true,
          paymentMethod: true,
        },
      },
    },
  });

  if (!invoice) {
    return null;
  }

  return {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    total: toDecimal(invoice.total),
    amountPaid: toDecimal(invoice.amountPaid),
    balance: toDecimal(invoice.balance),
    status: invoice.status,
    paymentCount: invoice.payments.length,
    payments: invoice.payments.map((p) => ({
      id: p.id,
      amount: toDecimal(p.amount),
      paymentDate: p.paymentDate,
      paymentMethod: p.paymentMethod,
    })),
  };
}

/**
 * Validates payment method is valid
 *
 * @param method - Payment method string to validate
 * @returns true if valid PaymentMethod
 */
export function isValidPaymentMethod(method: string): method is PaymentMethod {
  return ['WIRE', 'ACH', 'CHECK', 'PAYPAL', 'CREDIT_CARD', 'OTHER'].includes(method);
}
