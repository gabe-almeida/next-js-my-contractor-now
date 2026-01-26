# Affiliate System - Technical Specification

**Created:** 2026-01-04
**Status:** Spec Complete
**Estimated Effort:** 15-20 hours

---

## Overview

Build a complete affiliate system that allows partners to sign up, generate tracking links, refer traffic to lead forms, view their referred leads and commissions, and request payouts.

**Standards Reminders:**
- Keep files under 500 lines (see gabe-os/standards/global/file-limits.md)
- Document WHY/WHEN/HOW for complex logic
- Follow DRY principle - reuse existing components
- Maintain modularity - single responsibility per file

---

## User Stories & Acceptance Criteria

### Epic 1: Affiliate Registration & Authentication

#### Story 1.1: Affiliate Signup
> As a potential affiliate, I want to register with my details so I can start earning commissions.

**Acceptance Criteria:**
- [ ] Form captures: email, password, firstName, lastName, companyName (optional), phone (optional)
- [ ] Password requirements: 8+ chars, 1 uppercase, 1 number
- [ ] Email uniqueness validation
- [ ] Creates affiliate with status=PENDING
- [ ] Sends welcome email with next steps
- [ ] Redirects to "awaiting approval" page

#### Story 1.2: Affiliate Login
> As a registered affiliate, I want to log in to access my dashboard.

**Acceptance Criteria:**
- [ ] Email/password authentication
- [ ] JWT token generation with AFFILIATE role
- [ ] "Remember me" option (7-day vs 24-hour expiry)
- [ ] Redirect to dashboard on success
- [ ] Show error for invalid credentials
- [ ] Block login if status != ACTIVE

#### Story 1.3: Password Reset
> As an affiliate, I want to reset my password if I forget it.

**Acceptance Criteria:**
- [ ] Request reset via email
- [ ] Time-limited reset token (1 hour)
- [ ] Secure password update flow

---

### Epic 2: Tracking Links

#### Story 2.1: Create Tracking Link
> As an affiliate, I want to create unique tracking links for my campaigns.

**Acceptance Criteria:**
- [ ] Select target page (/windows, /roofing, /bathrooms, or home)
- [ ] Auto-generate unique code OR enter custom code
- [ ] Optional: Add campaign name for reference
- [ ] Validate code uniqueness
- [ ] Display generated URL with copy button

#### Story 2.2: Manage Links
> As an affiliate, I want to view and manage all my tracking links.

**Acceptance Criteria:**
- [ ] List all links with: code, target, clicks, conversions, status
- [ ] Toggle link active/inactive
- [ ] Delete link (soft delete)
- [ ] Copy link URL to clipboard
- [ ] Filter by status (active/inactive)

---

### Epic 3: Lead Tracking & Commissions

#### Story 3.1: View Referred Leads
> As an affiliate, I want to see leads I've referred.

**Acceptance Criteria:**
- [ ] List leads with: date, service type, status, commission
- [ ] Privacy: NO customer name/email/phone shown
- [ ] Filter by date range, service type
- [ ] Pagination (20 per page)
- [ ] Show conversion rate stats

#### Story 3.2: Commission Dashboard
> As an affiliate, I want to see my earnings overview.

**Acceptance Criteria:**
- [ ] Summary cards: Total Earned, Pending, Available, Paid
- [ ] Commission list with status badges
- [ ] Monthly earnings chart
- [ ] Export to CSV

---

### Epic 4: Payouts

#### Story 4.1: Request Withdrawal
> As an affiliate, I want to withdraw my available balance.

**Acceptance Criteria:**
- [ ] Show available balance (APPROVED commissions not yet paid)
- [ ] Minimum withdrawal: $50
- [ ] Select payment method (PayPal initially)
- [ ] Enter payment details
- [ ] Submit request (status=REQUESTED)

#### Story 4.2: View Payout History
> As an affiliate, I want to see my payout history.

**Acceptance Criteria:**
- [ ] List all withdrawals with: date, amount, method, status
- [ ] Status badges: Requested, Processing, Completed, Failed

---

### Epic 5: Admin Management

#### Story 5.1: Manage Affiliates
> As an admin, I want to view and manage all affiliates.

