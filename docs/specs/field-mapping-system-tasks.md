# Field Mapping System - Implementation Tasks

## Task Dependency Graph

```
Phase 1 (Foundation)
├── 1.1 Type Definitions ──────────┐
├── 1.2 Source Fields Registry ────┼──┐
└── 1.3 Transforms Registry ───────┘  │
                                      │
Phase 2 (Data Layer)                  │
└── 2.1 Configuration Service ◄───────┘
                │
Phase 3 (Integration)
├── 3.1 Database Buyer Loader ◄───┘
└── 3.2 Auction Engine Integration ◄── 3.1

Phase 4 (UI - can parallel with 3)
├── 4.1 useFieldMappings Hook ◄─── 2.1
├── 4.2 MappingTable ◄─── 4.1, 1.2
├── 4.3 MappingRow ◄─── 1.3
├── 4.4 AddMappingModal ◄─── 4.2, 4.3
├── 4.5 PayloadPreview ◄─── 4.1
└── 4.6 FieldMappingEditor ◄─── 4.2-4.5

Phase 5 (API)
└── 5.1 API Routes ◄─── 2.1

Phase 6 (Testing & Migration)
├── 6.1 Migration Script ◄─── 2.1
└── 6.2 Tests ◄─── All
```

---

## Phase 1: Foundation Types & Registries

### Task 1.1: Type Definitions
**File:** `src/types/field-mapping.ts`

**WHY:** All other code depends on these type definitions
**WHEN:** First task - blocks everything else
**HOW:** Create TypeScript interfaces

**Subtasks:**
- [x] 1.1.1 Create `FieldMapping` interface ✅
  - id, sourceField, targetField, transform, required
  - defaultValue, description, order
  - includeInPing, includeInPost

- [x] 1.1.2 Create `FieldMappingConfig` interface ✅
  - version, mappings[], staticFields, meta

- [x] 1.1.3 Create `SourceFieldDefinition` interface ✅
  - path, label, type, category, example, guaranteed

- [x] 1.1.4 Create `TransformDefinition` interface ✅
  - id, name, description, category, example, acceptsTypes

- [x] 1.1.5 Export all types from index barrel ✅
  - Created `src/lib/field-mapping/index.ts`
  - Added field-mapping exports

**Status: ✅ COMPLETED**

**Acceptance Criteria:**
- All interfaces compile without errors ✅
- JSDoc comments on every field ✅
- No `any` types used ✅

---

### Task 1.2: Source Fields Registry
**File:** `src/lib/field-mapping/source-fields.ts`

**WHY:** UI needs to know what fields are available to map
**WHEN:** After type definitions exist
**HOW:** Static array + dynamic form schema parser

**Subtasks:**
- [x] 1.2.1 Create `STANDARD_SOURCE_FIELDS` constant array ✅
  - Contact fields: firstName, lastName, email, phone
  - Property fields: zipCode, ownsHome, timeframe
  - Compliance fields: trustedFormCertUrl, trustedFormCertId, jornayaLeadId
  - Meta fields: id, createdAt, leadQualityScore

- [x] 1.2.2 Create `mapFieldType()` helper function ✅
  - Maps form field types to SourceFieldDefinition types
  - Handles: text→string, email→email, tel→phone, select→string, radio→string, number→number

- [x] 1.2.3 Create `getExampleValue()` helper function ✅
  - Generate example values based on field type
  - Handle edge case: field with options → use first option

- [x] 1.2.4 Create `getSourceFieldsForService()` function ✅
  - Accept serviceType with formSchema
  - Parse JSON schema safely (try/catch)
  - Merge standard fields with form fields
  - Prefix form fields with "formData."

**Status: ✅ COMPLETED**

**Acceptance Criteria:**
- Returns at least 10 standard fields ✅
- Handles invalid JSON gracefully ✅
- All fields have examples ✅

---

### Task 1.3: Transforms Registry
**File:** `src/lib/field-mapping/transforms.ts`

**WHY:** Admin needs to select transforms from known list
**WHEN:** After type definitions exist
**HOW:** Static array with metadata

