# Affiliate Portal

> **Section:** 06 | **Phase:** 1 (MVP)
> **Parent:** [spec.md](../spec.md)

---

## Overview

The affiliate portal **EXTENDS the existing lead-based affiliate system** to add call tracking capabilities. Affiliates can track earnings from both lead referrals (existing) AND phone calls (new) in a unified dashboard experience.

---

## Existing System Integration

> ⚠️ **CRITICAL**: An affiliate system ALREADY EXISTS in the codebase. This spec EXTENDS it, not replaces it.

### What Already Exists (DO NOT REBUILD)

The following affiliate features are already implemented and working:

| Feature | Location | Status |
|---------|----------|--------|
| Affiliate Signup | `/affiliate/signup` | ✅ Built |
| Signup API | `/api/affiliates/signup` | ✅ Built |
| Admin Approval Flow | PENDING status until approved | ✅ Built |
| Affiliate Dashboard | `/affiliate/dashboard` | ✅ Built |
| Leads Tracking | `/affiliate/leads` | ✅ Built |
| Tracking Links | `/affiliate/links` | ✅ Built |
| Commissions | `/affiliate/commissions` | ✅ Built |
| Withdrawals | `/affiliate/withdrawals` | ✅ Built |
| Settings | `/affiliate/settings` | ✅ Built |
| Sentry Error Capture | API routes | ✅ Built |

**Existing Files:**
- `src/app/(affiliate)/affiliate/signup/page.tsx`
- `src/app/(affiliate)/affiliate/dashboard/page.tsx`
- `src/app/(affiliate)/affiliate/leads/page.tsx`
- `src/app/(affiliate)/affiliate/links/page.tsx`
- `src/app/(affiliate)/affiliate/commissions/page.tsx`
- `src/app/(affiliate)/affiliate/withdrawals/page.tsx`
- `src/app/(affiliate)/affiliate/settings/page.tsx`
- `src/app/api/affiliates/signup/route.ts`
- `src/lib/services/affiliate-service.ts`

### What This Spec ADDS

This Pay-Per-Call spec adds **call tracking capabilities** to the existing lead-based affiliate system:

| New Feature | Description |
|-------------|-------------|
| Call Tracking Numbers | Twilio-provisioned numbers for call attribution |
| Call Recordings | Inline playback of call recordings |
| Combined Activity Feed | Shows both 📞 calls AND 📝 leads in one view |
| Call Earnings | Payouts for qualified calls (configurable duration threshold) |
| Phone Number Provisioning | Self-service number provisioning per campaign |

### Integration Warning

> ⚠️ **PAY SPECIAL ATTENTION**: When implementing call tracking features, extra care must be taken to ensure proper integration with the existing affiliate system:

**Integration Points to Verify:**

1. **Dashboard Stats**
   - Existing: `totalEarnings`, `pendingEarnings`, `availableBalance`, `totalClicks`, `totalConversions`
   - New: Must ADD call stats without breaking existing lead stats
   - Verify: `DashboardStats` component accepts both call and lead data

2. **Earnings Calculations**
   - Existing: Commission based on lead sales
   - New: Commission based on qualified calls
   - Verify: Both earning types flow to same `availableBalance` for withdrawals

3. **Activity Feed**
   - Existing: Shows leads only
   - New: Must show calls AND leads in unified feed
   - Verify: Filtering works for "All", "Calls Only", "Leads Only"

4. **Database Schema**
   - Existing: `affiliates`, `affiliate_links`, leads tables
   - New: `tracking_numbers`, `calls` tables with `affiliateId` foreign key
   - Verify: Foreign keys reference existing `affiliates` table correctly

5. **API Authentication**
   - Existing: `affiliate_token` in localStorage, Bearer auth
   - New: Call APIs must use SAME authentication pattern
   - Verify: New endpoints follow existing auth middleware pattern

6. **Withdrawal System**
   - Existing: Withdrawals from lead commissions
   - New: Call earnings must be included in withdrawable balance
   - Verify: `availableBalance` calculation includes both sources

**Before Implementation Checklist:**
- [ ] Review existing `affiliate-service.ts` for patterns to follow
- [ ] Review existing API routes for auth/response patterns
- [ ] Review existing dashboard components for extension points
- [ ] Test that existing affiliate features still work after changes
- [ ] Ensure database migrations don't break existing affiliate data

