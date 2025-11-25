/**
 * k6 Load Test: Database Connection Pool Stress Test
 * Tests database connection pool limits and behavior under heavy concurrent load
 *
 * This test hammers read-heavy endpoints to stress the database connection pool
 *
 * Usage:
 * k6 run tests/load/database-pool-stress.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';

// Custom metrics
const querySuccessRate = new Rate('query_success_rate');
const queryDuration = new Trend('query_duration');
const dbErrors = new Counter('db_errors');
const connectionErrors = new Counter('connection_errors');
const activeConnections = new Gauge('active_connections');

// Test configuration - Heavy concurrent load
export const options = {
  scenarios: {
    // Heavy read load on database
    heavy_reads: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50 },   // Ramp to 50 concurrent users
        { duration: '1m', target: 50 },    // Hold at 50
        { duration: '30s', target: 100 },  // Ramp to 100
        { duration: '1m', target: 100 },   // Hold at 100
        { duration: '30s', target: 200 },  // Spike to 200
        { duration: '1m', target: 200 },   // Hold at 200
        { duration: '1m', target: 0 },     // Ramp down
      ],
    },
  },
  thresholds: {
    query_success_rate: ['rate>0.95'],
    query_duration: ['p(95)<2000'],
    http_req_duration: ['p(95)<2500'],
    connection_errors: ['count<50'],
    db_errors: ['count<100'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const ADMIN_TOKEN = __ENV.ADMIN_TOKEN || 'test-admin-token';

// Endpoints that hit the database heavily
const DB_ENDPOINTS = [
  '/api/admin/leads?page=1&limit=100',
  '/api/admin/buyers',
  '/api/admin/buyers/service-configs',
  '/api/admin/buyers/service-zip-codes',
  '/api/admin/service-zones',
  '/api/admin/service-zones/analytics',
];

export default function () {
  activeConnections.add(1);

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ADMIN_TOKEN}`,
    },
  };

  // Randomly select an endpoint to hit
  const endpoint = DB_ENDPOINTS[Math.floor(Math.random() * DB_ENDPOINTS.length)];

  group('Database Query', function () {
    const startTime = Date.now();

    const response = http.get(`${BASE_URL}${endpoint}`, params);

    const duration = Date.now() - startTime;
    queryDuration.add(duration);

    const success = check(response, {
      'status is 200': (r) => r.status === 200,
      'has data': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body !== null && body !== undefined;
        } catch {
          return false;
        }
      },
      'no timeout': (r) => r.status !== 504,
      'no connection error': (r) => r.status !== 503,
      'query under 2s': () => duration < 2000,
    });

    querySuccessRate.add(success ? 1 : 0);

    if (!success) {
      dbErrors.add(1);

      if (response.status === 503 || response.status === 504) {
        connectionErrors.add(1);
        console.error(`Connection error on ${endpoint}: ${response.status}`);
      } else {
        console.error(`Query failed on ${endpoint}: ${response.status} - ${duration}ms`);
      }
    }

    // Check for connection pool exhaustion indicators
    if (response.status === 200) {
      try {
        const body = JSON.parse(response.body);
        if (body.error && body.error.includes('connection')) {
          connectionErrors.add(1);
          console.error(`Connection pool issue detected: ${body.error}`);
        }
      } catch (e) {
        // Ignore JSON parse errors
      }
    }
  });

  activeConnections.add(-1);

  // Minimal sleep - we want to stress the connection pool
  sleep(0.05);
}

export function setup() {
  console.log('\n========================================');
  console.log('  DATABASE CONNECTION POOL STRESS TEST');
  console.log('========================================');
  console.log(`Base URL: ${BASE_URL}`);
  console.log('');
  console.log('This test will:');
  console.log('  1. Ramp up to 200 concurrent database queries');
  console.log('  2. Stress the connection pool limits');
  console.log('  3. Identify connection exhaustion');
  console.log('');
  console.log('Watch for:');
  console.log('  - Connection timeout errors (503, 504)');
  console.log('  - Increased query duration under load');
  console.log('  - Connection pool exhaustion messages');
  console.log('========================================\n');

  // Verify database is accessible
  const response = http.get(`${BASE_URL}/api/service-types`);
  if (response.status !== 200) {
    console.warn(`Warning: Initial DB check returned ${response.status}`);
  } else {
    console.log('✓ Database connection verified\n');
  }

  return { startTime: new Date() };
}

export function teardown(data) {
  const endTime = new Date();
  const duration = (endTime - data.startTime) / 1000 / 60;

  console.log('\n========================================');
  console.log('  DATABASE STRESS TEST COMPLETE');
  console.log('========================================');
  console.log(`Duration: ${duration.toFixed(2)} minutes`);
  console.log('');
  console.log('Review metrics for:');
  console.log('  - Connection errors (count and rate)');
  console.log('  - Query duration under load');
  console.log('  - Success rate at peak concurrency');
  console.log('');
  console.log('Recommendations:');
  console.log('  - If connection errors > 50: Increase connection pool size');
  console.log('  - If p95 duration > 2s: Optimize slow queries');
  console.log('  - If success rate < 95%: Investigate error patterns');
  console.log('========================================\n');
}
