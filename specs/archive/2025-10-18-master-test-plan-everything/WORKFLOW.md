# MANDATORY TEST IMPLEMENTATION WORKFLOW

**Version:** 1.0
**Applies to:** All 1,200+ tests in the master test plan
**Enforcement:** STRICT - No exceptions

---

## 🚫 THE #1 RULE

**NEVER mark a test as complete until it PASSES.**

Period. No exceptions. No "it should work." No "I'll fix it later."

---

## ⚙️ The 5-Step Workflow

Every single test MUST go through this exact process:

```
┌─────────────────────────────────────────────────┐
│  1. IMPLEMENT THE TEST                          │
│     - Write the test code                       │
│     - Include all assertions                    │
│     - Add proper cleanup                        │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  2. RUN THE TEST                                │
│     - Execute: npm test -- [test-file]         │
│     - Capture ALL output                        │
│     - Note execution time                       │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  3. REPORT THE RESULTS                          │
│     - Status: PASS or FAIL                      │
│     - Console output                            │
│     - Errors (if any)                           │
│     - Assertion results (X/Y passed)            │
└─────────────────────────────────────────────────┘
                      ↓
              ┌───────┴────────┐
              ↓                ↓
    ┌──────────────┐  ┌──────────────┐
    │  4a. FAILED? │  │  4b. PASSED? │
    └──────────────┘  └──────────────┘
              ↓                ↓
    ┌──────────────┐  ┌──────────────┐
    │ - Analyze    │  │ - Run again  │
    │ - Fix issue  │  │ - Run again  │
    │ - Document   │  │ - Run again  │
    │ - GO TO 2    │  │ - (3/3 pass?)│
    └──────────────┘  └──────────────┘
                             ↓
                   ┌──────────────────┐
                   │  5. MARK ✅       │
                   │     COMPLETE     │
                   └──────────────────┘
```

---

## ✅ DO (Required Actions)

- ✅ **Write test** - Include all assertions, setup, teardown
- ✅ **Run immediately** - Don't wait, run as soon as written
- ✅ **Report output** - Copy/paste actual console output
- ✅ **Fix failures** - Debug and fix before moving on
- ✅ **Document fixes** - Note what was wrong, what you fixed
- ✅ **Verify consistently** - Run 3 times, all must pass
- ✅ **Clean up** - Ensure test leaves no side effects
- ✅ **Mark complete** - Only when all above done

---

## ❌ DON'T (Forbidden Actions)

- ❌ **Don't mark complete without running** - EVER
- ❌ **Don't skip failed tests** - Fix them first
- ❌ **Don't assume it works** - Verify it works
- ❌ **Don't leave flaky tests** - Make them reliable
- ❌ **Don't move on with failures** - Finish current test first
- ❌ **Don't mark "because it should work"** - Prove it works
- ❌ **Don't batch test writing** - Implement one, test one
- ❌ **Don't skip documentation** - Record what you did

---

## 📋 Reporting Template

Use this exact format when reporting test results:

```markdown
## Test: [Exact test name from code]
**File:** `tests/path/to/test-file.test.ts`
**Date:** 2025-10-18 14:30:00
**Developer:** [Your name]

---

### ⚙️ Implementation
**Status:** ✅ DONE | ⏳ IN PROGRESS

Code:
```typescript
[Paste the test code here]
```

---

### 🏃 Execution

**Command:**
```bash
npm test -- tests/path/to/test-file.test.ts
```

**Status:** ✅ PASSED | ❌ FAILED

**Console Output:**
```
[Paste ACTUAL console output here - don't summarize!]
```

---

### 📊 Assertions

- [✅/❌] **Assertion 1:** Response status is 201
- [✅/❌] **Assertion 2:** Body contains leadId
- [✅/❌] **Assertion 3:** Database record created

**Total:** 3/3 assertions passed

---

### 🐛 Issues (if failed)

**Issue 1:**
- **What:** Test expected status 201, got 400
- **Why:** Missing required field 'zipCode' in request
- **Root Cause:** Test data incomplete

**Issue 2:**
- **What:** Database record not created
- **Why:** Transaction rolled back due to validation error
- **Root Cause:** Foreign key constraint on service_type_id

---

### 🔧 Fixes Applied (if failed)

**Fix 1:**
- **Change:** Added zipCode to test payload
- **Code:** `body: { ...data, zipCode: '12345' }`
- **Result:** Status now 201 ✅

**Fix 2:**
- **Change:** Used valid service type ID from seed data
- **Code:** `serviceTypeId: '1fefd5b3-f999-4ea0-b967-0142a5a71ee1'`
- **Result:** Record created ✅

---

### ✅ Verification Runs

**Run 1:** ✅ PASSED (23ms)
**Run 2:** ✅ PASSED (21ms)
**Run 3:** ✅ PASSED (22ms)

**Consistency:** 3/3 passing ✅
**Flaky behavior:** None observed
**Side effects:** Database cleaned up properly

---

### 📝 Notes

- Test uses timestamp-based unique data to avoid conflicts
- Cleanup verified - no orphaned records
- Performance acceptable (< 30ms)

---

### 🎯 Completion Status

**Status:** [✅ COMPLETE | ⏳ IN PROGRESS | ❌ BLOCKED]

**Checklist:**
- [✅] Test implemented
- [✅] Test runs without errors
- [✅] All assertions pass
- [✅] Verified 3/3 runs
- [✅] No flaky behavior
- [✅] Database cleanup works
- [✅] Documentation complete

**If all checked:** ✅ **MARKED AS COMPLETE**

---
```

---

## 🎯 Quality Gates

Before marking ANY test complete, ALL of these must be true:

### Code Quality
- [ ] Test code follows project conventions
- [ ] Test has clear, descriptive name
- [ ] Test is properly organized (arrange/act/assert)
- [ ] Test includes necessary imports
- [ ] Test uses proper TypeScript types

### Execution Quality
- [ ] Test runs without errors
- [ ] Test runs without warnings
- [ ] Test execution time reasonable (< 30s for unit, < 2m for E2E)
- [ ] Test doesn't timeout
- [ ] Test doesn't hang

### Assertion Quality
- [ ] All assertions pass
- [ ] Assertions are specific (not vague)
- [ ] Assertions test the right thing
- [ ] Edge cases covered
- [ ] Error cases tested

### Reliability Quality
- [ ] Test passes consistently (3/3 runs minimum)
- [ ] No flaky behavior observed
- [ ] No random failures
- [ ] No timing-dependent logic (unless properly handled)
- [ ] No external dependencies (mock them)

### Data Quality
- [ ] Test data is realistic
- [ ] Test data is unique (timestamps, UUIDs)
- [ ] Test data doesn't conflict with other tests
- [ ] Test data properly seeded
- [ ] Test data properly cleaned up

### Cleanup Quality
- [ ] Database state reset after test
- [ ] No orphaned records
- [ ] No side effects on other tests
- [ ] Temp files cleaned up
- [ ] Connections closed

### Documentation Quality
- [ ] Test purpose clear from name
- [ ] Comments explain WHY, not what
- [ ] Reporting template filled out
- [ ] Issues documented
- [ ] Fixes documented

---

## 📊 Progress Tracking Statuses

Use these statuses when tracking test implementation:

| Symbol | Status | Meaning | Next Action |
|--------|--------|---------|-------------|
| `[ ]` | **NOT STARTED** | Test not yet written | Implement the test |
| `[~]` | **IN PROGRESS** | Test written, not yet run/passing | Run and debug |
| `[!]` | **FAILING** | Test runs but fails assertions | Fix issues |
| `[?]` | **FLAKY** | Test passes sometimes, fails others | Make reliable |
| `[✅]` | **COMPLETE** | Test passes 3/3 runs, verified | Move to next |

### Example Progress List:

```markdown
## Domain 1: Backend APIs - Lead Submission

### POST /api/leads
- [✅] Submit windows lead - COMPLETE (3/3 passing, 23ms avg)
- [✅] Submit bathrooms lead - COMPLETE (3/3 passing, 21ms avg)
- [!] Submit roofing lead - FAILING (validation error on squareFootage)
- [~] Submit with minimum fields - IN PROGRESS (implemented, testing)
- [ ] Submit with maximum fields - NOT STARTED
- [ ] Invalid ZIP code rejection - NOT STARTED

**Summary:** 2/6 complete (33%)
**Blockers:** Roofing validation schema mismatch
**Next:** Fix roofing test, then implement remaining tests
```

---

## 🚨 Real-World Consequences

### What Happens If You Skip This Workflow?

**Scenario: Mark test complete without running**

```
Developer marks test complete ❌
    ↓
Code merged to main
    ↓
CI/CD runs tests
    ↓
Test FAILS in CI/CD ❌
    ↓
Build blocked
    ↓
Team can't deploy
    ↓
Emergency fix needed
    ↓
Lost development time
    ↓
Team loses trust in tests
```

**Real Cost:**
- **Time:** 2 hours to debug later vs. 5 minutes to run now
- **Money:** Blocked deploy = lost revenue
- **Trust:** Team questions all "completed" work
- **Quality:** Bugs slip through to production

### What Happens When You Follow This Workflow?

**Scenario: Implement → Run → Report → Fix → Verify**

```
Developer implements test ✅
    ↓
Runs test immediately
    ↓
Test FAILS (missing field) ❌
    ↓
Fixes in 2 minutes ✅
    ↓
Runs again - PASSES ✅
    ↓
Runs 2 more times - PASSES ✅
    ↓
Marks complete ✅
    ↓
Code merged to main
    ↓
CI/CD runs tests
    ↓
All tests PASS ✅
    ↓
Deploy successful ✅
    ↓
Zero incidents
```

**Real Benefit:**
- **Time:** Issues fixed immediately (context fresh)
- **Money:** No blocked deploys, no lost revenue
- **Trust:** Team has confidence in test suite
- **Quality:** Bugs caught before production

---

## 🔒 Enforcement Mechanisms

### Self-Enforcement
- Review this document before marking any test complete
- Ask yourself: "Did I actually run this?"
- If answer is "no" or "unsure" → Run it now

### Peer Review
- Code reviews must include test output
- Reviewer verifies test was run
- Reviewer checks for proper documentation

### CI/CD Enforcement
- All tests run automatically
- Failed tests block merge
- Coverage reports generated
- Flaky tests detected and flagged

### Team Lead Enforcement
- Random spot checks of "completed" tests
- Review test reports weekly
- Track test reliability metrics
- Hold team accountable for workflow

---

## 📖 Examples

### Example 1: Simple Unit Test

**Test:** Validate email format

**Workflow:**

```typescript
// 1. IMPLEMENT
test('validates email format correctly', () => {
  expect(validateEmail('test@example.com')).toBe(true);
  expect(validateEmail('invalid')).toBe(false);
});

// 2. RUN
// $ npm test -- src/lib/validation.test.ts

// 3. REPORT
// ✅ PASSED
// Time: 3ms
// Assertions: 2/2 passed

// 4. PASSED? Yes
// 5. VERIFY - Run 3 times:
// Run 1: ✅ (3ms)
// Run 2: ✅ (2ms)
// Run 3: ✅ (3ms)

// MARK COMPLETE ✅
```

### Example 2: API Integration Test

**Test:** POST /api/leads - Submit lead

**Workflow:**

```typescript
// 1. IMPLEMENT
test('POST /api/leads - Submit windows lead', async () => {
  const response = await request(app)
    .post('/api/leads')
    .send({
      serviceTypeId: 'windows-id',
      formData: { zipCode: '12345', /* ... */ }
    });

  expect(response.status).toBe(201);
  expect(response.body.leadId).toBeDefined();
});

// 2. RUN
// $ npm test -- tests/e2e/lead-submission.test.ts

// 3. REPORT
// ❌ FAILED
// Error: Expected status 201, got 400
// Body: { error: "Invalid service type ID" }

// 4a. FAILED - Analyze & Fix
// Issue: Using placeholder ID instead of real UUID
// Fix: Query database for actual service type ID
const serviceType = await prisma.serviceType.findFirst({
  where: { name: 'windows' }
});

// Fix applied - use real ID:
serviceTypeId: serviceType.id

// 2. RUN AGAIN
// $ npm test -- tests/e2e/lead-submission.test.ts

// 3. REPORT AGAIN
// ✅ PASSED
// Time: 245ms
// Assertions: 2/2 passed
// Database: Record created and cleaned up

// 4b. PASSED - Verify
// Run 1: ✅ (245ms)
// Run 2: ✅ (238ms)
// Run 3: ✅ (242ms)

// 5. MARK COMPLETE ✅
```

### Example 3: Flaky Test Scenario

**Test:** Auction engine timing

**Workflow:**

```typescript
// 1. IMPLEMENT
test('auction completes within 10 seconds', async () => {
  const start = Date.now();
  await runAuction(leadData);
  const duration = Date.now() - start;

  expect(duration).toBeLessThan(10000);
});

// 2. RUN
// $ npm test -- tests/integration/auction.test.ts

// 3. REPORT
// ✅ PASSED (8234ms)

// 4b. PASSED - Verify
// Run 1: ✅ (8234ms)
// Run 2: ❌ (10542ms) ← TIMEOUT!
// Run 3: ✅ (7891ms)

// 🚨 FLAKY TEST DETECTED

// DO NOT MARK COMPLETE
// Status: [?] FLAKY

// Debug:
// - External buyer API sometimes slow
// - Need to mock external calls for reliability

// Fix: Mock external calls
jest.mock('@/lib/external-buyer-api');

// Re-run verification:
// Run 1: ✅ (123ms)
// Run 2: ✅ (118ms)
// Run 3: ✅ (121ms)

// NOW mark complete ✅
```

---

## 🎓 Training Checklist

Before starting test implementation, verify:

- [ ] I have read this WORKFLOW.md document
- [ ] I understand the 5-step process
- [ ] I know what "complete" means (test passing 3/3 times)
- [ ] I will report results for every test
- [ ] I will fix failures before moving on
- [ ] I will not mark tests complete without running them
- [ ] I understand the consequences of skipping steps
- [ ] I know how to use the reporting template
- [ ] I know the quality gates checklist
- [ ] I am ready to follow this workflow for ALL tests

---

## 📞 Questions & Support

**Q: What if a test is blocked by missing infrastructure?**
A: Mark as `[B]` BLOCKED, document the blocker, notify team lead

**Q: What if I can't get a test to pass?**
A: Don't mark complete. Document the issue, ask for help

**Q: Can I mark it complete if it passes 2/3 times?**
A: NO. Fix the flakiness first, then get 3/3 passing

**Q: What if the test takes too long to run?**
A: Optimize it or mock dependencies. Don't skip verification.

**Q: Can I batch-write tests then test them all at once?**
A: NO. Implement one → test one → complete one → repeat

**Q: What if I'm sure it works without running?**
A: Run it anyway. You might be wrong. Verify everything.

**Q: What if CI/CD runs the tests anyway?**
A: Don't rely on CI/CD for first-run verification. Run locally first.

---

## 🏆 Success Criteria

You're following the workflow correctly when:

✅ Every test you mark complete actually passes
✅ You can show the test output for any "complete" test
✅ You have documented issues and fixes
✅ Your tests are reliable (not flaky)
✅ CI/CD passes on first try
✅ Team trusts your test results
✅ No surprises in production

---

## 📌 Quick Reference Card

```
┌───────────────────────────────────────────────┐
│  MANDATORY TEST WORKFLOW - QUICK REFERENCE    │
├───────────────────────────────────────────────┤
│                                               │
│  1. Implement → Write the test code          │
│  2. Run       → Execute immediately           │
│  3. Report    → Document results              │
│  4. Fix/Verify→ Fix if failed, verify if pass │
│  5. Complete  → Mark ✅ only when passing     │
│                                               │
│  🚫 NEVER mark complete without running       │
│  ✅ ALWAYS report actual output               │
│  ⚡ FIX failures immediately                  │
│  🎯 VERIFY tests pass 3/3 times               │
│                                               │
└───────────────────────────────────────────────┘
```

---

**Remember:** A test isn't complete until it passes. Period.

**Print this workflow. Pin it on your wall. Follow it religiously.**

**Your future self (and your team) will thank you.**
