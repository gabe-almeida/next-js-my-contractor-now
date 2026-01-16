/**
 * Call Recording Webhook Handler
 *
 * WHY: Process Twilio recording status callbacks to download recordings
 *      from Twilio's temporary storage, upload to our S3 bucket with encryption,
 *      and update call records with permanent recording URLs.
 *      Recordings are critical for billing disputes and compliance.
 *
 * WHEN: Twilio sends this webhook after a call's recording is ready.
 *       The webhook may arrive before OR after the call completion webhook.
 *       We handle this race condition by only updating recording-related fields.
 *
 * HOW:
 *   1. Verify Twilio signature (security)
 *   2. Check idempotency (prevent duplicate processing)
 *   3. Handle recording status (in-progress, completed, failed, absent)
 *   4. Download recording from Twilio (with retry for 404s)
 *   5. Upload to S3 with AES-256 encryption
 *   6. Update call record with permanent URL
 *   7. Delete recording from Twilio (cost saving)
 *
 * RACE CONDITION NOTE:
 *   Recording webhook may arrive before call record exists or before
 *   call completion webhook. We ONLY update recording-related fields,
 *   never billing or status fields.
 */

import { NextRequest } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import {
  withTwilioVerification,
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
  logRecordingEvent,
} from '@/lib/twilio/logging';
import {
  downloadRecordingWithRetry,
  uploadToS3WithRetry,
  deleteTwilioRecording,
} from '@/lib/services/recording-service';

// =====================================
// TYPE DEFINITIONS
// =====================================

/**
 * WHY: Twilio recording webhook contains rich metadata about the recording.
 * WHEN: Received via POST to this endpoint.
 * HOW: Parse from form data, validate required fields.
 */
interface TwilioRecordingWebhook {
  // Core identifiers
  CallSid: string;
  AccountSid: string;
  RecordingSid: string;

  // Recording details
  RecordingUrl: string;
  RecordingStatus: 'in-progress' | 'completed' | 'failed' | 'absent';
  RecordingDuration: string;
  RecordingChannels: '1' | '2';
  RecordingSource: string;

  // Optional fields
  RecordingStartTime?: string;
  ErrorCode?: string;
  RecordingTrack?: 'inbound' | 'outbound' | 'both';
}

/**
 * Recording status values for our database
 */
type RecordingStatus =
  | 'PENDING'
  | 'RECORDING'
  | 'PROCESSING'
  | 'DOWNLOAD_FAILED'
  | 'UPLOAD_FAILED'
  | 'AVAILABLE'
  | 'DELETED'
  | 'ABSENT';

// =====================================
// MAIN HANDLER
// =====================================

export async function POST(request: NextRequest) {
  return withTwilioVerification(request, async (body) => {
    const payload = body as unknown as TwilioRecordingWebhook;
    const { CallSid, RecordingSid, RecordingStatus, RecordingUrl } = payload;

    // Log webhook receipt
    logWebhookReceived({
      callSid: CallSid,
      eventType: 'recording',
      eventStatus: RecordingStatus,
      payload: body,
      source: 'recording',
    });

    // Add Sentry context
    Sentry.setTag('callSid', CallSid);
    Sentry.setTag('recordingSid', RecordingSid);
    Sentry.setTag('recordingStatus', RecordingStatus);

    Sentry.addBreadcrumb({
      category: 'recording.webhook',
      message: 'Recording webhook received',
      level: 'info',
      data: { recordingSid: RecordingSid, status: RecordingStatus },
    });

    try {
      // ─────────────────────────────────────────────────────────────
      // Step 1: Idempotency check using RecordingSid:Status key
      // ─────────────────────────────────────────────────────────────
      const isProcessed = await isWebhookProcessed('recording', RecordingSid, RecordingStatus);

      if (isProcessed) {
        logger.info({
          event: 'recording.duplicate',
          message: 'Duplicate recording webhook, skipping',
          recordingSid: RecordingSid,
          status: RecordingStatus,
        });
        return createAckResponse('Already processed');
      }

      // ─────────────────────────────────────────────────────────────
      // Step 2: Handle different recording statuses
      // ─────────────────────────────────────────────────────────────

      // Handle in-progress status (recording still going)
      if (RecordingStatus === 'in-progress') {
        logger.info({
          event: 'recording.in_progress',
          message: 'Recording in progress, waiting for completion',
          callSid: CallSid,
          recordingSid: RecordingSid,
        });

        await markWebhookProcessed(RecordingSid, 'recording', RecordingStatus, {
          result: 'acknowledged',
          reason: 'in_progress',
        });

        return createAckResponse('Acknowledged');
      }

      // Handle absent status (no recording produced - NOT an error)
      if (RecordingStatus === 'absent') {
        return handleAbsentRecording(CallSid, RecordingSid);
      }

      // Handle failed status
      if (RecordingStatus === 'failed') {
        return handleFailedRecording(CallSid, RecordingSid, payload.ErrorCode);
      }

      // ─────────────────────────────────────────────────────────────
      // Step 3: Handle completed recording
      // ─────────────────────────────────────────────────────────────
      if (RecordingStatus !== 'completed') {
        logger.warn({
          event: 'recording.unknown_status',
          message: `Unknown recording status: ${RecordingStatus}`,
          callSid: CallSid,
          recordingSid: RecordingSid,
        });

        await markWebhookProcessed(RecordingSid, 'recording', RecordingStatus, {
          result: 'skipped',
          reason: 'unknown_status',
        });

        return createAckResponse('Unknown status, acknowledged');
      }

      // Process completed recording
      return processCompletedRecording(CallSid, RecordingSid, RecordingUrl, payload);
    } catch (error) {
      logger.error({
        event: 'recording.error',
        message: 'Error processing recording webhook',
        callSid: CallSid,
        recordingSid: RecordingSid,
        error: (error as Error).message,
        stack: (error as Error).stack,
      });

      Sentry.captureException(error, {
        tags: { component: 'recording-webhook' },
        extra: { callSid: CallSid, recordingSid: RecordingSid, payload: body },
      });

      await markWebhookFailed(RecordingSid, 'recording', RecordingStatus, (error as Error).message);

      // Return 200 to prevent Twilio retries for unrecoverable errors
      return createAckResponse('Error processing recording');
    }
  });
}

