# Buyer Activity Dashboard

## Overview

Add buyer-specific activity tracking to the existing buyer detail page, allowing admins to see all leads pinged, posted, won, and lost per buyer with full transaction history.

## Problem Statement

Admins need visibility into individual buyer performance:
- Which leads were pinged to this buyer?
- What did they bid?
- Which leads did they win/lose?
- What's their response time trend?
- What's their win rate?

## DRY Analysis: What Already Exists

### Reuse These (DO NOT RECREATE):

| Component | Location | Reuse How |
|-----------|----------|-----------|
| `MetricCard` | `src/components/charts/MetricCard.tsx` | Display summary metrics |
| `LineChart` | `src/components/charts/LineChart.tsx` | Response time trends |
| `BarChart` | `src/components/charts/BarChart.tsx` | Bid distribution |
| `withMiddleware` | `src/lib/middleware.ts` | API auth/rate limiting |
| `successResponse/errorResponse` | `src/lib/utils.ts` | API responses |
| `RedisCache` | `src/config/redis.ts` | Cache aggregations |
| Buyer detail page | `src/app/(admin)/admin/buyers/[id]/page.tsx` | Extend with activity tab |
| Transaction model | Prisma schema | Query existing data |

### Create New (Minimal Addition):

1. **One API endpoint**: `GET /api/admin/buyers/[id]/activity`
2. **One React component**: `BuyerActivityTab.tsx`
3. **Extend existing page**: Add tab to buyer detail

## Solution Design

### 1. API Endpoint

**Route**: `GET /api/admin/buyers/[id]/activity`

**Query Params**:
- `timeframe`: `24h` | `7d` | `30d` | `90d` (default: `7d`)
- `page`: number (default: 1)
- `limit`: number (default: 20)

**Response**:
```typescript
{
  success: true,
  data: {
    summary: {
      totalPings: number,
      totalPosts: number,
      leadsWon: number,
      leadsLost: number,
      winRate: number,           // percentage
      avgBidAmount: number,
      avgResponseTime: number,   // ms
      totalRevenue: number
    },
    trends: {
      responseTime: Array<{ date: string, value: number }>,
      bidAmounts: Array<{ date: string, value: number }>,
      winRate: Array<{ date: string, value: number }>
    },
    recentTransactions: Array<{
      id: string,
      leadId: string,
      actionType: 'PING' | 'POST',
      status: 'SUCCESS' | 'FAILED' | 'TIMEOUT',
      bidAmount: number | null,
      responseTime: number,
      won: boolean,
      createdAt: string
    }>,
    pagination: {
      page: number,
      limit: number,
      total: number,
      hasMore: boolean
    }
  }
}
```

**Implementation Notes**:
- Use existing Prisma `Transaction` model queries
- Aggregate with `prisma.transaction.groupBy()` for trends
- Cache with `RedisCache.set()` for 5 minutes
- Follow existing API patterns from `/api/admin/buyers/[id]/route.ts`

### 2. React Component

**File**: `src/components/admin/BuyerActivityTab.tsx`

**Props**:
```typescript
interface BuyerActivityTabProps {
  buyerId: string;
  buyerName: string;
}
```

**UI Structure** (using existing components):
```
┌─────────────────────────────────────────────────────────┐
│ Timeframe: [24h] [7d] [30d] [90d]                       │
├─────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│ │ MetricCard│ │ MetricCard│ │ MetricCard│ │ MetricCard│    │
│ │ Win Rate │ │ Avg Bid  │ │ Resp Time│ │ Revenue  │    │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘    │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────┐ │
│ │           LineChart: Response Time Trend            │ │
│ └─────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│ Recent Transactions                                     │
│ ┌─────┬────────┬────────┬─────────┬──────────┬───────┐ │
│ │ Type│ Lead ID│ Status │ Bid     │ Resp Time│ Won?  │ │
│ ├─────┼────────┼────────┼─────────┼──────────┼───────┤ │
│ │ PING│ abc123 │ SUCCESS│ $25.00  │ 145ms    │ ✅    │ │
│ │ POST│ abc123 │ SUCCESS│ -       │ 203ms    │ -     │ │
│ │ PING│ def456 │ SUCCESS│ $22.00  │ 189ms    │ ❌    │ │
│ └─────┴────────┴────────┴─────────┴──────────┴───────┘ │
│ [Load More]                                             │
└─────────────────────────────────────────────────────────┘
```

### 3. Page Integration

**Extend**: `src/app/(admin)/admin/buyers/[id]/page.tsx`

Add tab navigation:
```
[Details] [Activity] [ZIP Coverage]
```

The Activity tab renders `<BuyerActivityTab buyerId={id} buyerName={buyer.name} />`

## File Changes Summary

| File | Action | Lines Est. |
|------|--------|------------|
| `src/app/api/admin/buyers/[id]/activity/route.ts` | Create | ~150 |
| `src/components/admin/BuyerActivityTab.tsx` | Create | ~200 |
| `src/app/(admin)/admin/buyers/[id]/page.tsx` | Modify | +30 |

**Total New Code**: ~380 lines (leveraging ~500+ lines of existing components)

## Acceptance Criteria

1. Admin can view any buyer's activity history
2. Summary metrics display correctly (win rate, avg bid, response time)
3. Response time trend chart renders with real data
4. Transaction list shows PING/POST history with outcomes
5. Pagination works for large transaction lists
6. Timeframe filter changes data accordingly
7. Page loads in <500ms with Redis caching
8. Follows existing admin UI patterns (styling, layout)

## Out of Scope

- Real-time updates (existing polling pattern is sufficient)
- Export to CSV (future enhancement)
- Comparative analysis between buyers (separate feature)
- Email notifications for buyer performance (separate feature)

## Dependencies

- Existing `Transaction` model with buyerId, actionType, status, bidAmount, responseTime
- Existing chart components in `src/components/charts/`
- Existing buyer detail page at `/admin/buyers/[id]`
- Redis for caching

## Testing

- Unit test for aggregation logic
- Integration test for API endpoint
- Manual verification of UI components (reusing existing tested components)
