# Twilio Integration

> **Section:** 02 | **Phase:** 1 (MVP)
> **Parent:** [spec.md](../spec.md)

---

## Overview

This section covers all Twilio SDK integration including phone number provisioning, TwiML builders, and webhook signature verification.

## SDK Setup

### Client Initialization

```typescript
// src/lib/twilio/client.ts

import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID!;
const authToken = process.env.TWILIO_AUTH_TOKEN!;

export const twilioClient = twilio(accountSid, authToken);
```

### Phone Number Provisioning

```typescript
// Provision a new phone number
export async function provisionPhoneNumber(areaCode?: string): Promise<{
  phoneNumber: string;
  sid: string;
}> {
  const number = await twilioClient.incomingPhoneNumbers.create({
    areaCode: areaCode || '844', // Toll-free by default
    voiceUrl: `${process.env.BASE_URL}/api/calls/incoming`,
    voiceMethod: 'POST',
  });

  return {
    phoneNumber: number.phoneNumber,
    sid: number.sid,
  };
}

// Release a phone number
export async function releasePhoneNumber(sid: string): Promise<void> {
  await twilioClient.incomingPhoneNumbers(sid).remove();
}
```

## TwiML Builder

### IVR Gather

```typescript
// src/lib/twilio/twiml-builder.ts

import { twiml } from 'twilio';

export function buildIvrGather(
  prompt: string,
  actionUrl: string,
  options: { numDigits?: number; timeout?: number } = {}
): string {
  const response = new twiml.VoiceResponse();

  const gather = response.gather({
    action: actionUrl,
    numDigits: options.numDigits || 1,
    timeout: options.timeout || 10,
  });
  gather.say(prompt);

  // Fallback if no input
  response.say("We didn't receive a response. Goodbye.");
  response.hangup();

  return response.toString();
}
```

### Call Transfer

```typescript
export function buildTransfer(
  phoneNumber: string,
  callerId: string,
  callbackUrl: string,
  options: { record?: boolean; timeout?: number } = {}
): string {
  const response = new twiml.VoiceResponse();

  const dial = response.dial({
    callerId,
    action: callbackUrl,
    timeout: options.timeout || 30,
    record: options.record ? 'record-from-ringing-dual' : undefined,
    recordingStatusCallback: options.record
      ? `${process.env.BASE_URL}/api/calls/recording`
      : undefined,
  });
  dial.number(phoneNumber);

  return response.toString();
}
```

### Hold Music

```typescript
export function buildHoldMusic(message: string, musicUrl?: string): string {
  const response = new twiml.VoiceResponse();

  response.say(message);
  if (musicUrl) {
    response.play({ loop: 0 }, musicUrl);
  } else {
    // Default hold music
    response.play({ loop: 0 }, 'https://api.twilio.com/cowbell.mp3');
  }

  return response.toString();
}
```

### Rejection Message

```typescript
export function buildRejection(message: string): string {
  const response = new twiml.VoiceResponse();
  response.say(message);
  response.hangup();
  return response.toString();
}
```

## Webhook Signature Verification

```typescript
// src/lib/twilio/verify-signature.ts

import twilio from 'twilio';

export function verifyTwilioSignature(
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  return twilio.validateRequest(
    process.env.TWILIO_AUTH_TOKEN!,
    signature,
    url,
    params
  );
}

// Middleware for Next.js API routes
export async function withTwilioVerification(
  request: Request,
  handler: (body: Record<string, string>) => Promise<Response>
): Promise<Response> {
  const signature = request.headers.get('x-twilio-signature');
  if (!signature) {
    return new Response('Missing signature', { status: 401 });
  }

  const formData = await request.formData();
  const body: Record<string, string> = {};
  formData.forEach((value, key) => {
    body[key] = value.toString();
  });

  const url = request.url;

  if (!verifyTwilioSignature(signature, url, body)) {
    return new Response('Invalid signature', { status: 403 });
  }

  return handler(body);
}
```

## Environment Variables

```bash
# .env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER_POOL=  # Optional: pre-purchased numbers for forwarding
```

## TwiML Examples

### Simple IVR

```xml
<Response>
  <Say>Thank you for calling about window services.</Say>
  <Gather action="/api/calls/ivr?callId=xxx" numDigits="1" timeout="10">
    <Say>Press 1 if you own your home. Press 2 if you rent.</Say>
  </Gather>
  <Say>We didn't receive a response. Goodbye.</Say>
</Response>
```

### Transfer with Recording

```xml
<Response>
  <Dial
    callerId="+15551234567"
    record="record-from-ringing-dual"
    action="/api/calls/completed"
    timeout="30"
  >
    <Number>+15559876543</Number>
  </Dial>
</Response>
```

### Cascade Transfer

