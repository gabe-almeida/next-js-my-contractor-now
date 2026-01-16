/**
 * Incoming Call Webhook Handler Tests
 *
 * WHY: Verify the entry point for all inbound calls handles all scenarios correctly.
 * WHEN: Run as part of test suite before deployment.
 * HOW: Test call creation, tracking number lookup, campaign eligibility, and IVR routing.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { NextRequest } from 'next/server';

// Mock dependencies before importing handler
jest.mock('@/lib/prisma', () => ({
  prisma: require('@/test/mocks/prisma').mockPrismaClient,
}));

jest.mock('@/lib/twilio/verify-signature', () => ({
  withTwilioVerification: jest.fn((req, handler) => handler({})),
  createTwimlResponse: jest.fn((twiml: string) => new Response(twiml, {
    headers: { 'Content-Type': 'text/xml' },
  })),
  createWebhookErrorResponse: jest.fn(),
}));

jest.mock('@/lib/twilio/idempotency', () => ({
  isWebhookProcessed: jest.fn().mockResolvedValue(false),
  markWebhookProcessed: jest.fn().mockResolvedValue(undefined),
  markWebhookFailed: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/twilio/logging', () => ({
  logWebhookReceived: jest.fn(),
  createCallActivityLog: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/twilio/twiml-builder', () => ({
  buildIvrGather: jest.fn().mockReturnValue('<Response><Gather/></Response>'),
  buildAnnouncement: jest.fn().mockReturnValue('<Response><Say/><Redirect/></Response>'),
  buildRejection: jest.fn().mockReturnValue('<Response><Say/><Hangup/></Response>'),
}));

jest.mock('@/lib/services/tracking-number-queries', () => ({
  getTrackingNumberByPhone: jest.fn(),
}));

jest.mock('@/lib/services/call-eligibility-service', () => ({
  checkCampaignEligibility: jest.fn().mockResolvedValue({ eligible: true }),
  incrementCallCounter: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/call/call-helpers', () => ({
  maskPhone: jest.fn((phone) => '***-***-' + phone.slice(-4)),
  formatPhoneDisplay: jest.fn((phone) => phone),
}));

jest.mock('@sentry/nextjs', () => ({
  setTag: jest.fn(),
  setExtra: jest.fn(),
  captureException: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import {
  mockPrismaClient,
  mockCall,
  mockCampaign,
  mockTrackingNumber,
  mockIvrFlow,
  resetPrismaMocks,
} from '@/test/mocks/prisma';
import {
  createMockCampaign,
  createMockTrackingNumber,
  createMockIvrFlow,
  resetFixtureCounters,
} from '@/test/fixtures/calls';
import {
  createIncomingCallPayload,
  createTwilioHeaders,
} from '@/test/mocks/twilio';
import { withTwilioVerification } from '@/lib/twilio/verify-signature';
import { getTrackingNumberByPhone } from '@/lib/services/tracking-number-queries';
import { checkCampaignEligibility } from '@/lib/services/call-eligibility-service';
import { isWebhookProcessed } from '@/lib/twilio/idempotency';
import { buildIvrGather, buildAnnouncement, buildRejection } from '@/lib/twilio/twiml-builder';

// Import the handler after mocks are set up
import { POST } from '../incoming/route';

describe('Incoming Call Webhook Handler', () => {
  let mockRequest: NextRequest;

  beforeEach(() => {
    resetPrismaMocks();
    resetFixtureCounters();
    jest.clearAllMocks();

    // Default mock setup
    (withTwilioVerification as jest.Mock).mockImplementation(
      async (req, handler) => {
        const payload = createIncomingCallPayload();
        return handler(payload);
      }
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('tracking number lookup', () => {
    it('should identify tracking number and create call record', async () => {
      // Arrange
      const payload = createIncomingCallPayload({
        To: '+18445551234',
        CallSid: 'CA123456',
      });

      const trackingNumber = createMockTrackingNumber({
        phoneNumber: '+18445551234',
        campaign: createMockCampaign({ requireIvrQualification: false }),
      });

      (withTwilioVerification as jest.Mock).mockImplementation(
        async (req, handler) => handler(payload)
      );

      (getTrackingNumberByPhone as jest.Mock).mockResolvedValue(trackingNumber);
      mockCampaign.findUnique.mockResolvedValue({
        requireIvrQualification: false,
        ivrFlowId: null,
      });
      mockCall.create.mockResolvedValue({
        id: 'call-123',
        twilioCallSid: 'CA123456',
        status: 'RINGING',
      });
      mockCall.update.mockResolvedValue({
        id: 'call-123',
        status: 'BIDDING',
      });

      mockRequest = new NextRequest('http://localhost/api/calls/incoming', {
        method: 'POST',
        headers: createTwilioHeaders(),
      });

      // Act
      const response = await POST(mockRequest);

      // Assert
      expect(getTrackingNumberByPhone).toHaveBeenCalledWith('+18445551234');
      expect(mockCall.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          twilioCallSid: 'CA123456',
          trackingNumberId: trackingNumber.id,
          affiliateId: trackingNumber.affiliateId,
          campaignId: trackingNumber.campaignId,
          status: 'RINGING',
        }),
      });
    });

    it('should return rejection for unknown tracking number', async () => {
      // Arrange
      const payload = createIncomingCallPayload({
        To: '+1unknownnumber',
      });

      (withTwilioVerification as jest.Mock).mockImplementation(
        async (req, handler) => handler(payload)
      );

      (getTrackingNumberByPhone as jest.Mock).mockResolvedValue(null);

      mockRequest = new NextRequest('http://localhost/api/calls/incoming', {
        method: 'POST',
      });

      // Act
      const response = await POST(mockRequest);

      // Assert
      expect(buildRejection).toHaveBeenCalledWith(
        expect.stringContaining('no longer in service')
      );
      expect(mockCall.create).not.toHaveBeenCalled();
    });
  });

  describe('campaign eligibility', () => {
    it('should reject call when campaign is outside hours', async () => {
      // Arrange
      const trackingNumber = createMockTrackingNumber({
        campaign: createMockCampaign(),
      });

      (getTrackingNumberByPhone as jest.Mock).mockResolvedValue(trackingNumber);
      mockCampaign.findUnique.mockResolvedValue(createMockCampaign());
      (checkCampaignEligibility as jest.Mock).mockResolvedValue({
        eligible: false,
        reason: 'outside_hours',
        message: 'We are currently closed. Please call during business hours.',
      });

      (withTwilioVerification as jest.Mock).mockImplementation(
        async (req, handler) => handler(createIncomingCallPayload())
      );

      mockRequest = new NextRequest('http://localhost/api/calls/incoming', {
        method: 'POST',
      });

      // Act
      await POST(mockRequest);

      // Assert
      expect(buildRejection).toHaveBeenCalledWith(
        expect.stringContaining('closed')
      );
      expect(mockCall.create).not.toHaveBeenCalled();
    });

    it('should reject call when campaign is at daily cap', async () => {
      // Arrange
      const trackingNumber = createMockTrackingNumber({
        campaign: createMockCampaign({ dailyCallCap: 100 }),
      });

      (getTrackingNumberByPhone as jest.Mock).mockResolvedValue(trackingNumber);
      mockCampaign.findUnique.mockResolvedValue(createMockCampaign());
      (checkCampaignEligibility as jest.Mock).mockResolvedValue({
        eligible: false,
        reason: 'daily_cap_reached',
        message: 'We cannot accept your call at this time.',
      });

      (withTwilioVerification as jest.Mock).mockImplementation(
        async (req, handler) => handler(createIncomingCallPayload())
      );

      mockRequest = new NextRequest('http://localhost/api/calls/incoming', {
        method: 'POST',
      });

      // Act
      await POST(mockRequest);

      // Assert
      expect(buildRejection).toHaveBeenCalled();
    });
  });

  describe('IVR routing', () => {
    it('should route to IVR when campaign requires qualification', async () => {
      // Arrange
      const ivrFlow = createMockIvrFlow();
      const campaign = createMockCampaign({
        requireIvrQualification: true,
        ivrFlowId: ivrFlow.id,
      });
      const trackingNumber = createMockTrackingNumber({ campaign });

      (getTrackingNumberByPhone as jest.Mock).mockResolvedValue(trackingNumber);
      mockCampaign.findUnique.mockResolvedValue({
        ...campaign,
        requireIvrQualification: true,
        ivrFlowId: ivrFlow.id,
      });
      mockIvrFlow.findUnique.mockResolvedValue(ivrFlow);
      mockCall.create.mockResolvedValue({ id: 'call-123' });
      mockCall.update.mockResolvedValue({ id: 'call-123', status: 'IVR' });

      (withTwilioVerification as jest.Mock).mockImplementation(
        async (req, handler) => handler(createIncomingCallPayload())
      );

      mockRequest = new NextRequest('http://localhost/api/calls/incoming', {
        method: 'POST',
      });

      // Act
      await POST(mockRequest);

      // Assert
      expect(mockCall.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'IVR',
          }),
        })
      );
      expect(buildIvrGather).toHaveBeenCalled();
    });

    it('should skip IVR and go to auction when no IVR configured', async () => {
      // Arrange
      const campaign = createMockCampaign({
        requireIvrQualification: false,
        ivrFlowId: null,
      });
      const trackingNumber = createMockTrackingNumber({ campaign });

      (getTrackingNumberByPhone as jest.Mock).mockResolvedValue(trackingNumber);
      mockCampaign.findUnique.mockResolvedValue({
        ...campaign,
        requireIvrQualification: false,
        ivrFlowId: null,
      });
      mockCall.create.mockResolvedValue({ id: 'call-123' });
      mockCall.update.mockResolvedValue({ id: 'call-123', status: 'BIDDING' });

      (withTwilioVerification as jest.Mock).mockImplementation(
        async (req, handler) => handler(createIncomingCallPayload())
      );

      mockRequest = new NextRequest('http://localhost/api/calls/incoming', {
        method: 'POST',
      });

      // Act
      await POST(mockRequest);

      // Assert
      expect(mockCall.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'BIDDING',
            isQualified: true,
          }),
        })
      );
      expect(buildAnnouncement).toHaveBeenCalledWith(
        expect.stringContaining('connect you with a specialist'),
        expect.any(Object)
      );
    });
  });

  describe('idempotency', () => {
    it('should skip processing for duplicate webhooks', async () => {
      // Arrange
      (isWebhookProcessed as jest.Mock).mockResolvedValue(true);

      (withTwilioVerification as jest.Mock).mockImplementation(
        async (req, handler) => handler(createIncomingCallPayload())
      );

      mockRequest = new NextRequest('http://localhost/api/calls/incoming', {
        method: 'POST',
      });

      // Act
      const response = await POST(mockRequest);

      // Assert
      expect(getTrackingNumberByPhone).not.toHaveBeenCalled();
      expect(mockCall.create).not.toHaveBeenCalled();
    });
  });

  describe('caller information capture', () => {
    it('should capture caller location from Twilio payload', async () => {
      // Arrange
      const payload = createIncomingCallPayload({
        From: '+15551234567',
        FromCity: 'Los Angeles',
        FromState: 'CA',
        FromZip: '90210',
        CallerName: 'Test Caller',
      });

      const trackingNumber = createMockTrackingNumber({
        campaign: createMockCampaign({ requireIvrQualification: false }),
      });

      (getTrackingNumberByPhone as jest.Mock).mockResolvedValue(trackingNumber);
      mockCampaign.findUnique.mockResolvedValue({
        requireIvrQualification: false,
        ivrFlowId: null,
      });
      mockCall.create.mockResolvedValue({ id: 'call-123' });
      mockCall.update.mockResolvedValue({});

      (withTwilioVerification as jest.Mock).mockImplementation(
        async (req, handler) => handler(payload)
      );

      mockRequest = new NextRequest('http://localhost/api/calls/incoming', {
        method: 'POST',
      });

      // Act
      await POST(mockRequest);

      // Assert
      expect(mockCall.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          callerPhone: '+15551234567',
          callerCity: 'Los Angeles',
          callerState: 'CA',
          callerZip: '90210',
          callerName: 'Test Caller',
        }),
      });
    });
  });

  describe('error handling', () => {
    it('should return error TwiML on database failure', async () => {
      // Arrange
      const trackingNumber = createMockTrackingNumber();

      (getTrackingNumberByPhone as jest.Mock).mockResolvedValue(trackingNumber);
      mockCampaign.findUnique.mockResolvedValue(createMockCampaign());
      mockCall.create.mockRejectedValue(new Error('Database connection failed'));

      (withTwilioVerification as jest.Mock).mockImplementation(
        async (req, handler) => handler(createIncomingCallPayload())
      );

      mockRequest = new NextRequest('http://localhost/api/calls/incoming', {
        method: 'POST',
      });

      // Act
      await POST(mockRequest);

      // Assert
      expect(buildRejection).toHaveBeenCalledWith(
        expect.stringContaining('technical difficulties')
      );
    });
  });
});
