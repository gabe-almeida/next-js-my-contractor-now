/**
 * Load Testing Script for Pay-Per-Call System
 *
 * WHY: Simulate high volume of concurrent calls to test system performance,
 *      identify bottlenecks, and verify the auction engine handles load.
 *
 * WHEN: Run before production deployment to validate scalability.
 *       Run after major changes to auction or call handling code.
 *
 * HOW: Simulates Twilio webhooks hitting the API endpoints with configurable
 *      concurrency, duration, and scenario patterns.
 *
 * USAGE:
 *   npx tsx scripts/load-test-calls.ts --help
 *   npx tsx scripts/load-test-calls.ts --concurrent 10 --duration 60
 *   npx tsx scripts/load-test-calls.ts --scenario burst --burst-size 50
 */

import { program } from 'commander';

// ============================================================================
// CONFIGURATION
// ============================================================================

interface LoadTestConfig {
  baseUrl: string;
  concurrent: number;
  duration: number;
  scenario: 'steady' | 'burst' | 'ramp';
  burstSize: number;
  rampStep: number;
  verbose: boolean;
  trackingNumbers: string[];
  serviceTypes: string[];
}

const DEFAULT_CONFIG: LoadTestConfig = {
  baseUrl: process.env.LOAD_TEST_URL || 'http://localhost:3000',
  concurrent: 5,
  duration: 30,
  scenario: 'steady',
  burstSize: 20,
  rampStep: 5,
  verbose: false,
  trackingNumbers: [
    '+18445551234',
    '+18445555678',
    '+18445559012',
  ],
  serviceTypes: ['windows', 'roofing', 'hvac', 'siding'],
};

// ============================================================================
// METRICS TRACKING
// ============================================================================

interface CallMetrics {
  callId: string;
  scenario: string;
  startTime: number;
  incomingLatency?: number;
  ivrLatency?: number;
  auctionLatency?: number;
  completedLatency?: number;
  totalLatency?: number;
  success: boolean;
  error?: string;
  finalStatus?: string;
}

interface AggregateMetrics {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  avgIncomingLatency: number;
  avgIvrLatency: number;
  avgAuctionLatency: number;
  avgTotalLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  maxLatency: number;
  minLatency: number;
  callsPerSecond: number;
  errorBreakdown: Record<string, number>;
  statusBreakdown: Record<string, number>;
}

// ============================================================================
// TWILIO PAYLOAD GENERATORS
// ============================================================================

/**
 * Generates a random phone number for caller simulation
 */
function generateCallerPhone(): string {
  const areaCode = Math.floor(Math.random() * 900) + 100;
  const exchange = Math.floor(Math.random() * 900) + 100;
  const subscriber = Math.floor(Math.random() * 9000) + 1000;
  return `+1${areaCode}${exchange}${subscriber}`;
}

/**
 * Generates a random ZIP code
 */
function generateZipCode(): string {
  // Use real ZIP codes from major metros for more realistic testing
  const zips = [
    '90210', '10001', '60601', '77001', '85001',
    '30301', '33101', '98101', '19101', '02101',
    '48201', '55401', '80201', '92101', '75201',
  ];
  return zips[Math.floor(Math.random() * zips.length)];
}

/**
 * Generates Twilio incoming call webhook payload
 */
function generateIncomingCallPayload(trackingNumber: string): Record<string, string> {
  const callSid = `CA${Date.now()}${Math.random().toString(36).substring(7)}`;
  const callerPhone = generateCallerPhone();
  const zip = generateZipCode();

  return {
    CallSid: callSid,
    AccountSid: 'AC_test_load_test',
    From: callerPhone,
    To: trackingNumber,
    Direction: 'inbound',
    CallStatus: 'ringing',
    CallerName: 'Load Test Caller',
    FromCity: 'Test City',
    FromState: 'CA',
    FromZip: zip,
    FromCountry: 'US',
    ToCity: 'Test City',
    ToState: 'CA',
    ToZip: '90210',
    ToCountry: 'US',
    ApiVersion: '2010-04-01',
  };
}

/**
 * Generates Twilio IVR response payload
 */
