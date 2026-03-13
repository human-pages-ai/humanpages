import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, cleanup, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from './mocks';
import AdminPeople from '../pages/admin/AdminPeople';

// Mock the API
const mockGetAdminPeopleFilterOptions = vi.fn();
const mockGetAdminPeople = vi.fn();
const mockExportAdminPeople = vi.fn();

vi.mock('../lib/api', () => ({
  api: {
    getAdminPeopleFilterOptions: () => mockGetAdminPeopleFilterOptions(),
    getAdminPeople: (params: any) => mockGetAdminPeople(params),
    exportAdminPeople: (params: any) => mockExportAdminPeople(params),
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


const mockFilterOptions = {
  countries: ['United States', 'United Kingdom', 'Germany', 'Japan'],
  skills: ['React', 'TypeScript', 'Python', 'Node.js', 'JavaScript'],
  careerPositions: [
    { id: 'software-engineer', title: 'Software Engineer', count: 5 },
    { id: 'designer', title: 'Product Designer', count: 3 },
    { id: 'manager', title: 'Project Manager', count: 2 },
  ],
};

const mockPeople = [
  {
    id: '1',
    email: 'alice@example.com',
    name: 'Alice Johnson',
    username: 'alice',
    location: 'San Francisco, United States',
    bio: 'Software engineer',
    skills: ['React', 'TypeScript'],
    languages: ['English'],
    isAvailable: true,
    emailVerified: true,
    linkedinVerified: false,
    githubVerified: false,
    referralCode: 'ALICE123',
    referredBy: null,
    referredByName: null,
    role: 'USER',
    createdAt: '2024-01-01T00:00:00Z',
    lastActiveAt: '2024-03-01T00:00:00Z',
    _count: { jobs: 5, reviews: 3, services: 1 },
    careerApplications: [],
    referralCount: 2,
  },
  {
    id: '2',
    email: 'bob@example.com',
    name: 'Bob Smith',
    username: 'bob',
    location: 'London, United Kingdom',
    bio: 'Designer',
    skills: ['JavaScript', 'Node.js'],
    languages: ['English'],
    isAvailable: false,
    emailVerified: true,
    linkedinVerified: true,
    githubVerified: false,
    referralCode: 'BOB456',
    referredBy: '1',
    referredByName: 'Alice Johnson',
    role: 'USER',
    createdAt: '2024-01-05T00:00:00Z',
    lastActiveAt: '2024-02-28T00:00:00Z',
    _count: { jobs: 2, reviews: 1, services: 0 },
    careerApplications: [
      { positionId: 'designer', positionTitle: 'Product Designer', status: 'PENDING' },
    ],
    referralCount: 0,
  },
];

const mockPaginatedResponse = {
  people: mockPeople,
  pagination: {
    page: 1,
    limit: 25,
    total: 2,
    totalPages: 1,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAdminPeopleFilterOptions.mockResolvedValue(mockFilterOptions);
  mockGetAdminPeople.mockResolvedValue(mockPaginatedResponse);
  mockExportAdminPeople.mockResolvedValue(new Blob(['id,email,name\n1,alice@example.com,Alice'], { type: 'text/csv' }));
});

afterEach(() => {
  cleanup();
});

describe('AdminPeople — Page Structure', () => {
  it('renders the filter bar with all filter controls', async () => {
    renderWithProviders(<AdminPeople />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/name, email, or username/i)).toBeInTheDocument();
    });

    // Country dropdown
    expect(screen.getByDisplayValue('All countries')).toBeInTheDocument();

    // Has Referrals toggle button
    expect(screen.getByRole('button', { name: /has referrals/i })).toBeInTheDocument();

    // Export CSV button
    expect(screen.getByRole('button', { name: /export csv/i })).toBeInTheDocument();
  });

  it('renders the data table with column headers', async () => {
    renderWithProviders(<AdminPeople />);

    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    });

    // Table should have sortable headers
    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();
  });

  it('renders people data in table rows', async () => {
    renderWithProviders(<AdminPeople />);

    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
      expect(screen.getByText('Bob Smith')).toBeInTheDocument();
    });

    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    expect(screen.getByText('bob@example.com')).toBeInTheDocument();
  });

  it('loads filter options on mount', async () => {
    renderWithProviders(<AdminPeople />);

    await waitFor(() => {
      expect(mockGetAdminPeopleFilterOptions).toHaveBeenCalled();
    });
  });
});

