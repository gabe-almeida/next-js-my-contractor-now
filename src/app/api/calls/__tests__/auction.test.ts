/**
 * Auction Webhook Handler Tests
 *
 * WHY: Verify the auction webhook correctly orchestrates the auction flow
 *      and handles all outcome scenarios.
 * WHEN: Run as part of test suite before deployment.
 * HOW: Test winner selection, no bids, caller hangup, and error scenarios.
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
}));

jest.mock('@/lib/twilio/twiml-builder', () => ({
  buildTransfer: jest.fn().mockReturnValue('<Response><Dial/></Response>'),
  buildRejection: jest.fn().mockReturnValue('<Response><Say/><Hangup/></Response>'),
  buildEmptyResponse: jest.fn().mockReturnValue('<Response/>'),
}));

jest.mock('@/lib/twilio/state-machine', () => ({
  validateTransition: jest.fn(),
}));

jest.mock('@/lib/auction/call-engine', () => ({
  CallAuctionEngine: jest.fn().mockImplementation(() => ({
    runCallAuction: jest.fn(),
  })),
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
  createMockBiddingCall,
  resetFixtureCounters,
} from '@/test/fixtures/calls';
import { createIncomingCallPayload } from '@/test/mocks/twilio';
import { withTwilioVerification } from '@/lib/twilio/verify-signature';
import { isWebhookProcessed } from '@/lib/twilio/idempotency';
import { buildTransfer, buildRejection, buildEmptyResponse } from '@/lib/twilio/twiml-builder';
import { CallAuctionEngine } from '@/lib/auction/call-engine';

// Import the handler after mocks are set up
import { POST } from '../auction/route';

describe('Auction Webhook Handler', () => {
  let mockRequest: NextRequest;
  let mockAuctionEngine: { runCallAuction: jest.Mock };

  beforeEach(() => {
    resetPrismaMocks();
    resetFixtureCounters();
    jest.clearAllMocks();

    // Setup mock auction engine
    mockAuctionEngine = {
      runCallAuction: jest.fn(),
    };
    (CallAuctionEngine as jest.Mock).mockImplementation(() => mockAuctionEngine);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('successful auction with winner', () => {
    it('should build transfer TwiML when winner is selected', async () => {
      // Arrange
      const call = createMockBiddingCall({
        id: 'call-123',
        twilioCallSid: 'CA123',
        status: 'BIDDING',
        callerPhone: '+15551234567',
      });

      const payload = createIncomingCallPayload({ CallSid: 'CA123' });

      (withTwilioVerification as jest.Mock).mockImplementation(
        async (req, handler) => handler(payload)
      );

      mockCall.findUnique.mockResolvedValue({
        ...call,
        campaign: { id: 'campaign-1', name: 'Test Campaign', minCallDuration: 90 },
        trackingNumber: { id: 'tracking-1', phoneNumber: '+18445551234' },
        serviceType: { id: 'service-windows', name: 'windows', displayName: 'Windows' },
      });
      mockCall.update.mockResolvedValue({ ...call });

      // Auction returns a winner
      mockAuctionEngine.runCallAuction.mockResolvedValue({
        status: 'completed',
        winner: {
          buyerId: 'buyer-1',
          buyerName: 'Test Contractor',
          bidAmount: 45,
          responseTimeMs: 100,
          transferNumber: '+15559876543',
          buyerType: 'CONTRACTOR',
          success: true,
        },
        allBids: [],
        eligibleBuyersCount: 3,
        auctionDurationMs: 500,
        callerAbandoned: false,
      });

      mockRequest = new NextRequest(
        'http://localhost/api/calls/auction?callId=call-123',
        { method: 'POST' }
      );

      // Act
      await POST(mockRequest);

      // Assert
      expect(buildTransfer).toHaveBeenCalledWith(
        '+15559876543',
        '+15551234567',
        expect.stringContaining('/api/calls/completed?callId=call-123'),
        expect.objectContaining({
          record: true,
          callId: 'call-123',
        })
      );
    });

    it('should log winner details to activity log', async () => {
      // Arrange
      const call = createMockBiddingCall({ id: 'call-123', status: 'BIDDING' });
      const payload = createIncomingCallPayload({ CallSid: 'CA123' });

      (withTwilioVerification as jest.Mock).mockImplementation(
        async (req, handler) => handler(payload)
      );

      mockCall.findUnique.mockResolvedValue({
        ...call,
        campaign: { id: 'campaign-1', minCallDuration: 90 },
        serviceType: { id: 'service-windows', name: 'windows', displayName: 'Windows' },
      });
      mockCall.update.mockResolvedValue(call);

      mockAuctionEngine.runCallAuction.mockResolvedValue({
        status: 'completed',
        winner: {
          buyerId: 'buyer-1',
          buyerName: 'Premium Contractor',
          bidAmount: 55,
          transferNumber: '+15559876543',
        },
        eligibleBuyersCount: 5,
        callerAbandoned: false,
      });

      mockRequest = new NextRequest(
        'http://localhost/api/calls/auction?callId=call-123',
        { method: 'POST' }
      );

      const { createCallActivityLog } = require('@/lib/twilio/logging');

      // Act
      await POST(mockRequest);

      // Assert
      expect(createCallActivityLog).toHaveBeenCalledWith(
        'call-123',
        'auction.winner_found',
        expect.stringContaining('Premium Contractor'),
        expect.objectContaining({
          level: 'info',
          details: expect.objectContaining({
            winnerId: 'buyer-1',
            bidAmount: 55,
          }),
        })
      );
    });

    it('should update auction start time before running auction', async () => {
      // Arrange
      const call = createMockBiddingCall({ id: 'call-123', status: 'BIDDING' });
      const payload = createIncomingCallPayload({ CallSid: 'CA123' });

      (withTwilioVerification as jest.Mock).mockImplementation(
        async (req, handler) => handler(payload)
      );

      mockCall.findUnique.mockResolvedValue({
        ...call,
        serviceType: { id: 'service-windows', name: 'windows', displayName: 'Windows' },
      });

      let updateCallOrder = 0;
      mockCall.update.mockImplementation(async (args) => {
        updateCallOrder++;
        if (updateCallOrder === 1) {
          // First update should set auctionStartedAt
          expect(args.data).toHaveProperty('auctionStartedAt');
        }
        return call;
      });

      mockAuctionEngine.runCallAuction.mockResolvedValue({
        status: 'completed',
        winner: { buyerId: 'buyer-1', transferNumber: '+15559876543', bidAmount: 45 },
        callerAbandoned: false,
      });

      mockRequest = new NextRequest(
        'http://localhost/api/calls/auction?callId=call-123',
        { method: 'POST' }
      );

      // Act
      await POST(mockRequest);

      // Assert
      expect(mockCall.update).toHaveBeenCalled();
    });
  });

  describe('no bids scenario', () => {
    it('should return rejection TwiML when no buyers bid', async () => {
      // Arrange
      const call = createMockBiddingCall({ id: 'call-123', status: 'BIDDING' });
      const payload = createIncomingCallPayload({ CallSid: 'CA123' });

      (withTwilioVerification as jest.Mock).mockImplementation(
        async (req, handler) => handler(payload)
      );

      mockCall.findUnique.mockResolvedValue({
        ...call,
        serviceType: { id: 'service-windows', name: 'windows', displayName: 'Windows' },
      });
      mockCall.update.mockResolvedValue(call);

      // Auction returns no bids
      mockAuctionEngine.runCallAuction.mockResolvedValue({
        status: 'no_bids',
        winner: null,
        allBids: [],
        eligibleBuyersCount: 0,
        callerAbandoned: false,
      });

      mockRequest = new NextRequest(
        'http://localhost/api/calls/auction?callId=call-123',
        { method: 'POST' }
      );

      // Act
      await POST(mockRequest);

      // Assert
      expect(buildRejection).toHaveBeenCalledWith(
        expect.stringContaining('no specialists are available')
      );
    });

    it('should update call status to NO_BIDS', async () => {
      // Arrange
      const call = createMockBiddingCall({ id: 'call-123', status: 'BIDDING' });
      const payload = createIncomingCallPayload({ CallSid: 'CA123' });

      (withTwilioVerification as jest.Mock).mockImplementation(
        async (req, handler) => handler(payload)
      );

      mockCall.findUnique.mockResolvedValue({
        ...call,
        serviceType: { id: 'service-windows', name: 'windows', displayName: 'Windows' },
      });
      mockCall.update.mockResolvedValue(call);

      mockAuctionEngine.runCallAuction.mockResolvedValue({
        status: 'no_bids',
        winner: null,
        callerAbandoned: false,
      });

      mockRequest = new NextRequest(
        'http://localhost/api/calls/auction?callId=call-123',
        { method: 'POST' }
      );

      // Act
      await POST(mockRequest);

      // Assert - Second update should set status to NO_BIDS
      expect(mockCall.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'call-123' },
          data: expect.objectContaining({
            status: 'NO_BIDS',
            hangupReason: 'NO_BUYERS_AVAILABLE',
          }),
        })
      );
    });
  });

  describe('caller hangup during auction', () => {
    it('should return empty TwiML when caller hangs up', async () => {
      // Arrange
      const call = createMockBiddingCall({ id: 'call-123', status: 'BIDDING' });
      const payload = createIncomingCallPayload({ CallSid: 'CA123' });

      (withTwilioVerification as jest.Mock).mockImplementation(
        async (req, handler) => handler(payload)
      );

      mockCall.findUnique.mockResolvedValue({
        ...call,
        serviceType: { id: 'service-windows', name: 'windows', displayName: 'Windows' },
      });
      mockCall.update.mockResolvedValue(call);

      // Auction detects caller hangup
      mockAuctionEngine.runCallAuction.mockResolvedValue({
        status: 'caller_hangup',
        winner: null,
        allBids: [],
        eligibleBuyersCount: 3,
        callerAbandoned: true,
      });

      mockRequest = new NextRequest(
        'http://localhost/api/calls/auction?callId=call-123',
        { method: 'POST' }
      );

      // Act
      await POST(mockRequest);

      // Assert
      expect(buildEmptyResponse).toHaveBeenCalled();
    });

    it('should update call status to CALLER_HANGUP with correct reason', async () => {
      // Arrange
      const call = createMockBiddingCall({ id: 'call-123', status: 'BIDDING' });
      const payload = createIncomingCallPayload({ CallSid: 'CA123' });

      (withTwilioVerification as jest.Mock).mockImplementation(
        async (req, handler) => handler(payload)
      );

      mockCall.findUnique.mockResolvedValue({
        ...call,
        serviceType: { id: 'service-windows', name: 'windows', displayName: 'Windows' },
      });
      mockCall.update.mockResolvedValue(call);

      mockAuctionEngine.runCallAuction.mockResolvedValue({
        status: 'caller_hangup',
        winner: null,
        callerAbandoned: true,
      });

      mockRequest = new NextRequest(
        'http://localhost/api/calls/auction?callId=call-123',
        { method: 'POST' }
      );

      // Act
      await POST(mockRequest);

      // Assert
      expect(mockCall.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'call-123' },
          data: expect.objectContaining({
            status: 'CALLER_HANGUP',
            hangupReason: 'CALLER_ABANDONED_DURING_AUCTION',
            abandonmentPhase: 'auction',
          }),
        })
      );
    });
  });

  describe('missing winner transfer number', () => {
    it('should treat as no bids if winner has no transfer number', async () => {
      // Arrange
      const call = createMockBiddingCall({ id: 'call-123', status: 'BIDDING' });
      const payload = createIncomingCallPayload({ CallSid: 'CA123' });

      (withTwilioVerification as jest.Mock).mockImplementation(
        async (req, handler) => handler(payload)
      );

      mockCall.findUnique.mockResolvedValue({
        ...call,
        serviceType: { id: 'service-windows', name: 'windows', displayName: 'Windows' },
      });
      mockCall.update.mockResolvedValue(call);

      // Winner exists but has no transfer number
      mockAuctionEngine.runCallAuction.mockResolvedValue({
        status: 'completed',
        winner: {
          buyerId: 'buyer-1',
          buyerName: 'Broken Buyer',
          bidAmount: 50,
          transferNumber: null, // Missing!
        },
        callerAbandoned: false,
      });

      mockRequest = new NextRequest(
        'http://localhost/api/calls/auction?callId=call-123',
        { method: 'POST' }
      );

      // Act
      await POST(mockRequest);

      // Assert
      expect(buildRejection).toHaveBeenCalledWith(
        expect.stringContaining('unable to connect you')
      );
    });
  });

  describe('state validation', () => {
    it('should skip if call is not in BIDDING state', async () => {
      // Arrange
      const call = createMockBiddingCall({
        id: 'call-123',
        status: 'COMPLETED', // Not in BIDDING
      });
      const payload = createIncomingCallPayload({ CallSid: 'CA123' });

      (withTwilioVerification as jest.Mock).mockImplementation(
        async (req, handler) => handler(payload)
      );

      mockCall.findUnique.mockResolvedValue({
        ...call,
        status: 'COMPLETED',
      });

      mockRequest = new NextRequest(
        'http://localhost/api/calls/auction?callId=call-123',
        { method: 'POST' }
      );

      // Act
      await POST(mockRequest);

      // Assert
      expect(buildEmptyResponse).toHaveBeenCalled();
      expect(mockAuctionEngine.runCallAuction).not.toHaveBeenCalled();
    });

    it('should return error TwiML if call not found', async () => {
      // Arrange
      const payload = createIncomingCallPayload({ CallSid: 'CA123' });

      (withTwilioVerification as jest.Mock).mockImplementation(
        async (req, handler) => handler(payload)
      );

      mockCall.findUnique.mockResolvedValue(null);

      mockRequest = new NextRequest(
        'http://localhost/api/calls/auction?callId=nonexistent',
        { method: 'POST' }
      );

      // Act
      await POST(mockRequest);

      // Assert
      expect(buildRejection).toHaveBeenCalledWith(
        expect.stringContaining('error occurred')
      );
    });

    it('should return error TwiML if callId missing from URL', async () => {
      // Arrange
      const payload = createIncomingCallPayload({ CallSid: 'CA123' });

      (withTwilioVerification as jest.Mock).mockImplementation(
        async (req, handler) => handler(payload)
      );

      mockRequest = new NextRequest(
        'http://localhost/api/calls/auction', // No callId param
        { method: 'POST' }
      );

      // Act
      await POST(mockRequest);

      // Assert
      expect(buildRejection).toHaveBeenCalled();
      expect(mockAuctionEngine.runCallAuction).not.toHaveBeenCalled();
    });
  });

  describe('idempotency', () => {
    it('should skip duplicate auction webhooks', async () => {
      // Arrange
      (isWebhookProcessed as jest.Mock).mockResolvedValue(true);

      const payload = createIncomingCallPayload({ CallSid: 'CA123' });

      (withTwilioVerification as jest.Mock).mockImplementation(
        async (req, handler) => handler(payload)
      );

      mockRequest = new NextRequest(
        'http://localhost/api/calls/auction?callId=call-123',
        { method: 'POST' }
      );

      // Act
      await POST(mockRequest);

      // Assert
      expect(buildEmptyResponse).toHaveBeenCalled();
      expect(mockCall.findUnique).not.toHaveBeenCalled();
      expect(mockAuctionEngine.runCallAuction).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should return error TwiML on auction engine failure', async () => {
      // Arrange
      const call = createMockBiddingCall({ id: 'call-123', status: 'BIDDING' });
      const payload = createIncomingCallPayload({ CallSid: 'CA123' });

      (withTwilioVerification as jest.Mock).mockImplementation(
        async (req, handler) => handler(payload)
      );

      mockCall.findUnique.mockResolvedValue({
        ...call,
        serviceType: { id: 'service-windows', name: 'windows', displayName: 'Windows' },
      });
      mockCall.update.mockResolvedValue(call);

      // Auction engine throws
      mockAuctionEngine.runCallAuction.mockRejectedValue(
        new Error('Database connection failed')
      );

      mockRequest = new NextRequest(
        'http://localhost/api/calls/auction?callId=call-123',
        { method: 'POST' }
      );

      // Act
      await POST(mockRequest);

      // Assert
      expect(buildRejection).toHaveBeenCalledWith(
        expect.stringContaining('technical difficulties')
      );
    });

    it('should log error to Sentry on auction failure', async () => {
      // Arrange
      const call = createMockBiddingCall({ id: 'call-123', status: 'BIDDING' });
      const payload = createIncomingCallPayload({ CallSid: 'CA123' });

      (withTwilioVerification as jest.Mock).mockImplementation(
        async (req, handler) => handler(payload)
      );

      mockCall.findUnique.mockResolvedValue({
        ...call,
        serviceType: { id: 'service-windows', name: 'windows', displayName: 'Windows' },
      });
      mockCall.update.mockResolvedValue(call);

      mockAuctionEngine.runCallAuction.mockRejectedValue(
        new Error('Unexpected error')
      );

      mockRequest = new NextRequest(
        'http://localhost/api/calls/auction?callId=call-123',
        { method: 'POST' }
      );

      const { captureException } = require('@sentry/nextjs');

      // Act
      await POST(mockRequest);

      // Assert
      expect(captureException).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          tags: { component: 'auction-webhook' },
        })
      );
    });
  });
});
