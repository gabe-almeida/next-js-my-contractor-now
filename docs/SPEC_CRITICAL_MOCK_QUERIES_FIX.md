# Specification: Fix Critical Mock Database Queries

**Date**: 2025-10-20
**Priority**: CRITICAL - BLOCKS PRODUCTION
**Estimated Time**: 2-4 hours
**Status**: In Progress

---

## Problem Statement

The codebase contains 14 instances of mock database queries that return fake/random data. Three of these are CRITICAL and will cause complete system failure in production:

1. **Auction Engine Daily Volume** - Returns random numbers instead of real buyer lead counts
2. **Worker Active Buyers** - Returns hardcoded mock buyers instead of querying database
3. **Auction Engine Winning Bid** - Always returns 0 instead of actual bid amount

---

## Impact Analysis

### Issue #1: Random Daily Volume
- **Severity**: CRITICAL
- **Financial Risk**: HIGH
- **Compliance Risk**: HIGH
- **Impact**: Buyer daily lead limits not enforced, potential over-delivery and contract violations

### Issue #2: Hardcoded Buyers
- **Severity**: CRITICAL
- **System Failure**: GUARANTEED
- **Impact**: No real buyers will ever receive leads. The worker will only contact two fake buyers that don't exist.

### Issue #3: Zero Winning Bid
- **Severity**: CRITICAL
- **Revenue Tracking**: BROKEN
- **Impact**: All POST requests send $0 as winning bid, buyers receive incorrect auction metadata

---

## Technical Specification

### 1. Fix AuctionEngine.getBuyerDailyVolume()

**File**: `/src/lib/auction/engine.ts`
**Lines**: 723-727

**Current Code**:
```typescript
private static async getBuyerDailyVolume(buyerId: string): Promise<number> {
  // This would typically query a database
  // For now, return a mock value
  return Math.floor(Math.random() * 100);
}
```

**Required Change**:
```typescript
private static async getBuyerDailyVolume(buyerId: string): Promise<number> {
  try {
    const { prisma } = await import('../db');
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const count = await prisma.transaction.count({
      where: {
        buyerId,
        actionType: 'POST',
        status: 'SUCCESS',
        createdAt: {
          gte: startOfDay
        }
      }
    });

    return count;
  } catch (error) {
    logger.error('Failed to get buyer daily volume', {
      buyerId,
      error: (error as Error).message
    });
    return 0;
  }
}
```

**Database Schema**:
- Table: `Transaction`
- Fields: `buyerId`, `actionType`, `status`, `createdAt`
- Query: Count POST transactions with SUCCESS status created today

**Testing Criteria**:
- Returns 0 for buyers with no transactions today
- Returns accurate count for buyers with multiple transactions
- Handles database errors gracefully
- Performance: Query should execute in < 50ms

---

### 2. Fix Worker.getActiveBuyers()

**File**: `/src/lib/worker.ts`
**Lines**: 162-197

**Current Code**:
```typescript
private async getActiveBuyers(serviceTypeId: string) {
  // In real app, this would query the database
  // For demo, return mock buyers
  return [
    {
      id: '550e8400-e29b-41d4-a716-446655440011',
      name: 'HomeAdvisor',
      apiUrl: 'https://api.homeadvisor.com/leads',
      // ... more hardcoded data
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440012',
      name: 'Modernize',
      apiUrl: 'https://api.modernize.com/leads',
      // ... more hardcoded data
    }
  ];
}
```

**Required Change**:
```typescript
private async getActiveBuyers(serviceTypeId: string) {
  try {
    const { prisma } = await import('../db');

    // Query buyers with active service configurations for this service type
    const buyers = await prisma.buyer.findMany({
      where: {
        active: true,
        buyerServiceConfigs: {
          some: {
            serviceTypeId,
            active: true
          }
        }
      },
      include: {
        buyerServiceConfigs: {
          where: {
            serviceTypeId,
            active: true
          },
          include: {
            serviceType: true
          }
        }
      }
    });

    // Transform to expected format
    return buyers.map(buyer => ({
      id: buyer.id,
      name: buyer.name,
      apiUrl: buyer.apiUrl,
      authType: buyer.authType,
      authConfig: buyer.authConfig,
      active: buyer.active,
      serviceConfig: buyer.buyerServiceConfigs[0] // First matching config
    }));
  } catch (error) {
    console.error('Failed to get active buyers:', error);
    return [];
  }
}
```

**Database Schema**:
- Table: `Buyer`
- Relations: `buyerServiceConfigs` → `BuyerServiceConfig`
- Query: Find active buyers with active service configs for the given service type

**Testing Criteria**:
- Returns empty array when no buyers exist
- Returns only active buyers
- Filters by service type correctly
- Includes buyer configuration data
- Handles database errors gracefully
- Performance: Query should execute in < 100ms

---

### 3. Fix AuctionEngine.getWinningBid()

**File**: `/src/lib/auction/engine.ts`
**Lines**: 732-736

**Current Code**:
```typescript
private static async getWinningBid(leadId: string): Promise<number> {
  // Find the winning bid from recent auction results
  // This would typically query a database
  return 0;
}
```

