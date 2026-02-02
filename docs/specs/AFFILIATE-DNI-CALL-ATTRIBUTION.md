# Affiliate Dynamic Number Insertion & Call Attribution

## Spec Version: 1.0
## Status: Draft
## Author: Claude
## Date: 2026-02-02

---

## Executive Summary

**Problem**: When affiliates drive web traffic to our landing pages via their affiliate links, and visitors decide to call instead of filling out a form, the affiliate doesn't get credit for that call.

**Solution**: Implement Dynamic Number Insertion (DNI) - an industry-standard feature where landing pages automatically display the affiliate's tracking number based on their referral code. This ensures affiliates get credit whether visitors submit a form OR call.

---

## User Stories

### US-1: Affiliate Gets Credit for Calls from Web Traffic
**As an** affiliate who drives web traffic via my referral link
**I want** the landing page to show my tracking number
**So that** I get credit when visitors call instead of filling out a form

**Acceptance Criteria:**
- When visitor arrives via `?ref=mycode`, page shows my provisioned tracking number
- If I don't have a tracking number for that service, show a prompt to provision one
- If no `ref` param, show default company number
- Click-to-call button uses my tracking number

### US-2: Mobile User Can Tap to Call
**As a** mobile visitor on a landing page
**I want** to tap a "Call Now" button
**So that** I can instantly connect without dialing manually

**Acceptance Criteria:**
- Prominent click-to-call button on mobile
- Uses `tel:` link for native dialing
- Displays formatted phone number
- Tracks click events for analytics

### US-3: Affiliate Can Embed Call Button on Their Site
**As an** affiliate with my own website
**I want** to embed a call button that uses my tracking number
**So that** visitors can call directly from my site and I get credit

**Acceptance Criteria:**
- Simple embed code (script tag or iframe)
- Automatically uses affiliate's tracking number
- Styled button that matches common themes
- Falls back gracefully if number not provisioned

### US-4: Sophisticated Affiliate Can Forward Calls
**As an** affiliate using my own Ringba/call tracking
**I want** to forward calls to your ingress number with my ID
**So that** I maintain my own tracking while still getting paid

**Acceptance Criteria:**
- Documented ingress number for call forwarding
- Accept affiliate ID via SIP headers or URL params
- Attribute calls correctly to forwarding affiliate
- Support standard forwarding formats

---

## System Architecture

### Current State
```
Affiliate Link Flow (Web Forms):
┌─────────────────────────────────────────────────────────┐
│ 1. Click: mycontractornow.com/windows?ref=john123       │
│ 2. Cookie set: aff_ref=john123 (30-day)                 │
│ 3. Form submitted with attribution.ref=john123         │
│ 4. Lead created with affiliateId                        │
│ 5. Affiliate gets commission when lead sells            │
└─────────────────────────────────────────────────────────┘

Tracking Number Flow (Calls):
┌─────────────────────────────────────────────────────────┐
│ 1. Affiliate provisions number: (844) 555-1234          │
│ 2. Uses number in their marketing                       │
│ 3. Caller dials (844) 555-1234                          │
│ 4. System looks up number → finds affiliateId           │
│ 5. Call attributed to affiliate                         │
└─────────────────────────────────────────────────────────┘

GAP: These two systems don't connect!
```

### Proposed State
```
Unified Attribution Flow:
┌─────────────────────────────────────────────────────────┐
│ 1. Click: mycontractornow.com/windows?ref=john123       │
│ 2. Cookie set: aff_ref=john123                          │
│ 3. Landing page detects ref param                       │
│ 4. Fetches John's tracking number for Windows service   │
│ 5. Displays (844) 555-1234 on "Call Now" button         │
│ 6. Visitor calls → John gets credit                     │
│    OR                                                   │
│ 6. Visitor fills form → John gets credit (existing)     │
└─────────────────────────────────────────────────────────┘
```

---

## Technical Design

### Component 1: DNI API Endpoint

**Purpose**: Fetch affiliate's tracking number based on referral code and service type.

**Endpoint**: `GET /api/tracking-numbers/by-referral`

**Query Params**:
- `ref` (required): Affiliate referral code from URL
- `service` (required): Service type slug (e.g., "windows", "roofing")

