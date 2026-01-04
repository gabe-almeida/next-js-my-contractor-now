// Comprehensive error type definitions for the application

export enum ErrorCode {
  // Validation Errors (4000-4099)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  REQUIRED_FIELD_MISSING = 'REQUIRED_FIELD_MISSING',
  INVALID_FORMAT = 'INVALID_FORMAT',
  INVALID_ENUM_VALUE = 'INVALID_ENUM_VALUE',
  VALUE_OUT_OF_RANGE = 'VALUE_OUT_OF_RANGE',
  
  // Authentication & Authorization Errors (4100-4199)
  AUTHENTICATION_REQUIRED = 'AUTHENTICATION_REQUIRED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  
  // Resource Errors (4200-4299)
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  RESOURCE_ALREADY_EXISTS = 'RESOURCE_ALREADY_EXISTS',
  RESOURCE_CONFLICT = 'RESOURCE_CONFLICT',
  RESOURCE_LOCKED = 'RESOURCE_LOCKED',
  
  // Business Logic Errors (4300-4399)
  LEAD_ALREADY_PROCESSED = 'LEAD_ALREADY_PROCESSED',
  BUYER_NOT_ACTIVE = 'BUYER_NOT_ACTIVE',
  SERVICE_NOT_CONFIGURED = 'SERVICE_NOT_CONFIGURED',
  ZIP_CODE_NOT_SUPPORTED = 'ZIP_CODE_NOT_SUPPORTED',
  AUCTION_ALREADY_COMPLETE = 'AUCTION_ALREADY_COMPLETE',
  NO_ELIGIBLE_BUYERS = 'NO_ELIGIBLE_BUYERS',
  
  // Compliance Errors (4400-4499)
  TRUSTEDFORM_INVALID = 'TRUSTEDFORM_INVALID',
  JORNAYA_MISSING = 'JORNAYA_MISSING',
  TCPA_CONSENT_REQUIRED = 'TCPA_CONSENT_REQUIRED',
  COMPLIANCE_VERIFICATION_FAILED = 'COMPLIANCE_VERIFICATION_FAILED',
  
  // External Service Errors (4500-4599)
  EXTERNAL_API_ERROR = 'EXTERNAL_API_ERROR',
  EXTERNAL_SERVICE_UNAVAILABLE = 'EXTERNAL_SERVICE_UNAVAILABLE',
  RADAR_API_ERROR = 'RADAR_API_ERROR',
  BUYER_API_TIMEOUT = 'BUYER_API_TIMEOUT',
  BUYER_API_ERROR = 'BUYER_API_ERROR',
  
  // System Errors (5000-5099)
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  REDIS_CONNECTION_ERROR = 'REDIS_CONNECTION_ERROR',
  QUEUE_ERROR = 'QUEUE_ERROR',
  CONFIG_ERROR = 'CONFIG_ERROR',
  
  // Rate Limiting & Throttling (4290-4299)
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED'
}

export interface BaseError {
  code: ErrorCode;
  message: string;
  timestamp: string;
  requestId?: string;
  traceId?: string;
}

export interface ValidationError extends BaseError {
  code: ErrorCode.VALIDATION_ERROR | ErrorCode.REQUIRED_FIELD_MISSING | ErrorCode.INVALID_FORMAT | ErrorCode.INVALID_ENUM_VALUE | ErrorCode.VALUE_OUT_OF_RANGE;
  field?: string;
  expectedFormat?: string;
  providedValue?: any;
  validValues?: string[] | number[];
  constraints?: {
    min?: number;
    max?: number;
    pattern?: string;
    required?: boolean;
  };
}

export interface AuthenticationError extends BaseError {
  code: ErrorCode.AUTHENTICATION_REQUIRED | ErrorCode.INVALID_CREDENTIALS | ErrorCode.TOKEN_EXPIRED | ErrorCode.INSUFFICIENT_PERMISSIONS;
  requiredRole?: string;
  currentRole?: string;
  tokenExpiry?: string;
}

