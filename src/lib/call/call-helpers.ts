/**
 * Call Helper Utilities
 *
 * WHY: Common utility functions needed across call flow handlers.
 *      Centralizes phone formatting, time checks, and masking.
 *
 * WHEN: Used by incoming webhook, IVR handler, auction handler, etc.
 *
 * HOW: Pure functions with no side effects for easy testing.
 */

/**
 * Mask a phone number for logging (shows only last 4 digits)
 *
 * WHY: Protect caller privacy in logs while maintaining debugging capability.
 * WHEN: Any log statement that includes caller phone numbers.
 * HOW: Replaces all but last 4 digits with asterisks.
 *
 * @param phone - Full phone number (any format)
 * @returns Masked phone like "***-***-1234"
 */
export function maskPhone(phone: string): string {
  if (!phone) return '(unknown)';

  // Extract only digits
  const digits = phone.replace(/\D/g, '');

  if (digits.length < 4) {
    return '****';
  }

  const lastFour = digits.slice(-4);
  return `***-***-${lastFour}`;
}

/**
 * Format phone number to E.164 standard
 *
 * WHY: Twilio requires E.164 format (+15551234567) for API calls.
 * WHEN: Before making any Twilio API call or database storage.
 * HOW: Strip non-digits, add +1 country code if missing.
 *
 * @param phone - Phone number in any format
 * @returns E.164 formatted phone like "+15551234567"
 */
export function formatPhoneE164(phone: string): string {
  if (!phone) return '';

  // Strip all non-digits
  const digits = phone.replace(/\D/g, '');

  // Handle 10-digit US numbers
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  // Handle 11-digit numbers starting with 1 (US)
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  // If already has country code or unknown format, just add +
  if (!phone.startsWith('+')) {
    return `+${digits}`;
  }

  return phone;
}

/**
 * Format phone number for display (US format)
 *
 * WHY: Human-readable phone format for UI display.
 * WHEN: Displaying phone numbers in admin dashboard, affiliate portal, etc.
 * HOW: Formats to (XXX) XXX-XXXX format.
 *
 * @param phone - Phone number in any format
 * @returns Formatted phone like "(555) 123-4567"
 */
export function formatPhoneDisplay(phone: string): string {
  if (!phone) return '';

  // Strip all non-digits
  const digits = phone.replace(/\D/g, '');

  // Get last 10 digits (ignore country code)
  const last10 = digits.slice(-10);

  if (last10.length !== 10) {
    return phone; // Return original if not valid US number
  }

  const areaCode = last10.slice(0, 3);
  const exchange = last10.slice(3, 6);
  const subscriber = last10.slice(6, 10);

  return `(${areaCode}) ${exchange}-${subscriber}`;
}

/**
 * Hours of operation configuration structure
 */
export interface HoursOfOperation {
  monday?: { start: string; end: string };
  tuesday?: { start: string; end: string };
  wednesday?: { start: string; end: string };
  thursday?: { start: string; end: string };
  friday?: { start: string; end: string };
  saturday?: { start: string; end: string };
  sunday?: { start: string; end: string };
}

/**
 * Check if current time is within business hours
 *
 * WHY: Campaigns have operating hours; calls outside hours should be rejected
 *      or given an appropriate message.
 * WHEN: At incoming call handler, before proceeding with auction.
 * HOW: Compare current time in campaign timezone against hours config.
 *
 * @param hoursConfig - Hours of operation JSON from campaign
 * @param timezone - IANA timezone string (e.g., "America/New_York")
 * @returns True if current time is within business hours
 */
export function isWithinBusinessHours(
  hoursConfig: HoursOfOperation | null | undefined,
  timezone: string = 'America/New_York'
): boolean {
  // If no hours configured, assume 24/7 operation
  if (!hoursConfig) {
    return true;
  }

  try {
    // Get current time in campaign timezone
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      weekday: 'long',
    };

    const formatter = new Intl.DateTimeFormat('en-US', options);
    const parts = formatter.formatToParts(now);

    const weekday = parts.find((p) => p.type === 'weekday')?.value?.toLowerCase();
    const hour = parts.find((p) => p.type === 'hour')?.value;
    const minute = parts.find((p) => p.type === 'minute')?.value;

    if (!weekday || !hour || !minute) {
      // If we can't determine time, allow the call (fail open)
      return true;
    }

    // Get today's hours
    const todayHours = hoursConfig[weekday as keyof HoursOfOperation];

    // If no hours for today, business is closed
    if (!todayHours) {
      return false;
    }

    // Parse current time as minutes since midnight
    const currentMinutes = parseInt(hour, 10) * 60 + parseInt(minute, 10);

    // Parse start and end times
    const [startHour, startMin] = todayHours.start.split(':').map(Number);
    const [endHour, endMin] = todayHours.end.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    // Check if current time is within range
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } catch (error) {
    // On any error parsing, allow the call (fail open for revenue)
    console.error('Error checking business hours:', error);
    return true;
  }
}

