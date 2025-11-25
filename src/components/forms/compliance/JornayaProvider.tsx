'use client';

import { useEffect, useState, useCallback } from 'react';
import { ComplianceStatus } from '@/types/forms';

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

        // Load Jornaya script if not already loaded
        if (!document.getElementById('jornaya-script')) {
          const script = document.createElement('script');
          script.id = 'jornaya-script';
          script.src = config.trackingUrl || 'https://h.online-metrix.net/fp/tags.js?org_id=1snn5n9w&session_id=session_id';
          script.async = true;
          script.onload = () => {
            setTimeout(() => {
              checkJornayaStatus();
            }, 1000);
          };
          script.onerror = () => {
            updateStatus({
              initialized: false,
              error: 'Failed to load Jornaya script'
            });
          };
          document.head.appendChild(script);
        } else {
          checkJornayaStatus();
        }

        // Alternative: Load Jornaya LeadId script
        if (!document.getElementById('jornaya-leadid-script')) {
          const leadidScript = document.createElement('script');
          leadidScript.id = 'jornaya-leadid-script';
          leadidScript.src = 'https://js.jornayaleadid.com/js/lid.js';
          leadidScript.async = true;
          document.head.appendChild(leadidScript);
        }
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
              updateStatus({
                initialized: true,
                token: token
              });
              return;
            }
          }

          // Check for leadid_token
          if (window.leadid_token) {
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

  // Add invisible tracking pixel for Jornaya
  useEffect(() => {
    if (status.initialized && status.token) {
      const trackingPixel = document.createElement('img');
      trackingPixel.src = `https://leadid.jornayaleadid.com/img.png?jornayanetwork=1&leadid_token=${status.token}`;
      trackingPixel.style.display = 'none';
      trackingPixel.style.width = '1px';
      trackingPixel.style.height = '1px';
      document.body.appendChild(trackingPixel);

      return () => {
        try {
          document.body.removeChild(trackingPixel);
        } catch (error) {
          // Pixel already removed
        }
      };
    }
  }, [status]);

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
      if (window.LeadId?.getToken) {
        return window.LeadId.getToken();
      }
      if (window.leadid_token) {
        return window.leadid_token;
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