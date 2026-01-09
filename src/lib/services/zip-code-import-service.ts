/**
 * ZIP Code Import Service
 *
 * WHY: Buyers like Modernize send monthly ZIP code updates that need to REPLACE
 *      existing ZIP codes (not append). Multiple sheets may map to one service type.
 * WHEN: Called from admin UI or CLI script when uploading ZIP code files
 * HOW: Parse Excel/CSV → Map sheets to service types → Dedupe → Atomic replace
 *
 * Key features:
 * - Supports Excel (.xlsx) and CSV files
 * - Configurable sheet-to-service mapping (e.g., "Bath Refacing" + "Bath Remodel" → bathrooms)
 * - Atomic replacement (delete old, insert new in transaction)
 * - Tracks last update timestamp and source file
 */

import { prisma } from '../db';
import { logger } from '../logger';

/**
 * Represents a single ZIP code entry from the source file
 */
export interface ZipCodeEntry {
  zipCode: string;
  city?: string;
  state?: string;
  tier?: number;
  trade?: string;
}

/**
 * Configuration for mapping source sheets to service types
 * Allows combining multiple sheets (e.g., Bath Refacing + Bath Remodel → bathrooms)
 */
export interface SheetMapping {
  /** Our internal service type name (e.g., 'bathrooms', 'windows') */
  serviceTypeName: string;
  /** Sheet names from source file that map to this service type */
  sourceSheets: string[];
  /** Optional: default priority for imported zips (can be overridden by Tier column) */
  defaultPriority?: number;
  /** Optional: default min/max bids for imported zips */
  defaultMinBid?: number;
  defaultMaxBid?: number;
}

/**
 * Result of a ZIP code import operation
 */
export interface ImportResult {
  success: boolean;
  serviceType: string;
  totalZipCodes: number;
  duplicatesRemoved: number;
  previousZipCount: number;
  newZipCount: number;
  error?: string;
}

/**
 * Parsed data from a source file
 */
export interface ParsedFileData {
  fileName: string;
  sheets: {
    name: string;
    zipCodes: ZipCodeEntry[];
  }[];
}

/**
 * Modernize-specific sheet mapping configuration
 * Combines Bath Refacing + Bath Remodel → bathrooms
 */
export const MODERNIZE_SHEET_MAPPINGS: SheetMapping[] = [
  {
    serviceTypeName: 'bathrooms',
    sourceSheets: ['Bath Refacing', 'Bath Remodel'],
    defaultPriority: 100,
    defaultMinBid: 12,
    defaultMaxBid: 90,
  },
  {
    serviceTypeName: 'windows',
    sourceSheets: ['Windows'],
    defaultPriority: 100,
    defaultMinBid: 12,
    defaultMaxBid: 90,
  },
  {
    serviceTypeName: 'roofing',
    sourceSheets: ['Roofing'],
    defaultPriority: 100,
    defaultMinBid: 12,
    defaultMaxBid: 90,
  },
  {
    serviceTypeName: 'hvac',
    sourceSheets: ['HVAC'],
    defaultPriority: 100,
    defaultMinBid: 12,
    defaultMaxBid: 90,
  },
];

export class ZipCodeImportService {
  /**
   * Parse an Excel file buffer into structured data
   *
   * WHY: Need to extract ZIP codes from Excel files with multiple sheets
   * WHEN: Called when user uploads a file
   * HOW: Uses xlsx library to parse workbook and extract ZIP data from each sheet
   */
  static async parseExcelFile(
    buffer: Buffer,
    fileName: string
  ): Promise<ParsedFileData> {
    // Dynamic import to avoid bundling xlsx in client code
    const XLSX = await import('xlsx');

    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheets: ParsedFileData['sheets'] = [];

    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet);

