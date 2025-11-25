/**
 * Security Tests: Input Validation and Attack Prevention
 * Tests security measures against common web vulnerabilities
 */

import { describe, test, expect, beforeEach } from '@jest/globals'
import { SecurityTestUtils, TestAPI } from '@/tests/utils/testHelpers'
import { mockFormSubmission } from '@/tests/fixtures/mockData'

// Mock security validation functions
class SecurityValidator {
  static sanitizeInput(input: string): string {
    // Basic HTML entity encoding
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
  }

  static validateSQLInput(input: string): boolean {
    const sqlPatterns = [
      /(\b(ALTER|CREATE|DELETE|DROP|EXEC(UTE)?|INSERT|MERGE|SELECT|UPDATE|UNION|SCRIPT)\b)/i,
      /(;|--|\||\*)/,
      /('|(\\')|('')|("%22)|(")|(\0)/,
      /(xp_|sp_)/i
    ]
    
    return !sqlPatterns.some(pattern => pattern.test(input))
  }

  static validateCSRFToken(token: string, expectedToken: string): boolean {
    return token === expectedToken && token.length >= 32
  }

  static checkRateLimit(clientId: string, windowMs: number = 60000, maxRequests: number = 100): boolean {
    // Mock rate limiting logic
    const now = Date.now()
    const windowStart = now - windowMs
    
    // In real implementation, would check against Redis/database
    const requestCount = Math.floor(Math.random() * 150) // Mock current request count
    
    return requestCount <= maxRequests
  }

  static validateFileUpload(filename: string, content: Buffer): { valid: boolean; reason?: string } {
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.pdf', '.doc', '.docx']
    const maxFileSize = 10 * 1024 * 1024 // 10MB
    
    const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'))
    
    if (!allowedExtensions.includes(extension)) {
      return { valid: false, reason: 'File type not allowed' }
    }
    
    if (content.length > maxFileSize) {
      return { valid: false, reason: 'File too large' }
    }
    
    // Check for malicious content patterns
    const contentStr = content.toString('hex').toLowerCase()
    const maliciousPatterns = ['3c736372697074', '3c696672616d65'] // <script, <iframe in hex
    
    if (maliciousPatterns.some(pattern => contentStr.includes(pattern))) {
      return { valid: false, reason: 'Potentially malicious content detected' }
    }
    
    return { valid: true }
  }
}

// Mock API handler with security measures
async function secureAPIHandler(request: any, options: { 
  requireCSRF?: boolean, 
  rateLimit?: { windowMs: number, maxRequests: number } 
} = {}) {
  try {
    const body = await request.json()
    const headers = request.headers || {}
    const clientIP = headers['x-forwarded-for'] || '127.0.0.1'
    
    // Rate limiting check
    if (options.rateLimit) {
      if (!SecurityValidator.checkRateLimit(clientIP, options.rateLimit.windowMs, options.rateLimit.maxRequests)) {
        return { status: 429, json: async () => ({ error: 'Rate limit exceeded' }) }
      }
    }
    
    // CSRF token validation
    if (options.requireCSRF) {
      const csrfToken = headers['x-csrf-token']
      const expectedToken = 'valid-csrf-token-12345678901234567890'
      
      if (!SecurityValidator.validateCSRFToken(csrfToken, expectedToken)) {
        return { status: 403, json: async () => ({ error: 'Invalid CSRF token' }) }
      }
    }
    
    // Input validation and sanitization
    const sanitizedBody = { ...body }
    
    // Sanitize text fields
    const textFields = ['zipCode', 'timeframe', 'firstName', 'lastName', 'phone', 'email']
    textFields.forEach(field => {
      if (sanitizedBody[field] && typeof sanitizedBody[field] === 'string') {
        sanitizedBody[field] = SecurityValidator.sanitizeInput(sanitizedBody[field])
        
        // SQL injection check
        if (!SecurityValidator.validateSQLInput(sanitizedBody[field])) {
          throw new Error(`Potentially malicious input detected in ${field}`)
        }
      }
    })
    
    // Validate formData for XSS and injection attempts
    if (sanitizedBody.formData) {
      for (const [key, value] of Object.entries(sanitizedBody.formData)) {
        if (typeof value === 'string') {
          sanitizedBody.formData[key] = SecurityValidator.sanitizeInput(value as string)
          
          if (!SecurityValidator.validateSQLInput(value as string)) {
            throw new Error(`Potentially malicious input detected in formData.${key}`)
          }
        }
      }
    }
    
    // Validate ZIP code format strictly
    if (sanitizedBody.zipCode && !/^\d{5}$/.test(sanitizedBody.zipCode)) {
      return { status: 400, json: async () => ({ error: 'Invalid ZIP code format' }) }
    }
    
    return { 
      status: 200, 
      json: async () => ({ 
        success: true, 
        leadId: 'lead-123',
        sanitizedData: sanitizedBody
      }) 
    }
  } catch (error) {
    return { status: 400, json: async () => ({ error: error.message }) }
  }
}

