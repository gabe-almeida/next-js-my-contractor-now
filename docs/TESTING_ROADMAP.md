# Testing Roadmap - Production Readiness

**Date:** 2025-10-20
**Current Test Coverage:** ~0% (only 50 unit tests for mock query fixes)
**Target Coverage:** 90%+ for critical paths
**Estimated Effort:** 80-120 hours (10-15 business days)

---

## Executive Summary

### Critical Findings

**🔴 BLOCKING PRODUCTION:**
1. **NO webhook signature verification** - Any attacker can send fake bids
2. **Float arithmetic for money** - Precision errors in billing
3. **No database transactions** - Leads can be created without queue entries
4. **No input sanitization** - SQL injection possible
5. **No test coverage** - System behavior unverified

**🟡 HIGH RISK:**
6. Credentials stored as plain JSON in database
7. No rate limiting on lead submission
8. Missing audit logging for admin actions
9. Complex business logic untested (auction, eligibility)
10. External API failures not handled gracefully

---

## Phase 1: CRITICAL - MUST FIX BEFORE PRODUCTION (Week 1-2)

### 1.1 Security Fixes + Tests (HIGH PRIORITY)

#### Webhook Signature Verification
**Status:** ❌ NOT IMPLEMENTED
**Priority:** CRITICAL
**Effort:** 8 hours

**Implementation:**
```typescript
// Add to buyer configuration
interface BuyerConfig {
  webhookSecret: string; // HMAC-SHA256 secret
}

// Add signature verification
function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const expectedSignature = hmac.digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

**Tests Needed:**
- Valid signature passes verification
- Invalid signature fails verification
- Missing signature rejected
- Replay attack prevention (timestamp validation)
- Signature with wrong secret fails

---

#### Authentication & Authorization Testing
**File:** `/src/lib/auth.ts`
**Priority:** CRITICAL
**Effort:** 12 hours

**Tests Needed:**
1. JWT token expiration
2. Invalid token format handling
3. Token replay attacks
4. Role-based access control
5. Permission checking with invalid roles
6. Rate limiting on failed auth attempts
7. Brute force protection
8. Session hijacking prevention

**Test File:** `/tests/unit/auth.test.ts`

---

#### Input Validation & Sanitization
**File:** `/src/app/api/leads/route.ts`
**Priority:** CRITICAL
**Effort:** 10 hours

**Tests Needed:**
1. SQL injection attempts in serviceTypeId
2. XSS in formData fields
3. Malformed JSON parsing
4. ZIP code format validation
5. Phone number format validation
6. Email validation
7. Required field enforcement
8. Field length limits
9. JSON payload size limits
10. Special character handling

**Test File:** `/tests/integration/lead-submission.test.ts`

---

### 1.2 Financial Operations Testing (CRITICAL)

#### Auction Engine - Bid Processing
**File:** `/src/lib/auction/engine.ts`
**Priority:** CRITICAL
**Effort:** 16 hours

**Tests Needed:**
1. **Bid Validation**
   - Negative bid amounts rejected
   - NaN bid amounts rejected
   - Bid clamping to min/max boundaries
   - Zero bid handling
   - Missing bid field handling

2. **Winner Selection**
   - Single bid winner
   - Multiple bids - highest wins
   - Tied bids - tiebreaker logic
   - All bids rejected scenario
   - Bid below minimum threshold

3. **Financial Precision**
   - Float arithmetic precision (CRITICAL ISSUE)
   - Currency rounding rules
   - Bid amounts with many decimals
   - Very large bid amounts
   - Bid calculation overflow

4. **Race Conditions**
   - Parallel PING requests
   - Concurrent auction processing
   - Winner POST failure handling
   - Partial auction completion

**Test File:** `/tests/unit/auction-engine.test.ts`
**Test File:** `/tests/integration/auction-flow.test.ts`

**⚠️ CRITICAL FIX NEEDED FIRST:**
```typescript
// WRONG: Float arithmetic
let totalRevenue = 0.0;
totalRevenue += bidAmount; // Precision errors!

