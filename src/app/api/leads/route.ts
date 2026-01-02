import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { addToQueue } from '@/lib/redis';
import { RadarService } from '@/lib/external/radar';
import { TrustedFormService } from '@/lib/external/trustedform';
import {
  createLeadSchema,
  windowsFormSchema,
  bathroomFormSchema,
  roofingFormSchema
} from '@/lib/validations/lead';
import { sanitizeFormData } from '@/lib/security/sanitize';
import { LeadStatus, LeadDisposition, ChangeSource } from '@/types/database';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
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

    // Validate ZIP code with Radar.com (skip in test mode)
    if (process.env.NODE_ENV !== 'test' && process.env.SKIP_RADAR_VALIDATION !== 'true') {
      const zipValidation = await RadarService.validateZipCode(zipCode);
      if (!zipValidation.isValid) {
        return NextResponse.json({
          success: false,
          error: 'Invalid ZIP code',
          message: 'Please enter a valid US ZIP code',
          timestamp: new Date().toISOString(),
        }, { status: 400 });
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
    const serviceType = await prisma.serviceType.findUnique({
      where: { id: serviceTypeId, active: true },
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
    const schemaMap: Record<string, any> = {
      'windows': windowsFormSchema,
      'bathrooms': bathroomFormSchema,
      'roofing': roofingFormSchema,
    };

    const serviceSchema = schemaMap[serviceType.name];
    if (!serviceSchema) {
      return NextResponse.json({
        success: false,
        error: 'Unsupported service type',
        message: `Service type '${serviceType.name}' does not have a validation schema`,
        timestamp: new Date().toISOString(),
      }, { status: 400 });
    }

    // Validate complete form data against service-specific schema (using sanitized data)
    const formValidation = serviceSchema.safeParse({
      zipCode,
      ownsHome,
      timeframe,
      ...sanitizedFormData,
      complianceData,
    });

    if (!formValidation.success) {
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
          serviceTypeId,
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
    const jobId = await addToQueue('lead-processing', {
      leadId: result.id,
      priority: leadQualityScore >= 80 ? 'high' : 'normal',
    });

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