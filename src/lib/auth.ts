/**
 * Enhanced Authentication Module
 * 
 * This module provides secure authentication utilities with JWT support,
 * constant-time comparison, and rate limiting integration.
 */

import { NextRequest } from 'next/server';
import { validateAdminAuth, generateJwtToken, verifyJwtToken } from './security';
import { checkRateLimit } from './rate-limiter';

// User roles and permissions
export const USER_ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  VIEWER: 'viewer'
} as const;

export const PERMISSIONS = {
  ADMIN_READ: 'admin:read',
  ADMIN_WRITE: 'admin:write',
  ADMIN_DELETE: 'admin:delete',
  LEADS_READ: 'leads:read',
  LEADS_WRITE: 'leads:write',
  ANALYTICS_READ: 'analytics:read'
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];
export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

export interface AuthUser {
  id: string;
  role: UserRole;
  permissions: Permission[];
  type: 'jwt' | 'api_key';
}

/**
 * Get role permissions mapping
 */
export function getRolePermissions(role: UserRole): Permission[] {
  switch (role) {
    case USER_ROLES.ADMIN:
      return [
        PERMISSIONS.ADMIN_READ,
        PERMISSIONS.ADMIN_WRITE,
        PERMISSIONS.ADMIN_DELETE,
        PERMISSIONS.LEADS_READ,
        PERMISSIONS.LEADS_WRITE,
        PERMISSIONS.ANALYTICS_READ
      ];
    case USER_ROLES.MANAGER:
      return [
        PERMISSIONS.ADMIN_READ,
        PERMISSIONS.LEADS_READ,
        PERMISSIONS.LEADS_WRITE,
        PERMISSIONS.ANALYTICS_READ
      ];
    case USER_ROLES.VIEWER:
      return [
        PERMISSIONS.ADMIN_READ,
        PERMISSIONS.LEADS_READ,
        PERMISSIONS.ANALYTICS_READ
      ];
    default:
      return [];
  }
}

/**
 * Enhanced authentication with rate limiting
 */
export async function authenticateRequest(req: NextRequest): Promise<{
  success: boolean;
  user?: AuthUser;
  error?: string;
  rateLimited?: boolean;
}> {
  try {
    // Check authentication rate limits first
    const authRateLimit = await checkRateLimit(req, 'authAttempts');
    if (!authRateLimit.allowed) {
      return {
        success: false,
        error: 'Too many authentication attempts',
        rateLimited: true
      };
    }

    // Validate authentication
    const authResult = await validateAdminAuth(req);
    
    if (!authResult.valid) {
      // Apply penalty for failed auth
      await checkRateLimit(req, 'authFailures');
      return {
        success: false,
        error: authResult.error || 'Authentication failed'
      };
    }

    return {
      success: true,
      user: authResult.user as AuthUser
    };

  } catch (error: any) {
    return {
      success: false,
      error: 'Authentication error'
    };
  }
}

/**
 * Check if user has required permission
 */
export function hasPermission(user: AuthUser, permission: Permission): boolean {
  return user.permissions.includes(permission);
}

/**
 * Check if user has any of the required permissions
 */
export function hasAnyPermission(user: AuthUser, permissions: Permission[]): boolean {
  return permissions.some(permission => user.permissions.includes(permission));
}

/**
 * Generate login token for admin users
 */
export function generateAdminToken(userId: string, role: UserRole = USER_ROLES.ADMIN): string {
  return generateJwtToken({
    userId,
    role,
    permissions: getRolePermissions(role)
  });
}

/**
 * Middleware wrapper for authentication
 */
export function withAuth(requiredPermissions?: Permission[]) {
  return async (req: NextRequest): Promise<{
    success: boolean;
    user?: AuthUser;
    error?: string;
    status?: number;
  }> => {
    const authResult = await authenticateRequest(req);
    
    if (!authResult.success) {
      return {
        success: false,
        error: authResult.error,
        status: authResult.rateLimited ? 429 : 401
      };
    }

    // Check permissions if specified
    if (requiredPermissions && requiredPermissions.length > 0) {
      const hasRequiredPermissions = hasAnyPermission(authResult.user!, requiredPermissions);
      
      if (!hasRequiredPermissions) {
        return {
          success: false,
          error: 'Insufficient permissions',
          status: 403
        };
      }
    }

    return {
      success: true,
      user: authResult.user
    };
  };
}

/**
 * Create a secure session token
 */
export function createSessionToken(user: AuthUser): {
  token: string;
  expiresAt: Date;
} {
  const token = generateJwtToken({
    userId: user.id,
    role: user.role,
    permissions: user.permissions
  });

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour expiry

  return { token, expiresAt };
}

export default {
  USER_ROLES,
  PERMISSIONS,
  getRolePermissions,
  authenticateRequest,
  hasPermission,
  hasAnyPermission,
  generateAdminToken,
  withAuth,
  createSessionToken
};