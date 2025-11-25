# Architecture Decision Records (ADRs)
## Lead Buyer Geographic Mapping System

## ADR-001: Normalize Geographic Data into Dedicated Tables

### Status
**Proposed** - Pending implementation

### Context
Current system stores geographic restrictions as JSON arrays within BuyerServiceConfig table, leading to:
- Inefficient in-memory filtering during auctions
- Complex management of ZIP code coverage
- Limited query performance for large buyer networks
- No database-level referential integrity for geographic data

### Decision
Create normalized tables for geographic mapping:
1. **ZipCode** - Master ZIP code reference table
2. **ServiceTypeZipCode** - Service availability by ZIP
3. **BuyerServiceZipCode** - Buyer coverage by service and ZIP

### Rationale
- **Performance**: Database-level filtering vs. application-level JSON parsing
- **Scalability**: Proper indexing supports large ZIP code datasets
- **Maintainability**: Dedicated admin interfaces vs. JSON configuration
- **Integrity**: Foreign key constraints prevent orphaned references
- **Flexibility**: Different coverage patterns per service type

### Consequences
**Positive:**
- 70-90% faster auction eligibility queries
- Support for 50,000+ ZIP codes vs. current 5,000 limit
- Simplified geographic data management
- Proper audit trails and change tracking

**Negative:**
- Increased database complexity
- Migration effort for existing data
- Additional storage requirements
- More complex backup/restore procedures

### Implementation
- Phase 1: Create new tables and indexes
- Phase 2: Migrate existing JSON data
- Phase 3: Update application code
- Phase 4: Remove legacy JSON fields

---

## ADR-002: Use Composite Primary Keys vs. Surrogate Keys

### Status
**Decided** - Use surrogate UUID keys with unique constraints

### Context
Geographic mapping tables could use either:
1. Natural composite keys (serviceTypeId + zipCode)
2. Surrogate UUID keys with unique constraints on natural keys

### Decision
Use surrogate UUID primary keys with unique constraints on natural key combinations.

### Rationale
- **Framework compatibility**: Prisma ORM prefers single-column primary keys
- **Future flexibility**: Easier to add metadata without key changes
- **Relationship simplicity**: Simpler foreign key references
- **Audit requirements**: Easier to track individual record changes

### Consequences
**Positive:**
- Better ORM integration
- Simplified foreign key relationships
- Easier record-level auditing
- More flexible for future schema changes

**Negative:**
- Slightly larger index sizes
- Additional storage overhead for UUIDs
- Need for unique constraints on natural keys

---

## ADR-003: Include Geographic Coordinates in ZIP Code Table

### Status
**Decided** - Include latitude/longitude for future radius-based matching

### Context
Options for geographic data in ZIP code table:
1. ZIP code only (minimal)
2. ZIP code + state/county (administrative)
3. ZIP code + coordinates (spatial capabilities)

### Decision
Include latitude, longitude, state, and county data in ZIP code master table.

### Rationale
- **Future capability**: Enables radius-based service matching
- **Analytics support**: Geographic reporting and visualization
- **Data completeness**: Standard geographic attributes for business intelligence
- **Third-party integration**: Compatible with mapping services

### Consequences
**Positive:**
- Supports future radius-based matching requirements
- Enables geographic analytics and reporting
- Compatible with mapping service integrations
- Provides foundation for spatial queries

**Negative:**
- Increased table size and complexity
- Need for geographic data source and updates
- Additional validation requirements
- Potential coordinate accuracy concerns

---

## ADR-004: Implement Priority-Based Buyer Selection

### Status
**Decided** - Add priority fields for flexible auction logic

### Context
Auction engine needs flexible buyer selection beyond just bid amounts:
- Preferred buyers in certain regions
- Quality-based buyer ranking
- Strategic partnership priorities
- Performance-based adjustments

### Decision
Add priority integer fields to both ServiceTypeZipCode and BuyerServiceZipCode tables with higher values indicating higher priority.

### Rationale
- **Business flexibility**: Adjust buyer participation dynamically
- **Quality control**: Favor higher-performing buyers
- **Strategic partnerships**: Priority for preferred buyer relationships
- **Geographic optimization**: Different priorities per region

### Consequences
**Positive:**
- Flexible auction participation tuning
- Better buyer performance management
- Support for strategic business relationships
- Regional optimization capabilities

**Negative:**
- Additional complexity in auction logic
- Need for priority management interfaces
- Potential for gaming the priority system
- Documentation requirements for priority rules

---

## ADR-005: Use Database Views for Complex Queries

