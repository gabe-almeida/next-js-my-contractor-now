# Auction System Flow

This document explains how the lead auction system determines buyer eligibility and selects winners.

## Overview

When a lead is submitted, it goes through an auction where eligible buyers (both contractors and networks) bid for the lead. The highest bidder wins, regardless of buyer type.

## The Key Table: `BuyerServiceZipCode` (Service Zones)

This is the **mapping table** that defines which buyers can participate in auctions:

```
BuyerServiceZipCode (Service Zone)
├── buyerId         → Links to Buyer (contractor OR network)
├── serviceTypeId   → Links to ServiceType (bathroom, windows, roofing)
├── zipCode         → The ZIP code they service
├── active          → Is this zone active?
├── priority        → Ranking within this zone
├── minBid / maxBid → Bid constraints
└── maxLeadsPerDay  → Daily cap
```

## Eligibility Determination

Buyers are eligible for an auction if they have an **active service zone** matching:
- The lead's **service type** (e.g., bathroom, windows, roofing)
- The lead's **ZIP code**
- Both the buyer and service type must be **active**

## Example Flow: Lead Submission to Winner Selection

### Step 1: Lead Comes In

```
Lead: Bathroom remodel in ZIP 01453
```

### Step 2: Query Eligible Buyers

```
┌─────────────────────────────────────────────────────────────────┐
│  ServiceZoneRepository.getEligibleBuyers('bathroom', '01453')   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  SELECT * FROM BuyerServiceZipCode                              │
│  WHERE serviceTypeId = 'bathroom'                               │
│    AND zipCode = '01453'                                        │
│    AND active = true                                            │
│    AND buyer.active = true                                      │
│    AND serviceType.active = true                                │
└─────────────────────────────────────────────────────────────────┘
```

### Step 3: Results (Example: 6 Eligible Buyers)

```
┌─────────────────────────────────────────────────────────────────┐
│  Results (6 eligible buyers):                                   │
│                                                                 │
│  CONTRACTORS:                                                   │
│  • ABC Bathroom Co (buyerId: abc-123)    - priority 100        │
│  • Local Bath Pros (buyerId: lbp-456)    - priority 90         │
│  • Smith Remodeling (buyerId: sr-789)    - priority 85         │
│  • Premium Baths (buyerId: pb-012)       - priority 80         │
│                                                                 │
│  NETWORKS:                                                      │
│  • HomeAdvisor (buyerId: ha-345)         - priority 95         │
│  • Modernize (buyerId: mod-678)          - priority 88         │
└─────────────────────────────────────────────────────────────────┘
```

### Step 4: Parallel PING to All Eligible Buyers