export interface ResourceError extends BaseError {
  code: ErrorCode.RESOURCE_NOT_FOUND | ErrorCode.RESOURCE_ALREADY_EXISTS | ErrorCode.RESOURCE_CONFLICT | ErrorCode.RESOURCE_LOCKED;
  resourceType: string;
  resourceId?: string;
  conflictsWith?: string;
  lockDetails?: {
    lockedBy: string;
    lockedAt: string;
    lockExpiry?: string;
  };
}

export interface BusinessLogicError extends BaseError {
  code: ErrorCode.LEAD_ALREADY_PROCESSED | ErrorCode.BUYER_NOT_ACTIVE | ErrorCode.SERVICE_NOT_CONFIGURED | 
        ErrorCode.ZIP_CODE_NOT_SUPPORTED | ErrorCode.AUCTION_ALREADY_COMPLETE | ErrorCode.NO_ELIGIBLE_BUYERS;
  context?: {
    leadId?: string;
    buyerId?: string;
    serviceTypeId?: string;
    zipCode?: string;
    auctionId?: string;
  };
  suggestions?: string[];
}

export interface ComplianceError extends BaseError {
  code: ErrorCode.TRUSTEDFORM_INVALID | ErrorCode.JORNAYA_MISSING | ErrorCode.TCPA_CONSENT_REQUIRED | 
        ErrorCode.COMPLIANCE_VERIFICATION_FAILED;
  complianceDetails?: {
    trustedFormStatus?: 'missing' | 'invalid' | 'expired';
    jornayaStatus?: 'missing' | 'invalid';
    tcpaStatus?: 'not_consented' | 'consent_expired' | 'invalid_method';
    verificationAttempts?: number;
    lastVerificationAt?: string;
  };
  requiredCompliance: string[];
}

export interface ExternalServiceError extends BaseError {
  code: ErrorCode.EXTERNAL_API_ERROR | ErrorCode.EXTERNAL_SERVICE_UNAVAILABLE | ErrorCode.RADAR_API_ERROR | 
        ErrorCode.BUYER_API_TIMEOUT | ErrorCode.BUYER_API_ERROR;
  service: string;
  endpoint?: string;
  httpStatus?: number;
  responseTime?: number;
  retryAfter?: number;
  lastSuccessfulCall?: string;
}

export interface SystemError extends BaseError {
  code: ErrorCode.INTERNAL_SERVER_ERROR | ErrorCode.DATABASE_ERROR | ErrorCode.REDIS_CONNECTION_ERROR | 
        ErrorCode.QUEUE_ERROR | ErrorCode.CONFIG_ERROR;
  systemComponent?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedOperations?: string[];
  recoveryActions?: string[];
}

export interface RateLimitError extends BaseError {
  code: ErrorCode.RATE_LIMIT_EXCEEDED | ErrorCode.TOO_MANY_REQUESTS | ErrorCode.QUOTA_EXCEEDED;
  limit: number;
  current: number;
  resetTime: string;
  retryAfter: number;
  quotaPeriod?: string;
}

// Union type for all possible errors
export type AppError = 
  | ValidationError 
  | AuthenticationError 
  | ResourceError 
  | BusinessLogicError 
  | ComplianceError 
  | ExternalServiceError 
  | SystemError 
  | RateLimitError;

// Error response structure
export interface ErrorResponse {
  success: false;
  error: AppError;
  metadata?: {
    timestamp: string;
    requestId: string;
    version: string;
    environment?: string;
  };
}

// Multiple errors response
export interface MultiErrorResponse {
  success: false;
  errors: AppError[];
  metadata?: {
    timestamp: string;
    requestId: string;
    version: string;
    environment?: string;
  };
}

// Error factory functions
type ValidationErrorCode = ErrorCode.VALIDATION_ERROR | ErrorCode.REQUIRED_FIELD_MISSING | ErrorCode.INVALID_FORMAT | ErrorCode.INVALID_ENUM_VALUE | ErrorCode.VALUE_OUT_OF_RANGE;

