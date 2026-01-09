-- ============================================================================
-- DATABASE CONFIGURATION - STEP 4a OF 6: FIELD MAPPING CONFIGURATION
-- ============================================================================
--
-- Migration: Update Modernize field_mappings to new FieldMappingConfig format with valueMap
-- Date: 2026-01-08
-- API Docs: https://apidoc.modernize.com/publishers/ping-post.html#ping-post-v3-api
--
-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │                        LEAD FLOW OVERVIEW                                │
-- │                                                                          │
-- │  [STEP 1] DynamicForm.tsx          → User fills form                    │
-- │      ↓ FormSubmission with RAW values                                   │
-- │  [STEP 2] /api/leads/route.ts      → Creates Lead in DB                 │
-- │      ↓ Lead added to processing queue                                   │
-- │  [STEP 3] auction/engine.ts        → Finds eligible buyers              │
-- │      ↓ Loads buyer configs from database                                │
-- │  [STEP 4a] THIS FILE               ← CONFIGURES FIELD MAPPINGS          │
-- │      ↓ FieldMappingConfig stored in buyer_service_configs.field_mappings │
-- │  [STEP 4b] database-buyer-loader.ts → Converts to TemplateMapping       │
-- │      ↓ Copies valueMap from database to TemplateEngine format           │
-- │  [STEP 5] templates/engine.ts      → Applies valueMap + transforms      │
-- │      ↓ valueMap FIRST: "within_3_months" → "1-6 months"                 │
-- │      ↓ transform SECOND: boolean → "Yes/No"                             │
-- │  [STEP 6] auction/engine.ts        → Sends PING → Selects winner → POST │
-- └─────────────────────────────────────────────────────────────────────────┘
--
-- KEY FIELDS FOR MODERNIZE WINDOWS:
-- ─────────────────────────────────
-- PING FIELDS (routing):
--   - postalCode (from zipCode)
--   - buyTimeframe (from timeframe, valueMap: "within_3_months" → "1-6 months")
--   - ownHome (from ownsHome, transform: boolean.yesNo → "Yes"/"No")
--   - service (static: "WINDOWS")
--   - tagId (static: "204670250")
--
-- POST-ONLY FIELDS (full lead data):
--   - NumberOfWindows (from numberOfWindows, valueMap: "9+" → "6-9")
--   - WindowsProjectScope (from projectScope, valueMap: "install" → "Install")
--   - firstName, lastName, phone, email, address, city, state
--   - trustedFormToken, leadIDToken
--   - homePhoneConsentLanguage (static)
--
-- SOURCE FIELD NOTES:
-- ───────────────────
-- TemplateEngine.prepareSourceData() FLATTENS formData to top level!
-- So use "numberOfWindows", NOT "formData.numberOfWindows"
--
-- VALID MODERNIZE VALUES (from API docs):
-- ───────────────────────────────────────
-- buyTimeframe: "Immediately", "1-6 months", "Don't know"
-- ownHome: "Yes", "No"
-- NumberOfWindows: "1", "2", "3-5", "6-9"
-- WindowsProjectScope: "Install", "Repair"
-- ============================================================================

-- Note: Run this against your production database
-- For PostgreSQL, the JSON syntax is the same. For other databases, adjust accordingly.

