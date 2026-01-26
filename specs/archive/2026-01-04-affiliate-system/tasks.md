# Affiliate System - Implementation Tasks

**Created:** 2026-01-04
**Status:** Ready for Implementation
**Total Tasks:** 32

---

## Task Execution Strategy

Tasks are organized into **Batches** for parallel execution where possible.
Dependencies are marked with `depends:` tags.

---

## Batch 1: Database Schema (Foundation)

> **Execute first - all other tasks depend on this**

### Task 1.1: Add Affiliate Models to Prisma Schema
- [ ] **File:** `/prisma/schema.prisma`
- [ ] Add `AffiliateStatus` enum (PENDING, ACTIVE, SUSPENDED)
- [ ] Add `CommissionStatus` enum (PENDING, APPROVED, PAID, REJECTED)
- [ ] Add `WithdrawalStatus` enum (REQUESTED, PROCESSING, COMPLETED, FAILED)
- [ ] Add `Affiliate` model with all fields
- [ ] Add `AffiliateLink` model with indexes
- [ ] Add `AffiliateCommission` model with Lead relation
- [ ] Add `AffiliateWithdrawal` model
- [ ] Add `affiliateCommissions` relation to existing `Lead` model
- [ ] **Standards:** Follow existing enum naming convention

### Task 1.2: Run Database Migration
- [ ] **Command:** `npx prisma migrate dev --name add_affiliate_system`
- [ ] Verify migration successful
- [ ] **Command:** `npx prisma generate`
- [ ] Verify Prisma client updated
- **depends:** Task 1.1

### Task 1.3: Add TypeScript Types
- [ ] **File:** `/src/types/database.ts`
- [ ] Add `AffiliateStatus`, `CommissionStatus`, `WithdrawalStatus` enums
- [ ] Add `Affiliate`, `AffiliateLink`, `AffiliateCommission`, `AffiliateWithdrawal` interfaces
- [ ] Add `AffiliateStats` interface for dashboard
- [ ] **Standards:** Align with Prisma schema exactly
- **depends:** Task 1.1

---

## Batch 2: Core Services (Can run in parallel)

> **depends:** Batch 1 complete

### Task 2.1: Create Affiliate Service
- [ ] **File:** `/src/lib/services/affiliate-service.ts`
- [ ] Add WHY/WHEN/HOW documentation header
- [ ] Implement `createAffiliate(data)` - registration
- [ ] Implement `getAffiliateById(id)`
- [ ] Implement `getAffiliateByEmail(email)`
- [ ] Implement `updateAffiliate(id, data)`
- [ ] Implement `updateAffiliateStatus(id, status)`
- [ ] Implement `validateAffiliatePassword(email, password)`
- [ ] Implement `generateAffiliateToken(affiliate)` - JWT generation
- [ ] Add password hashing with bcrypt
- [ ] **Standards:** Keep under 500 lines, use existing patterns

### Task 2.2: Create Affiliate Link Service
- [ ] **File:** `/src/lib/services/affiliate-link-service.ts`
- [ ] Add WHY/WHEN/HOW documentation header
- [ ] Implement `createLink(affiliateId, data)`
- [ ] Implement `generateUniqueCode()` - random code generation
- [ ] Implement `validateCodeUniqueness(code)`
- [ ] Implement `getLinksByAffiliateId(affiliateId)`
- [ ] Implement `updateLink(id, data)`
- [ ] Implement `deleteLink(id)` - soft delete
- [ ] Implement `trackClick(code)` - increment counter
- [ ] Implement `getLinkByCode(code)`
- [ ] **Standards:** Keep under 500 lines

### Task 2.3: Create Commission Service
- [ ] **File:** `/src/lib/services/affiliate-commission-service.ts`
- [ ] Add WHY/WHEN/HOW documentation header
- [ ] Implement `createCommissionForLead(leadId)` - check attribution, calculate, create
- [ ] Implement `getCommissionsByAffiliateId(affiliateId, filters)`
- [ ] Implement `approveCommissions(ids[])` - bulk approve
- [ ] Implement `rejectCommission(id, reason)`
- [ ] Implement `markCommissionsAsPaid(ids[])`
- [ ] Implement `getAffiliateStats(affiliateId)` - totals, pending, available
- [ ] Implement `calculateCommissionAmount(leadWinningBid, rate)`
- [ ] **Standards:** Keep under 500 lines, follow lead-accounting-service pattern

