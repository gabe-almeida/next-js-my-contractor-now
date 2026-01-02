import { Lead, ServiceType, Buyer, Transaction, LeadStatus, ComplianceData, FormData, BuyerType, TransactionStatus, TransactionActionType } from './database';
import { AppError, ErrorResponse } from './errors';

// Generic API Response Types with proper error handling
export interface ApiSuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string;
  metadata: {
    timestamp: string;
    requestId: string;
    version: string;
    processingTime?: number;
    cached?: boolean;
  };
}

export interface ApiErrorResponse {
  success: false;
  error: AppError;
  metadata: {
    timestamp: string;
    requestId: string;
    version: string;
    processingTime?: number;
  };
}

export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  nextPage?: number;
  prevPage?: number;
}

export interface PaginatedData<T> {
  items: T[];
  pagination: PaginationMeta;
}

export type PaginatedResponse<T> = ApiResponse<PaginatedData<T>>;

// Lead Management APIs
export interface CreateLeadRequest {
  serviceTypeId: string;
  formData: FormData;
  zipCode: string;
  ownsHome: boolean;
  timeframe: string;
  complianceData?: ComplianceData;
}

export interface CreateLeadResponse {
  leadId: string;
  status: LeadStatus;
  message: string;
  estimatedProcessingTime?: number;
  queuePosition?: number;
  expectedAuctionTime?: string;
}

export interface GetLeadsQuery {
  page?: number;
  limit?: number;
  status?: LeadStatus;
  serviceTypeId?: string;
  fromDate?: string;
  toDate?: string;
  zipCode?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'winningBid';
  sortOrder?: 'asc' | 'desc';
  complianceScore?: 'high' | 'medium' | 'low';
}

export interface LeadWithDetails extends Lead {
  serviceType: ServiceType;
  winningBuyer?: Buyer;
  transactions: Transaction[];
  complianceScore?: number;
}

// Service Types APIs
export interface CreateServiceTypeRequest {
  name: string;
  displayName: string;
  formSchema: {
    title: string;
    description?: string;
    fields: {
      id: string;
      name: string;
      type: 'text' | 'email' | 'phone' | 'number' | 'select' | 'radio' | 'checkbox' | 'textarea' | 'date' | 'multiselect';
      label: string;
      placeholder?: string;
      required: boolean;
      options?: {
        value: string;
        label: string;
        disabled?: boolean;
      }[];
      validation?: {
        required?: boolean;
        pattern?: string;
        min?: number;
        max?: number;
        minLength?: number;
        maxLength?: number;
        customValidator?: string;
      };
      conditional?: {
        field: string;
        operator: 'equals' | 'notEquals' | 'includes' | 'greaterThan' | 'lessThan';
        value: any;
      };
      gridColumn?: string;
      className?: string;
    }[];
    sections?: {
      id: string;
      title: string;
      fields: string[];
    }[];
    validationRules: {
      field: string;
      rule: string;
      message: string;
    }[];
    complianceSettings?: {
      trustedForm?: boolean;
      jornaya?: boolean;
      tcpaRequired?: boolean;
    };
  };
}

export interface UpdateServiceTypeRequest {
  displayName?: string;
  formSchema?: CreateServiceTypeRequest['formSchema'];
  active?: boolean;
}

// Buyer Management APIs
export interface CreateBuyerRequest {
  name: string;
  type: BuyerType;
  apiUrl: string;
  authConfig?: {
    type: 'apikey' | 'bearer' | 'basic' | 'custom';
    apiKey?: string;
    bearerToken?: string;
    username?: string;
    password?: string;
    customHeaders?: Record<string, string>;
  };
  pingTimeout?: number;
  postTimeout?: number;
}

export interface UpdateBuyerRequest {
  name?: string;
  type?: BuyerType;
  apiUrl?: string;
  authConfig?: {
    type: 'apikey' | 'bearer' | 'basic' | 'custom';
    apiKey?: string;
    bearerToken?: string;
    username?: string;
    password?: string;
    customHeaders?: Record<string, string>;
  };
  pingTimeout?: number;
  postTimeout?: number;
  active?: boolean;
}

