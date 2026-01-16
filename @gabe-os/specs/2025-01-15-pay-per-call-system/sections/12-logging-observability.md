# Logging & Observability

> **Section:** 12 | **Phase:** 1 (MVP) - Critical for debugging and support
> **Parent:** [spec.md](../spec.md)

---

## Overview

Comprehensive logging strategy for debugging, compliance, and user-facing activity feeds.
**Logging is NOT optional** - it's essential for:
- Debugging production issues quickly
- Compliance and audit trails
- Affiliate transparency (builds trust)
- Support ticket resolution

---

## Logging Principles

### 1. Log Everything That Matters

```typescript
/**
 * WHY: You can't debug what you didn't log
 * WHEN: Every significant action, state change, or decision
 * HOW: Structured JSON logs with consistent fields
 */

// ALWAYS log these events:
const MUST_LOG_EVENTS = [
  // Call lifecycle
  'call.received',
  'call.ivr_started',
  'call.ivr_response',
  'call.qualified',
  'call.rejected',
  'call.auction_started',
  'call.bid_received',
  'call.winner_selected',
  'call.transfer_started',
  'call.transfer_connected',
  'call.transfer_failed',
  'call.completed',
  'call.recording_available',

  // Auction events
  'auction.started',
  'auction.buyer_pinged',
  'auction.bid_received',
  'auction.no_bids',
  'auction.winner_selected',
  'auction.cascade_started',

  // Phone provisioning
  'phone.provisioning_started',
  'phone.provisioned',
  'phone.provisioning_failed',
  'phone.released',

  // Errors (always)
  'error.webhook_failed',
  'error.twilio_api',
  'error.auction_failed',
  'error.transfer_failed',
];
```

### 2. Structured Logging Format

```typescript
interface LogEntry {
  // Required fields
  timestamp: string;        // ISO 8601
  level: 'debug' | 'info' | 'warn' | 'error';
  event: string;            // e.g., 'call.completed'
  message: string;          // Human-readable description

  // Context (always include when available)
  callId?: string;
  affiliateId?: string;
  buyerId?: string;
  campaignId?: string;
  trackingNumberId?: string;
  twilioCallSid?: string;

  // Call-specific
  callerPhone?: string;     // Masked: (555) ***-4567
  duration?: number;        // Seconds
  status?: string;
  bidAmount?: number;

  // Error-specific
  errorCode?: string;
  errorMessage?: string;
  stackTrace?: string;

  // Performance
  durationMs?: number;      // How long this operation took

  // Request context
  requestId?: string;       // Trace across services
  userAgent?: string;
  ip?: string;
}

// Example log entry
logger.info({
  event: 'call.completed',
  message: 'Call completed successfully',
  callId: 'call-123',
  affiliateId: 'aff-456',
  buyerId: 'buyer-789',
  callerPhone: '(555) ***-4567',
  duration: 245,
  status: 'QUALIFIED',
  bidAmount: 52.00
});
```

### 3. Log Levels

| Level | Use For | Visible To |
|-------|---------|------------|
| `debug` | Detailed debugging info | Developers only |
| `info` | Normal operations | Admin dashboard |
| `warn` | Concerning but not broken | Admin alerts |
| `error` | Something failed | Immediate alert |

---

## Call Activity Log (Database)

> **Store in database for user-facing activity feeds**

```typescript
// Database table: call_activity_logs
interface CallActivityLog {
  id: string;
  callId: string;
  timestamp: Date;
  event: string;
  message: string;           // User-friendly message
  details: JsonValue;        // Additional context
  visibleToAffiliate: boolean;
  visibleToAdmin: boolean;
  createdAt: Date;
}

// Examples of affiliate-visible logs
const AFFILIATE_VISIBLE_EVENTS = [
  { event: 'call.received', message: 'Call received from {callerPhone}' },
  { event: 'call.qualified', message: 'Caller qualified via IVR' },
  { event: 'call.rejected', message: 'Caller did not qualify (reason: {reason})' },
  { event: 'call.transferred', message: 'Call transferred to buyer' },
  { event: 'call.completed', message: 'Call completed - Duration: {duration}' },
  { event: 'call.payout', message: 'Payout: ${amount}' },
];

// Admin-only logs (more technical)
const ADMIN_ONLY_EVENTS = [
  { event: 'auction.bid_received', message: 'Bid: ${amount} from {buyerName}' },
  { event: 'auction.winner_selected', message: 'Winner: {buyerName} at ${amount}' },
  { event: 'error.transfer_failed', message: 'Transfer failed: {errorMessage}' },
];
```

