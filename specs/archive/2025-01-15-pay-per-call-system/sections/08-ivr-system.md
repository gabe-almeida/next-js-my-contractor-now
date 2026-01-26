# IVR System

> **Section:** 08 | **Phase:** 1 (Simple) + Phase 2 (Advanced)
> **Parent:** [spec.md](../spec.md)

---

## Overview

Interactive Voice Response (IVR) system for pre-qualifying callers before auction and transfer.

---

## ⚠️ CRITICAL: Recording Disclosure (Legal Requirement)

> **MANDATORY FOR COMPLIANCE**: 15+ U.S. states require two-party consent for call recording.
> This disclosure MUST be played BEFORE any recording begins.

### Two-Party Consent States
```
California, Connecticut, Delaware, Florida, Illinois, Maryland,
Massachusetts, Michigan, Montana, Nevada, New Hampshire,
Oregon, Pennsylvania, Vermont, Washington
```

### Recording Disclosure Implementation

```typescript
// MUST be the first thing played on every call
const RECORDING_DISCLOSURE =
  "This call may be recorded for quality assurance and training purposes.";

// Determine if disclosure is required based on caller's state
function requiresRecordingDisclosure(callerState: string): boolean {
  const twoPartyConsentStates = new Set([
    'CA', 'CT', 'DE', 'FL', 'IL', 'MD', 'MA', 'MI',
    'MT', 'NV', 'NH', 'OR', 'PA', 'VT', 'WA'
  ]);
  // Always play disclosure to be safe (recommended)
  return true;
  // Or: return twoPartyConsentStates.has(callerState);
}
```

### TwiML with Recording Disclosure

```xml
<Response>
  <!-- ALWAYS FIRST: Recording disclosure -->
  <Say>This call may be recorded for quality assurance and training purposes.</Say>

  <!-- Brief pause for acknowledgment -->
  <Pause length="1"/>

  <!-- Then proceed with IVR -->
  <Say>Thank you for calling about window services.</Say>
  <Gather action="/api/calls/ivr?callId=xxx" numDigits="1" timeout="10">
    <Say>Press 1 if you own your home. Press 2 if you rent.</Say>
  </Gather>
</Response>
```

---

## Simple IVR (Phase 1)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              IVR FLOW BUILDER                                    │
└─────────────────────────────────────────────────────────────────────────────────┘

SIMPLE IVR (Phase 1):
─────────────────────

┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Answer     │────▶│   Welcome    │────▶│   Question   │────▶│   Route      │
│   Call       │     │   Message    │     │   (DTMF)     │     │   or Hangup  │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘

Example script:
"Thank you for calling about window services.
 Press 1 if you own your home.
 Press 2 if you rent."

If 1 → qualified, proceed to auction
If 2 → "Sorry, we only service homeowners. Goodbye."
```

## Database Structure

```typescript
ivr_flows:
  id: "ivr-windows"
  name: "Windows Pre-Qualification"
  service_type_id: "windows-uuid"
  steps: [
    {
      "type": "say",
      "text": "Thank you for calling about window services."
    },
    {
      "type": "gather",
      "prompt": "Press 1 if you own your home. Press 2 if you rent.",
      "numDigits": 1,
      "timeout": 10,
      "onResponse": {
        "1": { "action": "qualify", "label": "Homeowner" },
        "2": { "action": "reject", "message": "Sorry, we only service homeowners." }
      }
    }
  ]
```

## TwiML Output

```xml
<Response>
  <!-- Recording disclosure FIRST -->
  <Say>This call may be recorded for quality assurance and training purposes.</Say>
  <Pause length="1"/>

  <Say>Thank you for calling about window services.</Say>
  <Gather action="/api/calls/ivr?callId=xxx&amp;step=1&amp;attempt=1" numDigits="1" timeout="10">
    <Say>Press 1 if you own your home. Press 2 if you rent.</Say>
    <Say>Press 9 to hear these options again.</Say>
  </Gather>
  <!-- Timeout fallback - retry once before disconnect -->
  <Say>We didn't receive a response. Let's try again.</Say>
  <Gather action="/api/calls/ivr?callId=xxx&amp;step=1&amp;attempt=2" numDigits="1" timeout="10">
    <Say>Press 1 if you own your home. Press 2 if you rent.</Say>
  </Gather>
  <Say>We're sorry, we could not receive your response. Please call back later. Goodbye.</Say>
