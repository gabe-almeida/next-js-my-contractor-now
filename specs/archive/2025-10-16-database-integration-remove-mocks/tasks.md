# Spec Tasks

## Tasks

- [ ] 1. Create Comprehensive Database Seed Script
  - [ ] 1.1 Create seed script structure in `prisma/seed.ts` with proper imports and error handling
  - [ ] 1.2 Implement service types seed data (4 service types: Windows, Bathrooms, Roofing, HVAC)
  - [ ] 1.3 Implement buyers seed data (5 buyers: HomeAdvisor, Modernize, ABC Roofing, XYZ Windows, Angi)
  - [ ] 1.4 Implement ZIP code metadata seed (100+ major US city ZIP codes)
  - [ ] 1.5 Implement buyer service configs seed (20 configs: 5 buyers × 4 services)
  - [ ] 1.6 Implement buyer service ZIP codes seed (50-100 entries with realistic geographic distribution)
  - [ ] 1.7 Implement sample leads seed (20 leads: 10 SOLD, 5 PROCESSING, 5 PENDING)
  - [ ] 1.8 Implement transactions and compliance audit logs seed (30+ transactions with PING/POST history)
  - [ ] 1.9 Run seed script and verify all data created correctly in Prisma Studio

- [ ] 2. Convert Buyer ZIP Code Management API Routes (Priority 1)
  - [ ] 2.1 Write integration tests for `/api/admin/buyers/[id]/zip-codes` endpoints
  - [ ] 2.2 Replace mock data in GET endpoint with Prisma query (group by service type)
  - [ ] 2.3 Replace mock data in POST endpoint with Prisma create (validate duplicates)
  - [ ] 2.4 Replace mock data in PUT endpoint with Prisma updateMany (bulk operations)
  - [ ] 2.5 Replace mock data in DELETE endpoint with Prisma deleteMany
  - [ ] 2.6 Add proper error handling for all Prisma errors (P2002, P2025, connection errors)
  - [ ] 2.7 Test all CRUD operations with real database and verify results
  - [ ] 2.8 Verify all integration tests pass

- [ ] 3. Convert Buyer Management API Routes (Priority 1)
  - [ ] 3.1 Write integration tests for buyer CRUD endpoints
  - [ ] 3.2 Replace mock data in `GET /api/admin/buyers` with Prisma query (pagination, filters, counts)
  - [ ] 3.3 Replace mock data in `POST /api/admin/buyers` with Prisma create
  - [ ] 3.4 Replace mock data in `GET /api/admin/buyers/[id]` with Prisma findUnique (include relations)
  - [ ] 3.5 Replace mock data in `PUT /api/admin/buyers/[id]` with Prisma update
  - [ ] 3.6 Replace mock data in `DELETE /api/admin/buyers/[id]` with Prisma delete (test cascade)
  - [ ] 3.7 Test all endpoints with real data and verify relationships load correctly
  - [ ] 3.8 Verify all integration tests pass

- [ ] 4. Convert Lead Management API Routes (Priority 2)
  - [ ] 4.1 Write integration tests for lead endpoints
  - [ ] 4.2 Replace mock data in `GET /api/admin/leads` with Prisma query (filters, pagination)
  - [ ] 4.3 Replace mock data in `GET /api/admin/leads/[id]` with Prisma findUnique (full relations)
  - [ ] 4.4 Test lead queries with various filters (status, date range, ZIP code)
  - [ ] 4.5 Verify transaction history and compliance data loads correctly
  - [ ] 4.6 Verify all integration tests pass

- [ ] 5. Convert Service Type and Analytics API Routes (Priority 2)
  - [ ] 5.1 Write tests for service type and analytics endpoints
  - [ ] 5.2 Replace mock data in `GET /api/service-types/[id]` with Prisma query
  - [ ] 5.3 Replace mock data in `/api/admin/service-zones/analytics` with aggregated queries
  - [ ] 5.4 Replace mock data in `/api/admin/test-payloads` with real service type queries
  - [ ] 5.5 Test analytics calculations with real data
  - [ ] 5.6 Verify all tests pass

