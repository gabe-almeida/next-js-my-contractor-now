/**
 * Ingress Number Service
 *
 * WHY: Manages shared "ingress" phone numbers that affiliates forward calls TO.
 *      Unlike platform-provisioned numbers (1:1 with affiliate+campaign), ingress
 *      numbers are shared among multiple affiliates who use external call tracking
 *      systems like Ringba/Retreaver/Invoca.
 *
 * WHEN: Use this service for:
 *       - Affiliates who want to forward calls from their own tracking systems
 *       - Admin provisioning shared ingress numbers for the pool
 *       - Looking up forwarding configurations when calls arrive
 *
 * HOW:
 *   - Ingress numbers are stored as TrackingNumbers with provisioningType='INGRESS'
 *   - Multiple affiliates share the same ingress number
 *   - Each affiliate+campaign has a unique forwardingIdentifier
 *   - Calls are identified via SIP headers or URL parameters
 *
 * FORWARDING FLOW:
 * +-----------------------------------------------------------------------+
 * |  Caller dials affiliate's Ringba number (owned by affiliate)          |
 * |      |                                                                |
 * |  Ringba forwards to our ingress number with SIP headers:              |
 * |      X-Affiliate-ID: aff-123, X-Campaign-ID: camp-456                |
 * |      |                                                                |
 * |  /api/calls/incoming parses headers, identifies affiliate             |
 * |      |                                                                |
 * |  Normal auction flow continues                                        |
 * +-----------------------------------------------------------------------+
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { TrackingNumber } from '@prisma/client';
import * as Sentry from '@sentry/nextjs';
import {
  provisionPhoneNumber as twilioProvision,
  releasePhoneNumber as twilioRelease,
} from '@/lib/twilio';
import crypto from 'crypto';

// =====================================
// TYPE DEFINITIONS
// =====================================

export interface IngressNumber {
  id: string;
  phoneNumber: string;
  phoneNumberDisplay: string | null;
  twilioSid: string | null;
  provisioningStatus: string;
  active: boolean;
  activeForwardingCount: number;
  createdAt: Date;
}

export interface ForwardingConfig {
  id: string;
  affiliateId: string;
  campaignId: string;
  ingressNumberId: string;
  ingressPhoneNumber: string;
  forwardingIdentifier: string;
  sipCredentials: SipCredentials | null;
  createdAt: Date;
}

export interface SipCredentials {
  username: string;
  passwordHash: string;
  realm: string;
}

export interface AssignForwardingRequest {
  affiliateId: string;
  campaignId: string;
  ingressNumberId?: string; // Optional - will auto-select if not provided
  generateSipCredentials?: boolean;
}

export interface AssignForwardingResult {
  success: boolean;
  trackingNumber?: TrackingNumber;
  forwardingConfig?: {
    ingressPhoneNumber: string;
    ingressPhoneNumberDisplay: string | null;
    forwardingIdentifier: string;
    sipUsername?: string;
    sipPassword?: string;
    sipRealm?: string;
  };
  error?: string;
}

export interface ProvisionIngressResult {
  success: boolean;
  ingressNumber?: IngressNumber;
  error?: string;
}

// =====================================
// INGRESS NUMBER POOL MANAGEMENT
// =====================================

/**
 * List all ingress numbers in the pool
 *
 * WHY: Admin needs visibility into shared ingress number inventory.
 * WHEN: Admin viewing phone number management page.
 * HOW: Query tracking_numbers where provisioningType = 'INGRESS'.
 */
