# Comprehensive Test Coverage Specification

**Created:** 2025-10-17
**Status:** Draft
**Priority:** High - Production Blocker

---

## Overview

This specification defines comprehensive test coverage for all untested or mock-only API endpoints and system functionality in the contractor lead generation platform. Currently, only admin APIs have real E2E test coverage (28 tests, 100% passing). This spec addresses critical gaps in public-facing APIs, external integrations, and edge case handling.

## Business Impact

**Current Risk:**
- Public lead submission endpoint (revenue-generating) has no real E2E tests
- Contractor signup flow untested - impacts buyer acquisition
- Service zones (geographic coverage) completely untested
- External buyer integrations mocked - real API failures undetected
- Webhook callbacks untested - impacts buyer satisfaction
- Race conditions and concurrency issues undetected

**Expected Outcomes:**
- 95%+ test coverage across all API endpoints
- Detection of integration failures before production
- Confidence in production deployments
- Reduced bug reports and support tickets
- Improved system reliability and uptime

---

## Testing Categories

### Category 1: Public Lead Submission (CRITICAL)
**Priority:** P0 - Production Blocker
**Endpoint:** `POST /api/leads`

#### Requirements
1. **Basic Lead Submission**
   - Submit valid lead data for each service type (windows, bathrooms, roofing)
   - Verify lead created in database with correct data
   - Verify response includes lead ID and success confirmation
   - Verify timestamp and metadata captured correctly

2. **Service-Specific Validation**
   - Test windows-specific fields (numberOfWindows, windowTypes, etc.)
   - Test bathroom-specific fields (numberOfBathrooms, bathroomType, etc.)
   - Test roofing-specific fields (squareFootage, roofType, etc.)
   - Verify custom validation rules per service type

3. **Compliance Data Capture**
   - TrustedForm certificate URL captured
   - Jornaya Universal LeadID captured
   - TCPA consent timestamp recorded
   - IP address and user agent logged
   - Referrer tracking captured

4. **Auction Trigger Integration**
   - Verify auction automatically triggered on submission
   - Confirm eligible buyers identified
   - Verify ping/post workflow initiated
   - Check transaction records created
   - Validate lead status transitions

5. **Error Handling**
   - Invalid ZIP code format rejection
   - Missing required fields rejection
   - Invalid service type ID rejection
   - Duplicate submission prevention
   - Malformed JSON handling
   - Rate limiting behavior

6. **Data Validation**
   - Email format validation
   - Phone number format validation
   - ZIP code format validation
   - Name field character restrictions
   - Budget/numeric field validation
   - Enum value validation

**Acceptance Criteria:**
- [ ] All service types can submit leads successfully
- [ ] Database records match submission data exactly
- [ ] Compliance data captured for all submissions
- [ ] Auction triggered and completes for valid leads
- [ ] Invalid data properly rejected with clear error messages
- [ ] Response times under 3 seconds for submission
- [ ] No data loss under high load (100 concurrent submissions)

---

### Category 2: Service Zones Admin API
**Priority:** P1 - High
**Endpoints:** Service zones CRUD operations

#### Requirements

1. **GET /api/admin/service-zones - List zones**
   - List all service zones with pagination
   - Filter by service type
   - Filter by state/region
   - Filter by active status
   - Search by ZIP code
   - Sort by priority/name
   - Return buyer mappings count

2. **POST /api/admin/service-zones - Create zone**
   - Create zone with single ZIP code
   - Create zone with ZIP code range
   - Create zone with city/state
   - Validate geographic data
   - Prevent duplicate zones
   - Associate with service types
   - Set priority levels

3. **GET /api/admin/service-zones/[id] - Get zone details**
   - Return complete zone information
   - Include all ZIP codes in zone
   - Include buyer mappings
   - Include coverage statistics
   - Return lead volume data

4. **PUT /api/admin/service-zones/[id] - Update zone**
   - Update ZIP code list
   - Update priority
   - Update active status
   - Modify service type associations
   - Update geographic boundaries
   - Validate no coverage gaps

5. **DELETE /api/admin/service-zones/[id] - Delete zone**
   - Soft delete with confirmation
   - Check for active buyer mappings
   - Prevent deletion if buyers exist
   - Archive historical data
   - Update related records