```
┌─────────────────────────────────────────────────────────────────┐
│  PARALLEL PING TO ALL 6                                         │
│                                                                 │
│  ABC Bathroom Co    → $45 bid                                   │
│  Local Bath Pros    → $52 bid                                   │
│  Smith Remodeling   → REJECTED (at daily cap)                   │
│  Premium Baths      → $48 bid                                   │
│  HomeAdvisor        → $65 bid  ← HIGHEST                        │
│  Modernize          → $58 bid                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Step 5: Winner Selection

```
┌─────────────────────────────────────────────────────────────────┐
│  WINNER: HomeAdvisor @ $65                                      │
│  (Buyer type doesn't matter - highest bid wins)                 │
└─────────────────────────────────────────────────────────────────┘
```

## Multiple Concurrent Auctions

Each lead runs its own independent auction. Multiple auctions can run simultaneously:

```
Lead A: Bathroom in 01453  →  Auction A (6 buyers eligible)
Lead B: Windows in 02115   →  Auction B (3 buyers eligible)
Lead C: Roofing in 01453   →  Auction C (4 buyers eligible)
Lead D: Bathroom in 90210  →  Auction D (8 buyers eligible)
```

These run in parallel via the job queue. Each auction is independent and looks up eligible buyers based on its own `serviceTypeId + zipCode`.

## Code Flow

```typescript
// 1. Lead comes in with serviceTypeId + zipCode
const lead = { serviceTypeId: 'bathroom-uuid', zipCode: '01453', ... };

// 2. Auction engine gets eligible buyers
const eligibleBuyers = await ServiceZoneRepository.getEligibleBuyers(
  lead.serviceTypeId,
  lead.zipCode
);
// Returns: All buyers with active service zones for bathroom + 01453

// 3. Send PING to all eligible (in parallel)
const bids = await Promise.allSettled(
  eligibleBuyers.map(buyer => sendPingToBuyer(lead, buyer))
);

// 4. Highest bid wins (regardless of CONTRACTOR vs NETWORK)
const winner = selectWinner(bids); // Simply: Math.max(bidAmounts)

// 5. Send POST to winner with full lead data
const result = await sendPostToWinner(lead, winner);
```

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/repositories/service-zone-repository.ts` | Queries eligible buyers by ZIP + service type |
| `src/lib/services/buyer-eligibility-service.ts` | Additional eligibility checks (daily caps, compliance) |
| `src/lib/auction/engine.ts` | Runs the auction (PING, winner selection, POST) |
| `src/workers/lead-processor.ts` | Background worker that processes leads from queue |

## Winner Selection Logic

The `selectWinner()` function in `src/lib/auction/engine.ts`:

1. **Filter valid bids**: `success === true && bidAmount > 0`
2. **Apply minimum bid** (if configured)
3. **Find highest bid**: `Math.max(...bidAmounts)`
4. **Break ties** (if same bid amount):
   - `responseTime`: Fastest response wins
   - `random`: Random selection
   - `priority`: Based on service zone priority

## Field Mapping System

Each buyer can have custom field mappings that transform lead data into their expected format. The auction engine uses these mappings when sending PING and POST requests.

### Field Mapping Configuration (Admin UI)

Field mappings are stored in `BuyerServiceConfig.fieldMappings` as JSON:

```typescript
{
  "version": "1.0",
  "mappings": [
    {
      "sourceField": "firstName",
      "targetField": "customer_fname",
      "transform": "string.uppercase",
      "required": true,
      "includeInPing": false,
      "includeInPost": true
    },
    {
      "sourceField": "zipCode",
      "targetField": "zip_code",
      "required": true,
      "includeInPing": true,
      "includeInPost": true
    }
  ],
  "staticFields": {
    "source": "contractor-platform",
    "lead_type": "web"
  }
}
```

### How Mappings Are Applied

1. **Database Loading**: `loadBuyerConfigForAuction()` loads buyer and service configs
2. **Adapter Conversion**: Converts database format to auction engine types
3. **Template Engine**: Applies mappings using `TemplateEngine.transform()`
4. **Transformations**: Built-in transforms like `boolean.yesNo`, `phone.e164`, etc.

### Configuration Sources

The auction engine loads buyer configurations from two sources:

1. **Hardcoded Registry** (legacy networks): Modernize, HomeAdvisor, Angi
2. **Database** (contractors + admin-configured): All other buyers

```typescript
// In auction engine getEligibleBuyers():
let buyerConfig = BuyerConfigurationRegistry.get(buyerId);
let serviceConfig = BuyerConfigurationRegistry.getServiceConfig(buyerId, serviceTypeId);

// If not in hardcoded registry, load from database
if (!buyerConfig || !serviceConfig) {
  const dbConfig = await loadBuyerConfigForAuction(buyerId, serviceTypeId);
  // Uses admin UI field mappings from database
}
```

## Important Notes

- **Buyer type (CONTRACTOR vs NETWORK) does NOT affect winner selection** - only bid amount matters
- **Each ZIP code + service type combination** must have a `BuyerServiceZipCode` record for a buyer to participate
- **Daily caps** are enforced per buyer per service type
- **Compliance requirements** (TrustedForm, Jornaya) can exclude buyers who require them if the lead doesn't have them
- **Field mappings from Admin UI** are now properly loaded and applied for all database-configured buyers

---

## Database Tables Reference

All tables used in the auction system and their purposes:

| Table | Purpose | Admin UI Configurable? | Used In Auction? |
|-------|---------|------------------------|------------------|
| `service_types` | Define services (windows, bathroom, roofing) | Yes | Yes (eligibility) |
| `buyers` | Buyer info, auth, timeouts, compliance mappings | Yes | Yes (config loading) |
| `buyer_service_configs` | Field mappings, bid limits, ping/post templates | Yes | Yes (payload generation) |
| `buyer_service_zip_codes` | Geographic eligibility (ZIP + service type) | Yes | Yes (eligibility query) |
| `leads` | Lead data, status, compliance | Yes (view) | Yes (auction input) |
| `transactions` | PING/POST audit trail | Yes (view) | Yes (logging) |
| `lead_status_history` | Status change accounting | Yes (view) | Yes (tracking) |
| `compliance_audit_log` | Compliance event tracking | Yes (view) | Yes (logging) |

### Table: `buyers`

```
buyers
├── id                      → UUID primary key
├── name                    → Display name
├── type                    → 'CONTRACTOR' or 'NETWORK'
├── apiUrl                  → Base URL for PING/POST requests
├── authConfig              → JSON: { type, credentials, headers } (encrypted)
├── webhookSecret           → For signature verification
├── pingTimeout             → Timeout in seconds for PING requests
├── postTimeout             → Timeout in seconds for POST requests
├── complianceFieldMappings → JSON: Custom field names for compliance data
├── active                  → Is buyer active?
└── createdAt/updatedAt     → Timestamps
```

### Table: `buyer_service_configs`

```
buyer_service_configs
├── id                  → UUID primary key
├── buyerId             → FK to buyers
├── serviceTypeId       → FK to service_types
├── pingTemplate        → JSON: { url, timeout, headers }
├── postTemplate        → JSON: { url, timeout, headers }
├── fieldMappings       → JSON: FieldMappingConfig (see below)
├── requiresTrustedForm → Does buyer require TrustedForm cert?
├── requiresJornaya     → Does buyer require Jornaya LeadID?
├── complianceConfig    → JSON: Additional compliance settings
├── minBid              → Minimum bid amount
├── maxBid              → Maximum bid amount
├── active              → Is this service config active?
└── UNIQUE(buyerId, serviceTypeId)
```

### Table: `buyer_service_zip_codes`

```
buyer_service_zip_codes
├── id              → UUID primary key
├── buyerId         → FK to buyers
├── serviceTypeId   → FK to service_types
├── zipCode         → 5-digit ZIP code
├── active          → Is this zone active?
├── priority        → 1-1000, higher = more priority in tiebreaks
├── maxLeadsPerDay  → Daily lead cap (null = unlimited)
├── minBid          → Zone-specific min bid override
├── maxBid          → Zone-specific max bid override
└── UNIQUE(buyerId, serviceTypeId, zipCode)
```

---

## Complete End-to-End Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        COMPLETE LEAD → AUCTION FLOW                         │
└─────────────────────────────────────────────────────────────────────────────┘

STEP 1: ADMIN SETUP (via Admin UI)
══════════════════════════════════
  a) Create Buyer (/api/admin/buyers)
     → Table: buyers
     → Fields: name, type (CONTRACTOR/NETWORK), apiUrl, authConfig,
               pingTimeout, postTimeout, complianceFieldMappings

  b) Create Service Config (/api/admin/buyers/service-configs)
     → Table: buyer_service_configs
     → Fields: buyerId, serviceTypeId, minBid, maxBid,
               requiresTrustedForm, requiresJornaya, active

  c) Configure Field Mappings (/api/admin/field-mappings)
     → Table: buyer_service_configs.fieldMappings (JSON)
     → Structure: { mappings: [{sourceField, targetField, transform,
                                includeInPing, includeInPost}], staticFields }

  d) Create Service Zones (/api/admin/service-zones)
     → Table: buyer_service_zip_codes
     → Fields: buyerId, serviceTypeId, zipCode, active, priority,
               maxLeadsPerDay, minBid, maxBid

