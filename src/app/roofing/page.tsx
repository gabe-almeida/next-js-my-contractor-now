'use client';

import DynamicForm from '@/components/DynamicForm';
import { roofingFlow } from '@/lib/questions';

export default function RoofingPage() {
  const handleFormComplete = async (answers: { [key: string]: any }) => {
    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serviceTypeId: 'roofing',
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
            attribution: answers.attribution // Marketing attribution data (utm params, click IDs, etc)
          }
        })
      });

      const result = await response.json();
      
      if (result.success) {
        window.location.href = `/thank-you?leadId=${result.data.leadId}`;
      } else {
        alert('Error submitting form: ' + result.message);
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
      flow={roofingFlow}
      onComplete={handleFormComplete}
      onBack={handleBack}
    />
  );
}