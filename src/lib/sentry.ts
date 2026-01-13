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
