# Affiliate System Investigation

**Date:** 2026-01-25
**Status:** Documentation of current implementation
**Author:** AI Investigation

---

## Table of Contents

1. [Overview](#overview)
2. [Sign Up Flow](#1-sign-up-flow)
3. [Authentication System](#2-authentication-system)
4. [Affiliate Dashboard](#3-affiliate-dashboard)
5. [Lead Display](#4-lead-display)
6. [Payment & Commission Tracking](#5-payment--commission-tracking)
7. [Attribution System](#6-attribution-system)
8. [Database Schema](#7-database-schema)
9. [API Endpoints](#8-api-endpoints)
10. [Key Files Reference](#9-key-files-reference)
11. [Bugs Fixed](#10-bugs-fixed-2026-01-25)
12. [Gaps & Limitations](#11-gaps--limitations)
13. [Improvement Opportunities](#12-improvement-opportunities)

---

## Overview

The affiliate system allows external partners to promote contractor services and earn commissions on qualified leads. Affiliates sign up, get approved by admins, create tracking links, and earn commissions when their referred leads convert.

**Key Routes:**
- `/affiliate/signup` - Registration
- `/affiliate/login` - Authentication
- `/affiliate/dashboard` - Main dashboard
- `/affiliate/leads` - Lead history
- `/affiliate/commissions` - Commission tracking
- `/affiliate/payouts` - Payment history
- `/affiliate/links` - Tracking link management

---

## 1. Sign Up Flow

### Location
- **Frontend:** `src/app/(affiliate)/affiliate/signup/page.tsx`
- **Backend:** `src/app/api/affiliates/signup/route.ts`

### Form Fields

| Field | Required | Validation |
|-------|----------|------------|
| `email` | Yes | Valid email format, unique |
| `password` | Yes | Min 8 characters |
| `confirmPassword` | Yes | Must match password |
| `firstName` | Yes | 1-50 characters |
| `lastName` | Yes | 1-50 characters |
| `phone` | **Yes** | 10-20 characters (required as of 2026-01-25) |
| `website` | No | Valid URL format |
| `companyName` | No | Optional |
| `marketingChannels` | No | Textarea describing promotion methods |

### Flow

```
1. User fills signup form
2. Frontend validation (passwords match, min length)
3. POST /api/affiliates/signup with FormData
4. Backend validates with Zod schema
5. Check email uniqueness
6. Hash password with bcrypt (12 rounds)
7. Create affiliate with PENDING status
8. Return success message
9. User directed to login page
```

### Key Behavior

- **New affiliates start with PENDING status**
- Admin must approve before affiliate can login
- Password hashed with bcrypt (12 rounds)
- Email must be unique across all affiliates

### Status Values

| Status | Description |
|--------|-------------|
| `PENDING` | Awaiting admin approval |
| `ACTIVE` | Approved, can login and operate |
| `SUSPENDED` | Account disabled by admin |

---

## 2. Authentication System

### Login Flow

**Location:** `src/app/(affiliate)/affiliate/login/page.tsx`

```
1. User enters email/password
2. POST /api/affiliates/login
3. Validate credentials against database
4. Check affiliate status:
   - PENDING → "Account pending approval"
   - SUSPENDED → "Account suspended"
   - ACTIVE → Proceed
5. Generate JWT token
6. Store token in:
   - localStorage: 'affiliate_token'
   - Cookie: 'affiliate_token' (7-day expiry if rememberMe)
7. Redirect to dashboard
```

### JWT Token Structure

```typescript
{
  userId: affiliate.id,
  role: 'affiliate',
  permissions: [
    'affiliate:read_own',
    'affiliate:write_own',
    'affiliate:read_commissions',
    'affiliate:request_withdrawal'
  ],
  aud: 'contractor-platform-affiliate'  // Different from admin tokens
}
```

### Protected Route Pattern

All affiliate routes (except login/signup) are protected by `src/app/(affiliate)/layout.tsx`:

```typescript
// Checks for affiliate_token in localStorage or cookie
// Fetches /api/affiliates/me to validate token
// Redirects to login if invalid
```

### API Authentication

All protected API endpoints use Bearer token:

```typescript
// Request header
Authorization: Bearer <jwt_token>

// Verification in API routes
function getAffiliateIdFromRequest(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { affiliateId: null, error: 'Authorization required' };
  }
  const token = authHeader.substring(7);
  const verification = verifyAffiliateToken(token);
  return verification.valid
    ? { affiliateId: verification.affiliateId }
    : { error: verification.error };
}
```

---

## 3. Affiliate Dashboard

### Location
`src/app/(affiliate)/affiliate/dashboard/page.tsx`

### Components
- `DashboardStats.tsx` - Reusable stats card grid
- `AffiliateLayout.tsx` - Navigation sidebar + top bar

### Stats Displayed

**Lead Stats:**
| Stat | Description |
|------|-------------|
| Total Earnings | Lifetime commissions |
| Pending Earnings | Awaiting approval |
| Available Balance | Ready to withdraw |
| Total Clicks | All-time link clicks |
| Conversions | Total + conversion rate % |

**Call Stats (if enabled):**
| Stat | Description |
|------|-------------|
| Today's Calls | Call count for today |
| Today's Qualified Calls | Billable calls |
| Today's Call Earnings | Earnings from calls |

### Data Fetching

```typescript
useEffect(() => {
  // Parallel fetch on mount
  Promise.all([
    fetch('/api/affiliates/stats'),
    fetch('/api/affiliates/links?limit=5'),
    fetch('/api/affiliates/calls?limit=5')
  ]);
}, []);
```

---

## 4. Lead Display

### Location
`src/app/(affiliate)/affiliate/leads/page.tsx`

### Real-time Updates

**Current Implementation: NO REAL-TIME**

The system uses:
- Fetch on page load (initial data)
- Manual refresh button (user-triggered)
- No websockets, SSE, or polling

### Lead Data Shown

```typescript
interface AffiliateLeadView {
  id: string;
  serviceType: string;      // Display name only (e.g., "Windows")
  status: string;           // NEW | MATCHED | SOLD | RETURNED | DISPUTED
  createdAt: string;        // ISO datetime
  commissionAmount: number;
  commissionStatus: string;
  winningBid: null;         // HIDDEN for privacy
}
```

### Status Colors

| Status | Color |
|--------|-------|
| `NEW` | Blue |
| `MATCHED` | Purple |
| `SOLD` | Green |
| `RETURNED` | Yellow |
| `DISPUTED` | Red |

### Pagination

- 20 leads per page
- Date range filtering available
- Endpoint: `GET /api/affiliates/leads?page=1&limit=20&dateFrom=...&dateTo=...`

### Privacy Considerations

- Winning bid amounts are NOT shown to affiliates
- Lead contact details (name, phone, email) are NOT exposed
- Only service type, status, and commission info visible

---

## 5. Payment & Commission Tracking

### Commission Flow

```
Lead Submitted
     ↓
Commission Created (PENDING)
     ↓
Admin Reviews
     ↓
 ┌───┴───┐
 ↓       ↓
APPROVED  REJECTED
 ↓
Included in Payout
 ↓
PAID
```

### Commission Statuses

| Status | Color | Description |
|--------|-------|-------------|
| `PENDING` | Yellow | Awaiting admin review |
| `APPROVED` | Blue | Approved, awaiting payout |
| `PAID` | Green | Included in completed payout |
| `REJECTED` | Red | Rejected by admin |

### Commission Page

**Location:** `src/app/(affiliate)/affiliate/commissions/page.tsx`

**Summary Cards:**
- Pending total
- Approved total
- Paid total

**Table Columns:**
- Amount (formatted currency)
- Rate (percentage)
- Status (color-coded badge)
- Lead ID (first 8 chars)
- Created date
- Approved/Paid date

### Payout Page

**Location:** `src/app/(affiliate)/affiliate/payouts/page.tsx`

**Balance Cards:**

| Card | Description |
|------|-------------|
| Available Balance | Ready to withdraw |
| Pending Payouts | Being processed |
| Total Paid | Lifetime payments |
| Payment Method | Current configured method |

### Payout Statuses

| Status | Color | Description |
|--------|-------|-------------|
| `PENDING` | Yellow | Awaiting processing |
| `PROCESSING` | Blue | Being sent |
| `COMPLETED` | Green | Successfully paid |
| `FAILED` | Red | Payment failed |

### Withdrawal System

**Location:** `/affiliate/withdrawals`

**Requirements:**
- Available balance > minimum payout (default $100)
- Payment method must be configured
- Account must be ACTIVE

**Supported Payment Methods:**
- Wire transfer
- PayPal
- Check

**Payment Terms:**
- Net 7, Net 15, or Net 30 (default)

---

## 6. Attribution System

### Tracking Links

**Location:** `src/app/(affiliate)/affiliate/links/page.tsx`

Affiliates create unique tracking links to attribute leads:

```
URL Format: https://mycontractornow.com/r/{code}
                                          └── 8-char unique code
```

### URL Generation

**Backend** (`src/lib/services/affiliate-link-service.ts`):
```typescript
export function buildTrackingUrl(code: string, baseUrl?: string): string {
  const base = baseUrl || process.env.NEXT_PUBLIC_BASE_URL || 'https://mycontractornow.com';
  return `${base}/r/${code}`;
}
```

**Frontend Copy Button** (`src/components/affiliate/LinkTable.tsx`):

```typescript
// Uses API-provided trackingUrl (FIXED 2026-01-25)
const copyToClipboard = async (link: AffiliateLink) => {
  await navigator.clipboard.writeText(link.trackingUrl);
  // ...
};
```

Affiliates can copy links from:
- Links management page (`/affiliate/links`)
- Dashboard quick links section

### Redirect Route

**Location:** `src/app/r/[code]/route.ts`

When a user clicks an affiliate link (`https://mycontractornow.com/r/ABC123`):

1. `trackClick(code)` is called - increments click counter
2. Attribution cookie `aff_ref` is set (30-day expiry)
3. User is 302 redirected to `targetPath?ref=code`

```typescript
// Cookie settings
const AFFILIATE_COOKIE_NAME = 'aff_ref';
const AFFILIATE_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days
```

### Link Data

```typescript
interface AffiliateLink {
  id: string;
  affiliateId: string;
  code: string;         // Unique tracking code
  targetPath: string;   // e.g., "/windows", "/roofing"
  name: string | null;  // User-friendly name
  clicks: number;       // Total clicks
  conversions: number;  // Leads generated
  isActive: boolean;
  createdAt: Date;
  trackingUrl: string;  // Full URL (from API): https://mycontractornow.com/r/{code}
}
```

### Attribution Flow

```
1. User clicks affiliate link (?ref=code)
2. AffiliateLink.clicks incremented
3. Ref code stored in session/cookie
4. User submits lead form
5. Lead created with affiliateId from ref code
6. AffiliateLink.conversions incremented
7. AffiliateCommission created
```

### Tracked Metrics

| Metric | Where Stored | When Updated |
|--------|--------------|--------------|
| Clicks | `AffiliateLink.clicks` | On link visit |
| Conversions | `AffiliateLink.conversions` | On lead submission |
| Commission Rate | `AffiliateCommission.rate` | At commission creation |
| Commission Amount | `AffiliateCommission.amount` | At commission creation |

### Attribution Limitations

**NOT Currently Tracked:**
- UTM parameters (utm_source, utm_medium, etc.)
- User journey/path before conversion
- Time to conversion
- Device/browser info
- Geographic data
- Which specific link generated which commission

---

## 7. Database Schema

### Affiliate Table

```prisma
model Affiliate {
  id              String   @id @default(cuid())
  email           String   @unique
  passwordHash    String
  firstName       String
  lastName        String
  phone           String?
  website         String?
  companyName     String?

  status          AffiliateStatus @default(PENDING)
  commissionRate  Decimal  @default(0.10)  // 10%

  apiKey          String?  @unique
  postbackUrl     String?

  paymentMethod   String?
  paymentDetails  Json?    // Encrypted
  minimumPayout   Decimal  @default(100.00)

  approvedAt      DateTime?
  approvedBy      String?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  links           AffiliateLink[]
  commissions     AffiliateCommission[]
}

enum AffiliateStatus {
  PENDING
  ACTIVE
  SUSPENDED
}
```

### AffiliateLink Table

```prisma
model AffiliateLink {
  id          String   @id @default(cuid())
  affiliateId String
  affiliate   Affiliate @relation(fields: [affiliateId], references: [id])

  code        String   @unique
  targetPath  String
  name        String?

  clicks      Int      @default(0)
  conversions Int      @default(0)
  isActive    Boolean  @default(true)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### AffiliateCommission Table

```prisma
model AffiliateCommission {
  id          String   @id @default(cuid())
  affiliateId String
  affiliate   Affiliate @relation(fields: [affiliateId], references: [id])
  leadId      String
  lead        Lead     @relation(fields: [leadId], references: [id])

  amount      Decimal
  rate        Decimal
  status      CommissionStatus @default(PENDING)

  approvedAt  DateTime?
  paidAt      DateTime?
  rejectedAt  DateTime?

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

enum CommissionStatus {
  PENDING
  APPROVED
  PAID
  REJECTED
}
```

### Lead Table (Affiliate Reference)

```prisma
model Lead {
  id          String   @id @default(cuid())
  affiliateId String?  // References affiliate who referred
  // ... other lead fields

  commissions AffiliateCommission[]
}
```

---

## 8. API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/affiliates/signup` | Register new affiliate |
| POST | `/api/affiliates/login` | Authenticate, get JWT |
| GET | `/api/affiliates/me` | Get current profile |

### Dashboard & Stats

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/affiliates/stats` | Earnings & traffic stats |
| GET | `/api/affiliates/calls?limit=N` | Recent calls |
| GET | `/api/affiliates/links?limit=N` | Top links |

### Leads

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/affiliates/leads` | Paginated lead list |

**Query Params:**
- `page` - Page number (default 1)
- `limit` - Items per page (default 20)
- `dateFrom` - Filter start date
- `dateTo` - Filter end date

### Commissions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/affiliates/commissions` | Commission history |

**Query Params:**
- `page` - Page number
- `limit` - Items per page
- `status` - Filter by status

### Payouts & Balance

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/affiliates/balance` | Current balance info |
| GET | `/api/affiliates/payouts` | Payout history |
| POST | `/api/affiliates/withdrawals` | Request withdrawal |

### Links

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/affiliates/links` | All affiliate links |
| POST | `/api/affiliates/links` | Create new link |
| PUT | `/api/affiliates/links/[id]` | Update link |
| DELETE | `/api/affiliates/links/[id]` | Delete link |

---

## 9. Key Files Reference

### Pages (Frontend)

| File | Purpose |
|------|---------|
| `src/app/(affiliate)/affiliate/signup/page.tsx` | Signup form |
| `src/app/(affiliate)/affiliate/login/page.tsx` | Login form |
| `src/app/(affiliate)/affiliate/dashboard/page.tsx` | Main dashboard |
| `src/app/(affiliate)/affiliate/leads/page.tsx` | Lead list |
| `src/app/(affiliate)/affiliate/calls/page.tsx` | Call history |
| `src/app/(affiliate)/affiliate/commissions/page.tsx` | Commission tracking |
| `src/app/(affiliate)/affiliate/payouts/page.tsx` | Payout history |
| `src/app/(affiliate)/affiliate/links/page.tsx` | Link management |
| `src/app/(affiliate)/affiliate/settings/page.tsx` | Account settings |

### Components

| File | Purpose |
|------|---------|
| `src/components/affiliate/AffiliateLayout.tsx` | Navigation wrapper |
| `src/components/affiliate/DashboardStats.tsx` | Stats cards |
| `src/components/affiliate/LinkTable.tsx` | Links table |
| `src/components/affiliate/LinkCreateModal.tsx` | Link creation |

### Services

| File | Purpose |
|------|---------|
| `src/lib/services/affiliate-service.ts` | Auth, token management |
| `src/lib/services/affiliate-commission-service.ts` | Commission calculations |
| `src/lib/services/affiliate-link-service.ts` | Link management |

### API Routes

| Directory | Purpose |
|-----------|---------|
| `src/app/api/affiliates/` | All affiliate endpoints |
| `src/app/api/affiliates/signup/route.ts` | Registration |
| `src/app/api/affiliates/login/route.ts` | Authentication |
| `src/app/api/affiliates/leads/route.ts` | Lead data |
| `src/app/api/affiliates/commissions/route.ts` | Commission data |

### Schema

| File | Lines |
|------|-------|
| `prisma/schema.prisma` | ~335-444 (affiliate models) |

---

## 10. Bugs Fixed (2026-01-25)

### BUG-001: Phone Number Now Required ✅ FIXED (Enhanced 2026-01-25)

**Severity:** Medium
**Location:**
- `src/app/api/affiliates/signup/route.ts`
- `src/app/(affiliate)/affiliate/signup/page.tsx`

**What Was Fixed:**
- Created reusable phone utilities at `src/lib/utils/phone.ts`
- Created reusable `PhoneInput` component at `src/components/ui/PhoneInput.tsx`
- Backend: Added proper E.164 normalization with Zod transform
- Frontend: Using new `PhoneInput` component with auto-formatting

**Changes Made:**
```typescript
// Backend validation (route.ts) - normalizes to E.164 format
phone: z.string()
  .min(10, 'Phone number must be at least 10 digits')
  .max(20)
  .regex(US_PHONE_REGEX, 'Phone number must be exactly 10 digits')
  .transform((val) => normalizePhoneNumber(val) || val)

// Frontend (signup/page.tsx) - uses PhoneInput component
<PhoneInput
  value={formData.phone}
  onChange={handlePhoneChange}
  label="Phone number"
  required
  icon={<Phone className="h-5 w-5 text-gray-400" />}
  showValidation
/>
```

**New Reusable Files Created:**
- `src/lib/utils/phone.ts` - Master phone utilities (normalize, validate, format)
- `src/components/ui/PhoneInput.tsx` - Smart phone input with auto-formatting

---

### BUG-002: Affiliate Link Copy Now Uses Correct URL ✅ FIXED

**Severity:** High
**Location:** `src/components/affiliate/LinkTable.tsx`

**What Was Fixed:**
- Updated `copyToClipboard` to use API-provided `trackingUrl` instead of constructing URL with `window.location.origin`
- Added `trackingUrl` to `AffiliateLink` interface in both LinkTable.tsx and links/page.tsx

**Changes Made:**
```typescript
// Before (BROKEN):
const url = link.targetUrl
  ? `${link.targetUrl}...`
  : `${window.location.origin}?ref=${link.code}`;

// After (FIXED):
const copyToClipboard = async (link: AffiliateLink) => {
  // Use the trackingUrl provided by API (https://mycontractornow.com/r/{code})
  await navigator.clipboard.writeText(link.trackingUrl);
  setCopiedId(link.id);
  setTimeout(() => setCopiedId(null), 2000);
};

// Interface updated:
interface AffiliateLink {
  // ... existing fields
  trackingUrl: string;  // Added
}
```

**Result:** Copy button now always copies `https://mycontractornow.com/r/{code}` regardless of environment.

---

## 12. Gaps & Limitations

### No Real-time Updates

| Current | Ideal |
|---------|-------|
| Manual refresh only | WebSocket/SSE for live updates |
| Fetch on page load | Polling or push notifications |
| No notifications | Toast/bell for new leads |

### Limited Attribution Tracking

| Current | Ideal |
|---------|-------|
| Only `?ref=` code tracked | Full UTM parameter support |
| No journey tracking | Multi-touch attribution |
| No link-to-commission mapping | Detailed conversion path |

### Missing Features

- No sub-affiliate/referral system
- No tiered commission rates
- No campaign/promotion management
- No A/B testing for landing pages
- No geographic performance insights
- No automated payouts

### Data Visibility Gaps

- Affiliates cannot see which specific link generated a commission
- No breakdown of earnings by service type
- No historical trend graphs
- No comparison to previous periods

---

## 13. Improvement Opportunities

### High Priority

1. **Real-time Lead Updates**
   - Implement WebSocket or SSE
   - Add toast notifications for new leads
   - Auto-refresh lead list

2. **Enhanced Attribution**
   - Track UTM parameters
   - Link commissions to specific tracking links
   - Add conversion path visualization

3. **Earnings Dashboard Improvements**
   - Add graphs/charts for trends
   - Breakdown by service type
   - Period comparisons (this week vs last week)

### Medium Priority

4. **Advanced Link Management**
   - Custom landing pages per link
   - QR code generation
   - Link performance analytics

5. **Sub-affiliate System**
   - Allow affiliates to recruit others
   - Multi-level commission structure

6. **Notification System**
   - Email notifications for new leads
   - Payout notifications
   - Weekly performance summaries

### Low Priority

7. **API Access**
   - REST API for affiliates to integrate
   - Postback URL support for real-time events
   - Webhook notifications

8. **Advanced Reporting**
   - Exportable reports (CSV, PDF)
   - Custom date ranges
   - Scheduled reports via email

---

## Appendix A: Phone Utilities Reference (Centralized)

### Location
- **Master Utilities:** `src/lib/utils/phone.ts` (single source of truth)
- **Component:** `src/components/ui/PhoneInput.tsx`

### Files Using Centralized Utilities
All phone validation now uses the centralized utilities:

| File | Usage |
|------|-------|
| `src/utils/validation/tcpa.ts` | Re-exports from centralized utils |
| `src/utils/forms/validation.ts` | Uses `isValidUSPhoneNumber`, `formatPhoneForDisplay` |
| `src/lib/validation.ts` | Uses `phoneSchema` with transform |
| `src/lib/validations/lead.ts` | Uses `phoneSchema` for all form schemas |
| `src/hooks/useFormValidation.ts` | Uses tcpa.ts which re-exports |
| `src/components/ui/PhoneInput.tsx` | Uses all formatting functions |
| `src/app/api/affiliates/signup/route.ts` | Uses `normalizePhoneNumber` |

### Available Functions

| Function | Input | Output | Use Case |
|----------|-------|--------|----------|
| `normalizePhoneNumber(phone)` | Any format | E.164 (`+19787980276`) or null | Database storage, API calls |
| `isValidE164PhoneNumber(phone)` | Any | boolean | E.164 format validation |
| `isValidUSPhoneNumber(phone)` | Any | boolean | 10-digit or 11-digit (with 1) US validation |
| `formatPhoneForDisplay(phone)` | E.164 or digits | `(978) 798-0276` | UI display |
| `cleanPhoneNumber(phone)` | Any format | `9787980276` (10 digits) | Form submission |
| `stripPhoneFormatting(phone)` | Any format | All digits | Comparison |
| `formatPhoneAsYouType(phone)` | Partial input | Progressive format | Live formatting |
| `restrictPhoneInput(value)` | User input | Valid chars only | Input restriction |
| `getPhoneDigitCount(phone)` | Any | number | Validation |

### Input Handling

**Accepted Formats (all normalize to 10-digit storage):**
- `9787980276` → stored as `9787980276`
- `(978) 798-0276` → stored as `9787980276`
- `1-978-798-0276` → stored as `9787980276` (leading 1 stripped)
- `+1 (978) 798-0276` → stored as `9787980276` (+1 stripped)

**Display Format:**
- All US numbers display as `(978) 798-0276`
- International numbers preserved as-is

**Max Digits:**
- 10 digits for standard US
- 11 digits if starts with `1` (stripped to 10)
- 10 digits after `+1` prefix

### Zod Patterns

```typescript
import { normalizePhoneNumber, US_PHONE_REGEX, E164_REGEX } from '@/lib/utils/phone';

// For US phone (10 digits, normalized to E.164)
phone: z.string()
  .regex(US_PHONE_REGEX, 'Phone must be 10 digits')
  .transform((val) => normalizePhoneNumber(val) || val)

// For E.164 validation only
phone: z.string().regex(E164_REGEX, 'Must be E.164 format')

// Optional phone that accepts empty
phone: z.string()
  .regex(US_PHONE_REGEX)
  .transform(normalizePhoneNumber)
  .or(z.literal(''))
  .optional()
```

### PhoneInput Component

```tsx
import { PhoneInput } from '@/components/ui/PhoneInput';

<PhoneInput
  value={phone}                    // Current value (clean or formatted)
  onChange={(clean) => set(clean)} // Receives clean 10-digit string
  label="Phone Number"             // Optional label
  required                         // Shows asterisk
  error={errors.phone}             // Error message
  showValidation                   // Green border when valid
  icon={<PhoneIcon />}             // Optional left icon
/>
```

**Features:**
- Auto-formats on blur: `9787980276` → `(978) 798-0276`
- Restricts invalid characters during typing
- Returns clean digits (no formatting) via `onChange`
- Visual validation feedback (green/red borders)

---

## Appendix B: Testing Checklist

### Signup Flow
- [ ] Valid signup creates PENDING affiliate
- [ ] Duplicate email rejected
- [ ] Password validation works
- [ ] Cannot login until ACTIVE
- [x] ~~**BUG-001:** Phone number is required~~ (FIXED 2026-01-25)

### Authentication
- [ ] Valid credentials return JWT
- [ ] Invalid credentials rejected
- [ ] PENDING status shows correct message
- [ ] Token expires correctly
- [ ] Remember me extends cookie expiry

### Dashboard
- [ ] Stats load correctly
- [ ] Recent leads display
- [ ] Quick links work
- [ ] Earnings calculations accurate

### Leads Page
- [ ] Pagination works
- [ ] Date filtering works
- [ ] Status colors correct
- [ ] Commission amounts accurate

### Commissions
- [ ] Summary totals accurate
- [ ] Status filtering works
- [ ] Commission details correct

### Payouts
- [ ] Balance calculation correct
- [ ] Minimum payout enforced
- [ ] Payment method required for withdrawal
- [ ] Payout history displays correctly

### Links
- [ ] Create new link works
- [ ] Click tracking works
- [ ] Conversion tracking works
- [ ] Link deactivation works
- [x] ~~**BUG-002:** Copy button copies correct URL `https://mycontractornow.com/r/{code}`~~ (FIXED 2026-01-25)
- [ ] Redirect route `/r/{code}` works correctly
