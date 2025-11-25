import { FieldMapping, TransformationType, MappingCondition } from '@/types/database';
import { AppError } from '@/lib/utils';

export class TemplateEngine {
  /**
   * Transform data using field mappings
   */
  static transform(data: any, mappings: FieldMapping[]): any {
    const result: any = {};
    
    for (const mapping of mappings) {
      try {
        // Check if mapping condition is met
        if (mapping.condition && !this.evaluateCondition(data, mapping.condition)) {
          continue;
        }

        let value = this.getNestedValue(data, mapping.sourceField);
        
        // Handle missing values
        if (value === undefined || value === null) {
          if (mapping.defaultValue !== undefined) {
            value = mapping.defaultValue;
          } else if (mapping.required) {
            throw new AppError(
              `Required field ${mapping.sourceField} is missing`,
              400
            );
          } else {
            continue;
          }
        }
        
        // Apply transformations
        if (mapping.transform) {
          value = this.applyTransform(value, mapping.transform);
        }
        
        // Set the transformed value
        this.setNestedValue(result, mapping.targetField, value);
        
      } catch (error) {
        console.error(`Error processing mapping ${mapping.sourceField} -> ${mapping.targetField}:`, error);
        if (mapping.required) {
          throw error;
        }
      }
    }
    
    return result;
  }

  /**
   * Get value from nested object using dot notation
   */
  private static getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * Set value in nested object using dot notation
   */
  private static setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    
    const target = keys.reduce((current, key) => {
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      return current[key];
    }, obj);
    
