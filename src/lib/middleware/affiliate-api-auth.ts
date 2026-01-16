/**
 * Affiliate API Authentication Middleware
 *
 * WHY: Provides consistent authentication for all affiliate API v1 endpoints.
 *      Enforces API key + secret authentication and rate limiting.
 *
 * WHEN: Use this middleware for:
 *       - All /api/v1/affiliate/* endpoints
 *       - Any endpoint requiring affiliate programmatic access
 *
 * HOW: Import and wrap route handlers with withAffiliateAuth().
 *      Validates credentials, checks rate limits, and injects affiliate context.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateApiKey,
  checkRateLimit,
  getRateLimitHeaders
} from '@/lib/services/affiliate-api-auth-service';
import { logger } from '@/lib/logger';

// Type for authenticated request context
export interface AffiliateApiContext {
  affiliateId: string;
  affiliate: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    status: string;
  };
  apiKey: string;
}

// Type for route handler with affiliate context
export type AffiliateApiHandler = (
  request: NextRequest,
  context: AffiliateApiContext
) => Promise<NextResponse>;

/**
 * Extract API credentials from request
 *
 * WHY: Supports multiple authentication methods for flexibility.
 * WHEN: Called by authentication middleware.
 * HOW: Checks Authorization header (Bearer or Basic) or query params.
 *
 * Supported formats:
 * 1. Authorization: Bearer <api_key>:<api_secret>
 * 2. Authorization: Basic <base64(api_key:api_secret)>
 * 3. X-API-Key + X-API-Secret headers
 */
function extractCredentials(
  request: NextRequest
): { apiKey: string | null; apiSecret: string | null } {
  // Method 1: Bearer token format (api_key:api_secret)
  const authHeader = request.headers.get('Authorization');
  if (authHeader) {
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const [apiKey, apiSecret] = token.split(':');
      if (apiKey && apiSecret) {
        return { apiKey, apiSecret };
      }
    }

    // Method 2: Basic auth format (base64 encoded api_key:api_secret)
    if (authHeader.startsWith('Basic ')) {
      try {
        const base64 = authHeader.slice(6);
        const decoded = Buffer.from(base64, 'base64').toString('utf-8');
        const [apiKey, apiSecret] = decoded.split(':');
        if (apiKey && apiSecret) {
          return { apiKey, apiSecret };
        }
      } catch {
        // Invalid base64, continue to other methods
      }
    }
  }

  // Method 3: Separate headers
  const apiKey = request.headers.get('X-API-Key');
  const apiSecret = request.headers.get('X-API-Secret');
  if (apiKey && apiSecret) {
    return { apiKey, apiSecret };
  }

  return { apiKey: null, apiSecret: null };
}

/**
 * Create standard API error response
 *
 * WHY: Ensures consistent error format across all API endpoints.
 * WHEN: When authentication or authorization fails.
 * HOW: Returns JSON with error details and appropriate status code.
 */
function createErrorResponse(
  status: number,
  error: string,
  errorCode: string,
  rateLimitHeaders?: Record<string, string>
): NextResponse {
  const response = NextResponse.json(
    {
      success: false,
      error,
      errorCode,
      timestamp: new Date().toISOString()
    },
    { status }
  );

  // Add rate limit headers if provided
  if (rateLimitHeaders) {
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
  }

  return response;
}

/**
 * Authenticate affiliate API request
 *
 * WHY: Validates API credentials and enforces rate limits.
 * WHEN: Called before processing any affiliate API request.
 * HOW: Extracts credentials, validates them, checks rate limits.
 *
 * @param request - The incoming request
 * @returns Either an error response or the authenticated context
 */
export async function authenticateAffiliateApiRequest(
  request: NextRequest
): Promise<{ error?: NextResponse; context?: AffiliateApiContext }> {
  // Extract credentials
  const { apiKey, apiSecret } = extractCredentials(request);

  if (!apiKey || !apiSecret) {
    return {
      error: createErrorResponse(
        401,
        'Missing API credentials',
        'MISSING_CREDENTIALS'
      )
    };
  }

  // Check rate limit before authentication (to prevent brute force)
  const rateLimit = checkRateLimit(apiKey);
  const rateLimitHeaders = getRateLimitHeaders(apiKey);

  if (!rateLimit.allowed) {
    logger.warn('Rate limit exceeded for API key', {
      apiKeyPrefix: apiKey.slice(0, 15) + '...',
      resetAt: rateLimit.resetAt
    });
    return {
      error: createErrorResponse(
        429,
        'Rate limit exceeded. Please try again later.',
        'RATE_LIMIT_EXCEEDED',
        rateLimitHeaders
      )
    };
  }

  // Authenticate credentials
  const authResult = await authenticateApiKey(apiKey, apiSecret);

  if (!authResult.success || !authResult.affiliate) {
    const status = authResult.errorCode === 'ACCOUNT_INACTIVE' ? 403 : 401;
    return {
      error: createErrorResponse(
        status,
        authResult.error || 'Authentication failed',
        authResult.errorCode || 'AUTH_FAILED',
        rateLimitHeaders
      )
    };
  }

  return {
    context: {
      affiliateId: authResult.affiliateId!,
      affiliate: authResult.affiliate,
      apiKey
    }
  };
}

/**
 * Higher-order function to wrap route handlers with authentication
 *
 * WHY: Provides clean, reusable authentication wrapper for API routes.
 * WHEN: Wrap any affiliate API route handler with this function.
 * HOW: Handles auth, rate limiting, and injects affiliate context.
 *
 * Usage:
 * ```typescript
 * export const GET = withAffiliateAuth(async (request, context) => {
 *   // context.affiliateId is guaranteed to exist
 *   return NextResponse.json({ data: ... });
 * });
 * ```
 */
export function withAffiliateAuth(
  handler: AffiliateApiHandler
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest) => {
    try {
      // Authenticate the request
      const { error, context } = await authenticateAffiliateApiRequest(request);

      if (error) {
        return error;
      }

      if (!context) {
        return createErrorResponse(
          500,
          'Authentication context missing',
          'INTERNAL_ERROR'
        );
      }

      // Call the handler with authenticated context
      const response = await handler(request, context);

      // Add rate limit headers to response
      const rateLimitHeaders = getRateLimitHeaders(context.apiKey);
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });

      return response;
    } catch (error) {
      logger.error('Affiliate API handler error', {
        path: request.nextUrl.pathname,
        error: (error as Error).message
      });

      return createErrorResponse(
        500,
        'Internal server error',
        'INTERNAL_ERROR'
      );
    }
  };
}

/**
 * Add standard API response headers
 *
 * WHY: Ensures consistent headers for CORS, caching, and rate limits.
 * WHEN: Called by API endpoints to standardize responses.
 * HOW: Adds security and informational headers.
 */
export function addApiResponseHeaders(
  response: NextResponse,
  apiKey?: string
): NextResponse {
  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');

  // CORS headers for API access
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.headers.set(
    'Access-Control-Allow-Headers',
    'Authorization, X-API-Key, X-API-Secret, Content-Type'
  );

  // Rate limit headers if API key provided
  if (apiKey) {
    const rateLimitHeaders = getRateLimitHeaders(apiKey);
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
  }

  return response;
}

/**
 * Handle CORS preflight requests for API endpoints
 *
 * WHY: Allows cross-origin API access from affiliate integrations.
 * WHEN: Browser sends OPTIONS request before actual API call.
 * HOW: Returns appropriate CORS headers.
 */
export function handleCorsOptions(): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers':
        'Authorization, X-API-Key, X-API-Secret, Content-Type',
      'Access-Control-Max-Age': '86400'
    }
  });
}
