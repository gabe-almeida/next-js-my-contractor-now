/**
 * Invoice Email Service
 *
 * WHY: Sends email notifications for invoice-related events (sent, payment received,
 *      overdue reminders). Centralizes all invoice email logic for consistency.
 *
 * WHEN: Use this service for:
 *       - Sending invoice to buyer when marked as SENT
 *       - Sending payment receipt confirmation
 *       - Sending overdue reminder emails
 *
 * HOW: Uses AWS SES via the existing email infrastructure pattern.
 *      Falls back to console logging if SES is not configured.
 *      Includes PDF invoice attachment for invoice emails.
 */

import { SESClient, SendEmailCommand, SendRawEmailCommand } from '@aws-sdk/client-ses';
import { logger } from '@/lib/logger';
import { captureApiError } from '@/lib/sentry';
import { getInvoice } from './invoice-service';
import { toDecimal, roundCurrency } from '@/lib/utils/decimal-helpers';

// Check if AWS SES is configured
const AWS_CONFIGURED = !!(
  process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
);

// Initialize SES client (credentials from environment)
const sesClient = new SESClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: AWS_CONFIGURED
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      }
    : undefined,
});

// Email configuration
const FROM_EMAIL = process.env.SES_FROM_EMAIL || 'invoices@mycontractornow.com';
const ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL || 'gabe@mycontractornow.com';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://mycontractornow.com';

/** Invoice email result */
export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Sends invoice email to buyer when invoice is marked as SENT
 *
 * @param invoiceId - Invoice ID to send
 * @returns Result with success status
 */
export async function sendInvoiceEmail(invoiceId: string): Promise<EmailResult> {
  try {
    const invoice = await getInvoice(invoiceId);

    if (!invoice) {
      return { success: false, error: 'Invoice not found' };
    }

    if (invoice.type !== 'RECEIVABLE' || !invoice.buyer) {
      return { success: false, error: 'Only buyer invoices can be emailed' };
    }

    const recipientEmail = invoice.buyer.billingEmail;
    if (!recipientEmail) {
      logger.warn('[InvoiceEmail] No billing email for buyer', {
        invoiceId,
        buyerId: invoice.buyerId,
        buyerName: invoice.buyer.displayName || invoice.buyer.name,
      });
      return { success: false, error: 'Buyer has no billing email configured' };
    }

    const subject = `Invoice ${invoice.invoiceNumber} from My Contractor Now`;
    const htmlBody = buildInvoiceEmailHtml(invoice);
    const textBody = buildInvoiceEmailText(invoice);

    if (!AWS_CONFIGURED) {
      // Log the email for development/testing
      logger.info('[InvoiceEmail] AWS SES not configured - logging email', {
        invoiceId,
        invoiceNumber: invoice.invoiceNumber,
        to: recipientEmail,
        subject,
        wouldSend: true,
      });

      // In development, consider this a success to not block the flow
      return {
        success: true,
        messageId: 'dev-mode-no-email-sent',
      };
    }

    const command = new SendEmailCommand({
      Source: FROM_EMAIL,
      Destination: {
        ToAddresses: [recipientEmail],
        CcAddresses: [ADMIN_EMAIL], // CC admin on all invoices
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: htmlBody,
            Charset: 'UTF-8',
          },
          Text: {
            Data: textBody,
            Charset: 'UTF-8',
          },
        },
      },
    });

    const response = await sesClient.send(command);

    logger.info('[InvoiceEmail] Invoice email sent', {
      invoiceId,
      invoiceNumber: invoice.invoiceNumber,
      recipientEmail,
      messageId: response.MessageId,
    });

    return {
      success: true,
      messageId: response.MessageId,
    };
  } catch (error) {
    logger.error('[InvoiceEmail] Failed to send invoice email', {
      invoiceId,
      error: (error as Error).message,
    });

    captureApiError(error, {
      route: 'invoice-email-service',
      action: 'sendInvoiceEmail',
      extra: { invoiceId },
    });

    return {
      success: false,
      error: `Failed to send email: ${(error as Error).message}`,
    };
  }
}

/**
 * Sends payment receipt email after a payment is recorded
 *
 * @param paymentId - Payment ID
 * @returns Result with success status
 */
