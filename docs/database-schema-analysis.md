# Database Schema Analysis - Lead Buyer Structure & Auction System

## Executive Summary

This analysis examines the current database schema for the lead generation and buyer auction system. The system is built around a **Prisma SQLite database** with a sophisticated auction engine that handles lead distribution through PING/POST mechanisms.

## Current Database Schema Structure

### Core Tables

#### 1. ServiceType Table
```sql
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
  
  @@map("service_types")
}
```

**Key Features:**
- Stores service categories (roofing, windows, bathrooms, etc.)
- Contains JSON form schema for dynamic form generation
- Links to leads and buyer configurations

#### 2. Buyer Table
```sql
model Buyer {
  id          String   @id @default(uuid())
  name        String
  apiUrl      String   @map("api_url")
  authConfig  String?  @map("auth_config") // JSON field
  pingTimeout Int      @default(30) @map("ping_timeout")
  postTimeout Int      @default(60) @map("post_timeout")
  active      Boolean  @default(true)
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  serviceConfigs BuyerServiceConfig[]
  transactions   Transaction[]
  wonLeads       Lead[]
  
  @@map("buyers")
}
```

**Key Features:**
- Stores buyer API endpoints and authentication
- Contains timeout settings for PING/POST operations
- Links to service configurations and transaction history

#### 3. BuyerServiceConfig Table (Junction Table)
```sql
model BuyerServiceConfig {
  id                  String   @id @default(uuid())
  buyerId             String   @map("buyer_id")
  serviceTypeId       String   @map("service_type_id")
  pingTemplate        String   @map("ping_template") // JSON
  postTemplate        String   @map("post_template") // JSON
  fieldMappings       String   @map("field_mappings") // JSON
  requiresTrustedForm Boolean  @default(false) @map("requires_trustedform")
  requiresJornaya     Boolean  @default(false) @map("requires_jornaya")
  complianceConfig    String?  @map("compliance_config") // JSON
  minBid              Float    @default(0.00) @map("min_bid")
  maxBid              Float    @default(999.99) @map("max_bid")
  active              Boolean  @default(true)
  createdAt           DateTime @default(now()) @map("created_at")

  buyer       Buyer       @relation(fields: [buyerId], references: [id], onDelete: Cascade)
  serviceType ServiceType @relation(fields: [serviceTypeId], references: [id], onDelete: Cascade)

  @@unique([buyerId, serviceTypeId])
  @@map("buyer_service_configs")
}
```

**Key Features:**
- Many-to-many relationship between Buyers and ServiceTypes
- Contains JSON templates for PING/POST data transformation
- Stores bid range limits (minBid, maxBid)
- **Currently lacks geographic targeting capabilities**

#### 4. Lead Table
```sql
model Lead {
  id                   String    @id @default(uuid())
  serviceTypeId        String    @map("service_type_id")
  formData             String    @map("form_data") // JSON
  zipCode              String    @map("zip_code")
  ownsHome             Boolean   @map("owns_home")
  timeframe            String
  status               String    @default("PENDING")
  winningBuyerId       String?   @map("winning_buyer_id")
  winningBid           Float?    @map("winning_bid")
  // Compliance fields
  trustedFormCertUrl   String?   @map("trusted_form_cert_url")
  trustedFormCertId    String?   @map("trusted_form_cert_id")
  jornayaLeadId        String?   @map("jornaya_lead_id")
  complianceData       String?   @map("compliance_data") // JSON
  leadQualityScore     Int?      @map("lead_quality_score")
  createdAt            DateTime  @default(now()) @map("created_at")
  updatedAt            DateTime  @updatedAt @map("updated_at")

  serviceType       ServiceType           @relation(fields: [serviceTypeId], references: [id])
  winningBuyer      Buyer?                @relation(fields: [winningBuyerId], references: [id])
  transactions      Transaction[]
  complianceAudits  ComplianceAuditLog[]

  @@index([status])
  @@index([zipCode]) // Critical for geographic queries
  @@index([createdAt])
  @@map("leads")
}
```

**Key Features:**
- Stores lead data including ZIP code for geographic targeting
- Contains auction results (winning buyer/bid)
- Comprehensive compliance tracking
- **ZIP code is indexed for performance**

