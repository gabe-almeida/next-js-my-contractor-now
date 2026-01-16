/**
 * IVR System Type Definitions
 *
 * WHY: Provides type-safe IVR flow configuration and execution.
 *      Enables visual IVR builder and runtime execution engine.
 *
 * WHEN: Used by:
 *   - IVR Builder UI for creating/editing flows
 *   - IVR Executor for runtime step processing
 *   - Admin pages for managing IVR configurations
 *   - Webhook handlers for IVR response processing
 *
 * HOW: Defines discriminated union types for each step type,
 *      allowing type-safe handling of different step configurations.
 */

// ============================================
// BASE TYPES
// ============================================

/**
 * Available IVR step types
 *
 * - say: Play a message to the caller
 * - gather: Collect DTMF or speech input
 * - transfer: Transfer call to a destination
 * - condition: Branch based on variable evaluation
 * - qualification: Mark caller as qualified/disqualified
 * - menu: Multi-option menu with numbered choices
 * - setVariable: Store a value in flow variables
 * - goto: Jump to another step
 * - hangup: End the call
 * - webhook: Make external API call during flow
 */
export type IvrStepType =
  | 'say'
  | 'gather'
  | 'transfer'
  | 'condition'
  | 'qualification'
  | 'menu'
  | 'setVariable'
  | 'goto'
  | 'hangup'
  | 'webhook';

/**
 * Voice options for text-to-speech
 * Using Amazon Polly voices via Twilio
 */
export type IvrVoice =
  | 'Polly.Joanna'    // Female, US English (default)
  | 'Polly.Matthew'   // Male, US English
  | 'Polly.Ivy'       // Female, child US English
  | 'Polly.Kendra'    // Female, US English
  | 'Polly.Kimberly'  // Female, US English
  | 'Polly.Salli'     // Female, US English
  | 'Polly.Joey'      // Male, US English
  | 'Polly.Justin'    // Male, child US English
  | 'Polly.Brian'     // Male, British English
  | 'Polly.Amy'       // Female, British English
  | 'alice'           // Twilio default female
  | 'man'             // Twilio default male
  | 'woman';          // Twilio default female

/**
 * Input types for gather operations
 */
export type GatherInputType =
  | 'dtmf'            // Keypad digits only
  | 'speech'          // Voice input only
  | 'dtmf speech';    // Both keypad and voice

/**
 * Condition operators for branching logic
 */
export type ConditionOperator =
  | 'equals'          // Exact match
  | 'not_equals'      // Not equal
  | 'contains'        // String contains
  | 'starts_with'     // String starts with
  | 'ends_with'       // String ends with
  | 'in'              // Value in array
  | 'not_in'          // Value not in array
  | 'matches'         // Regex match
  | 'greater_than'    // Numeric comparison
  | 'less_than'       // Numeric comparison
  | 'greater_equal'   // Numeric comparison
  | 'less_equal'      // Numeric comparison
  | 'is_empty'        // Check if null/empty
  | 'is_not_empty';   // Check if has value

/**
 * Variable transformation functions
 */
export type VariableTransform =
  | 'uppercase'
  | 'lowercase'
  | 'trim'
  | 'digits_only'     // Extract only digits
  | 'format_phone'    // Format as phone number
  | 'to_number'       // Parse as number
  | 'to_boolean';     // Parse as boolean

// ============================================
// STEP DEFINITIONS
// ============================================

/**
 * Base step interface - all steps extend this
 */
export interface IvrStepBase {
  id: string;               // Unique step identifier
  type: IvrStepType;        // Discriminator for union type
  name?: string;            // Human-readable name for UI
  description?: string;     // Optional description/notes
}

/**
 * Say Step - Play a message to the caller
 */
export interface SayStep extends IvrStepBase {
  type: 'say';
  message: string;          // Text to speak (supports variable interpolation)
  voice?: IvrVoice;         // Voice to use
  language?: string;        // Language code (e.g., 'en-US')
  loop?: number;            // Number of times to repeat (default: 1)
  nextStepId?: string;      // Step to go to after saying
}

/**
 * Gather Step - Collect caller input (DTMF or speech)
 */
