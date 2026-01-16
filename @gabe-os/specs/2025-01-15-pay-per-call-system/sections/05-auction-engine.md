# Unified Auction Engine

> **Section:** 05 | **Phase:** 1 (MVP)
> **Parent:** [spec.md](../spec.md)

---

## Overview

The call auction reuses 80%+ of the existing lead auction infrastructure. This section covers the shared base class and call-specific extensions.

## Shared Architecture (DRY)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      UNIFIED AUCTION ENGINE                                      │
└─────────────────────────────────────────────────────────────────────────────────┘

                         ┌───────────────────────┐
                         │   AuctionEngine       │
                         │   (Abstract Base)     │
                         │                       │
                         │ + runAuction()        │
                         │ + getEligibleBuyers() │
                         │ + selectWinner()      │
                         │ + logTransactions()   │
                         └───────────┬───────────┘
                                     │
                    ┌────────────────┴────────────────┐
                    │                                 │
                    ▼                                 ▼
         ┌─────────────────────┐         ┌─────────────────────┐
         │   LeadAuctionEngine │         │   CallAuctionEngine │
         │                     │         │                     │
         │ + sendPing()        │         │ + sendPing()        │
         │ + sendPost()        │         │ + transferCall()    │
         │ + handleCascade()   │         │ + handleCascade()   │
         └─────────────────────┘         └─────────────────────┘


SHARED METHODS (in base class):
───────────────────────────────

getEligibleBuyers(serviceTypeId, zipCode, type: 'LEAD' | 'CALL')
  │
  └─▶ ServiceZoneRepository.getEligibleBuyers()
      └─▶ Same query, filter by accepts_leads OR accepts_calls

selectWinner(bids: Bid[])
  │
  └─▶ Sort by bidAmount DESC
      └─▶ Return highest valid bid

logTransaction(type, payload, response, ...)
  │
  └─▶ Same transactions table
      └─▶ action_type: 'LEAD_PING' | 'LEAD_POST' | 'CALL_PING' | 'CALL_TRANSFER'


TYPE-SPECIFIC METHODS:
──────────────────────

LeadAuctionEngine:
  sendPing()  → HTTP POST with lead data
  sendPost()  → HTTP POST with full lead + compliance

CallAuctionEngine:
  sendPing()  → HTTP POST with CID, ZIP (same pattern)
  transferCall() → Return TwiML to Twilio
```

## Reusable Components

| Existing Component | Reuse For Calls | Changes Required |
|-------------------|-----------------|------------------|
| `buyers` table | Store call buyer config | Add `accepts_calls` flag |
| `buyer_service_configs` | Call bid settings | Add `call_bid_amount`, `call_forwarding_number` |
| `buyer_service_zip_codes` | Call eligibility by ZIP | None - works as-is |
| `BuyerEligibilityService` | Find eligible call buyers | Add `type: 'call'` filter |
| `TemplateEngine` | Transform call data for PING | None - works as-is |
| `AuctionEngine` | Run call auction | Extract shared logic, extend for calls |
| `transactions` table | Log call PING/transfers | Add `CALL_PING`, `CALL_TRANSFER` types |
| Admin UI | Buyer configuration | Add call settings tab |

## Auction Timing Comparison

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      TIMING: LEADS vs CALLS                                      │
└─────────────────────────────────────────────────────────────────────────────────┘

LEADS:
──────
  Lead submitted → Queue → Worker picks up → Auction → POST to winner

  Timeline:
  0s          1s          2s          3s          4s          5s
  │───────────│───────────│───────────│───────────│───────────│
  │           │           │           │           │           │
  Submit      Worker      Auction     Auction     POST        Complete
              starts      starts      ends        sent

  Total: 2-5 seconds (caller has left, no rush)
  PING timeout: 3 seconds (generous)


CALLS:
──────
  Call comes in → Answer → IVR → Auction → Transfer

  Timeline:
  0s          1s          2s          3s          4s          5s
  │───────────│───────────│───────────│───────────│───────────│
  │           │           │           │           │           │
  Answer      IVR         Auction     Transfer    Connected
              starts      (parallel)  begins

  Total: 3-5 seconds (caller is WAITING)
  PING timeout: 2 seconds (aggressive - networks must be fast!)

  Hold message plays: "Please hold while we connect you..."
```

