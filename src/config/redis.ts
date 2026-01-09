import Redis from 'ioredis';

/**
 * Redis Configuration
 *
 * WHY: Centralized Redis client management with graceful degradation
 * WHEN: Used for caching, queues, and session management
 * HOW: Creates clients only when REDIS_URL or REDIS_HOST is configured
 *      Falls back to no-op implementations when Redis unavailable
 */

// Check if Redis is configured
const isRedisConfigured = !!(process.env.REDIS_URL || process.env.REDIS_HOST);

// Singleton pattern to prevent multiple Redis connections
const globalForRedis = globalThis as unknown as {
  redis: Redis | null;
  queueRedis: Redis | null;
  cacheRedis: Redis | null;
  redisInitialized: boolean;
};

// Only log once about Redis status
if (!globalForRedis.redisInitialized) {
  globalForRedis.redisInitialized = true;
  if (!isRedisConfigured) {
    console.log('[Redis] Not configured (REDIS_URL/REDIS_HOST missing) - caching disabled');
  }
}

/**
 * Create a Redis client with proper error handling
 */
function createClient(name: string, dbOffset: number = 0): Redis | null {
  if (!isRedisConfigured) {
    return null;
  }

  try {
    const client = process.env.REDIS_URL
      ? new Redis(process.env.REDIS_URL, {
          maxRetriesPerRequest: 3,
          lazyConnect: true,
          retryStrategy: (times) => {
            if (times > 3) return null;
            return Math.min(times * 200, 2000);
          },
        })
      : new Redis({
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD,
          db: parseInt(process.env.REDIS_DB || '0') + dbOffset,
          maxRetriesPerRequest: 3,
          lazyConnect: true,
          retryStrategy: (times) => {
            if (times > 3) return null;
            return Math.min(times * 200, 2000);
          },
        });

    // Only log errors once per client
    let errorLogged = false;
    client.on('error', (error) => {
      if (!errorLogged) {
        errorLogged = true;
        console.warn(`[Redis:${name}] Connection error (suppressing further):`, error.message);
      }
    });

    client.on('connect', () => {
      console.log(`[Redis:${name}] Connected successfully`);
    });

    return client;
  } catch (error) {
    console.warn(`[Redis:${name}] Failed to create client:`, error);
    return null;
  }
}

// Create Redis clients (null if not configured)
export const redis: Redis | null = globalForRedis.redis !== undefined
  ? globalForRedis.redis
  : createClient('main', 0);

export const queueRedis: Redis | null = globalForRedis.queueRedis !== undefined
  ? globalForRedis.queueRedis
  : createClient('queue', 1);

export const cacheRedis: Redis | null = globalForRedis.cacheRedis !== undefined
  ? globalForRedis.cacheRedis
  : createClient('cache', 2);

// Store in global for singleton pattern
globalForRedis.redis = redis;
globalForRedis.queueRedis = queueRedis;
globalForRedis.cacheRedis = cacheRedis;

// Queue operations
export class LeadQueue {
  private static readonly QUEUE_KEY = 'leads:processing';
  private static readonly PRIORITY_QUEUE_KEY = 'leads:processing:priority';

  static async addJob(leadId: string, serviceTypeId: string, priority: 'low' | 'normal' | 'high' = 'normal') {
    if (!queueRedis) {
      throw new Error('Queue Redis not configured');
    }

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

    await queueRedis.lpush(queueKey, JSON.stringify(job));
    console.log(`[LeadQueue] Added job ${job.id} to ${queueKey}`);

    return job.id;
  }

  static async getJob(): Promise<any | null> {
    if (!queueRedis) return null;

    // Check priority queue first
    let jobData = await queueRedis.rpop(this.PRIORITY_QUEUE_KEY);

    if (!jobData) {
      // Check normal queue
      jobData = await queueRedis.rpop(this.QUEUE_KEY);
    }

    if (!jobData) {
      return null;
    }

    return JSON.parse(jobData);
  }

  static async getQueueLength(): Promise<{ normal: number; priority: number }> {
    if (!queueRedis) return { normal: 0, priority: 0 };

    const [normal, priority] = await Promise.all([
      queueRedis.llen(this.QUEUE_KEY),
      queueRedis.llen(this.PRIORITY_QUEUE_KEY)
    ]);

    return { normal, priority };
  }

  static async retryJob(job: any) {
    if (!queueRedis) return;

    job.attempts += 1;
    job.retryTimestamp = Date.now();

    if (job.attempts < job.maxAttempts) {
      // Add back to queue with exponential backoff delay
      const delay = Math.pow(2, job.attempts) * 1000; // 2s, 4s, 8s...

      setTimeout(async () => {
        const queueKey = job.priority === 'high' ? this.PRIORITY_QUEUE_KEY : this.QUEUE_KEY;
        await queueRedis?.lpush(queueKey, JSON.stringify(job));
      }, delay);

      console.log(`[LeadQueue] Retrying job ${job.id} in ${delay}ms (attempt ${job.attempts})`);
    } else {
      console.error(`[LeadQueue] Job ${job.id} failed after ${job.maxAttempts} attempts`);
      await this.addFailedJob(job);
    }
  }

  static async addFailedJob(job: any) {
    if (!queueRedis) return;
    await queueRedis.lpush('leads:failed', JSON.stringify({
      ...job,
      failedAt: Date.now()
    }));
  }
}

// Cache operations with graceful fallback
export class RedisCache {
  static async set(key: string, value: any, ttlSeconds: number = 3600) {
    if (!cacheRedis) return; // Silently skip
    const serialized = JSON.stringify(value);
    await cacheRedis.setex(key, ttlSeconds, serialized);
  }

  static async get<T>(key: string): Promise<T | null> {
    if (!cacheRedis) return null; // Cache miss
    const value = await cacheRedis.get(key);
    if (!value) return null;

    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  static async delete(key: string) {
    if (!cacheRedis) return;
    await cacheRedis.del(key);
  }

  static async exists(key: string): Promise<boolean> {
    if (!cacheRedis) return false;
    const result = await cacheRedis.exists(key);
    return result === 1;
  }

  static async flush() {
    if (!cacheRedis) return;
    await cacheRedis.flushdb();
  }

  static async deletePattern(pattern: string) {
    if (!cacheRedis) return;
    const keys = await cacheRedis.keys(pattern);
    if (keys.length > 0) {
      await cacheRedis.del(...keys);
    }
  }

  static async sadd(key: string, ...members: string[]): Promise<number> {
    if (!cacheRedis) return 0;
    return await cacheRedis.sadd(key, ...members);
  }

  static async smembers(key: string): Promise<string[]> {
    if (!cacheRedis) return [];
    return await cacheRedis.smembers(key);
  }

  static async srem(key: string, ...members: string[]): Promise<number> {
    if (!cacheRedis) return 0;
    return await cacheRedis.srem(key, ...members);
  }

  static async incrbyfloat(key: string, increment: number): Promise<string> {
    if (!cacheRedis) return '0';
    return await cacheRedis.incrbyfloat(key, increment);
  }

  static async expire(key: string, seconds: number): Promise<number> {
    if (!cacheRedis) return 0;
    return await cacheRedis.expire(key, seconds);
  }
}

export default redis;
