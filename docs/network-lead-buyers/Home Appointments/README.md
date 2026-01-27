# Home Appointments Integration

## Overview

Home Appointments is a network lead buyer using the **boberdoo** platform. They purchase leads via PING/POST auction with real-time bidding.

**Status:** FULLY IMPLEMENTED (January 2026)

## Quick Reference

| Field | Value |
|-------|-------|
| Buyer ID | `home-appointments-001` |
| Platform | boberdoo |
| API Base URL | `https://homeappointments.leadportal.com/new_api/api.php` |
| API Key | `77e3c8a6020aa481fe944ce211b42f4fcabfe5a20e0760179376f469f7240ab6` |
| SRC | `Zoka` |
| TYPE | `38` |
| Test ZIP | `99999` |

## Services Configured

| Service | Status | Trade Value |
|---------|--------|-------------|
| Windows | **ACTIVE** | Windows |
| Bathrooms | Inactive | Bathroom |
| Roofing | Inactive | Roofing |
| HVAC | Inactive | HVAC |

## API Documentation

- **Posting Specs:** https://homeappointments.leadportal.com/new_api/index.php?action=detail&func=pingPostLead&TYPE=38
- **Local PDF:** See `PAY PER CALL - Zoka - RTB Posting Docs - CNL _ Home Appointments.pdf`

## Special Implementation Notes

Home Appointments required custom features that didn't exist before this integration:

### 1. Request Wrapper (`requestWrapper: "Request"`)

The boberdoo platform requires the entire JSON payload to be wrapped:

```json
// Standard format (most buyers):
{ "firstName": "John", "zipCode": "12345" }

// boberdoo format (Home Appointments):
{ "Request": { "firstName": "John", "zipCode": "12345" } }
```

**Implementation:** Added `requestWrapper` field to `FieldMappingConfig`. When set, the auction engine wraps the payload before sending.

### 2. Nested Response Parsing

Their responses use nested paths:
```json
{
  "response": {
    "status": "Matched",
    "lead_id": "874",
    "price": "25"
  }
}
```

**Implementation:** The `responseMappingConfig` now supports dot notation for nested fields:
- `statusField: "response.status"`
- `bidAmountFields: ["response.price"]`

### 3. Custom Ping Token Field Names

They use `lead_id` instead of `pingToken`:

**Implementation:** `pingTokenConfig` allows custom field names:
```json
{
  "responseFields": ["response.lead_id", "lead_id"],
  "postFieldName": "Lead_ID"
}
```

## Response Format

### PING Success
```json
{
  "response": {
    "status": "Matched",
    "lead_id": "874",
    "price": "25"
  }
}
```

### POST Success
```json
{
  "response": {
    "status": "Matched",
    "lead_id": "874"
  }
}
```

### Rejected
```json
{
  "response": {
    "status": "Unmatched",
    "lead_id": "874"
  }
}
```

## Field Mapping Summary

