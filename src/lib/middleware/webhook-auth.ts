/**
 * Webhook Authentication Middleware
 *
 * Verifies webhook signatures to prevent unauthorized access
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature } from '../security/webhook-signatures';
import { prisma } from '../db';
import { decrypt, isEncrypted } from '../security/encryption';

const WEBHOOK_MAX_AGE = 300; // 5 minutes

/**
 * Middleware to verify webhook signatures
 *
 * Expected headers:
 * - X-Webhook-Signature: HMAC-SHA256 signature
 * - X-Buyer-Id: Buyer identifier (optional, can be in URL)
 *
 * @param request - NextRequest object
 * @param buyerId - Buyer ID (from URL param or header)
 * @param bodyText - Pre-read request body as text (optional)
 * @returns Object with error (if failed) and body text
 */
export async function verifyWebhookAuth(
  request: NextRequest,
  buyerId: string,
  bodyText?: string
): Promise<{ error?: NextResponse; body?: string }> {
  try {
    // Get signature from header
    const signature = request.headers.get('X-Webhook-Signature');

    if (!signature) {
      return {
        error: NextResponse.json(
          {
            error: 'Missing webhook signature',
            message: 'X-Webhook-Signature header is required'
          },
          { status: 401 }
        )
      };
    }

    // Get buyer and their webhook secret
    const buyer = await prisma.buyer.findUnique({
      where: { id: buyerId },
      select: {
        id: true,
        name: true,
        webhookSecret: true,
        active: true
      }
    });

    if (!buyer) {
      return {
        error: NextResponse.json(
          {
            error: 'Buyer not found',
            message: 'Invalid buyer ID'
          },
          { status: 404 }
        )
      };
    }

    if (!buyer.active) {
      return {
        error: NextResponse.json(
          {
            error: 'Buyer inactive',
            message: 'Buyer account is not active'
          },
          { status: 403 }
        )
      };
    }

    if (!buyer.webhookSecret) {
      return {
        error: NextResponse.json(
          {
            error: 'Webhook not configured',
            message: 'Webhook secret not configured for this buyer'
          },
          { status: 403 }
        )
      };
    }

    // Read request body if not provided
    const body = bodyText || (await request.text());

    // Decrypt webhook secret if encrypted
    const webhookSecret = isEncrypted(buyer.webhookSecret)
      ? decrypt(buyer.webhookSecret)
      : buyer.webhookSecret;

    // Verify signature
    const isValid = verifyWebhookSignature(
      body,
      signature,
      webhookSecret,
      {
        maxAge: WEBHOOK_MAX_AGE
      }
    );

    if (!isValid) {
      // Log failed verification attempt
      console.warn('Webhook signature verification failed', {
        buyerId: buyer.id,
        buyerName: buyer.name,
        signatureProvided: !!signature,
        timestamp: new Date().toISOString()
      });

      return {
        error: NextResponse.json(
          {
            error: 'Invalid signature',
            message: 'Webhook signature verification failed'
          },
          { status: 401 }
        )
      };
    }

    // Signature is valid - return body for parsing
    return { body };
  } catch (error) {
    console.error('Webhook authentication error:', error);

    return {
      error: NextResponse.json(
        {
          error: 'Authentication error',
          message: 'Failed to verify webhook authentication'
        },
        { status: 500 }
      )
    };
  }
}

/**
 * Express-style middleware wrapper for API routes
 */
export function createWebhookAuthMiddleware(getBuyerId: (req: NextRequest) => string) {
  return async (request: NextRequest) => {
    const buyerId = getBuyerId(request);
    return await verifyWebhookAuth(request, buyerId);
  };
}
