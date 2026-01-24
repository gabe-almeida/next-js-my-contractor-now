# Lead Delivery System - Complete Reference

> **The definitive guide to how leads flow from form submission through the PING/POST auction to buyer delivery.**

This document explains the entire lead generation and delivery system chronologically, from the moment a user lands on a service page to the final delivery to the winning buyer.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Complete Flow Diagram](#2-complete-flow-diagram)
3. [Phase 1: Lead Capture (Frontend)](#3-phase-1-lead-capture-frontend)
4. [Phase 2: Lead Submission & Validation](#4-phase-2-lead-submission--validation)
5. [Phase 3: Buyer Eligibility Determination](#5-phase-3-buyer-eligibility-determination)
6. [Phase 4: Buyer Configuration Loading](#6-phase-4-buyer-configuration-loading)
7. [Phase 5: Field Transformation (The Template Engine)](#7-phase-5-field-transformation-the-template-engine)
8. [Phase 6: PING/POST Auction](#8-phase-6-pingpost-auction)
9. [Phase 7: Cascade Delivery & Fallback](#9-phase-7-cascade-delivery--fallback)
10. [Phase 8: Contractor Delivery (Fallback)](#10-phase-8-contractor-delivery-fallback)
11. [Admin Configuration Guide](#11-admin-configuration-guide)
12. [Database Schema Reference](#12-database-schema-reference)
13. [Troubleshooting](#13-troubleshooting)
14. [Key Files Reference](#14-key-files-reference)

---

## Related Documentation

| Document | Purpose |
|----------|---------|
| [auction-system-flow.md](./auction-system-flow.md) | Detailed auction mechanics, API endpoints, status transitions, caching |
| [lead-system-flow.md](./lead-system-flow.md) | Mermaid diagrams of lead flow and value transformations |
| [architecture/functional-flows.md](./architecture/functional-flows.md) | Full system architecture with all functional flows |
| [specs/field-mapping-system-spec.md](./specs/field-mapping-system-spec.md) | Technical specification for the field mapping system |

---

## 1. System Overview

### What This System Does

The lead delivery system connects homeowners seeking services (windows, roofing, HVAC, etc.) with buyers who purchase these leads. There are two types of buyers:

| Buyer Type | Description | How They Receive Leads |
|------------|-------------|----------------------|
| **NETWORK** | Large lead aggregators (Modernize, HomeAdvisor, Angi) | PING/POST auction - they bid in real-time |
| **CONTRACTOR** | Local service providers | Direct delivery - assigned based on coverage |

### The Core Concept: PING/POST Auction

1. **PING**: A lightweight request with minimal lead data (ZIP, service type, homeowner status) sent to ALL eligible buyers simultaneously
2. **BID**: Each buyer responds with a bid amount they're willing to pay for the full lead
3. **POST**: The full lead data is sent to the highest bidder for acceptance
4. **CASCADE**: If the winner rejects, we try the next highest bidder, and so on

### Key Differentiator: Per-Buyer Payload Customization

Every buyer has different API requirements. Our system uses **field mappings** to transform the same lead data into different payload structures per buyer:

```
Same Lead Data → Different Payloads Per Buyer

Lead: { timeframe: "within_3_months", ownsHome: true }
                         ↓
    ┌────────────────────┼────────────────────┐
    ↓                    ↓                    ↓
Modernize:           HomeAdvisor:         Angi:
{                    {                    {
  "buyTimeframe":      "timeline": "1-3    "project_urgency":
    "1-6 months",        months",            "SOON",
  "ownHome": "Yes"     "is_owner": 1        "homeowner": true
}                    }                    }
```

---

## 2. Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           LEAD DELIVERY SYSTEM - COMPLETE FLOW                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘

PHASE 1: LEAD CAPTURE                    PHASE 2: SUBMISSION & VALIDATION
┌─────────────────────────┐              ┌─────────────────────────────────────┐
│   User visits           │              │                                     │
│   /services/windows     │              │   POST /api/leads                   │
│          │              │              │          │                          │
│          ▼              │              │          ▼                          │
│   Fetch QuestionFlow    │              │   ┌─────────────────────┐          │
│   from database         │              │   │ Validate:           │          │
│          │              │              │   │ • Form schema       │          │
│          ▼              │              │   │ • ZIP code (Radar)  │          │
│   DynamicForm renders   │              │   │ • TrustedForm cert  │          │
│   service-specific +    │              │   │ • Jornaya token     │          │
│   standard questions    │              │   └─────────────────────┘          │
│          │              │              │          │                          │
│          ▼              │              │          ▼                          │
│   Capture compliance:   │              │   Calculate lead quality score     │
│   • TrustedForm cert    │              │   (50 base + compliance bonuses)   │
│   • Jornaya LeadID      │              │          │                          │
│   • TCPA consent        │              │          ▼                          │
│   • Attribution data    │              │   Create Lead record in DB          │
│          │              │──────────────│          │                          │
│          ▼              │              │          ▼                          │
│   User submits form     │              │   Add to Redis priority queue       │
└─────────────────────────┘              └─────────────────────────────────────┘
                                                    │
                                                    ▼
PHASE 3: ELIGIBILITY                     PHASE 4: CONFIGURATION LOADING
┌─────────────────────────────────────┐  ┌─────────────────────────────────────┐
│                                     │  │                                     │
│   Worker pops lead from queue       │  │   For each eligible buyer:          │
│          │                          │  │          │                          │
│          ▼                          │  │          ▼                          │
│   Query buyer_service_zip_codes     │  │   Load from buyers table:           │
│   WHERE:                            │  │   • name, apiUrl                    │
│     service_type = lead.service     │  │   • authConfig (decrypted)          │
│     zip_code = lead.zipCode         │  │   • pingTimeout, postTimeout        │
│     active = true                   │  │   • complianceFieldMappings         │
│     buyer.active = true             │  │          │                          │
│          │                          │  │          ▼                          │
│          ▼                          │  │   Load from buyer_service_configs:  │
│   Filter by compliance:             │  │   • fieldMappings (JSON)            │
│   • requiresTrustedForm?            │  │   • pingTemplate                    │
│   • requiresJornaya?                │  │   • postTemplate                    │
│   • daily cap reached?              │  │   • minBid, maxBid                  │
│          │                          │  │   • compliance requirements         │
│          ▼                          │  │          │                          │
│   Result: EligibleBuyer[]           │──│          ▼                          │
│   (NETWORK + CONTRACTOR types)      │  │   Convert to BuyerServiceConfig     │
│                                     │  │   typed objects                     │
└─────────────────────────────────────┘  └─────────────────────────────────────┘
                                                    │
                                                    ▼
PHASE 5: FIELD TRANSFORMATION            PHASE 6: PING/POST AUCTION
┌─────────────────────────────────────┐  ┌─────────────────────────────────────┐
│                                     │  │                                     │
│   TemplateEngine.transform()        │  │   PING PHASE (Parallel):            │
│          │                          │  │          │                          │
│          ▼                          │  │          ▼                          │
│   1. Prepare source data:           │  │   Send PING to all NETWORK buyers   │
│      Flatten formData into          │  │   simultaneously with timeout       │
│      single-level object            │  │          │                          │
│          │                          │  │          ▼                          │
│          ▼                          │  │   Collect bid responses:            │
│   2. For each field mapping:        │  │   { bidAmount, pingToken, status }  │
│      a. Get source value            │  │          │                          │
│      b. Apply valueMap lookup       │  │          ▼                          │
│      c. Apply transform function    │  │   Filter valid bids:                │
│      d. Set to targetField          │  │   success=true AND bidAmount > 0    │
│          │                          │  │          │                          │
│          ▼                          │  │          ▼                          │
│   3. Add static fields              │  │   Select winner:                    │
│      (pingStaticFields or           │  │   HIGHEST BID wins                  │
│       postStaticFields)             │──│   (buyer type doesn't matter)       │
│          │                          │  │          │                          │
│          ▼                          │  │          ▼                          │
│   4. Add compliance data            │  │   POST full lead to winner          │
│      (for POST only)                │  │   with pingToken from PING          │
│                                     │  │                                     │
└─────────────────────────────────────┘  └─────────────────────────────────────┘
                                                    │
                                                    ▼
PHASE 7: CASCADE DELIVERY                PHASE 8: CONTRACTOR FALLBACK
┌─────────────────────────────────────┐  ┌─────────────────────────────────────┐
│                                     │  │                                     │
│   Try POST to winner                │  │   If all NETWORK buyers failed:     │
│          │                          │  │          │                          │
│          ▼                          │  │          ▼                          │
│   Winner accepted?                  │  │   Get eligible CONTRACTOR buyers    │
│      │                              │  │   for ZIP + service                 │
│      ├─ YES → Update lead: SOLD     │  │          │                          │
│      │        Record transaction    │  │          ▼                          │
│      │        Exit (success)        │  │   Delivery mode?                    │
│      │                              │  │      │                              │
│      └─ NO → Try next highest bid   │  │      ├─ EXCLUSIVE: Top 1 only      │
│              │                      │  │      └─ SHARED: Top N contractors   │
│              ▼                      │  │          │                          │
│   Still have bids?                  │  │          ▼                          │
│      │                              │  │   Notify via:                       │
│      ├─ YES → Loop (cascade)        │  │   • Email                           │
│      │                              │  │   • Webhook (if configured)         │
│      └─ NO → Fall through to        │──│   • Dashboard                       │
│              contractor delivery    │  │          │                          │
│                                     │  │          ▼                          │
│   Rejection reasons tracked:        │  │   Update lead status accordingly    │
│   • DUPLICATE_LEAD                  │  │                                     │
│   • CAP_REACHED                     │  │                                     │
│   • OUTSIDE_HOURS                   │  │                                     │
│   • COMPLIANCE_MISSING              │  │                                     │
│   • POST_REJECTED                   │  │                                     │
└─────────────────────────────────────┘  └─────────────────────────────────────┘
                                                    │
                                                    ▼
                                         ┌─────────────────────────────────────┐
                                         │           COMPLETE                  │
                                         │                                     │
                                         │   Lead status updated:              │
                                         │   • SOLD (winner accepted)          │
                                         │   • REJECTED (all buyers rejected)  │
                                         │   • EXPIRED (no eligible buyers)    │
                                         │                                     │
                                         │   Transaction records created       │
                                         │   for audit trail                   │
                                         └─────────────────────────────────────┘
```

---

## 3. Phase 1: Lead Capture (Frontend)

### Entry Point: Service Landing Pages

When a user visits a service page like `/services/windows`, the following happens:

```typescript
// src/app/services/[slug]/page.tsx

1. Fetch question flow from database
   GET /api/services/[slug]/flow

2. QuestionFlow is built from ServiceType.formSchema

3. DynamicForm component renders:
   - Service-specific questions (from formSchema)
   - Standard questions (always included):
     • address (for ZIP code)
     • timeline (project urgency)
     • isHomeowner (ownership verification)
     • nameInfo (first/last name)
     • contactInfo (email/phone)
```

### Compliance Token Capture

Before form submission, compliance tokens are captured automatically:

| Token | Provider | Purpose | Component |
|-------|----------|---------|-----------|
| TrustedForm Certificate | TrustedForm | Session recording proof | `TrustedFormProvider` |
| Jornaya LeadID | Jornaya | Cross-publisher tracking | `JornayaProvider` |
| TCPA Consent | Internal | Legal consent checkbox | `TCPACheckbox` |
| Attribution Data | Internal | UTM params, click IDs | Auto-captured on mount |

### Form Data Structure

When the user submits, the form produces:

```json
{
  "serviceTypeId": "uuid-for-windows",
  "formData": {
    "projectScope": "repair",
    "numberOfWindows": "3-5",
    "windowStyle": "double-hung"
  },
  "zipCode": "90210",
  "ownsHome": true,
  "timeframe": "within_3_months",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "phone": "555-123-4567",
  "trustedFormCertUrl": "https://cert.trustedform.com/...",
  "trustedFormCertId": "abc123",
  "jornayaLeadId": "jrn-456",
  "tcpaConsent": true,
  "attribution": {
    "utm_source": "facebook",
    "utm_campaign": "spring_promo",
    "fbclid": "..."
  }
}
```

---

## 4. Phase 2: Lead Submission & Validation

### API Endpoint: POST /api/leads

**File:** `src/app/api/leads/route.ts`

```
┌─────────────────────────────────────────────────────────────────────┐
│                    LEAD SUBMISSION FLOW                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. VALIDATION                                                       │
│     ├── Zod schema validation (createLeadSchema)                    │
│     ├── Sanitize form data (XSS prevention)                         │
│     ├── Validate ZIP code via Radar.io API                          │
│     ├── Verify TrustedForm certificate (API call)                   │
│     └── Verify service type exists and is active                    │
│                                                                      │
│  2. QUALITY SCORE CALCULATION                                        │
│     Base score: 50 points                                           │
│     + TrustedForm (5-25 points based on risk)                       │
│     + Jornaya present (+20 points)                                  │
│     + TCPA consent (+5 points)                                      │
│     = Final score (0-100)                                           │
│                                                                      │
│  3. DATABASE TRANSACTION                                             │
│     ├── Create Lead record (status: PENDING)                        │
│     ├── Create lead_status_history entry                            │
│     └── Create compliance_audit_log entry                           │
│                                                                      │
│  4. ASYNC PROCESSING                                                 │
│     ├── Record affiliate conversion (fire-and-forget)               │
│     ├── Send to Meta CAPI (fire-and-forget)                         │
│     └── Add to Redis queue (lead-processing)                        │
│                                                                      │
│  5. RESPONSE                                                         │
│     └── Return { leadId, status: "queued" }                         │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Quality Score Breakdown

```
┌─────────────────────────────────────────────────────────────────────┐
│                    QUALITY SCORE CALCULATION                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  BASE SCORE                                                    50   │
│                                                                      │
│  + TrustedForm Certificate                                          │
│    ├── Valid + Low Risk (score < 30)                          +25  │
│    ├── Valid + Medium Risk (score 30-60)                      +15  │
│    ├── Valid + High Risk (score > 60)                          +5  │
│    └── Invalid/Missing                                          +0  │
│                                                                      │
│  + Jornaya LeadID                                                   │
│    ├── Present and valid                                      +20  │
│    └── Missing                                                  +0  │
│                                                                      │
│  + TCPA Consent                                                     │
│    ├── Consent given                                           +5  │
│    └── No consent                                               +0  │
│                                                                      │
│  ──────────────────────────────────────────────────────────────────│
│  MAXIMUM POSSIBLE SCORE                                       100   │
│                                                                      │
│  Priority Assignment:                                                │
│  • Score >= 80 → HIGH priority (processed first)                    │
│  • Score >= 50 → NORMAL priority                                    │
│  • Score < 50  → LOW priority                                       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 5. Phase 3: Buyer Eligibility Determination

### The Critical Query

**File:** `src/lib/services/buyer-eligibility-service.ts`

A buyer is eligible for an auction if ALL of these conditions are true:

```sql
-- Simplified eligibility query
SELECT b.*, bsc.*, bsz.*
FROM buyers b
JOIN buyer_service_configs bsc ON b.id = bsc.buyer_id
JOIN buyer_service_zip_codes bsz ON b.id = bsz.buyer_id
  AND bsc.service_type_id = bsz.service_type_id
WHERE
  bsz.service_type_id = :leadServiceTypeId
  AND bsz.zip_code = :leadZipCode
  AND bsz.active = true
  AND bsc.active = true
  AND b.active = true
```

### Eligibility Flowchart

```
┌─────────────────────────────────────────────────────────────────────┐
│                    BUYER ELIGIBILITY CHECK                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Lead: Windows service, ZIP 90210                                   │
│                                                                      │
│  For each potential buyer:                                          │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 1. Is buyer active?                                          │   │
│  │    └── buyers.active = true?                                 │   │
│  │        NO → SKIP (buyer disabled)                            │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                           │ YES                                      │
│                           ▼                                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 2. Has service config?                                       │   │
│  │    └── buyer_service_configs exists for buyer + windows?     │   │
│  │        NO → SKIP (service not configured)                    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                           │ YES                                      │
│                           ▼                                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 3. Is service config active?                                 │   │
│  │    └── buyer_service_configs.active = true?                  │   │
│  │        NO → SKIP (service config disabled)                   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                           │ YES                                      │
│                           ▼                                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 4. Covers this ZIP code?                                     │   │
│  │    └── buyer_service_zip_codes exists for buyer + windows    │   │
│  │        + 90210?                                              │   │
│  │        NO → SKIP (ZIP not covered)                           │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                           │ YES                                      │
│                           ▼                                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 5. ZIP code entry active?                                    │   │
│  │    └── buyer_service_zip_codes.active = true?                │   │
│  │        NO → SKIP (ZIP disabled)                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                           │ YES                                      │
│                           ▼                                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 6. Compliance requirements met?                              │   │
│  │    └── If requiresTrustedForm → lead has TrustedForm?       │   │
│  │    └── If requiresJornaya → lead has Jornaya?               │   │
│  │        NO → SKIP (compliance not met)                        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                           │ YES                                      │
│                           ▼                                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 7. Under daily cap?                                          │   │
│  │    └── leads_today < maxLeadsPerDay?                         │   │
│  │        NO → SKIP (cap reached)                               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                           │ YES                                      │
│                           ▼                                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ ✓ BUYER IS ELIGIBLE                                          │   │
│  │   Add to eligible buyers list                                │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Nationwide Buyers (Fallback)

If no ZIP-specific buyers are found, the system checks for "nationwide" buyers:

```
Nationwide buyers have:
- buyer_service_configs configured for the service
- NO entries in buyer_service_zip_codes

These buyers accept leads from any ZIP and filter internally via PING
```

---

## 6. Phase 4: Buyer Configuration Loading

### What Gets Loaded Per Buyer

**File:** `src/lib/field-mapping/database-buyer-loader.ts`

```
┌─────────────────────────────────────────────────────────────────────┐
│                    BUYER CONFIGURATION                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  FROM buyers TABLE:                                                  │
│  ├── id, name, type (NETWORK/CONTRACTOR)                            │
│  ├── apiUrl (base URL for ping/post)                                │
│  ├── authConfig (encrypted JSON):                                   │
│  │   {                                                               │
│  │     "type": "apiKey" | "bearer" | "basic" | "none",              │
│  │     "credentials": { "key": "xxx", "secret": "xxx" },            │
│  │     "headers": { "X-API-Key": "..." }                            │
│  │   }                                                               │
│  ├── pingTimeout, postTimeout (in seconds)                          │
│  └── complianceFieldMappings (JSON):                                │
│      {                                                               │
│        "trustedForm": { "certUrl": ["tf_cert", "trustedFormUrl"] }, │
│        "jornaya": { "leadId": ["leadid_token"] }                    │
│      }                                                               │
│                                                                      │
│  FROM buyer_service_configs TABLE:                                   │
│  ├── pingTemplate (JSON): { "url": "..." }                          │
│  ├── postTemplate (JSON): { "url": "..." }                          │
│  ├── fieldMappings (JSON string) - THE KEY CONFIGURATION            │
│  ├── requiresTrustedForm, requiresJornaya                           │
│  ├── minBid, maxBid                                                 │
│  └── active                                                         │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### The fieldMappings Structure

This is the critical configuration that controls how lead data is transformed:

```json
{
  "version": "1.0",
  "mappings": [
    {
      "id": "map-1",
      "sourceField": "zipCode",
      "targetField": "postalCode",
      "required": true,
      "includeInPing": true,
      "includeInPost": true
    },
    {
      "id": "map-2",
      "sourceField": "timeframe",
      "targetField": "buyTimeframe",
      "valueMap": {
        "within_3_months": "1-6 months",
        "3_plus_months": "6+ months",
        "not_sure": "Don't know"
      },
      "required": true,
      "includeInPing": true,
      "includeInPost": true
    },
    {
      "id": "map-3",
      "sourceField": "ownsHome",
      "targetField": "ownHome",
      "transform": "boolean.yesNo",
      "required": true,
      "includeInPing": true,
      "includeInPost": true
    },
    {
      "id": "map-4",
      "sourceField": "phone",
      "targetField": "homePhone",
      "transform": "phone.digitsOnly",
      "required": true,
      "includeInPing": false,
      "includeInPost": true
    }
  ],
  "pingStaticFields": {
    "tagId": "204670250",
    "service": "WINDOWS",
    "partnerSourceId": "fb"
  },
  "postStaticFields": {
    "tagId": "204670250",
    "service": "WINDOWS",
    "homePhoneConsentLanguage": "By submitting this form, I consent to be contacted..."
  }
}
```

---

## 7. Phase 5: Field Transformation (The Template Engine)

### How Transformation Works

**File:** `src/lib/templates/engine.ts`

```
┌─────────────────────────────────────────────────────────────────────┐
│                    FIELD TRANSFORMATION PIPELINE                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  SOURCE DATA (from Lead):                                            │
│  {                                                                   │
│    "timeframe": "within_3_months",                                  │
│    "ownsHome": true,                                                │
│    "phone": "(555) 123-4567",                                       │
│    "zipCode": "90210"                                               │
│  }                                                                   │
│                                                                      │
│                           │                                          │
│                           ▼                                          │
│                                                                      │
│  FOR EACH MAPPING:                                                   │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Step 1: GET SOURCE VALUE                                     │   │
│  │                                                               │   │
│  │ sourceValue = sourceData[mapping.sourceField]                 │   │
│  │ Example: sourceValue = "within_3_months"                      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                           │                                          │
│                           ▼                                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Step 2: APPLY valueMap (if exists)                           │   │
│  │                                                               │   │
│  │ if (mapping.valueMap && mapping.valueMap[sourceValue]) {     │   │
│  │   transformedValue = mapping.valueMap[sourceValue]            │   │
│  │ }                                                             │   │
│  │                                                               │   │
│  │ Example:                                                      │   │
│  │ valueMap = { "within_3_months": "1-6 months" }               │   │
│  │ transformedValue = "1-6 months"                               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                           │                                          │
│                           ▼                                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Step 3: APPLY transform FUNCTION (if exists)                 │   │
│  │                                                               │   │
│  │ if (mapping.transform) {                                      │   │
│  │   transformedValue = executeTransform(                        │   │
│  │     mapping.transform,                                        │   │
│  │     transformedValue                                          │   │
│  │   )                                                           │   │
│  │ }                                                             │   │
│  │                                                               │   │
│  │ Example:                                                      │   │
│  │ transform = "boolean.yesNo"                                   │   │
│  │ input: true → output: "Yes"                                   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                           │                                          │
│                           ▼                                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Step 4: SET TO TARGET FIELD                                  │   │
│  │                                                               │   │
│  │ result[mapping.targetField] = transformedValue                │   │
│  │                                                               │   │
│  │ Example: result.buyTimeframe = "1-6 months"                   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                           │                                          │
│                           ▼                                          │
│                                                                      │
│  AFTER ALL MAPPINGS:                                                 │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Step 5: ADD STATIC FIELDS                                    │   │
│  │                                                               │   │
│  │ For PING: add pingStaticFields                               │   │
│  │ For POST: add postStaticFields                               │   │
│  │                                                               │   │
│  │ Example: result.tagId = "204670250"                          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                           │                                          │
│                           ▼                                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Step 6: ADD COMPLIANCE DATA (POST only)                      │   │
│  │                                                               │   │
│  │ result.xxTrustedFormCertUrl = lead.trustedFormCertUrl        │   │
│  │ result.xxTrustedFormToken = lead.trustedFormCertId           │   │
│  │ result.universal_leadid = lead.jornayaLeadId                 │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  FINAL OUTPUT:                                                       │
│  {                                                                   │
│    "postalCode": "90210",                                           │
│    "buyTimeframe": "1-6 months",                                    │
│    "ownHome": "Yes",                                                │
│    "homePhone": "5551234567",                                       │
│    "tagId": "204670250",                                            │
│    "service": "WINDOWS",                                            │
│    "xxTrustedFormCertUrl": "https://cert...",                       │
│    ...                                                               │
│  }                                                                   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Available Transform Functions

| Transform | Category | Input | Output | Example |
|-----------|----------|-------|--------|---------|
| `boolean.yesNo` | Boolean | `true`/`false` | `"Yes"`/`"No"` | `true` → `"Yes"` |
| `boolean.trueFalse` | Boolean | `true`/`false` | `"true"`/`"false"` | `true` → `"true"` |
| `boolean.oneZero` | Boolean | `true`/`false` | `1`/`0` | `true` → `1` |
| `phone.digitsOnly` | Phone | Any format | Digits only | `"(555) 123-4567"` → `"5551234567"` |
| `phone.e164` | Phone | Any format | E.164 format | `"555-123-4567"` → `"+15551234567"` |
| `string.uppercase` | String | Any string | UPPERCASE | `"john"` → `"JOHN"` |
| `string.lowercase` | String | Any string | lowercase | `"JOHN"` → `"john"` |
| `string.titleCase` | String | Any string | Title Case | `"john doe"` → `"John Doe"` |
| `date.iso` | Date | Any date | ISO 8601 | `Date` → `"2024-01-15T..."` |
| `date.mmddyyyy` | Date | Any date | MM/DD/YYYY | `Date` → `"01/15/2024"` |

### Transformation Order (Critical!)

The order matters:
1. **valueMap** is applied FIRST (database-driven value conversion)
2. **transform** is applied SECOND (code-driven function)

```
Example: Converting project scope

sourceValue: "within_3_months"
        │
        ▼
valueMap: {"within_3_months": "Immediately"}
        │
        ▼
Result: "Immediately"  (transform not applied here since no transform specified)
```

---

## 8. Phase 6: PING/POST Auction

### PING Phase (Parallel)

**File:** `src/lib/auction/engine.ts`

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PING PHASE                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. For each NETWORK buyer in eligible list:                        │
│     ├── Transform lead data using pingTemplate                      │
│     ├── Build HTTP headers from authConfig                          │
│     └── Prepare POST request                                        │
│                                                                      │
│  2. Send ALL PINGs in parallel:                                      │
│     Promise.allSettled([                                             │
│       sendPingToBuyer(lead, buyer1, timeout),                       │
│       sendPingToBuyer(lead, buyer2, timeout),                       │
│       sendPingToBuyer(lead, buyer3, timeout)                        │
│     ])                                                               │
│                                                                      │
│  3. Collect responses (with timeout handling):                       │
│     Each response parsed by BuyerResponseParser to extract:         │
│     ├── bidAmount (look for: bid, bid_amount, price, offer)         │
│     ├── pingToken (needed for POST)                                 │
│     ├── buyerLeadId (buyer's reference)                             │
│     └── status (accepted, rejected, error)                          │
│                                                                      │
│  4. Log transaction for each PING:                                   │
│     INSERT INTO transactions (                                       │
│       lead_id, buyer_id, action_type='PING',                        │
│       payload, response, status, bid_amount, response_time          │
│     )                                                                │
│                                                                      │
│  Example PING payload (to Modernize):                                │
│  {                                                                   │
│    "postalCode": "90210",                                           │
│    "buyTimeframe": "1-6 months",                                    │
│    "ownHome": "Yes",                                                │
│    "tagId": "204670250",                                            │
│    "service": "WINDOWS",                                            │
│    "partnerSourceId": "fb"                                          │
│  }                                                                   │
│                                                                      │
│  Example PING response (Modernize):                                  │
│  {                                                                   │
│    "status": "success",                                             │
│    "pingToken": "abc123def456...",                                  │
│    "price": 45.50,                                                  │
│    "message": null                                                  │
│  }                                                                   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Winner Selection

```
┌─────────────────────────────────────────────────────────────────────┐
│                      WINNER SELECTION                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Filter valid bids:                                                  │
│  validBids = responses.filter(r =>                                   │
│    r.success === true &&                                             │
│    r.bidAmount > 0                                                   │
│  )                                                                   │
│                                                                      │
│  Sort by bid amount (descending):                                    │
│  rankedBids = validBids.sort((a, b) => b.bidAmount - a.bidAmount)   │
│                                                                      │
│  Winner = rankedBids[0] (highest bid)                                │
│                                                                      │
│  Example:                                                            │
│  ┌──────────────────┬───────────┬────────────┐                      │
│  │ Buyer            │ Bid       │ Status     │                      │
│  ├──────────────────┼───────────┼────────────┤                      │
│  │ HomeAdvisor      │ $65.00    │ WINNER ✓   │                      │
│  │ Modernize        │ $58.00    │ 2nd        │                      │
│  │ Local Contractor │ $48.00    │ 3rd        │                      │
│  │ Angi             │ $0 (cap)  │ REJECTED   │                      │
│  └──────────────────┴───────────┴────────────┘                      │
│                                                                      │
│  Tie-breaking strategies (if same bid):                              │
│  1. responseTime - fastest response wins                             │
│  2. random - random selection                                        │
│  3. priority - based on service zone priority                        │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### POST Phase

```
┌─────────────────────────────────────────────────────────────────────┐
│                          POST PHASE                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. Transform lead data using postTemplate:                          │
│     ├── Apply all mappings where includeInPost = true               │
│     ├── Add postStaticFields                                        │
│     └── Add compliance data (TrustedForm, Jornaya, TCPA)            │
│                                                                      │
│  2. Include PING response data:                                      │
│     ├── pingToken from PING response                                │
│     └── buyerLeadId from PING response                              │
│                                                                      │
│  3. Send POST to winner:                                             │
│     POST to postUrl (from postTemplate.url or buyer.apiUrl + /post) │
│                                                                      │
│  Example POST payload:                                               │
│  {                                                                   │
│    "postalCode": "90210",                                           │
│    "buyTimeframe": "1-6 months",                                    │
│    "ownHome": "Yes",                                                │
│    "firstName": "John",                                             │
│    "lastName": "Doe",                                               │
│    "email": "john@example.com",                                     │
│    "homePhone": "5551234567",                                       │
│    "tagId": "204670250",                                            │
│    "service": "WINDOWS",                                            │
│    "xxTrustedFormCertUrl": "https://cert.trustedform.com/...",      │
│    "xxTrustedFormToken": "abc123",                                  │
│    "universal_leadid": "jrn-456",                                   │
│    "homePhoneConsentLanguage": "By submitting this form...",        │
│    "pingToken": "abc123"                                            │
│  }                                                                   │
│                                                                      │
│  4. Parse response for acceptance:                                   │
│     Accepted if:                                                     │
│     ├── HTTP 2xx status                                             │
│     ├── Response contains: success=true, accepted=true, or          │
│     │   leadId/lead_id present                                      │
│     Rejected if:                                                     │
│     ├── HTTP 4xx/5xx status                                         │
│     └── Response contains: rejected, duplicate, error               │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### PING Token Flow (Automatic)

The `pingToken` is a critical field that correlates PING and POST requests. This is handled **automatically** by the auction engine for all standard PING/POST buyers.

```
┌─────────────────────────────────────────────────────────────────────┐
│                    PING TOKEN FLOW (AUTOMATIC)                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  STEP 1: PING Response Extraction                                    │
│  ─────────────────────────────────────────────────────────────────  │
│  File: src/lib/auction/engine.ts (lines 482-488)                    │
│                                                                      │
│  The system automatically extracts these fields from PING response: │
│                                                                      │
│  pingToken = responseData.pingToken                                 │
│           || responseData.ping_token                                │
│           || null                                                   │
│                                                                      │
│  buyerLeadId = responseData.leadId                                  │
│             || responseData.lead_id                                 │
│             || responseData.id                                      │
│             || null                                                 │
│                                                                      │
│  pingResponseData = responseData  (full response stored)            │
│                                                                      │
│  STEP 2: Storage in Bid Metadata                                     │
│  ─────────────────────────────────────────────────────────────────  │
│  Extracted values stored in winning bid metadata:                   │
│                                                                      │
│  winningBid.metadata = {                                            │
│    pingToken: "abc123",                                             │
│    buyerLeadId: "buyer-ref-456",                                    │
│    pingResponseData: { ... full response ... }                      │
│  }                                                                   │
│                                                                      │
│  STEP 3: Automatic Injection into POST                               │
│  ─────────────────────────────────────────────────────────────────  │
│  File: src/lib/auction/engine.ts (lines 564-578)                    │
│                                                                      │
│  if (winningBid?.metadata?.pingToken) {                             │
│    payload.pingToken = winningBid.metadata.pingToken;               │
│  }                                                                   │
│                                                                      │
│  if (winningBid?.metadata?.buyerLeadId) {                           │
│    payload.buyerLeadId = winningBid.metadata.buyerLeadId;           │
│  }                                                                   │
│                                                                      │
│  NO CONFIGURATION REQUIRED - this is automatic for all buyers!      │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

#### Default Supported Field Names

When no custom `pingTokenConfig` is set, these defaults are used:

| PING Response Field (checked in order) | Extracted As | POST Payload Field |
|----------------------------------------|--------------|-------------------|
| `pingToken`, `ping_token`, `ping_id`, `token` | `metadata.pingToken` | `pingToken` |
| `leadId`, `lead_id`, `buyerLeadId`, `buyer_lead_id`, `id` | `metadata.buyerLeadId` | `buyerLeadId` |

**For custom configurations**, set `pingTokenConfig` in Admin UI to override these defaults.

#### Industry Standard Compliance

This automatic handling works for all standard PING/POST APIs including:
- **Modernize** - Returns `pingToken`, expects `pingToken` in POST ✅
- **HomeAdvisor** - Returns `ping_token`, expects `pingToken` in POST ✅
- **Angi** - Returns `pingToken`, expects `pingToken` in POST ✅

#### Non-Standard Buyers (Configurable via Admin UI)

Some buyers use non-standard field names. These are now **fully supported** via the
`pingTokenConfig` configuration in the Admin UI:

| Buyer | PING Response Field | POST Expected Field | Status |
|-------|--------------------|--------------------|--------|
| **LeadProsper/Koalaty** | `ping_id` | `lp_ping_id` | ✅ CONFIGURED |

**Configuration via Admin UI:**

Navigate to: **Admin → Buyers → [Buyer Name] → Field Mapping → PING Token Configuration**

```json
{
  "pingTokenConfig": {
    "responseFields": ["ping_id"],
    "postFieldName": "lp_ping_id",
    "buyerLeadIdResponseFields": ["lead_id", "id"],
    "buyerLeadIdPostField": "lead_id"
  }
}
```

**Configuration Options:**

| Field | Description | Default |
|-------|-------------|---------|
| `responseFields` | Field names to check in PING response (priority order) | `["pingToken", "ping_token", "ping_id", "token"]` |
| `postFieldName` | Field name to use in POST payload | `"pingToken"` |
| `buyerLeadIdResponseFields` | Fields to check for buyer's lead ID | `["leadId", "lead_id", "buyerLeadId", "id"]` |
| `buyerLeadIdPostField` | Field name for buyer lead ID in POST | `"buyerLeadId"` |

**Key Files:**
- Type definition: `src/types/field-mapping.ts` → `PingTokenConfig`
- Extraction logic: `src/lib/auction/engine.ts` → `extractPingToken()`
- Injection logic: `src/lib/auction/engine.ts` → `sendPostToWinner()`
- Admin UI: `src/components/admin/field-mapping/FieldMappingEditor.tsx`

#### Why This Works

The field names `pingToken` and `ping_token` are **industry standards** for PING/POST
lead distribution APIs. Most network buyers follow this convention, making automatic
handling reliable without per-buyer configuration.

---

## 9. Phase 7: Cascade Delivery & Fallback

### Cascade Logic

If the winner rejects the POST, we try the next highest bidder:

```
┌─────────────────────────────────────────────────────────────────────┐
│                      CASCADE DELIVERY                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Ranked bids (from PING phase):                                      │
│  1. HomeAdvisor @ $65  ← Try first                                  │
│  2. Modernize @ $58    ← Try if #1 rejects                          │
│  3. Contractor @ $48   ← Try if #2 rejects                          │
│                                                                      │
│  for (let position = 1; position <= rankedBids.length; position++) { │
│    const bid = rankedBids[position - 1];                            │
│                                                                      │
│    result = await sendPostToBuyer(lead, bid, position);             │
│                                                                      │
│    if (result.accepted) {                                           │
│      // SUCCESS! Update lead as SOLD                                │
│      await updateLeadSold(lead, bid.buyer, bid.amount);             │
│      return { success: true, winner: bid.buyer, amount: bid.amount };│
│    }                                                                 │
│                                                                      │
│    // Log rejection reason                                           │
│    await logTransactionRejection(lead, bid, result.reason);         │
│  }                                                                   │
│                                                                      │
│  // All network buyers rejected - fall through to contractor        │
│  return { success: false, reason: 'CASCADE_EXHAUSTED' };            │
│                                                                      │
│  Rejection reasons tracked:                                          │
│  ├── DUPLICATE_LEAD (HTTP 409)                                      │
│  ├── CAP_REACHED (HTTP 429)                                         │
│  ├── OUTSIDE_HOURS (message contains "hours")                       │
│  ├── COMPLIANCE_MISSING (message contains "compliance")             │
│  ├── TIMEOUT (no response)                                          │
│  └── POST_REJECTED (generic)                                        │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Transaction Recording

Every PING and POST is logged in the `transactions` table:

| Field | Description |
|-------|-------------|
| `lead_id` | Reference to the lead |
| `buyer_id` | Which buyer this transaction is with |
| `action_type` | `PING` or `POST` |
| `payload` | JSON of what was sent |
| `response` | JSON of what was received |
| `status` | `SUCCESS`, `FAILED`, `TIMEOUT` |
| `bid_amount` | Bid from PING response |
| `response_time` | Milliseconds |
| `is_winner` | `true` if this buyer won |
| `lost_reason` | Why this buyer lost (`OUTBID`, `CASCADE_EXHAUSTED`, etc.) |
| `cascade_position` | 1st, 2nd, 3rd attempt in cascade |

---

## 10. Phase 8: Contractor Delivery (Fallback)

### When Contractor Delivery Happens

Contractor delivery occurs when:
1. No NETWORK buyers were eligible
2. All NETWORK buyers rejected the POST (cascade exhausted)
3. The lead matches CONTRACTOR-type buyers only

### Contractor Delivery Modes

**File:** `src/lib/services/contractor-delivery-service.ts`

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CONTRACTOR DELIVERY                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Delivery Modes:                                                     │
│                                                                      │
│  1. EXCLUSIVE MODE                                                   │
│     └── Only the TOP 1 contractor receives the lead                 │
│     └── Determined by priority score                                │
│                                                                      │
│  2. SHARED MODE                                                      │
│     └── Top N contractors receive the lead (maxSharedLeads)         │
│     └── Same lead goes to multiple contractors                      │
│                                                                      │
│  Pricing Models:                                                     │
│                                                                      │
│  1. FIXED                                                            │
│     └── Contractor pays fixedLeadPrice per lead                     │
│                                                                      │
│  2. AUCTION                                                          │
│     └── Price based on PING bids (like network buyers)              │
│                                                                      │
│  3. HYBRID                                                           │
│     └── Uses network winning bid to set price                       │
│     └── Contractor price = networkWinningBid * multiplier           │
│                                                                      │
│  Notification Methods:                                               │
│                                                                      │
│  1. EMAIL                                                            │
│     └── Send lead details to notifyEmail                            │
│                                                                      │
│  2. WEBHOOK                                                          │
│     └── POST to apiUrl if notifyWebhook = true                      │
│                                                                      │
│  3. DASHBOARD                                                        │
│     └── Make available in contractor portal                         │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 11. Admin Configuration Guide

### Configuring a New Buyer

#### Step 1: Create the Buyer

Navigate to **Admin → Buyers → Add Buyer**

| Field | Description | Example |
|-------|-------------|---------|
| Name | Internal reference name | `Modernize` |
| Display Name | Customer-facing name | `Modernize Inc.` |
| Type | `NETWORK` or `CONTRACTOR` | `NETWORK` |
| API URL | Base URL for PING/POST | `https://api.modernize.com` |
| Auth Type | `apiKey`, `bearer`, `basic`, `none` | `apiKey` |
| Ping Timeout | Seconds to wait for PING response | `30` |
| Post Timeout | Seconds to wait for POST response | `60` |

#### Step 2: Configure Authentication

The `authConfig` JSON is stored encrypted:

```json
{
  "type": "apiKey",
  "credentials": {
    "key": "your-api-key-here"
  },
  "headers": {
    "X-API-Key": "{{key}}"
  }
}
```

#### Step 3: Create Service Configuration

Navigate to **Buyer → Service Configs → Add Config**

| Field | Description |
|-------|-------------|
| Service Type | Windows, Roofing, HVAC, etc. |
| Min Bid | Minimum acceptable bid amount |
| Max Bid | Maximum bid limit |
| Requires TrustedForm | Lead must have TrustedForm |
| Requires Jornaya | Lead must have Jornaya |

#### Step 4: Configure Field Mappings (CRITICAL)

Navigate to **Buyer → Service Config → Field Mappings**

```
┌─────────────────────────────────────────────────────────────────────┐
│                    FIELD MAPPING EDITOR                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Source Field    →    Target Field    Transform       PING   POST   │
│  ─────────────────────────────────────────────────────────────────  │
│  zipCode         →    postalCode      (none)          ✓      ✓     │
│  timeframe       →    buyTimeframe    valueMap        ✓      ✓     │
│  ownsHome        →    ownHome         boolean.yesNo   ✓      ✓     │
│  phone           →    homePhone       phone.digits    ✗      ✓     │
│  firstName       →    firstName       (none)          ✗      ✓     │
│  lastName        →    lastName        (none)          ✗      ✓     │
│  email           →    email           (none)          ✗      ✓     │
│                                                                      │
│  Static Fields (PING):                                               │
│  ─────────────────────────────────────────────────────────────────  │
│  tagId: 204670250                                                   │
│  service: WINDOWS                                                   │
│  partnerSourceId: fb                                                │
│                                                                      │
│  Static Fields (POST):                                               │
│  ─────────────────────────────────────────────────────────────────  │
│  tagId: 204670250                                                   │
│  service: WINDOWS                                                   │
│  homePhoneConsentLanguage: "By submitting this form..."            │
│                                                                      │
│  [Preview Payload]  [Save Changes]                                  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

#### Step 5: Configure ZIP Code Coverage

Navigate to **Buyer → Coverage → Add ZIP Codes**

Options:
- **Single ZIP**: Add one ZIP code at a time
- **Bulk Import**: Upload CSV of ZIP codes
- **By State**: Add all ZIPs in a state
- **By Radius**: Add ZIPs within X miles of a center point

Per-ZIP settings:
| Field | Description |
|-------|-------------|
| Priority | 1-1000, higher = more priority in tiebreaks |
| Max Leads/Day | Daily cap for this ZIP |
| Min/Max Bid | Override service-level bid limits |

---

## 12. Database Schema Reference

### Core Tables

```
┌─────────────────────────────────────────────────────────────────────┐
│                       DATABASE SCHEMA                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  service_types                                                       │
│  ├── id (UUID, PK)                                                  │
│  ├── name (VARCHAR, UNIQUE) - "windows", "roofing"                  │
│  ├── display_name (VARCHAR)                                         │
│  ├── form_schema (JSON) - Dynamic form fields                       │
│  └── active (BOOLEAN)                                               │
│                                                                      │
│  buyers                                                              │
│  ├── id (UUID, PK)                                                  │
│  ├── name (VARCHAR)                                                 │
│  ├── type (ENUM) - NETWORK, CONTRACTOR                              │
│  ├── api_url (VARCHAR)                                              │
│  ├── auth_config (TEXT, ENCRYPTED) - JSON                          │
│  ├── webhook_secret (VARCHAR, ENCRYPTED)                            │
│  ├── ping_timeout (INT) - seconds                                   │
│  ├── post_timeout (INT) - seconds                                   │
│  ├── compliance_field_mappings (JSON)                               │
│  ├── active (BOOLEAN)                                               │
│  └── [CONTRACTOR-specific]: delivery_mode, fixed_lead_price, etc.  │
│                                                                      │
│  buyer_service_configs                                               │
│  ├── id (UUID, PK)                                                  │
│  ├── buyer_id (FK → buyers)                                         │
│  ├── service_type_id (FK → service_types)                           │
│  ├── ping_template (JSON) - { url, headers }                        │
│  ├── post_template (JSON) - { url, headers }                        │
│  ├── field_mappings (JSON) - FieldMappingConfig                     │
│  ├── requires_trustedform (BOOLEAN)                                 │
│  ├── requires_jornaya (BOOLEAN)                                     │
│  ├── min_bid (DECIMAL)                                              │
│  ├── max_bid (DECIMAL)                                              │
│  ├── active (BOOLEAN)                                               │
│  └── UNIQUE(buyer_id, service_type_id)                              │
│                                                                      │
│  buyer_service_zip_codes                                             │
│  ├── id (UUID, PK)                                                  │
│  ├── buyer_id (FK → buyers)                                         │
│  ├── service_type_id (FK → service_types)                           │
│  ├── zip_code (VARCHAR)                                             │
│  ├── active (BOOLEAN)                                               │
│  ├── priority (INT) - for tiebreaks                                 │
│  ├── max_leads_per_day (INT, NULLABLE)                              │
│  ├── min_bid (DECIMAL, NULLABLE) - overrides service config         │
│  ├── max_bid (DECIMAL, NULLABLE) - overrides service config         │
│  └── UNIQUE(buyer_id, service_type_id, zip_code)                    │
│                                                                      │
│  leads                                                               │
│  ├── id (UUID, PK)                                                  │
│  ├── service_type_id (FK → service_types)                           │
│  ├── form_data (JSON) - raw form values                             │
│  ├── zip_code (VARCHAR)                                             │
│  ├── owns_home (BOOLEAN)                                            │
│  ├── timeframe (VARCHAR)                                            │
│  ├── status (ENUM) - PENDING, PROCESSING, SOLD, REJECTED, EXPIRED   │
│  ├── winning_buyer_id (FK → buyers, NULLABLE)                       │
│  ├── winning_bid (DECIMAL, NULLABLE)                                │
│  ├── trusted_form_cert_url (VARCHAR)                                │
│  ├── trusted_form_cert_id (VARCHAR)                                 │
│  ├── jornaya_lead_id (VARCHAR)                                      │
│  ├── compliance_data (JSON)                                         │
│  ├── lead_quality_score (INT)                                       │
│  └── created_at, updated_at                                         │
│                                                                      │
│  transactions                                                        │
│  ├── id (UUID, PK)                                                  │
│  ├── lead_id (FK → leads)                                           │
│  ├── buyer_id (FK → buyers)                                         │
│  ├── action_type (ENUM) - PING, POST, DELIVERY                      │
│  ├── payload (JSON)                                                 │
│  ├── response (JSON)                                                │
│  ├── status (ENUM) - SUCCESS, FAILED, TIMEOUT                       │
│  ├── bid_amount (DECIMAL, NULLABLE)                                 │
│  ├── response_time (INT) - milliseconds                             │
│  ├── error_message (VARCHAR)                                        │
│  ├── is_winner (BOOLEAN)                                            │
│  ├── lost_reason (VARCHAR) - OUTBID, CASCADE_EXHAUSTED, etc.        │
│  ├── cascade_position (INT)                                         │
│  └── created_at                                                     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 13. Troubleshooting

### Lead Not Reaching Any Buyers

**Check in this order:**

1. **Lead created?**
   ```sql
   SELECT * FROM leads WHERE id = 'lead-uuid';
   ```

2. **Lead processed?**
   ```sql
   SELECT status FROM leads WHERE id = 'lead-uuid';
   -- Should be PROCESSING, SOLD, or REJECTED (not PENDING)
   ```

3. **Any eligible buyers?**
   ```sql
   SELECT b.name, bsz.zip_code
   FROM buyer_service_zip_codes bsz
   JOIN buyers b ON bsz.buyer_id = b.id
   WHERE bsz.service_type_id = 'service-uuid'
     AND bsz.zip_code = '90210'
     AND bsz.active = true
     AND b.active = true;
   ```

4. **Transactions created?**
   ```sql
   SELECT t.action_type, t.status, t.bid_amount, t.error_message, b.name
   FROM transactions t
   JOIN buyers b ON t.buyer_id = b.id
   WHERE t.lead_id = 'lead-uuid'
   ORDER BY t.created_at;
   ```

### Buyer Not Receiving PINGs

**Check:**

1. Buyer active? `SELECT active FROM buyers WHERE id = 'buyer-uuid'`
2. Service config exists and active?
3. ZIP code coverage exists and active?
4. Compliance requirements met?
5. Daily cap not exceeded?

### Field Mappings Not Applied

**Check:**

1. `field_mappings` column has valid JSON
2. `includeInPing` / `includeInPost` flags set correctly
3. Source field paths match lead data structure
4. Cache cleared after updates (`invalidateFieldMappingCache`)

### Wrong Payload Structure

**Check in transactions table:**

```sql
SELECT payload, response
FROM transactions
WHERE lead_id = 'lead-uuid' AND buyer_id = 'buyer-uuid';
```

Compare against expected format from buyer documentation.

---

## 14. Key Files Reference

| Purpose | File Path |
|---------|-----------|
| Lead submission API | `src/app/api/leads/route.ts` |
| Auction engine | `src/lib/auction/engine.ts` |
| Buyer eligibility | `src/lib/services/buyer-eligibility-service.ts` |
| Buyer config loading | `src/lib/field-mapping/database-buyer-loader.ts` |
| Template/transform engine | `src/lib/templates/engine.ts` |
| Transform functions | `src/lib/templates/transforms.ts` |
| Contractor delivery | `src/lib/services/contractor-delivery-service.ts` |
| Service zone repository | `src/lib/repositories/service-zone-repository.ts` |
| Lead worker | `src/workers/lead-processor.ts` |
| Service landing pages | `src/app/services/[slug]/page.tsx` |
| Dynamic form component | `src/components/forms/dynamic/DynamicForm.tsx` |
| Admin buyer management | `src/app/(admin)/admin/buyers/[id]/page.tsx` |
| Field mapping editor | `src/components/admin/field-mapping/FieldMappingEditor.tsx` |
| Prisma schema | `prisma/schema.prisma` |

---

## Summary

The lead delivery system is a sophisticated auction platform that:

1. **Captures leads** through dynamic, service-specific forms with compliance tracking
2. **Validates and scores** leads based on compliance data quality
3. **Finds eligible buyers** based on service type, ZIP code, and compliance requirements
4. **Transforms lead data** per-buyer using configurable field mappings
5. **Runs a real-time auction** with parallel PINGs and cascade POST delivery
6. **Falls back to contractors** if network buyers reject
7. **Logs everything** for auditing and troubleshooting

The key differentiator is the **database-driven field mapping system** that allows each buyer to receive payloads in their exact format without code changes.

---

*Document Version: 1.0*
*Last Updated: 2026-01-15*
