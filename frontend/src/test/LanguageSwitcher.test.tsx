import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { renderWithProviders } from './mocks';

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
vi.mock('../lib/safeStorage', () => {
  const store: Record<string, string> = {};
  const sessionStore: Record<string, string> = {};
  const makeMock = (s: Record<string, string>) => ({
    getItem: vi.fn((k: string) => s[k] ?? null),
    setItem: vi.fn((k: string, v: string) => { s[k] = v; }),
    removeItem: vi.fn((k: string) => { delete s[k]; }),
    clear: vi.fn(() => { for (const k of Object.keys(s)) delete s[k]; }),
    isAvailable: vi.fn(() => true),
  });
  return {
    safeLocalStorage: makeMock(store),
    safeSessionStorage: makeMock(sessionStore),
    safeGetItem: vi.fn((k: string) => store[k] ?? null),
    safeSetItem: vi.fn((k: string, v: string) => { store[k] = v; }),
    safeRemoveItem: vi.fn((k: string) => { delete store[k]; }),
  };
});


describe('LanguageSwitcher', () => {
  it('renders the language switcher button', () => {
    renderWithProviders(<LanguageSwitcher />);

    const button = screen.getByRole('button', { name: /select language/i });
    expect(button).toBeInTheDocument();
  });

  it('shows the dropdown when clicked', () => {
    renderWithProviders(<LanguageSwitcher />);

    const button = screen.getByRole('button', { name: /select language/i });
    fireEvent.click(button);

    // Should show language options (using getAllByText since English appears twice)
    const englishElements = screen.getAllByText('English');
    expect(englishElements.length).toBeGreaterThan(0);
    expect(screen.getByText('Español')).toBeInTheDocument();
    expect(screen.getByText('中文')).toBeInTheDocument();
  });
});
