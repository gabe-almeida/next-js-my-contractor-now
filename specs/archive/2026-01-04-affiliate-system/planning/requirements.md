# Affiliate System - Requirements

**Created:** 2026-01-04
**Status:** Requirements Complete

---

## Feature Overview

Allow affiliates to sign up, get unique tracking links, refer traffic to lead forms, view their referred leads and commission status, and request payouts.

---

## Requirement Answers

| Question | Answer | Details |
|----------|--------|---------|
| Feature Scope | D - Complete Module | Standalone functionality with full CRUD operations |
| Data Management | C - New Tables | Create Affiliate, AffiliateLink, AffiliateCommission, AffiliateWithdrawal tables |
| User Interface | D - Full Interface | Complete affiliate portal with dashboard, links, commissions, settings |
| API Requirements | D - Complex API | Full REST resource with relationships (auth, links, commissions, payouts) |
| Authentication | C - Role-based | New AFFILIATE role alongside existing ADMIN/MANAGER/VIEWER |
| Testing | B - Unit Tests | Test commission calculations, link generation, authentication |
| Error Handling | B - User-friendly | Validate input, show helpful error messages |
| Performance | B - Caching | Cache affiliate stats, commission summaries |

---

## User Stories

### US-1: Affiliate Registration
**As a** potential affiliate
**I want to** sign up with my email and company info
**So that** I can start referring leads and earning commissions

**Acceptance Criteria:**
- [ ] Registration form with email, password, name, company (optional), phone (optional)
- [ ] Email verification required before activation
- [ ] Admin approval workflow (affiliates start as PENDING)
- [ ] Welcome email with getting started guide

### US-2: Affiliate Login
**As a** registered affiliate
**I want to** log into my dashboard
**So that** I can manage my links and view my earnings

**Acceptance Criteria:**
- [ ] JWT-based authentication
- [ ] Password reset functionality
- [ ] Session management (remember me, logout)
- [ ] Redirect to dashboard after login

### US-3: Generate Tracking Links
**As an** affiliate
**I want to** create unique tracking links for different campaigns
**So that** I can track which campaigns perform best

**Acceptance Criteria:**
- [ ] Generate links for any service page (/windows, /roofing, /bathrooms)
- [ ] Custom tracking codes (e.g., ?aff=john123 or ?aff=john-facebook-jan)
- [ ] View click counts per link
- [ ] Activate/deactivate links
- [ ] Copy link to clipboard functionality

### US-4: View Referred Leads
**As an** affiliate
**I want to** see all leads I've referred
**So that** I can track my conversion performance

**Acceptance Criteria:**
- [ ] List of leads with: date, service type, status, commission amount
- [ ] Filter by date range, service type, status
- [ ] Show lead status: Pending → Sold → Commission Approved → Paid
- [ ] Privacy: Show only lead ID and service, NOT customer PII

### US-5: Track Commissions
**As an** affiliate
**I want to** see my commission earnings and status
**So that** I know how much I've earned and what's pending

**Acceptance Criteria:**
- [ ] Dashboard showing: Total Earned, Pending, Available for Withdrawal
- [ ] Commission breakdown by lead
- [ ] Commission status: PENDING → APPROVED → PAID
- [ ] Historical earnings chart (monthly)

### US-6: Request Payout
**As an** affiliate
**I want to** request withdrawal of my available balance
**So that** I can receive my earnings

**Acceptance Criteria:**
- [ ] Minimum withdrawal threshold ($50)
- [ ] Withdrawal request form
- [ ] View payout history with status
- [ ] Payment method management (PayPal, bank transfer, etc.)

### US-7: Admin Affiliate Management
**As an** admin
**I want to** manage affiliates and their commissions
**So that** I can approve affiliates, adjust commissions, and process payouts

**Acceptance Criteria:**
- [ ] List all affiliates with status, performance metrics
- [ ] Approve/suspend affiliates
- [ ] Set custom commission rates per affiliate
- [ ] View affiliate's links and performance
- [ ] Approve/reject commission payments
- [ ] Process bulk payouts

---

## Functional Requirements

### FR-1: Affiliate Registration & Auth
- Email/password registration with validation
- JWT tokens with AFFILIATE role
- Password hashing with bcrypt
- Email verification flow
- Password reset via email

### FR-2: Tracking Link System
- Unique affiliate codes (auto-generated or custom)
- URL format: `mycontractornow.com/{service}?aff={code}`
- Click tracking (increment counter on link visit)
- Support multiple links per affiliate
- Link analytics (clicks, conversions, conversion rate)

### FR-3: Attribution System
- Capture `aff` parameter on lead form pages
- Store affiliate_id in Lead.complianceData or new field
- Attribution window: 30 days (cookie-based)
- First-touch attribution model

### FR-4: Commission Calculation
- Default commission rate: 10% of lead sale price
- Custom rates per affiliate supported
- Commission created when lead status = SOLD
- Commission amount = winningBid × commissionRate
- Commission statuses: PENDING → APPROVED → PAID

### FR-5: Payout System
- Minimum withdrawal: $50
- Payout methods: PayPal (Phase 1), Bank Transfer (Phase 2)
- Payout statuses: REQUESTED → PROCESSING → COMPLETED / FAILED
- Admin approval required for payouts

---

## Non-Functional Requirements

### NFR-1: Security
- Affiliates cannot see customer PII (only lead ID, service, amount)
- API rate limiting on affiliate endpoints
- Secure password storage (bcrypt)
- JWT token expiration (24h access, 7d refresh)

### NFR-2: Performance
- Cache affiliate dashboard stats (5 min TTL)
- Paginate lead/commission lists (50 per page)
- Index affiliate_id in leads for fast lookups

### NFR-3: Scalability
- Support 1000+ affiliates
- Handle 10,000+ affiliate-referred leads/month
- Efficient commission batch processing

---

## Edge Cases

1. **Lead returned/credited** → Commission should be reversed or marked REJECTED
2. **Affiliate suspended** → Existing commissions still paid, no new referrals
3. **Multiple affiliates claim same lead** → First-touch wins (earliest click)
4. **Affiliate link inactive** → Still track but don't attribute new leads
5. **Commission rate changed** → Only affects future leads, not existing

---

## Out of Scope (Phase 1)

- Multi-tier affiliate programs (sub-affiliates)
- Real-time commission notifications
- Affiliate API for programmatic access
- Custom landing pages per affiliate
- Automated payout processing (Stripe Connect)