function generateIvrPayload(callId: string, callSid: string, digit: string): Record<string, string> {
  return {
    CallSid: callSid,
    AccountSid: 'AC_test_load_test',
    Digits: digit,
    FinishedOnKey: '',
    msg: '',
  };
}

/**
 * Generates Twilio dial completion payload
 */
function generateCompletionPayload(
  callSid: string,
  dialStatus: string,
  duration: number
): Record<string, string> {
  return {
    CallSid: callSid,
    AccountSid: 'AC_test_load_test',
    DialCallSid: `CA${Date.now()}${Math.random().toString(36).substring(7)}`,
    DialCallStatus: dialStatus,
    DialCallDuration: duration.toString(),
    DialBridgedCallSid: `CA${Date.now()}${Math.random().toString(36).substring(7)}`,
    RecordingUrl: `https://api.twilio.com/2010-04-01/Accounts/AC_test/Recordings/RE${Date.now()}`,
    RecordingSid: `RE${Date.now()}`,
    RecordingDuration: duration.toString(),
  };
}

// ============================================================================
// WEBHOOK SIMULATORS
// ============================================================================

async function sendWebhook(
  url: string,
  payload: Record<string, string>,
  verbose: boolean
): Promise<{ success: boolean; latency: number; response?: unknown; error?: string }> {
  const startTime = Date.now();

  try {
    const formData = new URLSearchParams(payload);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Twilio-Signature': 'load_test_signature', // Will be skipped in test mode
      },
      body: formData.toString(),
    });

    const latency = Date.now() - startTime;
    const responseText = await response.text();

    if (verbose) {
      console.log(`  [${response.status}] ${url} - ${latency}ms`);
    }

    return {
      success: response.ok,
      latency,
      response: responseText,
      error: response.ok ? undefined : `HTTP ${response.status}`,
    };
  } catch (error) {
    const latency = Date.now() - startTime;
    return {
      success: false,
      latency,
      error: (error as Error).message,
    };
  }
}

// ============================================================================
// CALL FLOW SIMULATOR
// ============================================================================

/**
 * Simulates a complete call flow through all webhooks
 */
async function simulateCallFlow(
  config: LoadTestConfig,
  callIndex: number
): Promise<CallMetrics> {
  const trackingNumber = config.trackingNumbers[callIndex % config.trackingNumbers.length];
  const startTime = Date.now();
  const metrics: CallMetrics = {
    callId: '',
    scenario: config.scenario,
    startTime,
    success: false,
  };

  try {
    // Step 1: Incoming call webhook
    const incomingPayload = generateIncomingCallPayload(trackingNumber);
    const callSid = incomingPayload.CallSid;

    const incomingResult = await sendWebhook(
      `${config.baseUrl}/api/calls/incoming`,
      incomingPayload,
      config.verbose
    );

    metrics.incomingLatency = incomingResult.latency;

    if (!incomingResult.success) {
      metrics.error = `Incoming failed: ${incomingResult.error}`;
      return metrics;
    }

    // Parse call ID from TwiML response (simplified - in reality parse XML)
    // For load testing, we'll use the CallSid as a proxy
    metrics.callId = callSid;

    // Step 2: IVR qualification (press 1 = qualified)
    const ivrPayload = generateIvrPayload(metrics.callId, callSid, '1');
    const ivrResult = await sendWebhook(
      `${config.baseUrl}/api/calls/ivr?callId=${metrics.callId}&step=1&attempt=1`,
      ivrPayload,
      config.verbose
    );

    metrics.ivrLatency = ivrResult.latency;

    if (!ivrResult.success) {
      metrics.error = `IVR failed: ${ivrResult.error}`;
      return metrics;
    }

    // Step 3: Auction runs automatically after IVR
    // In a real test, we'd parse the redirect URL from the TwiML
    // For load testing, we simulate the auction endpoint directly
    const auctionResult = await sendWebhook(
      `${config.baseUrl}/api/calls/auction?callId=${metrics.callId}`,
      { CallSid: callSid, AccountSid: 'AC_test_load_test' },
      config.verbose
    );

    metrics.auctionLatency = auctionResult.latency;

    if (!auctionResult.success) {
      metrics.error = `Auction failed: ${auctionResult.error}`;
      return metrics;
    }

    // Step 4: Call completion (simulate 90 second call)
    const completionPayload = generateCompletionPayload(callSid, 'completed', 90);
    const completionResult = await sendWebhook(
      `${config.baseUrl}/api/calls/completed?callId=${metrics.callId}`,
      completionPayload,
      config.verbose
    );

    metrics.completedLatency = completionResult.latency;
    metrics.totalLatency = Date.now() - startTime;
    metrics.success = completionResult.success;
    metrics.finalStatus = completionResult.success ? 'COMPLETED' : 'FAILED';

    if (!completionResult.success) {
      metrics.error = `Completion failed: ${completionResult.error}`;
    }

    return metrics;
  } catch (error) {
    metrics.error = (error as Error).message;
    metrics.totalLatency = Date.now() - startTime;
    return metrics;
  }
}

