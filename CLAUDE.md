# Gabe-OS - Production-Grade AI Development System

<!--
⚠️ AI AGENTS: This is a TEMPLATE file!
When updating the version in this file, you MUST also:
1. Update version in /Users/Gabe/Dev/Gabe-OS/config.yml (line 1)
2. Run ./scripts/base-install.sh to propagate changes
3. Commit with version info in message
📋 READ: VERSION-UPDATE-CHECKLIST.md
-->

---

## ⚠️ IMPORTANT: This Project Uses Gabe-OS!

**ALWAYS use Gabe-OS workflows and commands for this project.**

**Critical reminders:**
- ✅ Use `/gabe-os/implement-spec` to implement features (NOT manual implementation)
- ✅ Check `@gabe-os/specs/` directory for existing specs
- ✅ Follow the spec → implement → verify workflow
- ✅ Quality gates enforce standards automatically

**Quick commands:**
- `/gabe-os/main-menu` - See all specs and progress
- `/gabe-os/continue-spec` - Resume work on a spec
- `/gabe-os/implement-spec` - Execute spec with parallel batching

**If you forget after a `/compact`:** Re-read this section!

---

# ⚠️⚠️⚠️ CRITICAL: DRY PRINCIPLES & REUSABILITY ⚠️⚠️⚠️

**BEFORE creating ANY new code, you MUST:**

## 🔍 Step 1: Search for Existing Code

```bash
# Search for similar functions
grep -r "function.*<functionality>" src/

# Search for similar routes
grep -r "route.*<endpoint>" src/

# Search for similar components
find . -name "*<ComponentName>*"

# Search for similar utilities
grep -r "export.*<utilityName>" src/utils/
```

## ❌ NEVER Create New When Existing Code Does This

**Anti-patterns to avoid:**
- ❌ Creating new route handlers when existing routes can be parameterized
- ❌ Writing new utility functions when similar ones exist
- ❌ Duplicating validation logic across multiple files
- ❌ Creating new components when existing ones can be composed
- ❌ Copy-pasting code instead of extracting to shared utilities

**Example of WRONG approach:**
```typescript
// ❌ BAD: Creating duplicate authentication checks
// In file1.ts
if (!req.user || !req.user.isAdmin) { throw new Error('Unauthorized'); }

// In file2.ts
if (!req.user || !req.user.isAdmin) { throw new Error('Unauthorized'); }

// In file3.ts
if (!req.user || !req.user.isAdmin) { throw new Error('Unauthorized'); }
```

**Example of RIGHT approach:**
```typescript
// ✅ GOOD: Extract to shared middleware
// In src/middleware/auth.ts
export const requireAdmin = (req, res, next) => {
  if (!req.user || !req.user.isAdmin) {
    throw new Error('Unauthorized');
  }
  next();
};

// In routes - just reference it
app.get('/admin/users', requireAdmin, getUsers);
app.post('/admin/settings', requireAdmin, updateSettings);
app.delete('/admin/data', requireAdmin, deleteData);
```

## ✅ Always Ask These Questions FIRST

Before writing ANY code:

1. **Does this functionality already exist?**
   - Search codebase for similar functions/routes/components
   - Check utils/, middleware/, services/, helpers/

2. **Can existing code be made more generic?**
   - Can a function take parameters instead of creating new version?
   - Can a route be parameterized instead of duplicated?

3. **Should this be extracted to shared code?**
   - Will this logic be used in 2+ places?
   - Is this a common pattern that should be centralized?

4. **Can this be composed from existing parts?**
   - Can existing utilities be combined?
   - Can existing components be composed?

## 🎯 Modern DRY Principles

**Level 1: Don't Duplicate Code**
```typescript
// ❌ BAD
function getUserById(id) { /* logic */ }
function getAdminById(id) { /* same logic */ }
function getModeratorById(id) { /* same logic */ }

// ✅ GOOD
function getUserById(id, role?) { /* parameterized logic */ }
```

**Level 2: Extract Common Patterns**
```typescript
// ❌ BAD: Duplicate validation
validateEmail(email); validateEmail(email2); validateEmail(email3);

// ✅ GOOD: Shared validator
const validators = { email: validateEmail };
```

