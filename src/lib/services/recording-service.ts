/**
 * Recording Service - S3 Upload/Download for Call Recordings
 *
 * WHY: Centralize call recording storage operations to ensure consistent
 *      handling of downloads from Twilio and uploads to S3 with encryption.
 *      Recordings are critical evidence for billing disputes and compliance.
 *
 * WHEN: Called by the recording webhook handler when Twilio sends
 *       a recording status callback after a call ends.
 *
 * HOW: Downloads recording from Twilio (with retry for 404s),
 *      uploads to S3 with AES-256 encryption, returns permanent URL.
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { logger } from '@/lib/logger';
import * as Sentry from '@sentry/nextjs';

// =====================================
// S3 CLIENT INITIALIZATION
// =====================================

/**
 * WHY: Centralized S3 client with credentials from environment.
 * WHEN: Used for all S3 operations in recording service.
 * HOW: Uses AWS SDK v3 with optional explicit credentials.
 */
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: process.env.AWS_ACCESS_KEY_ID
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      }
    : undefined, // Use default credential chain if not explicitly set
});

// S3 bucket for recordings (supports both env var names)
const S3_BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || process.env.AWS_S3_BUCKET;

// =====================================
// TYPE DEFINITIONS
// =====================================

/**
 * Options for downloading recordings with retry logic
 */
export interface DownloadOptions {
  maxRetries: number;
  retryDelayMs: number;
}

/**
 * Options for uploading recordings to S3
 */
export interface UploadOptions {
  maxRetries: number;
  retryDelayMs: number;
}

/**
 * Result of a recording download operation
 */
export interface DownloadResult {
  success: boolean;
  data?: Buffer;
  error?: {
    httpStatus?: number;
    message: string;
    retryable: boolean;
  };
  attempts: number;
}

/**
 * Result of an S3 upload operation
 */
export interface UploadResult {
  success: boolean;
  s3Url?: string;
  s3Key?: string;
  error?: string;
  attempts: number;
}

// =====================================
// RETRY STRATEGY CONSTANTS
// =====================================

/**
 * WHY: Different HTTP status codes require different retry strategies.
 *      404 is expected initially (recording not yet ready).
 *      429/5xx are transient and should be retried.
 *      401/403/410 are permanent and should not be retried.
 * WHEN: Used when determining if a failed download should be retried.
 * HOW: Map HTTP status to retry decision and delay.
 */
const DOWNLOAD_RETRY_STRATEGY: Record<number, { retryable: boolean; delayMs: number }> = {
  401: { retryable: false, delayMs: 0 }, // Auth error - fix config
  403: { retryable: false, delayMs: 0 }, // Permission error - permanent
  404: { retryable: true, delayMs: 2000 }, // Not ready yet - wait and retry
  410: { retryable: false, delayMs: 0 }, // Deleted - cannot recover
  429: { retryable: true, delayMs: 5000 }, // Rate limited - back off
  500: { retryable: true, delayMs: 3000 }, // Server error - retry
  503: { retryable: true, delayMs: 5000 }, // Overloaded - wait longer
};

// =====================================
// DOWNLOAD FROM TWILIO
// =====================================

/**
 * WHY: Download recording from Twilio's temporary URL with retry logic.
 *      Twilio recordings may not be immediately available after webhook.
 *      Temporary URLs require Basic Auth with AccountSid:AuthToken.
 *
 * WHEN: Called when recording webhook arrives with 'completed' status.
 *
 * HOW:
 *   1. Build auth header from Twilio credentials
 *   2. Add .mp3 extension to URL for MP3 format
 *   3. Fetch with retry logic for 404 (not yet ready)
 *   4. Return Buffer of audio data
 */