</Response>
```

---

## Navigation Options (UX Best Practices)

### Standard Navigation Keys
| Key | Action | Prompt |
|-----|--------|--------|
| `9` | Repeat current options | "Press 9 to hear these options again." |
| `*` | Go back to previous step | "Press star to go back." |
| `0` | Speak to operator (if available) | "Press 0 to speak with someone." |

### Invalid Input Handling

```typescript
interface IVRStep {
  type: 'say' | 'gather' | 'record' | 'branch' | 'qualify' | 'reject';
  maxAttempts?: number; // Default: 3
  onInvalidInput?: {
    message: string;
    action: 'retry' | 'escalate' | 'hangup';
  };
}

// Example gather step with retry logic
const gatherStep = {
  type: 'gather',
  prompt: 'Press 1 if you own your home. Press 2 if you rent.',
  numDigits: 1,
  timeout: 10,
  maxAttempts: 3,
  validInputs: ['1', '2', '9', '*'],
  onInvalidInput: {
    message: "I'm sorry, that wasn't a valid option.",
    action: 'retry'
  },
  onMaxAttemptsReached: {
    message: "We're having trouble receiving your response. Please try calling back later.",
    action: 'hangup'
  },
  onResponse: {
    '1': { action: 'qualify', label: 'Homeowner' },
    '2': { action: 'reject', message: 'Sorry, we only service homeowners.' },
    '9': { action: 'repeat' },
    '*': { action: 'back' }
  }
};
```

### IVR Response Tracking

```typescript
interface IVRAttempt {
  step: number;
  attemptNumber: number;
  input: string | null;
  timestamp: Date;
  result: 'valid' | 'invalid' | 'timeout' | 'hangup';
}

// Track all IVR attempts in call record for debugging
interface CallIVRData {
  flowId: string;
  currentStep: number;
  attempts: IVRAttempt[];
  totalInvalidInputs: number;
  capturedData: Record<string, string>;
  completedAt?: Date;
}
```

## Multi-Step IVR (Phase 2)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         ADVANCED IVR FLOW                                        │
└─────────────────────────────────────────────────────────────────────────────────┘

┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│ Welcome  │──▶│ Own Home │──▶│ Project  │──▶│ ZIP Code │──▶│ Connect  │
│          │   │ Y/N      │   │ Type     │   │ (Voice)  │   │          │
└──────────┘   └────┬─────┘   └──────────┘   └──────────┘   └──────────┘
                    │
                    │ If "No" (renter)
                    ▼
              ┌──────────┐
              │ Goodbye  │
              │ (Reject) │
              └──────────┘

IVR captures:
• isHomeowner: true/false
• projectType: "repair" | "replacement"
• zipCode: "90210" (via speech-to-text or DTMF)

This data feeds into auction for better buyer matching.
```

## IVR Step Types

| Type | Purpose | Parameters |
|------|---------|------------|
| `say` | Speak text | `text`, `voice`, `language` |
| `gather` | Collect DTMF | `prompt`, `numDigits`, `timeout`, `onResponse` |
| `record` | Capture voice | `prompt`, `maxLength`, `transcribe` |
| `branch` | Conditional | `condition`, `true`, `false` |
| `qualify` | Mark qualified | `label` |
| `reject` | End call | `message` |

## IVR Builder Component (Phase 2)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  ADMIN: IVR Flow Builder                                                         │
│  Service: Windows Repair                                                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─ STEP 1: Welcome ────────────────────────────────────────────────────────┐   │
│  │  Type: [Say ▼]                                                            │   │
│  │  Text: "Thank you for calling about window services."                     │   │
│  │  [▲ Move Up] [▼ Move Down] [🗑️ Delete]                                    │   │
│  └───────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  ┌─ STEP 2: Homeowner Check ────────────────────────────────────────────────┐   │
│  │  Type: [Gather ▼]                                                         │   │
│  │  Prompt: "Press 1 if you own. Press 2 if you rent."                       │   │
│  │  Digits: [1 ▼]  Timeout: [10 ▼] seconds                                   │   │
│  │                                                                            │   │
│  │  Responses:                                                                │   │
│  │  1 → [✅ Qualify]  Label: "Homeowner"                                     │   │
│  │  2 → [❌ Reject]   Message: "Sorry, homeowners only."                     │   │
│  │                                                                            │   │
│  │  [▲ Move Up] [▼ Move Down] [🗑️ Delete]                                    │   │
│  └───────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  [+ Add Step]                                                                    │
│                                                                                  │
│  [Preview TwiML]  [Test Call]  [Save Flow]                                       │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Race Condition Prevention

