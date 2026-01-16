/**
 * Twilio Mock Client for Testing
 *
 * WHY: Provides mock Twilio client to test call handling without making
 *      real API calls. Simulates all Twilio operations used in the codebase.
 *
 * WHEN: Use in all tests that interact with Twilio SDK.
 *
 * HOW: Export mock objects and factory functions that match Twilio SDK interfaces.
 */

import { jest } from '@jest/globals';

// Use ReturnType to get the correct mock function type from jest.fn()
type MockFn = ReturnType<typeof jest.fn>;

// =====================================
// MOCK INCOMING PHONE NUMBERS
// =====================================

export interface MockIncomingPhoneNumber {
  sid: string;
  phoneNumber: string;
  friendlyName: string;
  voiceUrl: string;
  voiceMethod: string;
  statusCallback: string;
  statusCallbackMethod: string;
  smsUrl?: string;
  smsMethod?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockIncomingPhoneNumbersCreate = (jest.fn() as MockFn).mockImplementation(
  async (options: any) => {
    return {
      sid: `PN${Math.random().toString(36).substring(2, 15)}`,
      phoneNumber: options?.phoneNumber || `+1844555${Math.floor(1000 + Math.random() * 9000)}`,
      friendlyName: 'Test Tracking Number',
      voiceUrl: options?.voiceUrl || 'https://example.com/api/calls/incoming',
      voiceMethod: 'POST',
      statusCallback: 'https://example.com/api/calls/status',
      statusCallbackMethod: 'POST',
    };
  }
);

const mockIncomingPhoneNumbersList = (jest.fn() as MockFn).mockImplementation(
  async () => []
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockIncomingPhoneNumbersUpdate = (jest.fn() as MockFn).mockImplementation(
  async (sid: any, updates: any) => ({
    sid,
    ...updates,
  })
);

const mockIncomingPhoneNumbersRemove = (jest.fn() as MockFn).mockImplementation(
  async () => true
);

// =====================================
// MOCK CALLS
// =====================================

export interface MockCall {
  sid: string;
  status: 'queued' | 'ringing' | 'in-progress' | 'completed' | 'busy' | 'failed' | 'no-answer' | 'canceled';
  from: string;
  to: string;
  duration: string;
  direction: 'inbound' | 'outbound-api' | 'outbound-dial';
  startTime: Date;
  endTime?: Date;
}

const createMockCall = (overrides: Partial<MockCall> = {}): MockCall => ({
  sid: `CA${Math.random().toString(36).substring(2, 15)}`,
  status: 'in-progress',
  from: '+15551234567',
  to: '+18445551234',
  duration: '120',
  direction: 'inbound',
  startTime: new Date(),
  ...overrides,
});

const mockCallsFetch = (jest.fn() as MockFn).mockImplementation(
  async (): Promise<MockCall> => createMockCall({ status: 'in-progress' })
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockCallsUpdate = (jest.fn() as MockFn).mockImplementation(
  async (updates: any): Promise<MockCall> =>
    createMockCall({ ...updates })
);

// =====================================
// MOCK RECORDINGS
// =====================================

export interface MockRecording {
  sid: string;
  callSid: string;
  duration: string;
  status: 'processing' | 'completed' | 'failed';
  uri: string;
  mediaUrl: string;
}

const createMockRecording = (overrides: Partial<MockRecording> = {}): MockRecording => ({
  sid: `RE${Math.random().toString(36).substring(2, 15)}`,
  callSid: `CA${Math.random().toString(36).substring(2, 15)}`,
  duration: '120',
  status: 'completed',
  uri: '/2010-04-01/Accounts/AC123/Recordings/RE123.json',
  mediaUrl: 'https://api.twilio.com/2010-04-01/Accounts/AC123/Recordings/RE123.mp3',
  ...overrides,
});

const mockRecordingsFetch = (jest.fn() as MockFn).mockImplementation(
  async (): Promise<MockRecording> => createMockRecording()
);

const mockRecordingsRemove = (jest.fn() as MockFn).mockImplementation(
  async () => true
);

// =====================================
// MOCK TWILIO CLIENT FACTORY
// =====================================

/**
 * Creates a mock Twilio client for testing.
 * Call this in beforeEach to get a fresh mock for each test.
 */
export const createMockTwilioClient = () => {
  // Reset all mocks
  mockIncomingPhoneNumbersCreate.mockClear();
  mockIncomingPhoneNumbersList.mockClear();
  mockIncomingPhoneNumbersUpdate.mockClear();
  mockIncomingPhoneNumbersRemove.mockClear();
  mockCallsFetch.mockClear();
  mockCallsUpdate.mockClear();
  mockRecordingsFetch.mockClear();
  mockRecordingsRemove.mockClear();

  // Create a callable object for incomingPhoneNumbers
  const incomingPhoneNumbers = Object.assign(
    (sid: string) => ({
      update: (updates: Partial<MockIncomingPhoneNumber>) =>
        mockIncomingPhoneNumbersUpdate(sid, updates),
      remove: () => mockIncomingPhoneNumbersRemove(sid),
    }),
    {
      create: mockIncomingPhoneNumbersCreate,
      list: mockIncomingPhoneNumbersList,
    }
  );

  return {
    incomingPhoneNumbers,
    calls: (sid: string) => ({
      fetch: mockCallsFetch,
      update: mockCallsUpdate,
    }),
    recordings: (sid: string) => ({
      fetch: mockRecordingsFetch,
      remove: mockRecordingsRemove,
    }),
  };
};

// Export the mocks for direct assertion access
export const mockTwilioClient = {
  incomingPhoneNumbers: {
    create: mockIncomingPhoneNumbersCreate,
    list: mockIncomingPhoneNumbersList,
    update: mockIncomingPhoneNumbersUpdate,
    remove: mockIncomingPhoneNumbersRemove,
  },
  calls: {
    fetch: mockCallsFetch,
    update: mockCallsUpdate,
  },
  recordings: {
    fetch: mockRecordingsFetch,
    remove: mockRecordingsRemove,
  },
};

// =====================================
// TWILIO WEBHOOK PAYLOAD FACTORIES
// =====================================

/**
 * Creates a mock Twilio incoming call webhook payload.
 */
export const createIncomingCallPayload = (overrides: Record<string, string> = {}) => ({
  CallSid: `CA${Math.random().toString(36).substring(2, 15)}`,
  From: '+15551234567',
  To: '+18445551234',
  FromCity: 'Los Angeles',
  FromState: 'CA',
  FromZip: '90210',
  CallerName: 'Test Caller',
  AccountSid: 'AC123456789',
  Direction: 'inbound',
  CallStatus: 'ringing',
  ...overrides,
});

/**
 * Creates a mock Twilio IVR response webhook payload.
 */
export const createIvrPayload = (digits: string, overrides: Record<string, string> = {}) => ({
  CallSid: `CA${Math.random().toString(36).substring(2, 15)}`,
  Digits: digits,
  From: '+15551234567',
  To: '+18445551234',
  FinishedOnKey: '#',
  CallStatus: 'in-progress',
  ...overrides,
});

/**
 * Creates a mock Twilio dial completion webhook payload.
 */
export const createCompletionPayload = (overrides: Record<string, string> = {}) => ({
  CallSid: `CA${Math.random().toString(36).substring(2, 15)}`,
  CallDuration: '180',
  DialCallDuration: '120',
  DialCallStatus: 'completed',
  DialBridged: 'true',
  AccountSid: 'AC123456789',
  From: '+15551234567',
  To: '+18445551234',
  ...overrides,
});

/**
 * Creates a mock Twilio cascade (dial action) callback payload.
 * Used when first buyer doesn't answer and system cascades to next buyer.
 */
export const createCascadePayload = (overrides: Record<string, string | undefined> = {}) => ({
  CallSid: `CA${Math.random().toString(36).substring(2, 15)}`,
  DialCallSid: `CA${Math.random().toString(36).substring(2, 15)}`,
  DialCallStatus: 'no-answer',
  DialCallDuration: undefined as any,
  DialBridged: 'false',
  AccountSid: 'AC123456789',
  From: '+15551234567',
  To: '+18445551234',
  CallStatus: 'in-progress',
  ...overrides,
});

/**
 * Creates a mock Twilio recording status callback payload.
 */
export const createRecordingPayload = (overrides: Record<string, string> = {}) => ({
  CallSid: `CA${Math.random().toString(36).substring(2, 15)}`,
  RecordingSid: `RE${Math.random().toString(36).substring(2, 15)}`,
  RecordingUrl: 'https://api.twilio.com/2010-04-01/Accounts/AC123/Recordings/RE123',
  RecordingStatus: 'completed',
  RecordingDuration: '120',
  AccountSid: 'AC123456789',
  ...overrides,
});

// =====================================
// TWILIO SIGNATURE MOCK
// =====================================

/**
 * Generates a mock Twilio signature for webhook verification bypass.
 * In tests, we typically mock the verification middleware entirely.
 */
export const mockTwilioSignature = 'mock-twilio-signature-for-testing';

/**
 * Creates headers that simulate Twilio webhook requests.
 */
export const createTwilioHeaders = () => ({
  'Content-Type': 'application/x-www-form-urlencoded',
  'X-Twilio-Signature': mockTwilioSignature,
});

// =====================================
// SETUP/TEARDOWN HELPERS
// =====================================

/**
 * Resets all Twilio mocks. Call in afterEach.
 */
export const resetTwilioMocks = () => {
  mockIncomingPhoneNumbersCreate.mockClear();
  mockIncomingPhoneNumbersList.mockClear();
  mockIncomingPhoneNumbersUpdate.mockClear();
  mockIncomingPhoneNumbersRemove.mockClear();
  mockCallsFetch.mockClear();
  mockCallsUpdate.mockClear();
  mockRecordingsFetch.mockClear();
  mockRecordingsRemove.mockClear();
};

/**
 * Configures mockCallsFetch to return a specific call status.
 * Useful for testing caller hangup detection.
 */
export const setMockCallStatus = (status: MockCall['status']) => {
  (mockCallsFetch as MockFn).mockImplementation(async () =>
    createMockCall({ status })
  );
};

/**
 * Configures mockCallsFetch to throw an error.
 * Useful for testing error handling.
 */
export const setMockCallError = (errorMessage: string) => {
  (mockCallsFetch as MockFn).mockRejectedValue(new Error(errorMessage) as unknown);
};

/**
 * Configures mock phone number provisioning to fail.
 */
export const setMockProvisioningError = (errorMessage: string) => {
  (mockIncomingPhoneNumbersCreate as MockFn).mockRejectedValue(new Error(errorMessage) as unknown);
};

/**
 * Configures mock recording download to return specific data.
 */
export const setMockRecordingData = (data: Buffer) => {
  // This would be used with fetch mock, not the Twilio client
};
