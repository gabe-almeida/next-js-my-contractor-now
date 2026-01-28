/**
 * Admin Email Service - AWS SES Integration
 *
 * WHY: Send admin notifications for lead auction completions via AWS SES.
 * WHEN: After every lead auction completes (sold, rejected, or delivery failed).
 * HOW: Uses AWS SDK v3 SES client to send formatted HTML emails.
 */

import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { logger } from '@/lib/logger';
import { captureApiError } from '@/lib/sentry';

// Check if AWS SES is configured
const AWS_CONFIGURED = !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);

// Initialize SES client (credentials from environment)
const sesClient = new SESClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: AWS_CONFIGURED ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  } : undefined, // Use default credential chain if not explicitly set
});

// Admin email recipient
const ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL || 'gabe@mycontractornow.com';

// Helper to escape HTML entities
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
const FROM_EMAIL = process.env.SES_FROM_EMAIL || 'notifications@mycontractornow.com';
const FROM_NAME = 'My Contractor Now';
const FROM_ADDRESS = `${FROM_NAME} <${FROM_EMAIL}>`;

// Log configuration status on module load (once)
if (!AWS_CONFIGURED) {
  logger.warn('[AdminEmail] AWS SES NOT CONFIGURED - emails will fail!', {
    hasAccessKeyId: !!process.env.AWS_ACCESS_KEY_ID,
    hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION || 'us-east-1 (default)',
    adminEmail: ADMIN_EMAIL,
    fromEmail: FROM_EMAIL,
  });
}

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
    // PING/POST response data for debugging
    pingResponse?: Record<string, any> | null;
    pingError?: string | null;
    postResponse?: Record<string, any> | null;
    postError?: string | null;
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
 * Build AuctionEmailData from database transactions (source of truth)
 *
 * WHY: In-memory AuctionResult can be inaccurate due to bugs (e.g., contractor
 *      fallback discarding network PING data). The database transactions table
 *      is the source of truth for what actually happened during the auction.
 * WHEN: Called before sending admin notification emails.
 * HOW: Queries transactions table for all PING/POST records, then builds
 *      the email data structure from actual saved records.
 *
 * @param leadId - The lead ID to build email data for
 * @param serviceTypeName - The service type name (e.g., "windows")
 * @param zipCode - The lead's ZIP code
 * @param customerName - Customer name from form data
 * @param customerEmail - Customer email from form data
 * @param customerPhone - Customer phone from form data
 * @param createdAt - When the lead was created
 * @returns AuctionEmailData built from database records
 */
