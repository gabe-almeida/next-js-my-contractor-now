import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getRateLimitHeaders, RateLimiterType } from './rate-limiter';
import { logger, logRequest, logApiError } from './logger';
import {
  generateRequestId,
  errorResponse,
  rateLimitErrorResponse,
  getHttpStatusFromError,
  createTimer
} from './utils';
import { 
  validateAdminAuth, 
  getSecureCorsHeaders, 
  sanitizeRequestBody,
  sanitizeErrorForProduction 
} from './security';

// Request context type
export interface RequestContext {
  requestId: string;
  startTime: number;
  ip: string;
  userAgent: string;
}

// Enhanced request object
export interface EnhancedRequest extends NextRequest {
  context: RequestContext;
}

// Middleware options
export interface MiddlewareOptions {
  rateLimiter?: RateLimiterType;
  enableLogging?: boolean;
  requireAuth?: boolean;
  validateContentType?: boolean;
  enableCors?: boolean;
}

// CORS headers are now generated securely per request
// See getSecureCorsHeaders in security.ts

// Main middleware function
export function withMiddleware(
  handler: (req: EnhancedRequest, routeContext?: any) => Promise<NextResponse>,
  options: MiddlewareOptions = {}
) {
  return async (req: NextRequest, routeContext?: any): Promise<NextResponse> => {
    const timer = createTimer();
    const requestId = generateRequestId();

    // Create request context
    const context: RequestContext = {
      requestId,
      startTime: Date.now(),
      ip: getClientIp(req),
      userAgent: req.headers.get('user-agent') || ''
    };
    
    // Enhance request object
    const enhancedReq = req as EnhancedRequest;
    enhancedReq.context = context;
    
    try {
      // Handle CORS preflight
      if (req.method === 'OPTIONS' && options.enableCors) {
        const corsHeaders = getSecureCorsHeaders(req.headers.get('origin') || undefined);
        return new NextResponse(null, {
          status: 200,
          headers: corsHeaders
        });
      }
      
      // Content-Type validation
      if (options.validateContentType && req.method === 'POST') {
        const contentType = req.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          const response = errorResponse(
            'INVALID_CONTENT_TYPE',
            'Content-Type must be application/json',
            undefined,
            400,
            requestId
          );
          
          const corsHeaders = options.enableCors ? 
            getSecureCorsHeaders(req.headers.get('origin') || undefined) : {};
          
          return NextResponse.json(response, {
            status: 400,
            headers: corsHeaders
          });
        }
      }
      
      // Rate limiting (skip in test mode if SKIP_RATE_LIMITING is set)
      if (options.rateLimiter && process.env.SKIP_RATE_LIMITING !== 'true') {
        const rateLimitResult = await checkRateLimit(req, options.rateLimiter);

        if (!rateLimitResult.allowed) {
          if (options.enableLogging) {
            logger.warn('Rate limit exceeded', {
              requestId,
              ip: context.ip,
              userAgent: context.userAgent,
              path: req.nextUrl.pathname
            });
          }
          
          const response = rateLimitErrorResponse(
            rateLimitResult.resetTime!,
            requestId
          );
          
          const corsHeaders = options.enableCors ? 
            getSecureCorsHeaders(req.headers.get('origin') || undefined) : {};
          
          return NextResponse.json(response, {
            status: 429,
            headers: {
              ...getRateLimitHeaders(rateLimitResult),
              ...corsHeaders
            }
          });
        }
      }
      
      // Authentication (if required)
      if (options.requireAuth) {
        const authResult = await validateAdminAuth(req);
        if (!authResult.valid) {
          const response = errorResponse(
            'UNAUTHORIZED',
            authResult.error || 'Authentication required',
            undefined,
            401,
            requestId
          );
          
          const corsHeaders = options.enableCors ? 
            getSecureCorsHeaders(req.headers.get('origin') || undefined) : {};
          
          return NextResponse.json(response, {
            status: 401,
            headers: corsHeaders
          });
        }
        
        // Attach user info to request for downstream use
        (enhancedReq as any).user = authResult.user;
      }

      // Execute the main handler - pass routeContext for dynamic routes
      const response = await handler(enhancedReq, routeContext);

      // Add CORS headers to response
      if (options.enableCors) {
        const corsHeaders = getSecureCorsHeaders(req.headers.get('origin') || undefined);
        Object.entries(corsHeaders).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
      }
      
      // Add common response headers
      response.headers.set('X-Request-ID', requestId);
      response.headers.set('X-API-Version', '1.0.0');
      
      // Log successful request
      if (options.enableLogging) {
        const duration = timer.end();
        logRequest(req, response, duration);
      }
      
      return response;
      
    } catch (error) {
      const executionTime = timer.end();
      
      // Log error
      if (options.enableLogging) {
        logApiError(error as Error, {
          requestId,
          path: req.nextUrl.pathname,
          method: req.method,
          ip: context.ip,
          executionTime: `${executionTime}ms`
        });
      }
      
      // Return error response
      const sanitizedError = sanitizeErrorForProduction(error);
      const response = errorResponse(
        sanitizedError.code || 'INTERNAL_ERROR',
        sanitizedError.message,
        process.env.NODE_ENV !== 'production' ? { error: error.message } : undefined,
        500,
        requestId
      );
      
      const corsHeaders = options.enableCors ? 
        getSecureCorsHeaders(req.headers.get('origin') || undefined) : {};
      
      return NextResponse.json(response, {
        status: 500,
        headers: corsHeaders
      });
    }
  };
}

// Get client IP address
function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  if (realIp) {
    return realIp;
  }
  
  return req.ip || 'unknown';
}

// Auth validation is now handled by validateAdminAuth in security.ts
// This ensures constant-time comparison and JWT support

// Validation middleware for request body
export function withValidation<T>(
  validator: (data: any) => { success: boolean; data?: T; error?: any },
  handler: (req: EnhancedRequest, validatedData: T, routeContext?: any) => Promise<NextResponse>
) {
  return async (req: EnhancedRequest, routeContext?: any): Promise<NextResponse> => {
    try {
      const rawBody = await req.json();
      // Sanitize input before validation
      const body = sanitizeRequestBody(rawBody);
      const validation = validator(body);
      
      if (!validation.success) {
        const errors = validation.error?.errors?.map((err: any) => ({
          field: err.path?.join('.') || 'unknown',
          message: err.message
        })) || [{ field: 'body', message: 'Invalid request data' }];
        
        const response = errorResponse(
          'VALIDATION_ERROR',
          'Request validation failed',
          process.env.NODE_ENV !== 'production' ? { errors } : undefined,
          400,
          req.context.requestId
        );
        
        return NextResponse.json(response, { status: 400 });
      }

      return handler(req, validation.data!, routeContext);

    } catch (error) {
      const response = errorResponse(
        'INVALID_JSON',
        'Invalid JSON in request body',
        undefined,
        400,
        req.context.requestId
      );
      
      return NextResponse.json(response, { status: 400 });
    }
  };
}

// Health check middleware
export function withHealthCheck(
  handler: (req: EnhancedRequest) => Promise<NextResponse>
) {
  return async (req: EnhancedRequest): Promise<NextResponse> => {
    // Simple health check for monitoring
    if (req.nextUrl.pathname === '/health') {
      return NextResponse.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      });
    }
    
    return handler(req);
  };
}

export default withMiddleware;