## Base Engine Implementation

```typescript
// src/lib/auction/base-engine.ts

export interface Bid {
  buyerId: string;
  buyerName: string;
  buyerType: 'CONTRACTOR' | 'NETWORK';
  bidAmount: number;
  responseTimeMs?: number;
  transferNumber?: string;  // For calls: where to transfer
  bidId?: string;           // For networks: Ringba bid ID
  expiresAt?: Date;         // For networks: bid expiration
}

export interface AuctionResult {
  winner: Bid | null;
  allBids: Bid[];
  auctionDurationMs: number;
  eligibleBuyersCount: number;
}

export abstract class BaseAuctionEngine {
  protected async getEligibleBuyers(
    serviceTypeId: string,
    zipCode: string,
    type: 'LEAD' | 'CALL'
  ): Promise<BuyerConfig[]> {
    return BuyerEligibilityService.getEligibleBuyers({
      serviceTypeId,
      zipCode,
      type,
    });
  }

  protected selectWinner(bids: Bid[]): Bid | null {
    if (bids.length === 0) return null;

    // Sort by bid amount descending
    const sorted = [...bids].sort((a, b) => b.bidAmount - a.bidAmount);
    return sorted[0];
  }

  protected async logTransaction(
    actionType: string,
    buyerId: string,
    entityId: string,
    payload: object,
    response: object,
    bidAmount?: number
  ): Promise<void> {
    await prisma.transaction.create({
      data: {
        actionType,
        buyerId,
        leadId: entityId,  // Works for both leads and calls
        requestPayload: payload,
        responsePayload: response,
        bidAmount,
        createdAt: new Date(),
      },
    });
  }

  abstract runAuction(entity: Lead | Call): Promise<AuctionResult>;
}
```

## Call Engine Implementation

```typescript
// src/lib/auction/call-engine.ts

export class CallAuctionEngine extends BaseAuctionEngine {
  private readonly PING_TIMEOUT_MS = 2000;  // Aggressive 2s timeout

  async runAuction(call: Call): Promise<AuctionResult> {
    const startTime = Date.now();

    // 1. Get eligible buyers
    const eligibleBuyers = await this.getEligibleBuyers(
      call.serviceTypeId,
      call.callerZip,
      'CALL'
    );

    // 2. Collect bids (parallel)
    const bidPromises = eligibleBuyers.map(buyer =>
      this.collectBid(buyer, call)
    );

    const bids = await Promise.allSettled(bidPromises);
    const validBids = bids
      .filter((r): r is PromiseFulfilledResult<Bid> => r.status === 'fulfilled')
      .map(r => r.value)
      .filter(bid => bid.bidAmount > 0);

    // 3. Select winner
    const winner = this.selectWinner(validBids);

    return {
      winner,
      allBids: validBids,
      auctionDurationMs: Date.now() - startTime,
      eligibleBuyersCount: eligibleBuyers.length,
    };
  }

  private async collectBid(buyer: BuyerConfig, call: Call): Promise<Bid> {
    if (buyer.type === 'CONTRACTOR') {
      // Contractors: instant bid from config
      return {
        buyerId: buyer.id,
        buyerName: buyer.name,
        buyerType: 'CONTRACTOR',
        bidAmount: buyer.callBidAmount,
        transferNumber: buyer.callForwardingNumber,
        responseTimeMs: 0,
      };
    } else {
      // Networks: PING with timeout
      return this.pingNetwork(buyer, call);
    }
  }

  private async pingNetwork(buyer: BuyerConfig, call: Call): Promise<Bid> {
    const startTime = Date.now();

    try {
      const response = await Promise.race([
        this.sendPing(buyer, call),
        this.timeout(this.PING_TIMEOUT_MS),
      ]);

      return {
        buyerId: buyer.id,
        buyerName: buyer.name,
        buyerType: 'NETWORK',
        bidAmount: response.bidAmount,
        transferNumber: response.phoneNumber,
        bidId: response.bidId,
        expiresAt: new Date(Date.now() + response.expireInSeconds * 1000),
        responseTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      // Timeout or error = no bid
      return {
        buyerId: buyer.id,
        buyerName: buyer.name,
        buyerType: 'NETWORK',
        bidAmount: 0,
        responseTimeMs: Date.now() - startTime,
      };
    }
  }

  private async sendPing(buyer: BuyerConfig, call: Call): Promise<PingResponse> {
    const payload = TemplateEngine.transform(call, buyer.callFieldMappings);

    const response = await fetch(buyer.callPingUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    await this.logTransaction(
      'CALL_PING',
      buyer.id,
      call.id,
      payload,
      await response.json()
    );

    return response.json();
  }

  private timeout(ms: number): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), ms)
    );
  }
}
```

