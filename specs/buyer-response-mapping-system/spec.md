# Buyer Response Mapping System Specification

## Overview

Build a flexible, configurable response mapping system that allows each lead buyer network to use their own terminology for status values, bid fields, and HTTP status codes - all configurable via the Admin UI.

---

## Problem Statement

Currently, the auction system has **hardcoded response expectations**:
- PING statuses: Only `accepted`, `rejected`, `error`
- POST statuses: Only `delivered`, `failed`, `duplicate`, `invalid`
- Bid fields: Fixed list of 8 field names
- Status field: Always assumes `body.status`

**Real-world impact**: If HomeAdvisor sends `"status": "interested"` instead of `"accepted"`, the system fails. Different networks use different terminology.

---

## User Stories

### US-1: Admin Configures Response Mappings

**WHY**: Different lead buyer networks (HomeAdvisor, Modernize, Angi, etc.) use different terminology in their API responses. Without configurable mappings, we must hardcode each variation, which doesn't scale.

**WHEN**: When onboarding a new buyer or when an existing buyer changes their API response format.

**HOW**: Admin navigates to Buyer Settings > Response Configuration, sees a form with:
- Status field name (where to find status in response)
- PING status mappings (which values mean accepted/rejected/error)
- POST status mappings (which values mean delivered/failed/duplicate/invalid)
- Bid amount field names (priority-ordered list)
- HTTP status code interpretations

---

### US-2: System Parses Buyer Responses Flexibly

**WHY**: The auction engine and webhook handler must interpret responses correctly regardless of the buyer's terminology. A buyer saying `"sold"` must be treated the same as another saying `"delivered"`.

**WHEN**: Every time we receive a PING response (during auction) or POST response (via webhook).

**HOW**:
1. Load buyer's response mapping config from cache/database
2. Extract status from configured field (default: `status`)
3. Normalize status value using buyer's mapping
4. Return standardized internal status for processing

---

### US-3: Default Mappings Cover Common Variations

**WHY**: Most buyers will use common terms. Pre-populating defaults reduces admin configuration work and handles 80% of cases automatically.

**WHEN**: When creating a new buyer or when no custom mapping exists.

**HOW**: System provides comprehensive defaults:
- Accepted: `accepted, interested, bid, yes, qualified, ok`
- Rejected: `rejected, declined, pass, no, deny, not_interested`
- Delivered: `delivered, sold, success, complete, confirmed`
- Failed: `failed, rejected, error, declined, denied`

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Admin UI                                  │
│  BuyerForm.tsx → ResponseMappingEditor (new component)          │
└─────────────────────────┬───────────────────────────────────────┘
                          │ Save
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Database                                    │
│  buyers.response_mapping_config (JSON column)                   │
└─────────────────────────┬───────────────────────────────────────┘
                          │ Load (cached)
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│              BuyerResponseParser Service                        │
│  - parsePingResponse(buyerId, httpStatus, body)                 │
│  - parsePostResponse(buyerId, httpStatus, body)                 │
│  - normalizePingStatus(rawStatus, config)                       │
│  - normalizePostStatus(rawStatus, config)                       │
│  - extractBidAmount(body, config)                               │
└─────────────────────────┬───────────────────────────────────────┘
                          │ Used by
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  Auction Engine (engine.ts)    │  Webhook Handler (route.ts)   │
│  - Uses parser for PING        │  - Uses parser for webhooks   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tasks

### Phase 1: Foundation

- [ ] **Task 1.1**: Create TypeScript types for response mapping configuration
- [ ] **Task 1.2**: Add database migration for response_mapping_config column on buyers table
- [ ] **Task 1.3**: Create default response mappings constant with comprehensive variations
- [ ] **Task 1.4**: Create BuyerResponseParser service with core parsing methods

### Phase 2: Integration

- [ ] **Task 2.1**: Integrate parser into auction engine (engine.ts) for PING responses
- [ ] **Task 2.2**: Integrate parser into webhook handler (route.ts) for POST responses
- [ ] **Task 2.3**: Add caching layer for response mappings (1-minute TTL)

### Phase 3: Admin UI

- [ ] **Task 3.1**: Create ResponseMappingEditor component
- [ ] **Task 3.2**: Integrate ResponseMappingEditor into BuyerForm.tsx
- [ ] **Task 3.3**: Add API endpoint for saving/loading response mappings

### Phase 4: Testing & Validation

- [ ] **Task 4.1**: Add unit tests for BuyerResponseParser
- [ ] **Task 4.2**: Add integration tests for response parsing in auction flow
- [ ] **Task 4.3**: Manual E2E testing with different response formats

---

## Detailed Task Specifications

### Task 1.1: TypeScript Types

**File**: `src/types/response-mapping.ts`

```typescript
interface ResponseMappingConfig {
  // Where to find status in response body (supports dot notation)
  statusField: string;  // Default: "status"

  // PING response mappings (buyer value -> internal status)
  pingMappings: {
    accepted: string[];   // Values that mean "accepted"
    rejected: string[];   // Values that mean "rejected"
    error: string[];      // Values that mean "error"
  };

  // POST response mappings
  postMappings: {
    delivered: string[];  // Values that mean "delivered"
    failed: string[];     // Values that mean "failed"
    duplicate: string[];  // Values that mean "duplicate"
    invalid: string[];    // Values that mean "invalid"
  };

  // Bid amount field names (in priority order)
  bidAmountFields: string[];

  // HTTP status code interpretation
  httpStatusMapping: {
    [code: number]: 'success' | 'reject' | 'retry' | 'error';
  };

  // Optional: success indicator in body (for HTTP 200 with body rejection)
  successIndicator?: {
    field: string;
    successValues: string[];
  };
}
```

### Task 1.3: Default Mappings

**File**: `src/lib/buyers/default-response-mappings.ts`

Comprehensive defaults covering common variations across networks.

### Task 1.4: BuyerResponseParser Service

**File**: `src/lib/buyers/response-parser.ts`

Core methods:
- `parsePingResponse(buyerId, httpStatus, body)` → `ParsedPingResponse`
- `parsePostResponse(buyerId, httpStatus, body)` → `ParsedPostResponse`
- `getConfig(buyerId)` → `ResponseMappingConfig` (cached)
- `invalidateCache(buyerId)` → void

### Task 3.1: ResponseMappingEditor Component

**File**: `src/components/admin/buyers/ResponseMappingEditor.tsx`

Sections:
1. Status Field Configuration
2. PING Response Mappings (tag input for each status)
3. POST Response Mappings (tag input for each status)
4. Bid Amount Fields (sortable list)
5. HTTP Status Code Mappings (optional advanced section)

---

## Success Criteria

1. **Flexibility**: Any buyer terminology can be mapped without code changes
2. **Backwards Compatible**: Existing buyers work with defaults
3. **Performant**: Mappings cached, no DB hit per request
4. **Admin Friendly**: Clear UI with sensible defaults
5. **Maintainable**: Single source of truth for parsing logic

---

## Out of Scope

- Response transformation (changing response structure)
- Request mapping (already handled by field-mapping system)
- Automatic detection of buyer response format
- Multi-language support for status values
