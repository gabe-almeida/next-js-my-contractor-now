# Unified Lead Delivery System

**Status:** IN PROGRESS
**Created:** 2026-01-08
**Priority:** HIGH

---

## Goal: Make the Mermaid Diagram a Reality

**Reference:** `docs/lead-flow.mmd`

The Mermaid diagram in `lead-flow.mmd` represents the TARGET architecture for our lead system. Currently, much of it is aspirational - the code doesn't match the diagram.

**This spec exists to bridge that gap.**

Every task below brings us closer to making the diagram accurate. When this spec is complete:
- The diagram will reflect ACTUAL system behavior
- Not a "nice to have" visualization, but living documentation

```
┌─────────────────────────────────────────────────────────────┐
│  CURRENT STATE           →→→→→→→→→→      TARGET STATE       │
│                                                             │
│  Diagram shows features        This spec implements them    │
│  that don't exist              so diagram becomes truth     │
│                                                             │
│  • isWinner/lostReason ❌      • isWinner/lostReason ✅     │
│  • Cascade fallback ❌         • Cascade fallback ✅        │
│  • Contractor direct ❌        • Contractor direct ✅       │
│  • Shared vs Exclusive ❌      • Shared vs Exclusive ✅     │
└─────────────────────────────────────────────────────────────┘
```

---

## Overview

Enhance the auction engine with:
1. Cascading POST fallback through ALL bidders
2. Contractor direct delivery (no PING)
3. Winner/loser tracking for analytics

## Key Decisions

| Decision | Answer |
|----------|--------|
| Cascade limit | ALL bidders until one accepts |
| Contractor pricing | Support all 3: Fixed, Auction, Hybrid |
| Shared lead pricing | Each contractor pays FULL price |
| Delivery confirmation | Not required |
| Lead expiry | Not required |

---

## Schema Changes

### Transaction Model Additions

```prisma
model Transaction {
  // ... existing fields ...

  // Winner/Loser tracking
  isWinner          Boolean?  @map("is_winner")
  lostReason        String?   @map("lost_reason")
  winningBidAmount  Decimal?  @map("winning_bid_amount") @db.Decimal(10, 2)

  // Cascade tracking
  cascadePosition   Int?      @map("cascade_position")

  // Contractor delivery tracking
  deliveryMethod    String?   @map("delivery_method")
}
```

### Buyer Model Additions

```prisma
model Buyer {
  // ... existing fields ...

  // Contractor delivery settings
  deliveryMode      String    @default("EXCLUSIVE") @map("delivery_mode")
  maxSharedLeads    Int       @default(3) @map("max_shared_leads")
  fixedLeadPrice    Decimal?  @map("fixed_lead_price") @db.Decimal(10, 2)
  pricingModel      String    @default("AUCTION") @map("pricing_model")

  // Notification channels
  notifyEmail       Boolean   @default(true) @map("notify_email")
  notifyWebhook     Boolean   @default(false) @map("notify_webhook")
  notifyDashboard   Boolean   @default(true) @map("notify_dashboard")
}
```

### Enums Reference

```
LostReason:
  PING Phase:
    - TIMEOUT
    - NO_BID
    - BELOW_MIN_BID
    - COMPLIANCE_MISSING

  POST Phase:
    - OUTBID
    - POST_REJECTED
    - DUPLICATE_LEAD
    - OUTSIDE_HOURS
    - CAP_REACHED
    - CASCADE_EXHAUSTED

  Contractor:
    - NOT_SELECTED
    - EXCLUSIVE_TAKEN
    - LOWER_PRIORITY

PricingModel:
  - FIXED (pays fixedLeadPrice regardless)
  - AUCTION (maxBid competes with networks)
  - HYBRID (auction for exclusive, reduced for shared)

DeliveryMode:
  - EXCLUSIVE (one contractor gets lead)
  - SHARED (multiple contractors, each pays full)

DeliveryMethod:
  - EMAIL
  - WEBHOOK
  - DASHBOARD
```

---

## Tasks

### Phase 1: Schema Foundation ✅ COMPLETE
- [x] **1.1** Add new fields to Transaction model in schema.prisma
- [x] **1.2** Add new fields to Buyer model in schema.prisma
- [x] **1.3** Create and run migration (used db push for PostgreSQL)
- [x] **1.4** Update seed.ts with example contractor buyers (6 buyers: 3 NETWORK, 3 CONTRACTOR)

### Phase 2: Auction Engine - Winner/Loser Tracking ✅ COMPLETE
- [x] **2.1** Update `logTransaction()` to accept isWinner, lostReason params
- [x] **2.2** After winner selection, mark all PING transactions:
  - Winner: `isWinner: true`
  - Others: `isWinner: false, lostReason: 'OUTBID'`
  - Timeouts: `isWinner: false, lostReason: 'TIMEOUT'`
  - No bids: `isWinner: false, lostReason: 'NO_BID'`
- [x] **2.3** Store `winningBidAmount` on loser transactions for analytics

### Phase 3: Cascading POST Fallback ✅ COMPLETE
- [x] **3.1** Create `deliverWithCascade()` function in auction engine
- [x] **3.2** Sort bids by amount descending after auction
- [x] **3.3** Implement cascade loop:
  ```
  for each bid in rankedBids:
    attempt POST
    if accepted: return success, mark isWinner=true
    if rejected: mark lostReason, cascadePosition++, continue
  return failure (all rejected)
  ```
