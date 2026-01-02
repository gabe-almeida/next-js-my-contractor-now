/**
 * Buyer Configuration Management
 * Centralized buyer-specific template configurations and mappings
 */

import {
  BuyerConfig,
  BuyerServiceConfig,
  TemplateConfig,
  AuthConfig,
  WebhookConfig,
  RetryPolicy,
  BuyerGlobalSettings
} from '../templates/types';
import { ValidationRuleBuilder } from '../templates/validator';

/**
 * Buyer configuration registry
 */
class BuyerConfigurationRegistry {
  private static configs = new Map<string, BuyerConfig>();
  private static serviceConfigs = new Map<string, Map<string, BuyerServiceConfig>>();

  /**
   * Register a buyer configuration
   */
  static register(config: BuyerConfig): void {
    this.configs.set(config.id, config);
    
    // Index service configurations for quick lookup
    const serviceMap = new Map<string, BuyerServiceConfig>();
    for (const serviceConfig of config.serviceConfigs) {
      serviceMap.set(serviceConfig.serviceTypeId, serviceConfig);
    }
    this.serviceConfigs.set(config.id, serviceMap);
  }

  /**
   * Get buyer configuration by ID
   */
  static get(buyerId: string): BuyerConfig | undefined {
    return this.configs.get(buyerId);
  }

  /**
   * Get buyer service configuration
   */
  static getServiceConfig(buyerId: string, serviceTypeId: string): BuyerServiceConfig | undefined {
    const serviceMap = this.serviceConfigs.get(buyerId);
    return serviceMap?.get(serviceTypeId);
  }

  /**
   * Get all buyers supporting a specific service type
   */
  static getBuyersForService(serviceTypeId: string): BuyerConfig[] {
    const buyers: BuyerConfig[] = [];

    Array.from(this.configs.values()).forEach((buyer) => {
      const hasService = buyer.serviceConfigs.some(
        sc => sc.serviceTypeId === serviceTypeId && sc.active
      );
      if (hasService && buyer.active) {
        buyers.push(buyer);
      }
    });

    return buyers.sort((a, b) => {
      // Sort by priority of service configuration
      const aConfig = this.getServiceConfig(a.id, serviceTypeId);
      const bConfig = this.getServiceConfig(b.id, serviceTypeId);
      return (bConfig?.priority || 0) - (aConfig?.priority || 0);
    });
  }

  /**
   * Get all active buyers
   */
  static getAllActive(): BuyerConfig[] {
    return Array.from(this.configs.values()).filter(buyer => buyer.active);
  }

  /**
   * Update buyer configuration
   */
  static update(buyerId: string, updates: Partial<BuyerConfig>): void {
    const existing = this.configs.get(buyerId);
    if (!existing) {
      throw new Error(`Buyer configuration not found: ${buyerId}`);
    }

    const updated = { ...existing, ...updates };
    this.register(updated);
  }

  /**
   * Remove buyer configuration
   */
  static remove(buyerId: string): void {
    this.configs.delete(buyerId);
    this.serviceConfigs.delete(buyerId);
  }

  /**
   * Check if buyer supports service type
   */
  static supportsService(buyerId: string, serviceTypeId: string): boolean {
    const serviceConfig = this.getServiceConfig(buyerId, serviceTypeId);
    return !!(serviceConfig?.active);
  }
}

/**
 * Pre-configured buyer templates
 */
class BuyerTemplates {
  /**
   * Modernize buyer configuration
   */
  static modernize(): BuyerConfig {
    return {
      id: 'modernize',
      name: 'Modernize',
      slug: 'modernize',
      apiUrl: 'https://api.modernize.com',
      authConfig: {
        type: 'apiKey',
        credentials: {
          apiKey: process.env.MODERNIZE_API_KEY || ''
        },
        headers: {
          'X-API-Source': 'contractor-platform'
        }
      },
      active: true,
      serviceConfigs: [
        this.modernizeWindowsConfig(),
        this.modernizeBathroomConfig(),
        this.modernizeRoofingConfig()
      ],
      globalSettings: this.modernizeGlobalSettings(),
      metadata: {
        tier: 'premium',
        maxDailyLeads: 1000,
        avgResponseTime: 250,
        qualityScore: 9.2
      }
    };
  }

