# Spec Requirements Document

> Spec: Database Integration - Remove All Mock Data
> Created: 2025-10-16

## Overview

Replace all mock data implementations across the admin system with real Prisma database queries, ensuring full functionality of buyer management, ZIP code targeting, lead tracking, and auction system. This includes implementing comprehensive database seed scripts for realistic testing and validating end-to-end workflows from buyer configuration through lead distribution.

## User Stories

### Admin Configures Buyer with Geographic Targeting

As a platform administrator, I want to configure buyers with specific service types and ZIP code coverage areas, so that leads are only distributed to buyers who service those geographic regions and categories.

**Workflow:**
1. Admin navigates to `/admin/buyers` and creates a new buyer (e.g., "ABC Contractors")
2. Admin configures buyer with API endpoint, authentication, and timeout settings
3. Admin adds service type associations (e.g., Windows, Roofing) with custom field mappings
4. Admin navigates to buyer's ZIP code management page
5. Admin adds ZIP codes by service type with priority levels (1-10) and bid limits
6. Admin sets daily lead caps per ZIP/service combination
7. System validates all data and stores in database
8. When a lead arrives for that ZIP + service, buyer receives PING request
9. If buyer wins auction, lead is POSTed to their API endpoint

### Lead Buyer Account Manager Views Performance Data

As a lead buyer account manager, I want to view real transaction history and lead statistics for my account, so that I can optimize my bid strategy and geographic targeting.

**Workflow:**
1. Admin views buyer profile showing real stats from database
2. Stats include: total leads purchased, average bid amount, win rate by ZIP/service
3. Transaction history shows all PING/POST attempts with timestamps and responses
4. Geographic coverage map displays active ZIP codes with lead volume
5. All data comes from actual database queries, not mock data

### Platform Operator Tests Lead Distribution

As a platform operator, I want to test the complete lead flow with realistic buyer configurations, so that I can verify the auction system respects ZIP code targeting and compliance requirements.

**Workflow:**
1. Operator runs seed script to populate database with test buyers and configurations
2. Seed creates 3-5 buyers with overlapping and non-overlapping ZIP codes
3. Operator submits test lead through public form
4. System validates lead, captures compliance data (TrustedForm, Jornaya)
5. Redis queue processes lead asynchronously
6. Auction system queries database for buyers matching lead's service type and ZIP
7. System sends parallel PINGs only to qualified buyers
8. Highest bidder is selected and receives POST
9. All transactions are logged to database with full audit trail
10. Operator views transaction in admin dashboard showing real database records

## Spec Scope

1. **Remove Mock Data from All Admin API Endpoints** - Replace in-memory mock arrays in 8 API route files with real Prisma database queries
2. **Implement Real Buyer ZIP Code Management** - Connect buyer ZIP code CRUD operations to BuyerServiceZipCode table with proper relationships
3. **Fix All Admin UI Pages** - Update 9 admin page components to fetch real data from database via API endpoints
4. **Create Comprehensive Database Seed Script** - Build seed script with realistic buyers, services, ZIP codes, and sample leads for testing
5. **Verify Lead Auction System Database Integration** - Ensure lead processor worker queries real database for buyer matching and respects ZIP code targeting
6. **End-to-End Testing with Real Data** - Test complete workflow from buyer configuration through lead submission, auction, and distribution

## Out of Scope

- Creating new admin features not already in the UI
- Modifying the Prisma schema structure (use existing schema)
- Implementing new compliance integrations
- Performance optimization or caching layers (focus on functionality first)
- Authentication/authorization changes
- Frontend UI/UX redesign

## Expected Deliverable

1. **All 17 Mock Data Files Converted**: Every API endpoint and admin page uses real Prisma queries with no mock data remaining
2. **Full Buyer ZIP Management Working**: Admins can create buyers, assign service types, configure ZIP codes with priorities/limits, and all changes persist to database
3. **Seed Script Produces Test Data**: Running `npm run db:seed` creates 5 buyers across 3 service types with realistic ZIP coverage, bid ranges, and sample transaction history
4. **Lead Distribution Respects Database Config**: Submit test lead and verify auction system only contacts buyers with matching service+ZIP, respects bid limits, and logs all transactions to database
5. **Admin Dashboard Shows Real Data**: All admin pages (buyers, leads, transactions, analytics) display actual database records with accurate statistics and relationships
