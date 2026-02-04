# Koalaty Leads - Windows Integration

## Overview

| Field | Value |
|-------|-------|
| **Buyer Name** | Koalaty Leads |
| **Buyer ID** | `8567babe-c8c2-4dda-9c0a-abc2c82fa660` |
| **Type** | NETWORK |
| **Platform** | Lead Prosper |
| **API Base URL** | `https://api.leadprosper.io` |
| **Status** | INACTIVE (pending activation) |

## API Documentation

**Official Docs:** https://api.leadprosper.io/api-specs?hash=7joqs3rdmi66q7

## Endpoints

| Action | URL |
|--------|-----|
| **PING** | `https://api.leadprosper.io/ping` |
| **POST** | `https://api.leadprosper.io/post` |

---

## Authentication (Static Fields)

All requests MUST include these authentication fields:

```json
{
  "lp_campaign_id": "19740",
  "lp_supplier_id": "101358",
  "lp_key": "7joqs3rdmi66q7"
}
```

---

## Field Mappings

### PING Fields

These fields are sent to `/ping` endpoint for bid requests:

| Our Field | → | Koalaty Field | Transform | Required |
|-----------|---|---------------|-----------|----------|
| `formData.address.state` | → | `state` | direct | Yes |
| `zipCode` | → | `zip_code` | direct | Yes |
| `ipAddress` | → | `ip_address` | direct | Yes |
| `userAgent` | → | `user_agent` | direct | Yes |
| `formData.attribution.referrer` | → | `landing_page_url` | direct | Yes |
| `ownsHome` | → | `home_owner` | `boolean.yesNo` | Yes |
| `trustedFormCertUrl` | → | `trustedform_cert_url` | direct | Yes |
| `timeframe` | → | `time_frame` | valueMap | Yes |
| `formData.numberOfWindows` | → | `number_of_windows` | valueMap | Yes |
| `formData.projectScope` | → | `project_type` | valueMap | Yes |

### POST Fields (Additional)

These fields are sent to `/post` endpoint AFTER a successful ping (includes PII):

| Our Field | → | Koalaty Field | Transform | Required |
|-----------|---|---------------|-----------|----------|
| `formData.firstName` | → | `first_name` | direct | Yes |
| `formData.lastName` | → | `last_name` | direct | Yes |
| `formData.email` | → | `email` | direct | Yes |
| `formData.phone` | → | `phone` | `phone.digitsOnly` | Yes |
| `formData.address.street` | → | `address` | direct | Yes |
| `formData.address.city` | → | `city` | direct | Yes |
| `jornayaLeadId` | → | `jornaya_leadid` | direct | No |

> **Note:** The `lp_ping_id` field is automatically injected from the PING response.

---

## Value Mappings

### timeframe → time_frame

| Our Value | → | Koalaty Value |
|-----------|---|---------------|
| `within_3_months` | → | `Immediately` |
| `3_plus_months` | → | `4-6 months` |
| `not_sure` | → | `Unknown` |

**All accepted values:** `Immediately`, `Within 1 month`, `1-3 months`, `4-6 months`, `6+ months`, `Unknown`

### numberOfWindows → number_of_windows

| Our Value | → | Koalaty Value |
|-----------|---|---------------|
| `1` | → | `1` |
| `2` | → | `2` |
| `3-5` | → | `3-5` |
| `6-9` | → | `6-9` |
| `10+` | → | `10` |

**All accepted values:** `1`, `2`, `3-5`, `6-9`, `10`

### projectScope → project_type

| Our Value | → | Koalaty Value |
|-----------|---|---------------|
| `install` | → | `Install` |
| `repair` | → | `Repair` |
| `replace` | → | `Replace` |

**All accepted values:** `Install`, `Repair`, `Replace`

---

## Static Fields

### Added to ALL Requests (PING & POST)

```json
{
  "lp_campaign_id": "19740",
  "lp_supplier_id": "101358",
  "lp_key": "7joqs3rdmi66q7",
  "property_type": "Residential",
  "tcpa_optin": "Yes"
}
```

### Added to POST Only

```json
{
  "tcpa_text": "By submitting your information, you authorize My Contractor Now and up to four of its affiliated Home Improvement Companies to contact you at the telephone number and email address provided — including through automated dialing systems, artificial/prerecorded voice, and SMS/MMS text messages — regarding your inquiry. You acknowledge and agree that this consent allows us to contact you even if your telephone number is on a federal, state, or corporate Do-Not-Call (DNC) registry. Message and data rates may apply; message frequency may vary. Your consent is not required as a condition of purchase, and you may revoke your consent at any time (e.g., by replying STOP to any text, etc.) By submitting, you agree to our Privacy Policy and Terms and Conditions."
}
```

---

## Compliance Requirements

| Compliance | Required | Stage |
|------------|----------|-------|
| **TrustedForm** | Yes | PING (required for bid) |
| **Jornaya** | Optional | POST (if available) |

---

## Response Handling

### PING Response

```json
{
  "status": "ACCEPTED",
  "ping_id": "abc123",
  "payout": 25.00
}
```

| Field | Description |
|-------|-------------|
| `status` | `ACCEPTED` = bid received |
| `ping_id` | Required for POST request |
| `payout` | Bid amount in USD |

### POST Response

```json
{
  "status": "ACCEPTED",
  "lead_id": "xyz789",
  "payout": 25.00
}
```