---

## Super Admin Log Dashboard

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  ADMIN: SYSTEM LOGS                                                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  Filters: [All Levels ▼] [All Events ▼] [All Affiliates ▼] [Last 24h ▼]        │
│  Search: [Search logs...                                            ] [🔍]      │
│                                                                                  │
│  ┌─ LIVE LOG STREAM ───────────────────────────────────────────────────────┐   │
│  │                                                                          │   │
│  │  🟢 14:32:15  call.completed     Call completed - 4:05 duration         │   │
│  │              Call ID: call-abc123  Affiliate: John's Marketing           │   │
│  │              Buyer: Modernize  Bid: $58.00  Payout: $35.00               │   │
│  │                                                                          │   │
│  │  🟡 14:32:12  call.cascade       First buyer didn't answer, trying next │   │
│  │              Call ID: call-def456  Cascade: 1 → 2                        │   │
│  │                                                                          │   │
│  │  🔴 14:31:58  error.twilio       Twilio API timeout on transfer         │   │
│  │              Call ID: call-ghi789  Error: ETIMEDOUT                      │   │
│  │              [View Stack Trace] [View Call Details]                      │   │
│  │                                                                          │   │
│  │  🟢 14:31:45  call.qualified     Caller qualified - Homeowner: Yes      │   │
│  │              Call ID: call-jkl012  IVR Response: 1                       │   │
│  │                                                                          │   │
│  │  🟢 14:31:42  call.received      New call from (555) ***-4567           │   │
│  │              Tracking #: (800) 555-1234  Campaign: Windows Repair        │   │
│  │                                                                          │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  [Export CSV] [Export JSON] [⏸️ Pause Stream] [🔄 Auto-refresh: ON]            │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Admin Log Features

- **Real-time streaming** via WebSocket
- **Full-text search** across all log fields
- **Filter by**: Level, Event type, Affiliate, Buyer, Date range, Call ID
- **Click-through**: Click any log to see full call details
- **Export**: CSV/JSON for support tickets or debugging
- **Retention**: Stored permanently (never auto-deleted)

---

## Affiliate Activity Dashboard

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  MY CALLS: Activity Log                                                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  Campaign: [All ▼]    Date: [Today ▼]    Status: [All ▼]                        │
│                                                                                  │
│  ┌─ RECENT ACTIVITY ───────────────────────────────────────────────────────┐   │
│  │                                                                          │   │
│  │  📞 2:32 PM   Call Completed                                             │   │
│  │              Caller: (555) ***-4567                                      │   │
│  │              Duration: 4:05  •  Status: ✅ Qualified                     │   │
│  │              Payout: $35.00                                              │   │
│  │              [View Details] [Listen to Recording]                        │   │
│  │                                                                          │   │
│  │  📞 2:28 PM   Call Completed                                             │   │
│  │              Caller: (555) ***-8901                                      │   │
│  │              Duration: 0:45  •  Status: ❌ Not Qualified                 │   │
│  │              Reason: Renter (not homeowner)                              │   │
│  │              [View Details]                                              │   │
│  │                                                                          │   │
│  │  📞 2:15 PM   Call Completed                                             │   │
│  │              Caller: (555) ***-2345                                      │   │
│  │              Duration: 3:22  •  Status: ✅ Qualified                     │   │
│  │              Payout: $35.00                                              │   │
│  │              [View Details] [Listen to Recording]                        │   │
│  │                                                                          │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  Showing 25 of 156 calls today                              [Load More ▼]       │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Affiliate Log Features