6. **GET /api/admin/service-zones/analytics - Zone analytics**
   - Coverage percentage by service type
   - Lead volume by zone
   - Buyer density by zone
   - Gap analysis (uncovered ZIPs)
   - Performance metrics

**Acceptance Criteria:**
- [ ] All CRUD operations working correctly
- [ ] Geographic validation prevents invalid zones
- [ ] Duplicate prevention working
- [ ] Analytics provide actionable insights
- [ ] Zone deletion safeguards working
- [ ] Cache invalidation on updates

---

### Category 3: Contractor Signup & Management
**Priority:** P1 - High
**Endpoints:** Contractor onboarding flow

#### Requirements

1. **POST /api/contractors/signup - Contractor registration**
   - Capture business information
   - Collect contact details
   - Validate business email
   - Validate phone number
   - Capture service types offered
   - Define service locations (ZIP codes)
   - Set budget/pricing preferences
   - Accept terms and conditions
   - Create buyer record (type: CONTRACTOR)
   - Send confirmation email
   - Generate API credentials

2. **GET /api/contractors/service-locations - List locations**
   - Return contractor's service areas
   - Include coverage statistics
   - Show lead volume by location
   - Display bid performance
   - Filter by active status

3. **POST /api/contractors/service-locations - Add location**
   - Add new service ZIP code
   - Validate ZIP code format
   - Check for coverage conflicts
   - Set location-specific pricing
   - Set maximum leads per day
   - Define priority levels
   - Activate immediately or schedule

**Validation Requirements:**
- Email uniqueness check
- Phone format validation
- Business name validation
- Service type selection required
- At least one service location required
- Valid pricing range (min/max bid)
- Terms acceptance required

**Acceptance Criteria:**
- [ ] Complete signup flow works end-to-end
- [ ] Buyer record created with CONTRACTOR type
- [ ] Service locations properly configured
- [ ] API credentials generated and secure
- [ ] Confirmation email sent
- [ ] Contractor appears in buyer lists
- [ ] Can participate in auctions immediately
- [ ] Validation prevents invalid signups

---

### Category 4: Service Types Public API
**Priority:** P2 - Medium
**Endpoints:** Public service type queries

#### Requirements

1. **GET /api/service-types - List all service types**
   - Return all active service types
   - Include display names and descriptions
   - Return form schema for each type
   - Include pricing indicators (optional)
   - Exclude inactive service types
   - Cache for performance
   - Support CORS for public access

2. **GET /api/service-types/[id] - Get specific service type**
   - Return complete service type details
   - Include full form schema
   - Include validation rules
   - Return field options/enums
   - Include help text and tooltips
   - Cache for performance

**Acceptance Criteria:**
- [ ] All active service types returned
- [ ] Form schemas complete and valid
- [ ] Response times under 500ms (cached)
- [ ] CORS headers correct for public access
- [ ] Invalid IDs return 404
- [ ] Inactive services excluded from lists

---

### Category 5: Webhook Callbacks
**Priority:** P2 - Medium
**Endpoint:** `POST /api/webhooks/[buyer]`

#### Requirements

1. **Buyer Confirmation Webhooks**
   - Accept lead acceptance confirmation
   - Accept lead rejection notification
   - Verify webhook signature/auth
   - Update lead status
   - Create transaction record
   - Handle duplicate webhooks (idempotency)

2. **Status Update Webhooks**
   - Contact attempted
   - Contact successful
   - Appointment scheduled
   - Job quoted
   - Job closed (won/lost)

3. **Security**
   - Validate buyer authentication
   - Verify webhook signature
   - Rate limiting per buyer
   - Log all webhook attempts
   - Reject malformed payloads

**Acceptance Criteria:**
- [ ] Lead status updates correctly
- [ ] Duplicate webhooks handled gracefully
- [ ] Invalid auth rejected
- [ ] All webhook attempts logged
- [ ] Response times under 1 second
- [ ] Idempotency keys working

---

### Category 6: Location Search API
**Priority:** P2 - Medium
**Endpoint:** `GET /api/locations/search`

#### Requirements

1. **ZIP Code Search**
   - Search by ZIP code (exact match)
   - Return city and state
   - Return coverage status
   - Return available service types
   - Return approximate lead pricing

2. **City/State Search**
   - Search by city name
   - Filter by state
   - Return all ZIP codes in city
   - Return coverage information
   - Fuzzy matching support

