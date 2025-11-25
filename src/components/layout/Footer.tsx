'use client';

import Link from 'next/link';
import Image from 'next/image';

export default function Footer() {
  return (
    <footer className="bg-gray-800 text-white py-12">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Company Info */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center space-x-3 mb-4">
              <div className="relative w-8 h-8 flex-shrink-0">
                <Image
                  src="/assets/My-Contractor-Now-Logo-Orange-White.png"
                  alt="My Contractor Now Logo"
                  fill
                  className="object-contain"
                />
              </div>
              <span className="text-xl font-bold">My Contractor Now</span>
            </div>
            <p className="text-gray-300 mb-4 max-w-md">
              Connect with top-rated contractors in your area. Get instant quotes for roofing, windows, HVAC, and more home improvement projects.
            </p>
          </div>


          {/* Legal & Company */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Legal & Info</h3>
            <ul className="space-y-2 text-gray-300">
              <li>
                <Link href="/privacy-policy" className="hover:text-orange-400 transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms-and-conditions" className="hover:text-orange-400 transition-colors">
                  Terms and Conditions
                </Link>
              </li>
              <li>
                <Link href="/home-improvement-companies" className="hover:text-orange-400 transition-colors">
                  Home Improvement Companies
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="border-t border-gray-700 mt-8 pt-8 text-center text-gray-400">
          <p>&copy; 2025 My Contractor Now. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}