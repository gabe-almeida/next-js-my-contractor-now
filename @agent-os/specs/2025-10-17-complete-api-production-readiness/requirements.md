# Requirements: Complete API Production Readiness

## Functional Requirements

### FR-1: Dynamic Route Parameter Handling
**Priority:** Critical
**Status:** Broken

All dynamic route handlers must receive and properly process route parameters.

**Acceptance Criteria:**
- [ ] GET `/api/admin/buyers/[id]` receives `id` parameter
- [ ] PUT `/api/admin/buyers/[id]` receives `id` parameter
- [ ] DELETE `/api/admin/buyers/[id]` receives `id` parameter
- [ ] GET `/api/admin/leads/[id]` receives `id` parameter
- [ ] PUT `/api/admin/leads/[id]` receives `id` parameter
- [ ] All `[id]` routes properly validate UUID format
- [ ] Invalid UUIDs return 400 Bad Request
- [ ] Non-existent IDs return 404 Not Found

---

### FR-2: Service Configuration Management
**Priority:** High
**Status:** Not Implemented

Admin users must be able to manage service configurations for buyers.

**Acceptance Criteria:**
- [ ] List all service configs with filtering by buyerId, serviceTypeId
- [ ] Pagination works (page, limit parameters)
- [ ] Create new service config for buyer+service combination
- [ ] minBid must be less than maxBid
- [ ] Duplicate buyer+service combinations rejected with 409
- [ ] Get single service config by ID
- [ ] Update service config (partial updates supported)
- [ ] Delete service config (cascade protection if ZIP codes exist)
- [ ] All responses include buyer and serviceType relations
- [ ] Redis caching implemented (5 min TTL)
- [ ] Cache invalidation on mutations

---

### FR-3: ZIP Code Management
**Priority:** High
**Status:** Not Implemented

Admin users must be able to manage ZIP code targeting for buyers.

**Acceptance Criteria:**
- [ ] List all ZIP codes with filtering by buyerId, serviceTypeId, zipCode
- [ ] Pagination works (page, limit parameters)
- [ ] Create new ZIP code for buyer+service+zipCode combination
- [ ] ZIP code must be 5 digits
- [ ] Duplicate combinations rejected with 409
- [ ] Get single ZIP code by ID
- [ ] Update ZIP code
- [ ] Delete ZIP code
- [ ] All responses include buyer, serviceType, serviceConfig relations
- [ ] Redis caching implemented (5 min TTL)
- [ ] Cache invalidation on mutations

---

### FR-4: Error Response Consistency
**Priority:** High
**Status:** Partially Implemented

All API error responses must use correct HTTP status codes.

