'use client';

/**
 * InvoicePDFTemplate - React-PDF template for invoice PDF generation
 *
 * WHY: Provides a professional, printable PDF version of invoices.
 * WHEN: Used when admin clicks "Download PDF" or "Print" on an invoice.
 * HOW: Uses @react-pdf/renderer to create a styled PDF document.
 *
 * Features:
 * - Professional layout with company branding
 * - Invoice header (number, date, due date, status)
 * - Bill To section with buyer details
 * - Line items table with proper formatting
 * - Totals section
 * - Footer with payment instructions
 */

import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer';

// ============================================
// TYPES
// ============================================

export interface InvoiceLineItemData {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  itemType: string;
  metadata?: {
    serviceType?: string;
    zipCode?: string;
    date?: string;
  } | null;
}

export interface InvoicePDFData {
  invoiceNumber: string;
  type: 'RECEIVABLE' | 'PAYABLE';
  status: string;
  issuedAt?: string | null;
  dueDate?: string | null;
  periodStart: string;
  periodEnd: string;
  paymentTermsDays: number;
  subtotal: number;
  adjustments: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  balance: number;
  buyerNotes?: string | null;
  buyer?: {
    name: string;
    billingEmail?: string | null;
    billingAddress?: string | null;
    taxId?: string | null;
  } | null;
  affiliate?: {
    name?: string | null;
    email: string;
  } | null;
  lineItems: InvoiceLineItemData[];
}

interface InvoicePDFTemplateProps {
  invoice: InvoicePDFData;
  companyName?: string;
  companyAddress?: string;
  companyEmail?: string;
  companyPhone?: string;
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#333333',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  companySection: {
    flex: 1,
  },
  companyName: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: '#EA580C', // Orange-600
    marginBottom: 4,
  },
  companyInfo: {
    fontSize: 9,
    color: '#666666',
    lineHeight: 1.4,
  },
  invoiceSection: {
    textAlign: 'right',
  },
  invoiceTitle: {
    fontSize: 24,
    fontFamily: 'Helvetica-Bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  invoiceNumber: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#4B5563',
    marginBottom: 4,
  },
  invoiceMeta: {
    fontSize: 9,
    color: '#6B7280',
    lineHeight: 1.5,
  },
  statusBadge: {
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 4,
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    alignSelf: 'flex-end',
  },
  statusPaid: {
    backgroundColor: '#D1FAE5',
    color: '#065F46',
  },
  statusOverdue: {
    backgroundColor: '#FEE2E2',
    color: '#991B1B',
  },
  statusDraft: {
    backgroundColor: '#F3F4F6',
    color: '#374151',
  },
  statusDefault: {
    backgroundColor: '#DBEAFE',
    color: '#1E40AF',
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    marginVertical: 20,
  },
  addressSection: {
    flexDirection: 'row',
    marginBottom: 30,
  },
  billTo: {
    flex: 1,
  },
  periodInfo: {
    flex: 1,
    textAlign: 'right',
  },
  sectionLabel: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  billToName: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  billToDetails: {
    fontSize: 10,
    color: '#4B5563',
    lineHeight: 1.5,
  },
  table: {
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  tableRowAlt: {
    backgroundColor: '#FAFAFA',
  },
  tableHeaderCell: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableCell: {
    fontSize: 9,
    color: '#374151',
  },
  colDescription: {
    flex: 3,
  },
  colQty: {
    width: 50,
    textAlign: 'center',
  },
  colUnitPrice: {
    width: 80,
    textAlign: 'right',
  },
  colAmount: {
    width: 80,
    textAlign: 'right',
  },
  totalsSection: {
    marginTop: 20,
    alignItems: 'flex-end',
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 4,
    width: 200,
  },
  totalsLabel: {
    fontSize: 10,
    color: '#6B7280',
    flex: 1,
  },
  totalsValue: {
    fontSize: 10,
    color: '#374151',
    width: 80,
    textAlign: 'right',
  },
  totalsDivider: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 8,
    marginTop: 8,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    width: 200,
  },
  totalLabel: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#1F2937',
    flex: 1,
  },
  totalValue: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#1F2937',
    width: 80,
    textAlign: 'right',
  },
  balanceRow: {
    marginTop: 8,
    backgroundColor: '#FEF3C7',
    padding: 8,
    borderRadius: 4,
  },
  balanceLabel: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#92400E',
  },
  balanceValue: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#92400E',
  },
  notesSection: {
    marginTop: 30,
    padding: 15,
    backgroundColor: '#F9FAFB',
    borderRadius: 4,
  },
  notesLabel: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#6B7280',
    marginBottom: 6,
  },
  notesText: {
    fontSize: 9,
    color: '#374151',
    lineHeight: 1.5,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 15,
  },
  footerText: {
    fontSize: 8,
    color: '#9CA3AF',
    marginBottom: 2,
  },
});

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function getStatusStyle(status: string) {
  switch (status) {
    case 'PAID':
      return styles.statusPaid;
    case 'OVERDUE':
      return styles.statusOverdue;
    case 'DRAFT':
    case 'CANCELLED':
      return styles.statusDraft;
    default:
      return styles.statusDefault;
  }
}

// ============================================
// MAIN COMPONENT
// ============================================