  /**
   * HomeAdvisor buyer configuration
   */
  static homeAdvisor(): BuyerConfig {
    return {
      id: 'homeadvisor',
      name: 'HomeAdvisor',
      slug: 'homeadvisor',
      apiUrl: 'https://pro-api.homeadvisor.com',
      authConfig: {
        type: 'bearer',
        credentials: {
          token: process.env.HOMEADVISOR_API_TOKEN || ''
        },
        headers: {
          'HA-Partner-ID': process.env.HOMEADVISOR_PARTNER_ID || ''
        }
      },
      active: true,
      serviceConfigs: [
        this.homeAdvisorWindowsConfig(),
        this.homeAdvisorBathroomConfig(),
        this.homeAdvisorRoofingConfig()
      ],
      globalSettings: this.homeAdvisorGlobalSettings(),
      metadata: {
        tier: 'enterprise',
        maxDailyLeads: 2000,
        avgResponseTime: 180,
        qualityScore: 9.5
      }
    };
  }

  /**
   * Angi buyer configuration
   */
  static angi(): BuyerConfig {
    return {
      id: 'angi',
      name: 'Angi',
      slug: 'angi',
      apiUrl: 'https://api.angi.com',
      authConfig: {
        type: 'oauth',
        credentials: {
          clientId: process.env.ANGI_CLIENT_ID || '',
          clientSecret: process.env.ANGI_CLIENT_SECRET || ''
        }
      },
      active: true,
      serviceConfigs: [
        this.angiWindowsConfig(),
        this.angiBathroomConfig(),
        this.angiRoofingConfig()
      ],
      globalSettings: this.angiGlobalSettings(),
      metadata: {
        tier: 'standard',
        maxDailyLeads: 500,
        avgResponseTime: 320,
        qualityScore: 8.8
      }
    };
  }

  // Modernize service configurations
  private static modernizeWindowsConfig(): BuyerServiceConfig {
    return {
      buyerId: 'modernize',
      serviceTypeId: 'windows',
      serviceTypeName: 'Windows',
      active: true,
      priority: 95,
      pricing: {
        basePrice: 45,
        priceModifiers: [
          { field: 'numberOfWindows', operator: 'range', value: [10, 20], modifier: 1.5, type: 'multiply' },
          { field: 'windowsProjectScope', operator: 'equals', value: 'full_replacement', modifier: 10, type: 'add' }
        ],
        maxBid: 150,
        minBid: 25,
        currency: 'USD'
      },
      pingTemplate: {
        mappings: [
          { sourceField: 'zipCode', targetField: 'zip_code', required: true },
          { sourceField: 'ownsHome', targetField: 'homeowner', transform: 'boolean.yesNo', required: true },
          { sourceField: 'timeframe', targetField: 'project_timeframe', transform: 'service.projectTimeframe' },
          { sourceField: 'numberOfWindows', targetField: 'window_count', transform: 'service.windowsCount' }
        ],
        includeCompliance: true // Aligned with requireTrustedForm: true
      },
      postTemplate: {
        mappings: [
          { sourceField: 'zipCode', targetField: 'zip_code', required: true },
          { sourceField: 'ownsHome', targetField: 'homeowner', transform: 'boolean.yesNo', required: true },
          { sourceField: 'timeframe', targetField: 'project_timeframe', transform: 'service.projectTimeframe' },
          { sourceField: 'numberOfWindows', targetField: 'window_count', transform: 'service.windowsCount' },
          { sourceField: 'windowsProjectScope', targetField: 'project_scope', required: true },
          { sourceField: 'windowsStyle', targetField: 'window_style' },
          { sourceField: 'windowsMaterial', targetField: 'material_preference' },
          { sourceField: 'firstName', targetField: 'first_name', required: true },
          { sourceField: 'lastName', targetField: 'last_name', required: true },
          { sourceField: 'email', targetField: 'email_address', required: true, validation: ValidationRuleBuilder.email().build() },
          { sourceField: 'phone', targetField: 'phone_number', required: true, transform: 'phone.e164' },
          { sourceField: 'address', targetField: 'property_address' },
          { sourceField: 'city', targetField: 'property_city' },
          { sourceField: 'state', targetField: 'property_state', transform: 'address.state' }
        ],
        includeCompliance: true,
        additionalFields: {
          lead_type: 'windows_replacement',
          source: 'contractor_platform',
          quality_score: 'A'
        }
      },
      webhookConfig: {
        pingUrl: 'https://api.modernize.com/v2/leads/ping',
        postUrl: 'https://api.modernize.com/v2/leads',
        timeouts: { ping: 3000, post: 8000 },
        retryPolicy: this.getStandardRetryPolicy()
      }
    };
  }

