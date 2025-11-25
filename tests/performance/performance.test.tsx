import React from 'react';
import { 
  render,
  createPerformanceTester,
  testMobileResponsiveness,
  mockIntersectionObserver,
  createMockUser
} from '@/utils/testingUtilities';
import { Button } from '@/components/ui/Button';
import { DynamicForm } from '@/components/forms/dynamic/DynamicForm';
import { LazyComponent, withLazyLoading } from '@/components/ui/LazyComponent';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { ResponsiveContainer, useBreakpoint } from '@/components/ui/ResponsiveContainer';

// Mock heavy component for lazy loading tests
const HeavyComponent = React.lazy(() => 
  new Promise(resolve => {
    setTimeout(() => {
      resolve({
        default: () => <div data-testid=\"heavy-component\">Heavy Component Loaded</div>
      });
    }, 100);
  })
);

const LazyHeavyComponent = withLazyLoading(
  () => import('./mockHeavyComponent').catch(() => ({ 
    default: () => <div data-testid=\"heavy-component\">Heavy Component Loaded</div>
  })),
  { skeleton: 'card' }
);

describe('Performance Tests', () => {
  let performanceTester: ReturnType<typeof createPerformanceTester>;

  beforeEach(() => {
    performanceTester = createPerformanceTester();
    mockIntersectionObserver();
  });

  afterEach(() => {
    performanceTester.reset();
  });

  describe('Component Render Performance', () => {
    it('should render Button component quickly', () => {
      performanceTester.startMark('button-render');
      
      render(<Button>Test Button</Button>);
      
      const renderTime = performanceTester.endMark('button-render');
      expect(renderTime).toBeLessThan(16); // 60fps threshold
    });

    it('should render complex forms efficiently', () => {
      const complexFormConfig = {
        id: 'complex-form',
        title: 'Complex Form',
        sections: Array.from({ length: 10 }, (_, i) => ({
          id: `section-${i}`,
          title: `Section ${i + 1}`,
          fields: Array.from({ length: 5 }, (_, j) => ({
            name: `field-${i}-${j}`,
            type: 'text',
            label: `Field ${i + 1}.${j + 1}`,
            required: j % 2 === 0
          }))
        }))
      };

      performanceTester.startMark('complex-form-render');
      
      render(
        <DynamicForm 
          config={complexFormConfig}
          onSubmit={jest.fn()}
        />
      );
      
      const renderTime = performanceTester.endMark('complex-form-render');
      expect(renderTime).toBeLessThan(100); // Complex components should render within 100ms
    });

    it('should handle rapid re-renders efficiently', async () => {
      let rerenderCount = 0;
      const TestComponent = ({ count }: { count: number }) => {
        rerenderCount++;
        return <Button>Count: {count}</Button>;
      };

      const { rerender } = render(<TestComponent count={0} />);
      
      performanceTester.startMark('rapid-rerender');
      
      // Simulate 100 rapid re-renders
      for (let i = 1; i <= 100; i++) {
        rerender(<TestComponent count={i} />);
      }
      
      const rerenderTime = performanceTester.endMark('rapid-rerender');
      
      expect(rerenderCount).toBe(101); // Initial render + 100 re-renders
      expect(rerenderTime).toBeLessThan(1000); // Should complete within 1 second
      expect(rerenderTime / rerenderCount).toBeLessThan(10); // Average render time < 10ms
    });
  });

  describe('Interaction Performance', () => {
    it('should handle button clicks quickly', async () => {
      const user = createMockUser();
      const handleClick = jest.fn();
      
      render(<Button onClick={handleClick}>Click me</Button>);
      const button = document.querySelector('button')!;
      
      performanceTester.startMark('button-click');
      await user.click(button);
      const clickTime = performanceTester.endMark('button-click');
      
      expect(handleClick).toHaveBeenCalled();
      expect(clickTime).toBeLessThan(50); // Click handling should be near-instant
    });

    it('should handle form input changes efficiently', async () => {
      const user = createMockUser();
      const handleChange = jest.fn();
      
      render(
        <input 
          type=\"text\" 
          onChange={handleChange}
          data-testid=\"test-input\"
        />
      );
      
      const input = document.querySelector('input')!;
      
      performanceTester.startMark('input-typing');
      
      // Simulate typing a long string
      await user.type(input, 'This is a long string that simulates user typing');
      
      const typingTime = performanceTester.endMark('input-typing');
      
      expect(typingTime).toBeLessThan(500); // Typing should be responsive
      expect(handleChange).toHaveBeenCalledTimes(47); // One call per character
    });
  });

  describe('Memory Performance', () => {
    it('should not create memory leaks with component mounting/unmounting', () => {
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;
      
      // Mount and unmount components multiple times
      for (let i = 0; i < 100; i++) {
        const { unmount } = render(<Button>Test {i}</Button>);
        unmount();
      }
      
      // Force garbage collection if available
      if ((global as any).gc) {
        (global as any).gc();
      }
      
      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory should not increase significantly (less than 1MB)
      expect(memoryIncrease).toBeLessThan(1024 * 1024);
    });

    it('should clean up event listeners properly', () => {
      const addEventListenerSpy = jest.spyOn(window, 'addEventListener');
      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');
      
      const TestComponent = () => {
        React.useEffect(() => {
          const handler = () => {};
          window.addEventListener('resize', handler);
          return () => window.removeEventListener('resize', handler);
        }, []);
        
        return <div>Test Component</div>;
      };
      
      const { unmount } = render(<TestComponent />);
      
      expect(addEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
      
      unmount();
      
      expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
      
      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });
  });

  describe('Lazy Loading Performance', () => {
    it('should load components only when needed', async () => {
      let componentLoaded = false;
      
      const LazyTestComponent = React.lazy(() => 
        new Promise(resolve => {
          setTimeout(() => {
            componentLoaded = true;
            resolve({
              default: () => <div data-testid=\"lazy-component\">Lazy Component</div>
            });
          }, 50);
        })
      );
      
      render(
        <React.Suspense fallback={<div>Loading...</div>}>
          <LazyTestComponent />
        </React.Suspense>
      );
      
      // Component should not be loaded immediately
      expect(componentLoaded).toBe(false);
      
      // Wait for lazy component to load
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(componentLoaded).toBe(true);
    });

    it('should handle intersection observer lazy loading', () => {
      const mockObserve = jest.fn();
      const mockUnobserve = jest.fn();
      
      (window as any).IntersectionObserver = jest.fn(() => ({
        observe: mockObserve,
        unobserve: mockUnobserve,
        disconnect: jest.fn(),
      }));

      const TestComponent = () => {
        const [isVisible, setIsVisible] = React.useState(false);
        const elementRef = React.useRef<HTMLDivElement>(null);

        React.useEffect(() => {
          const element = elementRef.current;
          if (!element) return;

          const observer = new IntersectionObserver(
            (entries) => {
              entries.forEach(entry => {
                if (entry.isIntersecting) {
                  setIsVisible(true);
                }
              });
            }
          );

          observer.observe(element);
          return () => observer.unobserve(element);
        }, []);

        return (
          <div ref={elementRef}>
            {isVisible ? <div>Content loaded</div> : <div>Loading...</div>}
          </div>
        );
      };

      render(<TestComponent />);
      
      expect(mockObserve).toHaveBeenCalled();
    });
  });

  describe('Mobile Performance', () => {
    it('should be responsive across different screen sizes', () => {
      const { container } = render(
        <ResponsiveContainer maxWidth=\"lg\">
          <div>Responsive content</div>
        </ResponsiveContainer>
      );
      
      const results = testMobileResponsiveness(container);
      
      results.forEach(result => {
        expect(result.isVisible).toBe(true);
        expect(result.hasHorizontalScroll).toBe(false);
        expect(result.componentWidth).toBeLessThanOrEqual(result.width);
      });
    });

    it('should optimize for touch interactions', () => {
      render(<Button>Touch Button</Button>);
      
      const button = document.querySelector('button')!;
      const rect = button.getBoundingClientRect();
      
      // Touch targets should be at least 44px
      expect(rect.height).toBeGreaterThanOrEqual(44);
      expect(rect.width).toBeGreaterThanOrEqual(44);
    });
  });

  describe('Bundle Size Optimization', () => {
    it('should use memoization to prevent unnecessary re-renders', () => {
      let renderCount = 0;
      
      const MemoizedComponent = React.memo(({ value }: { value: string }) => {
        renderCount++;
        return <div>{value}</div>;
      });
      
      const ParentComponent = ({ value }: { value: string }) => (
        <MemoizedComponent value={value} />
      );
      
      const { rerender } = render(<ParentComponent value=\"test\" />);
      
      expect(renderCount).toBe(1);
      
      // Re-render with same props
      rerender(<ParentComponent value=\"test\" />);
      expect(renderCount).toBe(1); // Should not re-render
      
      // Re-render with different props
      rerender(<ParentComponent value=\"different\" />);
      expect(renderCount).toBe(2); // Should re-render
    });

    it('should code-split effectively', async () => {
      const LazyComponentWithSkeleton = withLazyLoading(
        () => Promise.resolve({
          default: () => <div data-testid=\"loaded-component\">Loaded!</div>
        }),
        { skeleton: 'card' }
      );
      
      render(<LazyComponentWithSkeleton />);
      
      // Should show skeleton initially
      expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
      
      // Wait for component to load
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Should show actual component
      expect(document.querySelector('[data-testid=\"loaded-component\"]')).toBeInTheDocument();
    });
  });

  describe('Accessibility Performance', () => {
    it('should not impact performance with accessibility features', () => {
      performanceTester.startMark('accessible-button-render');
      
      render(
        <Button 
          aria-label=\"Accessible button\"
          aria-describedby=\"button-help\"
        >
          Click me
        </Button>
      );
      
      const renderTime = performanceTester.endMark('accessible-button-render');
      
      // Accessibility attributes should not significantly impact performance
      expect(renderTime).toBeLessThan(20);
    });

    it('should handle screen reader announcements efficiently', async () => {
      const TestComponent = () => {
        const [message, setMessage] = React.useState('');
        
        return (
          <div>
            <button onClick={() => setMessage('Button clicked')}>
              Click me
            </button>
            <div aria-live=\"polite\" aria-atomic=\"true\">
              {message}
            </div>
          </div>
        );
      };
      
      const user = createMockUser();
      render(<TestComponent />);
      
      performanceTester.startMark('screen-reader-announcement');
      
      await user.click(document.querySelector('button')!);
      
      const announcementTime = performanceTester.endMark('screen-reader-announcement');
      
      expect(announcementTime).toBeLessThan(50);
      expect(document.querySelector('[aria-live]')).toHaveTextContent('Button clicked');
    });
  });

  describe('Error Boundary Performance', () => {
    it('should handle errors without significant performance impact', () => {
      const ErrorComponent = () => {
        throw new Error('Test error');
      };
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      performanceTester.startMark('error-boundary-render');
      
      render(
        <ErrorBoundary>
          <ErrorComponent />
        </ErrorBoundary>
      );
      
      const renderTime = performanceTester.endMark('error-boundary-render');
      
      expect(renderTime).toBeLessThan(50); // Error handling should be quick
      expect(document.querySelector('[role=\"alert\"]')).toBeInTheDocument();
      
      consoleSpy.mockRestore();
    });
  });
});