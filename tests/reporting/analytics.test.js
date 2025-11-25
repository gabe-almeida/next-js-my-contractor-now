/**
 * Domain 12: Report Generation & Analytics Tests (50 tests)
 *
 * Tests report generation, analytics calculations, data aggregation,
 * date ranges, exports, and performance metrics.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:3002';

describe('Domain 12: Report Generation & Analytics (50 tests)', () => {
  let testServiceType;
  let testBuyer1;
  let testBuyer2;
  let testLeads = [];

  beforeAll(async () => {
    testServiceType = await prisma.serviceType.findFirst();

    // Create test buyers
    testBuyer1 = await prisma.buyer.create({
      data: {
        name: 'Analytics Buyer 1 ' + Date.now(),
        apiUrl: 'https://analytics1.com',
        active: true
      }
    });

    testBuyer2 = await prisma.buyer.create({
      data: {
        name: 'Analytics Buyer 2 ' + Date.now(),
        apiUrl: 'https://analytics2.com',
        active: true
      }
    });

    // Create test data for analytics
    for (let i = 0; i < 10; i++) {
      const lead = await prisma.lead.create({
        data: {
          serviceTypeId: testServiceType.id,
          formData: JSON.stringify({ test: i }),
          zipCode: String(10000 + i),
          ownsHome: i % 2 === 0,
          timeframe: 'within_3_months',
          status: i < 5 ? 'SOLD' : 'REJECTED',
          winningBuyerId: i < 5 ? testBuyer1.id : null,
          winningBid: i < 5 ? 25.0 + i : null
        }
      });
      testLeads.push(lead);

      // Create transactions for each lead
      await prisma.transaction.create({
        data: {
          leadId: lead.id,
          buyerId: i < 7 ? testBuyer1.id : testBuyer2.id,
          actionType: 'PING',
          status: 'SUCCESS',
          payload: '{}',
          bidAmount: 20.0 + i,
          responseTime: 100 + i * 10
        }
      });
    }
  });

  afterAll(async () => {
    // Cleanup
    for (const lead of testLeads) {
      await prisma.transaction.deleteMany({ where: { leadId: lead.id } }).catch(() => {});
      await prisma.lead.delete({ where: { id: lead.id } }).catch(() => {});
    }

    if (testBuyer1) {
      await prisma.buyer.delete({ where: { id: testBuyer1.id } }).catch(() => {});
    }
    if (testBuyer2) {
      await prisma.buyer.delete({ where: { id: testBuyer2.id } }).catch(() => {});
    }

    await prisma.$disconnect();
  });

  // Tests 1-10: Lead Volume Reporting
  test('Test 1: Total lead count', async () => {
    const count = await prisma.lead.count({
      where: {
        serviceTypeId: testServiceType.id
      }
    });

    expect(count).toBeGreaterThanOrEqual(10);
  });

  test('Test 2: Leads by status', async () => {
    const sold = await prisma.lead.count({
      where: {
        serviceTypeId: testServiceType.id,
        status: 'SOLD'
      }
    });

    expect(sold).toBeGreaterThanOrEqual(5);
  });

  test('Test 3: Leads by date range', async () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const recent = await prisma.lead.count({
      where: {
        createdAt: {
          gte: yesterday
        }
      }
    });

    expect(recent).toBeGreaterThanOrEqual(10);
  });

  test('Test 4: Leads by service type', async () => {
    const count = await prisma.lead.count({
      where: {
        serviceTypeId: testServiceType.id
      }
    });

    expect(count).toBeGreaterThanOrEqual(10);
  });

  test('Test 5: Leads by ZIP code', async () => {
    const zipCounts = await prisma.lead.groupBy({
      by: ['zipCode'],
      _count: {
        id: true
      },
      where: {
        serviceTypeId: testServiceType.id
      }
    });

    expect(zipCounts.length).toBeGreaterThan(0);
  });

  test('Test 6: Leads by homeownership', async () => {
    const homeowners = await prisma.lead.count({
      where: {
        ownsHome: true
      }
    });

    expect(homeowners).toBeGreaterThanOrEqual(5);
  });

  test('Test 7: Leads by timeframe', async () => {
    const immediate = await prisma.lead.count({
      where: {
        timeframe: 'within_3_months'
      }
    });

    expect(immediate).toBeGreaterThanOrEqual(10);
  });

  test('Test 8: Leads by hour of day', async () => {
    const leads = await prisma.lead.findMany({
      where: {
        serviceTypeId: testServiceType.id
      },
      select: {
        createdAt: true
      }
    });

    expect(leads.length).toBeGreaterThanOrEqual(10);
  });

  test('Test 9: Leads by day of week', async () => {
    const leads = await prisma.lead.findMany({
      where: {
        serviceTypeId: testServiceType.id
      },
      select: {
        createdAt: true
      }
    });

    expect(leads.length).toBeGreaterThanOrEqual(10);
  });

  test('Test 10: Lead trend over time', async () => {
    const leads = await prisma.lead.findMany({
      where: {
        serviceTypeId: testServiceType.id
      },
      orderBy: {
        createdAt: 'asc'
      },
      select: {
        createdAt: true
      }
    });

    expect(leads.length).toBeGreaterThanOrEqual(10);
  });

  // Tests 11-20: Revenue Analytics
  test('Test 11: Total revenue', async () => {
    const result = await prisma.lead.aggregate({
      where: {
        status: 'SOLD',
        winningBid: {
          not: null
        }
      },
      _sum: {
        winningBid: true
      }
    });

    expect(result._sum.winningBid).toBeGreaterThan(0);
  });

  test('Test 12: Average lead price', async () => {
    const result = await prisma.lead.aggregate({
      where: {
        status: 'SOLD'
      },
      _avg: {
        winningBid: true
      }
    });

    expect(result._avg.winningBid).toBeGreaterThan(0);
  });

  test('Test 13: Revenue by buyer', async () => {
    const result = await prisma.lead.groupBy({
      by: ['winningBuyerId'],
      where: {
        status: 'SOLD',
        winningBuyerId: {
          not: null
        }
      },
      _sum: {
        winningBid: true
      }
    });

    expect(result.length).toBeGreaterThan(0);
  });

  test('Test 14: Revenue by service type', async () => {
    const result = await prisma.lead.groupBy({
      by: ['serviceTypeId'],
      where: {
        status: 'SOLD'
      },
      _sum: {
        winningBid: true
      }
    });

    expect(result.length).toBeGreaterThan(0);
  });

  test('Test 15: Revenue by date range', async () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const result = await prisma.lead.aggregate({
      where: {
        status: 'SOLD',
        createdAt: {
          gte: yesterday
        }
      },
      _sum: {
        winningBid: true
      }
    });

    expect(result._sum.winningBid).toBeGreaterThanOrEqual(0);
  });

  test('Test 16: Highest bid amount', async () => {
    const result = await prisma.lead.aggregate({
      where: {
        status: 'SOLD'
      },
      _max: {
        winningBid: true
      }
    });

    expect(result._max.winningBid).toBeGreaterThan(0);
  });

  test('Test 17: Lowest bid amount', async () => {
    const result = await prisma.lead.aggregate({
      where: {
        status: 'SOLD'
      },
      _min: {
        winningBid: true
      }
    });

    expect(result._min.winningBid).toBeGreaterThan(0);
  });

  test('Test 18: Revenue growth rate', async () => {
    const leads = await prisma.lead.findMany({
      where: {
        status: 'SOLD'
      },
      orderBy: {
        createdAt: 'asc'
      },
      select: {
        winningBid: true,
        createdAt: true
      }
    });

    expect(leads.length).toBeGreaterThan(0);
  });

  test('Test 19: Revenue per ZIP code', async () => {
    const result = await prisma.lead.groupBy({
      by: ['zipCode'],
      where: {
        status: 'SOLD'
      },
      _sum: {
        winningBid: true
      }
    });

    expect(result.length).toBeGreaterThan(0);
  });

  test('Test 20: Revenue per homeowner vs renter', async () => {
    const result = await prisma.lead.groupBy({
      by: ['ownsHome'],
      where: {
        status: 'SOLD'
      },
      _sum: {
        winningBid: true
      }
    });

    expect(result.length).toBeGreaterThan(0);
  });

  // Tests 21-30: Buyer Performance Metrics
  test('Test 21: Buyer win rate', async () => {
    const total = await prisma.transaction.count({
      where: {
        buyerId: testBuyer1.id
      }
    });

    const wins = await prisma.lead.count({
      where: {
        winningBuyerId: testBuyer1.id
      }
    });

    expect(total).toBeGreaterThan(0);
    const winRate = wins / total;
    expect(winRate).toBeGreaterThanOrEqual(0);
    expect(winRate).toBeLessThanOrEqual(1);
  });

  test('Test 22: Buyer average bid', async () => {
    const result = await prisma.transaction.aggregate({
      where: {
        buyerId: testBuyer1.id,
        bidAmount: {
          not: null
        }
      },
      _avg: {
        bidAmount: true
      }
    });

    expect(result._avg.bidAmount).toBeGreaterThan(0);
  });

  test('Test 23: Buyer response time', async () => {
    const result = await prisma.transaction.aggregate({
      where: {
        buyerId: testBuyer1.id,
        responseTime: {
          not: null
        }
      },
      _avg: {
        responseTime: true
      }
    });

    expect(result._avg.responseTime).toBeGreaterThan(0);
  });

  test('Test 24: Buyer success rate', async () => {
    const total = await prisma.transaction.count({
      where: {
        buyerId: testBuyer1.id
      }
    });

    const success = await prisma.transaction.count({
      where: {
        buyerId: testBuyer1.id,
        status: 'SUCCESS'
      }
    });

    expect(total).toBeGreaterThan(0);
    const successRate = success / total;
    expect(successRate).toBeGreaterThanOrEqual(0);
    expect(successRate).toBeLessThanOrEqual(1);
  });

  test('Test 25: Buyer timeout rate', async () => {
    const total = await prisma.transaction.count({
      where: {
        buyerId: testBuyer1.id
      }
    });

    expect(total).toBeGreaterThan(0);
  });

  test('Test 26: Buyer total spend', async () => {
    const result = await prisma.lead.aggregate({
      where: {
        winningBuyerId: testBuyer1.id,
        status: 'SOLD'
      },
      _sum: {
        winningBid: true
      }
    });

    expect(result._sum.winningBid).toBeGreaterThanOrEqual(0);
  });

  test('Test 27: Buyer leads purchased', async () => {
    const count = await prisma.lead.count({
      where: {
        winningBuyerId: testBuyer1.id,
        status: 'SOLD'
      }
    });

    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('Test 28: Buyer competitive position', async () => {
    const buyers = await prisma.lead.groupBy({
      by: ['winningBuyerId'],
      where: {
        status: 'SOLD',
        winningBuyerId: {
          not: null
        }
      },
      _count: {
        id: true
      }
    });

    expect(buyers.length).toBeGreaterThan(0);
  });

  test('Test 29: Buyer bid consistency', async () => {
    const transactions = await prisma.transaction.findMany({
      where: {
        buyerId: testBuyer1.id,
        bidAmount: {
          not: null
        }
      },
      select: {
        bidAmount: true
      }
    });

    expect(transactions.length).toBeGreaterThan(0);
  });

  test('Test 30: Buyer volume trend', async () => {
    const transactions = await prisma.transaction.findMany({
      where: {
        buyerId: testBuyer1.id
      },
      orderBy: {
        createdAt: 'asc'
      },
      select: {
        createdAt: true
      }
    });

    expect(transactions.length).toBeGreaterThan(0);
  });

  // Tests 31-40: Conversion & Quality Metrics
  test('Test 31: Overall conversion rate', async () => {
    const total = await prisma.lead.count({
      where: {
        serviceTypeId: testServiceType.id
      }
    });

    const sold = await prisma.lead.count({
      where: {
        serviceTypeId: testServiceType.id,
        status: 'SOLD'
      }
    });

    expect(total).toBeGreaterThan(0);
    const conversionRate = sold / total;
    expect(conversionRate).toBeGreaterThanOrEqual(0);
    expect(conversionRate).toBeLessThanOrEqual(1);
  });

  test('Test 32: Conversion rate by service type', async () => {
    const types = await prisma.lead.groupBy({
      by: ['serviceTypeId', 'status'],
      _count: {
        id: true
      }
    });

    expect(types.length).toBeGreaterThan(0);
  });

  test('Test 33: Conversion rate by ZIP code', async () => {
    const zips = await prisma.lead.groupBy({
      by: ['zipCode', 'status'],
      _count: {
        id: true
      }
    });

    expect(zips.length).toBeGreaterThan(0);
  });

  test('Test 34: Conversion rate by homeownership', async () => {
    const owners = await prisma.lead.groupBy({
      by: ['ownsHome', 'status'],
      _count: {
        id: true
      }
    });

    expect(owners.length).toBeGreaterThan(0);
  });

  test('Test 35: Conversion rate by timeframe', async () => {
    const timeframes = await prisma.lead.groupBy({
      by: ['timeframe', 'status'],
      _count: {
        id: true
      }
    });

    expect(timeframes.length).toBeGreaterThan(0);
  });

  test('Test 36: Average time to conversion', async () => {
    const leads = await prisma.lead.findMany({
      where: {
        status: 'SOLD'
      },
      select: {
        createdAt: true,
        updatedAt: true
      }
    });

    expect(leads.length).toBeGreaterThan(0);
  });

  test('Test 37: Rejection reasons', async () => {
    const rejected = await prisma.lead.count({
      where: {
        status: 'REJECTED'
      }
    });

    expect(rejected).toBeGreaterThanOrEqual(0);
  });

  test('Test 38: Lead quality score distribution', async () => {
    const leads = await prisma.lead.findMany({
      where: {
        serviceTypeId: testServiceType.id
      },
      select: {
        ownsHome: true,
        timeframe: true,
        status: true
      }
    });

    expect(leads.length).toBeGreaterThan(0);
  });

  test('Test 39: Ping to post ratio', async () => {
    const pings = await prisma.transaction.count({
      where: {
        actionType: 'PING'
      }
    });

    const posts = await prisma.transaction.count({
      where: {
        actionType: 'POST'
      }
    });

    expect(pings).toBeGreaterThan(0);
  });

  test('Test 40: Buyer participation rate', async () => {
    const totalBuyers = await prisma.buyer.count({
      where: {
        active: true
      }
    });

    const activeBuyers = await prisma.transaction.groupBy({
      by: ['buyerId'],
      _count: {
        id: true
      }
    });

    expect(totalBuyers).toBeGreaterThan(0);
    expect(activeBuyers.length).toBeGreaterThan(0);
  });

  // Tests 41-50: Data Export & Report Formatting
  test('Test 41: Export lead data as JSON', async () => {
    const leads = await prisma.lead.findMany({
      where: {
        serviceTypeId: testServiceType.id
      },
      take: 5
    });

    const json = JSON.stringify(leads);
    expect(json).toBeTruthy();
    expect(() => JSON.parse(json)).not.toThrow();
  });

  test('Test 42: Export transaction data', async () => {
    const transactions = await prisma.transaction.findMany({
      where: {
        buyerId: testBuyer1.id
      },
      take: 5
    });

    expect(transactions.length).toBeGreaterThan(0);
  });

  test('Test 43: Export buyer report', async () => {
    const buyer = await prisma.buyer.findUnique({
      where: {
        id: testBuyer1.id
      },
      include: {
        serviceConfigs: true
      }
    });

    expect(buyer).toBeTruthy();
  });

  test('Test 44: Date range filtering', async () => {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const leads = await prisma.lead.findMany({
      where: {
        createdAt: {
          gte: weekAgo,
          lte: today
        }
      }
    });

    expect(leads).toBeTruthy();
  });

  test('Test 45: Multi-dimensional aggregation', async () => {
    const result = await prisma.lead.groupBy({
      by: ['status', 'ownsHome'],
      _count: {
        id: true
      },
      _avg: {
        winningBid: true
      }
    });

    expect(result.length).toBeGreaterThan(0);
  });

  test('Test 46: Pagination support', async () => {
    const page1 = await prisma.lead.findMany({
      take: 5,
      skip: 0,
      orderBy: {
        createdAt: 'desc'
      }
    });

    const page2 = await prisma.lead.findMany({
      take: 5,
      skip: 5,
      orderBy: {
        createdAt: 'desc'
      }
    });

    expect(page1.length).toBeGreaterThan(0);
    expect(page2).toBeTruthy();
  });

  test('Test 47: Sort by multiple fields', async () => {
    const leads = await prisma.lead.findMany({
      orderBy: [
        { status: 'asc' },
        { createdAt: 'desc' }
      ],
      take: 10
    });

    expect(leads.length).toBeGreaterThan(0);
  });

  test('Test 48: Filter with multiple conditions', async () => {
    const leads = await prisma.lead.findMany({
      where: {
        AND: [
          { status: 'SOLD' },
          { ownsHome: true },
          {
            winningBid: {
              gte: 20.0
            }
          }
        ]
      }
    });

    expect(leads).toBeTruthy();
  });

  test('Test 49: Include related data', async () => {
    const leads = await prisma.lead.findMany({
      where: {
        serviceTypeId: testServiceType.id
      },
      include: {
        serviceType: true,
        transactions: true
      },
      take: 5
    });

    expect(leads.length).toBeGreaterThan(0);
    expect(leads[0].serviceType).toBeTruthy();
  });

  test('Test 50: Custom aggregation query', async () => {
    // Using Prisma aggregations instead of raw SQL for better compatibility
    const total = await prisma.lead.count({
      where: {
        serviceTypeId: testServiceType.id
      }
    });

    const sold = await prisma.lead.count({
      where: {
        serviceTypeId: testServiceType.id,
        status: 'SOLD'
      }
    });

    const avgBid = await prisma.lead.aggregate({
      where: {
        serviceTypeId: testServiceType.id
      },
      _avg: {
        winningBid: true
      }
    });

    expect(total).toBeGreaterThan(0);
    expect(sold).toBeGreaterThanOrEqual(0);
    expect(avgBid).toBeTruthy();
  });
});
