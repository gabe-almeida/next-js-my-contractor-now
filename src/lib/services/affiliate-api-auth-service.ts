/**
 * Affiliate API Authentication Service
 *
 * WHY: Provides programmatic API access for affiliates to query their data.
 *      Uses API key + secret authentication separate from JWT-based web auth.
 *
 * WHEN: Use this service for:
 *       - Generating API credentials for affiliates
 *       - Validating API key + secret combinations
 *       - Rate limiting API access
 *       - Revoking/regenerating API credentials
 *
 * HOW: Import and call the appropriate method. All methods:
 *      - Use secure random generation for API keys/secrets
 *      - Hash secrets before storage (never store plaintext)
 *      - Log authentication attempts for security audit
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

// API key format: mcn_live_XXXXXXXX (32 random chars)
const API_KEY_PREFIX = 'mcn_live_';
const API_KEY_LENGTH = 32;
const API_SECRET_LENGTH = 48;
const BCRYPT_SALT_ROUNDS = 10;

// Rate limit configuration
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 60; // 60 requests per minute

// In-memory rate limit tracking (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export interface ApiCredentials {
  apiKey: string;
  apiSecret: string; // Only returned on generation, not stored
}

export interface ApiAuthResult {
  success: boolean;
  affiliateId?: string;
  affiliate?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    status: string;
  };
  error?: string;
  errorCode?: string;
}

/**
 * Generate new API credentials for an affiliate
 *
 * WHY: Affiliates need programmatic access to their data for integrations.
 * WHEN: When affiliate requests API access or needs to regenerate credentials.
 * HOW: Generates secure random key + secret, hashes secret, stores in DB.
 *
 * @param affiliateId - The affiliate's ID
 * @returns API key and secret (secret only shown once!)
 */
export async function generateApiCredentials(
  affiliateId: string
): Promise<{ success: boolean; credentials?: ApiCredentials; error?: string }> {
  try {
    // Verify affiliate exists and is active
    const affiliate = await prisma.affiliate.findUnique({
      where: { id: affiliateId },
      select: { id: true, status: true, email: true }
    });

    if (!affiliate) {
      return { success: false, error: 'Affiliate not found' };
    }

    if (affiliate.status !== 'ACTIVE') {
      return { success: false, error: 'Affiliate account is not active' };
    }

    // Generate secure random API key and secret
    const apiKeyRandom = crypto.randomBytes(API_KEY_LENGTH).toString('hex').slice(0, API_KEY_LENGTH);
    const apiKey = `${API_KEY_PREFIX}${apiKeyRandom}`;
    const apiSecret = crypto.randomBytes(API_SECRET_LENGTH).toString('hex').slice(0, API_SECRET_LENGTH);

    // Hash the secret before storing
    const hashedSecret = await bcrypt.hash(apiSecret, BCRYPT_SALT_ROUNDS);

    // Update affiliate with new credentials
    await prisma.affiliate.update({
      where: { id: affiliateId },
      data: {
        apiKey,
        apiSecret: hashedSecret
      }
    });

    logger.info('API credentials generated for affiliate', {
      affiliateId,
      apiKeyPrefix: apiKey.slice(0, 15) + '...'
    });

    return {
      success: true,
      credentials: {
        apiKey,
        apiSecret // Only returned once - affiliate must save this!
      }
    };
  } catch (error) {
    logger.error('Failed to generate API credentials', {
      affiliateId,
      error: (error as Error).message
    });
    return {
      success: false,
      error: `Failed to generate credentials: ${(error as Error).message}`
    };
  }
}

/**
 * Revoke API credentials for an affiliate
 *
 * WHY: Security best practice - allow credentials to be invalidated.
 * WHEN: When affiliate requests revocation or security incident occurs.
 * HOW: Clears apiKey and apiSecret fields in database.
 */
export async function revokeApiCredentials(
  affiliateId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.affiliate.update({
      where: { id: affiliateId },
      data: {
        apiKey: null,
        apiSecret: null
      }
    });

    logger.info('API credentials revoked for affiliate', { affiliateId });

    return { success: true };
  } catch (error) {
    logger.error('Failed to revoke API credentials', {
      affiliateId,
      error: (error as Error).message
    });
    return {
      success: false,
      error: `Failed to revoke credentials: ${(error as Error).message}`
    };
  }
}

/**
 * Authenticate affiliate using API key and secret
 *
 * WHY: Validates programmatic API access for affiliates.
 * WHEN: On every API request using API key authentication.
 * HOW: Looks up affiliate by API key, verifies secret hash, checks status.
 *
 * @param apiKey - The API key (mcn_live_XXXX format)
 * @param apiSecret - The API secret
 * @returns Authentication result with affiliate info
 */
