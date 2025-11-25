import { FormField, FormSchema, ComplianceData } from './database';
import { ComplianceStatus, TcpaConsentStatus } from './api';

// Form Engine Types
export interface FormEngineProps {
  schema: FormSchema;
  onSubmit: (data: FormSubmissionData) => Promise<void>;
  complianceEnabled?: boolean;
  className?: string;
}

export interface FormSubmissionData {
  formData: Record<string, any>;
  complianceData: FormComplianceData;
  metadata: FormMetadata;
}

export interface FormComplianceData {
  trustedForm?: {
    certUrl?: string;
    certId?: string;
    timestamp?: string;
    status: ComplianceStatus;
    error?: string;
  };
  jornaya?: {
    leadId?: string;
    pixelFired: boolean;
    timestamp?: string;
    status: ComplianceStatus;
    error?: string;
  };
  tcpa?: {
    consented: boolean;
    consentText: string;
    timestamp: string;
    method: 'checkbox' | 'signature' | 'verbal';
    status: TcpaConsentStatus;
    ipAddress: string;
    userAgent: string;
  };
  fingerprint?: string;
  sessionId?: string;
  validationResults?: {
    isValid: boolean;
    score: number;
    issues: string[];
  };
}

export interface FormMetadata {
  startTime: string;
  submitTime: string;
  timeSpent: number;
  pageUrl: string;
  referrer: string;
  interactions: FormInteraction[];
}

export interface FormInteraction {
  field: string;
  action: 'focus' | 'blur' | 'change' | 'click';
  timestamp: string;
  value?: any;
}

// Dynamic Field Components
export interface DynamicFieldProps {
  field: FormField;
  value: any;
  onChange: (value: any) => void;
  error?: string;
  disabled?: boolean;
  complianceData?: FormComplianceData;
}

export interface SelectFieldProps extends DynamicFieldProps {
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  placeholder?: string;
  searchable?: boolean;
  multiple?: boolean;
}

export interface ConditionalFieldProps extends DynamicFieldProps {
  dependencies: Record<string, any>;
  isVisible: boolean;
}

// Common form field types
export type TimeframeOption = 'immediate' | '1-3months' | '3-6months' | '6+months';
export type HomeOwnership = 'own' | 'rent';
export type ContactPreference = 'phone' | 'email' | 'text' | 'any';
export type CallTimePreference = 'morning' | 'afternoon' | 'evening' | 'anytime';
export type HomeType = 'single_family' | 'townhouse' | 'condo' | 'apartment' | 'mobile_home';
export type ProjectUrgency = 'emergency' | 'immediate' | 'month' | 'quarter' | 'year' | 'planning';

// Service-Specific Form Types
export interface WindowsFormData {
  // Required fields
  zipCode: string;
  ownsHome: HomeOwnership;
  timeframe: TimeframeOption;
  numberOfWindows: '1-3' | '4-6' | '7-10' | '11-15' | '16+';
  windowTypes: ('single_hung' | 'double_hung' | 'casement' | 'sliding' | 'bay' | 'bow' | 'awning' | 'hopper')[];
  projectScope: 'full_replacement' | 'installation_only' | 'repair' | 'not_sure';
  
  // Optional fields
  budgetRange?: 'under_5k' | '5k_15k' | '15k_30k' | 'over_30k' | 'flexible';
  currentWindowAge?: 'under_5' | '5_10' | '10_20' | 'over_20' | 'unknown';
  homeType?: HomeType;
  urgency?: ProjectUrgency;
  contactPreference?: ContactPreference;
  bestTimeToCall?: CallTimePreference;
  
  // Additional details
  energyEfficiencyConcerns?: boolean;
  soundInsulationNeeds?: boolean;
  securityFeatures?: boolean;
  currentIssues?: ('drafts' | 'condensation' | 'difficulty_opening' | 'appearance' | 'noise')[];
  homeSquareFootage?: 'under_1500' | '1500_2500' | '2500_4000' | 'over_4000';
  storiesAffected?: '1' | '2' | '3+';
}

export interface BathroomFormData {
  // Required fields
  zipCode: string;
  ownsHome: HomeOwnership;
  timeframe: TimeframeOption;
  numberOfBathrooms: '1' | '2' | '3' | '4+';
  projectType: 'full_remodel' | 'partial_update' | 'fixtures_only' | 'accessibility_upgrade' | 'not_sure';
  currentCondition: 'excellent' | 'good' | 'fair' | 'poor' | 'needs_immediate_attention';
  
  // Optional fields
  desiredFeatures?: ('walk_in_shower' | 'soaking_tub' | 'double_vanity' | 'heated_floors' | 'smart_fixtures' | 'steam_shower')[];
  budgetRange?: 'under_10k' | '10k_25k' | '25k_50k' | 'over_50k' | 'flexible';
  accessibilityNeeds?: boolean;
  permitRequired?: boolean;
  existingPlumbing?: 'good' | 'needs_minor_update' | 'needs_major_update' | 'unknown';
  homeType?: HomeType;
  urgency?: ProjectUrgency;
  contactPreference?: ContactPreference;
  bestTimeToCall?: CallTimePreference;
  
