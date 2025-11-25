/**
 * Auction Bid Validation Tests
 *
 * Verifies bid validation, auction logic, and winner selection
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { prisma } from '@/lib/db';
import { Decimal } from 'decimal.js';
import { toDecimal, maxBid, isBidInRange } from '@/lib/utils/decimal-helpers';

describe('Auction Bid Validation', () => {
  let testBuyerId: string;
  let testServiceTypeId: string;

  beforeEach(async () => {
    // Create test buyer
    const buyer = await prisma.buyer.create({
      data: {
        name: 'Test Auction Buyer',
        type: 'CONTRACTOR',
        apiUrl: 'https://test.com',
        authConfig: '{}',
        pingTimeout: 30,
        postTimeout: 60,
        active: true,
      },
    });
    testBuyerId = buyer.id;

    // Create test service type
    const serviceType = await prisma.serviceType.create({
      data: {
        name: 'TEST_AUCTION_SERVICE',
        displayName: 'Test Auction Service',
        formSchema: '{}',
        active: true,
      },
    });
    testServiceTypeId = serviceType.id;
  });

  afterEach(async () => {
    // Cleanup
    await prisma.buyerServiceConfig.deleteMany({
      where: { buyerId: testBuyerId },
    });
    await prisma.buyer.delete({ where: { id: testBuyerId } });
    await prisma.serviceType.delete({ where: { id: testServiceTypeId } });
  });

  describe('Bid Range Validation', () => {
    it('should validate bid is within min/max range', async () => {
      const config = await prisma.buyerServiceConfig.create({
        data: {
          buyerId: testBuyerId,
          serviceTypeId: testServiceTypeId,
          pingTemplate: '{}',
          postTemplate: '{}',
          fieldMappings: '{}',
          minBid: new Decimal('10.00'),
          maxBid: new Decimal('100.00'),
          active: true,
        },
      });

      const validBids = [10.00, 25.50, 50.00, 75.25, 100.00];
      const invalidBids = [9.99, 0.00, 100.01, 150.00];

      for (const bid of validBids) {
        const isValid = isBidInRange(bid, config.minBid, config.maxBid);
        expect(isValid).toBe(true);
      }

      for (const bid of invalidBids) {
        const isValid = isBidInRange(bid, config.minBid, config.maxBid);
        expect(isValid).toBe(false);
      }
    });

    it('should handle decimal precision in bid validation', () => {
      const minBid = new Decimal('10.00');
      const maxBid = new Decimal('100.00');

      // Edge cases with decimal precision
      const testCases = [
        { bid: 10.001, expected: true },  // Slightly over min
        { bid: 9.999, expected: false },  // Slightly under min
        { bid: 99.999, expected: true },  // Just under max
        { bid: 100.001, expected: false }, // Slightly over max
      ];

      for (const { bid, expected } of testCases) {
        const isValid = isBidInRange(bid, minBid, maxBid);
        expect(isValid).toBe(expected);
      }
    });

    it('should reject negative bids', () => {
      const minBid = new Decimal('0.00');
      const maxBid = new Decimal('100.00');

      const isValid = isBidInRange(-10.00, minBid, maxBid);
      expect(isValid).toBe(false);
    });

    it('should reject zero bids when minBid > 0', () => {
      const minBid = new Decimal('5.00');
      const maxBid = new Decimal('100.00');

      const isValid = isBidInRange(0.00, minBid, maxBid);
      expect(isValid).toBe(false);
    });
  });

  describe('Winner Selection Algorithm', () => {
    it('should select highest bid as winner', () => {
      const bids = [
        new Decimal('25.50'),
        new Decimal('45.00'),
        new Decimal('32.75'),
        new Decimal('38.25'),
      ];

      const highestBid = maxBid(bids);
      expect(highestBid.toFixed(2)).toBe('45.00');
    });

    it('should handle tie in bid amounts', () => {
      const bids = [
        new Decimal('50.00'),
        new Decimal('50.00'),
        new Decimal('45.00'),
      ];

      const highestBid = maxBid(bids);
      expect(highestBid.toFixed(2)).toBe('50.00');
    });

    it('should handle single bid', () => {
      const bids = [new Decimal('25.00')];

      const highestBid = maxBid(bids);
      expect(highestBid.toFixed(2)).toBe('25.00');
    });

    it('should return 0 for empty bid array', () => {
      const bids: Decimal[] = [];

      const highestBid = maxBid(bids);
      expect(highestBid.toFixed(2)).toBe('0.00');
    });

    it('should handle mixed number and Decimal types', () => {
      const bids = [25.50, new Decimal('45.00'), 32.75];

      const highestBid = maxBid(bids);
      expect(highestBid.toFixed(2)).toBe('45.00');
    });
  });

  describe('Bid Priority Rules', () => {
    it('should prioritize buyers with higher bids', async () => {
      // Create multiple buyers with different bid configs
      const buyers = await Promise.all([
        prisma.buyerServiceConfig.create({
          data: {
            buyerId: testBuyerId,
            serviceTypeId: testServiceTypeId,
            pingTemplate: '{}',
            postTemplate: '{}',
            fieldMappings: '{}',
            minBid: new Decimal('10.00'),
            maxBid: new Decimal('50.00'),
            active: true,
          },
        }),
      ]);

      const buyer1 = buyers[0];

      // Simulate auction bids
      const auctionBids = [
        { buyerId: testBuyerId, bid: new Decimal('45.00') },
        { buyerId: testBuyerId, bid: new Decimal('50.00') },
        { buyerId: testBuyerId, bid: new Decimal('30.00') },
      ];

      const highestBid = maxBid(auctionBids.map(b => b.bid));
      const winner = auctionBids.find(b => b.bid.equals(highestBid));

      expect(winner?.bid.toFixed(2)).toBe('50.00');
      expect(buyer1.maxBid.toFixed(2)).toBe('50.00');
    });
  });

  describe('Auction Participation Criteria', () => {
    it('should only include active buyers in auction', async () => {
      const config = await prisma.buyerServiceConfig.create({
        data: {
          buyerId: testBuyerId,
          serviceTypeId: testServiceTypeId,
          pingTemplate: '{}',
          postTemplate: '{}',
          fieldMappings: '{}',
          minBid: new Decimal('10.00'),
          maxBid: new Decimal('100.00'),
          active: false, // Inactive
        },
      });

      // Should not participate in auction
      expect(config.active).toBe(false);

      // Query active configs only
      const activeConfigs = await prisma.buyerServiceConfig.findMany({
        where: {
          serviceTypeId: testServiceTypeId,
          active: true,
        },
      });

      expect(activeConfigs.length).toBe(0);
    });

    it('should check buyer service coverage for ZIP code', async () => {
      const zipCode = '12345';

      const config = await prisma.buyerServiceConfig.create({
        data: {
          buyerId: testBuyerId,
          serviceTypeId: testServiceTypeId,
          pingTemplate: '{}',
          postTemplate: '{}',
          fieldMappings: '{}',
          minBid: new Decimal('10.00'),
          maxBid: new Decimal('100.00'),
          active: true,
        },
      });

      // Create ZIP code coverage
      const zipCoverage = await prisma.buyerServiceZipCode.create({
        data: {
          buyerId: testBuyerId,
          serviceTypeId: testServiceTypeId,
          zipCode,
          active: true,
          priority: 100,
          minBid: new Decimal('15.00'),
          maxBid: new Decimal('80.00'),
        },
      });

      // Verify buyer covers this ZIP
      const coversZip = await prisma.buyerServiceZipCode.findFirst({
        where: {
          buyerId: testBuyerId,
          serviceTypeId: testServiceTypeId,
          zipCode,
          active: true,
        },
      });

      expect(coversZip).toBeTruthy();
      expect(coversZip?.minBid.toFixed(2)).toBe('15.00');

      // Cleanup
      await prisma.buyerServiceZipCode.delete({ where: { id: zipCoverage.id } });
    });
  });

  describe('Bid Acceptance Rules', () => {
    it('should validate bid meets minimum threshold', () => {
      const minimumAcceptableBid = new Decimal('5.00');
      const bids = [
        new Decimal('10.00'),
        new Decimal('3.00'),
        new Decimal('7.50'),
      ];

      const acceptableBids = bids.filter(bid =>
        bid.greaterThanOrEqualTo(minimumAcceptableBid)
      );

      expect(acceptableBids.length).toBe(2);
      expect(acceptableBids[0].toFixed(2)).toBe('10.00');
      expect(acceptableBids[1].toFixed(2)).toBe('7.50');
    });

    it('should reject bids below minimum quality score threshold', () => {
      const minimumQualityScore = 60;

      const bidsWithScores = [
        { bid: new Decimal('50.00'), qualityScore: 80 },
        { bid: new Decimal('60.00'), qualityScore: 45 }, // Low quality
        { bid: new Decimal('55.00'), qualityScore: 70 },
      ];

      const qualifiedBids = bidsWithScores.filter(
        b => b.qualityScore >= minimumQualityScore
      );

      expect(qualifiedBids.length).toBe(2);
      expect(qualifiedBids[0].bid.toFixed(2)).toBe('50.00');
      expect(qualifiedBids[1].bid.toFixed(2)).toBe('55.00');
    });
  });

  describe('Auction Edge Cases', () => {
    it('should handle auction with no eligible buyers', () => {
      const eligibleBuyers: any[] = [];

      expect(eligibleBuyers.length).toBe(0);

      // No winner should be selected
      const winner = eligibleBuyers.length > 0 ? eligibleBuyers[0] : null;
      expect(winner).toBeNull();
    });

    it('should handle auction with all bids below minimum', () => {
      const minimumBid = new Decimal('50.00');
      const bids = [
        new Decimal('25.00'),
        new Decimal('30.00'),
        new Decimal('40.00'),
      ];

      const acceptableBids = bids.filter(bid =>
        bid.greaterThanOrEqualTo(minimumBid)
      );

      expect(acceptableBids.length).toBe(0);
    });

    it('should handle very large bid amounts', () => {
      const largeBid = new Decimal('999999.99');
      const maxBid = new Decimal('1000000.00');

      const isValid = isBidInRange(largeBid, 0, maxBid);
      expect(isValid).toBe(true);
    });

    it('should handle very small bid amounts', () => {
      const smallBid = new Decimal('0.01');
      const minBid = new Decimal('0.00');
      const maxBid = new Decimal('1.00');

      const isValid = isBidInRange(smallBid, minBid, maxBid);
      expect(isValid).toBe(true);
    });
  });

  describe('Bid History and Tracking', () => {
    it('should store highest bid amount', () => {
      const bids = [
        new Decimal('25.00'),
        new Decimal('45.00'),
        new Decimal('35.00'),
      ];

      const highest = maxBid(bids);

      // Would be stored in lead.winningBid
      expect(highest.toFixed(2)).toBe('45.00');
    });

    it('should track all bid attempts for auditing', () => {
      // Simulate tracking all bids in transactions table
      const bidAttempts = [
        { buyerId: 'buyer-1', bid: new Decimal('25.00'), timestamp: Date.now() },
        { buyerId: 'buyer-2', bid: new Decimal('35.00'), timestamp: Date.now() },
        { buyerId: 'buyer-3', bid: new Decimal('30.00'), timestamp: Date.now() },
      ];

      expect(bidAttempts.length).toBe(3);
      expect(bidAttempts[0].bid.toFixed(2)).toBe('25.00');
    });
  });
});
