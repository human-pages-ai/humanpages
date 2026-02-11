import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProfileSection from '../components/dashboard/ProfileSection';
import { Profile } from '../components/dashboard/types';

// Mock react-i18next – pass through keys as text
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, string>) => {
      if (opts?.username) return key.replace('{{username}}', opts.username);
      return key;
    },
    i18n: { language: 'en' },
  }),
}));

// Mock LocationAutocomplete — just a simple input
vi.mock('../components/LocationAutocomplete', () => ({
  default: ({ id, value, onChange, className }: any) => (
    <input
      id={id}
      data-testid="location-autocomplete"
      value={value || ''}
      onChange={(e: any) => onChange(e.target.value)}
      className={className}
    />
  ),
}));

// Mock PhoneInput — simple input that calls onChange with value.
// Since ProfileSection lazy-loads PhoneInput, we need to mock the module
// so that the lazy() import resolves to our mock.
vi.mock('../components/PhoneInput', () => ({
  default: ({ id, value, onChange, className }: any) => (
    <input
      id={id}
      data-testid="phone-input"
      value={value || ''}
      onChange={(e: any) => onChange(e.target.value)}
      className={className}
    />
  ),
}));

const baseProfile: Profile = {
  id: 'test-id',
  referralCode: 'REF123',
  name: 'Test User',
  email: 'test@example.com',
  username: 'testuser',
  bio: 'A bio',
  location: 'New York',
  skills: ['react', 'typescript'],
  equipment: ['laptop'],
  languages: ['English'],
  contactEmail: 'test@example.com',
  telegram: '@testhandle',
  whatsapp: '+15551234567',
  isAvailable: true,
  linkedinUrl: 'https://linkedin.com/in/test',
  twitterUrl: '',
  githubUrl: 'https://github.com/test',
  instagramUrl: '',
  youtubeUrl: '',
  websiteUrl: '',
  wallets: [],
  services: [],
};

const baseFormState = {
  name: 'Test User',
  bio: 'A bio',
  location: 'New York',
  neighborhood: '',
  locationGranularity: 'city' as const,
  skills: 'react, typescript',
  equipment: ['laptop'],
  languages: ['English'],
  contactEmail: 'test@example.com',
  telegram: '@testhandle',
  whatsapp: '+15551234567',
  paymentMethods: '',
  hideContact: false,
  username: 'testuser',
  linkedinUrl: 'https://linkedin.com/in/test',
  twitterUrl: '',
  githubUrl: 'https://github.com/test',
  instagramUrl: '',
  youtubeUrl: '',
  websiteUrl: '',
};

