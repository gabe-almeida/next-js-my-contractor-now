/**
 * Admin IVR Flows API
 *
 * WHY: CRUD operations for IVR flow configurations.
 * WHEN: Admin creates, reads, updates IVR flows for call qualification.
 * HOW: REST API backed by Prisma database operations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';
import { validateIvrFlow, parseIvrFlow } from '@/lib/ivr/executor';
import type { IvrStep } from '@/types/ivr';

// ============================================
// GET - List all IVR flows
// ============================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serviceTypeId = searchParams.get('serviceTypeId');
    const active = searchParams.get('active');

    const where: Record<string, unknown> = {};

    if (serviceTypeId) {
      where.serviceTypeId = serviceTypeId;
    }

    if (active !== null) {
      where.active = active === 'true';
    }

    const flows = await prisma.ivrFlow.findMany({
      where,
      include: {
        serviceType: {
          select: {
            id: true,
            name: true,
            displayName: true,
          },
        },
        _count: {
          select: {
            campaigns: true,
            trackingNumbers: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Transform for response
    const response = flows.map((flow) => ({
      id: flow.id,
      name: flow.name,
      description: flow.description,
      serviceTypeId: flow.serviceTypeId,
      stepCount: Array.isArray(flow.steps) ? (flow.steps as unknown[]).length : 0,
      defaultTimeout: flow.defaultTimeout,
      maxRetries: flow.maxRetries,
      active: flow.active,
      createdAt: flow.createdAt.toISOString(),
      updatedAt: flow.updatedAt.toISOString(),
      serviceType: flow.serviceType,
      usageCount: (flow._count?.campaigns || 0) + (flow._count?.trackingNumbers || 0),
    }));

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    logger.error({
      event: 'api.admin.ivr_flows.list_error',
      error: (error as Error).message,
    });

    return NextResponse.json(
      { success: false, error: 'Failed to list IVR flows' },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Create a new IVR flow
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, serviceTypeId, steps, defaultTimeout, maxRetries, active } = body;

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Name is required' },
        { status: 400 }
      );
    }

    if (!steps || !Array.isArray(steps) || steps.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one step is required' },
        { status: 400 }
      );
    }

    // Validate flow configuration
    const flowConfig = parseIvrFlow(steps);
    const validationErrors = validateIvrFlow(flowConfig);

    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid IVR flow configuration',
          validationErrors,
        },
        { status: 400 }
      );
    }

    // Verify service type exists if provided
    if (serviceTypeId) {
      const serviceType = await prisma.serviceType.findUnique({
        where: { id: serviceTypeId },
      });

      if (!serviceType) {
        return NextResponse.json(
          { success: false, error: 'Service type not found' },
          { status: 400 }
        );
      }
    }

    // Create the flow
    const flow = await prisma.ivrFlow.create({
      data: {
        name,
        description,
        serviceTypeId,
        steps: steps as unknown as Prisma.JsonArray,
        defaultTimeout: defaultTimeout || 10,
        maxRetries: maxRetries || 3,
        active: active !== false,
      },
      include: {
        serviceType: {
          select: {
            id: true,
            name: true,
            displayName: true,
          },
        },
      },
    });

    logger.info({
      event: 'api.admin.ivr_flows.created',
      flowId: flow.id,
      name: flow.name,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: flow.id,
        name: flow.name,
        description: flow.description,
        serviceTypeId: flow.serviceTypeId,
        steps: flow.steps,
        defaultTimeout: flow.defaultTimeout,
        maxRetries: flow.maxRetries,
        active: flow.active,
        createdAt: flow.createdAt.toISOString(),
        updatedAt: flow.updatedAt.toISOString(),
        serviceType: flow.serviceType,
      },
    });
  } catch (error) {
    logger.error({
      event: 'api.admin.ivr_flows.create_error',
      error: (error as Error).message,
    });

    return NextResponse.json(
      { success: false, error: 'Failed to create IVR flow' },
      { status: 500 }
    );
  }
}
