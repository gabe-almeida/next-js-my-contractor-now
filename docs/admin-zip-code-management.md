# Lead Buyer Service-Zip Code Management System

## Overview

This comprehensive admin interface allows administrators to view and manage Lead Buyer service-zip code mappings. The system provides intuitive tools to configure which Service Types each Lead Buyer offers and what Zip Codes they serve for each service.

## Features

### 🎯 Core Functionality

- **Service-Zip Code Mapping**: Configure specific zip codes for each buyer-service combination
- **Bulk Operations**: Add/remove multiple zip codes at once
- **Priority Management**: Set priority levels (1-10) for each zip code mapping
- **Lead Limits**: Configure daily lead limits per zip code
- **Real-time Validation**: Immediate feedback on duplicate zip codes and validation errors
- **Import/Export**: Bulk import via CSV/JSON and export functionality

### 📊 Dashboard Features

- **Coverage Overview**: Visual dashboard showing service coverage statistics
- **Buyer Performance**: Track coverage rates and service areas per buyer
- **Competitive Analysis**: See which zip codes have multiple buyers competing
- **Real-time Statistics**: Active coverage rates, total mappings, and geographic reach

### 🔧 Advanced Management

- **Bulk Updates**: Activate/deactivate multiple zip codes simultaneously
- **Search & Filter**: Find specific zip codes or services quickly
- **Audit Trail**: Track changes and updates with timestamps
- **Production-Ready**: Comprehensive error handling and user feedback

## Architecture

### Database Schema

```sql
-- Extended BuyerServiceConfig to include zip code relationships
model BuyerServiceConfig {
  -- existing fields...
  zipCodeMappings BuyerServiceZipCode[]
}

-- New table for zip code mappings
model BuyerServiceZipCode {
  id                    String   @id @default(uuid())
  buyerServiceConfigId  String   @map("buyer_service_config_id")
  zipCode               String   @map("zip_code") -- 5-digit US zip code
  active                Boolean  @default(true)
  priority              Int      @default(5) -- 1-10 priority scale
  maxLeadsPerDay        Int?     @map("max_leads_per_day")
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  
  buyerServiceConfig BuyerServiceConfig @relation(...)
  
  @@unique([buyerServiceConfigId, zipCode])
  @@index([zipCode])
  @@index([active])
}
```

### API Endpoints

#### GET `/api/admin/buyers/[id]/zip-codes`
- Get all zip codes for a buyer
- Query parameters:
  - `serviceTypeId`: Filter by specific service
  - `includeInactive`: Include inactive mappings

#### POST `/api/admin/buyers/[id]/zip-codes`
- Add new zip codes for a buyer service
- Body: `{ serviceTypeId, zipCodes[], priority, maxLeadsPerDay }`

#### PUT `/api/admin/buyers/[id]/zip-codes`
- Bulk update zip codes
- Body: `{ zipCodeIds[], updates: { active?, priority?, maxLeadsPerDay? } }`

#### DELETE `/api/admin/buyers/[id]/zip-codes`
- Remove zip codes
- Query parameters: `ids=id1,id2,id3`

### Component Architecture

```
BuyerServiceZipManager (Main Container)
├── ServiceZipMapping (Per-service display)
│   ├── Bulk selection and operations
│   ├── Individual zip code management
│   └── Priority and limit configuration
└── ZipCodeManagement (Add/Import Modal)
    ├── Manual entry interface
    ├── File import (CSV/JSON)
    ├── Validation and preview
    └── Bulk add operations
```

## User Interface

### Main Dashboard (`/admin/service-coverage`)

- **Service Coverage View**: Shows coverage statistics by service type
- **Buyer Coverage View**: Shows coverage statistics by buyer
- **Real-time Statistics**: Total zip codes, active coverage, buyer counts
- **Competitive Analysis**: Identify high-competition zip codes

### Buyer Zip Code Management (`/admin/buyers/[id]/zip-codes`)

- **Service Breakdown**: Expandable cards for each service type
- **Bulk Operations**: Select and modify multiple zip codes
- **Quick Actions**: Activate/deactivate, delete, export
- **Visual Feedback**: Color-coded priority levels and status indicators

### Add Zip Codes Modal

