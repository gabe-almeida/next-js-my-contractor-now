'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronLeftIcon } from '@heroicons/react/24/outline';
import { Question, QuestionFlow, getNextStep, shouldShowQuestion } from '@/lib/questions';
import { useFormValidation, ContactFormData } from '@/hooks/useFormValidation';
import { getTCPAConfig, createTCPAConsent, TCPAConsent } from '@/config/tcpa';
import TCPACheckbox from '@/components/forms/compliance/TCPACheckbox';
import AddressAutocomplete, { AddressSelectData } from '@/components/forms/inputs/AddressAutocomplete';
import Header from '@/components/layout/Header';
import { getAttributionData, AttributionData } from '@/utils/attribution';
import { TrustedFormProvider, useTrustedForm } from '@/components/forms/compliance/TrustedFormProvider';
import { JornayaProvider, useJornaya } from '@/components/forms/compliance/JornayaProvider';
import { ComplianceStatus } from '@/types/forms/index';

interface DynamicFormProps {
  flow: QuestionFlow;
  onComplete: (answers: { [key: string]: any }) => void;
  onBack?: () => void;
  buyerId?: string; // For TCPA configuration
}

// Inner form component that uses compliance hooks
function DynamicFormInner({ flow, onComplete, onBack, buyerId = 'default', complianceStatus }: DynamicFormProps & { complianceStatus: { trustedForm: ComplianceStatus; jornaya: ComplianceStatus } }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<{ [key: string]: any }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Hooks to get current compliance tokens at submission time
  const { getCertUrl: getTrustedFormCertUrl, getToken: getTrustedFormToken } = useTrustedForm();
  const { getLeadId: getJornayaLeadId } = useJornaya();

  // Capture attribution data once on mount (no race conditions - synchronous capture)
  const [attribution] = useState<AttributionData>(() => {
    if (typeof window !== 'undefined') {
      return getAttributionData();
    }
    return {};
  });

  // TCPA configuration and form validation
  const tcpaConfig = getTCPAConfig(buyerId);
  const { formData, validation, touched, updateField, setFieldTouched, formatPhoneField, isSubmitEnabled } = useFormValidation(tcpaConfig.isRequired);

  // Get valid steps based on current answers
  const getValidSteps = () => {
    return flow.steps.filter(stepId => {
      const question = flow.questions[stepId];
      return shouldShowQuestion(question, answers);
    });
  };

  const validSteps = getValidSteps();
  const currentStepId = validSteps[currentStep];
  const currentQuestion = currentStepId ? flow.questions[currentStepId] : null;
  const totalSteps = validSteps.length;

  const handleAnswer = (questionId: string, value: any) => {
    const newAnswers = { ...answers, [questionId]: value };

    // DEBUG: Log every answer being stored
    console.log('[handleAnswer] DEBUG - Storing answer:', {
      questionId,
      value,
      allAnswersAfterUpdate: newAnswers
    });

    setAnswers(newAnswers);

    // Auto-advance to next step
    const nextStepId = getNextStep(flow, questionId, newAnswers);
    if (nextStepId) {
      const nextIndex = validSteps.indexOf(nextStepId);
      if (nextIndex !== -1) {
        setCurrentStep(nextIndex);
      }
    } else {
      // Last step reached
      if (currentQuestion?.type === 'contact') {
        // Handle completion in contact form
        return;
      } else {
        handleComplete(newAnswers);
      }
    }
  };

  const handleContactSubmit = async () => {
    if (!isSubmitEnabled) return;

    // Create TCPA consent record
    const tcpaConsent: TCPAConsent = createTCPAConsent(
      formData.tcpaConsent,
      buyerId,
      undefined, // IP address would be collected server-side
      navigator.userAgent
    );

    // Extract firstName/lastName from nameInfo if present (for forms with separate name_fields step)
    let nameData = {};
    if (answers.nameInfo && typeof answers.nameInfo === 'object') {
      nameData = {
        firstName: answers.nameInfo.firstName,
        lastName: answers.nameInfo.lastName
      };
    }

    const allAnswers = {
      ...answers,
      ...formData,
      ...nameData,  // Override formData with actual name values from nameInfo step
      tcpaConsent
    };

    // DEBUG: Log submission data
    console.log('[handleContactSubmit] DEBUG - Submission Data:', {
      'answers.nameInfo': answers.nameInfo,
      'formData.firstName': formData.firstName,
      'formData.lastName': formData.lastName,
      'extracted nameData': nameData,
      'final allAnswers': allAnswers,
      'firstName in allAnswers': allAnswers.firstName,
      'lastName in allAnswers': allAnswers.lastName,
    });

    await handleComplete(allAnswers);
  };

  const handleComplete = async (allAnswers: { [key: string]: any }) => {
    // DEBUG: Log what handleComplete receives
    console.log('[handleComplete] DEBUG - Received allAnswers:', {
      firstName: allAnswers.firstName,
      lastName: allAnswers.lastName,
      email: allAnswers.email,
      phone: allAnswers.phone,
      nameInfo: allAnswers.nameInfo,
      allKeys: Object.keys(allAnswers)
    });

    setIsSubmitting(true);
    try {
      // DEBUG: Log what global objects exist for compliance scripts
      console.log('[handleComplete] DEBUG - Global compliance objects:', {
        'window.tf_getCertUrl': typeof (window as any).tf_getCertUrl,
        'window.tf_getToken': typeof (window as any).tf_getToken,
        'window.xxTrustedForm': (window as any).xxTrustedForm,
        'window.LeadId': (window as any).LeadId,
        'window.LeadiD': (window as any).LeadiD,
        'window.leadid_token': (window as any).leadid_token,
        'hidden input xxTrustedFormCertUrl': document.querySelector('input[name="xxTrustedFormCertUrl"]'),
        'hidden input leadid_token': document.querySelector('input[name="leadid_token"]'),
      });

      // Get fresh compliance tokens at submission time
      // These are captured by the TrustedForm and Jornaya scripts loaded on the page
      const trustedFormCertUrl = getTrustedFormCertUrl();
      const trustedFormToken = getTrustedFormToken();
      const jornayaLeadId = getJornayaLeadId();

      // Log compliance status for debugging
      console.log('Compliance tokens at submission:', {
        trustedFormCertUrl: trustedFormCertUrl ? `${trustedFormCertUrl.substring(0, 50)}...` : null,
        trustedFormToken: trustedFormToken ? `${trustedFormToken.substring(0, 20)}...` : null,
        jornayaLeadId: jornayaLeadId ? `${jornayaLeadId.substring(0, 20)}...` : null,
        trustedFormInitialized: complianceStatus.trustedForm.initialized,
        jornayaInitialized: complianceStatus.jornaya.initialized,
      });

      // Include attribution data and compliance tokens with the form answers
      const answersWithCompliance = {
        ...allAnswers,
        attribution,
        // Compliance tokens - these get extracted by the page handler and sent to API
        trustedFormCertUrl,
        trustedFormCertId: trustedFormToken,
        jornayaLeadId,
      };

      // DEBUG: Log final data being sent to page handler
      console.log('[handleComplete] DEBUG - Final data to onComplete:', {
        firstName: (answersWithCompliance as any).firstName,
        lastName: (answersWithCompliance as any).lastName,
        email: (answersWithCompliance as any).email,
        phone: (answersWithCompliance as any).phone,
      });

      await onComplete(answersWithCompliance);
    } catch (error) {
      console.error('Error submitting form:', error);
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    } else if (onBack) {
      onBack();
    }
  };

  if (!currentQuestion) {
    return <div>Loading...</div>;
  }

  const renderQuestion = () => {
    switch (currentQuestion.type) {
      case 'select':
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6">
              {currentQuestion.question}
            </h2>
            <div className="space-y-3">
              {currentQuestion.options?.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleAnswer(currentQuestion.id, option.value)}
                  className="w-full bg-white border-2 border-orange-300 rounded-lg px-6 py-4 text-left hover:bg-orange-50 hover:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-colors"
                >
                  <div className="text-gray-800 font-medium">{option.label}</div>
                </button>
              ))}
            </div>
          </div>
        );

      case 'address':
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6">
              {currentQuestion.question}
            </h2>
            <div className="space-y-4">
              <AddressAutocomplete
                value={
                  answers[currentQuestion.id]
                    ? (typeof answers[currentQuestion.id] === 'string'
                        ? answers[currentQuestion.id]
                        : answers[currentQuestion.id].formattedAddress || answers[currentQuestion.id].address || ''
                      )
                    : ''
                }
                placeholder="Enter your address or ZIP code"
                onAddressSelect={(addressData: AddressSelectData) => {
                  // Store all address components for flexible field mapping
                  // 'address' field stores street for backwards compatibility
                  const storedData = {
                    address: addressData.street,       // Street address (backwards compat)
                    street: addressData.street,        // Explicit street field
                    city: addressData.city,            // City name
                    state: addressData.state,          // State code
                    zipCode: addressData.zipCode,      // ZIP code
                    formattedAddress: addressData.formattedAddress  // Full display
                  };
                  handleAnswer(currentQuestion.id, storedData);
                }}
                onInputChange={(value) => {
                  // Update the display value without triggering submission
                  if (value === '') {
                    const newAnswers = { ...answers };
                    delete newAnswers[currentQuestion.id];
                    setAnswers(newAnswers);
                  }
                }}
                className="text-base"
              />
            </div>
          </div>
        );

      case 'name_fields':
        // Format name: only letters, spaces, hyphens, apostrophes; auto-capitalize first letter
        const formatName = (value: string): string => {
          // Remove any characters that aren't letters, spaces, hyphens, or apostrophes
          const cleaned = value.replace(/[^a-zA-Z\s\-']/g, '');
          // Capitalize first letter of each word (handles hyphenated names like Mary-Jane)
          return cleaned.replace(/\b\w/g, (char) => char.toUpperCase());
        };

        // Block non-letter keys from being typed (numbers, special chars)
        const blockInvalidNameKeys = (e: React.KeyboardEvent<HTMLInputElement>) => {
          const key = e.key;
          // Allow control keys: backspace, delete, arrow keys, tab, etc.
          if (key.length > 1) return;
          // Only allow letters, spaces, hyphens, and apostrophes
          if (!/^[a-zA-Z\s\-']$/.test(key)) {
            e.preventDefault();
          }
        };

        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6">
              {currentQuestion.question}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  First Name *
                </label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => updateField('firstName', formatName(e.target.value))}
                  onKeyDown={blockInvalidNameKeys}
                  onBlur={() => setFieldTouched('firstName')}
                  className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-orange-500 transition-colors ${
                    touched.firstName && validation.firstName.message
                      ? 'border-red-300 focus:border-red-500'
                      : validation.firstName.isValid
                      ? 'border-green-300 focus:border-green-500'
                      : 'border-orange-300 focus:border-orange-500'
                  }`}
                  placeholder="First name"
                />
                {touched.firstName && validation.firstName.message && (
                  <p className="mt-1 text-sm text-red-600">{validation.firstName.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Last Name *
                </label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => updateField('lastName', formatName(e.target.value))}
                  onKeyDown={blockInvalidNameKeys}
                  onBlur={() => setFieldTouched('lastName')}
                  className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-orange-500 transition-colors ${
                    touched.lastName && validation.lastName.message
                      ? 'border-red-300 focus:border-red-500'
                      : validation.lastName.isValid
                      ? 'border-green-300 focus:border-green-500'
                      : 'border-orange-300 focus:border-orange-500'
                  }`}
                  placeholder="Last name"
                />
                {touched.lastName && validation.lastName.message && (
                  <p className="mt-1 text-sm text-red-600">{validation.lastName.message}</p>
                )}
              </div>
            </div>

            <button
              onClick={() => handleAnswer(currentQuestion.id, { firstName: formData.firstName, lastName: formData.lastName })}
              disabled={!validation.firstName.isValid || !validation.lastName.isValid}
              className={`w-full py-3 rounded-lg font-semibold transition-colors ${
                !validation.firstName.isValid || !validation.lastName.isValid
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-orange-500 text-white hover:bg-orange-600'
              }`}
            >
              Continue
            </button>
          </div>
        );

      case 'contact_fields':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6">
              {currentQuestion.question}
            </h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address *
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => updateField('email', e.target.value)}
                onBlur={() => setFieldTouched('email')}
                className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-orange-500 transition-colors ${
                  touched.email && validation.email.message
                    ? 'border-red-300 focus:border-red-500'
                    : validation.email.isValid
                    ? 'border-green-300 focus:border-green-500'
                    : 'border-orange-300 focus:border-orange-500'
                }`}
                placeholder="your@email.com"
              />
              {touched.email && validation.email.message && (
                <p className="mt-1 text-sm text-red-600">{validation.email.message}</p>
              )}
              {validation.email.isValid && (
                <p className="mt-1 text-sm text-green-600">✓ Valid email address</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number *
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => {
                  const formatted = formatPhoneField(e.target.value);
                  updateField('phone', formatted);
                }}
                onBlur={() => setFieldTouched('phone')}
                className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-orange-500 transition-colors ${
                  touched.phone && validation.phone.message
                    ? 'border-red-300 focus:border-red-500'
                    : validation.phone.isValid
                    ? 'border-green-300 focus:border-green-500'
                    : 'border-orange-300 focus:border-orange-500'
                }`}
                placeholder="(555) 123-4567"
              />
              {touched.phone && validation.phone.message && (
                <p className="mt-1 text-sm text-red-600">{validation.phone.message}</p>
              )}
              {validation.phone.isValid && (
                <p className="mt-1 text-sm text-green-600">✓ Valid phone number</p>
              )}
            </div>

            {/* TCPA Checkbox - only shows when contact info is valid */}
            <TCPACheckbox
              config={tcpaConfig}
              isContactValid={validation.isContactInfoValid}
              value={formData.tcpaConsent}
              onChange={(accepted) => updateField('tcpaConsent', accepted)}
              className="mt-6"
            />

            <button
              onClick={handleContactSubmit}
              disabled={isSubmitting || !isSubmitEnabled}
              className={`w-full py-3 rounded-lg font-semibold transition-colors ${
                isSubmitting || !isSubmitEnabled
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-orange-500 text-white hover:bg-orange-600'
              }`}
            >
              {isSubmitting ? 'Submitting...' : 'Get My Quotes'}
            </button>
          </div>
        );

      case 'contact':
        // Format name: only letters, spaces, hyphens, apostrophes; auto-capitalize first letter
        const formatContactName = (value: string): string => {
          const cleaned = value.replace(/[^a-zA-Z\s\-']/g, '');
          return cleaned.replace(/\b\w/g, (char) => char.toUpperCase());
        };

        // Block non-letter keys from being typed (numbers, special chars)
        const blockInvalidContactNameKeys = (e: React.KeyboardEvent<HTMLInputElement>) => {
          const key = e.key;
          if (key.length > 1) return;
          if (!/^[a-zA-Z\s\-']$/.test(key)) {
            e.preventDefault();
          }
        };

        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6">
              {currentQuestion.question}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  First Name *
                </label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => updateField('firstName', formatContactName(e.target.value))}
                  onKeyDown={blockInvalidContactNameKeys}
                  onBlur={() => setFieldTouched('firstName')}
                  className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-orange-500 transition-colors ${
                    touched.firstName && validation.firstName.message
                      ? 'border-red-300 focus:border-red-500'
                      : validation.firstName.isValid
                      ? 'border-green-300 focus:border-green-500'
                      : 'border-orange-300 focus:border-orange-500'
                  }`}
                  placeholder="First name"
                />
                {touched.firstName && validation.firstName.message && (
                  <p className="mt-1 text-sm text-red-600">{validation.firstName.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Last Name *
                </label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => updateField('lastName', formatContactName(e.target.value))}
                  onKeyDown={blockInvalidContactNameKeys}
                  onBlur={() => setFieldTouched('lastName')}
                  className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-orange-500 transition-colors ${
                    touched.lastName && validation.lastName.message
                      ? 'border-red-300 focus:border-red-500'
                      : validation.lastName.isValid
                      ? 'border-green-300 focus:border-green-500'
                      : 'border-orange-300 focus:border-orange-500'
                  }`}
                  placeholder="Last name"
                />
                {touched.lastName && validation.lastName.message && (
                  <p className="mt-1 text-sm text-red-600">{validation.lastName.message}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address *
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => updateField('email', e.target.value)}
                className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-orange-500 transition-colors ${
                  validation.email.message
                    ? 'border-red-300 focus:border-red-500'
                    : validation.email.isValid
                    ? 'border-green-300 focus:border-green-500'
                    : 'border-orange-300 focus:border-orange-500'
                }`}
                placeholder="your@email.com"
              />
              {validation.email.message && (
                <p className="mt-1 text-sm text-red-600">{validation.email.message}</p>
              )}
              {validation.email.isValid && (
                <p className="mt-1 text-sm text-green-600">✓ Valid email address</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number *
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => {
                  const formatted = formatPhoneField(e.target.value);
                  updateField('phone', formatted);
                }}
                className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-orange-500 transition-colors ${
                  validation.phone.message
                    ? 'border-red-300 focus:border-red-500'
                    : validation.phone.isValid
                    ? 'border-green-300 focus:border-green-500'
                    : 'border-orange-300 focus:border-orange-500'
                }`}
                placeholder="(555) 123-4567"
              />
              {validation.phone.message && (
                <p className="mt-1 text-sm text-red-600">{validation.phone.message}</p>
              )}
              {validation.phone.isValid && (
                <p className="mt-1 text-sm text-green-600">✓ Valid phone number</p>
              )}
            </div>

            {/* TCPA Checkbox - only shows when contact info is valid */}
            <TCPACheckbox
              config={tcpaConfig}
              isContactValid={validation.isContactInfoValid}
              value={formData.tcpaConsent}
              onChange={(accepted) => updateField('tcpaConsent', accepted)}
              className="mt-6"
            />

            <button
              onClick={handleContactSubmit}
              disabled={isSubmitting || !isSubmitEnabled}
              className={`w-full py-3 rounded-lg font-semibold transition-colors ${
                isSubmitting || !isSubmitEnabled
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-orange-500 text-white hover:bg-orange-600'
              }`}
            >
              {isSubmitting ? 'Submitting...' : 'Get My Quotes'}
            </button>
          </div>
        );

      default:
        return <div>Unknown question type</div>;
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Form wrapper required for TrustedForm SDK to inject hidden certificate input */}
      <form id="lead-form" onSubmit={(e) => e.preventDefault()}>
        <Header />

        {/* Progress Bar */}
      <div className="bg-gray-100 py-4">
        <div className="max-w-2xl mx-auto px-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">
              Step {currentStep + 1} of {totalSteps}
            </span>
            <span className="text-sm text-gray-500 capitalize">
              {flow.serviceType} Project
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-orange-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Main Form */}
      <div className="py-8">
        <div className="max-w-2xl mx-auto px-4">
          <div className="bg-white rounded-lg shadow-lg p-8">
            {renderQuestion()}

            {/* Back Button - Only show for non-contact questions */}
            {currentQuestion.type !== 'contact' && currentQuestion.type !== 'contact_fields' && (
              <div className="mt-8">
                <button
                  onClick={handleBack}
                  className="flex items-center px-6 py-3 border-2 border-orange-300 rounded-lg text-gray-600 hover:bg-orange-50 hover:border-orange-400 transition-colors"
                >
                  <ChevronLeftIcon className="w-5 h-5 mr-2" />
                  Back
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      </form>
    </div>
  );
}

