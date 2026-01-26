# API Specification

This is the API specification for the spec detailed in @.agent-os/specs/2025-10-16-database-integration-remove-mocks/spec.md

## Endpoints

### Buyer ZIP Code Management

#### GET /api/admin/buyers/[id]/zip-codes

**Purpose:** Retrieve all ZIP code configurations for a specific buyer, grouped by service type

**Parameters:**
- `id` (path): Buyer UUID
- `serviceTypeId` (query, optional): Filter by specific service type
- `includeInactive` (query, optional): Include inactive ZIP codes (default: false)

**Database Query:**
```typescript
const zipCodes = await prisma.buyerServiceZipCode.findMany({
  where: {
    buyerId: id,
    ...(serviceTypeId && { serviceTypeId }),
    ...(includeInactive ? {} : { active: true })
  },
  include: {
    serviceType: {
      select: { id: true, name: true, displayName: true }
    }
  },
  orderBy: [
    { serviceTypeId: 'asc' },
    { priority: 'desc' }
  ]
})
```

**Response Format:**
```json
{
  "success": true,
  "data": [
    {
      "serviceTypeId": "service-uuid",
      "serviceName": "Windows Installation",
      "zipCodes": [
        {
          "id": "zip-uuid",
          "zipCode": "90210",
          "active": true,
          "priority": 8,
          "maxLeadsPerDay": 10,
          "minBid": 15.00,
          "maxBid": 50.00,
          "createdAt": "2025-10-16T10:00:00Z",
          "updatedAt": "2025-10-16T10:00:00Z"
        }
      ]
    }
  ],
  "meta": {
    "totalZipCodes": 15,
    "activeZipCodes": 12,
    "serviceTypes": 3
  }
}
```

**Errors:**
- 400: Invalid buyer ID format
- 404: Buyer not found
- 500: Database error

---

#### POST /api/admin/buyers/[id]/zip-codes

**Purpose:** Add new ZIP codes for a buyer's service type

**Parameters:**
- `id` (path): Buyer UUID

**Request Body:**
```json
{
  "serviceTypeId": "service-uuid",
  "zipCodes": ["90210", "90211", "90212"],
  "priority": 5,
  "maxLeadsPerDay": 10,
  "minBid": 10.00,
  "maxBid": 50.00
}
```

**Database Operations:**
```typescript
// 1. Verify buyer exists
const buyer = await prisma.buyer.findUnique({ where: { id } })

// 2. Check for duplicates
const existing = await prisma.buyerServiceZipCode.findMany({
  where: {
    buyerId: id,
    serviceTypeId,
    zipCode: { in: zipCodes }
  }
})

// 3. Create new entries
const created = await prisma.buyerServiceZipCode.createMany({
  data: zipCodes.map(zipCode => ({
    buyerId: id,
    serviceTypeId,
    zipCode,
    priority,
    maxLeadsPerDay,
    minBid,
    maxBid,
    active: true
  }))
})
```

**Response Format:**
```json
{
  "success": true,
  "data": [
    {
      "id": "zip-uuid",
      "zipCode": "90210",
      "active": true,
      "priority": 5,
      "maxLeadsPerDay": 10,
      "createdAt": "2025-10-16T10:00:00Z"
    }
  ],
  "message": "Successfully added 3 zip code(s)"
}
```

**Errors:**
- 400: Validation error (invalid format, missing required fields)
- 404: Buyer or service type not found
- 409: Duplicate ZIP codes already exist for this buyer+service
- 500: Database error

---

#### PUT /api/admin/buyers/[id]/zip-codes

**Purpose:** Bulk update ZIP code configurations

**Parameters:**
- `id` (path): Buyer UUID

**Request Body:**
```json
{
  "zipCodeIds": ["zip-uuid-1", "zip-uuid-2"],
  "updates": {
    "active": false,
    "priority": 7,
    "maxLeadsPerDay": 15
  }
}
```

**Database Query:**
```typescript
const updated = await prisma.buyerServiceZipCode.updateMany({
  where: {
    id: { in: zipCodeIds },
    buyerId: id  // Security: ensure belongs to this buyer
  },
  data: updates
})
```

