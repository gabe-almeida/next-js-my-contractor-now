/**
 * Database utility functions for SQLite decimal handling and validation
 * Addresses SQLite's lack of native decimal type support
 */

import { prisma } from './db-production';
import { logger } from './logger';

// SQLite decimal precision constants
export const DECIMAL_PRECISION = {
  BID_AMOUNT: 2,    // 2 decimal places for bid amounts
  COORDINATES: 8,   // 8 decimal places for lat/lng
  QUALITY_SCORE: 0  // 0 decimal places for scores
} as const;

/**
 * Round number to specified decimal places for SQLite storage
 * SQLite stores numbers as REAL (floating point) but we need consistent precision
 */
export function roundToDecimalPlaces(value: number | null | undefined, places: number): number | null {
  if (value === null || value === undefined || isNaN(value)) {
    return null;
  }
  
  const multiplier = Math.pow(10, places);
  return Math.round(value * multiplier) / multiplier;
}

/**
 * Format bid amounts consistently for SQLite
 */
export function formatBidAmount(amount: number | null | undefined): number | null {
  return roundToDecimalPlaces(amount, DECIMAL_PRECISION.BID_AMOUNT);
}

/**
 * Format coordinates for SQLite storage
 */
export function formatCoordinate(coordinate: number | null | undefined): number | null {
  return roundToDecimalPlaces(coordinate, DECIMAL_PRECISION.COORDINATES);
}

/**
 * Validate and format bid range for database insertion
 */
export function validateBidRange(minBid: number | null, maxBid: number | null): {
  isValid: boolean;
  formattedMinBid: number | null;
  formattedMaxBid: number | null;
  error?: string;
} {
  const formattedMinBid = formatBidAmount(minBid);
  const formattedMaxBid = formatBidAmount(maxBid);
  
  // Both null is valid (inherits from parent config)
  if (formattedMinBid === null && formattedMaxBid === null) {
    return { isValid: true, formattedMinBid, formattedMaxBid };
  }
  
  // One null, one set is invalid
  if (formattedMinBid === null || formattedMaxBid === null) {
    return {
      isValid: false,
      formattedMinBid,
      formattedMaxBid,
      error: 'Both min_bid and max_bid must be set or both must be null'
    };
  }
  
  // Both set - validate range
  if (formattedMinBid >= formattedMaxBid) {
    return {
      isValid: false,
      formattedMinBid,
      formattedMaxBid,
      error: 'min_bid must be less than max_bid'
    };
  }
  
  // Validate reasonable ranges
  if (formattedMinBid < 0 || formattedMaxBid > 99999.99) {
    return {
      isValid: false,
      formattedMinBid,
      formattedMaxBid,
      error: 'Bid amounts must be between 0 and 99999.99'
    };
  }
  
  return { isValid: true, formattedMinBid, formattedMaxBid };
}

/**
 * Database transaction wrapper with decimal formatting
 */
export async function createBuyerServiceConfig(data: {
  buyerId: string;
  serviceTypeId: string;
  pingTemplate: string;
  postTemplate: string;
  fieldMappings: string;
  minBid: number;
  maxBid: number;
  requiresTrustedForm?: boolean;
  requiresJornaya?: boolean;
  complianceConfig?: string;
}) {
  const bidValidation = validateBidRange(data.minBid, data.maxBid);
  
  if (!bidValidation.isValid) {
    throw new Error(`Invalid bid range: ${bidValidation.error}`);
  }
  
  return prisma.buyerServiceConfig.create({
    data: {
      buyerId: data.buyerId,
      serviceTypeId: data.serviceTypeId,
      pingTemplate: data.pingTemplate,
      postTemplate: data.postTemplate,
      fieldMappings: data.fieldMappings,
      minBid: bidValidation.formattedMinBid!,
      maxBid: bidValidation.formattedMaxBid!,
      requiresTrustedForm: data.requiresTrustedForm ?? false,
      requiresJornaya: data.requiresJornaya ?? false,
      complianceConfig: data.complianceConfig
    }
  });
}

/**
 * Create buyer service zip code with proper decimal handling
 */
export async function createBuyerServiceZipCode(data: {
  buyerId: string;
  serviceTypeId: string;
  zipCode: string;
  minBid?: number | null;
  maxBid?: number | null;
  priority?: number;
  maxLeadsPerDay?: number | null;
  active?: boolean;
}) {
  // Format bid amounts
  const bidValidation = validateBidRange(data.minBid ?? null, data.maxBid ?? null);
  
  if (!bidValidation.isValid) {
    throw new Error(`Invalid bid range for ZIP ${data.zipCode}: ${bidValidation.error}`);
  }
  
  // Validate ZIP code format
  if (!/^\d{5}$/.test(data.zipCode)) {
    throw new Error(`Invalid ZIP code format: ${data.zipCode}`);
  }
  
  return prisma.buyerServiceZipCode.create({
    data: {
      buyerId: data.buyerId,
      serviceTypeId: data.serviceTypeId,
      zipCode: data.zipCode,
      minBid: bidValidation.formattedMinBid,
      maxBid: bidValidation.formattedMaxBid,
      priority: data.priority ?? 100,
      maxLeadsPerDay: data.maxLeadsPerDay,
      active: data.active ?? true
    }
  });
}

