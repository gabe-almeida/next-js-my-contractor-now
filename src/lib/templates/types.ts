/**
 * Template Engine Type Definitions
 * Core types for data transformation and buyer configurations
 */

// Base types for template mappings
export interface TemplateMapping {
  sourceField: string;
  targetField: string;
  transform?: string | TransformFunction;
  defaultValue?: any;
  required?: boolean;
  validation?: ValidationRule;
}

export interface TransformFunction {
  (value: any, context?: TransformContext): any;
}

export interface TransformContext {
  lead: LeadData;
  buyer: BuyerConfig;
  serviceType: string;
  metadata: Record<string, any>;
}

export interface ValidationRule {
  type: 'string' | 'number' | 'boolean' | 'email' | 'phone' | 'zipcode' | 'custom';
  pattern?: RegExp;
  min?: number;
  max?: number;
  customValidator?: (value: any) => boolean;
  errorMessage?: string;
}

// Template configuration types
export interface TemplateConfig {
  mappings: TemplateMapping[];
  includeCompliance?: boolean;
  additionalFields?: Record<string, any>;
  transformations?: Record<string, TransformFunction>;
  validations?: Record<string, ValidationRule>;
  hooks?: TemplateHooks;
}

export interface TemplateHooks {
  beforeTransform?: (data: any) => any;
  afterTransform?: (data: any) => any;
  onError?: (error: Error, data: any) => void;
}

// Lead data structure
export interface LeadData {
  id: string;
  serviceTypeId: string;
  serviceType: ServiceType;
  formData: Record<string, any>;
  zipCode: string;
  ownsHome: boolean;
  timeframe: string;
  status: string;
  // Compliance fields
  trustedFormCertUrl?: string;
  trustedFormCertId?: string;
  jornayaLeadId?: string;
  activeProspectLeadId?: string;
  activeProspectCampaignId?: string;
  complianceData?: ComplianceData;
  createdAt: Date;
  updatedAt: Date;
}

export interface ComplianceData {
  userAgent: string;
  timestamp: string;
  ipAddress?: string;
  tcpaConsent: boolean;
  privacyPolicyAccepted: boolean;
  submissionSource: string;
  geoLocation?: {
    latitude?: number;
    longitude?: number;
    city?: string;
    state?: string;
  };
  // Marketing attribution data (from URL params and cookies)
  attribution?: {
    // UTM parameters
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_content?: string;
    utm_term?: string;
    // Click IDs
    fbclid?: string;
    gclid?: string;
    msclkid?: string;
    ttclid?: string;
    // Affiliate tracking
    affiliate_id?: string;
    aff?: string;
    ref?: string; // Affiliate link code - maps to Modernize partnerSourceId
    // Page context
    landing_page?: string;
    referrer?: string;
    referrer_domain?: string;
    first_touch_timestamp?: string;
    session_id?: string;
    raw_query_params?: Record<string, string>;
  };
}

export interface ServiceType {
  id: string;
  name: string;
  formSchema: FormSchema;
  active: boolean;
}

export interface FormSchema {
  fields: FormField[];
  validations: ValidationRule[];
  conditionalLogic?: ConditionalRule[];
}

export interface FormField {
  name: string;
  type: 'text' | 'email' | 'phone' | 'select' | 'radio' | 'checkbox' | 'textarea' | 'number';
  label: string;
  required: boolean;
  options?: SelectOption[];
  validation?: ValidationRule;
  conditionalDisplay?: ConditionalRule;
}

export interface SelectOption {
  value: string;
  label: string;
  metadata?: Record<string, any>;
}

export interface ConditionalRule {
  field: string;
  operator: 'equals' | 'notEquals' | 'contains' | 'greaterThan' | 'lessThan';
  value: any;
  action: 'show' | 'hide' | 'required' | 'optional';
}

// Buyer configuration types
export interface BuyerConfig {
  id: string;
  name: string;
  slug: string;
  apiUrl: string;
  authConfig: AuthConfig;
  active: boolean;
  serviceConfigs: BuyerServiceConfig[];
  globalSettings: BuyerGlobalSettings;
  metadata: Record<string, any>;
}

export interface AuthConfig {
  type: 'none' | 'apiKey' | 'bearer' | 'basic' | 'oauth';
  credentials: Record<string, string>;
  headers?: Record<string, string>;
  refreshToken?: string;
  expiresAt?: Date;
}

export interface BuyerServiceConfig {
  buyerId: string;
  serviceTypeId: string;
  serviceTypeName: string;
  active: boolean;
  priority: number;
  pricing: PricingConfig;
  pingTemplate: TemplateConfig;
  postTemplate: TemplateConfig;
  webhookConfig?: WebhookConfig;
  restrictions?: ServiceRestrictions;
}

export interface PricingConfig {
  basePrice: number;
  priceModifiers: PriceModifier[];
  maxBid: number;
  minBid: number;
  currency: string;
}

export interface PriceModifier {
  field: string;
  operator: 'equals' | 'contains' | 'range';
  value: any;
  modifier: number;
  type: 'multiply' | 'add' | 'subtract';
}

export interface WebhookConfig {
  pingUrl: string;
  postUrl: string;
  timeouts: {
    ping: number;
    post: number;
  };
  retryPolicy: RetryPolicy;
  headers?: Record<string, string>;
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffStrategy: 'exponential' | 'linear' | 'fixed';
  baseDelay: number;
  maxDelay: number;
}

export interface ServiceRestrictions {
  geoRestrictions?: GeoRestriction[];
  timeRestrictions?: TimeRestriction[];
  leadVolumeLimit?: number;
  qualityThreshold?: number;
  excludeFields?: string[];
}