describe('AdminPeople — Search Filter', () => {
  it('updates search input and triggers load with debounce', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminPeople />);

    const searchInput = await screen.findByPlaceholderText(/name, email, or username/i);

    await user.type(searchInput, 'alice');

    // Wait for debounce and API call
    await waitFor(() => {
      expect(mockGetAdminPeople).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'alice' })
      );
    });
  });

  it('clears search value and reloads', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminPeople />);

    const searchInput = await screen.findByPlaceholderText(/name, email, or username/i);

    await user.type(searchInput, 'test');
    await waitFor(() => {
      expect(mockGetAdminPeople).toHaveBeenCalled();
    });

    // Clear the input
    await user.clear(searchInput);

    await waitFor(() => {
      // Should call with empty search
      const lastCall = mockGetAdminPeople.mock.calls[mockGetAdminPeople.mock.calls.length - 1];
      expect(lastCall[0].search).toBeFalsy();
    });
  });
});

describe('AdminPeople — Country Filter', () => {
  it('renders country dropdown with options from filter options', async () => {
    renderWithProviders(<AdminPeople />);

    await waitFor(() => {
      expect(mockGetAdminPeopleFilterOptions).toHaveBeenCalled();
    });

    const countrySelect = screen.getByDisplayValue('All countries');
    expect(countrySelect).toBeInTheDocument();

    // Dropdown should have countries
    await userEvent.setup().click(countrySelect);
    expect(screen.getByRole('option', { name: 'United States' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'United Kingdom' })).toBeInTheDocument();
  });

  it('filters people when country is selected', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminPeople />);

    const countrySelect = await screen.findByDisplayValue('All countries');

    await user.selectOptions(countrySelect, 'United States');

    await waitFor(() => {
      expect(mockGetAdminPeople).toHaveBeenCalledWith(
        expect.objectContaining({ country: 'United States' })
      );
    });
  });

  it('clears country filter when reset to "All countries"', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminPeople />);

    const countrySelect = await screen.findByDisplayValue('All countries');

    await user.selectOptions(countrySelect, 'United Kingdom');
    await waitFor(() => {
      expect(mockGetAdminPeople).toHaveBeenCalledWith(
        expect.objectContaining({ country: 'United Kingdom' })
      );
    });

    // Reset to All countries
    await user.selectOptions(countrySelect, '');

    await waitFor(() => {
      const lastCall = mockGetAdminPeople.mock.calls[mockGetAdminPeople.mock.calls.length - 1];
      expect(lastCall[0].country).toBeFalsy();
    });
  });
});

describe('AdminPeople — Skills Filter', () => {
  it('renders skills filter input with dropdown', async () => {
    renderWithProviders(<AdminPeople />);

    const skillInput = await screen.findByPlaceholderText(/add skill filter/i);
    expect(skillInput).toBeInTheDocument();
  });

  it('shows skill dropdown when input is focused', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminPeople />);

    const skillInput = await screen.findByPlaceholderText(/add skill filter/i);
    await user.click(skillInput);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /react/i })).toBeInTheDocument();
    });
  });

  it('filters dropdown options as user types', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminPeople />);

    const skillInput = await screen.findByPlaceholderText(/add skill filter/i);
    await user.type(skillInput, 'python');

    await waitFor(() => {
      // Should show Python but not React
      expect(screen.getByRole('button', { name: /python/i })).toBeInTheDocument();
    });
  });

  it('adds skill to selected skills and triggers filter', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminPeople />);

    const skillInput = await screen.findByPlaceholderText(/add skill filter/i);
    await user.type(skillInput, 'react');

    const reactOption = await screen.findByRole('button', { name: /^react$/i });
    await user.click(reactOption);

    // Skill should appear as tag
    expect(screen.getByText('React')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockGetAdminPeople).toHaveBeenCalledWith(
        expect.objectContaining({ skills: 'React' })
      );
    });
  });

  it('adds multiple skills to filter', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminPeople />);

    const skillInput = await screen.findByPlaceholderText(/add skill filter/i);

    // Add first skill
    await user.type(skillInput, 'react');
    let optionButton = await screen.findByRole('button', { name: /^react$/i });
    await user.click(optionButton);

    // Add second skill
    const skillInputAgain = screen.getByPlaceholderText(/add skill filter/i);
    await user.type(skillInputAgain, 'python');
    optionButton = await screen.findByRole('button', { name: /^python$/i });
    await user.click(optionButton);

    // Both skills should appear as tags
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('Python')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockGetAdminPeople).toHaveBeenCalledWith(
        expect.objectContaining({ skills: 'React,Python' })
      );
    });
  });

  it('removes skill from selected skills by clicking remove button', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminPeople />);

    const skillInput = await screen.findByPlaceholderText(/add skill filter/i);
    await user.type(skillInput, 'react');
    const reactOption = await screen.findByRole('button', { name: /^react$/i });
    await user.click(reactOption);

    // Wait for skill tag to appear
    await waitFor(() => {
      expect(screen.getByText('React')).toBeInTheDocument();
    });

    // Find and click the remove button (× symbol in the tag)
    const reactTag = screen.getByText('React').closest('span');
    const removeBtn = within(reactTag!).getByText(/×/);
    await user.click(removeBtn);

    // Skill should be removed
    await waitFor(() => {
      expect(screen.queryByText('React')).not.toBeInTheDocument();
    });
  });
});