---

## 🔴 DRY PRINCIPLE: Reuse Existing UI Components

> ⚠️ **CRITICAL**: This project has a mature component library. DO NOT create duplicate components!

### Existing Reusable Components (MUST USE)

The following components already exist and MUST be reused for the affiliate portal:

#### Base UI Primitives (`src/components/ui/`)

| Component | File | Use For |
|-----------|------|---------|
| `Card` | `Card.tsx` | Campaign cards, stat cards, any card layout |
| `Badge` | `Badge.tsx` | Status badges (Qualified, Pending, etc.) |
| `Button` | `Button.tsx` | All buttons |
| `LoadingSpinner` | `LoadingSpinner.tsx` | Loading states |
| `SkeletonLoader` | `SkeletonLoader.tsx` | Content loading placeholders |
| `Toast` | `Toast.tsx` | Success/error notifications |
| `Input` | `input.tsx` | Form inputs |
| `Label` | `label.tsx` | Form labels |
| `ErrorBoundary` | `ErrorBoundary.tsx` | Error catching |
| `PortalDropdown` | `PortalDropdown.tsx` | Dropdown menus |

#### Admin UI Patterns (`src/components/admin/ui/`)

| Component | File | Use For (Affiliate Portal Equivalent) |
|-----------|------|---------------------------------------|
| `AdminCard` | `AdminCard.tsx` | **Use for campaign/stats cards** - same pattern works |
| `AdminDataTable` | `AdminDataTable.tsx` | **Use for calls/leads tables** - sortable, paginated |
| `AdminBadge` | `AdminBadge.tsx` | **Use for status badges** - same style |
| `AdminPageHeader` | `AdminPageHeader.tsx` | **Use for page headers** - title + actions |
| `AdminDetailPageHeader` | `AdminDetailPageHeader.tsx` | **Use for call detail page** - breadcrumbs |
| `AdminTabNav` | `AdminTabNav.tsx` | **Use for dashboard tabs** (Calls/Leads/All) |
| `AdminStatGrid` | `AdminStatGrid.tsx` | **Use for earnings overview** - stat cards grid |
| `AdminSection` | `AdminSection.tsx` | **Use for page sections** - collapsible |
| `AdminInfoGrid` | `AdminInfoGrid.tsx` | **Use for call details** - key/value display |
| `AdminSearch` | `AdminSearch.tsx` | **Use for filtering** - search input |

#### Admin Feature Components (Adapt These)

| Component | File | Adapt For |
|-----------|------|-----------|
| `LeadTable` | `LeadTable.tsx` | **Study for CallsTable** - same patterns |
| `LeadDetailModal` | `LeadDetailModal.tsx` | **Study for CallDetailModal** - same modal pattern |
| `LeadStatusHistory` | `LeadStatusHistory.tsx` | **Study for CallActivityLog** - timeline display |
| `ChangeStatusModal` | `ChangeStatusModal.tsx` | **Study for DisputeModal** - form modal pattern |

### Component Mapping for Affiliate Portal

When implementing affiliate portal pages, use this mapping:

```
AFFILIATE NEED                  →  EXISTING COMPONENT TO USE
─────────────────────────────────────────────────────────────
Earnings stat cards             →  AdminStatGrid + AdminCard
Campaign list                   →  AdminCard (repeated)
Calls/Leads table               →  AdminDataTable (sortable, paginated)
Call status badge               →  AdminBadge or Badge
Page header with actions        →  AdminPageHeader
Call detail modal               →  LeadDetailModal pattern (adapt)
Activity timeline               →  LeadStatusHistory pattern (adapt)
Search/filter bar               →  AdminSearch
Tabs (Calls/Leads/All)          →  AdminTabNav
Loading states                  →  LoadingSpinner, SkeletonLoader
Empty states                    →  Create shared EmptyState component
Form inputs                     →  Input, Label, Textarea from ui/
Dropdowns                       →  PortalDropdown
Notifications                   →  Toast
```

### ❌ DO NOT Create These Components

The following components should NOT be created - use existing ones:

