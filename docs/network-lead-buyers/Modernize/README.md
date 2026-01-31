# Modernize Integration

> **Status:** ACTIVE - Production URLs configured and verified working.

## Overview

Modernize (QuinStreet) is a network lead buyer for Windows, Bathrooms, HVAC, and Roofing verticals using Ping/Post model.

## Integration Details

| Field | Value |
|-------|-------|
| Buyer ID | `25dc737c-8f6b-45f6-8785-e4ed7f7f1178` |
| Buyer Name | Modernize |
| Type | NETWORK |
| Tag ID | `204689410` |

## API Endpoints (Production)

| Endpoint | URL |
|----------|-----|
| Base URL | `https://form-service-hs.qnst.com` |
| PING | `https://form-service-hs.qnst.com/ping-post/pings` |
| POST | `https://form-service-hs.qnst.com/ping-post/posts` |
| API Docs | https://apidoc.modernize.com/publishers/ping-post.html#ping-post-v3-api |

### Staging Environment (DO NOT USE)

| Endpoint | URL |
|----------|-----|
| Base URL | `https://hsapiservice.quinstage.com` |
| Staging Tag ID | `204670250` |

## Authentication

- **Method:** Body-based Tag ID
- **Field:** `tagId` (included in request body via `pingStaticFields`/`postStaticFields`)

## Services Configured

| Service | Config ID | Tag ID | Active |
|---------|-----------|--------|--------|
| Windows | `00ad18fe-25c2-40d1-9b8f-2bac5441f590` | `204689410` | Yes |
| Bathrooms | `87d2ee0b-8d94-4a5f-95c1-790d2cfe2ade` | `204689410` | Yes |
| HVAC | `d18033d0-9ff9-4819-af11-03d7ad0540f2` | `204689410` | Yes |
| Roofing | `358add14-7d9f-4406-a2f3-73b0ddb72f7e` | `204689410` | Yes |

## Field Mappings

### PING Fields (all services)

| Our Field | Modernize Field | Notes |
|-----------|-----------------|-------|
| `zipCode` | `postalCode` | 5-digit |
| `timeframe` | `buyTimeframe` | Mapped: "within_3_months" → "Immediately", "3_plus_months" → "1-6 months", "not_sure" → "Don't know" |
| `ownsHome` | `ownHome` | boolean → "Yes"/"No" |
| Static | `tagId` | `204689410` |
| Static | `service` | "WINDOWS", "BATH_REMODEL", "HVAC", "ROOFING" |
| Static | `partnerSourceId` | "fb" |

### POST Additional Fields

| Our Field | Modernize Field | Notes |
|-----------|-----------------|-------|
| PING `pingToken` | `pingToken` | From PING response, valid 30 minutes |
| `formData.firstName` | `firstName` | Required |
| `formData.lastName` | `lastName` | Required |
| `formData.email` | `email` | Required |
| `formData.phone` | `phone` | 10-digit, digits only |
| `formData.address.street` | `address` | Required |
| `formData.address.city` | `city` | Required |
| `formData.address.state` | `state` | 2-letter code |
| `trustedFormCertUrl` | `trustedFormToken` | Required |
| `jornayaLeadId` | `leadIDToken` | Optional |
| `lead.id` | `publisherSubId` | Our lead ID for tracking |
| `complianceData.tcpaConsent.text` | `homePhoneConsentLanguage` | TCPA consent text |

### Service-Specific Fields

**Windows:**
- `NumberOfWindows`: "1-2", "3-5", "6-9", "9+"
- `WindowsProjectScope`: "Install", "Repair"

**Bathrooms:**
- Service code: `BATH_REMODEL`

**HVAC:**
- Service code: `HVAC`

**Roofing:**
- Service code: `ROOFING`

## Response Format

### PING Success
```json
{
  "status": "success",
  "pingToken": "wPDqmX209V3BEliVAZ0oO2rkJdv6EjAY",
  "price": "17.33"
}
```

### PING Rejected
```json
{
  "status": "rejected",
  "message": "No Matches"
}
```

### POST Success
```json
{
  "status": "success",
  "leadId": "79786014233"
}
```

### POST Rejected
```json
{
  "status": "rejected",
  "message": "No Matches"
}
```

## Testing

### Verified PING (Windows)
```bash
curl -X POST 'https://form-service-hs.qnst.com/ping-post/pings' \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  -d '{
  "tagId": "204689410",
  "service": "WINDOWS",
  "postalCode": "46545",
  "buyTimeframe": "Don'\''t know",
  "ownHome": "Yes",
  "partnerSourceId": "fb",
  "NumberOfWindows": "3-5",
  "WindowsProjectScope": "Install"
}'
```

### Verified POST (Windows)
```bash
curl -X POST 'https://form-service-hs.qnst.com/ping-post/posts' \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  -d '{
  "pingToken": "TOKEN_FROM_PING",
  "tagId": "204689410",
  "service": "WINDOWS",
  "postalCode": "46545",
  "buyTimeframe": "Don'\''t know",
  "ownHome": "Yes",
  "partnerSourceId": "fb",
  "NumberOfWindows": "3-5",
  "WindowsProjectScope": "Install",
  "firstName": "Test",
  "lastName": "Lead",
  "email": "test@example.com",
  "phone": "5551234567",
  "address": "123 Test St",
  "city": "Mishawaka",
  "state": "IN",
  "trustedFormToken": "https://cert.trustedform.com/...",
  "leadIDToken": "JORNAYA_LEAD_ID",
  "publisherSubId": "OUR_LEAD_ID",
  "homePhoneConsentLanguage": "TCPA consent text..."
}'
```

## Production Verification (2026-01-29)

Successfully tested with real lead:
- **Lead:** Douglas Marion (Indiana, ZIP 46545)
- **PING:** Success, price $17.33
- **POST:** Success, leadId `79786014233`

## Database Records

```sql
-- View Modernize buyer
SELECT * FROM buyers WHERE id = '25dc737c-8f6b-45f6-8785-e4ed7f7f1178';

-- View Modernize service configs
SELECT bsc.*, st.name as service_name
FROM buyer_service_configs bsc
JOIN service_types st ON bsc.service_type_id = st.id
WHERE bsc.buyer_id = '25dc737c-8f6b-45f6-8785-e4ed7f7f1178';

-- Verify production URLs
SELECT
  st.name as service,
  bsc.ping_template::json->>'url' as ping_url,
  bsc.post_template::json->>'url' as post_url,
  field_mappings::json->'pingStaticFields'->>'tagId' as tag_id
FROM buyer_service_configs bsc
JOIN service_types st ON bsc.service_type_id = st.id
WHERE bsc.buyer_id = '25dc737c-8f6b-45f6-8785-e4ed7f7f1178';
```

## Notes

- pingToken is valid for **30 minutes** after PING
- trustedFormToken is **required** for all leads
- "No Matches" on PING means no buyers in that ZIP code
- "No Matches" on POST means the matched buyer is no longer available

---

*Created: 2026-01-29*
*Last Updated: 2026-01-29 - Configured production URLs and Tag ID, verified working*