// ============================================================================
// LOAD TEST SCENARIOS
// ============================================================================

/**
 * Steady load: Constant number of concurrent calls
 */
async function runSteadyLoadTest(
  config: LoadTestConfig,
  onMetrics: (metrics: CallMetrics) => void
): Promise<void> {
  const endTime = Date.now() + config.duration * 1000;
  const activeCallPromises: Promise<void>[] = [];
  let callIndex = 0;

  console.log(`Starting steady load test: ${config.concurrent} concurrent calls for ${config.duration}s`);

  while (Date.now() < endTime) {
    // Maintain concurrent call count
    while (activeCallPromises.length < config.concurrent && Date.now() < endTime) {
      const currentIndex = callIndex++;
      const promise = simulateCallFlow(config, currentIndex)
        .then(onMetrics)
        .finally(() => {
          const idx = activeCallPromises.indexOf(promise);
          if (idx > -1) activeCallPromises.splice(idx, 1);
        });

      activeCallPromises.push(promise);
    }

    // Small delay to prevent tight loop
    await sleep(50);
  }

  // Wait for remaining calls to complete
  await Promise.all(activeCallPromises);
}

/**
 * Burst load: Sudden spike of calls
 */
async function runBurstLoadTest(
  config: LoadTestConfig,
  onMetrics: (metrics: CallMetrics) => void
): Promise<void> {
  console.log(`Starting burst load test: ${config.burstSize} calls burst`);

  const promises = Array.from({ length: config.burstSize }, (_, i) =>
    simulateCallFlow(config, i).then(onMetrics)
  );

  await Promise.all(promises);
}

/**
 * Ramp load: Gradually increasing concurrent calls
 */
async function runRampLoadTest(
  config: LoadTestConfig,
  onMetrics: (metrics: CallMetrics) => void
): Promise<void> {
  console.log(`Starting ramp load test: stepping up by ${config.rampStep} every 10s`);

  let currentConcurrent = config.rampStep;
  const stepDuration = 10000; // 10 seconds per step
  const steps = Math.ceil(config.duration / 10);

  for (let step = 0; step < steps; step++) {
    const stepEndTime = Date.now() + stepDuration;
    const activeCallPromises: Promise<void>[] = [];
    let callIndex = 0;

    console.log(`  Step ${step + 1}: ${currentConcurrent} concurrent calls`);

    while (Date.now() < stepEndTime) {
      while (activeCallPromises.length < currentConcurrent && Date.now() < stepEndTime) {
        const currentIndex = callIndex++;
        const promise = simulateCallFlow(config, currentIndex)
          .then(onMetrics)
          .finally(() => {
            const idx = activeCallPromises.indexOf(promise);
            if (idx > -1) activeCallPromises.splice(idx, 1);
          });

        activeCallPromises.push(promise);
      }

      await sleep(50);
    }

    await Promise.all(activeCallPromises);
    currentConcurrent += config.rampStep;
  }
}

// ============================================================================
// METRICS AGGREGATION
// ============================================================================

