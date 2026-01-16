# Phone Number Provisioning

> **Section:** 04 | **Phase:** 1 (MVP) + Phase 3 (Forwarding)
> **Parent:** [spec.md](../spec.md)

---

## Overview

Affiliates can choose between two provisioning options **per service type**:
- **Option A:** Platform-provisioned Twilio numbers (recommended)
- **Option B:** Affiliate forwards from their own number system

## Option A: Platform-Provisioned Numbers (Recommended)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    OPTION A: WE PROVISION TWILIO NUMBERS                         │
└─────────────────────────────────────────────────────────────────────────────────┘

AFFILIATE EXPERIENCE:
─────────────────────

1. Affiliate logs into portal
2. Clicks "Request Campaign" for Windows Repair
3. System auto-provisions Twilio number
4. Affiliate sees: "(844) 555-1234" with [Copy] button
5. Affiliate uses number in their Facebook/Google ads
6. Calls come in, we track everything automatically

TECHNICAL FLOW:
───────────────

┌──────────────┐    ┌──────────────────┐    ┌──────────────────┐
│  Affiliate   │───▶│  POST /api/      │───▶│  Twilio API      │
│  Portal      │    │  tracking-numbers│    │  provision       │
│              │    │  /provision      │    │  number          │
└──────────────┘    └──────────────────┘    └────────┬─────────┘
                                                     │
                                                     ▼
                                            ┌──────────────────┐
                                            │  Configure       │
                                            │  webhook URL:    │
                                            │  /api/calls/     │
                                            │  incoming        │
                                            └────────┬─────────┘
                                                     │
                                                     ▼
                                            ┌──────────────────┐
                                            │  Save to DB:     │
                                            │  tracking_numbers│
                                            │  table           │
                                            └────────┬─────────┘
                                                     │
                                                     ▼
                                            ┌──────────────────┐
                                            │  Return number   │
                                            │  to affiliate    │
                                            │  portal          │
                                            └──────────────────┘

BENEFITS:
─────────
✓ We control the number = full tracking & attribution
✓ Instant provisioning (< 2 seconds)
✓ Affiliate just copies number, done
✓ We can reallocate if affiliate churns
✓ Consistent caller experience

DATABASE RECORD:
────────────────
tracking_numbers:
  id: "tn-123"
  phone_number: "+18445551234"
  twilio_sid: "PN..."
  affiliate_id: "aff-456"
  campaign_id: "camp-789"
  service_type_id: "windows-uuid"
  provisioning_type: "PLATFORM"        ← Key field
  ivr_flow_id: null (or IVR reference)
  active: true
