import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProfilePhoto from '../components/dashboard/ProfilePhoto';

// Mock react-easy-crop
vi.mock('react-easy-crop', () => ({
  default: ({ onCropComplete }: any) => {
    // Simulate an immediate crop complete with a 100x100 area
    setTimeout(() => {
      onCropComplete?.(
        { x: 0, y: 0, width: 100, height: 100 },
        { x: 0, y: 0, width: 100, height: 100 },
      );
    }, 0);
    return <div data-testid="mock-cropper" />;
  },
}));

// Mock toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import toast from 'react-hot-toast';

function createFile(name: string, size: number, type: string): File {
  const buffer = new ArrayBuffer(size);
  return new File([buffer], name, { type });
}

describe('ProfilePhoto', () => {
  const defaultProps = {
    name: 'Test User',
    onUpload: vi.fn().mockResolvedValue(undefined),
    onDelete: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial rendering', () => {
    it('shows initials when no photo', () => {
      render(<ProfilePhoto {...defaultProps} />);
      expect(screen.getByText('TU')).toBeInTheDocument();
    });

    it('shows single initial for single-name users', () => {
      render(<ProfilePhoto {...defaultProps} name="Alice" />);
      expect(screen.getByText('A')).toBeInTheDocument();
    });

    it('shows "Add photo" button when no photo', () => {
      render(<ProfilePhoto {...defaultProps} />);
      expect(screen.getByText('dashboard.photo.add')).toBeInTheDocument();
    });

    it('shows photo when photoUrl is provided and status is approved', () => {
      render(
        <ProfilePhoto
          {...defaultProps}
          photoUrl="https://example.com/photo.webp"
          photoStatus="approved"
        />,
      );
      const img = screen.getByAltText('Test User');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', 'https://example.com/photo.webp');
    });

    it('shows "Change" button when photo exists', () => {
      render(
        <ProfilePhoto
          {...defaultProps}
          photoUrl="https://example.com/photo.webp"
          photoStatus="approved"
        />,
      );
      expect(screen.getByText('dashboard.photo.change')).toBeInTheDocument();
    });

    it('shows "Remove" button when photo exists with non-none status', () => {
      render(
        <ProfilePhoto
          {...defaultProps}
          photoUrl="https://example.com/photo.webp"
          photoStatus="approved"
        />,
      );
      expect(screen.getByText('dashboard.photo.remove')).toBeInTheDocument();
    });

    it('shows "Reviewing..." badge for pending status', () => {
      render(
        <ProfilePhoto
          {...defaultProps}
          photoUrl="https://example.com/photo.webp"
          photoStatus="pending"
        />,
      );
      expect(screen.getByText('dashboard.photo.reviewing')).toBeInTheDocument();
    });

    it('shows "Photo rejected" badge for rejected status', () => {
      render(<ProfilePhoto {...defaultProps} photoStatus="rejected" />);
      expect(screen.getByText('dashboard.photo.rejected')).toBeInTheDocument();
    });

    it('applies correct ring class for pending status', () => {
      const { container } = render(
        <ProfilePhoto
          {...defaultProps}
          photoUrl="https://example.com/photo.webp"
          photoStatus="pending"
        />,
      );
      const avatar = container.querySelector('.ring-yellow-400');
      expect(avatar).toBeInTheDocument();
    });

    it('applies correct ring class for approved status', () => {
      const { container } = render(
        <ProfilePhoto
          {...defaultProps}
          photoUrl="https://example.com/photo.webp"
          photoStatus="approved"
        />,
      );
      const avatar = container.querySelector('.ring-green-400');
      expect(avatar).toBeInTheDocument();
    });
  });

  describe('Size variants', () => {
    it('renders small size', () => {
      const { container } = render(<ProfilePhoto {...defaultProps} size="sm" />);
      expect(container.querySelector('.w-10')).toBeInTheDocument();
    });

    it('renders medium size (default)', () => {
      const { container } = render(<ProfilePhoto {...defaultProps} />);
      expect(container.querySelector('.w-20')).toBeInTheDocument();
    });

    it('renders large size', () => {
      const { container } = render(<ProfilePhoto {...defaultProps} size="lg" />);
      expect(container.querySelector('.w-28')).toBeInTheDocument();
    });
  });

  describe('File selection and validation', () => {
    it('rejects non-image files with toast error', async () => {
      render(<ProfilePhoto {...defaultProps} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const txtFile = createFile('doc.txt', 100, 'text/plain');

      // Use fireEvent to bypass browser accept-attribute filtering
      fireEvent.change(input, { target: { files: [txtFile] } });

      expect(toast.error).toHaveBeenCalledWith('dashboard.photo.invalidType');
    });

    it('rejects files over 10MB with toast error', async () => {
      render(<ProfilePhoto {...defaultProps} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const bigFile = createFile('big.jpg', 11 * 1024 * 1024, 'image/jpeg');

      fireEvent.change(input, { target: { files: [bigFile] } });

      expect(toast.error).toHaveBeenCalledWith('dashboard.photo.tooLarge');
    });

    it('opens crop modal for valid image files', async () => {
      const user = userEvent.setup();
      render(<ProfilePhoto {...defaultProps} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const validFile = createFile('photo.jpg', 1024, 'image/jpeg');

      // Mock URL.createObjectURL
      const mockUrl = 'blob:http://localhost/test-photo';
      const createObjectURL = vi.fn().mockReturnValue(mockUrl);
      const revokeObjectURL = vi.fn();
      globalThis.URL.createObjectURL = createObjectURL;
      globalThis.URL.revokeObjectURL = revokeObjectURL;

      await user.upload(input, validFile);

      // Crop modal should appear
      expect(screen.getByText('dashboard.photo.cropTitle')).toBeInTheDocument();
      expect(screen.getByTestId('mock-cropper')).toBeInTheDocument();
      expect(screen.getByText('dashboard.photo.save')).toBeInTheDocument();
      expect(screen.getByText('common.cancel')).toBeInTheDocument();
    });

    it('accepts JPEG, PNG, and WebP file types', async () => {
      const user = userEvent.setup();
      globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:test');
      globalThis.URL.revokeObjectURL = vi.fn();

      for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
        const { unmount } = render(<ProfilePhoto {...defaultProps} />);
        const input = document.querySelector('input[type="file"]') as HTMLInputElement;
        await user.upload(input, createFile('photo', 1024, type));
        expect(screen.getByText('dashboard.photo.cropTitle')).toBeInTheDocument();
        unmount();
      }
    });
  });

  describe('Crop modal interactions', () => {
    it('closes crop modal when Cancel is clicked', async () => {
      const user = userEvent.setup();
      globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:test');
      globalThis.URL.revokeObjectURL = vi.fn();

      render(<ProfilePhoto {...defaultProps} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(input, createFile('photo.jpg', 1024, 'image/jpeg'));

      expect(screen.getByText('dashboard.photo.cropTitle')).toBeInTheDocument();

      await user.click(screen.getByText('common.cancel'));

      expect(screen.queryByText('dashboard.photo.cropTitle')).not.toBeInTheDocument();
      expect(globalThis.URL.revokeObjectURL).toHaveBeenCalled();
    });

    it('has a zoom slider', async () => {
      const user = userEvent.setup();
      globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:test');
      globalThis.URL.revokeObjectURL = vi.fn();

      render(<ProfilePhoto {...defaultProps} />);
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(input, createFile('photo.jpg', 1024, 'image/jpeg'));

      const slider = screen.getByRole('slider');
      expect(slider).toBeInTheDocument();
      expect(slider).toHaveAttribute('min', '1');
      expect(slider).toHaveAttribute('max', '3');
    });
  });

  describe('Delete photo', () => {
    it('calls onDelete and shows success toast', async () => {
      const user = userEvent.setup();
      const onDelete = vi.fn().mockResolvedValue(undefined);

      render(
        <ProfilePhoto
          {...defaultProps}
          onDelete={onDelete}
          photoUrl="https://example.com/photo.webp"
          photoStatus="approved"
        />,
      );

      await user.click(screen.getByText('dashboard.photo.remove'));

      await waitFor(() => {
        expect(onDelete).toHaveBeenCalled();
        expect(toast.success).toHaveBeenCalledWith('dashboard.photo.deleted');
      });
    });

    it('shows error toast when delete fails', async () => {
      const user = userEvent.setup();
      const onDelete = vi.fn().mockRejectedValue(new Error('Delete failed'));

      render(
        <ProfilePhoto
          {...defaultProps}
          onDelete={onDelete}
          photoUrl="https://example.com/photo.webp"
          photoStatus="approved"
        />,
      );

      await user.click(screen.getByText('dashboard.photo.remove'));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Delete failed');
      });
    });
  });

  describe('File input attributes', () => {
    it('has correct accept attribute', () => {
      render(<ProfilePhoto {...defaultProps} />);
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(input).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp');
    });

    it('input is hidden', () => {
      render(<ProfilePhoto {...defaultProps} />);
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(input).toHaveClass('hidden');
    });
  });
});