3. **Performance**
   - Response under 300ms
   - Cache results aggressively
   - Support autocomplete queries
   - Handle typos gracefully

**Acceptance Criteria:**
- [ ] ZIP code lookups accurate
- [ ] City searches return all relevant ZIPs
- [ ] Coverage data accurate
- [ ] Response times meet target
- [ ] Cache hit rate above 80%

---

### Category 7: Real External Buyer Integration
**Priority:** P1 - High
**Test Type:** Integration Testing

#### Requirements

1. **Test Buyer Server Setup**
   - Create mock buyer API server
   - Implement PING endpoint
   - Implement POST endpoint
   - Support various response scenarios
   - Configurable delays/timeouts
   - Error injection capability

2. **Ping/Post Workflow Testing**
   - Send actual HTTP requests to test server
   - Verify request payload format
   - Verify authentication headers
   - Verify timeout handling (5s ping, 10s post)
   - Test successful ping → post flow
   - Test rejected ping (no post)
   - Test ping timeout behavior
   - Test post timeout behavior
   - Test post retry logic

3. **Authentication Testing**
   - API key authentication
   - Bearer token authentication
   - Basic authentication
   - Custom header authentication
   - Invalid auth rejection

4. **Response Handling**
   - Parse bid amount from response
   - Handle missing bid amount
   - Handle invalid response format
   - Handle HTTP error codes (400, 500, 503)
   - Handle network errors
   - Handle SSL/TLS errors

5. **Transaction Logging**
   - Verify PING transaction logged
   - Verify POST transaction logged
   - Verify request payload saved
   - Verify response payload saved
   - Verify timing metrics captured
   - Verify error details logged

**Acceptance Criteria:**
- [ ] Test buyer server running and reliable
- [ ] All ping/post scenarios tested
- [ ] Timeout handling working correctly
- [ ] Authentication methods all tested
- [ ] Transaction logging complete and accurate
- [ ] Error scenarios handled gracefully
- [ ] No data loss on network failures

---

### Category 8: Redis Caching Behavior
**Priority:** P2 - Medium
**Test Type:** Integration Testing

#### Requirements

1. **Cache Hit Testing**
   - Verify cached responses returned
   - Measure cache hit rate
   - Verify response time improvement
   - Test cache key generation

2. **Cache Invalidation**
   - Verify cache cleared on data updates
   - Test pattern-based deletion
   - Verify granular invalidation
   - Test manual cache clear

3. **TTL Expiration**
   - Verify short TTL items expire (60s)
   - Verify medium TTL items expire (5m)
   - Verify long TTL items expire (1h)
   - Test cache refresh on expiration

4. **Cache Misses**
   - Verify database queried on miss
   - Verify cache populated after miss
   - Test cache warming strategies

**Acceptance Criteria:**
- [ ] Cache hit rate above 70% for read APIs
- [ ] Invalidation working on all updates
- [ ] TTL expiration working correctly
- [ ] No stale data served
- [ ] Cache misses handled gracefully

---

### Category 9: Concurrency & Race Conditions
**Priority:** P1 - High
**Test Type:** Load/Stress Testing

#### Requirements

1. **Concurrent Lead Submissions**
   - Submit 100 leads simultaneously
   - Verify all leads processed
   - Verify no data corruption
   - Verify no duplicate lead IDs
   - Check database locking
   - Monitor response times

2. **Concurrent Buyer Updates**
   - Update same buyer from 10 threads
   - Verify final state consistent
   - Verify no lost updates
   - Test optimistic locking

3. **Simultaneous Auction Runs**
   - Trigger auctions for multiple leads
   - Verify each auction independent
   - Verify transaction isolation
   - Check for deadlocks
   - Monitor resource usage

4. **Database Connection Pool**
   - Test pool exhaustion handling
   - Verify connection reuse
   - Test connection timeout
   - Monitor active connections

**Acceptance Criteria:**
- [ ] 100 concurrent submissions succeed
- [ ] No data corruption under load
- [ ] No duplicate records created
- [ ] Response times degrade gracefully
- [ ] Database connections managed properly
- [ ] No deadlocks or race conditions detected

---

### Category 10: Edge Cases & Security
**Priority:** P2 - Medium
**Test Type:** Security/Validation Testing

