/**
 * Questions Module
 *
 * WHY: Central export point for question flow types and utilities
 * WHEN: Any component needs question flow functionality
 */

// Re-export everything from the main questions file
export * from '../questions';

// Export flow builder utilities
export { buildQuestionFlow, buildFallbackFlow, validateQuestionFlow } from './flow-builder';
