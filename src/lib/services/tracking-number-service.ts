/**
 * Tracking Number Service
 *
 * WHY: Manages phone number provisioning and lifecycle for call attribution.
 *      Integrates with Twilio for number provisioning and release.
 *
 * WHEN: Use this service for:
 *       - Affiliate provisioning new tracking numbers
 *       - Releasing numbers when no longer needed
 *       - Core provisioning operations
 *
 * HOW: Uses Twilio SDK for provisioning via @/lib/twilio module.
 *      Uses Prisma for database storage.
 *      For queries and admin functions, use tracking-number-queries.ts
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import {
  provisionPhoneNumber as twilioProvision,
  releasePhoneNumber as twilioRelease
} from '@/lib/twilio';
import { TrackingNumber } from '@prisma/client';
import * as Sentry from '@sentry/nextjs';

// =====================================
// TYPE DEFINITIONS
// =====================================

export interface ProvisionNumberRequest {
  affiliateId: string;
  campaignId: string;
  areaCode?: string;
  tollFree?: boolean;
}

export interface ProvisionResult {
  success: boolean;
  trackingNumber?: TrackingNumber;
  error?: string;
}

// =====================================
// PROVISIONING METHODS
// =====================================

/**
 * Provision a new tracking number for an affiliate/campaign
 *
 * WHY: Affiliates need unique phone numbers to track call attribution.
 *      Each number links calls to a specific affiliate and campaign.
 * WHEN: "Get Tracking Number" button in affiliate campaign detail.
 * HOW:
 *   1. Verify affiliate has APPROVED access to campaign
 *   2. Check affiliate doesn't already have number for this campaign
 *   3. Create PENDING record in database
 *   4. Call Twilio to provision number with webhook URLs
 *   5. Update record with Twilio details on success
 *   6. Rollback pending record on failure
 */
export async function provisionTrackingNumber(
  request: ProvisionNumberRequest
): Promise<ProvisionResult> {
  const { affiliateId, campaignId, areaCode, tollFree = true } = request;

  try {
    // 1. Verify affiliate has active access to campaign
    const affiliateCampaign = await prisma.affiliateCampaign.findUnique({
      where: {
        affiliateId_campaignId: { affiliateId, campaignId }
      }
    });

    if (!affiliateCampaign) {
      return {
        success: false,
        error: 'You do not have access to this campaign. Please request access first.'
      };
    }

    if (affiliateCampaign.status !== 'APPROVED') {
      if (affiliateCampaign.status === 'PENDING') {
        return {
          success: false,
          error: 'Your campaign access is pending approval. Please wait for admin review.'
        };
      }
      return {
        success: false,
        error: `Your campaign access is ${affiliateCampaign.status.toLowerCase()}. Cannot provision numbers.`
      };
    }

    // 2. Check if affiliate already has a number for this campaign
    const existingNumber = await prisma.trackingNumber.findFirst({
      where: {
        affiliateId,
        campaignId,
        provisioningStatus: { in: ['ACTIVE', 'PENDING', 'PROVISIONING'] }
      }
    });

    if (existingNumber) {
      return {
        success: false,
        error: 'You already have an active tracking number for this campaign'
      };
    }

    // 3. Get campaign details for context
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId }
    });

    if (!campaign) {
      return { success: false, error: 'Campaign not found' };
    }

    if (!campaign.active) {
      return { success: false, error: 'Campaign is no longer active' };
    }

    // 4. Create pending tracking number record
    const pendingNumber = await prisma.trackingNumber.create({
      data: {
        affiliateId,
        campaignId,
        serviceTypeId: campaign.serviceTypeId,
        phoneNumber: '',
        provisioningType: 'PLATFORM',
        provisioningStatus: 'PENDING'
      }
    });

    logger.info('Provisioning Twilio number', {
      affiliateId,
      campaignId,
      trackingNumberId: pendingNumber.id,
      areaCode,
      tollFree
    });

    // 5. Update to PROVISIONING status before Twilio call
    await prisma.trackingNumber.update({
      where: { id: pendingNumber.id },
      data: { provisioningStatus: 'PROVISIONING' }
    });

    // 6. Provision number from Twilio
    let twilioResult;
    try {
      twilioResult = await twilioProvision({
        affiliateId,
        campaignId,
        areaCode: areaCode || (tollFree ? '844' : undefined),
        tollFree
      });
    } catch (twilioError) {
      await prisma.trackingNumber.update({
        where: { id: pendingNumber.id },
        data: { provisioningStatus: 'FAILED' }
      });

      const errorMessage = (twilioError as Error).message;

      Sentry.captureException(twilioError, {
        level: 'error',
        extra: { affiliateId, campaignId, areaCode, tollFree }
      });

      logger.error('Twilio number provisioning failed', {
        affiliateId,
        campaignId,
        trackingNumberId: pendingNumber.id,
        error: errorMessage
      });

      return {
        success: false,
        error: `Failed to provision phone number: ${errorMessage}`
      };
    }

    // 7. Update tracking number with Twilio details
    const trackingNumber = await prisma.trackingNumber.update({
      where: { id: pendingNumber.id },
      data: {
        phoneNumber: twilioResult.phoneNumber,
        phoneNumberDisplay: twilioResult.displayNumber,
        twilioSid: twilioResult.sid,
        provisioningStatus: 'ACTIVE'
      }
    });

    logger.info('Tracking number provisioned successfully', {
      trackingNumberId: trackingNumber.id,
      phoneNumber: trackingNumber.phoneNumber,
      affiliateId,
      campaignId
    });

    return { success: true, trackingNumber };
  } catch (error) {
    logger.error('Failed to provision tracking number', {
      error: (error as Error).message,
      affiliateId,
      campaignId
    });

    Sentry.captureException(error, {
      extra: { affiliateId, campaignId, areaCode }
    });

    return {
      success: false,
      error: `Failed to provision number: ${(error as Error).message}`
    };
  }
}

