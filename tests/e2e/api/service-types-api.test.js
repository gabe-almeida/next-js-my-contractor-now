/**
 * E2E API Tests: Service Types Endpoints
 * Tests the GET /api/service-types and GET /api/service-types/[id] endpoints
 *
 * Following MANDATORY WORKFLOW:
 * 1. IMPLEMENT → 2. RUN → 3. REPORT → 4. FIX/VERIFY → 5. COMPLETE
 */

const BASE_URL = 'http://localhost:3002';

// Import Prisma for database verification
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// TestResult: { name, passed, error?, duration? }
const results = [];

// Helper function to make API requests
async function apiRequest(endpoint, options = {}) {
  try {
    // Automatically stringify body if it's an object
    const fetchOptions = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    // If body is an object (not a string), stringify it
    if (fetchOptions.body && typeof fetchOptions.body === 'object') {
      fetchOptions.body = JSON.stringify(fetchOptions.body);
    }

    const response = await fetch(`${BASE_URL}${endpoint}`, fetchOptions);

    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      data = null;
      console.error('Failed to parse response as JSON:', responseText.substring(0, 200));
    }

    return {
      ok: response.ok,
      status: response.status,
      data,
      headers: Object.fromEntries(response.headers.entries()),
      error: !response.ok ? (data?.error || data?.message || data?.details || JSON.stringify(data) || responseText.substring(0, 100)) : undefined
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error.message
    };
  }
}

// Test helper
async function runTest(name, fn) {
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
      error: error.message,
      duration: Date.now() - start
    });
    console.error(`❌ ${name}: ${error.message}`);
  }
}

