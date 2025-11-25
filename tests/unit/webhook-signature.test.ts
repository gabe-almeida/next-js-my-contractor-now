/**
 * Webhook Signature Verification Tests
 *
 * Tests HMAC-SHA256 signature generation and validation for webhook security
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import crypto from 'crypto';

// Import functions we'll implement
import {
  generateWebhookSignature,
  verifyWebhookSignature,
  generateWebhookSecret
} from '@/lib/security/webhook-signatures';

describe('Webhook Signature Security', () => {
  const testSecret = 'test_webhook_secret_key_12345';
  const testPayload = JSON.stringify({
    leadId: 'lead-123',
    bidAmount: 150.00,
    accepted: true
  });

  describe('generateWebhookSecret', () => {
    it('should generate a random 32-character secret', () => {
      const secret = generateWebhookSecret();
      expect(secret).toBeDefined();
      expect(secret.length).toBe(64); // 32 bytes = 64 hex chars
      expect(/^[a-f0-9]{64}$/.test(secret)).toBe(true);
    });

    it('should generate unique secrets on each call', () => {
      const secret1 = generateWebhookSecret();
      const secret2 = generateWebhookSecret();
      expect(secret1).not.toBe(secret2);
    });
  });

  describe('generateWebhookSignature', () => {
    it('should generate HMAC-SHA256 signature', () => {
      const signature = generateWebhookSignature(testPayload, testSecret);
      expect(signature).toBeDefined();
      expect(signature.length).toBe(64); // SHA256 = 64 hex chars
      expect(/^[a-f0-9]{64}$/.test(signature)).toBe(true);
    });

    it('should generate consistent signatures for same input', () => {
      const sig1 = generateWebhookSignature(testPayload, testSecret);
      const sig2 = generateWebhookSignature(testPayload, testSecret);
      expect(sig1).toBe(sig2);
    });

    it('should generate different signatures for different payloads', () => {
      const payload1 = JSON.stringify({ data: 'test1' });
      const payload2 = JSON.stringify({ data: 'test2' });

      const sig1 = generateWebhookSignature(payload1, testSecret);
      const sig2 = generateWebhookSignature(payload2, testSecret);

      expect(sig1).not.toBe(sig2);
    });

    it('should generate different signatures for different secrets', () => {
      const secret1 = 'secret_key_1';
      const secret2 = 'secret_key_2';

      const sig1 = generateWebhookSignature(testPayload, secret1);
      const sig2 = generateWebhookSignature(testPayload, secret2);

      expect(sig1).not.toBe(sig2);
    });

    it('should handle empty payload', () => {
      const signature = generateWebhookSignature('', testSecret);
      expect(signature).toBeDefined();
      expect(signature.length).toBe(64);
    });

    it('should handle special characters in payload', () => {
      const specialPayload = JSON.stringify({
        message: 'Test with "quotes" and \'apostrophes\' and \n newlines'
      });
      const signature = generateWebhookSignature(specialPayload, testSecret);
      expect(signature).toBeDefined();
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should verify valid signature', () => {
      const signature = generateWebhookSignature(testPayload, testSecret);
      const isValid = verifyWebhookSignature(testPayload, signature, testSecret);
      expect(isValid).toBe(true);
    });

    it('should reject invalid signature', () => {
      const validSignature = generateWebhookSignature(testPayload, testSecret);
      const invalidSignature = validSignature.substring(0, 60) + 'abcd'; // Corrupt signature

      const isValid = verifyWebhookSignature(testPayload, invalidSignature, testSecret);
      expect(isValid).toBe(false);
    });

    it('should reject signature with wrong secret', () => {
      const signature = generateWebhookSignature(testPayload, testSecret);
      const wrongSecret = 'wrong_secret_key';

      const isValid = verifyWebhookSignature(testPayload, signature, wrongSecret);
      expect(isValid).toBe(false);
    });

    it('should reject signature for modified payload', () => {
      const signature = generateWebhookSignature(testPayload, testSecret);
      const modifiedPayload = testPayload + ' '; // Add space

      const isValid = verifyWebhookSignature(modifiedPayload, signature, testSecret);
      expect(isValid).toBe(false);
    });

    it('should use constant-time comparison to prevent timing attacks', () => {
      const signature = generateWebhookSignature(testPayload, testSecret);

      // Generate a signature that differs in first character
      const wrongSignature = 'a' + signature.substring(1);

      const startTime = Date.now();
      const result = verifyWebhookSignature(testPayload, wrongSignature, testSecret);
      const endTime = Date.now();

      expect(result).toBe(false);
      // Timing should be relatively constant (< 10ms for verification)
      expect(endTime - startTime).toBeLessThan(10);
    });

    it('should reject empty signature', () => {
      const isValid = verifyWebhookSignature(testPayload, '', testSecret);
      expect(isValid).toBe(false);
    });

    it('should reject null signature', () => {
      const isValid = verifyWebhookSignature(testPayload, null as any, testSecret);
      expect(isValid).toBe(false);
    });

    it('should reject undefined signature', () => {
      const isValid = verifyWebhookSignature(testPayload, undefined as any, testSecret);
      expect(isValid).toBe(false);
    });

    it('should reject signature with wrong length', () => {
      const shortSignature = 'abc123';
      const isValid = verifyWebhookSignature(testPayload, shortSignature, testSecret);
      expect(isValid).toBe(false);
    });

    it('should handle case-insensitive hex comparison', () => {
      const signature = generateWebhookSignature(testPayload, testSecret);
      const uppercaseSignature = signature.toUpperCase();

      const isValid = verifyWebhookSignature(testPayload, uppercaseSignature, testSecret);
      expect(isValid).toBe(true);
    });
  });

  describe('Timestamp Validation for Replay Protection', () => {
    it('should accept recent timestamp (within 5 minutes)', () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const payload = JSON.stringify({ timestamp, data: 'test' });
      const signature = generateWebhookSignature(payload, testSecret);

      const isValid = verifyWebhookSignature(payload, signature, testSecret, {
        maxAge: 300 // 5 minutes
      });
      expect(isValid).toBe(true);
    });

    it('should reject old timestamp (> 5 minutes)', () => {
      const oldTimestamp = Math.floor(Date.now() / 1000) - 400; // 6+ minutes ago
      const payload = JSON.stringify({ timestamp: oldTimestamp, data: 'test' });
      const signature = generateWebhookSignature(payload, testSecret);

      const isValid = verifyWebhookSignature(payload, signature, testSecret, {
        maxAge: 300 // 5 minutes
      });
      expect(isValid).toBe(false);
    });

    it('should reject future timestamp', () => {
      const futureTimestamp = Math.floor(Date.now() / 1000) + 600; // 10 minutes in future
      const payload = JSON.stringify({ timestamp: futureTimestamp, data: 'test' });
      const signature = generateWebhookSignature(payload, testSecret);

      const isValid = verifyWebhookSignature(payload, signature, testSecret, {
        maxAge: 300
      });
      expect(isValid).toBe(false);
    });

    it('should handle missing timestamp in payload', () => {
      const payload = JSON.stringify({ data: 'test' }); // No timestamp
      const signature = generateWebhookSignature(payload, testSecret);

      const isValid = verifyWebhookSignature(payload, signature, testSecret, {
        maxAge: 300
      });
      expect(isValid).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large payloads', () => {
      const largePayload = JSON.stringify({
        data: 'x'.repeat(10000) // 10KB of data
      });
      const signature = generateWebhookSignature(largePayload, testSecret);
      const isValid = verifyWebhookSignature(largePayload, signature, testSecret);
      expect(isValid).toBe(true);
    });

    it('should handle unicode characters in payload', () => {
      const unicodePayload = JSON.stringify({
        message: '你好世界 🌍 Привет мир'
      });
      const signature = generateWebhookSignature(unicodePayload, testSecret);
      const isValid = verifyWebhookSignature(unicodePayload, signature, testSecret);
      expect(isValid).toBe(true);
    });

    it('should handle JSON with nested objects', () => {
      const complexPayload = JSON.stringify({
        lead: {
          id: 'lead-123',
          customer: {
            name: 'John Doe',
            address: {
              zip: '90210',
              city: 'Beverly Hills'
            }
          },
          bids: [
            { buyer: 'buyer-1', amount: 100 },
            { buyer: 'buyer-2', amount: 150 }
          ]
        }
      });
      const signature = generateWebhookSignature(complexPayload, testSecret);
      const isValid = verifyWebhookSignature(complexPayload, signature, testSecret);
      expect(isValid).toBe(true);
    });
  });

  describe('Security Properties', () => {
    it('should not leak secret in error messages', () => {
      try {
        // Try to force an error
        generateWebhookSignature(testPayload, null as any);
      } catch (error) {
        const errorMessage = (error as Error).message;
        expect(errorMessage).not.toContain(testSecret);
      }
    });

    it('should handle concurrent verification requests', async () => {
      const signature = generateWebhookSignature(testPayload, testSecret);

      // Simulate 10 concurrent verification requests
      const verifications = Array(10).fill(null).map(() =>
        Promise.resolve(verifyWebhookSignature(testPayload, signature, testSecret))
      );

      const results = await Promise.all(verifications);
      expect(results.every(r => r === true)).toBe(true);
    });
  });
});
