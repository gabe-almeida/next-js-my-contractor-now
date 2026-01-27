/**
 * Cascade Webhook Handler
 *
 * WHY: Handle call cascade when the winning buyer doesn't answer.
 *      Attempts to connect caller with the next buyer in the ranked list.
 *
 * WHEN: Twilio calls this endpoint after a <Dial> action completes
 *       (either buyer answered, no answer, busy, or failed).
 *
 * HOW:
 *   1. Parse dial status from Twilio (completed, no-answer, busy, failed)
 *   2. If answered → forward to /api/calls/completed for payout processing
 *   3. If not answered → get next buyer from ranked bids (filter expired)
 *   4. If more buyers available → return TwiML to dial next buyer
 *   5. If all buyers exhausted or time limit reached → play rejection message
 *
 * CASCADE LIMITS:
 * - Try ALL valid bidders (no arbitrary depth limit)
 * - MAX_CASCADE_TIME_MS = 90000 (90 seconds total, ~9 attempts at 10s each)
 * - Filter out expired bids (check buyer's TTL from PING response)
 * - DIAL_TIMEOUT_SECONDS = 10 (industry standard for fast rerouting)
 *
 * CALL FLOW:
 * +----------------------------------------------------------------------+
 * |  First transfer (position 0) → Dial winner                           |
 * |      |                                                               |
 * |  [ANSWERED] Call connected → forward to /api/calls/completed         |
 * |  [NO_ANSWER] Cascade → Try next buyer (position 1)                   |
 * |      |                                                               |
 * |  Continue trying all bidders until:                                  |
 * |    - Someone answers                                                 |
 * |    - All bidders exhausted                                           |
 * |    - Total time exceeds 90 seconds                                   |
 * |    - Remaining bids have expired                                     |
 * +----------------------------------------------------------------------+
 */

import { NextRequest } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import {
  withTwilioVerification,
  createTwimlResponse,
  createWebhookErrorResponse,
} from '@/lib/twilio/verify-signature';
import { isWebhookProcessed, markWebhookProcessed, markWebhookFailed } from '@/lib/twilio/idempotency';
import { logWebhookReceived, createCallActivityLog, logCallStateChange } from '@/lib/twilio/logging';
import { buildCascadeTransfer, buildRejection, buildEmptyResponse } from '@/lib/twilio/twiml-builder';
import { type CallStatus } from '@/lib/twilio/state-machine';
import { Prisma } from '@prisma/client';
import { sendCallAuctionEmail, CallAuctionEmailData } from '@/lib/services/admin-email-service';

// =====================================
// CONSTANTS
// =====================================

/**
 * WHY: Maximum total time for all cascade attempts combined.
 * WHEN: Checking if caller has waited too long.
 * HOW: With 10-second ring timeout per attempt, 90 seconds allows ~9 attempts.
 *      Industry standard is to try all bidders, limited by caller patience.
 *
 * Note: We no longer use a fixed MAX_CASCADE_DEPTH. Instead, we try ALL
 * valid bidders until someone answers, all are exhausted, or time runs out.
 */
const MAX_CASCADE_TIME_MS = 90000; // 90 seconds total

/**
 * WHY: Ring timeout per dial attempt.
 * WHEN: Building TwiML for cascade transfer.
 * HOW: Industry standard is 5-10 seconds. Shorter = faster rerouting.
 */
const DIAL_TIMEOUT_SECONDS = 10;

// =====================================
// TYPE DEFINITIONS
// =====================================

/**
 * Twilio webhook payload for dial action callback
 */
interface TwilioCascadePayload {
  CallSid: string;
  DialCallSid?: string;
  DialCallStatus: 'completed' | 'no-answer' | 'busy' | 'failed' | 'canceled';
  DialCallDuration?: string;
  From: string;
  To: string;
  CallStatus?: string;
  RecordingUrl?: string;
  RecordingSid?: string;
}

/**
 * Call bid for cascade ranking
 */
interface RankedBid {
  buyerId: string;
  buyerName: string;
  bidAmount: number;
  transferNumber: string;
  bidStatus: string;
  expiresAt: Date | null;
}

/**
 * WHY: Map database bid record to RankedBid interface.
 * WHEN: After loading bids from database.
 * HOW: Extracts buyer name, converts Decimal to number, parses expiresAt from pingResponse.
 */
