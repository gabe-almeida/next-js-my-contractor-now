/**
 * Decimal Helper Utilities for Financial Calculations
 *
 * Provides safe decimal arithmetic for money operations
 */

import { Decimal } from 'decimal.js';

/**
 * Convert any value to Decimal safely
 */
export function toDecimal(value: any): Decimal {
  if (value instanceof Decimal) {
    return value;
  }
  if (value === null || value === undefined || value === '') {
    return new Decimal(0);
  }
  try {
    return new Decimal(value);
  } catch {
    return new Decimal(0);
  }
}

/**
 * Convert Decimal to number for legacy APIs
 */
export function toNumber(value: Decimal | number | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }
  if (value instanceof Decimal) {
    return value.toNumber();
  }
  return value;
}

/**
 * Convert Decimal to string for database storage
 */
export function toDecimalString(value: Decimal | number | null | undefined): string {
  if (value === null || value === undefined) {
    return '0.00';
  }
  if (value instanceof Decimal) {
    return value.toDecimalPlaces(2).toString();
  }
  return new Decimal(value).toDecimalPlaces(2).toString();
}

/**
 * Find maximum bid from array of bid amounts
 */
export function maxBid(bids: (Decimal | number)[]): Decimal {
  if (bids.length === 0) {
    return new Decimal(0);
  }

  const decimalBids = bids.map(toDecimal);
  return Decimal.max(...decimalBids);
}

/**
 * Find minimum bid from array of bid amounts
 */
export function minBid(bids: (Decimal | number)[]): Decimal {
  if (bids.length === 0) {
    return new Decimal(0);
  }

  const decimalBids = bids.map(toDecimal);
  return Decimal.min(...decimalBids);
}

/**
 * Check if bid is within valid range
 */
export function isBidInRange(
  bidAmount: Decimal | number,
  minBid: Decimal | number,
  maxBid: Decimal | number
): boolean {
  const bid = toDecimal(bidAmount);
  const min = toDecimal(minBid);
  const max = toDecimal(maxBid);

  return bid.greaterThanOrEqualTo(min) && bid.lessThanOrEqualTo(max);
}

/**
 * Clamp bid to valid range
 */
export function clampBid(
  bidAmount: Decimal | number,
  minBid: Decimal | number,
  maxBid: Decimal | number
): Decimal {
  const bid = toDecimal(bidAmount);
  const min = toDecimal(minBid);
  const max = toDecimal(maxBid);

  if (bid.lessThan(min)) {
    return min;
  }
  if (bid.greaterThan(max)) {
    return max;
  }
  return bid;
}

/**
 * Compare two bid amounts
 */
export function compareBids(bid1: Decimal | number, bid2: Decimal | number): number {
  const decimal1 = toDecimal(bid1);
  const decimal2 = toDecimal(bid2);

  if (decimal1.greaterThan(decimal2)) return 1;
  if (decimal1.lessThan(decimal2)) return -1;
  return 0;
}

/**
 * Check if two bids are equal
 */
export function bidsEqual(bid1: Decimal | number, bid2: Decimal | number): boolean {
  return toDecimal(bid1).equals(toDecimal(bid2));
}

/**
 * Add multiple bid amounts together
 */
export function sumBids(bids: (Decimal | number)[]): Decimal {
  return bids.reduce((sum, bid) => {
    return sum.plus(toDecimal(bid));
  }, new Decimal(0));
}

/**
 * Calculate average bid amount
 */
export function averageBid(bids: (Decimal | number)[]): Decimal {
  if (bids.length === 0) {
    return new Decimal(0);
  }

  const total = sumBids(bids);
  return total.dividedBy(bids.length);
}

/**
 * Round to 2 decimal places (currency precision)
 */
export function roundCurrency(amount: Decimal | number): Decimal {
  return toDecimal(amount).toDecimalPlaces(2);
}

/**
 * Format as currency string
 */
export function formatCurrency(amount: Decimal | number, currencySymbol: string = '$'): string {
  const decimal = toDecimal(amount).toDecimalPlaces(2);
  return `${currencySymbol}${decimal.toString()}`;
}

/**
 * Parse currency string to Decimal
 */
export function parseCurrency(currencyString: string): Decimal {
  // Remove currency symbols and commas
  const cleanString = currencyString.replace(/[$,]/g, '').trim();
  return toDecimal(cleanString);
}
