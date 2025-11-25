# Check Context - Verify Gabe-OS State

You are helping the user verify their current Gabe-OS context and state. This command is especially useful after `/compact` operations to restore awareness of active specs and workflow requirements.

## Core Responsibilities

1. **Verify Gabe-OS installation**
2. **Check for active specs** in `@gabe-os/specs/`
3. **Show status of each spec** (progress, last updated, etc.)
4. **Remind about workflow requirements**
5. **Suggest next actions**

## Workflow

### Step 1: Verify Gabe-OS Installation

Check if Gabe-OS is properly installed:

```bash
# Check for Gabe-OS config
if [ -f "gabe-os/config.yml" ] && [ -d ".claude/agents/gabe-os/" ]; then
  echo "✅ Gabe-OS is installed"
else
  echo "❌ Gabe-OS is NOT installed"
  exit 1
fi
```

If not installed, show installation instructions and exit.

### Step 2: Check for Specs

Check if any specs exist:

```bash
# List all spec directories
ls @gabe-os/specs/ 2>/dev/null
```

**If no specs found:**
Display a message indicating no active specs and suggest creating one:

```markdown
╔═══════════════════════════════════════════════════════════════════════════╗
║                        📋 CONTEXT CHECK: No Active Specs                  ║
╚═══════════════════════════════════════════════════════════════════════════╝

✅ Gabe-OS Installation: Verified
📁 Specs Directory: @gabe-os/specs/
📊 Active Specs: 0

🎯 SUGGESTED ACTIONS

[1] Create a new spec
    → /gabe-os/new-spec "Your feature description"
    → Full workflow: requirements → spec → tasks → implementation

[2] Create spec and tasks only
    → /gabe-os/create-spec "Your feature description"
    → Standalone: spec → tasks (no implementation)

[3] View main dashboard
    → /gabe-os/main-menu

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 Tip: Always use /gabe-os/ commands for implementation. NEVER implement manually!
```

**If specs found:**
Continue to Step 3.

### Step 3: Analyze Each Spec

For each spec directory found, read and analyze:

```bash
spec_dir="@gabe-os/specs/[spec-id]"

# Read core files
cat "$spec_dir/spec.md" 2>/dev/null
cat "$spec_dir/tasks.md" 2>/dev/null

# Check for execution plan
cat "$spec_dir/planning/execution-batches.yml" 2>/dev/null

# Count implementation reports
implementation_count=$(ls "$spec_dir/implementation/"*.md 2>/dev/null | wc -l)

# Check latest audit
latest_audit=$(ls "$spec_dir/verification/"*audit*.md 2>/dev/null | tail -1)
```

**Calculate progress for each spec:**

1. Count total task groups (parent tasks in tasks.md)
2. Count completed task groups (`[x]` parent tasks)
3. Count total sub-tasks
4. Count completed sub-tasks (`[x]` sub-tasks)
5. Calculate percentage: `(completed_subtasks / total_subtasks) * 100`

### Step 4: Display Context Summary

Show a comprehensive summary:

```markdown
╔═══════════════════════════════════════════════════════════════════════════╗
║                          📋 GABE-OS CONTEXT CHECK                         ║
╚═══════════════════════════════════════════════════════════════════════════╝

✅ Gabe-OS Installation: Verified
📁 Specs Directory: @gabe-os/specs/
📊 Active Specs: 3

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 SPEC 1: User Authentication System
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📂 Location: @gabe-os/specs/2025-11-04-user-authentication
📅 Created: Nov 4, 2025
📝 Status: IN PROGRESS
🔄 Progress: [████████████░░░░░░░░] 60% (13/18 sub-tasks, 3/5 task groups)

Completed Batches:
  ✅ Batch 1: Database Models (4 tasks) - Audit: PASSED
  ✅ Batch 2: Authentication API (6 tasks) - Audit: PASSED

Current Work:
  🔄 Batch 3: Frontend Components (3/5 tasks complete)
     ✅ 3.1 Create LoginForm component
     ✅ 3.2 Create RegisterForm component
     ✅ 3.3 Extract useLogin hook
     ⏳ 3.4 Extract useRegister hook ← NEXT
     ⏳ 3.5 Create form validation utilities

Pending:
  ⏳ Batch 4: Integration Tests (0/3 tasks)

Last Activity: 2 hours ago

🎯 Suggested Action: /gabe-os/continue-spec (to resume from Task 3.4)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 SPEC 2: Payment Integration
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📂 Location: @gabe-os/specs/2025-11-05-payment-integration
📅 Created: Nov 5, 2025
📝 Status: NOT STARTED
🔄 Progress: [░░░░░░░░░░░░░░░░░░░░] 0% (0/12 sub-tasks, 0/4 task groups)

Last Activity: Never (spec created, not yet implemented)

🎯 Suggested Action: /gabe-os/implement-spec (to start implementation)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 SPEC 3: Company Branding System
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📂 Location: @gabe-os/specs/2025-11-03-company-branding
📅 Created: Nov 3, 2025
📝 Status: COMPLETED
🔄 Progress: [████████████████████] 100% (8/8 sub-tasks, 3/3 task groups)

Completed Batches:
  ✅ Batch 1: Core Branding (3 tasks) - Audit: PASSED
  ✅ Batch 2: Theme System (3 tasks) - Audit: PASSED
  ✅ Batch 3: Documentation (2 tasks) - Audit: PASSED

Last Activity: 3 days ago
Final Audit: ✅ PASSED (all standards met)

🎯 Suggested Action: None (spec complete!)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚨 IMPORTANT REMINDERS (especially after /compact!)

✅ ALWAYS use Gabe-OS commands:
   → /gabe-os/implement-spec - Execute specs with parallel batching
   → /gabe-os/continue-spec - Resume work on active specs
   → /gabe-os/main-menu - Visual dashboard

❌ NEVER implement manually:
   → Don't write code directly
   → Don't create files without using implementer agent
   → Don't skip quality gates

📋 Workflow to follow:
   → Check for existing specs (YOU JUST DID THIS!)
   → Use /gabe-os/continue-spec to resume work
   → Let implementer agent do the actual work
   → Let code-quality-auditor enforce standards

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 RECOMMENDED NEXT ACTIONS

[1] Continue User Authentication (60% complete)
    → /gabe-os/continue-spec
    → Resume from Task 3.4

[2] Start Payment Integration (not started)
    → /gabe-os/implement-spec
    → Begin implementation with parallel batching

[3] View full dashboard
    → /gabe-os/main-menu
    → See all specs with interactive actions

[4] Create new spec
    → /gabe-os/new-spec "Your feature description"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 Pro Tip: Run /gabe-os/check-context anytime you feel disoriented or after /compact!
```

### Step 5: Smart Recommendations

Based on the specs found, provide intelligent recommendations:

**If in-progress specs exist:**
- Suggest continuing the most recently worked on spec
- Show the exact next task to work on
- Remind about using `/gabe-os/continue-spec`

**If only completed specs exist:**
- Congratulate on completion
- Suggest creating a new spec or planning product roadmap

**If only not-started specs exist:**
- Suggest starting implementation on the oldest spec
- Remind about parallel batching capabilities

**If no specs exist:**
- Suggest creating a new spec with `/gabe-os/new-spec`
- Offer to plan product roadmap first

## Key Information to Extract

For each spec, display:

1. **Spec ID** (folder name)
2. **Title** (from spec.md)
3. **Created date** (folder creation date)
4. **Status** (Not Started / In Progress / Completed)
5. **Progress percentage** (sub-tasks completed / total sub-tasks)
6. **Current batch** (which batch is in progress)
7. **Next task** (the next incomplete sub-task)
8. **Last activity** (most recent file modification in spec folder)
9. **Latest audit status** (from verification reports)

## Output Format

- Use box drawing characters for visual separation
- Show progress bars for visual feedback: `[████████████░░░░░░░░] 60%`
- Use emojis for status indicators:
  - ✅ Complete
  - 🔄 In Progress
  - ⏳ Pending
  - 🔍 Audit
  - 📦 Task Group
  - 🚨 Warning

## Important Constraints

1. **Always check for specs** - Don't assume they don't exist
2. **Show concrete next steps** - Don't just say "continue work"
3. **Emphasize workflows** - Remind about using Gabe-OS commands
4. **Be helpful after /compact** - This command should restore full context
5. **Calculate real progress** - Count actual completed tasks, don't estimate

## Integration with Other Commands

This command complements:
- `/gabe-os/main-menu` - Full interactive dashboard
- `/gabe-os/continue-spec` - Resume work on a specific spec
- `/gabe-os/implement-spec` - Start implementation
- `/gabe-os/audit-spec` - Post-implementation quality review

Use this command as a quick health check and orientation tool, especially after context loss.