- **Clear call status**: Qualified/Not Qualified with reasons
- **Duration**: Always visible
- **Payout**: Shown for qualified calls
- **Recording access**: One-click to listen
- **Filter by campaign**: See calls per campaign
- **Phone masking**: Privacy protection ((555) ***-4567)

---

## Call Detail View (Full Timeline)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  CALL DETAILS: call-abc123                                              [X]     │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  SUMMARY                                                                         │
│  ─────────────────────────────────────────────────────────────────────────────  │
│  Caller: (555) 123-4567              Campaign: Windows Repair                   │
│  Tracking #: (800) 555-1234          Affiliate: John's Marketing                │
│  Date: Jan 15, 2025 2:28 PM          Duration: 4:05                             │
│  Status: ✅ Qualified                 Payout: $35.00                            │
│                                                                                  │
│  CALL TIMELINE                                                                   │
│  ─────────────────────────────────────────────────────────────────────────────  │
│                                                                                  │
│  ⏱️ 0:00    📞 Call Received                                                    │
│             Caller dialed (800) 555-1234                                        │
│                                                                                  │
│  ⏱️ 0:02    🔊 Recording Disclosure Played                                      │
│             "This call may be recorded..."                                      │
│                                                                                  │
│  ⏱️ 0:05    🎤 IVR Started                                                      │
│             "Press 1 if you own your home..."                                   │
│                                                                                  │
│  ⏱️ 0:12    ✅ IVR Response: 1 (Homeowner)                                      │
│             Caller qualified                                                    │
│                                                                                  │
│  ⏱️ 0:12    🎯 Auction Started                                                  │
│             3 buyers pinged                                                     │
│                                                                                  │
│  ⏱️ 0:14    💰 Bid Received: $52.00 (Modernize) - 1,823ms          [Admin Only] │
│  ⏱️ 0:14    💰 Bid Received: $48.00 (HomeAdvisor) - 2,105ms        [Admin Only] │
│  ⏱️ 0:15    💰 Bid Received: $55.00 (ABC Plumbing) - 2,890ms       [Admin Only] │
│                                                                                  │
│  ⏱️ 0:15    🏆 Winner Selected: Modernize at $58.00                [Admin Only] │
│             (Tie-break: fastest response)                                       │
│                                                                                  │
│  ⏱️ 0:16    📱 Transfer Started                                                 │
│             Connecting to (555) 987-6543                                        │
│                                                                                  │
│  ⏱️ 0:22    ✅ Transfer Connected                                               │
│             Buyer answered                                                      │
│                                                                                  │
│  ⏱️ 4:27    📴 Call Ended                                                       │
│             Total duration: 4:05                                                │
│                                                                                  │
│  ⏱️ 4:30    🎙️ Recording Available                                             │
│             Duration: 4:05  •  [▶️ Play Recording]                              │
│                                                                                  │
│  FINANCIAL                                                    [Admin Only]      │
│  ─────────────────────────────────────────────────────────────────────────────  │
│  Winning Bid: $58.00                                                            │
│  Affiliate Payout: $35.00 (60%)                                                 │
│  Platform Revenue: $23.00 (40%)                                                 │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Logging Service Implementation

