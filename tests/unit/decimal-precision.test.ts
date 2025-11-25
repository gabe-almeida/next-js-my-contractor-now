/**
 * Decimal Precision Tests for Financial Calculations
 *
 * Tests that money calculations maintain precision and avoid floating-point errors
 */

import { describe, it, expect } from '@jest/globals';
import { Decimal } from 'decimal.js';

describe('Decimal Precision for Financial Operations', () => {
  describe('Floating Point Problems (What We\'re Fixing)', () => {
    it('demonstrates float precision loss', () => {
      // This is the problem we're solving
      const float1 = 0.1;
      const float2 = 0.2;
      const floatResult = float1 + float2;

      // Float arithmetic gives wrong result!
      expect(floatResult).not.toBe(0.3); // Actually 0.30000000000000004
      expect(floatResult).toBe(0.30000000000000004);
    });

    it('demonstrates cumulative float errors in bid calculations', () => {
      // Simulating bid additions with floats (WRONG)
      let floatTotal = 0.0;
      floatTotal += 10.10; // Bid 1
      floatTotal += 20.20; // Bid 2
      floatTotal += 30.30; // Bid 3

      // Should be 60.60 but isn't due to float precision
      expect(floatTotal).not.toBe(60.60);
    });
  });

  describe('Decimal.js Solution', () => {
    it('should perform accurate decimal addition', () => {
      const decimal1 = new Decimal('0.1');
      const decimal2 = new Decimal('0.2');
      const result = decimal1.plus(decimal2);

      expect(result.toString()).toBe('0.3');
      expect(result.toNumber()).toBe(0.3);
    });

    it('should perform accurate bid calculations', () => {
      const bid1 = new Decimal('10.10');
      const bid2 = new Decimal('20.20');
      const bid3 = new Decimal('30.30');

      const total = bid1.plus(bid2).plus(bid3);

      expect(total.toFixed(2)).toBe('60.60');
      expect(total.toNumber()).toBe(60.60);
    });

    it('should handle currency with 2 decimal places', () => {
      const amount = new Decimal('123.456');
      const rounded = amount.toDecimalPlaces(2);

      expect(rounded.toString()).toBe('123.46');
    });
  });

  describe('Bid Comparison Operations', () => {
    it('should accurately compare bid amounts', () => {
      const bid1 = new Decimal('50.00');
      const bid2 = new Decimal('50.01');
      const bid3 = new Decimal('49.99');

      expect(bid2.greaterThan(bid1)).toBe(true);
      expect(bid1.greaterThan(bid3)).toBe(true);
      expect(bid1.equals(new Decimal('50.00'))).toBe(true);
    });

    it('should find highest bid correctly', () => {
      const bids = [
        new Decimal('25.50'),
        new Decimal('30.25'),
        new Decimal('28.75'),
        new Decimal('35.00'),
        new Decimal('32.50')
      ];

      const highest = Decimal.max(...bids);
      expect(highest.toFixed(2)).toBe('35.00');
    });

    it('should find lowest bid correctly', () => {
      const bids = [
        new Decimal('25.50'),
        new Decimal('30.25'),
        new Decimal('28.75')
      ];

      const lowest = Decimal.min(...bids);
      expect(lowest.toFixed(2)).toBe('25.50');
    });
  });

  describe('Revenue Calculations', () => {
    it('should calculate daily revenue accurately', () => {
      const sales = [
        new Decimal('15.99'),
        new Decimal('25.50'),
        new Decimal('42.25'),
        new Decimal('18.75')
      ];

      let total = new Decimal(0);
      for (const sale of sales) {
        total = total.plus(sale);
      }

      expect(total.toString()).toBe('102.49');
    });

    it('should calculate commission correctly', () => {
      const saleAmount = new Decimal('100.00');
      const commissionRate = new Decimal('0.15'); // 15%

      const commission = saleAmount.times(commissionRate);

      expect(commission.toFixed(2)).toBe('15.00');
    });

    it('should handle currency rounding correctly', () => {
      const amounts = [
        new Decimal('10.555'), // Should round to 10.56
        new Decimal('10.554'), // Should round to 10.55
        new Decimal('10.545')  // Should round to 10.55 (banker's rounding)
      ];

      expect(amounts[0].toDecimalPlaces(2).toString()).toBe('10.56');
      expect(amounts[1].toDecimalPlaces(2).toString()).toBe('10.55');
      expect(amounts[2].toDecimalPlaces(2).toString()).toBe('10.55');
    });
  });

  describe('Bid Range Validation', () => {
    it('should validate bid is within min/max range', () => {
      const minBid = new Decimal('10.00');
      const maxBid = new Decimal('100.00');
      const testBid = new Decimal('50.00');

      const isValid = testBid.greaterThanOrEqualTo(minBid) &&
                      testBid.lessThanOrEqualTo(maxBid);

      expect(isValid).toBe(true);
    });

    it('should reject bid below minimum', () => {
      const minBid = new Decimal('10.00');
      const testBid = new Decimal('9.99');

      expect(testBid.lessThan(minBid)).toBe(true);
    });

    it('should reject bid above maximum', () => {
      const maxBid = new Decimal('100.00');
      const testBid = new Decimal('100.01');

      expect(testBid.greaterThan(maxBid)).toBe(true);
    });
  });

  describe('Database Conversion', () => {
    it('should convert Decimal to string for database storage', () => {
      const amount = new Decimal('123.45');
      const dbValue = amount.toString();

      expect(dbValue).toBe('123.45');
      expect(typeof dbValue).toBe('string');
    });

    it('should parse string from database back to Decimal', () => {
      const dbValue = '123.45';
      const amount = new Decimal(dbValue);

      expect(amount.toString()).toBe('123.45');
      expect(amount.toNumber()).toBe(123.45);
    });

    it('should handle null/undefined gracefully', () => {
      const nullValue = null;
      const undefinedValue = undefined;

      // Should default to 0 or handle appropriately
      const amount1 = new Decimal(nullValue || 0);
      const amount2 = new Decimal(undefinedValue || 0);

      expect(amount1.toString()).toBe('0');
      expect(amount2.toString()).toBe('0');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large amounts', () => {
      const largeAmount = new Decimal('999999999.99');
      const result = largeAmount.plus('0.01');

      expect(result.toFixed(2)).toBe('1000000000.00');
    });

    it('should handle very small amounts', () => {
      const smallAmount = new Decimal('0.01');
      const result = smallAmount.times('0.1');

      expect(result.toString()).toBe('0.001');
      expect(result.toDecimalPlaces(2).toFixed(2)).toBe('0.00');
    });

    it('should handle zero correctly', () => {
      const zero = new Decimal('0.00');
      const amount = new Decimal('10.00');

      expect(zero.isZero()).toBe(true);
      expect(amount.plus(zero).toFixed(2)).toBe('10.00');
    });

    it('should handle negative amounts (refunds)', () => {
      const amount = new Decimal('50.00');
      const refund = new Decimal('-25.00');

      const result = amount.plus(refund);
      expect(result.toFixed(2)).toBe('25.00');
    });
  });

  describe('Auction Winner Selection', () => {
    it('should select correct winner from bids', () => {
      const bids = [
        { buyerId: 'buyer1', amount: new Decimal('25.00') },
        { buyerId: 'buyer2', amount: new Decimal('35.50') },
        { buyerId: 'buyer3', amount: new Decimal('30.25') },
        { buyerId: 'buyer4', amount: new Decimal('35.50') } // Tie
      ];

      // Find highest bid
      const highestBid = Decimal.max(...bids.map(b => b.amount));
      expect(highestBid.toFixed(2)).toBe('35.50');

      // Get all bids matching highest
      const winners = bids.filter(b => b.amount.equals(highestBid));
      expect(winners.length).toBe(2); // Two tied winners
    });
  });

  describe('Performance', () => {
    it('should handle thousands of calculations efficiently', () => {
      const startTime = Date.now();

      let total = new Decimal(0);
      for (let i = 0; i < 10000; i++) {
        total = total.plus(new Decimal('1.23'));
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(total.toFixed(2)).toBe('12300.00');
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
    });
  });
});