  private static modernizeBathroomConfig(): BuyerServiceConfig {
    return {
      buyerId: 'modernize',
      serviceTypeId: 'bathrooms',
      serviceTypeName: 'Bathrooms',
      active: true,
      priority: 90,
      pricing: {
        basePrice: 65,
        priceModifiers: [
          { field: 'numberOfBathrooms', operator: 'range', value: [2, 3], modifier: 1.3, type: 'multiply' },
          { field: 'bathroomType', operator: 'equals', value: 'master_bath', modifier: 15, type: 'add' }
        ],
        maxBid: 200,
        minBid: 35,
        currency: 'USD'
      },
      pingTemplate: {
        mappings: [
          { sourceField: 'zipCode', targetField: 'zip_code', required: true },
          { sourceField: 'ownsHome', targetField: 'homeowner', transform: 'boolean.yesNo', required: true },
          { sourceField: 'timeframe', targetField: 'project_timeframe', transform: 'service.projectTimeframe' },
          { sourceField: 'numberOfBathrooms', targetField: 'bathroom_count', transform: 'service.bathroomCount' }
        ],
        includeCompliance: true // Aligned with requireTrustedForm: true
      },
      postTemplate: {
        mappings: [
          { sourceField: 'zipCode', targetField: 'zip_code', required: true },
          { sourceField: 'ownsHome', targetField: 'homeowner', transform: 'boolean.yesNo', required: true },
          { sourceField: 'timeframe', targetField: 'project_timeframe', transform: 'service.projectTimeframe' },
          { sourceField: 'numberOfBathrooms', targetField: 'bathroom_count', transform: 'service.bathroomCount' },
          { sourceField: 'bathroomType', targetField: 'bathroom_type', required: true },
          { sourceField: 'projectScope', targetField: 'renovation_scope' },
          { sourceField: 'fixturesNeeded', targetField: 'fixtures_list' },
          { sourceField: 'firstName', targetField: 'first_name', required: true },
          { sourceField: 'lastName', targetField: 'last_name', required: true },
          { sourceField: 'email', targetField: 'email_address', required: true, validation: ValidationRuleBuilder.email().build() },
          { sourceField: 'phone', targetField: 'phone_number', required: true, transform: 'phone.e164' }
        ],
        includeCompliance: true,
        additionalFields: {
          lead_type: 'bathroom_remodel',
          source: 'contractor_platform'
        }
      },
      webhookConfig: {
        pingUrl: 'https://api.modernize.com/v2/leads/ping',
        postUrl: 'https://api.modernize.com/v2/leads',
        timeouts: { ping: 3000, post: 8000 },
        retryPolicy: this.getStandardRetryPolicy()
      }
    };
  }