-- ====================
-- WINDOWS CONFIG
-- ====================
UPDATE buyer_service_configs
SET field_mappings = '{
  "version": "1.0",
  "mappings": [
    {
      "id": "m-postalCode",
      "sourceField": "zipCode",
      "targetField": "postalCode",
      "required": true,
      "order": 1,
      "includeInPing": true,
      "includeInPost": true,
      "description": "5-digit US zip code"
    },
    {
      "id": "m-buyTimeframe",
      "sourceField": "timeframe",
      "targetField": "buyTimeframe",
      "required": true,
      "order": 2,
      "includeInPing": true,
      "includeInPost": true,
      "description": "Project timeline - mapped to Modernize format",
      "valueMap": {
        "within_3_months": "1-6 months",
        "3_plus_months": "1-6 months",
        "not_sure": "Don''t know",
        "immediately": "Immediately"
      }
    },
    {
      "id": "m-ownHome",
      "sourceField": "ownsHome",
      "targetField": "ownHome",
      "transform": "boolean.yesNo",
      "required": true,
      "order": 3,
      "includeInPing": true,
      "includeInPost": true,
      "description": "Homeowner status - Yes/No"
    },
    {
      "id": "m-numberOfWindows",
      "sourceField": "numberOfWindows",
      "targetField": "NumberOfWindows",
      "required": true,
      "order": 4,
      "includeInPing": false,
      "includeInPost": true,
      "description": "Number of windows - POST only per Modernize API docs",
      "valueMap": {
        "1": "1",
        "2": "2",
        "3-5": "3-5",
        "6-9": "6-9",
        "9+": "6-9"
      }
    },
    {
      "id": "m-projectScope",
      "sourceField": "projectScope",
      "targetField": "WindowsProjectScope",
      "required": true,
      "order": 5,
      "includeInPing": false,
      "includeInPost": true,
      "description": "Project type - Install/Repair - POST only per Modernize API docs",
      "valueMap": {
        "repair": "Repair",
        "install": "Install"
      }
    },
    {
      "id": "m-firstName",
      "sourceField": "firstName",
      "targetField": "firstName",
      "required": true,
      "order": 10,
      "includeInPing": false,
      "includeInPost": true,
      "description": "Contact first name"
    },
    {
      "id": "m-lastName",
      "sourceField": "lastName",
      "targetField": "lastName",
      "required": true,
      "order": 11,
      "includeInPing": false,
      "includeInPost": true,
      "description": "Contact last name"
    },
    {
      "id": "m-phone",
      "sourceField": "phone",
      "targetField": "phone",
      "transform": "phone.digitsOnly",
      "required": true,
      "order": 12,
      "includeInPing": false,
      "includeInPost": true,
      "description": "Contact phone - digits only"
    },
    {
      "id": "m-email",
      "sourceField": "email",
      "targetField": "email",
      "required": true,
      "order": 13,
      "includeInPing": false,
      "includeInPost": true,
      "description": "Contact email"
    },
    {
      "id": "m-address",
      "sourceField": "address",
      "targetField": "address",
      "required": true,
      "order": 14,
      "includeInPing": false,
      "includeInPost": true,
      "description": "Street address"
    },
    {
      "id": "m-city",
      "sourceField": "city",
      "targetField": "city",
      "required": true,
      "order": 15,
      "includeInPing": false,
      "includeInPost": true,
      "description": "City"
    },
    {
      "id": "m-state",
      "sourceField": "state",
      "targetField": "state",
      "required": true,
      "order": 16,
      "includeInPing": false,
      "includeInPost": true,
      "description": "State abbreviation"
    },
    {
      "id": "m-trustedFormToken",
      "sourceField": "trustedFormCertUrl",
      "targetField": "trustedFormToken",
      "required": true,
      "order": 20,
      "includeInPing": false,
      "includeInPost": true,
      "description": "TrustedForm certificate URL"
    },
    {
      "id": "m-partnerSourceId",
      "sourceField": "complianceData.attribution.ref",
      "targetField": "partnerSourceId",
      "required": false,
      "defaultValue": "direct",
      "order": 21,
      "includeInPing": true,
      "includeInPost": true,
      "description": "Campaign/channel identifier"
    },
    {
      "id": "m-publisherSubId",
      "sourceField": "complianceData.attribution.affiliate_id",
      "targetField": "publisherSubId",
      "required": false,
      "order": 22,
      "includeInPing": true,
      "includeInPost": true,
      "description": "Transaction-level identifier"
    }
  ],
  "staticFields": {
    "tagId": "204670250",
    "service": "WINDOWS",
    "homePhoneConsentLanguage": "By clicking Submit, I agree to receive calls and texts, including by automated dialing systems, from My Contractor Now and its partners regarding home improvement services at the phone number provided. I understand consent is not required to make a purchase."
  },
  "meta": {
    "createdAt": "2026-01-08T00:00:00.000Z",
    "updatedAt": "2026-01-08T00:00:00.000Z",
    "notes": "Modernize Windows PING/POST config with database-driven valueMap"
  }
}'
WHERE buyer_id = (SELECT id FROM buyers WHERE name = 'Modernize')
  AND service_type_id = (SELECT id FROM service_types WHERE name = 'windows');

