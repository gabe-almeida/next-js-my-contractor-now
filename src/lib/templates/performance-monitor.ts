/**
 * Performance Monitoring System
 * Real-time metrics collection and analysis for template engine and auction system
 */

import {
  PerformanceMetrics,
  LeadData,
  BuyerConfig,
  AuctionResult,
  TransactionLog
} from './types';

export class PerformanceMonitor {
  private static metrics: PerformanceMetrics = {
    templateEngineMetrics: {
      transformationTime: 0,
      validationTime: 0,
      totalProcessingTime: 0,
      errorRate: 0,
      throughput: 0
    },
    auctionMetrics: {
      averageAuctionTime: 0,
      averageResponseTime: 0,
      participationRate: 0,
      winRate: {},
      bidDistribution: {}
    },
    buyerMetrics: {}
  };

  private static samples: PerformanceSample[] = [];
  private static maxSamples = 10000;
  private static monitoringEnabled = true;
  private static alerts: PerformanceAlert[] = [];
  private static thresholds: PerformanceThresholds = {
    maxTransformationTime: 1000,
    maxAuctionTime: 10000,
    maxErrorRate: 0.05,
    minThroughput: 10,
    maxResponseTime: 5000
  };

  /**
   * Record template engine performance sample
   */
  static recordTemplatePerformance(sample: TemplatePerformanceSample): void {
    if (!this.monitoringEnabled) return;

    const now = Date.now();
    this.samples.push({
      type: 'template',
      timestamp: now,
      data: sample
    });

    // Update aggregated metrics
    this.updateTemplateMetrics(sample);

    // Trim samples if needed
    this.trimSamples();

    // Check for performance alerts
    this.checkTemplateAlerts(sample);
  }

  /**
   * Record auction performance sample
   */
  static recordAuctionPerformance(sample: AuctionPerformanceSample): void {
    if (!this.monitoringEnabled) return;

    const now = Date.now();
    this.samples.push({
      type: 'auction',
      timestamp: now,
      data: sample
    });

    // Update aggregated metrics
    this.updateAuctionMetrics(sample);

    // Trim samples if needed
    this.trimSamples();

    // Check for performance alerts
    this.checkAuctionAlerts(sample);
  }

  /**
   * Record buyer performance sample
   */
  static recordBuyerPerformance(buyerId: string, sample: BuyerPerformanceSample): void {
    if (!this.monitoringEnabled) return;

    const now = Date.now();
    this.samples.push({
      type: 'buyer',
      timestamp: now,
      buyerId,
      data: sample
    });

    // Update buyer-specific metrics
    this.updateBuyerMetrics(buyerId, sample);

    // Trim samples if needed
    this.trimSamples();

    // Check for buyer-specific alerts
    this.checkBuyerAlerts(buyerId, sample);
  }

  /**
   * Update template engine metrics
   */
  private static updateTemplateMetrics(sample: TemplatePerformanceSample): void {
    const tm = this.metrics.templateEngineMetrics;

    // Update running averages
    tm.transformationTime = this.updateRunningAverage(tm.transformationTime, sample.transformationTime);
    tm.validationTime = this.updateRunningAverage(tm.validationTime, sample.validationTime);
    tm.totalProcessingTime = this.updateRunningAverage(tm.totalProcessingTime, sample.totalProcessingTime);

    // Update error rate
    if (sample.success === false) {
      tm.errorRate = this.updateRunningAverage(tm.errorRate, 1);
    } else {
      tm.errorRate = this.updateRunningAverage(tm.errorRate, 0);
    }

    // Update throughput (operations per second)
    tm.throughput++;

    // Reset throughput counter periodically
    const now = Date.now();
    if (!this.lastThroughputReset || now - this.lastThroughputReset > 60000) {
      this.lastThroughputReset = now;
      tm.throughput = 0;
    }
  }

  private static lastThroughputReset: number = 0;

