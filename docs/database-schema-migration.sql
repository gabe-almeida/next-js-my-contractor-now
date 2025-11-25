-- Lead Buyer Service Type & Zip Code Database Migration
-- This migration creates the normalized geographic mapping schema

-- =============================================================================
-- PHASE 1: CREATE NEW TABLES
-- =============================================================================

-- Create ZIP Code master table
CREATE TABLE IF NOT EXISTS "zip_codes" (
    "zip_code" TEXT NOT NULL PRIMARY KEY,
    "state_code" TEXT NOT NULL,
    "county_name" TEXT,
    "primary_city" TEXT,
    "latitude" DECIMAL(10,8),
    "longitude" DECIMAL(11,8),
    "timezone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create Service Type to ZIP Code mapping
CREATE TABLE IF NOT EXISTS "service_type_zip_codes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "service_type_id" TEXT NOT NULL,
    "zip_code" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("service_type_id") REFERENCES "service_types" ("id") ON DELETE CASCADE,
    FOREIGN KEY ("zip_code") REFERENCES "zip_codes" ("zip_code") ON DELETE CASCADE
);

-- Create Buyer Service ZIP Code coverage mapping
CREATE TABLE IF NOT EXISTS "buyer_service_zip_codes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "buyer_id" TEXT NOT NULL,
    "service_type_id" TEXT NOT NULL,
    "zip_code" TEXT NOT NULL,
    "min_bid" DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    "max_bid" DECIMAL(8,2) NOT NULL DEFAULT 999.99,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("buyer_id") REFERENCES "buyers" ("id") ON DELETE CASCADE,
    FOREIGN KEY ("service_type_id") REFERENCES "service_types" ("id") ON DELETE CASCADE,
    FOREIGN KEY ("zip_code") REFERENCES "zip_codes" ("zip_code") ON DELETE CASCADE
);

-- =============================================================================
-- PHASE 2: CREATE INDEXES FOR PERFORMANCE
-- =============================================================================

-- ZIP Code indexes
CREATE INDEX IF NOT EXISTS "idx_zip_codes_state" ON "zip_codes" ("state_code");
CREATE INDEX IF NOT EXISTS "idx_zip_codes_county" ON "zip_codes" ("county_name");
CREATE INDEX IF NOT EXISTS "idx_zip_codes_coordinates" ON "zip_codes" ("latitude", "longitude");

-- Service Type ZIP Code indexes
CREATE UNIQUE INDEX IF NOT EXISTS "idx_service_type_zip_unique" 
    ON "service_type_zip_codes" ("service_type_id", "zip_code");
CREATE INDEX IF NOT EXISTS "idx_service_zip_codes_zip" ON "service_type_zip_codes" ("zip_code");
CREATE INDEX IF NOT EXISTS "idx_service_zip_codes_service" ON "service_type_zip_codes" ("service_type_id");
CREATE INDEX IF NOT EXISTS "idx_service_zip_codes_priority" ON "service_type_zip_codes" ("priority");

-- Buyer Service ZIP Code indexes
CREATE UNIQUE INDEX IF NOT EXISTS "idx_buyer_service_zip_unique" 
    ON "buyer_service_zip_codes" ("buyer_id", "service_type_id", "zip_code");
CREATE INDEX IF NOT EXISTS "idx_buyer_service_zip_codes_zip" ON "buyer_service_zip_codes" ("zip_code");
CREATE INDEX IF NOT EXISTS "idx_buyer_service_zip_codes_buyer" ON "buyer_service_zip_codes" ("buyer_id");
CREATE INDEX IF NOT EXISTS "idx_buyer_service_zip_codes_service" ON "buyer_service_zip_codes" ("service_type_id");
CREATE INDEX IF NOT EXISTS "idx_buyer_service_zip_codes_priority" ON "buyer_service_zip_codes" ("priority");
CREATE INDEX IF NOT EXISTS "idx_buyer_service_zip_codes_bid_range" ON "buyer_service_zip_codes" ("min_bid", "max_bid");

-- Optimized auction query index
CREATE INDEX IF NOT EXISTS "idx_buyer_service_zip_auction" 
    ON "buyer_service_zip_codes" ("service_type_id", "zip_code", "active");

-- Enhanced lead auction index
CREATE INDEX IF NOT EXISTS "idx_leads_auction_filter" 
    ON "leads" ("service_type_id", "zip_code", "status", "created_at");