```typescript
// src/lib/services/call-logging-service.ts

/**
 * WHY: Centralized logging for calls - both to file/cloud AND database
 * WHEN: Every significant call event
 * HOW: Logs to structured logger (CloudWatch/DataDog) + call_activity_logs table
 */
export class CallLoggingService {
  /**
   * Log a call event to both system logs and database
   */
  async logCallEvent(params: {
    callId: string;
    event: string;
    message: string;
    level?: 'debug' | 'info' | 'warn' | 'error';
    details?: Record<string, unknown>;
    visibleToAffiliate?: boolean;
  }): Promise<void> {
    const { callId, event, message, level = 'info', details = {}, visibleToAffiliate = false } = params;

    // Get call context for enrichment
    const call = await prisma.call.findUnique({
      where: { id: callId },
      include: {
        trackingNumber: {
          include: { campaign: { include: { affiliate: true } } }
        }
      }
    });

    // 1. System log (CloudWatch, DataDog, etc.)
    logger[level]({
      event,
      message,
      callId,
      affiliateId: call?.trackingNumber?.campaign?.affiliateId,
      campaignId: call?.trackingNumber?.campaignId,
      twilioCallSid: call?.twilioCallSid,
      ...details
    });

    // 2. Database log (for user-facing activity feeds)
    await prisma.callActivityLog.create({
      data: {
        callId,
        event,
        message: this.formatUserMessage(event, message, details),
        details: details as Prisma.JsonValue,
        visibleToAffiliate,
        visibleToAdmin: true
      }
    });
  }

  /**
   * Format message for user display (remove technical jargon)
   */
  private formatUserMessage(event: string, message: string, details: Record<string, unknown>): string {
    // Replace placeholders with actual values
    let formatted = message;
    for (const [key, value] of Object.entries(details)) {
      formatted = formatted.replace(`{${key}}`, String(value));
    }
    return formatted;
  }

  /**
   * Get activity log for affiliate dashboard
   */
  async getAffiliateActivityLog(
    affiliateId: string,
    options: { limit?: number; offset?: number; campaignId?: string }
  ): Promise<CallActivityLog[]> {
    return prisma.callActivityLog.findMany({
      where: {
        visibleToAffiliate: true,
        call: {
          trackingNumber: {
            campaign: { affiliateId }
          }
        },
        ...(options.campaignId && {
          call: { trackingNumber: { campaignId: options.campaignId } }
        })
      },
      orderBy: { timestamp: 'desc' },
      take: options.limit ?? 50,
      skip: options.offset ?? 0,
      include: {
        call: {
          select: {
            id: true,
            callerPhone: true,
            totalDurationSeconds: true,  // Maps to calls.total_duration_seconds
            status: true,
            affiliatePayout: true,
            recordingUrl: true
          }
        }
      }
    });
  }

  /**
   * Get full admin log stream
   */
  async getAdminLogStream(options: {
    limit?: number;
    level?: string;
    event?: string;
    affiliateId?: string;
    buyerId?: string;
    startDate?: Date;
    endDate?: Date;
    search?: string;
  }): Promise<CallActivityLog[]> {
    return prisma.callActivityLog.findMany({
      where: {
        visibleToAdmin: true,
        ...(options.level && { level: options.level }),
        ...(options.event && { event: { contains: options.event } }),
        ...(options.search && {
          OR: [
            { message: { contains: options.search, mode: 'insensitive' } },
            { call: { id: { contains: options.search } } },
            { call: { callerPhone: { contains: options.search } } }
          ]
        }),
        ...(options.startDate && { timestamp: { gte: options.startDate } }),
        ...(options.endDate && { timestamp: { lte: options.endDate } })
      },
      orderBy: { timestamp: 'desc' },
      take: options.limit ?? 100,
      include: {
        call: {
          include: {
            trackingNumber: {
              include: {
                campaign: { include: { affiliate: true } }
              }
            }
          }
        }
      }
    });
  }
}

export const callLoggingService = new CallLoggingService();
```

---

## Usage Throughout Codebase

```typescript
// In call flow handlers
export async function handleIncomingCall(callId: string) {
  await callLoggingService.logCallEvent({
    callId,
    event: 'call.received',
    message: 'Call received from {callerPhone}',
    details: { callerPhone: maskPhone(callerPhone) },
    visibleToAffiliate: true
  });
}

// In auction engine
export async function selectWinner(callId: string, winner: Bid) {
  await callLoggingService.logCallEvent({
    callId,
    event: 'auction.winner_selected',
    message: 'Winner: {buyerName} at ${bidAmount}',
    details: {
      buyerName: winner.buyerName,
      bidAmount: winner.amount,
      responseTimeMs: winner.responseTimeMs
    },
    visibleToAffiliate: false // Admin only - don't show bid details to affiliates
  });
}

// On errors
export async function handleTransferError(callId: string, error: Error) {
  await callLoggingService.logCallEvent({
    callId,
    event: 'error.transfer_failed',
    message: 'Transfer failed: {errorMessage}',
    level: 'error',
    details: {
      errorMessage: error.message,
      errorCode: error.code,
      stack: error.stack
    },
    visibleToAffiliate: false // Don't show technical errors to affiliates
  });
}
```

