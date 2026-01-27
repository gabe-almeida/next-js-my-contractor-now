/**
 * Auction Webhook Handler
 *
 * WHY: Run real-time auction after caller qualifies through IVR.
 *      This finds the best buyer (highest bid) and initiates transfer.
 *
 * WHEN: IVR handler redirects here after caller qualifies (presses 1).
 *       Also called during cascade (when first buyer doesn't answer).
 *
 * HOW:
 *   1. Verify call is in BIDDING state
 *   2. Run auction via CallAuctionEngine
 *   3. If winner found, build transfer TwiML
 *   4. If no bids, play rejection message
 *   5. Handle caller hangup gracefully
 *
 * CALL FLOW:
 * +----------------------------------------------------------------------+
 * |  IVR qualifies caller -> redirects to /api/calls/auction             |
 * |      |                                                               |
 * |  Call auction engine (finds eligible buyers, collects bids)          |
 * |      |                                                               |
 * |  [WINNER] Build transfer TwiML -> Dial winning buyer                 |
 * |  [NO_BIDS] Play "no specialists available" -> Hangup                 |
 * |  [HANGUP] Caller left -> Acknowledge and exit                        |
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
import { CallAuctionEngine, type CallAuctionResult } from '@/lib/auction/call-engine';
import { validateTransition, type CallStatus } from '@/lib/twilio/state-machine';

// =====================================
// TYPE DEFINITIONS
// =====================================

/**
 * Twilio webhook payload during auction redirect
 */
interface TwilioAuctionPayload {
  CallSid: string;
  From: string;
  To: string;
  CallStatus?: string;
  AccountSid?: string;
}

// =====================================
// MAIN HANDLER
// =====================================

