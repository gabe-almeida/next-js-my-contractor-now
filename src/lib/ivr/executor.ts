/**
 * IVR Flow Executor
 *
 * WHY: Processes IVR flows step-by-step, generating TwiML for each step
 *      and tracking state across webhook callbacks.
 *
 * WHEN: Called by IVR webhook handlers to:
 *   - Start a new IVR flow
 *   - Process user input and advance to next step
 *   - Generate appropriate TwiML responses
 *
 * HOW:
 *   1. Load flow configuration from database
 *   2. Track execution state in call.ivrResponses JSON
 *   3. Evaluate conditions and route to appropriate steps
 *   4. Generate TwiML for current step
 *   5. Handle retries, timeouts, and errors
 */

import { twiml } from 'twilio';
import { logger } from '@/lib/logger';
import type {
  IvrStep,
  IvrFlowConfig,
  IvrExecutionState,
  IvrAttempt,
  SayStep,
  GatherStep,
  TransferStep,
  ConditionStep,
  QualificationStep,
  MenuStep,
  SetVariableStep,
  GotoStep,
  HangupStep,
  WebhookStep,
  IvrVoice,
  ConditionOperator,
} from '@/types/ivr';

// ============================================
// CONSTANTS
// ============================================

const DEFAULT_VOICE: IvrVoice = 'Polly.Joanna';
const DEFAULT_TIMEOUT = 10;
const DEFAULT_MAX_RETRIES = 3;

// ============================================
// TYPES
// ============================================

export interface ExecutorContext {
  callId: string;
  callSid: string;
  baseUrl: string;
  flow: IvrFlowConfig;
  state: IvrExecutionState;
  callerPhone?: string;
  callerZip?: string;
}

export interface ExecutionResult {
  twiml: string;
  state: IvrExecutionState;
  isComplete: boolean;
  isQualified?: boolean;
  shouldTransfer?: boolean;
  transferType?: 'auction' | 'direct' | 'queue';
  directTransferNumber?: string;
}

// ============================================
// MAIN EXECUTOR CLASS
// ============================================

export class IvrExecutor {
  private context: ExecutorContext;
  private response: twiml.VoiceResponse;

  constructor(context: ExecutorContext) {
    this.context = context;
    this.response = new twiml.VoiceResponse();
  }

  /**
   * Execute the current step and return TwiML
   */
  async execute(
    input?: string,
    inputType: 'dtmf' | 'speech' | 'timeout' = 'dtmf'
  ): Promise<ExecutionResult> {
    const { flow, state } = this.context;
    const step = this.findStep(state.currentStepId);

    if (!step) {
      logger.error({
        event: 'ivr.executor.step_not_found',
        callId: this.context.callId,
        stepId: state.currentStepId,
      });
      return this.buildErrorResult('Step not found');
    }

    logger.info({
      event: 'ivr.executor.executing_step',
      callId: this.context.callId,
      stepId: step.id,
      stepType: step.type,
      input,
      inputType,
    });

    try {
      return await this.executeStep(step, input, inputType);
    } catch (error) {
      logger.error({
        event: 'ivr.executor.step_error',
        callId: this.context.callId,
        stepId: step.id,
        error: (error as Error).message,
      });
      return this.buildErrorResult((error as Error).message);
    }
  }

  /**
   * Start execution from the entry step
   */
  async start(): Promise<ExecutionResult> {
    const { flow } = this.context;

    // Initialize state
    this.context.state = {
      flowId: flow.name,
      currentStepId: flow.entryStepId,
      variables: this.initializeVariables(),
      attempts: [],
      capturedData: {},
      startedAt: new Date().toISOString(),
      errors: [],
    };

    return this.execute();
  }

  // ============================================
  // STEP EXECUTION
  // ============================================