```xml
<Dial action="/api/calls/cascade?position=1" timeout="25">
  <Number>+1winnerNumber</Number>
</Dial>
```

---

## Race Condition & Security Patterns

### Webhook Idempotency (CRITICAL)

```typescript
// WHY: Twilio retries webhooks on timeouts, network issues. We MUST NOT process
//      the same event twice (could double-bill, corrupt state, trigger cascades).
// WHEN: Check BEFORE processing ANY Twilio webhook.
// HOW: Use webhook_events table with unique constraint on event_key.

// src/lib/twilio/idempotency.ts

export async function isWebhookProcessed(
  eventType: string,
  callSid: string,
  eventStatus?: string
): Promise<boolean> {
  const eventKey = `${eventType}:${callSid}:${eventStatus || 'default'}`;

  try {
    // Attempt to insert - if exists, it will throw
    await prisma.webhookEvent.create({
      data: {
        eventType,
        externalId: callSid,
        eventKey,
        processedAt: new Date(),
      }
    });
    return false; // Not processed, we just claimed it
  } catch (error) {
    if (error.code === 'P2002') { // Unique constraint violation
      return true; // Already processed
    }
    throw error;
  }
}

// Usage in webhook handler:
export async function POST(request: Request) {
  const body = await parseFormData(request);

  if (await isWebhookProcessed('call_completed', body.CallSid, body.CallStatus)) {
    return new Response('Already processed', { status: 200 });
  }

  // Process the webhook...
}
```

### State Machine Validation

```typescript
// WHY: Out-of-order webhooks can corrupt call status.
//      e.g., "completed" arriving before "in-progress" due to network timing.
// WHEN: Before updating call status in any webhook handler.
// HOW: Define valid transitions and reject invalid ones.

// src/lib/twilio/state-machine.ts

const VALID_TRANSITIONS: Record<string, string[]> = {
  'RINGING': ['IVR', 'BIDDING', 'FAILED', 'CALLER_HANGUP'],
  'IVR': ['BIDDING', 'REJECTED', 'CALLER_HANGUP', 'FAILED'],
  'BIDDING': ['CONNECTING', 'NO_BIDS', 'CALLER_HANGUP', 'FAILED'],
  'CONNECTING': ['CONNECTED', 'CASCADING', 'FAILED', 'NO_ANSWER'],
  'CASCADING': ['CONNECTED', 'NO_ANSWER', 'FAILED'],
  'CONNECTED': ['COMPLETED', 'FAILED'],
  'COMPLETED': [], // Terminal state
  'FAILED': [], // Terminal state
  'REJECTED': [], // Terminal state
  'CALLER_HANGUP': [], // Terminal state
  'NO_BIDS': [], // Terminal state
  'NO_ANSWER': [], // Terminal state (all cascades exhausted)
};

export function canTransition(from: string, to: string): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function validateAndTransition(
  call: Call,
  newStatus: string
): void {
  if (!canTransition(call.status, newStatus)) {
    throw new InvalidStateTransitionError(
      `Cannot transition from ${call.status} to ${newStatus}`
    );
  }
}
```

### Rate Limiting for Twilio API

```typescript
// WHY: Twilio has rate limits. Burst traffic could cause failures.
// WHEN: All outbound Twilio API calls.
// HOW: Use Bottleneck for rate limiting.

// src/lib/twilio/rate-limiter.ts

import Bottleneck from 'bottleneck';

// Twilio allows ~100 requests/second, we limit to 50 for safety
const twilioLimiter = new Bottleneck({
  maxConcurrent: 50,
  minTime: 20, // 20ms between calls = 50/sec max
  reservoir: 100, // Allow burst of 100
  reservoirRefreshAmount: 100,
  reservoirRefreshInterval: 1000, // Refill every second
});

export async function rateLimitedTwilioCall<T>(
  operation: () => Promise<T>
): Promise<T> {
  return twilioLimiter.schedule(operation);
}

// Usage:
export async function provisionPhoneNumber(areaCode?: string) {
  return rateLimitedTwilioCall(async () => {
    return twilioClient.incomingPhoneNumbers.create({
      areaCode: areaCode || '844',
      voiceUrl: `${process.env.BASE_URL}/api/calls/incoming`,
    });
  });
}
```

### Circuit Breaker for Twilio Outages

