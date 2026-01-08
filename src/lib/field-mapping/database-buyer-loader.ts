/**
 * ============================================================================
 * LEAD FLOW DOCUMENTATION - STEP 4 OF 6: DATABASE BUYER LOADER
 * ============================================================================
 *
 * WHAT: Loads buyer configurations from database including field mappings
 * WHY:  Database-driven config allows admin to change mappings without code
 * WHEN: Called by auction engine when loading buyer configs for PING/POST
 *
 * PREVIOUS STEP: src/lib/auction/engine.ts (getEligibleBuyers)
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │                        LEAD FLOW OVERVIEW                                │
 * │                                                                          │
 * │  [STEP 1] DynamicForm.tsx          → Form submission                    │
 * │      ↓ FormSubmission object                                            │
 * │  [STEP 2] /api/leads/route.ts      → Creates Lead in DB                 │
 * │      ↓ Lead added to processing queue                                   │
 * │  [STEP 3] auction/engine.ts        → Finds eligible buyers              │
 * │      ↓ Buyer configs loaded from database                               │
 * │  [STEP 4] database-buyer-loader.ts ← YOU ARE HERE                       │
 * │      ↓ Converts to TemplateMapping with valueMap                        │
 * │  [STEP 5] templates/engine.ts      → Applies valueMap + transforms      │
 * │      ↓ Generates PING/POST payloads                                     │
 * │  [STEP 6] auction/engine.ts        → Sends PING → Selects winner → POST │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * DATABASE TABLES USED:
 * - Buyer: Buyer info (name, apiUrl, authConfig, pingTimeout, postTimeout)
 * - BuyerServiceConfig: Per-service settings (fieldMappings, pingTemplate, etc.)
 * - ServiceType: Service type metadata
 *
 * KEY FUNCTION: toServiceConfig()
 * - Loads FieldMappingConfig from BuyerServiceConfig.fieldMappings JSON
 * - Converts FieldMapping[] to TemplateMapping[] for TemplateEngine
 * - CRITICAL: Copies valueMap from database to TemplateMapping!
 *   This is how database-driven value conversion works.
 *
 * VALUE MAPPING FLOW:
 * 1. Admin configures valueMap in BuyerServiceConfig.fieldMappings JSON:
 *    { "sourceField": "timeframe", "valueMap": { "within_3_months": "1-6 months" } }
 * 2. toServiceConfig() copies valueMap to TemplateMapping
 * 3. TemplateEngine.processMapping() applies valueMap before transforms
 * 4. Result: "within_3_months" becomes "1-6 months" in PING/POST payload
 *
 * No hardcoded buyer-specific logic needed - all configurable from Admin UI!
 *
 * NEXT STEP: src/lib/templates/engine.ts (TemplateEngine.transform)
 * ============================================================================
 */

import { prisma } from "@/lib/prisma";
import { loadFieldMappingConfig, applyFieldMappings } from "./configuration-service";
import {
  FieldMappingConfig,
  TransformError,
  createEmptyFieldMappingConfig,
} from "@/types/field-mapping";
import { decrypt } from "@/lib/security/encryption";
import {
  BuyerConfig,
  BuyerServiceConfig,
  TemplateMapping,
} from "../templates/types";

/**
 * Database-loaded buyer configuration
 *
 * WHY: Matches the structure expected by auction engine
 * WHEN: Returned from loadBuyerConfig
 * HOW: Built from database records
 */
export interface DatabaseBuyerConfig {
  id: string;
  name: string;
  apiUrl: string | null;
  active: boolean;
  authConfig: DatabaseAuthConfig;
  globalSettings: DatabaseGlobalSettings;
  pingTimeout: number;
  postTimeout: number;
  complianceFieldMappings: ComplianceFieldMappings | null;
}

/**
 * Compliance field mappings from database
 * Allows each buyer to specify their preferred field names
 */
export interface ComplianceFieldMappings {
  trustedForm?: {
    certUrl?: string[];
    certId?: string[];
  };
  jornaya?: {
    leadId?: string[];
  };
  tcpa?: {
    consent?: string[];
    timestamp?: string[];
  };
  technical?: {
    ipAddress?: string[];
    userAgent?: string[];
    timestamp?: string[];
  };
  geo?: {
    latitude?: string[];
    longitude?: string[];
    city?: string[];
    state?: string[];
  };
}

