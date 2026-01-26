# Tasks: Conditional Logic UI Builder

## Status Legend
- [ ] Not started
- [x] Completed
- [~] In progress

---

## Phase 0: BLOCKERS - Schema Standardization (MUST DO FIRST)

> **WHY:** 4 different incompatible condition schemas exist in codebase.
> Runtime uses `conditions[]` but types/validation use singular `conditional`.
> Nothing will work until these are aligned.

### 0.1 Fix Type Definitions
- [x] **0.1.1** In `src/types/database.ts`:
  - Rename `FormFieldConditional` → `FormFieldCondition`
  - Change operators to match runtime: `equals`, `not_equals`, `in`, `not_in`
  - Change `FormField.conditional` → `FormField.conditions` (array)

### 0.2 Fix API Validation Schema
- [x] **0.2.1** In `src/lib/validations/lead.ts` (createServiceTypeSchema):
  - Change `conditional` → `conditions` (array)
  - Update operators enum to: `['equals', 'not_equals', 'in', 'not_in']`
  - Update value type to: `z.union([z.string(), z.array(z.string())])`

### 0.3 Fix Options Editor (CRITICAL)
- [ ] **0.3.1** In `src/components/admin/ServiceForm.tsx`:
  - Replace textarea for options with proper editor
  - Output must be `{value: string, label: string}[]` not string
  - Add value/label input pairs with add/remove buttons

### 0.4 Verify Existing DB Data
- [x] **0.4.1** Check existing formSchemas in DB use correct format (verified: all use {value,label}[])
- [x] **0.4.2** Run type-check after changes: `npx tsc --noEmit` ✅

---

## Phase 1: Add Conditions to ServiceForm Schema

- [x] **1.1** Add `conditions` array to `formFieldSchema` in ServiceForm.tsx:
  ```typescript
  conditions: z.array(z.object({
    field: z.string(),
    operator: z.enum(['equals', 'not_equals', 'in', 'not_in']),
    value: z.union([z.string(), z.array(z.string())]),
  })).optional(),
  ```

- [x] **1.2** Add conditions to defaultValues for new fields (handled by useFieldArray)

---

## Phase 2: Core UI Components

- [x] **2.1** Create `src/components/admin/form-builder/ConditionRow.tsx`
  - Field dropdown (shows previous fields only)
  - Operator dropdown (equals, not_equals, in, not_in)
  - Value dropdown (populated from selected field's options)
  - Delete button
  - Props: `{ index, fields, onRemove, control }`

- [x] **2.2** Create `src/components/admin/form-builder/ConditionBuilder.tsx`
  - Container for multiple ConditionRows
  - "Add condition" button
  - Empty state: "No conditions - question always shows"
  - Props: `{ fieldIndex, allFields, control }`

---

## Phase 3: Integration with ServiceForm

- [x] **3.1** Add ConditionBuilder to each field card in ServiceForm.tsx
- [x] **3.2** Wire up react-hook-form useFieldArray for conditions
- [x] **3.3** Implement field filtering: only show fields that appear BEFORE current field
- [x] **3.4** Implement value options: load from selected field's options array

---

## Phase 4: Options Editor Fix

- [ ] **4.1** Create `src/components/admin/form-builder/OptionsEditor.tsx`
  - List of value/label pairs
  - Add option button
  - Remove option button per row
  - Drag to reorder
  - Proper output: `{value: string, label: string}[]`

- [ ] **4.2** Replace textarea in ServiceForm with OptionsEditor
- [ ] **4.3** Update form defaultValues to handle existing options

---

## Phase 5: Data Flow Verification

- [x] **5.1** Verify conditions included in form submission payload (ServiceForm sends formFields with conditions)
- [x] **5.2** Verify API accepts and saves conditions correctly (JSON.stringify includes conditions)
- [x] **5.3** Verify conditions load when editing existing service (formSchema.fields parsed with conditions)
- [x] **5.4** Verify flow-builder passes conditions to QuestionFlow (lines 135-138)
- [x] **5.5** Verify shouldShowQuestion() evaluates conditions correctly (questions.ts already works)

**CRITICAL FIX APPLIED:**
- [x] Admin services page now fetches from `/api/service-types` (was mock data)
- [x] Admin services page now saves via POST/PUT to API (was mock save)
- [x] API `/api/service-types/[id]` now has GET/PUT/DELETE with Prisma (was all mock data)

---

## Phase 6: Testing & Polish

- [ ] **6.1** Test: Create new field with condition, save, verify in DB
- [ ] **6.2** Test: Edit existing service, add condition, save
- [ ] **6.3** Test: Runtime - question shows/hides based on condition
- [ ] **6.4** Test: Multiple conditions (AND logic)
- [ ] **6.5** Test: `in` operator with multiple values
- [x] **6.6** Add visual badge showing "Has conditions" on field cards (Eye icon + count)
- [ ] **6.7** Add tooltip explaining what conditions do

---

## Files to Create/Modify

| File | Action | Phase |
|------|--------|-------|
| `src/types/database.ts` | Modify | 0.1 |
| `src/lib/validations/lead.ts` | Modify | 0.2 |
| `src/components/admin/ServiceForm.tsx` | Modify | 0.3, 1, 3 |
| `src/components/admin/form-builder/OptionsEditor.tsx` | Create | 4 |
| `src/components/admin/form-builder/ConditionRow.tsx` | Create | 2 |
| `src/components/admin/form-builder/ConditionBuilder.tsx` | Create | 2 |

---

## Dependency Graph

```
Phase 0 (BLOCKERS)
    ├── 0.1 Fix types
    ├── 0.2 Fix validation
    └── 0.3 Fix options editor
           ↓
Phase 1 (Schema) ──→ Phase 2 (Components) ──→ Phase 3 (Integration)
                              ↓
                     Phase 4 (Options Editor)
                              ↓
                     Phase 5 (Verification)
                              ↓
                     Phase 6 (Testing)
```

---

## Notes

- Runtime support already exists and works (flow-builder.ts + questions.ts)
- Database can store conditions (JSON field)
- Main work is schema alignment + UI building
- Options editor is a separate but related issue that blocks conditions UI
