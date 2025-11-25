# Testing Plan

This is the testing plan for the spec detailed in @.agent-os/specs/2025-10-16-database-integration-remove-mocks/spec.md

## Testing Overview

Comprehensive testing strategy covering unit tests, integration tests, and end-to-end scenarios to verify complete removal of mock data and proper database integration.

---

## Phase 1: Database Seed Verification

### Test 1.1: Seed Script Execution
**Objective:** Verify seed script runs successfully and creates all required data

**Steps:**
1. Clear database: `npm run db:push -- --force-reset`
2. Run seed: `npm run db:seed`
3. Open Prisma Studio: `npm run db:studio`

**Expected Results:**
- ✓ Script completes without errors
- ✓ 5 buyers created with full contact details
- ✓ 4 service types created with form schemas
- ✓ 100+ ZIP code metadata entries
- ✓ 20 buyer service configs (5 buyers × 4 services)
- ✓ 50-100 buyer service ZIP codes with varied priorities
- ✓ 20 sample leads (10 SOLD, 5 PROCESSING, 5 PENDING)
- ✓ 30+ transactions with PING/POST history
- ✓ Compliance audit logs for all leads

**Validation Queries:**
```sql
-- Verify counts
SELECT 'Buyers' as entity, COUNT(*) as count FROM buyers
UNION SELECT 'Service Types', COUNT(*) FROM service_types
UNION SELECT 'ZIP Configs', COUNT(*) FROM buyer_service_zip_codes
UNION SELECT 'Leads', COUNT(*) FROM leads
UNION SELECT 'Transactions', COUNT(*) FROM transactions;

-- Verify relationships
SELECT
  b.name as buyer,
  st.display_name as service,
  COUNT(bsz.id) as zip_codes
FROM buyers b
JOIN buyer_service_zip_codes bsz ON bsz.buyer_id = b.id
JOIN service_types st ON st.id = bsz.service_type_id
GROUP BY b.id, b.name, st.id, st.display_name
ORDER BY b.name, st.display_name;
```

---

## Phase 2: API Endpoint Testing

### Test 2.1: Buyer ZIP Code Management APIs

#### GET /api/admin/buyers/[id]/zip-codes
**Test Cases:**
1. **Valid buyer with ZIP codes**
   - Request: `GET /api/admin/buyers/{homeadvisor-id}/zip-codes`
   - Expected: 200, grouped data by service type
   - Verify: Response includes serviceName, zipCodes array, meta stats

2. **Filter by service type**
   - Request: `GET /api/admin/buyers/{buyer-id}/zip-codes?serviceTypeId={windows-id}`
   - Expected: 200, only Windows ZIP codes returned
   - Verify: All returned ZIPs are for Windows service

3. **Include inactive ZIPs**
   - Request: `GET /api/admin/buyers/{buyer-id}/zip-codes?includeInactive=true`
   - Expected: 200, includes active=false ZIPs
   - Verify: Some ZIPs have active: false

4. **Invalid buyer ID**
   - Request: `GET /api/admin/buyers/invalid-uuid/zip-codes`
   - Expected: 400, validation error

5. **Buyer not found**
   - Request: `GET /api/admin/buyers/{non-existent-uuid}/zip-codes`
   - Expected: 200, empty data array

#### POST /api/admin/buyers/[id]/zip-codes
**Test Cases:**
1. **Add valid ZIP codes**
   ```json
   {
     "serviceTypeId": "{windows-id}",
     "zipCodes": ["99999", "99998"],
     "priority": 7,
     "maxLeadsPerDay": 15,
     "minBid": 20.00,
     "maxBid": 75.00
   }
   ```
   - Expected: 201, created records returned
   - Verify: Records exist in database
   - Verify: Priority and bid limits saved correctly

2. **Duplicate ZIP codes**
   ```json
   {
     "serviceTypeId": "{windows-id}",
     "zipCodes": ["90210"],  // Already exists
     "priority": 5
   }
   ```
   - Expected: 409, conflict error
   - Verify: Error message lists duplicates

