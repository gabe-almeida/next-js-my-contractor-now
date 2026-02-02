/**
 * My Contractor Now - Embeddable Call Button Widget
 *
 * WHY: Allow affiliates to embed a call button on their own websites
 *      that displays their tracking number and attributes calls to them.
 *
 * USAGE:
 * <div id="mcn-call-widget"></div>
 * <script src="https://mycontractornow.com/widget/call.js"
 *         data-ref="your-affiliate-code"
 *         data-service="windows"
 *         data-theme="light"
 *         data-size="md"
 *         data-text="Call Now">
 * </script>
 *
 * DATA ATTRIBUTES:
 * - data-ref: (required) Affiliate referral code
 * - data-service: (required) Service type slug (e.g., "windows", "roofing")
 * - data-theme: "light" or "dark" (default: "light")
 * - data-size: "sm", "md", or "lg" (default: "md")
 * - data-text: Custom button text (default: "Call Now")
 * - data-container: Custom container ID (default: "mcn-call-widget")
 */
(function () {
  'use strict';

  // =====================================
  // CONFIGURATION
  // =====================================

  var API_BASE = 'https://mycontractornow.com';
  var WIDGET_VERSION = '1.0.0';

  // Detect if we're in development mode
  if (
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1')
  ) {
    API_BASE = window.location.origin;
  }

  // =====================================
  // STYLES
  // =====================================

  var STYLES = {
    // Base button styles
    base: [
      'display: inline-flex',
      'align-items: center',
      'justify-content: center',
      'gap: 8px',
      'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      'font-weight: 600',
      'text-decoration: none',
      'border-radius: 8px',
      'cursor: pointer',
      'transition: all 0.2s ease',
      'border: none',
      'outline: none',
    ].join(';'),

    // Size variants
    sizes: {
      sm: 'padding: 8px 16px; font-size: 14px;',
      md: 'padding: 12px 24px; font-size: 16px;',
      lg: 'padding: 16px 32px; font-size: 18px;',
    },

    // Theme variants
    themes: {
      light: {
        button:
          'background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; box-shadow: 0 2px 8px rgba(34, 197, 94, 0.3);',
        buttonHover:
          'background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); box-shadow: 0 4px 12px rgba(34, 197, 94, 0.4);',
        container: 'background: white;',
        text: 'color: #374151;',
      },
      dark: {
        button:
          'background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; box-shadow: 0 2px 8px rgba(34, 197, 94, 0.4);',
        buttonHover:
          'background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%); box-shadow: 0 4px 12px rgba(34, 197, 94, 0.5);',
        container: 'background: #1f2937;',
        text: 'color: #f3f4f6;',
      },
    },

    // Loading skeleton
    skeleton: [
      'display: inline-block',
      'width: 150px',
      'height: 44px',
      'background: linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%)',
      'background-size: 200% 100%',
      'animation: mcn-shimmer 1.5s infinite',
      'border-radius: 8px',
    ].join(';'),

    // Phone icon SVG
    phoneIcon:
      '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>',

    // Error icon SVG
    errorIcon:
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>',
  };

  // =====================================
  // UTILITY FUNCTIONS
  // =====================================

  /**
   * Escape HTML to prevent XSS attacks
   * WHY: User-provided content (data-text, API responses) must be escaped before innerHTML insertion
   */
  function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Get the current script element
   */
  function getCurrentScript() {
    // Modern browsers
    if (document.currentScript) {
      return document.currentScript;
    }
    // Fallback for older browsers
    var scripts = document.getElementsByTagName('script');
    for (var i = scripts.length - 1; i >= 0; i--) {
      if (scripts[i].src && scripts[i].src.indexOf('call.js') !== -1) {
        return scripts[i];
      }
    }
    return null;
  }

  /**
   * Get data attributes from script tag
   */
  function getConfig(script) {
    return {
      ref: script.getAttribute('data-ref') || '',
      service: script.getAttribute('data-service') || '',
      theme: script.getAttribute('data-theme') || 'light',
      size: script.getAttribute('data-size') || 'md',
      text: script.getAttribute('data-text') || 'Call Now',
      containerId: script.getAttribute('data-container') || 'mcn-call-widget',
    };
  }

  /**
   * Inject CSS keyframes for animations
   */
  function injectStyles() {
    if (document.getElementById('mcn-widget-styles')) {
      return;
    }

    var style = document.createElement('style');
    style.id = 'mcn-widget-styles';
    style.textContent = [
      '@keyframes mcn-shimmer {',
      '  0% { background-position: -200% 0; }',
      '  100% { background-position: 200% 0; }',
      '}',
      '.mcn-call-button:hover {',
      '  transform: translateY(-1px);',
      '}',
      '.mcn-call-button:active {',
      '  transform: translateY(0);',
      '}',
    ].join('\n');

    document.head.appendChild(style);
  }

  /**
   * Create loading skeleton element
   */
  function createLoadingSkeleton(config) {
    var skeleton = document.createElement('div');
    skeleton.className = 'mcn-loading-skeleton';
    skeleton.style.cssText = STYLES.skeleton;

    // Adjust skeleton size based on config
    if (config.size === 'sm') {
      skeleton.style.width = '120px';
      skeleton.style.height = '36px';
    } else if (config.size === 'lg') {
      skeleton.style.width = '180px';
      skeleton.style.height = '52px';
    }

    return skeleton;
  }

  /**
   * Create call button element
   */
  function createCallButton(config, data) {
    var theme = STYLES.themes[config.theme] || STYLES.themes.light;
    var sizeStyle = STYLES.sizes[config.size] || STYLES.sizes.md;

    var button = document.createElement('a');
    button.className = 'mcn-call-button';
    button.href = 'tel:' + data.phoneNumber;

    button.style.cssText = [STYLES.base, sizeStyle, theme.button].join(';');

    // Build button content (escape user-provided content to prevent XSS)
    var content = STYLES.phoneIcon;
    content += '<span>' + escapeHtml(config.text);

    // Show phone number if available
    if (data.phoneNumberDisplay) {
      content += ' ' + escapeHtml(data.phoneNumberDisplay);
    }

    content += '</span>';

    button.innerHTML = content;

    // Add hover effects
    button.addEventListener('mouseenter', function () {
      this.style.cssText = [STYLES.base, sizeStyle, theme.buttonHover].join(
        ';'
      );
    });

    button.addEventListener('mouseleave', function () {
      this.style.cssText = [STYLES.base, sizeStyle, theme.button].join(';');
    });

    // Track click event (can be extended)
    button.addEventListener('click', function () {
      if (typeof window.mcnWidgetOnClick === 'function') {
        window.mcnWidgetOnClick({
          ref: config.ref,
          service: config.service,
          phoneNumber: data.phoneNumber,
        });
      }
    });

    return button;
  }

  /**
   * Create error message element
   */
  function createErrorMessage(config, message) {
    var theme = STYLES.themes[config.theme] || STYLES.themes.light;

    var container = document.createElement('div');
    container.className = 'mcn-widget-error';
    container.style.cssText = [
      'display: inline-flex',
      'align-items: center',
      'gap: 8px',
      'padding: 12px 16px',
      'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      'font-size: 14px',
      'border-radius: 8px',
      'background: #fef2f2',
      'color: #991b1b',
      'border: 1px solid #fecaca',
    ].join(';');

    container.innerHTML = STYLES.errorIcon + '<span>' + escapeHtml(message) + '</span>';

    return container;
  }

  /**
   * Fetch tracking number from API
   */
  function fetchTrackingNumber(config, callback) {
    var url =
      API_BASE +
      '/api/widget/call?ref=' +
      encodeURIComponent(config.ref) +
      '&service=' +
      encodeURIComponent(config.service);

    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.setRequestHeader('Content-Type', 'application/json');

    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          try {
            var response = JSON.parse(xhr.responseText);
            callback(null, response);
          } catch (e) {
            callback(new Error('Invalid response'));
          }
        } else {
          callback(new Error('Request failed: ' + xhr.status));
        }
      }
    };

    xhr.onerror = function () {
      callback(new Error('Network error'));
    };

    xhr.timeout = 10000; // 10 second timeout
    xhr.ontimeout = function () {
      callback(new Error('Request timeout'));
    };

    xhr.send();
  }

  // =====================================
  // MAIN WIDGET INITIALIZATION
  // =====================================

  function initWidget() {
    var script = getCurrentScript();
    if (!script) {
      console.error('[MCN Widget] Could not find script element');
      return;
    }

    var config = getConfig(script);

    // Validate required parameters
    if (!config.ref) {
      console.error('[MCN Widget] Missing required attribute: data-ref');
      return;
    }

    if (!config.service) {
      console.error('[MCN Widget] Missing required attribute: data-service');
      return;
    }

    // Find or create container
    var container = document.getElementById(config.containerId);
    if (!container) {
      // Create container if it doesn't exist
      container = document.createElement('div');
      container.id = config.containerId;
      script.parentNode.insertBefore(container, script);
    }

    // Inject global styles
    injectStyles();

    // Show loading state
    var loadingSkeleton = createLoadingSkeleton(config);
    container.innerHTML = '';
    container.appendChild(loadingSkeleton);

    // Fetch tracking number
    fetchTrackingNumber(config, function (error, response) {
      container.innerHTML = '';

      if (error) {
        console.error('[MCN Widget] Error:', error.message);
        var errorEl = createErrorMessage(
          config,
          'Unable to load. Please try again.'
        );
        container.appendChild(errorEl);
        return;
      }

      if (!response.success) {
        console.error('[MCN Widget] API Error:', response.error);
        var errorEl = createErrorMessage(
          config,
          response.error || 'Configuration error'
        );
        container.appendChild(errorEl);
        return;
      }

      var data = response.data;

      if (!data.hasNumber) {
        console.warn(
          '[MCN Widget] No tracking number available for this affiliate/service'
        );
        var errorEl = createErrorMessage(
          config,
          'Call service not available'
        );
        container.appendChild(errorEl);
        return;
      }

      // Create and show call button
      var button = createCallButton(config, data);
      container.appendChild(button);

      // Dispatch custom event for integrations
      var event;
      if (typeof CustomEvent === 'function') {
        event = new CustomEvent('mcn-widget-loaded', {
          detail: {
            ref: config.ref,
            service: config.service,
            phoneNumber: data.phoneNumber,
            affiliateName: data.affiliateName,
          },
        });
      } else {
        // IE fallback
        event = document.createEvent('CustomEvent');
        event.initCustomEvent('mcn-widget-loaded', true, true, {
          ref: config.ref,
          service: config.service,
          phoneNumber: data.phoneNumber,
          affiliateName: data.affiliateName,
        });
      }
      document.dispatchEvent(event);
    });
  }

  // =====================================
  // INITIALIZE ON LOAD
  // =====================================

  // Run immediately if DOM is ready, otherwise wait
  if (
    document.readyState === 'complete' ||
    document.readyState === 'interactive'
  ) {
    setTimeout(initWidget, 0);
  } else {
    document.addEventListener('DOMContentLoaded', initWidget);
  }

  // Expose version for debugging
  window.MCN_WIDGET_VERSION = WIDGET_VERSION;
})();
