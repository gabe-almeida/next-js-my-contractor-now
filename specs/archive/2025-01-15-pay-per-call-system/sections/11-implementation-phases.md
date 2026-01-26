# Implementation Phases

> **Section:** 11 | **Overview**
> **Parent:** [spec.md](../spec.md)

---

## Overview

Four-phase rollout plan with infrastructure setup, clear scope, and effort estimates.
Revised timeline based on comprehensive audit: ~16-21 weeks total.

---

## Phase 0: Infrastructure & Testing Setup (1-2 weeks)

> **CRITICAL**: Complete Phase 0 BEFORE any feature development.
> This phase prevents cascading issues and enables safe rollback.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  PHASE 0: INFRASTRUCTURE FOUNDATION                                              │
└─────────────────────────────────────────────────────────────────────────────────┘

SCOPE:
──────
✓ Twilio account setup and credentials
✓ Feature flags infrastructure
✓ Monitoring and alerting setup
✓ Logging infrastructure (structured logs)
✓ Test environment setup
✓ Rollback procedures documented
✓ Database migration strategy
✓ CI/CD pipeline for pay-per-call module

DELIVERABLES:
─────────────
• Twilio account with test credentials
• Feature flag system (LaunchDarkly or custom)
• Sentry/DataDog integration
• Staging environment mirroring production
• Database backup/restore procedures tested
• Runbook for common issues

ESTIMATED EFFORT:
─────────────────
• Twilio account setup: 0.5 days
• Feature flags: 1 day
• Monitoring setup: 1 day
• Logging infrastructure: 0.5 days
• Test environment: 1 day
• Documentation: 1 day
────────────────────────
TOTAL: ~5 days (1 week)
```

### Feature Flags

```typescript
/**
 * WHY: Enable gradual rollout and instant rollback without deployment
 * WHEN: All new pay-per-call features
 * HOW: Check flag before feature code, default to OFF
 */
const PAY_PER_CALL_FLAGS = {
  // Phase 1
  'ppc.enabled': false,                    // Master kill switch
  'ppc.twilio_integration': false,         // Twilio webhook processing
  'ppc.auction_for_calls': false,          // Auction engine for calls
  'ppc.recording_enabled': false,          // Call recording

  // Phase 2
  'ppc.network_ping_post': false,          // PING/POST for network buyers
  'ppc.cascade_delivery': false,           // Try next buyer on rejection

  // Phase 3
  'ppc.forwarding_numbers': false,         // Option B numbers
  'ppc.advanced_ivr': false,               // Multi-step IVR builder
};

async function isFeatureEnabled(flagName: string): Promise<boolean> {
  // Default to false if flag doesn't exist (safe)
  return await featureFlags.get(flagName, false);
}

// Usage in code
export async function handleIncomingCall(request: Request) {
  if (!await isFeatureEnabled('ppc.enabled')) {
    return new Response('Feature not enabled', { status: 503 });
  }

  // ... rest of handler
}
```

### Monitoring & Alerting

```typescript
/**
 * Key Metrics to Monitor
 */
const CALL_METRICS = {
  // Volume metrics
  'ppc.calls.received': 'counter',        // Total calls received
  'ppc.calls.qualified': 'counter',       // Calls passing IVR
  'ppc.calls.transferred': 'counter',     // Successful transfers

  // Latency metrics
  'ppc.auction.duration_ms': 'histogram', // Time to complete auction
  'ppc.transfer.duration_ms': 'histogram',// Time to connect

  // Error metrics
  'ppc.errors.webhook': 'counter',        // Webhook processing errors
  'ppc.errors.twilio': 'counter',         // Twilio API errors
  'ppc.errors.auction': 'counter',        // Auction failures
};