**Acceptance Criteria:**
- [ ] List affiliates with: name, email, status, leads, earnings
- [ ] Search by name/email
- [ ] Filter by status
- [ ] Approve pending affiliates
- [ ] Suspend/reactivate affiliates

#### Story 5.2: Manage Commissions
> As an admin, I want to approve commissions for payout.

**Acceptance Criteria:**
- [ ] List pending commissions
- [ ] Bulk approve commissions
- [ ] Reject commission with reason

---

## Technical Architecture

### Database Schema

**Location:** `/prisma/schema.prisma`
**Standards:** Add indexes for query performance, use proper relations

```prisma
// See planning/codebase-analysis.md for full schema
// Key models: Affiliate, AffiliateLink, AffiliateCommission, AffiliateWithdrawal
```

### API Endpoints

**Location:** `/src/app/api/`
**Pattern:** Follow existing admin API pattern with middleware wrapper

#### Public Affiliate APIs (`/api/affiliates/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/affiliates/signup` | Register new affiliate |
| POST | `/api/affiliates/login` | Authenticate affiliate |
| GET | `/api/affiliates/me` | Get current affiliate profile |
| PUT | `/api/affiliates/me` | Update profile |
| GET | `/api/affiliates/links` | List affiliate's links |
| POST | `/api/affiliates/links` | Create new link |
| PUT | `/api/affiliates/links/[id]` | Update link |
| DELETE | `/api/affiliates/links/[id]` | Delete link |
| GET | `/api/affiliates/leads` | List referred leads |
| GET | `/api/affiliates/commissions` | List commissions |
| GET | `/api/affiliates/stats` | Dashboard statistics |
| GET | `/api/affiliates/withdrawals` | List withdrawals |
| POST | `/api/affiliates/withdrawals` | Request withdrawal |

#### Admin APIs (`/api/admin/affiliates/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/affiliates` | List all affiliates |
| GET | `/api/admin/affiliates/[id]` | Get affiliate details |
| PUT | `/api/admin/affiliates/[id]` | Update affiliate |
| POST | `/api/admin/affiliates/[id]/approve` | Approve affiliate |
| POST | `/api/admin/affiliates/[id]/suspend` | Suspend affiliate |
| GET | `/api/admin/affiliates/[id]/commissions` | Affiliate's commissions |
| POST | `/api/admin/commissions/approve` | Bulk approve commissions |
| GET | `/api/admin/withdrawals` | List all withdrawals |
| PUT | `/api/admin/withdrawals/[id]` | Process withdrawal |

### Services

**Location:** `/src/lib/services/`
**Pattern:** Follow WHY/WHEN/HOW documentation pattern

#### affiliate-service.ts
```typescript
/**
 * Affiliate Service
 *
 * WHY: Centralizes affiliate CRUD and business logic
 * WHEN: Called by API routes for affiliate operations
 * HOW: Validates input, manages Prisma transactions, returns typed results
 */
export async function createAffiliate(data: CreateAffiliateInput): Promise<AffiliateResult>
export async function getAffiliateById(id: string): Promise<Affiliate | null>
export async function updateAffiliateStatus(id: string, status: AffiliateStatus): Promise<Affiliate>
export async function generateAffiliateToken(affiliate: Affiliate): Promise<string>
```

#### affiliate-commission-service.ts
```typescript
/**
 * Commission Service
 *
 * WHY: Handles commission calculation, creation, and status management
 * WHEN: Called when lead is sold (from lead-accounting-service hook)
 * HOW: Calculates commission amount, creates record, manages status transitions
 */
export async function createCommissionForLead(leadId: string): Promise<Commission | null>
export async function approveCommissions(ids: string[]): Promise<BatchResult>
export async function getAffiliateStats(affiliateId: string): Promise<AffiliateStats>
```

#### affiliate-link-service.ts
```typescript
/**
 * Link Service
 *
 * WHY: Manages tracking link generation and click tracking
 * WHEN: Affiliate creates/manages links, user clicks tracking link
 * HOW: Generates unique codes, validates, increments click counters
 */
export async function createLink(affiliateId: string, data: CreateLinkInput): Promise<AffiliateLink>
export async function trackClick(code: string): Promise<void>
export async function attributeLeadToAffiliate(leadId: string, affiliateCode: string): Promise<void>
```

