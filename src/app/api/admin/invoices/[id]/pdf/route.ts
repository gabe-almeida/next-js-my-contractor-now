/**
 * Invoice PDF API Route
 *
 * WHY: Generates professional PDF invoices for download/email.
 *
 * WHEN: GET - Generate and download invoice PDF
 *
 * HOW: Uses @react-pdf/renderer to generate PDF from invoice data.
 */

import { NextResponse } from 'next/server';
import { withMiddleware, EnhancedRequest } from '@/lib/middleware';
import { logger } from '@/lib/logger';
import { errorResponse } from '@/lib/utils';
import { captureApiError } from '@/lib/sentry';
import { getInvoice } from '@/lib/services/invoice-service';
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer';
import { createElement } from 'react';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// PDF Styles
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 40,
    fontFamily: 'Helvetica',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  companyInfo: {
    flexDirection: 'column',
  },
  companyName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  companyAddress: {
    fontSize: 10,
    color: '#666666',
    marginBottom: 2,
  },
  invoiceTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2563eb',
    textAlign: 'right',
  },
  invoiceNumber: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'right',
    marginTop: 4,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    marginVertical: 20,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  detailsColumn: {
    flexDirection: 'column',
    width: '45%',
  },
  detailsLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#666666',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  detailsValue: {
    fontSize: 11,
    color: '#1a1a1a',
    marginBottom: 2,
  },
  statusBadge: {
    fontSize: 10,
    color: '#ffffff',
    backgroundColor: '#2563eb',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  table: {
    marginTop: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tableCell: {
    fontSize: 10,
    color: '#1a1a1a',
  },
  tableCellHeader: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#666666',
    textTransform: 'uppercase',
  },
  colDescription: {
    width: '50%',
  },
  colQty: {
    width: '15%',
    textAlign: 'right',
  },
  colPrice: {
    width: '17.5%',
    textAlign: 'right',
  },
  colAmount: {
    width: '17.5%',
    textAlign: 'right',
  },
  totalsSection: {
    marginTop: 20,
    alignItems: 'flex-end',
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 6,
    width: '40%',
  },
  totalsLabel: {
    fontSize: 11,
    color: '#666666',
    width: '60%',
  },
  totalsValue: {
    fontSize: 11,
    color: '#1a1a1a',
    width: '40%',
    textAlign: 'right',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 2,
    borderTopColor: '#1a1a1a',
    width: '40%',
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a1a',
    width: '60%',
  },
  totalValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a1a',
    width: '40%',
    textAlign: 'right',
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    width: '40%',
    backgroundColor: '#fef2f2',
    padding: 8,
    borderRadius: 4,
  },
  balanceLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#991b1b',
    width: '60%',
  },
  balanceValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#991b1b',
    width: '40%',
    textAlign: 'right',
  },
  notes: {
    marginTop: 30,
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 4,
  },
  notesLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#666666',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  notesText: {
    fontSize: 10,
    color: '#1a1a1a',
    lineHeight: 1.5,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 10,
  },
  footerText: {
    fontSize: 9,
    color: '#9ca3af',
  },
});

// Format currency
function formatCurrency(amount: number | string | { toNumber?: () => number } | null | undefined): string {
  if (amount === null || amount === undefined) return '$0.00';
  const num = typeof amount === 'object' && amount.toNumber ? amount.toNumber() : Number(amount);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(num);
}

// Format date
function formatDate(date: Date | string | null | undefined): string {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// Get status color
function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    DRAFT: '#6b7280',
    SENT: '#2563eb',
    PARTIALLY_PAID: '#d97706',
    PAID: '#059669',
    OVERDUE: '#dc2626',
    CANCELLED: '#6b7280',
    DISPUTED: '#7c3aed',
  };
  return colors[status] || '#6b7280';
}

