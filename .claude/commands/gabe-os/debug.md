# Debug - Multi-Agent Debugging System

You are orchestrating a comprehensive debugging workflow that uses specialized subagents to identify, analyze, and fix issues efficiently.

**Each phase uses SUBAGENTS for context preservation** - context is passed via files on disk.

**Process Overview:**

PHASE 0: Issue identification with story-based questions
PHASE 0.5: Quick triage + git analysis (if recent breakage)
PHASE 1: Deep investigation (if needed)
PHASE 2: Theory generation
PHASE 3: Solution design
PHASE 4: Implementation
PHASE 5: Verification
PHASE 6: Loop if failed (max 3 attempts) or success

---

## PHASE 0: Issue Identification with Story-Based Questions

**Display to user:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 PHASE 0: Issue Identification
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Gathering details about the issue...
```

**Ask the following questions ONE AT A TIME. Wait for user response after each question before proceeding to the next.**

### Question 1 of 5: Expected Behavior

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❓ QUESTION 1 of 5: Expected Behavior
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

How SHOULD it work? Walk me through the happy path.

Example: "When I click the Login button, it should validate credentials
and navigate to /dashboard"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏸️  Expected behavior:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**STOP. Wait for user response. Save answer as EXPECTED_BEHAVIOR.**

---

### Question 2 of 5: Actual Behavior

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❓ QUESTION 2 of 5: Actual Behavior
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What's actually happening instead?

Example: "Nothing happens when I click the button" or "I get a 404 error"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏸️  Actual behavior:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**STOP. Wait for user response. Save answer as ACTUAL_BEHAVIOR.**

---

### Question 3 of 5: Timeline

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❓ QUESTION 3 of 5: Timeline
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

When did this start happening?

  (A) Just now (I made a change)
  (B) Today
  (C) This week
  (D) Always been broken
  (E) Used to work, not sure when it broke

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏸️  Your answer (A/B/C/D/E):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**STOP. Wait for user response. Save answer as TIMELINE.**

**IF answer is A (Just now), ask follow-up:**

```
🔍 Follow-up: Recent Changes

Did you just commit changes or modify code?

  (A) Yes - I changed [let me describe]
  (B) No changes - just started happening

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏸️  Your answer:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**STOP. If A selected, ask for description. Save to RECENT_CHANGES.**

**IF answer is E (Used to work, not sure when), ask follow-up:**

```
🔍 Follow-up: Timeline Estimate

Roughly when did it work?

  (A) A few days ago
  (B) A week or two ago
  (C) Weeks/months ago
  (D) No idea

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏸️  Your answer (A/B/C/D):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**STOP. Wait for response. Save to TIMELINE_ESTIMATE.**

---

### Question 4 of 5: Reproducibility

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❓ QUESTION 4 of 5: Reproducibility
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Can you reproduce this issue consistently?

  (A) Yes, every time
  (B) Sometimes (intermittent/random)
  (C) Only in specific scenarios

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏸️  Your answer (A/B/C):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**STOP. Wait for user response. Save answer as REPRODUCIBILITY.**

**IF answer is C (Specific scenarios), ask follow-up:**

```
🔍 Follow-up: Scenarios

What specific scenarios trigger the issue?

Example: "Only when user is logged out" or "Only on mobile devices"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏸️  Describe scenarios:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**STOP. Wait for response. Save to SPECIFIC_SCENARIOS.**

---

### Question 5 of 5: Scope

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❓ QUESTION 5 of 5: Scope
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Is this a UI issue, backend/API issue, or full-stack?

  (A) UI only (buttons, forms, display)
  (B) Backend/API only (server, database)
  (C) Full-stack (both UI and backend)
  (D) Not sure

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏸️  Your answer (A/B/C/D):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**STOP. Wait for user response. Save answer as SCOPE.**

---

### Confirm Understanding

**After collecting all answers, display summary for user confirmation:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ CONFIRMATION: Issue Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Got it! Let me confirm my understanding:

**Expected Behavior:**
[EXPECTED_BEHAVIOR]

**Actual Behavior:**
[ACTUAL_BEHAVIOR]

**Timeline:** [Translate TIMELINE letter to text - e.g., "Just now (recent change)"]
[If RECENT_CHANGES exists, show it]
[If TIMELINE_ESTIMATE exists, show it]

**Reproducibility:** [Translate REPRODUCIBILITY letter to text - e.g., "Yes, every time"]
[If SPECIFIC_SCENARIOS exists, show it]

**Scope:** [Translate SCOPE letter to text - e.g., "Full-stack (UI + backend)"]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Is this correct?

  (A) Yes, start debugging!
  (B) No, let me correct something

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏸️  Your answer (A/B):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**STOP. Wait for user response.**

