/**
 * E2E Tests for Admin Lead Management APIs
 * Domain 1.7: Admin Lead Management
 *
 * Tests:
 * - GET /api/admin/leads (list with filters, pagination, sorting)
 * - GET /api/admin/leads?analytics=true (analytics endpoint)
 * - GET /api/admin/leads/[id] (get single lead with full details)
 * - PUT /api/admin/leads/[id] (update lead status)
 *
 * Total: 54 tests
 */

const { PrismaClient } = require('@prisma/client');

const BASE_URL = 'http://localhost:3002';
const ADMIN_API_KEY = 'test-admin-key-12345';

const prisma = new PrismaClient();

// Helper function to make authenticated API requests
async function apiRequest(endpoint, options = {}) {
  const fetchOptions = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(endpoint.startsWith('/api/admin') ? { 'Authorization': `Bearer ${ADMIN_API_KEY}` } : {}),
      ...options.headers
    }
  };

  if (fetchOptions.body && typeof fetchOptions.body === 'object') {
    fetchOptions.body = JSON.stringify(fetchOptions.body);
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, fetchOptions);
  const data = await response.json();

  return {
    status: response.status,
    ok: response.ok,
    data,
    error: !response.ok ? (JSON.stringify(data.error || data.message || data || 'Request failed')) : null
  };
}

// Test setup variables
let testServiceType;
let testBuyer;
let testLead1, testLead2, testLead3, testLead4;

beforeAll(async () => {
  // Get or create test service type
  const serviceTypes = await prisma.serviceType.findMany({ take: 1 });
  testServiceType = serviceTypes[0];

  // Create test buyer for winning bids
  testBuyer = await prisma.buyer.create({
    data: {
      name: 'Test Buyer for Leads',
      type: 'EXCLUSIVE',
      apiUrl: 'https://test-buyer-api.example.com/leads',
      active: true
    }
  });

  // Create test leads with different statuses and dates
  const now = new Date();
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
  const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

  testLead1 = await prisma.lead.create({
    data: {
      serviceTypeId: testServiceType.id,
      formData: JSON.stringify({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@test.com',
        phone: '5551234567',
        projectScope: 'Kitchen remodel',
        budget: '10000-25000'
      }),
      zipCode: '90210',
      status: 'SOLD',
      ownsHome: true,
      timeframe: 'IMMEDIATE',
      winningBuyerId: testBuyer.id,
      winningBid: 45.50,
      leadQualityScore: 85,
      trustedFormCertUrl: 'https://cert.trustedform.com/test1',
      trustedFormCertId: 'tf-cert-1',
      jornayaLeadId: 'jorn-1',
      complianceData: JSON.stringify({ verified: true }),
      createdAt: twoDaysAgo
    }
  });

  testLead2 = await prisma.lead.create({
    data: {
      serviceTypeId: testServiceType.id,
      formData: JSON.stringify({
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@test.com',
        phone: '5559876543',
        projectScope: 'Bathroom renovation',
        budget: '5000-10000'
      }),
      zipCode: '10001',
      status: 'AUCTIONED',
      ownsHome: true,
      timeframe: '1_3_MONTHS',
      leadQualityScore: 75,
      createdAt: fiveDaysAgo
    }
  });

  testLead3 = await prisma.lead.create({
    data: {
      serviceTypeId: testServiceType.id,
      formData: JSON.stringify({
        firstName: 'Bob',
        lastName: 'Johnson',
        email: 'bob.j@test.com',
        phone: '5555555555'
      }),
      zipCode: '30301',
      status: 'PENDING',
      ownsHome: false,
      timeframe: '3_6_MONTHS',
      leadQualityScore: 50,
      createdAt: tenDaysAgo
    }
  });

  testLead4 = await prisma.lead.create({
    data: {
      serviceTypeId: testServiceType.id,
      formData: JSON.stringify({
        firstName: 'Alice',
        lastName: 'Williams',
        email: 'alice.w@test.com',
        phone: '5551112222'
      }),
      zipCode: '60601',
      status: 'REJECTED',
      ownsHome: true,
      timeframe: '6_12_MONTHS',
      leadQualityScore: 30,
      createdAt: now
    }
  });

  // Create test transactions for testLead1
  await prisma.transaction.create({
    data: {
      leadId: testLead1.id,
      buyerId: testBuyer.id,
      actionType: 'PING',
      payload: JSON.stringify({ firstName: 'John', lastName: 'Doe', zipCode: '90210' }),
      status: 'SUCCESS',
      bidAmount: 45.50,
      responseTime: 120
    }
  });

  await prisma.transaction.create({
    data: {
      leadId: testLead1.id,
      buyerId: testBuyer.id,
      actionType: 'POST',
      payload: JSON.stringify({ firstName: 'John', lastName: 'Doe', zipCode: '90210' }),
      status: 'SUCCESS',
      bidAmount: 45.50,
      responseTime: 250
    }
  });

  // Create compliance audit log for testLead1
  await prisma.complianceAuditLog.create({
    data: {
      leadId: testLead1.id,
      eventType: 'LEAD_CREATED',
      eventData: JSON.stringify({ source: 'web_form' }),
      ipAddress: '192.168.1.1'
    }
  });
});