```typescript
// WHY: If Twilio is down, we shouldn't keep hammering them.
//      Circuit breaker prevents cascade failures.
// WHEN: Wraps all Twilio API calls.
// HOW: Track failures, open circuit after threshold, auto-reset after cooldown.

// src/lib/twilio/circuit-breaker.ts

import CircuitBreaker from 'opossum';

const twilioCircuitBreaker = new CircuitBreaker(
  async (operation: () => Promise<any>) => operation(),
  {
    timeout: 10000, // 10s timeout
    errorThresholdPercentage: 50, // Open if 50% fail
    resetTimeout: 30000, // Try again after 30s
    volumeThreshold: 5, // Need 5 requests before opening
  }
);

twilioCircuitBreaker.on('open', () => {
  logger.error('Twilio circuit breaker OPEN - Twilio may be down');
  // Could trigger alerting here
});

twilioCircuitBreaker.on('halfOpen', () => {
  logger.warn('Twilio circuit breaker testing...');
});

twilioCircuitBreaker.on('close', () => {
  logger.info('Twilio circuit breaker closed - Twilio recovered');
});

export async function withCircuitBreaker<T>(
  operation: () => Promise<T>
): Promise<T> {
  return twilioCircuitBreaker.fire(operation);
}
```

### Retry Logic with Exponential Backoff

```typescript
// WHY: Transient Twilio errors shouldn't fail the call.
// WHEN: API calls that can safely retry (not webhooks).
// HOW: Exponential backoff with jitter.

// src/lib/twilio/retry.ts

export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
  } = {}
): Promise<T> {
  const { maxRetries = 3, initialDelay = 1000, maxDelay = 10000 } = options;

  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // Don't retry on client errors (4xx)
      if (error.status >= 400 && error.status < 500) {
        throw error;
      }

      if (attempt < maxRetries) {
        const delay = Math.min(
          initialDelay * Math.pow(2, attempt) + Math.random() * 1000,
          maxDelay
        );
        await sleep(delay);
      }
    }
  }

  throw lastError;
}
```

---

## User Stories

### US-TW-1: System Handles Twilio Outage
**AS THE** system during a Twilio outage
**I WANT TO** fail gracefully and recover automatically
**SO THAT** we don't lose all calls or create zombie states

**WHEN** Twilio API starts failing (>50% error rate)
**THEN** circuit breaker opens
**AND** new calls get a "service temporarily unavailable" message
**AND** after 30 seconds, circuit breaker tests recovery
**AND** if recovered, normal operation resumes

### US-TW-2: Webhook Arrives Out of Order
**AS THE** system receiving an out-of-order webhook
**I WANT TO** reject invalid state transitions
**SO THAT** call state remains consistent

**WHEN** a "completed" webhook arrives before "connected"
**THEN** state machine rejects the transition
**AND** logs warning for investigation
**AND** webhook is NOT marked as processed (allowing retry)

### US-TW-3: Duplicate Webhook Arrives
**AS THE** system receiving a duplicate webhook
**I WANT TO** recognize it was already processed
**SO THAT** we don't double-charge or corrupt data

**WHEN** same webhook arrives twice (Twilio retry)
**THEN** second attempt returns 200 immediately
**AND** no database updates occur
**AND** no billing events are triggered

### US-TW-4: High Traffic Spike
**AS THE** system during a traffic spike
**I WANT TO** rate-limit Twilio API calls
**SO THAT** we don't exceed their limits and get blocked

**WHEN** 500 calls arrive simultaneously
**THEN** Twilio API calls are queued
**AND** max 50 concurrent calls to Twilio
**AND** no calls are dropped due to rate limiting

### US-TW-5: Phone Number Provision Fails
**AS THE** system when Twilio provisioning fails
**I WANT TO** retry with backoff
**SO THAT** transient errors don't cause affiliate frustration

**WHEN** Twilio returns 503 on number provision
**THEN** system retries up to 3 times
**AND** waits 1s, 2s, 4s between retries
**AND** if all retries fail, returns clear error to affiliate

### US-TW-6: Admin Audits Webhook History
**AS AN** admin investigating a call issue
**I WANT TO** see all webhooks received for that call
**SO THAT** I can understand the sequence of events

**WHEN** I search by CallSid
**THEN** I see all webhook_events for that call
**AND** I can see timestamps, payloads, and processing results

---

## Implementation Tasks

| Task ID | Description | Status |
|---------|-------------|--------|
| P1-TW-1 | Set up Twilio account, add env vars | ⬜ |
| P1-TW-2 | Create `src/lib/twilio/client.ts` | ⬜ |
| P1-TW-3 | Implement `provisionPhoneNumber()` | ⬜ |
| P1-TW-4 | Implement `releasePhoneNumber()` | ⬜ |
| P1-TW-5 | Create `src/lib/twilio/twiml-builder.ts` | ⬜ |
| P1-TW-6 | Implement `buildIvrGather()` | ⬜ |
| P1-TW-7 | Implement `buildTransfer()` | ⬜ |
| P1-TW-8 | Implement `buildHoldMusic()` | ⬜ |
| P1-TW-9 | Implement `buildRejection()` | ⬜ |
| P1-TW-10 | Add webhook signature verification | ⬜ |

### Logging Tasks (CRITICAL FOR DEBUGGING)

