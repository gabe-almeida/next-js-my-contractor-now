# Service Zone Management

This directory contains the service zone management system for precise lead buyer geographic targeting.

## Quick Start

### 1. Database Setup
The database schema includes the necessary tables. To seed with sample data, run the migration:

```bash
npx prisma db push
# Sample data will be automatically inserted
```

### 2. Basic Usage

```typescript
import { BuyerEligibilityService } from './buyer-eligibility-service';

// Get eligible buyers for a specific location and service
const eligibility = await BuyerEligibilityService.getEligibleBuyers({
  serviceTypeId: 'windows-service-id',
  zipCode: '90210',
  maxParticipants: 5
});

console.log(`${eligibility.eligibleCount} buyers eligible for windows in 90210`);
```

### 3. Service Zone Management

```typescript
import { ServiceZoneRepository } from '../repositories/service-zone-repository';

// Create a service zone
const serviceZone = await ServiceZoneRepository.create({
  buyerId: 'buyer-id',
  serviceTypeId: 'service-id', 
  zipCode: '90210',
  priority: 95,
  maxLeadsPerDay: 50,
  minBid: 25,
  maxBid: 150
});

// Bulk create multiple zones
const bulkZones = await ServiceZoneRepository.createBulk({
  buyerId: 'buyer-id',
  serviceTypeId: 'service-id',
  zipCodes: ['90210', '90211', '90212'],
  priority: 90
});
```

### 4. API Endpoints

The system provides RESTful APIs for service zone management:

- `GET /api/admin/service-zones` - List service zones
- `POST /api/admin/service-zones` - Create service zones (single or bulk)
- `PUT /api/admin/service-zones/{id}` - Update service zone
- `DELETE /api/admin/service-zones/{id}` - Delete service zone
- `GET /api/admin/service-zones/analytics` - Coverage analytics

## Architecture

### Core Components

1. **ServiceZoneRepository** - Data access layer with caching
2. **BuyerEligibilityService** - Business logic for buyer selection
3. **Validation Layer** - Comprehensive input validation
4. **API Controllers** - RESTful endpoints with authentication

### Integration Points

- **Auction Engine** - Enhanced buyer eligibility filtering
- **Redis Cache** - Performance optimization for frequent queries  
- **Prisma ORM** - Database access with type safety
- **Admin APIs** - Management interface for service zones

## Key Features

- **Precise Geographic Targeting** - ZIP code level service coverage
- **Multi-factor Scoring** - Intelligent buyer ranking algorithm
- **Performance Optimized** - Redis caching and optimized queries
- **Bulk Operations** - Efficient management of large service zone datasets
- **Comprehensive Analytics** - Coverage insights and performance metrics
- **Backward Compatible** - Seamless integration with existing auction system

## Data Model

### BuyerServiceZipCode
- Maps buyers to specific service types and ZIP codes
- Includes priority, capacity limits, and bid ranges
- Supports active/inactive status for easy management

### ZipCodeMetadata  
- Geographic information for ZIP codes
- City, state, county, coordinates, timezone
- Foundation for geographic analysis and reporting

## Performance Considerations

- **Caching Strategy** - Frequently accessed eligibility data cached in Redis
- **Database Indexes** - Optimized for common query patterns
- **Batch Operations** - Efficient bulk creation and updates
- **Fallback Logic** - Graceful degradation if service zone system unavailable

## Security & Validation

- **Admin Authentication** - All management operations require admin access
- **Input Validation** - Comprehensive validation using Zod schemas
- **Rate Limiting** - Protection against API abuse
- **Audit Logging** - Complete audit trail for all changes

This system provides the foundation for precise, efficient lead routing while maintaining high performance and reliability.