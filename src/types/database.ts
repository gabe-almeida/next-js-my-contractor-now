// Database type definitions
// Aligned with Prisma schema and proper TypeScript typing

import { ComplianceFieldMappings } from '@/lib/templates/types';
import { ResponseMappingConfig } from './response-mapping';

// Enums aligned with Prisma schema
export enum BuyerType {
  CONTRACTOR = 'CONTRACTOR',
  NETWORK = 'NETWORK'
}

export enum LeadStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  AUCTIONED = 'AUCTIONED',
  SOLD = 'SOLD',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  DELIVERY_FAILED = 'DELIVERY_FAILED',
  SCRUBBED = 'SCRUBBED',
  DUPLICATE = 'DUPLICATE'
}

export enum LeadDisposition {
  NEW = 'NEW',
  DELIVERED = 'DELIVERED',
  RETURNED = 'RETURNED',
  DISPUTED = 'DISPUTED',
  CREDITED = 'CREDITED',
  WRITTEN_OFF = 'WRITTEN_OFF'
}

export enum AdminUserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  SUPPORT = 'SUPPORT'
}

export enum ChangeSource {
  SYSTEM = 'SYSTEM',
  ADMIN = 'ADMIN',
  WEBHOOK = 'WEBHOOK'
}

export enum TransactionActionType {
  PING = 'PING',
  POST = 'POST',
  PING_WEBHOOK = 'PING_WEBHOOK',
  POST_WEBHOOK = 'POST_WEBHOOK',
  STATUS_UPDATE = 'STATUS_UPDATE'
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  TIMEOUT = 'TIMEOUT',
  INFO = 'INFO'
}

export enum ComplianceEventType {
  TRUSTEDFORM_GENERATED = 'TRUSTEDFORM_GENERATED',
  JORNAYA_CAPTURED = 'JORNAYA_CAPTURED',
  FORM_SUBMITTED = 'FORM_SUBMITTED',
  TCPA_CONSENT = 'TCPA_CONSENT'
}

export interface Buyer {
  id: string;
  name: string;
  displayName?: string;
  type: BuyerType;
  apiUrl: string;
  authConfig?: AuthConfig | null; // Parsed JSON from string
  pingTimeout: number;
  postTimeout: number;
  active: boolean;
  complianceFieldMappings?: ComplianceFieldMappings | null; // Parsed JSON from string
  responseMappingConfig?: ResponseMappingConfig | null; // Parsed JSON from string
  // Contact information (for contractors)
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  businessEmail?: string | null;
  businessPhone?: string | null;
  additionalContacts?: string | null; // JSON string of AdditionalContact[]
  createdAt: Date;
  updatedAt: Date;

  // Relations
  serviceConfigs?: BuyerServiceConfig[];
  serviceZipCodes?: BuyerServiceZipCode[];
  transactions?: Transaction[];
  wonLeads?: Lead[];
}

// Template and configuration types
export interface TemplateConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers: Record<string, string>;
  body: Record<string, any>;
  timeout: number;
  // Form-specific optional fields
  includeCompliance?: boolean;
  staticFields?: Record<string, any>;
}

export type TransformationType =
  | 'uppercase'
  | 'lowercase'
  | 'trim'
  | 'format_phone'
  | 'format_date'
  | 'number'
  | 'boolean'
  | 'date'
  | 'phone'
  | 'email'
  | string; // Allow custom transforms

export interface MappingCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'exists' | 'gt' | 'lt' | 'gte' | 'lte';
  value?: any;
}

export interface FieldMapping {
  source: string;
  target: string;
  // Alternative field names for compatibility
  sourceField?: string;
  targetField?: string;
  transform?: TransformationType;
  defaultValue?: any;
  required?: boolean;
  condition?: MappingCondition;
}

export interface ComplianceConfig {
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
}

export interface AuthConfig {
  type: 'apikey' | 'bearer' | 'basic' | 'custom';
  apiKey?: string;
  bearerToken?: string;
  username?: string;
  password?: string;
  customHeaders?: Record<string, string>;
}

export interface BuyerServiceConfig {
  id: string;
  buyerId: string;
  serviceTypeId: string;
  pingTemplate: TemplateConfig; // Parsed JSON from string
  postTemplate: TemplateConfig; // Parsed JSON from string
  fieldMappings: FieldMapping[]; // Parsed JSON from string
  requiresTrustedForm: boolean;
  requiresJornaya: boolean;
  complianceConfig?: ComplianceConfig | null; // Parsed JSON from string
  minBid: number;
  maxBid: number;
  priority: number;
  active: boolean;
  createdAt: Date;
  