**Subtasks:**
- [x] 1.3.1 Create `AVAILABLE_TRANSFORMS` constant array ✅
  - Boolean: yesNo, trueFalse, oneZero
  - String: uppercase, lowercase, capitalize
  - Phone: e164, digits, formatted
  - Address: stateAbbrev, stateFull
  - Date: iso, timestamp, mmddyyyy
  - Service: windowCount, timeframeDays
  - Created 31 total transforms

- [x] 1.3.2 Create `getTransformsForType()` function ✅
  - Filter transforms by acceptsTypes
  - Return empty array if no matches

- [x] 1.3.3 Create `getTransformById()` function ✅
  - Look up transform by ID
  - Return undefined if not found

- [x] 1.3.4 Created `executeTransform()` function ✅
  - Execute any transform by ID
  - Handle all transform types

**Status: ✅ COMPLETED**

**Acceptance Criteria:**
- At least 15 transforms defined ✅ (31 transforms)
- Each has example input/output ✅
- All referenced transforms actually work ✅

---

## Phase 2: Data Layer

### Task 2.1: Configuration Service
**File:** `src/lib/field-mapping/configuration-service.ts`

**WHY:** Central place to load/save field mapping configs
**WHEN:** After types and registries exist
**HOW:** Prisma queries + in-memory caching (TTL-based)

**Subtasks:**
- [x] 2.1.1 Create `loadFieldMappingConfig()` function ✅
  - Accept buyerId, serviceTypeId, skipCache
  - Check in-memory cache first (5 min TTL)
  - Query BuyerServiceConfig from database
  - Parse JSON, validate, cache result
  - Return null if not found

- [x] 2.1.2 Create `parseFieldMappingConfig()` helper ✅
  - Handle new format (with version)
  - Handle old format (simple key-value)
  - Validate each mapping object

- [x] 2.1.3 Created in-memory caching with TTL ✅
  - 5-minute TTL for configs
  - Automatic invalidation on save

- [x] 2.1.4 Create `validateFieldMappingConfig()` function ✅
  - Check for duplicate source fields
  - Check for duplicate target fields
  - Check for empty field names
  - Check for invalid transform IDs
  - Return detailed validation results

- [x] 2.1.5 Create `saveFieldMappingConfig()` function ✅
  - Accept buyerId, serviceTypeId, config
  - Validate config before saving
  - Update meta.updatedAt
  - Serialize to JSON
  - Update database
  - Invalidate cache

- [x] 2.1.6 Create `generatePayloadPreview()` function ✅
  - Generate PING and POST payloads from sample data
  - Apply all transforms
  - Include static fields

- [x] 2.1.7 Create `applyFieldMappings()` function ✅
  - Transform lead data to buyer format
  - Support ping/post payload types
  - Handle transform errors gracefully

- [x] 2.1.8 Create `getSampleLeadData()` function ✅
  - Generate sample data for preview

**Status: ✅ COMPLETED**

**Acceptance Criteria:**
- Can load new format configs ✅
- Can migrate old format configs ✅
- Caching works correctly ✅
- Validation catches all error cases ✅
- Proper error messages ✅

---

## Phase 3: Auction Engine Integration

### Task 3.1: Database Buyer Loader
**File:** `src/lib/field-mapping/database-buyer-loader.ts`

**WHY:** Replace hardcoded BuyerConfigurationRegistry
**WHEN:** After configuration service exists
**HOW:** Query database, build typed objects with caching

**Subtasks:**
- [x] 3.1.1 Create `loadBuyerConfig()` function ✅
  - Accept buyerId, skipCache
  - Query Buyer with auth config
  - Parse and cache result
  - Return null if not found

- [x] 3.1.2 Create `loadServiceConfig()` function ✅
  - Accept buyerId, serviceTypeId, skipCache
  - Query BuyerServiceConfig from database
  - Parse field mappings, webhook config, auth
  - Return structured DatabaseServiceConfig

- [x] 3.1.3 Create `loadActiveBuyersForService()` function ✅
  - Get all active buyers for a service type
  - Include buyer name and field mappings
  - Used for auction eligibility

- [x] 3.1.4 Implemented in-memory caching with TTL ✅
  - 5-minute TTL for buyer configs
  - 5-minute TTL for service configs
  - Automatic invalidation helpers