/**
 * Release a tracking number
 *
 * WHY: Affiliates may want to stop using a number, or numbers need cleanup
 *      when campaigns end or affiliates are deactivated.
 * WHEN: "Release Number" action, campaign ended, affiliate deactivated.
 * HOW: Release from Twilio (if platform-provisioned), mark as RELEASED in DB.
 */
export async function releaseTrackingNumber(
  trackingNumberId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const trackingNumber = await prisma.trackingNumber.findUnique({
      where: { id: trackingNumberId }
    });

    if (!trackingNumber) {
      return { success: false, error: 'Tracking number not found' };
    }

    if (trackingNumber.provisioningStatus === 'RELEASED') {
      return { success: true };
    }

    await prisma.trackingNumber.update({
      where: { id: trackingNumberId },
      data: { provisioningStatus: 'RELEASING' }
    });

    if (trackingNumber.twilioSid && trackingNumber.provisioningType === 'PLATFORM') {
      try {
        await twilioRelease(trackingNumber.twilioSid);
        logger.info('Twilio number released', {
          trackingNumberId,
          twilioSid: trackingNumber.twilioSid
        });
      } catch (twilioError) {
        logger.warn('Twilio number release failed, marking as released anyway', {
          trackingNumberId,
          twilioSid: trackingNumber.twilioSid,
          error: (twilioError as Error).message
        });
      }
    }

    await prisma.trackingNumber.update({
      where: { id: trackingNumberId },
      data: {
        provisioningStatus: 'RELEASED',
        active: false
      }
    });

    logger.info('Tracking number released', {
      trackingNumberId,
      phoneNumber: trackingNumber.phoneNumber,
      reason
    });

    return { success: true };
  } catch (error) {
    logger.error('Failed to release tracking number', {
      trackingNumberId,
      error: (error as Error).message
    });
    return {
      success: false,
      error: `Failed to release number: ${(error as Error).message}`
    };
  }
}

// Re-export query functions from tracking-number-queries
export {
  getTrackingNumbersByAffiliate,
  getTrackingNumberByPhone,
  getTrackingNumberById,
  getTrackingNumberStats,
  listTrackingNumbers,
  incrementTrackingNumberStats,
  type TrackingNumberWithDetails,
  type TrackingNumberStats
} from './tracking-number-queries';