export async function POST(request: NextRequest) {
  return withTwilioVerification(request, async (body) => {
    const payload = body as unknown as TwilioAuctionPayload;
    const callSid = payload.CallSid;
    const searchParams = request.nextUrl.searchParams;
    const callId = searchParams.get('callId');
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.BASE_URL;

    // Log webhook receipt
    logWebhookReceived({
      callSid,
      eventType: 'auction_start',
      eventStatus: payload.CallStatus,
      payload: body,
      source: 'transfer', // Using 'transfer' since there's no 'auction' source type
    });

    // Add Sentry context
    Sentry.setTag('callSid', callSid);
    Sentry.setTag('callId', callId || 'unknown');

    try {
      // ─────────────────────────────────────────────────────────────
      // Step 1: Validate call ID
      // ─────────────────────────────────────────────────────────────
      if (!callId) {
        logger.error({
          event: 'auction.missing_call_id',
          message: 'Auction webhook received without callId',
          callSid,
        });
        return createTwimlResponse(
          buildRejection('An error occurred. Please try again later.')
        );
      }

      // ─────────────────────────────────────────────────────────────
      // Step 2: Idempotency check
      // ─────────────────────────────────────────────────────────────
      const isProcessed = await isWebhookProcessed('auction_start', callSid);

      if (isProcessed) {
        logger.info({
          event: 'auction.duplicate',
          message: 'Duplicate auction webhook, skipping',
          callId,
          callSid,
        });
        return createTwimlResponse(buildEmptyResponse());
      }

      // ─────────────────────────────────────────────────────────────
      // Step 3: Load call with campaign and tracking details
      // ─────────────────────────────────────────────────────────────
      const call = await prisma.call.findUnique({
        where: { id: callId },
        include: {
          campaign: {
            select: {
              id: true,
              name: true,
              minCallDuration: true,
            },
          },
          trackingNumber: {
            select: {
              id: true,
              phoneNumber: true,
            },
          },
          serviceType: {
            select: {
              id: true,
              name: true,
              displayName: true,
            },
          },
        },
      });

      if (!call) {
        logger.error({
          event: 'auction.call_not_found',
          message: 'Call record not found',
          callId,
          callSid,
        });
        await markWebhookFailed(callSid, 'auction_start', undefined, 'Call not found');
        return createTwimlResponse(
          buildRejection('An error occurred. Please try again later.')
        );
      }

      // ─────────────────────────────────────────────────────────────
      // Step 4: Verify call is in BIDDING state
      // ─────────────────────────────────────────────────────────────
      if (call.status !== 'BIDDING') {
        logger.warn({
          event: 'auction.invalid_state',
          message: `Call not in BIDDING state: ${call.status}`,
          callId,
          callSid,
          currentStatus: call.status,
        });

        await markWebhookProcessed(callSid, 'auction_start', undefined, {
          result: 'skipped',
          reason: 'invalid_state',
          currentStatus: call.status,
        });

        // If already completed or failed, just acknowledge
        return createTwimlResponse(buildEmptyResponse());
      }

      // Update auction start time
      await prisma.call.update({
        where: { id: callId },
        data: {
          auctionStartedAt: new Date(),
        },
      });

      logger.info({
        event: 'auction.started',
        message: 'Starting call auction',
        callId,
        callSid,
        serviceType: call.serviceType?.name,
        callerZip: call.callerZip,
      });

      // ─────────────────────────────────────────────────────────────
      // Step 5: Run auction
      // ─────────────────────────────────────────────────────────────
      const engine = new CallAuctionEngine();
      const result: CallAuctionResult = await engine.runCallAuction(callId);

      logger.info({
        event: 'auction.completed',
        message: `Auction completed: ${result.status}`,
        callId,
        callSid,
        status: result.status,
        eligibleBuyers: result.eligibleBuyersCount,
        auctionDurationMs: result.auctionDurationMs,
        hasWinner: !!result.winner,
        winnerBid: result.winner?.bidAmount,
      });

      // ─────────────────────────────────────────────────────────────
      // Step 6: Handle auction result
      // ─────────────────────────────────────────────────────────────

      // Handle caller hangup during auction
      if (result.status === 'caller_hangup' || result.callerAbandoned) {
        await handleCallerHangup(callId, callSid);
        await markWebhookProcessed(callSid, 'auction_start', undefined, {
          result: 'caller_hangup',
        });
        return createTwimlResponse(buildEmptyResponse());
      }

      // Handle no bids
      if (result.status === 'no_bids' || !result.winner) {
        await handleNoBids(callId, callSid);
        await markWebhookProcessed(callSid, 'auction_start', undefined, {
          result: 'no_bids',
          eligibleBuyers: result.eligibleBuyersCount,
        });
        return createTwimlResponse(
          buildRejection('We\'re sorry, no specialists are available at this time. Please try again later.')
        );
      }

      // ─────────────────────────────────────────────────────────────
      // Step 7: Build transfer TwiML for winner
      // ─────────────────────────────────────────────────────────────
      const winner = result.winner;

      // Ensure transfer number is available
      if (!winner.transferNumber) {
        logger.error({
          event: 'auction.missing_transfer_number',
          message: 'Winning buyer has no transfer number',
          callId,
          callSid,
          winnerId: winner.buyerId,
          winnerName: winner.buyerName,
        });

        await handleNoBids(callId, callSid);
        await markWebhookFailed(callSid, 'auction_start', undefined, 'Winner has no transfer number');
        return createTwimlResponse(
          buildRejection('We\'re sorry, we were unable to connect you. Please try again later.')
        );
      }

      // Log successful auction completion
      await createCallActivityLog(
        callId,
        'auction.winner_found',
        `Connecting to ${winner.buyerName} ($${winner.bidAmount.toFixed(2)})`,
        {
          level: 'info',
          details: {
            winnerId: winner.buyerId,
            winnerName: winner.buyerName,
            bidAmount: winner.bidAmount,
            responseTimeMs: winner.responseTimeMs,
            eligibleBuyers: result.eligibleBuyersCount,
          },
          visibleToAffiliate: true,
          visibleToAdmin: true,
        }
      );

      await markWebhookProcessed(callSid, 'auction_start', undefined, {
        result: 'winner_selected',
        winnerId: winner.buyerId,
        winnerBid: winner.bidAmount,
        eligibleBuyers: result.eligibleBuyersCount,
      });

      // Build transfer TwiML - use cascade endpoint so we can reroute if no answer
      // Position 0 = first transfer attempt (winner)
      return createTwimlResponse(
        buildCascadeTransfer(
          winner.transferNumber,
          call.callerPhone, // Pass through original caller ID
          0, // Position 0 = first attempt
          callId,
          {
            record: true,
            timeout: 10, // 10 second ring timeout - industry standard for fast rerouting
          }
        )
      );

    } catch (error) {
      logger.error({
        event: 'auction.error',
        message: 'Error running call auction',
        callId,
        callSid,
        error: (error as Error).message,
        stack: (error as Error).stack,
      });

      Sentry.captureException(error, {
        tags: { component: 'auction-webhook' },
        extra: { callId, callSid },
      });

      await markWebhookFailed(callSid, 'auction_start', undefined, (error as Error).message);

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
 * WHY: Update call record when caller hangs up during auction.
 * WHEN: Auction engine detects caller is no longer on line.
 * HOW: Update status to CALLER_HANGUP and log event.
 */
async function handleCallerHangup(callId: string, callSid: string): Promise<void> {
  try {
    validateTransition('BIDDING' as CallStatus, 'CALLER_HANGUP' as CallStatus);

    await prisma.call.update({
      where: { id: callId },
      data: {
        status: 'CALLER_HANGUP',
        previousStatus: 'BIDDING',
        statusChangedAt: new Date(),
        endedAt: new Date(),
        hangupReason: 'CALLER_ABANDONED_DURING_AUCTION',
        abandonmentPhase: 'auction',
        abandonmentReason: 'Caller hung up while waiting for auction to complete',
      },
    });

    logCallStateChange(callId, callSid, 'BIDDING', 'CALLER_HANGUP', 'Caller abandoned during auction');

    await createCallActivityLog(
      callId,
      'call.caller_hangup',
      'Caller hung up during specialist search',
      {
        level: 'warn',
        details: { phase: 'auction' },
        visibleToAffiliate: true,
        visibleToAdmin: true,
      }
    );

    logger.info({
      event: 'auction.caller_hangup',
      message: 'Caller hung up during auction',
      callId,
      callSid,
    });
  } catch (error) {
    logger.error({
      event: 'auction.handle_hangup_error',
      message: 'Error handling caller hangup',
      callId,
      callSid,
      error: (error as Error).message,
    });
  }
}

/**
 * WHY: Update call record when no buyers bid or are available.
 * WHEN: Auction completes with no valid bids.
 * HOW: Update status to NO_BIDS and log event.
 */
async function handleNoBids(callId: string, callSid: string): Promise<void> {
  try {
    validateTransition('BIDDING' as CallStatus, 'NO_BIDS' as CallStatus);

    await prisma.call.update({
      where: { id: callId },
      data: {
        status: 'NO_BIDS',
        previousStatus: 'BIDDING',
        statusChangedAt: new Date(),
        endedAt: new Date(),
        auctionCompletedAt: new Date(),
        hangupReason: 'NO_BUYERS_AVAILABLE',
      },
    });

    logCallStateChange(callId, callSid, 'BIDDING', 'NO_BIDS', 'No buyers available');

    await createCallActivityLog(
      callId,
      'call.no_bids',
      'No specialists available for this call',
      {
        level: 'warn',
        details: { reason: 'No eligible buyers or all bids failed' },
        visibleToAffiliate: true,
        visibleToAdmin: true,
      }
    );

    logger.info({
      event: 'auction.no_bids',
      message: 'Auction completed with no bids',
      callId,
      callSid,
    });
  } catch (error) {
    logger.error({
      event: 'auction.handle_no_bids_error',
      message: 'Error handling no bids',
      callId,
      callSid,
      error: (error as Error).message,
    });
  }
}

/**
 * GET handler - used for Twilio webhook configuration testing
 */
export async function GET() {
  return createWebhookErrorResponse(
    'Auction webhook endpoint. Configure in Twilio console.',
    false
  );
}