> **Every webhook event MUST be logged** for debugging and compliance.
> See [Section 12: Logging & Observability](./12-logging-observability.md) for full details.

| Task ID | Description | Status | Priority |
|---------|-------------|--------|----------|
| P1-TW-LOG-1 | Log all incoming webhooks with CallSid, event type, timestamp | ⬜ | CRITICAL |
| P1-TW-LOG-2 | Log all Twilio API calls (provision, release, transfer) | ⬜ | CRITICAL |
| P1-TW-LOG-3 | Log all TwiML responses generated | ⬜ | HIGH |
| P1-TW-LOG-4 | Log circuit breaker state changes | ⬜ | HIGH |
| P1-TW-LOG-5 | Log rate limiter queue depth | ⬜ | MEDIUM |
| P1-TW-LOG-6 | Store webhook payloads in webhook_events table | ⬜ | CRITICAL |

**Example logging pattern:**
```typescript
// Every webhook handler should start with:
logger.info({
  event: 'webhook.received',
  message: 'Incoming Twilio webhook',
  callSid: body.CallSid,
  eventType: body.CallStatus || body.RecordingStatus,
  timestamp: new Date().toISOString()
});

// Log to database for user-facing dashboards:
await callLoggingService.logCallEvent({
  callId,
  event: 'call.webhook_received',
  message: 'Webhook received: {eventType}',
  details: { eventType: body.CallStatus },
  visibleToAffiliate: false // Technical events are admin-only
});
```

### Security & Resilience Tasks

| Task ID | Description | Status |
|---------|-------------|--------|
| P1-TW-11 | Create `src/lib/twilio/idempotency.ts` with `isWebhookProcessed()` | ⬜ |
| P1-TW-12 | Add idempotency checks to ALL webhook handlers | ⬜ |
| P1-TW-13 | Create `src/lib/twilio/state-machine.ts` with valid transitions | ⬜ |
| P1-TW-14 | Add state validation to all status updates | ⬜ |
| P1-TW-15 | Create `src/lib/twilio/rate-limiter.ts` with Bottleneck | ⬜ |
| P1-TW-16 | Wrap all Twilio API calls with rate limiter | ⬜ |
| P1-TW-17 | Create `src/lib/twilio/circuit-breaker.ts` with Opossum | ⬜ |
| P1-TW-18 | Add circuit breaker to all Twilio operations | ⬜ |
| P1-TW-19 | Create `src/lib/twilio/retry.ts` with exponential backoff | ⬜ |
| P1-TW-20 | Add retry logic to provisioning and transfers | ⬜ |
| P1-TW-21 | Add circuit breaker alerting (Slack/email) | ⬜ |

### Testing Tasks

| Task ID | Description | Status |
|---------|-------------|--------|
| P1-TW-T1 | Test duplicate webhook is rejected | ⬜ |
| P1-TW-T2 | Test out-of-order webhook is rejected | ⬜ |
| P1-TW-T3 | Test circuit breaker opens after failures | ⬜ |
| P1-TW-T4 | Test circuit breaker recovers after cooldown | ⬜ |
| P1-TW-T5 | Test rate limiter queues excess requests | ⬜ |
| P1-TW-T6 | Test retry logic with mock Twilio failures | ⬜ |
| P1-TW-T7 | Integration test: full call flow with idempotency | ⬜ |

---

## Sentry Integration

### Error Tracking and Alerting

```typescript
import * as Sentry from '@sentry/nextjs';

// Set context for all Twilio operations
function setTwilioContext(callSid: string, eventType: string) {
  Sentry.setContext('twilio', {
    callSid,
    eventType,
    timestamp: new Date().toISOString()
  });
}

// Webhook failure tracking
async function handleWebhookWithSentry(
  handler: () => Promise<Response>,
  callSid: string,
  eventType: string
): Promise<Response> {
  Sentry.addBreadcrumb({
    category: 'twilio.webhook',
    message: `Processing ${eventType} webhook`,
    level: 'info',
    data: { callSid, eventType }
  });

  try {
    return await handler();
  } catch (error) {
    Sentry.captureException(error, {
      tags: { component: 'twilio-webhook', eventType },
      extra: { callSid }
    });
    throw error;
  }
}
```

### Sentry Events to Capture

| Event | Sentry Method | Severity | When to Trigger |
|-------|---------------|----------|-----------------|
| Webhook signature validation failure | `captureMessage` | warning | Invalid X-Twilio-Signature |
| Twilio API error (5xx) | `captureException` | error | Twilio returns server error |
| Twilio API timeout | `captureException` | error | Request exceeds timeout |
| Rate limit exceeded | `captureMessage` | warning | Bottleneck queue full |
| Circuit breaker opened | `captureMessage` | error | >50% Twilio failures |
| Circuit breaker recovered | `captureMessage` | info | Service restored |
| Duplicate webhook detected | `captureMessage` | info | Idempotency check triggered |
| Invalid state transition | `captureException` | error | State machine violation |