STEP 2: LEAD SUBMISSION (Frontend → /api/leads)
═══════════════════════════════════════════════
  Input: { serviceTypeId, zipCode, formData, complianceData }

  Creates in DB:
  → leads table (status: PENDING, formData as JSON)
  → lead_status_history (NEW → PENDING)
  → compliance_audit_log (FORM_SUBMITTED)

  Queues: { leadId, priority } → Redis "lead-processing" queue

STEP 3: WORKER PROCESSING (lead-processor.ts)
═════════════════════════════════════════════
  a) Updates lead status: PENDING → PROCESSING (atomic)
  b) Loads full lead from DB (with serviceType)
  c) Converts to LeadData object
  d) Calls: AuctionEngine.runAuction(leadData)

STEP 4: AUCTION - ELIGIBILITY (engine.ts → getEligibleBuyers)
═════════════════════════════════════════════════════════════
  Query: buyer_service_zip_codes
  WHERE:
    serviceTypeId = lead.serviceTypeId  ← Must match lead's service
    zipCode = lead.zipCode              ← Must match lead's ZIP
    active = true                       ← Zone must be active
    buyer.active = true                 ← Buyer must be active

  Returns: List of eligible buyers (both CONTRACTOR and NETWORK types)

STEP 5: AUCTION - BUYER CONFIG LOADING
══════════════════════════════════════
  For each eligible buyer:

  a) Try BuyerConfigurationRegistry.get() [hardcoded: Modernize, HomeAdvisor, Angi]

  b) If not found → loadBuyerConfigForAuction() [DATABASE]

     Loads from buyers table:
     → id, name, apiUrl, authConfig (decrypted)
     → pingTimeout, postTimeout
     → complianceFieldMappings (JSON)

     Loads from buyer_service_configs table:
     → fieldMappings (JSON with ping/post mappings)
     → pingTemplate, postTemplate (webhook URLs)
     → minBid, maxBid
     → requiresTrustedForm, requiresJornaya

