# Add Network Lead Buyer

Add a new network lead buyer to the PING/POST auction system.

## Overview

This command guides you through adding a new network lead buyer that participates in the real-time auction system. The system is **fully database-driven** - no code changes are required for standard integrations.

## Prerequisites

Before starting, gather from the buyer:
1. **API Documentation URL** - Their PING/POST spec
2. **Authentication Method** - API key, bearer token, or custom headers
3. **API Credentials** - The actual key/token (store securely)
4. **Services Supported** - windows, bathrooms, roofing, hvac
5. **Geographic Coverage** - ZIP codes or nationwide
6. **Business Details** - Contact info, Netsuite ID, legal name

---

## STEP 1: Fetch and Analyze Buyer's API Spec

Use WebFetch to get their API documentation:

```
WebFetch the buyer's API spec URL and extract:
1. PING endpoint URL and required fields
2. POST endpoint URL and required fields
3. Authentication method (header vs body)
4. Response format (how to extract bid amount and pingToken)
5. Field names and expected values
6. Any special requirements (wrappers, content-type)
```

---

## STEP 2: Create Buyer Record

Insert into the `buyers` table:

```sql
INSERT INTO buyers (
  id,
  name,
  display_name,
  type,
  api_url,
  auth_config,
  ping_timeout,
  post_timeout,
  active,
  compliance_field_mappings,
  response_mapping_config,
  notes,
  created_at,
  updated_at
) VALUES (
  '[buyer-slug]-001',           -- Unique ID (e.g., 'px-network-001')
  '[Buyer Name]',               -- Display name (e.g., 'PX')
  '[Buyer Display Name]',       -- Full name (e.g., 'PX (PixelMEDIA)')
  'NETWORK',                    -- MUST be 'NETWORK' for PING/POST
  '[base API URL]',             -- e.g., 'https://api.buyer.com'
  '[auth_config JSON]',         -- See Auth Config section below
  30,                           -- PING timeout in seconds
  60,                           -- POST timeout in seconds
  false,                        -- Start INACTIVE until tested
  '[compliance_mappings JSON]', -- See Compliance section below
  '[response_config JSON]',     -- See Response Parsing section below
  '[notes text]',               -- See Notes section below
  NOW(),
  NOW()
);
```

### Auth Config JSON

**For Header-based API Key:**
```json
{
  "type": "apiKey",
  "credentials": {
    "apiKey": "YOUR_API_KEY_HERE"
  }
}
```

**For Bearer Token:**
```json
{
  "type": "bearer",
  "credentials": {
    "token": "YOUR_TOKEN_HERE"
  }
}
```

**For Body-based Token (like PX):**
Body tokens go in `pingStaticFields`/`postStaticFields` instead:
```json
{
  "type": "none"
}
```
Then add the token to the field mappings' static fields.

**For Custom Headers:**
```json
{
  "type": "none",
  "headers": {
    "X-Custom-Header": "value"
  }
}
```

### Compliance Field Mappings JSON

Maps our compliance data to buyer's expected field names:
```json
{
  "trustedForm": {
    "certUrl": ["buyer_tf_field"],
    "certId": ["buyer_tf_id_field"]
  },
  "jornaya": {
    "leadId": ["buyer_jornaya_field"]
  },
  "tcpa": {
    "consent": ["buyer_consent_field"]
  }
}
```

### Response Mapping Config JSON

For non-standard response formats:
```json
{
  "statusField": "Success",
  "bidAmountFields": ["Payout", "price", "bid"],
  "pingMappings": {
    "true": "accepted",
    "false": "rejected"
  },
  "postMappings": {
    "true": "accepted",
    "false": "rejected"
  }
}
```

### Notes Field Template

