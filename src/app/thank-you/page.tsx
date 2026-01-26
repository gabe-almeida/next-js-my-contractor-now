'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CheckCircleIcon } from '@heroicons/react/24/outline';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

function ThankYouContent() {
  const searchParams = useSearchParams();
  const leadId = searchParams.get('leadId');

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

          {/* Next Steps */}
          <div className="bg-orange-50 rounded-lg p-8 mb-8">
            <p className="text-lg text-gray-700 mb-4">
              A contractor will contact you soon to discuss your project.
            </p>

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

            <div className="grid md:grid-cols-2 gap-8 max-w-2xl mx-auto">
              <div className="text-center">
                <div className="w-16 h-16 bg-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-white">1</span>
                </div>
                <h4 className="font-semibold text-gray-800 mb-2">Contractor Contact</h4>
                <p className="text-gray-600 text-sm">
                  A contractor will reach out to discuss your project details
                </p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-white">2</span>
                </div>
                <h4 className="font-semibold text-gray-800 mb-2">Get Your Quote</h4>
                <p className="text-gray-600 text-sm">
                  Receive a quote and schedule your project
                </p>
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
