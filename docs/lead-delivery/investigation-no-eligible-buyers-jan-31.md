# Investigation: "No Eligible Buyers" Issue (Jan 29 - Feb 2, 2026)

## Problem Statement

Multiple leads from Jan 29 onwards received "No eligible buyers found for auction" or "No winning bids received" errors, despite buyers being properly configured and active.

---

## Timeline of Events

| Date | Leads | Sold | Rejected | Issue |
|------|-------|------|----------|-------|
| Jan 28 | 4 | 2 | 1 | ✅ Normal - Modernize winning leads |
| Jan 29 | 2 | 0 | 2 | ⚠️ "No winning bids received" |
| Jan 30 | 1 | 0 | 1 | ⚠️ Stuck in PROCESSING (manually fixed) |
| Jan 31 | 1 | 0 | 1 | 🔴 "No eligible buyers" + ZERO transactions |
| Feb 2 | 1 | 0 | 1 | ⚠️ Transformation failures, then buyer PINGs |

---

## Investigation Results

### 1. Daily Cap Hypothesis ❌ RULED OUT

**Test**: Queried transaction counts for all buyers on Feb 2.

**Results**:
- Koalaty Leads: 2 transactions today
- Home Appointments: 2 transactions today
- Modernize: 3 transactions today
- Test buyers: 0 transactions today

**Conclusion**: No buyers are hitting daily caps. All are well below any reasonable limit.

---

### 2. Buyer Config Inactive Hypothesis ❌ RULED OUT

**Test**: Checked buyer_service_configs creation dates and active status.

**Results**:
| Buyer | Config Created | Active | Nationwide |
|-------|---------------|--------|------------|
| Modernize | 2026-01-13 | ✅ true | ✅ true |
| Koalaty Leads | 2026-01-24 | ✅ true | ✅ true |
| Home Appointments | 2026-01-27 | ✅ true | ✅ true |
| Test buyers | 2026-01-16 to 01-19 | ✅ true | ❌ false (implicit nationwide via zipCount=0) |

**Conclusion**: All configs were active weeks before Jan 31. Not a configuration issue.

---

### 3. Nationwide Buyer Logic Hypothesis ❌ RULED OUT

**Test**: Ran BuyerEligibilityService.getEligibleBuyers() for Jan 30 and Jan 31 zip codes.

**Results - Jan 30 Zip (48317)**:
- Total Found: 7
- Eligible: 7
- Excluded: 0
- Buyers: Koalaty (zip match + nationwide), Modernize (zip match + nationwide), Home Appointments (nationwide), 4 test buyers (implicit nationwide)

**Results - Jan 31 Zip (39047)**:
- Total Found: 7
- Eligible: 7
- Excluded: 0
- Buyers: Koalaty (zip match + nationwide), Modernize (zip match + nationwide), Home Appointments (nationwide), 4 test buyers (implicit nationwide)

**Conclusion**: Nationwide buyer logic is working correctly. TODAY, these zip codes return 7 eligible buyers each.

---

### 4. Time Restrictions Hypothesis ⚠️ POSSIBLE

**Observation**: Jan 31 lead was submitted at **03:26:14 UTC** (10:26 PM EST / 7:26 PM PST on Jan 30).

**Known**: Buyers may have operating hours configured (e.g., "9 AM - 6 PM EST").

**Status**: No time restriction configurations found in database schema (no `timeRestrictions` column in `buyer_service_configs` or `buyers` tables).

**Conclusion**: Time restrictions may have been enforced in code, but cannot verify from database. Unlikely to be the cause given current schema.

---

### 5. Compliance Check Bug Hypothesis ⚠️ PARTIAL MATCH

**Observation**: Feb 2 lead (97635) had multiple transformation failures:
- Error: "Transformation failed: Cannot read properties of undefined (reading 'name')"
- Affected all 3 buyers: Home Appointments, Modernize, Koalaty Leads

**Impact**: First PING attempt failed for all buyers due to transformation bug.

**Recovery**: Second PING attempt (2 minutes later) succeeded for Modernize.

