# Call Flow Architecture

> **Section:** 03 | **Phase:** 1 (MVP)
> **Parent:** [spec.md](../spec.md)

---

## Overview

This section details the complete call flow from incoming call through auction to transfer and completion.

## End-to-End Call Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           COMPLETE CALL FLOW                                     │
└─────────────────────────────────────────────────────────────────────────────────┘

PHASE 1: CALL INITIATION
═════════════════════════

  ┌─────────────┐         ┌─────────────────┐         ┌─────────────────┐
  │   Caller    │         │   Affiliate's   │         │    Twilio       │
  │   sees ad   │────────▶│   Tracking #    │────────▶│    receives     │
  │   dials     │         │   in ad         │         │    call         │
  └─────────────┘         └─────────────────┘         └────────┬────────┘
                                                               │
                                                               │ Webhook
                                                               ▼
PHASE 2: CALL INGESTION
═══════════════════════

  ┌─────────────────────────────────────────────────────────────────────────────┐
  │                                                                              │
  │   POST /api/calls/incoming                                                   │
  │                                                                              │
  │   Twilio sends:                                                              │
  │   {                                                                          │
  │     "CallSid": "CA1234567890",                                              │
  │     "From": "+15551234567",           // Caller's phone (CID)               │
  │     "To": "+18445551234",             // Our tracking number                │
  │     "FromCity": "Los Angeles",                                              │
  │     "FromState": "CA",                                                      │
  │     "FromZip": "90210",               // Caller's ZIP (if available)        │
  │     "CallerName": "John Doe"          // CNAM (if available)                │
  │   }                                                                          │
  │                                                                              │
  │   Our system:                                                                │
  │   1. Lookup tracking_number → get affiliate_id, campaign_id, service_type   │
  │   2. Check campaign active, within hours, under daily cap                   │
  │   3. Create call record (status: RINGING)                                   │
  │   4. If IVR configured → go to Phase 3                                      │
  │   5. If no IVR → skip to Phase 4                                            │
  │                                                                              │
  └─────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
PHASE 3: IVR QUALIFICATION (Optional)
═════════════════════════════════════

  ┌─────────────────────────────────────────────────────────────────────────────┐
  │                                                                              │
  │   Return TwiML for IVR:                                                      │
  │                                                                              │
  │   <Response>                                                                 │
  │     <Gather action="/api/calls/ivr" numDigits="1" timeout="10">             │
  │       <Say>                                                                  │
  │         Thank you for calling. To connect with a specialist,                │
  │         press 1 if you own your home, or press 2 if you rent.               │
  │       </Say>                                                                 │
  │     </Gather>                                                                │
  │     <Say>We didn't receive a response. Goodbye.</Say>                       │
  │     <Hangup/>                                                                │
  │   </Response>                                                                │
  │                                                                              │
  │   IVR Response Handler:                                                      │
  │   - Parse DTMF digits                                                        │
  │   - Update call.ivr_responses JSON                                          │
  │   - Mark call.is_qualified = true/false                                     │
  │   - If qualified → proceed to Phase 4                                       │
  │   - If not qualified → play rejection message, hang up                      │
  │                                                                              │
  └─────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
PHASE 4: REAL-TIME AUCTION (Parallel)
═════════════════════════════════════

  ┌─────────────────────────────────────────────────────────────────────────────┐
  │                                                                              │
  │   Play hold message while auction runs:                                      │
  │   <Say>Please hold while we connect you with a specialist...</Say>          │
  │   <Play loop="0">hold_music.mp3</Play>  (background)                        │
  │                                                                              │
  │   ┌────────────────────────────────────────────────────────────────────┐    │
  │   │                    AUCTION ENGINE                                   │    │
  │   │                                                                     │    │
  │   │   1. BuyerEligibilityService.getEligibleBuyers({                   │    │
  │   │        serviceTypeId: "windows",                                    │    │
  │   │        zipCode: "90210",                                            │    │
  │   │        type: "CALL"           ← Filter for call buyers             │    │
  │   │      })                                                             │    │
  │   │                                                                     │    │
  │   │   2. Results:                                                       │    │
  │   │      ├── Contractor A: $55 (instant - from buyer_service_configs)  │    │
  │   │      ├── Contractor B: $48 (instant)                               │    │
  │   │      ├── Modernize: PING required                                  │    │
  │   │      └── HomeAdvisor: PING required                                │    │
  │   │                                                                     │    │
  │   │   3. Parallel execution:                                            │    │
  │   │                                                                     │    │
  │   │      Promise.allSettled([                                           │    │
  │   │        // Contractors - instant                                     │    │
  │   │        { buyer: "Contractor A", bid: 55 },                         │    │
  │   │        { buyer: "Contractor B", bid: 48 },                         │    │
  │   │                                                                     │    │
  │   │        // Networks - PING with 2s timeout                          │    │
  │   │        pingNetwork("Modernize", { CID, zipCode }),                 │    │
  │   │        pingNetwork("HomeAdvisor", { CID, zipCode })                │    │
  │   │      ])                                                             │    │
  │   │                                                                     │    │
  │   │   4. After 2 seconds (timeout):                                     │    │
  │   │      ├── Contractor A: $55                                         │    │
  │   │      ├── Contractor B: $48                                         │    │
  │   │      ├── Modernize: $52 (responded in 180ms)                       │    │
  │   │      └── HomeAdvisor: $58 (responded in 450ms)  ← WINNER           │    │
  │   │                                                                     │    │
  │   │   5. Select winner: HomeAdvisor @ $58                              │    │
  │   │                                                                     │    │
  │   └────────────────────────────────────────────────────────────────────┘    │
  │                                                                              │
  │   Total auction time: ~2 seconds                                            │
  │                                                                              │
  └─────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