export interface GeoRestriction {
  type: 'include' | 'exclude';
  zipCodes?: string[];
  states?: string[];
  cities?: string[];
  radius?: {
    center: { lat: number; lng: number };
    miles: number;
  };
}

export interface TimeRestriction {
  dayOfWeek?: number[];
  startHour?: number;
  endHour?: number;
  timezone?: string;
}

export interface BuyerGlobalSettings {
  defaultTimeout: number;
  maxConcurrentRequests: number;
  rateLimiting: {
    requestsPerMinute: number;
    requestsPerHour: number;
    requestsPerDay: number;
  };
  failoverSettings: {
    enabled: boolean;
    maxFailures: number;
    cooldownPeriod: number;
  };
  complianceRequirements: {
    requireTrustedForm: boolean;
    requireJornaya: boolean;
    requireTcpaConsent: boolean;
    additionalRequirements?: string[];
  };
  complianceFieldMappings?: ComplianceFieldMappings;
}

/**
 * Custom field name mappings for compliance data
 * Allows each buyer to specify their own field names
 */
export interface ComplianceFieldMappings {
  trustedForm?: {
    certUrl?: string[];      // Field names for TrustedForm certificate URL
    certId?: string[];       // Field names for TrustedForm certificate ID/token
  };
  jornaya?: {
    leadId?: string[];       // Field names for Jornaya LeadID
  };
  activeProspect?: {
    leadId?: string[];       // Field names for ActiveProspect LeadiD tracking
    campaignId?: string[];   // Field names for campaign identifier
  };
  // Affiliate tracking fields for buyers like Modernize
  // ref → partnerSourceId (campaign identifier)
  // affiliate_id → publisherSubId (transaction-level identifier)
  affiliate?: {
    ref?: string[];          // Field names for affiliate ref code (e.g., partnerSourceId)
    affiliateId?: string[];  // Field names for affiliate ID (e.g., publisherSubId)
  };
  tcpa?: {
    consent?: string[];      // Field names for TCPA consent
    timestamp?: string[];    // Field names for consent timestamp
  };
  technical?: {
    ipAddress?: string[];    // Field names for IP address
    userAgent?: string[];    // Field names for user agent
    timestamp?: string[];    // Field names for submission timestamp
  };
  geo?: {
    latitude?: string[];     // Field names for latitude
    longitude?: string[];    // Field names for longitude
    city?: string[];         // Field names for city
    state?: string[];        // Field names for state
  };
}

// Auction engine types
export interface AuctionConfig {
  maxParticipants: number;
  timeoutMs: number;
  requireMinimumBid: boolean;
  minimumBid: number;
  allowTiedBids: boolean;
  tiebreakStrategy: 'random' | 'priority' | 'responseTime';
}

export interface BidRequest {
  leadId: string;
  buyerId: string;
  serviceTypeId: string;
  payload: Record<string, any>;
  timestamp: Date;
  expectedResponseTime: number;
}

export interface BidResponse {
  buyerId: string;
  bidAmount: number;
  success: boolean;
  responseTime: number;
  error?: string;
  metadata?: Record<string, any>;
}

export interface AuctionResult {
  leadId: string;
  winningBuyerId?: string;
  winningBidAmount?: number;
  allBids: BidResponse[];
  auctionDurationMs: number;
  participantCount: number;
  status: 'completed' | 'failed' | 'timeout' | 'no_bids';
  postResult?: PostResult;
}

export interface PostResult {
  success: boolean;
  statusCode: number;
  response?: any;
  error?: string;
  deliveryTime: number;
}

// Transaction logging types
export interface TransactionLog {
  id: string;
  leadId: string;
  buyerId: string;
  actionType: 'PING' | 'POST' | 'WEBHOOK' | 'RETRY' | 'DELIVERY';
  status: 'pending' | 'success' | 'failed' | 'timeout';
  payload: Record<string, any>;
  response?: Record<string, any>;
  responseTime: number;
  errorMessage?: string;
  retryCount: number;
  timestamp: Date;
  metadata: Record<string, any>;
  // Winner/loser tracking (for analytics)
  isWinner?: boolean;
  lostReason?: string;
  winningBidAmount?: number;
  cascadePosition?: number;
  deliveryMethod?: string;
}

// Error types
export class TemplateEngineError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'TemplateEngineError';
  }
}

export class TransformationError extends TemplateEngineError {
  constructor(
    field: string,
    message: string,
    details?: Record<string, any>
  ) {
    super(`Transformation failed for field '${field}': ${message}`, 'TRANSFORM_ERROR', details);
  }
}

export class ValidationError extends TemplateEngineError {
  constructor(
    field: string,
    message: string,
    details?: Record<string, any>
  ) {
    super(`Validation failed for field '${field}': ${message}`, 'VALIDATION_ERROR', details);
  }
}

export class AuctionError extends TemplateEngineError {
  constructor(
    message: string,
    public auctionId: string,
    details?: Record<string, any>
  ) {
    super(message, 'AUCTION_ERROR', details);
  }
}

// Performance monitoring types
export interface PerformanceMetrics {
  templateEngineMetrics: {
    transformationTime: number;
    validationTime: number;
    totalProcessingTime: number;
    errorRate: number;
    throughput: number;
  };
  auctionMetrics: {
    averageAuctionTime: number;
    averageResponseTime: number;
    participationRate: number;
    winRate: Record<string, number>;
    bidDistribution: Record<string, number>;
  };
  buyerMetrics: Record<string, {
    responseTime: number;
    successRate: number;
    errorRate: number;
    volume: number;
  }>;
}

// Cache types
export interface CacheConfig {
  ttl: number;
  maxSize: number;
  strategy: 'lru' | 'fifo' | 'lfu';
}

export interface CachedData<T> {
  data: T;
  timestamp: Date;
  ttl: number;
  accessCount: number;
  lastAccessed: Date;
}