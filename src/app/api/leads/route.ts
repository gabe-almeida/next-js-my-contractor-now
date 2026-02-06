/**
 * ============================================================================
 * LEAD FLOW DOCUMENTATION - STEP 2 OF 6: LEAD CREATION API
 * ============================================================================
 *
 * WHAT: API endpoint that receives form submissions and creates Lead records
 * WHY:  Persist lead data and trigger async processing for buyer matching
 * WHEN: Called by DynamicForm.onSubmit() after user submits the form
 *
 * PREVIOUS STEP: src/components/DynamicForm.tsx
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
 * - Lead.formData = JSON.stringify(finalFormData)  ← RAW form values!
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
import { sanitizeFormData } from '@/lib/security/sanitize';
import { LeadStatus, LeadDisposition, ChangeSource } from '@/types/database';
import { recordConversion } from '@/lib/services/affiliate-link-service';
import { recordSystemStatusChange } from '@/lib/services/lead-accounting-service';
import { sendAuctionCompletionEmail, buildEmailDataFromDatabase } from '@/lib/services/admin-email-service';
import { AuctionEngine } from '@/lib/auction/engine';
import { LeadData } from '@/lib/templates/types';
import { trackLeadCAPI } from '@/lib/meta/conversion-api';
import { captureApiError, captureMessage, addBreadcrumb } from '@/lib/sentry';

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

    // Auto-inject service-specific fields to reduce user friction
    // These fields are removed from the form UI but still required by buyer field mappings
    // See: /docs/forms-system.md#auto-injected-fields
    let finalFormData = { ...sanitizedFormData };

    if (serviceType.name === 'windows') {
      // Windows: Always set projectScope to "install" (repair/install question removed)
      // All buyer field mappings with sourceField="formData.projectScope" will receive "install"
      // and transform via their valueMaps (e.g., "install" → "New Unit Installed" for PX)
      finalFormData.projectScope = 'install';
    }

    // Validate formData against service-specific schema from database
    // Schema is generated dynamically from ServiceType.formSchema
    if (!serviceType.formSchema) {
      return NextResponse.json({
        success: false,
        error: 'Service configuration missing',
        message: `Service type '${serviceType.name}' does not have a form schema configured. Add it via Admin UI.`,
        timestamp: new Date().toISOString(),
      }, { status: 400 });
    }

    let serviceSchema: ReturnType<typeof generateZodSchema>;
    try {
      serviceSchema = generateZodSchema(serviceType.formSchema);
    } catch (error) {
      captureApiError(error, { route: '/api/leads', action: 'schema_generation', extra: { serviceType: serviceType.name } });
      console.error('Dynamic schema generation failed:', error);
      return NextResponse.json({
        success: false,
        error: 'Schema generation failed',
        message: `Failed to generate validation schema for '${serviceType.name}'. Check formSchema in Admin UI.`,
        timestamp: new Date().toISOString(),
      }, { status: 500 });
    }

    // DEBUG: Log data being validated against service schema
    const dataToValidate = {
      zipCode,
      ownsHome,
      timeframe,
      ...finalFormData,
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
    // Get first IP from x-forwarded-for (proxy chain) - some buyers require single IP format
    const xForwardedFor = request.headers.get('x-forwarded-for');
    const clientIp = request.ip ||
      (xForwardedFor ? xForwardedFor.split(',')[0].trim() : null) ||
      request.headers.get('x-real-ip');

    const leadComplianceData = complianceData ? {
      ipAddress: clientIp,
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
          formData: JSON.stringify(finalFormData),
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
          // Network buyer required fields - populate top-level columns for field mapping access
          ipAddress: leadComplianceData?.ipAddress || clientIp || null,
          userAgent: leadComplianceData?.userAgent || request.headers.get('user-agent') || null,
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
              formFields: Object.keys(finalFormData).length,
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
    let auctionResult: any = null;

    try {
      jobId = await addToQueue('lead-processing', {
        leadId: result.id,
        priority: leadQualityScore >= 80 ? 'high' : 'normal',
      });
      console.log('[API /api/leads] Lead added to Redis queue:', { leadId: result.id, jobId });
    } catch (queueError) {
      // Redis not configured or unavailable - process async WITHOUT blocking!
      // IMPORTANT: We use setTimeout to ensure the HTTP response is sent BEFORE auction starts.
      // This gives the user immediate feedback while auction runs in background.
      console.warn('[API /api/leads] Redis unavailable, processing lead async (fire-and-forget):', queueError);

      // Prepare lead data for auction
      // IMPORTANT: complianceData with tcpaConsent is REQUIRED for buyer eligibility checks!
      const leadDataForAuction = {
        id: result.id,
        serviceTypeId: serviceType.id,
        serviceType: serviceType as any, // Prisma type differs from LeadData.ServiceType
        zipCode,
        formData: finalFormData,
        ownsHome,
        timeframe,
        status: 'PENDING',
        trustedFormCertUrl: complianceData?.trustedFormCertUrl || undefined,
        trustedFormCertId: complianceData?.trustedFormCertId || undefined,
        jornayaLeadId: complianceData?.jornayaLeadId || undefined,
        // Network buyer required fields - pass through from database record
        ipAddress: result.ipAddress || undefined,
        userAgent: result.userAgent || undefined,
        // IMPORTANT: Preserve full tcpaConsent object for field mapping access to .text
        // The Modernize field mapping needs complianceData.tcpaConsent.text for homePhoneConsentLanguage
        complianceData: leadComplianceData ? {
          userAgent: leadComplianceData.userAgent || '',
          timestamp: leadComplianceData.timestamp || new Date().toISOString(),
          ipAddress: leadComplianceData.ipAddress,
          // Preserve full tcpaConsent object (not just boolean) for field mapping access
          tcpaConsent: leadComplianceData.tcpaConsent || { consented: true, timestamp: new Date().toISOString(), text: '' },
          privacyPolicyAccepted: true,
          submissionSource: 'web',
          attribution: leadComplianceData.attribution,
          // Also include trustedFormData and jornayaData for compliance field mapping access
          trustedFormData: leadComplianceData.trustedFormData,
          jornayaData: leadComplianceData.jornayaData,
        } : {
          userAgent: request.headers.get('user-agent') || '',
          timestamp: new Date().toISOString(),
          ipAddress: request.ip || request.headers.get('x-forwarded-for') || undefined,
          tcpaConsent: { consented: complianceData?.tcpaConsent ?? true, timestamp: new Date().toISOString(), text: '' },
          privacyPolicyAccepted: true,
          submissionSource: 'web',
        },
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      } as LeadData;

      // FIRE AND FORGET with setTimeout - ensures response is sent first
      // Using setTimeout(0) schedules as macrotask, running after current I/O (response send)
      console.log('[API /api/leads] Scheduling background auction for lead:', result.id);
      addBreadcrumb('Scheduling background auction', 'auction', { leadId: result.id, serviceTypeId: leadDataForAuction.serviceTypeId, zipCode: leadDataForAuction.zipCode });

      // Maximum time for entire auction process (60 seconds)
      const AUCTION_TIMEOUT_MS = 60000;

      setTimeout(async () => {
        addBreadcrumb('setTimeout callback started', 'auction', { leadId: result.id });

        // Recover leads stuck in PROCESSING > 5 min (orphaned by deploys/restarts)
        try {
          const stuckLeads = await prisma.lead.updateMany({
            where: {
              status: LeadStatus.PROCESSING,
              updatedAt: { lt: new Date(Date.now() - 5 * 60 * 1000) },
            },
            data: { status: LeadStatus.REJECTED },
          });
          if (stuckLeads.count > 0) {
            captureMessage(`Recovered ${stuckLeads.count} stuck PROCESSING leads`, 'warning');
          }
        } catch {
          // Don't block current auction if cleanup fails
        }

        // Helper to run auction with timeout protection
        const runAuctionWithTimeout = async () => {
          // Mark as PROCESSING before auction starts
          await prisma.lead.update({
            where: { id: result.id },
            data: { status: LeadStatus.PROCESSING },
          });
          addBreadcrumb('Lead status set to PROCESSING', 'auction', { leadId: result.id });

          const auctionResult = await AuctionEngine.runAuction(leadDataForAuction);
          addBreadcrumb('Auction completed', 'auction', {
            leadId: result.id,
            status: auctionResult.status,
            winningBuyerId: auctionResult.winningBuyerId,
            winningBidAmount: auctionResult.winningBidAmount,
            participantCount: auctionResult.participantCount,
          });
          console.log('[API /api/leads] Background auction completed:', {
            leadId: result.id,
            status: auctionResult.status,
            winningBuyerId: auctionResult.winningBuyerId,
            winningBidAmount: auctionResult.winningBidAmount,
            participantCount: auctionResult.participantCount,
          });

          // Determine final status based on auction result
          let finalStatus: LeadStatus;
          let statusReason: string;

          if (auctionResult.winningBuyerId && auctionResult.postResult?.success) {
            finalStatus = LeadStatus.SOLD;
            statusReason = `Sold to buyer ${auctionResult.winningBuyerId} for $${auctionResult.winningBidAmount}`;
          } else if (auctionResult.winningBuyerId && !auctionResult.postResult?.success) {
            finalStatus = LeadStatus.DELIVERY_FAILED;
            statusReason = `Delivery failed to buyer ${auctionResult.winningBuyerId}: ${auctionResult.postResult?.error || 'Unknown error'}`;
          } else {
            finalStatus = LeadStatus.REJECTED;
            statusReason = auctionResult.participantCount === 0
              ? 'No eligible buyers found for auction'
              : 'No winning bids received';
          }

          // Update lead with final status
          await prisma.lead.update({
            where: { id: result.id },
            data: {
              status: finalStatus,
              winningBuyerId: auctionResult.winningBuyerId || null,
              winningBid: auctionResult.winningBidAmount || null,
            },
          });

          // Record status history
          await recordSystemStatusChange(
            result.id,
            LeadStatus.PROCESSING,
            finalStatus,
            statusReason,
            ChangeSource.SYSTEM
          );

          addBreadcrumb('Lead status updated', 'auction', { leadId: result.id, finalStatus, statusReason });
          console.log('[API /api/leads] Lead status updated:', { leadId: result.id, finalStatus });

          // Send admin notification email
          // Uses database transactions as source of truth (not in-memory AuctionResult)
          try {
            const customerName = finalFormData.firstName
              ? `${finalFormData.firstName} ${finalFormData.lastName || ''}`.trim()
              : finalFormData.name;

            const emailData = await buildEmailDataFromDatabase(
              result.id,
              serviceType.name,
              zipCode,
              customerName,
              finalFormData.email,
              finalFormData.phone,
              result.createdAt
            );

            await sendAuctionCompletionEmail(emailData);
            addBreadcrumb('Admin notification email sent', 'auction', { leadId: result.id });
            console.log('[API /api/leads] Admin notification email sent for lead:', result.id);
          } catch (emailError) {
            addBreadcrumb('Admin email failed', 'auction', { leadId: result.id, error: (emailError as Error).message });
            console.error('[API /api/leads] Failed to send admin notification email:', emailError);
          }
        };

        // Create timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('AUCTION_TIMEOUT: Exceeded 60 second limit')), AUCTION_TIMEOUT_MS);
        });

        try {
          // Race the auction against the timeout
          await Promise.race([runAuctionWithTimeout(), timeoutPromise]);
        } catch (auctionError) {
          // Auction failed or timed out - update lead status to REJECTED
          const isTimeout = (auctionError as Error).message.includes('AUCTION_TIMEOUT');
          addBreadcrumb(isTimeout ? 'Auction timed out' : 'Auction error caught', 'auction', {
            leadId: result.id,
            error: (auctionError as Error).message,
            isTimeout
          });
          captureApiError(auctionError, { route: '/api/leads', action: 'background_auction', extra: { leadId: result.id, isTimeout } });
          console.error('[API /api/leads] Background auction failed:', auctionError);

          try {
            await prisma.lead.update({
              where: { id: result.id },
              data: { status: LeadStatus.REJECTED },
            });
            await recordSystemStatusChange(
              result.id,
              LeadStatus.PROCESSING,
              LeadStatus.REJECTED,
              isTimeout ? 'Auction timeout: Processing exceeded 60 seconds' : `Auction error: ${(auctionError as Error).message}`,
              ChangeSource.SYSTEM
            );
            addBreadcrumb('Lead status set to REJECTED after error', 'auction', { leadId: result.id, isTimeout });
          } catch (updateError) {
            addBreadcrumb('Failed to update lead status after error', 'auction', { leadId: result.id, error: (updateError as Error).message });
            console.error('[API /api/leads] Failed to update lead status after auction error:', updateError);
          }
        }
      }, 0); // setTimeout(0) ensures this runs after the current event loop tick (after response sent)
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

    // Send Lead event to Meta Conversion API (server-side)
    // Fire and forget - don't block lead response for Meta tracking
    try {
      // Extract form data for customer information
      const formDataObj = finalFormData as any;

      // Build Meta CAPI user data
      const metaUserData = {
        email: formDataObj.email,
        phone: formDataObj.phone,
        firstName: formDataObj.firstName,
        lastName: formDataObj.lastName,
        city: formDataObj.city,
        state: formDataObj.state || formDataObj.stateAbbrev,
        zipCode: zipCode,
        country: 'us',
        externalId: result.id,
        // NOT hashed per Meta requirements
        clientIpAddress: leadComplianceData?.ipAddress || undefined,
        clientUserAgent: leadComplianceData?.userAgent || undefined,
        fbc: leadComplianceData?.attribution?.fbc || undefined,
        fbp: leadComplianceData?.attribution?.fbp || undefined,
      };

      // Build custom data (lead value, service info)
      const metaCustomData = {
        currency: 'USD',
        value: 50, // Estimated lead value (adjust as needed)
        content_name: serviceType.name,
        content_category: 'Home Services',
        status: 'submitted',
      };

      // Get event source URL from referer or default
      const eventSourceUrl = request.headers.get('referer') || 'https://mycontractornow.com';

      // Generate event ID for deduplication with client-side pixel
      const eventId = `lead_${result.id}_${Date.now()}`;

      // Send to Meta CAPI (fire and forget) with service-specific event name
      // Event name is auto-generated from service display name (e.g., "Windows Lead")
      trackLeadCAPI(
        result.id,                // leadId for database logging
        serviceType.displayName,  // "Windows Installation" → "Windows Lead"
        serviceType.name,         // "windows" for logging
        metaUserData,
        metaCustomData,
        eventSourceUrl,
        eventId
      ).catch(err => {
        console.warn('[Meta CAPI] Failed to send Lead event:', err);
      });

      console.log('[Meta CAPI] Lead event queued for sending:', {
        leadId: result.id,
        eventId,
        serviceType: serviceType.name,
        hasEmail: !!metaUserData.email,
        hasPhone: !!metaUserData.phone,
        hasFBC: !!metaUserData.fbc,
        hasFBP: !!metaUserData.fbp,
      });
    } catch (metaError) {
      // Log error but don't fail lead submission
      console.error('[Meta CAPI] Error preparing Lead event:', metaError);
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
    captureApiError(error, { route: '/api/leads', action: 'POST' });
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
    captureApiError(error, { route: '/api/leads', action: 'GET' });
    console.error('Get leads error:', error);

    return NextResponse.json({
      success: false,
      error: 'Failed to retrieve leads',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