  // Relations
  buyer?: Buyer;
  serviceType?: ServiceType;
  zipCodeMappings?: BuyerServiceZipCode[];
}

export interface BuyerServiceZipCode {
  id: string;
  buyerId: string;
  serviceTypeId: string;
  zipCode: string;
  active: boolean;
  priority: number;
  maxLeadsPerDay?: number | null;
  minBid?: number | null;
  maxBid?: number | null;
  createdAt: Date;
  updatedAt: Date;
  
  // Relations
  buyer?: Buyer;
  serviceType?: ServiceType;
}

// Form schema types
export interface FormFieldValidation {
  required?: boolean;
  pattern?: string;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  customValidator?: string;
}

export interface FormFieldOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface FormFieldConditional {
  field: string;
  operator: 'equals' | 'notEquals' | 'includes' | 'greaterThan' | 'lessThan';
  value: any;
}

export interface FormField {
  id: string;
  name: string;
  type: 'text' | 'email' | 'phone' | 'number' | 'select' | 'radio' | 'checkbox' | 'textarea' | 'date' | 'multiselect' | 'tel';
  label: string;
  placeholder?: string;
  description?: string;
  required: boolean;
  options?: FormFieldOption[];
  validation?: FormFieldValidation;
  conditional?: FormFieldConditional;
  gridColumn?: string;
  className?: string;
}

export interface FormSchema {
  title: string;
  description?: string;
  fields: FormField[];
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
}

export interface ServiceType {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  formSchema: FormSchema; // Parsed JSON from string
  active: boolean;
  createdAt: Date;
  updatedAt: Date;

  // Relations
  leads?: Lead[];
  buyerServiceConfigs?: BuyerServiceConfig[];
  buyerServiceZipCodes?: BuyerServiceZipCode[];
}

// Compliance and lead data types
export interface ComplianceData {
  trustedForm?: {
    certUrl: string;
    certId: string;
    timestamp: string;
    ipAddress: string;
    userAgent: string;
    pageTitle?: string;
  };
  jornaya?: {
    leadId: string;
    pixelFired: boolean;
    timestamp: string;
    ipAddress?: string;
  };
  tcpa?: {
    consented: boolean;
    consentText: string;
    timestamp: string;
    ipAddress: string;
    method: 'checkbox' | 'signature' | 'verbal';
  };
  additionalData?: Record<string, any>;
}

export interface FormData {
  personalInfo?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  };
  addressInfo?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };
  projectDetails?: Record<string, any>;
  preferences?: Record<string, any>;
  metadata?: {
    sessionId?: string;
    referrer?: string;
    userAgent?: string;
    submitTime?: string;
    timeSpent?: number;
  };
}

export interface Lead {
  id: string;
  serviceTypeId: string;
  formData: FormData; // Parsed JSON from string
  zipCode: string;
  ownsHome: boolean;
  timeframe: string;
  status: LeadStatus;
  winningBuyerId?: string | null;
  winningBid?: number | null;
  trustedFormCertUrl?: string | null;
  trustedFormCertId?: string | null;
  jornayaLeadId?: string | null;
  complianceData?: ComplianceData | null; // Parsed JSON from string
  leadQualityScore?: number | null;
  // Accounting fields
  disposition: LeadDisposition;
  creditAmount?: number | null;
  creditIssuedAt?: Date | null;
  creditIssuedById?: string | null;
  // Timestamps
  createdAt: Date;
  updatedAt: Date;

  // Relations
  serviceType?: ServiceType;
  winningBuyer?: Buyer | null;
  transactions?: Transaction[];
  complianceAudits?: ComplianceAuditLog[];
  statusHistory?: LeadStatusHistory[];
}

export interface Transaction {
  id: string;
  leadId: string;
  buyerId: string;
  actionType: TransactionActionType;
  payload: Record<string, any>; // Parsed JSON from string
  response?: Record<string, any> | null; // Parsed JSON from string
  status: TransactionStatus;
  bidAmount?: number | null;
  responseTime?: number | null;
  errorMessage?: string | null;
  complianceIncluded: boolean;
  trustedFormPresent: boolean;
  jornayaPresent: boolean;
  createdAt: Date;
  
  // Relations
  lead?: Lead;
  buyer?: Buyer;
}

export interface ComplianceAuditLog {
  id: string;
  leadId: string;
  eventType: ComplianceEventType;
  eventData: Record<string, any>; // Parsed JSON from string
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: Date;
  
  // Relations
  lead?: Lead;
}

export interface ZipCodeMetadata {
  zipCode: string;
  city: string;
  state: string;
  county?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  timezone?: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Admin User & Lead Accounting types
export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: AdminUserRole;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;