### Breadcrumb Tracking

```typescript
// Add breadcrumbs for Twilio operations
Sentry.addBreadcrumb({
  category: 'twilio.api',
  message: 'Provisioning phone number',
  level: 'info',
  data: { areaCode: '844', affiliateId }
});

Sentry.addBreadcrumb({
  category: 'twilio.webhook',
  message: 'Call status changed',
  level: 'info',
  data: { callSid, from: oldStatus, to: newStatus }
});

Sentry.addBreadcrumb({
  category: 'twilio.circuit',
  message: 'Circuit breaker state change',
  level: 'warning',
  data: { state: 'open', failureRate: '55%' }
});
```

### Alert Configuration

```typescript
// Critical alerts for on-call
const CRITICAL_SENTRY_ALERTS = [
  'Circuit breaker opened',
  'Multiple webhook signature failures',
  'Twilio API consistently failing'
];

// Warning alerts for monitoring
const WARNING_SENTRY_ALERTS = [
  'Rate limit queue depth > 50',
  'Webhook processing latency > 5s',
  'Duplicate webhook rate > 10%'
];
```

---

---

## Complete Twilio Webhook Parameter Reference

> **WHY this matters for debugging**: When investigating call issues, knowing ALL available parameters helps identify root causes faster. Twilio sends rich metadata that we may not store initially but is invaluable for debugging edge cases, carrier issues, and geographic problems.

### 1. Incoming Call Webhook Parameters (All Available)

These parameters are sent by Twilio when a call first arrives at our tracking number.

```typescript
/**
 * WHY: This is the entry point for ALL calls. Every field here helps debug
 *      "why didn't this call work?" questions.
 * WHEN: Twilio POSTs to our /api/calls/incoming webhook
 * HOW: Parse as form-data, store critical fields, log ALL for debugging
 */
interface TwilioIncomingCallWebhook {
  // ═══════════════════════════════════════════════════════════════════════════
  // CORE IDENTIFIERS - Always present, always log these
  // ═══════════════════════════════════════════════════════════════════════════

  /** Unique call identifier - PRIMARY KEY for all call operations */
  CallSid: string;

  /** Twilio account identifier - verify this matches our account */
  AccountSid: string;

  /** API version (e.g., "2010-04-01") - useful for debugging API changes */
  ApiVersion: string;

  // ═══════════════════════════════════════════════════════════════════════════
  // CALL DIRECTION - Critical for understanding call flow
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Direction of the call:
   * - 'inbound': Customer calling our tracking number (most common)
   * - 'outbound-api': We initiated call via REST API
   * - 'outbound-dial': We initiated call via <Dial> TwiML
   */
  Direction: 'inbound' | 'outbound-api' | 'outbound-dial';

  // ═══════════════════════════════════════════════════════════════════════════
  // PHONE NUMBERS - E.164 format (+1XXXXXXXXXX)
  // ═══════════════════════════════════════════════════════════════════════════

  /** Caller's phone number in E.164 format (e.g., "+15551234567") */
  From: string;

  /** Called phone number - this is our tracking number */
  To: string;

  /**
   * Original number if call was forwarded to us
   * WHY: Helps debug affiliate forwarding issues
   */
  ForwardedFrom?: string;

  // ═══════════════════════════════════════════════════════════════════════════
  // CALLER LOCATION - US/Canada only, may be empty or inaccurate
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * City of the caller (e.g., "Los Angeles")
   * WARNING: Based on phone prefix, NOT GPS. May be wrong for mobile/VoIP.
   */
  FromCity?: string;

  /** State/province code (e.g., "CA", "ON") */
  FromState?: string;

  /**
   * ZIP/postal code (e.g., "90210")
   * WARNING: Often inaccurate for mobile numbers. Use IVR to confirm.
   */
  FromZip?: string;

  /** Country code (e.g., "US", "CA") */
  FromCountry?: string;

  // ═══════════════════════════════════════════════════════════════════════════
  // CALLED NUMBER LOCATION - Where our tracking number is "from"
  // ═══════════════════════════════════════════════════════════════════════════

  /** City associated with our tracking number */
  ToCity?: string;

  /** State of our tracking number */
  ToState?: string;

  /** ZIP code of our tracking number */
  ToZip?: string;

  /** Country of our tracking number */
  ToCountry?: string;

  // ═══════════════════════════════════════════════════════════════════════════
  // CALLER ID - CNAM lookup (US landlines mainly)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Caller Name from CNAM database lookup
   * WHY: Can identify business callers, potential spam
   * WARNING: Often empty for mobile/VoIP. May be "WIRELESS CALLER" or similar.
   */
  CallerName?: string;

  // ═══════════════════════════════════════════════════════════════════════════
  // CALL STATUS - Current state when webhook fires
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Current call status:
   * - 'queued': Call is waiting to connect (rare to see this)
   * - 'ringing': Call is ringing, not yet answered
   * - 'in-progress': Call is connected and active
   * - 'completed': Call ended normally
   * - 'busy': Called party was busy
   * - 'failed': Call could not be placed
   * - 'no-answer': Call rang but wasn't answered within timeout
   * - 'canceled': Call was canceled before connecting
   */
  CallStatus: 'queued' | 'ringing' | 'in-progress' | 'completed' | 'busy' | 'failed' | 'no-answer' | 'canceled';

  // ═══════════════════════════════════════════════════════════════════════════
  // SECURITY
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Unique token for this specific webhook request
   * WHY: Can be used for additional verification beyond X-Twilio-Signature
   */
  CallToken?: string;

  // ═══════════════════════════════════════════════════════════════════════════
  // ADDITIONAL PARAMETERS (may appear in some contexts)
  // ═══════════════════════════════════════════════════════════════════════════

  /** Parent call SID if this is a child call (from <Dial>) */
  ParentCallSid?: string;

  /** SIP domain if call arrived via SIP */
  SipDomain?: string;

  /** Stirred/Shaken attestation level (A, B, C, or empty) */
  StirVerstat?: string;
}
```