export interface GatherStep extends IvrStepBase {
  type: 'gather';
  prompt: string;           // What to say before gathering
  voice?: IvrVoice;         // Voice to use for prompt
  inputType?: GatherInputType;    // Type of input to accept
  numDigits?: number;       // Max digits to collect (for DTMF)
  timeout?: number;         // Seconds to wait for input
  finishOnKey?: string;     // Key that ends input (default: '#')
  speechTimeout?: string;   // Speech timeout ('auto' or seconds)
  speechModel?: 'default' | 'phone_call' | 'numbers_and_commands';
  hints?: string[];         // Speech recognition hints (e.g., ZIP codes)
  validResponses?: string[]; // Valid response values (validation)
  validationMessage?: string; // Message if validation fails
  maxRetries?: number;      // Max retry attempts (default: 3)
  targetVariable: string;   // Where to store the result
  nextStepId: string;       // Step to go to after gathering
  timeoutStepId?: string;   // Step to go to on timeout
  invalidStepId?: string;   // Step to go to on invalid input
}

/**
 * Transfer Step - Transfer call to a destination
 */
export interface TransferStep extends IvrStepBase {
  type: 'transfer';
  transferType: 'auction' | 'direct' | 'queue';
  directNumber?: string;    // For direct transfer: phone number
  announcement?: string;    // Message to play before transfer
  voice?: IvrVoice;
  record?: boolean;         // Whether to record the transferred call
  timeout?: number;         // Ring timeout in seconds
  fallbackStepId?: string;  // Step if transfer fails
}

/**
 * Condition Step - Branch based on variable evaluation
 */
export interface ConditionStep extends IvrStepBase {
  type: 'condition';
  variable: string;         // Variable to evaluate (e.g., 'responses.zip')
  operator: ConditionOperator;
  value: string | string[] | number | boolean;  // Value to compare against
  trueStepId: string;       // Step if condition is true
  falseStepId: string;      // Step if condition is false
}

/**
 * Qualification Step - Mark caller qualification status
 */
export interface QualificationStep extends IvrStepBase {
  type: 'qualification';
  qualifies: boolean;       // Whether caller qualifies
  reason?: string;          // Reason for qualification/disqualification
  nextStepId?: string;      // Optional next step (before transfer/hangup)
}

/**
 * Menu Step - Present options with numbered choices
 */
export interface MenuStep extends IvrStepBase {
  type: 'menu';
  prompt: string;           // Menu prompt text
  voice?: IvrVoice;
  options: MenuOption[];    // Available menu options
  timeout?: number;         // Seconds to wait for input
  maxRetries?: number;      // Max retry attempts
  invalidMessage?: string;  // Message for invalid input
  timeoutMessage?: string;  // Message on timeout
  timeoutStepId?: string;   // Step on timeout (after max retries)
  targetVariable?: string;  // Optionally store selected option
}

/**
 * Menu option definition
 */
export interface MenuOption {
  digit: string;            // DTMF digit (1-9, 0, *, #)
  label: string;            // Label for UI display
  speechAliases?: string[]; // Alternative speech phrases
  nextStepId: string;       // Step to go to when selected
}

/**
 * SetVariable Step - Store a value in flow variables
 */
export interface SetVariableStep extends IvrStepBase {
  type: 'setVariable';
  variable: string;         // Variable name to set
  value: string | number | boolean; // Static value
  transform?: VariableTransform;    // Optional transformation
  nextStepId: string;       // Next step after setting
}

/**
 * Goto Step - Jump to another step
 */
export interface GotoStep extends IvrStepBase {
  type: 'goto';
  targetStepId: string;     // Step to jump to
}

/**
 * Hangup Step - End the call
 */
export interface HangupStep extends IvrStepBase {
  type: 'hangup';
  message?: string;         // Optional farewell message
  voice?: IvrVoice;
  reason?: string;          // Reason for hangup (for logging)
}

/**
 * Webhook Step - Make external API call during flow
 */
export interface WebhookStep extends IvrStepBase {
  type: 'webhook';
  url: string;              // Webhook URL
  method: 'GET' | 'POST';   // HTTP method
  headers?: Record<string, string>; // Custom headers
  bodyTemplate?: Record<string, string>; // Body template with variable placeholders
  responseVariable?: string; // Store response in variable
  timeout?: number;         // Request timeout (ms)
  nextStepId: string;       // Step after webhook completes
  errorStepId?: string;     // Step on webhook failure
}

// ============================================
// UNION TYPE
// ============================================

/**
 * Union type of all IVR step types
 */