PHASE 5: CALL TRANSFER
══════════════════════

  ┌─────────────────────────────────────────────────────────────────────────────┐
  │                                                                              │
  │   A) TRANSFER TO CONTRACTOR:                                                 │
  │   ────────────────────────────                                              │
  │   <Response>                                                                 │
  │     <Dial                                                                    │
  │       callerId="+15551234567"           // Pass through caller ID           │
  │       record="record-from-ringing-dual"  // Record both sides               │
  │       action="/api/calls/completed"      // Callback when done              │
  │       timeout="30"                                                           │
  │     >                                                                        │
  │       <Number>+15559876543</Number>      // Contractor's number             │
  │     </Dial>                                                                  │
  │   </Response>                                                                │
  │                                                                              │
  │   B) TRANSFER TO NETWORK (Ringba RTB):                                       │
  │   ──────────────────────────────────────                                    │
  │   <Response>                                                                 │
  │     <Dial                                                                    │
  │       callerId="+15551234567"                                               │
  │       record="record-from-ringing-dual"                                     │
  │       action="/api/calls/completed"                                         │
  │       timeout="30"                                                           │
  │     >                                                                        │
  │       <Number>+18005551234</Number>      // From Ringba PING response       │
  │     </Dial>                                                                  │
  │   </Response>                                                                │
  │                                                                              │
  │   Update call record:                                                        │
  │   - status: CONNECTED                                                        │
  │   - winning_buyer_id: "buyer-uuid"                                          │
  │   - winning_bid: 58.00                                                       │
  │   - connected_at: NOW()                                                      │
  │                                                                              │
  │   Log transaction:                                                           │
  │   - action_type: CALL_TRANSFER                                              │
  │   - buyer_id, lead_id (call_id), bid_amount, etc.                           │
  │                                                                              │
  └─────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
PHASE 6: CALL COMPLETION
════════════════════════

  ┌─────────────────────────────────────────────────────────────────────────────┐
  │                                                                              │
  │   POST /api/calls/completed (Twilio callback)                                │
  │                                                                              │
  │   Twilio sends:                                                              │
  │   {                                                                          │
  │     "CallSid": "CA1234567890",                                              │
  │     "CallDuration": "245",           // Total seconds                       │
  │     "DialCallDuration": "230",       // Connected portion                   │
  │     "DialCallStatus": "completed",   // completed, busy, no-answer, failed  │
  │     "RecordingUrl": "https://api.twilio.com/recordings/RE..."               │
  │   }                                                                          │
  │                                                                              │
  │   Our system:                                                                │
  │   1. Update call record:                                                     │
  │      - status: COMPLETED                                                     │
  │      - ended_at: NOW()                                                       │
  │      - duration_seconds: 230                                                 │
  │      - disposition: "ANSWERED"                                               │
  │      - recording_url: "https://..."                                          │
  │                                                                              │
  │   2. Determine if call qualifies for payout:                                 │
  │      - duration >= campaign.min_call_duration (e.g., 90 seconds)            │
  │      - disposition = "ANSWERED" or "COMPLETED"                              │
  │      - If IVR required, is_qualified = true                                 │
  │                                                                              │
  │   3. If qualified:                                                           │
  │      - Credit affiliate: campaign.base_payout (e.g., $35)                   │
  │      - Debit buyer: winning_bid (e.g., $58)                                 │
  │      - Platform margin: $23                                                  │
  │      - Send postback to affiliate if configured                             │
  │                                                                              │
  │   4. Log final transaction:                                                  │
  │      - action_type: CALL_COMPLETE                                           │
  │      - Include all financial data                                            │
  │                                                                              │
  └─────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
