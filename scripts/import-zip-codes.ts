#!/usr/bin/env npx ts-node

/**
 * CLI Script: Import ZIP Codes
 *
 * WHY: Allow quick ZIP code imports without going through the admin UI
 * WHEN: Monthly ZIP code updates from buyers like Modernize
 * HOW: Reads Excel/CSV file and imports using ZipCodeImportService
 *
 * Usage:
 *   npx ts-node scripts/import-zip-codes.ts <file> <buyerName> [--preset=modernize]
 *
 * Examples:
 *   npx ts-node scripts/import-zip-codes.ts ./downloads/modernize-jan-2025.xlsx Modernize --preset=modernize
 *   npx ts-node scripts/import-zip-codes.ts ./zips.csv "HomeAdvisor" --service=windows
 */

import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

// Initialize Prisma
const prisma = new PrismaClient();

// Import service and types
import {
  ZipCodeImportService,
  SheetMapping,
  MODERNIZE_SHEET_MAPPINGS,
} from '../src/lib/services/zip-code-import-service';

interface CliOptions {
  file: string;
  buyerName: string;
  preset?: string;
  service?: string;
  dryRun?: boolean;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error(`
Usage: npx ts-node scripts/import-zip-codes.ts <file> <buyerName> [options]

Arguments:
  file        Path to Excel (.xlsx) or CSV file
  buyerName   Name of the buyer (e.g., "Modernize", "HomeAdvisor")

Options:
  --preset=modernize  Use Modernize sheet mappings (Bath Refacing + Bath Remodel → bathrooms)
  --service=<name>    Import for specific service type only (e.g., --service=windows)
  --dry-run           Parse file and show what would be imported without making changes

Examples:
  npx ts-node scripts/import-zip-codes.ts ~/Downloads/modernize.xlsx Modernize --preset=modernize
  npx ts-node scripts/import-zip-codes.ts ./zips.csv HomeAdvisor --service=windows
`);
    process.exit(1);
  }

  const options: CliOptions = {
    file: args[0],
    buyerName: args[1],
  };

  for (let i = 2; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--preset=')) {
      options.preset = arg.split('=')[1];
    } else if (arg.startsWith('--service=')) {
      options.service = arg.split('=')[1];
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    }
  }

  return options;
}

async function main() {
  const options = parseArgs();

  console.log('\n📁 ZIP Code Import Tool\n');
  console.log(`File: ${options.file}`);
  console.log(`Buyer: ${options.buyerName}`);
  console.log(`Preset: ${options.preset || 'none'}`);
  console.log(`Service: ${options.service || 'all'}`);
  console.log(`Dry Run: ${options.dryRun || false}\n`);

  // Check if file exists
  const filePath = path.resolve(options.file);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }

  // Find buyer
  const buyer = await prisma.buyer.findFirst({
    where: {
      OR: [
        { name: { contains: options.buyerName, mode: 'insensitive' } },
        { id: options.buyerName },
      ],
    },
  });

  if (!buyer) {
    console.error(`❌ Buyer not found: ${options.buyerName}`);

    // List available buyers
    const buyers = await prisma.buyer.findMany({
      select: { id: true, name: true },
    });
    console.log('\nAvailable buyers:');
    buyers.forEach((b) => console.log(`  - ${b.name} (${b.id})`));
    process.exit(1);
  }

  console.log(`✅ Found buyer: ${buyer.name} (${buyer.id})\n`);

  // Read file
  const buffer = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);

  // Determine sheet mappings
  let sheetMappings: SheetMapping[];

  if (options.preset === 'modernize') {
    sheetMappings = MODERNIZE_SHEET_MAPPINGS;
    console.log('📋 Using Modernize preset mappings:');
    sheetMappings.forEach((m) => {
      console.log(`  - ${m.sourceSheets.join(' + ')} → ${m.serviceTypeName}`);
    });
  } else if (options.service) {
    // Create simple mapping for single service
    sheetMappings = [{
      serviceTypeName: options.service,
      sourceSheets: ['default'], // CSV default sheet name
      defaultPriority: 100,
    }];
  } else {
    console.error('❌ Please specify --preset=modernize or --service=<name>');
    process.exit(1);
  }

  console.log('\n🔄 Parsing file...\n');

  // Parse file to preview
  const isExcel = fileName.toLowerCase().endsWith('.xlsx') ||
                  fileName.toLowerCase().endsWith('.xls');
  const parsedData = isExcel
    ? await ZipCodeImportService.parseExcelFile(buffer, fileName)
    : await ZipCodeImportService.parseCsvFile(buffer, fileName);

  console.log(`Found ${parsedData.sheets.length} sheet(s):`);
  parsedData.sheets.forEach((sheet) => {
    console.log(`  - "${sheet.name}": ${sheet.zipCodes.length} ZIP codes`);
  });

  if (options.dryRun) {
    console.log('\n🔍 DRY RUN - No changes will be made\n');

    // Show what would be imported
    for (const mapping of sheetMappings) {
      const matchingSheets = parsedData.sheets.filter((sheet) =>
        mapping.sourceSheets.some((sourceName) =>
          sheet.name.toLowerCase().includes(sourceName.toLowerCase()) ||
          sourceName.toLowerCase().includes(sheet.name.toLowerCase())
        )
      );

      if (matchingSheets.length > 0) {
        const zipLists = matchingSheets.map((sheet) => sheet.zipCodes);
        const originalTotal = zipLists.reduce((sum, list) => sum + list.length, 0);
        const combined = ZipCodeImportService.combineAndDedupe(zipLists, mapping.defaultPriority);

        console.log(`\n📊 ${mapping.serviceTypeName}:`);
        console.log(`   Sheets: ${matchingSheets.map((s) => s.name).join(', ')}`);
        console.log(`   Original total: ${originalTotal}`);
        console.log(`   After dedup: ${combined.length}`);
        console.log(`   Duplicates removed: ${originalTotal - combined.length}`);

        // Sample ZIP codes
        console.log(`   Sample ZIPs: ${combined.slice(0, 5).map((z) => z.zipCode).join(', ')}...`);
      }
    }

    console.log('\n✅ Dry run complete. Run without --dry-run to import.\n');
    await prisma.$disconnect();
    return;
  }

  // Confirm before import
  console.log('\n⚠️  This will REPLACE all existing ZIP codes for the mapped service types.');
  console.log('Press Ctrl+C to cancel, or wait 3 seconds to continue...\n');
  await new Promise((resolve) => setTimeout(resolve, 3000));

  console.log('🚀 Starting import...\n');

  // Run import
  const results = await ZipCodeImportService.importFromFile(
    buffer,
    fileName,
    buyer.id,
    sheetMappings
  );

  // Display results
  console.log('\n📊 Import Results:\n');

  let totalImported = 0;
  let totalDuplicates = 0;

  for (const result of results) {
    if (result.success) {
      console.log(`✅ ${result.serviceType}:`);
      console.log(`   Previous: ${result.previousZipCount} ZIPs`);
      console.log(`   New: ${result.newZipCount} ZIPs`);
      console.log(`   Duplicates removed: ${result.duplicatesRemoved}`);
      totalImported += result.newZipCount;
      totalDuplicates += result.duplicatesRemoved;
    } else {
      console.log(`❌ ${result.serviceType}: ${result.error}`);
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📦 Total imported: ${totalImported} ZIP codes`);
  console.log(`🔄 Total duplicates removed: ${totalDuplicates}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('❌ Import failed:', error);
  process.exit(1);
});
