# Call Forwarding for Affiliates

## Overview

Call forwarding allows sophisticated affiliates who use their own call tracking platforms (Ringba, Retreaver, Invoca, etc.) to forward calls to My Contractor Now while maintaining attribution.

**When to use call forwarding:**
- You already have your own call tracking infrastructure
- You want to maintain your own analytics and reporting
- You need to route calls through your own systems first
- You're running multi-network campaigns that require your own tracking

**When NOT to use call forwarding:**
- You're new to call tracking (use our platform-provisioned numbers instead)
- You don't have existing call tracking infrastructure
- You want the simplest setup possible

---

## How It Works

### Architecture

```
+------------------------------------------------------------------------+
|  CALL FORWARDING FLOW                                                   |
|                                                                         |
|  1. Caller dials YOUR Ringba/Retreaver number                          |
|         |                                                               |
|  2. Your system routes call + adds identification headers               |
|         |                                                               |
|  3. Call forwarded to our INGRESS number with headers:                 |
|         X-Affiliate-ID: your-affiliate-id                              |
|         X-Campaign-ID: campaign-id                                     |
|         |                                                               |
|  4. Our /api/calls/incoming parses headers                             |
|         |                                                               |
|  5. We identify you as the affiliate -> normal auction flow            |
|         |                                                               |
|  6. Call connected to contractor -> you earn commission                |
+------------------------------------------------------------------------+
```

### Key Concepts

| Concept | Description |
|---------|-------------|
| **Ingress Number** | Shared phone number that accepts forwarded calls from multiple affiliates |
| **Forwarding Identifier** | Unique ID combining ingress phone + affiliate ID + campaign ID |
| **SIP Headers** | Metadata sent with the call that identifies your affiliate account |
| **Platform Numbers** | Numbers we provision directly for affiliates (1:1 mapping) |

---

## Setup Guide

### Prerequisites

1. **Active Affiliate Account**: Your account must be in ACTIVE status
2. **Campaign Access**: You must have APPROVED access to at least one campaign
3. **Call Tracking Platform**: Ringba, Retreaver, Invoca, or similar that supports SIP header forwarding

### Step 1: Request Forwarding Configuration

Contact your affiliate manager or use the Affiliate Dashboard:

1. Log in to Affiliate Dashboard
2. Go to **Campaigns > [Your Campaign] > Call Tracking**
3. Select **"Forward from my own number"**
4. Click **"Configure Forwarding"**

You'll receive:
- **Ingress Phone Number**: The number to forward calls to
- **Your Affiliate ID**: Your unique identifier
- **Your Campaign ID**: The campaign identifier
- **Forwarding Identifier**: Full identifier string (optional, for advanced setups)

### Step 2: Configure Your Call Tracking Platform

#### Ringba Setup

1. **Create a new Target** in Ringba pointing to our ingress number

2. **Add SIP Headers** to the target:
   ```
   X-Affiliate-ID: your-affiliate-id
   X-Campaign-ID: your-campaign-id
   ```

3. **Configure the forwarding number**:
   - Target Number: `+1XXXXXXXXXX` (our ingress number)
   - Forward Type: SIP
   - Include Custom Headers: Yes

4. **Save and activate** the target

#### Retreaver Setup

1. **Create a Target** with our ingress number

2. **Add URL Parameters or SIP Headers**:
   ```
   affiliate_id=your-affiliate-id
   campaign_id=your-campaign-id
   ```

3. **Configure routing** to this target

#### Invoca Setup

1. **Create a Destination** with our ingress number

2. **Configure SIP Headers** in Advanced Settings:
   ```
   X-Affiliate-ID: your-affiliate-id
   X-Campaign-ID: your-campaign-id
   ```

#### Generic SIP Trunk Setup

If using a custom SIP solution:

1. Configure your SIP trunk to route to our ingress number
2. Add these headers to the SIP INVITE:
   ```
   X-Affiliate-ID: your-affiliate-id
   X-Campaign-ID: your-campaign-id
   ```

---

## Identification Methods

