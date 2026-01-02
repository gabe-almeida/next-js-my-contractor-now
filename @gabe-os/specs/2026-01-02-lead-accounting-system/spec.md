# Lead Accounting System Spec

**Purpose:** Allow super admins to track lead status changes, mark leads as scrubbed/refunded, and maintain a complete audit trail of who changed what and when.

**For:** My Contractor Now platform owners/staff (super admins only)

---

## User Stories

### Story 1: Admin Views Lead Status History

**WHO:** Sarah (Super Admin)
**WHEN:** A contractor calls to dispute a lead they purchased
**WHY:** Sarah needs to see the complete history of what happened to this lead

**FLOW:**
1. Sarah opens Admin Dashboard → Leads
2. Searches for lead by ID or contractor name
3. Clicks "View" on the lead
4. Sees a **Status History** section showing:
   - `Jan 2, 10:15am` — Lead created (PENDING) — *System*
   - `Jan 2, 10:15am` — Auction started (PROCESSING) — *System*
   - `Jan 2, 10:16am` — Sold to ABC Contracting for $42 (SOLD) — *System*
   - `Jan 2, 2:30pm` — Marked as SCRUBBED — *Sarah* — "Contractor reported duplicate"
5. Sarah can now explain the full timeline to the contractor

---

### Story 2: Admin Scrubs a Bad Lead

**WHO:** Mike (Super Admin)
**WHEN:** A contractor reports a lead was fake/invalid within 24 hours
**WHY:** Platform policy allows returns within 24 hours for bad leads

**FLOW:**
1. Mike opens Admin Dashboard → Leads
2. Finds the disputed lead
3. Clicks "View" → sees lead details and current status (SOLD)
4. Clicks **"Change Status"** button
5. Selects new status: **SCRUBBED**
6. Selects disposition: **RETURNED**
7. Enters reason: "Fake phone number - contractor verified"
8. Clicks "Confirm"
9. System records:
   - Status changed SOLD → SCRUBBED
   - Disposition: RETURNED
   - Changed by: Mike (user_id)
   - Timestamp: now
   - Reason: "Fake phone number..."
   - IP address
10. Lead now shows SCRUBBED status with full audit trail

---

### Story 3: Admin Issues a Refund/Credit

**WHO:** Sarah (Super Admin)
**WHEN:** After scrubbing a lead, contractor needs to be credited
**WHY:** Contractor paid $42 for a bad lead and deserves credit

**FLOW:**
1. Sarah views the scrubbed lead
2. Sees disposition is RETURNED but no financial action taken yet
3. Clicks **"Issue Credit"**
4. Enters credit amount: $42.00
5. Selects: "Full refund" or "Partial credit"
6. Enters note: "Full credit for returned lead"
7. Clicks "Confirm"
8. System records:
   - Disposition changed: RETURNED → CREDITED
   - Credit amount: $42.00
   - Changed by: Sarah
   - Timestamp: now
9. (Future: This could integrate with billing system)

---

### Story 4: Admin Filters Leads by Disposition

**WHO:** Finance team member
**WHEN:** End of month reconciliation
**WHY:** Need to see all refunded/credited leads for accounting

**FLOW:**
1. Opens Admin Dashboard → Leads
2. Uses filter dropdown for **Disposition**:
   - All
   - DELIVERED (normal sold leads)
   - RETURNED (scrubbed, awaiting credit)
   - CREDITED (refund issued)
   - DISPUTED (under review)
3. Selects "CREDITED" + date range "January 2026"
4. Sees list of all credited leads with amounts
5. Clicks "Export" for accounting records

---

## Data Model Changes

### New: `AdminUser` table (for user attribution)

```sql
admin_users
├── id (uuid, PK)
├── email (unique)
├── name
├── role (SUPER_ADMIN | ADMIN | SUPPORT)
├── active (boolean)
├── created_at
└── updated_at
```

### New: `lead_status_history` table

