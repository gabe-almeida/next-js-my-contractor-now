/**
 * Encryption utilities for sensitive buyer credentials
 *
 * Uses AES-256-GCM for authenticated encryption with associated data (AEAD)
 * Provides confidentiality, integrity, and authenticity
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32; // 256 bits

/**
 * Get encryption key from environment variable
 * In production, this should be stored in a secure key management service
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    throw new Error(
      'ENCRYPTION_KEY environment variable is required. ' +
      'Generate with: openssl rand -base64 32'
    );
  }

  // Decode base64 key to buffer
  try {
    const keyBuffer = Buffer.from(key, 'base64');

    if (keyBuffer.length !== 32) {
      throw new Error('Encryption key must be 32 bytes (256 bits)');
    }

    return keyBuffer;
  } catch (error) {
    throw new Error('Invalid encryption key format. Must be base64-encoded 32 bytes.');
  }
}

/**
 * Derive encryption key from master key and salt using PBKDF2
 * This adds an extra layer of security and allows key rotation
 */
function deriveKey(masterKey: Buffer, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(
    masterKey,
    salt,
    100000, // iterations
    32,     // key length (256 bits)
    'sha256'
  );
}

/**
 * Encrypt sensitive data using AES-256-GCM
 *
 * @param plaintext - The data to encrypt
 * @returns Encrypted data in format: salt:iv:authTag:ciphertext (all base64)
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) {
    throw new Error('Plaintext is required for encryption');
  }

  try {
    // Generate random salt for key derivation
    const salt = crypto.randomBytes(SALT_LENGTH);

    // Generate random IV (initialization vector)
    const iv = crypto.randomBytes(IV_LENGTH);

    // Derive encryption key from master key and salt
    const masterKey = getEncryptionKey();
    const derivedKey = deriveKey(masterKey, salt);

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv);

    // Encrypt the data
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    // Return format: salt:iv:authTag:ciphertext
    return [
      salt.toString('base64'),
      iv.toString('base64'),
      authTag.toString('base64'),
      encrypted
    ].join(':');
  } catch (error) {
    // Never expose plaintext in error messages
    throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Decrypt data encrypted with encrypt()
 *
 * @param encryptedData - Encrypted data in format: salt:iv:authTag:ciphertext
 * @returns Decrypted plaintext
 */
export function decrypt(encryptedData: string): string {
  if (!encryptedData) {
    throw new Error('Encrypted data is required for decryption');
  }

  try {
    // Parse encrypted data
    const parts = encryptedData.split(':');

    if (parts.length !== 4) {
      throw new Error('Invalid encrypted data format');
    }

    const [saltB64, ivB64, authTagB64, ciphertext] = parts;

    // Decode components
    const salt = Buffer.from(saltB64, 'base64');
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');

    // Validate lengths
    if (salt.length !== SALT_LENGTH) {
      throw new Error('Invalid salt length');
    }
    if (iv.length !== IV_LENGTH) {
      throw new Error('Invalid IV length');
    }
    if (authTag.length !== AUTH_TAG_LENGTH) {
      throw new Error('Invalid auth tag length');
    }

    // Derive decryption key
    const masterKey = getEncryptionKey();
    const derivedKey = deriveKey(masterKey, salt);

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv);
    decipher.setAuthTag(authTag);

    // Decrypt the data
    let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    // Never expose encrypted data in error messages
    throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Check if a string is encrypted (matches our format)
 */
export function isEncrypted(data: string): boolean {
  if (!data || typeof data !== 'string') {
    return false;
  }

  const parts = data.split(':');

  // Check format: salt:iv:authTag:ciphertext
  if (parts.length !== 4) {
    return false;
  }

  try {
    // Try to decode each part to verify it's valid base64
    const [salt, iv, authTag] = parts;

    return (
      Buffer.from(salt, 'base64').length === SALT_LENGTH &&
      Buffer.from(iv, 'base64').length === IV_LENGTH &&
      Buffer.from(authTag, 'base64').length === AUTH_TAG_LENGTH
    );
  } catch {
    return false;
  }
}

/**
 * Safely encrypt or return already encrypted data
 * Used for migration - won't double-encrypt
 */
export function encryptIfNeeded(data: string | null): string | null {
  if (!data) {
    return null;
  }

  // Already encrypted
  if (isEncrypted(data)) {
    return data;
  }

  // Encrypt plaintext
  return encrypt(data);
}

/**
 * Generate a secure random encryption key
 * This should be run once and stored securely in environment variables
 */
export function generateEncryptionKey(): string {
  const key = crypto.randomBytes(32); // 256 bits
  return key.toString('base64');
}

/**
 * Re-encrypt data with a new key (for key rotation)
 */
export function reencrypt(encryptedData: string, newMasterKey: string): string {
  // First decrypt with old key
  const plaintext = decrypt(encryptedData);

  // Then encrypt with new key
  const oldKey = process.env.ENCRYPTION_KEY;
  process.env.ENCRYPTION_KEY = newMasterKey;

  try {
    const reencrypted = encrypt(plaintext);
    return reencrypted;
  } finally {
    // Restore old key
    process.env.ENCRYPTION_KEY = oldKey;
  }
}
