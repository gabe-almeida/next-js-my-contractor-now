-- AlterTable: Add webhook security fields to buyers table
ALTER TABLE buyers ADD COLUMN webhook_secret TEXT;
ALTER TABLE buyers ADD COLUMN auth_type TEXT;

-- RedefineTables: Convert Float to Decimal (SQLite stores as TEXT)
-- Note: SQLite doesn't have native DECIMAL type, Prisma stores as TEXT and handles conversion

-- Update buyer_service_configs: minBid and maxBid
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_buyer_service_configs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "buyer_id" TEXT NOT NULL,
    "service_type_id" TEXT NOT NULL,
    "ping_template" TEXT NOT NULL,
    "post_template" TEXT NOT NULL,
    "field_mappings" TEXT NOT NULL,
    "requires_trustedform" BOOLEAN NOT NULL DEFAULT false,
    "requires_jornaya" BOOLEAN NOT NULL DEFAULT false,
    "compliance_config" TEXT,
    "min_bid" DECIMAL NOT NULL DEFAULT 0.00,
    "max_bid" DECIMAL NOT NULL DEFAULT 999.99,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "buyer_service_configs_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "buyers" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "buyer_service_configs_service_type_id_fkey" FOREIGN KEY ("service_type_id") REFERENCES "service_types" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_buyer_service_configs" SELECT * FROM "buyer_service_configs";
DROP TABLE "buyer_service_configs";
ALTER TABLE "new_buyer_service_configs" RENAME TO "buyer_service_configs";

CREATE UNIQUE INDEX "buyer_service_configs_buyer_id_service_type_id_key" ON "buyer_service_configs"("buyer_id", "service_type_id");

-- Update leads: winningBid
CREATE TABLE "new_leads" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "service_type_id" TEXT NOT NULL,
    "form_data" TEXT NOT NULL,
    "zip_code" TEXT NOT NULL,
    "owns_home" BOOLEAN NOT NULL,
    "timeframe" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "winning_buyer_id" TEXT,
    "winning_bid" DECIMAL,
    "trusted_form_cert_url" TEXT,
    "trusted_form_cert_id" TEXT,
    "jornaya_lead_id" TEXT,
    "compliance_data" TEXT,
    "lead_quality_score" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "leads_service_type_id_fkey" FOREIGN KEY ("service_type_id") REFERENCES "service_types" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "leads_winning_buyer_id_fkey" FOREIGN KEY ("winning_buyer_id") REFERENCES "buyers" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_leads" SELECT * FROM "leads";
DROP TABLE "leads";
ALTER TABLE "new_leads" RENAME TO "leads";

CREATE INDEX "leads_status_idx" ON "leads"("status");
CREATE INDEX "leads_zip_code_idx" ON "leads"("zip_code");
CREATE INDEX "leads_created_at_idx" ON "leads"("created_at");
CREATE INDEX "leads_trusted_form_cert_id_idx" ON "leads"("trusted_form_cert_id");
CREATE INDEX "leads_jornaya_lead_id_idx" ON "leads"("jornaya_lead_id");
CREATE INDEX "leads_lead_quality_score_idx" ON "leads"("lead_quality_score");

-- Update transactions: bidAmount
CREATE TABLE "new_transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lead_id" TEXT NOT NULL,
    "buyer_id" TEXT NOT NULL,
    "action_type" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "response" TEXT,
    "status" TEXT NOT NULL,
    "bid_amount" DECIMAL,
    "response_time" INTEGER,
    "error_message" TEXT,
    "compliance_included" BOOLEAN NOT NULL DEFAULT false,
    "trusted_form_present" BOOLEAN NOT NULL DEFAULT false,
    "jornaya_present" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "transactions_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "transactions_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "buyers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_transactions" SELECT * FROM "transactions";
DROP TABLE "transactions";
ALTER TABLE "new_transactions" RENAME TO "transactions";

CREATE INDEX "transactions_lead_id_idx" ON "transactions"("lead_id");
CREATE INDEX "transactions_action_type_idx" ON "transactions"("action_type");
CREATE INDEX "transactions_status_idx" ON "transactions"("status");
CREATE INDEX "transactions_created_at_idx" ON "transactions"("created_at");
CREATE INDEX "transactions_compliance_included_idx" ON "transactions"("compliance_included");

-- Update buyer_service_zip_codes: minBid and maxBid
CREATE TABLE "new_buyer_service_zip_codes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "buyer_id" TEXT NOT NULL,
    "service_type_id" TEXT NOT NULL,
    "zip_code" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "max_leads_per_day" INTEGER,
    "min_bid" DECIMAL,
    "max_bid" DECIMAL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "buyer_service_zip_codes_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "buyers" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "buyer_service_zip_codes_service_type_id_fkey" FOREIGN KEY ("service_type_id") REFERENCES "service_types" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_buyer_service_zip_codes" SELECT * FROM "buyer_service_zip_codes";
DROP TABLE "buyer_service_zip_codes";
ALTER TABLE "new_buyer_service_zip_codes" RENAME TO "buyer_service_zip_codes";

CREATE UNIQUE INDEX "buyer_service_zip_codes_buyer_id_service_type_id_zip_code_key" ON "buyer_service_zip_codes"("buyer_id", "service_type_id", "zip_code");
CREATE INDEX "buyer_service_zip_codes_buyer_id_service_type_id_idx" ON "buyer_service_zip_codes"("buyer_id", "service_type_id");
CREATE INDEX "buyer_service_zip_codes_service_type_id_zip_code_idx" ON "buyer_service_zip_codes"("service_type_id", "zip_code");
CREATE INDEX "buyer_service_zip_codes_zip_code_idx" ON "buyer_service_zip_codes"("zip_code");
CREATE INDEX "buyer_service_zip_codes_active_idx" ON "buyer_service_zip_codes"("active");

PRAGMA foreign_keys=ON;
