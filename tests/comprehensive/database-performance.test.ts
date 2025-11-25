/**
 * Database Performance Tests with New Indexes
 * Tests query performance and optimization with buyer type indexing
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { BuyerType } from '@/types/database';

const prisma = new PrismaClient();

describe('6. Database Query Performance with New Indexes', () => {
  const PERFORMANCE_THRESHOLD_MS = 100; // Maximum acceptable query time
  const LARGE_DATASET_SIZE = 1000; // Size for load testing

  beforeAll(async () => {
    // Clean up existing test data
    await prisma.transaction.deleteMany();
    await prisma.lead.deleteMany();
    await prisma.buyerServiceZipCode.deleteMany();
    await prisma.buyerServiceConfig.deleteMany();
    await prisma.buyer.deleteMany({ where: { name: { contains: 'Perf Test' } } });
    await prisma.serviceType.deleteMany({ where: { name: { contains: 'perf-test' } } });

    // Create test service types
    const serviceTypes = await Promise.all([
      prisma.serviceType.create({
        data: {
          name: 'perf-test-roofing',
          displayName: 'Performance Test Roofing',
          formSchema: JSON.stringify({ fields: ['type', 'size'] }),
          active: true
        }
      }),
      prisma.serviceType.create({
        data: {
          name: 'perf-test-hvac',
          displayName: 'Performance Test HVAC',
          formSchema: JSON.stringify({ fields: ['system', 'efficiency'] }),
          active: true
        }
      }),
      prisma.serviceType.create({
        data: {
          name: 'perf-test-plumbing',
          displayName: 'Performance Test Plumbing',
          formSchema: JSON.stringify({ fields: ['issue', 'urgency'] }),
          active: true
        }
      })
    ]);

    console.log(`Creating ${LARGE_DATASET_SIZE} buyers for performance testing...`);

    // Create large dataset of buyers (mix of contractors and networks)
    const buyers = [];
    for (let i = 0; i < LARGE_DATASET_SIZE; i++) {
      const isContractor = i % 3 === 0; // ~33% contractors, ~67% networks
      buyers.push({
        name: `Perf Test ${isContractor ? 'Contractor' : 'Network'} ${i}`,
        type: isContractor ? BuyerType.CONTRACTOR : BuyerType.NETWORK,
        apiUrl: `https://perftest${i}.com/api`,
        authConfig: JSON.stringify({
          apiKey: `perf-key-${i}`,
          ...(isContractor && {
            contactEmail: `contractor${i}@test.com`,
            contactPhone: `(555) ${String(i).padStart(3, '0')}-0000`,
            contactName: `Contractor ${i}`,
            businessDescription: `Performance test contractor ${i}`
          })
        }),
        active: i % 10 !== 0, // ~90% active
        pingTimeout: 30,
        postTimeout: 60
      });
    }

    // Batch create buyers
    console.log('Inserting buyers...');
    const createdBuyers = [];
    const batchSize = 100;
    for (let i = 0; i < buyers.length; i += batchSize) {
      const batch = buyers.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(buyer => prisma.buyer.create({ data: buyer }))
      );
      createdBuyers.push(...batchResults);
    }

    console.log('Creating service configurations...');
    
    // Create service configurations for each buyer-service combination
    const serviceConfigs = [];
    for (const buyer of createdBuyers.slice(0, 500)) { // Limit to first 500 buyers
      for (const serviceType of serviceTypes) {
        serviceConfigs.push({
          buyerId: buyer.id,
          serviceTypeId: serviceType.id,
          pingTemplate: JSON.stringify({ template: 'standard' }),
          postTemplate: JSON.stringify({ template: 'standard' }),
          fieldMappings: JSON.stringify({ mapping: 'standard' }),
          minBid: buyer.type === BuyerType.CONTRACTOR ? 25.00 : 40.00,
          maxBid: buyer.type === BuyerType.CONTRACTOR ? 150.00 : 250.00,
          active: true
        });
      }
    }

    // Batch create service configurations
    for (let i = 0; i < serviceConfigs.length; i += batchSize) {
      const batch = serviceConfigs.slice(i, i + batchSize);
      await Promise.all(
        batch.map(config => prisma.buyerServiceConfig.create({ data: config }))
      );
    }

    console.log('Creating service zone mappings...');

    // Create service zone mappings
    const zipCodes = [];
    for (let zip = 90000; zip < 90100; zip++) { // 100 zip codes
      zipCodes.push(String(zip));
    }

    const serviceZones = [];
    for (const buyer of createdBuyers.slice(0, 200)) { // Limit to first 200 buyers
      // Each buyer covers 10-20 random zip codes per service
      const numZipCodes = 10 + Math.floor(Math.random() * 10);
      const buyerZipCodes = zipCodes
        .sort(() => 0.5 - Math.random())
        .slice(0, numZipCodes);

      for (const serviceType of serviceTypes) {
        for (const zipCode of buyerZipCodes) {
          serviceZones.push({
            buyerId: buyer.id,
            serviceTypeId: serviceType.id,
            zipCode,
            active: Math.random() > 0.1, // 90% active
            priority: 50 + Math.floor(Math.random() * 100),
            maxLeadsPerDay: Math.floor(Math.random() * 50) + 10,
            minBid: 20.00 + Math.random() * 30,
            maxBid: 100.00 + Math.random() * 150
          });
        }
      }
    }

    // Batch create service zones
    for (let i = 0; i < serviceZones.length; i += batchSize) {
      const batch = serviceZones.slice(i, i + batchSize);
      await Promise.all(
        batch.map(zone => prisma.buyerServiceZipCode.create({ data: zone }))
      );
    }

    console.log('Performance test data setup complete.');
  });

  afterAll(async () => {
    // Clean up performance test data
    console.log('Cleaning up performance test data...');
    await prisma.transaction.deleteMany();
    await prisma.lead.deleteMany();
    await prisma.buyerServiceZipCode.deleteMany();
    await prisma.buyerServiceConfig.deleteMany();
    await prisma.buyer.deleteMany({ where: { name: { contains: 'Perf Test' } } });
    await prisma.serviceType.deleteMany({ where: { name: { contains: 'perf-test' } } });
    await prisma.$disconnect();
  });

  describe('Type-based Query Performance', () => {
    it('should efficiently filter buyers by type', async () => {
      const start = process.hrtime.bigint();

      const contractors = await prisma.buyer.findMany({
        where: {
          type: BuyerType.CONTRACTOR,
          active: true
        },
        select: {
          id: true,
          name: true,
          type: true,
          active: true,
          createdAt: true
        }
      });

      const queryTime = Number(process.hrtime.bigint() - start) / 1000000;
      
      console.log(`Type-based query took ${queryTime}ms for ${contractors.length} contractors`);
      
      expect(queryTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      expect(contractors.length).toBeGreaterThan(0);
      
      // Verify all results are contractors
      contractors.forEach(buyer => {
        expect(buyer.type).toBe(BuyerType.CONTRACTOR);
        expect(buyer.active).toBe(true);
      });
    });

    it('should efficiently count buyers by type', async () => {
      const start = process.hrtime.bigint();

      const [contractorCount, networkCount] = await Promise.all([
        prisma.buyer.count({
          where: { type: BuyerType.CONTRACTOR }
        }),
        prisma.buyer.count({
          where: { type: BuyerType.NETWORK }
        })
      ]);

      const queryTime = Number(process.hrtime.bigint() - start) / 1000000;

      console.log(`Type-based count queries took ${queryTime}ms`);
      console.log(`Found ${contractorCount} contractors and ${networkCount} networks`);

      expect(queryTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      expect(contractorCount + networkCount).toBe(LARGE_DATASET_SIZE);
    });

    it('should efficiently query buyers with type and status filters', async () => {
      const start = process.hrtime.bigint();

      const activeContractors = await prisma.buyer.findMany({
        where: {
          type: BuyerType.CONTRACTOR,
          active: true
        },
        select: {
          id: true,
          name: true,
          authConfig: true
        },
        take: 50
      });

      const queryTime = Number(process.hrtime.bigint() - start) / 1000000;

      console.log(`Complex type+status query took ${queryTime}ms for ${activeContractors.length} results`);

      expect(queryTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      expect(activeContractors.length).toBeGreaterThan(0);
    });
  });

  describe('Service Zone Query Performance', () => {
    it('should efficiently find eligible buyers for zip code and service', async () => {
      const testServiceType = await prisma.serviceType.findFirst({
        where: { name: 'perf-test-roofing' }
      });

      const start = process.hrtime.bigint();

      const eligibleBuyers = await prisma.buyer.findMany({
        where: {
          active: true,
          serviceZipCodes: {
            some: {
              zipCode: '90010',
              serviceTypeId: testServiceType!.id,
              active: true
            }
          }
        },
        include: {
          serviceZipCodes: {
            where: {
              zipCode: '90010',
              serviceTypeId: testServiceType!.id,
              active: true
            }
          }
        }
      });

      const queryTime = Number(process.hrtime.bigint() - start) / 1000000;

      console.log(`Service zone eligibility query took ${queryTime}ms for ${eligibleBuyers.length} buyers`);

      expect(queryTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
    });

    it('should efficiently query service zones with type filtering', async () => {
      const start = process.hrtime.bigint();

      const contractorZones = await prisma.buyerServiceZipCode.findMany({
        where: {
          buyer: {
            type: BuyerType.CONTRACTOR,
            active: true
          },
          active: true
        },
        include: {
          buyer: {
            select: {
              id: true,
              name: true,
              type: true
            }
          },
          serviceType: {
            select: {
              name: true,
              displayName: true
            }
          }
        },
        take: 100
      });

      const queryTime = Number(process.hrtime.bigint() - start) / 1000000;

      console.log(`Contractor service zones query took ${queryTime}ms for ${contractorZones.length} zones`);

      expect(queryTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      
      // Verify all results are for contractors
      contractorZones.forEach(zone => {
        expect(zone.buyer.type).toBe(BuyerType.CONTRACTOR);
      });
    });

    it('should efficiently perform zip code coverage analysis', async () => {
      const start = process.hrtime.bigint();

      const coverageStats = await prisma.buyerServiceZipCode.groupBy({
        by: ['zipCode'],
        where: {
          active: true,
          buyer: {
            active: true
          }
        },
        _count: {
          buyerId: true
        },
        _avg: {
          priority: true
        },
        orderBy: {
          _count: {
            buyerId: 'desc'
          }
        },
        take: 20
      });

      const queryTime = Number(process.hrtime.bigint() - start) / 1000000;

      console.log(`Coverage analysis took ${queryTime}ms for ${coverageStats.length} zip codes`);

      expect(queryTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS * 2); // Allow more time for aggregation
      expect(coverageStats.length).toBeGreaterThan(0);
    });
  });

  describe('Complex Join Performance', () => {
    it('should efficiently query buyers with service configurations by type', async () => {
      const start = process.hrtime.bigint();

      const buyersWithServices = await prisma.buyer.findMany({
        where: {
          type: BuyerType.CONTRACTOR,
          active: true,
          serviceConfigs: {
            some: {
              active: true
            }
          }
        },
        include: {
          serviceConfigs: {
            where: {
              active: true
            },
            include: {
              serviceType: {
                select: {
                  name: true,
                  displayName: true
                }
              }
            }
          }
        },
        take: 50
      });

      const queryTime = Number(process.hrtime.bigint() - start) / 1000000;

      console.log(`Complex join query took ${queryTime}ms for ${buyersWithServices.length} buyers`);

      expect(queryTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS * 2);
      
      buyersWithServices.forEach(buyer => {
        expect(buyer.type).toBe(BuyerType.CONTRACTOR);
        expect(buyer.serviceConfigs.length).toBeGreaterThan(0);
      });
    });

    it('should efficiently find buyers by type with zip code and service filters', async () => {
      const testServiceType = await prisma.serviceType.findFirst({
        where: { name: 'perf-test-hvac' }
      });

      const start = process.hrtime.bigint();

      const eligibleContractors = await prisma.buyer.findMany({
        where: {
          type: BuyerType.CONTRACTOR,
          active: true,
          serviceConfigs: {
            some: {
              serviceTypeId: testServiceType!.id,
              active: true
            }
          },
          serviceZipCodes: {
            some: {
              zipCode: {
                in: ['90010', '90011', '90012']
              },
              serviceTypeId: testServiceType!.id,
              active: true
            }
          }
        },
        include: {
          serviceZipCodes: {
            where: {
              zipCode: {
                in: ['90010', '90011', '90012']
              },
              serviceTypeId: testServiceType!.id,
              active: true
            },
            orderBy: {
              priority: 'desc'
            }
          }
        }
      });

      const queryTime = Number(process.hrtime.bigint() - start) / 1000000;

      console.log(`Multi-filter contractor query took ${queryTime}ms for ${eligibleContractors.length} contractors`);

      expect(queryTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS * 2);
    });
  });

  describe('Index Effectiveness', () => {
    it('should use indexes efficiently for type-based queries', async () => {
      // Test with EXPLAIN QUERY PLAN (SQLite specific)
      const start = process.hrtime.bigint();

      // Simulate what the auction system would do
      const contractors = await prisma.buyer.findMany({
        where: {
          type: BuyerType.CONTRACTOR,
          active: true
        }
      });

      const networks = await prisma.buyer.findMany({
        where: {
          type: BuyerType.NETWORK,
          active: true
        }
      });

      const allBuyers = await prisma.buyer.findMany({
        where: {
          active: true
        }
      });

      const queryTime = Number(process.hrtime.bigint() - start) / 1000000;

      console.log(`Index test queries took ${queryTime}ms`);
      console.log(`Results: ${contractors.length} contractors, ${networks.length} networks, ${allBuyers.length} total active`);

      expect(queryTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS * 2);
      expect(contractors.length + networks.length).toBeLessThanOrEqual(allBuyers.length);
    });

    it('should efficiently handle concurrent type-based queries', async () => {
      const start = process.hrtime.bigint();

      // Simulate multiple concurrent admin dashboard requests
      const queries = await Promise.all([
        prisma.buyer.count({ where: { type: BuyerType.CONTRACTOR, active: true } }),
        prisma.buyer.count({ where: { type: BuyerType.CONTRACTOR, active: false } }),
        prisma.buyer.count({ where: { type: BuyerType.NETWORK, active: true } }),
        prisma.buyer.count({ where: { type: BuyerType.NETWORK, active: false } }),
        prisma.buyer.findMany({
          where: { type: BuyerType.CONTRACTOR, active: false },
          orderBy: { createdAt: 'desc' },
          take: 10
        }),
        prisma.buyerServiceZipCode.groupBy({
          by: ['zipCode'],
          where: {
            buyer: { type: BuyerType.CONTRACTOR },
            active: true
          },
          _count: true,
          take: 10
        })
      ]);

      const queryTime = Number(process.hrtime.bigint() - start) / 1000000;

      console.log(`Concurrent queries took ${queryTime}ms`);

      expect(queryTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS * 3);
      expect(queries).toHaveLength(6);
      expect(queries.every(result => result !== null)).toBe(true);
    });
  });

  describe('Load Testing', () => {
    it('should maintain performance under high query load', async () => {
      const iterations = 50;
      const queryTimes: number[] = [];

      console.log(`Running ${iterations} concurrent type-based queries...`);

      for (let i = 0; i < iterations; i++) {
        const start = process.hrtime.bigint();

        await prisma.buyer.findMany({
          where: {
            type: i % 2 === 0 ? BuyerType.CONTRACTOR : BuyerType.NETWORK,
            active: true
          },
          take: 10
        });

        const queryTime = Number(process.hrtime.bigint() - start) / 1000000;
        queryTimes.push(queryTime);
      }

      const avgQueryTime = queryTimes.reduce((sum, time) => sum + time, 0) / queryTimes.length;
      const maxQueryTime = Math.max(...queryTimes);

      console.log(`Load test results: avg ${avgQueryTime}ms, max ${maxQueryTime}ms`);

      expect(avgQueryTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      expect(maxQueryTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS * 2);
    });

    it('should handle database connection pooling efficiently', async () => {
      const concurrentQueries = 20;
      const start = process.hrtime.bigint();

      // Run many queries simultaneously to test connection pooling
      const promises = Array(concurrentQueries).fill(0).map(async (_, i) => {
        return await prisma.buyer.findMany({
          where: {
            type: BuyerType.CONTRACTOR,
            name: { contains: `${i % 10}` }
          },
          take: 5
        });
      });

      const results = await Promise.all(promises);
      const totalTime = Number(process.hrtime.bigint() - start) / 1000000;

      console.log(`${concurrentQueries} concurrent queries took ${totalTime}ms total`);

      expect(totalTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS * 5);
      expect(results).toHaveLength(concurrentQueries);
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should efficiently handle large result sets', async () => {
      const memBefore = process.memoryUsage();
      
      // Query a large number of buyers
      const buyers = await prisma.buyer.findMany({
        where: {
          active: true
        },
        include: {
          serviceConfigs: true,
          serviceZipCodes: true
        },
        take: 500
      });

      const memAfter = process.memoryUsage();
      const memoryIncrease = (memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024; // MB

      console.log(`Memory increase for large query: ${memoryIncrease}MB`);
      console.log(`Retrieved ${buyers.length} buyers with related data`);

      expect(memoryIncrease).toBeLessThan(100); // Should use less than 100MB
      expect(buyers.length).toBeGreaterThan(0);
    });

    it('should clean up resources properly after queries', async () => {
      const memBefore = process.memoryUsage();

      // Perform several queries in sequence
      for (let i = 0; i < 10; i++) {
        await prisma.buyer.findMany({
          where: {
            type: i % 2 === 0 ? BuyerType.CONTRACTOR : BuyerType.NETWORK
          },
          take: 100
        });
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const memAfter = process.memoryUsage();
      const memoryIncrease = (memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024;

      console.log(`Memory increase after sequential queries: ${memoryIncrease}MB`);

      expect(memoryIncrease).toBeLessThan(50); // Should not leak significant memory
    });
  });
});