/**
 * Update lead with formatted winning bid
 */
export async function updateLeadWinner(leadId: string, buyerId: string, bidAmount: number) {
  const formattedBid = formatBidAmount(bidAmount);
  
  if (formattedBid === null) {
    throw new Error('Invalid bid amount');
  }
  
  return prisma.lead.update({
    where: { id: leadId },
    data: {
      winningBuyerId: buyerId,
      winningBid: formattedBid,
      status: 'WON'
    }
  });
}

/**
 * Create transaction with formatted bid amount
 */
export async function createTransaction(data: {
  leadId: string;
  buyerId: string;
  actionType: 'PING' | 'POST';
  payload: string;
  response?: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'TIMEOUT';
  bidAmount?: number | null;
  responseTime?: number | null;
  errorMessage?: string;
  complianceIncluded?: boolean;
  trustedFormPresent?: boolean;
  jornayaPresent?: boolean;
}) {
  return prisma.transaction.create({
    data: {
      leadId: data.leadId,
      buyerId: data.buyerId,
      actionType: data.actionType,
      payload: data.payload,
      response: data.response,
      status: data.status,
      bidAmount: formatBidAmount(data.bidAmount),
      responseTime: data.responseTime,
      errorMessage: data.errorMessage,
      complianceIncluded: data.complianceIncluded ?? false,
      trustedFormPresent: data.trustedFormPresent ?? false,
      jornayaPresent: data.jornayaPresent ?? false
    }
  });
}

/**
 * Bulk update bid amounts with proper formatting
 */
export async function bulkUpdateBidAmounts(updates: Array<{
  id: string;
  minBid?: number | null;
  maxBid?: number | null;
}>) {
  const validUpdates = [];
  const errors = [];
  
  for (const update of updates) {
    const bidValidation = validateBidRange(update.minBid ?? null, update.maxBid ?? null);
    
    if (bidValidation.isValid) {
      validUpdates.push({
        id: update.id,
        minBid: bidValidation.formattedMinBid,
        maxBid: bidValidation.formattedMaxBid
      });
    } else {
      errors.push(`ID ${update.id}: ${bidValidation.error}`);
    }
  }
  
  if (errors.length > 0) {
    throw new Error(`Validation errors: ${errors.join(', ')}`);
  }
  
  // Use transaction for bulk updates
  return prisma.$transaction(
    validUpdates.map(update =>
      prisma.buyerServiceConfig.update({
        where: { id: update.id },
        data: {
          minBid: update.minBid!,
          maxBid: update.maxBid!
        }
      })
    )
  );
}

/**
 * Get formatted bid statistics
 */
export async function getBidStatistics() {
  const stats = await prisma.$queryRaw<Array<{
    avg_min_bid: number | null;
    avg_max_bid: number | null;
    min_bid_floor: number | null;
    max_bid_ceiling: number | null;
    total_configs: number;
  }>>`
    SELECT 
      ROUND(AVG(min_bid), 2) as avg_min_bid,
      ROUND(AVG(max_bid), 2) as avg_max_bid,
      ROUND(MIN(min_bid), 2) as min_bid_floor,
      ROUND(MAX(max_bid), 2) as max_bid_ceiling,
      COUNT(*) as total_configs
    FROM buyer_service_configs
    WHERE active = true
  `;
  
  return stats[0];
}

/**
 * Validate all existing decimal values in database
 */
export async function validateDatabaseDecimals(): Promise<{
  isValid: boolean;
  issues: Array<{
    table: string;
    column: string;
    id: string;
    value: number;
    expectedPrecision: number;
    actualPrecision: number;
  }>;
}> {
  const issues = [];
  
  try {
    // Check buyer_service_configs bid amounts
    const configBids = await prisma.$queryRaw<Array<{
      id: string;
      min_bid: number;
      max_bid: number;
    }>>`
      SELECT id, min_bid, max_bid 
      FROM buyer_service_configs 
      WHERE min_bid IS NOT NULL AND max_bid IS NOT NULL
    `;
    
    for (const config of configBids) {
      const minBidPrecision = (config.min_bid.toString().split('.')[1] || '').length;
      const maxBidPrecision = (config.max_bid.toString().split('.')[1] || '').length;
      
      if (minBidPrecision > DECIMAL_PRECISION.BID_AMOUNT) {
        issues.push({
          table: 'buyer_service_configs',
          column: 'min_bid',
          id: config.id,
          value: config.min_bid,
          expectedPrecision: DECIMAL_PRECISION.BID_AMOUNT,
          actualPrecision: minBidPrecision
        });
      }
      
      if (maxBidPrecision > DECIMAL_PRECISION.BID_AMOUNT) {
        issues.push({
          table: 'buyer_service_configs',
          column: 'max_bid',
          id: config.id,
          value: config.max_bid,
          expectedPrecision: DECIMAL_PRECISION.BID_AMOUNT,
          actualPrecision: maxBidPrecision
        });
      }
    }
    
    // Check leads winning_bid
    const leadBids = await prisma.$queryRaw<Array<{
      id: string;
      winning_bid: number;
    }>>`
      SELECT id, winning_bid 
      FROM leads 
      WHERE winning_bid IS NOT NULL
    `;
    
    for (const lead of leadBids) {
      const bidPrecision = (lead.winning_bid.toString().split('.')[1] || '').length;
      
      if (bidPrecision > DECIMAL_PRECISION.BID_AMOUNT) {
        issues.push({
          table: 'leads',
          column: 'winning_bid',
          id: lead.id,
          value: lead.winning_bid,
          expectedPrecision: DECIMAL_PRECISION.BID_AMOUNT,
          actualPrecision: bidPrecision
        });
      }
    }
    
    return {
      isValid: issues.length === 0,
      issues
    };
    
  } catch (error) {
    logger.error('Failed to validate database decimals', { error });
    throw error;
  }
}