// Invoice PDF Document Component (using createElement for server-side rendering)
function createInvoicePDF(invoice: NonNullable<Awaited<ReturnType<typeof getInvoice>>>) {
  const recipientName = invoice.buyer
    ? invoice.buyer.displayName || invoice.buyer.name
    : invoice.affiliate
    ? `${invoice.affiliate.firstName} ${invoice.affiliate.lastName}`.trim() ||
      invoice.affiliate.companyName
    : 'Unknown';

  const recipientAddress = invoice.buyer?.billingAddress || '';
  const recipientEmail = invoice.buyer?.billingEmail || invoice.affiliate?.email || '';

  return createElement(
    Document,
    { title: `Invoice ${invoice.invoiceNumber}` },
    createElement(
      Page,
      { size: 'A4', style: styles.page },
      // Header
      createElement(
        View,
        { style: styles.header },
        createElement(
          View,
          { style: styles.companyInfo },
          createElement(Text, { style: styles.companyName }, 'My Contractor Now'),
          createElement(Text, { style: styles.companyAddress }, '123 Business Street'),
          createElement(Text, { style: styles.companyAddress }, 'Suite 100'),
          createElement(Text, { style: styles.companyAddress }, 'New York, NY 10001'),
          createElement(Text, { style: styles.companyAddress }, 'billing@mycontractornow.com')
        ),
        createElement(
          View,
          null,
          createElement(Text, { style: styles.invoiceTitle }, 'INVOICE'),
          createElement(Text, { style: styles.invoiceNumber }, invoice.invoiceNumber)
        )
      ),
      // Divider
      createElement(View, { style: styles.divider }),
      // Details Row
      createElement(
        View,
        { style: styles.detailsRow },
        createElement(
          View,
          { style: styles.detailsColumn },
          createElement(Text, { style: styles.detailsLabel }, 'Bill To'),
          createElement(Text, { style: styles.detailsValue }, recipientName),
          recipientAddress &&
            createElement(Text, { style: styles.detailsValue }, recipientAddress),
          recipientEmail && createElement(Text, { style: styles.detailsValue }, recipientEmail)
        ),
        createElement(
          View,
          { style: styles.detailsColumn },
          createElement(Text, { style: styles.detailsLabel }, 'Invoice Details'),
          createElement(
            Text,
            { style: styles.detailsValue },
            `Issue Date: ${formatDate(invoice.issuedAt || invoice.createdAt)}`
          ),
          createElement(
            Text,
            { style: styles.detailsValue },
            `Due Date: ${formatDate(invoice.dueDate)}`
          ),
          createElement(
            Text,
            { style: styles.detailsValue },
            `Period: ${formatDate(invoice.periodStart)} - ${formatDate(invoice.periodEnd)}`
          ),
          createElement(
            Text,
            {
              style: {
                ...styles.statusBadge,
                backgroundColor: getStatusColor(invoice.status),
              },
            },
            invoice.status
          )
        )
      ),
      // Table Header
      createElement(
        View,
        { style: styles.table },
        createElement(
          View,
          { style: styles.tableHeader },
          createElement(
            Text,
            { style: { ...styles.tableCellHeader, ...styles.colDescription } },
            'Description'
          ),
          createElement(Text, { style: { ...styles.tableCellHeader, ...styles.colQty } }, 'Qty'),
          createElement(
            Text,
            { style: { ...styles.tableCellHeader, ...styles.colPrice } },
            'Unit Price'
          ),
          createElement(
            Text,
            { style: { ...styles.tableCellHeader, ...styles.colAmount } },
            'Amount'
          )
        ),
        // Table Rows
        ...invoice.lineItems.map((item, index) =>
          createElement(
            View,
            { style: styles.tableRow, key: index },
            createElement(
              Text,
              { style: { ...styles.tableCell, ...styles.colDescription } },
              item.description
            ),
            createElement(
              Text,
              { style: { ...styles.tableCell, ...styles.colQty } },
              item.quantity.toString()
            ),
            createElement(
              Text,
              { style: { ...styles.tableCell, ...styles.colPrice } },
              formatCurrency(item.unitPrice)
            ),
            createElement(
              Text,
              { style: { ...styles.tableCell, ...styles.colAmount } },
              formatCurrency(item.amount)
            )
          )
        )
      ),
      // Totals Section
      createElement(
        View,
        { style: styles.totalsSection },
        createElement(
          View,
          { style: styles.totalsRow },
          createElement(Text, { style: styles.totalsLabel }, 'Subtotal'),
          createElement(Text, { style: styles.totalsValue }, formatCurrency(invoice.subtotal))
        ),
        Number(invoice.adjustments) !== 0 &&
          createElement(
            View,
            { style: styles.totalsRow },
            createElement(Text, { style: styles.totalsLabel }, 'Adjustments'),
            createElement(Text, { style: styles.totalsValue }, formatCurrency(invoice.adjustments))
          ),
        Number(invoice.taxAmount) !== 0 &&
          createElement(
            View,
            { style: styles.totalsRow },
            createElement(Text, { style: styles.totalsLabel }, 'Tax'),
            createElement(Text, { style: styles.totalsValue }, formatCurrency(invoice.taxAmount))
          ),
        createElement(
          View,
          { style: styles.totalRow },
          createElement(Text, { style: styles.totalLabel }, 'Total'),
          createElement(Text, { style: styles.totalValue }, formatCurrency(invoice.total))
        ),
        Number(invoice.amountPaid) > 0 &&
          createElement(
            View,
            { style: styles.totalsRow },
            createElement(Text, { style: styles.totalsLabel }, 'Amount Paid'),
            createElement(
              Text,
              { style: styles.totalsValue },
              formatCurrency(invoice.amountPaid)
            )
          ),
        Number(invoice.balance) > 0 &&
          createElement(
            View,
            { style: styles.balanceRow },
            createElement(Text, { style: styles.balanceLabel }, 'Balance Due'),
            createElement(Text, { style: styles.balanceValue }, formatCurrency(invoice.balance))
          )
      ),
      // Notes
      invoice.buyerNotes &&
        createElement(
          View,
          { style: styles.notes },
          createElement(Text, { style: styles.notesLabel }, 'Notes'),
          createElement(Text, { style: styles.notesText }, invoice.buyerNotes)
        ),
      // Footer
      createElement(
        View,
        { style: styles.footer },
        createElement(
          Text,
          { style: styles.footerText },
          `Thank you for your business! Payment is due within ${invoice.paymentTermsDays} days of invoice date.`
        ),
        createElement(
          Text,
          { style: styles.footerText },
          `Questions? Contact billing@mycontractornow.com`
        )
      )
    )
  );
}