```

## Option B: Affiliate Forwarding (Phase 3)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    OPTION B: AFFILIATE FORWARDS THEIR NUMBER                     │
└─────────────────────────────────────────────────────────────────────────────────┘

USE CASE:
─────────
Affiliate already uses Ringba/Retreaver/Invoca for their own tracking.
They want to forward calls to us as a secondary buyer in their call flow.

AFFILIATE EXPERIENCE:
─────────────────────

1. Affiliate logs into portal
2. Clicks "Request Campaign" for HVAC
3. Selects "I'll forward from my own number"
4. System shows:

   ┌─────────────────────────────────────────────────────────────────┐
   │  FORWARDING SETUP                                               │
   │                                                                  │
   │  Your Ingress Number:  (844) 999-0001                           │
   │                                                                  │
   │  Required SIP Headers or URL Parameters:                        │
   │  ────────────────────────────────────────                       │
   │  affiliate_id:  aff-456                                         │
   │  campaign_id:   camp-790                                        │
   │  service_type:  hvac                                            │
   │                                                                  │
   │  Example Ringba Target Configuration:                           │
   │  Phone: +18449990001                                            │
   │  SIP Headers:                                                   │
   │    X-Affiliate-ID: aff-456                                      │
   │    X-Campaign-ID: camp-790                                      │
   │                                                                  │
   │  OR via URL params (if using HTTP forwarding):                  │
   │  ?affiliate_id=aff-456&campaign_id=camp-790                     │
   │                                                                  │
   └─────────────────────────────────────────────────────────────────┘

5. Affiliate configures their Ringba to forward to our ingress number
6. We receive calls with metadata, process same as Option A

TECHNICAL FLOW:
───────────────

┌──────────────┐    ┌──────────────────┐    ┌──────────────────┐
│  Caller      │───▶│  Affiliate's     │───▶│  OUR Ingress     │
│  dials       │    │  Ringba/Own #    │    │  Number          │
│  ad number   │    │                  │    │  (844) 999-0001  │
└──────────────┘    └──────────────────┘    └────────┬─────────┘
                                                     │
                                                     │ Includes:
                                                     │ • Original caller ID
                                                     │ • SIP headers with
                                                     │   affiliate_id, campaign_id
                                                     ▼
                                            ┌──────────────────┐
                                            │  /api/calls/     │
                                            │  incoming        │
                                            │                  │
                                            │  Parse headers   │
                                            │  to identify     │
                                            │  affiliate       │
                                            └────────┬─────────┘
                                                     │
                                                     ▼
                                            ┌──────────────────┐
                                            │  Same auction    │
                                            │  flow as         │
                                            │  Option A        │
                                            └──────────────────┘

DATABASE RECORD:
────────────────
tracking_numbers:
  id: "tn-124"
  phone_number: "+18449990001"        ← Shared ingress number
  twilio_sid: "PN..."
  affiliate_id: "aff-456"
  campaign_id: "camp-790"
  service_type_id: "hvac-uuid"
  provisioning_type: "FORWARDING"     ← Key field
  forwarding_identifier: "aff-456:camp-790"  ← Used for lookup
  ivr_flow_id: null
  active: true

INGRESS NUMBER POOL:
────────────────────
We maintain a small pool of "ingress" numbers for forwarding:
  • (844) 999-0001 - General ingress
  • (844) 999-0002 - Backup

Affiliates share these numbers but are identified by SIP headers/params.
```

## Per-Service-Type Selection UI

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  AFFILIATE PORTAL: Campaign Configuration                                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  MY CAMPAIGNS                                                                    │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │  WINDOWS REPAIR                                          ● Active       │    │
│  │                                                                          │    │
│  │  Number Type:  ● Platform Provisioned  ○ Forwarding                     │    │
│  │                                                                          │    │
│  │  [Platform Provisioned Selected]                                         │    │
│  │  📞 Your Number: (844) 555-1234  [Copy]                                  │    │
│  │                                                                          │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │  HVAC EMERGENCY                                          ● Active       │    │
│  │                                                                          │    │
│  │  Number Type:  ○ Platform Provisioned  ● Forwarding                     │    │
│  │                                                                          │    │
│  │  [Forwarding Selected]                                                   │    │
│  │  📞 Forward to: (844) 999-0001                                          │    │
│  │  🏷️ Headers:    X-Affiliate-ID: aff-456                                 │    │
│  │                 X-Campaign-ID: camp-790                                  │    │
│  │                                                                          │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │  ROOFING                                                 ● Active       │    │
│  │                                                                          │    │
│  │  Number Type:  ● Platform Provisioned  ○ Forwarding                     │    │
│  │                                                                          │    │
│  │  [Platform Provisioned Selected]                                         │    │
│  │  📞 Your Number: (844) 555-1235  [Copy]                                  │    │
│  │                                                                          │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
│  [+ Request New Campaign]                                                        │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Race Condition Prevention

### Concurrent Number Provisioning (CRITICAL)

