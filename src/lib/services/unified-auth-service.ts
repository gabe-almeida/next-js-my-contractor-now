/**
 * Unified Authentication Service
 *
 * WHY: Single authentication entry point that detects user type (admin, affiliate, contractor)
 *      and returns appropriate token and redirect path.
 *
 * WHEN: Used by unified /login page to authenticate any user type.
 *
 * HOW: Checks email against all user tables in priority order:
 *      1. admin_users (highest priority)
 *      2. affiliates
 *      3. buyers (contractors with loginEnabled=true)
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { generateJwtToken } from '@/lib/security';
import bcrypt from 'bcryptjs';

export type UserType = 'admin' | 'affiliate' | 'contractor';

export interface UnifiedAuthResult {
  success: boolean;
  userType?: UserType;
  user?: {
    id: string;
    email: string;
    name: string;
    role?: string;
  };
  token?: string;
  redirectPath?: string;
  error?: string;
}

/**
 * Authenticate user against all user tables
 *
 * WHY: Single login for all user types
 * WHEN: Called from /api/auth/unified-login endpoint
 * HOW: Check each table in priority order, verify password, return token + redirect
 */
export async function authenticateUnified(
  email: string,
  password: string
): Promise<UnifiedAuthResult> {
  const normalizedEmail = email.toLowerCase().trim();

  // 1. Check admin_users first (highest priority)
  const adminResult = await tryAdminAuth(normalizedEmail, password);
  if (adminResult.success) return adminResult;
  if (adminResult.error && adminResult.error !== 'User not found') {
    return adminResult; // Return specific errors like "invalid password"
  }

  // 2. Check affiliates
  const affiliateResult = await tryAffiliateAuth(normalizedEmail, password);
  if (affiliateResult.success) return affiliateResult;
  if (affiliateResult.error && affiliateResult.error !== 'User not found') {
    return affiliateResult;
  }

  // 3. Check contractors (buyers with loginEnabled)
  const contractorResult = await tryContractorAuth(normalizedEmail, password);
  if (contractorResult.success) return contractorResult;
  if (contractorResult.error && contractorResult.error !== 'User not found') {
    return contractorResult;
  }

  // No user found in any table
  return { success: false, error: 'Invalid credentials' };
}

async function tryAdminAuth(email: string, password: string): Promise<UnifiedAuthResult> {
  try {
    const admin = await prisma.adminUser.findUnique({
      where: { email }
    });

    if (!admin) {
      return { success: false, error: 'User not found' };
    }

    if (!admin.active) {
      return { success: false, error: 'Account is inactive' };
    }

    const isValidPassword = await bcrypt.compare(password, admin.passwordHash);
    if (!isValidPassword) {
      return { success: false, error: 'Invalid credentials' };
    }

    // Update last login
    await prisma.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() }
    });

    const token = generateJwtToken({
      userId: admin.id,
      role: admin.role,
      permissions: getAdminPermissions(admin.role)
    });

    logger.info('Admin logged in via unified login', { adminId: admin.id });

    return {
      success: true,
      userType: 'admin',
      user: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role
      },
      token,
      redirectPath: '/admin'
    };
  } catch (error) {
    logger.error('Admin auth error', { error: (error as Error).message });
    return { success: false, error: 'Authentication failed' };
  }
}

async function tryAffiliateAuth(email: string, password: string): Promise<UnifiedAuthResult> {
  try {
    const affiliate = await prisma.affiliate.findUnique({
      where: { email }
    });

    if (!affiliate) {
      return { success: false, error: 'User not found' };
    }

    if (affiliate.status === 'PENDING') {
      return { success: false, error: 'Account pending approval' };
    }

    if (affiliate.status === 'SUSPENDED') {
      return { success: false, error: 'Account suspended' };
    }

    if (affiliate.status !== 'ACTIVE') {
      return { success: false, error: 'Account not active' };
    }

    const isValidPassword = await bcrypt.compare(password, affiliate.passwordHash);
    if (!isValidPassword) {
      return { success: false, error: 'Invalid credentials' };
    }

    const token = generateJwtToken({
      userId: affiliate.id,
      role: 'affiliate',
      permissions: [
        'affiliate:read_own',
        'affiliate:write_own',
        'affiliate:read_commissions',
        'affiliate:request_withdrawal'
      ]
    });

    logger.info('Affiliate logged in via unified login', { affiliateId: affiliate.id });

    return {
      success: true,
      userType: 'affiliate',
      user: {
        id: affiliate.id,
        email: affiliate.email,
        name: `${affiliate.firstName} ${affiliate.lastName}`
      },
      token,
      redirectPath: '/affiliate/dashboard'
    };
  } catch (error) {
    logger.error('Affiliate auth error', { error: (error as Error).message });
    return { success: false, error: 'Authentication failed' };
  }
}

async function tryContractorAuth(email: string, password: string): Promise<UnifiedAuthResult> {
  try {
    const contractor = await prisma.buyer.findFirst({
      where: {
        OR: [
          { contactEmail: email },
          { businessEmail: email }
        ],
        type: 'CONTRACTOR'
      }
    });

    if (!contractor) {
      return { success: false, error: 'User not found' };
    }

    if (!contractor.loginEnabled) {
      return { success: false, error: 'Portal access not enabled' };
    }

    if (!contractor.passwordHash) {
      return { success: false, error: 'Password not set' };
    }

    if (!contractor.active) {
      return { success: false, error: 'Account is inactive' };
    }

    const isValidPassword = await bcrypt.compare(password, contractor.passwordHash);
    if (!isValidPassword) {
      return { success: false, error: 'Invalid credentials' };
    }

    // Update last login
    await prisma.buyer.update({
      where: { id: contractor.id },
      data: { lastLoginAt: new Date() }
    });

    const token = generateJwtToken({
      userId: contractor.id,
      role: 'contractor',
      permissions: [
        'contractor:read_own',
        'contractor:read_leads',
        'contractor:update_settings'
      ]
    });

    logger.info('Contractor logged in via unified login', { contractorId: contractor.id });

    return {
      success: true,
      userType: 'contractor',
      user: {
        id: contractor.id,
        email: contractor.contactEmail || contractor.businessEmail || '',
        name: contractor.displayName || contractor.name
      },
      token,
      redirectPath: '/contractor/dashboard'
    };
  } catch (error) {
    logger.error('Contractor auth error', { error: (error as Error).message });
    return { success: false, error: 'Authentication failed' };
  }
}

function getAdminPermissions(role: string): string[] {
  switch (role) {
    case 'SUPER_ADMIN':
      return ['admin:*', 'leads:*', 'buyers:*', 'affiliates:*', 'settings:*'];
    case 'ADMIN':
      return ['admin:read', 'leads:*', 'buyers:*', 'affiliates:read'];
    case 'SUPPORT':
      return ['admin:read', 'leads:read', 'leads:update', 'buyers:read'];
    default:
      return ['admin:read'];
  }
}