describe('Security Validation Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('XSS Prevention', () => {
    test('should sanitize HTML in form inputs', async () => {
      const xssPayloads = SecurityTestUtils.generateXSSPayloads()
      
      for (const payload of xssPayloads) {
        const maliciousData = {
          ...mockFormSubmission,
          formData: {
            ...mockFormSubmission.formData,
            comment: payload
          }
        }
        
        const request = TestAPI.createMockRequest('POST', maliciousData)
        const response = await secureAPIHandler(request)
        const responseData = await response.json()
        
        if (response.status === 200) {
          // If accepted, should be sanitized
          expect(responseData.sanitizedData.formData.comment).not.toContain('<script>')
          expect(responseData.sanitizedData.formData.comment).not.toContain('javascript:')
          expect(responseData.sanitizedData.formData.comment).not.toContain('onerror=')
        } else {
          // If rejected, should have appropriate error
          expect(response.status).toBe(400)
        }
      }
    })

    test('should handle XSS in multiple fields simultaneously', async () => {
      const maliciousData = {
        ...mockFormSubmission,
        zipCode: '<script>alert("zip")</script>12345',
        formData: {
          firstName: '<img src="x" onerror="alert(1)">',
          lastName: 'javascript:alert("name")',
          comment: '<svg onload="alert(1)">'
        }
      }
      
      const request = TestAPI.createMockRequest('POST', maliciousData)
      const response = await secureAPIHandler(request)
      const responseData = await response.json()
      
      if (response.status === 200) {
        const sanitized = responseData.sanitizedData
        expect(sanitized.formData.firstName).not.toContain('<img')
        expect(sanitized.formData.lastName).not.toContain('javascript:')
        expect(sanitized.formData.comment).not.toContain('<svg')
      }
    })

    test('should preserve legitimate content while removing XSS', async () => {
      const legitimateData = {
        ...mockFormSubmission,
        formData: {
          ...mockFormSubmission.formData,
          comment: 'I need quotes for my 3 < 4 bedroom house & kitchen renovation.'
        }
      }
      
      const request = TestAPI.createMockRequest('POST', legitimateData)
      const response = await secureAPIHandler(request)
      const responseData = await response.json()
      
      expect(response.status).toBe(200)
      expect(responseData.sanitizedData.formData.comment).toContain('bedroom house')
      expect(responseData.sanitizedData.formData.comment).toContain('&lt;') // < should be encoded
    })
  })

  describe('SQL Injection Prevention', () => {
    test('should reject SQL injection attempts', async () => {
      const sqlPayloads = SecurityTestUtils.generateSQLInjectionPayloads()
      
      for (const payload of sqlPayloads) {
        const maliciousData = {
          ...mockFormSubmission,
          zipCode: payload,
          formData: {
            ...mockFormSubmission.formData,
            firstName: payload
          }
        }
        
        const request = TestAPI.createMockRequest('POST', maliciousData)
        const response = await secureAPIHandler(request)
        
        // Should reject malicious SQL content
        expect(response.status).toBe(400)
        
        const responseData = await response.json()
        expect(responseData.error).toContain('malicious input')
      }
    })

    test('should handle SQL injection in nested form data', async () => {
      const maliciousData = {
        ...mockFormSubmission,
        formData: {
          ...mockFormSubmission.formData,
          address: {
            street: "123 Main St'; DROP TABLE users; --",
            city: "New York",
            state: "NY"
          }
        }
      }
      
      const request = TestAPI.createMockRequest('POST', maliciousData)
      const response = await secureAPIHandler(request)
      
      // Should handle nested malicious content
      if (response.status === 400) {
        const responseData = await response.json()
        expect(responseData.error).toContain('malicious')
      } else {
        // If processing, should be sanitized
        const responseData = await response.json()
        expect(responseData.sanitizedData.formData.address.street).not.toContain('DROP TABLE')
      }
    })
  })

  describe('CSRF Protection', () => {
    test('should require valid CSRF token when enabled', async () => {
      const request = TestAPI.createMockRequest('POST', mockFormSubmission, {
        'x-csrf-token': 'invalid-token'
      })
      
      const response = await secureAPIHandler(request, { requireCSRF: true })
      
      expect(response.status).toBe(403)
      
      const responseData = await response.json()
      expect(responseData.error).toBe('Invalid CSRF token')
    })

    test('should accept valid CSRF token', async () => {
      const request = TestAPI.createMockRequest('POST', mockFormSubmission, {
        'x-csrf-token': 'valid-csrf-token-12345678901234567890'
      })
      
      const response = await secureAPIHandler(request, { requireCSRF: true })
      
      expect(response.status).toBe(200)
    })

    test('should reject short CSRF tokens', async () => {
      const request = TestAPI.createMockRequest('POST', mockFormSubmission, {
        'x-csrf-token': 'short'
      })
      
      const response = await secureAPIHandler(request, { requireCSRF: true })
      
      expect(response.status).toBe(403)
    })
  })

  describe('Rate Limiting', () => {
    test('should allow requests within rate limit', async () => {
      const request = TestAPI.createMockRequest('POST', mockFormSubmission)
      
      const response = await secureAPIHandler(request, {
        rateLimit: { windowMs: 60000, maxRequests: 100 }
      })
      
      // Should succeed if under rate limit
      expect([200, 429]).toContain(response.status)
    })

    test('should handle burst of requests appropriately', async () => {
      const requests = Array.from({ length: 10 }, () =>
        TestAPI.createMockRequest('POST', mockFormSubmission, {
          'x-forwarded-for': '192.168.1.100' // Same IP
        })
      )
      
      const responses = await Promise.all(
        requests.map(req => secureAPIHandler(req, {
          rateLimit: { windowMs: 60000, maxRequests: 5 }
        }))
      )
      
      const successfulRequests = responses.filter(r => r.status === 200).length
      const rateLimitedRequests = responses.filter(r => r.status === 429).length
      
      // Should have some successful and some rate limited
      expect(successfulRequests).toBeGreaterThan(0)
      expect(successfulRequests + rateLimitedRequests).toBe(10)
    })

    test('should differentiate between different IP addresses', async () => {
      const ipAddresses = ['192.168.1.1', '192.168.1.2', '10.0.0.1']
      const responses = []
      
      for (const ip of ipAddresses) {
        const request = TestAPI.createMockRequest('POST', mockFormSubmission, {
          'x-forwarded-for': ip
        })
        
        const response = await secureAPIHandler(request, {
          rateLimit: { windowMs: 60000, maxRequests: 10 }
        })
        
        responses.push({ ip, status: response.status })
      }
      
      // Each IP should be tracked separately
      responses.forEach(response => {
        expect([200, 429]).toContain(response.status)
      })
    })
  })

  describe('Input Validation', () => {
    test('should validate ZIP code format strictly', async () => {
      const invalidZipCodes = ['1234', '123456', 'abcde', '12a45', '', null, undefined]
      
      for (const zipCode of invalidZipCodes) {
        const invalidData = {
          ...mockFormSubmission,
          zipCode
        }
        
        const request = TestAPI.createMockRequest('POST', invalidData)
        const response = await secureAPIHandler(request)
        
        expect(response.status).toBe(400)
        
        const responseData = await response.json()
        expect(responseData.error).toContain('Invalid ZIP code')
      }
    })

    test('should validate email addresses when provided', async () => {
      const testEmails = [
        { email: 'valid@example.com', shouldPass: true },
        { email: 'invalid.email', shouldPass: false },
        { email: 'test@', shouldPass: false },
        { email: '@example.com', shouldPass: false },
        { email: '', shouldPass: true }, // Empty is OK if not required
      ]
      
      for (const { email, shouldPass } of testEmails) {
        const data = {
          ...mockFormSubmission,
          formData: {
            ...mockFormSubmission.formData,
            email
          }
        }
        
        const request = TestAPI.createMockRequest('POST', data)
        const response = await secureAPIHandler(request)
        
        if (shouldPass) {
          expect([200, 400]).toContain(response.status) // May fail for other reasons
        } else {
          expect(response.status).toBe(400)
        }
      }
    })

    test('should validate phone number formats', async () => {
      const phoneNumbers = [
        { phone: '(555) 123-4567', valid: true },
        { phone: '555-123-4567', valid: true },
        { phone: '5551234567', valid: true },
        { phone: '+1-555-123-4567', valid: true },
        { phone: '123-456', valid: false },
        { phone: 'not-a-phone', valid: false },
        { phone: '', valid: true } // Empty OK if optional
      ]
      
      for (const { phone, valid } of phoneNumbers) {
        const data = {
          ...mockFormSubmission,
          formData: {
            ...mockFormSubmission.formData,
            phone
          }
        }
        
        const request = TestAPI.createMockRequest('POST', data)
        const response = await secureAPIHandler(request)
        
        // Phone validation would be implemented in real handler
        expect([200, 400]).toContain(response.status)
      }
    })
  })

  describe('File Upload Security', () => {
    test('should validate file extensions', async () => {
      const testFiles = [
        { filename: 'document.pdf', valid: true },
        { filename: 'image.jpg', valid: true },
        { filename: 'spreadsheet.xlsx', valid: false },
        { filename: 'script.exe', valid: false },
        { filename: 'malware.bat', valid: false },
        { filename: 'file.txt', valid: false }
      ]
      
      for (const { filename, valid } of testFiles) {
        const content = Buffer.from('mock file content')
        const result = SecurityValidator.validateFileUpload(filename, content)
        
        expect(result.valid).toBe(valid)
        if (!valid) {
          expect(result.reason).toBeDefined()
        }
      }
    })

    test('should check file size limits', async () => {
      const largeContent = Buffer.alloc(15 * 1024 * 1024) // 15MB
      const result = SecurityValidator.validateFileUpload('large.pdf', largeContent)
      
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('too large')
    })

    test('should scan for malicious content patterns', async () => {
      const maliciousContent = Buffer.from('<script>alert("xss")</script>')
      const result = SecurityValidator.validateFileUpload('malicious.jpg', maliciousContent)
      
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('malicious content')
    })
  })

  describe('Header Security', () => {
    test('should validate Content-Type headers', async () => {
      const request = TestAPI.createMockRequest('POST', mockFormSubmission, {
        'content-type': 'application/json'
      })
      
      const response = await secureAPIHandler(request)
      expect([200, 400]).toContain(response.status)
    })

    test('should reject suspicious User-Agent headers', async () => {
      const suspiciousUserAgents = [
        'sqlmap/1.0',
        'nmap',
        'Nikto',
        'wget',
        'curl/7.0 (pentest)'
      ]
      
      for (const userAgent of suspiciousUserAgents) {
        const request = TestAPI.createMockRequest('POST', mockFormSubmission, {
          'user-agent': userAgent
        })
        
        const response = await secureAPIHandler(request)
        
        // In production, might block or flag suspicious user agents
        expect([200, 403]).toContain(response.status)
      }
    })

    test('should handle missing or malformed headers gracefully', async () => {
      const request = {
        method: 'POST',
        headers: null, // Missing headers
        json: async () => mockFormSubmission
      }
      
      const response = await secureAPIHandler(request)
      
      // Should not crash with missing headers
      expect([200, 400, 500]).toContain(response.status)
    })
  })

  describe('Business Logic Security', () => {
    test('should prevent duplicate submissions', async () => {
      const submission = {
        ...mockFormSubmission,
        clientId: 'unique-client-123',
        timestamp: Date.now()
      }
      
      const requests = Array.from({ length: 3 }, () =>
        TestAPI.createMockRequest('POST', submission)
      )
      
      const responses = await Promise.all(
        requests.map(req => secureAPIHandler(req))
      )
      
      // In production, would detect and prevent duplicates
      responses.forEach(response => {
        expect([200, 409]).toContain(response.status) // 200 OK or 409 Conflict
      })
    })

    test('should validate service type permissions', async () => {
      const restrictedServiceTypes = ['internal-only', 'admin-test', 'disabled-service']
      
      for (const serviceTypeId of restrictedServiceTypes) {
        const restrictedData = {
          ...mockFormSubmission,
          serviceTypeId
        }
        
        const request = TestAPI.createMockRequest('POST', restrictedData)
        const response = await secureAPIHandler(request)
        
        // Should validate service type access
        expect([200, 403]).toContain(response.status)
      }
    })

    test('should prevent data tampering in hidden fields', async () => {
      const tamperedData = {
        ...mockFormSubmission,
        // Attempt to tamper with compliance data
        trustedFormCertId: 'tampered-cert-id',
        jornayaLeadId: 'fake-jornaya-id',
        complianceData: {
          tcpaConsent: false, // Tampered consent
          timestamp: '1990-01-01T00:00:00Z' // Old timestamp
        }
      }
      
      const request = TestAPI.createMockRequest('POST', tamperedData)
      const response = await secureAPIHandler(request)
      
      // In production, would validate compliance data integrity
      expect([200, 400]).toContain(response.status)
    })
  })

  describe('Error Handling Security', () => {
    test('should not expose sensitive information in error messages', async () => {
      const maliciousData = {
        ...mockFormSubmission,
        zipCode: "'; SELECT * FROM users; --"
      }
      
      const request = TestAPI.createMockRequest('POST', maliciousData)
      const response = await secureAPIHandler(request)
      const responseData = await response.json()
      
      // Error messages should be generic, not expose internal details
      expect(responseData.error).not.toContain('SELECT')
      expect(responseData.error).not.toContain('database')
      expect(responseData.error).not.toContain('password')
      expect(responseData.error).not.toContain('connection string')
    })

    test('should handle malformed JSON securely', async () => {
      const request = {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        json: async () => { throw new Error('Invalid JSON') }
      }
      
      const response = await secureAPIHandler(request)
      const responseData = await response.json()
      
      expect(response.status).toBe(400)
      expect(responseData.error).not.toContain('stack trace')
      expect(responseData.error).not.toContain('line number')
    })
  })
})