**IF B (No), ask what to correct:**

```
What would you like to correct?

  (A) Expected behavior
  (B) Actual behavior
  (C) Timeline
  (D) Reproducibility
  (E) Scope
  (F) Everything - start over

Your answer (A/B/C/D/E/F):
```

**STOP. Re-ask selected question(s) and return to confirmation.**

---

### Create Debug Session

**After user confirms (answer A), create debug session:**

```bash
# Create dated debug session folder
ISSUE_SLUG=$(echo "$ACTUAL_BEHAVIOR" | tr '[:upper:]' '[:lower:]' | sed 's/ /-/g' | sed 's/[^a-z0-9-]//g' | cut -c1-50)
DEBUG_SESSION_PATH="@gabe-os/debug-sessions/$(date +%Y-%m-%d-%H-%M)-$ISSUE_SLUG"
mkdir -p "$DEBUG_SESSION_PATH"
```

**Write debug-session.md directly (no subagent needed):**

```bash
cat > "$DEBUG_SESSION_PATH/debug-session.md" <<EOF
# Debug Session: $ISSUE_SLUG

**Started:** $(date -Iseconds)
**Status:** In Progress

## Issue Summary

**Expected Behavior:**
$EXPECTED_BEHAVIOR

**Actual Behavior:**
$ACTUAL_BEHAVIOR

**Timeline:**
- When: [Translate TIMELINE]
$(if [ -n "$RECENT_CHANGES" ]; then echo "- Recent changes: $RECENT_CHANGES"; fi)
$(if [ -n "$TIMELINE_ESTIMATE" ]; then echo "- Last worked: [Translate TIMELINE_ESTIMATE]"; fi)

**Reproducibility:**
- Type: [Translate REPRODUCIBILITY]
$(if [ -n "$SPECIFIC_SCENARIOS" ]; then echo "- Scenarios: $SPECIFIC_SCENARIOS"; fi)

**Scope:**
[Translate SCOPE]

---

## Investigation Notes
[To be filled by subsequent phases]
EOF
```

**Display completion:**
```
✅ PHASE 0 COMPLETE: Issue Identification

Debug session created: $DEBUG_SESSION_PATH/

Proceeding to Phase 0.5: Quick Triage + Git Analysis
```

**Phase 0 Output:**
- Debug session created at `@gabe-os/debug-sessions/YYYY-MM-DD-HH-MM-issue-name/`
- `debug-session.md` contains all issue details (source of truth)
- Timeline answer determines git analysis strategy in Phase 0.5

---

## PHASE 0.5: Quick Triage + Git Analysis

**Purpose:** Fast-path for obvious issues and recent regressions. Save massive time if it's a simple fix or recent change.

### Step 1: Git History Analysis (Conditional)

**ONLY run git analysis if timeline indicates recent breakage:**

**IF user said "just now" (Question 3 = 1):**

```bash
# Check for uncommitted changes
git status

# Check last commit
git log -1 --name-only

# Show diff of last commit
git diff HEAD~1..HEAD
```

Show to user:
```
⚡ Git Analysis: Recent Changes Found

Last commit: [commit hash] "[commit message]"
Changed [X] minutes ago

Files modified:
  • [file1]
  • [file2]
  • [etc]

These changes are very likely related to the issue.
Focusing investigation on these files first.
```

**IF user said "today" (Question 3 = 2):**

```bash
# Check today's commits
git log --since="today" --name-only --oneline

# Show diff of today's commits
git diff HEAD~10..HEAD
```

Show files changed today, ask if any seem related.

**IF user said "this week" (Question 3 = 3):**

```bash
# Check this week's commits
git log --since="1 week ago" --name-only --oneline
```

Show files changed this week, ask user: "Any of these files related to the issue?"

**IF user said "used to work" (Question 3 = 5):**

Ask: "Would you like me to use git bisect to find the commit that broke it?"
- If yes: Offer to run git bisect (manual process, explain to user)
- If no: Proceed without git analysis

**IF user said "always been broken" (Question 3 = 4):**

Skip git analysis entirely. Note in debug-session.md:
```
Timeline: Always been broken (not a regression)
Git analysis: Skipped - this is a design/implementation gap
```

### Step 2: Quick Diagnostics

Run quick automated checks:

**For TypeScript/JavaScript projects:**
```bash
# Use IDE diagnostics tool if available
mcp__ide__getDiagnostics
```

Check for:
- Syntax errors
- Type errors
- Undefined variables
- Missing imports
- Unused variables/imports

