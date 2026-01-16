/**
 * Recording Service Tests
 *
 * WHY: Verify recording storage operations handle all scenarios correctly.
 * WHEN: Run as part of test suite before deployment.
 * HOW: Test download with retry, S3 upload, signed URLs, and deletion.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock AWS SDK before importing service
const mockSend = jest.fn();
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: mockSend,
  })),
  PutObjectCommand: jest.fn().mockImplementation((params) => ({ input: params })),
  GetObjectCommand: jest.fn().mockImplementation((params) => ({ input: params })),
  DeleteObjectCommand: jest.fn().mockImplementation((params) => ({ input: params })),
}));

const mockGetSignedUrl = jest.fn();
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: mockGetSignedUrl,
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@sentry/nextjs', () => ({
  captureException: jest.fn(),
}));

// Mock Twilio client
const mockRemove = jest.fn();
jest.mock('@/lib/twilio/client', () => ({
  getTwilioClient: jest.fn(() => ({
    recordings: jest.fn(() => ({
      remove: mockRemove,
    })),
  })),
}));

// Set environment variables
const originalEnv = process.env;

beforeEach(() => {
  process.env = {
    ...originalEnv,
    TWILIO_ACCOUNT_SID: 'AC_test_account_sid',
    TWILIO_AUTH_TOKEN: 'test_auth_token',
    AWS_S3_BUCKET_NAME: 'test-recordings-bucket',
    AWS_REGION: 'us-east-1',
    AWS_ACCESS_KEY_ID: 'test_access_key',
    AWS_SECRET_ACCESS_KEY: 'test_secret_key',
  };
});

afterEach(() => {
  process.env = originalEnv;
  jest.clearAllMocks();
});

// Import service after mocks are set up
import {
  downloadRecordingWithRetry,
  uploadToS3WithRetry,
  generateSignedUrl,
  deleteRecordingFromS3,
  deleteTwilioRecording,
  extractS3KeyFromUrl,
  buildS3Key,
} from '../recording-service';

describe('Recording Service', () => {
  describe('downloadRecordingWithRetry', () => {
    const testRecordingUrl = 'https://api.twilio.com/2010-04-01/Accounts/AC123/Recordings/RE123';

    beforeEach(() => {
      // Reset fetch mock
      global.fetch = jest.fn() as jest.Mock;
    });

    it('should download recording successfully on first attempt', async () => {
      // Arrange
      const audioBuffer = Buffer.from('mock audio data');
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(audioBuffer.buffer),
      });

      // Act
      const result = await downloadRecordingWithRetry(testRecordingUrl);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toEqual(audioBuffer);
      expect(result.attempts).toBe(1);
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith(
        `${testRecordingUrl}.mp3`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.stringMatching(/^Basic /),
          }),
        })
      );
    });

    it('should retry on 404 and succeed when recording becomes available', async () => {
      // Arrange
      const audioBuffer = Buffer.from('mock audio data');
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found',
        })
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(audioBuffer.buffer),
        });

      // Act
      const result = await downloadRecordingWithRetry(testRecordingUrl, {
        maxRetries: 3,
        retryDelayMs: 10, // Shorter delay for tests
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toEqual(audioBuffer);
      expect(result.attempts).toBe(2);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should fail immediately on 401 Unauthorized', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      // Act
      const result = await downloadRecordingWithRetry(testRecordingUrl);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error?.httpStatus).toBe(401);
      expect(result.error?.retryable).toBe(false);
      expect(result.attempts).toBe(1);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should fail immediately on 403 Forbidden', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      });

      // Act
      const result = await downloadRecordingWithRetry(testRecordingUrl);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error?.httpStatus).toBe(403);
      expect(result.error?.retryable).toBe(false);
      expect(result.attempts).toBe(1);
    });

    it('should fail immediately on 410 Gone (recording deleted)', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 410,
        statusText: 'Gone',
      });

      // Act
      const result = await downloadRecordingWithRetry(testRecordingUrl);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error?.httpStatus).toBe(410);
      expect(result.error?.retryable).toBe(false);
      expect(result.attempts).toBe(1);
    });

    it('should retry on 429 rate limiting', async () => {
      // Arrange
      const audioBuffer = Buffer.from('mock audio data');
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
        })
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(audioBuffer.buffer),
        });

      // Act
      const result = await downloadRecordingWithRetry(testRecordingUrl, {
        maxRetries: 3,
        retryDelayMs: 10,
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.attempts).toBe(2);
    });

    it('should retry on 500 server error', async () => {
      // Arrange
      const audioBuffer = Buffer.from('mock audio data');
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        })
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(audioBuffer.buffer),
        });

      // Act
      const result = await downloadRecordingWithRetry(testRecordingUrl, {
        maxRetries: 3,
        retryDelayMs: 10,
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.attempts).toBe(2);
    });

    it('should fail after exhausting all retries', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      // Act
      const result = await downloadRecordingWithRetry(testRecordingUrl, {
        maxRetries: 3,
        retryDelayMs: 10,
      });

      // Assert
      expect(result.success).toBe(false);
      expect(result.error?.httpStatus).toBe(404);
      expect(result.attempts).toBe(3);
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should handle network errors and retry', async () => {
      // Arrange
      const audioBuffer = Buffer.from('mock audio data');
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(audioBuffer.buffer),
        });

      // Act
      const result = await downloadRecordingWithRetry(testRecordingUrl, {
        maxRetries: 3,
        retryDelayMs: 10,
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.attempts).toBe(2);
    });

    it('should return error if Twilio credentials are missing', async () => {
      // Arrange
      delete process.env.TWILIO_ACCOUNT_SID;

      // Re-import to pick up env change - but module is cached
      // Instead, test the early return behavior
      const result = await downloadRecordingWithRetry(testRecordingUrl);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Missing TWILIO_ACCOUNT_SID');
      expect(result.attempts).toBe(0);
    });
  });

  describe('uploadToS3WithRetry', () => {
    const testBuffer = Buffer.from('mock audio data');
    const testCallId = 'call-123';
    const testRecordingSid = 'RE123456';

    it('should upload recording to S3 successfully', async () => {
      // Arrange
      mockSend.mockResolvedValue({});

      // Act
      const result = await uploadToS3WithRetry(testBuffer, testCallId, testRecordingSid);

      // Assert
      expect(result.success).toBe(true);
      expect(result.s3Key).toBe(`recordings/${testCallId}/${testRecordingSid}.mp3`);
      expect(result.s3Url).toContain('test-recordings-bucket');
      expect(result.attempts).toBe(1);
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('should use AES-256 encryption', async () => {
      // Arrange
      mockSend.mockResolvedValue({});
      const { PutObjectCommand } = require('@aws-sdk/client-s3');

      // Act
      await uploadToS3WithRetry(testBuffer, testCallId, testRecordingSid);

      // Assert
      expect(PutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          ServerSideEncryption: 'AES256',
        })
      );
    });

    it('should include metadata in upload', async () => {
      // Arrange
      mockSend.mockResolvedValue({});
      const { PutObjectCommand } = require('@aws-sdk/client-s3');

      // Act
      await uploadToS3WithRetry(testBuffer, testCallId, testRecordingSid);

      // Assert
      expect(PutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Metadata: expect.objectContaining({
            callId: testCallId,
            recordingSid: testRecordingSid,
          }),
        })
      );
    });

    it('should retry on S3 upload failure', async () => {
      // Arrange
      mockSend
        .mockRejectedValueOnce(new Error('S3 connection timeout'))
        .mockResolvedValueOnce({});

      // Act
      const result = await uploadToS3WithRetry(testBuffer, testCallId, testRecordingSid, {
        maxRetries: 3,
        retryDelayMs: 10,
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.attempts).toBe(2);
      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it('should fail after exhausting retries', async () => {
      // Arrange
      mockSend.mockRejectedValue(new Error('S3 unavailable'));

      // Act
      const result = await uploadToS3WithRetry(testBuffer, testCallId, testRecordingSid, {
        maxRetries: 3,
        retryDelayMs: 10,
      });

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('S3 unavailable');
      expect(result.attempts).toBe(3);
    });

    it('should return error if S3 bucket is not configured', async () => {
      // Arrange
      delete process.env.AWS_S3_BUCKET_NAME;
      delete process.env.AWS_S3_BUCKET;

      // Act
      const result = await uploadToS3WithRetry(testBuffer, testCallId, testRecordingSid);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('S3 bucket not configured');
      expect(result.attempts).toBe(0);
    });

    it('should build correct S3 URL with region', async () => {
      // Arrange
      mockSend.mockResolvedValue({});

      // Act
      const result = await uploadToS3WithRetry(testBuffer, testCallId, testRecordingSid);

      // Assert
      expect(result.s3Url).toBe(
        `https://test-recordings-bucket.s3.us-east-1.amazonaws.com/recordings/${testCallId}/${testRecordingSid}.mp3`
      );
    });
  });

  describe('generateSignedUrl', () => {
    const testS3Key = 'recordings/call-123/RE123.mp3';

    it('should generate signed URL successfully', async () => {
      // Arrange
      const expectedUrl = 'https://test-bucket.s3.amazonaws.com/recordings/call-123/RE123.mp3?X-Amz-Signature=abc123';
      mockGetSignedUrl.mockResolvedValue(expectedUrl);

      // Act
      const result = await generateSignedUrl(testS3Key);

      // Assert
      expect(result).toBe(expectedUrl);
      expect(mockGetSignedUrl).toHaveBeenCalledTimes(1);
    });

    it('should use default 1 hour expiration', async () => {
      // Arrange
      mockGetSignedUrl.mockResolvedValue('https://signed-url');

      // Act
      await generateSignedUrl(testS3Key);

      // Assert
      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          expiresIn: 3600,
        })
      );
    });

    it('should use custom expiration time', async () => {
      // Arrange
      mockGetSignedUrl.mockResolvedValue('https://signed-url');

      // Act
      await generateSignedUrl(testS3Key, 7200);

      // Assert
      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          expiresIn: 7200,
        })
      );
    });

    it('should return null if S3 bucket is not configured', async () => {
      // Arrange
      delete process.env.AWS_S3_BUCKET_NAME;
      delete process.env.AWS_S3_BUCKET;

      // Act
      const result = await generateSignedUrl(testS3Key);

      // Assert
      expect(result).toBeNull();
    });

    it('should return null and log error on failure', async () => {
      // Arrange
      mockGetSignedUrl.mockRejectedValue(new Error('AWS credentials expired'));
      const { captureException } = require('@sentry/nextjs');

      // Act
      const result = await generateSignedUrl(testS3Key);

      // Assert
      expect(result).toBeNull();
      expect(captureException).toHaveBeenCalled();
    });
  });

  describe('deleteRecordingFromS3', () => {
    const testS3Key = 'recordings/call-123/RE123.mp3';

    it('should delete recording from S3 successfully', async () => {
      // Arrange
      mockSend.mockResolvedValue({});

      // Act
      const result = await deleteRecordingFromS3(testS3Key);

      // Assert
      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('should return false if S3 bucket is not configured', async () => {
      // Arrange
      delete process.env.AWS_S3_BUCKET_NAME;
      delete process.env.AWS_S3_BUCKET;

      // Act
      const result = await deleteRecordingFromS3(testS3Key);

      // Assert
      expect(result).toBe(false);
    });

    it('should return false and log error on deletion failure', async () => {
      // Arrange
      mockSend.mockRejectedValue(new Error('Access denied'));
      const { captureException } = require('@sentry/nextjs');

      // Act
      const result = await deleteRecordingFromS3(testS3Key);

      // Assert
      expect(result).toBe(false);
      expect(captureException).toHaveBeenCalled();
    });
  });

  describe('deleteTwilioRecording', () => {
    const testRecordingSid = 'RE123456';

    it('should delete recording from Twilio successfully', async () => {
      // Arrange
      mockRemove.mockResolvedValue({});

      // Act
      const result = await deleteTwilioRecording(testRecordingSid);

      // Assert
      expect(result).toBe(true);
    });

    it('should return false on deletion failure without throwing', async () => {
      // Arrange
      mockRemove.mockRejectedValue(new Error('Twilio API error'));

      // Act
      const result = await deleteTwilioRecording(testRecordingSid);

      // Assert - Should not throw
      expect(result).toBe(false);
    });
  });

  describe('extractS3KeyFromUrl', () => {
    it('should extract key from S3 URL', () => {
      // Arrange
      const url = 'https://test-bucket.s3.us-east-1.amazonaws.com/recordings/call-123/RE123.mp3';

      // Act
      const result = extractS3KeyFromUrl(url);

      // Assert
      expect(result).toBe('recordings/call-123/RE123.mp3');
    });

    it('should return null for empty URL', () => {
      // Act
      const result = extractS3KeyFromUrl('');

      // Assert
      expect(result).toBeNull();
    });

    it('should return null for invalid URL', () => {
      // Act
      const result = extractS3KeyFromUrl('not-a-valid-url');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('buildS3Key', () => {
    it('should build correct S3 key', () => {
      // Arrange
      const callId = 'call-abc123';
      const recordingSid = 'RE987654';

      // Act
      const result = buildS3Key(callId, recordingSid);

      // Assert
      expect(result).toBe('recordings/call-abc123/RE987654.mp3');
    });
  });
});

describe('Recording Service Integration Scenarios', () => {
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      TWILIO_ACCOUNT_SID: 'AC_test_account_sid',
      TWILIO_AUTH_TOKEN: 'test_auth_token',
      AWS_S3_BUCKET_NAME: 'test-recordings-bucket',
      AWS_REGION: 'us-east-1',
      AWS_ACCESS_KEY_ID: 'test_access_key',
      AWS_SECRET_ACCESS_KEY: 'test_secret_key',
    };
    global.fetch = jest.fn() as jest.Mock;
  });

  describe('Full recording workflow', () => {
    it('should handle download → upload → signed URL workflow', async () => {
      // Arrange - Download succeeds
      const audioBuffer = Buffer.from('mock audio data');
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(audioBuffer.buffer),
      });

      // Arrange - Upload succeeds
      mockSend.mockResolvedValue({});

      // Arrange - Signed URL generation
      const signedUrl = 'https://signed-url.example.com';
      mockGetSignedUrl.mockResolvedValue(signedUrl);

      // Act - Download
      const downloadResult = await downloadRecordingWithRetry(
        'https://api.twilio.com/Recordings/RE123',
        { maxRetries: 3, retryDelayMs: 10 }
      );

      // Assert - Download
      expect(downloadResult.success).toBe(true);

      // Act - Upload
      const uploadResult = await uploadToS3WithRetry(
        downloadResult.data!,
        'call-123',
        'RE123',
        { maxRetries: 3, retryDelayMs: 10 }
      );

      // Assert - Upload
      expect(uploadResult.success).toBe(true);

      // Act - Generate signed URL
      const url = await generateSignedUrl(uploadResult.s3Key!);

      // Assert - Signed URL
      expect(url).toBe(signedUrl);
    });

    it('should handle GDPR deletion workflow', async () => {
      // Arrange
      mockSend.mockResolvedValue({});
      mockRemove.mockResolvedValue({});

      // Act - Delete from S3
      const s3Result = await deleteRecordingFromS3('recordings/call-123/RE123.mp3');

      // Act - Delete from Twilio
      const twilioResult = await deleteTwilioRecording('RE123');

      // Assert
      expect(s3Result).toBe(true);
      expect(twilioResult).toBe(true);
    });
  });

  describe('Error recovery scenarios', () => {
    it('should handle Twilio recording not ready (multiple 404s then success)', async () => {
      // Arrange - Simulate recording not ready for 2 attempts
      const audioBuffer = Buffer.from('mock audio data');
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: false, status: 404, statusText: 'Not Found' })
        .mockResolvedValueOnce({ ok: false, status: 404, statusText: 'Not Found' })
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(audioBuffer.buffer),
        });

      // Act
      const result = await downloadRecordingWithRetry(
        'https://api.twilio.com/Recordings/RE123',
        { maxRetries: 5, retryDelayMs: 10 }
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.attempts).toBe(3);
    });

    it('should handle S3 temporary outage with retry', async () => {
      // Arrange
      mockSend
        .mockRejectedValueOnce(new Error('Connection reset'))
        .mockRejectedValueOnce(new Error('Connection reset'))
        .mockResolvedValueOnce({});

      // Act
      const result = await uploadToS3WithRetry(
        Buffer.from('audio'),
        'call-123',
        'RE123',
        { maxRetries: 5, retryDelayMs: 10 }
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.attempts).toBe(3);
    });
  });
});
