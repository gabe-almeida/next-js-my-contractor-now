'use client';

import { useState } from 'react';
import Image from 'next/image';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import PortalDropdown from '@/components/ui/PortalDropdown';

// Static service types - no API call needed for homepage
const serviceTypes = [
  { id: 'windows', name: 'Windows' },
  { id: 'roofing', name: 'Roofing' },
  { id: 'bathrooms', name: 'Bathrooms' }
];

export default function HomePage() {
  const [selectedService, setSelectedService] = useState('');

  const handleServiceSelect = (serviceId: string, serviceName: string) => {
    setSelectedService(serviceName);
    // Navigate to the specific service form
    if (serviceId !== 'other') {
      window.location.href = `/${serviceId}`;
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Main Hero Section */}
      <div className="bg-gradient-to-r from-orange-400 to-orange-500 min-h-[600px] flex items-center justify-center relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
          {/* Contractor Mascot */}
          <div className="mb-8 flex justify-center">
            <div className="w-40 h-40 flex items-center justify-center relative z-20">
              <div className="relative w-full h-full">
                <Image
                  src="/assets/my contractor now guy waving with emblem.gif"
                  alt="My Contractor Now Mascot"
                  fill
                  className="object-contain"
                  unoptimized
                />
              </div>
            </div>
          </div>

          {/* Main Heading */}
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            How Much Will Your Project Cost?
          </h1>
          <p className="text-xl text-white mb-12">
            Find a local pro near you!
          </p>

          {/* Main Form Card */}
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-lg mx-auto relative z-[100]">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6">
              What type of project is this?
            </h2>

            {/* Service Type Dropdown - Portal Based */}
            <PortalDropdown
              items={serviceTypes}
              selectedValue={selectedService}
              placeholder="Select your project type"
              onSelect={handleServiceSelect}
            />

            <p className="text-sm text-gray-500 mt-4 text-center">
              Free, no-obligation estimates from local pros.
            </p>
          </div>
        </div>
      </div>

      {/* How It Works Section */}
      <div className="py-16 bg-gray-50 relative z-10">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-800 mb-12">
            How It Works
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-white">1</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">
                Tell us about your project
              </h3>
              <p className="text-gray-600">
                Answer a few questions about your home improvement project
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-white">2</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">
                Get matched with pros
              </h3>
              <p className="text-gray-600">
                We'll connect you with qualified contractors in your area
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-white">3</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">
                Compare quotes
              </h3>
              <p className="text-gray-600">
                Review proposals and choose the best contractor for your project
              </p>
            </div>
          </div>
        </div>
      </div>

      <Footer />
      
      {/* Admin Link (hidden from users) */}
      <div className="fixed bottom-4 right-4">
        <a
          href="/admin"
          className="bg-gray-800 text-white px-3 py-2 rounded text-sm hover:bg-gray-700 transition-colors"
        >
          Admin
        </a>
      </div>
    </div>
  );
}