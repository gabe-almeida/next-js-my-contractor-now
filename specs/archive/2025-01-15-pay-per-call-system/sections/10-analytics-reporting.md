# Analytics & Reporting

> **Section:** 10 | **Phase:** 3 (Advanced Features)
> **Parent:** [spec.md](../spec.md)

---

## Overview

Detailed analytics dashboards for affiliates and admins.

---

## Data Consistency & Performance

### Eventual Consistency Warning

> **IMPORTANT**: Analytics data is EVENTUALLY CONSISTENT. Real-time metrics may not reflect
> in-flight calls, pending recordings, or transactions being processed.

```typescript
/**
 * WHY: Calls take time to complete, recordings to process, billing to finalize
 * WHEN: Displayed on all analytics dashboards
 * HOW: Show last refresh time and explain potential delays
 */
interface AnalyticsMetadata {
  lastRefreshedAt: Date;
  dataDelay: string; // e.g., "Data may be delayed up to 5 minutes"
  isRealtime: boolean;
  timezone: string;
}

function AnalyticsHeader({ metadata }: { metadata: AnalyticsMetadata }) {
  return (
    <div className="analytics-header">
      <span className="text-muted">
        Last updated: {formatRelativeTime(metadata.lastRefreshedAt)}
      </span>
      {!metadata.isRealtime && (
        <Tooltip content={metadata.dataDelay}>
          <InfoIcon className="h-4 w-4" />
        </Tooltip>
      )}
    </div>
  );
}
```

### Pre-Aggregated Metrics (Performance)

```typescript
/**
 * WHY: Real-time aggregation of millions of calls is too slow
 * WHEN: Dashboard loads with large date ranges (7+ days)
 * HOW: Pre-compute daily summaries in background job
 */

// Database: daily_metrics table
interface DailyMetrics {
  id: string;
  date: Date;
  affiliateId: string | null;   // null = platform-wide
  serviceTypeId: string | null; // null = all services
  buyerId: string | null;       // null = all buyers

  // Call metrics
  totalCalls: number;
  qualifiedCalls: number;
  failedCalls: number;
  totalDurationSeconds: number;

  // Financial metrics
  grossRevenue: Decimal;
  affiliatePayouts: Decimal;
  platformMargin: Decimal;

  // Auction metrics
  avgAuctionTimeMs: number;
  avgBidAmount: Decimal;
  cascadeCount: number;

  createdAt: Date;
  updatedAt: Date;
}

/**
 * WHY: Nightly job aggregates previous day's data
 * WHEN: Runs at 2 AM each night (after business hours)
 * HOW: Aggregates all finalized calls from previous day
 */
async function aggregateDailyMetrics(date: Date): Promise<void> {
  const startOfDay = startOfDay(date);
  const endOfDay = endOfDay(date);

  // Only aggregate FINALIZED calls (not in-progress)
  const metrics = await prisma.call.aggregate({
    where: {
      startTime: { gte: startOfDay, lte: endOfDay },
      status: { in: TERMINAL_STATUSES },
      billingStatus: 'FINALIZED'
    },
    _count: true,
    _sum: {
      totalDurationSeconds: true,  // Maps to calls.total_duration_seconds
      winningBid: true,            // Maps to calls.winning_bid
      affiliatePayout: true        // Maps to calls.affiliate_payout
    },
    _avg: {
      auctionDurationMs: true,
      winningBid: true
    }
  });

  await prisma.dailyMetrics.upsert({
    where: { date_affiliateId_serviceTypeId: { date: startOfDay, affiliateId: null, serviceTypeId: null } },
    create: { date: startOfDay, ...metrics },
    update: metrics
  });
}
```

### Timezone Handling

```typescript
/**
 * WHY: Affiliates are in different timezones than server
 * WHEN: Daily breakdown charts and date filters
 * HOW: Store user timezone, convert on display
 */
interface AnalyticsRequest {
  startDate: Date;
  endDate: Date;
  timezone: string; // e.g., "America/New_York"
  affiliateId?: string;
  serviceTypeId?: string;
}

function adjustForTimezone(date: Date, timezone: string): Date {
  // Convert UTC date to user's timezone for daily buckets
  return utcToZonedTime(date, timezone);
}
```