  private async executeStep(
    step: IvrStep,
    input?: string,
    inputType: 'dtmf' | 'speech' | 'timeout' = 'dtmf'
  ): Promise<ExecutionResult> {
    switch (step.type) {
      case 'say':
        return this.executeSayStep(step as SayStep);
      case 'gather':
        return this.executeGatherStep(step as GatherStep, input, inputType);
      case 'transfer':
        return this.executeTransferStep(step as TransferStep);
      case 'condition':
        return this.executeConditionStep(step as ConditionStep);
      case 'qualification':
        return this.executeQualificationStep(step as QualificationStep);
      case 'menu':
        return this.executeMenuStep(step as MenuStep, input, inputType);
      case 'setVariable':
        return this.executeSetVariableStep(step as SetVariableStep);
      case 'goto':
        return this.executeGotoStep(step as GotoStep);
      case 'hangup':
        return this.executeHangupStep(step as HangupStep);
      case 'webhook':
        return this.executeWebhookStep(step as WebhookStep);
      default:
        return this.buildErrorResult(`Unknown step type: ${(step as IvrStep).type}`);
    }
  }

  /**
   * Execute Say step - play message and continue to next step
   */
  private async executeSayStep(step: SayStep): Promise<ExecutionResult> {
    const voice = step.voice || this.context.flow.defaultVoice || DEFAULT_VOICE;
    const message = this.interpolateVariables(step.message);

    this.response.say({ voice }, message);

    if (step.nextStepId) {
      // Continue to next step via redirect
      this.context.state.currentStepId = step.nextStepId;
      const nextStep = this.findStep(step.nextStepId);

      if (nextStep) {
        return this.executeStep(nextStep);
      }
    }

    return this.buildResult(false);
  }

  /**
   * Execute Gather step - collect input or process received input
   */
  private async executeGatherStep(
    step: GatherStep,
    input?: string,
    inputType: 'dtmf' | 'speech' | 'timeout' = 'dtmf'
  ): Promise<ExecutionResult> {
    const attemptCount = this.getAttemptCount(step.id);
    const maxRetries = step.maxRetries ?? this.context.flow.maxRetries ?? DEFAULT_MAX_RETRIES;

    // If no input yet, prompt for input
    if (input === undefined) {
      return this.buildGatherPrompt(step, attemptCount);
    }

    // Handle timeout
    if (inputType === 'timeout' || input === '') {
      return await this.handleGatherTimeout(step, attemptCount, maxRetries);
    }

    // Validate input if validation rules exist
    if (step.validResponses && step.validResponses.length > 0) {
      if (!step.validResponses.includes(input)) {
        return await this.handleGatherInvalid(step, input, attemptCount, maxRetries);
      }
    }

    // Store input and proceed
    this.recordAttempt(step.id, step.type, attemptCount + 1, input, 'valid');
    this.context.state.variables[step.targetVariable] = input;
    this.context.state.capturedData[step.targetVariable] = input;
    this.context.state.currentStepId = step.nextStepId;

    const nextStep = this.findStep(step.nextStepId);
    if (nextStep) {
      return this.executeStep(nextStep);
    }

    return this.buildResult(false);
  }

  /**
   * Execute Transfer step - prepare for call transfer
   */
  private async executeTransferStep(step: TransferStep): Promise<ExecutionResult> {
    const voice = step.voice || this.context.flow.defaultVoice || DEFAULT_VOICE;

    if (step.announcement) {
      const message = this.interpolateVariables(step.announcement);
      this.response.say({ voice }, message);
    }

    // Mark as ready for transfer
    return {
      twiml: this.response.toString(),
      state: this.context.state,
      isComplete: true,
      isQualified: true,
      shouldTransfer: true,
      transferType: step.transferType,
      directTransferNumber: step.directNumber,
    };
  }