#### 5. Transaction Table
```sql
model Transaction {
  id                  String   @id @default(uuid())
  leadId              String   @map("lead_id")
  buyerId             String   @map("buyer_id")
  actionType          String   @map("action_type") // PING, POST
  payload             String   // JSON
  response            String?  // JSON
  status              String   // PENDING, SUCCESS, FAILED, TIMEOUT
  bidAmount           Float?   @map("bid_amount")
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
  @@map("transactions")
}
```

**Key Features:**
- Complete audit trail of all PING/POST communications
- Performance metrics (response time, bid amounts)
- Compliance tracking per transaction

## Current Lead Matching & Auction Logic

### Auction Engine Flow

#### 1. Lead Processing Pipeline
```javascript
// From workers/lead-processor.ts
async function processLead(job) {
  // 1. Update lead status to PROCESSING
  // 2. Get lead with service type and active buyers
  // 3. Run auction across all eligible buyers
  // 4. Update lead with winner and status
}
```

#### 2. Buyer Eligibility Determination
```javascript
// From lib/auction/engine.ts - getEligibleBuyers()
private static async getEligibleBuyers(lead, config) {
  // 1. Get all buyers supporting the service type
  // 2. Check compliance requirements
  // 3. Check geographic restrictions  ⚠️ BASIC IMPLEMENTATION
  // 4. Check time restrictions
  // 5. Check volume restrictions
  // 6. Return eligible buyers up to maxParticipants
}
```

#### 3. Current Geographic Restrictions (LIMITED)
```javascript
// From lib/auction/engine.ts - meetsGeoRestrictions()
private static meetsGeoRestrictions(lead, serviceConfig) {
  const restrictions = serviceConfig.restrictions?.geoRestrictions;
  
  for (const restriction of restrictions) {
    if (restriction.type === 'exclude' && restriction.zipCodes?.includes(lead.zipCode)) {
      return false; // Buyer excluded for this ZIP
    }
    if (restriction.type === 'include' && !restriction.zipCodes?.includes(lead.zipCode)) {
      return false; // Buyer only serves specific ZIPs
    }
  }
  
  return true;
}
```

**Current Limitation:** Geographic restrictions are stored in JSON within BuyerServiceConfig but lack dedicated database tables for efficient querying.

## Current Configuration Management

### Buyer Configuration Registry
```javascript
// From lib/buyers/configurations.ts
export class BuyerConfigurationRegistry {
  // In-memory configuration management
  private static configs = new Map<string, BuyerConfig>();
  private static serviceConfigs = new Map<string, Map<string, BuyerServiceConfig>>();
  
  // Key methods:
  static getBuyersForService(serviceTypeId: string): BuyerConfig[]
  static getServiceConfig(buyerId: string, serviceTypeId: string): BuyerServiceConfig
}
```

### Service Restrictions Structure
```typescript
// From lib/templates/types.ts
export interface ServiceRestrictions {
  geoRestrictions?: GeoRestriction[];
  timeRestrictions?: TimeRestriction[];
  leadVolumeLimit?: number;
  qualityThreshold?: number;
  excludeFields?: string[];
}

export interface GeoRestriction {
  type: 'include' | 'exclude';
  zipCodes?: string[]; // ⚠️ Array of ZIP codes in memory
  states?: string[];
  cities?: string[];
  radius?: {
    centerZip: string;
    miles: number;
  };
}
```

## Identified Gaps & Issues

### 1. **No Dedicated Geographic Mapping Tables**
- ZIP codes are stored as JSON arrays in configurations
- No database-level geographic relationships
- Inefficient querying for large buyer networks

### 2. **Missing Service-Type-to-ZIP-Code Mapping**
- No way to define which ZIP codes a service type serves
- All geographic logic is buyer-centric, not service-centric

### 3. **Limited Geographic Query Performance**
- ZIP code matching happens in application memory
- No spatial indexing or efficient geographic queries
- No support for radius-based matching at database level

### 4. **Configuration Complexity**
- Geographic restrictions buried in JSON configurations
- No admin interface for managing ZIP code mappings
- Difficult to audit and maintain geographic coverage

## Recommendations for Service-Type-to-ZIP-Code Mapping

### 1. **Add New Database Tables**

