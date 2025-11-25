/**
 * Encryption Tests
 *
 * Verifies AES-256-GCM encryption for buyer credentials
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { encrypt, decrypt, isEncrypted, encryptIfNeeded, generateEncryptionKey } from '@/lib/security/encryption';

describe('Credential Encryption', () => {
  const originalKey = process.env.ENCRYPTION_KEY;

  beforeAll(() => {
    // Set test encryption key
    process.env.ENCRYPTION_KEY = generateEncryptionKey();
  });

  afterAll(() => {
    // Restore original key
    process.env.ENCRYPTION_KEY = originalKey;
  });

  describe('Basic Encryption/Decryption', () => {
    it('should encrypt and decrypt data correctly', () => {
      const plaintext = 'sensitive-api-key-12345';

      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
      expect(encrypted).not.toBe(plaintext);
    });

    it('should produce different ciphertext for same plaintext', () => {
      const plaintext = 'api-key-123';

      const encrypted1 = encrypt(plaintext);
      const encrypted2 = encrypt(plaintext);

      // Different due to random IV and salt
      expect(encrypted1).not.toBe(encrypted2);

      // But both decrypt to same plaintext
      expect(decrypt(encrypted1)).toBe(plaintext);
      expect(decrypt(encrypted2)).toBe(plaintext);
    });

    it('should handle special characters', () => {
      const plaintext = 'key!@#$%^&*(){}[]|\\:";\'<>?,./';

      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle unicode characters', () => {
      const plaintext = 'API密钥-תַשְׁלִיך-مفتاح-🔐';

      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle JSON strings', () => {
      const jsonData = JSON.stringify({
        apiKey: 'test-key',
        secret: 'test-secret',
        endpoint: 'https://api.example.com'
      });

      const encrypted = encrypt(jsonData);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(jsonData);

      const parsed = JSON.parse(decrypted);
      expect(parsed.apiKey).toBe('test-key');
    });
  });

  describe('Encryption Format', () => {
    it('should produce encrypted data in correct format', () => {
      const plaintext = 'test-data';
      const encrypted = encrypt(plaintext);

      // Format: salt:iv:authTag:ciphertext
      const parts = encrypted.split(':');

      expect(parts.length).toBe(4);

      // Verify each part is valid base64
      for (const part of parts) {
        expect(() => Buffer.from(part, 'base64')).not.toThrow();
      }
    });

    it('should have correct component lengths', () => {
      const encrypted = encrypt('test');
      const [salt, iv, authTag] = encrypted.split(':');

      // Salt: 32 bytes (256 bits)
      expect(Buffer.from(salt, 'base64').length).toBe(32);

      // IV: 16 bytes (128 bits)
      expect(Buffer.from(iv, 'base64').length).toBe(16);

      // Auth tag: 16 bytes (128 bits)
      expect(Buffer.from(authTag, 'base64').length).toBe(16);
    });
  });

  describe('Error Handling', () => {
    it('should throw error for empty plaintext', () => {
      expect(() => encrypt('')).toThrow('Plaintext is required');
    });

    it('should throw error for empty encrypted data', () => {
      expect(() => decrypt('')).toThrow('Encrypted data is required');
    });

    it('should throw error for invalid encrypted format', () => {
      expect(() => decrypt('invalid-format')).toThrow('Invalid encrypted data format');
    });

    it('should throw error for tampered ciphertext', () => {
      const encrypted = encrypt('test-data');
      const parts = encrypted.split(':');

      // Tamper with ciphertext
      parts[3] = Buffer.from('tampered').toString('base64');
      const tampered = parts.join(':');

      expect(() => decrypt(tampered)).toThrow();
    });

    it('should throw error for tampered auth tag', () => {
      const encrypted = encrypt('test-data');
      const parts = encrypted.split(':');

      // Tamper with auth tag
      parts[2] = Buffer.from('0'.repeat(16)).toString('base64');
      const tampered = parts.join(':');

      expect(() => decrypt(tampered)).toThrow();
    });

    it('should throw error when encryption key is missing', () => {
      const oldKey = process.env.ENCRYPTION_KEY;
      delete process.env.ENCRYPTION_KEY;

      expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY environment variable is required');

      process.env.ENCRYPTION_KEY = oldKey;
    });
  });

  describe('isEncrypted Helper', () => {
    it('should identify encrypted data', () => {
      const encrypted = encrypt('test-data');

      expect(isEncrypted(encrypted)).toBe(true);
    });

    it('should identify plaintext as not encrypted', () => {
      expect(isEncrypted('plaintext-data')).toBe(false);
      expect(isEncrypted('{"apiKey": "test"}')).toBe(false);
    });

    it('should handle invalid input', () => {
      expect(isEncrypted('')).toBe(false);
      expect(isEncrypted(null as any)).toBe(false);
      expect(isEncrypted(undefined as any)).toBe(false);
    });

    it('should reject malformed encrypted data', () => {
      expect(isEncrypted('part1:part2')).toBe(false);
      expect(isEncrypted('a:b:c:d')).toBe(false); // Wrong lengths
    });
  });

  describe('encryptIfNeeded Helper', () => {
    it('should encrypt plaintext', () => {
      const plaintext = 'api-key-123';

      const result = encryptIfNeeded(plaintext);

      expect(result).not.toBe(plaintext);
      expect(isEncrypted(result!)).toBe(true);
      expect(decrypt(result!)).toBe(plaintext);
    });

    it('should not double-encrypt', () => {
      const plaintext = 'api-key-123';

      const encrypted = encrypt(plaintext);
      const result = encryptIfNeeded(encrypted);

      // Should return the same encrypted value
      expect(result).toBe(encrypted);
    });

    it('should handle null values', () => {
      expect(encryptIfNeeded(null)).toBeNull();
    });
  });

  describe('Security Properties', () => {
    it('should use authenticated encryption (detect tampering)', () => {
      const encrypted = encrypt('important-data');
      const parts = encrypted.split(':');

      // Modify one bit in ciphertext
      const ciphertext = Buffer.from(parts[3], 'base64');
      ciphertext[0] ^= 1; // Flip one bit
      parts[3] = ciphertext.toString('base64');

      const tampered = parts.join(':');

      // Should fail authentication
      expect(() => decrypt(tampered)).toThrow();
    });

    it('should use unique IV for each encryption', () => {
      const plaintext = 'test';

      const encrypted1 = encrypt(plaintext);
      const encrypted2 = encrypt(plaintext);

      const iv1 = encrypted1.split(':')[1];
      const iv2 = encrypted2.split(':')[1];

      expect(iv1).not.toBe(iv2);
    });

    it('should use unique salt for key derivation', () => {
      const plaintext = 'test';

      const encrypted1 = encrypt(plaintext);
      const encrypted2 = encrypt(plaintext);

      const salt1 = encrypted1.split(':')[0];
      const salt2 = encrypted2.split(':')[0];

      expect(salt1).not.toBe(salt2);
    });

    it('should not expose plaintext in errors', () => {
      const plaintext = 'super-secret-key';

      try {
        const encrypted = encrypt(plaintext);
        const parts = encrypted.split(':');
        parts[3] = 'invalid';
        decrypt(parts.join(':'));
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        expect(message).not.toContain(plaintext);
      }
    });
  });

  describe('Data Types', () => {
    it('should handle empty strings after encryption setup', () => {
      // Note: encrypt('') throws, but we test the error
      expect(() => encrypt('')).toThrow();
    });

    it('should handle very long strings', () => {
      const longString = 'a'.repeat(10000);

      const encrypted = encrypt(longString);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(longString);
      expect(decrypted.length).toBe(10000);
    });

    it('should handle newlines and whitespace', () => {
      const plaintext = 'line1\nline2\r\nline3\ttab\t  spaces  ';

      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });
  });

  describe('Key Generation', () => {
    it('should generate valid encryption key', () => {
      const key = generateEncryptionKey();

      expect(key).toBeTruthy();
      expect(typeof key).toBe('string');

      // Should be base64 encoded 32 bytes
      const decoded = Buffer.from(key, 'base64');
      expect(decoded.length).toBe(32);
    });

    it('should generate unique keys', () => {
      const key1 = generateEncryptionKey();
      const key2 = generateEncryptionKey();

      expect(key1).not.toBe(key2);
    });
  });

  describe('Migration Scenarios', () => {
    it('should safely migrate plaintext credentials', () => {
      const credentials = [
        '{"apiKey": "key1"}',
        '{"apiKey": "key2"}',
        '{"apiKey": "key3"}'
      ];

      const encrypted = credentials.map(c => encryptIfNeeded(c));

      // All should be encrypted
      encrypted.forEach(e => {
        expect(isEncrypted(e!)).toBe(true);
      });

      // All should decrypt correctly
      encrypted.forEach((e, i) => {
        expect(decrypt(e!)).toBe(credentials[i]);
      });
    });

    it('should handle mixed encrypted/plaintext data', () => {
      const data = [
        'plaintext-1',
        encrypt('already-encrypted'),
        'plaintext-2'
      ];

      const results = data.map(d => encryptIfNeeded(d));

      // All should be encrypted
      results.forEach(r => {
        expect(isEncrypted(r!)).toBe(true);
      });
    });
  });
});
