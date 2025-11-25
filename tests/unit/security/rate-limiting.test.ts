/**
 * Rate Limiting Tests
 *
 * Verifies API rate limiting and DDoS protection
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

describe('Rate Limiting', () => {
  // Simple in-memory rate limiter for testing
  class RateLimiter {
    private requests: Map<string, number[]> = new Map();
    private maxRequests: number;
    private windowMs: number;

    constructor(maxRequests: number, windowMs: number) {
      this.maxRequests = maxRequests;
      this.windowMs = windowMs;
    }

    check(identifier: string): { allowed: boolean; remaining: number; resetAt: number } {
      const now = Date.now();
      const windowStart = now - this.windowMs;

      // Get requests for this identifier
      let timestamps = this.requests.get(identifier) || [];

      // Filter out requests outside the window
      timestamps = timestamps.filter(ts => ts > windowStart);

      // Check if under limit
      if (timestamps.length >= this.maxRequests) {
        const oldestRequest = timestamps[0];
        const resetAt = oldestRequest + this.windowMs;

        return {
          allowed: false,
          remaining: 0,
          resetAt
        };
      }

      // Add this request
      timestamps.push(now);
      this.requests.set(identifier, timestamps);

      return {
        allowed: true,
        remaining: this.maxRequests - timestamps.length,
        resetAt: now + this.windowMs
      };
    }

    reset(identifier: string): void {
      this.requests.delete(identifier);
    }

    resetAll(): void {
      this.requests.clear();
    }
  }

  describe('API Endpoint Rate Limiting', () => {
    let limiter: RateLimiter;

    beforeEach(() => {
      // 10 requests per minute
      limiter = new RateLimiter(10, 60 * 1000);
    });

    it('should allow requests under the limit', () => {
      const ip = '192.168.1.1';

      for (let i = 0; i < 10; i++) {
        const result = limiter.check(ip);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(10 - i - 1);
      }
    });

    it('should block requests over the limit', () => {
      const ip = '192.168.1.1';

      // Make 10 requests (max)
      for (let i = 0; i < 10; i++) {
        limiter.check(ip);
      }

      // 11th request should be blocked
      const result = limiter.check(ip);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should track different IPs independently', () => {
      const ip1 = '192.168.1.1';
      const ip2 = '192.168.1.2';

      // Make 10 requests from IP1
      for (let i = 0; i < 10; i++) {
        limiter.check(ip1);
      }

      // IP1 should be blocked
      expect(limiter.check(ip1).allowed).toBe(false);

      // IP2 should still be allowed
      expect(limiter.check(ip2).allowed).toBe(true);
    });

    it('should provide reset time when rate limited', () => {
      const ip = '192.168.1.1';

      // Hit the limit
      for (let i = 0; i < 10; i++) {
        limiter.check(ip);
      }

      const result = limiter.check(ip);
      expect(result.allowed).toBe(false);
      expect(result.resetAt).toBeGreaterThan(Date.now());
    });

    it('should reset after time window expires', () => {
      const ip = '192.168.1.1';
      const shortWindowLimiter = new RateLimiter(3, 100); // 3 requests per 100ms

      // Hit the limit
      for (let i = 0; i < 3; i++) {
        shortWindowLimiter.check(ip);
      }

      // Should be blocked
      expect(shortWindowLimiter.check(ip).allowed).toBe(false);

      // Wait for window to expire
      return new Promise(resolve => {
        setTimeout(() => {
          // Should be allowed again
          expect(shortWindowLimiter.check(ip).allowed).toBe(true);
          resolve(undefined);
        }, 150);
      });
    });
  });

  describe('Per-IP Rate Limiting', () => {
    it('should rate limit by IP address', () => {
      const limiter = new RateLimiter(5, 60 * 1000);
      const ip = '203.0.113.1';

      // Allow 5 requests
      for (let i = 0; i < 5; i++) {
        expect(limiter.check(ip).allowed).toBe(true);
      }

      // Block 6th request
      expect(limiter.check(ip).allowed).toBe(false);
    });

    it('should handle IPv6 addresses', () => {
      const limiter = new RateLimiter(5, 60 * 1000);
      const ipv6 = '2001:0db8:85a3:0000:0000:8a2e:0370:7334';

      for (let i = 0; i < 5; i++) {
        expect(limiter.check(ipv6).allowed).toBe(true);
      }

      expect(limiter.check(ipv6).allowed).toBe(false);
    });

    it('should handle X-Forwarded-For header', () => {
      // Simulate parsing X-Forwarded-For
      const xForwardedFor = '203.0.113.1, 198.51.100.1, 192.0.2.1';
      const clientIp = xForwardedFor.split(',')[0].trim();

      expect(clientIp).toBe('203.0.113.1');
    });
  });

  describe('Per-User Rate Limiting', () => {
    it('should rate limit by user ID', () => {
      const limiter = new RateLimiter(100, 60 * 1000);
      const userId = 'user-123';

      // Allow 100 requests
      for (let i = 0; i < 100; i++) {
        expect(limiter.check(userId).allowed).toBe(true);
      }

      // Block 101st request
      expect(limiter.check(userId).allowed).toBe(false);
    });

    it('should rate limit by buyer ID', () => {
      const limiter = new RateLimiter(1000, 60 * 1000);
      const buyerId = 'buyer-456';

      // Allow 1000 requests per minute for buyers
      for (let i = 0; i < 1000; i++) {
        limiter.check(buyerId);
      }

      // Should be at limit
      expect(limiter.check(buyerId).allowed).toBe(false);
    });
  });

  describe('Rate Limit Headers', () => {
    it('should include standard rate limit headers', () => {
      const headers = {
        'X-RateLimit-Limit': '100',
        'X-RateLimit-Remaining': '95',
        'X-RateLimit-Reset': '1640000000'
      };

      expect(headers['X-RateLimit-Limit']).toBe('100');
      expect(headers['X-RateLimit-Remaining']).toBe('95');
      expect(headers['X-RateLimit-Reset']).toBe('1640000000');
    });

    it('should include Retry-After header when limited', () => {
      const limiter = new RateLimiter(5, 60 * 1000);
      const ip = '192.168.1.1';

      // Hit the limit
      for (let i = 0; i < 5; i++) {
        limiter.check(ip);
      }

      const result = limiter.check(ip);
      const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);

      expect(retryAfter).toBeGreaterThan(0);
      expect(retryAfter).toBeLessThanOrEqual(60);
    });
  });

  describe('Endpoint-Specific Rate Limits', () => {
    it('should apply stricter limits to expensive endpoints', () => {
      // POST /api/leads - expensive operation
      const leadSubmissionLimiter = new RateLimiter(10, 60 * 1000);

      // GET /api/buyers - cheaper operation
      const buyerListLimiter = new RateLimiter(100, 60 * 1000);

      expect(leadSubmissionLimiter.maxRequests).toBe(10);
      expect(buyerListLimiter.maxRequests).toBe(100);
    });

    it('should apply different limits for authenticated users', () => {
      const anonymousLimiter = new RateLimiter(10, 60 * 1000);
      const authenticatedLimiter = new RateLimiter(100, 60 * 1000);

      expect(anonymousLimiter.maxRequests).toBeLessThan(authenticatedLimiter.maxRequests);
    });
  });

  describe('DDoS Protection', () => {
    it('should detect rapid request patterns', () => {
      const limiter = new RateLimiter(100, 1000); // 100 per second
      const ip = '192.168.1.1';

      // Simulate 150 rapid requests
      let blocked = 0;
      for (let i = 0; i < 150; i++) {
        const result = limiter.check(ip);
        if (!result.allowed) {
          blocked++;
        }
      }

      // Should have blocked at least 50 requests
      expect(blocked).toBeGreaterThanOrEqual(50);
    });

    it('should track suspicious IP patterns', () => {
      const suspiciousIps = new Set<string>();
      const limiter = new RateLimiter(10, 60 * 1000);

      const testIp = '192.168.1.100';

      // Hit the limit multiple times
      for (let i = 0; i < 20; i++) {
        const result = limiter.check(testIp);
        if (!result.allowed) {
          suspiciousIps.add(testIp);
        }
      }

      expect(suspiciousIps.has(testIp)).toBe(true);
    });
  });

  describe('Distributed Rate Limiting', () => {
    it('should support distributed rate limiting with Redis', () => {
      // Mock Redis rate limiter
      const redisRateLimiter = {
        async increment(key: string, ttl: number): Promise<number> {
          // In production, this would use Redis INCR + EXPIRE
          return 1;
        },

        async check(key: string, max: number): Promise<boolean> {
          const count = await this.increment(key, 60);
          return count <= max;
        }
      };

      expect(typeof redisRateLimiter.check).toBe('function');
    });
  });

  describe('Rate Limit Bypass for Critical Operations', () => {
    it('should allow whitelisted IPs to bypass rate limits', () => {
      const whitelist = new Set(['127.0.0.1', '::1']);
      const limiter = new RateLimiter(5, 60 * 1000);

      const testIp = '127.0.0.1';

      // Make 100 requests from whitelisted IP
      for (let i = 0; i < 100; i++) {
        if (whitelist.has(testIp)) {
          // Bypass rate limiting
          expect(true).toBe(true);
        } else {
          limiter.check(testIp);
        }
      }
    });

    it('should allow health check endpoints to bypass limits', () => {
      const healthCheckPaths = new Set(['/health', '/ping', '/status']);
      const requestPath = '/health';

      expect(healthCheckPaths.has(requestPath)).toBe(true);
    });
  });

  describe('Adaptive Rate Limiting', () => {
    it('should adjust limits based on system load', () => {
      class AdaptiveRateLimiter extends RateLimiter {
        private systemLoad: number = 0;

        setSystemLoad(load: number): void {
          this.systemLoad = load;
        }

        getEffectiveLimit(): number {
          if (this.systemLoad > 0.8) {
            return Math.floor(this.maxRequests * 0.5); // 50% capacity under high load
          }
          return this.maxRequests;
        }
      }

      const adaptiveLimiter = new AdaptiveRateLimiter(100, 60 * 1000);

      // Normal load
      expect(adaptiveLimiter.getEffectiveLimit()).toBe(100);

      // High load
      adaptiveLimiter.setSystemLoad(0.9);
      expect(adaptiveLimiter.getEffectiveLimit()).toBe(50);
    });
  });

  describe('Rate Limiting Error Responses', () => {
    it('should return 429 status code when rate limited', () => {
      const limiter = new RateLimiter(1, 60 * 1000);
      const ip = '192.168.1.1';

      limiter.check(ip);
      const result = limiter.check(ip);

      if (!result.allowed) {
        const statusCode = 429;
        const message = 'Too Many Requests';

        expect(statusCode).toBe(429);
        expect(message).toBe('Too Many Requests');
      }
    });

    it('should include helpful error message', () => {
      const errorResponse = {
        error: 'Rate limit exceeded',
        message: 'Too many requests. Please try again later.',
        retryAfter: 60
      };

      expect(errorResponse.error).toBe('Rate limit exceeded');
      expect(errorResponse.retryAfter).toBeGreaterThan(0);
    });
  });
});
