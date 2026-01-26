# Database Schema

> **Section:** 01 | **Phase:** 1 (MVP)
> **Parent:** [spec.md](../spec.md)

---

## Overview

This section defines all database tables and alterations required for the pay-per-call system.

## New Tables

### AFFILIATES: Publishers who generate calls/leads

```sql
CREATE TABLE affiliates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Account info
    user_id UUID REFERENCES users(id),              -- For portal login
    name VARCHAR(200) NOT NULL,
    company VARCHAR(200),
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),

    -- API access
    api_key VARCHAR(100) UNIQUE,                    -- For programmatic access
    api_secret VARCHAR(255),                        -- Hashed

    -- Postback/webhook
    postback_url VARCHAR(500),                      -- Conversion notifications
    postback_method VARCHAR(10) DEFAULT 'POST',     -- GET or POST

    -- Payment
    payment_method VARCHAR(50),                     -- 'wire', 'paypal', 'check'
    payment_details JSONB,                          -- Encrypted payment info
    payment_terms VARCHAR(50) DEFAULT 'net30',      -- net7, net15, net30
    minimum_payout DECIMAL(10,2) DEFAULT 100.00,

    -- Status
    status VARCHAR(20) DEFAULT 'PENDING',           -- PENDING, APPROVED, SUSPENDED
    approved_at TIMESTAMP,
    approved_by UUID REFERENCES users(id),

    -- Metadata
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_affiliates_user ON affiliates(user_id);
CREATE INDEX idx_affiliates_status ON affiliates(status);
CREATE INDEX idx_affiliates_api_key ON affiliates(api_key);
```

### CAMPAIGNS: What affiliates can promote

```sql
CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Basic info
    name VARCHAR(200) NOT NULL,
    description TEXT,
    service_type_id UUID REFERENCES service_types(id),

    -- Payout structure
    call_payout_type VARCHAR(20) DEFAULT 'FIXED',   -- FIXED, REVENUE_SHARE, TIERED
    call_base_payout DECIMAL(10,2),                 -- Fixed amount per qualified call
    call_revenue_share_pct DECIMAL(5,2),            -- % of winning bid

    lead_payout_type VARCHAR(20) DEFAULT 'FIXED',
    lead_base_payout DECIMAL(10,2),
    lead_revenue_share_pct DECIMAL(5,2),

    -- Call qualification
    min_call_duration INT DEFAULT 90,               -- Seconds for qualified
    require_ivr_qualification BOOLEAN DEFAULT false,
    ivr_flow_id UUID REFERENCES ivr_flows(id),

    -- Caps and limits
    daily_call_cap INT,                             -- Max calls per day (all affiliates)
    daily_lead_cap INT,
    affiliate_daily_call_cap INT,                   -- Max per affiliate per day
    affiliate_daily_lead_cap INT,

    -- Scheduling
    hours_of_operation JSONB,                       -- {"mon": {"start": "08:00", "end": "18:00"}, ...}
    timezone VARCHAR(50) DEFAULT 'America/New_York',

    -- Status
    active BOOLEAN DEFAULT true,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_campaigns_service ON campaigns(service_type_id);
CREATE INDEX idx_campaigns_active ON campaigns(active);
```

### AFFILIATE_CAMPAIGNS: Junction table

```sql
CREATE TABLE affiliate_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    affiliate_id UUID NOT NULL REFERENCES affiliates(id),
    campaign_id UUID NOT NULL REFERENCES campaigns(id),

    -- Custom payout overrides (if different from campaign default)
    custom_call_payout DECIMAL(10,2),
    custom_lead_payout DECIMAL(10,2),

    -- Per-affiliate caps
    daily_call_cap INT,
    daily_lead_cap INT,

    -- Status
    status VARCHAR(20) DEFAULT 'PENDING',           -- PENDING, APPROVED, REJECTED, PAUSED
    approved_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(affiliate_id, campaign_id)
);

CREATE INDEX idx_aff_camp_affiliate ON affiliate_campaigns(affiliate_id);
CREATE INDEX idx_aff_camp_campaign ON affiliate_campaigns(campaign_id);
```

### TRACKING_NUMBERS: Phone numbers assigned to affiliates

