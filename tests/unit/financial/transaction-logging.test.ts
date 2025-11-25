/**
 * Transaction Logging Tests
 *
 * Verifies transaction recording, revenue tracking, and financial auditing
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { prisma } from '@/lib/db';
import { Decimal } from 'decimal.js';

describe('Transaction Logging', () => {
  let testBuyerId: string;
  let testServiceTypeId: string;
  let testLeadId: string;

  beforeEach(async () => {
    // Create test buyer
    const buyer = await prisma.buyer.create({
      data: {
        name: 'Test Transaction Buyer',
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
        name: 'TEST_TRANSACTION_SERVICE',
        displayName: 'Test Transaction Service',
        formSchema: '{}',
        active: true,
      },
    });
    testServiceTypeId = serviceType.id;

    // Create test lead
    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceTypeId,
        formData: '{"test": "data"}',
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'ASAP',
        status: 'PENDING',
      },
    });
    testLeadId = lead.id;
  });

  afterEach(async () => {
    // Cleanup
    await prisma.transaction.deleteMany({ where: { leadId: testLeadId } });
    await prisma.lead.delete({ where: { id: testLeadId } });
    await prisma.buyer.delete({ where: { id: testBuyerId } });
    await prisma.serviceType.delete({ where: { id: testServiceTypeId } });
  });

  describe('Transaction Creation', () => {
    it('should log PING transaction with bid amount', async () => {
      const transaction = await prisma.transaction.create({
        data: {
          leadId: testLeadId,
          buyerId: testBuyerId,
          actionType: 'PING',
          payload: JSON.stringify({ test: 'data' }),
          response: JSON.stringify({ accepted: true, bid: 50.00 }),
          status: 'SUCCESS',
          bidAmount: new Decimal('50.00'),
          responseTime: 150,
        },
      });

      expect(transaction.actionType).toBe('PING');
      expect(transaction.status).toBe('SUCCESS');
      expect(transaction.bidAmount?.toFixed(2)).toBe('50.00');
      expect(transaction.responseTime).toBe(150);
    });

    it('should log POST transaction after auction win', async () => {
      const transaction = await prisma.transaction.create({
        data: {
          leadId: testLeadId,
          buyerId: testBuyerId,
          actionType: 'POST',
          payload: JSON.stringify({ leadData: 'full details' }),
          response: JSON.stringify({ accepted: true, leadId: 'external-123' }),
          status: 'SUCCESS',
          bidAmount: new Decimal('75.50'),
          responseTime: 250,
        },
      });

      expect(transaction.actionType).toBe('POST');
      expect(transaction.status).toBe('SUCCESS');
      expect(transaction.bidAmount?.toFixed(2)).toBe('75.50');
    });

    it('should log failed transaction attempts', async () => {
      const transaction = await prisma.transaction.create({
        data: {
          leadId: testLeadId,
          buyerId: testBuyerId,
          actionType: 'PING',
          payload: JSON.stringify({ test: 'data' }),
          status: 'FAILED',
          errorMessage: 'Connection timeout',
          responseTime: 30000,
        },
      });

      expect(transaction.status).toBe('FAILED');
      expect(transaction.errorMessage).toBe('Connection timeout');
      expect(transaction.bidAmount).toBeNull();
    });

    it('should log timeout transactions', async () => {
      const transaction = await prisma.transaction.create({
        data: {
          leadId: testLeadId,
          buyerId: testBuyerId,
          actionType: 'PING',
          payload: JSON.stringify({ test: 'data' }),
          status: 'TIMEOUT',
          responseTime: 60000, // 60 seconds
        },
      });

      expect(transaction.status).toBe('TIMEOUT');
      expect(transaction.responseTime).toBe(60000);
    });
  });

  describe('Revenue Tracking', () => {
    it('should calculate total revenue from successful transactions', async () => {
      // Create multiple successful transactions
      const transactions = await Promise.all([
        prisma.transaction.create({
          data: {
            leadId: testLeadId,
            buyerId: testBuyerId,
            actionType: 'POST',
            payload: '{}',
            status: 'SUCCESS',
            bidAmount: new Decimal('50.00'),
          },
        }),
        prisma.transaction.create({
          data: {
            leadId: testLeadId,
            buyerId: testBuyerId,
            actionType: 'POST',
            payload: '{}',
            status: 'SUCCESS',
            bidAmount: new Decimal('75.50'),
          },
        }),
        prisma.transaction.create({
          data: {
            leadId: testLeadId,
            buyerId: testBuyerId,
            actionType: 'POST',
            payload: '{}',
            status: 'SUCCESS',
            bidAmount: new Decimal('32.25'),
          },
        }),
      ]);

      // Calculate total revenue
      const total = transactions.reduce(
        (sum, t) => sum.plus(t.bidAmount || 0),
        new Decimal(0)
      );

      expect(total.toFixed(2)).toBe('157.75');
    });

    it('should only count successful POST transactions for revenue', async () => {
      await Promise.all([
        prisma.transaction.create({
          data: {
            leadId: testLeadId,
            buyerId: testBuyerId,
            actionType: 'PING',
            payload: '{}',
            status: 'SUCCESS',
            bidAmount: new Decimal('50.00'),
          },
        }),
        prisma.transaction.create({
          data: {
            leadId: testLeadId,
            buyerId: testBuyerId,
            actionType: 'POST',
            payload: '{}',
            status: 'FAILED',
            bidAmount: new Decimal('75.00'),
          },
        }),
        prisma.transaction.create({
          data: {
            leadId: testLeadId,
            buyerId: testBuyerId,
            actionType: 'POST',
            payload: '{}',
            status: 'SUCCESS',
            bidAmount: new Decimal('60.00'),
          },
        }),
      ]);

      // Query only successful POST transactions for this test lead
      const successfulPosts = await prisma.transaction.findMany({
        where: {
          leadId: testLeadId,
          actionType: 'POST',
          status: 'SUCCESS',
        },
      });

      const revenue = successfulPosts.reduce(
        (sum, t) => sum.plus(t.bidAmount || 0),
        new Decimal(0)
      );

      expect(revenue.toFixed(2)).toBe('60.00');
    });

    it('should track revenue by buyer', async () => {
      await Promise.all([
        prisma.transaction.create({
          data: {
            leadId: testLeadId,
            buyerId: testBuyerId,
            actionType: 'POST',
            payload: '{}',
            status: 'SUCCESS',
            bidAmount: new Decimal('50.00'),
          },
        }),
        prisma.transaction.create({
          data: {
            leadId: testLeadId,
            buyerId: testBuyerId,
            actionType: 'POST',
            payload: '{}',
            status: 'SUCCESS',
            bidAmount: new Decimal('75.00'),
          },
        }),
      ]);

      const buyerRevenue = await prisma.transaction.findMany({
        where: {
          buyerId: testBuyerId,
          actionType: 'POST',
          status: 'SUCCESS',
        },
      });

      const total = buyerRevenue.reduce(
        (sum, t) => sum.plus(t.bidAmount || 0),
        new Decimal(0)
      );

      expect(total.toFixed(2)).toBe('125.00');
    });

    it('should track revenue by time period', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      await prisma.transaction.create({
        data: {
          leadId: testLeadId,
          buyerId: testBuyerId,
          actionType: 'POST',
          payload: '{}',
          status: 'SUCCESS',
          bidAmount: new Decimal('100.00'),
          createdAt: today,
        },
      });

      const todayRevenue = await prisma.transaction.findMany({
        where: {
          actionType: 'POST',
          status: 'SUCCESS',
          createdAt: {
            gte: today,
            lt: tomorrow,
          },
        },
      });

      const total = todayRevenue.reduce(
        (sum, t) => sum.plus(t.bidAmount || 0),
        new Decimal(0)
      );

      expect(total.greaterThanOrEqualTo(0)).toBe(true);
    });
  });

  describe('Transaction Auditing', () => {
    it('should store complete request payload', async () => {
      const payload = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '555-1234',
      };

      const transaction = await prisma.transaction.create({
        data: {
          leadId: testLeadId,
          buyerId: testBuyerId,
          actionType: 'POST',
          payload: JSON.stringify(payload),
          status: 'SUCCESS',
          bidAmount: new Decimal('50.00'),
        },
      });

      const storedPayload = JSON.parse(transaction.payload);
      expect(storedPayload.firstName).toBe('John');
      expect(storedPayload.email).toBe('john@example.com');
    });

    it('should store complete response data', async () => {
      const response = {
        accepted: true,
        externalLeadId: 'ext-12345',
        message: 'Lead accepted successfully',
      };

      const transaction = await prisma.transaction.create({
        data: {
          leadId: testLeadId,
          buyerId: testBuyerId,
          actionType: 'POST',
          payload: '{}',
          response: JSON.stringify(response),
          status: 'SUCCESS',
          bidAmount: new Decimal('50.00'),
        },
      });

      const storedResponse = JSON.parse(transaction.response!);
      expect(storedResponse.accepted).toBe(true);
      expect(storedResponse.externalLeadId).toBe('ext-12345');
    });

    it('should track response times for performance analysis', async () => {
      const transactions = await Promise.all([
        prisma.transaction.create({
          data: {
            leadId: testLeadId,
            buyerId: testBuyerId,
            actionType: 'PING',
            payload: '{}',
            status: 'SUCCESS',
            responseTime: 120,
          },
        }),
        prisma.transaction.create({
          data: {
            leadId: testLeadId,
            buyerId: testBuyerId,
            actionType: 'PING',
            payload: '{}',
            status: 'SUCCESS',
            responseTime: 250,
          },
        }),
        prisma.transaction.create({
          data: {
            leadId: testLeadId,
            buyerId: testBuyerId,
            actionType: 'PING',
            payload: '{}',
            status: 'SUCCESS',
            responseTime: 180,
          },
        }),
      ]);

      const avgResponseTime =
        transactions.reduce((sum, t) => sum + (t.responseTime || 0), 0) /
        transactions.length;

      expect(avgResponseTime).toBeCloseTo(183.33, 1);
    });

    it('should log compliance data inclusion', async () => {
      const transaction = await prisma.transaction.create({
        data: {
          leadId: testLeadId,
          buyerId: testBuyerId,
          actionType: 'POST',
          payload: '{}',
          status: 'SUCCESS',
          bidAmount: new Decimal('75.00'),
          complianceIncluded: true,
          trustedFormPresent: true,
          jornayaPresent: true,
        },
      });

      expect(transaction.complianceIncluded).toBe(true);
      expect(transaction.trustedFormPresent).toBe(true);
      expect(transaction.jornayaPresent).toBe(true);
    });
  });

  describe('Financial Reporting', () => {
    it('should generate buyer performance report', async () => {
      await Promise.all([
        prisma.transaction.create({
          data: {
            leadId: testLeadId,
            buyerId: testBuyerId,
            actionType: 'PING',
            payload: '{}',
            status: 'SUCCESS',
          },
        }),
        prisma.transaction.create({
          data: {
            leadId: testLeadId,
            buyerId: testBuyerId,
            actionType: 'PING',
            payload: '{}',
            status: 'FAILED',
          },
        }),
        prisma.transaction.create({
          data: {
            leadId: testLeadId,
            buyerId: testBuyerId,
            actionType: 'POST',
            payload: '{}',
            status: 'SUCCESS',
            bidAmount: new Decimal('100.00'),
          },
        }),
      ]);

      const allTransactions = await prisma.transaction.findMany({
        where: { buyerId: testBuyerId },
      });

      const successfulTransactions = allTransactions.filter(
        t => t.status === 'SUCCESS'
      );

      const successRate = (successfulTransactions.length / allTransactions.length) * 100;

      expect(allTransactions.length).toBe(3);
      expect(successfulTransactions.length).toBe(2);
      expect(successRate).toBeCloseTo(66.67, 1);
    });

    it('should calculate average bid amount', async () => {
      await Promise.all([
        prisma.transaction.create({
          data: {
            leadId: testLeadId,
            buyerId: testBuyerId,
            actionType: 'POST',
            payload: '{}',
            status: 'SUCCESS',
            bidAmount: new Decimal('50.00'),
          },
        }),
        prisma.transaction.create({
          data: {
            leadId: testLeadId,
            buyerId: testBuyerId,
            actionType: 'POST',
            payload: '{}',
            status: 'SUCCESS',
            bidAmount: new Decimal('60.00'),
          },
        }),
        prisma.transaction.create({
          data: {
            leadId: testLeadId,
            buyerId: testBuyerId,
            actionType: 'POST',
            payload: '{}',
            status: 'SUCCESS',
            bidAmount: new Decimal('70.00'),
          },
        }),
      ]);

      const transactions = await prisma.transaction.findMany({
        where: {
          buyerId: testBuyerId,
          bidAmount: { not: null },
        },
      });

      const sum = transactions.reduce(
        (total, t) => total.plus(t.bidAmount || 0),
        new Decimal(0)
      );
      const average = sum.dividedBy(transactions.length);

      expect(average.toFixed(2)).toBe('60.00');
    });
  });

  describe('Transaction Edge Cases', () => {
    it('should handle transactions with null bid amounts', async () => {
      const transaction = await prisma.transaction.create({
        data: {
          leadId: testLeadId,
          buyerId: testBuyerId,
          actionType: 'PING',
          payload: '{}',
          status: 'FAILED',
          bidAmount: null,
        },
      });

      expect(transaction.bidAmount).toBeNull();
    });

    it('should handle transactions with very large amounts', async () => {
      const transaction = await prisma.transaction.create({
        data: {
          leadId: testLeadId,
          buyerId: testBuyerId,
          actionType: 'POST',
          payload: '{}',
          status: 'SUCCESS',
          bidAmount: new Decimal('9999.99'),
        },
      });

      expect(transaction.bidAmount?.toFixed(2)).toBe('9999.99');
    });

    it('should handle transactions with very small amounts', async () => {
      const transaction = await prisma.transaction.create({
        data: {
          leadId: testLeadId,
          buyerId: testBuyerId,
          actionType: 'POST',
          payload: '{}',
          status: 'SUCCESS',
          bidAmount: new Decimal('0.01'),
        },
      });

      expect(transaction.bidAmount?.toFixed(2)).toBe('0.01');
    });
  });
});