---

## Race Condition Prevention

### Tie-Breaking Logic (CRITICAL)

```typescript
// WHY: When two buyers bid the same amount, winner is non-deterministic.
//      This is unfair and could cause disputes.
// WHEN: selectWinner() finds multiple equal highest bids.
// HOW: Tie-break by response time (fastest wins - caller is waiting!).

protected selectWinner(bids: Bid[]): Bid | null {
  if (bids.length === 0) return null;

  // Sort by bid amount descending
  const sorted = [...bids].sort((a, b) => b.bidAmount - a.bidAmount);
  const maxBid = sorted[0].bidAmount;

  // Find all bids at the max amount
  const topBids = sorted.filter(b => b.bidAmount === maxBid);

  if (topBids.length === 1) {
    return topBids[0];
  }

  // Tie-break by fastest response time (caller is waiting!)
  const winner = topBids.reduce((fastest, current) => {
    const currentTime = current.responseTimeMs ?? Infinity;
    const fastestTime = fastest.responseTimeMs ?? Infinity;
    return currentTime < fastestTime ? current : fastest;
  });

  logger.info('Tie-break applied', {
    bidAmount: maxBid,
    tiedBuyers: topBids.map(b => b.buyerName),
    winner: winner.buyerName,
    winnerResponseTimeMs: winner.responseTimeMs,
  });

  return winner;
}
```

### Caller Hangup Check During Auction

```typescript
// WHY: If caller hangs up during auction, we shouldn't select a winner
//      and charge the buyer for an abandoned call.
// WHEN: After bids collected, before selecting winner.
// HOW: Check call status with Twilio API.

async runAuction(call: Call): Promise<AuctionResult> {
  const startTime = Date.now();

  // Check caller still on the line BEFORE starting
  if (!await this.isCallActive(call.twilioCallSid)) {
    return this.createAbandonedResult(call.id, 'CALLER_HANGUP_BEFORE_AUCTION');
  }

  // Get eligible buyers
  const eligibleBuyers = await this.getEligibleBuyers(
    call.serviceTypeId,
    call.callerZip,
    'CALL'
  );

  if (eligibleBuyers.length === 0) {
    return this.createNoBidsResult(call.id);
  }

  // Collect bids in parallel
  const bids = await this.collectBidsWithTimeout(eligibleBuyers, call);

  // Check caller AGAIN after bid collection (2+ seconds have passed!)
  if (!await this.isCallActive(call.twilioCallSid)) {
    // Cancel any accepted bids
    await this.cancelBids(bids);
    return this.createAbandonedResult(call.id, 'CALLER_HANGUP_DURING_AUCTION');
  }

  // Filter valid bids
  const validBids = bids.filter(b => b.bidAmount > 0);

  if (validBids.length === 0) {
    return this.createNoBidsResult(call.id);
  }

  // Select winner atomically
  const winner = await this.selectAndLockWinner(call.id, validBids);

  return {
    winner,
    allBids: validBids,
    auctionDurationMs: Date.now() - startTime,
    eligibleBuyersCount: eligibleBuyers.length,
  };
}

private async isCallActive(callSid: string): Promise<boolean> {
  try {
    const call = await twilioClient.calls(callSid).fetch();
    return ['queued', 'ringing', 'in-progress'].includes(call.status);
  } catch (error) {
    logger.warn('Failed to check call status', { callSid, error });
    return false; // Assume inactive on error
  }
}
```