**Level 3: Make Things Reusable By Default**
```typescript
// ❌ BAD: Hardcoded logic
function sendWelcomeEmail() { /* specific email */ }
function sendResetEmail() { /* specific email */ }

// ✅ GOOD: Generic with templates
function sendEmail(template, data) { /* reusable */ }
```

## 🚨 Quality Gate: Duplication Check

**BEFORE marking any task complete:**

1. ✅ Search for similar code in codebase
2. ✅ Verify you're not duplicating existing functionality
3. ✅ Confirm new code is maximally reusable
4. ✅ Check if existing code should be refactored to be more generic

**If you find duplication:**
- STOP and refactor to use existing code
- OR extract to shared utility/component
- OR make existing code more generic

---

# 📝 PROJECT-SPECIFIC NOTES & PREFERENCES

**These are custom preferences for THIS project. All agents MUST follow these guidelines.**

<!--
⚠️ DO NOT DELETE THIS SECTION!
This section can be edited via /gabe-os/edit-project-notes command.
Users add project-specific preferences here that apply to all specs and implementations.
-->

<!-- START_PROJECT_NOTES -->

## 🚨 MANDATORY: Investigate Before Implementation

**ALWAYS investigate the codebase AND database before planning ANY feature:**

### Step 1: Database Investigation
```bash
# Check current Prisma schema for existing models
cat prisma/schema.prisma

# Check what tables exist in PostgreSQL
npx prisma db pull --print
```

### Step 2: Codebase Investigation
```bash
# Search for existing services
find src/lib/services -name "*.ts" -o -name "*.tsx"

# Search for existing API routes
find src/app/api -type d

# Search for existing components
find src/components -name "*.tsx"

# Search for existing utilities
find src/lib -name "*.ts"
```

### Step 3: Reuse Existing Patterns
Before creating new code, check:
- `src/lib/services/` - Existing service patterns
- `src/lib/prisma.ts` - Database connection
- `src/types/database.ts` - Existing TypeScript types
- `src/components/ui/` - Existing UI components

## 🔒 DRY Architecture Requirements

**This project STRICTLY follows DRY principles:**

1. **Centralized Services** - All business logic in `src/lib/services/`
2. **Shared Types** - All TypeScript types in `src/types/`
3. **Reusable Components** - All UI components in `src/components/`
4. **Common Utilities** - All helpers in `src/lib/`

**NEVER duplicate:**
- Route handlers (parameterize instead)
- Validation logic (extract to shared validators)
- API response formatting (use consistent patterns)
- Database queries (use service layer)
- UI components (compose from existing)

## 📊 Database Stack

- **PostgreSQL** running on localhost:5432
- **Prisma ORM** for all database access
- **prisma/schema.prisma** - Single source of truth for schema
- **src/types/database.ts** - TypeScript interfaces aligned with Prisma

**Database workflow:**
1. Modify `prisma/schema.prisma`
2. Run `npx prisma db push` or `npx prisma migrate dev`
3. Update `src/types/database.ts` to match
4. Run `npx prisma generate` to update client

## 🏗️ Existing Services (Reuse These!)

- `src/lib/services/lead-accounting-service.ts` - Lead status changes with history
- `src/lib/prisma.ts` - Database connection singleton
- `src/lib/logger.ts` - Centralized logging
- `src/lib/security/` - Encryption and webhook signatures

## 🗄️ Production Database Access

**Supabase PostgreSQL (My Contractor Now)**

```
Host: db.cnogfaqqilmutqhpjhgl.supabase.co
Port: 6543
Database: postgres
User: postgres
Password: CgDWlr8Bk9O6DVoX
```

**Connection String:**
```
postgres://postgres:CgDWlr8Bk9O6DVoX@db.cnogfaqqilmutqhpjhgl.supabase.co:6543/postgres
```

**Push schema to production:**
```bash
DATABASE_URL="postgres://postgres:CgDWlr8Bk9O6DVoX@db.cnogfaqqilmutqhpjhgl.supabase.co:6543/postgres" npx prisma db push
```

**Generate Prisma client after schema changes:**
```bash
npx prisma generate
```

## 🚨 STOP: Lead System Changes Require Reading Docs First

**Before ANY lead/auction/buyer changes, READ:**
1. `docs/lead-system-flow.md` - Data transformation lifecycle
2. `docs/LEAD-DELIVERY-SYSTEM.md` - Full auction system reference