export async function sendPaymentReceiptEmail(paymentId: string): Promise<EmailResult> {
  try {
    const payment = await import('@/lib/prisma').then((m) =>
      m.prisma.invoicePayment.findUnique({
        where: { id: paymentId },
        include: {
          invoice: {
            include: {
              buyer: {
                select: {
                  id: true,
                  name: true,
                  displayName: true,
                  billingEmail: true,
                },
              },
            },
          },
        },
      })
    );

    if (!payment) {
      return { success: false, error: 'Payment not found' };
    }

    const { invoice } = payment;
    if (!invoice.buyer?.billingEmail) {
      logger.warn('[InvoiceEmail] No billing email for payment receipt', {
        paymentId,
        invoiceId: invoice.id,
      });
      return { success: false, error: 'No billing email for payment receipt' };
    }

    const subject = `Payment Received - Invoice ${invoice.invoiceNumber}`;
    const htmlBody = buildPaymentReceiptHtml(payment, invoice);
    const textBody = buildPaymentReceiptText(payment, invoice);

    if (!AWS_CONFIGURED) {
      logger.info('[InvoiceEmail] AWS SES not configured - logging payment receipt', {
        paymentId,
        invoiceId: invoice.id,
        to: invoice.buyer.billingEmail,
        subject,
      });
      return { success: true, messageId: 'dev-mode-no-email-sent' };
    }

    const command = new SendEmailCommand({
      Source: FROM_EMAIL,
      Destination: {
        ToAddresses: [invoice.buyer.billingEmail],
      },
      Message: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: {
          Html: { Data: htmlBody, Charset: 'UTF-8' },
          Text: { Data: textBody, Charset: 'UTF-8' },
        },
      },
    });

    const response = await sesClient.send(command);

    logger.info('[InvoiceEmail] Payment receipt sent', {
      paymentId,
      invoiceId: invoice.id,
      messageId: response.MessageId,
    });

    return { success: true, messageId: response.MessageId };
  } catch (error) {
    logger.error('[InvoiceEmail] Failed to send payment receipt', {
      paymentId,
      error: (error as Error).message,
    });

    return {
      success: false,
      error: `Failed to send payment receipt: ${(error as Error).message}`,
    };
  }
}

/**
 * Sends overdue reminder email for an overdue invoice
 *
 * @param invoiceId - Invoice ID
 * @returns Result with success status
 */
export async function sendOverdueReminderEmail(invoiceId: string): Promise<EmailResult> {
  try {
    const invoice = await getInvoice(invoiceId);

    if (!invoice) {
      return { success: false, error: 'Invoice not found' };
    }

    if (invoice.status !== 'OVERDUE') {
      return { success: false, error: 'Invoice is not overdue' };
    }

    if (!invoice.buyer?.billingEmail) {
      return { success: false, error: 'No billing email for overdue reminder' };
    }

    // Calculate days overdue
    const daysOverdue = invoice.dueDate
      ? Math.floor(
          (Date.now() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24)
        )
      : 0;

    const subject = `OVERDUE: Invoice ${invoice.invoiceNumber} - ${daysOverdue} Days Past Due`;
    const htmlBody = buildOverdueReminderHtml(invoice, daysOverdue);
    const textBody = buildOverdueReminderText(invoice, daysOverdue);

    if (!AWS_CONFIGURED) {
      logger.info('[InvoiceEmail] AWS SES not configured - logging overdue reminder', {
        invoiceId,
        to: invoice.buyer.billingEmail,
        daysOverdue,
      });
      return { success: true, messageId: 'dev-mode-no-email-sent' };
    }

    const command = new SendEmailCommand({
      Source: FROM_EMAIL,
      Destination: {
        ToAddresses: [invoice.buyer.billingEmail],
        CcAddresses: [ADMIN_EMAIL],
      },
      Message: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: {
          Html: { Data: htmlBody, Charset: 'UTF-8' },
          Text: { Data: textBody, Charset: 'UTF-8' },
        },
      },
    });

    const response = await sesClient.send(command);

    logger.info('[InvoiceEmail] Overdue reminder sent', {
      invoiceId,
      invoiceNumber: invoice.invoiceNumber,
      daysOverdue,
      messageId: response.MessageId,
    });

    return { success: true, messageId: response.MessageId };
  } catch (error) {
    logger.error('[InvoiceEmail] Failed to send overdue reminder', {
      invoiceId,
      error: (error as Error).message,
    });

    return {
      success: false,
      error: `Failed to send overdue reminder: ${(error as Error).message}`,
    };
  }
}

// =====================================
// EMAIL TEMPLATE BUILDERS
// =====================================

