# New Spec Process - Complete Feature Initialization

You are creating a complete, implementation-ready spec in ONE command. This process follows a strategic hybrid approach that analyzes the codebase intelligently at the right moments.

**Each phase uses SUBAGENTS for maximum context preservation** - context is passed via files on disk, not chat history.

**Process Overview:**

PHASE 0: Initialize spec folder (spec-initializer subagent)
PHASE 1: Quick analysis for informed questions (Explore subagent - in memory)
PHASE 2: Ask informed questions (spec-researcher subagent → requirements.md)
PHASE 3: Deep targeted analysis (codebase-analyzer subagent → codebase-analysis.md)
PHASE 4: Write technical specification (spec-writer subagent → spec.md with stories + standards)
PHASE 5: Create implementation tasks (task-list-creator subagent → tasks.md)
PHASE 6: Present results

**Final output: 4 essential files**
- requirements.md (WHAT to build, user needs)
- codebase-analysis.md (WHERE/WHY/HOW for codebase)
- spec.md (technical design with stories + standards)
- tasks.md (implementation tasks with file paths)

## Token Tracking

**This command tracks token usage at phase level for cost visibility.**

Use these helper functions throughout:

{{workflows/utilities/track-token-usage}}

Follow each phase IN SEQUENCE:

---

## PHASE 0: Initialize Spec Folder

**Display to user:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚙️  PHASE 0: Initializing Spec Folder
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Creating spec structure...
```

**Use the bash script to create spec structure** (saves ~8k tokens vs using agent):

```bash
# Run the init-spec script with user's feature description
SPEC_PATH=$(~/gabe-os/scripts/init-spec.sh "{{user_feature_description}}")
echo "✅ Spec folder created: $SPEC_PATH"
```

The script will:
- Create dated folder: `gabe-os/specs/YYYY-MM-DD-feature-name/`
- Set up directory structure (`planning/`, `planning/visuals/`, `implementation/`)
- Save the initial idea to `planning/initialization.md`
- Return the spec folder path

**Store the `$SPEC_PATH` variable** - you'll need it for all subsequent phases.

---

## PHASE 1: Quick Analysis for Informed Questions

**Display to user:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔄 PHASE 1: Quick Project Analysis
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Analyzing project structure to ask informed questions...
```