**Key concepts you MUST understand:**
- Form fields (`timeline`, `isHomeowner`) transform to lead columns (`timeframe`, `ownsHome`)
- `prepareSourceData()` in `src/lib/templates/engine.ts` flattens lead data for mappings
- Field mappings are per-buyer in `buyer_service_configs.field_mappings` (JSON)
- Changes to shared transforms affect ALL buyers using that transform

## 🔄 Lead Buyer System (PING/POST Auction)

This system matches leads with buyers through a real-time PING/POST auction. Understanding this is CRITICAL for debugging lead delivery issues.

### 📊 Database Tables

| Table | Purpose |
|-------|---------|
| `buyers` | Buyer info (name, apiUrl, active, timeouts) |
| `buyer_service_configs` | Per-service settings (field_mappings, ping/post templates) |
| `buyer_service_zip_codes` | Which zip codes each buyer accepts for each service |
| `service_types` | Available services (windows, roofing, hvac, etc.) |
| `leads` | Submitted leads with formData |
| `transactions` | PING/POST request/response logs |

### 🔍 Buyer Eligibility Flow

A buyer receives a lead ONLY if ALL conditions are met:

1. **Buyer is active:** `buyers.active = true`
2. **Service config is active:** `buyer_service_configs.active = true`
3. **Zip code is covered:** Entry exists in `buyer_service_zip_codes` for that buyer + service + zip
4. **Service type is active:** `service_types.active = true`

```sql
-- Check if Modernize would receive a windows lead for zip 90210:
SELECT b.name, bsz.zip_code, bsc.active
FROM buyers b
JOIN buyer_service_configs bsc ON b.id = bsc.buyer_id
JOIN buyer_service_zip_codes bsz ON b.id = bsz.buyer_id
  AND bsc.service_type_id = bsz.service_type_id
WHERE b.name = 'Modernize'
  AND bsz.zip_code = '90210'
  AND b.active = true
  AND bsc.active = true;
```

### 🔧 Field Mapping Configuration

The `field_mappings` JSON column in `buyer_service_configs` controls how lead data transforms for each buyer:

```json
{
  "version": "1.0",
  "mappings": [
    {
      "id": "map-1",
      "sourceField": "zipCode",
      "targetField": "postalCode",
      "required": true,
      "includeInPing": true,
      "includeInPost": true
    },
    {
      "id": "map-2",
      "sourceField": "timeframe",
      "targetField": "buyTimeframe",
      "valueMap": {
        "within_3_months": "Immediately",
        "3_plus_months": "1-6 months",
        "not_sure": "Don't know"
      },
      "required": true,
      "includeInPing": true,
      "includeInPost": true
    },
    {
      "id": "map-3",
      "sourceField": "ownsHome",
      "targetField": "ownHome",
      "transform": "boolean.yesNo",
      "required": true,
      "includeInPing": true,
      "includeInPost": true
    }
  ],
  "pingStaticFields": {
    "tagId": "204670250",
    "service": "WINDOWS",
    "partnerSourceId": "fb"
  },
  "postStaticFields": {
    "tagId": "204670250",
    "service": "WINDOWS",
    "partnerSourceId": "fb",
    "homePhoneConsentLanguage": "TCPA consent text..."
  }
}
```

### 🔄 Transformation Order

In `TemplateEngine.processMapping()`:

1. **Get source value** from lead data (e.g., `timeframe = "within_3_months"`)
2. **Apply valueMap** if specified → `"within_3_months"` becomes `"Immediately"`
3. **Apply transform** if specified → `boolean.yesNo` converts `true` to `"Yes"`
4. **Set to targetField** in output payload

### 📡 Webhook URL Configuration

The `ping_template` and `post_template` columns specify URLs:

```json
// ping_template
{"url": "https://hsapiservice.quinstage.com/ping-post/pings"}

// post_template
{"url": "https://hsapiservice.quinstage.com/ping-post/posts"}
```

If no URL is specified, falls back to: `buyer.api_url + "/ping"` or `"/post"`

### 🧪 Available Transforms

| Transform | Input | Output |
|-----------|-------|--------|
| `boolean.yesNo` | `true` / `false` | `"Yes"` / `"No"` |
| `boolean.trueFalse` | `true` / `false` | `"true"` / `"false"` |
| `phone.digitsOnly` | `"(555) 123-4567"` | `"5551234567"` |
| `phone.e164` | `"555-123-4567"` | `"+15551234567"` |
| `string.titleCase` | `"john doe"` | `"John Doe"` |
| `string.uppercase` | `"hello"` | `"HELLO"` |

