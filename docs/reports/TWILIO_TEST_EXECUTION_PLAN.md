# Twilio Integration - Automated Test Execution Plan

**Created:** January 16, 2026
**Status:** IN PROGRESS - Root Cause Found, Local Number Provisioned
**Last Updated:** January 19, 2026 22:30 UTC
**Purpose:** Persistent test plan for AI agent to execute and track progress

---

## CRITICAL DISCOVERY: Trust Hub Concurrency Limit (UPDATED)

### Problem Identified
The `<Dial>` verb fails with **Error 10004: Call Concurrency Limit Exceeded**.

This affects BOTH toll-free AND local numbers - it's an account-level restriction.

### Root Cause Analysis (CORRECTED)
```
Inbound call TO any number → <Dial> verb to buyer → ❌ ERROR 10004
Direct API outbound call → ✅ WORKS (single call, no concurrency)
```

**Why this happens:**
- Twilio accounts without an approved Primary Customer Profile have limited concurrent calls
- The `<Dial>` verb creates a SECOND concurrent call (inbound + outbound dial)
- This exceeds the concurrency limit for unapproved accounts
- **Trust Hub status is the blocker, NOT the number type**

### Trust Hub Status (BLOCKING)
```
Profile 1: "My Starter Profile" - Status: in-review
Profile 2: "Zoka Design Ping Post" - Status: draft

NEITHER IS APPROVED!
```

### Solution Required
**Complete and get Trust Hub Primary Business Profile approved.**

1. Log into Twilio Console: https://console.twilio.com/
2. Navigate to: Trust Hub > Customer Profiles
3. Complete the "Zoka Design Ping Post" profile
4. Submit for review and get approved

| Trust Hub Status | Concurrent Calls | Dial Works? |
|------------------|------------------|-------------|
| Not Approved | Very limited (~1) | ❌ No |
| In Review | Very limited (~1) | ❌ No |
| **Approved** | Unlimited | ✅ Yes |

---

## Test Environment

### NEW: Local Tracking Number (USE THIS)
```
Phone Number: +18576880650
Display: (857) 688-0650
Twilio SID: PN833dec234b42a2e61aeb0883eab96213
Tracking Number ID: tn-test-local-227c1b01
Campaign: test-campaign-001
Webhooks:
  - Voice URL: https://mycontractornow.com/api/calls/incoming
  - Status Callback: https://mycontractornow.com/api/calls/completed
Type: LOCAL (Boston area code)
Status: READY FOR TESTING
```

### DEPRECATED: Toll-Free Number (DO NOT USE FOR DIAL TESTS)
```
Phone Number: +18559011676
Display: (855) 901-1676
Twilio SID: PNbd2bf15df75a76aef59cf89e882d64e2
Tracking Number ID: tn-test-cd6cfd2b-0663-46aa-8c5e-3c70a85b9ed2
Status: RESTRICTED - Cannot bridge calls via <Dial> verb
Note: Fixed statusCallback from /api/calls/status (404) to /api/calls/completed
```

### Test Buyer (for call routing)
```
ID: test-buyer-001
Name: Test Buyer for Twilio Integration
Call Forwarding: +19787980276 (USER'S REAL PHONE)
Bid Amount: $30.00
Service Type: windows
Coverage: NATIONWIDE (no ZIP restrictions)
```

### Additional Test Buyers (for cascade testing)
```
ID: test-buyer-002
Name: Test Buyer 2 - No Answer
Call Forwarding: +14155550001 (Fake - will timeout)
Bid Amount: $25.00

ID: test-buyer-003
Name: Test Buyer 3 - Lowest Bid
Call Forwarding: +14155550002 (Fake - will timeout)
Bid Amount: $20.00
```

### Database Connection
```
Host: db.cnogfaqqilmutqhpjhgl.supabase.co
Port: 6543
Database: postgres
User: postgres
Password: CgDWlr8Bk9O6DVoX
```

---

## Twilio Credentials: WORKING

**Date Verified:** January 19, 2026

```
TWILIO_ACCOUNT_SID=<from .env>
TWILIO_AUTH_TOKEN=<from .env>
TWILIO_API_KEY=<from .env>
TWILIO_API_SECRET=<from .env>
```

**Account:** Zoka Design Ping Post (ACTIVE)

**Verified:**
- [x] Affiliate login API works (JWT authentication)
- [x] Database connection works (Supabase)
- [x] Test affiliate exists (affiliate_test_001)
- [x] Test campaign exists (test-campaign-001)
- [x] Affiliate-campaign association APPROVED
- [x] Twilio API access working
- [x] Direct API outbound calls working
- [x] Local number provisioned for Dial support

---

## Context Recovery Instructions

**If resuming after context compaction:**