  private static modernizeRoofingConfig(): BuyerServiceConfig {
    return {
      buyerId: 'modernize',
      serviceTypeId: 'roofing',
      serviceTypeName: 'Roofing',
      active: true,
      priority: 88,
      pricing: {
        basePrice: 85,
        priceModifiers: [
          { field: 'roofingSquareFootage', operator: 'range', value: [2000, 3000], modifier: 1.4, type: 'multiply' },
          { field: 'damageAssessment', operator: 'equals', value: 'severe', modifier: 25, type: 'add' }
        ],
        maxBid: 300,
        minBid: 50,
        currency: 'USD'
      },
      pingTemplate: {
        mappings: [
          { sourceField: 'zipCode', targetField: 'zip_code', required: true },
          { sourceField: 'ownsHome', targetField: 'homeowner', transform: 'boolean.yesNo', required: true },
          { sourceField: 'timeframe', targetField: 'project_timeframe', transform: 'service.projectTimeframe' },
          { sourceField: 'roofingSquareFootage', targetField: 'roof_size', transform: 'service.roofingSquareFootage' }
        ],
        includeCompliance: true // Aligned with requireTrustedForm: true
      },
      postTemplate: {
        mappings: [
          { sourceField: 'zipCode', targetField: 'zip_code', required: true },
          { sourceField: 'ownsHome', targetField: 'homeowner', transform: 'boolean.yesNo', required: true },
          { sourceField: 'timeframe', targetField: 'project_timeframe', transform: 'service.projectTimeframe' },
          { sourceField: 'roofingSquareFootage', targetField: 'roof_size', transform: 'service.roofingSquareFootage', required: true },
          { sourceField: 'materialType', targetField: 'roofing_material', required: true },
          { sourceField: 'damageAssessment', targetField: 'damage_level' },
          { sourceField: 'roofAge', targetField: 'current_roof_age' },
          { sourceField: 'firstName', targetField: 'first_name', required: true },
          { sourceField: 'lastName', targetField: 'last_name', required: true },
          { sourceField: 'email', targetField: 'email_address', required: true, validation: ValidationRuleBuilder.email().build() },
          { sourceField: 'phone', targetField: 'phone_number', required: true, transform: 'phone.e164' }
        ],
        includeCompliance: true,
        additionalFields: {
          lead_type: 'roofing_replacement',
          source: 'contractor_platform'
        }
      },
      webhookConfig: {
        pingUrl: 'https://api.modernize.com/v2/leads/ping',
        postUrl: 'https://api.modernize.com/v2/leads',
        timeouts: { ping: 3000, post: 8000 },
        retryPolicy: this.getStandardRetryPolicy()
      }
    };
  }

  // HomeAdvisor service configurations
  private static homeAdvisorWindowsConfig(): BuyerServiceConfig {
    return {
      buyerId: 'homeadvisor',
      serviceTypeId: 'windows',
      serviceTypeName: 'Windows',
      active: true,
      priority: 92,
      pricing: {
        basePrice: 50,
        priceModifiers: [
          { field: 'numberOfWindows', operator: 'range', value: [15, 25], modifier: 1.6, type: 'multiply' }
        ],
        maxBid: 175,
        minBid: 30,
        currency: 'USD'
      },
      pingTemplate: {
        mappings: [
          { sourceField: 'zipCode', targetField: 'postal_code', required: true },
          { sourceField: 'ownsHome', targetField: 'owns_property', transform: 'boolean.trueFalse', required: true },
          { sourceField: 'timeframe', targetField: 'when_needed', transform: 'service.projectTimeframe' },
          { sourceField: 'numberOfWindows', targetField: 'num_windows', transform: 'number.integer' }
        ],
        includeCompliance: true // HomeAdvisor wants compliance in PING
      },
      postTemplate: {
        mappings: [
          { sourceField: 'zipCode', targetField: 'postal_code', required: true },
          { sourceField: 'ownsHome', targetField: 'owns_property', transform: 'boolean.trueFalse', required: true },
          { sourceField: 'timeframe', targetField: 'when_needed', transform: 'service.projectTimeframe' },
          { sourceField: 'numberOfWindows', targetField: 'num_windows', transform: 'number.integer', required: true },
          { sourceField: 'windowsProjectScope', targetField: 'work_type', required: true },
          { sourceField: 'firstName', targetField: 'customer_first_name', required: true },
          { sourceField: 'lastName', targetField: 'customer_last_name', required: true },
          { sourceField: 'email', targetField: 'customer_email', required: true, validation: ValidationRuleBuilder.email().build() },
          { sourceField: 'phone', targetField: 'customer_phone', required: true, transform: 'phone.format' }
        ],
        includeCompliance: true,
        additionalFields: {
          service_category: 'windows',
          lead_source: 'partner',
          partner_id: process.env.HOMEADVISOR_PARTNER_ID
        }
      },
      webhookConfig: {
        pingUrl: 'https://pro-api.homeadvisor.com/leads/ping',
        postUrl: 'https://pro-api.homeadvisor.com/leads/submit',
        timeouts: { ping: 2500, post: 10000 },
        retryPolicy: this.getAggressiveRetryPolicy()
      }
    };
  }

