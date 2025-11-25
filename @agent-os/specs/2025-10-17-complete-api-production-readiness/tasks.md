# Tasks: Complete API Production Readiness

## Phase 1: Fix Dynamic Route Parameters ⚡ Priority

### Task 1.1: Investigate Middleware Parameter Handling
- [ ] Read Next.js App Router documentation on route parameters
- [ ] Check how middleware wraps route handlers
- [ ] Identify where params object is lost
- [ ] Document the fix approach

**Files:**
- `src/lib/middleware.ts`

**Estimated:** 15 minutes

---

### Task 1.2: Update Middleware to Pass Params
- [ ] Modify `withMiddleware` to accept params in handler signature
- [ ] Update middleware to pass params as second argument
- [ ] Test with a simple route first
- [ ] Verify params are correctly passed through

**Files:**
- `src/lib/middleware.ts`

**Changes:**
```typescript
// Before
export function withMiddleware(
  handler: (req: EnhancedRequest) => Promise<NextResponse>,
  options: MiddlewareOptions = {}
)

// After
export function withMiddleware(
  handler: (req: EnhancedRequest, context?: any) => Promise<NextResponse>,
  options: MiddlewareOptions = {}
) {
  return async (req: NextRequest, context?: any): Promise<NextResponse> => {
    // ...
    const response = await handler(enhancedReq, context);
    // ...
  }
}
```

**Estimated:** 30 minutes

---

### Task 1.3: Update withValidation Wrapper
- [ ] Modify `withValidation` to pass params
- [ ] Ensure params work with validation layer
- [ ] Test with POST/PUT requests

**Files:**
- `src/lib/middleware.ts`

**Estimated:** 15 minutes

---

### Task 1.4: Test All Dynamic Buyer Routes
- [ ] Test GET `/api/admin/buyers/[id]`
- [ ] Test PUT `/api/admin/buyers/[id]`
- [ ] Test DELETE `/api/admin/buyers/[id]`
- [ ] Verify error handling for invalid UUIDs
- [ ] Verify 404 for non-existent resources

**Estimated:** 20 minutes

---

### Task 1.5: Test All Dynamic Lead Routes
- [ ] Test GET `/api/admin/leads/[id]`
- [ ] Test PUT `/api/admin/leads/[id]`
- [ ] Verify status transition validation
- [ ] Verify compliance audit creation

**Estimated:** 15 minutes

---

## Phase 2: Convert Service Configuration Routes 🔧

### Task 2.1: Analyze Current Service Config Routes
- [ ] Read `/api/admin/buyers/service-configs/route.ts`
- [ ] Read `/api/admin/buyers/service-configs/[id]/route.ts`
- [ ] Document mock data structure
- [ ] Identify all features to preserve

**Estimated:** 15 minutes

---

### Task 2.2: Convert GET Service Configs List
- [ ] Replace mock data with Prisma query
- [ ] Implement buyerId filter
- [ ] Implement serviceTypeId filter
- [ ] Add pagination (page, limit)
- [ ] Include relations (buyer, serviceType)
- [ ] Add Redis caching
- [ ] Test with various filters

**Files:**
- `src/app/api/admin/buyers/service-configs/route.ts`

**Prisma Query:**
```typescript
const configs = await prisma.buyerServiceConfig.findMany({
  where: {
    ...(buyerId && { buyerId }),
    ...(serviceTypeId && { serviceTypeId })
  },
  include: {
    buyer: { select: { id: true, name: true } },
    serviceType: { select: { id: true, name: true, displayName: true } }
  },
  orderBy: { createdAt: 'desc' },
  skip: (page - 1) * limit,
  take: limit
});
```

**Estimated:** 45 minutes

---

### Task 2.3: Convert POST Create Service Config
- [ ] Replace mock creation with Prisma create
- [ ] Validate buyerId exists
- [ ] Validate serviceTypeId exists
- [ ] Validate minBid < maxBid
- [ ] Check for duplicate buyer+service combination
- [ ] Clear Redis cache on creation
- [ ] Test creation with valid data
- [ ] Test validation errors

