/**
 * Affiliate Link Service
 *
 * WHY: Centralizes tracking link creation, management, and click/conversion tracking.
 *      Ensures consistent link behavior and attribution tracking.
 *
 * WHEN: Use this service for:
 *       - Creating new tracking links
 *       - Tracking link clicks
 *       - Attributing leads to affiliates
 *       - Managing link status
 *
 * HOW: Import and call the appropriate method. All methods:
 *      - Validate input parameters
 *      - Generate unique tracking codes
 *      - Increment counters atomically
 *      - Log important operations for audit
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import {
  AffiliateLink,
  CreateAffiliateLinkRequest
} from '@/types/database';
import crypto from 'crypto';

// Link code configuration
const CODE_LENGTH = 8;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

export interface LinkResult {
  success: boolean;
  link?: AffiliateLink;
  error?: string;
}

export interface TrackClickResult {
  success: boolean;
  affiliateId?: string;
  targetPath?: string;
  error?: string;
}

/**
 * Create a new tracking link for an affiliate
 */
export async function createLink(
  affiliateId: string,
  data: CreateAffiliateLinkRequest
): Promise<LinkResult> {
  try {
    // Validate affiliate exists and is active
    const affiliate = await prisma.affiliate.findUnique({
      where: { id: affiliateId }
    });

    if (!affiliate) {
      return { success: false, error: 'Affiliate not found' };
    }

    if (affiliate.status !== 'ACTIVE') {
      return { success: false, error: 'Affiliate account is not active' };
    }

    // Generate or validate code (accepts both code and customCode)
    let code = data.code || data.customCode;
    if (code) {
      // Validate custom code
      const codeError = validateCode(code);
      if (codeError) {
        return { success: false, error: codeError };
      }
      // Check uniqueness
      const existing = await prisma.affiliateLink.findUnique({
        where: { code }
      });
      if (existing) {
        return { success: false, error: 'Code already in use' };
      }
    } else {
      // Generate unique code
      code = await generateUniqueCode();
    }

    // Validate target path (accepts both targetPath and targetUrl)
    const rawTargetPath = data.targetPath || data.targetUrl || '/';
    const targetPath = normalizeTargetPath(rawTargetPath);

    // Create link
    const link = await prisma.affiliateLink.create({
      data: {
        affiliateId,
        code,
        targetPath,
        name: data.name || null,
        clicks: 0,
        conversions: 0,
        isActive: true
      }
    });

    logger.info('Affiliate link created', {
      affiliateId,
      linkId: link.id,
      code: link.code
    });

    return {
      success: true,
      link: mapPrismaLinkToLink(link)
    };
  } catch (error) {
    logger.error('Failed to create affiliate link', {
      affiliateId,
      error: (error as Error).message
    });
    return {
      success: false,
      error: `Failed to create link: ${(error as Error).message}`
    };
  }
}

/**
 * Generate a unique tracking code
 */
export async function generateUniqueCode(): Promise<string> {
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const code = generateRandomCode(CODE_LENGTH);

    // Check if code exists
    const existing = await prisma.affiliateLink.findUnique({
      where: { code }
    });

    if (!existing) {
      return code;
    }

    attempts++;
  }

  // Fallback: use timestamp-based code
  const timestamp = Date.now().toString(36);
  const random = generateRandomCode(4);
  return `${timestamp}${random}`.substring(0, CODE_LENGTH);
}

/**
 * Track a link click
 * Increments the click counter and returns affiliate info for attribution
 */
export async function trackClick(code: string): Promise<TrackClickResult> {
  try {
    // Find link and increment clicks atomically
    const link = await prisma.affiliateLink.update({
      where: { code },
      data: {
        clicks: { increment: 1 }
      }
    });

    if (!link.isActive) {
      // Still track but note it's inactive
      logger.warn('Click on inactive link', { code });
    }

    return {
      success: true,
      affiliateId: link.affiliateId,
      targetPath: link.targetPath
    };
  } catch (error) {
    // Link not found or error
    logger.warn('Failed to track link click', {
      code,
      error: (error as Error).message
    });
    return {
      success: false,
      error: 'Link not found'
    };
  }
}

/**
 * Record a conversion for a link
 * Called when a lead is created with affiliate attribution
 */
export async function recordConversion(code: string): Promise<boolean> {
  try {
    await prisma.affiliateLink.update({
      where: { code },
      data: {
        conversions: { increment: 1 }
      }
    });

    logger.info('Link conversion recorded', { code });
    return true;
  } catch (error) {
    logger.error('Failed to record conversion', {
      code,
      error: (error as Error).message
    });
    return false;
  }
}

/**
 * Get link by code
 */
export async function getLinkByCode(code: string): Promise<AffiliateLink | null> {
  const link = await prisma.affiliateLink.findUnique({
    where: { code },
    include: {
      affiliate: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          status: true
        }
      }
    }
  });

  if (!link) return null;
  return mapPrismaLinkToLink(link);
}

