const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

describe('Domain 3.4: Database Query Performance Testing', () => {

  let testBuyer;
  let testServiceType;

  beforeAll(async () => {
    // Create test data for performance tests
    testBuyer = await prisma.buyer.create({
      data: {
        name: 'Perf Test Buyer ' + Date.now(),
        apiUrl: 'https://perftest.com',
        active: true
      }
    });

    testServiceType = await prisma.serviceType.findFirst();
  });

  afterAll(async () => {
    // Cleanup
    if (testBuyer) {
      await prisma.buyer.delete({ where: { id: testBuyer.id } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  // Test 1: Index usage on Lead.status
  test('Test 1: Query by lead status should use index', async () => {
    const startTime = Date.now();

    const leads = await prisma.lead.findMany({
      where: { status: 'PENDING' },
      take: 100
    });

    const duration = Date.now() - startTime;

    // Should complete quickly (< 100ms)
    expect(duration).toBeLessThan(100);
  });

  // Test 2: Index usage on Lead.zipCode
  test('Test 2: Query by ZIP code should use index', async () => {
    const startTime = Date.now();

    const leads = await prisma.lead.findMany({
      where: { zipCode: '12345' },
      take: 100
    });

    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(100);
  });

  // Test 3: Index usage on Lead.createdAt
  test('Test 3: Query by created date should use index', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const startTime = Date.now();

    const leads = await prisma.lead.findMany({
      where: {
        createdAt: { gte: yesterday }
      },
      take: 100
    });

    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(100);
  });

  // Test 4: Query with joins performs acceptably
  test('Test 4: Query with service type join should be performant', async () => {
    const startTime = Date.now();

    const leads = await prisma.lead.findMany({
      include: {
        serviceType: true
      },
      take: 50
    });

    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(200);
  });

  // Test 5: Query with buyer join
  test('Test 5: Query with buyer join should be performant', async () => {
    const startTime = Date.now();

    const leads = await prisma.lead.findMany({
      where: {
        winningBuyerId: { not: null }
      },
      include: {
        winningBuyer: true
      },
      take: 50
    });

    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(200);
  });

  // Test 6: Query with transactions join
  test('Test 6: Query with transactions join should be performant', async () => {
    const startTime = Date.now();

    const leads = await prisma.lead.findMany({
      include: {
        transactions: true
      },
      take: 20
    });

    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(200);
  });

  // Test 7: Count query performance
  test('Test 7: Count queries should be fast', async () => {
    const startTime = Date.now();

    const count = await prisma.lead.count({
      where: { status: 'PENDING' }
    });

    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(50);
    expect(typeof count).toBe('number');
  });

  // Test 8: Aggregation query performance
  test('Test 8: Aggregation queries should be performant', async () => {
    const startTime = Date.now();

    const result = await prisma.lead.aggregate({
      _count: { id: true },
      where: { status: 'SOLD' }
    });

    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(100);
  });

  // Test 9: Pagination performance
  test('Test 9: Paginated queries should be efficient', async () => {
    const startTime = Date.now();

    const page1 = await prisma.lead.findMany({
      take: 20,
      skip: 0,
      orderBy: { createdAt: 'desc' }
    });

    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(100);
  });

  // Test 10: Sorting performance
  test('Test 10: Sorting queries should be fast', async () => {
    const startTime = Date.now();

    const leads = await prisma.lead.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(100);
  });

  // Test 11: Complex filter performance
  test('Test 11: Complex filter queries should be acceptable', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const startTime = Date.now();

    const leads = await prisma.lead.findMany({
      where: {
        AND: [
          { status: 'PENDING' },
          { createdAt: { gte: yesterday } },
          { ownsHome: true }
        ]
      },
      take: 50
    });

    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(150);
  });

  // Test 12: Full text search simulation performance
  test('Test 12: Text search queries should be reasonable', async () => {
    const startTime = Date.now();

    // Simulate text search on ZIP code (since we don't have full-text search)
    const leads = await prisma.lead.findMany({
      where: {
        zipCode: { startsWith: '12' }
      },
      take: 50
    });

    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(150);
  });

  // Test 13: Transaction list query performance
  test('Test 13: Transaction queries should be fast', async () => {
    const startTime = Date.now();

    const transactions = await prisma.transaction.findMany({
      where: { status: 'SUCCESS' },
      take: 100
    });

    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(100);
  });

  // Test 14: Transaction query with action type filter
  test('Test 14: Transaction queries by action type should use index', async () => {
    const startTime = Date.now();

    const transactions = await prisma.transaction.findMany({
      where: { actionType: 'PING' },
      take: 100
    });

    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(100);
  });

  // Test 15: Buyer service config lookup
  test('Test 15: Buyer service config lookups should be fast', async () => {
    const startTime = Date.now();

    const configs = await prisma.buyerServiceConfig.findMany({
      where: { buyerId: testBuyer.id },
      include: {
        buyer: true,
        serviceType: true
      }
    });

    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(100);
  });

  // Test 16: ZIP code queries with multiple filters
  test('Test 16: ZIP code queries should be performant', async () => {
    const startTime = Date.now();

    const zipCodes = await prisma.buyerServiceZipCode.findMany({
      where: {
        buyerId: testBuyer.id,
        active: true
      },
      take: 100
    });

    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(100);
  });

  // Test 17: Distinct query performance
  test('Test 17: Distinct queries should be acceptable', async () => {
    const startTime = Date.now();

    const distinctStatuses = await prisma.lead.findMany({
      select: { status: true },
      distinct: ['status']
    });

    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(150);
  });

  // Test 18: Group by simulation performance
  test('Test 18: Grouping operations should be reasonable', async () => {
    const startTime = Date.now();

    const grouped = await prisma.lead.groupBy({
      by: ['status'],
      _count: { id: true }
    });

    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(150);
  });

  // Test 19: Bulk read performance
  test('Test 19: Bulk read operations should scale', async () => {
    const startTime = Date.now();

    const leads = await prisma.lead.findMany({
      take: 200
    });

    const duration = Date.now() - startTime;

    // 200 records should load quickly
    expect(duration).toBeLessThan(250);
  });

  // Test 20: Nested include performance
  test('Test 20: Nested includes should be acceptable', async () => {
    const startTime = Date.now();

    const leads = await prisma.lead.findMany({
      include: {
        serviceType: true,
        winningBuyer: true,
        transactions: {
          take: 5
        }
      },
      take: 10
    });

    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(300);
  });

  // Test 21: Insert performance
  test('Test 21: Single insert should be fast', async () => {
    const startTime = Date.now();

    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '00001',
        ownsHome: true,
        timeframe: 'within_3_months'
      }
    });

    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(100);

    // Cleanup
    await prisma.lead.delete({ where: { id: lead.id } });
  });

  // Test 22: Update performance
  test('Test 22: Single update should be fast', async () => {
    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '00002',
        ownsHome: true,
        timeframe: 'within_3_months'
      }
    });

    const startTime = Date.now();

    await prisma.lead.update({
      where: { id: lead.id },
      data: { status: 'SOLD' }
    });

    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(100);

    // Cleanup
    await prisma.lead.delete({ where: { id: lead.id } });
  });

  // Test 23: Delete performance
  test('Test 23: Single delete should be fast', async () => {
    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '00003',
        ownsHome: true,
        timeframe: 'within_3_months'
      }
    });

    const startTime = Date.now();

    await prisma.lead.delete({ where: { id: lead.id } });

    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(100);
  });

  // Test 24: Bulk insert performance
  test('Test 24: Bulk insert should be efficient', async () => {
    const startTime = Date.now();

    await prisma.lead.createMany({
      data: Array.from({ length: 50 }, (_, i) => ({
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: `0000${i}`,
        ownsHome: true,
        timeframe: 'within_3_months'
      }))
    });

    const duration = Date.now() - startTime;

    // 50 inserts should complete reasonably fast
    expect(duration).toBeLessThan(500);

    // Cleanup
    await prisma.lead.deleteMany({
      where: {
        zipCode: { startsWith: '0000' }
      }
    });
  });

  // Test 25: Connection pooling efficiency
  test('Test 25: Multiple concurrent queries should handle well', async () => {
    const startTime = Date.now();

    await Promise.all([
      prisma.lead.count(),
      prisma.buyer.count(),
      prisma.serviceType.count(),
      prisma.transaction.count()
    ]);

    const duration = Date.now() - startTime;

    // 4 concurrent count queries should be fast
    expect(duration).toBeLessThan(200);
  });
});
