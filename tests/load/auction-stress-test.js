/**
 * k6 Load Test: Auction Engine Stress Test
 * Tests the auction engine's ability to handle multiple concurrent auctions
 *
 * This simulates a high-volume scenario where many leads are submitted
 * simultaneously, triggering concurrent auction processes.
 *
 * Usage:
 * k6 run tests/load/auction-stress-test.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';

// Custom metrics
const auctionSuccessRate = new Rate('auction_success_rate');
const auctionDuration = new Trend('auction_duration');
const concurrentAuctions = new Gauge('concurrent_auctions');
const totalAuctions = new Counter('total_auctions');
const auctionErrors = new Counter('auction_errors');

// Test configuration - Aggressive load to stress test
export const options = {
  scenarios: {
    // Constant load scenario
    constant_load: {
      executor: 'constant-arrival-rate',
      rate: 50, // 50 requests per second
      timeUnit: '1s',
      duration: '2m',
      preAllocatedVUs: 50,
      maxVUs: 100,
    },
    // Spike scenario
    spike_test: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 200,
      stages: [
        { duration: '30s', target: 10 },  // Start at 10 req/s
        { duration: '30s', target: 50 },  // Ramp to 50 req/s
        { duration: '30s', target: 100 }, // Spike to 100 req/s
        { duration: '30s', target: 150 }, // Spike to 150 req/s
        { duration: '1m', target: 10 },   // Back down
      ],
      startTime: '2m', // Start after constant load
    },
  },
  thresholds: {
    auction_success_rate: ['rate>0.95'], // 95% success rate
    auction_duration: ['p(95)<5000'],     // 95% complete in 5s
    http_req_failed: ['rate<0.05'],       // Less than 5% failures
    auction_errors: ['count<100'],        // Less than 100 errors total
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

const SERVICE_TYPES = [
  'service-roofing-001',
  'service-hvac-001',
  'service-plumbing-001',
  'service-electrical-001',
];

const ZIP_CODES = [
  '10001', '90210', '60601', '33101', '98101',
  '75201', '30301', '02101', '85001', '55401',
];

function generateLeadForAuction() {
  return {
    serviceTypeId: SERVICE_TYPES[Math.floor(Math.random() * SERVICE_TYPES.length)],
    zipCode: ZIP_CODES[Math.floor(Math.random() * ZIP_CODES.length)],
    formData: {
      ownsHome: true,
      timeframe: 'ASAP',
      firstName: `Auction${Math.floor(Math.random() * 100000)}`,
      lastName: 'Test',
      email: `auction${Math.floor(Math.random() * 100000)}@test.com`,
      phone: '5555555555',
      description: 'Auction stress test lead',
    },
    complianceData: {
      tcpaConsent: true,
      privacyPolicyAccepted: true,
      ipAddress: '127.0.0.1',
      userAgent: 'k6-auction-stress/1.0',
    },
  };
}

export default function () {
  concurrentAuctions.add(1);
  totalAuctions.add(1);

  const leadData = generateLeadForAuction();
  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  group('Submit Lead and Trigger Auction', function () {
    const startTime = Date.now();

    const response = http.post(
      `${BASE_URL}/api/leads`,
      JSON.stringify(leadData),
      params
    );

    const duration = Date.now() - startTime;
    auctionDuration.add(duration);

    const success = check(response, {
      'auction completed': (r) => r.status === 200,
      'has leadId': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.leadId !== undefined;
        } catch {
          return false;
        }
      },
      'auction under 5s': () => duration < 5000,
      'auction under 10s': () => duration < 10000,
    });

    auctionSuccessRate.add(success ? 1 : 0);

    if (!success) {
      auctionErrors.add(1);
      console.error(`Auction failed: ${response.status} - Duration: ${duration}ms`);
    }

    // Check if auction result is in response
    if (response.status === 200) {
      try {
        const body = JSON.parse(response.body);
        if (body.winningBuyerId) {
          console.log(`✓ Auction won by ${body.winningBuyerId} at $${body.winningBid}`);
        }
      } catch (e) {
        // Response parsing error
      }
    }
  });

  concurrentAuctions.add(-1);

  // Minimal sleep to maximize concurrency
  sleep(0.1);
}

export function setup() {
  console.log('\n========================================');
  console.log('  AUCTION ENGINE STRESS TEST');
  console.log('========================================');
  console.log(`Base URL: ${BASE_URL}`);
  console.log('');
  console.log('This test will:');
  console.log('  1. Submit 50 leads/sec for 2 minutes (constant load)');
  console.log('  2. Ramp up to 150 leads/sec (spike test)');
  console.log('  3. Measure auction success rate and duration');
  console.log('');
  console.log('Expected behavior:');
  console.log('  - 95%+ auction success rate');
  console.log('  - 95% of auctions complete in <5s');
  console.log('  - System should handle concurrent auctions gracefully');
  console.log('========================================\n');

  return { startTime: new Date() };
}

export function teardown(data) {
  const endTime = new Date();
  const duration = (endTime - data.startTime) / 1000 / 60;

  console.log('\n========================================');
  console.log('  AUCTION STRESS TEST COMPLETE');
  console.log('========================================');
  console.log(`Duration: ${duration.toFixed(2)} minutes`);
  console.log('');
  console.log('Check the metrics above for:');
  console.log('  - Auction success rate');
  console.log('  - Auction duration percentiles');
  console.log('  - Error counts and rates');
  console.log('  - Concurrent auctions peak');
  console.log('========================================\n');
}