**Response**:
```json
{
  "success": true,
  "data": {
    "phoneNumber": "+18445551234",
    "phoneNumberDisplay": "(844) 555-1234",
    "affiliateId": "uuid",
    "affiliateName": "John's Marketing",
    "hasNumber": true
  }
}
```

**Fallback Response** (no tracking number):
```json
{
  "success": true,
  "data": {
    "phoneNumber": null,
    "hasNumber": false,
    "provisionUrl": "/affiliate/campaigns"
  }
}
```

**File**: `src/app/api/tracking-numbers/by-referral/route.ts`

---

### Component 2: DNI React Hook

**Purpose**: Client-side hook to fetch and manage dynamic phone number.

**Usage**:
```tsx
const { phoneNumber, displayNumber, isLoading, affiliateName } = useDynamicNumber({
  service: 'windows',
  fallbackNumber: '+18001234567'
});
```

**Logic**:
1. Check URL for `ref` param
2. Check cookie for `aff_ref` (fallback)
3. If found, fetch affiliate's tracking number
4. Cache result in sessionStorage
5. Return number or fallback

**File**: `src/hooks/useDynamicNumber.ts`

---

### Component 3: Click-to-Call Button

**Purpose**: Reusable call button component with DNI support.

**Props**:
```tsx
interface CallButtonProps {
  service: string;           // Service type slug
  fallbackNumber?: string;   // Default number if no affiliate
  variant?: 'primary' | 'outline' | 'minimal';
  size?: 'sm' | 'md' | 'lg';
  showNumber?: boolean;      // Display number text
  className?: string;
}
```

**Features**:
- Uses `useDynamicNumber` hook internally
- Loading skeleton while fetching
- Click tracking for analytics
- Mobile-optimized touch target
- Accessible (aria labels)

**File**: `src/components/ui/CallButton.tsx`

---

### Component 4: Embeddable Widget

**Purpose**: External script affiliates can embed on their sites.

**Embed Code**:
```html
<div id="mcn-call-widget"></div>
<script src="https://mycontractornow.com/widget/call.js"
        data-ref="john123"
        data-service="windows"
        data-theme="light">
</script>
```

**Features**:
- Self-contained (no React dependency for embed)
- Customizable via data attributes
- Responsive design
- CORS-enabled API calls

**Files**:
- `public/widget/call.js` - Vanilla JS widget
- `src/app/api/widget/call/route.ts` - Widget API (CORS enabled)

---

### Component 5: Ingress Number Documentation

**Purpose**: Document how sophisticated affiliates can forward calls.

**Supported Methods**:
1. **SIP Header**: `X-Affiliate-ID: john123`
2. **URL Param**: Forward to `+18881234567;ext=john123`
3. **DTMF Prefix**: Caller presses affiliate code before being connected

**File**: `docs/affiliate/call-forwarding.md`

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/app/api/tracking-numbers/by-referral/route.ts` | DNI API endpoint |
| `src/hooks/useDynamicNumber.ts` | Client-side DNI hook |
| `src/components/ui/CallButton.tsx` | Click-to-call component |
| `public/widget/call.js` | Embeddable widget script |
| `src/app/api/widget/call/route.ts` | Widget API with CORS |
| `docs/affiliate/call-forwarding.md` | Ingress documentation |
| `docs/affiliate/dynamic-number-insertion.md` | DNI documentation |

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/app/(marketing)/[serviceType]/page.tsx` | Add CallButton component |
| `src/app/(marketing)/services/[slug]/page.tsx` | Add CallButton component |
| `src/components/forms/LeadForm.tsx` | Add call option above/beside form |
| `src/lib/services/tracking-number-service.ts` | Add `getByAffiliateCode()` function |
| `src/lib/services/affiliate-service.ts` | Add `getAffiliateByCode()` function |

---

## Database Changes

**None required.** We already have:
- `TrackingNumber` with `affiliateId` and `campaignId`
- `AffiliateLink` with `code` field
- `AffiliateCampaign` joining affiliates to campaigns

We just need to query: AffiliateLink.code → Affiliate → AffiliateCampaign → TrackingNumber

---

## Implementation Tasks

