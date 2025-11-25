# Audit Spec - Post-Implementation Quality Review

You are helping the user perform a comprehensive post-implementation quality audit of a completed spec.

## Core Responsibilities

1. **Verify spec completion** (all tasks marked [x])
2. **Gather implementation context** (reports, changed files)
3. **Launch parallel quality validators** (implementation + standards)
4. **Self-audit findings** (prevent over-complication)
5. **Generate comprehensive audit report** (actionable recommendations)

## Workflow

### Step 1: Identify Spec to Audit

**If spec ID provided in command:**
Use the provided spec ID directly.

**If no spec ID provided:**
Show list of completed specs for user to select:

```markdown
📋 SELECT SPEC TO AUDIT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Completed Specs:
[1] User Authentication System (completed 2 days ago)
[2] Twilio Voice Widget (completed 1 week ago)
[3] Payment Integration (completed 3 weeks ago)

Enter number to select:
```

### Step 2: Verify Spec Completion

Read tasks.md and verify ALL tasks are marked [x]:

```bash
spec_path="@gabe-os/specs/[spec-id]"
cat "$spec_path/tasks.md"
```

**Check for incomplete tasks:**
- Count total parent tasks (lines with `- [ ]` or `- [x]` at task group level)
- Count completed parent tasks (lines with `- [x]`)
- If any incomplete → Show warning and offer to continue implementation first

```markdown
⚠️ SPEC NOT READY FOR AUDIT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This spec is only 80% complete (4/5 task groups).

Incomplete task groups:
  ⏳ Task Group 5: Integration Tests (0/3 sub-tasks)

You must complete implementation before running post-audit.

Options:
[1] Continue implementation (/continue-spec)
[2] Cancel audit
[0] Audit anyway (not recommended)

Enter number:
```

If user selects [0] (audit anyway), show additional warning and require confirmation.

### Step 3: Gather Implementation Context

**Read all implementation reports:**

```bash
spec_path="@gabe-os/specs/[spec-id]"

# List all implementation reports
ls "$spec_path/implementation/"

# Read each report
cat "$spec_path/implementation/1-database-models-implementation.md"
cat "$spec_path/implementation/2-authentication-api-implementation.md"
# ... etc
```

**Extract changed files from reports:**

Parse each implementation report to build list of files created or modified by this spec.

Example parsing:
```markdown
## Files Created
- features/auth/models/User.ts
- features/auth/services/AuthService.ts

## Files Modified
- src/server.ts (added auth routes)
```

Result: Array of file paths that were touched by this spec.

**Read existing audit reports (if any):**

```bash
# Check for batch audit reports from implementation
ls "$spec_path/verification/"

cat "$spec_path/verification/batch-1-quality-audit.md"
cat "$spec_path/verification/batch-2-quality-audit.md"
# ... etc
```

### Step 4: Display Audit Plan

Show user what will be audited:

```markdown
╔═══════════════════════════════════════════════════════════════════════════╗
║               🔍 POST-IMPLEMENTATION AUDIT: User Authentication            ║
╚═══════════════════════════════════════════════════════════════════════════╝

Spec Status: ✅ 100% Complete (5/5 task groups, 18/18 sub-tasks)

FILES TO AUDIT (12 files changed by this spec)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Database Models (2 files):
  • features/auth/models/User.ts
  • features/auth/models/Session.ts

API Layer (3 files):
  • features/auth/controllers/AuthController.ts
  • features/auth/services/AuthService.ts
  • features/auth/services/TokenService.ts

Frontend (4 files):
  • features/auth/components/LoginForm.tsx
  • features/auth/components/RegisterForm.tsx
  • features/auth/hooks/useLogin.ts
  • features/auth/hooks/useRegister.ts

Tests (3 files):
  • features/auth/__tests__/auth.integration.test.ts
  • features/auth/__tests__/AuthService.test.ts
  • features/auth/__tests__/LoginForm.test.tsx

AUDIT SCOPE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Implementation Validation
   → Verify all spec requirements met
   → Check acceptance criteria satisfied
   → Validate feature completeness

✅ Quality Standards Validation
   → File size limits (500 lines max)
   → Documentation completeness (WHY/WHEN/HOW)
   → Modularity (Single Responsibility)
   → DRY principle compliance
   → No race conditions
   → No breaking changes

✅ Integration Analysis
   → Check for conflicts with existing code
   → Verify proper error handling
   → Validate test coverage
   → Review security considerations

PREVIOUS AUDITS (during implementation)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Batch 1 Quality Audit: PASSED (no violations)
✅ Batch 2 Quality Audit: PASSED (1 warning: AuthService approaching 380 lines)
✅ Batch 3 Quality Audit: PASSED (no violations)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This will launch 2 specialized agents in parallel:
  1. implementation-verifier (spec requirements validation)
  2. code-quality-auditor (standards enforcement)

Estimated time: 15-20 minutes
Estimated tokens: ~3,000

Proceed with post-implementation audit? [y/n]
```

