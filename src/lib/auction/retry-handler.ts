/**
 * Retry Handler for Failed Auction Operations
 * Implements intelligent retry mechanisms with backoff strategies
 */

import {
  RetryPolicy,
  TransactionLog,
  BuyerConfig,
  BuyerServiceConfig,
  LeadData,
  PostResult
} from '../templates/types';

export class RetryHandler {
  private static retryQueues = new Map<string, RetryQueueItem[]>();
  private static retryTimers = new Map<string, NodeJS.Timeout>();
  private static maxRetryQueues = 100;

  /**
   * Add failed operation to retry queue
   */
  static addToRetryQueue(
    operation: RetryOperation,
    retryPolicy: RetryPolicy,
    context: RetryContext
  ): void {
    const queueKey = `${operation.type}_${operation.buyerId}_${operation.leadId}`;
    
    if (!this.retryQueues.has(queueKey)) {
      this.retryQueues.set(queueKey, []);
    }

    const queue = this.retryQueues.get(queueKey)!;
    
    // Check if we've exceeded max attempts
    if (operation.attemptCount >= retryPolicy.maxAttempts) {
      console.warn(`Max retry attempts reached for ${queueKey}`, operation);
      this.logFailedOperation(operation, context, 'max_attempts_exceeded');
      return;
    }

    // Calculate delay based on backoff strategy
    const delay = this.calculateDelay(
      operation.attemptCount,
      retryPolicy.backoffStrategy,
      retryPolicy.baseDelay,
      retryPolicy.maxDelay
    );

    const retryItem: RetryQueueItem = {
      operation: {
        ...operation,
        attemptCount: operation.attemptCount + 1,
        scheduledTime: Date.now() + delay
      },
      retryPolicy,
      context,
      delay
    };

    queue.push(retryItem);

    // Limit queue size to prevent memory issues
    if (queue.length > this.maxRetryQueues) {
      queue.shift(); // Remove oldest item
    }

    // Schedule retry execution
    this.scheduleRetry(queueKey, delay);

    console.log(`Added to retry queue: ${queueKey}, attempt ${retryItem.operation.attemptCount}, delay ${delay}ms`);
  }

  /**
   * Process retry queue for a specific key
   */
  private static async processRetryQueue(queueKey: string): Promise<void> {
    const queue = this.retryQueues.get(queueKey);
    if (!queue || queue.length === 0) {
      return;
    }

    const now = Date.now();
    const readyItems = queue.filter(item => item.operation.scheduledTime <= now);

    if (readyItems.length === 0) {
      return;
    }

    // Remove processed items from queue
    const remainingItems = queue.filter(item => item.operation.scheduledTime > now);
    this.retryQueues.set(queueKey, remainingItems);

    // Process ready items
    for (const item of readyItems) {
      try {
        await this.executeRetry(item);
      } catch (error) {
        console.error(`Retry execution failed for ${queueKey}:`, error);
        
        // Add back to queue if within retry limits
        if (item.operation.attemptCount < item.retryPolicy.maxAttempts) {
          this.addToRetryQueue(item.operation, item.retryPolicy, item.context);
        } else {
          this.logFailedOperation(item.operation, item.context, 'retry_execution_failed');
        }
      }
    }

    // Schedule next retry if queue still has items
    if (remainingItems.length > 0) {
      const nextItem = remainingItems.reduce((earliest, current) =>
        current.operation.scheduledTime < earliest.operation.scheduledTime ? current : earliest
      );
      const delay = Math.max(0, nextItem.operation.scheduledTime - Date.now());
      this.scheduleRetry(queueKey, delay);
    }
  }

  /**
   * Execute retry operation
   */
  private static async executeRetry(item: RetryQueueItem): Promise<void> {
    const { operation, context } = item;

    console.log(`Executing retry: ${operation.type} for ${operation.buyerId}, attempt ${operation.attemptCount}`);

    switch (operation.type) {
      case 'PING':
        await this.retryPing(operation, context);
        break;
      case 'POST':
        await this.retryPost(operation, context);
        break;
      case 'WEBHOOK':
        await this.retryWebhook(operation, context);
        break;
      default:
        throw new Error(`Unknown retry operation type: ${operation.type}`);
    }
  }

