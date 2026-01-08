'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
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
  const initAttempted = useRef(false);
  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;

  useEffect(() => {
    // Prevent duplicate initialization
    if (initAttempted.current) return;
    initAttempted.current = true;

    if (!config.enabled) {
      setStatus({ initialized: false, error: 'TrustedForm disabled' });
      return;
    }

    const updateStatus = (newStatus: ComplianceStatus) => {
      setStatus(newStatus);
      onStatusChangeRef.current(newStatus);
    };

    // Check for existing certificate with retry logic
    let retries = 0;
    const maxRetries = 10;

    const checkStatus = () => {
      // Check for TrustedForm global functions
      if (window.tf_getCertUrl && window.tf_getToken) {
        const certUrl = window.tf_getCertUrl();
        const token = window.tf_getToken();
        if (certUrl && token) {
          updateStatus({ initialized: true, url: certUrl, token });
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

      // Check for hidden input (SDK creates this)
      const hiddenInput = document.querySelector('input[name="xxTrustedFormCertUrl"]') as HTMLInputElement;
      if (hiddenInput?.value) {
        updateStatus({ initialized: true, url: hiddenInput.value });
        return;
      }

      retries++;
      if (retries < maxRetries) {
        setTimeout(checkStatus, 500);
      } else {
        updateStatus({
          initialized: false,
          error: 'TrustedForm failed to initialize'
        });
      }
    };

    checkStatus();
  }, [config.enabled]);

  // TrustedForm ping functionality (disabled by default)
  useEffect(() => {
    if (!config.pingData || !status.initialized || !status.url) return;

    const pingInterval = setInterval(() => {
      try {
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = status.url!;
        document.body.appendChild(iframe);
        setTimeout(() => document.body.removeChild(iframe), 1000);
      } catch (error) {
        // Silent fail for ping
      }
    }, 30000);

    return () => clearInterval(pingInterval);
  }, [config.pingData, status.initialized, status.url]);

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