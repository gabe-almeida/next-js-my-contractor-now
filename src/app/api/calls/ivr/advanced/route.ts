/**
 * Advanced IVR Webhook Handler
 *
 * WHY: Process multi-step IVR flows with configurable steps.
 *      This handler works with the IVR Executor to process complex flows
 *      including speech input, conditions, and multi-step qualification.
 *
 * WHEN: Twilio redirects here during advanced IVR flow execution.
 *       Used when campaigns have custom IVR flows configured.
 *
 * HOW:
 *   1. Parse webhook payload (Digits or SpeechResult)
 *   2. Load call record and IVR flow configuration
 *   3. Resume execution from current step with user input
 *   4. Return TwiML for next step or complete flow
 *
 * CALL FLOW:
 * +----------------------------------------------------------------------+
 * |  Incoming handler detects custom IVR flow                            |
 * |      |                                                               |
 * |  Redirects to /api/calls/ivr/advanced?callId=X&stepId=entry          |
 * |      |                                                               |
 * |  Execute step, return TwiML (gather, say, etc.)                      |
 * |      |                                                               |
 * |  Caller provides input                                               |
 * |      |                                                               |
 * |  Twilio webhooks back with Digits/SpeechResult                       |
 * |      |                                                               |
 * |  Process input, advance to next step, repeat...                      |
 * |      |                                                               |
 * |  [Qualified] -> redirect to /api/calls/auction                       |
 * |  [Disqualified] -> hangup with message                               |
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
import { buildRejection, buildAnnouncement } from '@/lib/twilio/twiml-builder';
import { validateTransition, type CallStatus } from '@/lib/twilio/state-machine';
import { IvrExecutor, parseIvrFlow } from '@/lib/ivr/executor';
import type { IvrExecutionState, IvrFlowConfig } from '@/types/ivr';
import type { Prisma } from '@prisma/client';

// =====================================
// TYPE DEFINITIONS
// =====================================

interface TwilioAdvancedIvrPayload {
  CallSid: string;
  Digits?: string;
  SpeechResult?: string;
  Confidence?: string;
  From: string;
  To: string;
  CallStatus?: string;
}

// =====================================
// MAIN HANDLER
// =====================================

export async function POST(request: NextRequest) {
  return withTwilioVerification(request, async (body) => {
    const payload = body as unknown as TwilioAdvancedIvrPayload;
    const callSid = payload.CallSid;
    const digits = payload.Digits;
    const speechResult = payload.SpeechResult;

    const searchParams = request.nextUrl.searchParams;
    const callId = searchParams.get('callId');
    const stepId = searchParams.get('stepId');
    const attempt = parseInt(searchParams.get('attempt') || '1', 10);
    const isTimeout = searchParams.get('timeout') === '1';
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.BASE_URL;

    // Determine input type and value
    let input: string | undefined;
    let inputType: 'dtmf' | 'speech' | 'timeout' = 'dtmf';

    if (isTimeout) {
      inputType = 'timeout';
    } else if (speechResult) {
      input = speechResult;
      inputType = 'speech';
    } else if (digits !== undefined) {
      input = digits;
      inputType = 'dtmf';
    }

    // Log webhook receipt
    logWebhookReceived({
      callSid,
      eventType: 'advanced_ivr_response',
      eventStatus: input ? 'input_received' : 'no_input',
      payload: body,
      source: 'ivr',
    });

    // Add Sentry context
    Sentry.setTag('callSid', callSid);
    Sentry.setTag('callId', callId || 'unknown');
    Sentry.setExtra('input', input);
    Sentry.setExtra('inputType', inputType);
    Sentry.setExtra('stepId', stepId);

    try {
      // ─────────────────────────────────────────────────────────────
      // Step 1: Validate call ID
      // ─────────────────────────────────────────────────────────────
      if (!callId) {
        logger.error({
          event: 'advanced_ivr.missing_call_id',
          message: 'Advanced IVR webhook received without callId',
          callSid,
        });
        return createTwimlResponse(
          buildRejection('An error occurred. Please try again later.')
        );
      }

      // ─────────────────────────────────────────────────────────────
      // Step 2: Idempotency check
      // ─────────────────────────────────────────────────────────────
      const eventKey = `advanced_ivr_${stepId}_${attempt}_${input || 'none'}`;
      const isProcessed = await isWebhookProcessed('advanced_ivr', callSid, eventKey);

      if (isProcessed) {
        logger.info({
          event: 'advanced_ivr.duplicate',
          message: 'Duplicate advanced IVR webhook, skipping',
          callId,
          callSid,
          stepId,
        });
        return createTwimlResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
      }

      // ─────────────────────────────────────────────────────────────
      // Step 3: Load call record with IVR flow
      // ─────────────────────────────────────────────────────────────
      const call = await prisma.call.findUnique({
        where: { id: callId },
        select: {
          id: true,
          twilioCallSid: true,
          status: true,
          ivrResponses: true,
          version: true,
          callerPhone: true,
          callerZip: true,
          trackingNumber: {
            select: {
              ivrFlowId: true,
              ivrFlow: {
                select: {
                  id: true,
                  name: true,
                  steps: true,
                  defaultTimeout: true,
                  maxRetries: true,
                },
              },
            },
          },
          campaign: {
            select: {
              ivrFlowId: true,
              ivrFlow: {
                select: {
                  id: true,
                  name: true,
                  steps: true,
                  defaultTimeout: true,
                  maxRetries: true,
                },
              },
            },
          },
        },
      });

      if (!call) {
        logger.error({
          event: 'advanced_ivr.call_not_found',
          message: 'Call record not found',
          callId,
          callSid,
        });
        await markWebhookFailed(callSid, 'advanced_ivr', eventKey, 'Call not found');
        return createTwimlResponse(
          buildRejection('An error occurred. Please try again later.')
        );
      }

      // ─────────────────────────────────────────────────────────────
      // Step 4: Get IVR flow configuration
      // ─────────────────────────────────────────────────────────────
      const ivrFlowRecord = call.trackingNumber?.ivrFlow || call.campaign?.ivrFlow;

      if (!ivrFlowRecord) {
        logger.error({
          event: 'advanced_ivr.no_flow',
          message: 'No IVR flow configured for this call',
          callId,
          callSid,
        });
        await markWebhookFailed(callSid, 'advanced_ivr', eventKey, 'No IVR flow configured');
        return createTwimlResponse(
          buildRejection('An error occurred. Please try again later.')
        );
      }

      // Parse flow configuration
      let flow: IvrFlowConfig;
      try {
        flow = parseIvrFlow(ivrFlowRecord.steps);
        flow.name = ivrFlowRecord.name;
        flow.defaultTimeout = ivrFlowRecord.defaultTimeout;
        flow.maxRetries = ivrFlowRecord.maxRetries;
      } catch (parseError) {
        logger.error({
          event: 'advanced_ivr.flow_parse_error',
          message: 'Failed to parse IVR flow',
          callId,
          error: (parseError as Error).message,
        });
        return createTwimlResponse(
          buildRejection('An error occurred. Please try again later.')
        );
      }

      // ─────────────────────────────────────────────────────────────
      // Step 5: Initialize or restore execution state
      // ─────────────────────────────────────────────────────────────
      let state: IvrExecutionState;

      if (call.ivrResponses && typeof call.ivrResponses === 'object') {
        // Restore existing state
        state = call.ivrResponses as unknown as IvrExecutionState;

        // Update current step if specified
        if (stepId && stepId !== state.currentStepId) {
          state.currentStepId = stepId;
        }
      } else {
        // Initialize new state
        state = {
          flowId: flow.name,
          currentStepId: stepId || flow.entryStepId,
          variables: {},
          attempts: [],
          capturedData: {},
          startedAt: new Date().toISOString(),
          errors: [],
        };
      }

      // ─────────────────────────────────────────────────────────────
      // Step 6: Execute IVR step
      // ─────────────────────────────────────────────────────────────
      const executor = new IvrExecutor({
        callId,
        callSid,
        baseUrl: baseUrl!,
        flow,
        state,
        callerPhone: call.callerPhone,
        callerZip: call.callerZip || undefined,
      });

      const result = await executor.execute(input, inputType);

      // ─────────────────────────────────────────────────────────────
      // Step 7: Update call record with new state
      // ─────────────────────────────────────────────────────────────
      const updateData: Prisma.CallUpdateInput = {
        ivrResponses: result.state as unknown as Prisma.InputJsonValue,
        version: { increment: 1 },
      };

      if (result.isComplete) {
        const now = new Date();
        updateData.ivrCompletedAt = now;

        if (result.isQualified) {
          // Validate state transition
          validateTransition(call.status as CallStatus, 'BIDDING' as CallStatus);

          updateData.status = 'BIDDING';
          updateData.previousStatus = call.status;
          updateData.isQualified = true;
          updateData.statusChangedAt = now;

          logCallStateChange(callId, callSid, call.status, 'BIDDING', 'Qualified via advanced IVR');

          await createCallActivityLog(callId, 'call.qualified', 'Caller qualified via advanced IVR', {
            level: 'info',
            details: {
              capturedData: result.state.capturedData,
              qualificationReason: result.state.qualificationReason,
            },
            visibleToAffiliate: true,
            visibleToAdmin: true,
          });
        } else {
          // Caller did not qualify
          validateTransition(call.status as CallStatus, 'REJECTED' as CallStatus);

          updateData.status = 'REJECTED';
          updateData.previousStatus = call.status;
          updateData.isQualified = false;
          updateData.statusChangedAt = now;
          updateData.endedAt = now;
          updateData.hangupReason = 'IVR_REJECTED';

          logCallStateChange(callId, callSid, call.status, 'REJECTED', 'Disqualified via advanced IVR');

          await createCallActivityLog(callId, 'call.rejected', 'Caller did not qualify via advanced IVR', {
            level: 'info',
            details: {
              capturedData: result.state.capturedData,
              disqualificationReason: result.state.qualificationReason,
            },
            visibleToAffiliate: true,
            visibleToAdmin: true,
          });
        }
      }

      await prisma.call.update({
        where: { id: callId, version: call.version },
        data: updateData,
      });

      // ─────────────────────────────────────────────────────────────
      // Step 8: Mark webhook processed and return TwiML
      // ─────────────────────────────────────────────────────────────
      await markWebhookProcessed(callSid, 'advanced_ivr', eventKey, {
        stepId: state.currentStepId,
        result: result.isComplete ? (result.isQualified ? 'qualified' : 'rejected') : 'continue',
      });

      // If qualified and should transfer, redirect to auction
      if (result.isComplete && result.isQualified && result.shouldTransfer) {
        if (result.transferType === 'auction') {
          return createTwimlResponse(
            buildAnnouncement(
              'Thank you. Please hold while we connect you with a specialist.',
              { redirectUrl: `${baseUrl}/api/calls/auction?callId=${callId}` }
            )
          );
        } else if (result.transferType === 'direct' && result.directTransferNumber) {
          // Direct transfer - not going through auction
          const { buildTransfer } = await import('@/lib/twilio/twiml-builder');
          return createTwimlResponse(
            buildTransfer(
              result.directTransferNumber,
              call.callerPhone,
              `${baseUrl}/api/calls/completed?callId=${callId}`,
              { record: true, callId }
            )
          );
        }
      }

      return createTwimlResponse(result.twiml);

    } catch (error) {
      logger.error({
        event: 'advanced_ivr.error',
        message: 'Error processing advanced IVR',
        callId,
        callSid,
        error: (error as Error).message,
        stack: (error as Error).stack,
      });

      Sentry.captureException(error, {
        tags: { component: 'advanced-ivr-webhook' },
        extra: { callId, callSid, stepId },
      });

      await markWebhookFailed(
        callSid,
        'advanced_ivr',
        `advanced_ivr_${stepId}_${attempt}`,
        (error as Error).message
      );

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
 */
export async function GET() {
  return createWebhookErrorResponse(
    'Advanced IVR webhook endpoint. Configure in Twilio console.',
    false
  );
}
