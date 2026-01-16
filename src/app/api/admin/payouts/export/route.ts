/**
 * Admin Payout Export API Route
 *
 * WHY: Accounting needs to export approved payouts as CSV for payment processing.
 * WHEN: Admin clicks "Export CSV" in payout management.
 * HOW: Generates CSV file with all payouts in PROCESSING status (ready for payment).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPayoutsForExport } from '@/lib/services/affiliate-payment-service';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'PROCESSING';

    // Get payouts for export
    const payouts = await getPayoutsForExport(status);

    if (payouts.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No payouts found for export' },
        { status: 404 }
      );
    }

    // Build CSV content
    const headers = [
      'Payout ID',
      'Affiliate ID',
      'Affiliate Name',
      'Affiliate Email',
      'Payment Method',
      'Amount',
      'Period Start',
      'Period End',
      'Payment Details'
    ];

    const rows = payouts.map(p => [
      p.payoutId,
      p.affiliateId,
      escapeCSV(p.affiliateName),
      escapeCSV(p.affiliateEmail),
      escapeCSV(p.paymentMethod || 'Not configured'),
      p.amount.toFixed(2),
      formatDateForCSV(p.periodStart),
      formatDateForCSV(p.periodEnd),
      escapeCSV(formatPaymentDetails(p.paymentMethod, p.paymentDetails))
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    logger.info('Payout export generated', {
      status,
      count: payouts.length,
      totalAmount: payouts.reduce((sum, p) => sum + p.amount, 0)
    });

    // Return CSV file
    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="payouts-${status.toLowerCase()}-${formatDateForFilename(new Date())}.csv"`
      }
    });
  } catch (error) {
    logger.error('Failed to export payouts', {
      error: (error as Error).message
    });
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Escape CSV value (wrap in quotes if needed)
 */
function escapeCSV(value: string): string {
  if (!value) return '';
  // If value contains comma, newline, or quote, wrap in quotes and escape quotes
  if (value.includes(',') || value.includes('\n') || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Format date for CSV (YYYY-MM-DD)
 */
function formatDateForCSV(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Format date for filename
 */
function formatDateForFilename(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Format payment details for CSV based on payment method
 */
function formatPaymentDetails(method: string | null, details: any): string {
  if (!details) return '';

  try {
    if (typeof details === 'string') {
      details = JSON.parse(details);
    }

    switch (method) {
      case 'paypal':
        return details.email || '';
      case 'wire':
        return `Bank: ${details.bankName || ''}, Account: ***${(details.accountNumber || '').slice(-4)}`;
      case 'check':
        return `${details.name || ''}, ${details.address || ''}`;
      default:
        return JSON.stringify(details);
    }
  } catch {
    return '';
  }
}
