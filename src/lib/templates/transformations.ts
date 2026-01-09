/**
 * Data Transformation Functions
 *
 * WHY: Transform lead data to buyer-specific formats for PING/POST
 * WHEN: Called by TemplateEngine during payload generation
 * HOW: Delegates common transforms to @/lib/transforms/shared.ts (SINGLE SOURCE OF TRUTH)
 *      and provides EXTRA transforms not in shared module
 *
 * ARCHITECTURE:
 * - Common transforms (boolean, string, phone, date, number) → shared.ts
 * - Extra transforms (email, address, array, service, compliance, conditional) → here
 *
 * This ensures preview and auction engine produce IDENTICAL results.
 */

import { TransformFunction, TransformContext, ValidationError } from './types';

// Import shared transforms - SINGLE SOURCE OF TRUTH
import { executeTransform as sharedExecuteTransform, toBoolean } from '@/lib/transforms/shared';

// ============================================================================
// SHARED TRANSFORM IDs
// These are handled by @/lib/transforms/shared.ts - DO NOT duplicate here!
// ============================================================================
const SHARED_TRANSFORMS = new Set([
  // Boolean
  'boolean.yesNo', 'boolean.yesNoLower', 'boolean.YN', 'boolean.oneZero', 'boolean.truefalse',
  // String
  'string.uppercase', 'string.lowercase', 'string.titlecase', 'string.trim',
  'string.truncate50', 'string.truncate100', 'string.truncate255',
  // Phone
  'phone.digitsOnly', 'phone.e164', 'phone.dashed', 'phone.dotted', 'phone.parentheses',
  // Date
  'date.isoDate', 'date.usDate', 'date.usDateShort', 'date.timestamp', 'date.timestampMs', 'date.iso8601',
  // Number
  'number.integer', 'number.round', 'number.twoDecimals', 'number.currency', 'number.percentage'
]);

/**
 * Transformation functions library
 *
 * NOTE: Common transforms delegate to shared.ts for DRY code.
 * This class only contains EXTRA transforms not in the shared module.
 */
export class Transformations {
  // ============================================================================
  // EXTRA STRING TRANSFORMS (not in shared module)
  // ============================================================================
  static readonly string = {
    slugify: (value: any): string => {
      return String(value)
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
    },
    removeSpecialChars: (value: any): string => {
      return String(value).replace(/[^a-zA-Z0-9\s]/g, '');
    }
  };

  // ============================================================================
  // EXTRA NUMBER TRANSFORMS (not in shared module)
  // ============================================================================
  static readonly number = {
    float: (value: any): number => {
      const num = parseFloat(String(value));
      if (isNaN(num)) throw new ValidationError('number', 'Invalid float format');
      return num;
    }
  };

  // ============================================================================
  // EXTRA DATE TRANSFORMS (not in shared module)
  // ============================================================================
  static readonly date = {
    format: (format: string) => (value: any): string => {
      const date = new Date(value);
      if (isNaN(date.getTime())) throw new ValidationError('date', 'Invalid date format');

      return format
        .replace('YYYY', date.getFullYear().toString())
        .replace('MM', String(date.getMonth() + 1).padStart(2, '0'))
        .replace('DD', String(date.getDate()).padStart(2, '0'))
        .replace('HH', String(date.getHours()).padStart(2, '0'))
        .replace('mm', String(date.getMinutes()).padStart(2, '0'))
        .replace('ss', String(date.getSeconds()).padStart(2, '0'));
    },
    relative: (value: any): string => {
      const date = new Date(value);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
      return `${Math.floor(diffDays / 30)} months ago`;
    }
  };

  // ============================================================================
  // EXTRA PHONE TRANSFORMS (not in shared module)
  // ============================================================================
  static readonly phone = {
    normalize: (value: any): string => {
      const digits = String(value).replace(/\D/g, '');
      if (digits.length === 10) return `+1${digits}`;
      if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
      return digits;
    },
    format: (pattern: string = '(XXX) XXX-XXXX') => (value: any): string => {
      const digits = String(value).replace(/\D/g, '');
      let formatted = pattern;
      for (let i = 0; i < digits.length && formatted.includes('X'); i++) {
        formatted = formatted.replace('X', digits[i]);
      }
      return formatted.replace(/X/g, '');
    }
  };

