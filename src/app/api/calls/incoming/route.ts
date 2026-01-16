/**
 * Incoming Call Webhook Handler
 *
 * WHY: Entry point for all inbound calls to our tracking numbers.
 *      Twilio sends a webhook here when a call is received.
 *      This is the first handler in the call flow pipeline.
 *
 * WHEN: Twilio triggers this when any tracking number is dialed.
 *       Typically milliseconds after caller dials the number.
 *
 * HOW:
 *   1. Verify Twilio signature (security)
 *   2. Check idempotency (prevent duplicate processing)
 *   3. Lookup tracking number to identify affiliate/campaign
 *   4. Check campaign eligibility (active, hours, caps)
 *   5. Create call record in database (status: RINGING)
 *   6. Return appropriate TwiML (IVR or proceed to auction)
 *
 * CALL FLOW:
 * +-------------------------------------------------------------------------+
 * |  Caller dials tracking number                                           |
 * |      |                                                                  |
 * |  Twilio sends webhook to /api/calls/incoming  <- YOU ARE HERE           |
 * |      |                                                                  |
 * |  [If IVR] Return IVR TwiML -> /api/calls/ivr handles response           |
 * |  [If no IVR] Return hold TwiML -> /api/calls/auction                    |
 * +-------------------------------------------------------------------------+
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
import { logWebhookReceived, createCallActivityLog } from '@/lib/twilio/logging';
import {
  buildIvrGather,
  buildOptimizedHold,
  buildRejection,
} from '@/lib/twilio/twiml-builder';
import { getTrackingNumberByPhone } from '@/lib/services/tracking-number-queries';
import {
  checkCampaignEligibility,
  incrementCallCounter,
  CampaignForEligibility,
} from '@/lib/services/call-eligibility-service';
import { maskPhone, formatPhoneDisplay, HoursOfOperation } from '@/lib/call/call-helpers';

// =====================================
// TYPE DEFINITIONS
// =====================================

/**
 * Twilio webhook payload for incoming calls
 * These are the fields Twilio sends in the form data
 */
interface TwilioIncomingPayload {
  CallSid: string; // Unique call ID from Twilio
  From: string; // Caller phone (+15551234567)
  To: string; // Our tracking number (+18445551234)
  FromCity?: string; // Caller city (if available)
  FromState?: string; // Caller state (if available)
  FromZip?: string; // Caller ZIP (if available)
  CallerName?: string; // CNAM lookup (if available)
  AccountSid: string; // Twilio account
  Direction: string; // 'inbound'
  CallStatus: string; // 'ringing'
}

// =====================================
// MAIN HANDLER
// =====================================