// CORRECT: Use Decimal library
import Decimal from 'decimal.js';
let totalRevenue = new Decimal(0);
totalRevenue = totalRevenue.add(bidAmount);
```

---

#### Transaction Logging
**File:** `/src/lib/auction/engine.ts` (lines 788-836)
**Priority:** CRITICAL
**Effort:** 8 hours

**Tests Needed:**
1. Successful transaction logging
2. Database persistence failure handling
3. Concurrent transaction logging
4. Transaction with NULL bidAmount
5. Redis-to-DB sync failures
6. In-memory log recovery after crash
7. Orphaned transaction cleanup

**Test File:** `/tests/unit/transaction-logging.test.ts`

**⚠️ CRITICAL FIX NEEDED:**
```typescript
// Add retry logic for transaction persistence
await retryWithBackoff(async () => {
  await prisma.transaction.create({ data });
}, { maxRetries: 3 });
```

---

#### Revenue Tracking
**File:** `/src/app/api/webhooks/[buyer]/route.ts`
**Priority:** HIGH
**Effort:** 6 hours

**Tests Needed:**
1. Redis incrbyfloat precision
2. Concurrent revenue updates
3. Revenue tracking with missing bid data
4. Redis failure fallback
5. Daily/monthly aggregation accuracy

**Test File:** `/tests/unit/revenue-tracking.test.ts`

---

### 1.3 Data Integrity Testing (CRITICAL)

#### Lead Submission & Validation
**File:** `/src/app/api/leads/route.ts`
**Priority:** CRITICAL
**Effort:** 12 hours

**Tests Needed:**
1. **Database Transaction Integrity**
   - Lead created + queue entry atomic
   - Rollback on queue failure
   - Rollback on compliance audit failure

2. **Validation Bypass**
   - SKIP_RADAR_VALIDATION flag abuse
   - Service type schema mismatch
   - Form validation bypass attempts

3. **Data Quality**
   - Quality score calculation
   - Missing required fields
   - Invalid ZIP codes
   - Invalid phone formats

4. **Race Conditions**
   - Concurrent lead submissions
   - Duplicate lead prevention

**Test File:** `/tests/integration/lead-submission.test.ts`

**⚠️ CRITICAL FIX NEEDED:**
```typescript
// Wrap in database transaction
await prisma.$transaction(async (tx) => {
  const lead = await tx.lead.create({ data });
  await addToQueue(leadId); // Must succeed or rollback
  await tx.complianceAuditLog.create({ data });
});
```

---

#### Lead Processing Worker
**File:** `/src/workers/lead-processor.ts`
**Priority:** CRITICAL
**Effort:** 10 hours

**Tests Needed:**
1. Optimistic locking with updateMany
2. Worker crash recovery
3. Lead not found handling
4. Auction engine failures
5. Database connection loss
6. Partial auction completion
7. Dead letter queue handling
8. Retry exhaustion scenarios

**Test File:** `/tests/integration/lead-worker.test.ts`

---

## Phase 2: HIGH PRIORITY (Week 3-4)

### 2.1 Business Logic Testing

#### Buyer Eligibility Service
**File:** `/src/lib/services/buyer-eligibility-service.ts`
**Priority:** HIGH
**Effort:** 14 hours

**Tests Needed:**
1. **Eligibility Calculation**
   - Score calculation edge cases
   - Daily lead count accuracy
   - Cache staleness issues
   - Timezone handling in daily counts

2. **Geographic Filtering**
   - ZIP code matching
   - Service zone fallback logic
   - Max participants limit
   - Priority sorting

3. **Compliance Checks**
   - TrustedForm requirements
   - TCPA consent validation
   - Jornaya requirements

**Test File:** `/tests/unit/buyer-eligibility.test.ts`

---

#### Template Engine
**File:** `/src/lib/templates/engine.ts`
**Priority:** HIGH
**Effort:** 12 hours

**Tests Needed:**
1. Nested field access with missing keys
2. Async transformation errors
3. Required field validation
4. Parallel mapping failures
5. Payload size validation
6. Data sanitization
7. Hook execution errors
8. Circular reference handling
9. Timeout handling for async transforms

**Test File:** `/tests/unit/template-engine.test.ts`

---

### 2.2 External Integrations

#### TrustedForm Integration
**File:** `/src/lib/external/trustedform.ts`
**Priority:** HIGH
**Effort:** 8 hours

**Tests Needed:**
1. API key validation
2. Certificate validation timeout
3. 404 vs other error handling
4. Malformed API responses
5. Certificate URL extraction
6. PDF download failures
7. Compliance score calculation
8. Retry logic for transient failures

**Test File:** `/tests/integration/trustedform.test.ts`

---

#### Radar.io ZIP Validation
**File:** `/src/app/api/leads/route.ts`
**Priority:** MEDIUM
**Effort:** 6 hours

**Tests Needed:**
1. Radar API timeout
2. Invalid response handling
3. Rate limiting
4. Fallback to local database
5. Bypass flag security

**Test File:** `/tests/integration/radar-validation.test.ts`

---

### 2.3 Queue Management

#### Redis Queue
**File:** `/src/lib/redis.ts`
**Priority:** HIGH
**Effort:** 10 hours

**Tests Needed:**
1. Priority queue ordering
2. Exponential backoff limits
3. Dead letter queue processing
4. Connection loss during BRPOP
5. Job serialization errors
6. Concurrent worker conflicts
7. Queue overflow handling
8. Circuit breaker behavior

**Test File:** `/tests/integration/redis-queue.test.ts`

**⚠️ FIX NEEDED:**
```typescript
// Add circuit breaker
if (consecutiveFailures > 10) {
  await sleep(60000); // Back off for 1 minute
  consecutiveFailures = 0;
}
```

---

## Phase 3: MEDIUM PRIORITY (Week 5-6)

### 3.1 Admin Operations

#### Buyer Management API
**File:** `/src/app/api/admin/buyers/route.ts`
**Priority:** MEDIUM
**Effort:** 8 hours

**Tests Needed:**
1. Duplicate buyer name prevention
2. URL validation
3. Cache invalidation
4. Auth config serialization
5. Partial creation failures
6. Credential masking in responses

**Test File:** `/tests/integration/admin-buyers.test.ts`

---

### 3.2 Database Operations

#### Service Zone Repository
**Priority:** MEDIUM
**Effort:** 10 hours

**Tests Needed:**
1. ZIP code lookup performance
2. Geolocation cache invalidation
3. Bulk zone operations
4. Overlapping service zones
5. ZIP code metadata caching

**Test File:** `/tests/unit/service-zone-repository.test.ts`

---

### 3.3 Performance Testing

#### Load Testing
**Priority:** MEDIUM
**Effort:** 12 hours

**Tests Needed:**
1. Lead submission under load (100 req/sec)
2. Concurrent auction processing
3. Database connection pool exhaustion
4. Redis queue under load
5. Memory leak detection
6. Response time percentiles (p95, p99)

**Test File:** `/tests/performance/load-tests.ts`
**Tool:** k6 or Artillery

---

## Phase 4: END-TO-END TESTING (Week 7-8)

### 4.1 Complete Flow Testing

#### Full Lead Lifecycle
**Priority:** HIGH
**Effort:** 16 hours

**E2E Tests:**
1. Lead submission → Queue → Auction → POST → Transaction log
2. Multiple buyers competing for same lead
3. Lead rejection (no eligible buyers)
4. Lead delivery failure → retry logic
5. ZIP code filtering end-to-end
6. Compliance validation end-to-end
7. Revenue tracking end-to-end

**Test File:** `/tests/e2e/full-lead-lifecycle.test.ts`

---

### 4.2 UI Testing (if applicable)

#### Frontend Components
**Priority:** LOW
**Effort:** 8 hours

**UI Tests:**
1. Lead submission form validation
2. Admin dashboard functionality
3. Buyer management UI
4. Service zone configuration UI

**Tool:** Playwright or Cypress

---

## Testing Infrastructure Setup

### 1. Test Database
```bash
# Docker Compose for test database
docker-compose -f docker-compose.test.yml up -d