// Alert thresholds
const ALERTS = [
  { metric: 'ppc.errors.webhook', threshold: 10, window: '5m', severity: 'critical' },
  { metric: 'ppc.auction.duration_ms', threshold: 5000, window: '1m', severity: 'warning' },
  { metric: 'ppc.calls.transferred', condition: 'rate < 0.8', window: '10m', severity: 'critical' },
];
```

### Rollback Procedures

```markdown
## Emergency Rollback Checklist

### Scenario 1: Feature Bug (Non-Critical)
1. Disable feature flag: `ppc.<feature_name> = false`
2. Monitor error rate for 5 minutes
3. If stable, investigate and fix
4. Re-enable with monitoring

### Scenario 2: Complete System Failure
1. Disable master flag: `ppc.enabled = false`
2. All incoming calls → fallback behavior (TBD: reject or forward to default?)
3. Notify affected affiliates
4. Root cause analysis
5. Fix, test in staging, gradual re-enable

### Scenario 3: Database Migration Issue
1. Stop deployments
2. Restore from latest backup (tested in Phase 0)
3. Apply fix
4. Re-run migration

### Scenario 4: Twilio Outage
1. Nothing we can do - dependent on Twilio
2. Monitor Twilio status page
3. Queue any pending actions for retry
4. Communicate to affiliates
```

---

## Phase 1: MVP (6-8 weeks)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  PHASE 1: MINIMUM VIABLE PRODUCT                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

SCOPE:
──────
✓ Twilio integration (provision numbers, answer calls, transfer)
✓ Basic affiliate portal (login, view campaigns, get numbers)
✓ Platform-provisioned numbers only (Option A)
✓ Simple IVR (single question: homeowner Y/N)
✓ Unified auction engine (reuse lead auction logic)
✓ Contractor call routing (direct transfer)
✓ Call recording
✓ Basic affiliate dashboard (calls, earnings)
✓ Admin: buyer call settings

NOT IN SCOPE (Phase 2+):
────────────────────────
✗ Forwarding numbers (Option B)
✗ Advanced IVR builder
✗ Network PING/POST for calls
✗ SIP routing
✗ Detailed analytics
✗ Affiliate API

ESTIMATED EFFORT (Revised after audit):
────────────────────────────────────────
• Database schema: 3 days (added race condition tables)
• Twilio integration: 5 days (added idempotency, retry logic)
• Call flow (incoming → auction → transfer): 7 days (state machine, edge cases)
• IVR with recording disclosure: 4 days (legal compliance)
• Affiliate portal (basic): 6 days (empty states, error handling)
• Buyer call settings: 3 days (validation, snapshotting)
• Recording + playback: 4 days (retry logic, error states)
• Testing + QA: 5 days (race conditions, edge cases)
• Buffer: 3 days
────────────────────────
TOTAL: ~40 days (6-8 weeks)

TESTING REQUIREMENTS:
────────────────────
✓ Unit tests for all race condition handlers
✓ Integration tests for Twilio webhooks
✓ E2E test for complete call flow
✓ Load testing for concurrent calls
✓ IVR recording disclosure compliance test
```

### Phase 1 Dependencies
| Depends On | For |
|------------|-----|
| Phase 0: Feature flags | Safe rollout |
| Phase 0: Monitoring | Error detection |
| Twilio account | All call features |
| Prisma migrations | Database tables |

## Phase 2: Network Integration (4-5 weeks)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  PHASE 2: NETWORK PING/POST                                                      │
└─────────────────────────────────────────────────────────────────────────────────┘

SCOPE:
──────
✓ PING/POST for call buyers (Ringba RTB)
✓ Call-specific field mappings
✓ Cascade delivery (try next buyer if winner rejects)
✓ Hold music during auction
✓ Admin: network buyer call configuration
✓ Tie-breaking logic for equal bids
✓ Cascade depth/time limits
✓ Late winner response handling