export type IvrStep =
  | SayStep
  | GatherStep
  | TransferStep
  | ConditionStep
  | QualificationStep
  | MenuStep
  | SetVariableStep
  | GotoStep
  | HangupStep
  | WebhookStep;

// ============================================
// FLOW DEFINITION
// ============================================

/**
 * IVR Flow configuration
 */
export interface IvrFlowConfig {
  version: string;          // Schema version (for migrations)
  name: string;             // Flow name
  description?: string;     // Flow description
  entryStepId: string;      // First step to execute
  steps: IvrStep[];         // All steps in the flow
  variables?: FlowVariableDefinition[];  // Pre-defined variables
  defaultVoice?: IvrVoice;  // Default voice for all steps
  defaultTimeout?: number;  // Default gather timeout
  maxRetries?: number;      // Default max retries
}

/**
 * Variable definition for flow
 */
export interface FlowVariableDefinition {
  name: string;             // Variable name
  type: 'string' | 'number' | 'boolean' | 'array';
  defaultValue?: string | number | boolean | string[];
  description?: string;
}

// ============================================
// EXECUTION STATE
// ============================================

/**
 * Runtime state during IVR execution
 */
export interface IvrExecutionState {
  flowId: string;           // Current flow being executed
  currentStepId: string;    // Current step ID
  previousStepId?: string;  // Previous step ID
  variables: Record<string, string | number | boolean | string[]>;
  attempts: IvrAttempt[];   // History of attempts
  capturedData: Record<string, string>;  // Data captured during flow
  startedAt: string;        // ISO timestamp
  qualifiedAt?: string;     // ISO timestamp if qualified
  disqualifiedAt?: string;  // ISO timestamp if disqualified
  qualificationReason?: string;
  errors: IvrError[];       // Errors encountered
}

/**
 * Single attempt record
 */
export interface IvrAttempt {
  stepId: string;
  stepType: IvrStepType;
  attemptNumber: number;
  input: string | null;
  timestamp: string;
  result: 'valid' | 'invalid' | 'timeout' | 'error';
  errorMessage?: string;
}

/**
 * Error record during execution
 */
export interface IvrError {
  stepId: string;
  timestamp: string;
  message: string;
  code?: string;
}

// ============================================
// API TYPES
// ============================================

/**
 * Request to create/update an IVR flow
 */
export interface CreateIvrFlowRequest {
  name: string;
  description?: string;
  serviceTypeId?: string;
  steps: IvrStep[];
  defaultTimeout?: number;
  maxRetries?: number;
  active?: boolean;
}

/**
 * Response from IVR flow API
 */
export interface IvrFlowResponse {
  id: string;
  name: string;
  description?: string;
  serviceTypeId?: string;
  steps: IvrStep[];
  defaultTimeout: number;
  maxRetries: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  // Relations
  serviceType?: {
    id: string;
    name: string;
    displayName: string;
  };
  _count?: {
    campaigns: number;
    trackingNumbers: number;
  };
}

/**
 * IVR flow list item (summary)
 */
export interface IvrFlowListItem {
  id: string;
  name: string;
  description?: string;
  serviceTypeId?: string;
  stepCount: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  serviceType?: {
    id: string;
    displayName: string;
  };
  usageCount: number;
}

// ============================================
// BUILDER UI TYPES
// ============================================

/**
 * Position of step in visual builder
 */
export interface StepPosition {
  x: number;
  y: number;
}

/**
 * Step with UI metadata for builder
 */
export interface BuilderStep {
  step: IvrStep;
  position: StepPosition;
  selected?: boolean;
  hasErrors?: boolean;
  errorMessages?: string[];
}

/**
 * Connection between steps for visual display
 */
export interface StepConnection {
  sourceStepId: string;
  targetStepId: string;
  label?: string;           // e.g., "true", "false", "option 1"
  type: 'default' | 'true' | 'false' | 'timeout' | 'error' | 'option';
}

/**
 * Builder state
 */
export interface BuilderState {
  flow: IvrFlowConfig;
  steps: BuilderStep[];
  connections: StepConnection[];
  selectedStepId?: string;
  isDirty: boolean;
  undoStack: IvrFlowConfig[];
  redoStack: IvrFlowConfig[];
}

// ============================================
// TYPE GUARDS
// ============================================

/**
 * Type guard for Say step
 */
export function isSayStep(step: IvrStep): step is SayStep {
  return step.type === 'say';
}

/**
 * Type guard for Gather step
 */