**Required Change**:
```typescript
private static async getWinningBid(leadId: string): Promise<number> {
  try {
    const { prisma } = await import('../db');

    // Find the highest successful PING bid for this lead
    const winningTransaction = await prisma.transaction.findFirst({
      where: {
        leadId,
        actionType: 'PING',
        status: 'SUCCESS',
        bidAmount: {
          not: null
        }
      },
      orderBy: {
        bidAmount: 'desc'
      },
      select: {
        bidAmount: true
      }
    });

    return winningTransaction?.bidAmount || 0;
  } catch (error) {
    logger.error('Failed to get winning bid', {
      leadId,
      error: (error as Error).message
    });
    return 0;
  }
}
```

**Database Schema**:
- Table: `Transaction`
- Fields: `leadId`, `actionType`, `status`, `bidAmount`
- Query: Find highest PING bid with SUCCESS status for the lead

**Testing Criteria**:
- Returns 0 when no transactions exist for lead
- Returns highest bid when multiple bids exist
- Ignores failed transactions
- Only considers PING transactions (not POST)
- Handles null bidAmount gracefully
- Performance: Query should execute in < 50ms

---

## Implementation Plan

### Phase 1: Read and Analyze (15 min)
1. Read `/src/lib/auction/engine.ts` completely
2. Read `/src/lib/worker.ts` completely
3. Verify database schema for `Transaction` and `Buyer` tables
4. Check for any dependencies or side effects

### Phase 2: Implementation (60 min)
1. Fix `getBuyerDailyVolume()` in auction engine
2. Fix `getActiveBuyers()` in worker
3. Fix `getWinningBid()` in auction engine
4. Add proper error handling and logging
5. Ensure type safety

### Phase 3: Testing (45 min)
1. Create unit tests for each function
2. Test with empty database (edge cases)
3. Test with real data
4. Test error handling
5. Performance testing
6. Integration testing with full auction flow

### Phase 4: Verification (30 min)
1. Verify no other references to mock data in these files
2. Confirm all three functions now use real database queries
3. Check for any remaining TODOs or FIXME comments
4. Run full test suite

---

## Acceptance Criteria

### Must Have (Production Blockers)
- [ ] `getBuyerDailyVolume()` returns real database count
- [ ] `getActiveBuyers()` queries real buyer records
- [ ] `getWinningBid()` returns actual bid amount
- [ ] All three functions have proper error handling
- [ ] No Math.random() calls remain in these functions
- [ ] No hardcoded mock data remains
- [ ] Database queries are performant (< 100ms)

### Should Have (Quality)
- [ ] Functions are unit tested
- [ ] Edge cases are handled (empty results, null values)
- [ ] Logging is comprehensive
- [ ] TypeScript types are correct
- [ ] Code follows existing patterns

### Nice to Have (Future)
- [ ] Query result caching for performance
- [ ] Metrics collection for monitoring
- [ ] Query optimization with indexes

---

## Risk Mitigation

### Risk 1: Database Performance
**Mitigation**: Use selective queries with proper indexes, add caching where appropriate

### Risk 2: Breaking Existing Functionality
**Mitigation**: Thorough testing, compare behavior with mock data vs real data

### Risk 3: Null/Undefined Edge Cases
**Mitigation**: Comprehensive null checks, fallback to safe defaults (0 or [])

---

## Testing Strategy

### Unit Tests
```typescript
describe('AuctionEngine.getBuyerDailyVolume', () => {
  it('should return 0 for buyer with no transactions', async () => {
    const volume = await AuctionEngine.getBuyerDailyVolume('nonexistent');
    expect(volume).toBe(0);
  });

  it('should count only successful POST transactions', async () => {
    // Create test data: 3 SUCCESS, 2 FAILED
    // Expect count to be 3
  });

  it('should only count transactions from today', async () => {
    // Create transactions yesterday and today
    // Expect only today's count
  });
});
```

### Integration Tests
```typescript
describe('Full Auction Flow with Real Queries', () => {
  it('should run auction with real buyers from database', async () => {
    // Create buyer in database
    // Create lead
    // Run auction
    // Verify buyer was contacted
    // Verify winning bid is recorded correctly
    // Verify daily volume increments
  });
});
```

---

## Rollback Plan

If issues are discovered:
1. Git revert to previous working version
2. Restore mock functions temporarily
3. Fix issues
4. Re-deploy

---

## Success Metrics

- ✅ All three functions query real database
- ✅ No mock data or random numbers remain
- ✅ Tests pass 100%
- ✅ Performance acceptable (< 100ms per query)
- ✅ Error handling prevents crashes
- ✅ System processes real leads end-to-end

---

## Related Issues

This fixes the following critical issues identified in audit:
- Issue #1: Auction Engine Random Daily Volume
- Issue #2: Worker Hardcoded Buyers
- Issue #3: Auction Engine Zero Winning Bid

After completion, 11 additional mock query issues remain (see code analysis report).

---

## Dependencies

- Prisma ORM configured and working
- Database schema includes Transaction and Buyer tables
- Database connection pool adequate for additional queries
- Logger utility available for error logging

---

## Notes

- Similar fix was already applied to `BuyerEligibilityService.getDailyLeadCount()`
- Follow same pattern for consistency
- Ensure all imports use `await import('../db')` pattern
- Use proper TypeScript types from Prisma client
