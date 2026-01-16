/**
 * WHY: Prevent spoofed webhook calls from attackers.
 * WHEN: MUST be called at the start of EVERY Twilio webhook handler.
 * HOW: Uses Twilio's validateRequest with X-Twilio-Signature header.
 */

import twilio from 'twilio';
import { logger } from '@/lib/logger';
import * as Sentry from '@sentry/nextjs';

/**
 * Verify Twilio webhook signature
 * @param signature The X-Twilio-Signature header value
 * @param url The full URL of the webhook endpoint
 * @param params The request body as key-value pairs
 * @returns true if signature is valid
 */
export function verifyTwilioSignature(
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!authToken) {
    throw new Error('TWILIO_AUTH_TOKEN not configured');
  }

  return twilio.validateRequest(authToken, signature, url, params);
}

/**
 * Parse Twilio form data from request
 * @param request The incoming Request object
 * @returns Record of form data key-value pairs
 */
export async function parseTwilioFormData(
  request: Request
): Promise<Record<string, string>> {
  const formData = await request.formData();
  const body: Record<string, string> = {};

  formData.forEach((value, key) => {
    body[key] = value.toString();
  });

  return body;
}

/**
 * Build the verification URL handling proxy/load balancer scenarios
 * @param request The incoming Request object
 * @returns The URL to use for signature verification
 */
export function buildVerificationUrl(request: Request): string {
  const url = new URL(request.url);

  // Handle proxy/load balancer URL rewriting
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const host = request.headers.get('host');

  if (forwardedProto && host) {
    return `${forwardedProto}://${host}${url.pathname}${url.search}`;
  }

  return request.url;
}

/**
 * Result of webhook verification
 */
export interface VerificationResult {
  isValid: boolean;
  body: Record<string, string>;
  url: string;
}

/**
 * Verify a Twilio webhook request
 * @param request The incoming Request object
 * @returns Verification result with parsed body if valid
 */
export async function verifyWebhook(request: Request): Promise<VerificationResult> {
  const signature = request.headers.get('x-twilio-signature');
  const body = await parseTwilioFormData(request);
  const verifyUrl = buildVerificationUrl(request);

  if (!signature) {
    logger.warn({
      event: 'twilio.webhook.no_signature',
      message: 'Missing X-Twilio-Signature header',
      url: verifyUrl,
    });

    Sentry.captureMessage('Missing Twilio signature', {
      level: 'warning',
      tags: { component: 'twilio-webhook' },
      extra: { url: verifyUrl },
    });

    return { isValid: false, body, url: verifyUrl };
  }

  const isValid = verifyTwilioSignature(signature, verifyUrl, body);

  if (!isValid) {
    logger.warn({
      event: 'twilio.webhook.invalid_signature',
      message: 'Invalid Twilio signature',
      url: verifyUrl,
    });

    Sentry.captureMessage('Invalid Twilio signature', {
      level: 'warning',
      tags: { component: 'twilio-webhook' },
      extra: { url: verifyUrl },
    });
  }

  return { isValid, body, url: verifyUrl };
}

/**
 * Middleware wrapper for Twilio webhook handlers
 * @param request The incoming Request object
 * @param handler The handler function to execute if signature is valid
 * @returns Response from handler or error response
 */
export async function withTwilioVerification(
  request: Request,
  handler: (body: Record<string, string>) => Promise<Response>
): Promise<Response> {
  const { isValid, body, url } = await verifyWebhook(request);

  if (!isValid) {
    // Return 403 for invalid signature (will not retry)
    return new Response('Forbidden', {
      status: 403,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  logger.debug({
    event: 'twilio.webhook.verified',
    message: 'Webhook signature verified',
    url,
    callSid: body.CallSid,
  });

  // Signature valid - proceed with handler
  return handler(body);
}

/**
 * Create a TwiML response helper
 * @param twiml The TwiML string to return
 * @returns Response with correct content type
 */
export function createTwimlResponse(twiml: string): Response {
  return new Response(twiml, {
    status: 200,
    headers: { 'Content-Type': 'application/xml' },
  });
}

/**
 * Create an error response for Twilio webhooks
 * Note: Returning 5xx causes Twilio to retry, 4xx does not
 * @param message Error message
 * @param retry Whether Twilio should retry (true = 5xx, false = 4xx)
 * @returns Response with appropriate status code
 */
export function createWebhookErrorResponse(
  message: string,
  retry: boolean = false
): Response {
  const status = retry ? 500 : 400;
  return new Response(message, {
    status,
    headers: { 'Content-Type': 'text/plain' },
  });
}
