/**
 * Admin API: ZIP Code File Preview
 *
 * WHY: Allow admins to preview file contents before importing
 * WHEN: Called after file upload but before actual import
 * HOW: Parses file and returns sheet info, ZIP counts, and samples
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ZipCodeImportService, MODERNIZE_SHEET_MAPPINGS } from '@/lib/services/zip-code-import-service';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/admin/buyers/[id]/zip-codes/preview
 *
 * Preview a ZIP code file before importing
 *
 * Body (FormData):
 * - file: Excel or CSV file with ZIP codes
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

    // Read file buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Parse the file
    const isExcel = fileExtension === 'xlsx' || fileExtension === 'xls';
    const parsedData = isExcel
      ? await ZipCodeImportService.parseExcelFile(buffer, file.name)
      : await ZipCodeImportService.parseCsvFile(buffer, file.name);

    logger.info('File preview parsed', {
      buyerId,
      fileName: file.name,
      sheetCount: parsedData.sheets.length,
    });

    // Build preview response
    const sheets = parsedData.sheets.map((sheet) => ({
      name: sheet.name,
      zipCount: sheet.zipCodes.length,
      sampleZips: sheet.zipCodes.slice(0, 5).map((z) => ({
        zipCode: z.zipCode,
        city: z.city,
        state: z.state,
        tier: z.tier,
      })),
      // Check for potential service type matches using Modernize mappings
      potentialServiceTypes: MODERNIZE_SHEET_MAPPINGS
        .filter((mapping) =>
          mapping.sourceSheets.some((sourceName) =>
            sheet.name.toLowerCase().includes(sourceName.toLowerCase()) ||
            sourceName.toLowerCase().includes(sheet.name.toLowerCase())
          )
        )
        .map((mapping) => mapping.serviceTypeName),
    }));

    // Get current ZIP counts for comparison
    const currentZipCounts = await prisma.buyerServiceZipCode.groupBy({
      by: ['serviceTypeId'],
      where: { buyerId },
      _count: { zipCode: true },
    });

    const serviceTypes = await prisma.serviceType.findMany({
      where: { active: true },
      select: { id: true, name: true, displayName: true },
    });

    const currentCounts = currentZipCounts.map((count) => {
      const serviceType = serviceTypes.find((s) => s.id === count.serviceTypeId);
      return {
        serviceTypeId: count.serviceTypeId,
        serviceTypeName: serviceType?.name || 'unknown',
        displayName: serviceType?.displayName || 'Unknown',
        currentZipCount: count._count.zipCode,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        fileName: file.name,
        fileSize: buffer.length,
        sheets,
        currentZipCounts: currentCounts,
        availableMappings: MODERNIZE_SHEET_MAPPINGS.map((m) => ({
          serviceTypeName: m.serviceTypeName,
          sourceSheets: m.sourceSheets,
        })),
      },
    });
  } catch (error) {
    logger.error('Failed to preview ZIP code file', {
      error: (error as Error).message,
      stack: (error as Error).stack,
    });

    return NextResponse.json({
      success: false,
      error: (error as Error).message || 'Failed to preview file',
    }, { status: 500 });
  }
}