```
== [BUYER NAME] Integration ==

Vertical: [windows, bathrooms, etc.]
Post Type: Ping Post
Sales Model: Exclusive/Shared
Landing Page URL: mycontractornow.com
Compliance Approval: [Approved/Pending]
Finance Approval: [Approved/Pending]
Netsuite ID: [ID]
Legal name: [Company Name]

API Specs: [URL to their docs]
Offer Guidelines: [URL if any]

Ping URL: [full PING endpoint]
Post URL: [full POST endpoint]

Test ZIP Code: [if they have a test ZIP]

Account Manager: [name]
Sales Manager: [name]
Contact Email: [email]

AUTHENTICATION:
- Type: [header/body]
- Field: [ApiToken/X-API-Key/etc.]

SPECIAL REQUIREMENTS:
- [List any non-standard requirements]
- [Field name quirks]
- [Response parsing notes]

STATUS: [ACTIVE/INACTIVE - Awaiting API Token/Testing/etc.]
```

---

## STEP 3: Create BuyerServiceConfig for Each Service

Insert into `buyer_service_configs`:

```sql
INSERT INTO buyer_service_configs (
  id,
  buyer_id,
  service_type_id,
  ping_template,
  post_template,
  field_mappings,
  requires_trustedform,
  requires_jornaya,
  min_bid,
  max_bid,
  active,
  nationwide,
  created_at
) VALUES (
  '[buyer]-[service]-001',
  '[buyer-id from step 2]',
  '[service_type_id]',            -- Query service_types table
  '{"url": "[PING URL]"}',
  '{"url": "[POST URL]"}',
  '[field_mappings JSON]',        -- See Field Mappings section
  [true/false],                   -- TrustedForm required?
  [true/false],                   -- Jornaya required?
  0.01,                           -- Minimum bid
  999.99,                         -- Maximum bid
  false,                          -- Start INACTIVE
  true,                           -- Nationwide? (or add ZIP codes)
  NOW()
);
```

### Service Type IDs (query to confirm)
```sql
SELECT id, name FROM service_types;
-- windows:   ce6407cd-c8e7-4d64-b01e-13e157c33854
-- bathrooms: 3bb54537-6818-404e-8daa-afebb45f500e
-- roofing:   72fc4740-2f20-493b-bf58-3fde11bff9cc
-- hvac:      9c5011c0-0da5-4800-a960-1639b965bd7e
```

---

## STEP 4: Build Field Mappings JSON

The `field_mappings` column is the most critical configuration:

