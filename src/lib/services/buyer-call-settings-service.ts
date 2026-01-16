/**
 * Buyer Call Settings Service
 *
 * WHY: Centralized service for buyer call settings CRUD operations.
 *      Abstracts database operations and validation for call configuration.
 *
 * WHEN: Use this service when:
 *       - Admin configures buyer call settings
 *       - Call auction needs to check buyer call eligibility
 *       - Loading buyer call configuration for routing
 *
 * HOW: Import and call appropriate methods. Uses Prisma transactions
 *      to update both buyers and buyer_service_configs tables atomically.
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { Prisma } from '@prisma/client';

// =====================================
// TYPE DEFINITIONS
// =====================================

export interface DayHours {
  active: boolean;
  start: string; // "HH:MM" 24-hour format
  end: string;   // "HH:MM" 24-hour format
}

export interface HoursOfOperation {
  monday: DayHours;
  tuesday: DayHours;
  wednesday: DayHours;
  thursday: DayHours;
  friday: DayHours;
  saturday: DayHours;
  sunday: DayHours;
}

export interface BuyerCallSettings {
  acceptsCalls: boolean;
  callBidAmount: number;
  callMinBid: number;
  callMaxBid: number;
  callForwardingNumber: string | null;
  callBackupNumber: string | null;
  callDailyCap: number;
  callRingTimeout: number;
  timezone: string;
  hoursOfOperation: HoursOfOperation;
  requireIvrQualification: boolean;
  acceptWithoutCallerId: boolean;
  allowCascade: boolean;
}

export interface UpdateCallSettingsResult {
  success: boolean;
  error?: string;
  data?: BuyerCallSettings;
}

// JSON-compatible type for database storage
type CallHoursJson = Prisma.InputJsonValue;

// =====================================
// DEFAULT VALUES
// =====================================

const DEFAULT_DAY_HOURS: DayHours = {
  active: true,
  start: '08:00',
  end: '18:00'
};

const DEFAULT_WEEKEND_HOURS: DayHours = {
  active: false,
  start: '09:00',
  end: '17:00'
};

export const DEFAULT_HOURS_OF_OPERATION: HoursOfOperation = {
  monday: { ...DEFAULT_DAY_HOURS },
  tuesday: { ...DEFAULT_DAY_HOURS },
  wednesday: { ...DEFAULT_DAY_HOURS },
  thursday: { ...DEFAULT_DAY_HOURS },
  friday: { ...DEFAULT_DAY_HOURS },
  saturday: { ...DEFAULT_WEEKEND_HOURS },
  sunday: { ...DEFAULT_WEEKEND_HOURS }
};

export const DEFAULT_CALL_SETTINGS: BuyerCallSettings = {
  acceptsCalls: false,
  callBidAmount: 25,
  callMinBid: 5,
  callMaxBid: 100,
  callForwardingNumber: null,
  callBackupNumber: null,
  callDailyCap: 0, // 0 = unlimited
  callRingTimeout: 25,
  timezone: 'America/New_York',
  hoursOfOperation: DEFAULT_HOURS_OF_OPERATION,
  requireIvrQualification: true,
  acceptWithoutCallerId: false,
  allowCascade: true
};

// =====================================
// VALIDATION HELPERS
// =====================================

/**
 * Format phone number to E.164 if possible
 *
 * WHY: Accept various formats, normalize to E.164.
 * HOW: Strip non-digits, add +1 prefix if needed.
 */
export function formatPhoneToE164(phone: string | null): string | null {
  if (!phone) return null;

  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');

  // If 10 digits, add +1 prefix
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  // If 11 digits starting with 1, add + prefix
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  // Return original if already in E.164 format
  if (phone.startsWith('+') && digits.length >= 10) {
    return phone;
  }

  return null; // Invalid format
}

/**
 * Validate hours of operation
 *
 * WHY: Ensure business logic constraints are met.
 * HOW: Check each active day has valid start/end times.
 */
function validateHoursOfOperation(hours: HoursOfOperation): string | null {
  const days = Object.entries(hours);

  for (const [day, dayHours] of days) {
    if (!dayHours.active) continue;

    // Check time format
    const timeRegex = /^([01]?\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(dayHours.start) || !timeRegex.test(dayHours.end)) {
      return `Invalid time format for ${day}. Use HH:MM format.`;
    }

    // Check end is after start (at least 1 hour)
    const [startHour, startMin] = dayHours.start.split(':').map(Number);
    const [endHour, endMin] = dayHours.end.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    if (endMinutes - startMinutes < 60) {
      return `${day}: End time must be at least 1 hour after start time.`;
    }
  }

  return null; // Valid
}