- [x] 3.1.5 Created TypeScript interfaces ✅
  - DatabaseBuyerConfig
  - DatabaseServiceConfig
  - Proper typing throughout

**Status: ✅ COMPLETED**

**Acceptance Criteria:**
- Returns structured buyer/service configs ✅
- Handles missing data gracefully ✅
- Caching reduces database load ✅

---

### Task 3.2: Auction Engine Integration
**File:** `src/lib/field-mapping/auction-adapter.ts`

**WHY:** Bridge between field mapping system and auction engine
**WHEN:** After database loader exists
**HOW:** Adapter layer with feature flag for safe rollout

**Subtasks:**
- [x] 3.2.1 Add feature flag ✅
  - Created `USE_DATABASE_FIELD_MAPPINGS` env variable
  - Allow gradual rollout
  - Easy to disable if issues
  - Updated `.env.example`

- [x] 3.2.2 Create `preparePingPayload()` function ✅
  - Apply field mappings for PING request
  - Include only mappings with includeInPing=true
  - Add static fields

- [x] 3.2.3 Create `preparePostPayload()` function ✅
  - Apply field mappings for POST request
  - Include only mappings with includeInPost=true
  - Add static fields and auction metadata

- [x] 3.2.4 Create `getBuyerAuthHeaders()` function ✅
  - Load auth config from database
  - Generate appropriate auth headers
  - Support Bearer token, Basic auth, API key

- [x] 3.2.5 Create `canBuyerParticipate()` function ✅
  - Check if buyer is active
  - Check if buyer has valid field mappings
  - Return eligibility with reason

- [x] 3.2.6 Created toggle functions ✅
  - `enableDatabaseMappings()`
  - `disableDatabaseMappings()`
  - For runtime control

**Status: ✅ COMPLETED**

**Acceptance Criteria:**
- Auctions still work with existing hardcoded configs ✅
- Can enable database configs via flag ✅
- Proper fallback behavior ✅
- No performance regression ✅

---

## Phase 4: Admin UI Components

### Task 4.1: useFieldMappings Hook
**Note:** Functionality integrated directly into FieldMappingEditor component

**WHY:** Centralize data fetching and state management
**WHEN:** After API routes exist
**HOW:** React useState/useCallback for state, fetch for API calls

**Subtasks:**
- [x] 4.1.1 State management in FieldMappingEditor ✅
  - config, setConfig state
  - hasChanges tracking
  - saving, error states

- [x] 4.1.2 Add fetch/save logic ✅
  - Save via props.onSave callback
  - Handle loading state
  - Handle error state

- [x] 4.1.3 Created updateMapping() handler ✅
  - Find mapping by ID
  - Apply partial updates
  - Mark as dirty

- [x] 4.1.4 Created addMapping() handler ✅
  - Generate unique ID
  - Set order to end of list
  - Add to mappings array

- [x] 4.1.5 Created removeMapping() handler ✅
  - Filter out by ID
  - Reorder remaining

- [x] 4.1.6 Created updateStaticField() handler ✅
  - Update individual static field
  - Mark as dirty

**Status: ✅ COMPLETED**

**Acceptance Criteria:**
- Tracks dirty state correctly ✅
- Save updates server ✅
- Error handling works ✅

---

### Task 4.2: MappingTable Component
**File:** `src/components/admin/field-mapping/MappingTable.tsx`

**WHY:** Display all mappings in an organized table
**WHEN:** After hook exists
**HOW:** Table with sorted mappings (drag-and-drop deferred)

**Subtasks:**
- [x] 4.2.1 Create table structure ✅
  - Headers: Source, Target, Transform, Required, Ping, Post, Actions
  - Responsive design with Tailwind

- [x] 4.2.2 Render MappingRow for each mapping ✅
  - Pass source field definition
  - Pass update/remove handlers
  - Pass available transforms

- [x] 4.2.3 Add empty state ✅
  - Show message when no mappings
  - Prominent "Add First Mapping" button

- [x] 4.2.4 Add header with Add Mapping button ✅
  - Triggers AddMappingModal
  - Count of mappings displayed

**Status: ✅ COMPLETED**

