/**
 * Test Fixtures for Pay-Per-Call System
 *
 * WHY: Provides consistent, realistic test data for all call-related tests.
 *      Ensures tests use data that matches actual database schemas.
 *
 * WHEN: Import and use these fixtures in test files for setup/assertions.
 *
 * HOW: Export factory functions that create test objects with sensible defaults.
 *      Each factory allows overrides for specific test scenarios.
 */

import { Decimal } from '@prisma/client/runtime/library';

// =====================================
// TYPE DEFINITIONS (match Prisma types)
// =====================================

export interface MockCall {
  id: string;
  twilioCallSid: string;
  trackingNumberId: string | null;
  affiliateId: string | null;
  campaignId: string | null;
  serviceTypeId: string | null;
  callerPhone: string;
  callerPhoneDisplay: string | null;
  callerCity: string | null;
  callerState: string | null;
  callerZip: string | null;
  callerName: string | null;
  ivrResponses: Record<string, unknown> | null;
  isQualified: boolean;
  auctionStartedAt: Date | null;
  auctionCompletedAt: Date | null;
  auctionDurationMs: number | null;
  eligibleBuyersCount: number | null;
  status: string;
  previousStatus: string | null;
  statusChangedAt: Date | null;
  winningBuyerId: string | null;
  winningBid: Decimal | null;
  transferPhoneNumber: string | null;
  answeredAt: Date | null;
  ivrCompletedAt: Date | null;
  connectedAt: Date | null;
  endedAt: Date | null;
  totalDurationSeconds: number | null;
  connectedDurationSeconds: number | null;
  disposition: string | null;
  hangupReason: string | null;
  recordingSid: string | null;
  recordingUrl: string | null;
  recordingDurationSeconds: number | null;
  recordingStatus: string;
  isBillable: boolean;
  affiliatePayout: Decimal | null;
  buyerCharge: Decimal | null;
  platformMargin: Decimal | null;
  postbackSent: boolean;
  postbackSentAt: Date | null;
  postbackResponse: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MockCampaign {
  id: string;
  name: string;
  active: boolean;
  serviceTypeId: string;
  callBasePayout: Decimal;
  minCallDuration: number;
  requireIvrQualification: boolean;
  hoursOfOperation: Record<string, unknown> | null;
  timezone: string;
  dailyCallCap: number | null;
  ivrFlowId: string | null;
}

export interface MockBuyer {
  id: string;
  name: string;
  type: 'CONTRACTOR' | 'NETWORK';
  active: boolean;
  acceptsCalls: boolean;
  callForwardingNumber: string | null;
  callBackupNumber: string | null;
  callRingTimeout: number;
  authType: string | null;
  authConfig: string | null;
}

export interface MockBuyerServiceConfig {
  id: string;
  buyerId: string;
  serviceTypeId: string;
  active: boolean;
  callBidAmount: Decimal | null;
  callDailyCap: number | null;
  callMinBid: Decimal | null;
  callMaxBid: Decimal | null;
  callPingUrl: string | null;
  buyer?: MockBuyer;
}

export interface MockTrackingNumber {
  id: string;
  affiliateId: string;
  campaignId: string;
  serviceTypeId: string;
  phoneNumber: string;
  phoneNumberDisplay: string | null;
  twilioSid: string | null;
  provisioningType: 'PLATFORM' | 'EXTERNAL';
  provisioningStatus: 'PENDING' | 'PROVISIONING' | 'ACTIVE' | 'RELEASING' | 'RELEASED' | 'FAILED';
  active: boolean;
  ivrFlowId: string | null;
  campaign?: MockCampaign;
  affiliate?: MockAffiliate;
}

export interface MockAffiliate {
  id: string;
  name: string;
  email: string;
  postbackUrl: string | null;
  postbackMethod: string;
  active: boolean;
}

export interface MockServiceType {
  id: string;
  name: string;
  displayName: string;
  active: boolean;
}

export interface MockIvrFlow {
  id: string;
  name: string;
  steps: Array<{ step: number; prompt: string; validResponses: string[] }>;
  defaultTimeout: number;
  active: boolean;
}

export interface MockCallBid {
  id: string;
  callId: string;
  buyerId: string;
  bidAmount: Decimal;
  responseTimeMs: number;
  bidStatus: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
  transferNumber: string | null;
  pingResponse: Record<string, unknown> | null;
  createdAt: Date;
}

// =====================================
// FACTORY FUNCTIONS
// =====================================

let callCounter = 0;
let buyerCounter = 0;
let affiliateCounter = 0;

/**
 * Creates a mock call with sensible defaults.
 */
export const createMockCall = (overrides: Partial<MockCall> = {}): MockCall => {
  callCounter++;
  const now = new Date();

  return {
    id: `call-${callCounter}`,
    twilioCallSid: `CA${Math.random().toString(36).substring(2, 15)}`,
    trackingNumberId: 'tracking-1',
    affiliateId: 'affiliate-1',
    campaignId: 'campaign-1',
    serviceTypeId: 'service-windows',
    callerPhone: '+15551234567',
    callerPhoneDisplay: '(555) 123-4567',
    callerCity: 'Los Angeles',
    callerState: 'CA',
    callerZip: '90210',
    callerName: 'John Doe',
    ivrResponses: {},
    isQualified: false,
    auctionStartedAt: null,
    auctionCompletedAt: null,
    auctionDurationMs: null,
    eligibleBuyersCount: null,
    status: 'RINGING',
    previousStatus: null,
    statusChangedAt: now,
    winningBuyerId: null,
    winningBid: null,
    transferPhoneNumber: null,
    answeredAt: null,
    ivrCompletedAt: null,
    connectedAt: null,
    endedAt: null,
    totalDurationSeconds: null,
    connectedDurationSeconds: null,
    disposition: null,
    hangupReason: null,
    recordingSid: null,
    recordingUrl: null,
    recordingDurationSeconds: null,
    recordingStatus: 'PENDING',
    isBillable: false,
    affiliatePayout: null,
    buyerCharge: null,
    platformMargin: null,
    postbackSent: false,
    postbackSentAt: null,
    postbackResponse: null,
    version: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
};

/**
 * Creates a mock call in BIDDING state (ready for auction).
 */
export const createMockBiddingCall = (overrides: Partial<MockCall> = {}): MockCall => {
  return createMockCall({
    status: 'BIDDING',
    isQualified: true,
    ivrCompletedAt: new Date(),
    ...overrides,
  });
};

/**
 * Creates a mock call in COMPLETED state with billable payout.
 */
export const createMockCompletedCall = (overrides: Partial<MockCall> = {}): MockCall => {
  return createMockCall({
    status: 'COMPLETED',
    isQualified: true,
    isBillable: true,
    winningBuyerId: 'buyer-1',
    winningBid: new Decimal(45),
    transferPhoneNumber: '+15559876543',
    connectedDurationSeconds: 120,
    totalDurationSeconds: 180,
    disposition: 'ANSWERED',
    affiliatePayout: new Decimal(35),
    buyerCharge: new Decimal(45),
    platformMargin: new Decimal(10),
    endedAt: new Date(),
    ...overrides,
  });
};

/**
 * Creates a mock campaign.
 */
export const createMockCampaign = (overrides: Partial<MockCampaign> = {}): MockCampaign => {
  return {
    id: 'campaign-1',
    name: 'Test Windows Campaign',
    active: true,
    serviceTypeId: 'service-windows',
    callBasePayout: new Decimal(35),
    minCallDuration: 90,
    requireIvrQualification: true,
    hoursOfOperation: {
      monday: { open: '09:00', close: '17:00' },
      tuesday: { open: '09:00', close: '17:00' },
      wednesday: { open: '09:00', close: '17:00' },
      thursday: { open: '09:00', close: '17:00' },
      friday: { open: '09:00', close: '17:00' },
    },
    timezone: 'America/New_York',
    dailyCallCap: 100,
    ivrFlowId: 'ivr-1',
    ...overrides,
  };
};

/**
 * Creates a mock buyer (contractor or network).
 */
export const createMockBuyer = (overrides: Partial<MockBuyer> = {}): MockBuyer => {
  buyerCounter++;
  return {
    id: `buyer-${buyerCounter}`,
    name: `Test Contractor ${buyerCounter}`,
    type: 'CONTRACTOR',
    active: true,
    acceptsCalls: true,
    callForwardingNumber: `+1555000${1000 + buyerCounter}`,
    callBackupNumber: null,
    callRingTimeout: 30,
    authType: null,
    authConfig: null,
    ...overrides,
  };
};

/**
 * Creates a mock network buyer with PING URL.
 */
export const createMockNetworkBuyer = (overrides: Partial<MockBuyer> = {}): MockBuyer => {
  return createMockBuyer({
    type: 'NETWORK',
    callForwardingNumber: null,
    ...overrides,
  });
};

/**
 * Creates a mock buyer service configuration.
 */
export const createMockBuyerServiceConfig = (
  overrides: Partial<MockBuyerServiceConfig> = {}
): MockBuyerServiceConfig => {
  return {
    id: `config-${Math.random().toString(36).substring(2, 9)}`,
    buyerId: 'buyer-1',
    serviceTypeId: 'service-windows',
    active: true,
    callBidAmount: new Decimal(45),
    callDailyCap: 50,
    callMinBid: new Decimal(20),
    callMaxBid: new Decimal(100),
    callPingUrl: null,
    ...overrides,
  };
};

/**
 * Creates a mock network buyer config with PING URL.
 */
export const createMockNetworkConfig = (
  overrides: Partial<MockBuyerServiceConfig> = {}
): MockBuyerServiceConfig => {
  return createMockBuyerServiceConfig({
    callPingUrl: 'https://network.example.com/api/ping',
    ...overrides,
  });
};

/**
 * Creates a mock tracking number.
 */
export const createMockTrackingNumber = (
  overrides: Partial<MockTrackingNumber> = {}
): MockTrackingNumber => {
  return {
    id: 'tracking-1',
    affiliateId: 'affiliate-1',
    campaignId: 'campaign-1',
    serviceTypeId: 'service-windows',
    phoneNumber: '+18445551234',
    phoneNumberDisplay: '(844) 555-1234',
    twilioSid: 'PN123456789',
    provisioningType: 'PLATFORM',
    provisioningStatus: 'ACTIVE',
    active: true,
    ivrFlowId: null,
    ...overrides,
  };
};

/**
 * Creates a mock affiliate.
 */
export const createMockAffiliate = (overrides: Partial<MockAffiliate> = {}): MockAffiliate => {
  affiliateCounter++;
  return {
    id: `affiliate-${affiliateCounter}`,
    name: `Test Affiliate ${affiliateCounter}`,
    email: `affiliate${affiliateCounter}@example.com`,
    postbackUrl: 'https://affiliate.example.com/postback',
    postbackMethod: 'POST',
    active: true,
    ...overrides,
  };
};

/**
 * Creates a mock service type.
 */
export const createMockServiceType = (overrides: Partial<MockServiceType> = {}): MockServiceType => {
  return {
    id: 'service-windows',
    name: 'windows',
    displayName: 'Window Installation',
    active: true,
    ...overrides,
  };
};

/**
 * Creates a mock IVR flow.
 */
export const createMockIvrFlow = (overrides: Partial<MockIvrFlow> = {}): MockIvrFlow => {
  return {
    id: 'ivr-1',
    name: 'Homeowner Qualification',
    steps: [
      {
        step: 1,
        prompt: 'Press 1 if you are a homeowner. Press 2 if you rent.',
        validResponses: ['1', '2'],
      },
    ],
    defaultTimeout: 10,
    active: true,
    ...overrides,
  };
};

/**
 * Creates a mock call bid.
 */
export const createMockCallBid = (overrides: Partial<MockCallBid> = {}): MockCallBid => {
  return {
    id: `bid-${Math.random().toString(36).substring(2, 9)}`,
    callId: 'call-1',
    buyerId: 'buyer-1',
    bidAmount: new Decimal(45),
    responseTimeMs: 150,
    bidStatus: 'PENDING',
    transferNumber: '+15559876543',
    pingResponse: null,
    createdAt: new Date(),
    ...overrides,
  };
};

// =====================================
// COMPLEX FIXTURE SCENARIOS
// =====================================

/**
 * Creates a complete set of fixtures for a standard call auction scenario.
 */
export const createAuctionScenario = () => {
  const campaign = createMockCampaign();
  const affiliate = createMockAffiliate();
  const trackingNumber = createMockTrackingNumber({ campaign, affiliate });
  const serviceType = createMockServiceType();

  const buyer1 = createMockBuyer({ id: 'buyer-1', name: 'Premium Contractor' });
  const buyer2 = createMockBuyer({ id: 'buyer-2', name: 'Standard Contractor' });
  const buyer3 = createMockNetworkBuyer({ id: 'buyer-3', name: 'Partner Network' });

  const config1 = createMockBuyerServiceConfig({
    buyerId: 'buyer-1',
    callBidAmount: new Decimal(50),
    buyer: buyer1,
  });
  const config2 = createMockBuyerServiceConfig({
    buyerId: 'buyer-2',
    callBidAmount: new Decimal(40),
    buyer: buyer2,
  });
  const config3 = createMockNetworkConfig({
    buyerId: 'buyer-3',
    callBidAmount: new Decimal(45),
    buyer: buyer3,
  });

  const call = createMockBiddingCall({
    campaignId: campaign.id,
    affiliateId: affiliate.id,
    trackingNumberId: trackingNumber.id,
    serviceTypeId: serviceType.id,
  });

  return {
    call,
    campaign,
    affiliate,
    trackingNumber,
    serviceType,
    buyers: [buyer1, buyer2, buyer3],
    configs: [config1, config2, config3],
  };
};

/**
 * Creates fixtures for no-bids scenario (all buyers at cap).
 */
export const createNoBidsScenario = () => {
  const base = createAuctionScenario();

  // Set all configs to have 0 daily cap remaining
  base.configs = base.configs.map((config) => ({
    ...config,
    callDailyCap: 0, // Already at cap
  }));

  return base;
};

/**
 * Creates fixtures for caller hangup scenario.
 */
export const createCallerHangupScenario = () => {
  const base = createAuctionScenario();

  // Call will be marked as hung up
  base.call = createMockCall({
    ...base.call,
    status: 'CALLER_HANGUP',
    hangupReason: 'CALLER_ABANDONED_DURING_AUCTION',
    endedAt: new Date(),
  });

  return base;
};

// =====================================
// RESET HELPERS
// =====================================

/**
 * Resets fixture counters. Call in beforeEach for consistent IDs.
 */
export const resetFixtureCounters = () => {
  callCounter = 0;
  buyerCounter = 0;
  affiliateCounter = 0;
};
