/**
 * Comprehensive E2E API Integration Test
 * Tests the full HTTP stack: HTTP → Middleware → Route Handlers → Prisma → Database
 */

const BASE_URL = 'http://localhost:3002';
const API_KEY = 'admin-api-key-secure-replace-in-production'; // From .env

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration?: number;
}

const results: TestResult[] = [];

// Helper function to make API requests
async function apiRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ ok: boolean; status: number; data?: any; error?: string }> {
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        ...options.headers
      }
    });

    let data;
    try {
      data = await response.json();
    } catch (e) {
      data = null;
    }

    return {
      ok: response.ok,
      status: response.status,
      data,
      error: !response.ok ? (data?.error?.message || data?.message || JSON.stringify(data)) : undefined
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: (error as Error).message
    };
  }
}

// Test helper
async function runTest(name: string, fn: () => Promise<void>) {
  const start = Date.now();
  try {
    await fn();
    results.push({
      name,
      passed: true,
      duration: Date.now() - start
    });
    console.log(`✅ ${name} (${Date.now() - start}ms)`);
  } catch (error) {
    results.push({
      name,
      passed: false,
      error: (error as Error).message,
      duration: Date.now() - start
    });
    console.error(`❌ ${name}: ${(error as Error).message}`);
  }
}

// Assertion helpers
function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function assertEqual(actual: any, expected: any, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}\nExpected: ${expected}\nActual: ${actual}`);
  }
}

async function runTests() {
  console.log('========================================');
  console.log('E2E API Integration Tests');
  console.log('========================================\n');

  // Generate unique test data with timestamp
  const timestamp = Date.now();
  const testBuyerName = `E2E Test Contractor ${timestamp}`;
  const testZipCode = `${Math.floor(10000 + Math.random() * 90000)}`; // Random 5-digit ZIP

  let createdBuyerId: string | undefined;
  let createdConfigId: string | undefined;
  let createdZipCodeId: string | undefined;
  let testLeadId: string | undefined;

  // ===========================================
  // PRE-TEST CLEANUP
  // ===========================================
  console.log('\n🧹 Pre-test cleanup...\n');

  try {
    // Find and delete any existing E2E test buyers
    const existingBuyers = await apiRequest('/api/admin/buyers?search=E2E%20Test%20Contractor');
    if (existingBuyers.ok && existingBuyers.data?.data?.buyers) {
      for (const buyer of existingBuyers.data.data.buyers) {
        if (buyer.name.startsWith('E2E Test Contractor')) {
          console.log(`   Cleaning up existing test buyer: ${buyer.name}`);
          await apiRequest(`/api/admin/buyers/${buyer.id}`, { method: 'DELETE' });
        }
      }
    }
    console.log('   Pre-test cleanup complete\n');
  } catch (error) {
    console.log('   Pre-test cleanup skipped (non-critical)\n');
  }

  // ===========================================
  // BUYER MANAGEMENT TESTS
  // ===========================================
  console.log('\n📋 Testing Buyer Management APIs...\n');

  await runTest('GET /api/admin/buyers - List all buyers', async () => {
    const res = await apiRequest('/api/admin/buyers');
    assert(res.ok, `Request failed: ${res.error}`);
    assert(res.data.success, 'Response success should be true');
    assert(Array.isArray(res.data.data.buyers), 'Should return buyers array');
    assert(res.data.data.buyers.length > 0, 'Should have at least one buyer');
    assert(res.data.data.pagination, 'Should include pagination');
    console.log(`   Found ${res.data.data.buyers.length} buyers`);
  });

  await runTest('GET /api/admin/buyers?type=NETWORK - Filter by type', async () => {
    const res = await apiRequest('/api/admin/buyers?type=NETWORK');
    assert(res.ok, `Request failed: ${res.error}`);
    assert(res.data.success, 'Response success should be true');
    const networkBuyers = res.data.data.buyers.filter((b: any) => b.type === 'NETWORK');
    assertEqual(networkBuyers.length, res.data.data.buyers.length, 'All buyers should be NETWORK type');
    console.log(`   Found ${networkBuyers.length} network buyers`);
  });

  await runTest('GET /api/admin/buyers?search=Home - Search by name', async () => {
    const res = await apiRequest('/api/admin/buyers?search=Home');
    assert(res.ok, `Request failed: ${res.error}`);
    assert(res.data.success, 'Response success should be true');
    console.log(`   Found ${res.data.data.buyers.length} buyers matching "Home"`);
  });

  await runTest('GET /api/admin/buyers?page=1&limit=5 - Pagination', async () => {
    const res = await apiRequest('/api/admin/buyers?page=1&limit=5');
    assert(res.ok, `Request failed: ${res.error}`);
    assert(res.data.data.buyers.length <= 5, 'Should return max 5 buyers');
    assert(res.data.data.pagination.limit === 5, 'Limit should be 5');
    console.log(`   Page 1: ${res.data.data.buyers.length} buyers`);
  });

  await runTest('POST /api/admin/buyers - Create new buyer', async () => {
    const res = await apiRequest('/api/admin/buyers', {
      method: 'POST',
      body: JSON.stringify({
        name: testBuyerName,
        type: 'CONTRACTOR',
        apiUrl: 'https://api.e2etest.com/leads',
        authConfig: {
          type: 'bearer',
          credentials: {
            token: 'test_token_e2e'
          }
        },
        contactName: 'E2E Tester',
        contactEmail: 'e2e@test.com',
        active: true,
        pingTimeout: 30,
        postTimeout: 60
      })
    });
    assert(res.ok, `Request failed: ${res.error}`);
    assert(res.data.success, 'Response success should be true');
    assert(res.data.data.id, 'Should return created buyer ID');
    assertEqual(res.data.data.name, testBuyerName, 'Name should match');
    createdBuyerId = res.data.data.id;
    console.log(`   Created buyer: ${createdBuyerId}`);
  });

  await runTest('GET /api/admin/buyers/[id] - Get specific buyer', async () => {
    const res = await apiRequest(`/api/admin/buyers/${createdBuyerId}`);
    assert(res.ok, `Request failed: ${res.error}`);
    assert(res.data.success, 'Response success should be true');
    assertEqual(res.data.data.name, testBuyerName, 'Name should match');
    assert(res.data.data.serviceConfigs, 'Should include service configs');
    assert(res.data.data.stats, 'Should include stats');
    console.log(`   Retrieved buyer with ${res.data.data.serviceConfigs.length} configs`);
  });

  await runTest('PUT /api/admin/buyers/[id] - Update buyer', async () => {
    const res = await apiRequest(`/api/admin/buyers/${createdBuyerId}`, {
      method: 'PUT',
      body: JSON.stringify({
        contactPhone: '555-E2E-TEST',
        active: false
      })
    });
    assert(res.ok, `Request failed: ${res.error}`);
    assert(res.data.success, 'Response success should be true');
    assertEqual(res.data.data.contactPhone, '555-E2E-TEST', 'Phone should be updated');
    assertEqual(res.data.data.active, false, 'Active should be false');
    console.log(`   Updated buyer phone and active status`);
  });

  await runTest('POST /api/admin/buyers - Duplicate name validation', async () => {
    const res = await apiRequest('/api/admin/buyers', {
      method: 'POST',
      body: JSON.stringify({
        name: testBuyerName, // Duplicate name
        type: 'CONTRACTOR',
        apiUrl: 'https://api.test.com',
        authConfig: {
          type: 'bearer',
          credentials: { token: 'test' }
        }
      })
    });
    assertEqual(res.status, 409, 'Should return 409 Conflict');
    assert(!res.ok, 'Should fail for duplicate name');
    console.log(`   Correctly rejected duplicate buyer name`);
  });

  // ===========================================
  // SERVICE CONFIGURATION TESTS
  // ===========================================
  console.log('\n📋 Testing Service Configuration APIs...\n');

  await runTest('GET /api/admin/buyers/service-configs?buyerId=X - List configs', async () => {
    const res = await apiRequest(`/api/admin/buyers/service-configs?buyerId=${createdBuyerId}`);
    assert(res.ok, `Request failed: ${res.error}`);
    assert(res.data.success, 'Response success should be true');
    assert(Array.isArray(res.data.data.configs), 'Should return configs array');
    console.log(`   Found ${res.data.data.configs.length} service configs`);
  });

  await runTest('POST /api/admin/buyers/service-configs - Create config', async () => {
    // Get first service type
    const serviceTypes = await apiRequest('/api/admin/buyers/service-configs');
    const firstServiceTypeId = '1fefd5b3-f999-4ea0-b967-0142a5a71ee1'; // Windows from seed

    const res = await apiRequest('/api/admin/buyers/service-configs', {
      method: 'POST',
      body: JSON.stringify({
        buyerId: createdBuyerId,
        serviceTypeId: firstServiceTypeId,
        pingTemplate: '{}',
        postTemplate: '{}',
        fieldMappings: '{}',
        minBid: 20,
        maxBid: 100,
        requiresTrustedForm: true,
        requiresJornaya: false,
        active: true
      })
    });
    assert(res.ok, `Request failed: ${res.error}`);
    assert(res.data.success, 'Response success should be true');
    assert(res.data.data.config.id, 'Should return created config ID');
    createdConfigId = res.data.data.config.id;
    console.log(`   Created service config: ${createdConfigId}`);
  });

  await runTest('PUT /api/admin/buyers/service-configs/[id] - Update config', async () => {
    const res = await apiRequest(`/api/admin/buyers/service-configs/${createdConfigId}`, {
      method: 'PUT',
      body: JSON.stringify({
        maxBid: 150,
        active: false
      })
    });
    assert(res.ok, `Request failed: ${res.error}`);
    assert(res.data.success, 'Response success should be true');
    assertEqual(res.data.data.config.maxBid, 150, 'Max bid should be updated');
    console.log(`   Updated config max bid to $150`);
  });

  // ===========================================
  // ZIP CODE TESTS
  // ===========================================
  console.log('\n📋 Testing ZIP Code Management APIs...\n');

  await runTest('POST /api/admin/buyers/service-zip-codes - Create ZIP code', async () => {
    const res = await apiRequest('/api/admin/buyers/service-zip-codes', {
      method: 'POST',
      body: JSON.stringify({
        buyerId: createdBuyerId,
        serviceTypeId: '1fefd5b3-f999-4ea0-b967-0142a5a71ee1', // Windows from seed
        zipCode: testZipCode
      })
    });
    assert(res.ok, `Request failed: ${res.error}`);
    assert(res.data.success, 'Response success should be true');
    createdZipCodeId = res.data.data.zipCode.id;
    console.log(`   Created ZIP code: ${testZipCode}`);
  });

  await runTest('GET /api/admin/buyers/service-zip-codes?buyerId=X - List ZIP codes', async () => {
    const res = await apiRequest(`/api/admin/buyers/service-zip-codes?buyerId=${createdBuyerId}`);
    assert(res.ok, `Request failed: ${res.error}`);
    assert(res.data.success, 'Response success should be true');
    assert(res.data.data.zipCodes.length > 0, 'Should have at least one ZIP code');
    console.log(`   Found ${res.data.data.zipCodes.length} ZIP codes for buyer`);
  });

  await runTest('GET /api/admin/buyers/service-zip-codes?zipCode=X - Search by ZIP', async () => {
    const res = await apiRequest(`/api/admin/buyers/service-zip-codes?zipCode=${testZipCode}`);
    assert(res.ok, `Request failed: ${res.error}`);
    assert(res.data.data.zipCodes.length >= 1, 'Should find the ZIP code we created');
    console.log(`   Found ZIP code ${testZipCode}`);
  });

  // ===========================================
  // LEAD MANAGEMENT TESTS
  // ===========================================
  console.log('\n📋 Testing Lead Management APIs...\n');

  await runTest('GET /api/admin/leads - List all leads', async () => {
    const res = await apiRequest('/api/admin/leads');
    assert(res.ok, `Request failed: ${res.error}`);
    assert(res.data.success, 'Response success should be true');
    assert(Array.isArray(res.data.data.leads), 'Should return leads array');
    assert(res.data.data.leads.length > 0, 'Should have at least one lead');
    assert(res.data.data.pagination, 'Should include pagination');
    testLeadId = res.data.data.leads[0].id;
    console.log(`   Found ${res.data.data.leads.length} leads`);
  });

  await runTest('GET /api/admin/leads?status=SOLD - Filter by status', async () => {
    const res = await apiRequest('/api/admin/leads?status=SOLD');
    assert(res.ok, `Request failed: ${res.error}`);
    assert(res.data.success, 'Response success should be true');
    const soldLeads = res.data.data.leads.filter((l: any) => l.status === 'SOLD');
    assertEqual(soldLeads.length, res.data.data.leads.length, 'All leads should be SOLD');
    console.log(`   Found ${soldLeads.length} SOLD leads`);
  });

  await runTest('GET /api/admin/leads?serviceTypeId=X - Filter by service type', async () => {
    const serviceTypeId = '550e8400-e29b-41d4-a716-446655440001';
    const res = await apiRequest(`/api/admin/leads?serviceTypeId=${serviceTypeId}`);
    assert(res.ok, `Request failed: ${res.error}`);
    assert(res.data.success, 'Response success should be true');
    console.log(`   Found ${res.data.data.leads.length} leads for service type`);
  });

  await runTest('GET /api/admin/leads?startDate=X&endDate=Y - Date range filter', async () => {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const res = await apiRequest(`/api/admin/leads?startDate=${startDate}&endDate=${endDate}`);
    assert(res.ok, `Request failed: ${res.error}`);
    assert(res.data.success, 'Response success should be true');
    console.log(`   Found ${res.data.data.leads.length} leads in last 7 days`);
  });

  await runTest('GET /api/admin/leads?page=1&limit=10 - Pagination', async () => {
    const res = await apiRequest('/api/admin/leads?page=1&limit=10');
    assert(res.ok, `Request failed: ${res.error}`);
    assert(res.data.data.leads.length <= 10, 'Should return max 10 leads');
    assertEqual(res.data.data.pagination.limit, 10, 'Limit should be 10');
    console.log(`   Page 1: ${res.data.data.leads.length} leads`);
  });

  await runTest('GET /api/admin/leads?sortBy=createdAt&sortOrder=asc - Sorting', async () => {
    const res = await apiRequest('/api/admin/leads?sortBy=createdAt&sortOrder=asc');
    assert(res.ok, `Request failed: ${res.error}`);
    assert(res.data.data.sort.sortBy === 'createdAt', 'Sort by should be createdAt');
    assert(res.data.data.sort.sortOrder === 'asc', 'Sort order should be asc');
    console.log(`   Sorted by createdAt ascending`);
  });

  await runTest('GET /api/admin/leads/[id] - Get specific lead', async () => {
    const res = await apiRequest(`/api/admin/leads/${testLeadId}`);
    assert(res.ok, `Request failed: ${res.error}`);
    assert(res.data.success, 'Response success should be true');
    assert(res.data.data.id === testLeadId, 'Lead ID should match');
    assert(res.data.data.serviceType, 'Should include service type');
    assert(res.data.data.transactions, 'Should include transactions');
    assert(res.data.data.compliance, 'Should include compliance data');
    console.log(`   Retrieved lead with ${res.data.data.transactions.length} transactions`);
  });

  await runTest('PUT /api/admin/leads/[id] - Update lead status (invalid transition)', async () => {
    const res = await apiRequest(`/api/admin/leads/${testLeadId}`, {
      method: 'PUT',
      body: JSON.stringify({
        status: 'INVALID_STATUS'
      })
    });
    assertEqual(res.status, 400, 'Should return 400 Bad Request');
    assert(!res.ok, 'Should fail for invalid status');
    console.log(`   Correctly rejected invalid status`);
  });

  await runTest('GET /api/admin/leads?analytics=true - Lead analytics', async () => {
    const res = await apiRequest('/api/admin/leads?analytics=true&period=7d');
    assert(res.ok, `Request failed: ${res.error}`);
    assert(res.data.success, 'Response success should be true');
    assert(res.data.data.summary, 'Should include summary');
    assert(res.data.data.byStatus, 'Should include status breakdown');
    assert(res.data.data.byServiceType, 'Should include service type breakdown');
    assert(Array.isArray(res.data.data.timeline), 'Should include timeline');
    console.log(`   Analytics: ${res.data.data.summary.totalLeads} leads, $${res.data.data.summary.totalRevenue} revenue`);
  });

  // ===========================================
  // DATA MASKING TESTS
  // ===========================================
  console.log('\n📋 Testing Data Security & Masking...\n');

  await runTest('Lead data masking - Email/Phone masked in list view', async () => {
    const res = await apiRequest('/api/admin/leads?limit=1');
    const lead = res.data.data.leads[0];
    if (lead.formData.email) {
      assert(lead.formData.email.includes('*'), 'Email should be masked with asterisks');
      console.log(`   Email masked: ${lead.formData.email}`);
    }
    if (lead.formData.phone) {
      assert(lead.formData.phone.includes('***'), 'Phone should be masked');
      console.log(`   Phone masked: ${lead.formData.phone}`);
    }
  });

  await runTest('Buyer auth config - Only type returned, not credentials', async () => {
    const res = await apiRequest(`/api/admin/buyers/${createdBuyerId}`);
    assert(res.data.data.authType, 'Should include auth type');
    assert(res.data.data.credentialKeys, 'Should include credential keys');
    assert(!res.data.data.authConfig, 'Should not include full auth config');
    console.log(`   Auth type exposed: ${res.data.data.authType}, credentials hidden`);
  });

  // ===========================================
  // ERROR HANDLING TESTS
  // ===========================================
  console.log('\n📋 Testing Error Handling...\n');

  await runTest('GET /api/admin/buyers/[id] - Invalid UUID format', async () => {
    const res = await apiRequest('/api/admin/buyers/invalid-uuid');
    assertEqual(res.status, 400, 'Should return 400 Bad Request');
    console.log(`   Correctly rejected invalid UUID`);
  });

  await runTest('GET /api/admin/buyers/[id] - Non-existent buyer', async () => {
    const res = await apiRequest('/api/admin/buyers/550e8400-0000-0000-0000-000000000000');
    assertEqual(res.status, 404, 'Should return 404 Not Found');
    console.log(`   Correctly returned 404 for non-existent buyer`);
  });

  await runTest('GET /api/admin/leads/[id] - Non-existent lead', async () => {
    const res = await apiRequest('/api/admin/leads/550e8400-0000-0000-0000-000000000000');
    assertEqual(res.status, 404, 'Should return 404 Not Found');
    console.log(`   Correctly returned 404 for non-existent lead`);
  });

  // ===========================================
  // CLEANUP
  // ===========================================
  console.log('\n📋 Cleanup...\n');

  // Cleanup with error handling - don't fail tests if cleanup fails
  if (createdZipCodeId) {
    try {
      const res = await apiRequest(`/api/admin/buyers/service-zip-codes/${createdZipCodeId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        console.log(`   ✓ Deleted ZIP code: ${testZipCode}`);
      } else {
        console.log(`   ⚠ Failed to delete ZIP code: ${res.error}`);
      }
    } catch (error) {
      console.log(`   ⚠ Cleanup error (non-critical): ${error}`);
    }
  }

  if (createdConfigId) {
    try {
      const res = await apiRequest(`/api/admin/buyers/service-configs/${createdConfigId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        console.log(`   ✓ Deleted service config`);
      } else {
        console.log(`   ⚠ Failed to delete service config: ${res.error}`);
      }
    } catch (error) {
      console.log(`   ⚠ Cleanup error (non-critical): ${error}`);
    }
  }

  if (createdBuyerId) {
    try {
      const res = await apiRequest(`/api/admin/buyers/${createdBuyerId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        console.log(`   ✓ Deleted test buyer: ${testBuyerName}`);
      } else {
        console.log(`   ⚠ Failed to delete test buyer: ${res.error}`);
      }
    } catch (error) {
      console.log(`   ⚠ Cleanup error (non-critical): ${error}`);
    }
  }

  console.log('   Cleanup complete');

  // ===========================================
  // SUMMARY
  // ===========================================
  console.log('\n========================================');
  console.log('Test Summary');
  console.log('========================================\n');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const totalDuration = results.reduce((sum, r) => sum + (r.duration || 0), 0);

  console.log(`Total: ${results.length} tests`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏱️  Duration: ${totalDuration}ms\n`);

  if (failed > 0) {
    console.log('Failed tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  ❌ ${r.name}: ${r.error}`);
    });
    console.log('');
  }

  const successRate = ((passed / results.length) * 100).toFixed(1);
  console.log(`Success Rate: ${successRate}%\n`);

  if (failed === 0) {
    console.log('🎉 All tests passed! System is production ready.');
  } else {
    console.log('⚠️  Some tests failed. Review errors above.');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
