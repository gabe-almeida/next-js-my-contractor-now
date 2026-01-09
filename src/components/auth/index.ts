/**
 * Auth Components
 *
 * WHY: Centralized exports for auth-related components
 * WHEN: Import auth components in other files
 * HOW: Re-exports from individual component files
 */

export { PermissionGate, RoleGate, SuperAdminOnly } from './PermissionGate';