### Task 2.4: Create Withdrawal Service
- [ ] **File:** `/src/lib/services/affiliate-withdrawal-service.ts`
- [ ] Add WHY/WHEN/HOW documentation header
- [ ] Implement `createWithdrawalRequest(affiliateId, amount, method, details)`
- [ ] Implement `getWithdrawalsByAffiliateId(affiliateId)`
- [ ] Implement `getAllWithdrawals(filters)` - for admin
- [ ] Implement `processWithdrawal(id, status, notes)`
- [ ] Implement `getAvailableBalance(affiliateId)`
- [ ] Add minimum withdrawal validation ($50)
- [ ] **Standards:** Keep under 500 lines

---

## Batch 3: Auth Extension & Attribution (Can run in parallel)

> **depends:** Batch 1 complete

### Task 3.1: Extend Auth System for Affiliates
- [ ] **File:** `/src/lib/auth.ts`
- [ ] Add `AFFILIATE` to Role type
- [ ] Add affiliate permissions array
- [ ] Update `getRolePermissions()` to include affiliate
- [ ] Create `authenticateAffiliateRequest()` function
- [ ] Create `withAffiliateAuth()` middleware wrapper
- [ ] **Reuse:** Existing JWT logic, just different claims

### Task 3.2: Extend Attribution Tracking
- [ ] **File:** `/src/utils/attribution.ts`
- [ ] Add `affiliate_id` to `AttributionData` interface
- [ ] Update `extractAttributionData()` to capture `aff`, `affiliate_id`, `ref` params
- [ ] Update `getAttributionData()` to include affiliate
- [ ] **Standards:** Minimal change, extend existing function

### Task 3.3: Hook Attribution into Lead Creation
- [ ] **File:** `/src/app/api/leads/route.ts`
- [ ] After lead creation, check for `affiliate_id` in attribution
- [ ] If present, call `affiliateLinkService.attributeLeadToAffiliate()`
- [ ] Increment link conversion counter
- [ ] **Standards:** Add comment explaining affiliate attribution

### Task 3.4: Hook Commission into Lead Sold
- [ ] **File:** `/src/lib/services/lead-accounting-service.ts`
- [ ] In `changeLeadStatus()`, after status changes to SOLD
- [ ] Call `affiliateCommissionService.createCommissionForLead(leadId)`
- [ ] Handle case where lead has no affiliate (no-op)
- [ ] **Standards:** Add WHY comment explaining commission trigger

---

## Batch 4: Public Affiliate APIs

> **depends:** Batch 2 & 3 complete

### Task 4.1: Signup API
- [ ] **File:** `/src/app/api/affiliates/signup/route.ts`
- [ ] POST handler with Zod validation
- [ ] Call `affiliateService.createAffiliate()`
- [ ] Return success with affiliate ID (not token - needs approval first)
- [ ] **Reuse:** Middleware wrapper, response utils

### Task 4.2: Login API
- [ ] **File:** `/src/app/api/affiliates/login/route.ts`
- [ ] POST handler with email/password
- [ ] Validate credentials via `affiliateService.validateAffiliatePassword()`
- [ ] Check status === ACTIVE
- [ ] Generate and return JWT token
- [ ] **Reuse:** Existing JWT generation pattern

### Task 4.3: Profile APIs
- [ ] **File:** `/src/app/api/affiliates/me/route.ts`
- [ ] GET - Return current affiliate profile (from token)
- [ ] PUT - Update profile fields
- [ ] Use `withAffiliateAuth()` middleware
- [ ] **Standards:** Follow admin API pattern

### Task 4.4: Links APIs
- [ ] **File:** `/src/app/api/affiliates/links/route.ts`
- [ ] GET - List affiliate's links with pagination
- [ ] POST - Create new link
- [ ] **File:** `/src/app/api/affiliates/links/[id]/route.ts`
- [ ] PUT - Update link
- [ ] DELETE - Soft delete link
- [ ] Use `withAffiliateAuth()` middleware

### Task 4.5: Leads API
- [ ] **File:** `/src/app/api/affiliates/leads/route.ts`
- [ ] GET - List referred leads (privacy-safe: ID, service, status, amount only)
- [ ] Support date range and service type filters
- [ ] Pagination (20 per page)
- [ ] Use `withAffiliateAuth()` middleware

