import { processQueue } from '@/lib/redis';
import { prisma } from '@/lib/db';
import { AppError } from '@/lib/utils';
import { AuctionEngine } from '@/lib/auction/engine';
import { recordSystemStatusChange } from '@/lib/services/lead-accounting-service';
import { LeadStatus, ChangeSource } from '@/types/database';
import type { LeadData, ServiceType, ComplianceData } from '@/lib/templates/types';

// Safe JSON parse with fallback - prevents worker crash on malformed data
function safeJsonParse<T>(value: unknown, fallback: T, fieldName: string): T {
  if (typeof value !== 'string') {
    return value as T;
  }
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    console.error(`Failed to parse ${fieldName} JSON:`, error);
    return fallback;
  }
}

// Default empty FormSchema for fallback
const emptyFormSchema = { fields: [], validations: [] };

// Helper function to convert Prisma lead to LeadData format
function convertToLeadData(lead: any): LeadData {
  const serviceType: ServiceType = {
    id: lead.serviceType.id,
    name: lead.serviceType.name,
    formSchema: safeJsonParse(lead.serviceType.formSchema, emptyFormSchema, 'formSchema'),
    active: lead.serviceType.active,
  };

  const complianceData: ComplianceData | undefined = lead.complianceData
    ? safeJsonParse<ComplianceData | undefined>(lead.complianceData, undefined, 'complianceData')
    : undefined;

  const formData = safeJsonParse(lead.formData, {}, 'formData');

  return {
    id: lead.id,
    serviceTypeId: lead.serviceTypeId,
    serviceType,
    formData,
    zipCode: lead.zipCode,
    ownsHome: lead.ownsHome,
    timeframe: lead.timeframe,
    status: lead.status,
    trustedFormCertUrl: lead.trustedFormCertUrl,
    trustedFormCertId: lead.trustedFormCertId,
    jornayaLeadId: lead.jornayaLeadId,
    complianceData,
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
  };
}

async function processLead(job: any) {
  const { leadId } = job.data;

  console.log(`Processing lead ${leadId}`);

  try {
    // Update lead status to PROCESSING with atomic check to prevent race conditions
    // Only update if status is currently PENDING (optimistic locking)
    const updateResult = await prisma.lead.updateMany({
      where: {
        id: leadId,
        status: 'PENDING' // Only process if still pending
      },
      data: { status: 'PROCESSING' },
    });

    // If no rows were updated, another worker already claimed this lead
    if (updateResult.count === 0) {
      console.log(`Lead ${leadId} already being processed by another worker, skipping`);
      return;
    }

    // Record PENDING → PROCESSING transition in history
    await recordSystemStatusChange(
      leadId,
      LeadStatus.PENDING,
      LeadStatus.PROCESSING,
      'Auction started by worker',
      ChangeSource.SYSTEM
    );

    // Get lead with service type (no longer pre-loading buyers)
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        serviceType: true,
      },
    });

    if (!lead) {
      throw new AppError(`Lead ${leadId} not found`, 'RESOURCE_NOT_FOUND');
    }

    // Convert to LeadData format expected by advanced auction engine
    const leadData = convertToLeadData(lead);

    console.log(`Running auction for lead ${leadId} with ZIP code ${leadData.zipCode} and service type ${leadData.serviceType.name}`);

    // Run auction using advanced engine with ZIP filtering
    const auctionResult = await AuctionEngine.runAuction(leadData);

    console.log(`Auction completed for lead ${leadId}: ${auctionResult.participantCount} eligible buyers, ${auctionResult.allBids.length} bids received, status: ${auctionResult.status}`);

    // Update lead based on auction result (with atomic checks to prevent race conditions)
    if (auctionResult.winningBuyerId && auctionResult.postResult?.success) {
      // Only mark as SOLD if POST was successful and still PROCESSING
      const soldResult = await prisma.lead.updateMany({
        where: {
          id: leadId,
          status: 'PROCESSING' // Only update if still in processing state
        },
        data: {
          status: 'SOLD',
          winningBuyerId: auctionResult.winningBuyerId,
          winningBid: auctionResult.winningBidAmount,
        },
      });

      // Record history only if update succeeded
      if (soldResult.count > 0) {
        await recordSystemStatusChange(
          leadId,
          LeadStatus.PROCESSING,
          LeadStatus.SOLD,
          `Sold to buyer ${auctionResult.winningBuyerId} for $${auctionResult.winningBidAmount}`,
          ChangeSource.SYSTEM
        );
      }

      console.log(`Lead ${leadId} sold to buyer ${auctionResult.winningBuyerId} for $${auctionResult.winningBidAmount}`);
    } else if (auctionResult.winningBuyerId && !auctionResult.postResult?.success) {
      // Auction had winner but POST failed
      const failedResult = await prisma.lead.updateMany({
        where: {
          id: leadId,
          status: 'PROCESSING'
        },
        data: { status: 'DELIVERY_FAILED' },
      });

      // Record history only if update succeeded
      if (failedResult.count > 0) {
        await recordSystemStatusChange(
          leadId,
          LeadStatus.PROCESSING,
          LeadStatus.DELIVERY_FAILED,
          `Delivery failed to buyer ${auctionResult.winningBuyerId}: ${auctionResult.postResult?.error || 'Unknown error'}`,
          ChangeSource.SYSTEM
        );
      }

      console.log(`Lead ${leadId} auction won by ${auctionResult.winningBuyerId} but delivery failed`);
    } else {
      // No winner or no eligible buyers
      const rejectedResult = await prisma.lead.updateMany({
        where: {
          id: leadId,
          status: 'PROCESSING'
        },
        data: { status: 'REJECTED' },
      });

      // Record history only if update succeeded
      if (rejectedResult.count > 0) {
        const reason = auctionResult.participantCount === 0
          ? 'No eligible buyers found for auction'
          : 'No winning bids received';
        await recordSystemStatusChange(
          leadId,
          LeadStatus.PROCESSING,
          LeadStatus.REJECTED,
          reason,
          ChangeSource.SYSTEM
        );
      }

      console.log(`Lead ${leadId} rejected - ${auctionResult.participantCount === 0 ? 'no eligible buyers' : 'no winning bids'}`);
    }

    console.log(`Lead ${leadId} processing completed successfully`);

  } catch (error) {
    console.error(`Failed to process lead ${leadId}:`, error);

    try {
      // Only update to REJECTED if still PROCESSING (atomic check)
      const errorResult = await prisma.lead.updateMany({
        where: {
          id: leadId,
          status: 'PROCESSING'
        },
        data: { status: 'REJECTED' },
      });

      // Record history if update succeeded
      if (errorResult.count > 0) {
        await recordSystemStatusChange(
          leadId,
          LeadStatus.PROCESSING,
          LeadStatus.REJECTED,
          `Processing error: ${(error as Error).message}`,
          ChangeSource.SYSTEM
        );
      }
    } catch (updateError) {
      console.error(`Failed to update lead ${leadId} status to REJECTED:`, updateError);
    }

    // Re-throw to trigger retry mechanism
    throw error;
  }
}

// Start the worker if this file is run directly
if (require.main === module) {
  console.log('Starting lead processor worker...');
  processQueue('lead-processing', processLead);
}

export { processLead };