**Conclusion**: There WAS a transformation bug affecting buyers, but it was intermittent and recovered. This explains the Feb 2 lead issues.

---

## Key Findings

### Jan 29 Leads: "No winning bids received"
- **Transactions**: Buyers participated but all declined
- **Likely cause**: Buyers received PINGs, evaluated leads, chose not to bid
- **Status**: Normal business logic

### Jan 30 Lead: Stuck in PROCESSING
- **Transactions**: ZERO
- **Likely cause**: setTimeout callback never executed (server restart/OOM)
- **Fix**: Added 60-second timeout wrapper + Sentry breadcrumbs
- **Status**: Fixed in commit 68030c5

### Jan 31 Lead: "No eligible buyers found for auction"
- **Transactions**: ZERO
- **Current test**: Returns 7 eligible buyers for same zip code
- **Likely cause**: Temporary issue on Jan 31 that has since resolved
- **Possible causes**:
  1. Server outage/restart during eligibility check
  2. Database connection issue
  3. Redis cache returning stale empty result
  4. Brief configuration change that was reverted

**Status**: Cannot reproduce. System currently working correctly.

### Feb 2 Lead: Transformation failures
- **Transactions**: 7 (3 failed transformations, 3 PINGs, 1 POST)
- **Cause**: Field transformation bug: "Cannot read properties of undefined (reading 'name')"
- **Recovery**: Self-healed after 2 minutes
- **Status**: Transformation bug needs investigation

---

## Recommendations

### Immediate Actions

1. **Monitor transformation errors** - Set up Sentry alert for "Cannot read properties of undefined" in transformation code
2. **Review field mapping logic** - Check src/lib/templates/engine.ts for undefined property access
3. **Add more breadcrumbs** - ✅ Already done in commit 3d11589

### Long-term Improvements

1. **Add daily cap configurations** - Currently unlimited, should have buyer-specific caps
2. **Add time restriction configurations** - Allow buyers to set operating hours
3. **Improve cache invalidation** - Ensure Redis doesn't serve stale eligibility results
4. **Add health check for eligibility service** - Alert when getEligibleBuyers() returns empty unexpectedly

---

## Test Results (Feb 2, 2026 23:45 UTC)

### Eligibility Service Test - Jan 30 Zip (48317)
```
Total Found: 7
Eligible count: 7
Excluded count: 0

Eligible Buyers:
- Koalaty Leads (zip match, score: 102.18)
- Modernize (zip match, score: 14.02)
- Home Appointments (nationwide, score: 100)
- Bid Defaults Test (implicit nationwide, score: 100)
- Test Primary Contractor (implicit nationwide, score: 100)
- Test Secondary Contractor (implicit nationwide, score: 100)
- Test Tertiary Contractor (implicit nationwide, score: 100)
```

### Eligibility Service Test - Jan 31 Zip (39047)
```
Total Found: 7
Eligible count: 7
Excluded count: 0

Eligible Buyers:
- Koalaty Leads (zip match, score: 102.18)
- Modernize (zip match, score: 13.02)
- Home Appointments (nationwide, score: 100)
- Bid Defaults Test (implicit nationwide, score: 100)
- Test Primary Contractor (implicit nationwide, score: 100)
- Test Secondary Contractor (implicit nationwide, score: 100)
- Test Tertiary Contractor (implicit nationwide, score: 100)
```

**Conclusion**: System is currently healthy and returning buyers correctly.

---

## Related Commits

- `68030c5` - feat: Add 60s timeout and Sentry breadcrumbs to auction flow
- `3d11589` - feat: Add comprehensive Sentry breadcrumbs to buyer eligibility system

---

## Next Steps

1. **Wait for new lead submissions** with breadcrumbs enabled to see real-time eligibility filtering
2. **Monitor Sentry** for new "No eligible buyers" events with breadcrumb traces
3. **Investigate transformation bug** - Find root cause of undefined 'name' property access
4. **Review Feb 2 lead** - Why did Koalaty and Home Appointments fail PINGs after transformation succeeded?
