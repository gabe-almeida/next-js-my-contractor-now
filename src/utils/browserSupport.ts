'use client';

import React from 'react';

// Browser support detection and polyfills
export class BrowserSupport {
  private static instance: BrowserSupport;
  private features: Map<string, boolean> = new Map();

  private constructor() {
    this.detectFeatures();
  }

  public static getInstance(): BrowserSupport {
    if (!BrowserSupport.instance) {
      BrowserSupport.instance = new BrowserSupport();
    }
    return BrowserSupport.instance;
  }

  private detectFeatures() {
    if (typeof window === 'undefined') return;

    // Core JavaScript features
    this.features.set('es6', this.hasES6Support());
    this.features.set('modules', this.hasModuleSupport());
    this.features.set('promises', typeof Promise !== 'undefined');
    this.features.set('fetch', typeof fetch !== 'undefined');
    this.features.set('formData', typeof FormData !== 'undefined');

    // CSS features
    this.features.set('flexbox', this.hasFlexboxSupport());
    this.features.set('grid', this.hasGridSupport());
    this.features.set('customProperties', this.hasCustomPropertiesSupport());
    this.features.set('intersectionObserver', 'IntersectionObserver' in window);
    this.features.set('mutationObserver', 'MutationObserver' in window);

    // Web APIs
    this.features.set('localStorage', this.hasLocalStorageSupport());
    this.features.set('sessionStorage', this.hasSessionStorageSupport());
    this.features.set('webWorkers', typeof Worker !== 'undefined');
    this.features.set('serviceWorkers', 'serviceWorker' in navigator);
    this.features.set('pushNotifications', 'Notification' in window);

    // Media features
    this.features.set('webp', this.hasWebPSupport());
    this.features.set('avif', this.hasAVIFSupport());
    
    // Touch and input
    this.features.set('touchEvents', 'ontouchstart' in window);
    this.features.set('pointerEvents', 'PointerEvent' in window);
    
    // Accessibility
    this.features.set('mediaQueries', this.hasMediaQuerySupport());
    this.features.set('reducedMotion', this.hasReducedMotionSupport());
    this.features.set('highContrast', this.hasHighContrastSupport());
  }

  // Feature detection methods
  private hasES6Support(): boolean {
    try {
      return typeof Symbol !== 'undefined' && 
             typeof Map !== 'undefined' && 
             typeof Set !== 'undefined';
    } catch {
      return false;
    }
  }

  private hasModuleSupport(): boolean {
    const script = document.createElement('script');
    return 'noModule' in script;
  }

  private hasFlexboxSupport(): boolean {
    const div = document.createElement('div');
    div.style.display = 'flex';
    return div.style.display === 'flex';
  }

  private hasGridSupport(): boolean {
    const div = document.createElement('div');
    div.style.display = 'grid';
    return div.style.display === 'grid';
  }

  private hasCustomPropertiesSupport(): boolean {
    return window.CSS && CSS.supports && CSS.supports('color', 'var(--test)');
  }