### Concurrent IVR Response Handling

**Problem**: Caller rapidly presses multiple keys, or DTMF webhooks arrive out of order.

```typescript
/**
 * WHY: Prevent double-processing of IVR inputs that arrive concurrently
 * WHEN: Called by IVR webhook handler before processing DTMF input
 * HOW: Uses atomic operation with step/attempt versioning to ensure only one response is processed
 */
export async function processIVRInput(
  callId: string,
  step: number,
  attempt: number,
  input: string
): Promise<IVRProcessResult> {
  // Idempotency key: unique per call+step+attempt
  const idempotencyKey = `ivr:${callId}:${step}:${attempt}`;

  // Try to claim this specific step+attempt
  const result = await prisma.$transaction(async (tx) => {
    const call = await tx.call.findUnique({
      where: { id: callId },
      select: {
        id: true,
        status: true,
        ivrData: true,
        version: true
      }
    });

    if (!call) {
      throw new IVRError('CALL_NOT_FOUND', 'Call does not exist');
    }

    if (call.status !== 'IVR') {
      // Call has already moved past IVR phase
      return { action: 'ALREADY_PROCESSED', call };
    }

    const ivrData = call.ivrData as CallIVRData;

    // Check if this step+attempt was already processed
    const existingAttempt = ivrData.attempts?.find(
      a => a.step === step && a.attemptNumber === attempt
    );

    if (existingAttempt) {
      // Already processed - idempotent return
      return { action: 'ALREADY_PROCESSED', call };
    }

    // Record the attempt
    const newAttempt: IVRAttempt = {
      step,
      attemptNumber: attempt,
      input,
      timestamp: new Date(),
      result: 'valid' // will be updated based on validation
    };

    const updatedCall = await tx.call.update({
      where: {
        id: callId,
        version: call.version // Optimistic lock
      },
      data: {
        ivrData: {
          ...ivrData,
          attempts: [...(ivrData.attempts || []), newAttempt],
          currentStep: step
        },
        version: { increment: 1 }
      }
    });

    return { action: 'PROCESS', call: updatedCall };
  });

  return result;
}
```

### State Validation Before IVR Actions

```typescript
/**
 * WHY: Ensure call is still in IVR state before taking action
 * WHEN: Before qualifying, rejecting, or advancing IVR steps
 * HOW: Check current call status and abort if already transitioned
 */
function validateIVRState(call: Call): void {
  const validStatesForIVR = ['RINGING', 'IVR'];

  if (!validStatesForIVR.includes(call.status)) {
    throw new IVRError(
      'INVALID_STATE',
      `Cannot process IVR for call in ${call.status} state`
    );
  }
}
```

### Caller Hangup During IVR

```typescript
/**
 * WHY: Handle caller hanging up mid-IVR gracefully
 * WHEN: Twilio sends status callback with 'completed' or 'busy' during IVR
 * HOW: Update call status and preserve partial IVR data for analytics
 */
export async function handleCallerHangupDuringIVR(
  callId: string,
  hangupPhase: 'disclosure' | 'question' | 'waiting'
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const call = await tx.call.findUnique({
      where: { id: callId },
      select: { id: true, status: true, ivrData: true }
    });

    if (!call || call.status !== 'IVR') {
      return; // Already handled or moved on
    }

    await tx.call.update({
      where: { id: callId },
      data: {
        status: 'CALLER_HANGUP',
        endTime: new Date(),
        ivrData: {
          ...(call.ivrData as object),
          hangupPhase,
          completedAt: null
        }
      }
    });
  });
}
```

---

## User Stories