### Transactional Winner Selection (SERIALIZABLE)

```typescript
// WHY: Without transaction isolation, two processes could select
//      different winners simultaneously.
// WHEN: When selecting winner after bids collected.
// HOW: Use SERIALIZABLE isolation level.

async selectAndLockWinner(
  callId: string,
  validBids: Bid[]
): Promise<Bid | null> {
  return await prisma.$transaction(async (tx) => {
    // Re-read call state within transaction
    const call = await tx.call.findUnique({
      where: { id: callId },
      select: { status: true, winningBuyerId: true }
    });

    // Check if auction already completed by another process
    if (call.status !== 'BIDDING') {
      throw new AuctionAlreadyCompletedError(
        `Auction already in status: ${call.status}`
      );
    }

    if (call.winningBuyerId) {
      throw new AuctionAlreadyCompletedError(
        'Winner already selected'
      );
    }

    // Select winner using tie-break logic
    const winner = this.selectWinner(validBids);

    if (!winner) {
      // No valid bids - mark as NO_BIDS
      await tx.call.update({
        where: { id: callId },
        data: { status: 'NO_BIDS' }
      });
      return null;
    }

    // Lock in the winner
    await tx.call.update({
      where: { id: callId },
      data: {
        status: 'CONNECTING',
        winningBuyerId: winner.buyerId,
        winningBid: winner.bidAmount,
        auctionCompletedAt: new Date(),
      }
    });

    // Update bid statuses in call_bids table
    await tx.callBid.update({
      where: {
        callId_buyerId: { callId, buyerId: winner.buyerId }
      },
      data: { bidStatus: 'ACCEPTED' }
    });

    await tx.callBid.updateMany({
      where: {
        callId,
        buyerId: { not: winner.buyerId }
      },
      data: { bidStatus: 'REJECTED' }
    });

    return winner;
  }, {
    isolationLevel: 'Serializable',
    maxWait: 5000,
    timeout: 10000,
  });
}
```

### Late Winner Response After Cascade

```typescript
// WHY: Original winner responds "Yes I'll take it" AFTER we've already
//      started cascade to buyer #2.
// WHEN: Network PING response arrives late.
// HOW: Bid expiration timestamps prevent accepting stale bids.

interface Bid {
  // ... existing fields
  expiresAt?: Date;  // Bid only valid until this time
}

private async collectBidsWithTimeout(
  buyers: BuyerConfig[],
  call: Call
): Promise<Bid[]> {
  const bidPromises = buyers.map(async (buyer) => {
    const bid = await this.collectBid(buyer, call);

    // Set expiration for network bids (bid is only valid for N seconds)
    if (buyer.type === 'NETWORK' && bid.bidAmount > 0) {
      bid.expiresAt = new Date(Date.now() + (bid.expireInSeconds || 30) * 1000);
    }

    return bid;
  });

  const results = await Promise.allSettled(bidPromises);

  return results
    .filter((r): r is PromiseFulfilledResult<Bid> => r.status === 'fulfilled')
    .map(r => r.value);
}

private isBidValid(bid: Bid): boolean {
  // Check if bid has expired
  if (bid.expiresAt && new Date() > bid.expiresAt) {
    logger.info('Bid expired', { buyerId: bid.buyerId, expiresAt: bid.expiresAt });
    return false;
  }

  return bid.bidAmount > 0;
}
```