-- ====================
-- BATHROOMS CONFIG
-- ====================
UPDATE buyer_service_configs
SET field_mappings = '{
  "version": "1.0",
  "mappings": [
    {
      "id": "m-postalCode",
      "sourceField": "zipCode",
      "targetField": "postalCode",
      "required": true,
      "order": 1,
      "includeInPing": true,
      "includeInPost": true,
      "description": "5-digit US zip code"
    },
    {
      "id": "m-buyTimeframe",
      "sourceField": "timeframe",
      "targetField": "buyTimeframe",
      "required": true,
      "order": 2,
      "includeInPing": true,
      "includeInPost": true,
      "description": "Project timeline - mapped to Modernize format",
      "valueMap": {
        "within_3_months": "1-6 months",
        "3_plus_months": "1-6 months",
        "not_sure": "Don''t know",
        "immediately": "Immediately"
      }
    },
    {
      "id": "m-ownHome",
      "sourceField": "ownsHome",
      "targetField": "ownHome",
      "transform": "boolean.yesNo",
      "required": true,
      "order": 3,
      "includeInPing": true,
      "includeInPost": true,
      "description": "Homeowner status - Yes/No"
    },
    {
      "id": "m-optIn1",
      "sourceField": "projectScope",
      "targetField": "OptIn1",
      "required": false,
      "order": 4,
      "includeInPing": false,
      "includeInPost": true,
      "description": "Removing/adding walls? POST only per Modernize API docs",
      "valueMap": {
        "full_renovation": "Yes",
        "partial_remodel": "No",
        "new_bathroom": "Yes",
        "repair": "No"
      }
    },
    {
      "id": "m-firstName",
      "sourceField": "firstName",
      "targetField": "firstName",
      "required": true,
      "order": 10,
      "includeInPing": false,
      "includeInPost": true,
      "description": "Contact first name"
    },
    {
      "id": "m-lastName",
      "sourceField": "lastName",
      "targetField": "lastName",
      "required": true,
      "order": 11,
      "includeInPing": false,
      "includeInPost": true,
      "description": "Contact last name"
    },
    {
      "id": "m-phone",
      "sourceField": "phone",
      "targetField": "phone",
      "transform": "phone.digitsOnly",
      "required": true,
      "order": 12,
      "includeInPing": false,
      "includeInPost": true,
      "description": "Contact phone - digits only"
    },
    {
      "id": "m-email",
      "sourceField": "email",
      "targetField": "email",
      "required": true,
      "order": 13,
      "includeInPing": false,
      "includeInPost": true,
      "description": "Contact email"
    },
    {
      "id": "m-address",
      "sourceField": "address",
      "targetField": "address",
      "required": true,
      "order": 14,
      "includeInPing": false,
      "includeInPost": true,
      "description": "Street address"
    },
    {
      "id": "m-city",
      "sourceField": "city",
      "targetField": "city",
      "required": true,
      "order": 15,
      "includeInPing": false,
      "includeInPost": true,
      "description": "City"
    },
    {
      "id": "m-state",
      "sourceField": "state",
      "targetField": "state",
      "required": true,
      "order": 16,
      "includeInPing": false,
      "includeInPost": true,
      "description": "State abbreviation"
    },
    {
      "id": "m-trustedFormToken",
      "sourceField": "trustedFormCertUrl",
      "targetField": "trustedFormToken",
      "required": true,
      "order": 20,
      "includeInPing": false,
      "includeInPost": true,
      "description": "TrustedForm certificate URL"
    },
    {
      "id": "m-partnerSourceId",
      "sourceField": "complianceData.attribution.ref",
      "targetField": "partnerSourceId",
      "required": false,
      "defaultValue": "direct",
      "order": 21,
      "includeInPing": true,
      "includeInPost": true,
      "description": "Campaign/channel identifier"
    },
    {
      "id": "m-publisherSubId",
      "sourceField": "complianceData.attribution.affiliate_id",
      "targetField": "publisherSubId",
      "required": false,
      "order": 22,
      "includeInPing": true,
      "includeInPost": true,
      "description": "Transaction-level identifier"
    }
  ],
  "staticFields": {
    "tagId": "204670250",
    "service": "BATH_REMODEL",
    "homePhoneConsentLanguage": "By clicking Submit, I agree to receive calls and texts, including by automated dialing systems, from My Contractor Now and its partners regarding home improvement services at the phone number provided. I understand consent is not required to make a purchase."
  },
  "meta": {
    "createdAt": "2026-01-08T00:00:00.000Z",
    "updatedAt": "2026-01-08T00:00:00.000Z",
    "notes": "Modernize Bathroom Remodel PING/POST config with database-driven valueMap"
  }
}'
WHERE buyer_id = (SELECT id FROM buyers WHERE name = 'Modernize')
  AND service_type_id = (SELECT id FROM service_types WHERE name = 'bathrooms');