PHASE 7: RECORDING AVAILABLE
════════════════════════════

  ┌─────────────────────────────────────────────────────────────────────────────┐
  │                                                                              │
  │   POST /api/calls/recording (Twilio callback - async)                        │
  │                                                                              │
  │   {                                                                          │
  │     "CallSid": "CA1234567890",                                              │
  │     "RecordingSid": "RE9876543210",                                         │
  │     "RecordingUrl": "https://api.twilio.com/...",                           │
  │     "RecordingDuration": "230",                                             │
  │     "RecordingStatus": "completed"                                          │
  │   }                                                                          │
  │                                                                              │
  │   Our system:                                                                │
  │   1. Download recording from Twilio                                          │
  │   2. Upload to our S3/storage                                                │
  │   3. Update call.recording_url with our URL                                  │
  │   4. (Optional) Transcribe for QA                                            │
  │                                                                              │
  └─────────────────────────────────────────────────────────────────────────────┘
```

## Cascade Delivery

If the winning buyer doesn't answer or rejects, we cascade to the next highest bidder:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           CALL CASCADE LOGIC                                     │
└─────────────────────────────────────────────────────────────────────────────────┘

Ranked bids from auction:
  1. HomeAdvisor @ $58     ← Try first
  2. Contractor A @ $55    ← Try if #1 fails
  3. Modernize @ $52       ← Try if #2 fails
  4. Contractor B @ $48    ← Try if #3 fails

Transfer attempt:
  │
  ├─ Dial HomeAdvisor...
  │   └─ No answer after 30 seconds
  │      └─ DialCallStatus: "no-answer"
  │
  ├─ Dial Contractor A...
  │   └─ Answered! Call connected.
  │      └─ Winner: Contractor A @ $55
  │
  └─ (No further attempts needed)

TwiML for cascade:
──────────────────
We use action callbacks for each attempt:

<Dial action="/api/calls/cascade?position=1" timeout="25">
  <Number>+1winner</Number>
</Dial>

If dial fails, /api/calls/cascade returns new TwiML for next buyer.
```

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/calls/incoming` | POST | Twilio webhook - incoming call |
| `/api/calls/ivr` | POST | Handle IVR DTMF responses |
| `/api/calls/cascade` | POST | Handle cascade to next buyer |
| `/api/calls/completed` | POST | Call completion callback |
| `/api/calls/recording` | POST | Recording available callback |

---

## Call State Machine (CRITICAL)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         CALL STATE MACHINE                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│                              ┌───────────┐                                       │
│                              │  RINGING  │                                       │
│                              └─────┬─────┘                                       │
│                                    │                                             │
│                    ┌───────────────┼───────────────┐                            │
│                    │               │               │                            │
│                    ▼               ▼               ▼                            │
│              ┌──────────┐    ┌──────────┐    ┌──────────────┐                   │
│              │   IVR    │    │ BIDDING  │    │ CALLER_HANGUP│ (terminal)        │
│              └────┬─────┘    └────┬─────┘    └──────────────┘                   │
│                   │               │                                              │
│           ┌───────┼───────┐       │                                              │
│           │       │       │       │                                              │
│           ▼       ▼       ▼       │                                              │
│     ┌──────────┐ ┌───────┐ ┌──────────────┐                                     │
│     │ BIDDING  │ │REJECTED│ │CALLER_HANGUP│                                     │
│     └────┬─────┘ └───────┘ └──────────────┘                                     │
│          │        (term)        (term)                                           │
│          │                                                                       │
│    ┌─────┼─────────────────┐                                                    │
│    │     │                 │                                                    │
│    ▼     ▼                 ▼                                                    │
│ ┌──────────┐ ┌──────────┐ ┌──────────────┐                                      │
│ │CONNECTING│ │ NO_BIDS  │ │CALLER_HANGUP│                                       │
│ └────┬─────┘ └──────────┘ └──────────────┘                                      │
│      │          (term)         (term)                                           │
│      │                                                                          │
│  ┌───┼───────────────┐                                                          │
│  │   │               │                                                          │
│  ▼   ▼               ▼                                                          │
│ ┌──────────┐ ┌──────────┐ ┌──────────────┐                                      │
│ │CONNECTED │ │CASCADING │ │  NO_ANSWER   │                                      │
│ └────┬─────┘ └────┬─────┘ └──────────────┘                                      │
│      │            │              (term - all cascades exhausted)                │
│      │            └──────────┐                                                  │
│      │                       ▼                                                  │
│      │               ┌──────────────┐                                           │
│      │               │  CONNECTED   │ (cascade success)                         │
│      │               └──────────────┘                                           │
│      │                                                                          │
│      ▼                                                                          │
│ ┌──────────┐                                                                    │
│ │COMPLETED │ (terminal)                                                         │
│ └──────────┘                                                                    │
│                                                                                  │
│ Terminal states: COMPLETED, FAILED, REJECTED, CALLER_HANGUP, NO_BIDS, NO_ANSWER │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### State Transition Rules

```typescript
// src/lib/call/state-machine.ts

