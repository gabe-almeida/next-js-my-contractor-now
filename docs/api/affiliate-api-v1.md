# Affiliate API v1 Documentation

## Overview

The Affiliate API provides programmatic access to your affiliate data, including calls, leads, and performance statistics. Use this API to build custom dashboards, integrate with your systems, or automate reporting.

**Base URL:** `https://api.mycontractornow.com/api/v1/affiliate`

## Authentication

All API requests require authentication using API Key and Secret credentials.

### Getting API Credentials

1. Log in to your affiliate portal
2. Go to **Settings** > **API Access**
3. Click **Generate API Credentials**
4. Save your API Secret immediately - it will only be shown once!

### Authentication Methods

#### Method 1: Bearer Token (Recommended)

Combine your API key and secret with a colon and pass as a Bearer token:

```bash
curl -H "Authorization: Bearer mcn_live_xxxx:your_api_secret" \
  https://api.mycontractornow.com/api/v1/affiliate/stats
```

#### Method 2: Basic Auth

Base64 encode `api_key:api_secret` and use Basic authentication:

```bash
# Encode credentials
echo -n "mcn_live_xxxx:your_api_secret" | base64

curl -H "Authorization: Basic bWNuX2xpdmVfeHh4eDp5b3VyX2FwaV9zZWNyZXQ=" \
  https://api.mycontractornow.com/api/v1/affiliate/stats
```

#### Method 3: Separate Headers

Pass credentials as separate headers:

```bash
curl -H "X-API-Key: mcn_live_xxxx" \
     -H "X-API-Secret: your_api_secret" \
  https://api.mycontractornow.com/api/v1/affiliate/stats
```

### Error Responses

| Status | Error Code | Description |
|--------|------------|-------------|
| 401 | `MISSING_CREDENTIALS` | No API credentials provided |
| 401 | `INVALID_KEY_FORMAT` | API key format is incorrect |
| 401 | `INVALID_SECRET_FORMAT` | API secret format is incorrect |
| 401 | `INVALID_CREDENTIALS` | API key or secret is incorrect |
| 403 | `ACCOUNT_INACTIVE` | Your affiliate account is not active |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many requests, please slow down |

---

## Rate Limiting

API requests are rate limited to **60 requests per minute** per API key.

### Rate Limit Headers

Every response includes these headers:

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum requests per minute (60) |
| `X-RateLimit-Remaining` | Requests remaining in current window |
| `X-RateLimit-Reset` | Unix timestamp when limit resets |

### Handling Rate Limits

When you exceed the rate limit, you'll receive a `429` status code. Wait until the reset time before retrying.

```json
{
  "success": false,
  "error": "Rate limit exceeded. Please try again later.",
  "errorCode": "RATE_LIMIT_EXCEEDED"
}
```

---

## Endpoints

### GET /stats

Get aggregated performance statistics for your account.

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `period` | string | `month` | Time period: `today`, `week`, `month`, `all` |
| `from` | ISO date | - | Custom start date (overrides period) |
| `to` | ISO date | - | Custom end date (overrides period) |

#### Example Request

```bash
curl -H "Authorization: Bearer mcn_live_xxxx:your_secret" \
  "https://api.mycontractornow.com/api/v1/affiliate/stats?period=week"
```

#### Example Response

```json
{
  "success": true,
  "data": {
    "period": {
      "type": "week",
      "start": "2025-01-09T00:00:00.000Z",
      "end": null
    },
    "summary": {
      "totalEarnings": 1250.00,
      "pendingEarnings": 350.00,
      "paidEarnings": 900.00
    },
    "calls": {
      "total": 45,
      "qualified": 32,
      "qualificationRate": "71.11",
      "avgDuration": 180,
      "earnings": 960.00,
      "pendingEarnings": 240.00
    },
    "leads": {
      "total": 15,
      "converted": 10,
      "conversionRate": "66.67",
      "earnings": 290.00,
      "pendingEarnings": 110.00,
      "paidEarnings": 180.00,
      "byStatus": {
        "PENDING": { "count": 3, "amount": 90.00 },
        "APPROVED": { "count": 2, "amount": 60.00 },
        "PAID": { "count": 8, "amount": 120.00 },
        "REJECTED": { "count": 2, "amount": 0 }
      }
    },
    "campaigns": [
      {
        "campaignId": "camp_xxx",
        "campaignName": "Windows - Summer 2025",
        "serviceType": "Windows",
        "calls": 30,
        "qualifiedCalls": 22,
        "earnings": 660.00
      }
    ]
  },
  "timestamp": "2025-01-16T12:00:00.000Z"
}
```

---

### GET /calls

List your call history with filtering and pagination.

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `limit` | integer | 50 | Results per page (max 100) |
| `status` | string | - | Filter by status (comma-separated for multiple) |
| `from` | ISO date | - | Filter calls after this date |
| `to` | ISO date | - | Filter calls before this date |
| `campaignId` | string | - | Filter by campaign ID |
| `qualified` | boolean | - | Filter by qualified status |

#### Valid Status Values

- `RINGING` - Call ringing
- `IVR` - In IVR qualification
- `BIDDING` - Auction in progress
- `CONNECTING` - Connecting to buyer
- `CASCADING` - Trying next buyer
- `CONNECTED` - Connected to buyer
- `COMPLETED` - Call completed normally
- `FAILED` - Call failed
- `REJECTED` - Caller disqualified
- `CALLER_HANGUP` - Caller hung up
- `NO_BIDS` - No buyers available
- `NO_ANSWER` - Buyer didn't answer

#### Example Request

```bash
curl -H "Authorization: Bearer mcn_live_xxxx:your_secret" \
  "https://api.mycontractornow.com/api/v1/affiliate/calls?status=COMPLETED&qualified=true&limit=10"
```