---

## Implementation Tasks

| Task ID | Description | Status | Priority |
|---------|-------------|--------|----------|
| P1-LOG-1 | Create `call_activity_logs` table | ⬜ | CRITICAL |
| P1-LOG-2 | Create CallLoggingService | ⬜ | CRITICAL |
| P1-LOG-3 | Add logging to incoming call handler | ⬜ | CRITICAL |
| P1-LOG-4 | Add logging to IVR handler | ⬜ | HIGH |
| P1-LOG-5 | Add logging to auction engine | ⬜ | HIGH |
| P1-LOG-6 | Add logging to transfer handler | ⬜ | HIGH |
| P1-LOG-7 | Add logging to recording handler | ⬜ | HIGH |
| P1-LOG-8 | Create Admin Log Dashboard page | ⬜ | HIGH |
| P1-LOG-9 | Create Affiliate Activity Feed component | ⬜ | HIGH |
| P1-LOG-10 | Create Call Detail Timeline component | ⬜ | HIGH |
| P1-LOG-11 | Add WebSocket for real-time log streaming | ⬜ | MEDIUM |
| P1-LOG-12 | Add log search/filter functionality | ⬜ | MEDIUM |
| P1-LOG-13 | Add CSV/JSON export for logs | ⬜ | MEDIUM |
| P1-LOG-14 | Implement phone number masking utility | ⬜ | HIGH |
| P1-LOG-15 | Add log partitioning for query performance (permanent storage) | ⬜ | MEDIUM |

### Testing Tasks

| Task ID | Description | Status |
|---------|-------------|--------|
| P1-LOG-T1 | Test log visibility (affiliate vs admin) | ⬜ |
| P1-LOG-T2 | Test phone number masking | ⬜ |
| P1-LOG-T3 | Test log search across all fields | ⬜ |
| P1-LOG-T4 | Test real-time log streaming | ⬜ |
| P1-LOG-T5 | Test log export (CSV/JSON) | ⬜ |

---

## User Stories

### US-LOG-1: Super Admin Debugging Production Issue
**WHY**: When something goes wrong, admin needs to find root cause fast
**WHEN**: Support ticket received, error alert triggered
**HOW**:
- Search logs by call ID, phone number, or error message
- See full timeline of what happened
- Click through to related calls, buyer responses
- Export for sharing with developers

### US-LOG-2: Affiliate Checking Call Status
**WHY**: Affiliates want transparency into their call performance
**WHEN**: Affiliate views dashboard or specific call
**HOW**:
- See clear status for each call (qualified/not, reason)
- See duration and payout
- Access recording with one click
- Filter by campaign or date

### US-LOG-3: Affiliate Disputing Unqualified Call
**WHY**: Affiliate believes call should have qualified
**WHEN**: Affiliate reviews call that was marked as not qualified
**HOW**:
- See exact IVR response that caused rejection
- Listen to recording to verify
- See timestamp of each event
- Submit dispute with evidence

---

## Sentry Integration

> **Error Tracking**: Sentry is our primary error tracking platform, complementing structured logs

### Sentry vs Structured Logs

| Aspect | Sentry | Structured Logs (CloudWatch/DataDog) |
|--------|--------|-------------------------------------|
| **Purpose** | Error tracking, alerting, debugging | Audit trail, compliance, activity feeds |
| **What to Send** | Exceptions, errors, warnings | All events (including success) |
| **Retention** | 90 days (Sentry plan) | Permanent (our database) |
| **Searchable** | Stack traces, error context | Full-text, all fields |
| **Real-time** | Yes, with alerting | Yes, WebSocket streaming |

### When to Use Sentry