```sql
CREATE TABLE tracking_numbers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Phone number
    phone_number VARCHAR(20) NOT NULL,              -- E.164 format: +18445551234
    phone_number_display VARCHAR(20),               -- Display format: (844) 555-1234
    twilio_sid VARCHAR(50),                         -- Twilio Phone Number SID

    -- Assignment
    affiliate_id UUID REFERENCES affiliates(id),
    campaign_id UUID REFERENCES campaigns(id),
    service_type_id UUID REFERENCES service_types(id),

    -- Provisioning type
    provisioning_type VARCHAR(20) NOT NULL,         -- 'PLATFORM' or 'FORWARDING'
    forwarding_identifier VARCHAR(100),             -- For forwarding: "affiliate_id:campaign_id"

    -- IVR
    ivr_flow_id UUID REFERENCES ivr_flows(id),

    -- Status
    active BOOLEAN DEFAULT true,

    -- Stats (denormalized for quick display)
    total_calls INT DEFAULT 0,
    total_qualified_calls INT DEFAULT 0,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(phone_number)
);

CREATE INDEX idx_tracking_affiliate ON tracking_numbers(affiliate_id);
CREATE INDEX idx_tracking_campaign ON tracking_numbers(campaign_id);
CREATE INDEX idx_tracking_phone ON tracking_numbers(phone_number);
CREATE INDEX idx_tracking_forwarding ON tracking_numbers(forwarding_identifier);
```

### CALLS: Individual call records

```sql
CREATE TABLE calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Call identification
    twilio_call_sid VARCHAR(50) NOT NULL UNIQUE,

    -- Source
    tracking_number_id UUID REFERENCES tracking_numbers(id),
    affiliate_id UUID REFERENCES affiliates(id),
    campaign_id UUID REFERENCES campaigns(id),
    service_type_id UUID REFERENCES service_types(id),

    -- Caller info
    caller_phone VARCHAR(20) NOT NULL,              -- Caller's number (CID)
    caller_phone_display VARCHAR(20),
    caller_city VARCHAR(100),
    caller_state VARCHAR(50),
    caller_zip VARCHAR(10),
    caller_name VARCHAR(200),                       -- CNAM if available

    -- IVR
    ivr_responses JSONB,                            -- {"isHomeowner": true, "projectType": "repair"}
    is_qualified BOOLEAN DEFAULT false,

    -- Auction
    auction_started_at TIMESTAMP,
    auction_completed_at TIMESTAMP,
    eligible_buyers_count INT,
    bids_received JSONB,                            -- [{buyer_id, bid_amount, response_time_ms}, ...]

    -- Winner
    status VARCHAR(20) DEFAULT 'RINGING',           -- RINGING, IVR, BIDDING, CONNECTING, CASCADING, CONNECTED, COMPLETED, FAILED, REJECTED, CALLER_HANGUP, NO_BIDS, NO_ANSWER
    winning_buyer_id UUID REFERENCES buyers(id),
    winning_bid DECIMAL(10,2),
    transfer_phone_number VARCHAR(20),              -- Where call was transferred

    -- Timing
    answered_at TIMESTAMP,                          -- When we answered
    ivr_completed_at TIMESTAMP,
    connected_at TIMESTAMP,                         -- When transferred call connected
    ended_at TIMESTAMP,

    -- Duration
    total_duration_seconds INT,                     -- Total call time
    connected_duration_seconds INT,                 -- Time with buyer

    -- Outcome
    disposition VARCHAR(50),                        -- ANSWERED, NO_ANSWER, BUSY, FAILED, CALLER_HANGUP
    hangup_reason VARCHAR(100),

    -- Recording
    recording_sid VARCHAR(50),
    recording_url VARCHAR(500),
    recording_duration_seconds INT,
    recording_status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, RECORDING, PROCESSING, DOWNLOAD_FAILED, UPLOAD_FAILED, AVAILABLE, DELETED

    -- Financials
    is_billable BOOLEAN DEFAULT false,
    affiliate_payout DECIMAL(10,2),
    buyer_charge DECIMAL(10,2),
    platform_margin DECIMAL(10,2),

    -- Postback
    postback_sent BOOLEAN DEFAULT false,
    postback_sent_at TIMESTAMP,
    postback_response TEXT,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_calls_twilio_sid ON calls(twilio_call_sid);
CREATE INDEX idx_calls_affiliate ON calls(affiliate_id);
CREATE INDEX idx_calls_campaign ON calls(campaign_id);
CREATE INDEX idx_calls_service ON calls(service_type_id);
CREATE INDEX idx_calls_status ON calls(status);
CREATE INDEX idx_calls_winning_buyer ON calls(winning_buyer_id);
CREATE INDEX idx_calls_created ON calls(created_at);
CREATE INDEX idx_calls_caller_phone ON calls(caller_phone);
```