### US-IVR-1: Caller Needs Clear Recording Notice
**WHY**: Legal compliance in two-party consent states + caller trust
**WHEN**: Every call, before any recording begins
**HOW**:
- Play "This call may be recorded for quality assurance" as FIRST audio
- Brief pause (1 second) before proceeding
- Log that disclosure was played for compliance audit trail

**Acceptance Criteria**:
- [ ] Recording disclosure plays before any other audio
- [ ] Disclosure timestamp is logged in call record
- [ ] Works correctly even if caller hangs up during disclosure

---

### US-IVR-2: Caller Misses or Misunderstands Options
**WHY**: Callers may be distracted, in noisy environments, or need clarification
**WHEN**: Caller presses 9 or waits too long
**HOW**:
- "Press 9 to hear these options again" available on every gather step
- On timeout: "We didn't receive a response. Let's try again." + repeat options
- Maximum 3 attempts before polite disconnect

**Acceptance Criteria**:
- [ ] Press 9 repeats current options immediately
- [ ] Timeout triggers retry with helpful message
- [ ] After 3 failed attempts, polite disconnect message
- [ ] All attempts logged for analytics

---

### US-IVR-3: Caller Presses Wrong Key by Accident
**WHY**: Touch-tone mistakes are common, frustrating disconnect is poor UX
**WHEN**: Caller enters invalid input (e.g., presses 5 when only 1 and 2 are valid)
**HOW**:
- Play: "I'm sorry, that wasn't a valid option."
- Repeat the valid options
- Track invalid input count (max 3 before escalation/hangup)

**Acceptance Criteria**:
- [ ] Invalid input triggers clear error message
- [ ] Options are repeated after error
- [ ] Invalid input count is tracked
- [ ] Escalation path after repeated failures

---

### US-IVR-4: Caller Wants to Go Back
**WHY**: Caller may want to change a previous answer
**WHEN**: Multi-step IVR (Phase 2), caller presses * (star)
**HOW**:
- "Press star to go back to the previous question"
- Return to previous step with fresh attempt count
- Preserve other captured data

**Acceptance Criteria**:
- [ ] Star key returns to previous step
- [ ] Previous answer can be changed
- [ ] Other captured data is preserved
- [ ] Cannot go back from first step (plays "You're at the first question")

---

## Implementation Tasks

### Phase 1 (MVP) - Simple IVR

| Task ID | Description | Status |
|---------|-------------|--------|
| P1-IVR-1 | Create `/api/calls/ivr/route.ts` | ⬜ |
| P1-IVR-2 | Parse DTMF digits from Twilio | ⬜ |
| P1-IVR-3 | Update call.ivr_responses JSON | ⬜ |
| P1-IVR-4 | Determine qualification from response | ⬜ |
| P1-IVR-5 | Proceed to auction if qualified | ⬜ |
| P1-IVR-6 | Return rejection TwiML if not qualified | ⬜ |
| P1-IVR-7 | Create TwiML generator for IVR steps | ⬜ |

### Phase 2 - Advanced IVR

| Task ID | Description | Status |
|---------|-------------|--------|
| P2-IVR-1 | Create IVR builder admin UI | ⬜ |
| P2-IVR-2 | Implement multi-step IVR flow | ⬜ |
| P2-IVR-3 | Add voice/speech input support | ⬜ |
| P2-IVR-4 | Add ZIP code capture via voice | ⬜ |
| P2-IVR-5 | Add TwiML preview in builder | ⬜ |
| P2-IVR-6 | Add test call feature | ⬜ |
| P2-IVR-7 | Add "go back" navigation (star key) | ⬜ |
| P2-IVR-8 | Add step history for back navigation | ⬜ |

### Recording Disclosure Tasks (CRITICAL - Legal Compliance)

| Task ID | Description | Status | Priority |
|---------|-------------|--------|----------|
| P1-IVR-RD-1 | Add recording disclosure to TwiML generator as FIRST element | ⬜ | CRITICAL |
| P1-IVR-RD-2 | Create `two_party_consent_states` constant set | ⬜ | CRITICAL |
| P1-IVR-RD-3 | Log disclosure_played_at timestamp in call record | ⬜ | CRITICAL |
| P1-IVR-RD-4 | Add disclosure to all IVR flows (including rejects) | ⬜ | CRITICAL |
| P1-IVR-RD-5 | Create compliance audit query for disclosure verification | ⬜ | HIGH |

