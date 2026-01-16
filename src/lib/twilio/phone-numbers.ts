/**
 * WHY: Affiliates need tracking numbers to attribute calls.
 * WHEN: Called when affiliate provisions a new number for a campaign.
 * HOW: Uses Twilio API with rate limiting and circuit breaker.
 */

import { getTwilioClient } from './client';
import { rateLimitedTwilioCall } from './rate-limiter';
import { withCircuitBreaker } from './circuit-breaker';
import { retryWithBackoff } from './retry';
import { logTwilioApiCall } from './logging';
import { logger } from '@/lib/logger';

export interface ProvisionedNumber {
  phoneNumber: string; // E.164 format (+15551234567)
  sid: string; // Twilio Phone Number SID (PNxxxxxxxx)
  displayNumber: string; // Formatted for display: (555) 123-4567
}

export interface ProvisionOptions {
  areaCode?: string;
  tollFree?: boolean;
  affiliateId: string;
  campaignId: string;
}

/**
 * Provision a new phone number from Twilio
 * @param options Configuration for the phone number
 * @returns ProvisionedNumber with phone number, SID, and display format
 */
export async function provisionPhoneNumber(
  options: ProvisionOptions
): Promise<ProvisionedNumber> {
  const { areaCode, tollFree = true, affiliateId, campaignId } = options;

  logger.info({
    event: 'twilio.provision.start',
    message: 'Provisioning new phone number',
    areaCode,
    tollFree,
    affiliateId,
    campaignId,
  });

  const startTime = Date.now();

  try {
    const result = await withCircuitBreaker(async () => {
      return rateLimitedTwilioCall(async () => {
        return retryWithBackoff(async () => {
          const client = getTwilioClient();
          const baseUrl =
            process.env.NEXT_PUBLIC_BASE_URL || process.env.BASE_URL;

          if (!baseUrl) {
            throw new Error(
              'BASE_URL or NEXT_PUBLIC_BASE_URL environment variable is required for webhook configuration'
            );
          }

          // Configure creation options
          const createOptions: {
            voiceUrl: string;
            voiceMethod: 'POST';
            statusCallback: string;
            statusCallbackMethod: 'POST';
            friendlyName: string;
            areaCode?: string;
          } = {
            voiceUrl: `${baseUrl}/api/calls/incoming`,
            voiceMethod: 'POST',
            statusCallback: `${baseUrl}/api/calls/status`,
            statusCallbackMethod: 'POST',
            friendlyName: `Affiliate-${affiliateId}-Campaign-${campaignId}`,
          };

          // For toll-free, search by area code (844, 855, 888, etc.)
          // For local numbers, search by requested area code
          if (tollFree) {
            createOptions.areaCode = areaCode || '844';
          } else if (areaCode) {
            createOptions.areaCode = areaCode;
          }

          // Create the phone number
          const number = await client.incomingPhoneNumbers.create(createOptions);

          logger.info({
            event: 'twilio.provision.success',
            message: 'Phone number provisioned successfully',
            phoneNumber: number.phoneNumber,
            sid: number.sid,
          });

          return {
            phoneNumber: number.phoneNumber,
            sid: number.sid,
            displayNumber: formatPhoneNumber(number.phoneNumber),
          };
        });
      });
    });

    logTwilioApiCall({
      operation: 'provisionPhoneNumber',
      success: true,
      duration: Date.now() - startTime,
      details: {
        affiliateId,
        campaignId,
        phoneNumber: result.phoneNumber,
      },
    });

    return result;
  } catch (error) {
    logTwilioApiCall({
      operation: 'provisionPhoneNumber',
      success: false,
      duration: Date.now() - startTime,
      error: (error as Error).message,
      details: { affiliateId, campaignId },
    });
    throw error;
  }
}

/**
 * Release a phone number back to Twilio
 * @param sid The Twilio Phone Number SID to release
 */
export async function releasePhoneNumber(sid: string): Promise<void> {
  logger.info({
    event: 'twilio.release.start',
    message: 'Releasing phone number',
    sid,
  });

  const startTime = Date.now();

  try {
    await withCircuitBreaker(async () => {
      return rateLimitedTwilioCall(async () => {
        return retryWithBackoff(async () => {
          const client = getTwilioClient();
          await client.incomingPhoneNumbers(sid).remove();

          logger.info({
            event: 'twilio.release.success',
            message: 'Phone number released successfully',
            sid,
          });
        });
      });
    });

    logTwilioApiCall({
      operation: 'releasePhoneNumber',
      success: true,
      duration: Date.now() - startTime,
      details: { sid },
    });
  } catch (error) {
    logTwilioApiCall({
      operation: 'releasePhoneNumber',
      success: false,
      duration: Date.now() - startTime,
      error: (error as Error).message,
      details: { sid },
    });
    throw error;
  }
}

/**
 * Update webhook URLs for an existing phone number
 * @param sid The Twilio Phone Number SID
 * @param webhookUrls New webhook configuration
 */
export async function updatePhoneNumberWebhooks(
  sid: string,
  webhookUrls: {
    voiceUrl?: string;
    statusCallback?: string;
  }
): Promise<void> {
  logger.info({
    event: 'twilio.update_webhooks.start',
    message: 'Updating phone number webhooks',
    sid,
  });

  const startTime = Date.now();

  try {
    await withCircuitBreaker(async () => {
      return rateLimitedTwilioCall(async () => {
        const client = getTwilioClient();
        await client.incomingPhoneNumbers(sid).update(webhookUrls);

        logger.info({
          event: 'twilio.update_webhooks.success',
          message: 'Phone number webhooks updated successfully',
          sid,
        });
      });
    });

    logTwilioApiCall({
      operation: 'updatePhoneNumberWebhooks',
      success: true,
      duration: Date.now() - startTime,
      details: { sid },
    });
  } catch (error) {
    logTwilioApiCall({
      operation: 'updatePhoneNumberWebhooks',
      success: false,
      duration: Date.now() - startTime,
      error: (error as Error).message,
      details: { sid },
    });
    throw error;
  }
}

/**
 * Format phone number from E.164 to display format
 * @param e164 Phone number in E.164 format (+15551234567)
 * @returns Formatted phone number: (555) 123-4567
 */
export function formatPhoneNumber(e164: string): string {
  // Remove all non-digit characters
  const digits = e164.replace(/\D/g, '');

  // Handle US/Canada numbers (11 digits starting with 1)
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  // Handle US/Canada numbers (10 digits)
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  // Return original if not a standard format
  return e164;
}

/**
 * Parse display format back to E.164
 * @param displayNumber Phone number in display format
 * @returns E.164 format (+15551234567)
 */
export function parsePhoneNumber(displayNumber: string): string {
  // Remove all non-digit characters
  const digits = displayNumber.replace(/\D/g, '');

  // Add +1 for US/Canada numbers
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  // Return with + prefix if not already present
  return displayNumber.startsWith('+') ? displayNumber : `+${digits}`;
}
