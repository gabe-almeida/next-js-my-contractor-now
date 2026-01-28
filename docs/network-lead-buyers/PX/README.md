# PX Integration

> **Status:** INACTIVE - Awaiting API Token from PX integration team

## Overview

PX (PixelMEDIA) is a network lead buyer for Windows and Bathrooms verticals using exclusive Ping/Post model.

## Integration Details

| Field | Value |
|-------|-------|
| Buyer ID | `px-network-001` |
| Legal Name | Zoka Design Inc |
| Netsuite ID | 10246 |
| Post Type | Ping Post |
| Sales Model | Exclusive |
| Account Manager | TBD |
| Sales Manager | Eliana Goodman |

## API Endpoints

| Endpoint | URL |
|----------|-----|
| Ping | `https://leadapi.px.com/api/lead/ping` |
| Post | `https://leadapi.px.com/api/lead/post` |
| Windows API Docs | https://api.px.com/v2/verticals/windows/ping-post-exclusive-windows/ |
| Bathrooms API Docs | https://api.px.com/v2/verticals/bathroom-remodeling/ping-post-exclusive-bathroom-remodeling/ |
| Offer Guidelines | https://www.px.com/offer-guidelines/ |

## Authentication

- **Method:** Body-based API Token (GUID format)
- **Header:** `Content-Type: Application/json`
- **Field:** `ApiToken` (included in request body via `pingStaticFields`/`postStaticFields`)

**IMPORTANT:** PX uses **body-based authentication**, not header-based. The `ApiToken` is stored in the `field_mappings` JSON column under `pingStaticFields` and `postStaticFields`, NOT in `auth_config`.

**Status:** Awaiting API Token from PX integration team.

### How to Update Token Once Received

```sql
-- Update both Windows and Bathrooms configs with the real token
UPDATE buyer_service_configs
SET field_mappings = REPLACE(field_mappings::text, 'PLACEHOLDER_AWAITING_TOKEN_FROM_PX', 'ACTUAL_TOKEN_HERE')::jsonb
WHERE buyer_id = 'px-network-001';
```

## Services Configured

### Windows
- **Config ID:** `px-windows-001`
- **Service Type ID:** `ce6407cd-c8e7-4d64-b01e-13e157c33854`
- **Active:** No
- **Nationwide:** Yes

### Bathrooms
- **Config ID:** `px-bathrooms-001`
- **Service Type ID:** `3bb54537-6818-404e-8daa-afebb45f500e`
- **Active:** No
- **Nationwide:** Yes

## Field Mappings

### PING Payload (Windows)

| Our Field | PX Field | Notes |
|-----------|----------|-------|
| `zipCode` | `ZipCode` | 5-digit |
| `formData.address.state` | `State` | 2-letter code |
| `ownsHome` | `Ownership` | `true` → "Own", `false` → "Rented" |
| `formData.projectScope` | `ProjectType` | "repair" → "Repair", "install" → "New Unit Installed" |
| `formData.numberOfWindows` | `NumberOfWindows` | Direct pass-through |
| `ipAddress` | `IpAddress` | Required |
| `userAgent` | `UserAgent` | Required |
| `timeframe` | `PurchaseTimeframe` | Optional |
| `complianceData.tcpaConsent.text` | `TcpaText` | TCPA consent language |
| `trustedFormCertUrl` | `TrustedForm` | Optional |
| `jornayaLeadId` | `JornayaLeadId` | Optional |

### Static PING Fields (Windows)

```json
{
  "ApiToken": "PLACEHOLDER_AWAITING_TOKEN_FROM_PX",
  "Vertical": "Windows",
  "SubId": "mycontractornow",
  "Source": "mycontractornow",
  "OriginalUrl": "https://mycontractornow.com/services/windows",
  "SessionLength": 120,
  "Gender": "Unspecified",
  "BestTimeToCall": "Any time"
}
```

### Static PING Fields (Bathroom Remodeling)

```json
{
  "ApiToken": "PLACEHOLDER_AWAITING_TOKEN_FROM_PX",
  "Vertical": "bathroomremodeling",
  "SubId": "mycontractornow",
  "Source": "mycontractornow",
  "OriginalUrl": "https://mycontractornow.com/services/bathrooms",
  "SessionLength": 120,
  "Gender": "Unspecified",
  "PropertyType": "Residential",
  "AuthorizedToMakeChanges": "Yes"
}
```