```typescript
/**
 * SENTRY IS FOR:
 * - Unexpected errors (exceptions, crashes)
 * - Performance monitoring (slow transactions)
 * - User-impacting issues
 * - Cross-service tracing
 *
 * STRUCTURED LOGS ARE FOR:
 * - All events (success and failure)
 * - Audit trails (compliance)
 * - User-facing activity feeds
 * - Debugging call flow
 */

// SENTRY: Capture unexpected errors
try {
  await processCall(callId);
} catch (error) {
  Sentry.captureException(error, {
    tags: { component: 'call-flow' },
    extra: { callId, stage: 'processing' }
  });
  throw error;
}

// STRUCTURED LOGS: Log all events for timeline
await callLoggingService.logCallEvent({
  callId,
  event: 'call.completed',
  message: 'Call completed successfully',
  visibleToAffiliate: true
});
```

### Global Sentry Configuration

```typescript
// src/lib/sentry-config.ts
import * as Sentry from '@sentry/nextjs';

/**
 * WHY: Centralized Sentry setup with Pay-Per-Call context
 * WHEN: App initialization
 * HOW: Configure once, use everywhere
 */
export function initSentry() {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,

    // Performance monitoring
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Error filtering
    beforeSend(event, hint) {
      // Don't send expected business errors
      const error = hint.originalException;
      if (error instanceof BusinessError && error.expected) {
        return null;
      }
      return event;
    },

    // Add global context
    initialScope: {
      tags: {
        app: 'pay-per-call',
        version: process.env.APP_VERSION
      }
    }
  });
}

// Set user context (call from auth middleware)
export function setSentryUser(userId: string, role: string) {
  Sentry.setUser({ id: userId, role });
}

// Set call context (call at start of call handling)
export function setSentryCallContext(callId: string, affiliateId?: string, campaignId?: string) {
  Sentry.setContext('call', { callId, affiliateId, campaignId });
  Sentry.setTag('callId', callId);
}
```

### Sentry Events by Component

| Component | Event Type | When to Capture |
|-----------|------------|-----------------|
| **Twilio Integration** | Exception | Signature verification failure, API errors |
| **Call Flow** | Exception + Breadcrumbs | State transition errors, webhook failures |
| **Phone Provisioning** | Exception + Transaction | Provisioning failures, saga rollbacks |
| **Auction Engine** | Exception + Performance | No bids, timeout, concurrent selection |
| **IVR System** | Warning + Breadcrumbs | Max attempts reached, invalid input |
| **Call Recording** | Exception | Download/upload failures, access denied |
| **Logging Service** | Exception | Log write failures (rare) |

### Breadcrumb Strategy

```typescript
/**
 * WHY: Breadcrumbs provide context for debugging errors
 * WHEN: Every significant action in call lifecycle
 * HOW: Add breadcrumb before action, Sentry auto-captures on error
 */

// Category naming convention: {component}.{action}
const BREADCRUMB_CATEGORIES = {
  call: ['received', 'ivr_started', 'qualified', 'rejected', 'transferred', 'completed'],
  auction: ['started', 'bid_received', 'winner_selected', 'cascade'],
  recording: ['webhook', 'download', 'upload', 'access'],
  phone: ['provision', 'release', 'configure'],
  twilio: ['webhook', 'api_call', 'twiml_response']
};

// Example usage
Sentry.addBreadcrumb({
  category: 'call.received',
  message: 'Incoming call received',
  level: 'info',
  data: {
    callSid: twilioCallSid,
    from: callerPhone,
    to: trackingNumber
  }
});
```

### Performance Monitoring

```typescript
/**
 * WHY: Track transaction performance across call lifecycle
 * WHEN: Long-running operations (auction, transfer, recording)
 * HOW: Create transaction with child spans
 */
async function handleCallWithPerformanceTracking(request: Request) {
  const transaction = Sentry.startTransaction({
    name: 'call.handle',
    op: 'call',
    description: 'Handle incoming call from Twilio'
  });

  Sentry.getCurrentHub().configureScope(scope => {
    scope.setSpan(transaction);
  });

  try {
    // IVR span
    const ivrSpan = transaction.startChild({ op: 'ivr', description: 'IVR qualification' });
    const qualified = await runIVR(callId);
    ivrSpan.setData('qualified', qualified);
    ivrSpan.finish();

    if (!qualified) {
      transaction.setStatus('ok');
      return;
    }

    // Auction span
    const auctionSpan = transaction.startChild({ op: 'auction', description: 'Real-time auction' });
    const winner = await runAuction(callId);
    auctionSpan.setData('winner', winner?.buyerId);
    auctionSpan.setData('bid', winner?.amount);
    auctionSpan.finish();

    // Transfer span
    const transferSpan = transaction.startChild({ op: 'transfer', description: 'Call transfer' });
    await transferCall(callId, winner.phoneNumber);
    transferSpan.finish();

    transaction.setStatus('ok');
  } catch (error) {
    transaction.setStatus('internal_error');
    Sentry.captureException(error);
  } finally {
    transaction.finish();
  }
}
```