// Main wrapper component that provides compliance context
export default function DynamicForm({ flow, onComplete, onBack, buyerId = 'default' }: DynamicFormProps) {
  // Track compliance status from providers
  const [complianceStatus, setComplianceStatus] = useState({
    trustedForm: { initialized: false } as ComplianceStatus,
    jornaya: { initialized: false } as ComplianceStatus,
  });

  const handleTrustedFormStatus = useCallback((status: ComplianceStatus) => {
    setComplianceStatus(prev => ({ ...prev, trustedForm: status }));
  }, []);

  const handleJornayaStatus = useCallback((status: ComplianceStatus) => {
    setComplianceStatus(prev => ({ ...prev, jornaya: status }));
  }, []);

  // Handle TrustedForm for SPA navigation
  // TrustedForm SDK scans for forms on load - we need to trigger rescan on navigation
  useEffect(() => {
    // Check if TrustedForm is already fully initialized with a certificate
    const existingInput = document.querySelector('input[name="xxTrustedFormCertUrl"]');
    if (existingInput && (existingInput as HTMLInputElement).value) {
      console.log('[DynamicForm] TrustedForm already has certificate');
      return;
    }

    // Check if TrustedForm global object exists (SDK already loaded)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tfGlobal = (window as any).TrustedForm || (window as any).tf;
    if (tfGlobal) {
      console.log('[DynamicForm] TrustedForm SDK present, triggering rescan...');
      // TrustedForm SDK is loaded - just trigger a form rescan if method available
      if (typeof tfGlobal.scan === 'function') {
        tfGlobal.scan();
      }
      return;
    }

    // Only inject if no TrustedForm script exists at all
    const existingScript = document.querySelector('script[src*="trustedform.js"]');
    if (existingScript) {
      console.log('[DynamicForm] TrustedForm script already present, skipping injection');
      return;
    }

    console.log('[DynamicForm] Injecting TrustedForm script...');

    // Inject fresh TrustedForm script
    const tf = document.createElement('script');
    tf.type = 'text/javascript';
    tf.async = true;
    tf.src = (document.location.protocol === 'https:' ? 'https' : 'http') +
      '://api.trustedform.com/trustedform.js?field=xxTrustedFormCertUrl&use_tagged_consent=true&l=' +
      new Date().getTime() + Math.random();

    const firstScript = document.getElementsByTagName('script')[0];
    if (firstScript && firstScript.parentNode) {
      firstScript.parentNode.insertBefore(tf, firstScript);
    } else {
      document.head.appendChild(tf);
    }

    console.log('[DynamicForm] TrustedForm script injected');
  }, []);

  // TrustedForm configuration - always enabled for lead gen forms
  const trustedFormConfig = {
    enabled: true,
    pingData: true,
    debug: process.env.NODE_ENV === 'development',
  };

  // Jornaya configuration - always enabled for lead gen forms
  const jornayaConfig = {
    enabled: true,
    debug: process.env.NODE_ENV === 'development',
  };

  return (
    <TrustedFormProvider
      config={trustedFormConfig}
      onStatusChange={handleTrustedFormStatus}
    >
      <JornayaProvider
        config={jornayaConfig}
        onStatusChange={handleJornayaStatus}
      >
        <DynamicFormInner
          flow={flow}
          onComplete={onComplete}
          onBack={onBack}
          buyerId={buyerId}
          complianceStatus={complianceStatus}
        />
      </JornayaProvider>
    </TrustedFormProvider>
  );
}