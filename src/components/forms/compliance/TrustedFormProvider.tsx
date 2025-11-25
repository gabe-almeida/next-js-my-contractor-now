'use client';

import { useEffect, useState, useCallback } from 'react';
import { ComplianceStatus } from '@/types/forms';

export interface TrustedFormConfig {
  enabled: boolean;
  cert_id?: string;
  pingData?: boolean;
  debug?: boolean;
}

export interface TrustedFormProviderProps {
  config: TrustedFormConfig;
  onStatusChange: (status: ComplianceStatus) => void;
  children: React.ReactNode;
}

declare global {
  interface Window {
    xxTrustedForm?: {
      certUrl: string;
      token: string;
      initialize: (config: any) => void;
    };
    tf_getCertUrl?: () => string;
    tf_getToken?: () => string;
  }
}

export function TrustedFormProvider({ 
  config, 
  onStatusChange, 
  children 
}: TrustedFormProviderProps) {
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
        error: 'TrustedForm disabled'
      });
      return;
    }

    const initializeTrustedForm = () => {
      try {
        // Load TrustedForm script if not already loaded
        if (!document.getElementById('trustedform-script')) {
          const script = document.createElement('script');
          script.id = 'trustedform-script';
          script.type = 'text/javascript';
          // Use the official TrustedForm SDK URL with field parameter and consent tracking
          const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
          script.src = `${protocol}://api.trustedform.com/trustedform.js?field=xxTrustedFormCertUrl&use_tagged_consent=true&l=${new Date().getTime()}${Math.random()}`;
          script.async = true;
          script.onload = () => {
            setTimeout(() => {
              checkTrustedFormStatus();
            }, 1000);
          };
          script.onerror = () => {
            updateStatus({
              initialized: false,
              error: 'Failed to load TrustedForm script'
            });
          };
          document.head.appendChild(script);
        } else {
          checkTrustedFormStatus();
        }
      } catch (error) {
        updateStatus({
          initialized: false,
          error: `TrustedForm initialization error: ${error}`
        });
      }
    };

    const checkTrustedFormStatus = () => {
      const maxRetries = 10;
      let retries = 0;

      const checkStatus = () => {
        try {
          // Check for TrustedForm global functions
          if (window.tf_getCertUrl && window.tf_getToken) {
            const certUrl = window.tf_getCertUrl();
            const token = window.tf_getToken();

            if (certUrl && token) {
              updateStatus({
                initialized: true,
                url: certUrl,
                token: token
              });
              return;
            }
          }

          // Alternative check for xxTrustedForm object
          if (window.xxTrustedForm?.certUrl && window.xxTrustedForm?.token) {
            updateStatus({
              initialized: true,
              url: window.xxTrustedForm.certUrl,
              token: window.xxTrustedForm.token
            });
            return;
          }

          retries++;
          if (retries < maxRetries) {
            setTimeout(checkStatus, 500);
          } else {
            updateStatus({
              initialized: false,
              error: 'TrustedForm failed to initialize after retries'
            });
          }
        } catch (error) {
          updateStatus({
            initialized: false,
            error: `TrustedForm status check error: ${error}`
          });
        }
      };

      checkStatus();
    };

    initializeTrustedForm();
  }, [config, updateStatus]);

  // Add TrustedForm ping functionality
  useEffect(() => {
    if (config.pingData && status.initialized && status.url) {
      const pingInterval = setInterval(() => {
        try {
          // Create a hidden iframe to ping TrustedForm
          const iframe = document.createElement('iframe');
          iframe.style.display = 'none';
          iframe.src = status.url;
          document.body.appendChild(iframe);
          
          setTimeout(() => {
            document.body.removeChild(iframe);
          }, 1000);
        } catch (error) {
          console.warn('TrustedForm ping error:', error);
        }
      }, 30000); // Ping every 30 seconds

      return () => clearInterval(pingInterval);
    }
  }, [config.pingData, status]);

  return (
    <>
      {children}
      {config.debug && (
        <div className="fixed bottom-4 right-4 bg-black bg-opacity-80 text-white p-2 rounded text-xs max-w-xs">
          <div>TrustedForm Status:</div>
          <div>Initialized: {status.initialized ? 'Yes' : 'No'}</div>
          {status.token && <div>Token: {status.token.slice(0, 10)}...</div>}
          {status.url && <div>URL: Available</div>}
          {status.error && <div className="text-red-300">Error: {status.error}</div>}
        </div>
      )}
    </>
  );
}

export function useTrustedForm() {
  const getCertUrl = useCallback(() => {
    try {
      if (window.tf_getCertUrl) {
        return window.tf_getCertUrl();
      }
      if (window.xxTrustedForm?.certUrl) {
        return window.xxTrustedForm.certUrl;
      }
      return null;
    } catch (error) {
      console.error('Error getting TrustedForm cert URL:', error);
      return null;
    }
  }, []);

  const getToken = useCallback(() => {
    try {
      if (window.tf_getToken) {
        return window.tf_getToken();
      }
      if (window.xxTrustedForm?.token) {
        return window.xxTrustedForm.token;
      }
      return null;
    } catch (error) {
      console.error('Error getting TrustedForm token:', error);
      return null;
    }
  }, []);

  return {
    getCertUrl,
    getToken
  };
}