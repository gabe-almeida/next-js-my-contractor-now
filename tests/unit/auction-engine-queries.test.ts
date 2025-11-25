/**
 * Unit tests for AuctionEngine database query fixes
 * Tests the critical getBuyerDailyVolume() and getWinningBid() methods
 */

import { PrismaClient } from '@prisma/client';

// Mock Prisma
const mockPrismaCount = jest.fn();
const mockPrismaFindFirst = jest.fn();

jest.mock('@/lib/db', () => ({
  prisma: {
    transaction: {
      count: mockPrismaCount,
      findFirst: mockPrismaFindFirst,
    },
  },
}));

// Import after mocking
import AuctionEngine from '@/lib/auction/engine';

describe('AuctionEngine Database Query Fixes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getBuyerDailyVolume()', () => {
    it('should return 0 for buyer with no transactions', async () => {
      mockPrismaCount.mockResolvedValue(0);

      // Use reflection to access private method
      const result = await (AuctionEngine as any).getBuyerDailyVolume('buyer-123');

      expect(result).toBe(0);
      expect(mockPrismaCount).toHaveBeenCalledTimes(1);
      expect(mockPrismaCount).toHaveBeenCalledWith({
        where: {
          buyerId: 'buyer-123',
          actionType: 'POST',
          status: 'SUCCESS',
          createdAt: {
            gte: expect.any(Date),
          },
        },
      });
    });

    it('should return correct count for buyer with multiple transactions', async () => {
      mockPrismaCount.mockResolvedValue(5);

      const result = await (AuctionEngine as any).getBuyerDailyVolume('buyer-456');

      expect(result).toBe(5);
      expect(mockPrismaCount).toHaveBeenCalledTimes(1);
    });

    it('should only count POST transactions (not PING)', async () => {
      mockPrismaCount.mockResolvedValue(3);

      await (AuctionEngine as any).getBuyerDailyVolume('buyer-789');

      const callArgs = mockPrismaCount.mock.calls[0][0];
      expect(callArgs.where.actionType).toBe('POST');
    });

    it('should only count SUCCESS status (not FAILED)', async () => {
      mockPrismaCount.mockResolvedValue(2);

      await (AuctionEngine as any).getBuyerDailyVolume('buyer-abc');

      const callArgs = mockPrismaCount.mock.calls[0][0];
      expect(callArgs.where.status).toBe('SUCCESS');
    });

    it('should only count transactions from today', async () => {
      mockPrismaCount.mockResolvedValue(4);

      await (AuctionEngine as any).getBuyerDailyVolume('buyer-def');

      const callArgs = mockPrismaCount.mock.calls[0][0];
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      expect(callArgs.where.createdAt.gte).toBeInstanceOf(Date);
      const queriedDate = callArgs.where.createdAt.gte as Date;
      expect(queriedDate.getHours()).toBe(0);
      expect(queriedDate.getMinutes()).toBe(0);
      expect(queriedDate.getSeconds()).toBe(0);
      expect(queriedDate.getMilliseconds()).toBe(0);
    });

    it('should handle database errors gracefully', async () => {
      mockPrismaCount.mockRejectedValue(new Error('Database connection failed'));

      const result = await (AuctionEngine as any).getBuyerDailyVolume('buyer-error');

      expect(result).toBe(0);
      expect(mockPrismaCount).toHaveBeenCalledTimes(1);
    });

    it('should handle null/undefined buyerId gracefully', async () => {
      mockPrismaCount.mockResolvedValue(0);

      const result1 = await (AuctionEngine as any).getBuyerDailyVolume(null);
      const result2 = await (AuctionEngine as any).getBuyerDailyVolume(undefined);

      expect(result1).toBe(0);
      expect(result2).toBe(0);
    });

    it('should verify correct date range calculation', async () => {
      mockPrismaCount.mockResolvedValue(7);

      const testDate = new Date('2025-10-20T15:30:00Z');
      jest.useFakeTimers();
      jest.setSystemTime(testDate);

      await (AuctionEngine as any).getBuyerDailyVolume('buyer-123');

      const callArgs = mockPrismaCount.mock.calls[0][0];
      const queriedStartDate = callArgs.where.createdAt.gte as Date;

      // Verify it's the start of the day (hours, minutes, seconds, ms all set to 0)
      expect(queriedStartDate.getHours()).toBe(0);
      expect(queriedStartDate.getMinutes()).toBe(0);
      expect(queriedStartDate.getSeconds()).toBe(0);
      expect(queriedStartDate.getMilliseconds()).toBe(0);

      // Verify it's the same date
      expect(queriedStartDate.toISOString().split('T')[0]).toBe('2025-10-20');

      jest.useRealTimers();
    });
  });

  describe('getWinningBid()', () => {
    it('should return 0 when no transactions exist', async () => {
      mockPrismaFindFirst.mockResolvedValue(null);

      const result = await (AuctionEngine as any).getWinningBid('lead-123');

      expect(result).toBe(0);
      expect(mockPrismaFindFirst).toHaveBeenCalledTimes(1);
      expect(mockPrismaFindFirst).toHaveBeenCalledWith({
        where: {
          leadId: 'lead-123',
          actionType: 'PING',
          status: 'SUCCESS',
          bidAmount: {
            not: null,
          },
        },
        orderBy: {
          bidAmount: 'desc',
        },
        select: {
          bidAmount: true,
        },
      });
    });

    it('should return highest bid when multiple bids exist', async () => {
      mockPrismaFindFirst.mockResolvedValue({ bidAmount: 150.75 });

      const result = await (AuctionEngine as any).getWinningBid('lead-456');

      expect(result).toBe(150.75);
      expect(mockPrismaFindFirst).toHaveBeenCalledTimes(1);
    });

    it('should only consider PING transactions (not POST)', async () => {
      mockPrismaFindFirst.mockResolvedValue({ bidAmount: 100 });

      await (AuctionEngine as any).getWinningBid('lead-789');

      const callArgs = mockPrismaFindFirst.mock.calls[0][0];
      expect(callArgs.where.actionType).toBe('PING');
    });

    it('should ignore FAILED transactions', async () => {
      mockPrismaFindFirst.mockResolvedValue({ bidAmount: 75.5 });

      await (AuctionEngine as any).getWinningBid('lead-abc');

      const callArgs = mockPrismaFindFirst.mock.calls[0][0];
      expect(callArgs.where.status).toBe('SUCCESS');
    });

    it('should return 0 when bidAmount is null', async () => {
      mockPrismaFindFirst.mockResolvedValue({ bidAmount: null });

      const result = await (AuctionEngine as any).getWinningBid('lead-def');

      expect(result).toBe(0);
    });

    it('should verify orderBy descending', async () => {
      mockPrismaFindFirst.mockResolvedValue({ bidAmount: 200 });

      await (AuctionEngine as any).getWinningBid('lead-ghi');

      const callArgs = mockPrismaFindFirst.mock.calls[0][0];
      expect(callArgs.orderBy.bidAmount).toBe('desc');
    });

    it('should handle database errors gracefully', async () => {
      mockPrismaFindFirst.mockRejectedValue(new Error('Database query failed'));

      const result = await (AuctionEngine as any).getWinningBid('lead-error');

      expect(result).toBe(0);
      expect(mockPrismaFindFirst).toHaveBeenCalledTimes(1);
    });

    it('should handle null/undefined leadId gracefully', async () => {
      mockPrismaFindFirst.mockResolvedValue(null);

      const result1 = await (AuctionEngine as any).getWinningBid(null);
      const result2 = await (AuctionEngine as any).getWinningBid(undefined);

      expect(result1).toBe(0);
      expect(result2).toBe(0);
    });

    it('should exclude null bidAmounts in query', async () => {
      mockPrismaFindFirst.mockResolvedValue({ bidAmount: 99.99 });

      await (AuctionEngine as any).getWinningBid('lead-jkl');

      const callArgs = mockPrismaFindFirst.mock.calls[0][0];
      expect(callArgs.where.bidAmount).toEqual({ not: null });
    });

    it('should return correct decimal values', async () => {
      const testValues = [0.01, 10.50, 100.99, 999.99, 1234.56];

      for (const testValue of testValues) {
        mockPrismaFindFirst.mockResolvedValue({ bidAmount: testValue });

        const result = await (AuctionEngine as any).getWinningBid(`lead-${testValue}`);

        expect(result).toBe(testValue);
      }
    });

    it('should verify select only bidAmount field', async () => {
      mockPrismaFindFirst.mockResolvedValue({ bidAmount: 50 });

      await (AuctionEngine as any).getWinningBid('lead-mno');

      const callArgs = mockPrismaFindFirst.mock.calls[0][0];
      expect(callArgs.select).toEqual({ bidAmount: true });
    });
  });

  describe('Edge Cases and Integration', () => {
    it('should handle concurrent calls to getBuyerDailyVolume', async () => {
      mockPrismaCount
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(15);

      const promises = [
        (AuctionEngine as any).getBuyerDailyVolume('buyer-1'),
        (AuctionEngine as any).getBuyerDailyVolume('buyer-2'),
        (AuctionEngine as any).getBuyerDailyVolume('buyer-3'),
      ];

      const results = await Promise.all(promises);

      expect(results).toEqual([5, 10, 15]);
      expect(mockPrismaCount).toHaveBeenCalledTimes(3);
    });

    it('should handle concurrent calls to getWinningBid', async () => {
      mockPrismaFindFirst
        .mockResolvedValueOnce({ bidAmount: 100 })
        .mockResolvedValueOnce({ bidAmount: 200 })
        .mockResolvedValueOnce({ bidAmount: 300 });

      const promises = [
        (AuctionEngine as any).getWinningBid('lead-1'),
        (AuctionEngine as any).getWinningBid('lead-2'),
        (AuctionEngine as any).getWinningBid('lead-3'),
      ];

      const results = await Promise.all(promises);

      expect(results).toEqual([100, 200, 300]);
      expect(mockPrismaFindFirst).toHaveBeenCalledTimes(3);
    });

    it('should handle very large bid amounts', async () => {
      const largeBid = 999999.99;
      mockPrismaFindFirst.mockResolvedValue({ bidAmount: largeBid });

      const result = await (AuctionEngine as any).getWinningBid('lead-large');

      expect(result).toBe(largeBid);
    });

    it('should handle very large transaction counts', async () => {
      const largeCount = 10000;
      mockPrismaCount.mockResolvedValue(largeCount);

      const result = await (AuctionEngine as any).getBuyerDailyVolume('buyer-large');

      expect(result).toBe(largeCount);
    });

    it('should handle zero bid amounts', async () => {
      mockPrismaFindFirst.mockResolvedValue({ bidAmount: 0 });

      const result = await (AuctionEngine as any).getWinningBid('lead-zero');

      expect(result).toBe(0);
    });

    it('should handle empty string IDs', async () => {
      mockPrismaCount.mockResolvedValue(0);
      mockPrismaFindFirst.mockResolvedValue(null);

      const result1 = await (AuctionEngine as any).getBuyerDailyVolume('');
      const result2 = await (AuctionEngine as any).getWinningBid('');

      expect(result1).toBe(0);
      expect(result2).toBe(0);
    });
  });

  describe('Performance and Query Optimization', () => {
    it('should use indexed fields in queries', async () => {
      mockPrismaCount.mockResolvedValue(5);

      await (AuctionEngine as any).getBuyerDailyVolume('buyer-123');

      const callArgs = mockPrismaCount.mock.calls[0][0];
      // Verify that indexed fields are being used: buyerId, actionType, status, createdAt
      expect(callArgs.where).toHaveProperty('buyerId');
      expect(callArgs.where).toHaveProperty('actionType');
      expect(callArgs.where).toHaveProperty('status');
      expect(callArgs.where).toHaveProperty('createdAt');
    });

    it('should use efficient ordering in getWinningBid', async () => {
      mockPrismaFindFirst.mockResolvedValue({ bidAmount: 100 });

      await (AuctionEngine as any).getWinningBid('lead-123');

      const callArgs = mockPrismaFindFirst.mock.calls[0][0];
      // Verify findFirst with orderBy desc is used (gets highest bid in one query)
      expect(callArgs.orderBy).toEqual({ bidAmount: 'desc' });
    });

    it('should select only necessary fields', async () => {
      mockPrismaFindFirst.mockResolvedValue({ bidAmount: 100 });

      await (AuctionEngine as any).getWinningBid('lead-123');

      const callArgs = mockPrismaFindFirst.mock.calls[0][0];
      // Verify we only select bidAmount, not entire record
      expect(Object.keys(callArgs.select)).toEqual(['bidAmount']);
    });
  });
});