### 2. Dial Action Callback Parameters (All Available)

These parameters are sent when a `<Dial>` verb completes (buyer answers, rejects, or times out).

```typescript
/**
 * WHY: This webhook tells us the OUTCOME of trying to connect to a buyer.
 *      Critical for cascade logic and billing decisions.
 * WHEN: Twilio POSTs to the `action` URL specified in <Dial> TwiML
 * HOW: Parse result, decide to cascade or finalize call
 */
interface TwilioDialActionWebhook {
  // ═══════════════════════════════════════════════════════════════════════════
  // ORIGINAL CALL IDENTIFIERS
  // ═══════════════════════════════════════════════════════════════════════════

  /** SID of the original inbound call (caller's leg) */
  CallSid: string;

  /** Twilio account identifier */
  AccountSid: string;

  // ═══════════════════════════════════════════════════════════════════════════
  // DIALED LEG INFO - The buyer's side of the call
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * SID of the dialed call leg (buyer's leg)
   * WHY: Use this to look up buyer-side recordings, duration, etc.
   */
  DialCallSid: string;

  /**
   * Status of the dialed leg:
   * - 'completed': Buyer answered and call ended normally
   * - 'busy': Buyer's line was busy
   * - 'no-answer': Buyer didn't answer within timeout
   * - 'failed': Could not connect (invalid number, carrier issue)
   * - 'canceled': Caller hung up before buyer answered
   */
  DialCallStatus: 'completed' | 'busy' | 'no-answer' | 'failed' | 'canceled';

  /**
   * Duration of the dialed leg in seconds
   * NOTE: Only present if the call was answered (DialCallStatus = 'completed')
   * WHY: This is the BILLABLE duration for the buyer
   */
  DialCallDuration?: string;

  /**
   * Whether the calls were successfully bridged (caller talked to buyer)
   * WHY: 'true' means we should bill the buyer. 'false' means cascade.
   */
  DialBridged: 'true' | 'false';

  // ═══════════════════════════════════════════════════════════════════════════
  // RECORDING INFO (if record attribute was set on <Dial>)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * URL to download the recording (add .mp3 or .wav extension)
   * NOTE: Only present if recording was requested and completed
   */
  RecordingUrl?: string;

  /** Unique identifier for the recording */
  RecordingSid?: string;

  /** Duration of the recording in seconds */
  RecordingDuration?: string;

  // ═══════════════════════════════════════════════════════════════════════════
  // QUEUE INFO (if dialing into a Twilio Queue)
  // ═══════════════════════════════════════════════════════════════════════════

  /** Queue SID if call was connected via a Queue */
  QueueSid?: string;

  /** Time the caller spent waiting in queue (seconds) */
  QueueTime?: string;

  // ═══════════════════════════════════════════════════════════════════════════
  // STANDARD CALL PARAMETERS (also included)
  // ═══════════════════════════════════════════════════════════════════════════

  /** Caller's phone number */
  From: string;

  /** Our tracking number */
  To: string;

  /** Current status of the parent call */
  CallStatus: string;

  /** Call direction */
  Direction: string;
}
```

### 3. Gather Callback Parameters (All Available)

These parameters are sent when a `<Gather>` verb completes (user presses keys or speaks).