export const VALID_TRANSITIONS: Record<CallStatus, CallStatus[]> = {
  RINGING: ['IVR', 'BIDDING', 'FAILED', 'CALLER_HANGUP'],
  IVR: ['BIDDING', 'REJECTED', 'CALLER_HANGUP', 'FAILED'],
  BIDDING: ['CONNECTING', 'NO_BIDS', 'CALLER_HANGUP', 'FAILED'],
  CONNECTING: ['CONNECTED', 'CASCADING', 'FAILED', 'NO_ANSWER', 'CALLER_HANGUP'],
  CASCADING: ['CONNECTED', 'NO_ANSWER', 'FAILED', 'CALLER_HANGUP'],
  CONNECTED: ['COMPLETED', 'FAILED'],
  // Terminal states - no outgoing transitions
  COMPLETED: [],
  FAILED: [],
  REJECTED: [],
  CALLER_HANGUP: [],
  NO_BIDS: [],
  NO_ANSWER: [],
};

export function isTerminalState(status: CallStatus): boolean {
  return VALID_TRANSITIONS[status]?.length === 0;
}
```

---

## Race Condition Prevention

### Caller Hangup During IVR/Auction (CRITICAL)

```typescript
// WHY: Caller can hang up at any point. We must detect this BEFORE
//      proceeding with auction or transfer to avoid charging buyers.
// WHEN: Before starting auction, before transfer.
// HOW: Check call status with Twilio API.

// src/lib/call/call-status-checker.ts

export async function isCallStillActive(callSid: string): Promise<boolean> {
  try {
    const call = await twilioClient.calls(callSid).fetch();
    return ['queued', 'ringing', 'in-progress'].includes(call.status);
  } catch (error) {
    logger.warn(`Failed to check call status: ${error}`);
    return false; // Assume inactive on error
  }
}

// Usage in auction:
async function runAuction(call: Call): Promise<AuctionResult> {
  // Check BEFORE starting auction
  if (!await isCallStillActive(call.twilioCallSid)) {
    await updateCallStatus(call.id, 'CALLER_HANGUP', {
      abandonmentPhase: 'PRE_AUCTION',
      abandonmentReason: 'Caller hung up before auction started'
    });
    return { success: false, reason: 'CALLER_HANGUP' };
  }

  // Collect bids...
  const bids = await collectBids(call);

  // Check AFTER collecting bids, BEFORE selecting winner
  if (!await isCallStillActive(call.twilioCallSid)) {
    await cancelAllPendingBids(bids);
    await updateCallStatus(call.id, 'CALLER_HANGUP', {
      abandonmentPhase: 'DURING_AUCTION',
      abandonmentReason: 'Caller hung up during bid collection'
    });
    return { success: false, reason: 'CALLER_HANGUP' };
  }

  // Select winner and transfer...
}
```

### Concurrent Cascade Attempts

```typescript
// WHY: If cascade webhook fires twice (network retry), we could
//      have two simultaneous cascade attempts.
// WHEN: When cascade webhook is processed.
// HOW: Use database transaction with version check.

export async function handleCascade(
  callId: string,
  currentPosition: number
): Promise<TwiMLResponse> {
  // Atomic position update - only ONE can succeed
  const result = await prisma.$transaction(async (tx) => {
    const call = await tx.call.findUnique({
      where: { id: callId },
      select: { cascadePosition: true, version: true }
    });

    // If position already advanced, this is a duplicate request
    if (call.cascadePosition !== currentPosition) {
      throw new CascadeAlreadyProcessedError();
    }

    // Advance position atomically
    await tx.call.update({
      where: { id: callId, version: call.version },
      data: {
        cascadePosition: currentPosition + 1,
        version: { increment: 1 }
      }
    });

    return call;
  });

  // Now we safely own this cascade position
  const nextBuyer = await getNextCascadeBuyer(callId, currentPosition + 1);

  if (!nextBuyer) {
    return buildNoAnswerTwiML();
  }

  return buildTransferTwiML(nextBuyer);
}
```

### Recording vs Completion Webhook Ordering

```typescript
// WHY: Recording webhook may arrive before OR after completion webhook.
//      We can't assume order.
// WHEN: Both webhooks need to update call record.
// HOW: Use independent updates that don't depend on each other.

