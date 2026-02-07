import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LanguageSwitcher from '../components/LanguageSwitcher';

// Mock useAuth hook
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
  }),
}));

// Mock api
vi.mock('../lib/api', () => ({
  api: {
    updateProfile: vi.fn(),
  },
}));

describe('LanguageSwitcher', () => {
  it('renders the language switcher button', () => {
    render(<LanguageSwitcher />);

    const button = screen.getByRole('button', { name: /select language/i });
    expect(button).toBeInTheDocument();
  });

  it('shows the dropdown when clicked', () => {
    render(<LanguageSwitcher />);

    const button = screen.getByRole('button', { name: /select language/i });
    fireEvent.click(button);

    // Should show language options (using getAllByText since English appears twice)
    const englishElements = screen.getAllByText('English');
    expect(englishElements.length).toBeGreaterThan(0);
    expect(screen.getByText('Español')).toBeInTheDocument();
    expect(screen.getByText('中文')).toBeInTheDocument();
  });
});
