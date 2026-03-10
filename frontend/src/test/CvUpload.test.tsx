import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import toast from 'react-hot-toast';
import CvUpload from '../components/dashboard/CvUpload';
import { renderWithProviders, mockProfile } from './mocks';

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock API
vi.mock('../lib/api', () => ({
  api: {
    uploadCV: vi.fn(),
  },
}));

import { api } from '../lib/api';

describe('CvUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering - no CV uploaded', () => {
    it('renders upload zone with heading', () => {
      const profile = { ...mockProfile, cvParsedAt: undefined };
      renderWithProviders(<CvUpload profile={profile} />);

      expect(screen.getByText('CV upload')).toBeInTheDocument();
      expect(screen.getByText(/Click to upload or drag and drop/)).toBeInTheDocument();
    });

    it('renders file input with correct accept attributes', () => {
      const profile = { ...mockProfile, cvParsedAt: undefined };
      renderWithProviders(<CvUpload profile={profile} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(input).toBeInTheDocument();
      expect(input.accept).toContain('.pdf');
      expect(input.accept).toContain('.docx');
    });

    it('renders upload icon and descriptive text', () => {
      const profile = { ...mockProfile, cvParsedAt: undefined };
      renderWithProviders(<CvUpload profile={profile} />);

      expect(screen.getByText('PDF or Word document')).toBeInTheDocument();
      expect(screen.getByText(/AI fills your profile automatically/)).toBeInTheDocument();
    });

    it('renders clickable upload area', () => {
      const profile = { ...mockProfile, cvParsedAt: undefined };
      const { container } = renderWithProviders(<CvUpload profile={profile} />);

      const uploadZone = container.querySelector('[class*="border-2"][class*="border-dashed"]');
      expect(uploadZone).toBeInTheDocument();
    });
  });

  describe('rendering - CV uploaded', () => {
    it('shows success state when cvParsedAt is set', () => {
      const profile = { ...mockProfile, cvParsedAt: '2024-01-15T10:00:00Z' };
      renderWithProviders(<CvUpload profile={profile} />);

      expect(screen.getByText('CV uploaded')).toBeInTheDocument();
    });

    it('displays CV upload date', () => {
      const profile = { ...mockProfile, cvParsedAt: '2024-01-15T10:00:00Z' };
      renderWithProviders(<CvUpload profile={profile} />);

      const dateString = new Date('2024-01-15T10:00:00Z').toLocaleDateString();
      expect(screen.getByText(dateString)).toBeInTheDocument();
    });

    it('shows credibility badge in success state', () => {
      const profile = { ...mockProfile, cvParsedAt: '2024-01-15T10:00:00Z' };
      renderWithProviders(<CvUpload profile={profile} />);

      expect(screen.getByText('CV verified — boosts your visibility and trust score')).toBeInTheDocument();
    });

    it('shows green checkmark icon in success state', () => {
      const profile = { ...mockProfile, cvParsedAt: '2024-01-15T10:00:00Z' };
      const { container } = renderWithProviders(<CvUpload profile={profile} />);

      const svgs = container.querySelectorAll('svg');
      expect(svgs.length).toBeGreaterThan(0);
    });

    it('does not show upload zone when CV is uploaded', () => {
      const profile = { ...mockProfile, cvParsedAt: '2024-01-15T10:00:00Z' };
      renderWithProviders(<CvUpload profile={profile} />);

      expect(screen.queryByText(/Click to upload or drag and drop/)).not.toBeInTheDocument();
    });
  });

  describe('file validation - reject invalid files', () => {
    it('rejects files that are not PDF or DOCX', async () => {
      const profile = { ...mockProfile, cvParsedAt: undefined };
      renderWithProviders(<CvUpload profile={profile} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['content'], 'document.txt', { type: 'text/plain' });

      fireEvent.change(input, { target: { files: [file] } });

      expect(toast.error).toHaveBeenCalledWith('Please upload a PDF or Word document');
      expect(api.uploadCV).not.toHaveBeenCalled();
    });

    it('rejects image files', async () => {
      const profile = { ...mockProfile, cvParsedAt: undefined };
      renderWithProviders(<CvUpload profile={profile} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['content'], 'image.jpg', { type: 'image/jpeg' });

      fireEvent.change(input, { target: { files: [file] } });

      expect(toast.error).toHaveBeenCalledWith('Please upload a PDF or Word document');
    });

    it('rejects Excel files', async () => {
      const profile = { ...mockProfile, cvParsedAt: undefined };
      renderWithProviders(<CvUpload profile={profile} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['content'], 'data.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      fireEvent.change(input, { target: { files: [file] } });

      expect(toast.error).toHaveBeenCalled();
    });
  });

  describe('file acceptance', () => {
    it('accepts PDF files', async () => {
      const user = userEvent.setup();
      const profile = { ...mockProfile, cvParsedAt: undefined };
      (api.uploadCV as any).mockResolvedValue({ success: true });

      renderWithProviders(<CvUpload profile={profile} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['pdf content'], 'resume.pdf', { type: 'application/pdf' });

      await user.upload(input, file);

      await waitFor(() => {
        expect(api.uploadCV).toHaveBeenCalledWith(file);
      });
    });

    it('accepts DOCX files with .docx extension', async () => {
      const user = userEvent.setup();
      const profile = { ...mockProfile, cvParsedAt: undefined };
      (api.uploadCV as any).mockResolvedValue({ success: true });

      renderWithProviders(<CvUpload profile={profile} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['docx content'], 'resume.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

      await user.upload(input, file);

      await waitFor(() => {
        expect(api.uploadCV).toHaveBeenCalledWith(file);
      });
    });

    it('accepts Word documents with alternative MIME type', async () => {
      const user = userEvent.setup();
      const profile = { ...mockProfile, cvParsedAt: undefined };
      (api.uploadCV as any).mockResolvedValue({ success: true });

      renderWithProviders(<CvUpload profile={profile} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['doc content'], 'resume.docx', { type: 'application/msword' });

      await user.upload(input, file);

      await waitFor(() => {
        expect(api.uploadCV).toHaveBeenCalledWith(file);
      });
    });
  });

  describe('upload process', () => {
    it('shows loading state during upload', async () => {
      const user = userEvent.setup();
      const profile = { ...mockProfile, cvParsedAt: undefined };
      (api.uploadCV as any).mockImplementation(() => new Promise(resolve =>
        setTimeout(() => resolve({ success: true }), 500)
      ));

      renderWithProviders(<CvUpload profile={profile} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['pdf content'], 'resume.pdf', { type: 'application/pdf' });

      await user.upload(input, file);

      // Should show loading state
      await waitFor(() => {
        expect(screen.getByText('Analyzing your CV...')).toBeInTheDocument();
      });

      // Wait for upload to complete
      await waitFor(() => {
        expect(toast.success).toHaveBeenCalled();
      });
    });

    it('shows progress bar during upload', async () => {
      const user = userEvent.setup();
      const profile = { ...mockProfile, cvParsedAt: undefined };
      (api.uploadCV as any).mockImplementation(() => new Promise(resolve =>
        setTimeout(() => resolve({ success: true }), 500)
      ));

      const { container } = renderWithProviders(<CvUpload profile={profile} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['pdf content'], 'resume.pdf', { type: 'application/pdf' });

      await user.upload(input, file);

      // Progress bar should be visible
      await waitFor(() => {
        const progressBar = container.querySelector('[class*="bg-blue-500"]');
        expect(progressBar).toBeInTheDocument();
      });
    });

    it('disables file input during upload', async () => {
      const user = userEvent.setup();
      const profile = { ...mockProfile, cvParsedAt: undefined };
      (api.uploadCV as any).mockImplementation(() => new Promise(resolve =>
        setTimeout(() => resolve({ success: true }), 500)
      ));

      renderWithProviders(<CvUpload profile={profile} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['pdf content'], 'resume.pdf', { type: 'application/pdf' });

      await user.upload(input, file);

      expect(input).toBeDisabled();

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalled();
      });
    });

    it('clears file input after upload', async () => {
      const user = userEvent.setup();
      const profile = { ...mockProfile, cvParsedAt: undefined };
      (api.uploadCV as any).mockResolvedValue({ success: true });

      renderWithProviders(<CvUpload profile={profile} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['pdf content'], 'resume.pdf', { type: 'application/pdf' });

      await user.upload(input, file);

      await waitFor(() => {
        expect(input.value).toBe('');
      });
    });
  });

  describe('success handling', () => {
    it('shows success toast on upload completion', async () => {
      const user = userEvent.setup();
      const profile = { ...mockProfile, cvParsedAt: undefined };
      (api.uploadCV as any).mockResolvedValue({ success: true });

      renderWithProviders(<CvUpload profile={profile} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['pdf content'], 'resume.pdf', { type: 'application/pdf' });

      await user.upload(input, file);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('CV uploaded and analyzed successfully!');
      });
    });

    it('calls onUpload callback after successful upload', async () => {
      const user = userEvent.setup();
      const profile = { ...mockProfile, cvParsedAt: undefined };
      const onUpload = vi.fn();
      (api.uploadCV as any).mockResolvedValue({ success: true });

      renderWithProviders(<CvUpload profile={profile} onUpload={onUpload} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['pdf content'], 'resume.pdf', { type: 'application/pdf' });

      await user.upload(input, file);

      await waitFor(() => {
        expect(onUpload).toHaveBeenCalled();
      });
    });

    it('resets progress bar after upload completes', async () => {
      const user = userEvent.setup();
      const profile = { ...mockProfile, cvParsedAt: undefined };
      (api.uploadCV as any).mockResolvedValue({ success: true });

      renderWithProviders(<CvUpload profile={profile} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['pdf content'], 'resume.pdf', { type: 'application/pdf' });

      await user.upload(input, file);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalled();
      });

      // After some time, progress should be reset
      await waitFor(() => {
        expect(screen.queryByText('Analyzing your CV...')).not.toBeInTheDocument();
      }, { timeout: 2000 });
    });
  });

  describe('error handling', () => {
    it('shows error toast on upload failure', async () => {
      const user = userEvent.setup();
      const profile = { ...mockProfile, cvParsedAt: undefined };
      (api.uploadCV as any).mockRejectedValue(new Error('Upload failed'));

      renderWithProviders(<CvUpload profile={profile} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['pdf content'], 'resume.pdf', { type: 'application/pdf' });

      await user.upload(input, file);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Upload failed');
      });
    });

    it('shows generic error message when error has no message', async () => {
      const user = userEvent.setup();
      const profile = { ...mockProfile, cvParsedAt: undefined };
      (api.uploadCV as any).mockRejectedValue('Unknown error');

      renderWithProviders(<CvUpload profile={profile} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['pdf content'], 'resume.pdf', { type: 'application/pdf' });

      await user.upload(input, file);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to upload CV');
      });
    });

    it('clears loading state on error', async () => {
      const user = userEvent.setup();
      const profile = { ...mockProfile, cvParsedAt: undefined };
      (api.uploadCV as any).mockRejectedValue(new Error('Upload failed'));

      renderWithProviders(<CvUpload profile={profile} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['pdf content'], 'resume.pdf', { type: 'application/pdf' });

      await user.upload(input, file);

      await waitFor(() => {
        expect(input).not.toBeDisabled();
      });
    });
  });

  describe('drag and drop', () => {
    it('renders dashed border indicating drag-drop support', () => {
      const profile = { ...mockProfile, cvParsedAt: undefined };
      const { container } = renderWithProviders(<CvUpload profile={profile} />);

      const dropZone = container.querySelector('[class*="border-dashed"]');
      expect(dropZone).toHaveClass('border-2', 'border-dashed', 'border-gray-300');
    });

    it('is clickable to open file picker', () => {
      const profile = { ...mockProfile, cvParsedAt: undefined };
      const { container } = renderWithProviders(<CvUpload profile={profile} />);

      const dropZone = container.querySelector('[class*="border-dashed"]') as HTMLElement;
      expect(dropZone).toHaveClass('cursor-pointer');
    });
  });

  describe('upload zone interaction', () => {
    it('triggers file input when upload zone is clicked', async () => {
      const user = userEvent.setup();
      const profile = { ...mockProfile, cvParsedAt: undefined };
      const { container } = renderWithProviders(<CvUpload profile={profile} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const clickSpy = vi.spyOn(input, 'click');

      const dropZone = container.querySelector('[class*="border-dashed"]') as HTMLElement;
      await user.click(dropZone);

      expect(clickSpy).toHaveBeenCalled();
    });
  });

  describe('file type detection edge cases', () => {
    it('accepts files with word/docx MIME type even without docx extension', async () => {
      const user = userEvent.setup();
      const profile = { ...mockProfile, cvParsedAt: undefined };
      (api.uploadCV as any).mockResolvedValue({ success: true });

      renderWithProviders(<CvUpload profile={profile} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['docx content'], 'resume', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

      await user.upload(input, file);

      await waitFor(() => {
        expect(api.uploadCV).toHaveBeenCalledWith(file);
      });
    });

    it('accepts PDF files by extension detection', async () => {
      const profile = { ...mockProfile, cvParsedAt: undefined };
      (api.uploadCV as any).mockResolvedValue({ success: true });

      renderWithProviders(<CvUpload profile={profile} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['content'], 'resume.pdf', { type: 'text/plain' });
      Object.defineProperty(file, 'name', { value: 'resume.pdf' });

      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(api.uploadCV).toHaveBeenCalledWith(file);
      });
    });
  });

  describe('profile state transitions', () => {
    it('switches from upload to success view when cvParsedAt changes', () => {
      const { rerender } = renderWithProviders(
        <CvUpload profile={{ ...mockProfile, cvParsedAt: undefined }} />
      );

      expect(screen.getByText('CV upload')).toBeInTheDocument();
      expect(screen.getByText(/Click to upload/)).toBeInTheDocument();

      rerender(
        <CvUpload profile={{ ...mockProfile, cvParsedAt: '2024-01-15T10:00:00Z' }} />
      );

      expect(screen.getByText('CV uploaded')).toBeInTheDocument();
      expect(screen.queryByText(/Click to upload/)).not.toBeInTheDocument();
    });
  });
});
