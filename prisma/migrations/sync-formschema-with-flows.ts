/**
 * Database Migration: Sync formSchema with Hardcoded Question Flows
 *
 * WHY: The database formSchema was out of sync with the hardcoded question flows.
 *      This migration updates formSchema to match the actual forms being displayed.
 *
 * WHEN: Run once to migrate existing services.
 *
 * HOW: Updates ServiceType.formSchema for windows, roofing, bathrooms to match
 *      the hardcoded flows in src/lib/questions.ts, while preserving buyer-expected fields.
 *
 * RUN: npx ts-node prisma/migrations/sync-formschema-with-flows.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * FormSchema definitions that match the hardcoded question flows
 * These include service-specific questions (standard questions are added by flow builder)
 */
const formSchemas = {
  windows: {
    fields: [
      {
        name: 'projectScope',
        type: 'select',
        label: 'Are you looking to repair existing windows or install new windows?',
        required: true,
        options: [
          { value: 'repair', label: 'Repair' },
          { value: 'install', label: 'Install' }
        ]
      },
      {
        name: 'numberOfWindows',
        type: 'select',
        label: 'How many windows?',
        required: true,
        options: [
          { value: '1', label: '1 window' },
          { value: '2', label: '2 windows' },
          { value: '3-5', label: '3-5 windows' },
          { value: '6-9', label: '6-9 windows' },
          { value: '9+', label: '9+ windows' }
        ]
      },
      // Add windowType for buyer compatibility (buyers expect this field)
      {
        name: 'windowType',
        type: 'select',
        label: 'What type of windows?',
        required: true,
        options: [
          { value: 'double_hung', label: 'Double Hung' },
          { value: 'casement', label: 'Casement' },
          { value: 'sliding', label: 'Sliding' },
          { value: 'bay_bow', label: 'Bay/Bow' },
          { value: 'not_sure', label: 'Not Sure' }
        ]
      }
    ]
  },

  roofing: {
    fields: [
      {
        name: 'projectScope',
        type: 'select',
        label: 'What type of roofing work do you need?',
        required: true,
        options: [
          { value: 'repair', label: 'Repair existing roof' },
          { value: 'replacement', label: 'Full roof replacement' },
          { value: 'installation', label: 'New roof installation' }
        ]
      },
      {
        name: 'roofType',
        type: 'select',
        label: 'What type of roof?',
        required: true,
        options: [
          { value: 'asphalt_shingles', label: 'Asphalt Shingles' },
          { value: 'metal', label: 'Metal' },
          { value: 'tile', label: 'Tile' },
          { value: 'not_sure', label: 'Not Sure' }
        ]
      },
      {
        name: 'roofSize',
        type: 'select',
        label: 'Approximate roof size?',
        required: true,
        options: [
          { value: 'small', label: 'Small (under 1,500 sq ft)' },
          { value: 'medium', label: 'Medium (1,500-3,000 sq ft)' },
          { value: 'large', label: 'Large (over 3,000 sq ft)' }
        ]
      },
      // Add serviceNeeded as alias for projectScope (some buyers expect this)
      {
        name: 'serviceNeeded',
        type: 'select',
        label: 'Service needed?',
        required: false, // Optional since projectScope covers this
        options: [
          { value: 'new_roof', label: 'New Roof' },
          { value: 'repair', label: 'Repair' },
          { value: 'inspection', label: 'Inspection' },
          { value: 'not_sure', label: 'Not Sure' }
        ]
      }
    ]
  },

  bathrooms: {
    fields: [
      {
        name: 'projectScope',
        type: 'select',
        label: 'What type of bathroom work do you need?',
        required: true,
        options: [
          { value: 'full_renovation', label: 'Full bathroom renovation' },
          { value: 'partial_remodel', label: 'Partial remodel/updates' },
          { value: 'new_bathroom', label: 'New bathroom addition' },
          { value: 'repair', label: 'Repair/maintenance work' }
        ]
      },
      {
        name: 'bathroomType',
        type: 'select',
        label: 'What type of bathroom is this?',
        required: true,
        options: [
          { value: 'master_bath', label: 'Master bathroom' },
          { value: 'guest_bath', label: 'Guest bathroom' },
          { value: 'half_bath', label: 'Half bathroom/powder room' },
          { value: 'other', label: 'Other' }
        ]
      },
      {
        name: 'projectSize',
        type: 'select',
        label: 'What is the approximate size of your bathroom?',
        required: true,
        options: [
          { value: 'small', label: 'Small (under 40 sq ft)' },
          { value: 'medium', label: 'Medium (40-100 sq ft)' },
          { value: 'large', label: 'Large (over 100 sq ft)' }
        ]
      },
      // Add bathroomCount for buyer compatibility
      {
        name: 'bathroomCount',
        type: 'select',
        label: 'How many bathrooms?',
        required: true,
        options: [
          { value: '1', label: '1' },
          { value: '2', label: '2' },
          { value: '3', label: '3' },
          { value: '4+', label: '4+' }
        ]
      },
      // Add remodelType as alias for projectScope
      {
        name: 'remodelType',
        type: 'select',
        label: 'Type of remodel?',
        required: false, // Optional since projectScope covers this
        options: [
          { value: 'full_remodel', label: 'Full Remodel' },
          { value: 'partial_update', label: 'Partial Update' },
          { value: 'fixtures_only', label: 'Fixtures Only' },
          { value: 'not_sure', label: 'Not Sure' }
        ]
      }
    ]
  }
};

async function main() {
  console.log('🔄 Syncing formSchema with hardcoded question flows...\n');

  for (const [serviceName, schema] of Object.entries(formSchemas)) {
    console.log(`📝 Updating ${serviceName}...`);

    const service = await prisma.serviceType.findFirst({
      where: { name: serviceName }
    });

    if (!service) {
      console.log(`   ⚠️  Service "${serviceName}" not found, skipping`);
      continue;
    }

    // Store old schema for reference
    const oldSchema = service.formSchema;
    console.log(`   Old schema: ${oldSchema?.substring(0, 100)}...`);

    // Update with new schema
    const newSchema = JSON.stringify(schema);
    await prisma.serviceType.update({
      where: { id: service.id },
      data: { formSchema: newSchema }
    });

    console.log(`   ✅ Updated with ${schema.fields.length} fields`);
    console.log(`   Fields: ${schema.fields.map(f => f.name).join(', ')}\n`);
  }

  console.log('✅ Migration complete!\n');
  console.log('Next steps:');
  console.log('1. Verify forms work at /services/windows, /services/roofing, /services/bathrooms');
  console.log('2. Test lead submission and verify buyer PING/POST payloads');
  console.log('3. Update buyer templates if needed to use new field names');
}

main()
  .catch((e) => {
    console.error('❌ Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