**Acceptance Criteria:**
- [ ] Validation errors return 400 Bad Request
- [ ] Authentication errors return 401 Unauthorized
- [ ] Not found errors return 404 Not Found
- [ ] Duplicate/conflict errors return 409 Conflict
- [ ] Server errors return 500 Internal Server Error
- [ ] All error responses include error code and message
- [ ] Error responses follow standard format:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "field": "fieldName",  // optional
    "data": {}             // optional
  },
  "requestId": "abc123",
  "timestamp": "2025-10-17T..."
}
```

---

### FR-5: E2E Test Coverage
**Priority:** High
**Status:** Partially Complete (41.9%)

Comprehensive E2E tests must validate all API endpoints.

**Acceptance Criteria:**
- [ ] All buyer CRUD operations tested (6/6)
- [ ] All lead operations tested (9/9)
- [ ] All service config operations tested (6/6)
- [ ] All ZIP code operations tested (6/6)
- [ ] Error handling tested (4/4)
- [ ] Data security tested (2/2)
- [ ] 100% of tests passing (31/31)
- [ ] Tests can run multiple times without conflicts
- [ ] Test cleanup works properly

---

## Non-Functional Requirements

### NFR-1: Performance
**Priority:** High

**Requirements:**
- [ ] Cached API responses < 100ms
- [ ] Uncached list queries < 500ms
- [ ] Single resource queries < 300ms
- [ ] Mutations < 1 second
- [ ] Analytics queries < 2 seconds

**Measurement:**
- Add timing to E2E tests
- Log slow queries
- Monitor P95 response times

---

### NFR-2: Security
**Priority:** Critical

**Requirements:**
- [ ] All admin endpoints require authentication
- [ ] API keys validated securely (constant-time comparison)
- [ ] Rate limiting enforced (100 req/min for admin)
- [ ] Input validation on all mutations
- [ ] SQL injection prevented (Prisma parameterized queries)
- [ ] XSS prevented (data sanitization)
- [ ] Sensitive data masked in responses (emails, phones)
- [ ] Credentials never exposed in responses
- [ ] CORS properly configured
- [ ] Security headers present (CSP, X-Frame-Options, etc.)

**Verification:**
- Security audit checklist
- Penetration testing recommendations
- Code review for security issues

---

### NFR-3: Reliability
**Priority:** High

**Requirements:**
- [ ] Database queries use connection pooling
- [ ] Failed transactions roll back properly
- [ ] Circuit breaker for external services (future)
- [ ] Graceful degradation if Redis unavailable
- [ ] Proper error handling (no unhandled exceptions)
- [ ] Request logging for debugging
- [ ] Unique request IDs for tracing

**Verification:**
- Error monitoring setup
- Request ID in all logs
- Test Redis failure scenarios

---

### NFR-4: Maintainability
**Priority:** Medium

**Requirements:**
- [ ] Code follows consistent patterns
- [ ] All routes use same middleware
- [ ] All routes use same response format
- [ ] All routes use same error handling
- [ ] Prisma schema documented
- [ ] API endpoints documented
- [ ] Environment variables documented
- [ ] Deployment process documented

**Verification:**
- Code review
- Documentation completeness check
- Developer onboarding test

---

### NFR-5: Testability
**Priority:** High

**Requirements:**
- [ ] Comprehensive E2E test suite
- [ ] Tests can run in isolation
- [ ] Tests clean up after themselves
- [ ] Test data easily identifiable
- [ ] Mock data generators for tests
- [ ] Test database seeding script
- [ ] Tests run in CI/CD pipeline (future)

**Verification:**
- All tests passing
- Can run tests multiple times
- Test coverage metrics

---

## Data Requirements

### DR-1: Database Schema
**Status:** ✅ Complete

All required Prisma models exist:
- ✅ Buyer
- ✅ BuyerServiceConfig
- ✅ BuyerServiceZipCode
- ✅ ServiceType
- ✅ Lead
- ✅ Transaction
- ✅ ComplianceAuditLog

**Seed Data:**
- ✅ 7 buyers (3 NETWORK, 4 CONTRACTOR)
- ✅ 4 service types
- ✅ 15+ service configs
- ✅ 100+ ZIP codes
- ✅ 20 leads
- ✅ 40 transactions

---

### DR-2: Data Validation Rules

**Buyer:**
- name: required, unique, 1-200 chars
- type: required, enum (CONTRACTOR, NETWORK)
- apiUrl: required, valid URL
- authConfig: required, valid JSON
- pingTimeout: optional, 1-300 seconds
- postTimeout: optional, 1-600 seconds

**BuyerServiceConfig:**
- buyerId: required, valid UUID, must exist
- serviceTypeId: required, valid UUID, must exist
- minBid: required, > 0, < maxBid
- maxBid: required, > minBid
- requiresTrustedForm: boolean
- requiresJornaya: boolean

**BuyerServiceZipCode:**
- buyerId: required, valid UUID, must exist
- serviceTypeId: required, valid UUID, must exist
- zipCode: required, 5 digits
- Unique combination of buyerId + serviceTypeId + zipCode

**Lead:**
- serviceTypeId: required, valid UUID, must exist
- formData: required, valid JSON
- zipCode: required, 5 digits
- ownsHome: required, boolean
- timeframe: required, valid enum
- status: required, valid enum (PENDING, PROCESSING, AUCTIONED, SOLD, REJECTED, EXPIRED)

---

### DR-3: Caching Strategy

**Redis Cache:**
- buyer list: 5 minutes
- buyer detail: 10 minutes
- service config list: 5 minutes
- ZIP code list: 5 minutes
- lead list: 2 minutes (frequently updated)
- lead analytics: 1 hour
- Cache keys: `admin:resource:filters:hash`

**Invalidation:**
- On create: clear list caches
- On update: clear detail and list caches
- On delete: clear detail and list caches
- Pattern deletion: `admin:buyers:*`

---

## Integration Requirements

### IR-1: Prisma ORM
**Status:** ✅ Working

- [x] Prisma client generated
- [x] Database connection pooling
- [x] Query logging enabled (dev)
- [x] Migrations tracked
- [x] Seed script working

---

### IR-2: Redis Cache
**Status:** ✅ Working

- [x] Redis connection established
- [x] Cache utilities implemented
- [x] TTL management
- [x] Pattern deletion support
- [x] Graceful failure (optional)

---

### IR-3: Next.js App Router
**Status:** ⚠️ Partially Working

- [x] Route handlers implemented
- [ ] Dynamic route params working (BROKEN)
- [x] Middleware integration
- [x] TypeScript support
- [x] Error handling

---

## Constraints

### Technical Constraints
- Must use Next.js 14 App Router
- Must use Prisma for database access
- Must use Redis for caching
- Must use SQLite for development database
- Must maintain backward compatibility with existing schema

### Business Constraints
- All endpoints must require authentication
- All mutations must be logged
- No breaking changes to existing working endpoints
- Must support concurrent requests

### Time Constraints
- Target completion: 2-3 days
- Must prioritize fixes for broken functionality
- Documentation can be iterative

---

## Success Criteria

### Phase 1 Success (Fix Dynamic Routes)
- [x] All `[id]` routes receive params
- [ ] 10+ additional tests passing
- [ ] No "Cannot destructure" errors

### Phase 2 Success (Service Configs)
- [ ] All service config CRUD working
- [ ] 6+ additional tests passing
- [ ] Prisma integration verified

### Phase 3 Success (ZIP Codes)
- [ ] All ZIP code CRUD working
- [ ] 6+ additional tests passing
- [ ] Prisma integration verified

### Phase 4 Success (Error Codes)
- [ ] All error responses have correct status codes
- [ ] E2E tests validate status codes
- [ ] No unexpected 500 errors

### Phase 5 Success (Test Cleanup)
- [ ] Tests run multiple times successfully
- [ ] No duplicate data conflicts
- [ ] Cleanup always executes

### Phase 6 Success (Documentation)
- [ ] Production readiness report complete
- [ ] API documentation created
- [ ] Deployment checklist ready
- [ ] Known issues documented

### Overall Success
- [ ] 100% E2E tests passing (31/31)
- [ ] All routes using Prisma (no mock data)
- [ ] Response times meet targets
- [ ] Security measures documented
- [ ] Production deployment ready

---

## Out of Scope

The following are explicitly out of scope for this spec:

- Frontend UI implementation
- User authentication system (only admin API auth)
- Email notifications
- Webhook integrations
- Real-time features (WebSockets)
- Multi-tenancy
- Internationalization
- Mobile apps
- Third-party API integrations
- Automated deployment pipeline
- Load testing
- Backup/restore procedures

These may be addressed in future specs.

---

## Dependencies & Prerequisites

### Prerequisites Met ✅
- Next.js project initialized
- Prisma schema defined
- Database seeded with test data
- Redis running locally
- Core routes (buyers, leads) working
- Middleware implemented
- Authentication working

### External Dependencies
- Node.js 18+
- Redis server
- SQLite (development)
- npm packages (see package.json)

### Internal Dependencies
- Middleware must be fixed before dynamic routes work
- Service configs must exist before ZIP codes can reference them
- Error handling must be consistent across all routes

---

## Risk Assessment

### High Risk ✋
1. **Middleware parameter passing** - Blocks 15+ tests
   - Mitigation: Fix immediately, test thoroughly
2. **Schema mismatches** - Could break queries
   - Mitigation: Verify schema before each query, add type guards

### Medium Risk ⚠️
1. **Test data conflicts** - Makes testing unreliable
   - Mitigation: Use unique names, implement cleanup
2. **Cache inconsistency** - Could show stale data
   - Mitigation: Proper invalidation patterns, short TTLs

### Low Risk ℹ️
1. **Documentation incomplete** - Doesn't block functionality
   - Mitigation: Document iteratively
2. **Performance under load** - Not tested yet
   - Mitigation: Add load testing in future phase

---

## Approval Checklist

Before marking this spec as complete:

- [ ] All 31 E2E tests passing
- [ ] All routes converted to Prisma
- [ ] No mock data remaining
- [ ] Error responses consistent
- [ ] Documentation complete
- [ ] Security audit done
- [ ] Performance validated
- [ ] Code reviewed
- [ ] Deployment ready

---

## Questions & Assumptions

### Questions
1. What PostgreSQL/MySQL migration path? (Currently SQLite)
2. Should we implement rate limiting per user vs global?
3. What monitoring tools should we recommend?
4. Should API documentation be OpenAPI/Swagger format?

### Assumptions
1. SQLite is acceptable for development
2. Admin API authentication is sufficient (no user auth yet)
3. Redis is available in production environment
4. Current schema won't need major changes
5. 100 req/min rate limit is acceptable
6. Email/phone masking in list views is required
7. Test data can be created/deleted freely
