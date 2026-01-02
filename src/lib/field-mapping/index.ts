/**
 * Field Mapping Module
 *
 * WHY: Centralized exports for the field mapping system
 * WHEN: Importing field mapping functionality throughout the app
 * HOW: Re-export all public APIs from sub-modules
 */

// Types
export type {
  FieldMapping,
  FieldMappingConfig,
  SourceFieldDefinition,
  SourceFieldType,
  SourceFieldCategory,
  TransformDefinition,
  TransformCategory,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ValidationErrorCode,
  PayloadPreviewResult,
  TransformError,
  FieldMappingApiResponse,
  SaveFieldMappingRequest,
} from "@/types/field-mapping";

export {
  createEmptyFieldMappingConfig,
  createFieldMapping,
} from "@/types/field-mapping";

// Source Fields
export {
  STANDARD_SOURCE_FIELDS,
  CATEGORY_LABELS,
  mapFieldType,
  getExampleValue,
  getSourceFieldsForService,
  getSourceFieldsByCategory,
  findSourceField,
} from "./source-fields";

// Transforms
export {
  AVAILABLE_TRANSFORMS,
  TRANSFORM_CATEGORY_LABELS,
  getTransformsForType,
  getTransformsByCategory,
  getTransformById,
  executeTransform,
} from "./transforms";

// Configuration Service
export {
  loadFieldMappingConfig,
  saveFieldMappingConfig,
  validateFieldMappingConfig,
  generatePayloadPreview,
  applyFieldMappings,
  getSampleLeadData,
  listConfiguredBuyerServices,
  invalidateConfigCache,
  clearAllConfigCache,
} from "./configuration-service";

// Database Buyer Loader
export type {
  DatabaseBuyerConfig,
  DatabaseServiceConfig,
  DatabaseAuthConfig,
  DatabaseGlobalSettings,
  DatabaseWebhookConfig,
} from "./database-buyer-loader";

export {
  loadBuyerConfig,
  loadServiceConfig,
  loadActiveBuyersForService,
  generatePingPayload,
  generatePostPayload,
  invalidateBuyerCache,
  invalidateServiceConfigCache,
  clearAllCaches,
  meetsComplianceRequirements,
  getAllConfigurations,
} from "./database-buyer-loader";

// Auction Adapter
export type { AuctionPayloadResult } from "./auction-adapter";

export {
  enableDatabaseMappings,
  disableDatabaseMappings,
  isDatabaseMappingsEnabled,
  preparePingPayload,
  preparePostPayload,
  getBuyerAuthHeaders,
  getWebhookConfig,
  canBuyerParticipate,
  getEligibleBuyersFromDatabase,
} from "./auction-adapter";