```
❌ AffiliateCard           →  Use AdminCard
❌ AffiliateTable          →  Use AdminDataTable
❌ AffiliateBadge          →  Use AdminBadge or Badge
❌ AffiliatePageHeader     →  Use AdminPageHeader
❌ AffiliateStatCard       →  Use AdminStatGrid + AdminCard
❌ AffiliateSearch         →  Use AdminSearch
❌ AffiliateTabs           →  Use AdminTabNav
```

### ✅ NEW Components to Create (Only These)

Only create these truly new components that don't have equivalents:

```
✅ RecordingPlayer.tsx     →  Audio player (unique to calls)
✅ ProvisionNumberModal.tsx →  Twilio number provisioning (unique)
✅ CampaignRequestForm.tsx →  Campaign access request (unique)
✅ DisputeCallForm.tsx     →  Call dispute submission (unique)
```

### Implementation Checklist

Before creating ANY new component:

- [ ] Search `src/components/ui/` for existing primitive
- [ ] Search `src/components/admin/ui/` for existing pattern
- [ ] Search `src/components/admin/` for similar feature component
- [ ] If similar exists, EXTEND or COMPOSE it
- [ ] Only create new if truly unique functionality needed
- [ ] New components go in `src/components/affiliate/` but should compose from ui/admin

### Example: Correct Implementation

```tsx
// ❌ WRONG: Creating duplicate card component
function AffiliateStatCard({ title, value }) {
  return <div className="affiliate-stat-card">...</div>;
}

// ✅ CORRECT: Reusing AdminStatGrid
import { AdminStatGrid } from '@/components/admin/ui/AdminStatGrid';
import { AdminCard } from '@/components/admin/ui/AdminCard';

function AffiliateEarningsOverview({ stats }) {
  return (
    <AdminStatGrid>
      <AdminCard>
        <AdminCard.Header>Today</AdminCard.Header>
        <AdminCard.Value>${stats.today}</AdminCard.Value>
        <AdminCard.Subtitle>{stats.todayCalls} calls</AdminCard.Subtitle>
      </AdminCard>
      {/* ... more cards */}
    </AdminStatGrid>
  );
}
```

```tsx
// ❌ WRONG: Creating duplicate table component
function CallsTable({ calls }) {
  return <table className="calls-table">...</table>;
}

// ✅ CORRECT: Reusing AdminDataTable
import { AdminDataTable } from '@/components/admin/ui/AdminDataTable';
import { AdminBadge } from '@/components/admin/ui/AdminBadge';

function CallsTable({ calls }) {
  const columns = [
    { key: 'createdAt', label: 'Time', sortable: true },
    { key: 'callerPhone', label: 'Caller' },
    { key: 'duration', label: 'Duration' },
    {
      key: 'status',
      label: 'Status',
      render: (call) => (
        <AdminBadge variant={call.isBillable ? 'success' : 'error'}>
          {call.isBillable ? `$${call.affiliatePayout}` : call.disposition}
        </AdminBadge>
      )
    },
  ];

  return <AdminDataTable data={calls} columns={columns} />;
}
```

---