export async function buildEmailDataFromDatabase(
  leadId: string,
  serviceTypeName: string,
  zipCode: string,
  customerName?: string,
  customerEmail?: string,
  customerPhone?: string,
  createdAt?: Date
): Promise<AuctionEmailData> {
  const { prisma } = await import('@/lib/db');

  // Query all transactions for this lead from the database
  const transactions = await prisma.transaction.findMany({
    where: { leadId },
    include: {
      buyer: {
        select: { id: true, name: true, displayName: true }
      }
    },
    orderBy: { createdAt: 'asc' }
  });

  // Query the lead for final status and winning buyer
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      status: true,
      winningBuyerId: true,
      winningBid: true,
      createdAt: true
    }
  });

  // Separate PING and POST transactions
  const pingTransactions = transactions.filter(t => t.actionType === 'PING');
  const postTransactions = transactions.filter(t => t.actionType === 'POST');

  // Build a map of POST results by buyer ID
  const postResultsByBuyer = new Map(
    postTransactions.map(t => [t.buyerId, t])
  );

  // Determine email status from lead status
  let emailStatus: 'SOLD' | 'REJECTED' | 'DELIVERY_FAILED' = 'REJECTED';
  if (lead?.status === 'SOLD') {
    emailStatus = 'SOLD';
  } else if (lead?.status === 'DELIVERY_FAILED') {
    emailStatus = 'DELIVERY_FAILED';
  }

  // Build bids array from PING transactions
  const bids: AuctionEmailData['bids'] = pingTransactions.map(ping => {
    const buyerName = ping.buyer?.displayName || ping.buyer?.name || ping.buyerId;
    const postTransaction = postResultsByBuyer.get(ping.buyerId);
    const isWinner = ping.buyerId === lead?.winningBuyerId;

    // Parse response JSON safely
    let pingResponse: Record<string, any> | null = null;
    let postResponse: Record<string, any> | null = null;
    try {
      if (ping.response) {
        pingResponse = typeof ping.response === 'string'
          ? JSON.parse(ping.response)
          : ping.response as Record<string, any>;
      }
      if (postTransaction?.response) {
        postResponse = typeof postTransaction.response === 'string'
          ? JSON.parse(postTransaction.response)
          : postTransaction.response as Record<string, any>;
      }
    } catch {
      // Ignore JSON parse errors
    }

    // Determine POST status
    let postStatus: 'SUCCESS' | 'FAILED' | 'NOT_ATTEMPTED' = 'NOT_ATTEMPTED';
    if (postTransaction) {
      postStatus = postTransaction.status === 'SUCCESS' ? 'SUCCESS' : 'FAILED';
    }

    return {
      buyerName,
      buyerId: ping.buyerId,
      bidAmount: ping.bidAmount ? Number(ping.bidAmount) : 0,
      responseTimeMs: ping.responseTime || 0,
      isWinner,
      postStatus,
      pingResponse,
      pingError: ping.errorMessage || null,
      postResponse: postTransaction ? postResponse : null,
      postError: postTransaction?.errorMessage || null,
    };
  });

  // Get winning buyer name
  let winningBuyerName: string | undefined;
  if (lead?.winningBuyerId) {
    const winningBuyer = await prisma.buyer.findUnique({
      where: { id: lead.winningBuyerId },
      select: { name: true, displayName: true }
    });
    winningBuyerName = winningBuyer?.displayName || winningBuyer?.name;
  }

  // Determine failure reason if not sold
  let failureReason: string | undefined;
  if (emailStatus !== 'SOLD') {
    if (pingTransactions.length === 0) {
      failureReason = 'No eligible buyers found for auction';
    } else if (bids.every(b => b.bidAmount === 0)) {
      failureReason = 'No winning bids received';
    } else {
      // Find the POST failure reason from the highest bidder
      const failedPost = postTransactions.find(t => t.status === 'FAILED');
      if (failedPost?.response) {
        try {
          const response = typeof failedPost.response === 'string'
            ? JSON.parse(failedPost.response)
            : failedPost.response;
          failureReason = response.message || response.error || 'Delivery failed';
        } catch {
          failureReason = 'Delivery failed';
        }
      } else {
        failureReason = 'All buyers rejected the lead';
      }
    }
  }

  return {
    leadId,
    serviceType: serviceTypeName,
    zipCode,
    customerName,
    customerEmail,
    customerPhone,
    status: emailStatus,
    participantCount: pingTransactions.length,
    bids,
    winningBuyerId: lead?.winningBuyerId || undefined,
    winningBuyerName,
    winningBidAmount: lead?.winningBid ? Number(lead.winningBid) : undefined,
    failureReason,
    createdAt: createdAt || lead?.createdAt || new Date(),
    auctionCompletedAt: new Date()
  };
}

/**
 * Send admin notification email after auction completes
 *
 * WHY: Keep admin informed of all lead auction outcomes in real-time.
 * WHEN: Called after every auction completion in lead-processor.
 * HOW: Formats auction data into HTML email and sends via SES.
 */