```json
{
  "version": "1.0",
  "meta": {
    "notes": "[Buyer] [Service] configuration",
    "createdAt": "[date]",
    "updatedAt": "[date]"
  },
  "mappings": [
    // PING + POST fields (core qualification data)
    {
      "id": "map-1",
      "order": 1,
      "sourceField": "zipCode",
      "targetField": "[buyer's ZIP field]",
      "required": true,
      "includeInPing": true,
      "includeInPost": true
    },
    {
      "id": "map-2",
      "order": 2,
      "sourceField": "formData.address.state",
      "targetField": "[buyer's state field]",
      "required": true,
      "includeInPing": true,
      "includeInPost": true
    },
    {
      "id": "map-3",
      "order": 3,
      "sourceField": "ownsHome",
      "targetField": "[buyer's homeowner field]",
      "valueMap": {
        "true": "[their 'yes' value]",
        "false": "[their 'no' value]"
      },
      "required": true,
      "includeInPing": true,
      "includeInPost": true
    },
    {
      "id": "map-4",
      "order": 4,
      "sourceField": "timeframe",
      "targetField": "[buyer's timeline field]",
      "valueMap": {
        "within_3_months": "[their value]",
        "3_plus_months": "[their value]",
        "not_sure": "[their value]"
      },
      "required": true,
      "includeInPing": true,
      "includeInPost": true
    },
    // Service-specific fields
    {
      "id": "map-5",
      "order": 5,
      "sourceField": "formData.projectScope",
      "targetField": "[buyer's project type field]",
      "valueMap": {
        "repair": "[their value]",
        "install": "[their value]",
        "replace": "[their value]"
      },
      "required": true,
      "includeInPing": true,
      "includeInPost": true
    },
    // Compliance fields (usually PING + POST)
    {
      "id": "map-10",
      "order": 10,
      "sourceField": "ipAddress",
      "targetField": "[buyer's IP field]",
      "required": true,
      "includeInPing": true,
      "includeInPost": true
    },
    {
      "id": "map-11",
      "order": 11,
      "sourceField": "userAgent",
      "targetField": "[buyer's UA field]",
      "required": true,
      "includeInPing": true,
      "includeInPost": true
    },
    {
      "id": "map-12",
      "order": 12,
      "sourceField": "trustedFormCertUrl",
      "targetField": "[buyer's TF field]",
      "required": false,
      "includeInPing": true,
      "includeInPost": true
    },
    {
      "id": "map-13",
      "order": 13,
      "sourceField": "jornayaLeadId",
      "targetField": "[buyer's Jornaya field]",
      "required": false,
      "includeInPing": true,
      "includeInPost": true
    },
    // POST-only fields (PII)
    {
      "id": "map-20",
      "order": 20,
      "sourceField": "formData.firstName",
      "targetField": "[buyer's first name field]",
      "required": true,
      "includeInPing": false,
      "includeInPost": true
    },
    {
      "id": "map-21",
      "order": 21,
      "sourceField": "formData.lastName",
      "targetField": "[buyer's last name field]",
      "required": true,
      "includeInPing": false,
      "includeInPost": true
    },
    {
      "id": "map-22",
      "order": 22,
      "sourceField": "formData.phone",
      "targetField": "[buyer's phone field]",
      "transform": "phone.digitsOnly",
      "required": true,
      "includeInPing": false,
      "includeInPost": true
    },
    {
      "id": "map-23",
      "order": 23,
      "sourceField": "formData.email",
      "targetField": "[buyer's email field]",
      "required": true,
      "includeInPing": false,
      "includeInPost": true
    }
  ],
  "pingStaticFields": {
    "[static field 1]": "[value]",
    "[static field 2]": "[value]",
    // For body-based auth tokens:
    "ApiToken": "[TOKEN_PLACEHOLDER - replace when received]"
  },
  "postStaticFields": {
    "[static field 1]": "[value]",
    "[static field 2]": "[value]",
    "ApiToken": "[TOKEN_PLACEHOLDER - replace when received]"
  },
  "pingTokenConfig": {
    "responseFields": ["[field1]", "[field2]"],
    "postFieldName": "[field to inject in POST]"
  },
  "requestWrapper": null,
  "contentType": "json"
}
```

### Available Source Fields

From Lead record:
- `zipCode` - 5-digit ZIP
- `ownsHome` - boolean
- `timeframe` - "within_3_months", "3_plus_months", "not_sure"
- `ipAddress` - Client IP
- `userAgent` - Browser user agent
- `trustedFormCertUrl` - TrustedForm certificate URL
- `trustedFormCertId` - TrustedForm certificate ID
- `jornayaLeadId` - Jornaya LeadID token

From formData (use `formData.` prefix):
- `formData.firstName`
- `formData.lastName`
- `formData.email`
- `formData.phone`
- `formData.address.street`
- `formData.address.city`
- `formData.address.state`
- `formData.projectScope` - Service-specific
- `formData.numberOfWindows` - Windows-specific
- `formData.roofType` - Roofing-specific

From complianceData:
- `complianceData.tcpaConsent.text` - TCPA consent language

### Available Transforms

- `phone.digitsOnly` - "(555) 123-4567" -> "5551234567"
- `phone.e164` - "(555) 123-4567" -> "+15551234567"
- `boolean.yesNo` - true -> "Yes", false -> "No"
- `boolean.trueFalse` - true -> "true", false -> "false"
- `boolean.oneZero` - true -> 1, false -> 0
- `string.uppercase` - "hello" -> "HELLO"
- `string.lowercase` - "HELLO" -> "hello"
- `date.iso` - Date -> "2026-01-28T15:30:00Z"

---

## STEP 5: Add ZIP Codes (if not nationwide)

