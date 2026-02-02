/**
 * Call Completion Webhook Handler
 *
 * WHY: Finalize call records when Twilio's <Dial> completes.
 *      This is where we determine billability and trigger payouts.
 *      Critical for financial accuracy and affiliate compensation.
 *
 * WHEN: Twilio sends this webhook after the <Dial> action completes.
 *       This happens whether the call was answered, rejected, or failed.
 *       Note: Recording webhook may arrive before OR after this one.
 *
 * HOW:
 *   1. Verify Twilio signature (security)
 *   2. Check idempotency (prevent duplicate processing)
 *   3. Parse completion payload (duration, status, etc.)
 *   4. Update call record (status, duration, disposition)
 *   5. Determine if call qualifies for payout
 *   6. Calculate payouts if qualified
 *   7. Log CALL_COMPLETE transaction
 *   8. Fire postback to affiliate if configured
 *
 * CALL FLOW:
 * +----------------------------------------------------------------------+
 * |  Buyer hangs up OR caller hangs up OR timeout                        |
 * |      |                                                               |
 * |  Twilio sends completion webhook -> /api/calls/completed             |
 * |      |                                                               |
 * |  [CONNECTED] Calculate payouts, mark billable if qualifies           |
 * |  [NO_ANSWER] Mark as NO_ANSWER terminal state                        |
 * |  [FAILED] Mark as FAILED terminal state                              |
 * +----------------------------------------------------------------------+
 *
 * RACE CONDITION NOTE:
 *   Recording webhook may arrive before OR after this handler.
 *   We ONLY update completion-related fields here.
 *   Recording handler updates recording-related fields independently.
 */

import { NextRequest } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import {
  withTwilioVerification,
  createTwimlResponse,
  createWebhookErrorResponse,
} from '@/lib/twilio/verify-signature';
import {
  isWebhookProcessed,
  markWebhookProcessed,
  markWebhookFailed,
} from '@/lib/twilio/idempotency';
import {
  logWebhookReceived,
  createCallActivityLog,
  logCallStateChange,
  logBillingEvent,
} from '@/lib/twilio/logging';
import { buildEmptyResponse } from '@/lib/twilio/twiml-builder';
import { sendCallAuctionEmail, CallAuctionEmailData } from '@/lib/services/admin-email-service';
import { incrementTrackingNumberStats } from '@/lib/services/tracking-number-service';
import {
  validateTransition,
  mapDialStatus,
  isTerminalStatus,
  type CallStatus,
} from '@/lib/twilio/state-machine';

// =====================================
// TYPE DEFINITIONS
// =====================================

/**
 * Twilio webhook payload for dial completion
 * These are the fields Twilio sends after <Dial> completes
 */
interface TwilioCompletionPayload {
  CallSid: string; // Parent call SID
  CallDuration: string; // Total seconds of parent call
  DialCallDuration?: string; // Just the connected portion
  DialCallStatus: string; // completed, busy, no-answer, failed, canceled
  DialBridged?: string; // "true" if call was actually connected
  RecordingUrl?: string; // May or may not be present yet
  RecordingSid?: string; // Recording identifier
  AccountSid: string;
  From?: string;
  To?: string;
}

/**
 * Call record with campaign data for payout calculation
 */
interface CallWithCampaign {
  id: string;
  twilioCallSid: string;
  status: string;
  isQualified: boolean;
  winningBid: Decimal | null;
  winningBuyerId: string | null;
  affiliateId: string | null;
  campaignId: string | null;
  trackingNumberId: string | null;
  version: number;
  campaign: {
    id: string;
    name: string;
    callBasePayout: Decimal | null;
    minCallDuration: number;
    requireIvrQualification: boolean;
  } | null;
  affiliate: {
    id: string;
    postbackUrl: string | null;
    postbackMethod: string;
  } | null;
  // Custom affiliate payout override (from AffiliateCampaign junction)
  affiliateCampaignPayout: Decimal | null;
}

/**
 * Payout calculation result
 */
interface PayoutResult {
  isBillable: boolean;
  affiliatePayout: number;
  buyerCharge: number;
  platformMargin: number;
  reason?: string;
}

// =====================================
// MAIN HANDLER
// =====================================

