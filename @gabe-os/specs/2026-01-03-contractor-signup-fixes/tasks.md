# Contractor Signup Flow - Critical Fixes

**Created:** 2026-01-03
**Status:** All Fixes Implemented - Pending Testing
**Priority:** Critical - Blocking contractor lead flow
**Last Updated:** 2026-01-03

---

## Executive Summary

The contractor signup flow has critical bugs that prevent contractors from receiving leads even after admin activation. The core issues are:

1. **Data structure mismatch** between UI and API prevents ZIP code expansion
2. **Hardcoded service IDs** in UI don't match database UUIDs
3. **Missing validation** allows incomplete signups

---

## Issue #1: Data Structure Mismatch (CRITICAL)

### WHY This Is a Problem
The `expandServiceLocationsToZipCodes` function expects locations grouped by type (states, cities, counties, zipCodes), but the UI sends a flat array. This causes the expansion function to receive empty arrays for all location types, resulting in **zero ZIP codes being created**.

### WHEN This Occurs
When a contractor completes the signup flow and submits their registration. The API receives the data but the location expansion silently fails, creating a buyer with no service zones.

### HOW It Manifests
```typescript
// UI sends this structure:
{
  serviceId: "roofing",
  locations: [
    { id: "ca", type: "state", name: "California", displayName: "California" }
  ]
}

// But expandServiceLocationsToZipCodes expects:
{
  serviceId: "roofing",
  locations: {
    states: [{ id: "ca", type: "state", name: "California", displayName: "California" }],
    cities: [],
    counties: [],
    zipCodes: []
  }
}
```

### Files Affected
- `src/components/contractor-signup/ServiceLocationQuizSimple.tsx` (sends flat array)
- `src/lib/services/location-expansion.ts` (expects grouped object)
- `src/app/api/contractors/signup/route.ts` (passes data through without transformation)

### Fix Required
Transform flat location array to grouped structure before calling expansion function, OR update UI to send grouped structure.

### Status
- [x] Fix implemented (2026-01-03)
- [ ] Fix tested
- [ ] Fix audited

**Implementation Details:**
- Added `transformLocationsToGrouped()` function in `src/app/api/contractors/signup/route.ts`
- Groups flat location array by `type` field into `states`, `cities`, `counties`, `zipCodes`
- Uses Zod schema types for type safety

---

## Issue #2: Hardcoded Service IDs (CRITICAL)

### WHY This Is a Problem
The UI hardcodes service IDs as strings like `'roofing'` and `'hvac'`, but the database stores services with UUID primary keys like `'379e68d6-5ded-43da-a0ab-e607281740dc'`. When the API validates service IDs against the database, the hardcoded IDs will fail validation (or if validation is skipped, create orphaned records).

### WHEN This Occurs
When a contractor selects services in the UI. The selected service objects contain string IDs that don't match any database records.

### HOW It Manifests
```typescript
// UI SERVICE_TYPES constant (ServiceLocationQuizSimple.tsx lines 40-57):
const SERVICE_TYPES: ServiceType[] = [
  {
    id: 'roofing',  // ❌ String ID
    name: 'roofing',
    displayName: 'Roofing Services',
    ...
  }
];

// But database has:
// id: '379e68d6-5ded-43da-a0ab-e607281740dc'
// name: 'roofing'
// displayName: 'Roofing Services'
```

### Files Affected
- `src/components/contractor-signup/ServiceLocationQuizSimple.tsx` (hardcoded services)
- `src/app/api/contractors/signup/route.ts` (validates against DB)

### Fix Required
Fetch service types from database via API endpoint instead of using hardcoded list.

### Status
- [x] Fix implemented (2026-01-03)
- [ ] Fix tested
- [ ] Fix audited

**Implementation Details:**
- Removed hardcoded `SERVICE_TYPES` array from `ServiceLocationQuizSimple.tsx`
- Added `useEffect` to fetch from `/api/service-types` on mount
- Added loading and error states with retry button
- Uses database UUIDs for service IDs
- Added `SERVICE_ICONS` mapping for visual differentiation

---

## Issue #3: No Services Required Validation (HIGH)

### WHY This Is a Problem
The API allows contractors to sign up with zero services selected. This creates a buyer record with no service configurations, meaning they can never receive leads.

### WHEN This Occurs
When the signup API receives `selectedServices: []` (empty array).

### HOW It Manifests
```typescript
// Current validation schema allows empty:
selectedServices: z.array(z.any()).optional().default([]),

// No check for minimum services before creating buyer
```

### Files Affected
- `src/app/api/contractors/signup/route.ts`

### Fix Required
Add validation requiring at least 1 service selected.

### Status
- [x] Fix implemented (2026-01-03)
- [ ] Fix tested
- [ ] Fix audited

**Implementation Details:**
- Added validation in `signup/route.ts`: `if (selectedServices.length === 0)`
- Returns 400 error: "At least one service must be selected"
- Added proper Zod schema `serviceSchema` with UUID validation

---

## Issue #4: No Locations Required Validation (HIGH)

### WHY This Is a Problem
The API allows contractors to sign up with services but no location coverage. This creates service configs but no ZIP code records, meaning they can never match the eligibility query.

### WHEN This Occurs
When the signup API receives `serviceLocationMappings: []` (empty array) or mappings with empty locations.

