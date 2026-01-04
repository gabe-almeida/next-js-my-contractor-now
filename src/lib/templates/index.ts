/**
 * Template Engine Main Export
 * Central orchestrator that ties together all template engine components
 */

import { TemplateEngine } from './engine';
import { Transformations, TransformRegistry } from './transformations';
import { DataValidator, ValidationRuleBuilder } from './validator';
import PerformanceMonitor from './performance-monitor';
import { BuyerConfigurationRegistry, BuyerTemplates, initializeBuyerConfigurations } from '../buyers/configurations';
import AuctionEngine from '../auction/engine';
import RetryHandler from '../auction/retry-handler';

import {
  LeadData,
  BuyerConfig,
  TemplateConfig,
  AuctionResult,
  PerformanceMetrics,
  TemplateEngineError,
  ValidationError,
  TransformationError,
  AuctionError
} from './types';

/**
 * Template Engine Orchestrator
 * Main class that coordinates all template engine operations
 */
export class TemplateEngineOrchestrator {
  private static initialized = false;

  /**
   * Initialize the template engine system
   */
  static async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      console.log('Initializing Template Engine Orchestrator...');

      // Initialize buyer configurations
      initializeBuyerConfigurations();

      // Register custom transformations if needed
      this.registerCustomTransformations();

      // Set up performance monitoring
      PerformanceMonitor.setMonitoringEnabled(true);

      // Set performance thresholds
      PerformanceMonitor.setThresholds({
        maxTransformationTime: 1000,
        maxAuctionTime: 10000,
        maxErrorRate: 0.05,
        minThroughput: 10,
        maxResponseTime: 5000
      });

