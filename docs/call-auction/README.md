# Call Auction System

## Overview

The pay-per-call auction system routes inbound calls to the highest-bidding buyer in real-time. It supports two buyer types that compete in the same auction:

- **NETWORK buyers** - External lead buyers (like Home Appointments/Ringba) who bid via PING API
- **CONTRACTOR buyers** - Direct contractors with pre-configured fixed bids

## How the Auction Works

### Phase 1: Bid Collection (Parallel)

All eligible buyers bid simultaneously:

```
Auction starts
    ↓
Find eligible buyers (3 contractors + 2 networks)
    ↓
Collect ALL bids in parallel:
    ├─ Contractor A: $50 (instant, 0ms)
    ├─ Contractor B: $45 (instant, 0ms)
    ├─ Contractor C: $40 (instant, 0ms)
    ├─ Network X: PING... waiting... $60 (800ms)
    └─ Network Y: PING... waiting... $55 (1200ms)
    ↓
All 5 bids collected (took 1200ms total)
    ↓
Select winner: Network X ($60 highest)
```

### Phase 2: Transfer to Winner

The call is transferred to the winning buyer's phone number.

### Phase 3: Cascade (If No Answer)

If the winner doesn't answer, the system tries the next highest bidder, and so on.

## Contractor vs Network Bidding

| Type | How They Bid | Speed | Transfer Number |
|------|--------------|-------|-----------------|
| **CONTRACTOR** | Instant from config (`callBidAmount`) | 0ms | `callForwardingNumber` from config |
| **NETWORK** | PING request to their API | Up to 2000ms | From PING response |

### Contractor Advantage: Speed

Contractors bid instantly (0ms) while networks must make an HTTP request. If a network buyer times out (2s limit), contractors win by default.

From `call-ping.ts:202`:
```typescript
logger.warn('Call PING timeout - network loses to contractors', {
```

This creates healthy competition:
- **Networks** must respond fast AND bid high
- **Contractors** get instant consideration with their pre-set bid
- **Caller** gets routed quickly (no waiting for slow networks)

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/auction/call-engine.ts` | Main auction orchestration |
| `src/lib/auction/call-ping.ts` | Network PING logic |
| `src/app/api/calls/auction/route.ts` | Auction webhook handler |
| `src/app/api/calls/cascade/route.ts` | Cascade/reroute handler |
| `src/app/api/calls/completed/route.ts` | Call completion handler |
| `src/lib/twilio/twiml-builder.ts` | TwiML generation for transfers |

## Bid Collection Code Flow

From `call-engine.ts`:

```typescript
// Collects bids from all eligible buyers in parallel
private async collectAllBids(call, buyers): Promise<CallBid[]> {
  const bidPromises = buyers.map((buyer) =>
    this.collectBid(call, buyer)  // Both types go through this
  );

  const results = await Promise.allSettled(bidPromises);
  // ...
}

private async collectBid(call, buyer): Promise<CallBid> {
  if (buyer.buyerType === 'CONTRACTOR') {
    return this.collectContractorBid(call, buyer, startTime);  // INSTANT
  } else {
    return this.collectNetworkBid(call, buyer, startTime);     // PING (2s timeout)
  }
}
```

## Cascade Pool

When cascading (if winner doesn't answer), the pool includes both types:
- All contractors who bid
- All networks who returned valid PING responses with bid > 0 and transfer number

Bids are tried in order of bid amount (highest first), with response time as tiebreaker.

## Configuration

Key settings in `call-engine.ts`:

| Setting | Default | Purpose |
|---------|---------|---------|
| `pingTimeoutMs` | 2000ms | Max time to wait for network PING response |
| `minimumBid` | $5.00 | Minimum bid to be considered |

## Cascade (Rerouting)

When the winning buyer doesn't answer, the system cascades to the next highest bidder.

### Cascade Flow

```
Winner ($60) doesn't answer (10 sec timeout)
    ↓
Try 2nd place ($55) - 10 sec timeout
    ↓
Try 3rd place ($50) - 10 sec timeout
    ↓
Continue until:
  - Someone answers → SUCCESS
  - All bidders exhausted → END
  - Total time > 90 seconds → END
  - Bid expires (buyer's TTL) → Skip to next
```

### Cascade Limits

| Limit | Value | Purpose |
|-------|-------|---------|
| **Dial timeout** | 10 seconds | Industry standard for fast rerouting |
| **Total cascade time** | 90 seconds | Caller patience limit |
| **Depth limit** | None | Try ALL valid bidders |
| **Bid expiration** | Per-buyer TTL | Filter expired bids before dialing |

### Bid Expiration

Network buyers return a TTL in their PING response (e.g., `expireInSeconds: 120`). The cascade system:
1. Stores `expiresAt` when bid is received
2. Checks expiration before each dial attempt
3. Skips expired bids automatically

Contractors have no expiration (instant bids from config).

## Industry Context (Ringba RTB)

This system follows industry patterns from Ringba RTB:

1. **PING all buyers in parallel** (<100ms to 2s)
2. **Route to highest bidder**
3. **Reroute if no answer** - try next bidder
4. **Short ring timeouts** (5-10 seconds per attempt)
5. **Try all bidders** until someone answers or all exhausted
6. **Check bid expiration** before each reroute attempt

Reference: [Ringba Real-Time Bidding](https://www.ringba.com/blog/pay-per-call/real-time-bidding-for-calls)
