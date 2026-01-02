/**
 * Field Mappings Migration Script
 *
 * WHY: Convert hardcoded buyer configurations to database field mappings
 * WHEN: One-time migration when enabling database-driven field mappings
 * HOW: Parse existing configurations and save as FieldMappingConfig JSON
 *
 * Usage: npx tsx scripts/migrate-field-mappings.ts
 */

import { PrismaClient } from '@prisma/client';
import { createEmptyFieldMappingConfig, createFieldMapping } from '../src/types/field-mapping';
import type { FieldMapping, FieldMappingConfig } from '../src/types/field-mapping';

const prisma = new PrismaClient();

/**
 * Legacy mapping format from configurations.ts
 */
interface LegacyMapping {
  sourceField: string;
  targetField: string;
  required?: boolean;
  transform?: string;
}

interface LegacyTemplate {
  mappings: LegacyMapping[];
  includeCompliance?: boolean;
  additionalFields?: Record<string, unknown>;
}

/**
 * Convert legacy mapping to new FieldMapping format
 */
function convertMapping(
  legacy: LegacyMapping,
  index: number,
  includeInPing: boolean,
  includeInPost: boolean
): FieldMapping {
  return createFieldMapping({
    sourceField: legacy.sourceField,
    targetField: legacy.targetField,
    required: legacy.required ?? false,
    transform: legacy.transform,
    order: index,
    includeInPing,
    includeInPost,
  });
}

/**
 * Convert legacy templates to FieldMappingConfig
 */
function convertToFieldMappingConfig(
  pingTemplate: LegacyTemplate | null,
  postTemplate: LegacyTemplate | null
): FieldMappingConfig {
  const config = createEmptyFieldMappingConfig();

  // Track which source fields are in PING vs POST
  const pingFields = new Set(pingTemplate?.mappings.map((m) => m.sourceField) || []);
  const postFields = new Set(postTemplate?.mappings.map((m) => m.sourceField) || []);

  // All unique source fields
  const allSourceFields = new Set([...Array.from(pingFields), ...Array.from(postFields)]);

  // Create mappings - use POST template as primary source (more complete)
  let order = 0;
  for (const sourceField of Array.from(allSourceFields)) {
    // Find the mapping definition (prefer POST)
    const postMapping = postTemplate?.mappings.find((m) => m.sourceField === sourceField);
    const pingMapping = pingTemplate?.mappings.find((m) => m.sourceField === sourceField);
    const legacy = postMapping || pingMapping;

    if (!legacy) continue;

    config.mappings.push(
      convertMapping(
        legacy,
        order++,
        pingFields.has(sourceField),
        postFields.has(sourceField)
      )
    );
  }

  // Add static fields from POST template
  if (postTemplate?.additionalFields) {
    for (const [key, value] of Object.entries(postTemplate.additionalFields)) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        config.staticFields[key] = value;
      }
    }
  }

  return config;
}

/**
 * Main migration function
 */
async function migrateFieldMappings() {
  console.log('Starting field mappings migration...\n');

  try {
    // Get all buyer service configs
    const serviceConfigs = await prisma.buyerServiceConfig.findMany({
      include: {
        buyer: { select: { name: true } },
        serviceType: { select: { displayName: true } },
      },
    });

    console.log(`Found ${serviceConfigs.length} buyer service configurations.\n`);

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const config of serviceConfigs) {
      const identifier = `${config.buyer.name} - ${config.serviceType.displayName}`;

      try {
        // Check if already has field mappings
        if (config.fieldMappings) {
          try {
            const existing = JSON.parse(config.fieldMappings);
            if (existing.mappings && existing.mappings.length > 0) {
              console.log(`⏭️  Skipping ${identifier} - already has field mappings`);
              skippedCount++;
              continue;
            }
          } catch {
            // Invalid JSON, will be replaced
          }
        }

        // Parse existing templates
        let pingTemplate: LegacyTemplate | null = null;
        let postTemplate: LegacyTemplate | null = null;

        try {
          if (config.pingTemplate) {
            pingTemplate = JSON.parse(config.pingTemplate);
          }
        } catch (e) {
          console.warn(`  Warning: Could not parse pingTemplate for ${identifier}`);
        }

        try {
          if (config.postTemplate) {
            postTemplate = JSON.parse(config.postTemplate);
          }
        } catch (e) {
          console.warn(`  Warning: Could not parse postTemplate for ${identifier}`);
        }

        // Convert to new format
        const newConfig = convertToFieldMappingConfig(pingTemplate, postTemplate);

        // If no mappings were created, create a default config
        if (newConfig.mappings.length === 0) {
          console.log(`⚠️  ${identifier} - No mappings found in templates, creating empty config`);
          // Keep empty config so it can be configured via UI
        }

        // Save to database
        await prisma.buyerServiceConfig.update({
          where: { id: config.id },
          data: {
            fieldMappings: JSON.stringify(newConfig),
          },
        });

        console.log(`✅ Migrated ${identifier} - ${newConfig.mappings.length} mappings`);
        migratedCount++;
      } catch (error) {
        console.error(`❌ Error migrating ${identifier}:`, error);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('Migration Summary:');
    console.log(`  ✅ Migrated: ${migratedCount}`);
    console.log(`  ⏭️  Skipped: ${skippedCount}`);
    console.log(`  ❌ Errors: ${errorCount}`);
    console.log('='.repeat(50));

    if (errorCount === 0) {
      console.log('\n✅ Migration completed successfully!');
      console.log('\nNext steps:');
      console.log('1. Review the migrated configurations in the admin UI');
      console.log('2. Set USE_DATABASE_FIELD_MAPPINGS=true in your .env file');
      console.log('3. Test the auction system with the new configurations');
    } else {
      console.log('\n⚠️  Migration completed with errors. Please review and fix manually.');
    }
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migrateFieldMappings();
