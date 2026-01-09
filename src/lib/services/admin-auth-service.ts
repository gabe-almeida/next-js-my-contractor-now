/**
 * Admin Authentication Service
 *
 * WHY: Centralized auth logic for admin users with secure password handling
 * WHEN: Admin login, logout, token verification, user management
 * HOW: Uses bcrypt for passwords, JWT for tokens, Prisma for database
 */

import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Constants
const SALT_ROUNDS = 12;
const TOKEN_EXPIRY = '24h';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

// Types
export interface AdminTokenPayload {
  userId: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
  iat?: number;
  exp?: number;
}

export interface LoginResult {
  success: boolean;
  token?: string;
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
    permissions: string[];
  };
  error?: string;
}

// Permission mappings by role
const ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: [
    'admin:read', 'admin:write',
    'leads:read', 'leads:write', 'leads:delete',
    'services:read', 'services:write',
    'buyers:read', 'buyers:write',
    'users:read', 'users:write',
    'analytics:read',
    'settings:write',
  ],
  ADMIN: [
    'admin:read', 'admin:write',
    'leads:read', 'leads:write',
    'services:read', 'services:write',
    'buyers:read', 'buyers:write',
    'analytics:read',
  ],
  SUPPORT: [
    'admin:read',
    'leads:read',
    'services:read',
    'buyers:read',
    'analytics:read',
  ],
};

/**
 * Get permissions for a given role
 */
export function getPermissionsForRole(role: string): string[] {
  return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.SUPPORT;
}

/**
 * Hash a password securely
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compare password with hash
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate JWT token for admin user
 */
export function generateToken(payload: Omit<AdminTokenPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

/**
 * Verify and decode JWT token
 */
export function verifyToken(token: string): AdminTokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AdminTokenPayload;
  } catch {
    return null;
  }
}

/**
 * Admin login - validates credentials and returns token
 */
export async function adminLogin(email: string, password: string): Promise<LoginResult> {
  try {
    // Find user by email
    const user = await prisma.adminUser.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      return { success: false, error: 'Invalid email or password' };
    }

    // Check if user is active
    if (!user.active) {
      return { success: false, error: 'Account is deactivated' };
    }

    // Verify password
    const isValid = await comparePassword(password, user.passwordHash);
    if (!isValid) {
      return { success: false, error: 'Invalid email or password' };
    }

    // Get permissions for role
    const permissions = getPermissionsForRole(user.role);

    // Generate token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      permissions,
    });

    // Update last login time
    await prisma.adminUser.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        permissions,
      },
    };
  } catch (error) {
    console.error('Admin login error:', error);
    return { success: false, error: 'Login failed' };
  }
}

/**
 * Get admin user by ID
 */
export async function getAdminById(userId: string) {
  return prisma.adminUser.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      active: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });
}

/**
 * Create a new admin user
 */
export async function createAdminUser(data: {
  email: string;
  password: string;
  name: string;
  role?: string;
}) {
  const passwordHash = await hashPassword(data.password);

  return prisma.adminUser.create({
    data: {
      email: data.email.toLowerCase().trim(),
      passwordHash,
      name: data.name,
      role: data.role || 'ADMIN',
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      active: true,
      createdAt: true,
    },
  });
}

/**
 * Update admin user password
 */
export async function updateAdminPassword(userId: string, newPassword: string) {
  const passwordHash = await hashPassword(newPassword);

  return prisma.adminUser.update({
    where: { id: userId },
    data: { passwordHash },
  });
}

/**
 * Validate password strength
 */
export function validatePasswordStrength(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Check if user has a specific permission
 */
export function hasPermission(userPermissions: string[], permission: string): boolean {
  return userPermissions.includes(permission);
}

/**
 * Check if user has any of the specified permissions
 */
export function hasAnyPermission(userPermissions: string[], permissions: string[]): boolean {
  return permissions.some(p => userPermissions.includes(p));
}

/**
 * Check if user has all specified permissions
 */
export function hasAllPermissions(userPermissions: string[], permissions: string[]): boolean {
  return permissions.every(p => userPermissions.includes(p));
}
