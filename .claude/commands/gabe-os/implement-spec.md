# Spec Implementation Process with Intelligent Parallel Execution & Quality Gates

Now that we have a spec and tasks list ready for implementation, we will proceed with implementation using intelligent dependency analysis, parallel batching, and quality gates after each batch.

**This ensures:**
- Safe parallel execution (respects dependencies)
- Token efficiency (no wasted retries)
- Quality enforcement (auditor after each batch)
- Production-grade code (standards enforced throughout)

## Token Tracking

**This command tracks token usage for implementation and verification phases.**

Use these helper functions throughout:

{{workflows/utilities/track-token-usage}}

Follow these phases IN SEQUENCE:

PHASE 1: Analyze task dependencies and create safe execution batches
PHASE 2: Execute batches with parallel tasks and quality audits
PHASE 3: Delegate verifications to area-specific verifier subagents
PHASE 4: Produce final verification report

---

## PHASE 1: Analyze Dependencies and Create Execution Batches

### Step 1: Read Task List and Identify Dependencies

Read `gabe-os/specs/[this-spec]/tasks.md` carefully.

For each task group, extract:
- Task group number and title
- Assigned implementer
- Dependencies field (explicit dependencies)
- Task descriptions (for implicit dependency detection)

### Step 2: Detect Explicit Dependencies

Look for the **"Dependencies:"** field in each task group.

Examples:
- `Dependencies: None` → Can run in first batch
- `Dependencies: Task Group 1` → Must wait for Task Group 1 to complete
- `Dependencies: Task Groups 2, 3` → Must wait for both 2 and 3

### Step 3: Detect Implicit Dependencies

Read task descriptions and look for these keywords that indicate dependencies:

**Database Dependencies:**
- "using the [Model] model"
- "querying [Table]"
- "depends on [Model] existing"
→ Requires database task creating that model

**API Dependencies:**
- "calling the [endpoint] API"
- "hitting [endpoint]"
- "uses [endpoint] endpoint"
→ Requires API task creating that endpoint

**Component Dependencies:**
- "extends [Component]"
- "uses [Component] component"
- "wraps [Component]"
→ Requires UI task creating that component

**Service Dependencies:**
- "integrates with [Service]"
- "uses [Service] service"
- "calls [Service]"
→ Requires task creating that service

### Step 4: Build Dependency Graph

Create a mental model or write out:
```
Task 1 → no dependencies (can go first)
Task 2 → depends on Task 1
Task 3 → depends on Task 1
Task 4 → depends on Tasks 2, 3
Task 5 → depends on Task 4
```

### Step 5: Create Safe Batches

Group tasks into batches following these rules:

**Batching Rules:**
1. Tasks in the SAME batch have NO dependencies on each other
2. Tasks in the SAME batch have ALL their dependencies satisfied by PREVIOUS batches
3. Maximum 3 tasks per batch (token efficiency + manageable parallelism)
4. Tasks that modify the same files CANNOT be in the same batch
5. First batch typically contains foundation tasks (database, core services)

**Example Batching:**
```
BATCH 1: Foundation
  - Task 1: Database Models (no dependencies)

BATCH 2: API Layer (depends on Batch 1)
  - Task 2: Auth API (depends on Task 1 ✓)
  - Task 3: Posts API (depends on Task 1 ✓)
  - Task 4: Comments API (depends on Task 1 ✓)

BATCH 3: Frontend (depends on Batch 2)
  - Task 5: Auth UI (depends on Task 2 ✓)
  - Task 6: Posts UI (depends on Task 3 ✓)

BATCH 4: Testing (depends on all)
  - Task 7: Integration Tests (depends on all ✓)
```

### Step 6: Document Execution Plan

Create `gabe-os/specs/[this-spec]/planning/execution-batches.yml`:

```yaml
execution_plan:
  total_batches: 4
  estimated_time: "2-3 hours"
  estimated_tokens: "~10,000"

batches:
  - batch_number: 1
    name: "Foundation - Database Layer"
    estimated_tokens: 1500
    can_run_parallel: false
    tasks:
      - task_group: "Task Group 1: Data Models and Migrations"
        task_number: 1
        assigned_subagent: "database-engineer"
        dependencies_met: true
        reason: "No dependencies"

  - batch_number: 2
    name: "API Layer"
    estimated_tokens: 3500
    can_run_parallel: true
    max_parallel: 3
    tasks:
      - task_group: "Task Group 2: Authentication API"
        task_number: 2
        assigned_subagent: "api-engineer"
        dependencies_met: true
        reason: "Task 1 will complete in Batch 1"

      - task_group: "Task Group 3: Posts API"
        task_number: 3
        assigned_subagent: "api-engineer"
        dependencies_met: true
        reason: "Task 1 will complete in Batch 1"

  - batch_number: 3
    name: "Frontend Components"
    estimated_tokens: 3000
    can_run_parallel: true
    max_parallel: 2
    tasks:
      - task_group: "Task Group 4: Auth UI"
        task_number: 4
        assigned_subagent: "ui-designer"
        dependencies_met: true
        reason: "Task 2 will complete in Batch 2"

  - batch_number: 4
    name: "Testing & Quality"
    estimated_tokens: 1500
    can_run_parallel: false
    tasks:
      - task_group: "Task Group 5: Test Review"
        task_number: 5
        assigned_subagent: "testing-engineer"
        dependencies_met: true
        reason: "All implementation will be complete"
```

