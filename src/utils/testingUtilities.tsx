import React from 'react';
import { render, RenderOptions, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { ToastProvider } from '@/components/ui/Toast';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Custom render function with providers
const AllTheProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <ErrorBoundary>
      <ToastProvider>
        {children}
      </ToastProvider>
    </ErrorBoundary>
  );
};

const customRender = (
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

// Re-export everything
export * from '@testing-library/react';
export { customRender as render };

// Custom testing utilities
export const createMockUser = () => userEvent.setup();

// Accessibility testing utilities
export const testAccessibility = async (component: HTMLElement) => {
  const results = await axe(component);
  expect(results).toHaveNoViolations();
  return results;
};

export const testKeyboardNavigation = async (
  element: HTMLElement,
  expectedFocusableElements?: number
) => {
  const user = createMockUser();
  
  // Test Tab navigation
  await user.tab();
  expect(document.activeElement).toBe(element.querySelector('[tabindex="0"]') || element);
  
  // Test focusable elements if specified
  if (expectedFocusableElements) {
    const focusableElements = element.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    expect(focusableElements).toHaveLength(expectedFocusableElements);
  }
  
  // Test Escape key
  await user.keyboard('{Escape}');
  
  // Test Enter key on focusable elements
  const focusable = element.querySelector('button, a, [role="button"]') as HTMLElement;
  if (focusable) {
    focusable.focus();
    await user.keyboard('{Enter}');
  }
};

export const testScreenReaderSupport = (component: HTMLElement) => {
  // Check for ARIA labels
  const ariaLabels = component.querySelectorAll('[aria-label]');
  const ariaDescribedBy = component.querySelectorAll('[aria-describedby]');
  const roles = component.querySelectorAll('[role]');
  
  return {
    hasAriaLabels: ariaLabels.length > 0,
    hasAriaDescriptions: ariaDescribedBy.length > 0,
    hasRoles: roles.length > 0,
    landmarks: component.querySelectorAll('[role="banner"], [role="main"], [role="navigation"], [role="complementary"], [role="contentinfo"]').length
  };
};

// Performance testing utilities
export class PerformanceTester {
  private marks: Map<string, number> = new Map();
  private measures: Map<string, number> = new Map();

  startMark(name: string) {
    this.marks.set(name, performance.now());
  }

  endMark(name: string): number {
    const startTime = this.marks.get(name);
    if (!startTime) {
      throw new Error(`No start mark found for: ${name}`);
    }
    
    const duration = performance.now() - startTime;
    this.measures.set(name, duration);
    return duration;
  }

  getMeasure(name: string): number | undefined {
    return this.measures.get(name);
  }

  expectRenderTime(componentName: string, maxTime: number = 16) {
    const renderTime = this.getMeasure(`${componentName}-render`);
    expect(renderTime).toBeDefined();
    expect(renderTime!).toBeLessThan(maxTime);
  }

  expectInteractionTime(interactionName: string, maxTime: number = 100) {
    const interactionTime = this.getMeasure(`${interactionName}-interaction`);
    expect(interactionTime).toBeDefined();
    expect(interactionTime!).toBeLessThan(maxTime);
  }

  reset() {
    this.marks.clear();
    this.measures.clear();
  }
}

export const createPerformanceTester = () => new PerformanceTester();

// Form testing utilities
export const testFormAccessibility = async (form: HTMLFormElement) => {
  // Test form accessibility
  await testAccessibility(form);
  
  // Check for proper labeling
  const inputs = form.querySelectorAll('input, select, textarea');
  inputs.forEach(input => {
    const id = input.getAttribute('id');
    const label = form.querySelector(`label[for="${id}"]`);
    const ariaLabel = input.getAttribute('aria-label');
    const ariaLabelledBy = input.getAttribute('aria-labelledby');
    
    expect(label || ariaLabel || ariaLabelledBy).toBeTruthy();
  });
  
  // Check for error message association
  const errorElements = form.querySelectorAll('[role="alert"], .error-message');
  errorElements.forEach(error => {
    const id = error.getAttribute('id');
    if (id) {
      const associatedInput = form.querySelector(`[aria-describedby*="${id}"]`);
      expect(associatedInput).toBeTruthy();
    }
  });
};

export const fillFormField = async (fieldName: string, value: string) => {
  const user = createMockUser();
  const field = screen.getByRole('textbox', { name: new RegExp(fieldName, 'i') });
  await user.clear(field);
  await user.type(field, value);
  return field;
};

export const submitForm = async (form?: HTMLFormElement) => {
  const user = createMockUser();
  const submitButton = form 
    ? form.querySelector('button[type="submit"], input[type="submit"]') as HTMLElement
    : screen.getByRole('button', { name: /submit/i });
  
  await user.click(submitButton);
};

// Mobile testing utilities
export const testMobileResponsiveness = (component: HTMLElement) => {
  // Test common mobile breakpoints
  const breakpoints = [
    { width: 320, height: 568, name: 'iPhone SE' },
    { width: 375, height: 667, name: 'iPhone 8' },
    { width: 414, height: 896, name: 'iPhone 11' },
    { width: 768, height: 1024, name: 'iPad' },
  ];

  const originalViewport = { width: window.innerWidth, height: window.innerHeight };
  
  const results = breakpoints.map(breakpoint => {
    // Mock viewport resize
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: breakpoint.width,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: breakpoint.height,
    });

    // Trigger resize event
    window.dispatchEvent(new Event('resize'));

    // Check if component is still visible and functional
    const isVisible = component.offsetWidth > 0 && component.offsetHeight > 0;
    const hasHorizontalScroll = document.body.scrollWidth > breakpoint.width;

    return {
      breakpoint: breakpoint.name,
      width: breakpoint.width,
      isVisible,
      hasHorizontalScroll,
      componentWidth: component.offsetWidth,
      componentHeight: component.offsetHeight
    };
  });

  // Restore original viewport
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: originalViewport.width,
  });
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: originalViewport.height,
  });

  return results;
};