  private static homeAdvisorBathroomConfig(): BuyerServiceConfig {
    return {
      buyerId: 'homeadvisor',
      serviceTypeId: 'bathrooms',
      serviceTypeName: 'Bathrooms',
      active: true,
      priority: 94,
      pricing: {
        basePrice: 75,
        priceModifiers: [
          { field: 'numberOfBathrooms', operator: 'equals', value: 1, modifier: 0.8, type: 'multiply' },
          { field: 'bathroomType', operator: 'equals', value: 'master_bath', modifier: 20, type: 'add' }
        ],
        maxBid: 250,
        minBid: 40,
        currency: 'USD'
      },
      pingTemplate: {
        mappings: [
          { sourceField: 'zipCode', targetField: 'postal_code', required: true },
          { sourceField: 'ownsHome', targetField: 'owns_property', transform: 'boolean.trueFalse', required: true },
          { sourceField: 'timeframe', targetField: 'when_needed', transform: 'service.projectTimeframe' },
          { sourceField: 'numberOfBathrooms', targetField: 'num_bathrooms', transform: 'number.integer' }
        ],
        includeCompliance: true
      },
      postTemplate: {
        mappings: [
          { sourceField: 'zipCode', targetField: 'postal_code', required: true },
          { sourceField: 'ownsHome', targetField: 'owns_property', transform: 'boolean.trueFalse', required: true },
          { sourceField: 'timeframe', targetField: 'when_needed', transform: 'service.projectTimeframe' },
          { sourceField: 'numberOfBathrooms', targetField: 'num_bathrooms', transform: 'number.integer', required: true },
          { sourceField: 'bathroomType', targetField: 'bathroom_type', required: true },
          { sourceField: 'firstName', targetField: 'customer_first_name', required: true },
          { sourceField: 'lastName', targetField: 'customer_last_name', required: true },
          { sourceField: 'email', targetField: 'customer_email', required: true, validation: ValidationRuleBuilder.email().build() },
          { sourceField: 'phone', targetField: 'customer_phone', required: true, transform: 'phone.format' }
        ],
        includeCompliance: true,
        additionalFields: {
          service_category: 'bathrooms',
          lead_source: 'partner',
          partner_id: process.env.HOMEADVISOR_PARTNER_ID
        }
      },
      webhookConfig: {
        pingUrl: 'https://pro-api.homeadvisor.com/leads/ping',
        postUrl: 'https://pro-api.homeadvisor.com/leads/submit',
        timeouts: { ping: 2500, post: 10000 },
        retryPolicy: this.getAggressiveRetryPolicy()
      }
    };
  }

  private static homeAdvisorRoofingConfig(): BuyerServiceConfig {
    return {
      buyerId: 'homeadvisor',
      serviceTypeId: 'roofing',
      serviceTypeName: 'Roofing',
      active: true,
      priority: 96,
      pricing: {
        basePrice: 120,
        priceModifiers: [
          { field: 'roofingSquareFootage', operator: 'range', value: [3000, 5000], modifier: 1.8, type: 'multiply' },
          { field: 'damageAssessment', operator: 'equals', value: 'emergency', modifier: 50, type: 'add' }
        ],
        maxBid: 400,
        minBid: 60,
        currency: 'USD'
      },
      pingTemplate: {
        mappings: [
          { sourceField: 'zipCode', targetField: 'postal_code', required: true },
          { sourceField: 'ownsHome', targetField: 'owns_property', transform: 'boolean.trueFalse', required: true },
          { sourceField: 'timeframe', targetField: 'when_needed', transform: 'service.projectTimeframe' },
          { sourceField: 'roofingSquareFootage', targetField: 'roof_sqft', transform: 'number.integer' }
        ],
        includeCompliance: true
      },
      postTemplate: {
        mappings: [
          { sourceField: 'zipCode', targetField: 'postal_code', required: true },
          { sourceField: 'ownsHome', targetField: 'owns_property', transform: 'boolean.trueFalse', required: true },
          { sourceField: 'timeframe', targetField: 'when_needed', transform: 'service.projectTimeframe' },
          { sourceField: 'roofingSquareFootage', targetField: 'roof_sqft', transform: 'number.integer', required: true },
          { sourceField: 'materialType', targetField: 'material_type', required: true },
          { sourceField: 'damageAssessment', targetField: 'damage_level', required: true },
          { sourceField: 'firstName', targetField: 'customer_first_name', required: true },
          { sourceField: 'lastName', targetField: 'customer_last_name', required: true },
          { sourceField: 'email', targetField: 'customer_email', required: true, validation: ValidationRuleBuilder.email().build() },
          { sourceField: 'phone', targetField: 'customer_phone', required: true, transform: 'phone.format' }
        ],
        includeCompliance: true,
        additionalFields: {
          service_category: 'roofing',
          lead_source: 'partner',
          partner_id: process.env.HOMEADVISOR_PARTNER_ID
        }
      },
      webhookConfig: {
        pingUrl: 'https://pro-api.homeadvisor.com/leads/ping',
        postUrl: 'https://pro-api.homeadvisor.com/leads/submit',
        timeouts: { ping: 2500, post: 10000 },
        retryPolicy: this.getAggressiveRetryPolicy()
      }
    };
  }

