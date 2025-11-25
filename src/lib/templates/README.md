# Template Engine System Documentation

## Overview

The Template Engine System is a comprehensive, modular data transformation and auction platform designed for contractor lead management. It provides configurable field mappings, compliance data handling, parallel auction processing, and real-time performance monitoring.

## Architecture

```
Template Engine System
├── Core Engine (engine.ts)
├── Data Transformations (transformations.ts)
├── Validation Layer (validator.ts)
├── Buyer Configurations (buyers/configurations.ts)
├── Auction Engine (auction/engine.ts)
├── Retry Handler (auction/retry-handler.ts)
├── Performance Monitor (performance-monitor.ts)
└── Orchestrator (index.ts)
```

## Key Features

### 🔄 **Template Engine Core**
- **Pure Function Transformations**: All transformations are pure functions with no side effects
- **DRY Architecture**: Reusable transformation logic across all buyers
- **Configuration-Driven**: No hard-coded buyer mappings
- **Performance Optimized**: Handles high-volume lead processing with parallel execution

### 🏗️ **Buyer Configuration System**
- **Per-Buyer Field Mappings**: Customizable field transformations for each buyer
- **Per-Service Configurations**: Different mappings for Windows, Bathrooms, Roofing, etc.
- **Compliance Requirements**: TrustedForm and Jornaya integration per buyer needs
- **Pricing Models**: Dynamic bid calculation with modifiers

### 🏛️ **Auction Engine**
- **Parallel PING System**: Simultaneous requests to all eligible buyers
- **Intelligent Winner Selection**: Configurable tie-breaking strategies
- **Geographic Restrictions**: ZIP code and radius-based filtering
- **Time-Based Restrictions**: Operating hours and day-of-week filtering

### 🔄 **Compliance Data Transformation**
- **TrustedForm Integration**: Certificate URL and ID mapping
- **Jornaya LeadID**: Universal lead tracking integration
- **TCPA Compliance**: Consent tracking and validation
- **Audit Trail**: Complete transaction logging

### ⚡ **Performance Monitoring**
- **Real-Time Metrics**: Transformation time, auction duration, response times
- **Error Tracking**: Error rates and failure analysis
- **Alerting System**: Configurable thresholds with severity levels
- **Buyer Performance**: Individual buyer success rates and response times

## Quick Start

### 1. Initialize the System

```typescript
import { TemplateEngineOrchestrator } from '@/lib/templates';

// Initialize with pre-configured buyers
await TemplateEngineOrchestrator.initialize();
```

### 2. Process a Lead

```typescript
const lead: LeadData = {
  id: 'lead_123',
  serviceTypeId: 'windows',
  formData: {
    numberOfWindows: 8,
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    phone: '5551234567'
  },
  zipCode: '90210',
  ownsHome: true,
  timeframe: 'within_month',
  // ... other required fields
};

const result = await TemplateEngineOrchestrator.processLead(lead);
console.log(`Auction ${result.success ? 'completed' : 'failed'}`);
console.log(`Winner: ${result.auctionResult?.winningBuyerId}`);
```

### 3. Transform for Specific Buyer

```typescript
const transformResult = await TemplateEngineOrchestrator.transformForBuyer(
  lead,
  'modernize',
  true // include compliance data
);

console.log('Transformed payload:', transformResult.data);
```

## Buyer Configuration

### Adding a New Buyer

