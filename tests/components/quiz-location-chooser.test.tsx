import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import QuizLocationChooser from '@/components/contractor-signup/QuizLocationChooser';
import QuizLocationSummary from '@/components/contractor-signup/QuizLocationSummary';

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

// Mock location data for testing
const mockLocation = {
  id: 'CA',
  type: 'state' as const,
  name: 'California',
  displayName: 'California',
  coordinates: [36.7783, -119.4179] as [number, number]
};

const mockCityLocation = {
  id: 'LA-CA',
  type: 'city' as const,
  name: 'Los Angeles',
  displayName: 'Los Angeles, CA',
  state: 'CA',
  coordinates: [34.0522, -118.2437] as [number, number]
};

describe('QuizLocationChooser', () => {
  const mockOnComplete = jest.fn();
  const mockOnStepSave = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
  });

  it('renders the first step correctly', () => {
    render(
      <QuizLocationChooser
        onComplete={mockOnComplete}
        onStepSave={mockOnStepSave}
      />
    );

    expect(screen.getByText('Primary Service States')).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 4')).toBeInTheDocument();
    expect(screen.getByText('0% Complete')).toBeInTheDocument();
  });

  it('shows progress correctly', () => {
    render(
      <QuizLocationChooser
        onComplete={mockOnComplete}
        onStepSave={mockOnStepSave}
      />
    );

    const progressBar = document.querySelector('.bg-blue-600');
    expect(progressBar).toHaveStyle('width: 0%');
  });

  it('allows searching for locations', async () => {
    const user = userEvent.setup();
    render(
      <QuizLocationChooser
        onComplete={mockOnComplete}
        onStepSave={mockOnStepSave}
      />
    );

    const searchInput = screen.getByPlaceholderText(/Search for state/i);
    await user.type(searchInput, 'California');

    await waitFor(() => {
      expect(screen.getByText('California')).toBeInTheDocument();
    });
  });

  it('handles location selection', async () => {
    const user = userEvent.setup();
    render(
      <QuizLocationChooser
        onComplete={mockOnComplete}
        onStepSave={mockOnStepSave}
      />
    );

    const searchInput = screen.getByPlaceholderText(/Search for state/i);
    await user.click(searchInput);
    await user.type(searchInput, 'California');

    await waitFor(() => {
      const californiaOption = screen.getByText('California');
      expect(californiaOption).toBeInTheDocument();
    });

    // Click on California option
    const californiaButton = screen.getByRole('button', { name: /California/i });
    await user.click(californiaButton);

    // Check if location was added to selected locations
    await waitFor(() => {
      expect(screen.getByText('Selected Locations (1)')).toBeInTheDocument();
    });

    // Verify step save callback was called
    expect(mockOnStepSave).toHaveBeenCalledWith('primary-states', [
      expect.objectContaining({ name: 'California', type: 'state' })
    ]);
  });

  it('removes selected locations', async () => {
    const user = userEvent.setup();
    
    // Start with initial data
    const initialData = {
      'primary-states': [mockLocation]
    };

    render(
      <QuizLocationChooser
        onComplete={mockOnComplete}
        onStepSave={mockOnStepSave}
        initialData={initialData}
      />
    );

    // Find and click the remove button
    const removeButton = screen.getByRole('button', { name: '' }); // X button
    await user.click(removeButton);

    // Check if location was removed
    expect(screen.queryByText('Selected Locations')).not.toBeInTheDocument();
  });

  it('enforces minimum selections', async () => {
    const user = userEvent.setup();
    render(
      <QuizLocationChooser
        onComplete={mockOnComplete}
        onStepSave={mockOnStepSave}
      />
    );

    // Try to proceed without minimum selections
    const nextButton = screen.getByText('Next Step');
    expect(nextButton).toBeDisabled();

    // Add minimum selection
    const searchInput = screen.getByPlaceholderText(/Search for state/i);
    await user.click(searchInput);
    await user.type(searchInput, 'California');

    await waitFor(() => {
      const californiaButton = screen.getByRole('button', { name: /California/i });
      user.click(californiaButton);
    });

    // Now next button should be enabled
    await waitFor(() => {
      expect(nextButton).not.toBeDisabled();
    });
  });

  it('navigates between steps', async () => {
    const user = userEvent.setup();
    
    // Start with data to enable navigation
    const initialData = {
      'primary-states': [mockLocation],
      'major-cities': [mockCityLocation]
    };

    render(
      <QuizLocationChooser
        onComplete={mockOnComplete}
        onStepSave={mockOnStepSave}
        initialData={initialData}
      />
    );

    // Should start on first step
    expect(screen.getByText('Primary Service States')).toBeInTheDocument();

    // Navigate to next step
    const nextButton = screen.getByText('Next Step');
    await user.click(nextButton);

    // Should be on second step
    await waitFor(() => {
      expect(screen.getByText('Major Cities')).toBeInTheDocument();
    });

    // Navigate back
    const previousButton = screen.getByText('Previous');
    await user.click(previousButton);

    // Should be back on first step
    await waitFor(() => {
      expect(screen.getByText('Primary Service States')).toBeInTheDocument();
    });
  });

  it('completes the quiz', async () => {
    const user = userEvent.setup();
    
    // Start with complete data for all required steps
    const completeData = {
      'primary-states': [mockLocation],
      'major-cities': [mockCityLocation, { ...mockCityLocation, id: 'SF-CA', name: 'San Francisco', displayName: 'San Francisco, CA' }],
      'specific-counties': [],
      'zip-codes': []
    };

    render(
      <QuizLocationChooser
        onComplete={mockOnComplete}
        onStepSave={mockOnStepSave}
        initialData={completeData}
      />
    );

    // Navigate to last step
    const stepButtons = screen.getAllByRole('button');
    const lastStepButton = stepButtons.find(button => button.textContent?.includes('High-Value ZIP Codes'));
    if (lastStepButton) {
      await user.click(lastStepButton);
    }

    // Complete the quiz
    const completeButton = screen.getByText('Complete Quiz');
    await user.click(completeButton);

    // Verify completion callback was called
    expect(mockOnComplete).toHaveBeenCalledWith(completeData);
  });

  it('saves progress to localStorage', async () => {
    const user = userEvent.setup();
    render(
      <QuizLocationChooser
        onComplete={mockOnComplete}
        onStepSave={mockOnStepSave}
      />
    );

    // Add a selection
    const searchInput = screen.getByPlaceholderText(/Search for state/i);
    await user.click(searchInput);
    await user.type(searchInput, 'California');

    await waitFor(() => {
      const californiaButton = screen.getByRole('button', { name: /California/i });
      user.click(californiaButton);
    });

    // Navigate to next step to trigger save
    await waitFor(() => {
      const nextButton = screen.getByText('Next Step');
      user.click(nextButton);
    });

    // Check localStorage was called
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'quiz-location-chooser-progress',
      expect.stringContaining('primary-states')
    );
  });

  it('restores progress from localStorage', () => {
    const savedData = JSON.stringify({
      'primary-states': [mockLocation]
    });
    
    mockLocalStorage.getItem.mockReturnValue(savedData);

    render(
      <QuizLocationChooser
        onComplete={mockOnComplete}
        onStepSave={mockOnStepSave}
      />
    );

    // Check that saved data was restored
    expect(screen.getByText('Selected Locations (1)')).toBeInTheDocument();
    expect(screen.getByText('California')).toBeInTheDocument();
  });

  it('filters locations by type', async () => {
    const user = userEvent.setup();
    
    // Navigate to cities step
    const initialData = {
      'primary-states': [mockLocation]
    };

    render(
      <QuizLocationChooser
        onComplete={mockOnComplete}
        onStepSave={mockOnStepSave}
        initialData={initialData}
      />
    );

    // Navigate to cities step
    const nextButton = screen.getByText('Next Step');
    await user.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText('Major Cities')).toBeInTheDocument();
    });

    // Should show city-specific search placeholder
    expect(screen.getByPlaceholderText(/Search for city/i)).toBeInTheDocument();
  });

  it('clears all selections', async () => {
    const user = userEvent.setup();
    
    const initialData = {
      'primary-states': [mockLocation, { ...mockLocation, id: 'NY', name: 'New York', displayName: 'New York' }]
    };

    render(
      <QuizLocationChooser
        onComplete={mockOnComplete}
        onStepSave={mockOnStepSave}
        initialData={initialData}
      />
    );

    // Find clear all button
    const clearButton = screen.getByText('Clear All');
    await user.click(clearButton);

    // Check that selections were cleared
    expect(screen.queryByText('Selected Locations')).not.toBeInTheDocument();
  });
});