  /**
   * Update auction metrics
   */
  private static updateAuctionMetrics(sample: AuctionPerformanceSample): void {
    const am = this.metrics.auctionMetrics;

    // Update auction time
    am.averageAuctionTime = this.updateRunningAverage(am.averageAuctionTime, sample.auctionDurationMs);

    // Update response time
    if (sample.averageResponseTime) {
      am.averageResponseTime = this.updateRunningAverage(am.averageResponseTime, sample.averageResponseTime);
    }

    // Update participation rate
    if (sample.participantCount && sample.eligibleBuyerCount) {
      const participationRate = sample.participantCount / sample.eligibleBuyerCount;
      am.participationRate = this.updateRunningAverage(am.participationRate, participationRate);
    }

    // Update win rate
    if (sample.winningBuyerId) {
      if (!am.winRate[sample.winningBuyerId]) {
        am.winRate[sample.winningBuyerId] = 0;
      }
      am.winRate[sample.winningBuyerId]++;
    }

    // Update bid distribution
    if (sample.bidDistribution) {
      for (const [range, count] of Object.entries(sample.bidDistribution)) {
        if (!am.bidDistribution[range]) {
          am.bidDistribution[range] = 0;
        }
        am.bidDistribution[range] += count;
      }
    }
  }

  /**
   * Update buyer-specific metrics
   */
  private static updateBuyerMetrics(buyerId: string, sample: BuyerPerformanceSample): void {
    if (!this.metrics.buyerMetrics[buyerId]) {
      this.metrics.buyerMetrics[buyerId] = {
        responseTime: 0,
        successRate: 0,
        errorRate: 0,
        volume: 0
      };
    }

    const bm = this.metrics.buyerMetrics[buyerId];

    // Update response time
    bm.responseTime = this.updateRunningAverage(bm.responseTime, sample.responseTime);

    // Update success/error rates
    if (sample.success) {
      bm.successRate = this.updateRunningAverage(bm.successRate, 1);
      bm.errorRate = this.updateRunningAverage(bm.errorRate, 0);
    } else {
      bm.successRate = this.updateRunningAverage(bm.successRate, 0);
      bm.errorRate = this.updateRunningAverage(bm.errorRate, 1);
    }

    // Update volume
    bm.volume++;
  }

  /**
   * Update running average using exponential moving average
   */
  private static updateRunningAverage(currentAvg: number, newValue: number, alpha: number = 0.1): number {
    return currentAvg === 0 ? newValue : (alpha * newValue) + ((1 - alpha) * currentAvg);
  }

  /**
   * Check for template performance alerts
   */
  private static checkTemplateAlerts(sample: TemplatePerformanceSample): void {
    const alerts: PerformanceAlert[] = [];

    if (sample.transformationTime > this.thresholds.maxTransformationTime) {
      alerts.push({
        type: 'high_transformation_time',
        severity: 'warning',
        message: `Transformation time ${sample.transformationTime}ms exceeds threshold ${this.thresholds.maxTransformationTime}ms`,
        timestamp: new Date(),
        metadata: { transformationTime: sample.transformationTime }
      });
    }

    if (sample.totalProcessingTime > this.thresholds.maxTransformationTime * 2) {
      alerts.push({
        type: 'high_processing_time',
        severity: 'critical',
        message: `Total processing time ${sample.totalProcessingTime}ms is critically high`,
        timestamp: new Date(),
        metadata: { totalProcessingTime: sample.totalProcessingTime }
      });
    }

    if (!sample.success) {
      alerts.push({
        type: 'transformation_error',
        severity: 'error',
        message: `Template transformation failed: ${sample.errorMessage || 'Unknown error'}`,
        timestamp: new Date(),
        metadata: { leadId: sample.leadId, buyerId: sample.buyerId }
      });
    }

    this.addAlerts(alerts);
  }

