/**
 * Template Engine Core
 * Central orchestrator for data transformation and validation
 */

import {
  TemplateConfig,
  TemplateMapping,
  LeadData,
  BuyerConfig,
  TransformContext,
  TemplateEngineError,
  TransformationError,
  ValidationError,
  PerformanceMetrics,
  TransformFunction
} from './types';
import { Transformations } from './transformations';
import { DataValidator } from './validator';

export class TemplateEngine {
  private static performanceMetrics: PerformanceMetrics['templateEngineMetrics'] = {
    transformationTime: 0,
    validationTime: 0,
    totalProcessingTime: 0,
    errorRate: 0,
    throughput: 0
  };

  /**
   * Transform lead data using template configuration
   */
  static async transform(
    lead: LeadData,
    buyer: BuyerConfig,
    templateConfig: TemplateConfig,
    includeCompliance: boolean = false
  ): Promise<Record<string, any>> {
    const startTime = Date.now();

    try {
      // Validate input data
      const validationStart = Date.now();
      await this.validateInputs(lead, buyer, templateConfig);
      this.performanceMetrics.validationTime += Date.now() - validationStart;

      // Prepare transformation context
      const context: TransformContext = {
        lead,
        buyer,
        serviceType: lead.serviceType.name,
        metadata: {
          timestamp: new Date().toISOString(),
          transformationId: this.generateTransformationId(),
          includeCompliance
        }
      };

      // Execute pre-transform hooks
      let sourceData = this.prepareSourceData(lead);
      if (templateConfig.hooks?.beforeTransform) {
        sourceData = templateConfig.hooks.beforeTransform(sourceData);
      }

      // Apply field mappings and transformations
      const transformStart = Date.now();
      const result = await this.applyMappings(sourceData, templateConfig.mappings, context);
      this.performanceMetrics.transformationTime += Date.now() - transformStart;

      // Add compliance data if requested
      if (includeCompliance) {
        this.addComplianceFields(result, lead, buyer);
      }

      // Add additional fields from template config
      if (templateConfig.additionalFields) {
        Object.assign(result, templateConfig.additionalFields);
      }

      // Execute post-transform hooks
      let finalResult = result;
      if (templateConfig.hooks?.afterTransform) {
        finalResult = templateConfig.hooks.afterTransform(result);
      }

      // Validate final payload
      const finalValidationStart = Date.now();
      await this.validateFinalPayload(finalResult, templateConfig);
      this.performanceMetrics.validationTime += Date.now() - finalValidationStart;

      // Update performance metrics
      const totalTime = Date.now() - startTime;
      this.performanceMetrics.totalProcessingTime += totalTime;
      this.performanceMetrics.throughput++;

      return finalResult;

    } catch (error) {
      this.performanceMetrics.errorRate++;

      // Execute error hook if available
      if (templateConfig.hooks?.onError) {
        templateConfig.hooks.onError(error as Error, lead);
      }

      // Re-throw with context
      if (error instanceof TemplateEngineError) {
        throw error;
      }

      throw new TemplateEngineError(
        `Transformation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'TRANSFORM_FAILED',
        { leadId: lead.id, buyerId: buyer.id, error }
      );
    }
  }

  /**
   * Apply template mappings to source data
   */
  private static async applyMappings(
    sourceData: Record<string, any>,
    mappings: TemplateMapping[],
    context: TransformContext
  ): Promise<Record<string, any>> {
    const result: Record<string, any> = {};

    // Process mappings in parallel for performance
    const mappingPromises = mappings.map(async (mapping) => {
      try {
        const value = await this.processMapping(sourceData, mapping, context);
        return { field: mapping.targetField, value };
      } catch (error) {
        throw new TransformationError(
          mapping.sourceField,
          error instanceof Error ? error.message : 'Mapping failed',
          { mapping, sourceData: sourceData[mapping.sourceField] }
        );
      }
    });

    const mappingResults = await Promise.allSettled(mappingPromises);

    // Process results and collect errors
    const errors: string[] = [];
    for (const mappingResult of mappingResults) {
      if (mappingResult.status === 'fulfilled') {
        const { field, value } = mappingResult.value;
        if (value !== undefined) {
          result[field] = value;
        }
      } else {
        errors.push(mappingResult.reason.message);
      }
    }

    if (errors.length > 0) {
      throw new TemplateEngineError(
        `Multiple mapping errors occurred: ${errors.join(', ')}`,
        'MAPPING_ERRORS',
        { errors, mappingCount: mappings.length }
      );
    }

    return result;
  }

  /**
   * Process individual field mapping
   */
  private static async processMapping(
    sourceData: Record<string, any>,
    mapping: TemplateMapping,
    context: TransformContext
  ): Promise<any> {
    // Get source value (supports nested paths)
    let value = this.getNestedValue(sourceData, mapping.sourceField);

    // Use default value if source value is undefined
    if (value === undefined && mapping.defaultValue !== undefined) {
      value = mapping.defaultValue;
    }

    // Validate required fields
    if (mapping.required && (value === null || value === undefined || value === '')) {
      throw new ValidationError(
        mapping.sourceField,
        `Required field '${mapping.sourceField}' is missing or empty`
      );
    }

    // Skip transformation if value is null/undefined and field is not required
    if (!mapping.required && (value === null || value === undefined)) {
      return undefined;
    }

    // Apply validation if specified
    if (mapping.validation) {
      const validationResult = DataValidator.validateField(
        mapping.sourceField,
        value,
        mapping.validation
      );

      if (!validationResult.isValid) {
        throw new ValidationError(
          mapping.sourceField,
          validationResult.error || 'Validation failed'
        );
      }
    }

    // Apply valueMap if specified (database-driven value conversion)
    // This happens BEFORE transforms - converts "within_3_months" → "1-6 months"
    // This is ADMIN-CONFIGURABLE - no hardcoded transforms needed!
    if (mapping.valueMap && typeof value === 'string') {
      const mappedValue = mapping.valueMap[value];
      if (mappedValue !== undefined) {
        value = mappedValue;
      }
      // If no match in valueMap, keep original value
    }

    // Apply transformation if specified (formatting like phone.digitsOnly, boolean.yesNo)
    if (mapping.transform) {
      value = await this.applyTransformation(value, mapping.transform, context);
    }

    return value;
  }

  /**
   * Apply transformation function
   */
  private static async applyTransformation(
    value: any,
    transform: string | Function,
    context: TransformContext
  ): Promise<any> {
    try {
      if (typeof transform === 'string') {
        return Transformations.applyTransform(value, transform, context);
      } else if (typeof transform === 'function') {
        return await transform(value, context);
      } else {
        throw new Error('Invalid transformation type');
      }
    } catch (error) {
      throw new TransformationError(
        'transform',
        `Transformation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { value, transform }
      );
    }
  }