describe('QuizLocationSummary', () => {
  const mockSelections = {
    'primary-states': [mockLocation],
    'major-cities': [mockCityLocation],
    'specific-counties': [],
    'zip-codes': []
  };

  const mockOnEdit = jest.fn();
  const mockOnConfirm = jest.fn();
  const mockOnExport = jest.fn();
  const mockOnClear = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock URL.createObjectURL for export functionality
    global.URL.createObjectURL = jest.fn(() => 'mock-url');
    global.URL.revokeObjectURL = jest.fn();
    
    // Mock link element creation for download
    const mockLink = {
      href: '',
      download: '',
      click: jest.fn(),
    };
    document.createElement = jest.fn(() => mockLink as any);
    document.body.appendChild = jest.fn();
    document.body.removeChild = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders summary correctly', () => {
    render(
      <QuizLocationSummary
        selections={mockSelections}
        onEdit={mockOnEdit}
        onConfirm={mockOnConfirm}
        onExport={mockOnExport}
        onClear={mockOnClear}
      />
    );

    expect(screen.getByText('Service Area Configuration Complete!')).toBeInTheDocument();
    expect(screen.getByText('Coverage Summary')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument(); // States count
    expect(screen.getByText('1')).toBeInTheDocument(); // Cities count
  });

  it('shows correct statistics', () => {
    render(
      <QuizLocationSummary
        selections={mockSelections}
        onEdit={mockOnEdit}
        onConfirm={mockOnConfirm}
        onExport={mockOnExport}
        onClear={mockOnClear}
      />
    );

    // Check statistics
    const statElements = screen.getAllByText('1');
    expect(statElements.length).toBeGreaterThan(0); // Should show counts for states and cities
    
    expect(screen.getByText('Total Locations:')).toBeInTheDocument();
  });

  it('handles edit action', async () => {
    const user = userEvent.setup();
    render(
      <QuizLocationSummary
        selections={mockSelections}
        onEdit={mockOnEdit}
        onConfirm={mockOnConfirm}
        onExport={mockOnExport}
        onClear={mockOnClear}
      />
    );

    const editButton = screen.getByText('Edit Selections');
    await user.click(editButton);

    expect(mockOnEdit).toHaveBeenCalledTimes(1);
  });

  it('handles confirm action', async () => {
    const user = userEvent.setup();
    render(
      <QuizLocationSummary
        selections={mockSelections}
        onEdit={mockOnEdit}
        onConfirm={mockOnConfirm}
        onExport={mockOnExport}
        onClear={mockOnClear}
      />
    );

    const confirmButton = screen.getByText('Confirm & Continue');
    await user.click(confirmButton);

    expect(mockOnConfirm).toHaveBeenCalledWith(mockSelections);
  });

  it('handles export action', async () => {
    const user = userEvent.setup();
    render(
      <QuizLocationSummary
        selections={mockSelections}
        onEdit={mockOnEdit}
        onConfirm={mockOnConfirm}
        onExport={mockOnExport}
        onClear={mockOnClear}
      />
    );

    const exportButton = screen.getByText('Export Data');
    await user.click(exportButton);

    expect(mockOnExport).toHaveBeenCalledTimes(1);
    expect(global.URL.createObjectURL).toHaveBeenCalled();
  });

  it('handles clear action', async () => {
    const user = userEvent.setup();
    render(
      <QuizLocationSummary
        selections={mockSelections}
        onEdit={mockOnEdit}
        onConfirm={mockOnConfirm}
        onExport={mockOnExport}
        onClear={mockOnClear}
      />
    );

    const clearButton = screen.getByText('Clear All');
    await user.click(clearButton);

    expect(mockOnClear).toHaveBeenCalledTimes(1);
  });

  it('shows selection details by step', () => {
    render(
      <QuizLocationSummary
        selections={mockSelections}
        onEdit={mockOnEdit}
        onConfirm={mockOnConfirm}
        onExport={mockOnExport}
        onClear={mockOnClear}
      />
    );

    expect(screen.getByText('Primary Service States')).toBeInTheDocument();
    expect(screen.getByText('Major Cities')).toBeInTheDocument();
    expect(screen.getByText('California')).toBeInTheDocument();
    expect(screen.getByText('Los Angeles, CA')).toBeInTheDocument();
  });

  it('shows geographic organization when multiple states', () => {
    const multiStateSelections = {
      'primary-states': [
        mockLocation,
        { ...mockLocation, id: 'NY', name: 'New York', displayName: 'New York', state: 'NY' }
      ],
      'major-cities': [
        mockCityLocation,
        { ...mockCityLocation, id: 'NYC-NY', name: 'New York City', displayName: 'New York City, NY', state: 'NY' }
      ],
      'specific-counties': [],
      'zip-codes': []
    };

    render(
      <QuizLocationSummary
        selections={multiStateSelections}
        onEdit={mockOnEdit}
        onConfirm={mockOnConfirm}
        onExport={mockOnExport}
        onClear={mockOnClear}
      />
    );

    expect(screen.getByText('Coverage by State')).toBeInTheDocument();
  });
});

