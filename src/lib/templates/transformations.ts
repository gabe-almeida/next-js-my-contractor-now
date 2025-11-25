/**
 * Data Transformation Functions
 * Pure functions for transforming lead data to buyer-specific formats
 */

import { TransformFunction, TransformContext, ValidationError } from './types';

/**
 * Built-in transformation functions library
 * Each function is pure and handles type conversion, formatting, and validation
 */
export class Transformations {
  // String transformations
  static readonly string = {
    uppercase: (value: any): string => String(value).toUpperCase(),
    lowercase: (value: any): string => String(value).toLowerCase(),
    capitalize: (value: any): string => {
      const str = String(value);
      return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    },
    trim: (value: any): string => String(value).trim(),
    truncate: (maxLength: number) => (value: any): string => {
      const str = String(value);
      return str.length > maxLength ? str.slice(0, maxLength) + '...' : str;
    },
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

  // Number transformations
  static readonly number = {
    integer: (value: any): number => {
      const num = parseInt(String(value), 10);
      if (isNaN(num)) throw new ValidationError('number', 'Invalid integer format');
      return num;
    },
    float: (value: any): number => {
      const num = parseFloat(String(value));
      if (isNaN(num)) throw new ValidationError('number', 'Invalid float format');
      return num;
    },
    currency: (value: any): string => {
      const num = parseFloat(String(value));
      if (isNaN(num)) throw new ValidationError('currency', 'Invalid currency format');
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(num);
    },
    percentage: (value: any): string => {
      const num = parseFloat(String(value));
      if (isNaN(num)) throw new ValidationError('percentage', 'Invalid percentage format');
      return `${(num * 100).toFixed(2)}%`;
    },
    round: (decimals: number = 0) => (value: any): number => {
      const num = parseFloat(String(value));
      if (isNaN(num)) throw new ValidationError('number', 'Invalid number format');
      return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
    }
  };

  // Boolean transformations
  static readonly boolean = {
    yesNo: (value: any): string => {
      return this.parseBoolean(value) ? 'Yes' : 'No';
    },
    trueFalse: (value: any): string => {
      return this.parseBoolean(value) ? 'true' : 'false';
    },
    oneZero: (value: any): string => {
      return this.parseBoolean(value) ? '1' : '0';
    },
    checkboxValue: (value: any): string => {
      return this.parseBoolean(value) ? 'checked' : 'unchecked';
    }
  };

  // Date transformations
  static readonly date = {
    iso: (value: any): string => {
      const date = new Date(value);
      if (isNaN(date.getTime())) throw new ValidationError('date', 'Invalid date format');
      return date.toISOString();
    },
    timestamp: (value: any): number => {
      const date = new Date(value);
      if (isNaN(date.getTime())) throw new ValidationError('date', 'Invalid date format');
      return date.getTime();
    },
    format: (format: string) => (value: any): string => {
      const date = new Date(value);
      if (isNaN(date.getTime())) throw new ValidationError('date', 'Invalid date format');
      
      // Simple format replacements
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

  // Phone number transformations
  static readonly phone = {
    normalize: (value: any): string => {
      const digits = String(value).replace(/\D/g, '');
      if (digits.length === 10) {
        return `+1${digits}`;
      } else if (digits.length === 11 && digits.startsWith('1')) {
        return `+${digits}`;
      }
      return digits;
    },
    format: (pattern: string = '(XXX) XXX-XXXX') => (value: any): string => {
      const digits = String(value).replace(/\D/g, '');
      let formatted = pattern;
      
      for (let i = 0; i < digits.length && formatted.includes('X'); i++) {
        formatted = formatted.replace('X', digits[i]);
      }
      
      return formatted.replace(/X/g, '');
    },
    e164: (value: any): string => {
      const digits = String(value).replace(/\D/g, '');
      if (digits.length === 10) {
        return `+1${digits}`;
      } else if (digits.length === 11 && digits.startsWith('1')) {
        return `+${digits}`;
      }
      throw new ValidationError('phone', 'Invalid phone number format');
    }
  };

  // Email transformations
  static readonly email = {
    normalize: (value: any): string => {
      return String(value).toLowerCase().trim();
    },
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

  // Address transformations
  static readonly address = {
    zipCode: (value: any): string => {
      const zip = String(value).replace(/\D/g, '');
      if (zip.length === 5) return zip;
      if (zip.length === 9) return `${zip.slice(0, 5)}-${zip.slice(5)}`;
      throw new ValidationError('zipCode', 'Invalid ZIP code format');
    },
    state: (value: any): string => {
      const state = String(value).toUpperCase().trim();
      // Add state code validation if needed
      return state;
    },
    fullAddress: (parts: string[]) => (): string => {
      return parts.filter(part => part && part.trim()).join(', ');
    }
  };

  // Array transformations
  static readonly array = {
    join: (separator: string = ',') => (value: any): string => {
      if (!Array.isArray(value)) return String(value);
      return value.join(separator);
    },
    first: (value: any): any => {
      if (!Array.isArray(value)) return value;
      return value[0];
    },
    last: (value: any): any => {
      if (!Array.isArray(value)) return value;
      return value[value.length - 1];
    },
    count: (value: any): number => {
      if (!Array.isArray(value)) return 0;
      return value.length;
    }
  };

  // Service-specific transformations
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
      
      const timeframeMap: Record<string, string> = {
        'asap': 'ASAP',
        'immediately': 'ASAP', 
        'within_week': 'Within 1 week',
        'within_month': 'Within 1 month',
        'within_3_months': 'Within 3 months',
        'within_6_months': 'Within 6 months',
        'no_rush': 'No rush',
        'planning': 'Just planning'
      };
      
      return timeframeMap[timeframe] || timeframe;
    },
    
    homeOwnership: (value: any): string => {
      const owns = this.parseBoolean(value);
      return owns ? 'Own' : 'Rent';
    }
  };

  // Compliance transformations
  static readonly compliance = {
    tcpaConsent: (value: any): string => {
      return this.parseBoolean(value) ? 'Yes' : 'No';
    },
    
    privacyConsent: (value: any): string => {
      return this.parseBoolean(value) ? 'Accepted' : 'Declined';
    },
    
    leadSource: (context?: TransformContext): string => {
      return context?.metadata?.source || 'web_form';
    },
    
    userAgent: (context?: TransformContext): string => {
      return context?.lead?.complianceData?.userAgent || 'Unknown';
    },
    
    ipAddress: (context?: TransformContext): string => {
      return context?.lead?.complianceData?.ipAddress || 'Unknown';
    }
  };

  // Conditional transformations
  static readonly conditional = {
    ifElse: (condition: any, trueValue: any, falseValue: any) => (value: any): any => {
      return this.parseBoolean(condition) ? trueValue : falseValue;
    },
    
    switch: (cases: Record<string, any>, defaultValue: any = null) => (value: any): any => {
      const stringValue = String(value);
      return cases[stringValue] !== undefined ? cases[stringValue] : defaultValue;
    },
    
    range: (ranges: Array<{min?: number, max?: number, value: any}>) => (value: any): any => {
      const numValue = parseFloat(String(value));
      if (isNaN(numValue)) return null;
      
      for (const range of ranges) {
        const minCheck = range.min === undefined || numValue >= range.min;
        const maxCheck = range.max === undefined || numValue <= range.max;
        
        if (minCheck && maxCheck) {
          return range.value;
        }
      }
      
      return null;
    }
  };

  // Utility functions
  private static parseBoolean(value: any): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    
    const stringValue = String(value).toLowerCase().trim();
    return ['true', 'yes', 'y', '1', 'on', 'checked'].includes(stringValue);
  }

  /**
   * Get transformation function by name
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
   */
  static applyTransform(
    value: any,
    transform: string | TransformFunction,
    context?: TransformContext
  ): any {
    try {
      if (typeof transform === 'string') {
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

  /**
   * Create custom transformation function
   */
  static createCustomTransform(
    name: string,
    fn: TransformFunction
  ): void {
    // Store custom transformations in a registry
    if (!this.customTransforms) {
      this.customTransforms = new Map();
    }
    this.customTransforms.set(name, fn);
  }

  private static customTransforms?: Map<string, TransformFunction>;

  /**
   * Get custom transformation function
   */
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

// Default transformation exports for convenience
export const transforms = Transformations;
export default Transformations;