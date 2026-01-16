'use client';

/**
 * IVR Builder - Visual IVR flow builder component
 *
 * WHY: Allows admins to visually create and edit IVR qualification flows
 *      without writing code or understanding TwiML.
 *
 * WHEN: Used on IVR flow create/edit pages to configure call flows.
 *
 * HOW: Provides a step-based interface with:
 *   - Step palette (drag to add)
 *   - Step list (visual flow)
 *   - Property editor (configure selected step)
 *   - Preview panel (see flow logic)
 */

import { useState, useCallback, useMemo } from 'react';
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  MessageSquare,
  Keyboard,
  PhoneForwarded,
  GitBranch,
  CheckCircle,
  List,
  Variable,
  ArrowRight,
  PhoneOff,
  Webhook,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Save,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type {
  IvrStep,
  IvrStepType,
  SayStep,
  GatherStep,
  TransferStep,
  ConditionStep,
  QualificationStep,
  MenuStep,
  SetVariableStep,
  GotoStep,
  HangupStep,
  MenuOption,
  IvrVoice,
  ConditionOperator,
  GatherInputType,
} from '@/types/ivr';

// ============================================
// CONSTANTS
// ============================================

const STEP_TYPES: { type: IvrStepType; label: string; icon: React.ElementType; description: string }[] = [
  { type: 'say', label: 'Say', icon: MessageSquare, description: 'Play a message' },
  { type: 'gather', label: 'Gather', icon: Keyboard, description: 'Collect input' },
  { type: 'menu', label: 'Menu', icon: List, description: 'Present options' },
  { type: 'condition', label: 'Condition', icon: GitBranch, description: 'Branch logic' },
  { type: 'qualification', label: 'Qualify', icon: CheckCircle, description: 'Qualify/disqualify' },
  { type: 'transfer', label: 'Transfer', icon: PhoneForwarded, description: 'Transfer call' },
  { type: 'setVariable', label: 'Set Variable', icon: Variable, description: 'Store value' },
  { type: 'goto', label: 'Go To', icon: ArrowRight, description: 'Jump to step' },
  { type: 'hangup', label: 'Hang Up', icon: PhoneOff, description: 'End call' },
];

const VOICE_OPTIONS: { value: IvrVoice; label: string }[] = [
  { value: 'Polly.Joanna', label: 'Joanna (US Female)' },
  { value: 'Polly.Matthew', label: 'Matthew (US Male)' },
  { value: 'Polly.Kendra', label: 'Kendra (US Female)' },
  { value: 'Polly.Joey', label: 'Joey (US Male)' },
  { value: 'Polly.Amy', label: 'Amy (UK Female)' },
  { value: 'Polly.Brian', label: 'Brian (UK Male)' },
];

const CONDITION_OPERATORS: { value: ConditionOperator; label: string }[] = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not Equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'in', label: 'In List' },
  { value: 'greater_than', label: 'Greater Than' },
  { value: 'less_than', label: 'Less Than' },
  { value: 'is_empty', label: 'Is Empty' },
  { value: 'is_not_empty', label: 'Is Not Empty' },
];

const INPUT_TYPES: { value: GatherInputType; label: string }[] = [
  { value: 'dtmf', label: 'Keypad Only (DTMF)' },
  { value: 'speech', label: 'Voice Only' },
  { value: 'dtmf speech', label: 'Keypad + Voice' },
];

// ============================================
// TYPES
// ============================================