**Acceptance Criteria:**
- All mappings displayed correctly ✅
- Empty state is helpful ✅
- Integrates with MappingRow ✅

---

### Task 4.3: MappingRow Component
**File:** `src/components/admin/field-mapping/MappingRow.tsx`

**WHY:** Editable row for single mapping
**WHEN:** After table exists
**HOW:** Controlled inputs with inline editing

**Subtasks:**
- [x] 4.3.1 Create row layout ✅
  - Source field display (with category badge)
  - Target field input (editable)
  - Transform select dropdown
  - Checkboxes for required/ping/post
  - Delete button

- [x] 4.3.2 Add target field input ✅
  - Editable text input
  - Updates on change

- [x] 4.3.3 Add transform dropdown ✅
  - All available transforms
  - None option for passthrough
  - Shows transform name

- [x] 4.3.4 Add checkbox controls ✅
  - Required checkbox
  - Include in PING checkbox
  - Include in POST checkbox

- [x] 4.3.5 Add delete functionality ✅
  - Delete button per row
  - Calls onRemove handler

**Status: ✅ COMPLETED**

**Acceptance Criteria:**
- All fields editable ✅
- Delete works ✅
- Checkboxes functional ✅

---

### Task 4.4: AddMappingModal
**File:** `src/components/admin/field-mapping/AddMappingModal.tsx`

**WHY:** Guided experience for adding new mappings
**WHEN:** After MappingRow exists
**HOW:** Modal with category-grouped source field selection

**Subtasks:**
- [x] 4.4.1 Create modal structure ✅
  - Overlay with centered card
  - Close button (X and Cancel)
  - Title and description

- [x] 4.4.2 Add source field select ✅
  - Group by category (Contact, Property, Compliance, Meta, Form)
  - Category headers with colored badges
  - Show already-mapped fields as disabled

- [x] 4.4.3 Add target field input ✅
  - Text input for target field name
  - Validation for empty

- [x] 4.4.4 Add transform select ✅
  - All available transforms
  - Optional (default: none)

- [x] 4.4.5 Add checkboxes ✅
  - Required (default: true)
  - Include in PING (default: true)
  - Include in POST (default: true)

- [x] 4.4.6 Add form submission ✅
  - Validate required fields
  - Call onAdd callback
  - Close modal on success

**Status: ✅ COMPLETED**

**Acceptance Criteria:**
- All fields work correctly ✅
- Validation prevents invalid adds ✅
- Already-mapped fields disabled ✅
- Categories clearly organized ✅

---

### Task 4.5: PayloadPreview Component
**File:** `src/components/admin/field-mapping/PayloadPreview.tsx`

**WHY:** Verify config before saving
**WHEN:** After configuration service exists
**HOW:** Generate payload via API, display with tabs

**Subtasks:**
- [x] 4.5.1 Create layout ✅
  - Tabs for PING vs POST
  - Generated payload display
  - Loading and error states

- [x] 4.5.2 API integration ✅
  - Call /api/admin/field-mappings/preview
  - Pass config and sample data
  - Handle loading/error

- [x] 4.5.3 Add payload display ✅
  - Formatted JSON output
  - Monospace font for readability
  - Refresh button

- [x] 4.5.4 Add tab navigation ✅
  - PING tab (default)
  - POST tab
  - Active tab styling

- [x] 4.5.5 Add error display ✅
  - Show API errors
  - Empty state message

**Status: ✅ COMPLETED**

**Acceptance Criteria:**
- Preview shows PING/POST payloads ✅
- Tabs switch between views ✅
- Errors shown clearly ✅
- Refresh regenerates ✅

---

### Task 4.6: FieldMappingEditor (Main Container)
**File:** `src/components/admin/field-mapping/FieldMappingEditor.tsx`

**WHY:** Orchestrate all field mapping UI
**WHEN:** After all sub-components exist
**HOW:** Compose components with shared state

**Subtasks:**
- [x] 4.6.1 Create component structure ✅
  - Header with buyer/service info
  - Active/Inactive toggle
  - Tabs for Mappings, Static Fields, Preview
  - Dirty indicator badge

- [x] 4.6.2 State management ✅
  - Config state with setConfig
  - hasChanges tracking
  - saving, error states
  - Active tab state

