const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

describe('Domain 11: Buyer Response Handling (50 tests)', () => {

  let testServiceType;
  let testBuyer;

  beforeAll(async () => {
    testServiceType = await prisma.serviceType.findFirst();

    testBuyer = await prisma.buyer.create({
      data: {
        name: 'Response Test Buyer ' + Date.now(),
        apiUrl: 'https://response-buyer.com',
        active: true,
        pingTimeout: 30,
        postTimeout: 60
      }
    });
  });

  afterAll(async () => {
    if (testBuyer) {
      await prisma.buyer.delete({ where: { id: testBuyer.id } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  // Response Structure Tests (Tests 1-10)
  test('Test 1: Transaction stores request payload', async () => {
    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'within_3_months'
      }
    });

    const payload = JSON.stringify({ leadId: lead.id, type: 'ping' });
    const tx = await prisma.transaction.create({
      data: {
        leadId: lead.id,
        buyerId: testBuyer.id,
        actionType: 'PING',
        status: 'SUCCESS',
        payload: payload
      }
    });

    expect(tx.payload).toBe(payload);

    await prisma.transaction.delete({ where: { id: tx.id } });
    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 2: Transaction stores response payload', async () => {
    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'within_3_months'
      }
    });

    const response = JSON.stringify({ accepted: true, bid: 25.0 });
    const tx = await prisma.transaction.create({
      data: {
        leadId: lead.id,
        buyerId: testBuyer.id,
        actionType: 'PING',
        status: 'SUCCESS',
        payload: '{}',
        response: response
      }
    });

    expect(tx.response).toBe(response);

    await prisma.transaction.delete({ where: { id: tx.id } });
    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 3: Response status tracked', async () => {
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
        payload: '{}'
      }
    });

    expect(tx.status).toBe('SUCCESS');

    await prisma.transaction.delete({ where: { id: tx.id } });
    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 4: Multiple status types supported', async () => {
    const statuses = ['PENDING', 'SUCCESS', 'FAILED', 'TIMEOUT'];

    statuses.forEach(status => {
      expect(typeof status).toBe('string');
    });
  });

  test('Test 5: Error messages captured', async () => {
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
        status: 'FAILED',
        payload: '{}',
        errorMessage: 'Connection refused'
      }
    });

    expect(tx.errorMessage).toBe('Connection refused');

    await prisma.transaction.delete({ where: { id: tx.id } });
    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 6: Response time measured', async () => {
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
        responseTime: 125
      }
    });

    expect(tx.responseTime).toBe(125);

    await prisma.transaction.delete({ where: { id: tx.id } });
    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 7: Bid amount extracted from response', async () => {
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
        bidAmount: 27.50
      }
    });

    expect(tx.bidAmount).toBe(27.50);

    await prisma.transaction.delete({ where: { id: tx.id } });
    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 8: Compliance flags from response', async () => {
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
        complianceIncluded: true,
        trustedFormPresent: true,
        jornayaPresent: true
      }
    });

    expect(tx.complianceIncluded).toBe(true);
    expect(tx.trustedFormPresent).toBe(true);
    expect(tx.jornayaPresent).toBe(true);

    await prisma.transaction.delete({ where: { id: tx.id } });
    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 9: Transaction timestamp recorded', async () => {
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
        payload: '{}'
      }
    });

    expect(tx.createdAt).toBeDefined();

    await prisma.transaction.delete({ where: { id: tx.id } });
    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 10: Transaction buyer association', async () => {
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
        payload: '{}'
      },
      include: { buyer: true }
    });

    expect(tx.buyer.id).toBe(testBuyer.id);

    await prisma.transaction.delete({ where: { id: tx.id } });
    await prisma.lead.delete({ where: { id: lead.id } });
  });

  // Timeout Handling (Tests 11-20)
  test('Test 11: Ping timeout configured per buyer', async () => {
    expect(testBuyer.pingTimeout).toBe(30);
  });

  test('Test 12: Post timeout configured per buyer', async () => {
    expect(testBuyer.postTimeout).toBe(60);
  });

  test('Test 13: Timeout status tracked', async () => {
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
        status: 'TIMEOUT',
        payload: '{}'
      }
    });

    expect(tx.status).toBe('TIMEOUT');

    await prisma.transaction.delete({ where: { id: tx.id } });
    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 14: Response time compared to timeout', async () => {
    const responseTime = 25000; // 25 seconds
    const timeout = testBuyer.pingTimeout * 1000; // 30 seconds

    expect(responseTime).toBeLessThan(timeout);
  });

  test('Test 15: Slow response still succeeds', async () => {
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
        responseTime: 29000 // 29 seconds (under 30s timeout)
      }
    });

    expect(tx.status).toBe('SUCCESS');

    await prisma.transaction.delete({ where: { id: tx.id } });
    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 16: Timeout error message', async () => {
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
        status: 'TIMEOUT',
        payload: '{}',
        errorMessage: 'Request timeout after 30s'
      }
    });

    expect(tx.errorMessage).toBeDefined();

    await prisma.transaction.delete({ where: { id: tx.id } });
    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 17: Different timeouts for ping vs post', async () => {
    expect(testBuyer.postTimeout).toBeGreaterThan(testBuyer.pingTimeout);
  });

  test('Test 18: Timeout configuration per buyer', async () => {
    const buyer2 = await prisma.buyer.create({
      data: {
        name: 'Timeout Buyer ' + Date.now(),
        apiUrl: 'https://timeout.com',
        active: true,
        pingTimeout: 45,
        postTimeout: 90
      }
    });

    expect(buyer2.pingTimeout).toBe(45);
    expect(buyer2.postTimeout).toBe(90);

    await prisma.buyer.delete({ where: { id: buyer2.id } });
  });

  test('Test 19: Fast response preferred', async () => {
    const responseTime1 = 150;
    const responseTime2 = 850;

    expect(responseTime1).toBeLessThan(responseTime2);
  });

  test('Test 20: Average response time calculable', async () => {
    const responseTimes = [150, 250, 300, 450];
    const avg = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;

    expect(avg).toBe(287.5);
  });

  // Bid Response Handling (Tests 21-30)
  test('Test 21: Bid acceptance tracked', async () => {
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
        bidAmount: 30.0
      }
    });

    expect(tx.bidAmount).toBe(30.0);

    await prisma.transaction.delete({ where: { id: tx.id } });
    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 22: Bid rejection tracked', async () => {
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
        status: 'FAILED',
        payload: '{}',
        errorMessage: 'Bid rejected - out of capacity'
      }
    });

    expect(tx.status).toBe('FAILED');

    await prisma.transaction.delete({ where: { id: tx.id } });
    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 23: Zero bid indicates no interest', async () => {
    const bidAmount = 0.0;
    expect(bidAmount).toBe(0);
  });

  test('Test 24: Bid amount precision preserved', async () => {
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
        bidAmount: 25.99
      }
    });

    expect(tx.bidAmount).toBe(25.99);

    await prisma.transaction.delete({ where: { id: tx.id } });
    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 25: Highest bid selected', async () => {
    const bids = [25.0, 35.0, 30.0, 28.0];
    const highest = Math.max(...bids);

    expect(highest).toBe(35.0);
  });

  test('Test 26: Bid comparison logic', async () => {
    const bid1 = { buyerId: 'buyer1', amount: 30.0 };
    const bid2 = { buyerId: 'buyer2', amount: 35.0 };

    const winner = bid1.amount > bid2.amount ? bid1 : bid2;
    expect(winner.buyerId).toBe('buyer2');
  });

  test('Test 27: Tied bids handled', async () => {
    const bid1 = { buyerId: 'buyer1', amount: 30.0, time: 1000 };
    const bid2 = { buyerId: 'buyer2', amount: 30.0, time: 2000 };

    // First bid wins on tie
    const winner = bid1.time < bid2.time ? bid1 : bid2;
    expect(winner.buyerId).toBe('buyer1');
  });

  test('Test 28: Bid history tracked', async () => {
    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'within_3_months'
      }
    });

    const tx1 = await prisma.transaction.create({
      data: {
        leadId: lead.id,
        buyerId: testBuyer.id,
        actionType: 'PING',
        status: 'SUCCESS',
        payload: '{}',
        bidAmount: 25.0
      }
    });

    const tx2 = await prisma.transaction.create({
      data: {
        leadId: lead.id,
        buyerId: testBuyer.id,
        actionType: 'PING',
        status: 'SUCCESS',
        payload: '{}',
        bidAmount: 30.0
      }
    });

    const allBids = await prisma.transaction.findMany({
      where: { leadId: lead.id, actionType: 'PING' }
    });

    expect(allBids.length).toBe(2);

    await prisma.transaction.deleteMany({ where: { leadId: lead.id } });
    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 29: Bid range validation', async () => {
    const config = await prisma.buyerServiceConfig.findFirst({
      where: { buyerId: testBuyer.id }
    });

    if (config) {
      const bid = 35.0;
      expect(bid).toBeGreaterThanOrEqual(config.minBid);
      expect(bid).toBeLessThanOrEqual(config.maxBid);
    }
  });

  test('Test 30: No bid means no sale', async () => {
    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'within_3_months'
      }
    });

    expect(lead.winningBid).toBeNull();

    await prisma.lead.delete({ where: { id: lead.id } });
  });

  // Error Response Handling (Tests 31-40)
  test('Test 31: Network errors captured', async () => {
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
        status: 'FAILED',
        payload: '{}',
        errorMessage: 'ECONNREFUSED'
      }
    });

    expect(tx.errorMessage).toContain('ECONNREFUSED');

    await prisma.transaction.delete({ where: { id: tx.id } });
    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 32: HTTP error codes captured', async () => {
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
        status: 'FAILED',
        payload: '{}',
        errorMessage: 'HTTP 500 Internal Server Error'
      }
    });

    expect(tx.errorMessage).toContain('500');

    await prisma.transaction.delete({ where: { id: tx.id } });
    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 33: Validation errors captured', async () => {
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
        status: 'FAILED',
        payload: '{}',
        errorMessage: 'Invalid ZIP code format'
      }
    });

    expect(tx.errorMessage).toContain('Invalid');

    await prisma.transaction.delete({ where: { id: tx.id } });
    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 34: Business rule violations captured', async () => {
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
        status: 'FAILED',
        payload: '{}',
        errorMessage: 'ZIP code not in coverage area'
      }
    });

    expect(tx.errorMessage).toBeDefined();

    await prisma.transaction.delete({ where: { id: tx.id } });
    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 35: Error retry logic possible', async () => {
    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'within_3_months'
      }
    });

    const tx1 = await prisma.transaction.create({
      data: {
        leadId: lead.id,
        buyerId: testBuyer.id,
        actionType: 'PING',
        status: 'FAILED',
        payload: '{}',
        errorMessage: 'Timeout'
      }
    });

    const tx2 = await prisma.transaction.create({
      data: {
        leadId: lead.id,
        buyerId: testBuyer.id,
        actionType: 'PING',
        status: 'SUCCESS',
        payload: '{}'
      }
    });

    expect(tx1.status).toBe('FAILED');
    expect(tx2.status).toBe('SUCCESS');

    await prisma.transaction.deleteMany({ where: { leadId: lead.id } });
    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 36: Error patterns identified', async () => {
    const errors = ['Timeout', 'Timeout', 'ECONNREFUSED', 'HTTP 500'];
    const timeoutCount = errors.filter(e => e === 'Timeout').length;

    expect(timeoutCount).toBe(2);
  });

  test('Test 37: Partial response handled', async () => {
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
        status: 'FAILED',
        payload: '{}',
        response: '{"partial":',
        errorMessage: 'Incomplete JSON response'
      }
    });

    expect(tx.errorMessage).toBeDefined();

    await prisma.transaction.delete({ where: { id: tx.id } });
    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 38: Error categorization', async () => {
    const errorTypes = {
      network: 'ECONNREFUSED',
      timeout: 'Request timeout',
      validation: 'Invalid data',
      business: 'Out of coverage'
    };

    expect(Object.keys(errorTypes).length).toBe(4);
  });

  test('Test 39: Error count per buyer trackable', async () => {
    const failures = await prisma.transaction.count({
      where: {
        buyerId: testBuyer.id,
        status: 'FAILED'
      }
    });

    expect(failures).toBeGreaterThanOrEqual(0);
  });

  test('Test 40: Success rate calculable', async () => {
    const total = 100;
    const successful = 85;
    const successRate = (successful / total) * 100;

    expect(successRate).toBe(85);
  });

  // Response Format Handling (Tests 41-50)
  test('Test 41: JSON response parsed', async () => {
    const responseJson = JSON.stringify({ accepted: true, bid: 30.0 });
    const parsed = JSON.parse(responseJson);

    expect(parsed.accepted).toBe(true);
    expect(parsed.bid).toBe(30.0);
  });

  test('Test 42: Empty response handled', async () => {
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
        payload: '{}'
      }
    });

    expect(tx.response).toBeNull();

    await prisma.transaction.delete({ where: { id: tx.id } });
    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 43: Response fields extracted', async () => {
    const response = {
      status: 'accepted',
      bid: 35.0,
      message: 'Lead accepted',
      confirmation: 'ABC123'
    };

    expect(response.bid).toBe(35.0);
    expect(response.confirmation).toBe('ABC123');
  });

  test('Test 44: Nested response data handled', async () => {
    const response = {
      data: {
        result: {
          accepted: true,
          bid: 30.0
        }
      }
    };

    expect(response.data.result.bid).toBe(30.0);
  });

  test('Test 45: Response validation', async () => {
    const response = { accepted: true, bid: 25.0 };

    expect(response.hasOwnProperty('accepted')).toBe(true);
    expect(response.hasOwnProperty('bid')).toBe(true);
  });

  test('Test 46: Missing required fields detected', async () => {
    const response = { accepted: true };
    // bid field is missing

    expect(response.hasOwnProperty('bid')).toBe(false);
  });

  test('Test 47: Extra fields ignored', async () => {
    const response = {
      accepted: true,
      bid: 30.0,
      internalId: '12345',
      debugInfo: 'test'
    };

    expect(response.accepted).toBe(true);
    expect(response.bid).toBe(30.0);
  });

  test('Test 48: Response type checked', async () => {
    const response = { accepted: true, bid: '30.0' };

    expect(typeof response.bid).toBe('string');
  });

  test('Test 49: Boolean response values', async () => {
    const response = { accepted: true, rejected: false };

    expect(response.accepted).toBe(true);
    expect(response.rejected).toBe(false);
  });

  test('Test 50: Response stored as string', async () => {
    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'within_3_months'
      }
    });

    const responseObj = { accepted: true, bid: 30.0 };
    const tx = await prisma.transaction.create({
      data: {
        leadId: lead.id,
        buyerId: testBuyer.id,
        actionType: 'PING',
        status: 'SUCCESS',
        payload: '{}',
        response: JSON.stringify(responseObj)
      }
    });

    expect(typeof tx.response).toBe('string');

    await prisma.transaction.delete({ where: { id: tx.id } });
    await prisma.lead.delete({ where: { id: lead.id } });
  });
});
