import { useState } from 'react';
import SearchableCombobox from '../../../components/common/SearchableCombobox';
import degrees from '../../../data/degrees';
import countries from '../../../data/countries';
import universitiesByCountry from '../../../data/universitiesByCountry';
import type { EducationEntry } from '../types';

const loadFields = () => import('../../../data/fieldsOfStudy').then(m => m.default);
const getUniversitiesForCountry = (countryName: string): string[] => universitiesByCountry[countryName] || [];

interface StepEducationProps {
  educationEntries: EducationEntry[];
  setEducationEntries: React.Dispatch<React.SetStateAction<EducationEntry[]>>;
  yearsOfExperience: number | null;
  setYearsOfExperience: (v: number | null) => void;
  freelancerJobsRange: string;
  setFreelancerJobsRange: (v: string) => void;
  freelancePlatforms: string;
  setFreelancePlatforms: (v: string) => void;
  onNext: () => void;
  onSkip: () => void;
  error: string;
}

export function StepEducation({
  educationEntries,
  setEducationEntries,
  yearsOfExperience,
  setYearsOfExperience,
  freelancerJobsRange,
  setFreelancerJobsRange,
  freelancePlatforms,
  setFreelancePlatforms,
  onNext,
  onSkip: _onSkip,
  error,
}: StepEducationProps) {
  const [addingEducation, setAddingEducation] = useState(false);
  const [newEducation, setNewEducation] = useState<EducationEntry>({ institution: '', degree: '', field: '', country: '' });

  const handleAddEducation = () => {
    if (!newEducation.institution.trim() || !newEducation.degree.trim() || !newEducation.field.trim()) return;
    if ((newEducation.startYear && !newEducation.endYear) || (!newEducation.startYear && newEducation.endYear)) {
      alert('Please enter both start and end years, or leave both empty');
      return;
    }
    if (newEducation.startYear && newEducation.endYear && newEducation.startYear > newEducation.endYear) {
      alert('Start year must be before or equal to end year');
      return;
    }
    setEducationEntries(prev => [...prev, { ...newEducation, institution: newEducation.institution.trim(), degree: newEducation.degree.trim(), field: newEducation.field.trim() }]);
    setNewEducation({ institution: '', degree: '', field: '', country: '' });
    setAddingEducation(false);
  };

  const handleRemoveEducation = (index: number) => {
    setEducationEntries(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <>
      <h2 data-step-heading tabIndex={-1} className="text-xl sm:text-2xl font-bold text-slate-900 mb-2 outline-none">Experience & Education</h2>
      <p className="text-slate-600 mb-6">Share your background and credentials</p>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm" role="alert">{error}</div>}

      {/* Years of Experience */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-700 mb-2">Years of Professional Experience</label>
        <div className="flex items-center gap-3">
          <input
            type="number"
            inputMode="numeric"
            value={yearsOfExperience ?? ''}
            onChange={(e) => {
              const val = e.target.value;
              if (val === '') { setYearsOfExperience(null); return; }
              const num = parseInt(val);
              if (!isNaN(num) && num >= 0 && num <= 70) setYearsOfExperience(num);
            }}
            min={0}
            max={70}
            placeholder="e.g., 5"
            className="w-24 px-3 py-2.5 sm:py-2 border border-slate-300 rounded-lg text-base sm:text-sm text-center focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            aria-label="Years of professional experience"
          />
          <span className="text-sm text-slate-500">years</span>
        </div>
        <p className="text-xs text-slate-400 mt-1">Helps agents find experienced professionals</p>
      </div>

      {/* Jobs Completed as Freelancer */}
      <div className="mb-6">
        <label htmlFor="jobs-range" className="block text-sm font-medium text-slate-700 mb-2">Jobs completed as freelancer</label>
        <select
          id="jobs-range"
          value={freelancerJobsRange}
          onChange={(e) => setFreelancerJobsRange(e.target.value)}
          className="w-full px-3 sm:px-4 py-2.5 sm:py-2 border border-slate-300 rounded-lg text-base sm:text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white"
        >
          <option value="">Select a range...</option>
          <option value="new">New to freelancing</option>
          <option value="1-10">1-10 jobs</option>
          <option value="10-50">10-50 jobs</option>
          <option value="50-100">50-100 jobs</option>
          <option value="100-500">100-500 jobs</option>
          <option value="500+">500+ jobs</option>
        </select>
        <p className="text-xs text-slate-400 mt-1">Your experience level on platforms like Upwork, Fiverr, etc.</p>
      </div>

      {/* Freelance Platforms */}
      <div className="mb-6">
        <label htmlFor="freelance-platforms" className="block text-sm font-medium text-slate-700 mb-2">Freelance platforms (Optional)</label>
        <input
          id="freelance-platforms"
          type="text"
          value={freelancePlatforms}
          onChange={(e) => setFreelancePlatforms(e.target.value)}
          placeholder="e.g., Level 2 Seller on Fiverr, Top Rated on Upwork..."
          className="w-full px-3 sm:px-4 py-2.5 sm:py-2 border border-slate-300 rounded-lg text-base sm:text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
        />
        <p className="text-xs text-slate-400 mt-1">Share your reputation or badges (e.g., seller level, badges, ratings) without sharing profile links</p>
      </div>

      {/* Education Section */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-700 mb-2">Education (Optional)</label>
        {educationEntries.length === 0 ? (
          <p className="text-xs text-slate-400 mb-4">No education added yet</p>
        ) : (
          <div className="space-y-3 mb-4">
            {educationEntries.map((edu, idx) => (
              <div key={idx} className="p-3 border border-slate-200 rounded-lg bg-slate-50">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 text-sm">{edu.degree} in {edu.field}</p>
                    <p className="text-xs text-slate-600">{edu.institution}</p>
                    <p className="text-xs text-slate-500">{edu.country}</p>
                    {edu.startYear && edu.endYear && (
                      <p className="text-xs text-slate-500 mt-1">{edu.startYear} - {edu.endYear}</p>
                    )}
                  </div>
                  <button type="button" onClick={() => handleRemoveEducation(idx)} className="text-slate-400 hover:text-red-500 font-bold flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label={`Remove education: ${edu.degree} in ${edu.field}`}>×</button>
                </div>
              </div>
            ))}
          </div>
        )}
        {educationEntries.length < 5 && !addingEducation && (
          <button type="button" onClick={() => setAddingEducation(true)} className="w-full py-3 min-h-[44px] border-2 border-dashed border-orange-300 rounded-lg text-sm text-orange-600 hover:text-orange-700 hover:border-orange-400 hover:bg-orange-50 active:bg-orange-100 font-medium mb-4 transition-colors">+ Add Education</button>
        )}
        {addingEducation && (
          <div className="border border-slate-300 rounded-lg p-4 mb-4 bg-white">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <SearchableCombobox id="edu-degree" label="Degree" value={newEducation.degree} onChange={(v) => setNewEducation({ ...newEducation, degree: v })} options={degrees} placeholder="e.g., Bachelor of Science" required />
              <SearchableCombobox id="edu-field" label="Field of Study" value={newEducation.field} onChange={(v) => setNewEducation({ ...newEducation, field: v })} options={loadFields} placeholder="e.g., Computer Science" required />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <SearchableCombobox id="edu-country" label="Country" value={newEducation.country} onChange={(v) => setNewEducation({ ...newEducation, country: v, institution: '' })} options={countries} placeholder="Country" required />
                <p className="text-xs text-slate-400 mt-1">Changing country resets the institution field</p>
              </div>
              <div>
                <SearchableCombobox id="edu-inst" label="Institution" value={newEducation.institution} onChange={(v) => setNewEducation({ ...newEducation, institution: v })} options={newEducation.country ? getUniversitiesForCountry(newEducation.country) : []} placeholder="Type your institution name..." required allowFreeText />
                <p className="text-xs text-slate-500 font-medium mt-1">Type any name — school, bootcamp, online course, or self-taught</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Start Year (Optional)</label>
                <input type="number" value={newEducation.startYear || ''} onChange={(e) => setNewEducation({ ...newEducation, startYear: e.target.value ? parseInt(e.target.value) : undefined })} placeholder="2015" min="1900" max={new Date().getFullYear()} className="w-full px-3 py-2.5 sm:py-2 border border-slate-300 rounded-lg text-base sm:text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">End Year (Optional)</label>
                <input type="number" value={newEducation.endYear || ''} onChange={(e) => setNewEducation({ ...newEducation, endYear: e.target.value ? parseInt(e.target.value) : undefined })} placeholder="2019" min="1900" max={new Date().getFullYear() + 5} className="w-full px-3 py-2.5 sm:py-2 border border-slate-300 rounded-lg text-base sm:text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500" />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={handleAddEducation} disabled={!newEducation.institution.trim() || !newEducation.degree.trim() || !newEducation.field.trim()} className="px-4 py-2.5 sm:py-2 bg-orange-500 text-white rounded-lg font-medium text-sm hover:bg-orange-600 active:bg-orange-700 disabled:opacity-50 transition-colors min-h-[44px]">Add Education</button>
              <button type="button" onClick={() => { setAddingEducation(false); setNewEducation({ institution: '', degree: '', field: '', country: '' }); }} className="px-4 py-2.5 sm:py-2 border border-slate-300 text-slate-700 rounded-lg font-medium text-sm hover:bg-slate-50 active:bg-slate-100 transition-colors min-h-[44px]">Cancel</button>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end mt-6">
        <button type="button" onClick={onNext} className="w-12 h-12 rounded-full bg-orange-500 text-white flex items-center justify-center hover:bg-orange-600 active:bg-orange-700 transition-colors shadow-lg focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-500" aria-label="Next step">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
    </>
  );
}
