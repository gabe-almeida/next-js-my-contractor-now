/**
 * Admin API: Bulk ZIP Code Import
 *
 * WHY: Allow admins to upload monthly ZIP code updates from buyers like Modernize
 * WHEN: POST to upload Excel/CSV file and replace all ZIP codes for mapped service types
 * HOW: Uses ZipCodeImportService for parsing, deduplication, and atomic replacement
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  ZipCodeImportService,
  SheetMapping,
  MODERNIZE_SHEET_MAPPINGS,
} from '@/lib/services/zip-code-import-service';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/admin/buyers/[id]/zip-codes/bulk
 *
 * Upload and replace ZIP codes for a buyer using file upload
 *
 * Body (FormData):
 * - file: Excel or CSV file with ZIP codes
 * - mappingPreset: 'modernize' or 'custom'
 * - customMappings: JSON string of SheetMapping[] (if mappingPreset === 'custom')
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: buyerId } = await params;

    // Verify buyer exists
    const buyer = await prisma.buyer.findUnique({
      where: { id: buyerId },
      select: { id: true, name: true },
    });

    if (!buyer) {
      return NextResponse.json({
        success: false,
        error: 'Buyer not found',
      }, { status: 404 });
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const mappingPreset = formData.get('mappingPreset') as string || 'modernize';
    const customMappingsJson = formData.get('customMappings') as string | null;

    if (!file) {
      return NextResponse.json({
        success: false,
        error: 'No file uploaded',
      }, { status: 400 });
    }

    // Validate file type
    const fileExtension = file.name.toLowerCase().split('.').pop();
    const isValidExtension = ['xlsx', 'xls', 'csv'].includes(fileExtension || '');

    if (!isValidExtension) {
      return NextResponse.json({
        success: false,
        error: 'Invalid file type. Please upload .xlsx, .xls, or .csv file',
      }, { status: 400 });
    }

    // Determine sheet mappings
    let sheetMappings: SheetMapping[];

    if (mappingPreset === 'custom' && customMappingsJson) {
      try {
        sheetMappings = JSON.parse(customMappingsJson);
      } catch {
        return NextResponse.json({
          success: false,
          error: 'Invalid custom mappings JSON',
        }, { status: 400 });
      }
    } else {
      // Use Modernize preset by default
      sheetMappings = MODERNIZE_SHEET_MAPPINGS;
    }

    // Read file buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    logger.info('Starting bulk ZIP code import', {
      buyerId,
      buyerName: buyer.name,
      fileName: file.name,
      fileSize: buffer.length,
      mappingPreset,
    });

    // Import ZIP codes
    const results = await ZipCodeImportService.importFromFile(
      buffer,
      file.name,
      buyerId,
      sheetMappings
    );

    // Calculate summary
    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);
    const totalImported = successful.reduce((sum, r) => sum + r.newZipCount, 0);
    const totalDuplicatesRemoved = successful.reduce((sum, r) => sum + r.duplicatesRemoved, 0);

    logger.info('Bulk ZIP code import completed', {
      buyerId,
      buyerName: buyer.name,
      totalImported,
      serviceTypesUpdated: successful.length,
      failed: failed.length,
    });

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalImported,
          totalDuplicatesRemoved,
          serviceTypesUpdated: successful.length,
          serviceTypesFailed: failed.length,
        },
        results,
      },
    });
  } catch (error) {
    logger.error('Bulk ZIP code import failed', {
      error: (error as Error).message,
      stack: (error as Error).stack,
    });

    return NextResponse.json({
      success: false,
      error: (error as Error).message || 'Bulk ZIP code import failed',
    }, { status: 500 });
  }
}

/**
 * GET /api/admin/buyers/[id]/zip-codes/bulk
 *
 * Get last import info and current ZIP code status
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: buyerId } = await params;

    // Verify buyer exists
    const buyer = await prisma.buyer.findUnique({
      where: { id: buyerId },
      select: { id: true, name: true },
    });

    if (!buyer) {
      return NextResponse.json({
        success: false,
        error: 'Buyer not found',
      }, { status: 404 });
    }

    // Get ZIP code info for all service types
    const updateInfo = await ZipCodeImportService.getLastUpdateInfo(buyerId);

    // Get total ZIP count
    const totalZipCodes = await prisma.buyerServiceZipCode.count({
      where: { buyerId },
    });

    return NextResponse.json({
      success: true,
      data: {
        buyer: {
          id: buyer.id,
          name: buyer.name,
        },
        totalZipCodes,
        serviceTypes: updateInfo,
      },
    });
  } catch (error) {
    logger.error('Failed to get bulk import info', {
      error: (error as Error).message,
    });

    return NextResponse.json({
      success: false,
      error: 'Failed to retrieve import information',
    }, { status: 500 });
  }
}
