import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import toast from 'react-hot-toast';
import EducationSection from '../components/dashboard/EducationSection';
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
    addEducation: vi.fn(),
    addCertificate: vi.fn(),
    deleteEducation: vi.fn(),
    deleteCertificate: vi.fn(),
  },
}));

// Mock data imports
vi.mock('../data/degrees', () => ({
  default: ['Bachelor of Science', 'Master of Science', 'PhD'],
}));

vi.mock('../data/certIssuers', () => ({
  default: ['AWS', 'Google Cloud', 'Microsoft', 'Coursera'],
}));

vi.mock('../data/countries', () => ({
  default: ['United States', 'Canada', 'United Kingdom', 'Germany'],
}));

import { api } from '../lib/api';

describe('EducationSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering - empty state', () => {
    it('renders education section with heading', () => {
      const profile = { ...mockProfile, education: [], certifications: [] };
      renderWithProviders(<EducationSection profile={profile} />);

      expect(screen.getByText('Education')).toBeInTheDocument();
    });

    it('renders certifications section with heading', () => {
      const profile = { ...mockProfile, education: [], certifications: [] };
      renderWithProviders(<EducationSection profile={profile} />);

      expect(screen.getByText('Certifications')).toBeInTheDocument();
    });

    it('shows "Add" link when no education exists', () => {
      const profile = { ...mockProfile, education: [], certifications: [] };
      renderWithProviders(<EducationSection profile={profile} />);

      const addLinks = screen.getAllByText('Add');
      expect(addLinks.length).toBeGreaterThanOrEqual(2);
    });

    it('shows empty state message for education', () => {
      const profile = { ...mockProfile, education: [], certifications: [] };
      renderWithProviders(<EducationSection profile={profile} />);

      expect(screen.getByText('No education added yet')).toBeInTheDocument();
    });

    it('shows empty state message for certifications', () => {
      const profile = { ...mockProfile, education: [], certifications: [] };
      renderWithProviders(<EducationSection profile={profile} />);

      expect(screen.getByText('No certifications added yet')).toBeInTheDocument();
    });
  });

  describe('rendering - with data', () => {
    it('renders education entries', () => {
      const education = [
        {
          id: '1',
          institution: 'Stanford University',
          degree: 'Bachelor of Science',
          field: 'Computer Science',
          startYear: 2015,
          endYear: 2019,
          country: 'United States',
          createdAt: '2024-01-01T00:00:00Z',
        },
      ];
      const profile = { ...mockProfile, education, certifications: [] };
      renderWithProviders(<EducationSection profile={profile} />);

      expect(screen.getByText('Bachelor of Science in Computer Science')).toBeInTheDocument();
      expect(screen.getByText('Stanford University')).toBeInTheDocument();
      expect(screen.getByText('United States')).toBeInTheDocument();
      expect(screen.getByText('2015 - 2019')).toBeInTheDocument();
    });

    it('renders certificate entries', () => {
      const certifications = [
        {
          id: '1',
          name: 'AWS Solutions Architect',
          issuer: 'Amazon Web Services',
          issueDate: '2023-01-15',
          expiryDate: '2025-01-15',
          createdAt: '2024-01-01T00:00:00Z',
        },
      ];
      const profile = { ...mockProfile, education: [], certifications };
      renderWithProviders(<EducationSection profile={profile} />);

      expect(screen.getByText('AWS Solutions Architect')).toBeInTheDocument();
      expect(screen.getByText('Amazon Web Services')).toBeInTheDocument();
      expect(screen.getByText(/Issued:/)).toBeInTheDocument();
      expect(screen.getByText(/Expires:/)).toBeInTheDocument();
    });

    it('shows "Edit" link when education exists', () => {
      const education = [
        {
          id: '1',
          institution: 'MIT',
          degree: 'PhD',
          field: 'Mathematics',
          country: 'United States',
          createdAt: '2024-01-01T00:00:00Z',
        },
      ];
      const profile = { ...mockProfile, education, certifications: [] };
      renderWithProviders(<EducationSection profile={profile} />);

      const editLinks = screen.getAllByText('Edit');
      expect(editLinks.length).toBeGreaterThanOrEqual(1);
    });

    it('displays multiple education entries', () => {
      const education = [
        {
          id: '1',
          institution: 'Stanford',
          degree: 'Bachelor',
          field: 'CS',
          country: 'US',
          createdAt: '2024-01-01T00:00:00Z',
        },
        {
          id: '2',
          institution: 'MIT',
          degree: 'Master',
          field: 'AI',
          country: 'US',
          createdAt: '2024-01-02T00:00:00Z',
        },
      ];
      const profile = { ...mockProfile, education, certifications: [] };
      renderWithProviders(<EducationSection profile={profile} />);

      expect(screen.getByText('Stanford')).toBeInTheDocument();
      expect(screen.getByText('MIT')).toBeInTheDocument();
    });
  });

  describe('education form', () => {
    it('renders education form when add button is clicked', async () => {
      const user = userEvent.setup();
      const profile = { ...mockProfile, education: [], certifications: [] };
      renderWithProviders(<EducationSection profile={profile} />);

      const addButtons = screen.getAllByText('Add');
      await user.click(addButtons[0]);

      expect(screen.getByLabelText('Institution')).toBeInTheDocument();
      expect(screen.getByLabelText('Degree')).toBeInTheDocument();
      expect(screen.getByLabelText('Field of Study')).toBeInTheDocument();
      expect(screen.getByLabelText('Country')).toBeInTheDocument();
      expect(screen.getByText('Start Year')).toBeInTheDocument();
      expect(screen.getByText('End Year')).toBeInTheDocument();
    });

    it('renders SearchableCombobox for institution field', async () => {
      const user = userEvent.setup();
      const profile = { ...mockProfile, education: [], certifications: [] };
      renderWithProviders(<EducationSection profile={profile} />);

      const addButtons = screen.getAllByText('Add');
      await user.click(addButtons[0]);

      const instituteInput = document.getElementById('edu-inst') as HTMLInputElement;
      expect(instituteInput).toBeInTheDocument();
      expect(instituteInput.placeholder).toContain('University');
    });

    it('renders year inputs with correct constraints', async () => {
      const user = userEvent.setup();
      const profile = { ...mockProfile, education: [], certifications: [] };
      renderWithProviders(<EducationSection profile={profile} />);

      const addButtons = screen.getAllByText('Add');
      await user.click(addButtons[0]);

      const inputs = document.querySelectorAll('input[type="number"]');
      inputs.forEach(input => {
        expect(input).toHaveAttribute('min', '1900');
      });
    });

    it('renders Save and Cancel buttons', async () => {
      const user = userEvent.setup();
      const profile = { ...mockProfile, education: [], certifications: [] };
      renderWithProviders(<EducationSection profile={profile} />);

      const addButtons = screen.getAllByText('Add');
      await user.click(addButtons[0]);

      expect(screen.getByText('Add Education')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
  });

  describe('education form validation', () => {
    it('requires institution field', async () => {
      const user = userEvent.setup();
      const profile = { ...mockProfile, education: [], certifications: [] };
      renderWithProviders(<EducationSection profile={profile} />);

      const addButtons = screen.getAllByText('Add');
      await user.click(addButtons[0]);

      const degreeInput = document.getElementById('edu-degree') as HTMLInputElement;
      await user.click(degreeInput);
      await user.type(degreeInput, 'Bachelor');

      const fieldInput = document.getElementById('edu-field') as HTMLInputElement;
      await user.click(fieldInput);
      await user.type(fieldInput, 'CS');

      // Submit without institution
      const submitButton = screen.getByText('Add Education');
      await user.click(submitButton);

      expect(toast.error).toHaveBeenCalledWith('Please fill in all required fields');
      expect(api.addEducation).not.toHaveBeenCalled();
    });

    it('requires degree field', async () => {
      const user = userEvent.setup();
      const profile = { ...mockProfile, education: [], certifications: [] };
      renderWithProviders(<EducationSection profile={profile} />);

      const addButtons = screen.getAllByText('Add');
      await user.click(addButtons[0]);

      const instInput = document.getElementById('edu-inst') as HTMLInputElement;
      await user.click(instInput);
      await user.type(instInput, 'MIT');

      const fieldInput = document.getElementById('edu-field') as HTMLInputElement;
      await user.click(fieldInput);
      await user.type(fieldInput, 'CS');

      // Submit without degree
      const submitButton = screen.getByText('Add Education');
      await user.click(submitButton);

      expect(toast.error).toHaveBeenCalledWith('Please fill in all required fields');
    });

    it('requires field of study', async () => {
      const user = userEvent.setup();
      const profile = { ...mockProfile, education: [], certifications: [] };
      renderWithProviders(<EducationSection profile={profile} />);

      const addButtons = screen.getAllByText('Add');
      await user.click(addButtons[0]);

      const instInput = document.getElementById('edu-inst') as HTMLInputElement;
      await user.click(instInput);
      await user.type(instInput, 'MIT');

      const degreeInput = document.getElementById('edu-degree') as HTMLInputElement;
      await user.click(degreeInput);
      await user.type(degreeInput, 'Bachelor');

      // Submit without field
      const submitButton = screen.getByText('Add Education');
      await user.click(submitButton);

      expect(toast.error).toHaveBeenCalledWith('Please fill in all required fields');
    });

    it('accepts valid education entry', async () => {
      const user = userEvent.setup();
      const profile = { ...mockProfile, education: [], certifications: [] };
      (api.addEducation as any).mockResolvedValue({ success: true });

      renderWithProviders(<EducationSection profile={profile} />);

      const addButtons = screen.getAllByText('Add');
      await user.click(addButtons[0]);

      const instInput = document.getElementById('edu-inst') as HTMLInputElement;
      await user.click(instInput);
      await user.type(instInput, 'Stanford');

      const degreeInput = document.getElementById('edu-degree') as HTMLInputElement;
      await user.click(degreeInput);
      await user.type(degreeInput, 'Bachelor of Science');

      const fieldInput = document.getElementById('edu-field') as HTMLInputElement;
      await user.click(fieldInput);
      await user.type(fieldInput, 'Computer Science');

      const submitButton = screen.getByText('Add Education');
      await user.click(submitButton);

      await waitFor(() => {
        expect(api.addEducation).toHaveBeenCalledWith(
          expect.objectContaining({
            institution: 'Stanford',
            degree: 'Bachelor of Science',
            field: 'Computer Science',
          })
        );
      });
    });

    it('accepts year values within valid range', async () => {
      const user = userEvent.setup();
      const profile = { ...mockProfile, education: [], certifications: [] };
      (api.addEducation as any).mockResolvedValue({ success: true });

      renderWithProviders(<EducationSection profile={profile} />);

      const addButtons = screen.getAllByText('Add');
      await user.click(addButtons[0]);

      const instInput = document.getElementById('edu-inst') as HTMLInputElement;
      await user.click(instInput);
      await user.type(instInput, 'MIT');

      const degreeInput = document.getElementById('edu-degree') as HTMLInputElement;
      await user.click(degreeInput);
      await user.type(degreeInput, 'PhD');

      const fieldInput = document.getElementById('edu-field') as HTMLInputElement;
      await user.click(fieldInput);
      await user.type(fieldInput, 'Mathematics');

      const yearInputs = document.querySelectorAll('input[type="number"]');
      await user.clear(yearInputs[0] as HTMLInputElement);
      await user.type(yearInputs[0] as HTMLInputElement, '2015');
      await user.clear(yearInputs[1] as HTMLInputElement);
      await user.type(yearInputs[1] as HTMLInputElement, '2019');

      const submitButton = screen.getByText('Add Education');
      await user.click(submitButton);

      await waitFor(() => {
        expect(api.addEducation).toHaveBeenCalledWith(
          expect.objectContaining({
            startYear: 2015,
            endYear: 2019,
          })
        );
      });
    });

    it('allows year to be optional', async () => {
      const user = userEvent.setup();
      const profile = { ...mockProfile, education: [], certifications: [] };
      (api.addEducation as any).mockResolvedValue({ success: true });

      renderWithProviders(<EducationSection profile={profile} />);

      const addButtons = screen.getAllByText('Add');
      await user.click(addButtons[0]);

      const instInput = document.getElementById('edu-inst') as HTMLInputElement;
      await user.click(instInput);
      await user.type(instInput, 'University');

      const degreeInput = document.getElementById('edu-degree') as HTMLInputElement;
      await user.click(degreeInput);
      await user.type(degreeInput, 'Bachelor');

      const fieldInput = document.getElementById('edu-field') as HTMLInputElement;
      await user.click(fieldInput);
      await user.type(fieldInput, 'CS');

      const submitButton = screen.getByText('Add Education');
      await user.click(submitButton);

      await waitFor(() => {
        expect(api.addEducation).toHaveBeenCalledWith(
          expect.objectContaining({
            startYear: undefined,
            endYear: undefined,
          })
        );
      });
    });
  });

  describe('education form actions', () => {
    it('shows success toast after adding education', async () => {
      const user = userEvent.setup();
      const profile = { ...mockProfile, education: [], certifications: [] };
      (api.addEducation as any).mockResolvedValue({ success: true });

      renderWithProviders(<EducationSection profile={profile} />);

      const addButtons = screen.getAllByText('Add');
      await user.click(addButtons[0]);

      const instInput = document.getElementById('edu-inst') as HTMLInputElement;
      await user.click(instInput);
      await user.type(instInput, 'MIT');

      const degreeInput = document.getElementById('edu-degree') as HTMLInputElement;
      await user.click(degreeInput);
      await user.type(degreeInput, 'Bachelor');

      const fieldInput = document.getElementById('edu-field') as HTMLInputElement;
      await user.click(fieldInput);
      await user.type(fieldInput, 'CS');

      const submitButton = screen.getByText('Add Education');
      await user.click(submitButton);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Education added');
      });
    });

    it('calls onUpdate callback after successful submission', async () => {
      const user = userEvent.setup();
      const onUpdate = vi.fn();
      const profile = { ...mockProfile, education: [], certifications: [] };
      (api.addEducation as any).mockResolvedValue({ success: true });

      renderWithProviders(<EducationSection profile={profile} onUpdate={onUpdate} />);

      const addButtons = screen.getAllByText('Add');
      await user.click(addButtons[0]);

      const instInput = document.getElementById('edu-inst') as HTMLInputElement;
      await user.click(instInput);
      await user.type(instInput, 'MIT');

      const degreeInput = document.getElementById('edu-degree') as HTMLInputElement;
      await user.click(degreeInput);
      await user.type(degreeInput, 'Bachelor');

      const fieldInput = document.getElementById('edu-field') as HTMLInputElement;
      await user.click(fieldInput);
      await user.type(fieldInput, 'CS');

      const submitButton = screen.getByText('Add Education');
      await user.click(submitButton);

      await waitFor(() => {
        expect(onUpdate).toHaveBeenCalled();
      });
    });

    it('resets form after successful submission', async () => {
      const user = userEvent.setup();
      const profile = { ...mockProfile, education: [], certifications: [] };
      (api.addEducation as any).mockResolvedValue({ success: true });

      renderWithProviders(<EducationSection profile={profile} />);

      const addButtons = screen.getAllByText('Add');
      await user.click(addButtons[0]);

      const instInput = document.getElementById('edu-inst') as HTMLInputElement;
      await user.click(instInput);
      await user.type(instInput, 'MIT');

      const degreeInput = document.getElementById('edu-degree') as HTMLInputElement;
      await user.click(degreeInput);
      await user.type(degreeInput, 'Bachelor');

      const fieldInput = document.getElementById('edu-field') as HTMLInputElement;
      await user.click(fieldInput);
      await user.type(fieldInput, 'CS');

      const submitButton = screen.getByText('Add Education');
      await user.click(submitButton);

      // After successful submission, form closes. Reopen and verify new input is empty.
      await waitFor(() => {
        expect(screen.getByText('No education added yet')).toBeInTheDocument();
      });

      const newAddButtons = screen.getAllByText('Add');
      await user.click(newAddButtons[0]);

      const newInstInput = document.getElementById('edu-inst') as HTMLInputElement;
      expect(newInstInput.value).toBe('');
    });

    it('closes form after successful submission', async () => {
      const user = userEvent.setup();
      const profile = { ...mockProfile, education: [], certifications: [] };
      (api.addEducation as any).mockResolvedValue({ success: true });

      renderWithProviders(<EducationSection profile={profile} />);

      const addButtons = screen.getAllByText('Add');
      await user.click(addButtons[0]);

      const instInput = document.getElementById('edu-inst') as HTMLInputElement;
      await user.click(instInput);
      await user.type(instInput, 'MIT');

      const degreeInput = document.getElementById('edu-degree') as HTMLInputElement;
      await user.click(degreeInput);
      await user.type(degreeInput, 'Bachelor');

      const fieldInput = document.getElementById('edu-field') as HTMLInputElement;
      await user.click(fieldInput);
      await user.type(fieldInput, 'CS');

      const submitButton = screen.getByText('Add Education');
      await user.click(submitButton);

      await waitFor(() => {
        // Form should be hidden, showing empty state again
        expect(screen.getByText('No education added yet')).toBeInTheDocument();
      });
    });

    it('closes form when Cancel is clicked', async () => {
      const user = userEvent.setup();
      const profile = { ...mockProfile, education: [], certifications: [] };
      renderWithProviders(<EducationSection profile={profile} />);

      const addButtons = screen.getAllByText('Add');
      await user.click(addButtons[0]);

      expect(screen.getByLabelText('Institution')).toBeInTheDocument();

      const cancelButtons = screen.getAllByText('Cancel');
      await user.click(cancelButtons[0]);

      expect(screen.getByText('No education added yet')).toBeInTheDocument();
    });

    it('resets form when Cancel is clicked', async () => {
      const user = userEvent.setup();
      const profile = { ...mockProfile, education: [], certifications: [] };
      renderWithProviders(<EducationSection profile={profile} />);

      const addButtons = screen.getAllByText('Add');
      await user.click(addButtons[0]);

      const instInput = document.getElementById('edu-inst') as HTMLInputElement;
      await user.click(instInput);
      await user.type(instInput, 'MIT');

      const cancelButtons = screen.getAllByText('Cancel');
      await user.click(cancelButtons[0]);

      const newAddButtons = screen.getAllByText('Add');
      await user.click(newAddButtons[0]);

      // Get fresh reference to the input after reopening form
      const newInstInput = document.getElementById('edu-inst') as HTMLInputElement;
      expect(newInstInput.value).toBe('');
    });
  });

  describe('certificate form', () => {
    it('renders certificate form when add button is clicked', async () => {
      const user = userEvent.setup();
      const profile = { ...mockProfile, education: [], certifications: [] };
      renderWithProviders(<EducationSection profile={profile} />);

      const addButtons = screen.getAllByText('Add');
      await user.click(addButtons[1]);

      expect(screen.getByLabelText('Certification Name')).toBeInTheDocument();
      expect(screen.getByLabelText('Issuer')).toBeInTheDocument();
      expect(screen.getByText('Issue Date')).toBeInTheDocument();
      expect(screen.getByText('Expiry Date')).toBeInTheDocument();
    });

    it('renders certificate name as text input', async () => {
      const user = userEvent.setup();
      const profile = { ...mockProfile, education: [], certifications: [] };
      renderWithProviders(<EducationSection profile={profile} />);

      const addButtons = screen.getAllByText('Add');
      await user.click(addButtons[1]);

      const nameInput = screen.getByLabelText('Certification Name') as HTMLInputElement;
      expect(nameInput.type).toBe('text');
    });

    it('renders issuer as SearchableCombobox', async () => {
      const user = userEvent.setup();
      const profile = { ...mockProfile, education: [], certifications: [] };
      renderWithProviders(<EducationSection profile={profile} />);

      const addButtons = screen.getAllByText('Add');
      await user.click(addButtons[1]);

      const issuerInput = document.getElementById('cert-issuer') as HTMLInputElement;
      expect(issuerInput).toBeInTheDocument();
    });
  });

  describe('certificate form validation', () => {
    it('requires certificate name', async () => {
      const user = userEvent.setup();
      const profile = { ...mockProfile, education: [], certifications: [] };
      renderWithProviders(<EducationSection profile={profile} />);

      const addButtons = screen.getAllByText('Add');
      await user.click(addButtons[1]);

      const issuerInput = document.getElementById('cert-issuer') as HTMLInputElement;
      await user.click(issuerInput);
      await user.type(issuerInput, 'AWS');

      const submitButton = screen.getByText('Add Certificate');
      await user.click(submitButton);

      expect(toast.error).toHaveBeenCalledWith('Please fill in all required fields');
    });

    it('requires certificate issuer', async () => {
      const user = userEvent.setup();
      const profile = { ...mockProfile, education: [], certifications: [] };
      renderWithProviders(<EducationSection profile={profile} />);

      const addButtons = screen.getAllByText('Add');
      await user.click(addButtons[1]);

      const nameInput = screen.getByLabelText('Certification Name');
      await user.type(nameInput, 'AWS Solutions Architect');

      const submitButton = screen.getByText('Add Certificate');
      await user.click(submitButton);

      expect(toast.error).toHaveBeenCalledWith('Please fill in all required fields');
    });

    it('accepts valid certificate entry', async () => {
      const user = userEvent.setup();
      const profile = { ...mockProfile, education: [], certifications: [] };
      (api.addCertificate as any).mockResolvedValue({ success: true });

      renderWithProviders(<EducationSection profile={profile} />);

      const addButtons = screen.getAllByText('Add');
      await user.click(addButtons[1]);

      const nameInput = screen.getByLabelText('Certification Name');
      await user.type(nameInput, 'AWS Solutions Architect');

      const issuerInput = document.getElementById('cert-issuer') as HTMLInputElement;
      await user.click(issuerInput);
      await user.type(issuerInput, 'AWS');

      const submitButton = screen.getByText('Add Certificate');
      await user.click(submitButton);

      await waitFor(() => {
        expect(api.addCertificate).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'AWS Solutions Architect',
            issuer: 'AWS',
          })
        );
      });
    });

    it('accepts optional issue and expiry dates', async () => {
      const user = userEvent.setup();
      const profile = { ...mockProfile, education: [], certifications: [] };
      (api.addCertificate as any).mockResolvedValue({ success: true });

      renderWithProviders(<EducationSection profile={profile} />);

      const addButtons = screen.getAllByText('Add');
      await user.click(addButtons[1]);

      const nameInput = screen.getByLabelText('Certification Name');
      await user.type(nameInput, 'AWS Architect');

      const issuerInput = document.getElementById('cert-issuer') as HTMLInputElement;
      await user.click(issuerInput);
      await user.type(issuerInput, 'AWS');

      const submitButton = screen.getByText('Add Certificate');
      await user.click(submitButton);

      await waitFor(() => {
        expect(api.addCertificate).toHaveBeenCalledWith(
          expect.objectContaining({
            issueDate: undefined,
            expiryDate: undefined,
          })
        );
      });
    });
  });

  describe('certificate form actions', () => {
    it('shows success toast after adding certificate', async () => {
      const user = userEvent.setup();
      const profile = { ...mockProfile, education: [], certifications: [] };
      (api.addCertificate as any).mockResolvedValue({ success: true });

      renderWithProviders(<EducationSection profile={profile} />);

      const addButtons = screen.getAllByText('Add');
      await user.click(addButtons[1]);

      const nameInput = screen.getByLabelText('Certification Name');
      await user.type(nameInput, 'AWS Architect');

      const issuerInput = document.getElementById('cert-issuer') as HTMLInputElement;
      await user.click(issuerInput);
      await user.type(issuerInput, 'AWS');

      const submitButton = screen.getByText('Add Certificate');
      await user.click(submitButton);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Certificate added');
      });
    });

    it('closes certificate form after successful submission', async () => {
      const user = userEvent.setup();
      const profile = { ...mockProfile, education: [], certifications: [] };
      (api.addCertificate as any).mockResolvedValue({ success: true });

      renderWithProviders(<EducationSection profile={profile} />);

      const addButtons = screen.getAllByText('Add');
      await user.click(addButtons[1]);

      const nameInput = screen.getByLabelText('Certification Name');
      await user.type(nameInput, 'AWS');

      const issuerInput = document.getElementById('cert-issuer') as HTMLInputElement;
      await user.click(issuerInput);
      await user.type(issuerInput, 'AWS');

      const submitButton = screen.getByText('Add Certificate');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('No certifications added yet')).toBeInTheDocument();
      });
    });

    it('closes form when Cancel is clicked', async () => {
      const user = userEvent.setup();
      const profile = { ...mockProfile, education: [], certifications: [] };
      renderWithProviders(<EducationSection profile={profile} />);

      const addButtons = screen.getAllByText('Add');
      await user.click(addButtons[1]);

      expect(screen.getByLabelText('Certification Name')).toBeInTheDocument();

      const cancelButtons = screen.getAllByText('Cancel');
      // When certificate form is open, only the certificate form's Cancel button is visible
      await user.click(cancelButtons[0]);

      expect(screen.getByText('No certifications added yet')).toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('shows error toast when adding education fails', async () => {
      const user = userEvent.setup();
      const profile = { ...mockProfile, education: [], certifications: [] };
      (api.addEducation as any).mockRejectedValue(new Error('Failed to save'));

      renderWithProviders(<EducationSection profile={profile} />);

      const addButtons = screen.getAllByText('Add');
      await user.click(addButtons[0]);

      const instInput = document.getElementById('edu-inst') as HTMLInputElement;
      await user.click(instInput);
      await user.type(instInput, 'MIT');

      const degreeInput = document.getElementById('edu-degree') as HTMLInputElement;
      await user.click(degreeInput);
      await user.type(degreeInput, 'Bachelor');

      const fieldInput = document.getElementById('edu-field') as HTMLInputElement;
      await user.click(fieldInput);
      await user.type(fieldInput, 'CS');

      const submitButton = screen.getByText('Add Education');
      await user.click(submitButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to save');
      });
    });

    it('shows generic error when adding certificate fails without message', async () => {
      const user = userEvent.setup();
      const profile = { ...mockProfile, education: [], certifications: [] };
      (api.addCertificate as any).mockRejectedValue('Unknown error');

      renderWithProviders(<EducationSection profile={profile} />);

      const addButtons = screen.getAllByText('Add');
      await user.click(addButtons[1]);

      const nameInput = screen.getByLabelText('Certification Name');
      await user.type(nameInput, 'AWS');

      const issuerInput = document.getElementById('cert-issuer') as HTMLInputElement;
      await user.click(issuerInput);
      await user.type(issuerInput, 'AWS');

      const submitButton = screen.getByText('Add Certificate');
      await user.click(submitButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to add certificate');
      });
    });
  });

  describe('certificate date display', () => {
    it('displays only issue date when expiry is not set', () => {
      const certifications = [
        {
          id: '1',
          name: 'AWS Certified',
          issuer: 'AWS',
          issueDate: '2023-01-15',
          expiryDate: undefined,
          createdAt: '2024-01-01T00:00:00Z',
        },
      ];
      const profile = { ...mockProfile, education: [], certifications };
      renderWithProviders(<EducationSection profile={profile} />);

      expect(screen.getByText(/Issued:/)).toBeInTheDocument();
      expect(screen.queryByText(/Expires:/)).not.toBeInTheDocument();
    });

    it('displays only expiry date when issue date is not set', () => {
      const certifications = [
        {
          id: '1',
          name: 'AWS Certified',
          issuer: 'AWS',
          issueDate: undefined,
          expiryDate: '2025-01-15',
          createdAt: '2024-01-01T00:00:00Z',
        },
      ];
      const profile = { ...mockProfile, education: [], certifications };
      renderWithProviders(<EducationSection profile={profile} />);

      expect(screen.queryByText(/Issued:/)).not.toBeInTheDocument();
      expect(screen.getByText(/Expires:/)).toBeInTheDocument();
    });

    it('displays both dates when both are set', () => {
      const certifications = [
        {
          id: '1',
          name: 'AWS Certified',
          issuer: 'AWS',
          issueDate: '2023-01-15',
          expiryDate: '2025-01-15',
          createdAt: '2024-01-01T00:00:00Z',
        },
      ];
      const profile = { ...mockProfile, education: [], certifications };
      renderWithProviders(<EducationSection profile={profile} />);

      expect(screen.getByText(/Issued:/)).toBeInTheDocument();
      expect(screen.getByText(/Expires:/)).toBeInTheDocument();
    });
  });

  describe('education year display', () => {
    it('displays year range when both start and end year are set', () => {
      const education = [
        {
          id: '1',
          institution: 'MIT',
          degree: 'Bachelor',
          field: 'CS',
          startYear: 2015,
          endYear: 2019,
          country: 'US',
          createdAt: '2024-01-01T00:00:00Z',
        },
      ];
      const profile = { ...mockProfile, education, certifications: [] };
      renderWithProviders(<EducationSection profile={profile} />);

      expect(screen.getByText('2015 - 2019')).toBeInTheDocument();
    });

    it('displays only start year when end year is not set', () => {
      const education = [
        {
          id: '1',
          institution: 'MIT',
          degree: 'Bachelor',
          field: 'CS',
          startYear: 2015,
          endYear: undefined,
          country: 'US',
          createdAt: '2024-01-01T00:00:00Z',
        },
      ];
      const profile = { ...mockProfile, education, certifications: [] };
      renderWithProviders(<EducationSection profile={profile} />);

      expect(screen.getByText('2015')).toBeInTheDocument();
      expect(screen.queryByText(/2015 -/)).not.toBeInTheDocument();
    });

    it('displays only end year when start year is not set', () => {
      const education = [
        {
          id: '1',
          institution: 'MIT',
          degree: 'Bachelor',
          field: 'CS',
          startYear: undefined,
          endYear: 2019,
          country: 'US',
          createdAt: '2024-01-01T00:00:00Z',
        },
      ];
      const profile = { ...mockProfile, education, certifications: [] };
      renderWithProviders(<EducationSection profile={profile} />);

      expect(screen.getByText('2019')).toBeInTheDocument();
    });

    it('displays no year info when both are not set', () => {
      const education = [
        {
          id: '1',
          institution: 'MIT',
          degree: 'Bachelor',
          field: 'CS',
          startYear: undefined,
          endYear: undefined,
          country: 'US',
          createdAt: '2024-01-01T00:00:00Z',
        },
      ];
      const profile = { ...mockProfile, education, certifications: [] };
      renderWithProviders(<EducationSection profile={profile} />);

      // Should not have year elements
      expect(screen.queryByText(/\d{4}/)).not.toBeInTheDocument();
    });
  });
});