  /**
   * Prepare source data from lead
   */
  private static prepareSourceData(lead: LeadData): Record<string, any> {
    return {
      // Basic lead fields
      id: lead.id,
      serviceTypeId: lead.serviceTypeId,
      serviceTypeName: lead.serviceType.name,
      zipCode: lead.zipCode,
      ownsHome: lead.ownsHome,
      timeframe: lead.timeframe,
      status: lead.status,
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt,

      // Form data (flattened)
      ...lead.formData,

      // Compliance data
      trustedFormCertUrl: lead.trustedFormCertUrl,
      trustedFormCertId: lead.trustedFormCertId,
      jornayaLeadId: lead.jornayaLeadId,
      activeProspectLeadId: lead.activeProspectLeadId,
      activeProspectCampaignId: lead.activeProspectCampaignId,
      complianceData: lead.complianceData,

      // Computed fields
      submissionTimestamp: lead.createdAt.toISOString(),
      leadAge: Date.now() - lead.createdAt.getTime(),
      hasCompliance: !!(lead.trustedFormCertUrl && lead.jornayaLeadId)
    };
  }

  /**
   * Add compliance fields to result payload using buyer-specific field mappings
   */
  private static addComplianceFields(
    result: Record<string, any>,
    lead: LeadData,
    buyer: BuyerConfig
  ): void {
    // Get custom field mappings or use defaults
    const mappings = buyer.globalSettings.complianceFieldMappings || this.getDefaultComplianceFieldMappings();

    // TrustedForm fields
    if (lead.trustedFormCertUrl && mappings.trustedForm?.certUrl) {
      for (const fieldName of mappings.trustedForm.certUrl) {
        result[fieldName] = lead.trustedFormCertUrl;
      }
    }

    if (lead.trustedFormCertId && mappings.trustedForm?.certId) {
      for (const fieldName of mappings.trustedForm.certId) {
        result[fieldName] = lead.trustedFormCertId;
      }
    }

    // Jornaya LeadID fields
    if (lead.jornayaLeadId && mappings.jornaya?.leadId) {
      for (const fieldName of mappings.jornaya.leadId) {
        result[fieldName] = lead.jornayaLeadId;
      }
    }

    // ActiveProspect LeadiD fields
    if (lead.activeProspectLeadId && mappings.activeProspect?.leadId) {
      for (const fieldName of mappings.activeProspect.leadId) {
        result[fieldName] = lead.activeProspectLeadId;
      }
    }

    if (lead.activeProspectCampaignId && mappings.activeProspect?.campaignId) {
      for (const fieldName of mappings.activeProspect.campaignId) {
        result[fieldName] = lead.activeProspectCampaignId;
      }
    }

    // TCPA compliance
    if (lead.complianceData) {
      const compliance = lead.complianceData;

      // Affiliate tracking fields (ref → partnerSourceId, affiliate_id → publisherSubId for Modernize)
      if (compliance.attribution && mappings.affiliate) {
        const affiliateMappings = mappings.affiliate;

        // ref code → partnerSourceId
        if (compliance.attribution.ref && affiliateMappings.ref) {
          for (const fieldName of affiliateMappings.ref) {
            result[fieldName] = compliance.attribution.ref;
          }
        }

        // affiliate_id → publisherSubId
        if (compliance.attribution.affiliate_id && affiliateMappings.affiliateId) {
          for (const fieldName of affiliateMappings.affiliateId) {
            result[fieldName] = compliance.attribution.affiliate_id;
          }
        }
      }

      // TCPA consent
      if (compliance.tcpaConsent !== undefined && mappings.tcpa?.consent) {
        for (const fieldName of mappings.tcpa.consent) {
          result[fieldName] = compliance.tcpaConsent;
        }
      }

      if (compliance.tcpaConsent !== undefined && mappings.tcpa?.timestamp) {
        for (const fieldName of mappings.tcpa.timestamp) {
          result[fieldName] = compliance.timestamp;
        }
      }

      // Privacy policy (keep existing behavior for backwards compatibility)
      if (compliance.privacyPolicyAccepted !== undefined) {
        result.privacy_policy_accepted = compliance.privacyPolicyAccepted;
        result.terms_accepted = compliance.privacyPolicyAccepted;
      }

      // Technical compliance data
      if (compliance.ipAddress && mappings.technical?.ipAddress) {
        for (const fieldName of mappings.technical.ipAddress) {
          result[fieldName] = compliance.ipAddress;
        }
      }

      if (compliance.userAgent && mappings.technical?.userAgent) {
        for (const fieldName of mappings.technical.userAgent) {
          result[fieldName] = compliance.userAgent;
        }
      }

      if (compliance.timestamp && mappings.technical?.timestamp) {
        for (const fieldName of mappings.technical.timestamp) {
          result[fieldName] = compliance.timestamp;
        }
      }

      // Geo location data
      if (compliance.geoLocation) {
        const geo = compliance.geoLocation;

        if (geo.latitude && mappings.geo?.latitude) {
          for (const fieldName of mappings.geo.latitude) {
            result[fieldName] = geo.latitude;
          }
        }

        if (geo.longitude && mappings.geo?.longitude) {
          for (const fieldName of mappings.geo.longitude) {
            result[fieldName] = geo.longitude;
          }
        }

        if (geo.city && mappings.geo?.city) {
          for (const fieldName of mappings.geo.city) {
            result[fieldName] = geo.city;
          }
        }

        if (geo.state && mappings.geo?.state) {
          for (const fieldName of mappings.geo.state) {
            result[fieldName] = geo.state;
          }
        }
      }

      // Source tracking (keep existing behavior)
      result.lead_source = compliance.submissionSource || 'web_form';
      result.traffic_source = 'organic';
      result.submission_method = 'form';
    }
  }