-- ====================
-- HVAC CONFIG
-- ====================
UPDATE buyer_service_configs
SET field_mappings = '{
  "version": "1.0",
  "mappings": [
    {
      "id": "m-postalCode",
      "sourceField": "zipCode",
      "targetField": "postalCode",
      "required": true,
      "order": 1,
      "includeInPing": true,
      "includeInPost": true,
      "description": "5-digit US zip code"
    },
    {
      "id": "m-buyTimeframe",
      "sourceField": "timeframe",
      "targetField": "buyTimeframe",
      "required": true,
      "order": 2,
      "includeInPing": true,
      "includeInPost": true,
      "description": "Project timeline - mapped to Modernize format",
      "valueMap": {
        "within_3_months": "1-6 months",
        "3_plus_months": "1-6 months",
        "not_sure": "Don''t know",
        "immediately": "Immediately"
      }
    },
    {
      "id": "m-ownHome",
      "sourceField": "ownsHome",
      "targetField": "ownHome",
      "transform": "boolean.yesNo",
      "required": true,
      "order": 3,
      "includeInPing": true,
      "includeInPost": true,
      "description": "Homeowner status - Yes/No"
    },
    {
      "id": "m-hvacInterest",
      "sourceField": "projectScope",
      "targetField": "HVACInterest",
      "required": true,
      "order": 4,
      "includeInPing": false,
      "includeInPost": true,
      "description": "HVAC project type - POST only per Modernize API docs",
      "valueMap": {
        "install_ac": "Install Central AC",
        "repair_ac": "Repair Central AC",
        "install_heating": "Install Central Heating",
        "repair_heating": "Repair Central Heating",
        "install_boiler": "Install Boiler/Radiator",
        "repair_boiler": "Repair Boiler/Radiator"
      }
    },
    {
      "id": "m-firstName",
      "sourceField": "firstName",
      "targetField": "firstName",
      "required": true,
      "order": 10,
      "includeInPing": false,
      "includeInPost": true,
      "description": "Contact first name"
    },
    {
      "id": "m-lastName",
      "sourceField": "lastName",
      "targetField": "lastName",
      "required": true,
      "order": 11,
      "includeInPing": false,
      "includeInPost": true,
      "description": "Contact last name"
    },
    {
      "id": "m-phone",
      "sourceField": "phone",
      "targetField": "phone",
      "transform": "phone.digitsOnly",
      "required": true,
      "order": 12,
      "includeInPing": false,
      "includeInPost": true,
      "description": "Contact phone - digits only"
    },
    {
      "id": "m-email",
      "sourceField": "email",
      "targetField": "email",
      "required": true,
      "order": 13,
      "includeInPing": false,
      "includeInPost": true,
      "description": "Contact email"
    },
    {
      "id": "m-address",
      "sourceField": "address",
      "targetField": "address",
      "required": true,
      "order": 14,
      "includeInPing": false,
      "includeInPost": true,
      "description": "Street address"
    },
    {
      "id": "m-city",
      "sourceField": "city",
      "targetField": "city",
      "required": true,
      "order": 15,
      "includeInPing": false,
      "includeInPost": true,
      "description": "City"
    },
    {
      "id": "m-state",
      "sourceField": "state",
      "targetField": "state",
      "required": true,
      "order": 16,
      "includeInPing": false,
      "includeInPost": true,
      "description": "State abbreviation"
    },
    {
      "id": "m-trustedFormToken",
      "sourceField": "trustedFormCertUrl",
      "targetField": "trustedFormToken",
      "required": true,
      "order": 20,
      "includeInPing": false,
      "includeInPost": true,
      "description": "TrustedForm certificate URL"
    },
    {
      "id": "m-partnerSourceId",
      "sourceField": "complianceData.attribution.ref",
      "targetField": "partnerSourceId",
      "required": false,
      "defaultValue": "direct",
      "order": 21,
      "includeInPing": true,
      "includeInPost": true,
      "description": "Campaign/channel identifier"
    },
    {
      "id": "m-publisherSubId",
      "sourceField": "complianceData.attribution.affiliate_id",
      "targetField": "publisherSubId",
      "required": false,
      "order": 22,
      "includeInPing": true,
      "includeInPost": true,
      "description": "Transaction-level identifier"
    }
  ],
  "staticFields": {
    "tagId": "204670250",
    "service": "HVAC",
    "homePhoneConsentLanguage": "By clicking Submit, I agree to receive calls and texts, including by automated dialing systems, from My Contractor Now and its partners regarding home improvement services at the phone number provided. I understand consent is not required to make a purchase."
  },
  "meta": {
    "createdAt": "2026-01-08T00:00:00.000Z",
    "updatedAt": "2026-01-08T00:00:00.000Z",
    "notes": "Modernize HVAC PING/POST config with database-driven valueMap"
  }
}'
WHERE buyer_id = (SELECT id FROM buyers WHERE name = 'Modernize')
  AND service_type_id = (SELECT id FROM service_types WHERE name = 'hvac');

