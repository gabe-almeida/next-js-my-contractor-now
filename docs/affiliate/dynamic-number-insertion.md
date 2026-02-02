# Dynamic Number Insertion (DNI) System

## Overview

Dynamic Number Insertion (DNI) automatically displays an affiliate's tracking phone number on landing pages when visitors arrive via affiliate referral links. This ensures affiliates get credit whether visitors submit a form OR call.

**Problem Solved**: Previously, affiliates only got credit for form submissions. If a visitor arrived via `?ref=john123` and called instead of filling out a form, John got no credit.

**Solution**: When a page loads with a `ref` parameter or `aff_ref` cookie, the page fetches and displays the affiliate's tracking number.

---

## How It Works

### Flow Diagram

```
+-----------------------------------------------------------------------+
|  1. VISITOR CLICKS AFFILIATE LINK                                      |
|     https://mycontractornow.com/windows?ref=john123                   |
|         |                                                              |
|  2. LANDING PAGE LOADS                                                 |
|     - useDynamicNumber hook detects ref=john123                       |
|     - Hook checks sessionStorage cache first (5-min TTL)              |
|         |                                                              |
|  3. API CALL (if not cached)                                          |
|     GET /api/tracking-numbers/by-referral?ref=john123&service=windows |
|         |                                                              |
|  4. DATABASE LOOKUP                                                    |
|     AffiliateLink (code) -> Affiliate -> AffiliateCampaign ->         |
|     TrackingNumber                                                     |
|         |                                                              |
|  5. RESPONSE                                                           |
|     { phoneNumber: "+18445551234", affiliateName: "John's Marketing" }|
|         |                                                              |
|  6. DISPLAY                                                            |
|     CallButton shows: "Call Now (844) 555-1234"                       |
|         |                                                              |
|  7. VISITOR CALLS                                                      |
|     Call attributed to John -> Commission earned                      |
+-----------------------------------------------------------------------+
```

### Key Flows

#### 1. Visitor Arrives via Affiliate Link

```
1. Visitor clicks: mycontractornow.com/windows?ref=john123
2. Landing page loads
3. useDynamicNumber hook detects ref=john123
4. Hook fetches from /api/tracking-numbers/by-referral?ref=john123&service=windows
5. API looks up John's tracking number for Windows service
6. CallButton displays: "Call Now (844) 555-1234"
7. Visitor calls -> John gets credit
   OR Visitor fills form -> John gets credit (existing flow)
```

#### 2. API Lookup Flow

```
GET /api/tracking-numbers/by-referral?ref=john123&service=windows

1. Look up AffiliateLink by code "john123"
2. Verify affiliate is ACTIVE
3. Find ServiceType by name "windows"
4. Find AffiliateCampaign for this affiliate + service type
5. Get ACTIVE TrackingNumber for that campaign
6. Return phone number or fallback response
```

#### 3. Caching Flow

```
1. First page load: API is called, result cached in sessionStorage
2. Navigation to another service page: Cache miss, new API call
3. Return to first page: Cache hit, no API call
4. After 5 minutes: Cache expires, fresh API call
```

---

## API Reference

### GET /api/tracking-numbers/by-referral

Fetches an affiliate's tracking number based on their referral code and the service type.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `ref` | string | Yes | Affiliate referral code from URL |
| `service` | string | Yes | Service type slug (e.g., "windows", "roofing") |

**Success Response (has number):**
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

**Response (affiliate exists, no number):**
```json
{
  "success": true,
  "data": {
    "hasNumber": false,
    "phoneNumber": null,
    "phoneNumberDisplay": null,
    "affiliateId": "clx1234567890",
    "affiliateName": "John's Marketing Co",
    "message": "Affiliate has not provisioned a number for this service",
    "provisionUrl": "/affiliate/campaigns"
  }
}
```

**Response (unknown ref code):**
```json
{
  "success": true,
  "data": {
    "hasNumber": false,
    "phoneNumber": null,
    "phoneNumberDisplay": null,
    "affiliateId": null,
    "affiliateName": null,
    "message": "Unknown referral code"
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Missing required parameter: ref"
}
```