ESTIMATED EFFORT (Revised after audit):
────────────────────────────────────────
• Call PING integration: 4 days (with retry, circuit breaker)
• Field mappings for calls: 3 days (validation, transforms)
• Cascade logic: 4 days (depth limits, concurrent prevention)
• Tie-breaking and winner selection: 2 days
• Caller hangup during auction: 2 days
• Admin UI updates: 3 days
• Testing with Modernize/HomeAdvisor: 4 days
• Buffer: 2 days
────────────────────────
TOTAL: ~24 days (4-5 weeks)

TESTING REQUIREMENTS:
────────────────────
✓ Test tie-breaking with equal bids
✓ Test cascade depth limit (max 3)
✓ Test cascade time limit (max 8 seconds)
✓ Test caller hangup during auction
✓ Test late winner response handling
✓ Test concurrent cascade prevention
✓ Integration test with real network buyer sandbox
```

### Phase 2 Dependencies
| Depends On | For |
|------------|-----|
| Phase 1: Basic auction | Foundation for network bids |
| Phase 1: Call flow | State machine transitions |
| Network buyer sandbox access | Testing |

## Phase 3: Advanced Features (5-6 weeks)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  PHASE 3: ADVANCED FEATURES                                                      │
└─────────────────────────────────────────────────────────────────────────────────┘

SCOPE:
──────
✓ Forwarding numbers (Option B)
✓ Advanced IVR builder (multi-step, voice input)
✓ SIP routing option
✓ Detailed analytics dashboard
✓ Affiliate API for programmatic access
✓ Postback/webhook system
✓ Payment/payout management
✓ Pre-aggregated analytics (performance)
✓ GDPR deletion workflow
✓ Real-time WebSocket updates

ESTIMATED EFFORT (Revised after audit):
────────────────────────────────────────
• Forwarding support: 5 days (active call check, saga pattern)
• IVR builder: 6 days (navigation, invalid input handling)
• Analytics: 6 days (pre-aggregation, caching, empty states)
• Affiliate API: 4 days
• Postbacks: 3 days (with retry logic)
• Payments: 4 days
• GDPR deletion: 2 days
• Testing + QA: 4 days
────────────────────────
TOTAL: ~34 days (5-6 weeks)

TESTING REQUIREMENTS:
────────────────────
✓ Test forwarding number provisioning saga
✓ Test active call check before release
✓ Test analytics pre-aggregation accuracy
✓ Test large date range export
✓ Test GDPR deletion workflow
✓ Performance test analytics with 100k+ calls
```

### Phase 3 Dependencies
| Depends On | For |
|------------|-----|
| Phase 1: Basic portal | Analytics foundation |
| Phase 1: Recording | Playback in analytics |
| Phase 2: Network integration | Complete buyer data |

## Key Files Reference

| Purpose | File Path | Est. Lines |
|---------|-----------|------------|
| **Twilio** | | |
| Twilio SDK wrapper | `src/lib/twilio/client.ts` | ~100 |
| TwiML builder | `src/lib/twilio/twiml-builder.ts` | ~150 |
| **Call Flow** | | |
| Incoming call webhook | `src/app/api/calls/incoming/route.ts` | ~200 |
| IVR handler | `src/app/api/calls/ivr/route.ts` | ~100 |
| Cascade handler | `src/app/api/calls/cascade/route.ts` | ~150 |
| Call completed webhook | `src/app/api/calls/completed/route.ts` | ~150 |
| Recording webhook | `src/app/api/calls/recording/route.ts` | ~80 |
| **Auction** | | |
| Base auction engine | `src/lib/auction/base-engine.ts` | ~200 |
| Call auction engine | `src/lib/auction/call-engine.ts` | ~300 |
| **Services** | | |
| Affiliate service | `src/lib/services/affiliate-service.ts` | ~200 |
| Campaign service | `src/lib/services/campaign-service.ts` | ~150 |
| Tracking number service | `src/lib/services/tracking-number-service.ts` | ~150 |
| Call service | `src/lib/services/call-service.ts` | ~250 |
| **Affiliate Portal** | | |
| Dashboard page | `src/app/(affiliate)/affiliate/page.tsx` | ~150 |
| Campaigns page | `src/app/(affiliate)/affiliate/campaigns/page.tsx` | ~200 |
| Calls page | `src/app/(affiliate)/affiliate/calls/page.tsx` | ~200 |
| Call detail modal | `src/components/affiliate/CallDetailModal.tsx` | ~150 |
| Recording player | `src/components/affiliate/RecordingPlayer.tsx` | ~100 |
| **Admin** | | |
| Buyer call settings | `src/components/admin/buyers/CallSettingsTab.tsx` | ~250 |
| Affiliate management | `src/app/(admin)/admin/affiliates/page.tsx` | ~200 |
| Campaign management | `src/app/(admin)/admin/campaigns/page.tsx` | ~200 |
| **Database** | | |
| Prisma schema additions | `prisma/schema.prisma` (additions) | ~200 |
| | | |
| **TOTAL NEW CODE** | | **~3,500** |