**Purpose:** Understand project structure to ask informed questions. Keep results IN MEMORY (don't save to file yet).

**Check if project has existing code:**
- Look for `/src`, `/app`, or similar code directories
- If empty project: Note "New project - no existing code" and skip to PHASE 2
- If existing code: Continue with quick analysis

Use the **Task tool** with Explore subagent:

```
Task(
  subagent_type="Explore",
  description="Quick project analysis",
  prompt="""
Quickly analyze this project to understand its structure.

THOROUGHNESS: quick (not very thorough)

QUESTIONS TO ANSWER:
1. What is the tech stack? (React/Vue/Next? TypeScript? Backend framework?)
2. What is the high-level folder structure? (where do components live? services? utilities?)
3. What are the main architectural patterns? (Controller/Service? Hooks? Context?)
4. What naming conventions are used? (PascalCase components? camelCase functions?)
5. Where are tests located? (alongside files? separate folder?)

Return a concise summary of findings.
"""
)
```

**Keep these findings in memory** - you'll pass them to spec-shaper in PHASE 2 so questions can reference actual project structure.

**Do NOT save to file** - this quick analysis will be merged with deep analysis in PHASE 3.

---

## PHASE 2: Interactive Requirements Gathering

**Display to user:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 PHASE 2: Requirements Gathering
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Asking targeted questions to understand requirements...
```

**Ask the following questions ONE AT A TIME. Wait for user response after each question before proceeding to the next.**

### Question 1 of 8: Feature Scope

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 QUESTION 1 of 8: Feature Scope
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What's the scope of this feature?

Options:
  (A) Small enhancement - Modify existing feature, minimal new code
  (B) Medium feature - New component/page, integrates with existing systems
  (C) Large feature - New subsystem, multiple components, significant integration
  (D) Complete module - Standalone functionality with full CRUD operations

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏸️  Your answer (A/B/C/D):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**STOP. Wait for user response. Save answer as ANSWER_1.**

---

### Question 2 of 8: Data Management

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 QUESTION 2 of 8: Data Management
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Does this feature require database changes?

Options:
  (A) No database changes - UI/logic only
  (B) Use existing tables - Query/modify existing data
  (C) New tables required - Create new database schema
  (D) Schema modifications - Alter existing tables (migrations needed)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏸️  Your answer (A/B/C/D):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**STOP. Wait for user response. Save answer as ANSWER_2.**

---

### Question 3 of 8: User Interface

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 QUESTION 3 of 8: User Interface
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What UI components are needed?

Options:
  (A) No UI changes - Backend/API only
  (B) Simple UI - Form, button, or basic display
  (C) Complex UI - Multiple components, state management, interactions
  (D) Full interface - Complete page/view with navigation and workflows

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏸️  Your answer (A/B/C/D):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**STOP. Wait for user response. Save answer as ANSWER_3.**

---

### Question 4 of 8: API Requirements

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 QUESTION 4 of 8: API Requirements
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What API endpoints are needed?

Options:
  (A) No new APIs - Use existing endpoints
  (B) 1-2 endpoints - Simple CRUD or action
  (C) 3-5 endpoints - Multiple operations with validation
  (D) Complex API - Full REST/GraphQL resource with relationships

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏸️  Your answer (A/B/C/D):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**STOP. Wait for user response. Save answer as ANSWER_4.**

---

### Question 5 of 8: Authentication & Authorization

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 QUESTION 5 of 8: Authentication & Authorization
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Who can access this feature?

Options:
  (A) Public - No authentication required
  (B) Any logged-in user - Basic authentication
  (C) Role-based - Specific user roles/permissions
  (D) Custom logic - Complex authorization rules

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏸️  Your answer (A/B/C/D):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**STOP. Wait for user response. Save answer as ANSWER_5.**

---

### Question 6 of 8: Testing Requirements

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 QUESTION 6 of 8: Testing Requirements
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What level of testing is needed?

Options:
  (A) Manual testing only - No automated tests
  (B) Unit tests - Test individual functions/components
  (C) Integration tests - Test feature workflows end-to-end
  (D) Comprehensive suite - Unit + integration + E2E tests

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏸️  Your answer (A/B/C/D):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**STOP. Wait for user response. Save answer as ANSWER_6.**

---

### Question 7 of 8: Error Handling

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 QUESTION 7 of 8: Error Handling
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

How should errors be handled?

Options:
  (A) Basic - Log errors, show generic message
  (B) User-friendly - Validate input, show helpful error messages
  (C) Comprehensive - Validation + retry logic + user guidance
  (D) Production-grade - Full error tracking + monitoring + recovery strategies

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏸️  Your answer (A/B/C/D):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**STOP. Wait for user response. Save answer as ANSWER_7.**

---

### Question 8 of 8: Performance Considerations

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 QUESTION 8 of 8: Performance Considerations
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Are there any performance considerations?

Options:
  (A) Standard performance - No special optimization needed
  (B) Caching needed - Cache frequent queries/computations
  (C) High volume - Optimize for many concurrent users/requests
  (D) Real-time - WebSockets, subscriptions, or live updates required

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏸️  Your answer (A/B/C/D):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**STOP. Wait for user response. Save answer as ANSWER_8.**

---

### Visual Assets & Similar Features

**After collecting all 8 answers, ask about visuals and code reuse:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📸 VISUAL ASSETS & CODE REUSE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Do you have any of the following?

1. **Design mockups or wireframes?**
   If yes, place them in: `[spec-path]/planning/visuals/`

2. **Similar existing features to reference?**
   If yes, provide file paths or feature names.

3. **Specific technical constraints or preferences?**
   If yes, briefly describe.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏸️  Your response:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**STOP. Wait for user response. Save answer as VISUALS_RESPONSE.**

**After receiving visual response, check for actual visual files:**

```bash
# Check for visual files regardless of user response
VISUAL_FILES=$(ls -la "$SPEC_PATH/planning/visuals/" 2>/dev/null | grep -E '\.(png|jpg|jpeg|gif|svg|pdf)$' || echo "")
```

---

### Generate Requirements Document

**Now call spec-shaper ONCE with all collected answers to write comprehensive requirements.md:**

Use the **Task tool** with explicit, well-structured prompt:

```
Task(
  subagent_type="spec-shaper",
  description="Process requirement answers",
  prompt="""
You are processing requirement answers to write comprehensive requirements.md.

SPEC FOLDER PATH: [paste $SPEC_PATH value]

FEATURE DESCRIPTION:
[paste user's feature description from initialization.md]

PROJECT CONTEXT (from Phase 1 quick analysis):
Tech Stack: [paste Phase 1 tech stack findings]
Folder Structure: [paste Phase 1 structure findings]
Key Patterns: [paste Phase 1 patterns findings]

REQUIREMENT ANSWERS:
1. Feature Scope: [paste ANSWER_1 with full option text]
2. Data Management: [paste ANSWER_2 with full option text]
3. User Interface: [paste ANSWER_3 with full option text]
4. API Requirements: [paste ANSWER_4 with full option text]
5. Authentication: [paste ANSWER_5 with full option text]
6. Testing: [paste ANSWER_6 with full option text]
7. Error Handling: [paste ANSWER_7 with full option text]
8. Performance: [paste ANSWER_8 with full option text]

VISUAL ASSETS:
User response: [paste VISUALS_RESPONSE]
Files found: [paste VISUAL_FILES if any, or "None"]

TASK: Write comprehensive requirements.md to [spec-path]/planning/requirements.md
"""
)
```

**Important:** Paste actual values, don't send variable names as-is

**After spec-shaper completes, track token usage:**

```bash
# Estimate tokens from requirements.md file
PHASE_2_TOKENS=$(estimate_tokens_from_file "$SPEC_PATH/planning/requirements.md")
update_token_usage "$SPEC_PATH" "phase_2_research" "$PHASE_2_TOKENS"
```

**Display completion message:**
```
✅ Requirements gathered and documented in planning/requirements.md
```

---

## PHASE 3: Deep Targeted Analysis

**Display to user:**
```
✅ PHASE 2 COMPLETE: Requirements Gathered

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 PHASE 3: Deep Targeted Analysis
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Analyzing codebase to identify WHERE and WHY code should be implemented...
```

**Purpose:** Now that we know WHAT to build, analyze WHERE and WHY it should be implemented. Combine with quick analysis from PHASE 1 into ONE comprehensive file.

**Only run if project has existing code** (skip if new/empty project)

Use the **Task tool** with codebase-analyzer subagent:

```
Task(
  subagent_type="codebase-analyzer",
  description="Analyze codebase for implementation",
  prompt="""
Analyze the codebase to determine WHERE and WHY code should be implemented.

SPEC FOLDER PATH: [paste $SPEC_PATH value]

FEATURE REQUIREMENTS:
[paste contents of planning/requirements.md]

QUICK ANALYSIS CONTEXT (from Phase 1):
Tech Stack: [paste Phase 1 tech stack]
Folder Structure: [paste Phase 1 structure]
Key Patterns: [paste Phase 1 patterns]

YOUR TASK:
1. Search for similar existing features specific to this feature type
2. Identify WHERE code should live (specific directories/files)
3. Document WHY code should go there (architectural reasons)
4. Find integration points (what existing code to hook into)
5. Document patterns to follow (naming, structure, conventions)
6. Recommend specific code to reuse vs create new

Write comprehensive analysis to: [spec-path]/planning/codebase-analysis.md
"""
)
```

**Save comprehensive analysis** to `[spec-path]/planning/codebase-analysis.md` (ONE file, not two):

```markdown
# Deep Targeted Analysis: [Feature Name]

## Similar Existing Features
[What similar code exists and where]

## Recommended Implementation Locations

### WHERE
- New component: /src/components/[feature]/[Component].tsx
- Service layer: /src/services/[Feature]Service.ts
- API endpoint: /src/api/[feature]/route.ts
- Types: /src/types/[feature].types.ts

### WHY
- Components go in /src/components/[feature]/ per project convention
- Services follow Controller→Service→Repository pattern
- API routes use Next.js app router structure
- Types are centralized in /src/types/

## Integration Points
- Hook into: /src/middleware/auth.ts for authentication
- Extend: /src/contexts/UserContext.tsx for user state
- Use: /src/utils/api.ts for API calls

## Patterns to Follow
- Use custom hooks for business logic (useFeature pattern)
- Component naming: [Feature][ComponentType].tsx
- Service naming: [Feature]Service.ts
- Test files alongside source: [name].test.ts

## Code to Reuse
- /src/utils/validation.ts for form validation
- /src/components/common/Form.tsx for form components
- /src/hooks/useApi.ts for API state management

## Recommendations
[Specific architectural recommendations for this feature]
```

**After codebase-analyzer completes, display:**
```
✅ Analysis complete: `planning/codebase-analysis.md` created
```

**After Phase 3 completes, track token usage:**

```bash
# Estimate tokens from codebase-analysis.md file
PHASE_3_TOKENS=$(estimate_tokens_from_file "$SPEC_PATH/planning/codebase-analysis.md")
update_token_usage "$SPEC_PATH" "phase_3_specification" "$PHASE_3_TOKENS"
```

---

## PHASE 4: Write Technical Specification with Stories + Standards

**Display to user:**
```
✅ PHASE 3 COMPLETE: Codebase Analysis

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 PHASE 4: Writing Technical Specification
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Creating comprehensive spec with user stories and standards...
```

Use the **Task tool** with spec-writer subagent:

```
Task(
  subagent_type="spec-writer",
  description="Write technical specification",
  prompt="""
Write a comprehensive technical specification with user stories and standards.

SPEC FOLDER PATH: [paste $SPEC_PATH value]

INPUT FILES:
- planning/requirements.md (read this for WHAT to build)
- planning/codebase-analysis.md (read this for WHERE/WHY/HOW)
- planning/visuals/ (reference any visual assets)

YOUR TASK: Create spec.md with:

**1. User Stories Section:**
- Who uses this feature and why
- Concrete examples of user workflows
- Acceptance criteria for each story

**2. Technical Architecture:**
- Overview of technical approach
- **Standards reminders sprinkled throughout:**
  - "Keep components under 500 lines (see gabe-os/standards/global/file-limits.md)"
  - "Follow DRY principle - reuse existing X component"
  - "Document WHY/WHEN/HOW for complex logic"
  - "Maintain modularity - single responsibility per file"

**3. Specific Implementation Details:**
- **File locations with WHY:** "Create /src/components/auth/LoginForm.tsx (components go in /src/components/[feature]/ per project convention)"
- **Existing code references:** "Extend /src/utils/validation.ts for form validation (lines 45-78 handle email validation)"
- **Integration points:** "Hook into /src/middleware/auth.ts (line 23) for authentication"
- **Routes to add:** "Add route in /src/routes/index.ts following pattern at lines 12-15"

**4. Component/API/Database Designs:**
- With references to similar existing code
- With standards reminders for each section

**5. Acceptance Criteria:**
- Linked back to user stories

Write spec to: [spec-path]/spec.md
"""
)
```

**After spec-writer completes, display:**
```
✅ Specification complete: `spec.md` created with user stories and standards
```

**After Phase 4 completes, track token usage:**

```bash
# Estimate tokens from spec.md file (the main specification document)
PHASE_4_TOKENS=$(estimate_tokens_from_file "$SPEC_PATH/spec.md")
update_token_usage "$SPEC_PATH" "phase_4_specification" "$PHASE_4_TOKENS"
```

---

## PHASE 5: Create Implementation Tasks

**Display to user:**
```
✅ PHASE 4 COMPLETE: Technical Specification

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 PHASE 5: Creating Implementation Tasks
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Breaking down spec into actionable tasks with file paths and dependencies...
```

Use the **Task tool** with task-list-creator subagent:

```
Task(
  subagent_type="task-list-creator",
  description="Create implementation tasks",
  prompt="""
Break down the specification into actionable implementation tasks.

SPEC FOLDER PATH: [paste $SPEC_PATH value]

INPUT FILES TO READ:
- spec.md (complete technical specification)
- planning/requirements.md (user needs and edge cases)
- planning/codebase-analysis.md (WHERE/WHY/HOW, existing code to reuse)

YOUR TASK: Create tasks.md with:
- Strategic task groups (organized into parallel execution batches)
- Parent/child task hierarchy with clear dependencies
- **Specific file paths in every task:** "Create /src/components/auth/LoginForm.tsx"
- **References to existing code:** "Use validation from /src/utils/validation.ts"
- **Standards compliance notes:** "Keep under 500 lines, split if needed"
- Clear checkboxes [ ] for progress tracking

Consider:
1. Database → API → UI → Tests dependency order
2. Parallel execution opportunities (independent tasks in same layer)
3. File size limits (500 lines max)
4. Code reuse from codebase analysis

Write tasks to: [spec-path]/tasks.md
"""
)
```

**After task-list-creator completes, display:**
```
✅ Tasks complete: `tasks.md` created with file paths and dependencies
```

**After Phase 5 completes, track token usage:**

```bash
# Estimate tokens from tasks.md file
PHASE_5_TOKENS=$(estimate_tokens_from_file "$SPEC_PATH/tasks.md")
update_token_usage "$SPEC_PATH" "phase_4_task_breakdown" "$PHASE_5_TOKENS"
```

---

## PHASE 6: Present Results

**Display token usage summary:**

```bash
# Show token usage summary
show_token_usage "$SPEC_PATH"
```

**Display to user - use this EXACT format:**

```
✅ PHASE 5 COMPLETE: Implementation Tasks

╔═══════════════════════════════════════════════════════════════════════════╗
║                  ✅ SPEC COMPLETE AND READY TO IMPLEMENT                  ║
╚═══════════════════════════════════════════════════════════════════════════╝

📁 Spec Location:
   `[full-spec-path]`

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 ANALYSIS SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   • Tech Stack: [Framework, language, key libraries identified]
   • Requirements: [X] questions answered, [Y] visuals provided
   • Codebase Analysis: [Brief summary of key findings]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📄 FILES CREATED (4 Essential Files)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   • `planning/requirements.md`
     → User needs and detailed requirements

   • `planning/codebase-analysis.md`
     → WHERE/WHY/HOW with existing code references

   • `spec.md`
     → Technical specification with user stories + standards reminders

   • `tasks.md`
     → Implementation tasks with specific file paths

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 KEY IMPLEMENTATION INSIGHTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   • Code Locations: [Specific directories with WHY]
   • Integration Points: [Existing systems with file paths + line numbers]
   • Patterns to Follow: [Identified conventions with examples]
   • Code to Reuse: [Specific existing components/utilities with paths]
   • Standards: 500-line limits, WHY/WHEN/HOW docs, DRY, modularity enforced

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚀 NEXT STEPS:

   [1] Implement the spec
       Run: /implement-spec

   [2] Track progress
       Run: /main-menu

   [3] Review files
       Open: [spec-path]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Expected Final Output

```
@gabe-os/specs/YYYY-MM-DD-feature-name/
├── planning/
│   ├── requirements.md               ← WHAT to build (user needs, Q&A answers)
│   ├── codebase-analysis.md          ← WHERE/WHY/HOW (structure + targeted analysis)
│   └── visuals/                      ← Screenshots, designs (if provided)
├── spec.md                           ← Technical spec with stories + standards
└── tasks.md                          ← Implementation tasks with file paths
```

**Result: 4 essential files**
- **requirements.md** - User needs and detailed requirements
- **codebase-analysis.md** - Project context + WHERE/WHY/HOW + existing code references
- **spec.md** - Technical specification with user stories + standards reminders + file paths
- **tasks.md** - Implementation tasks with specific file paths + reuse references + standards notes

**ONE command creates a complete, context-aware, implementation-ready spec!**

Each phase uses SUBAGENTS → context preserved via files → infinite context window → no bloat!
