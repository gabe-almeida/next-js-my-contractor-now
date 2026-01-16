/**
 * Call Completion Webhook Handler Tests
 *
 * WHY: Verify call completion correctly determines billability and calculates payouts.
 * WHEN: Run as part of test suite before deployment.
 * HOW: Test payout calculation, disposition mapping, affiliate postback, and edge cases.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { NextRequest } from 'next/server';
import { Decimal } from '@prisma/client/runtime/library';

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
  logBillingEvent: jest.fn(),
}));

jest.mock('@/lib/twilio/twiml-builder', () => ({
  buildEmptyResponse: jest.fn().mockReturnValue('<Response/>'),
}));

jest.mock('@/lib/twilio/state-machine', () => ({
  validateTransition: jest.fn(),
  mapDialStatus: jest.fn().mockReturnValue('COMPLETED'),
  isTerminalStatus: jest.fn().mockReturnValue(false),
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

// Mock fetch for postback
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

import {
  mockPrismaClient,
  mockCall,
  resetPrismaMocks,
} from '@/test/mocks/prisma';
import {
  createMockCall,
  createMockCompletedCall,
  createMockCampaign,
  createMockAffiliate,
  resetFixtureCounters,
} from '@/test/fixtures/calls';
import { createCompletionPayload } from '@/test/mocks/twilio';
import { withTwilioVerification } from '@/lib/twilio/verify-signature';
import { isWebhookProcessed } from '@/lib/twilio/idempotency';
import { mapDialStatus, isTerminalStatus } from '@/lib/twilio/state-machine';

// Import the handler after mocks are set up
import { POST } from '../completed/route';

describe('Call Completion Webhook Handler', () => {
  let mockRequest: NextRequest;

  beforeEach(() => {
    resetPrismaMocks();
    resetFixtureCounters();
    jest.clearAllMocks();
    mockFetch.mockReset();

    // Default mocks
    (mapDialStatus as jest.Mock).mockReturnValue('COMPLETED');
    (isTerminalStatus as jest.Mock).mockReturnValue(false);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('payout calculation', () => {
    it('should mark call as billable when all criteria met', async () => {
      // Arrange
      const campaign = createMockCampaign({
        callBasePayout: new Decimal(35),
        minCallDuration: 90, // 90 seconds
        requireIvrQualification: true,
      });

      const call = createMockCall({
        id: 'call-123',
        status: 'CONNECTED',
        isQualified: true,
        winningBuyerId: 'buyer-1',
        winningBid: new Decimal(45),
        version: 1,
      });

      const payload = createCompletionPayload({
        CallSid: call.twilioCallSid,
        CallDuration: '180', // Total duration
        DialCallDuration: '120', // 2 minutes connected (> 90s)
        DialCallStatus: 'completed',
        DialBridged: 'true',
      });

      (withTwilioVerification as jest.Mock).mockImplementation(
        async (req, handler) => handler(payload)
      );

      mockCall.findUnique.mockResolvedValue({
        ...call,
        campaign,
        affiliate: null,
      });
      mockCall.update.mockResolvedValue(call);

      mockRequest = new NextRequest(
        'http://localhost/api/calls/completed?callId=call-123',
        { method: 'POST' }
      );

      // Act
      await POST(mockRequest);

      // Assert
      expect(mockCall.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'call-123', version: 1 },
          data: expect.objectContaining({
            status: 'COMPLETED',
            isBillable: true,
            affiliatePayout: 35,
            buyerCharge: 45,
            platformMargin: 10, // 45 - 35 = 10
            billingStatus: 'PENDING',
          }),
        })
      );
    });

    it('should NOT mark as billable when duration is too short', async () => {
      // Arrange
      const campaign = createMockCampaign({
        minCallDuration: 90,
        callBasePayout: new Decimal(35),
      });

      const call = createMockCall({
        id: 'call-123',
        status: 'CONNECTED',
        isQualified: true,
        winningBuyerId: 'buyer-1',
        winningBid: new Decimal(45),
        version: 1,
      });

      const payload = createCompletionPayload({
        CallDuration: '100',
        DialCallDuration: '60', // Only 60 seconds (< 90)
        DialCallStatus: 'completed',
        DialBridged: 'true',
      });

      (withTwilioVerification as jest.Mock).mockImplementation(
        async (req, handler) => handler(payload)
      );

      mockCall.findUnique.mockResolvedValue({ ...call, campaign });
      mockCall.update.mockResolvedValue(call);

      mockRequest = new NextRequest(
        'http://localhost/api/calls/completed?callId=call-123',
        { method: 'POST' }
      );

      // Act
      await POST(mockRequest);

      // Assert
      expect(mockCall.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isBillable: false,
            affiliatePayout: null,
            buyerCharge: null,
            billingStatus: 'FINALIZED',
          }),
        })
      );
    });

    it('should NOT mark as billable when call was not bridged', async () => {
      // Arrange
      const call = createMockCall({
        id: 'call-123',
        status: 'CONNECTING',
        isQualified: true,
        winningBuyerId: 'buyer-1',
        winningBid: new Decimal(45),
        version: 1,
      });

      const payload = createCompletionPayload({
        DialCallDuration: '0',
        DialCallStatus: 'no-answer',
        DialBridged: 'false', // Not bridged
      });

      (mapDialStatus as jest.Mock).mockReturnValue('NO_ANSWER');

      (withTwilioVerification as jest.Mock).mockImplementation(
        async (req, handler) => handler(payload)
      );

      mockCall.findUnique.mockResolvedValue({
        ...call,
        campaign: createMockCampaign(),
      });
      mockCall.update.mockResolvedValue(call);

      mockRequest = new NextRequest(
        'http://localhost/api/calls/completed?callId=call-123',
        { method: 'POST' }
      );

      // Act
      await POST(mockRequest);

      // Assert
      expect(mockCall.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isBillable: false,
          }),
        })
      );
    });

    it('should NOT mark as billable when IVR required but not qualified', async () => {
      // Arrange
      const campaign = createMockCampaign({
        requireIvrQualification: true,
        callBasePayout: new Decimal(35),
        minCallDuration: 60,
      });

      const call = createMockCall({
        id: 'call-123',
        status: 'CONNECTED',
        isQualified: false, // Not qualified through IVR
        winningBuyerId: 'buyer-1',
        winningBid: new Decimal(45),
        version: 1,
      });

      const payload = createCompletionPayload({
        DialCallDuration: '120',
        DialCallStatus: 'completed',
        DialBridged: 'true',
      });

      (withTwilioVerification as jest.Mock).mockImplementation(
        async (req, handler) => handler(payload)
      );

      mockCall.findUnique.mockResolvedValue({ ...call, campaign });
      mockCall.update.mockResolvedValue(call);

      mockRequest = new NextRequest(
        'http://localhost/api/calls/completed?callId=call-123',
        { method: 'POST' }
      );

      // Act
      await POST(mockRequest);

      // Assert
      expect(mockCall.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isBillable: false,
          }),
        })
      );
    });

    it('should NOT mark as billable when no winning bid', async () => {
      // Arrange
      const call = createMockCall({
        id: 'call-123',
        status: 'CONNECTED',
        isQualified: true,
        winningBuyerId: null, // No winner
        winningBid: null,
        version: 1,
      });

      const payload = createCompletionPayload({
        DialCallDuration: '120',
        DialCallStatus: 'completed',
        DialBridged: 'true',
      });

      (withTwilioVerification as jest.Mock).mockImplementation(
        async (req, handler) => handler(payload)
      );

      mockCall.findUnique.mockResolvedValue({
        ...call,
        campaign: createMockCampaign({ minCallDuration: 60 }),
      });
      mockCall.update.mockResolvedValue(call);

      mockRequest = new NextRequest(
        'http://localhost/api/calls/completed?callId=call-123',
        { method: 'POST' }
      );

      // Act
      await POST(mockRequest);

      // Assert
      expect(mockCall.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isBillable: false,
          }),
        })
      );
    });

    it('should calculate correct platform margin', async () => {
      // Arrange
      const campaign = createMockCampaign({
        callBasePayout: new Decimal(30), // Affiliate gets $30
        minCallDuration: 60,
        requireIvrQualification: false,
      });

      const call = createMockCall({
        id: 'call-123',
        status: 'CONNECTED',
        isQualified: true,
        winningBuyerId: 'buyer-1',
        winningBid: new Decimal(55), // Buyer pays $55
        version: 1,
      });

      const payload = createCompletionPayload({
        DialCallDuration: '120',
        DialCallStatus: 'completed',
        DialBridged: 'true',
      });

      (withTwilioVerification as jest.Mock).mockImplementation(
        async (req, handler) => handler(payload)
      );

      mockCall.findUnique.mockResolvedValue({ ...call, campaign });
      mockCall.update.mockResolvedValue(call);

      mockRequest = new NextRequest(
        'http://localhost/api/calls/completed?callId=call-123',
        { method: 'POST' }
      );

      // Act
      await POST(mockRequest);

      // Assert
      expect(mockCall.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            affiliatePayout: 30,
            buyerCharge: 55,
            platformMargin: 25, // 55 - 30 = 25
          }),
        })
      );
    });
  });

  describe('disposition mapping', () => {
    it('should set disposition to ANSWERED when bridged and completed', async () => {
      // Arrange
      const call = createMockCall({
        id: 'call-123',
        status: 'CONNECTED',
        version: 1,
        winningBid: new Decimal(45),
        winningBuyerId: 'buyer-1',
      });

      const payload = createCompletionPayload({
        DialCallStatus: 'completed',
        DialBridged: 'true',
        DialCallDuration: '120',
      });

      (withTwilioVerification as jest.Mock).mockImplementation(
        async (req, handler) => handler(payload)
      );

      mockCall.findUnique.mockResolvedValue({
        ...call,
        campaign: createMockCampaign({ minCallDuration: 60 }),
      });
      mockCall.update.mockResolvedValue(call);

      mockRequest = new NextRequest(
        'http://localhost/api/calls/completed?callId=call-123',
        { method: 'POST' }
      );

      // Act
      await POST(mockRequest);

      // Assert
      expect(mockCall.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            disposition: 'ANSWERED',
          }),
        })
      );
    });

    it('should set disposition to NO_ANSWER when no-answer status', async () => {
      // Arrange
      const call = createMockCall({
        id: 'call-123',
        status: 'CONNECTING',
        version: 1,
      });

      const payload = createCompletionPayload({
        DialCallStatus: 'no-answer',
        DialBridged: 'false',
      });

      (mapDialStatus as jest.Mock).mockReturnValue('NO_ANSWER');

      (withTwilioVerification as jest.Mock).mockImplementation(
        async (req, handler) => handler(payload)
      );

      mockCall.findUnique.mockResolvedValue({
        ...call,
        campaign: createMockCampaign(),
      });
      mockCall.update.mockResolvedValue(call);

      mockRequest = new NextRequest(
        'http://localhost/api/calls/completed?callId=call-123',
        { method: 'POST' }
      );

      // Act
      await POST(mockRequest);

      // Assert
      expect(mockCall.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            disposition: 'NO_ANSWER',
          }),
        })
      );
    });

    it('should set disposition to BUSY when busy status', async () => {
      // Arrange
      const call = createMockCall({
        id: 'call-123',
        status: 'CONNECTING',
        version: 1,
      });

      const payload = createCompletionPayload({
        DialCallStatus: 'busy',
        DialBridged: 'false',
      });

      (mapDialStatus as jest.Mock).mockReturnValue('FAILED');

      (withTwilioVerification as jest.Mock).mockImplementation(
        async (req, handler) => handler(payload)
      );

      mockCall.findUnique.mockResolvedValue({
        ...call,
        campaign: createMockCampaign(),
      });
      mockCall.update.mockResolvedValue(call);

      mockRequest = new NextRequest(
        'http://localhost/api/calls/completed?callId=call-123',
        { method: 'POST' }
      );

      // Act
      await POST(mockRequest);

      // Assert
      expect(mockCall.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            disposition: 'BUSY',
          }),
        })
      );
    });
  });

  describe('affiliate postback', () => {
    it('should fire postback when call is billable and affiliate has postback URL', async () => {
      // Arrange
      const affiliate = createMockAffiliate({
        postbackUrl: 'https://affiliate.example.com/callback',
        postbackMethod: 'POST',
      });

      const call = createMockCall({
        id: 'call-123',
        twilioCallSid: 'CA123',
        status: 'CONNECTED',
        isQualified: true,
        winningBuyerId: 'buyer-1',
        winningBid: new Decimal(45),
        version: 1,
      });

      const payload = createCompletionPayload({
        DialCallDuration: '120',
        DialCallStatus: 'completed',
        DialBridged: 'true',
      });

      (withTwilioVerification as jest.Mock).mockImplementation(
        async (req, handler) => handler(payload)
      );

      mockCall.findUnique.mockResolvedValue({
        ...call,
        campaign: createMockCampaign({ minCallDuration: 60, callBasePayout: new Decimal(35) }),
        affiliate,
      });
      mockCall.update.mockResolvedValue(call);

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => 'OK',
      });

      mockRequest = new NextRequest(
        'http://localhost/api/calls/completed?callId=call-123',
        { method: 'POST' }
      );

      // Act
      await POST(mockRequest);

      // Give time for fire-and-forget postback
      await new Promise((r) => setTimeout(r, 50));

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        'https://affiliate.example.com/callback',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('call.completed'),
        })
      );
    });

    it('should NOT fire postback when call is not billable', async () => {
      // Arrange
      const affiliate = createMockAffiliate({
        postbackUrl: 'https://affiliate.example.com/callback',
      });

      const call = createMockCall({
        id: 'call-123',
        status: 'CONNECTING',
        version: 1,
      });

      const payload = createCompletionPayload({
        DialCallDuration: '30', // Too short
        DialCallStatus: 'completed',
        DialBridged: 'true',
      });

      (withTwilioVerification as jest.Mock).mockImplementation(
        async (req, handler) => handler(payload)
      );

      mockCall.findUnique.mockResolvedValue({
        ...call,
        campaign: createMockCampaign({ minCallDuration: 90 }),
        affiliate,
      });
      mockCall.update.mockResolvedValue(call);

      mockRequest = new NextRequest(
        'http://localhost/api/calls/completed?callId=call-123',
        { method: 'POST' }
      );

      // Act
      await POST(mockRequest);
      await new Promise((r) => setTimeout(r, 50));

      // Assert
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should update call with postback status', async () => {
      // Arrange
      const affiliate = createMockAffiliate({
        postbackUrl: 'https://affiliate.example.com/callback',
      });

      const call = createMockCall({
        id: 'call-123',
        status: 'CONNECTED',
        isQualified: true,
        winningBuyerId: 'buyer-1',
        winningBid: new Decimal(45),
        version: 1,
      });

      const payload = createCompletionPayload({
        DialCallDuration: '120',
        DialCallStatus: 'completed',
        DialBridged: 'true',
      });

      (withTwilioVerification as jest.Mock).mockImplementation(
        async (req, handler) => handler(payload)
      );

      mockCall.findUnique.mockResolvedValue({
        ...call,
        campaign: createMockCampaign({ minCallDuration: 60, callBasePayout: new Decimal(35) }),
        affiliate,
      });
      mockCall.update.mockResolvedValue(call);

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => 'Postback received',
      });

      mockRequest = new NextRequest(
        'http://localhost/api/calls/completed?callId=call-123',
        { method: 'POST' }
      );

      // Act
      await POST(mockRequest);
      await new Promise((r) => setTimeout(r, 100));

      // Assert - Second update should set postback status
      const updateCalls = mockCall.update.mock.calls;
      const postbackUpdate = updateCalls.find(
        (c: unknown[]) => (c[0] as { data: { postbackSent?: boolean } }).data.postbackSent === true
      );
      expect(postbackUpdate).toBeDefined();
    });
  });

  describe('idempotency', () => {
    it('should skip duplicate completion webhooks', async () => {
      // Arrange
      (isWebhookProcessed as jest.Mock).mockResolvedValue(true);

      const payload = createCompletionPayload();

      (withTwilioVerification as jest.Mock).mockImplementation(
        async (req, handler) => handler(payload)
      );

      mockRequest = new NextRequest(
        'http://localhost/api/calls/completed?callId=call-123',
        { method: 'POST' }
      );

      // Act
      await POST(mockRequest);

      // Assert
      expect(mockCall.findUnique).not.toHaveBeenCalled();
      expect(mockCall.update).not.toHaveBeenCalled();
    });
  });

  describe('terminal state handling', () => {
    it('should skip processing if call is already in terminal state', async () => {
      // Arrange
      const call = createMockCall({
        id: 'call-123',
        status: 'COMPLETED', // Already terminal
        version: 1,
      });

      const payload = createCompletionPayload();

      (isTerminalStatus as jest.Mock).mockReturnValue(true);

      (withTwilioVerification as jest.Mock).mockImplementation(
        async (req, handler) => handler(payload)
      );

      mockCall.findUnique.mockResolvedValue(call);

      mockRequest = new NextRequest(
        'http://localhost/api/calls/completed?callId=call-123',
        { method: 'POST' }
      );

      // Act
      await POST(mockRequest);

      // Assert - Should NOT update
      expect(mockCall.update).not.toHaveBeenCalled();
    });
  });

  describe('fallback call lookup', () => {
    it('should find call by twilioCallSid when callId is missing', async () => {
      // Arrange
      const call = createMockCall({
        id: 'call-123',
        twilioCallSid: 'CA123',
        status: 'CONNECTED',
        version: 1,
      });

      const payload = createCompletionPayload({
        CallSid: 'CA123',
        DialCallDuration: '30',
        DialCallStatus: 'completed',
        DialBridged: 'true',
      });

      (withTwilioVerification as jest.Mock).mockImplementation(
        async (req, handler) => handler(payload)
      );

      // First findUnique is for callId lookup fallback
      mockCall.findUnique
        .mockResolvedValueOnce({ id: 'call-123' })
        .mockResolvedValueOnce({
          ...call,
          campaign: createMockCampaign(),
        });
      mockCall.update.mockResolvedValue(call);

      mockRequest = new NextRequest(
        'http://localhost/api/calls/completed', // No callId param!
        { method: 'POST' }
      );

      // Act
      await POST(mockRequest);

      // Assert - Should find call by twilioCallSid
      expect(mockCall.findUnique).toHaveBeenCalledWith({
        where: { twilioCallSid: 'CA123' },
        select: { id: true },
      });
    });
  });

  describe('error handling', () => {
    it('should return empty response on call not found', async () => {
      // Arrange
      const payload = createCompletionPayload();

      (withTwilioVerification as jest.Mock).mockImplementation(
        async (req, handler) => handler(payload)
      );

      mockCall.findUnique.mockResolvedValue(null);

      mockRequest = new NextRequest(
        'http://localhost/api/calls/completed?callId=nonexistent',
        { method: 'POST' }
      );

      // Act
      const response = await POST(mockRequest);

      // Assert - Should still return 200 with empty TwiML (don't cause Twilio retry)
      expect(response.status).toBe(200);
    });

    it('should log error to Sentry on unexpected failure', async () => {
      // Arrange
      const payload = createCompletionPayload();

      (withTwilioVerification as jest.Mock).mockImplementation(
        async (req, handler) => handler(payload)
      );

      mockCall.findUnique.mockRejectedValue(new Error('Database error'));

      mockRequest = new NextRequest(
        'http://localhost/api/calls/completed?callId=call-123',
        { method: 'POST' }
      );

      const { captureException } = require('@sentry/nextjs');

      // Act
      await POST(mockRequest);

      // Assert
      expect(captureException).toHaveBeenCalled();
    });
  });

  describe('duration recording', () => {
    it('should record both total and connected duration', async () => {
      // Arrange
      const call = createMockCall({
        id: 'call-123',
        status: 'CONNECTED',
        version: 1,
      });

      const payload = createCompletionPayload({
        CallDuration: '300', // 5 minutes total (includes IVR)
        DialCallDuration: '180', // 3 minutes connected
        DialCallStatus: 'completed',
        DialBridged: 'true',
      });

      (withTwilioVerification as jest.Mock).mockImplementation(
        async (req, handler) => handler(payload)
      );

      mockCall.findUnique.mockResolvedValue({
        ...call,
        campaign: createMockCampaign(),
      });
      mockCall.update.mockResolvedValue(call);

      mockRequest = new NextRequest(
        'http://localhost/api/calls/completed?callId=call-123',
        { method: 'POST' }
      );

      // Act
      await POST(mockRequest);

      // Assert
      expect(mockCall.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            totalDurationSeconds: 300,
            connectedDurationSeconds: 180,
          }),
        })
      );
    });
  });
});
