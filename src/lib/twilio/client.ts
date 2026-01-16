/**
 * WHY: Centralized Twilio SDK initialization with lazy loading.
 * WHEN: Import from any file needing Twilio API access.
 * HOW: Creates single client instance, validates credentials on first use.
 */

import twilio, { Twilio } from 'twilio';

let _twilioClient: Twilio | null = null;

/**
 * Get the Twilio client (lazy initialization)
 * @throws Error if TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN are not set
 */
export function getTwilioClient(): Twilio {
  if (!_twilioClient) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      throw new Error(
        'Missing Twilio credentials. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN environment variables.'
      );
    }

    _twilioClient = twilio(accountSid, authToken);
  }

  return _twilioClient;
}

/**
 * For convenience, export a getter object
 */
export const twilioClient = {
  get: getTwilioClient,
};

/**
 * Reset the client (useful for testing)
 */
export function resetTwilioClient(): void {
  _twilioClient = null;
}
