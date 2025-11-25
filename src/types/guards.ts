// Type guards and validation utility functions

import { 
  BuyerType, 
  LeadStatus, 
  TransactionStatus, 
  TransactionActionType,
  ComplianceEventType,
  FormData,
  ComplianceData
} from './database';
import { 
  ApiResponse, 
  ApiSuccessResponse, 
  ApiErrorResponse,
  ProcessingStage,
  ComplianceStatus,
  TcpaConsentStatus,
  QueueJobType,
  QueueJobPriority
} from './api';
import { AppError, ErrorCode } from './errors';

// Basic type guards for enums
export const isBuyerType = (value: any): value is BuyerType => {
  return Object.values(BuyerType).includes(value);
};

export const isLeadStatus = (value: any): value is LeadStatus => {
  return Object.values(LeadStatus).includes(value);
};

export const isTransactionStatus = (value: any): value is TransactionStatus => {
  return Object.values(TransactionStatus).includes(value);
};

export const isTransactionActionType = (value: any): value is TransactionActionType => {
  return Object.values(TransactionActionType).includes(value);
};

export const isComplianceEventType = (value: any): value is ComplianceEventType => {
  return Object.values(ComplianceEventType).includes(value);
};

export const isProcessingStage = (value: any): value is ProcessingStage => {
  return Object.values(ProcessingStage).includes(value);
};

export const isComplianceStatus = (value: any): value is ComplianceStatus => {
  return Object.values(ComplianceStatus).includes(value);
};

export const isTcpaConsentStatus = (value: any): value is TcpaConsentStatus => {
  return Object.values(TcpaConsentStatus).includes(value);
};

export const isQueueJobType = (value: any): value is QueueJobType => {
  return Object.values(QueueJobType).includes(value);
};

export const isQueueJobPriority = (value: any): value is QueueJobPriority => {
  return Object.values(QueueJobPriority).includes(value);
};

export const isErrorCode = (value: any): value is ErrorCode => {
  return Object.values(ErrorCode).includes(value);
};

// API Response type guards
export const isApiSuccessResponse = <T>(response: any): response is ApiSuccessResponse<T> => {
  return (
    typeof response === 'object' &&
    response !== null &&
    response.success === true &&
    'data' in response &&
    'metadata' in response &&
    typeof response.metadata === 'object' &&
    typeof response.metadata.timestamp === 'string' &&
    typeof response.metadata.requestId === 'string' &&
    typeof response.metadata.version === 'string'
  );
};

export const isApiErrorResponse = (response: any): response is ApiErrorResponse => {
  return (
    typeof response === 'object' &&
    response !== null &&
    response.success === false &&
    'error' in response &&
    'metadata' in response &&
    typeof response.metadata === 'object' &&
    typeof response.metadata.timestamp === 'string' &&
    typeof response.metadata.requestId === 'string' &&
    typeof response.metadata.version === 'string'
  );
};

export const isApiResponse = <T>(response: any): response is ApiResponse<T> => {
  return isApiSuccessResponse<T>(response) || isApiErrorResponse(response);
};

// Complex object type guards
export const isFormData = (value: any): value is FormData => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  // Check optional personalInfo structure
  if (value.personalInfo && typeof value.personalInfo === 'object') {
    const personalInfo = value.personalInfo;
    if (personalInfo.email && typeof personalInfo.email !== 'string') return false;
    if (personalInfo.phone && typeof personalInfo.phone !== 'string') return false;
    if (personalInfo.firstName && typeof personalInfo.firstName !== 'string') return false;
    if (personalInfo.lastName && typeof personalInfo.lastName !== 'string') return false;
  }

  // Check optional addressInfo structure
  if (value.addressInfo && typeof value.addressInfo === 'object') {
    const addressInfo = value.addressInfo;
    if (addressInfo.street && typeof addressInfo.street !== 'string') return false;
    if (addressInfo.city && typeof addressInfo.city !== 'string') return false;
    if (addressInfo.state && typeof addressInfo.state !== 'string') return false;
    if (addressInfo.zipCode && typeof addressInfo.zipCode !== 'string') return false;
  }

  return true;
};

export const isComplianceData = (value: any): value is ComplianceData => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  // Check optional trustedForm structure
  if (value.trustedForm) {
    if (typeof value.trustedForm !== 'object') return false;
    const tf = value.trustedForm;
    if (tf.certUrl && typeof tf.certUrl !== 'string') return false;
    if (tf.certId && typeof tf.certId !== 'string') return false;
    if (tf.timestamp && typeof tf.timestamp !== 'string') return false;
    if (tf.ipAddress && typeof tf.ipAddress !== 'string') return false;
    if (tf.userAgent && typeof tf.userAgent !== 'string') return false;
  }

  // Check optional jornaya structure
  if (value.jornaya) {
    if (typeof value.jornaya !== 'object') return false;
    const jornaya = value.jornaya;
    if (typeof jornaya.leadId !== 'string') return false;
    if (typeof jornaya.pixelFired !== 'boolean') return false;
    if (jornaya.timestamp && typeof jornaya.timestamp !== 'string') return false;
  }

  // Check optional tcpa structure
  if (value.tcpa) {
    if (typeof value.tcpa !== 'object') return false;
    const tcpa = value.tcpa;
    if (typeof tcpa.consented !== 'boolean') return false;
    if (typeof tcpa.consentText !== 'string') return false;
    if (typeof tcpa.timestamp !== 'string') return false;
    if (typeof tcpa.ipAddress !== 'string') return false;
    if (!['checkbox', 'signature', 'verbal'].includes(tcpa.method)) return false;
  }

  return true;
};

