/**
 * Webhook Signature Generation and Verification
 *
 * Implements HMAC-SHA256 signatures for webhook security to prevent:
 * - Unauthorized webhook submissions
 * - Man-in-the-middle attacks
 * - Replay attacks (with timestamp validation)
 */

import crypto from 'crypto';

/**
 * Generate a secure random webhook secret
 * Returns a 64-character hex string (32 bytes)
 */
export function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate HMAC-SHA256 signature for webhook payload
 *
 * @param payload - The webhook payload (typically JSON string)
 * @param secret - The shared secret key
 * @returns 64-character hex signature
 */
export function generateWebhookSignature(
  payload: string,
  secret: string
): string {
  if (!secret) {
    throw new Error('Webhook secret is required for signature generation');
  }

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload, 'utf8');
  return hmac.digest('hex');
}

/**
 * Verify webhook signature using constant-time comparison
 *
 * @param payload - The webhook payload received
 * @param signature - The signature to verify
 * @param secret - The shared secret key
 * @param options - Optional validation options
 * @returns true if signature is valid, false otherwise
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string | null | undefined,
  secret: string,
  options?: {
    maxAge?: number; // Maximum age in seconds (for replay protection)
  }
): boolean {
  try {
    // Validate inputs
    if (!signature || typeof signature !== 'string') {
      return false;
    }

    if (!secret) {
      return false;
    }

    // Normalize signature to lowercase for comparison
    const normalizedSignature = signature.toLowerCase();

    // Check signature format (must be 64 hex characters for SHA256)
    if (!/^[a-f0-9]{64}$/.test(normalizedSignature)) {
      return false;
    }

    // Generate expected signature
    const expectedSignature = generateWebhookSignature(payload, secret);

    // Use constant-time comparison to prevent timing attacks
    const signatureBuffer = Buffer.from(normalizedSignature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    // Ensure both buffers are same length
    if (signatureBuffer.length !== expectedBuffer.length) {
      return false;
    }

    // Constant-time comparison
    const isValid = crypto.timingSafeEqual(signatureBuffer, expectedBuffer);

    // If signature is valid and timestamp validation requested
    if (isValid && options?.maxAge) {
      return validateTimestamp(payload, options.maxAge);
    }

    return isValid;
  } catch (error) {
    // Never leak secret or signature in error messages
    console.error('Webhook signature verification failed:', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return false;
  }
}

/**
 * Validate timestamp in payload for replay protection
 *
 * @param payload - The JSON payload containing timestamp
 * @param maxAge - Maximum age in seconds
 * @returns true if timestamp is within acceptable range
 */
function validateTimestamp(payload: string, maxAge: number): boolean {
  try {
    const data = JSON.parse(payload);

    if (!data.timestamp || typeof data.timestamp !== 'number') {
      return false;
    }

    const now = Math.floor(Date.now() / 1000);
    const timestamp = data.timestamp;

    // Check if timestamp is too old
    if (now - timestamp > maxAge) {
      return false;
    }

    // Check if timestamp is in the future (clock skew tolerance: 30 seconds)
    if (timestamp - now > 30) {
      return false;
    }

    return true;
  } catch (error) {
    // Invalid JSON or missing timestamp
    return false;
  }
}

/**
 * Create a signed webhook payload with timestamp
 *
 * @param data - The data to send
 * @param secret - The webhook secret
 * @returns Object with payload and signature
 */
export function createSignedWebhookPayload(
  data: any,
  secret: string
): { payload: string; signature: string; timestamp: number } {
  const timestamp = Math.floor(Date.now() / 1000);
  const payloadWithTimestamp = {
    ...data,
    timestamp
  };

  const payload = JSON.stringify(payloadWithTimestamp);
  const signature = generateWebhookSignature(payload, secret);

  return {
    payload,
    signature,
    timestamp
  };
}
