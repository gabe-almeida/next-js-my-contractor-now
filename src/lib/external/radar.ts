import { RadarValidationResponse } from '@/types/api';
import { AppError } from '@/lib/utils';

export class RadarService {
  private static readonly apiKey = process.env.RADAR_SECRET_KEY;
  private static readonly baseUrl = 'https://api.radar.io/v1';

  static async validateZipCode(zipCode: string): Promise<RadarValidationResponse> {
    if (!this.apiKey) {
      throw new AppError('Radar API key not configured', 'RADAR_NOT_CONFIGURED');
    }

    try {
      const response = await fetch(`${this.baseUrl}/geocode/forward`, {
        method: 'POST',
        headers: {
          'Authorization': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          query: zipCode,
          country: 'US'
        }),
      });

      if (!response.ok) {
        throw new AppError(
          `Radar API error: ${response.status} ${response.statusText}`,
          `RADAR_API_ERROR_${response.status}`
        );
      }

      const data = await response.json();
      
      if (!data.addresses || data.addresses.length === 0) {
        return {
          isValid: false,
        };
      }

      const address = data.addresses[0];
      
      return {
        isValid: true,
        city: address.city,
        state: address.state,
        county: address.county,
        coordinates: address.geometry ? {
          latitude: address.geometry.coordinates[1],
          longitude: address.geometry.coordinates[0],
        } : undefined,
        timezone: address.timezone,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      
      console.error('Radar validation error:', error);
      throw new AppError('Failed to validate ZIP code', 'RADAR_VALIDATION_FAILED');
    }
  }

  static async getLocationDetails(latitude: number, longitude: number) {
    if (!this.apiKey) {
      throw new AppError('Radar API key not configured', 'RADAR_NOT_CONFIGURED');
    }

    try {
      const response = await fetch(`${this.baseUrl}/geocode/reverse`, {
        method: 'POST',
        headers: {
          'Authorization': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          coordinates: [longitude, latitude]
        }),
      });

      if (!response.ok) {
        throw new AppError(
          `Radar API error: ${response.status} ${response.statusText}`,
          `RADAR_API_ERROR_${response.status}`
        );
      }

      const data = await response.json();
      
      return {
        isValid: data.addresses && data.addresses.length > 0,
        address: data.addresses?.[0],
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      
      console.error('Radar reverse geocoding error:', error);
      throw new AppError('Failed to get location details', 'RADAR_GEOCODE_FAILED');
    }
  }

  static async validateAddress(address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  }) {
    if (!this.apiKey) {
      throw new AppError('Radar API key not configured', 'RADAR_NOT_CONFIGURED');
    }

    try {
      const query = `${address.street}, ${address.city}, ${address.state} ${address.zipCode}`;
      
      const response = await fetch(`${this.baseUrl}/geocode/forward`, {
        method: 'POST',
        headers: {
          'Authorization': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          query,
          country: 'US',
          layers: ['address']
        }),
      });

      if (!response.ok) {
        throw new AppError(
          `Radar API error: ${response.status} ${response.statusText}`,
          `RADAR_API_ERROR_${response.status}`
        );
      }

      const data = await response.json();
      
      return {
        isValid: data.addresses && data.addresses.length > 0,
        addresses: data.addresses || [],
        confidence: data.confidence,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      
      console.error('Radar address validation error:', error);
      throw new AppError('Failed to validate address', 'RADAR_ADDRESS_FAILED');
    }
  }
}