### Alert Configuration (Sentry)

| Alert Name | Condition | Severity | Action |
|------------|-----------|----------|--------|
| High Error Rate | > 50 errors in 5 minutes | P1 (Critical) | PagerDuty |
| Twilio API Failures | Any Twilio API error | P2 (High) | Slack #alerts |
| Auction Failures | > 10 no-bid auctions in 1 hour | P3 (Medium) | Slack #pay-per-call |
| Recording Failures | > 5 download/upload failures | P2 (High) | Slack #alerts |
| Phone Provisioning Failed | Any provisioning failure | P2 (High) | Slack #alerts |
| Slow Transactions | p95 latency > 5s | P3 (Medium) | Dashboard only |

### Integration with CallLoggingService

```typescript
// src/lib/services/call-logging-service.ts
import * as Sentry from '@sentry/nextjs';

export class CallLoggingService {
  async logCallEvent(params: {
    callId: string;
    event: string;
    message: string;
    level?: 'debug' | 'info' | 'warn' | 'error';
    details?: Record<string, unknown>;
    visibleToAffiliate?: boolean;
  }): Promise<void> {
    const { callId, event, message, level = 'info', details = {} } = params;

    // 1. Always add Sentry breadcrumb
    Sentry.addBreadcrumb({
      category: event,
      message,
      level: level === 'error' ? 'error' : level === 'warn' ? 'warning' : 'info',
      data: { callId, ...details }
    });

    // 2. Capture errors/warnings to Sentry
    if (level === 'error') {
      Sentry.captureMessage(message, {
        level: 'error',
        tags: { event, callId },
        extra: details
      });
    } else if (level === 'warn') {
      Sentry.captureMessage(message, {
        level: 'warning',
        tags: { event, callId },
        extra: details
      });
    }

    // 3. Always log to structured logs (CloudWatch) and database
    logger[level]({ event, message, callId, ...details });

    await prisma.callActivityLog.create({
      data: {
        callId,
        event,
        message: this.formatUserMessage(event, message, details),
        details: details as Prisma.JsonValue,
        visibleToAffiliate: params.visibleToAffiliate ?? false,
        visibleToAdmin: true
      }
    });
  }
}
```

### Sentry Implementation Tasks

| Task ID | Description | Status | Priority |
|---------|-------------|--------|----------|
| P1-SENTRY-1 | Initialize Sentry in Next.js app | ⬜ | CRITICAL |
| P1-SENTRY-2 | Configure Sentry DSN and environment | ⬜ | CRITICAL |
| P1-SENTRY-3 | Add breadcrumbs to call flow handlers | ⬜ | HIGH |
| P1-SENTRY-4 | Add breadcrumbs to auction engine | ⬜ | HIGH |
| P1-SENTRY-5 | Add breadcrumbs to recording handlers | ⬜ | HIGH |
| P1-SENTRY-6 | Configure performance monitoring | ⬜ | MEDIUM |
| P1-SENTRY-7 | Set up Slack/PagerDuty alert integrations | ⬜ | HIGH |
| P1-SENTRY-8 | Create custom error classes for filtering | ⬜ | MEDIUM |
| P1-SENTRY-9 | Add transaction tracking for call lifecycle | ⬜ | MEDIUM |
| P1-SENTRY-10 | Integrate Sentry with CallLoggingService | ⬜ | HIGH |

---

*Section Version: 1.1 - Cross-Section Audit: Fixed Prisma field name to totalDurationSeconds (matches calls.total_duration_seconds)*