## Total Timeline (Revised)

| Phase | Duration | Cumulative |
|-------|----------|------------|
| Phase 0: Infrastructure | 1-2 weeks | 1-2 weeks |
| Phase 1: MVP | 6-8 weeks | 7-10 weeks |
| Phase 2: Networks | 4-5 weeks | 11-15 weeks |
| Phase 3: Advanced | 5-6 weeks | 16-21 weeks |

> **Note**: Timeline increased from 10-12 weeks to 16-21 weeks based on
> comprehensive audit identifying ~120 additional tasks for race conditions,
> UX edge cases, and production hardening.

---

## Risk Mitigation

### High-Risk Areas

| Risk | Impact | Mitigation |
|------|--------|------------|
| Twilio outage | All calls fail | Monitoring + status page integration, communicate to affiliates |
| Race condition in auction | Double-billing or no winner | Idempotency keys + transaction isolation |
| Recording fails | Compliance violation | Retry with fallback to Twilio URL |
| Caller hangup during IVR | Partial data | Graceful handling + analytics tracking |
| Network buyer timeout | Caller waiting | Cascade timeout limits (8s max) |
| High concurrent calls | System overload | Rate limiting + horizontal scaling |

### Gradual Rollout Strategy

```
Week 1-2: Internal testing only (feature flag OFF)
Week 3:   1% of traffic (single affiliate beta)
Week 4:   10% of traffic (monitor metrics)
Week 5:   50% of traffic (if stable)
Week 6:   100% of traffic (full rollout)
```

### Go/No-Go Criteria for Each Phase

**Phase 0 → Phase 1:**
- [ ] Feature flags working in staging
- [ ] Monitoring dashboards live
- [ ] Runbook reviewed by team
- [ ] Twilio credentials verified

**Phase 1 → Phase 2:**
- [ ] >95% call success rate
- [ ] <5 second average auction time
- [ ] Recording success rate >99%
- [ ] Zero P0/P1 bugs in production

**Phase 2 → Phase 3:**
- [ ] Network integration tested with 2+ buyers
- [ ] Cascade logic working reliably
- [ ] No race conditions in production
- [ ] Affiliate feedback positive

---

## Implementation Tasks Summary

| Section | Original Tasks | Added Tasks | Total |
|---------|----------------|-------------|-------|
| Database Schema | 10 | 22 | 32 |
| Twilio Integration | 10 | 21 | 31 |
| Call Flow | 15 | 17 | 32 |
| Phone Provisioning | 12 | 17 | 29 |
| Auction Engine | 8 | 18 | 26 |
| Affiliate Portal | 16 | 21 | 37 |
| Buyer Admin Config | 7 | 22 | 29 |
| IVR System | 13 | 15 | 28 |
| Call Recording | 10 | 13 | 23 |
| Analytics | 10 | 22 | 32 |
| **TOTAL** | **111** | **188** | **299** |

---

*Section Version: 1.1 - Added Phase 0, revised timelines, risk mitigation, testing requirements*