export async function downloadRecordingWithRetry(
  recordingUrl: string,
  options: DownloadOptions = { maxRetries: 3, retryDelayMs: 2000 }
): Promise<DownloadResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    return {
      success: false,
      error: {
        message: 'Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN',
        retryable: false,
      },
      attempts: 0,
    };
  }

  // Build Basic Auth header
  const authHeader = `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`;
  const downloadUrl = `${recordingUrl}.mp3`; // Request MP3 format

  let lastError: { httpStatus?: number; message: string; retryable: boolean } | undefined;

  for (let attempt = 1; attempt <= options.maxRetries; attempt++) {
    try {
      logger.debug({
        event: 'recording.download_attempt',
        message: `Download attempt ${attempt}/${options.maxRetries}`,
        url: downloadUrl,
        attempt,
      });

      const response = await fetch(downloadUrl, {
        headers: {
          Authorization: authHeader,
        },
      });

      // Handle specific status codes
      if (!response.ok) {
        const strategy = DOWNLOAD_RETRY_STRATEGY[response.status] || {
          retryable: false,
          delayMs: 0,
        };

        lastError = {
          httpStatus: response.status,
          message: `HTTP ${response.status}: ${response.statusText}`,
          retryable: strategy.retryable,
        };

        // If not retryable, return immediately
        if (!strategy.retryable) {
          logger.warn({
            event: 'recording.download_failed_permanent',
            message: `Download failed with non-retryable status: ${response.status}`,
            url: downloadUrl,
            httpStatus: response.status,
            attempt,
          });

          return {
            success: false,
            error: lastError,
            attempts: attempt,
          };
        }

        // Retryable error - wait and continue
        logger.info({
          event: 'recording.download_retry',
          message: `Download returned ${response.status}, retrying...`,
          url: downloadUrl,
          httpStatus: response.status,
          attempt,
          nextAttemptDelayMs: strategy.delayMs * attempt,
        });

        await sleep(strategy.delayMs * attempt); // Exponential backoff
        continue;
      }

      // Success - convert to Buffer
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      logger.info({
        event: 'recording.download_success',
        message: 'Recording downloaded successfully',
        url: downloadUrl,
        sizeBytes: buffer.length,
        attempt,
      });

      return {
        success: true,
        data: buffer,
        attempts: attempt,
      };
    } catch (error) {
      lastError = {
        message: (error as Error).message,
        retryable: true,
      };

      logger.warn({
        event: 'recording.download_error',
        message: `Download attempt ${attempt} failed: ${(error as Error).message}`,
        url: downloadUrl,
        attempt,
        error: (error as Error).message,
      });

      // Wait before retry
      if (attempt < options.maxRetries) {
        await sleep(options.retryDelayMs * attempt);
      }
    }
  }

  // All retries exhausted
  logger.error({
    event: 'recording.download_failed',
    message: 'Download failed after all retries',
    url: downloadUrl,
    attempts: options.maxRetries,
    lastError,
  });

  Sentry.captureException(new Error('Recording download failed after all retries'), {
    tags: { component: 'recording-service', operation: 'download' },
    extra: { url: downloadUrl, attempts: options.maxRetries, lastError },
  });

  return {
    success: false,
    error: lastError,
    attempts: options.maxRetries,
  };
}

// =====================================
// UPLOAD TO S3
// =====================================

/**
 * WHY: Upload recording to S3 with server-side encryption for secure storage.
 *      Recordings contain sensitive call data and must be encrypted at rest.
 *      S3 provides durable, long-term storage vs Twilio's temporary URLs.
 *
 * WHEN: Called after successfully downloading recording from Twilio.
 *
 * HOW:
 *   1. Build S3 key from callId and recordingSid
 *   2. Upload with PutObjectCommand and AES-256 encryption
 *   3. Return permanent S3 URL
 */
export async function uploadToS3WithRetry(
  buffer: Buffer,
  callId: string,
  recordingSid: string,
  options: UploadOptions = { maxRetries: 3, retryDelayMs: 2000 }
): Promise<UploadResult> {
  if (!S3_BUCKET_NAME) {
    return {
      success: false,
      error: 'S3 bucket not configured. Set AWS_S3_BUCKET_NAME or AWS_S3_BUCKET',
      attempts: 0,
    };
  }

  const s3Key = `recordings/${callId}/${recordingSid}.mp3`;
  let lastError: string | undefined;

  for (let attempt = 1; attempt <= options.maxRetries; attempt++) {
    try {
      logger.debug({
        event: 'recording.upload_attempt',
        message: `S3 upload attempt ${attempt}/${options.maxRetries}`,
        bucket: S3_BUCKET_NAME,
        key: s3Key,
        sizeBytes: buffer.length,
        attempt,
      });

      const command = new PutObjectCommand({
        Bucket: S3_BUCKET_NAME,
        Key: s3Key,
        Body: buffer,
        ContentType: 'audio/mpeg',
        ServerSideEncryption: 'AES256', // Enable AES-256 encryption at rest
        Metadata: {
          callId,
          recordingSid,
          uploadedAt: new Date().toISOString(),
        },
      });

      await s3Client.send(command);

      // Build S3 URL (public URL or use signed URL later for access)
      const s3Url = `https://${S3_BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${s3Key}`;

      logger.info({
        event: 'recording.upload_success',
        message: 'Recording uploaded to S3 successfully',
        bucket: S3_BUCKET_NAME,
        key: s3Key,
        sizeBytes: buffer.length,
        attempt,
      });

      return {
        success: true,
        s3Url,
        s3Key,
        attempts: attempt,
      };
    } catch (error) {
      lastError = (error as Error).message;

      logger.warn({
        event: 'recording.upload_error',
        message: `S3 upload attempt ${attempt} failed: ${lastError}`,
        bucket: S3_BUCKET_NAME,
        key: s3Key,
        attempt,
        error: lastError,
      });

      // Wait before retry
      if (attempt < options.maxRetries) {
        await sleep(options.retryDelayMs * attempt);
      }
    }
  }

  // All retries exhausted
  logger.error({
    event: 'recording.upload_failed',
    message: 'S3 upload failed after all retries',
    bucket: S3_BUCKET_NAME,
    key: s3Key,
    attempts: options.maxRetries,
    lastError,
  });

  Sentry.captureException(new Error('S3 upload failed after all retries'), {
    tags: { component: 'recording-service', operation: 'upload', storage: 's3' },
    extra: { bucket: S3_BUCKET_NAME, key: s3Key, attempts: options.maxRetries, lastError },
  });

  return {
    success: false,
    error: lastError,
    attempts: options.maxRetries,
  };
}