/**
 * Database-loaded service configuration
 *
 * WHY: Contains field mappings for PING/POST payload generation
 * WHEN: Used during auction to transform lead data
 * HOW: Built from BuyerServiceConfig record with parsed fieldMappings
 */
export interface DatabaseServiceConfig {
  buyerId: string;
  serviceTypeId: string;
  serviceTypeName: string;
  active: boolean;
  priority: number;
  minBid: number;
  maxBid: number;
  requiresTrustedForm: boolean;
  requiresJornaya: boolean;
  fieldMappingConfig: FieldMappingConfig;
  webhookConfig: DatabaseWebhookConfig;
  complianceConfig: Record<string, unknown> | null;
}

export interface DatabaseAuthConfig {
  type: "apiKey" | "bearer" | "basic" | "oauth" | "none";
  credentials: Record<string, string>;
  headers?: Record<string, string>;
}

export interface DatabaseGlobalSettings {
  defaultTimeout: number;
  maxConcurrentRequests: number;
  rateLimiting: {
    requestsPerMinute: number;
    requestsPerHour: number;
    requestsPerDay: number;
  };
  complianceRequirements: {
    requireTrustedForm: boolean;
    requireJornaya: boolean;
    requireTcpaConsent: boolean;
  };
}

export interface DatabaseWebhookConfig {
  pingUrl: string;
  postUrl: string;
  timeouts: { ping: number; post: number };
}

/**
 * Cache for buyer configurations
 */
const buyerCache = new Map<string, { config: DatabaseBuyerConfig; expires: number }>();
const serviceConfigCache = new Map<string, { config: DatabaseServiceConfig; expires: number }>();
const CACHE_TTL_MS = 60000; // 1 minute

/**
 * Load buyer configuration from database
 *
 * WHY: Get buyer details for authentication and settings
 * WHEN: Before sending PING/POST requests
 * HOW: Query database, decrypt sensitive data, cache result
 *
 * @param buyerId - The buyer ID to load
 * @param skipCache - Force fresh load from database
 */
export async function loadBuyerConfig(
  buyerId: string,
  skipCache = false
): Promise<DatabaseBuyerConfig | null> {
  const cacheKey = buyerId;

  // Check cache
  if (!skipCache) {
    const cached = buyerCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return cached.config;
    }
  }

  // Load from database with all necessary fields
  const buyer = await prisma.buyer.findUnique({
    where: { id: buyerId },
    select: {
      id: true,
      name: true,
      apiUrl: true,
      authConfig: true,
      webhookSecret: true,
      active: true,
      createdAt: true,
      pingTimeout: true,
      postTimeout: true,
      complianceFieldMappings: true,
    },
  });

  if (!buyer) {
    return null;
  }

  // Parse and decrypt auth config
  let authConfig: DatabaseAuthConfig = {
    type: "none",
    credentials: {},
  };

  if (buyer.authConfig) {
    try {
      const parsed = JSON.parse(buyer.authConfig);
      authConfig = {
        type: parsed.type || "none",
        credentials: {},
        headers: parsed.headers,
      };

      // Decrypt sensitive credentials
      for (const [key, value] of Object.entries(parsed.credentials || {})) {
        if (typeof value === "string") {
          try {
            authConfig.credentials[key] = decrypt(value);
          } catch {
            // If decryption fails, use raw value (might be unencrypted)
            authConfig.credentials[key] = value;
          }
        }
      }
    } catch (error) {
      console.error(`Failed to parse auth config for buyer ${buyerId}:`, error);
    }
  }

  // Parse compliance field mappings if present
  let complianceFieldMappings: ComplianceFieldMappings | null = null;
  if (buyer.complianceFieldMappings) {
    try {
      complianceFieldMappings = JSON.parse(buyer.complianceFieldMappings);
    } catch (error) {
      console.error(`Failed to parse compliance field mappings for buyer ${buyerId}:`, error);
    }
  }

  // Build global settings with defaults
  // Use buyer's configured timeouts, falling back to defaults
  const globalSettings: DatabaseGlobalSettings = {
    defaultTimeout: buyer.pingTimeout * 1000 || 5000, // Convert seconds to ms
    maxConcurrentRequests: 50,
    rateLimiting: {
      requestsPerMinute: 100,
      requestsPerHour: 2000,
      requestsPerDay: 20000,
    },
    complianceRequirements: {
      requireTrustedForm: false,
      requireJornaya: false,
      requireTcpaConsent: true,
    },
  };

  const config: DatabaseBuyerConfig = {
    id: buyer.id,
    name: buyer.name,
    apiUrl: buyer.apiUrl,
    active: buyer.active,
    authConfig,
    globalSettings,
    pingTimeout: buyer.pingTimeout * 1000, // Convert seconds to ms
    postTimeout: buyer.postTimeout * 1000, // Convert seconds to ms
    complianceFieldMappings,
  };

  // Update cache
  buyerCache.set(cacheKey, {
    config,
    expires: Date.now() + CACHE_TTL_MS,
  });

  return config;
}