  /**
   * Check for auction performance alerts
   */
  private static checkAuctionAlerts(sample: AuctionPerformanceSample): void {
    const alerts: PerformanceAlert[] = [];

    if (sample.auctionDurationMs > this.thresholds.maxAuctionTime) {
      alerts.push({
        type: 'slow_auction',
        severity: 'warning',
        message: `Auction duration ${sample.auctionDurationMs}ms exceeds threshold ${this.thresholds.maxAuctionTime}ms`,
        timestamp: new Date(),
        metadata: { auctionDurationMs: sample.auctionDurationMs, leadId: sample.leadId }
      });
    }

    if (sample.participantCount === 0) {
      alerts.push({
        type: 'no_auction_participants',
        severity: 'error',
        message: `No buyers participated in auction for lead ${sample.leadId}`,
        timestamp: new Date(),
        metadata: { leadId: sample.leadId, eligibleBuyerCount: sample.eligibleBuyerCount }
      });
    }

    if (sample.averageResponseTime && sample.averageResponseTime > this.thresholds.maxResponseTime) {
      alerts.push({
        type: 'slow_buyer_response',
        severity: 'warning',
        message: `Average buyer response time ${sample.averageResponseTime}ms is slow`,
        timestamp: new Date(),
        metadata: { averageResponseTime: sample.averageResponseTime, leadId: sample.leadId }
      });
    }

    this.addAlerts(alerts);
  }

  /**
   * Check for buyer-specific alerts
   */
  private static checkBuyerAlerts(buyerId: string, sample: BuyerPerformanceSample): void {
    const alerts: PerformanceAlert[] = [];

    if (sample.responseTime > this.thresholds.maxResponseTime) {
      alerts.push({
        type: 'slow_buyer_response',
        severity: 'warning',
        message: `Buyer ${buyerId} response time ${sample.responseTime}ms exceeds threshold`,
        timestamp: new Date(),
        metadata: { buyerId, responseTime: sample.responseTime }
      });
    }

    if (!sample.success) {
      alerts.push({
        type: 'buyer_error',
        severity: 'error',
        message: `Buyer ${buyerId} request failed: ${sample.errorMessage || 'Unknown error'}`,
        timestamp: new Date(),
        metadata: { buyerId, errorMessage: sample.errorMessage }
      });
    }

    const buyerMetrics = this.metrics.buyerMetrics[buyerId];
    if (buyerMetrics && buyerMetrics.errorRate > this.thresholds.maxErrorRate) {
      alerts.push({
        type: 'high_buyer_error_rate',
        severity: 'critical',
        message: `Buyer ${buyerId} error rate ${(buyerMetrics.errorRate * 100).toFixed(1)}% exceeds threshold`,
        timestamp: new Date(),
        metadata: { buyerId, errorRate: buyerMetrics.errorRate }
      });
    }

    this.addAlerts(alerts);
  }

  /**
   * Add alerts to the alert queue
   */
  private static addAlerts(alerts: PerformanceAlert[]): void {
    this.alerts.push(...alerts);

    // Trim alerts to prevent memory issues
    if (this.alerts.length > 1000) {
      this.alerts = this.alerts.slice(-500); // Keep most recent 500 alerts
    }

    // Log critical alerts immediately
    for (const alert of alerts) {
      if (alert.severity === 'critical') {
        console.error('CRITICAL PERFORMANCE ALERT:', alert);
      }
    }
  }

  /**
   * Get current performance metrics
   */
  static getMetrics(): PerformanceMetrics {
    return JSON.parse(JSON.stringify(this.metrics));
  }

  /**
   * Get performance metrics for specific time range
   */
  static getMetricsForTimeRange(startTime: Date, endTime: Date): PerformanceMetrics {
    const filteredSamples = this.samples.filter(
      sample => sample.timestamp >= startTime.getTime() && sample.timestamp <= endTime.getTime()
    );

    // Recalculate metrics for the filtered samples
    return this.calculateMetricsFromSamples(filteredSamples);
  }