export async function listIngressNumbers(): Promise<IngressNumber[]> {
  const numbers = await prisma.trackingNumber.findMany({
    where: {
      provisioningType: 'INGRESS',
    },
    orderBy: { createdAt: 'desc' },
  });

  // Count active forwarding configs for each ingress number
  const ingressIds = numbers.map(n => n.id);
  const forwardingCounts = await prisma.trackingNumber.groupBy({
    by: ['forwardingIdentifier'],
    where: {
      provisioningType: 'FORWARDING',
      active: true,
      forwardingIdentifier: { not: null },
    },
    _count: true,
  });

  // Build count map from forwarding identifiers
  // Forwarding identifiers reference ingress number IDs
  const countMap = new Map<string, number>();
  for (const num of numbers) {
    // Count forwarding configs that use this ingress number
    const forwardingConfigs = await prisma.trackingNumber.count({
      where: {
        provisioningType: 'FORWARDING',
        active: true,
        forwardingIdentifier: { contains: num.phoneNumber },
      },
    });
    countMap.set(num.id, forwardingConfigs);
  }

  return numbers.map(n => ({
    id: n.id,
    phoneNumber: n.phoneNumber,
    phoneNumberDisplay: n.phoneNumberDisplay,
    twilioSid: n.twilioSid,
    provisioningStatus: n.provisioningStatus,
    active: n.active,
    activeForwardingCount: countMap.get(n.id) || 0,
    createdAt: n.createdAt,
  }));
}

/**
 * Get an available ingress number from the pool
 *
 * WHY: When affiliate sets up forwarding, we need to assign them an ingress number.
 * WHEN: Affiliate selects "Forward from my own number" option.
 * HOW: Find active ingress number with lowest usage for load balancing.
 */
export async function getAvailableIngressNumber(): Promise<TrackingNumber | null> {
  // Get all active ingress numbers
  const ingressNumbers = await prisma.trackingNumber.findMany({
    where: {
      provisioningType: 'INGRESS',
      provisioningStatus: 'ACTIVE',
      active: true,
    },
  });

  if (ingressNumbers.length === 0) {
    return null;
  }

  // Count forwarding configs for each ingress number for load balancing
  const usageCounts = await Promise.all(
    ingressNumbers.map(async (num) => {
      const count = await prisma.trackingNumber.count({
        where: {
          provisioningType: 'FORWARDING',
          active: true,
          // Forwarding identifier contains the ingress phone number
          forwardingIdentifier: { contains: num.phoneNumber },
        },
      });
      return { number: num, count };
    })
  );

  // Return the ingress number with lowest usage
  usageCounts.sort((a, b) => a.count - b.count);
  return usageCounts[0].number;
}

/**
 * Provision a new ingress number for the pool
 *
 * WHY: Admin needs to add shared ingress numbers for affiliate forwarding.
 * WHEN: Admin clicks "Add Ingress Number" in phone management.
 * HOW: Provision from Twilio and mark as INGRESS type.
 */
export async function provisionIngressNumber(options?: {
  areaCode?: string;
  tollFree?: boolean;
}): Promise<ProvisionIngressResult> {
  const { areaCode = '844', tollFree = true } = options || {};

  try {
    logger.info('Provisioning new ingress number', { areaCode, tollFree });

    // Create pending record first
    const pendingNumber = await prisma.trackingNumber.create({
      data: {
        phoneNumber: '', // Will be updated after Twilio provision
        provisioningType: 'INGRESS',
        provisioningStatus: 'PENDING',
        active: false,
      },
    });

    // Update to PROVISIONING
    await prisma.trackingNumber.update({
      where: { id: pendingNumber.id },
      data: { provisioningStatus: 'PROVISIONING' },
    });

    // Provision from Twilio
    let twilioResult;
    try {
      twilioResult = await twilioProvision({
        affiliateId: 'SYSTEM',
        campaignId: 'INGRESS_POOL',
        areaCode,
        tollFree,
      });
    } catch (twilioError) {
      // Mark as failed
      await prisma.trackingNumber.update({
        where: { id: pendingNumber.id },
        data: { provisioningStatus: 'FAILED' },
      });

      const errorMessage = (twilioError as Error).message;

      Sentry.captureException(twilioError, {
        level: 'error',
        extra: { areaCode, tollFree, type: 'ingress' },
      });

      logger.error('Ingress number provisioning failed', {
        trackingNumberId: pendingNumber.id,
        error: errorMessage,
      });

      return {
        success: false,
        error: `Failed to provision ingress number: ${errorMessage}`,
      };
    }

    // Update with Twilio details
    const ingressNumber = await prisma.trackingNumber.update({
      where: { id: pendingNumber.id },
      data: {
        phoneNumber: twilioResult.phoneNumber,
        phoneNumberDisplay: twilioResult.displayNumber,
        twilioSid: twilioResult.sid,
        provisioningStatus: 'ACTIVE',
        active: true,
      },
    });

    logger.info('Ingress number provisioned successfully', {
      id: ingressNumber.id,
      phoneNumber: ingressNumber.phoneNumber,
    });

    return {
      success: true,
      ingressNumber: {
        id: ingressNumber.id,
        phoneNumber: ingressNumber.phoneNumber,
        phoneNumberDisplay: ingressNumber.phoneNumberDisplay,
        twilioSid: ingressNumber.twilioSid,
        provisioningStatus: ingressNumber.provisioningStatus,
        active: ingressNumber.active,
        activeForwardingCount: 0,
        createdAt: ingressNumber.createdAt,
      },
    };
  } catch (error) {
    logger.error('Failed to provision ingress number', {
      error: (error as Error).message,
    });

    Sentry.captureException(error, {
      extra: { areaCode, tollFree },
    });

    return {
      success: false,
      error: `Failed to provision ingress number: ${(error as Error).message}`,
    };
  }
}