### Phase 1: Core DNI Infrastructure (Priority: High)

#### Task 1.1: Create DNI API Endpoint
**File**: `src/app/api/tracking-numbers/by-referral/route.ts`

```typescript
/**
 * GET /api/tracking-numbers/by-referral
 *
 * WHY: Enable landing pages to fetch affiliate's tracking number
 *      for Dynamic Number Insertion (DNI).
 *
 * WHEN: Landing page loads with ?ref= param or aff_ref cookie.
 *
 * HOW: Look up affiliate by referral code, find their tracking number
 *      for the specified service type.
 */
```

**Steps**:
1. Parse `ref` and `service` query params
2. Look up AffiliateLink by code
3. Find affiliate's campaign for that service
4. Get active TrackingNumber for that campaign
5. Return formatted response

**Estimated**: 30 min

---

#### Task 1.2: Create useDynamicNumber Hook
**File**: `src/hooks/useDynamicNumber.ts`

```typescript
/**
 * useDynamicNumber Hook
 *
 * WHY: Provide dynamic phone number based on affiliate attribution.
 *
 * WHEN: Any page/component needs to display a call-to-action phone number.
 *
 * HOW: Check URL params → check cookies → fetch from API → cache result.
 */
```

**Steps**:
1. Create hook with service and fallback params
2. Check `ref` URL param first
3. Fall back to `aff_ref` cookie
4. Fetch from `/api/tracking-numbers/by-referral`
5. Cache in sessionStorage (avoid repeated fetches)
6. Return { phoneNumber, displayNumber, isLoading, error }

**Estimated**: 45 min

---

#### Task 1.3: Create CallButton Component
**File**: `src/components/ui/CallButton.tsx`

```typescript
/**
 * CallButton Component
 *
 * WHY: Provide consistent, accessible click-to-call UX with DNI support.
 *
 * WHEN: Any landing page, service page, or form needs a call option.
 *
 * HOW: Use useDynamicNumber hook, render tel: link, track clicks.
 */
```

**Steps**:
1. Create component with variants (primary, outline, minimal)
2. Integrate useDynamicNumber hook
3. Render loading skeleton while fetching
4. Use `tel:` href for click-to-call
5. Add click tracking via existing analytics
6. Ensure accessibility (aria-label, focus states)

**Estimated**: 1 hour

---

### Phase 2: Landing Page Integration (Priority: High)

#### Task 2.1: Add CallButton to Service Pages
**Files**:
- `src/app/(marketing)/[serviceType]/page.tsx`
- `src/app/(marketing)/services/[slug]/page.tsx`

**Steps**:
1. Import CallButton component
2. Add prominent placement (hero section, sticky mobile bar)
3. Pass service type slug to component
4. Test with various affiliate codes

**Estimated**: 45 min

---

#### Task 2.2: Add Call Option to Lead Form
**File**: `src/components/forms/LeadForm.tsx`

**Steps**:
1. Add "Or Call Now" section above/beside form
2. Use CallButton component
3. Style to complement form design
4. Mobile: Consider sticky call bar at bottom

**Estimated**: 30 min

---

### Phase 3: Embeddable Widget (Priority: Medium)

#### Task 3.1: Create Widget API
**File**: `src/app/api/widget/call/route.ts`

**Steps**:
1. Create endpoint that returns tracking number
2. Enable CORS for cross-origin requests
3. Validate referrer (optional security)
4. Return JSON with number and styling info

**Estimated**: 30 min

---

#### Task 3.2: Create Widget Script
**File**: `public/widget/call.js`

**Steps**:
1. Create self-executing vanilla JS
2. Read data attributes from script tag
3. Fetch number from widget API
4. Render button into target element
5. Handle click events
6. Support theme customization

**Estimated**: 1.5 hours

---

### Phase 4: Documentation (Priority: Medium)

#### Task 4.1: DNI Documentation
**File**: `docs/affiliate/dynamic-number-insertion.md`

**Content**:
- What is DNI and why it matters
- How it works on our platform
- How affiliates benefit
- Troubleshooting guide

**Estimated**: 30 min

---

#### Task 4.2: Call Forwarding Documentation
**File**: `docs/affiliate/call-forwarding.md`