export async function POST(request: NextRequest) {
  return withTwilioVerification(request, async (body) => {
    const payload = body as unknown as TwilioCompletionPayload;
    const callSid = payload.CallSid;
    const searchParams = request.nextUrl.searchParams;
    const callId = searchParams.get('callId');

    // Log webhook receipt
    logWebhookReceived({
      callSid,
      eventType: 'call_completed',
      eventStatus: payload.DialCallStatus,
      payload: body,
      source: 'completed',
    });

    // Add Sentry context
    Sentry.setTag('callSid', callSid);
    Sentry.setTag('callId', callId || 'unknown');
    Sentry.setExtra('dialStatus', payload.DialCallStatus);

    try {
      // ─────────────────────────────────────────────────────────────
      // Step 1: Validate call ID
      // ─────────────────────────────────────────────────────────────
      if (!callId) {
        logger.error({
          event: 'completion.missing_call_id',
          message: 'Completion webhook received without callId',
          callSid,
        });

        // Try to find call by twilioCallSid as fallback
        const callByTwilioSid = await prisma.call.findUnique({
          where: { twilioCallSid: callSid },
          select: { id: true },
        });

        if (!callByTwilioSid) {
          await markWebhookFailed(callSid, 'call_completed', undefined, 'Missing callId and no match by SID');
          return createTwimlResponse(buildEmptyResponse());
        }

        // Continue with found call ID
        return handleCompletionWithCallId(callByTwilioSid.id, payload, callSid);
      }

      return handleCompletionWithCallId(callId, payload, callSid);
    } catch (error) {
      logger.error({
        event: 'completion.error',
        message: 'Error processing call completion',
        callId,
        callSid,
        error: (error as Error).message,
        stack: (error as Error).stack,
      });

      Sentry.captureException(error, {
        tags: { component: 'completion-webhook' },
        extra: { callId, callSid, payload: body },
      });

      await markWebhookFailed(callSid, 'call_completed', undefined, (error as Error).message);

      // Return empty response to acknowledge - don't cause Twilio to retry
      return createTwimlResponse(buildEmptyResponse());
    }
  });
}

// =====================================
// CORE COMPLETION LOGIC
// =====================================

/**
 * WHY: Process completion webhook with validated call ID.
 * WHEN: After callId is validated or found by fallback lookup.
 * HOW: Load call, update status, calculate payouts, fire postback.
 */