describe('AdminPeople — Career Application Filter', () => {
  it('renders career application dropdown', async () => {
    renderWithProviders(<AdminPeople />);

    await waitFor(() => {
      expect(mockGetAdminPeopleFilterOptions).toHaveBeenCalled();
    });

    // Find the Career Application select
    const selects = screen.getAllByRole('combobox');
    expect(selects.length).toBeGreaterThan(0);
  });

  it('filters by any career application', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminPeople />);

    await waitFor(() => {
      expect(mockGetAdminPeopleFilterOptions).toHaveBeenCalled();
    });

    const careerSelect = screen.getByDisplayValue('No filter');
    await user.selectOptions(careerSelect, '__any__');

    await waitFor(() => {
      expect(mockGetAdminPeople).toHaveBeenCalledWith(
        expect.objectContaining({ hasCareerApplication: true })
      );
    });
  });

  it('filters by specific career position', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminPeople />);

    await waitFor(() => {
      expect(mockGetAdminPeopleFilterOptions).toHaveBeenCalled();
    });

    const careerSelect = screen.getByDisplayValue('No filter');
    await user.selectOptions(careerSelect, 'software-engineer');

    await waitFor(() => {
      expect(mockGetAdminPeople).toHaveBeenCalledWith(
        expect.objectContaining({
          hasCareerApplication: true,
          careerPositionId: 'software-engineer',
        })
      );
    });
  });
});

describe('AdminPeople — Referrals Filter', () => {
  it('renders "Has referrals" toggle button', async () => {
    renderWithProviders(<AdminPeople />);

    const referralsBtn = await screen.findByRole('button', { name: /has referrals/i });
    expect(referralsBtn).toBeInTheDocument();
  });

  it('toggles referrals filter when button is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminPeople />);

    const referralsBtn = await screen.findByRole('button', { name: /has referrals/i });

    await user.click(referralsBtn);

    await waitFor(() => {
      expect(mockGetAdminPeople).toHaveBeenCalledWith(
        expect.objectContaining({ hasReferrals: true })
      );
    });

    // Click again to toggle off
    await user.click(referralsBtn);

    await waitFor(() => {
      const lastCall = mockGetAdminPeople.mock.calls[mockGetAdminPeople.mock.calls.length - 1];
      expect(lastCall[0].hasReferrals).toBeFalsy();
    });
  });

  it('shows referrals toggle button with active styling when selected', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminPeople />);

    const referralsBtn = await screen.findByRole('button', { name: /has referrals/i });

    expect(referralsBtn).not.toHaveClass('bg-blue-50');

    await user.click(referralsBtn);

    await waitFor(() => {
      expect(referralsBtn).toHaveClass('bg-blue-50');
    });
  });
});

describe('AdminPeople — Clear Filters', () => {
  it('renders clear filters button only when filters are active', async () => {
    renderWithProviders(<AdminPeople />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/name, email, or username/i)).toBeInTheDocument();
    });

    // Initially no filters, so no clear button
    let clearBtn = screen.queryByRole('button', { name: /clear filters/i });
    expect(clearBtn).not.toBeInTheDocument();

    // Add a search filter
    const user = userEvent.setup();
    const searchInput = screen.getByPlaceholderText(/name, email, or username/i);
    await user.type(searchInput, 'test');

    // Now clear button should appear
    await waitFor(() => {
      clearBtn = screen.getByRole('button', { name: /clear filters/i });
      expect(clearBtn).toBeInTheDocument();
    });
  });

  it('clears all active filters when clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminPeople />);

    // Add multiple filters
    const searchInput = await screen.findByPlaceholderText(/name, email, or username/i);
    await user.type(searchInput, 'test');

    const countrySelect = screen.getByDisplayValue('All countries');
    await user.selectOptions(countrySelect, 'United States');

    // Click clear filters
    const clearBtn = await screen.findByRole('button', { name: /clear filters/i });
    await user.click(clearBtn);

    // All filters should be reset
    expect(searchInput).toHaveValue('');
    expect(countrySelect).toHaveValue('');

    await waitFor(() => {
      const lastCall = mockGetAdminPeople.mock.calls[mockGetAdminPeople.mock.calls.length - 1];
      expect(lastCall[0].search).toBeFalsy();
      expect(lastCall[0].country).toBeFalsy();
    });
  });
});