// =====================================
// GENERATE SIGNED URL
// =====================================

/**
 * WHY: Generate pre-signed URL for secure recording access.
 *      Recordings are stored privately and require signed URLs for playback.
 *      Signed URLs expire after a set time for security.
 *
 * WHEN: User requests to play or download a recording.
 *
 * HOW: Use AWS SDK getSignedUrl with configurable expiration.
 */
export async function generateSignedUrl(
  s3Key: string,
  expiresInSeconds: number = 3600 // Default 1 hour
): Promise<string | null> {
  if (!S3_BUCKET_NAME) {
    logger.error({
      event: 'recording.signed_url_failed',
      message: 'S3 bucket not configured',
    });
    return null;
  }

  try {
    const command = new GetObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: s3Key,
    });

    const signedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: expiresInSeconds,
    });

    logger.debug({
      event: 'recording.signed_url_generated',
      message: 'Generated signed URL for recording',
      key: s3Key,
      expiresIn: expiresInSeconds,
    });

    return signedUrl;
  } catch (error) {
    logger.error({
      event: 'recording.signed_url_error',
      message: 'Failed to generate signed URL',
      key: s3Key,
      error: (error as Error).message,
    });

    Sentry.captureException(error, {
      tags: { component: 'recording-service', operation: 'signed_url' },
      extra: { key: s3Key },
    });

    return null;
  }
}

// =====================================
// DELETE FROM S3 (GDPR)
// =====================================

/**
 * WHY: Delete recording from S3 for GDPR compliance.
 *      Users have the right to request deletion of their data.
 *      Recordings contain PII (voice data) and must be deletable.
 *
 * WHEN: GDPR deletion request received for a caller's phone number.
 *
 * HOW: Use DeleteObjectCommand to remove recording from S3.
 */
export async function deleteRecordingFromS3(s3Key: string): Promise<boolean> {
  if (!S3_BUCKET_NAME) {
    logger.error({
      event: 'recording.delete_failed',
      message: 'S3 bucket not configured',
    });
    return false;
  }

  try {
    const command = new DeleteObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: s3Key,
    });

    await s3Client.send(command);

    logger.info({
      event: 'recording.deleted',
      message: 'Recording deleted from S3',
      key: s3Key,
    });

    return true;
  } catch (error) {
    logger.error({
      event: 'recording.delete_error',
      message: 'Failed to delete recording from S3',
      key: s3Key,
      error: (error as Error).message,
    });

    Sentry.captureException(error, {
      tags: { component: 'recording-service', operation: 'delete' },
      extra: { key: s3Key },
    });

    return false;
  }
}

// =====================================
// TWILIO RECORDING DELETION
// =====================================

/**
 * WHY: Delete recording from Twilio after S3 upload succeeds.
 *      Twilio charges for recording storage - deleting saves costs.
 *      We have our own copy in S3, so Twilio copy is redundant.
 *
 * WHEN: Called immediately after successful S3 upload (MVP approach)
 *       OR scheduled for 24h later (safer for recovery).
 *
 * HOW: Call Twilio API to delete recording by RecordingSid.
 */
export async function deleteTwilioRecording(recordingSid: string): Promise<boolean> {
  try {
    // Dynamic import to avoid bundling twilio in client
    const { getTwilioClient } = await import('@/lib/twilio/client');
    const client = getTwilioClient();

    await client.recordings(recordingSid).remove();

    logger.info({
      event: 'recording.twilio_deleted',
      message: 'Recording deleted from Twilio',
      recordingSid,
    });

    return true;
  } catch (error) {
    logger.warn({
      event: 'recording.twilio_delete_error',
      message: 'Failed to delete recording from Twilio',
      recordingSid,
      error: (error as Error).message,
    });

    // Don't throw - Twilio deletion failure is not critical
    return false;
  }
}

// =====================================
// HELPER FUNCTIONS
// =====================================

/**
 * WHY: Simple sleep utility for retry delays.
 * WHEN: Between retry attempts for download/upload.
 * HOW: Promise-based setTimeout wrapper.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * WHY: Extract S3 key from recording URL for operations.
 * WHEN: Need to perform S3 operations on a recording by URL.
 * HOW: Parse URL and extract the key portion.
 */
export function extractS3KeyFromUrl(recordingUrl: string): string | null {
  if (!recordingUrl) return null;

  try {
    const url = new URL(recordingUrl);
    // S3 URL format: https://bucket.s3.region.amazonaws.com/key
    const pathParts = url.pathname.split('/').filter(Boolean);
    return pathParts.join('/');
  } catch {
    logger.warn({
      event: 'recording.url_parse_error',
      message: 'Failed to parse S3 URL',
      url: recordingUrl,
    });
    return null;
  }
}

/**
 * WHY: Build S3 key from call metadata.
 * WHEN: Constructing key for upload or lookup.
 * HOW: Use consistent pattern: recordings/{callId}/{recordingSid}.mp3
 */
export function buildS3Key(callId: string, recordingSid: string): string {
  return `recordings/${callId}/${recordingSid}.mp3`;
}
