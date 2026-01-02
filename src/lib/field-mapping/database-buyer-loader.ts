/**
 * Database Buyer Loader
 *
 * WHY: Load buyer configurations from database instead of hardcoded registry
 * WHEN: Initializing auction engine, loading buyer configs for lead processing
 * HOW: Query Prisma for buyer and service configurations, cache results
 */

import { prisma } from "@/lib/prisma";
import { loadFieldMappingConfig, applyFieldMappings } from "./configuration-service";
import {
  FieldMappingConfig,
  TransformError,
  createEmptyFieldMappingConfig,
} from "@/types/field-mapping";
import { decrypt } from "@/lib/security/encryption";

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
  slug: string;
  apiUrl: string | null;
  active: boolean;
  authConfig: DatabaseAuthConfig;
  globalSettings: DatabaseGlobalSettings;
  metadata: Record<string, unknown>;
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

  // Load from database
  const buyer = await prisma.buyer.findUnique({
    where: { id: buyerId },
    select: {
      id: true,
      name: true,
      slug: true,
      apiUrl: true,
      authConfig: true,
      webhookSecret: true,
      active: true,
      createdAt: true,
      metadata: true,
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

  // Build global settings with defaults
  const globalSettings: DatabaseGlobalSettings = {
    defaultTimeout: 5000,
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

  // Parse metadata if present
  let metadata: Record<string, unknown> = {};
  if (buyer.metadata) {
    try {
      metadata = JSON.parse(buyer.metadata);
    } catch {
      // Ignore parse errors
    }
  }

  const config: DatabaseBuyerConfig = {
    id: buyer.id,
    name: buyer.name,
    slug: buyer.slug,
    apiUrl: buyer.apiUrl,
    active: buyer.active,
    authConfig,
    globalSettings,
    metadata,
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
