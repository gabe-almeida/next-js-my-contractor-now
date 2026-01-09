export interface QuestionOption {
  value: string;
  label: string;
  nextStep?: string; // Optional override for next step
}

export interface Question {
  id: string;
  type: 'select' | 'text' | 'address' | 'contact' | 'name_fields' | 'contact_fields';
  question: string;
  required: boolean;
  options?: QuestionOption[];
  validation?: {
    pattern?: string;
    message?: string;
  };
  conditions?: {
    field: string;
    operator: 'equals' | 'not_equals' | 'in' | 'not_in';
    value: string | string[];
  }[];
}

export interface QuestionFlow {
  serviceType: string;
  steps: string[]; // Ordered list of question IDs
  questions: { [key: string]: Question };
}

/**
 * @deprecated Use database-driven flows via /api/services/[slug]/flow instead
 * These hardcoded flows are kept only for backwards compatibility during migration.
 * The database formSchema in ServiceType.formSchema is the source of truth.
 */

// Windows service flow configuration
/** @deprecated Use API: GET /api/services/windows/flow */
export const windowsFlow: QuestionFlow = {
  serviceType: 'windows',
  steps: [
    'projectScope',
    'numberOfWindows', 
    'address',
    'timeline',
    'isHomeowner',
    'authorizationConfirm',
    'nameInfo',
    'contactInfo'
  ],
  questions: {
    projectScope: {
      id: 'projectScope',
      type: 'select',
      question: 'Are you looking to repair existing windows or install new windows?',
      required: true,
      options: [
        { value: 'repair', label: 'Repair' },
        { value: 'install', label: 'Install' }
      ]
    },
    numberOfWindows: {
      id: 'numberOfWindows',
      type: 'select',
      question: 'How many windows?',
      required: true,
      options: [
        { value: '1', label: '1 window' },
        { value: '2', label: '2 windows' },
        { value: '3-5', label: '3-5 windows' },
        { value: '6-9', label: '6-9 windows' },
        { value: '9+', label: '9+ windows' }
      ]
    },
    address: {
      id: 'address',
      type: 'address',
      question: 'Where is this project?',
      required: true
    },
    timeline: {
      id: 'timeline',
      type: 'select',
      question: "What's your timeline?",
      required: true,
      options: [
        { value: 'within_3_months', label: 'Within 3 months' },
        { value: '3_plus_months', label: '3+ months' },
        { value: 'not_sure', label: "I'm not sure" }
      ]
    },
    isHomeowner: {
      id: 'isHomeowner',
      type: 'select',
      question: 'Are you the homeowner or authorized to make decisions?',
      required: true,
      options: [
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No' }
      ]
    },
    authorizationConfirm: {
      id: 'authorizationConfirm',
      type: 'select',
      question: 'Do you have authorization from the homeowner to proceed with this project?',
      required: true,
      options: [
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No' }
      ],
      conditions: [
        {
          field: 'isHomeowner',
          operator: 'equals',
          value: 'no'
        }
      ]
    },
    nameInfo: {
      id: 'nameInfo',
      type: 'name_fields',
      question: "What's your name?",
      required: true
    },
    contactInfo: {
      id: 'contactInfo',
      type: 'contact_fields',
      question: "Let's get your contact information",
      required: true
    }
  }
};

// Roofing service flow configuration
/** @deprecated Use API: GET /api/services/roofing/flow */
export const roofingFlow: QuestionFlow = {
  serviceType: 'roofing',
  steps: [
    'projectScope',
    'roofType',
    'roofSize', 
    'address',
    'timeline',
    'isHomeowner',
    'authorizationConfirm',
    'nameInfo',
    'contactInfo'
  ],
  questions: {
    projectScope: {
      id: 'projectScope',
      type: 'select',
      question: 'What type of roofing work do you need?',
      required: true,
      options: [
        { value: 'repair', label: 'Repair existing roof' },
        { value: 'replacement', label: 'Full roof replacement' },
        { value: 'installation', label: 'New roof installation' }
      ]
    },
    roofType: {
      id: 'roofType',
      type: 'select',
      question: 'What type of roof?',
      required: true,
      options: [
        { value: 'asphalt_shingles', label: 'Asphalt Shingles' },
        { value: 'metal', label: 'Metal' },
        { value: 'tile', label: 'Tile' },
        { value: 'not_sure', label: 'Not Sure' }
      ]
    },
    roofSize: {
      id: 'roofSize',
      type: 'select',
      question: 'Approximate roof size?',
      required: true,
      options: [
        { value: 'small', label: 'Small (under 1,500 sq ft)' },
        { value: 'medium', label: 'Medium (1,500-3,000 sq ft)' },
        { value: 'large', label: 'Large (over 3,000 sq ft)' }
      ]
    },
    address: {
      id: 'address',
      type: 'address',
      question: 'Where is this project?',
      required: true
    },
    timeline: {
      id: 'timeline',
      type: 'select',
      question: "What's your timeline?",
      required: true,
      options: [
        { value: 'within_3_months', label: 'Within 3 months' },
        { value: '3_plus_months', label: '3+ months' },
        { value: 'not_sure', label: "I'm not sure" }
      ]
    },
    isHomeowner: {
      id: 'isHomeowner',
      type: 'select',
      question: 'Are you the homeowner or authorized to make decisions?',
      required: true,
      options: [
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No' }
      ]
    },
    authorizationConfirm: {
      id: 'authorizationConfirm',
      type: 'select',
      question: 'Do you have authorization from the homeowner to proceed with this project?',
      required: true,
      options: [
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No' }
      ],
      conditions: [
        {
          field: 'isHomeowner',
          operator: 'equals',
          value: 'no'
        }
      ]
    },
    nameInfo: {
      id: 'nameInfo',
      type: 'name_fields',
      question: "What's your name?",
      required: true
    },
    contactInfo: {
      id: 'contactInfo',
      type: 'contact_fields',
      question: "Let's get your contact information",
      required: true
    }
  }
};