```typescript
// WHY: Two affiliates clicking "Request Campaign" simultaneously could both
//      try to provision the same number, or we could create duplicate records.
// WHEN: During number provisioning flow.
// HOW: Use database transaction with unique constraint check.

// src/lib/services/tracking-number-service.ts

export async function provisionTrackingNumber(
  affiliateId: string,
  campaignId: string,
  serviceTypeId: string
): Promise<TrackingNumber> {
  // Check if already provisioned (prevent duplicates)
  const existing = await prisma.trackingNumber.findFirst({
    where: {
      affiliateId,
      campaignId,
      serviceTypeId,
      active: true,
    }
  });

  if (existing) {
    return existing; // Idempotent - return existing number
  }

  // Use database transaction for atomicity
  return await prisma.$transaction(async (tx) => {
    // 1. Create DB record first (in PENDING state)
    const trackingNumber = await tx.trackingNumber.create({
      data: {
        affiliateId,
        campaignId,
        serviceTypeId,
        provisioningType: 'PLATFORM',
        provisioningStatus: 'PENDING',
      }
    });

    try {
      // 2. Provision with Twilio
      const twilioNumber = await twilioClient.incomingPhoneNumbers.create({
        areaCode: '844',
        voiceUrl: `${process.env.BASE_URL}/api/calls/incoming`,
        voiceMethod: 'POST',
      });

      // 3. Update DB record with Twilio details
      return await tx.trackingNumber.update({
        where: { id: trackingNumber.id },
        data: {
          phoneNumber: twilioNumber.phoneNumber,
          phoneNumberDisplay: formatPhoneDisplay(twilioNumber.phoneNumber),
          twilioSid: twilioNumber.sid,
          provisioningStatus: 'ACTIVE',
          active: true,
        }
      });
    } catch (error) {
      // 4. Mark as failed if Twilio fails
      await tx.trackingNumber.update({
        where: { id: trackingNumber.id },
        data: { provisioningStatus: 'FAILED' }
      });
      throw error;
    }
  });
}
```

### Orphaned Number Prevention (Saga Pattern)

```typescript
// WHY: If Twilio provisioning succeeds but DB update fails, we have an
//      orphaned number costing money with no tracking.
// WHEN: During provisioning if any step fails.
// HOW: Saga pattern with compensating transaction.

export async function provisionTrackingNumberSaga(
  affiliateId: string,
  campaignId: string,
  serviceTypeId: string
): Promise<TrackingNumber> {
  let twilioNumber: TwilioPhoneNumber | null = null;
  let dbRecord: TrackingNumber | null = null;

  try {
    // Step 1: Create DB record (PENDING)
    dbRecord = await prisma.trackingNumber.create({
      data: {
        affiliateId,
        campaignId,
        serviceTypeId,
        provisioningType: 'PLATFORM',
        provisioningStatus: 'PENDING',
      }
    });

    // Step 2: Provision Twilio number
    twilioNumber = await withRetry(async () => {
      return twilioClient.incomingPhoneNumbers.create({
        areaCode: '844',
        voiceUrl: `${process.env.BASE_URL}/api/calls/incoming`,
        voiceMethod: 'POST',
      });
    }, { maxRetries: 3 });

    // Step 3: Update DB with Twilio details
    const result = await prisma.trackingNumber.update({
      where: { id: dbRecord.id },
      data: {
        phoneNumber: twilioNumber.phoneNumber,
        twilioSid: twilioNumber.sid,
        provisioningStatus: 'ACTIVE',
        active: true,
      }
    });

    return result;

  } catch (error) {
    // COMPENSATING TRANSACTIONS

    // If Twilio number was provisioned, release it
    if (twilioNumber) {
      try {
        await twilioClient.incomingPhoneNumbers(twilioNumber.sid).remove();
        logger.info(`Compensated: Released orphaned number ${twilioNumber.sid}`);
      } catch (releaseError) {
        // Log for manual cleanup - this is serious
        logger.error('CRITICAL: Failed to release orphaned Twilio number', {
          sid: twilioNumber.sid,
          error: releaseError
        });
        // Could trigger alert to ops team
      }
    }

    // If DB record was created, mark as failed
    if (dbRecord) {
      await prisma.trackingNumber.update({
        where: { id: dbRecord.id },
        data: { provisioningStatus: 'FAILED' }
      });
    }

    throw error;
  }
}
```

