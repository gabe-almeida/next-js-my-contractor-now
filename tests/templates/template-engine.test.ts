/**
 * Comprehensive Test Suite for Template Engine
 * Tests all core functionality including transformations, validations, and auction system
 */

import {
  TemplateEngine,
  Transformations,
  DataValidator,
  ValidationRuleBuilder,
  TemplateEngineOrchestrator,
  AuctionEngine,
  BuyerConfigurationRegistry,
  BuyerTemplates,
  PerformanceMonitor,
  RetryHandler
} from '../../src/lib/templates';

import {
  LeadData,
  BuyerConfig,
  TemplateConfig,
  ServiceType,
  ComplianceData,
  AuctionResult,
  BidResponse
} from '../../src/lib/templates/types';

// Mock data for testing
const createMockLead = (): LeadData => ({
  id: 'lead_123',
  serviceTypeId: 'windows',
  serviceType: {
    id: 'windows',
    name: 'Windows',
    formSchema: {
      fields: [],
      validations: []
    },
    active: true
  },
  formData: {
    numberOfWindows: 8,
    windowsProjectScope: 'full_replacement',
    windowsStyle: 'double_hung',
    windowsMaterial: 'vinyl',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    phone: '5551234567',
    address: '123 Main St',
    city: 'Anytown',
    state: 'CA'
  },
  zipCode: '90210',
  ownsHome: true,
  timeframe: 'within_month',
  status: 'pending',
  trustedFormCertUrl: 'https://cert.trustedform.com/cert123',
  trustedFormCertId: 'cert123',
  jornayaLeadId: 'jornaya456',
  complianceData: {
    userAgent: 'Mozilla/5.0 Test Browser',
    timestamp: new Date().toISOString(),
    ipAddress: '192.168.1.100',
    tcpaConsent: true,
    privacyPolicyAccepted: true,
    submissionSource: 'web_form'
  },
  createdAt: new Date(),
  updatedAt: new Date()
});

const createMockTemplateConfig = (): TemplateConfig => ({
  mappings: [
    { sourceField: 'zipCode', targetField: 'zip_code', required: true },
    { sourceField: 'ownsHome', targetField: 'homeowner', transform: 'boolean.yesNo', required: true },
    { sourceField: 'numberOfWindows', targetField: 'window_count', transform: 'service.windowsCount' },
    { sourceField: 'firstName', targetField: 'first_name', required: true },
    { sourceField: 'email', targetField: 'email_address', required: true, validation: ValidationRuleBuilder.email().build() },
    { sourceField: 'phone', targetField: 'phone_number', transform: 'phone.normalize' }
  ],
  includeCompliance: true,
  additionalFields: {
    lead_source: 'contractor_platform',
    quality_score: 'A'
  }
});

