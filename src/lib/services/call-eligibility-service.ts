/**
 * Call Eligibility Service
 *
 * WHY: Validate campaign eligibility before accepting calls.
 *      Campaigns have caps, hours, and activation status that must be
 *      checked before spending resources on auction.
 *
 * WHEN: At incoming call handler, before creating call record.
 *       Called for every incoming call to determine if it should proceed.
 *
 * HOW: Check active status, business hours, daily caps, and buyer availability.
 *      Returns detailed eligibility result for appropriate caller messaging.
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { isWithinBusinessHours, getBusinessHoursMessage, HoursOfOperation } from '@/lib/call/call-helpers';

// =====================================
// TYPE DEFINITIONS
// =====================================

/**
 * Campaign data needed for eligibility checks
 */
export interface CampaignForEligibility {
  id: string;
  name: string;
  active: boolean;
  hoursOfOperation: HoursOfOperation | null;
  timezone: string;
  dailyCallCap: number | null;
  serviceTypeId: string;
}

/**
 * Result of campaign eligibility check
 */
export interface EligibilityResult {
  eligible: boolean;
  reason?: 'INACTIVE' | 'OUTSIDE_HOURS' | 'DAILY_CAP_REACHED' | 'NO_BUYERS' | 'SERVICE_INACTIVE';
  message?: string; // Human-friendly message for caller
  details?: Record<string, unknown>; // Additional debug info
}

// =====================================
// MAIN ELIGIBILITY CHECK
// =====================================

/**
 * Check if a campaign is eligible to receive calls
 *
 * WHY: Must validate all campaign constraints before accepting a call.
 *      Rejecting early saves Twilio costs and provides better UX.
 * WHEN: Called by incoming webhook handler for every call.
 * HOW: Sequential checks for active, hours, caps, buyers.
 *
 * @param campaign - Campaign data with eligibility-related fields
 * @param callerZip - Optional caller ZIP for buyer availability check
 * @returns EligibilityResult with eligible flag and reason if not
 */
export async function checkCampaignEligibility(
  campaign: CampaignForEligibility,
  callerZip?: string
): Promise<EligibilityResult> {
  // Check 1: Campaign must be active
  if (!campaign.active) {
    logger.info({
      event: 'call.eligibility.inactive',
      message: 'Campaign is not active',
      campaignId: campaign.id,
      campaignName: campaign.name,
    });

    return {
      eligible: false,
      reason: 'INACTIVE',
      message: "We're sorry, this service is currently unavailable. Please try again later.",
    };
  }

  // Check 2: Must be within business hours
  const withinHours = isWithinBusinessHours(
    campaign.hoursOfOperation,
    campaign.timezone
  );

  if (!withinHours) {
    const hoursMessage = getBusinessHoursMessage(
      campaign.hoursOfOperation,
      campaign.timezone
    );

    logger.info({
      event: 'call.eligibility.outside_hours',
      message: 'Call received outside business hours',
      campaignId: campaign.id,
      timezone: campaign.timezone,
    });

    return {
      eligible: false,
      reason: 'OUTSIDE_HOURS',
      message: `We're sorry, we're currently closed. ${hoursMessage}`,
      details: {
        timezone: campaign.timezone,
        hoursConfig: campaign.hoursOfOperation,
      },
    };
  }

  // Check 3: Daily cap not exceeded
  if (campaign.dailyCallCap !== null && campaign.dailyCallCap > 0) {
    const capCheck = await checkDailyCap(campaign.id, campaign.dailyCallCap);

    if (!capCheck.eligible) {
      logger.info({
        event: 'call.eligibility.cap_reached',
        message: 'Daily call cap reached for campaign',
        campaignId: campaign.id,
        currentCount: capCheck.currentCount,
        cap: campaign.dailyCallCap,
      });

      return {
        eligible: false,
        reason: 'DAILY_CAP_REACHED',
        message:
          "We're experiencing high call volume. Please try again tomorrow or leave your information at our website.",
        details: {
          currentCount: capCheck.currentCount,
          cap: campaign.dailyCallCap,
        },
      };
    }
  }

  // Check 4 (Optional): Buyer availability for this service/ZIP
  // Only check if caller ZIP is provided
  if (callerZip) {
    const hasBuyers = await checkBuyerAvailability(campaign.serviceTypeId, callerZip);

    if (!hasBuyers) {
      logger.info({
        event: 'call.eligibility.no_buyers',
        message: 'No eligible buyers for service/ZIP',
        campaignId: campaign.id,
        serviceTypeId: campaign.serviceTypeId,
        callerZip,
      });

      // Note: We might still want to accept the call and try auction
      // This is a "soft" rejection - could be made configurable
      return {
        eligible: false,
        reason: 'NO_BUYERS',
        message:
          "We're sorry, we don't currently have service providers available in your area. Please try again later.",
        details: {
          serviceTypeId: campaign.serviceTypeId,
          callerZip,
        },
      };
    }
  }

  // All checks passed
  logger.debug({
    event: 'call.eligibility.passed',
    message: 'Campaign eligibility check passed',
    campaignId: campaign.id,
  });

  return {
    eligible: true,
  };
}