export function isGatherStep(step: IvrStep): step is GatherStep {
  return step.type === 'gather';
}

/**
 * Type guard for Transfer step
 */
export function isTransferStep(step: IvrStep): step is TransferStep {
  return step.type === 'transfer';
}

/**
 * Type guard for Condition step
 */
export function isConditionStep(step: IvrStep): step is ConditionStep {
  return step.type === 'condition';
}

/**
 * Type guard for Qualification step
 */
export function isQualificationStep(step: IvrStep): step is QualificationStep {
  return step.type === 'qualification';
}

/**
 * Type guard for Menu step
 */
export function isMenuStep(step: IvrStep): step is MenuStep {
  return step.type === 'menu';
}

/**
 * Type guard for SetVariable step
 */
export function isSetVariableStep(step: IvrStep): step is SetVariableStep {
  return step.type === 'setVariable';
}

/**
 * Type guard for Goto step
 */
export function isGotoStep(step: IvrStep): step is GotoStep {
  return step.type === 'goto';
}

/**
 * Type guard for Hangup step
 */
export function isHangupStep(step: IvrStep): step is HangupStep {
  return step.type === 'hangup';
}

/**
 * Type guard for Webhook step
 */
export function isWebhookStep(step: IvrStep): step is WebhookStep {
  return step.type === 'webhook';
}

// ============================================
// UTILITY TYPES
// ============================================

/**
 * Step metadata for UI display
 */
export const STEP_TYPE_METADATA: Record<IvrStepType, {
  label: string;
  description: string;
  icon: string;
  color: string;
}> = {
  say: {
    label: 'Say',
    description: 'Play a message to the caller',
    icon: 'MessageSquare',
    color: 'blue',
  },
  gather: {
    label: 'Gather Input',
    description: 'Collect keypad or voice input',
    icon: 'Keyboard',
    color: 'green',
  },
  transfer: {
    label: 'Transfer',
    description: 'Transfer call to destination',
    icon: 'PhoneForwarded',
    color: 'purple',
  },
  condition: {
    label: 'Condition',
    description: 'Branch based on condition',
    icon: 'GitBranch',
    color: 'orange',
  },
  qualification: {
    label: 'Qualification',
    description: 'Mark caller qualification status',
    icon: 'CheckCircle',
    color: 'emerald',
  },
  menu: {
    label: 'Menu',
    description: 'Present numbered options',
    icon: 'List',
    color: 'cyan',
  },
  setVariable: {
    label: 'Set Variable',
    description: 'Store a value',
    icon: 'Variable',
    color: 'gray',
  },
  goto: {
    label: 'Go To',
    description: 'Jump to another step',
    icon: 'ArrowRight',
    color: 'slate',
  },
  hangup: {
    label: 'Hang Up',
    description: 'End the call',
    icon: 'PhoneOff',
    color: 'red',
  },
  webhook: {
    label: 'Webhook',
    description: 'Make external API call',
    icon: 'Webhook',
    color: 'indigo',
  },
};

/**
 * Default values for new steps
 */
export const DEFAULT_STEP_VALUES: Record<IvrStepType, Partial<IvrStep>> = {
  say: {
    type: 'say',
    message: '',
    voice: 'Polly.Joanna',
  },
  gather: {
    type: 'gather',
    prompt: '',
    voice: 'Polly.Joanna',
    inputType: 'dtmf',
    numDigits: 1,
    timeout: 10,
    maxRetries: 3,
    targetVariable: 'userInput',
    nextStepId: '',
  },
  transfer: {
    type: 'transfer',
    transferType: 'auction',
    record: true,
    timeout: 30,
  },
  condition: {
    type: 'condition',
    variable: '',
    operator: 'equals',
    value: '',
    trueStepId: '',
    falseStepId: '',
  },
  qualification: {
    type: 'qualification',
    qualifies: true,
  },
  menu: {
    type: 'menu',
    prompt: '',
    voice: 'Polly.Joanna',
    options: [],
    timeout: 10,
    maxRetries: 3,
  },
  setVariable: {
    type: 'setVariable',
    variable: '',
    value: '',
    nextStepId: '',
  },
  goto: {
    type: 'goto',
    targetStepId: '',
  },
  hangup: {
    type: 'hangup',
    voice: 'Polly.Joanna',
  },
  webhook: {
    type: 'webhook',
    url: '',
    method: 'POST',
    timeout: 5000,
    nextStepId: '',
  },
};