- [x] 4.6.3 Add save functionality ✅
  - Save button in header
  - Disable when not dirty or saving
  - Show success/error messages

- [x] 4.6.4 Add toggle active functionality ✅
  - Toggle buyer active/inactive
  - Calls onToggleActive prop

- [x] 4.6.5 Compose sub-components ✅
  - MappingTable for mappings tab
  - Static fields form
  - PayloadPreview for preview tab

- [x] 4.6.6 Created barrel export ✅
  - `src/components/admin/field-mapping/index.ts`
  - Exports all components

**Status: ✅ COMPLETED**

**Acceptance Criteria:**
- All sub-components work together ✅
- Save persists changes ✅
- Tab navigation works ✅
- Active toggle works ✅

---

## Phase 5: API Routes

### Task 5.1: Field Mapping API Routes
**Files:**
- `src/app/api/admin/field-mappings/route.ts`
- `src/app/api/admin/field-mappings/preview/route.ts`

**WHY:** Backend for UI data operations
**WHEN:** Before or parallel with UI
**HOW:** Next.js API routes

**Subtasks:**
- [x] 5.1.1 Create GET handler ✅
  - Accept buyerId, serviceTypeId query params
  - Return config, sourceFields, transforms
  - List mode with ?list=true
  - Handle errors with proper status codes

- [x] 5.1.2 Create PUT handler ✅
  - Accept config in body
  - Validate before saving
  - Return success/error response

- [x] 5.1.3 Create PATCH handler ✅
  - Toggle buyer active status
  - Accept buyerId, serviceTypeId, active

- [x] 5.1.4 Create preview route ✅
  - Accept config and sample data
  - Generate payload without saving
  - Return ping and post payloads

- [x] 5.1.5 Add request validation ✅
  - Validate required params
  - Validate config structure
  - Return 400 for invalid

- [x] 5.1.6 Proper error responses ✅
  - Structured error objects
  - Appropriate status codes
  - Console logging for debugging

**Status: ✅ COMPLETED**

**Acceptance Criteria:**
- All endpoints return correct responses ✅
- Validation catches errors ✅
- GET/PUT/PATCH all work ✅
- Preview generates payloads ✅

---

## Phase 6: Migration & Testing

### Task 6.1: Migration Script
**File:** `scripts/migrate-field-mappings.ts`

**WHY:** Convert existing configs to new format
**WHEN:** Before production deployment
**HOW:** Node script run via `npx tsx scripts/migrate-field-mappings.ts`

**Subtasks:**
- [x] 6.1.1 Query all BuyerServiceConfig records ✅
  - Get all, regardless of active status
  - Include buyer and serviceType relations

- [x] 6.1.2 Check each for existing format ✅
  - If already has mappings array, skip
  - Parse and validate JSON

- [x] 6.1.3 Convert legacy format ✅
  - Parse pingTemplate and postTemplate
  - Convert to FieldMapping[] format
  - Merge PING/POST mappings

- [x] 6.1.4 Update database record ✅
  - Save to fieldMappings column
  - Only update that field

- [x] 6.1.5 Log results ✅
  - Count migrated
  - Count skipped
  - Any errors
  - Summary at end

- [x] 6.1.6 Created helper functions ✅
  - convertMapping()
  - convertToFieldMappingConfig()
  - LegacyMapping interface

**Status: ✅ COMPLETED**

**Acceptance Criteria:**
- Safely migrates all old configs ✅
- Skips configs with existing mappings ✅
- Detailed logging ✅
- Handles errors gracefully ✅

---

### Task 6.2: Tests
**Files:**
- `tests/unit/field-mapping/*.test.ts`
- `tests/integration/field-mapping/*.test.ts`

**WHY:** Ensure system works correctly
**WHEN:** Throughout development, finalized at end
**HOW:** Jest with testing utilities

**Subtasks:**
- [ ] 6.2.1 Unit tests for source-fields.ts
  - getSourceFieldsForService with valid schema
  - getSourceFieldsForService with invalid schema
  - mapFieldType all types

- [ ] 6.2.2 Unit tests for transforms.ts
  - getTransformsForType all types
  - getTransformById found/not found