---

## Important Files

### API Endpoint
- **File**: `src/app/api/tracking-numbers/by-referral/route.ts`
- **Purpose**: GET endpoint for DNI lookups
- **Accepts**: `ref` (affiliate code) and `service` (service type slug)
- **Returns**: Tracking number or fallback

### React Hook
- **File**: `src/hooks/useDynamicNumber.ts`
- **Purpose**: Client-side hook for fetching dynamic phone numbers
- **Checks**: URL params first, then cookies for affiliate ref
- **Caches**: sessionStorage for 5 minutes
- **Returns**: Loading state, phone number, and affiliate info

### UI Component
- **File**: `src/components/ui/CallButton.tsx`
- **Purpose**: Click-to-call button with DNI support
- **Variants**: primary (green), outline, minimal
- **Sizes**: sm, md, lg
- **Features**: Loading skeleton, accessible ARIA labels

### Widget Files
- **File**: `public/widget/call.js` - Embeddable widget script (vanilla JS)
- **File**: `src/app/api/widget/call/route.ts` - CORS-enabled API for widget

---

## Component Documentation

### CallButton Component

A click-to-call button that automatically displays the affiliate's tracking number via DNI.

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `service` | string | required | Service type slug for DNI lookup |
| `fallbackNumber` | string | - | Default number if no affiliate number (E.164 format) |
| `fallbackDisplayNumber` | string | - | Display format for fallback: (xxx) xxx-xxxx |
| `variant` | 'primary' \| 'outline' \| 'minimal' | 'primary' | Button style variant |
| `size` | 'sm' \| 'md' \| 'lg' | 'md' | Button size |
| `showNumber` | boolean | true | Show phone number text on button |
| `showAttribution` | boolean | false | Show "via Affiliate Name" |
| `text` | string | "Call Now" | Custom button text |
| `skipDni` | boolean | false | Skip DNI fetch (just use fallback) |
| `onClick` | () => void | - | Callback when button is clicked |
| `disabled` | boolean | false | Disable the button |
| `className` | string | - | Additional CSS classes |

**Basic Usage:**
```tsx
import { CallButton } from '@/components/ui/CallButton';

// On a Windows service page
<CallButton
  service="windows"
  fallbackNumber="+18001234567"
  fallbackDisplayNumber="(800) 123-4567"
/>
```

**With Options:**
```tsx
<CallButton
  service="roofing"
  fallbackNumber="+18001234567"
  fallbackDisplayNumber="(800) 123-4567"
  variant="outline"
  size="lg"
  showNumber={true}
  showAttribution={true}  // Shows "via John's Marketing"
/>
```

### useDynamicNumber Hook

React hook for fetching dynamic phone numbers with affiliate attribution.

**Options:**

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `service` | string | Yes | Service type slug |
| `fallbackNumber` | string | No | Fallback if no affiliate number |
| `fallbackDisplayNumber` | string | No | Display format for fallback |
| `skip` | boolean | No | Skip fetching (useful for SSR) |

**Returns:**

| Property | Type | Description |
|----------|------|-------------|
| `phoneNumber` | string \| null | E.164 format phone number |
| `displayNumber` | string \| null | Human-readable format |
| `isLoading` | boolean | Whether currently fetching |
| `error` | string \| null | Error message if fetch failed |
| `affiliateName` | string \| null | Affiliate name for attribution |
| `hasNumber` | boolean | Whether tracking number was found |
| `isAffiliate` | boolean | Using affiliate tracking vs fallback |
| `affiliateId` | string \| null | Affiliate ID if found |
| `refetch` | () => void | Refetch the number |