  // ============================================================================
  // EMAIL TRANSFORMS (not in shared module)
  // ============================================================================
  static readonly email = {
    normalize: (value: any): string => String(value).toLowerCase().trim(),
    domain: (value: any): string => {
      const email = String(value);
      const atIndex = email.lastIndexOf('@');
      if (atIndex === -1) throw new ValidationError('email', 'Invalid email format');
      return email.substring(atIndex + 1);
    },
    localPart: (value: any): string => {
      const email = String(value);
      const atIndex = email.lastIndexOf('@');
      if (atIndex === -1) throw new ValidationError('email', 'Invalid email format');
      return email.substring(0, atIndex);
    }
  };

  // ============================================================================
  // ADDRESS TRANSFORMS (not in shared module)
  // ============================================================================
  static readonly address = {
    zipCode: (value: any): string => {
      const zip = String(value).replace(/\D/g, '');
      if (zip.length === 5) return zip;
      if (zip.length === 9) return `${zip.slice(0, 5)}-${zip.slice(5)}`;
      throw new ValidationError('zipCode', 'Invalid ZIP code format');
    },
    state: (value: any): string => String(value).toUpperCase().trim(),
    fullAddress: (parts: string[]) => (): string => {
      return parts.filter(part => part && part.trim()).join(', ');
    }
  };

  // ============================================================================
  // ARRAY TRANSFORMS (not in shared module)
  // ============================================================================
  static readonly array = {
    join: (separator: string = ',') => (value: any): string => {
      if (!Array.isArray(value)) return String(value);
      return value.join(separator);
    },
    first: (value: any): any => Array.isArray(value) ? value[0] : value,
    last: (value: any): any => Array.isArray(value) ? value[value.length - 1] : value,
    count: (value: any): number => Array.isArray(value) ? value.length : 0
  };

  // ============================================================================
  // SERVICE-SPECIFIC TRANSFORMS (not in shared module)
  // ============================================================================
  static readonly service = {
    windowsCount: (value: any): string => {
      const count = parseInt(String(value), 10);
      if (isNaN(count)) return 'Unknown';
      if (count === 1) return '1 window';
      if (count <= 5) return '2-5 windows';
      if (count <= 10) return '6-10 windows';
      if (count <= 20) return '11-20 windows';
      return '20+ windows';
    },
    bathroomCount: (value: any): string => {
      const count = parseInt(String(value), 10);
      if (isNaN(count)) return 'Unknown';
      if (count === 1) return '1 bathroom';
      if (count <= 2) return '2 bathrooms';
      if (count <= 3) return '3 bathrooms';
      return '4+ bathrooms';
    },
    roofingSquareFootage: (value: any): string => {
      const sqft = parseInt(String(value), 10);
      if (isNaN(sqft)) return 'Unknown';
      if (sqft < 1000) return 'Small (under 1,000 sq ft)';
      if (sqft < 2000) return 'Medium (1,000-2,000 sq ft)';
      if (sqft < 3000) return 'Large (2,000-3,000 sq ft)';
      return 'Very Large (3,000+ sq ft)';
    },
    projectTimeframe: (value: any): string => {
      const timeframe = String(value).toLowerCase();
      const map: Record<string, string> = {
        'asap': 'ASAP',
        'immediately': 'ASAP',
        'within_week': 'Within 1 week',
        'within_month': 'Within 1 month',
        'within_3_months': 'Within 3 months',
        'within_6_months': 'Within 6 months',
        'no_rush': 'No rush',
        'planning': 'Just planning'
      };
      return map[timeframe] || timeframe;
    },
    homeOwnership: (value: any): string => toBoolean(value) ? 'Own' : 'Rent'
  };