# Run migrations
DATABASE_URL="postgresql://test:test@localhost:5433/test" npx prisma migrate deploy
```

### 2. Test Redis
```bash
# Use Redis in Docker
docker run -d -p 6380:6379 redis:alpine

# Or use ioredis-mock in tests
```

### 3. Mock External APIs
```typescript
// Use MSW (Mock Service Worker)
import { setupServer } from 'msw/node';

const server = setupServer(
  rest.post('https://cert.trustedform.com/validate', (req, res, ctx) => {
    return res(ctx.json({ valid: true }));
  })
);
```

### 4. Test Fixtures
```typescript
// Create reusable test data
export const testBuyer = {
  id: 'test-buyer-1',
  name: 'Test Buyer',
  active: true,
  // ...
};

export const testLead = {
  serviceTypeId: 'windows',
  zipCode: '90210',
  // ...
};
```

---

## Critical Fixes Required BEFORE Testing

### 1. Use Decimal for Money
**File:** `prisma/schema.prisma`
```prisma
model Transaction {
  bidAmount Decimal? @db.Decimal(10, 2) // Not Float!
}

model BuyerServiceConfig {
  minBid Decimal @db.Decimal(10, 2)
  maxBid Decimal @db.Decimal(10, 2)
}
```

### 2. Add Database Transactions
**File:** `/src/app/api/leads/route.ts`
```typescript
await prisma.$transaction(async (tx) => {
  const lead = await tx.lead.create({ data: leadData });
  await addToQueue(lead.id); // If this fails, rollback
  await tx.complianceAuditLog.create({ data: auditData });
});
```

### 3. Implement Webhook Signatures
**File:** `/src/app/api/webhooks/[buyer]/route.ts`
```typescript
const signature = request.headers.get('X-Webhook-Signature');
if (!verifySignature(body, signature, buyer.webhookSecret)) {
  return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
}
```

### 4. Add Input Sanitization
```typescript
import DOMPurify from 'isomorphic-dompurify';
import { z } from 'zod';