---

## Affiliate Analytics Dashboard

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  AFFILIATE ANALYTICS                                                             │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  Date Range: [Last 7 Days ▼]    Campaign: [All ▼]    Type: [All ▼]             │
│                                                                                  │
│  ┌─ SUMMARY ────────────────────────────────────────────────────────────────┐   │
│  │                                                                           │   │
│  │   Total Calls    Qualified    Conversion    Avg Duration    Earnings     │   │
│  │   ───────────    ─────────    ──────────    ────────────    ────────     │   │
│  │      347           231          66.5%         3:42          $8,085       │   │
│  │                                                                           │   │
│  │   Total Leads    Sold         Conversion                    Earnings     │   │
│  │   ───────────    ────         ──────────                    ────────     │   │
│  │      156           98           62.8%                        $3,430      │   │
│  │                                                                           │   │
│  └───────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  ┌─ DAILY BREAKDOWN ────────────────────────────────────────────────────────┐   │
│  │                                                                           │   │
│  │  Calls                                     Earnings                       │   │
│  │   60│      ██                              $2000│      ██                │   │
│  │     │   ██ ██ ██                                │   ██ ██ ██             │   │
│  │   40│   ██ ██ ██ ██                        $1500│   ██ ██ ██ ██          │   │
│  │     │██ ██ ██ ██ ██ ██                          │██ ██ ██ ██ ██ ██       │   │
│  │   20│██ ██ ██ ██ ██ ██ ██                  $1000│██ ██ ██ ██ ██ ██ ██    │   │
│  │     └──────────────────────                     └──────────────────────   │   │
│  │      Mon Tue Wed Thu Fri Sat Sun               Mon Tue Wed Thu Fri Sat Sun│   │
│  │                                                                           │   │
│  └───────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  ┌─ BY CAMPAIGN ────────────────────────────────────────────────────────────┐   │
│  │                                                                           │   │
│  │  Campaign          Calls  Qualified  Conv%   Leads  Sold  Conv%  Earnings│   │
│  │  ────────────────────────────────────────────────────────────────────────│   │
│  │  Windows Repair     156      108     69%      78     52    67%   $5,580  │   │
│  │  HVAC Emergency      98       67     68%      42     26    62%   $3,350  │   │
│  │  Roofing             93       56     60%      36     20    56%   $2,585  │   │
│  │                                                                           │   │
│  └───────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Admin Analytics

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  ADMIN: CALL ANALYTICS                                                           │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─ SYSTEM HEALTH ──────────────────────────────────────────────────────────┐   │
│  │                                                                           │   │
│  │   Calls Today     Avg Auction Time    Avg Connect Time    Transfer Rate  │   │
│  │   ───────────     ────────────────    ────────────────    ─────────────  │   │
│  │      1,247            1.8s                4.2s               94.2%       │   │
│  │                                                                           │   │
│  └───────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  ┌─ BUYER PERFORMANCE ──────────────────────────────────────────────────────┐   │
│  │                                                                           │   │
│  │  Buyer            Type       Calls Won  Avg Bid   Answer Rate  Avg Dur   │   │
│  │  ─────────────────────────────────────────────────────────────────────── │   │
│  │  ABC Plumbing     CONTRACTOR    187      $52       96%         4:32      │   │
│  │  XYZ HVAC         CONTRACTOR    143      $48       94%         3:58      │   │
│  │  Modernize        NETWORK       312      $58       98%         5:12      │   │
│  │  HomeAdvisor      NETWORK       267      $55       97%         4:45      │   │
│  │                                                                           │   │
│  └───────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  ┌─ AFFILIATE PERFORMANCE ──────────────────────────────────────────────────┐   │
│  │                                                                           │   │
│  │  Affiliate         Calls    Qualified   Conv%    Revenue    Payout      │   │
│  │  ─────────────────────────────────────────────────────────────────────── │   │
│  │  John's Marketing    456       312      68%     $17,160    $10,920      │   │
│  │  Sarah's Ads         387       251      65%     $13,805     $8,785      │   │
│  │  Performance Co      298       189      63%     $10,395     $6,615      │   │
│  │                                                                           │   │
│  └───────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Key Metrics

