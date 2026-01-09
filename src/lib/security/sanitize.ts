/**
 * Input Sanitization Utilities
 *
 * WHY: Prevents XSS attacks by sanitizing user input
 * WHEN: Used when processing any user-submitted form data
 * HOW: Uses a server-safe approach that escapes HTML entities
 */

/**
 * Escape HTML entities to prevent XSS
 * This is a server-safe implementation that doesn't rely on DOM
 */
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Sanitize HTML content to prevent XSS
 */
export function sanitizeHtml(dirty: string): string {
  return escapeHtml(dirty);
}

/**
 * Sanitize object recursively
 */
export function sanitizeObject(obj: any): any {
  if (typeof obj === 'string') {
    return sanitizeHtml(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  if (obj && typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  }

  return obj;
}

/**
 * Sanitize form data
 */
export function sanitizeFormData(formData: Record<string, any>): Record<string, any> {
  return sanitizeObject(formData);
}