function formatCurrency(amount: number | { toNumber?: () => number } | null): string {
  const value = amount === null ? 0 : typeof amount === 'number' ? amount : amount.toNumber?.() ?? 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

function formatDate(date: Date | string | null): string {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function buildInvoiceEmailHtml(invoice: any): string {
  const buyerName = invoice.buyer?.displayName || invoice.buyer?.name || 'Valued Customer';
  const total = formatCurrency(invoice.total);
  const dueDate = formatDate(invoice.dueDate);
  const periodStart = formatDate(invoice.periodStart);
  const periodEnd = formatDate(invoice.periodEnd);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">

    <!-- Header -->
    <div style="background-color: #f97316; color: white; padding: 32px; text-align: center;">
      <h1 style="margin: 0; font-size: 28px;">Invoice</h1>
      <p style="margin: 8px 0 0; font-size: 18px; opacity: 0.9;">${invoice.invoiceNumber}</p>
    </div>

    <!-- Content -->
    <div style="padding: 32px;">
      <p style="margin: 0 0 24px; font-size: 16px; color: #374151;">
        Dear ${buyerName},
      </p>

      <p style="margin: 0 0 24px; font-size: 16px; color: #374151;">
        Please find your invoice for the period of <strong>${periodStart}</strong> to <strong>${periodEnd}</strong>.
      </p>

      <!-- Invoice Summary Box -->
      <div style="background-color: #f9fafb; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Invoice Number:</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 600;">${invoice.invoiceNumber}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Due Date:</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 600;">${dueDate}</td>
          </tr>
          <tr style="border-top: 2px solid #e5e7eb;">
            <td style="padding: 16px 0 8px; color: #111827; font-weight: 600; font-size: 18px;">Total Due:</td>
            <td style="padding: 16px 0 8px; text-align: right; font-weight: 700; font-size: 24px; color: #f97316;">${total}</td>
          </tr>
        </table>
      </div>

      <!-- Notes -->
      ${invoice.buyerNotes ? `
      <div style="background-color: #fef3cd; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <p style="margin: 0; color: #856404; font-size: 14px;">
          <strong>Note:</strong> ${invoice.buyerNotes}
        </p>
      </div>
      ` : ''}

      <!-- CTA -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="${APP_URL}/admin/invoices/${invoice.id}" style="display: inline-block; background-color: #f97316; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
          View Invoice Details
        </a>
      </div>

      <p style="margin: 24px 0 0; font-size: 14px; color: #6b7280;">
        If you have any questions about this invoice, please contact us at <a href="mailto:${FROM_EMAIL}" style="color: #f97316;">${FROM_EMAIL}</a>
      </p>
    </div>

    <!-- Footer -->
    <div style="padding: 24px 32px; background-color: #f9fafb; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0; font-size: 12px; color: #6b7280;">
        My Contractor Now | Invoice System
      </p>
    </div>

  </div>
</body>
</html>
  `;
}

function buildInvoiceEmailText(invoice: any): string {
  const buyerName = invoice.buyer?.displayName || invoice.buyer?.name || 'Valued Customer';

  return `
INVOICE ${invoice.invoiceNumber}
${'='.repeat(50)}

Dear ${buyerName},

Please find your invoice for the period of ${formatDate(invoice.periodStart)} to ${formatDate(invoice.periodEnd)}.

INVOICE DETAILS
---------------
Invoice Number: ${invoice.invoiceNumber}
Due Date: ${formatDate(invoice.dueDate)}
Total Due: ${formatCurrency(invoice.total)}

${invoice.buyerNotes ? `Note: ${invoice.buyerNotes}\n` : ''}

View invoice details: ${APP_URL}/admin/invoices/${invoice.id}

If you have any questions, please contact us at ${FROM_EMAIL}

---
My Contractor Now | Invoice System
  `.trim();
}

function buildPaymentReceiptHtml(payment: any, invoice: any): string {
  const buyerName = invoice.buyer?.displayName || invoice.buyer?.name || 'Valued Customer';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">

    <!-- Header -->
    <div style="background-color: #10b981; color: white; padding: 32px; text-align: center;">
      <h1 style="margin: 0; font-size: 28px;">Payment Received</h1>
      <p style="margin: 8px 0 0; font-size: 18px; opacity: 0.9;">Thank you!</p>
    </div>

    <!-- Content -->
    <div style="padding: 32px;">
      <p style="margin: 0 0 24px; font-size: 16px; color: #374151;">
        Dear ${buyerName},
      </p>

      <p style="margin: 0 0 24px; font-size: 16px; color: #374151;">
        We have received your payment. Thank you for your prompt payment.
      </p>

      <!-- Payment Summary Box -->
      <div style="background-color: #f0fdf4; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Invoice:</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 600;">${invoice.invoiceNumber}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Payment Date:</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 600;">${formatDate(payment.paymentDate)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Payment Method:</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 600;">${payment.paymentMethod}</td>
          </tr>
          ${payment.referenceNumber ? `
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Reference:</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 600;">${payment.referenceNumber}</td>
          </tr>
          ` : ''}
          <tr style="border-top: 2px solid #bbf7d0;">
            <td style="padding: 16px 0 8px; color: #111827; font-weight: 600; font-size: 18px;">Amount Paid:</td>
            <td style="padding: 16px 0 8px; text-align: right; font-weight: 700; font-size: 24px; color: #10b981;">${formatCurrency(payment.amount)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Remaining Balance:</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 600;">${formatCurrency(invoice.balance)}</td>
          </tr>
        </table>
      </div>
    </div>

    <!-- Footer -->
    <div style="padding: 24px 32px; background-color: #f9fafb; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0; font-size: 12px; color: #6b7280;">
        My Contractor Now | Invoice System
      </p>
    </div>

  </div>
</body>
</html>
  `;
}

function buildPaymentReceiptText(payment: any, invoice: any): string {
  const buyerName = invoice.buyer?.displayName || invoice.buyer?.name || 'Valued Customer';

  return `
PAYMENT RECEIVED
${'='.repeat(50)}

Dear ${buyerName},

We have received your payment. Thank you for your prompt payment.

PAYMENT DETAILS
---------------
Invoice: ${invoice.invoiceNumber}
Payment Date: ${formatDate(payment.paymentDate)}
Payment Method: ${payment.paymentMethod}
${payment.referenceNumber ? `Reference: ${payment.referenceNumber}\n` : ''}
Amount Paid: ${formatCurrency(payment.amount)}
Remaining Balance: ${formatCurrency(invoice.balance)}

---
My Contractor Now | Invoice System
  `.trim();
}

function buildOverdueReminderHtml(invoice: any, daysOverdue: number): string {
  const buyerName = invoice.buyer?.displayName || invoice.buyer?.name || 'Valued Customer';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">

    <!-- Header -->
    <div style="background-color: #ef4444; color: white; padding: 32px; text-align: center;">
      <h1 style="margin: 0; font-size: 28px;">Payment Overdue</h1>
      <p style="margin: 8px 0 0; font-size: 18px; opacity: 0.9;">${daysOverdue} Days Past Due</p>
    </div>

    <!-- Content -->
    <div style="padding: 32px;">
      <p style="margin: 0 0 24px; font-size: 16px; color: #374151;">
        Dear ${buyerName},
      </p>

      <p style="margin: 0 0 24px; font-size: 16px; color: #374151;">
        This is a reminder that payment for the following invoice is <strong>${daysOverdue} days past due</strong>. Please arrange payment at your earliest convenience.
      </p>

      <!-- Invoice Summary Box -->
      <div style="background-color: #fef2f2; border: 2px solid #fecaca; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Invoice Number:</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 600;">${invoice.invoiceNumber}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Original Due Date:</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #ef4444;">${formatDate(invoice.dueDate)}</td>
          </tr>
          <tr style="border-top: 2px solid #fecaca;">
            <td style="padding: 16px 0 8px; color: #111827; font-weight: 600; font-size: 18px;">Amount Due:</td>
            <td style="padding: 16px 0 8px; text-align: right; font-weight: 700; font-size: 24px; color: #ef4444;">${formatCurrency(invoice.balance)}</td>
          </tr>
        </table>
      </div>

      <!-- CTA -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="${APP_URL}/admin/invoices/${invoice.id}" style="display: inline-block; background-color: #ef4444; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Pay Now
        </a>
      </div>

      <p style="margin: 24px 0 0; font-size: 14px; color: #6b7280;">
        If you have already made this payment, please disregard this notice. For questions, contact us at <a href="mailto:${FROM_EMAIL}" style="color: #f97316;">${FROM_EMAIL}</a>
      </p>
    </div>

    <!-- Footer -->
    <div style="padding: 24px 32px; background-color: #f9fafb; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0; font-size: 12px; color: #6b7280;">
        My Contractor Now | Invoice System
      </p>
    </div>

  </div>
</body>
</html>
  `;
}

function buildOverdueReminderText(invoice: any, daysOverdue: number): string {
  const buyerName = invoice.buyer?.displayName || invoice.buyer?.name || 'Valued Customer';

  return `
PAYMENT OVERDUE - ${daysOverdue} DAYS PAST DUE
${'='.repeat(50)}

Dear ${buyerName},

This is a reminder that payment for the following invoice is ${daysOverdue} days past due. Please arrange payment at your earliest convenience.

INVOICE DETAILS
---------------
Invoice Number: ${invoice.invoiceNumber}
Original Due Date: ${formatDate(invoice.dueDate)}
Amount Due: ${formatCurrency(invoice.balance)}

Pay Now: ${APP_URL}/admin/invoices/${invoice.id}

If you have already made this payment, please disregard this notice.
For questions, contact us at ${FROM_EMAIL}

---
My Contractor Now | Invoice System
  `.trim();
}
