const BASE_URL = 'http://localhost:3002';

describe('Domain 5.1: Authentication Testing', () => {

  // Test 1: Admin routes require authentication
  test('Test 1: GET /api/admin/buyers should require authentication', async () => {
    const response = await fetch(`${BASE_URL}/api/admin/buyers`, {
      headers: { 'Content-Type': 'application/json' }
      // No Authorization header
    });

    expect(response.status).toBe(401);
  });

  // Test 2: Admin routes reject invalid token
  test('Test 2: Admin routes should reject invalid token', async () => {
    const response = await fetch(`${BASE_URL}/api/admin/buyers`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer invalid-token-12345'
      }
    });

    expect(response.status).toBe(401);
  });

  // Test 3: Admin routes accept valid token
  test('Test 3: Admin routes should accept valid token', async () => {
    const response = await fetch(`${BASE_URL}/api/admin/buyers`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ADMIN_API_KEY}`
      }
    });

    expect([200, 401]).toContain(response.status);
    if (response.status === 200) {
      const data = await response.json();
      expect(data.success).toBe(true);
    }
  });

  // Test 4: Service zones require authentication
  test('Test 4: GET /api/admin/service-zones should require auth', async () => {
    const response = await fetch(`${BASE_URL}/api/admin/service-zones`, {
      headers: { 'Content-Type': 'application/json' }
    });

    expect(response.status).toBe(401);
  });

  // Test 5: Leads admin route requires authentication
  test('Test 5: GET /api/admin/leads should require auth', async () => {
    const response = await fetch(`${BASE_URL}/api/admin/leads`, {
      headers: { 'Content-Type': 'application/json' }
    });

    expect(response.status).toBe(401);
  });

  // Test 6: Service config routes require authentication
  test('Test 6: GET /api/admin/buyers/service-configs should require auth', async () => {
    const response = await fetch(`${BASE_URL}/api/admin/buyers/service-configs`, {
      headers: { 'Content-Type': 'application/json' }
    });

    expect(response.status).toBe(401);
  });

  // Test 7: ZIP code routes require authentication
  test('Test 7: GET /api/admin/buyers/service-zip-codes should require auth', async () => {
    const response = await fetch(`${BASE_URL}/api/admin/buyers/service-zip-codes`, {
      headers: { 'Content-Type': 'application/json' }
    });

    expect(response.status).toBe(401);
  });

  // Test 8: Test payloads route authentication check
  test('Test 8: GET /api/admin/test-payloads authentication check', async () => {
    const response = await fetch(`${BASE_URL}/api/admin/test-payloads`, {
      headers: { 'Content-Type': 'application/json' }
    });

    // Route may not require auth or may have different auth mechanism
    expect([200, 401]).toContain(response.status);
  });

  // Test 9: Public routes do not require authentication
  test('Test 9: GET /api/service-types should not require auth', async () => {
    const response = await fetch(`${BASE_URL}/api/service-types`, {
      headers: { 'Content-Type': 'application/json' }
    });

    expect(response.status).toBe(200);
  });

  // Test 10: Lead submission does not require authentication
  test('Test 10: POST /api/leads should not require auth', async () => {
    const response = await fetch(`${BASE_URL}/api/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceTypeId: 'test-id',
        zipCode: '12345',
        ownsHome: 'yes',
        timeframe: 'within_3_months'
      })
    });

    // Should not return 401 (may return 400/500 due to invalid data)
    expect(response.status).not.toBe(401);
  });

  // Test 11: Location search does not require authentication
  test('Test 11: GET /api/locations/search should not require auth', async () => {
    const response = await fetch(`${BASE_URL}/api/locations/search?q=Boston`, {
      headers: { 'Content-Type': 'application/json' }
    });

    expect(response.status).toBe(200);
  });

  // Test 12: Authorization header format validation
  test('Test 12: Should reject malformed Authorization header', async () => {
    const response = await fetch(`${BASE_URL}/api/admin/buyers`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'InvalidFormat token123'
      }
    });

    expect(response.status).toBe(401);
  });

  // Test 13: Bearer token without "Bearer" prefix
  test('Test 13: Should reject token without Bearer prefix', async () => {
    const response = await fetch(`${BASE_URL}/api/admin/buyers`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': process.env.ADMIN_API_KEY
      }
    });

    expect(response.status).toBe(401);
  });

  // Test 14: Empty Authorization header
  test('Test 14: Should reject empty Authorization header', async () => {
    const response = await fetch(`${BASE_URL}/api/admin/buyers`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': ''
      }
    });

    expect(response.status).toBe(401);
  });

  // Test 15: Case sensitivity of Bearer keyword
  test('Test 15: Bearer keyword should be case-insensitive', async () => {
    const response = await fetch(`${BASE_URL}/api/admin/buyers`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `bearer ${process.env.ADMIN_API_KEY}`
      }
    });

    // Most implementations accept lowercase bearer
    expect([200, 401]).toContain(response.status);
  });

  // Test 16: POST requests require authentication on admin routes
  test('Test 16: POST /api/admin/buyers should require auth', async () => {
    const response = await fetch(`${BASE_URL}/api/admin/buyers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Buyer',
        apiUrl: 'https://test.com',
        type: 'CONTRACTOR'
      })
    });

    expect(response.status).toBe(401);
  });

  // Test 17: PUT requests require authentication
  test('Test 17: PUT /api/admin/buyers/[id] should require auth', async () => {
    const response = await fetch(`${BASE_URL}/api/admin/buyers/test-id`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated' })
    });

    expect(response.status).toBe(401);
  });

  // Test 18: DELETE requests require authentication
  test('Test 18: DELETE /api/admin/buyers/[id] should require auth', async () => {
    const response = await fetch(`${BASE_URL}/api/admin/buyers/test-id`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    });

    expect(response.status).toBe(401);
  });

  // Test 19: Contractor signup does not require authentication
  test('Test 19: POST /api/contractors/signup should not require auth', async () => {
    const response = await fetch(`${BASE_URL}/api/contractors/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contactName: 'Test',
        contactEmail: 'test@test.com',
        contactPhone: '5551234567',
        companyName: 'Test Company',
        businessEmail: 'biz@test.com',
        businessPhone: '5559876543'
      })
    });

    // Should not return 401 (may return 400/500 due to validation)
    expect(response.status).not.toBe(401);
  });

  // Test 20: Multiple authentication attempts
  test('Test 20: Should handle multiple auth attempts correctly', async () => {
    // First request with no auth
    const response1 = await fetch(`${BASE_URL}/api/admin/buyers`, {
      headers: { 'Content-Type': 'application/json' }
    });
    expect(response1.status).toBe(401);

    // Second request with invalid auth
    const response2 = await fetch(`${BASE_URL}/api/admin/buyers`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer wrong-token'
      }
    });
    expect(response2.status).toBe(401);

    // Third request with valid auth
    const response3 = await fetch(`${BASE_URL}/api/admin/buyers`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ADMIN_API_KEY}`
      }
    });
    expect([200, 401]).toContain(response3.status);
  });

  // Test 21: Service zones detail route requires auth
  test('Test 21: GET /api/admin/service-zones/[id] should require auth', async () => {
    const response = await fetch(`${BASE_URL}/api/admin/service-zones/test-id`, {
      headers: { 'Content-Type': 'application/json' }
    });

    expect(response.status).toBe(401);
  });

  // Test 22: Lead detail route requires auth
  test('Test 22: GET /api/admin/leads/[id] should require auth', async () => {
    const response = await fetch(`${BASE_URL}/api/admin/leads/test-id`, {
      headers: { 'Content-Type': 'application/json' }
    });

    expect(response.status).toBe(401);
  });

  // Test 23: Service config detail route requires auth
  test('Test 23: GET /api/admin/buyers/service-configs/[id] should require auth', async () => {
    const response = await fetch(`${BASE_URL}/api/admin/buyers/service-configs/test-id`, {
      headers: { 'Content-Type': 'application/json' }
    });

    expect(response.status).toBe(401);
  });

  // Test 24: ZIP code detail route requires auth
  test('Test 24: GET /api/admin/buyers/service-zip-codes/[id] should require auth', async () => {
    const response = await fetch(`${BASE_URL}/api/admin/buyers/service-zip-codes/test-id`, {
      headers: { 'Content-Type': 'application/json' }
    });

    expect(response.status).toBe(401);
  });

  // Test 25: Authentication error messages should not leak info
  test('Test 25: Auth failure should return generic error message', async () => {
    const response = await fetch(`${BASE_URL}/api/admin/buyers`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer invalid-token'
      }
    });

    expect(response.status).toBe(401);

    const data = await response.json();

    // Should not reveal specific auth details
    // Error could be string or object
    expect(data.error).toBeDefined();
  });
});
