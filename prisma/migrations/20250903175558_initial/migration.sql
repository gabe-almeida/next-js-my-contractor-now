-- CreateTable
CREATE TABLE "service_types" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "form_schema" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "buyers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'CONTRACTOR',
    "api_url" TEXT NOT NULL,
    "auth_config" TEXT,
    "ping_timeout" INTEGER NOT NULL DEFAULT 30,
    "post_timeout" INTEGER NOT NULL DEFAULT 60,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "contact_name" TEXT,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "business_email" TEXT,
    "business_phone" TEXT,
    "additional_emails" TEXT,
    "additional_phones" TEXT,
    "additional_contacts" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "buyer_service_configs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "buyer_id" TEXT NOT NULL,
    "service_type_id" TEXT NOT NULL,
    "ping_template" TEXT NOT NULL,
    "post_template" TEXT NOT NULL,
    "field_mappings" TEXT NOT NULL,
    "requires_trustedform" BOOLEAN NOT NULL DEFAULT false,
    "requires_jornaya" BOOLEAN NOT NULL DEFAULT false,
    "compliance_config" TEXT,
    "min_bid" REAL NOT NULL DEFAULT 0.00,
    "max_bid" REAL NOT NULL DEFAULT 999.99,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "buyer_service_configs_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "buyers" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "buyer_service_configs_service_type_id_fkey" FOREIGN KEY ("service_type_id") REFERENCES "service_types" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "service_type_id" TEXT NOT NULL,
    "form_data" TEXT NOT NULL,
    "zip_code" TEXT NOT NULL,
    "owns_home" BOOLEAN NOT NULL,
    "timeframe" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "winning_buyer_id" TEXT,
    "winning_bid" REAL,
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

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lead_id" TEXT NOT NULL,
    "buyer_id" TEXT NOT NULL,
    "action_type" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "response" TEXT,
    "status" TEXT NOT NULL,
    "bid_amount" REAL,
    "response_time" INTEGER,
    "error_message" TEXT,
    "compliance_included" BOOLEAN NOT NULL DEFAULT false,
    "trusted_form_present" BOOLEAN NOT NULL DEFAULT false,
    "jornaya_present" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "transactions_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "transactions_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "buyers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "compliance_audit_log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lead_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "event_data" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "compliance_audit_log_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "buyer_service_zip_codes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "buyer_id" TEXT NOT NULL,
    "service_type_id" TEXT NOT NULL,
    "zip_code" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "max_leads_per_day" INTEGER,
    "min_bid" REAL,
    "max_bid" REAL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "buyer_service_zip_codes_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "buyers" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "buyer_service_zip_codes_service_type_id_fkey" FOREIGN KEY ("service_type_id") REFERENCES "service_types" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "zip_code_metadata" (
    "zip_code" TEXT NOT NULL PRIMARY KEY,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "county" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "timezone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "service_types_name_key" ON "service_types"("name");

-- CreateIndex
CREATE UNIQUE INDEX "buyer_service_configs_buyer_id_service_type_id_key" ON "buyer_service_configs"("buyer_id", "service_type_id");

-- CreateIndex
CREATE INDEX "leads_status_idx" ON "leads"("status");

-- CreateIndex
CREATE INDEX "leads_zip_code_idx" ON "leads"("zip_code");

-- CreateIndex
CREATE INDEX "leads_created_at_idx" ON "leads"("created_at");

-- CreateIndex
CREATE INDEX "leads_trusted_form_cert_id_idx" ON "leads"("trusted_form_cert_id");

-- CreateIndex
CREATE INDEX "leads_jornaya_lead_id_idx" ON "leads"("jornaya_lead_id");

-- CreateIndex
CREATE INDEX "leads_lead_quality_score_idx" ON "leads"("lead_quality_score");

-- CreateIndex
CREATE INDEX "transactions_lead_id_idx" ON "transactions"("lead_id");

-- CreateIndex
CREATE INDEX "transactions_action_type_idx" ON "transactions"("action_type");

-- CreateIndex
CREATE INDEX "transactions_status_idx" ON "transactions"("status");

-- CreateIndex
CREATE INDEX "transactions_created_at_idx" ON "transactions"("created_at");

-- CreateIndex
CREATE INDEX "transactions_compliance_included_idx" ON "transactions"("compliance_included");

-- CreateIndex
CREATE INDEX "compliance_audit_log_lead_id_idx" ON "compliance_audit_log"("lead_id");

-- CreateIndex
CREATE INDEX "compliance_audit_log_event_type_idx" ON "compliance_audit_log"("event_type");

-- CreateIndex
CREATE INDEX "compliance_audit_log_created_at_idx" ON "compliance_audit_log"("created_at");

-- CreateIndex
CREATE INDEX "buyer_service_zip_codes_buyer_id_service_type_id_idx" ON "buyer_service_zip_codes"("buyer_id", "service_type_id");

-- CreateIndex
CREATE INDEX "buyer_service_zip_codes_service_type_id_zip_code_idx" ON "buyer_service_zip_codes"("service_type_id", "zip_code");

-- CreateIndex
CREATE INDEX "buyer_service_zip_codes_zip_code_idx" ON "buyer_service_zip_codes"("zip_code");

-- CreateIndex
CREATE INDEX "buyer_service_zip_codes_active_idx" ON "buyer_service_zip_codes"("active");

-- CreateIndex
CREATE UNIQUE INDEX "buyer_service_zip_codes_buyer_id_service_type_id_zip_code_key" ON "buyer_service_zip_codes"("buyer_id", "service_type_id", "zip_code");

-- CreateIndex
CREATE INDEX "zip_code_metadata_state_idx" ON "zip_code_metadata"("state");

-- CreateIndex
CREATE INDEX "zip_code_metadata_city_state_idx" ON "zip_code_metadata"("city", "state");
