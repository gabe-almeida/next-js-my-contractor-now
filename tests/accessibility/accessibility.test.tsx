import React from 'react';
import { 
  render, 
  screen, 
  testAccessibility, 
  testKeyboardNavigation,
  testScreenReaderSupport,
  mockMatchMedia,
  createMockUser
} from '@/utils/testingUtilities';
import { Button } from '@/components/ui/Button';
import { AccessibleInput } from '@/components/ui/AccessibleInput';
import { DynamicForm } from '@/components/forms/dynamic/DynamicForm';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import Header from '@/components/layout/Header';

// Mock form config for testing
const mockFormConfig = {
  id: 'test-form',
  title: 'Test Form',
  description: 'A form for testing accessibility',
  sections: [
    {
      id: 'section-1',
      title: 'Personal Information',
      fields: [
        {
          name: 'firstName',
          type: 'text',
          label: 'First Name',
          required: true
        },
        {
          name: 'email',
          type: 'email',
          label: 'Email Address',
          required: true
        }
      ]
    }
  ]
};

beforeAll(() => {
  mockMatchMedia();
});

describe('Accessibility Tests', () => {
  describe('Button Component', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(
        <Button>Click me</Button>
      );
      
      await testAccessibility(container);
    });

    it('should support keyboard navigation', async () => {
      const handleClick = jest.fn();
      render(<Button onClick={handleClick}>Click me</Button>);
      
      const button = screen.getByRole('button', { name: /click me/i });
      await testKeyboardNavigation(button);
      
      // Test Enter key activation
      const user = createMockUser();
      button.focus();
      await user.keyboard('{Enter}');
      expect(handleClick).toHaveBeenCalled();
    });

    it('should have proper ARIA attributes when loading', () => {
      render(<Button loading>Loading...</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(button).toBeDisabled();
    });

    it('should announce loading state to screen readers', () => {
      render(<Button loading loadingText="Processing...">Submit</Button>);
      
      expect(screen.getByText('Processing...')).toBeInTheDocument();
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  describe('AccessibleInput Component', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(
        <AccessibleInput 
          label="Test Input" 
          name="test"
          id="test-input"
        />
      );
      
      await testAccessibility(container);
    });

    it('should properly associate label with input', () => {
      render(
        <AccessibleInput 
          label="Email Address" 
          name="email"
          id="email-input"
          required
        />
      );
      
      const input = screen.getByRole('textbox', { name: /email address/i });
      expect(input).toHaveAttribute('aria-required', 'true');
      
      const label = screen.getByText(/email address/i);
      expect(label).toHaveAttribute('for', 'email-input');
    });

    it('should display error messages with proper ARIA attributes', () => {
      render(
        <AccessibleInput 
          label="Email" 
          name="email"
          id="email-input"
          error="Please enter a valid email address"
        />
      );
      
      const input = screen.getByRole('textbox');
      const errorMessage = screen.getByRole('alert');
      
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAttribute('aria-describedby', 'email-input-error');
      expect(errorMessage).toHaveAttribute('id', 'email-input-error');
      expect(errorMessage).toHaveTextContent('Please enter a valid email address');
    });

    it('should support screen reader navigation', () => {
      const { container } = render(
        <AccessibleInput 
          label="Password" 
          name="password"
          type="password"
          helperText="Must be at least 8 characters"
        />
      );
      
      const screenReaderSupport = testScreenReaderSupport(container);
      expect(screenReaderSupport.hasAriaLabels).toBe(false); // Uses label element instead
      expect(screenReaderSupport.hasAriaDescriptions).toBe(true);
    });
  });

  describe('DynamicForm Component', () => {
    const mockOnSubmit = jest.fn();

    it('should have no accessibility violations', async () => {
      const { container } = render(
        <DynamicForm 
          config={mockFormConfig}
          onSubmit={mockOnSubmit}
        />
      );
      
      await testAccessibility(container);
    });

    it('should have proper form landmarks and structure', () => {
      render(
        <DynamicForm 
          config={mockFormConfig}
          onSubmit={mockOnSubmit}
        />
      );
      
      const form = screen.getByRole('form');
      expect(form).toHaveAttribute('aria-label', mockFormConfig.title);
      expect(form).toHaveAttribute('aria-labelledby', 'form-title');
      expect(form).toHaveAttribute('aria-describedby', 'form-description');
      
      expect(screen.getByRole('heading', { name: mockFormConfig.title })).toBeInTheDocument();
    });

    it('should support keyboard navigation between form fields', async () => {
      render(
        <DynamicForm 
          config={mockFormConfig}
          onSubmit={mockOnSubmit}
        />
      );
      
      const form = screen.getByRole('form');
      await testKeyboardNavigation(form, 3); // 2 inputs + 1 submit button
    });

    it('should announce form validation errors', async () => {
      render(
        <DynamicForm 
          config={mockFormConfig}
          onSubmit={mockOnSubmit}
        />
      );
      
      const user = createMockUser();
      const submitButton = screen.getByRole('button', { name: /submit/i });
      
      // Try to submit without filling required fields
      await user.click(submitButton);
      
      // Check that validation errors are announced
      const errorMessages = screen.getAllByRole('alert');
      expect(errorMessages.length).toBeGreaterThan(0);
    });
  });

  describe('Header Component', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(<Header />);
      await testAccessibility(container);
    });

    it('should have proper landmark roles', () => {
      render(<Header />);
      
      expect(screen.getByRole('banner')).toBeInTheDocument();
      expect(screen.getByLabelText('Site header')).toBeInTheDocument();
    });

    it('should provide skip link for keyboard users', () => {
      render(<Header />);
      
      const skipLink = screen.getByText('Skip to main content');
      expect(skipLink).toHaveAttribute('href', '#main-content');
      expect(skipLink).toHaveClass('sr-only');
    });

    it('should have accessible back button when provided', () => {
      const mockOnBack = jest.fn();
      render(<Header showBackButton onBack={mockOnBack} />);
      
      const backButton = screen.getByRole('button', { name: /go back to previous page/i });
      expect(backButton).toBeInTheDocument();
      expect(backButton).toHaveAttribute('aria-label', 'Go back to previous page');
    });
  });

  describe('ErrorBoundary Component', () => {
    // Component that throws an error for testing
    const ErrorComponent = () => {
      throw new Error('Test error');
    };

    it('should have no accessibility violations in error state', async () => {
      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      const { container } = render(
        <ErrorBoundary>
          <ErrorComponent />
        </ErrorBoundary>
      );
      
      await testAccessibility(container);
      consoleSpy.mockRestore();
    });

    it('should announce errors to screen readers', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      render(
        <ErrorBoundary>
          <ErrorComponent />
        </ErrorBoundary>
      );
      
      const errorAlert = screen.getByRole('alert');
      expect(errorAlert).toHaveAttribute('aria-live', 'assertive');
      expect(errorAlert).toBeInTheDocument();
      
      consoleSpy.mockRestore();
    });
  });

  describe('Focus Management', () => {
    it('should trap focus in modal-like components', async () => {
      // This would be tested with actual modal components
      // For now, testing the concept with a div containing focusable elements
      render(
        <div role="dialog" aria-modal="true">
          <button>First button</button>
          <input type="text" placeholder="Input field" />
          <button>Last button</button>
        </div>
      );

      const dialog = screen.getByRole('dialog');
      await testKeyboardNavigation(dialog, 3);
    });

    it('should restore focus when components unmount', async () => {
      const TestComponent = ({ showModal }: { showModal: boolean }) => (
        <div>
          <button>Trigger</button>
          {showModal && (
            <div role="dialog">
              <button>Modal button</button>
            </div>
          )}
        </div>
      );

      const { rerender } = render(<TestComponent showModal={false} />);
      
      const triggerButton = screen.getByText('Trigger');
      triggerButton.focus();
      
      // Show modal
      rerender(<TestComponent showModal={true} />);
      
      // Hide modal
      rerender(<TestComponent showModal={false} />);
      
      // Focus should return to trigger button
      expect(document.activeElement).toBe(triggerButton);
    });
  });

  describe('Screen Reader Support', () => {
    it('should provide meaningful alternative text for images', () => {
      render(<Header />);
      
      const logo = screen.getByAltText('My Contractor Now Logo');
      expect(logo).toBeInTheDocument();
    });

    it('should use semantic HTML elements appropriately', () => {
      render(
        <div>
          <Header />
          <main>
            <h1>Main Content</h1>
            <nav aria-label="Breadcrumb">
              <ol>
                <li><a href="/">Home</a></li>
                <li>Current Page</li>
              </ol>
            </nav>
          </main>
        </div>
      );
      
      expect(screen.getByRole('banner')).toBeInTheDocument();
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument();
    });

    it('should provide status updates for dynamic content', () => {
      render(
        <div>
          <div aria-live="polite" aria-atomic="true">
            Form saved successfully
          </div>
          <div aria-live="assertive" role="alert">
            Error: Please correct the following fields
          </div>
        </div>
      );
      
      expect(screen.getByText('Form saved successfully')).toHaveAttribute('aria-live', 'polite');
      expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive');
    });
  });

  describe('Mobile Accessibility', () => {
    it('should have touch targets of adequate size', () => {
      render(<Button>Touch me</Button>);
      
      const button = screen.getByRole('button');
      const styles = window.getComputedStyle(button);
      
      // Button should have minimum 44px touch target
      const minSize = 44;
      expect(parseInt(styles.minHeight)).toBeGreaterThanOrEqual(minSize);
      expect(parseInt(styles.minWidth)).toBeGreaterThanOrEqual(minSize);
    });

    it('should work with zoom up to 200%', () => {
      // Mock high zoom level
      Object.defineProperty(window, 'devicePixelRatio', {
        writable: true,
        value: 2
      });

      const { container } = render(<Header />);
      
      // Component should still be functional at high zoom
      expect(container.firstChild).toBeInTheDocument();
      expect(screen.getByAltText('My Contractor Now Logo')).toBeInTheDocument();
    });
  });
});