    target[lastKey] = value;
  }

  /**
   * Apply transformation to value
   */
  private static applyTransform(value: any, transform: TransformationType): any {
    switch (transform) {
      case 'uppercase':
        return String(value).toUpperCase();
        
      case 'lowercase':
        return String(value).toLowerCase();
        
      case 'number':
        return Number(value);
        
      case 'boolean':
        return Boolean(value);
        
      case 'date':
        return new Date(value).toISOString();
        
      case 'phone':
        return this.formatPhone(String(value));
        
      case 'email':
        return String(value).toLowerCase().trim();
        
      default:
        // Custom transform functions
        return this.customTransforms[transform]?.(value) ?? value;
    }
  }

  /**
   * Evaluate mapping condition
   */
  private static evaluateCondition(data: any, condition: MappingCondition): boolean {
    const fieldValue = this.getNestedValue(data, condition.field);
    
    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value;
        
      case 'not_equals':
        return fieldValue !== condition.value;
        
      case 'contains':
        return String(fieldValue).toLowerCase().includes(String(condition.value).toLowerCase());
        
      case 'exists':
        return fieldValue !== undefined && fieldValue !== null && fieldValue !== '';
        
      default:
        return false;
    }
  }

  /**
   * Format phone number
   */
  private static formatPhone(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    
    return phone; // Return original if can't format
  }

  /**
   * Custom transform functions for specific use cases
   */
  private static customTransforms: Record<string, (value: any) => any> = {
    // Windows-specific transforms
    windowsCount: (value: string): string => {
      const mapping: Record<string, string> = {
        '1-3': '1-3',
        '4-6': '4-6',
        '7-10': '6-10',
        '11-15': '10+',
        '16+': '10+'
      };
      return mapping[value] || value;
    },

    windowsCountNumeric: (value: string): number => {
      const mapping: Record<string, number> = {
        '1-3': 2,
        '4-6': 5,
        '7-10': 8,
        '11-15': 13,
        '16+': 20
      };
      return mapping[value] || 1;
    },

    // Bathroom-specific transforms
    bathroomCount: (value: string): number => {
      const match = value.match(/(\d+)/);
      return match ? parseInt(match[1]) : 1;
    },

    bathroomCountString: (value: string): string => {
      const mapping: Record<string, string> = {
        '1': 'One',
        '2': 'Two',
        '3': 'Three',
        '4+': 'Four or More'
      };
      return mapping[value] || value;
    },

    // Roofing-specific transforms
    roofTypeCode: (value: string): string => {
      const mapping: Record<string, string> = {
        'asphalt_shingles': 'ASPH',
        'metal': 'METAL',
        'tile': 'TILE',
        'slate': 'SLATE',
        'flat': 'FLAT',
        'other': 'OTHER'
      };
      return mapping[value] || 'OTHER';
    },

    urgencyLevel: (value: string): number => {
      const mapping: Record<string, number> = {
        'emergency': 1,
        'immediate': 2,
        'within_1_month': 3,
        '1_3_months': 4,
        '3_6_months': 5,
        'planning_phase': 6
      };
      return mapping[value] || 5;
    },

    // Budget range transforms
    budgetMin: (value: string): number => {
      const mapping: Record<string, number> = {
        'under_5k': 0,
        '5k_15k': 5000,
        '15k_30k': 15000,
        'over_30k': 30000,
        'under_10k': 0,
        '10k_25k': 10000,
        '25k_50k': 25000,
        'over_50k': 50000
      };
      return mapping[value] || 0;
    },

    budgetMax: (value: string): number => {
      const mapping: Record<string, number> = {
        'under_5k': 5000,
        '5k_15k': 15000,
        '15k_30k': 30000,
        'over_30k': 100000,
        'under_10k': 10000,
        '10k_25k': 25000,
        '25k_50k': 50000,
        'over_50k': 200000
      };
      return mapping[value] || 100000;
    },

    // Homeowner boolean transforms
    homeownerYesNo: (value: boolean): string => {
      return value ? 'Yes' : 'No';
    },

    homeownerNumeric: (value: boolean): number => {
      return value ? 1 : 0;
    },

    // ZIP code transforms
    zipCodeOnly: (value: string): string => {
      return value.split('-')[0]; // Remove ZIP+4 extension
    },

    // Name transforms
    fullName: (value: any): string => {
      if (typeof value === 'object' && value.firstName && value.lastName) {
        return `${value.firstName} ${value.lastName}`;
      }
      return String(value);
    },

    firstName: (value: any): string => {
      if (typeof value === 'object' && value.firstName) {
        return value.firstName;
      }
      return String(value).split(' ')[0] || '';
    },

    lastName: (value: any): string => {
      if (typeof value === 'object' && value.lastName) {
        return value.lastName;
      }
      const parts = String(value).split(' ');
      return parts.length > 1 ? parts[parts.length - 1] : '';
    },

    // Array to string transforms
    arrayToCommaSeparated: (value: any[]): string => {
      return Array.isArray(value) ? value.join(', ') : String(value);
    },

    arrayToSemicolonSeparated: (value: any[]): string => {
      return Array.isArray(value) ? value.join('; ') : String(value);
    },

    arrayFirst: (value: any[]): any => {
      return Array.isArray(value) ? value[0] : value;
    },

    arrayLength: (value: any[]): number => {
      return Array.isArray(value) ? value.length : 0;
    },

    // Time and date transforms
    timestampISO: (): string => {
      return new Date().toISOString();
    },

    timestampUnix: (): number => {
      return Math.floor(Date.now() / 1000);
    },

    dateOnly: (value: any): string => {
      return new Date(value).toISOString().split('T')[0];
    },

    // Compliance transforms
    tcpaConsentText: (consented: boolean): string => {
      return consented 
        ? 'I consent to receive marketing communications'
        : 'I do not consent to receive marketing communications';
    },

    complianceScore: (data: any): number => {
      let score = 0;
      
      if (data.trustedFormCertUrl) score += 40;
      if (data.jornayaLeadId) score += 30;
      if (data.tcpaConsent) score += 30;
      
      return score;
    }
  };

  /**
   * Add custom transform function
   */
  static addCustomTransform(name: string, transformFn: (value: any) => any): void {
    this.customTransforms[name] = transformFn;
  }

  /**
   * Validate template mappings
   */
  static validateMappings(mappings: FieldMapping[]): string[] {
    const errors: string[] = [];
    
    for (const mapping of mappings) {
      if (!mapping.sourceField) {
        errors.push('Missing sourceField in mapping');
      }
      
      if (!mapping.targetField) {
        errors.push('Missing targetField in mapping');
      }
      
      if (mapping.transform && 
          mapping.transform !== 'uppercase' &&
          mapping.transform !== 'lowercase' &&
          mapping.transform !== 'number' &&
          mapping.transform !== 'boolean' &&
          mapping.transform !== 'date' &&
          mapping.transform !== 'phone' &&
          mapping.transform !== 'email' &&
          !this.customTransforms[mapping.transform]) {
        errors.push(`Unknown transform function: ${mapping.transform}`);
      }
    }
    
    return errors;
  }

  /**
   * Preview transformation result
   */
  static preview(data: any, mappings: FieldMapping[]): {
    result: any;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    let result: any = {};
    
    try {
      const validationErrors = this.validateMappings(mappings);
      errors.push(...validationErrors);
      
      if (errors.length === 0) {
        result = this.transform(data, mappings);
      }
      
      // Check for potential issues
      for (const mapping of mappings) {
        const value = this.getNestedValue(data, mapping.sourceField);
        
        if (value === undefined || value === null) {
          if (mapping.required) {
            errors.push(`Required field ${mapping.sourceField} is missing`);
          } else if (!mapping.defaultValue) {
            warnings.push(`Field ${mapping.sourceField} is missing and no default value provided`);
          }
        }
      }
      
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown transformation error');
    }
    
    return { result, errors, warnings };
  }
}