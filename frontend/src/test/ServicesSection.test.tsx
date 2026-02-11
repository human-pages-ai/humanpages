import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ServicesSection from '../components/dashboard/ServicesSection';
import { Service } from '../components/dashboard/types';

// Mock react-i18next – pass through keys as text
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}));

/** Default empty form state for creating a new service */
const emptyForm = {
  title: '',
  description: '',
  category: '',
  priceMin: '',
  priceUnit: '',
  priceCurrency: 'USD',
};

/** Helper: create a Service stub */
function makeService(overrides: Partial<Service> = {}): Service {
  return {
    id: 's1',
    title: 'Photography',
    description: 'I take photos',
    category: 'Photography',
    isActive: true,
    ...overrides,
  };
}

/** Shared render helper */
function renderSection(overrides: Record<string, any> = {}) {
  const props = {
    services: [] as Service[],
    showServiceForm: false,
    setShowServiceForm: vi.fn(),
    serviceForm: { ...emptyForm },
    setServiceForm: vi.fn(),
    saving: false,
    onAddService: vi.fn(),
    onToggleServiceActive: vi.fn(),
    onDeleteService: vi.fn(),
    ...overrides,
  };
  const result = render(<ServicesSection {...props} />);
  return { ...result, props };
}

describe('ServicesSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Rendering ─────────────────────────────────────────────────────
  describe('rendering', () => {
    it('renders the section heading', () => {
      renderSection();
      expect(screen.getByText('dashboard.services.title')).toBeInTheDocument();
    });

    it('shows the "Add Service" toggle button', () => {
      renderSection();
      // There may be multiple "Add Service" texts (header + empty state CTA)
      const addButtons = screen.getAllByText('dashboard.services.addService');
      expect(addButtons.length).toBeGreaterThanOrEqual(1);
    });

    it('shows "Cancel" instead of "Add" when form is open', () => {
      renderSection({ showServiceForm: true });
      // The toggle button text switches to cancel
      expect(screen.getByText('common.cancel')).toBeInTheDocument();
    });

    it('shows empty state when no services and form is closed', () => {
      renderSection({ services: [], showServiceForm: false });
      expect(screen.getByText('dashboard.services.emptyTitle')).toBeInTheDocument();
      expect(screen.getByText('dashboard.services.emptyDescription')).toBeInTheDocument();
    });

    it('does not show empty state when form is open (even with no services)', () => {
      renderSection({ services: [], showServiceForm: true });
      expect(screen.queryByText('dashboard.services.emptyTitle')).not.toBeInTheDocument();
    });
  });

  // ─── Service list display ──────────────────────────────────────────
  describe('service list', () => {
    it('renders each service title and description', () => {
      const services = [
        makeService({ id: 's1', title: 'Photo Shoot', description: 'Outdoor photos' }),
        makeService({ id: 's2', title: 'Videography', description: 'Wedding videos' }),
      ];
      renderSection({ services });

      expect(screen.getByText('Photo Shoot')).toBeInTheDocument();
      expect(screen.getByText('Outdoor photos')).toBeInTheDocument();
      expect(screen.getByText('Videography')).toBeInTheDocument();
      expect(screen.getByText('Wedding videos')).toBeInTheDocument();
    });

    it('shows category badge for each service', () => {
      renderSection({ services: [makeService({ category: 'Web Development' })] });
      expect(screen.getByText('Web Development')).toBeInTheDocument();
    });

    it('shows active status badge when service is active', () => {
      renderSection({ services: [makeService({ isActive: true })] });
      expect(screen.getByText('dashboard.services.statusActive')).toBeInTheDocument();
    });

    it('shows inactive status badge when service is inactive', () => {
      renderSection({ services: [makeService({ isActive: false })] });
      expect(screen.getByText('dashboard.services.statusInactive')).toBeInTheDocument();
    });

    it('shows "add another" dashed button when services exist and form is closed', () => {
      renderSection({ services: [makeService()], showServiceForm: false });
      expect(screen.getByText(/dashboard.services.addAnother/)).toBeInTheDocument();
    });

    it('does not show "add another" when form is already open', () => {
      renderSection({ services: [makeService()], showServiceForm: true });
      expect(screen.queryByText(/dashboard.services.addAnother/)).not.toBeInTheDocument();
    });
  });

  // ─── Price display ─────────────────────────────────────────────────
  describe('price formatting', () => {
    it('shows hourly rate with currency symbol', () => {
      const svc = makeService({ priceMin: '25', priceUnit: 'HOURLY', priceCurrency: 'USD' });
      renderSection({ services: [svc] });
      expect(screen.getByText('$25/dashboard.services.perHourShort')).toBeInTheDocument();
    });

    it('shows flat/task rate', () => {
      const svc = makeService({ priceMin: '100', priceUnit: 'FLAT_TASK', priceCurrency: 'EUR' });
      renderSection({ services: [svc] });
      expect(screen.getByText('€100/dashboard.services.perTaskShort')).toBeInTheDocument();
    });

    it('shows "Negotiable" for NEGOTIABLE unit', () => {
      const svc = makeService({ priceUnit: 'NEGOTIABLE' });
      renderSection({ services: [svc] });
      expect(screen.getByText('dashboard.services.negotiable')).toBeInTheDocument();
    });

    it('shows no price badge when price is not set', () => {
      const svc = makeService({ id: 's1', title: 'My Photo Service', priceMin: undefined, priceUnit: undefined });
      renderSection({ services: [svc] });
      // The price badge is a <span> with bg-green-100 inside the flex gap-2 mt-2 div
      const categoryBadge = screen.getByText('Photography'); // the category badge
      const badgeContainer = categoryBadge.closest('.flex.gap-2');
      // Should only have the category span, no price span
      const spans = badgeContainer?.querySelectorAll('span') || [];
      expect(spans.length).toBe(1); // only category badge, no price badge
    });
  });

  // ─── Toggle and delete callbacks ───────────────────────────────────
  describe('service actions', () => {
    it('calls onToggleServiceActive when status button is clicked', async () => {
      const user = userEvent.setup();
      const svc = makeService({ id: 'svc-99', isActive: true });
      const { props } = renderSection({ services: [svc] });

      await user.click(screen.getByText('dashboard.services.statusActive'));
      expect(props.onToggleServiceActive).toHaveBeenCalledWith(svc);
    });

    it('calls onDeleteService when delete button is clicked', async () => {
      const user = userEvent.setup();
      const svc = makeService({ id: 'svc-99' });
      const { props } = renderSection({ services: [svc] });

      await user.click(screen.getByText('common.delete'));
      expect(props.onDeleteService).toHaveBeenCalledWith('svc-99');
    });

    it('calls setShowServiceForm when toggle button is clicked', async () => {
      const user = userEvent.setup();
      const { props } = renderSection({ showServiceForm: false });

      // Click the header "Add Service" button
      const headerButton = screen.getAllByText('dashboard.services.addService')[0];
      await user.click(headerButton);
      expect(props.setShowServiceForm).toHaveBeenCalledWith(true);
    });
  });

  // ─── Service form ──────────────────────────────────────────────────
  describe('service form', () => {
    it('renders all form fields when showServiceForm is true', () => {
      renderSection({ showServiceForm: true });

      expect(screen.getByLabelText('dashboard.services.serviceTitle')).toBeInTheDocument();
      expect(screen.getByLabelText('dashboard.services.description')).toBeInTheDocument();
      expect(document.getElementById('service-category')).toBeInTheDocument();
      expect(document.getElementById('service-price-unit')).toBeInTheDocument();
    });

    it('calls setServiceForm when title is changed', async () => {
      const user = userEvent.setup();
      const { props } = renderSection({ showServiceForm: true });

      const titleInput = screen.getByLabelText('dashboard.services.serviceTitle');
      await user.type(titleInput, 'A');

      expect(props.setServiceForm).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'A' }),
      );
    });

    it('calls setServiceForm when description is changed', async () => {
      const user = userEvent.setup();
      const { props } = renderSection({ showServiceForm: true });

      const descInput = screen.getByLabelText('dashboard.services.description');
      await user.type(descInput, 'X');

      expect(props.setServiceForm).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'X' }),
      );
    });

    it('submit button is disabled when required fields are empty', () => {
      renderSection({ showServiceForm: true, serviceForm: { ...emptyForm } });

      // The "Add Service" button inside the form
      const formButtons = screen.getAllByText('dashboard.services.addService');
      const submitButton = formButtons[formButtons.length - 1]; // last one is inside the form
      expect(submitButton).toBeDisabled();
    });

    it('submit button is enabled when title, description, category are filled', () => {
      renderSection({
        showServiceForm: true,
        serviceForm: { ...emptyForm, title: 'My Service', description: 'Desc', category: 'Photography' },
      });

      const formButtons = screen.getAllByText('dashboard.services.addService');
      const submitButton = formButtons[formButtons.length - 1];
      expect(submitButton).not.toBeDisabled();
    });

    it('submit button is disabled when saving is true', () => {
      renderSection({
        showServiceForm: true,
        saving: true,
        serviceForm: { ...emptyForm, title: 'My Service', description: 'Desc', category: 'Photography' },
      });

      const formButtons = screen.getAllByText('dashboard.services.addService');
      const submitButton = formButtons[formButtons.length - 1];
      expect(submitButton).toBeDisabled();
    });

    it('submit button is disabled when priceMin is set but priceUnit is empty', () => {
      renderSection({
        showServiceForm: true,
        serviceForm: { ...emptyForm, title: 'T', description: 'D', category: 'C', priceMin: '50', priceUnit: '' },
      });

      const formButtons = screen.getAllByText('dashboard.services.addService');
      const submitButton = formButtons[formButtons.length - 1];
      expect(submitButton).toBeDisabled();
    });

    it('calls onAddService when submit button is clicked', async () => {
      const user = userEvent.setup();
      const { props } = renderSection({
        showServiceForm: true,
        serviceForm: { ...emptyForm, title: 'My Service', description: 'Desc', category: 'Photography' },
      });

      const formButtons = screen.getAllByText('dashboard.services.addService');
      const submitButton = formButtons[formButtons.length - 1];
      await user.click(submitButton);

      expect(props.onAddService).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Price unit logic (NEGOTIABLE hides price/currency) ────────────
  describe('price unit conditional fields', () => {
    it('hides price input and currency when no unit is selected', () => {
      renderSection({
        showServiceForm: true,
        serviceForm: { ...emptyForm, priceUnit: '' },
      });

      expect(document.getElementById('service-price-min')).not.toBeInTheDocument();
      expect(document.getElementById('service-price-currency')).not.toBeInTheDocument();
    });

    it('shows price input and currency when HOURLY is selected', () => {
      renderSection({
        showServiceForm: true,
        serviceForm: { ...emptyForm, priceUnit: 'HOURLY', priceCurrency: 'USD' },
      });

      expect(document.getElementById('service-price-min')).toBeInTheDocument();
      expect(document.getElementById('service-price-currency')).toBeInTheDocument();
    });

    it('shows price input and currency when FLAT_TASK is selected', () => {
      renderSection({
        showServiceForm: true,
        serviceForm: { ...emptyForm, priceUnit: 'FLAT_TASK', priceCurrency: 'USD' },
      });

      expect(document.getElementById('service-price-min')).toBeInTheDocument();
      expect(document.getElementById('service-price-currency')).toBeInTheDocument();
    });

    it('hides price input and currency when NEGOTIABLE is selected', () => {
      renderSection({
        showServiceForm: true,
        serviceForm: { ...emptyForm, priceUnit: 'NEGOTIABLE' },
      });

      expect(document.getElementById('service-price-min')).not.toBeInTheDocument();
      expect(document.getElementById('service-price-currency')).not.toBeInTheDocument();
    });

    it('clears priceMin when user selects NEGOTIABLE', () => {
      const setServiceForm = vi.fn();
      renderSection({
        showServiceForm: true,
        serviceForm: { ...emptyForm, priceUnit: 'HOURLY', priceMin: '50' },
        setServiceForm,
      });

      const unitSelect = document.getElementById('service-price-unit') as HTMLSelectElement;
      fireEvent.change(unitSelect, { target: { value: 'NEGOTIABLE' } });

      expect(setServiceForm).toHaveBeenCalledWith(
        expect.objectContaining({ priceUnit: 'NEGOTIABLE', priceMin: '' }),
      );
    });

    it('does not clear priceMin when switching from HOURLY to FLAT_TASK', () => {
      const setServiceForm = vi.fn();
      renderSection({
        showServiceForm: true,
        serviceForm: { ...emptyForm, priceUnit: 'HOURLY', priceMin: '50' },
        setServiceForm,
      });

      const unitSelect = document.getElementById('service-price-unit') as HTMLSelectElement;
      fireEvent.change(unitSelect, { target: { value: 'FLAT_TASK' } });

      expect(setServiceForm).toHaveBeenCalledWith(
        expect.objectContaining({ priceUnit: 'FLAT_TASK', priceMin: '50' }),
      );
    });
  });

  // ─── CategoryCombobox ──────────────────────────────────────────────
  describe('CategoryCombobox', () => {
    it('shows dropdown options when category input is focused', () => {
      renderSection({ showServiceForm: true });

      const catInput = document.getElementById('service-category') as HTMLInputElement;
      fireEvent.focus(catInput);

      // Should see at least some categories
      expect(screen.getByText('Photography')).toBeInTheDocument();
      expect(screen.getByText('Web Development')).toBeInTheDocument();
      expect(screen.getByText('Other')).toBeInTheDocument();
    });

    it('filters categories when user types', async () => {
      const user = userEvent.setup();
      renderSection({ showServiceForm: true });

      const catInput = document.getElementById('service-category') as HTMLInputElement;
      await user.click(catInput);
      await user.type(catInput, 'photo');

      expect(screen.getByText('Photography')).toBeInTheDocument();
      // "Web Development" should not match "photo"
      expect(screen.queryByText('Web Development')).not.toBeInTheDocument();
    });

    it('shows "No matching categories" when no results', async () => {
      const user = userEvent.setup();
      renderSection({ showServiceForm: true });

      const catInput = document.getElementById('service-category') as HTMLInputElement;
      await user.click(catInput);
      await user.type(catInput, 'xyznonexistent');

      expect(screen.getByText('No matching categories')).toBeInTheDocument();
    });

    it('calls setServiceForm with chosen category when an option is clicked', async () => {
      const user = userEvent.setup();
      const { props } = renderSection({ showServiceForm: true });

      const catInput = document.getElementById('service-category') as HTMLInputElement;
      await user.click(catInput);

      // Click "Delivery"
      await user.click(screen.getByText('Delivery'));

      expect(props.setServiceForm).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'Delivery' }),
      );
    });

    it('highlights the currently selected category', () => {
      renderSection({
        showServiceForm: true,
        serviceForm: { ...emptyForm, category: 'Tutoring' },
      });

      const catInput = document.getElementById('service-category') as HTMLInputElement;
      fireEvent.focus(catInput);

      const tutoringButton = screen.getByText('Tutoring');
      expect(tutoringButton).toHaveClass('bg-indigo-50');
      expect(tutoringButton).toHaveClass('text-indigo-700');
    });

    it('closes dropdown when clicking outside', () => {
      renderSection({ showServiceForm: true });

      const catInput = document.getElementById('service-category') as HTMLInputElement;
      fireEvent.focus(catInput);

      expect(screen.getByText('Photography')).toBeInTheDocument();

      // Click outside
      fireEvent.mouseDown(document.body);

      expect(screen.queryByText('Other')).not.toBeInTheDocument();
    });
  });

  // ─── Currency selector ─────────────────────────────────────────────
  describe('currency selector', () => {
    it('renders all supported currencies in the dropdown', () => {
      renderSection({
        showServiceForm: true,
        serviceForm: { ...emptyForm, priceUnit: 'HOURLY', priceCurrency: 'USD' },
      });

      const currencySelect = document.getElementById('service-price-currency') as HTMLSelectElement;
      const options = within(currencySelect).getAllByRole('option');

      // Should have all 10 supported currencies
      expect(options.length).toBe(10);
      expect(options.map(o => o.textContent)).toContain('USD');
      expect(options.map(o => o.textContent)).toContain('EUR');
      expect(options.map(o => o.textContent)).toContain('TRY');
    });

    it('displays the correct currency symbol in the price input prefix', () => {
      renderSection({
        showServiceForm: true,
        serviceForm: { ...emptyForm, priceUnit: 'HOURLY', priceCurrency: 'EUR' },
      });

      // The € sign should appear as a prefix
      expect(screen.getByText('€')).toBeInTheDocument();
    });

    it('calls setServiceForm when currency is changed', () => {
      const setServiceForm = vi.fn();
      renderSection({
        showServiceForm: true,
        serviceForm: { ...emptyForm, priceUnit: 'HOURLY', priceCurrency: 'USD' },
        setServiceForm,
      });

      const currencySelect = document.getElementById('service-price-currency') as HTMLSelectElement;
      fireEvent.change(currencySelect, { target: { value: 'GBP' } });

      expect(setServiceForm).toHaveBeenCalledWith(
        expect.objectContaining({ priceCurrency: 'GBP' }),
      );
    });
  });
});
