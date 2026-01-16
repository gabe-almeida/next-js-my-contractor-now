# Buyer/Contractor Configuration

> **Section:** 07 | **Phase:** 1 (MVP)
> **Parent:** [spec.md](../spec.md)

---

## Overview

Admin UI for configuring call settings for both contractors (direct transfer) and network buyers (PING/POST).

## Contractor Configuration

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  ADMIN: Buyer Configuration                                                     │
│  Buyer: ABC Plumbing Co.                                    Type: CONTRACTOR    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  [General] [Lead Settings] [Call Settings] [Coverage] [Field Mappings]          │
│  ─────────────────────────────────────────────────────────────────────          │
│                                                                                  │
│  CALL SETTINGS                                                                   │
│  ═════════════                                                                   │
│                                                                                  │
│  ┌─ Acceptance ─────────────────────────────────────────────────────────────┐   │
│  │                                                                           │   │
│  │  ☑ Accept Calls                                                          │   │
│  │                                                                           │   │
│  │  Bid Amount:     $________55.00________                                  │   │
│  │                                                                           │   │
│  │  Min Bid:        $________40.00________     (won't bid below this)       │   │
│  │  Max Bid:        $________80.00________     (won't bid above this)       │   │
│  │                                                                           │   │
│  │  Daily Cap:      ________30________ calls  (0 = unlimited)               │   │
│  │                                                                           │   │
│  └───────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  ┌─ Call Routing ───────────────────────────────────────────────────────────┐   │
│  │                                                                           │   │
│  │  Primary Number:    (________555________) ________123______-____4567____ │   │
│  │                                                                           │   │
│  │  Backup Number:     (________555________) ________123______-____4568____ │   │
│  │  (used if primary busy or no answer after 25 seconds)                    │   │
│  │                                                                           │   │
│  │  ☐ Use SIP instead of phone number                                       │   │
│  │  SIP Address:   ________________________________________________         │   │
│  │                                                                           │   │
│  └───────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  ┌─ Hours of Operation ─────────────────────────────────────────────────────┐   │
│  │                                                                           │   │
│  │  Timezone: [America/New_York          ▼]                                 │   │
│  │                                                                           │   │
│  │  ┌─────────────┬───────────────────────────────────────────────────┐     │   │
│  │  │ Day         │ Hours                                              │     │   │
│  │  ├─────────────┼───────────────────────────────────────────────────┤     │   │
│  │  │ Monday      │ [08:00 ▼] to [18:00 ▼]  ☑ Active                  │     │   │
│  │  │ Tuesday     │ [08:00 ▼] to [18:00 ▼]  ☑ Active                  │     │   │
│  │  │ Wednesday   │ [08:00 ▼] to [18:00 ▼]  ☑ Active                  │     │   │
│  │  │ Thursday    │ [08:00 ▼] to [18:00 ▼]  ☑ Active                  │     │   │
│  │  │ Friday      │ [08:00 ▼] to [18:00 ▼]  ☑ Active                  │     │   │
│  │  │ Saturday    │ [09:00 ▼] to [14:00 ▼]  ☑ Active                  │     │   │
│  │  │ Sunday      │ [     ▼] to [     ▼]  ☐ Closed                   │     │   │
│  │  └─────────────┴───────────────────────────────────────────────────┘     │   │
│  │                                                                           │   │
│  │  ☑ Reject calls outside operating hours (otherwise, ring anyway)         │   │
│  │                                                                           │   │
│  └───────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  ┌─ Call Preferences ───────────────────────────────────────────────────────┐   │
│  │                                                                           │   │
│  │  ☑ Require IVR pre-qualification (homeowner confirmation)                │   │
│  │  ☐ Accept calls without caller ID                                        │   │
│  │  ☑ Allow cascade (be backup buyer if higher bidder rejects)              │   │
│  │                                                                           │   │
│  │  Ring timeout:  ________25________ seconds (before trying backup/next)   │   │
│  │                                                                           │   │
│  └───────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  [Save Changes]                                                                  │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Network Buyer Configuration (PING/POST)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  ADMIN: Buyer Configuration                                                     │
│  Buyer: Modernize                                              Type: NETWORK    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  [General] [Lead Settings] [Call Settings] [Coverage] [Field Mappings]          │
│  ─────────────────────────────────────────────────────────────────────          │
│                                                                                  │
│  CALL SETTINGS (PING/POST RTB)                                                   │
│  ═════════════════════════════                                                   │
│                                                                                  │
│  ┌─ Acceptance ─────────────────────────────────────────────────────────────┐   │
│  │                                                                           │   │
│  │  ☑ Accept Calls via PING/POST                                            │   │
│  │                                                                           │   │
│  │  RTB Endpoint:                                                            │   │
│  │  PING URL: https://rtb.ringba.com/v1/production/XXXXXX.json              │   │
│  │                                                                           │   │
│  │  PING Timeout:  ________2________ seconds  (must respond within this)    │   │
│  │                                                                           │   │
│  │  Min Acceptable Bid:  $________20.00________                              │   │
│  │                                                                           │   │
│  └───────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  ┌─ Call PING Field Mappings ───────────────────────────────────────────────┐   │
│  │                                                                           │   │
│  │  Source Field     →    Target Field       Notes                          │   │
│  │  ────────────────────────────────────────────────────────────────────    │   │
│  │  callerPhone      →    CID                Caller's phone number          │   │
│  │  callerZip        →    zipcode            From Twilio or IVR             │   │
│  │  serviceType      →    service            e.g., "WINDOWS"                │   │
│  │  (static)         →    exposeCallerId     Always "yes"                   │   │
│  │                                                                           │   │
│  │  [Edit Field Mappings]                                                    │   │
│  │                                                                           │   │
│  └───────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  ┌─ PING Response Parsing ──────────────────────────────────────────────────┐   │
│  │                                                                           │   │
│  │  Expected response fields:                                                │   │
│  │  • bidAmount: numeric (e.g., 45.50)                                      │   │
│  │  • bidId: string (required for transfer)                                 │   │
│  │  • phoneNumber: string (where to transfer)                               │   │
│  │  • expireInSeconds: number (transfer window)                             │   │
│  │                                                                           │   │
│  │  Rejection indicators:                                                    │   │
│  │  • bidAmount = 0 or null                                                 │   │
│  │  • rejected = true                                                        │   │
│  │  • HTTP 4xx/5xx status                                                   │   │
│  │                                                                           │   │
│  └───────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  [Save Changes]                                                                  │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## File Structure

```
src/components/admin/buyers/
├── CallSettingsTab.tsx           # Main call settings form
├── HoursOfOperationEditor.tsx    # Hours picker component
├── NetworkCallSettings.tsx       # PING/POST configuration
└── CallFieldMappingsEditor.tsx   # Field mapping UI (reused from leads)
```

---

## Race Condition: Config Changes During Active Auction

```typescript
// WHY: Admin changing buyer settings mid-auction could cause inconsistency.
//      e.g., phone number changed while call is being transferred.
// WHEN: Admin saves buyer config while auction is running.
// HOW: Snapshot config at auction start, use snapshot for entire auction.

// src/lib/auction/config-snapshot.ts

interface BuyerConfigSnapshot {
  snapshotId: string;
  buyerId: string;
  capturedAt: Date;
  config: {
    callBidAmount: number;
    callForwardingNumber: string;
    callBackupNumber: string;
    hoursOfOperation: HoursMap;
    timezone: string;
    ringTimeout: number;
    requireIvrQualification: boolean;
  };
}

// At auction start, snapshot all eligible buyer configs
export async function snapshotBuyerConfigs(
  buyerIds: string[]
): Promise<Map<string, BuyerConfigSnapshot>> {
  const snapshots = new Map();

  const configs = await prisma.buyerServiceConfig.findMany({
    where: { buyerId: { in: buyerIds } },
    include: { buyer: true }
  });

  for (const config of configs) {
    snapshots.set(config.buyerId, {
      snapshotId: generateId(),
      buyerId: config.buyerId,
      capturedAt: new Date(),
      config: {
        callBidAmount: config.callBidAmount,
        callForwardingNumber: config.buyer.callForwardingNumber,
        callBackupNumber: config.buyer.callBackupNumber,
        hoursOfOperation: config.buyer.callHoursOfOperation,
        timezone: config.buyer.timezone || 'America/New_York',
        ringTimeout: config.buyer.callRingTimeout || 25,
        requireIvrQualification: config.requireIvrQualification,
      }
    });
  }

  return snapshots;
}

// Store snapshot with call for audit trail
await prisma.call.update({
  where: { id: callId },
  data: {
    buyerConfigSnapshot: snapshotToJson(snapshot),
  }
});
```

### Phone Number Version Tracking

```typescript
// WHY: If phone number changes during cascade, we could dial wrong number.
// WHEN: During transfer attempts.
// HOW: Version number on buyer config, check before each dial.

// Add to buyers table:
// version: INT DEFAULT 1 (incremented on any config change)

export async function getTransferNumber(
  buyerId: string,
  expectedVersion: number
): Promise<{ number: string; isStale: boolean }> {
  const buyer = await prisma.buyer.findUnique({
    where: { id: buyerId },
    select: { callForwardingNumber: true, version: true }
  });

  if (buyer.version !== expectedVersion) {
    logger.warn('Buyer config changed during auction', {
      buyerId,
      expectedVersion,
      currentVersion: buyer.version
    });

    // Return current number but flag as potentially stale
    return { number: buyer.callForwardingNumber, isStale: true };
  }

  return { number: buyer.callForwardingNumber, isStale: false };
}
```

---

## Validation Requirements

### Phone Number Validation

```typescript
// WHY: Invalid phone numbers cause transfer failures.
// WHEN: When admin saves call routing settings.
// HOW: Validate E.164 format, optionally verify with Twilio lookup.

import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';

export function validatePhoneNumber(input: string): {
  valid: boolean;
  formatted?: string;
  error?: string;
} {
  try {
    if (!isValidPhoneNumber(input, 'US')) {
      return {
        valid: false,
        error: 'Invalid US phone number format'
      };
    }

    const parsed = parsePhoneNumber(input, 'US');
    return {
      valid: true,
      formatted: parsed.format('E.164') // +15551234567
    };
  } catch (error) {
    return {
      valid: false,
      error: 'Unable to parse phone number'
    };
  }
}

// Optional: Verify with Twilio Lookup API
export async function verifyPhoneNumberReachable(
  phoneNumber: string
): Promise<{ reachable: boolean; carrier?: string }> {
  try {
    const lookup = await twilioClient.lookups.v1.phoneNumbers(phoneNumber).fetch();
    return {
      reachable: true,
      carrier: lookup.carrier?.name
    };
  } catch (error) {
    return { reachable: false };
  }
}
```

### Hours of Operation Validation

```typescript
// WHY: Invalid hours (end before start, overlapping, etc.) cause confusion.
// WHEN: When admin saves hours.
// HOW: Validate each day's hours.

interface DayHours {
  active: boolean;
  start: string; // HH:MM 24-hour
  end: string;
}

export function validateHoursOfOperation(
  hours: Record<string, DayHours>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  for (const day of days) {
    const dayHours = hours[day];
    if (!dayHours || !dayHours.active) continue;

    // Check valid time format
    if (!isValidTimeFormat(dayHours.start)) {
      errors.push(`${day}: Invalid start time format`);
    }
    if (!isValidTimeFormat(dayHours.end)) {
      errors.push(`${day}: Invalid end time format`);
    }

    // Check end is after start
    if (dayHours.start >= dayHours.end) {
      errors.push(`${day}: End time must be after start time`);
    }

    // Check minimum duration (at least 1 hour)
    const durationMinutes = timeDifferenceMinutes(dayHours.start, dayHours.end);
    if (durationMinutes < 60) {
      errors.push(`${day}: Operating hours must be at least 1 hour`);
    }
  }

  // Check at least one active day
  const hasActiveDay = days.some(d => hours[d]?.active);
  if (!hasActiveDay) {
    errors.push('At least one day must be active');
  }

  return { valid: errors.length === 0, errors };
}
```

### Bid Amount Validation

```typescript
// WHY: Invalid bid amounts cause financial issues.
// WHEN: When admin saves bid settings.
// HOW: Validate ranges and relationships.

export function validateBidSettings(settings: {
  bidAmount: number;
  minBid: number;
  maxBid: number;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Minimum bid floor
  if (settings.bidAmount < 5) {
    errors.push('Bid amount must be at least $5.00');
  }

  // Maximum bid ceiling
  if (settings.bidAmount > 500) {
    errors.push('Bid amount cannot exceed $500.00');
  }

  // Min must be less than or equal to current
  if (settings.minBid > settings.bidAmount) {
    errors.push('Minimum bid cannot be higher than current bid');
  }

  // Max must be greater than or equal to current
  if (settings.maxBid < settings.bidAmount) {
    errors.push('Maximum bid cannot be lower than current bid');
  }

  // Min must be less than max
  if (settings.minBid >= settings.maxBid) {
    errors.push('Minimum bid must be less than maximum bid');
  }

  return { valid: errors.length === 0, errors };
}
```

### PING URL Validation (Networks)

```typescript
// WHY: Invalid PING URLs cause auction failures.
// WHEN: When admin saves network buyer settings.
// HOW: Validate URL format and optionally test connectivity.

export async function validatePingUrl(url: string): Promise<{
  valid: boolean;
  error?: string;
  testResult?: { statusCode: number; responseTimeMs: number };
}> {
  // Check URL format
  try {
    const parsed = new URL(url);

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: 'URL must use HTTP or HTTPS' };
    }

    if (parsed.protocol === 'http:' && !parsed.hostname.includes('localhost')) {
      return { valid: false, error: 'Production URLs must use HTTPS' };
    }
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }

  // Optional: Test connectivity
  try {
    const start = Date.now();
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: true }),
      signal: AbortSignal.timeout(5000)
    });

    return {
      valid: true,
      testResult: {
        statusCode: response.status,
        responseTimeMs: Date.now() - start
      }
    };
  } catch (error) {
    return {
      valid: true, // URL format is valid, but connectivity test failed
      error: 'URL reachable test failed (this may be normal if endpoint requires auth)'
    };
  }
}
```

---

## User Stories

### US-BA-1: Admin Changes Buyer Phone During Cascade
**AS AN** admin changing a buyer's phone number
**I WANT** the change to not affect ongoing calls
**SO THAT** callers aren't disconnected or sent to wrong numbers

**WHEN** I change ABC Plumbing's number while a call is cascading to them
**THEN** the ongoing call uses the OLD number (from snapshot)
**AND** NEW calls after the change use the new number
**AND** audit log shows which version was used

### US-BA-2: Admin Enters Invalid Phone Number
**AS AN** admin entering a buyer's phone number
**I WANT** immediate validation feedback
**SO THAT** I don't save bad data that causes call failures

**WHEN** I enter "555-123-456" (invalid)
**THEN** I see "Invalid US phone number format"
**AND** the Save button is disabled
**AND** I see the expected format as a hint

### US-BA-3: Admin Sets Invalid Hours
**AS AN** admin setting hours of operation
**I WANT** the system to catch my mistakes
**SO THAT** calls aren't incorrectly rejected

**WHEN** I set Monday as 18:00 to 08:00 (end before start)
**THEN** I see "Monday: End time must be after start time"
**AND** I cannot save until corrected

### US-BA-4: Admin Tests PING URL
**AS AN** admin configuring a network buyer
**I WANT** to test the PING URL before saving
**SO THAT** I know the integration will work

**WHEN** I click "Test URL"
**THEN** I see a loading indicator
**AND** if successful: "✅ Reachable (350ms response)"
**AND** if failed: "❌ Connection failed - check URL or network access"

---

## Implementation Tasks

| Task ID | Description | Status |
|---------|-------------|--------|
| P1-BA-1 | Create CallSettingsTab component | ⬜ |
| P1-BA-2 | Implement contractor call settings form | ⬜ |
| P1-BA-3 | Add hours of operation editor | ⬜ |
| P1-BA-4 | Add call routing configuration | ⬜ |
| P1-BA-5 | Add call preferences checkboxes | ⬜ |
| P2-BA-1 | Create NetworkCallSettings component | ⬜ |
| P2-BA-2 | Add PING URL configuration | ⬜ |
| P2-BA-3 | Add call field mappings editor | ⬜ |
| P2-BA-4 | Add PING response parsing configuration | ⬜ |

### Logging Tasks (CRITICAL)

> **All config changes MUST be logged** for debugging bid issues and compliance.
> See [Section 12: Logging & Observability](./12-logging-observability.md) for details.

| Task ID | Description | Status | Priority |
|---------|-------------|--------|----------|
| P1-BA-LOG-1 | Log `buyer.config_updated` when settings change | ⬜ | CRITICAL |
| P1-BA-LOG-2 | Log old vs new values for audit trail | ⬜ | HIGH |
| P1-BA-LOG-3 | Log `buyer.hours_changed` with timezone | ⬜ | HIGH |
| P1-BA-LOG-4 | Log `buyer.phone_changed` for call routing | ⬜ | CRITICAL |
| P1-BA-LOG-5 | Log `buyer.ping_url_changed` for network buyers | ⬜ | HIGH |

### Race Condition Prevention Tasks

| Task ID | Description | Status |
|---------|-------------|--------|
| P1-BA-6 | Implement buyer config snapshotting at auction start | ⬜ |
| P1-BA-7 | Store config snapshot with call record | ⬜ |
| P1-BA-8 | Add version tracking to buyer table | ⬜ |
| P1-BA-9 | Implement stale config detection during cascade | ⬜ |

### Validation Tasks

| Task ID | Description | Status |
|---------|-------------|--------|
| P1-BA-10 | Implement phone number validation | ⬜ |
| P1-BA-11 | Implement hours of operation validation | ⬜ |
| P1-BA-12 | Implement bid amount validation | ⬜ |
| P1-BA-13 | Implement timezone validation | ⬜ |
| P2-BA-5 | Implement PING URL validation | ⬜ |
| P2-BA-6 | Add PING URL connectivity test | ⬜ |
| P2-BA-7 | Validate field mappings syntax | ⬜ |

### UI/UX Tasks

| Task ID | Description | Status |
|---------|-------------|--------|
| P1-BA-14 | Show validation errors inline | ⬜ |
| P1-BA-15 | Disable Save button on validation errors | ⬜ |
| P1-BA-16 | Add format hints for phone numbers | ⬜ |
| P1-BA-17 | Add timezone selector with preview | ⬜ |
| P2-BA-8 | Add "Test URL" button for networks | ⬜ |
| P2-BA-9 | Show PING test results with response time | ⬜ |

### Testing Tasks

| Task ID | Description | Status |
|---------|-------------|--------|
| P1-BA-T1 | Test config snapshot preserved during auction | ⬜ |
| P1-BA-T2 | Test phone number validation edge cases | ⬜ |
| P1-BA-T3 | Test hours validation (end before start) | ⬜ |
| P1-BA-T4 | Test bid validation (min > max) | ⬜ |
| P2-BA-T1 | Test PING URL validation | ⬜ |

---

*Section Version: 2.0 (Audit Updated)*