export async function sendAuctionCompletionEmail(data: AuctionEmailData): Promise<boolean> {
  // Check if AWS is configured first
  if (!AWS_CONFIGURED) {
    const configError = new Error('AWS SES not configured - cannot send admin notification email');

    logger.error('[AdminEmail] SKIPPING EMAIL - AWS SES NOT CONFIGURED', {
      leadId: data.leadId,
      status: data.status,
      auctionOutcome: data.status === 'SOLD'
        ? `Sold for $${data.winningBidAmount}`
        : data.failureReason,
      missingEnvVars: {
        AWS_ACCESS_KEY_ID: !process.env.AWS_ACCESS_KEY_ID,
        AWS_SECRET_ACCESS_KEY: !process.env.AWS_SECRET_ACCESS_KEY,
      },
      wouldHaveSentTo: ADMIN_EMAIL,
      wouldHaveSentFrom: FROM_EMAIL,
    });

    // Report to Sentry so you get alerted
    captureApiError(configError, {
      route: 'admin-email-service',
      action: 'sendAuctionCompletionEmail',
      extra: {
        leadId: data.leadId,
        auctionStatus: data.status,
        participantCount: data.participantCount,
        bidsReceived: data.bids.length,
        winningBidAmount: data.winningBidAmount,
        reason: 'AWS_SES_NOT_CONFIGURED',
      },
    });

    return false;
  }

  try {
    const subject = buildEmailSubject(data);
    const htmlBody = buildEmailHtml(data);
    const textBody = buildEmailText(data);

    logger.info('[AdminEmail] Attempting to send auction notification', {
      leadId: data.leadId,
      status: data.status,
      to: ADMIN_EMAIL,
      from: FROM_EMAIL,
      subject,
    });

    const command = new SendEmailCommand({
      Source: FROM_ADDRESS,
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

    logger.info('[AdminEmail] Email sent successfully', {
      leadId: data.leadId,
      status: data.status,
      recipient: ADMIN_EMAIL,
      participantCount: data.participantCount,
      bidsReceived: data.bids.length,
      winningBidAmount: data.winningBidAmount,
    });

    return true;
  } catch (error) {
    const errorMessage = (error as Error).message;
    const errorName = (error as Error).name;

    logger.error('[AdminEmail] FAILED to send email via AWS SES', {
      leadId: data.leadId,
      status: data.status,
      errorName,
      errorMessage,
      awsRegion: process.env.AWS_REGION || 'us-east-1',
      fromEmail: FROM_EMAIL,
      toEmail: ADMIN_EMAIL,
      // Include auction context so you know what you missed
      auctionSummary: {
        participantCount: data.participantCount,
        bidsReceived: data.bids.length,
        winningBuyerName: data.winningBuyerName,
        winningBidAmount: data.winningBidAmount,
        failureReason: data.failureReason,
      },
    });

    // Report to Sentry with full context
    captureApiError(error, {
      route: 'admin-email-service',
      action: 'sendAuctionCompletionEmail',
      extra: {
        leadId: data.leadId,
        auctionStatus: data.status,
        participantCount: data.participantCount,
        bidsReceived: data.bids.length,
        winningBidAmount: data.winningBidAmount,
        fromEmail: FROM_EMAIL,
        toEmail: ADMIN_EMAIL,
        awsRegion: process.env.AWS_REGION || 'us-east-1',
        errorName,
      },
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

  // Helper to format response for display
  const formatResponse = (response: Record<string, any> | null | undefined, error: string | null | undefined): string => {
    if (error) {
      return `<span style="color: #ef4444; font-size: 11px;">${escapeHtml(error.substring(0, 150))}${error.length > 150 ? '...' : ''}</span>`;
    }
    if (!response) {
      return '<span style="color: #9ca3af; font-size: 11px;">No response</span>';
    }
    // Show key fields from response
    const summary = JSON.stringify(response).substring(0, 200);
    return `<code style="font-size: 10px; background: #f3f4f6; padding: 2px 4px; border-radius: 3px; word-break: break-all;">${escapeHtml(summary)}${summary.length >= 200 ? '...' : ''}</code>`;
  };

  // Build bids table rows with response details
  const bidsTableRows = data.bids.length > 0
    ? data.bids.map(bid => `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 12px; font-weight: ${bid.isWinner ? 'bold' : 'normal'};">
            ${bid.buyerName}
            ${bid.isWinner ? ' 🏆' : ''}
          </td>
          <td style="padding: 12px; color: ${bid.bidAmount > 0 ? '#10b981' : '#ef4444'}; font-weight: bold;">$${bid.bidAmount.toFixed(2)}</td>
          <td style="padding: 12px; color: #6b7280;">${bid.responseTimeMs}ms</td>
          <td style="padding: 12px;">
            ${bid.postStatus === 'SUCCESS'
              ? '<span style="color: #10b981;">✓ Delivered</span>'
              : bid.postStatus === 'FAILED'
              ? '<span style="color: #ef4444;">✗ Failed</span>'
              : '<span style="color: #6b7280;">—</span>'}
          </td>
        </tr>
        <tr style="background-color: #fafafa;">
          <td colspan="4" style="padding: 8px 12px;">
            <div style="font-size: 11px; color: #6b7280; margin-bottom: 4px;">PING Response:</div>
            ${formatResponse(bid.pingResponse, bid.pingError)}
            ${bid.postStatus && bid.postStatus !== 'NOT_ATTEMPTED' ? `
              <div style="font-size: 11px; color: #6b7280; margin-top: 8px; margin-bottom: 4px;">POST Response:</div>
              ${formatResponse(bid.postResponse, bid.postError)}
            ` : ''}
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
          <div style="font-size: 28px; font-weight: bold; color: #3b82f6;">${data.bids.filter(b => b.bidAmount > 0).length}</div>
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
        <a href="https://mycontractornow.com/admin/leads/${data.leadId}" style="color: #f97316;">View in Admin Panel →</a>
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
Bids Received: ${data.bids.filter(b => b.bidAmount > 0).length}
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

// ============================================================================
// CALL AUCTION EMAIL NOTIFICATIONS
// ============================================================================

/**
 * Call auction result data structure for email notifications
 */
export interface CallAuctionEmailData {
  callId: string;
  callSid: string;
  serviceType: string;
  callerZip: string;
  callerPhone: string;
  callerState?: string;

  // Auction results
  status: 'CONNECTED' | 'NO_ANSWER' | 'NO_BIDS' | 'CALLER_HANGUP' | 'FAILED';
  participantCount: number;

  // Bid details
  bids: Array<{
    buyerName: string;
    buyerId: string;
    bidAmount: number;
    responseTimeMs: number;
    isWinner: boolean;
    transferNumber?: string;
  }>;

  // Winner info (if connected)
  winningBuyerId?: string;
  winningBuyerName?: string;
  winningBidAmount?: number;
  callDurationSeconds?: number;
  billableDurationSeconds?: number;

  // Failure reason (if not connected)
  failureReason?: string;

  // Timestamps
  createdAt: Date;
  auctionCompletedAt: Date;
}

/**
 * Send admin notification email after call auction completes
 *
 * WHY: Keep admin informed of all call auction outcomes in real-time.
 * WHEN: Called after call auction and transfer attempt completes.
 * HOW: Formats call data into HTML email and sends via SES.
 */
export async function sendCallAuctionEmail(data: CallAuctionEmailData): Promise<boolean> {
  if (!AWS_CONFIGURED) {
    logger.error('[AdminEmail] SKIPPING CALL EMAIL - AWS SES NOT CONFIGURED', {
      callId: data.callId,
      status: data.status,
    });
    return false;
  }

  try {
    const subject = buildCallEmailSubject(data);
    const htmlBody = buildCallEmailHtml(data);
    const textBody = buildCallEmailText(data);

    logger.info('[AdminEmail] Sending call auction notification', {
      callId: data.callId,
      status: data.status,
      to: ADMIN_EMAIL,
    });

    const command = new SendEmailCommand({
      Source: FROM_ADDRESS,
      Destination: { ToAddresses: [ADMIN_EMAIL] },
      Message: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: {
          Html: { Data: htmlBody, Charset: 'UTF-8' },
          Text: { Data: textBody, Charset: 'UTF-8' },
        },
      },
    });

    await sesClient.send(command);

    logger.info('[AdminEmail] Call email sent successfully', {
      callId: data.callId,
      status: data.status,
    });

    return true;
  } catch (error) {
    logger.error('[AdminEmail] Failed to send call email', {
      callId: data.callId,
      error: (error as Error).message,
    });
    captureApiError(error, {
      route: 'admin-email-service',
      action: 'sendCallAuctionEmail',
      extra: { callId: data.callId, status: data.status },
    });
    return false;
  }
}

function buildCallEmailSubject(data: CallAuctionEmailData): string {
  const statusEmoji = data.status === 'CONNECTED' ? '📞' : data.status === 'NO_ANSWER' ? '📵' : '❌';
  const statusText = data.status === 'CONNECTED'
    ? `CONNECTED $${data.winningBidAmount?.toFixed(2)}`
    : data.status === 'NO_ANSWER'
    ? 'NO ANSWER'
    : data.status === 'NO_BIDS'
    ? 'NO BIDS'
    : data.status === 'CALLER_HANGUP'
    ? 'CALLER HANGUP'
    : 'FAILED';

  return `${statusEmoji} Call ${statusText} | ${data.serviceType} | ${data.callerZip}`;
}

function buildCallEmailHtml(data: CallAuctionEmailData): string {
  const statusColor = data.status === 'CONNECTED' ? '#10b981' : data.status === 'NO_ANSWER' ? '#f59e0b' : '#ef4444';
  const statusText = data.status === 'CONNECTED' ? 'CONNECTED' :
                     data.status === 'NO_ANSWER' ? 'NO ANSWER' :
                     data.status === 'NO_BIDS' ? 'NO BIDS' :
                     data.status === 'CALLER_HANGUP' ? 'CALLER HANGUP' : 'FAILED';

  const bidsTableRows = data.bids.length > 0
    ? data.bids.map(bid => `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 12px; font-weight: ${bid.isWinner ? 'bold' : 'normal'};">
            ${bid.buyerName}${bid.isWinner ? ' 🏆' : ''}
          </td>
          <td style="padding: 12px; color: #10b981; font-weight: bold;">$${bid.bidAmount.toFixed(2)}</td>
          <td style="padding: 12px; color: #6b7280;">${bid.responseTimeMs}ms</td>
        </tr>
      `).join('')
    : '<tr><td colspan="3" style="padding: 12px; text-align: center; color: #6b7280;">No bids received</td></tr>';

  const durationDisplay = data.callDurationSeconds
    ? `${Math.floor(data.callDurationSeconds / 60)}m ${data.callDurationSeconds % 60}s`
    : 'N/A';

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
      <h1 style="margin: 0; font-size: 24px;">📞 CALL ${statusText}</h1>
      <p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px;">
        ${data.status === 'CONNECTED'
          ? `Connected to ${data.winningBuyerName} for $${data.winningBidAmount?.toFixed(2)}`
          : data.failureReason || 'Call auction completed'}
      </p>
    </div>

    <!-- Call Summary -->
    <div style="padding: 24px; border-bottom: 1px solid #e5e7eb;">
      <h2 style="margin: 0 0 16px; font-size: 18px; color: #111827;">Call Details</h2>
      <table style="width: 100%;">
        <tr>
          <td style="padding: 4px 0; color: #6b7280; width: 140px;">Call ID:</td>
          <td style="padding: 4px 0; font-family: monospace; font-size: 12px;">${data.callId}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #6b7280;">Service Type:</td>
          <td style="padding: 4px 0; font-weight: 500;">${data.serviceType}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #6b7280;">Caller Phone:</td>
          <td style="padding: 4px 0;"><a href="tel:${data.callerPhone}" style="color: #3b82f6;">${data.callerPhone}</a></td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #6b7280;">Caller ZIP:</td>
          <td style="padding: 4px 0; font-weight: 500;">${data.callerZip}</td>
        </tr>
        ${data.callerState ? `
        <tr>
          <td style="padding: 4px 0; color: #6b7280;">State:</td>
          <td style="padding: 4px 0;">${data.callerState}</td>
        </tr>
        ` : ''}
        ${data.callDurationSeconds ? `
        <tr>
          <td style="padding: 4px 0; color: #6b7280;">Duration:</td>
          <td style="padding: 4px 0; font-weight: 500;">${durationDisplay}</td>
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
          <div style="font-size: 28px; font-weight: bold; color: #3b82f6;">${data.bids.filter(b => b.bidAmount > 0).length}</div>
          <div style="font-size: 12px; color: #6b7280; text-transform: uppercase;">Bids Received</div>
        </div>
        <div style="flex: 1; text-align: center; padding: 16px; background-color: white; border-radius: 8px;">
          <div style="font-size: 28px; font-weight: bold; color: ${data.status === 'CONNECTED' ? '#10b981' : '#ef4444'};">
            ${data.status === 'CONNECTED' ? `$${data.winningBidAmount?.toFixed(2)}` : '$0'}
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
        <a href="https://mycontractornow.com/admin/calls" style="color: #f97316;">View in Admin Panel →</a>
      </p>
    </div>

  </div>
</body>
</html>
  `;
}

function buildCallEmailText(data: CallAuctionEmailData): string {
  const statusText = data.status === 'CONNECTED'
    ? `CONNECTED to ${data.winningBuyerName} for $${data.winningBidAmount?.toFixed(2)}`
    : data.status === 'NO_ANSWER'
    ? `NO ANSWER: ${data.failureReason}`
    : data.status === 'NO_BIDS'
    ? `NO BIDS: ${data.failureReason}`
    : data.status === 'CALLER_HANGUP'
    ? 'CALLER HANGUP during auction'
    : `FAILED: ${data.failureReason}`;

  const bidsText = data.bids.length > 0
    ? data.bids.map(bid =>
        `  - ${bid.buyerName}: $${bid.bidAmount.toFixed(2)} (${bid.responseTimeMs}ms)${bid.isWinner ? ' [WINNER]' : ''}`
      ).join('\n')
    : '  No bids received';

  return `
CALL AUCTION ${data.status}
${'='.repeat(50)}

STATUS: ${statusText}

CALL DETAILS
------------
Call ID: ${data.callId}
Service: ${data.serviceType}
Caller: ${data.callerPhone}
ZIP Code: ${data.callerZip}
${data.callerState ? `State: ${data.callerState}` : ''}
${data.callDurationSeconds ? `Duration: ${Math.floor(data.callDurationSeconds / 60)}m ${data.callDurationSeconds % 60}s` : ''}

AUCTION SUMMARY
---------------
Buyers Pinged: ${data.participantCount}
Bids Received: ${data.bids.filter(b => b.bidAmount > 0).length}
${data.status === 'CONNECTED' ? `Revenue: $${data.winningBidAmount?.toFixed(2)}` : 'Revenue: $0'}

BIDS
----
${bidsText}

TIMESTAMPS
----------
Created: ${data.createdAt.toLocaleString()}
Completed: ${data.auctionCompletedAt.toLocaleString()}

---
View in Admin: https://mycontractornow.com/admin/calls
  `.trim();
}
