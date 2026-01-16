/**
 * Call Data Transformer
 *
 * WHY: Transform call data into buyer-specific PING payloads for pay-per-call system.
 *      Networks like Modernize and HomeAdvisor expect specific field names and formats.
 *
 * WHEN: Called by CallAuctionEngine before sending PING requests to network buyers.
 *
 * HOW: Uses the same TemplateMapping structure as lead transformations but with
 *      call-specific source fields (callerPhone, callerZip, ivrResponses, etc.).
 *
 * TRANSFORMATION ORDER (matches lead engine):
 * 1. Get source value from call data
 * 2. Apply valueMap if specified (database-driven)
 * 3. Apply transform if specified (code-driven)
 * 4. Set result to target field name
 *
 * EXAMPLE:
 * Call data: { callerPhone: '+15551234567', callerZip: '90210', isQualified: true }
 * Mapping: [
 *   { sourceField: 'callerPhone', targetField: 'phone', transform: 'phone.digitsOnly' },
 *   { sourceField: 'callerZip', targetField: 'postalCode' },
 *   { sourceField: 'isQualified', targetField: 'preQualified', transform: 'boolean.yesNo' }
 * ]
 * Output: { phone: '5551234567', postalCode: '90210', preQualified: 'Yes' }
 */

import { TemplateMapping, TransformContext, ValidationError } from './types';
import { Transformations } from './transformations';
import { logger } from '../logger';
import type { Call } from '@prisma/client';

// ============================================================================
// TYPES
// ============================================================================

/**
 * WHY: Configuration for call field mappings stored in buyer_service_configs.
 * WHEN: Loaded from database for network buyers.
 */
export interface CallFieldMappingConfig {
  version: string;
  mappings: CallFieldMapping[];
  pingStaticFields?: Record<string, unknown>;
}

/**
 * WHY: Individual field mapping for call data.
 * WHEN: Applied during call PING payload generation.
 */
export interface CallFieldMapping {
  id: string;
  sourceField: string;
  targetField: string;
  transform?: string;
  valueMap?: Record<string, string>;
  required?: boolean;
  defaultValue?: unknown;
}

/**
 * WHY: Call data structure for transformation.
 * WHEN: Passed to transform functions.
 */
export interface CallData {
  id: string;
  twilioCallSid: string;
  callerPhone: string;
  callerPhoneDisplay?: string | null;
  callerCity?: string | null;
  callerState?: string | null;
  callerZip?: string | null;
  callerName?: string | null;
  isQualified: boolean;
  ivrResponses?: Record<string, unknown> | null;
  serviceType?: {
    id: string;
    name: string;
    displayName: string;
  } | null;
  campaign?: {
    id: string;
    name: string;
  } | null;
  createdAt: Date;
}

// ============================================================================
// DEFAULT MAPPINGS
// ============================================================================

/**
 * WHY: Default field mappings when buyer has no custom configuration.
 * WHEN: Network buyer's callFieldMappings is null/empty.
 * HOW: Maps common call fields to standard names used by most networks.
 */
export const DEFAULT_CALL_MAPPINGS: CallFieldMapping[] = [
  {
    id: 'default-phone',
    sourceField: 'callerPhone',
    targetField: 'phone',
    transform: 'phone.digitsOnly',
    required: true,
  },
  {
    id: 'default-zip',
    sourceField: 'callerZip',
    targetField: 'zipCode',
    required: true,
  },
  {
    id: 'default-city',
    sourceField: 'callerCity',
    targetField: 'city',
  },
  {
    id: 'default-state',
    sourceField: 'callerState',
    targetField: 'state',
  },
  {
    id: 'default-qualified',
    sourceField: 'isQualified',
    targetField: 'preQualified',
    transform: 'boolean.yesNo',
  },
  {
    id: 'default-service',
    sourceField: 'serviceType.name',
    targetField: 'service',
    transform: 'string.uppercase',
  },
  {
    id: 'default-callsid',
    sourceField: 'twilioCallSid',
    targetField: 'callId',
  },
];

// ============================================================================
// CALL TRANSFORMER CLASS
// ============================================================================

/**
 * WHY: Transforms call data for network PING requests.
 * WHEN: Before sending PING to network RTB endpoints.
 * HOW: Applies field mappings from database or defaults.
 */
export class CallTransformer {
  /**
   * WHY: Transform call data using configured field mappings.
   * WHEN: Called by CallAuctionEngine.collectNetworkBid().
   *
   * @param call - The call record with relations
   * @param mappingConfig - Field mapping configuration from database
   * @returns Transformed payload ready for PING request
   */
  static transform(
    call: CallData,
    mappingConfig: CallFieldMappingConfig | null
  ): Record<string, unknown> {
    const mappings = mappingConfig?.mappings || DEFAULT_CALL_MAPPINGS;
    const staticFields = mappingConfig?.pingStaticFields || {};

    const sourceData = this.prepareSourceData(call);
    const result: Record<string, unknown> = {};

    // Process each mapping
    for (const mapping of mappings) {
      try {
        const value = this.processMapping(sourceData, mapping);
        if (value !== undefined) {
          result[mapping.targetField] = value;
        }
      } catch (error) {
        if (mapping.required) {
          logger.warn('Required call field mapping failed', {
            callId: call.id,
            field: mapping.sourceField,
            error: (error as Error).message,
          });
        }
        // Continue with other mappings
      }
    }

    // Add static fields (override any mapped fields)
    Object.assign(result, staticFields);

    // Add timestamp
    result.timestamp = new Date().toISOString();

    return result;
  }