### IVR_FLOWS: Pre-qualification scripts

```sql
CREATE TABLE ivr_flows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(200) NOT NULL,
    description TEXT,
    service_type_id UUID REFERENCES service_types(id),

    -- Flow definition
    steps JSONB NOT NULL,                           -- Array of IVR steps

    -- Settings
    default_timeout INT DEFAULT 10,                 -- Seconds to wait for input
    max_retries INT DEFAULT 2,                      -- Retry on no input

    active BOOLEAN DEFAULT true,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

## Alterations to Existing Tables

### buyers table

```sql
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS accepts_calls BOOLEAN DEFAULT false;
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS call_forwarding_number VARCHAR(20);
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS call_backup_number VARCHAR(20);
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS call_hours_of_operation JSONB;
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS call_ring_timeout INT DEFAULT 25;
```

### buyer_service_configs table

```sql
ALTER TABLE buyer_service_configs ADD COLUMN IF NOT EXISTS call_bid_amount DECIMAL(10,2);
ALTER TABLE buyer_service_configs ADD COLUMN IF NOT EXISTS call_min_bid DECIMAL(10,2);
ALTER TABLE buyer_service_configs ADD COLUMN IF NOT EXISTS call_max_bid DECIMAL(10,2);
ALTER TABLE buyer_service_configs ADD COLUMN IF NOT EXISTS call_daily_cap INT;
ALTER TABLE buyer_service_configs ADD COLUMN IF NOT EXISTS call_ping_url VARCHAR(500);
ALTER TABLE buyer_service_configs ADD COLUMN IF NOT EXISTS call_field_mappings JSONB;
ALTER TABLE buyer_service_configs ADD COLUMN IF NOT EXISTS require_ivr_qualification BOOLEAN DEFAULT false;
```

### transactions table

No schema change needed - just new action_type values:
- `CALL_PING`
- `CALL_TRANSFER`
- `CALL_COMPLETE`

## Entity Relationship Diagram

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│   affiliates    │         │    campaigns    │         │  service_types  │
├─────────────────┤         ├─────────────────┤         ├─────────────────┤
│ id              │◄───┐    │ id              │◄───┐    │ id              │
│ user_id         │    │    │ service_type_id │────┼───▶│ name            │
│ name            │    │    │ name            │    │    │ display_name    │
│ status          │    │    │ call_base_payout│    │    │ form_schema     │
│ ...             │    │    │ ...             │    │    └─────────────────┘
└────────┬────────┘    │    └────────┬────────┘    │
         │             │             │             │
         │             │             │             │
         ▼             │             ▼             │
┌─────────────────────────────────────────────────────────────────────────┐
│                     affiliate_campaigns                                  │
├─────────────────────────────────────────────────────────────────────────┤
│ affiliate_id ───────┘                                                    │
│ campaign_id  ───────────────────┘                                        │
│ status                                                                   │
│ custom_call_payout                                                       │
└─────────────────────────────────────────────────────────────────────────┘
         │
         │
         ▼
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│tracking_numbers │         │      calls      │         │    ivr_flows    │
├─────────────────┤         ├─────────────────┤         ├─────────────────┤
│ id              │◄────────│ tracking_number │         │ id              │
│ phone_number    │         │ id              │         │ name            │
│ affiliate_id────┼────────▶│ affiliate_id    │         │ steps (JSON)    │
│ campaign_id ────┼────────▶│ campaign_id     │         └────────┬────────┘
│ ivr_flow_id ────┼─────────┼─────────────────┼──────────────────┘
│ provisioning_   │         │ winning_buyer_id│────────▶ buyers
│   type          │         │ status          │
└─────────────────┘         │ recording_url   │
                            │ ...             │
                            └─────────────────┘
```

