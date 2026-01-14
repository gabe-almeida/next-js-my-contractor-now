/**
 * Admin Email Service - AWS SES Integration
 *
 * WHY: Send admin notifications for lead auction completions via AWS SES.
 * WHEN: After every lead auction completes (sold, rejected, or delivery failed).
 * HOW: Uses AWS SDK v3 SES client to send formatted HTML emails.
 */

import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { logger } from '@/lib/logger';

// Initialize SES client (credentials from environment)
const sesClient = new SESClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: process.env.AWS_ACCESS_KEY_ID ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  } : undefined, // Use default credential chain if not explicitly set
});

// Admin email recipient
const ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL || 'gabe@mycontractornow.com';
const FROM_EMAIL = process.env.SES_FROM_EMAIL || 'notifications@mycontractornow.com';

/**
 * Auction result data structure for email notifications
 */
export interface AuctionEmailData {
  leadId: string;
  serviceType: string;
  zipCode: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;

  // Auction results
  status: 'SOLD' | 'REJECTED' | 'DELIVERY_FAILED';
  participantCount: number; // How many buyers were pinged

  // Bid details
  bids: Array<{
    buyerName: string;
    buyerId: string;
    bidAmount: number;
    responseTimeMs: number;
    isWinner: boolean;
    postStatus?: 'SUCCESS' | 'FAILED' | 'NOT_ATTEMPTED';
  }>;

  // Winner info (if sold)
  winningBuyerId?: string;
  winningBuyerName?: string;
  winningBidAmount?: number;

  // Failure reason (if not sold)
  failureReason?: string;

  // Timestamps
  createdAt: Date;
  auctionCompletedAt: Date;
}

/**
 * Send admin notification email after auction completes
 *
 * WHY: Keep admin informed of all lead auction outcomes in real-time.
 * WHEN: Called after every auction completion in lead-processor.
 * HOW: Formats auction data into HTML email and sends via SES.
 */
