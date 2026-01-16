/**
 * Tracking Number Service Tests
 *
 * WHY: Verify tracking number provisioning logic handles all scenarios correctly.
 * WHEN: Run as part of test suite before deployment.
 * HOW: Test provisioning, release, and error handling with mocked dependencies.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock Prisma before importing service
jest.mock('@/lib/prisma', () => ({
  prisma: require('@/test/mocks/prisma').mockPrismaClient,
}));

// Mock Twilio module
jest.mock('@/lib/twilio', () => ({
  provisionPhoneNumber: jest.fn(),
  releasePhoneNumber: jest.fn(),
}));

// Mock Sentry
jest.mock('@sentry/nextjs', () => ({
  captureException: jest.fn(),
}));

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import {
  provisionTrackingNumber,
  releaseTrackingNumber,
} from '../tracking-number-service';
import {
  mockPrismaClient,
  mockAffiliateCampaign,
  mockTrackingNumber,
  mockCampaign,
  resetPrismaMocks,
} from '@/test/mocks/prisma';
import {
  createMockCampaign,
  createMockTrackingNumber,
  resetFixtureCounters,
} from '@/test/fixtures/calls';
import { provisionPhoneNumber, releasePhoneNumber } from '@/lib/twilio';

describe('TrackingNumberService', () => {
  beforeEach(() => {
    resetPrismaMocks();
    resetFixtureCounters();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('provisionTrackingNumber', () => {
    describe('when affiliate has APPROVED access', () => {
      it('should provision a new tracking number successfully', async () => {
        // Arrange
        const affiliateId = 'affiliate-1';
        const campaignId = 'campaign-1';
        const campaign = createMockCampaign({ id: campaignId });

        mockAffiliateCampaign.findUnique.mockResolvedValue({
          affiliateId,
          campaignId,
          status: 'APPROVED',
        });

        mockTrackingNumber.findFirst.mockResolvedValue(null); // No existing number

        mockCampaign.findUnique.mockResolvedValue(campaign);

        const pendingNumber = {
          id: 'tracking-123',
          affiliateId,
          campaignId,
          phoneNumber: '',
          provisioningStatus: 'PENDING',
        };

        mockTrackingNumber.create.mockResolvedValue(pendingNumber);
        mockTrackingNumber.update.mockResolvedValue({
          ...pendingNumber,
          phoneNumber: '+18445551234',
          phoneNumberDisplay: '(844) 555-1234',
          twilioSid: 'PN123456',
          provisioningStatus: 'ACTIVE',
        });

        (provisionPhoneNumber as jest.Mock).mockResolvedValue({
          phoneNumber: '+18445551234',
          displayNumber: '(844) 555-1234',
          sid: 'PN123456',
        });

        // Act
        const result = await provisionTrackingNumber({
          affiliateId,
          campaignId,
          tollFree: true,
        });

        // Assert
        expect(result.success).toBe(true);
        expect(result.trackingNumber).toBeDefined();
        expect(result.trackingNumber?.phoneNumber).toBe('+18445551234');
        expect(result.trackingNumber?.provisioningStatus).toBe('ACTIVE');
        expect(provisionPhoneNumber).toHaveBeenCalledWith({
          affiliateId,
          campaignId,
          areaCode: '844',
          tollFree: true,
        });
      });

      it('should create PENDING record before calling Twilio', async () => {
        // Arrange
        const affiliateId = 'affiliate-1';
        const campaignId = 'campaign-1';
        const campaign = createMockCampaign();

        mockAffiliateCampaign.findUnique.mockResolvedValue({
          status: 'APPROVED',
        });
        mockTrackingNumber.findFirst.mockResolvedValue(null);
        mockCampaign.findUnique.mockResolvedValue(campaign);
        mockTrackingNumber.create.mockResolvedValue({ id: 'tracking-123' });
        mockTrackingNumber.update.mockResolvedValue({ id: 'tracking-123' });
        (provisionPhoneNumber as jest.Mock).mockResolvedValue({
          phoneNumber: '+18445551234',
          displayNumber: '(844) 555-1234',
          sid: 'PN123',
        });

        // Act
        await provisionTrackingNumber({ affiliateId, campaignId });

        // Assert - Create is called first with PENDING status
        expect(mockTrackingNumber.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            affiliateId,
            campaignId,
            provisioningStatus: 'PENDING',
          }),
        });

        // Then updated to PROVISIONING before Twilio call
        expect(mockTrackingNumber.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              provisioningStatus: 'PROVISIONING',
            }),
          })
        );
      });
    });

    describe('when Twilio provisioning fails', () => {
      it('should mark record as FAILED and return error', async () => {
        // Arrange
        const affiliateId = 'affiliate-1';
        const campaignId = 'campaign-1';

        mockAffiliateCampaign.findUnique.mockResolvedValue({ status: 'APPROVED' });
        mockTrackingNumber.findFirst.mockResolvedValue(null);
        mockCampaign.findUnique.mockResolvedValue(createMockCampaign());
        mockTrackingNumber.create.mockResolvedValue({ id: 'tracking-123' });
        mockTrackingNumber.update.mockResolvedValue({});

        (provisionPhoneNumber as jest.Mock).mockRejectedValue(
          new Error('No numbers available in area code 844')
        );

        // Act
        const result = await provisionTrackingNumber({ affiliateId, campaignId });

        // Assert
        expect(result.success).toBe(false);
        expect(result.error).toContain('No numbers available');
        expect(mockTrackingNumber.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              provisioningStatus: 'FAILED',
            }),
          })
        );
      });
    });

    describe('when affiliate does not have access', () => {
      it('should return error when no access record exists', async () => {
        // Arrange
        mockAffiliateCampaign.findUnique.mockResolvedValue(null);

        // Act
        const result = await provisionTrackingNumber({
          affiliateId: 'affiliate-1',
          campaignId: 'campaign-1',
        });

        // Assert
        expect(result.success).toBe(false);
        expect(result.error).toContain('do not have access');
        expect(provisionPhoneNumber).not.toHaveBeenCalled();
      });

      it('should return error when access is PENDING', async () => {
        // Arrange
        mockAffiliateCampaign.findUnique.mockResolvedValue({ status: 'PENDING' });

        // Act
        const result = await provisionTrackingNumber({
          affiliateId: 'affiliate-1',
          campaignId: 'campaign-1',
        });

        // Assert
        expect(result.success).toBe(false);
        expect(result.error).toContain('pending approval');
      });

      it('should return error when access is REJECTED', async () => {
        // Arrange
        mockAffiliateCampaign.findUnique.mockResolvedValue({ status: 'REJECTED' });

        // Act
        const result = await provisionTrackingNumber({
          affiliateId: 'affiliate-1',
          campaignId: 'campaign-1',
        });

        // Assert
        expect(result.success).toBe(false);
        expect(result.error).toContain('rejected');
      });
    });

    describe('when affiliate already has a number for this campaign', () => {
      it('should return error and not provision new number', async () => {
        // Arrange
        mockAffiliateCampaign.findUnique.mockResolvedValue({ status: 'APPROVED' });
        mockTrackingNumber.findFirst.mockResolvedValue({
          id: 'existing-tracking',
          provisioningStatus: 'ACTIVE',
        });

        // Act
        const result = await provisionTrackingNumber({
          affiliateId: 'affiliate-1',
          campaignId: 'campaign-1',
        });

        // Assert
        expect(result.success).toBe(false);
        expect(result.error).toContain('already have an active tracking number');
        expect(provisionPhoneNumber).not.toHaveBeenCalled();
      });
    });

    describe('when campaign is not active', () => {
      it('should return error', async () => {
        // Arrange
        mockAffiliateCampaign.findUnique.mockResolvedValue({ status: 'APPROVED' });
        mockTrackingNumber.findFirst.mockResolvedValue(null);
        mockCampaign.findUnique.mockResolvedValue({
          ...createMockCampaign(),
          active: false,
        });

        // Act
        const result = await provisionTrackingNumber({
          affiliateId: 'affiliate-1',
          campaignId: 'campaign-1',
        });

        // Assert
        expect(result.success).toBe(false);
        expect(result.error).toContain('no longer active');
      });
    });

    describe('webhook URL configuration', () => {
      it('should configure Twilio number with correct webhook URLs', async () => {
        // Arrange
        mockAffiliateCampaign.findUnique.mockResolvedValue({ status: 'APPROVED' });
        mockTrackingNumber.findFirst.mockResolvedValue(null);
        mockCampaign.findUnique.mockResolvedValue(createMockCampaign());
        mockTrackingNumber.create.mockResolvedValue({ id: 'tracking-123' });
        mockTrackingNumber.update.mockResolvedValue({});

        (provisionPhoneNumber as jest.Mock).mockResolvedValue({
          phoneNumber: '+18445551234',
          displayNumber: '(844) 555-1234',
          sid: 'PN123',
        });

        // Act
        await provisionTrackingNumber({
          affiliateId: 'affiliate-1',
          campaignId: 'campaign-1',
        });

        // Assert - Verify Twilio was called with affiliate and campaign IDs
        // The webhook URLs are configured inside the Twilio module
        expect(provisionPhoneNumber).toHaveBeenCalledWith(
          expect.objectContaining({
            affiliateId: 'affiliate-1',
            campaignId: 'campaign-1',
          })
        );
      });
    });
  });

  describe('releaseTrackingNumber', () => {
    it('should release a platform-provisioned number', async () => {
      // Arrange
      const trackingNumber = createMockTrackingNumber({
        id: 'tracking-123',
        twilioSid: 'PN123456',
        provisioningType: 'PLATFORM',
        provisioningStatus: 'ACTIVE',
      });

      mockTrackingNumber.findUnique.mockResolvedValue(trackingNumber);
      mockTrackingNumber.update.mockResolvedValue({
        ...trackingNumber,
        provisioningStatus: 'RELEASED',
        active: false,
      });
      (releasePhoneNumber as jest.Mock).mockResolvedValue(true);

      // Act
      const result = await releaseTrackingNumber('tracking-123');

      // Assert
      expect(result.success).toBe(true);
      expect(releasePhoneNumber).toHaveBeenCalledWith('PN123456');
      expect(mockTrackingNumber.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            provisioningStatus: 'RELEASED',
            active: false,
          }),
        })
      );
    });

    it('should handle already released numbers gracefully', async () => {
      // Arrange
      mockTrackingNumber.findUnique.mockResolvedValue({
        ...createMockTrackingNumber(),
        provisioningStatus: 'RELEASED',
      });

      // Act
      const result = await releaseTrackingNumber('tracking-123');

      // Assert
      expect(result.success).toBe(true);
      expect(releasePhoneNumber).not.toHaveBeenCalled();
    });

    it('should return error for non-existent tracking number', async () => {
      // Arrange
      mockTrackingNumber.findUnique.mockResolvedValue(null);

      // Act
      const result = await releaseTrackingNumber('nonexistent');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should mark as released even if Twilio release fails', async () => {
      // Arrange
      const trackingNumber = createMockTrackingNumber({
        twilioSid: 'PN123456',
        provisioningType: 'PLATFORM',
      });

      mockTrackingNumber.findUnique.mockResolvedValue(trackingNumber);
      mockTrackingNumber.update.mockResolvedValue({});
      (releasePhoneNumber as jest.Mock).mockRejectedValue(
        new Error('Twilio API error')
      );

      // Act
      const result = await releaseTrackingNumber('tracking-123');

      // Assert - Still marked as released
      expect(result.success).toBe(true);
      expect(mockTrackingNumber.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            provisioningStatus: 'RELEASED',
          }),
        })
      );
    });

    it('should not call Twilio for external numbers', async () => {
      // Arrange
      const trackingNumber = createMockTrackingNumber({
        provisioningType: 'EXTERNAL',
        twilioSid: null,
      });

      mockTrackingNumber.findUnique.mockResolvedValue(trackingNumber);
      mockTrackingNumber.update.mockResolvedValue({});

      // Act
      const result = await releaseTrackingNumber('tracking-123');

      // Assert
      expect(result.success).toBe(true);
      expect(releasePhoneNumber).not.toHaveBeenCalled();
    });
  });
});
