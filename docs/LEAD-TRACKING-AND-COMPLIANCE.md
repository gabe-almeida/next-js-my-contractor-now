# Lead Tracking & Compliance System

> How TrustedForm, Jornaya, and Attribution tracking work on MyContractorNow.com

---

## Table of Contents

1. [Quick Summary](#quick-summary)
2. [User Stories](#user-stories)
3. [System Architecture](#system-architecture)
4. [URL Parameters Reference](#url-parameters-reference)
5. [Direct Linking to Services](#direct-linking-to-services)
6. [Technical Flow](#technical-flow)
7. [Key Files Reference](#key-files-reference)
8. [FAQ](#faq)

---

## Quick Summary

**Three tracking systems work together on every lead:**

| System | Purpose | When It Loads |
|--------|---------|---------------|
| **TrustedForm** | TCPA compliance - proves user saw consent language | Every page (global) |
| **Jornaya LeadiD** | Lead verification - detects duplicate/fraudulent leads | Every page (global) |
| **Attribution** | Marketing analytics - tracks where leads come from | On form mount |

**Key Insight:** All three systems work identically whether users:
- Start on homepage → select service → fill form
- Land directly on a service page (e.g., `/services/windows`)

This means **you can direct ad traffic straight to service pages** without losing any tracking.

---

## User Stories

### Story 1: Homepage Journey (Organic Search)

**Scenario:** Sarah searches "window replacement near me" and clicks an organic Google result to the homepage.

```
1. Sarah lands on: https://mycontractornow.com/

   → TrustedForm SDK loads (creates certificate)
   → Jornaya SDK loads (generates LeadID)
   → No form yet, so attribution not captured yet

2. Sarah sees service dropdown, selects "Windows"

   → Redirected to: https://mycontractornow.com/services/windows
   → TrustedForm certificate CONTINUES (same session)
   → Jornaya LeadID CONTINUES (same session)
   → DynamicForm mounts → Attribution captured:
     {
       landing_page: "https://mycontractornow.com/",
       referrer: "https://www.google.com/",
       referrer_domain: "google.com",
       utm_source: null,
       affiliate_id: null
     }

3. Sarah fills out the form and submits

   → Lead created with:
     - TrustedForm cert URL
     - Jornaya LeadID
     - Attribution showing organic Google traffic
```

**Result:** Lead tracked as organic Google search, full compliance data attached.

---

### Story 2: Facebook Ad → Direct Service Link

**Scenario:** Mike clicks a Facebook ad for window replacement that links directly to the Windows form.

```
Ad URL: https://mycontractornow.com/services/windows?utm_source=facebook&utm_medium=paid&utm_campaign=windows_spring_2024&utm_content=video_ad_v2&fbclid=abc123xyz

1. Mike lands directly on the Windows form page

   → TrustedForm SDK loads (creates certificate)
   → Jornaya SDK loads (generates LeadID)
   → DynamicForm mounts → Attribution captured:
     {
       landing_page: "https://mycontractornow.com/services/windows?utm_source=facebook...",
       referrer: "https://www.facebook.com/",
       referrer_domain: "facebook.com",
       utm_source: "facebook",
       utm_medium: "paid",
       utm_campaign: "windows_spring_2024",
       utm_content: "video_ad_v2",
       fbclid: "abc123xyz"
     }

2. Mike fills out the form and submits

   → Lead created with:
     - TrustedForm cert URL
     - Jornaya LeadID
     - Full Facebook attribution
```

**Result:** Lead tracked as Facebook paid traffic with campaign details. **Identical tracking to homepage flow.**

---

### Story 3: Google Ads with Affiliate Partner

**Scenario:** An affiliate partner runs Google Ads for roofing leads using their affiliate ID.

```
Ad URL: https://mycontractornow.com/services/roofing?utm_source=google_ads&utm_medium=cpc&utm_campaign=roofing_affiliate&gclid=xyz789&affiliate_id=PARTNER_ABC

1. User lands on Roofing form

   → All tracking initializes
   → Attribution captured:
     {
       utm_source: "google_ads",
       utm_medium: "cpc",
       utm_campaign: "roofing_affiliate",
       gclid: "xyz789",
       affiliate_id: "PARTNER_ABC"
     }

2. User submits form

   → Lead created with affiliate attribution
   → Affiliate commission can be calculated
```

**Result:** Lead attributed to affiliate partner with Google Ads click data.

---

### Story 4: TikTok Ad → Bathroom Remodel

**Scenario:** Young homeowner sees TikTok ad and clicks through to bathroom form.

```
Ad URL: https://mycontractornow.com/services/bathrooms?utm_source=tiktok&utm_medium=paid&utm_campaign=bathroom_remodel_gen_z&ttclid=tiktok123

1. User lands on Bathrooms form

   → Attribution captured:
     {
       utm_source: "tiktok",
       utm_medium: "paid",
       utm_campaign: "bathroom_remodel_gen_z",
       ttclid: "tiktok123"
     }

2. User submits

   → Lead tracked with TikTok attribution
```

**Result:** Lead attributed to TikTok campaign with click ID for conversion tracking.

---

### Story 5: Email Campaign with Multiple UTM Tags

**Scenario:** Marketing sends email to past leads about HVAC services.

```
Email Link: https://mycontractornow.com/services/hvac?utm_source=email&utm_medium=newsletter&utm_campaign=hvac_winter_promo&utm_content=cta_button

1. User clicks email link → lands on HVAC form

   → Attribution captured:
     {
       utm_source: "email",
       utm_medium: "newsletter",
       utm_campaign: "hvac_winter_promo",
       utm_content: "cta_button",
       referrer: null (email clients don't pass referrer)
     }

2. User submits

   → Lead tracked as email campaign conversion
```

**Result:** Email campaign performance measurable.

---

### Story 6: Returning User (First Touch Preserved)

**Scenario:** User first visits via Facebook ad, leaves, returns via Google search.

```
Day 1: User clicks Facebook ad
URL: https://mycontractornow.com/services/windows?utm_source=facebook&fbclid=abc

   → Attribution stored in sessionStorage:
     { utm_source: "facebook", fbclid: "abc", first_touch_timestamp: "2024-01-15T10:30:00Z" }
   → User browses but doesn't submit

Day 3: User returns via Google search (same browser session still open)
URL: https://mycontractornow.com/services/windows

   → Attribution check: sessionStorage already has data
   → FIRST TOUCH PRESERVED - Facebook attribution kept
   → User submits form

   → Lead attributed to Facebook (original source)
```

**Result:** First-touch attribution preserved. Credit goes to Facebook ad that initiated the journey.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Browser (User's Device)                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    layout.tsx (GLOBAL)                       │    │
│  │                                                              │    │
│  │   ┌─────────────────┐      ┌─────────────────┐              │    │
│  │   │  TrustedForm    │      │    Jornaya      │              │    │
│  │   │     SDK         │      │   LeadiD SDK    │              │    │
│  │   │                 │      │                 │              │    │
│  │   │ Creates hidden  │      │ Sets global:    │              │    │
│  │   │ input with      │      │ window.leadid_  │              │    │
│  │   │ cert URL        │      │ token           │              │    │
│  │   └─────────────────┘      └─────────────────┘              │    │
│  │                                                              │    │
│  │   Runs on EVERY page load (homepage, service pages, etc.)   │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │              DynamicForm Component (on form pages)           │    │
│  │                                                              │    │
│  │   On Mount:                                                  │    │
│  │   ┌─────────────────────────────────────────────────────┐   │    │
│  │   │           extractAttributionData()                   │   │    │
│  │   │                                                      │   │    │
│  │   │   • Parse URL params (utm_*, gclid, fbclid, etc.)   │   │    │
│  │   │   • Read cookies (_ga, _fbp, etc.)                  │   │    │
│  │   │   • Record landing_page, referrer                   │   │    │
│  │   │   • Store in sessionStorage                         │   │    │
│  │   └─────────────────────────────────────────────────────┘   │    │
│  │                                                              │    │
│  │   On Submit:                                                 │    │
│  │   ┌─────────────────────────────────────────────────────┐   │    │
│  │   │   Compile payload with:                              │   │    │
│  │   │   • Form answers                                     │   │    │
│  │   │   • TrustedForm cert URL (from hidden input)        │   │    │
│  │   │   • Jornaya LeadID (from window.leadid_token)       │   │    │
│  │   │   • Attribution data (from sessionStorage)          │   │    │
│  │   └─────────────────────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                         POST /api/leads
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                           Backend Server                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   Lead stored in database with:                                      │
│   • formData (user's answers)                                        │
│   • trustedFormCertUrl                                               │
│   • jornayaLeadId                                                    │
│   • attribution (full UTM + click IDs + affiliate)                  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## URL Parameters Reference

### UTM Parameters (Google Analytics Standard)

| Parameter | Purpose | Example |
|-----------|---------|---------|
| `utm_source` | Traffic source | `facebook`, `google_ads`, `email` |
| `utm_medium` | Marketing medium | `cpc`, `paid`, `organic`, `newsletter` |
| `utm_campaign` | Campaign name | `windows_spring_2024` |
| `utm_content` | Ad variation | `video_ad_v1`, `cta_button` |
| `utm_term` | Paid search keywords | `window+replacement` |

### Platform Click IDs

| Parameter | Platform | Purpose |
|-----------|----------|---------|
| `gclid` | Google Ads | Conversion tracking |
| `fbclid` | Facebook | Conversion tracking |
| `msclkid` | Microsoft/Bing Ads | Conversion tracking |
| `ttclid` | TikTok | Conversion tracking |
| `li_fat_id` | LinkedIn | Conversion tracking |
| `twclid` | Twitter/X | Conversion tracking |
| `pinterest_ct` | Pinterest | Conversion tracking |
| `sccid` | Snapchat | Conversion tracking |

### Affiliate Parameters

| Parameter | Purpose | Example |
|-----------|---------|---------|
| `affiliate_id` | Primary affiliate identifier | `PARTNER_ABC` |
| `aff` | Short affiliate param | `AFF123` |
| `ref` | Referral code | `REF456` |

---

## Direct Linking to Services

### Available Service URLs

```
https://mycontractornow.com/services/windows
https://mycontractornow.com/services/roofing
https://mycontractornow.com/services/bathrooms
https://mycontractornow.com/services/hvac
https://mycontractornow.com/services/gutters
https://mycontractornow.com/services/siding
https://mycontractornow.com/services/solar
```

### Example Ad URLs

**Facebook Ads:**
```
https://mycontractornow.com/services/windows?utm_source=facebook&utm_medium=paid&utm_campaign=windows_2024_q1&utm_content=carousel_ad&fbclid={{fbclid}}
```

**Google Ads:**
```
https://mycontractornow.com/services/roofing?utm_source=google_ads&utm_medium=cpc&utm_campaign=roofing_emergency&utm_term={keyword}&gclid={gclid}
```

**Affiliate Partner:**
```
https://mycontractornow.com/services/bathrooms?utm_source=affiliate&utm_medium=referral&utm_campaign=bathroom_partner&affiliate_id=PARTNER_XYZ
```

**Email Campaign:**
```
https://mycontractornow.com/services/hvac?utm_source=email&utm_medium=newsletter&utm_campaign=winter_hvac_promo&utm_content=hero_cta
```

**TikTok:**
```
https://mycontractornow.com/services/windows?utm_source=tiktok&utm_medium=paid&utm_campaign=window_viral&ttclid={{ttclid}}
```

---

## Technical Flow

### Complete Request Lifecycle

```
User clicks ad
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│ Browser navigates to:                                        │
│ https://mycontractornow.com/services/windows?utm_source=... │
└─────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│ layout.tsx executes (server-side render + hydration)        │
│                                                              │
│ 1. TrustedForm script injected:                             │
│    <script src="https://api.trustedform.com/trustedform.js" │
│            async></script>                                   │
│                                                              │
│ 2. Jornaya script injected:                                 │
│    <script src="https://create.lidstatic.com/campaign/      │
│            f9e0179a-baff-fd31-0b3d-43da231de245.js"         │
│            async></script>                                   │
└─────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│ Scripts load asynchronously (parallel)                       │
│                                                              │
│ TrustedForm:                                                 │
│   • Scans page for forms                                    │
│   • Creates hidden input: xxTrustedFormCertUrl              │
│   • Generates certificate URL                               │
│   • Begins recording session                                │
│                                                              │
│ Jornaya:                                                     │
│   • Generates unique LeadID token                           │
│   • Sets window.leadid_token = "abc123..."                  │
└─────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│ DynamicForm component mounts                                 │
│                                                              │
│ useEffect(() => {                                           │
│   const attribution = extractAttributionData();             │
│   // Captures all URL params, cookies, landing page         │
│   sessionStorage.setItem('attribution_data',                │
│     JSON.stringify(attribution));                           │
│ }, []);                                                      │
└─────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│ User fills out multi-step form                               │
│                                                              │
│ • Step 1: Project details                                   │
│ • Step 2: Timeline                                          │
│ • Step 3: Contact info                                      │
│ • Step 4: Review & consent                                  │
│                                                              │
│ (TrustedForm is recording the entire session)               │
└─────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│ User clicks "Get My Free Quotes"                            │
│                                                              │
│ handleSubmit() executes:                                    │
│                                                              │
│ 1. Get TrustedForm cert:                                    │
│    const certUrl = document.querySelector(                  │
│      'input[name="xxTrustedFormCertUrl"]'                   │
│    ).value;                                                  │
│    // "https://cert.trustedform.com/abc123..."              │
│                                                              │
│ 2. Get Jornaya LeadID:                                      │
│    const leadId = window.leadid_token;                      │
│    // "def456..."                                           │
│                                                              │
│ 3. Get Attribution:                                         │
│    const attribution = JSON.parse(                          │
│      sessionStorage.getItem('attribution_data')             │
│    );                                                        │
└─────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│ POST /api/leads                                              │
│                                                              │
│ {                                                            │
│   "serviceTypeId": "windows",                               │
│   "formData": {                                             │
│     "projectType": "full_replacement",                      │
│     "windowCount": "5-10",                                  │
│     "timeframe": "within_3_months",                         │
│     "firstName": "Mike",                                    │
│     "lastName": "Johnson",                                  │
│     "email": "mike@example.com",                            │
│     "phone": "555-123-4567",                                │
│     "zipCode": "90210"                                      │
│   },                                                         │
│   "zipCode": "90210",                                        │
│   "complianceData": {                                        │
│     "tcpaConsent": true,                                    │
│     "trustedFormCertUrl": "https://cert.trustedform.com/...",│
│     "trustedFormCertId": "abc123...",                       │
│     "jornayaLeadId": "def456...",                           │
│     "attribution": {                                         │
│       "utm_source": "facebook",                             │
│       "utm_medium": "paid",                                 │
│       "utm_campaign": "windows_2024_q1",                    │
│       "utm_content": "carousel_ad",                         │
│       "fbclid": "xyz789...",                                │
│       "landing_page": "https://mycontractornow.com/...",    │
│       "referrer": "https://www.facebook.com/",              │
│       "referrer_domain": "facebook.com",                    │
│       "first_touch_timestamp": "2024-01-15T10:30:00.000Z"   │
│     }                                                        │
│   }                                                          │
│ }                                                            │
└─────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│ Backend processes lead                                       │
│                                                              │
│ 1. Validate TrustedForm certificate (optional)              │
│ 2. Check Jornaya for duplicate/fraud (optional)             │
│ 3. Store lead in database                                   │
│ 4. Run PING/POST auction to buyers                          │
│ 5. Return success response                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Files Reference

### Global Initialization

| File | Lines | Purpose |
|------|-------|---------|
| `src/app/layout.tsx` | 75-108 | TrustedForm SDK loading |
| `src/app/layout.tsx` | 114-148 | Jornaya LeadiD SDK loading |

### Attribution Capture

| File | Purpose |
|------|---------|
| `src/utils/attribution.ts` | All attribution extraction logic |
| `src/utils/attribution.ts` | `extractAttributionData()` - main capture function |
| `src/utils/attribution.ts` | `getAffiliateCode()` - affiliate ID extraction |
| `src/utils/attribution.ts` | `detectTrafficSource()` - source classification |

### Form Components

| File | Purpose |
|------|---------|
| `src/app/services/[slug]/page.tsx` | Dynamic service form page |
| `src/components/DynamicForm.tsx` | Main form wrapper with providers |
| `src/components/forms/compliance/TrustedFormProvider.tsx` | TrustedForm context |
| `src/components/forms/compliance/JornayaProvider.tsx` | Jornaya context |

### Backend Processing

| File | Purpose |
|------|---------|
| `src/app/api/leads/route.ts` | Lead submission endpoint |
| `src/lib/external/trustedform.ts` | TrustedForm certificate validation |
| `src/lib/external/jornaya.ts` | Jornaya LeadID verification |

---

## FAQ

### Q: Can I direct ad traffic straight to service pages instead of the homepage?

**Yes, absolutely.** All tracking (TrustedForm, Jornaya, attribution) works identically on service pages. The homepage is just a routing page - it doesn't do any special initialization.

### Q: Will I lose any tracking data by skipping the homepage?

**No.** All tracking scripts are loaded globally via `layout.tsx`, which runs on every page. Attribution is captured when the form mounts, regardless of entry point.

### Q: How do I track which ad creative performed best?

Use `utm_content` to differentiate ad variations:
```
?utm_source=facebook&utm_campaign=windows_2024&utm_content=video_ad_v1
?utm_source=facebook&utm_campaign=windows_2024&utm_content=carousel_ad_v2
```

### Q: How do I track affiliate partners?

Include `affiliate_id` in the URL:
```
?utm_source=affiliate&affiliate_id=PARTNER_ABC
```

The system also checks `aff` and `ref` parameters as fallbacks.

### Q: What happens if someone visits from an ad, leaves, and returns later?

Attribution uses **first-touch** model. The original source is preserved in sessionStorage until the browser session ends. If they return in the same session, they're still attributed to the original ad.

### Q: Can I see the TrustedForm certificate for a lead?

Yes, each lead stores `trustedFormCertUrl` which links directly to the certificate:
```
https://cert.trustedform.com/[certificate-id]
```

### Q: How do I verify a lead isn't fraudulent?

The `jornayaLeadId` can be used with Jornaya's API to check:
- If this is a duplicate submission
- Lead velocity (how quickly they filled the form)
- Known fraud patterns

### Q: What if TrustedForm or Jornaya scripts fail to load?

The form will still submit. The compliance fields will be empty/null, but the lead is captured. You can filter these leads in your CRM if needed.

---

## Summary

**Direct linking to service pages is fully supported and recommended for ad campaigns.** Use URL parameters liberally to track campaign performance:

```
https://mycontractornow.com/services/[service]?utm_source=...&utm_medium=...&utm_campaign=...&affiliate_id=...
```

All compliance (TrustedForm, Jornaya) and attribution tracking works automatically.
