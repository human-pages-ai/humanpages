import { useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../../lib/api';
import SearchableCombobox from '../common/SearchableCombobox';
import degrees from '../../data/degrees';
import certIssuers from '../../data/certIssuers';
import countries from '../../data/countries';
import universitiesByCountry from '../../data/universitiesByCountry';
import { Profile } from './types';

interface EducationEntry {
  id?: string;
  institution: string;
  degree: string;
  field: string;
  startYear?: number;
  endYear?: number;
  country: string;
}

interface CertificateEntry {
  id?: string;
  name: string;
  issuer: string;
  issueDate?: string;
  expiryDate?: string;
}

interface Props {
  profile: Profile;
  onUpdate?: () => void;
}

const loadFields = () => import('../../data/fieldsOfStudy').then(m => m.default);

const getUniversitiesForCountry = (countryName: string): string[] => {
  return universitiesByCountry[countryName] || [];
};

export default function EducationSection({ profile, onUpdate }: Props) {
  const [editingEducation, setEditingEducation] = useState(false);
  const [editingCertificates, setEditingCertificates] = useState(false);
  const [saving, setSaving] = useState(false);

  const [educationForm, setEducationForm] = useState<EducationEntry>({
    institution: '',
    degree: '',
    field: '',
    country: '',
  });

  const [certificateForm, setCertificateForm] = useState<CertificateEntry>({
    name: '',
    issuer: '',
  });

  const handleAddEducation = async () => {
    if (!educationForm.institution.trim() || !educationForm.degree.trim() || !educationForm.field.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSaving(true);
    try {
      await api.addEducation({
        institution: educationForm.institution,
        degree: educationForm.degree || undefined,
        field: educationForm.field || undefined,
        year: educationForm.endYear || educationForm.startYear || undefined,
        country: educationForm.country || undefined,
      });

      toast.success('Education added');
      setEducationForm({ institution: '', degree: '', field: '', country: '' });
      setEditingEducation(false);
      onUpdate?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add education');
    } finally {
      setSaving(false);
    }
  };

  const handleAddCertificate = async () => {
    if (!certificateForm.name.trim() || !certificateForm.issuer.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSaving(true);
    try {
      await api.addCertificate({
        name: certificateForm.name,
        issuer: certificateForm.issuer,
        issueDate: certificateForm.issueDate,
        expiryDate: certificateForm.expiryDate,
      });

      toast.success('Certificate added');
      setCertificateForm({ name: '', issuer: '' });
      setEditingCertificates(false);
      onUpdate?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add certificate');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Education Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Education</h3>
          {!editingEducation && (
            <button
              onClick={() => setEditingEducation(true)}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              {(profile.education?.length ?? 0) > 0 ? 'Edit' : 'Add'}
            </button>
          )}
        </div>

        {editingEducation ? (
          <div className="space-y-4">
            {/* Row 1: Degree (50%) | Field of Study (50%) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SearchableCombobox
                id="edu-degree"
                label="Degree"
                value={educationForm.degree}
                onChange={v => setEducationForm(f => ({ ...f, degree: v }))}
                options={degrees}
                placeholder="e.g., Bachelor of Science"
                required
              />

              <SearchableCombobox
                id="edu-field"
                label="Field of Study"
                value={educationForm.field}
                onChange={v => setEducationForm(f => ({ ...f, field: v }))}
                options={loadFields}
                placeholder="e.g., Computer Science"
                required
              />
            </div>

            {/* Row 2: Country (40%) | Institution (60%) */}
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
              <div className="sm:col-span-2">
                <SearchableCombobox
                  id="edu-country"
                  label="Country"
                  value={educationForm.country}
                  onChange={v => {
                    setEducationForm(f => ({ ...f, country: v, institution: '' }));
                  }}
                  options={countries}
                  placeholder="Country"
                  required
                />
              </div>

              <div className="sm:col-span-3">
                <SearchableCombobox
                  id="edu-inst"
                  label="Institution"
                  value={educationForm.institution}
                  onChange={v => setEducationForm(f => ({ ...f, institution: v }))}
                  options={educationForm.country ? getUniversitiesForCountry(educationForm.country) : []}
                  placeholder="Select or type your institution"
                  required
                  allowFreeText
                />
                {educationForm.country && (
                  <p className="text-xs text-gray-500 mt-1">Can't find your institution? Just type the name.</p>
                )}
              </div>
            </div>

            {/* Row 3: Start Year (50%) | End Year (50%) */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Year</label>
                <input
                  type="number"
                  value={educationForm.startYear || ''}
                  onChange={e => setEducationForm(f => ({ ...f, startYear: e.target.value ? parseInt(e.target.value) : undefined }))}
                  placeholder="2015"
                  min="1900"
                  max={new Date().getFullYear()}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Year</label>
                <input
                  type="number"
                  value={educationForm.endYear || ''}
                  onChange={e => setEducationForm(f => ({ ...f, endYear: e.target.value ? parseInt(e.target.value) : undefined }))}
                  placeholder="2019"
                  min="1900"
                  max={new Date().getFullYear() + 5}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleAddEducation}
                disabled={saving}
                className="px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Add Education'}
              </button>
              <button
                onClick={() => {
                  setEditingEducation(false);
                  setEducationForm({ institution: '', degree: '', field: '', country: '' });
                }}
                className="px-4 py-2.5 border border-gray-200 text-gray-700 rounded-lg font-medium text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {profile.education && profile.education.length > 0 ? (
              profile.education.map((edu) => (
                <div key={edu.id} className="border border-gray-200 rounded-lg p-3">
                  <p className="font-medium text-gray-900">{edu.degree} in {edu.field}</p>
                  <p className="text-sm text-gray-600">{edu.institution}</p>
                  <p className="text-xs text-gray-500 mt-1">{edu.country}</p>
                  {(edu.startYear || edu.endYear) && (
                    <p className="text-xs text-gray-500">
                      {edu.startYear && edu.endYear ? `${edu.startYear} - ${edu.endYear}` : edu.startYear || edu.endYear}
                    </p>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500 italic">No education added yet</p>
            )}
          </div>
        )}
      </div>

      {/* Certificates Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Certifications</h3>
          {!editingCertificates && (
            <button
              onClick={() => setEditingCertificates(true)}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              {(profile.certifications?.length ?? 0) > 0 ? 'Edit' : 'Add'}
            </button>
          )}
        </div>

        {editingCertificates ? (
          <div className="space-y-4">
            <div>
              <label htmlFor="cert-name" className="block text-sm font-medium text-gray-700 mb-1">Certification Name</label>
              <input
                id="cert-name"
                type="text"
                value={certificateForm.name}
                onChange={e => setCertificateForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g., AWS Solutions Architect"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <SearchableCombobox
              id="cert-issuer"
              label="Issuer"
              value={certificateForm.issuer}
              onChange={v => setCertificateForm(f => ({ ...f, issuer: v }))}
              options={certIssuers}
              placeholder="Issuing organization"
              required
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Issue Date</label>
                <input
                  type="date"
                  value={certificateForm.issueDate || ''}
                  onChange={e => setCertificateForm(f => ({ ...f, issueDate: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                <input
                  type="date"
                  value={certificateForm.expiryDate || ''}
                  onChange={e => setCertificateForm(f => ({ ...f, expiryDate: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleAddCertificate}
                disabled={saving}
                className="px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Add Certificate'}
              </button>
              <button
                onClick={() => {
                  setEditingCertificates(false);
                  setCertificateForm({ name: '', issuer: '' });
                }}
                className="px-4 py-2.5 border border-gray-200 text-gray-700 rounded-lg font-medium text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {profile.certifications && profile.certifications.length > 0 ? (
              profile.certifications.map((cert) => (
                <div key={cert.id} className="border border-gray-200 rounded-lg p-3">
                  <p className="font-medium text-gray-900">{cert.name}</p>
                  <p className="text-sm text-gray-600">{cert.issuer}</p>
                  {cert.issueDate && (
                    <p className="text-xs text-gray-500 mt-1">
                      Issued: {new Date(cert.issueDate).toLocaleDateString()}
                    </p>
                  )}
                  {cert.expiryDate && (
                    <p className="text-xs text-gray-500">
                      Expires: {new Date(cert.expiryDate).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500 italic">No certifications added yet</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