### Active Call Check Before Release

```typescript
// WHY: If we release a number while a call is in progress, the caller
//      will be disconnected abruptly.
// WHEN: When affiliate deactivates a number or admin releases it.
// HOW: Check for active calls before allowing release.

export async function canReleaseNumber(trackingNumberId: string): Promise<{
  canRelease: boolean;
  reason?: string;
  activeCallCount?: number;
}> {
  const activeCalls = await prisma.call.count({
    where: {
      trackingNumberId,
      status: { in: ['RINGING', 'IVR', 'BIDDING', 'CONNECTING', 'CONNECTED'] }
    }
  });

  if (activeCalls > 0) {
    return {
      canRelease: false,
      reason: `Cannot release: ${activeCalls} active call(s) in progress`,
      activeCallCount: activeCalls,
    };
  }

  return { canRelease: true };
}

export async function releaseTrackingNumber(trackingNumberId: string): Promise<void> {
  // Check for active calls
  const { canRelease, reason } = await canReleaseNumber(trackingNumberId);
  if (!canRelease) {
    throw new Error(reason);
  }

  const trackingNumber = await prisma.trackingNumber.findUnique({
    where: { id: trackingNumberId }
  });

  if (!trackingNumber) {
    throw new NotFoundError('Tracking number not found');
  }

  // Update status to RELEASING (in-progress)
  await prisma.trackingNumber.update({
    where: { id: trackingNumberId },
    data: { provisioningStatus: 'RELEASING' }
  });

  try {
    // Release from Twilio
    if (trackingNumber.twilioSid) {
      await twilioClient.incomingPhoneNumbers(trackingNumber.twilioSid).remove();
    }

    // Mark as released
    await prisma.trackingNumber.update({
      where: { id: trackingNumberId },
      data: {
        provisioningStatus: 'RELEASED',
        active: false,
      }
    });
  } catch (error) {
    // Revert to ACTIVE if release fails
    await prisma.trackingNumber.update({
      where: { id: trackingNumberId },
      data: { provisioningStatus: 'ACTIVE' }
    });
    throw error;
  }
}
```

---

## User Stories

### US-PP-1: Affiliate Requests New Campaign Number
**AS AN** affiliate requesting a new campaign
**I WANT** the number provisioning to be instant and reliable
**SO THAT** I can start running ads immediately

**WHEN** I click "Request Campaign" for Windows Repair
**THEN** I see a loading indicator for < 3 seconds
**AND** I see my new number with a Copy button
**AND** if provisioning fails, I see a clear error message with retry option
**AND** I am NOT charged for a number that failed to provision

### US-PP-2: Affiliate Clicks Multiple Times (Impatient)
**AS AN** impatient affiliate who clicks multiple times
**I WANT** the system to handle my duplicate clicks gracefully
**SO THAT** I don't get charged for multiple numbers

**WHEN** I click "Request Campaign" 3 times quickly
**THEN** only ONE number is provisioned
**AND** I see the same number on all subsequent page loads
**AND** no orphaned numbers are created

### US-PP-3: Affiliate Wants to Deactivate Campaign
**AS AN** affiliate who no longer wants to run a campaign
**I WANT** to deactivate my tracking number
**SO THAT** I'm not responsible for calls to that number

**WHEN** I click "Deactivate" on a campaign
**AND** there are active calls on that number
**THEN** I see "Cannot deactivate: 2 active calls in progress"
**AND** the button is disabled until calls complete

**WHEN** I click "Deactivate" and no active calls
**THEN** the number is released
**AND** the campaign shows as "Inactive"
**AND** calls to that number will get "This number is no longer in service"