export interface CreateBuyerServiceConfigRequest {
  buyerId: string;
  serviceTypeId: string;
  pingTemplate: {
    url: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    headers: Record<string, string>;
    body: Record<string, any>;
    timeout: number;
  };
  postTemplate: {
    url: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    headers: Record<string, string>;
    body: Record<string, any>;
    timeout: number;
  };
  fieldMappings: {
    source: string;
    target: string;
    transform?: 'uppercase' | 'lowercase' | 'trim' | 'format_phone' | 'format_date';
    defaultValue?: any;
  }[];
  requiresTrustedForm?: boolean;
  requiresJornaya?: boolean;
  complianceConfig?: {
    trustedForm: {
      enabled: boolean;
      includeInPing: boolean;
      includeInPost: boolean;
      certificateField: string;
    };
    jornaya: {
      enabled: boolean;
      includeInPing: boolean;
      includeInPost: boolean;
      leadIdField: string;
    };
    tcpa: {
      required: boolean;
      consentText: string;
      includeTimestamp: boolean;
    };
  };
  minBid?: number;
  maxBid?: number;
}

// Auction System Types
export interface BidResponse {
  buyerId: string;
  bidAmount: number;
  success: boolean;
  responseTime: number;
  status: TransactionStatus;
  error?: string;
  message?: string;
  complianceData?: {
    trustedFormIncluded: boolean;
    jornayaIncluded: boolean;
    tcpaConsentVerified: boolean;
  };
  metadata?: {
    buyerName: string;
    serviceType: string;
    timestamp: string;
  };
}

export interface AuctionResult {
  leadId: string;
  status: 'completed' | 'failed' | 'no_bids' | 'timeout';
  winner: BidResponse | null;
  bids: BidResponse[];
  totalBidders: number;
  auctionDuration: number;
  auctionStartTime: string;
  auctionEndTime: string;
  postResult?: PostResult;
  rejectedBids?: {
    buyerId: string;
    reason: string;
    bidAmount?: number;
  }[];
}

export interface PostResult {
  success: boolean;
  statusCode: number;
  responseTime: number;
  response?: Record<string, any>;
  error?: string;
  buyerLeadId?: string;
  complianceDelivered?: {
    trustedForm: boolean;
    jornaya: boolean;
    tcpaConsent: boolean;
  };
  deliveryAttempts: number;
  lastAttemptAt: string;
}

// External API Integration Types
export interface RadarValidationResponse {
  isValid: boolean;
  city?: string;
  state?: string;
  county?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  timezone?: string;
}

export interface TrustedFormCertificate {
  certUrl: string;
  certId: string;
  formUrl: string;
  timestamp: string;
  ipAddress: string;
  userAgent: string;
  pageTitle?: string;
  referrer?: string;
}

export interface JornayaLeadData {
  leadId: string;
  pixelFired: boolean;
  timestamp: string;
  ipAddress?: string;
  additionalData?: Record<string, any>;
}

// Webhook Types
export interface BuyerWebhookPayload {
  serviceType: string;
  leadData: Record<string, any>;
  complianceData?: {
    trustedFormCert?: TrustedFormCertificate;
    jornayaLeadId?: string;
    tcpaConsent?: {
      consented: boolean;
      timestamp: string;
      text: string;
    };
  };
  metadata?: {
    leadId: string;
    timestamp: string;
    source: string;
  };
}

export interface BuyerPingResponse {
  accepted: boolean;
  bidAmount?: number;
  rejectionReason?: string;
  message?: string;
  complianceRequirements?: {
    requiresTrustedForm: boolean;
    requiresJornaya: boolean;
  };
}

export interface BuyerPostResponse {
  success: boolean;
  buyerLeadId?: string;
  message?: string;
  error?: string;
  complianceVerified?: boolean;
}

// Analytics and Reporting Types
export interface DashboardMetrics {
  totalLeads: number;
  totalLeadsChange?: number;
  conversionRate: number;
  conversionRateChange?: number;
  averageBidAmount?: number;
  averageBidChange?: number;
  activeBuyers?: number;
  activeBuyersChange?: number;
  complianceScore?: number;
  timeframe?: string;
  // Additional dashboard fields
  leadsToday?: number;
  successfulPosts?: number;
  totalRevenue?: number;
  averageBid?: number;
  trustedFormCoverage?: number;
  jornayaCoverage?: number;
  fullComplianceRate?: number;
}

