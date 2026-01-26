# CRITICAL: Twilio Call Concurrency Issue

**Date:** January 19, 2026
**Status:** BLOCKING - Manual Action Required
**Impact:** All call bridging/forwarding is non-functional

---

## Problem Summary

The Twilio Pay-Per-Call system cannot bridge calls to buyers. All `<Dial>` operations fail with **Error 10004: Call Concurrency Limit Exceeded**.

### Symptoms
- Calls to tracking numbers work (inbound)
- Auctions run correctly and select winners
- Transfer TwiML is generated correctly
- BUT: The Dial to buyer's phone FAILS with Error 10004
- Calls show "FAILED" status, is_billable = false

---

## Root Cause

**Trust Hub Profile Not Approved**

Twilio accounts without an approved Primary Customer Profile have limited concurrent calls. The `<Dial>` verb on an inbound call creates a SECOND concurrent call (inbound + outbound dial), which exceeds this limit.

### Current Trust Hub Status
```
Profile 1: "My Starter Profile"
Status: in-review
SID: BUd2c7f33eba7b781f4cc5753eeb37c98d

Profile 2: "Zoka Design Ping Post"
Status: draft
SID: BUd219fa713357d548fe744f6b1f364232
```

**Neither profile is APPROVED**, which means:
- Concurrent call limit is very low (likely 1)
- `<Dial>` verb fails because it tries to create a 2nd concurrent call
- All pay-per-call forwarding is blocked

---

## Solution Required

### Step 1: Complete Trust Hub Primary Business Profile

1. Log into Twilio Console: https://console.twilio.com/
2. Navigate to: Trust Hub > Customer Profiles
3. Complete the "Zoka Design Ping Post" profile (currently in "draft")
4. Submit for review

### Step 2: Wait for Approval

- Twilio typically reviews within 1-3 business days
- May require additional documentation (business registration, etc.)

### Step 3: Verify Approval

Once approved, test with:
```bash
cd "/Users/Gabe/Dev/2_Future stuff/next-js-my-contractor-now"
node -e "
const twilio = require('twilio');
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
client.calls.create({
  to: '+18576880650',
  from: '+18576880650',
  twiml: '<Response><Say>Test</Say><Pause length=\"60\"/></Response>'
}).then(call => console.log('Call SID:', call.sid));
"
```

Then answer the call on your phone +19787980276 to verify bridging works.

---

## Verified Working Components

| Component | Status | Notes |
|-----------|--------|-------|
| Tracking Number Provisioning | WORKING | Both toll-free and local |
| Incoming Call Webhook | WORKING | /api/calls/incoming fires correctly |
| Call Record Creation | WORKING | Calls saved to database |
| Auction System | WORKING | Runs correctly, selects winner |
| Winner Selection | WORKING | Highest bidder selected |
| Bid Recording | WORKING | Bids saved to call_bids table |
| Activity Logging | WORKING | Full flow logged |
| Transfer TwiML | WORKING | Correct TwiML generated |
| Direct Outbound Calls | WORKING | API calls succeed |
| **Call Bridging (<Dial>)** | BLOCKED | Error 10004 - Concurrency limit |

---

## Test Environment

### Tracking Numbers
```
Local (use this): +18576880650
Toll-Free: +18559011676 (also blocked, same reason)
```

### Test Buyer
```
ID: test-buyer-001
Phone: +19787980276 (user's real phone)
Bid: $30.00
```

### Commands to Test After Approval

```bash
# Make test call
cd "/Users/Gabe/Dev/2_Future stuff/next-js-my-contractor-now"
node -e "
const twilio = require('twilio');
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
client.calls.create({
  to: '+18576880650',
  from: '+18576880650',
  twiml: '<Response><Say voice=\"alice\">Test call. Please hold.</Say><Pause length=\"60\"/></Response>'
}).then(call => console.log('Call SID:', call.sid));
"

# Check call status
PGPASSWORD="CgDWlr8Bk9O6DVoX" psql -h db.cnogfaqqilmutqhpjhgl.supabase.co -p 6543 -U postgres -d postgres -c "SELECT id, status, winning_buyer_id, is_billable FROM calls ORDER BY created_at DESC LIMIT 3;"

# Check for Twilio errors
node -e "
const twilio = require('twilio');
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
client.monitor.alerts.list({limit: 5}).then(alerts => alerts.forEach(a => console.log(a.dateCreated, a.errorCode, a.alertText)));
"
```

---

## Investigation Timeline

| Time | Finding |
|------|---------|
| Initial | Calls showed "BUSY" but buyer phone never rang |
| 20:14 | Found Error 10004 on Dial verb |
| 20:23 | Confirmed auction works, winner selected |
| 20:35 | Tested direct API outbound - WORKS |
| 20:36 | Tested Dial from inbound - FAILS |
| 20:36 | Found Error 10004 = "Call Concurrency Limit Exceeded" |
| 20:37 | Checked Trust Hub - profiles NOT approved |

---

## Code Status

**No code changes required.** The implementation is correct. The issue is purely Twilio account configuration.

### Files Verified Working
- `src/app/api/calls/incoming/route.ts` - Entry point
- `src/app/api/calls/auction/route.ts` - Auction and Dial
- `src/lib/twilio/twiml-builder.ts` - TwiML generation
- `src/app/api/calls/completed/route.ts` - Call completion

---

## Next Steps After Trust Hub Approval

1. **Test complete E2E flow**
   - Make call to tracking number
   - Verify auction selects winner
   - Verify Dial connects to buyer
   - Answer call, stay 30+ seconds
   - Verify is_billable = true

2. **Test cascade functionality**
   - Configure multiple buyers
   - Test buyer timeout and cascade

3. **Test recording**
   - Make billable call
   - Verify recording captured
   - Verify recording accessible

4. **Complete UI verification**
   - Verify calls in affiliate dashboard
   - Verify payouts calculated

---

**ACTION REQUIRED: Complete Twilio Trust Hub Primary Business Profile and get it approved.**