3. **Invalid ZIP format**
   ```json
   {
     "serviceTypeId": "{windows-id}",
     "zipCodes": ["123", "ABCDE"],
     "priority": 5
   }
   ```
   - Expected: 400, validation error
   - Verify: Error details show which ZIPs are invalid

4. **Missing required fields**
   ```json
   {
     "zipCodes": ["12345"]
   }
   ```
   - Expected: 400, validation error
   - Verify: Error indicates missing serviceTypeId

#### PUT /api/admin/buyers/[id]/zip-codes
**Test Cases:**
1. **Bulk update priority**
   ```json
   {
     "zipCodeIds": ["{zip-id-1}", "{zip-id-2}"],
     "updates": { "priority": 9 }
   }
   ```
   - Expected: 200, updatedCount: 2
   - Verify: Priority changed in database

2. **Deactivate ZIP codes**
   ```json
   {
     "zipCodeIds": ["{zip-id-1}"],
     "updates": { "active": false }
   }
   ```
   - Expected: 200, updatedCount: 1
   - Verify: ZIP is now inactive

#### DELETE /api/admin/buyers/[id]/zip-codes
**Test Cases:**
1. **Delete single ZIP**
   - Request: `DELETE /api/admin/buyers/{buyer-id}/zip-codes?ids={zip-id}`
   - Expected: 200, deletedCount: 1
   - Verify: Record removed from database

2. **Bulk delete**
   - Request: `DELETE /api/admin/buyers/{buyer-id}/zip-codes?ids={id1},{id2},{id3}`
   - Expected: 200, deletedCount: 3
   - Verify: All records removed

### Test 2.2: Buyer Management APIs

#### GET /api/admin/buyers
**Test Cases:**
1. **List all buyers**
   - Request: `GET /api/admin/buyers`
   - Expected: 200, array of 5 buyers
   - Verify: Includes _count for serviceConfigs, serviceZipCodes, wonLeads

2. **Pagination**
   - Request: `GET /api/admin/buyers?page=1&limit=2`
   - Expected: 200, 2 buyers, meta.total=5, meta.pages=3

3. **Filter by active status**
   - Request: `GET /api/admin/buyers?active=true`
   - Expected: 200, only active buyers

4. **Filter by type**
   - Request: `GET /api/admin/buyers?type=NETWORK`
   - Expected: 200, only NETWORK buyers (HomeAdvisor, Modernize, Angi)

5. **Search by name**
   - Request: `GET /api/admin/buyers?search=homeadvisor`
   - Expected: 200, only HomeAdvisor buyer

#### POST /api/admin/buyers
**Test Cases:**
1. **Create new buyer**
   ```json
   {
     "name": "Test Contractor",
     "type": "CONTRACTOR",
     "apiUrl": "https://test.com/leads",
     "contactEmail": "test@test.com"
   }
   ```
   - Expected: 201, buyer created
   - Verify: ID generated, timestamps set, active=true by default

#### GET /api/admin/buyers/[id]
**Test Cases:**
1. **Get buyer with relations**
   - Request: `GET /api/admin/buyers/{homeadvisor-id}`
   - Expected: 200, includes serviceConfigs, serviceZipCodes, _count

2. **Buyer not found**
   - Request: `GET /api/admin/buyers/{non-existent-uuid}`
   - Expected: 404

### Test 2.3: Lead Management APIs

#### GET /api/admin/leads
**Test Cases:**
1. **List all leads**
   - Expected: 200, 20 leads with pagination

2. **Filter by status**
   - Request: `GET /api/admin/leads?status=SOLD`
   - Expected: 200, 10 SOLD leads

3. **Filter by ZIP code**
   - Request: `GET /api/admin/leads?zipCode=90210`
   - Expected: 200, leads from that ZIP

4. **Date range filter**
   - Request: `GET /api/admin/leads?startDate=2025-10-01&endDate=2025-10-31`
   - Expected: 200, leads within range