-- =============================================================================
-- PHASE 3: POPULATE ZIP CODE MASTER TABLE
-- =============================================================================

-- Insert common US ZIP codes (sample data - in production, use complete ZIP code database)
INSERT OR IGNORE INTO "zip_codes" ("zip_code", "state_code", "primary_city", "latitude", "longitude") VALUES
-- Major metropolitan areas
('10001', 'NY', 'New York', 40.7505, -73.9934),
('10002', 'NY', 'New York', 40.7158, -73.9865),
('90210', 'CA', 'Beverly Hills', 34.0901, -118.4065),
('90211', 'CA', 'Beverly Hills', 34.0836, -118.3904),
('60601', 'IL', 'Chicago', 41.8827, -87.6233),
('60602', 'IL', 'Chicago', 41.8830, -87.6376),
('77001', 'TX', 'Houston', 29.7511, -95.3677),
('77002', 'TX', 'Houston', 29.7565, -95.3686),
('85001', 'AZ', 'Phoenix', 33.4486, -112.0738),
('85002', 'AZ', 'Phoenix', 33.4110, -112.0814),
-- Add more ZIP codes as needed
('30301', 'GA', 'Atlanta', 33.7627, -84.4224),
('30302', 'GA', 'Atlanta', 33.7550, -84.3908),
('19101', 'PA', 'Philadelphia', 39.9527, -75.1635),
('19102', 'PA', 'Philadelphia', 39.9537, -75.1657);

-- =============================================================================
-- PHASE 4: MIGRATE EXISTING GEOGRAPHIC DATA
-- =============================================================================

-- Create temporary table for data migration tracking
CREATE TABLE IF NOT EXISTS "migration_log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "table_name" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "record_count" INTEGER NOT NULL DEFAULT 0,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "error_message" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- PHASE 5: CREATE SAMPLE SERVICE TYPE COVERAGE
-- =============================================================================

-- Sample service type coverage (adjust based on business requirements)
INSERT OR IGNORE INTO "service_type_zip_codes" ("id", "service_type_id", "zip_code", "priority")
SELECT 
    'stz-' || substr(hex(randomblob(8)), 1, 16),
    st.id,
    zc.zip_code,
    CASE 
        WHEN zc.state_code IN ('CA', 'NY', 'TX') THEN 10  -- High priority states
        WHEN zc.state_code IN ('FL', 'IL', 'PA') THEN 8   -- Medium priority states
        ELSE 5                                            -- Standard priority
    END as priority
FROM service_types st
CROSS JOIN zip_codes zc
WHERE st.active = true AND zc.active = true;

-- =============================================================================
-- PHASE 6: CREATE VIEWS FOR BACKWARD COMPATIBILITY
-- =============================================================================

-- View for quick auction eligibility lookup
CREATE VIEW IF NOT EXISTS "v_auction_eligible_buyers" AS
SELECT DISTINCT
    l.id as lead_id,
    l.service_type_id,
    l.zip_code,
    b.id as buyer_id,
    b.name as buyer_name,
    b.api_url,
    bsz.min_bid,
    bsz.max_bid,
    bsz.priority,
    bsc.ping_template,
    bsc.post_template,
    bsc.field_mappings
FROM leads l
JOIN service_type_zip_codes stz ON stz.service_type_id = l.service_type_id 
    AND stz.zip_code = l.zip_code
JOIN buyer_service_zip_codes bsz ON bsz.service_type_id = l.service_type_id 
    AND bsz.zip_code = l.zip_code
JOIN buyers b ON bsz.buyer_id = b.id
JOIN buyer_service_configs bsc ON bsc.buyer_id = b.id 
    AND bsc.service_type_id = l.service_type_id
WHERE l.status = 'PENDING'
    AND stz.active = true
    AND bsz.active = true
    AND b.active = true
    AND bsc.active = true;

-- View for geographic coverage analytics
CREATE VIEW IF NOT EXISTS "v_coverage_analytics" AS
SELECT 
    st.name as service_type,
    zc.state_code,
    zc.primary_city,
    COUNT(DISTINCT bsz.buyer_id) as buyer_count,
    MIN(bsz.min_bid) as min_bid_floor,
    MAX(bsz.max_bid) as max_bid_ceiling,
    AVG(bsz.priority) as avg_priority