// Bathroom service flow configuration
/** @deprecated Use API: GET /api/services/bathrooms/flow */
export const bathroomFlow: QuestionFlow = {
  serviceType: 'bathrooms',
  steps: [
    'projectScope',
    'bathroomType',
    'projectSize',
    'address',
    'timeline',
    'isHomeowner',
    'authorizationConfirm',
    'nameInfo',
    'contactInfo'
  ],
  questions: {
    projectScope: {
      id: 'projectScope',
      type: 'select',
      question: 'What type of bathroom work do you need?',
      required: true,
      options: [
        { value: 'full_renovation', label: 'Full bathroom renovation' },
        { value: 'partial_remodel', label: 'Partial remodel/updates' },
        { value: 'new_bathroom', label: 'New bathroom addition' },
        { value: 'repair', label: 'Repair/maintenance work' }
      ]
    },
    bathroomType: {
      id: 'bathroomType',
      type: 'select',
      question: 'What type of bathroom is this?',
      required: true,
      options: [
        { value: 'master_bath', label: 'Master bathroom' },
        { value: 'guest_bath', label: 'Guest bathroom' },
        { value: 'half_bath', label: 'Half bathroom/powder room' },
        { value: 'other', label: 'Other' }
      ]
    },
    projectSize: {
      id: 'projectSize',
      type: 'select',
      question: 'What is the approximate size of your bathroom?',
      required: true,
      options: [
        { value: 'small', label: 'Small (under 40 sq ft)' },
        { value: 'medium', label: 'Medium (40-100 sq ft)' },
        { value: 'large', label: 'Large (over 100 sq ft)' }
      ]
    },
    address: {
      id: 'address',
      type: 'address',
      question: 'Where is this project?',
      required: true
    },
    timeline: {
      id: 'timeline',
      type: 'select',
      question: "What's your timeline?",
      required: true,
      options: [
        { value: 'within_3_months', label: 'Within 3 months' },
        { value: '3_plus_months', label: '3+ months' },
        { value: 'not_sure', label: "I'm not sure" }
      ]
    },
    isHomeowner: {
      id: 'isHomeowner',
      type: 'select',
      question: 'Are you the homeowner or authorized to make decisions?',
      required: true,
      options: [
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No' }
      ]
    },
    authorizationConfirm: {
      id: 'authorizationConfirm',
      type: 'select',
      question: 'I confirm I am authorized to make decisions for this project',
      required: true,
      options: [
        { value: 'yes', label: 'Yes, I am authorized' },
        { value: 'no', label: 'No, I am not authorized' }
      ]
    },
    nameInfo: {
      id: 'nameInfo',
      type: 'name_fields',
      question: 'What is your name?',
      required: true
    },
    contactInfo: {
      id: 'contactInfo',
      type: 'contact_fields', 
      question: 'How can contractors reach you?',
      required: true
    }
  }
};

// Question flow registry
/** @deprecated Use API: GET /api/services/[slug]/flow instead */
export const questionFlows: { [key: string]: QuestionFlow } = {
  windows: windowsFlow,
  roofing: roofingFlow,
  bathrooms: bathroomFlow
};

// Helper functions
/**
 * @deprecated Use API: GET /api/services/[slug]/flow instead
 * This function returns hardcoded flows. For dynamic database-driven flows,
 * fetch from /api/services/[slug]/flow which reads from ServiceType.formSchema
 */
export function getQuestionFlow(serviceType: string): QuestionFlow | null {
  return questionFlows[serviceType] || null;
}

export function getNextStep(
  flow: QuestionFlow, 
  currentStep: string, 
  answers: { [key: string]: any }
): string | null {
  const currentIndex = flow.steps.indexOf(currentStep);
  if (currentIndex === -1 || currentIndex >= flow.steps.length - 1) {
    return null; // Last step or invalid step
  }

  // Look for next valid step (considering conditions)
  for (let i = currentIndex + 1; i < flow.steps.length; i++) {
    const stepId = flow.steps[i];
    const question = flow.questions[stepId];
    
    if (shouldShowQuestion(question, answers)) {
      return stepId;
    }
  }
  
  return null; // No more valid steps
}

export function shouldShowQuestion(
  question: Question, 
  answers: { [key: string]: any }
): boolean {
  if (!question.conditions) {
    return true; // No conditions, always show
  }

  return question.conditions.every(condition => {
    const answerValue = answers[condition.field];
    
    switch (condition.operator) {
      case 'equals':
        return answerValue === condition.value;
      case 'not_equals':
        return answerValue !== condition.value;
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(answerValue);
      case 'not_in':
        return Array.isArray(condition.value) && !condition.value.includes(answerValue);
      default:
        return true;
    }
  });
}

export function getValidSteps(
  flow: QuestionFlow, 
  answers: { [key: string]: any }
): string[] {
  return flow.steps.filter(stepId => {
    const question = flow.questions[stepId];
    return shouldShowQuestion(question, answers);
  });
}