STEP 6: AUCTION - PING TO ALL ELIGIBLE
══════════════════════════════════════
  For each buyer with config:

  a) TemplateEngine.transform(lead, buyerConfig, pingTemplate)
     → Applies field mappings from buyer_service_configs.fieldMappings
     → Uses mappings where includeInPing = true
     → Applies transforms (boolean.yesNo, phone.e164, etc.)
     → Adds compliance fields using buyer's complianceFieldMappings

  b) HTTP POST to buyer's pingUrl
     → Headers: Auth from authConfig
     → Body: Transformed payload
     → Timeout: From pingTimeout

  c) Log transaction
     → Table: transactions (PING, payload, response, bidAmount)

STEP 7: AUCTION - WINNER SELECTION
══════════════════════════════════
  a) Filter: status = SUCCESS, bidAmount > 0
  b) Select: HIGHEST BID (regardless of buyer type!)
  c) Tiebreaker: responseTime or priority

  ⚠️ CONTRACTOR and NETWORK are treated equally - highest bid wins

STEP 8: AUCTION - POST TO WINNER
════════════════════════════════
  a) TemplateEngine.transform(lead, buyerConfig, postTemplate)
     → Applies field mappings from buyer_service_configs.fieldMappings
     → Uses mappings where includeInPost = true
     → Always includes compliance data
     → Adds staticFields from config

  b) HTTP POST to buyer's postUrl
     → Full lead payload with all mapped fields

  c) Log transaction
     → Table: transactions (POST, payload, response)

STEP 9: RESULT HANDLING
═══════════════════════
  Success → leads.status = 'SOLD', winningBuyerId, winningBid
  Failure → leads.status = 'DELIVERY_FAILED' or 'REJECTED'

  Records in lead_status_history for accounting
