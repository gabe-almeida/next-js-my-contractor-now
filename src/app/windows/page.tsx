/**
 * Windows Lead Form Page
 *
 * =========================================================================================
 * HOW TO REPLICATE FOR NEW SERVICE TYPES
 * =========================================================================================
 *
 * 1. CREATE THE QUESTION FLOW:
 *    - Copy an existing flow from src/lib/questions.ts (e.g., windowsFlow)
 *    - Update the serviceType, questions, and steps for your new service
 *
 * 2. CREATE THIS PAGE:
 *    - Copy this file to src/app/[your-service-name]/page.tsx
 *    - Update the import to use your new flow
 *    - Update serviceTypeId to match your service name in the database
 *
 * 3. ADD SERVICE TYPE TO DATABASE:
 *    - Add your service to prisma/seed.ts
 *    - Run: npx prisma db seed
 *
 * 4. ADD VALIDATION SCHEMA:
 *    - Add your service schema to src/lib/validations/lead.ts
 *    - Update the schemaMap in src/app/api/leads/route.ts
 *
 * =========================================================================================
 * COMPLIANCE TOKEN FLOW (TrustedForm & Jornaya)
 * =========================================================================================
 *
 * The DynamicForm component automatically handles compliance tokens:
 *
 * 1. ON PAGE LOAD:
 *    - TrustedFormProvider loads the TrustedForm script from api.trustedform.com
 *    - JornayaProvider loads the Jornaya LeadID script
 *    - Both scripts run and generate unique tokens for this session
 *    - Console will log "✅ TrustedForm INITIALIZED" and "✅ Jornaya LeadID INITIALIZED"
 *
 * 2. ON FORM SUBMISSION:
 *    - DynamicForm.tsx calls getTrustedFormCertUrl() and getJornayaLeadId()
 *    - These tokens are added to the answers object as:
 *      - answers.trustedFormCertUrl (the certificate URL for TrustedForm)
 *      - answers.trustedFormCertId (the token/cert ID)
 *      - answers.jornayaLeadId (the Jornaya LeadID token)
 *
 * 3. TO API:
 *    - This page extracts those values and sends them in complianceData
 *    - The API stores them in the lead record and validates TrustedForm cert
 *
 * 4. TO BUYER:
 *    - Auction engine includes these in PING/POST via field mappings
 *    - Modernize example: trustedFormCertUrl → trustedFormToken, jornayaLeadId → leadIDToken
 *
 * =========================================================================================
 * AFFILIATE TRACKING FLOW
 * =========================================================================================
 *
 * 1. CAPTURING AFFILIATE IDS:
 *    - DynamicForm captures URL params on mount via getAttributionData()
 *    - Looks for: ?aff=xxx, ?ref=xxx, ?affiliate_id=xxx, or aff_ref cookie
 *    - Also captures UTM params, click IDs (gclid, fbclid, etc.)
 *
 * 2. STORING IN DATABASE:
 *    - Affiliate data stored in lead.complianceData.attribution
 *    - Key fields: affiliate_id, aff, ref (any can identify affiliate)
 *
 * 3. PASSING TO BUYERS:
 *    - Field mapping: complianceData.attribution.ref → partnerSourceId
 *    - Field mapping: complianceData.attribution.affiliate_id → publisherSubId
 *    - Fallbacks configured for non-affiliate leads
 *
 * 4. AFFILIATE COMMISSION:
 *    - API calls recordConversion(affiliateCode) to increment link's conversion count
 *    - Commissions calculated based on affiliate's commission rate and lead sale price
 *
 * =========================================================================================
 */

'use client';

import DynamicForm from '@/components/DynamicForm';
import { windowsFlow } from '@/lib/questions';

export default function WindowsPage() {
  const handleFormComplete = async (answers: { [key: string]: any }) => {
    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serviceTypeId: 'windows',
          formData: answers,
          // Extract ZIP from address object (address can be string or {address, zipCode} object)
          zipCode: typeof answers.address === 'object'
            ? answers.address?.zipCode
            : answers.zipCode || answers.address,
          ownsHome: answers.isHomeowner === 'yes',
          timeframe: answers.timeline,
          complianceData: {
            // Use actual TCPA consent from form - NEVER hardcode compliance data
            tcpaConsent: answers.tcpaConsent?.consented ?? false,
            tcpaTimestamp: answers.tcpaConsent?.timestamp || new Date().toISOString(),
            tcpaConsentText: answers.tcpaConsent?.text || 'TCPA consent not properly captured',
            attribution: answers.attribution, // Marketing attribution data (utm params, click IDs, etc)
            // TrustedForm and Jornaya compliance tokens - captured by DynamicForm providers
            trustedFormCertUrl: answers.trustedFormCertUrl || null,
            trustedFormCertId: answers.trustedFormCertId || null,
            jornayaLeadId: answers.jornayaLeadId || null,
          }
        })
      });

      const result = await response.json();
      
      if (result.success) {
        window.location.href = `/thank-you?leadId=${result.data.leadId}`;
      } else {
        // API returns 'error' for main message, 'details' for validation errors
        const errorMsg = result.message || result.error || 'Unknown error';
        const details = result.details ? '\n' + result.details.map((d: any) => d.message).join('\n') : '';
        alert('Error submitting form: ' + errorMsg + details);
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      alert('Error submitting form. Please try again.');
    }
  };

  const handleBack = () => {
    window.location.href = '/';
  };

  return (
    <DynamicForm 
      flow={windowsFlow}
      onComplete={handleFormComplete}
      onBack={handleBack}
    />
  );
}