/**
 * Integration Tests: TrustedForm Service
 * Tests the TrustedForm certificate validation and compliance tracking
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { TrustedFormService } from '@/lib/external/trustedform';
import { AppError } from '@/lib/utils';

// Mock environment variables
const mockEnv = {
  TRUSTEDFORM_API_KEY: 'test_api_key_12345',
  TRUSTEDFORM_DOMAIN: 'example.com'
};

describe('TrustedForm Integration', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let originalFetch: any;

  beforeEach(() => {
    // Save original environment
    originalEnv = process.env;
    originalFetch = global.fetch;

    // Set mock environment
    process.env = { ...originalEnv, ...mockEnv };

    // Reset fetch mock
    global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  describe('Script Generation', () => {
    test('should generate TrustedForm tracking script', () => {
      const script = TrustedFormService.generateScript();

      expect(script).toContain('trustedform.js');
      expect(script).toContain('xxTrustedFormCertUrl');
      expect(script).toContain('xxTrustedFormPingUrl');
      expect(script).toContain('script');
    });

    test('should throw error if domain not configured', () => {
      delete process.env.TRUSTEDFORM_DOMAIN;

      expect(() => TrustedFormService.generateScript()).toThrow(AppError);
      expect(() => TrustedFormService.generateScript()).toThrow('TrustedForm domain not configured');
    });

    test('should include async and type attributes', () => {
      const script = TrustedFormService.generateScript();

      expect(script).toContain('async = true');
      expect(script).toContain('type = \'text/javascript\'');
    });
  });

  describe('Certificate Validation', () => {
    const mockCertUrl = 'https://cert.trustedform.com/abc123-def456';
    const mockCertResponse = {
      cert_url: mockCertUrl,
      cert_id: 'abc123-def456',
      form_url: 'https://example.com/form',
      created_at: '2025-10-20T10:00:00Z',
      ip: '192.168.1.1',
      user_agent: 'Mozilla/5.0',
      page_title: 'Contact Form',
      referrer: 'https://google.com'
    };

    test('should validate valid certificate', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockCertResponse
      } as Response);

      const result = await TrustedFormService.validateCertificate(mockCertUrl);

      expect(result).not.toBeNull();
      expect(result?.certUrl).toBe(mockCertUrl);
      expect(result?.certId).toBe('abc123-def456');
      expect(result?.ipAddress).toBe('192.168.1.1');
      expect(result?.userAgent).toBe('Mozilla/5.0');

      // Verify API was called correctly
      expect(global.fetch).toHaveBeenCalledWith(
        'https://cert.trustedform.com/api/v1/certificate',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Authorization': 'Bearer test_api_key_12345',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ cert_url: mockCertUrl })
        })
      );
    });

    test('should return null for 404 not found', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      } as Response);

      const result = await TrustedFormService.validateCertificate(mockCertUrl);

      expect(result).toBeNull();
    });

    test('should throw error for API errors', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      } as Response);

      await expect(TrustedFormService.validateCertificate(mockCertUrl)).rejects.toThrow(AppError);
      await expect(TrustedFormService.validateCertificate(mockCertUrl)).rejects.toThrow('TrustedForm API error: 500');
    });

    test('should throw error if API key not configured', async () => {
      delete process.env.TRUSTEDFORM_API_KEY;

      await expect(TrustedFormService.validateCertificate(mockCertUrl)).rejects.toThrow(AppError);
      await expect(TrustedFormService.validateCertificate(mockCertUrl)).rejects.toThrow('TrustedForm API key not configured');
    });

    test('should handle network errors', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockRejectedValueOnce(
        new Error('Network error')
      );

      await expect(TrustedFormService.validateCertificate(mockCertUrl)).rejects.toThrow(AppError);
      await expect(TrustedFormService.validateCertificate(mockCertUrl)).rejects.toThrow('Failed to validate TrustedForm certificate');
    });

    test('should handle malformed JSON response', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => { throw new Error('Invalid JSON'); }
      } as Response);

      await expect(TrustedFormService.validateCertificate(mockCertUrl)).rejects.toThrow();
    });
  });

  describe('Certificate Details', () => {
    const mockCertId = 'abc123-def456';
    const mockDetailsResponse = {
      cert_id: mockCertId,
      cert_url: 'https://cert.trustedform.com/abc123-def456',
      form_url: 'https://example.com/form',
      created_at: '2025-10-20T10:00:00Z',
      ip: '192.168.1.1',
      user_agent: 'Mozilla/5.0',
      page_title: 'Contact Form',
      referrer: 'https://google.com',
      form_data: { name: 'John Doe', email: 'john@example.com' },
      vendor: 'TrustedForm',
      masked_cert: '***-***-456'
    };

    test('should get certificate details', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockDetailsResponse
      } as Response);

      const result = await TrustedFormService.getCertificateDetails(mockCertId);

      expect(result).not.toBeNull();
      expect(result?.certId).toBe(mockCertId);
      expect(result?.formData).toEqual({ name: 'John Doe', email: 'john@example.com' });
      expect(result?.vendor).toBe('TrustedForm');
      expect(result?.maskedCert).toBe('***-***-456');

      // Verify API was called correctly
      expect(global.fetch).toHaveBeenCalledWith(
        `https://cert.trustedform.com/api/v1/certificate/${mockCertId}`,
        expect.objectContaining({
          method: 'GET',
          headers: {
            'Authorization': 'Bearer test_api_key_12345'
          }
        })
      );
    });

    test('should return null for 404 not found', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      } as Response);

      const result = await TrustedFormService.getCertificateDetails(mockCertId);

      expect(result).toBeNull();
    });

    test('should handle API errors', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden'
      } as Response);

      await expect(TrustedFormService.getCertificateDetails(mockCertId)).rejects.toThrow(AppError);
    });
  });

  describe('Hidden Fields Generation', () => {
    test('should generate hidden form fields', () => {
      const certUrl = 'https://cert.trustedform.com/abc123';
      const pingUrl = 'https://ping.trustedform.com/ping123';

      const fields = TrustedFormService.generateHiddenFields(certUrl, pingUrl);

      expect(fields).toContain(`name="xxTrustedFormCertUrl"`);
      expect(fields).toContain(`value="${certUrl}"`);
      expect(fields).toContain(`name="xxTrustedFormPingUrl"`);
      expect(fields).toContain(`value="${pingUrl}"`);
      expect(fields).toContain('name="xxTrustedFormToken"');
      expect(fields).toContain('type="hidden"');
    });

    test('should handle missing URLs', () => {
      const fields = TrustedFormService.generateHiddenFields();

      expect(fields).toContain('value=""');
    });

    test('should include timestamp token', () => {
      const beforeTime = Date.now();
      const fields = TrustedFormService.generateHiddenFields();
      const afterTime = Date.now();

      // Extract token value from fields
      const tokenMatch = fields.match(/name="xxTrustedFormToken" value="(\d+)"/);
      expect(tokenMatch).not.toBeNull();

      const tokenValue = parseInt(tokenMatch![1]);
      expect(tokenValue).toBeGreaterThanOrEqual(beforeTime);
      expect(tokenValue).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('Certificate URL Utilities', () => {
    test('should extract certificate ID from URL', () => {
      const url = 'https://cert.trustedform.com/abc123-def456-ghi789';
      const certId = TrustedFormService.extractCertificateFromUrl(url);

      expect(certId).toBe('abc123-def456-ghi789');
    });

    test('should return null for invalid URL', () => {
      const invalidUrls = [
        'https://example.com/cert',
        'http://cert.trustedform.com/abc123',
        'https://cert.trustedform.com/',
        'not-a-url'
      ];

      invalidUrls.forEach(url => {
        const certId = TrustedFormService.extractCertificateFromUrl(url);
        expect(certId).toBeNull();
      });
    });

    test('should validate certificate URL format', () => {
      const validUrls = [
        'https://cert.trustedform.com/abc123',
        'https://cert.trustedform.com/abc123-def456',
        'https://cert.trustedform.com/abc-123-def-456'
      ];

      validUrls.forEach(url => {
        expect(TrustedFormService.isValidCertificateUrl(url)).toBe(true);
      });
    });

    test('should reject invalid certificate URLs', () => {
      const invalidUrls = [
        'http://cert.trustedform.com/abc123', // HTTP instead of HTTPS
        'https://cert.trustedform.com/', // Missing cert ID
        'https://fake.trustedform.com/abc123', // Wrong domain
        'https://cert.trustedform.com/ABC123', // Uppercase not allowed
        'https://cert.trustedform.com/abc_123' // Underscore not allowed
      ];

      invalidUrls.forEach(url => {
        expect(TrustedFormService.isValidCertificateUrl(url)).toBe(false);
      });
    });
  });

  describe('Certificate Download', () => {
    test('should download certificate PDF', async () => {
      const mockPdfBuffer = Buffer.from('PDF content');
      const certUrl = 'https://cert.trustedform.com/abc123';

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        arrayBuffer: async () => mockPdfBuffer.buffer
      } as Response);

      const result = await TrustedFormService.downloadCertificate(certUrl);

      expect(result).not.toBeNull();
      expect(Buffer.isBuffer(result)).toBe(true);

      // Verify fetch called with correct headers
      expect(global.fetch).toHaveBeenCalledWith(
        certUrl,
        expect.objectContaining({
          method: 'GET',
          headers: {
            'Accept': 'application/pdf'
          }
        })
      );
    });

    test('should return null on download failure', async () => {
      const certUrl = 'https://cert.trustedform.com/abc123';

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: false,
        status: 404
      } as Response);

      const result = await TrustedFormService.downloadCertificate(certUrl);

      expect(result).toBeNull();
    });

    test('should handle network errors during download', async () => {
      const certUrl = 'https://cert.trustedform.com/abc123';

      (global.fetch as jest.MockedFunction<typeof fetch>).mockRejectedValueOnce(
        new Error('Network error')
      );

      const result = await TrustedFormService.downloadCertificate(certUrl);

      expect(result).toBeNull();
    });
  });

  describe('Compliance Reporting', () => {
    test('should generate compliance report', () => {
      const certificate = {
        certUrl: 'https://cert.trustedform.com/abc123',
        certId: 'abc123',
        formUrl: 'https://example.com/form',
        timestamp: new Date().toISOString(),
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        pageTitle: 'Contact Form',
        referrer: 'https://google.com'
      };

      const report = TrustedFormService.generateComplianceReport(certificate);

      expect(report.isCompliant).toBe(true);
      expect(report.certId).toBe('abc123');
      expect(report.timestamp).toBe(certificate.timestamp);
      expect(report.ipAddress).toBe('192.168.1.1');
      expect(report.complianceScore).toBeGreaterThan(0);
      expect(report.complianceScore).toBeLessThanOrEqual(100);
    });

    test('should calculate compliance score correctly', () => {
      // Perfect certificate (all fields, recent timestamp, correct domain)
      const perfectCert = {
        certUrl: 'https://cert.trustedform.com/abc123',
        certId: 'abc123',
        formUrl: 'https://example.com/form',
        timestamp: new Date().toISOString(), // Current time
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        pageTitle: 'Contact Form',
        referrer: 'https://google.com'
      };

      const perfectReport = TrustedFormService.generateComplianceReport(perfectCert);
      expect(perfectReport.complianceScore).toBe(100);

      // Minimal certificate (only cert URL)
      const minimalCert = {
        certUrl: 'https://cert.trustedform.com/abc123',
        certId: 'abc123',
        formUrl: '',
        timestamp: '',
        ipAddress: '',
        userAgent: '',
        pageTitle: '',
        referrer: ''
      };

      const minimalReport = TrustedFormService.generateComplianceReport(minimalCert);
      expect(minimalReport.complianceScore).toBe(40); // Base score only
    });

    test('should penalize old timestamps', () => {
      const oldTimestamp = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2 hours ago

      const certificate = {
        certUrl: 'https://cert.trustedform.com/abc123',
        certId: 'abc123',
        formUrl: 'https://example.com/form',
        timestamp: oldTimestamp,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        pageTitle: 'Contact Form',
        referrer: 'https://google.com'
      };

      const report = TrustedFormService.generateComplianceReport(certificate);
      expect(report.complianceScore).toBeLessThan(100); // No recent timestamp bonus
    });

    test('should reward matching domain', () => {
      const certificate = {
        certUrl: 'https://cert.trustedform.com/abc123',
        certId: 'abc123',
        formUrl: 'https://example.com/form', // Matches TRUSTEDFORM_DOMAIN
        timestamp: new Date().toISOString(),
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        pageTitle: 'Contact Form',
        referrer: 'https://google.com'
      };

      const report = TrustedFormService.generateComplianceReport(certificate);
      expect(report.complianceScore).toBeGreaterThanOrEqual(90); // Should have domain bonus
    });
  });

  describe('Error Scenarios', () => {
    test('should handle timeout errors', async () => {
      const certUrl = 'https://cert.trustedform.com/abc123';

      (global.fetch as jest.MockedFunction<typeof fetch>).mockImplementationOnce(
        () => new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      );

      await expect(TrustedFormService.validateCertificate(certUrl)).rejects.toThrow();
    }, 10000);

    test('should handle rate limiting', async () => {
      const certUrl = 'https://cert.trustedform.com/abc123';

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests'
      } as Response);

      await expect(TrustedFormService.validateCertificate(certUrl)).rejects.toThrow(AppError);
      await expect(TrustedFormService.validateCertificate(certUrl)).rejects.toThrow('TrustedForm API error: 429');
    });

    test('should handle authentication errors', async () => {
      const certUrl = 'https://cert.trustedform.com/abc123';

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      } as Response);

      await expect(TrustedFormService.validateCertificate(certUrl)).rejects.toThrow(AppError);
      await expect(TrustedFormService.validateCertificate(certUrl)).rejects.toThrow('TrustedForm API error: 401');
    });
  });

  describe('Integration with Lead Processing', () => {
    test('should validate certificate during lead creation', async () => {
      const mockCertResponse = {
        cert_url: 'https://cert.trustedform.com/abc123',
        cert_id: 'abc123',
        form_url: 'https://example.com/form',
        created_at: new Date().toISOString(),
        ip: '192.168.1.1',
        user_agent: 'Mozilla/5.0',
        page_title: 'Contact Form',
        referrer: 'https://google.com'
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockCertResponse
      } as Response);

      const certUrl = 'https://cert.trustedform.com/abc123';
      const certificate = await TrustedFormService.validateCertificate(certUrl);

      expect(certificate).not.toBeNull();
      expect(certificate?.certUrl).toBe(certUrl);

      // Generate compliance report
      const report = TrustedFormService.generateComplianceReport(certificate!);

      expect(report.isCompliant).toBe(true);
      expect(report.complianceScore).toBeGreaterThan(0);
    });

    test('should handle missing certificates gracefully', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      } as Response);

      const certificate = await TrustedFormService.validateCertificate(
        'https://cert.trustedform.com/nonexistent'
      );

      // Should return null, not throw
      expect(certificate).toBeNull();

      // Lead creation should continue even without certificate
      // (in production, this might be flagged for review)
    });
  });
});
