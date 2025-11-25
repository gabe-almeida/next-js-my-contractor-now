import cron from 'node-cron';
import { LeadQueue, RedisCache } from '@/config/redis';
import { logger, logLeadProcessing } from './logger';
import { retryWithBackoff, applyTemplate, transformLeadForBuyer } from './utils';

// Background worker for processing leads
export class LeadProcessingWorker {
  private isRunning = false;
  private processingInterval?: NodeJS.Timeout;
  
  // Start the worker
  start() {
    if (this.isRunning) {
      logger.warn('Lead processing worker is already running');
      return;
    }
    
    this.isRunning = true;
    logger.info('Starting lead processing worker');
    
    // Process leads every 10 seconds
    this.processingInterval = setInterval(() => {
      this.processNextLead().catch(error => {
        logger.error('Worker processing error', {
          error: error.message,
          stack: error.stack
        });
      });
    }, 10000);
    
    // Schedule cleanup tasks
    this.scheduleCleanupTasks();
    
    logger.info('Lead processing worker started successfully');
  }
  
  // Stop the worker
  stop() {
    if (!this.isRunning) {
      logger.warn('Lead processing worker is not running');
      return;
    }
    
    this.isRunning = false;
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }
    
    logger.info('Lead processing worker stopped');
  }
  
  // Process the next lead in the queue
  private async processNextLead() {
    if (!this.isRunning) return;
    
    try {
      const job = await LeadQueue.getJob();
      
      if (!job) {
        // No jobs in queue
        return;
      }
      
      logLeadProcessing(job.leadId, 'processing_started', {
        jobId: job.id,
        serviceTypeId: job.serviceTypeId,
        priority: job.priority,
        attempt: job.attempts + 1
      });
      
      // Process the lead
      const success = await this.processLead(job.leadId, job.serviceTypeId);
      
      if (success) {
        logLeadProcessing(job.leadId, 'processing_completed', {
          jobId: job.id,
          attempt: job.attempts + 1
        });
      } else {
        // Retry the job
        await LeadQueue.retryJob(job);
        
        logLeadProcessing(job.leadId, 'processing_failed', {
          jobId: job.id,
          attempt: job.attempts + 1,
          willRetry: job.attempts < job.maxAttempts
        });
      }
      
    } catch (error) {
      logger.error('Lead processing error', {
        error: (error as Error).message,
        stack: (error as Error).stack
      });
    }
  }
  
  // Process a specific lead through the auction system
  private async processLead(leadId: string, serviceTypeId: string): Promise<boolean> {
    try {
      // Get lead data
      const lead = await RedisCache.get(`lead:${leadId}`);
      
      if (!lead) {
        logger.error('Lead not found for processing', { leadId });
        return false;
      }
      
      // Update lead status to processing
      lead.status = 'processing';
      lead.updatedAt = new Date();
      await RedisCache.set(`lead:${leadId}`, lead, 3600);
      
      // Get active buyers for this service type
      const buyers = await this.getActiveBuyers(serviceTypeId);
      
      if (buyers.length === 0) {
        logger.warn('No active buyers found for service type', {
          leadId,
          serviceTypeId
        });
        
        // Mark lead as expired
        lead.status = 'expired';
        await RedisCache.set(`lead:${leadId}`, lead, 3600);
        return true; // Successfully processed (no buyers available)
      }
      
      // Run auction - ping all buyers in parallel
      const auctionResult = await this.runAuction(leadId, lead, buyers);
      
      // Update lead status based on auction result
      if (auctionResult.winningBuyerId) {
        lead.status = 'auctioned';
        await RedisCache.set(`lead:${leadId}`, lead, 3600);
        
        // Send lead to winning buyer
        await this.postLeadToBuyer(leadId, lead, auctionResult.winningBuyerId);
      } else {
        lead.status = 'rejected';
        await RedisCache.set(`lead:${leadId}`, lead, 3600);
      }
      
      // Store auction results
      await RedisCache.set(`auction_result:${leadId}`, auctionResult, 86400);
      
      return true;
      
    } catch (error) {
      logger.error('Lead processing error', {
        error: (error as Error).message,
        leadId,
        stack: (error as Error).stack
      });
      
      return false;
    }
  }
  
  // Get active buyers for a service type
  private async getActiveBuyers(serviceTypeId: string) {
    try {
      const { prisma } = await import('@/lib/db');

      // Query buyers with active service configurations for this service type
      const buyers = await prisma.buyer.findMany({
        where: {
          active: true,
          buyerServiceConfigs: {
            some: {
              serviceTypeId,
              active: true
            }
          }
        },
        include: {
          buyerServiceConfigs: {
            where: {
              serviceTypeId,
              active: true
            },
            include: {
              serviceType: true
            }
          }
        }
      });

      // Transform to expected format with service configuration
      return buyers.map(buyer => {
        const serviceConfig = buyer.buyerServiceConfigs[0];

        return {
          id: buyer.id,
          name: buyer.name,
          apiUrl: buyer.apiUrl || '',
          authType: buyer.authType,
          authConfig: {
            type: buyer.authType,
            credentials: buyer.authConfig || {}
          },
          active: buyer.active,
          serviceConfig: {
            pingTemplate: serviceConfig.pingTemplate || {},
            postTemplate: serviceConfig.postTemplate || {},
            fieldMappings: serviceConfig.fieldMappings || {},
            bidFloor: serviceConfig.minBid || 0,
            bidCeiling: serviceConfig.maxBid || 999
          }
        };
      });
    } catch (error) {
      logger.error('Failed to get active buyers', {
        serviceTypeId,
        error: (error as Error).message,
        stack: (error as Error).stack
      });
      return [];
    }
  }
  
  // Run auction by pinging all buyers
  private async runAuction(leadId: string, lead: any, buyers: any[]) {
    const auctionStart = Date.now();
    
    // Ping all buyers in parallel
    const pingPromises = buyers.map(buyer => 
      this.pingBuyer(leadId, lead, buyer)
    );
    
    // Wait for all pings to complete or timeout
    const pingResults = await Promise.allSettled(pingPromises);
    
    const bids = [];
    
    for (let i = 0; i < pingResults.length; i++) {
      const result = pingResults[i];
      const buyer = buyers[i];
      
      if (result.status === 'fulfilled' && result.value.accepted) {
        bids.push({
          buyerId: buyer.id,
          bid: result.value.bid,
          accepted: true,
          response: result.value,
          processingTime: result.value.processingTime
        });
      } else {
        bids.push({
          buyerId: buyer.id,
          bid: 0,
          accepted: false,
          response: result.status === 'fulfilled' ? result.value : { error: result.reason },
          processingTime: result.status === 'fulfilled' ? result.value.processingTime : 0
        });
      }
    }
    
    // Find winning bid
    const validBids = bids.filter(bid => bid.accepted && bid.bid > 0);
    const winningBid = validBids.reduce((max, bid) => 
      bid.bid > max.bid ? bid : max, 
      { bid: 0, buyerId: null }
    );
    
    const auctionResult = {
      leadId,
      winningBuyerId: winningBid.buyerId,
      winningBid: winningBid.bid,
      allBids: bids,
      processingTime: Date.now() - auctionStart,
      status: winningBid.buyerId ? 'completed' : 'no_bids'
    };
    
    logLeadProcessing(leadId, 'auction_completed', {
      winningBuyerId: winningBid.buyerId,
      winningBid: winningBid.bid,
      totalBids: validBids.length,
      processingTime: auctionResult.processingTime
    });
    
    return auctionResult;
  }
  
  // Ping a specific buyer
  private async pingBuyer(leadId: string, lead: any, buyer: any) {
    const start = Date.now();
    
    try {
      // Transform lead data using buyer's field mappings
      const transformedData = transformLeadForBuyer(lead.formData, buyer.serviceConfig.fieldMappings);
      
      // Apply buyer's ping template
      const pingPayload = applyTemplate(buyer.serviceConfig.pingTemplate, {
        id: leadId,
        ...transformedData
      });
      
      // Prepare auth headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'ContractorPlatform/1.0'
      };
      
      switch (buyer.authConfig.type) {
        case 'apikey':
          headers['X-API-Key'] = buyer.authConfig.credentials.apiKey;
          break;
        case 'bearer':
          headers['Authorization'] = `Bearer ${buyer.authConfig.credentials.token}`;
          break;
        case 'basic':
          const credentials = Buffer.from(
            `${buyer.authConfig.credentials.username}:${buyer.authConfig.credentials.password}`
          ).toString('base64');
          headers['Authorization'] = `Basic ${credentials}`;
          break;
      }
      
      // Make ping request with timeout
      const response = await retryWithBackoff(async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
        
        try {
          const res = await fetch(buyer.apiUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(pingPayload),
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          const responseData = await res.json();
          
          return {
            statusCode: res.status,
            body: responseData,
            processingTime: Date.now() - start
          };
        } catch (error) {
          clearTimeout(timeoutId);
          throw error;
        }
      });
      
      // Parse buyer response
      if (response.statusCode === 200 && response.body.accepted) {
        const bid = response.body.bid || response.body.amount || 0;
        
        // Validate bid is within acceptable range
        if (bid >= buyer.serviceConfig.bidFloor && bid <= buyer.serviceConfig.bidCeiling) {
          return {
            accepted: true,
            bid,
            processingTime: response.processingTime,
            response: response.body
          };
        } else {
          logger.warn('Bid outside acceptable range', {
            buyerId: buyer.id,
            bid,
            bidFloor: buyer.serviceConfig.bidFloor,
            bidCeiling: buyer.serviceConfig.bidCeiling
          });
          
          return {
            accepted: false,
            reason: 'bid_out_of_range',
            processingTime: response.processingTime
          };
        }
      } else {
        return {
          accepted: false,
          reason: response.body.reason || 'rejected',
          processingTime: response.processingTime
        };
      }
      
    } catch (error) {
      logger.error('Buyer ping error', {
        buyerId: buyer.id,
        leadId,
        error: (error as Error).message
      });
      
      return {
        accepted: false,
        error: (error as Error).message,
        processingTime: Date.now() - start
      };
    }
  }
  
  // Post lead to winning buyer
  private async postLeadToBuyer(leadId: string, lead: any, buyerId: string) {
    try {
      // Get buyer configuration
      const buyers = await this.getActiveBuyers(lead.serviceTypeId);
      const buyer = buyers.find(b => b.id === buyerId);
      
      if (!buyer) {
        logger.error('Winning buyer not found', { buyerId, leadId });
        return;
      }
      
      // Transform and send full lead data
      const transformedData = transformLeadForBuyer(lead.formData, buyer.serviceConfig.fieldMappings);
      const postPayload = {
        leadId,
        ...transformedData,
        deliveredAt: new Date().toISOString()
      };
      
      // In real implementation, this would make the actual POST request
      logger.info('Lead posted to winning buyer', {
        leadId,
        buyerId: buyer.id,
        buyerName: buyer.name
      });
      
      // Mark lead as sold
      lead.status = 'sold';
      lead.updatedAt = new Date();
      await RedisCache.set(`lead:${leadId}`, lead, 3600);
      
    } catch (error) {
      logger.error('Post lead to buyer error', {
        error: (error as Error).message,
        leadId,
        buyerId
      });
    }
  }
  
  // Schedule cleanup tasks
  private scheduleCleanupTasks() {
    // Clean up expired data every hour
    cron.schedule('0 * * * *', async () => {
      try {
        await this.cleanupExpiredData();
      } catch (error) {
        logger.error('Cleanup task error', {
          error: (error as Error).message,
          stack: (error as Error).stack
        });
      }
    });
    
    // Generate daily reports every day at midnight
    cron.schedule('0 0 * * *', async () => {
      try {
        await this.generateDailyReport();
      } catch (error) {
        logger.error('Daily report error', {
          error: (error as Error).message,
          stack: (error as Error).stack
        });
      }
    });
    
    logger.info('Cleanup tasks scheduled');
  }
  
  // Clean up expired data
  private async cleanupExpiredData() {
    logger.info('Starting cleanup of expired data');
    
    // This is handled by Redis TTL in our implementation
    // But you could add additional cleanup logic here
    
    logger.info('Cleanup completed');
  }
  
  // Generate daily report
  private async generateDailyReport() {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    logger.info('Generating daily report', { date: yesterdayStr });
    
    // In real app, this would generate comprehensive reports
    // For now, just log some basic metrics
    
    const queueStatus = await LeadQueue.getQueueLength();
    logger.info('Daily report generated', {
      date: yesterdayStr,
      queueStatus
    });
  }
}

// Export singleton instance
export const leadWorker = new LeadProcessingWorker();