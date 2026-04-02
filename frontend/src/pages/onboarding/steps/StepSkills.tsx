import { useTranslation } from 'react-i18next';
import { SKILL_CATEGORIES, POPULAR_SKILLS, SKILL_SUGGESTIONS } from '../constants';
import { useWizardAnalytics, useTrackedField } from '../../../lib/wizardAnalytics';

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
  onNext: () => void;
  error: string;
}

export function StepSkills({
  skills, toggleSkill, customSkill, setCustomSkill, addCustomSkill,
  skillSearch, setSkillSearch, expandedCategories, toggleCategory,
  onNext, error,
}: StepSkillsProps) {
  const { t } = useTranslation();
  const wa = useWizardAnalytics();
  const searchField = useTrackedField('skill_search');

  return (
    <>
      <h2 data-step-heading tabIndex={-1} className="text-xl sm:text-2xl font-bold text-slate-900 mb-2 outline-none">{t('onboarding.skills.heading')}</h2>
      <p className="text-slate-600 mb-6">{t('onboarding.skills.subtitle')}</p>

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
              <button type="button" key={skill} onClick={() => { wa?.trackItemRemoved('skill', skill); toggleSkill(skill); }} aria-pressed="true" aria-label={`Remove skill: ${skill}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-orange-500 text-white hover:bg-orange-600 active:bg-orange-700 min-h-[44px]">
                {skill}<span aria-hidden="true" className="text-orange-200 ml-0.5 text-base leading-none">&times;</span>
              </button>
            ))}
          </div>
        )}

        {/* Search input */}
        <div className="relative mb-3">
          <input type="text" value={skillSearch} onChange={(e) => setSkillSearch(e.target.value)} placeholder={t('onboarding.skills.searchPlaceholder')} aria-label="Search skills" className="w-full px-3 py-2.5 sm:py-2 pl-9 border border-slate-300 rounded-lg text-base sm:text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500" {...searchField.props} />
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
                  <button type="button" key={skill} onClick={() => { wa?.trackItemAdded('skill', skill, 'search'); toggleSkill(skill); setSkillSearch(''); }} className="px-3 py-1.5 rounded-full text-sm font-medium bg-slate-100 text-slate-700 hover:bg-orange-100 hover:text-orange-700 active:bg-orange-200 min-h-[44px]">+ {skill}</button>
                ))}
              </div>
            );
          })()}</div>
        ) : (
          <>
            <div className="mb-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{t('onboarding.skills.popular')}</p>
              <div className="flex flex-wrap gap-2">
                {POPULAR_SKILLS.filter(s => !skills.some(sk => sk.toLowerCase() === s.toLowerCase())).slice(0, 8).map(skill => (
                  <button type="button" key={skill} onClick={() => { wa?.trackItemAdded('skill', skill, 'popular'); toggleSkill(skill); }} aria-pressed="false" className="px-3 py-1.5 rounded-full text-sm font-medium bg-slate-100 text-slate-700 hover:bg-orange-100 hover:text-orange-700 active:bg-orange-200 min-h-[44px]">{skill}</button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">{t('onboarding.skills.browse')}</p>
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
                          return <button key={skill} onClick={() => { if (isSelected) { wa?.trackItemRemoved('skill', skill); } else { wa?.trackItemAdded('skill', skill, 'category'); } toggleSkill(skill); }} aria-pressed={isSelected} className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors min-h-[44px] ${isSelected ? 'bg-orange-500 text-white active:bg-orange-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 active:bg-slate-300'}`}>{skill}</button>;
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
          <input type="text" value={customSkill} onChange={(e) => setCustomSkill(e.target.value.slice(0, 50))} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); wa?.trackItemAdded('skill', customSkill, 'custom'); addCustomSkill(); } }} maxLength={50} placeholder={t('onboarding.skills.customPlaceholder')} aria-label="Add custom skill" autoCapitalize="words" className="flex-1 px-3 py-2.5 sm:py-2 border border-slate-300 rounded-lg text-base sm:text-sm" />
          <button type="button" onClick={() => { wa?.trackItemAdded('skill', customSkill, 'custom'); addCustomSkill(); }} disabled={!customSkill.trim()} className="px-4 py-2.5 sm:py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 active:bg-slate-300 disabled:opacity-50 min-h-[44px]">{t('common.add')}</button>
        </div>
      </div>

      <div className="flex justify-end mt-6">
        <button type="button" onClick={onNext} className="w-12 h-12 rounded-full bg-orange-500 text-white flex items-center justify-center hover:bg-orange-600 active:bg-orange-700 transition-colors shadow-lg focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-500" aria-label="Next step">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
    </>
  );
}
