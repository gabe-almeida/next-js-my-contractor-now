# Database Schema

This is the database schema implementation for the spec detailed in @.agent-os/specs/2025-10-16-database-integration-remove-mocks/spec.md

## Existing Schema (No Changes Required)

The current Prisma schema is fully compatible with all requirements. No schema modifications are needed.

### Relevant Models

#### Buyer Model
```prisma
model Buyer {
  id          String    @id @default(uuid())
  name        String
  type        String    @default("CONTRACTOR") // CONTRACTOR or NETWORK
  apiUrl      String    @map("api_url")
  authConfig  String?   @map("auth_config")
  pingTimeout Int       @default(30) @map("ping_timeout")
  postTimeout Int       @default(60) @map("post_timeout")
  active      Boolean   @default(true)

  // Contact Information
  contactName       String?  @map("contact_name")
  contactEmail      String?  @map("contact_email")
  contactPhone      String?  @map("contact_phone")
  businessEmail     String?  @map("business_email")
  businessPhone     String?  @map("business_phone")
  additionalEmails  String?  @map("additional_emails") // JSON array
  additionalPhones  String?  @map("additional_phones") // JSON array
  additionalContacts String? @map("additional_contacts") // JSON array

  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  serviceConfigs       BuyerServiceConfig[]
  serviceZipCodes      BuyerServiceZipCode[]
  transactions         Transaction[]
  wonLeads             Lead[]
}
```

**Usage:** Stores buyer profiles with API configuration and contact details.

---

#### BuyerServiceConfig Model
```prisma
model BuyerServiceConfig {
  id                  String   @id @default(uuid())
  buyerId             String   @map("buyer_id")
  serviceTypeId       String   @map("service_type_id")
  pingTemplate        String     @map("ping_template")
  postTemplate        String     @map("post_template")
  fieldMappings       String     @map("field_mappings")
  requiresTrustedForm Boolean  @default(false) @map("requires_trustedform")
  requiresJornaya     Boolean  @default(false) @map("requires_jornaya")
  complianceConfig    String?    @map("compliance_config")
  minBid              Float  @default(0.00) @map("min_bid")
  maxBid              Float  @default(999.99) @map("max_bid")
  active              Boolean  @default(true)
  createdAt           DateTime @default(now()) @map("created_at")

  buyer       Buyer       @relation(fields: [buyerId], references: [id], onDelete: Cascade)
  serviceType ServiceType @relation(fields: [serviceTypeId], references: [id], onDelete: Cascade)

  @@unique([buyerId, serviceTypeId])
}
```

**Usage:** Defines which services each buyer accepts and their field mappings.

---

#### BuyerServiceZipCode Model (PRIMARY FOCUS)
```prisma
model BuyerServiceZipCode {
  id            String   @id @default(uuid())
  buyerId       String   @map("buyer_id")
  serviceTypeId String   @map("service_type_id")
  zipCode       String   @map("zip_code")
  active        Boolean  @default(true)
  priority      Int      @default(100)
  maxLeadsPerDay Int?    @map("max_leads_per_day")
  minBid        Float?   @map("min_bid")
  maxBid        Float?   @map("max_bid")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  buyer       Buyer       @relation(fields: [buyerId], references: [id], onDelete: Cascade)
  serviceType ServiceType @relation(fields: [serviceTypeId], references: [id], onDelete: Cascade)

  @@unique([buyerId, serviceTypeId, zipCode])
  @@index([buyerId, serviceTypeId])
  @@index([serviceTypeId, zipCode])
  @@index([zipCode])
  @@index([active])
}
```

**Usage:** Granular ZIP code targeting per buyer per service type. This is the core table for geographic targeting.

**Key Features:**
- Unique constraint prevents duplicate buyer+service+ZIP combinations
- Cascade delete ensures cleanup when buyer is removed
- Indexes optimize auction system queries
- Priority field allows preferential buyer selection
- Min/max bid overrides per ZIP allow fine-tuned pricing

---

#### ServiceType Model
```prisma
model ServiceType {
  id          String   @id @default(uuid())
  name        String   @unique
  displayName String   @map("display_name")
  formSchema  String   @map("form_schema")
  active      Boolean  @default(true)
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  leads               Lead[]
  buyerServiceConfigs BuyerServiceConfig[]
  buyerServiceZipCodes BuyerServiceZipCode[]
}
```

**Usage:** Defines available service categories with dynamic form schemas.

---

