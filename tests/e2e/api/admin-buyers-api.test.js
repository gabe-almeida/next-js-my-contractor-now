/**
 * E2E Tests for Admin Buyer Management APIs
 * Domain 1.3: Admin Buyer Management (60+ tests)
 *
 * Endpoints tested:
 * - GET /api/admin/buyers - List buyers
 * - POST /api/admin/buyers - Create buyer
 * - GET /api/admin/buyers/[id] - Get specific buyer
 * - PUT /api/admin/buyers/[id] - Update buyer
 * - DELETE /api/admin/buyers/[id] - Delete buyer
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const assert = require('assert');

const BASE_URL = 'http://localhost:3002';
const ADMIN_API_KEY = 'test-admin-key-12345'; // Must match ADMIN_API_KEY in .env.local

// Helper function to make API requests
async function apiRequest(endpoint, options = {}) {
  try {
    // Automatically stringify body if it's an object
    const fetchOptions = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        // Add Authorization header for admin endpoints
        ...(endpoint.startsWith('/api/admin') ? { 'Authorization': `Bearer ${ADMIN_API_KEY}` } : {}),
        ...options.headers
      }
    };

    // If body is an object (not a string), stringify it
    if (fetchOptions.body && typeof fetchOptions.body === 'object') {
      fetchOptions.body = JSON.stringify(fetchOptions.body);
    }

    const response = await fetch(`${BASE_URL}${endpoint}`, fetchOptions);

    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      data = { error: 'Non-JSON response', body: text };
    }

    return {
      ok: response.ok,
      status: response.status,
      data,
      error: !response.ok ? (JSON.stringify(data.error || data.message || data || 'Request failed')) : null
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: error.message
    };
  }
}

// Test tracking
let passedTests = 0;
let failedTests = 0;
let testResults = [];

// Helper function to run a single test
async function runTest(testName, testFn) {
  try {
    console.log(`\n🧪 Running: ${testName}`);
    await testFn();
    console.log(`✅ PASSED: ${testName}`);
    passedTests++;
    testResults.push({ name: testName, status: 'PASSED' });
  } catch (error) {
    console.error(`❌ FAILED: ${testName}`);
    console.error(`   Error: ${error.message}`);
    failedTests++;
    testResults.push({ name: testName, status: 'FAILED', error: error.message });
    throw error; // Re-throw to stop execution
  }
}

// Main test runner
async function runTests() {
  console.log('\n==========================================');
  console.log('DOMAIN 1.3: ADMIN BUYER MANAGEMENT APIS');
  console.log('==========================================\n');

  const startTime = Date.now();

  // Test data setup - IDs to track created records
  let createdBuyerId1 = null;
  let createdBuyerId2 = null;
  let createdBuyerId3 = null;

  try {
    // ============================================
    // SECTION 1: POST /api/admin/buyers - CREATE
    // ============================================
    console.log('\n--- SECTION 1: POST /api/admin/buyers (CREATE) ---');

    // TEST 1: Create buyer with minimal required fields
    await runTest('POST /api/admin/buyers - Create with minimal required fields', async () => {
      const timestamp = Date.now();
      const res = await apiRequest('/api/admin/buyers', {
        method: 'POST',
        body: {
          name: `Test Buyer Minimal ${timestamp}`,
          apiUrl: 'https://api.testbuyer.com/leads',
          authConfig: {
            type: 'apikey',
            credentials: {
              apiKey: 'test-api-key-123'
            }
          }
        }
      });

      assert(res.ok, `Request failed: ${res.error}`);
      assert.strictEqual(res.status, 201, 'Should return 201 Created');
      assert(res.data.success, 'Response should indicate success');
      assert(res.data.data.id, 'Should return buyer ID');
      assert.strictEqual(res.data.data.name, `Test Buyer Minimal ${timestamp}`, 'Name should match');
      assert.strictEqual(res.data.data.apiUrl, 'https://api.testbuyer.com/leads', 'API URL should match');
      assert.strictEqual(res.data.data.authType, 'apikey', 'Auth type should match');
      assert.strictEqual(res.data.data.active, true, 'Should default to active');
      assert(res.data.data.createdAt, 'Should have createdAt timestamp');

      createdBuyerId1 = res.data.data.id;
      console.log(`   ✓ Created buyer with ID: ${createdBuyerId1}`);
    });

    // TEST 2: Create buyer with all optional fields
    await runTest('POST /api/admin/buyers - Create with all optional fields', async () => {
      const timestamp = Date.now();
      const res = await apiRequest('/api/admin/buyers', {
        method: 'POST',
        body: {
          name: `Test Buyer Complete ${timestamp}`,
          type: 'CONTRACTOR',
          apiUrl: 'https://api.contractor.com/v2/leads',
          authConfig: {
            type: 'bearer',
            credentials: {
              token: 'bearer-token-xyz-789'
            }
          },
          active: true,
          contactName: 'John Smith',
          contactEmail: 'john@contractor.com',
          contactPhone: '555-0123',
          businessEmail: 'info@contractor.com',
          businessPhone: '555-0100',
          pingTimeout: 45,
          postTimeout: 90
        }
      });

      assert(res.ok, `Request failed: ${res.error}`);
      assert.strictEqual(res.status, 201, 'Should return 201 Created');
      assert(res.data.data.id, 'Should return buyer ID');
      assert.strictEqual(res.data.data.type, 'CONTRACTOR', 'Type should match');
      assert.strictEqual(res.data.data.contactName, 'John Smith', 'Contact name should match');
      assert.strictEqual(res.data.data.contactEmail, 'john@contractor.com', 'Contact email should match');

      createdBuyerId2 = res.data.data.id;
      console.log(`   ✓ Created buyer with all fields: ${createdBuyerId2}`);
    });

    // TEST 3: Create NETWORK type buyer
    await runTest('POST /api/admin/buyers - Create NETWORK type buyer', async () => {
      const timestamp = Date.now();
      const res = await apiRequest('/api/admin/buyers', {
        method: 'POST',
        body: {
          name: `Test Network Buyer ${timestamp}`,
          type: 'NETWORK',
          apiUrl: 'https://network.leads.com/api/v1',
          authConfig: {
            type: 'basic',
            credentials: {
              username: 'network_user',
              password: 'network_pass'
            }
          }
        }
      });

      assert(res.ok, `Request failed: ${res.error}`);
      assert.strictEqual(res.status, 201, 'Should return 201 Created');
      assert.strictEqual(res.data.data.type, 'NETWORK', 'Type should be NETWORK');
      assert.strictEqual(res.data.data.authType, 'basic', 'Auth type should be basic');

      createdBuyerId3 = res.data.data.id;
      console.log(`   ✓ Created NETWORK buyer: ${createdBuyerId3}`);
    });

    // TEST 4: Reject duplicate buyer name
    await runTest('POST /api/admin/buyers - Reject duplicate name', async () => {
      const timestamp = Date.now();
      const duplicateName = `Duplicate Test ${timestamp}`;

      // Create first buyer
      const res1 = await apiRequest('/api/admin/buyers', {
        method: 'POST',
        body: {
          name: duplicateName,
          apiUrl: 'https://api.first.com/leads',
          authConfig: {
            type: 'apikey',
            credentials: { apiKey: 'key1' }
          }
        }
      });

      assert(res1.ok, 'First buyer creation should succeed');
      const firstBuyerId = res1.data.data.id;

      // Try to create duplicate
      const res2 = await apiRequest('/api/admin/buyers', {
        method: 'POST',
        body: {
          name: duplicateName,
          apiUrl: 'https://api.second.com/leads',
          authConfig: {
            type: 'apikey',
            credentials: { apiKey: 'key2' }
          }
        }
      });

      assert(!res2.ok, 'Duplicate name should be rejected');
      assert.strictEqual(res2.status, 409, 'Should return 409 Conflict');
      assert(res2.data.error, 'Should have error');
      assert(res2.data.error.code === 'BUYER_NAME_EXISTS' || res2.data.error.message.includes('already exists'), 'Should indicate name exists');

      // Clean up first buyer
      await prisma.buyer.delete({ where: { id: firstBuyerId } });
      console.log(`   ✓ Duplicate name correctly rejected`);
    });

    // TEST 5: Reject invalid API URL - non-HTTP protocol
    await runTest('POST /api/admin/buyers - Reject invalid API URL (non-HTTP)', async () => {
      const timestamp = Date.now();
      const res = await apiRequest('/api/admin/buyers', {
        method: 'POST',
        body: {
          name: `Test Invalid URL ${timestamp}`,
          apiUrl: 'ftp://invalid.com/leads',
          authConfig: {
            type: 'apikey',
            credentials: { apiKey: 'test' }
          }
        }
      });

      assert(!res.ok, 'Invalid URL should be rejected');
      assert.strictEqual(res.status, 400, 'Should return 400 Bad Request');
      assert(res.data.error, 'Should have error');
      console.log(`   ✓ Non-HTTP protocol correctly rejected`);
    });

    // TEST 6: Reject malformed API URL
    await runTest('POST /api/admin/buyers - Reject malformed API URL', async () => {
      const timestamp = Date.now();
      const res = await apiRequest('/api/admin/buyers', {
        method: 'POST',
        body: {
          name: `Test Malformed URL ${timestamp}`,
          apiUrl: 'not-a-valid-url',
          authConfig: {
            type: 'apikey',
            credentials: { apiKey: 'test' }
          }
        }
      });

      assert(!res.ok, 'Malformed URL should be rejected');
      assert.strictEqual(res.status, 400, 'Should return 400 Bad Request');
      console.log(`   ✓ Malformed URL correctly rejected`);
    });

    // TEST 7: Reject missing required field - name
    await runTest('POST /api/admin/buyers - Reject missing name', async () => {
      const res = await apiRequest('/api/admin/buyers', {
        method: 'POST',
        body: {
          apiUrl: 'https://api.test.com/leads',
          authConfig: {
            type: 'apikey',
            credentials: { apiKey: 'test' }
          }
        }
      });

      assert(!res.ok, 'Missing name should be rejected');
      assert.strictEqual(res.status, 400, 'Should return 400 Bad Request');
      console.log(`   ✓ Missing name correctly rejected`);
    });

    // TEST 8: Reject missing required field - apiUrl
    await runTest('POST /api/admin/buyers - Reject missing apiUrl', async () => {
      const timestamp = Date.now();
      const res = await apiRequest('/api/admin/buyers', {
        method: 'POST',
        body: {
          name: `Test No URL ${timestamp}`,
          authConfig: {
            type: 'apikey',
            credentials: { apiKey: 'test' }
          }
        }
      });

      assert(!res.ok, 'Missing apiUrl should be rejected');
      assert.strictEqual(res.status, 400, 'Should return 400 Bad Request');
      console.log(`   ✓ Missing apiUrl correctly rejected`);
    });

    // TEST 9: Reject missing required field - authConfig
    await runTest('POST /api/admin/buyers - Reject missing authConfig', async () => {
      const timestamp = Date.now();
      const res = await apiRequest('/api/admin/buyers', {
        method: 'POST',
        body: {
          name: `Test No Auth ${timestamp}`,
          apiUrl: 'https://api.test.com/leads'
        }
      });

      assert(!res.ok, 'Missing authConfig should be rejected');
      assert.strictEqual(res.status, 400, 'Should return 400 Bad Request');
      console.log(`   ✓ Missing authConfig correctly rejected`);
    });

    // TEST 10: Reject invalid auth type
    await runTest('POST /api/admin/buyers - Reject invalid authConfig type', async () => {
      const timestamp = Date.now();
      const res = await apiRequest('/api/admin/buyers', {
        method: 'POST',
        body: {
          name: `Test Invalid Auth ${timestamp}`,
          apiUrl: 'https://api.test.com/leads',
          authConfig: {
            type: 'oauth', // Invalid - only apikey, bearer, basic allowed
            credentials: { token: 'test' }
          }
        }
      });

      assert(!res.ok, 'Invalid auth type should be rejected');
      assert.strictEqual(res.status, 400, 'Should return 400 Bad Request');
      console.log(`   ✓ Invalid auth type correctly rejected`);
    });

    // TEST 11: Reject name too short
    await runTest('POST /api/admin/buyers - Reject name too short', async () => {
      const res = await apiRequest('/api/admin/buyers', {
        method: 'POST',
        body: {
          name: 'AB', // Only 2 chars, minimum is 3
          apiUrl: 'https://api.test.com/leads',
          authConfig: {
            type: 'apikey',
            credentials: { apiKey: 'test' }
          }
        }
      });

      assert(!res.ok, 'Name too short should be rejected');
      assert.strictEqual(res.status, 400, 'Should return 400 Bad Request');
      console.log(`   ✓ Short name correctly rejected`);
    });

    // TEST 12: Reject name too long
    await runTest('POST /api/admin/buyers - Reject name too long', async () => {
      const longName = 'A'.repeat(101); // 101 chars, maximum is 100
      const res = await apiRequest('/api/admin/buyers', {
        method: 'POST',
        body: {
          name: longName,
          apiUrl: 'https://api.test.com/leads',
          authConfig: {
            type: 'apikey',
            credentials: { apiKey: 'test' }
          }
        }
      });

      assert(!res.ok, 'Name too long should be rejected');
      assert.strictEqual(res.status, 400, 'Should return 400 Bad Request');
      console.log(`   ✓ Long name correctly rejected`);
    });

    // TEST 13: Reject invalid email format
    await runTest('POST /api/admin/buyers - Reject invalid contact email', async () => {
      const timestamp = Date.now();
      const res = await apiRequest('/api/admin/buyers', {
        method: 'POST',
        body: {
          name: `Test Invalid Email ${timestamp}`,
          apiUrl: 'https://api.test.com/leads',
          authConfig: {
            type: 'apikey',
            credentials: { apiKey: 'test' }
          },
          contactEmail: 'not-an-email'
        }
      });

      assert(!res.ok, 'Invalid email should be rejected');
      assert.strictEqual(res.status, 400, 'Should return 400 Bad Request');
      console.log(`   ✓ Invalid email correctly rejected`);
    });

    // TEST 14: Reject invalid timeout values - too low
    await runTest('POST /api/admin/buyers - Reject pingTimeout too low', async () => {
      const timestamp = Date.now();
      const res = await apiRequest('/api/admin/buyers', {
        method: 'POST',
        body: {
          name: `Test Low Timeout ${timestamp}`,
          apiUrl: 'https://api.test.com/leads',
          authConfig: {
            type: 'apikey',
            credentials: { apiKey: 'test' }
          },
          pingTimeout: 0 // Min is 1
        }
      });

      assert(!res.ok, 'Timeout too low should be rejected');
      assert.strictEqual(res.status, 400, 'Should return 400 Bad Request');
      console.log(`   ✓ Low timeout correctly rejected`);
    });

    // TEST 15: Reject invalid timeout values - too high
    await runTest('POST /api/admin/buyers - Reject pingTimeout too high', async () => {
      const timestamp = Date.now();
      const res = await apiRequest('/api/admin/buyers', {
        method: 'POST',
        body: {
          name: `Test High Timeout ${timestamp}`,
          apiUrl: 'https://api.test.com/leads',
          authConfig: {
            type: 'apikey',
            credentials: { apiKey: 'test' }
          },
          pingTimeout: 301 // Max is 300
        }
      });

      assert(!res.ok, 'Timeout too high should be rejected');
      assert.strictEqual(res.status, 400, 'Should return 400 Bad Request');
      console.log(`   ✓ High timeout correctly rejected`);
    });

    // ============================================
    // SECTION 2: GET /api/admin/buyers - LIST
    // ============================================
    console.log('\n--- SECTION 2: GET /api/admin/buyers (LIST) ---');

    // TEST 16: List all active buyers
    await runTest('GET /api/admin/buyers - List all active buyers', async () => {
      const res = await apiRequest('/api/admin/buyers', {
        method: 'GET'
      });

      assert(res.ok, `Request failed: ${res.error}`);
      assert.strictEqual(res.status, 200, 'Should return 200 OK');
      assert(res.data.success, 'Response should indicate success');
      assert(Array.isArray(res.data.data.buyers), 'Should return buyers array');
      assert(res.data.data.pagination, 'Should include pagination');
      assert.strictEqual(typeof res.data.data.pagination.total, 'number', 'Should have total count');

      // Should include our created buyers
      const buyerIds = res.data.data.buyers.map(b => b.id);
      assert(buyerIds.includes(createdBuyerId1), 'Should include buyer 1');
      assert(buyerIds.includes(createdBuyerId2), 'Should include buyer 2');

      console.log(`   ✓ Listed ${res.data.data.buyers.length} buyers`);
    });

    // TEST 17: List buyers with pagination - page 1
    await runTest('GET /api/admin/buyers - Pagination page 1, limit 2', async () => {
      const res = await apiRequest('/api/admin/buyers?page=1&limit=2', {
        method: 'GET'
      });

      assert(res.ok, `Request failed: ${res.error}`);
      assert(res.data.data.buyers.length <= 2, 'Should return max 2 buyers');
      assert.strictEqual(res.data.data.pagination.page, 1, 'Should be page 1');
      assert.strictEqual(res.data.data.pagination.limit, 2, 'Should have limit 2');
      console.log(`   ✓ Pagination working - page 1 with ${res.data.data.buyers.length} buyers`);
    });

    // TEST 18: List buyers with pagination - page 2
    await runTest('GET /api/admin/buyers - Pagination page 2', async () => {
      const res = await apiRequest('/api/admin/buyers?page=2&limit=1', {
        method: 'GET'
      });

      assert(res.ok, `Request failed: ${res.error}`);
      assert.strictEqual(res.data.data.pagination.page, 2, 'Should be page 2');
      console.log(`   ✓ Page 2 returned successfully`);
    });

    // TEST 19: Filter by type - CONTRACTOR
    await runTest('GET /api/admin/buyers - Filter by type CONTRACTOR', async () => {
      const res = await apiRequest('/api/admin/buyers?type=CONTRACTOR', {
        method: 'GET'
      });

      assert(res.ok, `Request failed: ${res.error}`);

      // All returned buyers should be CONTRACTOR type
      const allContractors = res.data.data.buyers.every(b => b.type === 'CONTRACTOR');
      assert(allContractors, 'All buyers should be CONTRACTOR type');
      console.log(`   ✓ Filtered to ${res.data.data.buyers.length} CONTRACTOR buyers`);
    });

    // TEST 20: Filter by type - NETWORK
    await runTest('GET /api/admin/buyers - Filter by type NETWORK', async () => {
      const res = await apiRequest('/api/admin/buyers?type=NETWORK', {
        method: 'GET'
      });

      assert(res.ok, `Request failed: ${res.error}`);

      // All returned buyers should be NETWORK type
      const allNetworks = res.data.data.buyers.every(b => b.type === 'NETWORK');
      assert(allNetworks, 'All buyers should be NETWORK type');

      // Should include our NETWORK buyer
      const hasOurNetwork = res.data.data.buyers.some(b => b.id === createdBuyerId3);
      assert(hasOurNetwork, 'Should include our NETWORK buyer');
      console.log(`   ✓ Filtered to ${res.data.data.buyers.length} NETWORK buyers`);
    });

    // TEST 21: Search by name - partial match
    await runTest('GET /api/admin/buyers - Search by name (partial)', async () => {
      const res = await apiRequest('/api/admin/buyers?search=Test', {
        method: 'GET'
      });

      assert(res.ok, `Request failed: ${res.error}`);

      // All returned buyers should have "Test" in name
      const allMatch = res.data.data.buyers.every(b => b.name.includes('Test'));
      assert(allMatch, 'All buyers should match search term');
      console.log(`   ✓ Search found ${res.data.data.buyers.length} buyers with "Test"`);
    });

    // TEST 22: Search with no results
    await runTest('GET /api/admin/buyers - Search with no results', async () => {
      const res = await apiRequest('/api/admin/buyers?search=NonExistentBuyerXYZ123', {
        method: 'GET'
      });

      assert(res.ok, `Request failed: ${res.error}`);
      assert.strictEqual(res.data.data.buyers.length, 0, 'Should return empty array');
      assert.strictEqual(res.data.data.pagination.total, 0, 'Total should be 0');
      console.log(`   ✓ Empty search results handled correctly`);
    });

    // TEST 23: Verify sensitive auth data not exposed in list
    await runTest('GET /api/admin/buyers - Verify auth credentials not exposed', async () => {
      const res = await apiRequest('/api/admin/buyers', {
        method: 'GET'
      });

      assert(res.ok, `Request failed: ${res.error}`);

      // Check first buyer doesn't have auth credentials
      const firstBuyer = res.data.data.buyers[0];
      assert(!firstBuyer.authConfig, 'Should not expose full authConfig');
      assert(firstBuyer.authType, 'Should include authType');
      assert(!firstBuyer.credentials, 'Should not expose credentials');
      console.log(`   ✓ Auth credentials properly hidden from list`);
    });

    // TEST 24: Verify buyers include counts
    await runTest('GET /api/admin/buyers - Verify buyers include counts', async () => {
      const res = await apiRequest('/api/admin/buyers', {
        method: 'GET'
      });

      assert(res.ok, `Request failed: ${res.error}`);

      const firstBuyer = res.data.data.buyers[0];
      assert(typeof firstBuyer.serviceConfigCount === 'number', 'Should have serviceConfigCount');
      assert(typeof firstBuyer.zipCodeCount === 'number', 'Should have zipCodeCount');
      assert(typeof firstBuyer.leadsWon === 'number', 'Should have leadsWon count');
      console.log(`   ✓ Buyers include proper counts`);
    });

    // TEST 25: Create inactive buyer for includeInactive test
    let inactiveBuyerId;
    await runTest('Setup - Create inactive buyer', async () => {
      const timestamp = Date.now();
      const res = await apiRequest('/api/admin/buyers', {
        method: 'POST',
        body: {
          name: `Inactive Buyer ${timestamp}`,
          apiUrl: 'https://api.inactive.com/leads',
          authConfig: {
            type: 'apikey',
            credentials: { apiKey: 'inactive' }
          },
          active: false
        }
      });

      assert(res.ok, `Failed to create inactive buyer: ${res.error}`);
      inactiveBuyerId = res.data.data.id;
      console.log(`   ✓ Created inactive buyer: ${inactiveBuyerId}`);
    });

    // TEST 26: List excludes inactive buyers by default
    await runTest('GET /api/admin/buyers - Excludes inactive by default', async () => {
      const res = await apiRequest('/api/admin/buyers', {
        method: 'GET'
      });

      assert(res.ok, `Request failed: ${res.error}`);

      // Should not include inactive buyer
      const hasInactive = res.data.data.buyers.some(b => b.id === inactiveBuyerId);
      assert(!hasInactive, 'Should not include inactive buyer');

      // All buyers should be active
      const allActive = res.data.data.buyers.every(b => b.active === true);
      assert(allActive, 'All buyers should be active');
      console.log(`   ✓ Inactive buyers excluded by default`);
    });

    // TEST 27: includeInactive parameter includes inactive buyers
    await runTest('GET /api/admin/buyers - includeInactive=true shows all', async () => {
      const res = await apiRequest('/api/admin/buyers?includeInactive=true', {
        method: 'GET'
      });

      assert(res.ok, `Request failed: ${res.error}`);

      // Should include inactive buyer
      const hasInactive = res.data.data.buyers.some(b => b.id === inactiveBuyerId);
      assert(hasInactive, 'Should include inactive buyer');
      console.log(`   ✓ includeInactive shows all buyers`);
    });

    // ============================================
    // SECTION 3: GET /api/admin/buyers/[id]
    // ============================================
    console.log('\n--- SECTION 3: GET /api/admin/buyers/[id] (GET SPECIFIC) ---');

    // TEST 28: Get specific buyer by ID
    await runTest('GET /api/admin/buyers/[id] - Get specific buyer', async () => {
      const res = await apiRequest(`/api/admin/buyers/${createdBuyerId1}`, {
        method: 'GET'
      });

      assert(res.ok, `Request failed: ${res.error}`);
      assert.strictEqual(res.status, 200, 'Should return 200 OK');
      assert(res.data.success, 'Response should indicate success');
      assert.strictEqual(res.data.data.id, createdBuyerId1, 'Should return correct buyer');
      assert(res.data.data.name, 'Should have name');
      assert(res.data.data.apiUrl, 'Should have apiUrl');
      assert(res.data.data.authType, 'Should have authType');
      console.log(`   ✓ Retrieved buyer: ${res.data.data.name}`);
    });

    // TEST 29: Get buyer includes service configs
    await runTest('GET /api/admin/buyers/[id] - Includes service configs', async () => {
      const res = await apiRequest(`/api/admin/buyers/${createdBuyerId2}`, {
        method: 'GET'
      });

      assert(res.ok, `Request failed: ${res.error}`);
      assert(Array.isArray(res.data.data.serviceConfigs), 'Should include serviceConfigs array');
      console.log(`   ✓ Service configs included (${res.data.data.serviceConfigs.length} configs)`);
    });

    // TEST 30: Get buyer includes stats
    await runTest('GET /api/admin/buyers/[id] - Includes stats', async () => {
      const res = await apiRequest(`/api/admin/buyers/${createdBuyerId2}`, {
        method: 'GET'
      });

      assert(res.ok, `Request failed: ${res.error}`);
      assert(res.data.data.stats, 'Should include stats object');
      assert(typeof res.data.data.stats.zipCodeCount === 'number', 'Should have zipCodeCount');
      assert(typeof res.data.data.stats.leadsWon === 'number', 'Should have leadsWon');
      assert(typeof res.data.data.stats.totalTransactions === 'number', 'Should have totalTransactions');
      console.log(`   ✓ Stats included: ${JSON.stringify(res.data.data.stats)}`);
    });

    // TEST 31: Get buyer includes credential keys (but not values)
    await runTest('GET /api/admin/buyers/[id] - Includes credential keys', async () => {
      const res = await apiRequest(`/api/admin/buyers/${createdBuyerId2}`, {
        method: 'GET'
      });

      assert(res.ok, `Request failed: ${res.error}`);
      assert(Array.isArray(res.data.data.credentialKeys), 'Should include credentialKeys array');
      assert(res.data.data.credentialKeys.length > 0, 'Should have at least one credential key');

      // Should include 'token' for bearer auth
      assert(res.data.data.credentialKeys.includes('token'), 'Should include "token" key');

      // Should NOT include actual credential values
      assert(!res.data.data.credentials, 'Should not expose credential values');
      console.log(`   ✓ Credential keys: ${res.data.data.credentialKeys.join(', ')}`);
    });

    // TEST 32: Get buyer - buyer not found (404)
    await runTest('GET /api/admin/buyers/[id] - Buyer not found', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const res = await apiRequest(`/api/admin/buyers/${nonExistentId}`, {
        method: 'GET'
      });

      assert(!res.ok, 'Should fail for non-existent buyer');
      assert.strictEqual(res.status, 404, 'Should return 404 Not Found');
      assert(res.data.error, 'Should have error');
      console.log(`   ✓ 404 returned for non-existent buyer`);
    });

    // TEST 33: Get buyer - invalid UUID format
    await runTest('GET /api/admin/buyers/[id] - Invalid UUID format', async () => {
      const res = await apiRequest('/api/admin/buyers/not-a-uuid', {
        method: 'GET'
      });

      assert(!res.ok, 'Should fail for invalid UUID');
      assert.strictEqual(res.status, 400, 'Should return 400 Bad Request');
      assert(res.data.error, 'Should have error');
      console.log(`   ✓ 400 returned for invalid UUID`);
    });

    // TEST 34: Get buyer includes all contact info fields
    await runTest('GET /api/admin/buyers/[id] - Includes contact info', async () => {
      const res = await apiRequest(`/api/admin/buyers/${createdBuyerId2}`, {
        method: 'GET'
      });

      assert(res.ok, `Request failed: ${res.error}`);
      assert.strictEqual(res.data.data.contactName, 'John Smith', 'Should have contactName');
      assert.strictEqual(res.data.data.contactEmail, 'john@contractor.com', 'Should have contactEmail');
      assert.strictEqual(res.data.data.contactPhone, '555-0123', 'Should have contactPhone');
      assert.strictEqual(res.data.data.businessEmail, 'info@contractor.com', 'Should have businessEmail');
      assert.strictEqual(res.data.data.businessPhone, '555-0100', 'Should have businessPhone');
      console.log(`   ✓ All contact info present`);
    });

    // TEST 35: Get buyer includes timeout settings
    await runTest('GET /api/admin/buyers/[id] - Includes timeout settings', async () => {
      const res = await apiRequest(`/api/admin/buyers/${createdBuyerId2}`, {
        method: 'GET'
      });

      assert(res.ok, `Request failed: ${res.error}`);
      assert.strictEqual(res.data.data.pingTimeout, 45, 'Should have pingTimeout');
      assert.strictEqual(res.data.data.postTimeout, 90, 'Should have postTimeout');
      console.log(`   ✓ Timeout settings present`);
    });

    // ============================================
    // SECTION 4: PUT /api/admin/buyers/[id]
    // ============================================
    console.log('\n--- SECTION 4: PUT /api/admin/buyers/[id] (UPDATE) ---');

    // TEST 36: Update buyer name
    await runTest('PUT /api/admin/buyers/[id] - Update name', async () => {
      const newName = `Updated Buyer Name ${Date.now()}`;
      const res = await apiRequest(`/api/admin/buyers/${createdBuyerId1}`, {
        method: 'PUT',
        body: {
          name: newName
        }
      });

      assert(res.ok, `Request failed: ${res.error}`);
      assert.strictEqual(res.status, 200, 'Should return 200 OK');
      assert.strictEqual(res.data.data.name, newName, 'Name should be updated');
      console.log(`   ✓ Name updated to: ${newName}`);
    });

    // TEST 37: Update buyer active status
    await runTest('PUT /api/admin/buyers/[id] - Update active status', async () => {
      const res = await apiRequest(`/api/admin/buyers/${createdBuyerId1}`, {
        method: 'PUT',
        body: {
          active: false
        }
      });

      assert(res.ok, `Request failed: ${res.error}`);
      assert.strictEqual(res.data.data.active, false, 'Active should be false');

      // Set back to active
      const res2 = await apiRequest(`/api/admin/buyers/${createdBuyerId1}`, {
        method: 'PUT',
        body: { active: true }
      });
      assert(res2.ok, 'Should set back to active');
      console.log(`   ✓ Active status toggled successfully`);
    });

    // TEST 38: Update buyer API URL
    await runTest('PUT /api/admin/buyers/[id] - Update API URL', async () => {
      const newUrl = 'https://api.updated.com/v2/leads';
      const res = await apiRequest(`/api/admin/buyers/${createdBuyerId1}`, {
        method: 'PUT',
        body: {
          apiUrl: newUrl
        }
      });

      assert(res.ok, `Request failed: ${res.error}`);
      assert.strictEqual(res.data.data.apiUrl, newUrl, 'API URL should be updated');
      console.log(`   ✓ API URL updated`);
    });

    // TEST 39: Update buyer type
    await runTest('PUT /api/admin/buyers/[id] - Update type', async () => {
      const res = await apiRequest(`/api/admin/buyers/${createdBuyerId1}`, {
        method: 'PUT',
        body: {
          type: 'NETWORK'
        }
      });

      assert(res.ok, `Request failed: ${res.error}`);
      assert.strictEqual(res.data.data.type, 'NETWORK', 'Type should be updated');
      console.log(`   ✓ Type updated to NETWORK`);
    });

    // TEST 40: Update buyer contact information
    await runTest('PUT /api/admin/buyers/[id] - Update contact info', async () => {
      const res = await apiRequest(`/api/admin/buyers/${createdBuyerId1}`, {
        method: 'PUT',
        body: {
          contactName: 'Jane Doe',
          contactEmail: 'jane@updated.com',
          contactPhone: '555-9999'
        }
      });

      assert(res.ok, `Request failed: ${res.error}`);
      assert.strictEqual(res.data.data.contactName, 'Jane Doe', 'Contact name updated');
      assert.strictEqual(res.data.data.contactEmail, 'jane@updated.com', 'Contact email updated');
      assert.strictEqual(res.data.data.contactPhone, '555-9999', 'Contact phone updated');
      console.log(`   ✓ Contact info updated`);
    });

    // TEST 41: Update buyer auth config
    await runTest('PUT /api/admin/buyers/[id] - Update auth config', async () => {
      const res = await apiRequest(`/api/admin/buyers/${createdBuyerId1}`, {
        method: 'PUT',
        body: {
          authConfig: {
            type: 'bearer',
            credentials: {
              token: 'new-bearer-token-123'
            }
          }
        }
      });

      assert(res.ok, `Request failed: ${res.error}`);
      assert.strictEqual(res.data.data.authType, 'bearer', 'Auth type should be updated');
      console.log(`   ✓ Auth config updated to bearer`);
    });

    // TEST 42: Update buyer timeouts
    await runTest('PUT /api/admin/buyers/[id] - Update timeouts', async () => {
      const res = await apiRequest(`/api/admin/buyers/${createdBuyerId1}`, {
        method: 'PUT',
        body: {
          pingTimeout: 60,
          postTimeout: 120
        }
      });

      assert(res.ok, `Request failed: ${res.error}`);
      assert.strictEqual(res.data.data.pingTimeout, 60, 'Ping timeout updated');
      assert.strictEqual(res.data.data.postTimeout, 120, 'Post timeout updated');
      console.log(`   ✓ Timeouts updated`);
    });

    // TEST 43: Partial update (only one field)
    await runTest('PUT /api/admin/buyers/[id] - Partial update', async () => {
      const res = await apiRequest(`/api/admin/buyers/${createdBuyerId1}`, {
        method: 'PUT',
        body: {
          businessEmail: 'business@updated.com'
        }
      });

      assert(res.ok, `Request failed: ${res.error}`);
      assert.strictEqual(res.data.data.businessEmail, 'business@updated.com', 'Business email updated');
      console.log(`   ✓ Partial update successful`);
    });

    // TEST 44: Update - buyer not found
    await runTest('PUT /api/admin/buyers/[id] - Buyer not found', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const res = await apiRequest(`/api/admin/buyers/${nonExistentId}`, {
        method: 'PUT',
        body: {
          name: 'Updated Name'
        }
      });

      assert(!res.ok, 'Should fail for non-existent buyer');
      assert.strictEqual(res.status, 404, 'Should return 404 Not Found');
      console.log(`   ✓ 404 returned for non-existent buyer`);
    });

    // TEST 45: Update - reject duplicate name
    await runTest('PUT /api/admin/buyers/[id] - Reject duplicate name', async () => {
      // Try to update buyer1 to have buyer2's name
      const buyer2 = await prisma.buyer.findUnique({ where: { id: createdBuyerId2 } });

      const res = await apiRequest(`/api/admin/buyers/${createdBuyerId1}`, {
        method: 'PUT',
        body: {
          name: buyer2.name
        }
      });

      assert(!res.ok, 'Should reject duplicate name');
      assert.strictEqual(res.status, 409, 'Should return 409 Conflict');
      console.log(`   ✓ Duplicate name correctly rejected`);
    });

    // TEST 46: Update - reject invalid API URL
    await runTest('PUT /api/admin/buyers/[id] - Reject invalid API URL', async () => {
      const res = await apiRequest(`/api/admin/buyers/${createdBuyerId1}`, {
        method: 'PUT',
        body: {
          apiUrl: 'ftp://invalid.com/leads'
        }
      });

      assert(!res.ok, 'Should reject invalid API URL');
      assert.strictEqual(res.status, 400, 'Should return 400 Bad Request');
      console.log(`   ✓ Invalid API URL rejected`);
    });

    // TEST 47: Update - reject invalid email
    await runTest('PUT /api/admin/buyers/[id] - Reject invalid email', async () => {
      const res = await apiRequest(`/api/admin/buyers/${createdBuyerId1}`, {
        method: 'PUT',
        body: {
          contactEmail: 'not-an-email'
        }
      });

      assert(!res.ok, 'Should reject invalid email');
      assert.strictEqual(res.status, 400, 'Should return 400 Bad Request');
      console.log(`   ✓ Invalid email rejected`);
    });

    // TEST 48: Update - reject invalid timeout
    await runTest('PUT /api/admin/buyers/[id] - Reject invalid timeout', async () => {
      const res = await apiRequest(`/api/admin/buyers/${createdBuyerId1}`, {
        method: 'PUT',
        body: {
          pingTimeout: 0 // Too low
        }
      });

      assert(!res.ok, 'Should reject invalid timeout');
      assert.strictEqual(res.status, 400, 'Should return 400 Bad Request');
      console.log(`   ✓ Invalid timeout rejected`);
    });

    // ============================================
    // SECTION 5: DELETE /api/admin/buyers/[id]
    // ============================================
    console.log('\n--- SECTION 5: DELETE /api/admin/buyers/[id] (DELETE) ---');

    // TEST 49: Delete buyer successfully
    await runTest('DELETE /api/admin/buyers/[id] - Delete successfully', async () => {
      // Create a buyer specifically for deletion
      const timestamp = Date.now();
      const createRes = await apiRequest('/api/admin/buyers', {
        method: 'POST',
        body: {
          name: `Buyer To Delete ${timestamp}`,
          apiUrl: 'https://api.delete-me.com/leads',
          authConfig: {
            type: 'apikey',
            credentials: { apiKey: 'delete-me' }
          }
        }
      });

      assert(createRes.ok, 'Failed to create buyer for deletion test');
      const deleteBuyerId = createRes.data.data.id;

      // Now delete it
      const res = await apiRequest(`/api/admin/buyers/${deleteBuyerId}`, {
        method: 'DELETE'
      });

      assert(res.ok, `Request failed: ${res.error}`);
      assert.strictEqual(res.status, 200, 'Should return 200 OK');
      assert(res.data.success, 'Response should indicate success');
      assert(res.data.data.message, 'Should have success message');

      // Verify buyer is deleted
      const getRes = await apiRequest(`/api/admin/buyers/${deleteBuyerId}`, {
        method: 'GET'
      });
      assert(!getRes.ok, 'Buyer should no longer exist');
      assert.strictEqual(getRes.status, 404, 'Should return 404');
      console.log(`   ✓ Buyer deleted successfully`);
    });

    // TEST 50: Delete - buyer not found
    await runTest('DELETE /api/admin/buyers/[id] - Buyer not found', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const res = await apiRequest(`/api/admin/buyers/${nonExistentId}`, {
        method: 'DELETE'
      });

      assert(!res.ok, 'Should fail for non-existent buyer');
      assert.strictEqual(res.status, 404, 'Should return 404 Not Found');
      console.log(`   ✓ 404 returned for non-existent buyer`);
    });

    // TEST 51: Cannot delete buyer with service configurations
    await runTest('DELETE /api/admin/buyers/[id] - Cannot delete with service configs', async () => {
      // This test requires setting up a buyer with service configs
      // For now, we'll create a buyer and add a service config

      const timestamp = Date.now();
      const createRes = await apiRequest('/api/admin/buyers', {
        method: 'POST',
        body: {
          name: `Buyer With Configs ${timestamp}`,
          apiUrl: 'https://api.has-configs.com/leads',
          authConfig: {
            type: 'apikey',
            credentials: { apiKey: 'has-configs' }
          }
        }
      });

      assert(createRes.ok, 'Failed to create buyer');
      const buyerWithConfigsId = createRes.data.data.id;

      // Get a service type ID to create a config
      const serviceTypes = await prisma.serviceType.findFirst({
        where: { active: true }
      });

      if (serviceTypes) {
        // Create a service config for this buyer
        await prisma.buyerServiceConfig.create({
          data: {
            buyerId: buyerWithConfigsId,
            serviceTypeId: serviceTypes.id,
            minBid: 10,
            maxBid: 100,
            active: true,
            pingTemplate: JSON.stringify({}),
            postTemplate: JSON.stringify({}),
            fieldMappings: JSON.stringify({})
          }
        });

        // Try to delete - should fail
        const res = await apiRequest(`/api/admin/buyers/${buyerWithConfigsId}`, {
          method: 'DELETE'
        });

        assert(!res.ok, 'Should fail to delete buyer with configs');
        assert.strictEqual(res.status, 409, 'Should return 409 Conflict');
        assert(res.data.error, 'Should have error');

        // Clean up - delete config first, then buyer
        await prisma.buyerServiceConfig.deleteMany({
          where: { buyerId: buyerWithConfigsId }
        });
        await prisma.buyer.delete({ where: { id: buyerWithConfigsId } });

        console.log(`   ✓ Cannot delete buyer with service configs`);
      } else {
        console.log(`   ⚠ Skipped - no service types available`);
      }
    });

    // TEST 52: Cannot delete buyer with ZIP codes
    await runTest('DELETE /api/admin/buyers/[id] - Cannot delete with ZIP codes', async () => {
      // Create buyer and add ZIP code
      const timestamp = Date.now();
      const createRes = await apiRequest('/api/admin/buyers', {
        method: 'POST',
        body: {
          name: `Buyer With ZIPs ${timestamp}`,
          apiUrl: 'https://api.has-zips.com/leads',
          authConfig: {
            type: 'apikey',
            credentials: { apiKey: 'has-zips' }
          }
        }
      });

      assert(createRes.ok, 'Failed to create buyer');
      const buyerWithZipsId = createRes.data.data.id;

      // Get a service type ID
      const serviceTypes = await prisma.serviceType.findFirst({
        where: { active: true }
      });

      if (serviceTypes) {
        // Create a ZIP code entry for this buyer
        await prisma.buyerServiceZipCode.create({
          data: {
            buyerId: buyerWithZipsId,
            serviceTypeId: serviceTypes.id,
            zipCode: '12345',
            active: true
          }
        });

        // Try to delete - should fail
        const res = await apiRequest(`/api/admin/buyers/${buyerWithZipsId}`, {
          method: 'DELETE'
        });

        assert(!res.ok, 'Should fail to delete buyer with ZIP codes');
        assert.strictEqual(res.status, 409, 'Should return 409 Conflict');

        // Clean up
        await prisma.buyerServiceZipCode.deleteMany({
          where: { buyerId: buyerWithZipsId }
        });
        await prisma.buyer.delete({ where: { id: buyerWithZipsId } });

        console.log(`   ✓ Cannot delete buyer with ZIP codes`);
      } else {
        console.log(`   ⚠ Skipped - no service types available`);
      }
    });

    // ============================================
    // SECTION 6: RESPONSE STRUCTURE & VALIDATION
    // ============================================
    console.log('\n--- SECTION 6: RESPONSE STRUCTURE & VALIDATION ---');

    // TEST 53: List response includes requestId
    await runTest('Response structure - List includes requestId', async () => {
      const res = await apiRequest('/api/admin/buyers', {
        method: 'GET'
      });

      assert(res.ok, `Request failed: ${res.error}`);
      assert(res.data.requestId, 'Should include requestId');
      console.log(`   ✓ requestId present: ${res.data.requestId}`);
    });

    // TEST 54: Create response includes requestId
    await runTest('Response structure - Create includes requestId', async () => {
      const timestamp = Date.now();
      const res = await apiRequest('/api/admin/buyers', {
        method: 'POST',
        body: {
          name: `Test RequestId ${timestamp}`,
          apiUrl: 'https://api.test.com/leads',
          authConfig: {
            type: 'apikey',
            credentials: { apiKey: 'test' }
          }
        }
      });

      if (res.ok) {
        assert(res.data.requestId, 'Should include requestId');
        // Clean up
        await prisma.buyer.delete({ where: { id: res.data.data.id } });
        console.log(`   ✓ requestId present in create response`);
      } else {
        throw new Error(`Failed to create: ${res.error}`);
      }
    });

    // TEST 55: Error responses include requestId
    await runTest('Response structure - Errors include requestId', async () => {
      const res = await apiRequest('/api/admin/buyers/invalid-uuid', {
        method: 'GET'
      });

      assert(!res.ok, 'Should fail for invalid UUID');
      assert(res.data.requestId, 'Error should include requestId');
      console.log(`   ✓ requestId present in error response`);
    });

    // TEST 56: Verify pagination structure is correct
    await runTest('Response structure - Pagination structure', async () => {
      const res = await apiRequest('/api/admin/buyers?page=1&limit=5', {
        method: 'GET'
      });

      assert(res.ok, `Request failed: ${res.error}`);
      const pagination = res.data.data.pagination;

      assert(typeof pagination.page === 'number', 'page should be number');
      assert(typeof pagination.limit === 'number', 'limit should be number');
      assert(typeof pagination.total === 'number', 'total should be number');
      assert(typeof pagination.pages === 'number', 'pages should be number');

      // Verify calculation
      const expectedPages = Math.ceil(pagination.total / pagination.limit);
      assert.strictEqual(pagination.pages, expectedPages, 'pages calculation should be correct');
      console.log(`   ✓ Pagination structure correct`);
    });

    // TEST 57: Verify buyer object structure in list
    await runTest('Response structure - Buyer object in list', async () => {
      const res = await apiRequest('/api/admin/buyers', {
        method: 'GET'
      });

      assert(res.ok, `Request failed: ${res.error}`);
      const buyer = res.data.data.buyers[0];

      // Required fields
      assert(buyer.id, 'Should have id');
      assert(buyer.name, 'Should have name');
      assert(buyer.type, 'Should have type');
      assert(buyer.apiUrl, 'Should have apiUrl');
      assert(buyer.authType, 'Should have authType');
      assert(typeof buyer.active === 'boolean', 'Should have active');
      assert(typeof buyer.serviceConfigCount === 'number', 'Should have serviceConfigCount');
      assert(typeof buyer.zipCodeCount === 'number', 'Should have zipCodeCount');
      assert(typeof buyer.leadsWon === 'number', 'Should have leadsWon');
      assert(buyer.createdAt, 'Should have createdAt');
      assert(buyer.updatedAt, 'Should have updatedAt');

      console.log(`   ✓ Buyer object structure correct in list`);
    });

    // TEST 58: Verify buyer object structure in GET detail
    await runTest('Response structure - Buyer object in GET detail', async () => {
      const res = await apiRequest(`/api/admin/buyers/${createdBuyerId2}`, {
        method: 'GET'
      });

      assert(res.ok, `Request failed: ${res.error}`);
      const buyer = res.data.data;

      // Additional fields in detail view
      assert(Array.isArray(buyer.serviceConfigs), 'Should have serviceConfigs array');
      assert(buyer.stats, 'Should have stats object');
      assert(Array.isArray(buyer.credentialKeys), 'Should have credentialKeys array');
      assert(typeof buyer.pingTimeout === 'number', 'Should have pingTimeout');
      assert(typeof buyer.postTimeout === 'number', 'Should have postTimeout');

      console.log(`   ✓ Buyer detail object structure correct`);
    });

    // TEST 59: Verify timestamps are ISO 8601 format
    await runTest('Response structure - Timestamps are ISO 8601', async () => {
      const res = await apiRequest(`/api/admin/buyers/${createdBuyerId1}`, {
        method: 'GET'
      });

      assert(res.ok, `Request failed: ${res.error}`);

      const createdAt = new Date(res.data.data.createdAt);
      const updatedAt = new Date(res.data.data.updatedAt);

      assert(!isNaN(createdAt.getTime()), 'createdAt should be valid date');
      assert(!isNaN(updatedAt.getTime()), 'updatedAt should be valid date');

      console.log(`   ✓ Timestamps are valid ISO 8601`);
    });

    // TEST 60: Verify success/error response structure consistency
    await runTest('Response structure - Consistent success/error format', async () => {
      // Success response
      const successRes = await apiRequest('/api/admin/buyers', {
        method: 'GET'
      });
      assert(successRes.ok, 'Should succeed');
      assert(successRes.data.success === true, 'Success should be true');
      assert(successRes.data.data, 'Should have data');
      assert(successRes.data.requestId, 'Should have requestId');

      // Error response
      const errorRes = await apiRequest('/api/admin/buyers/invalid-id', {
        method: 'GET'
      });
      assert(!errorRes.ok, 'Should fail');
      assert(errorRes.data.success === false, 'Success should be false');
      assert(errorRes.data.error, 'Should have error');
      assert(errorRes.data.requestId, 'Should have requestId');

      console.log(`   ✓ Response structure consistent`);
    });

    // ============================================
    // CLEANUP
    // ============================================
    console.log('\n--- CLEANUP ---');

    // Clean up created test buyers
    const buyersToCleanup = [
      createdBuyerId1,
      createdBuyerId2,
      createdBuyerId3,
      inactiveBuyerId
    ].filter(id => id !== null);

    for (const buyerId of buyersToCleanup) {
      try {
        // First delete any related service configs and ZIP codes
        await prisma.buyerServiceConfig.deleteMany({
          where: { buyerId }
        });
        await prisma.buyerServiceZipCode.deleteMany({
          where: { buyerId }
        });

        // Then delete the buyer
        await prisma.buyer.delete({ where: { id: buyerId } });
        console.log(`   ✓ Cleaned up buyer: ${buyerId}`);
      } catch (error) {
        console.log(`   ⚠ Failed to cleanup buyer ${buyerId}: ${error.message}`);
      }
    }

  } catch (error) {
    console.error('\n❌ TEST SUITE FAILED');
    console.error(`Error: ${error.message}`);
    throw error;
  } finally {
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log('\n==========================================');
    console.log('TEST SUMMARY');
    console.log('==========================================');
    console.log(`Total Tests: ${passedTests + failedTests}`);
    console.log(`✅ Passed: ${passedTests}`);
    console.log(`❌ Failed: ${failedTests}`);
    console.log(`⏱️  Duration: ${duration}s`);
    console.log('==========================================\n');

    if (failedTests > 0) {
      console.log('FAILED TESTS:');
      testResults
        .filter(t => t.status === 'FAILED')
        .forEach(t => {
          console.log(`  ❌ ${t.name}`);
          console.log(`     Error: ${t.error}`);
        });
    }
  }
}

// Wrap in Jest test block so Jest recognizes this as a test
test('Admin Buyer Management API E2E Tests', async () => {
  try {
    await runTests();
  } catch (error) {
    console.error('Test suite failed:', error);
    await prisma.$disconnect();
    throw error; // Let Jest handle the failure
  }
}, 300000); // 5 minute timeout for all tests

// Disconnect Prisma after all tests
afterAll(async () => {
  await prisma.$disconnect();
});
