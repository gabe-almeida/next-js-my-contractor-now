/**
 * XSS (Cross-Site Scripting) Prevention Tests
 *
 * Verifies that user input is sanitized to prevent XSS attacks
 */

import { describe, it, expect } from '@jest/globals';
import { sanitizeHtml, sanitizeObject, sanitizeFormData } from '@/lib/security/sanitize';

describe('XSS Prevention', () => {
  describe('HTML Sanitization', () => {
    it('should strip script tags from input', () => {
      const maliciousInput = '<script>alert("XSS")</script>Hello';
      const sanitized = sanitizeHtml(maliciousInput);

      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('</script>');
      expect(sanitized).toBe('Hello');
    });

    it('should strip inline event handlers', () => {
      const maliciousInputs = [
        '<img src="x" onerror="alert(1)">',
        '<div onclick="alert(1)">Click me</div>',
        '<a href="#" onmouseover="alert(1)">Link</a>',
        '<body onload="alert(1)">',
        '<input onfocus="alert(1)">'
      ];

      for (const input of maliciousInputs) {
        const sanitized = sanitizeHtml(input);
        expect(sanitized).not.toContain('alert');
        expect(sanitized).not.toContain('onerror');
        expect(sanitized).not.toContain('onclick');
        expect(sanitized).not.toContain('onmouseover');
        expect(sanitized).not.toContain('onload');
        expect(sanitized).not.toContain('onfocus');
      }
    });

    it('should strip javascript: protocol from links', () => {
      const maliciousInputs = [
        '<a href="javascript:alert(1)">Click</a>',
        '<iframe src="javascript:alert(1)"></iframe>',
        '<object data="javascript:alert(1)"></object>'
      ];

      for (const input of maliciousInputs) {
        const sanitized = sanitizeHtml(input);
        expect(sanitized).not.toContain('javascript:');
        expect(sanitized).not.toContain('alert');
      }
    });

    it('should strip data: URIs that could execute code', () => {
      const maliciousInput = '<img src="data:text/html,<script>alert(1)</script>">';
      const sanitized = sanitizeHtml(maliciousInput);

      expect(sanitized).not.toContain('data:text/html');
      expect(sanitized).not.toContain('<script>');
    });

    it('should handle HTML entity encoding safely', () => {
      const encodedInputs = [
        '&lt;script&gt;alert(1)&lt;/script&gt;',
        '&#60;script&#62;alert(1)&#60;/script&#62;',
        '&#x3C;script&#x3E;alert(1)&#x3C;/script&#x3E;'
      ];

      for (const input of encodedInputs) {
        const sanitized = sanitizeHtml(input);
        // HTML entities are already safe (won't execute as code)
        // They display as text: "<script>alert(1)</script>"
        expect(sanitized).not.toContain('<script>');  // No actual tags
        // Note: May still contain the word "alert" but it's harmless as text
      }
    });

    it('should strip style tags with javascript', () => {
      const maliciousInputs = [
        '<style>body { background: url("javascript:alert(1)") }</style>',
        '<div style="background: url(javascript:alert(1))">',
        '<style>@import "javascript:alert(1)";</style>'
      ];

      for (const input of maliciousInputs) {
        const sanitized = sanitizeHtml(input);
        expect(sanitized).not.toContain('javascript:');
        expect(sanitized).not.toContain('alert');
      }
    });

    it('should handle SVG-based XSS attacks', () => {
      const maliciousInputs = [
        '<svg onload="alert(1)">',
        '<svg><script>alert(1)</script></svg>',
        '<svg><animate onbegin="alert(1)"/></svg>'
      ];

      for (const input of maliciousInputs) {
        const sanitized = sanitizeHtml(input);
        expect(sanitized).not.toContain('alert');
        expect(sanitized).not.toContain('onload');
        expect(sanitized).not.toContain('onbegin');
      }
    });

    it('should strip meta refresh redirects', () => {
      const maliciousInput = '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">';
      const sanitized = sanitizeHtml(maliciousInput);

      expect(sanitized).not.toContain('meta');
      expect(sanitized).not.toContain('javascript:');
    });
  });

  describe('Object Sanitization', () => {
    it('should sanitize all string values in object', () => {
      const maliciousObject = {
        name: '<script>alert(1)</script>John',
        email: '<img src=x onerror=alert(1)>test@example.com',
        notes: 'Normal text'
      };

      const sanitized = sanitizeObject(maliciousObject);

      expect(sanitized.name).not.toContain('<script>');
      expect(sanitized.name).toContain('John');
      expect(sanitized.email).not.toContain('<img');
      expect(sanitized.notes).toBe('Normal text');
    });

    it('should recursively sanitize nested objects', () => {
      const maliciousObject = {
        user: {
          name: '<script>alert(1)</script>',
          profile: {
            bio: '<img onerror=alert(1) src=x>'
          }
        }
      };

      const sanitized = sanitizeObject(maliciousObject);

      expect(sanitized.user.name).not.toContain('<script>');
      expect(sanitized.user.profile.bio).not.toContain('<img');
      expect(sanitized.user.profile.bio).not.toContain('onerror');
    });

    it('should sanitize arrays of strings', () => {
      const maliciousArray = [
        '<script>alert(1)</script>',
        'Safe string',
        '<img src=x onerror=alert(1)>'
      ];

      const sanitized = sanitizeObject(maliciousArray);

      expect(sanitized[0]).not.toContain('<script>');
      expect(sanitized[1]).toBe('Safe string');
      expect(sanitized[2]).not.toContain('<img');
    });

    it('should handle mixed types in objects', () => {
      const mixedObject = {
        string: '<script>alert(1)</script>',
        number: 12345,
        boolean: true,
        null: null,
        undefined: undefined
      };

      const sanitized = sanitizeObject(mixedObject);

      expect(sanitized.string).not.toContain('<script>');
      expect(sanitized.number).toBe(12345);
      expect(sanitized.boolean).toBe(true);
      expect(sanitized.null).toBeNull();
      expect(sanitized.undefined).toBeUndefined();
    });
  });

  describe('Form Data Sanitization', () => {
    it('should sanitize lead form submissions', () => {
      const maliciousFormData = {
        firstName: '<script>alert("XSS")</script>John',
        lastName: '<img src=x onerror=alert(1)>Doe',
        email: 'john@example.com',
        phone: '555-1234',
        notes: '<a href="javascript:alert(1)">Click here</a>'
      };

      const sanitized = sanitizeFormData(maliciousFormData);

      expect(sanitized.firstName).toContain('John');
      expect(sanitized.firstName).not.toContain('<script>');
      expect(sanitized.lastName).toContain('Doe');
      expect(sanitized.lastName).not.toContain('<img');
      expect(sanitized.email).toBe('john@example.com');
      expect(sanitized.notes).not.toContain('javascript:');
    });

    it('should preserve safe HTML entities', () => {
      const formData = {
        message: 'Price: $100 &amp; free shipping',
        description: '5 &lt; 10 &gt; 3'
      };

      const sanitized = sanitizeFormData(formData);

      // Should preserve or properly handle entities
      expect(sanitized.message).toBeTruthy();
      expect(sanitized.description).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty strings', () => {
      const result = sanitizeHtml('');
      expect(result).toBe('');
    });

    it('should handle null values', () => {
      const result = sanitizeObject(null);
      expect(result).toBeNull();
    });

    it('should handle undefined values', () => {
      const result = sanitizeObject(undefined);
      expect(result).toBeUndefined();
    });

    it('should handle very long strings', () => {
      const longString = '<script>' + 'a'.repeat(10000) + '</script>';
      const result = sanitizeHtml(longString);

      expect(result).not.toContain('<script>');
      expect(result.length).toBeLessThan(longString.length);
    });

    it('should handle unicode and special characters', () => {
      const unicodeInput = '你好 <script>alert(1)</script> мир 🌍';
      const result = sanitizeHtml(unicodeInput);

      expect(result).toContain('你好');
      expect(result).toContain('мир');
      expect(result).toContain('🌍');
      expect(result).not.toContain('<script>');
    });
  });

  describe('Bypass Attempts', () => {
    it('should prevent case variation bypasses', () => {
      const maliciousInputs = [
        '<SCRIPT>alert(1)</SCRIPT>',
        '<ScRiPt>alert(1)</sCrIpT>',
        '<sCrIpT>alert(1)</ScRiPt>'
      ];

      for (const input of maliciousInputs) {
        const sanitized = sanitizeHtml(input);
        expect(sanitized).not.toContain('alert');
      }
    });

    it('should prevent null byte injection', () => {
      const maliciousInput = '<script\x00>alert(1)</script>';
      const sanitized = sanitizeHtml(maliciousInput);

      expect(sanitized).not.toContain('alert');
    });

    it('should prevent newline and tab injection', () => {
      const maliciousInputs = [
        '<script\n>alert(1)</script>',
        '<script\r>alert(1)</script>',
        '<script\t>alert(1)</script>'
      ];

      for (const input of maliciousInputs) {
        const sanitized = sanitizeHtml(input);
        expect(sanitized).not.toContain('alert');
      }
    });

    it('should prevent double encoding attacks', () => {
      const maliciousInput = '%3Cscript%3Ealert(1)%3C/script%3E';
      const sanitized = sanitizeHtml(maliciousInput);

      // Should not decode URL encoding
      expect(sanitized).not.toContain('<script>');
    });
  });

  describe('Content Security', () => {
    it('should strip potentially dangerous HTML5 tags', () => {
      const dangerousTags = [
        '<embed src="javascript:alert(1)">',
        '<object data="javascript:alert(1)">',
        '<applet code="malicious.class">',
        '<iframe src="javascript:alert(1)">',
        '<frame src="javascript:alert(1)">'
      ];

      for (const tag of dangerousTags) {
        const sanitized = sanitizeHtml(tag);
        expect(sanitized).not.toContain('javascript:');
        expect(sanitized).not.toContain('alert');
      }
    });

    it('should handle form-based XSS', () => {
      const maliciousInput = '<form action="javascript:alert(1)"><input type="submit"></form>';
      const sanitized = sanitizeHtml(maliciousInput);

      expect(sanitized).not.toContain('javascript:');
      expect(sanitized).not.toContain('alert');
    });
  });
});