function calculateAggregateMetrics(
  allMetrics: CallMetrics[],
  testDurationMs: number
): AggregateMetrics {
  const successfulMetrics = allMetrics.filter(m => m.success);
  const failedMetrics = allMetrics.filter(m => !m.success);

  // Calculate latency percentiles
  const latencies = successfulMetrics
    .map(m => m.totalLatency || 0)
    .filter(l => l > 0)
    .sort((a, b) => a - b);

  const p50Index = Math.floor(latencies.length * 0.5);
  const p95Index = Math.floor(latencies.length * 0.95);
  const p99Index = Math.floor(latencies.length * 0.99);

  // Calculate averages
  const avgLatency = (arr: (number | undefined)[]) => {
    const valid = arr.filter((v): v is number => v !== undefined && v > 0);
    return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
  };

  // Error breakdown
  const errorBreakdown: Record<string, number> = {};
  failedMetrics.forEach(m => {
    const errorType = m.error?.split(':')[0] || 'Unknown';
    errorBreakdown[errorType] = (errorBreakdown[errorType] || 0) + 1;
  });

  // Status breakdown
  const statusBreakdown: Record<string, number> = {};
  allMetrics.forEach(m => {
    const status = m.finalStatus || 'UNKNOWN';
    statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;
  });

  return {
    totalCalls: allMetrics.length,
    successfulCalls: successfulMetrics.length,
    failedCalls: failedMetrics.length,
    avgIncomingLatency: avgLatency(allMetrics.map(m => m.incomingLatency)),
    avgIvrLatency: avgLatency(allMetrics.map(m => m.ivrLatency)),
    avgAuctionLatency: avgLatency(allMetrics.map(m => m.auctionLatency)),
    avgTotalLatency: avgLatency(allMetrics.map(m => m.totalLatency)),
    p50Latency: latencies[p50Index] || 0,
    p95Latency: latencies[p95Index] || 0,
    p99Latency: latencies[p99Index] || 0,
    maxLatency: Math.max(...latencies, 0),
    minLatency: Math.min(...latencies, Infinity) === Infinity ? 0 : Math.min(...latencies),
    callsPerSecond: allMetrics.length / (testDurationMs / 1000),
    errorBreakdown,
    statusBreakdown,
  };
}

// ============================================================================
// REPORTING
// ============================================================================

function printReport(metrics: AggregateMetrics, testDurationMs: number): void {
  console.log('\n' + '='.repeat(60));
  console.log('LOAD TEST RESULTS');
  console.log('='.repeat(60));

  console.log('\nOVERVIEW');
  console.log('-'.repeat(40));
  console.log(`Total Calls:        ${metrics.totalCalls}`);
  console.log(`Successful:         ${metrics.successfulCalls} (${(metrics.successfulCalls / metrics.totalCalls * 100).toFixed(1)}%)`);
  console.log(`Failed:             ${metrics.failedCalls} (${(metrics.failedCalls / metrics.totalCalls * 100).toFixed(1)}%)`);
  console.log(`Test Duration:      ${(testDurationMs / 1000).toFixed(1)}s`);
  console.log(`Throughput:         ${metrics.callsPerSecond.toFixed(2)} calls/sec`);

  console.log('\nLATENCY (ms)');
  console.log('-'.repeat(40));
  console.log(`Incoming Webhook:   ${metrics.avgIncomingLatency.toFixed(0)}ms avg`);
  console.log(`IVR Webhook:        ${metrics.avgIvrLatency.toFixed(0)}ms avg`);
  console.log(`Auction Webhook:    ${metrics.avgAuctionLatency.toFixed(0)}ms avg`);
  console.log(`Total Flow:         ${metrics.avgTotalLatency.toFixed(0)}ms avg`);
  console.log(`P50:                ${metrics.p50Latency.toFixed(0)}ms`);
  console.log(`P95:                ${metrics.p95Latency.toFixed(0)}ms`);
  console.log(`P99:                ${metrics.p99Latency.toFixed(0)}ms`);
  console.log(`Min:                ${metrics.minLatency.toFixed(0)}ms`);
  console.log(`Max:                ${metrics.maxLatency.toFixed(0)}ms`);

  if (Object.keys(metrics.errorBreakdown).length > 0) {
    console.log('\nERROR BREAKDOWN');
    console.log('-'.repeat(40));
    Object.entries(metrics.errorBreakdown).forEach(([error, count]) => {
      console.log(`${error}: ${count}`);
    });
  }

  console.log('\nSTATUS BREAKDOWN');
  console.log('-'.repeat(40));
  Object.entries(metrics.statusBreakdown).forEach(([status, count]) => {
    console.log(`${status}: ${count}`);
  });

  console.log('\n' + '='.repeat(60));

  // Performance assessment
  console.log('\nPERFORMANCE ASSESSMENT');
  console.log('-'.repeat(40));

  const issues: string[] = [];
  if (metrics.p95Latency > 5000) {
    issues.push('CRITICAL: P95 latency exceeds 5 seconds - callers will abandon');
  }
  if (metrics.p95Latency > 3000) {
    issues.push('WARNING: P95 latency exceeds 3 seconds - consider optimization');
  }
  if (metrics.failedCalls / metrics.totalCalls > 0.05) {
    issues.push('CRITICAL: Error rate exceeds 5%');
  }
  if (metrics.failedCalls / metrics.totalCalls > 0.01) {
    issues.push('WARNING: Error rate exceeds 1%');
  }
  if (metrics.avgAuctionLatency > 2000) {
    issues.push('WARNING: Auction latency high - check database/network performance');
  }

  if (issues.length === 0) {
    console.log('All performance metrics within acceptable thresholds.');
  } else {
    issues.forEach(issue => console.log(issue));
  }

  console.log('');
}

