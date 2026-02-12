# PCM Growth - Windows Integration (zip-only)

## Overview

| Field | Value |
|-------|-------|
| **Buyer Name** | PCM Growth |
| **Buyer ID** | `818ead32-c0f1-4f9d-b639-e2d8b4e2dc6e` |
| **Type** | NETWORK |
| **Platform** | boberdoo (same as Home Appointments) |
| **API Base URL** | `https://pcmgrowth.leadportal.com/new_api/api.php` |
| **Service Type** | `windows-zip-only` (lower friction, no full address required) |
| **Status** | INACTIVE (activate when ready) |

## Endpoints

| Action | URL |
|--------|-----|
| **PING** | `https://pcmgrowth.leadportal.com/new_api/api.php` (Mode=ping) |
| **POST** | `https://pcmgrowth.leadportal.com/new_api/api.php` (Mode=post) |

---

## Authentication (Static Fields)

### PING Static Fields

```json
{
  "Key": "8501f8bad01b7e8eb6636c352b9103f0817c088f2dd59c3b8822efdadf69ff47",
  "SRC": "ZokaDesign",
  "Mode": "ping",
  "TYPE": "37",
  "Format": "JSON",
  "API_Action": "pingPostLead"
}
```

> **Note:** `Return_Best_Price` is NOT sent — disabled on PCM Growth's account (confirmed via test PING 2026-02-12).

### POST Static Fields

```json
{
  "Key": "8501f8bad01b7e8eb6636c352b9103f0817c088f2dd59c3b8822efdadf69ff47",
  "SRC": "ZokaDesign",
  "Mode": "post",
  "TYPE": "37",
  "Format": "JSON",
  "API_Action": "pingPostLead"
}
```

---

## Field Mappings

### PING Fields

| Our Field | -> | PCM Field | Transform | Required |
|-----------|---|-----------|-----------|----------|
| `zipCode` | -> | `Zip` | direct | Yes |
| `zipCode` | -> | `State` | `zip.toState` | No |
| `complianceData.ipAddress` | -> | `IP_Address` | direct | No |
| `trustedFormCertUrl` | -> | `Trusted_Form_URL` | direct | No |
| `ownsHome` | -> | `Homeowner` | `boolean.yesNo` | No |
| `formData.numberOfWindows` | -> | `Number_Of_Windows` | valueMap | No |
| `formData.projectScope` | -> | `Project_Type` | valueMap | No |
| `complianceData.attribution.landing_page` | -> | `Landing_Page` | `url.fullUrl` | No |
| `complianceData.tcpaConsent.text` | -> | `TCPA_Language` | direct | No |
| `complianceData.attribution.affiliate_id` | -> | `Sub_ID` | direct | No |
| `complianceData.attribution.ref` | -> | `Pub_ID` | direct | No |

### POST Fields (Additional)

| Our Field | -> | PCM Field | Transform | Required |
|-----------|---|-----------|-----------|----------|
| `firstName` | -> | `First_Name` | direct | Yes |
| `lastName` | -> | `Last_Name` | direct | Yes |
| `phone` | -> | `Primary_Phone` | `phone.us10` | Yes |
| `email` | -> | `Email` | direct | Yes |
| `complianceData.userAgent` | -> | `User_Agent` | direct | No |

> **Note:** Address and City are NOT sent. State is derived from zip code via `zip.toState` transform.

> **Note:** `Lead_ID` is automatically injected from the PING response via `pingTokenConfig`.

---

## Value Mappings

### numberOfWindows -> Number_Of_Windows

| Our Value | -> | PCM Value |
|-----------|---|-----------|
| `1` | -> | `1` |
| `2` | -> | `2` |
| `3-5` | -> | `3-5` |
| `6+` | -> | `6+` |
| `6-9` | -> | `6+` |
| `9+` | -> | `6+` |

### projectScope -> Project_Type

| Our Value | -> | PCM Value |
|-----------|---|-----------|
| `install` | -> | `Replace` |
| `repair` | -> | `Repair` |
| `replacement` | -> | `Replace` |
| `not_sure` | -> | `Not Sure` |

> **Note:** `projectScope` is auto-injected as `"install"` for `windows-zip-only` in `src/app/api/leads/route.ts:183`.

---

## Compliance Requirements

| Compliance | Required | Stage |
|------------|----------|-------|
| **TrustedForm** | Yes | PING |
| **Jornaya** | No | - |

---

## Response Handling

### PING Response (boberdoo standard)

```json
{
  "response": {
    "status": "Matched",
    "lead_id": "123456",
    "price": "15.00"
  }
}
```

| Status | Meaning |
|--------|---------|
| `Matched` | Lead accepted, bid received |
| `Unmatched` | Lead valid but no partner match |
| `Error` | Submission failed |

### POST Response

```json
{
  "response": {
    "status": "Success",
    "lead_id": "123456"
  }
}
```

| Status | Meaning |
|--------|---------|
| `Success` | Lead delivered |
| `Error` | Delivery failed |

---

## PING/POST Flow (pingTokenConfig)

```
PING → PCM responds with { response: { lead_id: "123456", price: "15.00" } }
     → We extract lead_id from response.lead_id
     → Store in bid.metadata.pingToken

POST → We inject Lead_ID = "123456" into the POST payload
     → PCM processes the full lead
```

```json
{
  "pingTokenConfig": {
    "responseFields": ["response.lead_id", "lead_id"],
    "postFieldName": "Lead_ID",
    "buyerLeadIdResponseFields": ["response.lead_id", "lead_id"],
    "buyerLeadIdPostField": "Lead_ID"
  }
}
```

---

## Database IDs

```
Buyer ID:         818ead32-c0f1-4f9d-b639-e2d8b4e2dc6e
Service Config:   de42be4c-4113-4258-9e57-3ed0a893f0b5
Service Type:     a38dad27-f8bd-4918-8442-58f86af861fa (windows-zip-only)
```

---

## Activation

To activate this buyer when ready:

```sql
UPDATE buyers SET active = true WHERE id = '818ead32-c0f1-4f9d-b639-e2d8b4e2dc6e';
```

---

## Key Differences from Home Appointments (same platform)

| Feature | PCM Growth | Home Appointments |
|---------|-----------|-------------------|
| TYPE | 37 | 38 |
| SRC | ZokaDesign | Zoka |
| Service Type | windows-zip-only | windows |
| Address Required | No (derived from zip) | Optional |
| Trade field | Not sent | Windows (static) |

---

*Last Updated: 2026-02-12*
