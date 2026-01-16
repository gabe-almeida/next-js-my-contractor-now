/**
 * IVR Webhook Handler Tests
 *
 * WHY: Verify IVR qualification logic handles DTMF responses correctly.
 * WHEN: Run as part of test suite before deployment.
 * HOW: Test qualification, rejection, retry logic, and timeout handling.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { NextRequest } from 'next/server';

// Mock dependencies before importing handler
jest.mock('@/lib/prisma', () => ({
  prisma: require('@/test/mocks/prisma').mockPrismaClient,
}));

jest.mock('@/lib/twilio/verify-signature', () => ({
  withTwilioVerification: jest.fn((req, handler) => handler({})),
  createTwimlResponse: jest.fn((twiml: string) => new Response(twiml, {
    headers: { 'Content-Type': 'text/xml' },
  })),
  createWebhookErrorResponse: jest.fn(),
}));

jest.mock('@/lib/twilio/idempotency', () => ({
  isWebhookProcessed: jest.fn().mockResolvedValue(false),
  markWebhookProcessed: jest.fn().mockResolvedValue(undefined),
  markWebhookFailed: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/twilio/logging', () => ({
  logWebhookReceived: jest.fn(),
  createCallActivityLog: jest.fn().mockResolvedValue(undefined),
  logCallStateChange: jest.fn(),
}));

jest.mock('@/lib/twilio/twiml-builder', () => ({
  buildIvrGather: jest.fn().mockReturnValue('<Response><Gather/></Response>'),
  buildAnnouncement: jest.fn().mockReturnValue('<Response><Say/><Redirect/></Response>'),
  buildRejection: jest.fn().mockReturnValue('<Response><Say/><Hangup/></Response>'),
}));

jest.mock('@/lib/twilio/state-machine', () => ({
  validateTransition: jest.fn(),
}));

jest.mock('@sentry/nextjs', () => ({
  setTag: jest.fn(),
  setExtra: jest.fn(),
  captureException: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import {
  mockPrismaClient,
  mockCall,
  resetPrismaMocks,
} from '@/test/mocks/prisma';
import {
  createMockCall,
  resetFixtureCounters,
} from '@/test/fixtures/calls';
import { createIvrPayload } from '@/test/mocks/twilio';
import { withTwilioVerification } from '@/lib/twilio/verify-signature';
import { isWebhookProcessed } from '@/lib/twilio/idempotency';
import { buildIvrGather, buildAnnouncement, buildRejection } from '@/lib/twilio/twiml-builder';

// Import the handler after mocks are set up
import { POST } from '../ivr/route';

describe('IVR Webhook Handler', () => {
  let mockRequest: NextRequest;

  beforeEach(() => {
    resetPrismaMocks();
    resetFixtureCounters();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('DTMF digit parsing', () => {
    it('should parse digits from Twilio payload', async () => {
      // Arrange
      const call = createMockCall({ id: 'call-123', status: 'IVR', version: 1 });
      const payload = createIvrPayload('1', { CallSid: call.twilioCallSid });

      mockCall.findUnique.mockResolvedValue(call);
      mockCall.update.mockResolvedValue({ ...call, status: 'BIDDING' });

      (withTwilioVerification as jest.Mock).mockImplementation(
        async (req, handler) => handler(payload)
      );

      mockRequest = new NextRequest(
        'http://localhost/api/calls/ivr?callId=call-123&step=1&attempt=1',
        { method: 'POST' }
      );

      // Act
      await POST(mockRequest);

      // Assert
      expect(mockCall.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ivrResponses: expect.objectContaining({
              capturedData: expect.objectContaining({
                homeowner: 'yes',
              }),
            }),
          }),
        })
      );
    });
  });

  describe('qualification pass (press 1)', () => {
    it('should update status to BIDDING and redirect to auction', async () => {
      // Arrange
      const call = createMockCall({ id: 'call-123', status: 'IVR', version: 1 });
      const payload = createIvrPayload('1');

      mockCall.findUnique.mockResolvedValue(call);
      mockCall.update.mockResolvedValue({ ...call, status: 'BIDDING' });

      (withTwilioVerification as jest.Mock).mockImplementation(
        async (req, handler) => handler(payload)
      );

      mockRequest = new NextRequest(
        'http://localhost/api/calls/ivr?callId=call-123&step=1&attempt=1',
        { method: 'POST' }
      );

      // Act
      await POST(mockRequest);

      // Assert
      expect(mockCall.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'call-123', version: 1 },
          data: expect.objectContaining({
            status: 'BIDDING',
            isQualified: true,
          }),
        })
      );
      expect(buildAnnouncement).toHaveBeenCalledWith(
        expect.stringContaining('connect you with a specialist'),
        expect.objectContaining({
          redirectUrl: expect.stringContaining('/api/calls/auction'),
        })
      );
    });

    it('should record qualification timestamp in ivr_responses', async () => {
      // Arrange
      const call = createMockCall({ id: 'call-123', status: 'IVR', version: 1 });
      const payload = createIvrPayload('1');

      mockCall.findUnique.mockResolvedValue(call);
      mockCall.update.mockResolvedValue({ ...call, status: 'BIDDING' });

      (withTwilioVerification as jest.Mock).mockImplementation(
        async (req, handler) => handler(payload)
      );

      mockRequest = new NextRequest(
        'http://localhost/api/calls/ivr?callId=call-123&step=1',
        { method: 'POST' }
      );

      // Act
      await POST(mockRequest);

      // Assert
      expect(mockCall.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ivrResponses: expect.objectContaining({
              qualifiedAt: expect.any(String),
            }),
          }),
        })
      );
    });
  });

  describe('qualification fail (press 2)', () => {
    it('should update status to REJECTED and play rejection message', async () => {
      // Arrange
      const call = createMockCall({ id: 'call-123', status: 'IVR', version: 1 });
      const payload = createIvrPayload('2');

      mockCall.findUnique.mockResolvedValue(call);
      mockCall.update.mockResolvedValue({ ...call, status: 'REJECTED' });

      (withTwilioVerification as jest.Mock).mockImplementation(
        async (req, handler) => handler(payload)
      );

      mockRequest = new NextRequest(
        'http://localhost/api/calls/ivr?callId=call-123&step=1&attempt=1',
        { method: 'POST' }
      );

      // Act
      await POST(mockRequest);

      // Assert
      expect(mockCall.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'REJECTED',
            isQualified: false,
            hangupReason: 'IVR_REJECTED',
          }),
        })
      );
      expect(buildRejection).toHaveBeenCalledWith(
        expect.stringContaining('only available to homeowners')
      );
    });

    it('should record rejection reason in ivr_responses', async () => {
      // Arrange
      const call = createMockCall({ id: 'call-123', status: 'IVR', version: 1 });
      const payload = createIvrPayload('2');

      mockCall.findUnique.mockResolvedValue(call);
      mockCall.update.mockResolvedValue({});

      (withTwilioVerification as jest.Mock).mockImplementation(
        async (req, handler) => handler(payload)
      );

      mockRequest = new NextRequest(
        'http://localhost/api/calls/ivr?callId=call-123&step=1',
        { method: 'POST' }
      );

      // Act
      await POST(mockRequest);

      // Assert
      expect(mockCall.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ivrResponses: expect.objectContaining({
              rejectedAt: expect.any(String),
              rejectionReason: expect.stringContaining('Not a homeowner'),
            }),
          }),
        })
      );
    });
  });

  describe('repeat request (press 9)', () => {
    it('should replay IVR prompt without incrementing attempt', async () => {
      // Arrange
      const call = createMockCall({ id: 'call-123', status: 'IVR', version: 1 });
      const payload = createIvrPayload('9');

      mockCall.findUnique.mockResolvedValue(call);

      (withTwilioVerification as jest.Mock).mockImplementation(
        async (req, handler) => handler(payload)
      );

      mockRequest = new NextRequest(
        'http://localhost/api/calls/ivr?callId=call-123&step=1&attempt=2',
        { method: 'POST' }
      );

      // Act
      await POST(mockRequest);

      // Assert - Should use same attempt number
      expect(buildIvrGather).toHaveBeenCalledWith(
        expect.stringContaining('Press 1'),
        expect.stringContaining('attempt=2'),
        expect.any(Object)
      );
    });
  });

  describe('invalid input handling', () => {
    it('should retry on invalid digit (not 1, 2, or 9)', async () => {
      // Arrange
      const call = createMockCall({ id: 'call-123', status: 'IVR', version: 1 });
      const payload = createIvrPayload('5'); // Invalid digit

      mockCall.findUnique.mockResolvedValue(call);
      mockCall.update.mockResolvedValue({});

      (withTwilioVerification as jest.Mock).mockImplementation(
        async (req, handler) => handler(payload)
      );

      mockRequest = new NextRequest(
        'http://localhost/api/calls/ivr?callId=call-123&step=1&attempt=1',
        { method: 'POST' }
      );

      // Act
      await POST(mockRequest);

      // Assert - Should increment attempt
      expect(buildIvrGather).toHaveBeenCalledWith(
        expect.stringContaining("wasn't a valid option"),
        expect.stringContaining('attempt=2'),
        expect.any(Object)
      );
    });

    it('should fail after 3 invalid attempts', async () => {
      // Arrange
      const call = createMockCall({ id: 'call-123', status: 'IVR', version: 1 });
      const payload = createIvrPayload('5'); // Invalid digit

      mockCall.findUnique.mockResolvedValue(call);
      mockCall.update.mockResolvedValue({ ...call, status: 'FAILED' });

      (withTwilioVerification as jest.Mock).mockImplementation(
        async (req, handler) => handler(payload)
      );

      mockRequest = new NextRequest(
        'http://localhost/api/calls/ivr?callId=call-123&step=1&attempt=3', // Max attempts
        { method: 'POST' }
      );

      // Act
      await POST(mockRequest);

      // Assert
      expect(mockCall.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'FAILED',
            hangupReason: 'IVR_MAX_ATTEMPTS',
          }),
        })
      );
      expect(buildRejection).toHaveBeenCalledWith(
        expect.stringContaining('trouble receiving your response')
      );
    });
  });

  describe('timeout handling', () => {
    it('should retry on timeout (empty digits)', async () => {
      // Arrange
      const call = createMockCall({ id: 'call-123', status: 'IVR', version: 1 });
      const payload = createIvrPayload(''); // Empty = timeout

      mockCall.findUnique.mockResolvedValue(call);
      mockCall.update.mockResolvedValue({});

      (withTwilioVerification as jest.Mock).mockImplementation(
        async (req, handler) => handler(payload)
      );

      mockRequest = new NextRequest(
        'http://localhost/api/calls/ivr?callId=call-123&step=1&attempt=1',
        { method: 'POST' }
      );

      // Act
      await POST(mockRequest);

      // Assert - Should retry
      expect(buildIvrGather).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('attempt=2'),
        expect.any(Object)
      );
    });
  });

  describe('ivr_responses JSON update', () => {
    it('should append attempts to ivr_responses array', async () => {
      // Arrange
      const existingIvrData = {
        currentStep: 1,
        attempts: [
          { step: 1, attemptNumber: 1, input: '5', result: 'invalid', timestamp: '2024-01-01T00:00:00Z' },
        ],
        capturedData: {},
      };

      const call = createMockCall({
        id: 'call-123',
        status: 'IVR',
        version: 1,
        ivrResponses: existingIvrData,
      });
      const payload = createIvrPayload('1');

      mockCall.findUnique.mockResolvedValue(call);
      mockCall.update.mockResolvedValue({ ...call, status: 'BIDDING' });

      (withTwilioVerification as jest.Mock).mockImplementation(
        async (req, handler) => handler(payload)
      );

      mockRequest = new NextRequest(
        'http://localhost/api/calls/ivr?callId=call-123&step=1&attempt=2',
        { method: 'POST' }
      );

      // Act
      await POST(mockRequest);

      // Assert
      expect(mockCall.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ivrResponses: expect.objectContaining({
              attempts: expect.arrayContaining([
                expect.objectContaining({ attemptNumber: 1, input: '5', result: 'invalid' }),
                expect.objectContaining({ attemptNumber: 2, input: '1', result: 'valid' }),
              ]),
            }),
          }),
        })
      );
    });
  });

  describe('state validation', () => {
    it('should skip processing if call is not in IVR state', async () => {
      // Arrange
      const call = createMockCall({ id: 'call-123', status: 'COMPLETED', version: 1 });
      const payload = createIvrPayload('1');

      mockCall.findUnique.mockResolvedValue(call);

      (withTwilioVerification as jest.Mock).mockImplementation(
        async (req, handler) => handler(payload)
      );

      mockRequest = new NextRequest(
        'http://localhost/api/calls/ivr?callId=call-123&step=1',
        { method: 'POST' }
      );

      // Act
      await POST(mockRequest);

      // Assert - Should not update call
      expect(mockCall.update).not.toHaveBeenCalled();
    });

    it('should return error if call not found', async () => {
      // Arrange
      const payload = createIvrPayload('1');

      mockCall.findUnique.mockResolvedValue(null);

      (withTwilioVerification as jest.Mock).mockImplementation(
        async (req, handler) => handler(payload)
      );

      mockRequest = new NextRequest(
        'http://localhost/api/calls/ivr?callId=nonexistent&step=1',
        { method: 'POST' }
      );

      // Act
      await POST(mockRequest);

      // Assert
      expect(buildRejection).toHaveBeenCalledWith(
        expect.stringContaining('error occurred')
      );
    });
  });

  describe('idempotency', () => {
    it('should skip duplicate IVR responses', async () => {
      // Arrange
      (isWebhookProcessed as jest.Mock).mockResolvedValue(true);

      (withTwilioVerification as jest.Mock).mockImplementation(
        async (req, handler) => handler(createIvrPayload('1'))
      );

      mockRequest = new NextRequest(
        'http://localhost/api/calls/ivr?callId=call-123&step=1',
        { method: 'POST' }
      );

      // Act
      await POST(mockRequest);

      // Assert
      expect(mockCall.findUnique).not.toHaveBeenCalled();
    });
  });
});