/**
 * Release an ingress number from the pool
 *
 * WHY: Admin may need to remove unused ingress numbers to reduce costs.
 * WHEN: Admin clicks "Release" on an ingress number.
 * HOW: Check for active forwarding configs first, then release from Twilio.
 */
export async function releaseIngressNumber(
  ingressNumberId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const ingressNumber = await prisma.trackingNumber.findUnique({
      where: { id: ingressNumberId },
    });

    if (!ingressNumber) {
      return { success: false, error: 'Ingress number not found' };
    }

    if (ingressNumber.provisioningType !== 'INGRESS') {
      return { success: false, error: 'Not an ingress number' };
    }

    // Check for active forwarding configs
    const activeForwardings = await prisma.trackingNumber.count({
      where: {
        provisioningType: 'FORWARDING',
        active: true,
        forwardingIdentifier: { contains: ingressNumber.phoneNumber },
      },
    });

    if (activeForwardings > 0) {
      return {
        success: false,
        error: `Cannot release: ${activeForwardings} active forwarding configuration(s) using this number`,
      };
    }

    // Update to RELEASING
    await prisma.trackingNumber.update({
      where: { id: ingressNumberId },
      data: { provisioningStatus: 'RELEASING' },
    });

    // Release from Twilio
    if (ingressNumber.twilioSid) {
      try {
        await twilioRelease(ingressNumber.twilioSid);
        logger.info('Ingress number released from Twilio', {
          id: ingressNumberId,
          twilioSid: ingressNumber.twilioSid,
        });
      } catch (twilioError) {
        logger.warn('Twilio release failed, marking as released anyway', {
          id: ingressNumberId,
          twilioSid: ingressNumber.twilioSid,
          error: (twilioError as Error).message,
        });
      }
    }

    // Mark as released
    await prisma.trackingNumber.update({
      where: { id: ingressNumberId },
      data: {
        provisioningStatus: 'RELEASED',
        active: false,
      },
    });

    logger.info('Ingress number released', {
      id: ingressNumberId,
      phoneNumber: ingressNumber.phoneNumber,
    });

    return { success: true };
  } catch (error) {
    logger.error('Failed to release ingress number', {
      ingressNumberId,
      error: (error as Error).message,
    });
    return {
      success: false,
      error: `Failed to release ingress number: ${(error as Error).message}`,
    };
  }
}

// =====================================
// FORWARDING CONFIGURATION
// =====================================

/**
 * Generate a unique forwarding identifier
 *
 * WHY: Each affiliate+campaign needs a unique identifier to route calls.
 * WHEN: Creating a new forwarding configuration.
 * HOW: Combine ingress phone, affiliate ID, and campaign ID into a lookup key.
 */
