/**
 * Buyer Call Settings API
 *
 * WHY: Provides REST endpoints for managing buyer call configuration.
 *      Enables admin UI to read and update call settings.
 *
 * WHEN: Use these endpoints when:
 *       - GET: Loading Call Settings tab in buyer detail page
 *       - PUT: Saving call settings from admin form
 *
 * HOW: Validates admin authentication, delegates to service layer.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import {
  getBuyerCallSettings,
  updateBuyerCallSettings,
  BuyerCallSettings
} from '@/lib/services/buyer-call-settings-service';

// =====================================
// GET - Fetch buyer call settings
// =====================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: buyerId } = await params;

  try {
    // Verify buyer exists
    const buyer = await prisma.buyer.findUnique({
      where: { id: buyerId },
      select: { id: true, name: true }
    });

    if (!buyer) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Buyer not found' }
        },
        { status: 404 }
      );
    }

    const settings = await getBuyerCallSettings(buyerId);

    return NextResponse.json({
      success: true,
      data: settings
    });
  } catch (error) {
    logger.error('Failed to fetch buyer call settings', {
      buyerId,
      error: (error as Error).message
    });

    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch call settings' }
      },
      { status: 500 }
    );
  }
}

// =====================================
// PUT - Update buyer call settings
// =====================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: buyerId } = await params;

  try {
    // Verify buyer exists
    const buyer = await prisma.buyer.findUnique({
      where: { id: buyerId },
      select: { id: true, name: true }
    });

    if (!buyer) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Buyer not found' }
        },
        { status: 404 }
      );
    }

    // Parse request body
    let body: BuyerCallSettings;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INVALID_JSON', message: 'Invalid request body' }
        },
        { status: 400 }
      );
    }

    // Validate required fields are present
    if (typeof body.acceptsCalls !== 'boolean') {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'acceptsCalls is required' }
        },
        { status: 400 }
      );
    }

    // Call service to update settings
    const result = await updateBuyerCallSettings(buyerId, body);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: result.error }
        },
        { status: 400 }
      );
    }

    logger.info('Buyer call settings updated via API', {
      buyerId,
      buyerName: buyer.name,
      acceptsCalls: body.acceptsCalls
    });

    return NextResponse.json({
      success: true,
      data: result.data,
      message: 'Call settings saved successfully'
    });
  } catch (error) {
    logger.error('Failed to update buyer call settings', {
      buyerId,
      error: (error as Error).message
    });

    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to update call settings' }
      },
      { status: 500 }
    );
  }
}