### Navigation & Invalid Input Tasks

| Task ID | Description | Status |
|---------|-------------|--------|
| P1-IVR-NAV-1 | Add "Press 9 to hear again" to all gather steps | ⬜ |
| P1-IVR-NAV-2 | Implement repeat handler for key 9 | ⬜ |
| P1-IVR-NAV-3 | Add `maxAttempts` config to gather steps (default: 3) | ⬜ |
| P1-IVR-NAV-4 | Implement invalid input error message and retry | ⬜ |
| P1-IVR-NAV-5 | Add polite disconnect message after max attempts | ⬜ |
| P1-IVR-NAV-6 | Track `attempt` number in IVR webhook URL params | ⬜ |
| P1-IVR-NAV-7 | Create `IVRAttempt` tracking in call.ivrData | ⬜ |

### Race Condition Prevention Tasks

| Task ID | Description | Status |
|---------|-------------|--------|
| P1-IVR-RC-1 | Add step+attempt versioning to IVR webhooks | ⬜ |
| P1-IVR-RC-2 | Implement idempotent IVR input processing | ⬜ |
| P1-IVR-RC-3 | Use optimistic locking (version column) for IVR updates | ⬜ |
| P1-IVR-RC-4 | Handle caller hangup during IVR gracefully | ⬜ |
| P1-IVR-RC-5 | Validate call status before IVR state transitions | ⬜ |
| P1-IVR-RC-6 | Handle out-of-order DTMF webhook arrivals | ⬜ |

### Logging Tasks

> **See Also**: [Section 12: Logging & Observability](./12-logging-observability.md) for full logging architecture

| Task ID | Description | Status |
|---------|-------------|--------|
| P1-IVR-LOG-1 | Log IVR flow start with flow ID and caller info | ⬜ |
| P1-IVR-LOG-2 | Log recording disclosure played timestamp (compliance audit) | ⬜ |
| P1-IVR-LOG-3 | Log each DTMF input with step number and response (affiliate-visible) | ⬜ |
| P1-IVR-LOG-4 | Log invalid inputs with attempt count | ⬜ |
| P1-IVR-LOG-5 | Log qualification decision with reason (affiliate-visible) | ⬜ |
| P1-IVR-LOG-6 | Log rejection with reason and step where rejected (affiliate-visible) | ⬜ |
| P1-IVR-LOG-7 | Log caller hangup during IVR with phase (disclosure/question/waiting) | ⬜ |
| P1-IVR-LOG-8 | Log IVR completion time (disclosure start to qualification) | ⬜ |
| P1-IVR-LOG-9 | Log repeat option usage (press 9) for UX analytics | ⬜ |
| P1-IVR-LOG-10 | Log go-back usage (star key) for UX analytics | ⬜ |

**IVR Events to Log:**

| Event | Level | Affiliate-Visible | Description |
|-------|-------|-------------------|-------------|
| `ivr.started` | info | ✅ | IVR flow began |
| `ivr.disclosure_played` | info | ❌ | Recording disclosure completed |
| `ivr.step_completed` | info | ✅ | Caller answered question |
| `ivr.invalid_input` | warn | ❌ | Invalid key pressed |
| `ivr.timeout` | warn | ❌ | No response within timeout |
| `ivr.qualified` | info | ✅ | Caller passed pre-qualification |
| `ivr.rejected` | info | ✅ | Caller disqualified |
| `ivr.caller_hangup` | info | ✅ | Caller hung up during IVR |
| `ivr.max_attempts` | warn | ❌ | Disconnected after max retries |

---

### Testing Tasks

| Task ID | Description | Status |
|---------|-------------|--------|
| P1-IVR-T1 | Test recording disclosure plays first on every call | ⬜ |
| P1-IVR-T2 | Test retry logic after invalid input | ⬜ |
| P1-IVR-T3 | Test timeout retry flow | ⬜ |
| P1-IVR-T4 | Test max attempts disconnect | ⬜ |
| P1-IVR-T5 | Test "press 9 to repeat" functionality | ⬜ |
| P1-IVR-T6 | Test concurrent DTMF input (rapid key presses) | ⬜ |
| P1-IVR-T7 | Test caller hangup during disclosure/question | ⬜ |
| P1-IVR-T8 | Test IVR data preservation for analytics | ⬜ |