// src/app/api/calls/completed/route.ts
export async function POST(request: Request) {
  // Only update completion-related fields
  await prisma.call.update({
    where: { id: callId },
    data: {
      status: 'COMPLETED',
      endedAt: new Date(),
      durationSeconds: parseInt(body.DialCallDuration),
      disposition: body.DialCallStatus,
      // DON'T touch recording fields - recording webhook handles those
    }
  });
}

// src/app/api/calls/recording/route.ts
export async function POST(request: Request) {
  // Only update recording-related fields
  await prisma.call.update({
    where: { id: callId },
    data: {
      recordingSid: body.RecordingSid,
      recordingUrl: s3Url,
      recordingDurationSeconds: parseInt(body.RecordingDuration),
      // DON'T touch status fields - completion webhook handles those
    }
  });
}
```

### Winner Selection Race Condition

```typescript
// WHY: Two processes could select different winners simultaneously.
// WHEN: After bids collected, selecting winner.
// HOW: Use database transaction with SERIALIZABLE isolation.

export async function selectAndLockWinner(
  callId: string,
  bids: Bid[]
): Promise<Bid | null> {
  return await prisma.$transaction(async (tx) => {
    // Re-read call to ensure auction still in progress
    const call = await tx.call.findUnique({
      where: { id: callId },
      select: { status: true }
    });

    if (call.status !== 'BIDDING') {
      throw new Error(`Auction already completed: ${call.status}`);
    }

    const winner = selectWinner(bids);

    if (winner) {
      // Lock in the winner
      await tx.call.update({
        where: { id: callId },
        data: {
          status: 'CONNECTING',
          winningBuyerId: winner.buyerId,
          winningBid: winner.bidAmount,
        }
      });

      // Mark winning bid as accepted
      await tx.callBid.update({
        where: { id: winner.id },
        data: { bidStatus: 'ACCEPTED' }
      });

      // Mark losing bids as rejected
      await tx.callBid.updateMany({
        where: { callId, id: { not: winner.id } },
        data: { bidStatus: 'REJECTED' }
      });
    }

    return winner;
  }, { isolationLevel: 'Serializable' });
}
```

---

## User Stories

### US-CF-1: Caller Hangs Up During IVR
**AS A** caller who hangs up during the IVR
**I WANT** the system to recognize I'm gone
**SO THAT** contractors aren't charged for abandoned calls

**WHEN** I hang up during "Press 1 for homeowner"
**THEN** the next webhook detects no response
**AND** call.status is set to CALLER_HANGUP
**AND** call.abandonment_phase = 'IVR'
**AND** no auction is run
**AND** no buyer is charged

### US-CF-2: Caller Hangs Up During Hold Music
**AS A** caller who gets impatient during auction hold music
**I WANT** the system to stop the auction
**SO THAT** buyers aren't charged for my abandoned call

**WHEN** I hang up during "Please hold while we connect you"
**THEN** isCallStillActive() returns false
**AND** auction is cancelled
**AND** all pending bids are marked as EXPIRED
**AND** call.abandonment_phase = 'DURING_AUCTION'

### US-CF-3: First Buyer Doesn't Answer
**AS A** caller waiting for a connection
**I WANT** to be transferred to the next available buyer
**SO THAT** I get connected without having to call again

**WHEN** the winning buyer doesn't answer after 25 seconds
**THEN** cascade position increments to 1
**AND** second highest bidder is dialed
**AND** I hear brief "Please continue to hold" message
**AND** if they answer, I'm connected at their bid price

### US-CF-4: All Buyers Fail to Answer
**AS A** caller when no buyers answer
**I WANT** a polite message and callback option
**SO THAT** I'm not left hanging

**WHEN** all cascade attempts are exhausted (max 3)
**THEN** call.status = NO_ANSWER
**AND** I hear "We're sorry, all specialists are currently unavailable"
**AND** I'm offered option to leave callback number
**AND** affiliate is NOT charged (no connection made)

### US-CF-5: Buyer Answers and Call Completes
**AS A** caller connected to a buyer
**I WANT** the call to be recorded properly
**SO THAT** there's a record for quality assurance

**WHEN** the call connects and we talk for 3+ minutes
**THEN** call.status = CONNECTED → COMPLETED
**AND** call.connected_duration_seconds is accurate
**AND** recording is saved to S3
**AND** if duration >= min_call_duration, affiliate gets paid

### US-CF-6: Caller Calls Outside Business Hours
**AS A** caller calling at 11 PM
**I WANT** a clear message about hours
**SO THAT** I know to call back tomorrow

**WHEN** I call outside campaign hours_of_operation
**THEN** I hear "Thank you for calling. Our hours are 8 AM to 6 PM Eastern"
**AND** I'm offered option to leave callback for next business day
**AND** call.status = REJECTED
**AND** call.hangup_reason = 'OUTSIDE_HOURS'

### US-CF-7: Campaign at Daily Cap
**AS A** caller when campaign is at capacity
**I WANT** graceful handling
**SO THAT** I have a good experience

**WHEN** campaign.daily_call_cap is reached
**THEN** I hear "Due to high call volume, please try again tomorrow"
**AND** call.status = REJECTED
**AND** call.hangup_reason = 'DAILY_CAP_REACHED'

### US-CF-8: Admin Views Call Timeline
**AS AN** admin investigating a call
**I WANT** to see the complete timeline
**SO THAT** I can debug issues

**WHEN** I view call details in admin
**THEN** I see timestamps for each phase
**AND** I see which webhooks were received
**AND** I see any errors or race conditions that occurred
**AND** I can listen to the recording

### US-CF-9: System Handles Simultaneous Cascade Webhooks
**AS THE** system receiving duplicate cascade webhooks
**I WANT** only one to proceed
**SO THAT** we don't transfer to multiple buyers

**WHEN** network causes cascade webhook retry
**THEN** first request increments cascade_position
**AND** second request sees position already advanced
**AND** second request returns without action
**AND** only one buyer is dialed

### US-CF-10: Caller Gets Transferred Successfully
**AS A** caller who passed IVR
**I WANT** a quick connection to a specialist
**SO THAT** I can get my problem solved

**WHEN** I complete IVR with "homeowner" response
**THEN** auction completes in < 3 seconds
**AND** I hear brief hold message
**AND** I'm connected to the winning buyer
**AND** the buyer sees my caller ID
**AND** call is recorded with disclosure announcement

---

## Logging Requirements (CRITICAL)

> **Every phase of the call flow MUST be logged** for debugging and affiliate transparency.
> See [Section 12: Logging & Observability](./12-logging-observability.md) for full details.

### Required Log Events Per Phase

| Phase | Event | Affiliate Visible? | Message Example |
|-------|-------|-------------------|-----------------|
| 1. Initiation | `call.received` | ✅ Yes | "Call received from (555) ***-4567" |
| 2. IVR | `call.ivr_started` | ✅ Yes | "IVR qualification started" |
| 2. IVR | `call.ivr_response` | ✅ Yes | "Caller response: Homeowner (qualified)" |
| 2. IVR | `call.qualified` | ✅ Yes | "Caller qualified via IVR" |
| 2. IVR | `call.rejected` | ✅ Yes | "Caller did not qualify (reason: renter)" |
| 3. Auction | `auction.started` | ❌ Admin | "Auction started, 5 buyers pinged" |
| 3. Auction | `auction.bid_received` | ❌ Admin | "Bid: $52.00 from Modernize (1823ms)" |
| 3. Auction | `auction.winner_selected` | ❌ Admin | "Winner: Modernize at $52.00" |
| 4. Transfer | `call.transfer_started` | ✅ Yes | "Connecting to buyer..." |
| 4. Transfer | `call.transfer_connected` | ✅ Yes | "Call connected" |
| 4. Transfer | `call.transfer_failed` | ✅ Yes | "Buyer didn't answer, trying next" |
| 5. Cascade | `call.cascade_started` | ❌ Admin | "Cascade to buyer #2" |
| 6. Completed | `call.completed` | ✅ Yes | "Call completed - Duration: 4:05" |
| 6. Completed | `call.payout` | ✅ Yes | "Payout: $35.00" |
| 7. Recording | `call.recording_available` | ✅ Yes | "Recording ready" |

### Logging Pattern for Each Handler

```typescript
// At the START of every webhook handler:
await callLoggingService.logCallEvent({
  callId,
  event: 'call.<phase>',
  message: 'Human-readable description',
  details: { /* relevant data */ },
  visibleToAffiliate: true // or false for admin-only events
});
```

---

## Implementation Tasks

| Task ID | Description | Status |
|---------|-------------|--------|
| P1-CF-1 | Create `/api/calls/incoming/route.ts` | ⬜ |
| P1-CF-2 | Parse Twilio webhook payload | ⬜ |
| P1-CF-3 | Lookup tracking number → affiliate/campaign | ⬜ |
| P1-CF-4 | Check campaign active, hours, caps | ⬜ |
| P1-CF-5 | Create call record (status: RINGING) | ⬜ |
| P1-CF-6 | Return IVR TwiML if configured | ⬜ |
| P1-CF-7 | Return appropriate TwiML response | ⬜ |
| P1-IVR-1 | Create `/api/calls/ivr/route.ts` | ⬜ |
| P1-IVR-2 | Parse DTMF digits from Twilio | ⬜ |
| P1-IVR-3 | Update call.ivr_responses JSON | ⬜ |
| P1-IVR-4 | Determine qualification | ⬜ |
| P1-IVR-5 | Proceed to auction if qualified | ⬜ |
| P1-IVR-6 | Return rejection TwiML if not qualified | ⬜ |
| P1-TR-1 | Build transfer TwiML with winner | ⬜ |
| P1-TR-2 | Pass through caller ID | ⬜ |
| P1-TR-3 | Enable recording (dual channel) | ⬜ |
| P1-TR-4 | Set action callback | ⬜ |
| P1-TR-5 | Update call record (CONNECTED) | ⬜ |
| P1-TR-6 | Log CALL_TRANSFER transaction | ⬜ |
| P1-CP-1 | Create `/api/calls/completed/route.ts` | ⬜ |
| P1-CP-2 | Parse Twilio completion payload | ⬜ |
| P1-CP-3 | Update call record (ended_at, duration) | ⬜ |
| P1-CP-4 | Determine if call qualifies for payout | ⬜ |
| P1-CP-5 | Calculate payouts if qualified | ⬜ |
| P1-CP-6 | Log CALL_COMPLETE transaction | ⬜ |
| P1-CP-7 | Trigger postback if configured | ⬜ |

### Logging Tasks (CRITICAL)

| Task ID | Description | Status | Priority |
|---------|-------------|--------|----------|
| P1-CF-LOG-1 | Log `call.received` at incoming handler | ⬜ | CRITICAL |
| P1-CF-LOG-2 | Log `call.ivr_started`, `call.ivr_response`, `call.qualified/rejected` | ⬜ | CRITICAL |
| P1-CF-LOG-3 | Log `auction.started`, `auction.bid_received`, `auction.winner_selected` | ⬜ | CRITICAL |
| P1-CF-LOG-4 | Log `call.transfer_started`, `call.transfer_connected/failed` | ⬜ | CRITICAL |
| P1-CF-LOG-5 | Log `call.completed` with duration and payout | ⬜ | CRITICAL |
| P1-CF-LOG-6 | Log `call.recording_available` when recording ready | ⬜ | HIGH |
| P1-CF-LOG-7 | Log all state transitions with previous/new state | ⬜ | HIGH |
| P1-CF-LOG-8 | Log caller hangup with phase (IVR, auction, transfer) | ⬜ | HIGH |

### State Machine Tasks

| Task ID | Description | Status |
|---------|-------------|--------|
| P1-SM-1 | Create `src/lib/call/state-machine.ts` with transitions | ⬜ |
| P1-SM-2 | Implement `validateAndTransition()` | ⬜ |
| P1-SM-3 | Add state validation to ALL status updates | ⬜ |
| P1-SM-4 | Create `isTerminalState()` helper | ⬜ |

### Race Condition Prevention Tasks

| Task ID | Description | Status |
|---------|-------------|--------|
| P1-RC-1 | Create `isCallStillActive()` using Twilio API | ⬜ |
| P1-RC-2 | Add caller hangup check BEFORE auction | ⬜ |
| P1-RC-3 | Add caller hangup check DURING auction | ⬜ |
| P1-RC-4 | Add caller hangup check BEFORE transfer | ⬜ |
| P1-RC-5 | Implement atomic cascade position update | ⬜ |
| P1-RC-6 | Implement SERIALIZABLE winner selection | ⬜ |
| P1-RC-7 | Ensure recording/completion webhooks are independent | ⬜ |

### UX Enhancement Tasks

| Task ID | Description | Status |
|---------|-------------|--------|
| P1-UX-1 | Create outside-hours TwiML with hours announcement | ⬜ |
| P1-UX-2 | Create daily-cap TwiML with friendly message | ⬜ |
| P1-UX-3 | Create no-answer TwiML with callback offer | ⬜ |
| P1-UX-4 | Create cascade transition message (brief) | ⬜ |
| P1-UX-5 | Add abandonment tracking (phase, reason) | ⬜ |
| P1-UX-6 | Create callback request handler (Phase 2) | ⬜ |

### Testing Tasks

| Task ID | Description | Status |
|---------|-------------|--------|
| P1-CF-T1 | Test caller hangup during IVR sets correct status | ⬜ |
| P1-CF-T2 | Test caller hangup during auction cancels bids | ⬜ |
| P1-CF-T3 | Test cascade position prevents duplicate transfers | ⬜ |
| P1-CF-T4 | Test winner selection is atomic under concurrency | ⬜ |
| P1-CF-T5 | Test recording/completion can arrive in any order | ⬜ |
| P1-CF-T6 | Test outside-hours handling | ⬜ |
| P1-CF-T7 | Test daily-cap handling | ⬜ |
| P1-CF-T8 | Integration test: full happy path call flow | ⬜ |
| P1-CF-T9 | Integration test: cascade through 3 buyers | ⬜ |
| P1-CF-T10 | Load test: 50 concurrent calls to same campaign | ⬜ |

---

## Sentry Integration

### Error Tracking and Alerting

```typescript
import * as Sentry from '@sentry/nextjs';

