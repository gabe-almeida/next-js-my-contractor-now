'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CheckCircleIcon, ClockIcon, PhoneIcon, EnvelopeIcon } from '@heroicons/react/24/outline';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

function ThankYouContent() {
  const searchParams = useSearchParams();
  const leadId = searchParams.get('leadId');
  const [timeRemaining, setTimeRemaining] = useState(30);

  useEffect(() => {
    if (timeRemaining > 0) {
      const timer = setTimeout(() => {
        setTimeRemaining(timeRemaining - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [timeRemaining]);

  return (
    <>
      {/* Main Content */}
      <div className="py-16">
        <div className="max-w-3xl mx-auto px-4 text-center">
          {/* Success Icon */}
          <div className="mb-8 flex justify-center">
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircleIcon className="w-16 h-16 text-green-600" />
            </div>
          </div>

          {/* Success Message */}
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            Thank You!
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Your project request has been successfully submitted
          </p>

          {/* Processing Information */}
          <div className="bg-orange-50 rounded-lg p-8 mb-8">
            <div className="flex items-center justify-center mb-4">
              <ClockIcon className="w-8 h-8 text-orange-600 mr-3" />
              <h2 className="text-2xl font-semibold text-gray-800">
                We're Finding Your Contractors
              </h2>
            </div>

            <p className="text-gray-600 mb-6">
              Our system is currently matching you with qualified contractors in your area.
              You should expect to hear from contractors within the next 24 hours.
            </p>

            {timeRemaining > 0 && (
              <div className="bg-white rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-600">
                  Estimated processing time: <span className="font-semibold text-orange-600">{timeRemaining} seconds</span>
                </p>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div
                    className="bg-orange-500 h-2 rounded-full transition-all duration-1000"
                    style={{ width: `${((30 - timeRemaining) / 30) * 100}%` }}
                  ></div>
                </div>
              </div>
            )}

            {leadId && (
              <div className="text-sm text-gray-500">
                Reference ID: <span className="font-mono">{leadId}</span>
              </div>
            )}
          </div>

          {/* What Happens Next */}
          <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
            <h3 className="text-2xl font-semibold text-gray-800 mb-6">
              What Happens Next?
            </h3>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-white">1</span>
                </div>
                <h4 className="font-semibold text-gray-800 mb-2">Contractor Matching</h4>
                <p className="text-gray-600 text-sm">
                  We match your project with qualified contractors in your area
                </p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-white">2</span>
                </div>
                <h4 className="font-semibold text-gray-800 mb-2">Contact from Pros</h4>
                <p className="text-gray-600 text-sm">
                  Contractors will contact you directly to discuss your project
                </p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-white">3</span>
                </div>
                <h4 className="font-semibold text-gray-800 mb-2">Get Quotes</h4>
                <p className="text-gray-600 text-sm">
                  Compare quotes and choose the best contractor for your project
                </p>
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="bg-gray-50 rounded-lg p-6">
            <h4 className="text-lg font-semibold text-gray-800 mb-4">
              Questions? We're Here to Help
            </h4>

            <div className="flex justify-center space-x-8">
              <div className="flex items-center">
                <PhoneIcon className="w-5 h-5 text-orange-600 mr-2" />
                <span className="text-gray-600">(555) 123-4567</span>
              </div>

              <div className="flex items-center">
                <EnvelopeIcon className="w-5 h-5 text-orange-600 mr-2" />
                <span className="text-gray-600">support@mycontractornow.com</span>
              </div>
            </div>
          </div>

          {/* Return Home Button */}
          <div className="mt-8">
            <a
              href="/"
              className="inline-block bg-orange-500 text-white px-8 py-3 rounded-lg font-semibold hover:bg-orange-600 transition-colors"
            >
              Start Another Project
            </a>
          </div>
        </div>
      </div>
    </>
  );
}

function ThankYouLoading() {
  return (
    <div className="py-16">
      <div className="max-w-3xl mx-auto px-4 text-center">
        <div className="mb-8 flex justify-center">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center animate-pulse">
            <div className="w-16 h-16 bg-gray-200 rounded-full"></div>
          </div>
        </div>
        <div className="h-10 bg-gray-200 rounded w-48 mx-auto mb-4 animate-pulse"></div>
        <div className="h-6 bg-gray-200 rounded w-64 mx-auto animate-pulse"></div>
      </div>
    </div>
  );
}

export default function ThankYouPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header />
      <Suspense fallback={<ThankYouLoading />}>
        <ThankYouContent />
      </Suspense>
      <Footer />
    </div>
  );
}
