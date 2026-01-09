'use client';

import DynamicForm from '@/components/DynamicForm';
import { bathroomFlow } from '@/lib/questions';

export default function BathroomsPage() {
  const handleFormComplete = async (answers: { [key: string]: any }) => {
    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serviceTypeId: 'bathrooms',
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
            // Use undefined (not null) for missing values - Zod's .optional() accepts undefined but not null
            trustedFormCertUrl: answers.trustedFormCertUrl || undefined,
            trustedFormCertId: answers.trustedFormCertId || undefined,
            jornayaLeadId: answers.jornayaLeadId || undefined,
          }
        })
      });

      const result = await response.json();
      
      if (result.success) {
        window.location.href = `/thank-you?leadId=${result.data.leadId}`;
      } else {
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
      flow={bathroomFlow}
      onComplete={handleFormComplete}
      onBack={handleBack}
    />
  );
}