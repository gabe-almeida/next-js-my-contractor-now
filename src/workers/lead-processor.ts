import { processQueue } from '@/lib/redis';
import { prisma } from '@/lib/db';
import { AppError } from '@/lib/utils';
import { AuctionEngine } from '@/lib/auction/engine';
import type { LeadData, ServiceType, ComplianceData } from '@/lib/templates/types';

// Helper function to convert Prisma lead to LeadData format
function convertToLeadData(lead: any): LeadData {
  const serviceType: ServiceType = {
    id: lead.serviceType.id,
    name: lead.serviceType.name,
    formSchema: typeof lead.serviceType.formSchema === 'string'
      ? JSON.parse(lead.serviceType.formSchema)
      : lead.serviceType.formSchema,
    active: lead.serviceType.active,
  };

  const complianceData: ComplianceData | undefined = lead.complianceData
    ? (typeof lead.complianceData === 'string'
        ? JSON.parse(lead.complianceData)
        : lead.complianceData)
    : undefined;

  const formData = typeof lead.formData === 'string'
    ? JSON.parse(lead.formData)
    : lead.formData;

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

    // Get lead with service type (no longer pre-loading buyers)
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        serviceType: true,
      },
    });

    if (!lead) {
      throw new AppError(`Lead ${leadId} not found`, 404);
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
      await prisma.lead.updateMany({
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

      console.log(`Lead ${leadId} sold to buyer ${auctionResult.winningBuyerId} for $${auctionResult.winningBidAmount}`);
    } else if (auctionResult.winningBuyerId && !auctionResult.postResult?.success) {
      // Auction had winner but POST failed
      await prisma.lead.updateMany({
        where: {
          id: leadId,
          status: 'PROCESSING'
        },
        data: { status: 'DELIVERY_FAILED' },
      });

      console.log(`Lead ${leadId} auction won by ${auctionResult.winningBuyerId} but delivery failed`);
    } else {
      // No winner or no eligible buyers
      await prisma.lead.updateMany({
        where: {
          id: leadId,
          status: 'PROCESSING'
        },
        data: { status: 'REJECTED' },
      });

      console.log(`Lead ${leadId} rejected - ${auctionResult.participantCount === 0 ? 'no eligible buyers' : 'no winning bids'}`);
    }

    console.log(`Lead ${leadId} processing completed successfully`);

  } catch (error) {
    console.error(`Failed to process lead ${leadId}:`, error);

    try {
      // Only update to REJECTED if still PROCESSING (atomic check)
      await prisma.lead.updateMany({
        where: {
          id: leadId,
          status: 'PROCESSING'
        },
        data: { status: 'REJECTED' },
      });
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