afterAll(async () => {
  // Clean up test data
  await prisma.complianceAuditLog.deleteMany({
    where: { leadId: { in: [testLead1.id, testLead2.id, testLead3.id, testLead4.id] } }
  });

  await prisma.transaction.deleteMany({
    where: { leadId: { in: [testLead1.id, testLead2.id, testLead3.id, testLead4.id] } }
  });

  await prisma.lead.deleteMany({
    where: { id: { in: [testLead1.id, testLead2.id, testLead3.id, testLead4.id] } }
  });

  await prisma.buyer.delete({
    where: { id: testBuyer.id }
  });

  await prisma.$disconnect();
});

// ============================================================================
// GET /api/admin/leads - List Leads (18 tests)
// ============================================================================

test('Test 1: GET /api/admin/leads - should return paginated list of leads', async () => {
  const response = await apiRequest('/api/admin/leads');

  expect(response.status).toBe(200);
  expect(response.data.success).toBe(true);
  expect(response.data.data).toHaveProperty('leads');
  expect(response.data.data).toHaveProperty('pagination');
  expect(Array.isArray(response.data.data.leads)).toBe(true);
  expect(response.data.data.pagination).toHaveProperty('page');
  expect(response.data.data.pagination).toHaveProperty('limit');
  expect(response.data.data.pagination).toHaveProperty('totalCount');
  expect(response.data.data.pagination).toHaveProperty('totalPages');
});

test('Test 2: GET /api/admin/leads - should return leads with serviceType and winningBuyer relations', async () => {
  const response = await apiRequest('/api/admin/leads');

  expect(response.status).toBe(200);
  expect(response.data.data.leads.length).toBeGreaterThan(0);

  const lead = response.data.data.leads[0];
  expect(lead).toHaveProperty('id');
  expect(lead).toHaveProperty('serviceType');
  expect(lead).toHaveProperty('status');
  expect(lead).toHaveProperty('formData');
  expect(lead).toHaveProperty('createdAt');
  expect(lead).toHaveProperty('updatedAt');

  if (lead.serviceType) {
    expect(lead.serviceType).toHaveProperty('id');
    expect(lead.serviceType).toHaveProperty('name');
    expect(lead.serviceType).toHaveProperty('displayName');
  }
});

test('Test 3: GET /api/admin/leads - should mask email and phone in list view', async () => {
  const response = await apiRequest('/api/admin/leads');

  expect(response.status).toBe(200);

  // Find a lead with email/phone
  const leadWithContact = response.data.data.leads.find(l =>
    l.formData.email || l.formData.phone
  );

  if (leadWithContact) {
    if (leadWithContact.formData.email) {
      // Email should contain asterisks
      expect(leadWithContact.formData.email).toContain('*');
    }
    if (leadWithContact.formData.phone) {
      // Phone should contain asterisks
      expect(leadWithContact.formData.phone).toContain('***');
    }
  }
});

test('Test 4: GET /api/admin/leads - should support custom page and limit', async () => {
  const response = await apiRequest('/api/admin/leads?page=1&limit=2');

  expect(response.status).toBe(200);
  expect(response.data.data.pagination.page).toBe(1);
  expect(response.data.data.pagination.limit).toBe(2);
  expect(response.data.data.leads.length).toBeLessThanOrEqual(2);
});

test('Test 5: GET /api/admin/leads - should enforce maximum limit of 100', async () => {
  const response = await apiRequest('/api/admin/leads?limit=200');

  expect(response.status).toBe(200);
  expect(response.data.data.pagination.limit).toBe(100); // Should be capped at 100
});

test('Test 6: GET /api/admin/leads - should filter by status', async () => {
  const response = await apiRequest('/api/admin/leads?status=SOLD');

  expect(response.status).toBe(200);
  expect(response.data.data.filters.status).toBe('SOLD');

  // All returned leads should have SOLD status
  response.data.data.leads.forEach(lead => {
    expect(lead.status).toBe('SOLD');
  });
});

