# Comprehensive Audit: Form Schema System

## Executive Summary

**The system has TWO completely separate, non-connected paths:**

| Path | Status | Used By |
|------|--------|---------|
| **Database → flow-builder → DynamicForm** | ✅ WORKING | Actual user-facing forms |
| **Admin UI → Mock save → Local state** | ❌ BROKEN | Admin tries to use but doesn't save |

---

## The SINGLE Source of Truth

### Database Schema (Prisma)
```prisma
model ServiceType {
  formSchema  String  @map("form_schema")  // JSON string
}
```

### Actual Database Content (VERIFIED)
```sql
SELECT form_schema FROM service_types WHERE name = 'windows';
```

```json
{
  "fields": [
    {
      "name": "projectScope",
      "type": "select",
      "required": true,
      "label": "Are you looking to repair existing windows or install new windows?",
      "options": [
        {"value": "repair", "label": "Repair"},
        {"value": "install", "label": "Install"}
      ]
    }
  ]
}
```

**This is the source of truth.** It matches what `flow-builder.ts` expects.

---

## Working Data Flow (User Forms)

```
┌─────────────────────────────────────────────────────────────────┐
│  USER VISITS /services/windows                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  src/app/services/[slug]/page.tsx                               │
│  → fetch('/api/services/windows/flow')                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  src/app/api/services/[slug]/flow/route.ts                      │
│  → prisma.serviceType.findFirst({ where: { name: 'windows' }})  │
│  → gets formSchema string from database                         │
│  → calls buildQuestionFlow(serviceType)                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  src/lib/questions/flow-builder.ts                              │
│  → JSON.parse(formSchema)                                       │
│  → converts fields to Questions                                 │
│  → adds STANDARD_STEPS (address, timeline, isHomeowner, etc.)   │
│  → returns QuestionFlow                                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  src/components/DynamicForm.tsx                                 │
│  → receives flow: QuestionFlow                                  │
│  → uses shouldShowQuestion(question, answers) for conditions    │
│  → uses getNextStep(flow, currentStep, answers) for navigation  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  src/lib/questions.ts                                           │
│  → shouldShowQuestion() evaluates question.conditions           │
│  → supports: equals, not_equals, in, not_in                     │
└─────────────────────────────────────────────────────────────────┘
```

**This path WORKS. Conditions work if they exist in the database JSON.**

---

## Broken Admin Path

```
┌─────────────────────────────────────────────────────────────────┐
│  ADMIN VISITS /admin/services                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  src/app/(admin)/admin/services/page.tsx                        │
│  → useEffect() with HARDCODED mockServices (not from database!) │
│  → handleSubmitForm() = "// Mock save" (DOES NOT CALL API!)     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  src/components/admin/ServiceForm.tsx                           │
│  → Has its OWN schema that doesn't match database               │
│  → No conditions field at all                                   │
│  → Options as textarea (wrong format)                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ❌ NOTHING SAVED TO DATABASE
```

---

## Schema Comparison

### What flow-builder.ts expects (from database)
```typescript
interface FormSchemaField {
  name: string;
  type: string;
  label: string;
  required?: boolean;
  options?: string[] | { value: string; label: string }[];
  conditions?: {
    field: string;
    operator: 'equals' | 'not_equals' | 'in' | 'not_in';
    value: string | string[];
  }[];
}
```

### What ServiceForm.tsx uses (admin UI)
```typescript
const formFieldSchema = z.object({
  type: z.enum(['text', 'number', 'select', ...]),
  label: z.string(),
  name: z.string(),
  required: z.boolean(),
  options: z.array(formFieldOptionSchema).optional(),  // Different structure!
  validation: z.object({...}).optional(),
  // NO CONDITIONS FIELD!
});
```

### What types/database.ts defines (unused by either!)
```typescript
interface FormFieldConditional {  // Wrong name
  operator: 'equals' | 'notEquals' | 'includes' | ...  // Wrong operators
}
interface FormField {
  conditional?: FormFieldConditional;  // Singular, not array!
}
```

---

## Dead Code Identified

| File | Issue |
|------|-------|
| `src/app/api/service-types/[id]/route.ts` | Has 247 lines of HARDCODED mock data, never touches database |
| `src/app/(admin)/admin/services/page.tsx` | Mock data + mock save, not connected to database |
| `src/types/database.ts` FormFieldConditional | Not used by working path |
| `src/lib/validations/lead.ts` createServiceTypeSchema | Has wrong `conditional` field |

