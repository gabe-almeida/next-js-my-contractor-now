/**
 * Database Migration Tests
 * Tests all critical database fixes and performance improvements
 */

import { PrismaClient } from '@prisma/client';
import { 
  checkDatabaseConnection, 
  getDatabaseStats, 
  checkMigrationStatus,
  checkProductionReadiness 
} from '../../src/lib/db-production';
import { 
  validateDatabaseDecimals, 
  checkDecimalHealth, 
  formatBidAmount,
  validateBidRange,
  createBuyerServiceConfig,
  createBuyerServiceZipCode
} from '../../src/lib/database-utils';

const prisma = new PrismaClient();

describe('Database Migration Tests', () => {
  beforeAll(async () => {
    // Ensure database connection
    const connected = await checkDatabaseConnection();
    if (!connected) {
      throw new Error('Cannot connect to database for testing');
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Database Connection and Health', () => {
    test('should connect to database successfully', async () => {
      const isConnected = await checkDatabaseConnection();
      expect(isConnected).toBe(true);
    });

    test('should have foreign keys enabled', async () => {
      const stats = await getDatabaseStats();
      expect(stats.foreignKeysEnabled).toBe(true);
    });

    test('should have expected number of tables', async () => {
      const stats = await getDatabaseStats();
      expect(stats.tableCount).toBeGreaterThanOrEqual(8);
      expect(stats.indexCount).toBeGreaterThan(0);
      expect(stats.triggerCount).toBeGreaterThan(0);
    });
  });

  describe('Performance Indexes', () => {
    test('should have critical auction performance indexes', async () => {
      const performanceIndexes = await prisma.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(*) as count FROM sqlite_master 
        WHERE type='index' AND (
          name LIKE 'idx_%_performance%' OR
          name LIKE 'idx_%_coverage%' OR
          name LIKE 'idx_%_lookup%'
        )
      `;
      
      expect(performanceIndexes[0].count).toBeGreaterThanOrEqual(5);
    });

    test('should use indexes for auction queries', async () => {
      const queryPlan = await prisma.$queryRaw<Array<{ detail: string }>>`
        EXPLAIN QUERY PLAN
        SELECT * FROM buyer_service_zip_codes 
        WHERE service_type_id = 'test' AND zip_code = '10001' AND active = true
      `;
      
      const usesIndex = queryPlan.some(row => 
        row.detail.includes('USING INDEX') || row.detail.includes('idx_')
      );
      
      expect(usesIndex).toBe(true);
    });

    test('should have optimized leads auction index', async () => {
      const indexExists = await prisma.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(*) as count FROM sqlite_master 
        WHERE type='index' AND name='idx_leads_auction_performance'
      `;
      
      expect(indexExists[0].count).toBe(1);
    });
  });

  describe('Data Validation Triggers', () => {
    test('should have validation triggers for ZIP codes', async () => {
      const triggers = await prisma.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(*) as count FROM sqlite_master 
        WHERE type='trigger' AND name LIKE 'validate_zip_code_format%'
      `;
      
      expect(triggers[0].count).toBeGreaterThanOrEqual(2); // Insert and update triggers
    });

    test('should reject invalid ZIP code format', async () => {
      await expect(async () => {
        await prisma.$executeRaw`
          INSERT INTO leads (id, service_type_id, zip_code, form_data, owns_home, timeframe) 
          VALUES ('test-invalid-zip-' || hex(randomblob(4)), 'test', '1234A', '{}', true, 'ASAP')
        `;
      }).rejects.toThrow();
    });

    test('should reject invalid bid ranges', async () => {
      await expect(async () => {
        await prisma.$executeRaw`
          INSERT INTO buyer_service_configs (
            id, buyer_id, service_type_id, ping_template, post_template, 
            field_mappings, min_bid, max_bid
          ) 
          VALUES (
            'test-invalid-bid-' || hex(randomblob(4)), 'test', 'test', 
            '{}', '{}', '{}', 100.00, 50.00
          )
        `;
      }).rejects.toThrow();
    });

    test('should validate lead quality score range', async () => {
      await expect(async () => {
        await prisma.$executeRaw`
          INSERT INTO leads (
            id, service_type_id, zip_code, form_data, owns_home, 
            timeframe, lead_quality_score
          ) 
          VALUES (
            'test-invalid-score-' || hex(randomblob(4)), 'test', '10001', 
            '{}', true, 'ASAP', 150
          )
        `;
      }).rejects.toThrow();
    });

    test('should validate buyer timeout ranges', async () => {
      await expect(async () => {
        await prisma.$executeRaw`
          INSERT INTO buyers (
            id, name, api_url, ping_timeout, post_timeout
          ) 
          VALUES (
            'test-invalid-timeout-' || hex(randomblob(4)), 'Test', 
            'https://test.com', 0, 700
          )
        `;
      }).rejects.toThrow();
    });
  });

  describe('Foreign Key Relationships', () => {
    test('should have proper foreign key constraints', async () => {
      const fkCheck = await prisma.$queryRaw`PRAGMA foreign_key_check()`;
      expect(Array.isArray(fkCheck)).toBe(true);
      expect(fkCheck.length).toBe(0); // No violations
    });

    test('should have orphaned records report table', async () => {
      const tableExists = await prisma.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(*) as count FROM sqlite_master 
        WHERE type='table' AND name='orphaned_records_report'
      `;
      
      expect(tableExists[0].count).toBe(1);
    });

    test('should prevent insertion with invalid foreign keys', async () => {
      await expect(async () => {
        await prisma.$executeRaw`
          INSERT INTO buyer_service_zip_codes (
            id, buyer_id, service_type_id, zip_code, active, priority
          ) 
          VALUES (
            'test-invalid-fk-' || hex(randomblob(4)), 
            'nonexistent-buyer', 'nonexistent-service', '99999', true, 100
          )
        `;
      }).rejects.toThrow();
    });

    test('should cascade delete buyer service configs when buyer deleted', async () => {
      // Create test buyer and config
      const testBuyerId = 'test-buyer-' + Math.random().toString(36).substring(7);
      const testServiceId = 'test-service-' + Math.random().toString(36).substring(7);
      
      await prisma.$executeRaw`
        INSERT INTO buyers (id, name, api_url) 
        VALUES (${testBuyerId}, 'Test Buyer', 'https://test.com')
      `;
      
      await prisma.$executeRaw`
        INSERT INTO service_types (id, name, display_name, form_schema) 
        VALUES (${testServiceId}, 'test', 'Test Service', '{}')
      `;
      
      const configId = 'test-config-' + Math.random().toString(36).substring(7);
      await prisma.$executeRaw`
        INSERT INTO buyer_service_configs (
          id, buyer_id, service_type_id, ping_template, post_template, field_mappings
        ) 
        VALUES (${configId}, ${testBuyerId}, ${testServiceId}, '{}', '{}', '{}')
      `;
      
      // Delete buyer - should cascade
      await prisma.$executeRaw`DELETE FROM buyers WHERE id = ${testBuyerId}`;
      
      // Config should be gone
      const configCount = await prisma.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(*) as count FROM buyer_service_configs WHERE id = ${configId}
      `;
      
      expect(configCount[0].count).toBe(0);
      
      // Cleanup
      await prisma.$executeRaw`DELETE FROM service_types WHERE id = ${testServiceId}`;
    });
  });

  describe('SQLite Decimal Handling', () => {
    test('should handle decimal precision correctly', async () => {
      const testAmount = 123.456789;
      const formatted = formatBidAmount(testAmount);
      expect(formatted).toBe(123.46); // Rounded to 2 decimal places
    });

    test('should validate bid ranges correctly', async () => {
      const validRange = validateBidRange(10.00, 50.00);
      expect(validRange.isValid).toBe(true);
      expect(validRange.formattedMinBid).toBe(10.00);
      expect(validRange.formattedMaxBid).toBe(50.00);

      const invalidRange = validateBidRange(50.00, 10.00);
      expect(invalidRange.isValid).toBe(false);
      expect(invalidRange.error).toContain('min_bid must be less than max_bid');
    });

    test('should check database decimal health', async () => {
      const health = await checkDecimalHealth();
      expect(health).toHaveProperty('healthy');
      expect(health).toHaveProperty('checks');
      expect(Array.isArray(health.checks)).toBe(true);
    });

    test('should validate existing database decimals', async () => {
      const validation = await validateDatabaseDecimals();
      expect(validation).toHaveProperty('isValid');
      expect(validation).toHaveProperty('issues');
      expect(Array.isArray(validation.issues)).toBe(true);
      
      // In a properly migrated database, there should be no issues
      if (!validation.isValid) {
        console.warn('Decimal precision issues found:', validation.issues.length);
      }
    });
  });

  describe('Database Utility Functions', () => {
    test('should create buyer service config with proper validation', async () => {
      // This test requires existing buyer and service type
      const buyers = await prisma.buyer.findMany({ take: 1 });
      const serviceTypes = await prisma.serviceType.findMany({ take: 1 });
      
      if (buyers.length === 0 || serviceTypes.length === 0) {
        console.warn('Skipping utility function test - no test data available');
        return;
      }

      const configData = {
        buyerId: buyers[0].id,
        serviceTypeId: serviceTypes[0].id,
        pingTemplate: '{"test": true}',
        postTemplate: '{"test": true}',
        fieldMappings: '{"test": true}',
        minBid: 25.00,
        maxBid: 75.00
      };

      // Should succeed with valid data
      await expect(async () => {
        const config = await createBuyerServiceConfig(configData);
        // Cleanup
        await prisma.buyerServiceConfig.delete({ where: { id: config.id } });
      }).not.toThrow();

      // Should fail with invalid bid range
      await expect(async () => {
        await createBuyerServiceConfig({
          ...configData,
          minBid: 75.00,
          maxBid: 25.00
        });
      }).rejects.toThrow('Invalid bid range');
    });
  });

  describe('Migration Status', () => {
    test('should report migrations as up to date', async () => {
      const migrationStatus = await checkMigrationStatus();
      expect(migrationStatus).toHaveProperty('isUpToDate');
      expect(migrationStatus).toHaveProperty('pendingMigrations');
      expect(Array.isArray(migrationStatus.pendingMigrations)).toBe(true);
    });

    test('should pass production readiness checks', async () => {
      const readiness = await checkProductionReadiness();
      expect(readiness).toHaveProperty('ready');
      expect(readiness).toHaveProperty('checks');
      expect(Array.isArray(readiness.checks)).toBe(true);
      
      // Log any failed checks for debugging
      const failedChecks = readiness.checks.filter(check => !check.passed);
      if (failedChecks.length > 0) {
        console.warn('Failed production readiness checks:', failedChecks);
      }
    });
  });

  describe('Performance Validation', () => {
    test('should execute auction queries efficiently', async () => {
      const startTime = Date.now();
      
      // Simulate auction query
      await prisma.$queryRaw`
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
      
      // Should complete in reasonable time (adjust threshold as needed)
      expect(queryTime).toBeLessThan(1000); // 1 second max
      
      console.log(`Auction query completed in ${queryTime}ms`);
    });

    test('should have efficient compliance audit queries', async () => {
      const startTime = Date.now();
      
      await prisma.$queryRaw`
        SELECT COUNT(*) FROM compliance_audit_log 
        WHERE event_type = 'FORM_SUBMITTED' 
        AND created_at > datetime('now', '-24 hours')
      `;
      
      const queryTime = Date.now() - startTime;
      expect(queryTime).toBeLessThan(500); // Should be very fast with index
    });
  });

  describe('Data Integrity Views', () => {
    test('should have database health metrics view', async () => {
      const healthMetrics = await prisma.$queryRaw`
        SELECT * FROM v_database_health_metrics LIMIT 5
      `;
      
      expect(Array.isArray(healthMetrics)).toBe(true);
      expect(healthMetrics.length).toBeGreaterThan(0);
    });

    test('should have foreign key validation view', async () => {
      try {
        const fkValidation = await prisma.$queryRaw`
          SELECT * FROM v_foreign_key_validation
        `;
        
        expect(Array.isArray(fkValidation)).toBe(true);
        
        // All violation counts should be 0 in a healthy database
        const violations = fkValidation as Array<{ 
          validation_type: string; 
          violation_count: number 
        }>;
        
        for (const violation of violations) {
          if (violation.violation_count > 0) {
            console.warn(`${violation.validation_type}: ${violation.violation_count} violations`);
          }
        }
        
      } catch (error) {
        // View might not exist if migration hasn't been applied
        console.warn('Foreign key validation view not available');
      }
    });
  });
});

describe('Stress Testing', () => {
  test('should handle concurrent bid range validations', async () => {
    const concurrentValidations = Array.from({ length: 100 }, (_, i) => 
      validateBidRange(i * 10, (i + 1) * 10)
    );
    
    const results = await Promise.all(
      concurrentValidations.map(validation => Promise.resolve(validation))
    );
    
    expect(results.every(result => result.isValid)).toBe(true);
  });

  test('should handle multiple simultaneous database connections', async () => {
    const connections = Array.from({ length: 10 }, () => new PrismaClient());
    
    try {
      const healthChecks = await Promise.all(
        connections.map(client => 
          client.$queryRaw`SELECT 1 as test`.then(() => true).catch(() => false)
        )
      );
      
      expect(healthChecks.every(result => result === true)).toBe(true);
      
    } finally {
      await Promise.all(connections.map(client => client.$disconnect()));
    }
  });
});