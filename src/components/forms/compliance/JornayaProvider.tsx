'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { ComplianceStatus } from '@/types/forms/index';

export interface JornayaConfig {
  enabled: boolean;
  leadid_token?: string;
  trackingUrl?: string;
  debug?: boolean;
}

export interface JornayaProviderProps {
  config: JornayaConfig;
  onStatusChange: (status: ComplianceStatus) => void;
  children: React.ReactNode;
}

declare global {
  interface Window {
    leadid_token?: string;
    LeadId?: {
      getToken: () => string;
      isReady: () => boolean;
    };
    jornaya_config?: {
      pd_url: string;
      cid: string;
    };
  }
}

export function JornayaProvider({
  config,
  onStatusChange,
  children
}: JornayaProviderProps) {
  const [status, setStatus] = useState<ComplianceStatus>({
    initialized: false
  });
  const initAttempted = useRef(false);
  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;

  useEffect(() => {
    // Prevent duplicate initialization
    if (initAttempted.current) return;
    initAttempted.current = true;

    if (!config.enabled) {
      setStatus({ initialized: false, error: 'Jornaya disabled' });
      return;
    }

    const generateSessionToken = () => {
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2);
      return `jny_${timestamp}_${random}`;
    };

    const updateStatus = (newStatus: ComplianceStatus) => {
      setStatus(newStatus);
      onStatusChangeRef.current(newStatus);
    };

    // Set up Jornaya configuration
    if (config.leadid_token) {
      window.leadid_token = config.leadid_token;
    }

    // Check for existing token with retry logic
    let retries = 0;
    const maxRetries = 10;

    const checkStatus = () => {
      // Check for Jornaya LeadId
      if (window.LeadId?.isReady && window.LeadId.isReady()) {
        const token = window.LeadId.getToken();
        if (token) {
          updateStatus({ initialized: true, token });
          return;
        }
      }

      // Check for leadid_token
      if (window.leadid_token) {
        updateStatus({ initialized: true, token: window.leadid_token });
        return;
      }

      retries++;
      if (retries < maxRetries) {
        setTimeout(checkStatus, 500);
      } else {
        // Fallback to session token
        const sessionToken = generateSessionToken();
        updateStatus({
          initialized: true,
          token: sessionToken,
          error: 'Jornaya not loaded, using session token'
        });
      }
    };

    checkStatus();
  }, [config.enabled, config.leadid_token]);

  // Note: Jornaya SDK handles tracking internally via the script loaded in layout.tsx
  // No additional tracking pixel needed - the SDK automatically tracks user interactions
  // and generates the LeadID token which is captured via window.leadid_token

  return (
    <>
      {children}
      {config.debug && (
        <div className="fixed bottom-4 left-4 bg-black bg-opacity-80 text-white p-2 rounded text-xs max-w-xs">
          <div>Jornaya Status:</div>
          <div>Initialized: {status.initialized ? 'Yes' : 'No'}</div>
          {status.token && <div>Token: {status.token.slice(0, 15)}...</div>}
          {status.url && <div>URL: {status.url.slice(0, 30)}...</div>}
          {status.error && <div className="text-yellow-300">Note: {status.error}</div>}
        </div>
      )}
    </>
  );
}

export function useJornaya() {
  const getLeadId = useCallback(() => {
    try {
      console.log('[useJornaya.getLeadId] Checking for Jornaya LeadID...');

      // Method 1: Check for LeadId object (older SDK)
      if (window.LeadId?.getToken) {
        const token = window.LeadId.getToken();
        console.log('[useJornaya.getLeadId] Method 1 (LeadId.getToken):', token);
        if (token) return token;
      }

      // Method 2: Check for LeadiD object (newer SDK - note capital D)
      if ((window as any).LeadiD?.token) {
        console.log('[useJornaya.getLeadId] Method 2 (LeadiD.token):', (window as any).LeadiD.token);
        return (window as any).LeadiD.token;
      }

      // Method 3: Check for leadid_token global variable
      if (window.leadid_token) {
        console.log('[useJornaya.getLeadId] Method 3 (window.leadid_token):', window.leadid_token);
        return window.leadid_token;
      }

      // Method 4: Check for hidden input field (some implementations)
      const hiddenInput = document.querySelector('input[name="leadid_token"]') as HTMLInputElement;
      console.log('[useJornaya.getLeadId] Method 4 (hidden input leadid_token):', hiddenInput?.value || 'NOT FOUND');
      if (hiddenInput?.value) {
        return hiddenInput.value;
      }

      // Method 5: Check for universal_leadid input
      const universalInput = document.querySelector('input[name="universal_leadid"]') as HTMLInputElement;
      console.log('[useJornaya.getLeadId] Method 5 (universal_leadid):', universalInput?.value || 'NOT FOUND');
      if (universalInput?.value) {
        return universalInput.value;
      }

      console.log('[useJornaya.getLeadId] No Jornaya LeadID found via any method');
      return null;
    } catch (error) {
      console.error('Error getting Jornaya LeadId:', error);
      return null;
    }
  }, []);

  const isReady = useCallback(() => {
    try {
      if (window.LeadId?.isReady) {
        return window.LeadId.isReady();
      }
      return !!window.leadid_token;
    } catch (error) {
      return false;
    }
  }, []);

  return {
    getLeadId,
    isReady
  };
}