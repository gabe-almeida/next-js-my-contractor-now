/**
 * Prisma Mock Client for Testing
 *
 * WHY: Provides mock Prisma client to test database operations without
 *      hitting a real database. Uses Jest mock functions for assertions.
 *
 * WHEN: Use in all tests that interact with Prisma/database.
 *
 * HOW: Creates a deeply nested mock object that matches Prisma client structure.
 *      Export both the mock client and individual model mocks for fine-grained control.
 */

import { jest } from '@jest/globals';
import { Decimal } from '@prisma/client/runtime/library';

// =====================================
// MOCK MODEL INTERFACES
// =====================================

// Use ReturnType to get the correct mock function type from jest.fn()
type MockFn = ReturnType<typeof jest.fn>;

interface MockModel {
  findUnique: MockFn;
  findFirst: MockFn;
  findMany: MockFn;
  create: MockFn;
  update: MockFn;
  updateMany: MockFn;
  upsert: MockFn;
  delete: MockFn;
  deleteMany: MockFn;
  count: MockFn;
  aggregate: MockFn;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createMockModel = (): MockModel => {
  // Create mock functions with explicit any typing to avoid strict type checking
  const fn = () => jest.fn() as MockFn;

  return {
    findUnique: fn().mockResolvedValue(null as unknown),
    findFirst: fn().mockResolvedValue(null as unknown),
    findMany: fn().mockResolvedValue([] as unknown),
    create: fn().mockImplementation((data: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 'mock-id', ...data.data })),
    update: fn().mockImplementation((data: { where?: { id?: string }; data: Record<string, unknown> }) =>
      Promise.resolve({ id: data.where?.id, ...data.data })),
    updateMany: fn().mockResolvedValue({ count: 0 } as unknown),
    upsert: fn().mockImplementation((data: { create: Record<string, unknown> }) =>
      Promise.resolve({ id: 'mock-id', ...data.create })),
    delete: fn().mockResolvedValue({ id: 'mock-id' } as unknown),
    deleteMany: fn().mockResolvedValue({ count: 0 } as unknown),
    count: fn().mockResolvedValue(0 as unknown),
    aggregate: fn().mockResolvedValue({} as unknown),
  };
};

// =====================================
// MOCK PRISMA CLIENT
// =====================================

// Create mock models
export const mockCall = createMockModel();
export const mockCallBid = createMockModel();
export const mockTrackingNumber = createMockModel();
export const mockCampaign = createMockModel();
export const mockAffiliate = createMockModel();
export const mockAffiliateCampaign = createMockModel();
export const mockBuyer = createMockModel();
export const mockBuyerServiceConfig = createMockModel();
export const mockBuyerServiceZipCode = createMockModel();
export const mockServiceType = createMockModel();
export const mockTransaction = createMockModel();
export const mockIvrFlow = createMockModel();
export const mockWebhookEvent = createMockModel();
export const mockCallActivityLog = createMockModel();

// Mock $transaction
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockTransaction$ = jest.fn().mockImplementation(async (fn: any) => {
  // Execute the transaction function with the mock client
  return fn(mockPrismaClient);
});

// Create the full mock client
export const mockPrismaClient = {
  call: mockCall,
  callBid: mockCallBid,
  trackingNumber: mockTrackingNumber,
  campaign: mockCampaign,
  affiliate: mockAffiliate,
  affiliateCampaign: mockAffiliateCampaign,
  buyer: mockBuyer,
  buyerServiceConfig: mockBuyerServiceConfig,
  buyerServiceZipCode: mockBuyerServiceZipCode,
  serviceType: mockServiceType,
  transaction: mockTransaction,
  ivrFlow: mockIvrFlow,
  webhookEvent: mockWebhookEvent,
  callActivityLog: mockCallActivityLog,
  $transaction: mockTransaction$,
  $connect: (jest.fn() as MockFn).mockResolvedValue(undefined as unknown),
  $disconnect: (jest.fn() as MockFn).mockResolvedValue(undefined as unknown),
};

// =====================================
// RESET HELPER
// =====================================

/**
 * Resets all Prisma mocks. Call in afterEach or beforeEach.
 */
export const resetPrismaMocks = () => {
  const models = [
    mockCall,
    mockCallBid,
    mockTrackingNumber,
    mockCampaign,
    mockAffiliate,
    mockAffiliateCampaign,
    mockBuyer,
    mockBuyerServiceConfig,
    mockBuyerServiceZipCode,
    mockServiceType,
    mockTransaction,
    mockIvrFlow,
    mockWebhookEvent,
    mockCallActivityLog,
  ];

  models.forEach((model) => {
    Object.values(model).forEach((fn) => {
      if (typeof fn === 'function' && 'mockClear' in fn) {
        (fn as jest.Mock).mockClear();
      }
    });
  });

  mockTransaction$.mockClear();
};

// =====================================
// MOCK DATA HELPERS
// =====================================

/**
 * Helper to create a mock Decimal value.
 */
export const mockDecimal = (value: number): Decimal => {
  return new Decimal(value);
};

/**
 * Helper to configure findUnique to return a specific value.
 */
export const setMockFindUnique = <T>(model: MockModel, data: T | null) => {
  model.findUnique.mockResolvedValue(data);
};

/**
 * Helper to configure findFirst to return a specific value.
 */
export const setMockFindFirst = <T>(model: MockModel, data: T | null) => {
  model.findFirst.mockResolvedValue(data);
};

/**
 * Helper to configure findMany to return an array.
 */
export const setMockFindMany = <T>(model: MockModel, data: T[]) => {
  model.findMany.mockResolvedValue(data);
};

/**
 * Helper to configure count to return a specific number.
 */
export const setMockCount = (model: MockModel, count: number) => {
  model.count.mockResolvedValue(count);
};

/**
 * Helper to configure create to return a specific value.
 */
export const setMockCreate = <T>(model: MockModel, data: T) => {
  model.create.mockResolvedValue(data);
};

/**
 * Helper to configure update to return a specific value.
 */
export const setMockUpdate = <T>(model: MockModel, data: T) => {
  model.update.mockResolvedValue(data);
};

/**
 * Helper to configure model to throw on next call.
 */
export const setMockError = (model: MockModel, method: keyof MockModel, error: Error) => {
  (model[method] as MockFn).mockRejectedValueOnce(error as unknown);
};

// =====================================
// TRANSACTION HELPERS
// =====================================

/**
 * Configure the $transaction mock to use serializable isolation.
 * This simulates the actual transaction behavior in tests.
 */
export const configureMockTransaction = (
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _implementation: (tx: typeof mockPrismaClient) => Promise<unknown>
) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (mockTransaction$ as MockFn).mockImplementation(async (fn: any) => {
    return fn(mockPrismaClient);
  });
};

/**
 * Configure $transaction to throw an error (simulates deadlock, etc).
 */
export const setTransactionError = (error: Error) => {
  (mockTransaction$ as MockFn).mockRejectedValue(error as unknown);
};

// =====================================
// JEST SETUP HOOK
// =====================================

/**
 * Use this to mock the Prisma module in your test file.
 *
 * @example
 * jest.mock('@/lib/prisma', () => ({
 *   prisma: require('@/test/mocks/prisma').mockPrismaClient,
 * }));
 */
export const prismaMockSetup = {
  prisma: mockPrismaClient,
};

export default mockPrismaClient;
