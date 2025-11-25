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
          zipCode: answers.address?.zipCode || '00000', // Extract ZIP from address object
          ownsHome: answers.isHomeowner === 'yes',
          timeframe: answers.timeline,
          complianceData: {
            tcpaConsent: true,
            tcpaTimestamp: new Date().toISOString(),
            tcpaConsentText: 'User agreed to be contacted by contractors and service providers'
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
      flow={bathroomFlow}
      onComplete={handleFormComplete}
      onBack={handleBack}
    />
  );
}