```typescript
import { BuyerConfigurationRegistry } from '@/lib/templates';

const newBuyer: BuyerConfig = {
  id: 'custom_buyer',
  name: 'Custom Buyer',
  slug: 'custom-buyer',
  apiUrl: 'https://api.custombuyer.com',
  authConfig: {
    type: 'apiKey',
    credentials: { apiKey: process.env.CUSTOM_BUYER_API_KEY }
  },
  active: true,
  serviceConfigs: [
    {
      buyerId: 'custom_buyer',
      serviceTypeId: 'windows',
      serviceTypeName: 'Windows',
      active: true,
      priority: 85,
      pricing: {
        basePrice: 40,
        priceModifiers: [],
        maxBid: 120,
        minBid: 20,
        currency: 'USD'
      },
      pingTemplate: {
        mappings: [
          { sourceField: 'zipCode', targetField: 'postal_code', required: true },
          { sourceField: 'ownsHome', targetField: 'homeowner_status', transform: 'boolean.yesNo' }
        ],
        includeCompliance: false
      },
      postTemplate: {
        mappings: [
          { sourceField: 'zipCode', targetField: 'postal_code', required: true },
          { sourceField: 'firstName', targetField: 'customer_name', required: true },
          { sourceField: 'email', targetField: 'email', required: true }
        ],
        includeCompliance: true
      },
      webhookConfig: {
        pingUrl: 'https://api.custombuyer.com/ping',
        postUrl: 'https://api.custombuyer.com/leads',
        timeouts: { ping: 3000, post: 8000 },
        retryPolicy: {
          maxAttempts: 3,
          backoffStrategy: 'exponential',
          baseDelay: 1000,
          maxDelay: 10000
        }
      }
    }
  ],
  globalSettings: {
    // ... global settings
  },
  metadata: {}
};

BuyerConfigurationRegistry.register(newBuyer);
```

## Custom Transformations

### Creating Custom Transform Functions

```typescript
import { TransformRegistry } from '@/lib/templates';

// Register a custom transformation
TransformRegistry.register('customFormat', (value: any) => {
  return `CUSTOM_${value.toString().toUpperCase()}`;
});

// Use in mapping configuration
const mapping = {
  sourceField: 'projectType',
  targetField: 'formatted_type',
  transform: 'customFormat'
};
```

### Built-in Transformations

```typescript
// String transformations
'string.uppercase'      // Convert to uppercase
'string.lowercase'      // Convert to lowercase  
'string.capitalize'     // Capitalize first letter
'string.slugify'        // Convert to URL-friendly slug

// Number transformations
'number.integer'        // Parse as integer
'number.float'          // Parse as float
'number.currency'       // Format as currency
'number.round(2)'       // Round to 2 decimal places

// Boolean transformations
'boolean.yesNo'         // Convert to "Yes"/"No"
'boolean.trueFalse'     // Convert to "true"/"false"
'boolean.oneZero'       // Convert to "1"/"0"

// Phone transformations
'phone.normalize'       // Normalize to +1XXXXXXXXXX
'phone.e164'           // Format as E.164
'phone.format'         // Format as (XXX) XXX-XXXX

// Service-specific transformations
'service.windowsCount'     // "1 window", "6-10 windows", etc.
'service.bathroomCount'    // "1 bathroom", "3 bathrooms", etc.
'service.projectTimeframe' // "Within 1 month", "ASAP", etc.
'service.homeOwnership'    // "Own"/"Rent"

// Compliance transformations
'compliance.tcpaConsent'   // Format TCPA consent
'compliance.leadSource'    // Get lead source from context
'compliance.userAgent'     // Get user agent from context
```

## Validation Rules

### Built-in Validators

```typescript
import { ValidationRuleBuilder } from '@/lib/templates';

// String validation
const stringRule = ValidationRuleBuilder
  .string()
  .min(5)
  .max(50)
  .pattern(/^[A-Za-z\s]+$/)
  .message('Must be 5-50 alphabetic characters')
  .build();

// Email validation
const emailRule = ValidationRuleBuilder
  .email()
  .message('Please enter a valid email address')
  .build();

// Phone validation
const phoneRule = ValidationRuleBuilder
  .phone()
  .message('Please enter a valid US phone number')
  .build();

// Custom validation
const customRule = ValidationRuleBuilder
  .custom()
  .custom((value) => value.startsWith('PREFIX_'))
  .message('Value must start with PREFIX_')
  .build();
```

## Performance Monitoring

### Metrics Collection

```typescript
import { PerformanceMonitor } from '@/lib/templates';

// Get current metrics
const metrics = PerformanceMonitor.getMetrics();
console.log('Avg transformation time:', metrics.templateEngineMetrics.transformationTime);
console.log('Error rate:', metrics.templateEngineMetrics.errorRate);

// Get alerts
const criticalAlerts = PerformanceMonitor.getAlerts('critical');
console.log('Critical issues:', criticalAlerts);

// Set custom thresholds
PerformanceMonitor.setThresholds({
  maxTransformationTime: 500,  // 500ms
  maxAuctionTime: 5000,       // 5 seconds
  maxErrorRate: 0.02          // 2%
});
```