**Usage:**
```tsx
import { useDynamicNumber } from '@/hooks/useDynamicNumber';

function MyComponent() {
  const {
    phoneNumber,
    displayNumber,
    isLoading,
    affiliateName,
    hasNumber
  } = useDynamicNumber({
    service: 'windows',
    fallbackNumber: '+18001234567',
    fallbackDisplayNumber: '(800) 123-4567'
  });

  if (isLoading) return <Skeleton />;

  return (
    <a href={`tel:${phoneNumber}`}>
      Call {displayNumber}
      {affiliateName && <small>via {affiliateName}</small>}
    </a>
  );
}
```

### StaticCallButton Component

For when you have a known phone number without DNI lookup.

```tsx
import { StaticCallButton } from '@/components/ui/CallButton';

<StaticCallButton
  phoneNumber="+18001234567"
  displayNumber="(800) 123-4567"
  text="Contact Us"
/>
```

---

## Database Relationships

```
AffiliateLink (code: "john123")
    |
    v
Affiliate (id, status: ACTIVE)
    |
    v
AffiliateCampaign (affiliateId, campaignId, status: APPROVED)
    |
    v
Campaign (serviceTypeId)
    |
    v
TrackingNumber (affiliateId, campaignId, provisioningStatus: ACTIVE)
```

---

## Embeddable Widget

Affiliates can embed a call button widget on their own websites that displays their tracking number.

### Getting the Embed Code

Affiliates can obtain their embed code from the Affiliate Dashboard under **Campaigns > [Campaign Name] > Embed Widget**.

The embed code consists of two parts:
1. A container div where the button will render
2. A script tag that loads and configures the widget

### Basic Embed Code

```html
<div id="mcn-call-widget"></div>
<script src="https://mycontractornow.com/widget/call.js"
        data-ref="your-affiliate-code"
        data-service="windows">
</script>
```

### Customization Options

| Attribute | Required | Default | Description |
|-----------|----------|---------|-------------|
| `data-ref` | Yes | - | Affiliate referral code |
| `data-service` | Yes | - | Service type slug (e.g., "windows", "roofing", "siding") |
| `data-theme` | No | "light" | Color theme: "light" or "dark" |
| `data-size` | No | "md" | Button size: "sm", "md", or "lg" |
| `data-text` | No | "Call Now" | Custom button text |
| `data-container` | No | "mcn-call-widget" | Custom container element ID |

### Customized Examples

**Dark theme with large button:**
```html
<div id="mcn-call-widget"></div>
<script src="https://mycontractornow.com/widget/call.js"
        data-ref="john123"
        data-service="windows"
        data-theme="dark"
        data-size="lg">
</script>
```

**Custom text and small size:**
```html
<div id="mcn-call-widget"></div>
<script src="https://mycontractornow.com/widget/call.js"
        data-ref="john123"
        data-service="roofing"
        data-text="Speak to a Specialist"
        data-size="sm">
</script>
```

**Multiple widgets on one page:**
```html
<!-- Widget for Windows -->
<div id="windows-widget"></div>
<script src="https://mycontractornow.com/widget/call.js"
        data-ref="john123"
        data-service="windows"
        data-container="windows-widget">
</script>

<!-- Widget for Roofing -->
<div id="roofing-widget"></div>
<script src="https://mycontractornow.com/widget/call.js"
        data-ref="john123"
        data-service="roofing"
        data-container="roofing-widget">
</script>
```

### Widget API Endpoint

The widget uses a dedicated CORS-enabled API endpoint:

**Endpoint**: `GET /api/widget/call`

**Query Parameters**:
- `ref`: Affiliate referral code
- `service`: Service type slug

**Response**:
```json
{
  "success": true,
  "data": {
    "hasNumber": true,
    "phoneNumber": "+18445551234",
    "phoneNumberDisplay": "(844) 555-1234",
    "affiliateName": "John's Marketing Co",
    "serviceName": "Windows"
  }
}
```

### JavaScript Events

The widget dispatches a custom event when loaded successfully:

```javascript
document.addEventListener('mcn-widget-loaded', function(event) {
  console.log('Widget loaded:', event.detail);
  // {
  //   ref: "john123",
  //   service: "windows",
  //   phoneNumber: "+18445551234",
  //   affiliateName: "John's Marketing Co"
  // }
});
```

