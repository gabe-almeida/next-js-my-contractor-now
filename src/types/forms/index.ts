export interface FormField {
  id: string;
  name: string;
  type: 'text' | 'email' | 'tel' | 'select' | 'multiselect' | 'radio' | 'checkbox' | 'textarea' | 'number' | 'date';
  label: string;
  placeholder?: string;
  required?: boolean;
  validation?: Record<string, any>;
  options?: FormFieldOption[];
  description?: string;
  conditional?: FormConditional;
  gridColumn?: string;
  className?: string;
}

export interface FormFieldOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface FormConditional {
  field: string;
  operator: 'equals' | 'notEquals' | 'includes' | 'notIncludes' | 'greaterThan' | 'lessThan';
  value: string | string[] | number;
}

export interface FormSection {
  id: string;
  title: string;
  description?: string;
  fields: FormField[];
  conditional?: FormConditional;
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

export interface FormConfig {
  id: string;
  title: string;
  description?: string;
  sections: FormSection[];
  submitText?: string;
  resetText?: string;
  compliance?: ComplianceConfig;
  styling?: FormStyling;
}

export interface ComplianceConfig {
  trustedForm?: {
    enabled: boolean;
    cert_id?: string;
    pingData?: boolean;
  };
  jornaya?: {
    enabled: boolean;
    leadid_token?: string;
    trackingUrl?: string;
  };
}

export interface FormStyling {
  theme?: 'default' | 'modern' | 'minimal' | 'professional';
  layout?: 'single' | 'double' | 'grid';
  spacing?: 'compact' | 'normal' | 'spacious';
  borderRadius?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
}

export interface FormSubmission {
  formId: string;
  data: Record<string, any>;
  compliance: {
    trustedFormCertUrl?: string;
    jornayaLeadId?: string;
    timestamp: string;
    userAgent: string;
    ipAddress?: string;
  };
  metadata: {
    sessionId: string;
    pageUrl: string;
    referrer: string;
    submissionTime: number;
  };
}

export interface FormValidationError {
  field: string;
  message: string;
  type: 'required' | 'format' | 'min' | 'max' | 'custom';
}

export interface FormState {
  values: Record<string, any>;
  errors: FormValidationError[];
  touched: Record<string, boolean>;
  isSubmitting: boolean;
  isValid: boolean;
  compliance: {
    trustedForm: ComplianceStatus;
    jornaya: ComplianceStatus;
  };
}

export interface ComplianceStatus {
  initialized: boolean;
  token?: string;
  url?: string;
  error?: string;
}

export type FormFieldProps = {
  field: FormField;
  value: any;
  error?: string;
  touched?: boolean;
  onChange: (value: any) => void;
  onBlur: () => void;
  disabled?: boolean;
  className?: string;
};

export type ServiceType = 
  | 'windows'
  | 'roofing'
  | 'bathrooms';