- **Service Selection**: Choose which service to configure
- **Manual Entry**: Textarea with flexible input (comma, space, newline separated)
- **File Import**: Support for JSON, CSV, and TXT files
- **Template Export**: Download structured templates
- **Real-time Preview**: See zip codes as you type
- **Duplicate Detection**: Highlight and remove conflicting entries

## Usage Examples

### Adding Zip Codes

```typescript
// Manual entry in textarea:
90210
90211, 90212
10001 10002 10003

// Or via file import (JSON):
{
  "serviceTypeId": "windows",
  "zipCodes": ["90210", "90211", "90212"],
  "priority": 8,
  "maxLeadsPerDay": 10
}
```

### Bulk Operations

```typescript
// Update multiple zip codes
const updates = {
  zipCodeIds: ['zip-1', 'zip-2', 'zip-3'],
  updates: {
    active: false,
    priority: 5
  }
};

// Delete multiple zip codes
const deleteIds = ['zip-4', 'zip-5', 'zip-6'];
```

## Validation Rules

### Zip Code Format
- Must be exactly 5 digits
- US postal codes only
- No duplicates within same buyer-service combination

### Priority Levels
- Range: 1-10 (integer)
- 1-4: Low priority
- 5-7: Medium priority  
- 8-10: High priority

### Daily Lead Limits
- Optional positive integer
- Per zip code, per service
- Null/undefined = unlimited

## Error Handling

### User-Friendly Messages
- Clear validation errors with specific field highlighting
- Duplicate detection with removal options
- Network error recovery with retry mechanisms
- Loading states and progress indicators

### API Error Responses
```json
{
  "success": false,
  "error": "Duplicate zip codes found",
  "duplicates": ["90210", "90211"],
  "message": "2 zip code(s) already exist for this service"
}
```

## Performance Optimizations

### Frontend
- Lazy loading of zip code data
- Debounced search inputs
- Optimistic updates for quick feedback
- Virtualized lists for large datasets

### Backend
- Database indexing on zip codes and active status
- Bulk operations to reduce API calls
- Cached buyer and service data
- Optimized queries with proper joins

## Security Features

- Input validation and sanitization
- CSRF protection on all mutations
- Rate limiting on bulk operations
- Admin authentication required
- Audit logging for all changes

## Integration Points

### Existing Systems
- Integrates with existing buyer management
- Uses current service type configurations  
- Maintains compatibility with lead routing logic
- Extends admin authentication system

### Lead Distribution
- Zip codes used for buyer matching
- Priority affects lead routing decisions
- Daily limits enforced during distribution
- Active status gates buyer eligibility

## Future Enhancements

### Planned Features
- Geographic visualization (map view)
- ZIP+4 extended postal code support
- State/county level grouping
- Performance analytics per zip code
- A/B testing for priority levels
- Automated coverage gap detection

### Advanced Analytics
- Lead conversion rates by zip code
- Revenue optimization suggestions  
- Competitive bidding insights
- Geographic expansion recommendations

## Deployment

### Prerequisites
- Next.js 14+
- React 18+
- Prisma with SQLite/PostgreSQL
- TypeScript 5+

### Installation
```bash
# Install dependencies
npm install

# Run database migrations
npx prisma migrate dev

# Generate Prisma client
npx prisma generate

# Start development server
npm run dev
```

### Production Considerations
- Database indices for performance
- Redis caching for frequently accessed data
- CDN for static assets
- Monitoring and alerting
- Backup strategies for zip code data

## Testing

### Automated Tests
- Unit tests for validation logic
- Integration tests for API endpoints
- Component tests for UI interactions
- E2E tests for complete workflows

### Manual Testing Scenarios
- Import large CSV files (1000+ zip codes)
- Duplicate detection accuracy
- Bulk operations performance
- Error recovery and retry logic
- Mobile responsive behavior

## Support and Maintenance

### Monitoring
- API response times and error rates
- User interaction analytics
- Database query performance
- Import/export success rates

### Maintenance Tasks
- Regular data validation checks
- Performance optimization reviews
- Security audit and updates
- User feedback integration

---

This system provides a comprehensive solution for managing lead buyer service areas with an intuitive admin interface, robust validation, and production-ready features.