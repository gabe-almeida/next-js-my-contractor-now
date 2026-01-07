'use client';

import { useEffect, useState, useCallback } from 'react';
import { ComplianceStatus } from '@/types/forms/index';

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
        // TrustedForm script is loaded globally in layout.tsx on first page load
        // Here we just check if it's ready and get the certificate URL
        console.log('%c📋 TrustedForm: Checking for existing certificate...', 'color: gray;');

        // Check immediately in case script is already loaded
        checkTrustedFormStatus();
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
              console.log('%c✅ TrustedForm INITIALIZED via tf_getCertUrl/tf_getToken', 'color: green; font-weight: bold;');
              console.log('TrustedForm Cert URL:', certUrl);
              console.log('TrustedForm Token:', token.substring(0, 30) + '...');
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
            console.log('%c✅ TrustedForm INITIALIZED via xxTrustedForm object', 'color: green; font-weight: bold;');
            console.log('TrustedForm Cert URL:', window.xxTrustedForm.certUrl);
            console.log('TrustedForm Token:', window.xxTrustedForm.token.substring(0, 30) + '...');
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
      const trustedFormUrl = status.url;
      const pingInterval = setInterval(() => {
        try {
          // Create a hidden iframe to ping TrustedForm
          const iframe = document.createElement('iframe');
          iframe.style.display = 'none';
          iframe.src = trustedFormUrl;
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
      // Method 1: Check for tf_getCertUrl function (some SDK versions)
      if (window.tf_getCertUrl) {
        return window.tf_getCertUrl();
      }
      // Method 2: Check for xxTrustedForm global object
      if (window.xxTrustedForm?.certUrl) {
        return window.xxTrustedForm.certUrl;
      }
      // Method 3: Check for hidden input field created by SDK
      // TrustedForm SDK creates: <input type="hidden" name="xxTrustedFormCertUrl" value="https://cert.trustedform.com/...">
      const hiddenInput = document.querySelector('input[name="xxTrustedFormCertUrl"]') as HTMLInputElement;
      if (hiddenInput?.value) {
        return hiddenInput.value;
      }
      return null;
    } catch (error) {
      console.error('Error getting TrustedForm cert URL:', error);
      return null;
    }
  }, []);

  const getToken = useCallback(() => {
    try {
      // Method 1: Check for tf_getToken function
      if (window.tf_getToken) {
        return window.tf_getToken();
      }
      // Method 2: Check for xxTrustedForm global object
      if (window.xxTrustedForm?.token) {
        return window.xxTrustedForm.token;
      }
      // Method 3: Extract token from cert URL (token is the last part of the URL)
      // Example: https://cert.trustedform.com/abc123def456 -> abc123def456
      const certUrl = document.querySelector('input[name="xxTrustedFormCertUrl"]') as HTMLInputElement;
      if (certUrl?.value) {
        const urlParts = certUrl.value.split('/');
        return urlParts[urlParts.length - 1];
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