  // Additional details
  bathroomSize?: 'small' | 'medium' | 'large' | 'master';
  currentIssues?: ('leaks' | 'mold' | 'outdated_fixtures' | 'poor_lighting' | 'lack_of_storage')[];
  floorType?: 'tile' | 'vinyl' | 'laminate' | 'hardwood' | 'other';
  ventilationAdequate?: boolean;
}

export interface RoofingFormData {
  // Required fields
  zipCode: string;
  ownsHome: HomeOwnership;
  timeframe: TimeframeOption;
  homeAge: 'under_5' | '5_10' | '10_20' | '20_30' | 'over_30' | 'unknown';
  roofType: 'asphalt_shingles' | 'metal' | 'tile' | 'slate' | 'wood' | 'flat' | 'other' | 'unknown';
  projectType: 'full_replacement' | 'repair' | 'inspection' | 'maintenance' | 'not_sure';
  urgency: ProjectUrgency;
  stories: '1' | '2' | '3+';
  
  // Optional fields
  damageType?: ('storm' | 'hail' | 'wind' | 'age' | 'leak' | 'missing_shingles' | 'ice_dam' | 'other')[];
  insuranceClaim?: boolean;
  insuranceCompany?: string;
  squareFootage?: 'under_1500' | '1500_2500' | '2500_4000' | 'over_4000' | 'unknown';
  homeType?: HomeType;
  contactPreference?: ContactPreference;
  bestTimeToCall?: CallTimePreference;
  
  // Additional details
  roofAge?: 'under_5' | '5_10' | '10_15' | '15_20' | 'over_20' | 'unknown';
  guttersNeedWork?: boolean;
  chimneyPresent?: boolean;
  skylightsPresent?: boolean;
  currentIssues?: ('leaks' | 'missing_shingles' | 'sagging' | 'granule_loss' | 'ice_dams' | 'poor_ventilation')[];
  roofAccess?: 'easy' | 'moderate' | 'difficult';
  budgetRange?: 'under_10k' | '10k_20k' | '20k_40k' | 'over_40k' | 'insurance_covered';
}

// Form Validation Types
export interface FormValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  warnings?: Record<string, string>;
  complianceIssues?: {
    field: string;
    message: string;
    severity: 'low' | 'medium' | 'high';
  }[];
  score?: number;
  recommendations?: string[];
}

export interface FieldValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  customValidator?: (value: any, formData: Record<string, any>) => string | null;
  dependsOn?: {
    field: string;
    value: any;
    operator?: 'equals' | 'not_equals' | 'contains';
  };
}

// Form State Management
export interface FormState<T = Record<string, any>> {
  data: T;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  isSubmitting: boolean;
  isValid: boolean;
  isDirty: boolean;
  complianceData: FormComplianceData;
  metadata: FormMetadata;
  validationResult?: FormValidationResult;
  autoSaveEnabled?: boolean;
  lastSavedAt?: string;
}

export interface FormActions {
  updateField: (name: string, value: any) => void;
  setError: (name: string, error: string) => void;
  clearError: (name: string) => void;
  setTouched: (name: string, touched: boolean) => void;
  reset: () => void;
  submit: () => Promise<void>;
  updateComplianceData: (data: Partial<FormComplianceData>) => void;
}

// Form Configuration Types
export interface FormTheme {
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  errorColor: string;
  successColor: string;
  fontFamily: string;
  borderRadius: string;
  spacing: {
    small: string;
    medium: string;
    large: string;
  };
}

export interface FormLayoutConfig {
  variant: 'single_column' | 'two_column' | 'wizard' | 'accordion';
  showProgress: boolean;
  compactMode: boolean;
  stickySubmit: boolean;
  fieldSpacing: 'tight' | 'normal' | 'loose';
}

// TrustedForm Integration Types
export interface TrustedFormConfig {
  enabled: boolean;
  domain: string;
  apiKey: string;
  autoCapture: boolean;
  includeInPing: boolean;
  includeInPost: boolean;
  certificateField: string;
}

export interface TrustedFormHooks {
  onCertificateGenerated: (cert: string) => void;
  onCertificateError: (error: string) => void;
  onFormSubmit: (certUrl: string) => void;
}

// Jornaya Integration Types
export interface JornayaConfig {
  enabled: boolean;
  pixelId: string;
  autoCapture: boolean;
  includeInPing: boolean;
  includeInPost: boolean;
  leadIdField: string;
}

export interface JornayaHooks {
  onLeadIdGenerated: (leadId: string) => void;
  onPixelError: (error: string) => void;
  onPixelLoaded: () => void;
}

// Multi-step Form Types
export interface FormStep {
  id: string;
  title: string;
  description?: string;
  fields: string[];
  validation?: FieldValidationRule[];
  conditional?: {
    field: string;
    operator: 'equals' | 'not_equals' | 'contains';
    value: any;
  };
}

export interface MultiStepFormProps {
  steps: FormStep[];
  schema: FormSchema;
  onStepChange?: (currentStep: number, totalSteps: number) => void;
  onSubmit: (data: FormSubmissionData) => Promise<void>;
  allowBackward?: boolean;
  showProgress?: boolean;
  complianceEnabled?: boolean;
}

export interface StepNavigationProps {
  currentStep: number;
  totalSteps: number;
  canGoBack: boolean;
  canGoForward: boolean;
  onNext: () => void;
  onPrevious: () => void;
  onGoToStep?: (step: number) => void;
}