- [x] **3.4** Parse rejection reasons from buyer response (map to lostReason enum)
- [x] **3.5** Update `runAuction()` to use `deliverWithCascade()` instead of single POST

### Phase 4: Contractor Direct Delivery ✅ COMPLETE
- [x] **4.1** Create `ContractorDeliveryService` in src/lib/services/
- [x] **4.2** In auction engine, split flow by buyer type:
  ```
  if (buyer.type === 'NETWORK') → existing PING/POST flow
  if (buyer.type === 'CONTRACTOR') → direct delivery flow
  ```
- [x] **4.3** Implement contractor ranking:
  - By priority (BuyerServiceZipCode.priority)
  - By maxBid if AUCTION pricing
  - By fixedLeadPrice if FIXED pricing
- [x] **4.4** Implement EXCLUSIVE delivery:
  - Deliver to #1 ranked contractor only
  - Mark others: `isWinner: false, lostReason: 'NOT_SELECTED'`
- [x] **4.5** Implement SHARED delivery:
  - Deliver to top N contractors (maxSharedLeads)
  - Each marked `isWinner: true` (all winners)
  - Revenue = leadPrice × N contractors

### Phase 5: Delivery Methods ✅ COMPLETE
- [x] **5.1** Create email template for contractor lead notification
- [x] **5.2** Implement `sendLeadEmail()` in ContractorDeliveryService
- [x] **5.3** Implement `sendLeadWebhook()` for contractors with CRM
- [x] **5.4** Implement `createDashboardNotification()` for in-app alerts
- [x] **5.5** Record deliveryMethod on each Transaction

### Phase 6: Hybrid Auction (Network + Contractor) ✅ COMPLETE
- [x] **6.1** Handle case: both NETWORK and CONTRACTOR buyers eligible
- [x] **6.2** Decision logic:
  ```
  Run network auction first
  If network winner accepts → done
  If all networks reject → fall back to contractors
  OR: Include AUCTION-priced contractors in network auction
  ```
- [x] **6.3** Ensure no race conditions between delivery paths
- [x] **6.4** Add mutex/lock on lead to prevent double-delivery

### Phase 7: Testing & Verification
- [ ] **7.1** Unit tests for cascading POST logic
- [ ] **7.2** Unit tests for contractor delivery routing
- [ ] **7.3** Integration test: full auction with mixed buyer types
- [ ] **7.4** Test concurrent auction handling (no race conditions)

> **Note:** TypeScript compiles successfully. Pre-existing build issue with affiliate routes is unrelated to this spec.

---

## File Changes Summary

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Add Transaction + Buyer fields |
| `src/lib/auction/engine.ts` | Cascade POST, buyer type routing |
| `src/lib/services/contractor-delivery-service.ts` | NEW: Direct delivery |
| `src/lib/services/lead-notification-service.ts` | NEW: Email/webhook/dashboard |
| `prisma/seed.ts` | Example contractor buyers |

---

## Race Condition Prevention

Critical areas requiring mutex/locking:

1. **Lead state transitions** - Use optimistic locking:
   ```typescript
   await prisma.lead.update({
     where: { id: leadId, status: 'PROCESSING' }, // Only if still processing
     data: { status: 'SOLD', winningBuyerId: buyerId }
   });
   ```

2. **Cascade delivery** - Single async flow, no parallel POSTs

3. **Contractor shared delivery** - Parallel OK (each is independent winner)

4. **Daily cap checks** - Use transaction with row lock:
   ```typescript
   await prisma.$transaction(async (tx) => {
     const count = await tx.transaction.count({ where: {...} });
     if (count >= limit) throw new Error('Cap exceeded');
     await tx.transaction.create({...});
   });
   ```

---

## Progress Tracker

```
Phase 1: Schema         [x] [x] [x] [x]  ✅ COMPLETE
Phase 2: Tracking       [x] [x] [x]      ✅ COMPLETE
Phase 3: Cascade        [x] [x] [x] [x] [x]  ✅ COMPLETE
Phase 4: Contractor     [x] [x] [x] [x] [x]  ✅ COMPLETE
Phase 5: Delivery       [x] [x] [x] [x] [x]  ✅ COMPLETE
Phase 6: Hybrid         [x] [x] [x] [x]  ✅ COMPLETE
Phase 7: Testing        [ ] [ ] [ ] [ ]

Overall: 26/30 tasks complete
```

---

## Quick Reference

After `/compact`, start here:
1. Read this spec: `docs/specs/unified-lead-delivery.md`
2. Check Progress Tracker above
3. Continue from first unchecked task
4. Reference `docs/lead-flow.mmd` for visual architecture

---

## Diagram Alignment Checklist

As each phase completes, verify diagram accuracy:

| Diagram Section | Spec Phase | Matches Reality? |
|-----------------|------------|------------------|
| "3b. SELECT WINNER & RECORD RESULTS" | Phase 2 | [x] |
| `isWinner: true/false` on transactions | Phase 2 | [x] |
| `lostReason: 'OUTBID'` etc. | Phase 2 | [x] |
| "3c. POST TO WINNER" with fallback | Phase 3 | [x] |
| "Try next highest bidder" cascade | Phase 3 | [x] |
| "3d. CONTRACTOR BUYERS - DIRECT" | Phase 4 | [x] |
| "Exclusive or Shared?" decision | Phase 4 | [x] |
| Delivery methods (webhook/email/dash) | Phase 5 | [x] |

**All diagram features are now implemented!**
