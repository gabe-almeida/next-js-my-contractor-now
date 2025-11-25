/**
 * Basic Security Fixes Validation
 * Tests the core security functions to ensure they work correctly
 */

// Import our security functions
const { sanitizeHtml, sanitizeInput, sanitizeObject } = require('../../src/lib/security');
const { generateJwtToken, verifyJwtToken, secureStringCompare } = require('../../src/lib/security');
const { getSecureCorsHeaders, sanitizeLogData } = require('../../src/lib/security');

describe('Security Fixes Basic Validation', () => {

  // Test XSS Protection
  describe('XSS Protection', () => {
    test('removes script tags', () => {
      const malicious = '<script>alert("xss")</script>';
      const result = sanitizeInput(malicious);
      expect(result).not.toContain('script');
      expect(result).not.toContain('alert');
    });

    test('removes event handlers', () => {
      const malicious = '<div onclick="alert(1)">test</div>';
      const result = sanitizeHtml(malicious);
      expect(result).not.toContain('onclick');
      expect(result).not.toContain('alert');
    });

    test('sanitizes objects recursively', () => {
      const maliciousObj = {
        name: '<script>alert("xss")</script>',
        safe: 'normal text'
      };
      
      const result = sanitizeObject(maliciousObj);
      expect(JSON.stringify(result)).not.toContain('script');
      expect(result.safe).toBe('normal text');
    });
  });

  // Test Authentication Security
  describe('Authentication Security', () => {
    beforeEach(() => {
      process.env.JWT_SECRET = 'test-secret-key-for-testing-minimum-32-characters-long';
    });

    test('generates JWT tokens', () => {
      const payload = { userId: 'user123', role: 'admin' };
      const token = generateJwtToken(payload);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    test('verifies JWT tokens', () => {
      const payload = { userId: 'user123', role: 'admin' };
      const token = generateJwtToken(payload);
      
      const verification = verifyJwtToken(token);
      expect(verification.valid).toBe(true);
      expect(verification.payload.userId).toBe('user123');
    });

    test('rejects invalid tokens', () => {
      const verification = verifyJwtToken('invalid.token');
      expect(verification.valid).toBe(false);
    });

    test('constant-time comparison works', () => {
      expect(secureStringCompare('test123', 'test123')).toBe(true);
      expect(secureStringCompare('test123', 'wrong123')).toBe(false);
      expect(secureStringCompare('', '')).toBe(true);
    });
  });

  // Test CORS Security
  describe('CORS Security', () => {
    test('rejects unknown origins', () => {
      const headers = getSecureCorsHeaders('https://malicious.com');
      expect(headers['Access-Control-Allow-Origin']).toBe('null');
    });

    test('allows localhost in development', () => {
      const headers = getSecureCorsHeaders('http://localhost:3000');
      expect(headers['Access-Control-Allow-Origin']).toBe('http://localhost:3000');
    });

    test('includes security headers', () => {
      const headers = getSecureCorsHeaders('http://localhost:3000');
      expect(headers['Access-Control-Allow-Credentials']).toBe('true');
      expect(headers['Vary']).toBe('Origin');
    });
  });

  // Test Log Sanitization
  describe('Log Sanitization', () => {
    test('removes sensitive data', () => {
      const sensitiveData = {
        username: 'john',
        password: 'secret123',
        apiKey: 'sk_live_123',
        normalField: 'safe'
      };
      
      const sanitized = sanitizeLogData(sensitiveData);
      expect(sanitized.username).toBe('john');
      expect(sanitized.normalField).toBe('safe');
      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.apiKey).toBe('[REDACTED]');
    });

    test('handles nested objects', () => {
      const nested = {
        user: {
          name: 'John',
          secret: 'hidden'
        }
      };
      
      const sanitized = sanitizeLogData(nested);
      expect(sanitized.user.name).toBe('John');
      expect(sanitized.user.secret).toBe('[REDACTED]');
    });
  });

  // Test Integration
  describe('Integration Tests', () => {
    test('handles null and undefined', () => {
      expect(() => sanitizeInput('')).not.toThrow();
      expect(() => sanitizeObject(null)).not.toThrow();
      expect(() => sanitizeLogData(undefined)).not.toThrow();
    });

    test('maintains existing functionality', () => {
      const cleanData = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '555-1234'
      };
      
      const result = sanitizeObject(cleanData);
      expect(result.name).toBe('John Doe');
      expect(result.email).toBe('john@example.com');
      expect(result.phone).toBe('555-1234');
    });
  });
});

console.log('✅ Security validation tests created successfully');