**Files:**
- `src/app/api/admin/buyers/service-configs/route.ts`

**Estimated:** 45 minutes

---

### Task 2.4: Convert GET Single Service Config
- [ ] Replace cache lookup with Prisma findUnique
- [ ] Include all relations
- [ ] Handle 404 for not found
- [ ] Return full config details

**Files:**
- `src/app/api/admin/buyers/service-configs/[id]/route.ts`

**Estimated:** 20 minutes

---

### Task 2.5: Convert PUT Update Service Config
- [ ] Replace mock update with Prisma update
- [ ] Validate partial updates
- [ ] Validate minBid < maxBid if either changes
- [ ] Clear Redis cache on update
- [ ] Test various update scenarios

**Files:**
- `src/app/api/admin/buyers/service-configs/[id]/route.ts`

**Estimated:** 30 minutes

---

### Task 2.6: Convert DELETE Service Config
- [ ] Check for associated ZIP codes
- [ ] Prevent deletion if ZIP codes exist
- [ ] Delete from database
- [ ] Clear Redis cache
- [ ] Test cascade protection

**Files:**
- `src/app/api/admin/buyers/service-configs/[id]/route.ts`

**Estimated:** 30 minutes

---

### Task 2.7: Create Service Config Test Script
- [ ] Create `scripts/test-service-config-prisma.ts`
- [ ] Test list with filters
- [ ] Test create
- [ ] Test update
- [ ] Test delete
- [ ] Test validation errors
- [ ] Run and verify all tests pass

**Estimated:** 30 minutes

---

## Phase 3: Convert ZIP Code Routes 📍

### Task 3.1: Analyze Current ZIP Code Routes
- [ ] Read `/api/admin/buyers/service-zip-codes/route.ts`
- [ ] Read `/api/admin/buyers/service-zip-codes/[id]/route.ts`
- [ ] Document mock data structure
- [ ] Identify all features to preserve

**Estimated:** 15 minutes

---

### Task 3.2: Convert GET ZIP Codes List
- [ ] Replace mock data with Prisma query
- [ ] Implement buyerId filter
- [ ] Implement serviceTypeId filter
- [ ] Implement zipCode search filter
- [ ] Add pagination
- [ ] Include relations (buyer, serviceType, serviceConfig)
- [ ] Add Redis caching
- [ ] Test with various filters

**Files:**
- `src/app/api/admin/buyers/service-zip-codes/route.ts`

**Prisma Query:**
```typescript
const zipCodes = await prisma.buyerServiceZipCode.findMany({
  where: {
    ...(buyerId && { buyerId }),
    ...(serviceTypeId && { serviceTypeId }),
    ...(zipCode && { zipCode: { contains: zipCode } })
  },
  include: {
    buyer: { select: { id: true, name: true } },
    serviceType: { select: { id: true, name: true, displayName: true } },
    serviceConfig: { select: { id: true, minBid: true, maxBid: true } }
  },
  orderBy: { zipCode: 'asc' },
  skip: (page - 1) * limit,
  take: limit
});
```

**Estimated:** 45 minutes

---

### Task 3.3: Convert POST Create ZIP Code
- [ ] Replace mock creation with Prisma create
- [ ] Validate buyerId exists
- [ ] Validate serviceTypeId exists
- [ ] Validate zipCode format (5 digits)
- [ ] Check for duplicate buyer+service+zipCode
- [ ] Link to serviceConfig if exists
- [ ] Clear Redis cache on creation
- [ ] Test creation
- [ ] Test duplicate prevention

**Files:**
- `src/app/api/admin/buyers/service-zip-codes/route.ts`

**Estimated:** 45 minutes

---

