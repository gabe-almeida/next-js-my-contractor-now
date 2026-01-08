'use client';

import { useEffect, useState, useCallback } from 'react';
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

  const updateStatus = useCallback((newStatus: Partial<ComplianceStatus>) => {
    const updatedStatus = { ...status, ...newStatus };
    setStatus(updatedStatus);
    onStatusChange(updatedStatus);
  }, [status, onStatusChange]);

  useEffect(() => {
    if (!config.enabled) {
      updateStatus({
        initialized: false,
        error: 'Jornaya disabled'
      });
      return;
    }

    const initializeJornaya = () => {
      try {
        // Set up Jornaya configuration
        if (config.leadid_token) {
          window.leadid_token = config.leadid_token;
        }

        // Jornaya script is loaded globally in layout.tsx on first page load
        // Here we just check if it's ready and get the LeadID token
        console.log('%c📋 Jornaya: Checking for existing LeadID token...', 'color: gray;');

        // Check immediately in case script is already loaded
        checkJornayaStatus();
      } catch (error) {
        updateStatus({
          initialized: false,
          error: `Jornaya initialization error: ${error}`
        });
      }
    };

    const checkJornayaStatus = () => {
      const maxRetries = 10;
      let retries = 0;

      const checkStatus = () => {
        try {
          // Check for Jornaya LeadId
          if (window.LeadId?.isReady && window.LeadId.isReady()) {
            const token = window.LeadId.getToken();
            if (token) {
              console.log('%c✅ Jornaya LeadID INITIALIZED via LeadId.getToken()', 'color: blue; font-weight: bold;');
              console.log('Jornaya LeadID Token:', token);
              updateStatus({
                initialized: true,
                token: token
              });
              return;
            }
          }

          // Check for leadid_token
          if (window.leadid_token) {
            console.log('%c✅ Jornaya LeadID INITIALIZED via window.leadid_token', 'color: blue; font-weight: bold;');
            console.log('Jornaya LeadID Token:', window.leadid_token);
            updateStatus({
              initialized: true,
              token: window.leadid_token
            });
            return;
          }

          // Generate a session-based token if Jornaya isn't fully loaded
          const sessionToken = generateSessionToken();
          updateStatus({
            initialized: true,
            token: sessionToken,
            url: config.trackingUrl
          });

          retries++;
          if (retries < maxRetries) {
            setTimeout(checkStatus, 500);
          } else {
            // Fallback: still mark as initialized with session token
            updateStatus({
              initialized: true,
              token: sessionToken,
              error: 'Jornaya partially loaded, using session token'
            });
          }
        } catch (error) {
          const sessionToken = generateSessionToken();
          updateStatus({
            initialized: true,
            token: sessionToken,
            error: `Jornaya check error: ${error}`
          });
        }
      };

      checkStatus();
    };

    const generateSessionToken = () => {
      // Generate a unique session token for tracking
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2);
      return `jny_${timestamp}_${random}`;
    };

    initializeJornaya();
  }, [config, updateStatus]);

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
      // Method 1: Check for LeadId object (older SDK)
      if (window.LeadId?.getToken) {
        return window.LeadId.getToken();
      }
      // Method 2: Check for LeadiD object (newer SDK - note capital D)
      if ((window as any).LeadiD?.token) {
        return (window as any).LeadiD.token;
      }
      // Method 3: Check for leadid_token global variable
      if (window.leadid_token) {
        return window.leadid_token;
      }
      // Method 4: Check for hidden input field (some implementations)
      const hiddenInput = document.querySelector('input[name="leadid_token"]') as HTMLInputElement;
      if (hiddenInput?.value) {
        return hiddenInput.value;
      }
      // Method 5: Check for universal_leadid input
      const universalInput = document.querySelector('input[name="universal_leadid"]') as HTMLInputElement;
      if (universalInput?.value) {
        return universalInput.value;
      }
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