  /**
   * Calculate metrics from sample data
   */
  private static calculateMetricsFromSamples(samples: PerformanceSample[]): PerformanceMetrics {
    const metrics: PerformanceMetrics = {
      templateEngineMetrics: {
        transformationTime: 0,
        validationTime: 0,
        totalProcessingTime: 0,
        errorRate: 0,
        throughput: 0
      },
      auctionMetrics: {
        averageAuctionTime: 0,
        averageResponseTime: 0,
        participationRate: 0,
        winRate: {},
        bidDistribution: {}
      },
      buyerMetrics: {}
    };

    const templateSamples = samples.filter(s => s.type === 'template') as Array<PerformanceSample & { data: TemplatePerformanceSample }>;
    const auctionSamples = samples.filter(s => s.type === 'auction') as Array<PerformanceSample & { data: AuctionPerformanceSample }>;
    const buyerSamples = samples.filter(s => s.type === 'buyer') as Array<PerformanceSample & { data: BuyerPerformanceSample }>;

    // Calculate template metrics
    if (templateSamples.length > 0) {
      metrics.templateEngineMetrics.transformationTime = this.calculateAverage(
        templateSamples.map(s => s.data.transformationTime)
      );
      metrics.templateEngineMetrics.validationTime = this.calculateAverage(
        templateSamples.map(s => s.data.validationTime)
      );
      metrics.templateEngineMetrics.totalProcessingTime = this.calculateAverage(
        templateSamples.map(s => s.data.totalProcessingTime)
      );
      metrics.templateEngineMetrics.errorRate = templateSamples.filter(s => !s.data.success).length / templateSamples.length;
      metrics.templateEngineMetrics.throughput = templateSamples.length;
    }

    // Calculate auction metrics
    if (auctionSamples.length > 0) {
      metrics.auctionMetrics.averageAuctionTime = this.calculateAverage(
        auctionSamples.map(s => s.data.auctionDurationMs)
      );
      
      const responseTimeSamples = auctionSamples
        .map(s => s.data.averageResponseTime)
        .filter(t => t !== undefined) as number[];
      
      if (responseTimeSamples.length > 0) {
        metrics.auctionMetrics.averageResponseTime = this.calculateAverage(responseTimeSamples);
      }

      // Calculate participation rate
      const participationRates = auctionSamples
        .filter(s => s.data.eligibleBuyerCount && s.data.participantCount)
        .map(s => s.data.participantCount! / s.data.eligibleBuyerCount!);
      
      if (participationRates.length > 0) {
        metrics.auctionMetrics.participationRate = this.calculateAverage(participationRates);
      }

      // Aggregate win rates and bid distributions
      for (const sample of auctionSamples) {
        if (sample.data.winningBuyerId) {
          if (!metrics.auctionMetrics.winRate[sample.data.winningBuyerId]) {
            metrics.auctionMetrics.winRate[sample.data.winningBuyerId] = 0;
          }
          metrics.auctionMetrics.winRate[sample.data.winningBuyerId]++;
        }

        if (sample.data.bidDistribution) {
          for (const [range, count] of Object.entries(sample.data.bidDistribution)) {
            if (!metrics.auctionMetrics.bidDistribution[range]) {
              metrics.auctionMetrics.bidDistribution[range] = 0;
            }
            metrics.auctionMetrics.bidDistribution[range] += count;
          }
        }
      }
    }

    // Calculate buyer metrics
    const buyerGroups = this.groupBy(buyerSamples, s => s.buyerId!);
    for (const [buyerId, samples] of buyerGroups) {
      const buyerData = samples.map(s => s.data);
      metrics.buyerMetrics[buyerId] = {
        responseTime: this.calculateAverage(buyerData.map(d => d.responseTime)),
        successRate: buyerData.filter(d => d.success).length / buyerData.length,
        errorRate: buyerData.filter(d => !d.success).length / buyerData.length,
        volume: buyerData.length
      };
    }

    return metrics;
  }

  /**
   * Calculate average of an array of numbers
   */
  private static calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * Group array by key function
   */
  private static groupBy<T, K>(array: T[], keyFn: (item: T) => K): Map<K, T[]> {
    const groups = new Map<K, T[]>();
    for (const item of array) {
      const key = keyFn(item);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(item);
    }
    return groups;
  }