### Call Metrics
| Metric | Description | Calculation |
|--------|-------------|-------------|
| Total Calls | All calls received | Count of calls |
| Qualified Calls | Calls meeting duration threshold | duration >= min_call_duration |
| Conversion Rate | Qualified / Total | qualified / total * 100 |
| Average Duration | Mean call length | SUM(duration) / COUNT |
| Transfer Rate | Successful transfers | transferred / total * 100 |

### Auction Metrics
| Metric | Description | Calculation |
|--------|-------------|-------------|
| Avg Auction Time | Time from IVR to transfer | AVG(auction_duration_ms) |
| Avg Bid Amount | Mean winning bid | AVG(winning_bid) |
| Fill Rate | Calls with bids | calls_with_bids / total |
| Cascade Rate | Needed 2nd+ buyer | cascaded / total * 100 |

### Financial Metrics
| Metric | Description | Calculation |
|--------|-------------|-------------|
| Gross Revenue | Total buyer payments | SUM(winning_bid) |
| Affiliate Payouts | Total paid to affiliates | SUM(affiliate_payout) |
| Platform Margin | Net revenue | gross - payouts |
| Margin % | Platform percentage | margin / gross * 100 |

---

## User Stories

### US-AN-1: New Affiliate Sees Empty Dashboard
**WHY**: New affiliates shouldn't see confusing zeros or broken charts
**WHEN**: Affiliate has no calls yet, or filtered date range has no data
**HOW**:
- Show friendly "No data yet" message
- Suggest actions: "Create your first campaign" or "Adjust date range"
- Don't show charts with zero values (confusing)

**Acceptance Criteria**:
- [ ] Empty state shows helpful message
- [ ] CTA button leads to relevant action
- [ ] No broken or empty charts displayed
- [ ] Clear indication of why there's no data

---

### US-AN-2: Affiliate Notices Metrics Don't Add Up
**WHY**: Data updates asynchronously, can appear inconsistent
**WHEN**: Affiliate refreshes while calls are in progress
**HOW**:
- Show "Last updated: X minutes ago" timestamp
- Add refresh button with rate limiting (1 per 30 seconds)
- Tooltip explaining data delay
- Exclude in-progress calls from metrics

**Acceptance Criteria**:
- [ ] Last refresh timestamp visible
- [ ] Refresh button with rate limiting
- [ ] Tooltip explains "Data may be delayed up to 5 minutes"
- [ ] In-progress calls not counted in metrics

---

### US-AN-3: Admin Needs Large Date Range Export
**WHY**: Accounting/reporting needs historical data (90+ days)
**WHEN**: Admin selects large date range for export
**HOW**:
- Large ranges trigger background export job
- Email notification when export ready
- Download link expires after 24 hours
- Progress indicator for long-running exports

**Acceptance Criteria**:
- [ ] Ranges > 30 days trigger async export
- [ ] Progress indicator shown
- [ ] Email sent when complete
- [ ] Download link in email and dashboard
- [ ] Link expires after 24 hours

---

### US-AN-4: Dashboard Loads Slowly
**WHY**: Large datasets cause performance issues
**WHEN**: Dashboard with many campaigns or long date range
**HOW**:
- Use pre-aggregated daily_metrics table
- Lazy load charts (show summary first)
- Limit default date range to 7 days
- Cache aggregated results for 5 minutes

**Acceptance Criteria**:
- [ ] Dashboard loads in < 2 seconds
- [ ] Large date ranges use aggregated data
- [ ] Summary cards load first
- [ ] Charts lazy load after initial render

---

## Empty States

```typescript
function AnalyticsEmptyState({ reason }: { reason: 'no-data' | 'no-campaigns' | 'date-range-empty' }) {
  const content = {
    'no-data': {
      icon: <ChartIcon />,
      title: 'No calls yet',
      description: 'Once you receive calls, your analytics will appear here.',
      cta: { label: 'Create Campaign', href: '/campaigns/new' }
    },
    'no-campaigns': {
      icon: <PlusIcon />,
      title: 'No campaigns created',
      description: 'Create your first campaign to start receiving calls.',
      cta: { label: 'Create Campaign', href: '/campaigns/new' }
    },
    'date-range-empty': {
      icon: <CalendarIcon />,
      title: 'No data for this period',
      description: 'Try selecting a different date range.',
      cta: { label: 'Reset to Last 7 Days', onClick: resetDateRange }
    }
  };

  return <EmptyState {...content[reason]} />;
}
```

