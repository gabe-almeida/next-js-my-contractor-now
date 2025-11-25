/**
 * Unit tests for Worker database query fixes
 * Tests the critical getActiveBuyers() method
 */

import { PrismaClient } from '@prisma/client';

// Mock Prisma
const mockPrismaFindMany = jest.fn();

jest.mock('@/lib/db', () => ({
  prisma: {
    buyer: {
      findMany: mockPrismaFindMany,
    },
  },
}));

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
  logLeadProcessing: jest.fn(),
}));

// Mock redis
jest.mock('@/config/redis', () => ({
  LeadQueue: {
    getJob: jest.fn(),
    retryJob: jest.fn(),
    getQueueLength: jest.fn(),
  },
  RedisCache: {
    get: jest.fn(),
    set: jest.fn(),
  },
}));

// Mock utils
jest.mock('@/lib/utils', () => ({
  retryWithBackoff: jest.fn((fn) => fn()),
  applyTemplate: jest.fn((template, data) => ({ ...template, ...data })),
  transformLeadForBuyer: jest.fn((data, mappings) => data),
}));

// Mock node-cron
jest.mock('node-cron', () => ({
  default: {
    schedule: jest.fn(),
  },
  schedule: jest.fn(),
}), { virtual: true });

// Import after mocking
import { LeadProcessingWorker } from '@/lib/worker';

