'use client';

import { useState, useEffect } from 'react';
import { ChevronLeftIcon } from '@heroicons/react/24/outline';
import { Question, QuestionFlow, getNextStep, shouldShowQuestion } from '@/lib/questions';
import { useFormValidation, ContactFormData } from '@/hooks/useFormValidation';
import { getTCPAConfig, createTCPAConsent, TCPAConsent } from '@/config/tcpa';
import TCPACheckbox from '@/components/forms/compliance/TCPACheckbox';
import AddressAutocomplete from '@/components/forms/inputs/AddressAutocomplete';
import Header from '@/components/layout/Header';
import { getAttributionData, AttributionData } from '@/utils/attribution';

interface DynamicFormProps {
  flow: QuestionFlow;
  onComplete: (answers: { [key: string]: any }) => void;
  onBack?: () => void;
  buyerId?: string; // For TCPA configuration
}

export default function DynamicForm({ flow, onComplete, onBack, buyerId = 'default' }: DynamicFormProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<{ [key: string]: any }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Capture attribution data once on mount (no race conditions - synchronous capture)
  const [attribution] = useState<AttributionData>(() => {
    if (typeof window !== 'undefined') {
      return getAttributionData();
    }
    return {};
  });

  // TCPA configuration and form validation
  const tcpaConfig = getTCPAConfig(buyerId);
  const { formData, validation, updateField, formatPhoneField, isSubmitEnabled } = useFormValidation(tcpaConfig.isRequired);

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

    const allAnswers = {
      ...answers,
      ...formData,
      tcpaConsent
    };
    await handleComplete(allAnswers);
  };

  const handleComplete = async (allAnswers: { [key: string]: any }) => {
    setIsSubmitting(true);
    try {
      // Include attribution data with the form answers
      const answersWithAttribution = {
        ...allAnswers,
        attribution
      };
      await onComplete(answersWithAttribution);
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
                        : answers[currentQuestion.id].address || ''
                      )
                    : ''
                }
                placeholder="Enter your address or ZIP code"
                onAddressSelect={(address, zipCode) => {
                  // Store both the full address and extracted ZIP code
                  const addressData = {
                    address: address,
                    zipCode: zipCode
                  };
                  handleAnswer(currentQuestion.id, addressData);
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
                  onChange={(e) => updateField('firstName', e.target.value)}
                  className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-orange-500 transition-colors ${
                    validation.firstName.message
                      ? 'border-red-300 focus:border-red-500'
                      : validation.firstName.isValid
                      ? 'border-green-300 focus:border-green-500'
                      : 'border-orange-300 focus:border-orange-500'
                  }`}
                  placeholder="First name"
                />
                {validation.firstName.message && (
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
                  onChange={(e) => updateField('lastName', e.target.value)}
                  className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-orange-500 transition-colors ${
                    validation.lastName.message
                      ? 'border-red-300 focus:border-red-500'
                      : validation.lastName.isValid
                      ? 'border-green-300 focus:border-green-500'
                      : 'border-orange-300 focus:border-orange-500'
                  }`}
                  placeholder="Last name"
                />
                {validation.lastName.message && (
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

      case 'contact':
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
                  onChange={(e) => updateField('firstName', e.target.value)}
                  className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-orange-500 transition-colors ${
                    validation.firstName.message
                      ? 'border-red-300 focus:border-red-500'
                      : validation.firstName.isValid
                      ? 'border-green-300 focus:border-green-500'
                      : 'border-orange-300 focus:border-orange-500'
                  }`}
                  placeholder="First name"
                />
                {validation.firstName.message && (
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
                  onChange={(e) => updateField('lastName', e.target.value)}
                  className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-orange-500 transition-colors ${
                    validation.lastName.message
                      ? 'border-red-300 focus:border-red-500'
                      : validation.lastName.isValid
                      ? 'border-green-300 focus:border-green-500'
                      : 'border-orange-300 focus:border-orange-500'
                  }`}
                  placeholder="Last name"
                />
                {validation.lastName.message && (
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
    </div>
  );
}