export async function sendAuctionCompletionEmail(data: AuctionEmailData): Promise<boolean> {
  try {
    const subject = buildEmailSubject(data);
    const htmlBody = buildEmailHtml(data);
    const textBody = buildEmailText(data);

    const command = new SendEmailCommand({
      Source: FROM_EMAIL,
      Destination: {
        ToAddresses: [ADMIN_EMAIL],
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

    await sesClient.send(command);

    logger.info('Admin auction email sent successfully', {
      leadId: data.leadId,
      status: data.status,
      recipient: ADMIN_EMAIL,
    });

    return true;
  } catch (error) {
    logger.error('Failed to send admin auction email', {
      leadId: data.leadId,
      error: (error as Error).message,
    });

    // Don't throw - email failure shouldn't break lead processing
    return false;
  }
}

/**
 * Build email subject line based on auction outcome
 */
function buildEmailSubject(data: AuctionEmailData): string {
  const statusEmoji = data.status === 'SOLD' ? '✅' : data.status === 'DELIVERY_FAILED' ? '⚠️' : '❌';
  const statusText = data.status === 'SOLD'
    ? `SOLD $${data.winningBidAmount?.toFixed(2)}`
    : data.status === 'DELIVERY_FAILED'
    ? 'DELIVERY FAILED'
    : 'NOT SOLD';

  const customerDisplay = data.customerName || 'Unknown';
  return `${statusEmoji} Lead ${statusText} | ${data.serviceType} | ${customerDisplay}`;
}

/**
 * Build HTML email body with auction details
 */
function buildEmailHtml(data: AuctionEmailData): string {
  const statusColor = data.status === 'SOLD' ? '#10b981' : data.status === 'DELIVERY_FAILED' ? '#f59e0b' : '#ef4444';
  const statusText = data.status === 'SOLD' ? 'SOLD' : data.status === 'DELIVERY_FAILED' ? 'DELIVERY FAILED' : 'NOT SOLD';

  // Build bids table rows
  const bidsTableRows = data.bids.length > 0
    ? data.bids.map(bid => `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 12px; font-weight: ${bid.isWinner ? 'bold' : 'normal'};">
            ${bid.buyerName}
            ${bid.isWinner ? ' 🏆' : ''}
          </td>
          <td style="padding: 12px; color: #10b981; font-weight: bold;">$${bid.bidAmount.toFixed(2)}</td>
          <td style="padding: 12px; color: #6b7280;">${bid.responseTimeMs}ms</td>
          <td style="padding: 12px;">
            ${bid.postStatus === 'SUCCESS'
              ? '<span style="color: #10b981;">✓ Delivered</span>'
              : bid.postStatus === 'FAILED'
              ? '<span style="color: #ef4444;">✗ Failed</span>'
              : '<span style="color: #6b7280;">—</span>'}
          </td>
        </tr>
      `).join('')
    : '<tr><td colspan="4" style="padding: 12px; text-align: center; color: #6b7280;">No bids received</td></tr>';

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
    <div style="background-color: ${statusColor}; color: white; padding: 24px; text-align: center;">
      <h1 style="margin: 0; font-size: 24px;">${statusText}</h1>
      <p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px;">
        ${data.status === 'SOLD'
          ? `Won by ${data.winningBuyerName} for $${data.winningBidAmount?.toFixed(2)}`
          : data.failureReason || 'Auction completed without sale'}
      </p>
    </div>

    <!-- Lead Summary -->
    <div style="padding: 24px; border-bottom: 1px solid #e5e7eb;">
      <h2 style="margin: 0 0 16px; font-size: 18px; color: #111827;">Lead Details</h2>
      <table style="width: 100%;">
        <tr>
          <td style="padding: 4px 0; color: #6b7280; width: 140px;">Lead ID:</td>
          <td style="padding: 4px 0; font-family: monospace; font-size: 12px;">${data.leadId}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #6b7280;">Service Type:</td>
          <td style="padding: 4px 0; font-weight: 500;">${data.serviceType}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #6b7280;">ZIP Code:</td>
          <td style="padding: 4px 0; font-weight: 500;">${data.zipCode}</td>
        </tr>
        ${data.customerName ? `
        <tr>
          <td style="padding: 4px 0; color: #6b7280;">Customer:</td>
          <td style="padding: 4px 0;">${data.customerName}</td>
        </tr>
        ` : ''}
        ${data.customerEmail ? `
        <tr>
          <td style="padding: 4px 0; color: #6b7280;">Email:</td>
          <td style="padding: 4px 0;"><a href="mailto:${data.customerEmail}" style="color: #3b82f6;">${data.customerEmail}</a></td>
        </tr>
        ` : ''}
        ${data.customerPhone ? `
        <tr>
          <td style="padding: 4px 0; color: #6b7280;">Phone:</td>
          <td style="padding: 4px 0;"><a href="tel:${data.customerPhone}" style="color: #3b82f6;">${data.customerPhone}</a></td>
        </tr>
        ` : ''}
      </table>
    </div>

    <!-- Auction Summary -->
    <div style="padding: 24px; background-color: #f9fafb; border-bottom: 1px solid #e5e7eb;">
      <h2 style="margin: 0 0 16px; font-size: 18px; color: #111827;">Auction Summary</h2>
      <div style="display: flex; gap: 24px;">
        <div style="flex: 1; text-align: center; padding: 16px; background-color: white; border-radius: 8px;">
          <div style="font-size: 28px; font-weight: bold; color: #f97316;">${data.participantCount}</div>
          <div style="font-size: 12px; color: #6b7280; text-transform: uppercase;">Buyers Pinged</div>
        </div>
        <div style="flex: 1; text-align: center; padding: 16px; background-color: white; border-radius: 8px;">
          <div style="font-size: 28px; font-weight: bold; color: #3b82f6;">${data.bids.length}</div>
          <div style="font-size: 12px; color: #6b7280; text-transform: uppercase;">Bids Received</div>
        </div>
        <div style="flex: 1; text-align: center; padding: 16px; background-color: white; border-radius: 8px;">
          <div style="font-size: 28px; font-weight: bold; color: ${data.status === 'SOLD' ? '#10b981' : '#ef4444'};">
            ${data.status === 'SOLD' ? `$${data.winningBidAmount?.toFixed(2)}` : '$0'}
          </div>
          <div style="font-size: 12px; color: #6b7280; text-transform: uppercase;">Revenue</div>
        </div>
      </div>
    </div>

    <!-- Bids Table -->
    <div style="padding: 24px;">
      <h2 style="margin: 0 0 16px; font-size: 18px; color: #111827;">Bid Details</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background-color: #f9fafb; border-bottom: 2px solid #e5e7eb;">
            <th style="padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280;">Buyer</th>
            <th style="padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280;">Bid</th>
            <th style="padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280;">Response</th>
            <th style="padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${bidsTableRows}
        </tbody>
      </table>
    </div>

    <!-- Footer -->
    <div style="padding: 16px 24px; background-color: #f9fafb; text-align: center; font-size: 12px; color: #6b7280;">
      <p style="margin: 0;">
        Created: ${data.createdAt.toLocaleString()} |
        Completed: ${data.auctionCompletedAt.toLocaleString()}
      </p>
      <p style="margin: 8px 0 0;">
        <a href="https://mycontractornow.com/admin/leads" style="color: #f97316;">View in Admin Panel →</a>
      </p>
    </div>

  </div>
</body>
</html>
  `;
}

/**
 * Build plain text email body (fallback for email clients without HTML)
 */
function buildEmailText(data: AuctionEmailData): string {
  const statusText = data.status === 'SOLD'
    ? `SOLD to ${data.winningBuyerName} for $${data.winningBidAmount?.toFixed(2)}`
    : data.status === 'DELIVERY_FAILED'
    ? `DELIVERY FAILED: ${data.failureReason}`
    : `NOT SOLD: ${data.failureReason}`;

  const bidsText = data.bids.length > 0
    ? data.bids.map(bid =>
        `  - ${bid.buyerName}: $${bid.bidAmount.toFixed(2)} (${bid.responseTimeMs}ms)${bid.isWinner ? ' [WINNER]' : ''}`
      ).join('\n')
    : '  No bids received';

  return `
LEAD AUCTION ${data.status}
${'='.repeat(50)}

STATUS: ${statusText}

LEAD DETAILS
------------
Lead ID: ${data.leadId}
Service: ${data.serviceType}
ZIP Code: ${data.zipCode}
${data.customerName ? `Customer: ${data.customerName}` : ''}
${data.customerEmail ? `Email: ${data.customerEmail}` : ''}
${data.customerPhone ? `Phone: ${data.customerPhone}` : ''}

AUCTION SUMMARY
---------------
Buyers Pinged: ${data.participantCount}
Bids Received: ${data.bids.length}
${data.status === 'SOLD' ? `Revenue: $${data.winningBidAmount?.toFixed(2)}` : 'Revenue: $0'}

BIDS
----
${bidsText}

TIMESTAMPS
----------
Created: ${data.createdAt.toLocaleString()}
Completed: ${data.auctionCompletedAt.toLocaleString()}

---
View in Admin: https://mycontractornow.com/admin/leads
  `.trim();
}
