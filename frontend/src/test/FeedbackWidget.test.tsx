import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent, cleanup, within } from '@testing-library/react';
import { renderWithProviders } from './mocks';
import FeedbackWidget from '../components/FeedbackWidget';
import { api } from '../lib/api';

// Mock API
vi.mock('../lib/api', () => ({
  api: {
    submitFeedback: vi.fn(),
  },
}));

// Mock useAuth hook
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'test-id', name: 'Test User', email: 'test@example.com' },
    loading: false,
    login: vi.fn(),
    signup: vi.fn(),
    logout: vi.fn(),
    loginWithGoogle: vi.fn(),
    loginWithLinkedIn: vi.fn(),
  }),
}));

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('FeedbackWidget', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.submitFeedback).mockResolvedValue({ id: 'fb-1', message: 'Thank you!' });
  });

  describe('Floating button', () => {
    it('renders the floating feedback button', () => {
      renderWithProviders(<FeedbackWidget />);
      const button = screen.getByLabelText('feedback.title');
      expect(button).toBeInTheDocument();
    });

    it('opens modal when button is clicked', async () => {
      renderWithProviders(<FeedbackWidget />);
      fireEvent.click(screen.getByLabelText('feedback.title'));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });
  });

  describe('Modal form', () => {
    it('renders with feedback type selected by default', async () => {
      renderWithProviders(<FeedbackWidget isOpen={true} onOpenChange={() => {}} />);

      // Check all three type buttons are present
      expect(screen.getByText('feedback.typeFeedback')).toBeInTheDocument();
      expect(screen.getByText('feedback.typeBug')).toBeInTheDocument();
      expect(screen.getByText('feedback.typeFeature')).toBeInTheDocument();
    });

    it('renders with bug type when defaultType is BUG', async () => {
      renderWithProviders(<FeedbackWidget isOpen={true} defaultType="BUG" onOpenChange={() => {}} />);

      // Bug-specific fields should be visible
      expect(screen.getByText('feedback.severity')).toBeInTheDocument();
      expect(screen.getByText('feedback.stepsToReproduce')).toBeInTheDocument();
    });

    it('shows sentiment picker for FEEDBACK type', () => {
      renderWithProviders(<FeedbackWidget isOpen={true} onOpenChange={() => {}} />);
      expect(screen.getByText('feedback.howDoYouFeel')).toBeInTheDocument();
    });

    it('hides sentiment picker for BUG type', () => {
      renderWithProviders(<FeedbackWidget isOpen={true} defaultType="BUG" onOpenChange={() => {}} />);
      expect(screen.queryByText('feedback.howDoYouFeel')).not.toBeInTheDocument();
    });

    it('shows title field for BUG type', () => {
      renderWithProviders(<FeedbackWidget isOpen={true} defaultType="BUG" onOpenChange={() => {}} />);
      expect(screen.getByText('feedback.titleLabel')).toBeInTheDocument();
    });

    it('shows title field for FEATURE type', () => {
      renderWithProviders(<FeedbackWidget isOpen={true} defaultType="FEATURE" onOpenChange={() => {}} />);
      expect(screen.getByText('feedback.titleLabel')).toBeInTheDocument();
    });

    it('hides title field for FEEDBACK type', () => {
      renderWithProviders(<FeedbackWidget isOpen={true} defaultType="FEEDBACK" onOpenChange={() => {}} />);
      expect(screen.queryByText('feedback.titleLabel')).not.toBeInTheDocument();
    });

    it('shows bug-specific fields only for BUG type', () => {
      renderWithProviders(<FeedbackWidget isOpen={true} defaultType="BUG" onOpenChange={() => {}} />);

      // Bug-specific fields
      expect(screen.getByText('feedback.severity')).toBeInTheDocument();
      expect(screen.getByText('feedback.stepsToReproduce')).toBeInTheDocument();
      expect(screen.getByText('feedback.expected')).toBeInTheDocument();
      expect(screen.getByText('feedback.actual')).toBeInTheDocument();
    });

    it('hides bug-specific fields for FEATURE type', () => {
      renderWithProviders(<FeedbackWidget isOpen={true} defaultType="FEATURE" onOpenChange={() => {}} />);

      expect(screen.queryByText('feedback.severity')).not.toBeInTheDocument();
      expect(screen.queryByText('feedback.stepsToReproduce')).not.toBeInTheDocument();
    });

    it('displays screenshot section', () => {
      renderWithProviders(<FeedbackWidget isOpen={true} onOpenChange={() => {}} />);
      expect(screen.getByText('feedback.addScreenshot')).toBeInTheDocument();
    });

    it('shows auto-context notice', () => {
      renderWithProviders(<FeedbackWidget isOpen={true} onOpenChange={() => {}} />);
      expect(screen.getByText(/feedback\.autoContext/)).toBeInTheDocument();
    });

    it('shows logged-in user email', () => {
      renderWithProviders(<FeedbackWidget isOpen={true} onOpenChange={() => {}} />);
      expect(screen.getByText(/test@example\.com/)).toBeInTheDocument();
    });

    it('disables submit when description is empty', () => {
      renderWithProviders(<FeedbackWidget isOpen={true} onOpenChange={() => {}} />);
      const submitBtn = screen.getByText('feedback.send');
      expect(submitBtn).toBeDisabled();
    });

    it('enables submit when description has text', async () => {
      renderWithProviders(<FeedbackWidget isOpen={true} onOpenChange={() => {}} />);

      const textarea = screen.getByPlaceholderText('feedback.feedbackDescPlaceholder');
      fireEvent.change(textarea, { target: { value: 'Some feedback text' } });

      const submitBtn = screen.getByText('feedback.send');
      expect(submitBtn).not.toBeDisabled();
    });
  });

  describe('Type switching', () => {
    it('switches to BUG type and shows bug fields', async () => {
      renderWithProviders(<FeedbackWidget isOpen={true} onOpenChange={() => {}} />);

      // Initially no bug fields
      expect(screen.queryByText('feedback.severity')).not.toBeInTheDocument();

      // Click bug type
      fireEvent.click(screen.getByText('feedback.typeBug'));

      // Bug fields should appear
      await waitFor(() => {
        expect(screen.getByText('feedback.severity')).toBeInTheDocument();
      });
    });

    it('switches to FEATURE type', async () => {
      renderWithProviders(<FeedbackWidget isOpen={true} onOpenChange={() => {}} />);

      fireEvent.click(screen.getByText('feedback.typeFeature'));

      await waitFor(() => {
        expect(screen.getByText('feedback.titleLabel')).toBeInTheDocument();
      });
      // No severity for features
      expect(screen.queryByText('feedback.severity')).not.toBeInTheDocument();
    });
  });

  describe('Submission', () => {
    it('submits general feedback successfully', async () => {
      const onOpenChange = vi.fn();
      renderWithProviders(<FeedbackWidget isOpen={true} onOpenChange={onOpenChange} />);

      const textarea = screen.getByPlaceholderText('feedback.feedbackDescPlaceholder');
      fireEvent.change(textarea, { target: { value: 'This is great feedback!' } });

      fireEvent.click(screen.getByText('feedback.send'));

      await waitFor(() => {
        expect(api.submitFeedback).toHaveBeenCalledOnce();
      });

      // Check the call args
      const callArgs = vi.mocked(api.submitFeedback).mock.calls[0][0];
      expect(callArgs.type).toBe('FEEDBACK');
      expect(callArgs.description).toBe('This is great feedback!');
      expect(callArgs.pageUrl).toBeDefined();
      expect(callArgs.browser).toBeDefined();
      expect(callArgs.os).toBeDefined();
      expect(callArgs.viewport).toBeDefined();
      expect(callArgs.userAgent).toBeDefined();
    });

    it('submits bug report with all fields', async () => {
      renderWithProviders(<FeedbackWidget isOpen={true} defaultType="BUG" onOpenChange={() => {}} />);

      // Fill in title
      const titleInput = screen.getByPlaceholderText('feedback.bugTitlePlaceholder');
      fireEvent.change(titleInput, { target: { value: 'Page crashes' } });

      // Fill in description
      const descInput = screen.getByPlaceholderText('feedback.bugDescPlaceholder');
      fireEvent.change(descInput, { target: { value: 'The page crashes when clicking save' } });

      // Fill in steps
      const stepsInput = screen.getByPlaceholderText('feedback.stepsPlaceholder');
      fireEvent.change(stepsInput, { target: { value: '1. Click save\n2. See crash' } });

      // Fill expected
      const expectedInput = screen.getByPlaceholderText('feedback.expectedPlaceholder');
      fireEvent.change(expectedInput, { target: { value: 'Should save' } });

      // Fill actual
      const actualInput = screen.getByPlaceholderText('feedback.actualPlaceholder');
      fireEvent.change(actualInput, { target: { value: 'Crashes' } });

      // Select severity
      fireEvent.click(screen.getByText('feedback.severityHigh'));

      // Submit
      fireEvent.click(screen.getByText('feedback.send'));

      await waitFor(() => {
        expect(api.submitFeedback).toHaveBeenCalledOnce();
      });

      const callArgs = vi.mocked(api.submitFeedback).mock.calls[0][0];
      expect(callArgs.type).toBe('BUG');
      expect(callArgs.title).toBe('Page crashes');
      expect(callArgs.description).toBe('The page crashes when clicking save');
      expect(callArgs.stepsToReproduce).toBe('1. Click save\n2. See crash');
      expect(callArgs.expectedBehavior).toBe('Should save');
      expect(callArgs.actualBehavior).toBe('Crashes');
      expect(callArgs.severity).toBe('high');
    });

    it('shows success screen after submission', async () => {
      renderWithProviders(<FeedbackWidget isOpen={true} onOpenChange={() => {}} />);

      const textarea = screen.getByPlaceholderText('feedback.feedbackDescPlaceholder');
      fireEvent.change(textarea, { target: { value: 'Feedback text' } });
      fireEvent.click(screen.getByText('feedback.send'));

      await waitFor(() => {
        expect(screen.getByText('feedback.submitted')).toBeInTheDocument();
      });
      expect(screen.getByText('feedback.submittedMessage')).toBeInTheDocument();
    });

    it('shows error toast on submission failure', async () => {
      vi.mocked(api.submitFeedback).mockRejectedValueOnce(new Error('Network error'));
      const toast = await import('react-hot-toast');

      renderWithProviders(<FeedbackWidget isOpen={true} onOpenChange={() => {}} />);

      const textarea = screen.getByPlaceholderText('feedback.feedbackDescPlaceholder');
      fireEvent.change(textarea, { target: { value: 'Feedback text' } });
      fireEvent.click(screen.getByText('feedback.send'));

      await waitFor(() => {
        expect(toast.default.error).toHaveBeenCalledWith('Network error');
      });
    });

    it('shows loading state during submission', async () => {
      // Make the API call hang
      vi.mocked(api.submitFeedback).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ id: 'fb-1', message: 'ok' }), 5000))
      );

      renderWithProviders(<FeedbackWidget isOpen={true} onOpenChange={() => {}} />);

      const textarea = screen.getByPlaceholderText('feedback.feedbackDescPlaceholder');
      fireEvent.change(textarea, { target: { value: 'Test' } });
      fireEvent.click(screen.getByText('feedback.send'));

      // Submit button should show loading text
      await waitFor(() => {
        expect(screen.getByText('feedback.sending')).toBeInTheDocument();
      });
    });
  });

  describe('Close behavior', () => {
    it('closes when X button is clicked', () => {
      const onOpenChange = vi.fn();
      renderWithProviders(<FeedbackWidget isOpen={true} onOpenChange={onOpenChange} />);

      const closeBtn = screen.getByLabelText('common.cancel');
      fireEvent.click(closeBtn);

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('closes when backdrop is clicked', () => {
      const onOpenChange = vi.fn();
      renderWithProviders(<FeedbackWidget isOpen={true} onOpenChange={onOpenChange} />);

      // Click the backdrop (the fixed bg-black/40 overlay)
      const backdrop = document.querySelector('.bg-black\\/40');
      if (backdrop) fireEvent.click(backdrop);

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('closes on Escape key', () => {
      const onOpenChange = vi.fn();
      renderWithProviders(<FeedbackWidget isOpen={true} onOpenChange={onOpenChange} />);

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe('Category dropdown', () => {
    it('renders all category options', () => {
      renderWithProviders(<FeedbackWidget isOpen={true} onOpenChange={() => {}} />);

      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();

      // Check options exist (the select has option elements)
      const options = within(select).getAllByRole('option');
      // Default "Select a category..." + 7 categories
      expect(options.length).toBe(8);
    });
  });

  describe('Sentiment picker', () => {
    it('renders 5 emoji buttons', () => {
      renderWithProviders(<FeedbackWidget isOpen={true} onOpenChange={() => {}} />);

      // There should be emoji buttons with specific labels
      expect(screen.getByLabelText('Very Bad')).toBeInTheDocument();
      expect(screen.getByLabelText('Bad')).toBeInTheDocument();
      expect(screen.getByLabelText('Okay')).toBeInTheDocument();
      expect(screen.getByLabelText('Good')).toBeInTheDocument();
      expect(screen.getByLabelText('Amazing')).toBeInTheDocument();
    });

    it('includes sentiment in submission', async () => {
      renderWithProviders(<FeedbackWidget isOpen={true} onOpenChange={() => {}} />);

      fireEvent.click(screen.getByLabelText('Amazing'));

      const textarea = screen.getByPlaceholderText('feedback.feedbackDescPlaceholder');
      fireEvent.change(textarea, { target: { value: 'Love it!' } });
      fireEvent.click(screen.getByText('feedback.send'));

      await waitFor(() => {
        expect(api.submitFeedback).toHaveBeenCalledOnce();
      });

      const callArgs = vi.mocked(api.submitFeedback).mock.calls[0][0];
      expect(callArgs.sentiment).toBe(5);
    });
  });

  describe('Severity buttons (BUG type)', () => {
    it('toggles severity selection', () => {
      renderWithProviders(<FeedbackWidget isOpen={true} defaultType="BUG" onOpenChange={() => {}} />);

      const highBtn = screen.getByText('feedback.severityHigh');
      fireEvent.click(highBtn);

      // Clicking again deselects
      fireEvent.click(highBtn);

      // After deselect, submitting should not include severity
    });
  });

  describe('Auto-context capture', () => {
    it('includes browser context in submission', async () => {
      renderWithProviders(<FeedbackWidget isOpen={true} onOpenChange={() => {}} />);

      const textarea = screen.getByPlaceholderText('feedback.feedbackDescPlaceholder');
      fireEvent.change(textarea, { target: { value: 'Test' } });
      fireEvent.click(screen.getByText('feedback.send'));

      await waitFor(() => {
        expect(api.submitFeedback).toHaveBeenCalledOnce();
      });

      const callArgs = vi.mocked(api.submitFeedback).mock.calls[0][0];
      expect(callArgs.pageUrl).toBe('http://localhost:3000/');
      expect(callArgs.viewport).toMatch(/\d+x\d+/);
      expect(callArgs.userAgent).toBeDefined();
      expect(callArgs.browser).toBeDefined();
      expect(callArgs.os).toBeDefined();
    });
  });
});