### Step 5: Launch Parallel Quality Validators

**Agent 1: implementation-verifier**

Delegate to implementation-verifier agent with focused context:

```markdown
TASK: Post-Implementation Audit - Verify Spec Requirements

SPEC CONTEXT:
[Full spec.md content]

IMPLEMENTATION REPORTS:
[All implementation reports concatenated]

FOCUS: Only review these files changed by this spec:
[List of changed files]

INSTRUCTIONS:
1. Read the spec requirements and acceptance criteria
2. Read each changed file to understand implementation
3. Verify ALL requirements from spec are satisfied
4. Check acceptance criteria are met
5. Identify any missing functionality
6. Identify any deviations from spec
7. Rate completeness: COMPLETE | MOSTLY COMPLETE | INCOMPLETE

Generate report with:
- Requirements checklist (✅ met, ❌ missing, ⚠️ partial)
- Acceptance criteria validation
- Feature completeness assessment
- Deviations from spec (if any)
- Missing functionality (if any)
- Overall rating and recommendation
```

**Agent 2: code-quality-auditor**

Delegate to code-quality-auditor agent with focused context:

```markdown
TASK: Post-Implementation Audit - Validate Quality Standards

SPEC ID: [spec-id]
SPEC NAME: [spec-name]

FILES TO AUDIT: Only review these files changed by this spec:
[List of changed files]

CONTEXT:
- This is a POST-IMPLEMENTATION audit (all tasks complete)
- Previous batch audits: [summary of batch audit results]
- Focus on comprehensive review, not just critical violations

INSTRUCTIONS:
1. Read each changed file
2. Check ALL quality standards:
   - File size limits (500 lines max)
   - Documentation (WHY/WHEN/HOW for every function)
   - Modularity (Single Responsibility Principle)
   - DRY principle (no code duplication)
   - Race conditions (proper concurrency handling)
   - Breaking changes (migration plans if needed)
   - Error handling (comprehensive try-catch)
   - Test coverage (sufficient tests)
   - Security (no vulnerabilities)
3. Rate each file: EXCELLENT | GOOD | NEEDS IMPROVEMENT | POOR
4. Provide specific, actionable recommendations

Generate comprehensive audit report.
```

**Launch agents in parallel:**

Use Task tool to launch both agents simultaneously:
- Task 1: implementation-verifier (spec validation)
- Task 2: code-quality-auditor (standards validation)

Wait for both to complete.

### Step 6: Self-Audit the Findings

**Prevent over-complication and hallucinations:**

Once both agents return their reports, perform self-audit:

```markdown
SELF-AUDIT CHECKLIST:

1. **Scope Verification**
   - Did agents only review files changed by this spec? ✓/✗
   - Did agents avoid reviewing unrelated files? ✓/✗
   - If ✗: Filter out findings from unrelated files

2. **Specificity Check**
   - Are violations specific with file:line references? ✓/✗
   - Are recommendations actionable? ✓/✗
   - If ✗: Mark as "general guidance" not violations

3. **Severity Calibration**
   - Are CRITICAL violations truly blocking? ✓/✗
   - Are WARNINGS truly important? ✓/✗
   - If ✗: Downgrade severity appropriately

4. **Redundancy Check**
   - Are same issues reported multiple times? ✓/✗
   - If ✓: Consolidate into single finding

5. **False Positive Detection**
   - Do "violations" actually exist in the code? ✓/✗
   - Are agents hallucinating issues? ✓/✗
   - If ✓: Remove false positives

6. **Context Validation**
   - Do recommendations consider project context? ✓/✗
   - Are recommendations realistic? ✓/✗
   - If ✗: Add context or remove recommendation
```