**Response Format:**
```json
{
  "success": true,
  "message": "Successfully updated 2 zip code(s)",
  "updatedCount": 2
}
```

**Errors:**
- 400: Validation error
- 404: No matching ZIP codes found
- 500: Database error

---

#### DELETE /api/admin/buyers/[id]/zip-codes

**Purpose:** Remove ZIP code configurations

**Parameters:**
- `id` (path): Buyer UUID
- `ids` (query): Comma-separated ZIP code IDs

**Database Query:**
```typescript
const deleted = await prisma.buyerServiceZipCode.deleteMany({
  where: {
    id: { in: zipCodeIds },
    buyerId: id  // Security: ensure belongs to this buyer
  }
})
```

**Response Format:**
```json
{
  "success": true,
  "message": "Successfully removed 2 zip code(s)",
  "deletedCount": 2
}
```

**Errors:**
- 400: No IDs provided
- 500: Database error

---

### Buyer Management

#### GET /api/admin/buyers

**Purpose:** List all buyers with pagination and filtering

**Parameters:**
- `page` (query, optional): Page number (default: 1)
- `limit` (query, optional): Results per page (default: 20)
- `active` (query, optional): Filter by active status
- `type` (query, optional): Filter by buyer type (CONTRACTOR, NETWORK)
- `search` (query, optional): Search by name

**Database Query:**
```typescript
const buyers = await prisma.buyer.findMany({
  where: {
    ...(active !== undefined && { active }),
    ...(type && { type }),
    ...(search && {
      name: { contains: search, mode: 'insensitive' }
    })
  },
  include: {
    _count: {
      select: {
        serviceConfigs: true,
        serviceZipCodes: true,
        wonLeads: true
      }
    }
  },
  skip: (page - 1) * limit,
  take: limit,
  orderBy: { createdAt: 'desc' }
})

const total = await prisma.buyer.count({ where })
```

**Response Format:**
```json
{
  "success": true,
  "data": [
    {
      "id": "buyer-uuid",
      "name": "HomeAdvisor",
      "type": "NETWORK",
      "apiUrl": "https://api.homeadvisor.com/leads",
      "active": true,
      "contactEmail": "leads@homeadvisor.com",
      "contactPhone": "1-800-123-4567",
      "createdAt": "2025-01-01T00:00:00Z",
      "_count": {
        "serviceConfigs": 4,
        "serviceZipCodes": 127,
        "wonLeads": 45
      }
    }
  ],
  "meta": {
    "total": 5,
    "page": 1,
    "limit": 20,
    "pages": 1
  }
}
```

---

#### POST /api/admin/buyers

**Purpose:** Create a new buyer

**Request Body:**
```json
{
  "name": "ABC Contractors",
  "type": "CONTRACTOR",
  "apiUrl": "https://api.abccontractors.com/leads",
  "authConfig": "{\"type\":\"bearer\",\"token\":\"...\"}",
  "pingTimeout": 30,
  "postTimeout": 60,
  "contactName": "John Smith",
  "contactEmail": "john@abccontractors.com",
  "contactPhone": "555-123-4567"
}
```

**Database Query:**
```typescript
const buyer = await prisma.buyer.create({
  data: {
    name,
    type,
    apiUrl,
    authConfig,
    pingTimeout,
    postTimeout,
    contactName,
    contactEmail,
    contactPhone,
    active: true
  }
})
```

**Response:** 201 Created with buyer object

---

#### GET /api/admin/buyers/[id]

**Purpose:** Get detailed buyer information

**Database Query:**
```typescript
const buyer = await prisma.buyer.findUnique({
  where: { id },
  include: {
    serviceConfigs: {
      include: {
        serviceType: {
          select: { id: true, name: true, displayName: true }
        }
      }
    },
    serviceZipCodes: {
      include: {
        serviceType: {
          select: { name: true, displayName: true }
        }
      },
      orderBy: { priority: 'desc' },
      take: 100  // Limit for performance
    },
    _count: {
      select: {
        wonLeads: true,
        transactions: true
      }
    }
  }
})
```