## Additional Tables for Race Condition Prevention

### CALL_BIDS: Atomic bid storage (prevents JSONB race conditions)

```sql
-- WHY: The bids_received JSONB on calls table is NOT atomic for concurrent updates.
--      Multiple buyers responding simultaneously could overwrite each other's bids.
-- WHEN: Created when a buyer responds to a PING, updated when auction completes.
-- HOW: Use this table for all bid operations instead of JSONB updates.

CREATE TABLE call_bids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
    buyer_id UUID NOT NULL REFERENCES buyers(id),

    -- Bid info
    bid_amount DECIMAL(10,2) NOT NULL,
    response_time_ms INT,                       -- How fast buyer responded
    bid_status VARCHAR(20) DEFAULT 'PENDING',   -- PENDING, ACCEPTED, REJECTED, EXPIRED

    -- For network buyers
    ping_response JSONB,                        -- Raw response from PING
    transfer_number VARCHAR(20),                -- Number to transfer to if winner

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- Prevent duplicate bids from same buyer on same call
    UNIQUE(call_id, buyer_id)
);

CREATE INDEX idx_call_bids_call ON call_bids(call_id);
CREATE INDEX idx_call_bids_buyer ON call_bids(buyer_id);
CREATE INDEX idx_call_bids_status ON call_bids(bid_status);
```

### WEBHOOK_EVENTS: Idempotency tracking (prevents duplicate processing)

```sql
-- WHY: Twilio may send the same webhook multiple times (retries, network issues).
--      Without idempotency tracking, we could process the same event twice,
--      leading to duplicate billing, corrupted state, or double cascade attempts.
-- WHEN: Checked before processing ANY Twilio webhook.
-- HOW: Hash the webhook key fields and check for existence before processing.

CREATE TABLE webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Event identification
    event_type VARCHAR(50) NOT NULL,            -- 'call_incoming', 'call_completed', 'recording_ready'
    external_id VARCHAR(100) NOT NULL,          -- CallSid from Twilio
    event_key VARCHAR(200) NOT NULL UNIQUE,     -- Computed: "{event_type}:{external_id}:{event_status}"

    -- Processing info
    processed_at TIMESTAMP DEFAULT NOW(),
    processing_result VARCHAR(20),              -- 'SUCCESS', 'FAILED', 'SKIPPED'
    error_message TEXT,

    -- Original payload for debugging
    payload JSONB,

    -- Auto-cleanup (webhooks older than 7 days can be purged)
    expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '7 days')
);

CREATE INDEX idx_webhook_event_key ON webhook_events(event_key);
CREATE INDEX idx_webhook_expires ON webhook_events(expires_at);
```

### DAILY_COUNTERS: Atomic cap enforcement

```sql
-- WHY: Checking and incrementing cap counters is a race condition.
--      Two concurrent calls could both pass the cap check, then both increment.
-- WHEN: Incremented atomically when call is accepted.
-- HOW: Use PostgreSQL's INSERT ... ON CONFLICT with atomic increment.

CREATE TABLE daily_counters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- What we're counting
    entity_type VARCHAR(50) NOT NULL,           -- 'campaign', 'affiliate', 'buyer_service'
    entity_id UUID NOT NULL,
    counter_date DATE NOT NULL,

    -- The counter (use atomic operations only!)
    call_count INT DEFAULT 0,
    lead_count INT DEFAULT 0,
    spend_amount DECIMAL(10,2) DEFAULT 0,       -- For budget caps

    -- Unique constraint allows upsert
    UNIQUE(entity_type, entity_id, counter_date)
);

CREATE INDEX idx_counters_lookup ON daily_counters(entity_type, entity_id, counter_date);

-- Atomic increment function:
-- INSERT INTO daily_counters (entity_type, entity_id, counter_date, call_count)
-- VALUES ('campaign', 'uuid', CURRENT_DATE, 1)
-- ON CONFLICT (entity_type, entity_id, counter_date)
-- DO UPDATE SET call_count = daily_counters.call_count + 1
-- RETURNING call_count;
```