### Status
**Decided** - Create views for common auction and reporting queries

### Context
The normalized schema requires complex joins for common operations:
- Auction eligibility determination
- Coverage analytics
- Performance reporting
- Administrative dashboards

### Decision
Create database views for frequently-used complex queries to simplify application code and improve performance.

### Rationale
- **Performance**: Pre-optimized query plans
- **Simplicity**: Reduce application-level join complexity
- **Consistency**: Standardized query patterns across application
- **Maintenance**: Centralized query logic updates

### Consequences
**Positive:**
- Simplified application queries
- Better query plan caching
- Consistent data access patterns
- Easier performance optimization

**Negative:**
- Additional database objects to maintain
- Potential view maintenance overhead
- Need for proper view documentation
- Version control complexity for schema changes

---

## ADR-006: Implement Soft Deletes with Active Flags

### Status
**Decided** - Use active boolean flags instead of hard deletes

### Context
Geographic mapping data needs to handle:
- Temporary service suspensions
- Buyer coverage changes
- ZIP code deactivation
- Historical data preservation

### Decision
Implement soft deletes using active boolean flags on all geographic mapping tables.

### Rationale
- **Data preservation**: Maintain historical auction records
- **Reversibility**: Easy to reactivate suspended coverage
- **Analytics**: Historical trend analysis requires preserved data
- **Audit compliance**: Complete data trail for regulatory requirements

### Consequences
**Positive:**
- Complete data preservation for analytics
- Easy reactivation of suspended services
- Better audit trails and compliance
- Safer data management operations

**Negative:**
- Increased storage requirements
- Need for active flags in all queries
- More complex data cleanup procedures
- Potential for forgotten inactive records

---

## ADR-007: Separate Bid Configuration per ZIP Code

### Status
**Decided** - Store min/max bid in BuyerServiceZipCode table

### Context
Buyer bidding strategy may vary by geographic region:
- Higher value markets command higher bids
- Competitive markets require strategic bidding
- Cost structures vary by location
- Service complexity differs by region

### Decision
Store minBid and maxBid directly in BuyerServiceZipCode table rather than at service level.

### Rationale
- **Geographic flexibility**: Different bid ranges per ZIP code
- **Market responsiveness**: Adjust bids based on local competition
- **Cost optimization**: Reflect regional cost variations
- **Strategic bidding**: Fine-grained bid control

### Consequences
**Positive:**
- Flexible geographic bidding strategies
- Better market responsiveness
- Optimized bid ranges per region
- Strategic competitive positioning

**Negative:**
- Increased configuration complexity
- More data to manage and validate
- Potential for inconsistent pricing
- Need for sophisticated bid management tools

---

## ADR-008: Use Foreign Key Constraints for Data Integrity

### Status
**Decided** - Implement full foreign key constraints with CASCADE options

### Context
Geographic mapping involves complex relationships:
- ZIP codes referenced by multiple tables
- Service types linked to coverage areas
- Buyers connected to multiple geographic regions
- Lead data dependent on geographic references

### Decision
Implement comprehensive foreign key constraints with appropriate CASCADE behaviors:
- ON DELETE CASCADE for dependent records
- ON UPDATE CASCADE for key changes
- RESTRICT where data preservation is critical

### Rationale
- **Data integrity**: Prevent orphaned records
- **Consistency**: Maintain referential integrity
- **Performance**: Query optimizer can use constraint information
- **Safety**: Database-level validation of relationships

### Consequences
**Positive:**
- Strong data integrity guarantees
- Automatic cleanup of dependent records
- Better query optimization
- Reduced application-level validation needs

**Negative:**
- More complex migration procedures
- Potential for cascading changes
- Need for careful constraint design
- Recovery complexity in edge cases

---

## Implementation Priority

### High Priority (Phase 1)
- ADR-001: Normalize Geographic Data
- ADR-002: Primary Key Strategy
- ADR-008: Foreign Key Constraints

### Medium Priority (Phase 2)
- ADR-004: Priority-Based Selection
- ADR-006: Soft Deletes
- ADR-007: Geographic Bid Configuration

### Lower Priority (Phase 3)
- ADR-003: Geographic Coordinates
- ADR-005: Database Views

### Review Schedule
These ADRs should be reviewed quarterly and updated based on:
- Performance metrics from production usage
- Business requirement changes
- Technology stack evolution
- Regulatory or compliance changes

### Change Management
Any modifications to these decisions must:
1. Document the reason for change
2. Update the ADR with new status
3. Plan migration strategy for existing data
4. Communicate changes to all stakeholders
5. Update related documentation and training materials