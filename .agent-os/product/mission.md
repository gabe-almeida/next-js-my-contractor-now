# Product Mission

## Pitch

MyContractorNow is a lead generation and distribution platform that helps homeowners find contractors while enabling lead buyers to acquire high-quality, compliance-verified leads through an automated auction system.

## Users

### Primary Customers

- **Lead Buyers**: Companies like Modernize, HomeAdvisor, Angi, and other contractor networks who purchase qualified homeowner leads
- **Homeowners**: Property owners seeking contractor services for windows, bathrooms, roofing, and other home improvement projects
- **Platform Operators**: Admins who manage service types, buyers, and monitor lead quality and performance

### User Personas

**Lead Buyer Account Manager** (30-45 years old)
- **Role:** Lead Acquisition Manager at contractor networks
- **Context:** Manages lead purchases across multiple service categories and geographic regions
- **Pain Points:** Poor lead quality, lack of compliance verification, manual bid management, limited geographic targeting
- **Goals:** Acquire high-quality verified leads, optimize bid strategies per ZIP/service, ensure TCPA compliance, track ROI per service type

**Homeowner** (35-65 years old)
- **Role:** Property Owner
- **Context:** Needs contractor services for home improvement projects
- **Pain Points:** Finding reliable contractors, getting multiple quotes, ensuring privacy and data protection
- **Goals:** Connect with qualified contractors quickly, receive competitive quotes, maintain control over contact preferences

**Platform Administrator** (25-40 years old)
- **Role:** Operations Manager
- **Context:** Manages the lead marketplace and ensures quality and compliance
- **Pain Points:** Manual buyer configuration, lack of real-time monitoring, compliance tracking complexity
- **Goals:** Maximize lead monetization, ensure compliance, optimize buyer performance, maintain high conversion rates

## The Problem

### Lead Quality and Compliance Verification

Lead buyers struggle with poor lead quality and lack of compliance documentation, resulting in wasted spend and regulatory risk. Industry studies show 40-60% of purchased leads are low-quality or non-compliant.

**Our Solution:** Automatic TrustedForm certificate generation and Jornaya LeadID tracking on every lead, with configurable compliance requirements per buyer.

### Manual Buyer Management and Geographic Targeting

Lead distribution platforms require manual configuration for each buyer's service types and geographic preferences, limiting scalability and causing missed opportunities in specific markets.

**Our Solution:** Granular buyer configuration system allowing ZIP code-level targeting per service type with priority settings and bid limits.

### Inefficient Auction Mechanics

Traditional lead distribution uses sequential pings or fixed pricing, leaving money on the table and creating delays in lead delivery.

**Our Solution:** Parallel PING auction system that sends leads to all qualified buyers simultaneously, selecting the highest bidder within seconds.

## Differentiators

### Compliance-First Architecture

Unlike traditional lead platforms that add compliance as an afterthought, we integrate TrustedForm and Jornaya tracking at the form level, ensuring every lead has verifiable compliance documentation before auction.

### Granular Geographic and Service Targeting

While competitors offer basic state or metro-level targeting, we provide ZIP code-level configuration per buyer per service type, allowing buyers to optimize their bids and capacity at the most granular level.

### Real-Time Parallel Auction System

Instead of sequential pings that create delays and suboptimal pricing, our parallel auction system sends PINGs to all qualified buyers simultaneously, maximizing revenue and minimizing lead age.

## Key Features

### Core Features

- **Dynamic Service Forms:** Service-specific form generation with custom fields for windows, bathrooms, roofing, and other categories
- **ZIP Code Validation:** Real-time address validation using Radar.com API to ensure lead quality and enable accurate geographic targeting
- **Compliance Tracking:** Automatic TrustedForm certificate and Jornaya LeadID capture on every form submission
- **Parallel PING Auction:** Simultaneous auction requests to all qualified buyers with automatic highest bidder selection
- **Async Processing:** Redis-based queue system for reliable background processing of leads

### Buyer Management Features

- **Multi-Buyer Support:** Unlimited buyers with individual API endpoints, authentication, and timeout configurations
- **Service-Specific Configuration:** Custom field mappings and templates per buyer per service type
- **ZIP Code Targeting:** Granular geographic targeting with priority and bid limits per ZIP/service combination
- **Compliance Requirements:** Configurable TrustedForm and Jornaya requirements per buyer

### Admin Features

- **Service Type Management:** Create and configure dynamic form schemas for any contractor service category
- **Buyer Configuration:** Manage buyer profiles, API credentials, and service preferences
- **Lead Monitoring:** Real-time visibility into lead status, winning bids, and transaction history
- **Analytics Dashboard:** Performance metrics including conversion rates, average bids, and buyer response times

### Quality Assurance Features

- **Lead Quality Scoring:** Automated scoring based on completeness, compliance, and validation results
- **Complete Audit Trail:** Full transaction logging for every PING and POST with timestamps and responses
- **Compliance Audit Log:** Detailed event tracking for all compliance-related activities
- **Template Engine:** Flexible data transformation system to match each buyer's API requirements