### CALL_DISPUTES: Track disputed call outcomes

```sql
-- WHY: Affiliates may dispute calls marked as "not qualified".
--      Need audit trail and resolution workflow.
-- WHEN: Created when affiliate opens dispute, updated during resolution.
-- HOW: Reference call record and track resolution process.

CREATE TABLE call_disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id UUID NOT NULL REFERENCES calls(id),
    affiliate_id UUID NOT NULL REFERENCES affiliates(id),

    -- Dispute details
    reason VARCHAR(50) NOT NULL,                -- 'duration_miscounted', 'wrong_disposition', etc.
    description TEXT,
    evidence_urls TEXT[],                       -- Links to recordings, screenshots

    -- Resolution
    status VARCHAR(20) DEFAULT 'OPEN',          -- OPEN, UNDER_REVIEW, RESOLVED, REJECTED
    resolved_by UUID REFERENCES users(id),
    resolution_notes TEXT,
    resolution_outcome VARCHAR(20),             -- 'CREDITED', 'REJECTED', 'PARTIAL'
    credit_amount DECIMAL(10,2),                -- If credited

    created_at TIMESTAMP DEFAULT NOW(),
    resolved_at TIMESTAMP,

    -- Prevent duplicate disputes
    UNIQUE(call_id, affiliate_id)
);

CREATE INDEX idx_disputes_affiliate ON call_disputes(affiliate_id);
CREATE INDEX idx_disputes_status ON call_disputes(status);
```

### CALL_FEEDBACK: Buyer feedback on call quality

```sql
-- WHY: Buyers may report bad leads (wrong number, not interested, etc.)
--      Need to track quality issues for affiliate scoring.
-- WHEN: Created when buyer submits feedback.
-- HOW: API endpoint for buyers, affects affiliate quality scores.

CREATE TABLE call_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id UUID NOT NULL REFERENCES calls(id),
    buyer_id UUID NOT NULL REFERENCES buyers(id),

    -- Feedback
    rating INT CHECK (rating >= 1 AND rating <= 5),
    feedback_type VARCHAR(50),                  -- 'wrong_number', 'not_interested', 'excellent'
    notes TEXT,

    -- Impact
    refund_requested BOOLEAN DEFAULT false,
    refund_granted BOOLEAN,
    refund_amount DECIMAL(10,2),

    created_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(call_id, buyer_id)
);

CREATE INDEX idx_feedback_buyer ON call_feedback(buyer_id);
CREATE INDEX idx_feedback_call ON call_feedback(call_id);
```

### AFFILIATE_PAYMENTS: Payment tracking

```sql
-- WHY: Track individual payments to affiliates for reconciliation.
-- WHEN: Created when payment is initiated, updated when completed.
-- HOW: Aggregates qualified calls for payment period.

CREATE TABLE affiliate_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id UUID NOT NULL REFERENCES affiliates(id),

    -- Period
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,

    -- Amounts
    gross_amount DECIMAL(10,2) NOT NULL,        -- Total qualified earnings
    adjustments DECIMAL(10,2) DEFAULT 0,        -- Disputes, bonuses, etc.
    net_amount DECIMAL(10,2) NOT NULL,          -- Final payout

    -- Payment details
    payment_method VARCHAR(50),
    payment_reference VARCHAR(200),             -- Check #, wire reference, PayPal txn

    status VARCHAR(20) DEFAULT 'PENDING',       -- PENDING, PROCESSING, COMPLETED, FAILED
    scheduled_date DATE,
    paid_at TIMESTAMP,

    -- Breakdown
    call_count INT,
    lead_count INT,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_payments_affiliate ON affiliate_payments(affiliate_id);
CREATE INDEX idx_payments_status ON affiliate_payments(status);
CREATE INDEX idx_payments_period ON affiliate_payments(period_start, period_end);
```

### DAILY_METRICS: Pre-aggregated analytics (Phase 3)

