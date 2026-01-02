/**
 * Unit Tests: Source Fields Registry
 *
 * WHY: Verify source field definitions and dynamic field generation
 * WHEN: After source-fields.ts is implemented
 * HOW: Test static fields, type mapping, and schema parsing
 */

import { describe, test, expect } from '@jest/globals';
import {
  STANDARD_SOURCE_FIELDS,
  getSourceFieldsForService,
  mapFieldType,
  getExampleValue,
} from '@/lib/field-mapping/source-fields';

describe('Source Fields Registry', () => {
  describe('STANDARD_SOURCE_FIELDS', () => {
    test('should have at least 10 standard fields', () => {
      expect(STANDARD_SOURCE_FIELDS.length).toBeGreaterThanOrEqual(10);
    });

    test('should include required contact fields', () => {
      const paths = STANDARD_SOURCE_FIELDS.map((f) => f.path);
      expect(paths).toContain('firstName');
      expect(paths).toContain('lastName');
      expect(paths).toContain('email');
      expect(paths).toContain('phone');
    });

    test('should include property fields', () => {
      const paths = STANDARD_SOURCE_FIELDS.map((f) => f.path);
      expect(paths).toContain('zipCode');
      expect(paths).toContain('ownsHome');
    });

    test('should include compliance fields', () => {
      const paths = STANDARD_SOURCE_FIELDS.map((f) => f.path);
      expect(paths).toContain('trustedFormCertUrl');
      expect(paths).toContain('trustedFormCertId');
      expect(paths).toContain('jornayaLeadId');
    });

    test('should include meta fields', () => {
      const paths = STANDARD_SOURCE_FIELDS.map((f) => f.path);
      expect(paths).toContain('id');
      expect(paths).toContain('createdAt');
    });

    test('all fields should have required properties', () => {
      STANDARD_SOURCE_FIELDS.forEach((field) => {
        expect(field).toHaveProperty('path');
        expect(field).toHaveProperty('label');
        expect(field).toHaveProperty('type');
        expect(field).toHaveProperty('category');
        expect(typeof field.path).toBe('string');
        expect(typeof field.label).toBe('string');
        expect(typeof field.type).toBe('string');
        expect(typeof field.category).toBe('string');
      });
    });

    test('all fields should have example values', () => {
      STANDARD_SOURCE_FIELDS.forEach((field) => {
        expect(field.example).toBeDefined();
      });
    });

    test('fields should have valid categories', () => {
      const validCategories = ['contact', 'property', 'compliance', 'meta', 'form'];
      STANDARD_SOURCE_FIELDS.forEach((field) => {
        expect(validCategories).toContain(field.category);
      });
    });
  });

  describe('mapFieldType', () => {
    test('should map text to string', () => {
      expect(mapFieldType('text')).toBe('string');
    });

    test('should map email to email', () => {
      expect(mapFieldType('email')).toBe('email');
    });

    test('should map tel to phone', () => {
      expect(mapFieldType('tel')).toBe('phone');
    });

    test('should map select to string', () => {
      expect(mapFieldType('select')).toBe('string');
    });

    test('should map radio to string', () => {
      expect(mapFieldType('radio')).toBe('string');
    });

    test('should map number to number', () => {
      expect(mapFieldType('number')).toBe('number');
    });

    test('should map checkbox to boolean', () => {
      expect(mapFieldType('checkbox')).toBe('boolean');
    });

    test('should default unknown types to string', () => {
      expect(mapFieldType('unknown')).toBe('string');
      expect(mapFieldType('custom-type')).toBe('string');
    });
  });

  describe('getExampleValue', () => {
    test('should return example for string type', () => {
      const example = getExampleValue('string');
      expect(typeof example).toBe('string');
    });

    test('should return example for email type', () => {
      const example = getExampleValue('email');
      expect(typeof example).toBe('string');
      expect(example).toContain('@');
    });

    test('should return example for phone type', () => {
      const example = getExampleValue('phone');
      expect(typeof example).toBe('string');
    });

    test('should return example for number type', () => {
      const example = getExampleValue('number');
      expect(typeof example).toBe('number');
    });

    test('should return example for boolean type', () => {
      const example = getExampleValue('boolean');
      expect(typeof example).toBe('boolean');
    });

    test('should return first option when options provided', () => {
      const options = [
        { value: 'option1', label: 'Option 1' },
        { value: 'option2', label: 'Option 2' },
      ];
      const example = getExampleValue('string', options);
      expect(example).toBe('option1');
    });
  });

  describe('getSourceFieldsForService', () => {
    test('should include standard fields', () => {
      const fields = getSourceFieldsForService({
        id: 'test-service',
        displayName: 'Test Service',
        formSchema: '{}',
      });

      const standardPaths = STANDARD_SOURCE_FIELDS.map((f) => f.path);
      const resultPaths = fields.map((f) => f.path);

      // Should include at least some standard fields
      expect(resultPaths.filter((p) => standardPaths.includes(p)).length).toBeGreaterThan(0);
    });

    test('should parse form schema fields', () => {
      const formSchema = JSON.stringify({
        fields: [
          { name: 'customField1', type: 'text', label: 'Custom Field 1' },
          { name: 'customField2', type: 'select', label: 'Custom Field 2' },
        ],
      });

      const fields = getSourceFieldsForService({
        id: 'test-service',
        displayName: 'Test Service',
        formSchema,
      });

      const formFields = fields.filter((f) => f.category === 'form');
      expect(formFields.length).toBeGreaterThanOrEqual(2);

      const customField1 = formFields.find((f) => f.path === 'formData.customField1');
      expect(customField1).toBeDefined();
      expect(customField1?.label).toBe('Custom Field 1');
    });

    test('should handle invalid JSON gracefully', () => {
      const fields = getSourceFieldsForService({
        id: 'test-service',
        displayName: 'Test Service',
        formSchema: 'not valid json',
      });

      // Should still return standard fields
      expect(fields.length).toBeGreaterThan(0);
    });

    test('should handle empty schema', () => {
      const fields = getSourceFieldsForService({
        id: 'test-service',
        displayName: 'Test Service',
        formSchema: '',
      });

      // Should still return standard fields
      expect(fields.length).toBeGreaterThan(0);
    });

    test('should handle null schema', () => {
      const fields = getSourceFieldsForService({
        id: 'test-service',
        displayName: 'Test Service',
        formSchema: null as unknown as string,
      });

      // Should still return standard fields
      expect(fields.length).toBeGreaterThan(0);
    });

    test('should prefix form fields with formData.', () => {
      const formSchema = JSON.stringify({
        fields: [{ name: 'testField', type: 'text', label: 'Test' }],
      });

      const fields = getSourceFieldsForService({
        id: 'test-service',
        displayName: 'Test Service',
        formSchema,
      });

      const formFields = fields.filter((f) => f.category === 'form');
      expect(formFields.every((f) => f.path.startsWith('formData.'))).toBe(true);
    });

    test('should set form field category correctly', () => {
      const formSchema = JSON.stringify({
        fields: [{ name: 'testField', type: 'text', label: 'Test' }],
      });

      const fields = getSourceFieldsForService({
        id: 'test-service',
        displayName: 'Test Service',
        formSchema,
      });

      const formField = fields.find((f) => f.path === 'formData.testField');
      expect(formField?.category).toBe('form');
    });
  });
});