export const createValidationError = (
  message: string,
  field?: string,
  code: ValidationErrorCode = ErrorCode.VALIDATION_ERROR,
  options?: Partial<ValidationError>
): ValidationError => ({
  code,
  message,
  timestamp: new Date().toISOString(),
  field,
  ...options
});

type ResourceErrorCode = ErrorCode.RESOURCE_NOT_FOUND | ErrorCode.RESOURCE_ALREADY_EXISTS | ErrorCode.RESOURCE_CONFLICT | ErrorCode.RESOURCE_LOCKED;
type BusinessLogicErrorCode = ErrorCode.LEAD_ALREADY_PROCESSED | ErrorCode.BUYER_NOT_ACTIVE | ErrorCode.SERVICE_NOT_CONFIGURED | ErrorCode.ZIP_CODE_NOT_SUPPORTED | ErrorCode.AUCTION_ALREADY_COMPLETE | ErrorCode.NO_ELIGIBLE_BUYERS;
type ComplianceErrorCode = ErrorCode.TRUSTEDFORM_INVALID | ErrorCode.JORNAYA_MISSING | ErrorCode.TCPA_CONSENT_REQUIRED | ErrorCode.COMPLIANCE_VERIFICATION_FAILED;
type ExternalServiceErrorCode = ErrorCode.EXTERNAL_API_ERROR | ErrorCode.EXTERNAL_SERVICE_UNAVAILABLE | ErrorCode.RADAR_API_ERROR | ErrorCode.BUYER_API_TIMEOUT | ErrorCode.BUYER_API_ERROR;
type SystemErrorCode = ErrorCode.INTERNAL_SERVER_ERROR | ErrorCode.DATABASE_ERROR | ErrorCode.REDIS_CONNECTION_ERROR | ErrorCode.QUEUE_ERROR | ErrorCode.CONFIG_ERROR;
type RateLimitErrorCode = ErrorCode.RATE_LIMIT_EXCEEDED | ErrorCode.TOO_MANY_REQUESTS | ErrorCode.QUOTA_EXCEEDED;

export const createResourceError = (
  message: string,
  resourceType: string,
  code: ResourceErrorCode = ErrorCode.RESOURCE_NOT_FOUND,
  options?: Partial<ResourceError>
): ResourceError => ({
  code,
  message,
  timestamp: new Date().toISOString(),
  resourceType,
  ...options
});

export const createBusinessLogicError = (
  message: string,
  code: BusinessLogicErrorCode,
  options?: Partial<BusinessLogicError>
): BusinessLogicError => ({
  code,
  message,
  timestamp: new Date().toISOString(),
  ...options
});

export const createComplianceError = (
  message: string,
  requiredCompliance: string[],
  code: ComplianceErrorCode,
  options?: Partial<ComplianceError>
): ComplianceError => ({
  code,
  message,
  timestamp: new Date().toISOString(),
  requiredCompliance,
  ...options
});

export const createExternalServiceError = (
  message: string,
  service: string,
  code: ExternalServiceErrorCode = ErrorCode.EXTERNAL_API_ERROR,
  options?: Partial<ExternalServiceError>
): ExternalServiceError => ({
  code,
  message,
  timestamp: new Date().toISOString(),
  service,
  ...options
});

export const createSystemError = (
  message: string,
  severity: SystemError['severity'] = 'medium',
  code: SystemErrorCode = ErrorCode.INTERNAL_SERVER_ERROR,
  options?: Partial<SystemError>
): SystemError => ({
  code,
  message,
  timestamp: new Date().toISOString(),
  severity,
  ...options
});

export const createRateLimitError = (
  message: string,
  limit: number,
  current: number,
  resetTime: string,
  retryAfter: number,
  code: RateLimitErrorCode = ErrorCode.RATE_LIMIT_EXCEEDED
): RateLimitError => ({
  code,
  message,
  timestamp: new Date().toISOString(),
  limit,
  current,
  resetTime,
  retryAfter
});