## Dashboard Design

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  MY CONTRACTOR NOW - Affiliate Portal                   Welcome, John! [Logout] │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─ EARNINGS OVERVIEW ──────────────────────────────────────────────────────┐   │
│  │                                                                           │   │
│  │   TODAY                 THIS WEEK              THIS MONTH                │   │
│  │   ┌──────────────┐     ┌──────────────┐       ┌──────────────┐          │   │
│  │   │  $1,715.00   │     │  $8,420.00   │       │  $32,150.00  │          │   │
│  │   │  47 calls    │     │  231 calls   │       │  892 calls   │          │   │
│  │   │  23 leads    │     │  112 leads   │       │  456 leads   │          │   │
│  │   └──────────────┘     └──────────────┘       └──────────────┘          │   │
│  │                                                                           │   │
│  │   [View Detailed Reports]                                                 │   │
│  │                                                                           │   │
│  └───────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  ┌─ MY CAMPAIGNS ───────────────────────────────────────────────────────────┐   │
│  │                                                                           │   │
│  │  ┌─────────────────────────────────────────────────────────────────────┐ │   │
│  │  │  📞 WINDOWS REPAIR                                    ● Active     │ │   │
│  │  │  ───────────────────────────────────────────────────────────────── │ │   │
│  │  │                                                                     │ │   │
│  │  │  CALL TRACKING                           LEAD TRACKING              │ │   │
│  │  │  Number: (844) 555-1234  [Copy]          Form: /a/jm123  [Copy]    │ │   │
│  │  │  Type: Platform Provisioned              URL: mycontractornow...   │ │   │
│  │  │                                                                     │ │   │
│  │  │  Payouts:                                                           │ │   │
│  │  │  • Calls: $35 per qualified (90+ sec)                              │ │   │
│  │  │  • Leads: $35 per sold lead                                        │ │   │
│  │  │                                                                     │ │   │
│  │  │  Today: 12 calls (8 qualified = $280) + 5 leads (3 sold = $105)   │ │   │
│  │  │                                                                     │ │   │
│  │  │  [Edit Campaign] [View Stats]                                       │ │   │
│  │  └─────────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                           │   │
│  │  ┌─────────────────────────────────────────────────────────────────────┐ │   │
│  │  │  📞 HVAC EMERGENCY                                    ● Active     │ │   │
│  │  │  ───────────────────────────────────────────────────────────────── │ │   │
│  │  │                                                                     │ │   │
│  │  │  CALL TRACKING                           LEAD TRACKING              │ │   │
│  │  │  Type: Forwarding                        Form: /a/jm123  [Copy]    │ │   │
│  │  │  Forward to: (844) 999-0001                                        │ │   │
│  │  │  Headers: X-Affiliate-ID: jm123                                    │ │   │
│  │  │           X-Campaign-ID: hvac-001                                  │ │   │
│  │  │                                                                     │ │   │
│  │  │  Payouts:                                                           │ │   │
│  │  │  • Calls: $50 per qualified (90+ sec)                              │ │   │
│  │  │  • Leads: $45 per sold lead                                        │ │   │
│  │  │                                                                     │ │   │
│  │  │  Today: 8 calls (5 qualified = $250) + 3 leads (2 sold = $90)     │ │   │
│  │  │                                                                     │ │   │
│  │  │  [Edit Campaign] [View Stats]                                       │ │   │
│  │  └─────────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                           │   │
│  │  [+ Request New Campaign]                                                 │   │
│  │                                                                           │   │
│  └───────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  ┌─ RECENT ACTIVITY ────────────────────────────────────────────────────────┐   │
│  │                                                                           │   │
│  │  Filter: [All Types ▼]  [All Campaigns ▼]  [Today ▼]     [Search...]    │   │
│  │                                                                           │   │
│  │  ┌───────────────────────────────────────────────────────────────────┐   │   │
│  │  │ Time     │ Type │ Campaign  │ Caller/Lead    │ Duration │ Status  │   │   │
│  │  │          │      │           │                │ / ZIP    │         │   │   │
│  │  ├──────────┼──────┼───────────┼────────────────┼──────────┼─────────┤   │   │
│  │  │ 3:42 PM  │ 📞   │ Windows   │ (555) 123-4567 │ 4:32     │ ✅ $35  │▶️│   │
│  │  │ 3:38 PM  │ 📞   │ Windows   │ (555) 456-7890 │ 0:45     │ ❌ Short│▶️│   │
│  │  │ 3:35 PM  │ 📝   │ HVAC      │ John D. 90210  │ -        │ ✅ $45  │👁️│   │
│  │  │ 3:31 PM  │ 📞   │ HVAC      │ (555) 789-0123 │ 6:12     │ ✅ $50  │▶️│   │
│  │  │ 3:28 PM  │ 📝   │ Windows   │ Jane S. 90211  │ -        │ ⏳ Pend │👁️│   │
│  │  │ 3:22 PM  │ 📞   │ Windows   │ (555) 234-5678 │ 3:15     │ ✅ $35  │▶️│   │
│  │  │ 3:18 PM  │ 📞   │ HVAC      │ (555) 345-6789 │ 0:22     │ ❌ Hangup│▶️│   │
│  │  └──────────┴──────┴───────────┴────────────────┴──────────┴─────────┘   │   │
│  │                                                                           │   │
│  │  ▶️ = Play recording    👁️ = View lead details                           │   │
│  │                                                                           │   │
│  │  [Load More...]                                                           │   │
│  │                                                                           │   │
│  └───────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Call Recording Player (Inline Modal)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  CALL RECORDING                                                          [X]    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  Campaign: Windows Repair                                                        │
│  Date: January 15, 2025 at 3:42 PM                                              │
│  Caller: (555) 123-4567                                                         │
│  Duration: 4:32                                                                  │
│  Status: ✅ Qualified - $35.00                                                  │
│                                                                                  │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │                                                                            │  │
│  │   ▶️  ━━━━━━━━━━━━━━━━━━━━━━━━━━●━━━━━━━━━━━━━━━━  2:15 / 4:32            │  │
│  │       [⏪ 15s]              [⏸️ Pause]              [15s ⏩]               │  │
│  │                                                                            │  │
│  │   🔊 Volume: ━━━━━━━━━●━━━━━━━                                             │  │
│  │                                                                            │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  CALL DETAILS:                                                                   │
│  ├── Answered by: ABC Plumbing (Contractor)                                     │
│  ├── Winning bid: $58.00                                                        │
│  ├── Your payout: $35.00                                                        │
│  └── IVR responses: Owns home, Repair needed                                    │
│                                                                                  │
│  [Download Recording]                                                            │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Key UX Principles