### PING Fields (sent on both PING and POST)
- `Zip` ← zipCode
- `Trade` ← static (Windows, Bathroom, etc.)
- `IP_Address` ← compliance.ipAddress
- `Trusted_Form_URL` ← trustedFormCertUrl
- `TCPA_Consent` ← tcpaConsent (transformed to Yes/No)
- `TCPA_Language` ← tcpaLanguage
- `Landing_Page` ← static (https://mycontractornow.com)
- `User_Agent` ← compliance.userAgent
- `Sub_ID` ← affiliateClickId
- `Pub_ID` ← affiliateId
- `Homeowner` ← ownsHome (transformed to Yes/No)

### POST-Only Fields
- `First_Name` ← firstName
- `Last_Name` ← lastName
- `Primary_Phone` ← phone (digits only)
- `Email` ← email
- `Address` ← address
- `City` ← city
- `State` ← state
- `LeadiD_Token` ← jornayaLeadId
- `Unique_Identifier` ← leadId

### Static Fields
**PING:**
```json
{
  "Key": "77e3c8a6...",
  "API_Action": "pingPostLead",
  "Mode": "ping",
  "TYPE": "38",
  "SRC": "Zoka",
  "Return_Best_Price": "1",
  "Format": "JSON"
}
```

**POST:**
```json
{
  "Key": "77e3c8a6...",
  "API_Action": "pingPostLead",
  "Mode": "post",
  "TYPE": "38",
  "SRC": "Zoka",
  "Format": "JSON"
}
```

## Testing

Use ZIP code `99999` for test submissions. This will:
- Return a valid PING response
- Not count against their daily caps
- Allow end-to-end testing

## Files Modified for This Integration

| File | Change |
|------|--------|
| `src/types/field-mapping.ts` | Added `requestWrapper` to `FieldMappingConfig` |
| `src/lib/templates/types.ts` | Added `requestWrapper` to `BuyerServiceConfig` |
| `src/lib/field-mapping/database-buyer-loader.ts` | Extract and pass `requestWrapper` |
| `src/lib/auction/engine.ts` | Added `wrapPayloadIfNeeded()` helper |

## Isolation Guarantee

All configuration for Home Appointments is isolated to their buyer record:
- Field mappings stored in `buyer_service_configs.field_mappings` (unique per buyer+service)
- Response parsing uses `response_mapping_config` (per buyer)
- The `requestWrapper` feature is opt-in - only applies when configured

**No changes affect other buyers.**

## Original Email

See the buyer's notes in the database for the complete original email from Home Appointments with integration instructions.

---

## Transformation Verification (Jan 27, 2026)

### Sample PING Payload (wrapped in Request)
```json
{
  "Request": {
    "Key": "77e3c8a6...",
    "API_Action": "pingPostLead",
    "Mode": "ping",
    "TYPE": "38",
    "SRC": "Zoka",
    "Return_Best_Price": "1",
    "Format": "JSON",
    "Trade": "Windows",
    "Landing_Page": "https://mycontractornow.com",
    "TCPA_Language": "By clicking Submit...",
    "Zip": "90210",
    "IP_Address": "192.168.1.100",
    "Trusted_Form_URL": "https://cert.trustedform.com/...",
    "TCPA_Consent": "Yes",
    "User_Agent": "Mozilla/5.0...",
    "Sub_ID": "aff-click-123",
    "Pub_ID": "partner-ref-456",
    "Homeowner": "Yes",
    "Number_Of_Windows": "3-5",
    "Project_Type": "Repair"
  }
}
```

### Sample POST Payload (wrapped in Request)
```json
{
  "Request": {
    "Key": "77e3c8a6...",
    "API_Action": "pingPostLead",
    "Mode": "post",
    "TYPE": "38",
    "SRC": "Zoka",
    "Format": "JSON",
    "Trade": "Windows",
    "Landing_Page": "https://mycontractornow.com",
    "TCPA_Language": "By clicking Submit...",
    "Zip": "90210",
    "IP_Address": "192.168.1.100",
    "Trusted_Form_URL": "https://cert.trustedform.com/...",
    "TCPA_Consent": "Yes",
    "User_Agent": "Mozilla/5.0...",
    "Sub_ID": "aff-click-123",
    "Pub_ID": "partner-ref-456",
    "Homeowner": "Yes",
    "First_Name": "John",
    "Last_Name": "Doe",
    "Primary_Phone": "5551234567",
    "Email": "john@example.com",
    "Address": "123 Main St",
    "City": "Beverly Hills",
    "State": "CA",
    "LeadiD_Token": "jornaya-token-xyz",
    "Unique_Identifier": "lead-12345",
    "Lead_ID": "874",
    "Number_Of_Windows": "3-5",
    "Project_Type": "Repair"
  }
}
```

### Transformation Details
| Source Field | Target Field | Transform | Example |
|--------------|--------------|-----------|---------|
| `ownsHome` | `Homeowner` | `boolean.yesNo` | `true` → `"Yes"` |
| `complianceData.tcpaConsent` | `TCPA_Consent` | `boolean.yesNo` | `true` → `"Yes"` |
| `phone` | `Primary_Phone` | `phone.digitsOnly` | `"555-123-4567"` → `"5551234567"` |
| `formData.projectScope` | `Project_Type` | valueMap | `"repair"` → `"Repair"` |
| `formData.numberOfWindows` | `Number_Of_Windows` | valueMap | `"9+"` → `"10+"` |

### Fixes Applied (Jan 27, 2026)
1. **Moved static fields** - `Trade`, `Landing_Page`, `TCPA_Language` moved from invalid mapping with `sourceField: null` to `pingStaticFields`/`postStaticFields`
2. **Fixed compliance paths** - Changed from `compliance.*` to `complianceData.*` (matching actual data structure)
3. **Added TCPA_Language** - Static consent text since there's no dynamic field for this
