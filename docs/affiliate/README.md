# Affiliate System Documentation

This folder contains documentation for the affiliate system, including tracking, attribution, and call tracking features.

## Documents

| Document | Description |
|----------|-------------|
| [Dynamic Number Insertion](./dynamic-number-insertion.md) | DNI system for call attribution on landing pages |
| [Call Forwarding](./call-forwarding.md) | Guide for affiliates forwarding calls from external tracking systems |

## System Overview

The affiliate system allows marketing partners to earn commissions by driving leads and calls to the platform.

### Key Features

1. **Referral Links**: Affiliates get unique codes (e.g., `?ref=john123`) that track their traffic
2. **Form Attribution**: When visitors submit forms, the affiliate gets credit via cookie/URL tracking
3. **Call Attribution**: Affiliates can provision tracking numbers to get credit for calls
4. **Dynamic Number Insertion**: Landing pages show affiliate's tracking number automatically
5. **Call Forwarding**: Sophisticated affiliates can forward calls from their own tracking systems

### Attribution Methods

| Method | Use Case | Documentation |
|--------|----------|---------------|
| **URL Parameters** | Web traffic via `?ref=code` | [Affiliate Tracking Flow](../affiliate-tracking-flow.md) |
| **Platform Provisioned Numbers** | Dedicated tracking number per campaign | [DNI Docs](./dynamic-number-insertion.md) |
| **Dynamic Number Insertion** | Auto-display number on landing pages | [DNI Docs](./dynamic-number-insertion.md) |
| **Call Forwarding** | Forward from external tracking systems | [Call Forwarding Docs](./call-forwarding.md) |
| **Embeddable Widget** | Call button on affiliate's own website | [DNI Docs - Widget Section](./dynamic-number-insertion.md#embeddable-widget) |

### Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| Affiliate Service | `src/lib/services/affiliate-service.ts` | Affiliate CRUD, auth, campaigns |
| Tracking Number Service | `src/lib/services/tracking-number-service.ts` | Phone number provisioning |
| Ingress Number Service | `src/lib/services/ingress-number-service.ts` | Shared ingress numbers for forwarding |
| Forwarding Parser | `src/lib/call/forwarding-parser.ts` | Parse SIP headers/URL params |
| DNI API | `src/app/api/tracking-numbers/by-referral/route.ts` | Lookup tracking number by ref code |
| Widget API | `src/app/api/widget/call/route.ts` | CORS-enabled API for embeddable widget |
| useDynamicNumber Hook | `src/hooks/useDynamicNumber.ts` | Client-side DNI fetching |
| CallButton | `src/components/ui/CallButton.tsx` | Click-to-call with DNI support |

### Database Models

| Model | Purpose |
|-------|---------|
| `Affiliate` | Affiliate account |
| `AffiliateLink` | Referral link with unique code |
| `AffiliateCampaign` | Links affiliate to campaigns they can promote |
| `TrackingNumber` | Phone numbers provisioned for call tracking |
| `Campaign` | Campaigns affiliates can join (by service type) |

### Tracking Number Types

| Type | Description |
|------|-------------|
| `PLATFORM` | Dedicated number provisioned for one affiliate+campaign |
| `INGRESS` | Shared number that accepts forwarded calls from multiple affiliates |
| `FORWARDING` | Virtual tracking record for affiliates using call forwarding |

## Quick Reference

### For Affiliates

- **Get a tracking number**: Affiliate Dashboard > Campaigns > Request Number
- **Get embed code**: Affiliate Dashboard > Campaigns > Embed Widget
- **Set up call forwarding**: Affiliate Dashboard > Campaigns > Call Tracking > Forward from my own number

### For Developers

- **Add CallButton to a page**:
  ```tsx
  import { CallButton } from '@/components/ui/CallButton';

  <CallButton
    service="windows"
    fallbackNumber="+18001234567"
    fallbackDisplayNumber="(800) 123-4567"
  />
  ```

- **Use DNI hook directly**:
  ```tsx
  import { useDynamicNumber } from '@/hooks/useDynamicNumber';

  const { phoneNumber, displayNumber, isLoading } = useDynamicNumber({
    service: 'windows',
    fallbackNumber: '+18001234567'
  });
  ```

## Related Documentation

| Document | Description |
|----------|-------------|
| [Affiliate Tracking Flow](../affiliate-tracking-flow.md) | Full tracking attribution flow for forms and leads |
| [Lead System Flow](../lead-system-flow.md) | How leads flow through the system |
| [Call System Architecture](../lead-delivery/README.md) | Call handling and auction system |

## Architecture Diagrams

### Complete Attribution Flow

```
                          AFFILIATE TRAFFIC
                                |
                    +-----------+-----------+
                    |                       |
               WEB TRAFFIC              CALLS
                    |                       |
            +-------+-------+       +-------+-------+
            |               |       |               |
         URL Param      Cookie   Platform #    Forwarded
         ?ref=xxx     aff_ref    Direct       SIP Headers
            |               |       |               |
            +-------+-------+       +-------+-------+
                    |                       |
              DynamicForm              /api/calls/incoming
                    |                       |
                    |               Parse Identification
                    |                       |
              Lead Created           Call Record Created
                    |                       |
              Attribution              Attribution
              Captured                 Captured
                    |                       |
                    +----------+------------+
                               |
                        Commission on Sale
```

### DNI Component Hierarchy

```
Landing Page
    |
    +-- CallButton
           |
           +-- useDynamicNumber hook
                  |
                  +-- Check URL params (?ref=xxx)
                  |
                  +-- Check cookies (aff_ref)
                  |
                  +-- Fetch /api/tracking-numbers/by-referral
                  |
                  +-- Cache in sessionStorage (5 min)
                  |
                  +-- Return phone number
```