### Health Monitoring

```typescript
// Check system health
const health = await TemplateEngineOrchestrator.healthCheck();
console.log('System healthy:', health.healthy);
console.log('Components:', health.components);
console.log('Metrics:', health.metrics);
```

## Error Handling

### Error Types

```typescript
import { 
  TemplateEngineError,
  TransformationError,
  ValidationError,
  AuctionError 
} from '@/lib/templates';

try {
  await TemplateEngineOrchestrator.processLead(lead);
} catch (error) {
  if (error instanceof ValidationError) {
    console.log('Validation failed:', error.message);
  } else if (error instanceof TransformationError) {
    console.log('Transformation failed:', error.message);
  } else if (error instanceof AuctionError) {
    console.log('Auction failed:', error.message);
  }
}
```

### Retry Mechanism

```typescript
import { RetryHandler } from '@/lib/templates';

// Check retry queue status
const retryStatus = RetryHandler.getRetryQueueStatus();
console.log('Items in retry queue:', retryStatus.totalItems);

// Clear retry queue
RetryHandler.clearRetryQueue();

// Pause/resume retries
RetryHandler.pauseRetries();
RetryHandler.resumeRetries();
```

## Testing

### Unit Testing

```typescript
import { TestUtils } from '@/tests/templates/template-engine.test';

// Create mock lead data
const mockLead = TestUtils.createMockLead();

// Simulate buyer responses
const response = await TestUtils.simulateBuyerResponse(45, true);

// Create mock buyers
const mockBuyer = TestUtils.createMockBuyer('test_buyer', 'Test Buyer');
```

### Integration Testing

```typescript
// Test complete pipeline
const result = await TemplateEngineOrchestrator.processLead(lead);
expect(result.success).toBe(true);
expect(result.auctionResult?.winningBuyerId).toBeDefined();

// Test specific buyer transformation
const transformResult = await TemplateEngineOrchestrator.transformForBuyer(
  lead, 
  'modernize', 
  true
);
expect(transformResult.success).toBe(true);
expect(transformResult.data).toHaveProperty('zip_code');
```

## Best Practices

### 1. **Configuration Management**
- Keep buyer configurations in version control
- Use environment variables for API keys and URLs
- Test configurations in staging before production
- Document field mapping decisions

### 2. **Performance Optimization**
- Monitor transformation times regularly
- Set appropriate timeout values for each buyer
- Use batch processing for high-volume scenarios
- Implement caching for static transformations

### 3. **Error Handling**
- Always handle transformation errors gracefully
- Implement proper retry logic for network failures
- Log errors with sufficient context for debugging
- Set up alerts for critical system failures

### 4. **Testing Strategy**
- Unit test all transformation functions
- Integration test complete auction workflows
- Load test with realistic data volumes
- Mock external buyer APIs consistently

### 5. **Monitoring and Alerting**
- Set up performance threshold alerts
- Monitor buyer response times and success rates
- Track compliance data inclusion rates
- Alert on unusual error patterns

## API Reference

### Core Classes

- **TemplateEngineOrchestrator**: Main entry point for all operations
- **TemplateEngine**: Core transformation engine
- **AuctionEngine**: Parallel auction processing
- **BuyerConfigurationRegistry**: Buyer configuration management
- **PerformanceMonitor**: Real-time metrics and alerting
- **RetryHandler**: Intelligent retry mechanisms

### Utility Classes

- **Transformations**: Built-in transformation functions
- **DataValidator**: Validation utilities
- **ValidationRuleBuilder**: Fluent validation rule builder

### Types

- **LeadData**: Complete lead data structure
- **BuyerConfig**: Buyer configuration interface
- **TemplateConfig**: Template mapping configuration
- **AuctionResult**: Auction outcome data
- **PerformanceMetrics**: System performance metrics

## Contributing

1. Follow the modular architecture patterns
2. Write comprehensive tests for new features
3. Update documentation for new transformations
4. Use TypeScript strict mode
5. Follow the established error handling patterns

## Support

For issues or questions:
1. Check the test suite for usage examples
2. Review the type definitions for API contracts
3. Monitor performance metrics for system health
4. Check retry queues for failed operations