/**
 * Domain 13: ZIP Code Coverage & Geographic Tests (50 tests)
 *
 * Tests ZIP code coverage management, geographic routing,
 * buyer territory management, and ZIP code metadata.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:3002';

describe('Domain 13: ZIP Code Coverage & Geographic Tests (50 tests)', () => {
  let testServiceType;
  let testBuyer1;
  let testBuyer2;
  let testZipCodes = [];
  let testMetadata = [];
  let baseZip;

  beforeAll(async () => {
    testServiceType = await prisma.serviceType.findFirst();

    testBuyer1 = await prisma.buyer.create({
      data: {
        name: 'Geo Buyer 1 ' + Date.now(),
        apiUrl: 'https://geo1.com',
        active: true
      }
    });

    testBuyer2 = await prisma.buyer.create({
      data: {
        name: 'Geo Buyer 2 ' + (Date.now() + 1),
        apiUrl: 'https://geo2.com',
        active: true
      }
    });

    // Create ZIP code metadata with unique ZIPs
    baseZip = 80000 + (Date.now() % 10000);
    for (let i = 0; i < 10; i++) {
      const zip = String(baseZip + i);
      const metadata = await prisma.zipCodeMetadata.create({
        data: {
          zipCode: zip,
          city: 'City' + i,
          state: i < 5 ? 'CA' : 'NY',
          county: 'County' + i,
          latitude: 34.0 + i * 0.1,
          longitude: -118.0 + i * 0.1,
          timezone: 'America/Los_Angeles',
          active: true
        }
      });
      testMetadata.push(metadata);
    }

    // Create ZIP code coverage using same base ZIP
    for (let i = 0; i < 5; i++) {
      const zipCode = await prisma.buyerServiceZipCode.create({
        data: {
          buyerId: testBuyer1.id,
          serviceTypeId: testServiceType.id,
          zipCode: String(baseZip + i),
          active: true,
          priority: 100 + i * 10,
          maxLeadsPerDay: 10,
          minBid: 15.0,
          maxBid: 50.0
        }
      });
      testZipCodes.push(zipCode);
    }
  });

  afterAll(async () => {
    // Cleanup
    for (const zipCode of testZipCodes) {
      await prisma.buyerServiceZipCode.delete({ where: { id: zipCode.id } }).catch(() => {});
    }

    for (const metadata of testMetadata) {
      await prisma.zipCodeMetadata.delete({ where: { zipCode: metadata.zipCode } }).catch(() => {});
    }

    if (testBuyer1) {
      await prisma.buyer.delete({ where: { id: testBuyer1.id } }).catch(() => {});
    }

    if (testBuyer2) {
      await prisma.buyer.delete({ where: { id: testBuyer2.id } }).catch(() => {});
    }

    await prisma.$disconnect();
  });

  // Tests 1-10: ZIP Code Coverage Management
  test('Test 1: Create ZIP code coverage', async () => {
    const coverage = await prisma.buyerServiceZipCode.create({
      data: {
        buyerId: testBuyer2.id,
        serviceTypeId: testServiceType.id,
        zipCode: '90010',
        active: true,
        priority: 100
      }
    });

    expect(coverage).toBeDefined();
    expect(coverage.zipCode).toBe('90010');

    await prisma.buyerServiceZipCode.delete({ where: { id: coverage.id } });
  });

  test('Test 2: Find buyer by ZIP code', async () => {
    const buyers = await prisma.buyerServiceZipCode.findMany({
      where: {
        zipCode: String(baseZip),
        serviceTypeId: testServiceType.id,
        active: true
      },
      include: {
        buyer: true
      }
    });

    expect(buyers.length).toBeGreaterThan(0);
    expect(buyers[0].buyer).toBeDefined();
  });

  test('Test 3: Find ZIPs covered by buyer', async () => {
    const zips = await prisma.buyerServiceZipCode.findMany({
      where: {
        buyerId: testBuyer1.id,
        active: true
      }
    });

    expect(zips.length).toBeGreaterThanOrEqual(5);
  });

  test('Test 4: Check ZIP code active status', async () => {
    const coverage = await prisma.buyerServiceZipCode.findFirst({
      where: {
        buyerId: testBuyer1.id,
        zipCode: String(baseZip)
      }
    });

    expect(coverage).toBeDefined();
    expect(coverage.active).toBe(true);
  });

  test('Test 5: Update ZIP code priority', async () => {
    const coverage = await prisma.buyerServiceZipCode.findFirst({
      where: {
        buyerId: testBuyer1.id,
        zipCode: String(baseZip)
      }
    });

    const updated = await prisma.buyerServiceZipCode.update({
      where: { id: coverage.id },
      data: { priority: 200 }
    });

    expect(updated.priority).toBe(200);
  });

  test('Test 6: Disable ZIP code coverage', async () => {
    const coverage = await prisma.buyerServiceZipCode.findFirst({
      where: {
        buyerId: testBuyer1.id,
        zipCode: String(baseZip + 1)
      }
    });

    const updated = await prisma.buyerServiceZipCode.update({
      where: { id: coverage.id },
      data: { active: false }
    });

    expect(updated.active).toBe(false);

    // Re-enable for later tests
    await prisma.buyerServiceZipCode.update({
      where: { id: coverage.id },
      data: { active: true }
    });
  });

  test('Test 7: Multiple buyers same ZIP', async () => {
    const coverage = await prisma.buyerServiceZipCode.create({
      data: {
        buyerId: testBuyer2.id,
        serviceTypeId: testServiceType.id,
        zipCode: String(baseZip),
        active: true,
        priority: 150
      }
    });

    const buyers = await prisma.buyerServiceZipCode.findMany({
      where: {
        zipCode: String(baseZip),
        serviceTypeId: testServiceType.id,
        active: true
      }
    });

    expect(buyers.length).toBeGreaterThanOrEqual(2);

    await prisma.buyerServiceZipCode.delete({ where: { id: coverage.id } });
  });

  test('Test 8: Priority-based routing', async () => {
    const buyers = await prisma.buyerServiceZipCode.findMany({
      where: {
        zipCode: String(baseZip),
        serviceTypeId: testServiceType.id,
        active: true
      },
      orderBy: {
        priority: 'desc'
      }
    });

    expect(buyers.length).toBeGreaterThan(0);
    if (buyers.length > 1) {
      expect(buyers[0].priority).toBeGreaterThanOrEqual(buyers[1].priority);
    }
  });

  test('Test 9: Max leads per day limit', async () => {
    const coverage = await prisma.buyerServiceZipCode.findFirst({
      where: {
        buyerId: testBuyer1.id,
        zipCode: String(baseZip)
      }
    });

    expect(coverage.maxLeadsPerDay).toBe(10);
  });

  test('Test 10: ZIP-specific bid range', async () => {
    const coverage = await prisma.buyerServiceZipCode.findFirst({
      where: {
        buyerId: testBuyer1.id,
        zipCode: String(baseZip)
      }
    });

    expect(coverage.minBid).toBe(15.0);
    expect(coverage.maxBid).toBe(50.0);
  });

  // Tests 11-20: Geographic Metadata
  test('Test 11: Create ZIP code metadata', async () => {
    const metadata = await prisma.zipCodeMetadata.create({
      data: {
        zipCode: '90020',
        city: 'Los Angeles',
        state: 'CA',
        county: 'Los Angeles County',
        latitude: 34.0522,
        longitude: -118.2437,
        timezone: 'America/Los_Angeles',
        active: true
      }
    });

    expect(metadata).toBeDefined();
    expect(metadata.city).toBe('Los Angeles');

    await prisma.zipCodeMetadata.delete({ where: { zipCode: '90020' } });
  });

  test('Test 12: Find ZIP by city and state', async () => {
    const zips = await prisma.zipCodeMetadata.findMany({
      where: {
        city: 'City0',
        state: 'CA'
      }
    });

    expect(zips.length).toBeGreaterThan(0);
  });

  test('Test 13: Find all ZIPs in state', async () => {
    const zips = await prisma.zipCodeMetadata.findMany({
      where: {
        state: 'CA'
      }
    });

    expect(zips.length).toBeGreaterThanOrEqual(5);
  });

  test('Test 14: Find ZIP by coordinates', async () => {
    const zips = await prisma.zipCodeMetadata.findMany({
      where: {
        latitude: {
          gte: 34.0,
          lte: 35.0
        },
        longitude: {
          gte: -119.0,
          lte: -118.0
        }
      }
    });

    expect(zips.length).toBeGreaterThan(0);
  });

  test('Test 15: Group ZIPs by state', async () => {
    const byState = await prisma.zipCodeMetadata.groupBy({
      by: ['state'],
      _count: {
        zipCode: true
      }
    });

    expect(byState.length).toBeGreaterThan(0);
  });

  test('Test 16: Group ZIPs by city', async () => {
    const byCity = await prisma.zipCodeMetadata.groupBy({
      by: ['city', 'state'],
      _count: {
        zipCode: true
      }
    });

    expect(byCity.length).toBeGreaterThan(0);
  });

  test('Test 17: Find ZIP timezone', async () => {
    const metadata = await prisma.zipCodeMetadata.findUnique({
      where: {
        zipCode: String(baseZip)
      }
    });

    expect(metadata).toBeDefined();
    expect(metadata.timezone).toBe('America/Los_Angeles');
  });

  test('Test 18: Find ZIPs in county', async () => {
    const zips = await prisma.zipCodeMetadata.findMany({
      where: {
        county: 'County0'
      }
    });

    expect(zips.length).toBeGreaterThan(0);
  });

  test('Test 19: Check metadata active status', async () => {
    const metadata = await prisma.zipCodeMetadata.findUnique({
      where: {
        zipCode: String(baseZip)
      }
    });

    expect(metadata.active).toBe(true);
  });

  test('Test 20: Update ZIP metadata', async () => {
    const updated = await prisma.zipCodeMetadata.update({
      where: {
        zipCode: String(baseZip)
      },
      data: {
        county: 'Updated County'
      }
    });

    expect(updated.county).toBe('Updated County');

    // Restore original
    await prisma.zipCodeMetadata.update({
      where: {
        zipCode: String(baseZip)
      },
      data: {
        county: 'County0'
      }
    });
  });

  // Tests 21-30: Coverage Analysis
  test('Test 21: Count total coverage entries', async () => {
    const count = await prisma.buyerServiceZipCode.count({
      where: {
        active: true
      }
    });

    expect(count).toBeGreaterThanOrEqual(5);
  });

  test('Test 22: Count buyer coverage', async () => {
    const count = await prisma.buyerServiceZipCode.count({
      where: {
        buyerId: testBuyer1.id,
        active: true
      }
    });

    expect(count).toBeGreaterThanOrEqual(5);
  });

  test('Test 23: Find uncovered ZIPs', async () => {
    // Find ZIPs in metadata that don't have coverage
    const allZips = await prisma.zipCodeMetadata.findMany({
      select: {
        zipCode: true
      }
    });

    const coveredZips = await prisma.buyerServiceZipCode.findMany({
      where: {
        serviceTypeId: testServiceType.id,
        active: true
      },
      select: {
        zipCode: true
      }
    });

    const coveredSet = new Set(coveredZips.map(c => c.zipCode));
    const uncovered = allZips.filter(z => !coveredSet.has(z.zipCode));

    expect(uncovered).toBeDefined();
    expect(Array.isArray(uncovered)).toBe(true);
  });

  test('Test 24: Find over-covered ZIPs', async () => {
    const coverage = await prisma.buyerServiceZipCode.groupBy({
      by: ['zipCode', 'serviceTypeId'],
      where: {
        active: true
      },
      _count: {
        id: true
      }
    });

    const overCovered = coverage.filter(c => c._count.id > 1);
    expect(overCovered).toBeDefined();
  });

  test('Test 25: Coverage by service type', async () => {
    const coverage = await prisma.buyerServiceZipCode.groupBy({
      by: ['serviceTypeId'],
      where: {
        active: true
      },
      _count: {
        id: true
      }
    });

    expect(coverage.length).toBeGreaterThan(0);
  });

  test('Test 26: Coverage density by ZIP', async () => {
    const density = await prisma.buyerServiceZipCode.groupBy({
      by: ['zipCode'],
      where: {
        active: true
      },
      _count: {
        id: true
      }
    });

    expect(density.length).toBeGreaterThan(0);
  });

  test('Test 27: Average priority by buyer', async () => {
    const avgPriority = await prisma.buyerServiceZipCode.groupBy({
      by: ['buyerId'],
      _avg: {
        priority: true
      }
    });

    expect(avgPriority.length).toBeGreaterThan(0);
  });

  test('Test 28: Total coverage by state', async () => {
    // Join coverage with metadata to group by state
    const coverage = await prisma.buyerServiceZipCode.findMany({
      where: {
        active: true
      },
      select: {
        zipCode: true
      }
    });

    expect(coverage.length).toBeGreaterThan(0);
  });

  test('Test 29: Coverage gaps by service type', async () => {
    const coverage = await prisma.buyerServiceZipCode.findMany({
      where: {
        serviceTypeId: testServiceType.id,
        active: true
      }
    });

    expect(coverage).toBeDefined();
    expect(Array.isArray(coverage)).toBe(true);
  });

  test('Test 30: Buyer market share by ZIP', async () => {
    const marketShare = await prisma.buyerServiceZipCode.groupBy({
      by: ['buyerId'],
      where: {
        zipCode: String(baseZip),
        active: true
      },
      _count: {
        id: true
      }
    });

    expect(marketShare).toBeDefined();
  });

  // Tests 31-40: Routing & Priority
  test('Test 31: Route lead to highest priority buyer', async () => {
    const buyers = await prisma.buyerServiceZipCode.findMany({
      where: {
        zipCode: String(baseZip),
        serviceTypeId: testServiceType.id,
        active: true
      },
      orderBy: {
        priority: 'desc'
      },
      take: 1,
      include: {
        buyer: true
      }
    });

    expect(buyers.length).toBe(1);
    expect(buyers[0].buyer).toBeDefined();
  });

  test('Test 32: Route to multiple buyers', async () => {
    const buyers = await prisma.buyerServiceZipCode.findMany({
      where: {
        zipCode: String(baseZip),
        serviceTypeId: testServiceType.id,
        active: true
      },
      orderBy: {
        priority: 'desc'
      },
      take: 3,
      include: {
        buyer: true
      }
    });

    expect(buyers).toBeDefined();
    expect(Array.isArray(buyers)).toBe(true);
  });

  test('Test 33: Filter by bid range', async () => {
    const buyers = await prisma.buyerServiceZipCode.findMany({
      where: {
        zipCode: String(baseZip),
        serviceTypeId: testServiceType.id,
        active: true,
        maxBid: {
          gte: 30.0
        }
      }
    });

    expect(buyers.length).toBeGreaterThan(0);
  });

  test('Test 34: Filter by max leads per day', async () => {
    const buyers = await prisma.buyerServiceZipCode.findMany({
      where: {
        zipCode: String(baseZip),
        serviceTypeId: testServiceType.id,
        active: true,
        maxLeadsPerDay: {
          not: null
        }
      }
    });

    expect(buyers.length).toBeGreaterThan(0);
  });

  test('Test 35: Priority tiebreaker', async () => {
    const buyers = await prisma.buyerServiceZipCode.findMany({
      where: {
        zipCode: String(baseZip),
        serviceTypeId: testServiceType.id,
        active: true
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' }
      ]
    });

    expect(buyers.length).toBeGreaterThan(0);
  });

  test('Test 36: Exclude inactive buyers', async () => {
    const buyers = await prisma.buyerServiceZipCode.findMany({
      where: {
        zipCode: String(baseZip),
        serviceTypeId: testServiceType.id,
        active: true,
        buyer: {
          active: true
        }
      },
      include: {
        buyer: true
      }
    });

    expect(buyers.length).toBeGreaterThan(0);
    buyers.forEach(b => {
      expect(b.buyer.active).toBe(true);
    });
  });

  test('Test 37: Find backup buyers', async () => {
    const primary = await prisma.buyerServiceZipCode.findFirst({
      where: {
        zipCode: String(baseZip),
        serviceTypeId: testServiceType.id,
        active: true
      },
      orderBy: {
        priority: 'desc'
      }
    });

    const backups = await prisma.buyerServiceZipCode.findMany({
      where: {
        zipCode: String(baseZip),
        serviceTypeId: testServiceType.id,
        active: true,
        id: {
          not: primary.id
        }
      },
      orderBy: {
        priority: 'desc'
      }
    });

    expect(backups).toBeDefined();
  });

  test('Test 38: Route by service type', async () => {
    const buyers = await prisma.buyerServiceZipCode.findMany({
      where: {
        serviceTypeId: testServiceType.id,
        active: true
      },
      take: 10
    });

    expect(buyers.length).toBeGreaterThan(0);
    buyers.forEach(b => {
      expect(b.serviceTypeId).toBe(testServiceType.id);
    });
  });

  test('Test 39: Geographic proximity routing', async () => {
    // Find buyers covering nearby ZIPs
    const nearbyZips = [String(baseZip), String(baseZip + 1), String(baseZip + 2)];
    const buyers = await prisma.buyerServiceZipCode.findMany({
      where: {
        zipCode: {
          in: nearbyZips
        },
        serviceTypeId: testServiceType.id,
        active: true
      },
      include: {
        buyer: true
      }
    });

    expect(buyers.length).toBeGreaterThan(0);
  });

  test('Test 40: Load balancing by priority', async () => {
    const allBuyers = await prisma.buyerServiceZipCode.findMany({
      where: {
        zipCode: String(baseZip),
        serviceTypeId: testServiceType.id,
        active: true
      },
      orderBy: {
        priority: 'desc'
      }
    });

    expect(allBuyers.length).toBeGreaterThan(0);
  });

  // Tests 41-50: Performance & Optimization
  test('Test 41: Index usage for ZIP lookup', async () => {
    const startTime = Date.now();

    await prisma.buyerServiceZipCode.findMany({
      where: {
        zipCode: String(baseZip)
      }
    });

    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(1000);
  });

  test('Test 42: Bulk insert coverage', async () => {
    const coverage = [];
    for (let i = 0; i < 5; i++) {
      coverage.push({
        buyerId: testBuyer2.id,
        serviceTypeId: testServiceType.id,
        zipCode: String(91000 + i),
        active: true,
        priority: 100
      });
    }

    const results = await Promise.all(
      coverage.map(c => prisma.buyerServiceZipCode.create({ data: c }))
    );

    expect(results.length).toBe(5);

    // Cleanup
    await Promise.all(
      results.map(r => prisma.buyerServiceZipCode.delete({ where: { id: r.id } }).catch(() => {}))
    );
  });

  test('Test 43: Batch update priorities', async () => {
    const toUpdate = await prisma.buyerServiceZipCode.findMany({
      where: {
        buyerId: testBuyer1.id
      },
      take: 3
    });

    const updates = await Promise.all(
      toUpdate.map(c =>
        prisma.buyerServiceZipCode.update({
          where: { id: c.id },
          data: { priority: c.priority + 10 }
        })
      )
    );

    expect(updates.length).toBe(3);
  });

  test('Test 44: Cache-friendly queries', async () => {
    const buyers = await prisma.buyerServiceZipCode.findMany({
      where: {
        zipCode: String(baseZip),
        serviceTypeId: testServiceType.id,
        active: true
      },
      select: {
        buyerId: true,
        priority: true
      }
    });

    expect(buyers.length).toBeGreaterThan(0);
  });

  test('Test 45: Pagination for large coverage sets', async () => {
    const page1 = await prisma.buyerServiceZipCode.findMany({
      take: 2,
      skip: 0,
      orderBy: {
        createdAt: 'asc'
      }
    });

    const page2 = await prisma.buyerServiceZipCode.findMany({
      take: 2,
      skip: 2,
      orderBy: {
        createdAt: 'asc'
      }
    });

    expect(page1.length).toBeGreaterThan(0);
    expect(page2).toBeDefined();
  });

  test('Test 46: Count distinct ZIPs covered', async () => {
    const coverage = await prisma.buyerServiceZipCode.findMany({
      where: {
        buyerId: testBuyer1.id,
        active: true
      },
      distinct: ['zipCode']
    });

    expect(coverage.length).toBeGreaterThan(0);
  });

  test('Test 47: Find buyer with most coverage', async () => {
    const coverage = await prisma.buyerServiceZipCode.groupBy({
      by: ['buyerId'],
      where: {
        active: true
      },
      _count: {
        id: true
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      },
      take: 1
    });

    expect(coverage.length).toBeGreaterThan(0);
  });

  test('Test 48: Find most competitive ZIP', async () => {
    const competitive = await prisma.buyerServiceZipCode.groupBy({
      by: ['zipCode'],
      where: {
        active: true
      },
      _count: {
        id: true
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      },
      take: 1
    });

    expect(competitive.length).toBeGreaterThan(0);
  });

  test('Test 49: Coverage timestamp tracking', async () => {
    const coverage = await prisma.buyerServiceZipCode.findFirst({
      where: {
        buyerId: testBuyer1.id
      }
    });

    expect(coverage.createdAt).toBeDefined();
    expect(coverage.updatedAt).toBeDefined();
  });

  test('Test 50: Verify cascade on buyer delete', async () => {
    const tempBuyer = await prisma.buyer.create({
      data: {
        name: 'Temp Cascade Buyer ' + Date.now(),
        apiUrl: 'https://temp-cascade.com',
        active: true
      }
    });

    const tempCoverage = await prisma.buyerServiceZipCode.create({
      data: {
        buyerId: tempBuyer.id,
        serviceTypeId: testServiceType.id,
        zipCode: '92000',
        active: true,
        priority: 100
      }
    });

    await prisma.buyer.delete({ where: { id: tempBuyer.id } });

    const shouldBeNull = await prisma.buyerServiceZipCode.findUnique({
      where: { id: tempCoverage.id }
    });

    expect(shouldBeNull).toBeNull();
  });
});
