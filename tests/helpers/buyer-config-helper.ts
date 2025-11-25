/**
 * Test Helper: Buyer Configuration Registration
 * Registers mock buyer configurations in the BuyerConfigurationRegistry for E2E tests
 */

import { BuyerConfigurationRegistry } from '@/lib/buyers/configurations';
import { BuyerConfig, BuyerServiceConfig } from '@/lib/templates/types';

/**
 * Register a test buyer configuration in the registry
 */
export function registerTestBuyerConfig(
  buyerId: string,
  buyerName: string,
  serviceTypeId: string,
  serviceTypeName: string,
  apiUrl: string
): void {
  const buyerConfig: BuyerConfig = {
    id: buyerId,
    name: buyerName,
    slug: buyerName.toLowerCase().replace(/\s+/g, '-'),
    apiUrl,
    authConfig: {
      type: 'apiKey',
      credentials: {
        apiKey: 'test-api-key'
      }
    },
    active: true,
    serviceConfigs: [{
      buyerId,
      serviceTypeId,
      serviceTypeName,
      active: true,
      priority: 100,
      pricing: {
        basePrice: 100,
        priceModifiers: [],
        maxBid: 500,
        minBid: 50,
        currency: 'USD'
      },
      pingTemplate: {
        mappings: [
          { sourceField: 'zipCode', targetField: 'zip_code', required: true },
          { sourceField: 'ownsHome', targetField: 'homeowner', required: true }
        ],
        includeCompliance: false
      },
      postTemplate: {
        mappings: [
          { sourceField: 'zipCode', targetField: 'zip_code', required: true },
          { sourceField: 'ownsHome', targetField: 'homeowner', required: true },
          { sourceField: 'firstName', targetField: 'first_name', required: true },
          { sourceField: 'lastName', targetField: 'last_name', required: true },
          { sourceField: 'email', targetField: 'email', required: true },
          { sourceField: 'phone', targetField: 'phone', required: true }
        ],
        includeCompliance: true
      },
      webhookConfig: {
        pingUrl: `${apiUrl}/ping`,
        postUrl: `${apiUrl}/post`,
        timeouts: { ping: 3000, post: 8000 },
        retryPolicy: {
          maxAttempts: 3,
          backoffStrategy: 'exponential',
          baseDelay: 1000,
          maxDelay: 10000
        }
      }
    }],
    globalSettings: {
      defaultTimeout: 5000,
      maxConcurrentRequests: 50,
      rateLimiting: {
        requestsPerMinute: 100,
        requestsPerHour: 2000,
        requestsPerDay: 20000
      },
      failoverSettings: {
        enabled: true,
        maxFailures: 3,
        cooldownPeriod: 300000
      },
      complianceRequirements: {
        requireTrustedForm: false,
        requireJornaya: false,
        requireTcpaConsent: false,
        additionalRequirements: []
      }
    },
    metadata: {
      tier: 'test',
      maxDailyLeads: 1000,
      avgResponseTime: 250,
      qualityScore: 9.0
    }
  };

  BuyerConfigurationRegistry.register(buyerConfig);
}

/**
 * Clear all buyer configurations (useful for test cleanup)
 */
export function clearAllBuyerConfigs(): void {
  // Note: BuyerConfigurationRegistry doesn't have a clear method,
  // so we'll need to remove each buyer individually
  // This is a limitation of the current implementation
}

/**
 * Register buyer configs from database records
 */
export function registerBuyerConfigsFromDb(
  buyers: Array<{
    id: string;
    name: string;
    apiUrl: string;
  }>,
  serviceTypeId: string,
  serviceTypeName: string
): void {
  for (const buyer of buyers) {
    registerTestBuyerConfig(
      buyer.id,
      buyer.name,
      serviceTypeId,
      serviceTypeName,
      buyer.apiUrl
    );
  }
}