/**
 * Validate bid amounts
 *
 * WHY: Ensure bid configuration is logical and within allowed range.
 * HOW: Check min <= bid <= max and all within $5-$500 range.
 */
function validateBidAmounts(
  bidAmount: number,
  minBid: number,
  maxBid: number
): string | null {
  if (minBid < 5 || minBid > 500) {
    return 'Minimum bid must be between $5 and $500.';
  }
  if (maxBid < 5 || maxBid > 500) {
    return 'Maximum bid must be between $5 and $500.';
  }
  if (bidAmount < 5 || bidAmount > 500) {
    return 'Bid amount must be between $5 and $500.';
  }
  if (minBid > maxBid) {
    return 'Minimum bid cannot exceed maximum bid.';
  }
  if (bidAmount < minBid || bidAmount > maxBid) {
    return 'Bid amount must be between minimum and maximum bid.';
  }
  return null;
}

// =====================================
// SERVICE METHODS
// =====================================

/**
 * Get buyer call settings
 *
 * WHY: Load current call settings for display in admin UI.
 * WHEN: Admin opens Call Settings tab on buyer detail page.
 * HOW: Query buyer table and first service config for call-related fields.
 */
export async function getBuyerCallSettings(
  buyerId: string
): Promise<BuyerCallSettings> {
  try {
    const buyer = await prisma.buyer.findUnique({
      where: { id: buyerId },
      select: {
        acceptsCalls: true,
        callForwardingNumber: true,
        callBackupNumber: true,
        callHoursOfOperation: true,
        callRingTimeout: true,
        serviceConfigs: {
          select: {
            callBidAmount: true,
            callMinBid: true,
            callMaxBid: true,
            callDailyCap: true,
            requireIvrQualification: true
          },
          take: 1
        }
      }
    });

    if (!buyer) {
      logger.warn('Buyer not found for call settings', { buyerId });
      return { ...DEFAULT_CALL_SETTINGS };
    }

    // Get first service config for call bid settings (shared across services for now)
    const serviceConfig = buyer.serviceConfigs[0];

    // Parse hours of operation from JSON
    let hoursOfOperation = DEFAULT_HOURS_OF_OPERATION;
    if (buyer.callHoursOfOperation) {
      const parsed = buyer.callHoursOfOperation as {
        timezone?: string;
        hours?: HoursOfOperation;
        requireIvrQualification?: boolean;
        acceptWithoutCallerId?: boolean;
        allowCascade?: boolean;
      };
      if (parsed.hours) {
        hoursOfOperation = parsed.hours;
      }
    }

    // Extract additional settings from JSON
    const jsonSettings = buyer.callHoursOfOperation as {
      timezone?: string;
      requireIvrQualification?: boolean;
      acceptWithoutCallerId?: boolean;
      allowCascade?: boolean;
    } | null;

    return {
      acceptsCalls: buyer.acceptsCalls,
      callBidAmount: serviceConfig?.callBidAmount
        ? Number(serviceConfig.callBidAmount)
        : DEFAULT_CALL_SETTINGS.callBidAmount,
      callMinBid: serviceConfig?.callMinBid
        ? Number(serviceConfig.callMinBid)
        : DEFAULT_CALL_SETTINGS.callMinBid,
      callMaxBid: serviceConfig?.callMaxBid
        ? Number(serviceConfig.callMaxBid)
        : DEFAULT_CALL_SETTINGS.callMaxBid,
      callForwardingNumber: buyer.callForwardingNumber,
      callBackupNumber: buyer.callBackupNumber,
      callDailyCap: serviceConfig?.callDailyCap ?? DEFAULT_CALL_SETTINGS.callDailyCap,
      callRingTimeout: buyer.callRingTimeout,
      timezone: jsonSettings?.timezone ?? DEFAULT_CALL_SETTINGS.timezone,
      hoursOfOperation,
      requireIvrQualification: serviceConfig?.requireIvrQualification ??
        jsonSettings?.requireIvrQualification ??
        DEFAULT_CALL_SETTINGS.requireIvrQualification,
      acceptWithoutCallerId: jsonSettings?.acceptWithoutCallerId ??
        DEFAULT_CALL_SETTINGS.acceptWithoutCallerId,
      allowCascade: jsonSettings?.allowCascade ?? DEFAULT_CALL_SETTINGS.allowCascade
    };
  } catch (error) {
    logger.error('Failed to get buyer call settings', {
      buyerId,
      error: (error as Error).message
    });
    throw error;
  }
}

