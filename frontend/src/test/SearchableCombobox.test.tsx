import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SearchableCombobox from '../components/common/SearchableCombobox';

describe('SearchableCombobox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders with placeholder', () => {
      const onChange = vi.fn();
      render(
        <SearchableCombobox
          value=""
          onChange={onChange}
          options={[]}
          placeholder="Search items"
        />
      );

      const input = screen.getByRole('combobox') as HTMLInputElement;
      expect(input.placeholder).toBe('Search items');
    });

    it('renders with label', () => {
      const onChange = vi.fn();
      render(
        <SearchableCombobox
          id="test-combo"
          label="Test Label"
          value=""
          onChange={onChange}
          options={[]}
        />
      );

      expect(screen.getByText('Test Label')).toBeInTheDocument();
    });

    it('renders input with aria attributes', () => {
      const onChange = vi.fn();
      render(
        <SearchableCombobox
          value=""
          onChange={onChange}
          options={['Option 1']}
        />
      );

      const input = screen.getByRole('combobox');
      expect(input).toHaveAttribute('aria-haspopup', 'listbox');
      expect(input).toHaveAttribute('aria-autocomplete', 'list');
      expect(input).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('dropdown behavior', () => {
    it('opens dropdown on focus', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <SearchableCombobox
          value=""
          onChange={onChange}
          options={['Option 1', 'Option 2']}
        />
      );

      const input = screen.getByRole('combobox');
      await user.click(input);

      expect(input).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      expect(screen.getByText('Option 1')).toBeInTheDocument();
      expect(screen.getByText('Option 2')).toBeInTheDocument();
    });

    it('closes dropdown when clicking outside', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <SearchableCombobox
          value=""
          onChange={onChange}
          options={['Option 1']}
        />
      );

      const input = screen.getByRole('combobox');
      await user.click(input);
      expect(screen.getByRole('listbox')).toBeInTheDocument();

      // Click outside
      await user.click(document.body);
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('closes dropdown on Escape key', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <SearchableCombobox
          value=""
          onChange={onChange}
          options={['Option 1']}
        />
      );

      const input = screen.getByRole('combobox');
      await user.click(input);
      expect(screen.getByRole('listbox')).toBeInTheDocument();

      await user.keyboard('{Escape}');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  });

  describe('filtering', () => {
    it('filters options as user types (case-insensitive)', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <SearchableCombobox
          value=""
          onChange={onChange}
          options={['Apple', 'Apricot', 'Banana', 'Cherry']}
        />
      );

      const input = screen.getByRole('combobox');
      await user.click(input);
      await user.type(input, 'ap');

      expect(screen.getByText('Apple')).toBeInTheDocument();
      expect(screen.getByText('Apricot')).toBeInTheDocument();
      expect(screen.queryByText('Banana')).not.toBeInTheDocument();
      expect(screen.queryByText('Cherry')).not.toBeInTheDocument();
    });

    it('shows all options when search is empty', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const options = ['Option 1', 'Option 2', 'Option 3'];
      render(
        <SearchableCombobox
          value=""
          onChange={onChange}
          options={options}
        />
      );

      const input = screen.getByRole('combobox');
      await user.click(input);

      options.forEach(opt => {
        expect(screen.getByText(opt)).toBeInTheDocument();
      });
    });

    it('prefix matches appear before substring matches', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <SearchableCombobox
          value=""
          onChange={onChange}
          options={['Backend', 'Frontend', 'Design Backend', 'WebBackend']}
        />
      );

      const input = screen.getByRole('combobox');
      await user.click(input);
      await user.type(input, 'back');

      const listbox = screen.getByRole('listbox');
      const options = within(listbox).getAllByRole('option');

      // "Backend" (prefix match) should come first
      expect(options[0].textContent).toBe('Backend');
      // Then substring matches
      expect(options[1].textContent).toMatch(/Design Backend|WebBackend/);
    });

    it('shows "No matches" message when no results and allowFreeText is false', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <SearchableCombobox
          value=""
          onChange={onChange}
          options={['Apple', 'Banana']}
          allowFreeText={false}
        />
      );

      const input = screen.getByRole('combobox');
      await user.click(input);
      await user.type(input, 'xyznonexistent');

      expect(screen.getByText('No matching options')).toBeInTheDocument();
    });

    it('shows free text message when no results and allowFreeText is true', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <SearchableCombobox
          value=""
          onChange={onChange}
          options={['Apple', 'Banana']}
          allowFreeText={true}
        />
      );

      const input = screen.getByRole('combobox');
      await user.click(input);
      await user.type(input, 'xyznonexistent');

      expect(screen.getByText(/No matches — press Enter to use custom value/)).toBeInTheDocument();
    });

    it('limits displayed results to 15 options', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const options = Array.from({ length: 100 }, (_, i) => `Option ${i + 1}`);

      render(
        <SearchableCombobox
          value=""
          onChange={onChange}
          options={options}
        />
      );

      const input = screen.getByRole('combobox');
      await user.click(input);

      const listbox = screen.getByRole('listbox');
      const displayedOptions = within(listbox).getAllByRole('option');

      expect(displayedOptions.length).toBe(15);
    });
  });

  describe('selection', () => {
    it('calls onChange and closes dropdown when option is clicked', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <SearchableCombobox
          value=""
          onChange={onChange}
          options={['Option 1', 'Option 2']}
        />
      );

      const input = screen.getByRole('combobox');
      await user.click(input);

      const option1 = screen.getByText('Option 1');
      await user.click(option1);

      expect(onChange).toHaveBeenCalledWith('Option 1');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('displays selected option in input', () => {
      const onChange = vi.fn();
      render(
        <SearchableCombobox
          value="Option 1"
          onChange={onChange}
          options={['Option 1', 'Option 2']}
        />
      );

      const input = screen.getByRole('combobox') as HTMLInputElement;
      expect(input.value).toBe('Option 1');
    });

    it('highlights selected option', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <SearchableCombobox
          value="Option 1"
          onChange={onChange}
          options={['Option 1', 'Option 2']}
        />
      );

      const input = screen.getByRole('combobox');
      await user.click(input);

      const option1 = screen.getByText('Option 1').closest('[role="option"]');
      expect(option1).toHaveClass('bg-blue-50', 'text-blue-700', 'font-medium');
    });
  });

  describe('free text mode', () => {
    it('accepts custom value when allowFreeText is true', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <SearchableCombobox
          value=""
          onChange={onChange}
          options={['Option 1']}
          allowFreeText={true}
        />
      );

      const input = screen.getByRole('combobox');
      await user.click(input);
      await user.type(input, 'Custom Value');

      // Click outside to accept
      await user.click(document.body);

      expect(onChange).toHaveBeenCalledWith('Custom Value');
    });

    it('accepts free text on Enter key', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <SearchableCombobox
          value=""
          onChange={onChange}
          options={['Option 1']}
          allowFreeText={true}
        />
      );

      const input = screen.getByRole('combobox');
      await user.click(input);
      await user.type(input, 'Custom Value');
      await user.keyboard('{Enter}');

      expect(onChange).toHaveBeenCalledWith('Custom Value');
    });

    it('does not accept custom value when allowFreeText is false', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <SearchableCombobox
          value=""
          onChange={onChange}
          options={['Option 1']}
          allowFreeText={false}
        />
      );

      const input = screen.getByRole('combobox') as HTMLInputElement;
      await user.click(input);
      await user.type(input, 'Custom Value');

      // Click outside to try to accept
      await user.click(document.body);

      // Should revert to empty value
      expect(input.value).toBe('');
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('keyboard navigation', () => {
    it('navigates options with ArrowDown', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <SearchableCombobox
          value=""
          onChange={onChange}
          options={['Option 1', 'Option 2', 'Option 3']}
        />
      );

      const input = screen.getByRole('combobox');
      await user.click(input);

      await user.keyboard('{ArrowDown}');
      expect(screen.getByText('Option 1').closest('[role="option"]')).toHaveClass('bg-gray-100');

      await user.keyboard('{ArrowDown}');
      expect(screen.getByText('Option 2').closest('[role="option"]')).toHaveClass('bg-gray-100');
    });

    it('navigates options with ArrowUp', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <SearchableCombobox
          value=""
          onChange={onChange}
          options={['Option 1', 'Option 2', 'Option 3']}
        />
      );

      const input = screen.getByRole('combobox');
      await user.click(input);

      // Go down twice, then up
      await user.keyboard('{ArrowDown}{ArrowDown}');
      await user.keyboard('{ArrowUp}');

      expect(screen.getByText('Option 1').closest('[role="option"]')).toHaveClass('bg-gray-100');
    });

    it('wraps around when navigating past last option', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <SearchableCombobox
          value=""
          onChange={onChange}
          options={['Option 1', 'Option 2']}
        />
      );

      const input = screen.getByRole('combobox');
      await user.click(input);

      await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');

      expect(screen.getByText('Option 1').closest('[role="option"]')).toHaveClass('bg-gray-100');
    });

    it('wraps around when navigating above first option', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <SearchableCombobox
          value=""
          onChange={onChange}
          options={['Option 1', 'Option 2']}
        />
      );

      const input = screen.getByRole('combobox');
      await user.click(input);

      await user.keyboard('{ArrowUp}');

      expect(screen.getByText('Option 2').closest('[role="option"]')).toHaveClass('bg-gray-100');
    });

    it('selects highlighted option with Enter', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <SearchableCombobox
          value=""
          onChange={onChange}
          options={['Option 1', 'Option 2']}
        />
      );

      const input = screen.getByRole('combobox');
      await user.click(input);
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');

      expect(onChange).toHaveBeenCalledWith('Option 1');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('reverts search on Escape key', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <SearchableCombobox
          value="Original"
          onChange={onChange}
          options={['Original', 'Other']}
        />
      );

      const input = screen.getByRole('combobox') as HTMLInputElement;
      await user.click(input);
      await user.type(input, 'xyz');

      expect(input.value).toBe('Originalxyz');

      await user.keyboard('{Escape}');

      expect(input.value).toBe('Original');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  });

  describe('async options', () => {
    it('loads options on first focus', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const loadOptions = vi.fn().mockResolvedValue(['Async Option 1', 'Async Option 2']);

      render(
        <SearchableCombobox
          value=""
          onChange={onChange}
          options={loadOptions}
        />
      );

      const input = screen.getByRole('combobox');
      await user.click(input);

      await waitFor(() => {
        expect(loadOptions).toHaveBeenCalledTimes(1);
      });

      await waitFor(() => {
        expect(screen.getByText('Async Option 1')).toBeInTheDocument();
        expect(screen.getByText('Async Option 2')).toBeInTheDocument();
      });
    });

    it('shows loading state while async options are loading', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const loadOptions = vi.fn(() => new Promise<string[]>(resolve =>
        setTimeout(() => resolve(['Async Option 1']), 100)
      )) as () => Promise<string[]>;

      render(
        <SearchableCombobox
          value=""
          onChange={onChange}
          options={loadOptions}
        />
      );

      const input = screen.getByRole('combobox');
      await user.click(input);

      // Should show loading state initially
      expect(screen.getByText('Loading options...')).toBeInTheDocument();

      // Wait for options to load
      await waitFor(() => {
        expect(screen.getByText('Async Option 1')).toBeInTheDocument();
      });
    });

    it('only loads async options once', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const loadOptions = vi.fn().mockResolvedValue(['Async Option 1']) as () => Promise<string[]>;

      render(
        <SearchableCombobox
          value=""
          onChange={onChange}
          options={loadOptions}
        />
      );

      const input = screen.getByRole('combobox');

      // First focus - should load
      await user.click(input);
      await waitFor(() => {
        expect(loadOptions).toHaveBeenCalledTimes(1);
      });

      // Close and reopen
      await user.keyboard('{Escape}');
      await user.click(input);

      // Should still only have been called once
      expect(loadOptions).toHaveBeenCalledTimes(1);
    });

    it('handles async loading errors gracefully', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const loadOptions = vi.fn().mockRejectedValue(new Error('Load failed'));

      render(
        <SearchableCombobox
          value=""
          onChange={onChange}
          options={loadOptions}
          allowFreeText={false}
        />
      );

      const input = screen.getByRole('combobox');
      await user.click(input);

      await waitFor(() => {
        // Should show empty state after error
        expect(screen.getByText('No matching options')).toBeInTheDocument();
      });
    });
  });

  describe('required field', () => {
    it('sets required attribute on input', () => {
      const onChange = vi.fn();
      render(
        <SearchableCombobox
          value=""
          onChange={onChange}
          options={['Option 1']}
          required={true}
        />
      );

      const input = screen.getByRole('combobox');
      expect(input).toHaveAttribute('required');
    });

    it('does not set required when not specified', () => {
      const onChange = vi.fn();
      render(
        <SearchableCombobox
          value=""
          onChange={onChange}
          options={['Option 1']}
        />
      );

      const input = screen.getByRole('combobox');
      expect(input).not.toHaveAttribute('required');
    });
  });

  describe('styling', () => {
    it('applies custom className', () => {
      const onChange = vi.fn();
      render(
        <SearchableCombobox
          value=""
          onChange={onChange}
          options={['Option 1']}
          className="custom-class"
        />
      );

      const container = screen.getByRole('combobox').closest('div')?.parentElement;
      expect(container).toHaveClass('custom-class');
    });

    it('shows option as hovered when highlighted', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <SearchableCombobox
          value=""
          onChange={onChange}
          options={['Option 1', 'Option 2']}
        />
      );

      const input = screen.getByRole('combobox');
      await user.click(input);
      await user.keyboard('{ArrowDown}');

      const option1 = screen.getByText('Option 1').closest('[role="option"]');
      expect(option1).toHaveClass('bg-gray-100', 'text-gray-900');
    });
  });

  describe('edge cases', () => {
    it('handles empty options array', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <SearchableCombobox
          value=""
          onChange={onChange}
          options={[]}
          allowFreeText={false}
        />
      );

      const input = screen.getByRole('combobox');
      await user.click(input);

      expect(screen.getByText('No matching options')).toBeInTheDocument();
    });

    it('handles options with special characters', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const options = ['C++ Programming', 'C# Development', 'Node.js', 'F#'];

      render(
        <SearchableCombobox
          value=""
          onChange={onChange}
          options={options}
        />
      );

      const input = screen.getByRole('combobox');
      await user.click(input);
      await user.type(input, 'c#');

      expect(screen.getByText('C# Development')).toBeInTheDocument();
    });

    it('handles very long option text', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const longText = 'This is a very long option text that should still display properly without breaking the layout';

      render(
        <SearchableCombobox
          value=""
          onChange={onChange}
          options={[longText]}
        />
      );

      const input = screen.getByRole('combobox');
      await user.click(input);

      expect(screen.getByText(longText)).toBeInTheDocument();
    });

    it('resets search on value change from outside', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const { rerender } = render(
        <SearchableCombobox
          value=""
          onChange={onChange}
          options={['Option 1', 'Option 2']}
        />
      );

      const input = screen.getByRole('combobox') as HTMLInputElement;
      await user.click(input);
      await user.type(input, 'search');

      // Rerender with new value (from outside)
      rerender(
        <SearchableCombobox
          value="Option 1"
          onChange={onChange}
          options={['Option 1', 'Option 2']}
        />
      );

      // When dropdown is closed, search should match value
      await user.keyboard('{Escape}');
      expect(input.value).toBe('Option 1');
    });
  });
});
