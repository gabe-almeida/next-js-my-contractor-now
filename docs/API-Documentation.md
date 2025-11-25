# Contractor Platform API Documentation

## Overview

The Contractor Platform API provides endpoints for lead capture, management, and distribution through an automated auction system. Built with Next.js 14, TypeScript, and Redis.

## Base URL

```
http://localhost:3000/api
```

## Authentication

### Admin Endpoints
Admin endpoints require Bearer token authentication:

```http
Authorization: Bearer your_admin_api_key
```

Set the `ADMIN_API_KEY` environment variable for authentication.

## Rate Limiting

All endpoints are rate-limited:
- **General API**: 100 requests per 15 minutes
- **Lead Submission**: 5 submissions per hour per IP
- **Admin API**: 200 requests per 15 minutes
- **Webhooks**: 1000 requests per 5 minutes
- **Service Types**: 50 requests per 5 minutes

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining in current window
- `X-RateLimit-Reset`: Unix timestamp when limit resets

## Lead Capture API

### Submit Lead

**POST** `/api/leads`

Submit a new contractor lead for processing.

#### Request Body

```json
{
  "serviceTypeId": "550e8400-e29b-41d4-a716-446655440001",
  "formData": {
    "zipCode": "90210",
    "homeOwnership": "own",
    "timeframe": "immediate",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "phone": "(555) 123-4567",
    "numberOfWindows": 5,
    "windowTypes": ["double-hung", "casement"],
    "projectScope": "replacement",
    "budget": "$5,000-$15,000"
  },
  "metadata": {
    "sessionId": "session123",
    "referrer": "https://google.com"
  }
}
```

#### Response (201 Created)

```json
{
  "success": true,
  "data": {
    "leadId": "lead-123-456",
    "status": "submitted",
    "estimatedProcessingTime": "30-60 seconds",
    "tracking": {
      "sessionId": "session123",
      "jobId": "job-789"
    }
  },
  "metadata": {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "requestId": "req_1642248600_abc123",
    "version": "1.0.0"
  }
}
```

#### Validation Rules

**Required Fields:**
- `serviceTypeId`: Valid UUID
- `zipCode`: 5-10 digit US ZIP code
- `homeOwnership`: "own" or "rent"
- `timeframe`: "immediate", "1-3months", "3-6months", or "6+months"
- `firstName`, `lastName`: 2-50 characters, letters only
- `email`: Valid email format
- `phone`: 10-15 digits

**Service-Specific Fields:**
- **Windows**: `numberOfWindows` (1-50), `windowTypes` (array), `projectScope`
- **Bathrooms**: `numberOfBathrooms` (1-10), `bathroomType`, `fixturesNeeded` (array)
- **Roofing**: `squareFootage` (500-10000), `roofType`, `projectType`

### Check Lead Status

**GET** `/api/leads?id={leadId}`

Check the processing status of a submitted lead.

#### Response

```json
{
  "success": true,
  "data": {
    "leadId": "lead-123-456",
    "status": "auctioned",
    "processingStatus": "completed",
    "submittedAt": "2024-01-15T10:30:00.000Z",
    "lastUpdated": "2024-01-15T10:32:15.000Z",
    "estimatedValue": 175
  }
}
```

#### Lead Statuses
- `pending`: Just submitted, waiting for processing
- `processing`: Currently being processed through auction
- `auctioned`: Successfully auctioned to buyers
- `sold`: Lead delivered to winning buyer
- `rejected`: No buyers accepted the lead
- `expired`: Lead expired without successful auction

## Service Types API

### Get All Service Types

**GET** `/api/service-types`

Retrieve all available service types.

#### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "name": "Windows",
      "description": "Window replacement, repair, and installation services",
      "fieldCount": 5,
      "active": true
    }
  ]
}
```

### Get Service Type Form Schema

**GET** `/api/service-types/{serviceTypeId}`

Get detailed form schema for a specific service type.

#### Response

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "name": "Windows",
    "description": "Window replacement, repair, and installation services",
    "formSchema": {
      "fields": [
        {
          "id": "zipCode",
          "name": "zipCode",
          "type": "text",
          "label": "What is your ZIP code?",
          "required": true,
          "validation": {
            "pattern": "^\\d{5}(-\\d{4})?$",
            "minLength": 5,
            "maxLength": 10
          }
        },
        {
          "id": "numberOfWindows",
          "name": "numberOfWindows",
          "type": "number",
          "label": "How many windows need work?",
          "required": true,
          "validation": {
            "min": 1,
            "max": 50
          }
        }
      ],
      "validationRules": [
        {
          "field": "numberOfWindows",
          "rule": "required|integer|min:1|max:50",
          "message": "Number of windows must be between 1 and 50"
        }
      ]
    }
  }
}
```

## Admin API

### Buyer Management

#### Get All Buyers

**GET** `/api/admin/buyers`

```http
Authorization: Bearer your_admin_api_key
```

Optional query parameters:
- `includeInactive=true`: Include inactive buyers

#### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440011",
      "name": "HomeAdvisor",
      "apiUrl": "https://api.homeadvisor.com/leads/webhook",
      "authType": "apikey",
      "active": true,
      "serviceConfigCount": 3,
      "createdAt": "2024-01-15T10:00:00.000Z",
      "updatedAt": "2024-01-15T10:00:00.000Z"
    }
  ]
}
```

#### Create New Buyer

**POST** `/api/admin/buyers`

```json
{
  "name": "New Lead Buyer",
  "apiUrl": "https://api.newbuyer.com/leads",
  "authConfig": {
    "type": "apikey",
    "credentials": {
      "apiKey": "buyer_api_key_123"
    }
  },
  "active": true
}
```

#### Get Specific Buyer

**GET** `/api/admin/buyers/{buyerId}`

#### Update Buyer

**PUT** `/api/admin/buyers/{buyerId}`

#### Delete Buyer

**DELETE** `/api/admin/buyers/{buyerId}`

### Lead Management

#### Get All Leads

**GET** `/api/admin/leads`

Query parameters:
- `page=1`: Page number (default: 1)
- `limit=50`: Results per page (max: 100)
- `status=pending`: Filter by status
- `serviceTypeId=uuid`: Filter by service type
- `startDate=2024-01-01`: Filter by date range
- `endDate=2024-01-31`: Filter by date range
- `sortBy=createdAt`: Sort field
- `sortOrder=desc`: Sort order (asc/desc)

#### Response

```json
{
  "success": true,
  "data": {
    "leads": [
      {
        "id": "lead-123",
        "serviceTypeId": "550e8400-e29b-41d4-a716-446655440001",
        "status": "sold",
        "formData": {
          "firstName": "John",
          "lastName": "Doe",
          "zipCode": "90210",
          "email": "j***e@example.com",
          "phone": "(555) ***-4567"
        },
        "metadata": {
          "zipCode": "90210",
          "estimatedValue": 175
        },
        "createdAt": "2024-01-15T10:30:00.000Z",
        "updatedAt": "2024-01-15T10:32:15.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "totalCount": 1250,
      "totalPages": 25,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

#### Get Lead Analytics

**GET** `/api/admin/leads?analytics=true&period=7d`

Period options: `24h`, `7d`, `30d`

#### Get Specific Lead

**GET** `/api/admin/leads/{leadId}`

#### Update Lead Status

**PUT** `/api/admin/leads/{leadId}`

```json
{
  "status": "rejected",
  "reason": "Admin review - duplicate submission"
}
```

## Webhook API

### Buyer Webhook

**POST** `/api/webhooks/{buyerName}`

Endpoint for buyers to send responses back to the platform.

#### Ping Response (Bid Submission)

```json
{
  "leadId": "lead-123-456",
  "action": "ping_response",
  "status": "accepted",
  "bid": 175,
  "transactionId": "tx-buyer-123"
}
```

#### Post Response (Delivery Confirmation)

```json
{
  "leadId": "lead-123-456",
  "action": "post_response",
  "status": "delivered",
  "transactionId": "tx-buyer-456"
}
```

#### Status Update

```json
{
  "leadId": "lead-123-456",
  "action": "status_update",
  "status": "contacted",
  "reason": "Customer contacted successfully"
}
```

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": {
      "errors": [
        {
          "field": "email",
          "message": "Invalid email format"
        }
      ]
    }
  },
  "metadata": {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "requestId": "req_1642248600_abc123",
    "version": "1.0.0"
  }
}
```

### Common Error Codes

- `VALIDATION_ERROR` (400): Request validation failed
- `UNAUTHORIZED` (401): Authentication required
- `FORBIDDEN` (403): Access denied
- `NOT_FOUND` (404): Resource not found
- `RATE_LIMIT_EXCEEDED` (429): Rate limit exceeded
- `INTERNAL_ERROR` (500): Server error
- `SERVICE_UNAVAILABLE` (503): Service temporarily unavailable

## Data Flow

1. **Lead Submission**: Customer submits form via `/api/leads`
2. **Validation**: Form data validated against service-specific schema
3. **Queue**: Lead added to Redis processing queue
4. **Processing**: Background worker picks up lead
5. **Auction**: Worker pings all active buyers in parallel
6. **Bidding**: Buyers respond via webhook with bids
7. **Winner**: Highest bidder wins the lead
8. **Delivery**: Lead sent to winning buyer
9. **Confirmation**: Buyer confirms receipt via webhook

## Development Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start Redis**
   ```bash
   redis-server
   ```

4. **Start Development Server**
   ```bash
   npm run dev
   ```

5. **Start Background Worker** (in separate terminal)
   ```javascript
   import { leadWorker } from './src/lib/worker';
   leadWorker.start();
   ```

## Testing

Use tools like Postman or curl to test the API:

```bash
# Submit a lead
curl -X POST http://localhost:3000/api/leads \
  -H "Content-Type: application/json" \
  -d '{
    "serviceTypeId": "550e8400-e29b-41d4-a716-446655440001",
    "formData": {
      "zipCode": "90210",
      "homeOwnership": "own",
      "timeframe": "immediate",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "phone": "5551234567",
      "numberOfWindows": 3,
      "windowTypes": ["double-hung"],
      "projectScope": "replacement"
    }
  }'

# Check lead status
curl "http://localhost:3000/api/leads?id=your_lead_id"

# Get service types
curl http://localhost:3000/api/service-types

# Admin: Get leads (requires auth)
curl -H "Authorization: Bearer your_admin_api_key" \
  "http://localhost:3000/api/admin/leads?page=1&limit=10"
```

## Security Notes

- All input is validated and sanitized
- Rate limiting prevents abuse
- Admin endpoints require authentication
- Sensitive data is masked in responses
- All requests are logged for audit
- Redis keys have appropriate TTL values

## Performance

- Redis caching for frequently accessed data
- Background processing for lead auction
- Connection pooling for external APIs
- Efficient pagination for large datasets
- Concurrent processing of buyer pings