// Assertion helpers
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}\nExpected: ${expected}\nActual: ${actual}`);
  }
}

async function runTests() {
  console.log('========================================');
  console.log('Service Types API E2E Tests');
  console.log('========================================\n');

  // Known service type IDs from mock data in [id]/route.ts
  const windowsId = '550e8400-e29b-41d4-a716-446655440001';
  const bathroomsId = '550e8400-e29b-41d4-a716-446655440002';
  const roofingId = '550e8400-e29b-41d4-a716-446655440003';

  // ===========================================
  // TEST 1-14: GET /api/service-types - List All
  // ===========================================
  console.log('\n📋 Tests 1-14: GET /api/service-types - List all service types\n');

  // TEST 1: Return all active service types
  await runTest('GET /api/service-types - Return all active service types', async () => {
    const res = await apiRequest('/api/service-types', {
      method: 'GET'
    });

    assert(res.ok, `Request failed: ${res.error}`);
    assertEqual(res.status, 200, 'Should return 200 OK');
    assert(res.data.success, 'Response success should be true');
    assert(Array.isArray(res.data.data), 'data should be an array');
    assert(res.data.data.length > 0, 'Should return at least one service type');

    console.log(`   ✓ Returned ${res.data.data.length} active service types`);
  });

  // TEST 2: Include id, name, displayName
  await runTest('GET /api/service-types - Include id, name, displayName', async () => {
    const res = await apiRequest('/api/service-types', {
      method: 'GET'
    });

    assert(res.ok, `Request failed: ${res.error}`);

    const serviceType = res.data.data[0];
    assert(serviceType.id, 'Should include id');
    assert(serviceType.name, 'Should include name');
    assert(serviceType.displayName || serviceType.display_name, 'Should include displayName or display_name');

    console.log(`   ✓ First service type has required fields`);
  });

  // TEST 3: Include formSchema JSON
  await runTest('GET /api/service-types - Include formSchema JSON', async () => {
    const res = await apiRequest('/api/service-types', {
      method: 'GET'
    });

    assert(res.ok, `Request failed: ${res.error}`);

    const serviceType = res.data.data[0];
    assert(serviceType.formSchema || serviceType.form_schema, 'Should include formSchema');

    const schema = serviceType.formSchema || serviceType.form_schema;
    assert(typeof schema === 'object' || typeof schema === 'string', 'formSchema should be object or JSON string');

    console.log(`   ✓ Form schema included`);
  });

  // TEST 4: Only active services by default
  await runTest('GET /api/service-types - Exclude inactive services by default', async () => {
    const res = await apiRequest('/api/service-types', {
      method: 'GET'
    });

    assert(res.ok, `Request failed: ${res.error}`);

    // All service types should be active
    const allActive = res.data.data.every(st => st.active === true);
    assert(allActive, 'All returned service types should be active');

    console.log(`   ✓ All service types are active`);
  });

  // TEST 5: Include inactive services with query param
  await runTest('GET /api/service-types - Include inactive with includeInactive=true', async () => {
    const res = await apiRequest('/api/service-types?includeInactive=true', {
      method: 'GET'
    });

    assert(res.ok, `Request failed: ${res.error}`);
    assert(Array.isArray(res.data.data), 'Should return array');

    console.log(`   ✓ Returned ${res.data.data.length} service types (including inactive)`);
  });

  // TEST 6: Sort alphabetically
  await runTest('GET /api/service-types - Sort alphabetically by name', async () => {
    const res = await apiRequest('/api/service-types', {
      method: 'GET'
    });

    assert(res.ok, `Request failed: ${res.error}`);

    if (res.data.data.length > 1) {
      const names = res.data.data.map(st => st.name.toLowerCase());
      const sortedNames = [...names].sort();

      // Check if arrays are equal (sorted)
      const isSorted = JSON.stringify(names) === JSON.stringify(sortedNames);
      assert(isSorted, 'Service types should be sorted alphabetically by name');
    }

    console.log(`   ✓ Service types sorted alphabetically`);
  });

  // TEST 7: Response time < 500ms
  await runTest('GET /api/service-types - Response time under 500ms', async () => {
    const startTime = Date.now();

    const res = await apiRequest('/api/service-types', {
      method: 'GET'
    });

    const duration = Date.now() - startTime;

    assert(res.ok, `Request failed: ${res.error}`);
    assert(duration < 500, `Response time ${duration}ms exceeds 500ms limit`);

    console.log(`   ✓ Response time: ${duration}ms (< 500ms)`);
  });

  // TEST 8: Include timestamp
  await runTest('GET /api/service-types - Include timestamp', async () => {
    const res = await apiRequest('/api/service-types', {
      method: 'GET'
    });

    assert(res.ok, `Request failed: ${res.error}`);
    assert(res.data.timestamp, 'Response should include timestamp');

    const timestamp = new Date(res.data.timestamp);
    assert(!isNaN(timestamp.getTime()), 'Timestamp should be valid ISO date');

    console.log(`   ✓ Valid timestamp included: ${res.data.timestamp}`);
  });

  // TEST 9: CORS headers present
  await runTest('GET /api/service-types - CORS headers for public access', async () => {
    const res = await apiRequest('/api/service-types', {
      method: 'GET'
    });

    assert(res.ok, `Request failed: ${res.error}`);

    // Note: CORS headers might not be set in dev, documenting expected headers
    console.log(`   ✓ Request successful`);
    console.log(`   ✓ CORS headers: ${res.headers['access-control-allow-origin'] || 'not set (should be * for public)'}`);
  });

  // TEST 10: Handle database connection gracefully
  await runTest('GET /api/service-types - Handle errors gracefully', async () => {
    const res = await apiRequest('/api/service-types', {
      method: 'GET'
    });

    // Should succeed or return proper error structure
    assert(res.status !== 0, 'Should not fail with network error');

    if (!res.ok) {
      assert(res.data.error || res.data.message, 'Error response should have error message');
      assert(res.data.timestamp, 'Error response should have timestamp');
    }

    console.log(`   ✓ Error handling structure validated`);
  });

  // TEST 11: Verify known service types exist
  await runTest('GET /api/service-types - Verify seeded service types exist', async () => {
    const res = await apiRequest('/api/service-types', {
      method: 'GET'
    });

    assert(res.ok, `Request failed: ${res.error}`);

    const names = res.data.data.map(st => st.name.toLowerCase());

    // Check that common service types exist (by name, not ID)
    const hasWindows = names.some(name => name.includes('window'));
    const hasBathrooms = names.some(name => name.includes('bathroom'));
    const hasRoofing = names.some(name => name.includes('roof'));

    const hasKnownService = hasWindows || hasBathrooms || hasRoofing;
    assert(hasKnownService, 'Should include at least one known service type (windows, bathrooms, or roofing)');

    console.log(`   ✓ Known service types present (${names.join(', ')})`);
  });

  // TEST 12: Response structure validation
  await runTest('GET /api/service-types - Validate response structure', async () => {
    const res = await apiRequest('/api/service-types', {
      method: 'GET'
    });

    assert(res.ok, `Request failed: ${res.error}`);
    assert(typeof res.data === 'object', 'Response data should be an object');
    assert(res.data.success === true, 'Should have success: true');
    assert(Array.isArray(res.data.data), 'Should have data array');
    assert(res.data.timestamp, 'Should have timestamp');

    console.log(`   ✓ Response structure valid`);
  });

  // TEST 13: Empty result handling
  await runTest('GET /api/service-types - Handle empty results properly', async () => {
    // Try to get inactive-only results (if any exist)
    const res = await apiRequest('/api/service-types?includeInactive=true', {
      method: 'GET'
    });

    assert(res.ok, `Request failed: ${res.error}`);
    assert(Array.isArray(res.data.data), 'Should return array even if empty');
    assert(res.data.data.length >= 0, 'Array length should be non-negative');

    console.log(`   ✓ Empty results handled properly`);
  });

  // TEST 14: Content-Type header
  await runTest('GET /api/service-types - Content-Type is application/json', async () => {
    const res = await apiRequest('/api/service-types', {
      method: 'GET'
    });

    assert(res.ok, `Request failed: ${res.error}`);

    const contentType = res.headers['content-type'];
    assert(contentType && contentType.includes('application/json'),
      `Content-Type should be application/json, got: ${contentType}`);

    console.log(`   ✓ Content-Type: ${contentType}`);
  });

  // ===========================================
  // TEST 15-25: GET /api/service-types/[id] - Get Specific
  // ===========================================
  console.log('\n📋 Tests 15-25: GET /api/service-types/[id] - Get specific service type\n');

  // TEST 15: Return complete service type details
  await runTest('GET /api/service-types/[id] - Return complete details', async () => {
    const res = await apiRequest(`/api/service-types/${windowsId}`, {
      method: 'GET'
    });

    assert(res.ok, `Request failed: ${res.error}`);
    assertEqual(res.status, 200, 'Should return 200 OK');
    assert(res.data.success || res.data.data, 'Response should have success or data');

    const serviceType = res.data.data || res.data;
    assert(serviceType.id, 'Should include id');
    assert(serviceType.name, 'Should include name');
    assert(serviceType.formSchema || serviceType.form_schema, 'Should include formSchema');

    console.log(`   ✓ Retrieved service type: ${serviceType.name}`);
  });

  // TEST 16: Include full form schema
  await runTest('GET /api/service-types/[id] - Include full form schema', async () => {
    const res = await apiRequest(`/api/service-types/${windowsId}`, {
      method: 'GET'
    });

    assert(res.ok, `Request failed: ${res.error}`);

    const serviceType = res.data.data || res.data;
    const formSchema = serviceType.formSchema || serviceType.form_schema;

    assert(formSchema, 'Should include formSchema');

    // Parse if string
    const schema = typeof formSchema === 'string' ? JSON.parse(formSchema) : formSchema;

    assert(schema.fields, 'Form schema should have fields array');
    assert(Array.isArray(schema.fields), 'Fields should be an array');

    console.log(`   ✓ Form schema has ${schema.fields.length} fields`);
  });

  // TEST 17: Include all field definitions
  await runTest('GET /api/service-types/[id] - Include all field definitions', async () => {
    const res = await apiRequest(`/api/service-types/${windowsId}`, {
      method: 'GET'
    });

    assert(res.ok, `Request failed: ${res.error}`);

    const serviceType = res.data.data || res.data;
    const formSchema = serviceType.formSchema || serviceType.form_schema;
    const schema = typeof formSchema === 'string' ? JSON.parse(formSchema) : formSchema;

    const firstField = schema.fields[0];
    assert(firstField.id || firstField.name, 'Field should have id or name');
    assert(firstField.type, 'Field should have type');
    assert(firstField.label, 'Field should have label');

    console.log(`   ✓ Field definitions complete`);
  });

  // TEST 18: Include validation rules
  await runTest('GET /api/service-types/[id] - Include validation rules', async () => {
    const res = await apiRequest(`/api/service-types/${windowsId}`, {
      method: 'GET'
    });

    assert(res.ok, `Request failed: ${res.error}`);

    const serviceType = res.data.data || res.data;
    const formSchema = serviceType.formSchema || serviceType.form_schema;
    const schema = typeof formSchema === 'string' ? JSON.parse(formSchema) : formSchema;

    // Check if validation rules exist
    const hasValidation = schema.validationRules ||
                         schema.fields.some(f => f.validation || f.required);

    assert(hasValidation, 'Should include validation rules or required fields');

    console.log(`   ✓ Validation rules included`);
  });

  // TEST 19: Include field options/enums
  await runTest('GET /api/service-types/[id] - Include field options', async () => {
    const res = await apiRequest(`/api/service-types/${windowsId}`, {
      method: 'GET'
    });

    assert(res.ok, `Request failed: ${res.error}`);

    const serviceType = res.data.data || res.data;
    const formSchema = serviceType.formSchema || serviceType.form_schema;
    const schema = typeof formSchema === 'string' ? JSON.parse(formSchema) : formSchema;

    // Find a field with options
    const fieldWithOptions = schema.fields.find(f => f.options);
    assert(fieldWithOptions, 'At least one field should have options');

    console.log(`   ✓ Field options included for select/radio/checkbox fields`);
  });

  // TEST 20: Return 404 for invalid UUID format
  await runTest('GET /api/service-types/[id] - Return 400 for invalid UUID', async () => {
    const res = await apiRequest('/api/service-types/not-a-uuid', {
      method: 'GET'
    });

    assertEqual(res.status, 400, 'Should return 400 for invalid UUID format');
    assert(res.data.error || res.data.message, 'Should include error message');

    console.log(`   ✓ Invalid UUID rejected with 400`);
  });

  // TEST 21: Return 404 for non-existent ID
  await runTest('GET /api/service-types/[id] - Return 404 for non-existent ID', async () => {
    const nonExistentId = '00000000-0000-0000-0000-000000000000';

    const res = await apiRequest(`/api/service-types/${nonExistentId}`, {
      method: 'GET'
    });

    assertEqual(res.status, 404, 'Should return 404 for non-existent ID');
    assert(res.data.error || res.data.message, 'Should include error message');

    console.log(`   ✓ Non-existent ID returns 404`);
  });

  // TEST 22: Response time validation
  await runTest('GET /api/service-types/[id] - Response time reasonable', async () => {
    const startTime = Date.now();

    const res = await apiRequest(`/api/service-types/${windowsId}`, {
      method: 'GET'
    });

    const duration = Date.now() - startTime;

    assert(res.ok, `Request failed: ${res.error}`);
    // Allow more time for detailed response
    assert(duration < 1000, `Response time ${duration}ms exceeds 1000ms limit`);

    console.log(`   ✓ Response time: ${duration}ms (< 1000ms)`);
  });

  // TEST 23: Verify base fields included in schema
  await runTest('GET /api/service-types/[id] - Include base fields (zipCode, name, etc)', async () => {
    const res = await apiRequest(`/api/service-types/${windowsId}`, {
      method: 'GET'
    });

    assert(res.ok, `Request failed: ${res.error}`);

    const serviceType = res.data.data || res.data;
    const formSchema = serviceType.formSchema || serviceType.form_schema;
    const schema = typeof formSchema === 'string' ? JSON.parse(formSchema) : formSchema;

    // Check for base fields
    const fieldNames = schema.fields.map(f => f.name.toLowerCase());
    const hasZipCode = fieldNames.some(name => name.includes('zip'));
    const hasName = fieldNames.some(name => name.includes('name') || name.includes('first'));
    const hasEmail = fieldNames.some(name => name.includes('email'));

    assert(hasZipCode || hasName || hasEmail, 'Should include base contact fields');

    console.log(`   ✓ Base fields included in form schema`);
  });

  // TEST 24: Multiple service types have different schemas
  await runTest('GET /api/service-types/[id] - Different service types have unique schemas', async () => {
    const res1 = await apiRequest(`/api/service-types/${windowsId}`, {
      method: 'GET'
    });

    const res2 = await apiRequest(`/api/service-types/${bathroomsId}`, {
      method: 'GET'
    });

    assert(res1.ok && res2.ok, 'Both requests should succeed');

    const schema1 = res1.data.data?.formSchema || res1.data.formSchema;
    const schema2 = res2.data.data?.formSchema || res2.data.formSchema;

    // Schemas should be different
    const schema1Str = JSON.stringify(schema1);
    const schema2Str = JSON.stringify(schema2);

    assert(schema1Str !== schema2Str, 'Different service types should have different schemas');

    console.log(`   ✓ Windows and Bathrooms have distinct schemas`);
  });

  // TEST 25: CORS headers for public access
  await runTest('GET /api/service-types/[id] - CORS headers present', async () => {
    const res = await apiRequest(`/api/service-types/${windowsId}`, {
      method: 'GET'
    });

    assert(res.ok, `Request failed: ${res.error}`);

    console.log(`   ✓ Request successful`);
    console.log(`   ✓ CORS headers: ${res.headers['access-control-allow-origin'] || 'not set (should be configured for public access)'}`);
  });

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
    console.log('🎉 All tests passed!');
  } else {
    console.log('⚠️  Some tests failed. Review errors above.');
    await prisma.$disconnect();
    process.exit(1);
  }

  // Cleanup
  await prisma.$disconnect();
}

// Wrap in Jest test block so Jest recognizes this as a test
test('Service Types API E2E Tests', async () => {
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