  /**
   * Execute Condition step - evaluate and branch
   */
  private async executeConditionStep(step: ConditionStep): Promise<ExecutionResult> {
    const variableValue = this.getVariable(step.variable);
    const result = this.evaluateCondition(variableValue, step.operator, step.value);

    logger.debug({
      event: 'ivr.executor.condition_evaluated',
      callId: this.context.callId,
      variable: step.variable,
      variableValue,
      operator: step.operator,
      compareValue: step.value,
      result,
    });

    const nextStepId = result ? step.trueStepId : step.falseStepId;
    this.context.state.currentStepId = nextStepId;

    const nextStep = this.findStep(nextStepId);
    if (nextStep) {
      return this.executeStep(nextStep);
    }

    return this.buildErrorResult(`Condition target step not found: ${nextStepId}`);
  }

  /**
   * Execute Qualification step - mark qualification status
   */
  private async executeQualificationStep(step: QualificationStep): Promise<ExecutionResult> {
    const now = new Date().toISOString();

    if (step.qualifies) {
      this.context.state.qualifiedAt = now;
      this.context.state.qualificationReason = step.reason || 'Passed IVR qualification';
    } else {
      this.context.state.disqualifiedAt = now;
      this.context.state.qualificationReason = step.reason || 'Failed IVR qualification';
    }

    logger.info({
      event: 'ivr.executor.qualification',
      callId: this.context.callId,
      qualifies: step.qualifies,
      reason: step.reason,
    });

    if (step.nextStepId) {
      this.context.state.currentStepId = step.nextStepId;
      const nextStep = this.findStep(step.nextStepId);
      if (nextStep) {
        return this.executeStep(nextStep);
      }
    }

    // No next step - this is the end
    return {
      twiml: this.response.toString(),
      state: this.context.state,
      isComplete: true,
      isQualified: step.qualifies,
    };
  }

  /**
   * Execute Menu step - present options or process selection
   */
  private async executeMenuStep(
    step: MenuStep,
    input?: string,
    inputType: 'dtmf' | 'speech' | 'timeout' = 'dtmf'
  ): Promise<ExecutionResult> {
    const attemptCount = this.getAttemptCount(step.id);
    const maxRetries = step.maxRetries ?? this.context.flow.maxRetries ?? DEFAULT_MAX_RETRIES;
    const voice = step.voice || this.context.flow.defaultVoice || DEFAULT_VOICE;

    // If no input yet, show menu
    if (input === undefined) {
      return this.buildMenuPrompt(step);
    }

    // Handle timeout
    if (inputType === 'timeout' || input === '') {
      if (attemptCount >= maxRetries) {
        if (step.timeoutStepId) {
          this.context.state.currentStepId = step.timeoutStepId;
          const nextStep = this.findStep(step.timeoutStepId);
          if (nextStep) {
            return this.executeStep(nextStep);
          }
        }
        return this.buildHangupResult('Menu timeout exceeded');
      }

      this.recordAttempt(step.id, step.type, attemptCount + 1, null, 'timeout');
      const message = step.timeoutMessage || "We didn't receive your selection.";
      this.response.say({ voice }, message);
      return this.buildMenuPrompt(step);
    }

    // Find matching option
    const selectedOption = step.options.find((opt) => opt.digit === input);

    if (!selectedOption) {
      if (attemptCount >= maxRetries) {
        if (step.timeoutStepId) {
          this.context.state.currentStepId = step.timeoutStepId;
          const nextStep = this.findStep(step.timeoutStepId);
          if (nextStep) {
            return this.executeStep(nextStep);
          }
        }
        return this.buildHangupResult('Menu max attempts exceeded');
      }

      this.recordAttempt(step.id, step.type, attemptCount + 1, input, 'invalid');
      const message = step.invalidMessage || "That wasn't a valid option.";
      this.response.say({ voice }, message);
      return this.buildMenuPrompt(step);
    }

    // Valid selection
    this.recordAttempt(step.id, step.type, attemptCount + 1, input, 'valid');

    if (step.targetVariable) {
      this.context.state.variables[step.targetVariable] = selectedOption.digit;
      this.context.state.capturedData[step.targetVariable] = selectedOption.digit;
    }

    this.context.state.currentStepId = selectedOption.nextStepId;
    const nextStep = this.findStep(selectedOption.nextStepId);
    if (nextStep) {
      return this.executeStep(nextStep);
    }

    return this.buildResult(false);
  }

