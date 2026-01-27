/**
 * On-Demand Revalidation Utility
 *
 * WHY: Instantly update static pages when service data changes in admin
 * WHEN: Called after any service type modification (create, update, delete, toggle)
 * HOW: Uses Next.js revalidatePath to trigger page regeneration
 *
 * IMPORTANT: This replaces the need for Redis caching on these pages.
 * Pages are statically generated and only rebuilt when data actually changes.
 */

import { revalidatePath } from 'next/cache';

/**
 * Revalidate all pages affected by service type changes
 *
 * @param serviceName - The service slug (e.g., "windows", "roofing")
 *
 * WHY: When a service is modified, both the home page (service list) and
 *      the specific service page need to be regenerated
 * WHEN: After any CRUD operation on service types
 * HOW: Calls revalidatePath for each affected route
 */
export function revalidateServicePages(serviceName?: string) {
  // Always revalidate home page (has service dropdown)
  revalidatePath('/');

  // Revalidate specific service page if name provided
  if (serviceName) {
    revalidatePath(`/services/${serviceName.toLowerCase()}`);
  }
}

/**
 * Revalidate all service pages (used when toggling service on/off)
 *
 * WHY: When a service is activated/deactivated, it affects the home page dropdown
 *      and potentially all service pages (for cross-linking, etc.)
 * WHEN: After toggling service active status
 * HOW: Revalidates the services layout which affects all child pages
 */
export function revalidateAllServicePages() {
  revalidatePath('/');
  revalidatePath('/services', 'layout');
}

/**
 * Revalidate after service creation
 * New services need to appear in home page dropdown
 */
export function revalidateOnServiceCreate(serviceName: string) {
  revalidatePath('/');
  // New page will be generated on first visit (ISR)
  revalidatePath(`/services/${serviceName.toLowerCase()}`);
}

/**
 * Revalidate after service deletion/deactivation
 * Service should disappear from home page dropdown
 */
export function revalidateOnServiceDelete(serviceName: string) {
  revalidatePath('/');
  revalidatePath(`/services/${serviceName.toLowerCase()}`);
}
