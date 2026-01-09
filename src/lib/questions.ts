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
 * Question Flow Helper Functions
 *
 * WHY: Provide conditional navigation and step visibility logic for DynamicForm.
 * WHEN: DynamicForm needs to determine next step or check if a question should display.
 * HOW: Evaluate conditions against collected answers, iterate through steps.
 *
 * NOTE: Question flows are now database-driven via ServiceType.formSchema.
 * Use /api/services/[slug]/flow to fetch flows dynamically.
 * The flow-builder.ts converts database formSchema to QuestionFlow objects.
 */

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