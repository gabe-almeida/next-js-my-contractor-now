/**
 * Admin IVR Flow Detail API
 *
 * WHY: CRUD operations for individual IVR flow configurations.
 * WHEN: Admin views, updates, or deletes a specific IVR flow.
 * HOW: REST API with Prisma database operations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { validateIvrFlow, parseIvrFlow } from '@/lib/ivr/executor';
import type { IvrStep } from '@/types/ivr';

// ============================================
// GET - Get single IVR flow
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const flow = await prisma.ivrFlow.findUnique({
      where: { id },
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
    });

    if (!flow) {
      return NextResponse.json(
        { success: false, error: 'IVR flow not found' },
        { status: 404 }
      );
    }

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
        _count: flow._count,
      },
    });
  } catch (error) {
    logger.error({
      event: 'api.admin.ivr_flows.get_error',
      error: (error as Error).message,
    });

    return NextResponse.json(
      { success: false, error: 'Failed to get IVR flow' },
      { status: 500 }
    );
  }
}

// ============================================
// PUT - Update IVR flow
// ============================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, serviceTypeId, steps, defaultTimeout, maxRetries, active } = body;

    // Check flow exists
    const existingFlow = await prisma.ivrFlow.findUnique({
      where: { id },
    });

    if (!existingFlow) {
      return NextResponse.json(
        { success: false, error: 'IVR flow not found' },
        { status: 404 }
      );
    }

    // Validate if steps are provided
    if (steps) {
      if (!Array.isArray(steps) || steps.length === 0) {
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

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (serviceTypeId !== undefined) updateData.serviceTypeId = serviceTypeId;
    if (steps !== undefined) updateData.steps = steps as IvrStep[];
    if (defaultTimeout !== undefined) updateData.defaultTimeout = defaultTimeout;
    if (maxRetries !== undefined) updateData.maxRetries = maxRetries;
    if (active !== undefined) updateData.active = active;

    // Update the flow
    const flow = await prisma.ivrFlow.update({
      where: { id },
      data: updateData,
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
      event: 'api.admin.ivr_flows.updated',
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
      event: 'api.admin.ivr_flows.update_error',
      error: (error as Error).message,
    });

    return NextResponse.json(
      { success: false, error: 'Failed to update IVR flow' },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE - Delete IVR flow
// ============================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check flow exists and get usage count
    const flow = await prisma.ivrFlow.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            campaigns: true,
            trackingNumbers: true,
          },
        },
      },
    });

    if (!flow) {
      return NextResponse.json(
        { success: false, error: 'IVR flow not found' },
        { status: 404 }
      );
    }

    // Prevent deletion if in use
    const usageCount = (flow._count?.campaigns || 0) + (flow._count?.trackingNumbers || 0);
    if (usageCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot delete IVR flow that is in use by ${usageCount} campaign(s) or tracking number(s)`,
        },
        { status: 400 }
      );
    }

    // Delete the flow
    await prisma.ivrFlow.delete({
      where: { id },
    });

    logger.info({
      event: 'api.admin.ivr_flows.deleted',
      flowId: id,
      name: flow.name,
    });

    return NextResponse.json({
      success: true,
      message: 'IVR flow deleted successfully',
    });
  } catch (error) {
    logger.error({
      event: 'api.admin.ivr_flows.delete_error',
      error: (error as Error).message,
    });

    return NextResponse.json(
      { success: false, error: 'Failed to delete IVR flow' },
      { status: 500 }
    );
  }
}