### US-PP-4: Admin Views Orphaned Numbers
**AS AN** admin monitoring system health
**I WANT** to see any orphaned numbers (Twilio but no DB record)
**SO THAT** I can clean them up and stop unnecessary charges

**WHEN** I view the admin "Phone Numbers" page
**THEN** I see a section for "Orphaned Numbers (Twilio only)"
**AND** I can manually release them with one click
**AND** I see the monthly cost impact

---

## Implementation Tasks

### Phase 1 (MVP) - Option A Only

| Task ID | Description | Status |
|---------|-------------|--------|
| P1-AS-8 | Create tracking-number-service.ts | ⬜ |
| P1-AS-9 | Implement `provisionTrackingNumber()` | ⬜ |
| P1-AS-10 | Implement `getTrackingNumbersByAffiliate()` | ⬜ |
| P1-AP-6 | Implement number provisioning flow in portal | ⬜ |

### Logging Tasks (CRITICAL)

> **All provisioning events MUST be logged** for debugging orphaned numbers and billing.
> See [Section 12: Logging & Observability](./12-logging-observability.md) for details.

| Task ID | Description | Status | Priority |
|---------|-------------|--------|----------|
| P1-PP-LOG-1 | Log `phone.provisioning_started` when affiliate requests | ⬜ | CRITICAL |
| P1-PP-LOG-2 | Log `phone.provisioned` with Twilio SID, phone number | ⬜ | CRITICAL |
| P1-PP-LOG-3 | Log `phone.provisioning_failed` with error details | ⬜ | CRITICAL |
| P1-PP-LOG-4 | Log `phone.release_started`, `phone.released` | ⬜ | CRITICAL |
| P1-PP-LOG-5 | Log `phone.release_blocked` when active calls exist | ⬜ | HIGH |
| P1-PP-LOG-6 | Log orphaned number cleanup actions | ⬜ | HIGH |

### Race Condition Prevention Tasks

| Task ID | Description | Status |
|---------|-------------|--------|
| P1-PP-1 | Add idempotency check before provisioning | ⬜ |
| P1-PP-2 | Implement Saga pattern with compensation | ⬜ |
| P1-PP-3 | Add `provisioningStatus` state machine | ⬜ |
| P1-PP-4 | Implement `canReleaseNumber()` active call check | ⬜ |
| P1-PP-5 | Add orphaned number cleanup job (daily) | ⬜ |
| P1-PP-6 | Add Twilio error handling with retry | ⬜ |

### UI/UX Tasks

| Task ID | Description | Status |
|---------|-------------|--------|
| P1-PP-7 | Add loading state during provisioning | ⬜ |
| P1-PP-8 | Show clear error messages with retry option | ⬜ |
| P1-PP-9 | Disable multiple clicks during provisioning | ⬜ |
| P1-PP-10 | Show deactivation blocked message when active calls | ⬜ |

### Admin Tasks

| Task ID | Description | Status |
|---------|-------------|--------|
| P1-PP-11 | Create admin "Phone Numbers" page | ⬜ |
| P1-PP-12 | Show provisioning status for all numbers | ⬜ |
| P1-PP-13 | Add orphaned number detection (Twilio reconciliation) | ⬜ |
| P1-PP-14 | Add manual number release for admins | ⬜ |

### Testing Tasks

| Task ID | Description | Status |
|---------|-------------|--------|
| P1-PP-T1 | Test concurrent provisioning requests (same affiliate) | ⬜ |
| P1-PP-T2 | Test Twilio success but DB failure (compensation) | ⬜ |
| P1-PP-T3 | Test release blocked during active call | ⬜ |
| P1-PP-T4 | Test orphaned number detection and cleanup | ⬜ |

### Phase 3 - Option B (Forwarding)

