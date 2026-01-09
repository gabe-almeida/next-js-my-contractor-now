'use client';

/**
 * PermissionGate - Declarative Permission Checks
 *
 * WHY: Hide UI elements based on user permissions without conditional rendering everywhere
 * WHEN: Buttons, sections, or features should only show for certain roles
 * HOW: Wraps children and only renders if user has required permission(s)
 *
 * Usage:
 *   <PermissionGate permission="users:write">
 *     <DeleteButton />
 *   </PermissionGate>
 *
 *   <PermissionGate permissions={['leads:write', 'admin:write']} requireAll={false}>
 *     <EditPanel />
 *   </PermissionGate>
 */

import { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface PermissionGateProps {
  /** Single permission to check */
  permission?: string;
  /** Multiple permissions to check */
  permissions?: string[];
  /** If true, user must have ALL permissions. If false, ANY permission suffices. Default: false */
  requireAll?: boolean;
  /** Content to show if permission check fails */
  fallback?: ReactNode;
  /** Content to show if permission check passes */
  children: ReactNode;
}

export function PermissionGate({
  permission,
  permissions,
  requireAll = false,
  fallback = null,
  children,
}: PermissionGateProps) {
  const { user, isLoading, hasPermission, hasAnyPermission, hasAllPermissions } = useAuth();

  // Still loading - don't show anything
  if (isLoading) {
    return null;
  }

  // Not authenticated - show fallback
  if (!user) {
    return <>{fallback}</>;
  }

  // Single permission check
  if (permission) {
    if (!hasPermission(permission)) {
      return <>{fallback}</>;
    }
    return <>{children}</>;
  }

  // Multiple permissions check
  if (permissions && permissions.length > 0) {
    const hasAccess = requireAll
      ? hasAllPermissions(permissions)
      : hasAnyPermission(permissions);

    if (!hasAccess) {
      return <>{fallback}</>;
    }
    return <>{children}</>;
  }

  // No permissions specified - render children
  return <>{children}</>;
}

/**
 * RoleGate - Check by role instead of permission
 */
interface RoleGateProps {
  /** Allowed roles */
  roles: string[];
  /** Content to show if role check fails */
  fallback?: ReactNode;
  /** Content to show if role check passes */
  children: ReactNode;
}

export function RoleGate({ roles, fallback = null, children }: RoleGateProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!user || !roles.includes(user.role)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

/**
 * SuperAdminOnly - Shorthand for SUPER_ADMIN role check
 */
export function SuperAdminOnly({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <RoleGate roles={['SUPER_ADMIN']} fallback={fallback}>
      {children}
    </RoleGate>
  );
}

export default PermissionGate;