// =====================================
// RECORDING STATUS HANDLERS
// =====================================

/**
 * WHY: Handle 'absent' recording status - this is NOT an error.
 *      Absent means no recording was produced (call too short, etc).
 *
 * WHEN: Twilio sends recording webhook with status = 'absent'.
 *
 * HOW: Update call record status, log for analytics, return ack.
 */
async function handleAbsentRecording(
  callSid: string,
  recordingSid: string
): Promise<Response> {
  logger.info({
    event: 'recording.absent',
    message: 'Recording absent - no audio captured',
    callSid,
    recordingSid,
  });

  // Find and update call record
  const call = await findCallByTwilioSid(callSid);

  if (call) {
    await prisma.call.update({
      where: { id: call.id },
      data: {
        recordingSid,
        recordingStatus: 'ABSENT' as RecordingStatus,
      },
    });

    logRecordingEvent(call.id, callSid, 'absent', { recordingSid });

    await createCallActivityLog(
      call.id,
      'recording.absent',
      'No recording captured (call too short or no audio)',
      {
        level: 'info',
        details: { recordingSid },
        visibleToAffiliate: false,
        visibleToAdmin: true,
      }
    );
  }

  await markWebhookProcessed(recordingSid, 'recording', 'absent', {
    result: 'success',
    reason: 'no_recording_captured',
  });

  return createAckResponse('Absent acknowledged');
}

/**
 * WHY: Handle failed recording status - log error and update call.
 *
 * WHEN: Twilio sends recording webhook with status = 'failed'.
 *
 * HOW: Log error with ErrorCode, update call record, alert if needed.
 */
async function handleFailedRecording(
  callSid: string,
  recordingSid: string,
  errorCode?: string
): Promise<Response> {
  logger.error({
    event: 'recording.failed',
    message: 'Recording failed at Twilio',
    callSid,
    recordingSid,
    errorCode,
  });

  Sentry.captureMessage('Twilio recording failed', {
    level: 'error',
    tags: { component: 'recording-webhook', errorCode },
    extra: { callSid, recordingSid },
  });

  // Find and update call record
  const call = await findCallByTwilioSid(callSid);

  if (call) {
    await prisma.call.update({
      where: { id: call.id },
      data: {
        recordingSid,
        recordingStatus: 'DOWNLOAD_FAILED' as RecordingStatus, // Closest status to Twilio failure
      },
    });

    logRecordingEvent(call.id, callSid, 'failed', { recordingSid, errorCode });

    await createCallActivityLog(
      call.id,
      'recording.failed',
      `Recording failed: ${errorCode || 'Unknown error'}`,
      {
        level: 'error',
        details: { recordingSid, errorCode },
        visibleToAffiliate: false,
        visibleToAdmin: true,
      }
    );
  }

  await markWebhookProcessed(recordingSid, 'recording', 'failed', {
    result: 'failure_recorded',
    errorCode,
  });

  return createAckResponse('Failure recorded');
}