export function generateForwardingIdentifier(
  ingressPhone: string,
  affiliateId: string,
  campaignId: string
): string {
  // Format: INGRESS_PHONE:AFF_ID:CAMP_ID
  // This allows lookup by any combination
  return `${ingressPhone}:${affiliateId}:${campaignId}`;
}

/**
 * Generate SIP credentials for affiliate forwarding
 *
 * WHY: Some affiliates need SIP trunk authentication for forwarding.
 * WHEN: Affiliate requests SIP credentials for their forwarding setup.
 * HOW: Generate unique username and secure password.
 */
export function generateSipCredentials(
  affiliateId: string,
  campaignId: string
): { username: string; password: string; passwordHash: string; realm: string } {
  // Generate username from affiliate and campaign
  const username = `fwd_${affiliateId.slice(0, 8)}_${campaignId.slice(0, 8)}`;

  // Generate secure random password
  const password = crypto.randomBytes(16).toString('hex');

  // Hash password for storage
  const passwordHash = crypto
    .createHash('sha256')
    .update(password)
    .digest('hex');

  // Realm is our domain
  const realm = process.env.SIP_REALM || 'sip.mycontractornow.com';

  return { username, password, passwordHash, realm };
}

/**
 * Assign a forwarding configuration to an affiliate+campaign
 *
 * WHY: Affiliates who use external tracking need a forwarding configuration.
 * WHEN: Affiliate selects "Forward from my own number" in campaign setup.
 * HOW:
 *   1. Verify affiliate has APPROVED access to campaign
 *   2. Check for existing forwarding config
 *   3. Select or specify ingress number
 *   4. Generate forwarding identifier
 *   5. Optionally generate SIP credentials
 *   6. Create tracking_number record with type FORWARDING
 */