```sql
lead_status_history
├── id (uuid, PK)
├── lead_id (FK → leads)
├── admin_user_id (FK → admin_users, nullable for system actions)
├── old_status
├── new_status
├── old_disposition
├── new_disposition
├── reason (text)
├── credit_amount (decimal, nullable)
├── change_source (SYSTEM | ADMIN | WEBHOOK)
├── ip_address
├── created_at
```

### Modified: `leads` table

```sql
leads (add columns)
├── disposition (NEW | DELIVERED | RETURNED | DISPUTED | CREDITED | WRITTEN_OFF)
├── credit_amount (decimal, nullable)
├── credit_issued_at (timestamp, nullable)
```

### Modified: `LeadStatus` enum (add values)

```typescript
PENDING | PROCESSING | AUCTIONED | SOLD | REJECTED | EXPIRED
+ SCRUBBED    // Bad lead marked by admin
+ DUPLICATE   // Duplicate lead detected
```

---

## Implementation Tasks

### Phase 1: Database Schema
- [ ] **1.1** Add `AdminUser` model to Prisma schema
- [ ] **1.2** Add `LeadStatusHistory` model to Prisma schema
- [ ] **1.3** Add `disposition`, `creditAmount`, `creditIssuedAt` fields to `Lead` model
- [ ] **1.4** Add `SCRUBBED`, `DUPLICATE` to LeadStatus enum
- [ ] **1.5** Create and run Prisma migration
- [ ] **1.6** Seed initial admin user(s)

### Phase 2: Backend API
- [ ] **2.1** Create `GET /api/admin/leads/[id]/history` — fetch status history for a lead
- [ ] **2.2** Update `PUT /api/admin/leads/[id]` — record status change with user attribution
- [ ] **2.3** Create `POST /api/admin/leads/[id]/credit` — issue credit for a lead
- [ ] **2.4** Update `GET /api/admin/leads` — add disposition filter parameter
- [ ] **2.5** Add admin user context to middleware (extract user from JWT)

### Phase 3: Admin UI
- [ ] **3.1** Add "Status History" section to Lead Detail view
- [ ] **3.2** Add "Change Status" button and modal to Lead Detail view
- [ ] **3.3** Add "Issue Credit" button and modal for scrubbed leads
- [ ] **3.4** Add "Disposition" filter dropdown to Leads list page
- [ ] **3.5** Update LeadTable to show disposition column
- [ ] **3.6** Add status change confirmation with reason input

### Phase 4: Audit & Logging
- [ ] **4.1** Ensure all status changes create LeadStatusHistory record
- [ ] **4.2** Log admin user ID, IP, timestamp on every change
- [ ] **4.3** Add system attribution for automated status changes (worker)

---

## Status & Disposition Values

### Lead Status (processing state)
| Status | Meaning |
|--------|---------|
| PENDING | Lead submitted, awaiting processing |
| PROCESSING | In auction |
| AUCTIONED | Bids received, winner determined |
| SOLD | Successfully delivered to buyer |
| REJECTED | No buyer accepted |
| EXPIRED | Timed out |
| **SCRUBBED** | Marked as bad/invalid by admin |
| **DUPLICATE** | Duplicate lead |

### Lead Disposition (financial state)
| Disposition | Meaning |
|-------------|---------|
| NEW | Fresh lead, not yet delivered |
| DELIVERED | Successfully sold and delivered |
| RETURNED | Buyer returned (scrubbed) |
| DISPUTED | Under review |
| CREDITED | Refund/credit issued |
| WRITTEN_OFF | No action, written off |

---

## Acceptance Criteria

- [ ] Admin can view complete status history for any lead
- [ ] Admin can change lead status with required reason
- [ ] Admin can issue credit for scrubbed leads
- [ ] All changes record: who, when, why, from what IP
- [ ] Leads list can filter by disposition
- [ ] System-triggered changes show "System" as actor
- [ ] Admin-triggered changes show admin name
