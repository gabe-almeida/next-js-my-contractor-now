'use client';

/**
 * DynamicFormWrapper - Client boundary for service form pages
 *
 * WHY: Wraps DynamicForm with page-level concerns (tracking, submission, navigation)
 *      while keeping the service page as a Server Component
 * WHEN: Rendered by /services/[slug] Server Component
 * HOW: Receives pre-fetched flow data as props, handles form completion and navigation
 */

import DynamicForm from '@/components/DynamicForm';
import type { QuestionFlow } from '@/lib/questions';
import { usePageTracking } from '@/hooks/usePageTracking';

interface DynamicFormWrapperProps {
  flow: QuestionFlow;
  serviceSlug: string;
}

export default function DynamicFormWrapper({ flow, serviceSlug }: DynamicFormWrapperProps) {
  // Track page view for analytics
  usePageTracking({
    pageType: 'SERVICE',
    pagePath: `/services/${serviceSlug}`,
    serviceSlug,
  });

  /**
   * Handle form completion - submit to leads API
   *
   * WHY: Centralized lead submission logic
   * WHEN: User completes all form steps
   * HOW: Extract data from answers, add compliance data, POST to /api/leads
   */
  const handleFormComplete = async (answers: { [key: string]: any }) => {
    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Use service name as serviceTypeId (API supports both name and UUID)
          serviceTypeId: serviceSlug,
          formData: answers,
          // Extract ZIP from address object (can be string or {address, zipCode} object)
          zipCode:
            typeof answers.address === 'object'
              ? answers.address?.zipCode
              : answers.zipCode || answers.address,
          ownsHome: answers.isHomeowner === 'yes',
          timeframe: answers.timeline,
          complianceData: {
            // TCPA consent from form - uses TCPAConsent object from createTCPAConsent()
            tcpaConsent: answers.tcpaConsent?.isAccepted ?? false,
            tcpaTimestamp: answers.tcpaConsent?.timestamp || new Date().toISOString(),
            tcpaConsentText: answers.tcpaConsent?.text || 'TCPA consent not properly captured',
            // Marketing attribution data (UTM params, click IDs)
            attribution: answers.attribution,
            // TrustedForm and Jornaya compliance tokens from DynamicForm providers
            // Use undefined (not null) for missing values - Zod's .optional() accepts undefined but not null
            trustedFormCertUrl: answers.trustedFormCertUrl || undefined,
            trustedFormCertId: answers.trustedFormCertId || undefined,
            jornayaLeadId: answers.jornayaLeadId || undefined,
          },
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Redirect to thank you page with lead ID
        window.location.href = `/thank-you?leadId=${result.data.leadId}`;
      } else {
        // Show error to user
        const errorMsg = result.message || result.error || 'Unknown error';
        const details = result.details
          ? '\n' + result.details.map((d: any) => d.message).join('\n')
          : '';
        alert('Error submitting form: ' + errorMsg + details);
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      alert('Error submitting form. Please try again.');
    }
  };

  /**
   * Handle back button - return to homepage
   */
  const handleBack = () => {
    window.location.href = '/';
  };

  return <DynamicForm flow={flow} onComplete={handleFormComplete} onBack={handleBack} serviceSlug={serviceSlug} />;
}