  /**
   * Retry PING operation
   */
  private static async retryPing(
    operation: RetryOperation,
    context: RetryContext
  ): Promise<void> {
    if (!context.buyer || !context.serviceConfig || !context.lead) {
      throw new Error('Missing context for PING retry');
    }

    const { TemplateEngine } = await import('../templates/engine');
    const startTime = Date.now();

    try {
      // Transform lead data using buyer's PING template
      const payload = await TemplateEngine.transform(
        context.lead,
        context.buyer,
        context.serviceConfig.pingTemplate,
        context.serviceConfig.pingTemplate.includeCompliance
      );

      // Prepare headers
      const headers = this.prepareRetryHeaders(context.buyer, context.serviceConfig, 'PING', operation.attemptCount);

      // Send retry request
      const response = await fetch(context.serviceConfig.webhookConfig!.pingUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(context.serviceConfig.webhookConfig!.timeouts.ping)
      });

      const responseTime = Date.now() - startTime;
      const responseData = await response.json();

      // Log retry result
      await this.logRetryResult(operation, context, {
        success: response.ok,
        statusCode: response.status,
        responseTime,
        response: responseData
      });

      if (!response.ok) {
        throw new Error(`PING retry failed with status ${response.status}`);
      }

      console.log(`PING retry successful for ${operation.buyerId}, attempt ${operation.attemptCount}`);

    } catch (error) {
      const responseTime = Date.now() - startTime;

      await this.logRetryResult(operation, context, {
        success: false,
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  /**
   * Retry POST operation
   */
  private static async retryPost(
    operation: RetryOperation,
    context: RetryContext
  ): Promise<PostResult> {
    if (!context.buyer || !context.serviceConfig || !context.lead) {
      throw new Error('Missing context for POST retry');
    }

    const { TemplateEngine } = await import('../templates/engine');
    const startTime = Date.now();

    try {
      // Transform lead data using buyer's POST template
      const payload = await TemplateEngine.transform(
        context.lead,
        context.buyer,
        context.serviceConfig.postTemplate,
        true // Always include compliance for POST
      );

      // Add retry metadata
      payload.retry_attempt = operation.attemptCount;
      payload.original_submission_time = context.originalTimestamp?.toISOString();

      // Prepare headers
      const headers = this.prepareRetryHeaders(context.buyer, context.serviceConfig, 'POST', operation.attemptCount);

      // Send retry request
      const response = await fetch(context.serviceConfig.webhookConfig!.postUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(context.serviceConfig.webhookConfig!.timeouts.post)
      });

      const deliveryTime = Date.now() - startTime;
      const responseData = response.ok ? await response.json() : null;

      const result: PostResult = {
        success: response.ok,
        statusCode: response.status,
        response: responseData,
        deliveryTime
      };

      // Log retry result
      await this.logRetryResult(operation, context, {
        success: response.ok,
        statusCode: response.status,
        deliveryTime,
        response: responseData
      });

      if (!response.ok) {
        throw new Error(`POST retry failed with status ${response.status}`);
      }

      console.log(`POST retry successful for ${operation.buyerId}, attempt ${operation.attemptCount}`);

      return result;

    } catch (error) {
      const deliveryTime = Date.now() - startTime;

      const result: PostResult = {
        success: false,
        statusCode: 0,
        error: error instanceof Error ? error.message : 'POST retry failed',
        deliveryTime
      };

      await this.logRetryResult(operation, context, {
        success: false,
        deliveryTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  /**
   * Retry webhook operation
   */
  private static async retryWebhook(
    operation: RetryOperation,
    context: RetryContext
  ): Promise<void> {
    if (!context.webhookUrl || !context.payload) {
      throw new Error('Missing context for webhook retry');
    }

    const startTime = Date.now();

    try {
      const response = await fetch(context.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Retry-Attempt': operation.attemptCount.toString(),
          'X-Original-Timestamp': context.originalTimestamp?.toISOString() || ''
        },
        body: JSON.stringify(context.payload),
        signal: AbortSignal.timeout(5000) // Default timeout for webhooks
      });

      const responseTime = Date.now() - startTime;

      await this.logRetryResult(operation, context, {
        success: response.ok,
        statusCode: response.status,
        responseTime
      });

      if (!response.ok) {
        throw new Error(`Webhook retry failed with status ${response.status}`);
      }

      console.log(`Webhook retry successful for ${operation.buyerId}, attempt ${operation.attemptCount}`);

    } catch (error) {
      const responseTime = Date.now() - startTime;

      await this.logRetryResult(operation, context, {
        success: false,
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  /**
   * Calculate retry delay based on backoff strategy
   */
  private static calculateDelay(
    attemptCount: number,
    strategy: 'exponential' | 'linear' | 'fixed',
    baseDelay: number,
    maxDelay: number
  ): number {
    let delay: number;

    switch (strategy) {
      case 'exponential':
        delay = baseDelay * Math.pow(2, attemptCount - 1);
        break;
      case 'linear':
        delay = baseDelay * attemptCount;
        break;
      case 'fixed':
        delay = baseDelay;
        break;
      default:
        delay = baseDelay;
    }

    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * delay;
    delay += jitter;

    return Math.min(delay, maxDelay);
  }

  /**
   * Schedule retry execution
   */
  private static scheduleRetry(queueKey: string, delay: number): void {
    // Clear existing timer if any
    const existingTimer = this.retryTimers.get(queueKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Schedule new timer
    const timer = setTimeout(() => {
      this.processRetryQueue(queueKey);
      this.retryTimers.delete(queueKey);
    }, delay);

    this.retryTimers.set(queueKey, timer);
  }

  /**
   * Prepare headers for retry requests
   */
  private static prepareRetryHeaders(
    buyer: BuyerConfig,
    serviceConfig: BuyerServiceConfig,
    requestType: 'PING' | 'POST',
    attemptCount: number
  ): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Request-Type': requestType,
      'X-Retry-Attempt': attemptCount.toString(),
      'X-Service-Type': serviceConfig.serviceTypeName,
      'X-Lead-Source': 'contractor-platform-retry',
      'X-Timestamp': new Date().toISOString()
    };

    // Add authentication headers
    const { authConfig } = buyer;
    switch (authConfig.type) {
      case 'apiKey':
        headers['X-API-Key'] = authConfig.credentials.apiKey;
        break;
      case 'bearer':
        headers['Authorization'] = `Bearer ${authConfig.credentials.token}`;
        break;
      case 'basic':
        const credentials = btoa(`${authConfig.credentials.username}:${authConfig.credentials.password}`);
        headers['Authorization'] = `Basic ${credentials}`;
        break;
    }

    // Add custom headers
    if (authConfig.headers) {
      Object.assign(headers, authConfig.headers);
    }

    return headers;
  }

  /**
   * Log retry result
   */
  private static async logRetryResult(
    operation: RetryOperation,
    context: RetryContext,
    result: any
  ): Promise<void> {
    const log: TransactionLog = {
      id: this.generateTransactionId(),
      leadId: operation.leadId,
      buyerId: operation.buyerId,
      actionType: 'RETRY',
      status: result.success ? 'success' : 'failed',
      payload: context.payload || {},
      response: result.response,
      responseTime: result.responseTime || result.deliveryTime || 0,
      errorMessage: result.error,
      retryCount: operation.attemptCount,
      timestamp: new Date(),
      metadata: {
        originalOperationType: operation.type,
        retryReason: operation.reason,
        attemptCount: operation.attemptCount,
        ...result
      }
    };

    // In a real implementation, this would persist to database
    console.log(`Retry logged: ${operation.type} ${operation.buyerId} attempt ${operation.attemptCount} -> ${result.success ? 'SUCCESS' : 'FAILED'}`);
  }

  /**
   * Log permanently failed operation
   */
  private static logFailedOperation(
    operation: RetryOperation,
    context: RetryContext,
    reason: string
  ): void {
    console.error(`Operation permanently failed: ${operation.type} ${operation.buyerId}`, {
      operation,
      reason,
      finalAttemptCount: operation.attemptCount
    });

    // In a real implementation, this might trigger alerts or dead letter queues
  }

  /**
   * Generate unique transaction ID
   */
  private static generateTransactionId(): string {
    return `retry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get retry queue status
   */
  static getRetryQueueStatus(): RetryQueueStatus {
    const queues = Array.from(this.retryQueues.entries()).map(([key, items]) => ({
      key,
      itemCount: items.length,
      nextRetryTime: items.length > 0 ? Math.min(...items.map(item => item.operation.scheduledTime)) : null
    }));

    return {
      totalQueues: queues.length,
      totalItems: queues.reduce((sum, queue) => sum + queue.itemCount, 0),
      queues
    };
  }

  /**
   * Clear retry queue for specific buyer/lead
   */
  static clearRetryQueue(buyerId?: string, leadId?: string): number {
    let clearedCount = 0;

    if (buyerId && leadId) {
      // Clear specific queue
      const queueKey = `${buyerId}_${leadId}`;
      const patterns = Array.from(this.retryQueues.keys()).filter(key => key.includes(queueKey));
      
      for (const pattern of patterns) {
        const queue = this.retryQueues.get(pattern);
        if (queue) {
          clearedCount += queue.length;
          this.retryQueues.delete(pattern);
          
          // Clear associated timer
          const timer = this.retryTimers.get(pattern);
          if (timer) {
            clearTimeout(timer);
            this.retryTimers.delete(pattern);
          }
        }
      }
    } else {
      // Clear all queues
      Array.from(this.retryQueues.entries()).forEach(([key, queue]) => {
        clearedCount += queue.length;

        // Clear associated timer
        const timer = this.retryTimers.get(key);
        if (timer) {
          clearTimeout(timer);
        }
      });

      this.retryQueues.clear();
      this.retryTimers.clear();
    }

    console.log(`Cleared ${clearedCount} retry items`);
    return clearedCount;
  }

  /**
   * Pause all retry operations
   */
  static pauseRetries(): void {
    Array.from(this.retryTimers.values()).forEach((timer) => {
      clearTimeout(timer);
    });
    this.retryTimers.clear();
    console.log('All retry operations paused');
  }

  /**
   * Resume retry operations
   */
  static resumeRetries(): void {
    const now = Date.now();

    Array.from(this.retryQueues.entries()).forEach(([queueKey, queue]) => {
      if (queue.length === 0) return;

      const nextItem = queue.reduce((earliest, current) =>
        current.operation.scheduledTime < earliest.operation.scheduledTime ? current : earliest
      );

      const delay = Math.max(0, nextItem.operation.scheduledTime - now);
      this.scheduleRetry(queueKey, delay);
    });

    console.log('Retry operations resumed');
  }
}

// Supporting interfaces
interface RetryOperation {
  type: 'PING' | 'POST' | 'WEBHOOK';
  leadId: string;
  buyerId: string;
  attemptCount: number;
  scheduledTime: number;
  reason: string;
  originalPayload?: any;
}

interface RetryContext {
  buyer?: BuyerConfig;
  serviceConfig?: BuyerServiceConfig;
  lead?: LeadData;
  webhookUrl?: string;
  payload?: any;
  originalTimestamp?: Date;
}

interface RetryQueueItem {
  operation: RetryOperation;
  retryPolicy: RetryPolicy;
  context: RetryContext;
  delay: number;
}

interface RetryQueueStatus {
  totalQueues: number;
  totalItems: number;
  queues: Array<{
    key: string;
    itemCount: number;
    nextRetryTime: number | null;
  }>;
}

export default RetryHandler;