export const isAppError = (value: any): value is AppError => {
  return (
    typeof value === 'object' &&
    value !== null &&
    isErrorCode(value.code) &&
    typeof value.message === 'string' &&
    typeof value.timestamp === 'string'
  );
};

// Validation utility functions
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePhone = (phone: string): boolean => {
  const phoneRegex = /^\+?[\d\s\-\(\)]{10,15}$/;
  return phoneRegex.test(phone);
};

export const validateZipCode = (zipCode: string): boolean => {
  const zipRegex = /^\d{5}(-\d{4})?$/;
  return zipRegex.test(zipCode);
};

export const validateUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export const validateUuid = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

// Sanitization utilities
export const sanitizeString = (value: any): string => {
  if (typeof value !== 'string') {
    return String(value || '');
  }
  return value.trim().replace(/<[^>]*>/g, ''); // Remove HTML tags and trim
};

export const sanitizeEmail = (email: string): string => {
  return sanitizeString(email).toLowerCase();
};

export const sanitizePhone = (phone: string): string => {
  return sanitizeString(phone).replace(/[^\d\+\-\(\)\s]/g, '');
};

export const sanitizeZipCode = (zipCode: string): string => {
  return sanitizeString(zipCode).replace(/[^\d\-]/g, '');
};

// Conversion utilities
export const parseJsonSafely = <T>(jsonString: string, fallback: T): T => {
  try {
    const parsed = JSON.parse(jsonString);
    return parsed !== null && parsed !== undefined ? parsed : fallback;
  } catch {
    return fallback;
  }
};

export const stringifyJsonSafely = (obj: any): string => {
  try {
    return JSON.stringify(obj);
  } catch {
    return '{}';
  }
};

// Database field parsers (for Prisma JSON fields stored as strings)
export const parseFormData = (formDataString: string): FormData => {
  const parsed = parseJsonSafely(formDataString, {});
  return isFormData(parsed) ? parsed : {};
};

export const parseComplianceData = (complianceDataString: string): ComplianceData => {
  const parsed = parseJsonSafely(complianceDataString, {});
  return isComplianceData(parsed) ? parsed : {};
};

export const parseTemplateConfig = (templateString: string) => {
  return parseJsonSafely(templateString, {
    url: '',
    method: 'POST',
    headers: {},
    body: {},
    timeout: 30000
  });
};

export const parseFieldMappings = (mappingsString: string) => {
  return parseJsonSafely(mappingsString, []);
};

export const parseAuthConfig = (authConfigString: string) => {
  return parseJsonSafely(authConfigString, {
    type: 'apikey',
    apiKey: '',
    customHeaders: {}
  });
};

// Runtime type checking utilities
export const assertBuyerType = (value: any): BuyerType => {
  if (!isBuyerType(value)) {
    throw new Error(`Invalid BuyerType: ${value}. Expected one of: ${Object.values(BuyerType).join(', ')}`);
  }
  return value;
};

export const assertLeadStatus = (value: any): LeadStatus => {
  if (!isLeadStatus(value)) {
    throw new Error(`Invalid LeadStatus: ${value}. Expected one of: ${Object.values(LeadStatus).join(', ')}`);
  }
  return value;
};

export const assertTransactionStatus = (value: any): TransactionStatus => {
  if (!isTransactionStatus(value)) {
    throw new Error(`Invalid TransactionStatus: ${value}. Expected one of: ${Object.values(TransactionStatus).join(', ')}`);
  }
  return value;
};

export const assertUuid = (value: any): string => {
  if (typeof value !== 'string' || !validateUuid(value)) {
    throw new Error(`Invalid UUID: ${value}`);
  }
  return value;
};

// Collection validation utilities
export const validateFormDataFields = (formData: FormData): string[] => {
  const errors: string[] = [];

  if (formData.personalInfo) {
    const { email, phone } = formData.personalInfo;
    if (email && !validateEmail(email)) {
      errors.push('Invalid email format');
    }
    if (phone && !validatePhone(phone)) {
      errors.push('Invalid phone format');
    }
  }

  if (formData.addressInfo?.zipCode && !validateZipCode(formData.addressInfo.zipCode)) {
    errors.push('Invalid ZIP code format');
  }

  return errors;
};

export const validateRequiredFields = (data: Record<string, any>, requiredFields: string[]): string[] => {
  const errors: string[] = [];
  
  for (const field of requiredFields) {
    if (!data[field] || (typeof data[field] === 'string' && data[field].trim() === '')) {
      errors.push(`${field} is required`);
    }
  }
  
  return errors;
};

// Utility for creating type-safe filters
export const createFilter = <T extends Record<string, any>>(
  filterFn: (item: T) => boolean
) => {
  return (items: T[]): T[] => items.filter(filterFn);
};

// Utility for type-safe property access
export const safeGet = <T, K extends keyof T>(obj: T, key: K, fallback: T[K]): T[K] => {
  return obj && obj[key] !== undefined ? obj[key] : fallback;
};