### Cascade Depth and Time Limits

```typescript
// WHY: Without limits, cascade could go on forever or take too long,
//      frustrating the caller.
// WHEN: Each cascade attempt.
// HOW: Hard limits on depth (3) and total time (8s).

const MAX_CASCADE_DEPTH = 3;
const MAX_CASCADE_TIME_MS = 8000;

async handleCascade(
  callId: string,
  currentPosition: number,
  auctionStartTime: Date
): Promise<TwiMLResponse> {
  // Check time limit
  const elapsedMs = Date.now() - auctionStartTime.getTime();
  if (elapsedMs > MAX_CASCADE_TIME_MS) {
    logger.warn('Cascade time limit exceeded', { callId, elapsedMs });
    return this.buildTimeoutTwiML();
  }

  // Check depth limit
  if (currentPosition >= MAX_CASCADE_DEPTH) {
    logger.warn('Cascade depth limit reached', { callId, currentPosition });
    return this.buildNoAnswerTwiML();
  }

  // Get next buyer in cascade order
  const nextBuyer = await this.getNextCascadeBuyer(callId, currentPosition);

  if (!nextBuyer) {
    return this.buildNoAnswerTwiML();
  }

  // Check if next bid is still valid
  if (!this.isBidValid(nextBuyer)) {
    // Skip expired bid, try next
    return this.handleCascade(callId, currentPosition + 1, auctionStartTime);
  }

  return this.buildTransferTwiML(nextBuyer.transferNumber, currentPosition + 1);
}
```

---

## User Stories

### US-AE-1: Two Buyers Bid Same Amount
**AS THE** auction engine handling a tie
**I WANT** deterministic winner selection
**SO THAT** results are fair and predictable

**WHEN** ABC Plumbing and XYZ HVAC both bid $55
**AND** ABC responded in 200ms, XYZ in 350ms
**THEN** ABC wins (faster response = caller waits less)
**AND** log shows "Tie-break applied"
**AND** XYZ gets second position in cascade

### US-AE-2: Caller Hangs Up During Auction
**AS THE** system when caller hangs up during auction
**I WANT** to cancel the auction and not charge any buyer
**SO THAT** buyers don't pay for abandoned calls

**WHEN** caller hangs up while bids are being collected
**THEN** isCallActive() returns false
**AND** all collected bids are cancelled/expired
**AND** call.status = CALLER_HANGUP
**AND** no buyer is charged

### US-AE-3: Network Responds After Timeout
**AS THE** auction engine when a network responds late
**I WANT** to ignore the late response
**SO THAT** the caller isn't waiting indefinitely

**WHEN** Modernize takes 3.5 seconds to respond (timeout is 2s)
**THEN** their bid is not included in winner selection
**AND** transaction log shows "timeout" for that bid
**AND** if they would have won, second-highest wins instead

### US-AE-4: First Three Buyers Don't Answer
**AS A** caller when multiple buyers don't answer
**I WANT** a graceful fallback message
**SO THAT** I'm not left waiting forever

**WHEN** buyers 1, 2, and 3 don't answer (25s each)
**AND** cascade depth limit (3) is reached
**THEN** I hear "All specialists are currently unavailable"
**AND** call.status = NO_ANSWER
**AND** no buyer is charged

### US-AE-5: Concurrent Winner Selection Attempts
**AS THE** system with high concurrency
**I WANT** only one winner to be selected
**SO THAT** we don't transfer to multiple buyers

**WHEN** two processes try to select winner simultaneously
**THEN** SERIALIZABLE transaction ensures only one succeeds
**AND** second process gets AuctionAlreadyCompletedError
**AND** database remains consistent