#### GET /api/admin/leads/[id]
**Test Cases:**
1. **Get lead with full details**
   - Expected: 200, includes transactions, complianceAudits
   - Verify: Transaction history shows PING/POST sequence

---

## Phase 3: Admin UI Testing

### Test 3.1: Buyer List Page (/admin/buyers)

**Manual Test Steps:**
1. Navigate to `/admin/buyers`
2. Wait for page load

**Expected Results:**
- ✓ No loading errors
- ✓ Table displays 5 buyers
- ✓ Shows buyer name, type, contact info
- ✓ Shows counts (services, ZIP codes, leads won)
- ✓ No mock data visible
- ✓ Actions (Edit, Manage ZIPs) are clickable

**Data Validation:**
- Verify buyer names match seed data
- Verify lead counts are accurate
- Check that inactive buyers show properly

### Test 3.2: Buyer ZIP Code Management Page

**Manual Test Steps:**
1. Navigate to `/admin/buyers`
2. Click "Manage ZIP Codes" for HomeAdvisor
3. Wait for page load

**Expected Results:**
- ✓ Statistics cards show real counts
- ✓ Service sections display with ZIP codes
- ✓ Search functionality works
- ✓ Filter by active/inactive works
- ✓ Can add new ZIP codes
- ✓ Can edit priority
- ✓ Can delete ZIP codes
- ✓ Export button works

**Interactive Tests:**
1. **Add ZIP codes**
   - Click "Add Zip Codes"
   - Select service type
   - Enter ZIP codes: 88888, 88889
   - Set priority: 8
   - Submit
   - Verify: ZIPs appear in list
   - Verify: Database contains new records

2. **Edit ZIP priority**
   - Click edit on a ZIP code
   - Change priority from 5 to 9
   - Save
   - Verify: Priority updated in UI and database

3. **Deactivate ZIP**
   - Toggle active switch off
   - Verify: ZIP shows as inactive
   - Verify: Database record has active=false

4. **Delete ZIP**
   - Click delete
   - Confirm deletion
   - Verify: ZIP removed from list and database

5. **Search ZIPs**
   - Enter "902" in search
   - Verify: Only ZIPs starting with 902 shown

### Test 3.3: Leads Page (/admin/leads)

**Manual Test Steps:**
1. Navigate to `/admin/leads`
2. Wait for page load

**Expected Results:**
- ✓ Table displays 20 sample leads
- ✓ Shows service type, ZIP code, status, winning buyer
- ✓ Status badges colored correctly (SOLD=green, PENDING=yellow)
- ✓ Filters work (status, date range)
- ✓ Click lead opens detail view

### Test 3.4: Lead Detail Page

**Manual Test Steps:**
1. From leads page, click a SOLD lead
2. Wait for detail page load

**Expected Results:**
- ✓ Lead information displays completely
- ✓ Compliance data shown (TrustedForm, Jornaya)
- ✓ Transaction history table displays
- ✓ Shows all PING attempts and winning POST
- ✓ Response times displayed
- ✓ Bid amounts shown

### Test 3.5: Analytics Page (/admin/analytics)

**Manual Test Steps:**
1. Navigate to `/admin/analytics`

**Expected Results:**
- ✓ Charts render with real data
- ✓ Statistics calculated from database
- ✓ Conversion rates accurate
- ✓ Average bid amounts correct

### Test 3.6: Service Coverage Page

**Manual Test Steps:**
1. Navigate to `/admin/service-coverage`

**Expected Results:**
- ✓ Shows ZIP coverage by service
- ✓ Map (if present) displays correct ZIPs
- ✓ Coverage statistics accurate

---

## Phase 4: Lead Auction System Testing

### Test 4.1: Lead Processor Worker Verification

**Objective:** Verify worker queries database and respects configurations

**Setup:**
1. Ensure Redis is running
2. Start worker: `npm run worker:dev`
3. In separate terminal, start app: `npm run dev`

