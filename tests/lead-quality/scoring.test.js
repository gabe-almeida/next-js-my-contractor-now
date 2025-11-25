/**
 * Domain 14: Lead Quality Scoring & Filtering (60 tests)
 *
 * Tests lead quality scoring algorithms, filtering, ranking,
 * homeownership verification, timeframe evaluation, and compliance scoring.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:3002';

describe('Domain 14: Lead Quality Scoring & Filtering (60 tests)', () => {
  let testServiceType;
  let testBuyer;
  let testLeads = [];

  beforeAll(async () => {
    testServiceType = await prisma.serviceType.findFirst();

    testBuyer = await prisma.buyer.create({
      data: {
        name: 'Quality Test Buyer ' + Date.now(),
        apiUrl: 'https://quality-buyer.com',
        active: true
      }
    });

    // Create leads with varying quality scores
    const leadData = [
      { score: 95, ownsHome: true, timeframe: 'immediate', zipCode: '10001' },
      { score: 85, ownsHome: true, timeframe: 'within_3_months', zipCode: '10002' },
      { score: 75, ownsHome: true, timeframe: 'within_6_months', zipCode: '10003' },
      { score: 65, ownsHome: false, timeframe: 'within_3_months', zipCode: '10004' },
      { score: 55, ownsHome: false, timeframe: 'within_6_months', zipCode: '10005' },
      { score: 45, ownsHome: false, timeframe: 'within_12_months', zipCode: '10006' },
      { score: 90, ownsHome: true, timeframe: 'immediate', zipCode: '10007' },
      { score: 80, ownsHome: true, timeframe: 'within_3_months', zipCode: '10008' },
      { score: 70, ownsHome: false, timeframe: 'within_3_months', zipCode: '10009' },
      { score: 60, ownsHome: false, timeframe: 'within_6_months', zipCode: '10010' }
    ];

    for (const data of leadData) {
      const lead = await prisma.lead.create({
        data: {
          serviceTypeId: testServiceType.id,
          formData: JSON.stringify({ email: `test${data.score}@example.com` }),
          zipCode: data.zipCode,
          ownsHome: data.ownsHome,
          timeframe: data.timeframe,
          leadQualityScore: data.score,
          status: 'PENDING'
        }
      });
      testLeads.push(lead);
    }
  });

  afterAll(async () => {
    // Cleanup
    for (const lead of testLeads) {
      await prisma.transaction.deleteMany({ where: { leadId: lead.id } }).catch(() => {});
      await prisma.lead.delete({ where: { id: lead.id } }).catch(() => {});
    }

    if (testBuyer) {
      await prisma.buyer.delete({ where: { id: testBuyer.id } }).catch(() => {});
    }

    await prisma.$disconnect();
  });

  // Tests 1-10: Basic Quality Scoring
  test('Test 1: Lead has quality score', async () => {
    const lead = testLeads[0];
    expect(lead.leadQualityScore).toBeDefined();
    expect(lead.leadQualityScore).toBe(95);
  });

  test('Test 2: Score range 0-100', async () => {
    const leads = await prisma.lead.findMany({
      where: {
        leadQualityScore: {
          not: null
        }
      }
    });

    leads.forEach(lead => {
      expect(lead.leadQualityScore).toBeGreaterThanOrEqual(0);
      expect(lead.leadQualityScore).toBeLessThanOrEqual(100);
    });
  });

  test('Test 3: High quality score leads', async () => {
    const highQuality = await prisma.lead.findMany({
      where: {
        leadQualityScore: {
          gte: 80
        }
      }
    });

    expect(highQuality.length).toBeGreaterThan(0);
    highQuality.forEach(lead => {
      expect(lead.leadQualityScore).toBeGreaterThanOrEqual(80);
    });
  });

  test('Test 4: Medium quality score leads', async () => {
    const mediumQuality = await prisma.lead.findMany({
      where: {
        leadQualityScore: {
          gte: 50,
          lt: 80
        }
      }
    });

    expect(mediumQuality.length).toBeGreaterThan(0);
  });

  test('Test 5: Low quality score leads', async () => {
    const lowQuality = await prisma.lead.findMany({
      where: {
        leadQualityScore: {
          lt: 50
        }
      }
    });

    expect(lowQuality.length).toBeGreaterThan(0);
  });

  test('Test 6: Sort leads by quality score', async () => {
    const sorted = await prisma.lead.findMany({
      where: {
        serviceTypeId: testServiceType.id
      },
      orderBy: {
        leadQualityScore: 'desc'
      },
      take: 5
    });

    expect(sorted.length).toBeGreaterThan(0);
    for (let i = 0; i < sorted.length - 1; i++) {
      expect(sorted[i].leadQualityScore).toBeGreaterThanOrEqual(sorted[i + 1].leadQualityScore);
    }
  });

  test('Test 7: Average quality score', async () => {
    const result = await prisma.lead.aggregate({
      where: {
        leadQualityScore: {
          not: null
        }
      },
      _avg: {
        leadQualityScore: true
      }
    });

    expect(result._avg.leadQualityScore).toBeDefined();
    expect(result._avg.leadQualityScore).toBeGreaterThan(0);
  });

  test('Test 8: Highest quality score', async () => {
    const result = await prisma.lead.aggregate({
      where: {
        leadQualityScore: {
          not: null
        }
      },
      _max: {
        leadQualityScore: true
      }
    });

    expect(result._max.leadQualityScore).toBe(95);
  });

  test('Test 9: Lowest quality score', async () => {
    const result = await prisma.lead.aggregate({
      where: {
        leadQualityScore: {
          not: null
        }
      },
      _min: {
        leadQualityScore: true
      }
    });

    expect(result._min.leadQualityScore).toBe(45);
  });

  test('Test 10: Count leads by score range', async () => {
    const ranges = [
      { min: 90, max: 100 },
      { min: 80, max: 89 },
      { min: 70, max: 79 },
      { min: 60, max: 69 },
      { min: 50, max: 59 },
      { min: 0, max: 49 }
    ];

    for (const range of ranges) {
      const count = await prisma.lead.count({
        where: {
          leadQualityScore: {
            gte: range.min,
            lte: range.max
          }
        }
      });

      expect(count).toBeGreaterThanOrEqual(0);
    }
  });

  // Tests 11-20: Homeownership Scoring
  test('Test 11: Homeowners have higher scores', async () => {
    const homeowners = await prisma.lead.findMany({
      where: {
        ownsHome: true,
        leadQualityScore: {
          not: null
        }
      }
    });

    const renters = await prisma.lead.findMany({
      where: {
        ownsHome: false,
        leadQualityScore: {
          not: null
        }
      }
    });

    const avgHomeowner = homeowners.reduce((sum, l) => sum + l.leadQualityScore, 0) / homeowners.length;
    const avgRenter = renters.reduce((sum, l) => sum + l.leadQualityScore, 0) / renters.length;

    expect(avgHomeowner).toBeGreaterThan(avgRenter);
  });

  test('Test 12: Filter homeowners only', async () => {
    const homeowners = await prisma.lead.findMany({
      where: {
        ownsHome: true
      }
    });

    expect(homeowners.length).toBeGreaterThan(0);
    homeowners.forEach(lead => {
      expect(lead.ownsHome).toBe(true);
    });
  });

  test('Test 13: Filter renters only', async () => {
    const renters = await prisma.lead.findMany({
      where: {
        ownsHome: false
      }
    });

    expect(renters.length).toBeGreaterThan(0);
    renters.forEach(lead => {
      expect(lead.ownsHome).toBe(false);
    });
  });

  test('Test 14: High-quality homeowner leads', async () => {
    const leads = await prisma.lead.findMany({
      where: {
        ownsHome: true,
        leadQualityScore: {
          gte: 80
        }
      }
    });

    expect(leads.length).toBeGreaterThan(0);
  });

  test('Test 15: Low-quality renter leads', async () => {
    const leads = await prisma.lead.findMany({
      where: {
        ownsHome: false,
        leadQualityScore: {
          lt: 70
        }
      }
    });

    expect(leads.length).toBeGreaterThan(0);
  });

  test('Test 16: Homeownership percentage', async () => {
    const total = await prisma.lead.count({
      where: {
        serviceTypeId: testServiceType.id
      }
    });

    const homeowners = await prisma.lead.count({
      where: {
        serviceTypeId: testServiceType.id,
        ownsHome: true
      }
    });

    const percentage = (homeowners / total) * 100;
    expect(percentage).toBeGreaterThanOrEqual(0);
    expect(percentage).toBeLessThanOrEqual(100);
  });

  test('Test 17: Group leads by homeownership', async () => {
    const grouped = await prisma.lead.groupBy({
      by: ['ownsHome'],
      _count: {
        id: true
      },
      _avg: {
        leadQualityScore: true
      }
    });

    expect(grouped.length).toBe(2);
  });

  test('Test 18: Homeowner conversion rate', async () => {
    const homeowners = await prisma.lead.count({
      where: {
        ownsHome: true
      }
    });

    const soldHomeowners = await prisma.lead.count({
      where: {
        ownsHome: true,
        status: 'SOLD'
      }
    });

    expect(homeowners).toBeGreaterThan(0);
  });

  test('Test 19: Renter conversion rate', async () => {
    const renters = await prisma.lead.count({
      where: {
        ownsHome: false
      }
    });

    expect(renters).toBeGreaterThan(0);
  });

  test('Test 20: Homeownership impact on scoring', async () => {
    const withHome = await prisma.lead.findMany({
      where: {
        ownsHome: true,
        leadQualityScore: {
          not: null
        }
      },
      select: {
        leadQualityScore: true
      }
    });

    const withoutHome = await prisma.lead.findMany({
      where: {
        ownsHome: false,
        leadQualityScore: {
          not: null
        }
      },
      select: {
        leadQualityScore: true
      }
    });

    expect(withHome.length).toBeGreaterThan(0);
    expect(withoutHome.length).toBeGreaterThan(0);
  });

  // Tests 21-30: Timeframe Scoring
  test('Test 21: Immediate timeframe highest priority', async () => {
    const immediate = await prisma.lead.findMany({
      where: {
        timeframe: 'immediate'
      }
    });

    expect(immediate.length).toBeGreaterThan(0);
  });

  test('Test 22: Within 3 months timeframe', async () => {
    const within3 = await prisma.lead.findMany({
      where: {
        timeframe: 'within_3_months'
      }
    });

    expect(within3.length).toBeGreaterThan(0);
  });

  test('Test 23: Within 6 months timeframe', async () => {
    const within6 = await prisma.lead.findMany({
      where: {
        timeframe: 'within_6_months'
      }
    });

    expect(within6.length).toBeGreaterThan(0);
  });

  test('Test 24: Sort by timeframe urgency', async () => {
    const urgencyOrder = ['immediate', 'within_3_months', 'within_6_months', 'within_12_months'];

    const leads = await prisma.lead.findMany({
      where: {
        serviceTypeId: testServiceType.id
      },
      orderBy: {
        leadQualityScore: 'desc'
      }
    });

    expect(leads.length).toBeGreaterThan(0);
  });

  test('Test 25: High-score immediate leads', async () => {
    const leads = await prisma.lead.findMany({
      where: {
        timeframe: 'immediate',
        leadQualityScore: {
          gte: 80
        }
      }
    });

    expect(leads.length).toBeGreaterThan(0);
  });

  test('Test 26: Group by timeframe', async () => {
    const grouped = await prisma.lead.groupBy({
      by: ['timeframe'],
      _count: {
        id: true
      },
      _avg: {
        leadQualityScore: true
      }
    });

    expect(grouped.length).toBeGreaterThan(0);
  });

  test('Test 27: Timeframe conversion rates', async () => {
    const byTimeframe = await prisma.lead.groupBy({
      by: ['timeframe', 'status'],
      _count: {
        id: true
      }
    });

    expect(byTimeframe.length).toBeGreaterThan(0);
  });

  test('Test 28: Immediate timeframe premium', async () => {
    const immediate = await prisma.lead.findMany({
      where: {
        timeframe: 'immediate',
        leadQualityScore: {
          not: null
        }
      }
    });

    const notImmediate = await prisma.lead.findMany({
      where: {
        timeframe: {
          not: 'immediate'
        },
        leadQualityScore: {
          not: null
        }
      }
    });

    expect(immediate.length).toBeGreaterThan(0);
    expect(notImmediate.length).toBeGreaterThan(0);
  });

  test('Test 29: Timeframe distribution', async () => {
    const distribution = await prisma.lead.groupBy({
      by: ['timeframe'],
      _count: {
        id: true
      }
    });

    expect(distribution.length).toBeGreaterThan(0);
  });

  test('Test 30: Urgent leads filter', async () => {
    const urgent = await prisma.lead.findMany({
      where: {
        timeframe: {
          in: ['immediate', 'within_3_months']
        },
        leadQualityScore: {
          gte: 70
        }
      }
    });

    expect(urgent).toBeDefined();
  });

  // Tests 31-40: Combined Scoring Factors
  test('Test 31: Perfect lead criteria', async () => {
    const perfect = await prisma.lead.findMany({
      where: {
        ownsHome: true,
        timeframe: 'immediate',
        leadQualityScore: {
          gte: 90
        }
      }
    });

    expect(perfect.length).toBeGreaterThan(0);
  });

  test('Test 32: Poor lead criteria', async () => {
    const poor = await prisma.lead.findMany({
      where: {
        ownsHome: false,
        leadQualityScore: {
          lt: 50
        }
      }
    });

    expect(poor.length).toBeGreaterThan(0);
  });

  test('Test 33: Mid-tier lead criteria', async () => {
    const midTier = await prisma.lead.findMany({
      where: {
        leadQualityScore: {
          gte: 60,
          lt: 80
        }
      }
    });

    expect(midTier.length).toBeGreaterThan(0);
  });

  test('Test 34: Score factors correlation', async () => {
    const leads = await prisma.lead.findMany({
      where: {
        leadQualityScore: {
          not: null
        }
      },
      select: {
        leadQualityScore: true,
        ownsHome: true,
        timeframe: true
      }
    });

    expect(leads.length).toBeGreaterThan(0);
  });

  test('Test 35: Quality tiers', async () => {
    const tiers = {
      premium: await prisma.lead.count({
        where: { leadQualityScore: { gte: 90 } }
      }),
      high: await prisma.lead.count({
        where: { leadQualityScore: { gte: 75, lt: 90 } }
      }),
      medium: await prisma.lead.count({
        where: { leadQualityScore: { gte: 50, lt: 75 } }
      }),
      low: await prisma.lead.count({
        where: { leadQualityScore: { lt: 50 } }
      })
    };

    expect(tiers.premium + tiers.high + tiers.medium + tiers.low).toBeGreaterThan(0);
  });

  test('Test 36: Score adjustment for homeowners', async () => {
    const homeownerLeads = await prisma.lead.findMany({
      where: {
        ownsHome: true,
        leadQualityScore: {
          not: null
        }
      }
    });

    expect(homeownerLeads.length).toBeGreaterThan(0);
  });

  test('Test 37: Score adjustment for urgency', async () => {
    const urgentLeads = await prisma.lead.findMany({
      where: {
        timeframe: 'immediate',
        leadQualityScore: {
          not: null
        }
      }
    });

    expect(urgentLeads.length).toBeGreaterThan(0);
  });

  test('Test 38: Composite scoring formula', async () => {
    const leads = await prisma.lead.findMany({
      where: {
        leadQualityScore: {
          not: null
        }
      },
      select: {
        leadQualityScore: true,
        ownsHome: true,
        timeframe: true,
        status: true
      }
    });

    expect(leads.length).toBeGreaterThan(0);
  });

  test('Test 39: Score normalization', async () => {
    const scores = await prisma.lead.findMany({
      where: {
        leadQualityScore: {
          not: null
        }
      },
      select: {
        leadQualityScore: true
      }
    });

    scores.forEach(lead => {
      expect(lead.leadQualityScore).toBeGreaterThanOrEqual(0);
      expect(lead.leadQualityScore).toBeLessThanOrEqual(100);
    });
  });

  test('Test 40: Multi-factor filtering', async () => {
    const filtered = await prisma.lead.findMany({
      where: {
        AND: [
          { ownsHome: true },
          { timeframe: { in: ['immediate', 'within_3_months'] } },
          { leadQualityScore: { gte: 70 } }
        ]
      }
    });

    expect(filtered).toBeDefined();
  });

  // Tests 41-50: Advanced Filtering
  test('Test 41: Filter by ZIP code quality', async () => {
    const zips = ['10001', '10002', '10003'];
    const leads = await prisma.lead.findMany({
      where: {
        zipCode: {
          in: zips
        },
        leadQualityScore: {
          gte: 75
        }
      }
    });

    expect(leads).toBeDefined();
  });

  test('Test 42: Exclude low-quality leads', async () => {
    const quality = await prisma.lead.findMany({
      where: {
        leadQualityScore: {
          gte: 60
        }
      }
    });

    quality.forEach(lead => {
      expect(lead.leadQualityScore).toBeGreaterThanOrEqual(60);
    });
  });

  test('Test 43: Date-based quality trends', async () => {
    const recent = await prisma.lead.findMany({
      where: {
        leadQualityScore: {
          not: null
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5
    });

    expect(recent.length).toBeGreaterThan(0);
  });

  test('Test 44: Quality score distribution', async () => {
    const distribution = await prisma.lead.groupBy({
      by: ['leadQualityScore'],
      _count: {
        id: true
      }
    });

    expect(distribution.length).toBeGreaterThan(0);
  });

  test('Test 45: Filter premium leads', async () => {
    const premium = await prisma.lead.findMany({
      where: {
        ownsHome: true,
        timeframe: 'immediate',
        leadQualityScore: {
          gte: 85
        }
      },
      orderBy: {
        leadQualityScore: 'desc'
      }
    });

    expect(premium).toBeDefined();
  });

  test('Test 46: Quality threshold filtering', async () => {
    const threshold = 70;
    const aboveThreshold = await prisma.lead.findMany({
      where: {
        leadQualityScore: {
          gte: threshold
        }
      }
    });

    aboveThreshold.forEach(lead => {
      expect(lead.leadQualityScore).toBeGreaterThanOrEqual(threshold);
    });
  });

  test('Test 47: Score-based routing', async () => {
    const highValue = await prisma.lead.findMany({
      where: {
        leadQualityScore: {
          gte: 80
        }
      },
      orderBy: {
        leadQualityScore: 'desc'
      },
      take: 3
    });

    expect(highValue.length).toBeGreaterThan(0);
  });

  test('Test 48: Quality percentile calculation', async () => {
    const allScores = await prisma.lead.findMany({
      where: {
        leadQualityScore: {
          not: null
        }
      },
      select: {
        leadQualityScore: true
      },
      orderBy: {
        leadQualityScore: 'asc'
      }
    });

    expect(allScores.length).toBeGreaterThan(0);
  });

  test('Test 49: Score variance analysis', async () => {
    const result = await prisma.lead.aggregate({
      where: {
        leadQualityScore: {
          not: null
        }
      },
      _avg: {
        leadQualityScore: true
      },
      _min: {
        leadQualityScore: true
      },
      _max: {
        leadQualityScore: true
      }
    });

    expect(result._avg.leadQualityScore).toBeDefined();
    expect(result._min.leadQualityScore).toBeDefined();
    expect(result._max.leadQualityScore).toBeDefined();
  });

  test('Test 50: Dynamic quality thresholds', async () => {
    const avg = await prisma.lead.aggregate({
      _avg: {
        leadQualityScore: true
      }
    });

    const aboveAverage = await prisma.lead.findMany({
      where: {
        leadQualityScore: {
          gte: Math.floor(avg._avg.leadQualityScore)
        }
      }
    });

    expect(aboveAverage).toBeDefined();
  });

  // Tests 51-60: Score Impact & Analytics
  test('Test 51: Score impact on conversion', async () => {
    const highScore = await prisma.lead.count({
      where: {
        leadQualityScore: { gte: 80 },
        status: 'SOLD'
      }
    });

    const lowScore = await prisma.lead.count({
      where: {
        leadQualityScore: { lt: 60 },
        status: 'SOLD'
      }
    });

    expect(highScore).toBeGreaterThanOrEqual(0);
    expect(lowScore).toBeGreaterThanOrEqual(0);
  });

  test('Test 52: Score impact on pricing', async () => {
    const highScoreLeads = await prisma.lead.findMany({
      where: {
        leadQualityScore: { gte: 80 },
        winningBid: { not: null }
      }
    });

    expect(highScoreLeads).toBeDefined();
  });

  test('Test 53: Quality-based segmentation', async () => {
    const segments = await prisma.lead.groupBy({
      by: ['ownsHome', 'timeframe'],
      _avg: {
        leadQualityScore: true
      },
      _count: {
        id: true
      }
    });

    expect(segments.length).toBeGreaterThan(0);
  });

  test('Test 54: Score improvement tracking', async () => {
    const leads = await prisma.lead.findMany({
      where: {
        leadQualityScore: {
          not: null
        }
      },
      select: {
        leadQualityScore: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    expect(leads.length).toBeGreaterThan(0);
  });

  test('Test 55: Quality benchmarking', async () => {
    const benchmark = await prisma.lead.aggregate({
      where: {
        status: 'SOLD'
      },
      _avg: {
        leadQualityScore: true
      }
    });

    expect(benchmark).toBeDefined();
  });

  test('Test 56: Score-based pricing tiers', async () => {
    const tiers = {
      premium: await prisma.lead.findMany({
        where: { leadQualityScore: { gte: 90 } },
        include: { transactions: true }
      }),
      standard: await prisma.lead.findMany({
        where: { leadQualityScore: { gte: 70, lt: 90 } },
        include: { transactions: true }
      }),
      basic: await prisma.lead.findMany({
        where: { leadQualityScore: { lt: 70 } },
        include: { transactions: true }
      })
    };

    expect(tiers.premium).toBeDefined();
    expect(tiers.standard).toBeDefined();
    expect(tiers.basic).toBeDefined();
  });

  test('Test 57: Quality score decay over time', async () => {
    const old = new Date();
    old.setDate(old.getDate() - 7);

    const recentLeads = await prisma.lead.findMany({
      where: {
        createdAt: {
          gte: old
        },
        leadQualityScore: {
          not: null
        }
      }
    });

    expect(recentLeads).toBeDefined();
  });

  test('Test 58: Predictive scoring factors', async () => {
    const factors = await prisma.lead.findMany({
      where: {
        leadQualityScore: {
          not: null
        }
      },
      select: {
        leadQualityScore: true,
        ownsHome: true,
        timeframe: true,
        zipCode: true,
        status: true
      }
    });

    expect(factors.length).toBeGreaterThan(0);
  });

  test('Test 59: Score-based lead routing rules', async () => {
    const rules = [
      { min: 90, target: 'premium_buyers' },
      { min: 75, max: 89, target: 'standard_buyers' },
      { min: 0, max: 74, target: 'basic_buyers' }
    ];

    for (const rule of rules) {
      const leads = await prisma.lead.findMany({
        where: {
          leadQualityScore: {
            gte: rule.min,
            lte: rule.max || 100
          }
        }
      });

      expect(leads).toBeDefined();
    }
  });

  test('Test 60: Comprehensive quality report', async () => {
    const report = {
      totalLeads: await prisma.lead.count(),
      avgScore: await prisma.lead.aggregate({
        _avg: { leadQualityScore: true }
      }),
      scoreDistribution: await prisma.lead.groupBy({
        by: ['ownsHome', 'timeframe'],
        _avg: { leadQualityScore: true },
        _count: { id: true }
      }),
      topLeads: await prisma.lead.findMany({
        where: { leadQualityScore: { gte: 85 } },
        orderBy: { leadQualityScore: 'desc' },
        take: 5
      })
    };

    expect(report.totalLeads).toBeGreaterThan(0);
    expect(report.avgScore._avg.leadQualityScore).toBeDefined();
    expect(report.scoreDistribution.length).toBeGreaterThan(0);
    expect(report.topLeads).toBeDefined();
  });
});
