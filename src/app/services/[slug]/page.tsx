/**
 * Dynamic Service Lead Form Page
 *
 * WHY: Single page component that handles ANY service type dynamically.
 *      Eliminates need for copy-paste service pages (windows, roofing, bathrooms).
 *
 * WHEN: User navigates to /services/[service-name] for any active service.
 *
 * HOW:
 *   1. Fetches QuestionFlow from /api/services/[slug]/flow
 *   2. Renders DynamicForm with the flow
 *   3. Submits completed form to /api/leads
 *
 * COMPLIANCE TOKEN FLOW:
 *   - TrustedForm and Jornaya are handled by DynamicForm providers
 *   - Tokens are captured automatically on form submission
 *   - Attribution data (UTM, click IDs) captured on mount
 *
 * ROUTE: /services/[slug] where slug is the service name (e.g., "windows", "roofing")
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import DynamicForm from '@/components/DynamicForm';
import type { QuestionFlow } from '@/lib/questions';

/**
 * Loading spinner component
 */
function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading service form...</p>
      </div>
    </div>
  );
}

/**
 * Not found component for invalid service slugs
 */
function ServiceNotFound({ message }: { message?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-md mx-auto px-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Service Not Found</h1>
        <p className="text-gray-600 mb-6">
          {message || "The service you're looking for is not available."}
        </p>
        <a
          href="/"
          className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Back to Home
        </a>
      </div>
    </div>
  );
}

/**
 * Error component for API failures
 */
function ServiceError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-md mx-auto px-4">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Something Went Wrong</h1>
        <p className="text-gray-600 mb-6">{message}</p>
        <div className="space-x-4">
          <button
            onClick={onRetry}
            className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
          <a
            href="/"
            className="inline-block bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Back to Home
          </a>
        </div>
      </div>
    </div>
  );
}

export default function DynamicServicePage() {
  const params = useParams();
  const slug = params.slug as string;

  const [flow, setFlow] = useState<QuestionFlow | null>(null);
  const [serviceInfo, setServiceInfo] = useState<{ id: string; name: string; displayName?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  /**
   * Fetch the question flow from API
   */
  const loadServiceFlow = async () => {
    setLoading(true);
    setError(null);
    setNotFound(false);

    try {
      const res = await fetch(`/api/services/${slug}/flow`);

      if (res.status === 404) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to load service');
      }

      const data = await res.json();

      if (!data.flow) {
        throw new Error('Invalid response: missing flow data');
      }

      setFlow(data.flow);
      setServiceInfo(data.service);
    } catch (err) {
      console.error('Error loading service flow:', err);
      setError(err instanceof Error ? err.message : 'Failed to load service');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (slug) {
      loadServiceFlow();
    }
  }, [slug]);

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
          serviceTypeId: slug,
          formData: answers,
          // Extract ZIP from address object (can be string or {address, zipCode} object)
          zipCode: typeof answers.address === 'object'
            ? answers.address?.zipCode
            : answers.zipCode || answers.address,
          ownsHome: answers.isHomeowner === 'yes',
          timeframe: answers.timeline,
          complianceData: {
            // TCPA consent from form - NEVER hardcode
            tcpaConsent: answers.tcpaConsent?.consented ?? false,
            tcpaTimestamp: answers.tcpaConsent?.timestamp || new Date().toISOString(),
            tcpaConsentText: answers.tcpaConsent?.text || 'TCPA consent not properly captured',
            // Marketing attribution data (UTM params, click IDs)
            attribution: answers.attribution,
            // TrustedForm and Jornaya compliance tokens from DynamicForm providers
            trustedFormCertUrl: answers.trustedFormCertUrl || null,
            trustedFormCertId: answers.trustedFormCertId || null,
            jornayaLeadId: answers.jornayaLeadId || null,
          }
        })
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

  // Render states
  if (loading) {
    return <LoadingSpinner />;
  }

  if (notFound) {
    return <ServiceNotFound message={`The service "${slug}" is not available.`} />;
  }

  if (error) {
    return <ServiceError message={error} onRetry={loadServiceFlow} />;
  }

  if (!flow) {
    return <ServiceNotFound message="Unable to load service configuration." />;
  }

  return (
    <DynamicForm
      flow={flow}
      onComplete={handleFormComplete}
      onBack={handleBack}
    />
  );
}
