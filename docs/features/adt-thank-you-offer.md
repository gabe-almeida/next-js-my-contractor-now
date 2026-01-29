# ADT Home Security - Thank You Page Offer

## Overview

PX (lead buyer) has provided us an opportunity to monetize our thank you page by displaying an ADT Home Security offer. When users click and convert, we earn revenue.

**Account ID:** 15882
**Campaign ID:** 473
**Host Name ID:** 23325
**Buyer Relationship:** PX (Network Lead Buyer)

---

## Tracking Link Format

```
https://safety-today.adt.com/aff_ad?campaign_id=473&aff_id=15882&hostNameId=23325&aff_sub={TRAFFIC_SOURCE}&aff_sub2={LEAD_ID}
```

### Outbound Parameters (What We Send)

| Parameter | Value | Constraints | Example |
|-----------|-------|-------------|---------|
| `campaign_id` | `473` | Fixed | `473` |
| `aff_id` | `15882` | Fixed | `15882` |
| `hostNameId` | `23325` | Fixed | `23325` |
| `aff_sub` | Traffic source | Max 20 unique values, no special chars | `google`, `Facebook` |
| `aff_sub2` | Lead ID | **TBD: Confirm max length with PX** | `550e8400-e29b-41d4-a716-446655440000` |

### Traffic Source Logic (`aff_sub`)

PX allows full text values like "Google", "Facebook", "Search", etc. - no complex mapping needed.

**Simple approach (matches how we handle other buyers):**

```typescript
const attribution = getStoredAttributionData();

let affSub = 'Direct';

// 1. Use utm_source directly if present (most common case)
if (attribution.utm_source) {
  affSub = attribution.utm_source;
}
// 2. Detect from click IDs if no utm_source
else if (attribution.gclid) {
  affSub = 'Google';
} else if (attribution.fbclid) {
  affSub = 'Facebook';
} else if (attribution.msclkid) {
  affSub = 'Microsoft';
} else if (attribution.ttclid) {
  affSub = 'TikTok';
}
// 3. Check for affiliate traffic
else if (attribution.ref || attribution.affiliate_id) {
  affSub = 'Affiliate';
}

// Clean special characters (PX requirement)
affSub = affSub.replace(/[^a-zA-Z0-9]/g, '');
```

**Expected values:**
- `google`, `facebook`, `taboola` (from utm_source)
- `Google`, `Facebook`, `Microsoft`, `TikTok` (from click IDs)
- `Affiliate` (from ref/affiliate_id)
- `Direct` (fallback)

---

## Postback URL (Inbound - What We Receive)

ADT/PX calls this URL when a user converts on their end:

```
https://mycontractornow.com/api/postback/adt?aff_sub={aff_sub}&aff_sub2={aff_sub2}&transaction_id={transaction_id}&payout={payout}
```

### Inbound Parameters (What They Send Us)

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `aff_sub` | string | No | Traffic source we originally sent | `GG1` |
| `aff_sub2` | string | **Yes** | Lead ID we originally sent | `550e8400-...` |
| `transaction_id` | string | **Yes** | Their unique conversion ID | `PX-ADT-12345` |
| `payout` | string | **Yes** | Revenue amount (USD) | `45.00` or `45` |

### Payout Format Handling

PX may send payout in various formats. Handle all:
- `"45.00"` - string with decimals
- `"45"` - string integer
- `45.00` - number (if JSON body)
- Empty or missing - log warning, store as 0

---

## Edge Cases & Race Conditions

### 1. Postback Arrives Before Click is Recorded

**Scenario:** User clicks, network fires postback very fast, our click tracking beacon hasn't completed.

**Solution:**
- Don't require click record to exist
- `click_id` on conversion is nullable
- Background job can match orphaned conversions to clicks later (within 1 hour window)

### 2. Duplicate Postbacks

**Scenario:** Network retries or sends same conversion multiple times.

**Solution:**
- Unique constraint on `transaction_id`
- On duplicate, return 200 OK (idempotent) but don't insert
- Log duplicate attempt for monitoring

### 3. Lead ID Not Found

**Scenario:** `aff_sub2` contains a UUID that doesn't exist in our `leads` table.

**Possible causes:**
- Test postback with fake ID
- Lead was deleted
- Truncated/malformed UUID