Display the execution plan to the user:
```
📊 EXECUTION PLAN CREATED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Total Batches: 4
Estimated Time: 2-3 hours
Estimated Tokens: ~10,000

BATCH 1: Foundation - Database Layer (Sequential)
  └─ Task 1: Data Models and Migrations [database-engineer]

BATCH 2: API Layer (3 tasks in parallel)
  ├─ Task 2: Authentication API [api-engineer]
  ├─ Task 3: Posts API [api-engineer]
  └─ Task 4: Comments API [api-engineer]

BATCH 3: Frontend Components (2 tasks in parallel)
  ├─ Task 5: Auth UI [ui-designer]
  └─ Task 6: Posts UI [ui-designer]

BATCH 4: Testing & Quality (Sequential)
  └─ Task 7: Integration Tests [testing-engineer]

Ready to begin implementation?
```

---

## PHASE 2: Execute Batches with Parallel Tasks and Quality Gates

FOR EACH BATCH in execution-batches.yml:

### Step 1: Pre-Batch Safety Check

Before launching any tasks in the batch:

1. **Verify previous batch completed**
   - Check that all tasks from previous batch are marked `[x]` in tasks.md
   - If not, STOP and report incomplete tasks

2. **Verify dependencies exist**
   - For each task in current batch, check its dependencies
   - If task needs a model, verify model file exists
   - If task needs an endpoint, verify controller/route exists
   - If dependencies missing, STOP and report

3. **Check for conflicts**
   - Ensure no two tasks in this batch will modify the same file
   - If conflict detected, STOP and suggest re-batching

**If safety check fails:**
```
❌ SAFETY CHECK FAILED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Issue: Task 3 requires User model, but it doesn't exist yet.

Dependency: Task 3 depends on Task 1 creating User model.
Status: Task 1 is not marked complete in tasks.md.

Action Required: Complete Task 1 before proceeding.

Cannot proceed with Batch 2 until dependencies are satisfied.
```

### Step 2: Launch Parallel Tasks

If batch has multiple tasks and `can_run_parallel: true`:

**Use a SINGLE message with MULTIPLE Task tool calls** to launch all tasks in parallel:

```markdown
I'm now launching Batch 2 with 3 tasks in parallel:
- Task 2: Authentication API (api-engineer)
- Task 3: Posts API (api-engineer)
- Task 4: Comments API (api-engineer)

[Then make 3 Task tool calls in one message]
```

For each task, provide the subagent with:

**Context:**
- The specific task group from tasks.md (parent task + all sub-tasks)
- The spec file: `gabe-os/specs/[this-spec]/spec.md`
- List of files created by previous batches (for context)

**Instructions:**
```
You are implementing Task Group [number]: [Title]

CRITICAL REMINDERS:
- Maximum 500 lines per file (split at 400 lines)
- Every function needs WHY/WHEN/HOW documentation
- Follow Single Responsibility Principle
- No code duplication (search for existing code first)
- Your work will be audited after this batch completes

Your tasks:
1. Implement all sub-tasks for this task group
2. Mark tasks complete in tasks.md (change [ ] to [x])
3. Create implementation report in implementation/ folder
4. Run only YOUR task's tests (not entire suite)

Spec: gabe-os/specs/[this-spec]/spec.md
Tasks: See Task Group [number] in gabe-os/specs/[this-spec]/tasks.md
```

### Step 3: Wait for Batch Completion

All tasks in the batch must complete before proceeding to audit.

Monitor for completion and handle any errors.

### Step 4: Quality Audit Gate

**Delegate to code-quality-auditor subagent:**

Provide context:
```
You are auditing Batch [number]: [Batch Name]

Tasks completed in this batch:
- Task [number]: [Title] (implementer: [agent])
- Task [number]: [Title] (implementer: [agent])

Spec location: gabe-os/specs/[this-spec]/

Your job:
1. Read implementation reports for this batch's tasks
2. Identify ALL files created/modified in this batch
3. Audit each file for CRITICAL violations:
   - File size > 500 lines
   - Missing WHY/WHEN/HOW documentation
   - Multiple responsibilities (SRP violation)
   - Code duplication (DRY violation)
   - Race conditions
   - Breaking changes without migration plan
4. Check integration between tasks in this batch
5. Run tests for this batch only
6. Generate audit report: verification/batch-[number]-quality-audit.md
7. Return APPROVE or REJECT status

Be ruthless. Production quality is non-negotiable.
```

