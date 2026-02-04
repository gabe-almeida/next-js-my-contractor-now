/**
 * Sentry utilities for error reporting in API routes and server-side code
 *
 * WHY: API routes with try/catch blocks swallow errors - they return JSON
 *      responses but don't report to Sentry unless explicitly captured.
 *
 * WHEN: Use captureApiError() in catch blocks of API routes
 *
 * HOW:
 *   import { captureApiError } from '@/lib/sentry';
 *
 *   try {
 *     // ... your code
 *   } catch (error) {
 *     captureApiError(error, { route: '/api/leads', action: 'create' });
 *     return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
 *   }
 */

import * as Sentry from '@sentry/nextjs';

/**
 * Capture an error from an API route with context
 */
export function captureApiError(
  error: unknown,
  context?: {
    route?: string;
    action?: string;
    userId?: string;
    extra?: Record<string, unknown>;
  }
): void {
  Sentry.withScope((scope) => {
    if (context?.route) {
      scope.setTag('api.route', context.route);
    }
    if (context?.action) {
      scope.setTag('api.action', context.action);
    }
    if (context?.userId) {
      scope.setUser({ id: context.userId });
    }
    if (context?.extra) {
      scope.setExtras(context.extra);
    }

    Sentry.captureException(error);
  });
}

/**
 * Capture a message/warning (non-error) to Sentry
 */
export function captureMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  extra?: Record<string, unknown>
): void {
  Sentry.withScope((scope) => {
    if (extra) {
      scope.setExtras(extra);
    }
    Sentry.captureMessage(message, level);
  });
}

/**
 * Set user context for all subsequent Sentry events
 */
export function setUser(user: { id: string; email?: string; username?: string } | null): void {
  Sentry.setUser(user);
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, unknown>
): void {
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level: 'info',
  });
}

/**
 * Check if a buyer API response indicates an actual error vs normal rejection
 *
 * WHY: Distinguish between API/system errors (should alert) vs business rejections (normal)
 * WHEN: After receiving PING/POST responses from buyers
 * HOW: Check for error indicators in response (status=ERROR, non-zero code, error keywords)
 *
 * ACTUAL ERRORS (should trigger Sentry):
 * - status: "ERROR", "error", "FAILED"
 * - code: any non-zero value (1001, 1003, 1033, etc.)
 * - messages containing: "Missing required", "wrong format", "wrong value", "invalid field"
 *
 * NORMAL REJECTIONS (just breadcrumbs, no alert):
 * - status: "rejected", "REJECTED"
 * - messages: "No Matches", "Vendors rejected", "no buyers available"
 */
export function isBuyerApiError(response: Record<string, unknown>): boolean {
  const status = String(response.status || '').toLowerCase();
  const code = response.code;
  // Handle error as string, object with message, or boolean
  const errorField = response.error;
  const errorMessage = typeof errorField === 'object' && errorField !== null
    ? String((errorField as Record<string, unknown>).message || '')
    : String(errorField || '');
  const message = String(response.message || errorMessage || '').toLowerCase();

  // Error status indicators
  if (status === 'error' || status === 'failed') {
    return true;
  }

  // Error object present (e.g., { error: { message: "Bad Request" } })
  if (typeof response.error === 'object' && response.error !== null) {
    return true;
  }

  // Non-zero error code (most buyer APIs use 0 for success)
  if (code !== undefined && code !== null && code !== 0) {
    return true;
  }

  // Error keywords in message (API/config problems, not business rejections)
  const errorKeywords = [
    'missing required',
    'wrong format',
    'wrong value',
    'invalid field',
    'invalid parameter',
    'unauthorized',
    'authentication failed',
    'internal error',
    'server error',
    'exception',
  ];

  if (errorKeywords.some(keyword => message.includes(keyword))) {
    return true;
  }

  return false;
}

/**
 * Report a buyer API error to Sentry
 *
 * WHY: Track configuration/API issues that need fixing (vs normal rejections)
 * WHEN: When isBuyerApiError() returns true
 * HOW: Capture as warning with full context for debugging
 */
export function reportBuyerApiError(
  actionType: 'PING' | 'POST',
  buyerId: string,
  buyerName: string,
  leadId: string,
  response: Record<string, unknown>,
  extra?: Record<string, unknown>
): void {
  const message = `Buyer API Error: ${buyerName} ${actionType} - ${response.message || response.error || response.status}`;

  Sentry.withScope((scope) => {
    scope.setTag('buyer.id', buyerId);
    scope.setTag('buyer.name', buyerName);
    scope.setTag('action.type', actionType);
    scope.setTag('error.type', 'buyer_api_error');
    scope.setExtras({
      leadId,
      responseStatus: response.status,
      responseCode: response.code,
      responseMessage: response.message || response.error,
      ...extra,
    });

    Sentry.captureMessage(message, 'warning');
  });
}
