# Admin Field Mapping UI Update

## Goal
Update the admin field mapping editor to support separate PING/POST static fields and add a valueMap editor for database-driven value transformations.

---

## Current State
- Individual field mappings have `includeInPing`/`includeInPost` checkboxes (working)
- Static fields section shows only ONE `staticFields` object (needs split)
- No UI for editing `valueMap` on each field mapping (missing)

## Target State
- Separate PING Static Fields and POST Static Fields sections
- Inline valueMap editor for each field mapping
- Updated configuration summary showing PING/POST static field counts

---

## Tasks

### Task 1: Update FieldMappingEditor Static Fields Section
**File:** `src/components/admin/field-mapping/FieldMappingEditor.tsx`

**Changes:**
1. Replace single `staticFields` section (lines 254-300) with two sections:
   - "PING Static Fields" - edits `config.pingStaticFields`
   - "POST Static Fields" - edits `config.postStaticFields`
2. Update handlers:
   - `handleStaticFieldChange` → `handlePingStaticFieldChange` + `handlePostStaticFieldChange`
   - `handleStaticFieldDelete` → `handlePingStaticFieldDelete` + `handlePostStaticFieldDelete`
3. Update Configuration Summary to show:
   - PING Static Fields count: `Object.keys(config.pingStaticFields || {}).length`
   - POST Static Fields count: `Object.keys(config.postStaticFields || {}).length`

---

### Task 2: Add ValueMap Editor to MappingRow
**File:** `src/components/admin/field-mapping/MappingRow.tsx`

**Changes:**
1. Add new expandable section "Value Mappings" in the expanded details area (after line 246)
2. UI: Simple key-value pair editor
   ```
   Form Value     →    Buyer Value
   [within_3_months]   [Immediately]    [×]
   [repair]            [Repair]         [×]
   [+ Add mapping]
   ```
3. Add handler: `handleValueMapChange(sourceValue: string, targetValue: string)`
4. Add handler: `handleValueMapDelete(sourceValue: string)`
5. Store as: `mapping.valueMap = { "within_3_months": "Immediately", ... }`

---

### Task 3: Update generatePayloadPreview for New Structure
**File:** `src/lib/field-mapping/configuration-service.ts`

**Changes:**
1. Find `generatePayloadPreview` function
2. Update to use `pingStaticFields` for PING payload
3. Update to use `postStaticFields` for POST payload
4. Fallback to legacy `staticFields` for backward compatibility

---

### Task 4: Update PayloadPreview Stats
**File:** `src/components/admin/field-mapping/PayloadPreview.tsx`

**Changes:**
1. Update stats section (lines 164-178) to show:
   - PING static fields count
   - POST static fields count
   - (instead of combined "static fields" count)

---

## Acceptance Criteria

- [ ] Admin can add/edit/delete PING static fields separately from POST static fields
- [ ] Admin can add/edit/delete valueMap entries on each field mapping
- [ ] Payload preview shows correct PING payload with only pingStaticFields
- [ ] Payload preview shows correct POST payload with postStaticFields
- [ ] Existing configs with legacy `staticFields` still work (backward compatible)
- [ ] homePhoneConsentLanguage only appears in POST preview, not PING

---

## UI Mockup (Text)

```
┌─────────────────────────────────────────────────────┐
│ Field Mappings                                      │
│ ┌─────────────────────────────────────────────────┐ │
│ │ timeframe → buyTimeframe  [boolean.yesNo ▼]     │ │
│ │ ▼ Expanded:                                     │ │
│ │   [x] Required  [x] PING  [x] POST              │ │
│ │   Default: [___________]                        │ │
│ │   Value Mappings:                               │ │
│ │   [within_3_months] → [Immediately]        [×]  │ │
│ │   [3_plus_months]   → [1-6 months]         [×]  │ │
│ │   [not_sure]        → [Don't know]         [×]  │ │
│ │   [+ Add value mapping]                         │ │
│ └─────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────┤
│ PING Static Fields                                  │
│   tagId = [204670250]                          [×]  │
│   service = [WINDOWS]                          [×]  │
│   [+ Add PING static field]                         │
├─────────────────────────────────────────────────────┤
│ POST Static Fields                                  │
│   tagId = [204670250]                          [×]  │
│   service = [WINDOWS]                          [×]  │
│   homePhoneConsentLanguage = [By submitting...][×]  │
│   [+ Add POST static field]                         │
└─────────────────────────────────────────────────────┘
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/admin/field-mapping/FieldMappingEditor.tsx` | Split static fields into PING/POST sections |
| `src/components/admin/field-mapping/MappingRow.tsx` | Add valueMap editor UI |
| `src/lib/field-mapping/configuration-service.ts` | Update generatePayloadPreview |
| `src/components/admin/field-mapping/PayloadPreview.tsx` | Update stats display |

---

## Estimated Effort
- Task 1: ~30 min
- Task 2: ~45 min
- Task 3: ~15 min
- Task 4: ~10 min
- **Total: ~1.5-2 hours**