  // Angi service configurations (similar pattern with Angi-specific field mappings)
  private static angiWindowsConfig(): BuyerServiceConfig {
    return {
      buyerId: 'angi',
      serviceTypeId: 'windows',
      serviceTypeName: 'Windows',
      active: true,
      priority: 85,
      pricing: {
        basePrice: 40,
        priceModifiers: [
          { field: 'numberOfWindows', operator: 'range', value: [8, 15], modifier: 1.3, type: 'multiply' }
        ],
        maxBid: 120,
        minBid: 20,
        currency: 'USD'
      },
      pingTemplate: {
        mappings: [
          { sourceField: 'zipCode', targetField: 'zip', required: true },
          { sourceField: 'ownsHome', targetField: 'homeowner_status', transform: 'service.homeOwnership', required: true },
          { sourceField: 'timeframe', targetField: 'timeline', transform: 'service.projectTimeframe' }
        ],
        includeCompliance: false
      },
      postTemplate: {
        mappings: [
          { sourceField: 'zipCode', targetField: 'zip', required: true },
          { sourceField: 'ownsHome', targetField: 'homeowner_status', transform: 'service.homeOwnership', required: true },
          { sourceField: 'timeframe', targetField: 'timeline', transform: 'service.projectTimeframe' },
          { sourceField: 'numberOfWindows', targetField: 'window_qty', transform: 'number.integer' },
          { sourceField: 'firstName', targetField: 'fname', required: true },
          { sourceField: 'lastName', targetField: 'lname', required: true },
          { sourceField: 'email', targetField: 'email', required: true, validation: ValidationRuleBuilder.email().build() },
          { sourceField: 'phone', targetField: 'phone', required: true, transform: 'phone.normalize' }
        ],
        includeCompliance: true,
        additionalFields: {
          category: 'windows',
          source: 'partner'
        }
      },
      webhookConfig: {
        pingUrl: 'https://api.angi.com/v1/ping',
        postUrl: 'https://api.angi.com/v1/leads',
        timeouts: { ping: 4000, post: 12000 },
        retryPolicy: this.getConservativeRetryPolicy()
      }
    };
  }