For specific ZIP coverage:
```sql
INSERT INTO buyer_service_zip_codes (id, buyer_id, service_type_id, zip_code, active, priority)
VALUES
  (gen_random_uuid(), '[buyer-id]', '[service-id]', '90210', true, 100),
  (gen_random_uuid(), '[buyer-id]', '[service-id]', '10001', true, 100);
```

Or for bulk from CSV, use the admin UI.

---

## STEP 6: Create Documentation

Create docs in `docs/network-lead-buyers/[BuyerName]/README.md`:

```markdown
# [Buyer Name] Integration

> **Status:** [ACTIVE/INACTIVE] - [reason if inactive]

## Overview
[Brief description of buyer and services]

## Integration Details
| Field | Value |
|-------|-------|
| Buyer ID | `[id]` |
| Legal Name | [name] |
| Netsuite ID | [id] |
| Sales Model | [Exclusive/Shared] |
| Account Manager | [name] |

## API Endpoints
| Endpoint | URL |
|----------|-----|
| Ping | `[url]` |
| Post | `[url]` |
| API Docs | [url] |

## Authentication
- **Method:** [Header/Body]
- **Field:** [field name]

## Services Configured
- [service 1] - Config ID: `[id]`
- [service 2] - Config ID: `[id]`

## Field Mappings
[Document key field mappings]

## Response Format
[Document expected responses]

## Activation Checklist
- [ ] API credentials received
- [ ] Test PING successful
- [ ] Test POST successful
- [ ] Response parsing verified
- [ ] Set buyer active=true
- [ ] Set service configs active=true

## Notes
[Any special requirements or gotchas]
```

Update `docs/network-lead-buyers/README.md` to add the new buyer to the list.

---

## STEP 7: Test and Activate

1. **Test PING** with their test ZIP code (if provided)
2. **Verify response parsing** - check bid amount extraction
3. **Test POST** with a full lead
4. **Verify pingToken** is correctly injected
5. **Check compliance fields** are present

Once verified:
```sql
-- Activate buyer
UPDATE buyers SET active = true WHERE id = '[buyer-id]';

-- Activate service configs
UPDATE buyer_service_configs SET active = true WHERE buyer_id = '[buyer-id]';
```

---

## Quick Reference: Database Connection

```bash
# Query database
PGPASSWORD="CgDWlr8Bk9O6DVoX" psql "postgresql://postgres.cnogfaqqilmutqhpjhgl@aws-0-us-east-2.pooler.supabase.com:6543/postgres"

# Push schema changes
DATABASE_URL="postgresql://postgres.cnogfaqqilmutqhpjhgl:CgDWlr8Bk9O6DVoX@aws-0-us-east-2.pooler.supabase.com:5432/postgres" npx prisma db push
```

---

## Example: Adding PX for Windows

```sql
-- 1. Create buyer
INSERT INTO buyers (id, name, display_name, type, api_url, active, notes, ...)
VALUES ('px-network-001', 'PX', 'PX (PixelMEDIA)', 'NETWORK',
        'https://leadapi.px.com/api/lead', false,
        'Vertical: Windows, Bathrooms...');

-- 2. Create service config with field_mappings including ApiToken in static fields
INSERT INTO buyer_service_configs (...)
VALUES (..., '{"pingStaticFields": {"ApiToken": "PLACEHOLDER", "Vertical": "Windows"}, ...}');

-- 3. Document in docs/network-lead-buyers/PX/README.md

-- 4. Test with ZIP 90100 (PX test ZIP)

-- 5. Activate when token received and tests pass
```

---

## Troubleshooting

**PING returns no bid:**
- Check buyer is active
- Check service config is active
- Check ZIP coverage or nationwide flag
- Verify auth credentials are correct

**POST rejected:**
- Check pingToken is being extracted correctly
- Verify all required fields are present
- Check compliance data is included

**Field values incorrect:**
- Check valueMap translations
- Verify sourceField paths are correct
- Check transform functions

**Response parsing fails:**
- Update response_mapping_config for non-standard responses
- Check statusField and bidAmountFields
