/**
 * Contractor Authentication Service
 *
 * WHY: Centralizes contractor (buyer) authentication and JWT token generation.
 *      Allows contractors to log into their dashboard to view leads and manage settings.
 *
 * WHEN: Use this service for:
 *       - Contractor login and token generation
 *       - Contractor token verification
 *       - Password management
 *
 * HOW: Import and call the appropriate method. Uses bcrypt for password hashing
 *      and JWT tokens for session management.
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { generateJwtToken, verifyJwtToken } from '@/lib/security';
import bcrypt from 'bcryptjs';

// Password hashing configuration
const BCRYPT_SALT_ROUNDS = 12;

export interface ContractorAuthResult {
  success: boolean;
  contractor?: {
    id: string;
    name: string;
    displayName: string | null;
    contactEmail: string | null;
    contactName: string | null;
    type: string;
  };
  token?: string;
  error?: string;
}

/**
 * Authenticate contractor and return JWT token
 *
 * WHY: Validates contractor credentials and generates session token
 * WHEN: Called from /api/contractors/login endpoint
 * HOW: Verifies email exists, login is enabled, password matches, returns JWT
 */
export async function authenticateContractor(
  email: string,
  password: string
): Promise<ContractorAuthResult> {
  try {
    // Find contractor by contact email or business email
    const contractor = await prisma.buyer.findFirst({
      where: {
        OR: [
          { contactEmail: email.toLowerCase() },
          { businessEmail: email.toLowerCase() }
        ],
        type: 'CONTRACTOR'
      }
    });

    if (!contractor) {
      return { success: false, error: 'Invalid credentials' };
    }

    // Check if login is enabled
    if (!contractor.loginEnabled) {
      return { success: false, error: 'Portal access not enabled. Contact support.' };
    }

    // Check if password is set
    if (!contractor.passwordHash) {
      return { success: false, error: 'Password not set. Contact support.' };
    }

    // Check if contractor is active
    if (!contractor.active) {
      return { success: false, error: 'Account is inactive' };
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, contractor.passwordHash);
    if (!isValidPassword) {
      return { success: false, error: 'Invalid credentials' };
    }

    // Update last login timestamp
    await prisma.buyer.update({
      where: { id: contractor.id },
      data: { lastLoginAt: new Date() }
    });

    // Generate JWT token
    const token = generateContractorToken(contractor);

    logger.info('Contractor logged in', {
      contractorId: contractor.id,
      name: contractor.name
    });

    return {
      success: true,
      contractor: {
        id: contractor.id,
        name: contractor.name,
        displayName: contractor.displayName,
        contactEmail: contractor.contactEmail,
        contactName: contractor.contactName,
        type: contractor.type
      },
      token
    };
  } catch (error) {
    logger.error('Contractor authentication failed', {
      error: (error as Error).message
    });
    return {
      success: false,
      error: 'Authentication failed'
    };
  }
}

/**
 * Generate JWT token for contractor
 */
export function generateContractorToken(
  contractor: { id: string; contactEmail: string | null }
): string {
  return generateJwtToken({
    userId: contractor.id,
    role: 'contractor',
    permissions: [
      'contractor:read_own',
      'contractor:read_leads',
      'contractor:update_settings'
    ]
  });
}

/**
 * Verify contractor JWT token
 */
export function verifyContractorToken(token: string): {
  valid: boolean;
  contractorId?: string;
  error?: string;
} {
  const result = verifyJwtToken(token);

  if (!result.valid) {
    return { valid: false, error: result.error };
  }

  if (result.payload?.role !== 'contractor') {
    return { valid: false, error: 'Invalid token type' };
  }

  return {
    valid: true,
    contractorId: result.payload.userId
  };
}

/**
 * Set contractor password (admin or first-time setup)
 *
 * WHY: Allows setting/resetting contractor passwords
 * WHEN: Admin enables portal access, or contractor resets password
 * HOW: Hashes password and updates buyer record
 */
export async function setContractorPassword(
  contractorId: string,
  password: string,
  enableLogin: boolean = true
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate password requirements
    if (password.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters' };
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    await prisma.buyer.update({
      where: { id: contractorId },
      data: {
        passwordHash,
        loginEnabled: enableLogin
      }
    });

    logger.info('Contractor password set', { contractorId });

    return { success: true };
  } catch (error) {
    logger.error('Failed to set contractor password', {
      contractorId,
      error: (error as Error).message
    });
    return { success: false, error: 'Failed to set password' };
  }
}

/**
 * Get contractor by ID (for authenticated requests)
 */
export async function getContractorById(contractorId: string) {
  return prisma.buyer.findUnique({
    where: { id: contractorId },
    select: {
      id: true,
      name: true,
      displayName: true,
      type: true,
      contactName: true,
      contactEmail: true,
      contactPhone: true,
      businessEmail: true,
      businessPhone: true,
      active: true,
      loginEnabled: true,
      lastLoginAt: true,
      notifyEmail: true,
      notifyDashboard: true,
      acceptsCalls: true,
      callForwardingNumber: true
    }
  });
}
