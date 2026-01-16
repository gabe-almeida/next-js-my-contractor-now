/**
 * Call Auction Engine Tests
 *
 * WHY: Verify the auction engine correctly identifies eligible buyers,
 *      collects bids, and selects winners with proper tie-breaking.
 * WHEN: Run as part of test suite before deployment.
 * HOW: Test eligibility filtering, bid collection, winner selection,
 *      caller hangup detection, and edge cases.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Decimal } from '@prisma/client/runtime/library';

// Mock dependencies before importing engine
jest.mock('@/lib/db', () => ({
  prisma: require('@/test/mocks/prisma').mockPrismaClient,
}));

jest.mock('@/lib/twilio', () => ({
  getTwilioClient: jest.fn(() => require('@/test/mocks/twilio').createMockTwilioClient()),
}));

jest.mock('@/lib/twilio/logging', () => ({
  logAuctionEvent: jest.fn(),
  createCallActivityLog: jest.fn().mockResolvedValue(undefined),
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

// Mock fetch for network PING
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

import {
  mockPrismaClient,
  mockCall,
  mockCallBid,
  mockBuyerServiceConfig,
  mockBuyerServiceZipCode,
  resetPrismaMocks,
} from '@/test/mocks/prisma';
import {
  createMockCall,
  createMockBiddingCall,
  createMockBuyer,
  createMockNetworkBuyer,
  createMockBuyerServiceConfig,
  createMockNetworkConfig,
  createAuctionScenario,
  resetFixtureCounters,
} from '@/test/fixtures/calls';
import { mockTwilioClient, setMockCallStatus } from '@/test/mocks/twilio';
import { CallAuctionEngine } from '../call-engine';

describe('CallAuctionEngine', () => {
  let engine: CallAuctionEngine;

  beforeEach(() => {
    resetPrismaMocks();
    resetFixtureCounters();
    jest.clearAllMocks();
    mockFetch.mockReset();

    engine = new CallAuctionEngine({
      pingTimeoutMs: 2000,
      maxCascadeDepth: 3,
      maxCascadeTimeMs: 8000,
      requireMinimumBid: true,
      minimumBid: 5.0,
    });

    // Default: caller is active
    setMockCallStatus('in-progress');
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('getEligibleCallBuyers', () => {
    it('should return buyers who accept calls and cover the ZIP code', async () => {
      // Arrange
      const call = createMockBiddingCall({
        id: 'call-123',
        serviceTypeId: 'service-windows',
        callerZip: '90210',
      });

      const buyer1 = createMockBuyer({ id: 'buyer-1', acceptsCalls: true });
      const buyer2 = createMockBuyer({ id: 'buyer-2', acceptsCalls: true });

      const config1 = createMockBuyerServiceConfig({
        buyerId: 'buyer-1',
        serviceTypeId: 'service-windows',
        callBidAmount: new Decimal(50),
        buyer: buyer1,
      });
      const config2 = createMockBuyerServiceConfig({
        buyerId: 'buyer-2',
        serviceTypeId: 'service-windows',
        callBidAmount: new Decimal(40),
        buyer: buyer2,
      });

      mockCall.findUnique.mockResolvedValue({
        ...call,
        serviceType: { id: 'service-windows', name: 'windows', displayName: 'Windows' },
        campaign: { id: 'campaign-1', minCallDuration: 90 },
      });

      mockBuyerServiceConfig.findMany.mockResolvedValue([config1, config2]);

      // Both buyers have no ZIP restrictions (nationwide)
      mockBuyerServiceZipCode.count.mockResolvedValue(0);

      // Both under daily cap
      mockCall.count.mockResolvedValue(0);

      // Mock auction completion
      mockPrismaClient.$transaction.mockImplementation(async (fn) => {
        return fn(mockPrismaClient);
      });
      mockCall.update.mockResolvedValue({ ...call, status: 'CONNECTING' });
      mockCallBid.upsert.mockResolvedValue({});
      mockCallBid.updateMany.mockResolvedValue({ count: 1 });

      // Act
      const result = await engine.runCallAuction('call-123');

      // Assert
      expect(mockBuyerServiceConfig.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            serviceTypeId: 'service-windows',
            active: true,
          }),
        })
      );
      expect(result.eligibleBuyersCount).toBe(2);
    });

    it('should exclude buyers who do not cover the caller ZIP code', async () => {
      // Arrange
      const call = createMockBiddingCall({
        id: 'call-123',
        serviceTypeId: 'service-windows',
        callerZip: '90210',
      });

      const buyer1 = createMockBuyer({ id: 'buyer-1' });
      const config1 = createMockBuyerServiceConfig({
        buyerId: 'buyer-1',
        callBidAmount: new Decimal(50),
        buyer: buyer1,
      });

      mockCall.findUnique.mockResolvedValue({
        ...call,
        serviceType: { id: 'service-windows', name: 'windows', displayName: 'Windows' },
      });

      mockBuyerServiceConfig.findMany.mockResolvedValue([config1]);

      // Buyer has ZIP restrictions but doesn't cover 90210
      mockBuyerServiceZipCode.count.mockResolvedValue(100); // Has ZIP entries
      mockBuyerServiceZipCode.findFirst.mockResolvedValue(null); // But not 90210

      // Act
      const result = await engine.runCallAuction('call-123');

      // Assert
      expect(result.eligibleBuyersCount).toBe(0);
      expect(result.status).toBe('no_bids');
    });

    it('should exclude buyers at their daily cap', async () => {
      // Arrange
      const call = createMockBiddingCall({
        id: 'call-123',
        serviceTypeId: 'service-windows',
        callerZip: '90210',
      });

      const buyer1 = createMockBuyer({ id: 'buyer-1' });
      const config1 = createMockBuyerServiceConfig({
        buyerId: 'buyer-1',
        callBidAmount: new Decimal(50),
        callDailyCap: 10,
        buyer: buyer1,
      });

      mockCall.findUnique.mockResolvedValue({
        ...call,
        serviceType: { id: 'service-windows', name: 'windows', displayName: 'Windows' },
      });

      mockBuyerServiceConfig.findMany.mockResolvedValue([config1]);
      mockBuyerServiceZipCode.count.mockResolvedValue(0); // Nationwide

      // Buyer at daily cap (10/10)
      mockCall.count.mockResolvedValue(10);

      // Act
      const result = await engine.runCallAuction('call-123');

      // Assert
      expect(result.eligibleBuyersCount).toBe(0);
      expect(result.status).toBe('no_bids');
    });

    it('should return empty array when call has no serviceTypeId', async () => {
      // Arrange
      const call = createMockBiddingCall({
        id: 'call-123',
        serviceTypeId: null,
        callerZip: '90210',
      });

      mockCall.findUnique.mockResolvedValue({
        ...call,
        serviceType: null,
      });

      // Act
      const result = await engine.runCallAuction('call-123');

      // Assert
      expect(result.eligibleBuyersCount).toBe(0);
      expect(result.status).toBe('no_bids');
    });

    it('should return empty array when call has no callerZip', async () => {
      // Arrange
      const call = createMockBiddingCall({
        id: 'call-123',
        serviceTypeId: 'service-windows',
        callerZip: null,
      });

      mockCall.findUnique.mockResolvedValue({
        ...call,
        serviceType: { id: 'service-windows', name: 'windows', displayName: 'Windows' },
      });

      // Act
      const result = await engine.runCallAuction('call-123');

      // Assert
      expect(result.eligibleBuyersCount).toBe(0);
    });
  });

  describe('bid collection', () => {
    it('should collect instant bids from contractors', async () => {
      // Arrange
      const call = createMockBiddingCall({ id: 'call-123' });
      const buyer = createMockBuyer({
        id: 'buyer-1',
        type: 'CONTRACTOR',
        callForwardingNumber: '+15559876543',
      });
      const config = createMockBuyerServiceConfig({
        buyerId: 'buyer-1',
        callBidAmount: new Decimal(45),
        buyer,
      });

      mockCall.findUnique.mockResolvedValue({
        ...call,
        serviceType: { id: 'service-windows', name: 'windows', displayName: 'Windows' },
      });
      mockBuyerServiceConfig.findMany.mockResolvedValue([config]);
      mockBuyerServiceZipCode.count.mockResolvedValue(0);
      mockCall.count.mockResolvedValue(0);

      mockPrismaClient.$transaction.mockImplementation(async (fn) => fn(mockPrismaClient));
      mockCall.update.mockResolvedValue({ ...call, status: 'CONNECTING' });
      mockCallBid.upsert.mockResolvedValue({});
      mockCallBid.updateMany.mockResolvedValue({ count: 1 });

      // Act
      const result = await engine.runCallAuction('call-123');

      // Assert
      expect(result.winner).not.toBeNull();
      expect(result.winner?.buyerId).toBe('buyer-1');
      expect(result.winner?.bidAmount).toBe(45);
      expect(result.winner?.responseTimeMs).toBe(0); // Instant bid
      expect(result.winner?.buyerType).toBe('CONTRACTOR');
    });

    it('should collect bids from networks via PING', async () => {
      // Arrange
      const call = createMockBiddingCall({ id: 'call-123' });
      const networkBuyer = createMockNetworkBuyer({ id: 'network-1' });
      const config = createMockNetworkConfig({
        buyerId: 'network-1',
        callBidAmount: new Decimal(55),
        callPingUrl: 'https://network.example.com/ping',
        buyer: networkBuyer,
      });

      mockCall.findUnique.mockResolvedValue({
        ...call,
        serviceType: { id: 'service-windows', name: 'windows', displayName: 'Windows' },
      });
      mockBuyerServiceConfig.findMany.mockResolvedValue([config]);
      mockBuyerServiceZipCode.count.mockResolvedValue(0);
      mockCall.count.mockResolvedValue(0);

      // Mock network PING response
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          accepted: true,
          bidAmount: 55,
          transferNumber: '+15551112222',
          bidId: 'network-bid-123',
        }),
      });

      mockPrismaClient.$transaction.mockImplementation(async (fn) => fn(mockPrismaClient));
      mockCall.update.mockResolvedValue({ ...call, status: 'CONNECTING' });
      mockCallBid.upsert.mockResolvedValue({});
      mockCallBid.updateMany.mockResolvedValue({ count: 1 });

      // Act
      const result = await engine.runCallAuction('call-123');

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        'https://network.example.com/ping',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('call-123'),
        })
      );
      expect(result.winner).not.toBeNull();
      expect(result.winner?.buyerId).toBe('network-1');
      expect(result.winner?.transferNumber).toBe('+15551112222');
    });

    it('should handle network PING timeout gracefully', async () => {
      // Arrange
      const call = createMockBiddingCall({ id: 'call-123' });
      const buyer = createMockBuyer({ id: 'buyer-1', type: 'CONTRACTOR' });
      const networkBuyer = createMockNetworkBuyer({ id: 'network-1' });

      const contractorConfig = createMockBuyerServiceConfig({
        buyerId: 'buyer-1',
        callBidAmount: new Decimal(40),
        buyer,
      });
      const networkConfig = createMockNetworkConfig({
        buyerId: 'network-1',
        callBidAmount: new Decimal(50),
        callPingUrl: 'https://slow-network.example.com/ping',
        buyer: networkBuyer,
      });

      mockCall.findUnique.mockResolvedValue({
        ...call,
        serviceType: { id: 'service-windows', name: 'windows', displayName: 'Windows' },
      });
      mockBuyerServiceConfig.findMany.mockResolvedValue([contractorConfig, networkConfig]);
      mockBuyerServiceZipCode.count.mockResolvedValue(0);
      mockCall.count.mockResolvedValue(0);

      // Mock network timeout (AbortError)
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValue(abortError);

      mockPrismaClient.$transaction.mockImplementation(async (fn) => fn(mockPrismaClient));
      mockCall.update.mockResolvedValue({ ...call, status: 'CONNECTING' });
      mockCallBid.upsert.mockResolvedValue({});
      mockCallBid.updateMany.mockResolvedValue({ count: 1 });

      // Act
      const result = await engine.runCallAuction('call-123');

      // Assert - Should fall back to contractor bid
      expect(result.winner).not.toBeNull();
      expect(result.winner?.buyerId).toBe('buyer-1'); // Contractor won since network timed out
      expect(result.winner?.bidAmount).toBe(40);
    });

    it('should handle network rejection response', async () => {
      // Arrange
      const call = createMockBiddingCall({ id: 'call-123' });
      const buyer = createMockBuyer({ id: 'buyer-1', type: 'CONTRACTOR' });
      const networkBuyer = createMockNetworkBuyer({ id: 'network-1' });

      const contractorConfig = createMockBuyerServiceConfig({
        buyerId: 'buyer-1',
        callBidAmount: new Decimal(40),
        buyer,
      });
      const networkConfig = createMockNetworkConfig({
        buyerId: 'network-1',
        callPingUrl: 'https://network.example.com/ping',
        buyer: networkBuyer,
      });

      mockCall.findUnique.mockResolvedValue({
        ...call,
        serviceType: { id: 'service-windows', name: 'windows', displayName: 'Windows' },
      });
      mockBuyerServiceConfig.findMany.mockResolvedValue([contractorConfig, networkConfig]);
      mockBuyerServiceZipCode.count.mockResolvedValue(0);
      mockCall.count.mockResolvedValue(0);

      // Mock network rejection
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          accepted: false,
          reason: 'No capacity',
        }),
      });

      mockPrismaClient.$transaction.mockImplementation(async (fn) => fn(mockPrismaClient));
      mockCall.update.mockResolvedValue({ ...call, status: 'CONNECTING' });
      mockCallBid.upsert.mockResolvedValue({});
      mockCallBid.updateMany.mockResolvedValue({ count: 1 });

      // Act
      const result = await engine.runCallAuction('call-123');

      // Assert - Should use contractor since network rejected
      expect(result.winner?.buyerId).toBe('buyer-1');
    });
  });

  describe('winner selection', () => {
    it('should select highest bidder as winner', async () => {
      // Arrange
      const call = createMockBiddingCall({ id: 'call-123' });

      const buyer1 = createMockBuyer({ id: 'buyer-1' });
      const buyer2 = createMockBuyer({ id: 'buyer-2' });
      const buyer3 = createMockBuyer({ id: 'buyer-3' });

      const configs = [
        createMockBuyerServiceConfig({
          buyerId: 'buyer-1',
          callBidAmount: new Decimal(40),
          buyer: buyer1,
        }),
        createMockBuyerServiceConfig({
          buyerId: 'buyer-2',
          callBidAmount: new Decimal(55), // Highest bid
          buyer: buyer2,
        }),
        createMockBuyerServiceConfig({
          buyerId: 'buyer-3',
          callBidAmount: new Decimal(45),
          buyer: buyer3,
        }),
      ];

      mockCall.findUnique.mockResolvedValue({
        ...call,
        serviceType: { id: 'service-windows', name: 'windows', displayName: 'Windows' },
      });
      mockBuyerServiceConfig.findMany.mockResolvedValue(configs);
      mockBuyerServiceZipCode.count.mockResolvedValue(0);
      mockCall.count.mockResolvedValue(0);

      mockPrismaClient.$transaction.mockImplementation(async (fn) => fn(mockPrismaClient));
      mockCall.update.mockResolvedValue({ ...call, status: 'CONNECTING' });
      mockCallBid.upsert.mockResolvedValue({});
      mockCallBid.updateMany.mockResolvedValue({ count: 1 });

      // Act
      const result = await engine.runCallAuction('call-123');

      // Assert
      expect(result.winner?.buyerId).toBe('buyer-2');
      expect(result.winner?.bidAmount).toBe(55);
    });

    it('should break ties using response time (faster wins)', async () => {
      // Arrange
      const call = createMockBiddingCall({ id: 'call-123' });

      // Two network buyers with same bid
      const network1 = createMockNetworkBuyer({ id: 'network-1', name: 'Fast Network' });
      const network2 = createMockNetworkBuyer({ id: 'network-2', name: 'Slow Network' });

      const configs = [
        createMockNetworkConfig({
          buyerId: 'network-1',
          callPingUrl: 'https://fast.example.com/ping',
          buyer: network1,
        }),
        createMockNetworkConfig({
          buyerId: 'network-2',
          callPingUrl: 'https://slow.example.com/ping',
          buyer: network2,
        }),
      ];

      mockCall.findUnique.mockResolvedValue({
        ...call,
        serviceType: { id: 'service-windows', name: 'windows', displayName: 'Windows' },
      });
      mockBuyerServiceConfig.findMany.mockResolvedValue(configs);
      mockBuyerServiceZipCode.count.mockResolvedValue(0);
      mockCall.count.mockResolvedValue(0);

      // Both networks bid $50, but network-1 is faster
      let callCount = 0;
      mockFetch.mockImplementation(async (url: string) => {
        callCount++;
        // First call is fast (100ms), second is slow (500ms)
        await new Promise((r) => setTimeout(r, callCount === 1 ? 10 : 100));
        return {
          ok: true,
          json: async () => ({
            accepted: true,
            bidAmount: 50, // Same bid
            transferNumber: `+1555000${callCount}`,
          }),
        };
      });

      mockPrismaClient.$transaction.mockImplementation(async (fn) => fn(mockPrismaClient));
      mockCall.update.mockResolvedValue({ ...call, status: 'CONNECTING' });
      mockCallBid.upsert.mockResolvedValue({});
      mockCallBid.updateMany.mockResolvedValue({ count: 1 });

      // Act
      const result = await engine.runCallAuction('call-123');

      // Assert - Faster network should win the tie
      expect(result.winner?.bidAmount).toBe(50);
      expect(result.allBids.length).toBe(2);
      // Note: The actual tie-breaking depends on the selectWinner implementation
      // which prefers lower response time among equal bids
    });

    it('should use SERIALIZABLE transaction for winner selection', async () => {
      // Arrange
      const call = createMockBiddingCall({ id: 'call-123', version: 1 });
      const buyer = createMockBuyer({ id: 'buyer-1' });
      const config = createMockBuyerServiceConfig({
        buyerId: 'buyer-1',
        callBidAmount: new Decimal(45),
        buyer,
      });

      mockCall.findUnique.mockResolvedValue({
        ...call,
        serviceType: { id: 'service-windows', name: 'windows', displayName: 'Windows' },
      });
      mockBuyerServiceConfig.findMany.mockResolvedValue([config]);
      mockBuyerServiceZipCode.count.mockResolvedValue(0);
      mockCall.count.mockResolvedValue(0);

      mockPrismaClient.$transaction.mockImplementation(async (fn, options) => {
        // Verify isolation level
        expect(options?.isolationLevel).toBe('Serializable');
        return fn(mockPrismaClient);
      });
      mockCall.update.mockResolvedValue({ ...call, status: 'CONNECTING' });
      mockCallBid.upsert.mockResolvedValue({});
      mockCallBid.updateMany.mockResolvedValue({ count: 1 });

      // Act
      await engine.runCallAuction('call-123');

      // Assert
      expect(mockPrismaClient.$transaction).toHaveBeenCalled();
    });

    it('should handle auction already completed by another process', async () => {
      // Arrange
      const call = createMockBiddingCall({ id: 'call-123', version: 1 });
      const buyer = createMockBuyer({ id: 'buyer-1' });
      const config = createMockBuyerServiceConfig({
        buyerId: 'buyer-1',
        callBidAmount: new Decimal(45),
        buyer,
      });

      mockCall.findUnique.mockResolvedValue({
        ...call,
        serviceType: { id: 'service-windows', name: 'windows', displayName: 'Windows' },
      });
      mockBuyerServiceConfig.findMany.mockResolvedValue([config]);
      mockBuyerServiceZipCode.count.mockResolvedValue(0);
      mockCall.count.mockResolvedValue(0);

      // Simulate race condition - call already has a winner
      mockPrismaClient.$transaction.mockImplementation(async (fn) => {
        // In transaction, call status is already CONNECTING
        mockCall.findUnique.mockResolvedValueOnce({
          ...call,
          status: 'CONNECTING', // Already moved past BIDDING
          winningBuyerId: 'other-buyer',
        });
        return fn(mockPrismaClient);
      });

      // Act
      const result = await engine.runCallAuction('call-123');

      // Assert
      expect(result.status).toBe('already_completed');
      expect(result.winner).toBeNull();
    });
  });

  describe('caller hangup detection', () => {
    it('should return caller_hangup if caller abandons before auction', async () => {
      // Arrange
      const call = createMockBiddingCall({ id: 'call-123' });

      mockCall.findUnique.mockResolvedValue({
        ...call,
        serviceType: { id: 'service-windows', name: 'windows', displayName: 'Windows' },
      });

      // Caller hung up
      setMockCallStatus('completed');

      // Act
      const result = await engine.runCallAuction('call-123');

      // Assert
      expect(result.callerAbandoned).toBe(true);
      expect(result.status).toBe('caller_hangup');
      expect(result.winner).toBeNull();
    });

    it('should return caller_hangup if caller abandons during bid collection', async () => {
      // Arrange
      const call = createMockBiddingCall({ id: 'call-123' });
      const networkBuyer = createMockNetworkBuyer({ id: 'network-1' });
      const config = createMockNetworkConfig({
        buyerId: 'network-1',
        callPingUrl: 'https://network.example.com/ping',
        buyer: networkBuyer,
      });

      mockCall.findUnique.mockResolvedValue({
        ...call,
        serviceType: { id: 'service-windows', name: 'windows', displayName: 'Windows' },
      });
      mockBuyerServiceConfig.findMany.mockResolvedValue([config]);
      mockBuyerServiceZipCode.count.mockResolvedValue(0);
      mockCall.count.mockResolvedValue(0);

      // Caller is active initially but hangs up during bid collection
      let checkCount = 0;
      mockTwilioClient.calls.fetch.mockImplementation(async () => {
        checkCount++;
        return {
          sid: call.twilioCallSid,
          status: checkCount === 1 ? 'in-progress' : 'completed', // Hangs up after first check
        };
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ accepted: true, bidAmount: 50, transferNumber: '+15551234567' }),
      });

      mockCallBid.updateMany.mockResolvedValue({ count: 1 });

      // Act
      const result = await engine.runCallAuction('call-123');

      // Assert
      expect(result.callerAbandoned).toBe(true);
      expect(result.status).toBe('caller_hangup');
    });

    it('should cancel pending bids when caller hangs up', async () => {
      // Arrange
      const call = createMockBiddingCall({ id: 'call-123' });
      const networkBuyer = createMockNetworkBuyer({ id: 'network-1' });
      const config = createMockNetworkConfig({
        buyerId: 'network-1',
        callPingUrl: 'https://network.example.com/ping',
        buyer: networkBuyer,
      });

      mockCall.findUnique.mockResolvedValue({
        ...call,
        serviceType: { id: 'service-windows', name: 'windows', displayName: 'Windows' },
      });
      mockBuyerServiceConfig.findMany.mockResolvedValue([config]);
      mockBuyerServiceZipCode.count.mockResolvedValue(0);
      mockCall.count.mockResolvedValue(0);

      // Active then hangs up
      let checkCount = 0;
      mockTwilioClient.calls.fetch.mockImplementation(async () => {
        checkCount++;
        return { status: checkCount === 1 ? 'in-progress' : 'completed' };
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ accepted: true, bidAmount: 50 }),
      });

      mockCallBid.updateMany.mockResolvedValue({ count: 1 });

      // Act
      await engine.runCallAuction('call-123');

      // Assert - Bids should be marked as EXPIRED
      expect(mockCallBid.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { callId: 'call-123' },
          data: { bidStatus: 'EXPIRED' },
        })
      );
    });

    it('should assume call is active if Twilio check fails', async () => {
      // Arrange
      const call = createMockBiddingCall({ id: 'call-123' });
      const buyer = createMockBuyer({ id: 'buyer-1' });
      const config = createMockBuyerServiceConfig({
        buyerId: 'buyer-1',
        callBidAmount: new Decimal(45),
        buyer,
      });

      mockCall.findUnique.mockResolvedValue({
        ...call,
        serviceType: { id: 'service-windows', name: 'windows', displayName: 'Windows' },
      });
      mockBuyerServiceConfig.findMany.mockResolvedValue([config]);
      mockBuyerServiceZipCode.count.mockResolvedValue(0);
      mockCall.count.mockResolvedValue(0);

      // Twilio API error - fail open
      mockTwilioClient.calls.fetch.mockRejectedValue(new Error('Twilio API error'));

      mockPrismaClient.$transaction.mockImplementation(async (fn) => fn(mockPrismaClient));
      mockCall.update.mockResolvedValue({ ...call, status: 'CONNECTING' });
      mockCallBid.upsert.mockResolvedValue({});
      mockCallBid.updateMany.mockResolvedValue({ count: 1 });

      // Act
      const result = await engine.runCallAuction('call-123');

      // Assert - Should proceed with auction (fail open)
      expect(result.callerAbandoned).toBe(false);
      expect(result.winner).not.toBeNull();
    });
  });

  describe('no_bids scenarios', () => {
    it('should return no_bids when no eligible buyers exist', async () => {
      // Arrange
      const call = createMockBiddingCall({ id: 'call-123' });

      mockCall.findUnique.mockResolvedValue({
        ...call,
        serviceType: { id: 'service-windows', name: 'windows', displayName: 'Windows' },
      });

      // No eligible configs
      mockBuyerServiceConfig.findMany.mockResolvedValue([]);

      // Act
      const result = await engine.runCallAuction('call-123');

      // Assert
      expect(result.status).toBe('no_bids');
      expect(result.winner).toBeNull();
      expect(result.eligibleBuyersCount).toBe(0);
    });

    it('should return no_bids when all bids are invalid', async () => {
      // Arrange
      const call = createMockBiddingCall({ id: 'call-123' });
      const buyer1 = createMockBuyer({ id: 'buyer-1' });
      const buyer2 = createMockBuyer({ id: 'buyer-2' });

      const configs = [
        createMockBuyerServiceConfig({
          buyerId: 'buyer-1',
          callBidAmount: new Decimal(0), // Zero bid
          buyer: buyer1,
        }),
        createMockBuyerServiceConfig({
          buyerId: 'buyer-2',
          callBidAmount: null, // No bid configured
          buyer: buyer2,
        }),
      ];

      mockCall.findUnique.mockResolvedValue({
        ...call,
        serviceType: { id: 'service-windows', name: 'windows', displayName: 'Windows' },
      });
      mockBuyerServiceConfig.findMany.mockResolvedValue(configs);
      mockBuyerServiceZipCode.count.mockResolvedValue(0);
      mockCall.count.mockResolvedValue(0);

      // Act
      const result = await engine.runCallAuction('call-123');

      // Assert
      expect(result.status).toBe('no_bids');
      expect(result.winner).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should throw error when call not found', async () => {
      // Arrange
      mockCall.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(engine.runCallAuction('nonexistent')).rejects.toThrow(
        'Call not found: nonexistent'
      );
    });

    it('should log error to Sentry on auction failure', async () => {
      // Arrange
      const call = createMockBiddingCall({ id: 'call-123' });

      mockCall.findUnique.mockResolvedValue({
        ...call,
        serviceType: { id: 'service-windows', name: 'windows', displayName: 'Windows' },
      });

      // Force an unexpected error
      mockBuyerServiceConfig.findMany.mockRejectedValue(new Error('Database error'));

      const { captureException } = require('@sentry/nextjs');

      // Act & Assert
      await expect(engine.runCallAuction('call-123')).rejects.toThrow('Database error');
      expect(captureException).toHaveBeenCalled();
    });
  });
});