**Solution:**
- Still record the conversion (don't reject)
- Set `lead_id` as nullable
- Store raw `aff_sub2` for debugging
- Flag as `lead_not_found: true` in metadata
- Admin UI shows these for investigation

### 4. Postback Validation / Security

**Scenario:** Malicious actor sends fake postbacks to inflate revenue.

**Solutions (implement at least one):**
- [ ] **IP Whitelist:** Get PX's postback server IPs, reject others
- [ ] **Secret Token:** Add `?token=SECRET` to postback URL, validate on receive
- [ ] **Signature:** If PX supports HMAC signing, verify signature

**Recommendation:** Start with secret token (simplest). Add to URL:
```
https://mycontractornow.com/api/postback/adt?token=YOUR_SECRET_HERE&aff_sub={aff_sub}&...
```

### 5. Click Tracking Failure

**Scenario:** User has ad blocker, JavaScript disabled, or beacon fails.

**Solution:**
- Click tracking is best-effort, not required for conversion attribution
- Conversion matching uses `aff_sub2` (lead ID), not click record
- Track click failure rate in analytics

### 6. Delayed Conversions

**Scenario:** User clicks today, converts 2 weeks later.

**Solution:**
- No expiration on matching - if we sent the lead ID, we accept the postback
- `converted_at` timestamp from postback (or use received time if not provided)
- Report can show click-to-conversion time distribution

### 7. Zero or Negative Payout

**Scenario:** Postback has `payout=0` or `payout=-10` (chargeback?).

**Solution:**
- Accept and store all payouts including zero/negative
- Add `status` field: `pending`, `confirmed`, `reversed`
- Negative payout could indicate reversal - flag for review

---

## Database Schema

### `exit_offer_clicks`

```sql
CREATE TABLE exit_offer_clicks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         UUID REFERENCES leads(id) ON DELETE SET NULL,
  offer_type      VARCHAR(50) NOT NULL,        -- 'adt_home_security'
  offer_provider  VARCHAR(50) NOT NULL,        -- 'px'
  traffic_source  VARCHAR(20) NOT NULL,        -- aff_sub value
  click_url       TEXT NOT NULL,               -- full URL sent
  user_agent      TEXT,                        -- for debugging
  ip_address      VARCHAR(45),                 -- for fraud detection
  clicked_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- For matching orphaned conversions
  INDEX idx_exit_offer_clicks_lead_id (lead_id),
  INDEX idx_exit_offer_clicks_clicked_at (clicked_at)
);
```

### `exit_offer_conversions`

```sql
CREATE TABLE exit_offer_conversions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  click_id          UUID REFERENCES exit_offer_clicks(id) ON DELETE SET NULL,
  lead_id           UUID REFERENCES leads(id) ON DELETE SET NULL,

  -- What we received
  offer_type        VARCHAR(50) NOT NULL,       -- 'adt_home_security'
  offer_provider    VARCHAR(50) NOT NULL,       -- 'px'
  transaction_id    VARCHAR(100) NOT NULL,      -- UNIQUE - prevents duplicates
  payout            DECIMAL(10,2) NOT NULL DEFAULT 0,
  payout_currency   VARCHAR(3) DEFAULT 'USD',

  -- Raw tracking params received
  aff_sub           VARCHAR(50),
  aff_sub2          VARCHAR(100),               -- raw value, even if lead not found

  -- Status tracking
  status            VARCHAR(20) DEFAULT 'confirmed', -- pending, confirmed, reversed
  lead_not_found    BOOLEAN DEFAULT FALSE,

  -- Debugging
  raw_payload       JSONB,                      -- full query string/body
  source_ip         VARCHAR(45),

  -- Timestamps
  converted_at      TIMESTAMPTZ,                -- when conversion happened (if provided)
  received_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(transaction_id),                       -- prevent duplicate postbacks
  INDEX idx_exit_offer_conversions_lead_id (lead_id),
  INDEX idx_exit_offer_conversions_received_at (received_at),
  INDEX idx_exit_offer_conversions_status (status)
);
```

---

## Admin UI Design

### Location: PX Buyer Detail Page → "Partner Offers" Tab

**Why here:** This offer comes through the PX business relationship. Keeping it on their buyer page:
- Groups related revenue streams
- Easy to find when discussing with PX
- Shows full picture of PX relationship (leads sold TO them + revenue FROM them)

### Tab Sections

#### 1. Configuration Card
```
┌─────────────────────────────────────────────────────────────────┐
│ ADT Home Security Offer                              [Active ✓] │
├─────────────────────────────────────────────────────────────────┤
│ Account ID: 15882                                               │
│ Campaign ID: 473                                                │
│                                                                 │
│ Postback URL (share with PX):                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ https://mycontractornow.com/api/postback/adt?token=xxx...   │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                    [Copy URL]   │
│                                                                 │
│ Test Postback:                                    [Send Test]   │
└─────────────────────────────────────────────────────────────────┘
```

#### 2. Stats Summary (Top of Tab)
```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│   Clicks     │ │ Conversions  │ │ Conv. Rate   │ │   Revenue    │
│    1,234     │ │      45      │ │    3.6%      │ │   $2,025     │
│   (30 days)  │ │   (30 days)  │ │              │ │   (30 days)  │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

#### 3. Recent Conversions Table
```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Recent Conversions                                    [Export CSV] [Filter ▼]   │
├──────────────┬────────────┬──────────┬──────────┬─────────────┬─────────────────┤
│ Date         │ Lead       │ Payout   │ Source   │ Affiliate   │ Transaction ID  │
├──────────────┼────────────┼──────────┼──────────┼─────────────┼─────────────────┤
│ Jan 28, 2:30p│ John D.    │ $45.00   │ GG1      │ partner123  │ PX-ADT-45678    │
│              │ [View →]   │          │          │             │                 │
├──────────────┼────────────┼──────────┼──────────┼─────────────┼─────────────────┤
│ Jan 28, 1:15p│ ⚠ Not Found│ $45.00   │ FB1      │ -           │ PX-ADT-45677    │
│              │ abc123...  │          │          │             │                 │
├──────────────┼────────────┼──────────┼──────────┼─────────────┼─────────────────┤
│ Jan 27, 4:45p│ Sarah M.   │ $45.00   │ Direct   │ -           │ PX-ADT-45676    │
│              │ [View →]   │          │          │             │                 │
└──────────────┴────────────┴──────────┴──────────┴─────────────┴─────────────────┘
```

**Key features:**
- "Lead" column links to lead detail page
- "Affiliate" derived from `lead.compliance_data.attribution.ref`
- Warning icon for `lead_not_found` records
- Filter by: date range, traffic source, affiliate, status

#### 4. Revenue by Source Chart
```
Revenue by Traffic Source (30 days)
┌────────────────────────────────────────┐
│ GG1     ████████████████████  $1,200   │
│ FB1     ██████████            $600     │
│ Direct  ████                  $180     │
│ Aff     █                     $45      │
└────────────────────────────────────────┘
```

#### 5. Revenue by Affiliate (if applicable)
```
Revenue by Affiliate (30 days)
┌────────────────────────────────────────┐
│ partner123  ████████████████  $800     │
│ aff456      ████████          $400     │
│ (direct)    ██████████████    $825     │
└────────────────────────────────────────┘
```

---

## Tasks

### Phase 0: Discovery & Questions (Do First)

- [ ] **Ask PX these questions:**
  1. Max length for aff_sub2? (We use 36-char UUIDs)
  2. Postback authentication - IP whitelist? Secret token? Which IPs?
  3. Expected response format - "OK" text? 1x1 pixel? Specific status?
  4. Payout format - string "45.00" or number?
  5. Do you send reversal/chargeback postbacks?

- [x] **Deploy discovery postback endpoint**
  - Logs all incoming params, headers, body, IP
  - Returns 200 OK
  - See exact format before building full parser

- [x] **Deploy test thank you page**
  - Support `?test=true` query param
  - Shows ADT banner with test values (`aff_sub=Test`)
  - Provides URL to PX for their click verification

### Phase 1: Core Implementation

- [x] **Database: Add schema**
  - Add `ExitOfferClick` model to Prisma
  - Add `ExitOfferConversion` model to Prisma
  - Unique constraint on `transaction_id`
  - Run migration

- [x] **Config: Generate postback secret token**
  - Add `ADT_POSTBACK_SECRET` to environment
  - Generate secure random string

- [x] **API: Create `/api/postback/adt/route.ts`**
  - GET handler (standard for postbacks)
  - Validate token parameter
  - Parse and validate required params
  - Handle duplicate `transaction_id` (return 200, don't insert)
  - Look up lead by `aff_sub2`
  - Set `lead_not_found` flag if not found
  - Store conversion record
  - Attempt to match to click (by lead_id, within 24h window)
  - Return 200 OK (or 1x1 pixel if they expect image response)
  - Log all postbacks for debugging

- [x] **API: Create `/api/exit-offers/click/route.ts`**
  - POST handler for recording clicks
  - Called from thank you page before redirect
  - Store click record with lead_id, traffic_source, full URL

- [x] **Thank You Page: Add ADT banner**
  - Read attribution from sessionStorage (already stored by form)
  - Build `aff_sub` inline: use `utm_source` directly, or detect from click IDs
  - Build tracking URL with `aff_sub` + `leadId` (from URL param)
  - On click: fire beacon to record click, then open URL in new tab
  - Support `?test=true` mode for PX verification

### Phase 2: Admin UI

- [x] **Add "Partner Offers" tab to PX buyer page**
  - New tab type in `BuyerDetailPage`
  - Create `BuyerPartnerOffersTab` component
  - Tab only shows for NETWORK type buyers

- [x] **Configuration card**
  - Display account/campaign IDs (473, 15882, 23325)
  - Show postback URL with copy button
  - "Send Test Postback" button deferred to future enhancement

- [x] **Stats summary component**
  - Clicks, conversions, rate, revenue (30 day default)
  - Date range selector (7d, 30d, 90d, all time)
  - Warning banner for lead-not-found conversions

- [x] **Conversions table**
  - Paginated list with all fields
  - Link to lead detail page
  - Show affiliate attribution from lead.complianceData.attribution.ref
  - Filter by timeframe
  - Warning icon for leadNotFound records

- [x] **Revenue by traffic source chart**
  - Horizontal bar chart showing revenue per source
  - Sorted by revenue descending

- [ ] **Export to CSV** (deferred to Phase 3)
- [ ] **Revenue charts over time** (deferred to Phase 3)

### Phase 3: Alerts & Monitoring

- [ ] **Email alert on conversion**
  - Send to admin email
  - Include: lead name, payout, traffic source, affiliate

- [ ] **Alert for suspicious activity**
  - Multiple conversions from same IP
  - High volume of `lead_not_found` conversions
  - Invalid token attempts

- [ ] **Reconciliation report**
  - Monthly summary to compare against PX reports
  - Exportable for accounting

---

## Questions to Resolve with PX

1. **Max length for aff_sub2?** We use 36-char UUIDs.

2. **Postback authentication?** Do you support:
   - IP whitelist (what IPs do postbacks come from?)
   - Secret token in URL
   - HMAC signature

3. **Payout format?** Will it always be a decimal string like "45.00"?

4. **Conversion timestamp?** Do you send when the conversion happened, or should we use received time?

5. **Reversals/chargebacks?** Will you send postbacks for reversed conversions? If so, how indicated?

6. **Expected response?** Return 200 OK text, or 1x1 tracking pixel?

---

## Implementation Clarifications

### How Attribution Flows to Thank You Page

```
1. User lands on form page with ?gclid=xxx or ?utm_source=google
   └─→ DynamicForm calls getAttributionData()
   └─→ Attribution stored in sessionStorage

2. User submits form
   └─→ Attribution sent to /api/leads in complianceData
   └─→ Lead created with attribution in compliance_data JSON
   └─→ Redirect to /thank-you?leadId=UUID

3. Thank You page loads
   └─→ Read leadId from URL params
   └─→ Read attribution from sessionStorage (still available, same session)
   └─→ Build ADT link: aff_sub = mapAttribution(), aff_sub2 = leadId
```

**Fallback:** If sessionStorage unavailable/cleared, use `aff_sub=Direct`

### Test Link Strategy

PX asked for "a test link where you implement the tracking link on your end."

**Option A: Use real test lead**
1. We submit a test lead through our form
2. Note the leadId from thank you page
3. Send PX: `https://mycontractornow.com/thank-you?leadId=REAL_UUID`
4. They click the ADT link and verify on their end

**Option B: Dedicated test mode (simpler for PX)**
Add `?test=true` support:
```
https://mycontractornow.com/thank-you?leadId=test-demo&test=true
```
- Shows ADT banner with hardcoded test values
- `aff_sub=Test`, `aff_sub2=test-demo`
- Clear "TEST MODE" indicator

**Recommendation:** Option B - easier for PX to test repeatedly

### Postback Discovery Phase

Before building full parsing, deploy a "logger" endpoint that captures exactly what PX sends:

```typescript
// /api/postback/adt/route.ts - Discovery version
export async function GET(request: Request) {
  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams);

  console.log('ADT Postback received:', {
    method: 'GET',
    params,
    headers: Object.fromEntries(request.headers),
    ip: request.headers.get('x-forwarded-for'),
  });

  // Return 200 OK - most common expectation
  return new Response('OK', { status: 200 });
}

export async function POST(request: Request) {
  const contentType = request.headers.get('content-type');
  let body;

  if (contentType?.includes('application/json')) {
    body = await request.json();
  } else if (contentType?.includes('form')) {
    body = Object.fromEntries(await request.formData());
  } else {
    body = await request.text();
  }

  console.log('ADT Postback received:', {
    method: 'POST',
    contentType,
    body,
    headers: Object.fromEntries(request.headers),
  });

  return new Response('OK', { status: 200 });
}
```

**After PX sends test postback:**
1. Check Render logs for exact payload format
2. Update parser to match actual format
3. Add validation and database storage

### What They Actually Send (Expected)

Based on email, postback will be a **GET request** with query params:
```
GET /api/postback/adt?aff_sub=GG1&aff_sub2=550e8400-...&transaction_id=PX123&payout=45.00
```

But we should verify:
- Is payout a string or number?
- Are there additional params (status, timestamp)?
- What IP addresses do postbacks come from?

---

## Feature Flag

**Current Status:** ADT banner is behind a feature flag - only visible in test mode.

| URL | Banner Visible |
|-----|----------------|
| `/thank-you?leadId=abc123` | No |
| `/thank-you?leadId=abc123&test=true` | Yes |

**To enable for all users:** Remove the `isTestMode &&` condition in `src/app/thank-you/page.tsx` (lines 49-52).

---

## Test Plan

### 1. Unit Tests

```typescript
// aff-sub-logic.test.ts
test('uses utm_source directly when present', () => {
  expect(getAffSub({ utm_source: 'google' })).toBe('google');
});

test('detects Google from gclid when no utm_source', () => {
  expect(getAffSub({ gclid: 'xxx' })).toBe('Google');
});

test('prefers utm_source over click ID', () => {
  expect(getAffSub({ utm_source: 'taboola', gclid: 'xxx' })).toBe('taboola');
});

test('strips special characters', () => {
  expect(getAffSub({ utm_source: 'google/cpc' })).toBe('googlecpc');
});

test('falls back to Direct', () => {
  expect(getAffSub({})).toBe('Direct');
});
```

### 2. Integration Tests

```typescript
// postback-endpoint.test.ts
test('records valid conversion', async () => {
  const res = await fetch('/api/postback/adt?token=SECRET&aff_sub=GG1&aff_sub2=LEAD_ID&transaction_id=TX1&payout=45.00');
  expect(res.status).toBe(200);
  // Verify record in database
});

test('rejects invalid token', async () => {
  const res = await fetch('/api/postback/adt?token=WRONG&...');
  expect(res.status).toBe(401);
});

test('handles duplicate transaction_id', async () => {
  // First request
  await fetch('/api/postback/adt?...&transaction_id=TX1&...');
  // Duplicate
  const res = await fetch('/api/postback/adt?...&transaction_id=TX1&...');
  expect(res.status).toBe(200); // Still 200, idempotent
  // Verify only one record
});

test('handles missing lead gracefully', async () => {
  const res = await fetch('/api/postback/adt?...&aff_sub2=NONEXISTENT&...');
  expect(res.status).toBe(200);
  // Verify record with lead_not_found=true
});
```

### 3. Manual Test with PX

1. **Share test postback URL:**
   ```
   https://mycontractornow.com/api/postback/adt?token=YOUR_SECRET&aff_sub={aff_sub}&aff_sub2={aff_sub2}&transaction_id={transaction_id}&payout={payout}
   ```

2. **Share test thank you page:**
   ```
   https://mycontractornow.com/thank-you?leadId=TEST_LEAD_UUID
   ```

3. **Ask PX to send test postback and verify:**
   - Conversion recorded in admin UI
   - All fields populated correctly

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `prisma/schema.prisma` | Modify | Add ExitOfferClick, ExitOfferConversion models |
| `src/app/api/postback/adt/route.ts` | Create | Postback endpoint |
| `src/app/api/exit-offers/click/route.ts` | Create | Click tracking endpoint |
| `src/app/thank-you/page.tsx` | Modify | Add ADT offer banner (inline aff_sub logic) |
| `src/components/admin/BuyerPartnerOffersTab.tsx` | Create | Admin UI tab |
| `src/app/(admin)/admin/buyers/[id]/page.tsx` | Modify | Add Partner Offers tab |
| `src/app/api/admin/exit-offers/stats/route.ts` | Create | Stats API for admin dashboard |
| `src/app/api/admin/exit-offers/conversions/route.ts` | Create | Paginated conversions list API |
| `.env` | Modify | Add ADT_POSTBACK_SECRET |

---

## Phase 2 Implementation Notes (Admin UI)

**Completed: 2026-01-28**

### Files Created

1. **`src/app/api/admin/exit-offers/stats/route.ts`**
   - GET endpoint for aggregated stats
   - Query params: `offerType`, `timeframe` (7d/30d/90d/all)
   - Returns: clicks, conversions, conversion rate, total revenue, avg payout
   - Includes revenue breakdown by traffic source
   - 5-minute Redis cache

2. **`src/app/api/admin/exit-offers/conversions/route.ts`**
   - GET endpoint for paginated conversions list
   - Query params: `offerType`, `timeframe`, `page`, `limit`, `status`, `leadNotFound`
   - Returns: conversion details with lead attribution
   - Extracts affiliate ref from `lead.complianceData.attribution.ref`

3. **`src/components/admin/BuyerPartnerOffersTab.tsx`**
   - Full-featured admin tab component
   - Configuration card with ADT IDs and postback URL (copy button)
   - Stats summary using `AdminStatGrid` component
   - Warning banner for lead-not-found conversions
   - Revenue by traffic source horizontal bar chart
   - Paginated conversions table with:
     - Date, Lead (link), Payout, Source, Affiliate, Transaction ID
     - Warning icon for unmatched leads
     - Previous/Next pagination controls
   - Timeframe selector (7d, 30d, 90d, all time)

### Files Modified

4. **`src/app/(admin)/admin/buyers/[id]/page.tsx`**
   - Added `partner-offers` to `TabType` union
   - Added `Gift` icon import from lucide-react
   - Tab only shows for `NETWORK` type buyers
   - Renders `BuyerPartnerOffersTab` when tab is active

### Design Decisions

1. **Tab visibility**: Partner Offers tab only appears for NETWORK buyers since this is where partner relationships exist (contractors wouldn't have these)

2. **No "Send Test Postback" button**: Deferred to future enhancement - requires backend functionality to simulate a postback

3. **Timeframe as filter**: Using timeframe selector instead of full date picker for simplicity. Matches pattern used in BuyerActivityTab

4. **Lead attribution extraction**: Parsing `complianceData` JSON to extract `attribution.ref` for affiliate tracking. This matches how affiliates are tracked in the lead flow

5. **Revenue chart**: Simple horizontal bar chart instead of complex charting library - sufficient for this use case and maintains consistency with admin UI patterns

---

## Response to PX/ADT (Template)

> Hi,
>
> Thanks for setting this up! Here's what we need:
>
> **Questions:**
> 1. What's the maximum character length for aff_sub2? We use 36-character UUIDs for lead tracking.
> 2. For postback authentication, do you support IP whitelisting or a secret token parameter? What IPs should we whitelist?
> 3. What format will the payout be in? (e.g., "45.00" string, integer, etc.)
>
> **Once confirmed, we'll provide:**
> 1. Our postback URL
> 2. A test link for validation
>
> Thanks!