/**
 * Load service configuration from database
 *
 * WHY: Get field mappings and settings for a buyer + service combination
 * WHEN: During auction to transform lead data
 * HOW: Query database, parse JSON fields, cache result
 *
 * @param buyerId - The buyer ID
 * @param serviceTypeId - The service type ID
 * @param skipCache - Force fresh load from database
 */
export async function loadServiceConfig(
  buyerId: string,
  serviceTypeId: string,
  skipCache = false
): Promise<DatabaseServiceConfig | null> {
  const cacheKey = `${buyerId}:${serviceTypeId}`;

  // Check cache
  if (!skipCache) {
    const cached = serviceConfigCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return cached.config;
    }
  }

  // Load from database with buyer and service type info
  const serviceConfig = await prisma.buyerServiceConfig.findUnique({
    where: {
      buyerId_serviceTypeId: { buyerId, serviceTypeId },
    },
    include: {
      buyer: { select: { apiUrl: true } },
      serviceType: { select: { displayName: true } },
    },
  });

  if (!serviceConfig) {
    return null;
  }

  // Parse field mappings
  let fieldMappingConfig: FieldMappingConfig;
  try {
    fieldMappingConfig = serviceConfig.fieldMappings
      ? JSON.parse(serviceConfig.fieldMappings)
      : createEmptyFieldMappingConfig();
  } catch {
    fieldMappingConfig = createEmptyFieldMappingConfig();
  }

  // Parse ping/post templates to extract webhook URLs
  let webhookConfig: DatabaseWebhookConfig = {
    pingUrl: "",
    postUrl: "",
    timeouts: { ping: 3000, post: 8000 },
  };

  try {
    if (serviceConfig.pingTemplate) {
      const pingTemplate = JSON.parse(serviceConfig.pingTemplate);
      webhookConfig.pingUrl = pingTemplate.url || "";
      if (pingTemplate.timeout) {
        webhookConfig.timeouts.ping = pingTemplate.timeout;
      }
    }
    if (serviceConfig.postTemplate) {
      const postTemplate = JSON.parse(serviceConfig.postTemplate);
      webhookConfig.postUrl = postTemplate.url || "";
      if (postTemplate.timeout) {
        webhookConfig.timeouts.post = postTemplate.timeout;
      }
    }
  } catch {
    // Use defaults if parsing fails
  }

  // Fallback to buyer's API URL if webhook URLs not specified
  if (!webhookConfig.pingUrl && serviceConfig.buyer.apiUrl) {
    webhookConfig.pingUrl = `${serviceConfig.buyer.apiUrl}/ping`;
  }
  if (!webhookConfig.postUrl && serviceConfig.buyer.apiUrl) {
    webhookConfig.postUrl = `${serviceConfig.buyer.apiUrl}/post`;
  }

  // Parse compliance config
  let complianceConfig: Record<string, unknown> | null = null;
  if (serviceConfig.complianceConfig) {
    try {
      complianceConfig = JSON.parse(serviceConfig.complianceConfig);
    } catch {
      // Ignore parse errors
    }
  }

  const config: DatabaseServiceConfig = {
    buyerId: serviceConfig.buyerId,
    serviceTypeId: serviceConfig.serviceTypeId,
    serviceTypeName: serviceConfig.serviceType.displayName,
    active: serviceConfig.active,
    priority: 100, // Default priority, could be stored in metadata
    minBid: Number(serviceConfig.minBid),
    maxBid: Number(serviceConfig.maxBid),
    requiresTrustedForm: serviceConfig.requiresTrustedForm,
    requiresJornaya: serviceConfig.requiresJornaya,
    fieldMappingConfig,
    webhookConfig,
    complianceConfig,
  };

  // Update cache
  serviceConfigCache.set(cacheKey, {
    config,
    expires: Date.now() + CACHE_TTL_MS,
  });

  return config;
}

