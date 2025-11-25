// Re-export all types for easy importing
// This file serves as the main entry point for all type definitions

// Database types
export * from './database';
export * from './api';
export * from './forms';
export * from './errors';
export * from './guards';

// Legacy compatibility - these types are now in database.ts
// Keeping for backward compatibility until all imports are updated
export type { 
  ServiceType,
  Lead,
  Buyer,
  Transaction,
  ComplianceData,
  FormData,
  BuyerType,
  LeadStatus,
  TransactionStatus,
  TransactionActionType
} from './database';

export type {
  ApiResponse,
  ApiSuccessResponse,
  ApiErrorResponse,
  PaginatedResponse,
  CreateLeadRequest,
  CreateBuyerRequest,
  BidResponse,
  AuctionResult
} from './api';

export type {
  FormEngineProps,
  FormSubmissionData,
  FormComplianceData,
  WindowsFormData,
  BathroomFormData,
  RoofingFormData,
  FormValidationResult,
  FormState
} from './forms';

export type {
  AppError,
  ValidationError,
  ResourceError,
  BusinessLogicError,
  ComplianceError,
  ErrorResponse
} from './errors';




















