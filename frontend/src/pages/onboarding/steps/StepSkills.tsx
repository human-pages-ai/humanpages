import { useState } from 'react';
import SearchableCombobox from '../../../components/common/SearchableCombobox';
import degrees from '../../../data/degrees';
import countries from '../../../data/countries';
import universitiesByCountry from '../../../data/universitiesByCountry';
import toast from 'react-hot-toast';
import { SKILL_CATEGORIES, POPULAR_SKILLS, SKILL_SUGGESTIONS, COMMON_LANGUAGES, PROFICIENCY_LEVELS } from '../constants';
import type { EducationEntry, LanguageEntry } from '../types';

const loadFields = () => import('../../../data/fieldsOfStudy').then(m => m.default);
const getUniversitiesForCountry = (countryName: string): string[] => universitiesByCountry[countryName] || [];

interface StepSkillsProps {
  skills: string[];
  toggleSkill: (skill: string) => void;
  customSkill: string;
  setCustomSkill: (v: string) => void;
  addCustomSkill: () => void;
  skillSearch: string;
  setSkillSearch: (v: string) => void;
  expandedCategories: Set<string>;
  toggleCategory: (cat: string) => void;
  educationEntries: EducationEntry[];
  setEducationEntries: React.Dispatch<React.SetStateAction<EducationEntry[]>>;
  languageEntries: LanguageEntry[];
  addLanguageEntry: (entry: LanguageEntry) => void;
  removeLanguageEntry: (index: number) => void;
  updateLanguageEntry: (index: number, updates: Partial<LanguageEntry>) => void;
  yearsOfExperience: number | null;
  setYearsOfExperience: (v: number | null) => void;
  onNext: () => void;
  error: string;
}