describe('Template Engine Core Tests', () => {
  beforeEach(async () => {
    // Initialize the system before each test
    await TemplateEngineOrchestrator.initialize();
    PerformanceMonitor.reset();
  });

  afterEach(() => {
    // Clean up after each test
    RetryHandler.clearRetryQueue();
    PerformanceMonitor.reset();
  });

  describe('Data Transformations', () => {
    test('should transform string values correctly', () => {
      expect(Transformations.string.uppercase('hello world')).toBe('HELLO WORLD');
      expect(Transformations.string.lowercase('HELLO WORLD')).toBe('hello world');
      expect(Transformations.string.capitalize('hello world')).toBe('Hello world');
      expect(Transformations.string.slugify('Hello World!')).toBe('hello-world');
    });

    test('should transform number values correctly', () => {
      expect(Transformations.number.integer('123')).toBe(123);
      expect(Transformations.number.float('123.45')).toBe(123.45);
      expect(Transformations.number.round(2)(123.456)).toBe(123.46);
    });

    test('should transform boolean values correctly', () => {
      expect(Transformations.boolean.yesNo(true)).toBe('Yes');
      expect(Transformations.boolean.yesNo(false)).toBe('No');
      expect(Transformations.boolean.oneZero('true')).toBe('1');
      expect(Transformations.boolean.oneZero('false')).toBe('0');
    });

    test('should transform phone numbers correctly', () => {
      expect(Transformations.phone.normalize('(555) 123-4567')).toBe('+15551234567');
      expect(Transformations.phone.e164('5551234567')).toBe('+15551234567');
    });

    test('should transform service-specific values correctly', () => {
      expect(Transformations.service.windowsCount(1)).toBe('1 window');
      expect(Transformations.service.windowsCount(8)).toBe('6-10 windows');
      expect(Transformations.service.windowsCount(25)).toBe('20+ windows');
      
      expect(Transformations.service.bathroomCount(1)).toBe('1 bathroom');
      expect(Transformations.service.bathroomCount(3)).toBe('3 bathrooms');
      
      expect(Transformations.service.projectTimeframe('within_month')).toBe('Within 1 month');
      expect(Transformations.service.projectTimeframe('asap')).toBe('ASAP');
    });

    test('should handle transformation errors gracefully', () => {
      expect(() => Transformations.number.integer('not a number')).toThrow();
      expect(() => Transformations.phone.e164('invalid')).toThrow();
    });
  });

  describe('Data Validation', () => {
    test('should validate string fields correctly', () => {
      const rule = ValidationRuleBuilder.string().min(5).max(20).build();
      
      expect(DataValidator.validateField('test', 'hello world', rule).isValid).toBe(true);
      expect(DataValidator.validateField('test', 'hi', rule).isValid).toBe(false);
      expect(DataValidator.validateField('test', 'this is a very long string', rule).isValid).toBe(false);
    });

    test('should validate email addresses correctly', () => {
      const rule = ValidationRuleBuilder.email().build();
      
      expect(DataValidator.validateField('email', 'user@example.com', rule).isValid).toBe(true);
      expect(DataValidator.validateField('email', 'invalid-email', rule).isValid).toBe(false);
    });

    test('should validate phone numbers correctly', () => {
      const rule = ValidationRuleBuilder.phone().build();
      
      expect(DataValidator.validateField('phone', '5551234567', rule).isValid).toBe(true);
      expect(DataValidator.validateField('phone', '(555) 123-4567', rule).isValid).toBe(true);
      expect(DataValidator.validateField('phone', '123', rule).isValid).toBe(false);
    });

    test('should validate ZIP codes correctly', () => {
      const rule = ValidationRuleBuilder.zipcode().build();
      
      expect(DataValidator.validateField('zip', '90210', rule).isValid).toBe(true);
      expect(DataValidator.validateField('zip', '90210-1234', rule).isValid).toBe(true);
      expect(DataValidator.validateField('zip', '902', rule).isValid).toBe(false);
    });

    test('should validate required fields correctly', () => {
      const mapping = { sourceField: 'test', targetField: 'test', required: true };
      
      expect(DataValidator.validateRequired('test', 'value', mapping).isValid).toBe(true);
      expect(DataValidator.validateRequired('test', '', mapping).isValid).toBe(false);
      expect(DataValidator.validateRequired('test', null, mapping).isValid).toBe(false);
    });

    test('should validate complete lead data', () => {
      const lead = createMockLead();
      const validation = DataValidator.validateLeadData(lead);
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should detect invalid lead data', () => {
      const invalidLead = { ...createMockLead(), zipCode: 'invalid', ownsHome: null as any };
      const validation = DataValidator.validateLeadData(invalidLead);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Template Engine Core', () => {
    test('should transform lead data using template configuration', async () => {
      const lead = createMockLead();
      const buyer = BuyerTemplates.modernize();
      const templateConfig = createMockTemplateConfig();

      const result = await TemplateEngine.transform(lead, buyer, templateConfig, true);

      expect(result).toHaveProperty('zip_code', '90210');
      expect(result).toHaveProperty('homeowner', 'Yes');
      expect(result).toHaveProperty('window_count', '6-10 windows');
      expect(result).toHaveProperty('first_name', 'John');
      expect(result).toHaveProperty('email_address', 'john.doe@example.com');
      expect(result).toHaveProperty('phone_number', '+15551234567');
      
      // Check compliance fields
      expect(result).toHaveProperty('xxTrustedFormCertUrl', 'https://cert.trustedform.com/cert123');
      expect(result).toHaveProperty('universal_leadid', 'jornaya456');
      expect(result).toHaveProperty('tcpa_consent', true);
      
      // Check additional fields
      expect(result).toHaveProperty('lead_source', 'contractor_platform');
      expect(result).toHaveProperty('quality_score', 'A');
    });

    test('should handle missing required fields', async () => {
      const lead = { ...createMockLead(), formData: { ...createMockLead().formData, firstName: '' } };
      const buyer = BuyerTemplates.modernize();
      const templateConfig = createMockTemplateConfig();

      await expect(TemplateEngine.transform(lead, buyer, templateConfig)).rejects.toThrow();
    });

    test('should handle transformation errors gracefully', async () => {
      const lead = createMockLead();
      const buyer = BuyerTemplates.modernize();
      const templateConfig = {
        mappings: [
          { sourceField: 'nonExistentField', targetField: 'target', transform: 'number.integer', required: true }
        ]
      };

      await expect(TemplateEngine.transform(lead, buyer, templateConfig)).rejects.toThrow();
    });

    test('should batch transform multiple leads', async () => {
      const leads = [createMockLead(), createMockLead(), createMockLead()];
      const buyer = BuyerTemplates.modernize();
      const templateConfig = createMockTemplateConfig();

      const results = await TemplateEngine.batchTransform(leads, buyer, templateConfig, true);

      expect(results).toHaveLength(3);
      expect(results[0].result).toBeDefined();
      expect(results[0].error).toBeUndefined();
    });
  });

  describe('Buyer Configuration System', () => {
    test('should register and retrieve buyer configurations', () => {
      const buyer = BuyerTemplates.modernize();
      BuyerConfigurationRegistry.register(buyer);

      const retrieved = BuyerConfigurationRegistry.get('modernize');
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('Modernize');
    });

    test('should get buyers for specific service type', () => {
      BuyerConfigurationRegistry.register(BuyerTemplates.modernize());
      BuyerConfigurationRegistry.register(BuyerTemplates.homeAdvisor());
      BuyerConfigurationRegistry.register(BuyerTemplates.angi());

      const windowsBuyers = BuyerConfigurationRegistry.getBuyersForService('windows');
      expect(windowsBuyers.length).toBeGreaterThan(0);
      
      const allSupported = windowsBuyers.every(buyer => 
        BuyerConfigurationRegistry.supportsService(buyer.id, 'windows')
      );
      expect(allSupported).toBe(true);
    });

    test('should get service configuration for buyer', () => {
      BuyerConfigurationRegistry.register(BuyerTemplates.modernize());

      const serviceConfig = BuyerConfigurationRegistry.getServiceConfig('modernize', 'windows');
      expect(serviceConfig).toBeDefined();
      expect(serviceConfig?.serviceTypeName).toBe('Windows');
      expect(serviceConfig?.active).toBe(true);
    });
  });

  describe('Auction Engine', () => {
    beforeEach(() => {
      // Register buyers for auction tests
      BuyerConfigurationRegistry.register(BuyerTemplates.modernize());
      BuyerConfigurationRegistry.register(BuyerTemplates.homeAdvisor());
      BuyerConfigurationRegistry.register(BuyerTemplates.angi());
    });

    test('should run auction and return result', async () => {
      const lead = createMockLead();

      // Mock fetch to simulate buyer responses
      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ bidAmount: 45, interested: true })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ bidAmount: 50, interested: true })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ bidAmount: 40, interested: true })
        });

      const result = await AuctionEngine.runAuction(lead);

      expect(result.leadId).toBe(lead.id);
      expect(result.status).toBe('completed');
      expect(result.winningBuyerId).toBeDefined();
      expect(result.winningBidAmount).toBeGreaterThan(0);
      expect(result.allBids.length).toBeGreaterThan(0);
      expect(result.participantCount).toBeGreaterThan(0);
    });

    test('should handle auction with no bids', async () => {
      const lead = createMockLead();

      // Mock fetch to simulate buyer rejections
      global.fetch = jest.fn()
        .mockResolvedValue({
          ok: true,
          json: async () => ({ bidAmount: 0, interested: false })
        });

      const result = await AuctionEngine.runAuction(lead);

      expect(result.leadId).toBe(lead.id);
      expect(result.status).toBe('no_bids');
      expect(result.winningBuyerId).toBeUndefined();
      expect(result.winningBidAmount).toBeUndefined();
    });

    test('should handle auction timeout', async () => {
      const lead = createMockLead();

      // Mock fetch to simulate timeout
      global.fetch = jest.fn()
        .mockImplementation(() => new Promise(resolve => {
          setTimeout(() => resolve({
            ok: true,
            json: async () => ({ bidAmount: 45 })
          }), 10000); // Long timeout
        }));

      const config = { maxParticipants: 3, timeoutMs: 100, requireMinimumBid: false, minimumBid: 0, allowTiedBids: false, tiebreakStrategy: 'random' as const };
      const result = await AuctionEngine.runAuction(lead, config);

      expect(result.leadId).toBe(lead.id);
      // Should handle timeout gracefully
    });
  });

  describe('Performance Monitoring', () => {
    test('should record template performance metrics', () => {
      const sample = {
        leadId: 'lead_123',
        buyerId: 'modernize',
        transformationTime: 150,
        validationTime: 50,
        totalProcessingTime: 200,
        success: true,
        fieldCount: 10,
        complianceIncluded: true
      };

      PerformanceMonitor.recordTemplatePerformance(sample);

      const metrics = PerformanceMonitor.getMetrics();
      expect(metrics.templateEngineMetrics.transformationTime).toBeGreaterThan(0);
      expect(metrics.templateEngineMetrics.throughput).toBeGreaterThan(0);
    });

    test('should record auction performance metrics', () => {
      const sample = {
        leadId: 'lead_123',
        auctionDurationMs: 2500,
        participantCount: 3,
        eligibleBuyerCount: 3,
        winningBuyerId: 'modernize',
        winningBidAmount: 50,
        averageResponseTime: 800,
        bidDistribution: { '26-50': 2, '51-100': 1 },
        status: 'completed' as const
      };

      PerformanceMonitor.recordAuctionPerformance(sample);

      const metrics = PerformanceMonitor.getMetrics();
      expect(metrics.auctionMetrics.averageAuctionTime).toBeGreaterThan(0);
      expect(metrics.auctionMetrics.winRate['modernize']).toBeGreaterThan(0);
    });

    test('should record buyer performance metrics', () => {
      const sample = {
        leadId: 'lead_123',
        responseTime: 800,
        success: true,
        operationType: 'PING' as const,
        statusCode: 200,
        bidAmount: 45
      };

      PerformanceMonitor.recordBuyerPerformance('modernize', sample);

      const metrics = PerformanceMonitor.getMetrics();
      expect(metrics.buyerMetrics['modernize']).toBeDefined();
      expect(metrics.buyerMetrics['modernize'].responseTime).toBeGreaterThan(0);
      expect(metrics.buyerMetrics['modernize'].volume).toBeGreaterThan(0);
    });

    test('should generate performance alerts', () => {
      // Record a slow transformation to trigger alert
      const slowSample = {
        leadId: 'lead_123',
        buyerId: 'modernize',
        transformationTime: 2000, // Exceeds threshold
        validationTime: 50,
        totalProcessingTime: 2050,
        success: true,
        fieldCount: 10,
        complianceIncluded: true
      };

      PerformanceMonitor.recordTemplatePerformance(slowSample);

      const alerts = PerformanceMonitor.getAlerts();
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts.some(alert => alert.type === 'high_transformation_time')).toBe(true);
    });
  });

  describe('Template Engine Orchestrator', () => {
    test('should process lead through complete pipeline', async () => {
      const lead = createMockLead();

      // Mock successful auction
      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ bidAmount: 50, interested: true })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, leadId: 'external_123' })
        });

      const result = await TemplateEngineOrchestrator.processLead(lead);

      expect(result.success).toBe(true);
      expect(result.leadId).toBe(lead.id);
      expect(result.auctionResult).toBeDefined();
      expect(result.totalProcessingTime).toBeGreaterThan(0);
    });

    test('should transform lead for specific buyer', async () => {
      const lead = createMockLead();

      const result = await TemplateEngineOrchestrator.transformForBuyer(lead, 'modernize', true);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.fieldCount).toBeGreaterThan(0);
      expect(result.complianceIncluded).toBe(true);
    });

    test('should batch process multiple leads', async () => {
      const leads = [createMockLead(), createMockLead()];

      // Mock auction responses
      global.fetch = jest.fn()
        .mockResolvedValue({
          ok: true,
          json: async () => ({ bidAmount: 45, interested: true })
        });

      const results = await TemplateEngineOrchestrator.batchProcessLeads(leads);

      expect(results).toHaveLength(2);
      expect(results.every(r => r.leadId)).toBe(true);
    });

    test('should return system status', () => {
      const status = TemplateEngineOrchestrator.getSystemStatus();

      expect(status.initialized).toBe(true);
      expect(status.metrics).toBeDefined();
      expect(status.buyers).toBeDefined();
      expect(status.monitoring).toBeDefined();
    });

    test('should perform health check', async () => {
      const health = await TemplateEngineOrchestrator.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.responseTime).toBeGreaterThan(0);
      expect(health.components).toBeDefined();
      expect(health.metrics).toBeDefined();
    });
  });

  describe('Integration Tests', () => {
    test('should handle complete lead processing workflow', async () => {
      const lead = createMockLead();

      // Mock buyer API responses
      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ bidAmount: 50, interested: true })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, leadId: 'external_123' })
        });

      // Process lead
      const result = await TemplateEngineOrchestrator.processLead(lead);

      // Verify successful processing
      expect(result.success).toBe(true);
      expect(result.auctionResult?.status).toBe('completed');
      expect(result.auctionResult?.winningBuyerId).toBeDefined();

      // Verify performance metrics were recorded
      const metrics = PerformanceMonitor.getMetrics();
      expect(metrics.auctionMetrics.averageAuctionTime).toBeGreaterThan(0);

      // Verify transaction logs were created
      const logs = AuctionEngine.getTransactionLogs(lead.id);
      expect(logs.length).toBeGreaterThan(0);
    });

    test('should handle failed auction gracefully', async () => {
      const lead = createMockLead();

      // Mock buyer API failures
      global.fetch = jest.fn()
        .mockRejectedValue(new Error('Network error'));

      const result = await TemplateEngineOrchestrator.processLead(lead);

      expect(result.leadId).toBe(lead.id);
      // Should handle gracefully, may succeed or fail depending on implementation
    });

    test('should maintain performance under load', async () => {
      const leads = Array.from({ length: 10 }, () => createMockLead());

      // Mock consistent responses
      global.fetch = jest.fn()
        .mockResolvedValue({
          ok: true,
          json: async () => ({ bidAmount: 45, interested: true })
        });

      const startTime = Date.now();
      const results = await TemplateEngineOrchestrator.batchProcessLeads(leads);
      const endTime = Date.now();

      expect(results).toHaveLength(10);
      expect(endTime - startTime).toBeLessThan(10000); // Should complete in reasonable time

      // Check that performance metrics are reasonable
      const metrics = PerformanceMonitor.getMetrics();
      expect(metrics.templateEngineMetrics.errorRate).toBeLessThan(0.1); // Less than 10% error rate
    });
  });
});

// Test utilities
export const TestUtils = {
  createMockLead,
  createMockTemplateConfig,
  
  async simulateBuyerResponse(bidAmount: number, interested: boolean = true) {
    return {
      ok: true,
      json: async () => ({ bidAmount, interested })
    };
  },

  async simulateBuyerError(error: string) {
    throw new Error(error);
  },

  createMockBuyer(id: string, name: string): BuyerConfig {
    return {
      id,
      name,
      slug: id,
      apiUrl: `https://api.${id}.com`,
      authConfig: {
        type: 'apiKey',
        credentials: { apiKey: 'test-key' }
      },
      active: true,
      serviceConfigs: [],
      globalSettings: {
        defaultTimeout: 5000,
        maxConcurrentRequests: 10,
        rateLimiting: {
          requestsPerMinute: 100,
          requestsPerHour: 1000,
          requestsPerDay: 10000
        },
        failoverSettings: {
          enabled: true,
          maxFailures: 3,
          cooldownPeriod: 300000
        },
        complianceRequirements: {
          requireTrustedForm: true,
          requireJornaya: true,
          requireTcpaConsent: true
        }
      },
      metadata: {}
    };
  }
};

export default TestUtils;