**Response:** Full buyer object with relations

---

#### PUT /api/admin/buyers/[id]

**Purpose:** Update buyer information

**Request Body:** Partial buyer object

**Database Query:**
```typescript
const buyer = await prisma.buyer.update({
  where: { id },
  data: updateData
})
```

**Response:** Updated buyer object

---

#### DELETE /api/admin/buyers/[id]

**Purpose:** Delete buyer (cascade deletes configs and ZIP codes)

**Database Query:**
```typescript
const buyer = await prisma.buyer.delete({
  where: { id }
})
```

**Response:** 204 No Content

---

### Lead Management

#### GET /api/admin/leads

**Purpose:** List leads with filtering and pagination

**Parameters:**
- `page`, `limit`: Pagination
- `status`: Filter by status (PENDING, PROCESSING, SOLD, REJECTED)
- `serviceTypeId`: Filter by service type
- `startDate`, `endDate`: Date range filter
- `zipCode`: Filter by ZIP code

**Database Query:**
```typescript
const leads = await prisma.lead.findMany({
  where: {
    ...(status && { status }),
    ...(serviceTypeId && { serviceTypeId }),
    ...(zipCode && { zipCode }),
    ...(startDate && {
      createdAt: {
        gte: new Date(startDate),
        ...(endDate && { lte: new Date(endDate) })
      }
    })
  },
  include: {
    serviceType: {
      select: { name: true, displayName: true }
    },
    winningBuyer: {
      select: { id: true, name: true }
    },
    _count: {
      select: { transactions: true }
    }
  },
  skip: (page - 1) * limit,
  take: limit,
  orderBy: { createdAt: 'desc' }
})
```

**Response:** Paginated lead list with relations

---

#### GET /api/admin/leads/[id]

**Purpose:** Get detailed lead information with transaction history

**Database Query:**
```typescript
const lead = await prisma.lead.findUnique({
  where: { id },
  include: {
    serviceType: true,
    winningBuyer: true,
    transactions: {
      include: {
        buyer: {
          select: { id: true, name: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    },
    complianceAudits: {
      orderBy: { createdAt: 'asc' }
    }
  }
})
```

**Response:** Full lead object with all relations

---

### Service Types

#### GET /api/service-types

**Purpose:** List all active service types

**Database Query:**
```typescript
const serviceTypes = await prisma.serviceType.findMany({
  where: { active: true },
  select: {
    id: true,
    name: true,
    displayName: true,
    formSchema: true,
    _count: {
      select: { leads: true }
    }
  },
  orderBy: { displayName: 'asc' }
})
```

---

#### GET /api/service-types/[id]

**Purpose:** Get service type details and form schema

**Database Query:**
```typescript
const serviceType = await prisma.serviceType.findUnique({
  where: { id },
  include: {
    _count: {
      select: {
        leads: true,
        buyerServiceConfigs: true
      }
    }
  }
})
```

---

### Analytics

#### GET /api/admin/service-zones/analytics

**Purpose:** Get ZIP code coverage analytics

**Database Query:**
```typescript
// Aggregate stats by service type
const stats = await prisma.buyerServiceZipCode.groupBy({
  by: ['serviceTypeId'],
  _count: {
    zipCode: true
  },
  _sum: {
    maxLeadsPerDay: true
  },
  where: { active: true }
})

// Get unique ZIP counts per service
const uniqueZips = await prisma.buyerServiceZipCode.findMany({
  where: { active: true },
  select: {
    serviceTypeId: true,
    zipCode: true
  },
  distinct: ['serviceTypeId', 'zipCode']
})
```

**Response:** Coverage statistics and metrics

---

## Error Handling Standards

All endpoints should follow this error response format:

```json
{
  "success": false,
  "error": "Error type",
  "message": "User-friendly error message",
  "details": []  // Optional validation errors
}
```

### Prisma Error Mapping

- `P2002`: Unique constraint violation → 409 Conflict
- `P2025`: Record not found → 404 Not Found
- `P2003`: Foreign key constraint → 400 Bad Request
- Connection errors → 500 Server Error with retry suggestion