**For UI issues:**
- Check if browser console logs are available
- Look for error messages
- Check for common UI patterns (onClick, event handlers, state)

**For API issues:**
- Check if route exists
- Check for authentication requirements
- Check for CORS issues

### Step 3: Pattern Matching

Based on issue description, check common culprits:

**If "stale data" or "not updating":**
- Missing dependencies in useEffect
- Race conditions in async calls
- Cache invalidation issues

**If "button not working" or "click not responding":**
- onClick handler missing/misnamed
- Event propagation issues
- Disabled state logic
- TypeScript errors in handler

**If "API error" or "network issue":**
- Check network tab
- Verify route exists
- Check authentication
- Verify request body/headers

**If "redirect not working" or "navigation broken":**
- Check router configuration
- Check navigation function typos
- Check route parameters

### Step 4: Report Quick Triage Findings

**IF obvious issue found:**

```
⚡ Quick Triage Found Potential Issue!

Issue: [Description of what was found]
Location: [File path:line number]
Confidence: [High/Medium/Low]

[Show code snippet if helpful]

Is this causing your issue?
[Yes - fix it now] [No - investigate deeper] [Not sure - show me more]
```

**IF user says "Yes":**
- Save finding to debug-session.md
- Skip to PHASE 4 (Implementation) with this fix
- After implementation, go to PHASE 5 (Verification)

**IF user says "No" or "Not sure":**
- Save findings to debug-session.md as potential leads
- Continue to PHASE 1 (Deep Investigation)

**IF no obvious issues found:**

```
⚡ Quick Triage Complete

No obvious syntax/type errors found.
No clear red flags in recent changes.

Proceeding with deep investigation...
```

Continue to PHASE 1.

---

## PHASE 1: Deep Investigation

**Purpose:** Ground-up analysis of ALL related code to understand what IS happening vs what SHOULD happen.

**Only run if PHASE 0.5 didn't find the issue.**

Use the **debug-investigator** subagent for comprehensive analysis.

