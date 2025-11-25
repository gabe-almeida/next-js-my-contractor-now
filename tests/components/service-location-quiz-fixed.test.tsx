/**
 * Test file specifically for verifying the fixes to ServiceLocationQuiz
 * This focuses on the service selection state management fixes
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ServiceLocationQuiz from '@/components/contractor-signup/ServiceLocationQuiz';

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

// Mock console.warn to avoid localStorage warnings in tests
const originalConsoleWarn = console.warn;
beforeAll(() => {
  console.warn = jest.fn();
});

afterAll(() => {
  console.warn = originalConsoleWarn;
});

describe('ServiceLocationQuiz - State Management Fixes', () => {
  const mockOnComplete = jest.fn();
  const mockOnStepSave = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
  });

  describe('Service Selection Fixes', () => {
    it('should allow multiple service selection (checkbox behavior)', async () => {
      const user = userEvent.setup();
      render(
        <ServiceLocationQuiz
          onComplete={mockOnComplete}
          onStepSave={mockOnStepSave}
        />
      );

      // Initially no services should be selected
      expect(screen.getByText('Selected: 0 services')).toBeInTheDocument();

      // Find service buttons
      const roofingButton = screen.getByRole('checkbox', { name: /roofing services/i });
      const hvacButton = screen.getByRole('checkbox', { name: /hvac services/i });
      const plumbingButton = screen.getByRole('checkbox', { name: /plumbing services/i });

      // Select first service
      await user.click(roofingButton);
      await waitFor(() => {
        expect(screen.getByText('Selected: 1 service')).toBeInTheDocument();
      });

      // Select second service
      await user.click(hvacButton);
      await waitFor(() => {
        expect(screen.getByText('Selected: 2 services')).toBeInTheDocument();
      });

      // Select third service
      await user.click(plumbingButton);
      await waitFor(() => {
        expect(screen.getByText('Selected: 3 services')).toBeInTheDocument();
      });

      // All services should show as selected
      expect(roofingButton).toHaveAttribute('aria-pressed', 'true');
      expect(hvacButton).toHaveAttribute('aria-pressed', 'true');
      expect(plumbingButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('should update service counter correctly when deselecting', async () => {
      const user = userEvent.setup();
      render(
        <ServiceLocationQuiz
          onComplete={mockOnComplete}
          onStepSave={mockOnStepSave}
        />
      );

      // Select multiple services first
      const roofingButton = screen.getByRole('checkbox', { name: /roofing services/i });
      const hvacButton = screen.getByRole('checkbox', { name: /hvac services/i });

      await user.click(roofingButton);
      await user.click(hvacButton);
      
      await waitFor(() => {
        expect(screen.getByText('Selected: 2 services')).toBeInTheDocument();
      });

      // Deselect one service
      await user.click(roofingButton);
      
      await waitFor(() => {
        expect(screen.getByText('Selected: 1 service')).toBeInTheDocument();
      });

      // Check button states
      expect(roofingButton).toHaveAttribute('aria-pressed', 'false');
      expect(hvacButton).toHaveAttribute('aria-pressed', 'true');

      // Deselect remaining service
      await user.click(hvacButton);
      
      await waitFor(() => {
        expect(screen.getByText('Selected: 0 services')).toBeInTheDocument();
      });

      expect(hvacButton).toHaveAttribute('aria-pressed', 'false');
    });

    it('should enable Next Step button when services are selected', async () => {
      const user = userEvent.setup();
      render(
        <ServiceLocationQuiz
          onComplete={mockOnComplete}
          onStepSave={mockOnStepSave}
        />
      );

      const nextButton = screen.getByRole('button', { name: /next step/i });
      
      // Initially disabled
      expect(nextButton).toBeDisabled();

      // Select a service
      const roofingButton = screen.getByRole('checkbox', { name: /roofing services/i });
      await user.click(roofingButton);

      // Should be enabled now
      await waitFor(() => {
        expect(nextButton).not.toBeDisabled();
      });

      // Deselect the service
      await user.click(roofingButton);

      // Should be disabled again
      await waitFor(() => {
        expect(nextButton).toBeDisabled();
      });
    });

    it('should show proper checkbox visual feedback', async () => {
      const user = userEvent.setup();
      render(
        <ServiceLocationQuiz
          onComplete={mockOnComplete}
          onStepSave={mockOnStepSave}
        />
      );

      const roofingButton = screen.getByRole('checkbox', { name: /roofing services/i });
      
      // Initially unchecked
      expect(roofingButton).toHaveAttribute('aria-pressed', 'false');
      expect(roofingButton).toHaveClass('border-gray-200');

      // Click to select
      await user.click(roofingButton);

      // Should show selected state
      await waitFor(() => {
        expect(roofingButton).toHaveAttribute('aria-pressed', 'true');
        expect(roofingButton).toHaveClass('border-blue-500', 'bg-blue-50');
      });

      // Should show visual checkbox with checkmark
      const checkbox = roofingButton.querySelector('.w-5.h-5.border-2.rounded');
      expect(checkbox).toBeInTheDocument();
      expect(checkbox).toHaveClass('border-blue-500', 'bg-blue-500');
      
      // Should have check icon
      const checkIcon = checkbox?.querySelector('svg');
      expect(checkIcon).toBeInTheDocument();
    });

    it('should persist state to localStorage', async () => {
      const user = userEvent.setup();
      render(
        <ServiceLocationQuiz
          onComplete={mockOnComplete}
          onStepSave={mockOnStepSave}
        />
      );

      // Select a service
      const roofingButton = screen.getByRole('checkbox', { name: /roofing services/i });
      await user.click(roofingButton);

      // Wait for auto-save (debounced)
      await waitFor(
        () => {
          expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
            'service-location-quiz-progress',
            expect.stringContaining('roofing')
          );
        },
        { timeout: 1000 }
      );

      const savedData = JSON.parse(
        mockLocalStorage.setItem.mock.calls[0][1]
      );
      expect(savedData.selectedServices).toHaveLength(1);
      expect(savedData.selectedServices[0].id).toBe('roofing');
      expect(savedData.timestamp).toBeDefined();
    });

    it('should maintain selected services when navigating steps', async () => {
      const user = userEvent.setup();
      render(
        <ServiceLocationQuiz
          onComplete={mockOnComplete}
          onStepSave={mockOnStepSave}
        />
      );

      // Select multiple services
      const roofingButton = screen.getByRole('checkbox', { name: /roofing services/i });
      const hvacButton = screen.getByRole('checkbox', { name: /hvac services/i });
      
      await user.click(roofingButton);
      await user.click(hvacButton);
      
      await waitFor(() => {
        expect(screen.getByText('Selected: 2 services')).toBeInTheDocument();
      });

      // Navigate to next step
      const nextButton = screen.getByRole('button', { name: /next step/i });
      await user.click(nextButton);

      // Should be on location configuration step
      await waitFor(() => {
        expect(screen.getByText('Configure Service Areas')).toBeInTheDocument();
      });

      // Navigate back
      const previousButton = screen.getByRole('button', { name: /previous/i });
      await user.click(previousButton);

      // Should still show selected services
      await waitFor(() => {
        expect(screen.getByText('Selected: 2 services')).toBeInTheDocument();
        expect(roofingButton).toHaveAttribute('aria-pressed', 'true');
        expect(hvacButton).toHaveAttribute('aria-pressed', 'true');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle localStorage errors gracefully', async () => {
      const user = userEvent.setup();
      
      // Mock localStorage.setItem to throw an error
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      render(
        <ServiceLocationQuiz
          onComplete={mockOnComplete}
          onStepSave={mockOnStepSave}
        />
      );

      // Select a service - should not crash despite localStorage error
      const roofingButton = screen.getByRole('checkbox', { name: /roofing services/i });
      await user.click(roofingButton);

      // Should still update the UI correctly
      await waitFor(() => {
        expect(screen.getByText('Selected: 1 service')).toBeInTheDocument();
      });

      // Should have logged a warning
      expect(console.warn).toHaveBeenCalledWith(
        'Failed to save progress to localStorage:',
        expect.any(Error)
      );
    });
  });
});