test('Test 7: GET /api/admin/leads - should filter by serviceTypeId', async () => {
  const response = await apiRequest(`/api/admin/leads?serviceTypeId=${testServiceType.id}`);

  expect(response.status).toBe(200);
  expect(response.data.data.filters.serviceTypeId).toBe(testServiceType.id);

  // All returned leads should have this service type
  response.data.data.leads.forEach(lead => {
    expect(lead.serviceTypeId).toBe(testServiceType.id);
  });
});

test('Test 8: GET /api/admin/leads - should filter by date range (startDate)', async () => {
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const response = await apiRequest(`/api/admin/leads?startDate=${threeDaysAgo}`);

  expect(response.status).toBe(200);
  expect(response.data.data.filters.startDate).toBe(threeDaysAgo);

  // All returned leads should be after startDate
  response.data.data.leads.forEach(lead => {
    expect(new Date(lead.createdAt).getTime()).toBeGreaterThanOrEqual(new Date(threeDaysAgo).getTime());
  });
});

test('Test 9: GET /api/admin/leads - should filter by date range (endDate)', async () => {
  const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
  const response = await apiRequest(`/api/admin/leads?endDate=${fourDaysAgo}`);

  expect(response.status).toBe(200);
  expect(response.data.data.filters.endDate).toBe(fourDaysAgo);

  // All returned leads should be before endDate
  response.data.data.leads.forEach(lead => {
    expect(new Date(lead.createdAt).getTime()).toBeLessThanOrEqual(new Date(fourDaysAgo).getTime());
  });
});

test('Test 10: GET /api/admin/leads - should filter by date range (startDate and endDate)', async () => {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

  const response = await apiRequest(`/api/admin/leads?startDate=${sevenDaysAgo}&endDate=${threeDaysAgo}`);

  expect(response.status).toBe(200);

  // All returned leads should be within range
  response.data.data.leads.forEach(lead => {
    const createdAt = new Date(lead.createdAt).getTime();
    expect(createdAt).toBeGreaterThanOrEqual(new Date(sevenDaysAgo).getTime());
    expect(createdAt).toBeLessThanOrEqual(new Date(threeDaysAgo).getTime());
  });
});

test('Test 11: GET /api/admin/leads - should sort by createdAt desc (default)', async () => {
  const response = await apiRequest('/api/admin/leads');

  expect(response.status).toBe(200);
  expect(response.data.data.sort.sortBy).toBe('createdAt');
  expect(response.data.data.sort.sortOrder).toBe('desc');

  // Verify leads are sorted newest first
  if (response.data.data.leads.length > 1) {
    for (let i = 0; i < response.data.data.leads.length - 1; i++) {
      const current = new Date(response.data.data.leads[i].createdAt).getTime();
      const next = new Date(response.data.data.leads[i + 1].createdAt).getTime();
      expect(current).toBeGreaterThanOrEqual(next);
    }
  }
});

test('Test 12: GET /api/admin/leads - should sort by createdAt asc', async () => {
  const response = await apiRequest('/api/admin/leads?sortBy=createdAt&sortOrder=asc');

  expect(response.status).toBe(200);
  expect(response.data.data.sort.sortOrder).toBe('asc');

  // Verify leads are sorted oldest first
  if (response.data.data.leads.length > 1) {
    for (let i = 0; i < response.data.data.leads.length - 1; i++) {
      const current = new Date(response.data.data.leads[i].createdAt).getTime();
      const next = new Date(response.data.data.leads[i + 1].createdAt).getTime();
      expect(current).toBeLessThanOrEqual(next);
    }
  }
});

test('Test 13: GET /api/admin/leads - should sort by status', async () => {
  const response = await apiRequest('/api/admin/leads?sortBy=status&sortOrder=asc');

  expect(response.status).toBe(200);
  expect(response.data.data.sort.sortBy).toBe('status');
  expect(response.data.data.sort.sortOrder).toBe('asc');
});

test('Test 14: GET /api/admin/leads - should sort by zipCode', async () => {
  const response = await apiRequest('/api/admin/leads?sortBy=zipCode&sortOrder=asc');

  expect(response.status).toBe(200);
  expect(response.data.data.sort.sortBy).toBe('zipCode');
});

test('Test 15: GET /api/admin/leads - should combine multiple filters', async () => {
  const response = await apiRequest(
    `/api/admin/leads?status=SOLD&serviceTypeId=${testServiceType.id}&sortBy=createdAt&sortOrder=desc`
  );

  expect(response.status).toBe(200);
  expect(response.data.data.filters.status).toBe('SOLD');
  expect(response.data.data.filters.serviceTypeId).toBe(testServiceType.id);
  expect(response.data.data.sort.sortBy).toBe('createdAt');
  expect(response.data.data.sort.sortOrder).toBe('desc');
});

