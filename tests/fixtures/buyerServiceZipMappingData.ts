/**
 * Test fixtures for Lead Buyer service-zip mapping functionality
 * Provides comprehensive mock data for testing all scenarios
 */

import type { 
  Buyer, 
  ServiceType, 
  BuyerServiceConfig, 
  Lead, 
  ComplianceData 
} from '@/types/database';

// Service Types
export const mockServiceTypes: ServiceType[] = [
  {
    id: 'service-1',
    name: 'ROOFING',
    displayName: 'Roofing Services',
    formSchema: '{}',
    active: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  },
  {
    id: 'service-2',
    name: 'WINDOWS',
    displayName: 'Window Services',
    formSchema: '{}',
    active: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  },
  {
    id: 'service-3',
    name: 'BATHROOMS',
    displayName: 'Bathroom Renovation',
    formSchema: '{}',
    active: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  }
];

// Buyers
export const mockBuyers: Buyer[] = [
  {
    id: 'buyer-1',
    name: 'Modernize Inc.',
    apiUrl: 'https://api.modernize.com',
    authConfig: JSON.stringify({ type: 'bearer', token: 'test-token' }),
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
    authConfig: JSON.stringify({ type: 'api_key', apiKey: 'test-key' }),
    pingTimeout: 25,
    postTimeout: 45,
    active: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  },
  {
    id: 'buyer-3',
    name: 'Angi',
    apiUrl: 'https://api.angi.com',
    authConfig: JSON.stringify({ type: 'basic', username: 'test', password: 'pass' }),
    pingTimeout: 35,
    postTimeout: 70,
    active: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  },
  {
    id: 'buyer-4',
    name: 'Regional Contractor Network',
    apiUrl: 'https://api.rcn.com',
    authConfig: JSON.stringify({ type: 'bearer', token: 'regional-token' }),
    pingTimeout: 30,
    postTimeout: 60,
    active: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  }
];

// Buyer Service Configurations
export const mockBuyerServiceConfigs: BuyerServiceConfig[] = [
  // Modernize - Multiple services
  {
    id: 'config-1',
    buyerId: 'buyer-1',
    serviceTypeId: 'service-1', // ROOFING
    pingTemplate: JSON.stringify({ template: 'modernize-roofing-ping' }),
    postTemplate: JSON.stringify({ template: 'modernize-roofing-post' }),
    fieldMappings: JSON.stringify({}),
    requiresTrustedForm: true,
    requiresJornaya: false,
    complianceConfig: JSON.stringify({ trustedFormRequired: true }),
    minBid: 15.0,
    maxBid: 200.0,
    active: true,
    createdAt: new Date('2024-01-01'),
    buyer: mockBuyers[0],
    serviceType: mockServiceTypes[0]
  },
  {
    id: 'config-2',
    buyerId: 'buyer-1',
    serviceTypeId: 'service-2', // WINDOWS
    pingTemplate: JSON.stringify({ template: 'modernize-windows-ping' }),
    postTemplate: JSON.stringify({ template: 'modernize-windows-post' }),
    fieldMappings: JSON.stringify({}),
    requiresTrustedForm: true,
    requiresJornaya: true,
    complianceConfig: JSON.stringify({ trustedFormRequired: true, jornayaRequired: true }),
    minBid: 20.0,
    maxBid: 300.0,
    active: true,
    createdAt: new Date('2024-01-01'),
    buyer: mockBuyers[0],
    serviceType: mockServiceTypes[1]
  },
  // HomeAdvisor - Single service
  {
    id: 'config-3',
    buyerId: 'buyer-2',
    serviceTypeId: 'service-1', // ROOFING
    pingTemplate: JSON.stringify({ template: 'ha-roofing-ping' }),
    postTemplate: JSON.stringify({ template: 'ha-roofing-post' }),
    fieldMappings: JSON.stringify({}),
    requiresTrustedForm: false,
    requiresJornaya: true,
    complianceConfig: JSON.stringify({ jornayaRequired: true }),
    minBid: 25.0,
    maxBid: 250.0,
    active: true,
    createdAt: new Date('2024-01-01'),
    buyer: mockBuyers[1],
    serviceType: mockServiceTypes[0]
  },
  // Angi - All services
  {
    id: 'config-4',
    buyerId: 'buyer-3',
    serviceTypeId: 'service-1', // ROOFING
    pingTemplate: JSON.stringify({ template: 'angi-roofing-ping' }),
    postTemplate: JSON.stringify({ template: 'angi-roofing-post' }),
    fieldMappings: JSON.stringify({}),
    requiresTrustedForm: true,
    requiresJornaya: true,
    complianceConfig: JSON.stringify({ trustedFormRequired: true, jornayaRequired: true }),
    minBid: 30.0,
    maxBid: 400.0,
    active: true,
    createdAt: new Date('2024-01-01'),
    buyer: mockBuyers[2],
    serviceType: mockServiceTypes[0]
  },
  {
    id: 'config-5',
    buyerId: 'buyer-3',
    serviceTypeId: 'service-2', // WINDOWS
    pingTemplate: JSON.stringify({ template: 'angi-windows-ping' }),
    postTemplate: JSON.stringify({ template: 'angi-windows-post' }),
    fieldMappings: JSON.stringify({}),
    requiresTrustedForm: false,
    requiresJornaya: true,
    complianceConfig: JSON.stringify({ jornayaRequired: true }),
    minBid: 35.0,
    maxBid: 450.0,
    active: true,
    createdAt: new Date('2024-01-01'),
    buyer: mockBuyers[2],
    serviceType: mockServiceTypes[1]
  },
  {
    id: 'config-6',
    buyerId: 'buyer-3',
    serviceTypeId: 'service-3', // BATHROOMS
    pingTemplate: JSON.stringify({ template: 'angi-bathrooms-ping' }),
    postTemplate: JSON.stringify({ template: 'angi-bathrooms-post' }),
    fieldMappings: JSON.stringify({}),
    requiresTrustedForm: true,
    requiresJornaya: false,
    complianceConfig: JSON.stringify({ trustedFormRequired: true }),
    minBid: 40.0,
    maxBid: 500.0,
    active: true,
    createdAt: new Date('2024-01-01'),
    buyer: mockBuyers[2],
    serviceType: mockServiceTypes[2]
  },
  // Regional Network - Limited geographic coverage
  {
    id: 'config-7',
    buyerId: 'buyer-4',
    serviceTypeId: 'service-1', // ROOFING
    pingTemplate: JSON.stringify({ template: 'rcn-roofing-ping' }),
    postTemplate: JSON.stringify({ template: 'rcn-roofing-post' }),
    fieldMappings: JSON.stringify({}),
    requiresTrustedForm: false,
    requiresJornaya: false,
    complianceConfig: null,
    minBid: 18.0,
    maxBid: 180.0,
    active: true,
    createdAt: new Date('2024-01-01'),
    buyer: mockBuyers[3],
    serviceType: mockServiceTypes[0]
  }
];