/**
 * Load all active buyers for a service type
 *
 * WHY: Find all buyers that can participate in auction for this service
 * WHEN: Starting an auction to get eligible buyers
 * HOW: Query database for active buyers with active service configs
 *
 * @param serviceTypeId - The service type ID
 * @returns Array of buyer IDs with their service configs
 */
export async function loadActiveBuyersForService(
  serviceTypeId: string
): Promise<Array<{ buyerId: string; serviceConfig: DatabaseServiceConfig }>> {
  const serviceConfigs = await prisma.buyerServiceConfig.findMany({
    where: {
      serviceTypeId,
      active: true,
      buyer: { active: true },
    },
    include: {
      buyer: { select: { id: true, name: true, apiUrl: true } },
      serviceType: { select: { displayName: true } },
    },
    orderBy: {
      minBid: "desc", // Higher bidders first as proxy for priority
    },
  });

  const results: Array<{ buyerId: string; serviceConfig: DatabaseServiceConfig }> = [];

  for (const config of serviceConfigs) {
    const serviceConfig = await loadServiceConfig(config.buyerId, serviceTypeId);
    if (serviceConfig) {
      results.push({
        buyerId: config.buyerId,
        serviceConfig,
      });
    }
  }

  return results;
}

/**
 * Generate PING payload using database field mappings
 *
 * WHY: Transform lead data into buyer-expected format for PING
 * WHEN: Sending PING request during auction
 * HOW: Apply field mappings from database configuration
 *
 * @param leadData - The lead data to transform
 * @param serviceConfig - The service configuration with field mappings
 * @returns Transformed payload and any transform errors
 */
export function generatePingPayload(
  leadData: Record<string, unknown>,
  serviceConfig: DatabaseServiceConfig
): { payload: Record<string, unknown>; errors: TransformError[] } {
  return applyFieldMappings(
    serviceConfig.fieldMappingConfig,
    leadData,
    "ping"
  );
}

/**
 * Generate POST payload using database field mappings
 *
 * WHY: Transform lead data into buyer-expected format for POST
 * WHEN: Sending POST request to auction winner
 * HOW: Apply field mappings from database configuration
 *
 * @param leadData - The lead data to transform
 * @param serviceConfig - The service configuration with field mappings
 * @returns Transformed payload and any transform errors
 */
export function generatePostPayload(
  leadData: Record<string, unknown>,
  serviceConfig: DatabaseServiceConfig
): { payload: Record<string, unknown>; errors: TransformError[] } {
  return applyFieldMappings(
    serviceConfig.fieldMappingConfig,
    leadData,
    "post"
  );
}

/**
 * Invalidate buyer cache
 *
 * WHY: Clear cache after buyer config changes
 * WHEN: After admin updates buyer settings
 * HOW: Remove from cache map
 */
export function invalidateBuyerCache(buyerId: string): void {
  buyerCache.delete(buyerId);
}

/**
 * Invalidate service config cache
 *
 * WHY: Clear cache after service config changes
 * WHEN: After admin updates field mappings
 * HOW: Remove from cache map
 */
export function invalidateServiceConfigCache(buyerId: string, serviceTypeId: string): void {
  serviceConfigCache.delete(`${buyerId}:${serviceTypeId}`);
}

/**
 * Clear all caches
 *
 * WHY: Full cache reset
 * WHEN: Development, testing, or major config changes
 * HOW: Clear both cache maps
 */
export function clearAllCaches(): void {
  buyerCache.clear();
  serviceConfigCache.clear();
}

/**
 * Convert database buyer config to auction engine BuyerConfig type
 *
 * WHY: The auction engine expects BuyerConfig type from templates/types.ts
 * WHEN: When loading a buyer from database instead of hardcoded registry
 * HOW: Map database fields to expected BuyerConfig structure
 *
 * @param dbConfig - Database buyer configuration
 * @param serviceConfigs - Service configurations for this buyer
 * @returns BuyerConfig compatible with auction engine
 */
