# Affiliate Tracking Flow

This document explains how affiliate tracking works end-to-end in the My Contractor Now platform.

## Overview

When a lead comes from an affiliate-generated link, the system:
1. Captures the affiliate identifier from URL parameters or cookies
2. Stores it with the lead in the database
3. Records a conversion for the affiliate
4. Passes the affiliate data to buyers (e.g., Modernize)

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ 1. AFFILIATE LINK VISIT                                                        │
│                                                                                 │
│    User clicks affiliate link:                                                 │
│    • https://mycontractornow.com/windows?ref=partner123                        │
│    • https://mycontractornow.com/windows?affiliate_id=aff456                   │
│    • https://mycontractornow.com/windows?aff=xyz789                            │
│                                                                                 │
│    OR via redirect route:                                                      │
│    • https://mycontractornow.com/r/partner123 → sets aff_ref cookie            │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ 2. ATTRIBUTION CAPTURE (DynamicForm.tsx)                                       │
│                                                                                 │
│    On form mount, getAttributionData() captures:                               │
│    • URL params: ref, affiliate_id, aff                                        │
│    • Cookies: aff_ref (set by /r/[code] redirect)                              │
│    • UTM params: utm_source, utm_medium, utm_campaign, etc.                    │
│    • Click IDs: gclid, fbclid, msclkid, etc.                                   │
│                                                                                 │
│    Stored in React state: const [attribution] = useState(() => ...)            │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ 3. FORM SUBMISSION (windows/page.tsx, roofing/page.tsx, etc.)                  │
│                                                                                 │
│    Attribution data sent to API:                                               │
│    fetch('/api/leads', {                                                       │
│      body: JSON.stringify({                                                    │
│        serviceTypeId: 'windows',                                               │
│        formData: answers,                                                      │
│        complianceData: {                                                       │
│          attribution: answers.attribution,  // ← Affiliate data here          │
│          trustedFormCertUrl: ...,                                              │
│          jornayaLeadId: ...,                                                   │
│        }                                                                       │
│      })                                                                        │
│    })                                                                          │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ 4. API STORAGE (/api/leads/route.ts)                                           │
│                                                                                 │
│    Lead created with attribution:                                              │
│    lead.complianceData = {                                                     │
│      attribution: {                                                            │
│        ref: "partner123",           // Affiliate ref code                      │
│        affiliate_id: "aff456",      // Affiliate ID                            │
│        utm_source: "google",                                                   │
│        utm_medium: "cpc",                                                      │
│        ...                                                                     │
│      }                                                                         │
│    }                                                                           │
│                                                                                 │
│    Affiliate conversion recorded:                                              │
│    const affiliateCode = attribution.affiliate_id || attribution.aff ||        │
│                          attribution.ref;                                      │
│    if (affiliateCode) {                                                        │
│      recordConversion(affiliateCode);  // Increments link conversion count     │
│    }                                                                           │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ 5. AUCTION ENGINE → BUYER DELIVERY (auction/engine.ts → templates/engine.ts)   │
│                                                                                 │
│    Template Engine maps affiliate fields to buyer-specific names:              │
│                                                                                 │
│    For Modernize (configurations.ts):                                          │
│    complianceFieldMappings: {                                                  │
│      affiliate: {                                                              │
│        ref: ['partnerSourceId'],        // ref → partnerSourceId               │
│        affiliateId: ['publisherSubId']  // affiliate_id → publisherSubId       │
│      }                                                                         │
│    }                                                                           │
│                                                                                 │
│    Final payload to Modernize:                                                 │
│    {                                                                           │
│      "partnerSourceId": "partner123",                                          │
│      "publisherSubId": "aff456",                                               │
│      "trustedFormToken": "https://cert.trustedform.com/...",                   │
│      "leadIDToken": "EAF0AAF2-55CD-...",                                       │
│      ...                                                                       │
│    }                                                                           │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Key Files

| File | Purpose |
|------|---------|
| `src/utils/attribution.ts` | Captures URL params, cookies, and builds AttributionData |
| `src/components/DynamicForm.tsx` | Calls getAttributionData() on mount, includes in submission |
| `src/app/windows/page.tsx` | Sends attribution in complianceData to API |
| `src/app/api/leads/route.ts` | Stores attribution, calls recordConversion() |
| `src/lib/services/affiliate-link-service.ts` | recordConversion() increments affiliate stats |
| `src/lib/templates/engine.ts` | addComplianceFields() maps to buyer field names |
| `src/lib/buyers/configurations.ts` | Defines buyer-specific field mappings |

## Supported Affiliate Parameters

The system captures these affiliate identifiers (in priority order):

| Parameter | Example URL | Notes |
|-----------|-------------|-------|
| `ref` | `?ref=partner123` | Primary affiliate code, maps to Modernize `partnerSourceId` |
| `affiliate_id` | `?affiliate_id=aff456` | Transaction-level ID, maps to Modernize `publisherSubId` |
| `aff` | `?aff=xyz` | Short alias for affiliate_id |

## Cookie-Based Tracking

The `/r/[code]` redirect route sets an `aff_ref` cookie:

```
User visits: https://mycontractornow.com/r/partner123
→ Cookie set: aff_ref=partner123 (expires in 30 days)
→ Redirected to: https://mycontractornow.com/
```

This allows affiliate tracking even if the user doesn't complete the form immediately.

## Affiliate Commission Flow

```
Lead Created → recordConversion(affiliateCode) → AffiliateLink.conversions++
                                               ↓
Lead Sold → createCommission(affiliateId, leadId, saleAmount)
                                               ↓
Commission Approved → affiliate.pendingBalance increases
                                               ↓
Withdrawal Requested → processed via PayPal/bank transfer
```

## Buyer Field Mappings

### Modernize

| Source Field | Buyer Field | Description |
|-------------|-------------|-------------|
| `complianceData.attribution.ref` | `partnerSourceId` | Campaign/partner identifier |
| `complianceData.attribution.affiliate_id` | `publisherSubId` | Transaction-level tracking |

### Default (Other Buyers)

| Source Field | Buyer Field |
|-------------|-------------|
| `complianceData.attribution.ref` | `partner_source_id`, `affiliate_ref` |
| `complianceData.attribution.affiliate_id` | `publisher_sub_id`, `affiliate_id` |

## Testing Affiliate Tracking

1. **Visit with affiliate parameter:**
   ```
   https://mycontractornow.com/windows?ref=test123
   ```

2. **Check console for attribution capture:**
   ```javascript
   // In DynamicForm, attribution is logged at submission
   console.log('Attribution data:', attribution);
   ```

3. **Verify in database:**
   ```sql
   SELECT compliance_data->'attribution' FROM leads
   WHERE id = 'your-lead-id';
   ```

4. **Check affiliate link stats:**
   ```sql
   SELECT code, clicks, conversions FROM affiliate_links
   WHERE code = 'test123';
   ```

## Troubleshooting

### Affiliate data not captured
- Check if URL params are present when form loads
- Verify `getAttributionData()` is called on mount (not after navigation)
- Check if cookies are being blocked

### Affiliate data not sent to buyer
- Verify `includeCompliance: true` in buyer's template config
- Check `complianceFieldMappings.affiliate` is defined for the buyer
- Look at transaction logs for the payload sent

### Commission not recorded
- Verify `recordConversion()` is being called in API route
- Check if affiliate link exists with matching code
- Verify affiliate account is active