test('Test 16: GET /api/admin/leads - should return empty array for no matches', async () => {
  const response = await apiRequest('/api/admin/leads?status=NONEXISTENT');

  expect(response.status).toBe(200);
  expect(response.data.data.leads).toEqual([]);
  expect(response.data.data.pagination.totalCount).toBe(0);
});

test('Test 17: GET /api/admin/leads - should include requestId in response', async () => {
  const response = await apiRequest('/api/admin/leads');

  expect(response.status).toBe(200);
  expect(response.data).toHaveProperty('requestId');
  expect(typeof response.data.requestId).toBe('string');
});

test('Test 18: GET /api/admin/leads - should require authentication', async () => {
  // Call directly without using apiRequest to avoid auto-added headers
  const response = await fetch(`${BASE_URL}/api/admin/leads`, {
    headers: {
      'Content-Type': 'application/json'
      // No Authorization header
    }
  });
  const data = await response.json();

  expect(response.status).toBe(401);
});

// ============================================================================
// GET /api/admin/leads?analytics=true - Lead Analytics (8 tests)
// ============================================================================

test('Test 19: GET /api/admin/leads?analytics=true - should return analytics with default period', async () => {
  const response = await apiRequest('/api/admin/leads?analytics=true');

  expect(response.status).toBe(200);
  expect(response.data.success).toBe(true);
  expect(response.data.data).toHaveProperty('summary');
  expect(response.data.data).toHaveProperty('byStatus');
  expect(response.data.data).toHaveProperty('byServiceType');
  expect(response.data.data).toHaveProperty('timeline');
  expect(response.data.data).toHaveProperty('period');
  expect(response.data.data.period).toBe('7d'); // Default period
});

test('Test 20: GET /api/admin/leads?analytics=true - should return summary metrics', async () => {
  const response = await apiRequest('/api/admin/leads?analytics=true');

  expect(response.status).toBe(200);
  expect(response.data.data.summary).toHaveProperty('totalLeads');
  expect(response.data.data.summary).toHaveProperty('averageValue');
  expect(response.data.data.summary).toHaveProperty('conversionRate');
  expect(response.data.data.summary).toHaveProperty('totalRevenue');
  expect(typeof response.data.data.summary.totalLeads).toBe('number');
  expect(typeof response.data.data.summary.averageValue).toBe('number');
  expect(typeof response.data.data.summary.conversionRate).toBe('string');
  expect(response.data.data.summary.conversionRate).toContain('%');
});

test('Test 21: GET /api/admin/leads?analytics=true - should return breakdown by status', async () => {
  const response = await apiRequest('/api/admin/leads?analytics=true');

  expect(response.status).toBe(200);
  expect(response.data.data.byStatus).toHaveProperty('pending');
  expect(response.data.data.byStatus).toHaveProperty('processing');
  expect(response.data.data.byStatus).toHaveProperty('auctioned');
  expect(response.data.data.byStatus).toHaveProperty('sold');
  expect(response.data.data.byStatus).toHaveProperty('rejected');
  expect(response.data.data.byStatus).toHaveProperty('expired');
  expect(typeof response.data.data.byStatus.sold).toBe('number');
});

test('Test 22: GET /api/admin/leads?analytics=true - should return breakdown by service type', async () => {
  const response = await apiRequest('/api/admin/leads?analytics=true');

  expect(response.status).toBe(200);
  expect(typeof response.data.data.byServiceType).toBe('object');
});

test('Test 23: GET /api/admin/leads?analytics=true - should return timeline data', async () => {
  const response = await apiRequest('/api/admin/leads?analytics=true');

  expect(response.status).toBe(200);
  expect(Array.isArray(response.data.data.timeline)).toBe(true);
  expect(response.data.data.timeline.length).toBe(7); // 7 days for default period

  if (response.data.data.timeline.length > 0) {
    const day = response.data.data.timeline[0];
    expect(day).toHaveProperty('date');
    expect(day).toHaveProperty('leads');
    expect(day).toHaveProperty('revenue');
    expect(typeof day.leads).toBe('number');
    expect(typeof day.revenue).toBe('number');
  }
});

test('Test 24: GET /api/admin/leads?analytics=true&period=24h - should return 24h analytics', async () => {
  const response = await apiRequest('/api/admin/leads?analytics=true&period=24h');

  expect(response.status).toBe(200);
  expect(response.data.data.period).toBe('24h');
  expect(response.data.data.timeline.length).toBe(1); // 1 day
});