```typescript
/**
 * WHY: Gather responses drive IVR logic (qualify/disqualify callers).
 *      Understanding all parameters helps debug "why did IVR skip?" issues.
 * WHEN: Twilio POSTs to the `action` URL specified in <Gather> TwiML
 * HOW: Parse Digits or SpeechResult, route accordingly
 */
interface TwilioGatherWebhook {
  // ═══════════════════════════════════════════════════════════════════════════
  // CORE IDENTIFIERS
  // ═══════════════════════════════════════════════════════════════════════════

  /** Unique call identifier */
  CallSid: string;

  /** Twilio account identifier */
  AccountSid: string;

  // ═══════════════════════════════════════════════════════════════════════════
  // DTMF INPUT (when input includes 'dtmf' - default)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Keys pressed by the caller (e.g., "1", "123", "#")
   * NOTE: Only present if caller pressed keys. Empty/missing if timeout.
   * WHY: This drives IVR qualification logic
   */
  Digits?: string;

  // ═══════════════════════════════════════════════════════════════════════════
  // SPEECH INPUT (Phase 2 - when input includes 'speech')
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Transcribed speech from the caller
   * NOTE: Requires speech recognition to be enabled in <Gather>
   * WHY: Allows natural language IVR ("Say 'yes' to confirm...")
   */
  SpeechResult?: string;

  /**
   * Confidence score for speech recognition (0.0 to 1.0)
   * WHY: Low confidence (<0.5) might mean unclear audio, should re-prompt
   */
  Confidence?: string;

  // ═══════════════════════════════════════════════════════════════════════════
  // STANDARD CALL PARAMETERS (also included)
  // ═══════════════════════════════════════════════════════════════════════════

  /** Caller's phone number */
  From: string;

  /** Our tracking number */
  To: string;

  /** Current call status */
  CallStatus: string;

  /** Caller location (if available) */
  FromCity?: string;
  FromState?: string;
  FromZip?: string;
  FromCountry?: string;
}
```

### 4. Call Status Callback Parameters (All Available)

These parameters are sent for each status change during a call's lifecycle.

```typescript
/**
 * WHY: Status callbacks let us track call lifecycle without relying on
 *      action callbacks. Essential for accurate billing and analytics.
 * WHEN: Twilio POSTs to statusCallback URL at each status transition
 * HOW: Update call state machine, trigger billing on 'completed'
 */
interface TwilioStatusCallbackWebhook {
  // ═══════════════════════════════════════════════════════════════════════════
  // CORE IDENTIFIERS
  // ═══════════════════════════════════════════════════════════════════════════

  /** Unique call identifier */
  CallSid: string;

  /** Twilio account identifier */
  AccountSid: string;

  // ═══════════════════════════════════════════════════════════════════════════
  // STATUS INFO
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Current call status:
   * - 'queued': Call is queued (outbound calls only)
   * - 'initiated': Call is being placed (outbound)
   * - 'ringing': Phone is ringing
   * - 'in-progress': Call is active
   * - 'completed': Call ended normally
   * - 'busy': Line was busy
   * - 'failed': Call could not be placed
   * - 'no-answer': No answer within timeout
   * - 'canceled': Call was canceled
   */
  CallStatus: 'queued' | 'initiated' | 'ringing' | 'in-progress' | 'completed' | 'busy' | 'failed' | 'no-answer' | 'canceled';

  // ═══════════════════════════════════════════════════════════════════════════
  // TIMING (when call ends)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Total call duration in seconds
   * NOTE: Only present when CallStatus is 'completed'
   * WHY: Primary metric for billing calculation
   */
  CallDuration?: string;

  // ═══════════════════════════════════════════════════════════════════════════
  // ERROR INFO (when status is 'failed')
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Twilio error code (e.g., "21211", "30003")
   * WHY: Helps diagnose why calls fail - see error codes table below
   */
  ErrorCode?: string;

  /** Human-readable error message */
  ErrorMessage?: string;

  // ═══════════════════════════════════════════════════════════════════════════
  // SIP INFO (if applicable)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * SIP response code if call went through SIP trunk
   * WHY: Helps debug carrier-level issues
   */
  SipResponseCode?: string;

  // ═══════════════════════════════════════════════════════════════════════════
  // TIMESTAMPS AND ORDERING
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * ISO 8601 timestamp of when this status occurred
   * WHY: Helps reconstruct call timeline for debugging
   */
  Timestamp?: string;

  /**
   * Sequence number for ordering status updates
   * WHY: Webhooks may arrive out of order - use this to process correctly
   */
  SequenceNumber?: string;

  // ═══════════════════════════════════════════════════════════════════════════
  // ADDITIONAL FIELDS
  // ═══════════════════════════════════════════════════════════════════════════

  /** Who initiated the call (if available) */
  CalledVia?: string;

  /** Answering machine detection result */
  AnsweredBy?: 'human' | 'machine_start' | 'machine_end_beep' | 'machine_end_silence' | 'machine_end_other' | 'fax' | 'unknown';
}
```

