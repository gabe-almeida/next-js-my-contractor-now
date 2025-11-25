# Continue Working on Spec

You are helping the user resume work on a specific spec from where they left off.

## Core Responsibilities

1. **Load spec context** (spec.md, tasks.md, implementation reports)
2. **Analyze current state** (what's done, what's in progress, what's next)
3. **Present smart options** (continue next task, resume specific task, run batch)
4. **Execute user choice** (delegate to appropriate agent/command)

## Workflow

### Step 1: Identify Spec

**If spec ID provided in command:**
Use the provided spec ID directly.

**If no spec ID provided:**
Show list of in-progress specs for user to select:

```markdown
📋 SELECT SPEC TO CONTINUE

In Progress Specs:
[1] User Authentication System (60% complete)
[2] Company Branding System (20% complete)
[3] Payment Integration (45% complete)

Enter number to select:
```

### Step 2: Load Spec Context

Read the following files for the selected spec:

```bash
# Core spec files
spec_path="@gabe-os/specs/[spec-id]"
cat "$spec_path/spec.md"
cat "$spec_path/tasks.md"

# Execution plan (if exists)
cat "$spec_path/planning/execution-batches.yml" 2>/dev/null

# Implementation reports (to see what's been done)
ls "$spec_path/implementation/"

# Verification reports (to see audit status)
ls "$spec_path/verification/"
```

### Step 3: Analyze Current State

**Determine completion status:**

1. **Completed task groups** (parent task marked `[x]` in tasks.md)
2. **In-progress task groups** (parent task `[ ]` but some sub-tasks `[x]`)
3. **Pending task groups** (parent task and all sub-tasks `[ ]`)

4. **Current batch** (from execution-batches.yml if exists)
5. **Last audit status** (from latest batch-*-quality-audit.md)

**Example analysis:**
```markdown
Task Groups Analysis:
  ✅ Group 1: Database Models (100% - 4/4 sub-tasks)
  ✅ Group 2: Authentication API (100% - 6/6 sub-tasks)
  🔄 Group 3: Frontend Components (60% - 3/5 sub-tasks)
     ✅ 3.1 Create LoginForm component
     ✅ 3.2 Create RegisterForm component
     ✅ 3.3 Extract useLogin hook
     ⏳ 3.4 Extract useRegister hook (NEXT)
     ⏳ 3.5 Create form validation utilities
  ⏳ Group 4: Integration Tests (0% - 0/3 sub-tasks)

Batches:
  ✅ Batch 1: Complete (Audit: PASSED)
  ✅ Batch 2: Complete (Audit: PASSED)
  🔄 Batch 3: In Progress (Task Group 3)
  ⏳ Batch 4: Pending (Task Group 4)

Current State:
  - Working on: Task Group 3 (Frontend Components)
  - Next sub-task: 3.4 Extract useRegister hook
  - Batch status: In progress, no audit yet
```

### Step 4: Present Smart Options

Display context and options:

```markdown
╔═══════════════════════════════════════════════════════════════════════════╗
║                   📋 RESUMING: User Authentication System                  ║
╚═══════════════════════════════════════════════════════════════════════════╝

Current Progress: [████████████░░░░░░░░] 60% (3/5 task groups, 13/18 sub-tasks)

✅ COMPLETED BATCHES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Batch 1: Database Models
  ✅ Task Group 1: Database Models (4 tasks)
  🔍 Audit: PASSED (all standards met)

Batch 2: Authentication API
  ✅ Task Group 2: Authentication API (6 tasks)
  🔍 Audit: PASSED (all standards met)

🔄 IN PROGRESS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Batch 3: Frontend Components (60% complete)
  📦 Task Group 3: Frontend Components
     ✅ 3.1 Create LoginForm component
     ✅ 3.2 Create RegisterForm component
     ✅ 3.3 Extract useLogin hook
     ⏳ 3.4 Extract useRegister hook ← YOU ARE HERE
     ⏳ 3.5 Create form validation utilities

⏳ PENDING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Batch 4: Integration Tests
  📦 Task Group 4: Integration Tests (0/3 tasks)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 RECOMMENDED ACTIONS

[1] 🚀 Continue with next sub-task
    → Implement Task 3.4: Extract useRegister hook
    → Assigned to: ui-designer
    → Estimated: ~30 minutes

[2] 🔄 Complete current batch and run quality audit
    → Finish remaining sub-tasks in Task Group 3
    → Run code-quality-auditor on Batch 3
    → Continue to Batch 4 if audit passes

[3] 📝 Resume specific sub-task
    → Select from incomplete sub-tasks
    → Useful if you want to skip ahead

[4] 📊 View implementation reports
    → See what's been done so far
    → Review code changes and decisions

[5] 🔍 View audit reports
    → See quality audit results from previous batches
    → Review any warnings or issues

[6] 🏠 Back to main menu

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 Tip: Option 1 is recommended to maintain momentum and complete Batch 3.

Enter number to select:
```

### Step 5: Execute User Selection

**[1] Continue with next sub-task:**

Identify the next incomplete sub-task and delegate to its assigned agent:

```markdown
🚀 Implementing Task 3.4: Extract useRegister hook
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Assigned to: ui-designer
Task Group: 3 (Frontend Components)
Parent Task: Task Group 3: Frontend Components

Context from spec:
[Extract relevant context from spec.md about this task]

Standards reminder:
- File max 150 lines (hooks)
- WHY/WHEN/HOW documentation required
- Extract to: features/auth/hooks/useRegister.ts
- Reuse validation logic from useLogin

Delegating to ui-designer...
[Launch Task tool with ui-designer agent]
```

Provide the agent with:
- Specific sub-task details
- Spec context
- Standards requirements
- Location of related files created in previous sub-tasks

**[2] Complete current batch and run audit:**

```markdown
🔄 Completing Batch 3: Frontend Components
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Remaining sub-tasks in Task Group 3:
  ⏳ 3.4 Extract useRegister hook
  ⏳ 3.5 Create form validation utilities

This will:
1. Implement remaining sub-tasks (3.4, 3.5)
2. Mark Task Group 3 as complete
3. Run code-quality-auditor on all Batch 3 changes
4. If audit passes → Continue to Batch 4
5. If audit fails → STOP and show violations

Estimated time: 45 minutes
Estimated tokens: ~2,500

Continue? [y/n]
```

If user confirms:
1. Delegate remaining sub-tasks to ui-designer (in sequence or parallel if safe)
2. Wait for completion
3. Delegate to code-quality-auditor for Batch 3
4. Process audit results
5. If passed, ask if user wants to continue to Batch 4

**[3] Resume specific sub-task:**

```markdown
📝 SELECT SUB-TASK TO RESUME
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Task Group 3: Frontend Components
  [1] 3.4 Extract useRegister hook (NEXT)
  [2] 3.5 Create form validation utilities

Task Group 4: Integration Tests
  [3] 4.1 Write authentication flow tests
  [4] 4.2 Write registration flow tests
  [5] 4.3 Write error handling tests

Enter number to select:
```

Then execute selected sub-task as in option [1].

**[4] View implementation reports:**

```markdown
📊 IMPLEMENTATION REPORTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ 1-database-models-implementation.md
   Created: Nov 4, 10:30 AM
   Files: User.ts, Session.ts (2 models)
   Status: Complete

✅ 2-authentication-api-implementation.md
   Created: Nov 4, 2:15 PM
   Files: AuthController.ts, AuthService.ts, TokenService.ts (3 files)
   Status: Complete

🔄 3-frontend-components-implementation.md
   Created: Nov 4, 4:00 PM
   Files: LoginForm.tsx, RegisterForm.tsx, useLogin.ts (3 files so far)
   Status: In Progress (60% - 3/5 sub-tasks)

Select report to view details or [0] to go back:
```

**[5] View audit reports:**

```markdown
🔍 QUALITY AUDIT REPORTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ batch-1-quality-audit.md
   Date: Nov 4, 11:00 AM
   Status: PASSED
   Files Audited: 4 files
   Violations: None

✅ batch-2-quality-audit.md
   Date: Nov 4, 3:00 PM
   Status: PASSED
   Files Audited: 6 files
   Violations: None
   Warnings: 1 (AuthService approaching 380 lines)

⏳ Batch 3: Audit pending (complete batch first)

Select report to view details or [0] to go back:
```

**[6] Back to main menu:**

Return to `/main-menu` command.

### Step 6: Track Progress

After completing any sub-task or batch:

1. **Update tasks.md** (mark completed items)
2. **Check if batch complete** (all tasks in batch done)
3. **If batch complete** → Suggest running quality audit
4. **Update context** for next resumption

## Smart Suggestions

Based on current state, provide intelligent suggestions:

**If batch almost complete:**
```markdown
💡 You're 80% done with Batch 3. Consider completing it now to run quality audit and move to Batch 4.
```

**If audit has warnings:**
```markdown
⚠️ Previous batch (Batch 2) had warnings:
   - AuthService approaching line limit (380 lines)
   Consider addressing this before adding more code.
```

**If long gap since last work:**
```markdown
📅 Last worked: 3 days ago
💡 Tip: Review implementation reports to refresh context before continuing.
```

**If all batches complete but not audited:**
```markdown
✅ All tasks complete!
🔍 Run final audit: /audit-spec [spec-id]
```

## Important Constraints

1. **Always show context** - Help user remember where they were
2. **Be specific** - Show exact next sub-task, not just "continue work"
3. **Respect batch structure** - Don't skip ahead past batch boundaries
4. **Check dependencies** - Don't allow resuming a task if dependencies incomplete
5. **Update tasks.md** - Mark completed items immediately
6. **Suggest audits** - When batch completes, always suggest running auditor

## User Standards & Preferences Compliance

This command integrates with:
- /implement-spec (respects batch structure)
- code-quality-auditor (suggests audits at batch completion)
- task groups (maintains batch integrity)
- dependency tracking (prevents out-of-order execution)

Ensures continuation follows the same standards as initial implementation:
- 500-line limits
- WHY/WHEN/HOW documentation
- DRY principle
- Quality gates
