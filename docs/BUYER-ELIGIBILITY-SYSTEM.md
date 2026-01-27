# Buyer Eligibility System

Documentation for how buyers are matched to leads and calls based on service type, geographic coverage, and configuration flags.

## Overview

The eligibility system determines which buyers can participate in auctions for:
- **Web Leads** - Form submissions from the website
- **Phone Calls** - Inbound calls through the pay-per-call system

Both systems use similar logic but are implemented in different code paths.

## Eligibility Criteria

A buyer is eligible for a lead/call when ALL of the following are true:

| Criterion | Table/Field | Description |
|-----------|------------|-------------|
| **Buyer Active** | `buyers.active = true` | Master on/off switch for buyer |
| **Service Config Active** | `buyer_service_configs.active = true` | Per-service on/off |
| **Service Type Active** | `service_types.active = true` | Service must be enabled |
| **Geographic Coverage** | See [Geographic Matching](#geographic-matching) | ZIP code or nationwide |
| **Daily Caps** | Various | Not exceeding daily limits |

### Additional Criteria for Calls

| Criterion | Table/Field | Description |
|-----------|------------|-------------|
| **Accepts Calls** | `buyers.accepts_calls = true` | Buyer enabled for calls |
| **Call Bid Configured** | `buyer_service_configs.call_bid_amount IS NOT NULL` | Has call pricing |

---

## Geographic Matching

There are **two ways** a buyer can match geographically:

### 1. Explicit Nationwide Flag (Recommended)

```sql
buyer_service_configs.nationwide = true
```

When enabled, the buyer participates in **all leads/calls** for that service, regardless of ZIP code. The buyer filters leads/calls via their PING response (accept/reject).

**Use case:** Network buyers like Modernize, Koalaty Leads who have their own geographic filtering.

### 2. ZIP Code Entries

```sql
buyer_service_zip_codes (buyer_id, service_type_id, zip_code)
```

Buyer only receives leads/calls matching specific ZIP codes in their coverage list.

**Use case:** Regional contractors or buyers with specific geographic requirements.

### 3. Implicit Nationwide (Legacy)

If a buyer has:
- `nationwide = false` (or null)
- AND **zero** entries in `buyer_service_zip_codes` for that service

They are treated as nationwide (same as `nationwide = true`).

**Note:** This is the legacy behavior for backward compatibility. New buyers should use the explicit `nationwide` flag.

---

## Flow Diagrams

### Web Lead Eligibility Flow

```
Lead Submitted
      │
      ▼
┌─────────────────────────┐
│ BuyerEligibilityService │
│ .getEligibleBuyers()    │
└───────────┬─────────────┘
            │
            ▼
    ┌───────────────┐
    │ Check ZIP     │
    │ Matched Buyers│───────────┐
    └───────┬───────┘           │
            │                   │
            ▼                   ▼
    ┌───────────────┐   ┌───────────────┐
    │ Get Nationwide │   │ Found ZIP     │
    │ Buyers        │   │ Matches       │
    └───────┬───────┘   └───────┬───────┘
            │                   │
            └─────────┬─────────┘
                      │
                      ▼
              ┌───────────────┐
              │ Deduplicate   │
              │ & Combine     │
              └───────┬───────┘
                      │
                      ▼
              ┌───────────────┐
              │ Check:        │
              │ - buyer.active│
              │ - config.active│
              │ - daily caps  │
              └───────┬───────┘
                      │
                      ▼
              Eligible Buyers
```

### Call Eligibility Flow

```
Call Received
      │
      ▼
┌─────────────────────────┐
│ CallAuctionEngine       │
│ .getEligibleCallBuyers()│
└───────────┬─────────────┘
            │
            ▼
    ┌───────────────────┐
    │ Query buyers with │
    │ accepts_calls=true│
    │ & call_bid_amount │
    └───────┬───────────┘
            │
            ▼
    For each buyer:
    ┌───────────────────┐
    │ buyerCoversZipCode│
    │ - Check nationwide│
    │ - OR check ZIP    │
    │   entries         │
    │ - OR implicit     │
    │   nationwide      │
    └───────┬───────────┘
            │
            ▼
    ┌───────────────────┐
    │ Check daily caps  │
    └───────┬───────────┘
            │
            ▼
    Eligible Call Buyers
```

---

## Database Schema

### buyers

```sql
CREATE TABLE buyers (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  active BOOLEAN DEFAULT true,     -- Master on/off
  accepts_calls BOOLEAN DEFAULT false,  -- For call system
  -- ... other fields
);
```

### buyer_service_configs

```sql
CREATE TABLE buyer_service_configs (
  id UUID PRIMARY KEY,
  buyer_id UUID REFERENCES buyers(id),
  service_type_id UUID REFERENCES service_types(id),
  active BOOLEAN DEFAULT true,      -- Per-service on/off
  nationwide BOOLEAN DEFAULT false, -- Participates in ALL ZIPs

  -- Lead fields
  field_mappings TEXT,              -- JSON field mapping config
  ping_template TEXT,               -- PING URL config
  post_template TEXT,               -- POST URL config

  -- Call fields
  call_bid_amount DECIMAL(10,2),    -- Call bid price
  call_ping_url TEXT,               -- Call PING endpoint
  call_field_mappings JSONB,        -- Call field mapping
  call_daily_cap INT,               -- Max calls per day

  UNIQUE(buyer_id, service_type_id)
);
```

### buyer_service_zip_codes

```sql
CREATE TABLE buyer_service_zip_codes (
  id UUID PRIMARY KEY,
  buyer_id UUID REFERENCES buyers(id),
  service_type_id UUID REFERENCES service_types(id),
  zip_code TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  priority INT DEFAULT 100,
  max_leads_per_day INT,

  UNIQUE(buyer_id, service_type_id, zip_code)
);
```

---

## Code References

### Web Leads

| File | Function | Purpose |
|------|----------|---------|
| `src/lib/services/buyer-eligibility-service.ts` | `getEligibleBuyers()` | Main eligibility check |
| `src/lib/services/buyer-eligibility-service.ts` | `getNationwideBuyers()` | Gets nationwide buyers |
| `src/lib/auction/engine.ts` | `getEligibleBuyers()` | Auction engine wrapper |

### Calls

| File | Function | Purpose |
|------|----------|---------|
| `src/lib/auction/call-engine.ts` | `getEligibleCallBuyers()` | Main call eligibility |
| `src/lib/auction/call-engine.ts` | `buyerCoversZipCode()` | Geographic check |

---

## Admin UI

The **Nationwide Coverage** toggle is available in the admin panel:

**Location:** Admin → Buyers → [Select Buyer] → Service Coverage Tab

Each service config shows:
- Active/Inactive status
- Nationwide Coverage toggle
- ZIP code count
- Compliance requirements (TrustedForm, Jornaya)

### API Endpoints

```
GET  /api/admin/buyers/[id]/service-config
     Returns service configs with nationwide flag

PATCH /api/admin/buyers/[id]/service-config
     Body: { serviceTypeId, nationwide?: boolean, active?: boolean }
     Updates service config settings
```

---

## Common Scenarios

### Scenario 1: Add a New Nationwide Buyer

1. Create buyer record with `active = false`
2. Create `buyer_service_configs` for each service
3. Set `nationwide = true` on each config
4. Configure field mappings for PING/POST
5. Set `active = true` when ready to go live

### Scenario 2: Restrict an Existing Buyer to Specific ZIPs

1. Set `nationwide = false` on their service config
2. Import ZIP codes into `buyer_service_zip_codes`
3. Buyer will now only receive matching leads

### Scenario 3: Debug Why Buyer Isn't Receiving Leads

Check in order:
1. `buyers.active = true`?
2. `buyer_service_configs.active = true` for the service?
3. `service_types.active = true`?
4. If not nationwide, do they have ZIP code entries matching the lead?
5. Have they hit daily caps?

```sql
-- Check buyer eligibility
SELECT
  b.name,
  b.active as buyer_active,
  bsc.active as config_active,
  bsc.nationwide,
  st.active as service_active,
  (SELECT COUNT(*) FROM buyer_service_zip_codes
   WHERE buyer_id = b.id AND service_type_id = st.id) as zip_count
FROM buyers b
JOIN buyer_service_configs bsc ON b.id = bsc.buyer_id
JOIN service_types st ON bsc.service_type_id = st.id
WHERE b.name = 'Buyer Name';
```

---

## Testing

### Test Nationwide Buyer

```sql
-- Set buyer as nationwide
UPDATE buyer_service_configs
SET nationwide = true
WHERE buyer_id = 'xxx' AND service_type_id = 'windows-id';

-- Submit a lead with ANY ZIP code
-- Buyer should receive PING
```

### Test ZIP-Restricted Buyer

```sql
-- Ensure NOT nationwide
UPDATE buyer_service_configs
SET nationwide = false
WHERE buyer_id = 'xxx' AND service_type_id = 'windows-id';

-- Add specific ZIP
INSERT INTO buyer_service_zip_codes (buyer_id, service_type_id, zip_code, active)
VALUES ('xxx', 'windows-id', '90210', true);

-- Lead with ZIP 90210 → Buyer receives PING
-- Lead with ZIP 10001 → Buyer does NOT receive PING
```

---

## Caching Architecture

Understanding the caching is critical for knowing when config changes take effect.

### Cache Types

| Cache | Type | TTL | Location | Invalidation |
|-------|------|-----|----------|--------------|
| Service Config | **In-memory Map** | 1 min | `database-buyer-loader.ts` | `invalidateServiceConfigCache()` |
| Buyer Config | **In-memory Map** | 1 min | `database-buyer-loader.ts` | `invalidateBuyerConfigCache()` |
| Eligibility | Redis (no-op*) | 15 min | `ServiceZoneRepository` | `RedisCache.deletePattern()` |
| ZIP Codes | Redis (no-op*) | 24 hr | `ServiceZoneRepository` | `clearCaches()` |

**\*Note:** Redis is not fully configured in production. Redis operations silently return/skip when not configured, falling back to direct database queries.

### Critical: In-Memory Cache

The **in-memory Map caches** in `database-buyer-loader.ts` are the actual caches being used:

```typescript
// src/lib/field-mapping/database-buyer-loader.ts
const buyerCache = new Map<string, { config: DatabaseBuyerConfig; expires: number }>();
const serviceConfigCache = new Map<string, { config: DatabaseServiceConfig; expires: number }>();
const CACHE_TTL_MS = 60000; // 1 minute
```

When admin updates a service config, this cache MUST be invalidated:

```typescript
// src/app/api/admin/buyers/[id]/service-config/route.ts
invalidateServiceConfigCache(buyerId, serviceTypeId); // Clears in-memory Map
```

### How Active Toggle Changes Take Effect

```
Admin toggles active=false in UI
        │
        ▼
PATCH /api/admin/buyers/[id]/service-config
        │
        ├─► Database updated: buyer_service_configs.active = false
        │
        ├─► In-memory cache invalidated: invalidateServiceConfigCache()
        │
        └─► Redis cache invalidated (no-op if not configured)

Next auction runs
        │
        ▼
loadBuyerConfigForAuction(buyerId, serviceTypeId)
        │
        ├─► loadServiceConfig() misses in-memory cache
        │
        ├─► Loads fresh config from database with active=false
        │
        └─► CHECK: if (!dbServiceConfig.active) return null
                │
                └─► Buyer skipped (does not receive PING)
```

### Code Reference: Active Check

```typescript
// src/lib/field-mapping/database-buyer-loader.ts:736-739
export async function loadBuyerConfigForAuction(...) {
  const dbServiceConfig = await loadServiceConfig(buyerId, serviceTypeId);

  // Skip inactive service configs - buyer shouldn't receive PINGs
  if (!dbServiceConfig.active) {
    return null;
  }
  // ... rest of function
}
```

### Where Active Is Checked

| Flow | Where Active Is Checked | How |
|------|------------------------|-----|
| **Web Lead (Nationwide)** | `getNationwideBuyers()` | Prisma query with `active: true` |
| **Web Lead (ZIP-based)** | `loadBuyerConfigForAuction()` | Returns `null` if inactive |
| **Phone Call** | `getEligibleCallBuyers()` | Prisma query with `active: true` |

---

## Admin UI: Service Active Toggle

**Location:** Admin → Buyers → [Select Buyer] → Service Coverage Tab

Each service config now shows toggles for:
- **Service Active** - Green toggle, controls `buyer_service_configs.active`
- **Nationwide Coverage** - Indigo toggle, controls `buyer_service_configs.nationwide`

### UI Component

```
src/components/admin/BuyerServiceCoverageTab.tsx
├── toggleActive(serviceTypeId, currentValue)    → PATCH with { active: !value }
└── toggleNationwide(serviceTypeId, currentValue) → PATCH with { nationwide: !value }
```

### Effect of Each Toggle

| Toggle | When OFF | When ON |
|--------|----------|---------|
| **Service Active** | Buyer does NOT receive leads/calls for this service | Buyer participates in auctions |
| **Nationwide** | Buyer only gets matching ZIP codes | Buyer gets ALL leads (filters via PING) |

---

## Files Modified (Active Toggle Feature)

| File | Change |
|------|--------|
| `src/components/admin/BuyerServiceCoverageTab.tsx` | Added `toggleActive()` function and toggle UI |
| `src/lib/field-mapping/database-buyer-loader.ts` | Added active check in `loadBuyerConfigForAuction()` |
| `src/app/api/admin/buyers/[id]/service-config/route.ts` | Added in-memory cache invalidation |

---

*Last Updated: 2026-01-27*