export function toBuyerConfig(
  dbConfig: DatabaseBuyerConfig,
  serviceConfigs: BuyerServiceConfig[]
): BuyerConfig {
  // Use database compliance field mappings if available, otherwise use defaults
  const complianceFieldMappings = dbConfig.complianceFieldMappings || {
    trustedForm: {
      certUrl: ["trustedform_cert_url", "tf_certificate", "xxTrustedFormCertUrl"],
      certId: ["trustedform_cert_id", "tf_cert_id", "xxTrustedFormToken"],
    },
    jornaya: {
      leadId: ["jornaya_lead_id", "leadid_token", "universal_leadid"],
    },
    tcpa: {
      consent: ["tcpa_consent", "consent_given"],
      timestamp: ["consent_date", "tcpa_timestamp"],
    },
    technical: {
      ipAddress: ["ip_address", "client_ip"],
      userAgent: ["user_agent"],
      timestamp: ["submit_timestamp"],
    },
  };

  return {
    id: dbConfig.id,
    name: dbConfig.name,
    slug: dbConfig.name.toLowerCase().replace(/\s+/g, "-"),
    apiUrl: dbConfig.apiUrl || "",
    authConfig: {
      type: dbConfig.authConfig.type,
      credentials: dbConfig.authConfig.credentials,
      headers: dbConfig.authConfig.headers,
    },
    active: dbConfig.active,
    serviceConfigs,
    globalSettings: {
      defaultTimeout: dbConfig.globalSettings.defaultTimeout,
      maxConcurrentRequests: dbConfig.globalSettings.maxConcurrentRequests,
      rateLimiting: dbConfig.globalSettings.rateLimiting,
      failoverSettings: {
        enabled: true,
        maxFailures: 3,
        cooldownPeriod: 300000,
      },
      complianceRequirements: {
        requireTrustedForm: dbConfig.globalSettings.complianceRequirements.requireTrustedForm,
        requireJornaya: dbConfig.globalSettings.complianceRequirements.requireJornaya,
        requireTcpaConsent: dbConfig.globalSettings.complianceRequirements.requireTcpaConsent,
        additionalRequirements: [],
      },
      // Use database compliance field mappings or defaults
      complianceFieldMappings,
    },
    metadata: {
      loadedFromDatabase: true,
      loadedAt: new Date().toISOString(),
    },
  };
}

/**
 * Convert database service config to auction engine BuyerServiceConfig type
 *
 * WHY: The auction engine expects BuyerServiceConfig type from templates/types.ts
 * WHEN: When loading service config from database instead of hardcoded registry
 * HOW: Map database fields and parse JSON templates into expected structure
 *
 * @param dbConfig - Database service configuration
 * @returns BuyerServiceConfig compatible with auction engine
 */
export function toServiceConfig(
  dbConfig: DatabaseServiceConfig
): BuyerServiceConfig {
  // Build ping template from field mapping config
  const pingMappings: TemplateMapping[] = [];
  const postMappings: TemplateMapping[] = [];

  // Convert field mappings from database format to TemplateMapping format
  // FieldMapping uses includeInPing/includeInPost booleans
  // CRITICAL: Copy valueMap for database-driven value conversion
  for (const mapping of dbConfig.fieldMappingConfig.mappings) {
    const templateMapping: TemplateMapping = {
      sourceField: mapping.sourceField,
      targetField: mapping.targetField,
      required: mapping.required || false,
      transform: mapping.transform || undefined,
      defaultValue: mapping.defaultValue,
      // Database-driven value mapping - applied BEFORE transform in TemplateEngine
      // This replaces hardcoded transforms like modernize.buyTimeframe
      valueMap: mapping.valueMap,
    };

    // Add to appropriate template based on includeIn flags
    if (mapping.includeInPing) {
      pingMappings.push(templateMapping);
    }
    if (mapping.includeInPost) {
      postMappings.push(templateMapping);
    }
  }

  // Include static fields as additionalFields in the templates
  const staticFields = dbConfig.fieldMappingConfig.staticFields || {};

  return {
    buyerId: dbConfig.buyerId,
    serviceTypeId: dbConfig.serviceTypeId,
    serviceTypeName: dbConfig.serviceTypeName,
    active: dbConfig.active,
    priority: dbConfig.priority,
    pricing: {
      basePrice: dbConfig.minBid,
      priceModifiers: [],
      maxBid: dbConfig.maxBid,
      minBid: dbConfig.minBid,
      currency: "USD",
    },
    pingTemplate: {
      mappings: pingMappings,
      includeCompliance: dbConfig.requiresTrustedForm || dbConfig.requiresJornaya,
      additionalFields: staticFields,
    },
    postTemplate: {
      mappings: postMappings,
      includeCompliance: true, // Always include compliance in POST
      additionalFields: staticFields,
    },
    webhookConfig: {
      pingUrl: dbConfig.webhookConfig.pingUrl,
      postUrl: dbConfig.webhookConfig.postUrl,
      timeouts: dbConfig.webhookConfig.timeouts,
      retryPolicy: {
        maxAttempts: 3,
        backoffStrategy: "exponential",
        baseDelay: 1000,
        maxDelay: 10000,
      },
    },
  };
}