/**
 * Update buyer call settings
 *
 * WHY: Save call settings from admin UI to database.
 * WHEN: Admin clicks save on Call Settings tab.
 * HOW: Validate inputs, update buyer and all service configs in transaction.
 */
export async function updateBuyerCallSettings(
  buyerId: string,
  settings: BuyerCallSettings
): Promise<UpdateCallSettingsResult> {
  try {
    // Validate phone numbers
    const formattedPrimary = formatPhoneToE164(settings.callForwardingNumber);
    const formattedBackup = formatPhoneToE164(settings.callBackupNumber);

    if (settings.callForwardingNumber && !formattedPrimary) {
      return {
        success: false,
        error: 'Invalid primary phone number format. Use (XXX) XXX-XXXX or +1XXXXXXXXXX.'
      };
    }

    if (settings.callBackupNumber && !formattedBackup) {
      return {
        success: false,
        error: 'Invalid backup phone number format. Use (XXX) XXX-XXXX or +1XXXXXXXXXX.'
      };
    }

    // If accepting calls, primary number is required
    if (settings.acceptsCalls && !formattedPrimary) {
      return {
        success: false,
        error: 'Primary phone number is required when accepting calls.'
      };
    }

    // Validate bid amounts
    const bidError = validateBidAmounts(
      settings.callBidAmount,
      settings.callMinBid,
      settings.callMaxBid
    );
    if (bidError) {
      return { success: false, error: bidError };
    }

    // Validate hours of operation
    const hoursError = validateHoursOfOperation(settings.hoursOfOperation);
    if (hoursError) {
      return { success: false, error: hoursError };
    }

    // Validate ring timeout
    if (settings.callRingTimeout < 10 || settings.callRingTimeout > 60) {
      return {
        success: false,
        error: 'Ring timeout must be between 10 and 60 seconds.'
      };
    }

    // Build the JSON settings object for callHoursOfOperation
    // Cast to JSON-compatible type for Prisma
    const callHoursJson: CallHoursJson = {
      timezone: settings.timezone,
      hours: JSON.parse(JSON.stringify(settings.hoursOfOperation)),
      requireIvrQualification: settings.requireIvrQualification,
      acceptWithoutCallerId: settings.acceptWithoutCallerId,
      allowCascade: settings.allowCascade
    };

    // Update in transaction
    await prisma.$transaction(async (tx) => {
      // Update buyer table
      await tx.buyer.update({
        where: { id: buyerId },
        data: {
          acceptsCalls: settings.acceptsCalls,
          callForwardingNumber: formattedPrimary,
          callBackupNumber: formattedBackup,
          callHoursOfOperation: callHoursJson,
          callRingTimeout: settings.callRingTimeout
        }
      });

      // Update all service configs with call bid settings
      await tx.buyerServiceConfig.updateMany({
        where: { buyerId },
        data: {
          callBidAmount: settings.callBidAmount,
          callMinBid: settings.callMinBid,
          callMaxBid: settings.callMaxBid,
          callDailyCap: settings.callDailyCap === 0 ? null : settings.callDailyCap,
          requireIvrQualification: settings.requireIvrQualification
        }
      });
    });

    logger.info('Updated buyer call settings', {
      buyerId,
      acceptsCalls: settings.acceptsCalls,
      hasPrimaryNumber: !!formattedPrimary,
      hasBackupNumber: !!formattedBackup
    });

    return {
      success: true,
      data: {
        ...settings,
        callForwardingNumber: formattedPrimary,
        callBackupNumber: formattedBackup
      }
    };
  } catch (error) {
    logger.error('Failed to update buyer call settings', {
      buyerId,
      error: (error as Error).message
    });
    return {
      success: false,
      error: 'Failed to save call settings. Please try again.'
    };
  }
}
