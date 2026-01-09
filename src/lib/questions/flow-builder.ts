/**
 * Question Flow Builder
 *
 * WHY: Eliminates need for hardcoded per-service question flows.
 *      New services can be added via Admin UI without code changes.
 *
 * WHEN: Called by flow API endpoint to build question flow for DynamicForm.
 *
 * HOW: Parses ServiceType.formSchema JSON and builds a QuestionFlow object
 *      with proper steps, questions, and validation rules.
 */

import type { QuestionFlow, Question, QuestionOption } from '@/lib/questions';

/**
 * Field definition from ServiceType.formSchema
 */
interface FormSchemaField {
  name: string;
  type: string;
  label: string;
  required?: boolean;
  options?: string[] | { value: string; label: string }[];
  validation?: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    message?: string;
  };
  conditions?: {
    field: string;
    operator: 'equals' | 'not_equals' | 'in' | 'not_in';
    value: string | string[];
  }[];
}

/**
 * Parsed formSchema structure
 */
interface FormSchema {
  fields: FormSchemaField[];
  // Optional UI configuration
  ui?: {
    theme?: string;
    progressBar?: boolean;
  };
}

/**
 * Service type from database
 */
interface ServiceTypeInput {
  id: string;
  name: string;
  displayName?: string;
  formSchema: string | null;
}

/**
 * Map field types from formSchema to Question types
 *
 * WHY: formSchema uses different type names than QuestionFlow
 * WHEN: Converting each field to a Question
 */
function mapFieldType(schemaType: string): Question['type'] {
  const typeMap: Record<string, Question['type']> = {
    'select': 'select',
    'radio': 'select',
    'dropdown': 'select',
    'text': 'text',
    'textarea': 'text',
    'email': 'text',
    'tel': 'text',
    'phone': 'text',
    'number': 'text',
    'address': 'address',
    'contact': 'contact',
    'contact_fields': 'contact_fields',
    'name': 'name_fields',
    'name_fields': 'name_fields',
  };

  return typeMap[schemaType.toLowerCase()] || 'text';
}

/**
 * Convert formSchema options to QuestionOption format
 *
 * WHY: formSchema can have options as strings or objects
 * WHEN: Building options for select/radio questions
 */
function buildOptions(options: FormSchemaField['options']): QuestionOption[] | undefined {
  if (!options || options.length === 0) {
    return undefined;
  }

  return options.map(opt => {
    if (typeof opt === 'string') {
      return { value: opt.toLowerCase().replace(/\s+/g, '_'), label: opt };
    }
    return { value: opt.value, label: opt.label };
  });
}

/**
 * Convert a formSchema field to a Question object
 *
 * WHY: Each field in formSchema needs to become a Question
 * WHEN: Building the questions map for QuestionFlow
 */
function fieldToQuestion(field: FormSchemaField): Question {
  const question: Question = {
    id: field.name,
    type: mapFieldType(field.type),
    question: field.label,
    required: field.required ?? true,
  };

  // Add options for select-type fields
  const options = buildOptions(field.options);
  if (options) {
    question.options = options;
  }

  // Add validation if present
  if (field.validation) {
    question.validation = {
      pattern: field.validation.pattern,
      message: field.validation.message,
    };
  }

  // Add conditions if present
  if (field.conditions && field.conditions.length > 0) {
    question.conditions = field.conditions;
  }

  return question;
}

/**
 * Standard steps that all service flows should include
 * These are appended to service-specific questions
 */
const STANDARD_STEPS = [
  'address',
  'timeline',
  'isHomeowner',
  'authorizationConfirm',
  'nameInfo',
  'contactInfo',
] as const;

/**
 * Standard questions that all service flows include
 */
const STANDARD_QUESTIONS: Record<string, Question> = {
  address: {
    id: 'address',
    type: 'address',
    question: 'Where is this project?',
    required: true,
  },
  timeline: {
    id: 'timeline',
    type: 'select',
    question: "What's your timeline?",
    required: true,
    options: [
      { value: 'within_3_months', label: 'Within 3 months' },
      { value: '3_plus_months', label: '3+ months' },
      { value: 'not_sure', label: "I'm not sure" },
    ],
  },
  isHomeowner: {
    id: 'isHomeowner',
    type: 'select',
    question: 'Are you the homeowner or authorized to make decisions?',
    required: true,
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
    ],
  },
  authorizationConfirm: {
    id: 'authorizationConfirm',
    type: 'select',
    question: 'Do you have authorization from the homeowner to proceed with this project?',
    required: true,
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
    ],
    conditions: [
      {
        field: 'isHomeowner',
        operator: 'equals',
        value: 'no',
      },
    ],
  },
  nameInfo: {
    id: 'nameInfo',
    type: 'name_fields',
    question: "What's your name?",
    required: true,
  },
  contactInfo: {
    id: 'contactInfo',
    type: 'contact_fields',
    question: "Let's get your contact information",
    required: true,
  },
};

