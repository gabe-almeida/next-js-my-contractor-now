/**
 * Field Mapping Preview API Route
 *
 * WHY: Generate payload preview for admin UI
 * WHEN: Admin wants to see what JSON will be sent to buyer
 * HOW: Apply mappings to sample or provided data
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  generatePayloadPreview,
  getSampleLeadData,
} from '@/lib/field-mapping/configuration-service';
import type { FieldMappingConfig } from '@/types/field-mapping';

/**
 * POST /api/admin/field-mappings/preview
 *
 * Generate PING and POST payload preview.
 *
 * Body:
 * - config: FieldMappingConfig to use for transformation
 * - sampleData: (optional) Custom sample data, defaults to generated sample
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { config, sampleData } = body as {
      config: FieldMappingConfig;
      sampleData?: Record<string, unknown>;
    };

    if (!config) {
      return NextResponse.json(
        { success: false, error: 'config is required' },
        { status: 400 }
      );
    }

    // Use provided sample data or generate default
    const data = sampleData || getSampleLeadData();

    // Generate preview
    const preview = generatePayloadPreview(config, data);

    return NextResponse.json({
      success: true,
      preview,
      sampleDataUsed: data,
    });
  } catch (error) {
    console.error('Field mapping preview error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