```

---

## Admin UI Configuration Points

| What to Configure | Admin UI Location | Database Table | Database Field |
|-------------------|-------------------|----------------|----------------|
| Buyer basic info | Buyers page | `buyers` | name, type, apiUrl |
| Auth credentials | Buyers page | `buyers` | authConfig (encrypted JSON) |
| Ping/Post timeouts | Buyers page | `buyers` | pingTimeout, postTimeout |
| Compliance field names | Buyers page | `buyers` | complianceFieldMappings |
| Service config | Service Configs | `buyer_service_configs` | all fields |
| Field mappings | Field Mapping Editor | `buyer_service_configs` | fieldMappings (JSON) |
| Bid limits | Service Configs | `buyer_service_configs` | minBid, maxBid |
| Compliance requirements | Service Configs | `buyer_service_configs` | requiresTrustedForm, requiresJornaya |
| ZIP code eligibility | Service Zones | `buyer_service_zip_codes` | zipCode, active |
| Zone priority | Service Zones | `buyer_service_zip_codes` | priority |
| Daily caps | Service Zones | `buyer_service_zip_codes` | maxLeadsPerDay |

---

## API Endpoints Reference

### Buyer Management

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/buyers` | GET | List all buyers |
| `/api/admin/buyers` | POST | Create new buyer |
| `/api/admin/buyers/[id]` | GET | Get buyer details |
| `/api/admin/buyers/[id]` | PUT | Update buyer |
| `/api/admin/buyers/[id]` | DELETE | Delete buyer |

### Service Configuration

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/buyers/service-configs` | GET | List service configs |
| `/api/admin/buyers/service-configs` | POST | Create service config |
| `/api/admin/buyers/service-configs/[id]` | PUT | Update service config |
| `/api/admin/buyers/service-configs/[id]` | DELETE | Delete service config |

### Field Mappings

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/field-mappings` | GET | Load field mappings for buyer+service |
| `/api/admin/field-mappings` | PUT | Save field mappings |
| `/api/admin/field-mappings` | PATCH | Toggle active status |
| `/api/admin/field-mappings/preview` | POST | Preview payload with sample data |

### Service Zones (Geographic Eligibility)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/service-zones` | GET | List service zones with filters |
| `/api/admin/service-zones` | POST | Create zone(s) - supports bulk |
| `/api/admin/service-zones` | DELETE | Delete zone(s) - supports bulk |
| `/api/admin/service-zones/[id]` | PUT | Update single zone |

---

## Field Mapping Configuration Schema

The `fieldMappings` JSON stored in `buyer_service_configs`:

```typescript
interface FieldMappingConfig {
  version: "1.0";
  mappings: FieldMapping[];
  staticFields: Record<string, string | number | boolean>;
  meta: {
    createdAt: string;
    updatedAt: string;
    createdBy?: string;
    updatedBy?: string;
    notes?: string;
  };
}

interface FieldMapping {
  id: string;                    // Unique ID for this mapping
  sourceField: string;           // Lead field path (e.g., "firstName", "formData.windowType")
  targetField: string;           // Buyer's expected field name
  transform?: string;            // Transform function (e.g., "boolean.yesNo")
  required: boolean;             // Is this field required?
  defaultValue?: string | number | boolean;
  description?: string;          // For admin UI
  order: number;                 // Display/processing order
  includeInPing: boolean;        // Include in PING payload?
  includeInPost: boolean;        // Include in POST payload?
}
```

### Available Transforms

| Transform | Input | Output | Example |
|-----------|-------|--------|---------|
| `boolean.yesNo` | boolean | "Yes"/"No" | `true` → `"Yes"` |
| `boolean.numeric` | boolean | 1/0 | `true` → `1` |
| `boolean.trueFalse` | boolean | "true"/"false" | `true` → `"true"` |
| `string.uppercase` | string | UPPERCASE | `"john"` → `"JOHN"` |
| `string.lowercase` | string | lowercase | `"JOHN"` → `"john"` |
| `string.trim` | string | trimmed | `" john "` → `"john"` |
| `phone.e164` | string | E.164 format | `"555-123-4567"` → `"+15551234567"` |
| `phone.digits` | string | digits only | `"555-123-4567"` → `"5551234567"` |
| `date.iso` | Date | ISO string | `Date` → `"2024-01-15T..."` |
| `date.mmddyyyy` | Date | MM/DD/YYYY | `Date` → `"01/15/2024"` |

