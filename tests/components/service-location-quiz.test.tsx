import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
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

// Mock service and location data for testing
const mockService = {
  id: 'roofing',
  name: 'roofing',
  displayName: 'Roofing Services',
  category: 'construction' as const,
  description: 'Roof repair, replacement, installation, and maintenance',
  icon: '🏠'
};

const mockLocation = {
  id: 'CA',
  type: 'state' as const,
  name: 'California',
  displayName: 'California',
  coordinates: [36.7783, -119.4179] as [number, number]
};

const mockServiceLocationMapping = {
  serviceId: 'roofing',
  locations: {
    states: [mockLocation],
    cities: [],
    counties: [],
    zipCodes: []
  }
};

describe('ServiceLocationQuiz', () => {
  const mockOnComplete = jest.fn();
  const mockOnStepSave = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
  });

  describe('Service Selection Step', () => {
    it('renders service selection step initially', () => {
      render(
        <ServiceLocationQuiz
          onComplete={mockOnComplete}
          onStepSave={mockOnStepSave}
        />
      );

      expect(screen.getByText('Select Your Services')).toBeInTheDocument();
      expect(screen.getByText('Choose the services you want to offer to customers')).toBeInTheDocument();
      expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
    });

    it('displays available service types', () => {
      render(
        <ServiceLocationQuiz
          onComplete={mockOnComplete}
          onStepSave={mockOnStepSave}
        />
      );

      expect(screen.getByText('Roofing Services')).toBeInTheDocument();
      expect(screen.getByText('HVAC Services')).toBeInTheDocument();
      expect(screen.getByText('Plumbing Services')).toBeInTheDocument();
      expect(screen.getByText('Window Services')).toBeInTheDocument();
    });

    it('allows service selection and deselection', async () => {
      const user = userEvent.setup();
      render(
        <ServiceLocationQuiz
          onComplete={mockOnComplete}
          onStepSave={mockOnStepSave}
        />
      );

      // Find and click roofing service
      const roofingButton = screen.getByText('Roofing Services').closest('button');
      await user.click(roofingButton!);

      // Check if selected counter updates
      await waitFor(() => {
        expect(screen.getByText('Selected: 1 service')).toBeInTheDocument();
      });

      // Check if visual indicator appears
      const checkIcon = screen.getByRole('button', { name: /roofing services/i }).querySelector('svg');
      expect(checkIcon).toBeInTheDocument();

      // Deselect the service
      await user.click(roofingButton!);

      await waitFor(() => {
        expect(screen.getByText('Selected: 0 services')).toBeInTheDocument();
      });
    });

    it('enables next button when at least one service is selected', async () => {
      const user = userEvent.setup();
      render(
        <ServiceLocationQuiz
          onComplete={mockOnComplete}
          onStepSave={mockOnStepSave}
        />
      );

      const nextButton = screen.getByText('Next Step');
      expect(nextButton).toBeDisabled();

      // Select a service
      const roofingButton = screen.getByText('Roofing Services').closest('button');
      await user.click(roofingButton!);

      await waitFor(() => {
        expect(nextButton).not.toBeDisabled();
      });
    });

    it('shows service categories correctly', () => {
      render(
        <ServiceLocationQuiz
          onComplete={mockOnComplete}
          onStepSave={mockOnStepSave}
        />
      );

      // Check for category badges
      expect(screen.getByText('construction')).toBeInTheDocument();
      expect(screen.getByText('installation')).toBeInTheDocument();
      expect(screen.getByText('repair')).toBeInTheDocument();
      expect(screen.getByText('maintenance')).toBeInTheDocument();
    });
  });

  describe('Location Configuration Step', () => {
    it('advances to location configuration after service selection', async () => {
      const user = userEvent.setup();
      render(
        <ServiceLocationQuiz
          onComplete={mockOnComplete}
          onStepSave={mockOnStepSave}
        />
      );

      // Select a service
      const roofingButton = screen.getByText('Roofing Services').closest('button');
      await user.click(roofingButton!);

      // Go to next step
      const nextButton = screen.getByText('Next Step');
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText('Configure Service Areas')).toBeInTheDocument();
        expect(screen.getByText('Service 1 of 1')).toBeInTheDocument();
        expect(screen.getByText('🏠')).toBeInTheDocument(); // Service icon
        expect(screen.getByText('Roofing Services')).toBeInTheDocument();
      });
    });

    it('allows searching for locations', async () => {
      const user = userEvent.setup();
      
      // Start with service already selected
      const initialData = {
        selectedServices: [mockService],
        serviceLocationMappings: []
      };

      render(
        <ServiceLocationQuiz
          onComplete={mockOnComplete}
          onStepSave={mockOnStepSave}
          initialData={initialData}
        />
      );

      // Should start on location configuration
      const nextButton = screen.getByText('Next Step');
      await user.click(nextButton);

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(/search for states/i);
        expect(searchInput).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search for states/i);
      await user.type(searchInput, 'California');

      await waitFor(() => {
        expect(screen.getByText('California')).toBeInTheDocument();
      });
    });

    it('handles location selection for current service', async () => {
      const user = userEvent.setup();
      
      const initialData = {
        selectedServices: [mockService],
        serviceLocationMappings: []
      };

      render(
        <ServiceLocationQuiz
          onComplete={mockOnComplete}
          onStepSave={mockOnStepSave}
          initialData={initialData}
        />
      );

      // Navigate to location configuration
      const nextButton = screen.getByText('Next Step');
      await user.click(nextButton);

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(/search for states/i);
        user.type(searchInput, 'California');
      });

      // Wait for and click on California option
      await waitFor(() => {
        const californiaOption = screen.getByText('California');
        user.click(californiaOption);
      });

      // Check if location was added
      await waitFor(() => {
        expect(screen.getByText('Locations for Roofing Services')).toBeInTheDocument();
      });
    });

    it('shows location type filters', async () => {
      const user = userEvent.setup();
      
      const initialData = {
        selectedServices: [mockService],
        serviceLocationMappings: []
      };

      render(
        <ServiceLocationQuiz
          onComplete={mockOnComplete}
          onStepSave={mockOnStepSave}
          initialData={initialData}
        />
      );

      // Navigate to location configuration
      const nextButton = screen.getByText('Next Step');
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText('All Types')).toBeInTheDocument();
        expect(screen.getByText('states')).toBeInTheDocument();
        expect(screen.getByText('cities')).toBeInTheDocument();
        expect(screen.getByText('counties')).toBeInTheDocument();
        expect(screen.getByText('ZIP Codes')).toBeInTheDocument();
      });
    });

    it('navigates between multiple services', async () => {
      const user = userEvent.setup();
      
      const hvacService = {
        id: 'hvac',
        name: 'hvac',
        displayName: 'HVAC Services',
        category: 'installation' as const,
        description: 'Heating, ventilation, and air conditioning',
        icon: '❄️'
      };

      const initialData = {
        selectedServices: [mockService, hvacService],
        serviceLocationMappings: []
      };

      render(
        <ServiceLocationQuiz
          onComplete={mockOnComplete}
          onStepSave={mockOnStepSave}
          initialData={initialData}
        />
      );

      // Navigate to location configuration
      const nextButton = screen.getByText('Next Step');
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText('Service 1 of 2')).toBeInTheDocument();
        expect(screen.getByText('Roofing Services')).toBeInTheDocument();
      });

      // Navigate to next service
      const nextServiceButton = screen.getByText('Next Service');
      await user.click(nextServiceButton);

      await waitFor(() => {
        expect(screen.getByText('Service 2 of 2')).toBeInTheDocument();
        expect(screen.getByText('HVAC Services')).toBeInTheDocument();
      });

      // Navigate back
      const previousServiceButton = screen.getByText('Previous Service');
      await user.click(previousServiceButton);

      await waitFor(() => {
        expect(screen.getByText('Service 1 of 2')).toBeInTheDocument();
        expect(screen.getByText('Roofing Services')).toBeInTheDocument();
      });
    });

    it('removes selected locations', async () => {
      const user = userEvent.setup();
      
      const initialData = {
        selectedServices: [mockService],
        serviceLocationMappings: [mockServiceLocationMapping]
      };

      render(
        <ServiceLocationQuiz
          onComplete={mockOnComplete}
          onStepSave={mockOnStepSave}
          initialData={initialData}
        />
      );

      // Navigate to location configuration
      const nextButton = screen.getByText('Next Step');
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText('Locations for Roofing Services')).toBeInTheDocument();
        expect(screen.getByText('California')).toBeInTheDocument();
      });

      // Find and click remove button
      const removeButton = screen.getByRole('button', { name: '' }); // X button
      await user.click(removeButton);

      // Location should be removed
      await waitFor(() => {
        expect(screen.queryByText('Locations for Roofing Services')).not.toBeInTheDocument();
      });
    });
  });

  describe('Review Step', () => {
    it('shows review step with complete configuration', async () => {
      const user = userEvent.setup();
      
      const initialData = {
        selectedServices: [mockService],
        serviceLocationMappings: [mockServiceLocationMapping]
      };

      render(
        <ServiceLocationQuiz
          onComplete={mockOnComplete}
          onStepSave={mockOnStepSave}
          initialData={initialData}
        />
      );

      // Navigate through steps
      let nextButton = screen.getByText('Next Step');
      await user.click(nextButton); // Go to location configuration

      await waitFor(() => {
        nextButton = screen.getByText('Next Step');
      });
      
      await user.click(nextButton); // Go to review

      await waitFor(() => {
        expect(screen.getByText('Review & Confirm')).toBeInTheDocument();
        expect(screen.getByText('🏠')).toBeInTheDocument();
        expect(screen.getByText('Roofing Services')).toBeInTheDocument();
        expect(screen.getByText('1 locations configured')).toBeInTheDocument();
      });
    });

    it('completes quiz from review step', async () => {
      const user = userEvent.setup();
      
      const initialData = {
        selectedServices: [mockService],
        serviceLocationMappings: [mockServiceLocationMapping]
      };

      render(
        <ServiceLocationQuiz
          onComplete={mockOnComplete}
          onStepSave={mockOnStepSave}
          initialData={initialData}
        />
      );

      // Navigate to review step
      let nextButton = screen.getByText('Next Step');
      await user.click(nextButton); // Location configuration
      
      await waitFor(() => {
        nextButton = screen.getByText('Next Step');
      });
      
      await user.click(nextButton); // Review

      await waitFor(() => {
        const completeButton = screen.getByText('Complete Setup');
        expect(completeButton).toBeInTheDocument();
        user.click(completeButton);
      });

      expect(mockOnComplete).toHaveBeenCalledWith({
        selectedServices: [mockService],
        serviceLocationMappings: [mockServiceLocationMapping]
      });
    });
  });

  describe('Progress and Navigation', () => {
    it('shows correct progress percentage', () => {
      render(
        <ServiceLocationQuiz
          onComplete={mockOnComplete}
          onStepSave={mockOnStepSave}
        />
      );

      expect(screen.getByText('0% Complete')).toBeInTheDocument();
    });

    it('updates progress with service selection', async () => {
      const user = userEvent.setup();
      render(
        <ServiceLocationQuiz
          onComplete={mockOnComplete}
          onStepSave={mockOnStepSave}
        />
      );

      // Select a service
      const roofingButton = screen.getByText('Roofing Services').closest('button');
      await user.click(roofingButton!);

      await waitFor(() => {
        expect(screen.getByText('33% Complete')).toBeInTheDocument();
      });
    });

    it('prevents navigation without meeting requirements', () => {
      render(
        <ServiceLocationQuiz
          onComplete={mockOnComplete}
          onStepSave={mockOnStepSave}
        />
      );

      const nextButton = screen.getByText('Next Step');
      expect(nextButton).toBeDisabled();
    });

    it('allows navigation back to previous steps', async () => {
      const user = userEvent.setup();
      
      const initialData = {
        selectedServices: [mockService],
        serviceLocationMappings: []
      };

      render(
        <ServiceLocationQuiz
          onComplete={mockOnComplete}
          onStepSave={mockOnStepSave}
          initialData={initialData}
        />
      );

      // Go to next step
      const nextButton = screen.getByText('Next Step');
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText('Configure Service Areas')).toBeInTheDocument();
      });

      // Go back
      const previousButton = screen.getByText('Previous');
      await user.click(previousButton);

      await waitFor(() => {
        expect(screen.getByText('Select Your Services')).toBeInTheDocument();
      });
    });
  });

  describe('Data Persistence', () => {
    it('saves progress to localStorage', async () => {
      const user = userEvent.setup();
      render(
        <ServiceLocationQuiz
          onComplete={mockOnComplete}
          onStepSave={mockOnStepSave}
        />
      );

      // Select a service
      const roofingButton = screen.getByText('Roofing Services').closest('button');
      await user.click(roofingButton!);

      // Navigate to next step to trigger save
      const nextButton = screen.getByText('Next Step');
      await user.click(nextButton);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'service-location-quiz-progress',
        expect.stringContaining('roofing')
      );
    });

    it('restores progress from localStorage', () => {
      const savedData = JSON.stringify({
        selectedServices: [mockService],
        serviceLocationMappings: [mockServiceLocationMapping],
        currentStepIndex: 1,
        currentServiceIndex: 0
      });
      
      mockLocalStorage.getItem.mockReturnValue(savedData);

      render(
        <ServiceLocationQuiz
          onComplete={mockOnComplete}
          onStepSave={mockOnStepSave}
        />
      );

      // Should restore to location configuration step
      expect(screen.getByText('Configure Service Areas')).toBeInTheDocument();
    });

    it('calls onStepSave callback', async () => {
      const user = userEvent.setup();
      render(
        <ServiceLocationQuiz
          onComplete={mockOnComplete}
          onStepSave={mockOnStepSave}
        />
      );

      // Select a service (this should trigger step save)
      const roofingButton = screen.getByText('Roofing Services').closest('button');
      await user.click(roofingButton!);

      // Step save should be called when navigating
      const nextButton = screen.getByText('Next Step');
      await user.click(nextButton);

      expect(mockOnStepSave).toHaveBeenCalled();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('handles empty initial data gracefully', () => {
      render(
        <ServiceLocationQuiz
          onComplete={mockOnComplete}
          onStepSave={mockOnStepSave}
          initialData={{ selectedServices: [], serviceLocationMappings: [] }}
        />
      );

      expect(screen.getByText('Select Your Services')).toBeInTheDocument();
      expect(screen.getByText('Selected: 0 services')).toBeInTheDocument();
    });

    it('handles corrupted localStorage data', () => {
      mockLocalStorage.getItem.mockReturnValue('invalid json');

      // Should not crash and should start fresh
      render(
        <ServiceLocationQuiz
          onComplete={mockOnComplete}
          onStepSave={mockOnStepSave}
        />
      );

      expect(screen.getByText('Select Your Services')).toBeInTheDocument();
    });

    it('validates location configuration completeness', async () => {
      const user = userEvent.setup();
      
      const initialData = {
        selectedServices: [mockService],
        serviceLocationMappings: [] // No locations configured
      };

      render(
        <ServiceLocationQuiz
          onComplete={mockOnComplete}
          onStepSave={mockOnStepSave}
          initialData={initialData}
        />
      );

      // Navigate to location configuration
      const nextButton = screen.getByText('Next Step');
      await user.click(nextButton);

      await waitFor(() => {
        const nextStepButton = screen.getByText('Next Step');
        expect(nextStepButton).toBeDisabled(); // Should be disabled without locations
      });
    });
  });
});