export function StepSkills({
  skills, toggleSkill, customSkill, setCustomSkill, addCustomSkill,
  skillSearch, setSkillSearch, expandedCategories, toggleCategory,
  educationEntries, setEducationEntries,
  languageEntries, addLanguageEntry, removeLanguageEntry, updateLanguageEntry,
  yearsOfExperience, setYearsOfExperience,
  onNext, error,
}: StepSkillsProps) {
  const [addingEducation, setAddingEducation] = useState(false);
  const [newEducation, setNewEducation] = useState<EducationEntry>({ institution: '', degree: '', field: '', country: '' });
  const [newLang, setNewLang] = useState('');
  const [newProficiency, setNewProficiency] = useState('');
  const [addingLanguage, setAddingLanguage] = useState(false);

  const handleAddLanguage = () => {
    const trimmed = newLang.trim();
    if (!trimmed) return;
    if (!newProficiency.trim()) {
      toast.error('Please select a proficiency level');
      return;
    }
    if (languageEntries.some(entry => entry.language.toLowerCase() === trimmed.toLowerCase())) {
      toast.error('This language is already added');
      return;
    }
    addLanguageEntry({ language: trimmed, proficiency: newProficiency });
    setNewLang('');
    setNewProficiency('');
    setAddingLanguage(false);
  };

  const handleAddEducation = () => {
    if (!newEducation.institution.trim() || !newEducation.degree.trim() || !newEducation.field.trim()) return;
    if ((newEducation.startYear && !newEducation.endYear) || (!newEducation.startYear && newEducation.endYear)) {
      toast.error('Please enter both start and end years, or leave both empty');
      return;
    }
    if (newEducation.startYear && newEducation.endYear && newEducation.startYear > newEducation.endYear) {
      toast.error('Start year must be before or equal to end year');
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
      <h2 data-step-heading tabIndex={-1} className="text-xl sm:text-2xl font-bold text-slate-900 mb-2 outline-none">What can you do?</h2>
      <p className="text-slate-600 mb-6">Select your skills and share your background</p>

      {error && <div role="alert" tabIndex={-1} className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 outline-none">{error}</div>}

      {/* ─── Skills Section ─── */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Skills{skills.length > 0 && <span className="ml-2 text-xs font-normal text-orange-600">{skills.length} selected</span>}
        </label>

        {/* Selected skills */}
        {skills.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {skills.map((skill: string) => (
              <button type="button" key={skill} onClick={() => toggleSkill(skill)} aria-pressed="true" aria-label={`Remove skill: ${skill}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-orange-500 text-white hover:bg-orange-600 active:bg-orange-700 min-h-[44px]">
                {skill}<span aria-hidden="true" className="text-orange-200 ml-0.5 text-base leading-none">&times;</span>
              </button>
            ))}
          </div>
        )}

        {/* Search input */}
        <div className="relative mb-3">
          <input type="text" value={skillSearch} onChange={(e) => setSkillSearch(e.target.value)} placeholder="Search skills..." aria-label="Search skills" className="w-full px-3 py-2.5 sm:py-2 pl-9 border border-slate-300 rounded-lg text-base sm:text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500" />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>

        {skillSearch.trim() ? (
          <div className="mb-3">{(() => {
            const query = skillSearch.toLowerCase();
            const skillsLower = new Set(skills.map(sk => sk.toLowerCase()));
            const matches = SKILL_SUGGESTIONS.filter(s => s.toLowerCase().includes(query) && !skillsLower.has(s.toLowerCase()));
            if (matches.length === 0) return <p className="text-xs text-slate-400 mb-2">No matching skills</p>;
            return (
              <div className="flex flex-wrap gap-2">
                {matches.slice(0, 12).map(skill => (
                  <button type="button" key={skill} onClick={() => { toggleSkill(skill); setSkillSearch(''); }} className="px-3 py-1.5 rounded-full text-sm font-medium bg-slate-100 text-slate-700 hover:bg-orange-100 hover:text-orange-700 active:bg-orange-200 min-h-[44px]">+ {skill}</button>
                ))}
              </div>
            );
          })()}</div>
        ) : (
          <>
            <div className="mb-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Popular</p>
              <div className="flex flex-wrap gap-2">
                {POPULAR_SKILLS.filter(s => !skills.some(sk => sk.toLowerCase() === s.toLowerCase())).slice(0, 8).map(skill => (
                  <button type="button" key={skill} onClick={() => toggleSkill(skill)} aria-pressed="false" className="px-3 py-1.5 rounded-full text-sm font-medium bg-slate-100 text-slate-700 hover:bg-orange-100 hover:text-orange-700 active:bg-orange-200 min-h-[44px]">{skill}</button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Browse</p>
              {Object.entries(SKILL_CATEGORIES).map(([category, categorySkills]) => {
                const isExpanded = expandedCategories.has(category);
                const skillsLower = new Set(skills.map(s => s.toLowerCase()));
                const selectedInCategory = categorySkills.filter(s => skillsLower.has(s.toLowerCase())).length;
                return (
                  <div key={category}>
                    <button type="button" onClick={() => toggleCategory(category)} aria-expanded={isExpanded} className="flex items-center gap-2 w-full text-left py-2.5 sm:py-1.5 group active:bg-slate-50 rounded-md -mx-1 px-1">
                      <span className="text-xs text-slate-400 transition-transform" style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>▸</span>
                      <span className="text-xs font-semibold text-slate-500 uppercase group-hover:text-slate-700">{category}</span>
                      {selectedInCategory > 0 ? <span className="text-xs text-orange-600 font-medium">{selectedInCategory} selected</span> : <span className="text-xs text-slate-400">{categorySkills.length}</span>}
                    </button>
                    {isExpanded && (
                      <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-1 mb-2 pl-2 sm:pl-4">
                        {categorySkills.map(skill => {
                          const isSelected = skillsLower.has(skill.toLowerCase());
                          return <button key={skill} onClick={() => toggleSkill(skill)} aria-pressed={isSelected} className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors min-h-[44px] ${isSelected ? 'bg-orange-500 text-white active:bg-orange-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 active:bg-slate-300'}`}>{skill}</button>;
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Custom skill input */}
        <div className="flex gap-2 mt-3">
          <input type="text" value={customSkill} onChange={(e) => setCustomSkill(e.target.value.slice(0, 50))} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomSkill(); } }} maxLength={50} placeholder="Add custom skill..." aria-label="Add custom skill" autoCapitalize="words" className="flex-1 px-3 py-2.5 sm:py-2 border border-slate-300 rounded-lg text-base sm:text-sm" />
          <button type="button" onClick={addCustomSkill} disabled={!customSkill.trim()} className="px-4 py-2.5 sm:py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 active:bg-slate-300 disabled:opacity-50 min-h-[44px]">Add</button>
        </div>
      </div>

      {/* ─── Languages Section ─── */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Languages (Optional){languageEntries.length > 0 && <span className="ml-2 text-xs font-normal text-orange-600">{languageEntries.length} added</span>}
        </label>
        {languageEntries.length > 0 && (
          <div className="space-y-3 mb-4">
            {languageEntries.map((entry, idx) => (
              <div key={idx} className="flex items-center gap-2 p-3 border border-slate-200 rounded-lg bg-slate-50">
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-slate-900 text-sm">{entry.language}</span>
                  {entry.proficiency && <span className="text-xs text-slate-500 ml-2">({entry.proficiency})</span>}
                </div>
                <select value={entry.proficiency} onChange={(e) => updateLanguageEntry(idx, { proficiency: e.target.value })} className="text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-white text-slate-600 focus:ring-2 focus:ring-orange-500 focus:border-orange-500" aria-label={`Proficiency for ${entry.language}`}>
                  <option value="">No level set</option>
                  {PROFICIENCY_LEVELS.map(level => <option key={level} value={level}>{level}</option>)}
                </select>
                <button type="button" onClick={() => removeLanguageEntry(idx)} className="text-slate-400 hover:text-red-500 font-bold flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label={`Remove language: ${entry.language}`}>×</button>
              </div>
            ))}
          </div>
        )}
        {languageEntries.length < 10 && !addingLanguage && (
          <button type="button" onClick={() => setAddingLanguage(true)} className="w-full py-3 min-h-[44px] border-2 border-dashed border-orange-300 rounded-lg text-sm text-orange-600 hover:text-orange-700 hover:border-orange-400 hover:bg-orange-50 active:bg-orange-100 font-medium mb-4 transition-colors">+ Add Language</button>
        )}
        {addingLanguage && (
          <div className="border border-slate-300 rounded-lg p-4 mb-4 bg-white">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <SearchableCombobox id="onb-lang-name" label="Language" value={newLang} onChange={(v) => setNewLang(v)} options={COMMON_LANGUAGES.filter(lang => !languageEntries.some(entry => entry.language.toLowerCase() === lang.toLowerCase()))} placeholder="e.g., English" required allowFreeText />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Proficiency</label>
                <select value={newProficiency} onChange={(e) => setNewProficiency(e.target.value)} className="w-full px-3 py-2.5 sm:py-2 border border-slate-300 rounded-lg text-base sm:text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white" aria-label="Proficiency level" aria-required="true">
                  <option value="">Select proficiency...</option>
                  {PROFICIENCY_LEVELS.map(level => <option key={level} value={level}>{level}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={handleAddLanguage} disabled={!newLang.trim()} className="px-4 py-2.5 sm:py-2 bg-orange-500 text-white rounded-lg font-medium text-sm hover:bg-orange-600 active:bg-orange-700 disabled:opacity-50 transition-colors min-h-[44px]">Add Language</button>
              <button type="button" onClick={() => { setAddingLanguage(false); setNewLang(''); setNewProficiency(''); }} className="px-4 py-2.5 sm:py-2 text-slate-600 bg-slate-100 rounded-lg font-medium text-sm hover:bg-slate-200 active:bg-slate-300 transition-colors min-h-[44px]">Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Years of Experience ─── */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Years of Professional Experience
          {skills.length > 0 && (
            <span className="block text-xs font-normal text-slate-500 mt-0.5">
              in {Object.entries(SKILL_CATEGORIES).find(([_, categorySkills]) =>
                skills.some(s => categorySkills.includes(s))
              )?.[0] || 'your primary field'}
            </span>
          )}
        </label>
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
        <p className="text-xs text-slate-400 mt-1">Helps agents find experienced professionals for complex tasks</p>
      </div>

      {/* ─── Education Section ─── */}
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
              <SearchableCombobox id="onb-edu-degree" label="Degree" value={newEducation.degree} onChange={(v) => setNewEducation({ ...newEducation, degree: v })} options={degrees} placeholder="e.g., Bachelor of Science" required />
              <SearchableCombobox id="onb-edu-field" label="Field of Study" value={newEducation.field} onChange={(v) => setNewEducation({ ...newEducation, field: v })} options={loadFields} placeholder="e.g., Computer Science" required />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <SearchableCombobox id="onb-edu-country" label="Country" value={newEducation.country} onChange={(v) => setNewEducation({ ...newEducation, country: v, institution: '' })} options={countries} placeholder="Country" required />
                <p className="text-xs text-slate-400 mt-1">Changing country resets the institution field</p>
              </div>
              <div>
                <SearchableCombobox id="onb-edu-inst" label="Institution" value={newEducation.institution} onChange={(v) => setNewEducation({ ...newEducation, institution: v })} options={newEducation.country ? getUniversitiesForCountry(newEducation.country) : []} placeholder="Type your institution name..." required allowFreeText />
                <p className="text-xs text-slate-500 font-medium mt-1">💡 Tip: Type any institution name, even if it's not in the list</p>
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

      <div className="space-y-3">
        <button type="button" onClick={onNext} className="w-full py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 active:bg-orange-700 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-500">Continue to Finish</button>
        <p className="text-xs text-slate-500 text-center">Step 6 of 7</p>
      </div>
    </>
  );
}