-- ====================
-- ROOFING CONFIG
-- ====================
UPDATE buyer_service_configs
SET field_mappings = '{
  "version": "1.0",
  "mappings": [
    {
      "id": "m-postalCode",
      "sourceField": "zipCode",
      "targetField": "postalCode",
      "required": true,
      "order": 1,
      "includeInPing": true,
      "includeInPost": true,
      "description": "5-digit US zip code"
    },
    {
      "id": "m-buyTimeframe",
      "sourceField": "timeframe",
      "targetField": "buyTimeframe",
      "required": true,
      "order": 2,
      "includeInPing": true,
      "includeInPost": true,
      "description": "Project timeline - mapped to Modernize format",
      "valueMap": {
        "within_3_months": "1-6 months",
        "3_plus_months": "1-6 months",
        "not_sure": "Don''t know",
        "immediately": "Immediately"
      }
    },
    {
      "id": "m-ownHome",
      "sourceField": "ownsHome",
      "targetField": "ownHome",
      "transform": "boolean.yesNo",
      "required": true,
      "order": 3,
      "includeInPing": true,
      "includeInPost": true,
      "description": "Homeowner status - Yes/No"
    },
    {
      "id": "m-roofingPlan",
      "sourceField": "projectScope",
      "targetField": "RoofingPlan",
      "required": true,
      "order": 4,
      "includeInPing": false,
      "includeInPost": true,
      "description": "Roofing project type - POST only per Modernize API docs",
      "valueMap": {
        "repair": "Repair existing roof",
        "replacement": "Completely replace roof",
        "installation": "Install roof on new construction"
      }
    },
    {
      "id": "m-firstName",
      "sourceField": "firstName",
      "targetField": "firstName",
      "required": true,
      "order": 10,
      "includeInPing": false,
      "includeInPost": true,
      "description": "Contact first name"
    },
    {
      "id": "m-lastName",
      "sourceField": "lastName",
      "targetField": "lastName",
      "required": true,
      "order": 11,
      "includeInPing": false,
      "includeInPost": true,
      "description": "Contact last name"
    },
    {
      "id": "m-phone",
      "sourceField": "phone",
      "targetField": "phone",
      "transform": "phone.digitsOnly",
      "required": true,
      "order": 12,
      "includeInPing": false,
      "includeInPost": true,
      "description": "Contact phone - digits only"
    },
    {
      "id": "m-email",
      "sourceField": "email",
      "targetField": "email",
      "required": true,
      "order": 13,
      "includeInPing": false,
      "includeInPost": true,
      "description": "Contact email"
    },
    {
      "id": "m-address",
      "sourceField": "address",
      "targetField": "address",
      "required": true,
      "order": 14,
      "includeInPing": false,
      "includeInPost": true,
      "description": "Street address"
    },
    {
      "id": "m-city",
      "sourceField": "city",
      "targetField": "city",
      "required": true,
      "order": 15,
      "includeInPing": false,
      "includeInPost": true,
      "description": "City"
    },
    {
      "id": "m-state",
      "sourceField": "state",
      "targetField": "state",
      "required": true,
      "order": 16,
      "includeInPing": false,
      "includeInPost": true,
      "description": "State abbreviation"
    },
    {
      "id": "m-trustedFormToken",
      "sourceField": "trustedFormCertUrl",
      "targetField": "trustedFormToken",
      "required": true,
      "order": 20,
      "includeInPing": false,
      "includeInPost": true,
      "description": "TrustedForm certificate URL"
    },
    {
      "id": "m-partnerSourceId",
      "sourceField": "complianceData.attribution.ref",
      "targetField": "partnerSourceId",
      "required": false,
      "defaultValue": "direct",
      "order": 21,
      "includeInPing": true,
      "includeInPost": true,
      "description": "Campaign/channel identifier"
    },
    {
      "id": "m-publisherSubId",
      "sourceField": "complianceData.attribution.affiliate_id",
      "targetField": "publisherSubId",
      "required": false,
      "order": 22,
      "includeInPing": true,
      "includeInPost": true,
      "description": "Transaction-level identifier"
    }
  ],
  "staticFields": {
    "tagId": "204670250",
    "service": "ROOFING_ASPHALT",
    "homePhoneConsentLanguage": "By clicking Submit, I agree to receive calls and texts, including by automated dialing systems, from My Contractor Now and its partners regarding home improvement services at the phone number provided. I understand consent is not required to make a purchase."
  },
  "meta": {
    "createdAt": "2026-01-08T00:00:00.000Z",
    "updatedAt": "2026-01-08T00:00:00.000Z",
    "notes": "Modernize Roofing PING/POST config with database-driven valueMap. Note: service type may need to be dynamically set based on roof material."
  }
}'
WHERE buyer_id = (SELECT id FROM buyers WHERE name = 'Modernize')
  AND service_type_id = (SELECT id FROM service_types WHERE name = 'roofing');

-- Verification query (run after migration)
-- SELECT b.name, st.name, json_extract(bsc.field_mappings, '$.version') as version
-- FROM buyer_service_configs bsc
-- JOIN buyers b ON bsc.buyer_id = b.id
-- JOIN service_types st ON bsc.service_type_id = st.id
-- WHERE b.name = 'Modernize';