  /**
   * Trim samples to prevent memory issues
   */
  private static trimSamples(): void {
    if (this.samples.length > this.maxSamples) {
      this.samples = this.samples.slice(-Math.floor(this.maxSamples * 0.8)); // Keep 80% of max
    }
  }

  /**
   * Get performance alerts
   */
  static getAlerts(severity?: 'info' | 'warning' | 'error' | 'critical'): PerformanceAlert[] {
    let alerts = [...this.alerts];
    
    if (severity) {
      alerts = alerts.filter(alert => alert.severity === severity);
    }
    
    return alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Clear alerts
   */
  static clearAlerts(type?: string): number {
    const initialCount = this.alerts.length;
    
    if (type) {
      this.alerts = this.alerts.filter(alert => alert.type !== type);
    } else {
      this.alerts = [];
    }
    
    return initialCount - this.alerts.length;
  }

  /**
   * Set performance thresholds
   */
  static setThresholds(thresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  /**
   * Get performance thresholds
   */
  static getThresholds(): PerformanceThresholds {
    return { ...this.thresholds };
  }

  /**
   * Enable/disable monitoring
   */
  static setMonitoringEnabled(enabled: boolean): void {
    this.monitoringEnabled = enabled;
    console.log(`Performance monitoring ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get monitoring status
   */
  static isMonitoringEnabled(): boolean {
    return this.monitoringEnabled;
  }

  /**
   * Export performance data
   */
  static exportData(format: 'json' | 'csv' = 'json'): string {
    const data = {
      metrics: this.metrics,
      samples: this.samples,
      alerts: this.alerts,
      thresholds: this.thresholds,
      exportedAt: new Date().toISOString()
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    } else {
      // CSV export for samples
      const csvRows = ['timestamp,type,buyerId,data'];
      for (const sample of this.samples) {
        csvRows.push(`${sample.timestamp},${sample.type},${sample.buyerId || ''},${JSON.stringify(sample.data)}`);
      }
      return csvRows.join('\n');
    }
  }

  /**
   * Reset all performance data
   */
  static reset(): void {
    this.metrics = {
      templateEngineMetrics: {
        transformationTime: 0,
        validationTime: 0,
        totalProcessingTime: 0,
        errorRate: 0,
        throughput: 0
      },
      auctionMetrics: {
        averageAuctionTime: 0,
        averageResponseTime: 0,
        participationRate: 0,
        winRate: {},
        bidDistribution: {}
      },
      buyerMetrics: {}
    };
    
    this.samples = [];
    this.alerts = [];
    
    console.log('Performance monitoring data reset');
  }
}

// Supporting interfaces
interface PerformanceSample {
  type: 'template' | 'auction' | 'buyer';
  timestamp: number;
  buyerId?: string;
  data: TemplatePerformanceSample | AuctionPerformanceSample | BuyerPerformanceSample;
}

interface TemplatePerformanceSample {
  leadId: string;
  buyerId: string;
  transformationTime: number;
  validationTime: number;
  totalProcessingTime: number;
  success: boolean;
  errorMessage?: string;
  fieldCount: number;
  complianceIncluded: boolean;
}

interface AuctionPerformanceSample {
  leadId: string;
  auctionDurationMs: number;
  participantCount: number;
  eligibleBuyerCount: number;
  winningBuyerId?: string;
  winningBidAmount?: number;
  averageResponseTime?: number;
  bidDistribution?: Record<string, number>;
  status: 'completed' | 'failed' | 'timeout' | 'no_bids';
}

interface BuyerPerformanceSample {
  leadId: string;
  responseTime: number;
  success: boolean;
  errorMessage?: string;
  operationType: 'PING' | 'POST';
  statusCode?: number;
  bidAmount?: number;
}

interface PerformanceAlert {
  type: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

interface PerformanceThresholds {
  maxTransformationTime: number;
  maxAuctionTime: number;
  maxErrorRate: number;
  minThroughput: number;
  maxResponseTime: number;
}

export default PerformanceMonitor;