### Step 7: Generate Comprehensive Audit Report

Combine both agent reports with self-audit results:

```markdown
╔═══════════════════════════════════════════════════════════════════════════╗
║          📊 POST-IMPLEMENTATION AUDIT REPORT: User Authentication          ║
╚═══════════════════════════════════════════════════════════════════════════╝

Audit Date: Nov 4, 2025 at 4:30 PM
Spec ID: 2025-11-04-user-authentication
Files Audited: 12 files
Auditors: implementation-verifier, code-quality-auditor

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## EXECUTIVE SUMMARY

✅ **OVERALL RATING: EXCELLENT**

The implementation is production-ready with high quality standards throughout.
All spec requirements are met and code quality is exceptional.

**Key Strengths:**
- All files under 500 lines (average: 245 lines)
- 100% documentation coverage with WHY/WHEN/HOW
- Excellent modularity (strict SRP compliance)
- Comprehensive test coverage (85%)
- No critical violations

**Areas for Improvement:**
- 2 medium-priority warnings (see below)
- 1 enhancement opportunity

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 1. IMPLEMENTATION VALIDATION

### Requirements Checklist (8/8 complete)

✅ User registration with email and password
✅ User login with JWT token generation
✅ Password hashing with bcrypt
✅ Token refresh mechanism
✅ Email verification flow
✅ Password reset flow
✅ User profile management
✅ Session management

### Acceptance Criteria (5/5 met)

✅ Users can register with valid email and password
✅ Registered users can log in and receive JWT token
✅ Tokens expire after 1 hour and can be refreshed
✅ Password reset emails contain valid reset links
✅ All authentication endpoints return proper error messages

### Feature Completeness: ✅ COMPLETE

All specified features are fully implemented and functional.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 2. QUALITY STANDARDS VALIDATION

### File Size Compliance: ✅ EXCELLENT

All files well under 500-line limit:
- ✅ User.ts: 145 lines
- ✅ Session.ts: 98 lines
- ✅ AuthController.ts: 287 lines
- ✅ AuthService.ts: 342 lines (largest file)
- ✅ TokenService.ts: 178 lines
- ✅ LoginForm.tsx: 234 lines
- ✅ RegisterForm.tsx: 256 lines
- ✅ useLogin.ts: 87 lines
- ✅ useRegister.ts: 92 lines
- ✅ auth.integration.test.ts: 456 lines
- ✅ AuthService.test.ts: 298 lines
- ✅ LoginForm.test.tsx: 187 lines

**Average file size: 245 lines** (well within target 200-300)

### Documentation: ✅ EXCELLENT

100% of functions have WHY/WHEN/HOW documentation:
- ✅ All 23 service functions documented
- ✅ All 8 controller methods documented
- ✅ All 12 utility functions documented
- ✅ All 6 React components documented
- ✅ All 4 custom hooks documented

**Sample (AuthService.login):**
```typescript
/**
 * WHY: Authenticates users with email/password and provides JWT tokens
 * WHEN: Called when user submits login form
 * HOW: Validates credentials, generates JWT, creates session record
 */