1. **Unified view** - Calls AND leads in same dashboard (they're both "conversions")
2. **Copy buttons everywhere** - One click to copy tracking number or lead form URL
3. **Instant feedback** - See calls/leads appear in real-time
4. **Play recordings inline** - Click to listen without leaving page
5. **Money-first** - Always show earnings prominently

## File Structure

```
src/app/(affiliate)/
├── layout.tsx                     # EXISTING - may need nav update for calls
├── affiliate/
│   ├── page.tsx                   # EXISTING - redirect to dashboard
│   ├── dashboard/
│   │   └── page.tsx               # EXISTING - needs call stats integration
│   ├── campaigns/
│   │   └── page.tsx               # NEW - campaigns + number provisioning
│   ├── calls/                     # NEW - entire directory
│   │   ├── page.tsx               # NEW - calls history
│   │   └── [id]/page.tsx          # NEW - call detail with recording
│   ├── leads/
│   │   └── page.tsx               # EXISTING - no changes needed
│   ├── links/
│   │   └── page.tsx               # EXISTING - no changes needed
│   ├── commissions/
│   │   └── page.tsx               # EXISTING - may need call commission rows
│   ├── withdrawals/
│   │   └── page.tsx               # EXISTING - no changes needed
│   ├── analytics/
│   │   └── page.tsx               # NEW - combined analytics (Phase 3)
│   └── settings/
│       └── page.tsx               # EXISTING - may need call preferences

src/components/affiliate/
├── EarningsOverview.tsx           # COMPOSE from AdminStatGrid + AdminCard
├── CampaignCard.tsx               # COMPOSE from AdminCard
├── ActivityTable.tsx              # COMPOSE from AdminDataTable + AdminBadge
├── CallDetailModal.tsx            # COMPOSE from LeadDetailModal pattern + AdminInfoGrid
├── RecordingPlayer.tsx            # NEW (unique - audio player)
├── ProvisionNumberModal.tsx       # NEW (unique - Twilio provisioning)
├── DisputeCallForm.tsx            # NEW (unique - dispute submission)
└── CampaignRequestForm.tsx        # NEW (unique - campaign access request)
```

## Affiliate API Endpoints

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/affiliate/profile` | GET/PUT | Get/update profile | EXISTING |
| `/api/affiliate/campaigns` | GET | List available campaigns | NEW |
| `/api/affiliate/campaigns/[id]/request` | POST | Request to join | NEW |
| `/api/affiliate/tracking-numbers` | GET | List tracking numbers | NEW |
| `/api/affiliate/tracking-numbers/provision` | POST | Provision new number | NEW |
| `/api/affiliate/calls` | GET | List calls | NEW |
| `/api/affiliate/calls/[id]` | GET | Get call details | NEW |
| `/api/affiliate/calls/[id]/recording` | GET | Get recording URL | NEW |
| `/api/affiliate/leads` | GET | List leads | EXISTING |
| `/api/affiliate/stats` | GET | Get earnings/stats | EXISTING - needs extension |

---

## Empty States (CRITICAL UX)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  EMPTY STATE: NO CAMPAIGNS                                                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│                           📞 No Campaigns Yet                                   │
│                                                                                  │
│              You haven't joined any campaigns yet.                              │
│              Request access to start generating calls and leads!                │
│                                                                                  │
│                        [Browse Available Campaigns]                              │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│  EMPTY STATE: NO CALLS TODAY                                                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│                           📞 No Calls Today                                     │
│                                                                                  │
│              You haven't received any calls today.                              │
│              Make sure your tracking numbers are active in your ads!            │
│                                                                                  │
│                        [View My Tracking Numbers]                               │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│  EMPTY STATE: RECORDING UNAVAILABLE                                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│                           🎙️ Recording Not Available                            │
│                                                                                  │
│              This call recording is not available.                              │
│              Possible reasons:                                                   │
│              • Recording is still processing                                    │
│              • Call was too short to record                                     │
│              • Recording was manually deleted                                    │
│                                                                                  │
│                        [Contact Support]                                         │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Error States

### Recording Player Error States

```typescript
// src/components/affiliate/RecordingPlayer.tsx

interface RecordingPlayerProps {
  recordingUrl: string | null;
  callId: string;
  duration: number;
}

export function RecordingPlayer({ recordingUrl, callId, duration }: RecordingPlayerProps) {
  const [state, setState] = useState<'loading' | 'ready' | 'playing' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Error scenarios to handle:
  // 1. Recording URL is null (still processing or not available)
  // 2. Recording URL returns 403 (expired or permission denied)
  // 3. Recording URL returns 404 (deleted or never created)
  // 4. Network error (connection issue)
  // 5. Audio format not supported by browser

  const handleError = (error: Event) => {
    const audio = error.target as HTMLAudioElement;

    if (audio.error) {
      switch (audio.error.code) {
        case MediaError.MEDIA_ERR_NETWORK:
          setErrorMessage('Network error. Please check your connection.');
          break;
        case MediaError.MEDIA_ERR_DECODE:
          setErrorMessage('Unable to play this recording format.');
          break;
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
          setErrorMessage('Recording format not supported.');
          break;
        default:
          setErrorMessage('Unable to load recording.');
      }
    }

    setState('error');
  };

  if (!recordingUrl) {
    return <RecordingUnavailable reason="not_ready" />;
  }

  if (state === 'error') {
    return (
      <div className="recording-error">
        <AlertTriangle className="icon" />
        <p>{errorMessage}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  // ... rest of player implementation
}
```

## Real-Time Updates

```typescript
// WHY: Affiliates want to see new calls appear immediately without refreshing.
// WHEN: A new call comes in or call status changes.
// HOW: WebSocket connection for real-time updates.

// src/lib/websocket/affiliate-socket.ts

export function useAffiliateRealTimeUpdates(affiliateId: string) {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');

  useEffect(() => {
    const ws = new WebSocket(`${process.env.NEXT_PUBLIC_WS_URL}/affiliate/${affiliateId}`);

    ws.onopen = () => {
      setConnectionState('connected');
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'NEW_CALL':
          // Add to calls list, update earnings
          queryClient.invalidateQueries(['affiliate-calls']);
          queryClient.invalidateQueries(['affiliate-earnings']);
          break;

        case 'CALL_STATUS_UPDATE':
          // Update specific call in list
          queryClient.setQueryData(['affiliate-calls'], (old: Call[]) =>
            old.map(c => c.id === data.callId ? { ...c, ...data.updates } : c)
          );
          break;

        case 'EARNINGS_UPDATE':
          // Refresh earnings summary
          queryClient.invalidateQueries(['affiliate-earnings']);
          break;
      }
    };

    ws.onclose = () => {
      setConnectionState('disconnected');
      // Reconnect after 5 seconds
      setTimeout(() => {
        setSocket(null); // Trigger reconnection
      }, 5000);
    };

    ws.onerror = () => {
      setConnectionState('error');
    };

    setSocket(ws);

    return () => ws.close();
  }, [affiliateId]);

  return { connectionState };
}

// Usage in dashboard:
export function AffiliateDashboard() {
  const { connectionState } = useAffiliateRealTimeUpdates(affiliateId);

  return (
    <div>
      {connectionState === 'disconnected' && (
        <Banner type="warning">
          Real-time updates paused. Reconnecting...
        </Banner>
      )}
      {/* ... rest of dashboard */}
    </div>
  );
}
```

---

## User Stories

### US-AP-1: New Affiliate Onboarding
**AS A** newly registered affiliate
**I WANT** to understand how to get started
**SO THAT** I can begin earning quickly

**WHEN** I log in for the first time
**THEN** I see a guided onboarding flow:
1. "Welcome! Let's get you set up."
2. "Browse campaigns you can promote"
3. "Request access to a campaign"
4. "Once approved, get your tracking number"
5. "Use the number in your ads and start earning!"

**AND** I see tooltips explaining each section
**AND** I can dismiss the onboarding flow
**AND** I can re-access it from Settings

### US-AP-2: Affiliate Views Call They Just Received
**AS AN** affiliate who just received a call
**I WANT** to see it appear immediately in my dashboard
**SO THAT** I know my campaign is working

**WHEN** a call comes in on my tracking number
**THEN** within 2 seconds, I see it in "Recent Activity"
**AND** the row highlights briefly (green flash)
**AND** my Today earnings update in real-time
**AND** I can click to see details immediately

### US-AP-3: Affiliate Contests Disqualified Call
**AS AN** affiliate who believes a call was incorrectly disqualified
**I WANT** to dispute the decision
**SO THAT** I can receive proper credit

**WHEN** I click "Dispute" on a disqualified call
**THEN** I see a form asking:
- Reason for dispute (dropdown)
- Additional details (text)
- Evidence (optional file upload)

**AND** when I submit, I see "Dispute submitted - we'll review within 24 hours"
**AND** the call shows "Under Review" status
**AND** I receive email notification when resolved

### US-AP-4: Affiliate Downloads Reports
**AS AN** affiliate at month end
**I WANT** to download my call/lead report
**SO THAT** I can reconcile with my payout

**WHEN** I click "Download Report" with date range
**THEN** I can choose format (CSV or Excel)
**AND** report includes all calls/leads with payouts
**AND** report matches the earnings shown in dashboard

---

## Implementation Tasks

### Integration Verification Tasks

| Task ID | Description | Status |
|---------|-------------|--------|
| P1-AP-INT-1 | Audit existing affiliate-service.ts before adding call methods | ⬜ |
| P1-AP-INT-2 | Verify DashboardStats component can accept call data | ⬜ |
| P1-AP-INT-3 | Test existing affiliate features after database migration | ⬜ |
| P1-AP-INT-4 | Verify withdrawal balance includes both lead and call earnings | ⬜ |
| P1-AP-INT-5 | Ensure new API routes follow existing auth pattern | ⬜ |
| P1-AP-INT-6 | Add call stats to existing /api/affiliates/stats endpoint | ⬜ |
| P1-AP-INT-7 | Create unified activity feed combining calls and leads | ⬜ |

### Core Portal Tasks

| Task ID | Description | Status |
|---------|-------------|--------|
| P1-AP-1 | Update affiliate layout nav for calls section | ⬜ |
| P1-AP-2 | Extend affiliate dashboard page with call stats | ⬜ |
| P1-AP-3 | Implement earnings summary component (calls + leads) | ⬜ |
| P1-AP-4 | Create campaigns page | ⬜ |
| P1-AP-5 | Implement tracking number display with copy | ⬜ |
| P1-AP-6 | Implement number provisioning flow | ⬜ |
| P1-AP-7 | Create calls page with history | ⬜ |
| P1-AP-8 | Implement call status, duration, payout display | ⬜ |
| P1-AP-9 | Create call detail modal | ⬜ |
| P1-AP-10 | Create RecordingPlayer component | ⬜ |

### Activity Feed / Logging Display (CRITICAL)

> **Affiliates need visibility into their call activity** - this builds trust and reduces support tickets.
> See [Section 12: Logging & Observability](./12-logging-observability.md) for full details.

| Task ID | Description | Status | Priority |
|---------|-------------|--------|----------|
| P1-AP-LOG-1 | Create `AffiliateActivityFeed` component | ⬜ | CRITICAL |
| P1-AP-LOG-2 | Show call status, duration, payout for each call | ⬜ | CRITICAL |
| P1-AP-LOG-3 | Add "View Details" link to call timeline | ⬜ | HIGH |
| P1-AP-LOG-4 | Create `CallDetailTimeline` component with all events | ⬜ | CRITICAL |
| P1-AP-LOG-5 | Add one-click access to recording from activity feed | ⬜ | HIGH |
| P1-AP-LOG-6 | Filter by campaign, date, status | ⬜ | MEDIUM |
| P1-AP-LOG-7 | Show rejection reasons clearly (e.g., "Renter") | ⬜ | HIGH |
| P1-AP-LOG-8 | Add "Load More" pagination for activity feed | ⬜ | MEDIUM |

**What affiliates should see for each call:**
- Timestamp
- Caller phone (masked: `(555) ***-4567`)
- Duration (e.g., `4:05`)
- Status (`✅ Qualified` or `❌ Not Qualified` with reason)
- Payout (if qualified)
- Link to recording

### Empty State Tasks

| Task ID | Description | Status |
|---------|-------------|--------|
| P1-AP-11 | Create empty state for no campaigns | ⬜ |
| P1-AP-12 | Create empty state for no calls today | ⬜ |
| P1-AP-13 | Create empty state for no leads today | ⬜ |
| P1-AP-14 | Create recording unavailable state | ⬜ |

### Error Handling Tasks

| Task ID | Description | Status |
|---------|-------------|--------|
| P1-AP-15 | Handle recording 403 (expired/permission) | ⬜ |
| P1-AP-16 | Handle recording 404 (not found) | ⬜ |
| P1-AP-17 | Handle recording network errors | ⬜ |
| P1-AP-18 | Handle recording format errors | ⬜ |
| P1-AP-19 | Add retry button for failed recording loads | ⬜ |

### Real-Time Updates Tasks

| Task ID | Description | Status |
|---------|-------------|--------|
| P1-AP-20 | Create WebSocket connection manager | ⬜ |
| P1-AP-21 | Implement NEW_CALL real-time event | ⬜ |
| P1-AP-22 | Implement CALL_STATUS_UPDATE event | ⬜ |
| P1-AP-23 | Implement EARNINGS_UPDATE event | ⬜ |
| P1-AP-24 | Add reconnection logic with exponential backoff | ⬜ |
| P1-AP-25 | Show connection status indicator | ⬜ |

### Accessibility Tasks

| Task ID | Description | Status |
|---------|-------------|--------|
| P1-AP-26 | Add keyboard navigation for call list | ⬜ |
| P1-AP-27 | Add ARIA labels for recording player controls | ⬜ |
| P1-AP-28 | Ensure color contrast meets WCAG AA | ⬜ |
| P1-AP-29 | Add screen reader announcements for real-time updates | ⬜ |

### Additional Features Tasks

| Task ID | Description | Status |
|---------|-------------|--------|
| P1-AP-30 | Create dispute submission form | ⬜ |
| P1-AP-31 | Create report download functionality | ⬜ |
| P1-AP-32 | Create onboarding flow for new affiliates | ⬜ |

### Testing Tasks

| Task ID | Description | Status |
|---------|-------------|--------|
| P1-AP-T1 | Test empty states render correctly | ⬜ |
| P1-AP-T2 | Test recording player error handling | ⬜ |
| P1-AP-T3 | Test WebSocket reconnection | ⬜ |
| P1-AP-T4 | Test real-time call updates | ⬜ |
| P1-AP-T5 | Test keyboard navigation | ⬜ |
| P1-AP-T6 | Test dispute submission flow | ⬜ |
| P1-AP-T7 | Test existing affiliate features still work after changes | ⬜ |
| P1-AP-T8 | Test unified activity feed with both calls and leads | ⬜ |

---

*Section Version: 3.1 (DRY UI Component Requirements Added)*
