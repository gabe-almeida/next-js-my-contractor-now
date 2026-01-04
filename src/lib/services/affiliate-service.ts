/**
 * Affiliate Service
 *
 * WHY: Centralizes affiliate CRUD operations, authentication, and JWT token generation.
 *      Ensures consistent affiliate management regardless of entry point (API, admin UI).
 *
 * WHEN: Use this service for:
 *       - Affiliate registration (signup)
 *       - Affiliate login and token generation
 *       - Affiliate profile updates
 *       - Admin affiliate management (status changes)
 *
 * HOW: Import and call the appropriate method. All methods:
 *      - Validate input parameters
 *      - Use bcrypt for password hashing
 *      - Generate JWT tokens for authenticated affiliates
 *      - Log important operations for audit
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { generateJwtToken, verifyJwtToken } from '@/lib/security';
import bcrypt from 'bcryptjs';
import {
  Affiliate,
  AffiliateStatus,
  CreateAffiliateRequest,
  UpdateAffiliateRequest
} from '@/types/database';

// Password hashing configuration
const BCRYPT_SALT_ROUNDS = 12;

// Affiliate JWT configuration (different audience from admin)
const AFFILIATE_JWT_AUDIENCE = 'contractor-platform-affiliate';

export interface AffiliateAuthResult {
  success: boolean;
  affiliate?: Affiliate;
  token?: string;
  error?: string;
}

export interface AffiliateResult {
  success: boolean;
  affiliate?: Affiliate;
  error?: string;
}

/**
 * Create a new affiliate (registration)
 * Status defaults to PENDING - requires admin approval
 */
export async function createAffiliate(
  data: CreateAffiliateRequest
): Promise<AffiliateResult> {
  try {
    // Check for existing email
    const existing = await prisma.affiliate.findUnique({
      where: { email: data.email.toLowerCase() }
    });

    if (existing) {
      return { success: false, error: 'Email already registered' };
    }

    // Validate password requirements
    const passwordError = validatePassword(data.password);
    if (passwordError) {
      return { success: false, error: passwordError };
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, BCRYPT_SALT_ROUNDS);

    // Create affiliate with PENDING status
    const affiliate = await prisma.affiliate.create({
      data: {
        email: data.email.toLowerCase(),
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        companyName: data.companyName || null,
        phone: data.phone || null,
        status: 'PENDING',
        commissionRate: 0.10, // Default 10% commission rate
        emailVerified: false
      }
    });

    logger.info('New affiliate registered', {
      affiliateId: affiliate.id,
      email: affiliate.email
    });

    return {
      success: true,
      affiliate: mapPrismaAffiliateToAffiliate(affiliate)
    };
  } catch (error) {
    logger.error('Failed to create affiliate', {
      error: (error as Error).message
    });
    return {
      success: false,
      error: `Failed to create affiliate: ${(error as Error).message}`
    };
  }
}

/**
 * Validate affiliate password and return JWT token
 */
export async function authenticateAffiliate(
  email: string,
  password: string,
  rememberMe: boolean = false
): Promise<AffiliateAuthResult> {
  try {
    // Find affiliate by email
    const affiliate = await prisma.affiliate.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!affiliate) {
      return { success: false, error: 'Invalid credentials' };
    }

    // Check status
    if (affiliate.status !== 'ACTIVE') {
      if (affiliate.status === 'PENDING') {
        return { success: false, error: 'Account pending approval' };
      }
      if (affiliate.status === 'SUSPENDED') {
        return { success: false, error: 'Account suspended' };
      }
      return { success: false, error: 'Account not active' };
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, affiliate.passwordHash);
    if (!isValidPassword) {
      return { success: false, error: 'Invalid credentials' };
    }

    // Generate JWT token
    const token = generateAffiliateToken(affiliate, rememberMe);

    logger.info('Affiliate logged in', {
      affiliateId: affiliate.id
    });

    return {
      success: true,
      affiliate: mapPrismaAffiliateToAffiliate(affiliate),
      token
    };
  } catch (error) {
    logger.error('Affiliate authentication failed', {
      error: (error as Error).message
    });
    return {
      success: false,
      error: 'Authentication failed'
    };
  }
}

/**
 * Generate JWT token for affiliate
 * Token includes affiliate role and permissions
 */
export function generateAffiliateToken(
  affiliate: { id: string; email: string },
  rememberMe: boolean = false
): string {
  return generateJwtToken({
    userId: affiliate.id,
    role: 'affiliate',
    permissions: [
      'affiliate:read_own',
      'affiliate:write_own',
      'affiliate:read_commissions',
      'affiliate:request_withdrawal'
    ]
  });
}

/**
 * Verify affiliate JWT token
 */
export function verifyAffiliateToken(token: string): {
  valid: boolean;
  affiliateId?: string;
  error?: string;
} {
  const result = verifyJwtToken(token);

  if (!result.valid) {
    return { valid: false, error: result.error };
  }

  // Verify this is an affiliate token
  if (result.payload?.role !== 'affiliate') {
    return { valid: false, error: 'Invalid token type' };
  }

  return {
    valid: true,
    affiliateId: result.payload.userId
  };
}

/**
 * Get affiliate by ID
 */