/**
 * Get all links for an affiliate
 */
export async function getLinksByAffiliateId(
  affiliateId: string,
  params?: {
    page?: number;
    limit?: number;
    activeOnly?: boolean;
  }
): Promise<{
  links: AffiliateLink[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const page = params?.page || 1;
  const limit = params?.limit || 20;
  const skip = (page - 1) * limit;

  const where: any = { affiliateId };
  if (params?.activeOnly) {
    where.isActive = true;
  }

  const [links, total] = await Promise.all([
    prisma.affiliateLink.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' }
    }),
    prisma.affiliateLink.count({ where })
  ]);

  return {
    links: links.map(mapPrismaLinkToLink),
    total,
    page,
    totalPages: Math.ceil(total / limit)
  };
}

/**
 * Update link
 */
export async function updateLink(
  id: string,
  affiliateId: string,
  data: {
    name?: string;
    isActive?: boolean;
  }
): Promise<LinkResult> {
  try {
    // Verify ownership
    const existing = await prisma.affiliateLink.findUnique({
      where: { id }
    });

    if (!existing) {
      return { success: false, error: 'Link not found' };
    }

    if (existing.affiliateId !== affiliateId) {
      return { success: false, error: 'Unauthorized' };
    }

    const link = await prisma.affiliateLink.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.isActive !== undefined && { isActive: data.isActive })
      }
    });

    logger.info('Affiliate link updated', { linkId: id });

    return {
      success: true,
      link: mapPrismaLinkToLink(link)
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to update link: ${(error as Error).message}`
    };
  }
}

/**
 * Soft delete link (deactivate)
 */
export async function deleteLink(
  id: string,
  affiliateId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Verify ownership
    const existing = await prisma.affiliateLink.findUnique({
      where: { id }
    });

    if (!existing) {
      return { success: false, error: 'Link not found' };
    }

    if (existing.affiliateId !== affiliateId) {
      return { success: false, error: 'Unauthorized' };
    }

    // Soft delete by deactivating
    await prisma.affiliateLink.update({
      where: { id },
      data: { isActive: false }
    });

    logger.info('Affiliate link deleted (deactivated)', { linkId: id });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Failed to delete link: ${(error as Error).message}`
    };
  }
}

/**
 * Get link statistics for an affiliate
 */
export async function getLinkStats(affiliateId: string): Promise<{
  totalLinks: number;
  activeLinks: number;
  totalClicks: number;
  totalConversions: number;
  conversionRate: number;
}> {
  const links = await prisma.affiliateLink.findMany({
    where: { affiliateId },
    select: {
      isActive: true,
      clicks: true,
      conversions: true
    }
  });

  const totalLinks = links.length;
  const activeLinks = links.filter(l => l.isActive).length;
  const totalClicks = links.reduce((sum, l) => sum + l.clicks, 0);
  const totalConversions = links.reduce((sum, l) => sum + l.conversions, 0);
  const conversionRate = totalClicks > 0 ? totalConversions / totalClicks : 0;

  return {
    totalLinks,
    activeLinks,
    totalClicks,
    totalConversions,
    conversionRate
  };
}

/**
 * Build the full tracking URL for a link
 */
export function buildTrackingUrl(code: string, baseUrl?: string): string {
  const base = baseUrl || process.env.NEXT_PUBLIC_BASE_URL || 'https://mycontractornow.com';
  return `${base}/r/${code}`;
}

// =====================================
// HELPER FUNCTIONS
// =====================================

/**
 * Generate random alphanumeric code
 */
function generateRandomCode(length: number): string {
  let result = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return result;
}

/**
 * Validate custom code format
 */
function validateCode(code: string): string | null {
  if (code.length < 4) {
    return 'Code must be at least 4 characters';
  }
  if (code.length > 20) {
    return 'Code must be 20 characters or less';
  }
  if (!/^[a-zA-Z0-9-_]+$/.test(code)) {
    return 'Code can only contain letters, numbers, dashes, and underscores';
  }
  return null;
}

/**
 * Normalize target path (ensure starts with /)
 */
function normalizeTargetPath(path: string): string {
  if (!path) return '/';
  return path.startsWith('/') ? path : `/${path}`;
}

/**
 * Map Prisma link to TypeScript AffiliateLink type
 */
function mapPrismaLinkToLink(prismaLink: any): AffiliateLink {
  return {
    id: prismaLink.id,
    affiliateId: prismaLink.affiliateId,
    code: prismaLink.code,
    targetPath: prismaLink.targetPath,
    name: prismaLink.name,
    clicks: prismaLink.clicks,
    conversions: prismaLink.conversions,
    isActive: prismaLink.isActive,
    createdAt: prismaLink.createdAt,
    updatedAt: prismaLink.updatedAt,
    affiliate: prismaLink.affiliate
  };
}