/**
 * Build a QuestionFlow from a ServiceType's formSchema
 *
 * WHY: Enables dynamic service types without hardcoded flows
 * WHEN: Flow API endpoint needs to return flow for DynamicForm
 * HOW:
 *   1. Parse formSchema JSON
 *   2. Convert fields to questions
 *   3. Add standard steps (address, timeline, contact, etc.)
 *   4. Return complete QuestionFlow
 *
 * @param serviceType - ServiceType from database with formSchema JSON
 * @returns QuestionFlow object compatible with DynamicForm
 *
 * EDGE CASES:
 * - Invalid JSON → Returns fallback flow with standard questions only
 * - Empty fields array → Returns flow with standard questions only
 * - Null formSchema → Returns fallback flow
 */
export function buildQuestionFlow(serviceType: ServiceTypeInput): QuestionFlow {
  const serviceSlug = serviceType.name.toLowerCase();

  // Initialize with standard questions
  const questions: Record<string, Question> = { ...STANDARD_QUESTIONS };
  const steps: string[] = [];

  // Parse formSchema if present
  if (serviceType.formSchema) {
    try {
      const formSchema: FormSchema = JSON.parse(serviceType.formSchema);

      if (formSchema.fields && Array.isArray(formSchema.fields)) {
        // Track which standard fields are defined in schema
        const definedFields = new Set<string>();

        // Convert each field to a question
        for (const field of formSchema.fields) {
          if (!field.name) {
            console.warn('Skipping field with missing name:', field);
            continue;
          }

          const fieldNameLower = field.name.toLowerCase();

          // Skip fields that match standard steps (they'll be added automatically)
          if (STANDARD_STEPS.includes(fieldNameLower as any)) {
            definedFields.add(fieldNameLower);
            // Allow overriding standard question labels
            if (STANDARD_QUESTIONS[fieldNameLower]) {
              questions[fieldNameLower] = {
                ...STANDARD_QUESTIONS[fieldNameLower],
                question: field.label || STANDARD_QUESTIONS[fieldNameLower].question,
              };
            }
            continue;
          }

          // Add service-specific question
          questions[field.name] = fieldToQuestion(field);
          steps.push(field.name);
          definedFields.add(fieldNameLower);
        }
      }
    } catch (error) {
      console.error('Failed to parse formSchema JSON:', error);
      // Continue with standard questions only
    }
  }

  // Add standard steps in correct order
  for (const step of STANDARD_STEPS) {
    if (!steps.includes(step)) {
      steps.push(step);
    }
  }

  return {
    serviceType: serviceSlug,
    steps,
    questions,
  };
}

/**
 * Build a minimal fallback flow for when formSchema is missing/invalid
 *
 * WHY: Graceful degradation - don't break completely if schema is bad
 * WHEN: formSchema is null, empty, or invalid JSON
 */
export function buildFallbackFlow(serviceName: string): QuestionFlow {
  return {
    serviceType: serviceName.toLowerCase(),
    steps: [...STANDARD_STEPS],
    questions: { ...STANDARD_QUESTIONS },
  };
}

/**
 * Validate a QuestionFlow structure
 *
 * WHY: Ensure the flow is valid before sending to frontend
 * WHEN: After building flow, before returning from API
 * @returns Validation result with errors if invalid
 */
export function validateQuestionFlow(flow: QuestionFlow): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check required fields
  if (!flow.serviceType) {
    errors.push('Missing serviceType');
  }

  if (!flow.steps || flow.steps.length === 0) {
    errors.push('No steps defined');
  }

  if (!flow.questions || Object.keys(flow.questions).length === 0) {
    errors.push('No questions defined');
  }

  // Check all steps have corresponding questions
  for (const step of flow.steps || []) {
    if (!flow.questions[step]) {
      errors.push(`Step "${step}" has no corresponding question`);
    }
  }

  // Check question types are valid
  const validTypes: Question['type'][] = [
    'select', 'text', 'address', 'contact', 'name_fields', 'contact_fields'
  ];
  for (const [id, question] of Object.entries(flow.questions || {})) {
    if (!validTypes.includes(question.type)) {
      errors.push(`Question "${id}" has invalid type "${question.type}"`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
