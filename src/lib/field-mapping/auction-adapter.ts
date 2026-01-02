/**
 * Auction Engine Adapter for Database Field Mappings
 *
 * WHY: Bridge between new database-driven field mappings and existing auction engine
 * WHEN: Called during PING/POST payload generation in auction flow
 * HOW: Load configs from database, transform payloads using field mappings
 */

import {
  loadBuyerConfig,
  loadServiceConfig,
  generatePingPayload,
  generatePostPayload,
  meetsComplianceRequirements,
  DatabaseBuyerConfig,
  DatabaseServiceConfig,
} from "./database-buyer-loader";
import { TransformError } from "@/types/field-mapping";
import { logger } from "@/lib/logger";

/**
 * Feature flag to enable database-driven field mappings
 *
 * WHY: Gradual rollout, easy rollback if issues arise
 * WHEN: Checked before every payload transformation
 * HOW: Environment variable or runtime toggle
 */
let useDatabaseMappings = process.env.USE_DATABASE_FIELD_MAPPINGS === "true";

/**
 * Enable database-driven field mappings
 */
export function enableDatabaseMappings(): void {
  useDatabaseMappings = true;
  logger.info("Database field mappings ENABLED");
}

/**
 * Disable database-driven field mappings (use hardcoded configs)
 */
export function disableDatabaseMappings(): void {
  useDatabaseMappings = false;
  logger.info("Database field mappings DISABLED (using hardcoded configs)");
}

/**
 * Check if database mappings are enabled
 */
export function isDatabaseMappingsEnabled(): boolean {
  return useDatabaseMappings;
}

/**
 * Result from preparing auction payload
 */
export interface AuctionPayloadResult {
  success: boolean;
  payload: Record<string, unknown>;
  errors: TransformError[];
  usedDatabaseMappings: boolean;
}

/**
 * Prepare PING payload for auction
 *
 * WHY: Generate buyer-specific PING payload using field mappings
 * WHEN: Before sending PING request to buyer
 * HOW: Load database config, apply field mappings, return transformed payload
 *
 * @param leadData - The lead data to transform
 * @param buyerId - The buyer to generate payload for
 * @param serviceTypeId - The service type
 * @returns Transformed payload result
 */
