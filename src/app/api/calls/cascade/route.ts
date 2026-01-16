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
 *   2. If answered → call completed successfully
 *   3. If not answered → get next buyer from ranked bids
 *   4. If more buyers available → return TwiML to dial next buyer
 *   5. If cascade exhausted → play rejection message
 *
 * CASCADE LIMITS (from spec):
 * - MAX_CASCADE_DEPTH = 3 (max 3 buyers tried)
 * - MAX_CASCADE_TIME_MS = 8000 (8 seconds total)
 *
 * CALL FLOW:
 * +----------------------------------------------------------------------+
 * |  First transfer (position 0) → Dial winner                           |
 * |      |                                                               |
 * |  [ANSWERED] Call connected → /api/calls/completed handles it         |
 * |  [NO_ANSWER] Cascade → Try next buyer (position 1)                   |
 * |      |                                                               |
 * |  Second attempt (position 1) → Dial second-place buyer               |
 * |  [NO_ANSWER] Cascade → Try next buyer (position 2)                   |
 * |      |                                                               |
 * |  Third attempt (position 2) → Dial third-place buyer                 |
 * |  [NO_ANSWER] Cascade exhausted → Play rejection, hangup              |
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

// =====================================
// CONSTANTS
// =====================================

/**
 * WHY: Maximum number of buyers to try before giving up.
 * WHEN: Checking if cascade should continue.
 */
const MAX_CASCADE_DEPTH = 3;

/**
 * WHY: Maximum total time for cascade attempts.
 * WHEN: Checking if caller has waited too long.
 * Note: Caller patience is ~8-10 seconds total.
 */
const MAX_CASCADE_TIME_MS = 8000;

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
}

/**
 * WHY: Map database bid record to RankedBid interface.
 * WHEN: After loading bids from database.
 * HOW: Extracts buyer name and converts Decimal to number.
 */
function mapBidToRankedBid(bid: {
  buyerId: string;
  bidAmount: Prisma.Decimal;
  transferNumber: string | null;
  bidStatus: string;
  buyer: { name: string };
}): RankedBid | null {
  if (!bid.transferNumber) {
    return null;
  }
  return {
    buyerId: bid.buyerId,
    buyerName: bid.buyer.name,
    bidAmount: bid.bidAmount.toNumber(),
    transferNumber: bid.transferNumber,
    bidStatus: bid.bidStatus,
  };
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
      // Step 3: Load call record
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
            include: {
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

      // If call was answered, it's being handled by /api/calls/completed
      if (dialStatus === 'completed') {
        logger.info({
          event: 'cascade.completed',
          message: 'Dial completed, call was answered',
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

        // The /api/calls/completed handler will update the call record
        return createTwimlResponse(buildEmptyResponse());
      }

      // ─────────────────────────────────────────────────────────────
      // Step 5: Check cascade limits
      // ─────────────────────────────────────────────────────────────
      const nextPosition = position + 1;

      // Check depth limit
      if (nextPosition >= MAX_CASCADE_DEPTH) {
        logger.info({
          event: 'cascade.depth_exceeded',
          message: 'Max cascade depth reached, no more attempts',
          callId,
          callSid,
          position,
          maxDepth: MAX_CASCADE_DEPTH,
        });

        await handleCascadeExhausted(callId, callSid, 'depth_exceeded', position);
        await markWebhookProcessed(callSid, idempotencyKey, undefined, {
          result: 'depth_exceeded',
          position,
        });

        return createTwimlResponse(
          buildRejection('We\'re sorry, no specialists are available at this time. Please try again later.')
        );
      }

      // Check time limit
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
      // Step 6: Get next buyer in ranking
      // ─────────────────────────────────────────────────────────────

      // Map database bids to RankedBid interface and filter out current winner
      const availableBids: RankedBid[] = call.bids
        .filter((bid) => bid.buyerId !== call.winningBuyerId)
        .map(mapBidToRankedBid)
        .filter((bid): bid is RankedBid => bid !== null);

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
        message: `Cascade attempting buyer ${nextPosition + 1}/${MAX_CASCADE_DEPTH}`,
        callId,
        callSid,
        position: nextPosition,
        buyerId: nextBid.buyerId,
        buyerName: nextBid.buyerName,
        bidAmount: nextBid.bidAmount,
      });

      return createTwimlResponse(
        buildCascadeTransfer(
          nextBid.transferNumber,
          call.callerPhone,
          nextPosition,
          callId,
          { record: true, timeout: 25 }
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
      `Cascade attempt ${position + 1}/${MAX_CASCADE_DEPTH}: ${nextBid.buyerName}`,
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
          maxDepth: MAX_CASCADE_DEPTH,
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
  } catch (error) {
    logger.error('Failed to handle cascade exhaustion', {
      callId,
      reason,
      error: (error as Error).message,
    });
  }
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