#### Scenario 1: Basic Lead Distribution
**Test Steps:**
1. Submit lead via public form:
   - Service: Windows
   - ZIP: 90210 (covered by ABC Windows with priority 9)
   - All required fields
2. Monitor worker logs
3. Check database

**Expected Results:**
- ✓ Worker picks up lead from Redis queue
- ✓ Worker queries BuyerServiceZipCode for matching buyers
- ✓ Only buyers with Windows + 90210 receive PING
- ✓ Highest priority buyer gets preference
- ✓ Transactions logged to database
- ✓ Lead status updated to SOLD
- ✓ Winning buyer and bid recorded

**Database Verification:**
```sql
-- Check transactions for this lead
SELECT
  t.action_type,
  b.name as buyer,
  t.status,
  t.bid_amount,
  t.response_time
FROM transactions t
JOIN buyers b ON b.id = t.buyer_id
WHERE t.lead_id = '{lead-id}'
ORDER BY t.created_at;
```

#### Scenario 2: Geographic Exclusion
**Test Steps:**
1. Submit lead for ZIP 11111 (not covered by any buyer)
2. Monitor worker

**Expected Results:**
- ✓ Worker processes lead
- ✓ No buyers found matching ZIP
- ✓ Lead status updated to REJECTED or UNSOLD
- ✓ No PING transactions created

#### Scenario 3: Multiple Competing Buyers
**Test Steps:**
1. Submit lead for ZIP covered by 3+ buyers (e.g., 90210)
2. All buyers active for Windows service
3. Monitor auction

**Expected Results:**
- ✓ All 3 buyers receive PING simultaneously
- ✓ Transactions show parallel timestamps (< 100ms apart)
- ✓ Buyer with highest bid wins
- ✓ If bids tied, highest priority wins
- ✓ Only winner receives POST

#### Scenario 4: Inactive Buyer Exclusion
**Test Steps:**
1. Deactivate XYZ Windows buyer via admin UI
2. Submit lead for 90210 (Windows)
3. Monitor auction

**Expected Results:**
- ✓ XYZ Windows excluded from auction
- ✓ Other active buyers still receive PING
- ✓ No transaction created for inactive buyer

#### Scenario 5: Service Type Filtering
**Test Steps:**
1. Submit Roofing lead for 90210
2. Monitor auction

**Expected Results:**
- ✓ Only buyers with Roofing service receive PING
- ✓ Windows-only buyers excluded
- ✓ Correct field mappings applied per service

#### Scenario 6: Compliance Requirements
**Test Steps:**
1. Configure buyer to require TrustedForm
2. Submit lead with TrustedForm certificate
3. Submit lead without TrustedForm

**Expected Results:**
- ✓ Lead with certificate: buyer participates
- ✓ Lead without certificate: buyer excluded
- ✓ Transactions show compliance flags

---

## Phase 5: End-to-End Workflows

### E2E Test 1: Complete Buyer Setup to Lead Sale

**Workflow:**
1. Admin creates new buyer "Test Corp"
2. Admin adds Windows service configuration
3. Admin adds 5 ZIP codes (priority 8, minBid $10, maxBid $50)
4. Admin verifies configuration in UI
5. Submit test lead via public form (Windows, one of the ZIPs)
6. Worker processes lead
7. Admin views transaction in dashboard

**Success Criteria:**
- ✓ All steps complete without errors
- ✓ Test Corp receives PING
- ✓ If Test Corp has highest bid, receives POST
- ✓ All data persists correctly
- ✓ No mock data used anywhere

### E2E Test 2: Configuration Changes Reflect Immediately

**Workflow:**
1. Note current buyer configuration
2. Submit lead → verify buyer participates
3. Remove ZIP code from buyer configuration
4. Submit same lead again
5. Verify buyer no longer participates

**Success Criteria:**
- ✓ First lead: buyer receives PING
- ✓ Second lead: buyer excluded (no transaction)
- ✓ Changes apply without restart

### E2E Test 3: Multi-Service Buyer Management