function mapBidToRankedBid(bid: {
  buyerId: string;
  bidAmount: Prisma.Decimal;
  transferNumber: string | null;
  bidStatus: string;
  pingResponse: unknown;
  buyer: { name: string };
}): RankedBid | null {
  if (!bid.transferNumber) {
    return null;
  }

  // Parse expiresAt from pingResponse JSON if available
  let expiresAt: Date | null = null;
  if (bid.pingResponse && typeof bid.pingResponse === 'object') {
    const response = bid.pingResponse as Record<string, unknown>;
    if (response.expiresAt) {
      expiresAt = new Date(response.expiresAt as string);
    } else if (response.expireInSeconds) {
      // Calculate from creation time + TTL (fallback)
      const ttlSeconds = Number(response.expireInSeconds);
      if (!isNaN(ttlSeconds)) {
        // Estimate based on bid creation - this is approximate
        expiresAt = new Date(Date.now() + ttlSeconds * 1000);
      }
    }
  }

  return {
    buyerId: bid.buyerId,
    buyerName: bid.buyer.name,
    bidAmount: bid.bidAmount.toNumber(),
    transferNumber: bid.transferNumber,
    bidStatus: bid.bidStatus,
    expiresAt,
  };
}

/**
 * WHY: Check if a bid has expired.
 * WHEN: Before attempting to dial a buyer.
 * HOW: Compare expiresAt to current time.
 */
function isBidExpired(bid: RankedBid): boolean {
  if (!bid.expiresAt) {
    return false; // No expiration = never expires (contractors)
  }
  return new Date() > bid.expiresAt;
}

// =====================================
// MAIN HANDLER
// =====================================