---

## Race Condition Summary

| Scenario | Prevention | Implementation |
|----------|------------|----------------|
| Rapid key presses | Step+attempt versioning | `processIVRInput()` with idempotency check |
| Out-of-order webhooks | Attempt number tracking | Ignore webhooks for already-processed attempts |
| Concurrent IVR updates | Optimistic locking | `version` column on calls table |
| Hangup during IVR | State check before actions | `validateIVRState()` + graceful handling |
| Duplicate qualification | Transaction + state check | Atomic qualify with status verification |

---

## Sentry Integration

### Error Tracking and Alerting

```typescript
import * as Sentry from '@sentry/nextjs';

// Set IVR context
function setIVRContext(call: Call, flowId: string) {
  Sentry.setContext('ivr', {
    callId: call.id,
    flowId,
    callerState: call.callerState,
    timestamp: new Date().toISOString()
  });
}

// Track IVR flow execution
async function processIVRWithSentry(
  callId: string,
  step: number,
  input: string
): Promise<IVRProcessResult> {
  Sentry.addBreadcrumb({
    category: 'ivr',
    message: `IVR step ${step} input received`,
    level: 'info',
    data: { callId, step, input }
  });

  try {
    const result = await processIVRInput(callId, step, 1, input);

    if (result.action === 'reject') {
      Sentry.addBreadcrumb({
        category: 'ivr',
        message: 'Caller disqualified',
        level: 'info',
        data: { callId, step, reason: result.reason }
      });
    }

    return result;
  } catch (error) {
    Sentry.captureException(error, {
      tags: { component: 'ivr-system', step: String(step) },
      extra: { callId, input }
    });
    throw error;
  }
}
```

### Sentry Events to Capture

| Event | Sentry Method | Severity | When to Trigger |
|-------|---------------|----------|-----------------|
| IVR flow not found | `captureException` | error | Missing flow configuration |
| Invalid DTMF input | `captureMessage` | info | Caller pressed invalid key |
| Max attempts reached | `captureMessage` | info | Caller failed 3 times |
| Caller hangup during IVR | `captureMessage` | info | Abandoned in IVR phase |
| IVR step timeout | `captureMessage` | info | No response within timeout |
| Concurrent IVR input race | `captureMessage` | warning | Duplicate input detected |
| Recording disclosure skipped | `captureException` | error | Compliance violation |

### Breadcrumb Tracking

```typescript
// IVR lifecycle
Sentry.addBreadcrumb({
  category: 'ivr',
  message: 'IVR flow started',
  level: 'info',
  data: { callId, flowId, flowName }
});

Sentry.addBreadcrumb({
  category: 'ivr.compliance',
  message: 'Recording disclosure played',
  level: 'info',
  data: { callId, timestamp: new Date().toISOString() }
});

Sentry.addBreadcrumb({
  category: 'ivr.step',
  message: 'IVR step completed',
  level: 'info',
  data: { callId, step, input, result: 'valid' }
});

Sentry.addBreadcrumb({
  category: 'ivr.navigation',
  message: 'Caller requested repeat (key 9)',
  level: 'info',
  data: { callId, step }
});

Sentry.addBreadcrumb({
  category: 'ivr',
  message: 'Caller qualified',
  level: 'info',
  data: { callId, qualificationData: ivrResponses }
});

// Error tracking
Sentry.addBreadcrumb({
  category: 'ivr.error',
  message: 'Invalid input received',
  level: 'warning',
  data: { callId, step, input, validInputs: ['1', '2', '9'] }
});
```

### Alert Configuration

```typescript
// Critical alerts
const CRITICAL_IVR_ALERTS = [
  'Recording disclosure not played (compliance)',
  'IVR flow configuration missing',
  'IVR processing errors > 5%'
];

// Warning alerts
const WARNING_IVR_ALERTS = [
  'High IVR dropout rate (>30%)',
  'High invalid input rate (>25%)',
  'Average IVR completion time > 30 seconds',
  'High max attempts reached rate (>10%)'
];
```

---

*Section Version: 1.2 (Added Sentry Integration)*
