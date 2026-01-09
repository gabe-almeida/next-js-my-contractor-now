import Redis from 'ioredis';

const globalForRedis = globalThis as unknown as {
  redis: Redis | null;
};

// Only create Redis client if REDIS_URL is configured
// This prevents spam errors when Redis is not available (e.g., on Render without Redis addon)
function createRedisClient(): Redis | null {
  if (!process.env.REDIS_URL) {
    console.log('[Redis] REDIS_URL not configured - Redis features disabled');
    return null;
  }

  try {
    const client = new Redis(process.env.REDIS_URL, {
      enableReadyCheck: false,
      maxRetriesPerRequest: 3,
      connectTimeout: 10000,
      commandTimeout: 10000,
      lazyConnect: true,
      retryStrategy: (times) => {
        if (times > 3) {
          console.warn('[Redis] Max retries reached, giving up');
          return null; // Stop retrying
        }
        return Math.min(times * 200, 2000);
      },
    });

    // Suppress error spam by handling the error event
    client.on('error', (err) => {
      // Only log once, not on every retry
      if (!globalForRedis.redis) {
        console.warn('[Redis] Connection error (will retry silently):', err.message);
      }
    });

    return client;
  } catch (error) {
    console.warn('[Redis] Failed to create client:', error);
    return null;
  }
}

export const redis: Redis | null = globalForRedis.redis !== undefined
  ? globalForRedis.redis
  : createRedisClient();

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
}

// Helper to check if Redis is available
export function isRedisAvailable(): boolean {
  return redis !== null;
}

// Queue Management
export async function addToQueue(
  queueName: string,
  data: any,
  priority: 'low' | 'normal' | 'high' | 'critical' = 'normal'
): Promise<string> {
  if (!redis) {
    throw new Error('Redis not configured - queue unavailable');
  }

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
  if (!redis) {
    console.warn('[Redis] Queue processing unavailable - Redis not configured');
    return;
  }

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
  if (!redis) return; // Silently skip if Redis not available
  await redis.setex(key, ttlSeconds, JSON.stringify(value));
}

export async function getCache<T>(key: string): Promise<T | null> {
  if (!redis) return null; // Return cache miss if Redis not available
  const cached = await redis.get(key);
  return cached ? JSON.parse(cached) : null;
}

export async function deleteCache(key: string): Promise<void> {
  if (!redis) return;
  await redis.del(key);
}

export async function invalidateCachePattern(pattern: string): Promise<void> {
  if (!redis) return;
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
  // If Redis not available, allow all requests (no rate limiting)
  if (!redis) {
    return { allowed: true, remaining: maxRequests, resetTime: Date.now() + windowMs };
  }

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
  if (!redis) return false;
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
  if (!redis) return;
  await redis.setex(`session:${sessionId}`, ttlSeconds, JSON.stringify(data));
}

export async function getSession<T>(sessionId: string): Promise<T | null> {
  if (!redis) return null;
  const session = await redis.get(`session:${sessionId}`);
  return session ? JSON.parse(session) : null;
}

export async function deleteSession(sessionId: string): Promise<void> {
  if (!redis) return;
  await redis.del(`session:${sessionId}`);
}

// Graceful shutdown
export async function disconnectRedis(): Promise<void> {
  if (!redis) return;
  await redis.quit();
}