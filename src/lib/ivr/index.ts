/**
 * IVR Library - Index file
 *
 * WHY: Single entry point for all IVR-related functionality.
 * WHEN: Imported by webhook handlers and admin components.
 * HOW: Re-exports executor and helper functions.
 */

export { IvrExecutor, parseIvrFlow, validateIvrFlow } from './executor';
export type { ExecutorContext, ExecutionResult } from './executor';
