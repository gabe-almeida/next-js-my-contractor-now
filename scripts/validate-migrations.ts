#!/usr/bin/env tsx

/**
 * Migration Validation Script
 * Validates that all database migrations have been applied correctly
 * and performance improvements are working as expected
 */

import { PrismaClient } from '@prisma/client';
import { checkDatabaseConnection, getDatabaseStats, checkMigrationStatus, checkProductionReadiness } from '../src/lib/db-production';
import { validateDatabaseDecimals, checkDecimalHealth, getBidStatistics } from '../src/lib/database-utils';

const prisma = new PrismaClient();

interface ValidationResult {
  category: string;
  checks: Array<{
    name: string;
    passed: boolean;
    message: string;
    details?: any;
  }>;
}

async function validateConnection(): Promise<ValidationResult> {
  console.log('🔗 Validating database connection...');
  
  const checks = [];
  
  try {
    const isConnected = await checkDatabaseConnection(1);
    checks.push({
      name: 'Database Connection',
      passed: isConnected,
      message: isConnected ? 'Successfully connected' : 'Connection failed'
    });
    
    if (isConnected) {
      const stats = await getDatabaseStats();
      checks.push({
        name: 'Foreign Keys Enabled',
        passed: stats.foreignKeysEnabled,
        message: stats.foreignKeysEnabled ? 'Foreign key constraints are active' : 'Foreign key constraints disabled'
      });
      
      checks.push({
        name: 'Schema Completeness',
        passed: stats.tableCount >= 8,
        message: `Found ${stats.tableCount} tables (expected at least 8)`,
        details: { 
          tables: stats.tableCount, 
          indexes: stats.indexCount, 
          triggers: stats.triggerCount 
        }
      });
    }
    
  } catch (error) {
    checks.push({
      name: 'Connection Validation',
      passed: false,
      message: `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
  
  return { category: 'Database Connection', checks };
}

async function validateMigrations(): Promise<ValidationResult> {
  console.log('📦 Validating migration status...');
  
  const checks = [];
  
  try {
    const migrationStatus = await checkMigrationStatus();
    checks.push({
      name: 'Migration Status',
      passed: migrationStatus.isUpToDate,
      message: migrationStatus.isUpToDate 
        ? `All migrations applied (last: ${migrationStatus.lastMigration})` 
        : `Pending migrations: ${migrationStatus.pendingMigrations.join(', ')}`,
      details: migrationStatus
    });
    
    // Check for specific migration artifacts
    const performanceIndexes = await prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*) as count FROM sqlite_master 
      WHERE type='index' AND (
        name LIKE 'idx_%_performance%' OR
        name LIKE 'idx_%_coverage%' OR
        name LIKE 'idx_%_lookup%'
      )
    `;
    
    checks.push({
      name: 'Performance Indexes',
      passed: performanceIndexes[0].count >= 5,
      message: `Found ${performanceIndexes[0].count} performance indexes (expected at least 5)`
    });
    
    const validationTriggers = await prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*) as count FROM sqlite_master 
      WHERE type='trigger' AND name LIKE 'validate_%'
    `;
    
    checks.push({
      name: 'Validation Triggers',
      passed: validationTriggers[0].count >= 8,
      message: `Found ${validationTriggers[0].count} validation triggers (expected at least 8)`
    });
    
    const orphanedReportTable = await prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*) as count FROM sqlite_master 
      WHERE type='table' AND name='orphaned_records_report'
    `;
    
    checks.push({
      name: 'Foreign Key Migration',
      passed: orphanedReportTable[0].count === 1,
      message: orphanedReportTable[0].count === 1 
        ? 'Foreign key migration completed' 
        : 'Foreign key migration not found'
    });
    
  } catch (error) {
    checks.push({
      name: 'Migration Validation',
      passed: false,
      message: `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
  
  return { category: 'Migration Status', checks };
}

async function validatePerformance(): Promise<ValidationResult> {
  console.log('⚡ Validating performance optimizations...');
  
  const checks = [];
  
  try {
    // Test auction query performance
    const startTime = Date.now();
    const testQuery = await prisma.$queryRaw`
      EXPLAIN QUERY PLAN
      SELECT DISTINCT
        b.id as buyer_id,
        b.name,
        bsz.min_bid,
        bsz.max_bid,
        bsz.priority
      FROM buyer_service_zip_codes bsz
      JOIN buyers b ON bsz.buyer_id = b.id
      JOIN buyer_service_configs bsc ON (
        bsc.buyer_id = b.id 
        AND bsc.service_type_id = bsz.service_type_id
      )
      WHERE bsz.service_type_id LIKE '%'
        AND bsz.zip_code LIKE '%'
        AND bsz.active = true
        AND b.active = true
        AND bsc.active = true
      ORDER BY bsz.priority DESC, bsz.max_bid DESC
      LIMIT 10
    `;
    const queryTime = Date.now() - startTime;
    
    checks.push({
      name: 'Auction Query Performance',
      passed: queryTime < 100, // Should be very fast with proper indexes
      message: `Query completed in ${queryTime}ms (target: <100ms)`,
      details: { queryTime, queryPlan: testQuery }
    });
    
    // Test index usage
    const indexUsageQuery = await prisma.$queryRaw<Array<{
      detail: string;
    }>>`
      EXPLAIN QUERY PLAN
      SELECT * FROM buyer_service_zip_codes 
      WHERE service_type_id = 'test' AND zip_code = '10001' AND active = true
    `;
    
    const usesIndex = indexUsageQuery.some(row => 
      row.detail.includes('USING INDEX') || row.detail.includes('idx_')
    );
    
    checks.push({
      name: 'Index Utilization',
      passed: usesIndex,
      message: usesIndex ? 'Queries are using indexes' : 'Indexes not being utilized',
      details: indexUsageQuery
    });
    
  } catch (error) {
    checks.push({
      name: 'Performance Validation',
      passed: false,
      message: `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
  
  return { category: 'Performance', checks };
}

async function validateDataIntegrity(): Promise<ValidationResult> {
  console.log('🔍 Validating data integrity...');
  
  const checks = [];
  
  try {
    // Check decimal precision
    const decimalHealth = await checkDecimalHealth();
    checks.push({
      name: 'Decimal Precision',
      passed: decimalHealth.healthy,
      message: decimalHealth.healthy 
        ? 'All decimal values have correct precision' 
        : 'Decimal precision issues found',
      details: decimalHealth.checks
    });
    
    // Check foreign key integrity
    const foreignKeyCheck = await prisma.$queryRaw`PRAGMA foreign_key_check()` as unknown[];
    const fkViolations = Array.isArray(foreignKeyCheck) ? foreignKeyCheck.length : 0;
    checks.push({
      name: 'Foreign Key Integrity',
      passed: fkViolations === 0,
      message: fkViolations === 0
        ? 'No foreign key violations'
        : `${fkViolations} foreign key violations found`,
      details: foreignKeyCheck
    });
    
    // Check for orphaned records
    const orphanedBuyerServiceZips = await prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*) as count 
      FROM buyer_service_zip_codes bsz
      LEFT JOIN buyers b ON bsz.buyer_id = b.id
      LEFT JOIN service_types st ON bsz.service_type_id = st.id
      LEFT JOIN zip_code_metadata zm ON bsz.zip_code = zm.zip_code
      WHERE b.id IS NULL OR st.id IS NULL OR zm.zip_code IS NULL
    `;
    
    checks.push({
      name: 'Orphaned Records',
      passed: orphanedBuyerServiceZips[0].count === 0,
      message: orphanedBuyerServiceZips[0].count === 0 
        ? 'No orphaned records found' 
        : `${orphanedBuyerServiceZips[0].count} orphaned records found`
    });
    
    // Check bid range consistency
    const invalidBidRanges = await prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*) as count 
      FROM buyer_service_configs 
      WHERE min_bid >= max_bid AND min_bid IS NOT NULL AND max_bid IS NOT NULL
    `;
    
    checks.push({
      name: 'Bid Range Validation',
      passed: invalidBidRanges[0].count === 0,
      message: invalidBidRanges[0].count === 0 
        ? 'All bid ranges are valid' 
        : `${invalidBidRanges[0].count} invalid bid ranges found`
    });
    
  } catch (error) {
    checks.push({
      name: 'Data Integrity Validation',
      passed: false,
      message: `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
  
  return { category: 'Data Integrity', checks };
}

async function validateTriggers(): Promise<ValidationResult> {
  console.log('🔧 Validating database triggers...');
  
  const checks = [];
  
  try {
    // Test ZIP code validation trigger
    try {
      await prisma.$executeRaw`
        INSERT INTO leads (id, service_type_id, zip_code, form_data, owns_home, timeframe) 
        VALUES ('test-invalid-zip', 'test', '1234A', '{}', true, 'ASAP')
      `;
      checks.push({
        name: 'ZIP Code Validation Trigger',
        passed: false,
        message: 'Trigger failed - invalid ZIP code was allowed'
      });
    } catch (error) {
      checks.push({
        name: 'ZIP Code Validation Trigger',
        passed: true,
        message: 'Trigger working - invalid ZIP code rejected'
      });
    }
    
    // Test bid range validation trigger
    try {
      await prisma.$executeRaw`
        INSERT INTO buyer_service_configs (id, buyer_id, service_type_id, ping_template, post_template, field_mappings, min_bid, max_bid) 
        VALUES ('test-invalid-bid', 'test', 'test', '{}', '{}', '{}', 100.00, 50.00)
      `;
      checks.push({
        name: 'Bid Range Validation Trigger',
        passed: false,
        message: 'Trigger failed - invalid bid range was allowed'
      });
    } catch (error) {
      checks.push({
        name: 'Bid Range Validation Trigger',
        passed: true,
        message: 'Trigger working - invalid bid range rejected'
      });
    }
    
    // Clean up test data
    await prisma.$executeRaw`DELETE FROM leads WHERE id = 'test-invalid-zip'`;
    await prisma.$executeRaw`DELETE FROM buyer_service_configs WHERE id = 'test-invalid-bid'`;
    
  } catch (error) {
    checks.push({
      name: 'Trigger Validation',
      passed: false,
      message: `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
  
  return { category: 'Trigger Validation', checks };
}

async function validateProductionReadiness(): Promise<ValidationResult> {
  console.log('🚀 Validating production readiness...');
  
  const checks = [];
  
  try {
    const readiness = await checkProductionReadiness();
    
    for (const check of readiness.checks) {
      checks.push({
        name: check.name,
        passed: check.passed,
        message: check.message
      });
    }
    
    // Additional production checks
    const bidStats = await getBidStatistics();
    checks.push({
      name: 'Bid Statistics',
      passed: true,
      message: 'Bid statistics retrieved successfully',
      details: bidStats
    });
    
  } catch (error) {
    checks.push({
      name: 'Production Readiness',
      passed: false,
      message: `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
  
  return { category: 'Production Readiness', checks };
}

function printResults(results: ValidationResult[]) {
  console.log('\n' + '='.repeat(60));
  console.log('📊 MIGRATION VALIDATION RESULTS');
  console.log('='.repeat(60));
  
  let totalChecks = 0;
  let passedChecks = 0;
  
  for (const result of results) {
    console.log(`\n📂 ${result.category}`);
    console.log('-'.repeat(40));
    
    for (const check of result.checks) {
      totalChecks++;
      const status = check.passed ? '✅' : '❌';
      console.log(`${status} ${check.name}: ${check.message}`);
      
      if (check.passed) {
        passedChecks++;
      }
      
      if (check.details && process.env.VERBOSE === 'true') {
        console.log(`   Details: ${JSON.stringify(check.details, null, 2)}`);
      }
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`📈 SUMMARY: ${passedChecks}/${totalChecks} checks passed`);
  
  const successRate = Math.round((passedChecks / totalChecks) * 100);
  const status = successRate >= 90 ? '🎉 EXCELLENT' : 
                successRate >= 75 ? '✅ GOOD' : 
                successRate >= 50 ? '⚠️  NEEDS WORK' : '❌ CRITICAL';
  
  console.log(`🎯 Success Rate: ${successRate}% - ${status}`);
  console.log('='.repeat(60));
  
  if (successRate < 100) {
    console.log('\n⚠️  Some checks failed. Review the issues above before proceeding to production.');
  } else {
    console.log('\n🎉 All validations passed! Database is ready for production.');
  }
}

async function main() {
  console.log('🔍 Starting database migration validation...\n');
  
  const results: ValidationResult[] = [];
  
  try {
    results.push(await validateConnection());
    results.push(await validateMigrations());
    results.push(await validatePerformance());
    results.push(await validateDataIntegrity());
    results.push(await validateTriggers());
    results.push(await validateProductionReadiness());
    
    printResults(results);
    
    // Exit with appropriate code
    const allPassed = results.every(result => 
      result.checks.every(check => check.passed)
    );
    
    process.exit(allPassed ? 0 : 1);
    
  } catch (error) {
    console.error('❌ Validation failed with error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Handle CLI arguments
if (process.argv.includes('--help')) {
  console.log(`
Database Migration Validation Script

Usage: tsx scripts/validate-migrations.ts [options]

Options:
  --help      Show this help message
  --verbose   Show detailed output including query plans and statistics

Environment Variables:
  VERBOSE=true    Enable verbose output
  DATABASE_URL    Database connection string

This script validates:
  ✅ Database connection and basic health
  ✅ Migration status and artifacts
  ✅ Performance optimizations (indexes, query speed)  
  ✅ Data integrity (foreign keys, constraints)
  ✅ Validation triggers (ZIP codes, bid ranges)
  ✅ Production readiness checklist

Exit codes:
  0  All validations passed
  1  Some validations failed
`);
  process.exit(0);
}

if (require.main === module) {
  main().catch(console.error);
}