  /**
   * Execute SetVariable step - store a value
   */
  private async executeSetVariableStep(step: SetVariableStep): Promise<ExecutionResult> {
    let value: string | number | boolean = step.value;

    // Apply transformation if specified
    if (step.transform && typeof value === 'string') {
      value = this.applyTransform(value, step.transform);
    }

    this.context.state.variables[step.variable] = value;

    this.context.state.currentStepId = step.nextStepId;
    const nextStep = this.findStep(step.nextStepId);
    if (nextStep) {
      return this.executeStep(nextStep);
    }

    return this.buildResult(false);
  }

  /**
   * Execute Goto step - jump to target
   */
  private async executeGotoStep(step: GotoStep): Promise<ExecutionResult> {
    this.context.state.currentStepId = step.targetStepId;
    const nextStep = this.findStep(step.targetStepId);
    if (nextStep) {
      return this.executeStep(nextStep);
    }

    return this.buildErrorResult(`Goto target step not found: ${step.targetStepId}`);
  }

  /**
   * Execute Hangup step - end the call
   */
  private async executeHangupStep(step: HangupStep): Promise<ExecutionResult> {
    const voice = step.voice || this.context.flow.defaultVoice || DEFAULT_VOICE;

    if (step.message) {
      const message = this.interpolateVariables(step.message);
      this.response.say({ voice }, message);
    }

    this.response.hangup();

    return {
      twiml: this.response.toString(),
      state: this.context.state,
      isComplete: true,
      isQualified: false,
    };
  }

  /**
   * Execute Webhook step - make external API call
   */
  private async executeWebhookStep(step: WebhookStep): Promise<ExecutionResult> {
    try {
      const url = this.interpolateVariables(step.url);
      const body = step.bodyTemplate
        ? this.interpolateObject(step.bodyTemplate)
        : undefined;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), step.timeout || 5000);