### Frontend Pages

**Location:** `/src/app/(affiliate)/`
**Pattern:** Route group like existing `(admin)`, client components with useState/useEffect

```
(affiliate)/
├── layout.tsx              # AffiliateLayout with sidebar nav
├── login/page.tsx          # Login form
├── signup/page.tsx         # Registration form
└── affiliate/
    ├── dashboard/page.tsx  # Stats overview
    ├── links/page.tsx      # Link management
    ├── leads/page.tsx      # Referred leads
    ├── commissions/page.tsx # Commission history
    ├── withdrawals/page.tsx # Payout requests
    └── settings/page.tsx   # Profile settings
```

### Components

**Location:** `/src/components/affiliate/`
**Standards:** Keep under 500 lines, extract sub-components as needed

```
affiliate/
├── AffiliateLayout.tsx     # Main layout with nav
├── AffiliateSidebar.tsx    # Navigation sidebar
├── DashboardStats.tsx      # Stats cards
├── LinkTable.tsx           # Links list
├── LinkCreateModal.tsx     # Create link form
├── LeadTable.tsx           # Leads list (privacy-safe)
├── CommissionTable.tsx     # Commission list
├── WithdrawalForm.tsx      # Request payout form
└── EarningsChart.tsx       # Monthly chart
```

---

## Integration Points

### 1. Attribution Capture

**File:** `/src/utils/attribution.ts`
**Change:** Add affiliate parameter extraction

```typescript
// In extractAttributionData() function, add:
affiliate_id: params.get('aff') || params.get('affiliate_id') || params.get('ref'),
```

### 2. Lead Creation Hook

**File:** `/src/app/api/leads/route.ts`
**Change:** Store affiliate attribution in lead

```typescript
// After lead creation, if affiliate_id present:
if (attribution.affiliate_id) {
  await affiliateLinkService.attributeLeadToAffiliate(lead.id, attribution.affiliate_id);
}
```

### 3. Lead Sold Hook

**File:** `/src/lib/services/lead-accounting-service.ts`
**Change:** Create commission when lead is sold

```typescript
// In changeLeadStatus(), after status change to SOLD:
if (newStatus === 'SOLD') {
  await affiliateCommissionService.createCommissionForLead(leadId);
}
```

### 4. Auth System Extension

**File:** `/src/lib/auth.ts`
**Change:** Add AFFILIATE role and permissions

```typescript
type Role = 'ADMIN' | 'MANAGER' | 'VIEWER' | 'AFFILIATE';

const affiliatePermissions = [
  'affiliate:read_own',
  'affiliate:write_own',
  'affiliate:read_commissions',
  'affiliate:request_withdrawal'
];
```

---

## Security Considerations

1. **PII Protection:** Affiliates see lead ID + service only, never customer data
2. **Token Separation:** Affiliate JWTs have different claims than admin tokens
3. **Rate Limiting:** Affiliate endpoints have stricter rate limits
4. **Input Validation:** All inputs validated with Zod schemas
5. **SQL Injection:** Prisma parameterized queries prevent injection
6. **Password Security:** bcrypt hashing with salt rounds=12

---

## Performance Considerations

1. **Cache affiliate stats:** 5 minute TTL in Redis
2. **Index affiliate_id:** On leads table for fast lookups
3. **Paginate everything:** 20-50 items per page
4. **Lazy load charts:** Don't block dashboard on chart data

---

## Testing Strategy

### Unit Tests
- Commission calculation logic
- Link code generation
- Attribution parsing
- Status transition validation

### Integration Tests
- Full signup → login flow
- Link creation → click tracking → lead attribution
- Commission creation on lead sold
- Withdrawal request flow

---

## Rollout Plan

**Phase 1 (MVP):**
- Affiliate registration + login
- Link creation + tracking
- Basic dashboard with stats
- Admin approval workflow

**Phase 2:**
- Commission tracking + approval
- Withdrawal requests
- PayPal integration

**Phase 3:**
- Advanced analytics
- Bank transfer payouts
- Email notifications
