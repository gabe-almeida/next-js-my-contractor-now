# My Contractor Now - Project Instructions

---

# CRITICAL: Single Push - Code + Docs Together

**NEVER push twice. ALL changes (code + docs) go in ONE commit.**

## System Documentation Requirements

**When modifying ANY of these systems, you MUST update its docs:**

| System | Docs Location | Covers |
|--------|---------------|--------|
| Lead Delivery | `docs/lead-delivery/` | Auction, PING/POST, field mappings, buyer configs |
| Affiliate | `docs/affiliate/` | Tracking, attribution, signup flow, UI |
| Contractor | `docs/contractor/` | Contractor system, signup, dashboard UI |
| Admin | `docs/admin/` | Super admin UI, management tools |
| Forms | `docs/forms/` | Dynamic forms, service quizzes, validation |
| Compliance | `docs/compliance/` | TrustedForm, Jornaya, TCPA |

**If the docs folder doesn't exist → CREATE IT with a README.md first.**

## Before ANY Commit

1. **Check if docs exist** for the system you're modifying
2. **Read the docs** before making changes (understand current state)
3. **Update the docs** to reflect your changes
4. **Stage ALL** (code + docs) → commit → push ONCE

## Doc Content Standard ("Fresh Agent Ready")

A new Claude instance should understand the system WITHOUT re-investigating:

```markdown
## Overview
What this system does and WHY it exists.

## Key Flows
1. User does X → System does Y → Result Z

## Important Files
- `src/path/file.ts:123` - handles X

## Gotchas
- Edge case 1: what happens when X
```

---

# CRITICAL: DRY Principles

**Before writing ANY code:**
1. Search for existing code: `grep -r "pattern" src/`
2. Check `src/lib/services/`, `src/components/ui/`, `src/lib/`
3. Reuse or extend existing code - NEVER duplicate

---

# Quick References

## Database

| Item | Value |
|------|-------|
| Host (pooled) | `aws-0-us-east-2.pooler.supabase.com:6543` |
| Host (direct) | `aws-0-us-east-2.pooler.supabase.com:5432` |
| Database | `postgres` |
| User | `postgres.cnogfaqqilmutqhpjhgl` |
| Password | `CgDWlr8Bk9O6DVoX` |

**Important:** Use port 5432 (direct) for migrations, port 6543 (pooled) with `?pgbouncer=true` for app queries.

```bash
# Push schema to production (use direct connection - port 5432)
DATABASE_URL="postgresql://postgres.cnogfaqqilmutqhpjhgl:CgDWlr8Bk9O6DVoX@aws-0-us-east-2.pooler.supabase.com:5432/postgres" npx prisma db push
```

## Render (Production)

| Service | ID |
|---------|-----|
| my-contractor-now | `srv-d0ua7j63jp1c73fnfgn0` |

```bash
render logs -r srv-d0ua7j63jp1c73fnfgn0 --output text --limit 100
```

## Key Services (Reuse These!)

| Service | Purpose |
|---------|---------|
| `src/lib/services/lead-accounting-service.ts` | Lead status changes with history |
| `src/lib/auction/engine.ts` | PING/POST auction logic |
| `src/lib/templates/engine.ts` | Field mapping transformations |
| `src/lib/services/buyer-eligibility-service.ts` | Buyer filtering |

---

# How to Test UI

**Unified Login:** `/login` - works for all user types, auto-redirects to correct dashboard.

Test credentials: `docs/how-to-login-for-testing-ui/README.md`

| User Type | Email | Password |
|-----------|-------|----------|
| Super Admin | `admin@mycontractornow.com` | `TestAdmin123!` |
| Affiliate | `affiliate@mycontractornow.com` | `TestAffiliate123!` |
| Contractor | `contractor@mycontractornow.com` | `TestContractor123!` |

---

# System-Specific Rules

## Lead System Changes

**STOP. Before ANY lead/auction/buyer changes:**
1. Read `docs/lead-delivery/` (or `docs/lead-system-flow.md` if folder doesn't exist)
2. Understand: Form fields → Lead columns → Field mappings → Buyer payloads
3. Field mappings are per-buyer in `buyer_service_configs.field_mappings`
4. Changes to shared transforms (`src/lib/transforms/`) affect ALL buyers

**NEVER send PING/POST to lead buyers without explicit user permission.**

## UI Changes

**Before ANY UI work:**
- Check `src/components/ui/` for existing components
- Use existing Button, Input, Card components
- Follow existing patterns in similar pages

---

# Quality Standards

- 500-line file limit (warning at 400)
- WHY/WHEN/HOW documentation required
- Single Responsibility Principle enforced
- DRY: Reusable components over duplication

---

# Token Efficiency

**Query DB directly instead of writing scripts:**
```bash
# Use psql directly - faster and less tokens than creating script files
PGPASSWORD="CgDWlr8Bk9O6DVoX" psql -h aws-0-us-east-2.pooler.supabase.com -p 6543 -U postgres.cnogfaqqilmutqhpjhgl -d postgres -c "SELECT * FROM table LIMIT 10;"
```

**NEVER create throwaway script files** for one-off queries or debugging. Query directly.

---

# Project Notes

<!-- START_PROJECT_NOTES -->

## Tech Stack
- **Framework:** Next.js 14 (App Router)
- **Database:** PostgreSQL (Supabase) + Prisma ORM
- **Cache:** Upstash Redis
- **Hosting:** Render (standalone mode)
- **Compliance:** TrustedForm, Jornaya

## Database Workflow
```bash
# 1. Modify schema
vim prisma/schema.prisma

# 2. Push to database
npx prisma db push

# 3. Regenerate client
npx prisma generate
```

## Existing Docs (Read Before Modifying)

| Topic | File |
|-------|------|
| Lead flow & transformations | `docs/lead-system-flow.md` |
| Full auction system | `docs/LEAD-DELIVERY-SYSTEM.md` |
| Buyer eligibility | `docs/BUYER-ELIGIBILITY-SYSTEM.md` |
| Field mapping config | `docs/COMPLIANCE_FIELD_MAPPINGS.md` |
| Affiliate tracking | `docs/affiliate-tracking-flow.md` |
| Forms system | `docs/forms-system.md` |

<!-- END_PROJECT_NOTES -->
