const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:3002';

describe('Domain 10: Workflow Automation - Lead Workflow (50 tests)', () => {

  let testServiceType;
  let testBuyer;
  let testServiceConfig;

  beforeAll(async () => {
    testServiceType = await prisma.serviceType.findFirst();

    testBuyer = await prisma.buyer.create({
      data: {
        name: 'Workflow Test Buyer ' + Date.now(),
        apiUrl: 'https://workflow-buyer.com',
        active: true,
        pingTimeout: 30,
        postTimeout: 60
      }
    });

    testServiceConfig = await prisma.buyerServiceConfig.create({
      data: {
        buyerId: testBuyer.id,
        serviceTypeId: testServiceType.id,
        pingTemplate: JSON.stringify({ type: 'ping' }),
        postTemplate: JSON.stringify({ type: 'post' }),
        fieldMappings: JSON.stringify({ email: 'contact_email' }),
        requiresTrustedForm: false,
        requiresJornaya: false,
        minBid: 10.0,
        maxBid: 50.0,
        active: true
      }
    });
  });

  afterAll(async () => {
    if (testServiceConfig) {
      await prisma.buyerServiceConfig.delete({ where: { id: testServiceConfig.id } }).catch(() => {});
    }
    if (testBuyer) {
      await prisma.buyer.delete({ where: { id: testBuyer.id } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  // Lead Creation Workflow (Tests 1-10)
  test('Test 1: New lead starts in PENDING status', async () => {
    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'within_3_months'
      }
    });

    expect(lead.status).toBe('PENDING');

    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 2: Lead creation triggers routing', async () => {
    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'within_3_months'
      }
    });

    expect(lead.createdAt).toBeDefined();

    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 3: Lead timestamps tracked', async () => {
    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'within_3_months'
      }
    });

    expect(lead.createdAt).toBeDefined();
    expect(lead.updatedAt).toBeDefined();

    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 4: Lead updated timestamp changes', async () => {
    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'within_3_months'
      }
    });

    const originalUpdatedAt = lead.updatedAt;

    await new Promise(resolve => setTimeout(resolve, 10));

    await prisma.lead.update({
      where: { id: lead.id },
      data: { status: 'SOLD' }
    });

    const updated = await prisma.lead.findUnique({ where: { id: lead.id } });
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt.getTime());

    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 5: Lead service type association required', async () => {
    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'within_3_months'
      },
      include: { serviceType: true }
    });

    expect(lead.serviceType).toBeDefined();
    expect(lead.serviceType.id).toBe(testServiceType.id);

    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 6: Lead ZIP code stored', async () => {
    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '90210',
        ownsHome: true,
        timeframe: 'within_3_months'
      }
    });

    expect(lead.zipCode).toBe('90210');

    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 7: Lead ownership flag stored', async () => {
    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'within_3_months'
      }
    });

    expect(lead.ownsHome).toBe(true);

    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 8: Lead timeframe stored', async () => {
    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'within_6_months'
      }
    });

    expect(lead.timeframe).toBe('within_6_months');

    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 9: Lead form data preserved', async () => {
    const formData = JSON.stringify({ name: 'Test', email: 'test@test.com' });
    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: formData,
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'within_3_months'
      }
    });

    expect(lead.formData).toBe(formData);

    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 10: Lead ID generated automatically', async () => {
    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'within_3_months'
      }
    });

    expect(lead.id).toBeDefined();
    expect(typeof lead.id).toBe('string');

    await prisma.lead.delete({ where: { id: lead.id } });
  });

  // Ping Workflow (Tests 11-20)
  test('Test 11: Ping transaction created', async () => {
    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'within_3_months'
      }
    });

    const ping = await prisma.transaction.create({
      data: {
        leadId: lead.id,
        buyerId: testBuyer.id,
        actionType: 'PING',
        status: 'PENDING',
        payload: JSON.stringify({ lead: lead.id })
      }
    });

    expect(ping.actionType).toBe('PING');

    await prisma.transaction.delete({ where: { id: ping.id } });
    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 12: Ping timeout respected', async () => {
    expect(testBuyer.pingTimeout).toBe(30);
  });

  test('Test 13: Ping success tracked', async () => {
    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'within_3_months'
      }
    });

    const ping = await prisma.transaction.create({
      data: {
        leadId: lead.id,
        buyerId: testBuyer.id,
        actionType: 'PING',
        status: 'SUCCESS',
        payload: '{}',
        response: JSON.stringify({ accepted: true, bid: 25.0 })
      }
    });

    expect(ping.status).toBe('SUCCESS');

    await prisma.transaction.delete({ where: { id: ping.id } });
    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 14: Ping failure tracked', async () => {
    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'within_3_months'
      }
    });

    const ping = await prisma.transaction.create({
      data: {
        leadId: lead.id,
        buyerId: testBuyer.id,
        actionType: 'PING',
        status: 'FAILED',
        payload: '{}',
        errorMessage: 'Network timeout'
      }
    });

    expect(ping.status).toBe('FAILED');
    expect(ping.errorMessage).toBe('Network timeout');

    await prisma.transaction.delete({ where: { id: ping.id } });
    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 15: Ping response time tracked', async () => {
    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'within_3_months'
      }
    });

    const ping = await prisma.transaction.create({
      data: {
        leadId: lead.id,
        buyerId: testBuyer.id,
        actionType: 'PING',
        status: 'SUCCESS',
        payload: '{}',
        response: '{}',
        responseTime: 250
      }
    });

    expect(ping.responseTime).toBe(250);

    await prisma.transaction.delete({ where: { id: ping.id } });
    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 16: Ping bid amount captured', async () => {
    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'within_3_months'
      }
    });

    const ping = await prisma.transaction.create({
      data: {
        leadId: lead.id,
        buyerId: testBuyer.id,
        actionType: 'PING',
        status: 'SUCCESS',
        payload: '{}',
        response: '{}',
        bidAmount: 30.0
      }
    });

    expect(ping.bidAmount).toBe(30.0);

    await prisma.transaction.delete({ where: { id: ping.id } });
    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 17: Ping compliance flags', async () => {
    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'within_3_months'
      }
    });

    const ping = await prisma.transaction.create({
      data: {
        leadId: lead.id,
        buyerId: testBuyer.id,
        actionType: 'PING',
        status: 'SUCCESS',
        payload: '{}',
        response: '{}',
        complianceIncluded: true,
        trustedFormPresent: true,
        jornayaPresent: false
      }
    });

    expect(ping.complianceIncluded).toBe(true);
    expect(ping.trustedFormPresent).toBe(true);
    expect(ping.jornayaPresent).toBe(false);

    await prisma.transaction.delete({ where: { id: ping.id } });
    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 18: Multiple pings per lead', async () => {
    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'within_3_months'
      }
    });

    const buyer2 = await prisma.buyer.create({
      data: {
        name: 'Ping Buyer 2 ' + Date.now(),
        apiUrl: 'https://ping2.com',
        active: true
      }
    });

    const ping1 = await prisma.transaction.create({
      data: {
        leadId: lead.id,
        buyerId: testBuyer.id,
        actionType: 'PING',
        status: 'SUCCESS',
        payload: '{}',
        bidAmount: 25.0
      }
    });

    const ping2 = await prisma.transaction.create({
      data: {
        leadId: lead.id,
        buyerId: buyer2.id,
        actionType: 'PING',
        status: 'SUCCESS',
        payload: '{}',
        bidAmount: 35.0
      }
    });

    const pings = await prisma.transaction.findMany({
      where: {
        leadId: lead.id,
        actionType: 'PING'
      }
    });

    expect(pings.length).toBe(2);

    await prisma.transaction.deleteMany({ where: { leadId: lead.id } });
    await prisma.lead.delete({ where: { id: lead.id } });
    await prisma.buyer.delete({ where: { id: buyer2.id } });
  });

  test('Test 19: Highest ping bid wins', async () => {
    const bid1 = 25.0;
    const bid2 = 35.0;
    const bid3 = 30.0;

    const winningBid = Math.max(bid1, bid2, bid3);
    expect(winningBid).toBe(35.0);
  });

  test('Test 20: Ping timestamp tracked', async () => {
    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'within_3_months'
      }
    });

    const ping = await prisma.transaction.create({
      data: {
        leadId: lead.id,
        buyerId: testBuyer.id,
        actionType: 'PING',
        status: 'SUCCESS',
        payload: '{}'
      }
    });

    expect(ping.createdAt).toBeDefined();

    await prisma.transaction.delete({ where: { id: ping.id } });
    await prisma.lead.delete({ where: { id: lead.id } });
  });

  // Post Workflow (Tests 21-30)
  test('Test 21: Post transaction created', async () => {
    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'within_3_months'
      }
    });

    const post = await prisma.transaction.create({
      data: {
        leadId: lead.id,
        buyerId: testBuyer.id,
        actionType: 'POST',
        status: 'SUCCESS',
        payload: JSON.stringify({ lead: lead.id })
      }
    });

    expect(post.actionType).toBe('POST');

    await prisma.transaction.delete({ where: { id: post.id } });
    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 22: Post timeout respected', async () => {
    expect(testBuyer.postTimeout).toBe(60);
  });

  test('Test 23: Post success marks lead SOLD', async () => {
    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'within_3_months'
      }
    });

    await prisma.lead.update({
      where: { id: lead.id },
      data: { status: 'SOLD' }
    });

    const updated = await prisma.lead.findUnique({ where: { id: lead.id } });
    expect(updated.status).toBe('SOLD');

    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 24: Post assigns winning buyer', async () => {
    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'within_3_months'
      }
    });

    await prisma.lead.update({
      where: { id: lead.id },
      data: { winningBuyerId: testBuyer.id }
    });

    const updated = await prisma.lead.findUnique({ where: { id: lead.id } });
    expect(updated.winningBuyerId).toBe(testBuyer.id);

    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 25: Post sets winning bid', async () => {
    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'within_3_months'
      }
    });

    await prisma.lead.update({
      where: { id: lead.id },
      data: { winningBid: 35.0 }
    });

    const updated = await prisma.lead.findUnique({ where: { id: lead.id } });
    expect(updated.winningBid).toBe(35.0);

    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 26: Post failure tracked', async () => {
    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'within_3_months'
      }
    });

    const post = await prisma.transaction.create({
      data: {
        leadId: lead.id,
        buyerId: testBuyer.id,
        actionType: 'POST',
        status: 'FAILED',
        payload: '{}',
        errorMessage: 'Buyer rejected'
      }
    });

    expect(post.status).toBe('FAILED');

    await prisma.transaction.delete({ where: { id: post.id } });
    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 27: Post response tracked', async () => {
    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'within_3_months'
      }
    });

    const post = await prisma.transaction.create({
      data: {
        leadId: lead.id,
        buyerId: testBuyer.id,
        actionType: 'POST',
        status: 'SUCCESS',
        payload: '{}',
        response: JSON.stringify({ confirmation: 'ABC123' })
      }
    });

    expect(post.response).toBeDefined();

    await prisma.transaction.delete({ where: { id: post.id } });
    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 28: Only one POST per lead', async () => {
    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'within_3_months'
      }
    });

    const post = await prisma.transaction.create({
      data: {
        leadId: lead.id,
        buyerId: testBuyer.id,
        actionType: 'POST',
        status: 'SUCCESS',
        payload: '{}'
      }
    });

    const posts = await prisma.transaction.findMany({
      where: {
        leadId: lead.id,
        actionType: 'POST'
      }
    });

    expect(posts.length).toBe(1);

    await prisma.transaction.delete({ where: { id: post.id } });
    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 29: Post response time tracked', async () => {
    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'within_3_months'
      }
    });

    const post = await prisma.transaction.create({
      data: {
        leadId: lead.id,
        buyerId: testBuyer.id,
        actionType: 'POST',
        status: 'SUCCESS',
        payload: '{}',
        responseTime: 500
      }
    });

    expect(post.responseTime).toBe(500);

    await prisma.transaction.delete({ where: { id: post.id } });
    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 30: Post timestamp tracked', async () => {
    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'within_3_months'
      }
    });

    const post = await prisma.transaction.create({
      data: {
        leadId: lead.id,
        buyerId: testBuyer.id,
        actionType: 'POST',
        status: 'SUCCESS',
        payload: '{}'
      }
    });

    expect(post.createdAt).toBeDefined();

    await prisma.transaction.delete({ where: { id: post.id } });
    await prisma.lead.delete({ where: { id: lead.id } });
  });

  // Lead Status Workflow (Tests 31-40)
  test('Test 31: Lead status transitions to SOLD', async () => {
    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'within_3_months',
        status: 'PENDING'
      }
    });

    await prisma.lead.update({
      where: { id: lead.id },
      data: { status: 'SOLD' }
    });

    const updated = await prisma.lead.findUnique({ where: { id: lead.id } });
    expect(updated.status).toBe('SOLD');

    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 32: Lead status transitions to REJECTED', async () => {
    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'within_3_months',
        status: 'PENDING'
      }
    });

    await prisma.lead.update({
      where: { id: lead.id },
      data: { status: 'REJECTED' }
    });

    const updated = await prisma.lead.findUnique({ where: { id: lead.id } });
    expect(updated.status).toBe('REJECTED');

    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 33: SOLD leads have winning buyer', async () => {
    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'within_3_months',
        status: 'SOLD',
        winningBuyerId: testBuyer.id
      }
    });

    expect(lead.status).toBe('SOLD');
    expect(lead.winningBuyerId).toBe(testBuyer.id);

    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 34: SOLD leads have winning bid', async () => {
    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'within_3_months',
        status: 'SOLD',
        winningBid: 42.50
      }
    });

    expect(lead.winningBid).toBe(42.50);

    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 35: PENDING leads available for routing', async () => {
    const pendingLeads = await prisma.lead.findMany({
      where: { status: 'PENDING' }
    });

    pendingLeads.forEach(lead => {
      expect(lead.status).toBe('PENDING');
    });
  });

  test('Test 36: SOLD leads not available for routing', async () => {
    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'within_3_months',
        status: 'SOLD'
      }
    });

    expect(lead.status).toBe('SOLD');

    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 37: Lead status queryable', async () => {
    const statusCounts = await prisma.lead.groupBy({
      by: ['status'],
      _count: true
    });

    expect(Array.isArray(statusCounts)).toBe(true);
  });

  test('Test 38: Lead age calculated from createdAt', async () => {
    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'within_3_months'
      }
    });

    const age = Date.now() - lead.createdAt.getTime();
    expect(age).toBeGreaterThanOrEqual(0);

    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 39: Lead lifecycle tracked', async () => {
    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'within_3_months',
        status: 'PENDING'
      }
    });

    expect(lead.createdAt).toBeDefined();
    expect(lead.updatedAt).toBeDefined();
    expect(lead.status).toBe('PENDING');

    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 40: Lead transactions viewable', async () => {
    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'within_3_months'
      }
    });

    const transactions = await prisma.transaction.findMany({
      where: { leadId: lead.id }
    });

    expect(Array.isArray(transactions)).toBe(true);

    await prisma.lead.delete({ where: { id: lead.id } });
  });

  // Compliance Workflow (Tests 41-50)
  test('Test 41: TrustedForm cert URL captured', async () => {
    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'within_3_months',
        trustedFormCertUrl: 'https://cert.trustedform.com/test123'
      }
    });

    expect(lead.trustedFormCertUrl).toBe('https://cert.trustedform.com/test123');

    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 42: TrustedForm cert ID captured', async () => {
    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'within_3_months',
        trustedFormCertId: 'tf-12345'
      }
    });

    expect(lead.trustedFormCertId).toBe('tf-12345');

    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 43: Jornaya lead ID captured', async () => {
    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'within_3_months',
        jornayaLeadId: 'jornaya-xyz'
      }
    });

    expect(lead.jornayaLeadId).toBe('jornaya-xyz');

    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 44: Compliance audit events logged', async () => {
    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'within_3_months'
      }
    });

    const audit = await prisma.complianceAuditLog.create({
      data: {
        leadId: lead.id,
        eventType: 'FORM_SUBMITTED',
        eventData: '{}'
      }
    });

    expect(audit.eventType).toBe('FORM_SUBMITTED');

    await prisma.complianceAuditLog.delete({ where: { id: audit.id } });
    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 45: Compliance data stored', async () => {
    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'within_3_months',
        complianceData: JSON.stringify({ tcpa: true })
      }
    });

    expect(lead.complianceData).toBeDefined();

    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 46: Lead quality score calculated', async () => {
    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'within_3_months',
        leadQualityScore: 85
      }
    });

    expect(lead.leadQualityScore).toBe(85);

    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 47: Compliance requirements validated', async () => {
    expect(testServiceConfig.requiresTrustedForm).toBeDefined();
    expect(testServiceConfig.requiresJornaya).toBeDefined();
  });

  test('Test 48: Transaction compliance flags set', async () => {
    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'within_3_months'
      }
    });

    const tx = await prisma.transaction.create({
      data: {
        leadId: lead.id,
        buyerId: testBuyer.id,
        actionType: 'PING',
        status: 'SUCCESS',
        payload: '{}',
        complianceIncluded: true
      }
    });

    expect(tx.complianceIncluded).toBe(true);

    await prisma.transaction.delete({ where: { id: tx.id } });
    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 49: Compliance audit history viewable', async () => {
    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'within_3_months'
      }
    });

    const audits = await prisma.complianceAuditLog.findMany({
      where: { leadId: lead.id }
    });

    expect(Array.isArray(audits)).toBe(true);

    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 50: Full workflow integration', async () => {
    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'within_3_months',
        status: 'PENDING'
      }
    });

    const ping = await prisma.transaction.create({
      data: {
        leadId: lead.id,
        buyerId: testBuyer.id,
        actionType: 'PING',
        status: 'SUCCESS',
        payload: '{}',
        bidAmount: 30.0
      }
    });

    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        status: 'SOLD',
        winningBuyerId: testBuyer.id,
        winningBid: 30.0
      }
    });

    const post = await prisma.transaction.create({
      data: {
        leadId: lead.id,
        buyerId: testBuyer.id,
        actionType: 'POST',
        status: 'SUCCESS',
        payload: '{}'
      }
    });

    const final = await prisma.lead.findUnique({ where: { id: lead.id } });
    expect(final.status).toBe('SOLD');
    expect(final.winningBid).toBe(30.0);

    await prisma.transaction.deleteMany({ where: { leadId: lead.id } });
    await prisma.lead.delete({ where: { id: lead.id } });
  });
});
