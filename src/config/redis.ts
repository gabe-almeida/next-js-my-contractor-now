import Redis from 'ioredis';

interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  maxRetriesPerRequest: number;
  retryStrategy?: (times: number) => number | null;
}

const redisConfig: RedisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  maxRetriesPerRequest: 3
};

// Create Redis clients for different purposes
export const redis = new Redis({
  host: redisConfig.host,
  port: redisConfig.port,
  password: redisConfig.password,
  db: redisConfig.db,
  maxRetriesPerRequest: redisConfig.maxRetriesPerRequest,
  lazyConnect: true
});

export const queueRedis = new Redis({
  ...redisConfig,
  db: (redisConfig.db || 0) + 1, // Use separate DB for queue
  lazyConnect: true
});

export const cacheRedis = new Redis({
  ...redisConfig,
  db: (redisConfig.db || 0) + 2, // Use separate DB for cache
  lazyConnect: true
});

// Connection event handlers
redis.on('connect', () => {
  console.log('✅ Redis connected successfully');
});

redis.on('error', (error) => {
  console.error('❌ Redis connection error:', error);
});

queueRedis.on('connect', () => {
  console.log('✅ Queue Redis connected successfully');
});

queueRedis.on('error', (error) => {
  console.error('❌ Queue Redis connection error:', error);
});

cacheRedis.on('connect', () => {
  console.log('✅ Cache Redis connected successfully');
});

cacheRedis.on('error', (error) => {
  console.error('❌ Cache Redis connection error:', error);
});

// Queue operations
export class LeadQueue {
  private static readonly QUEUE_KEY = 'leads:processing';
  private static readonly PRIORITY_QUEUE_KEY = 'leads:processing:priority';
  
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
    
    await queueRedis.lpush(queueKey, JSON.stringify(job));
    console.log(`📋 Added job ${job.id} to ${queueKey}`);
    
    return job.id;
  }
  
  static async getJob(): Promise<any | null> {
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
    const [normal, priority] = await Promise.all([
      queueRedis.llen(this.QUEUE_KEY),
      queueRedis.llen(this.PRIORITY_QUEUE_KEY)
    ]);
    
    return { normal, priority };
  }
  
  static async retryJob(job: any) {
    job.attempts += 1;
    job.retryTimestamp = Date.now();
    
    if (job.attempts < job.maxAttempts) {
      // Add back to queue with exponential backoff delay
      const delay = Math.pow(2, job.attempts) * 1000; // 2s, 4s, 8s...
      
      setTimeout(async () => {
        const queueKey = job.priority === 'high' ? this.PRIORITY_QUEUE_KEY : this.QUEUE_KEY;
        await queueRedis.lpush(queueKey, JSON.stringify(job));
      }, delay);
      
      console.log(`🔄 Retrying job ${job.id} in ${delay}ms (attempt ${job.attempts})`);
    } else {
      console.error(`❌ Job ${job.id} failed after ${job.maxAttempts} attempts`);
      await this.addFailedJob(job);
    }
  }
  
  static async addFailedJob(job: any) {
    await queueRedis.lpush('leads:failed', JSON.stringify({
      ...job,
      failedAt: Date.now()
    }));
  }
}

// Cache operations
export class RedisCache {
  static async set(key: string, value: any, ttlSeconds: number = 3600) {
    const serialized = JSON.stringify(value);
    await cacheRedis.setex(key, ttlSeconds, serialized);
  }
  
  static async get<T>(key: string): Promise<T | null> {
    const value = await cacheRedis.get(key);
    if (!value) return null;
    
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }
  
  static async delete(key: string) {
    await cacheRedis.del(key);
  }
  
  static async exists(key: string): Promise<boolean> {
    const result = await cacheRedis.exists(key);
    return result === 1;
  }
  
  static async flush() {
    await cacheRedis.flushdb();
  }

  static async deletePattern(pattern: string) {
    const keys = await cacheRedis.keys(pattern);
    if (keys.length > 0) {
      await cacheRedis.del(...keys);
    }
  }

  static async sadd(key: string, ...members: string[]): Promise<number> {
    return await cacheRedis.sadd(key, ...members);
  }

  static async smembers(key: string): Promise<string[]> {
    return await cacheRedis.smembers(key);
  }

  static async srem(key: string, ...members: string[]): Promise<number> {
    return await cacheRedis.srem(key, ...members);
  }

  static async incrbyfloat(key: string, increment: number): Promise<string> {
    return await cacheRedis.incrbyfloat(key, increment);
  }

  static async expire(key: string, seconds: number): Promise<number> {
    return await cacheRedis.expire(key, seconds);
  }
}

export default redis;