  // ============================================================================
  // COMPLIANCE TRANSFORMS (not in shared module)
  // ============================================================================
  static readonly compliance = {
    tcpaConsent: (value: any): string => toBoolean(value) ? 'Yes' : 'No',
    privacyConsent: (value: any): string => toBoolean(value) ? 'Accepted' : 'Declined',
    leadSource: (context?: TransformContext): string => context?.metadata?.source || 'web_form',
    userAgent: (context?: TransformContext): string => context?.lead?.complianceData?.userAgent || 'Unknown',
    ipAddress: (context?: TransformContext): string => context?.lead?.complianceData?.ipAddress || 'Unknown'
  };

  // ============================================================================
  // CONDITIONAL TRANSFORMS (not in shared module)
  // ============================================================================
  static readonly conditional = {
    ifElse: (condition: any, trueValue: any, falseValue: any) => (): any => {
      return toBoolean(condition) ? trueValue : falseValue;
    },
    switch: (cases: Record<string, any>, defaultValue: any = null) => (value: any): any => {
      const stringValue = String(value);
      return cases[stringValue] !== undefined ? cases[stringValue] : defaultValue;
    },
    range: (ranges: Array<{ min?: number; max?: number; value: any }>) => (value: any): any => {
      const numValue = parseFloat(String(value));
      if (isNaN(numValue)) return null;
      for (const range of ranges) {
        const minCheck = range.min === undefined || numValue >= range.min;
        const maxCheck = range.max === undefined || numValue <= range.max;
        if (minCheck && maxCheck) return range.value;
      }
      return null;
    }
  };

  /**
   * Get transformation function by name (for extra transforms only)
   */
  static getTransform(transformName: string): TransformFunction {
    const parts = transformName.split('.');
    let current: any = Transformations;

    for (const part of parts) {
      if (current[part] === undefined) {
        throw new Error(`Unknown transformation: ${transformName}`);
      }
      current = current[part];
    }

    if (typeof current !== 'function') {
      throw new Error(`Invalid transformation: ${transformName} is not a function`);
    }

    return current as TransformFunction;
  }

  /**
   * Apply transformation with error handling
   *
   * WHY: Single entry point for all transforms in auction engine
   * WHEN: Called by TemplateEngine.applyTransformation()
   * HOW: Delegates to shared module first, falls back to class for extras
   *
   * CRITICAL: Common transforms use sharedExecuteTransform to ensure
   * preview and auction produce IDENTICAL results.
   */
  static applyTransform(
    value: any,
    transform: string | TransformFunction,
    context?: TransformContext
  ): any {
    try {
      if (typeof transform === 'string') {
        // Check if it's a shared transform (SINGLE SOURCE OF TRUTH)
        if (SHARED_TRANSFORMS.has(transform)) {
          return sharedExecuteTransform(transform, value);
        }

        // Fall back to class-based transforms for extras
        const transformFn = this.getTransform(transform);
        return transformFn(value, context);
      } else {
        return transform(value, context);
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError(
        'transform',
        `Transformation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { transform, value, context }
      );
    }
  }

  private static customTransforms?: Map<string, TransformFunction>;

  static createCustomTransform(name: string, fn: TransformFunction): void {
    if (!this.customTransforms) this.customTransforms = new Map();
    this.customTransforms.set(name, fn);
  }

  static getCustomTransform(name: string): TransformFunction | undefined {
    return this.customTransforms?.get(name);
  }
}

/**
 * Transformation registry for dynamic lookup
 */
export class TransformRegistry {
  private static registry = new Map<string, TransformFunction>();

  static register(name: string, transform: TransformFunction): void {
    this.registry.set(name, transform);
  }

  static get(name: string): TransformFunction | undefined {
    return this.registry.get(name);
  }

  static has(name: string): boolean {
    return this.registry.has(name);
  }

  static list(): string[] {
    return Array.from(this.registry.keys());
  }

  static clear(): void {
    this.registry.clear();
  }
}

export const transforms = Transformations;
export default Transformations;