interface IvrBuilderProps {
  steps: IvrStep[];
  onChange: (steps: IvrStep[]) => void;
  onSave?: () => void;
  isSaving?: boolean;
  errors?: string[];
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function generateStepId(): string {
  return `step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function createDefaultStep(type: IvrStepType): IvrStep {
  const id = generateStepId();
  const baseStep = { id, name: `New ${type} step` };

  switch (type) {
    case 'say':
      return { ...baseStep, type: 'say', message: 'Hello, thank you for calling.' } as SayStep;
    case 'gather':
      return {
        ...baseStep,
        type: 'gather',
        prompt: 'Press 1 for yes, press 2 for no.',
        inputType: 'dtmf',
        numDigits: 1,
        timeout: 10,
        maxRetries: 3,
        targetVariable: 'userInput',
        nextStepId: '',
      } as GatherStep;
    case 'transfer':
      return {
        ...baseStep,
        type: 'transfer',
        transferType: 'auction',
        record: true,
        timeout: 30,
      } as TransferStep;
    case 'condition':
      return {
        ...baseStep,
        type: 'condition',
        variable: '',
        operator: 'equals',
        value: '',
        trueStepId: '',
        falseStepId: '',
      } as ConditionStep;
    case 'qualification':
      return {
        ...baseStep,
        type: 'qualification',
        qualifies: true,
        reason: 'Caller qualified',
      } as QualificationStep;
    case 'menu':
      return {
        ...baseStep,
        type: 'menu',
        prompt: 'Please select an option.',
        options: [],
        timeout: 10,
        maxRetries: 3,
      } as MenuStep;
    case 'setVariable':
      return {
        ...baseStep,
        type: 'setVariable',
        variable: '',
        value: '',
        nextStepId: '',
      } as SetVariableStep;
    case 'goto':
      return {
        ...baseStep,
        type: 'goto',
        targetStepId: '',
      } as GotoStep;
    case 'hangup':
      return {
        ...baseStep,
        type: 'hangup',
        message: 'Thank you for calling. Goodbye.',
      } as HangupStep;
    default:
      return { ...baseStep, type: 'say', message: '' } as SayStep;
  }
}

function getStepIcon(type: IvrStepType): React.ElementType {
  const stepType = STEP_TYPES.find(s => s.type === type);
  return stepType?.icon || MessageSquare;
}

// ============================================
// SUB-COMPONENTS
// ============================================

interface StepPaletteProps {
  onAddStep: (type: IvrStepType) => void;
}

function StepPalette({ onAddStep }: StepPaletteProps) {
  return (
    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
      <h3 className="text-sm font-medium text-gray-700 mb-3">Add Step</h3>
      <div className="grid grid-cols-3 gap-2">
        {STEP_TYPES.map((stepType) => {
          const Icon = stepType.icon;
          return (
            <button
              key={stepType.type}
              onClick={() => onAddStep(stepType.type)}
              className="flex flex-col items-center p-2 rounded-lg border border-gray-200 bg-white
                         hover:border-orange-300 hover:bg-orange-50 transition-colors text-center"
              title={stepType.description}
            >
              <Icon className="h-5 w-5 text-gray-600 mb-1" />
              <span className="text-xs text-gray-600">{stepType.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface StepListItemProps {
  step: IvrStep;
  index: number;
  isSelected: boolean;
  isFirst: boolean;
  isLast: boolean;
  onSelect: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}

function StepListItem({
  step,
  index,
  isSelected,
  isFirst,
  isLast,
  onSelect,
  onMoveUp,
  onMoveDown,
  onDelete,
}: StepListItemProps) {
  const Icon = getStepIcon(step.type);

  return (
    <div
      onClick={onSelect}
      className={`
        flex items-center gap-3 p-3 rounded-lg border cursor-pointer
        transition-all duration-150
        ${isSelected
          ? 'border-orange-500 bg-orange-50 ring-2 ring-orange-500/20'
          : 'border-gray-200 bg-white hover:border-gray-300'}
      `}
    >
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100">
        <span className="text-xs font-medium text-gray-600">{index + 1}</span>
      </div>

      <Icon className={`h-5 w-5 ${isSelected ? 'text-orange-600' : 'text-gray-500'}`} />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {step.name || `${step.type} step`}
        </p>
        <p className="text-xs text-gray-500 truncate">
          {getStepSummary(step)}
        </p>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
          disabled={isFirst}
          className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
          title="Move up"
        >
          <ArrowUp className="h-4 w-4 text-gray-500" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
          disabled={isLast}
          className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
          title="Move down"
        >
          <ArrowDown className="h-4 w-4 text-gray-500" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1 rounded hover:bg-red-50"
          title="Delete"
        >
          <Trash2 className="h-4 w-4 text-red-500" />
        </button>
      </div>
    </div>
  );
}

function getStepSummary(step: IvrStep): string {
  switch (step.type) {
    case 'say':
      return (step as SayStep).message?.substring(0, 50) || 'No message';
    case 'gather':
      return (step as GatherStep).prompt?.substring(0, 50) || 'No prompt';
    case 'transfer':
      return `Transfer to ${(step as TransferStep).transferType}`;
    case 'condition':
      return `If ${(step as ConditionStep).variable} ${(step as ConditionStep).operator}`;
    case 'qualification':
      return (step as QualificationStep).qualifies ? 'Qualify caller' : 'Disqualify caller';
    case 'menu':
      return `${(step as MenuStep).options?.length || 0} options`;
    case 'setVariable':
      return `Set ${(step as SetVariableStep).variable}`;
    case 'goto':
      return `Jump to step`;
    case 'hangup':
      return 'End call';
    default:
      return step.type;
  }
}

// ============================================
// PROPERTY EDITORS
// ============================================

interface StepEditorProps {
  step: IvrStep;
  allSteps: IvrStep[];
  onChange: (step: IvrStep) => void;
}

function SayStepEditor({ step, onChange }: StepEditorProps) {
  const sayStep = step as SayStep;

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Step Name</label>
        <input
          type="text"
          value={sayStep.name || ''}
          onChange={(e) => onChange({ ...sayStep, name: e.target.value })}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                     focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
          placeholder="e.g., Welcome Message"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Message *</label>
        <textarea
          value={sayStep.message}
          onChange={(e) => onChange({ ...sayStep, message: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                     focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
          placeholder="The message to speak to the caller..."
        />
        <p className="mt-1 text-xs text-gray-500">
          Use {"{{variable}}"} for dynamic values
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Voice</label>
        <select
          value={sayStep.voice || 'Polly.Joanna'}
          onChange={(e) => onChange({ ...sayStep, voice: e.target.value as IvrVoice })}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                     focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
        >
          {VOICE_OPTIONS.map((v) => (
            <option key={v.value} value={v.value}>{v.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

function GatherStepEditor({ step, allSteps, onChange }: StepEditorProps) {
  const gatherStep = step as GatherStep;

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Step Name</label>
        <input
          type="text"
          value={gatherStep.name || ''}
          onChange={(e) => onChange({ ...gatherStep, name: e.target.value })}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                     focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Prompt *</label>
        <textarea
          value={gatherStep.prompt}
          onChange={(e) => onChange({ ...gatherStep, prompt: e.target.value })}
          rows={2}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                     focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Input Type</label>
          <select
            value={gatherStep.inputType || 'dtmf'}
            onChange={(e) => onChange({ ...gatherStep, inputType: e.target.value as GatherInputType })}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
          >
            {INPUT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Max Digits</label>
          <input
            type="number"
            value={gatherStep.numDigits || ''}
            onChange={(e) => onChange({ ...gatherStep, numDigits: parseInt(e.target.value) || undefined })}
            min={1}
            max={20}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Timeout (seconds)</label>
          <input
            type="number"
            value={gatherStep.timeout || 10}
            onChange={(e) => onChange({ ...gatherStep, timeout: parseInt(e.target.value) || 10 })}
            min={1}
            max={60}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Max Retries</label>
          <input
            type="number"
            value={gatherStep.maxRetries || 3}
            onChange={(e) => onChange({ ...gatherStep, maxRetries: parseInt(e.target.value) || 3 })}
            min={1}
            max={5}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Store in Variable *</label>
        <input
          type="text"
          value={gatherStep.targetVariable}
          onChange={(e) => onChange({ ...gatherStep, targetVariable: e.target.value })}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                     focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
          placeholder="e.g., homeowner, zipCode"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Valid Responses (optional)</label>
        <input
          type="text"
          value={gatherStep.validResponses?.join(', ') || ''}
          onChange={(e) => onChange({
            ...gatherStep,
            validResponses: e.target.value ? e.target.value.split(',').map(s => s.trim()) : undefined
          })}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                     focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
          placeholder="e.g., 1, 2, 3"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Next Step *</label>
        <select
          value={gatherStep.nextStepId || ''}
          onChange={(e) => onChange({ ...gatherStep, nextStepId: e.target.value })}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                     focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
        >
          <option value="">Select next step...</option>
          {allSteps.filter(s => s.id !== step.id).map((s) => (
            <option key={s.id} value={s.id}>{s.name || `${s.type} (${s.id.slice(-6)})`}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

function ConditionStepEditor({ step, allSteps, onChange }: StepEditorProps) {
  const conditionStep = step as ConditionStep;

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Step Name</label>
        <input
          type="text"
          value={conditionStep.name || ''}
          onChange={(e) => onChange({ ...conditionStep, name: e.target.value })}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                     focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Variable *</label>
        <input
          type="text"
          value={conditionStep.variable}
          onChange={(e) => onChange({ ...conditionStep, variable: e.target.value })}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                     focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
          placeholder="e.g., homeowner, responses.zip"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Operator</label>
          <select
            value={conditionStep.operator}
            onChange={(e) => onChange({ ...conditionStep, operator: e.target.value as ConditionOperator })}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
          >
            {CONDITION_OPERATORS.map((op) => (
              <option key={op.value} value={op.value}>{op.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Value</label>
          <input
            type="text"
            value={String(conditionStep.value || '')}
            onChange={(e) => onChange({ ...conditionStep, value: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            placeholder="e.g., 1, yes, true"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">If True *</label>
          <select
            value={conditionStep.trueStepId || ''}
            onChange={(e) => onChange({ ...conditionStep, trueStepId: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
          >
            <option value="">Select step...</option>
            {allSteps.filter(s => s.id !== step.id).map((s) => (
              <option key={s.id} value={s.id}>{s.name || `${s.type} (${s.id.slice(-6)})`}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">If False *</label>
          <select
            value={conditionStep.falseStepId || ''}
            onChange={(e) => onChange({ ...conditionStep, falseStepId: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
          >
            <option value="">Select step...</option>
            {allSteps.filter(s => s.id !== step.id).map((s) => (
              <option key={s.id} value={s.id}>{s.name || `${s.type} (${s.id.slice(-6)})`}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

function QualificationStepEditor({ step, onChange }: StepEditorProps) {
  const qualStep = step as QualificationStep;

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Step Name</label>
        <input
          type="text"
          value={qualStep.name || ''}
          onChange={(e) => onChange({ ...qualStep, name: e.target.value })}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                     focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Qualification Result</label>
        <div className="flex gap-4">
          <label className="flex items-center">
            <input
              type="radio"
              checked={qualStep.qualifies === true}
              onChange={() => onChange({ ...qualStep, qualifies: true })}
              className="mr-2 text-orange-500 focus:ring-orange-500"
            />
            <span className="text-sm text-gray-700">Qualified</span>
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              checked={qualStep.qualifies === false}
              onChange={() => onChange({ ...qualStep, qualifies: false })}
              className="mr-2 text-orange-500 focus:ring-orange-500"
            />
            <span className="text-sm text-gray-700">Disqualified</span>
          </label>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
        <input
          type="text"
          value={qualStep.reason || ''}
          onChange={(e) => onChange({ ...qualStep, reason: e.target.value })}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                     focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
          placeholder="e.g., Homeowner confirmed"
        />
      </div>
    </div>
  );
}

function TransferStepEditor({ step, onChange }: StepEditorProps) {
  const transferStep = step as TransferStep;

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Step Name</label>
        <input
          type="text"
          value={transferStep.name || ''}
          onChange={(e) => onChange({ ...transferStep, name: e.target.value })}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                     focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Transfer Type</label>
        <select
          value={transferStep.transferType}
          onChange={(e) => onChange({ ...transferStep, transferType: e.target.value as 'auction' | 'direct' | 'queue' })}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                     focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
        >
          <option value="auction">Auction (find best buyer)</option>
          <option value="direct">Direct (specific number)</option>
          <option value="queue">Queue (call queue)</option>
        </select>
      </div>

      {transferStep.transferType === 'direct' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
          <input
            type="tel"
            value={transferStep.directNumber || ''}
            onChange={(e) => onChange({ ...transferStep, directNumber: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            placeholder="+15551234567"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Announcement (optional)</label>
        <textarea
          value={transferStep.announcement || ''}
          onChange={(e) => onChange({ ...transferStep, announcement: e.target.value })}
          rows={2}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                     focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
          placeholder="Message to play before transfer..."
        />
      </div>

      <div className="flex items-center">
        <input
          type="checkbox"
          id="record"
          checked={transferStep.record !== false}
          onChange={(e) => onChange({ ...transferStep, record: e.target.checked })}
          className="mr-2 rounded text-orange-500 focus:ring-orange-500"
        />
        <label htmlFor="record" className="text-sm text-gray-700">Record call</label>
      </div>
    </div>
  );
}

function HangupStepEditor({ step, onChange }: StepEditorProps) {
  const hangupStep = step as HangupStep;

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Step Name</label>
        <input
          type="text"
          value={hangupStep.name || ''}
          onChange={(e) => onChange({ ...hangupStep, name: e.target.value })}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                     focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Farewell Message</label>
        <textarea
          value={hangupStep.message || ''}
          onChange={(e) => onChange({ ...hangupStep, message: e.target.value })}
          rows={2}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                     focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
          placeholder="Thank you for calling. Goodbye."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Reason (for logs)</label>
        <input
          type="text"
          value={hangupStep.reason || ''}
          onChange={(e) => onChange({ ...hangupStep, reason: e.target.value })}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                     focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
          placeholder="e.g., Not a homeowner"
        />
      </div>
    </div>
  );
}

function StepEditor({ step, allSteps, onChange }: StepEditorProps) {
  switch (step.type) {
    case 'say':
      return <SayStepEditor step={step} allSteps={allSteps} onChange={onChange} />;
    case 'gather':
      return <GatherStepEditor step={step} allSteps={allSteps} onChange={onChange} />;
    case 'condition':
      return <ConditionStepEditor step={step} allSteps={allSteps} onChange={onChange} />;
    case 'qualification':
      return <QualificationStepEditor step={step} allSteps={allSteps} onChange={onChange} />;
    case 'transfer':
      return <TransferStepEditor step={step} allSteps={allSteps} onChange={onChange} />;
    case 'hangup':
      return <HangupStepEditor step={step} allSteps={allSteps} onChange={onChange} />;
    default:
      return (
        <div className="text-center text-gray-500 py-8">
          Editor for {step.type} step not implemented yet.
        </div>
      );
  }
}

// ============================================
// MAIN COMPONENT
// ============================================

export function IvrBuilder({ steps, onChange, onSave, isSaving, errors }: IvrBuilderProps) {
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);

  const selectedStep = useMemo(() => {
    return steps.find(s => s.id === selectedStepId);
  }, [steps, selectedStepId]);

  const handleAddStep = useCallback((type: IvrStepType) => {
    const newStep = createDefaultStep(type);
    const newSteps = [...steps, newStep];
    onChange(newSteps);
    setSelectedStepId(newStep.id);
  }, [steps, onChange]);

  const handleUpdateStep = useCallback((updatedStep: IvrStep) => {
    const newSteps = steps.map(s => s.id === updatedStep.id ? updatedStep : s);
    onChange(newSteps);
  }, [steps, onChange]);

  const handleDeleteStep = useCallback((stepId: string) => {
    const newSteps = steps.filter(s => s.id !== stepId);
    onChange(newSteps);
    if (selectedStepId === stepId) {
      setSelectedStepId(null);
    }
  }, [steps, onChange, selectedStepId]);

  const handleMoveStep = useCallback((stepId: string, direction: 'up' | 'down') => {
    const index = steps.findIndex(s => s.id === stepId);
    if (index === -1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= steps.length) return;

    const newSteps = [...steps];
    [newSteps[index], newSteps[newIndex]] = [newSteps[newIndex], newSteps[index]];
    onChange(newSteps);
  }, [steps, onChange]);

  return (
    <div className="flex flex-col h-full">
      {/* Errors */}
      {errors && errors.length > 0 && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-red-800">Validation Errors</h4>
              <ul className="mt-1 text-sm text-red-700 list-disc list-inside">
                {errors.map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-6 flex-1 min-h-0">
        {/* Left panel - Step palette and list */}
        <div className="w-80 flex-shrink-0 flex flex-col gap-4">
          <StepPalette onAddStep={handleAddStep} />

          <div className="flex-1 overflow-y-auto bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Flow Steps ({steps.length})
            </h3>

            {steps.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <Plus className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm">No steps yet</p>
                <p className="text-xs">Add a step from the palette above</p>
              </div>
            ) : (
              <div className="space-y-2">
                {steps.map((step, index) => (
                  <StepListItem
                    key={step.id}
                    step={step}
                    index={index}
                    isSelected={selectedStepId === step.id}
                    isFirst={index === 0}
                    isLast={index === steps.length - 1}
                    onSelect={() => setSelectedStepId(step.id)}
                    onMoveUp={() => handleMoveStep(step.id, 'up')}
                    onMoveDown={() => handleMoveStep(step.id, 'down')}
                    onDelete={() => handleDeleteStep(step.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right panel - Step editor */}
        <div className="flex-1 bg-white rounded-lg border border-gray-200 p-6 overflow-y-auto">
          {selectedStep ? (
            <>
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
                {(() => {
                  const Icon = getStepIcon(selectedStep.type);
                  return <Icon className="h-6 w-6 text-orange-600" />;
                })()}
                <div>
                  <h3 className="text-lg font-medium text-gray-900">
                    Edit {selectedStep.type.charAt(0).toUpperCase() + selectedStep.type.slice(1)} Step
                  </h3>
                  <p className="text-sm text-gray-500">
                    Configure the step properties below
                  </p>
                </div>
              </div>

              <StepEditor
                step={selectedStep}
                allSteps={steps}
                onChange={handleUpdateStep}
              />
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <Keyboard className="h-12 w-12 mb-4 text-gray-300" />
              <p className="text-sm">Select a step to edit</p>
              <p className="text-xs mt-1">or add a new step from the palette</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer with save button */}
      {onSave && (
        <div className="mt-4 pt-4 border-t border-gray-200 flex justify-end">
          <Button
            onClick={onSave}
            disabled={isSaving}
                      >
            {isSaving ? (
              <>
                <span className="animate-spin mr-2">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </span>
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Flow
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

export default IvrBuilder;