---

## Caching Strategy

```typescript
/**
 * WHY: Prevent hammering database with identical queries
 * WHEN: Multiple users viewing same dashboard, or rapid refreshes
 * HOW: Cache aggregated results with TTL based on data freshness
 */
interface AnalyticsCache {
  key: string; // e.g., "analytics:affiliate:123:2025-01-01:2025-01-07"
  ttlSeconds: number;
  data: AnalyticsData;
}

const CACHE_CONFIG = {
  // Today's data: short cache (data still changing)
  today: 60,       // 1 minute
  // Yesterday's data: medium cache (mostly stable)
  yesterday: 300,  // 5 minutes
  // Historical data: long cache (finalized)
  historical: 3600 // 1 hour
};

async function getCachedAnalytics(request: AnalyticsRequest): Promise<AnalyticsData> {
  const cacheKey = buildCacheKey(request);
  const cached = await redis.get(cacheKey);

  if (cached) {
    return JSON.parse(cached);
  }

  const data = await computeAnalytics(request);
  const ttl = determineTTL(request);

  await redis.setex(cacheKey, ttl, JSON.stringify(data));
  return data;
}
```

---

## Real-time Updates (Optional Enhancement)

```typescript
/**
 * WHY: Live dashboards for monitoring during high-volume periods
 * WHEN: Admin needs real-time system health view
 * HOW: WebSocket for incremental updates, rate-limited
 */
function useRealtimeMetrics(enabled: boolean) {
  const [metrics, setMetrics] = useState<RealtimeMetrics | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const ws = new WebSocket('/api/analytics/realtime');

    ws.onmessage = (event) => {
      const update = JSON.parse(event.data);
      setMetrics(prev => ({
        ...prev,
        ...update,
        lastUpdated: new Date()
      }));
    };

    return () => ws.close();
  }, [enabled]);

  return metrics;
}

// Server-side: Rate-limit updates to 1 per second max
const REALTIME_UPDATE_INTERVAL_MS = 1000;
```

---

## Implementation Tasks

| Task ID | Description | Status |
|---------|-------------|--------|
| P3-AN-1 | Create affiliate analytics page | ⬜ |
| P3-AN-2 | Implement summary cards component | ⬜ |
| P3-AN-3 | Create daily breakdown charts | ⬜ |
| P3-AN-4 | Create campaign breakdown table | ⬜ |
| P3-AN-5 | Create admin analytics dashboard | ⬜ |
| P3-AN-6 | Implement system health metrics | ⬜ |
| P3-AN-7 | Create buyer performance table | ⬜ |
| P3-AN-8 | Create affiliate performance table | ⬜ |
| P3-AN-9 | Add date range filters | ⬜ |
| P3-AN-10 | Add export to CSV/Excel | ⬜ |

### Data Consistency Tasks

| Task ID | Description | Status |
|---------|-------------|--------|
| P3-AN-DC-1 | Create `daily_metrics` table for pre-aggregation | ⬜ |
| P3-AN-DC-2 | Create nightly aggregation job | ⬜ |
| P3-AN-DC-3 | Add "Last updated" timestamp to dashboards | ⬜ |
| P3-AN-DC-4 | Add refresh button with rate limiting | ⬜ |
| P3-AN-DC-5 | Add tooltip explaining data delay | ⬜ |
| P3-AN-DC-6 | Store user timezone preference | ⬜ |
| P3-AN-DC-7 | Convert dates to user timezone for display | ⬜ |

### Performance Tasks

| Task ID | Description | Status |
|---------|-------------|--------|
| P3-AN-PERF-1 | Implement Redis caching for analytics queries | ⬜ |
| P3-AN-PERF-2 | Use pre-aggregated data for ranges > 7 days | ⬜ |
| P3-AN-PERF-3 | Lazy load charts after summary cards | ⬜ |
| P3-AN-PERF-4 | Add database indexes for common queries | ⬜ |
| P3-AN-PERF-5 | Implement pagination for long tables | ⬜ |
| P3-AN-PERF-6 | Add async export for large date ranges | ⬜ |