describe('ServiceLocationQuiz Integration', () => {
  it('maintains data consistency throughout the entire flow', async () => {
    const user = userEvent.setup();
    let completedData: any = null;

    const handleComplete = (data: any) => {
      completedData = data;
    };

    render(
      <ServiceLocationQuiz
        onComplete={handleComplete}
        onStepSave={() => {}}
      />
    );

    // Step 1: Select services
    const roofingButton = screen.getByText('Roofing Services').closest('button');
    await user.click(roofingButton!);
    
    const hvacButton = screen.getByText('HVAC Services').closest('button');
    await user.click(hvacButton!);

    // Go to location configuration
    let nextButton = screen.getByText('Next Step');
    await user.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText('Configure Service Areas')).toBeInTheDocument();
    });

    // Step 2: Configure locations for first service (Roofing)
    const searchInput = screen.getByPlaceholderText(/search for states/i);
    await user.click(searchInput);
    await user.type(searchInput, 'California');

    await waitFor(() => {
      const californiaButton = screen.getByText('California').closest('button');
      if (californiaButton) {
        user.click(californiaButton);
      }
    });

    // Navigate to next service
    const nextServiceButton = screen.getByText('Next Service');
    await user.click(nextServiceButton);

    await waitFor(() => {
      expect(screen.getByText('HVAC Services')).toBeInTheDocument();
    });

    // Configure location for HVAC
    await user.click(searchInput);
    await user.clear(searchInput);
    await user.type(searchInput, 'New York');

    await waitFor(() => {
      const nyButton = screen.getByText('New York').closest('button');
      if (nyButton) {
        user.click(nyButton);
      }
    });

    // Go to review
    nextButton = screen.getByText('Next Step');
    await user.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText('Review & Confirm')).toBeInTheDocument();
    });

    // Complete the quiz
    const completeButton = screen.getByText('Complete Setup');
    await user.click(completeButton);

    // Verify final data structure
    expect(completedData).toEqual({
      selectedServices: expect.arrayContaining([
        expect.objectContaining({ id: 'roofing' }),
        expect.objectContaining({ id: 'hvac' })
      ]),
      serviceLocationMappings: expect.arrayContaining([
        expect.objectContaining({
          serviceId: 'roofing',
          locations: expect.objectContaining({
            states: expect.arrayContaining([
              expect.objectContaining({ id: 'CA' })
            ])
          })
        }),
        expect.objectContaining({
          serviceId: 'hvac',
          locations: expect.objectContaining({
            states: expect.arrayContaining([
              expect.objectContaining({ id: 'NY' })
            ])
          })
        })
      ])
    });
  }, 10000); // Increased timeout for complex interaction
});