```sql
-- WHY: Real-time aggregation of millions of calls is too slow for dashboards.
-- WHEN: Nightly job aggregates previous day's finalized calls.
-- HOW: Query this table for historical analytics instead of raw calls table.
-- SEE: Section 10 (Analytics & Reporting) for aggregation logic.

CREATE TABLE daily_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    affiliate_id UUID REFERENCES affiliates(id),    -- null = platform-wide
    service_type_id UUID REFERENCES service_types(id), -- null = all services
    buyer_id UUID REFERENCES buyers(id),            -- null = all buyers

    -- Call metrics
    total_calls INT DEFAULT 0,
    qualified_calls INT DEFAULT 0,
    failed_calls INT DEFAULT 0,
    total_duration_seconds INT DEFAULT 0,

    -- Financial metrics
    gross_revenue DECIMAL(10,2) DEFAULT 0,
    affiliate_payouts DECIMAL(10,2) DEFAULT 0,
    platform_margin DECIMAL(10,2) DEFAULT 0,

    -- Auction metrics
    avg_auction_time_ms INT,
    avg_bid_amount DECIMAL(10,2),
    cascade_count INT DEFAULT 0,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- Unique constraint for upsert
    UNIQUE(date, affiliate_id, service_type_id, buyer_id)
);

CREATE INDEX idx_daily_metrics_date ON daily_metrics(date);
CREATE INDEX idx_daily_metrics_affiliate ON daily_metrics(affiliate_id, date);
CREATE INDEX idx_daily_metrics_service ON daily_metrics(service_type_id, date);
```

### CALL_ACTIVITY_LOGS: User-facing activity feed (CRITICAL FOR DEBUGGING)

```sql
-- WHY: Every significant event needs to be logged for:
--      1. Super admin debugging production issues
--      2. Affiliate activity dashboard (transparency)
--      3. Support ticket resolution
--      4. Compliance audit trails
-- WHEN: Created at every call lifecycle event.
-- HOW: CallLoggingService writes here AND to structured logs.
-- SEE: Section 12 (Logging & Observability) for full details.

CREATE TABLE call_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,

    -- Event info
    timestamp TIMESTAMP DEFAULT NOW(),
    event VARCHAR(100) NOT NULL,             -- 'call.received', 'call.qualified', etc.
    message VARCHAR(500) NOT NULL,           -- User-friendly message
    level VARCHAR(20) DEFAULT 'info',        -- 'debug', 'info', 'warn', 'error'

    -- Additional context (structured data)
    details JSONB,                           -- {duration: 245, status: 'QUALIFIED', ...}

    -- Visibility controls
    visible_to_affiliate BOOLEAN DEFAULT false,
    visible_to_admin BOOLEAN DEFAULT true,

    -- Performance (indexed for fast queries)
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for dashboard queries
CREATE INDEX idx_call_logs_call ON call_activity_logs(call_id);
CREATE INDEX idx_call_logs_event ON call_activity_logs(event);
CREATE INDEX idx_call_logs_timestamp ON call_activity_logs(timestamp DESC);
CREATE INDEX idx_call_logs_affiliate_visible ON call_activity_logs(visible_to_affiliate, timestamp DESC);
CREATE INDEX idx_call_logs_level ON call_activity_logs(level) WHERE level IN ('warn', 'error');
```

## Additional Columns for Existing Tables

### calls table additions

```sql
-- Optimistic locking for concurrent updates
ALTER TABLE calls ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;

-- State machine tracking
ALTER TABLE calls ADD COLUMN IF NOT EXISTS previous_status VARCHAR(20);
ALTER TABLE calls ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMP;

-- Cascade tracking
ALTER TABLE calls ADD COLUMN IF NOT EXISTS cascade_position INT DEFAULT 0;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS cascade_attempts INT DEFAULT 0;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS max_cascade_depth INT DEFAULT 3;

-- Buyer response tracking
ALTER TABLE calls ADD COLUMN IF NOT EXISTS buyer_answered_at TIMESTAMP;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS buyer_ring_duration_seconds INT;

-- Abandonment tracking
ALTER TABLE calls ADD COLUMN IF NOT EXISTS abandonment_phase VARCHAR(50);
ALTER TABLE calls ADD COLUMN IF NOT EXISTS abandonment_reason VARCHAR(200);

-- Dispute/billing status
ALTER TABLE calls ADD COLUMN IF NOT EXISTS dispute_status VARCHAR(20);  -- OPEN, UNDER_REVIEW, RESOLVED, REJECTED
ALTER TABLE calls ADD COLUMN IF NOT EXISTS billing_status VARCHAR(20) DEFAULT 'PENDING';  -- PENDING, PENDING_RECORDING, FINALIZED
ALTER TABLE calls ADD COLUMN IF NOT EXISTS billing_finalized_at TIMESTAMP;

-- Auction performance tracking
ALTER TABLE calls ADD COLUMN IF NOT EXISTS auction_duration_ms INT;

-- Additional indexes for analytics
CREATE INDEX idx_calls_date_service ON calls(created_at, service_type_id);
CREATE INDEX idx_calls_affiliate_date ON calls(affiliate_id, created_at);
CREATE INDEX idx_calls_qualified ON calls(is_billable, created_at);
CREATE INDEX idx_calls_billing_status ON calls(billing_status);
```

