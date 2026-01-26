# Meta Offline Conversions (CAPI)

Server-side conversion tracking via Meta Conversions API for better ad optimization.

## Overview

When leads are submitted, we send conversion events to Meta via their Conversions API (CAPI). This provides:

- **Better matching** - Not blocked by ad blockers or browser restrictions
- **Server-side data** - Access to IP, user agent, and full customer info
- **Deduplication** - Event IDs sync with client-side pixel
- **Audit trail** - All events logged to database

## Service-Specific Event Names

Events are automatically named based on the service type:

| Service | Display Name | Meta Event Name |
|---------|--------------|-----------------|
| windows | Windows Installation | **Windows Lead** |
| bathrooms | Bathroom Remodeling | **Bathroom Lead** |
| roofing | Roofing Services | **Roofing Lead** |
| hvac | HVAC Services | **HVAC Lead** |

**Auto-adapts:** When you add a new service type, the event name is auto-generated from the first word of the display name + " Lead".

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/meta/conversion-api.ts` | CAPI service - sends events, logs to DB |
| `src/lib/meta/config.ts` | Pixel ID, access token configuration |
| `src/lib/meta/pixel.ts` | Client-side pixel helpers |
| `src/app/api/leads/route.ts:630` | Triggers CAPI on lead submission |

## Database Logging

All CAPI events are logged to `meta_capi_logs` table:

```sql
SELECT
  id,
  lead_id,
  event_name,      -- "Windows Lead", "Bathroom Lead", etc.
  service_type,    -- "windows", "bathrooms", etc.
  success,
  fbtrace_id,      -- Meta's trace ID for debugging
  events_received,
  error_message,
  created_at
FROM meta_capi_logs
ORDER BY created_at DESC;
```

### Check Recent Events

```sql
-- Last 10 events
SELECT event_name, service_type, success, fbtrace_id, created_at
FROM meta_capi_logs
ORDER BY created_at DESC
LIMIT 10;

-- Failed events
SELECT lead_id, event_name, error_message, created_at
FROM meta_capi_logs
WHERE success = false
ORDER BY created_at DESC;
```

## Data Flow

```
Lead Submitted
     ↓
/api/leads route
     ↓
trackLeadCAPI(leadId, displayName, serviceType, userData, ...)
     ↓
getServiceEventName("Windows Installation") → "Windows Lead"
     ↓
sendMetaCAPIEvent() → Meta Graph API
     ↓
logMetaCapiEvent() → meta_capi_logs table
```

## Data Sent to Meta

### User Data (PII - SHA-256 Hashed)

| Field | Meta Key | Source |
|-------|----------|--------|
| Email | `em` | Form data |
| Phone | `ph` | Form data (digits only) |
| First Name | `fn` | Form data |
| Last Name | `ln` | Form data |
| City | `ct` | Form data |
| State | `st` | Form data |
| ZIP Code | `zp` | Form data |
| Country | `country` | Defaults to "us" |
| External ID | `external_id` | Lead ID |

### User Data (NOT Hashed)

| Field | Source |
|-------|--------|
| `client_ip_address` | Request IP |
| `client_user_agent` | Request user agent |
| `fbc` | Facebook Click ID cookie |
| `fbp` | Facebook Browser ID cookie |

### Custom Data

| Field | Value |
|-------|-------|
| `currency` | "USD" |
| `value` | 50 (estimated lead value) |
| `content_name` | Service type name |
| `content_category` | "Home Services" |
| `status` | "submitted" |

## Configuration

### Environment Variables

```bash
# Required - in .env
META_ACCESS_TOKEN=your_access_token_here

# Optional - for testing
META_TEST_EVENT_CODE=TEST12345
```

### Config File (`src/lib/meta/config.ts`)

```typescript
export const META_PIXEL_ID = '215812654357251';
export const META_CAPI_BASE_URL = 'https://graph.facebook.com/v21.0';
```

## Verification

### 1. Check Meta Events Manager

1. Go to [Meta Events Manager](https://business.facebook.com/events_manager)
2. Select your Pixel
3. Look for custom events: "Windows Lead", "Bathroom Lead", etc.
4. Check match quality and event parameters

### 2. Test Event Code

Set `META_TEST_EVENT_CODE` in env to send test events:

```bash
META_TEST_EVENT_CODE=TEST12345
```

Then check the "Test Events" tab in Events Manager.

### 3. Query Database Logs

```sql
-- Verify events are being logged
SELECT * FROM meta_capi_logs
WHERE created_at > NOW() - INTERVAL '1 hour';
```

## Troubleshooting

### Events Not Appearing in Meta

1. Check `meta_capi_logs` for errors:
   ```sql
   SELECT * FROM meta_capi_logs WHERE success = false;
   ```

2. Verify access token is valid
3. Check `fbtrace_id` in Meta's debug tools

### Low Match Rate

Ensure these fields are being captured:
- Email and/or phone (most important)
- `fbc` cookie (Facebook Click ID)
- `fbp` cookie (Facebook Browser ID)

### Database Logging Failing

Check Prisma connection and `MetaCapiLog` model exists:
```bash
npx prisma db push
```

## Adding New Services

When you add a new service type to the database, CAPI events automatically adapt:

1. Add service in database with `display_name` (e.g., "Kitchen Remodeling")
2. Event name auto-generates → "Kitchen Lead"
3. No code changes required
