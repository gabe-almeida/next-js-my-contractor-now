# Conditional Logic UI Builder for Form Fields

## Overview
Add a visual conditions builder to the Admin UI ServiceForm, allowing admins to configure when questions should appear based on previous answers.

## Problem
- The runtime (`flow-builder.ts` + `questions.ts`) fully supports conditional logic
- The database `formSchema` can store conditions
- But the Admin UI has NO way to configure conditions - you'd have to manually edit JSON

## Example Use Case
**isHomeowner question** → User answers "No"
**authorizationConfirm question** → Should ONLY appear when isHomeowner = "no"

Currently this works because `authorizationConfirm` is a STANDARD_QUESTION with hardcoded conditions. But service-specific conditional questions cannot be configured via Admin UI.

## Solution
Add a "Show Condition" section to each field in `ServiceForm.tsx`:

```
┌─ Show Condition (Optional) ───────────────────────────┐
│  Only show this question when:                        │
│                                                       │
│  [Select field ▼] [equals ▼] [Select value ▼]        │
│                                                       │
│  + Add condition (AND)                                │
└───────────────────────────────────────────────────────┘
```

## Technical Details

### Files to Modify
1. `src/components/admin/ServiceForm.tsx` - Add conditions UI
2. `src/lib/validations/lead.ts` - Update formFieldSchema to include conditions

### Data Structure (Already Supported)
```typescript
conditions?: {
  field: string;      // Field name to check (e.g., "isHomeowner")
  operator: 'equals' | 'not_equals' | 'in' | 'not_in';
  value: string | string[];  // Value(s) to match
}[];
```

### UI Components Needed
1. **ConditionBuilder** - Main component for adding/removing conditions
2. **ConditionRow** - Single condition with field/operator/value dropdowns
3. Field dropdown should show all PREVIOUS fields in the form (can't depend on fields that come after)

## Acceptance Criteria
- [ ] Admin can add conditions to any form field
- [ ] Conditions are saved to database formSchema JSON
- [ ] Conditions work at runtime (questions show/hide correctly)
- [ ] Field dropdown only shows fields that appear BEFORE the current field
- [ ] Multiple conditions supported (AND logic)
- [ ] Operator dropdown: equals, not_equals, in, not_in
- [ ] Value dropdown populated from selected field's options
- [ ] Clear visual feedback when a field has conditions