### tracking_numbers table additions

```sql
-- Provisioning state machine
ALTER TABLE tracking_numbers ADD COLUMN IF NOT EXISTS provisioning_status VARCHAR(20) DEFAULT 'PENDING';
-- Values: PENDING, PROVISIONING, ACTIVE, RELEASING, RELEASED, FAILED

-- Versioning for config changes during active calls
ALTER TABLE tracking_numbers ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;
ALTER TABLE tracking_numbers ADD COLUMN IF NOT EXISTS config_changed_at TIMESTAMP;

-- Add index for provisioning cleanup
CREATE INDEX idx_tracking_provisioning ON tracking_numbers(provisioning_status);
```

---

## Race Condition Prevention Summary

| Race Condition | Prevention Mechanism | Table/Column |
|----------------|---------------------|--------------|
| Duplicate webhook processing | Idempotency key check | `webhook_events.event_key` |
| Concurrent bid updates | Separate table with UNIQUE | `call_bids` |
| Cap exceeded by concurrent calls | Atomic counter increment | `daily_counters` |
| Concurrent status updates | Optimistic locking | `calls.version` |
| Config change during active call | Version snapshotting | `tracking_numbers.version` |
| Cascade race conditions | Position tracking | `calls.cascade_position` |

---

## User Stories

### US-DB-1: Affiliate Reconciles Earnings
**AS AN** affiliate reconciling my monthly earnings
**I WANT TO** see exactly which calls were paid, pending, or disputed
**SO THAT** I can verify my payout matches my expectations

**WHEN** I view my earnings report
**THEN** I see calls grouped by billing_status (PENDING, FINALIZED, DISPUTED)
**AND** I can drill into any call to see the full timeline

### US-DB-2: Admin Investigates Duplicate Billing
**AS AN** admin investigating a potential duplicate charge
**I WANT TO** see the webhook event history for a call
**SO THAT** I can determine if a webhook was processed multiple times

**WHEN** I search webhook_events by call_sid
**THEN** I see all events for that call with timestamps and processing results

### US-DB-3: Buyer Reports Bad Lead
**AS A** buyer who received a bad call (wrong number, etc.)
**I WANT TO** submit feedback and request a refund
**SO THAT** I don't pay for calls that weren't qualified

**WHEN** I submit feedback on a call
**THEN** a call_feedback record is created
**AND** if refund_requested=true, it appears in admin queue

### US-DB-4: System Handles 100 Concurrent Calls
**AS THE** system handling a traffic spike
**I WANT TO** ensure all calls are processed correctly
**SO THAT** no bids are lost and no caps are exceeded

**WHEN** 100 calls arrive simultaneously for the same campaign
**THEN** daily_counters uses atomic increment
**AND** call_bids uses INSERT with UNIQUE constraint
**AND** no race conditions corrupt data

### US-DB-5: Affiliate Opens Dispute
**AS AN** affiliate who believes a call was incorrectly disqualified
**I WANT TO** open a dispute with evidence
**SO THAT** I can receive proper credit

**WHEN** I open a dispute
**THEN** a call_disputes record is created
**AND** the call.dispute_status is set to 'OPEN'
**AND** it appears in admin review queue

---

## Implementation Tasks