### Task 3.4: Convert GET Single ZIP Code
- [ ] Replace cache lookup with Prisma findUnique
- [ ] Include all relations
- [ ] Handle 404 for not found
- [ ] Return full ZIP code details

**Files:**
- `src/app/api/admin/buyers/service-zip-codes/[id]/route.ts`

**Estimated:** 20 minutes

---

### Task 3.5: Convert PUT Update ZIP Code
- [ ] Replace mock update with Prisma update
- [ ] Validate zipCode format if changing
- [ ] Prevent duplicate combinations
- [ ] Clear Redis cache on update
- [ ] Test updates

**Files:**
- `src/app/api/admin/buyers/service-zip-codes/[id]/route.ts`

**Estimated:** 30 minutes

---

### Task 3.6: Convert DELETE ZIP Code
- [ ] Delete from database
- [ ] Clear Redis cache
- [ ] Test deletion

**Files:**
- `src/app/api/admin/buyers/service-zip-codes/[id]/route.ts`

**Estimated:** 20 minutes

---

### Task 3.7: Create ZIP Code Test Script
- [ ] Create `scripts/test-zip-code-prisma.ts`
- [ ] Test list with various filters
- [ ] Test create
- [ ] Test update
- [ ] Test delete
- [ ] Test validation errors
- [ ] Run and verify all tests pass

**Estimated:** 30 minutes

---

## Phase 4: Fix Error Response Status Codes 🚨

### Task 4.1: Audit All Error Responses
- [ ] List all error responses in buyer routes
- [ ] List all error responses in lead routes
- [ ] List all error responses in middleware
- [ ] Document expected status codes

**Estimated:** 20 minutes

---

### Task 4.2: Update Middleware Error Handling
- [ ] Use `getHttpStatusFromError` for error responses
- [ ] Ensure NextResponse.json gets correct status
- [ ] Test validation errors (400)
- [ ] Test auth errors (401)
- [ ] Test not found errors (404)
- [ ] Test conflict errors (409)

**Files:**
- `src/lib/middleware.ts`

**Changes:**
```typescript
const response = errorResponse(code, message, data, field, requestId);
const status = getHttpStatusFromError(code);
return NextResponse.json(response, { status });
```

**Estimated:** 30 minutes

---

### Task 4.3: Update All Route Error Responses
- [ ] Update buyer routes to use proper status codes
- [ ] Update lead routes to use proper status codes
- [ ] Update service config routes
- [ ] Update ZIP code routes
- [ ] Test each error scenario

**Estimated:** 45 minutes

---

## Phase 5: Handle Test Data Cleanup 🧹

### Task 5.1: Add Test Data Uniqueness
- [ ] Add timestamp to test buyer name
- [ ] Use unique identifiers for test data
- [ ] Update E2E test to use unique names

**Files:**
- `scripts/e2e-api-test.ts`

**Changes:**
```typescript
const timestamp = Date.now();
const testBuyer = {
  name: `E2E Test Contractor ${timestamp}`,
  // ...
};
```

**Estimated:** 15 minutes

---

### Task 5.2: Add Pre-Test Cleanup
- [ ] Query for existing test data at start
- [ ] Delete any found test data
- [ ] Verify clean state before tests

**Files:**
- `scripts/e2e-api-test.ts`

**Estimated:** 20 minutes

---

### Task 5.3: Improve Cleanup Error Handling
- [ ] Wrap cleanup in try-catch
- [ ] Log cleanup failures
- [ ] Continue test execution even if cleanup fails
- [ ] Ensure cleanup runs in finally block

**Files:**
- `scripts/e2e-api-test.ts`

**Estimated:** 15 minutes

---

### Task 5.4: Test Multiple Consecutive Runs
- [ ] Run E2E tests 3 times in a row
- [ ] Verify no conflicts
- [ ] Verify cleanup works
- [ ] Fix any issues found

**Estimated:** 15 minutes

---

## Phase 6: Create Production Readiness Report 📊