/**
 * WHY: Process completed recording - download from Twilio, upload to S3.
 *      This is the main happy path for recording processing.
 *
 * WHEN: Twilio sends recording webhook with status = 'completed'.
 *
 * HOW:
 *   1. Find call record (may not exist yet - race condition)
 *   2. Download recording from Twilio with retry
 *   3. Upload to S3 with encryption
 *   4. Update call record with permanent URL
 *   5. Delete from Twilio (cost saving)
 */
async function processCompletedRecording(
  callSid: string,
  recordingSid: string,
  recordingUrl: string,
  payload: TwilioRecordingWebhook
): Promise<Response> {
  const startTime = Date.now();

  logger.info({
    event: 'recording.processing_started',
    message: 'Processing completed recording',
    callSid,
    recordingSid,
    durationSeconds: payload.RecordingDuration,
  });

  try {
    // ─────────────────────────────────────────────────────────────
    // Step 1: Find call record
    // ─────────────────────────────────────────────────────────────
    const call = await findCallByTwilioSid(callSid);

    if (!call) {
      // Recording webhook arrived before call record exists
      logger.warn({
        event: 'recording.call_not_found',
        message: 'Call record not found for recording - webhook arrived early',
        callSid,
        recordingSid,
      });

      Sentry.captureMessage('Recording webhook before call record', {
        level: 'warning',
        tags: { component: 'recording-webhook' },
        extra: { callSid, recordingSid },
      });

      // Don't fail - mark as processed so Twilio doesn't retry
      // The recording will be lost unless we implement queuing
      await markWebhookFailed(
        recordingSid,
        'recording',
        'completed',
        'Call record not found - webhook arrived before call creation'
      );

      return createAckResponse('Call not found');
    }

    // ─────────────────────────────────────────────────────────────
    // Step 2: Download recording from Twilio
    // ─────────────────────────────────────────────────────────────
    const downloadResult = await downloadRecordingWithRetry(recordingUrl, {
      maxRetries: 3,
      retryDelayMs: 2000,
    });

    if (!downloadResult.success || !downloadResult.data) {
      logger.error({
        event: 'recording.download_failed',
        message: 'Failed to download recording after retries',
        callId: call.id,
        callSid,
        recordingSid,
        error: downloadResult.error?.message,
        attempts: downloadResult.attempts,
      });

      // Update call with failure status but keep Twilio URL for manual recovery
      await prisma.call.update({
        where: { id: call.id },
        data: {
          recordingSid,
          recordingStatus: 'DOWNLOAD_FAILED' as RecordingStatus,
          recordingUrl: recordingUrl, // Keep Twilio URL for manual recovery
        },
      });

      await createCallActivityLog(
        call.id,
        'recording.download_failed',
        `Failed to download recording: ${downloadResult.error?.message}`,
        {
          level: 'error',
          details: {
            recordingSid,
            attempts: downloadResult.attempts,
            httpStatus: downloadResult.error?.httpStatus,
          },
          visibleToAffiliate: false,
          visibleToAdmin: true,
        }
      );

      await markWebhookFailed(recordingSid, 'recording', 'completed', 'Download failed');

      return createAckResponse('Download failed');
    }

    const recordingBuffer = downloadResult.data;

    // ─────────────────────────────────────────────────────────────
    // Step 3: Upload to S3
    // ─────────────────────────────────────────────────────────────
    const uploadResult = await uploadToS3WithRetry(
      recordingBuffer,
      call.id,
      recordingSid,
      { maxRetries: 3, retryDelayMs: 2000 }
    );

    if (!uploadResult.success || !uploadResult.s3Url) {
      logger.error({
        event: 'recording.upload_failed',
        message: 'Failed to upload recording to S3',
        callId: call.id,
        callSid,
        recordingSid,
        error: uploadResult.error,
        attempts: uploadResult.attempts,
      });

      // Keep Twilio URL as fallback for manual recovery
      await prisma.call.update({
        where: { id: call.id },
        data: {
          recordingSid,
          recordingStatus: 'UPLOAD_FAILED' as RecordingStatus,
          recordingUrl: recordingUrl, // Twilio URL as fallback
        },
      });

      await createCallActivityLog(
        call.id,
        'recording.upload_failed',
        `Failed to upload recording to storage: ${uploadResult.error}`,
        {
          level: 'error',
          details: {
            recordingSid,
            attempts: uploadResult.attempts,
            sizeBytes: recordingBuffer.length,
          },
          visibleToAffiliate: false,
          visibleToAdmin: true,
        }
      );

      await markWebhookFailed(recordingSid, 'recording', 'completed', 'S3 upload failed');

      return createAckResponse('Upload failed');
    }

    // ─────────────────────────────────────────────────────────────
    // Step 4: Update call record with permanent URL
    // ─────────────────────────────────────────────────────────────
    const recordingDuration = parseInt(payload.RecordingDuration, 10) || 0;

    await prisma.call.update({
      where: { id: call.id },
      data: {
        recordingSid,
        recordingUrl: uploadResult.s3Url,
        recordingDurationSeconds: recordingDuration,
        recordingStatus: 'AVAILABLE' as RecordingStatus,
      },
    });

    logRecordingEvent(call.id, callSid, 'available', {
      recordingSid,
      durationSeconds: recordingDuration,
      sizeBytes: recordingBuffer.length,
      s3Key: uploadResult.s3Key,
    });

    // Create affiliate-visible activity log
    const durationMinutes = Math.floor(recordingDuration / 60);
    const durationSeconds = recordingDuration % 60;
    const durationDisplay = `${durationMinutes}:${durationSeconds.toString().padStart(2, '0')}`;

    await createCallActivityLog(
      call.id,
      'recording.available',
      `Recording available (${durationDisplay})`,
      {
        level: 'info',
        details: { recordingSid, durationSeconds: recordingDuration },
        visibleToAffiliate: true,
        visibleToAdmin: true,
      }
    );

    // ─────────────────────────────────────────────────────────────
    // Step 5: Delete recording from Twilio (cost saving)
    // ─────────────────────────────────────────────────────────────
    // Fire-and-forget - don't block on Twilio deletion
    deleteTwilioRecording(recordingSid)
      .then((deleted) => {
        if (deleted) {
          logger.info({
            event: 'recording.twilio_cleanup',
            message: 'Deleted recording from Twilio',
            callId: call.id,
            recordingSid,
          });
        }
      })
      .catch((err) => {
        logger.warn({
          event: 'recording.twilio_cleanup_error',
          message: 'Failed to delete recording from Twilio',
          callId: call.id,
          recordingSid,
          error: (err as Error).message,
        });
      });

    // ─────────────────────────────────────────────────────────────
    // Success - mark as processed
    // ─────────────────────────────────────────────────────────────
    const processingTimeMs = Date.now() - startTime;

    logger.info({
      event: 'recording.processed',
      message: 'Recording processed successfully',
      callId: call.id,
      callSid,
      recordingSid,
      durationSeconds: recordingDuration,
      sizeBytes: recordingBuffer.length,
      processingTimeMs,
    });

    await markWebhookProcessed(recordingSid, 'recording', 'completed', {
      result: 'success',
      s3Url: uploadResult.s3Url,
      durationSeconds: recordingDuration,
      processingTimeMs,
    });

    Sentry.addBreadcrumb({
      category: 'recording.success',
      message: 'Recording processed successfully',
      level: 'info',
      data: { recordingSid, s3Url: uploadResult.s3Url },
    });

    return createAckResponse('OK');
  } catch (error) {
    // Catch any unexpected errors
    logger.error({
      event: 'recording.unexpected_error',
      message: 'Unexpected error processing recording',
      callSid,
      recordingSid,
      error: (error as Error).message,
    });

    Sentry.captureException(error, {
      tags: { component: 'recording-webhook' },
      extra: { callSid, recordingSid },
    });

    return createAckResponse('Error processing recording');
  }
}

// =====================================
// HELPER FUNCTIONS
// =====================================

/**
 * WHY: Find call by Twilio SID with minimal data for update.
 * WHEN: When processing recording webhook.
 * HOW: Query by twilioCallSid unique index.
 */
async function findCallByTwilioSid(
  twilioCallSid: string
): Promise<{ id: string } | null> {
  return prisma.call.findUnique({
    where: { twilioCallSid },
    select: { id: true },
  });
}

/**
 * WHY: Create a simple acknowledgment response for Twilio.
 * WHEN: After processing recording webhook.
 * HOW: Return 200 with plain text message.
 */
function createAckResponse(message: string): Response {
  return new Response(message, {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  });
}

// =====================================
// GET HANDLER (Configuration Testing)
// =====================================

/**
 * WHY: Twilio tries to GET the webhook URL during configuration.
 * WHEN: When admin sets up webhook URL in Twilio console.
 * HOW: Return 200 with helpful message.
 */
export async function GET() {
  return createWebhookErrorResponse(
    'Recording webhook endpoint. Configure in Twilio recordingStatusCallback.',
    false
  );
}