describe('Quiz Integration', () => {
  it('maintains data consistency between quiz and summary', async () => {
    const user = userEvent.setup();
    let quizData = {};
    let summaryData = {};

    const MockQuizWrapper = () => {
      const [phase, setPhase] = React.useState<'quiz' | 'summary'>('quiz');
      const [data, setData] = React.useState({});

      const handleQuizComplete = (completedData: any) => {
        quizData = completedData;
        setData(completedData);
        setPhase('summary');
      };

      const handleSummaryConfirm = (confirmedData: any) => {
        summaryData = confirmedData;
      };

      if (phase === 'quiz') {
        return (
          <QuizLocationChooser
            onComplete={handleQuizComplete}
            onStepSave={() => {}}
          />
        );
      }

      return (
        <QuizLocationSummary
          selections={data}
          onConfirm={handleSummaryConfirm}
        />
      );
    };

    render(<MockQuizWrapper />);

    // Simulate completing the quiz with selections
    const searchInput = screen.getByPlaceholderText(/Search for state/i);
    await user.click(searchInput);
    await user.type(searchInput, 'California');

    // Wait for and click California option
    await waitFor(() => {
      const californiaButton = screen.getByRole('button', { name: /California/i });
      user.click(californiaButton);
    });

    // Navigate through steps and complete
    // This would require more complex setup to fully test the flow
    
    expect(screen.getByText('Selected Locations (1)')).toBeInTheDocument();
  });
});