export async function assignForwardingConfig(
  request: AssignForwardingRequest
): Promise<AssignForwardingResult> {
  const { affiliateId, campaignId, ingressNumberId, generateSipCredentials: genSip = false } = request;

  try {
    // 1. Verify affiliate has active access to campaign
    const affiliateCampaign = await prisma.affiliateCampaign.findUnique({
      where: {
        affiliateId_campaignId: { affiliateId, campaignId },
      },
    });

    if (!affiliateCampaign) {
      return {
        success: false,
        error: 'You do not have access to this campaign. Please request access first.',
      };
    }

    if (affiliateCampaign.status !== 'APPROVED') {
      return {
        success: false,
        error: `Your campaign access is ${affiliateCampaign.status.toLowerCase()}. Cannot configure forwarding.`,
      };
    }

    // 2. Check for existing forwarding or platform number
    const existingNumber = await prisma.trackingNumber.findFirst({
      where: {
        affiliateId,
        campaignId,
        provisioningStatus: { in: ['ACTIVE', 'PENDING', 'PROVISIONING'] },
      },
    });

    if (existingNumber) {
      if (existingNumber.provisioningType === 'PLATFORM') {
        return {
          success: false,
          error: 'You already have a platform-provisioned number for this campaign. Release it first to switch to forwarding.',
        };
      }
      // Return existing forwarding config
      const forwardingId = existingNumber.forwardingIdentifier;
      const ingressPhone = forwardingId?.split(':')[0] || '';

      const ingressNum = await prisma.trackingNumber.findFirst({
        where: {
          phoneNumber: ingressPhone,
          provisioningType: 'INGRESS',
        },
      });

      return {
        success: true,
        trackingNumber: existingNumber,
        forwardingConfig: {
          ingressPhoneNumber: ingressPhone,
          ingressPhoneNumberDisplay: ingressNum?.phoneNumberDisplay || null,
          forwardingIdentifier: existingNumber.forwardingIdentifier || '',
        },
      };
    }

    // 3. Get campaign details
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      return { success: false, error: 'Campaign not found' };
    }

    if (!campaign.active) {
      return { success: false, error: 'Campaign is no longer active' };
    }

    // 4. Get ingress number (specified or auto-select)
    let ingressNumber: TrackingNumber | null = null;

    if (ingressNumberId) {
      ingressNumber = await prisma.trackingNumber.findUnique({
        where: { id: ingressNumberId },
      });
      if (!ingressNumber || ingressNumber.provisioningType !== 'INGRESS') {
        return { success: false, error: 'Invalid ingress number specified' };
      }
      if (ingressNumber.provisioningStatus !== 'ACTIVE') {
        return { success: false, error: 'Specified ingress number is not active' };
      }
    } else {
      ingressNumber = await getAvailableIngressNumber();
      if (!ingressNumber) {
        return {
          success: false,
          error: 'No ingress numbers available. Please contact support.',
        };
      }
    }

    // 5. Generate forwarding identifier
    const forwardingIdentifier = generateForwardingIdentifier(
      ingressNumber.phoneNumber,
      affiliateId,
      campaignId
    );

    // 6. Optionally generate SIP credentials
    let sipCreds: { username: string; password: string; passwordHash: string; realm: string } | null = null;
    if (genSip) {
      sipCreds = generateSipCredentials(affiliateId, campaignId);
    }

    // 7. Create forwarding tracking number record
    const trackingNumber = await prisma.trackingNumber.create({
      data: {
        // Use ingress number as the phone (for lookups)
        phoneNumber: `FWD:${ingressNumber.phoneNumber}:${affiliateId}:${campaignId}`,
        phoneNumberDisplay: ingressNumber.phoneNumberDisplay,
        affiliateId,
        campaignId,
        serviceTypeId: campaign.serviceTypeId,
        provisioningType: 'FORWARDING',
        provisioningStatus: 'ACTIVE',
        forwardingIdentifier,
        active: true,
        // Store SIP credentials in a JSON field if generated
        // Note: The schema has forwardingIdentifier but no sipCredentials field
        // We'll store additional info in the identifier or add to schema
      },
    });

    logger.info('Forwarding configuration created', {
      trackingNumberId: trackingNumber.id,
      affiliateId,
      campaignId,
      ingressNumberId: ingressNumber.id,
      forwardingIdentifier,
    });

    return {
      success: true,
      trackingNumber,
      forwardingConfig: {
        ingressPhoneNumber: ingressNumber.phoneNumber,
        ingressPhoneNumberDisplay: ingressNumber.phoneNumberDisplay,
        forwardingIdentifier,
        sipUsername: sipCreds?.username,
        sipPassword: sipCreds?.password,
        sipRealm: sipCreds?.realm,
      },
    };
  } catch (error) {
    logger.error('Failed to assign forwarding config', {
      affiliateId,
      campaignId,
      error: (error as Error).message,
    });

    Sentry.captureException(error, {
      extra: { affiliateId, campaignId, ingressNumberId },
    });

    return {
      success: false,
      error: `Failed to configure forwarding: ${(error as Error).message}`,
    };
  }
}

/**
 * Look up forwarding configuration by identifier
 *
 * WHY: When a call arrives at ingress number, we need to identify the affiliate.
 * WHEN: /api/calls/incoming receives call on ingress number with SIP headers.
 * HOW: Parse forwarding identifier and look up tracking number record.
 */
export async function lookupForwardingConfig(
  ingressPhone: string,
  affiliateId: string,
  campaignId: string
): Promise<TrackingNumber | null> {
  const forwardingIdentifier = generateForwardingIdentifier(
    ingressPhone,
    affiliateId,
    campaignId
  );

  return prisma.trackingNumber.findFirst({
    where: {
      forwardingIdentifier,
      provisioningType: 'FORWARDING',
      provisioningStatus: 'ACTIVE',
      active: true,
    },
    include: {
      affiliate: true,
      campaign: true,
      serviceType: true,
    },
  });
}

/**
 * Look up by just affiliate ID and campaign ID (without ingress phone)
 *
 * WHY: Sometimes we only have affiliate/campaign from URL params.
 * WHEN: Calls forwarded with URL params instead of full SIP headers.
 * HOW: Query by affiliate and campaign with FORWARDING type.
 */
