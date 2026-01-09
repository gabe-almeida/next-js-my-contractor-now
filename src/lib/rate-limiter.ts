import { RateLimiterRedis, RateLimiterMemory, RateLimiterAbstract } from 'rate-limiter-flexible';
import { redis } from '@/config/redis';
import { NextRequest } from 'next/server';

/**
 * Rate Limiter Configuration
 *
 * WHY: Protect API endpoints from abuse and DDoS attacks
 * WHEN: Applied to all API routes via middleware
 * HOW: Uses Redis when available, falls back to in-memory when not
 */

// Helper to create a rate limiter with Redis or Memory fallback
function createRateLimiter(config: {
  keyPrefix: string;
  points: number;
  duration: number;
  blockDuration: number;
}): RateLimiterAbstract {
  // If Redis is available, use it
  if (redis) {
    return new RateLimiterRedis({
      storeClient: redis,
      keyPrefix: config.keyPrefix,
      points: config.points,
      duration: config.duration,
      blockDuration: config.blockDuration,
    });
  }

  // Fallback to in-memory rate limiting (works but not distributed)
  console.log(`[RateLimiter] Using memory fallback for ${config.keyPrefix}`);
  return new RateLimiterMemory({
    keyPrefix: config.keyPrefix,
    points: config.points,
    duration: config.duration,
    blockDuration: config.blockDuration,
  });
}

// Rate limiter configurations
const rateLimiters = {
  // General API rate limiter - 100 requests per 15 minutes
  api: createRateLimiter({
    keyPrefix: 'rl:api',
    points: 100,
    duration: 900,
    blockDuration: 900,
  }),

  // Lead submission rate limiter - 5 submissions per hour per IP
  leadSubmission: createRateLimiter({
    keyPrefix: 'rl:leads',
    points: 5,
    duration: 3600,
    blockDuration: 3600,
  }),

  // Admin API rate limiter - 200 requests per 15 minutes
  admin: createRateLimiter({
    keyPrefix: 'rl:admin',
    points: 200,
    duration: 900,
    blockDuration: 900,
  }),

  // Webhook rate limiter - 1000 requests per 5 minutes
  webhook: createRateLimiter({
    keyPrefix: 'rl:webhook',
    points: 1000,
    duration: 300,
    blockDuration: 300,
  }),

  // Service types rate limiter - 50 requests per 5 minutes
  serviceTypes: createRateLimiter({
    keyPrefix: 'rl:service-types',
    points: 50,
    duration: 300,
    blockDuration: 300,
  }),

  // Authentication attempts rate limiter - 5 attempts per 15 minutes
  authAttempts: createRateLimiter({
    keyPrefix: 'rl:auth',
    points: 5,
    duration: 900,
    blockDuration: 3600,
  }),

  // Failed login attempts - progressive blocking
  authFailures: createRateLimiter({
    keyPrefix: 'rl:auth-failures',
    points: 3,
    duration: 600,
    blockDuration: 1800,
  })
};

export type RateLimiterType = keyof typeof rateLimiters;

// Get client identifier from request
function getClientIdentifier(req: NextRequest): string {
  // Try to get real IP from headers (for production behind proxy)
  const forwarded = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  const ip = forwarded ? forwarded.split(',')[0] : realIp;

  return ip || req.ip || 'unknown';
}

// Rate limiting middleware
export async function checkRateLimit(
  req: NextRequest,
  limiterType: RateLimiterType = 'api'
): Promise<{
  allowed: boolean;
  remaining?: number;
  resetTime?: Date;
  error?: string;
}> {
  const limiter = rateLimiters[limiterType];
  const clientId = getClientIdentifier(req);

  try {
    const result = await limiter.consume(clientId);

    return {
      allowed: true,
      remaining: result.remainingPoints,
      resetTime: new Date(Date.now() + result.msBeforeNext)
    };
  } catch (rejRes: any) {
    // Rate limit exceeded
    const resetTime = new Date(Date.now() + rejRes.msBeforeNext);

    return {
      allowed: false,
      remaining: 0,
      resetTime,
      error: `Rate limit exceeded. Try again after ${resetTime.toISOString()}`
    };
  }
}

// Rate limit headers for responses
export function getRateLimitHeaders(result: any) {
  if (!result) return {};

  return {
    'X-RateLimit-Limit': '100',
    'X-RateLimit-Remaining': (result.remaining || 0).toString(),
    'X-RateLimit-Reset': result.resetTime ?
      Math.ceil(result.resetTime.getTime() / 1000).toString() :
      ''
  };
}

// Penalty for suspicious activity
export async function penalizeClient(
  req: NextRequest,
  limiterType: RateLimiterType = 'api',
  penaltyPoints: number = 10
) {
  const limiter = rateLimiters[limiterType];
  const clientId = getClientIdentifier(req);

  try {
    await limiter.penalty(clientId, penaltyPoints);
    console.log(`[RateLimiter] Applied penalty of ${penaltyPoints} points`);
  } catch (error) {
    console.error('[RateLimiter] Error applying penalty:', error);
  }
}

// Reward for good behavior (rarely used)
export async function rewardClient(
  req: NextRequest,
  limiterType: RateLimiterType = 'api',
  rewardPoints: number = 1
) {
  const limiter = rateLimiters[limiterType];
  const clientId = getClientIdentifier(req);

  try {
    await limiter.reward(clientId, rewardPoints);
    console.log(`[RateLimiter] Rewarded client with ${rewardPoints} points`);
  } catch (error) {
    console.error('[RateLimiter] Error applying reward:', error);
  }
}

// Get rate limit status without consuming points
export async function getRateLimitStatus(
  req: NextRequest,
  limiterType: RateLimiterType = 'api'
): Promise<{
  totalHits: number;
  totalTime: number;
  remainingPoints: number;
  msBeforeNext: number;
}> {
  const limiter = rateLimiters[limiterType];
  const clientId = getClientIdentifier(req);

  const status = await limiter.get(clientId);

  return {
    totalHits: status?.consumedPoints || 0,
    totalTime: 0,
    remainingPoints: status?.remainingPoints ?? 100,
    msBeforeNext: status?.msBeforeNext || 0
  };
}

export default rateLimiters;