---

## Implementation Tasks

| Task ID | Description | Status |
|---------|-------------|--------|
| P1-AE-1 | Create `src/lib/auction/base-engine.ts` | ⬜ |
| P1-AE-2 | Extract common methods from lead auction | ⬜ |
| P1-AE-3 | Create `src/lib/auction/call-engine.ts` | ⬜ |
| P1-AE-4 | Implement `getEligibleCallBuyers()` | ⬜ |
| P1-AE-5 | Implement contractor bid collection | ⬜ |
| P1-AE-6 | Implement winner selection with tie-breaking | ⬜ |
| P1-AE-7 | Implement `runCallAuction()` orchestration | ⬜ |
| P1-AE-8 | Add call-specific logging to transactions | ⬜ |

### Logging Tasks (CRITICAL)

> **All auction events MUST be logged** for debugging bid issues and revenue reconciliation.
> See [Section 12: Logging & Observability](./12-logging-observability.md) for details.

| Task ID | Description | Status | Priority |
|---------|-------------|--------|----------|
| P1-AE-LOG-1 | Log `auction.started` with eligible buyer count | ⬜ | CRITICAL |
| P1-AE-LOG-2 | Log `auction.buyer_pinged` for each buyer with timeout | ⬜ | HIGH |
| P1-AE-LOG-3 | Log `auction.bid_received` with amount, buyer, response time | ⬜ | CRITICAL |
| P1-AE-LOG-4 | Log `auction.no_bids` when no buyers respond | ⬜ | CRITICAL |
| P1-AE-LOG-5 | Log `auction.winner_selected` with amount, tie-break info | ⬜ | CRITICAL |
| P1-AE-LOG-6 | Log `auction.cascade_started` with cascade position | ⬜ | HIGH |
| P1-AE-LOG-7 | Log `auction.caller_hangup` if caller abandons | ⬜ | HIGH |
| P1-AE-LOG-8 | Log `auction.timeout` if total auction time exceeded | ⬜ | HIGH |

### Race Condition Prevention Tasks

| Task ID | Description | Status |
|---------|-------------|--------|
| P1-AE-9 | Implement tie-breaking by response time | ⬜ |
| P1-AE-10 | Add caller hangup check BEFORE auction | ⬜ |
| P1-AE-11 | Add caller hangup check AFTER bid collection | ⬜ |
| P1-AE-12 | Implement SERIALIZABLE winner selection | ⬜ |
| P1-AE-13 | Add bid expiration checking | ⬜ |
| P1-AE-14 | Implement cascade depth limit (MAX_CASCADE_DEPTH=3) | ⬜ |
| P1-AE-15 | Implement cascade time limit (MAX_CASCADE_TIME_MS=8000) | ⬜ |
| P1-AE-16 | Add bid cancellation on caller hangup | ⬜ |

### DRY Refactoring Tasks

| Task ID | Description | Status |
|---------|-------------|--------|
| P1-AE-DRY-1 | Extract shared eligibility query to base class | ⬜ |
| P1-AE-DRY-2 | Share transaction logging between lead/call engines | ⬜ |
| P1-AE-DRY-3 | Create shared timeout wrapper | ⬜ |
| P1-AE-DRY-4 | Unify PING payload transformation | ⬜ |
| P1-AE-DRY-5 | Share bid collection patterns | ⬜ |

### Testing Tasks

| Task ID | Description | Status |
|---------|-------------|--------|
| P1-AE-T1 | Test tie-breaking selects faster response | ⬜ |
| P1-AE-T2 | Test caller hangup cancels auction | ⬜ |
| P1-AE-T3 | Test network timeout excludes bid | ⬜ |
| P1-AE-T4 | Test SERIALIZABLE prevents double-selection | ⬜ |
| P1-AE-T5 | Test cascade depth limit stops at 3 | ⬜ |
| P1-AE-T6 | Test cascade time limit enforced | ⬜ |
| P1-AE-T7 | Test expired bid skipped in cascade | ⬜ |
| P1-AE-T8 | Load test: 50 concurrent auctions | ⬜ |