#### Requirements

1. **Input Validation**
   - Extremely long strings (10,000+ chars)
   - Unicode and emoji characters
   - Special characters (<>&"'/)
   - SQL injection attempts
   - XSS payloads in form data
   - Null bytes and control characters
   - Invalid UTF-8 sequences

2. **Boundary Testing**
   - Minimum field lengths
   - Maximum field lengths
   - Numeric boundaries (Int32, Int64)
   - Date ranges (past, future, invalid)
   - ZIP code edge cases (00000, 99999)
   - Email edge cases

3. **Error Handling**
   - Database connection failures
   - Redis connection failures
   - External API failures
   - Disk space exhaustion
   - Memory exhaustion
   - Timeout scenarios

4. **Authentication & Authorization**
   - Missing auth token
   - Expired auth token
   - Invalid auth token
   - Insufficient permissions
   - CORS policy enforcement
   - Rate limiting enforcement

**Acceptance Criteria:**
- [ ] All injection attempts blocked
- [ ] Boundary values handled correctly
- [ ] Error messages don't leak sensitive info
- [ ] System degrades gracefully under failure
- [ ] Auth properly enforced on all endpoints
- [ ] Rate limiting working correctly

---

## Test Infrastructure Requirements

### Test Environment Setup
1. **Isolated Test Database**
   - SQLite test database
   - Automatic schema migration
   - Pre-seeded test data
   - Cleanup between test runs

2. **Test Redis Instance**
   - Local Redis for tests
   - Isolated keyspace
   - Automatic flush between runs

3. **Mock Buyer Server**
   - Express.js test server
   - Configurable responses
   - Request logging
   - Delay/timeout simulation
   - Error injection

4. **Test Data Factory**
   - Generate valid test leads
   - Generate test buyers
   - Generate test service configs
   - Unique data per test run
   - Realistic data patterns

### Testing Tools & Frameworks
- **Jest** - Test runner and assertions
- **Supertest** - HTTP request testing
- **Node-fetch** - External API calls
- **Faker.js** - Test data generation
- **Redis-mock** - Redis testing
- **MSW** - API mocking (where needed)

---

## Implementation Approach

### Phase 1: Critical Public APIs (Week 1)
1. Lead submission E2E tests (Category 1)
2. Service types public API tests (Category 4)
3. Basic edge case coverage (Category 10 - subset)

**Deliverable:** Public-facing APIs fully tested

### Phase 2: Admin & Management (Week 2)
1. Service zones CRUD tests (Category 2)
2. Contractor signup tests (Category 3)
3. Location search tests (Category 6)

**Deliverable:** Admin functionality fully tested

### Phase 3: External Integrations (Week 3)
1. Mock buyer server setup (Category 7)
2. Real ping/post integration tests (Category 7)
3. Webhook callback tests (Category 5)
4. Redis caching tests (Category 8)

**Deliverable:** External integrations verified

### Phase 4: Performance & Security (Week 4)
1. Concurrency testing (Category 9)
2. Full edge case coverage (Category 10)
3. Load testing
4. Security hardening

**Deliverable:** Production-ready system

---

## Success Metrics

### Coverage Targets
- **API Endpoint Coverage:** 95%+ (all endpoints tested)
- **Code Coverage:** 80%+ (Jest coverage report)
- **Integration Coverage:** 100% (all external integrations)
- **Edge Case Coverage:** 90%+ (all identified edge cases)

### Quality Targets
- **Test Success Rate:** 100% passing
- **Test Reliability:** <1% flaky tests
- **Test Performance:** Complete suite under 5 minutes
- **Test Maintainability:** Self-documenting, easy to update

### Production Impact
- **Bug Detection:** Catch 90%+ of bugs before production
- **Deployment Confidence:** Zero-downtime deployments
- **Mean Time to Recovery:** Reduce by 50%
- **Support Tickets:** Reduce by 30%

---

## Technical Considerations

### Database Testing
- Use transactions with rollback for isolation
- Pre-seed required reference data
- Use timestamp-based unique identifiers
- Clean up test data after each run

### API Testing
- Test both success and failure paths
- Verify response schemas
- Check response times
- Validate error messages
- Test with realistic data volumes

### Integration Testing
- Use real HTTP calls (not mocks where possible)
- Test timeout scenarios
- Test retry logic
- Verify transaction logging
- Monitor resource usage

### Performance Testing
- Use realistic data volumes
- Test under concurrent load
- Monitor memory and CPU
- Check database query performance
- Verify caching effectiveness

---

## Risk Assessment

### High Risk Areas
1. **Lead Submission** - Revenue-critical, high traffic
2. **External Buyer APIs** - Third-party dependencies
3. **Race Conditions** - Data integrity risks
4. **Security Vulnerabilities** - Regulatory compliance

### Mitigation Strategies
1. Prioritize high-risk area testing first
2. Implement comprehensive error handling
3. Add monitoring and alerting
4. Regular security audits
5. Load testing before major releases

---

## Dependencies

### Required Before Testing
- [ ] Test database setup
- [ ] Test Redis instance
- [ ] Test data factory
- [ ] Mock buyer server
- [ ] CI/CD integration

### External Dependencies
- Jest test framework
- Supertest for HTTP testing
- Faker.js for test data
- Redis testing tools

---

## Acceptance Criteria (Overall)

- [ ] All 10 test categories implemented
- [ ] Test suite passes 100%
- [ ] Coverage targets met (95% API, 80% code)
- [ ] CI/CD integration complete
- [ ] Documentation complete
- [ ] Team trained on running tests
- [ ] Production deployment checklist includes tests
- [ ] Monitoring and alerting configured

---

## Next Steps

1. **Review and Approve Spec** - Stakeholder sign-off
2. **Create Detailed Tasks** - Break down into tickets
3. **Setup Test Infrastructure** - Environment preparation
4. **Begin Phase 1 Implementation** - Start with critical tests
5. **Iterative Review** - Weekly progress reviews
6. **Production Deployment** - After 100% test pass rate

---

## Appendix A: Test File Structure

```
tests/
├── e2e/
│   ├── lead-submission.test.ts          # Category 1
│   ├── service-zones-crud.test.ts       # Category 2
│   ├── contractor-signup.test.ts        # Category 3
│   ├── service-types-public.test.ts     # Category 4
│   ├── webhook-callbacks.test.ts        # Category 5
│   ├── location-search.test.ts          # Category 6
│   └── external-buyer-integration.test.ts # Category 7
│
├── integration/
│   ├── redis-caching.test.ts            # Category 8
│   ├── concurrency.test.ts              # Category 9
│   └── auction-real-buyers.test.ts      # Category 7
│
├── security/
│   ├── input-validation.test.ts         # Category 10
│   ├── injection-prevention.test.ts     # Category 10
│   └── auth-enforcement.test.ts         # Category 10
│
├── load/
│   ├── concurrent-submissions.test.ts   # Category 9
│   └── database-performance.test.ts     # Category 9
│
└── fixtures/
    ├── mock-buyer-server.ts             # Test server
    ├── test-data-factory.ts             # Data generation
    └── test-helpers.ts                  # Utilities
```

---

## Appendix B: Sample Test Output

```bash
Test Suites: 15 passed, 15 total
Tests:       247 passed, 247 total
Snapshots:   0 total
Time:        4.23s
Coverage:    82.4%

API Endpoint Coverage:
✅ POST /api/leads                              20 tests
✅ GET /api/service-types                       5 tests
✅ GET /api/service-types/[id]                  6 tests
✅ GET /api/admin/service-zones                 8 tests
✅ POST /api/admin/service-zones                12 tests
✅ GET /api/admin/service-zones/[id]            7 tests
✅ PUT /api/admin/service-zones/[id]            10 tests
✅ DELETE /api/admin/service-zones/[id]         6 tests
✅ GET /api/admin/service-zones/analytics       9 tests
✅ POST /api/contractors/signup                 15 tests
✅ GET /api/contractors/service-locations       6 tests
✅ POST /api/contractors/service-locations      8 tests
✅ POST /api/webhooks/[buyer]                   12 tests
✅ GET /api/locations/search                    8 tests
✅ External Buyer Integration                   25 tests
✅ Redis Caching                                15 tests
✅ Concurrency & Race Conditions                18 tests
✅ Security & Edge Cases                        32 tests
✅ Existing Admin APIs (from previous)          28 tests

Total: 247 tests across all categories
Success Rate: 100%
Production Ready: YES ✅
```