// Service-Zip Mappings
export interface BuyerServiceZipMapping {
  id: string;
  buyerId: string;
  serviceTypeId: string;
  zipCodes: string[];
  active: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

export const mockServiceZipMappings: BuyerServiceZipMapping[] = [
  // Modernize - National coverage with gaps
  {
    id: 'mapping-1',
    buyerId: 'buyer-1',
    serviceTypeId: 'service-1', // ROOFING
    zipCodes: [
      '90210', '90211', '90212', // Beverly Hills, CA
      '10001', '10002', '10003', '10004', '10005', // Manhattan, NY
      '60601', '60602', '60603', // Chicago, IL
      '77001', '77002', '77003', // Houston, TX
      '33101', '33102', '33103'  // Miami, FL
    ],
    active: true,
    priority: 1,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  },
  {
    id: 'mapping-2',
    buyerId: 'buyer-1',
    serviceTypeId: 'service-2', // WINDOWS
    zipCodes: [
      '90210', '90211', // Beverly Hills, CA (partial overlap with roofing)
      '10001', '10002', '10003', // Manhattan, NY (partial overlap)
      '98101', '98102', '98103', // Seattle, WA (unique to windows)
      '02101', '02102', '02103'  // Boston, MA (unique to windows)
    ],
    active: true,
    priority: 1,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  },
  // HomeAdvisor - Broad coverage
  {
    id: 'mapping-3',
    buyerId: 'buyer-2',
    serviceTypeId: 'service-1', // ROOFING
    zipCodes: [
      '90210', '90211', '90212', '90213', '90214', // CA - overlaps with Modernize
      '10001', '10002', '10003', '10004', '10005', '10006', '10007', // NY
      '60601', '60602', '60603', '60604', // IL
      '30301', '30302', '30303', // Atlanta, GA
      '85001', '85002', '85003'  // Phoenix, AZ
    ],
    active: true,
    priority: 2,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  },
  // Angi - Premium markets only
  {
    id: 'mapping-4',
    buyerId: 'buyer-3',
    serviceTypeId: 'service-1', // ROOFING
    zipCodes: [
      '90210', '90211', // High-value CA zips
      '10001', '10002', // Premium NY zips
      '33101', '33102'  // Miami premium areas
    ],
    active: true,
    priority: 3,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  },
  {
    id: 'mapping-5',
    buyerId: 'buyer-3',
    serviceTypeId: 'service-2', // WINDOWS
    zipCodes: [
      '90210', '90211', '90212', // CA premium
      '10001', '10002', '10003', '10004', // NY premium
      '98101', '98102' // Seattle premium
    ],
    active: true,
    priority: 3,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  },
  {
    id: 'mapping-6',
    buyerId: 'buyer-3',
    serviceTypeId: 'service-3', // BATHROOMS
    zipCodes: [
      '90210', // Ultra-premium only
      '10001', // Manhattan premium
      '33101'  // Miami Beach premium
    ],
    active: true,
    priority: 3,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  },
  // Regional Network - Limited geographic focus
  {
    id: 'mapping-7',
    buyerId: 'buyer-4',
    serviceTypeId: 'service-1', // ROOFING
    zipCodes: [
      '30301', '30302', '30303', '30304', '30305', // Atlanta metro
      '37201', '37202', '37203', // Nashville, TN
      '28201', '28202', '28203'  // Charlotte, NC
    ],
    active: true,
    priority: 4,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  }
];

// Test Leads for various scenarios
export const mockTestLeads: Lead[] = [
  // Lead in premium zip with multiple buyer coverage
  {
    id: 'lead-1',
    serviceTypeId: 'service-1', // ROOFING
    formData: JSON.stringify({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phone: '555-0123',
      projectScope: 'Full roof replacement'
    }),
    zipCode: '90210', // Beverly Hills - covered by multiple buyers
    ownsHome: true,
    timeframe: 'Within 30 days',
    status: 'PENDING',
    winningBuyerId: null,
    winningBid: null,
    trustedFormCertUrl: 'https://trustedform.com/cert1',
    trustedFormCertId: 'tf-cert-1',
    jornayaLeadId: 'jornaya-lead-1',
    complianceData: JSON.stringify({
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
      timestamp: '2024-01-15T10:00:00Z'
    }),
    leadQualityScore: 85,
    createdAt: new Date('2024-01-15T10:00:00Z'),
    updatedAt: new Date('2024-01-15T10:00:00Z'),
    serviceType: mockServiceTypes[0],
    transactions: []
  },
  // Lead in zip covered by single buyer
  {
    id: 'lead-2',
    serviceTypeId: 'service-2', // WINDOWS
    formData: JSON.stringify({
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith@example.com',
      phone: '555-0456',
      numberOfWindows: 8
    }),
    zipCode: '98101', // Seattle - only covered by Modernize and Angi for windows
    ownsHome: true,
    timeframe: 'Within 60 days',
    status: 'PENDING',
    winningBuyerId: null,
    winningBid: null,
    trustedFormCertUrl: 'https://trustedform.com/cert2',
    trustedFormCertId: 'tf-cert-2',
    jornayaLeadId: 'jornaya-lead-2',
    complianceData: JSON.stringify({
      ipAddress: '192.168.1.2',
      userAgent: 'Mozilla/5.0',
      timestamp: '2024-01-16T14:30:00Z'
    }),
    leadQualityScore: 90,
    createdAt: new Date('2024-01-16T14:30:00Z'),
    updatedAt: new Date('2024-01-16T14:30:00Z'),
    serviceType: mockServiceTypes[1],
    transactions: []
  },
  // Lead in uncovered zip
  {
    id: 'lead-3',
    serviceTypeId: 'service-1', // ROOFING
    formData: JSON.stringify({
      firstName: 'Bob',
      lastName: 'Wilson',
      email: 'bob.wilson@example.com',
      phone: '555-0789',
      roofType: 'Asphalt Shingles'
    }),
    zipCode: '99999', // Non-existent zip - no coverage
    ownsHome: true,
    timeframe: 'Within 90 days',
    status: 'PENDING',
    winningBuyerId: null,
    winningBid: null,
    trustedFormCertUrl: null,
    trustedFormCertId: null,
    jornayaLeadId: null,
    complianceData: null,
    leadQualityScore: 70,
    createdAt: new Date('2024-01-17T09:15:00Z'),
    updatedAt: new Date('2024-01-17T09:15:00Z'),
    serviceType: mockServiceTypes[0],
    transactions: []
  },
  // Lead in regional coverage area
  {
    id: 'lead-4',
    serviceTypeId: 'service-1', // ROOFING
    formData: JSON.stringify({
      firstName: 'Alice',
      lastName: 'Johnson',
      email: 'alice.johnson@example.com',
      phone: '555-0321',
      urgency: 'Emergency repair needed'
    }),
    zipCode: '30301', // Atlanta - covered by HomeAdvisor and Regional Network
    ownsHome: true,
    timeframe: 'ASAP',
    status: 'PENDING',
    winningBuyerId: null,
    winningBid: null,
    trustedFormCertUrl: null,
    trustedFormCertId: null,
    jornayaLeadId: 'jornaya-lead-4',
    complianceData: JSON.stringify({
      ipAddress: '192.168.1.4',
      userAgent: 'Mozilla/5.0',
      timestamp: '2024-01-18T16:45:00Z'
    }),
    leadQualityScore: 95,
    createdAt: new Date('2024-01-18T16:45:00Z'),
    updatedAt: new Date('2024-01-18T16:45:00Z'),
    serviceType: mockServiceTypes[0],
    transactions: []
  },
  // Lead for premium service (bathrooms) in ultra-premium zip
  {
    id: 'lead-5',
    serviceTypeId: 'service-3', // BATHROOMS
    formData: JSON.stringify({
      firstName: 'Michael',
      lastName: 'Brown',
      email: 'michael.brown@example.com',
      phone: '555-0654',
      numberOfBathrooms: 3,
      budgetRange: '$50,000-$100,000'
    }),
    zipCode: '90210', // Beverly Hills - only Angi covers bathrooms here
    ownsHome: true,
    timeframe: 'Within 6 months',
    status: 'PENDING',
    winningBuyerId: null,
    winningBid: null,
    trustedFormCertUrl: 'https://trustedform.com/cert5',
    trustedFormCertId: 'tf-cert-5',
    jornayaLeadId: null,
    complianceData: JSON.stringify({
      ipAddress: '192.168.1.5',
      userAgent: 'Mozilla/5.0',
      timestamp: '2024-01-19T11:20:00Z',
      tcpaConsent: {
        consented: true,
        timestamp: '2024-01-19T11:20:00Z',
        text: 'I agree to receive communications'
      }
    }),
    leadQualityScore: 88,
    createdAt: new Date('2024-01-19T11:20:00Z'),
    updatedAt: new Date('2024-01-19T11:20:00Z'),
    serviceType: mockServiceTypes[2],
    transactions: []
  }
];

// Expected auction participation results for test scenarios
export const expectedParticipationResults = {
  'lead-1': ['buyer-1', 'buyer-2', 'buyer-3'], // Premium zip, roofing, multiple coverage
  'lead-2': ['buyer-1', 'buyer-3'], // Seattle windows, limited coverage
  'lead-3': [], // No coverage
  'lead-4': ['buyer-2', 'buyer-4'], // Atlanta, regional + national
  'lead-5': ['buyer-3'] // Ultra-premium bathrooms, Angi only
};

// Test scenarios for edge cases
export const edgeCaseScenarios = {
  multipleServicesPerBuyer: {
    buyerId: 'buyer-1',
    expectedServices: ['service-1', 'service-2']
  },
  overlappingZipCodes: {
    zipCode: '90210',
    expectedBuyers: ['buyer-1', 'buyer-2', 'buyer-3']
  },
  priorityConflicts: {
    zipCode: '10001',
    service: 'service-1',
    expectedWinner: 'buyer-3' // Highest priority
  },
  inactiveConfigurations: {
    // Test data for inactive configs to ensure they're excluded
    inactiveMapping: {
      id: 'mapping-inactive',
      buyerId: 'buyer-2',
      serviceTypeId: 'service-3',
      zipCodes: ['90210'],
      active: false,
      priority: 5,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01')
    }
  }
};

// Performance test data - large datasets
export const generateLargeZipCodeDataset = (size: number) => {
  const zipCodes: string[] = [];
  for (let i = 10000; i < 10000 + size; i++) {
    zipCodes.push(i.toString());
  }
  return zipCodes;
};

export const performanceTestMappings = {
  largeZipCodeSet: {
    id: 'perf-mapping-1',
    buyerId: 'buyer-1',
    serviceTypeId: 'service-1',
    zipCodes: generateLargeZipCodeDataset(10000), // 10k zip codes
    active: true,
    priority: 1,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  }
};

// Mock database operations for testing
export const mockDatabaseOperations = {
  async createBuyerServiceZipMapping(mapping: Partial<BuyerServiceZipMapping>) {
    return { id: 'new-mapping-id', ...mapping };
  },
  
  async findBuyersByServiceAndZip(serviceTypeId: string, zipCode: string) {
    return mockServiceZipMappings
      .filter(mapping => 
        mapping.serviceTypeId === serviceTypeId && 
        mapping.zipCodes.includes(zipCode) &&
        mapping.active
      )
      .map(mapping => ({
        buyerId: mapping.buyerId,
        priority: mapping.priority
      }));
  },
  
  async updateZipCodes(mappingId: string, zipCodes: string[]) {
    const mapping = mockServiceZipMappings.find(m => m.id === mappingId);
    if (mapping) {
      mapping.zipCodes = zipCodes;
      mapping.updatedAt = new Date();
    }
    return mapping;
  },
  
  async deleteBuyerServiceZipMapping(mappingId: string) {
    const index = mockServiceZipMappings.findIndex(m => m.id === mappingId);
    if (index > -1) {
      mockServiceZipMappings.splice(index, 1);
      return true;
    }
    return false;
  }
};