export function InvoicePDFTemplate({
  invoice,
  companyName = 'My Contractor Now',
  companyAddress = '123 Main Street, Suite 100\nAnytown, USA 12345',
  companyEmail = 'billing@mycontractornow.com',
  companyPhone = '(555) 123-4567',
}: InvoicePDFTemplateProps) {
  const billToEntity = invoice.buyer || invoice.affiliate;
  const billToName = invoice.buyer?.name || invoice.affiliate?.name || invoice.affiliate?.email || 'Unknown';

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.companySection}>
            <Text style={styles.companyName}>{companyName}</Text>
            <Text style={styles.companyInfo}>{companyAddress}</Text>
            <Text style={styles.companyInfo}>{companyEmail}</Text>
            <Text style={styles.companyInfo}>{companyPhone}</Text>
          </View>
          <View style={styles.invoiceSection}>
            <Text style={styles.invoiceTitle}>INVOICE</Text>
            <Text style={styles.invoiceNumber}>{invoice.invoiceNumber}</Text>
            <Text style={styles.invoiceMeta}>
              Date: {formatDate(invoice.issuedAt || new Date().toISOString())}
            </Text>
            <Text style={styles.invoiceMeta}>
              Due: {formatDate(invoice.dueDate)}
            </Text>
            <Text style={styles.invoiceMeta}>
              Terms: Net {invoice.paymentTermsDays}
            </Text>
            <View style={[styles.statusBadge, getStatusStyle(invoice.status)]}>
              <Text>{invoice.status.replace(/_/g, ' ')}</Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Bill To & Period */}
        <View style={styles.addressSection}>
          <View style={styles.billTo}>
            <Text style={styles.sectionLabel}>Bill To</Text>
            <Text style={styles.billToName}>{billToName}</Text>
            {invoice.buyer?.billingAddress && (
              <Text style={styles.billToDetails}>{invoice.buyer.billingAddress}</Text>
            )}
            {invoice.buyer?.billingEmail && (
              <Text style={styles.billToDetails}>{invoice.buyer.billingEmail}</Text>
            )}
            {invoice.buyer?.taxId && (
              <Text style={styles.billToDetails}>Tax ID: {invoice.buyer.taxId}</Text>
            )}
            {invoice.affiliate?.email && (
              <Text style={styles.billToDetails}>{invoice.affiliate.email}</Text>
            )}
          </View>
          <View style={styles.periodInfo}>
            <Text style={styles.sectionLabel}>Billing Period</Text>
            <Text style={styles.billToDetails}>
              {formatDate(invoice.periodStart)} - {formatDate(invoice.periodEnd)}
            </Text>
          </View>
        </View>

        {/* Line Items Table */}
        <View style={styles.table}>
          {/* Header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.colDescription]}>Description</Text>
            <Text style={[styles.tableHeaderCell, styles.colQty]}>Qty</Text>
            <Text style={[styles.tableHeaderCell, styles.colUnitPrice]}>Unit Price</Text>
            <Text style={[styles.tableHeaderCell, styles.colAmount]}>Amount</Text>
          </View>

          {/* Rows */}
          {invoice.lineItems.map((item, index) => (
            <View
              key={item.id}
              style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : {}]}
            >
              <View style={styles.colDescription}>
                <Text style={styles.tableCell}>{item.description}</Text>
                {item.metadata && (item.metadata.serviceType || item.metadata.zipCode) && (
                  <Text style={[styles.tableCell, { fontSize: 8, color: '#9CA3AF', marginTop: 2 }]}>
                    {[item.metadata.serviceType, item.metadata.zipCode && `ZIP: ${item.metadata.zipCode}`]
                      .filter(Boolean)
                      .join(' | ')}
                  </Text>
                )}
              </View>
              <Text style={[styles.tableCell, styles.colQty]}>{item.quantity}</Text>
              <Text style={[styles.tableCell, styles.colUnitPrice]}>
                {formatCurrency(item.unitPrice)}
              </Text>
              <Text style={[styles.tableCell, styles.colAmount, item.amount < 0 ? { color: '#059669' } : {}]}>
                {formatCurrency(item.amount)}
              </Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Subtotal</Text>
            <Text style={styles.totalsValue}>{formatCurrency(invoice.subtotal)}</Text>
          </View>
          {invoice.adjustments !== 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>
                {invoice.adjustments < 0 ? 'Credits' : 'Adjustments'}
              </Text>
              <Text style={[styles.totalsValue, invoice.adjustments < 0 ? { color: '#059669' } : {}]}>
                {formatCurrency(invoice.adjustments)}
              </Text>
            </View>
          )}
          {invoice.taxAmount !== 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Tax</Text>
              <Text style={styles.totalsValue}>{formatCurrency(invoice.taxAmount)}</Text>
            </View>
          )}
          <View style={[styles.totalRow, styles.totalsDivider]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatCurrency(invoice.total)}</Text>
          </View>
          {invoice.amountPaid > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Amount Paid</Text>
              <Text style={[styles.totalsValue, { color: '#059669' }]}>
                ({formatCurrency(invoice.amountPaid)})
              </Text>
            </View>
          )}
          {invoice.balance > 0 && (
            <View style={[styles.totalRow, styles.balanceRow]}>
              <Text style={styles.balanceLabel}>Balance Due</Text>
              <Text style={styles.balanceValue}>{formatCurrency(invoice.balance)}</Text>
            </View>
          )}
        </View>

        {/* Notes */}
        {invoice.buyerNotes && (
          <View style={styles.notesSection}>
            <Text style={styles.notesLabel}>Notes</Text>
            <Text style={styles.notesText}>{invoice.buyerNotes}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Thank you for your business!
          </Text>
          <Text style={styles.footerText}>
            Please include invoice number {invoice.invoiceNumber} with your payment.
          </Text>
          <Text style={styles.footerText}>
            Questions? Contact us at {companyEmail}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export default InvoicePDFTemplate;