// Generic chart data type for flexible charting
export interface ChartData {
  label: string;
  value?: number;
  revenue?: number;
  leads?: number;
  category?: string;
  [key: string]: string | number | undefined;
}

export interface LeadVolumeData {
  date: string;
  count: number;
  conversionRate: number;
  averageBid: number;
  complianceScore: number;
}

export interface BuyerPerformance {
  buyerId: string;
  buyerName: string;
  totalBids: number;
  wonLeads: number;
  winRate: number;
  averageBid: number;
  totalSpent: number;
  averageResponseTime: number;
  complianceRate: number;
}

export interface ServiceTypePerformance {
  serviceTypeId: string;
  serviceTypeName: string;
  totalLeads: number;
  conversionRate: number;
  averageBidAmount: number;
  topBuyers: string[];
  complianceScore: number;
}

// Queue and Processing Types
export enum QueueJobType {
  LEAD_PROCESSING = 'LEAD_PROCESSING',
  AUCTION = 'AUCTION',
  POST_DELIVERY = 'POST_DELIVERY',
  COMPLIANCE_CHECK = 'COMPLIANCE_CHECK',
  RETRY_FAILED_POST = 'RETRY_FAILED_POST',
  CLEANUP_EXPIRED_LEADS = 'CLEANUP_EXPIRED_LEADS'
}

export enum QueueJobPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface QueueJob<T = any> {
  id: string;
  type: QueueJobType;
  data: T;
  priority: QueueJobPriority;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  scheduledFor?: string;
  lastAttemptAt?: string;
  failureReason?: string;
  processingTime?: number;
}

export enum ProcessingStage {
  QUEUED = 'QUEUED',
  VALIDATING = 'VALIDATING',
  PROCESSING = 'PROCESSING',
  AUCTIONING = 'AUCTIONING',
  POSTING = 'POSTING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  RETRYING = 'RETRYING'
}

export interface ProcessingStatus {
  leadId: string;
  status: ProcessingStage;
  currentStep?: string;
  progress: number;
  startedAt: string;
  estimatedCompletion?: string;
  completedAt?: string;
  errors?: AppError[];
  warnings?: string[];
  metadata?: {
    auctionId?: string;
    participatingBuyers?: string[];
    complianceChecked?: boolean;
  };
}

// Compliance-specific Types
export enum ComplianceStatus {
  VALID = 'valid',
  INVALID = 'invalid',
  MISSING = 'missing',
  EXPIRED = 'expired',
  PENDING = 'pending'
}

export enum TcpaConsentStatus {
  CONSENTED = 'consented',
  NOT_CONSENTED = 'not_consented',
  MISSING = 'missing',
  EXPIRED = 'expired',
  INVALID_METHOD = 'invalid_method'
}

export interface ComplianceValidationResult {
  isValid: boolean;
  score: number;
  issues: ComplianceIssue[];
  trustedFormStatus: ComplianceStatus;
  jornayaStatus: ComplianceStatus;
  tcpaStatus: TcpaConsentStatus;
  validatedAt: string;
  validationDuration: number;
  recommendations?: string[];
}

export enum ComplianceIssueType {
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export interface ComplianceIssue {
  type: ComplianceIssueType;
  field?: string;
  message: string;
  suggestion?: string;
  severity: 'low' | 'medium' | 'high';
  affectsDelivery: boolean;
  canBeIgnored: boolean;
  relatedCompliance?: ('trustedForm' | 'jornaya' | 'tcpa')[];
}

export interface ComplianceReport {
  leadId: string;
  complianceScore: number;
  trustedFormCertificate?: TrustedFormCertificate;
  jornayaLeadId?: string;
  tcpaConsent?: boolean;
  auditTrail: ComplianceAuditEntry[];
}

export interface ComplianceAuditEntry {
  id: string;
  timestamp: string;
  event: string;
  eventType: 'trustedform_generated' | 'jornaya_captured' | 'tcpa_consented' | 'form_submitted' | 'compliance_validated';
  data: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  success: boolean;
  errorMessage?: string;
}