// Validate all inputs with Zod schemas
const leadSchema = z.object({
  zipCode: z.string().regex(/^\d{5}$/),
  email: z.string().email(),
  // ...
});

// Sanitize HTML inputs
const clean = DOMPurify.sanitize(userInput);
```

### 5. Add Rate Limiting
```typescript
import { RateLimiterMemory } from 'rate-limiter-flexible';

const rateLimiter = new RateLimiterMemory({
  points: 10, // 10 requests
  duration: 60, // per 60 seconds
});

await rateLimiter.consume(ip); // Throws if exceeded
```

---

## Test Coverage Targets

| Component | Target | Current | Priority |
|-----------|--------|---------|----------|
| Auction Engine | 100% | 5% | CRITICAL |
| Lead Processing | 100% | 0% | CRITICAL |
| Authentication | 100% | 0% | CRITICAL |
| Buyer Eligibility | 90% | 0% | HIGH |
| Template Engine | 90% | 0% | HIGH |
| External APIs | 80% | 0% | HIGH |
| Admin APIs | 80% | 0% | MEDIUM |
| Redis Queue | 85% | 0% | HIGH |
| Service Zones | 75% | 0% | MEDIUM |

**Overall Target:** 90%+ for critical paths

---

## Effort Breakdown

| Phase | Component | Hours | Priority |
|-------|-----------|-------|----------|
| 1 | Security fixes | 30 | CRITICAL |
| 1 | Financial operations | 30 | CRITICAL |
| 1 | Data integrity | 22 | CRITICAL |
| 2 | Business logic | 26 | HIGH |
| 2 | External integrations | 14 | HIGH |
| 2 | Queue management | 10 | HIGH |
| 3 | Admin operations | 8 | MEDIUM |
| 3 | Database operations | 10 | MEDIUM |
| 3 | Performance testing | 12 | MEDIUM |
| 4 | E2E testing | 16 | HIGH |
| 4 | UI testing | 8 | LOW |

**Total:** 186 hours (~23 business days for 1 developer)

---

## Testing Tools & Libraries

### Core Testing
- **Jest** - Unit & integration testing
- **ts-jest** - TypeScript support
- **Supertest** - API endpoint testing
- **@prisma/client** - Database testing

### Mocking & Fixtures
- **MSW** (Mock Service Worker) - External API mocking
- **ioredis-mock** - Redis mocking
- **faker-js** - Test data generation
- **factory-bot** - Test fixture factories

### E2E Testing
- **Playwright** - Browser automation
- **Docker** - Test databases
- **Testcontainers** - Managed Docker in tests

### Load Testing
- **k6** - Load testing
- **Artillery** - Performance testing

### Code Quality
- **Istanbul** - Code coverage
- **ESLint** - Linting
- **SonarQube** - Static analysis

---

## Continuous Testing Strategy

### 1. Pre-commit Hooks
```bash
# Run fast unit tests before commit
npx jest --onlyChanged --bail
```

### 2. CI/CD Pipeline
```yaml
# GitHub Actions workflow
- Run all unit tests
- Run integration tests
- Run E2E tests
- Generate coverage report
- Block merge if coverage < 90%
```

### 3. Production Monitoring
```typescript
// Add assertions in production
if (bidAmount < 0) {
  logger.error('Negative bid detected', { bidAmount, leadId });
  throw new Error('Invalid bid amount');
}
```

---

## Success Metrics

### Test Coverage
- [ ] 100% coverage for financial operations
- [ ] 100% coverage for authentication
- [ ] 90% coverage for lead processing
- [ ] 80% overall code coverage

### Quality Gates
- [ ] All critical paths have tests
- [ ] No security vulnerabilities (OWASP Top 10)
- [ ] No data integrity issues
- [ ] Load tests pass (100 req/sec sustained)

### Production Readiness
- [ ] All Phase 1 tests passing
- [ ] All security fixes implemented
- [ ] Webhook signatures verified
- [ ] Database transactions in place
- [ ] Input validation complete

---

## Next Steps

1. **Week 1:** Implement critical security fixes
2. **Week 2:** Write Phase 1 tests (security + financial)
3. **Week 3:** Write Phase 2 tests (business logic)
4. **Week 4:** Write Phase 2 tests (integrations)
5. **Week 5:** Write Phase 3 tests (admin + performance)
6. **Week 6:** E2E testing
7. **Week 7:** Load testing & optimization
8. **Week 8:** Production deployment

---

**CRITICAL:** Do NOT deploy to production until Phase 1 is complete (security + financial + data integrity tests all passing).