      this.initialized = true;
      console.log('Template Engine Orchestrator initialized successfully');

    } catch (error) {
      console.error('Failed to initialize Template Engine Orchestrator:', error);
      throw new TemplateEngineError(
        'Initialization failed',
        'INIT_ERROR',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Process a lead through the complete template engine and auction pipeline
   */
  static async processLead(lead: LeadData): Promise<LeadProcessingResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    const processingId = this.generateProcessingId();

    try {
      console.log(`Processing lead ${lead.id} with processing ID ${processingId}`);

      // Validate lead data
      const leadValidation = DataValidator.validateLeadData(lead);
      if (!leadValidation.isValid) {
        throw new ValidationError(
          'leadData',
          `Lead validation failed: ${leadValidation.errors.join(', ')}`
        );
      }

      // Run auction to get buyer responses
      const auctionResult = await AuctionEngine.runAuction(lead);

      // Record auction performance
      PerformanceMonitor.recordAuctionPerformance({
        leadId: lead.id,
        auctionDurationMs: auctionResult.auctionDurationMs,
        participantCount: auctionResult.participantCount,
        eligibleBuyerCount: auctionResult.participantCount, // Approximate
        winningBuyerId: auctionResult.winningBuyerId,
        winningBidAmount: auctionResult.winningBidAmount,
        averageResponseTime: this.calculateAverageResponseTime(auctionResult.allBids),
        bidDistribution: this.calculateBidDistribution(auctionResult.allBids),
        status: auctionResult.status
      });

      const totalProcessingTime = Date.now() - startTime;

      const result: LeadProcessingResult = {
        processingId,
        leadId: lead.id,
        success: auctionResult.status === 'completed',
        auctionResult,
        totalProcessingTime,
        metrics: {
          auctionTime: auctionResult.auctionDurationMs,
          buyerCount: auctionResult.participantCount,
          successfulBids: auctionResult.allBids.filter(bid => bid.success).length,
          averageResponseTime: this.calculateAverageResponseTime(auctionResult.allBids)
        }
      };

      console.log(`Lead processing completed: ${lead.id} -> ${auctionResult.status}`);
      return result;

    } catch (error) {
      const totalProcessingTime = Date.now() - startTime;

      console.error(`Lead processing failed for ${lead.id}:`, error);

      return {
        processingId,
        leadId: lead.id,
        success: false,
        totalProcessingTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        metrics: {
          auctionTime: 0,
          buyerCount: 0,
          successfulBids: 0,
          averageResponseTime: 0
        }
      };
    }
  }

  /**
   * Transform lead data for a specific buyer
   */
  static async transformForBuyer(
    lead: LeadData,
    buyerId: string,
    includeCompliance: boolean = false
  ): Promise<TransformationResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    const startTime = Date.now();

    try {
      // Get buyer configuration
      const buyer = BuyerConfigurationRegistry.get(buyerId);
      if (!buyer) {
        throw new TemplateEngineError(
          `Buyer configuration not found: ${buyerId}`,
          'BUYER_NOT_FOUND'
        );
      }

      // Get service configuration
      const serviceConfig = BuyerConfigurationRegistry.getServiceConfig(buyerId, lead.serviceTypeId);
      if (!serviceConfig) {
        throw new TemplateEngineError(
          `Service configuration not found for buyer ${buyerId} and service ${lead.serviceTypeId}`,
          'SERVICE_CONFIG_NOT_FOUND'
        );
      }

      // Transform using POST template (more comprehensive)
      const transformedData = await TemplateEngine.transform(
        lead,
        buyer,
        serviceConfig.postTemplate,
        includeCompliance
      );

      const processingTime = Date.now() - startTime;

      // Record performance
      PerformanceMonitor.recordTemplatePerformance({
        leadId: lead.id,
        buyerId,
        transformationTime: processingTime,
        validationTime: 0, // Would need to track separately
        totalProcessingTime: processingTime,
        success: true,
        fieldCount: Object.keys(transformedData).length,
        complianceIncluded: includeCompliance
      });

      return {
        success: true,
        data: transformedData,
        processingTime,
        fieldCount: Object.keys(transformedData).length,
        complianceIncluded: includeCompliance
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;

      // Record performance
      PerformanceMonitor.recordTemplatePerformance({
        leadId: lead.id,
        buyerId,
        transformationTime: processingTime,
        validationTime: 0,
        totalProcessingTime: processingTime,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        fieldCount: 0,
        complianceIncluded: includeCompliance
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime,
        fieldCount: 0,
        complianceIncluded: includeCompliance
      };
    }
  }

  /**
   * Batch process multiple leads
   */
  static async batchProcessLeads(leads: LeadData[]): Promise<LeadProcessingResult[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    console.log(`Batch processing ${leads.length} leads`);

    // Process leads in parallel with concurrency limit
    const concurrencyLimit = 10;
    const results: LeadProcessingResult[] = [];

    for (let i = 0; i < leads.length; i += concurrencyLimit) {
      const batch = leads.slice(i, i + concurrencyLimit);
      const batchPromises = batch.map(lead => this.processLead(lead));
      const batchResults = await Promise.allSettled(batchPromises);

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            processingId: 'batch_error',
            leadId: 'unknown',
            success: false,
            totalProcessingTime: 0,
            error: result.reason.message || 'Batch processing failed',
            metrics: {
              auctionTime: 0,
              buyerCount: 0,
              successfulBids: 0,
              averageResponseTime: 0
            }
          });
        }
      }
    }

    console.log(`Batch processing completed: ${results.filter(r => r.success).length}/${results.length} successful`);
    return results;
  }

  /**
   * Get comprehensive system status
   */
  static getSystemStatus(): SystemStatus {
    const metrics = PerformanceMonitor.getMetrics();
    const alerts = PerformanceMonitor.getAlerts();
    const retryQueueStatus = RetryHandler.getRetryQueueStatus();

    return {
      initialized: this.initialized,
      metrics,
      alerts: {
        total: alerts.length,
        critical: alerts.filter(a => a.severity === 'critical').length,
        errors: alerts.filter(a => a.severity === 'error').length,
        warnings: alerts.filter(a => a.severity === 'warning').length
      },
      retryQueue: retryQueueStatus,
      buyers: {
        total: BuyerConfigurationRegistry.getAllActive().length,
        active: BuyerConfigurationRegistry.getAllActive().filter(b => b.active).length
      },
      thresholds: PerformanceMonitor.getThresholds(),
      monitoring: PerformanceMonitor.isMonitoringEnabled()
    };
  }

  /**
   * Register custom transformations
   */
  private static registerCustomTransformations(): void {
    // Register any custom transformations here
    // Example:
    // TransformRegistry.register('customTransform', (value) => {
    //   return value.toString().replace(/special/g, 'transformed');
    // });
  }

  /**
   * Calculate average response time from bids
   */
  private static calculateAverageResponseTime(bids: any[]): number {
    if (bids.length === 0) return 0;
    const total = bids.reduce((sum, bid) => sum + (bid.responseTime || 0), 0);
    return total / bids.length;
  }

  /**
   * Calculate bid distribution
   */
  private static calculateBidDistribution(bids: any[]): Record<string, number> {
    const distribution: Record<string, number> = {};

    for (const bid of bids) {
      if (!bid.success || !bid.bidAmount) continue;

      let range: string;
      if (bid.bidAmount <= 25) range = '0-25';
      else if (bid.bidAmount <= 50) range = '26-50';
      else if (bid.bidAmount <= 100) range = '51-100';
      else if (bid.bidAmount <= 200) range = '101-200';
      else range = '200+';

      distribution[range] = (distribution[range] || 0) + 1;
    }

    return distribution;
  }

  /**
   * Generate unique processing ID
   */
  private static generateProcessingId(): string {
    return `proc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Health check for the template engine system
   */
  static async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      if (!this.initialized) {
        await this.initialize();
      }

      // Check buyers
      const buyers = BuyerConfigurationRegistry.getAllActive();
      const activeBuyers = buyers.filter(b => b.active);

      // Check performance metrics
      const metrics = PerformanceMonitor.getMetrics();
      const criticalAlerts = PerformanceMonitor.getAlerts('critical');

      // Check retry queue
      const retryStatus = RetryHandler.getRetryQueueStatus();

      const responseTime = Date.now() - startTime;

      return {
        healthy: true,
        responseTime,
        components: {
          templateEngine: { status: 'healthy', details: 'Template engine operational' },
          auctionEngine: { status: 'healthy', details: 'Auction engine operational' },
          buyers: { 
            status: activeBuyers.length > 0 ? 'healthy' : 'warning', 
            details: `${activeBuyers.length}/${buyers.length} buyers active` 
          },
          retryHandler: { 
            status: retryStatus.totalItems < 100 ? 'healthy' : 'warning', 
            details: `${retryStatus.totalItems} items in retry queue` 
          },
          monitoring: { 
            status: PerformanceMonitor.isMonitoringEnabled() ? 'healthy' : 'warning', 
            details: 'Performance monitoring status' 
          }
        },
        metrics: {
          errorRate: metrics.templateEngineMetrics.errorRate,
          avgResponseTime: metrics.auctionMetrics.averageResponseTime,
          throughput: metrics.templateEngineMetrics.throughput,
          criticalAlerts: criticalAlerts.length
        }
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;

      return {
        healthy: false,
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        components: {
          templateEngine: { status: 'error', details: 'Failed to check template engine' },
          auctionEngine: { status: 'unknown', details: 'Could not verify auction engine' },
          buyers: { status: 'unknown', details: 'Could not verify buyers' },
          retryHandler: { status: 'unknown', details: 'Could not verify retry handler' },
          monitoring: { status: 'unknown', details: 'Could not verify monitoring' }
        },
        metrics: {
          errorRate: 1,
          avgResponseTime: 0,
          throughput: 0,
          criticalAlerts: 0
        }
      };
    }
  }
}

// Supporting interfaces
interface LeadProcessingResult {
  processingId: string;
  leadId: string;
  success: boolean;
  auctionResult?: AuctionResult;
  totalProcessingTime: number;
  error?: string;
  metrics: {
    auctionTime: number;
    buyerCount: number;
    successfulBids: number;
    averageResponseTime: number;
  };
}

interface TransformationResult {
  success: boolean;
  data?: Record<string, any>;
  error?: string;
  processingTime: number;
  fieldCount: number;
  complianceIncluded: boolean;
}

interface SystemStatus {
  initialized: boolean;
  metrics: PerformanceMetrics;
  alerts: {
    total: number;
    critical: number;
    errors: number;
    warnings: number;
  };
  retryQueue: any;
  buyers: {
    total: number;
    active: number;
  };
  thresholds: any;
  monitoring: boolean;
}

interface HealthCheckResult {
  healthy: boolean;
  responseTime: number;
  error?: string;
  components: {
    [key: string]: {
      status: 'healthy' | 'warning' | 'error' | 'unknown';
      details: string;
    };
  };
  metrics: {
    errorRate: number;
    avgResponseTime: number;
    throughput: number;
    criticalAlerts: number;
  };
}

// Export all components (TemplateEngineOrchestrator is already exported at class definition)
export {
  // Core engines
  TemplateEngine,
  AuctionEngine,
  
  // Utilities
  Transformations,
  TransformRegistry,
  DataValidator,
  ValidationRuleBuilder,
  PerformanceMonitor,
  RetryHandler,
  
  // Configuration
  BuyerConfigurationRegistry,
  BuyerTemplates,
  initializeBuyerConfigurations,
  
  // Types
  type LeadData,
  type BuyerConfig,
  type TemplateConfig,
  type AuctionResult,
  type PerformanceMetrics,
  type LeadProcessingResult,
  type TransformationResult,
  type SystemStatus,
  type HealthCheckResult,
  
  // Errors
  TemplateEngineError,
  ValidationError,
  TransformationError,
  AuctionError
};

// Default export
export default TemplateEngineOrchestrator;