```

### Modularity: ✅ EXCELLENT

Strict Single Responsibility Principle compliance:
- ✅ AuthController: HTTP layer only (no business logic)
- ✅ AuthService: Business logic only (no HTTP concerns)
- ✅ TokenService: Token operations only (single purpose)
- ✅ User model: Data structure only (no behavior)
- ✅ LoginForm: Presentation only (no business logic)
- ✅ useLogin hook: State management only (no presentation)

### DRY Principle: ✅ EXCELLENT

No code duplication detected:
- ✅ Validation logic extracted to validators/
- ✅ Error handling extracted to middleware/
- ✅ Common utilities in shared/utils/
- ✅ Form validation logic reused across components

### Race Conditions: ✅ EXCELLENT

Proper concurrency handling:
- ✅ Token generation uses atomic operations
- ✅ Session updates use database transactions
- ✅ No shared mutable state in services
- ✅ React hooks follow best practices (no race conditions)

### Breaking Changes: ✅ NONE

No breaking changes to existing APIs or interfaces.

### Test Coverage: ✅ GOOD (85%)

- ✅ Integration tests: Complete coverage of auth flows
- ✅ Unit tests: All services tested
- ✅ Component tests: All forms tested
- ⚠️ Missing: Edge case tests for token expiration race conditions

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 3. DETAILED FINDINGS

### 🟢 STRENGTHS (0 critical, 0 high, 0 medium)

**1. Exceptional Modularity**
- Each file has a clear, single responsibility
- Services, controllers, and models properly separated
- React components and hooks cleanly separated
- No God objects or bloated files

**2. Outstanding Documentation**
- Every function has detailed WHY/WHEN/HOW comments
- Code is self-documenting and easy to understand
- Future developers will easily understand the system

**3. Excellent Error Handling**
- Comprehensive try-catch blocks
- Proper error messages for all scenarios
- Error middleware properly integrated

**4. Strong Test Coverage**
- All critical paths tested
- Both integration and unit tests
- Good use of mocks and fixtures

### 🟡 WARNINGS (2 medium-priority)

**1. AuthService approaching 380-line warning threshold**
- File: features/auth/services/AuthService.ts:1
- Current: 342 lines
- Threshold: 400 lines (warning), 500 lines (critical)
- **Recommendation:** Consider extracting password reset logic into separate PasswordResetService.ts
- **Severity:** MEDIUM (not urgent, but plan for future refactoring)

**2. Missing edge case tests**
- File: features/auth/__tests__/auth.integration.test.ts
- Missing: Tests for token expiration race conditions
- **Recommendation:** Add tests for:
  - Token expires exactly during refresh attempt
  - Concurrent refresh requests with same token
  - Expired token used in concurrent requests
- **Severity:** MEDIUM (low probability, but good to have)

### 🔵 ENHANCEMENTS (1 opportunity)

**1. Consider rate limiting on auth endpoints**
- Not in original spec, but valuable security enhancement
- **Recommendation:** Add rate limiting middleware for:
  - /auth/login (5 attempts per 15 minutes)
  - /auth/register (3 attempts per hour)
  - /auth/forgot-password (3 attempts per hour)
- **Severity:** LOW (enhancement, not required)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 4. INTEGRATION ANALYSIS

### Conflicts with Existing Code: ✅ NONE

No conflicts detected with existing codebase.

### Proper Integration: ✅ EXCELLENT

- ✅ Auth routes properly registered in server.ts
- ✅ Auth middleware integrated into protected routes
- ✅ Database migrations applied correctly
- ✅ Environment variables documented in .env.example

### Security: ✅ EXCELLENT

- ✅ Passwords hashed with bcrypt (cost factor 10)
- ✅ JWT tokens properly signed with secret
- ✅ Sensitive data not logged
- ✅ SQL injection prevention (parameterized queries)
- ✅ XSS prevention (proper input sanitization)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 5. COMPARISON TO BATCH AUDITS

**Batch 1 Audit:** PASSED (no violations)
**Batch 2 Audit:** PASSED (1 warning: AuthService approaching limit)
**Batch 3 Audit:** PASSED (no violations)

**Post-Implementation Audit:** PASSED (same warning persists)

The warning about AuthService was flagged during Batch 2 and persists.
This is expected and acceptable - the file is at 342 lines (68% of limit).

**No regression detected.** Quality maintained throughout implementation.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 6. RECOMMENDATIONS

### Immediate Actions (0)
None required. Implementation is production-ready.

### Short-Term Actions (Optional)
1. Consider extracting password reset logic from AuthService (medium priority)
2. Add edge case tests for token expiration scenarios (medium priority)

### Long-Term Actions (Optional)
1. Consider adding rate limiting to auth endpoints (low priority enhancement)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 7. FINAL VERDICT

✅ **APPROVED FOR PRODUCTION**

This implementation meets all requirements and quality standards.
The code is clean, modular, well-documented, and production-ready.

**Confidence Level:** HIGH

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Report generated: Nov 4, 2025 at 4:45 PM
Audit duration: 15 minutes
Files audited: 12 files
Lines of code: 2,940 lines

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Step 8: Save Audit Report

Save the comprehensive audit report:

```bash
spec_path="@gabe-os/specs/[spec-id]"
mkdir -p "$spec_path/verification"

