# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-10-16-database-integration-remove-mocks/spec.md

## Technical Requirements

### 1. Database Connection Setup

- Use existing Prisma client from `@/lib/db.ts`
- Ensure proper connection pooling for API routes
- Implement error handling for database connection failures
- Add database connection health checks

### 2. API Route Conversions (8 Files)

#### Priority 1: Buyer ZIP Code Management
- **File**: `src/app/api/admin/buyers/[id]/zip-codes/route.ts`
- **Current State**: Uses in-memory `mockZipCodeMappings` array
- **Required Changes**:
  - GET: Query `BuyerServiceZipCode` with relations to `Buyer` and `ServiceType`
  - POST: Create records in `BuyerServiceZipCode` with proper foreign keys
  - PUT: Update records with Prisma `update()` or `updateMany()`
  - DELETE: Remove records with `delete()` or `deleteMany()`
  - Validate buyer exists before operations
  - Return proper error codes (404, 409, 500)

#### Priority 1: Buyer Management
- **File**: `src/app/api/admin/buyers/route.ts`
- **Current State**: Mock buyer data
- **Required Changes**:
  - GET: Query all buyers with optional filters (active, type)
  - POST: Create buyer with validation
  - Include counts of service configs and ZIP codes
  - Support pagination with skip/take

- **File**: `src/app/api/admin/buyers/[id]/route.ts`
- **Current State**: Mock single buyer
- **Required Changes**:
  - GET: Query buyer by ID with relations (serviceConfigs, serviceZipCodes)
  - PUT: Update buyer fields
  - DELETE: Cascade delete buyer and related records
  - Return 404 if not found

#### Priority 2: Lead Management
- **File**: `src/app/api/admin/leads/route.ts`
- **Current State**: Mock leads data
- **Required Changes**:
  - GET: Query leads with filters (status, dateRange, serviceType)
  - Support pagination and sorting
  - Include relations (serviceType, winningBuyer, transactions)

- **File**: `src/app/api/admin/leads/[id]/route.ts`
- **Current State**: Mock single lead
- **Required Changes**:
  - GET: Query lead by ID with full relations
  - Include all compliance data
  - Include transaction history

#### Priority 2: Service Types
- **File**: `src/app/api/service-types/[id]/route.ts`
- **Required Changes**:
  - GET: Query service type by ID
  - Return form schema and configuration

#### Priority 3: Analytics & Utilities
- **File**: `src/app/api/admin/service-zones/analytics/route.ts`
- **Required Changes**:
  - Query aggregated ZIP code statistics
  - Calculate coverage metrics from real data

- **File**: `src/app/api/admin/test-payloads/route.ts`
- **Required Changes**:
  - Query real service types for template generation
  - Generate payloads based on actual buyer configurations

### 3. Admin UI Conversions (9 Files)

#### Core Admin Pages
- **File**: `src/app/(admin)/admin/buyers/page.tsx`
- **Current State**: Uses mock buyer list
- **Required Changes**:
  - Fetch from `/api/admin/buyers`
  - Remove mock data, use real API responses
  - Handle loading and error states

- **File**: `src/app/(admin)/admin/buyers/[id]/zip-codes/page.tsx`
- **Current State**: Uses mock buyer and services
- **Required Changes**:
  - Fetch buyer from `/api/admin/buyers/[id]`
  - Fetch services from `/api/service-types`
  - Remove all mock data

- **File**: `src/app/(admin)/admin/leads/page.tsx`
- **Required Changes**:
  - Fetch from `/api/admin/leads`
  - Display real lead data with filters

- **File**: `src/app/(admin)/admin/services/page.tsx`
- **Required Changes**:
  - Fetch from `/api/service-types`
  - Display real service configurations

- **File**: `src/app/(admin)/admin/transactions/page.tsx`
- **Required Changes**:
  - Query transaction history from database
  - Display real PING/POST logs

- **File**: `src/app/(admin)/admin/analytics/page.tsx`
- **Required Changes**:
  - Calculate metrics from real database data
  - Display actual conversion rates and bid statistics

- **File**: `src/app/(admin)/admin/service-coverage/page.tsx`
- **Required Changes**:
  - Query real ZIP code coverage data
  - Generate maps from actual buyer configurations

- **File**: `src/app/(admin)/admin/page.tsx`
- **Required Changes**:
  - Dashboard statistics from real database queries
  - Recent leads and transactions from actual data

- **File**: `src/app/(admin)/layout.tsx`
- **Required Changes**:
  - Remove any mock navigation data if present

### 4. Database Seed Script

- **File**: `prisma/seed.ts`
- **Requirements**:
  - Clear existing data (in development only)
  - Create 5 realistic buyers:
    - 2 contractor networks (HomeAdvisor, Modernize)
    - 2 regional contractors (ABC Roofing, XYZ Windows)
    - 1 national network (Angi)
  - Create 4 service types:
    - Windows Installation
    - Bathroom Remodeling
    - Roofing Services
    - HVAC Services
  - Create 100+ ZIP code metadata entries (major cities)
  - Create BuyerServiceConfig for each buyer+service combination
  - Create BuyerServiceZipCode entries (50-100 total):
    - Realistic geographic distribution
    - Varied priorities (1-10)
    - Realistic bid ranges ($5-$100)
    - Daily lead caps (5-50)
  - Create 20 sample leads with varied statuses:
    - 10 SOLD leads with transactions
    - 5 PROCESSING leads
    - 5 PENDING leads
  - Create 30+ transactions showing PING/POST history
  - Create compliance audit logs for all leads
  - Include TrustedForm and Jornaya mock data

### 5. Lead Processor Worker Verification

- **File**: `src/workers/lead-processor.ts`
- **Requirements**:
  - Verify queries BuyerServiceZipCode table for buyer matching
  - Ensure ZIP code filtering works correctly
  - Confirm service type matching
  - Validate bid limit enforcement
  - Check priority sorting
  - Verify daily cap enforcement (if implemented)
  - Ensure all transactions are logged to database

### 6. Error Handling & Validation

- Prisma error handling (P2002, P2025, etc.)
- Validation using existing Zod schemas
- Proper HTTP status codes:
  - 200: Success
  - 201: Created
  - 400: Bad request/validation error
  - 404: Not found
  - 409: Conflict (duplicates)
  - 500: Server error
- User-friendly error messages
- Database connection retry logic

### 7. Performance Considerations

- Use Prisma's `select` to fetch only needed fields
- Implement proper indexes (already in schema)
- Use `include` judiciously for relations
- Consider pagination for large result sets
- Transaction grouping for bulk operations

### 8. Testing Requirements

- Unit tests for Prisma queries
- Integration tests for API endpoints
- End-to-end test scenarios:
  1. Create buyer → Add service → Configure ZIP codes → Submit lead → Verify auction
  2. Update buyer ZIP codes → Submit lead → Verify targeting changes
  3. Deactivate buyer → Submit lead → Verify excluded from auction
  4. Multiple buyers in same ZIP → Submit lead → Verify highest bidder wins
  5. Buyer outside ZIP range → Submit lead → Verify not contacted

## External Dependencies

No new external dependencies required. All necessary packages already installed:
- `@prisma/client`: 5.6.0 (already installed)
- `prisma`: 5.6.0 (already installed)
- `zod`: 3.22.4 (already installed for validation)