export async function getAffiliateById(id: string): Promise<Affiliate | null> {
  const affiliate = await prisma.affiliate.findUnique({
    where: { id },
    include: {
      links: true,
      commissions: {
        take: 10,
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  if (!affiliate) return null;
  return mapPrismaAffiliateToAffiliate(affiliate);
}

/**
 * Get affiliate by email
 */
export async function getAffiliateByEmail(email: string): Promise<Affiliate | null> {
  const affiliate = await prisma.affiliate.findUnique({
    where: { email: email.toLowerCase() }
  });

  if (!affiliate) return null;
  return mapPrismaAffiliateToAffiliate(affiliate);
}

/**
 * Update affiliate profile
 */
export async function updateAffiliate(
  id: string,
  data: Partial<UpdateAffiliateRequest>
): Promise<AffiliateResult> {
  try {
    const affiliate = await prisma.affiliate.update({
      where: { id },
      data: {
        ...(data.firstName && { firstName: data.firstName }),
        ...(data.lastName && { lastName: data.lastName }),
        ...(data.companyName !== undefined && { companyName: data.companyName }),
        ...(data.phone !== undefined && { phone: data.phone })
      }
    });

    logger.info('Affiliate profile updated', { affiliateId: id });

    return {
      success: true,
      affiliate: mapPrismaAffiliateToAffiliate(affiliate)
    };
  } catch (error) {
    logger.error('Failed to update affiliate', {
      affiliateId: id,
      error: (error as Error).message
    });
    return {
      success: false,
      error: `Failed to update affiliate: ${(error as Error).message}`
    };
  }
}

/**
 * Update affiliate status (admin action)
 */
export async function updateAffiliateStatus(
  id: string,
  status: AffiliateStatus,
  adminUserId?: string
): Promise<AffiliateResult> {
  try {
    const affiliate = await prisma.affiliate.update({
      where: { id },
      data: { status }
    });

    logger.info('Affiliate status changed', {
      affiliateId: id,
      newStatus: status,
      adminUserId
    });

    return {
      success: true,
      affiliate: mapPrismaAffiliateToAffiliate(affiliate)
    };
  } catch (error) {
    logger.error('Failed to update affiliate status', {
      affiliateId: id,
      error: (error as Error).message
    });
    return {
      success: false,
      error: `Failed to update status: ${(error as Error).message}`
    };
  }
}

/**
 * Update affiliate commission rate (admin action)
 */
export async function updateCommissionRate(
  id: string,
  commissionRate: number,
  adminUserId?: string
): Promise<AffiliateResult> {
  try {
    // Validate rate (0-100%)
    if (commissionRate < 0 || commissionRate > 1) {
      return { success: false, error: 'Commission rate must be between 0 and 1' };
    }

    const affiliate = await prisma.affiliate.update({
      where: { id },
      data: { commissionRate }
    });

    logger.info('Affiliate commission rate changed', {
      affiliateId: id,
      newRate: commissionRate,
      adminUserId
    });

    return {
      success: true,
      affiliate: mapPrismaAffiliateToAffiliate(affiliate)
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to update commission rate: ${(error as Error).message}`
    };
  }
}

/**
 * Change affiliate password
 */
export async function changePassword(
  id: string,
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const affiliate = await prisma.affiliate.findUnique({
      where: { id }
    });

    if (!affiliate) {
      return { success: false, error: 'Affiliate not found' };
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, affiliate.passwordHash);
    if (!isValidPassword) {
      return { success: false, error: 'Current password is incorrect' };
    }

    // Validate new password
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return { success: false, error: passwordError };
    }

    // Hash and save new password
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
    await prisma.affiliate.update({
      where: { id },
      data: { passwordHash }
    });

    logger.info('Affiliate password changed', { affiliateId: id });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Failed to change password: ${(error as Error).message}`
    };
  }
}

/**
 * List affiliates with pagination and filters (admin)
 */
export async function listAffiliates(params: {
  page?: number;
  limit?: number;
  status?: AffiliateStatus;
  search?: string;
}): Promise<{
  affiliates: Affiliate[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const page = params.page || 1;
  const limit = params.limit || 20;
  const skip = (page - 1) * limit;

  const where: any = {};
  if (params.status) {
    where.status = params.status;
  }
  if (params.search) {
    where.OR = [
      { email: { contains: params.search, mode: 'insensitive' } },
      { firstName: { contains: params.search, mode: 'insensitive' } },
      { lastName: { contains: params.search, mode: 'insensitive' } },
      { companyName: { contains: params.search, mode: 'insensitive' } }
    ];
  }

  const [affiliates, total] = await Promise.all([
    prisma.affiliate.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            links: true,
            commissions: true
          }
        }
      }
    }),
    prisma.affiliate.count({ where })
  ]);

  return {
    affiliates: affiliates.map(mapPrismaAffiliateToAffiliate),
    total,
    page,
    totalPages: Math.ceil(total / limit)
  };
}

// =====================================
// HELPER FUNCTIONS
// =====================================

/**
 * Validate password requirements
 * Returns error message or null if valid
 */
function validatePassword(password: string): string | null {
  if (!password || password.length < 8) {
    return 'Password must be at least 8 characters';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number';
  }
  return null;
}

/**
 * Map Prisma affiliate to TypeScript Affiliate type
 */
function mapPrismaAffiliateToAffiliate(prismaAffiliate: any): Affiliate {
  return {
    id: prismaAffiliate.id,
    email: prismaAffiliate.email,
    passwordHash: prismaAffiliate.passwordHash,
    firstName: prismaAffiliate.firstName,
    lastName: prismaAffiliate.lastName,
    companyName: prismaAffiliate.companyName,
    phone: prismaAffiliate.phone,
    commissionRate: Number(prismaAffiliate.commissionRate),
    status: prismaAffiliate.status as AffiliateStatus,
    emailVerified: prismaAffiliate.emailVerified,
    createdAt: prismaAffiliate.createdAt,
    updatedAt: prismaAffiliate.updatedAt,
    links: prismaAffiliate.links,
    commissions: prismaAffiliate.commissions,
    withdrawals: prismaAffiliate.withdrawals
  };
}
