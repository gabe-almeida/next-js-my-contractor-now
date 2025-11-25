/**
 * Buyer Type Assignment and Persistence Tests
 * Tests buyer type assignment, persistence, and integration with existing systems
 */

import { describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { BuyerType } from '@/types/database';
import request from 'supertest';
import { createApp } from '../utils/testHelpers';

const prisma = new PrismaClient();
const app = createApp();

describe('2. Buyer Type Assignment and Persistence', () => {
  beforeEach(async () => {
    // Clean up test data
    await prisma.buyer.deleteMany({
      where: { 
        name: { 
          contains: 'Test' 
        } 
      }
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Type Assignment Logic', () => {
    it('should automatically assign CONTRACTOR type during signup', async () => {
      const contractorData = {
        name: 'Jane Doe',
        email: 'jane@testcontractor.com',
        phone: '(555) 987-6543',
        company: 'Test Contracting LLC',
        description: 'Professional contracting services for residential projects'
      };

      const response = await request(app)
        .post('/api/contractors/signup')
        .send(contractorData)
        .expect(201);

      expect(response.body.message).toBe('Contractor registration successful');
      expect(response.body.buyerId).toBeDefined();

      // Verify database record
      const buyer = await prisma.buyer.findUnique({
        where: { id: response.body.buyerId }
      });

      expect(buyer).not.toBeNull();
      expect(buyer!.type).toBe(BuyerType.CONTRACTOR);
      expect(buyer!.name).toBe(contractorData.company);
      expect(buyer!.active).toBe(false); // Should be inactive initially
    });

    it('should preserve explicit type assignment when provided', async () => {
      const networkBuyerData = {
        name: 'Network Admin',
        email: 'admin@testnetwork.com',
        phone: '(555) 111-2222',
        company: 'Test Network Corp',
        description: 'Lead distribution network',
        type: BuyerType.NETWORK
      };

      const response = await request(app)
        .post('/api/contractors/signup')
        .send(networkBuyerData)
        .expect(201);

      const buyer = await prisma.buyer.findUnique({
        where: { id: response.body.buyerId }
      });

      expect(buyer!.type).toBe(BuyerType.NETWORK);
    });

    it('should handle invalid type gracefully', async () => {
      const invalidData = {
        name: 'Test User',
        email: 'test@invalid.com',
        phone: '(555) 000-0000',
        company: 'Invalid Type Test',
        description: 'Testing invalid type',
        type: 'INVALID_TYPE'
      };

      const response = await request(app)
        .post('/api/contractors/signup')
        .send(invalidData)
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toBeDefined();
    });
  });

  describe('Type Persistence and Updates', () => {
    it('should persist buyer type through database operations', async () => {
      // Create contractor
      const contractor = await prisma.buyer.create({
        data: {
          name: 'Persistence Test Contractor',
          type: BuyerType.CONTRACTOR,
          apiUrl: 'https://test.com',
          active: false
        }
      });

      // Update other fields
      const updated = await prisma.buyer.update({
        where: { id: contractor.id },
        data: {
          active: true,
          apiUrl: 'https://updated.com'
        }
      });

      expect(updated.type).toBe(BuyerType.CONTRACTOR);
      expect(updated.active).toBe(true);
      expect(updated.apiUrl).toBe('https://updated.com');
    });

    it('should maintain type integrity in transactions', async () => {
      await prisma.$transaction(async (tx) => {
        const contractor = await tx.buyer.create({
          data: {
            name: 'Transaction Test Contractor',
            type: BuyerType.CONTRACTOR,
            apiUrl: 'https://test.com',
            active: false
          }
        });

        // Create service configuration
        const serviceConfig = await tx.buyerServiceConfig.create({
          data: {
            buyerId: contractor.id,
            serviceTypeId: 'test-service-id',
            pingTemplate: '{}',
            postTemplate: '{}',
            fieldMappings: '{}',
            minBid: 10.00,
            maxBid: 100.00,
            active: true
          }
        });

        expect(contractor.type).toBe(BuyerType.CONTRACTOR);
        expect(serviceConfig.buyerId).toBe(contractor.id);
      });
    });

    it('should handle concurrent type updates correctly', async () => {
      const contractor = await prisma.buyer.create({
        data: {
          name: 'Concurrent Update Test',
          type: BuyerType.CONTRACTOR,
          apiUrl: 'https://test.com',
          active: false
        }
      });

      // Simulate concurrent updates
      const updates = await Promise.allSettled([
        prisma.buyer.update({
          where: { id: contractor.id },
          data: { active: true }
        }),
        prisma.buyer.update({
          where: { id: contractor.id },
          data: { apiUrl: 'https://concurrent1.com' }
        }),
        prisma.buyer.update({
          where: { id: contractor.id },
          data: { pingTimeout: 45 }
        })
      ]);

      // All updates should succeed
      updates.forEach(result => {
        expect(result.status).toBe('fulfilled');
      });

      // Type should remain unchanged
      const finalBuyer = await prisma.buyer.findUnique({
        where: { id: contractor.id }
      });

      expect(finalBuyer!.type).toBe(BuyerType.CONTRACTOR);
      expect(finalBuyer!.active).toBe(true);
    });
  });

  describe('Type-based Query Performance', () => {
    it('should efficiently filter buyers by type', async () => {
      // Create test data
      const contractors = await Promise.all(
        Array(50).fill(0).map((_, i) =>
          prisma.buyer.create({
            data: {
              name: `Contractor ${i}`,
              type: BuyerType.CONTRACTOR,
              apiUrl: `https://contractor${i}.com`,
              active: true
            }
          })
        )
      );

      const networks = await Promise.all(
        Array(25).fill(0).map((_, i) =>
          prisma.buyer.create({
            data: {
              name: `Network ${i}`,
              type: BuyerType.NETWORK,
              apiUrl: `https://network${i}.com`,
              active: true
            }
          })
        )
      );

      // Test type-specific queries
      const start = process.hrtime.bigint();
      
      const contractorBuyers = await prisma.buyer.findMany({
        where: { 
          type: BuyerType.CONTRACTOR,
          active: true 
        }
      });

      const queryTime = Number(process.hrtime.bigint() - start) / 1000000; // Convert to milliseconds

      expect(contractorBuyers).toHaveLength(50);
      expect(queryTime).toBeLessThan(100); // Should complete in under 100ms
      
      // Verify correct type filtering
      contractorBuyers.forEach(buyer => {
        expect(buyer.type).toBe(BuyerType.CONTRACTOR);
      });
    });

    it('should support complex type-based queries with joins', async () => {
      // Create contractor with service configurations
      const contractor = await prisma.buyer.create({
        data: {
          name: 'Complex Query Test Contractor',
          type: BuyerType.CONTRACTOR,
          apiUrl: 'https://complextest.com',
          active: true
        }
      });

      // Create service type for testing
      const serviceType = await prisma.serviceType.create({
        data: {
          name: 'roofing',
          displayName: 'Roofing Services',
          formSchema: '{}',
          active: true
        }
      });

      // Create service configuration
      await prisma.buyerServiceConfig.create({
        data: {
          buyerId: contractor.id,
          serviceTypeId: serviceType.id,
          pingTemplate: '{}',
          postTemplate: '{}',
          fieldMappings: '{}',
          minBid: 25.00,
          maxBid: 150.00,
          active: true
        }
      });

      // Complex query with joins
      const result = await prisma.buyer.findMany({
        where: {
          type: BuyerType.CONTRACTOR,
          active: true,
          serviceConfigs: {
            some: {
              serviceType: {
                name: 'roofing'
              },
              active: true
            }
          }
        },
        include: {
          serviceConfigs: {
            include: {
              serviceType: true
            }
          }
        }
      });

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe(BuyerType.CONTRACTOR);
      expect(result[0].serviceConfigs).toHaveLength(1);
      expect(result[0].serviceConfigs[0].serviceType.name).toBe('roofing');
    });
  });

  describe('Type Migration and Compatibility', () => {
    it('should handle type changes for existing buyers', async () => {
      // Create buyer as CONTRACTOR
      const buyer = await prisma.buyer.create({
        data: {
          name: 'Migration Test Buyer',
          type: BuyerType.CONTRACTOR,
          apiUrl: 'https://migration.com',
          active: true
        }
      });

      // Change to NETWORK
      const updated = await prisma.buyer.update({
        where: { id: buyer.id },
        data: { type: BuyerType.NETWORK }
      });

      expect(updated.type).toBe(BuyerType.NETWORK);

      // Verify historical data integrity
      const history = await prisma.buyer.findUnique({
        where: { id: buyer.id }
      });

      expect(history!.type).toBe(BuyerType.NETWORK);
      expect(history!.name).toBe('Migration Test Buyer');
      expect(history!.apiUrl).toBe('https://migration.com');
    });

    it('should maintain referential integrity during type changes', async () => {
      const buyer = await prisma.buyer.create({
        data: {
          name: 'Referential Integrity Test',
          type: BuyerType.CONTRACTOR,
          apiUrl: 'https://integrity.com',
          active: true
        }
      });

      const serviceType = await prisma.serviceType.create({
        data: {
          name: 'plumbing',
          displayName: 'Plumbing Services',
          formSchema: '{}',
          active: true
        }
      });

      // Create related records
      const serviceConfig = await prisma.buyerServiceConfig.create({
        data: {
          buyerId: buyer.id,
          serviceTypeId: serviceType.id,
          pingTemplate: '{}',
          postTemplate: '{}',
          fieldMappings: '{}',
          minBid: 20.00,
          maxBid: 120.00,
          active: true
        }
      });

      // Change buyer type
      await prisma.buyer.update({
        where: { id: buyer.id },
        data: { type: BuyerType.NETWORK }
      });

      // Related records should still exist and reference correctly
      const updatedConfig = await prisma.buyerServiceConfig.findUnique({
        where: { id: serviceConfig.id },
        include: {
          buyer: true,
          serviceType: true
        }
      });

      expect(updatedConfig).not.toBeNull();
      expect(updatedConfig!.buyer.type).toBe(BuyerType.NETWORK);
      expect(updatedConfig!.buyer.id).toBe(buyer.id);
    });
  });
});

describe('API Integration with Type System', () => {
  it('should return type information in API responses', async () => {
    const contractor = await prisma.buyer.create({
      data: {
        name: 'API Response Test Contractor',
        type: BuyerType.CONTRACTOR,
        apiUrl: 'https://apitest.com',
        active: false
      }
    });

    const response = await request(app)
      .get(`/api/admin/buyers?type=${BuyerType.CONTRACTOR}`)
      .expect(200);

    expect(response.body.buyers).toBeInstanceOf(Array);
    
    const testBuyer = response.body.buyers.find(
      (b: any) => b.id === contractor.id
    );

    expect(testBuyer).toBeDefined();
    expect(testBuyer.type).toBe(BuyerType.CONTRACTOR);
    expect(testBuyer.name).toBe('API Response Test Contractor');
  });

  it('should support type-based filtering in admin endpoints', async () => {
    // Create mixed buyer types
    await Promise.all([
      prisma.buyer.create({
        data: {
          name: 'Filter Test Contractor 1',
          type: BuyerType.CONTRACTOR,
          apiUrl: 'https://filter1.com',
          active: true
        }
      }),
      prisma.buyer.create({
        data: {
          name: 'Filter Test Network 1',
          type: BuyerType.NETWORK,
          apiUrl: 'https://network1.com',
          active: true
        }
      })
    ]);

    // Test contractor filter
    const contractorResponse = await request(app)
      .get(`/api/admin/buyers?type=${BuyerType.CONTRACTOR}`)
      .expect(200);

    contractorResponse.body.buyers.forEach((buyer: any) => {
      expect(buyer.type).toBe(BuyerType.CONTRACTOR);
    });

    // Test network filter
    const networkResponse = await request(app)
      .get(`/api/admin/buyers?type=${BuyerType.NETWORK}`)
      .expect(200);

    networkResponse.body.buyers.forEach((buyer: any) => {
      expect(buyer.type).toBe(BuyerType.NETWORK);
    });
  });
});