/**
 * Load buyer configuration from database and convert to auction engine types
 *
 * WHY: Get buyer + service configs in the format expected by auction engine
 * WHEN: When BuyerConfigurationRegistry doesn't have the buyer (database-only buyers)
 * HOW: Load from database using existing functions, then convert using adapters
 *
 * @param buyerId - The buyer ID to load
 * @param serviceTypeId - The service type ID
 * @returns BuyerConfig and BuyerServiceConfig for auction engine, or null if not found
 */
export async function loadBuyerConfigForAuction(
  buyerId: string,
  serviceTypeId: string
): Promise<{ buyerConfig: BuyerConfig; serviceConfig: BuyerServiceConfig } | null> {
  // Load buyer from database
  const dbBuyerConfig = await loadBuyerConfig(buyerId);
  if (!dbBuyerConfig) {
    return null;
  }

  // Load service config from database
  const dbServiceConfig = await loadServiceConfig(buyerId, serviceTypeId);
  if (!dbServiceConfig) {
    return null;
  }

  // Use buyer-level timeouts if service-level ones are default values
  // This allows buyer-level timeout settings to apply when templates don't specify
  if (dbServiceConfig.webhookConfig.timeouts.ping === 3000) {
    dbServiceConfig.webhookConfig.timeouts.ping = dbBuyerConfig.pingTimeout;
  }
  if (dbServiceConfig.webhookConfig.timeouts.post === 8000) {
    dbServiceConfig.webhookConfig.timeouts.post = dbBuyerConfig.postTimeout;
  }

  // Convert to auction engine types
  const serviceConfig = toServiceConfig(dbServiceConfig);
  const buyerConfig = toBuyerConfig(dbBuyerConfig, [serviceConfig]);

  return { buyerConfig, serviceConfig };
}

/**
 * Check if buyer meets compliance requirements for a lead
 *
 * WHY: Determine if lead has required compliance data
 * WHEN: Filtering eligible buyers during auction
 * HOW: Check lead's compliance fields against buyer requirements
 *
 * @param lead - Lead data with compliance fields
 * @param serviceConfig - Service configuration with compliance requirements
 * @returns Whether lead meets all compliance requirements
 */
export function meetsComplianceRequirements(
  lead: {
    trustedFormCertId?: string | null;
    trustedFormCertUrl?: string | null;
    jornayaLeadId?: string | null;
    complianceData?: { tcpaConsent?: boolean } | null;
  },
  serviceConfig: DatabaseServiceConfig
): boolean {
  if (serviceConfig.requiresTrustedForm) {
    if (!lead.trustedFormCertId && !lead.trustedFormCertUrl) {
      return false;
    }
  }

  if (serviceConfig.requiresJornaya) {
    if (!lead.jornayaLeadId) {
      return false;
    }
  }

  // TCPA consent is always required
  if (!lead.complianceData?.tcpaConsent) {
    return false;
  }

  return true;
}

/**
 * Get all configured buyer-service combinations
 *
 * WHY: Admin dashboard needs to see all configurations
 * WHEN: Loading admin configuration page
 * HOW: Query all BuyerServiceConfig records with relationships
 */
export async function getAllConfigurations(): Promise<
  Array<{
    buyerId: string;
    buyerName: string;
    serviceTypeId: string;
    serviceTypeName: string;
    active: boolean;
    hasMappings: boolean;
    mappingCount: number;
  }>
> {
  const configs = await prisma.buyerServiceConfig.findMany({
    include: {
      buyer: { select: { name: true } },
      serviceType: { select: { displayName: true } },
    },
    orderBy: [{ buyer: { name: "asc" } }, { serviceType: { displayName: "asc" } }],
  });

  return configs.map((config) => {
    let hasMappings = false;
    let mappingCount = 0;

    if (config.fieldMappings) {
      try {
        const parsed = JSON.parse(config.fieldMappings) as FieldMappingConfig;
        hasMappings = parsed.mappings.length > 0;
        mappingCount = parsed.mappings.length;
      } catch {
        // Invalid JSON
      }
    }

    return {
      buyerId: config.buyerId,
      buyerName: config.buyer.name,
      serviceTypeId: config.serviceTypeId,
      serviceTypeName: config.serviceType.displayName,
      active: config.active,
      hasMappings,
      mappingCount,
    };
  });
}