---

## Compliance Field Mappings

The `complianceFieldMappings` JSON stored in `buyers` table allows each buyer to specify their preferred field names for compliance data:

```typescript
interface ComplianceFieldMappings {
  trustedForm?: {
    certUrl?: string[];      // e.g., ["xxTrustedFormCertUrl", "tf_cert"]
    certId?: string[];       // e.g., ["xxTrustedFormToken", "tf_token"]
  };
  jornaya?: {
    leadId?: string[];       // e.g., ["universal_leadid", "leadid_token"]
  };
  tcpa?: {
    consent?: string[];      // e.g., ["tcpa_consent", "consent_given"]
    timestamp?: string[];    // e.g., ["consent_date", "tcpa_timestamp"]
  };
  technical?: {
    ipAddress?: string[];    // e.g., ["ip_address", "client_ip"]
    userAgent?: string[];    // e.g., ["user_agent", "browser"]
    timestamp?: string[];    // e.g., ["submit_timestamp", "created_at"]
  };
  geo?: {
    latitude?: string[];
    longitude?: string[];
    city?: string[];
    state?: string[];
  };
}
```

When compliance data is included in payloads, the system uses the **first field name** in each array.

---

## Status Transitions

Valid lead status transitions enforced by `lead-accounting-service.ts`:

```
PENDING → PROCESSING, REJECTED, SCRUBBED, DUPLICATE
PROCESSING → SOLD, REJECTED, EXPIRED, DELIVERY_FAILED, SCRUBBED, DUPLICATE
AUCTIONED → SOLD, REJECTED, EXPIRED, SCRUBBED, DUPLICATE
SOLD → SCRUBBED, DUPLICATE, DELIVERY_FAILED
REJECTED → PROCESSING, SCRUBBED
EXPIRED → PROCESSING, SCRUBBED
DELIVERY_FAILED → PROCESSING, REJECTED, SCRUBBED
SCRUBBED → (terminal)
DUPLICATE → (terminal)
```

---

## Caching Strategy

| Data | Cache Key Pattern | TTL | Invalidation |
|------|-------------------|-----|--------------|
| Service zones | `service-zones:eligible:{serviceTypeId}:{zipCode}` | 15 min | On zone create/update/delete |
| Buyer config | `{buyerId}` | 1 min | On buyer update |
| Service config | `{buyerId}:{serviceTypeId}` | 1 min | On config update |
| Field mappings | `{buyerId}:{serviceTypeId}` | 1 min | On mapping save |
| Daily lead count | `daily-count:{buyerId}:{serviceTypeId}:{date}` | 5 min | Auto-expires |

---

## Troubleshooting

### Buyer Not Participating in Auctions

1. Check `buyers.active = true`
2. Check `buyer_service_configs` exists for buyer + service type
3. Check `buyer_service_configs.active = true`
4. Check `buyer_service_zip_codes` exists for buyer + service type + ZIP
5. Check `buyer_service_zip_codes.active = true`
6. Check daily cap not exceeded (`maxLeadsPerDay`)
7. Check compliance requirements met (TrustedForm, Jornaya)

### Field Mappings Not Applied

1. Verify `buyer_service_configs.fieldMappings` is valid JSON
2. Check `includeInPing` / `includeInPost` flags on mappings
3. Verify source field paths match actual lead data structure
4. Check cache invalidation after saving mappings

### Logs to Check

- `src/workers/lead-processor.ts` - Worker processing logs
- `src/lib/auction/engine.ts` - Auction execution logs
- `transactions` table - PING/POST request/response audit trail
- `lead_status_history` table - Status change history
