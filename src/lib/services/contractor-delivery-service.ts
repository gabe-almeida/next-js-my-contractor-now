/**
 * Contractor Delivery Service
 * Handles direct lead delivery to contractors (no PING/POST auction)
 *
 * WHY: Contractors are local businesses that don't have API integrations.
 *      They receive leads via email, webhook (CRM), or dashboard notification.
 * WHEN: Called when a lead matches contractor service zones and buyer type is CONTRACTOR
 * HOW: Ranks contractors, delivers based on delivery mode (EXCLUSIVE/SHARED)
 */

import { prisma } from '../db';
import { logger } from '../logger';
import { LeadNotificationService, LeadNotificationData, ContractorInfo } from './lead-notification-service';

// Types
export interface ContractorDeliveryResult {
  success: boolean;
  deliveredTo: DeliveredContractor[];
  totalRevenue: number;
  errors: string[];
}

export interface DeliveredContractor {
  buyerId: string;
  buyerName: string;
  price: number;
  deliveryMethods: string[];
  transactionId: string;
}

export interface EligibleContractor {
  buyerId: string;
  buyerName: string;
  displayName: string | null;
  pricingModel: string; // FIXED, AUCTION, HYBRID
  fixedLeadPrice: number | null;
  maxBid: number | null;
  deliveryMode: string; // EXCLUSIVE, SHARED
  maxSharedLeads: number;
  priority: number;
  notifyEmail: boolean;
  notifyWebhook: boolean;
  notifyDashboard: boolean;
  contactEmail: string | null;
  businessEmail: string | null;
  apiUrl: string | null; // Webhook URL
}

export interface LeadForDelivery {
  id: string;
  serviceTypeId: string;
  zipCode: string;
  formData: Record<string, any>;
  trustedFormCertUrl?: string;
  trustedFormCertId?: string;
  ownsHome: boolean;
  timeframe: string;
}

/**
 * ContractorDeliveryService
 * Delivers leads directly to contractors without PING/POST auction
 */