### 🔍 Debugging Lead Delivery

**Check if a lead was sent to buyers:**
```sql
SELECT t.action_type, t.status, t.bid_amount, t.error_message,
       b.name, t.response::text
FROM transactions t
JOIN buyers b ON t.buyer_id = b.id
WHERE t.lead_id = 'your-lead-id'
ORDER BY t.created_at;
```

**Check why a buyer didn't receive a lead:**
1. Is buyer active? → `SELECT active FROM buyers WHERE name = 'Modernize'`
2. Is service config active? → Check `buyer_service_configs.active`
3. Is zip code covered? → Check `buyer_service_zip_codes`
4. Check server logs for eligibility filtering

### 📁 Key Code Files

| File | Purpose |
|------|---------|
| `src/app/api/leads/route.ts` | Lead submission, triggers auction |
| `src/lib/auction/engine.ts` | PING/POST auction logic |
| `src/lib/services/buyer-eligibility-service.ts` | Filters eligible buyers |
| `src/lib/field-mapping/database-buyer-loader.ts` | Loads buyer configs from DB |
| `src/lib/templates/engine.ts` | Transforms lead data using mappings |
| `src/lib/repositories/service-zone-repository.ts` | Queries zip code coverage |

<!-- END_PROJECT_NOTES -->

---

## What is Gabe-OS?

Gabe-OS is a production-grade system for spec-driven development with AI coding agents. It provides enforced quality standards, intelligent parallel execution, and visual spec management to transform AI agents into disciplined, efficient developers.

**Version:** 1.2.4
**Type:** Standalone AI Development System
**Repository:** ~/Dev/Gabe-OS
**Author:** Gabe

## How It Works

Gabe-OS uses a **3-layer context approach**:

1. **Standards** - Enforced coding guidelines (500-line limits, WHY/WHEN/HOW docs, SRP)
2. **Product** - Vision, roadmap, and feature planning
3. **Specs** - Detailed feature specifications with implementation tasks

## Available Commands

Gabe-OS provides slash commands in Claude Code (namespaced under `/gabe-os/`):

- `/gabe-os/init-project` - Bootstrap a brand new project from scratch (greenfield projects)
- `/gabe-os/new-spec` - Initialize a new feature specification with requirements gathering
- `/gabe-os/create-spec` - Generate detailed spec and task breakdown (standalone)
- `/gabe-os/implement-spec` - Execute implementation with intelligent parallel batching
- `/gabe-os/main-menu` - Visual dashboard of all specs with progress tracking
- `/gabe-os/continue-spec` - Resume work on any spec with context preservation
- `/gabe-os/audit-spec` - Post-implementation comprehensive quality review
- `/gabe-os/debug` - 6-phase debugging workflow for complex issues
- `/gabe-os/plan-product` - Create or update product roadmap

**Note:** Always use the full `/gabe-os/` namespace prefix!

## Available Agents

Gabe-OS includes specialized agents in `.claude/agents/gabe-os/`:

### Project Initialization Phase
- **project-initializer** - Bootstrap brand new projects with tech stack and boilerplate

### Specification Phase
- **spec-initializer** - Create spec folder structure (via bash script)
- **spec-shaper** - Gather requirements through clarifying questions
- **spec-writer** - Write detailed technical specifications
- **spec-verifier** - Validate spec completeness
- **tasks-list-creator** - Break specs into implementation tasks
- **codebase-analyzer** - Deep analysis of existing codebase

### Implementation Phase
- **implementer** - Execute implementation tasks following standards
- **implementation-verifier** - Verify implementation matches spec

### Quality Assurance Phase
- **code-quality-auditor** - Ruthless enforcement of quality standards

### Debugging Phase
- **debug-investigator** - Deep investigation of bugs and issues
- **debug-theorist** - Generate ranked theories of root causes
- **debug-solution-architect** - Design efficient, modular solutions
- **debug-implementation** - Execute approved solutions
- **debug-verification** - Verify fixes work correctly

### Planning Phase
- **product-planner** - Manage product roadmap and feature planning

## Enforcement Skills

Gabe-OS uses Claude Code Skills for lazy-loaded standards (37k token savings per spec!):