We support multiple methods for identifying your affiliate account when receiving forwarded calls. Use whichever your platform supports best.

### Method 1: SIP Headers (Recommended)

Add these headers to your forwarded calls:

| Header | Required | Description |
|--------|----------|-------------|
| `X-Affiliate-ID` | Yes | Your affiliate ID |
| `X-Campaign-ID` | Yes | The campaign ID |
| `X-Service-Type` | No | Service type override |
| `X-Forwarding-ID` | No | Full forwarding identifier |

**Alternative Header Names Supported:**
- Affiliate: `X-Affiliate-Id`, `X-AffiliateID`, `X-Aff-ID`, `X-Partner-ID`, `X-Publisher-ID`
- Campaign: `X-Campaign-Id`, `X-CampaignID`, `X-Camp-ID`, `X-Offer-ID`

### Method 2: URL Parameters

If your platform supports URL parameters on the forwarding destination:

```
+1XXXXXXXXXX?affiliate_id=your-id&campaign_id=campaign-id
```

| Parameter | Required | Description |
|-----------|----------|-------------|
| `affiliate_id` | Yes | Your affiliate ID |
| `campaign_id` | Yes | The campaign ID |
| `service_type` | No | Service type override |

**Alternative Parameter Names:**
- Affiliate: `affiliateId`, `aff_id`, `affId`, `partner_id`, `pub_id`
- Campaign: `campaignId`, `camp_id`, `campId`, `offer_id`

### Method 3: Forwarding Identifier

If you received a full forwarding identifier, you can pass it as a single value:

**SIP Header:**
```
X-Forwarding-ID: +18881234567:aff123:camp456
```

**URL Parameter:**
```
?forwarding_id=+18881234567:aff123:camp456
```

---

## Technical Details

### Ingress Number Service

Ingress numbers are managed by: `src/lib/services/ingress-number-service.ts`

Key functions:
- `isIngressNumber(phone)` - Check if a number is an ingress number
- `assignForwardingConfig(request)` - Set up forwarding for affiliate+campaign
- `lookupForwardingConfig(phone, affId, campId)` - Find forwarding config

### Forwarding Parser

Call identification is handled by: `src/lib/call/forwarding-parser.ts`

**Supported SIP Headers:**
```typescript
const SIP_HEADER_MAPPINGS = {
  affiliateId: [
    'X-Affiliate-ID', 'X-Affiliate-Id', 'X-AffiliateID',
    'X-Aff-ID', 'X-Partner-ID', 'X-Publisher-ID'
  ],
  campaignId: [
    'X-Campaign-ID', 'X-Campaign-Id', 'X-CampaignID',
    'X-Camp-ID', 'X-Offer-ID'
  ],
  serviceTypeId: ['X-Service-Type', 'X-Service-ID', 'X-Vertical'],
  forwardingId: ['X-Forwarding-ID', 'X-Forward-ID', 'X-Tracking-ID']
};
```

### Incoming Call Handler

The webhook handler at `src/app/api/calls/incoming/route.ts`:

1. Receives call from Twilio
2. Checks if target number is an ingress number
3. If yes, parses SIP headers/URL params for identification
4. Validates affiliate and campaign are active
5. Creates call record with forwarding metadata
6. Proceeds to normal auction flow

---

## Testing Your Setup

### Step 1: Verify Configuration

Use our test endpoint to verify your forwarding setup:

```bash
curl -X POST https://mycontractornow.com/api/calls/test-forwarding \
  -H "Content-Type: application/json" \
  -d '{
    "ingressNumber": "+18881234567",
    "affiliateId": "your-affiliate-id",
    "campaignId": "your-campaign-id"
  }'
```

**Successful Response:**
```json
{
  "success": true,
  "message": "Forwarding configuration verified",
  "data": {
    "affiliateName": "Your Company",
    "campaignName": "Windows Campaign",
    "serviceName": "Windows",
    "status": "ACTIVE"
  }
}
```

### Step 2: Make a Test Call

1. Use a test phone to call your Ringba/tracking number
2. Your system should forward to our ingress number
3. Check your Affiliate Dashboard > Calls for the test call
4. Verify the call shows as "Forwarded" with correct attribution

