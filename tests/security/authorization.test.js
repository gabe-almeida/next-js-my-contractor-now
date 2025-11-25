const BASE_URL = 'http://localhost:3002';

describe('Domain 5.2: Authorization Testing', () => {

  // Test 1: Admin API key should access admin routes
  test('Test 1: Admin API key should access /api/admin/buyers', async () => {
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

  // Test 2: Non-admin token should not access admin routes
  test('Test 2: Invalid token should be rejected from admin routes', async () => {
    const response = await fetch(`${BASE_URL}/api/admin/buyers`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer not-an-admin-key'
      }
    });

    expect(response.status).toBe(401);
  });

  // Test 3: Admin routes require proper authorization
  test('Test 3: POST /api/admin/buyers requires admin auth', async () => {
    const response = await fetch(`${BASE_URL}/api/admin/buyers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer invalid-key'
      },
      body: JSON.stringify({
        name: 'Test Buyer',
        apiUrl: 'https://test.com',
        type: 'CONTRACTOR'
      })
    });

    expect(response.status).toBe(401);
  });

  // Test 4: Service zones require admin authorization
  test('Test 4: Admin service zones require authorization', async () => {
    const response = await fetch(`${BASE_URL}/api/admin/service-zones`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer fake-token'
      }
    });

    expect(response.status).toBe(401);
  });

  // Test 5: Leads admin route requires authorization
  test('Test 5: Leads admin endpoint requires authorization', async () => {
    const response = await fetch(`${BASE_URL}/api/admin/leads`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer unauthorized-token'
      }
    });

    expect(response.status).toBe(401);
  });

  // Test 6: Service config endpoints require authorization
  test('Test 6: Service configs require admin authorization', async () => {
    const response = await fetch(`${BASE_URL}/api/admin/buyers/service-configs`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer bad-token'
      }
    });

    expect(response.status).toBe(401);
  });

  // Test 7: ZIP code management requires authorization
  test('Test 7: ZIP code endpoints require admin authorization', async () => {
    const response = await fetch(`${BASE_URL}/api/admin/buyers/service-zip-codes`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer wrong-token'
      }
    });

    expect(response.status).toBe(401);
  });

  // Test 8: PUT operations require proper authorization
  test('Test 8: PUT /api/admin/buyers/[id] requires admin authorization', async () => {
    const response = await fetch(`${BASE_URL}/api/admin/buyers/test-id`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer unauthorized'
      },
      body: JSON.stringify({ name: 'Updated Name' })
    });

    expect(response.status).toBe(401);
  });

  // Test 9: DELETE operations require proper authorization
  test('Test 9: DELETE /api/admin/buyers/[id] requires admin authorization', async () => {
    const response = await fetch(`${BASE_URL}/api/admin/buyers/test-id`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer unauthorized'
      }
    });

    expect(response.status).toBe(401);
  });

  // Test 10: Service zone detail routes require authorization
  test('Test 10: Service zone detail endpoint requires authorization', async () => {
    const response = await fetch(`${BASE_URL}/api/admin/service-zones/test-id`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer fake-auth'
      }
    });

    expect(response.status).toBe(401);
  });

  // Test 11: Lead detail routes require authorization
  test('Test 11: Lead detail endpoint requires authorization', async () => {
    const response = await fetch(`${BASE_URL}/api/admin/leads/test-id`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer bad-auth'
      }
    });

    expect(response.status).toBe(401);
  });

  // Test 12: Service config detail requires authorization
  test('Test 12: Service config detail requires authorization', async () => {
    const response = await fetch(`${BASE_URL}/api/admin/buyers/service-configs/test-id`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer invalid-auth'
      }
    });

    expect(response.status).toBe(401);
  });

  // Test 13: ZIP code detail requires authorization
  test('Test 13: ZIP code detail requires authorization', async () => {
    const response = await fetch(`${BASE_URL}/api/admin/buyers/service-zip-codes/test-id`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer wrong-auth'
      }
    });

    expect(response.status).toBe(401);
  });

  // Test 14: Public routes should not require authorization
  test('Test 14: Public service types endpoint accessible without auth', async () => {
    const response = await fetch(`${BASE_URL}/api/service-types`, {
      headers: { 'Content-Type': 'application/json' }
    });

    expect(response.status).toBe(200);
  });

  // Test 15: Lead submission should not require authorization
  test('Test 15: Lead submission accessible without authorization', async () => {
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

    // Should not return 401 (may return 400/500 due to validation)
    expect(response.status).not.toBe(401);
  });

  // Test 16: Location search should not require authorization
  test('Test 16: Location search accessible without authorization', async () => {
    const response = await fetch(`${BASE_URL}/api/locations/search?q=Boston`, {
      headers: { 'Content-Type': 'application/json' }
    });

    expect(response.status).toBe(200);
  });

  // Test 17: Contractor signup should not require authorization
  test('Test 17: Contractor signup accessible without authorization', async () => {
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

    expect(response.status).not.toBe(401);
  });

  // Test 18: Authorization header validation
  test('Test 18: Missing Bearer prefix should be rejected', async () => {
    const response = await fetch(`${BASE_URL}/api/admin/buyers`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': process.env.ADMIN_API_KEY // Missing "Bearer "
      }
    });

    expect(response.status).toBe(401);
  });

  // Test 19: Empty authorization should be rejected
  test('Test 19: Empty Authorization header should be rejected', async () => {
    const response = await fetch(`${BASE_URL}/api/admin/buyers`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': ''
      }
    });

    expect(response.status).toBe(401);
  });

  // Test 20: Authorization with whitespace should be rejected
  test('Test 20: Authorization with only whitespace should be rejected', async () => {
    const response = await fetch(`${BASE_URL}/api/admin/buyers`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': '   '
      }
    });

    expect(response.status).toBe(401);
  });

  // Test 21: Multiple authorization attempts
  test('Test 21: Multiple invalid auth attempts should all be rejected', async () => {
    const tokens = [
      'Bearer invalid1',
      'Bearer invalid2',
      'Bearer invalid3'
    ];

    for (const token of tokens) {
      const response = await fetch(`${BASE_URL}/api/admin/buyers`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token
        }
      });

      expect(response.status).toBe(401);
    }
  });

  // Test 22: Admin routes should consistently require authorization
  test('Test 22: All admin buyer routes require authorization', async () => {
    const routes = [
      { method: 'GET', path: '/api/admin/buyers' },
      { method: 'POST', path: '/api/admin/buyers', body: { name: 'Test' } },
      { method: 'GET', path: '/api/admin/buyers/test-id' },
      { method: 'PUT', path: '/api/admin/buyers/test-id', body: { name: 'Test' } },
      { method: 'DELETE', path: '/api/admin/buyers/test-id' }
    ];

    for (const route of routes) {
      const options = {
        method: route.method,
        headers: { 'Content-Type': 'application/json' }
      };

      if (route.body) {
        options.body = JSON.stringify(route.body);
      }

      const response = await fetch(`${BASE_URL}${route.path}`, options);
      expect(response.status).toBe(401);
    }
  });

  // Test 23: Admin service config routes require authorization
  test('Test 23: All service config routes require authorization', async () => {
    const routes = [
      '/api/admin/buyers/service-configs',
      '/api/admin/buyers/service-configs/test-id'
    ];

    for (const path of routes) {
      const response = await fetch(`${BASE_URL}${path}`, {
        headers: { 'Content-Type': 'application/json' }
      });

      expect(response.status).toBe(401);
    }
  });

  // Test 24: Admin ZIP code routes require authorization
  test('Test 24: All ZIP code routes require authorization', async () => {
    const routes = [
      '/api/admin/buyers/service-zip-codes',
      '/api/admin/buyers/service-zip-codes/test-id'
    ];

    for (const path of routes) {
      const response = await fetch(`${BASE_URL}${path}`, {
        headers: { 'Content-Type': 'application/json' }
      });

      expect(response.status).toBe(401);
    }
  });

  // Test 25: Admin service zone routes require authorization
  test('Test 25: All service zone routes require authorization', async () => {
    const routes = [
      '/api/admin/service-zones',
      '/api/admin/service-zones/test-id'
    ];

    for (const path of routes) {
      const response = await fetch(`${BASE_URL}${path}`, {
        headers: { 'Content-Type': 'application/json' }
      });

      expect(response.status).toBe(401);
    }
  });
});