      const zipCodes: ZipCodeEntry[] = jsonData.map((row) => ({
        // Handle different column naming conventions
        zipCode: String(row['Zip'] || row['zip'] || row['ZIP'] || row['zip_code'] || row['zipCode'] || '').trim(),
        city: row['City'] || row['city'],
        state: row['State'] || row['state'],
        tier: row['Tier'] || row['tier'] || row['Priority'] || row['priority'],
        trade: row['Trade'] || row['trade'],
      })).filter((entry) => entry.zipCode && entry.zipCode.length >= 5);

      sheets.push({
        name: sheetName,
        zipCodes,
      });

      logger.info('Parsed Excel sheet', {
        sheetName,
        zipCount: zipCodes.length,
      });
    }

    return { fileName, sheets };
  }

  /**
   * Parse a CSV file buffer into structured data
   */
  static async parseCsvFile(
    buffer: Buffer,
    fileName: string
  ): Promise<ParsedFileData> {
    const content = buffer.toString('utf-8');
    const lines = content.split('\n').map((line) => line.trim()).filter(Boolean);

    if (lines.length === 0) {
      return { fileName, sheets: [{ name: 'default', zipCodes: [] }] };
    }

    // Parse header
    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const zipIndex = headers.findIndex((h) =>
      ['zip', 'zip_code', 'zipcode'].includes(h)
    );
    const cityIndex = headers.findIndex((h) => h === 'city');
    const stateIndex = headers.findIndex((h) => h === 'state');
    const tierIndex = headers.findIndex((h) =>
      ['tier', 'priority'].includes(h)
    );

    if (zipIndex === -1) {
      throw new Error('CSV must have a ZIP/zip_code column');
    }

    const zipCodes: ZipCodeEntry[] = lines.slice(1).map((line) => {
      const values = line.split(',').map((v) => v.trim());
      return {
        zipCode: values[zipIndex] || '',
        city: cityIndex >= 0 ? values[cityIndex] : undefined,
        state: stateIndex >= 0 ? values[stateIndex] : undefined,
        tier: tierIndex >= 0 ? parseInt(values[tierIndex]) || undefined : undefined,
      };
    }).filter((entry) => entry.zipCode && entry.zipCode.length >= 5);

    return {
      fileName,
      sheets: [{ name: 'default', zipCodes }],
    };
  }

  /**
   * Combine ZIP codes from multiple sheets and deduplicate
   *
   * WHY: Buyers may have same ZIP in multiple sheets (e.g., Bath Refacing & Bath Remodel)
   * WHEN: Called after parsing, before importing
   * HOW: Merge all ZIP lists, keep highest priority/tier for duplicates
   */
  static combineAndDedupe(
    zipLists: ZipCodeEntry[][],
    defaultPriority: number = 100
  ): ZipCodeEntry[] {
    const zipMap = new Map<string, ZipCodeEntry>();

    for (const list of zipLists) {
      for (const entry of list) {
        const existing = zipMap.get(entry.zipCode);

        if (!existing) {
          // New ZIP - add it
          zipMap.set(entry.zipCode, {
            ...entry,
            tier: entry.tier || defaultPriority,
          });
        } else {
          // Duplicate - keep the one with higher tier/priority
          const existingTier = existing.tier || defaultPriority;
          const newTier = entry.tier || defaultPriority;

          if (newTier > existingTier) {
            zipMap.set(entry.zipCode, {
              ...entry,
              tier: newTier,
            });
          }
        }
      }
    }

    return Array.from(zipMap.values());
  }

  /**
   * Import ZIP codes for a buyer/service type combination
   *
   * WHY: Monthly updates REPLACE existing ZIP codes (not append)
   * WHEN: Called after parsing and combining ZIP codes
   * HOW: Transaction: delete all existing → insert new → update timestamp
   *
   * @param buyerId - Buyer ID to import for
   * @param serviceTypeName - Service type name (e.g., 'bathrooms', 'windows')
   * @param zipCodes - Deduplicated ZIP code entries
   * @param sourceFileName - Original file name for audit trail
   * @param options - Optional defaults for min/max bid
   */
  static async replaceZipCodes(
    buyerId: string,
    serviceTypeName: string,
    zipCodes: ZipCodeEntry[],
    sourceFileName: string,
    options?: {
      defaultMinBid?: number;
      defaultMaxBid?: number;
      defaultPriority?: number;
    }
  ): Promise<ImportResult> {
    const startTime = Date.now();

    try {
      // Find the service type
      const serviceType = await prisma.serviceType.findFirst({
        where: {
          OR: [
            { name: serviceTypeName },
            { id: serviceTypeName },
          ],
          active: true,
        },
      });

      if (!serviceType) {
        return {
          success: false,
          serviceType: serviceTypeName,
          totalZipCodes: 0,
          duplicatesRemoved: 0,
          previousZipCount: 0,
          newZipCount: 0,
          error: `Service type not found: ${serviceTypeName}`,
        };
      }

      // Count existing ZIP codes before deletion
      const previousZipCount = await prisma.buyerServiceZipCode.count({
        where: {
          buyerId,
          serviceTypeId: serviceType.id,
        },
      });

      // Perform atomic replacement in a transaction
      const result = await prisma.$transaction(async (tx) => {
        // Delete all existing ZIP codes for this buyer/service type
        const deleteResult = await tx.buyerServiceZipCode.deleteMany({
          where: {
            buyerId,
            serviceTypeId: serviceType.id,
          },
        });

        logger.info('Deleted existing ZIP codes', {
          buyerId,
          serviceTypeId: serviceType.id,
          deletedCount: deleteResult.count,
        });

        // Insert new ZIP codes
        const insertResult = await tx.buyerServiceZipCode.createMany({
          data: zipCodes.map((zc) => ({
            buyerId,
            serviceTypeId: serviceType.id,
            zipCode: zc.zipCode,
            active: true,
            priority: zc.tier || options?.defaultPriority || 100,
            minBid: options?.defaultMinBid,
            maxBid: options?.defaultMaxBid,
          })),
          skipDuplicates: true, // Safety: skip if any slipped through dedup
        });

        logger.info('Inserted new ZIP codes', {
          buyerId,
          serviceTypeId: serviceType.id,
          insertedCount: insertResult.count,
        });

        // Update the BuyerServiceConfig with last update timestamp
        await tx.buyerServiceConfig.upsert({
          where: {
            buyerId_serviceTypeId: {
              buyerId,
              serviceTypeId: serviceType.id,
            },
          },
          update: {
            lastZipCodeUpdate: new Date(),
            zipCodeSource: sourceFileName,
          },
          create: {
            buyerId,
            serviceTypeId: serviceType.id,
            pingTemplate: '{}',
            postTemplate: '{}',
            fieldMappings: '{}',
            lastZipCodeUpdate: new Date(),
            zipCodeSource: sourceFileName,
          },
        });

        return { deletedCount: deleteResult.count, insertedCount: insertResult.count };
      });

      const duration = Date.now() - startTime;

      logger.info('ZIP code import completed', {
        buyerId,
        serviceType: serviceTypeName,
        previousCount: previousZipCount,
        newCount: result.insertedCount,
        durationMs: duration,
      });

      return {
        success: true,
        serviceType: serviceTypeName,
        totalZipCodes: zipCodes.length,
        duplicatesRemoved: 0, // Already deduped before this method
        previousZipCount,
        newZipCount: result.insertedCount,
      };
    } catch (error) {
      logger.error('ZIP code import failed', {
        buyerId,
        serviceType: serviceTypeName,
        error: (error as Error).message,
      });

      return {
        success: false,
        serviceType: serviceTypeName,
        totalZipCodes: zipCodes.length,
        duplicatesRemoved: 0,
        previousZipCount: 0,
        newZipCount: 0,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Full import workflow: parse file → map sheets → combine → replace
   *
   * WHY: Single entry point for the complete import process
   * WHEN: Called from admin UI or CLI
   * HOW: Orchestrates parsing, mapping, deduplication, and replacement
   *
   * @param buffer - File buffer (Excel or CSV)
   * @param fileName - Original filename
   * @param buyerId - Buyer to import for
   * @param sheetMappings - Configuration for mapping sheets to service types
   */
  static async importFromFile(
    buffer: Buffer,
    fileName: string,
    buyerId: string,
    sheetMappings: SheetMapping[]
  ): Promise<ImportResult[]> {
    const results: ImportResult[] = [];

    // Parse the file based on extension
    const isExcel = fileName.toLowerCase().endsWith('.xlsx') ||
                    fileName.toLowerCase().endsWith('.xls');
    const isCsv = fileName.toLowerCase().endsWith('.csv');

    let parsedData: ParsedFileData;

    if (isExcel) {
      parsedData = await this.parseExcelFile(buffer, fileName);
    } else if (isCsv) {
      parsedData = await this.parseCsvFile(buffer, fileName);
    } else {
      throw new Error('Unsupported file format. Please upload .xlsx, .xls, or .csv');
    }

    logger.info('File parsed successfully', {
      fileName,
      sheetCount: parsedData.sheets.length,
      sheetNames: parsedData.sheets.map((s) => s.name),
    });

    // Process each sheet mapping
    for (const mapping of sheetMappings) {
      // Find matching sheets from the parsed data
      const matchingSheets = parsedData.sheets.filter((sheet) =>
        mapping.sourceSheets.some((sourceName) =>
          sheet.name.toLowerCase().includes(sourceName.toLowerCase()) ||
          sourceName.toLowerCase().includes(sheet.name.toLowerCase())
        )
      );

      if (matchingSheets.length === 0) {
        logger.warn('No matching sheets found for mapping', {
          serviceType: mapping.serviceTypeName,
          expectedSheets: mapping.sourceSheets,
          availableSheets: parsedData.sheets.map((s) => s.name),
        });
        continue;
      }

      // Combine ZIP codes from all matching sheets
      const zipLists = matchingSheets.map((sheet) => sheet.zipCodes);
      const originalTotal = zipLists.reduce((sum, list) => sum + list.length, 0);
      const combinedZips = this.combineAndDedupe(zipLists, mapping.defaultPriority);
      const duplicatesRemoved = originalTotal - combinedZips.length;

      logger.info('Combined sheets for service type', {
        serviceType: mapping.serviceTypeName,
        sheets: matchingSheets.map((s) => s.name),
        originalTotal,
        afterDedupe: combinedZips.length,
        duplicatesRemoved,
      });

      // Replace ZIP codes for this service type
      const result = await this.replaceZipCodes(
        buyerId,
        mapping.serviceTypeName,
        combinedZips,
        fileName,
        {
          defaultMinBid: mapping.defaultMinBid,
          defaultMaxBid: mapping.defaultMaxBid,
          defaultPriority: mapping.defaultPriority,
        }
      );

      result.duplicatesRemoved = duplicatesRemoved;
      results.push(result);
    }

    return results;
  }

  /**
   * Get last update info for a buyer's service types
   */
  static async getLastUpdateInfo(buyerId: string): Promise<{
    serviceType: string;
    lastUpdate: Date | null;
    source: string | null;
    zipCount: number;
  }[]> {
    const configs = await prisma.buyerServiceConfig.findMany({
      where: { buyerId },
      include: {
        serviceType: true,
      },
    });

    const results = await Promise.all(
      configs.map(async (config) => {
        const zipCount = await prisma.buyerServiceZipCode.count({
          where: {
            buyerId,
            serviceTypeId: config.serviceTypeId,
          },
        });

        return {
          serviceType: config.serviceType.name,
          lastUpdate: config.lastZipCodeUpdate,
          source: config.zipCodeSource,
          zipCount,
        };
      })
    );

    return results;
  }
}

export default ZipCodeImportService;