// ============================================================================
// MAIN
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  program
    .name('load-test-calls')
    .description('Load testing script for Pay-Per-Call system')
    .option('-u, --url <url>', 'Base URL for API', DEFAULT_CONFIG.baseUrl)
    .option('-c, --concurrent <number>', 'Concurrent calls (for steady scenario)', String(DEFAULT_CONFIG.concurrent))
    .option('-d, --duration <number>', 'Test duration in seconds', String(DEFAULT_CONFIG.duration))
    .option('-s, --scenario <type>', 'Test scenario: steady, burst, ramp', DEFAULT_CONFIG.scenario)
    .option('-b, --burst-size <number>', 'Burst size (for burst scenario)', String(DEFAULT_CONFIG.burstSize))
    .option('-r, --ramp-step <number>', 'Ramp step (for ramp scenario)', String(DEFAULT_CONFIG.rampStep))
    .option('-v, --verbose', 'Verbose output')
    .parse();

  const options = program.opts();

  const config: LoadTestConfig = {
    ...DEFAULT_CONFIG,
    baseUrl: options.url,
    concurrent: parseInt(options.concurrent),
    duration: parseInt(options.duration),
    scenario: options.scenario as 'steady' | 'burst' | 'ramp',
    burstSize: parseInt(options.burstSize),
    rampStep: parseInt(options.rampStep),
    verbose: options.verbose || false,
  };

  console.log('Pay-Per-Call Load Test');
  console.log('='.repeat(60));
  console.log(`Base URL:    ${config.baseUrl}`);
  console.log(`Scenario:    ${config.scenario}`);
  console.log(`Duration:    ${config.duration}s`);
  console.log(`Concurrent:  ${config.concurrent}`);
  console.log('');

  // Check if server is reachable
  try {
    const healthCheck = await fetch(`${config.baseUrl}/api/health`);
    if (!healthCheck.ok) {
      console.warn('WARNING: Health check failed - server may not be running in test mode');
    }
  } catch {
    console.error('ERROR: Cannot reach server at', config.baseUrl);
    console.error('Make sure the server is running with LOAD_TEST_MODE=true');
    process.exit(1);
  }

  const allMetrics: CallMetrics[] = [];
  const startTime = Date.now();

  const onMetrics = (metrics: CallMetrics) => {
    allMetrics.push(metrics);
    if (!config.verbose) {
      process.stdout.write(`\rCompleted: ${allMetrics.length} calls`);
    }
  };

  switch (config.scenario) {
    case 'steady':
      await runSteadyLoadTest(config, onMetrics);
      break;
    case 'burst':
      await runBurstLoadTest(config, onMetrics);
      break;
    case 'ramp':
      await runRampLoadTest(config, onMetrics);
      break;
  }

  const testDurationMs = Date.now() - startTime;
  console.log('\n');

  const aggregateMetrics = calculateAggregateMetrics(allMetrics, testDurationMs);
  printReport(aggregateMetrics, testDurationMs);

  // Exit with error code if test failed
  if (aggregateMetrics.failedCalls / aggregateMetrics.totalCalls > 0.05) {
    process.exit(1);
  }
}

main().catch(console.error);