// Set call context for debugging
function setCallContext(call: Call) {
  Sentry.setContext('call', {
    callId: call.id,
    twilioCallSid: call.twilioCallSid,
    affiliateId: call.affiliateId,
    campaignId: call.campaignId,
    status: call.status
  });
  Sentry.setTag('call_id', call.id);
}

// Track call state transitions
function trackStateTransition(
  callId: string,
  from: CallStatus,
  to: CallStatus
) {
  Sentry.addBreadcrumb({
    category: 'call.state',
    message: `State transition: ${from} → ${to}`,
    level: 'info',
    data: { callId, from, to, timestamp: new Date().toISOString() }
  });
}
```

### Sentry Events to Capture

| Event | Sentry Method | Severity | When to Trigger |
|-------|---------------|----------|-----------------|
| Invalid state transition | `captureException` | error | State machine violation |
| Caller hangup during auction | `captureMessage` | info | Caller abandons mid-auction |
| All cascade attempts failed | `captureMessage` | warning | No buyers answered |
| Transfer timeout | `captureException` | error | Transfer exceeded timeout |
| Recording/completion webhook race | `captureMessage` | info | Out-of-order webhooks |
| Campaign at daily cap | `captureMessage` | info | Cap limit reached |
| Outside business hours rejection | `captureMessage` | info | Call outside hours |
| Auction took too long (>5s) | `captureMessage` | warning | Slow auction |

### Breadcrumb Tracking for Call Lifecycle

```typescript
// Incoming call
Sentry.addBreadcrumb({
  category: 'call.lifecycle',
  message: 'Call received',
  level: 'info',
  data: { callId, callerPhone: maskPhone(phone), trackingNumber }
});