---

## What Actually Needs to Be Built

### Priority 1: Connect Admin to Database
1. **Admin services page** needs to fetch from database, not mock data
2. **ServiceForm** needs to call real API on submit
3. **API route** `/api/service-types` POST/PUT needs to save to database

### Priority 2: Fix ServiceForm Schema
1. Add `conditions` field (array, matching flow-builder interface)
2. Fix options editor (output `{value, label}[]` not strings)
3. Match the schema to what flow-builder expects

### Priority 3: Clean Up Dead Code
1. Remove mock data from admin services page
2. Remove or fix `/api/service-types/[id]` mock data
3. Align `types/database.ts` with actual runtime types
4. Remove unused validation schemas

---

## The Correct Interface (Use This Everywhere)

```typescript
// THE SINGLE SOURCE OF TRUTH
// File: src/lib/questions/flow-builder.ts (lines 18-37)

interface FormSchemaField {
  name: string;           // Field identifier (e.g., "projectScope")
  type: string;           // Field type (select, text, radio, etc.)
  label: string;          // Question text shown to user
  required?: boolean;     // Is field required?
  options?: (             // For select/radio fields
    | string
    | { value: string; label: string }
  )[];
  validation?: {          // Optional validation rules
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    message?: string;
  };
  conditions?: {          // When to show this field (ARRAY!)
    field: string;        // Field to check
    operator: 'equals' | 'not_equals' | 'in' | 'not_in';
    value: string | string[];
  }[];
}

interface FormSchema {
  fields: FormSchemaField[];
}
```

---

## Recommended Fix Order

1. **[CRITICAL]** Wire admin services page to database (fetch + save)
2. **[CRITICAL]** Update ServiceForm to match flow-builder interface
3. **[HIGH]** Add conditions UI to ServiceForm
4. **[HIGH]** Fix options editor to output correct format
5. **[MEDIUM]** Delete dead code (mock data, unused types)
6. **[LOW]** Align all TypeScript interfaces with flow-builder

---

## Risk Assessment

| Risk | Severity | Status |
|------|----------|--------|
| Admin edits won't save | CRITICAL | **FIXED** - Now calls real API |
| Type mismatches | LOW | **FIXED** - All schemas aligned |
| Options format wrong | MEDIUM | Pending - Textarea still used |
| No conditions in admin | MEDIUM | **FIXED** - ConditionBuilder added |

---

## FIXES APPLIED (2026-01-09)

### 1. Schema Standardization (Phase 0)
- [x] `src/types/database.ts`: Renamed `FormFieldConditional` → `FormFieldCondition`, fixed operators
- [x] `src/lib/validations/lead.ts`: Changed `conditional` → `conditions[]` with correct operators
- [x] `src/components/admin/ServiceForm.tsx`: Added all field types + conditions schema

### 2. Conditions UI (Phases 1-3)
- [x] Created `src/components/admin/form-builder/ConditionRow.tsx`
- [x] Created `src/components/admin/form-builder/ConditionBuilder.tsx`
- [x] Integrated ConditionBuilder into ServiceForm field cards
- [x] Field filtering: only shows fields BEFORE current field
- [x] Value options: populated from selected field's options
- [x] Visual badge: "X conditions" or "Always shows"

### 3. Admin-Database Connection (CRITICAL FIX)
- [x] `src/app/(admin)/admin/services/page.tsx`: Now fetches from `/api/service-types`
- [x] `src/app/(admin)/admin/services/page.tsx`: Now saves via POST/PUT to API
- [x] `src/app/api/service-types/[id]/route.ts`: Replaced mock data with Prisma GET/PUT/DELETE

### 4. Verified Data Flow
```
Admin UI → ServiceForm → /api/service-types POST/PUT → Database
                                     ↓
                            JSON.stringify(formSchema)
                            (includes conditions[])
                                     ↓
                              service_types.form_schema
                                     ↓
                        /api/services/[slug]/flow
                                     ↓
                            buildQuestionFlow()
                            (passes conditions through)
                                     ↓
                              DynamicForm
                                     ↓
                          shouldShowQuestion()
                          (evaluates conditions)
```

### Remaining Work
- [ ] Phase 4: Options Editor (replace textarea with value/label pairs)
- [ ] Phase 5: End-to-end testing
- [ ] Phase 6: Testing and polish
