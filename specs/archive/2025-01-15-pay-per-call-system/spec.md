# Pay-Per-Call System Specification

> **Version:** 2.1 (Modular + Audited)
> **Created:** 2025-01-15
> **Status:** Planning
> **Est. Total Effort:** 16-21 weeks (4 phases, includes Phase 0 infrastructure)

---

## Executive Summary

A pay-per-call system that allows affiliates to generate inbound phone calls and sell them to contractors and network buyers through a real-time auction. This system integrates with our existing lead auction infrastructure using DRY principles.

### Value Proposition

```
AFFILIATES                    OUR PLATFORM                      BUYERS
──────────                    ────────────                      ──────
• Run ads on FB,              • Provision phone numbers         • Contractors get
  Google, TikTok              • Track & attribute calls           live phone calls
• Generate inbound            • Pre-qualify via IVR             • Networks bid via
  calls                       • Run real-time auction             PING/POST
• Get paid per                • Route to highest bidder         • Pay per qualified
  qualified call              • Record for QA                     call

Affiliate earns               Platform margin                   Buyer pays
$35/call                      ~15-25%                           $45/call
```

### Key Decisions

- **Two provisioning options** per service type (Platform or Forwarding)
- **DRY architecture** - reuses 80%+ of existing lead auction
- **2-second PING timeout** (aggressive) for networks
- **Dual-channel recording** for all calls (stored in S3, not Twilio)
- **Cascade delivery** if winner doesn't answer
- **Comprehensive logging** - every call event logged to database for user-facing activity feeds
- **Feature flags** - safe rollout with instant rollback capability

---

## Section Index

Each section contains detailed specifications and implementation tasks.

### Phase 1: MVP (6-8 weeks)

| # | Section | Implementation | Tested |
|---|---------|----------------|--------|
| 01 | [Database Schema](./sections/01-database-schema.md) | ⬜ | ⬜ |
| | *New tables: affiliates, campaigns, tracking_numbers, calls, ivr_flows* | | |
| 02 | [Twilio Integration](./sections/02-twilio-integration.md) | ⬜ | ⬜ |
| | *SDK setup, TwiML builders, webhook verification* | | |
| 03 | [Call Flow](./sections/03-call-flow.md) | ⬜ | ⬜ |
| | *7-phase flow: Initiation → Ingestion → IVR → Auction → Transfer → Completion → Recording* | | |
| 04 | [Phone Provisioning](./sections/04-phone-provisioning.md) | ⬜ | ⬜ |
| | *Option A: Platform numbers (MVP), Option B: Forwarding (Phase 3)* | | |
| 05 | [Auction Engine](./sections/05-auction-engine.md) | ⬜ | ⬜ |
| | *Base engine + CallAuctionEngine, DRY with lead auction* | | |
| 06 | [Affiliate Portal](./sections/06-affiliate-portal.md) | ⬜ | ⬜ |
| | *Dashboard, campaigns, calls, recording playback* | | |
| 07 | [Buyer Admin Config](./sections/07-buyer-admin-config.md) | ⬜ | ⬜ |
| | *Contractor call settings, hours, routing* | | |
| 08 | [IVR System](./sections/08-ivr-system.md) | ⬜ | ⬜ |
| | *Simple IVR (Phase 1), Advanced builder (Phase 2)* | | |
| 09 | [Call Recording](./sections/09-call-recording.md) | ⬜ | ⬜ |
| | *Recording, storage (S3), access control, compliance* | | |
| 12 | [Logging & Observability](./sections/12-logging-observability.md) | ⬜ | ⬜ |
| | *Call activity logs, admin dashboard, affiliate activity feed, debugging* | | |

### Phase 0: Infrastructure (1-2 weeks)

| # | Section | Implementation | Tested |
|---|---------|----------------|--------|
| 11 | [Implementation Phases](./sections/11-implementation-phases.md) - Phase 0 | ⬜ | ⬜ |
| | *Feature flags, monitoring, logging infrastructure, rollback procedures* | | |

### Phase 2: Network Integration (4-5 weeks)

| # | Section | Implementation | Tested |
|---|---------|----------------|--------|
| 05 | [Auction Engine](./sections/05-auction-engine.md) - Network PING | ⬜ | ⬜ |
| | *Call PING/POST for Ringba RTB* | | |
| 07 | [Buyer Admin Config](./sections/07-buyer-admin-config.md) - Network UI | ⬜ | ⬜ |
| | *Network buyer PING configuration, field mappings* | | |
| 08 | [IVR System](./sections/08-ivr-system.md) - Advanced | ⬜ | ⬜ |
| | *Multi-step IVR builder, voice input* | | |

### Phase 3: Advanced Features (5-6 weeks)

| # | Section | Implementation | Tested |
|---|---------|----------------|--------|
| 04 | [Phone Provisioning](./sections/04-phone-provisioning.md) - Option B | ⬜ | ⬜ |
| | *Forwarding numbers with SIP headers* | | |
| 10 | [Analytics & Reporting](./sections/10-analytics-reporting.md) | ⬜ | ⬜ |
| | *Detailed analytics, charts, exports* | | |
| 11 | [Implementation Phases](./sections/11-implementation-phases.md) | ⬜ | ⬜ |
| | *Phase breakdown, effort estimates, key files* | | |

---

## High-Level Architecture

```
                         ┌─────────────────────────────────┐
                         │        AFFILIATE PORTAL         │
                         │  • Get tracking numbers         │
                         │  • View calls & leads           │
                         │  • Listen to recordings         │
                         └───────────────┬─────────────────┘
                                         │
                                         ▼
┌────────────────────┐          ┌─────────────────────────────────┐
│   Twilio Numbers   │─────────▶│        CALL INGESTION           │
│   (We provision)   │          │  • Webhook receives call        │
└────────────────────┘          │  • Identify affiliate/campaign  │
                                └───────────────┬─────────────────┘
                                                │
                                                ▼
                                ┌─────────────────────────────────┐
                                │        IVR QUALIFICATION        │
                                │  • "Press 1 if you own home"    │
                                │  • Pre-qualify callers          │
                                └───────────────┬─────────────────┘
                                                │
                                                ▼
                                ┌─────────────────────────────────┐
                                │     UNIFIED AUCTION ENGINE      │
                                │     (Same as Leads - DRY!)      │
                                │  • Get eligible buyers by ZIP   │
                                │  • PING networks (2s timeout)   │
                                │  • Select highest bid           │
                                └───────────────┬─────────────────┘
                                                │
                       ┌────────────────────────┼────────────────────────┐
                       ▼                        ▼                        ▼
              ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
              │   CONTRACTOR    │      │     NETWORK     │      │    FALLBACK     │
              │   (Direct)      │      │   (PING/POST)   │      │   (Cascade)     │
              │   Transfer to   │      │   Transfer to   │      │   Try next      │
              │   their number  │      │   Ringba number │      │   highest bid   │
              └─────────────────┘      └─────────────────┘      └─────────────────┘
```

---

## Quick Links

| Resource | Path |
|----------|------|
| All sections | [./sections/](./sections/) |
| Tasks list | [./tasks.md](./tasks.md) |
| Planning docs | [./planning/](./planning/) |

---

## Status Legend

| Symbol | Meaning |
|--------|---------|
| ⬜ | Not started |
| 🔄 | In progress |
| ✅ | Complete |

---

*Specification Version: 2.1 (Modular + Audited)*
*Last Updated: 2025-01-15*
*Sections: 12 | Total Tasks: ~315*
