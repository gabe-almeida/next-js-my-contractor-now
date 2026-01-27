'use client';

/**
 * HomeHero - Interactive hero section with service selector
 *
 * WHY: Handles client-side interactivity for service selection dropdown
 * WHEN: Rendered within the server-side home page
 * HOW: Receives pre-fetched service types as props, handles navigation on selection
 *
 * NOTE: This is the only client component on the home page.
 * All data is fetched server-side and passed as props.
 */

import { useState } from 'react';
import Image from 'next/image';
import PortalDropdown from '@/components/ui/PortalDropdown';
import { usePageTracking } from '@/hooks/usePageTracking';

interface ServiceType {
  id: string;
  name: string;
}

interface HomeHeroProps {
  serviceTypes: ServiceType[];
}

export default function HomeHero({ serviceTypes }: HomeHeroProps) {
  const [selectedService, setSelectedService] = useState('');

  // Track page view for analytics
  usePageTracking({ pageType: 'HOME', pagePath: '/' });

  const handleServiceSelect = (serviceId: string, serviceName: string) => {
    setSelectedService(serviceName);
    // Navigate to the specific service form at /services/[slug]
    if (serviceId !== 'other') {
      window.location.href = `/services/${serviceId}`;
    }
  };

  return (
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
  );
}
