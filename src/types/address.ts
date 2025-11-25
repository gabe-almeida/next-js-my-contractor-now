// Address-related type definitions

export interface AddressData {
  address: string;
  zipCode?: string;
  city?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
}

export interface RadarAddress {
  formattedAddress: string;
  addressLabel?: string;
  placeLabel?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}

export interface RadarAutocompleteResult {
  address: RadarAddress;
  distance?: number;
  layer?: string;
}

export interface RadarAutocompleteResponse {
  addresses: RadarAutocompleteResult[];
  meta?: {
    code: number;
  };
}