---

## Sentry Integration

### Error Tracking and Alerting

```typescript
import * as Sentry from '@sentry/nextjs';

// Set auction context
function setAuctionContext(call: Call, eligibleBuyers: number) {
  Sentry.setContext('auction', {
    callId: call.id,
    serviceTypeId: call.serviceTypeId,
    callerZip: call.callerZip,
    eligibleBuyers,
    timestamp: new Date().toISOString()
  });
}

// Track auction with performance monitoring
async function runAuctionWithSentry(call: Call): Promise<AuctionResult> {
  const transaction = Sentry.startTransaction({
    name: 'auction.run',
    op: 'call.auction'
  });

  Sentry.addBreadcrumb({
    category: 'auction',
    message: 'Auction started',
    level: 'info',
    data: { callId: call.id, serviceTypeId: call.serviceTypeId }
  });

  try {
    const result = await callAuctionEngine.runAuction(call);

    if (!result.winner) {
      Sentry.captureMessage('No bids received for call', {
        level: 'warning',
        tags: { component: 'auction-engine', callId: call.id },
        extra: { eligibleBuyersCount: result.eligibleBuyersCount }
      });
    }

    transaction.setStatus('ok');
    return result;
  } catch (error) {
    transaction.setStatus('internal_error');
    Sentry.captureException(error, {
      tags: { component: 'auction-engine' },
      extra: { callId: call.id, serviceTypeId: call.serviceTypeId }
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
| No bids received | `captureMessage` | warning | Zero valid bids after auction |
| All network buyers timed out | `captureMessage` | warning | All PINGs timed out |
| Buyer PING failed | `captureException` | error | Network error on PING |
| Auction took too long | `captureMessage` | warning | >5 seconds auction duration |
| Concurrent winner selection | `captureException` | error | SERIALIZABLE conflict |
| Caller abandoned during auction | `captureMessage` | info | Hangup detected |
| Tie-break applied | `captureMessage` | info | Equal highest bids |
| Cascade depth limit reached | `captureMessage` | warning | Max 3 cascades exhausted |

### Breadcrumb Tracking

```typescript
// Auction lifecycle
Sentry.addBreadcrumb({
  category: 'auction',
  message: 'Fetching eligible buyers',
  level: 'info',
  data: { serviceTypeId, zipCode }
});

Sentry.addBreadcrumb({
  category: 'auction.bid',
  message: 'Bid received',
  level: 'info',
  data: { buyerId, buyerName, bidAmount, responseTimeMs }
});

Sentry.addBreadcrumb({
  category: 'auction.bid',
  message: 'Buyer PING timed out',
  level: 'warning',
  data: { buyerId, buyerName, timeout: '2000ms' }
});

Sentry.addBreadcrumb({
  category: 'auction',
  message: 'Winner selected',
  level: 'info',
  data: { winnerId, winnerName, winningBid, totalBids }
});

// Cascade tracking
Sentry.addBreadcrumb({
  category: 'auction.cascade',
  message: 'Cascade to next buyer',
  level: 'info',
  data: { callId, position: cascadePosition, reason: 'no_answer' }
});
```

### Alert Configuration

```typescript
// Critical alerts
const CRITICAL_AUCTION_ALERTS = [
  'Auction failure rate > 10%',
  'Average bids per auction < 1',
  'Serializable transaction conflicts > 5/hour'
];

// Warning alerts
const WARNING_AUCTION_ALERTS = [
  'No bids rate > 20%',
  'Average auction latency > 4 seconds',
  'Network buyer timeout rate > 50%',
  'High cascade rate (>40% calls cascade)'
];
```

---

*Section Version: 2.1 (Added Sentry Integration)*