/**
 * Get human-readable business hours message
 *
 * WHY: When caller calls outside hours, give them a helpful message.
 * WHEN: Returning rejection TwiML for outside-hours calls.
 * HOW: Parse hours config and format as readable string.
 *
 * @param hoursConfig - Hours of operation JSON from campaign
 * @param timezone - IANA timezone string
 * @returns Human-readable hours string
 */
export function getBusinessHoursMessage(
  hoursConfig: HoursOfOperation | null | undefined,
  timezone: string = 'America/New_York'
): string {
  if (!hoursConfig) {
    return 'Our office hours are Monday through Friday, 9 AM to 5 PM Eastern Time.';
  }

  // Check if all weekdays have the same hours
  const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const;
  const weekdayHours = weekdays.map((day) => hoursConfig[day]).filter(Boolean);

  if (weekdayHours.length > 0) {
    const firstHours = weekdayHours[0];
    const allSame = weekdayHours.every(
      (h) => h?.start === firstHours?.start && h?.end === firstHours?.end
    );

    if (allSame && firstHours) {
      const start = formatTime12Hour(firstHours.start);
      const end = formatTime12Hour(firstHours.end);
      const tzAbbrev = getTimezoneAbbreviation(timezone);

      return `Our office hours are Monday through Friday, ${start} to ${end} ${tzAbbrev}.`;
    }
  }

  // Default message
  return 'Please call back during our regular business hours.';
}

/**
 * Convert 24-hour time to 12-hour format
 *
 * @param time24 - Time in "HH:MM" format
 * @returns Time in "H:MM AM/PM" format
 */
function formatTime12Hour(time24: string): string {
  const [hourStr, minute] = time24.split(':');
  let hour = parseInt(hourStr, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';

  if (hour === 0) hour = 12;
  else if (hour > 12) hour -= 12;

  return `${hour}:${minute} ${ampm}`;
}

/**
 * Get timezone abbreviation
 *
 * @param timezone - IANA timezone string
 * @returns Abbreviation like "ET", "PT", etc.
 */
function getTimezoneAbbreviation(timezone: string): string {
  const abbrevMap: Record<string, string> = {
    'America/New_York': 'ET',
    'America/Chicago': 'CT',
    'America/Denver': 'MT',
    'America/Los_Angeles': 'PT',
    'America/Phoenix': 'MST',
    'America/Anchorage': 'AKT',
    'Pacific/Honolulu': 'HT',
  };

  return abbrevMap[timezone] || timezone;
}

/**
 * Calculate call duration in seconds from timestamps
 *
 * WHY: Need duration for billing, qualification, and reporting.
 * WHEN: After call ends, for finalization.
 * HOW: Subtract start from end timestamp.
 *
 * @param startTime - Call start timestamp
 * @param endTime - Call end timestamp
 * @returns Duration in seconds (integer)
 */
export function calculateDurationSeconds(
  startTime: Date | string | null,
  endTime: Date | string | null
): number {
  if (!startTime || !endTime) return 0;

  const start = startTime instanceof Date ? startTime : new Date(startTime);
  const end = endTime instanceof Date ? endTime : new Date(endTime);

  const durationMs = end.getTime() - start.getTime();

  // Return 0 if negative (invalid data)
  return Math.max(0, Math.floor(durationMs / 1000));
}

/**
 * Validate a phone number is potentially valid
 *
 * WHY: Filter out obviously invalid numbers before processing.
 * WHEN: Validating incoming caller phone numbers.
 * HOW: Check digit count and basic patterns.
 *
 * @param phone - Phone number to validate
 * @returns True if phone appears valid
 */
export function isValidPhoneNumber(phone: string): boolean {
  if (!phone) return false;

  const digits = phone.replace(/\D/g, '');

  // US numbers should be 10 or 11 digits
  if (digits.length < 10 || digits.length > 11) {
    return false;
  }

  // 11-digit numbers should start with 1 (US country code)
  if (digits.length === 11 && !digits.startsWith('1')) {
    return false;
  }

  // Check for obviously fake patterns
  const last10 = digits.slice(-10);
  const fakePatterns = [
    '0000000000',
    '1111111111',
    '1234567890',
    '0987654321',
    '5555555555',
  ];

  if (fakePatterns.includes(last10)) {
    return false;
  }

  return true;
}
