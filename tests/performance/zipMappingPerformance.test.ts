/**
 * Performance Tests for Buyer Service Zip Mapping
 * Tests system behavior under load with large datasets
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import {
  mockBuyers,
  mockServiceTypes,
  mockServiceZipMappings,
  generateLargeZipCodeDataset,
  performanceTestMappings
} from '@/tests/fixtures/buyerServiceZipMappingData';

// Performance testing utilities
class PerformanceProfiler {
  private measurements: Map<string, number[]> = new Map();

  async measure<T>(label: string, operation: () => Promise<T>): Promise<T> {
    const startTime = performance.now();
    const result = await operation();
    const endTime = performance.now();
    const duration = endTime - startTime;

    if (!this.measurements.has(label)) {
      this.measurements.set(label, []);
    }
    this.measurements.get(label)!.push(duration);

    return result;
  }

  getStats(label: string): {
    avg: number;
    min: number;
    max: number;
    p95: number;
    p99: number;
    count: number;
  } {
    const measurements = this.measurements.get(label) || [];
    if (measurements.length === 0) {
      return { avg: 0, min: 0, max: 0, p95: 0, p99: 0, count: 0 };
    }

    const sorted = [...measurements].sort((a, b) => a - b);
    const sum = measurements.reduce((a, b) => a + b, 0);

    return {
      avg: sum / measurements.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      count: measurements.length
    };
  }

  reset(): void {
    this.measurements.clear();
  }
}

// Mock optimized database client for performance testing
class OptimizedZipMappingService {
  private zipCodeIndex: Map<string, string[]> = new Map(); // ZIP -> buyer IDs
  private serviceZipIndex: Map<string, Set<string>> = new Map(); // service:ZIP -> buyer IDs
  private buyerServiceIndex: Map<string, string[]> = new Map(); // buyer ID -> service IDs

  constructor(mappings: any[]) {
    this.buildIndexes(mappings);
  }

  private buildIndexes(mappings: any[]): void {
    mappings.forEach(mapping => {
      // ZIP code index
      mapping.zipCodes.forEach((zip: string) => {
        if (!this.zipCodeIndex.has(zip)) {
          this.zipCodeIndex.set(zip, []);
        }
        this.zipCodeIndex.get(zip)!.push(mapping.buyerId);
      });

      // Service-ZIP index
      mapping.zipCodes.forEach((zip: string) => {
        const key = `${mapping.serviceTypeId}:${zip}`;
        if (!this.serviceZipIndex.has(key)) {
          this.serviceZipIndex.set(key, new Set());
        }
        this.serviceZipIndex.get(key)!.add(mapping.buyerId);
      });

      // Buyer-Service index
      if (!this.buyerServiceIndex.has(mapping.buyerId)) {
        this.buyerServiceIndex.set(mapping.buyerId, []);
      }
      this.buyerServiceIndex.get(mapping.buyerId)!.push(mapping.serviceTypeId);
    });
  }

  // O(1) lookup for buyers by service and ZIP
  findBuyersByServiceAndZip(serviceTypeId: string, zipCode: string): string[] {
    const key = `${serviceTypeId}:${zipCode}`;
    const buyerSet = this.serviceZipIndex.get(key);
    return buyerSet ? Array.from(buyerSet) : [];
  }

  // O(1) lookup for ZIP codes by buyer
  findZipCodesByBuyer(buyerId: string): string[] {
    const zipCodes = new Set<string>();
    
    // This is less optimal but shows the trade-off
    // In practice, we'd have another index for this
    for (const [zip, buyers] of this.zipCodeIndex.entries()) {
      if (buyers.includes(buyerId)) {
        zipCodes.add(zip);
      }
    }
    
    return Array.from(zipCodes);
  }

  // O(1) lookup for services by buyer
  findServicesByBuyer(buyerId: string): string[] {
    return this.buyerServiceIndex.get(buyerId) || [];
  }

  // Batch processing for multiple ZIP codes
  findBuyersForMultipleZips(serviceTypeId: string, zipCodes: string[]): Map<string, string[]> {
    const results = new Map<string, string[]>();
    
    zipCodes.forEach(zipCode => {
      results.set(zipCode, this.findBuyersByServiceAndZip(serviceTypeId, zipCode));
    });
    
    return results;
  }

  // Geographic range queries (simplified)
  findBuyersInZipRange(serviceTypeId: string, startZip: string, endZip: string): string[] {
    const buyers = new Set<string>();
    const start = parseInt(startZip);
    const end = parseInt(endZip);

    for (const [zip, buyerList] of this.zipCodeIndex.entries()) {
      const zipNum = parseInt(zip.substring(0, 5));
      if (zipNum >= start && zipNum <= end) {
        const serviceBuyers = this.findBuyersByServiceAndZip(serviceTypeId, zip);
        serviceBuyers.forEach(buyer => buyers.add(buyer));
      }
    }

    return Array.from(buyers);
  }

  // Analytics queries
  getCoverageStats(): {
    totalZipCodes: number;
    totalBuyers: number;
    averageBuyersPerZip: number;
    maxBuyersPerZip: number;
  } {
    const zipCounts = Array.from(this.zipCodeIndex.values()).map(buyers => buyers.length);
    const totalBuyers = new Set(Array.from(this.zipCodeIndex.values()).flat()).size;

    return {
      totalZipCodes: this.zipCodeIndex.size,
      totalBuyers,
      averageBuyersPerZip: zipCounts.reduce((a, b) => a + b, 0) / zipCounts.length,
      maxBuyersPerZip: Math.max(...zipCounts)
    };
  }

  // Memory usage estimation
  estimateMemoryUsage(): {
    zipCodeIndexSize: number;
    serviceZipIndexSize: number;
    buyerServiceIndexSize: number;
    totalEstimatedBytes: number;
  } {
    // Rough estimation assuming average string lengths
    const avgZipLength = 5;
    const avgBuyerIdLength = 20;
    const avgServiceIdLength = 15;

    const zipCodeIndexSize = this.zipCodeIndex.size * (avgZipLength + 50) + 
      Array.from(this.zipCodeIndex.values()).reduce((sum, buyers) => sum + buyers.length * avgBuyerIdLength, 0);
    
    const serviceZipIndexSize = this.serviceZipIndex.size * (avgServiceIdLength + avgZipLength + 50) +
      Array.from(this.serviceZipIndex.values()).reduce((sum, buyers) => sum + buyers.size * avgBuyerIdLength, 0);
    
    const buyerServiceIndexSize = this.buyerServiceIndex.size * (avgBuyerIdLength + 50) +
      Array.from(this.buyerServiceIndex.values()).reduce((sum, services) => sum + services.length * avgServiceIdLength, 0);

    return {
      zipCodeIndexSize,
      serviceZipIndexSize,
      buyerServiceIndexSize,
      totalEstimatedBytes: zipCodeIndexSize + serviceZipIndexSize + buyerServiceIndexSize
    };
  }
}

// Load testing simulator
class LoadTestSimulator {
  private service: OptimizedZipMappingService;
  private profiler: PerformanceProfiler;

  constructor(service: OptimizedZipMappingService, profiler: PerformanceProfiler) {
    this.service = service;
    this.profiler = profiler;
  }

  async simulateAuctionLoad(
    concurrentRequests: number,
    requestsPerSecond: number,
    durationSeconds: number
  ): Promise<{
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    throughput: number;
  }> {
    const totalRequests = requestsPerSecond * durationSeconds;
    const intervalMs = 1000 / requestsPerSecond;
    
    let successfulRequests = 0;
    let failedRequests = 0;
    const responseTimes: number[] = [];

    const startTime = Date.now();
    const requests: Promise<void>[] = [];

    for (let i = 0; i < totalRequests; i++) {
      const requestPromise = this.simulateAuctionRequest()
        .then(responseTime => {
          successfulRequests++;
          responseTimes.push(responseTime);
        })
        .catch(() => {
          failedRequests++;
        });

      requests.push(requestPromise);

      // Throttle requests to maintain desired rate
      if (i % concurrentRequests === 0) {
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    }

    await Promise.all(requests);
    const endTime = Date.now();
    const actualDurationMs = endTime - startTime;

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      averageResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
      throughput: successfulRequests / (actualDurationMs / 1000)
    };
  }

  private async simulateAuctionRequest(): Promise<number> {
    const startTime = performance.now();
    
    // Simulate auction request pattern
    const serviceTypeId = mockServiceTypes[Math.floor(Math.random() * mockServiceTypes.length)].id;
    const zipCodes = generateLargeZipCodeDataset(1); // Random ZIP
    const zipCode = zipCodes[0];
    
    // Find eligible buyers
    this.service.findBuyersByServiceAndZip(serviceTypeId, zipCode);
    
    // Simulate some processing delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 10 + 5));
    
    return performance.now() - startTime;
  }

  async simulateBatchQueries(batchSizes: number[], iterations: number): Promise<Map<number, number[]>> {
    const results = new Map<number, number[]>();

    for (const batchSize of batchSizes) {
      const batchTimes: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const zipCodes = generateLargeZipCodeDataset(batchSize);
        const serviceTypeId = mockServiceTypes[0].id;

        const startTime = performance.now();
        this.service.findBuyersForMultipleZips(serviceTypeId, zipCodes);
        const endTime = performance.now();

        batchTimes.push(endTime - startTime);
      }

      results.set(batchSize, batchTimes);
    }

    return results;
  }
}

describe('ZIP Mapping Performance Tests', () => {
  let profiler: PerformanceProfiler;
  let service: OptimizedZipMappingService;
  let loadSimulator: LoadTestSimulator;

  beforeAll(() => {
    profiler = new PerformanceProfiler();
    
    // Create large dataset for performance testing
    const largeMappings = [
      ...mockServiceZipMappings,
      ...Array.from({ length: 100 }, (_, i) => ({
        id: `perf-mapping-${i}`,
        buyerId: `buyer-${Math.floor(i / 10) + 1}`,
        serviceTypeId: `service-${(i % 3) + 1}`,
        zipCodes: generateLargeZipCodeDataset(100), // 100 ZIP codes per mapping
        active: true,
        priority: (i % 5) + 1,
        createdAt: new Date(),
        updatedAt: new Date()
      }))
    ];

    service = new OptimizedZipMappingService(largeMappings);
    loadSimulator = new LoadTestSimulator(service, profiler);
  });

  beforeEach(() => {
    profiler.reset();
  });

  describe('Index Performance', () => {
    it('should build indexes efficiently', async () => {
      const largeMappings = Array.from({ length: 1000 }, (_, i) => ({
        id: `mapping-${i}`,
        buyerId: `buyer-${i % 50}`, // 50 buyers
        serviceTypeId: `service-${i % 3}`, // 3 services
        zipCodes: generateLargeZipCodeDataset(50), // 50 ZIP codes each
        active: true,
        priority: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      const buildTime = await profiler.measure('index-build', async () => {
        new OptimizedZipMappingService(largeMappings);
      });

      const stats = profiler.getStats('index-build');
      
      // Index building should be fast even with large datasets
      expect(stats.avg).toBeLessThan(1000); // Under 1 second
      console.log(`Index build time for 1000 mappings: ${stats.avg.toFixed(2)}ms`);
    });

    it('should estimate reasonable memory usage', () => {
      const memoryStats = service.estimateMemoryUsage();
      
      expect(memoryStats.totalEstimatedBytes).toBeGreaterThan(0);
      expect(memoryStats.zipCodeIndexSize).toBeGreaterThan(0);
      expect(memoryStats.serviceZipIndexSize).toBeGreaterThan(0);
      expect(memoryStats.buyerServiceIndexSize).toBeGreaterThan(0);

      // Log memory usage for analysis
      console.log('Memory usage estimation:', {
        totalKB: Math.round(memoryStats.totalEstimatedBytes / 1024),
        zipCodeIndexKB: Math.round(memoryStats.zipCodeIndexSize / 1024),
        serviceZipIndexKB: Math.round(memoryStats.serviceZipIndexSize / 1024),
        buyerServiceIndexKB: Math.round(memoryStats.buyerServiceIndexSize / 1024)
      });
    });
  });

  describe('Lookup Performance', () => {
    it('should perform single ZIP lookups efficiently', async () => {
      const iterations = 10000;
      const testZipCodes = generateLargeZipCodeDataset(100);

      for (let i = 0; i < iterations; i++) {
        const zipCode = testZipCodes[i % testZipCodes.length];
        const serviceTypeId = mockServiceTypes[i % mockServiceTypes.length].id;

        await profiler.measure('single-zip-lookup', async () => {
          service.findBuyersByServiceAndZip(serviceTypeId, zipCode);
        });
      }

      const stats = profiler.getStats('single-zip-lookup');
      
      // Single lookups should be very fast (O(1))
      expect(stats.avg).toBeLessThan(1); // Under 1ms average
      expect(stats.p99).toBeLessThan(5); // 99th percentile under 5ms
      
      console.log(`Single ZIP lookup stats (${iterations} iterations):`, {
        avg: stats.avg.toFixed(4),
        p95: stats.p95.toFixed(4),
        p99: stats.p99.toFixed(4)
      });
    });

    it('should handle batch ZIP lookups efficiently', async () => {
      const batchSizes = [10, 100, 1000, 10000];
      const iterations = 100;

      const results = await loadSimulator.simulateBatchQueries(batchSizes, iterations);

      results.forEach((times, batchSize) => {
        const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
        const timePerZip = avgTime / batchSize;
        
        // Time per ZIP should remain relatively constant (good scalability)
        expect(timePerZip).toBeLessThan(0.1); // Under 0.1ms per ZIP
        
        console.log(`Batch size ${batchSize}: ${avgTime.toFixed(2)}ms total, ${timePerZip.toFixed(6)}ms per ZIP`);
      });
    });

    it('should perform range queries within reasonable time', async () => {
      const rangeTests = [
        { start: '10000', end: '10099' }, // 100 ZIP range
        { start: '20000', end: '20999' }, // 1000 ZIP range
        { start: '30000', end: '39999' }  // 10000 ZIP range
      ];

      for (const { start, end } of rangeTests) {
        const time = await profiler.measure(`range-${start}-${end}`, async () => {
          service.findBuyersInZipRange('service-1', start, end);
        });

        // Range queries should scale reasonably with range size
        const rangeSize = parseInt(end) - parseInt(start) + 1;
        const timePerZip = time / rangeSize;
        
        expect(timePerZip).toBeLessThan(0.01); // Under 0.01ms per ZIP in range
      }

      // Log range query performance
      rangeTests.forEach(({ start, end }) => {
        const stats = profiler.getStats(`range-${start}-${end}`);
        const rangeSize = parseInt(end) - parseInt(start) + 1;
        console.log(`Range ${start}-${end} (${rangeSize} ZIPs): ${stats.avg.toFixed(2)}ms`);
      });
    });
  });

  describe('Concurrent Load Testing', () => {
    it('should handle moderate concurrent load', async () => {
      const testConfig = {
        concurrentRequests: 50,
        requestsPerSecond: 100,
        durationSeconds: 10
      };

      const results = await loadSimulator.simulateAuctionLoad(
        testConfig.concurrentRequests,
        testConfig.requestsPerSecond,
        testConfig.durationSeconds
      );

      // Should handle load with minimal failures
      expect(results.successfulRequests).toBeGreaterThan(results.totalRequests * 0.95);
      expect(results.averageResponseTime).toBeLessThan(100); // Under 100ms average
      expect(results.throughput).toBeGreaterThan(testConfig.requestsPerSecond * 0.8);

      console.log('Moderate load test results:', {
        totalRequests: results.totalRequests,
        successRate: `${(results.successfulRequests / results.totalRequests * 100).toFixed(2)}%`,
        avgResponseTime: `${results.averageResponseTime.toFixed(2)}ms`,
        throughput: `${results.throughput.toFixed(2)} req/s`
      });
    }, 15000); // 15 second timeout

    it('should handle high concurrent load', async () => {
      const testConfig = {
        concurrentRequests: 200,
        requestsPerSecond: 500,
        durationSeconds: 5
      };

      const results = await loadSimulator.simulateAuctionLoad(
        testConfig.concurrentRequests,
        testConfig.requestsPerSecond,
        testConfig.durationSeconds
      );

      // Should still handle high load reasonably well
      expect(results.successfulRequests).toBeGreaterThan(results.totalRequests * 0.80);
      expect(results.averageResponseTime).toBeLessThan(500); // Under 500ms average
      expect(results.throughput).toBeGreaterThan(testConfig.requestsPerSecond * 0.5);

      console.log('High load test results:', {
        totalRequests: results.totalRequests,
        successRate: `${(results.successfulRequests / results.totalRequests * 100).toFixed(2)}%`,
        avgResponseTime: `${results.averageResponseTime.toFixed(2)}ms`,
        throughput: `${results.throughput.toFixed(2)} req/s`
      });
    }, 20000); // 20 second timeout

    it('should maintain performance with large ZIP code datasets', async () => {
      // Create service with very large ZIP dataset
      const massiveMappings = Array.from({ length: 10 }, (_, i) => ({
        id: `massive-mapping-${i}`,
        buyerId: `buyer-${i}`,
        serviceTypeId: 'service-1',
        zipCodes: generateLargeZipCodeDataset(10000), // 10k ZIP codes per buyer
        active: true,
        priority: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      const massiveService = new OptimizedZipMappingService(massiveMappings);

      // Test lookup performance with massive dataset
      const iterations = 1000;
      const testZips = generateLargeZipCodeDataset(100);

      const startTime = performance.now();
      for (let i = 0; i < iterations; i++) {
        const zipCode = testZips[i % testZips.length];
        massiveService.findBuyersByServiceAndZip('service-1', zipCode);
      }
      const endTime = performance.now();

      const avgTimePerLookup = (endTime - startTime) / iterations;
      
      // Should still be fast even with 100k+ ZIP codes
      expect(avgTimePerLookup).toBeLessThan(5); // Under 5ms per lookup
      
      console.log(`Large dataset performance (100k+ ZIPs): ${avgTimePerLookup.toFixed(4)}ms per lookup`);
    }, 30000); // 30 second timeout
  });

  describe('Memory and Resource Usage', () => {
    it('should not cause memory leaks during extended operation', async () => {
      const initialMemory = process.memoryUsage();
      
      // Perform many operations
      for (let i = 0; i < 10000; i++) {
        const zipCode = `${10000 + (i % 90000)}`;
        const serviceTypeId = mockServiceTypes[i % mockServiceTypes.length].id;
        service.findBuyersByServiceAndZip(serviceTypeId, zipCode);
        
        // Occasionally force garbage collection
        if (i % 1000 === 0 && global.gc) {
          global.gc();
        }
      }
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be minimal (under 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
      
      console.log('Memory usage after 10k operations:', {
        initialMB: Math.round(initialMemory.heapUsed / 1024 / 1024),
        finalMB: Math.round(finalMemory.heapUsed / 1024 / 1024),
        increaseMB: Math.round(memoryIncrease / 1024 / 1024)
      });
    });

    it('should scale index size predictably', () => {
      const smallDataset = mockServiceZipMappings.slice(0, 3);
      const mediumDataset = Array.from({ length: 50 }, (_, i) => ({
        id: `medium-${i}`,
        buyerId: `buyer-${i % 10}`,
        serviceTypeId: `service-${i % 3}`,
        zipCodes: generateLargeZipCodeDataset(20),
        active: true,
        priority: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      const smallService = new OptimizedZipMappingService(smallDataset);
      const mediumService = new OptimizedZipMappingService(mediumDataset);

      const smallStats = smallService.getCoverageStats();
      const mediumStats = mediumService.getCoverageStats();

      const smallMemory = smallService.estimateMemoryUsage();
      const mediumMemory = mediumService.estimateMemoryUsage();

      // Memory should scale roughly linearly with dataset size
      const datasetRatio = mediumDataset.length / smallDataset.length;
      const memoryRatio = mediumMemory.totalEstimatedBytes / smallMemory.totalEstimatedBytes;

      // Allow some variance but should be roughly proportional
      expect(memoryRatio).toBeGreaterThan(datasetRatio * 0.5);
      expect(memoryRatio).toBeLessThan(datasetRatio * 3);

      console.log('Scaling analysis:', {
        datasetRatio: datasetRatio.toFixed(2),
        memoryRatio: memoryRatio.toFixed(2),
        smallDataset: { mappings: smallDataset.length, zipCodes: smallStats.totalZipCodes, memoryKB: Math.round(smallMemory.totalEstimatedBytes / 1024) },
        mediumDataset: { mappings: mediumDataset.length, zipCodes: mediumStats.totalZipCodes, memoryKB: Math.round(mediumMemory.totalEstimatedBytes / 1024) }
      });
    });
  });

  describe('Edge Case Performance', () => {
    it('should handle ZIP codes with many buyers efficiently', async () => {
      // Create scenario where one ZIP has many buyers
      const hotZipMappings = Array.from({ length: 100 }, (_, i) => ({
        id: `hot-zip-${i}`,
        buyerId: `buyer-${i}`,
        serviceTypeId: 'service-1',
        zipCodes: ['90210'], // All buyers cover the same ZIP
        active: true,
        priority: i + 1,
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      const hotZipService = new OptimizedZipMappingService(hotZipMappings);

      const time = await profiler.measure('hot-zip-lookup', async () => {
        hotZipService.findBuyersByServiceAndZip('service-1', '90210');
      });

      // Should still be fast even with 100 buyers for one ZIP
      expect(time).toBeLessThan(10); // Under 10ms
    });

    it('should handle buyers with many ZIP codes efficiently', async () => {
      // Create scenario where one buyer covers many ZIP codes
      const wideSpreadMapping = {
        id: 'wide-spread-mapping',
        buyerId: 'buyer-widespread',
        serviceTypeId: 'service-1',
        zipCodes: generateLargeZipCodeDataset(50000), // 50k ZIP codes
        active: true,
        priority: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const wideSpreadService = new OptimizedZipMappingService([wideSpreadMapping]);

      // Test multiple lookups
      const testZips = wideSpreadMapping.zipCodes.slice(0, 100);
      const lookupTimes: number[] = [];

      for (const zipCode of testZips) {
        const time = await profiler.measure('wide-spread-lookup', async () => {
          wideSpreadService.findBuyersByServiceAndZip('service-1', zipCode);
        });
        lookupTimes.push(time);
      }

      const avgTime = lookupTimes.reduce((a, b) => a + b, 0) / lookupTimes.length;
      expect(avgTime).toBeLessThan(2); // Under 2ms average even with 50k ZIP spread
    });

    it('should handle empty result sets efficiently', async () => {
      const iterations = 1000;
      
      for (let i = 0; i < iterations; i++) {
        await profiler.measure('empty-result-lookup', async () => {
          // Look for non-existent combinations
          service.findBuyersByServiceAndZip('non-existent-service', '99999');
        });
      }

      const stats = profiler.getStats('empty-result-lookup');
      
      // Empty results should be even faster
      expect(stats.avg).toBeLessThan(0.5); // Under 0.5ms
    });
  });
});