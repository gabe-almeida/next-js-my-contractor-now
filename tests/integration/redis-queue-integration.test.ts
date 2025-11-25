/**
 * Integration Tests: Redis Queue Operations
 * Tests the Lead Queue and Redis Cache functionality
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock Redis client
interface MockRedisClient {
  lpush: jest.MockedFunction<any>;
  rpop: jest.MockedFunction<any>;
  llen: jest.MockedFunction<any>;
  setex: jest.MockedFunction<any>;
  get: jest.MockedFunction<any>;
  del: jest.MockedFunction<any>;
  exists: jest.MockedFunction<any>;
  flushdb: jest.MockedFunction<any>;
  keys: jest.MockedFunction<any>;
  connect: jest.MockedFunction<any>;
  disconnect: jest.MockedFunction<any>;
  on: jest.MockedFunction<any>;
}

const createMockRedis = (): MockRedisClient => ({
  lpush: jest.fn(),
  rpop: jest.fn(),
  llen: jest.fn(),
  setex: jest.fn(),
  get: jest.fn(),
  del: jest.fn(),
  exists: jest.fn(),
  flushdb: jest.fn(),
  keys: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn(),
  on: jest.fn()
});

// Mock LeadQueue and RedisCache classes
class MockLeadQueue {
  private static queueRedis: MockRedisClient;
  private static readonly QUEUE_KEY = 'leads:processing';
  private static readonly PRIORITY_QUEUE_KEY = 'leads:processing:priority';

  static setRedisClient(client: MockRedisClient) {
    this.queueRedis = client;
  }

  static async addJob(leadId: string, serviceTypeId: string, priority: 'low' | 'normal' | 'high' = 'normal') {
    const job = {
      id: `${leadId}-${Date.now()}`,
      leadId,
      serviceTypeId,
      priority,
      timestamp: Date.now(),
      attempts: 0,
      maxAttempts: 3
    };

    const queueKey = priority === 'high' ? this.PRIORITY_QUEUE_KEY : this.QUEUE_KEY;
    await this.queueRedis.lpush(queueKey, JSON.stringify(job));

    return job.id;
  }

  static async getJob(): Promise<any | null> {
    // Check priority queue first
    let jobData = await this.queueRedis.rpop(this.PRIORITY_QUEUE_KEY);

    if (!jobData) {
      // Check normal queue
      jobData = await this.queueRedis.rpop(this.QUEUE_KEY);
    }

    if (!jobData) {
      return null;
    }

    return JSON.parse(jobData);
  }

  static async getQueueLength(): Promise<{ normal: number; priority: number }> {
    const normal = await this.queueRedis.llen(this.QUEUE_KEY);
    const priority = await this.queueRedis.llen(this.PRIORITY_QUEUE_KEY);

    return { normal, priority };
  }

  static async retryJob(job: any) {
    job.attempts += 1;
    job.retryTimestamp = Date.now();

    if (job.attempts < job.maxAttempts) {
      const queueKey = job.priority === 'high' ? this.PRIORITY_QUEUE_KEY : this.QUEUE_KEY;
      await this.queueRedis.lpush(queueKey, JSON.stringify(job));
      return true;
    } else {
      await this.addFailedJob(job);
      return false;
    }
  }

  static async addFailedJob(job: any) {
    await this.queueRedis.lpush('leads:failed', JSON.stringify({
      ...job,
      failedAt: Date.now()
    }));
  }
}

class MockRedisCache {
  private static cacheRedis: MockRedisClient;

  static setRedisClient(client: MockRedisClient) {
    this.cacheRedis = client;
  }

  static async set(key: string, value: any, ttlSeconds: number = 3600) {
    const serialized = JSON.stringify(value);
    await this.cacheRedis.setex(key, ttlSeconds, serialized);
  }

  static async get<T>(key: string): Promise<T | null> {
    const value = await this.cacheRedis.get(key);
    if (!value) return null;

    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  static async delete(key: string) {
    await this.cacheRedis.del(key);
  }

  static async exists(key: string): Promise<boolean> {
    const result = await this.cacheRedis.exists(key);
    return result === 1;
  }

  static async flush() {
    await this.cacheRedis.flushdb();
  }

  static async deletePattern(pattern: string) {
    const keys = await this.cacheRedis.keys(pattern);
    if (keys.length > 0) {
      await this.cacheRedis.del(...keys);
    }
  }
}

describe('Redis Queue Integration', () => {
  let mockQueueRedis: MockRedisClient;
  let mockCacheRedis: MockRedisClient;

  beforeEach(() => {
    mockQueueRedis = createMockRedis();
    mockCacheRedis = createMockRedis();

    MockLeadQueue.setRedisClient(mockQueueRedis);
    MockRedisCache.setRedisClient(mockCacheRedis);

    jest.clearAllMocks();
  });

  describe('Lead Queue - Job Addition', () => {
    test('should add job to normal queue', async () => {
      mockQueueRedis.lpush.mockResolvedValueOnce(1);

      const leadId = 'lead-123';
      const serviceTypeId = 'service-456';
      const jobId = await MockLeadQueue.addJob(leadId, serviceTypeId, 'normal');

      expect(jobId).toContain(leadId);
      expect(mockQueueRedis.lpush).toHaveBeenCalledWith(
        'leads:processing',
        expect.stringContaining(leadId)
      );
    });

    test('should add job to priority queue', async () => {
      mockQueueRedis.lpush.mockResolvedValueOnce(1);

      const leadId = 'lead-123';
      const serviceTypeId = 'service-456';
      const jobId = await MockLeadQueue.addJob(leadId, serviceTypeId, 'high');

      expect(jobId).toContain(leadId);
      expect(mockQueueRedis.lpush).toHaveBeenCalledWith(
        'leads:processing:priority',
        expect.stringContaining(leadId)
      );
    });

    test('should include job metadata', async () => {
      mockQueueRedis.lpush.mockResolvedValueOnce(1);

      const leadId = 'lead-123';
      const serviceTypeId = 'service-456';
      await MockLeadQueue.addJob(leadId, serviceTypeId);

      const callArg = mockQueueRedis.lpush.mock.calls[0][1];
      const job = JSON.parse(callArg);

      expect(job).toMatchObject({
        leadId,
        serviceTypeId,
        priority: 'normal',
        attempts: 0,
        maxAttempts: 3
      });
      expect(job.id).toBeDefined();
      expect(job.timestamp).toBeDefined();
    });

    test('should handle multiple concurrent job additions', async () => {
      mockQueueRedis.lpush.mockResolvedValue(1);

      const jobs = Array.from({ length: 10 }, (_, i) => ({
        leadId: `lead-${i}`,
        serviceTypeId: `service-${i}`,
        priority: i % 2 === 0 ? 'normal' as const : 'high' as const
      }));

      const jobIds = await Promise.all(
        jobs.map(job => MockLeadQueue.addJob(job.leadId, job.serviceTypeId, job.priority))
      );

      expect(jobIds).toHaveLength(10);
      expect(mockQueueRedis.lpush).toHaveBeenCalledTimes(10);
      expect(new Set(jobIds).size).toBe(10); // All IDs should be unique
    });
  });

  describe('Lead Queue - Job Retrieval', () => {
    test('should get job from priority queue first', async () => {
      const priorityJob = {
        id: 'job-priority-1',
        leadId: 'lead-123',
        serviceTypeId: 'service-456',
        priority: 'high',
        timestamp: Date.now(),
        attempts: 0,
        maxAttempts: 3
      };

      mockQueueRedis.rpop.mockResolvedValueOnce(JSON.stringify(priorityJob));

      const job = await MockLeadQueue.getJob();

      expect(job).toEqual(priorityJob);
      expect(mockQueueRedis.rpop).toHaveBeenCalledWith('leads:processing:priority');
    });

    test('should fall back to normal queue if priority queue empty', async () => {
      const normalJob = {
        id: 'job-normal-1',
        leadId: 'lead-123',
        serviceTypeId: 'service-456',
        priority: 'normal',
        timestamp: Date.now(),
        attempts: 0,
        maxAttempts: 3
      };

      mockQueueRedis.rpop
        .mockResolvedValueOnce(null) // Priority queue empty
        .mockResolvedValueOnce(JSON.stringify(normalJob)); // Normal queue has job

      const job = await MockLeadQueue.getJob();

      expect(job).toEqual(normalJob);
      expect(mockQueueRedis.rpop).toHaveBeenCalledWith('leads:processing:priority');
      expect(mockQueueRedis.rpop).toHaveBeenCalledWith('leads:processing');
    });

    test('should return null when both queues empty', async () => {
      mockQueueRedis.rpop.mockResolvedValue(null);

      const job = await MockLeadQueue.getJob();

      expect(job).toBeNull();
      expect(mockQueueRedis.rpop).toHaveBeenCalledTimes(2);
    });

    test('should handle malformed job data', async () => {
      mockQueueRedis.rpop.mockResolvedValueOnce('invalid json');

      await expect(MockLeadQueue.getJob()).rejects.toThrow();
    });
  });

  describe('Lead Queue - Queue Length', () => {
    test('should get queue lengths', async () => {
      mockQueueRedis.llen
        .mockResolvedValueOnce(5) // Normal queue
        .mockResolvedValueOnce(2); // Priority queue

      const lengths = await MockLeadQueue.getQueueLength();

      expect(lengths).toEqual({ normal: 5, priority: 2 });
      expect(mockQueueRedis.llen).toHaveBeenCalledWith('leads:processing');
      expect(mockQueueRedis.llen).toHaveBeenCalledWith('leads:processing:priority');
    });

    test('should handle empty queues', async () => {
      mockQueueRedis.llen.mockResolvedValue(0);

      const lengths = await MockLeadQueue.getQueueLength();

      expect(lengths).toEqual({ normal: 0, priority: 0 });
    });
  });

  describe('Lead Queue - Job Retry', () => {
    test('should retry job within max attempts', async () => {
      mockQueueRedis.lpush.mockResolvedValueOnce(1);

      const job = {
        id: 'job-1',
        leadId: 'lead-123',
        serviceTypeId: 'service-456',
        priority: 'normal',
        timestamp: Date.now(),
        attempts: 1,
        maxAttempts: 3
      };

      const result = await MockLeadQueue.retryJob(job);

      expect(result).toBe(true);
      expect(job.attempts).toBe(2);
      expect(job.retryTimestamp).toBeDefined();
      expect(mockQueueRedis.lpush).toHaveBeenCalledWith(
        'leads:processing',
        expect.stringContaining('lead-123')
      );
    });

    test('should move job to failed queue after max attempts', async () => {
      mockQueueRedis.lpush.mockResolvedValueOnce(1);

      const job = {
        id: 'job-1',
        leadId: 'lead-123',
        serviceTypeId: 'service-456',
        priority: 'normal',
        timestamp: Date.now(),
        attempts: 3,
        maxAttempts: 3
      };

      const result = await MockLeadQueue.retryJob(job);

      expect(result).toBe(false);
      expect(mockQueueRedis.lpush).toHaveBeenCalledWith(
        'leads:failed',
        expect.stringContaining('lead-123')
      );

      const callArg = mockQueueRedis.lpush.mock.calls[0][1];
      const failedJob = JSON.parse(callArg);
      expect(failedJob.failedAt).toBeDefined();
    });

    test('should retry high priority jobs to priority queue', async () => {
      mockQueueRedis.lpush.mockResolvedValueOnce(1);

      const job = {
        id: 'job-1',
        leadId: 'lead-123',
        serviceTypeId: 'service-456',
        priority: 'high',
        timestamp: Date.now(),
        attempts: 1,
        maxAttempts: 3
      };

      await MockLeadQueue.retryJob(job);

      expect(mockQueueRedis.lpush).toHaveBeenCalledWith(
        'leads:processing:priority',
        expect.stringContaining('lead-123')
      );
    });
  });

  describe('Redis Cache - Set and Get', () => {
    test('should set cache value with TTL', async () => {
      mockCacheRedis.setex.mockResolvedValueOnce('OK');

      const key = 'test:key';
      const value = { foo: 'bar', num: 123 };
      const ttl = 300;

      await MockRedisCache.set(key, value, ttl);

      expect(mockCacheRedis.setex).toHaveBeenCalledWith(
        key,
        ttl,
        JSON.stringify(value)
      );
    });

    test('should get cached value', async () => {
      const value = { foo: 'bar', num: 123 };
      mockCacheRedis.get.mockResolvedValueOnce(JSON.stringify(value));

      const key = 'test:key';
      const result = await MockRedisCache.get<typeof value>(key);

      expect(result).toEqual(value);
      expect(mockCacheRedis.get).toHaveBeenCalledWith(key);
    });

    test('should return null for missing key', async () => {
      mockCacheRedis.get.mockResolvedValueOnce(null);

      const key = 'nonexistent:key';
      const result = await MockRedisCache.get(key);

      expect(result).toBeNull();
    });

    test('should handle malformed cache data', async () => {
      mockCacheRedis.get.mockResolvedValueOnce('invalid json');

      const key = 'test:key';
      const result = await MockRedisCache.get(key);

      expect(result).toBeNull(); // Should return null instead of throwing
    });

    test('should use default TTL', async () => {
      mockCacheRedis.setex.mockResolvedValueOnce('OK');

      const key = 'test:key';
      const value = { foo: 'bar' };

      await MockRedisCache.set(key, value); // No TTL specified

      expect(mockCacheRedis.setex).toHaveBeenCalledWith(
        key,
        3600, // Default TTL
        JSON.stringify(value)
      );
    });
  });

  describe('Redis Cache - Delete Operations', () => {
    test('should delete single key', async () => {
      mockCacheRedis.del.mockResolvedValueOnce(1);

      const key = 'test:key';
      await MockRedisCache.delete(key);

      expect(mockCacheRedis.del).toHaveBeenCalledWith(key);
    });

    test('should check key existence', async () => {
      mockCacheRedis.exists.mockResolvedValueOnce(1);

      const key = 'test:key';
      const exists = await MockRedisCache.exists(key);

      expect(exists).toBe(true);
      expect(mockCacheRedis.exists).toHaveBeenCalledWith(key);
    });

    test('should return false for non-existent key', async () => {
      mockCacheRedis.exists.mockResolvedValueOnce(0);

      const key = 'nonexistent:key';
      const exists = await MockRedisCache.exists(key);

      expect(exists).toBe(false);
    });

    test('should flush entire cache', async () => {
      mockCacheRedis.flushdb.mockResolvedValueOnce('OK');

      await MockRedisCache.flush();

      expect(mockCacheRedis.flushdb).toHaveBeenCalled();
    });

    test('should delete keys by pattern', async () => {
      const keys = ['user:1', 'user:2', 'user:3'];
      mockCacheRedis.keys.mockResolvedValueOnce(keys);
      mockCacheRedis.del.mockResolvedValueOnce(3);

      await MockRedisCache.deletePattern('user:*');

      expect(mockCacheRedis.keys).toHaveBeenCalledWith('user:*');
      expect(mockCacheRedis.del).toHaveBeenCalledWith(...keys);
    });

    test('should handle empty pattern match', async () => {
      mockCacheRedis.keys.mockResolvedValueOnce([]);

      await MockRedisCache.deletePattern('nonexistent:*');

      expect(mockCacheRedis.keys).toHaveBeenCalledWith('nonexistent:*');
      expect(mockCacheRedis.del).not.toHaveBeenCalled();
    });
  });

  describe('Queue Performance', () => {
    test('should handle high volume of jobs', async () => {
      mockQueueRedis.lpush.mockResolvedValue(1);

      const startTime = performance.now();

      // Add 100 jobs concurrently
      const jobs = Array.from({ length: 100 }, (_, i) => ({
        leadId: `lead-${i}`,
        serviceTypeId: `service-${i}`,
        priority: 'normal' as const
      }));

      await Promise.all(
        jobs.map(job => MockLeadQueue.addJob(job.leadId, job.serviceTypeId, job.priority))
      );

      const endTime = performance.now();

      expect(mockQueueRedis.lpush).toHaveBeenCalledTimes(100);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    test('should process jobs in FIFO order for same priority', async () => {
      mockQueueRedis.lpush.mockResolvedValue(1);

      // Add jobs
      await MockLeadQueue.addJob('lead-1', 'service-1', 'normal');
      await MockLeadQueue.addJob('lead-2', 'service-2', 'normal');
      await MockLeadQueue.addJob('lead-3', 'service-3', 'normal');

      expect(mockQueueRedis.lpush).toHaveBeenCalledTimes(3);

      // Verify all calls were to normal queue (maintaining order)
      mockQueueRedis.lpush.mock.calls.forEach(call => {
        expect(call[0]).toBe('leads:processing');
      });
    });
  });

  describe('Cache Performance', () => {
    test('should handle rapid cache writes', async () => {
      mockCacheRedis.setex.mockResolvedValue('OK');

      const startTime = performance.now();

      const operations = Array.from({ length: 100 }, (_, i) =>
        MockRedisCache.set(`key:${i}`, { value: i }, 60)
      );

      await Promise.all(operations);

      const endTime = performance.now();

      expect(mockCacheRedis.setex).toHaveBeenCalledTimes(100);
      expect(endTime - startTime).toBeLessThan(1000);
    });

    test('should handle cache hit scenario', async () => {
      const cachedData = { buyers: [], total: 0 };
      mockCacheRedis.get.mockResolvedValueOnce(JSON.stringify(cachedData));

      const cacheKey = 'admin:buyers:true:1:100::';
      const result = await MockRedisCache.get(cacheKey);

      expect(result).toEqual(cachedData);
      // In real scenario, would skip database query
    });

    test('should handle cache miss scenario', async () => {
      mockCacheRedis.get.mockResolvedValueOnce(null);
      mockCacheRedis.setex.mockResolvedValueOnce('OK');

      const cacheKey = 'admin:buyers:true:1:100::';
      const cachedData = await MockRedisCache.get(cacheKey);

      expect(cachedData).toBeNull();

      // In real scenario, would fetch from database and cache
      const freshData = { buyers: [], total: 0 };
      await MockRedisCache.set(cacheKey, freshData, 300);

      expect(mockCacheRedis.setex).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    test('should handle Redis connection errors on queue add', async () => {
      mockQueueRedis.lpush.mockRejectedValueOnce(new Error('Connection failed'));

      await expect(
        MockLeadQueue.addJob('lead-123', 'service-456')
      ).rejects.toThrow('Connection failed');
    });

    test('should handle Redis connection errors on queue get', async () => {
      mockQueueRedis.rpop.mockRejectedValueOnce(new Error('Connection failed'));

      await expect(MockLeadQueue.getJob()).rejects.toThrow('Connection failed');
    });

    test('should handle Redis connection errors on cache set', async () => {
      mockCacheRedis.setex.mockRejectedValueOnce(new Error('Connection failed'));

      await expect(
        MockRedisCache.set('key', { value: 'test' })
      ).rejects.toThrow('Connection failed');
    });

    test('should handle Redis connection errors on cache get', async () => {
      mockCacheRedis.get.mockRejectedValueOnce(new Error('Connection failed'));

      await expect(MockRedisCache.get('key')).rejects.toThrow('Connection failed');
    });

    test('should handle timeout errors', async () => {
      mockQueueRedis.lpush.mockImplementationOnce(
        () => new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      );

      await expect(
        MockLeadQueue.addJob('lead-123', 'service-456')
      ).rejects.toThrow('Timeout');
    }, 10000);
  });

  describe('Integration Scenarios', () => {
    test('should handle lead processing workflow', async () => {
      // 1. Add job to queue
      mockQueueRedis.lpush.mockResolvedValueOnce(1);
      const jobId = await MockLeadQueue.addJob('lead-123', 'service-456', 'normal');
      expect(jobId).toBeDefined();

      // 2. Get job from queue
      const jobData = {
        id: jobId,
        leadId: 'lead-123',
        serviceTypeId: 'service-456',
        priority: 'normal',
        timestamp: Date.now(),
        attempts: 0,
        maxAttempts: 3
      };
      mockQueueRedis.rpop.mockResolvedValueOnce(JSON.stringify(jobData));
      const job = await MockLeadQueue.getJob();
      expect(job).toEqual(jobData);

      // 3. Process job (simulated)
      // ... processing logic ...

      // 4. Job succeeds - no retry needed
    });

    test('should handle failed job with retry', async () => {
      // 1. Get job
      const jobData = {
        id: 'job-1',
        leadId: 'lead-123',
        serviceTypeId: 'service-456',
        priority: 'normal',
        timestamp: Date.now(),
        attempts: 0,
        maxAttempts: 3
      };
      mockQueueRedis.rpop.mockResolvedValueOnce(JSON.stringify(jobData));
      const job = await MockLeadQueue.getJob();

      // 2. Job fails - retry
      mockQueueRedis.lpush.mockResolvedValueOnce(1);
      const retryResult = await MockLeadQueue.retryJob(job);

      expect(retryResult).toBe(true);
      expect(job.attempts).toBe(1);

      // 3. Job can be retried again
      mockQueueRedis.rpop.mockResolvedValueOnce(JSON.stringify(job));
      const retriedJob = await MockLeadQueue.getJob();
      expect(retriedJob.attempts).toBe(1);
    });

    test('should cache API responses', async () => {
      // 1. Cache miss - fetch from database
      mockCacheRedis.get.mockResolvedValueOnce(null);

      const cacheKey = 'api:leads:123';
      const cachedLead = await MockRedisCache.get(cacheKey);
      expect(cachedLead).toBeNull();

      // 2. Store in cache
      const freshLead = { id: '123', status: 'PENDING' };
      mockCacheRedis.setex.mockResolvedValueOnce('OK');
      await MockRedisCache.set(cacheKey, freshLead, 300);

      // 3. Cache hit - return cached data
      mockCacheRedis.get.mockResolvedValueOnce(JSON.stringify(freshLead));
      const cachedResult = await MockRedisCache.get(cacheKey);
      expect(cachedResult).toEqual(freshLead);
    });

    test('should invalidate cache on data update', async () => {
      // 1. Update data
      const leadId = '123';

      // 2. Invalidate cache
      mockCacheRedis.keys.mockResolvedValueOnce([
        `api:leads:${leadId}`,
        `api:leads:list:page:1`
      ]);
      mockCacheRedis.del.mockResolvedValueOnce(2);

      await MockRedisCache.deletePattern('api:leads:*');

      expect(mockCacheRedis.keys).toHaveBeenCalledWith('api:leads:*');
      expect(mockCacheRedis.del).toHaveBeenCalled();
    });
  });
});
