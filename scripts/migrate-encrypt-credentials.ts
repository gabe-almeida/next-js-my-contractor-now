/**
 * Migration Script: Encrypt Buyer Credentials
 *
 * Encrypts existing plaintext credentials in the database:
 * - buyer.authConfig
 * - buyer.webhookSecret
 *
 * Usage:
 *   tsx scripts/migrate-encrypt-credentials.ts [--dry-run]
 */

import { prisma } from '../src/lib/db';
import { encrypt, isEncrypted } from '../src/lib/security/encryption';

interface MigrationStats {
  total: number;
  alreadyEncrypted: number;
  encrypted: number;
  skipped: number;
  errors: number;
}

async function migrateBuyerCredentials(dryRun: boolean = false): Promise<MigrationStats> {
  const stats: MigrationStats = {
    total: 0,
    alreadyEncrypted: 0,
    encrypted: 0,
    skipped: 0,
    errors: 0
  };

  console.log('🔐 Starting credential encryption migration...');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}\n`);

  // Fetch all buyers
  const buyers = await prisma.buyer.findMany({
    select: {
      id: true,
      name: true,
      authConfig: true,
      webhookSecret: true,
    },
  });

  stats.total = buyers.length;
  console.log(`Found ${buyers.length} buyers to process\n`);

  for (const buyer of buyers) {
    console.log(`Processing buyer: ${buyer.name} (${buyer.id})`);

    let authConfigUpdated = false;
    let webhookSecretUpdated = false;

    // Check and encrypt authConfig
    if (buyer.authConfig) {
      if (isEncrypted(buyer.authConfig)) {
        console.log('  ✓ authConfig already encrypted');
        stats.alreadyEncrypted++;
      } else {
        try {
          const encrypted = encrypt(buyer.authConfig);
          console.log(`  🔒 Encrypting authConfig (${buyer.authConfig.length} bytes → ${encrypted.length} bytes)`);

          if (!dryRun) {
            await prisma.buyer.update({
              where: { id: buyer.id },
              data: { authConfig: encrypted },
            });
          }

          authConfigUpdated = true;
          stats.encrypted++;
        } catch (error) {
          console.error(`  ❌ Error encrypting authConfig: ${error instanceof Error ? error.message : 'Unknown error'}`);
          stats.errors++;
        }
      }
    } else {
      console.log('  - authConfig is null (skipped)');
      stats.skipped++;
    }

    // Check and encrypt webhookSecret
    if (buyer.webhookSecret) {
      if (isEncrypted(buyer.webhookSecret)) {
        console.log('  ✓ webhookSecret already encrypted');
        stats.alreadyEncrypted++;
      } else {
        try {
          const encrypted = encrypt(buyer.webhookSecret);
          console.log(`  🔒 Encrypting webhookSecret (${buyer.webhookSecret.length} bytes → ${encrypted.length} bytes)`);

          if (!dryRun) {
            await prisma.buyer.update({
              where: { id: buyer.id },
              data: { webhookSecret: encrypted },
            });
          }

          webhookSecretUpdated = true;
          stats.encrypted++;
        } catch (error) {
          console.error(`  ❌ Error encrypting webhookSecret: ${error instanceof Error ? error.message : 'Unknown error'}`);
          stats.errors++;
        }
      }
    } else {
      console.log('  - webhookSecret is null (skipped)');
      stats.skipped++;
    }

    if (dryRun && (authConfigUpdated || webhookSecretUpdated)) {
      console.log('  ⚠️  DRY RUN: Changes not persisted');
    }

    console.log('');
  }

  return stats;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  try {
    // Verify encryption key is set
    if (!process.env.ENCRYPTION_KEY) {
      console.error('❌ ENCRYPTION_KEY environment variable is not set');
      console.error('Generate a key with: openssl rand -base64 32');
      process.exit(1);
    }

    // Run migration
    const stats = await migrateBuyerCredentials(dryRun);

    // Print summary
    console.log('═'.repeat(60));
    console.log('Migration Summary:');
    console.log('═'.repeat(60));
    console.log(`Total buyers:         ${stats.total}`);
    console.log(`Already encrypted:    ${stats.alreadyEncrypted}`);
    console.log(`Newly encrypted:      ${stats.encrypted}`);
    console.log(`Skipped (null):       ${stats.skipped}`);
    console.log(`Errors:               ${stats.errors}`);
    console.log('═'.repeat(60));

    if (dryRun) {
      console.log('\n⚠️  DRY RUN MODE - No changes were made to the database');
      console.log('Run without --dry-run to apply changes');
    } else {
      console.log('\n✅ Migration completed successfully!');
    }

    process.exit(stats.errors > 0 ? 1 : 0);
  } catch (error) {
    console.error('\n❌ Migration failed:');
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
main();
