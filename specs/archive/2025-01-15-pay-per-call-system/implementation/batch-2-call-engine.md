# Implementation Report: Call Auction Engine (Batch 2 / Task Group 1.5)

**Date:** 2025-01-15
**Status:** COMPLETE
**Tasks Completed:** 30 tasks (P1-AE-1 through P1-AE-16, P1-AE-LOG-1 through P1-AE-LOG-7, P1-AE-DRY-1 through P1-AE-DRY-5)

---

## Summary

Implemented the Call Auction Engine for the Pay-Per-Call system. This engine runs real-time auctions to match incoming calls with the highest-bidding buyer (contractor or network).

## Files Created

### 1. `src/lib/auction/base-engine.ts` (~340 lines)

**Purpose:** Abstract base class providing shared auction logic between lead and call engines.

**Key Exports:**
- `BaseAuctionEngine` - Abstract class with common methods
- `BaseBid`, `CallBid` - Type definitions for bids
- `BaseAuctionResult` - Generic auction result structure
- `AuctionAlreadyCompletedError` - Error for race condition handling
- `CallerHangupError` - Error for caller abandonment

**Shared Methods:**
- `validateBidAmount()` - Validates and clamps bid amounts
- `selectWinner()` - Selects highest bid with tie-breaking by response time
- `withTimeout()` - Wraps async operations with timeout
- `isTimeoutError()` - Detects timeout/abort errors
- `prepareHeaders()` - Builds HTTP headers for buyer API requests
- `logTransaction()` - Logs transactions to database
- `generateAuctionId()` - Creates unique auction identifiers
- `getBuyerDailyCount()` - Gets transaction count for cap checking

### 2. `src/lib/auction/call-engine.ts` (~620 lines)

**Purpose:** Call-specific auction engine extending BaseAuctionEngine.

**Key Exports:**
- `CallAuctionEngine` - The main auction engine class
- `CallAuctionResult` - Call-specific result with transfer details
- `CallAuctionConfig` - Configuration options
- `callAuctionEngine` - Singleton instance

**Configuration Defaults:**
```typescript
{
  pingTimeoutMs: 2000,      // 2 seconds - aggressive for caller experience
  maxCascadeDepth: 3,       // Max 3 transfer attempts
  maxCascadeTimeMs: 8000,   // 8 second total cascade time limit
  requireMinimumBid: true,
  minimumBid: 5.0,
}
```

**Main Flow (`runCallAuction()`):**
1. Load call with relations
2. Check caller is still on line BEFORE auction
3. Get eligible buyers (contractors + networks)
4. Collect bids in parallel (contractors instant, networks PING)
5. Check caller is still on line AFTER bid collection
6. Filter valid bids
7. Select winner with SERIALIZABLE transaction
8. Log winner selection and update bid statuses
9. Return result with transfer number

## Key Features Implemented

### 1. Buyer Eligibility (`getEligibleCallBuyers()`)
- Queries buyers where `accepts_calls = true`
- Filters by service type and ZIP code coverage
- Checks daily cap against `callDailyCap`
- Supports nationwide buyers (no ZIP restrictions)

### 2. Contractor Bid Collection (`collectContractorBid()`)
- **Instant bids** from `buyer_service_configs.call_bid_amount`
- No network latency - 0ms response time
- Validates against `callMinBid` and `callMaxBid`

### 3. Network PING (`collectNetworkBid()`)
- HTTP POST to `callPingUrl` with 2-second timeout
- Parses response for `bidAmount`, `transferNumber`, `bidId`, `expiresAt`
- AbortController for timeout enforcement

### 4. Winner Selection with Race Condition Prevention
- **SERIALIZABLE transaction** prevents concurrent winner selection
- Checks call status is still `BIDDING`
- Verifies no winner already selected
- Atomic update with optimistic locking (`version` field)
- Updates all bid statuses in same transaction

### 5. Caller Hangup Detection
- Calls Twilio API to check call status
- Checked **BEFORE** auction starts
- Checked **AFTER** bid collection
- Cancels all bids if caller abandoned

### 6. Tie-Breaking
- Primary: Highest bid amount wins
- Secondary: Fastest response time (caller is waiting!)

## Logging Implemented

All auction events logged via `logAuctionEvent()` and `createCallActivityLog()`:

| Event | Description | Visibility |
|-------|-------------|------------|
| `auction.started` | Auction initiated | Admin only |
| `auction.eligible_buyers` | Number of eligible buyers | Admin only |
| `auction.buyer_pinged` | PING sent to network | Admin only |
| `auction.bid_received` | Bid received from buyer | Admin only |
| `auction.no_bids` | No valid bids received | Both |
| `auction.winner_selected` | Winner chosen | Both |
| `auction.caller_hangup` | Caller abandoned | Both |
| `auction.timeout` | Network PING timeout | Admin only |

## DRY Principles Applied

### Extracted to BaseAuctionEngine:
1. **Bid validation** - `validateBidAmount()` used by both lead and call engines
2. **Winner selection** - `selectWinner()` with configurable tie-breaking
3. **Timeout handling** - `withTimeout()` generic wrapper
4. **Transaction logging** - `logTransaction()` shared implementation
5. **Header preparation** - `prepareHeaders()` with auth support

### Code Reuse from Existing System:
- `BuyerServiceConfig` queries (same table as leads)
- `BuyerServiceZipCode` coverage checking
- Transaction logging pattern
- Twilio integration utilities

## Database Interactions

### Tables Used:
- `calls` - Main call record (status, winner, bid amounts)
- `call_bids` - Individual bid storage (atomic, prevents race conditions)
- `buyer_service_configs` - Buyer settings and bid amounts
- `buyer_service_zip_codes` - ZIP code coverage
- `transactions` - Action logging
- `call_activity_logs` - User-facing activity feed

### Prisma Transaction:
```typescript
prisma.$transaction(async (tx) => {
  // ... winner selection logic
}, {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 5000,
  timeout: 10000,
});
```

## Testing Recommendations

### Unit Tests:
1. `validateBidAmount()` - edge cases (NaN, negative, out of range)
2. `selectWinner()` - tie-breaking scenarios
3. `parseNetworkPingResponse()` - various response formats
4. `isCallActive()` - Twilio status mapping

### Integration Tests:
1. Full auction flow with mock buyers
2. Caller hangup at different phases
3. Concurrent auction attempts (race condition)
4. Network PING timeout handling
5. Daily cap enforcement

### E2E Tests:
1. Real Twilio webhook flow
2. Auction with actual contractor bids
3. Network PING/response cycle

## Performance Considerations

- **2-second PING timeout** is aggressive but necessary for caller experience
- **Parallel bid collection** minimizes total auction time
- **SERIALIZABLE transaction** may cause retries under high concurrency
- **Caller status check** adds ~100-200ms Twilio API latency

## Next Steps (Task Group 1.6 - Transfer)

1. `P1-TR-1`: Build transfer TwiML with winner's phone number
2. `P1-TR-2`: Pass through caller ID
3. `P1-TR-3`: Enable recording (dual channel)
4. `P1-TR-4`: Set action callback to `/api/calls/completed`
5. `P1-TR-5`: Update call record (status: CONNECTED)
6. `P1-TR-6`: Log CALL_TRANSFER transaction

---

**Implementation completed successfully. All 30 tasks marked complete in tasks.md.**