// =====================================
// HELPER FUNCTIONS
// =====================================

/**
 * Check if daily call cap has been reached
 *
 * WHY: Campaigns can set limits to control costs and quality.
 * WHEN: Called as part of eligibility check.
 * HOW: Query DailyCounter table for today's count.
 *
 * @param campaignId - Campaign to check
 * @param cap - Daily cap limit
 * @returns Object with eligible flag and current count
 */
async function checkDailyCap(
  campaignId: string,
  cap: number
): Promise<{ eligible: boolean; currentCount: number }> {
  // Get today's date (start of day in UTC)
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  try {
    // Check DailyCounter table
    const counter = await prisma.dailyCounter.findUnique({
      where: {
        entityType_entityId_counterDate: {
          entityType: 'campaign',
          entityId: campaignId,
          counterDate: today,
        },
      },
    });

    const currentCount = counter?.callCount ?? 0;

    return {
      eligible: currentCount < cap,
      currentCount,
    };
  } catch (error) {
    logger.error({
      event: 'call.eligibility.cap_check_failed',
      message: 'Failed to check daily cap',
      campaignId,
      error: (error as Error).message,
    });

    // On error, allow the call (fail open for revenue)
    return {
      eligible: true,
      currentCount: 0,
    };
  }
}

/**
 * Check if any buyers are available for this service/ZIP
 *
 * WHY: No point running auction if no buyers can accept the call.
 * WHEN: Called as part of eligibility check when ZIP is known.
 * HOW: Query buyer_service_zip_codes for active buyers.
 *
 * @param serviceTypeId - Service type ID
 * @param zipCode - Caller's ZIP code
 * @returns True if at least one buyer is available
 */
async function checkBuyerAvailability(
  serviceTypeId: string,
  zipCode: string
): Promise<boolean> {
  try {
    // Check for at least one active buyer that:
    // 1. Accepts calls (acceptsCalls = true)
    // 2. Is active (active = true)
    // 3. Has this service type configured (buyer_service_configs)
    // 4. Covers this ZIP code (buyer_service_zip_codes)
    const eligibleBuyer = await prisma.buyerServiceZipCode.findFirst({
      where: {
        serviceTypeId,
        zipCode,
        active: true,
        buyer: {
          active: true,
          acceptsCalls: true,
          serviceConfigs: {
            some: {
              serviceTypeId,
              active: true,
            },
          },
        },
      },
      select: {
        id: true,
      },
    });

    return eligibleBuyer !== null;
  } catch (error) {
    logger.error({
      event: 'call.eligibility.buyer_check_failed',
      message: 'Failed to check buyer availability',
      serviceTypeId,
      zipCode,
      error: (error as Error).message,
    });

    // On error, allow the call (fail open - let auction determine availability)
    return true;
  }
}

/**
 * Increment the daily call counter for a campaign
 *
 * WHY: Track call counts for cap enforcement.
 * WHEN: After call is accepted and recorded.
 * HOW: Upsert to DailyCounter table with atomic increment.
 *
 * @param campaignId - Campaign to increment counter for
 */
export async function incrementCallCounter(campaignId: string): Promise<void> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  try {
    await prisma.dailyCounter.upsert({
      where: {
        entityType_entityId_counterDate: {
          entityType: 'campaign',
          entityId: campaignId,
          counterDate: today,
        },
      },
      create: {
        entityType: 'campaign',
        entityId: campaignId,
        counterDate: today,
        callCount: 1,
        leadCount: 0,
        spendAmount: 0,
      },
      update: {
        callCount: { increment: 1 },
      },
    });
  } catch (error) {
    // Log but don't fail - counter is for limiting, not critical path
    logger.warn({
      event: 'call.counter.increment_failed',
      message: 'Failed to increment call counter',
      campaignId,
      error: (error as Error).message,
    });
  }
}

/**
 * Check if service type is active
 *
 * WHY: Service types can be deactivated to stop all calls.
 * WHEN: Called when tracking number doesn't have full campaign data.
 * HOW: Simple database lookup.
 *
 * @param serviceTypeId - Service type to check
 * @returns True if service type is active
 */
export async function isServiceTypeActive(serviceTypeId: string): Promise<boolean> {
  try {
    const serviceType = await prisma.serviceType.findUnique({
      where: { id: serviceTypeId },
      select: { active: true },
    });

    return serviceType?.active ?? false;
  } catch (error) {
    logger.error({
      event: 'call.eligibility.service_check_failed',
      message: 'Failed to check service type status',
      serviceTypeId,
      error: (error as Error).message,
    });

    // On error, allow (fail open)
    return true;
  }
}
