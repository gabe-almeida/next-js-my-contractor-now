import Redis from 'ioredis';

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

export const redis = globalForRedis.redis ?? new Redis(process.env.REDIS_URL!, {
  enableReadyCheck: false,
  maxRetriesPerRequest: 3,
  connectTimeout: 10000,
  commandTimeout: 10000,
  lazyConnect: true,
});

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
}

// Queue Management
export async function addToQueue(
  queueName: string, 
  data: any, 
  priority: 'low' | 'normal' | 'high' | 'critical' = 'normal'
): Promise<string> {
  const job = {
    id: crypto.randomUUID(),
    data,
    priority,
    timestamp: Date.now(),
    attempts: 0,
    maxAttempts: priority === 'critical' ? 5 : 3,
  };
  
  const queueKey = `queue:${queueName}`;
  const priorityQueueKey = `${queueKey}:${priority}`;
  
  await redis.lpush(priorityQueueKey, JSON.stringify(job));
  await redis.sadd(`${queueKey}:priorities`, priority);
  
  return job.id;
}

export async function processQueue(
  queueName: string, 
  processor: (job: any) => Promise<void>
): Promise<void> {
  const queueKey = `queue:${queueName}`;
  const priorities = ['critical', 'high', 'normal', 'low'];
  
  while (true) {
    try {
      let job: any = null;
      
      // Process by priority
      for (const priority of priorities) {
        const priorityQueueKey = `${queueKey}:${priority}`;
        const result = await redis.brpop(priorityQueueKey, 1);
        
        if (result) {
          const [, jobData] = result;
          job = JSON.parse(jobData);
          break;
        }
      }
      
      if (job) {
        try {
          await processor(job);
        } catch (error) {
          console.error(`Job processing error:`, error);
          
          // Retry logic
          job.attempts += 1;
          if (job.attempts < job.maxAttempts) {
            const retryDelay = Math.min(1000 * Math.pow(2, job.attempts), 30000);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            
            const priorityQueueKey = `${queueKey}:${job.priority}`;
            await redis.lpush(priorityQueueKey, JSON.stringify(job));
          } else {
            // Move to dead letter queue
            await redis.lpush(`${queueKey}:dead`, JSON.stringify({
              ...job,
              failedAt: Date.now(),
              error: error instanceof Error ? error.message : 'Unknown error',
            }));
          }
        }
      } else {
        // No jobs available, wait a bit
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error(`Queue processing error:`, error);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

// Cache Management
export async function setCache(
  key: string, 
  value: any, 
  ttlSeconds: number = 3600
): Promise<void> {
  await redis.setex(key, ttlSeconds, JSON.stringify(value));
}

export async function getCache<T>(key: string): Promise<T | null> {
  const cached = await redis.get(key);
  return cached ? JSON.parse(cached) : null;
}

export async function deleteCache(key: string): Promise<void> {
  await redis.del(key);
}

export async function invalidateCachePattern(pattern: string): Promise<void> {
  const keys = await redis.keys(pattern);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

// Rate Limiting
export async function checkRateLimit(
  identifier: string, 
  windowMs: number = 60000, 
  maxRequests: number = 100
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  const key = `ratelimit:${identifier}`;
  const now = Date.now();
  const windowStart = now - windowMs;
  
  // Remove old entries
  await redis.zremrangebyscore(key, 0, windowStart);
  
  // Count current requests
  const currentRequests = await redis.zcard(key);
  
  if (currentRequests >= maxRequests) {
    const resetTime = await redis.zrange(key, 0, 0, 'WITHSCORES');
    const oldestRequestTime = resetTime[1] ? parseInt(resetTime[1] as string) : now;
    
    return {
      allowed: false,
      remaining: 0,
      resetTime: oldestRequestTime + windowMs,
    };
  }
  
  // Add current request
  await redis.zadd(key, now, `${now}-${Math.random()}`);
  await redis.expire(key, Math.ceil(windowMs / 1000));
  
  return {
    allowed: true,
    remaining: maxRequests - currentRequests - 1,
    resetTime: now + windowMs,
  };
}

// Health Check
export async function checkRedisConnection(): Promise<boolean> {
  try {
    await redis.ping();
    return true;
  } catch (error) {
    console.error('Redis connection failed:', error);
    return false;
  }
}

// Session Management
export async function setSession(
  sessionId: string, 
  data: any, 
  ttlSeconds: number = 86400
): Promise<void> {
  await redis.setex(`session:${sessionId}`, ttlSeconds, JSON.stringify(data));
}

export async function getSession<T>(sessionId: string): Promise<T | null> {
  const session = await redis.get(`session:${sessionId}`);
  return session ? JSON.parse(session) : null;
}

export async function deleteSession(sessionId: string): Promise<void> {
  await redis.del(`session:${sessionId}`);
}

// Graceful shutdown
export async function disconnectRedis(): Promise<void> {
  await redis.quit();
}