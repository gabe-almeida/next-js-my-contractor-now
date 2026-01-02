/**
 * Unit Tests: Transforms Registry
 *
 * WHY: Verify transform definitions and execution logic
 * WHEN: After transforms.ts is implemented
 * HOW: Test registry functions and all transform implementations
 */

import { describe, test, expect } from '@jest/globals';
import {
  AVAILABLE_TRANSFORMS,
  getTransformsForType,
  getTransformsByCategory,
  getTransformById,
  TRANSFORM_CATEGORY_LABELS,
  executeTransform,
} from '@/lib/field-mapping/transforms';

describe('Transforms Registry', () => {
  describe('AVAILABLE_TRANSFORMS', () => {
    test('should have at least 15 transforms defined', () => {
      expect(AVAILABLE_TRANSFORMS.length).toBeGreaterThanOrEqual(15);
    });

    test('all transforms should have required properties', () => {
      AVAILABLE_TRANSFORMS.forEach((transform) => {
        expect(transform).toHaveProperty('id');
        expect(transform).toHaveProperty('name');
        expect(transform).toHaveProperty('description');
        expect(transform).toHaveProperty('category');
        expect(transform).toHaveProperty('example');
        expect(transform).toHaveProperty('acceptsTypes');
        expect(Array.isArray(transform.acceptsTypes)).toBe(true);
        expect(transform.acceptsTypes.length).toBeGreaterThan(0);
      });
    });

    test('all transforms should have unique IDs', () => {
      const ids = AVAILABLE_TRANSFORMS.map((t) => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    test('all transforms should have examples with input and output', () => {
      AVAILABLE_TRANSFORMS.forEach((transform) => {
        expect(transform.example).toHaveProperty('input');
        expect(transform.example).toHaveProperty('output');
      });
    });

    test('should include boolean transforms', () => {
      const booleanTransforms = AVAILABLE_TRANSFORMS.filter((t) => t.category === 'boolean');
      expect(booleanTransforms.length).toBeGreaterThan(0);

      const ids = booleanTransforms.map((t) => t.id);
      expect(ids).toContain('boolean.yesNo');
      expect(ids).toContain('boolean.oneZero');
    });

    test('should include phone transforms', () => {
      const phoneTransforms = AVAILABLE_TRANSFORMS.filter((t) => t.category === 'phone');
      expect(phoneTransforms.length).toBeGreaterThan(0);

      const ids = phoneTransforms.map((t) => t.id);
      expect(ids).toContain('phone.e164');
      expect(ids).toContain('phone.digitsOnly');
    });

    test('should include date transforms', () => {
      const dateTransforms = AVAILABLE_TRANSFORMS.filter((t) => t.category === 'date');
      expect(dateTransforms.length).toBeGreaterThan(0);

      const ids = dateTransforms.map((t) => t.id);
      expect(ids).toContain('date.isoDate');
      expect(ids).toContain('date.usDate');
    });
  });

  describe('getTransformsForType', () => {
    test('should return transforms for boolean type', () => {
      const transforms = getTransformsForType('boolean');
      expect(transforms.length).toBeGreaterThan(0);
      expect(transforms.every((t) => t.acceptsTypes.includes('boolean'))).toBe(true);
    });

    test('should return transforms for string type', () => {
      const transforms = getTransformsForType('string');
      expect(transforms.length).toBeGreaterThan(0);
      expect(transforms.every((t) => t.acceptsTypes.includes('string'))).toBe(true);
    });

    test('should return transforms for phone type', () => {
      const transforms = getTransformsForType('phone');
      expect(transforms.length).toBeGreaterThan(0);
      expect(transforms.every((t) => t.acceptsTypes.includes('phone'))).toBe(true);
    });

    test('should return transforms for number type', () => {
      const transforms = getTransformsForType('number');
      expect(transforms.length).toBeGreaterThan(0);
      expect(transforms.every((t) => t.acceptsTypes.includes('number'))).toBe(true);
    });

    test('should return empty array for unknown type', () => {
      const transforms = getTransformsForType('unknown-type' as never);
      expect(transforms).toEqual([]);
    });
  });

  describe('getTransformsByCategory', () => {
    test('should return transforms grouped by category', () => {
      const grouped = getTransformsByCategory();

      expect(grouped).toHaveProperty('boolean');
      expect(grouped).toHaveProperty('string');
      expect(grouped).toHaveProperty('number');
      expect(grouped).toHaveProperty('date');
      expect(grouped).toHaveProperty('phone');
      expect(grouped).toHaveProperty('service');
    });

    test('should have transforms in each non-empty category', () => {
      const grouped = getTransformsByCategory();

      expect(grouped.boolean.length).toBeGreaterThan(0);
      expect(grouped.string.length).toBeGreaterThan(0);
      expect(grouped.phone.length).toBeGreaterThan(0);
      expect(grouped.date.length).toBeGreaterThan(0);
    });

    test('transforms in category should match category property', () => {
      const grouped = getTransformsByCategory();

      Object.entries(grouped).forEach(([category, transforms]) => {
        transforms.forEach((transform) => {
          expect(transform.category).toBe(category);
        });
      });
    });
  });

  describe('getTransformById', () => {
    test('should find existing transform', () => {
      const transform = getTransformById('boolean.yesNo');
      expect(transform).toBeDefined();
      expect(transform?.id).toBe('boolean.yesNo');
      expect(transform?.name).toBe('Yes/No');
    });

    test('should return undefined for non-existent transform', () => {
      const transform = getTransformById('nonexistent.transform');
      expect(transform).toBeUndefined();
    });

    test('should find all registered transforms', () => {
      AVAILABLE_TRANSFORMS.forEach((t) => {
        const found = getTransformById(t.id);
        expect(found).toBeDefined();
        expect(found?.id).toBe(t.id);
      });
    });
  });

  describe('TRANSFORM_CATEGORY_LABELS', () => {
    test('should have labels for all categories', () => {
      expect(TRANSFORM_CATEGORY_LABELS).toHaveProperty('boolean');
      expect(TRANSFORM_CATEGORY_LABELS).toHaveProperty('string');
      expect(TRANSFORM_CATEGORY_LABELS).toHaveProperty('number');
      expect(TRANSFORM_CATEGORY_LABELS).toHaveProperty('date');
      expect(TRANSFORM_CATEGORY_LABELS).toHaveProperty('phone');
      expect(TRANSFORM_CATEGORY_LABELS).toHaveProperty('service');
    });

    test('labels should be non-empty strings', () => {
      Object.values(TRANSFORM_CATEGORY_LABELS).forEach((label) => {
        expect(typeof label).toBe('string');
        expect(label.length).toBeGreaterThan(0);
      });
    });
  });
});

describe('Transform Execution', () => {
  describe('Null/Undefined Handling', () => {
    test('should return null for null input', () => {
      expect(executeTransform('boolean.yesNo', null)).toBeNull();
      expect(executeTransform('string.uppercase', null)).toBeNull();
      expect(executeTransform('phone.e164', null)).toBeNull();
    });

    test('should return null for undefined input', () => {
      expect(executeTransform('boolean.yesNo', undefined)).toBeNull();
      expect(executeTransform('string.uppercase', undefined)).toBeNull();
    });
  });

  describe('Unknown Transform', () => {
    test('should return original value for unknown transform', () => {
      const value = 'test value';
      expect(executeTransform('unknown.transform', value)).toBe(value);
    });
  });

  describe('Boolean Transforms', () => {
    test('boolean.yesNo should convert to Yes/No', () => {
      expect(executeTransform('boolean.yesNo', true)).toBe('Yes');
      expect(executeTransform('boolean.yesNo', false)).toBe('No');
      expect(executeTransform('boolean.yesNo', 'true')).toBe('Yes');
      expect(executeTransform('boolean.yesNo', 'false')).toBe('No');
      expect(executeTransform('boolean.yesNo', 'yes')).toBe('Yes');
      expect(executeTransform('boolean.yesNo', 'no')).toBe('No');
      expect(executeTransform('boolean.yesNo', 1)).toBe('Yes');
      expect(executeTransform('boolean.yesNo', 0)).toBe('No');
    });

    test('boolean.yesNoLower should convert to yes/no', () => {
      expect(executeTransform('boolean.yesNoLower', true)).toBe('yes');
      expect(executeTransform('boolean.yesNoLower', false)).toBe('no');
    });

    test('boolean.YN should convert to Y/N', () => {
      expect(executeTransform('boolean.YN', true)).toBe('Y');
      expect(executeTransform('boolean.YN', false)).toBe('N');
    });

    test('boolean.oneZero should convert to 1/0', () => {
      expect(executeTransform('boolean.oneZero', true)).toBe(1);
      expect(executeTransform('boolean.oneZero', false)).toBe(0);
    });

    test('boolean.truefalse should convert to "true"/"false" strings', () => {
      expect(executeTransform('boolean.truefalse', true)).toBe('true');
      expect(executeTransform('boolean.truefalse', false)).toBe('false');
    });
  });

  describe('String Transforms', () => {
    test('string.uppercase should convert to uppercase', () => {
      expect(executeTransform('string.uppercase', 'hello world')).toBe('HELLO WORLD');
      expect(executeTransform('string.uppercase', 'John Smith')).toBe('JOHN SMITH');
    });

    test('string.lowercase should convert to lowercase', () => {
      expect(executeTransform('string.lowercase', 'HELLO WORLD')).toBe('hello world');
      expect(executeTransform('string.lowercase', 'John Smith')).toBe('john smith');
    });

    test('string.titlecase should convert to title case', () => {
      expect(executeTransform('string.titlecase', 'hello world')).toBe('Hello World');
      expect(executeTransform('string.titlecase', 'JOHN SMITH')).toBe('John Smith');
    });

    test('string.trim should remove whitespace', () => {
      expect(executeTransform('string.trim', '  hello  ')).toBe('hello');
      expect(executeTransform('string.trim', '\n\t test \n')).toBe('test');
    });

    test('string.truncate50 should truncate to 50 chars', () => {
      const longString = 'a'.repeat(100);
      expect(executeTransform('string.truncate50', longString)).toBe('a'.repeat(50));
      expect(executeTransform('string.truncate50', 'short')).toBe('short');
    });

    test('string.truncate100 should truncate to 100 chars', () => {
      const longString = 'b'.repeat(150);
      expect(executeTransform('string.truncate100', longString)).toBe('b'.repeat(100));
    });

    test('string.truncate255 should truncate to 255 chars', () => {
      const longString = 'c'.repeat(300);
      expect(executeTransform('string.truncate255', longString)).toBe('c'.repeat(255));
    });
  });

  describe('Phone Transforms', () => {
    test('phone.digitsOnly should remove non-digits', () => {
      expect(executeTransform('phone.digitsOnly', '(555) 123-4567')).toBe('5551234567');
      expect(executeTransform('phone.digitsOnly', '+1-555-123-4567')).toBe('15551234567');
      expect(executeTransform('phone.digitsOnly', '555.123.4567')).toBe('5551234567');
    });

    test('phone.e164 should convert to E.164 format', () => {
      expect(executeTransform('phone.e164', '5551234567')).toBe('+15551234567');
      expect(executeTransform('phone.e164', '(555) 123-4567')).toBe('+15551234567');
      expect(executeTransform('phone.e164', '15551234567')).toBe('+15551234567');
    });

    test('phone.dashed should format as XXX-XXX-XXXX', () => {
      expect(executeTransform('phone.dashed', '5551234567')).toBe('555-123-4567');
      expect(executeTransform('phone.dashed', '(555) 123-4567')).toBe('555-123-4567');
    });

    test('phone.dotted should format as XXX.XXX.XXXX', () => {
      expect(executeTransform('phone.dotted', '5551234567')).toBe('555.123.4567');
    });

    test('phone.parentheses should format as (XXX) XXX-XXXX', () => {
      expect(executeTransform('phone.parentheses', '5551234567')).toBe('(555) 123-4567');
    });
  });

  describe('Date Transforms', () => {
    const testDate = '2024-01-15T10:30:00Z';

    test('date.isoDate should format as YYYY-MM-DD', () => {
      expect(executeTransform('date.isoDate', testDate)).toBe('2024-01-15');
    });

    test('date.usDate should format as MM/DD/YYYY', () => {
      expect(executeTransform('date.usDate', testDate)).toBe('01/15/2024');
    });

    test('date.usDateShort should format as M/D/YY', () => {
      expect(executeTransform('date.usDateShort', testDate)).toBe('1/15/24');
    });

    test('date.timestamp should convert to Unix timestamp', () => {
      const result = executeTransform('date.timestamp', testDate);
      expect(typeof result).toBe('number');
      expect(result).toBe(1705315800);
    });

    test('date.timestampMs should convert to Unix timestamp in milliseconds', () => {
      const result = executeTransform('date.timestampMs', testDate);
      expect(typeof result).toBe('number');
      expect(result).toBe(1705315800000);
    });

    test('date.iso8601 should format as full ISO 8601', () => {
      const result = executeTransform('date.iso8601', testDate);
      expect(result).toBe('2024-01-15T10:30:00.000Z');
    });

    test('should handle invalid date', () => {
      expect(executeTransform('date.isoDate', 'not a date')).toBeNull();
    });
  });

  describe('Number Transforms', () => {
    test('number.integer should truncate decimals', () => {
      expect(executeTransform('number.integer', 5.7)).toBe(5);
      expect(executeTransform('number.integer', 5.2)).toBe(5);
      expect(executeTransform('number.integer', '5.9')).toBe(5);
    });

    test('number.round should round to nearest integer', () => {
      expect(executeTransform('number.round', 5.7)).toBe(6);
      expect(executeTransform('number.round', 5.2)).toBe(5);
      expect(executeTransform('number.round', 5.5)).toBe(6);
    });

    test('number.twoDecimals should format with 2 decimal places', () => {
      expect(executeTransform('number.twoDecimals', 5)).toBe('5.00');
      expect(executeTransform('number.twoDecimals', 5.1)).toBe('5.10');
      expect(executeTransform('number.twoDecimals', 5.123)).toBe('5.12');
    });

    test('number.currency should format as currency', () => {
      expect(executeTransform('number.currency', 1234.5)).toBe('$1,234.50');
      expect(executeTransform('number.currency', 100)).toBe('$100.00');
    });

    test('number.percentage should format as percentage', () => {
      expect(executeTransform('number.percentage', 0.85)).toBe('85%');
      expect(executeTransform('number.percentage', 0.5)).toBe('50%');
      expect(executeTransform('number.percentage', 1)).toBe('100%');
    });
  });

  describe('Service-Specific Transforms', () => {
    test('service.windowTypeCode should convert window types', () => {
      expect(executeTransform('service.windowTypeCode', 'Double Hung')).toBe('DH');
      expect(executeTransform('service.windowTypeCode', 'Casement')).toBe('CAS');
      expect(executeTransform('service.windowTypeCode', 'Sliding')).toBe('SLD');
      expect(executeTransform('service.windowTypeCode', 'Unknown Type')).toBe('Unknown Type');
    });

    test('service.roofTypeCode should convert roof types', () => {
      expect(executeTransform('service.roofTypeCode', 'Asphalt Shingles')).toBe('ASP');
      expect(executeTransform('service.roofTypeCode', 'Metal Roofing')).toBe('MTL');
      expect(executeTransform('service.roofTypeCode', 'Unknown Type')).toBe('Unknown Type');
    });

    test('service.timeframeCode should convert timeframes', () => {
      expect(executeTransform('service.timeframeCode', '1-3 months')).toBe('1_3_MONTHS');
      expect(executeTransform('service.timeframeCode', 'Immediately')).toBe('IMMEDIATE');
      expect(executeTransform('service.timeframeCode', 'Just Researching')).toBe('RESEARCH');
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty strings', () => {
      expect(executeTransform('string.uppercase', '')).toBe('');
      expect(executeTransform('string.trim', '')).toBe('');
    });

    test('should handle numbers as input for string transforms', () => {
      expect(executeTransform('string.uppercase', 123)).toBe('123');
    });

    test('should handle strings as input for boolean transforms', () => {
      expect(executeTransform('boolean.yesNo', 'Yes')).toBe('Yes');
      expect(executeTransform('boolean.yesNo', 'No')).toBe('No');
      expect(executeTransform('boolean.yesNo', 'TRUE')).toBe('Yes');
      expect(executeTransform('boolean.yesNo', 'FALSE')).toBe('No');
    });

    test('should handle phone with country code', () => {
      expect(executeTransform('phone.e164', '+15551234567')).toBe('+15551234567');
      expect(executeTransform('phone.digitsOnly', '+15551234567')).toBe('15551234567');
    });

    test('should handle Date objects', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      expect(executeTransform('date.isoDate', date)).toBe('2024-01-15');
    });
  });
});