describe('Worker Database Query Fixes', () => {
  let worker: LeadProcessingWorker;

  beforeEach(() => {
    jest.clearAllMocks();
    worker = new LeadProcessingWorker();
  });

  describe('getActiveBuyers()', () => {
    it('should return empty array when no buyers exist', async () => {
      mockPrismaFindMany.mockResolvedValue([]);

      const result = await (worker as any).getActiveBuyers('service-123');

      expect(result).toEqual([]);
      expect(mockPrismaFindMany).toHaveBeenCalledTimes(1);
    });

    it('should return only active buyers', async () => {
      mockPrismaFindMany.mockResolvedValue([
        {
          id: 'buyer-1',
          name: 'Buyer One',
          apiUrl: 'https://buyer1.com/api',
          authType: 'apikey',
          authConfig: { apiKey: 'key1' },
          active: true,
          buyerServiceConfigs: [
            {
              pingTemplate: { field1: 'value1' },
              postTemplate: { field2: 'value2' },
              fieldMappings: { name: 'full_name' },
              minBid: 10,
              maxBid: 100,
              serviceType: { id: 'service-123', name: 'Roofing' },
            },
          ],
        },
      ]);

      const result = await (worker as any).getActiveBuyers('service-123');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('buyer-1');
      expect(result[0].active).toBe(true);
    });

    it('should filter by service type correctly', async () => {
      mockPrismaFindMany.mockResolvedValue([
        {
          id: 'buyer-1',
          name: 'Buyer One',
          apiUrl: 'https://buyer1.com/api',
          authType: 'bearer',
          authConfig: { token: 'token1' },
          active: true,
          buyerServiceConfigs: [
            {
              pingTemplate: {},
              postTemplate: {},
              fieldMappings: {},
              minBid: 5,
              maxBid: 50,
              serviceType: { id: 'service-456', name: 'HVAC' },
            },
          ],
        },
      ]);

      await (worker as any).getActiveBuyers('service-456');

      const callArgs = mockPrismaFindMany.mock.calls[0][0];
      expect(callArgs.where.buyerServiceConfigs.some.serviceTypeId).toBe('service-456');
      expect(callArgs.include.buyerServiceConfigs.where.serviceTypeId).toBe('service-456');
    });

    it('should include service configuration', async () => {
      mockPrismaFindMany.mockResolvedValue([
        {
          id: 'buyer-2',
          name: 'Buyer Two',
          apiUrl: 'https://buyer2.com/api',
          authType: 'basic',
          authConfig: { username: 'user', password: 'pass' },
          active: true,
          buyerServiceConfigs: [
            {
              pingTemplate: { ping: 'template' },
              postTemplate: { post: 'template' },
              fieldMappings: { email: 'contact_email' },
              minBid: 15,
              maxBid: 150,
              serviceType: { id: 'service-789', name: 'Plumbing' },
            },
          ],
        },
      ]);

      const result = await (worker as any).getActiveBuyers('service-789');

      expect(result[0].serviceConfig).toBeDefined();
      expect(result[0].serviceConfig.pingTemplate).toEqual({ ping: 'template' });
      expect(result[0].serviceConfig.postTemplate).toEqual({ post: 'template' });
      expect(result[0].serviceConfig.fieldMappings).toEqual({ email: 'contact_email' });
      expect(result[0].serviceConfig.bidFloor).toBe(15);
      expect(result[0].serviceConfig.bidCeiling).toBe(150);
    });

    it('should return proper data structure', async () => {
      mockPrismaFindMany.mockResolvedValue([
        {
          id: 'buyer-3',
          name: 'Buyer Three',
          apiUrl: 'https://buyer3.com/api',
          authType: 'apikey',
          authConfig: { apiKey: 'key3' },
          active: true,
          buyerServiceConfigs: [
            {
              pingTemplate: {},
              postTemplate: {},
              fieldMappings: {},
              minBid: 20,
              maxBid: 200,
              serviceType: { id: 'service-abc', name: 'Electrical' },
            },
          ],
        },
      ]);

      const result = await (worker as any).getActiveBuyers('service-abc');

      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('apiUrl');
      expect(result[0]).toHaveProperty('authType');
      expect(result[0]).toHaveProperty('authConfig');
      expect(result[0]).toHaveProperty('active');
      expect(result[0]).toHaveProperty('serviceConfig');

      expect(result[0].authConfig).toHaveProperty('type');
      expect(result[0].authConfig).toHaveProperty('credentials');

      expect(result[0].serviceConfig).toHaveProperty('pingTemplate');
      expect(result[0].serviceConfig).toHaveProperty('postTemplate');
      expect(result[0].serviceConfig).toHaveProperty('fieldMappings');
      expect(result[0].serviceConfig).toHaveProperty('bidFloor');
      expect(result[0].serviceConfig).toHaveProperty('bidCeiling');
    });

    it('should handle multiple buyers correctly', async () => {
      mockPrismaFindMany.mockResolvedValue([
        {
          id: 'buyer-1',
          name: 'Buyer One',
          apiUrl: 'https://buyer1.com/api',
          authType: 'apikey',
          authConfig: { apiKey: 'key1' },
          active: true,
          buyerServiceConfigs: [
            {
              pingTemplate: {},
              postTemplate: {},
              fieldMappings: {},
              minBid: 10,
              maxBid: 100,
              serviceType: { id: 'service-123', name: 'Service' },
            },
          ],
        },
        {
          id: 'buyer-2',
          name: 'Buyer Two',
          apiUrl: 'https://buyer2.com/api',
          authType: 'bearer',
          authConfig: { token: 'token2' },
          active: true,
          buyerServiceConfigs: [
            {
              pingTemplate: {},
              postTemplate: {},
              fieldMappings: {},
              minBid: 20,
              maxBid: 200,
              serviceType: { id: 'service-123', name: 'Service' },
            },
          ],
        },
        {
          id: 'buyer-3',
          name: 'Buyer Three',
          apiUrl: 'https://buyer3.com/api',
          authType: 'basic',
          authConfig: { username: 'user', password: 'pass' },
          active: true,
          buyerServiceConfigs: [
            {
              pingTemplate: {},
              postTemplate: {},
              fieldMappings: {},
              minBid: 15,
              maxBid: 150,
              serviceType: { id: 'service-123', name: 'Service' },
            },
          ],
        },
      ]);

      const result = await (worker as any).getActiveBuyers('service-123');

      expect(result).toHaveLength(3);
      expect(result.map((b: any) => b.id)).toEqual(['buyer-1', 'buyer-2', 'buyer-3']);
    });

    it('should handle null apiUrl gracefully', async () => {
      mockPrismaFindMany.mockResolvedValue([
        {
          id: 'buyer-4',
          name: 'Buyer Four',
          apiUrl: null,
          authType: 'apikey',
          authConfig: { apiKey: 'key4' },
          active: true,
          buyerServiceConfigs: [
            {
              pingTemplate: {},
              postTemplate: {},
              fieldMappings: {},
              minBid: 10,
              maxBid: 100,
              serviceType: { id: 'service-def', name: 'Service' },
            },
          ],
        },
      ]);

      const result = await (worker as any).getActiveBuyers('service-def');

      expect(result[0].apiUrl).toBe('');
    });

    it('should handle null authConfig gracefully', async () => {
      mockPrismaFindMany.mockResolvedValue([
        {
          id: 'buyer-5',
          name: 'Buyer Five',
          apiUrl: 'https://buyer5.com/api',
          authType: 'none',
          authConfig: null,
          active: true,
          buyerServiceConfigs: [
            {
              pingTemplate: {},
              postTemplate: {},
              fieldMappings: {},
              minBid: 10,
              maxBid: 100,
              serviceType: { id: 'service-ghi', name: 'Service' },
            },
          ],
        },
      ]);

      const result = await (worker as any).getActiveBuyers('service-ghi');

      expect(result[0].authConfig.credentials).toEqual({});
    });

    it('should handle null template fields gracefully', async () => {
      mockPrismaFindMany.mockResolvedValue([
        {
          id: 'buyer-6',
          name: 'Buyer Six',
          apiUrl: 'https://buyer6.com/api',
          authType: 'apikey',
          authConfig: { apiKey: 'key6' },
          active: true,
          buyerServiceConfigs: [
            {
              pingTemplate: null,
              postTemplate: null,
              fieldMappings: null,
              minBid: null,
              maxBid: null,
              serviceType: { id: 'service-jkl', name: 'Service' },
            },
          ],
        },
      ]);

      const result = await (worker as any).getActiveBuyers('service-jkl');

      expect(result[0].serviceConfig.pingTemplate).toEqual({});
      expect(result[0].serviceConfig.postTemplate).toEqual({});
      expect(result[0].serviceConfig.fieldMappings).toEqual({});
      expect(result[0].serviceConfig.bidFloor).toBe(0);
      expect(result[0].serviceConfig.bidCeiling).toBe(999);
    });

    it('should handle database errors gracefully', async () => {
      mockPrismaFindMany.mockRejectedValue(new Error('Database connection failed'));

      const result = await (worker as any).getActiveBuyers('service-error');

      expect(result).toEqual([]);
    });

    it('should handle null/undefined serviceTypeId gracefully', async () => {
      mockPrismaFindMany.mockResolvedValue([]);

      const result1 = await (worker as any).getActiveBuyers(null);
      const result2 = await (worker as any).getActiveBuyers(undefined);

      expect(result1).toEqual([]);
      expect(result2).toEqual([]);
    });

    it('should verify query structure with active filters', async () => {
      mockPrismaFindMany.mockResolvedValue([]);

      await (worker as any).getActiveBuyers('service-mno');

      const callArgs = mockPrismaFindMany.mock.calls[0][0];

      expect(callArgs.where.active).toBe(true);
      expect(callArgs.where.buyerServiceConfigs.some.active).toBe(true);
      expect(callArgs.include.buyerServiceConfigs.where.active).toBe(true);
    });

    it('should verify nested include for serviceType', async () => {
      mockPrismaFindMany.mockResolvedValue([]);

      await (worker as any).getActiveBuyers('service-pqr');

      const callArgs = mockPrismaFindMany.mock.calls[0][0];

      expect(callArgs.include.buyerServiceConfigs.include.serviceType).toBe(true);
    });

    it('should handle empty string serviceTypeId', async () => {
      mockPrismaFindMany.mockResolvedValue([]);

      const result = await (worker as any).getActiveBuyers('');

      expect(result).toEqual([]);
    });
  });

  describe('Authentication Configuration Mapping', () => {
    it('should correctly map apikey auth type', async () => {
      mockPrismaFindMany.mockResolvedValue([
        {
          id: 'buyer-apikey',
          name: 'API Key Buyer',
          apiUrl: 'https://buyer.com/api',
          authType: 'apikey',
          authConfig: { apiKey: 'test-key-123' },
          active: true,
          buyerServiceConfigs: [
            {
              pingTemplate: {},
              postTemplate: {},
              fieldMappings: {},
              minBid: 10,
              maxBid: 100,
              serviceType: { id: 'service-1', name: 'Service' },
            },
          ],
        },
      ]);

      const result = await (worker as any).getActiveBuyers('service-1');

      expect(result[0].authType).toBe('apikey');
      expect(result[0].authConfig.type).toBe('apikey');
      expect(result[0].authConfig.credentials).toEqual({ apiKey: 'test-key-123' });
    });

    it('should correctly map bearer auth type', async () => {
      mockPrismaFindMany.mockResolvedValue([
        {
          id: 'buyer-bearer',
          name: 'Bearer Buyer',
          apiUrl: 'https://buyer.com/api',
          authType: 'bearer',
          authConfig: { token: 'bearer-token-456' },
          active: true,
          buyerServiceConfigs: [
            {
              pingTemplate: {},
              postTemplate: {},
              fieldMappings: {},
              minBid: 10,
              maxBid: 100,
              serviceType: { id: 'service-2', name: 'Service' },
            },
          ],
        },
      ]);

      const result = await (worker as any).getActiveBuyers('service-2');

      expect(result[0].authType).toBe('bearer');
      expect(result[0].authConfig.type).toBe('bearer');
      expect(result[0].authConfig.credentials).toEqual({ token: 'bearer-token-456' });
    });

    it('should correctly map basic auth type', async () => {
      mockPrismaFindMany.mockResolvedValue([
        {
          id: 'buyer-basic',
          name: 'Basic Auth Buyer',
          apiUrl: 'https://buyer.com/api',
          authType: 'basic',
          authConfig: { username: 'testuser', password: 'testpass' },
          active: true,
          buyerServiceConfigs: [
            {
              pingTemplate: {},
              postTemplate: {},
              fieldMappings: {},
              minBid: 10,
              maxBid: 100,
              serviceType: { id: 'service-3', name: 'Service' },
            },
          ],
        },
      ]);

      const result = await (worker as any).getActiveBuyers('service-3');

      expect(result[0].authType).toBe('basic');
      expect(result[0].authConfig.type).toBe('basic');
      expect(result[0].authConfig.credentials).toEqual({
        username: 'testuser',
        password: 'testpass',
      });
    });
  });

  describe('Bid Configuration Mapping', () => {
    it('should map minBid to bidFloor', async () => {
      mockPrismaFindMany.mockResolvedValue([
        {
          id: 'buyer-bid',
          name: 'Bid Buyer',
          apiUrl: 'https://buyer.com/api',
          authType: 'apikey',
          authConfig: { apiKey: 'key' },
          active: true,
          buyerServiceConfigs: [
            {
              pingTemplate: {},
              postTemplate: {},
              fieldMappings: {},
              minBid: 25.50,
              maxBid: 250.99,
              serviceType: { id: 'service-bid', name: 'Service' },
            },
          ],
        },
      ]);

      const result = await (worker as any).getActiveBuyers('service-bid');

      expect(result[0].serviceConfig.bidFloor).toBe(25.50);
    });

    it('should map maxBid to bidCeiling', async () => {
      mockPrismaFindMany.mockResolvedValue([
        {
          id: 'buyer-bid',
          name: 'Bid Buyer',
          apiUrl: 'https://buyer.com/api',
          authType: 'apikey',
          authConfig: { apiKey: 'key' },
          active: true,
          buyerServiceConfigs: [
            {
              pingTemplate: {},
              postTemplate: {},
              fieldMappings: {},
              minBid: 25.50,
              maxBid: 250.99,
              serviceType: { id: 'service-bid', name: 'Service' },
            },
          ],
        },
      ]);

      const result = await (worker as any).getActiveBuyers('service-bid');

      expect(result[0].serviceConfig.bidCeiling).toBe(250.99);
    });
  });

  describe('Performance and Query Optimization', () => {
    it('should use efficient query with where clause', async () => {
      mockPrismaFindMany.mockResolvedValue([]);

      await (worker as any).getActiveBuyers('service-perf');

      const callArgs = mockPrismaFindMany.mock.calls[0][0];

      // Verify efficient filtering at database level
      expect(callArgs.where).toBeDefined();
      expect(callArgs.where.active).toBe(true);
      expect(callArgs.where.buyerServiceConfigs.some).toBeDefined();
    });

    it('should include only necessary relations', async () => {
      mockPrismaFindMany.mockResolvedValue([]);

      await (worker as any).getActiveBuyers('service-perf');

      const callArgs = mockPrismaFindMany.mock.calls[0][0];

      // Verify we only include buyerServiceConfigs and serviceType
      expect(Object.keys(callArgs.include)).toEqual(['buyerServiceConfigs']);
    });

    it('should handle concurrent calls efficiently', async () => {
      mockPrismaFindMany
        .mockResolvedValueOnce([{ id: 'b1', buyerServiceConfigs: [{}] }])
        .mockResolvedValueOnce([{ id: 'b2', buyerServiceConfigs: [{}] }])
        .mockResolvedValueOnce([{ id: 'b3', buyerServiceConfigs: [{}] }]);

      const promises = [
        (worker as any).getActiveBuyers('service-1'),
        (worker as any).getActiveBuyers('service-2'),
        (worker as any).getActiveBuyers('service-3'),
      ];

      await Promise.all(promises);

      expect(mockPrismaFindMany).toHaveBeenCalledTimes(3);
    });
  });
});