| Task ID | Description | Status |
|---------|-------------|--------|
| P1-DB-1 | Add `affiliates` table | ⬜ |
| P1-DB-2 | Add `campaigns` table | ⬜ |
| P1-DB-3 | Add `affiliate_campaigns` junction | ⬜ |
| P1-DB-4 | Add `tracking_numbers` table | ⬜ |
| P1-DB-5 | Add `calls` table | ⬜ |
| P1-DB-6 | Add `ivr_flows` table | ⬜ |
| P1-DB-7 | Alter `buyers` table | ⬜ |
| P1-DB-8 | Alter `buyer_service_configs` | ⬜ |
| P1-DB-9 | Run migrations, generate Prisma | ⬜ |
| P1-DB-10 | Create seed data for testing | ⬜ |

### Logging Tables (CRITICAL)

| Task ID | Description | Status | Priority |
|---------|-------------|--------|----------|
| P1-DB-LOG-1 | Add `call_activity_logs` table | ⬜ | CRITICAL |
| P1-DB-LOG-2 | Add indexes for dashboard queries | ⬜ | CRITICAL |
| P1-DB-LOG-3 | Add log partitioning for query performance (no auto-deletion) | ⬜ | HIGH |

> **See [Section 12: Logging & Observability](./12-logging-observability.md)** for full logging implementation.

### Race Condition Prevention Tasks

| Task ID | Description | Status |
|---------|-------------|--------|
| P1-DB-11 | Add `call_bids` table for atomic bid storage | ⬜ |
| P1-DB-12 | Add `webhook_events` table for idempotency | ⬜ |
| P1-DB-13 | Add `daily_counters` table for atomic cap enforcement | ⬜ |
| P1-DB-14 | Add `call_disputes` table | ⬜ |
| P1-DB-15 | Add `call_feedback` table | ⬜ |
| P1-DB-16 | Add `affiliate_payments` table | ⬜ |
| P1-DB-17 | Add `version` column to `calls` for optimistic locking | ⬜ |
| P1-DB-18 | Add `cascade_position`, `cascade_attempts` columns to `calls` | ⬜ |
| P1-DB-19 | Add `abandonment_phase`, `abandonment_reason` columns to `calls` | ⬜ |
| P1-DB-20 | Add `billing_status`, `dispute_status` columns to `calls` | ⬜ |
| P1-DB-21 | Add `provisioning_status` column to `tracking_numbers` | ⬜ |
| P1-DB-22 | Add `version` column to `tracking_numbers` for config changes | ⬜ |
| P1-DB-23-NEW | Add `recording_status` column to `calls` | ⬜ |
| P1-DB-24-NEW | Add `auction_duration_ms` column to `calls` | ⬜ |
| P3-DB-1 | Add `daily_metrics` table for pre-aggregated analytics | ⬜ |

### Index and Constraint Tasks

| Task ID | Description | Status |
|---------|-------------|--------|
| P1-DB-25 | Add composite indexes for analytics queries | ⬜ |
| P1-DB-26 | Add foreign key CASCADE rules for call_bids, webhook_events | ⬜ |
| P1-DB-27 | Add CHECK constraints for enum-like columns | ⬜ |
| P1-DB-28 | Create atomic increment function for daily_counters | ⬜ |
| P1-DB-29 | Add index on `calls.recording_status` | ⬜ |

### Testing Tasks

| Task ID | Description | Status |
|---------|-------------|--------|
| P1-DB-T1 | Test concurrent bid inserts don't duplicate | ⬜ |
| P1-DB-T2 | Test webhook idempotency prevents double processing | ⬜ |
| P1-DB-T3 | Test atomic counter never exceeds cap | ⬜ |
| P1-DB-T4 | Test optimistic locking rejects stale updates | ⬜ |
| P1-DB-T5 | Load test: 100 concurrent calls to same campaign | ⬜ |
| P1-DB-T6 | Test cascade position tracking prevents double transfers | ⬜ |

---

*Section Version: 2.1 (Cross-Section Audit - Added missing columns: recording_status, auction_duration_ms, daily_metrics table; Added missing CallStatus values: CASCADING, CALLER_HANGUP, NO_BIDS, NO_ANSWER; Added billing_status valid values)*