test('Test 25: GET /api/admin/leads?analytics=true&period=30d - should return 30d analytics', async () => {
  const response = await apiRequest('/api/admin/leads?analytics=true&period=30d');

  expect(response.status).toBe(200);
  expect(response.data.data.period).toBe('30d');
  expect(response.data.data.timeline.length).toBe(30); // 30 days
});

test('Test 26: GET /api/admin/leads?analytics=true - should require authentication', async () => {
  // Call directly without using apiRequest to avoid auto-added headers
  const response = await fetch(`${BASE_URL}/api/admin/leads?analytics=true`, {
    headers: {
      'Content-Type': 'application/json'
      // No Authorization header
    }
  });
  const data = await response.json();

  expect(response.status).toBe(401);
});

// ============================================================================
// GET /api/admin/leads/[id] - Get Single Lead (14 tests)
// ============================================================================

test('Test 27: GET /api/admin/leads/[id] - should return full lead details', async () => {
  const response = await apiRequest(`/api/admin/leads/${testLead1.id}`);

  expect(response.status).toBe(200);
  expect(response.data.success).toBe(true);
  expect(response.data.data).toHaveProperty('id');
  expect(response.data.data.id).toBe(testLead1.id);
  expect(response.data.data).toHaveProperty('serviceTypeId');
  expect(response.data.data).toHaveProperty('serviceType');
  expect(response.data.data).toHaveProperty('status');
  expect(response.data.data).toHaveProperty('formData');
  expect(response.data.data).toHaveProperty('compliance');
  expect(response.data.data).toHaveProperty('metadata');
  expect(response.data.data).toHaveProperty('transactions');
  expect(response.data.data).toHaveProperty('auctionResults');
  expect(response.data.data).toHaveProperty('createdAt');
  expect(response.data.data).toHaveProperty('updatedAt');
});

test('Test 28: GET /api/admin/leads/[id] - should include full unmasked form data', async () => {
  const response = await apiRequest(`/api/admin/leads/${testLead1.id}`);

  expect(response.status).toBe(200);
  expect(response.data.data.formData).toHaveProperty('firstName');
  expect(response.data.data.formData).toHaveProperty('lastName');
  expect(response.data.data.formData).toHaveProperty('email');
  expect(response.data.data.formData).toHaveProperty('phone');

  // Should be unmasked (no asterisks)
  expect(response.data.data.formData.email).not.toContain('*');
  expect(response.data.data.formData.email).toBe('john.doe@test.com');
});

test('Test 29: GET /api/admin/leads/[id] - should include serviceType relation', async () => {
  const response = await apiRequest(`/api/admin/leads/${testLead1.id}`);

  expect(response.status).toBe(200);
  expect(response.data.data.serviceType).toHaveProperty('id');
  expect(response.data.data.serviceType).toHaveProperty('name');
  expect(response.data.data.serviceType).toHaveProperty('displayName');
  expect(response.data.data.serviceType.id).toBe(testServiceType.id);
});

test('Test 30: GET /api/admin/leads/[id] - should include winningBuyer relation', async () => {
  const response = await apiRequest(`/api/admin/leads/${testLead1.id}`);

  expect(response.status).toBe(200);
  expect(response.data.data).toHaveProperty('winningBuyer');
  expect(response.data.data.winningBuyer).toHaveProperty('id');
  expect(response.data.data.winningBuyer).toHaveProperty('name');
  expect(response.data.data.winningBuyer).toHaveProperty('type');
  expect(response.data.data.winningBuyer.id).toBe(testBuyer.id);
});

test('Test 31: GET /api/admin/leads/[id] - should include compliance data', async () => {
  const response = await apiRequest(`/api/admin/leads/${testLead1.id}`);

  expect(response.status).toBe(200);
  expect(response.data.data.compliance).toHaveProperty('trustedFormCertUrl');
  expect(response.data.data.compliance).toHaveProperty('trustedFormCertId');
  expect(response.data.data.compliance).toHaveProperty('jornayaLeadId');
  expect(response.data.data.compliance).toHaveProperty('complianceData');
  expect(response.data.data.compliance).toHaveProperty('leadQualityScore');
  expect(response.data.data.compliance).toHaveProperty('audits');
  expect(response.data.data.compliance.trustedFormCertUrl).toBe('https://cert.trustedform.com/test1');
  expect(response.data.data.compliance.jornayaLeadId).toBe('jorn-1');
});