- **enforce-file-limits** - 500-line file limit enforcement (warning at 400)
- **require-why-when-how-docs** - Comprehensive documentation requirements
- **enforce-modularity** - Single Responsibility Principle enforcement
- **enforce-file-organization** - Consistent project structure
- **format-user-output** - Consistent visual formatting for user messages

## Directory Structure

### Global Installation
```
~/gabe-os/
├── config.yml           # Gabe-OS configuration
├── profiles/
│   └── default/
│       ├── standards/   # Coding standards
│       ├── skills/      # Enforcement skills
│       ├── agents/      # Enhanced agents
│       └── commands/    # Dashboard commands
└── scripts/             # Installation scripts
    ├── base-install.sh
    ├── project-install.sh
    └── init-spec.sh
```

### Project Installation
```
your-project/
├── gabe-os/
│   ├── config.yml       # Project-specific config
│   ├── standards/       # Compiled standards
│   └── roles/           # Role configurations
│
├── .claude/
│   ├── agents/gabe-os/  # Gabe-OS specialized agents
│   ├── commands/gabe-os/# Gabe-OS slash commands
│   └── skills/          # Enforcement skills
│
└── @gabe-os/
    ├── product/
    │   └── roadmap.md   # Product roadmap
    └── specs/
        └── YYYY-MM-DD-feature-name/  # Dated spec folders
            ├── planning/
            │   ├── initialization.md
            │   ├── requirements.md
            │   ├── codebase-analysis.md
            │   └── visuals/
            ├── spec.md
            ├── tasks.md
            ├── implementation/
            └── verification/
```

## Workflow

**Choose your starting point:**

### For Brand New Projects (Greenfield)
```bash
/gabe-os/init-project
```
- Asks 10 targeted questions (project type, tech stack, database, auth, etc.)
- Creates complete project structure
- Generates all config files (package.json, tsconfig.json, etc.)
- Sets up boilerplate code
- Installs Gabe-OS
- Creates product roadmap with your core features
- **Result:** A ready-to-run project with `npm install && npm run dev`

### For Existing Projects (Add Features)

#### 1. Plan Your Product
```bash
/gabe-os/plan-product
```
Creates or updates `@gabe-os/product/roadmap.md` with features and priorities.

#### 2. Initialize New Spec
```bash
/gabe-os/new-spec "Add user authentication"
```
- Creates dated spec folder
- Quick project analysis for context
- Gathers requirements through informed questions
- Deep codebase analysis
- Generates complete spec with tasks
- All in ONE command!

### 3. View Your Specs
```bash
/gabe-os/main-menu
```
- Visual dashboard of all specs
- Progress bars and status
- Quick actions per spec

### 4. Implement the Spec
```bash
/gabe-os/implement-spec
```
- Intelligent parallel batching (max 3 tasks simultaneously)
- Respects dependencies (explicit + implicit)
- Quality audit after EACH batch
- Blocks on critical violations

### 5. Resume or Audit
```bash
/gabe-os/continue-spec    # Resume work with full context
/gabe-os/audit-spec       # Post-implementation quality review
```

## Configuration

Gabe-OS v1.2.4 includes these enforced quality settings:

```yaml
quality:
  enforce_modularity: true
  max_file_lines: 500
  warning_threshold_lines: 400
  require_documentation: true
  documentation_format: "WHY/WHEN/HOW"

execution:
  parallel_batching_enabled: true
  max_parallel_tasks_per_batch: 3
  enable_quality_gates: true
  audit_after_each_batch: true

standards:
  file_size: "critical"        # Block on violation
  documentation: "critical"    # Block on violation
  modularity: "critical"       # Block on violation
  dry_principle: "high"        # Warn on violation
  race_conditions: "critical"  # Block on violation
```

## File Organization Rules

**NEVER save working files to the root folder. Use appropriate directories:**
- `/src` - Source code files
- `/tests` - Test files
- `/@gabe-os/specs/` - Specifications
- `/@gabe-os/product/` - Product planning
- `/docs` - Documentation

## Best Practices

1. **Always start with specs** - Use `/new-spec` before coding
2. **Follow the workflow** - Plan → Spec → Implement → Verify
3. **Update roadmap** - Keep `@gabe-os/product/roadmap.md` current
4. **Use dated folders** - Specs use `YYYY-MM-DD-name` format
5. **Trust the auditor** - Quality gates prevent bad code from proceeding
6. **Leverage parallelism** - Let Gabe-OS batch tasks intelligently