#### Lead Model
```prisma
model Lead {
  id                   String    @id @default(uuid())
  serviceTypeId        String    @map("service_type_id")
  formData             String      @map("form_data")
  zipCode              String    @map("zip_code")
  ownsHome             Boolean   @map("owns_home")
  timeframe            String
  status               String    @default("PENDING")
  winningBuyerId       String?   @map("winning_buyer_id")
  winningBid           Float?  @map("winning_bid")
  // Compliance fields
  trustedFormCertUrl   String?   @map("trusted_form_cert_url")
  trustedFormCertId    String?   @map("trusted_form_cert_id")
  jornayaLeadId        String?   @map("jornaya_lead_id")
  complianceData       String?     @map("compliance_data")
  leadQualityScore     Int?      @map("lead_quality_score")
  createdAt            DateTime  @default(now()) @map("created_at")
  updatedAt            DateTime  @updatedAt @map("updated_at")

  serviceType       ServiceType           @relation(fields: [serviceTypeId], references: [id])
  winningBuyer      Buyer?                @relation(fields: [winningBuyerId], references: [id])
  transactions      Transaction[]
  complianceAudits  ComplianceAuditLog[]

  @@index([status])
  @@index([zipCode])
  @@index([createdAt])
}
```

**Usage:** Stores lead submissions with compliance tracking and auction results.

---

#### Transaction Model
```prisma
model Transaction {
  id                  String   @id @default(uuid())
  leadId              String   @map("lead_id")
  buyerId             String   @map("buyer_id")
  actionType          String   @map("action_type") // PING, POST
  payload             String
  response            String?
  status              String   // PENDING, SUCCESS, FAILED, TIMEOUT
  bidAmount           Float? @map("bid_amount")
  responseTime        Int?     @map("response_time") // milliseconds
  errorMessage        String?  @map("error_message")
  complianceIncluded  Boolean  @default(false) @map("compliance_included")
  trustedFormPresent  Boolean  @default(false) @map("trusted_form_present")
  jornayaPresent      Boolean  @default(false) @map("jornaya_present")
  createdAt           DateTime @default(now()) @map("created_at")

  lead  Lead  @relation(fields: [leadId], references: [id], onDelete: Cascade)
  buyer Buyer @relation(fields: [buyerId], references: [id])

  @@index([leadId])
  @@index([actionType])
  @@index([status])
}
```

**Usage:** Complete audit trail of all PING/POST requests to buyers.

---

#### ZipCodeMetadata Model
```prisma
model ZipCodeMetadata {
  zipCode   String @id @map("zip_code")
  city      String
  state     String
  county    String?
  latitude  Float?
  longitude Float?
  timezone  String?
  active    Boolean @default(true)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@index([state])
  @@index([city, state])
}
```

**Usage:** Geographic metadata for ZIP codes used in admin UI and analytics.

---

## Database Seed Data Requirements

### Service Types (4 required)
```typescript
[
  {
    name: "windows",
    displayName: "Windows Installation",
    formSchema: "{ /* JSON form schema */ }",
    active: true
  },
  {
    name: "bathrooms",
    displayName: "Bathroom Remodeling",
    formSchema: "{ /* JSON form schema */ }",
    active: true
  },
  {
    name: "roofing",
    displayName: "Roofing Services",
    formSchema: "{ /* JSON form schema */ }",
    active: true
  },
  {
    name: "hvac",
    displayName: "HVAC Services",
    formSchema: "{ /* JSON form schema */ }",
    active: true
  }
]
```

### Buyers (5 required)
```typescript
[
  {
    name: "HomeAdvisor",
    type: "NETWORK",
    apiUrl: "https://api.homeadvisor.com/leads",
    contactEmail: "leads@homeadvisor.com",
    active: true
  },
  {
    name: "Modernize",
    type: "NETWORK",
    apiUrl: "https://api.modernize.com/leads",
    contactEmail: "integration@modernize.com",
    active: true
  },
  {
    name: "ABC Roofing",
    type: "CONTRACTOR",
    apiUrl: "https://api.abcroofing.com/leads",
    contactEmail: "leads@abcroofing.com",
    active: true
  },
  {
    name: "XYZ Windows",
    type: "CONTRACTOR",
    apiUrl: "https://api.xyzwindows.com/leads",
    contactEmail: "api@xyzwindows.com",
    active: true
  },
  {
    name: "Angi",
    type: "NETWORK",
    apiUrl: "https://api.angi.com/leads",
    contactEmail: "partners@angi.com",
    active: true
  }
]
```