  private static angiBathroomConfig(): BuyerServiceConfig {
    return {
      buyerId: 'angi',
      serviceTypeId: 'bathrooms',
      serviceTypeName: 'Bathrooms',
      active: true,
      priority: 83,
      pricing: {
        basePrice: 55,
        priceModifiers: [
          { field: 'numberOfBathrooms', operator: 'range', value: [2, 4], modifier: 1.4, type: 'multiply' }
        ],
        maxBid: 180,
        minBid: 25,
        currency: 'USD'
      },
      pingTemplate: {
        mappings: [
          { sourceField: 'zipCode', targetField: 'zip', required: true },
          { sourceField: 'ownsHome', targetField: 'homeowner_status', transform: 'service.homeOwnership', required: true },
          { sourceField: 'timeframe', targetField: 'timeline', transform: 'service.projectTimeframe' }
        ],
        includeCompliance: false
      },
      postTemplate: {
        mappings: [
          { sourceField: 'zipCode', targetField: 'zip', required: true },
          { sourceField: 'ownsHome', targetField: 'homeowner_status', transform: 'service.homeOwnership', required: true },
          { sourceField: 'timeframe', targetField: 'timeline', transform: 'service.projectTimeframe' },
          { sourceField: 'numberOfBathrooms', targetField: 'bathroom_qty', transform: 'number.integer' },
          { sourceField: 'firstName', targetField: 'fname', required: true },
          { sourceField: 'lastName', targetField: 'lname', required: true },
          { sourceField: 'email', targetField: 'email', required: true, validation: ValidationRuleBuilder.email().build() },
          { sourceField: 'phone', targetField: 'phone', required: true, transform: 'phone.normalize' }
        ],
        includeCompliance: true,
        additionalFields: {
          category: 'bathrooms',
          source: 'partner'
        }
      },
      webhookConfig: {
        pingUrl: 'https://api.angi.com/v1/ping',
        postUrl: 'https://api.angi.com/v1/leads',
        timeouts: { ping: 4000, post: 12000 },
        retryPolicy: this.getConservativeRetryPolicy()
      }
    };
  }

  private static angiRoofingConfig(): BuyerServiceConfig {
    return {
      buyerId: 'angi',
      serviceTypeId: 'roofing',
      serviceTypeName: 'Roofing',
      active: true,
      priority: 80,
      pricing: {
        basePrice: 90,
        priceModifiers: [
          { field: 'roofingSquareFootage', operator: 'range', value: [2500, 4000], modifier: 1.5, type: 'multiply' }
        ],
        maxBid: 280,
        minBid: 45,
        currency: 'USD'
      },
      pingTemplate: {
        mappings: [
          { sourceField: 'zipCode', targetField: 'zip', required: true },
          { sourceField: 'ownsHome', targetField: 'homeowner_status', transform: 'service.homeOwnership', required: true },
          { sourceField: 'timeframe', targetField: 'timeline', transform: 'service.projectTimeframe' }
        ],
        includeCompliance: false
      },
      postTemplate: {
        mappings: [
          { sourceField: 'zipCode', targetField: 'zip', required: true },
          { sourceField: 'ownsHome', targetField: 'homeowner_status', transform: 'service.homeOwnership', required: true },
          { sourceField: 'timeframe', targetField: 'timeline', transform: 'service.projectTimeframe' },
          { sourceField: 'roofingSquareFootage', targetField: 'roof_size_sqft', transform: 'number.integer' },
          { sourceField: 'firstName', targetField: 'fname', required: true },
          { sourceField: 'lastName', targetField: 'lname', required: true },
          { sourceField: 'email', targetField: 'email', required: true, validation: ValidationRuleBuilder.email().build() },
          { sourceField: 'phone', targetField: 'phone', required: true, transform: 'phone.normalize' }
        ],
        includeCompliance: true,
        additionalFields: {
          category: 'roofing',
          source: 'partner'
        }
      },
      webhookConfig: {
        pingUrl: 'https://api.angi.com/v1/ping',
        postUrl: 'https://api.angi.com/v1/leads',
        timeouts: { ping: 4000, post: 12000 },
        retryPolicy: this.getConservativeRetryPolicy()
      }
    };
  }