# Save with timestamp
timestamp=$(date +%Y-%m-%d-%H%M)
cat > "$spec_path/verification/post-implementation-audit-$timestamp.md" << 'EOF'
[Full audit report content]
EOF

echo "Audit report saved: $spec_path/verification/post-implementation-audit-$timestamp.md"
```

### Step 9: Update Spec Metadata

If `.spec-metadata.yml` exists, update it:

```yaml
# Update fields:
audited: true
audit_date: "2025-11-04T16:45:00Z"
audit_status: "approved"  # approved | needs_improvement | rejected
audit_rating: "excellent"  # excellent | good | needs_improvement | poor
```

### Step 10: Display Summary and Next Steps

Show user the summary:

```markdown
╔═══════════════════════════════════════════════════════════════════════════╗
║                      ✅ AUDIT COMPLETE: APPROVED                           ║
╚═══════════════════════════════════════════════════════════════════════════╝

OVERALL RATING: EXCELLENT

✅ All spec requirements met
✅ All quality standards met
✅ Production-ready

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FINDINGS SUMMARY:

  🟢 Strengths: 4 highlighted areas
  🟡 Warnings: 2 medium-priority (optional fixes)
  🔵 Enhancements: 1 opportunity (not required)
  🔴 Critical Issues: 0

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FULL REPORT:
@gabe-os/specs/2025-11-04-user-authentication/verification/post-implementation-audit-2025-11-04-1645.md

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NEXT STEPS:

[1] View full audit report
[2] Address warnings (optional)
[3] Mark spec as complete and archive
[4] Back to main menu

Enter number or press Enter to return to menu:
```

## Important Constraints

1. **Scope Focus** - Only audit files changed by this spec (prevent hallucinations)
2. **Completion Check** - Always verify 100% complete before auditing
3. **Self-Audit** - Review agent findings for false positives and over-complication
4. **Specificity** - All findings must reference file:line:column
5. **Actionability** - Recommendations must be concrete and implementable
6. **Severity Calibration** - Don't exaggerate issues
7. **Context Awareness** - Consider project context when making recommendations
8. **Comparison** - Reference batch audit results to show progression

## Integration with Dashboard

This command integrates with:
- `/main-menu` (shows audit status for each spec)
- `/continue-spec` (option to run audit after completion)
- `code-quality-auditor` agent (reused for post-audit)
- `implementation-verifier` agent (validates requirements)

## Self-Audit Principles

**Prevent over-complication:**
- Focus on spec-changed files only
- Don't audit entire codebase
- Don't report issues from unrelated files
- Don't create work where none exists

**Validate findings:**
- Check if violations actually exist
- Verify file:line references are accurate
- Ensure recommendations are realistic
- Filter out false positives

**Calibrate severity:**
- CRITICAL: Blocks production deployment
- HIGH: Should fix before deployment
- MEDIUM: Should fix soon (not blocking)
- LOW: Nice to have enhancement

**Be specific:**
- "File X line Y: Missing WHY documentation" ✅
- "Some files need better documentation" ❌

## Success Criteria

A successful audit:
- ✅ Focuses only on spec-changed files
- ✅ Provides specific, actionable findings
- ✅ Calibrates severity appropriately
- ✅ Includes context and recommendations
- ✅ Compares to batch audit results
- ✅ Generates comprehensive report
- ✅ Saves report to verification folder
- ✅ Updates spec metadata