function renderSection(overrides: Record<string, any> = {}) {
  const props = {
    profile: baseProfile,
    editingProfile: false,
    setEditingProfile: vi.fn(),
    hasWallet: false,
    onScrollToWallets: vi.fn(),
    profileForm: { ...baseFormState },
    setProfileForm: vi.fn(),
    saving: false,
    autoSaving: false,
    onSaveProfile: vi.fn(),
    onCheckUsername: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
  const result = render(<ProfileSection {...props} />);
  return { ...result, props };
}

describe('ProfileSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  // ─── View mode (editingProfile = false) ─────────────────────────────
  describe('view mode', () => {
    it('renders the section heading and Edit button', () => {
      renderSection();
      expect(screen.getByText('dashboard.profile.title')).toBeInTheDocument();
      expect(screen.getByText('common.edit')).toBeInTheDocument();
    });

    it('displays profile name and username', () => {
      renderSection();
      expect(screen.getByText('Test User')).toBeInTheDocument();
      expect(screen.getByText('@testuser')).toBeInTheDocument();
    });

    it('shows "Not Set" for missing optional fields', () => {
      renderSection({
        profile: { ...baseProfile, bio: undefined, location: undefined },
      });
      const notSetEls = screen.getAllByText('common.notSet');
      expect(notSetEls.length).toBeGreaterThanOrEqual(2);
    });

    it('displays skills as badges', () => {
      renderSection();
      expect(screen.getByText('react')).toBeInTheDocument();
      expect(screen.getByText('typescript')).toBeInTheDocument();
    });

    it('displays equipment as badges', () => {
      renderSection();
      expect(screen.getByText('laptop')).toBeInTheDocument();
    });

    it('displays language badges', () => {
      renderSection();
      expect(screen.getByText('English')).toBeInTheDocument();
    });

    it('shows Telegram link in view mode', () => {
      renderSection();
      const link = screen.getByText('@testhandle');
      expect(link).toBeInTheDocument();
      expect(link.closest('a')).toHaveAttribute('href', 'https://t.me/testhandle');
    });

    it('shows WhatsApp link in view mode', () => {
      renderSection();
      const link = screen.getByText('+15551234567');
      expect(link).toBeInTheDocument();
      expect(link.closest('a')).toHaveAttribute('href', 'https://wa.me/15551234567');
    });

    it('shows social profile links when present', () => {
      renderSection();
      const linkedinLink = screen.getByText('dashboard.profile.linkedin');
      expect(linkedinLink.closest('a')).toHaveAttribute('href', 'https://linkedin.com/in/test');
      const githubLink = screen.getByText('dashboard.profile.github');
      expect(githubLink.closest('a')).toHaveAttribute('href', 'https://github.com/test');
    });

    it('does not show social section when no profiles are set', () => {
      renderSection({
        profile: {
          ...baseProfile,
          linkedinUrl: '',
          twitterUrl: '',
          githubUrl: '',
          instagramUrl: '',
          youtubeUrl: '',
          websiteUrl: '',
        },
      });
      expect(screen.queryByText('dashboard.profile.socialProfiles')).not.toBeInTheDocument();
    });

    it('shows USDC wallet connected badge when hasWallet is true', () => {
      renderSection({ hasWallet: true, editingProfile: true });
      expect(screen.getByText('dashboard.profile.walletConnected')).toBeInTheDocument();
    });

    it('shows connect wallet prompt when hasWallet is false', () => {
      renderSection({ hasWallet: false, editingProfile: true });
      expect(screen.getByText('dashboard.profile.connectWalletPrompt')).toBeInTheDocument();
    });

    it('calls setEditingProfile when Edit button is clicked', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const { props } = renderSection();

      await user.click(screen.getByText('common.edit'));
      expect(props.setEditingProfile).toHaveBeenCalledWith(true);
    });
  });

  // ─── Edit mode ──────────────────────────────────────────────────────
  describe('edit mode', () => {
    it('renders all form fields when editingProfile is true', async () => {
      renderSection({ editingProfile: true });

      expect(document.getElementById('profile-name')).toBeInTheDocument();
      expect(document.getElementById('profile-username')).toBeInTheDocument();
      expect(document.getElementById('profile-bio')).toBeInTheDocument();
      expect(document.getElementById('profile-skills')).toBeInTheDocument();
      expect(document.getElementById('profile-contact-email')).toBeInTheDocument();
      expect(document.getElementById('profile-telegram')).toBeInTheDocument();
      // PhoneInput is lazy-loaded via React.lazy/Suspense
      await waitFor(() => {
        expect(screen.getByTestId('phone-input')).toBeInTheDocument();
      });
    });

    it('shows Cancel button instead of Edit in edit mode', () => {
      renderSection({ editingProfile: true });
      expect(screen.getByText('common.cancel')).toBeInTheDocument();
      expect(screen.queryByText('common.edit')).not.toBeInTheDocument();
    });

    it('shows Done button and auto-save status', () => {
      renderSection({ editingProfile: true, autoSaving: false, saving: false });
      expect(screen.getByText('common.done')).toBeInTheDocument();
      expect(screen.getByText('dashboard.profile.saved')).toBeInTheDocument();
    });

    it('shows saving indicator when autoSaving is true', () => {
      renderSection({ editingProfile: true, autoSaving: true });
      expect(screen.getByText('dashboard.profile.saving')).toBeInTheDocument();
    });

    it('calls onSaveProfile when Done button is clicked', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const { props } = renderSection({ editingProfile: true });

      await user.click(screen.getByText('common.done'));
      expect(props.onSaveProfile).toHaveBeenCalledTimes(1);
    });

    it('calls setProfileForm when name is changed', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const { props } = renderSection({ editingProfile: true });

      const nameInput = document.getElementById('profile-name') as HTMLInputElement;
      await user.clear(nameInput);
      await user.type(nameInput, 'New Name');

      expect(props.setProfileForm).toHaveBeenCalled();
      // Last call should include the typed character
      const lastCall = props.setProfileForm.mock.calls[props.setProfileForm.mock.calls.length - 1][0];
      expect(lastCall.name).toContain('e'); // last char of 'New Name'
    });
  });

  // ─── Equipment toggles ─────────────────────────────────────────────
  describe('equipment toggles', () => {
    it('renders all 9 equipment options', () => {
      renderSection({ editingProfile: true });
      const equipmentOptions = ['car', 'bike', 'drone', 'camera', 'smartphone', 'laptop', 'tools', 'van', 'motorcycle'];
      for (const eq of equipmentOptions) {
        expect(screen.getByText(eq)).toBeInTheDocument();
      }
    });

    it('shows selected equipment with active styling', () => {
      renderSection({
        editingProfile: true,
        profileForm: { ...baseFormState, equipment: ['drone', 'camera'] },
      });

      const droneBtn = screen.getByText('drone');
      expect(droneBtn).toHaveClass('bg-indigo-600');
      expect(droneBtn).toHaveClass('text-white');

      const carBtn = screen.getByText('car');
      expect(carBtn).not.toHaveClass('bg-indigo-600');
    });

    it('calls setProfileForm to add equipment when unselected item is clicked', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const { props } = renderSection({
        editingProfile: true,
        profileForm: { ...baseFormState, equipment: ['laptop'] },
      });

      await user.click(screen.getByText('drone'));

      expect(props.setProfileForm).toHaveBeenCalledWith(
        expect.objectContaining({ equipment: ['laptop', 'drone'] }),
      );
    });

    it('calls setProfileForm to remove equipment when selected item is clicked', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const { props } = renderSection({
        editingProfile: true,
        profileForm: { ...baseFormState, equipment: ['laptop', 'drone'] },
      });

      await user.click(screen.getByText('laptop'));

      expect(props.setProfileForm).toHaveBeenCalledWith(
        expect.objectContaining({ equipment: ['drone'] }),
      );
    });
  });

  // ─── Language toggles ──────────────────────────────────────────────
  describe('language toggles', () => {
    it('renders all 15 language options', () => {
      renderSection({ editingProfile: true });
      const languages = ['English', 'Spanish', 'Chinese', 'Hindi', 'Filipino', 'Vietnamese', 'Turkish', 'Thai', 'French', 'Arabic', 'Portuguese', 'German', 'Japanese', 'Korean', 'Russian'];
      for (const lang of languages) {
        expect(screen.getByText(lang)).toBeInTheDocument();
      }
    });

    it('shows selected languages with active styling', () => {
      renderSection({
        editingProfile: true,
        profileForm: { ...baseFormState, languages: ['English', 'Japanese'] },
      });

      const englishBtn = screen.getByText('English');
      expect(englishBtn).toHaveClass('bg-indigo-600');

      const germanBtn = screen.getByText('German');
      expect(germanBtn).not.toHaveClass('bg-indigo-600');
    });

    it('calls setProfileForm to add a language when clicked', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const { props } = renderSection({
        editingProfile: true,
        profileForm: { ...baseFormState, languages: ['English'] },
      });

      await user.click(screen.getByText('Japanese'));

      expect(props.setProfileForm).toHaveBeenCalledWith(
        expect.objectContaining({ languages: ['English', 'Japanese'] }),
      );
    });

    it('calls setProfileForm to remove a language when clicked', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const { props } = renderSection({
        editingProfile: true,
        profileForm: { ...baseFormState, languages: ['English', 'Japanese'] },
      });

      await user.click(screen.getByText('English'));

      expect(props.setProfileForm).toHaveBeenCalledWith(
        expect.objectContaining({ languages: ['Japanese'] }),
      );
    });
  });

  // ─── Username validation ───────────────────────────────────────────
  describe('username validation', () => {
    it('shows error when username is too short (< 3 chars)', () => {
      renderSection({
        editingProfile: true,
        profileForm: { ...baseFormState, username: '' },
      });

      const usernameInput = document.getElementById('profile-username') as HTMLInputElement;
      // Use fireEvent.change since setProfileForm is mocked (controlled component won't re-render)
      // but validateUsername is called with e.target.value directly
      fireEvent.change(usernameInput, { target: { value: 'ab' } });

      expect(screen.getByText('dashboard.profile.usernameLength')).toBeInTheDocument();
    });

    it('shows error when username has invalid characters', () => {
      renderSection({
        editingProfile: true,
        profileForm: { ...baseFormState, username: '' },
      });

      const usernameInput = document.getElementById('profile-username') as HTMLInputElement;
      fireEvent.change(usernameInput, { target: { value: 'user@name' } });

      expect(screen.getByText('dashboard.profile.usernameChars')).toBeInTheDocument();
    });

    it('shows no error for valid username format', () => {
      renderSection({
        editingProfile: true,
        profileForm: { ...baseFormState, username: '' },
        profile: { ...baseProfile, username: 'valid_user' },
      });

      const usernameInput = document.getElementById('profile-username') as HTMLInputElement;
      // Same username as profile — no uniqueness check triggered
      fireEvent.change(usernameInput, { target: { value: 'valid_user' } });

      expect(screen.queryByText('dashboard.profile.usernameLength')).not.toBeInTheDocument();
      expect(screen.queryByText('dashboard.profile.usernameChars')).not.toBeInTheDocument();
    });

    it('calls onCheckUsername after debounce for a new username', async () => {
      const onCheckUsername = vi.fn().mockResolvedValue(true);
      renderSection({
        editingProfile: true,
        profileForm: { ...baseFormState, username: '' },
        profile: { ...baseProfile, username: 'oldname' },
        onCheckUsername,
      });

      const usernameInput = document.getElementById('profile-username') as HTMLInputElement;
      fireEvent.change(usernameInput, { target: { value: 'newname' } });

      // Should show "checking" state
      expect(screen.getByText('dashboard.profile.checkingUsername')).toBeInTheDocument();

      // Advance past the 500ms debounce
      await act(async () => {
        vi.advanceTimersByTime(600);
      });

      expect(onCheckUsername).toHaveBeenCalledWith('newname');
    });

    it('shows "username taken" when onCheckUsername returns false', async () => {
      const onCheckUsername = vi.fn().mockResolvedValue(false);
      renderSection({
        editingProfile: true,
        profileForm: { ...baseFormState, username: '' },
        profile: { ...baseProfile, username: 'oldname' },
        onCheckUsername,
      });

      const usernameInput = document.getElementById('profile-username') as HTMLInputElement;
      fireEvent.change(usernameInput, { target: { value: 'taken_name' } });

      await act(async () => {
        vi.advanceTimersByTime(600);
      });

      await waitFor(() => {
        expect(screen.getByText('dashboard.profile.usernameTaken')).toBeInTheDocument();
      });
    });

    it('does not call onCheckUsername when username matches current profile username', async () => {
      const onCheckUsername = vi.fn().mockResolvedValue(true);
      renderSection({
        editingProfile: true,
        profileForm: { ...baseFormState, username: '' },
        profile: { ...baseProfile, username: 'testuser' },
        onCheckUsername,
      });

      const usernameInput = document.getElementById('profile-username') as HTMLInputElement;
      fireEvent.change(usernameInput, { target: { value: 'testuser' } });

      await act(async () => {
        vi.advanceTimersByTime(600);
      });

      expect(onCheckUsername).not.toHaveBeenCalled();
    });

    it('shows profile URL hint when username is valid and set', () => {
      renderSection({
        editingProfile: true,
        profileForm: { ...baseFormState, username: 'myuser' },
        profile: { ...baseProfile, username: 'myuser' },
      });

      // The profile URL hint is rendered when username is non-empty and no errors
      expect(screen.getByText('dashboard.profile.profileUrl')).toBeInTheDocument();
    });
  });

  // ─── Telegram validation & verification link ───────────────────────
  describe('telegram input', () => {
    it('auto-prepends @ when user types without it', () => {
      const setProfileForm = vi.fn();
      renderSection({
        editingProfile: true,
        profileForm: { ...baseFormState, telegram: '' },
        setProfileForm,
      });

      const telegramInput = document.getElementById('profile-telegram') as HTMLInputElement;
      fireEvent.change(telegramInput, { target: { value: 'myhandle' } });

      expect(setProfileForm).toHaveBeenCalledWith(
        expect.objectContaining({ telegram: '@myhandle' }),
      );
    });

    it('does not double-prepend @ when value already has it', () => {
      const setProfileForm = vi.fn();
      renderSection({
        editingProfile: true,
        profileForm: { ...baseFormState, telegram: '' },
        setProfileForm,
      });

      const telegramInput = document.getElementById('profile-telegram') as HTMLInputElement;
      fireEvent.change(telegramInput, { target: { value: '@myhandle' } });

      expect(setProfileForm).toHaveBeenCalledWith(
        expect.objectContaining({ telegram: '@myhandle' }),
      );
    });

    it('shows t.me verification link for valid telegram handle', () => {
      renderSection({
        editingProfile: true,
        profileForm: { ...baseFormState, telegram: '@validhandle1' },
      });

      const link = screen.getByText(/t\.me\/validhandle1/);
      expect(link).toBeInTheDocument();
      expect(link.closest('a')).toHaveAttribute('href', 'https://t.me/validhandle1');
    });

    it('shows invalid telegram error for bad format', () => {
      renderSection({
        editingProfile: true,
        profileForm: { ...baseFormState, telegram: '@ab' },
      });

      expect(screen.getByText('dashboard.profile.invalidTelegram')).toBeInTheDocument();
    });

    it('does not show verification link or error for empty telegram', () => {
      renderSection({
        editingProfile: true,
        profileForm: { ...baseFormState, telegram: '' },
      });

      expect(screen.queryByText(/t\.me\//)).not.toBeInTheDocument();
      expect(screen.queryByText('dashboard.profile.invalidTelegram')).not.toBeInTheDocument();
    });
  });

  // ─── WhatsApp validation & verification link ───────────────────────
  describe('whatsapp input', () => {
    it('shows wa.me verification link for valid E.164 number', () => {
      renderSection({
        editingProfile: true,
        profileForm: { ...baseFormState, whatsapp: '+15551234567' },
      });

      const link = screen.getByText(/wa\.me\/15551234567/);
      expect(link).toBeInTheDocument();
      expect(link.closest('a')).toHaveAttribute('href', 'https://wa.me/15551234567');
    });

    it('shows invalid whatsapp error for bad format', () => {
      renderSection({
        editingProfile: true,
        profileForm: { ...baseFormState, whatsapp: '+123' },
      });

      expect(screen.getByText('dashboard.profile.invalidWhatsapp')).toBeInTheDocument();
    });

    it('does not show verification link or error for empty whatsapp', () => {
      renderSection({
        editingProfile: true,
        profileForm: { ...baseFormState, whatsapp: '' },
      });

      expect(screen.queryByText(/wa\.me\//)).not.toBeInTheDocument();
      expect(screen.queryByText('dashboard.profile.invalidWhatsapp')).not.toBeInTheDocument();
    });
  });

  // ─── Payment methods ───────────────────────────────────────────────
  describe('payment methods', () => {
    it('shows connect wallet prompt when hasWallet is false', () => {
      renderSection({ editingProfile: true, hasWallet: false });
      expect(screen.getByText('dashboard.profile.connectWalletPrompt')).toBeInTheDocument();
    });

    it('calls onScrollToWallets when connect wallet is clicked', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const { props } = renderSection({ editingProfile: true, hasWallet: false });

      await user.click(screen.getByText('dashboard.profile.connectWalletPrompt'));
      expect(props.onScrollToWallets).toHaveBeenCalledTimes(1);
    });

    it('shows wallet connected badge when hasWallet is true', () => {
      renderSection({ editingProfile: true, hasWallet: true });
      expect(screen.getByText('dashboard.profile.walletConnected')).toBeInTheDocument();
    });

    it('reveals non-crypto payment textarea when checkbox is checked', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderSection({
        editingProfile: true,
        profileForm: { ...baseFormState, paymentMethods: '' },
      });

      // The "also accept non-crypto" checkbox
      const checkbox = screen.getByText('dashboard.profile.alsoAcceptNonCrypto').previousElementSibling as HTMLInputElement;
      await user.click(checkbox);

      expect(document.getElementById('profile-payment-methods')).toBeInTheDocument();
    });

    it('clears paymentMethods when non-crypto checkbox is unchecked', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const { props } = renderSection({
        editingProfile: true,
        profileForm: { ...baseFormState, paymentMethods: 'PayPal, Venmo' },
      });

      // The checkbox should be checked since paymentMethods is non-empty
      const checkboxLabel = screen.getByText('dashboard.profile.alsoAcceptNonCrypto');
      const checkbox = checkboxLabel.previousElementSibling as HTMLInputElement;
      await user.click(checkbox);

      expect(props.setProfileForm).toHaveBeenCalledWith(
        expect.objectContaining({ paymentMethods: '' }),
      );
    });
  });

  // ─── Hide contact info ─────────────────────────────────────────────
  describe('hide contact checkbox', () => {
    it('calls setProfileForm with hideContact toggled', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const { props } = renderSection({
        editingProfile: true,
        profileForm: { ...baseFormState, hideContact: false },
      });

      const checkbox = screen.getByText('dashboard.profile.hideContact').closest('label')?.querySelector('input[type="checkbox"]') as HTMLInputElement;
      await user.click(checkbox);

      expect(props.setProfileForm).toHaveBeenCalledWith(
        expect.objectContaining({ hideContact: true }),
      );
    });
  });

  // ─── Social profiles section in edit mode ──────────────────────────
  describe('social profiles (edit mode)', () => {
    it('renders all 6 social profile inputs', () => {
      renderSection({ editingProfile: true });

      expect(document.getElementById('profile-linkedin')).toBeInTheDocument();
      expect(document.getElementById('profile-twitter')).toBeInTheDocument();
      expect(document.getElementById('profile-github')).toBeInTheDocument();
      expect(document.getElementById('profile-instagram')).toBeInTheDocument();
      expect(document.getElementById('profile-youtube')).toBeInTheDocument();
      expect(document.getElementById('profile-website')).toBeInTheDocument();
    });

    it('calls setProfileForm when a social URL is changed', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const { props } = renderSection({ editingProfile: true });

      const linkedinInput = document.getElementById('profile-linkedin') as HTMLInputElement;
      await user.clear(linkedinInput);
      await user.type(linkedinInput, 'https://linkedin.com/in/new');

      expect(props.setProfileForm).toHaveBeenCalled();
    });
  });
});
