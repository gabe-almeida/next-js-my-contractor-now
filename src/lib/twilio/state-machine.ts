/**
 * WHY: Out-of-order webhooks can corrupt call status.
 * WHEN: Before updating call status in any webhook handler.
 * HOW: Define valid transitions and reject invalid ones.
 */

import { logger } from '@/lib/logger';
import * as Sentry from '@sentry/nextjs';

/**
 * Our internal call status values
 * These map to the Call.status field in the database
 */
export type CallStatus =
  | 'RINGING'
  | 'IVR'
  | 'BIDDING'
  | 'CONNECTING'
  | 'CASCADING'
  | 'CONNECTED'
  | 'COMPLETED'
  | 'FAILED'
  | 'REJECTED'
  | 'CALLER_HANGUP'
  | 'NO_BIDS'
  | 'NO_ANSWER';

/**
 * Valid state transitions for the call state machine
 * Key = current state, Value = array of valid next states
 */
const VALID_TRANSITIONS: Record<CallStatus, CallStatus[]> = {
  RINGING: ['IVR', 'BIDDING', 'FAILED', 'CALLER_HANGUP'],
  IVR: ['BIDDING', 'REJECTED', 'CALLER_HANGUP', 'FAILED'],
  BIDDING: ['CONNECTING', 'NO_BIDS', 'CALLER_HANGUP', 'FAILED'],
  CONNECTING: ['CONNECTED', 'CASCADING', 'FAILED', 'NO_ANSWER', 'CALLER_HANGUP'],
  CASCADING: ['CONNECTED', 'NO_ANSWER', 'FAILED', 'CALLER_HANGUP'],
  CONNECTED: ['COMPLETED', 'FAILED'],
  COMPLETED: [], // Terminal state
  FAILED: [], // Terminal state
  REJECTED: [], // Terminal state
  CALLER_HANGUP: [], // Terminal state
  NO_BIDS: [], // Terminal state
  NO_ANSWER: [], // Terminal state (all cascades exhausted)
};

/**
 * Error thrown when an invalid state transition is attempted
 */
export class InvalidStateTransitionError extends Error {
  public readonly from: string;
  public readonly to: string;

  constructor(from: string, to: string) {
    super(`Invalid state transition: ${from} -> ${to}`);
    this.name = 'InvalidStateTransitionError';
    this.from = from;
    this.to = to;
  }
}

/**
 * Check if a state transition is valid
 * @param from Current call status
 * @param to Desired next status
 * @returns true if transition is allowed
 */
export function canTransition(from: CallStatus, to: CallStatus): boolean {
  const validTargets = VALID_TRANSITIONS[from];
  return validTargets?.includes(to) ?? false;
}

/**
 * Validate and prepare for state transition
 * @param from Current call status
 * @param to Desired next status
 * @throws InvalidStateTransitionError if transition is not valid
 */
export function validateTransition(from: CallStatus, to: CallStatus): void {
  if (!canTransition(from, to)) {
    const error = new InvalidStateTransitionError(from, to);

    logger.warn({
      event: 'call.invalid_transition',
      message: `Invalid state transition attempted: ${from} -> ${to}`,
      from,
      to,
    });

    Sentry.captureException(error, {
      tags: { component: 'state-machine' },
      extra: { from, to },
    });

    throw error;
  }
}

/**
 * Check if a status is terminal (call is finished)
 * @param status The call status to check
 * @returns true if this is a terminal state
 */
export function isTerminalStatus(status: CallStatus): boolean {
  return VALID_TRANSITIONS[status]?.length === 0;
}

/**
 * Check if a status is valid
 * @param status The status to validate
 * @returns true if this is a valid CallStatus
 */
export function isValidStatus(status: string): status is CallStatus {
  return status in VALID_TRANSITIONS;
}

/**
 * Get all valid next states from current state
 * @param from Current call status
 * @returns Array of valid next states
 */
export function getValidNextStates(from: CallStatus): CallStatus[] {
  return VALID_TRANSITIONS[from] ?? [];
}

/**
 * Context for mapping Twilio status
 */
export interface TwilioStatusContext {
  hadBids?: boolean;
  wasConnected?: boolean;
  currentStatus?: CallStatus;
}

/**
 * Map Twilio CallStatus to our internal status
 * @param twilioStatus The status string from Twilio webhook
 * @param context Additional context about the call
 * @returns Our internal CallStatus
 */
export function mapTwilioStatus(
  twilioStatus: string,
  context?: TwilioStatusContext
): CallStatus {
  const status = twilioStatus.toLowerCase();

  switch (status) {
    case 'ringing':
    case 'queued':
      return 'RINGING';

    case 'in-progress':
      // Determine if we're connecting or already connected
      return context?.wasConnected ? 'CONNECTED' : 'CONNECTING';

    case 'completed':
      return 'COMPLETED';

    case 'busy':
    case 'failed':
      return 'FAILED';

    case 'no-answer':
      return 'NO_ANSWER';

    case 'canceled':
      return 'CALLER_HANGUP';

    default:
      logger.warn({
        event: 'call.unknown_twilio_status',
        message: `Unknown Twilio status: ${twilioStatus}`,
        twilioStatus,
      });
      return 'FAILED';
  }
}

/**
 * Map dial callback status to our internal status
 * @param dialCallStatus The DialCallStatus from Twilio dial callback
 * @param dialBridged Whether the call was successfully bridged
 * @returns Our internal CallStatus
 */
export function mapDialStatus(
  dialCallStatus: string,
  dialBridged: boolean
): CallStatus {
  const status = dialCallStatus.toLowerCase();

  if (dialBridged && status === 'completed') {
    return 'COMPLETED';
  }

  switch (status) {
    case 'completed':
      // If not bridged but completed, something went wrong
      return dialBridged ? 'COMPLETED' : 'FAILED';

    case 'busy':
    case 'failed':
      return 'FAILED';

    case 'no-answer':
      return 'NO_ANSWER';

    case 'canceled':
      return 'CALLER_HANGUP';

    default:
      return 'FAILED';
  }
}

/**
 * Get human-readable description of a status
 * @param status The call status
 * @returns Human-readable description
 */
export function getStatusDescription(status: CallStatus): string {
  const descriptions: Record<CallStatus, string> = {
    RINGING: 'Call is ringing',
    IVR: 'Caller is in IVR menu',
    BIDDING: 'Finding available buyers',
    CONNECTING: 'Connecting to buyer',
    CASCADING: 'Trying next available buyer',
    CONNECTED: 'Caller connected with buyer',
    COMPLETED: 'Call completed successfully',
    FAILED: 'Call failed',
    REJECTED: 'Caller did not qualify',
    CALLER_HANGUP: 'Caller hung up',
    NO_BIDS: 'No buyers available',
    NO_ANSWER: 'No buyers answered',
  };

  return descriptions[status] ?? 'Unknown status';
}

/**
 * Check if a status indicates a billable call
 * @param status The call status
 * @returns true if this status typically indicates a billable call
 */
export function isBillableStatus(status: CallStatus): boolean {
  return status === 'COMPLETED' || status === 'CONNECTED';
}

/**
 * Check if a status indicates the call is still active
 * @param status The call status
 * @returns true if call is still in progress
 */
export function isActiveStatus(status: CallStatus): boolean {
  return !isTerminalStatus(status);
}