export async function authenticateApiKey(
  apiKey: string,
  apiSecret: string
): Promise<ApiAuthResult> {
  try {
    // Validate API key format
    if (!apiKey || !apiKey.startsWith(API_KEY_PREFIX)) {
      return {
        success: false,
        error: 'Invalid API key format',
        errorCode: 'INVALID_KEY_FORMAT'
      };
    }

    if (!apiSecret || apiSecret.length < 32) {
      return {
        success: false,
        error: 'Invalid API secret format',
        errorCode: 'INVALID_SECRET_FORMAT'
      };
    }

    // Find affiliate by API key
    const affiliate = await prisma.affiliate.findUnique({
      where: { apiKey },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        apiSecret: true
      }
    });

    if (!affiliate || !affiliate.apiSecret) {
      // Use generic error to prevent enumeration attacks
      logger.warn('API authentication failed: invalid key', {
        apiKeyPrefix: apiKey.slice(0, 15) + '...'
      });
      return {
        success: false,
        error: 'Invalid API credentials',
        errorCode: 'INVALID_CREDENTIALS'
      };
    }

    // Verify secret
    const isValidSecret = await bcrypt.compare(apiSecret, affiliate.apiSecret);
    if (!isValidSecret) {
      logger.warn('API authentication failed: invalid secret', {
        affiliateId: affiliate.id
      });
      return {
        success: false,
        error: 'Invalid API credentials',
        errorCode: 'INVALID_CREDENTIALS'
      };
    }

    // Check affiliate status
    if (affiliate.status !== 'ACTIVE') {
      logger.warn('API authentication failed: inactive account', {
        affiliateId: affiliate.id,
        status: affiliate.status
      });
      return {
        success: false,
        error: `Account is ${affiliate.status.toLowerCase()}`,
        errorCode: 'ACCOUNT_INACTIVE'
      };
    }

    logger.info('API authentication successful', {
      affiliateId: affiliate.id
    });

    return {
      success: true,
      affiliateId: affiliate.id,
      affiliate: {
        id: affiliate.id,
        email: affiliate.email,
        firstName: affiliate.firstName,
        lastName: affiliate.lastName,
        status: affiliate.status
      }
    };
  } catch (error) {
    logger.error('API authentication error', {
      error: (error as Error).message
    });
    return {
      success: false,
      error: 'Authentication failed',
      errorCode: 'AUTH_ERROR'
    };
  }
}

/**
 * Check rate limit for API key
 *
 * WHY: Prevents abuse and ensures fair API access for all affiliates.
 * WHEN: Called before processing any API request.
 * HOW: Tracks request count per API key within sliding time window.
 *
 * @param apiKey - The API key to check
 * @returns Whether the request is allowed and remaining requests
 */
export function checkRateLimit(apiKey: string): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  const now = Date.now();
  const record = rateLimitStore.get(apiKey);

  // Clean up expired entries
  if (record && now > record.resetAt) {
    rateLimitStore.delete(apiKey);
  }

  const currentRecord = rateLimitStore.get(apiKey);

  if (!currentRecord) {
    // First request in this window
    const resetAt = now + RATE_LIMIT_WINDOW_MS;
    rateLimitStore.set(apiKey, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: RATE_LIMIT_MAX_REQUESTS - 1,
      resetAt
    };
  }

  if (currentRecord.count >= RATE_LIMIT_MAX_REQUESTS) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: currentRecord.resetAt
    };
  }

  // Increment count
  currentRecord.count++;
  return {
    allowed: true,
    remaining: RATE_LIMIT_MAX_REQUESTS - currentRecord.count,
    resetAt: currentRecord.resetAt
  };
}

/**
 * Get rate limit headers for API response
 *
 * WHY: Informs clients about their rate limit status.
 * WHEN: Include in all API responses.
 * HOW: Returns headers following industry standard format.
 */
export function getRateLimitHeaders(apiKey: string): Record<string, string> {
  const { remaining, resetAt } = checkRateLimit(apiKey);
  // Decrement since checkRateLimit already counted this request
  return {
    'X-RateLimit-Limit': String(RATE_LIMIT_MAX_REQUESTS),
    'X-RateLimit-Remaining': String(Math.max(0, remaining)),
    'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000))
  };
}

/**
 * Check if affiliate has API credentials configured
 *
 * WHY: UI needs to know if credentials exist to show appropriate actions.
 * WHEN: Loading affiliate settings page.
 * HOW: Checks if apiKey field is populated (doesn't expose the key).
 */
export async function hasApiCredentials(affiliateId: string): Promise<boolean> {
  const affiliate = await prisma.affiliate.findUnique({
    where: { id: affiliateId },
    select: { apiKey: true }
  });

  return !!affiliate?.apiKey;
}

/**
 * Get masked API key for display
 *
 * WHY: Shows affiliate their API key exists without exposing full value.
 * WHEN: Displaying API settings in affiliate portal.
 * HOW: Returns first 15 chars + masked remainder.
 */
export async function getMaskedApiKey(
  affiliateId: string
): Promise<string | null> {
  const affiliate = await prisma.affiliate.findUnique({
    where: { id: affiliateId },
    select: { apiKey: true }
  });

  if (!affiliate?.apiKey) {
    return null;
  }

  // Show prefix + first 4 chars of random part + masked
  const visiblePart = affiliate.apiKey.slice(0, API_KEY_PREFIX.length + 4);
  return `${visiblePart}${'*'.repeat(8)}`;
}