### HOW It Manifests
```typescript
// Current validation schema allows empty:
serviceLocationMappings: z.array(z.any()).optional().default([]),

// Expansion returns empty if no mappings:
const expandedMappings = serviceLocationMappings.length > 0
  ? expandServiceLocationsToZipCodes(serviceLocationMappings)
  : [];  // ← Silent failure, no ZIP codes created
```

### Files Affected
- `src/app/api/contractors/signup/route.ts`

### Fix Required
Add validation requiring locations for each selected service.

### Status
- [x] Fix implemented (2026-01-03)
- [ ] Fix tested
- [ ] Fix audited

**Implementation Details:**
- Added validation in `signup/route.ts`: `if (serviceLocationMappings.length === 0)`
- Returns 400 error: "At least one service must have location coverage configured"
- Added `serviceLocationMappingSchema` with proper types

---

## Issue #5: No Per-Service Location Validation (MEDIUM)

### WHY This Is a Problem
A contractor can select 2 services (e.g., Roofing and HVAC) but only configure locations for 1 service. The other service will have a config but no ZIP codes.

### WHEN This Occurs
In the UI when navigating through the location step. The "Next" button only checks if `serviceLocationMappings.length === 0`, not if ALL selected services have locations.

### HOW It Manifests
```typescript
// Current check (ServiceLocationQuizSimple.tsx line 313):
<Button
  onClick={handleNext}
  disabled={serviceLocationMappings.length === 0}  // ❌ Only checks if ANY mappings exist
>
  Review Configuration
</Button>

// Should check:
disabled={!allServicesHaveLocations()}  // ✅ Check ALL services have locations
```

### Files Affected
- `src/components/contractor-signup/ServiceLocationQuizSimple.tsx`
- `src/app/api/contractors/signup/route.ts`

### Fix Required
1. UI: Validate all selected services have at least 1 location before proceeding
2. API: Validate all selected services have corresponding location mappings

### Status
- [x] Fix implemented (2026-01-03)
- [ ] Fix tested
- [ ] Fix audited

**Implementation Details:**
- **API**: Added validation comparing `serviceIds` with `servicesWithLocations` set
- Returns 400 error: "All selected services must have location coverage. Missing locations for: [service names]"
- Also validates each mapping has non-empty locations array
- **UI**: Added `allServicesHaveLocations()` and `getServicesWithoutLocations()` helper functions
- Button now disabled until all services configured
- Progress bar shows configuration status
- Service status chips show green/amber for configured/unconfigured

---

## Issue #6: UI Service Step Validation (MEDIUM)

### WHY This Is a Problem
The UI "Next" button on the services step is only disabled when `selectedServices.length === 0`. This is correct, but there's no visual feedback telling users they MUST select at least one service.

### WHEN This Occurs
When a contractor is on Step 2 (Services) and hasn't selected any services.

### HOW It Manifests
The button is disabled but there's no error message or required indicator explaining why.

### Files Affected
- `src/components/contractor-signup/ServiceLocationQuizSimple.tsx`

### Fix Required
Add visual indicator that at least 1 service is required.

### Status
- [x] Fix implemented (2026-01-03)
- [ ] Fix tested
- [ ] Fix audited

**Implementation Details:**
- Added visual feedback on services step showing "Selected: X services"
- Added amber warning when no services selected: "At least 1 service required"
- Button disabled state already exists, now with visual indicator
- Location step has progress bar and service status chips

---

## Implementation Order

Execute fixes in this order to maintain working state:

1. **Issue #2** (Hardcoded Service IDs) - Fetch services from DB first
2. **Issue #1** (Data Structure Mismatch) - Fix location format transformation
3. **Issue #3** (No Services Required) - Add API validation
4. **Issue #4** (No Locations Required) - Add API validation
5. **Issue #5** (Per-Service Locations) - Add comprehensive validation
6. **Issue #6** (UI Feedback) - Add visual indicators

---

## Testing Checklist

**All fixes implemented 2026-01-03. Manual testing required:**

- [ ] Can fetch services from database in UI
- [ ] Services display with correct UUIDs
- [ ] Cannot proceed without selecting a service (UI disabled + warning)
- [ ] Cannot proceed without configuring locations for each service (progress bar)
- [ ] Location data transforms correctly to grouped format
- [ ] ZIP codes expand correctly from locations
- [ ] API rejects empty services (400 error)
- [ ] API rejects missing locations per service (400 error)
- [ ] Full signup flow creates buyer + configs + ZIP codes
- [ ] Admin can see service coverage for new contractor

---

## Rollback Plan

If fixes cause issues:
1. Revert changes to `signup/route.ts`
2. Revert changes to `ServiceLocationQuizSimple.tsx`
3. Test that original (broken) flow still works for basic signup

---

## Related Files Reference

```
src/
├── app/
│   ├── api/
│   │   ├── contractors/
│   │   │   └── signup/route.ts          # Main signup API
│   │   └── services/
│   │       └── route.ts                  # Service types API (may need to create)
│   └── (public)/
│       └── contractors/
│           └── page.tsx                  # Main signup page
├── components/
│   └── contractor-signup/
│       └── ServiceLocationQuizSimple.tsx # Service/location selection UI
└── lib/
    └── services/
        └── location-expansion.ts         # Location to ZIP code expansion
```