  /**
   * WHY: Prepare source data from call record.
   * WHEN: Before processing field mappings.
   * HOW: Flatten nested fields for easy path access.
   */
  private static prepareSourceData(call: CallData): Record<string, unknown> {
    return {
      // Direct fields
      id: call.id,
      twilioCallSid: call.twilioCallSid,
      callerPhone: call.callerPhone,
      callerPhoneDisplay: call.callerPhoneDisplay,
      callerCity: call.callerCity,
      callerState: call.callerState,
      callerZip: call.callerZip,
      callerName: call.callerName,
      isQualified: call.isQualified,
      createdAt: call.createdAt.toISOString(),

      // Nested service type (flattened for path access)
      'serviceType.id': call.serviceType?.id,
      'serviceType.name': call.serviceType?.name,
      'serviceType.displayName': call.serviceType?.displayName,

      // Nested campaign (flattened)
      'campaign.id': call.campaign?.id,
      'campaign.name': call.campaign?.name,

      // IVR responses (flattened)
      ivrResponses: call.ivrResponses,
      ...this.flattenIvrResponses(call.ivrResponses),
    };
  }

  /**
   * WHY: Flatten IVR responses for field mapping access.
   * WHEN: Call has completed IVR qualification.
   * HOW: Prefix each IVR response with 'ivr.' for clear path access.
   */
  private static flattenIvrResponses(
    responses: Record<string, unknown> | null | undefined
  ): Record<string, unknown> {
    if (!responses || typeof responses !== 'object') {
      return {};
    }

    const flattened: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(responses)) {
      flattened[`ivr.${key}`] = value;
    }
    return flattened;
  }

  /**
   * WHY: Process a single field mapping.
   * WHEN: For each mapping in the configuration.
   * HOW: Get value, apply valueMap, apply transform.
   */
  private static processMapping(
    sourceData: Record<string, unknown>,
    mapping: CallFieldMapping
  ): unknown {
    // Get source value
    let value = this.getNestedValue(sourceData, mapping.sourceField);

    // Use default if undefined
    if (value === undefined && mapping.defaultValue !== undefined) {
      value = mapping.defaultValue;
    }

    // Check required
    if (mapping.required && (value === null || value === undefined || value === '')) {
      throw new ValidationError(
        mapping.sourceField,
        `Required field '${mapping.sourceField}' is missing or empty`
      );
    }

    // Skip if no value and not required
    if (value === null || value === undefined) {
      return undefined;
    }

    // Apply valueMap (database-driven value conversion)
    if (mapping.valueMap && typeof value === 'string') {
      const mappedValue = mapping.valueMap[value];
      if (mappedValue !== undefined) {
        value = mappedValue;
      }
    }

    // Apply transform (code-driven formatting)
    if (mapping.transform) {
      value = Transformations.applyTransform(value, mapping.transform);
    }

    return value;
  }

  /**
   * WHY: Get nested value using dot notation path.
   * WHEN: Accessing fields like 'serviceType.name'.
   */
  private static getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    // First check for exact match (flattened paths)
    if (obj[path] !== undefined) {
      return obj[path];
    }

    // Fall back to nested traversal
    return path.split('.').reduce((current: unknown, key: string) => {
      if (current === null || current === undefined) {
        return undefined;
      }
      return (current as Record<string, unknown>)[key];
    }, obj);
  }

  /**
   * WHY: Parse field mapping config from database JSON.
   * WHEN: Loading buyer's callFieldMappings from buyer_service_configs.
   *
   * @param json - JSON value from Prisma (could be null, object, or Prisma.JsonValue)
   * @returns Parsed configuration or null
   */
  static parseConfig(json: unknown): CallFieldMappingConfig | null {
    if (!json || typeof json !== 'object') {
      return null;
    }

    const config = json as Record<string, unknown>;

    // Validate basic structure
    if (!config.version || !Array.isArray(config.mappings)) {
      logger.warn('Invalid callFieldMappings structure', { config });
      return null;
    }

    return {
      version: String(config.version),
      mappings: config.mappings as CallFieldMapping[],
      pingStaticFields: config.pingStaticFields as Record<string, unknown> | undefined,
    };
  }

  /**
   * WHY: Preview transformation result for admin UI.
   * WHEN: Admin wants to test their field mappings.
   *
   * @param sampleCall - Sample call data for preview
   * @param mappingConfig - Configuration to test
   * @returns Preview result with transformed values
   */
  static preview(
    sampleCall: Partial<CallData>,
    mappingConfig: CallFieldMappingConfig | null
  ): {
    success: boolean;
    result?: Record<string, unknown>;
    errors?: string[];
  } {
    const errors: string[] = [];

    // Fill in defaults for missing sample data
    const fullCall: CallData = {
      id: sampleCall.id || 'preview-call-id',
      twilioCallSid: sampleCall.twilioCallSid || 'CA123456789',
      callerPhone: sampleCall.callerPhone || '+15551234567',
      callerPhoneDisplay: sampleCall.callerPhoneDisplay || '(555) 123-4567',
      callerCity: sampleCall.callerCity || 'Los Angeles',
      callerState: sampleCall.callerState || 'CA',
      callerZip: sampleCall.callerZip || '90210',
      callerName: sampleCall.callerName || 'John Doe',
      isQualified: sampleCall.isQualified ?? true,
      ivrResponses: sampleCall.ivrResponses || { ownsHome: true, timeframe: 'within_3_months' },
      serviceType: sampleCall.serviceType || { id: 'svc-1', name: 'windows', displayName: 'Windows' },
      campaign: sampleCall.campaign || { id: 'camp-1', name: 'Windows Campaign' },
      createdAt: sampleCall.createdAt || new Date(),
    };

    try {
      const result = this.transform(fullCall, mappingConfig);
      return { success: true, result };
    } catch (error) {
      errors.push((error as Error).message);
      return { success: false, errors };
    }
  }
}

export default CallTransformer;