  /**
   * Get default compliance field mappings (used when buyer doesn't specify custom mappings)
   */
  private static getDefaultComplianceFieldMappings() {
    return {
      trustedForm: {
        certUrl: ['xxTrustedFormCertUrl', 'trusted_form_cert_url'],
        certId: ['xxTrustedFormToken', 'trusted_form_token']
      },
      jornaya: {
        leadId: ['universal_leadid', 'jornaya_leadid', 'leadid']
      },
      activeProspect: {
        leadId: ['activeprospect_leadid', 'ap_leadid'],
        campaignId: ['campaign_id', 'ap_campaign']
      },
      affiliate: {
        ref: ['partner_source_id', 'affiliate_ref'],
        affiliateId: ['publisher_sub_id', 'affiliate_id']
      },
      tcpa: {
        consent: ['tcpa_consent', 'opt_in_consent', 'marketing_consent'],
        timestamp: ['consent_timestamp']
      },
      technical: {
        ipAddress: ['ip_address', 'client_ip'],
        userAgent: ['user_agent', 'browser_info'],
        timestamp: ['submission_timestamp']
      },
      geo: {
        latitude: ['latitude'],
        longitude: ['longitude'],
        city: ['city'],
        state: ['state']
      }
    };
  }

  /**
   * Validate inputs before transformation
   */
  private static async validateInputs(
    lead: LeadData,
    buyer: BuyerConfig,
    templateConfig: TemplateConfig
  ): Promise<void> {
    // Validate lead data structure
    const leadValidation = DataValidator.validateLeadData(lead);
    if (!leadValidation.isValid) {
      throw new ValidationError(
        'leadData',
        `Invalid lead data: ${leadValidation.errors.join(', ')}`
      );
    }

    // Validate buyer configuration
    if (!buyer.id || !buyer.name) {
      throw new ValidationError('buyerConfig', 'Invalid buyer configuration');
    }

    // Validate template configuration
    if (!templateConfig.mappings || templateConfig.mappings.length === 0) {
      throw new ValidationError('templateConfig', 'Template mappings are required');
    }

    // Validate mappings structure
    for (const mapping of templateConfig.mappings) {
      if (!mapping.sourceField || !mapping.targetField) {
        throw new ValidationError(
          'templateMapping',
          'Invalid mapping: sourceField and targetField are required'
        );
      }
    }
  }