---

## Common Twilio Error Codes Reference

> **WHY this matters**: When calls fail, the error code tells you exactly what went wrong. This reference helps quickly diagnose and fix issues.

### Dial-Related Errors

| Code | Name | Description | Recommended Action |
|------|------|-------------|-------------------|
| 13224 | Dial: Invalid phone number | Phone number format is incorrect | Validate format before dialing, log and skip buyer |
| 13225 | Dial: Forbidden phone number | Number is blocked or restricted | Log and skip buyer, alert if pattern emerges |
| 13226 | Dial: Invalid country code | Country not supported by account | Log and skip buyer, verify account permissions |
| 13227 | Dial: No international authorization | Account not enabled for international | Alert admin to enable international dialing |
| 13228 | Dial: Phone number not verified | Outbound number not verified (trial accounts) | Verify the number or upgrade account |

### Phone Number Errors

| Code | Name | Description | Recommended Action |
|------|------|-------------|-------------------|
| 21211 | Invalid 'To' phone number | Malformed phone number | Validate format before storing buyer numbers |
| 21214 | 'To' phone number cannot be reached | Number is disconnected or unreachable | Mark buyer phone as invalid, request update |
| 21215 | Account not authorized for destination | Geographic or regulatory restriction | Alert admin, check account settings |
| 21217 | Phone number does not appear to be valid | Number fails Twilio validation | Log for investigation, may be carrier issue |

### Carrier/Network Errors

| Code | Name | Description | Recommended Action |
|------|------|-------------|-------------------|
| 30001 | Queue Timeout | Call waited too long in queue | Review queue configuration |
| 30002 | Account suspended | Twilio account is suspended | CRITICAL: Contact Twilio immediately |
| 30003 | Unreachable destination | Carrier cannot reach number | Retry with exponential backoff, then cascade |
| 30004 | Message blocked | SMS blocked by carrier (for SMS) | N/A for voice |
| 30005 | Unknown destination | Number doesn't exist | Mark buyer number as invalid |
| 30006 | Landline unreachable | Landline-specific carrier issue | Log for debugging, may be temporary |
| 30007 | Carrier violation | Message violates carrier policies (SMS) | N/A for voice |
| 30008 | Unknown error | Carrier returned unknown error | Retry with backoff, escalate if persistent |

### TwiML Errors

| Code | Name | Description | Recommended Action |
|------|------|-------------|-------------------|
| 31000 | General TwiML error | TwiML parsing failed | Check TwiML generation code, log full TwiML |
| 31001 | Invalid TwiML format | Malformed XML | Validate TwiML before returning |
| 31002 | Connection declined | Remote end rejected connection | Log and cascade to next buyer |
| 31003 | Invalid TwiML verb | Unknown verb in TwiML | Check TwiML builder for typos |
| 31005 | Invalid attribute | Unknown attribute on TwiML verb | Review TwiML documentation |

### Authentication/Security Errors

| Code | Name | Description | Recommended Action |
|------|------|-------------|-------------------|
| 20001 | Invalid account | Account SID is invalid | Check environment variables |
| 20003 | Permission denied | Operation not allowed | Check account permissions |
| 20004 | Method not allowed | HTTP method not supported | Use POST for webhooks |
| 20005 | Account not active | Account is inactive | Contact Twilio support |

### Recording-Specific Errors

| Code | Name | Description | Recommended Action |
|------|------|-------------|-------------------|
| 32001 | Recording failed | Recording could not be created | Log and continue, recording is optional |
| 32002 | Recording storage failed | Could not store recording | Check storage callback URL |
| 32003 | Recording too short | Call too short to record | Expected for quick hangups |

---

## Debugging Tips for Webhook Issues

### Webhook Not Received

1. **Check Twilio Console** - Look at "Monitor > Calls" for webhook errors
2. **Verify URL** - Ensure webhook URL is publicly accessible (not localhost)
3. **Check HTTPS** - Twilio requires HTTPS for production webhooks
4. **Review Firewall** - Ensure Twilio IPs are not blocked

### Webhook Signature Validation Failures

1. **URL Mismatch** - Signature is calculated against EXACT URL including query params
2. **Protocol Mismatch** - HTTP vs HTTPS matters for signature
3. **Behind Proxy** - If behind load balancer, may need to use `X-Forwarded-Proto`
4. **Body Parsing** - Must validate against raw form-data, not parsed JSON

### Out-of-Order Webhooks

1. **Use SequenceNumber** - Process in order when available
2. **State Machine** - Validate transitions before applying
3. **Idempotency Keys** - Prevent duplicate processing

*Section Version: 2.2 (Added Complete Webhook Parameter Reference and Error Codes)*
