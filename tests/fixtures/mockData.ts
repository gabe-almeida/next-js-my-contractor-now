// Mock data for testing
export const mockServiceTypes = [
  {
    id: 'service-type-1',
    name: 'windows',
    displayName: 'Windows',
    formSchema: {
      title: 'Windows Replacement Quote',
      description: 'Get quotes for your window replacement project',
      fields: [
        {
          name: 'zipCode',
          type: 'text',
          label: 'ZIP Code',
          required: true,
          validation: { pattern: '^\\d{5}$' }
        },
        {
          name: 'ownsHome',
          type: 'radio',
          label: 'Do you own your home?',
          required: true,
          options: ['Yes', 'No']
        },
        {
          name: 'timeframe',
          type: 'select',
          label: 'When do you need this done?',
          required: true,
          options: ['Immediately', 'Within 1 month', '1-3 months', '3-6 months']
        },
        {
          name: 'numberOfWindows',
          type: 'select',
          label: 'How many windows?',
          required: true,
          options: ['1-3', '4-6', '7-10', '11-15', '16+']
        }
      ]
    },
    active: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  },
  {
    id: 'service-type-2',
    name: 'bathrooms',
    displayName: 'Bathrooms',
    formSchema: {
      title: 'Bathroom Renovation Quote',
      description: 'Get quotes for your bathroom renovation project',
      fields: [
        {
          name: 'zipCode',
          type: 'text',
          label: 'ZIP Code',
          required: true,
          validation: { pattern: '^\\d{5}$' }
        },
        {
          name: 'ownsHome',
          type: 'radio',
          label: 'Do you own your home?',
          required: true,
          options: ['Yes', 'No']
        },
        {
          name: 'numberOfBathrooms',
          type: 'select',
          label: 'How many bathrooms?',
          required: true,
          options: ['1', '2', '3', '4+']
        }
      ]
    },
    active: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  }
]

export const mockBuyers = [
  {
    id: 'buyer-1',
    name: 'Modernize',
    apiUrl: 'https://api.modernize.com',
    authConfig: { token: 'test_token_123' },
    pingTimeout: 30,
    postTimeout: 60,
    active: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  },
  {
    id: 'buyer-2',
    name: 'HomeAdvisor',
    apiUrl: 'https://api.homeadvisor.com',
    authConfig: { token: 'test_token_456' },
    pingTimeout: 25,
    postTimeout: 45,
    active: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  }
]

export const mockBuyerConfigs = [
  {
    id: 'config-1',
    buyerId: 'buyer-1',
    serviceTypeId: 'service-type-1',
    pingTemplate: {
      mappings: [
        { sourceField: 'zipCode', targetField: 'zip_code' },
        { sourceField: 'ownsHome', targetField: 'homeowner', transform: 'boolean' }
      ]
    },
    postTemplate: {
      mappings: [
        { sourceField: 'zipCode', targetField: 'zip_code' },
        { sourceField: 'ownsHome', targetField: 'homeowner', transform: 'boolean' },
        { sourceField: 'numberOfWindows', targetField: 'window_count' }
      ]
    },
    fieldMappings: {},
    requiresTrustedform: true,
    requiresJornaya: true,
    complianceConfig: {},
    minBid: 25.00,
    maxBid: 75.00,
    active: true,
    createdAt: new Date('2024-01-01')
  }
]

export const mockLeads = [
  {
    id: 'lead-1',
    serviceTypeId: 'service-type-1',
    formData: {
      numberOfWindows: '4-6',
      windowsProjectScope: 'Full replacement'
    },
    zipCode: '12345',
    ownsHome: true,
    timeframe: 'Within 1 month',
    status: 'PENDING',
    winningBuyerId: null,
    winningBid: null,
    trustedFormCertUrl: 'https://cert.trustedform.com/test123',
    trustedFormCertId: 'test123',
    jornayaLeadId: 'jornaya_test_id',
    complianceData: {
      userAgent: 'Mozilla/5.0 Test',
      timestamp: '2024-01-01T12:00:00Z',
      ipAddress: '127.0.0.1',
      tcpaConsent: true,
      privacyPolicyAccepted: true
    },
    leadQualityScore: 85,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  }
]

export const mockTransactions = [
  {
    id: 'transaction-1',
    leadId: 'lead-1',
    buyerId: 'buyer-1',
    actionType: 'PING',
    payload: { zip_code: '12345', homeowner: true },
    response: { accepted: true, bidAmount: 45.00 },
    status: 'SUCCESS',
    bidAmount: 45.00,
    responseTime: 250,
    errorMessage: null,
    complianceIncluded: true,
    trustedFormPresent: true,
    jornayaPresent: true,
    createdAt: new Date('2024-01-01')
  }
]

export const mockFormSubmission = {
  serviceTypeId: 'service-type-1',
  formData: {
    numberOfWindows: '4-6',
    windowsProjectScope: 'Full replacement'
  },
  zipCode: '12345',
  ownsHome: true,
  timeframe: 'Within 1 month',
  trustedFormCertUrl: 'https://cert.trustedform.com/test123',
  trustedFormCertId: 'test123',
  jornayaLeadId: 'jornaya_test_id',
  complianceData: {
    userAgent: 'Mozilla/5.0 Test',
    timestamp: '2024-01-01T12:00:00Z',
    ipAddress: '127.0.0.1',
    tcpaConsent: true,
    privacyPolicyAccepted: true
  }
}

export const mockRadarResponse = {
  addresses: [
    {
      city: 'New York',
      state: 'NY',
      geometry: {
        coordinates: [-74.0060, 40.7128]
      }
    }
  ]
}

export const mockAuctionResult = {
  winner: {
    buyerId: 'buyer-1',
    bidAmount: 45.00,
    success: true,
    responseTime: 250
  },
  bids: [
    {
      buyerId: 'buyer-1',
      bidAmount: 45.00,
      success: true,
      responseTime: 250
    },
    {
      buyerId: 'buyer-2',
      bidAmount: 35.00,
      success: true,
      responseTime: 300
    }
  ],
  postResult: {
    success: true,
    statusCode: 200,
    response: { leadId: 'external_lead_123' }
  }
}

export const mockCompliance = {
  trustedFormCoverage: 85,
  jornayaCoverage: 92,
  fullComplianceRate: 78,
  totalLeads: 1000,
  trustedFormTrend: '+5%',
  jornayaTrend: '+3%',
  complianceTrend: '+8%'
}

// Test utilities
export function createMockPrismaClient() {
  return {
    lead: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    serviceType: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    buyer: {
      findMany: jest.fn(),
    },
    transaction: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    $queryRawUnsafe: jest.fn(),
    $queryRaw: jest.fn(),
  }
}

export function createMockRedisClient() {
  return {
    lpush: jest.fn(),
    brpop: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  }
}

export function setupFetchMock() {
  return jest.fn().mockImplementation((url, options) => {
    // Mock different API responses based on URL
    if (url.includes('radar.io')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockRadarResponse)
      })
    }
    
    if (url.includes('/ping')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ accepted: true, bidAmount: 45.00 })
      })
    }
    
    if (url.includes('/leads')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, leadId: 'external_123' })
      })
    }
    
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({})
    })
  })
}