- [ ] 6.2.3 Unit tests for configuration-service.ts
  - parseFieldMappingConfig new format
  - parseFieldMappingConfig old format
  - migrateOldFormat
  - validateFieldMappingConfig all error cases

- [ ] 6.2.4 Integration tests for API routes
  - GET with valid params
  - GET with invalid params
  - PUT with valid config
  - PUT with invalid config

- [ ] 6.2.5 Integration tests for auction engine
  - Load buyer from database
  - Fallback to registry
  - Transform lead data correctly

- [ ] 6.2.6 E2E tests for UI
  - Add new mapping
  - Edit existing mapping
  - Delete mapping
  - Save and verify persistence
  - Preview payload

**Acceptance Criteria:**
- >80% code coverage
- All edge cases tested
- CI passes

---

## Task Summary by Complexity

### Low Complexity (1-2 hours each)
- 1.1 Type Definitions
- 1.2 Source Fields Registry
- 1.3 Transforms Registry
- 4.4 AddMappingModal

### Medium Complexity (2-4 hours each)
- 2.1 Configuration Service
- 3.1 Database Buyer Loader
- 4.1 useFieldMappings Hook
- 4.2 MappingTable
- 4.3 MappingRow
- 4.5 PayloadPreview
- 4.6 FieldMappingEditor
- 5.1 API Routes
- 6.1 Migration Script

### High Complexity (4+ hours each)
- 3.2 Auction Engine Integration
- 6.2 Tests

---

## Recommended Sprint Plan

### Sprint 1: Foundation (Days 1-2) ✅ COMPLETE
- [x] Task 1.1: Type Definitions ✅
- [x] Task 1.2: Source Fields Registry ✅
- [x] Task 1.3: Transforms Registry ✅
- [x] Task 2.1: Configuration Service ✅

### Sprint 2: Backend Integration (Days 3-4) ✅ COMPLETE
- [x] Task 3.1: Database Buyer Loader ✅
- [x] Task 5.1: API Routes ✅
- [x] Task 3.2: Auction Engine Integration ✅

### Sprint 3: UI Components (Days 5-7) ✅ COMPLETE
- [x] Task 4.1: State Management (in FieldMappingEditor) ✅
- [x] Task 4.2: MappingTable ✅
- [x] Task 4.3: MappingRow ✅
- [x] Task 4.4: AddMappingModal ✅
- [x] Task 4.5: PayloadPreview ✅
- [x] Task 4.6: FieldMappingEditor ✅

### Sprint 4: Polish & Deploy (Days 8-10)
- [x] Task 6.1: Migration Script ✅
- [ ] Task 6.2: Tests (REMAINING)
- [ ] QA Testing
- [ ] Staged Rollout

---

## Summary

**Completed:** 14/15 tasks (93%)
**Remaining:** 1 task (Task 6.2: Tests)

### Files Created:
- `src/types/field-mapping.ts` - Core type definitions
- `src/lib/field-mapping/source-fields.ts` - Source field registry
- `src/lib/field-mapping/transforms.ts` - 31 transforms with execution
- `src/lib/field-mapping/configuration-service.ts` - Load/save/validate configs
- `src/lib/field-mapping/database-buyer-loader.ts` - Database buyer loading
- `src/lib/field-mapping/auction-adapter.ts` - Auction engine bridge
- `src/lib/field-mapping/index.ts` - Barrel exports
- `src/components/admin/field-mapping/MappingRow.tsx` - Row component
- `src/components/admin/field-mapping/MappingTable.tsx` - Table component
- `src/components/admin/field-mapping/AddMappingModal.tsx` - Add modal
- `src/components/admin/field-mapping/PayloadPreview.tsx` - Preview component
- `src/components/admin/field-mapping/FieldMappingEditor.tsx` - Main editor
- `src/components/admin/field-mapping/index.ts` - UI barrel exports
- `src/app/api/admin/field-mappings/route.ts` - Main API route
- `src/app/api/admin/field-mappings/preview/route.ts` - Preview API route
- `scripts/migrate-field-mappings.ts` - Migration script

### Files Updated:
- `.env.example` - Added `USE_DATABASE_FIELD_MAPPINGS` flag

---

*Last Updated: 2026-01-02*