test('Test 32: GET /api/admin/leads/[id] - should include compliance audits', async () => {
  const response = await apiRequest(`/api/admin/leads/${testLead1.id}`);

  expect(response.status).toBe(200);
  expect(Array.isArray(response.data.data.compliance.audits)).toBe(true);

  if (response.data.data.compliance.audits.length > 0) {
    const audit = response.data.data.compliance.audits[0];
    expect(audit).toHaveProperty('id');
    expect(audit).toHaveProperty('eventType');
    expect(audit).toHaveProperty('eventData');
    expect(audit).toHaveProperty('createdAt');
  }
});

test('Test 33: GET /api/admin/leads/[id] - should include transactions', async () => {
  const response = await apiRequest(`/api/admin/leads/${testLead1.id}`);

  expect(response.status).toBe(200);
  expect(Array.isArray(response.data.data.transactions)).toBe(true);
  expect(response.data.data.transactions.length).toBeGreaterThan(0);

  const tx = response.data.data.transactions[0];
  expect(tx).toHaveProperty('id');
  expect(tx).toHaveProperty('buyerId');
  expect(tx).toHaveProperty('actionType');
  expect(tx).toHaveProperty('status');
  expect(tx).toHaveProperty('bidAmount');
  expect(tx).toHaveProperty('createdAt');
});

test('Test 34: GET /api/admin/leads/[id] - should include auction results', async () => {
  const response = await apiRequest(`/api/admin/leads/${testLead1.id}`);

  expect(response.status).toBe(200);
  expect(response.data.data.auctionResults).toBeTruthy();
  expect(response.data.data.auctionResults).toHaveProperty('winningBuyerId');
  expect(response.data.data.auctionResults).toHaveProperty('winningBid');
  expect(response.data.data.auctionResults).toHaveProperty('allBids');
  expect(response.data.data.auctionResults).toHaveProperty('status');
  expect(Array.isArray(response.data.data.auctionResults.allBids)).toBe(true);
});

test('Test 35: GET /api/admin/leads/[id] - should include metadata', async () => {
  const response = await apiRequest(`/api/admin/leads/${testLead1.id}`);

  expect(response.status).toBe(200);
  expect(response.data.data.metadata).toHaveProperty('processingDuration');
  expect(response.data.data.metadata).toHaveProperty('qualityScore');
  expect(typeof response.data.data.metadata.processingDuration).toBe('number');
  expect(typeof response.data.data.metadata.qualityScore).toBe('number');
});

test('Test 36: GET /api/admin/leads/[id] - should return 404 for non-existent lead', async () => {
  const fakeId = '00000000-0000-0000-0000-000000000000';
  const response = await apiRequest(`/api/admin/leads/${fakeId}`);

  expect(response.status).toBe(404);
  expect(response.data.error).toHaveProperty('code');
  expect(response.data.error.code).toBe('LEAD_NOT_FOUND');
});

test('Test 37: GET /api/admin/leads/[id] - should return 400 for invalid UUID format', async () => {
  const response = await apiRequest('/api/admin/leads/invalid-id');

  expect(response.status).toBe(400);
  expect(response.data.error).toHaveProperty('code');
  expect(response.data.error.code).toBe('INVALID_ID');
});

test('Test 38: GET /api/admin/leads/[id] - should include requestId in response', async () => {
  const response = await apiRequest(`/api/admin/leads/${testLead1.id}`);

  expect(response.status).toBe(200);
  expect(response.data).toHaveProperty('requestId');
  expect(typeof response.data.requestId).toBe('string');
});

test('Test 39: GET /api/admin/leads/[id] - should handle lead without transactions gracefully', async () => {
  const response = await apiRequest(`/api/admin/leads/${testLead3.id}`);

  expect(response.status).toBe(200);
  expect(response.data.data.transactions).toEqual([]);
  expect(response.data.data.auctionResults).toBeNull();
});

test('Test 40: GET /api/admin/leads/[id] - should require authentication', async () => {
  // Call directly without using apiRequest to avoid auto-added headers
  const response = await fetch(`${BASE_URL}/api/admin/leads/${testLead1.id}`, {
    headers: {
      'Content-Type': 'application/json'
      // No Authorization header
    }
  });
  const data = await response.json();

  expect(response.status).toBe(401);
});

// ============================================================================
// PUT /api/admin/leads/[id] - Update Lead Status (14 tests)
// ============================================================================