### Task 4.6: Commissions API
- [ ] **File:** `/src/app/api/affiliates/commissions/route.ts`
- [ ] GET - List affiliate's commissions
- [ ] Support status filter
- [ ] Pagination
- [ ] Use `withAffiliateAuth()` middleware

### Task 4.7: Stats API
- [ ] **File:** `/src/app/api/affiliates/stats/route.ts`
- [ ] GET - Return dashboard statistics
- [ ] Call `affiliateCommissionService.getAffiliateStats()`
- [ ] Cache result for 5 minutes
- [ ] Use `withAffiliateAuth()` middleware

### Task 4.8: Withdrawals APIs
- [ ] **File:** `/src/app/api/affiliates/withdrawals/route.ts`
- [ ] GET - List affiliate's withdrawal requests
- [ ] POST - Create new withdrawal request
- [ ] Validate minimum balance
- [ ] Use `withAffiliateAuth()` middleware

---

## Batch 5: Admin Affiliate APIs

> **depends:** Batch 2 complete

### Task 5.1: Admin Affiliates List/Create
- [ ] **File:** `/src/app/api/admin/affiliates/route.ts`
- [ ] GET - List all affiliates with pagination, filters
- [ ] POST - Admin-create affiliate (auto-approved)
- [ ] Use existing admin middleware
- [ ] **Reuse:** Pattern from `/api/admin/buyers/route.ts`

### Task 5.2: Admin Affiliate Detail
- [ ] **File:** `/src/app/api/admin/affiliates/[id]/route.ts`
- [ ] GET - Affiliate details with stats
- [ ] PUT - Update affiliate (including status)
- [ ] **Reuse:** Pattern from `/api/admin/buyers/[id]/route.ts`

### Task 5.3: Admin Affiliate Actions
- [ ] **File:** `/src/app/api/admin/affiliates/[id]/approve/route.ts`
- [ ] POST - Approve pending affiliate
- [ ] **File:** `/src/app/api/admin/affiliates/[id]/suspend/route.ts`
- [ ] POST - Suspend affiliate

### Task 5.4: Admin Commissions
- [ ] **File:** `/src/app/api/admin/commissions/route.ts`
- [ ] GET - List all pending commissions
- [ ] **File:** `/src/app/api/admin/commissions/approve/route.ts`
- [ ] POST - Bulk approve commissions

### Task 5.5: Admin Withdrawals
- [ ] **File:** `/src/app/api/admin/withdrawals/route.ts`
- [ ] GET - List all withdrawal requests
- [ ] **File:** `/src/app/api/admin/withdrawals/[id]/route.ts`
- [ ] PUT - Process withdrawal (complete/fail)

---

## Batch 6: Affiliate Portal Frontend

> **depends:** Batch 4 complete

### Task 6.1: Affiliate Layout
- [ ] **File:** `/src/app/(affiliate)/layout.tsx`
- [ ] Create route group layout
- [ ] Wrap with affiliate auth check
- [ ] **File:** `/src/components/affiliate/AffiliateLayout.tsx`
- [ ] Main layout with sidebar
- [ ] **File:** `/src/components/affiliate/AffiliateSidebar.tsx`
- [ ] Navigation: Dashboard, Links, Leads, Commissions, Withdrawals, Settings
- [ ] **Reuse:** Pattern from AdminLayout

### Task 6.2: Login & Signup Pages
- [ ] **File:** `/src/app/(affiliate)/login/page.tsx`
- [ ] Email/password form
- [ ] Error handling
- [ ] Redirect to dashboard on success
- [ ] **File:** `/src/app/(affiliate)/signup/page.tsx`
- [ ] Registration form
- [ ] Success message (awaiting approval)
- [ ] **Reuse:** Form components, validation patterns

### Task 6.3: Dashboard Page
- [ ] **File:** `/src/app/(affiliate)/affiliate/dashboard/page.tsx`
- [ ] **File:** `/src/components/affiliate/DashboardStats.tsx`
- [ ] Stats cards: Total Earned, Pending, Available, Clicks, Conversions
- [ ] Recent activity list
- [ ] Quick link generator
- [ ] **Standards:** Keep page under 300 lines, extract components