  /**
   * Validate final payload before returning
   */
  private static async validateFinalPayload(
    payload: Record<string, any>,
    templateConfig: TemplateConfig
  ): Promise<void> {
    // Check for required target fields
    const requiredTargetFields = templateConfig.mappings
      .filter(m => m.required)
      .map(m => m.targetField);

    for (const field of requiredTargetFields) {
      if (payload[field] === undefined || payload[field] === null || payload[field] === '') {
        throw new ValidationError(
          field,
          `Required target field '${field}' is missing in final payload`
        );
      }
    }

    // Validate payload size
    const sizeValidation = DataValidator.validatePayloadSize(payload);
    if (!sizeValidation.isValid) {
      throw new ValidationError('payloadSize', sizeValidation.error || 'Payload too large');
    }

    // Sanitize final payload
    const sanitizedPayload = DataValidator.sanitizeData(payload);
    Object.assign(payload, sanitizedPayload);
  }

  /**
   * Get nested value from object using dot notation
   */
  private static getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * Generate unique transformation ID for tracking
   */
  private static generateTransformationId(): string {
    return `tf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get performance metrics
   */
  static getPerformanceMetrics(): PerformanceMetrics['templateEngineMetrics'] {
    return { ...this.performanceMetrics };
  }

  /**
   * Reset performance metrics
   */
  static resetPerformanceMetrics(): void {
    this.performanceMetrics = {
      transformationTime: 0,
      validationTime: 0,
      totalProcessingTime: 0,
      errorRate: 0,
      throughput: 0
    };
  }

  /**
   * Batch transform multiple leads for the same buyer
   */
  static async batchTransform(
    leads: LeadData[],
    buyer: BuyerConfig,
    templateConfig: TemplateConfig,
    includeCompliance: boolean = false
  ): Promise<Array<{ leadId: string; result?: Record<string, any>; error?: string }>> {
    const transformPromises = leads.map(async (lead) => {
      try {
        const result = await this.transform(lead, buyer, templateConfig, includeCompliance);
        return { leadId: lead.id, result };
      } catch (error) {
        return {
          leadId: lead.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    return Promise.all(transformPromises);
  }

  /**
   * Create template config builder for fluent API
   */
  static createConfig(): TemplateConfigBuilder {
    return new TemplateConfigBuilder();
  }
}

/**
 * Template configuration builder for fluent API
 */
export class TemplateConfigBuilder {
  private config: Partial<TemplateConfig> = {
    mappings: [],
    includeCompliance: false,
    additionalFields: {},
    transformations: {},
    validations: {}
  };

  addMapping(mapping: TemplateMapping): this {
    this.config.mappings!.push(mapping);
    return this;
  }

  map(sourceField: string, targetField: string): MappingBuilder {
    return new MappingBuilder(this, sourceField, targetField);
  }

  includeCompliance(include: boolean = true): this {
    this.config.includeCompliance = include;
    return this;
  }

  addField(name: string, value: any): this {
    this.config.additionalFields![name] = value;
    return this;
  }

  beforeTransform(hook: (data: any) => any): this {
    if (!this.config.hooks) this.config.hooks = {};
    this.config.hooks.beforeTransform = hook;
    return this;
  }

  afterTransform(hook: (data: any) => any): this {
    if (!this.config.hooks) this.config.hooks = {};
    this.config.hooks.afterTransform = hook;
    return this;
  }

  onError(hook: (error: Error, data: any) => void): this {
    if (!this.config.hooks) this.config.hooks = {};
    this.config.hooks.onError = hook;
    return this;
  }

  build(): TemplateConfig {
    return this.config as TemplateConfig;
  }
}

/**
 * Mapping builder for fluent API
 */
export class MappingBuilder {
  private mapping: Partial<TemplateMapping>;

  constructor(
    private configBuilder: TemplateConfigBuilder,
    sourceField: string,
    targetField: string
  ) {
    this.mapping = { sourceField, targetField };
  }

  transform(transform: string | TransformFunction): this {
    this.mapping.transform = transform;
    return this;
  }

  required(isRequired: boolean = true): this {
    this.mapping.required = isRequired;
    return this;
  }

  defaultValue(value: any): this {
    this.mapping.defaultValue = value;
    return this;
  }

  validate(validation: any): this {
    this.mapping.validation = validation;
    return this;
  }

  done(): TemplateConfigBuilder {
    this.configBuilder.addMapping(this.mapping as TemplateMapping);
    return this.configBuilder;
  }
}

export default TemplateEngine;