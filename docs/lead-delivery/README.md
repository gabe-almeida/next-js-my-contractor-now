# Lead Delivery System

## Overview

The lead delivery system is responsible for distributing submitted leads to network lead buyers through a PING/POST auction mechanism. The system includes comprehensive Sentry breadcrumb tracking for debugging and monitoring.

**Why it exists**: Connect homeowners with contractors by auctioning leads to the highest bidder in real-time.

**Key components**:
- Form submission API (`src/app/api/leads/route.ts`)
- Auction engine (`src/lib/auction/engine.ts`)
- Buyer eligibility service (`src/lib/services/buyer-eligibility-service.ts`)
- Field mapping & transformations (`src/lib/templates/engine.ts`)

---

## Sentry Breadcrumb Tracking

**What are breadcrumbs?**
Breadcrumbs are lightweight event logs captured at key points in the auction flow. When an error occurs, Sentry includes the last ~100 breadcrumbs to show the sequence of events leading up to the error.

**Why we use them**:
- Debug stuck leads (leads that don't transition from PROCESSING)
- Understand why buyers are excluded from auctions
- Track auction timing and performance
- Identify compliance requirement failures

### Breadcrumb Categories

All breadcrumbs use one of these categories:
- `auction` - Main auction flow events
- `eligibility` - Buyer filtering and eligibility checks
- `compliance` - Compliance requirement validation
- `transformation` - Field mapping and payload transformation

---

## Auction Flow with Breadcrumbs

### 1. Lead Submission → setTimeout

**File**: `src/app/api/leads/route.ts:450-578`

```
User submits form
  ↓
API validates and saves lead to DB (status: PENDING)
  ↓
setTimeout(async () => { ... }, 0)  ← Fire-and-forget background process
  ↓
breadcrumb: "setTimeout callback started"
  ↓
Lead status → PROCESSING
  ↓
breadcrumb: "Lead status set to PROCESSING"
```

**Breadcrumbs captured**:
- `setTimeout callback started` - Confirms setTimeout executed
- `Lead status set to PROCESSING` - Confirms status transition

**Why setTimeout?** Allows API to return 200 OK immediately while processing auction in background (no Redis queues needed).

**Timeout protection**: 60-second Promise.race() wrapper prevents leads from staying in PROCESSING forever.

---

### 2. Buyer Eligibility Filtering

**File**: `src/lib/services/buyer-eligibility-service.ts`

```
getEligibleBuyers(filter)
  ↓
Load buyers from service zones (zip-based)
  ↓
breadcrumb: "Service zones retrieved" (count + buyer list)
  ↓
Load nationwide buyers (nationwide=true OR no zip restrictions)
  ↓
breadcrumb: "Nationwide buyers retrieved" (count + buyer list)
  ↓
Merge and dedupe buyers
  ↓
Check each buyer's eligibility (daily cap, time restrictions, etc.)
  ↓
breadcrumb: "Buyer excluded from eligibility" (for each excluded buyer)
  ↓
breadcrumb: "Buyer eligibility result" (final counts + exclusion reasons)
```

**Breadcrumbs captured**:
- `Service zones retrieved` - Zip-matched buyers found
- `Nationwide buyers retrieved` - Buyers participating regardless of zip
- `No buyers found for eligibility` - When BOTH zip-matched and nationwide return empty
- `Buyer excluded from eligibility` - Individual buyer exclusion with reason
- `Buyer eligibility result` - Final summary with exclusion reason counts

**Common exclusion reasons**:
- `DAILY_CAP_REACHED` - Buyer hit max leads per day
- `TIME_RESTRICTION` - Outside buyer's operating hours
- `MIN_BID_NOT_MET` - Lead value below buyer's minimum
- `BUYER_PAUSED` - Buyer temporarily disabled

---

### 3. Nationwide Buyer Logic

**File**: `src/lib/services/buyer-eligibility-service.ts:653-756`

```
getNationwideBuyers(serviceTypeId)
  ↓
Load buyer_service_configs WHERE active=true
  ↓
breadcrumb: "Service configs retrieved for nationwide check"
  ↓
For each buyer config:
    Check if nationwide=true (explicit)
      OR
    Check if buyer_service_zip_codes count = 0 (implicit nationwide)
    ↓
    breadcrumb: "Checking buyer for nationwide eligibility"
                (includes nationwide flag, zip count, inclusion decision)
    ↓
    If qualifies: Add to eligible buyers
  ↓
breadcrumb: "Nationwide buyers result" (final count + buyer list)
```

**Key insight**: Koalaty Leads should appear here if:
1. `buyer_service_configs.active = true` for their windows service
2. `buyer_service_configs.nationwide = true`
   OR `buyer_service_zip_codes` has zero rows for Koalaty + windows

**Breadcrumbs captured**:
- `Service configs retrieved for nationwide check` - All active configs loaded
- `No service configs found for nationwide check` - When query returns empty
- `Checking buyer for nationwide eligibility` - Per-buyer nationwide decision
- `Nationwide buyers result` - Final nationwide buyers included

---

### 4. Compliance Requirements Check

**File**: `src/lib/auction/engine.ts:1605-1642`

```
For each eligible buyer:
  ↓
checkComplianceRequirements(lead, buyer, serviceConfig)
  ↓
Check if buyer requires:
  - TrustedForm certificate (requireTrustedForm)
  - Jornaya lead ID (requireJornaya)
  - TCPA consent (requireTcpaConsent)
  ↓
If ANY required field is missing:
  ↓
  breadcrumb: "Buyer skipped - compliance"
            (includes missing field details)
  ↓
  Buyer excluded from auction
```

**Breadcrumbs captured**:
- `Buyer skipped - compliance` - When buyer excluded due to missing compliance data

**Data checked**:
```typescript
{
  hasTcpaConsent: !!lead.complianceData?.tcpaConsent,
  hasTrustedForm: !!lead.trustedFormCertId,
  hasJornaya: !!lead.jornayaLeadId
}
```

---

### 5. PING/POST Execution

**File**: `src/lib/auction/engine.ts`

```
For each compliant buyer:
  ↓
Send PING request
  ↓
If accepted: Send POST request
  ↓
Record transaction in DB
  ↓
breadcrumb: "Auction completed" (status, winner, participant count)
```

**Breadcrumbs captured**:
- `Auction completed` - Final auction result with winner and stats

---

## Troubleshooting with Breadcrumbs

### Problem: Lead stuck in PROCESSING

**Check breadcrumbs for**:
1. ✅ "setTimeout callback started" - Did setTimeout fire?
2. ✅ "Lead status set to PROCESSING" - Did status update?
3. ✅ "Service zones retrieved" - Did eligibility service run?
4. ❌ "Auction timed out" - Did it exceed 60 seconds?

**If missing "setTimeout callback started"**:
- Server restart/OOM killed the process
- setTimeout never fired (old bug, now fixed with timeout wrapper)

**If present but no "Auction completed"**:
- Check for "Auction timed out" breadcrumb
- Look for errors in Sentry event

---

### Problem: No eligible buyers found

**Check breadcrumbs for**:
1. "Service zones retrieved" - How many zip-matched buyers?
2. "Nationwide buyers retrieved" - How many nationwide buyers?
3. "Checking buyer for nationwide eligibility" - Are buyers being evaluated?
4. "Buyer skipped - compliance" - Are buyers failing compliance?
5. "Buyer excluded from eligibility" - What exclusion reasons?

**Common causes**:
- **No nationwide buyers**: Check `buyer_service_configs.nationwide` and `buyer_service_zip_codes` count
- **Daily cap**: Look for exclusion reason `DAILY_CAP_REACHED`
- **Time restrictions**: Look for `TIME_RESTRICTION` exclusions
- **Compliance**: Look for "Buyer skipped - compliance" breadcrumbs

---

### Problem: Buyer not participating in auction

**Step 1**: Check "Service configs retrieved for nationwide check"
- Is the buyer's config present?
- Is it marked as active?

**Step 2**: Check "Checking buyer for nationwide eligibility"
- Does the buyer have `isExplicitlyNationwide: true`?
- What is the `zipCount` value?
- Does it say `willInclude: true`?

**Step 3**: Check "Buyer skipped - compliance"
- Is the buyer failing compliance requirements?
- What compliance data is missing?

**Step 4**: Check "Buyer excluded from eligibility"
- What is the exclusion reason?
- Is it daily cap, time restriction, or min bid?

---

## Important Files

| File | Purpose | Lines to Check |
|------|---------|----------------|
| `src/app/api/leads/route.ts` | Lead submission + setTimeout wrapper | 450-578 |
| `src/lib/auction/engine.ts` | Auction orchestration + compliance | 1288-1318, 1605-1642 |
| `src/lib/services/buyer-eligibility-service.ts` | Buyer filtering | 58-224 (getEligibleBuyers), 653-756 (getNationwideBuyers) |
| `src/lib/templates/engine.ts` | Field transformations | All |

---

## Gotchas

1. **Nationwide buyers**: A buyer is nationwide if `nationwide=true` OR `buyer_service_zip_codes` is empty for that service type
2. **Compliance failures are SILENT**: Buyers skip auction, breadcrumbs are the only trace
3. **Daily cap resets at midnight UTC**: Check `getDailyLeadCount()` to see current count
4. **Service configs must be active**: Both `buyer_service_configs.active` AND `buyers.active` must be true
5. **setTimeout can fail**: Server restarts/OOM can kill background processes (60s timeout mitigates this)

---

## Testing Eligibility

Use test scripts to debug eligibility:

```bash
# Test specific buyer's config
npx tsx scripts/check-koalaty-config.ts

# Test eligibility for service + zip
npx tsx scripts/test-eligibility.ts

# Check specific lead details
npx tsx scripts/check-lead.ts
```

---

## Next Steps

If you're debugging a stuck/rejected lead:

1. **Get the lead ID** from the user or database
2. **Find the Sentry event** for that lead submission
3. **Review breadcrumbs** in chronological order
4. **Look for early exits**: Missing breadcrumbs indicate where flow stopped
5. **Check exclusion reasons**: "Buyer excluded from eligibility" shows why buyers didn't participate
6. **Verify compliance**: "Buyer skipped - compliance" shows missing data