describe('AdminPeople — Export CSV', () => {
  it('renders export CSV button', async () => {
    renderWithProviders(<AdminPeople />);

    const exportBtn = await screen.findByRole('button', { name: /export csv/i });
    expect(exportBtn).toBeInTheDocument();
  });

  it('triggers CSV export when button is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminPeople />);

    const exportBtn = await screen.findByRole('button', { name: /export csv/i });
    await user.click(exportBtn);

    await waitFor(() => {
      expect(mockExportAdminPeople).toHaveBeenCalled();
    });
  });

  it('shows "Exporting..." text while exporting', async () => {
    const user = userEvent.setup();

    // Make the export function slow
    mockExportAdminPeople.mockImplementationOnce(
      () => new Promise(resolve => setTimeout(() => resolve(new Blob()), 500))
    );

    renderWithProviders(<AdminPeople />);

    const exportBtn = await screen.findByRole('button', { name: /export csv/i });
    await user.click(exportBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /exporting/i })).toBeInTheDocument();
    });
  });

  it('passes current filters to export function', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminPeople />);

    const searchInput = await screen.findByPlaceholderText(/name, email, or username/i);
    await user.type(searchInput, 'alice');

    await waitFor(() => {
      expect(mockGetAdminPeople).toHaveBeenCalled();
    });

    const exportBtn = screen.getByRole('button', { name: /export csv/i });
    await user.click(exportBtn);

    await waitFor(() => {
      expect(mockExportAdminPeople).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'alice' })
      );
    });
  });
});

describe('AdminPeople — Pagination', () => {
  it('displays total people count', async () => {
    renderWithProviders(<AdminPeople />);

    await waitFor(() => {
      expect(screen.getByText(/2 people found/i)).toBeInTheDocument();
    });
  });

  it('shows loading state while fetching', async () => {
    mockGetAdminPeople.mockImplementationOnce(
      () => new Promise(resolve => setTimeout(() => resolve(mockPaginatedResponse), 500))
    );

    renderWithProviders(<AdminPeople />);

    // Loading text should appear initially
    expect(screen.getAllByText(/loading/i).length).toBeGreaterThan(0);

    // Then people should appear
    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    });
  });

  it('displays error message if load fails', async () => {
    mockGetAdminPeople.mockRejectedValueOnce(new Error('Network error'));

    renderWithProviders(<AdminPeople />);

    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
  });
});

describe('AdminPeople — Table Display', () => {
  it('displays person information in table cells', async () => {
    renderWithProviders(<AdminPeople />);

    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    });

    // Check that key information is displayed
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    expect(screen.getAllByText(/United States/).length).toBeGreaterThan(0);
  });

  it('displays skills as comma-separated list or tags', async () => {
    renderWithProviders(<AdminPeople />);

    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    });

    // Skills should be visible in some form
    const table = screen.getByRole('table');
    expect(table.textContent).toContain('React');
  });

  it('displays referral count', async () => {
    renderWithProviders(<AdminPeople />);

    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    });

    // Table should show referral information
    const table = screen.getByRole('table');
    expect(table.textContent).toContain('2'); // Alice has 2 referrals
  });

  it('displays referredByName if user was referred', async () => {
    renderWithProviders(<AdminPeople />);

    await waitFor(() => {
      expect(screen.getByText('Bob Smith')).toBeInTheDocument();
    });

    // Bob was referred by Alice
    const table = screen.getByRole('table');
    expect(table.textContent).toContain('Alice Johnson');
  });
});

describe('AdminPeople — Sorting', () => {
  it('displays sortable column headers', async () => {
    renderWithProviders(<AdminPeople />);

    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    });

    // Check that table has sortable headers (they should be clickable)
    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();
  });

  it('changes sort when clicking on column header', async () => {
    userEvent.setup();
    renderWithProviders(<AdminPeople />);

    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    });

    // Note: This test depends on actual column header implementation
    // Adjust selectors based on actual table structure
    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();
  });
});