test('Test 41: PUT /api/admin/leads/[id] - should update lead status (PENDING -> PROCESSING)', async () => {
  const response = await apiRequest(`/api/admin/leads/${testLead3.id}`, {
    method: 'PUT',
    body: {
      status: 'PROCESSING',
      reason: 'Test status update'
    }
  });

  expect(response.status).toBe(200);
  expect(response.data.success).toBe(true);
  expect(response.data.data).toHaveProperty('leadId');
  expect(response.data.data).toHaveProperty('status');
  expect(response.data.data.status).toBe('PROCESSING');
  expect(response.data.data).toHaveProperty('updatedAt');
});

test('Test 42: PUT /api/admin/leads/[id] - should update lead status (PENDING -> REJECTED)', async () => {
  // Create a fresh PENDING lead for this test
  const tempLead = await prisma.lead.create({
    data: {
      serviceTypeId: testServiceType.id,
      formData: JSON.stringify({ firstName: 'Temp', lastName: 'Lead' }),
      zipCode: '12345',
      status: 'PENDING',
      ownsHome: false,
      timeframe: '1_3_MONTHS'
    }
  });

  const response = await apiRequest(`/api/admin/leads/${tempLead.id}`, {
    method: 'PUT',
    body: {
      status: 'REJECTED',
      reason: 'Test rejection'
    }
  });

  expect(response.status).toBe(200);
  expect(response.data.data.status).toBe('REJECTED');

  // Clean up
  await prisma.lead.delete({ where: { id: tempLead.id } });
});

test('Test 43: PUT /api/admin/leads/[id] - should update lead status (AUCTIONED -> SOLD)', async () => {
  const response = await apiRequest(`/api/admin/leads/${testLead2.id}`, {
    method: 'PUT',
    body: {
      status: 'SOLD',
      reason: 'Test sale'
    }
  });

  expect(response.status).toBe(200);
  expect(response.data.data.status).toBe('SOLD');
});

test('Test 44: PUT /api/admin/leads/[id] - should update lead status (AUCTIONED -> EXPIRED)', async () => {
  // Create a fresh AUCTIONED lead for this test
  const tempLead = await prisma.lead.create({
    data: {
      serviceTypeId: testServiceType.id,
      formData: JSON.stringify({ firstName: 'Temp2', lastName: 'Lead' }),
      zipCode: '12345',
      status: 'AUCTIONED',
      ownsHome: false,
      timeframe: '1_3_MONTHS'
    }
  });

  const response = await apiRequest(`/api/admin/leads/${tempLead.id}`, {
    method: 'PUT',
    body: {
      status: 'EXPIRED',
      reason: 'Test expiration'
    }
  });

  expect(response.status).toBe(200);
  expect(response.data.data.status).toBe('EXPIRED');

  // Clean up
  await prisma.lead.delete({ where: { id: tempLead.id } });
});

test('Test 45: PUT /api/admin/leads/[id] - should create compliance audit log entry', async () => {
  // Create a fresh PENDING lead for this test
  const tempLead = await prisma.lead.create({
    data: {
      serviceTypeId: testServiceType.id,
      formData: JSON.stringify({ firstName: 'Audit', lastName: 'Test' }),
      zipCode: '12345',
      status: 'PENDING',
      ownsHome: false,
      timeframe: '1_3_MONTHS'
    }
  });

  const response = await apiRequest(`/api/admin/leads/${tempLead.id}`, {
    method: 'PUT',
    body: {
      status: 'PROCESSING',
      reason: 'Compliance audit test'
    }
  });

  expect(response.status).toBe(200);

  // Check that audit log was created
  const auditLogs = await prisma.complianceAuditLog.findMany({
    where: {
      leadId: tempLead.id,
      eventType: 'ADMIN_STATUS_CHANGE'
    }
  });

  expect(auditLogs.length).toBeGreaterThan(0);
  const audit = auditLogs[0];
  expect(audit.eventType).toBe('ADMIN_STATUS_CHANGE');

  const eventData = JSON.parse(audit.eventData);
  expect(eventData).toHaveProperty('oldStatus');
  expect(eventData).toHaveProperty('newStatus');
  expect(eventData).toHaveProperty('reason');
  expect(eventData.reason).toBe('Compliance audit test');

  // Clean up
  await prisma.complianceAuditLog.deleteMany({ where: { leadId: tempLead.id } });
  await prisma.lead.delete({ where: { id: tempLead.id } });
});

test('Test 46: PUT /api/admin/leads/[id] - should reject invalid status value', async () => {
  const response = await apiRequest(`/api/admin/leads/${testLead3.id}`, {
    method: 'PUT',
    body: {
      status: 'INVALID_STATUS'
    }
  });

  expect(response.status).toBe(400);
  expect(response.data.error).toHaveProperty('code');
  expect(response.data.error.code).toBe('INVALID_STATUS');
});