### Step 3: Check Call Details

In the call details, you should see:
- **Source**: "Forwarded Call"
- **Affiliate**: Your company name
- **Campaign**: The correct campaign
- **Forwarding Metadata**: The SIP headers or URL params received

---

## Troubleshooting

### Call Not Attributed

**Symptom:** Call arrives but shows no affiliate attribution

**Causes & Solutions:**

| Cause | Solution |
|-------|----------|
| Missing headers | Verify your platform is sending X-Affiliate-ID and X-Campaign-ID |
| Wrong header names | Use exact header names from documentation |
| Headers stripped | Some carriers strip custom headers - try URL params instead |
| Invalid IDs | Verify affiliate ID and campaign ID are correct |

**Debug Steps:**
1. Check call record's `forwardingMetadata` field in admin panel
2. Look for `sipHeaders` and `urlParams` in the metadata
3. Verify IDs match your configuration

### Call Rejected

**Symptom:** Caller hears "We're sorry, we could not process your call"

**Causes & Solutions:**

| Cause | Solution |
|-------|----------|
| Affiliate not active | Contact support to verify account status |
| Campaign not active | Check if campaign is still running |
| No forwarding config | Request forwarding setup from affiliate manager |
| Ingress number inactive | Contact support - may need different ingress number |

### Headers Not Received

**Symptom:** Headers show as empty in forwarding metadata

**Solutions:**
1. Verify your platform supports SIP header forwarding
2. Check if headers need to be explicitly enabled
3. Try URL parameter method instead
4. Contact your call tracking platform support

### Duplicate Calls

**Symptom:** Same call appears twice in dashboard

**Cause:** Your platform may be sending multiple webhook calls

**Solution:** Our system has idempotency protection via CallSid - this is likely a display issue. Contact support if you see duplicate charges.

---

## API Reference

### POST /api/affiliate/forwarding/create

Create a new forwarding configuration.

**Request:**
```json
{
  "affiliateId": "string",
  "campaignId": "string",
  "generateSipCredentials": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "ingressPhoneNumber": "+18881234567",
    "ingressPhoneNumberDisplay": "(888) 123-4567",
    "forwardingIdentifier": "+18881234567:aff123:camp456"
  }
}
```

### POST /api/affiliate/forwarding/release

Release a forwarding configuration.

**Request:**
```json
{
  "trackingNumberId": "string"
}
```

### GET /api/affiliate/forwarding/ingress-numbers

List available ingress numbers (admin only).

---

## Best Practices

### Do's

- **Test thoroughly** before going live
- **Monitor call attribution** in your first week
- **Keep credentials secure** - treat forwarding identifiers like passwords
- **Use SIP headers** when possible - more reliable than URL params
- **Document your setup** for your team

### Don'ts

- **Don't share ingress numbers** publicly - they're shared infrastructure
- **Don't modify headers** once working - consistency is key
- **Don't forward spam calls** - we have fraud detection
- **Don't exceed campaign caps** - calls may be rejected

---

## Comparison: Platform Numbers vs Forwarding

| Feature | Platform Numbers | Call Forwarding |
|---------|------------------|-----------------|
| Setup complexity | Simple | Complex |
| Cost | Number fee + per-call | Per-call only |
| Attribution reliability | 100% | 99%+ (header-dependent) |
| Analytics | Our dashboard | Your platform + ours |
| Best for | Most affiliates | High-volume pros |

---

## Getting Help

- **Affiliate Dashboard Issues**: Use the in-app chat
- **Technical Integration Help**: Email affiliate-support@mycontractornow.com
- **Billing Questions**: Contact your affiliate manager
- **Emergency (calls not routing)**: Call the affiliate support hotline

---

## Related Documentation

- [Dynamic Number Insertion](./dynamic-number-insertion.md) - DNI for landing pages
- [Affiliate Tracking Flow](../affiliate-tracking-flow.md) - Full attribution system
- [Tracking Number Service](../lead-system-flow.md) - How tracking numbers work