#### ServiceTypeZipCode Mapping Table
```sql
model ServiceTypeZipCode {
  id            String      @id @default(uuid())
  serviceTypeId String      @map("service_type_id")
  zipCode       String      @map("zip_code")
  active        Boolean     @default(true)
  priority      Int         @default(0) // For overlapping coverage
  createdAt     DateTime    @default(now()) @map("created_at")
  updatedAt     DateTime    @updatedAt @map("updated_at")

  serviceType ServiceType @relation(fields: [serviceTypeId], references: [id], onDelete: Cascade)

  @@unique([serviceTypeId, zipCode])
  @@index([zipCode])
  @@index([serviceTypeId])
  @@map("service_type_zip_codes")
}
```

#### BuyerZipCode Coverage Table
```sql
model BuyerZipCode {
  id        String   @id @default(uuid())
  buyerId   String   @map("buyer_id")
  zipCode   String   @map("zip_code")
  active    Boolean  @default(true)
  priority  Int      @default(0)
  createdAt DateTime @default(now()) @map("created_at")

  buyer Buyer @relation(fields: [buyerId], references: [id], onDelete: Cascade)

  @@unique([buyerId, zipCode])
  @@index([zipCode])
  @@index([buyerId])
  @@map("buyer_zip_codes")
}
```

### 2. **Enhanced Auction Logic**
```javascript
// New enhanced eligibility check
private static async getEligibleBuyersForZip(lead, config) {
  // 1. Check if service type serves this ZIP code
  const serviceCoversZip = await prisma.serviceTypeZipCode.findFirst({
    where: { serviceTypeId: lead.serviceTypeId, zipCode: lead.zipCode, active: true }
  });
  
  if (!serviceCoversZip) return []; // Service not available in this ZIP
  
  // 2. Get buyers who serve this ZIP code AND this service type
  const eligibleBuyers = await prisma.buyerZipCode.findMany({
    where: { zipCode: lead.zipCode, active: true },
    include: {
      buyer: {
        include: {
          serviceConfigs: {
            where: { serviceTypeId: lead.serviceTypeId, active: true }
          }
        }
      }
    }
  });
  
  return eligibleBuyers.filter(bz => 
    bz.buyer.active && bz.buyer.serviceConfigs.length > 0
  );
}
```

### 3. **Database Migration Strategy**
```sql
-- Step 1: Add new tables
-- Step 2: Migrate existing ZIP code data from JSON to tables
-- Step 3: Update auction engine to use new tables
-- Step 4: Add admin interface for managing ZIP code mappings
```

## Performance Considerations

### Current Performance Bottlenecks
1. **In-memory JSON parsing** for geographic restrictions
2. **No database-level geographic indexing**
3. **Sequential buyer evaluation** instead of filtered queries

### Proposed Performance Improvements
1. **Database-level ZIP code filtering** before auction starts
2. **Composite indexes** on (serviceTypeId, zipCode) combinations  
3. **Cached buyer eligibility** based on ZIP code patterns
4. **Bulk ZIP code operations** for admin management

## Implementation Priority

### Phase 1: Database Schema Extensions (High Priority)
- Add ServiceTypeZipCode and BuyerZipCode tables
- Create migration scripts for existing data
- Add necessary indexes for performance

### Phase 2: Auction Engine Updates (High Priority)  
- Modify getEligibleBuyers to use database queries
- Add ZIP code validation before auction processing
- Update lead processor to handle geographic filtering

### Phase 3: Admin Interface (Medium Priority)
- Create ZIP code management interface
- Add bulk import/export functionality
- Implement geographic coverage visualization

### Phase 4: Advanced Features (Low Priority)
- Radius-based geographic matching
- Geographic analytics and reporting
- Dynamic ZIP code priority adjustment

## Conclusion

The current system has a solid foundation but lacks efficient geographic targeting at the database level. The proposed service-type-to-ZIP-code mapping will:

1. **Improve Performance**: Database-level geographic filtering
2. **Enhance Flexibility**: Service-specific geographic coverage
3. **Simplify Management**: Dedicated tables instead of JSON configurations
4. **Scale Better**: Support for large buyer networks and ZIP code ranges

The implementation should prioritize database schema changes first, followed by auction engine updates to leverage the new geographic capabilities.