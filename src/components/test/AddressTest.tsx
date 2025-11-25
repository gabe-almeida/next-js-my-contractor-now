'use client';

import { useState } from 'react';
import AddressAutocomplete from '@/components/forms/inputs/AddressAutocomplete';

export default function AddressTest() {
  const [selectedAddress, setSelectedAddress] = useState<string>('');
  const [zipCode, setZipCode] = useState<string>('');
  const [inputValue, setInputValue] = useState<string>('');

  const handleAddressSelect = (address: string, zip?: string) => {
    setSelectedAddress(address);
    setZipCode(zip || '');
    console.log('Address selected:', { address, zip });
  };

  const handleInputChange = (value: string) => {
    setInputValue(value);
    console.log('Input changed:', value);
  };

  return (
    <div className="max-w-2xl mx-auto p-8 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">
        Address Autocomplete Test
      </h2>
      
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Test Address Input
          </label>
          <AddressAutocomplete
            value={inputValue}
            placeholder="Enter your address or ZIP code"
            onAddressSelect={handleAddressSelect}
            onInputChange={handleInputChange}
          />
        </div>

        {/* Results Display */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Results:</h3>
          
          <div className="space-y-2">
            <div>
              <span className="font-medium text-gray-600">Current Input:</span>
              <span className="ml-2 text-gray-800">{inputValue || 'None'}</span>
            </div>
            
            <div>
              <span className="font-medium text-gray-600">Selected Address:</span>
              <span className="ml-2 text-gray-800">{selectedAddress || 'None'}</span>
            </div>
            
            <div>
              <span className="font-medium text-gray-600">ZIP Code:</span>
              <span className="ml-2 text-gray-800">{zipCode || 'None'}</span>
            </div>
          </div>
        </div>

        {/* Test Instructions */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-blue-800 mb-3">Test Instructions:</h3>
          <ul className="space-y-1 text-sm text-blue-700">
            <li>• Try typing "1600 Pennsylvania Avenue"</li>
            <li>• Test ZIP codes like "90210" or "10001"</li>
            <li>• Use arrow keys to navigate suggestions</li>
            <li>• Press Enter to select an address</li>
            <li>• Test with and without internet connectivity</li>
          </ul>
        </div>
      </div>
    </div>
  );
}