### Click Tracking

To track widget clicks, define a global callback:

```javascript
window.mcnWidgetOnClick = function(data) {
  // data: { ref, service, phoneNumber }
  console.log('Call button clicked:', data);

  // Example: Send to analytics
  gtag('event', 'call_click', {
    affiliate_ref: data.ref,
    service: data.service
  });
};
```

---

## Edge Cases & Handling

| Scenario | Behavior |
|----------|----------|
| Invalid ref code | Returns hasNumber: false, uses fallback |
| Affiliate suspended | Returns hasNumber: false, uses fallback |
| No campaign for service | Returns hasNumber: false with provisionUrl |
| No tracking number provisioned | Returns hasNumber: false with provisionUrl |
| API error/timeout | Uses fallback silently |
| SessionStorage disabled | Works, just re-fetches each page |
| Multiple numbers for same service | Uses most recently provisioned active one |

---

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Widget shows "Call service not available" | No tracking number provisioned | Provision a number in Affiliate Dashboard |
| Widget shows "Unable to load" | Network error or API down | Check browser console for errors |
| Widget doesn't appear | Missing container div | Ensure `<div id="mcn-call-widget">` exists before script |
| Wrong number displayed | Wrong ref code | Verify `data-ref` matches your affiliate code |
| CORS errors in console | Script loaded from file:// | Test on a web server, not local files |
| Number not updating | Cached in sessionStorage | Clear sessionStorage or wait 5 minutes |
| CallButton shows skeleton forever | API failing silently | Check network tab for API errors |

### Debugging Steps

1. **Check URL Parameters**
   ```javascript
   // In browser console
   new URLSearchParams(window.location.search).get('ref')
   ```

2. **Check Cookie**
   ```javascript
   document.cookie.split(';').find(c => c.includes('aff_ref'))
   ```

3. **Test API Directly**
   ```bash
   curl "https://mycontractornow.com/api/tracking-numbers/by-referral?ref=john123&service=windows"
   ```

4. **Clear Cache**
   ```javascript
   // Clear all DNI cache
   Object.keys(sessionStorage)
     .filter(k => k.startsWith('dni_'))
     .forEach(k => sessionStorage.removeItem(k));
   ```

---

## Performance

- **API target latency**: < 200ms p95
- **SessionStorage caching**: 5 minute TTL
- **No duplicate fetches**: Same service during session uses cache
- **Rate limiting**: Standard API rate limits apply

---

## Security

- **Input sanitization**: ref and service params are sanitized (alphanumeric, underscore, hyphen only)
- **No sensitive data exposed**: Only public info (phone, affiliate name)
- **CORS for widget**: Open CORS policy for widget API (affiliates embed anywhere)
- **Rate limiting**: Prevents abuse of DNI and widget APIs

---

## FAQ

**Q: What if an affiliate hasn't provisioned a tracking number?**
A: The API returns `hasNumber: false` with a `provisionUrl` pointing to the affiliate dashboard. The CallButton component will display the fallback number.

**Q: How long does attribution last?**
A: The `aff_ref` cookie is set for 30 days. If a visitor returns within 30 days and calls, the original affiliate still gets credit.

**Q: Can affiliates customize the button on landing pages?**
A: Landing pages use our standard CallButton component. Affiliates who want custom styling can use the embeddable widget on their own sites.

**Q: Does DNI work on mobile?**
A: Yes. The CallButton renders as a `tel:` link which triggers the native phone dialer on mobile devices.

**Q: What happens if the API is slow or fails?**
A: The useDynamicNumber hook shows a loading skeleton, then falls back to the fallback number if the API times out or errors.

---

## Related Documentation

- [Call Forwarding](./call-forwarding.md) - For affiliates who want to forward calls from their own tracking systems
- [Affiliate Tracking Flow](../affiliate-tracking-flow.md) - Full tracking attribution flow for forms and leads
