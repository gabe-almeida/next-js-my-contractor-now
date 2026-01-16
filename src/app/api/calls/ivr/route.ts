/**
 * IVR Webhook Handler
 *
 * WHY: Process caller DTMF responses from IVR prompts.
 *      This is where we determine if a caller qualifies based on their
 *      keypad responses (e.g., press 1 for homeowner, 2 for renter).
 *
 * WHEN: Twilio redirects here after caller presses a key during IVR.
 *       The incoming handler sets up the IVR gather which points here.
 *
 * HOW:
 *   1. Parse DTMF digits from Twilio
 *   2. Validate call is still in IVR state
 *   3. Process response based on IVR flow configuration
 *   4. Qualified (pressed 1) -> proceed to auction
 *   5. Not qualified (pressed 2) -> play rejection and hangup
 *   6. Invalid input -> retry with attempt tracking
 *
 * CALL FLOW:
 * +----------------------------------------------------------------------+
 * |  Incoming handler plays IVR prompt                                   |
 * |      |                                                               |
 * |  Caller presses key                                                  |
 * |      |                                                               |
 * |  Twilio sends webhook to /api/calls/ivr  <- YOU ARE HERE            |
 * |      |                                                               |
 * |  [1] Qualified -> Update status, redirect to /api/calls/auction     |
 * |  [2] Not qualified -> Update status, play rejection, hangup         |
 * |  [9] Repeat -> Replay prompt                                        |
 * |  [?] Invalid -> Retry (max 3 attempts) or disconnect                |
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
import { buildIvrGather, buildAnnouncement, buildRejection } from '@/lib/twilio/twiml-builder';
import { validateTransition, type CallStatus } from '@/lib/twilio/state-machine';
import type { Prisma } from '@prisma/client';

// =====================================
// TYPE DEFINITIONS
// =====================================

/**
 * Twilio webhook payload when caller presses keys during IVR
 */
interface TwilioIVRPayload {
  CallSid: string;
  Digits: string;
  From: string;
  To: string;
  FinishedOnKey?: string;
  CallStatus?: string;
}

/**
 * IVR response data stored in call.ivr_responses JSON
 */
interface IVRData {
  flowId?: string;
  currentStep: number;
  attempts: Array<{
    step: number;
    attemptNumber: number;
    input: string | null;
    timestamp: string;
    result: 'valid' | 'invalid' | 'timeout' | 'hangup';
  }>;
  capturedData: Record<string, string>;
  disclosurePlayed?: boolean;
  qualifiedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
}

/**
 * Response definitions for homeowner qualification question
 */
const QUALIFYING_RESPONSES: Record<string, { qualified?: boolean; action?: string; label: string }> = {
  '1': { qualified: true, label: 'Homeowner' },
  '2': { qualified: false, label: 'Renter' },
  '9': { action: 'repeat', label: 'Repeat request' },
};

// Constants
const MAX_ATTEMPTS = 3;
const DEFAULT_TIMEOUT = 10;

// =====================================
// MAIN HANDLER
// =====================================