### Task 6.4: Links Management Page
- [ ] **File:** `/src/app/(affiliate)/affiliate/links/page.tsx`
- [ ] **File:** `/src/components/affiliate/LinkTable.tsx`
- [ ] List links with stats
- [ ] **File:** `/src/components/affiliate/LinkCreateModal.tsx`
- [ ] Create link form with target selector
- [ ] Copy URL button
- [ ] Toggle active/inactive

### Task 6.5: Leads Page
- [ ] **File:** `/src/app/(affiliate)/affiliate/leads/page.tsx`
- [ ] **File:** `/src/components/affiliate/LeadTable.tsx`
- [ ] Privacy-safe lead list
- [ ] Date range filter
- [ ] Service type filter
- [ ] Status badges

### Task 6.6: Commissions Page
- [ ] **File:** `/src/app/(affiliate)/affiliate/commissions/page.tsx`
- [ ] **File:** `/src/components/affiliate/CommissionTable.tsx`
- [ ] Commission list with status
- [ ] **File:** `/src/components/affiliate/EarningsChart.tsx`
- [ ] Monthly earnings chart
- [ ] Filter by status

### Task 6.7: Withdrawals Page
- [ ] **File:** `/src/app/(affiliate)/affiliate/withdrawals/page.tsx`
- [ ] **File:** `/src/components/affiliate/WithdrawalForm.tsx`
- [ ] Available balance display
- [ ] Request withdrawal form
- [ ] Withdrawal history list

### Task 6.8: Settings Page
- [ ] **File:** `/src/app/(affiliate)/affiliate/settings/page.tsx`
- [ ] Profile edit form
- [ ] Password change
- [ ] Payment method management

---

## Batch 7: Admin Affiliate Pages

> **depends:** Batch 5 complete

### Task 7.1: Admin Affiliates List
- [ ] **File:** `/src/app/(admin)/admin/affiliates/page.tsx`
- [ ] List all affiliates with status badges
- [ ] Search by name/email
- [ ] Filter by status
- [ ] Approve/suspend actions
- [ ] **Reuse:** Pattern from admin/buyers/page.tsx

### Task 7.2: Admin Affiliate Detail
- [ ] **File:** `/src/app/(admin)/admin/affiliates/[id]/page.tsx`
- [ ] Affiliate profile with stats
- [ ] Links list
- [ ] Commission history
- [ ] Withdrawal history
- [ ] Actions: approve, suspend, edit

### Task 7.3: Add Affiliates to Admin Nav
- [ ] **File:** `/src/components/admin/AdminLayout.tsx` or AdminSidebar
- [ ] Add "Affiliates" menu item
- [ ] Add icon (Users or similar from lucide-react)

---

## Batch 8: Testing & Polish

> **depends:** All previous batches complete

### Task 8.1: Unit Tests
- [ ] **File:** `/tests/unit/affiliate-service.test.ts`
- [ ] Test commission calculation
- [ ] Test link code generation
- [ ] Test status transitions

### Task 8.2: Integration Tests
- [ ] **File:** `/tests/integration/affiliate-flow.test.ts`
- [ ] Test signup → login flow
- [ ] Test link click → lead attribution
- [ ] Test lead sold → commission created

### Task 8.3: Manual Testing Checklist
- [ ] Complete signup flow
- [ ] Login as affiliate
- [ ] Create tracking link
- [ ] Click link → submit lead → verify attribution
- [ ] Admin approve affiliate
- [ ] Admin approve commission
- [ ] Request withdrawal

---

## Summary

| Batch | Tasks | Parallel? | Est. Hours |
|-------|-------|-----------|------------|
| 1: Database | 3 | No | 1-2 |
| 2: Services | 4 | Yes | 3-4 |
| 3: Auth & Attribution | 4 | Yes | 2-3 |
| 4: Public APIs | 8 | Partial | 3-4 |
| 5: Admin APIs | 5 | Yes | 2-3 |
| 6: Affiliate Portal | 8 | Partial | 4-5 |
| 7: Admin Pages | 3 | Yes | 2-3 |
| 8: Testing | 3 | Yes | 2-3 |
| **Total** | **38** | | **19-27** |

---

## Quick Start

```bash
# Start with database
npx prisma migrate dev --name add_affiliate_system

# Then run Batch 2 services in parallel
# Then run Batch 3 auth & attribution in parallel
# Continue through batches...
```

**Ready for:** `/gabe-os/implement-spec`