export async function lookupForwardingByAffiliateCampaign(
  affiliateId: string,
  campaignId: string
): Promise<TrackingNumber | null> {
  return prisma.trackingNumber.findFirst({
    where: {
      affiliateId,
      campaignId,
      provisioningType: 'FORWARDING',
      provisioningStatus: 'ACTIVE',
      active: true,
    },
    include: {
      affiliate: true,
      campaign: true,
      serviceType: true,
    },
  });
}

/**
 * Check if a phone number is an ingress number
 *
 * WHY: Incoming call handler needs to know if this is a shared ingress number.
 * WHEN: /api/calls/incoming receives a call and checks the target number.
 * HOW: Query tracking_numbers for INGRESS type with matching phone.
 */
export async function isIngressNumber(phoneNumber: string): Promise<boolean> {
  const count = await prisma.trackingNumber.count({
    where: {
      phoneNumber,
      provisioningType: 'INGRESS',
      provisioningStatus: 'ACTIVE',
      active: true,
    },
  });
  return count > 0;
}

/**
 * Release a forwarding configuration
 *
 * WHY: Affiliate may want to switch to platform provisioning or stop campaign.
 * WHEN: Affiliate clicks "Release Forwarding" in their portal.
 * HOW: Mark the forwarding tracking number as released.
 */
export async function releaseForwardingConfig(
  trackingNumberId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const trackingNumber = await prisma.trackingNumber.findUnique({
      where: { id: trackingNumberId },
    });

    if (!trackingNumber) {
      return { success: false, error: 'Tracking number not found' };
    }

    if (trackingNumber.provisioningType !== 'FORWARDING') {
      return { success: false, error: 'Not a forwarding configuration' };
    }

    // Check for active calls (same as platform number release)
    const activeCalls = await prisma.call.count({
      where: {
        trackingNumberId,
        status: { in: ['RINGING', 'IVR', 'BIDDING', 'CONNECTING', 'CONNECTED'] },
      },
    });

    if (activeCalls > 0) {
      return {
        success: false,
        error: `Cannot release: ${activeCalls} active call(s) in progress`,
      };
    }

    // Mark as released (no Twilio release needed - ingress number stays)
    await prisma.trackingNumber.update({
      where: { id: trackingNumberId },
      data: {
        provisioningStatus: 'RELEASED',
        active: false,
      },
    });

    logger.info('Forwarding configuration released', {
      trackingNumberId,
      forwardingIdentifier: trackingNumber.forwardingIdentifier,
    });

    return { success: true };
  } catch (error) {
    logger.error('Failed to release forwarding config', {
      trackingNumberId,
      error: (error as Error).message,
    });
    return {
      success: false,
      error: `Failed to release forwarding: ${(error as Error).message}`,
    };
  }
}

/**
 * Get forwarding configurations for an affiliate
 *
 * WHY: Affiliate portal needs to show their forwarding setups.
 * WHEN: Affiliate views their campaigns page.
 * HOW: Query forwarding tracking numbers by affiliate ID.
 */
export async function getForwardingConfigsByAffiliate(
  affiliateId: string
): Promise<ForwardingConfig[]> {
  const trackingNumbers = await prisma.trackingNumber.findMany({
    where: {
      affiliateId,
      provisioningType: 'FORWARDING',
      provisioningStatus: 'ACTIVE',
      active: true,
    },
    include: {
      campaign: true,
    },
  });

  return trackingNumbers.map((tn) => {
    const parts = tn.forwardingIdentifier?.split(':') || [];
    return {
      id: tn.id,
      affiliateId: tn.affiliateId!,
      campaignId: tn.campaignId!,
      ingressNumberId: '', // Would need additional lookup
      ingressPhoneNumber: parts[0] || '',
      forwardingIdentifier: tn.forwardingIdentifier || '',
      sipCredentials: null, // Not stored in current schema
      createdAt: tn.createdAt,
    };
  });
}