| Task ID | Description | Status |
|---------|-------------|--------|
| P3-FW-1 | Create ingress number pool (2-3 shared numbers) | ⬜ |
| P3-FW-2 | Update tracking_numbers schema for forwarding | ⬜ |
| P3-FW-3 | Parse SIP headers for affiliate identification | ⬜ |
| P3-FW-4 | Parse URL params as alternative identification | ⬜ |
| P3-FW-5 | Update affiliate portal with forwarding UI | ⬜ |
| P3-FW-6 | Generate unique forwarding credentials | ⬜ |
| P3-FW-7 | Test forwarding from external Ringba account | ⬜ |

---

## Sentry Integration

### Error Tracking and Alerting

```typescript
import * as Sentry from '@sentry/nextjs';

// Set provisioning context
function setProvisioningContext(affiliateId: string, campaignId: string) {
  Sentry.setContext('provisioning', {
    affiliateId,
    campaignId,
    timestamp: new Date().toISOString()
  });
}

// Track provisioning operations
async function provisionWithSentry(
  affiliateId: string,
  campaignId: string,
  serviceTypeId: string
): Promise<TrackingNumber> {
  const transaction = Sentry.startTransaction({
    name: 'phone.provision',
    op: 'twilio.provision'
  });

  Sentry.addBreadcrumb({
    category: 'phone.provision',
    message: 'Starting phone provisioning',
    level: 'info',
    data: { affiliateId, campaignId, serviceTypeId }
  });

  try {
    const result = await provisionTrackingNumberSaga(
      affiliateId, campaignId, serviceTypeId
    );
    transaction.setStatus('ok');
    return result;
  } catch (error) {
    transaction.setStatus('internal_error');
    Sentry.captureException(error, {
      tags: { component: 'phone-provisioning' },
      extra: { affiliateId, campaignId, serviceTypeId }
    });
    throw error;
  } finally {
    transaction.finish();
  }
}
```

### Sentry Events to Capture

| Event | Sentry Method | Severity | When to Trigger |
|-------|---------------|----------|-----------------|
| Twilio provisioning failed | `captureException` | error | API returns error |
| Saga rollback triggered | `captureMessage` | warning | Compensating transaction needed |
| Orphaned number detected | `captureMessage` | error | Twilio number without DB record |
| Release blocked (active calls) | `captureMessage` | info | Cannot release number |
| Duplicate provisioning request | `captureMessage` | info | Idempotency prevented duplicate |
| Provisioning timeout | `captureException` | error | Twilio API timeout |

### Breadcrumb Tracking

```typescript
// Provisioning lifecycle
Sentry.addBreadcrumb({
  category: 'phone.provision',
  message: 'DB record created (PENDING)',
  level: 'info',
  data: { trackingNumberId, affiliateId }
});

Sentry.addBreadcrumb({
  category: 'phone.provision',
  message: 'Twilio number provisioned',
  level: 'info',
  data: { twilioSid, phoneNumber }
});

Sentry.addBreadcrumb({
  category: 'phone.provision',
  message: 'Provisioning complete (ACTIVE)',
  level: 'info',
  data: { trackingNumberId, phoneNumber }
});

// Saga compensation
Sentry.addBreadcrumb({
  category: 'phone.saga',
  message: 'Saga compensation triggered',
  level: 'warning',
  data: { reason: 'db_update_failed', twilioSid }
});

Sentry.addBreadcrumb({
  category: 'phone.saga',
  message: 'Orphaned Twilio number released',
  level: 'info',
  data: { twilioSid }
});
```

### Alert Configuration

```typescript
// Critical alerts
const CRITICAL_PROVISIONING_ALERTS = [
  'Multiple orphaned numbers detected',
  'Provisioning failure rate > 20%',
  'Saga compensation failures'
];

// Warning alerts
const WARNING_PROVISIONING_ALERTS = [
  'Provisioning latency > 5 seconds',
  'Twilio API rate limit approaching',
  'High release-blocked rate'
];
```

---

*Section Version: 2.1 (Added Sentry Integration)*