// IVR phase
Sentry.addBreadcrumb({
  category: 'call.ivr',
  message: 'IVR response received',
  level: 'info',
  data: { callId, response: ivrResponse, qualified: isQualified }
});

// Auction phase
Sentry.addBreadcrumb({
  category: 'call.auction',
  message: 'Auction completed',
  level: 'info',
  data: { callId, bidCount, winnerBuyerId, winningBid }
});

// Transfer phase
Sentry.addBreadcrumb({
  category: 'call.transfer',
  message: 'Transfer initiated',
  level: 'info',
  data: { callId, buyerId, transferNumber }
});

// Cascade
Sentry.addBreadcrumb({
  category: 'call.cascade',
  message: 'Cascading to next buyer',
  level: 'info',
  data: { callId, cascadePosition, reason: 'no_answer' }
});
```

### Alert Configuration

```typescript
// Critical alerts - immediate response needed
const CRITICAL_CALL_ALERTS = [
  'State machine corruption detected',
  'Transfer failures > 5 in 5 minutes',
  'Zero successful transfers in 10 minutes'
];

// Warning alerts - monitor closely
const WARNING_CALL_ALERTS = [
  'High caller hangup rate during auction (>20%)',
  'High cascade rate (>30%)',
  'Auction latency p95 > 4 seconds'
];
```

---

*Section Version: 2.1 (Added Sentry Integration)*