FROM service_types st
JOIN service_type_zip_codes stz ON stz.service_type_id = st.id
JOIN zip_codes zc ON stz.zip_code = zc.zip_code
LEFT JOIN buyer_service_zip_codes bsz ON bsz.service_type_id = st.id 
    AND bsz.zip_code = zc.zip_code
    AND bsz.active = true
WHERE st.active = true 
    AND stz.active = true 
    AND zc.active = true
GROUP BY st.id, st.name, zc.state_code, zc.primary_city
ORDER BY st.name, zc.state_code, zc.primary_city;

-- =============================================================================
-- PHASE 7: CREATE TRIGGERS FOR DATA INTEGRITY
-- =============================================================================

-- Trigger to update timestamp on service_type_zip_codes
CREATE TRIGGER IF NOT EXISTS "update_service_type_zip_codes_timestamp"
AFTER UPDATE ON "service_type_zip_codes"
BEGIN
    UPDATE "service_type_zip_codes" 
    SET "updated_at" = CURRENT_TIMESTAMP 
    WHERE "id" = NEW."id";
END;

-- Trigger to update timestamp on buyer_service_zip_codes
CREATE TRIGGER IF NOT EXISTS "update_buyer_service_zip_codes_timestamp"
AFTER UPDATE ON "buyer_service_zip_codes"
BEGIN
    UPDATE "buyer_service_zip_codes" 
    SET "updated_at" = CURRENT_TIMESTAMP 
    WHERE "id" = NEW."id";
END;

-- Trigger to validate bid ranges
CREATE TRIGGER IF NOT EXISTS "validate_bid_range"
BEFORE INSERT ON "buyer_service_zip_codes"
WHEN NEW.min_bid > NEW.max_bid
BEGIN
    SELECT RAISE(ABORT, 'min_bid cannot be greater than max_bid');
END;

-- =============================================================================
-- PHASE 8: DATA VALIDATION QUERIES
-- =============================================================================

-- Check for orphaned records
SELECT 'Orphaned service_type_zip_codes' as check_type, COUNT(*) as count
FROM service_type_zip_codes stz
LEFT JOIN service_types st ON stz.service_type_id = st.id
WHERE st.id IS NULL

UNION ALL

SELECT 'Orphaned buyer_service_zip_codes' as check_type, COUNT(*) as count
FROM buyer_service_zip_codes bsz
LEFT JOIN buyers b ON bsz.buyer_id = b.id
WHERE b.id IS NULL

UNION ALL

SELECT 'Invalid bid ranges' as check_type, COUNT(*) as count
FROM buyer_service_zip_codes
WHERE min_bid > max_bid

UNION ALL

SELECT 'Missing ZIP code data' as check_type, COUNT(*) as count
FROM leads l
LEFT JOIN zip_codes zc ON l.zip_code = zc.zip_code
WHERE zc.zip_code IS NULL;

-- =============================================================================
-- MIGRATION COMPLETION LOG
-- =============================================================================

INSERT INTO "migration_log" ("id", "table_name", "operation", "record_count", "success")
VALUES 
('mig-' || substr(hex(randomblob(8)), 1, 16), 'zip_codes', 'CREATE_TABLE', 
 (SELECT COUNT(*) FROM zip_codes), true),
('mig-' || substr(hex(randomblob(8)), 1, 16), 'service_type_zip_codes', 'CREATE_TABLE', 
 (SELECT COUNT(*) FROM service_type_zip_codes), true),
('mig-' || substr(hex(randomblob(8)), 1, 16), 'buyer_service_zip_codes', 'CREATE_TABLE', 
 (SELECT COUNT(*) FROM buyer_service_zip_codes), true);

-- =============================================================================
-- PERFORMANCE TESTING QUERIES
-- =============================================================================

-- Test query performance for auction engine
EXPLAIN QUERY PLAN
SELECT DISTINCT
    b.id as buyer_id,
    b.name,
    b.api_url,
    bsz.min_bid,
    bsz.max_bid,
    bsz.priority
FROM buyer_service_zip_codes bsz
JOIN buyers b ON bsz.buyer_id = b.id
JOIN buyer_service_configs bsc ON bsc.buyer_id = b.id 
    AND bsc.service_type_id = bsz.service_type_id
WHERE bsz.service_type_id = '123'
    AND bsz.zip_code = '10001'
    AND bsz.active = true
    AND b.active = true
    AND bsc.active = true
ORDER BY bsz.priority DESC, bsz.max_bid DESC;

-- Clean up migration table (optional)
-- DROP TABLE IF EXISTS "migration_log";