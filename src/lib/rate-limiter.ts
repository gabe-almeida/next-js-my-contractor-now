import { RateLimiterRedis } from 'rate-limiter-flexible';
import { redis } from '@/config/redis';
import { NextRequest } from 'next/server';

// Rate limiter configurations
const rateLimiters = {
  // General API rate limiter - 100 requests per 15 minutes
  api: new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: 'rl:api',
    points: 100, // Number of requests
    duration: 900, // Per 15 minutes
    blockDuration: 900, // Block for 15 minutes if exceeded
  }),

  // Lead submission rate limiter - 5 submissions per hour per IP
  leadSubmission: new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: 'rl:leads',
    points: 5, // Number of submissions
    duration: 3600, // Per 1 hour
    blockDuration: 3600, // Block for 1 hour if exceeded
  }),

  // Admin API rate limiter - 200 requests per 15 minutes
  admin: new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: 'rl:admin',
    points: 200,
    duration: 900,
    blockDuration: 900,
  }),

  // Webhook rate limiter - 1000 requests per 5 minutes
  webhook: new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: 'rl:webhook',
    points: 1000,
    duration: 300,
    blockDuration: 300,
  }),

  // Service types rate limiter - 50 requests per 5 minutes
  serviceTypes: new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: 'rl:service-types',
    points: 50,
    duration: 300,
    blockDuration: 300,
  }),

  // Authentication attempts rate limiter - 5 attempts per 15 minutes
  authAttempts: new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: 'rl:auth',
    points: 5, // 5 attempts
    duration: 900, // per 15 minutes
    blockDuration: 3600, // block for 1 hour
  }),

  // Failed login attempts - progressive blocking
  authFailures: new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: 'rl:auth-failures',
    points: 3, // 3 failures
    duration: 600, // per 10 minutes
    blockDuration: 1800, // block for 30 minutes
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
    'X-RateLimit-Limit': rateLimiters.api.points.toString(),
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
    // Use proper logging without exposing client info
    console.log(`⚠️ Applied penalty of ${penaltyPoints} points`);
  } catch (error) {
    console.error('Error applying penalty:', error);
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
    console.log(`✅ Rewarded client ${clientId} with ${rewardPoints} points`);
  } catch (error) {
    console.error('Error applying reward:', error);
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
    totalHits: status?.totalHits || 0,
    totalTime: status?.totalTime || 0,
    remainingPoints: status?.remainingPoints || limiter.points,
    msBeforeNext: status?.msBeforeNext || 0
  };
}

export default rateLimiters;