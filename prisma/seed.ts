import { PrismaClient } from '@prisma/client'
import { generateWebhookSecret } from '../src/lib/security/webhook-signatures'
import { encrypt } from '../src/lib/security/encryption'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...\n')

  // Clear existing data (in development only)
  console.log('🗑️  Clearing existing data...')
  await prisma.leadStatusHistory.deleteMany()
  await prisma.complianceAuditLog.deleteMany()
  await prisma.transaction.deleteMany()
  await prisma.lead.deleteMany()
  await prisma.buyerServiceZipCode.deleteMany()
  await prisma.buyerServiceConfig.deleteMany()
  await prisma.buyer.deleteMany()
  await prisma.zipCodeMetadata.deleteMany()
  await prisma.serviceType.deleteMany()
  await prisma.adminUser.deleteMany()
  console.log('✅ Cleared existing data\n')

  // ==========================================
  // 0. ADMIN USERS (for Lead Accounting)
  // ==========================================
  console.log('👤 Creating admin users...')

  const superAdmin = await prisma.adminUser.create({
    data: {
      email: 'admin@mycontractornow.com',
      name: 'Super Admin',
      role: 'SUPER_ADMIN',
      active: true
    }
  })

  const adminUser = await prisma.adminUser.create({
    data: {
      email: 'sarah@mycontractornow.com',
      name: 'Sarah',
      role: 'ADMIN',
      active: true
    }
  })

  const supportUser = await prisma.adminUser.create({
    data: {
      email: 'mike@mycontractornow.com',
      name: 'Mike',
      role: 'SUPPORT',
      active: true
    }
  })

  console.log(`✅ Created 3 admin users\n`)

  // ==========================================
  // 1. SERVICE TYPES
  // ==========================================
  console.log('📝 Creating service types...')

  const windows = await prisma.serviceType.create({
    data: {
      name: 'windows',
      displayName: 'Windows Installation',
      formSchema: JSON.stringify({
        fields: [
          { name: 'zipCode', type: 'text', required: true, label: 'ZIP Code' },
          { name: 'ownsHome', type: 'radio', required: true, label: 'Do you own your home?', options: ['Yes', 'No'] },
          { name: 'timeframe', type: 'select', required: true, label: 'When do you need this done?', options: ['Immediately', '1-3 months', '3-6 months', '6+ months'] },
          { name: 'numberOfWindows', type: 'select', required: true, label: 'How many windows?', options: ['1-3', '4-6', '7-10', '11+'] },
          { name: 'windowType', type: 'select', required: true, label: 'Window type?', options: ['Double Hung', 'Casement', 'Sliding', 'Bay/Bow', 'Not Sure'] },
          { name: 'firstName', type: 'text', required: true, label: 'First Name' },
          { name: 'lastName', type: 'text', required: true, label: 'Last Name' },
          { name: 'email', type: 'email', required: true, label: 'Email' },
          { name: 'phone', type: 'tel', required: true, label: 'Phone' }
        ]
      }),
      active: true
    }
  })

  const bathrooms = await prisma.serviceType.create({
    data: {
      name: 'bathrooms',
      displayName: 'Bathroom Remodeling',
      formSchema: JSON.stringify({
        fields: [
          { name: 'zipCode', type: 'text', required: true, label: 'ZIP Code' },
          { name: 'ownsHome', type: 'radio', required: true, label: 'Do you own your home?', options: ['Yes', 'No'] },
          { name: 'timeframe', type: 'select', required: true, label: 'When do you need this done?', options: ['Immediately', '1-3 months', '3-6 months', '6+ months'] },
          { name: 'bathroomCount', type: 'select', required: true, label: 'How many bathrooms?', options: ['1', '2', '3', '4+'] },
          { name: 'remodelType', type: 'select', required: true, label: 'Type of remodel?', options: ['Full Remodel', 'Partial Update', 'Fixtures Only', 'Not Sure'] },
          { name: 'firstName', type: 'text', required: true, label: 'First Name' },
          { name: 'lastName', type: 'text', required: true, label: 'Last Name' },
          { name: 'email', type: 'email', required: true, label: 'Email' },
          { name: 'phone', type: 'tel', required: true, label: 'Phone' }
        ]
      }),
      active: true
    }
  })

  const roofing = await prisma.serviceType.create({
    data: {
      name: 'roofing',
      displayName: 'Roofing Services',
      formSchema: JSON.stringify({
        fields: [
          { name: 'zipCode', type: 'text', required: true, label: 'ZIP Code' },
          { name: 'ownsHome', type: 'radio', required: true, label: 'Do you own your home?', options: ['Yes', 'No'] },
          { name: 'timeframe', type: 'select', required: true, label: 'When do you need this done?', options: ['Immediately', '1-3 months', '3-6 months', '6+ months'] },
          { name: 'roofType', type: 'select', required: true, label: 'What type of roof?', options: ['Asphalt Shingles', 'Metal', 'Tile', 'Flat', 'Not Sure'] },
          { name: 'roofSize', type: 'select', required: true, label: 'Approximate roof size?', options: ['Small (under 1,500 sq ft)', 'Medium (1,500-3,000 sq ft)', 'Large (over 3,000 sq ft)', 'Not Sure'] },
          { name: 'serviceNeeded', type: 'select', required: true, label: 'Service needed?', options: ['New Roof', 'Repair', 'Inspection', 'Not Sure'] },
          { name: 'firstName', type: 'text', required: true, label: 'First Name' },
          { name: 'lastName', type: 'text', required: true, label: 'Last Name' },
          { name: 'email', type: 'email', required: true, label: 'Email' },
          { name: 'phone', type: 'tel', required: true, label: 'Phone' }
        ]
      }),
      active: true
    }
  })

  const hvac = await prisma.serviceType.create({
    data: {
      name: 'hvac',
      displayName: 'HVAC Services',
      formSchema: JSON.stringify({
        fields: [
          { name: 'zipCode', type: 'text', required: true, label: 'ZIP Code' },
          { name: 'ownsHome', type: 'radio', required: true, label: 'Do you own your home?', options: ['Yes', 'No'] },
          { name: 'timeframe', type: 'select', required: true, label: 'When do you need this done?', options: ['Immediately', '1-3 months', '3-6 months', '6+ months'] },
          { name: 'systemType', type: 'select', required: true, label: 'System type?', options: ['Central AC', 'Furnace', 'Heat Pump', 'Ductless', 'Not Sure'] },
          { name: 'serviceType', type: 'select', required: true, label: 'Service needed?', options: ['New Installation', 'Replacement', 'Repair', 'Maintenance', 'Not Sure'] },
          { name: 'homeSize', type: 'select', required: true, label: 'Home size?', options: ['Under 1,500 sq ft', '1,500-2,500 sq ft', '2,500-3,500 sq ft', 'Over 3,500 sq ft'] },
          { name: 'firstName', type: 'text', required: true, label: 'First Name' },
          { name: 'lastName', type: 'text', required: true, label: 'Last Name' },
          { name: 'email', type: 'email', required: true, label: 'Email' },
          { name: 'phone', type: 'tel', required: true, label: 'Phone' }
        ]
      }),
      active: true
    }
  })

  console.log(`✅ Created 4 service types\n`)

  // ==========================================
  // 2. BUYERS
  // ==========================================
  console.log('🏢 Creating buyers...')

  const homeadvisor = await prisma.buyer.create({
    data: {
      name: 'HomeAdvisor',
      displayName: 'HomeAdvisor Network',
      type: 'NETWORK',
      apiUrl: 'https://api.homeadvisor.com/leads',
      authConfig: encrypt(JSON.stringify({ type: 'bearer', token: 'demo_homeadvisor_token' })),
      webhookSecret: encrypt(generateWebhookSecret()),
      authType: 'bearer',
      pingTimeout: 30,
      postTimeout: 60,
      contactName: 'John Smith',
      contactEmail: 'leads@homeadvisor.com',
      contactPhone: '1-800-555-0100',
      businessEmail: 'business@homeadvisor.com',
      businessPhone: '1-800-555-0101',
      active: true,
      complianceFieldMappings: JSON.stringify({
        trustedForm: {
          certUrl: ['tf_cert_url', 'certificate_url', 'trustedform_url'],
          certId: ['tf_token', 'certificate_token']
        },
        jornaya: {
          leadId: ['universal_leadid', 'jornaya_token', 'lead_identifier']
        },
        tcpa: {
          consent: ['consent_status', 'tcpa_flag', 'opt_in'],
          timestamp: ['consent_timestamp', 'opt_in_time']
        },
        technical: {
          ipAddress: ['client_ip', 'source_ip'],
          userAgent: ['browser_string', 'user_agent_string'],
          timestamp: ['submission_time', 'received_at']
        },
        geo: {
          latitude: ['geo_lat', 'location_lat'],
          longitude: ['geo_lon', 'location_lon'],
          city: ['customer_city', 'location_city'],
          state: ['customer_state', 'location_state']
        }
      })
    }
  })

  const modernize = await prisma.buyer.create({
    data: {
      name: 'Modernize',
      displayName: 'Modernize Leads',
      type: 'NETWORK',
      apiUrl: 'https://api.modernize.com/leads',
      authConfig: encrypt(JSON.stringify({ type: 'bearer', token: 'demo_modernize_token' })),
      webhookSecret: encrypt(generateWebhookSecret()),
      authType: 'bearer',
      pingTimeout: 25,
      postTimeout: 50,
      contactName: 'Sarah Johnson',
      contactEmail: 'integration@modernize.com',
      contactPhone: '1-800-555-0200',
      businessEmail: 'partners@modernize.com',
      businessPhone: '1-800-555-0201',
      active: true,
      complianceFieldMappings: JSON.stringify({
        trustedForm: {
          certUrl: ['trustedform_cert_url', 'tf_certificate'],
          certId: ['trustedform_token', 'tf_cert_id']
        },
        jornaya: {
          leadId: ['leadid_token', 'jornaya_lead_id']
        },
        tcpa: {
          consent: ['tcpa_consent', 'consent_given'],
          timestamp: ['consent_date']
        },
        technical: {
          ipAddress: ['ip_address'],
          userAgent: ['user_agent'],
          timestamp: ['submit_timestamp']
        },
        geo: {
          latitude: ['lat'],
          longitude: ['lng'],
          city: ['city_name'],
          state: ['state_code']
        }
      })
    }
  })

  const abcRoofing = await prisma.buyer.create({
    data: {
      name: 'ABC Roofing',
      displayName: 'ABC Roofing & Construction',
      type: 'CONTRACTOR',
      apiUrl: 'https://api.abcroofing.com/leads',
      authConfig: encrypt(JSON.stringify({ type: 'basic', username: 'abc_api', password: 'demo_password' })),
      webhookSecret: encrypt(generateWebhookSecret()),
      authType: 'basic',
      pingTimeout: 20,
      postTimeout: 40,
      contactName: 'Mike Rodriguez',
      contactEmail: 'leads@abcroofing.com',
      contactPhone: '555-123-4567',
      businessEmail: 'office@abcroofing.com',
      businessPhone: '555-123-4568',
      active: true,
      complianceFieldMappings: JSON.stringify({
        trustedForm: {
          certUrl: ['cert_url', 'trustedform_cert'],
          certId: ['cert_id', 'tf_id']
        },
        jornaya: {
          leadId: ['leadid', 'jornaya_id']
        },
        tcpa: {
          consent: ['consent', 'opted_in'],
          timestamp: ['consent_time']
        },
        technical: {
          ipAddress: ['ip'],
          userAgent: ['agent'],
          timestamp: ['timestamp']
        },
        geo: {
          latitude: ['latitude'],
          longitude: ['longitude'],
          city: ['city'],
          state: ['state']
        }
      })
    }
  })

  const xyzWindows = await prisma.buyer.create({
    data: {
      name: 'XYZ Windows',
      displayName: 'XYZ Windows & Doors',
      type: 'CONTRACTOR',
      apiUrl: 'https://api.xyzwindows.com/leads',
      authConfig: encrypt(JSON.stringify({ type: 'api_key', key: 'demo_xyz_api_key' })),
      webhookSecret: encrypt(generateWebhookSecret()),
      authType: 'apiKey',
      pingTimeout: 20,
      postTimeout: 45,
      contactName: 'Lisa Chen',
      contactEmail: 'api@xyzwindows.com',
      contactPhone: '555-987-6543',
      businessEmail: 'contact@xyzwindows.com',
      businessPhone: '555-987-6544',
      active: true,
      complianceFieldMappings: JSON.stringify({
        trustedForm: {
          certUrl: ['tf_url', 'cert_link'],
          certId: ['tf_id', 'cert_token']
        },
        jornaya: {
          leadId: ['jornaya_id', 'lead_token']
        },
        tcpa: {
          consent: ['consent_flag', 'tcpa_opt_in'],
          timestamp: ['consent_ts']
        },
        technical: {
          ipAddress: ['ip_addr'],
          userAgent: ['user_agent_str'],
          timestamp: ['submit_time']
        },
        geo: {
          latitude: ['lat_coord'],
          longitude: ['lng_coord'],
          city: ['city_name'],
          state: ['state_abbr']
        }
      })
    }
  })

  const angi = await prisma.buyer.create({
    data: {
      name: 'Angi',
      displayName: 'Angi (Angie\'s List)',
      type: 'NETWORK',
      apiUrl: 'https://api.angi.com/leads',
      authConfig: encrypt(JSON.stringify({ type: 'oauth2', clientId: 'demo_client', clientSecret: 'demo_secret' })),
      webhookSecret: encrypt(generateWebhookSecret()),
      authType: 'bearer', // OAuth2 uses bearer tokens
      pingTimeout: 30,
      postTimeout: 60,
      contactName: 'David Park',
      contactEmail: 'partners@angi.com',
      contactPhone: '1-800-555-0300',
      businessEmail: 'api@angi.com',
      businessPhone: '1-800-555-0301',
      active: true,
      complianceFieldMappings: JSON.stringify({
        trustedForm: {
          certUrl: ['cert_url'],
          certId: ['cert_id']
        },
        jornaya: {
          leadId: ['leadid', 'jornaya_id']
        },
        tcpa: {
          consent: ['consent', 'opted_in'],
          timestamp: ['consent_time']
        },
        technical: {
          ipAddress: ['ip'],
          userAgent: ['agent'],
          timestamp: ['timestamp']
        },
        geo: {
          latitude: ['latitude'],
          longitude: ['longitude'],
          city: ['city'],
          state: ['state']
        }
      })
    }
  })

  console.log(`✅ Created 5 buyers\n`)

  // ==========================================
  // 3. ZIP CODE METADATA
  // ==========================================
  console.log('🗺️  Creating ZIP code metadata...')

  const zipCodes = [
    // California
    { zipCode: '90210', city: 'Beverly Hills', state: 'CA', county: 'Los Angeles', latitude: 34.1030, longitude: -118.4105 },
    { zipCode: '90211', city: 'Beverly Hills', state: 'CA', county: 'Los Angeles', latitude: 34.0668, longitude: -118.3860 },
    { zipCode: '90212', city: 'Beverly Hills', state: 'CA', county: 'Los Angeles', latitude: 34.0692, longitude: -118.4037 },
    { zipCode: '90001', city: 'Los Angeles', state: 'CA', county: 'Los Angeles', latitude: 33.9731, longitude: -118.2479 },
    { zipCode: '90002', city: 'Los Angeles', state: 'CA', county: 'Los Angeles', latitude: 33.9500, longitude: -118.2462 },
    { zipCode: '90003', city: 'Los Angeles', state: 'CA', county: 'Los Angeles', latitude: 33.9642, longitude: -118.2728 },
    { zipCode: '90004', city: 'Los Angeles', state: 'CA', county: 'Los Angeles', latitude: 34.0766, longitude: -118.3090 },
    { zipCode: '90005', city: 'Los Angeles', state: 'CA', county: 'Los Angeles', latitude: 34.0583, longitude: -118.3081 },
    { zipCode: '94102', city: 'San Francisco', state: 'CA', county: 'San Francisco', latitude: 37.7799, longitude: -122.4193 },
    { zipCode: '94103', city: 'San Francisco', state: 'CA', county: 'San Francisco', latitude: 37.7724, longitude: -122.4103 },
    { zipCode: '94104', city: 'San Francisco', state: 'CA', county: 'San Francisco', latitude: 37.7911, longitude: -122.4016 },
    { zipCode: '94105', city: 'San Francisco', state: 'CA', county: 'San Francisco', latitude: 37.7881, longitude: -122.3892 },
    { zipCode: '92101', city: 'San Diego', state: 'CA', county: 'San Diego', latitude: 32.7157, longitude: -117.1611 },
    { zipCode: '92102', city: 'San Diego', state: 'CA', county: 'San Diego', latitude: 32.7081, longitude: -117.1286 },
    { zipCode: '92103', city: 'San Diego', state: 'CA', county: 'San Diego', latitude: 32.7470, longitude: -117.1664 },

    // New York
    { zipCode: '10001', city: 'New York', state: 'NY', county: 'New York', latitude: 40.7506, longitude: -73.9971 },
    { zipCode: '10002', city: 'New York', state: 'NY', county: 'New York', latitude: 40.7158, longitude: -73.9862 },
    { zipCode: '10003', city: 'New York', state: 'NY', county: 'New York', latitude: 40.7314, longitude: -73.9892 },
    { zipCode: '10004', city: 'New York', state: 'NY', county: 'New York', latitude: 40.6887, longitude: -74.0189 },
    { zipCode: '10005', city: 'New York', state: 'NY', county: 'New York', latitude: 40.7060, longitude: -74.0088 },
    { zipCode: '10006', city: 'New York', state: 'NY', county: 'New York', latitude: 40.7094, longitude: -74.0135 },
    { zipCode: '10007', city: 'New York', state: 'NY', county: 'New York', latitude: 40.7137, longitude: -74.0078 },
    { zipCode: '10008', city: 'New York', state: 'NY', county: 'New York', latitude: 40.7100, longitude: -74.0030 },
    { zipCode: '10009', city: 'New York', state: 'NY', county: 'New York', latitude: 40.7264, longitude: -73.9786 },
    { zipCode: '10010', city: 'New York', state: 'NY', county: 'New York', latitude: 40.7391, longitude: -73.9826 },
    { zipCode: '10011', city: 'New York', state: 'NY', county: 'New York', latitude: 40.7406, longitude: -74.0006 },
    { zipCode: '10012', city: 'New York', state: 'NY', county: 'New York', latitude: 40.7255, longitude: -73.9983 },
    { zipCode: '10013', city: 'New York', state: 'NY', county: 'New York', latitude: 40.7200, longitude: -74.0052 },
    { zipCode: '10014', city: 'New York', state: 'NY', county: 'New York', latitude: 40.7338, longitude: -74.0064 },
    { zipCode: '10015', city: 'New York', state: 'NY', county: 'New York', latitude: 40.7150, longitude: -74.0020 },

    // Texas
    { zipCode: '75201', city: 'Dallas', state: 'TX', county: 'Dallas', latitude: 32.7871, longitude: -96.7946 },
    { zipCode: '75202', city: 'Dallas', state: 'TX', county: 'Dallas', latitude: 32.7808, longitude: -96.7998 },
    { zipCode: '75203', city: 'Dallas', state: 'TX', county: 'Dallas', latitude: 32.7394, longitude: -96.7705 },
    { zipCode: '75204', city: 'Dallas', state: 'TX', county: 'Dallas', latitude: 32.8024, longitude: -96.7841 },
    { zipCode: '75205', city: 'Dallas', state: 'TX', county: 'Dallas', latitude: 32.8146, longitude: -96.8008 },
    { zipCode: '77001', city: 'Houston', state: 'TX', county: 'Harris', latitude: 29.7604, longitude: -95.3698 },
    { zipCode: '77002', city: 'Houston', state: 'TX', county: 'Harris', latitude: 29.7589, longitude: -95.3626 },
    { zipCode: '77003', city: 'Houston', state: 'TX', county: 'Harris', latitude: 29.7484, longitude: -95.3479 },
    { zipCode: '77004', city: 'Houston', state: 'TX', county: 'Harris', latitude: 29.7199, longitude: -95.3740 },
    { zipCode: '77005', city: 'Houston', state: 'TX', county: 'Harris', latitude: 29.7186, longitude: -95.4294 },
    { zipCode: '78701', city: 'Austin', state: 'TX', county: 'Travis', latitude: 30.2711, longitude: -97.7437 },
    { zipCode: '78702', city: 'Austin', state: 'TX', county: 'Travis', latitude: 30.2630, longitude: -97.7218 },
    { zipCode: '78703', city: 'Austin', state: 'TX', county: 'Travis', latitude: 30.2860, longitude: -97.7697 },

    // Florida
    { zipCode: '33101', city: 'Miami', state: 'FL', county: 'Miami-Dade', latitude: 25.7767, longitude: -80.1920 },
    { zipCode: '33102', city: 'Miami', state: 'FL', county: 'Miami-Dade', latitude: 25.7814, longitude: -80.1870 },
    { zipCode: '33103', city: 'Miami', state: 'FL', county: 'Miami-Dade', latitude: 25.7700, longitude: -80.1950 },
    { zipCode: '33104', city: 'Miami', state: 'FL', county: 'Miami-Dade', latitude: 25.7820, longitude: -80.2000 },
    { zipCode: '33105', city: 'Miami', state: 'FL', county: 'Miami-Dade', latitude: 25.7650, longitude: -80.1900 },
    { zipCode: '32801', city: 'Orlando', state: 'FL', county: 'Orange', latitude: 28.5383, longitude: -81.3792 },
    { zipCode: '32802', city: 'Orlando', state: 'FL', county: 'Orange', latitude: 28.5514, longitude: -81.3680 },
    { zipCode: '32803', city: 'Orlando', state: 'FL', county: 'Orange', latitude: 28.5726, longitude: -81.3684 },
    { zipCode: '33301', city: 'Fort Lauderdale', state: 'FL', county: 'Broward', latitude: 26.1224, longitude: -80.1373 },
    { zipCode: '33302', city: 'Fort Lauderdale', state: 'FL', county: 'Broward', latitude: 26.1334, longitude: -80.1318 },

    // Illinois
    { zipCode: '60601', city: 'Chicago', state: 'IL', county: 'Cook', latitude: 41.8856, longitude: -87.6214 },
    { zipCode: '60602', city: 'Chicago', state: 'IL', county: 'Cook', latitude: 41.8829, longitude: -87.6290 },
    { zipCode: '60603', city: 'Chicago', state: 'IL', county: 'Cook', latitude: 41.8809, longitude: -87.6279 },
    { zipCode: '60604', city: 'Chicago', state: 'IL', county: 'Cook', latitude: 41.8775, longitude: -87.6270 },
    { zipCode: '60605', city: 'Chicago', state: 'IL', county: 'Cook', latitude: 41.8691, longitude: -87.6190 },
    { zipCode: '60606', city: 'Chicago', state: 'IL', county: 'Cook', latitude: 41.8817, longitude: -87.6385 },
    { zipCode: '60607', city: 'Chicago', state: 'IL', county: 'Cook', latitude: 41.8744, longitude: -87.6539 },

    // Arizona
    { zipCode: '85001', city: 'Phoenix', state: 'AZ', county: 'Maricopa', latitude: 33.4484, longitude: -112.0740 },
    { zipCode: '85002', city: 'Phoenix', state: 'AZ', county: 'Maricopa', latitude: 33.4586, longitude: -112.0740 },
    { zipCode: '85003', city: 'Phoenix', state: 'AZ', county: 'Maricopa', latitude: 33.4484, longitude: -112.0933 },

    // Pennsylvania
    { zipCode: '19101', city: 'Philadelphia', state: 'PA', county: 'Philadelphia', latitude: 39.9526, longitude: -75.1652 },
    { zipCode: '19102', city: 'Philadelphia', state: 'PA', county: 'Philadelphia', latitude: 39.9526, longitude: -75.1652 },
    { zipCode: '19103', city: 'Philadelphia', state: 'PA', county: 'Philadelphia', latitude: 39.9538, longitude: -75.1677 },

    // Georgia
    { zipCode: '30301', city: 'Atlanta', state: 'GA', county: 'Fulton', latitude: 33.7490, longitude: -84.3880 },
    { zipCode: '30302', city: 'Atlanta', state: 'GA', county: 'Fulton', latitude: 33.7490, longitude: -84.3880 },
    { zipCode: '30303', city: 'Atlanta', state: 'GA', county: 'Fulton', latitude: 33.7490, longitude: -84.3880 },

    // Washington
    { zipCode: '98101', city: 'Seattle', state: 'WA', county: 'King', latitude: 47.6062, longitude: -122.3321 },
    { zipCode: '98102', city: 'Seattle', state: 'WA', county: 'King', latitude: 47.6298, longitude: -122.3223 },
    { zipCode: '98103', city: 'Seattle', state: 'WA', county: 'King', latitude: 47.6775, longitude: -122.3419 },

    // Massachusetts
    { zipCode: '02101', city: 'Boston', state: 'MA', county: 'Suffolk', latitude: 42.3601, longitude: -71.0589 },
    { zipCode: '02102', city: 'Boston', state: 'MA', county: 'Suffolk', latitude: 42.3555, longitude: -71.0534 },
    { zipCode: '02103', city: 'Boston', state: 'MA', county: 'Suffolk', latitude: 42.3555, longitude: -71.0534 },

    // Colorado
    { zipCode: '80201', city: 'Denver', state: 'CO', county: 'Denver', latitude: 39.7392, longitude: -104.9903 },
    { zipCode: '80202', city: 'Denver', state: 'CO', county: 'Denver', latitude: 39.7515, longitude: -104.9965 },
    { zipCode: '80203', city: 'Denver', state: 'CO', county: 'Denver', latitude: 39.7335, longitude: -104.9813 },

    // Nevada
    { zipCode: '89101', city: 'Las Vegas', state: 'NV', county: 'Clark', latitude: 36.1716, longitude: -115.1391 },
    { zipCode: '89102', city: 'Las Vegas', state: 'NV', county: 'Clark', latitude: 36.1562, longitude: -115.1762 },
    { zipCode: '89103', city: 'Las Vegas', state: 'NV', county: 'Clark', latitude: 36.1248, longitude: -115.1736 },

    // Oregon
    { zipCode: '97201', city: 'Portland', state: 'OR', county: 'Multnomah', latitude: 45.4988, longitude: -122.6851 },
    { zipCode: '97202', city: 'Portland', state: 'OR', county: 'Multnomah', latitude: 45.4800, longitude: -122.6436 },
    { zipCode: '97203', city: 'Portland', state: 'OR', county: 'Multnomah', latitude: 45.5937, longitude: -122.7290 },

    // Michigan
    { zipCode: '48201', city: 'Detroit', state: 'MI', county: 'Wayne', latitude: 42.3834, longitude: -83.1024 },
    { zipCode: '48202', city: 'Detroit', state: 'MI', county: 'Wayne', latitude: 42.3663, longitude: -83.0889 },
    { zipCode: '48203', city: 'Detroit', state: 'MI', county: 'Wayne', latitude: 42.3686, longitude: -83.1370 },

    // North Carolina
    { zipCode: '28201', city: 'Charlotte', state: 'NC', county: 'Mecklenburg', latitude: 35.2271, longitude: -80.8431 },
    { zipCode: '28202', city: 'Charlotte', state: 'NC', county: 'Mecklenburg', latitude: 35.2235, longitude: -80.8364 },
    { zipCode: '28203', city: 'Charlotte', state: 'NC', county: 'Mecklenburg', latitude: 35.2080, longitude: -80.8610 },

    // Tennessee
    { zipCode: '37201', city: 'Nashville', state: 'TN', county: 'Davidson', latitude: 36.1627, longitude: -86.7816 },
    { zipCode: '37202', city: 'Nashville', state: 'TN', county: 'Davidson', latitude: 36.1573, longitude: -86.7762 },
    { zipCode: '37203', city: 'Nashville', state: 'TN', county: 'Davidson', latitude: 36.1474, longitude: -86.8025 },

    // Ohio
    { zipCode: '43201', city: 'Columbus', state: 'OH', county: 'Franklin', latitude: 40.0183, longitude: -82.9988 },
    { zipCode: '43202', city: 'Columbus', state: 'OH', county: 'Franklin', latitude: 39.9886, longitude: -83.0045 },
    { zipCode: '43203', city: 'Columbus', state: 'OH', county: 'Franklin', latitude: 39.9429, longitude: -82.9833 },
  ]

  await prisma.zipCodeMetadata.createMany({
    data: zipCodes
  })

  console.log(`✅ Created ${zipCodes.length} ZIP code metadata entries\n`)

  // ==========================================
  // 4. BUYER SERVICE CONFIGS
  // ==========================================
  console.log('⚙️  Creating buyer service configs...')

  const buyerServiceConfigs = []

  // HomeAdvisor - All 4 services
  buyerServiceConfigs.push(
    await prisma.buyerServiceConfig.create({
      data: {
        buyerId: homeadvisor.id,
        serviceTypeId: windows.id,
        pingTemplate: JSON.stringify({ zip: '{{zipCode}}', homeowner: '{{ownsHome}}' }),
        postTemplate: JSON.stringify({ zip: '{{zipCode}}', homeowner: '{{ownsHome}}', windows: '{{numberOfWindows}}', type: '{{windowType}}' }),
        fieldMappings: JSON.stringify({ zipCode: 'zip', ownsHome: 'homeowner' }),
        requiresTrustedForm: true,
        requiresJornaya: true,
        minBid: 15.00,
        maxBid: 60.00
      }
    }),
    await prisma.buyerServiceConfig.create({
      data: {
        buyerId: homeadvisor.id,
        serviceTypeId: bathrooms.id,
        pingTemplate: JSON.stringify({ postal_code: '{{zipCode}}', owns_property: '{{ownsHome}}' }),
        postTemplate: JSON.stringify({ postal_code: '{{zipCode}}', owns_property: '{{ownsHome}}', bathrooms: '{{bathroomCount}}' }),
        fieldMappings: JSON.stringify({ zipCode: 'postal_code', ownsHome: 'owns_property' }),
        requiresTrustedForm: true,
        requiresJornaya: true,
        minBid: 20.00,
        maxBid: 80.00
      }
    }),
    await prisma.buyerServiceConfig.create({
      data: {
        buyerId: homeadvisor.id,
        serviceTypeId: roofing.id,
        pingTemplate: JSON.stringify({ zip: '{{zipCode}}', homeowner: '{{ownsHome}}' }),
        postTemplate: JSON.stringify({ zip: '{{zipCode}}', homeowner: '{{ownsHome}}', roof_type: '{{roofType}}', roof_size: '{{roofSize}}' }),
        fieldMappings: JSON.stringify({ zipCode: 'zip', ownsHome: 'homeowner' }),
        requiresTrustedForm: true,
        requiresJornaya: false,
        minBid: 25.00,
        maxBid: 100.00
      }
    }),
    await prisma.buyerServiceConfig.create({
      data: {
        buyerId: homeadvisor.id,
        serviceTypeId: hvac.id,
        pingTemplate: JSON.stringify({ zip_code: '{{zipCode}}', property_owner: '{{ownsHome}}' }),
        postTemplate: JSON.stringify({ zip_code: '{{zipCode}}', property_owner: '{{ownsHome}}', system: '{{systemType}}' }),
        fieldMappings: JSON.stringify({ zipCode: 'zip_code', ownsHome: 'property_owner' }),
        requiresTrustedForm: false,
        requiresJornaya: true,
        minBid: 18.00,
        maxBid: 75.00
      }
    })
  )

  // Modernize - All 4 services
  buyerServiceConfigs.push(
    await prisma.buyerServiceConfig.create({
      data: {
        buyerId: modernize.id,
        serviceTypeId: windows.id,
        pingTemplate: JSON.stringify({ location: '{{zipCode}}', homeowner: '{{ownsHome}}' }),
        postTemplate: JSON.stringify({ location: '{{zipCode}}', homeowner: '{{ownsHome}}', window_count: '{{numberOfWindows}}' }),
        fieldMappings: JSON.stringify({ zipCode: 'location', ownsHome: 'homeowner' }),
        requiresTrustedForm: true,
        requiresJornaya: true,
        minBid: 12.00,
        maxBid: 55.00
      }
    }),
    await prisma.buyerServiceConfig.create({
      data: {
        buyerId: modernize.id,
        serviceTypeId: bathrooms.id,
        pingTemplate: JSON.stringify({ zip: '{{zipCode}}', owns_home: '{{ownsHome}}' }),
        postTemplate: JSON.stringify({ zip: '{{zipCode}}', owns_home: '{{ownsHome}}', bathroom_count: '{{bathroomCount}}', remodel_type: '{{remodelType}}' }),
        fieldMappings: JSON.stringify({ zipCode: 'zip', ownsHome: 'owns_home' }),
        requiresTrustedForm: false,
        requiresJornaya: true,
        minBid: 18.00,
        maxBid: 70.00
      }
    }),
    await prisma.buyerServiceConfig.create({
      data: {
        buyerId: modernize.id,
        serviceTypeId: roofing.id,
        pingTemplate: JSON.stringify({ zipcode: '{{zipCode}}', homeowner: '{{ownsHome}}' }),
        postTemplate: JSON.stringify({ zipcode: '{{zipCode}}', homeowner: '{{ownsHome}}', roof: '{{roofType}}', size: '{{roofSize}}' }),
        fieldMappings: JSON.stringify({ zipCode: 'zipcode', ownsHome: 'homeowner' }),
        requiresTrustedForm: true,
        requiresJornaya: false,
        minBid: 22.00,
        maxBid: 90.00
      }
    }),
    await prisma.buyerServiceConfig.create({
      data: {
        buyerId: modernize.id,
        serviceTypeId: hvac.id,
        pingTemplate: JSON.stringify({ postal: '{{zipCode}}', owner: '{{ownsHome}}' }),
        postTemplate: JSON.stringify({ postal: '{{zipCode}}', owner: '{{ownsHome}}', hvac_type: '{{systemType}}', service: '{{serviceType}}' }),
        fieldMappings: JSON.stringify({ zipCode: 'postal', ownsHome: 'owner' }),
        requiresTrustedForm: false,
        requiresJornaya: true,
        minBid: 15.00,
        maxBid: 65.00
      }
    })
  )

  // ABC Roofing - Only Roofing service
  buyerServiceConfigs.push(
    await prisma.buyerServiceConfig.create({
      data: {
        buyerId: abcRoofing.id,
        serviceTypeId: roofing.id,
        pingTemplate: JSON.stringify({ zip: '{{zipCode}}', owns: '{{ownsHome}}' }),
        postTemplate: JSON.stringify({ zip: '{{zipCode}}', owns: '{{ownsHome}}', type: '{{roofType}}', size: '{{roofSize}}', service: '{{serviceNeeded}}' }),
        fieldMappings: JSON.stringify({ zipCode: 'zip', ownsHome: 'owns' }),
        requiresTrustedForm: false,
        requiresJornaya: false,
        minBid: 30.00,
        maxBid: 120.00
      }
    })
  )

  // XYZ Windows - Windows and HVAC (they do window AC units)
  buyerServiceConfigs.push(
    await prisma.buyerServiceConfig.create({
      data: {
        buyerId: xyzWindows.id,
        serviceTypeId: windows.id,
        pingTemplate: JSON.stringify({ zipCode: '{{zipCode}}', homeOwner: '{{ownsHome}}' }),
        postTemplate: JSON.stringify({ zipCode: '{{zipCode}}', homeOwner: '{{ownsHome}}', numWindows: '{{numberOfWindows}}', windowType: '{{windowType}}' }),
        fieldMappings: JSON.stringify({ zipCode: 'zipCode', ownsHome: 'homeOwner' }),
        requiresTrustedForm: true,
        requiresJornaya: false,
        minBid: 20.00,
        maxBid: 85.00
      }
    }),
    await prisma.buyerServiceConfig.create({
      data: {
        buyerId: xyzWindows.id,
        serviceTypeId: hvac.id,
        pingTemplate: JSON.stringify({ zip: '{{zipCode}}', owner: '{{ownsHome}}' }),
        postTemplate: JSON.stringify({ zip: '{{zipCode}}', owner: '{{ownsHome}}', system: '{{systemType}}' }),
        fieldMappings: JSON.stringify({ zipCode: 'zip', ownsHome: 'owner' }),
        requiresTrustedForm: false,
        requiresJornaya: false,
        minBid: 12.00,
        maxBid: 50.00
      }
    })
  )

  // Angi - All 4 services
  buyerServiceConfigs.push(
    await prisma.buyerServiceConfig.create({
      data: {
        buyerId: angi.id,
        serviceTypeId: windows.id,
        pingTemplate: JSON.stringify({ postalCode: '{{zipCode}}', ownsProperty: '{{ownsHome}}' }),
        postTemplate: JSON.stringify({ postalCode: '{{zipCode}}', ownsProperty: '{{ownsHome}}', windowQty: '{{numberOfWindows}}' }),
        fieldMappings: JSON.stringify({ zipCode: 'postalCode', ownsHome: 'ownsProperty' }),
        requiresTrustedForm: false,
        requiresJornaya: true,
        minBid: 10.00,
        maxBid: 50.00
      }
    }),
    await prisma.buyerServiceConfig.create({
      data: {
        buyerId: angi.id,
        serviceTypeId: bathrooms.id,
        pingTemplate: JSON.stringify({ zip: '{{zipCode}}', homeowner: '{{ownsHome}}' }),
        postTemplate: JSON.stringify({ zip: '{{zipCode}}', homeowner: '{{ownsHome}}', bathCount: '{{bathroomCount}}' }),
        fieldMappings: JSON.stringify({ zipCode: 'zip', ownsHome: 'homeowner' }),
        requiresTrustedForm: false,
        requiresJornaya: true,
        minBid: 16.00,
        maxBid: 65.00
      }
    }),
    await prisma.buyerServiceConfig.create({
      data: {
        buyerId: angi.id,
        serviceTypeId: roofing.id,
        pingTemplate: JSON.stringify({ postal: '{{zipCode}}', owns: '{{ownsHome}}' }),
        postTemplate: JSON.stringify({ postal: '{{zipCode}}', owns: '{{ownsHome}}', roofing_type: '{{roofType}}' }),
        fieldMappings: JSON.stringify({ zipCode: 'postal', ownsHome: 'owns' }),
        requiresTrustedForm: true,
        requiresJornaya: false,
        minBid: 20.00,
        maxBid: 85.00
      }
    }),
    await prisma.buyerServiceConfig.create({
      data: {
        buyerId: angi.id,
        serviceTypeId: hvac.id,
        pingTemplate: JSON.stringify({ location: '{{zipCode}}', owner: '{{ownsHome}}' }),
        postTemplate: JSON.stringify({ location: '{{zipCode}}', owner: '{{ownsHome}}', hvacSystem: '{{systemType}}' }),
        fieldMappings: JSON.stringify({ zipCode: 'location', ownsHome: 'owner' }),
        requiresTrustedForm: false,
        requiresJornaya: true,
        minBid: 14.00,
        maxBid: 60.00
      }
    })
  )

  console.log(`✅ Created ${buyerServiceConfigs.length} buyer service configs\n`)

  // Continue to next section...

  // ==========================================
  // 5. BUYER SERVICE ZIP CODES
  // ==========================================
  console.log('📍 Creating buyer service ZIP codes...')

  const buyerServiceZipCodes = []

  // HomeAdvisor - National coverage (all services, most ZIPs with medium priority)
  const homeadvisorZips = ['90210', '90211', '10001', '10002', '10003', '75201', '75202', '33101', '33102', '60601', '60602', '85001', '19101', '30301', '98101', '02101', '80201', '89101', '97201', '48201', '28201', '37201', '43201']
  for (const zip of homeadvisorZips) {
    for (const service of [windows, bathrooms, roofing, hvac]) {
      buyerServiceZipCodes.push({
        buyerId: homeadvisor.id,
        serviceTypeId: service.id,
        zipCode: zip,
        active: true,
        priority: 5 + Math.floor(Math.random() * 3), // 5-7
        maxLeadsPerDay: 10 + Math.floor(Math.random() * 11), // 10-20
        minBid: 10.00,
        maxBid: 100.00
      })
    }
  }

  // Modernize - Major metro areas (all services, higher priority)
  const modernizeZips = ['90210', '94102', '10001', '10002', '75201', '77001', '33101', '32801', '60601', '85001', '19101', '30301', '98101', '02101', '80201']
  for (const zip of modernizeZips) {
    for (const service of [windows, bathrooms, roofing, hvac]) {
      buyerServiceZipCodes.push({
        buyerId: modernize.id,
        serviceTypeId: service.id,
        zipCode: zip,
        active: true,
        priority: 6 + Math.floor(Math.random() * 3), // 6-8
        maxLeadsPerDay: 8 + Math.floor(Math.random() * 8), // 8-15
        minBid: 12.00,
        maxBid: 90.00
      })
    }
  }

  // ABC Roofing - California only, roofing only (highest priority)
  const abcRoofingZips = ['90210', '90211', '90212', '90001', '90002', '90003', '94102', '94103', '94104', '92101', '92102', '92103']
  for (const zip of abcRoofingZips) {
    buyerServiceZipCodes.push({
      buyerId: abcRoofing.id,
      serviceTypeId: roofing.id,
      zipCode: zip,
      active: true,
      priority: 9 + Math.floor(Math.random() * 2), // 9-10
      maxLeadsPerDay: 5 + Math.floor(Math.random() * 6), // 5-10
      minBid: 30.00,
      maxBid: 120.00
    })
  }

  // XYZ Windows - California + New York, windows and HVAC (high priority)
  const xyzWindowsZips = ['90210', '90211', '94102', '92101', '10001', '10002', '10003', '10004', '10005']
  for (const zip of xyzWindowsZips) {
    for (const service of [windows, hvac]) {
      buyerServiceZipCodes.push({
        buyerId: xyzWindows.id,
        serviceTypeId: service.id,
        zipCode: zip,
        active: true,
        priority: 8 + Math.floor(Math.random() * 2), // 8-9
        maxLeadsPerDay: 7 + Math.floor(Math.random() * 9), // 7-15
        minBid: service.id === windows.id ? 20.00 : 12.00,
        maxBid: service.id === windows.id ? 85.00 : 50.00
      })
    }
  }

  // Angi - National coverage (all services, lower priority)
  const angiZips = ['90210', '10001', '75201', '33101', '60601', '85001', '19101', '30301', '98101', '02101', '80201', '89101', '97201', '48201', '28201', '37201', '43201', '78701', '32801', '33301']
  for (const zip of angiZips) {
    for (const service of [windows, bathrooms, roofing, hvac]) {
      buyerServiceZipCodes.push({
        buyerId: angi.id,
        serviceTypeId: service.id,
        zipCode: zip,
        active: true,
        priority: 4 + Math.floor(Math.random() * 3), // 4-6
        maxLeadsPerDay: 12 + Math.floor(Math.random() * 9), // 12-20
        minBid: 10.00,
        maxBid: 85.00
      })
    }
  }

  await prisma.buyerServiceZipCode.createMany({
    data: buyerServiceZipCodes
  })

  console.log(`✅ Created ${buyerServiceZipCodes.length} buyer service ZIP codes\n`)

  // ==========================================
  // 6. SAMPLE LEADS
  // ==========================================
  console.log('📋 Creating sample leads...')

  const sampleLeads = []
  const now = new Date()

  // SOLD leads (10)
  for (let i = 0; i < 10; i++) {
    const services = [windows, bathrooms, roofing, hvac]
    const service = services[i % 4]
    const zips = ['90210', '10001', '75201', '33101', '60601', '94102', '10002', '77001', '19101', '30301']
    const buyers = [homeadvisor, modernize, abcRoofing, xyzWindows, angi]
    
    sampleLeads.push({
      serviceTypeId: service.id,
      formData: JSON.stringify({
        zipCode: zips[i],
        ownsHome: 'Yes',
        timeframe: 'Immediately',
        firstName: `John${i}`,
        lastName: `Doe${i}`,
        email: `john${i}@example.com`,
        phone: `555-010-${1000 + i}`
      }),
      zipCode: zips[i],
      ownsHome: true,
      timeframe: 'Immediately',
      status: 'SOLD',
      winningBuyerId: buyers[i % 5].id,
      winningBid: 25.00 + (i * 5),
      trustedFormCertUrl: `https://cert.trustedform.com/cert-${i}`,
      trustedFormCertId: `tf-${i}-cert-id`,
      jornayaLeadId: `jrnaya-${i}-lead-id`,
      complianceData: JSON.stringify({ tcpa: true, verified: true }),
      leadQualityScore: 85 + Math.floor(Math.random() * 16), // 85-100
      createdAt: new Date(now.getTime() - (i * 24 * 60 * 60 * 1000)) // Spread over last 10 days
    })
  }

  // PROCESSING leads (5)
  for (let i = 10; i < 15; i++) {
    const services = [windows, bathrooms, roofing, hvac]
    const service = services[i % 4]
    const zips = ['92101', '80201', '89101', '97201', '48201']
    
    sampleLeads.push({
      serviceTypeId: service.id,
      formData: JSON.stringify({
        zipCode: zips[i - 10],
        ownsHome: 'Yes',
        timeframe: '1-3 months',
        firstName: `Jane${i}`,
        lastName: `Smith${i}`,
        email: `jane${i}@example.com`,
        phone: `555-020-${1000 + i}`
      }),
      zipCode: zips[i - 10],
      ownsHome: true,
      timeframe: '1-3 months',
      status: 'PROCESSING',
      trustedFormCertUrl: `https://cert.trustedform.com/cert-${i}`,
      trustedFormCertId: `tf-${i}-cert-id`,
      jornayaLeadId: `jrnaya-${i}-lead-id`,
      complianceData: JSON.stringify({ tcpa: true, verified: true }),
      leadQualityScore: 70 + Math.floor(Math.random() * 21), // 70-90
      createdAt: new Date(now.getTime() - (60 * 1000)) // 1 minute ago
    })
  }

  // PENDING leads (5)
  for (let i = 15; i < 20; i++) {
    const services = [windows, bathrooms, roofing, hvac]
    const service = services[i % 4]
    const zips = ['28201', '37201', '43201', '78701', '32801']
    
    sampleLeads.push({
      serviceTypeId: service.id,
      formData: JSON.stringify({
        zipCode: zips[i - 15],
        ownsHome: 'Yes',
        timeframe: '3-6 months',
        firstName: `Bob${i}`,
        lastName: `Johnson${i}`,
        email: `bob${i}@example.com`,
        phone: `555-030-${1000 + i}`
      }),
      zipCode: zips[i - 15],
      ownsHome: true,
      timeframe: '3-6 months',
      status: 'PENDING',
      trustedFormCertUrl: `https://cert.trustedform.com/cert-${i}`,
      trustedFormCertId: `tf-${i}-cert-id`,
      jornayaLeadId: `jrnaya-${i}-lead-id`,
      complianceData: JSON.stringify({ tcpa: true, verified: false }),
      leadQualityScore: 60 + Math.floor(Math.random() * 21), // 60-80
      createdAt: new Date(now.getTime() - (30 * 1000)) // 30 seconds ago
    })
  }

  const createdLeads = []
  for (const leadData of sampleLeads) {
    const lead = await prisma.lead.create({ data: leadData })
    createdLeads.push(lead)
  }

  console.log(`✅ Created ${createdLeads.length} sample leads\n`)

  // ==========================================
  // 7. TRANSACTIONS & COMPLIANCE LOGS
  // ==========================================
  console.log('💼 Creating transactions and compliance logs...')

  let transactionCount = 0
  let auditLogCount = 0

  // Create transactions for SOLD leads (3-5 transactions per lead)
  for (let i = 0; i < 10; i++) {
    const lead = createdLeads[i]
    const buyers = [homeadvisor, modernize, angi]
    
    // Create compliance audit log
    await prisma.complianceAuditLog.create({
      data: {
        leadId: lead.id,
        eventType: 'FORM_SUBMITTED',
        eventData: JSON.stringify({ form: 'submitted', timestamp: lead.createdAt }),
        ipAddress: `192.168.1.${i + 1}`,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        createdAt: lead.createdAt
      }
    })
    auditLogCount++

    // PING transactions (parallel to all qualified buyers)
    for (const buyer of buyers) {
      await prisma.transaction.create({
        data: {
          leadId: lead.id,
          buyerId: buyer.id,
          actionType: 'PING',
          payload: JSON.stringify({ zipCode: lead.zipCode, serviceType: lead.serviceTypeId }),
          response: JSON.stringify({ bid: 25 + (Math.random() * 50), accept: true }),
          status: 'SUCCESS',
          bidAmount: 25 + (Math.random() * 50),
          responseTime: 100 + Math.floor(Math.random() * 400), // 100-500ms
          complianceIncluded: true,
          trustedFormPresent: true,
          jornayaPresent: true,
          createdAt: new Date(lead.createdAt.getTime() + 1000) // 1 second after lead created
        }
      })
      transactionCount++
    }

    // POST transaction to winner
    await prisma.transaction.create({
      data: {
        leadId: lead.id,
        buyerId: lead.winningBuyerId!,
        actionType: 'POST',
        payload: JSON.stringify({ 
          lead_id: lead.id,
          zipCode: lead.zipCode,
          formData: JSON.parse(lead.formData)
        }),
        response: JSON.stringify({ success: true, external_id: `ext-${i}-${Date.now()}` }),
        status: 'SUCCESS',
        bidAmount: lead.winningBid!,
        responseTime: 500 + Math.floor(Math.random() * 1500), // 500-2000ms
        complianceIncluded: true,
        trustedFormPresent: true,
        jornayaPresent: true,
        createdAt: new Date(lead.createdAt.getTime() + 5000) // 5 seconds after lead created
      }
    })
    transactionCount++
  }

  console.log(`✅ Created ${transactionCount} transactions`)
  console.log(`✅ Created ${auditLogCount} compliance audit logs\n`)

  console.log('=' .repeat(50))
  console.log('🎉 Database seeding completed successfully!\n')
  console.log('Summary:')
  console.log(`- Admin Users: 3`)
  console.log(`- Service Types: 4`)
  console.log(`- Buyers: 5`)
  console.log(`- ZIP Codes: ${zipCodes.length}`)
  console.log(`- Buyer Service Configs: ${buyerServiceConfigs.length}`)
  console.log(`- Buyer Service ZIP Codes: ${buyerServiceZipCodes.length}`)
  console.log(`- Leads: ${createdLeads.length}`)
  console.log(`- Transactions: ${transactionCount}`)
  console.log(`- Compliance Logs: ${auditLogCount}`)
  console.log('=' .repeat(50))
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:')
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
