/**
 * k6 Load Test: API Endpoints
 * Tests various API endpoints under load to ensure they can handle concurrent requests
 *
 * Usage:
 * k6 run tests/load/api-endpoints-load.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const apiResponseTime = new Trend('api_response_time');

// Test configuration
export const options = {
  stages: [
    { duration: '1m', target: 20 },   // Ramp up to 20 users
    { duration: '3m', target: 20 },   // Stay at 20 users
    { duration: '1m', target: 50 },   // Ramp up to 50 users
    { duration: '3m', target: 50 },   // Stay at 50 users
    { duration: '1m', target: 100 },  // Spike to 100 users
    { duration: '2m', target: 100 },  // Stay at 100 users
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1500'],
    http_req_failed: ['rate<0.02'],
    errors: ['rate<0.05'],
    'http_req_duration{endpoint:buyers}': ['p(95)<1000'],
    'http_req_duration{endpoint:service-types}': ['p(95)<800'],
    'http_req_duration{endpoint:leads}': ['p(95)<1200'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const ADMIN_TOKEN = __ENV.ADMIN_TOKEN || 'test-admin-token';

export default function () {
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ADMIN_TOKEN}`,
    },
    tags: {},
  };

  // Test GET /api/admin/buyers
  group('GET Buyers', function () {
    params.tags = { endpoint: 'buyers' };
    const response = http.get(`${BASE_URL}/api/admin/buyers`, params);

    const success = check(response, {
      'buyers status is 200': (r) => r.status === 200,
      'buyers has data': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.buyers !== undefined;
        } catch {
          return false;
        }
      },
      'buyers response time < 1s': (r) => r.timings.duration < 1000,
    });

    apiResponseTime.add(response.timings.duration, { endpoint: 'buyers' });
    if (!success) errorRate.add(1);
  });

  sleep(0.5);

  // Test GET /api/service-types
  group('GET Service Types', function () {
    params.tags = { endpoint: 'service-types' };
    const response = http.get(`${BASE_URL}/api/service-types`, params);

    const success = check(response, {
      'service-types status is 200': (r) => r.status === 200,
      'service-types has data': (r) => {
        try {
          const body = JSON.parse(r.body);
          return Array.isArray(body.serviceTypes) || Array.isArray(body);
        } catch {
          return false;
        }
      },
      'service-types response time < 800ms': (r) => r.timings.duration < 800,
    });

    apiResponseTime.add(response.timings.duration, { endpoint: 'service-types' });
    if (!success) errorRate.add(1);
  });

  sleep(0.5);

  // Test GET /api/admin/leads
  group('GET Leads', function () {
    params.tags = { endpoint: 'leads' };
    const response = http.get(`${BASE_URL}/api/admin/leads?page=1&limit=50`, params);

    const success = check(response, {
      'leads status is 200': (r) => r.status === 200,
      'leads has pagination': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.pagination !== undefined;
        } catch {
          return false;
        }
      },
      'leads response time < 1.2s': (r) => r.timings.duration < 1200,
    });

    apiResponseTime.add(response.timings.duration, { endpoint: 'leads' });
    if (!success) errorRate.add(1);
  });

  sleep(0.5);

  // Test GET /api/admin/buyers/service-configs
  group('GET Service Configs', function () {
    params.tags = { endpoint: 'service-configs' };
    const response = http.get(`${BASE_URL}/api/admin/buyers/service-configs`, params);

    const success = check(response, {
      'service-configs status is 200': (r) => r.status === 200,
      'service-configs response time < 1s': (r) => r.timings.duration < 1000,
    });

    apiResponseTime.add(response.timings.duration, { endpoint: 'service-configs' });
    if (!success) errorRate.add(1);
  });

  sleep(0.5);

  // Test GET /api/admin/service-zones
  group('GET Service Zones', function () {
    params.tags = { endpoint: 'service-zones' };
    const response = http.get(`${BASE_URL}/api/admin/service-zones`, params);

    const success = check(response, {
      'service-zones status is 200': (r) => r.status === 200,
      'service-zones response time < 1s': (r) => r.timings.duration < 1000,
    });

    apiResponseTime.add(response.timings.duration, { endpoint: 'service-zones' });
    if (!success) errorRate.add(1);
  });

  // Think time
  sleep(Math.random() * 2 + 1);
}

export function setup() {
  console.log('Starting API endpoints load test...');
  console.log(`Base URL: ${BASE_URL}`);
  console.log('Testing multiple admin endpoints under load');

  // Verify base URL is accessible
  const response = http.get(BASE_URL);
  if (response.status !== 200 && response.status !== 404) {
    console.error(`Warning: Base URL returned status ${response.status}`);
  }

  return { startTime: new Date() };
}

export function teardown(data) {
  const endTime = new Date();
  const duration = (endTime - data.startTime) / 1000 / 60;
  console.log(`\nAPI endpoints load test completed in ${duration.toFixed(2)} minutes`);
  console.log('Review metrics above to identify any bottlenecks');
}