  private hasLocalStorageSupport(): boolean {
    try {
      const test = '__localStorage_test__';
      localStorage.setItem(test, 'test');
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  private hasSessionStorageSupport(): boolean {
    try {
      const test = '__sessionStorage_test__';
      sessionStorage.setItem(test, 'test');
      sessionStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  private hasWebPSupport(): boolean {
    const canvas = document.createElement('canvas');
    return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  }

  private hasAVIFSupport(): boolean {
    const canvas = document.createElement('canvas');
    return canvas.toDataURL('image/avif').indexOf('data:image/avif') === 0;
  }

  private hasMediaQuerySupport(): boolean {
    return window.matchMedia && typeof window.matchMedia === 'function';
  }

  private hasReducedMotionSupport(): boolean {
    return this.hasMediaQuerySupport() && 
           window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  private hasHighContrastSupport(): boolean {
    return this.hasMediaQuerySupport() && 
           (window.matchMedia('(prefers-contrast: high)').matches ||
            window.matchMedia('(-ms-high-contrast: active)').matches);
  }

  // Public API
  public supports(feature: string): boolean {
    return this.features.get(feature) ?? false;
  }

  public getBrowserInfo() {
    const ua = navigator.userAgent;
    const browser = this.detectBrowser(ua);
    const version = this.detectVersion(ua, browser);
    
    return {
      browser,
      version,
      isMobile: /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua),
      isTablet: /iPad|Android(?!.*Mobile)/i.test(ua),
      platform: this.detectPlatform(ua),
      supportLevel: this.getSupportLevel()
    };
  }

  private detectBrowser(ua: string): string {
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
    if (ua.includes('Edge')) return 'Edge';
    if (ua.includes('MSIE') || ua.includes('Trident')) return 'IE';
    return 'Unknown';
  }

  private detectVersion(ua: string, browser: string): string {
    const match = ua.match(new RegExp(`${browser}[/\\s]([\\d.]+)`));
    return match ? match[1] : 'Unknown';
  }

  private detectPlatform(ua: string): string {
    if (ua.includes('Windows')) return 'Windows';
    if (ua.includes('Mac OS X')) return 'macOS';
    if (ua.includes('Linux')) return 'Linux';
    if (ua.includes('Android')) return 'Android';
    if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
    return 'Unknown';
  }

  private getSupportLevel(): 'full' | 'partial' | 'basic' {
    const criticalFeatures = ['flexbox', 'promises', 'fetch', 'localStorage'];
    const modernFeatures = ['grid', 'customProperties', 'intersectionObserver', 'es6'];
    
    const criticalSupport = criticalFeatures.every(feature => this.supports(feature));
    const modernSupport = modernFeatures.every(feature => this.supports(feature));
    
    if (!criticalSupport) return 'basic';
    if (!modernSupport) return 'partial';
    return 'full';
  }

  // Polyfill loading
  // Note: These polyfills are optional and only load for legacy browsers
  // Modern browsers (all supported by Next.js) don't need them
  public async loadPolyfills(): Promise<void> {
    const polyfills: Promise<unknown>[] = [];

    // Promise polyfill for IE (not needed for modern browsers)
    if (!this.supports('promises')) {
      // @ts-expect-error - Optional polyfill, may not be installed
      polyfills.push(import('es6-promise').then((module: { polyfill: () => void }) => {
        module.polyfill();
      }).catch(() => console.warn('es6-promise polyfill not available')));
    }

    // Fetch polyfill for IE
    if (!this.supports('fetch')) {
      // @ts-expect-error - Optional polyfill, may not be installed
      polyfills.push(import('whatwg-fetch').catch(() => console.warn('whatwg-fetch polyfill not available')));
    }

    // IntersectionObserver polyfill
    if (!this.supports('intersectionObserver')) {
      // @ts-expect-error - Optional polyfill, may not be installed
      polyfills.push(import('intersection-observer').catch(() => console.warn('intersection-observer polyfill not available')));
    }

    // Custom properties polyfill
    if (!this.supports('customProperties')) {
      polyfills.push(
        // @ts-expect-error - Optional polyfill, may not be installed
        import('css-vars-ponyfill').then((module: { default: () => void }) => {
          module.default();
        }).catch(() => console.warn('css-vars-ponyfill not available'))
      );
    }

    await Promise.all(polyfills);
  }

  // CSS class helpers
  public getBodyClasses(): string[] {
    const classes = [];
    const browserInfo = this.getBrowserInfo();
    
    classes.push(`browser-${browserInfo.browser.toLowerCase()}`);
    classes.push(`platform-${browserInfo.platform.toLowerCase()}`);
    classes.push(`support-${browserInfo.supportLevel}`);
    
    if (browserInfo.isMobile) classes.push('mobile');
    if (browserInfo.isTablet) classes.push('tablet');
    if (this.supports('touchEvents')) classes.push('touch');
    if (this.supports('reducedMotion')) classes.push('reduced-motion');
    if (this.supports('highContrast')) classes.push('high-contrast');
    
    return classes;
  }

  // Progressive enhancement helpers
  public enhanceIfSupported<T>(
    feature: string,
    enhancedComponent: T,
    fallbackComponent: T
  ): T {
    return this.supports(feature) ? enhancedComponent : fallbackComponent;
  }

  public addFallbackStyles(): void {
    if (typeof document === 'undefined') return;

    const style = document.createElement('style');
    style.textContent = `
      /* Flexbox fallbacks */
      .flex-fallback {
        display: table;
        width: 100%;
      }
      .flex-fallback > * {
        display: table-cell;
        vertical-align: top;
      }

      /* Grid fallbacks */
      .grid-fallback {
        overflow: hidden;
      }
      .grid-fallback > * {
        float: left;
        width: 33.33%;
        box-sizing: border-box;
      }

      /* Custom property fallbacks */
      .no-css-custom-properties .theme-aware {
        color: #1f2937;
        background-color: #ffffff;
      }
    `;
    
    document.head.appendChild(style);
  }
}

// Hook for React components
export const useBrowserSupport = () => {
  const [browserSupport] = React.useState(() => BrowserSupport.getInstance());
  
  React.useEffect(() => {
    const classes = browserSupport.getBodyClasses();
    document.body.classList.add(...classes);
    
    browserSupport.addFallbackStyles();
    browserSupport.loadPolyfills().catch(console.error);
    
    return () => {
      document.body.classList.remove(...classes);
    };
  }, [browserSupport]);

  return {
    supports: (feature: string) => browserSupport.supports(feature),
    browserInfo: browserSupport.getBrowserInfo(),
    enhanceIfSupported: browserSupport.enhanceIfSupported.bind(browserSupport)
  };
};

// Export singleton instance
export const browserSupport = BrowserSupport.getInstance();