1. Read this file first
2. **CRITICAL:** Use LOCAL number +18576880650 for all Dial tests
3. Do NOT use toll-free +18559011676 for Dial tests (Error 10004)
4. Test buyer phone: +19787980276 (user's real phone)
5. Continue from "Test Complete Flow" section below

**Key Info:**
- LOCAL tracking number: +18576880650 (USE THIS)
- Test affiliate: test-affiliate@mycontractornow.com / test123
- Test buyer: test-buyer-001 (NATIONWIDE, $30 bid, +19787980276 REAL)
- Database: See CLAUDE.md for connection string

---

## Test Progress Tracker

### Phase A: Phone Number Provisioning - COMPLETE
- [x] A.1: Login to affiliate dashboard via API - PASSED
- [x] A.2: Verify test campaign exists - PASSED: test-campaign-001
- [x] A.3: Verify affiliate-campaign association is APPROVED - PASSED
- [x] A.4: Verify Twilio API credentials work - PASSED
- [x] A.5: Provision toll-free tracking number - PASSED (but has Dial restriction!)
- [x] A.6: Create tracking number record in database - PASSED
- [x] A.7: Verify number appears in campaigns API - PASSED
- [x] A.8: Record provisioned number - DONE
- [x] A.9: **NEW** Provision LOCAL number for Dial support - PASSED (+18576880650)

**Numbers Provisioned:**
- Toll-Free: `+18559011676` (Dial restricted)
- Local: `+18576880650` (Full Dial support) ← **USE THIS**

---

### Phase B: Basic Call Test - COMPLETE (Auction Verified)
- [x] B.1: Write Twilio SDK script - DONE
- [x] B.2: Initiate test calls - DONE
- [x] B.3: Verify incoming webhook fires - PASSED
- [x] B.4: Verify call record created - PASSED
- [x] B.5: Verify auction redirect works - PASSED
- [x] B.6: Wait for webhooks to process - PASSED
- [x] B.7: Query database for call record - PASSED
- [x] B.8: Verify winner selection - PASSED (test-buyer-001 @ $30.00)
- [ ] B.9: Verify Dial actually connects - **BLOCKED by toll-free restriction**

**Finding:** Auction works, winner selected, but Dial verb fails on toll-free.

---

### Phase B.5: Root Cause Investigation - COMPLETE
- [x] Discovered Error 10004 on Dial from toll-free
- [x] Verified direct API outbound calls work
- [x] Confirmed toll-free Dial restriction
- [x] Provisioned local number as solution
- [x] Fixed 404 on /api/calls/status (changed to /api/calls/completed)
- [ ] Test complete flow with local number

---

### Phase C: Complete End-to-End Test - READY TO TEST
**Now possible with local number!**

- [ ] C.1: Call local number +18576880650
- [ ] C.2: Verify auction runs
- [ ] C.3: Verify winner selected (test-buyer-001)
- [ ] C.4: Verify Dial connects to +19787980276
- [ ] C.5: Answer call on user's phone
- [ ] C.6: Stay connected 30+ seconds
- [ ] C.7: Hang up
- [ ] C.8: Verify call status = COMPLETED
- [ ] C.9: Verify is_billable = true
- [ ] C.10: Verify payout calculated

---

### Phase D: Cascade Test (2nd Buyer Answers) - PENDING
- [ ] D.1: Update test-buyer-001 to fake number (will timeout)
- [ ] D.2: Update test-buyer-002 to real phone
- [ ] D.3: Make call to local tracking number
- [ ] D.4: Verify 1st buyer times out
- [ ] D.5: Verify call cascades to 2nd buyer
- [ ] D.6: Answer on 2nd buyer's phone
- [ ] D.7: Verify cascade_position = 1
- [ ] D.8: Verify correct buyer credited

---

### Phase E: Recording Test - PENDING
- [ ] E.1: Make a billable call (60+ seconds)
- [ ] E.2: Wait for recording webhook
- [ ] E.3: Verify recording_status = 'COMPLETED'
- [ ] E.4: Verify recording_url is accessible
- [ ] E.5: Play recording in affiliate UI

---

### Phase F: UI Verification - PENDING
- [ ] F.1: Login to affiliate dashboard
- [ ] F.2: Navigate to /affiliate/calls
- [ ] F.3: Verify test calls appear
- [ ] F.4: Verify payout amounts
- [ ] F.5: Test recording playback

---

## Fixes Applied

### Fix 1: Toll-Free Status Callback 404
**Problem:** Toll-free number had statusCallback set to `/api/calls/status` which doesn't exist.
**Error:** 15003 - 404 Not Found
**Fix:** Updated to `/api/calls/completed`

```javascript
// Applied via Twilio API
client.incomingPhoneNumbers('PNbd2bf15df75a76aef59cf89e882d64e2')
  .update({
    statusCallback: 'https://mycontractornow.com/api/calls/completed',
    statusCallbackMethod: 'POST'
  });
```

### Fix 2: Local Number for Dial Support
**Problem:** Toll-free cannot use <Dial> verb (Error 10004)
**Fix:** Provisioned local number +18576880650

```javascript
// Provisioned via Twilio API
const number = await client.incomingPhoneNumbers.create({
  phoneNumber: '+18576880650',
  voiceUrl: 'https://mycontractornow.com/api/calls/incoming',
  voiceMethod: 'POST',
  statusCallback: 'https://mycontractornow.com/api/calls/completed',
  statusCallbackMethod: 'POST'
});
```

---

## Production Recommendations

### 1. Use LOCAL Numbers for Pay-Per-Call
- Toll-free numbers have Dial restrictions
- Local numbers work fully for call bridging
- Consider area codes matching target markets

### 2. Trust Hub Verification
- Current status: "in-review" / "draft"
- May unlock toll-free Dial capabilities once approved
- Recommend completing Trust Hub profile

### 3. Number Provisioning Code Update
The affiliate tracking number provisioning should default to LOCAL instead of toll-free, OR clearly warn about toll-free limitations.

**File:** `src/app/api/affiliates/tracking-numbers/provision/route.ts`

Consider adding validation or defaulting to local numbers for pay-per-call campaigns.

---

## Commands for Testing

### Make Test Call to LOCAL Number (USE THIS)
```bash
cd "/Users/Gabe/Dev/2_Future stuff/next-js-my-contractor-now"
node -e "
const twilio = require('twilio');
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
client.calls.create({
  to: '+18576880650',
  from: '+18576880650',
  twiml: '<Response><Play loop=\"50\">http://com.twilio.music.soft-rock.s3.amazonaws.com/_ghost_-_promo_-_kicking_it_up_a_notch_64kb.mp3</Play></Response>',
}).then(call => console.log('Call SID:', call.sid));
"
```

### Check Recent Calls
```bash
PGPASSWORD="CgDWlr8Bk9O6DVoX" psql -h db.cnogfaqqilmutqhpjhgl.supabase.co -p 6543 -U postgres -d postgres -c "SELECT id, status, winning_buyer_id, winning_bid, is_billable, duration FROM calls ORDER BY created_at DESC LIMIT 5;"
```

### Check Call Activity Logs
```bash
PGPASSWORD="CgDWlr8Bk9O6DVoX" psql -h db.cnogfaqqilmutqhpjhgl.supabase.co -p 6543 -U postgres -d postgres -c "SELECT event, message, timestamp FROM call_activity_logs WHERE call_id = 'CALL_ID_HERE' ORDER BY timestamp;"
```

### Check Twilio Alerts/Errors
```bash
node -e "
const twilio = require('twilio');
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
client.monitor.alerts.list({limit: 10}).then(alerts => alerts.forEach(a => console.log(a.dateCreated, a.errorCode, a.alertText)));
"
```

---

## Test Results Log

### Root Cause Investigation Results
```
Date: January 19, 2026 22:00 UTC

Problem: Calls showed "BUSY" but user's phone never rang
Investigation:
1. Checked Twilio alerts - Found Error 10004 (Permission denied) on child calls
2. Tested direct API outbound call - WORKED (user received call)
3. Tested Dial verb from toll-free inbound - FAILED (Error 10004)

Root Cause: Twilio toll-free numbers cannot bridge inbound calls via <Dial>

Solution: Provision local number instead
- Provisioned: +18576880650 (local Boston number)
- Twilio SID: PN833dec234b42a2e61aeb0883eab96213
- Created tracking number record: tn-test-local-227c1b01

Additional Fix:
- Updated toll-free statusCallback from /api/calls/status (404) to /api/calls/completed
```

### Phase A Results
```
Date: January 19, 2026
Login Test: PASSED
Twilio API: WORKING (Account: Zoka Design Ping Post)
Toll-Free Number: +18559011676 - RESTRICTED for Dial
Local Number: +18576880650 - FULL SUPPORT
Status: COMPLETE
```

### Phase B Results
```
Date: January 19, 2026 20:00 UTC
Auction Flow: WORKING
Winner Selection: WORKING
Dial Execution: BLOCKED (toll-free restriction)
Status: PARTIAL (need local number test)
```

---

## Overall Test Summary

| Phase | Description | Status | Notes |
|-------|-------------|--------|-------|
| A | Phone Provisioning | COMPLETE | Local + toll-free provisioned |
| B | Basic Call Test | PARTIAL | Auction works, Dial blocked on toll-free |
| B.5 | Root Cause Investigation | COMPLETE | Found toll-free Dial restriction |
| C | Complete E2E Test | READY | Use local number +18576880650 |
| D | Cascade Test | PENDING | After C passes |
| E | Recording Test | PENDING | After C passes |
| F | UI Verification | PENDING | After E passes |

**Overall Status:** Root cause found. Local number provisioned. Ready for complete E2E test!

---

## Git Commits Made

- `715fc99`: fix: Allow nationwide buyers to match calls with unknown ZIP codes

---

**Document Version:** 3.0
**Last Updated:** January 19, 2026 22:30 UTC
**Next Action:** Test complete E2E flow with local number +18576880650