Provide the investigator with:
- Debug session folder path
- debug-session.md (user's story, expected vs actual)
- Files from git analysis (if recent breakage)
- Issue scope (UI/backend/full-stack)

The investigator will:
1. Read all related code from ground up
2. Trace execution flow
3. Try to reproduce the issue (use Playwright for UI issues)
4. Document what the code IS doing
5. Compare with what it SHOULD do (from user's story)
6. Identify discrepancies

The investigator saves findings to `investigation-report.md`:

```markdown
# Investigation Report

## Related Files Analyzed
[List of all files examined]

## Execution Flow
[Step-by-step trace of what happens]

## What IS Happening
[Actual behavior observed in code]

## What SHOULD Happen
[Expected behavior from user story]

## Discrepancies Found
[Where actual diverges from expected]

## Reproduction Attempt
[Results of trying to reproduce issue]

## Key Findings
[Important discoveries]
```

After investigation completes, show summary to user:

```
📊 Deep Investigation Complete

Files analyzed: [X] files
Key findings: [Brief summary]

Moving to theory generation...
```

---

## PHASE 2: Theory Generation

**Purpose:** Generate ranked theories of what's wrong based on investigation findings.

Use the **debug-theorist** subagent for hypothesis generation.

Provide the theorist with:
- Debug session folder path
- debug-session.md (user's story)
- investigation-report.md (findings)
- Reproducibility info (consistent/intermittent)
- Timeline (recent change vs always broken)

The theorist will:
1. Analyze investigation findings
2. Consider common bug patterns:
   - Race conditions
   - State management issues
   - Timing problems
   - Type errors
   - Logic errors
   - Missing error handling
   - Incorrect assumptions
3. Generate multiple theories
4. Rank theories by likelihood
5. Provide evidence for each theory

The theorist saves findings to `theories.md`:

```markdown
# Debug Theories

## Theory 1: [Most Likely] - [Confidence: 85%]
**Hypothesis:** [What's wrong]
**Evidence:** [Why we think this]
**How to test:** [How to verify]

## Theory 2: [Likely] - [Confidence: 60%]
**Hypothesis:** [What's wrong]
**Evidence:** [Why we think this]
**How to test:** [How to verify]

## Theory 3: [Possible] - [Confidence: 30%]
**Hypothesis:** [What's wrong]
**Evidence:** [Why we think this]
**How to test:** [How to verify]
```

Show top 3 theories to user:

```
🔍 Generated [X] Theories

Top theories (ranked by likelihood):

1. [Theory 1 - High confidence]
   Evidence: [Brief evidence]

2. [Theory 2 - Medium confidence]
   Evidence: [Brief evidence]

3. [Theory 3 - Low confidence]
   Evidence: [Brief evidence]

Would you like to:
[1] Proceed with Theory 1 (most likely)
[2] Pick a different theory
[3] Investigate all theories
```

Wait for user choice. Continue with selected theory/theories.

---

## PHASE 3: Solution Design

**Purpose:** Design fix that is EFFICIENT, CLEAN, LEAN, MODULAR, and follows DRY principle.

Use the **debug-solution-architect** subagent for solution design.

Provide the solution-architect with:
- Debug session folder path
- debug-session.md (user's story)
- investigation-report.md (what IS happening)
- theories.md (selected theory to fix)
- gabe-os/standards/ (coding standards)

The solution-architect will:
1. Design immediate fix for the selected theory
2. Design prevention strategy (how to prevent this class of bug)
3. Ensure solution follows standards:
   - 500-line file limits
   - DRY principle (reuse existing code)
   - Modularity (single responsibility)
   - WHY/WHEN/HOW documentation
4. Consider multiple solution approaches
5. Rank solutions by trade-offs

The solution-architect saves to `solution-plan.md`:

```markdown
# Solution Plan

## Selected Theory
[Theory being addressed]

## Immediate Fix

### Approach 1: Quick Fix (Recommended)
**What:** [Description of fix]
**Where:** [Files to modify]
**How:** [Implementation approach]
**Pros:** [Benefits]
**Cons:** [Drawbacks]
**Effort:** [Time estimate]

### Approach 2: Proper Fix
**What:** [Description of fix]
**Where:** [Files to modify]
**How:** [Implementation approach]
**Pros:** [Benefits]
**Cons:** [Drawbacks]
**Effort:** [Time estimate]

## Prevention Strategy

**To prevent this class of bug:**
- Add TypeScript type: [specific type]
- Add test case: [specific test]
- Add validation: [specific check]
- Refactor pattern: [specific refactor]

## Standards Compliance

- File size: [Within/Exceeds 500-line limit]
- DRY: [Reuses existing code at: paths]
- Modularity: [Single responsibility maintained]
- Documentation: [WHY/WHEN/HOW added]

## Recommendation

[Recommended approach with justification]
```

Show solution options to user:

```
💡 Solution Designed

Recommended approach: [Quick fix / Proper fix]

What: [Brief description]
Where: [Files to change]
Effort: [Time estimate]

Would you like to:
[1] Proceed with recommended solution
[2] See alternative approaches
[3] Proceed with fix + prevention (add tests/types)
[4] Let me decide
```

Wait for user approval before proceeding to implementation.

---

## PHASE 4: Implementation

**Purpose:** Execute the approved solution following standards.

Use the **debug-implementation** subagent for code changes.

Provide the implementation subagent with:
- Debug session folder path
- solution-plan.md (what to implement)
- User's approval/choice
- gabe-os/standards/ (ensure compliance)

The implementation subagent will:
1. Read all files that need modification
2. Make changes following the solution plan
3. Ensure standards compliance during implementation
4. Add WHY/WHEN/HOW comments for complex logic
5. Stay within 500-line limits (split files if needed)
6. Document all changes

The implementation subagent saves to `implementation-report.md`:

```markdown
# Implementation Report

## Changes Made

### File: [path/to/file1.ts]
**Lines modified:** [X-Y]
**Change:** [Description]
**Reason:** [Why this change fixes the issue]

### File: [path/to/file2.ts]
**Lines modified:** [X-Y]
**Change:** [Description]
**Reason:** [Why this change fixes the issue]

## Standards Compliance

- File sizes: [All within limits]
- DRY: [Reused code from: paths]
- Modularity: [Maintained single responsibility]
- Documentation: [Added WHY/WHEN/HOW comments]

## Prevention Measures Added

- [ ] TypeScript types added
- [ ] Tests added
- [ ] Validation added
- [ ] Refactoring completed

## Testing Recommendations

[How to verify the fix works]
```

Show implementation summary to user:

```
✅ Implementation Complete

Changes made:
  • [file1.ts] - [brief change description]
  • [file2.ts] - [brief change description]

Standards compliance: ✅ All checks passed

Moving to verification...
```

---

## PHASE 5: Verification

**Purpose:** Test that fix works, doesn't break anything, and handles edge cases.

Use the **debug-verification** subagent for comprehensive testing.

Provide the verification subagent with:
- Debug session folder path
- debug-session.md (how it SHOULD work)
- implementation-report.md (what was changed)
- Issue scope (UI/backend/full-stack)

The verification subagent will run multiple tests:

### Test 1: Primary Issue Resolution
**Does the fix solve the reported issue?**
- Compare against user's "how it SHOULD work" story
- For UI: Use Playwright to test actual behavior
- For API: Test the endpoint
- For full-stack: Test end-to-end

### Test 2: Regression Check
**Does the fix break anything else?**
- Run existing tests if they exist
- Check related functionality
- Verify similar features still work

### Test 3: Edge Cases
**Does the fix handle edge cases?**
- Test boundary conditions
- Test error scenarios
- Test unusual inputs

The verification subagent saves to `verification-report.md`:

```markdown
# Verification Report

## Test 1: Primary Issue Resolution
**Status:** [PASS/FAIL]
**Details:** [What was tested and results]

## Test 2: Regression Check
**Status:** [PASS/FAIL]
**Details:** [What was tested and results]

## Test 3: Edge Cases
**Status:** [PASS/FAIL]
**Details:** [What was tested and results]

## Overall Result
**All tests passed:** [YES/NO]

## Issues Found
[If any test failed, details here]
```

Show verification results to user:

```
🧪 Verification Complete

Test 1 (Primary fix): ✅ PASS
Test 2 (No regressions): ✅ PASS
Test 3 (Edge cases): ✅ PASS

[If Playwright was used]:
Playwright test results: [Show screenshots/video]

The fix works as expected! ✨
```

---

## PHASE 6: Loop or Success

### IF All Tests Pass:

```
✅ Debug Session Complete!

Summary:
  • Issue: [Brief description]
  • Root cause: [Theory that was correct]
  • Fix: [What was changed]
  • Tests: All passed ✅

Would you like to:
[1] Commit these changes
[2] See detailed reports
[3] Done
```

**IF user says "Commit":**
- Show git diff
- Ask for commit message or suggest one
- Create commit
- Done!

**Save successful pattern** to `@gabe-os/debug-patterns/` for future learning:

```markdown
# Debug Pattern: [Issue Type]

**Symptom:** [What user reported]
**Root cause:** [What was actually wrong]
**Solution:** [How it was fixed]
**Prevention:** [How to avoid in future]
**Keywords:** [Searchable terms]
```

### IF Any Test Fails:

Increment loop counter. Check if loop_count < 3.

**IF loop_count < 3:**

```
⚠️ Verification Failed

The fix didn't fully solve the issue.

What failed: [Test that failed]
New findings: [What we learned]

Attempt [X] of 3. Generating new theories with updated information...
```

Update debug-session.md with loop information:

```markdown
## Loop [X]

**Previous attempt:**
- Theory tried: [Theory 1]
- Solution tried: [Solution approach]
- Result: FAILED - [Why it failed]

**New information:**
[What we learned from failure]

**Proceeding with:**
Theory: [New or revised theory]
```

Go back to PHASE 2 (Theory Generation) with:
- Exclude failed theory
- Add new findings from verification failure
- Consider alternative theories

**IF loop_count >= 3:**

```
🛑 Debug Session: 3 Attempts Exhausted

I've tried 3 different approaches but haven't fully solved the issue.

Here's everything I learned:

Attempt 1: [Theory + Result]
Attempt 2: [Theory + Result]
Attempt 3: [Theory + Result]

Common factor: [If pattern found]

What would you like to do:
[1] Try a completely different approach (manual guidance)
[2] Show me all the code and reports for manual debugging
[3] Create detailed bug report with all findings
[4] Take a break and revisit later
```

Save exhaustive debug session for future reference.

---

## Important Notes

1. **User is always in control** - They can stop, skip phases, or provide guidance at any point

2. **Subagents preserve context** - Each subagent reads from files, writes to files, infinite context

3. **Learning system** - Successful debugs are saved as patterns for future reference

4. **Standards enforcement** - All fixes must follow Gabe-OS standards (500-line, DRY, modular)

5. **Multi-level verification** - Don't trade one bug for another

6. **Git-aware** - Uses version control history to narrow investigation scope

7. **User stories are truth** - Not specs, not tests, but what user says SHOULD happen

---

## Debug Session File Structure

```
@gabe-os/debug-sessions/YYYY-MM-DD-HH-MM-issue-name/
├── debug-session.md          ← User's story (source of truth)
├── investigation-report.md   ← What IS happening (ground up)
├── theories.md               ← Hypotheses (ranked by likelihood)
├── solution-plan.md          ← Proposed fixes (with tradeoffs)
├── implementation-report.md  ← What was changed
└── verification-report.md    ← Test results
```

Clean, focused, complete context for debugging!