#### Example Response

```json
{
  "success": true,
  "data": {
    "calls": [
      {
        "id": "call_xxx",
        "callSid": "CA123abc...",
        "caller": {
          "phone": "***-***-1234",
          "city": "Los Angeles",
          "state": "CA",
          "zip": "90210"
        },
        "trackingNumber": {
          "id": "tn_xxx",
          "number": "+18445551234",
          "display": "(844) 555-1234"
        },
        "campaign": {
          "id": "camp_xxx",
          "name": "Windows - Summer 2025",
          "serviceType": {
            "id": "st_xxx",
            "name": "windows",
            "displayName": "Windows"
          }
        },
        "status": "COMPLETED",
        "isQualified": true,
        "isBillable": true,
        "duration": {
          "total": 245,
          "connected": 180
        },
        "disposition": "ANSWERED",
        "payout": 30.00,
        "postbackSent": true,
        "timestamps": {
          "started": "2025-01-16T10:30:00.000Z",
          "ended": "2025-01-16T10:34:05.000Z"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 45,
      "totalPages": 5,
      "hasMore": true
    }
  },
  "timestamp": "2025-01-16T12:00:00.000Z"
}
```

---

### GET /leads

List your lead commissions with filtering and pagination.

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `limit` | integer | 50 | Results per page (max 100) |
| `status` | string | - | Filter by commission status |
| `from` | ISO date | - | Filter leads after this date |
| `to` | ISO date | - | Filter leads before this date |

#### Valid Commission Status Values

- `PENDING` - Awaiting review
- `APPROVED` - Approved, awaiting payment
- `PAID` - Commission paid
- `REJECTED` - Commission rejected

#### Example Request

```bash
curl -H "Authorization: Bearer mcn_live_xxxx:your_secret" \
  "https://api.mycontractornow.com/api/v1/affiliate/leads?status=PAID&limit=10"
```

#### Example Response

```json
{
  "success": true,
  "data": {
    "leads": [
      {
        "id": "comm_xxx",
        "leadId": "lead_xxx",
        "commission": {
          "amount": 35.00,
          "rate": 0.10,
          "status": "PAID"
        },
        "lead": {
          "id": "lead_xxx",
          "zipCode": "90210",
          "status": "SOLD",
          "serviceType": {
            "id": "st_xxx",
            "name": "windows",
            "displayName": "Windows"
          },
          "submittedAt": "2025-01-10T14:30:00.000Z"
        },
        "timestamps": {
          "created": "2025-01-10T14:30:05.000Z",
          "approved": "2025-01-11T09:00:00.000Z",
          "paid": "2025-01-15T12:00:00.000Z",
          "rejected": null
        },
        "rejectReason": null
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "totalPages": 3,
      "hasMore": true
    }
  },
  "timestamp": "2025-01-16T12:00:00.000Z"
}
```

---

## Code Examples

### Python

```python
import requests
from base64 import b64encode

API_KEY = "mcn_live_xxxx"
API_SECRET = "your_api_secret"
BASE_URL = "https://api.mycontractornow.com/api/v1/affiliate"

# Using Bearer token
headers = {
    "Authorization": f"Bearer {API_KEY}:{API_SECRET}"
}

# Get stats
response = requests.get(f"{BASE_URL}/stats?period=week", headers=headers)
stats = response.json()

print(f"Total Earnings: ${stats['data']['summary']['totalEarnings']}")
print(f"Qualified Calls: {stats['data']['calls']['qualified']}")
```

### JavaScript/Node.js

```javascript
const API_KEY = 'mcn_live_xxxx';
const API_SECRET = 'your_api_secret';
const BASE_URL = 'https://api.mycontractornow.com/api/v1/affiliate';

async function getStats() {
  const response = await fetch(`${BASE_URL}/stats?period=week`, {
    headers: {
      'Authorization': `Bearer ${API_KEY}:${API_SECRET}`
    }
  });

  const data = await response.json();
  console.log('Total Earnings:', data.data.summary.totalEarnings);
  return data;
}

// With pagination
async function getAllCalls() {
  let page = 1;
  let allCalls = [];
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(
      `${BASE_URL}/calls?page=${page}&limit=100&qualified=true`,
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}:${API_SECRET}`
        }
      }
    );

    const data = await response.json();
    allCalls = allCalls.concat(data.data.calls);
    hasMore = data.data.pagination.hasMore;
    page++;
  }

  return allCalls;
}
```

### PHP

```php
<?php

$apiKey = 'mcn_live_xxxx';
$apiSecret = 'your_api_secret';
$baseUrl = 'https://api.mycontractornow.com/api/v1/affiliate';

$headers = [
    'Authorization: Bearer ' . $apiKey . ':' . $apiSecret
];

$ch = curl_init($baseUrl . '/stats?period=month');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

$response = curl_exec($ch);
$data = json_decode($response, true);

echo "Total Earnings: $" . $data['data']['summary']['totalEarnings'];
```

---

## Webhooks / Postbacks

Instead of polling the API, you can configure postback URLs to receive real-time notifications when calls are completed.

See [Postback Configuration](/affiliate/settings) in your affiliate portal.

### Postback Payload

```json
{
  "event": "call.completed",
  "timestamp": "2025-01-16T12:00:00.000Z",
  "call": {
    "id": "call_xxx",
    "callSid": "CA123abc...",
    "campaignId": "camp_xxx",
    "status": "COMPLETED",
    "isQualified": true,
    "isBillable": true,
    "duration": 180,
    "payout": 30.00
  }
}
```

---

## Support

If you have questions about the API, please contact:

- **Email:** affiliates@mycontractornow.com
- **Documentation:** https://docs.mycontractornow.com/affiliate-api