export const testTouchInteractions = async (element: HTMLElement) => {
  const user = createMockUser();
  
  // Test touch events if supported
  if ('ontouchstart' in window) {
    // Simulate touch tap
    await user.pointer({ keys: '[TouchA]', target: element });
    
    // Test that touch target is large enough (minimum 44px)
    const rect = element.getBoundingClientRect();
    expect(Math.min(rect.width, rect.height)).toBeGreaterThanOrEqual(44);
  }
};

// Error boundary testing utilities
export const testErrorBoundary = (ComponentWithError: React.ComponentType) => {
  // Suppress console.error for this test
  const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  
  render(
    <ErrorBoundary>
      <ComponentWithError />
    </ErrorBoundary>
  );
  
  // Check that error boundary UI is displayed
  expect(screen.getByRole('alert')).toBeInTheDocument();
  expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  
  consoleSpy.mockRestore();
};

// Loading state testing
export const testLoadingStates = async (
  component: React.ReactElement,
  triggerLoading: () => Promise<void>
) => {
  render(component);
  
  // Start loading action
  const loadingPromise = triggerLoading();
  
  // Check loading state appears
  await waitFor(() => {
    expect(screen.getByRole('status') || screen.getByText(/loading/i)).toBeInTheDocument();
  });
  
  // Wait for loading to complete
  await loadingPromise;
  
  // Check loading state disappears
  await waitFor(() => {
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
};

// Custom hooks testing
export const renderHook = <T extends any[], R>(
  hook: (...args: T) => R,
  options?: {
    initialProps?: T;
    wrapper?: React.ComponentType<any>;
  }
) => {
  let result: R;
  const TestComponent = (props: { hookProps: T }) => {
    result = hook(...props.hookProps);
    return null;
  };

  const wrapper = options?.wrapper || React.Fragment;
  const utils = render(
    <TestComponent hookProps={options?.initialProps || ([] as unknown as T)} />,
    { wrapper }
  );

  return {
    result: result!,
    rerender: (newProps: T) => {
      utils.rerender(<TestComponent hookProps={newProps} />);
    },
    unmount: utils.unmount,
  };
};

// Mock implementations for external dependencies
export const mockIntersectionObserver = () => {
  const mockIntersectionObserver = jest.fn();
  mockIntersectionObserver.mockReturnValue({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  });
  
  Object.defineProperty(window, 'IntersectionObserver', {
    writable: true,
    configurable: true,
    value: mockIntersectionObserver,
  });
  
  return mockIntersectionObserver;
};

export const mockResizeObserver = () => {
  const mockResizeObserver = jest.fn();
  mockResizeObserver.mockReturnValue({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  });
  
  Object.defineProperty(window, 'ResizeObserver', {
    writable: true,
    configurable: true,
    value: mockResizeObserver,
  });
  
  return mockResizeObserver;
};

export const mockMatchMedia = (matches: boolean = false) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
};