### Task 6.1: Create API Endpoint Inventory
- [ ] List all API endpoints
- [ ] Mark status for each (✅/⚠️/❌)
- [ ] Document HTTP methods
- [ ] Document authentication requirements
- [ ] Document rate limits

**Files:**
- `@agent-os/specs/2025-10-17-complete-api-production-readiness/production-readiness-report.md`

**Estimated:** 30 minutes

---

### Task 6.2: Document Prisma Models Integration
- [ ] List all Prisma models
- [ ] Mark which have full CRUD
- [ ] Mark which have read-only access
- [ ] Document relations coverage

**Estimated:** 20 minutes

---

### Task 6.3: Document Testing Coverage
- [ ] List Prisma direct tests
- [ ] List E2E API tests
- [ ] Calculate coverage percentage
- [ ] Identify gaps

**Estimated:** 20 minutes

---

### Task 6.4: Create API Documentation
- [ ] Document each working endpoint
- [ ] Include request examples
- [ ] Include response examples
- [ ] Document error responses
- [ ] Include authentication examples

**Estimated:** 45 minutes

---

### Task 6.5: Document Security Measures
- [ ] Document authentication mechanism
- [ ] Document rate limiting strategy
- [ ] Document input validation
- [ ] Document data masking
- [ ] Document CORS configuration
- [ ] List security headers

**Estimated:** 30 minutes

---

### Task 6.6: Document Caching Strategy
- [ ] Explain Redis caching
- [ ] Document cache keys
- [ ] Document TTLs
- [ ] Document cache invalidation

**Estimated:** 20 minutes

---

### Task 6.7: Create Deployment Checklist
- [ ] Environment variables needed
- [ ] Database migrations
- [ ] Redis requirements
- [ ] Health check endpoints
- [ ] Monitoring recommendations

**Estimated:** 20 minutes

---

### Task 6.8: Document Known Issues
- [ ] List any remaining bugs
- [ ] List performance concerns
- [ ] List missing features
- [ ] Prioritize each issue

**Estimated:** 15 minutes

---

### Task 6.9: Create Recommendations
- [ ] Suggest monitoring tools
- [ ] Suggest logging improvements
- [ ] Suggest performance optimizations
- [ ] Suggest additional tests

**Estimated:** 20 minutes

---

### Task 6.10: Compile Final Report
- [ ] Combine all sections
- [ ] Add executive summary
- [ ] Add metrics and charts
- [ ] Add deployment guide
- [ ] Review and polish

**Estimated:** 30 minutes

---

## Summary

**Total Tasks:** 54
**Total Estimated Time:** 12.5 hours

**By Phase:**
- Phase 1: 1.75 hours (6 tasks)
- Phase 2: 4 hours (7 tasks)
- Phase 3: 3.5 hours (7 tasks)
- Phase 4: 1.75 hours (3 tasks)
- Phase 5: 1 hour (4 tasks)
- Phase 6: 3.5 hours (10 tasks)

**Priority Order:**
1. Phase 1 (Fix Dynamic Routes) - Blocks everything else
2. Phase 4 (Error Status Codes) - Quick wins
3. Phase 5 (Test Cleanup) - Improves testing
4. Phase 2 (Service Configs) - Feature completion
5. Phase 3 (ZIP Codes) - Feature completion
6. Phase 6 (Documentation) - Polish

**Quick Wins (< 30 min each):**
- Task 1.1, 1.3, 1.4, 1.5 (Testing)
- Task 2.1, 2.4 (Service Config read)
- Task 3.1, 3.4 (ZIP Code read)
- Task 5.1, 5.2, 5.3 (Cleanup)

**High Impact:**
- Task 1.2 (Middleware fix) - Unblocks 15+ tests
- Task 2.2, 2.3 (Service Config CRUD) - Core feature
- Task 3.2, 3.3 (ZIP Code CRUD) - Core feature