      const response = await fetch(url, {
        method: step.method,
        headers: {
          'Content-Type': 'application/json',
          ...step.headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (step.responseVariable) {
        const data = await response.json();
        this.context.state.variables[step.responseVariable] = JSON.stringify(data);
      }

      this.context.state.currentStepId = step.nextStepId;
      const nextStep = this.findStep(step.nextStepId);
      if (nextStep) {
        return this.executeStep(nextStep);
      }

      return this.buildResult(false);
    } catch (error) {
      logger.error({
        event: 'ivr.executor.webhook_error',
        callId: this.context.callId,
        url: step.url,
        error: (error as Error).message,
      });

      if (step.errorStepId) {
        this.context.state.currentStepId = step.errorStepId;
        const errorStep = this.findStep(step.errorStepId);
        if (errorStep) {
          return this.executeStep(errorStep);
        }
      }

      // Continue to next step even on error
      this.context.state.currentStepId = step.nextStepId;
      const nextStep = this.findStep(step.nextStepId);
      if (nextStep) {
        return this.executeStep(nextStep);
      }

      return this.buildResult(false);
    }
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private findStep(stepId: string): IvrStep | undefined {
    return this.context.flow.steps.find((s) => s.id === stepId);
  }

  private initializeVariables(): Record<string, string | number | boolean | string[]> {
    const variables: Record<string, string | number | boolean | string[]> = {};

    // Initialize from flow definitions
    if (this.context.flow.variables) {
      for (const def of this.context.flow.variables) {
        if (def.defaultValue !== undefined) {
          variables[def.name] = def.defaultValue;
        }
      }
    }

    // Add caller info
    if (this.context.callerPhone) {
      variables['caller_phone'] = this.context.callerPhone;
    }
    if (this.context.callerZip) {
      variables['caller_zip'] = this.context.callerZip;
    }

    return variables;
  }

  private getVariable(path: string): string | number | boolean | string[] | undefined {
    // Support dot notation: responses.zip, caller.phone
    const parts = path.split('.');
    let current: unknown = this.context.state.variables;

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current as string | number | boolean | string[] | undefined;
  }

  private evaluateCondition(
    value: string | number | boolean | string[] | undefined,
    operator: ConditionOperator,
    compareValue: string | string[] | number | boolean
  ): boolean {
    switch (operator) {
      case 'equals':
        return String(value) === String(compareValue);
      case 'not_equals':
        return String(value) !== String(compareValue);
      case 'contains':
        return String(value).includes(String(compareValue));
      case 'starts_with':
        return String(value).startsWith(String(compareValue));
      case 'ends_with':
        return String(value).endsWith(String(compareValue));
      case 'in':
        return Array.isArray(compareValue) && compareValue.includes(String(value));
      case 'not_in':
        return Array.isArray(compareValue) && !compareValue.includes(String(value));
      case 'matches':
        return new RegExp(String(compareValue)).test(String(value));
      case 'greater_than':
        return Number(value) > Number(compareValue);
      case 'less_than':
        return Number(value) < Number(compareValue);
      case 'greater_equal':
        return Number(value) >= Number(compareValue);
      case 'less_equal':
        return Number(value) <= Number(compareValue);
      case 'is_empty':
        return value === undefined || value === '' || value === null;
      case 'is_not_empty':
        return value !== undefined && value !== '' && value !== null;
      default:
        return false;
    }
  }

  private interpolateVariables(text: string): string {
    return text.replace(/\{\{([^}]+)\}\}/g, (_, path) => {
      const value = this.getVariable(path.trim());
      return value !== undefined ? String(value) : '';
    });
  }

  private interpolateObject(obj: Record<string, string>): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = this.interpolateVariables(value);
    }
    return result;
  }

  private applyTransform(value: string, transform: string): string {
    switch (transform) {
      case 'uppercase':
        return value.toUpperCase();
      case 'lowercase':
        return value.toLowerCase();
      case 'trim':
        return value.trim();
      case 'digits_only':
        return value.replace(/\D/g, '');
      case 'format_phone':
        const digits = value.replace(/\D/g, '');
        if (digits.length === 10) {
          return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
        }
        return value;
      default:
        return value;
    }
  }

  private getAttemptCount(stepId: string): number {
    return this.context.state.attempts.filter((a) => a.stepId === stepId).length;
  }

  private recordAttempt(
    stepId: string,
    stepType: string,
    attemptNumber: number,
    input: string | null,
    result: 'valid' | 'invalid' | 'timeout' | 'error',
    errorMessage?: string
  ): void {
    this.context.state.attempts.push({
      stepId,
      stepType: stepType as IvrAttempt['stepType'],
      attemptNumber,
      input,
      timestamp: new Date().toISOString(),
      result,
      errorMessage,
    });
  }

  // ============================================
  // TWIML BUILDERS
  // ============================================

  private buildGatherPrompt(step: GatherStep, attemptCount: number): ExecutionResult {
    const voice = step.voice || this.context.flow.defaultVoice || DEFAULT_VOICE;
    const timeout = step.timeout ?? this.context.flow.defaultTimeout ?? DEFAULT_TIMEOUT;
    const prompt = this.interpolateVariables(step.prompt);

    const gatherOptions: Record<string, unknown> = {
      action: `${this.context.baseUrl}/api/calls/ivr/advanced?callId=${this.context.callId}&stepId=${step.id}&attempt=${attemptCount + 1}`,
      method: 'POST',
      timeout,
    };

    // Configure input type
    if (step.inputType === 'speech' || step.inputType === 'dtmf speech') {
      gatherOptions.input = step.inputType;
      if (step.speechTimeout) {
        gatherOptions.speechTimeout = step.speechTimeout;
      }
      if (step.speechModel) {
        gatherOptions.speechModel = step.speechModel;
      }
      if (step.hints && step.hints.length > 0) {
        gatherOptions.hints = step.hints.join(', ');
      }
    } else {
      gatherOptions.input = 'dtmf';
      if (step.numDigits) {
        gatherOptions.numDigits = step.numDigits;
      }
      if (step.finishOnKey) {
        gatherOptions.finishOnKey = step.finishOnKey;
      }
    }

    const gather = this.response.gather(gatherOptions);
    gather.say({ voice }, prompt);

    // Fallback if no input
    this.response.redirect(
      { method: 'POST' },
      `${this.context.baseUrl}/api/calls/ivr/advanced?callId=${this.context.callId}&stepId=${step.id}&attempt=${attemptCount + 1}&timeout=1`
    );

    return this.buildResult(false);
  }

  private async handleGatherTimeout(
    step: GatherStep,
    attemptCount: number,
    maxRetries: number
  ): Promise<ExecutionResult> {
    const voice = step.voice || this.context.flow.defaultVoice || DEFAULT_VOICE;

    if (attemptCount >= maxRetries) {
      this.recordAttempt(step.id, step.type, attemptCount + 1, null, 'timeout');

      if (step.timeoutStepId) {
        this.context.state.currentStepId = step.timeoutStepId;
        const nextStep = this.findStep(step.timeoutStepId);
        if (nextStep) {
          return await this.executeStep(nextStep);
        }
      }

      return this.buildHangupResult('Gather timeout exceeded');
    }

    this.recordAttempt(step.id, step.type, attemptCount + 1, null, 'timeout');
    this.response.say({ voice }, "We didn't receive a response.");
    return this.buildGatherPrompt(step, attemptCount + 1);
  }

  private async handleGatherInvalid(
    step: GatherStep,
    input: string,
    attemptCount: number,
    maxRetries: number
  ): Promise<ExecutionResult> {
    const voice = step.voice || this.context.flow.defaultVoice || DEFAULT_VOICE;

    if (attemptCount >= maxRetries) {
      this.recordAttempt(step.id, step.type, attemptCount + 1, input, 'invalid');

      if (step.invalidStepId) {
        this.context.state.currentStepId = step.invalidStepId;
        const nextStep = this.findStep(step.invalidStepId);
        if (nextStep) {
          return await this.executeStep(nextStep);
        }
      }

      return this.buildHangupResult('Gather max attempts exceeded');
    }

    this.recordAttempt(step.id, step.type, attemptCount + 1, input, 'invalid');
    const message = step.validationMessage || "That wasn't a valid response.";
    this.response.say({ voice }, message);
    return this.buildGatherPrompt(step, attemptCount + 1);
  }

  private buildMenuPrompt(step: MenuStep): ExecutionResult {
    const voice = step.voice || this.context.flow.defaultVoice || DEFAULT_VOICE;
    const timeout = step.timeout ?? this.context.flow.defaultTimeout ?? DEFAULT_TIMEOUT;
    const attemptCount = this.getAttemptCount(step.id);
    const prompt = this.interpolateVariables(step.prompt);

    const gatherOptions = {
      action: `${this.context.baseUrl}/api/calls/ivr/advanced?callId=${this.context.callId}&stepId=${step.id}&attempt=${attemptCount + 1}`,
      method: 'POST',
      numDigits: 1,
      timeout,
    };

    const gather = this.response.gather(gatherOptions);
    gather.say({ voice }, prompt);

    // Fallback if no input
    this.response.redirect(
      { method: 'POST' },
      `${this.context.baseUrl}/api/calls/ivr/advanced?callId=${this.context.callId}&stepId=${step.id}&attempt=${attemptCount + 1}&timeout=1`
    );

    return this.buildResult(false);
  }

  private buildResult(isComplete: boolean): ExecutionResult {
    return {
      twiml: this.response.toString(),
      state: this.context.state,
      isComplete,
    };
  }

  private buildErrorResult(message: string): ExecutionResult {
    const voice = this.context.flow.defaultVoice || DEFAULT_VOICE;

    this.context.state.errors.push({
      stepId: this.context.state.currentStepId,
      timestamp: new Date().toISOString(),
      message,
    });

    this.response.say(
      { voice },
      "We're sorry, we're experiencing technical difficulties. Please try your call again later."
    );
    this.response.hangup();

    return {
      twiml: this.response.toString(),
      state: this.context.state,
      isComplete: true,
      isQualified: false,
    };
  }

  private buildHangupResult(reason: string): ExecutionResult {
    const voice = this.context.flow.defaultVoice || DEFAULT_VOICE;

    this.response.say(
      { voice },
      "We're having trouble receiving your response. Please call back later. Goodbye."
    );
    this.response.hangup();

    return {
      twiml: this.response.toString(),
      state: this.context.state,
      isComplete: true,
      isQualified: false,
    };
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Parse IVR flow from database JSON
 */
export function parseIvrFlow(stepsJson: unknown): IvrFlowConfig {
  // If already parsed as array, wrap in config
  if (Array.isArray(stepsJson)) {
    return {
      version: '1.0',
      name: 'default',
      entryStepId: stepsJson.length > 0 ? stepsJson[0].id : '',
      steps: stepsJson as IvrStep[],
    };
  }

  // If it's a full config object
  if (typeof stepsJson === 'object' && stepsJson !== null) {
    const config = stepsJson as Record<string, unknown>;
    if ('steps' in config && Array.isArray(config.steps)) {
      return {
        version: String(config.version || '1.0'),
        name: String(config.name || 'default'),
        entryStepId: String(config.entryStepId || (config.steps[0] as IvrStep)?.id || ''),
        steps: config.steps as IvrStep[],
        variables: config.variables as IvrFlowConfig['variables'],
        defaultVoice: config.defaultVoice as IvrVoice,
        defaultTimeout: config.defaultTimeout as number,
        maxRetries: config.maxRetries as number,
      };
    }
  }

  throw new Error('Invalid IVR flow configuration');
}

/**
 * Validate IVR flow configuration
 */
export function validateIvrFlow(flow: IvrFlowConfig): string[] {
  const errors: string[] = [];

  if (!flow.entryStepId) {
    errors.push('Flow must have an entry step');
  }

  if (!flow.steps || flow.steps.length === 0) {
    errors.push('Flow must have at least one step');
  }

  // Check entry step exists
  const entryStep = flow.steps.find((s) => s.id === flow.entryStepId);
  if (!entryStep) {
    errors.push(`Entry step "${flow.entryStepId}" not found`);
  }

  // Validate each step
  const stepIds = new Set(flow.steps.map((s) => s.id));

  for (const step of flow.steps) {
    // Check required step references exist
    if ('nextStepId' in step && step.nextStepId && !stepIds.has(step.nextStepId)) {
      errors.push(`Step "${step.id}" references non-existent step "${step.nextStepId}"`);
    }

    if ('trueStepId' in step && !stepIds.has(step.trueStepId)) {
      errors.push(`Condition "${step.id}" trueStepId references non-existent step`);
    }

    if ('falseStepId' in step && !stepIds.has(step.falseStepId)) {
      errors.push(`Condition "${step.id}" falseStepId references non-existent step`);
    }

    if ('targetStepId' in step && !stepIds.has(step.targetStepId)) {
      errors.push(`Goto "${step.id}" references non-existent step`);
    }

    // Validate menu options
    if (step.type === 'menu') {
      const menuStep = step as MenuStep;
      for (const option of menuStep.options) {
        if (!stepIds.has(option.nextStepId)) {
          errors.push(`Menu "${step.id}" option "${option.digit}" references non-existent step`);
        }
      }
    }
  }

  return errors;
}