## Browser Testing

**ALWAYS use Playwright MCP tools (mcp__playwright__*) for UI testing. NEVER write Playwright scripts unless explicitly requested for CI/CD.**

## Key Features

### Production-Grade Standards
- 500-line file limits (hard enforced)
- WHY/WHEN/HOW documentation (required)
- Single Responsibility Principle (enforced)
- DRY principle (detected automatically)
- Race condition detection (critical)

### Intelligent Execution
- Parallel batching (3x faster)
- Smart dependency analysis
- Quality gates after each batch
- 40% token efficiency improvement

### Visual Management
- Dashboard with progress tracking
- Smart resumption with context preservation
- Post-implementation comprehensive audits
- Metadata tracking

## Token Savings

**v1.2.4 Improvements:**
- 42,000 tokens saved with zero-token main menu dashboard
- 37,000 tokens saved per spec (Skills vs file injection)
- 1,000 tokens saved per audit (mechanical pre-checks)
- Total: ~80k+ tokens saved per session!

## Getting Help

- Documentation: `~/Dev/Gabe-OS/docs/`
- Install updates: `~/gabe-os/scripts/base-install.sh`
- Repository: `~/Dev/Gabe-OS`

---

## Auto-Install Gabe-OS

**IMPORTANT: Check for Gabe-OS installation at the start of EVERY session.**

### Session Start Check

At the beginning of each session, check if this directory has Gabe-OS installed:

```bash
ls gabe-os/config.yml 2>/dev/null && ls .claude/agents/gabe-os/ 2>/dev/null
```

**If both exist:** ✅ Gabe-OS is installed! Remember to:
- Use `/gabe-os/` commands (NOT manual implementation)
- Check `@gabe-os/specs/` for existing specs
- Follow spec → implement → verify workflow
- See the prominent reminder at the TOP of this file

**If either is missing:** Proceed to auto-install prompt below.

### Auto-Install Prompt (Only When Missing)

When Gabe-OS is NOT detected, ask the user ONCE per session:

```
🤖 Gabe-OS not detected in this directory.

Would you like to install Gabe-OS v1.2.4?

This will add:
✅ Production-grade coding standards (500-line limits, WHY/WHEN/HOW docs)
✅ Intelligent parallel execution (3x faster with dependency analysis)
✅ Quality gates and code auditor after each batch
✅ Visual spec dashboard (/gabe-os/main-menu)
✅ Smart spec resumption (/gabe-os/continue-spec)
✅ Post-implementation auditing (/gabe-os/audit-spec)
✅ 6-phase debugging workflow (/gabe-os/debug)
✅ Claude Code Skills integration (45k token savings per spec!)

Install now? [y/n]:
```

**If user responds "y" or "yes":**

```bash
~/gabe-os/scripts/project-install.sh
```

Then confirm installation:
```
✅ Gabe-OS v1.2.4 installed successfully!

Available commands (always use /gabe-os/ namespace):
• /gabe-os/init-project - Bootstrap a brand new project from scratch
• /gabe-os/new-spec - Create complete feature specification in ONE command
• /gabe-os/create-spec - Generate standalone spec and tasks
• /gabe-os/implement-spec - Execute with parallel batching + quality gates
• /gabe-os/main-menu - Visual dashboard of all specs
• /gabe-os/continue-spec - Resume work on any spec
• /gabe-os/audit-spec - Post-implementation quality review
• /gabe-os/debug - 6-phase debugging workflow
• /gabe-os/plan-product - Product roadmap management

Ready to start building!
```

**If user responds "n" or "no":**

```
⏭️  Skipped Gabe-OS installation.

To install later, run:
~/gabe-os/scripts/project-install.sh
```

### Important Rules

1. **Check ONLY at session start** - Don't check multiple times per session
2. **Ask ONCE per session** - If user declines, don't ask again until next session
3. **Be silent if installed** - Don't announce "Gabe-OS detected" every time
4. **Never auto-install without permission** - Always ask first
5. **Skip certain directories** - Don't offer installation in `/tmp`, `~/Downloads`, `~/Desktop`

---

**Gabe-OS v1.2.4** | Standalone AI Development System | Built with 💙 by Gabe