async function handleCompletionWithCallId(
  callId: string,
  payload: TwilioCompletionPayload,
  callSid: string
): Promise<Response> {
  // ─────────────────────────────────────────────────────────────
  // Step 2: Idempotency check
  // ─────────────────────────────────────────────────────────────
  const isProcessed = await isWebhookProcessed('call_completed', callSid);

  if (isProcessed) {
    logger.info({
      event: 'completion.duplicate',
      message: 'Duplicate completion webhook, skipping',
      callId,
      callSid,
    });
    return createTwimlResponse(buildEmptyResponse());
  }

  // ─────────────────────────────────────────────────────────────
  // Step 3: Load call with campaign and affiliate data
  // ─────────────────────────────────────────────────────────────
  // First fetch the call with campaign and affiliate
  const rawCall = await prisma.call.findUnique({
    where: { id: callId },
    include: {
      campaign: {
        select: {
          id: true,
          name: true,
          callBasePayout: true,
          minCallDuration: true,
          requireIvrQualification: true,
        },
      },
      affiliate: {
        select: {
          id: true,
          postbackUrl: true,
          postbackMethod: true,
        },
      },
    },
  });

  // Fetch custom affiliate payout if affiliate and campaign exist
  let affiliateCampaignPayout: Decimal | null = null;
  if (rawCall?.affiliateId && rawCall?.campaignId) {
    const affiliateCampaign = await prisma.affiliateCampaign.findUnique({
      where: {
        affiliateId_campaignId: {
          affiliateId: rawCall.affiliateId,
          campaignId: rawCall.campaignId,
        },
      },
      select: { customCallPayout: true },
    });
    affiliateCampaignPayout = affiliateCampaign?.customCallPayout ?? null;
  }

  const call = rawCall ? {
    ...rawCall,
    affiliateCampaignPayout,
  } as CallWithCampaign : null;

  if (!call) {
    logger.error({
      event: 'completion.call_not_found',
      message: 'Call record not found',
      callId,
      callSid,
    });
    await markWebhookFailed(callSid, 'call_completed', undefined, 'Call not found');
    return createTwimlResponse(buildEmptyResponse());
  }

  // ─────────────────────────────────────────────────────────────
  // Step 4: Check if call is already in terminal state
  // ─────────────────────────────────────────────────────────────
  if (isTerminalStatus(call.status as CallStatus)) {
    logger.info({
      event: 'completion.already_terminal',
      message: `Call already in terminal state: ${call.status}`,
      callId,
      callSid,
      currentStatus: call.status,
    });

    await markWebhookProcessed(callSid, 'call_completed', undefined, {
      result: 'skipped',
      reason: 'already_terminal',
      currentStatus: call.status,
    });

    return createTwimlResponse(buildEmptyResponse());
  }

  // ─────────────────────────────────────────────────────────────
  // Step 5: Parse completion payload
  // ─────────────────────────────────────────────────────────────
  const parsedPayload = parseCompletionPayload(payload);

  logger.info({
    event: 'completion.parsed',
    message: 'Parsed completion payload',
    callId,
    callSid,
    ...parsedPayload,
  });

  // ─────────────────────────────────────────────────────────────
  // Step 6: Determine target status from dial result
  // ─────────────────────────────────────────────────────────────
  const targetStatus = mapDialStatus(payload.DialCallStatus, parsedPayload.dialBridged);

  // Validate state transition
  try {
    validateTransition(call.status as CallStatus, targetStatus);
  } catch (error) {
    logger.warn({
      event: 'completion.invalid_transition',
      message: `Invalid state transition: ${call.status} -> ${targetStatus}`,
      callId,
      callSid,
      from: call.status,
      to: targetStatus,
    });

    // If we can't transition, just log and return - don't retry
    await markWebhookProcessed(callSid, 'call_completed', undefined, {
      result: 'invalid_transition',
      from: call.status,
      to: targetStatus,
    });

    return createTwimlResponse(buildEmptyResponse());
  }

  // ─────────────────────────────────────────────────────────────
  // Step 7: Determine if call qualifies for payout
  // ─────────────────────────────────────────────────────────────
  const payoutResult = calculatePayout(call, parsedPayload);

  logger.info({
    event: 'completion.payout_calculated',
    message: `Payout calculation: ${payoutResult.isBillable ? 'BILLABLE' : 'NOT_BILLABLE'}`,
    callId,
    callSid,
    isBillable: payoutResult.isBillable,
    affiliatePayout: payoutResult.affiliatePayout,
    buyerCharge: payoutResult.buyerCharge,
    platformMargin: payoutResult.platformMargin,
    reason: payoutResult.reason,
  });

  // ─────────────────────────────────────────────────────────────
  // Step 8: Update call record atomically
  // ─────────────────────────────────────────────────────────────
  const updatedCall = await updateCallRecord(
    call,
    targetStatus,
    parsedPayload,
    payoutResult
  );

  logCallStateChange(callId, callSid, call.status, targetStatus, parsedPayload.disposition);

  // ─────────────────────────────────────────────────────────────
  // Step 9: Log activity for affiliate visibility
  // ─────────────────────────────────────────────────────────────
  await logCallCompletion(callId, parsedPayload, payoutResult);

  // ─────────────────────────────────────────────────────────────
  // Step 9b: Update tracking number stats (denormalized counters)
  // ─────────────────────────────────────────────────────────────
  if (call.trackingNumberId) {
    // Fire-and-forget - don't block completion on stats update
    incrementTrackingNumberStats(call.trackingNumberId, payoutResult.isBillable).catch((error) => {
      logger.warn({
        event: 'completion.tracking_stats_error',
        message: 'Failed to increment tracking number stats',
        callId,
        trackingNumberId: call.trackingNumberId,
        error: (error as Error).message,
      });
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Step 10: Fire postback to affiliate if configured
  // ─────────────────────────────────────────────────────────────
  if (payoutResult.isBillable && call.affiliate?.postbackUrl) {
    // Fire-and-forget postback (don't await)
    fireAffiliatePostback(
      callId,
      call.affiliate.postbackUrl,
      call.affiliate.postbackMethod,
      updatedCall,
      payoutResult
    ).catch((error) => {
      logger.warn({
        event: 'completion.postback_error',
        message: 'Failed to send postback (fire-and-forget)',
        callId,
        error: (error as Error).message,
      });
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Step 11: Send admin email notification (fire-and-forget)
  // ─────────────────────────────────────────────────────────────
  sendCallAuctionEmailNotification(call, callId, parsedPayload, payoutResult).catch((error) => {
    logger.warn({
      event: 'completion.email_error',
      message: 'Failed to send admin email notification',
      callId,
      error: (error as Error).message,
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Step 12: Mark webhook as processed
  // ─────────────────────────────────────────────────────────────
  await markWebhookProcessed(callSid, 'call_completed', undefined, {
    result: 'success',
    targetStatus,
    isBillable: payoutResult.isBillable,
    affiliatePayout: payoutResult.affiliatePayout,
  });

  return createTwimlResponse(buildEmptyResponse());
}

// =====================================
// HELPER FUNCTIONS
// =====================================

/**
 * WHY: Extract and normalize data from Twilio completion payload.
 * WHEN: After receiving completion webhook.
 * HOW: Parse numeric strings, boolean strings, map disposition.
 */
function parseCompletionPayload(payload: TwilioCompletionPayload): {
  totalDurationSeconds: number;
  connectedDurationSeconds: number;
  dialBridged: boolean;
  disposition: string;
} {
  const totalDurationSeconds = parseInt(payload.CallDuration, 10) || 0;
  const connectedDurationSeconds = parseInt(payload.DialCallDuration || '0', 10) || 0;
  const dialBridged = payload.DialBridged === 'true';

  // Map Twilio dial status to our disposition
  const dialStatus = payload.DialCallStatus?.toLowerCase() || 'failed';
  let disposition: string;

  switch (dialStatus) {
    case 'completed':
      disposition = dialBridged ? 'ANSWERED' : 'FAILED';
      break;
    case 'busy':
      disposition = 'BUSY';
      break;
    case 'no-answer':
      disposition = 'NO_ANSWER';
      break;
    case 'failed':
      disposition = 'FAILED';
      break;
    case 'canceled':
      disposition = 'CANCELED';
      break;
    default:
      disposition = 'FAILED';
  }

  return {
    totalDurationSeconds,
    connectedDurationSeconds,
    dialBridged,
    disposition,
  };
}

/**
 * WHY: Determine if call qualifies for payout and calculate amounts.
 * WHEN: After parsing completion payload.
 * HOW: Check all qualification criteria and calculate based on campaign settings.
 *
 * Qualification criteria (ALL must be met):
 *   1. DialBridged === true (call was actually connected)
 *   2. connectedDurationSeconds >= campaign.minCallDuration (default 90s)
 *   3. If campaign requires IVR: call.isQualified === true
 *   4. Call has a winning bid (buyer was assigned)
 */
function calculatePayout(
  call: CallWithCampaign,
  parsedPayload: {
    dialBridged: boolean;
    connectedDurationSeconds: number;
  }
): PayoutResult {
  const { dialBridged, connectedDurationSeconds } = parsedPayload;
  const campaign = call.campaign;
  const minDuration = campaign?.minCallDuration ?? 90;

  // Check: Was call actually connected?
  if (!dialBridged) {
    return {
      isBillable: false,
      affiliatePayout: 0,
      buyerCharge: 0,
      platformMargin: 0,
      reason: 'call_not_bridged',
    };
  }

  // Check: Does call meet minimum duration?
  if (connectedDurationSeconds < minDuration) {
    return {
      isBillable: false,
      affiliatePayout: 0,
      buyerCharge: 0,
      platformMargin: 0,
      reason: `duration_too_short (${connectedDurationSeconds}s < ${minDuration}s)`,
    };
  }

  // Check: IVR qualification if required
  if (campaign?.requireIvrQualification && !call.isQualified) {
    return {
      isBillable: false,
      affiliatePayout: 0,
      buyerCharge: 0,
      platformMargin: 0,
      reason: 'ivr_not_qualified',
    };
  }

  // Check: Has winning bid
  if (!call.winningBid || !call.winningBuyerId) {
    return {
      isBillable: false,
      affiliatePayout: 0,
      buyerCharge: 0,
      platformMargin: 0,
      reason: 'no_winning_bid',
    };
  }

  // Calculate payouts
  // Use custom affiliate payout if set, otherwise fall back to campaign default
  const buyerCharge = call.winningBid.toNumber();
  const affiliatePayout = call.affiliateCampaignPayout?.toNumber()
    ?? campaign?.callBasePayout?.toNumber()
    ?? 0;
  const platformMargin = buyerCharge - affiliatePayout;

  return {
    isBillable: true,
    affiliatePayout,
    buyerCharge,
    platformMargin,
    reason: undefined,
  };
}

/**
 * WHY: Atomically update call record with completion data.
 * WHEN: After determining payout and target status.
 * HOW: Use optimistic locking (version field) to prevent race conditions.
 *
 * NOTE: We do NOT update recording fields here - those are handled
 *       by the recording webhook independently to avoid race conditions.
 */
async function updateCallRecord(
  call: CallWithCampaign,
  targetStatus: CallStatus,
  parsedPayload: {
    totalDurationSeconds: number;
    connectedDurationSeconds: number;
    disposition: string;
  },
  payoutResult: PayoutResult
) {
  return prisma.call.update({
    where: {
      id: call.id,
      version: call.version, // Optimistic locking
    },
    data: {
      status: targetStatus,
      previousStatus: call.status,
      statusChangedAt: new Date(),
      endedAt: new Date(),
      totalDurationSeconds: parsedPayload.totalDurationSeconds,
      connectedDurationSeconds: parsedPayload.connectedDurationSeconds,
      disposition: parsedPayload.disposition,
      isBillable: payoutResult.isBillable,
      affiliatePayout: payoutResult.isBillable ? payoutResult.affiliatePayout : null,
      buyerCharge: payoutResult.isBillable ? payoutResult.buyerCharge : null,
      platformMargin: payoutResult.isBillable ? payoutResult.platformMargin : null,
      billingStatus: payoutResult.isBillable ? 'PENDING' : 'FINALIZED',
      billingFinalizedAt: payoutResult.isBillable ? null : new Date(),
      version: { increment: 1 },
    },
  });
}

/**
 * WHY: Create user-facing activity log for call completion.
 * WHEN: After updating call record.
 * HOW: Log duration and payout details for affiliate transparency.
 */
async function logCallCompletion(
  callId: string,
  parsedPayload: {
    connectedDurationSeconds: number;
    disposition: string;
  },
  payoutResult: PayoutResult
): Promise<void> {
  const durationMinutes = Math.floor(parsedPayload.connectedDurationSeconds / 60);
  const durationSeconds = parsedPayload.connectedDurationSeconds % 60;
  const durationDisplay = `${durationMinutes}:${durationSeconds.toString().padStart(2, '0')}`;

  // Log call completed event
  await createCallActivityLog(
    callId,
    'call.completed',
    `Call completed - Duration: ${durationDisplay}`,
    {
      level: 'info',
      details: {
        disposition: parsedPayload.disposition,
        connectedDurationSeconds: parsedPayload.connectedDurationSeconds,
        isBillable: payoutResult.isBillable,
      },
      visibleToAffiliate: true,
      visibleToAdmin: true,
    }
  );

  // Log payout event if billable
  if (payoutResult.isBillable) {
    await createCallActivityLog(
      callId,
      'call.payout',
      `Payout: $${payoutResult.affiliatePayout.toFixed(2)}`,
      {
        level: 'info',
        details: {
          affiliatePayout: payoutResult.affiliatePayout,
          buyerCharge: payoutResult.buyerCharge,
          platformMargin: payoutResult.platformMargin,
        },
        visibleToAffiliate: true,
        visibleToAdmin: true,
      }
    );

    // Also log to billing event logger
    logBillingEvent(callId, 'call_complete', payoutResult.affiliatePayout, {
      buyerCharge: payoutResult.buyerCharge,
      platformMargin: payoutResult.platformMargin,
    });
  } else if (payoutResult.reason) {
    // Log non-billable reason
    await createCallActivityLog(
      callId,
      'call.not_billable',
      `Call not billable: ${payoutResult.reason}`,
      {
        level: 'info',
        details: { reason: payoutResult.reason },
        visibleToAffiliate: true,
        visibleToAdmin: true,
      }
    );
  }
}

/**
 * WHY: Notify affiliate's system when a call qualifies for payout.
 * WHEN: After billable call completion.
 * HOW: Fire-and-forget HTTP request to affiliate's postbackUrl.
 *
 * NOTE: This is fire-and-forget - we don't block on the response.
 *       We update the call record with postback status asynchronously.
 */
async function fireAffiliatePostback(
  callId: string,
  postbackUrl: string,
  postbackMethod: string,
  call: { id: string; twilioCallSid: string },
  payoutResult: PayoutResult
): Promise<void> {
  const postbackData = {
    event: 'call.completed',
    call_id: call.id,
    twilio_call_sid: call.twilioCallSid,
    payout_amount: payoutResult.affiliatePayout,
    buyer_charge: payoutResult.buyerCharge,
    is_billable: payoutResult.isBillable,
    timestamp: new Date().toISOString(),
  };

  const startTime = Date.now();
  let response: Response | null = null;
  let responseText: string | null = null;
  let success = false;

  try {
    const method = postbackMethod.toUpperCase() === 'GET' ? 'GET' : 'POST';

    if (method === 'GET') {
      const url = new URL(postbackUrl);
      Object.entries(postbackData).forEach(([key, value]) => {
        url.searchParams.set(key, String(value));
      });
      response = await fetch(url.toString(), {
        method: 'GET',
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });
    } else {
      response = await fetch(postbackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postbackData),
        signal: AbortSignal.timeout(10000),
      });
    }

    responseText = await response.text();
    success = response.ok;

    logger.info({
      event: 'completion.postback_sent',
      message: `Postback ${success ? 'succeeded' : 'failed'}`,
      callId,
      postbackUrl,
      method,
      statusCode: response.status,
      durationMs: Date.now() - startTime,
    });
  } catch (error) {
    logger.warn({
      event: 'completion.postback_error',
      message: 'Postback request failed',
      callId,
      postbackUrl,
      error: (error as Error).message,
      durationMs: Date.now() - startTime,
    });
    responseText = (error as Error).message;
  }

  // Update call record with postback status
  try {
    await prisma.call.update({
      where: { id: callId },
      data: {
        postbackSent: true,
        postbackSentAt: new Date(),
        postbackResponse: responseText?.substring(0, 1000) || null, // Limit response length
      },
    });
  } catch (updateError) {
    logger.warn({
      event: 'completion.postback_update_failed',
      message: 'Failed to update postback status',
      callId,
      error: (updateError as Error).message,
    });
  }
}

/**
 * WHY: Send admin email notification for completed calls.
 * WHEN: After call completion is processed.
 * HOW: Gather call data and send via admin-email-service.
 */
async function sendCallAuctionEmailNotification(
  call: CallWithCampaign,
  callId: string,
  parsedPayload: {
    connectedDurationSeconds: number;
    disposition: string;
  },
  payoutResult: PayoutResult
): Promise<void> {
  // Fetch full call data with bids for email
  const fullCall = await prisma.call.findUnique({
    where: { id: callId },
    include: {
      serviceType: { select: { name: true, displayName: true } },
      bids: {
        orderBy: [{ bidAmount: 'desc' }, { responseTimeMs: 'asc' }],
        include: { buyer: { select: { name: true } } },
      },
    },
  });

  if (!fullCall) return;

  const emailData: CallAuctionEmailData = {
    callId: fullCall.id,
    callSid: fullCall.twilioCallSid,
    serviceType: fullCall.serviceType?.displayName || fullCall.serviceType?.name || 'Unknown',
    callerZip: fullCall.callerZip || 'Unknown',
    callerPhone: fullCall.callerPhone,
    callerState: fullCall.callerState || undefined,
    status: payoutResult.isBillable ? 'CONNECTED' : 'NO_ANSWER',
    participantCount: fullCall.bids.length,
    bids: fullCall.bids.map((bid) => ({
      buyerId: bid.buyerId,
      buyerName: bid.buyer?.name || 'Unknown',
      bidAmount: bid.bidAmount.toNumber(),
      responseTimeMs: bid.responseTimeMs || 0,
      isWinner: bid.buyerId === fullCall.winningBuyerId,
      transferNumber: bid.transferNumber || undefined,
    })),
    winningBuyerId: fullCall.winningBuyerId || undefined,
    winningBuyerName: fullCall.bids.find((b) => b.buyerId === fullCall.winningBuyerId)?.buyer?.name,
    winningBidAmount: fullCall.winningBid?.toNumber(),
    callDurationSeconds: parsedPayload.connectedDurationSeconds,
    billableDurationSeconds: payoutResult.isBillable ? parsedPayload.connectedDurationSeconds : undefined,
    failureReason: payoutResult.reason,
    createdAt: fullCall.createdAt,
    auctionCompletedAt: fullCall.auctionCompletedAt || new Date(),
  };

  await sendCallAuctionEmail(emailData);
}

/**
 * GET handler - used for Twilio webhook configuration testing
 *
 * WHY: Twilio tries to GET the webhook URL during configuration.
 * WHEN: When admin sets up webhook URL in Twilio console.
 * HOW: Return 200 with helpful message.
 */
export async function GET() {
  return createWebhookErrorResponse(
    'Call completion webhook endpoint. Configure in Twilio console.',
    false
  );
}