export async function POST(request: NextRequest) {
  return withTwilioVerification(request, async (body) => {
    const payload = body as unknown as TwilioIncomingPayload;
    const callSid = payload.CallSid;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.BASE_URL;

    // Log webhook receipt
    logWebhookReceived({
      callSid,
      eventType: 'call_incoming',
      eventStatus: payload.CallStatus,
      payload: body,
      source: 'incoming',
    });

    // Add Sentry context for debugging
    Sentry.setTag('callSid', callSid);
    Sentry.setExtra('trackingNumber', payload.To);

    try {
      // ─────────────────────────────────────────────────────────────
      // Step 1: Idempotency check (prevent duplicate processing)
      // ─────────────────────────────────────────────────────────────
      const isProcessed = await isWebhookProcessed('call_incoming', callSid);

      if (isProcessed) {
        logger.info({
          event: 'call.incoming.duplicate',
          message: 'Duplicate incoming call webhook, skipping',
          callSid,
        });
        // Return empty response for duplicate (Twilio won't retry on 200)
        return createTwimlResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
      }

      // ─────────────────────────────────────────────────────────────
      // Step 2: Lookup tracking number
      // ─────────────────────────────────────────────────────────────
      const trackingNumber = await getTrackingNumberByPhone(payload.To);

      if (!trackingNumber) {
        logger.warn({
          event: 'call.incoming.unknown_number',
          message: 'Incoming call to unknown tracking number',
          calledNumber: payload.To,
          callerPhone: maskPhone(payload.From),
        });

        await markWebhookProcessed(callSid, 'call_incoming', undefined, {
          result: 'rejected',
          reason: 'unknown_number',
        });

        return createTwimlResponse(
          buildRejection(
            "We're sorry, this number is no longer in service. Please visit our website for assistance."
          )
        );
      }

      logger.info({
        event: 'call.incoming.identified',
        message: `Incoming call identified: ${trackingNumber.campaign?.name || 'No campaign'}`,
        trackingNumberId: trackingNumber.id,
        affiliateId: trackingNumber.affiliateId,
        campaignId: trackingNumber.campaignId,
        serviceTypeId: trackingNumber.serviceTypeId,
        callerPhone: maskPhone(payload.From),
      });

      // ─────────────────────────────────────────────────────────────
      // Step 3: Check campaign eligibility
      // ─────────────────────────────────────────────────────────────
      if (trackingNumber.campaign) {
        const campaignData: CampaignForEligibility = {
          id: trackingNumber.campaign.id,
          name: trackingNumber.campaign.name,
          active: trackingNumber.campaignId !== null, // If linked to campaign, assume active
          hoursOfOperation: null, // Will be populated from campaign if exists
          timezone: 'America/New_York', // Default
          dailyCallCap: null,
          serviceTypeId: trackingNumber.campaign.serviceTypeId,
        };

        // Fetch full campaign data for eligibility check
        const fullCampaign = await prisma.campaign.findUnique({
          where: { id: trackingNumber.campaign.id },
          select: {
            id: true,
            name: true,
            active: true,
            hoursOfOperation: true,
            timezone: true,
            dailyCallCap: true,
            serviceTypeId: true,
          },
        });

        if (fullCampaign) {
          campaignData.active = fullCampaign.active;
          campaignData.hoursOfOperation = fullCampaign.hoursOfOperation as HoursOfOperation | null;
          campaignData.timezone = fullCampaign.timezone;
          campaignData.dailyCallCap = fullCampaign.dailyCallCap;
        }

        const eligibility = await checkCampaignEligibility(campaignData, payload.FromZip);

        if (!eligibility.eligible) {
          logger.info({
            event: 'call.incoming.ineligible',
            message: `Call rejected: ${eligibility.reason}`,
            callSid,
            campaignId: campaignData.id,
            reason: eligibility.reason,
          });

          await markWebhookProcessed(callSid, 'call_incoming', undefined, {
            result: 'rejected',
            reason: eligibility.reason,
          });

          return createTwimlResponse(
            buildRejection(eligibility.message || "We're sorry, we cannot accept your call at this time.")
          );
        }
      }

      // ─────────────────────────────────────────────────────────────
      // Step 4: Create call record in database
      // ─────────────────────────────────────────────────────────────
      const call = await prisma.call.create({
        data: {
          twilioCallSid: callSid,
          trackingNumberId: trackingNumber.id,
          affiliateId: trackingNumber.affiliateId,
          campaignId: trackingNumber.campaignId,
          serviceTypeId: trackingNumber.serviceTypeId,
          callerPhone: payload.From,
          callerPhoneDisplay: formatPhoneDisplay(payload.From),
          callerCity: payload.FromCity || null,
          callerState: payload.FromState || null,
          callerZip: payload.FromZip || null,
          callerName: payload.CallerName || null,
          status: 'RINGING',
          ivrResponses: {},
          createdAt: new Date(),
        },
      });

      logger.info({
        event: 'call.incoming.created',
        message: 'Call record created',
        callId: call.id,
        callSid,
        status: 'RINGING',
      });

      // Log call activity (visible to affiliate)
      await createCallActivityLog(call.id, 'call.received', `Call received from ${maskPhone(payload.From)}`, {
        level: 'info',
        details: {
          trackingNumber: payload.To,
          callerCity: payload.FromCity,
          callerState: payload.FromState,
          callerZip: payload.FromZip,
        },
        visibleToAffiliate: true,
        visibleToAdmin: true,
      });

      // Increment call counter for campaign cap tracking
      if (trackingNumber.campaignId) {
        await incrementCallCounter(trackingNumber.campaignId);
      }

      // ─────────────────────────────────────────────────────────────
      // Step 5: Determine next step (IVR or direct to auction)
      // ─────────────────────────────────────────────────────────────

      // Check if campaign requires IVR qualification
      const campaign = trackingNumber.campaign
        ? await prisma.campaign.findUnique({
            where: { id: trackingNumber.campaign.id },
            select: {
              requireIvrQualification: true,
              ivrFlowId: true,
            },
          })
        : null;

      // Also check tracking number's own IVR config
      const ivrFlowId = trackingNumber.ivrFlowId || campaign?.ivrFlowId;

      if (ivrFlowId) {
        // ───────────────────────────────────────────────────────────
        // Path A: IVR Qualification Required
        // ───────────────────────────────────────────────────────────
        const ivrFlow = await prisma.ivrFlow.findUnique({
          where: { id: ivrFlowId },
          select: {
            id: true,
            steps: true,
            defaultTimeout: true,
          },
        });

        if (ivrFlow) {
          // Update call status to IVR
          await prisma.call.update({
            where: { id: call.id },
            data: {
              status: 'IVR',
              previousStatus: 'RINGING',
              statusChangedAt: new Date(),
            },
          });

          await createCallActivityLog(call.id, 'call.ivr_started', 'IVR qualification started', {
            level: 'info',
            details: { ivrFlowId },
            visibleToAffiliate: true,
          });

          // Get first IVR step prompt
          const steps = ivrFlow.steps as Array<{ prompt?: string; step?: number }>;
          const firstStep = steps?.[0];
          const prompt =
            firstStep?.prompt ||
            'Press 1 if you are the homeowner, or press 2 if you are a renter.';

          await markWebhookProcessed(callSid, 'call_incoming', undefined, {
            result: 'ivr',
            callId: call.id,
          });

          return createTwimlResponse(
            buildIvrGather(prompt, `${baseUrl}/api/calls/ivr?callId=${call.id}&step=1`, {
              numDigits: 1,
              timeout: ivrFlow.defaultTimeout || 10,
            })
          );
        }
      }

      // ───────────────────────────────────────────────────────────
      // Path B: No IVR - Direct to Auction with Optimized Hold
      // ───────────────────────────────────────────────────────────
      await prisma.call.update({
        where: { id: call.id },
        data: {
          status: 'BIDDING',
          previousStatus: 'RINGING',
          statusChangedAt: new Date(),
          isQualified: true, // No IVR means auto-qualified
          ivrCompletedAt: new Date(),
        },
      });

      await createCallActivityLog(call.id, 'call.auction_started', 'Finding available service providers', {
        level: 'info',
        details: { skipIvr: true },
        visibleToAffiliate: true,
      });

      await markWebhookProcessed(callSid, 'call_incoming', undefined, {
        result: 'auction',
        callId: call.id,
      });

      // Use optimized hold experience (brief message, then redirect to auction)
      // This provides better caller experience while keeping latency low
      return createTwimlResponse(
        buildOptimizedHold(`${baseUrl}/api/calls/auction?callId=${call.id}`, {
          message: 'Please hold while we connect you with a local specialist.',
          callId: call.id,
        })
      );
    } catch (error) {
      // ─────────────────────────────────────────────────────────────
      // Error Handling
      // ─────────────────────────────────────────────────────────────
      logger.error({
        event: 'call.incoming.error',
        message: 'Error processing incoming call',
        callSid,
        error: (error as Error).message,
        stack: (error as Error).stack,
      });

      Sentry.captureException(error, {
        tags: { component: 'incoming-webhook' },
        extra: { callSid, payload: body },
      });

      await markWebhookFailed(callSid, 'call_incoming', undefined, (error as Error).message);

      // Return generic error message to caller
      return createTwimlResponse(
        buildRejection(
          "We're sorry, we're experiencing technical difficulties. Please try your call again later."
        )
      );
    }
  });
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
    'Incoming call webhook endpoint. Configure in Twilio console.',
    false
  );
}