| Field | Description |
|-------|-------------|
| `status` | `ACCEPTED` = lead accepted |
| `lead_id` | Their internal lead ID |
| `payout` | Final payout amount |

### Error Response

```json
{
  "status": "ERROR",
  "code": 1001,
  "message": "Missing required parameter lp_ping_id",
  "lead_id": "wwh5KpwB8G-3h53l8RBQ",
  "payout": 0
}
```

**Important:** Koalaty returns `lead_id` even in error responses. Our system checks for error indicators (`status: "ERROR"`, `code != 0`) BEFORE checking for success indicators to avoid false positives.

---

## PING/POST Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ Database: pingTokenConfig                                        │
│   responseFields: ["ping_id"]                                   │
│   postFieldName: "lp_ping_id"                                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
        ┌──────────────────┴──────────────────┐
        ▼                                      ▼
   PING Request                           POST Request
   ────────────                           ────────────
   1. TemplateEngine.transform()          1. TemplateEngine.transform()
   2. Apply field mappings + valueMap     2. Apply field mappings + valueMap
   3. Add static fields                   3. Add static fields
   4. Serialize as JSON                   4. Inject lp_ping_id from metadata
   5. Send to /ping                       5. Serialize as JSON
        │                                 6. Send to /post
        ▼                                      │
   Koalaty Response:                           ▼
   {                                      Koalaty Response:
     "status": "ACCEPTED",                {
     "ping_id": "abc123...",                "status": "ACCEPTED",
     "bids": [{"payout": 35.70}]            "lead_id": "xyz789",
   }                                         "payout": 35.70
        │                                 }
        ▼
   extractPingToken()
   using responseFields: ["ping_id"]
        │
        ▼
   Store in bid.metadata:
   {
     pingToken: "abc123...",
     pingTokenConfig: { postFieldName: "lp_ping_id" }
   }
```

### Data Flow Summary

| Step | Action | Code Location |
|------|--------|---------------|
| 1 | Load pingTokenConfig from DB | `database-buyer-loader.ts:662` |
| 2 | Build PING payload with field mappings | `templates/engine.ts:180-294` |
| 3 | Send PING, extract `ping_id` | `auction/engine.ts:699-706` |
| 4 | Store in `bid.metadata.pingToken` | `auction/engine.ts:719-720` |
| 5 | Build POST payload | `auction/engine.ts:1053-1058` |
| 6 | Inject using `postFieldName: "lp_ping_id"` | `auction/engine.ts:1068-1080` |
| 7 | Send POST with `lp_ping_id` included | `auction/engine.ts:1092-1097` |

---

## Error Detection Logic

Our system correctly handles Koalaty error responses that include `lead_id`:

```typescript
// src/lib/auction/engine.ts - isPostAccepted()

// FIRST: Check for error indicators (these override success indicators)
const errorIndicators = [
  responseData.status === 'ERROR',
  responseData.status === 'REJECTED',
  responseData.status === 'FAILED',
  responseData.code !== undefined && responseData.code !== 0,  // Non-zero = error
  responseData.error === true,
  responseData.accepted === false,
  responseData.success === false,
];

if (errorIndicators.some(indicator => indicator === true)) {
  return false;  // Reject - don't be fooled by lead_id in error response
}

// THEN: Check for success indicators (only if no errors)
const acceptIndicators = [
  responseData.status === 'ACCEPTED',
  responseData.status === 'SUCCESS',
  responseData.lead_id !== undefined,  // Safe now - errors already filtered
  // ... more indicators
];
```

**Why this matters:** Koalaty returns `lead_id` in both success AND error responses. Without checking errors first, we'd falsely mark errors as successful deliveries.

---

## pingTokenConfig (Database Configuration)

This configuration is stored in `BuyerServiceConfig.fieldMappings`:

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

| Field | Purpose | Value |
|-------|---------|-------|
| `responseFields` | Fields to check in PING response for token | `["ping_id"]` |
| `postFieldName` | Field name to use when injecting into POST | `"lp_ping_id"` |
| `buyerLeadIdResponseFields` | Fields to check for buyer's lead ID | `["lead_id", "id"]` |
| `buyerLeadIdPostField` | Field name for buyer lead ID in POST | `"lead_id"` |

---

## Database IDs

```
Buyer ID:         8567babe-c8c2-4dda-9c0a-abc2c82fa660
Service Config:   7851dbb4-db96-4c57-b34c-26707dd356ce
Service Type:     ce6407cd-c8e7-4d64-b01e-13e157c33854 (windows)
```

---

## Activation

To activate this buyer when ready:

```sql
UPDATE buyers SET active = true WHERE id = '8567babe-c8c2-4dda-9c0a-abc2c82fa660';
```

---

## Additional API Fields (Not Currently Mapped)

These optional fields are available in the API but not currently sent:

| Koalaty Field | Description | Accepted Values |
|---------------|-------------|-----------------|
| `lp_subid1` | Sub-tracking ID 1 | string |
| `lp_subid2` | Sub-tracking ID 2 | string |
| `type_of_windows` | Window type | `Casement`, `Fixed`, `Skylight`, `Sliding`, `Other` |
| `window_material` | Material type | `Wood`, `Aluminum`, `Vinyl`, `Metal`, `Other` |

---

*Last Updated: 2026-02-04*