**Content**:
- How to forward calls from Ringba/other platforms
- Ingress number details
- SIP header format
- Testing instructions

**Estimated**: 30 min

---

### Phase 5: Testing & QA (Priority: High)

#### Task 5.1: Unit Tests
- Test DNI API endpoint
- Test useDynamicNumber hook
- Test CallButton component

**Estimated**: 1 hour

---

#### Task 5.2: Integration Testing
- Test full flow: affiliate link → landing page → call button shows correct number
- Test fallback when affiliate has no number
- Test mobile click-to-call
- Test widget embedding

**Estimated**: 1 hour

---

## Edge Cases to Handle

| Scenario | Handling |
|----------|----------|
| Affiliate has no tracking number for service | Show fallback number, optionally prompt to provision |
| Invalid/expired affiliate code | Use fallback number silently |
| Affiliate account suspended | Use fallback number silently |
| Multiple tracking numbers for same service | Use most recently provisioned active one |
| Service type doesn't exist | Use fallback number |
| API timeout/error | Use fallback number, log error |
| SessionStorage unavailable | Re-fetch each page load |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| DNI API latency | < 200ms p95 |
| Call button click rate | Track baseline, then improvements |
| Affiliate calls via DNI | % of calls attributed via DNI vs direct |
| Widget adoption | # of affiliates using embed |

---

## Security Considerations

1. **Rate limiting**: DNI API should be rate-limited to prevent abuse
2. **No sensitive data**: API returns only public info (phone number, affiliate name)
3. **CORS for widget**: Restrict to known domains or allow all with monitoring
4. **Input validation**: Sanitize ref codes to prevent injection

---

## Rollout Plan

1. **Week 1**: Build Phase 1 (DNI API, hook, component)
2. **Week 2**: Build Phase 2 (landing page integration)
3. **Week 3**: Build Phase 3 (widget) + Phase 4 (docs)
4. **Week 4**: Testing, QA, soft launch to select affiliates
5. **Week 5**: Full rollout, monitor metrics

---

## Appendix: Code Examples

### A. DNI API Response Examples

**Success with number**:
```json
{
  "success": true,
  "data": {
    "hasNumber": true,
    "phoneNumber": "+18445551234",
    "phoneNumberDisplay": "(844) 555-1234",
    "affiliateId": "clx1234567890",
    "affiliateName": "John's Marketing Co"
  }
}
```

**Affiliate exists but no number**:
```json
{
  "success": true,
  "data": {
    "hasNumber": false,
    "phoneNumber": null,
    "affiliateId": "clx1234567890",
    "affiliateName": "John's Marketing Co",
    "message": "Affiliate has not provisioned a number for this service"
  }
}
```

**Invalid affiliate code**:
```json
{
  "success": true,
  "data": {
    "hasNumber": false,
    "phoneNumber": null,
    "affiliateId": null,
    "message": "Unknown referral code"
  }
}
```

### B. CallButton Usage Examples

**Basic usage**:
```tsx
<CallButton service="windows" />
```

**With fallback**:
```tsx
<CallButton
  service="windows"
  fallbackNumber="+18001234567"
  showNumber={true}
/>
```

**Styled variant**:
```tsx
<CallButton
  service="roofing"
  variant="primary"
  size="lg"
  className="mt-4"
/>
```

### C. Widget Embed Example

```html
<!-- Minimal -->
<div id="mcn-call"></div>
<script src="https://mycontractornow.com/widget/call.js"
        data-ref="john123"
        data-service="windows">
</script>

<!-- Customized -->
<div id="mcn-call"></div>
<script src="https://mycontractornow.com/widget/call.js"
        data-ref="john123"
        data-service="windows"
        data-theme="dark"
        data-size="large"
        data-text="Speak to a Specialist">
</script>
```

---

## Questions for Review

1. Should we show affiliate name on the call button? (e.g., "Call via John's Marketing")
2. Should we allow affiliates to customize their button text in dashboard?
3. Do we need analytics tracking on the widget (may require GDPR considerations)?
4. Should fallback number be configurable per service type?

---

## Sign-off

- [ ] Product Owner
- [ ] Engineering Lead
- [ ] Design Review
- [ ] Security Review