- [ ] 6. Convert Admin UI Pages to Use Real API Data
  - [ ] 6.1 Remove mock data from `/admin/buyers/page.tsx` - fetch from API
  - [ ] 6.2 Remove mock data from `/admin/buyers/[id]/zip-codes/page.tsx` - fetch buyer and services from API
  - [ ] 6.3 Remove mock data from `/admin/leads/page.tsx` - fetch from API with filters
  - [ ] 6.4 Remove mock data from `/admin/services/page.tsx` - fetch from API
  - [ ] 6.5 Remove mock data from `/admin/transactions/page.tsx` - fetch from API
  - [ ] 6.6 Remove mock data from `/admin/analytics/page.tsx` - use real statistics
  - [ ] 6.7 Remove mock data from `/admin/service-coverage/page.tsx` - fetch real coverage data
  - [ ] 6.8 Remove mock data from `/admin/page.tsx` dashboard - use real metrics
  - [ ] 6.9 Check `/admin/layout.tsx` and remove any mock navigation data
  - [ ] 6.10 Manually test all admin pages load correctly with real data

- [ ] 7. Verify Lead Processor Worker Database Integration
  - [ ] 7.1 Review `src/workers/lead-processor.ts` for database queries
  - [ ] 7.2 Verify worker queries `BuyerServiceZipCode` for buyer matching
  - [ ] 7.3 Verify geographic (ZIP code) filtering works correctly
  - [ ] 7.4 Verify service type matching works correctly
  - [ ] 7.5 Verify priority sorting is applied
  - [ ] 7.6 Verify bid limits are enforced
  - [ ] 7.7 Verify all transactions are logged to database
  - [ ] 7.8 Test worker with sample lead and verify auction respects database config

- [ ] 8. Execute Comprehensive End-to-End Testing
  - [ ] 8.1 Reset database and run seed script
  - [ ] 8.2 Test E2E Scenario 1: Create buyer → Add service → Configure ZIPs → Submit lead → Verify auction
  - [ ] 8.3 Test E2E Scenario 2: Update buyer ZIPs → Submit lead → Verify targeting changes
  - [ ] 8.4 Test E2E Scenario 3: Deactivate buyer → Submit lead → Verify excluded from auction
  - [ ] 8.5 Test E2E Scenario 4: Multiple buyers same ZIP → Submit lead → Verify highest bidder wins
  - [ ] 8.6 Test E2E Scenario 5: Buyer outside ZIP → Submit lead → Verify not contacted
  - [ ] 8.7 Test all admin UI CRUD operations (add/edit/delete buyers and ZIPs)
  - [ ] 8.8 Verify all transactions logged to database with accurate audit trail
  - [ ] 8.9 Run performance tests (auction query < 50ms, UI load < 2s)
  - [ ] 8.10 Search codebase for remaining "mock" references and confirm zero found
  - [ ] 8.11 Final validation: All 17 files converted, all tests pass, no mock data remaining

## Implementation Notes

### Task Dependencies
- Task 1 must complete first (seed data needed for all testing)
- Tasks 2-5 (API conversions) can be done in sequence
- Task 6 (UI) depends on Tasks 2-5 completing
- Task 7 (worker verification) depends on Tasks 2-3
- Task 8 (E2E testing) requires all previous tasks complete

### Testing Strategy
- Use real database for all tests (no mocking)
- Integration tests validate API responses
- Manual tests validate UI behavior
- E2E tests validate complete workflows

### Success Criteria
- ✅ All 17 files converted from mock to real data
- ✅ Seed script creates comprehensive test data
- ✅ All API endpoints return real database records
- ✅ All admin UI pages display real data
- ✅ Lead auction system respects database configurations
- ✅ All E2E scenarios pass
- ✅ No "mock" references remain in codebase