  // Relations
  statusChanges?: LeadStatusHistory[];
}

export interface LeadStatusHistory {
  id: string;
  leadId: string;
  adminUserId?: string | null;
  oldStatus?: LeadStatus | null;
  newStatus: LeadStatus;
  oldDisposition?: LeadDisposition | null;
  newDisposition?: LeadDisposition | null;
  reason?: string | null;
  creditAmount?: number | null;
  changeSource: ChangeSource;
  ipAddress?: string | null;
  createdAt: Date;

  // Relations
  lead?: Lead;
  adminUser?: AdminUser | null;
}

// Utility types for API responses
export interface BuyerWithServiceCoverage extends Buyer {
  serviceCoverageCount: number;
  totalZipCodes: number;
  activeServices: string[];
}

export interface ServiceCoverageStats {
  totalBuyers: number;
  contractorBuyers: number;
  networkBuyers: number;
  totalZipCodes: number;
  avgZipCodesPerBuyer: number;
}

// Form validation types
export interface CreateBuyerRequest {
  name: string;
  type: BuyerType;
  apiUrl: string;
  authConfig?: string;
  pingTimeout?: number;
  postTimeout?: number;
  active?: boolean;
}

export interface UpdateBuyerRequest extends Partial<CreateBuyerRequest> {
  id: string;
}

export interface BuyerQueryFilters {
  type?: BuyerType;
  active?: boolean;
  hasServiceType?: string;
  hasZipCode?: string;
  search?: string;
}

// ============================================
// AFFILIATE SYSTEM TYPES
// ============================================

export enum AffiliateStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED'
}

export enum CommissionStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  PAID = 'PAID',
  REJECTED = 'REJECTED'
}

export enum WithdrawalStatus {
  REQUESTED = 'REQUESTED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

export interface Affiliate {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  companyName?: string | null;
  phone?: string | null;
  commissionRate: number; // Decimal stored as number
  status: AffiliateStatus;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;

  // Relations
  links?: AffiliateLink[];
  commissions?: AffiliateCommission[];
  withdrawals?: AffiliateWithdrawal[];
}

export interface AffiliateLink {
  id: string;
  affiliateId: string;
  code: string;
  targetPath: string; // e.g., "/windows", "/roofing"
  name?: string | null;
  clicks: number;
  conversions: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;

  // Relations
  affiliate?: Affiliate;
}

export interface AffiliateCommission {
  id: string;
  affiliateId: string;
  leadId: string;
  amount: number; // Decimal stored as number
  rate: number; // Rate at time of creation
  status: CommissionStatus;
  approvedAt?: Date | null;
  paidAt?: Date | null;
  rejectedAt?: Date | null;
  rejectReason?: string | null;
  createdAt: Date;
  updatedAt: Date;

  // Relations
  affiliate?: Affiliate;
  lead?: Lead;
}

export interface AffiliateWithdrawal {
  id: string;
  affiliateId: string;
  amount: number; // Decimal stored as number
  method: string; // "paypal", "bank_transfer"
  methodDetails?: string | null; // Encrypted JSON
  status: WithdrawalStatus;
  processedAt?: Date | null;
  processedBy?: string | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;

  // Relations
  affiliate?: Affiliate;
}

// Affiliate dashboard statistics
export interface AffiliateStats {
  totalEarned: number;
  pendingCommissions: number;
  approvedCommissions: number;
  availableForWithdrawal: number;
  totalClicks: number;
  totalConversions: number;
  conversionRate: number;
  activeLinks: number;
}

// Affiliate query filters
export interface AffiliateQueryFilters {
  status?: AffiliateStatus;
  search?: string;
}

export interface CommissionQueryFilters {
  status?: CommissionStatus;
  affiliateId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface WithdrawalQueryFilters {
  status?: WithdrawalStatus;
  affiliateId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

// Affiliate creation/update requests
export interface CreateAffiliateRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  companyName?: string;
  phone?: string;
}

export interface UpdateAffiliateRequest {
  firstName?: string;
  lastName?: string;
  companyName?: string;
  phone?: string;
  commissionRate?: number;
  status?: AffiliateStatus;
}

export interface CreateAffiliateLinkRequest {
  targetPath?: string;  // Either targetPath or targetUrl required
  targetUrl?: string;   // Alternative field name (from frontend)
  code?: string;        // Optional custom code
  customCode?: string;  // Alternative field name (from frontend)
  name?: string;
}

export interface CreateWithdrawalRequest {
  amount: number;
  method: string;
  methodDetails?: string;
}