### Step 5: Process Audit Results

**If auditor returns REJECT:**

```
❌ BATCH [number] REJECTED BY QUALITY AUDITOR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Critical violations found:

1. File size violation
   - features/auth/controllers/AuthController.ts: 687 lines (limit: 500)
   - Must split into: AuthController, PasswordController

2. Missing documentation
   - authenticateUser() function missing WHY/WHEN/HOW
   - generateToken() function missing WHY/WHEN/HOW

3. Code duplication
   - Email validation duplicated in 3 files
   - Extract to shared/utils/emailValidation.ts

Full audit report: gabe-os/specs/[this-spec]/verification/batch-2-quality-audit.md

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🛑 IMPLEMENTATION STOPPED

You must fix these violations before proceeding to Batch 3.

Options:
1. Fix violations manually, then re-run /implement-spec
2. Ask me to fix specific violations
3. Review audit report for detailed guidance
```

**STOP ALL PROGRESS. Do not proceed to next batch.**

**If auditor returns APPROVE or APPROVE WITH CONDITIONS:**

```
✅ BATCH [number] PASSED QUALITY AUDIT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

All critical standards met:
✓ All files under 500 lines
✓ Documentation complete (WHY/WHEN/HOW)
✓ No DRY violations
✓ No race conditions
✓ Tests passing

[If warnings exist:]
⚠️ Minor warnings (fix in next iteration):
- Task 2: AuthService approaching 380 lines (consider splitting soon)
- Task 3: Consider extracting pagination logic to utility

Full audit report: gabe-os/specs/[this-spec]/verification/batch-2-quality-audit.md

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Proceeding to Batch 3...
```

**Continue to next batch.**

### Step 6: Repeat for All Batches

Continue this cycle for each batch:
1. Safety check
2. Launch parallel tasks
3. Wait for completion
4. Quality audit
5. Process results (stop if rejected, continue if approved)

---

## PHASE 3: Delegate Verifications to Area-Specific Verifiers

After all batches complete successfully, delegate to area verifiers.

**(This phase remains unchanged from default implement-spec)**

1. Collect the list of subagent IDs that were delegated to in Phase 2.

2. Read `gabe-os/roles/implementers.yml` and find those subagent IDs. Collect the verifier role IDs specified in their `verified_by` field.

3. If there are verifier roles, ensure those verifiers are defined in `gabe-os/roles/verifiers.yml`.

4. If there are verifier roles, delegate to each verifier subagent:
   - Collect all task groups that fall under the purview of this verifier
   - Provide to the verifier:
     1. Details of those task groups (parent task and sub-tasks)
     2. The spec file: `gabe-os/specs/[this-spec]/spec.md` for context
   - Instruct the verifier:
     1. Read and analyze these tasks and where they fit in the context of this spec
     2. Run tests to verify implementation of these tasks
     3. Verify whether `gabe-os/specs/[this-spec]/tasks.md` has been updated to reflect these tasks' completeness
     4. Document your verification report and place this document in: `gabe-os/specs/[this-spec]/verification/`

---

## PHASE 4: Produce Final Verification Report

Use the **implementation-verifier** subagent to do its implementation verification and produce its final verification report.

**(This phase remains unchanged from default implement-spec)**

Provide to the subagent the following:
- The path to this spec: `gabe-os/specs/[this-spec]`

Instruct the subagent to do the following:
1. Run all of its final verifications according to its built-in workflow
2. Produce the final verification report in `gabe-os/specs/[this-spec]/verification/final-verification.md`

---

## Track Implementation Tokens

**After all batches and verifications complete, track token usage:**

```bash
# Estimate tokens from all verification files
VERIFICATION_TOKENS=$(estimate_tokens_from_files "$SPEC_PATH"/verification/*.md)
update_token_usage "$SPEC_PATH" "phase_5_implementation" "$VERIFICATION_TOKENS"

# Show final token usage summary
show_token_usage "$SPEC_PATH"
```

---

## Success Summary

Once all phases complete:

```
🎉 SPEC IMPLEMENTATION COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Spec: [Spec Title]
Total Batches: [number]
Total Tasks: [number]
Quality Audits: [number] (all passed)

Quality Metrics:
✓ All files under 500 lines
✓ 100% documentation coverage
✓ Zero DRY violations
✓ Zero race conditions
✓ All tests passing

Reports Generated:
- Batch quality audits: verification/batch-*-quality-audit.md
- Area verifications: verification/*-verifier.md
- Final verification: verification/final-verification.md

Next Steps:
1. Review verification reports
2. Update project roadmap
3. Deploy to staging
4. Run E2E tests
```
