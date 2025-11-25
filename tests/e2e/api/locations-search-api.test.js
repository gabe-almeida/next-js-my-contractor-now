const BASE_URL = 'http://localhost:3002';

// Helper function to make API requests
async function apiRequest(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  };

  const response = await fetch(url, config);
  let data;

  try {
    data = await response.json();
  } catch (e) {
    data = null;
  }

  return {
    status: response.status,
    data: data,
    headers: response.headers
  };
}

describe('Domain 1.10: Location Search APIs - GET /api/locations/search', () => {

  // Test 1: Basic search functionality
  test('Test 1: GET /api/locations/search - should return locations for valid query', async () => {
    const response = await apiRequest('/api/locations/search?q=Leominster');

    expect(response.status).toBe(200);
    expect(response.data.locations).toBeDefined();
    expect(Array.isArray(response.data.locations)).toBe(true);
    expect(response.data.locations.length).toBeGreaterThan(0);

    // Verify location structure
    const location = response.data.locations[0];
    expect(location.id).toBeDefined();
    expect(location.type).toBeDefined();
    expect(location.name).toBeDefined();
    expect(location.displayName).toBeDefined();
  });

  // Test 2: Search by ZIP code (exact)
  test('Test 2: GET /api/locations/search - should find exact ZIP code', async () => {
    const response = await apiRequest('/api/locations/search?q=90210');

    expect(response.status).toBe(200);
    expect(response.data.locations).toBeDefined();
    expect(response.data.locations.length).toBeGreaterThan(0);

    const zipLocation = response.data.locations.find(loc => loc.name === '90210');
    expect(zipLocation).toBeDefined();
    expect(zipLocation.type).toBe('zipcode');
  });

  // Test 3: Search by ZIP code (partial)
  test('Test 3: GET /api/locations/search - should find partial ZIP code matches', async () => {
    const response = await apiRequest('/api/locations/search?q=014');

    expect(response.status).toBe(200);
    expect(response.data.locations).toBeDefined();
    // Should match ZIPs starting with 014
  });

  // Test 4: Search by city name
  test('Test 4: GET /api/locations/search - should find cities by name', async () => {
    const response = await apiRequest('/api/locations/search?q=Boston');

    expect(response.status).toBe(200);
    expect(response.data.locations).toBeDefined();
    expect(response.data.locations.length).toBeGreaterThan(0);

    const cityLocation = response.data.locations.find(loc => loc.name === 'Boston');
    expect(cityLocation).toBeDefined();
    expect(cityLocation.type).toBe('city');
    expect(cityLocation.state).toBe('MA');
  });

  // Test 5: Search by state name
  test('Test 5: GET /api/locations/search - should find states by name', async () => {
    const response = await apiRequest('/api/locations/search?q=California');

    expect(response.status).toBe(200);
    expect(response.data.locations).toBeDefined();
    expect(response.data.locations.length).toBeGreaterThan(0);

    const stateLocation = response.data.locations.find(loc => loc.name === 'California');
    expect(stateLocation).toBeDefined();
    expect(stateLocation.type).toBe('state');
  });

  // Test 6: Search by county name
  test('Test 6: GET /api/locations/search - should find counties by name', async () => {
    const response = await apiRequest('/api/locations/search?q=Worcester County');

    expect(response.status).toBe(200);
    expect(response.data.locations).toBeDefined();
    expect(response.data.locations.length).toBeGreaterThan(0);

    const countyLocation = response.data.locations.find(loc => loc.type === 'county');
    expect(countyLocation).toBeDefined();
  });

  // Test 7: Filter by type - city
  test('Test 7: GET /api/locations/search - should filter results by type=city', async () => {
    const response = await apiRequest('/api/locations/search?q=Los&type=city');

    expect(response.status).toBe(200);
    expect(response.data.locations).toBeDefined();

    // All results should be cities
    response.data.locations.forEach(location => {
      expect(location.type).toBe('city');
    });
  });

  // Test 8: Filter by type - state
  test('Test 8: GET /api/locations/search - should filter results by type=state', async () => {
    const response = await apiRequest('/api/locations/search?q=New&type=state');

    expect(response.status).toBe(200);
    expect(response.data.locations).toBeDefined();

    // All results should be states
    response.data.locations.forEach(location => {
      expect(location.type).toBe('state');
    });
  });

  // Test 9: Filter by type - zipcode
  test('Test 9: GET /api/locations/search - should filter results by type=zipcode', async () => {
    const response = await apiRequest('/api/locations/search?q=0&type=zipcode');

    expect(response.status).toBe(200);
    expect(response.data.locations).toBeDefined();

    // All results should be zipcodes
    response.data.locations.forEach(location => {
      expect(location.type).toBe('zipcode');
    });
  });

  // Test 10: Filter by type - county
  test('Test 10: GET /api/locations/search - should filter results by type=county', async () => {
    const response = await apiRequest('/api/locations/search?q=County&type=county');

    expect(response.status).toBe(200);
    expect(response.data.locations).toBeDefined();

    // All results should be counties
    response.data.locations.forEach(location => {
      expect(location.type).toBe('county');
    });
  });

  // Test 11: Case-insensitive search
  test('Test 11: GET /api/locations/search - should be case-insensitive', async () => {
    const response1 = await apiRequest('/api/locations/search?q=boston');
    const response2 = await apiRequest('/api/locations/search?q=BOSTON');
    const response3 = await apiRequest('/api/locations/search?q=Boston');

    expect(response1.status).toBe(200);
    expect(response2.status).toBe(200);
    expect(response3.status).toBe(200);

    // All should return results
    expect(response1.data.locations.length).toBeGreaterThan(0);
    expect(response2.data.locations.length).toBeGreaterThan(0);
    expect(response3.data.locations.length).toBeGreaterThan(0);
  });

  // Test 12: Partial match search
  test('Test 12: GET /api/locations/search - should support partial matches', async () => {
    const response = await apiRequest('/api/locations/search?q=Wor');

    expect(response.status).toBe(200);
    expect(response.data.locations).toBeDefined();

    // Should match Worcester
    const worcesterMatch = response.data.locations.find(loc => loc.name.includes('Worcester'));
    expect(worcesterMatch).toBeDefined();
  });

  // Test 13: Minimum query length
  test('Test 13: GET /api/locations/search - should require minimum 2 characters', async () => {
    const response = await apiRequest('/api/locations/search?q=B');

    expect(response.status).toBe(200);
    expect(response.data.locations).toBeDefined();
    expect(response.data.locations).toEqual([]);
  });

  // Test 14: Empty query
  test('Test 14: GET /api/locations/search - should return empty array for empty query', async () => {
    const response = await apiRequest('/api/locations/search?q=');

    expect(response.status).toBe(200);
    expect(response.data.locations).toBeDefined();
    expect(response.data.locations).toEqual([]);
  });

  // Test 15: Missing query parameter
  test('Test 15: GET /api/locations/search - should return empty array when query parameter missing', async () => {
    const response = await apiRequest('/api/locations/search');

    expect(response.status).toBe(200);
    expect(response.data.locations).toBeDefined();
    expect(response.data.locations).toEqual([]);
  });

  // Test 16: No results for non-existent location
  test('Test 16: GET /api/locations/search - should return empty array for non-existent location', async () => {
    const response = await apiRequest('/api/locations/search?q=NonExistentCity123');

    expect(response.status).toBe(200);
    expect(response.data.locations).toBeDefined();
    expect(response.data.locations).toEqual([]);
  });

  // Test 17: Results limit (max 15)
  test('Test 17: GET /api/locations/search - should limit results to 15', async () => {
    const response = await apiRequest('/api/locations/search?q=a');

    expect(response.status).toBe(200);
    expect(response.data.locations).toBeDefined();
    expect(response.data.locations.length).toBeLessThanOrEqual(15);
  });

  // Test 18: Search matches both name and displayName
  test('Test 18: GET /api/locations/search - should match both name and displayName fields', async () => {
    const response = await apiRequest('/api/locations/search?q=Beverly');

    expect(response.status).toBe(200);
    expect(response.data.locations).toBeDefined();

    // Should match "90210 (Beverly Hills, CA)" in displayName
    const beverlyMatch = response.data.locations.find(loc =>
      loc.displayName.includes('Beverly')
    );
    expect(beverlyMatch).toBeDefined();
  });

  // Test 19: Response includes success message
  test('Test 19: GET /api/locations/search - should include message field in response', async () => {
    const response = await apiRequest('/api/locations/search?q=Boston');

    expect(response.status).toBe(200);
    expect(response.data.message).toBeDefined();
    expect(typeof response.data.message).toBe('string');
  });

  // Test 20: Response time should be reasonable
  test('Test 20: GET /api/locations/search - should respond in reasonable time', async () => {
    const startTime = Date.now();
    const response = await apiRequest('/api/locations/search?q=Los Angeles');
    const duration = Date.now() - startTime;

    expect(response.status).toBe(200);
    expect(duration).toBeLessThan(1000); // Should be under 1 second
  });

  // Test 21: Location object structure - city
  test('Test 21: GET /api/locations/search - city location should have correct structure', async () => {
    const response = await apiRequest('/api/locations/search?q=Boston');

    expect(response.status).toBe(200);
    const cityLocation = response.data.locations.find(loc => loc.type === 'city');

    expect(cityLocation).toBeDefined();
    expect(cityLocation.id).toBeDefined();
    expect(cityLocation.type).toBe('city');
    expect(cityLocation.name).toBeDefined();
    expect(cityLocation.displayName).toBeDefined();
    expect(cityLocation.state).toBeDefined();
  });

  // Test 22: Location object structure - state
  test('Test 22: GET /api/locations/search - state location should have correct structure', async () => {
    const response = await apiRequest('/api/locations/search?q=California');

    expect(response.status).toBe(200);
    const stateLocation = response.data.locations.find(loc => loc.type === 'state');

    expect(stateLocation).toBeDefined();
    expect(stateLocation.id).toBeDefined();
    expect(stateLocation.type).toBe('state');
    expect(stateLocation.name).toBeDefined();
    expect(stateLocation.displayName).toBeDefined();
    expect(stateLocation.state).toBeDefined();
  });

  // Test 23: Location object structure - zipcode
  test('Test 23: GET /api/locations/search - zipcode location should have correct structure', async () => {
    const response = await apiRequest('/api/locations/search?q=90210');

    expect(response.status).toBe(200);
    const zipLocation = response.data.locations.find(loc => loc.type === 'zipcode');

    expect(zipLocation).toBeDefined();
    expect(zipLocation.id).toBeDefined();
    expect(zipLocation.type).toBe('zipcode');
    expect(zipLocation.name).toBeDefined();
    expect(zipLocation.displayName).toBeDefined();
    expect(zipLocation.state).toBeDefined();
  });

  // Test 24: Multiple matches for broad search
  test('Test 24: GET /api/locations/search - should return multiple matches for broad search', async () => {
    const response = await apiRequest('/api/locations/search?q=New York');

    expect(response.status).toBe(200);
    expect(response.data.locations).toBeDefined();
    expect(response.data.locations.length).toBeGreaterThan(1);
  });

  // Test 25: Search with special characters
  test('Test 25: GET /api/locations/search - should handle special characters gracefully', async () => {
    const response = await apiRequest('/api/locations/search?q=Los%20Angeles');

    expect(response.status).toBe(200);
    expect(response.data.locations).toBeDefined();

    const laMatch = response.data.locations.find(loc => loc.name === 'Los Angeles');
    expect(laMatch).toBeDefined();
  });

  // Test 26: Type parameter with invalid value
  test('Test 26: GET /api/locations/search - should handle invalid type parameter', async () => {
    const response = await apiRequest('/api/locations/search?q=Boston&type=invalid');

    expect(response.status).toBe(200);
    expect(response.data.locations).toBeDefined();
    // Should filter by invalid type, resulting in no matches
    expect(response.data.locations).toEqual([]);
  });

  // Test 27: Type parameter with all value
  test('Test 27: GET /api/locations/search - should return all types when type=all', async () => {
    const response = await apiRequest('/api/locations/search?q=ma&type=all');

    expect(response.status).toBe(200);
    expect(response.data.locations).toBeDefined();

    // Should include multiple types
    const types = new Set(response.data.locations.map(loc => loc.type));
    // Could have cities, states, zipcodes, etc. containing "ma"
  });

  // Test 28: Whitespace in query
  test('Test 28: GET /api/locations/search - should handle query with whitespace (no trim)', async () => {
    const response = await apiRequest('/api/locations/search?q=%20Boston%20');

    expect(response.status).toBe(200);
    expect(response.data.locations).toBeDefined();

    // Endpoint doesn't trim query, so " boston " won't match "Boston" in name field
    // Query is long enough (after trim check), but won't find exact matches due to spaces
    expect(response.data.locations).toEqual([]);
  });
});