export async function POST(request: NextRequest) {
  return withTwilioVerification(request, async (body) => {
    const payload = body as unknown as TwilioCascadePayload;
    const callSid = payload.CallSid;
    const dialStatus = payload.DialCallStatus;
    const searchParams = request.nextUrl.searchParams;
    const callId = searchParams.get('callId');
    const position = parseInt(searchParams.get('position') || '0', 10);

    // Log webhook receipt
    logWebhookReceived({
      callSid,
      eventType: 'cascade',
      eventStatus: dialStatus,
      payload: body,
      source: 'transfer',
    });

    // Add Sentry context
    Sentry.setTag('callSid', callSid);
    Sentry.setTag('callId', callId || 'unknown');
    Sentry.setTag('cascadePosition', position.toString());
    Sentry.setTag('dialStatus', dialStatus);

    try {
      // ─────────────────────────────────────────────────────────────
      // Step 1: Validate call ID
      // ─────────────────────────────────────────────────────────────
      if (!callId) {
        logger.error({
          event: 'cascade.missing_call_id',
          message: 'Cascade webhook received without callId',
          callSid,
        });
        return createTwimlResponse(
          buildRejection('An error occurred. Please try again later.')
        );
      }

      // ─────────────────────────────────────────────────────────────
      // Step 2: Idempotency check
      // ─────────────────────────────────────────────────────────────
      const idempotencyKey = `cascade_${position}`;
      const isProcessed = await isWebhookProcessed(idempotencyKey, callSid);

      if (isProcessed) {
        logger.info({
          event: 'cascade.duplicate',
          message: 'Duplicate cascade webhook, skipping',
          callId,
          callSid,
          position,
        });
        return createTwimlResponse(buildEmptyResponse());
      }

      // ─────────────────────────────────────────────────────────────
      // Step 3: Load call record with all valid bids
      // ─────────────────────────────────────────────────────────────
      const call = await prisma.call.findUnique({
        where: { id: callId },
        include: {
          bids: {
            where: {
              bidStatus: { in: ['PENDING', 'REJECTED'] },
              bidAmount: { gt: 0 },
              transferNumber: { not: null },
            },
            orderBy: [
              { bidAmount: 'desc' },
              { responseTimeMs: 'asc' },
            ],
            select: {
              buyerId: true,
              bidAmount: true,
              transferNumber: true,
              bidStatus: true,
              pingResponse: true, // Contains expiresAt for expiration check
              buyer: {
                select: { name: true },
              },
            },
          },
        },
      });

      if (!call) {
        logger.error({
          event: 'cascade.call_not_found',
          message: 'Call record not found for cascade',
          callId,
          callSid,
        });
        await markWebhookFailed(callSid, idempotencyKey, undefined, 'Call not found');
        return createTwimlResponse(
          buildRejection('An error occurred. Please try again later.')
        );
      }

      // ─────────────────────────────────────────────────────────────
      // Step 4: Handle dial status
      // ─────────────────────────────────────────────────────────────
      logger.info({
        event: 'cascade.received',
        message: `Cascade callback received: ${dialStatus}`,
        callId,
        callSid,
        position,
        dialStatus,
        dialDuration: payload.DialCallDuration,
      });

      // If call was answered and completed, forward to completed handler for payout processing
      if (dialStatus === 'completed') {
        logger.info({
          event: 'cascade.completed',
          message: 'Dial completed, call was answered - forwarding to completed handler',
          callId,
          callSid,
          position,
          duration: payload.DialCallDuration,
        });

        await markWebhookProcessed(callSid, idempotencyKey, undefined, {
          result: 'completed',
          position,
          dialStatus,
        });

        // Forward the request to the completed handler by making an internal call
        // The completed handler will calculate payouts and finalize the call
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.BASE_URL;
        try {
          await fetch(`${baseUrl}/api/calls/completed?callId=${callId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(body as Record<string, string>).toString(),
          });
        } catch (error) {
          logger.error({
            event: 'cascade.forward_error',
            message: 'Failed to forward to completed handler',
            callId,
            error: (error as Error).message,
          });
        }

        return createTwimlResponse(buildEmptyResponse());
      }

      // ─────────────────────────────────────────────────────────────
      // Step 5: Check cascade time limit
      // ─────────────────────────────────────────────────────────────
      const nextPosition = position + 1;

      // Check time limit (no longer using arbitrary depth limit - try all bidders)
      const cascadeStartTime = call.auctionCompletedAt || call.createdAt;
      const elapsedMs = Date.now() - cascadeStartTime.getTime();
      if (elapsedMs > MAX_CASCADE_TIME_MS) {
        logger.info({
          event: 'cascade.time_exceeded',
          message: 'Max cascade time reached, no more attempts',
          callId,
          callSid,
          position,
          elapsedMs,
          maxMs: MAX_CASCADE_TIME_MS,
        });

        await handleCascadeExhausted(callId, callSid, 'time_exceeded', position);
        await markWebhookProcessed(callSid, idempotencyKey, undefined, {
          result: 'time_exceeded',
          position,
          elapsedMs,
        });

        return createTwimlResponse(
          buildRejection('We\'re sorry, no specialists are available at this time. Please try again later.')
        );
      }

      // ─────────────────────────────────────────────────────────────
      // Step 6: Get next buyer in ranking (filter expired bids)
      // ─────────────────────────────────────────────────────────────

      // Map database bids to RankedBid interface, filter out:
      // - Current winner (already tried)
      // - Expired bids (TTL from buyer's PING response)
      const availableBids: RankedBid[] = call.bids
        .filter((bid) => bid.buyerId !== call.winningBuyerId)
        .map(mapBidToRankedBid)
        .filter((bid): bid is RankedBid => bid !== null)
        .filter((bid) => !isBidExpired(bid)); // Filter out expired bids

      // Log if any bids were filtered due to expiration
      const expiredCount = call.bids.length - availableBids.length - 1; // -1 for winner
      if (expiredCount > 0) {
        logger.info({
          event: 'cascade.expired_bids_filtered',
          message: `Filtered ${expiredCount} expired bids from cascade pool`,
          callId,
          expiredCount,
        });
      }

      // Skip buyers we've already tried (based on position)
      const nextBid = availableBids[position];

      if (!nextBid || !nextBid.transferNumber) {
        logger.info({
          event: 'cascade.no_more_buyers',
          message: 'No more buyers available for cascade',
          callId,
          callSid,
          position,
          availableBids: availableBids.length,
          totalBids: call.bids.length,
        });

        await handleCascadeExhausted(callId, callSid, 'no_more_buyers', position);
        await markWebhookProcessed(callSid, idempotencyKey, undefined, {
          result: 'no_more_buyers',
          position,
        });

        return createTwimlResponse(
          buildRejection('We\'re sorry, no specialists are available at this time. Please try again later.')
        );
      }

      // ─────────────────────────────────────────────────────────────
      // Step 7: Update call for cascade attempt
      // ─────────────────────────────────────────────────────────────
      await updateCallForCascade(callId, nextPosition, nextBid);

      // Log the cascade attempt
      await logCascadeAttempt(callId, callSid, nextPosition, nextBid, dialStatus);

      // ─────────────────────────────────────────────────────────────
      // Step 8: Return TwiML to dial next buyer
      // ─────────────────────────────────────────────────────────────
      await markWebhookProcessed(callSid, idempotencyKey, undefined, {
        result: 'cascade_next',
        position: nextPosition,
        nextBuyerId: nextBid.buyerId,
        nextBuyerName: nextBid.buyerName,
      });

      logger.info({
        event: 'cascade.attempting_next',
        message: `Cascade attempting buyer ${nextPosition + 1}/${availableBids.length + 1}`,
        callId,
        callSid,
        position: nextPosition,
        buyerId: nextBid.buyerId,
        buyerName: nextBid.buyerName,
        bidAmount: nextBid.bidAmount,
        remainingBidders: availableBids.length - position - 1,
      });

      return createTwimlResponse(
        buildCascadeTransfer(
          nextBid.transferNumber,
          call.callerPhone,
          nextPosition,
          callId,
          { record: true, timeout: DIAL_TIMEOUT_SECONDS }
        )
      );
    } catch (error) {
      logger.error({
        event: 'cascade.error',
        message: 'Error handling cascade webhook',
        callId,
        callSid,
        position,
        error: (error as Error).message,
        stack: (error as Error).stack,
      });

      Sentry.captureException(error, {
        tags: { component: 'cascade-webhook' },
        extra: { callId, callSid, position, dialStatus },
      });

      await markWebhookFailed(callSid, `cascade_${position}`, undefined, (error as Error).message);

      return createTwimlResponse(
        buildRejection('We\'re sorry, we\'re experiencing technical difficulties. Please try your call again later.')
      );
    }
  });
}

// =====================================
// HELPER FUNCTIONS
// =====================================

/**
 * WHY: Update call record for cascade attempt.
 * WHEN: Before dialing next buyer in cascade.
 * HOW: Update cascade position, status, and potentially winning buyer.
 */
async function updateCallForCascade(
  callId: string,
  position: number,
  nextBid: RankedBid
): Promise<void> {
  try {
    // Use transaction to ensure atomic update
    await prisma.$transaction(async (tx) => {
      // Get current call for version check
      const call = await tx.call.findUnique({
        where: { id: callId },
        select: { version: true, status: true },
      });

      if (!call) {
        throw new Error('Call not found for cascade update');
      }

      // Validate state transition
      const validCascadeStates: CallStatus[] = ['CONNECTING', 'CASCADING'];
      if (!validCascadeStates.includes(call.status as CallStatus)) {
        logger.warn('Unexpected call status for cascade', {
          callId,
          status: call.status,
          expectedStates: validCascadeStates,
        });
        // Continue anyway - the call may be in a valid cascading state
      }

      // Update call with new cascade position and buyer
      await tx.call.update({
        where: { id: callId, version: call.version },
        data: {
          status: 'CASCADING',
          previousStatus: call.status,
          statusChangedAt: new Date(),
          cascadePosition: position,
          cascadeAttempts: { increment: 1 },
          winningBuyerId: nextBid.buyerId,
          winningBid: new Prisma.Decimal(nextBid.bidAmount),
          transferPhoneNumber: nextBid.transferNumber,
          version: { increment: 1 },
        },
      });

      // Update bid status
      await tx.callBid.update({
        where: { callId_buyerId: { callId, buyerId: nextBid.buyerId } },
        data: { bidStatus: 'ACCEPTED' },
      });
    });
  } catch (error) {
    logger.error('Failed to update call for cascade', {
      callId,
      position,
      buyerId: nextBid.buyerId,
      error: (error as Error).message,
    });
    throw error;
  }
}

/**
 * WHY: Log cascade attempt to activity log.
 * WHEN: Before dialing next buyer.
 * HOW: Create activity log entry with cascade details.
 */
async function logCascadeAttempt(
  callId: string,
  callSid: string,
  position: number,
  nextBid: RankedBid,
  previousDialStatus: string
): Promise<void> {
  try {
    // Log activity
    await createCallActivityLog(
      callId,
      'cascade.attempting',
      `Cascade attempt #${position + 1}: ${nextBid.buyerName} ($${nextBid.bidAmount.toFixed(2)})`,
      {
        level: 'info',
        details: {
          position,
          buyerId: nextBid.buyerId,
          buyerName: nextBid.buyerName,
          bidAmount: nextBid.bidAmount,
          previousDialStatus,
        },
        visibleToAffiliate: true,
        visibleToAdmin: true,
      }
    );

    logCallStateChange(
      callId,
      callSid,
      'CONNECTING',
      'CASCADING',
      `Cascade to ${nextBid.buyerName} (position ${position})`
    );
  } catch (error) {
    logger.error('Failed to log cascade attempt', {
      callId,
      position,
      error: (error as Error).message,
    });
    // Don't throw - logging failure shouldn't break cascade
  }
}

/**
 * WHY: Handle cascade exhaustion (all buyers tried or limits reached).
 * WHEN: No more buyers available or limits exceeded.
 * HOW: Update call status and log final outcome.
 */
async function handleCascadeExhausted(
  callId: string,
  callSid: string,
  reason: 'depth_exceeded' | 'time_exceeded' | 'no_more_buyers',
  finalPosition: number
): Promise<void> {
  try {
    await prisma.call.update({
      where: { id: callId },
      data: {
        status: 'FAILED',
        previousStatus: 'CASCADING',
        statusChangedAt: new Date(),
        endedAt: new Date(),
        disposition: 'NO_ANSWER',
        hangupReason: `CASCADE_EXHAUSTED_${reason.toUpperCase()}`,
      },
    });

    // Mark all remaining bids as expired
    await prisma.callBid.updateMany({
      where: {
        callId,
        bidStatus: { in: ['PENDING', 'REJECTED'] },
      },
      data: { bidStatus: 'EXPIRED' },
    });

    logCallStateChange(
      callId,
      callSid,
      'CASCADING',
      'FAILED',
      `Cascade exhausted: ${reason}`
    );

    await createCallActivityLog(
      callId,
      'cascade.exhausted',
      `All transfer attempts failed (${reason.replace(/_/g, ' ')})`,
      {
        level: 'warn',
        details: {
          reason,
          finalPosition,
          totalAttempts: finalPosition + 1,
        },
        visibleToAffiliate: true,
        visibleToAdmin: true,
      }
    );

    logger.info({
      event: 'cascade.exhausted',
      message: 'Cascade exhausted, no successful connection',
      callId,
      callSid,
      reason,
      finalPosition,
    });

    // Send admin email notification (fire-and-forget)
    sendCascadeExhaustedEmail(callId, reason, finalPosition).catch((error) => {
      logger.warn({
        event: 'cascade.email_error',
        message: 'Failed to send cascade exhausted email',
        callId,
        error: (error as Error).message,
      });
    });
  } catch (error) {
    logger.error('Failed to handle cascade exhaustion', {
      callId,
      reason,
      error: (error as Error).message,
    });
  }
}

/**
 * WHY: Send admin email notification when cascade is exhausted.
 * WHEN: All buyers tried or time limit reached.
 * HOW: Gather call data and send via admin-email-service.
 */
async function sendCascadeExhaustedEmail(
  callId: string,
  reason: string,
  finalPosition: number
): Promise<void> {
  const call = await prisma.call.findUnique({
    where: { id: callId },
    include: {
      serviceType: { select: { name: true, displayName: true } },
      bids: {
        orderBy: [{ bidAmount: 'desc' }, { responseTimeMs: 'asc' }],
        include: { buyer: { select: { name: true } } },
      },
    },
  });

  if (!call) return;

  const emailData: CallAuctionEmailData = {
    callId: call.id,
    callSid: call.twilioCallSid,
    serviceType: call.serviceType?.displayName || call.serviceType?.name || 'Unknown',
    callerZip: call.callerZip || 'Unknown',
    callerPhone: call.callerPhone,
    callerState: call.callerState || undefined,
    status: 'NO_ANSWER',
    participantCount: call.bids.length,
    bids: call.bids.map((bid) => ({
      buyerId: bid.buyerId,
      buyerName: bid.buyer?.name || 'Unknown',
      bidAmount: bid.bidAmount.toNumber(),
      responseTimeMs: bid.responseTimeMs || 0,
      isWinner: bid.buyerId === call.winningBuyerId,
      transferNumber: bid.transferNumber || undefined,
    })),
    winningBuyerId: call.winningBuyerId || undefined,
    winningBuyerName: call.bids.find((b) => b.buyerId === call.winningBuyerId)?.buyer?.name,
    winningBidAmount: call.winningBid?.toNumber(),
    failureReason: `Cascade exhausted: ${reason.replace(/_/g, ' ')} after ${finalPosition + 1} attempts`,
    createdAt: call.createdAt,
    auctionCompletedAt: new Date(),
  };

  await sendCallAuctionEmail(emailData);
}

/**
 * GET handler - used for Twilio webhook configuration testing
 */
export async function GET() {
  return createWebhookErrorResponse(
    'Cascade webhook endpoint. Configure in Twilio console.',
    false
  );
}