**Workflow:**
1. Single buyer configured for 3 service types
2. Each service has different ZIP codes
3. Submit leads for all 3 services
4. Verify correct targeting

**Success Criteria:**
- ✓ Windows lead → only Windows ZIPs matched
- ✓ Roofing lead → only Roofing ZIPs matched
- ✓ HVAC lead → only HVAC ZIPs matched
- ✓ No cross-service contamination

---

## Phase 6: Data Integrity Tests

### Test 6.1: Cascade Deletes

**Test Steps:**
1. Count buyer's ZIP codes and service configs
2. Delete buyer via API
3. Verify related records deleted

**Expected:**
- ✓ BuyerServiceConfig records deleted
- ✓ BuyerServiceZipCode records deleted
- ✓ Transactions preserved (audit trail)
- ✓ Leads preserved (with null winningBuyerId if applicable)

### Test 6.2: Duplicate Prevention

**Test Steps:**
1. Add ZIP code 90210 for buyer+service
2. Attempt to add 90210 again for same buyer+service
3. Verify rejection

**Expected:**
- ✓ Second attempt returns 409 Conflict
- ✓ Only one record exists in database

### Test 6.3: Foreign Key Validation

**Test Steps:**
1. Attempt to create BuyerServiceZipCode with invalid buyerId
2. Attempt to create with invalid serviceTypeId

**Expected:**
- ✓ Both attempts fail with 400/500 error
- ✓ No orphaned records created

---

## Phase 7: Performance Testing

### Test 7.1: Auction Query Performance

**Test Steps:**
1. Seed database with 1000 ZIP code entries
2. Submit lead
3. Measure query time

**Expected:**
- ✓ Buyer matching query < 50ms
- ✓ Total auction time < 2 seconds

### Test 7.2: Admin UI Loading

**Test Steps:**
1. Navigate to buyer ZIP management with 100 ZIPs
2. Measure page load time

**Expected:**
- ✓ Initial load < 2 seconds
- ✓ Search response < 500ms

---

## Test Execution Checklist

### Pre-Testing
- [ ] Database reset and seeded
- [ ] Redis running
- [ ] App running on port 3000
- [ ] Worker running

### Phase 1: Seed Verification
- [ ] All entities created
- [ ] Counts correct
- [ ] Relationships valid

### Phase 2: API Testing
- [ ] All ZIP code endpoints work
- [ ] All buyer endpoints work
- [ ] All lead endpoints work
- [ ] Error handling correct

### Phase 3: UI Testing
- [ ] Buyer list loads
- [ ] ZIP management works
- [ ] Leads display
- [ ] Analytics show data

### Phase 4: Auction Testing
- [ ] Geographic targeting works
- [ ] Service filtering works
- [ ] Priority respected
- [ ] Inactive buyers excluded

### Phase 5: E2E Testing
- [ ] Complete workflow passes
- [ ] Configuration changes apply
- [ ] Multi-service works

### Phase 6: Data Integrity
- [ ] Cascade deletes work
- [ ] Duplicates prevented
- [ ] Foreign keys validated

### Phase 7: Performance
- [ ] Queries fast enough
- [ ] UI responsive

---

## Bug Tracking

### Issues Found Template
```markdown
**Issue:** [Brief description]
**Severity:** [Critical/High/Medium/Low]
**Steps to Reproduce:**
1.
2.
3.

**Expected:** [What should happen]
**Actual:** [What actually happens]
**Location:** [File/API endpoint]
**Screenshot:** [If applicable]
```

---

## Success Criteria

All tests must pass before spec is considered complete:
- ✅ Zero mock data remaining in codebase
- ✅ All API endpoints return real database data
- ✅ All admin UI pages display real data
- ✅ Seed script creates comprehensive test data
- ✅ Lead auction respects database configurations
- ✅ Geographic targeting works correctly
- ✅ Service filtering works correctly
- ✅ Priority and bid limits enforced
- ✅ All CRUD operations persist to database
- ✅ Cascade deletes work properly
- ✅ Performance meets targets