> **Note:** The `ApiToken` is included here because PX requires body-based auth. Replace the placeholder with the actual token once received.
>
> **IMPORTANT:** Bathroom Remodeling uses `"Vertical": "bathroomremodeling"` (lowercase, no space), not "Bathrooms".

### POST Additional Fields

| Our Field | PX Field | Notes |
|-----------|----------|-------|
| PING `TransactionId` | `TransactionId` | From PING response |
| `formData.firstName` | `FirstName` | Required |
| `formData.lastName` | `LastName` | Required |
| `formData.phone` | `PhoneNumber` | 10-digit, digits only |
| `formData.email` | `EmailAddress` | Required |
| `formData.address.street` | `Address` | Optional for Windows, Required for Bathrooms |
| `formData.address.city` | `City` | Optional for Windows, Required for Bathrooms |

## Bathroom Remodeling Specific Fields

### PING Payload (Bathrooms)

| Our Field | PX Field | Notes |
|-----------|----------|-------|
| `zipCode` | `ZipCode` | 5-digit |
| `formData.address.state` | `State` | 2-letter code |
| `ownsHome` | `Ownership` | `true` → "Own", `false` → "Rented" |
| `formData.projectScope` | `ProjectType` | "repair" → "Repair", "install" → "Install", "replace" → "Replace" |
| `timeframe` | `RequestTimeframe` | "within_3_months" → "Within 1 week", etc. |
| `ipAddress` | `IpAddress` | Required |
| `userAgent` | `UserAgent` | Required |
| `complianceData.tcpaConsent.text` | `TcpaText` | TCPA consent language |
| `trustedFormCertUrl` | `TrustedForm` | Optional |
| `jornayaLeadId` | `JornayaLeadId` | Optional |

### Bathroom-Specific Value Maps

**ProjectType:**
- `repair` → "Repair"
- `replace` / `full_renovation` → "Replace"
- `install` / `new_bathroom` → "Install"
- `partial_remodel` → "Repair"

**RequestTimeframe:**
- `within_3_months` → "Within 1 week"
- `3_plus_months` → "1-2 weeks"
- `not_sure` → "Time is flexible"

## Response Format

### Success Response
```json
{
  "TransactionId": "GUID",
  "Success": true,
  "Payout": 45.50,
  "Message": null,
  "Errors": null,
  "Environment": "Testing"
}
```

### Failure Response
```json
{
  "TransactionId": "GUID",
  "Success": false,
  "Payout": null,
  "Message": "error code",
  "Errors": ["specific error messages"]
}
```

## Testing

**Test ZIP Code:** `90100` - Forces successful API response during staging

## Activation Checklist

- [ ] Receive API Token from PX integration team
- [ ] Update `field_mappings` in buyer_service_configs table (replace PLACEHOLDER_AWAITING_TOKEN_FROM_PX)
- [ ] Test PING with ZIP 90100 (PX's test ZIP that forces success)
- [ ] Test POST with valid lead data
- [ ] Verify TransactionId is extracted from PING and injected into POST
- [ ] Verify response parsing works correctly (Success/Payout fields)
- [ ] Set buyer `active = true`
- [ ] Set service configs `active = true` for desired services

## Database Records

```sql
-- View PX buyer
SELECT * FROM buyers WHERE id = 'px-network-001';

-- View PX service configs
SELECT bsc.*, st.name as service_name
FROM buyer_service_configs bsc
JOIN service_types st ON bsc.service_type_id = st.id
WHERE bsc.buyer_id = 'px-network-001';

-- Activate PX (run after testing)
UPDATE buyers SET active = true WHERE id = 'px-network-001';
UPDATE buyer_service_configs SET active = true WHERE buyer_id = 'px-network-001';
```

## Notes

- Brand Explicit Consent: No
- Compliance Approval: Approved
- Finance Approval: Approved
- BirthDate field: Not collected - may need to add to form or use default
- Gender field: Using "Unspecified" as default

---

*Created: 2026-01-28*
*Last Updated: 2026-01-28*