/**
 * GET /api/admin/invoices/[id]/pdf
 *
 * Generates and returns invoice PDF.
 */
async function handleGetPDF(
  req: EnhancedRequest,
  context: RouteContext
): Promise<NextResponse> {
  const { requestId } = req.context;
  const { id } = await context.params;

  try {
    const invoice = await getInvoice(id);

    if (!invoice) {
      return NextResponse.json(
        errorResponse('NOT_FOUND', 'Invoice not found', undefined, undefined, requestId),
        { status: 404 }
      );
    }

    // Generate PDF
    const pdfDocument = createInvoicePDF(invoice);
    const pdfBuffer = await renderToBuffer(pdfDocument);

    logger.info('Invoice PDF generated', {
      invoiceId: id,
      invoiceNumber: invoice.invoiceNumber,
      requestId,
    });

    // Return PDF response - convert Buffer to Uint8Array for NextResponse compatibility
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${invoice.invoiceNumber}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    captureApiError(error, {
      route: '/api/admin/invoices/[id]/pdf',
      action: 'GET',
      extra: { requestId, invoiceId: id },
    });
    logger.error('Failed to generate invoice PDF', {
      error: (error as Error).message,
      invoiceId: id,
      requestId,
    });

    return NextResponse.json(
      errorResponse('PDF_ERROR', 'Failed to generate invoice PDF', undefined, undefined, requestId),
      { status: 500 }
    );
  }
}

// Export handler with admin authentication
export const GET = withMiddleware(handleGetPDF, {
  rateLimiter: 'admin',
  enableLogging: true,
  requireAuth: true,
  enableCors: true,
});