### Empty State Tasks

| Task ID | Description | Status |
|---------|-------------|--------|
| P3-AN-ES-1 | Create AnalyticsEmptyState component | ⬜ |
| P3-AN-ES-2 | Handle "no campaigns" empty state | ⬜ |
| P3-AN-ES-3 | Handle "no data in date range" empty state | ⬜ |
| P3-AN-ES-4 | Add CTAs to empty states | ⬜ |

### Real-time Enhancement Tasks (Optional)

| Task ID | Description | Status |
|---------|-------------|--------|
| P3-AN-RT-1 | Create WebSocket endpoint for real-time metrics | ⬜ |
| P3-AN-RT-2 | Implement rate-limited metric updates (1/sec) | ⬜ |
| P3-AN-RT-3 | Add real-time toggle to admin dashboard | ⬜ |

### Logging Tasks

> **See Also**: [Section 12: Logging & Observability](./12-logging-observability.md) for full logging architecture

| Task ID | Description | Status |
|---------|-------------|--------|
| P3-AN-LOG-1 | Log analytics dashboard loads with user role and filters | ⬜ |
| P3-AN-LOG-2 | Log slow queries (> 2 seconds) with query details | ⬜ |
| P3-AN-LOG-3 | Log cache hits/misses for performance monitoring | ⬜ |
| P3-AN-LOG-4 | Log export requests with date range and format | ⬜ |
| P3-AN-LOG-5 | Log export completions with file size and duration | ⬜ |
| P3-AN-LOG-6 | Log nightly aggregation job start/success/failure | ⬜ |
| P3-AN-LOG-7 | Log real-time WebSocket connections (if implemented) | ⬜ |
| P3-AN-LOG-8 | Log refresh rate limit violations | ⬜ |

**Analytics Events to Log:**

| Event | Level | Admin-Only | Description |
|-------|-------|------------|-------------|
| `analytics.dashboard_loaded` | info | ❌ | User viewed dashboard |
| `analytics.slow_query` | warn | ✅ | Query exceeded 2s threshold |
| `analytics.cache_hit` | debug | ✅ | Result served from cache |
| `analytics.cache_miss` | debug | ✅ | Cache miss, queried database |
| `analytics.export_started` | info | ❌ | User initiated export |
| `analytics.export_completed` | info | ❌ | Export file ready |
| `analytics.export_failed` | error | ❌ | Export job failed |
| `analytics.aggregation_started` | info | ✅ | Nightly job began |
| `analytics.aggregation_completed` | info | ✅ | Nightly job finished |
| `analytics.rate_limited` | warn | ✅ | Refresh rate limit hit |

---

### Testing Tasks

| Task ID | Description | Status |
|---------|-------------|--------|
| P3-AN-T1 | Test pre-aggregation job accuracy | ⬜ |
| P3-AN-T2 | Test cache invalidation on new data | ⬜ |
| P3-AN-T3 | Test timezone conversion for daily charts | ⬜ |
| P3-AN-T4 | Test empty states for all scenarios | ⬜ |
| P3-AN-T5 | Test large date range export (90+ days) | ⬜ |
| P3-AN-T6 | Performance test with 100k+ calls | ⬜ |

---

## Data Consistency Summary

| Issue | Solution | Implementation |
|-------|----------|----------------|
| In-flight calls | Exclude from metrics | `status: { in: TERMINAL_STATUSES }` filter |
| Stale cache | TTL-based expiration | Redis with 1-60 min TTL based on data age |
| Large date ranges | Pre-aggregation | `daily_metrics` table with nightly job |
| Timezone confusion | User preference | Store timezone, convert on display |
| Confusing zeros | Empty states | Specific UX for each empty scenario |
| Slow refresh | Rate limiting | 30-second cooldown on refresh button |

---

*Section Version: 1.2 - Cross-Section Audit: Fixed Prisma field name to totalDurationSeconds (matches calls.total_duration_seconds)*