export async function POST(request: NextRequest) {
  return withTwilioVerification(request, async (body) => {
    const payload = body as unknown as TwilioIVRPayload;
    const callSid = payload.CallSid;
    const digits = payload.Digits || '';
    const searchParams = request.nextUrl.searchParams;
    const callId = searchParams.get('callId');
    const step = parseInt(searchParams.get('step') || '1', 10);
    const attempt = parseInt(searchParams.get('attempt') || '1', 10);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.BASE_URL;

    // Log webhook receipt
    logWebhookReceived({
      callSid,
      eventType: 'ivr_response',
      eventStatus: 'digits_received',
      payload: body,
      source: 'ivr',
    });

    // Add Sentry context
    Sentry.setTag('callSid', callSid);
    Sentry.setTag('callId', callId || 'unknown');
    Sentry.setExtra('digits', digits);
    Sentry.setExtra('step', step);
    Sentry.setExtra('attempt', attempt);

    try {
      // ─────────────────────────────────────────────────────────────
      // Step 1: Validate call ID
      // ─────────────────────────────────────────────────────────────
      if (!callId) {
        logger.error({
          event: 'ivr.missing_call_id',
          message: 'IVR webhook received without callId',
          callSid,
        });
        return createTwimlResponse(
          buildRejection('An error occurred. Please try again later.')
        );
      }

      // ─────────────────────────────────────────────────────────────
      // Step 2: Idempotency check for this specific IVR response
      // ─────────────────────────────────────────────────────────────
      const eventKey = `ivr_${step}_${attempt}_${digits}`;
      const isProcessed = await isWebhookProcessed('ivr_response', callSid, eventKey);

      if (isProcessed) {
        logger.info({
          event: 'ivr.duplicate',
          message: 'Duplicate IVR webhook, skipping',
          callId,
          callSid,
          step,
          attempt,
        });
        return createTwimlResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
      }

      // ─────────────────────────────────────────────────────────────
      // Step 3: Load and validate call record
      // ─────────────────────────────────────────────────────────────
      const call = await prisma.call.findUnique({
        where: { id: callId },
        select: {
          id: true,
          twilioCallSid: true,
          status: true,
          ivrResponses: true,
          version: true,
        },
      });

      if (!call) {
        logger.error({
          event: 'ivr.call_not_found',
          message: 'Call record not found',
          callId,
          callSid,
        });
        await markWebhookFailed(callSid, 'ivr_response', eventKey, 'Call not found');
        return createTwimlResponse(
          buildRejection('An error occurred. Please try again later.')
        );
      }

      // Verify call is in IVR state
      if (call.status !== 'IVR') {
        logger.warn({
          event: 'ivr.invalid_state',
          message: `Call not in IVR state: ${call.status}`,
          callId,
          callSid,
          currentStatus: call.status,
        });
        await markWebhookProcessed(callSid, 'ivr_response', eventKey, {
          result: 'skipped',
          reason: 'invalid_state',
        });
        // Return empty response - call might have already moved on
        return createTwimlResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
      }

      // ─────────────────────────────────────────────────────────────
      // Step 4: Parse existing IVR data and add new attempt
      // ─────────────────────────────────────────────────────────────
      const existingIvrData = (call.ivrResponses as IVRData | null) || {
        currentStep: 1,
        attempts: [],
        capturedData: {},
      };

      // ─────────────────────────────────────────────────────────────
      // Step 5: Handle empty/timeout input
      // ─────────────────────────────────────────────────────────────
      if (!digits || digits === '') {
        return handleInvalidInput(
          callId,
          callSid,
          call.version,
          step,
          attempt,
          existingIvrData,
          'timeout',
          baseUrl!
        );
      }

      // ─────────────────────────────────────────────────────────────
      // Step 6: Process DTMF response
      // ─────────────────────────────────────────────────────────────
      const response = QUALIFYING_RESPONSES[digits];

      // Handle repeat request
      if (response?.action === 'repeat') {
        await logIvrAttempt(callId, callSid, step, attempt, digits, 'valid', 'repeat_requested');
        await markWebhookProcessed(callSid, 'ivr_response', eventKey, {
          result: 'repeat',
          digits,
        });

        return createTwimlResponse(
          buildIvrGather(
            'Press 1 if you own your home. Press 2 if you rent.',
            `${baseUrl}/api/calls/ivr?callId=${callId}&step=${step}&attempt=${attempt}`,
            { numDigits: 1, timeout: DEFAULT_TIMEOUT }
          )
        );
      }

      // Handle invalid input (not 1, 2, or 9)
      if (!response) {
        return handleInvalidInput(
          callId,
          callSid,
          call.version,
          step,
          attempt,
          existingIvrData,
          'invalid',
          baseUrl!
        );
      }

      // ─────────────────────────────────────────────────────────────
      // Step 7: Process qualification result
      // ─────────────────────────────────────────────────────────────
      if (response.qualified === true) {
        return handleQualified(
          callId,
          callSid,
          call.version,
          existingIvrData,
          step,
          attempt,
          digits,
          response.label,
          baseUrl!
        );
      }

      if (response.qualified === false) {
        return handleRejected(
          callId,
          callSid,
          call.version,
          existingIvrData,
          step,
          attempt,
          digits,
          response.label
        );
      }

      // Fallback - should never reach here
      logger.error({
        event: 'ivr.unexpected_response',
        message: 'Unexpected IVR response configuration',
        callId,
        digits,
        response,
      });
      return createTwimlResponse(
        buildRejection('An error occurred. Please try again later.')
      );

    } catch (error) {
      logger.error({
        event: 'ivr.error',
        message: 'Error processing IVR response',
        callId,
        callSid,
        error: (error as Error).message,
        stack: (error as Error).stack,
      });

      Sentry.captureException(error, {
        tags: { component: 'ivr-webhook' },
        extra: { callId, callSid, digits },
      });

      await markWebhookFailed(callSid, 'ivr_response', `ivr_${step}_${attempt}_${digits}`,
        (error as Error).message);

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
 * WHY: Handle caller qualified through IVR.
 * WHEN: Caller presses 1 (homeowner).
 * HOW: Update call status to BIDDING and redirect to auction.
 */
async function handleQualified(
  callId: string,
  callSid: string,
  version: number,
  existingIvrData: IVRData,
  step: number,
  attempt: number,
  digits: string,
  label: string,
  baseUrl: string
): Promise<Response> {
  const now = new Date();

  // Validate state transition
  validateTransition('IVR' as CallStatus, 'BIDDING' as CallStatus);

  // Update IVR data
  const updatedIvrData: IVRData = {
    ...existingIvrData,
    currentStep: step,
    attempts: [
      ...existingIvrData.attempts,
      {
        step,
        attemptNumber: attempt,
        input: digits,
        timestamp: now.toISOString(),
        result: 'valid',
      },
    ],
    capturedData: {
      ...existingIvrData.capturedData,
      homeowner: 'yes',
    },
    qualifiedAt: now.toISOString(),
  };

  // Update call record
  await prisma.call.update({
    where: { id: callId, version },
    data: {
      status: 'BIDDING',
      previousStatus: 'IVR',
      isQualified: true,
      ivrResponses: updatedIvrData as unknown as Prisma.InputJsonValue,
      ivrCompletedAt: now,
      statusChangedAt: now,
      version: { increment: 1 },
    },
  });

  // Log state change
  logCallStateChange(callId, callSid, 'IVR', 'BIDDING', `Qualified: ${label}`);

  // Log activity (visible to affiliate)
  await createCallActivityLog(callId, 'call.qualified', `Caller qualified via IVR (${label})`, {
    level: 'info',
    details: { digits, label },
    visibleToAffiliate: true,
    visibleToAdmin: true,
  });

  // Mark webhook processed
  await markWebhookProcessed(callSid, 'ivr_response', `ivr_${step}_${attempt}_${digits}`, {
    result: 'qualified',
    digits,
    label,
  });

  logger.info({
    event: 'ivr.qualified',
    message: 'Caller qualified via IVR',
    callId,
    callSid,
    digits,
    label,
  });

  // Return TwiML to proceed to auction
  return createTwimlResponse(
    buildAnnouncement(
      'Thank you. Please hold while we connect you with a specialist.',
      { redirectUrl: `${baseUrl}/api/calls/auction?callId=${callId}` }
    )
  );
}

/**
 * WHY: Handle caller rejected through IVR.
 * WHEN: Caller presses 2 (renter).
 * HOW: Update call status to REJECTED and play rejection message.
 */
async function handleRejected(
  callId: string,
  callSid: string,
  version: number,
  existingIvrData: IVRData,
  step: number,
  attempt: number,
  digits: string,
  label: string
): Promise<Response> {
  const now = new Date();

  // Validate state transition
  validateTransition('IVR' as CallStatus, 'REJECTED' as CallStatus);

  // Update IVR data
  const updatedIvrData: IVRData = {
    ...existingIvrData,
    currentStep: step,
    attempts: [
      ...existingIvrData.attempts,
      {
        step,
        attemptNumber: attempt,
        input: digits,
        timestamp: now.toISOString(),
        result: 'valid',
      },
    ],
    capturedData: {
      ...existingIvrData.capturedData,
      homeowner: 'no',
    },
    rejectedAt: now.toISOString(),
    rejectionReason: `Not a homeowner (${label})`,
  };

  // Update call record
  await prisma.call.update({
    where: { id: callId, version },
    data: {
      status: 'REJECTED',
      previousStatus: 'IVR',
      isQualified: false,
      ivrResponses: updatedIvrData as unknown as Prisma.InputJsonValue,
      ivrCompletedAt: now,
      endedAt: now,
      statusChangedAt: now,
      hangupReason: 'IVR_REJECTED',
      version: { increment: 1 },
    },
  });

  // Log state change
  logCallStateChange(callId, callSid, 'IVR', 'REJECTED', `Not qualified: ${label}`);

  // Log activity (visible to affiliate)
  await createCallActivityLog(callId, 'call.rejected', `Caller did not qualify (${label})`, {
    level: 'info',
    details: { digits, label, reason: 'Not a homeowner' },
    visibleToAffiliate: true,
    visibleToAdmin: true,
  });

  // Mark webhook processed
  await markWebhookProcessed(callSid, 'ivr_response', `ivr_${step}_${attempt}_${digits}`, {
    result: 'rejected',
    digits,
    label,
  });

  logger.info({
    event: 'ivr.rejected',
    message: 'Caller did not qualify via IVR',
    callId,
    callSid,
    digits,
    label,
  });

  // Return rejection TwiML
  return createTwimlResponse(
    buildRejection(
      'We\'re sorry, our services are only available to homeowners. Thank you for calling. Goodbye.'
    )
  );
}

/**
 * WHY: Handle invalid IVR input with retry logic.
 * WHEN: Caller presses key other than 1, 2, or 9, or times out.
 * HOW: Retry up to MAX_ATTEMPTS times, then disconnect.
 */
async function handleInvalidInput(
  callId: string,
  callSid: string,
  version: number,
  step: number,
  attempt: number,
  existingIvrData: IVRData,
  inputType: 'invalid' | 'timeout',
  baseUrl: string
): Promise<Response> {
  const now = new Date();

  // Log the invalid input (admin only)
  await createCallActivityLog(
    callId,
    `ivr.${inputType}_input`,
    inputType === 'timeout' ? 'No IVR input received (timeout)' : 'Invalid IVR input received',
    {
      level: 'debug',
      details: { step, attempt, inputType },
      visibleToAffiliate: false,
      visibleToAdmin: true,
    }
  );

  logger.info({
    event: `ivr.${inputType}_input`,
    message: inputType === 'timeout' ? 'IVR timeout' : 'Invalid IVR input',
    callId,
    callSid,
    step,
    attempt,
  });

  // Check if max attempts reached
  if (attempt >= MAX_ATTEMPTS) {
    // Validate state transition
    validateTransition('IVR' as CallStatus, 'FAILED' as CallStatus);

    // Update IVR data with final attempt
    const updatedIvrData: IVRData = {
      ...existingIvrData,
      currentStep: step,
      attempts: [
        ...existingIvrData.attempts,
        {
          step,
          attemptNumber: attempt,
          input: null,
          timestamp: now.toISOString(),
          result: inputType,
        },
      ],
      rejectedAt: now.toISOString(),
      rejectionReason: 'Max attempts exceeded',
    };

    // Update call record
    await prisma.call.update({
      where: { id: callId, version },
      data: {
        status: 'FAILED',
        previousStatus: 'IVR',
        isQualified: false,
        ivrResponses: updatedIvrData as unknown as Prisma.InputJsonValue,
        ivrCompletedAt: now,
        endedAt: now,
        statusChangedAt: now,
        hangupReason: 'IVR_MAX_ATTEMPTS',
        version: { increment: 1 },
      },
    });

    logCallStateChange(callId, callSid, 'IVR', 'FAILED', 'Max IVR attempts exceeded');

    await createCallActivityLog(
      callId,
      'call.failed',
      'Call ended due to max IVR attempts exceeded',
      {
        level: 'warn',
        details: { step, attempts: attempt },
        visibleToAffiliate: true,
        visibleToAdmin: true,
      }
    );

    await markWebhookProcessed(callSid, 'ivr_response', `ivr_${step}_${attempt}_max`, {
      result: 'max_attempts',
    });

    return createTwimlResponse(
      buildRejection(
        'We\'re having trouble receiving your response. Please call back later. Goodbye.'
      )
    );
  }

  // Retry with incremented attempt
  const nextAttempt = attempt + 1;

  // Update IVR data with this failed attempt
  const updatedIvrData: IVRData = {
    ...existingIvrData,
    currentStep: step,
    attempts: [
      ...existingIvrData.attempts,
      {
        step,
        attemptNumber: attempt,
        input: null,
        timestamp: now.toISOString(),
        result: inputType,
      },
    ],
  };

  await prisma.call.update({
    where: { id: callId, version },
    data: {
      ivrResponses: updatedIvrData as unknown as Prisma.InputJsonValue,
      version: { increment: 1 },
    },
  });

  await markWebhookProcessed(callSid, 'ivr_response', `ivr_${step}_${attempt}_retry`, {
    result: 'retry',
    nextAttempt,
  });

  // Return retry TwiML
  return createTwimlResponse(
    buildIvrGather(
      'I\'m sorry, that wasn\'t a valid option. Press 1 if you own your home. Press 2 if you rent. Press 9 to hear these options again.',
      `${baseUrl}/api/calls/ivr?callId=${callId}&step=${step}&attempt=${nextAttempt}`,
      { numDigits: 1, timeout: DEFAULT_TIMEOUT }
    )
  );
}

/**
 * WHY: Log IVR attempt for debugging.
 * WHEN: After processing any IVR response.
 */
async function logIvrAttempt(
  callId: string,
  callSid: string,
  step: number,
  attempt: number,
  input: string | null,
  result: string,
  action?: string
): Promise<void> {
  logger.debug({
    event: 'ivr.attempt',
    message: `IVR attempt: ${result}`,
    callId,
    callSid,
    step,
    attempt,
    input,
    result,
    action,
  });
}

/**
 * GET handler - used for Twilio webhook configuration testing
 */
export async function GET() {
  return createWebhookErrorResponse(
    'IVR webhook endpoint. Configure in Twilio console.',
    false
  );
}
