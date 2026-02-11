import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PhoneInput from '../components/PhoneInput';

describe('PhoneInput', () => {
  describe('rendering', () => {
    it('renders with default +1 dial code when no value provided', () => {
      render(<PhoneInput id="phone" value="" onChange={vi.fn()} />);
      expect(screen.getByText('+1')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toHaveValue('');
    });

    it('renders with placeholder text', () => {
      render(<PhoneInput id="phone" value="" onChange={vi.fn()} placeholder="Enter number" />);
      expect(screen.getByPlaceholderText('Enter number')).toBeInTheDocument();
    });

    it('renders default placeholder when none provided', () => {
      render(<PhoneInput id="phone" value="" onChange={vi.fn()} />);
      expect(screen.getByPlaceholderText('555 123 4567')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(<PhoneInput id="phone" value="" onChange={vi.fn()} className="my-class" />);
      expect(container.firstChild).toHaveClass('my-class');
    });

    it('sets the id on the number input', () => {
      render(<PhoneInput id="whatsapp-input" value="" onChange={vi.fn()} />);
      expect(document.getElementById('whatsapp-input')).toBeInTheDocument();
    });
  });

  describe('parsing E.164 values', () => {
    it('parses a US number correctly', () => {
      render(<PhoneInput id="phone" value="+15551234567" onChange={vi.fn()} />);
      expect(screen.getByText('+1')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toHaveValue('5551234567');
    });

    it('parses a UK number correctly', () => {
      render(<PhoneInput id="phone" value="+447911123456" onChange={vi.fn()} />);
      expect(screen.getByText('+44')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toHaveValue('7911123456');
    });

    it('parses an Indian number correctly', () => {
      render(<PhoneInput id="phone" value="+919876543210" onChange={vi.fn()} />);
      expect(screen.getByText('+91')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toHaveValue('9876543210');
    });

    it('parses a Jamaican number (+1876) before generic +1', () => {
      render(<PhoneInput id="phone" value="+18761234567" onChange={vi.fn()} />);
      expect(screen.getByText('+1876')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toHaveValue('1234567');
    });

    it('parses a Puerto Rico number (+1787) before generic +1', () => {
      render(<PhoneInput id="phone" value="+17871234567" onChange={vi.fn()} />);
      expect(screen.getByText('+1787')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toHaveValue('1234567');
    });

    it('parses a Trinidad number (+1868) before generic +1', () => {
      render(<PhoneInput id="phone" value="+18681234567" onChange={vi.fn()} />);
      expect(screen.getByText('+1868')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toHaveValue('1234567');
    });

    it('handles value without + prefix', () => {
      render(<PhoneInput id="phone" value="5551234567" onChange={vi.fn()} />);
      // Should default to +1 and treat entire value as local number
      expect(screen.getByText('+1')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toHaveValue('5551234567');
    });

    it('handles an unrecognized country code by defaulting to +1', () => {
      render(<PhoneInput id="phone" value="+99999999999" onChange={vi.fn()} />);
      expect(screen.getByText('+1')).toBeInTheDocument();
    });
  });

  describe('number input', () => {
    it('calls onChange with full E.164 number when digits are typed', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<PhoneInput id="phone" value="" onChange={onChange} />);

      const input = screen.getByRole('textbox');
      await user.type(input, '5551234567');

      // Last call should have full number with dial code
      const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
      expect(lastCall[0]).toBe('+15551234567');
    });

    it('strips non-digit characters from input', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<PhoneInput id="phone" value="" onChange={onChange} />);

      const input = screen.getByRole('textbox');
      await user.type(input, '555-123');

      // Should only pass digits to onChange
      const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
      expect(lastCall[0]).toBe('+1555123');
    });

    it('calls onChange with empty string when input is cleared', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<PhoneInput id="phone" value="+15551234567" onChange={onChange} />);

      const input = screen.getByRole('textbox');
      await user.clear(input);

      const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
      expect(lastCall[0]).toBe('');
    });
  });

  describe('country dropdown', () => {
    it('opens dropdown when button is clicked', async () => {
      const user = userEvent.setup();
      render(<PhoneInput id="phone" value="" onChange={vi.fn()} />);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(screen.getByPlaceholderText('Search country...')).toBeInTheDocument();
    });

    it('closes dropdown when button is clicked again', async () => {
      const user = userEvent.setup();
      render(<PhoneInput id="phone" value="" onChange={vi.fn()} />);

      const button = screen.getByRole('button');
      await user.click(button);
      expect(screen.getByPlaceholderText('Search country...')).toBeInTheDocument();

      await user.click(button);
      expect(screen.queryByPlaceholderText('Search country...')).not.toBeInTheDocument();
    });

    it('shows all countries when dropdown opens without search', async () => {
      const user = userEvent.setup();
      render(<PhoneInput id="phone" value="" onChange={vi.fn()} />);

      await user.click(screen.getByRole('button'));

      // Spot check some countries from different parts of the alphabet
      expect(screen.getByText('Afghanistan')).toBeInTheDocument();
      expect(screen.getByText('Japan')).toBeInTheDocument();
      expect(screen.getByText('Zimbabwe')).toBeInTheDocument();
    });

    it('filters countries by name', async () => {
      const user = userEvent.setup();
      render(<PhoneInput id="phone" value="" onChange={vi.fn()} />);

      await user.click(screen.getByRole('button'));
      const searchInput = screen.getByPlaceholderText('Search country...');
      await user.type(searchInput, 'japan');

      expect(screen.getByText('Japan')).toBeInTheDocument();
      expect(screen.queryByText('Germany')).not.toBeInTheDocument();
      expect(screen.queryByText('France')).not.toBeInTheDocument();
    });

    it('filters countries by dial code', async () => {
      const user = userEvent.setup();
      render(<PhoneInput id="phone" value="" onChange={vi.fn()} />);

      await user.click(screen.getByRole('button'));
      const searchInput = screen.getByPlaceholderText('Search country...');
      await user.type(searchInput, '+81');

      expect(screen.getByText('Japan')).toBeInTheDocument();
    });

    it('shows "No results" when search yields nothing', async () => {
      const user = userEvent.setup();
      render(<PhoneInput id="phone" value="" onChange={vi.fn()} />);

      await user.click(screen.getByRole('button'));
      const searchInput = screen.getByPlaceholderText('Search country...');
      await user.type(searchInput, 'xyznonexistent');

      expect(screen.getByText('No results')).toBeInTheDocument();
    });

    it('changes dial code when a country is selected', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<PhoneInput id="phone" value="+15551234567" onChange={onChange} />);

      // Open dropdown
      await user.click(screen.getByRole('button'));
      // Search for Japan
      await user.type(screen.getByPlaceholderText('Search country...'), 'japan');
      // Click Japan
      await user.click(screen.getByText('Japan'));

      // Dropdown should close
      expect(screen.queryByPlaceholderText('Search country...')).not.toBeInTheDocument();
      // Dial code should now be +81
      expect(screen.getByText('+81')).toBeInTheDocument();
      // onChange should be called with new dial code + existing local number
      const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
      expect(lastCall[0]).toBe('+815551234567');
    });

    it('highlights the currently selected country', async () => {
      const user = userEvent.setup();
      render(<PhoneInput id="phone" value="+447911123456" onChange={vi.fn()} />);

      await user.click(screen.getByRole('button'));

      // Find the UK row - it should have the selected styling
      const ukButton = screen.getByText('United Kingdom').closest('button');
      expect(ukButton).toHaveClass('bg-blue-50');
    });

    it('closes dropdown when clicking outside', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <div>
          <PhoneInput id="phone" value="" onChange={vi.fn()} />
          <div data-testid="outside">outside</div>
        </div>
      );

      await user.click(screen.getByRole('button'));
      expect(screen.getByPlaceholderText('Search country...')).toBeInTheDocument();

      // Click outside
      fireEvent.mouseDown(screen.getByTestId('outside'));
      expect(screen.queryByPlaceholderText('Search country...')).not.toBeInTheDocument();
    });

    it('resets search when dropdown is closed via outside click', async () => {
      const user = userEvent.setup();
      render(
        <div>
          <PhoneInput id="phone" value="" onChange={vi.fn()} />
          <div data-testid="outside">outside</div>
        </div>
      );

      // Open and search
      await user.click(screen.getByRole('button'));
      await user.type(screen.getByPlaceholderText('Search country...'), 'japan');

      // Close via outside click
      fireEvent.mouseDown(screen.getByTestId('outside'));

      // Re-open — search should be cleared, all countries visible
      await user.click(screen.getByRole('button'));
      expect(screen.getByPlaceholderText('Search country...')).toHaveValue('');
      expect(screen.getByText('Afghanistan')).toBeInTheDocument();
      expect(screen.getByText('Zimbabwe')).toBeInTheDocument();
    });

    it('performs case-insensitive search', async () => {
      const user = userEvent.setup();
      render(<PhoneInput id="phone" value="" onChange={vi.fn()} />);

      await user.click(screen.getByRole('button'));
      await user.type(screen.getByPlaceholderText('Search country...'), 'BRAZIL');

      expect(screen.getByText('Brazil')).toBeInTheDocument();
    });

    it('matches partial country names', async () => {
      const user = userEvent.setup();
      render(<PhoneInput id="phone" value="" onChange={vi.fn()} />);

      await user.click(screen.getByRole('button'));
      await user.type(screen.getByPlaceholderText('Search country...'), 'switz');

      expect(screen.getByText('Switzerland')).toBeInTheDocument();
    });
  });

  describe('syncing external value', () => {
    it('updates when value prop changes', () => {
      const { rerender } = render(<PhoneInput id="phone" value="+15551234567" onChange={vi.fn()} />);

      expect(screen.getByRole('textbox')).toHaveValue('5551234567');
      expect(screen.getByText('+1')).toBeInTheDocument();

      rerender(<PhoneInput id="phone" value="+447911123456" onChange={vi.fn()} />);

      expect(screen.getByRole('textbox')).toHaveValue('7911123456');
      expect(screen.getByText('+44')).toBeInTheDocument();
    });
  });

  describe('country data integrity', () => {
    it('has no duplicate country code + name combinations', () => {
      // This is a data integrity check — import the module and verify
      // We can check by rendering and opening dropdown
      const seen = new Set<string>();
      const { container } = render(<PhoneInput id="phone" value="" onChange={vi.fn()} />);

      fireEvent.click(screen.getByRole('button'));

      const buttons = screen.getAllByRole('button').filter(
        (btn) => btn.textContent && btn.textContent.includes('+')
          && btn !== screen.getAllByRole('button')[0] // exclude the toggle button
      );

      for (const btn of buttons) {
        const text = btn.textContent || '';
        if (seen.has(text)) {
          throw new Error(`Duplicate country row: ${text}`);
        }
        seen.add(text);
      }

      expect(buttons.length).toBeGreaterThan(150);
    });
  });
});