  // Global settings for each buyer
  private static modernizeGlobalSettings(): BuyerGlobalSettings {
    return {
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
        cooldownPeriod: 300000 // 5 minutes
      },
      complianceRequirements: {
        requireTrustedForm: true,
        requireJornaya: true,
        requireTcpaConsent: true,
        additionalRequirements: ['privacy_policy_acceptance']
      },
      complianceFieldMappings: {
        trustedForm: {
          certUrl: ['trustedform_cert_url', 'tf_certificate'],
          certId: ['trustedform_token', 'tf_cert_id']
        },
        jornaya: {
          leadId: ['leadid_token', 'jornaya_lead_id']
        },
        tcpa: {
          consent: ['tcpa_consent', 'consent_given'],
          timestamp: ['consent_date']
        },
        technical: {
          ipAddress: ['ip_address'],
          userAgent: ['user_agent'],
          timestamp: ['submit_timestamp']
        },
        geo: {
          latitude: ['lat'],
          longitude: ['lng'],
          city: ['city_name'],
          state: ['state_code']
        }
      }
    };
  }

  private static homeAdvisorGlobalSettings(): BuyerGlobalSettings {
    return {
      defaultTimeout: 8000,
      maxConcurrentRequests: 75,
      rateLimiting: {
        requestsPerMinute: 150,
        requestsPerHour: 3000,
        requestsPerDay: 30000
      },
      failoverSettings: {
        enabled: true,
        maxFailures: 5,
        cooldownPeriod: 600000 // 10 minutes
      },
      complianceRequirements: {
        requireTrustedForm: true,
        requireJornaya: true,
        requireTcpaConsent: true,
        additionalRequirements: ['geolocation', 'device_fingerprint']
      },
      complianceFieldMappings: {
        trustedForm: {
          certUrl: ['tf_cert_url', 'certificate_url', 'trustedform_url'],
          certId: ['tf_token', 'certificate_token']
        },
        jornaya: {
          leadId: ['universal_leadid', 'jornaya_token', 'lead_identifier']
        },
        tcpa: {
          consent: ['consent_status', 'tcpa_flag', 'opt_in'],
          timestamp: ['consent_timestamp', 'opt_in_time']
        },
        technical: {
          ipAddress: ['client_ip', 'source_ip'],
          userAgent: ['browser_string', 'user_agent_string'],
          timestamp: ['submission_time', 'received_at']
        },
        geo: {
          latitude: ['geo_lat', 'location_lat'],
          longitude: ['geo_lon', 'location_lon'],
          city: ['customer_city', 'location_city'],
          state: ['customer_state', 'location_state']
        }
      }
    };
  }

  private static angiGlobalSettings(): BuyerGlobalSettings {
    return {
      defaultTimeout: 6000,
      maxConcurrentRequests: 30,
      rateLimiting: {
        requestsPerMinute: 60,
        requestsPerHour: 1500,
        requestsPerDay: 15000
      },
      failoverSettings: {
        enabled: true,
        maxFailures: 2,
        cooldownPeriod: 180000 // 3 minutes
      },
      complianceRequirements: {
        requireTrustedForm: false,
        requireJornaya: true,
        requireTcpaConsent: true,
        additionalRequirements: []
      },
      complianceFieldMappings: {
        // Angi doesn't require TrustedForm, so we can omit those mappings
        // or include them anyway in case they're present
        trustedForm: {
          certUrl: ['cert_url'],
          certId: ['cert_id']
        },
        jornaya: {
          leadId: ['leadid', 'jornaya_id']  // Angi uses simple field names
        },
        tcpa: {
          consent: ['consent', 'opted_in'],
          timestamp: ['consent_time']
        },
        technical: {
          ipAddress: ['ip'],
          userAgent: ['agent'],
          timestamp: ['timestamp']
        },
        geo: {
          latitude: ['latitude'],
          longitude: ['longitude'],
          city: ['city'],
          state: ['state']
        }
      }
    };
  }

  // Retry policies
  private static getStandardRetryPolicy(): RetryPolicy {
    return {
      maxAttempts: 3,
      backoffStrategy: 'exponential',
      baseDelay: 1000,
      maxDelay: 10000
    };
  }

  private static getAggressiveRetryPolicy(): RetryPolicy {
    return {
      maxAttempts: 5,
      backoffStrategy: 'exponential',
      baseDelay: 500,
      maxDelay: 8000
    };
  }

  private static getConservativeRetryPolicy(): RetryPolicy {
    return {
      maxAttempts: 2,
      backoffStrategy: 'linear',
      baseDelay: 2000,
      maxDelay: 6000
    };
  }
}

/**
 * Initialize all buyer configurations
 */
export function initializeBuyerConfigurations(): void {
  // Register all pre-configured buyers
  BuyerConfigurationRegistry.register(BuyerTemplates.modernize());
  BuyerConfigurationRegistry.register(BuyerTemplates.homeAdvisor());
  BuyerConfigurationRegistry.register(BuyerTemplates.angi());
}

// Export the static classes directly
export { BuyerConfigurationRegistry, BuyerTemplates };