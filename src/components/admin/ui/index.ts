/**
 * Admin UI Components
 *
 * Modular, reusable UI components for the admin panel
 * with consistent orange branding and modern styling.
 */

// Page-level components
export { AdminPageHeader } from './AdminPageHeader';
export { AdminDetailPageHeader } from './AdminDetailPageHeader';

// Navigation & Layout
export { AdminTabNav } from './AdminTabNav';
export { AdminSection } from './AdminSection';

// Cards & Grids
export { AdminCard } from './AdminCard';
export { AdminStatGrid } from './AdminStatGrid';
export type { StatItem } from './AdminStatGrid';
export { AdminInfoGrid } from './AdminInfoGrid';
export type { InfoItem } from './AdminInfoGrid';

// Badges & Status
export { AdminBadge, StatusBadge, DispositionBadge } from './AdminBadge';

// Search & Filters
export { AdminSearch, AdminSelect, AdminFilterBar } from './AdminSearch';

// Data Table
export { AdminDataTable } from './AdminDataTable';
export type { TableColumn, FilterOption, RowAction } from './AdminDataTable';