/**
 * Fix decimal precision issues in database
 */
export async function fixDatabaseDecimals(): Promise<{
  fixed: number;
  errors: string[];
}> {
  const validation = await validateDatabaseDecimals();
  
  if (validation.isValid) {
    return { fixed: 0, errors: [] };
  }
  
  const errors: string[] = [];
  let fixed = 0;
  
  // Group issues by table
  const issuesByTable = validation.issues.reduce((acc, issue) => {
    if (!acc[issue.table]) acc[issue.table] = [];
    acc[issue.table].push(issue);
    return acc;
  }, {} as Record<string, typeof validation.issues>);
  
  try {
    await prisma.$transaction(async (tx) => {
      // Fix buyer_service_configs
      if (issuesByTable.buyer_service_configs) {
        for (const issue of issuesByTable.buyer_service_configs) {
          const formattedValue = formatBidAmount(issue.value);
          
          if (formattedValue !== null) {
            if (issue.column === 'min_bid') {
              await tx.buyerServiceConfig.update({
                where: { id: issue.id },
                data: { minBid: formattedValue }
              });
            } else if (issue.column === 'max_bid') {
              await tx.buyerServiceConfig.update({
                where: { id: issue.id },
                data: { maxBid: formattedValue }
              });
            }
            fixed++;
          } else {
            errors.push(`Failed to format ${issue.table}.${issue.column} for ID ${issue.id}`);
          }
        }
      }
      
      // Fix leads
      if (issuesByTable.leads) {
        for (const issue of issuesByTable.leads) {
          const formattedValue = formatBidAmount(issue.value);
          
          if (formattedValue !== null) {
            await tx.lead.update({
              where: { id: issue.id },
              data: { winningBid: formattedValue }
            });
            fixed++;
          } else {
            errors.push(`Failed to format ${issue.table}.${issue.column} for ID ${issue.id}`);
          }
        }
      }
    });
    
    logger.info(`Fixed ${fixed} decimal precision issues`);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    errors.push(`Transaction failed: ${errorMessage}`);
    logger.error('Failed to fix database decimals', { error: errorMessage });
  }
  
  return { fixed, errors };
}

/**
 * Database health check specifically for decimal handling
 */
export async function checkDecimalHealth(): Promise<{
  healthy: boolean;
  checks: Array<{
    name: string;
    passed: boolean;
    message: string;
    count?: number;
  }>;
}> {
  const checks = [];
  
  try {
    // Check decimal precision
    const validation = await validateDatabaseDecimals();
    checks.push({
      name: 'Decimal Precision',
      passed: validation.isValid,
      message: validation.isValid 
        ? 'All decimal values have correct precision' 
        : `${validation.issues.length} precision issues found`,
      count: validation.issues.length
    });
    
    // Check bid range consistency
    const invalidRanges = await prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*) as count 
      FROM buyer_service_configs 
      WHERE min_bid >= max_bid AND min_bid IS NOT NULL AND max_bid IS NOT NULL
    `;
    
    checks.push({
      name: 'Bid Range Consistency',
      passed: invalidRanges[0].count === 0,
      message: invalidRanges[0].count === 0 
        ? 'All bid ranges are valid' 
        : `${invalidRanges[0].count} invalid bid ranges found`,
      count: invalidRanges[0].count
    });
    
    // Check for null bid inconsistencies
    const nullBidIssues = await prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*) as count 
      FROM buyer_service_configs 
      WHERE (min_bid IS NULL) != (max_bid IS NULL)
    `;
    
    checks.push({
      name: 'Null Bid Consistency',
      passed: nullBidIssues[0].count === 0,
      message: nullBidIssues[0].count === 0 
        ? 'No null bid inconsistencies' 
        : `${nullBidIssues[0].count} null bid inconsistencies found`,
      count: nullBidIssues[0].count
    });
    
    const allPassed = checks.every(check => check.passed);
    
    return {
      healthy: allPassed,
      checks
    };
    
  } catch (error) {
    logger.error('Decimal health check failed', { error });
    checks.push({
      name: 'Health Check',
      passed: false,
      message: `Check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
    
    return {
      healthy: false,
      checks
    };
  }
}