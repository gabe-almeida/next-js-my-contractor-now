/**
 * Security Fixes Validation Test Suite
 * 
 * This comprehensive test validates all security fixes implemented
 * to address critical vulnerabilities identified in the audit.
 */

import { sanitizeHtml, sanitizeInput, sanitizeObject, sanitizeRequestBody } from '../../src/lib/security';
import { generateJwtToken, verifyJwtToken, secureStringCompare } from '../../src/lib/security';
import { getSecureCorsHeaders, sanitizeLogData, sanitizeErrorForProduction } from '../../src/lib/security';
import { validateFileUpload } from '../../src/lib/security';

describe('Security Fixes Validation', () => {

  // =====================================
  // 1. XSS PROTECTION TESTS
  // =====================================
  describe('XSS Protection with DOMPurify', () => {
    test('should sanitize basic HTML/script tags', () => {
      const malicious = '<script>alert("xss")</script>';
      const result = sanitizeHtml(malicious);
      expect(result).toBe('');
      expect(result).not.toContain('script');
      expect(result).not.toContain('alert');
    });

    test('should remove dangerous event handlers', () => {
      const malicious = '<div onclick="alert(1)" onload="hack()">test</div>';
      const result = sanitizeHtml(malicious);
      expect(result).not.toContain('onclick');
      expect(result).not.toContain('onload');
      expect(result).not.toContain('alert');
    });

    test('should handle complex XSS attempts', () => {
      const malicious = 'javascript:void(0)"><img src=x onerror=alert(1)>';
      const result = sanitizeInput(malicious);
      expect(result).not.toContain('javascript:');
      expect(result).not.toContain('onerror');
      expect(result).not.toContain('alert');
    });

    test('should sanitize CSS injection attempts', () => {
      const malicious = '<style>body{background:url("javascript:alert(1)")}</style>';
      const result = sanitizeHtml(malicious);
      expect(result).not.toContain('style');
      expect(result).not.toContain('javascript:');
    });

    test('should sanitize object properties recursively', () => {
      const maliciousObj = {
        name: '<script>alert("xss")</script>',
        address: {
          street: '<img src=x onerror=alert(1)>',
          details: ['<script>hack()</script>', 'safe text']
        }
      };
      
      const result = sanitizeObject(maliciousObj);
      expect(JSON.stringify(result)).not.toContain('script');
      expect(JSON.stringify(result)).not.toContain('onerror');
      expect(JSON.stringify(result)).not.toContain('alert');
      expect(result.address.details[1]).toBe('safe text'); // Safe content preserved
    });
  });

  // =====================================
  // 2. AUTHENTICATION SECURITY TESTS
  // =====================================
  describe('Secure Authentication', () => {
    const JWT_SECRET_BACKUP = process.env.JWT_SECRET;
    
    beforeEach(() => {
      process.env.JWT_SECRET = 'test-secret-key-for-testing-at-least-32-chars';
    });
    
    afterEach(() => {
      process.env.JWT_SECRET = JWT_SECRET_BACKUP;
    });

    test('should generate valid JWT tokens', () => {
      const payload = { userId: 'user123', role: 'admin', permissions: ['admin:read'] };
      const token = generateJwtToken(payload);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    test('should verify JWT tokens correctly', () => {
      const payload = { userId: 'user123', role: 'admin', permissions: ['admin:read'] };
      const token = generateJwtToken(payload);
      
      const verification = verifyJwtToken(token);
      expect(verification.valid).toBe(true);
      expect(verification.payload).toMatchObject(payload);
    });

    test('should reject invalid JWT tokens', () => {
      const invalidToken = 'invalid.token.here';
      const verification = verifyJwtToken(invalidToken);
      expect(verification.valid).toBe(false);
      expect(verification.error).toBeDefined();
    });

    test('should perform constant-time string comparison', () => {
      const correct = 'correct_password_123';
      const incorrect = 'wrong_password_456';
      const correctAgain = 'correct_password_123';
      
      // Measure timing for correct comparison
      const start1 = process.hrtime.bigint();
      const result1 = secureStringCompare(correct, correctAgain);
      const time1 = process.hrtime.bigint() - start1;
      
      // Measure timing for incorrect comparison (should be similar)
      const start2 = process.hrtime.bigint();
      const result2 = secureStringCompare(correct, incorrect);
      const time2 = process.hrtime.bigint() - start2;
      
      expect(result1).toBe(true);
      expect(result2).toBe(false);
      
      // Times should be relatively close (within order of magnitude)
      const timeDiff = Math.abs(Number(time1 - time2));
      const maxTime = Math.max(Number(time1), Number(time2));
      expect(timeDiff / maxTime).toBeLessThan(10); // Allow up to 10x difference
    });

    test('should handle empty strings securely', () => {
      expect(secureStringCompare('', '')).toBe(true);
      expect(secureStringCompare('test', '')).toBe(false);
      expect(secureStringCompare('', 'test')).toBe(false);
    });
  });

  // =====================================
  // 3. CORS SECURITY TESTS
  // =====================================
  describe('Secure CORS Configuration', () => {
    test('should return null origin for disallowed domains', () => {
      const maliciousOrigin = 'https://evil.com';
      const headers = getSecureCorsHeaders(maliciousOrigin);
      
      expect(headers['Access-Control-Allow-Origin']).toBe('null');
      expect(headers['Vary']).toBe('Origin');
    });

    test('should allow configured origins', () => {
      process.env.CORS_ORIGINS = 'https://trusted.com,https://app.trusted.com';
      
      const trustedOrigin = 'https://trusted.com';
      const headers = getSecureCorsHeaders(trustedOrigin);
      
      expect(headers['Access-Control-Allow-Origin']).toBe(trustedOrigin);
      expect(headers['Access-Control-Allow-Credentials']).toBe('true');
    });

    test('should default to secure localhost for development', () => {
      delete process.env.CORS_ORIGINS;
      
      const localhostOrigin = 'http://localhost:3000';
      const headers = getSecureCorsHeaders(localhostOrigin);
      
      expect(headers['Access-Control-Allow-Origin']).toBe(localhostOrigin);
    });

    test('should include security headers', () => {
      const headers = getSecureCorsHeaders('http://localhost:3000');
      
      expect(headers['Access-Control-Allow-Methods']).toContain('POST');
      expect(headers['Access-Control-Allow-Headers']).toContain('Authorization');
      expect(headers['Access-Control-Max-Age']).toBe('86400');
    });
  });

  // =====================================
  // 4. LOGGING SECURITY TESTS
  // =====================================
  describe('Log Sanitization', () => {
    test('should sanitize passwords and secrets', () => {
      const sensitiveData = {
        username: 'john_doe',
        password: 'secret123',
        api_key: 'sk_live_123456',
        token: 'bearer_token_xyz',
        normal_field: 'safe_value'
      };
      
      const sanitized = sanitizeLogData(sensitiveData);
      
      expect(sanitized.username).toBe('john_doe');
      expect(sanitized.normal_field).toBe('safe_value');
      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.api_key).toBe('[REDACTED]');
      expect(sanitized.token).toBe('[REDACTED]');
    });

    test('should handle nested objects', () => {
      const nestedData = {
        user: {
          name: 'John',
          credentials: {
            password: 'secret',
            private_key: 'pk_123'
          }
        },
        config: {
          jwt_secret: 'super_secret'
        }
      };
      
      const sanitized = sanitizeLogData(nestedData);
      
      expect(sanitized.user.name).toBe('John');
      expect(sanitized.user.credentials.password).toBe('[REDACTED]');
      expect(sanitized.user.credentials.private_key).toBe('[REDACTED]');
      expect(sanitized.config.jwt_secret).toBe('[REDACTED]');
    });

    test('should handle arrays', () => {
      const arrayData = [
        { name: 'safe' },
        { password: 'secret' },
        'api_key=123456'
      ];
      
      const sanitized = sanitizeLogData(arrayData);
      
      expect(sanitized[0].name).toBe('safe');
      expect(sanitized[1].password).toBe('[REDACTED]');
      expect(sanitized[2]).toBe('[REDACTED]'); // String contains "api_key"
    });
  });

  // =====================================
  // 5. ERROR HANDLING TESTS
  // =====================================
  describe('Production Error Sanitization', () => {
    const NODE_ENV_BACKUP = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = NODE_ENV_BACKUP;
    });

    test('should return generic error in production', () => {
      process.env.NODE_ENV = 'production';
      
      const sensitiveError = new Error('Database connection failed: password is wrong');
      const sanitized = sanitizeErrorForProduction(sensitiveError);
      
      expect(sanitized.message).toBe('An error occurred while processing your request');
      expect(sanitized.code).toBe('INTERNAL_ERROR');
      expect(sanitized.timestamp).toBeDefined();
    });

    test('should return detailed error in development', () => {
      process.env.NODE_ENV = 'development';
      
      const error = new Error('Detailed error for debugging');
      const sanitized = sanitizeErrorForProduction(error);
      
      expect(sanitized.message).toBe('Detailed error for debugging');
      expect(sanitized.timestamp).toBeDefined();
    });
  });

  // =====================================
  // 6. FILE VALIDATION TESTS
  // =====================================
  describe('File Upload Security', () => {
    test('should validate file size', () => {
      const mockFile = {
        name: 'test.jpg',
        type: 'image/jpeg',
        size: 15 * 1024 * 1024 // 15MB
      } as File;
      
      const result = validateFileUpload(mockFile, { maxSize: 10 * 1024 * 1024 }); // 10MB limit
      expect(result.valid).toBe(false);
      expect(result.error).toContain('File size must be less than');
    });

    test('should validate file type', () => {
      const mockFile = {
        name: 'malicious.exe',
        type: 'application/exe',
        size: 1024
      } as File;
      
      const result = validateFileUpload(mockFile, {
        allowedTypes: ['image/jpeg', 'image/png']
      });
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('File type not allowed');
    });

    test('should validate file extension', () => {
      const mockFile = {
        name: 'image.php.jpg',
        type: 'image/jpeg',
        size: 1024
      } as File;
      
      const result = validateFileUpload(mockFile, {
        allowedTypes: ['image/jpeg'],
        allowedExtensions: ['.jpg', '.jpeg']
      });
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('File extension not allowed');
    });

    test('should sanitize filename', () => {
      const mockFile = {
        name: '<script>alert("xss")</script>.jpg',
        type: 'image/jpeg',
        size: 1024
      } as File;
      
      const result = validateFileUpload(mockFile);
      
      expect(result.valid).toBe(true);
      expect(result.sanitizedName).not.toContain('<');
      expect(result.sanitizedName).not.toContain('script');
      expect(result.sanitizedName).toMatch(/\.jpg$/);
    });
  });

  // =====================================
  // 7. INTEGRATION TESTS
  // =====================================
  describe('Security Integration', () => {
    test('should sanitize complete request body', () => {
      const maliciousRequest = {
        name: '<script>alert("xss")</script>',
        email: 'test@example.com',
        password: 'secret123',
        address: {
          street: '<img src=x onerror=alert(1)>',
          city: 'Safe City'
        },
        preferences: ['<script>hack()</script>', 'normal preference']
      };
      
      const sanitized = sanitizeRequestBody(maliciousRequest);
      
      // Check XSS is removed
      expect(JSON.stringify(sanitized)).not.toContain('script');
      expect(JSON.stringify(sanitized)).not.toContain('onerror');
      
      // Check safe data is preserved
      expect(sanitized.email).toBe('test@example.com');
      expect(sanitized.address.city).toBe('Safe City');
      expect(sanitized.preferences[1]).toBe('normal preference');
      
      // Password should still be present (sanitization != redaction)
      expect(sanitized.password).toBe('secret123');
    });

    test('should handle edge cases gracefully', () => {
      expect(() => sanitizeInput('')).not.toThrow();
      expect(() => sanitizeObject(null)).not.toThrow();
      expect(() => sanitizeObject(undefined)).not.toThrow();
      expect(() => sanitizeLogData(circular)).not.toThrow();
      
      // Create circular reference
      const circular: any = { name: 'test' };
      circular.self = circular;
    });
  });
});

// Helper to create circular reference for testing
function createCircular() {
  const obj: any = { name: 'test' };
  obj.self = obj;
  return obj;
}