export async function preparePingPayload(
  leadData: Record<string, unknown>,
  buyerId: string,
  serviceTypeId: string
): Promise<AuctionPayloadResult> {
  // If database mappings disabled, return empty result (caller should use legacy method)
  if (!useDatabaseMappings) {
    return {
      success: false,
      payload: {},
      errors: [],
      usedDatabaseMappings: false,
    };
  }

  try {
    // Load service configuration from database
    const serviceConfig = await loadServiceConfig(buyerId, serviceTypeId);

    if (!serviceConfig) {
      logger.warn("No service config found for PING payload", {
        buyerId,
        serviceTypeId,
      });
      return {
        success: false,
        payload: {},
        errors: [
          {
            sourceField: "config",
            transform: "",
            message: `No configuration found for buyer ${buyerId} / service ${serviceTypeId}`,
          },
        ],
        usedDatabaseMappings: true,
      };
    }

    // Check if field mappings are configured
    if (serviceConfig.fieldMappingConfig.mappings.length === 0) {
      logger.debug("No field mappings configured, falling back to legacy", {
        buyerId,
        serviceTypeId,
      });
      return {
        success: false,
        payload: {},
        errors: [],
        usedDatabaseMappings: false,
      };
    }

    // Generate PING payload using field mappings
    const { payload, errors } = generatePingPayload(leadData, serviceConfig);

    if (errors.length > 0) {
      logger.warn("Errors during PING payload transformation", {
        buyerId,
        serviceTypeId,
        errors,
      });
    }

    return {
      success: true,
      payload,
      errors,
      usedDatabaseMappings: true,
    };
  } catch (error) {
    logger.error("Failed to prepare PING payload", {
      buyerId,
      serviceTypeId,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return {
      success: false,
      payload: {},
      errors: [
        {
          sourceField: "system",
          transform: "",
          message: error instanceof Error ? error.message : "Unknown error",
        },
      ],
      usedDatabaseMappings: true,
    };
  }
}

/**
 * Prepare POST payload for auction winner
 *
 * WHY: Generate buyer-specific POST payload with all lead details
 * WHEN: After auction winner is selected
 * HOW: Load database config, apply field mappings, return transformed payload
 *
 * @param leadData - The lead data to transform
 * @param buyerId - The winning buyer
 * @param serviceTypeId - The service type
 * @param auctionMetadata - Additional auction data to include
 * @returns Transformed payload result
 */
export async function preparePostPayload(
  leadData: Record<string, unknown>,
  buyerId: string,
  serviceTypeId: string,
  auctionMetadata?: {
    winningBid?: number;
    auctionTimestamp?: string;
  }
): Promise<AuctionPayloadResult> {
  // If database mappings disabled, return empty result
  if (!useDatabaseMappings) {
    return {
      success: false,
      payload: {},
      errors: [],
      usedDatabaseMappings: false,
    };
  }

  try {
    // Load service configuration from database
    const serviceConfig = await loadServiceConfig(buyerId, serviceTypeId);

    if (!serviceConfig) {
      logger.warn("No service config found for POST payload", {
        buyerId,
        serviceTypeId,
      });
      return {
        success: false,
        payload: {},
        errors: [
          {
            sourceField: "config",
            transform: "",
            message: `No configuration found for buyer ${buyerId} / service ${serviceTypeId}`,
          },
        ],
        usedDatabaseMappings: true,
      };
    }

    // Check if field mappings are configured
    if (serviceConfig.fieldMappingConfig.mappings.length === 0) {
      logger.debug("No field mappings configured, falling back to legacy", {
        buyerId,
        serviceTypeId,
      });
      return {
        success: false,
        payload: {},
        errors: [],
        usedDatabaseMappings: false,
      };
    }

    // Generate POST payload using field mappings
    const { payload, errors } = generatePostPayload(leadData, serviceConfig);

    // Add auction metadata if provided
    if (auctionMetadata) {
      if (auctionMetadata.winningBid !== undefined) {
        payload.auction_winning_bid = auctionMetadata.winningBid;
      }
      if (auctionMetadata.auctionTimestamp) {
        payload.auction_timestamp = auctionMetadata.auctionTimestamp;
      }
    }

    if (errors.length > 0) {
      logger.warn("Errors during POST payload transformation", {
        buyerId,
        serviceTypeId,
        errors,
      });
    }

    return {
      success: true,
      payload,
      errors,
      usedDatabaseMappings: true,
    };
  } catch (error) {
    logger.error("Failed to prepare POST payload", {
      buyerId,
      serviceTypeId,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return {
      success: false,
      payload: {},
      errors: [
        {
          sourceField: "system",
          transform: "",
          message: error instanceof Error ? error.message : "Unknown error",
        },
      ],
      usedDatabaseMappings: true,
    };
  }
}

/**
 * Get buyer authentication headers
 *
 * WHY: Build HTTP headers for buyer API requests
 * WHEN: Before sending PING/POST requests
 * HOW: Load buyer config, extract auth credentials
 *
 * @param buyerId - The buyer to get auth for
 * @param requestType - PING or POST
 * @returns Headers record or null if not found
 */
export async function getBuyerAuthHeaders(
  buyerId: string,
  requestType: "PING" | "POST"
): Promise<Record<string, string> | null> {
  if (!useDatabaseMappings) {
    return null;
  }

  try {
    const buyerConfig = await loadBuyerConfig(buyerId);

    if (!buyerConfig) {
      return null;
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Request-Type": requestType,
      "X-Lead-Source": "contractor-platform",
      "X-Timestamp": new Date().toISOString(),
    };

    const { authConfig } = buyerConfig;

    switch (authConfig.type) {
      case "apiKey":
        if (authConfig.credentials.apiKey) {
          headers["X-API-Key"] = authConfig.credentials.apiKey;
        }
        break;

      case "bearer":
        if (authConfig.credentials.token) {
          headers["Authorization"] = `Bearer ${authConfig.credentials.token}`;
        }
        break;

      case "basic":
        if (authConfig.credentials.username && authConfig.credentials.password) {
          const encoded = Buffer.from(
            `${authConfig.credentials.username}:${authConfig.credentials.password}`
          ).toString("base64");
          headers["Authorization"] = `Basic ${encoded}`;
        }
        break;

      case "oauth":
        // OAuth would require token refresh logic
        if (authConfig.credentials.accessToken) {
          headers["Authorization"] = `Bearer ${authConfig.credentials.accessToken}`;
        }
        break;
    }

    // Add custom headers
    if (authConfig.headers) {
      Object.assign(headers, authConfig.headers);
    }

    return headers;
  } catch (error) {
    logger.error("Failed to get buyer auth headers", {
      buyerId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return null;
  }
}

/**
 * Get webhook URLs for a buyer + service
 *
 * WHY: Get the PING/POST endpoints for a buyer
 * WHEN: Before sending requests
 * HOW: Load service config, extract URLs
 *
 * @param buyerId - The buyer ID
 * @param serviceTypeId - The service type ID
 * @returns Webhook config or null
 */
export async function getWebhookConfig(
  buyerId: string,
  serviceTypeId: string
): Promise<{ pingUrl: string; postUrl: string; timeouts: { ping: number; post: number } } | null> {
  if (!useDatabaseMappings) {
    return null;
  }

  try {
    const serviceConfig = await loadServiceConfig(buyerId, serviceTypeId);

    if (!serviceConfig) {
      return null;
    }

    return serviceConfig.webhookConfig;
  } catch (error) {
    logger.error("Failed to get webhook config", {
      buyerId,
      serviceTypeId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return null;
  }
}

/**
 * Check if buyer can participate in auction for a lead
 *
 * WHY: Filter buyers based on compliance requirements
 * WHEN: During auction buyer eligibility check
 * HOW: Load config, check lead compliance data against requirements
 *
 * @param buyerId - The buyer to check
 * @param serviceTypeId - The service type
 * @param lead - Lead data with compliance fields
 * @returns Whether buyer can participate
 */
export async function canBuyerParticipate(
  buyerId: string,
  serviceTypeId: string,
  lead: {
    trustedFormCertId?: string | null;
    trustedFormCertUrl?: string | null;
    jornayaLeadId?: string | null;
    complianceData?: { tcpaConsent?: boolean } | null;
  }
): Promise<{ eligible: boolean; reason?: string }> {
  if (!useDatabaseMappings) {
    return { eligible: true }; // Fallback to legacy eligibility check
  }

  try {
    const serviceConfig = await loadServiceConfig(buyerId, serviceTypeId);

    if (!serviceConfig) {
      return {
        eligible: false,
        reason: "No service configuration found",
      };
    }

    if (!serviceConfig.active) {
      return {
        eligible: false,
        reason: "Buyer service configuration is inactive",
      };
    }

    if (!meetsComplianceRequirements(lead, serviceConfig)) {
      const reasons: string[] = [];
      if (serviceConfig.requiresTrustedForm && !lead.trustedFormCertId && !lead.trustedFormCertUrl) {
        reasons.push("Missing TrustedForm certificate");
      }
      if (serviceConfig.requiresJornaya && !lead.jornayaLeadId) {
        reasons.push("Missing Jornaya Lead ID");
      }
      if (!lead.complianceData?.tcpaConsent) {
        reasons.push("Missing TCPA consent");
      }

      return {
        eligible: false,
        reason: reasons.join(", "),
      };
    }

    return { eligible: true };
  } catch (error) {
    logger.error("Failed to check buyer participation eligibility", {
      buyerId,
      serviceTypeId,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    // On error, allow participation (let auction proceed, fail at PING if needed)
    return { eligible: true };
  }
}

/**
 * Get all buyers that can participate in auction for a service type
 *
 * WHY: Get list of eligible buyers for auction
 * WHEN: Starting an auction
 * HOW: Query database for active buyers with active configs
 *
 * @param serviceTypeId - The service type
 * @param lead - Lead data for compliance filtering
 * @returns Array of eligible buyer IDs with configs
 */
export async function getEligibleBuyersFromDatabase(
  serviceTypeId: string,
  lead: {
    trustedFormCertId?: string | null;
    trustedFormCertUrl?: string | null;
    jornayaLeadId?: string | null;
    complianceData?: { tcpaConsent?: boolean } | null;
  }
): Promise<
  Array<{
    buyerId: string;
    buyerName: string;
    serviceConfig: DatabaseServiceConfig;
    buyerConfig: DatabaseBuyerConfig;
  }>
> {
  if (!useDatabaseMappings) {
    return [];
  }

  const { loadActiveBuyersForService } = await import("./database-buyer-loader");
  const activeBuyers = await loadActiveBuyersForService(serviceTypeId);

  const eligibleBuyers: Array<{
    buyerId: string;
    buyerName: string;
    serviceConfig: DatabaseServiceConfig;
    buyerConfig: DatabaseBuyerConfig;
  }> = [];

  for (const { buyerId, serviceConfig } of activeBuyers) {
    // Check compliance
    if (!meetsComplianceRequirements(lead, serviceConfig)) {
      continue;
    }

    // Load full buyer config
    const buyerConfig = await loadBuyerConfig(buyerId);
    if (!buyerConfig || !buyerConfig.active) {
      continue;
    }

    eligibleBuyers.push({
      buyerId,
      buyerName: buyerConfig.name,
      serviceConfig,
      buyerConfig,
    });
  }

  // Sort by min bid descending (higher bidders first)
  eligibleBuyers.sort((a, b) => b.serviceConfig.minBid - a.serviceConfig.minBid);

  return eligibleBuyers;
}