test('Test 47: PUT /api/admin/leads/[id] - should reject missing status field', async () => {
  const response = await apiRequest(`/api/admin/leads/${testLead3.id}`, {
    method: 'PUT',
    body: {
      reason: 'No status provided'
    }
  });

  expect(response.status).toBe(400);
  expect(response.data.error).toHaveProperty('code');
  expect(response.data.error.code).toBe('INVALID_STATUS');
});

test('Test 48: PUT /api/admin/leads/[id] - should reject invalid status transition (SOLD -> PROCESSING)', async () => {
  const response = await apiRequest(`/api/admin/leads/${testLead1.id}`, {
    method: 'PUT',
    body: {
      status: 'PROCESSING'
    }
  });

  expect(response.status).toBe(400);
  expect(response.data.error).toHaveProperty('code');
  expect(response.data.error.code).toBe('INVALID_STATUS_TRANSITION');
  expect(response.data.error.message).toContain('Cannot transition from SOLD');
});

test('Test 49: PUT /api/admin/leads/[id] - should reject invalid status transition (REJECTED -> PENDING)', async () => {
  const response = await apiRequest(`/api/admin/leads/${testLead4.id}`, {
    method: 'PUT',
    body: {
      status: 'PENDING'
    }
  });

  expect(response.status).toBe(400);
  expect(response.data.error.code).toBe('INVALID_STATUS_TRANSITION');
  expect(response.data.error.message).toContain('Cannot transition from REJECTED');
});

test('Test 50: PUT /api/admin/leads/[id] - should allow EXPIRED -> PROCESSING transition', async () => {
  // Create a fresh EXPIRED lead for this test
  const tempLead = await prisma.lead.create({
    data: {
      serviceTypeId: testServiceType.id,
      formData: JSON.stringify({ firstName: 'Expired', lastName: 'Lead' }),
      zipCode: '12345',
      status: 'EXPIRED',
      ownsHome: false,
      timeframe: '1_3_MONTHS'
    }
  });

  const response = await apiRequest(`/api/admin/leads/${tempLead.id}`, {
    method: 'PUT',
    body: {
      status: 'PROCESSING',
      reason: 'Reprocessing expired lead'
    }
  });

  expect(response.status).toBe(200);
  expect(response.data.data.status).toBe('PROCESSING');

  // Clean up
  await prisma.lead.delete({ where: { id: tempLead.id } });
});

test('Test 51: PUT /api/admin/leads/[id] - should return 404 for non-existent lead', async () => {
  const fakeId = '00000000-0000-0000-0000-000000000000';
  const response = await apiRequest(`/api/admin/leads/${fakeId}`, {
    method: 'PUT',
    body: {
      status: 'PROCESSING'
    }
  });

  expect(response.status).toBe(404);
  expect(response.data.error.code).toBe('LEAD_NOT_FOUND');
});

test('Test 52: PUT /api/admin/leads/[id] - should include requestId in response', async () => {
  // Create a fresh PENDING lead for this test
  const tempLead = await prisma.lead.create({
    data: {
      serviceTypeId: testServiceType.id,
      formData: JSON.stringify({ firstName: 'RequestId', lastName: 'Test' }),
      zipCode: '12345',
      status: 'PENDING',
      ownsHome: false,
      timeframe: '1_3_MONTHS'
    }
  });

  const response = await apiRequest(`/api/admin/leads/${tempLead.id}`, {
    method: 'PUT',
    body: {
      status: 'PROCESSING'
    }
  });

  expect(response.status).toBe(200);
  expect(response.data).toHaveProperty('requestId');
  expect(typeof response.data.requestId).toBe('string');

  // Clean up
  await prisma.lead.delete({ where: { id: tempLead.id } });
});

test('Test 53: PUT /api/admin/leads/[id] - should require Content-Type header', async () => {
  const response = await apiRequest(`/api/admin/leads/${testLead3.id}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${ADMIN_API_KEY}`
      // No Content-Type
    },
    body: JSON.stringify({ status: 'PROCESSING' })
  });

  // Accept both 400 (validation) and 500 (parse error) depending on Next.js version
  expect([400, 500]).toContain(response.status);
});

test('Test 54: PUT /api/admin/leads/[id] - should require authentication', async () => {
  // Call directly without using apiRequest to avoid auto-added headers
  const response = await fetch(`${BASE_URL}/api/admin/leads/${testLead3.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
      // No Authorization header
    },
    body: JSON.stringify({
      status: 'PROCESSING'
    })
  });
  const data = await response.json();

  expect(response.status).toBe(401);
});