### ZIP Code Metadata (100+ required)
Major US cities covering:
- California: 90210, 90211, 94102, 94103, 90001-90010
- New York: 10001-10020
- Texas: 75201-75210, 77001-77010
- Florida: 33101-33110, 32801-32810
- Illinois: 60601-60610

### BuyerServiceConfig (20 required)
Each buyer should have configs for 4 service types with:
- Realistic PING/POST templates
- Field mappings as JSON
- Bid ranges: $5-$100
- TrustedForm/Jornaya requirements

### BuyerServiceZipCode (50-100 required)
Geographic distribution:
- HomeAdvisor: National coverage (all 100 ZIPs, priority 5-7)
- Modernize: Major metro areas (50 ZIPs, priority 6-8)
- ABC Roofing: California only (20 ZIPs, priority 9-10)
- XYZ Windows: California + New York (30 ZIPs, priority 8-9)
- Angi: National coverage (all 100 ZIPs, priority 4-6)

### Sample Leads (20 required)
- 10 SOLD leads with winning buyers and bids
- 5 PROCESSING leads (in queue)
- 5 PENDING leads (not yet processed)
- Mix of service types and ZIP codes
- Include compliance data

### Transactions (30+ required)
For each SOLD lead, create:
- Multiple PING transactions (one per qualified buyer)
- One successful POST transaction to winner
- Realistic response times (100-500ms for PING, 500-2000ms for POST)
- Mix of SUCCESS and FAILED statuses

---

## Query Performance Considerations

### Critical Indexes (Already in Schema)
The existing indexes are optimized for auction queries:

```prisma
// BuyerServiceZipCode indexes
@@index([buyerId, serviceTypeId])     // Buyer config lookup
@@index([serviceTypeId, zipCode])     // Auction matching
@@index([zipCode])                    // Geographic search
@@index([active])                     // Active filtering
```

These indexes support the critical auction query:
```typescript
const qualifiedBuyers = await prisma.buyerServiceZipCode.findMany({
  where: {
    serviceTypeId: lead.serviceTypeId,
    zipCode: lead.zipCode,
    active: true
  },
  include: {
    buyer: {
      where: { active: true }
    }
  },
  orderBy: { priority: 'desc' }
})
```

### Expected Query Performance
- Auction buyer matching: < 50ms
- ZIP code listing: < 100ms
- Lead history: < 200ms
- Analytics aggregation: < 500ms

---

## Migration Strategy

No database migrations required - schema is already complete. Implementation steps:

1. **Run Prisma generate**
   ```bash
   npm run db:generate
   ```

2. **Push schema to database** (if not already done)
   ```bash
   npm run db:push
   ```

3. **Run seed script**
   ```bash
   npm run db:seed
   ```

4. **Verify data**
   ```bash
   npm run db:studio
   ```

---

## Data Integrity Rules

### Cascade Deletes
- Deleting a Buyer cascades to:
  - BuyerServiceConfig
  - BuyerServiceZipCode
  - (Transactions are preserved for audit trail)

### Unique Constraints
- `Buyer`: name is not unique (multiple "ABC Contractors" allowed)
- `ServiceType.name`: Must be unique
- `BuyerServiceConfig`: One config per buyer+service combination
- `BuyerServiceZipCode`: One entry per buyer+service+ZIP combination

### Foreign Key Constraints
- All foreign keys enforce referential integrity
- Cannot create BuyerServiceZipCode without valid buyer and service type
- Cannot delete service type if buyers are configured for it (constraint error)

---

## Testing Data Validation

After seeding, verify:
```sql
-- Check buyer count
SELECT COUNT(*) FROM buyers; -- Should be 5

-- Check service types
SELECT COUNT(*) FROM service_types; -- Should be 4

-- Check ZIP configurations
SELECT COUNT(*) FROM buyer_service_zip_codes; -- Should be 50-100

-- Check lead distribution
SELECT
  b.name,
  COUNT(l.id) as leads_won
FROM buyers b
LEFT JOIN leads l ON l.winning_buyer_id = b.id
GROUP BY b.id, b.name;

-- Verify geographic coverage
SELECT
  st.display_name,
  COUNT(DISTINCT bsz.zip_code) as unique_zips
FROM service_types st
JOIN buyer_service_zip_codes bsz ON bsz.service_type_id = st.id
WHERE bsz.active = true
GROUP BY st.id, st.display_name;
```
