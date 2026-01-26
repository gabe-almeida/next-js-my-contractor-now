/**
 * Invoice Number Service
 *
 * WHY: Generates unique, sequential invoice numbers in a thread-safe manner.
 *      Ensures no duplicates even with concurrent invoice creation.
 *
 * WHEN: Use this service when creating new invoices. Call getNextInvoiceNumber()
 *       to get a unique invoice number for either AR (Receivable) or AP (Payable).
 *
 * HOW: Uses database-level locking (SELECT FOR UPDATE) to atomically increment
 *      the sequence counter. Numbers follow format: AR-2024-00001 or AP-2024-00001.
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { InvoiceType } from '@prisma/client';

/** Invoice number prefix types */
type InvoicePrefix = 'AR' | 'AP';

/**
 * Maps invoice type to prefix
 */
function getPrefix(type: InvoiceType): InvoicePrefix {
  return type === 'RECEIVABLE' ? 'AR' : 'AP';
}

/**
 * Formats an invoice number with proper padding
 *
 * @param prefix - AR or AP
 * @param year - 4-digit year
 * @param number - Sequence number
 * @returns Formatted invoice number (e.g., AR-2024-00001)
 */
function formatInvoiceNumber(prefix: InvoicePrefix, year: number, number: number): string {
  return `${prefix}-${year}-${String(number).padStart(5, '0')}`;
}

/**
 * Generates the next invoice number for the given type
 *
 * Thread-safe using database-level locking with SELECT FOR UPDATE.
 * Creates new sequence row if one doesn't exist for prefix+year combination.
 *
 * @param type - RECEIVABLE (buyers owe us) or PAYABLE (we owe affiliates)
 * @returns Unique invoice number (e.g., AR-2024-00001, AP-2024-00002)
 * @throws Error if transaction fails
 *
 * @example
 * const invoiceNumber = await getNextInvoiceNumber('RECEIVABLE');
 * // Returns: "AR-2024-00001"
 */
export async function getNextInvoiceNumber(type: InvoiceType): Promise<string> {
  const prefix = getPrefix(type);
  const year = new Date().getFullYear();

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Lock the row for this prefix + year combination
      // This prevents concurrent transactions from getting the same number
      const sequences = await tx.$queryRaw<{ id: string; last_number: number }[]>`
        SELECT id, last_number FROM invoice_sequences
        WHERE prefix = ${prefix} AND year = ${year}
        FOR UPDATE
      `;

      let nextNumber: number;

      if (!sequences || sequences.length === 0) {
        // Create new sequence for this prefix + year
        await tx.invoiceSequence.create({
          data: { prefix, year, lastNumber: 1 },
        });
        nextNumber = 1;
      } else {
        // Increment existing sequence
        nextNumber = sequences[0].last_number + 1;
        await tx.invoiceSequence.update({
          where: {
            prefix_year: { prefix, year },
          },
          data: { lastNumber: nextNumber },
        });
      }

      return formatInvoiceNumber(prefix, year, nextNumber);
    });

    logger.debug('Generated invoice number', {
      invoiceNumber: result,
      type,
      prefix,
      year,
    });

    return result;
  } catch (error) {
    logger.error('Failed to generate invoice number', {
      type,
      prefix,
      year,
      error: (error as Error).message,
    });
    throw new Error(`Failed to generate invoice number: ${(error as Error).message}`);
  }
}

/**
 * Gets the current sequence state for a given prefix and year (for debugging/admin)
 *
 * @param type - RECEIVABLE or PAYABLE
 * @param year - Optional year (defaults to current year)
 * @returns Sequence info or null if not exists
 */
export async function getSequenceInfo(
  type: InvoiceType,
  year?: number
): Promise<{ prefix: string; year: number; lastNumber: number } | null> {
  const prefix = getPrefix(type);
  const targetYear = year || new Date().getFullYear();

  const sequence = await prisma.invoiceSequence.findUnique({
    where: {
      prefix_year: { prefix, year: targetYear },
    },
  });

  if (!sequence) {
    return null;
  }

  return {
    prefix: sequence.prefix,
    year: sequence.year,
    lastNumber: sequence.lastNumber,
  };
}

/**
 * Parses an invoice number to extract its components
 *
 * @param invoiceNumber - Invoice number string (e.g., AR-2024-00001)
 * @returns Parsed components or null if invalid format
 */
export function parseInvoiceNumber(
  invoiceNumber: string
): { prefix: InvoicePrefix; year: number; sequence: number } | null {
  const match = invoiceNumber.match(/^(AR|AP)-(\d{4})-(\d{5})$/);
  if (!match) {
    return null;
  }

  return {
    prefix: match[1] as InvoicePrefix,
    year: parseInt(match[2], 10),
    sequence: parseInt(match[3], 10),
  };
}

/**
 * Validates that an invoice number follows the expected format
 *
 * @param invoiceNumber - Invoice number to validate
 * @returns true if valid format, false otherwise
 */
export function isValidInvoiceNumber(invoiceNumber: string): boolean {
  return parseInvoiceNumber(invoiceNumber) !== null;
}