export class ContractorDeliveryService {
  /**
   * Deliver a lead to eligible contractors
   *
   * @param lead - The lead to deliver
   * @param networkWinningBid - If network auction ran first, this is what they bid (for HYBRID pricing)
   * @returns Delivery result with all contractors that received the lead
   */
  static async deliverToContractors(
    lead: LeadForDelivery,
    networkWinningBid?: number
  ): Promise<ContractorDeliveryResult> {
    const result: ContractorDeliveryResult = {
      success: false,
      deliveredTo: [],
      totalRevenue: 0,
      errors: [],
    };

    try {
      // Task 4.3: Get and rank eligible contractors
      const contractors = await this.getEligibleContractors(
        lead.serviceTypeId,
        lead.zipCode
      );

      if (contractors.length === 0) {
        logger.info('No eligible contractors found', {
          leadId: lead.id,
          serviceTypeId: lead.serviceTypeId,
          zipCode: lead.zipCode,
        });
        return result;
      }

      // Rank contractors
      const rankedContractors = this.rankContractors(contractors, networkWinningBid);

      logger.info('Ranked contractors for delivery', {
        leadId: lead.id,
        count: rankedContractors.length,
        topContractor: rankedContractors[0]?.buyerName,
      });

      // Determine delivery mode from top contractor
      // All contractors in the same zone should have same delivery mode
      const deliveryMode = rankedContractors[0]?.deliveryMode || 'EXCLUSIVE';

      if (deliveryMode === 'EXCLUSIVE') {
        // Task 4.4: EXCLUSIVE - deliver to top contractor only
        const delivered = await this.deliverExclusive(lead, rankedContractors);
        if (delivered) {
          result.deliveredTo.push(delivered);
          result.totalRevenue = delivered.price;
          result.success = true;
        }
      } else {
        // Task 4.5: SHARED - deliver to top N contractors
        const maxShared = rankedContractors[0]?.maxSharedLeads || 3;
        const delivered = await this.deliverShared(lead, rankedContractors, maxShared);
        result.deliveredTo = delivered;
        result.totalRevenue = delivered.reduce((sum, d) => sum + d.price, 0);
        result.success = delivered.length > 0;
      }

      // Mark non-selected contractors as losers
      await this.markNonSelectedContractors(
        lead.id,
        rankedContractors,
        result.deliveredTo.map(d => d.buyerId),
        deliveryMode
      );

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Contractor delivery failed', {
        leadId: lead.id,
        error: errorMessage,
      });
      result.errors.push(errorMessage);
      return result;
    }
  }

  /**
   * Get contractors eligible for a service type and zip code
   */
  private static async getEligibleContractors(
    serviceTypeId: string,
    zipCode: string
  ): Promise<EligibleContractor[]> {
    // Query contractors with matching service zones
    const serviceZones = await prisma.buyerServiceZipCode.findMany({
      where: {
        serviceTypeId,
        zipCode,
        active: true,
        buyer: {
          type: 'CONTRACTOR',
          active: true,
        },
      },
      include: {
        buyer: {
          select: {
            id: true,
            name: true,
            displayName: true,
            pricingModel: true,
            fixedLeadPrice: true,
            deliveryMode: true,
            maxSharedLeads: true,
            notifyEmail: true,
            notifyWebhook: true,
            notifyDashboard: true,
            contactEmail: true,
            businessEmail: true,
            apiUrl: true,
          },
        },
      },
    });

    // Get service config for maxBid
    const serviceConfigs = await prisma.buyerServiceConfig.findMany({
      where: {
        serviceTypeId,
        buyerId: {
          in: serviceZones.map(sz => sz.buyerId),
        },
        active: true,
      },
      select: {
        buyerId: true,
        maxBid: true,
      },
    });

    const maxBidMap = new Map(serviceConfigs.map(sc => [sc.buyerId, Number(sc.maxBid)]));

    return serviceZones.map(sz => ({
      buyerId: sz.buyer.id,
      buyerName: sz.buyer.name,
      displayName: sz.buyer.displayName,
      pricingModel: sz.buyer.pricingModel,
      fixedLeadPrice: sz.buyer.fixedLeadPrice ? Number(sz.buyer.fixedLeadPrice) : null,
      maxBid: maxBidMap.get(sz.buyerId) ?? null,
      deliveryMode: sz.buyer.deliveryMode,
      maxSharedLeads: sz.buyer.maxSharedLeads,
      priority: sz.priority,
      notifyEmail: sz.buyer.notifyEmail,
      notifyWebhook: sz.buyer.notifyWebhook,
      notifyDashboard: sz.buyer.notifyDashboard,
      contactEmail: sz.buyer.contactEmail,
      businessEmail: sz.buyer.businessEmail,
      apiUrl: sz.buyer.apiUrl,
    }));
  }

  /**
   * Task 4.3: Rank contractors by priority and pricing
   *
   * Ranking order:
   * 1. Priority (lower number = higher priority)
   * 2. If AUCTION pricing: by maxBid descending
   * 3. If FIXED pricing: by fixedLeadPrice descending (higher = more valuable customer)
   */
  private static rankContractors(
    contractors: EligibleContractor[],
    networkWinningBid?: number
  ): EligibleContractor[] {
    return [...contractors].sort((a, b) => {
      // First by priority (lower = better)
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }

      // Then by effective price
      const priceA = this.getEffectivePrice(a, networkWinningBid);
      const priceB = this.getEffectivePrice(b, networkWinningBid);

      // Higher price = higher ranking
      return priceB - priceA;
    });
  }

  /**
   * Get effective price based on pricing model
   */
  private static getEffectivePrice(
    contractor: EligibleContractor,
    networkWinningBid?: number
  ): number {
    switch (contractor.pricingModel) {
      case 'FIXED':
        return contractor.fixedLeadPrice ?? 0;

      case 'AUCTION':
        return contractor.maxBid ?? 0;

      case 'HYBRID':
        // HYBRID: use auction price for exclusive, reduced for shared
        // If network auction ran, use that as reference
        if (networkWinningBid && contractor.deliveryMode === 'SHARED') {
          return networkWinningBid * 0.5; // 50% of network price for shared
        }
        return contractor.maxBid ?? contractor.fixedLeadPrice ?? 0;

      default:
        return contractor.fixedLeadPrice ?? contractor.maxBid ?? 0;
    }
  }

  /**
   * Task 4.4: Deliver to single top contractor (EXCLUSIVE mode)
   */
  private static async deliverExclusive(
    lead: LeadForDelivery,
    rankedContractors: EligibleContractor[]
  ): Promise<DeliveredContractor | null> {
    if (rankedContractors.length === 0) return null;

    const contractor = rankedContractors[0];
    const price = this.getEffectivePrice(contractor);
    const deliveryMethods: string[] = [];

    try {
      // Deliver via all enabled methods
      if (contractor.notifyEmail) {
        await this.sendLeadEmail(lead, contractor);
        deliveryMethods.push('EMAIL');
      }

      if (contractor.notifyWebhook && contractor.apiUrl) {
        await this.sendLeadWebhook(lead, contractor);
        deliveryMethods.push('WEBHOOK');
      }

      if (contractor.notifyDashboard) {
        await this.createDashboardNotification(lead, contractor);
        deliveryMethods.push('DASHBOARD');
      }

      // Log transaction
      const transaction = await this.logDeliveryTransaction(
        lead,
        contractor,
        price,
        deliveryMethods,
        true // isWinner
      );

      // Task 6.3 & 6.4: Update lead with winner using optimistic locking
      // Only update if lead is still in PROCESSING state to prevent race conditions
      const updateResult = await prisma.lead.updateMany({
        where: {
          id: lead.id,
          status: { in: ['PENDING', 'PROCESSING', 'AUCTIONED'] }, // Only if not already sold
        },
        data: {
          winningBuyerId: contractor.buyerId,
          winningBid: price,
          status: 'SOLD',
        },
      });

      // If no rows updated, lead was already sold (race condition)
      if (updateResult.count === 0) {
        logger.warn('Lead already sold - race condition detected', {
          leadId: lead.id,
          attemptedBuyerId: contractor.buyerId,
        });
        return null;
      }

      return {
        buyerId: contractor.buyerId,
        buyerName: contractor.buyerName,
        price,
        deliveryMethods,
        transactionId: transaction.id,
      };

    } catch (error) {
      logger.error('Failed to deliver to contractor', {
        leadId: lead.id,
        buyerId: contractor.buyerId,
        error: (error as Error).message,
      });
      return null;
    }
  }

  /**
   * Task 4.5: Deliver to multiple contractors (SHARED mode)
   * Each contractor pays FULL price
   */
  private static async deliverShared(
    lead: LeadForDelivery,
    rankedContractors: EligibleContractor[],
    maxShared: number
  ): Promise<DeliveredContractor[]> {
    const delivered: DeliveredContractor[] = [];
    const toDeliver = rankedContractors.slice(0, maxShared);

    for (const contractor of toDeliver) {
      const price = this.getEffectivePrice(contractor);
      const deliveryMethods: string[] = [];

      try {
        // Deliver via all enabled methods
        if (contractor.notifyEmail) {
          await this.sendLeadEmail(lead, contractor);
          deliveryMethods.push('EMAIL');
        }

        if (contractor.notifyWebhook && contractor.apiUrl) {
          await this.sendLeadWebhook(lead, contractor);
          deliveryMethods.push('WEBHOOK');
        }

        if (contractor.notifyDashboard) {
          await this.createDashboardNotification(lead, contractor);
          deliveryMethods.push('DASHBOARD');
        }

        // Log transaction - all shared recipients are winners
        const transaction = await this.logDeliveryTransaction(
          lead,
          contractor,
          price,
          deliveryMethods,
          true // isWinner - all shared recipients are winners
        );

        delivered.push({
          buyerId: contractor.buyerId,
          buyerName: contractor.buyerName,
          price,
          deliveryMethods,
          transactionId: transaction.id,
        });

      } catch (error) {
        logger.error('Failed to deliver to shared contractor', {
          leadId: lead.id,
          buyerId: contractor.buyerId,
          error: (error as Error).message,
        });
        // Continue to next contractor
      }
    }

    // Task 6.3 & 6.4: Update lead with first winner using optimistic locking
    if (delivered.length > 0) {
      const updateResult = await prisma.lead.updateMany({
        where: {
          id: lead.id,
          status: { in: ['PENDING', 'PROCESSING', 'AUCTIONED'] }, // Only if not already sold
        },
        data: {
          winningBuyerId: delivered[0].buyerId,
          winningBid: delivered.reduce((sum, d) => sum + d.price, 0),
          status: 'SOLD',
        },
      });

      // If race condition detected, log but don't fail (leads were already delivered)
      if (updateResult.count === 0) {
        logger.warn('Lead status already updated - possible race condition', {
          leadId: lead.id,
          deliveredCount: delivered.length,
        });
      }
    }

    return delivered;
  }

  /**
   * Mark contractors that didn't receive the lead
   */
  private static async markNonSelectedContractors(
    leadId: string,
    allContractors: EligibleContractor[],
    selectedIds: string[],
    deliveryMode: string
  ): Promise<void> {
    const nonSelected = allContractors.filter(c => !selectedIds.includes(c.buyerId));

    for (const contractor of nonSelected) {
      await prisma.transaction.create({
        data: {
          leadId,
          buyerId: contractor.buyerId,
          actionType: 'DELIVERY',
          payload: JSON.stringify({ attempted: false }),
          status: 'FAILED',
          isWinner: false,
          lostReason: deliveryMode === 'EXCLUSIVE' ? 'NOT_SELECTED' : 'LOWER_PRIORITY',
        },
      });
    }
  }

  /**
   * Log delivery transaction
   */
  private static async logDeliveryTransaction(
    lead: LeadForDelivery,
    contractor: EligibleContractor,
    price: number,
    deliveryMethods: string[],
    isWinner: boolean
  ): Promise<{ id: string }> {
    return prisma.transaction.create({
      data: {
        leadId: lead.id,
        buyerId: contractor.buyerId,
        actionType: 'DELIVERY',
        payload: JSON.stringify({
          serviceTypeId: lead.serviceTypeId,
          zipCode: lead.zipCode,
          pricingModel: contractor.pricingModel,
        }),
        status: 'SUCCESS',
        bidAmount: price,
        isWinner,
        deliveryMethod: deliveryMethods.join(','),
      },
    });
  }

  /**
   * Convert lead and contractor to notification format
   */
  private static async prepareNotificationData(
    lead: LeadForDelivery,
    contractor: EligibleContractor
  ): Promise<{ leadData: LeadNotificationData; contractorInfo: ContractorInfo }> {
    // Get service type name
    const serviceType = await prisma.serviceType.findUnique({
      where: { id: lead.serviceTypeId },
      select: { displayName: true, name: true },
    });

    const leadData: LeadNotificationData = {
      leadId: lead.id,
      serviceTypeName: serviceType?.displayName || serviceType?.name || 'Service',
      formData: lead.formData,
      zipCode: lead.zipCode,
      ownsHome: lead.ownsHome,
      timeframe: lead.timeframe,
      trustedFormCertUrl: lead.trustedFormCertUrl,
      createdAt: new Date(),
    };

    const contractorInfo: ContractorInfo = {
      buyerId: contractor.buyerId,
      buyerName: contractor.buyerName,
      displayName: contractor.displayName,
      contactEmail: contractor.contactEmail,
      businessEmail: contractor.businessEmail,
      apiUrl: contractor.apiUrl,
    };

    return { leadData, contractorInfo };
  }

  /**
   * Send lead notification email using LeadNotificationService
   * Task 5.2: Implemented via LeadNotificationService
   */
  private static async sendLeadEmail(
    lead: LeadForDelivery,
    contractor: EligibleContractor
  ): Promise<void> {
    const { leadData, contractorInfo } = await this.prepareNotificationData(lead, contractor);
    const result = await LeadNotificationService.sendLeadEmail(leadData, contractorInfo);

    if (!result.success) {
      logger.warn('Failed to send lead email', {
        leadId: lead.id,
        buyerId: contractor.buyerId,
        error: result.error,
      });
    }
  }

  /**
   * Send lead webhook using LeadNotificationService
   * Task 5.3: Implemented via LeadNotificationService
   */
  private static async sendLeadWebhook(
    lead: LeadForDelivery,
    contractor: EligibleContractor
  ): Promise<void> {
    const { leadData, contractorInfo } = await this.prepareNotificationData(lead, contractor);
    const result = await LeadNotificationService.sendLeadWebhook(leadData, contractorInfo);

    if (!result.success) {
      logger.warn('Failed to send lead webhook', {
        leadId: lead.id,
        buyerId: contractor.buyerId,
        error: result.error,
      });
    }
  }

  /**
   * Create dashboard notification using LeadNotificationService
   * Task 5.4: Implemented via LeadNotificationService
   */
  private static async createDashboardNotification(
    lead: LeadForDelivery,
    contractor: EligibleContractor
  ): Promise<void> {
    const { leadData, contractorInfo } = await this.prepareNotificationData(lead, contractor);
    const result = await LeadNotificationService.createDashboardNotification(leadData, contractorInfo);

    if (!result.success) {
      logger.warn('Failed to create dashboard notification', {
        leadId: lead.id,
        buyerId: contractor.buyerId,
        error: result.error,
      });
    }
  }
}

export default ContractorDeliveryService;
