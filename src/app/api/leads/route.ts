/**
 * ============================================================================
 * LEAD FLOW DOCUMENTATION - STEP 2 OF 6: LEAD CREATION API
 * ============================================================================
 *
 * WHAT: API endpoint that receives form submissions and creates Lead records
 * WHY:  Persist lead data and trigger async processing for buyer matching
 * WHEN: Called by DynamicForm.onSubmit() after user submits the form
 *
 * PREVIOUS STEP: src/components/forms/dynamic/DynamicForm.tsx
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │                        LEAD FLOW OVERVIEW                                │
 * │                                                                          │
 * │  [STEP 1] DynamicForm.tsx          → Form submission                    │
 * │      ↓ FormSubmission object                                            │
 * │  [STEP 2] /api/leads/route.ts      ← YOU ARE HERE                       │
 * │      ↓ Lead added to processing queue                                   │
 * │  [STEP 3] auction/engine.ts        → Finds eligible buyers              │
 * │      ↓ Buyer configs loaded from database                               │
 * │  [STEP 4] database-buyer-loader.ts → Loads FieldMappingConfig           │
 * │      ↓ Converts to TemplateMapping with valueMap                        │
 * │  [STEP 5] templates/engine.ts      → Applies valueMap + transforms      │
 * │      ↓ Generates PING/POST payloads                                     │
 * │  [STEP 6] auction/engine.ts        → Sends PING → Selects winner → POST │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * DATA FLOW:
 * 1. Receive FormSubmission from DynamicForm
 * 2. Validate request with Zod schema (createLeadSchema)
 * 3. Sanitize form data (prevent XSS)
 * 4. Validate ZIP code with Radar.com
 * 5. Verify TrustedForm certificate
 * 6. Create Lead record in database with status=PENDING
 *    → formData stored as JSON (RAW values - no transformation yet!)
 * 7. Record affiliate conversion if ref code present
 * 8. Add lead to 'lead-processing' queue for async auction
 *
 * DATABASE STORAGE:
 * - Lead.formData = JSON.stringify(sanitizedFormData)  ← RAW form values!
 * - Lead.status = 'PENDING'
 * - Lead.trustedFormCertUrl = from compliance data
 * - Lead.jornayaLeadId = from compliance data
 * - Lead.complianceData = full compliance object
 *
 * IMPORTANT: Form data is stored as RAW values (e.g., "within_3_months")
 * Transformation to buyer format happens later in Step 5 (TemplateEngine)
 *
 * NEXT STEP: Lead processor pulls from queue → src/lib/auction/engine.ts
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { addToQueue } from '@/lib/redis';
import { RadarService } from '@/lib/external/radar';
import { TrustedFormService } from '@/lib/external/trustedform';
import { createLeadSchema } from '@/lib/validations/lead';
import { generateZodSchema } from '@/lib/validations/dynamic-schema';
// Legacy schemas kept for fallback (feature flag: USE_DYNAMIC_VALIDATION)
import {
  windowsFormSchema,
  bathroomFormSchema,
  roofingFormSchema
} from '@/lib/validations/lead';
import { sanitizeFormData } from '@/lib/security/sanitize';
import { LeadStatus, LeadDisposition, ChangeSource } from '@/types/database';
import { recordConversion } from '@/lib/services/affiliate-link-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // DEBUG: Log raw request body received by server
    console.log('[API /api/leads] DEBUG - Raw request body:', {
      'formData.firstName': body.formData?.firstName,
      'formData.lastName': body.formData?.lastName,
      'formData.email': body.formData?.email,
      'formData.phone': body.formData?.phone,
      'formData.nameInfo': body.formData?.nameInfo,
      serviceTypeId: body.serviceTypeId,
      zipCode: body.zipCode,
    });

    // Validate the request body
    const validationResult = createLeadSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request data',
        details: validationResult.error.errors,
        timestamp: new Date().toISOString(),
      }, { status: 400 });
    }

    const { serviceTypeId, formData, zipCode, ownsHome, timeframe, complianceData } = validationResult.data;

    // Sanitize form data to prevent XSS attacks
    const sanitizedFormData = sanitizeFormData(formData);

    // Validate ZIP code with Radar.com (skip in test mode or if API key not configured)
    if (process.env.NODE_ENV !== 'test' && process.env.SKIP_RADAR_VALIDATION !== 'true') {
      try {
        const zipValidation = await RadarService.validateZipCode(zipCode);
        if (!zipValidation.isValid) {
          return NextResponse.json({
            success: false,
            error: 'Invalid ZIP code',
            message: 'Please enter a valid US ZIP code',
            timestamp: new Date().toISOString(),
          }, { status: 400 });
        }
      } catch (radarError: any) {
        // If Radar API key is not configured, skip validation
        // Address was already validated client-side via autocomplete
        if (radarError?.code === 'RADAR_NOT_CONFIGURED') {
          console.warn('Radar API key not configured, skipping server-side ZIP validation');
        } else {
          console.error('Radar validation error:', radarError);
          // Don't block submission for Radar API errors - address was validated client-side
        }
      }
    }

    // Validate TrustedForm certificate if provided (skip in test mode)
    let trustedFormValidation = null;
    let trustedFormComplianceReport = null;

    if (complianceData?.trustedFormCertUrl && process.env.NODE_ENV !== 'test') {
      try {
        const certificate = await TrustedFormService.validateCertificate(
          complianceData.trustedFormCertUrl
        );

        if (certificate) {
          trustedFormValidation = certificate;
          trustedFormComplianceReport = TrustedFormService.generateComplianceReport(certificate);

          // Log successful validation
          console.log('TrustedForm certificate validated:', {
            certUrl: complianceData.trustedFormCertUrl,
            isCompliant: trustedFormComplianceReport.isCompliant,
            complianceScore: trustedFormComplianceReport.complianceScore,
          });
        } else {
          // Certificate not found - log warning but continue
          console.warn('TrustedForm certificate not found:', complianceData.trustedFormCertUrl);
        }
      } catch (error) {
        // Log error but don't fail lead submission
        // TrustedForm being down shouldn't block legitimate leads
        console.error('TrustedForm validation error:', error);
      }
    }

    // Verify service type exists
    // Note: serviceTypeId can be either the UUID or the service name (e.g., 'windows')
    // We try both to support forms that pass name vs UUID
    const serviceType = await prisma.serviceType.findFirst({
      where: {
        OR: [
          { id: serviceTypeId },
          { name: serviceTypeId }
        ],
        active: true
      },
    });

    if (!serviceType) {
      return NextResponse.json({
        success: false,
        error: 'Invalid service type',
        message: 'The specified service type is not available',
        timestamp: new Date().toISOString(),
      }, { status: 400 });
    }

    // Validate formData against service-specific schema
    // Feature flag: USE_DYNAMIC_VALIDATION (default: true)
    // Set to 'false' to use legacy hardcoded schemas
    const useDynamicValidation = process.env.USE_DYNAMIC_VALIDATION !== 'false';

    let serviceSchema: ReturnType<typeof generateZodSchema> | null = null;

    if (useDynamicValidation && serviceType.formSchema) {
      // Dynamic validation: Generate schema from database formSchema
      try {
        serviceSchema = generateZodSchema(serviceType.formSchema);
      } catch (error) {
        console.warn('Dynamic schema generation failed, falling back to legacy:', error);
      }
    }

    // Fallback to legacy hardcoded schemas if dynamic fails or is disabled
    if (!serviceSchema) {
      const legacySchemaMap: Record<string, any> = {
        'windows': windowsFormSchema,
        'bathrooms': bathroomFormSchema,
        'roofing': roofingFormSchema,
      };

      serviceSchema = legacySchemaMap[serviceType.name];

      if (!serviceSchema) {
        return NextResponse.json({
          success: false,
          error: 'Unsupported service type',
          message: `Service type '${serviceType.name}' does not have a validation schema. Add it via Admin UI or contact support.`,
          timestamp: new Date().toISOString(),
        }, { status: 400 });
      }
    }

    // DEBUG: Log data being validated against service schema
    const dataToValidate = {
      zipCode,
      ownsHome,
      timeframe,
      ...sanitizedFormData,
      complianceData,
    };
    console.log('[API /api/leads] DEBUG - Data being validated:', {
      firstName: (dataToValidate as any).firstName,
      lastName: (dataToValidate as any).lastName,
      email: (dataToValidate as any).email,
      phone: (dataToValidate as any).phone,
      zipCode: dataToValidate.zipCode,
      ownsHome: dataToValidate.ownsHome,
      timeframe: dataToValidate.timeframe,
      'typeof firstName': typeof (dataToValidate as any).firstName,
      'typeof lastName': typeof (dataToValidate as any).lastName,
    });

    // Validate complete form data against service-specific schema (using sanitized data)
    const formValidation = serviceSchema.safeParse(dataToValidate);

    if (!formValidation.success) {
      console.log('[API /api/leads] DEBUG - Validation FAILED:', {
        errors: formValidation.error.errors,
        dataKeys: Object.keys(dataToValidate),
      });
      return NextResponse.json({
        success: false,
        error: 'Invalid form data',
        details: formValidation.error.errors,
        timestamp: new Date().toISOString(),
      }, { status: 400 });
    }

    // Extract compliance data from request
    const leadComplianceData = complianceData ? {
      ipAddress: request.ip || request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
      userAgent: request.headers.get('user-agent'),
      timestamp: new Date().toISOString(),
      trustedFormData: complianceData.trustedFormCertUrl ? {
        certUrl: complianceData.trustedFormCertUrl,
        certId: complianceData.trustedFormCertId,
        validated: trustedFormValidation !== null,
        validatedAt: trustedFormValidation ? new Date().toISOString() : undefined,
        complianceReport: trustedFormComplianceReport ? {
          isCompliant: trustedFormComplianceReport.isCompliant,
          complianceScore: trustedFormComplianceReport.complianceScore,
          pageUrl: trustedFormComplianceReport.formUrl,
          certId: trustedFormComplianceReport.certId,
        } : undefined,
      } : undefined,
      jornayaData: complianceData.jornayaLeadId ? {
        leadId: complianceData.jornayaLeadId,
        pixelFired: true,
      } : undefined,
      tcpaConsent: complianceData.tcpaConsent ? {
        consented: complianceData.tcpaConsent,
        timestamp: complianceData.tcpaTimestamp || new Date().toISOString(),
        text: complianceData.tcpaConsentText || 'User provided TCPA consent',
      } : undefined,
      fingerprint: complianceData.fingerprint,
      // Marketing attribution data
      attribution: complianceData.attribution ? {
        // UTM parameters
        utm_source: complianceData.attribution.utm_source,
        utm_medium: complianceData.attribution.utm_medium,
        utm_campaign: complianceData.attribution.utm_campaign,
        utm_content: complianceData.attribution.utm_content,
        utm_term: complianceData.attribution.utm_term,
        // Click IDs
        fbclid: complianceData.attribution.fbclid,
        fbc: complianceData.attribution.fbc,
        fbp: complianceData.attribution.fbp,
        gclid: complianceData.attribution.gclid,
        wbraid: complianceData.attribution.wbraid,
        gbraid: complianceData.attribution.gbraid,
        msclkid: complianceData.attribution.msclkid,
        ttclid: complianceData.attribution.ttclid,
        li_fat_id: complianceData.attribution.li_fat_id,
        twclid: complianceData.attribution.twclid,
        rdt_cid: complianceData.attribution.rdt_cid,
        irclickid: complianceData.attribution.irclickid,
        // Analytics
        _ga: complianceData.attribution._ga,
        _gid: complianceData.attribution._gid,
        // Page context
        landing_page: complianceData.attribution.landing_page,
        referrer: complianceData.attribution.referrer,
        referrer_domain: complianceData.attribution.referrer_domain,
        first_touch_timestamp: complianceData.attribution.first_touch_timestamp,
        session_id: complianceData.attribution.session_id,
        raw_query_params: complianceData.attribution.raw_query_params,
        // Affiliate tracking
        affiliate_id: complianceData.attribution.affiliate_id,
        aff: complianceData.attribution.aff,
        ref: complianceData.attribution.ref,
      } : undefined,
    } : null;

    // Calculate lead quality score
    let leadQualityScore = 50; // Base score

    // TrustedForm scoring based on actual validation
    if (leadComplianceData?.trustedFormData) {
      if (trustedFormComplianceReport) {
        // Valid certificate with compliance report
        const complianceScore = trustedFormComplianceReport.complianceScore;
        if (complianceScore >= 80) leadQualityScore += 25; // High quality
        else if (complianceScore >= 60) leadQualityScore += 15; // Medium quality
        else leadQualityScore += 5; // Low quality but present
      } else {
        // Certificate provided but not validated (TrustedForm down or cert not found)
        leadQualityScore += 10; // Partial credit
      }
    }

    if (leadComplianceData?.jornayaData) leadQualityScore += 20;
    if (leadComplianceData?.tcpaConsent?.consented) leadQualityScore += 5;

    // Create the lead and audit log in a transaction (atomic operation)
    // If either fails, both will roll back to maintain data integrity
    const result = await prisma.$transaction(async (tx) => {
      // Create the lead (Prisma expects formData and complianceData as JSON strings)
      // Using sanitized formData to prevent XSS attacks
      const lead = await tx.lead.create({
        data: {
          serviceTypeId: serviceType.id,
          formData: JSON.stringify(sanitizedFormData),
          zipCode,
          ownsHome,
          timeframe,
          status: 'PENDING',
          disposition: 'NEW',
          trustedFormCertUrl: complianceData?.trustedFormCertUrl || null,
          trustedFormCertId: complianceData?.trustedFormCertId || null,
          jornayaLeadId: complianceData?.jornayaLeadId || null,
          complianceData: leadComplianceData ? JSON.stringify(leadComplianceData) : null,
          leadQualityScore,
        },
      });

      // Record initial status history (system-generated lead creation)
      await tx.leadStatusHistory.create({
        data: {
          leadId: lead.id,
          adminUserId: null,
          oldStatus: null,
          newStatus: LeadStatus.PENDING,
          oldDisposition: null,
          newDisposition: LeadDisposition.NEW,
          reason: 'Lead submitted via web form',
          changeSource: ChangeSource.SYSTEM,
          ipAddress: request.ip || request.headers.get('x-forwarded-for') || null,
        },
      });

      // Log compliance audit entry (in same transaction)
      if (leadComplianceData) {
        await tx.complianceAuditLog.create({
          data: {
            leadId: lead.id,
            eventType: 'FORM_SUBMITTED',
            eventData: JSON.stringify({
              serviceType: serviceType.name,
              zipCode,
              ownsHome,
              timeframe,
              formFields: Object.keys(sanitizedFormData).length,
              complianceScore: leadQualityScore,
            }),
            ipAddress: leadComplianceData.ipAddress,
            userAgent: leadComplianceData.userAgent,
          },
        });
      }

      return lead;
    }, {
      maxWait: 5000, // Maximum time to wait for a transaction to start (5 seconds)
      timeout: 10000, // Maximum time the transaction can run (10 seconds)
    });

    // Only add to queue after database transaction succeeds
    // This prevents orphaned queue jobs if database fails
    let jobId: string | null = null;
    try {
      jobId = await addToQueue('lead-processing', {
        leadId: result.id,
        priority: leadQualityScore >= 80 ? 'high' : 'normal',
      });
    } catch (queueError) {
      // Redis not configured or unavailable - lead is still saved, just skip queue
      console.warn('Failed to add lead to processing queue (Redis unavailable):', queueError);
    }

    // Record affiliate conversion if attribution exists
    // This increments the link's conversion counter for affiliate tracking
    const affiliateCode = leadComplianceData?.attribution?.affiliate_id ||
                          leadComplianceData?.attribution?.aff ||
                          leadComplianceData?.attribution?.ref;
    if (affiliateCode) {
      // Fire and forget - don't block lead response for affiliate tracking
      recordConversion(affiliateCode).catch(err => {
        console.warn('Failed to record affiliate conversion:', err);
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        leadId: result.id,
        status: result.status,
        estimatedProcessingTime: 30, // seconds
        jobId,
      },
      message: 'Lead submitted successfully',
      timestamp: new Date().toISOString(),
    }, { status: 201 });

  } catch (error) {
    console.error('Lead submission error:', error);

    return NextResponse.json({
      success: false,
      error: 'Lead submission failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = (page - 1) * limit;

    const status = searchParams.get('status');
    const serviceTypeId = searchParams.get('serviceTypeId');
    const zipCode = searchParams.get('zipCode');
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Build where clause
    const where: any = {};

    if (status) where.status = status;
    if (serviceTypeId) where.serviceTypeId = serviceTypeId;
    if (zipCode) where.zipCode = zipCode;

    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt.gte = new Date(fromDate);
      if (toDate) where.createdAt.lte = new Date(toDate);
    }

    // Get leads with related data
    const [leads, totalCount] = await Promise.all([
      prisma.lead.findMany({
        where,
        include: {
          serviceType: true,
          winningBuyer: true,
          transactions: {
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: offset,
        take: limit,
      }),
      prisma.lead.count({ where }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      success: true,
      data: leads,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Get leads error:', error);

    return NextResponse.json({
      success: false,
      error: 'Failed to retrieve leads',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
