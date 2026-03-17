import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { analytics } from '../lib/analytics';
import { posthog } from '../lib/posthog';
import SEO from '../components/SEO';
import LocationAutocomplete from '../components/LocationAutocomplete';
import { getApplyIntent, clearApplyIntent, getListingApplyIntent, clearListingApplyIntent } from '../lib/applyIntent';
import toast from 'react-hot-toast';
import { safeLocalStorage } from '../lib/safeStorage';

const SKILL_CATEGORIES: Record<string, string[]> = {
  'Marketing & Sales': ['Social Media Management', 'SEO & SEM', 'Email Marketing', 'Sales & Lead Generation', 'Cold Outreach', 'Market Research', 'Influencer Marketing', 'Affiliate Marketing', 'Brand Strategy', 'Public Relations', 'Growth Hacking'],
  'Content & Writing': ['Content Writing', 'Copywriting', 'Proofreading & Editing', 'Technical Writing', 'Blog Writing', 'Ghostwriting', 'Grant Writing', 'Resume & Cover Letters', 'Script Writing'],
  'Design & Creative': ['Graphic Design', 'UI/UX Design', 'Photo & Image Editing', 'Video Production', 'Video Editing', 'Prototyping & Wireframing', 'Logo Design', 'Illustration', 'Animation & Motion Graphics', 'Brand Identity', '3D Modeling'],
  'Development & Tech': ['Software Development', 'Web Development', 'Mobile App Development', 'QA & Bug Testing', 'Code Review', 'DevOps & Cloud', 'Database Management', 'API Development', 'WordPress & CMS', 'AI & Machine Learning'],
  'Admin & Support': ['Virtual Assistant', 'Customer Support', 'Chat & Email Support', 'Data Entry', 'Email & Calendar Management', 'Scheduling', 'Document Management', 'Bookkeeping', 'Project Management', 'CRM Management'],
  'Education & Tutoring': ['English Teaching', 'Language Tutoring', 'Math Tutoring', 'Science Tutoring', 'Music Lessons', 'Test Prep & SAT', 'Academic Writing Help', 'Online Course Creation', 'Mentoring'],
  'Translation & Language': ['Translation', 'Interpretation', 'Localization', 'Subtitling & Captions', 'Transcription', 'Voiceover'],
  'Travel & Hospitality': ['Travel Planning', 'Tour Guide', 'Local Guide', 'Event Coordination', 'Concierge Services', 'Hotel & Airbnb Management'],
  'Transportation & Delivery': ['Personal Driver', 'Package Delivery', 'Courier Services', 'Airport Transfers', 'Moving & Relocation', 'Errand Running'],
  'Home & Personal Services': ['Pet Care', 'Dog Walking', 'House Sitting', 'Babysitting', 'Elder Care', 'Personal Shopping', 'Cooking & Meal Prep', 'Cleaning', 'Furniture Assembly', 'Handyman', 'Gardening & Landscaping'],
  'Community & Social': ['Community Management', 'Social Media Moderation', 'Discord & Telegram Management', 'Forum Moderation', 'Event Planning', 'Fundraising'],
  'Professional Services': ['Legal Research', 'Tax Preparation', 'Financial Consulting', 'Business Consulting', 'Real Estate', 'Insurance', 'Document Notarization', 'HR & Recruiting'],
  'Local & In-Person': ['Local Photography', 'In-Person Verification', 'Mystery Shopping', 'Survey & Feedback', 'In-Home Tech Support', 'Fitness Training', 'Tailoring & Alterations', 'Auto Repair'],
};

const POPULAR_SKILLS = ['Virtual Assistant', 'Content Writing', 'Graphic Design', 'Social Media Management', 'English Teaching', 'Translation', 'Video Editing', 'Web Development', 'Data Entry', 'Customer Support', 'Tour Guide', 'Personal Driver'];
const SKILL_SUGGESTIONS = Object.values(SKILL_CATEGORIES).flat();
const POPULAR_SERVICE_CATEGORIES = ['Photography', 'Delivery', 'Translation', 'Writing', 'Web Development', 'Data Entry', 'Graphic Design', 'Virtual Assistant', 'Tutoring', 'Other'];
const TOP_LANGUAGES = ['English', 'Spanish', 'Mandarin', 'French', 'German', 'Portuguese', 'Japanese', 'Hindi'];

export default function Onboarding() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [locationLat, setLocationLat] = useState<number | undefined>();
  const [locationLng, setLocationLng] = useState<number | undefined>();
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [skills, setSkills] = useState<string[]>([]);
  const [customSkill, setCustomSkill] = useState('');
  const [skillSearch, setSkillSearch] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [degree, setDegree] = useState('');
  const [field, setField] = useState('');
  const [institution, setInstitution] = useState('');
  const [country, setCountry] = useState('');
  const [languages, setLanguages] = useState<string[]>([]);
  const cvInputRef = useRef<HTMLInputElement>(null);
  const [serviceTitle, setServiceTitle] = useState('');
  const [serviceCategory, setServiceCategory] = useState('');
  const [serviceDescription, setServiceDescription] = useState('');
  const [servicePrice, setServicePrice] = useState('');
  const [serviceCurrency, setServiceCurrency] = useState('USD');
  const [serviceUnit, setServiceUnit] = useState('per hour');
  const [emailVerified, setEmailVerified] = useState(false);
  const [oauthPhotoUrl, setOauthPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    const storedPhotoUrl = safeLocalStorage.getItem('oauthPhotoUrl');
    if (storedPhotoUrl) {
      setOauthPhotoUrl(storedPhotoUrl);
      safeLocalStorage.removeItem('oauthPhotoUrl');
    }
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const data = await api.getProfile();
      analytics.identify(data.id);
      if (data.name) setName(data.name);
      if (data.bio) setBio(data.bio);
      if (data.location) setLocation(data.location);
      if (data.neighborhood) setNeighborhood(data.neighborhood);
      if (data.locationLat != null) setLocationLat(data.locationLat);
      if (data.locationLng != null) setLocationLng(data.locationLng);
      if (data.skills?.length) setSkills(data.skills);
      if (data.languages?.length) setLanguages(data.languages);
      setEmailVerified(data.emailVerified || false);
    } catch (error) {
      console.error('Failed to load profile:', error);
      navigate('/login');
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onload = (event) => { setPhotoPreview(event.target?.result as string); };
      reader.readAsDataURL(file);
    }
  };

  const handleCVChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      toast.promise((async () => { await api.uploadCV(file); })(), { loading: 'Uploading CV...', success: 'CV uploaded!', error: 'Failed to upload CV' });
    }
  };

  const toggleSkill = (skill: string) => {
    setSkills((prev) => prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]);
  };

  const addCustomSkill = () => {
    if (customSkill.trim() && !skills.includes(customSkill.trim())) {
      setSkills([...skills, customSkill.trim()]);
      setCustomSkill('');
    }
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      next.has(category) ? next.delete(category) : next.add(category);
      return next;
    });
  };

  const toggleLanguage = (lang: string) => {
    setLanguages((prev) => prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]);
  };

  const handleStep1Submit = async () => {
    if (!name.trim()) { setError('Name is required'); return; }
    setError('');
    setLoading(true);
    try {
      await api.updateProfile({ name: name.trim(), bio: bio.trim() || null, location: location.trim() || null, neighborhood: neighborhood || null, locationLat: locationLat ?? null, locationLng: locationLng ?? null });
      if (photoFile) await api.uploadProfilePhoto(photoFile);
      else if (oauthPhotoUrl) await api.importOAuthPhoto('google');
      setStep(2);
    } catch (error: any) {
      setError(error.message || 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  const handleStep2Submit = async () => {
    if (skills.length === 0) { setError('Select at least one skill'); return; }
    setError('');
    setLoading(true);
    try {
      if (degree.trim() || field.trim() || institution.trim() || country.trim()) {
        await api.addEducation({ degree: degree.trim() || undefined, field: field.trim() || undefined, institution: institution.trim() || undefined, country: country.trim() || undefined } as any);
      }
      await api.updateProfile({ skills, languages: languages.length > 0 ? languages : null });
      setStep(3);
    } catch (error: any) {
      setError(error.message || 'Failed to save skills');
    } finally {
      setLoading(false);
    }
  };

  const handleStep3Submit = async () => {
    if (!serviceTitle.trim() || !serviceCategory.trim()) { setError('Service title and category are required'); return; }
    setError('');
    setLoading(true);
    try {
      await api.createService({ title: serviceTitle.trim(), description: serviceDescription.trim(), category: serviceCategory, priceMin: servicePrice ? parseFloat(servicePrice) : null, priceCurrency: serviceCurrency, priceUnit: serviceUnit || null });
      posthog.capture('service_added');
      setStep(4);
    } catch (error: any) {
      setError(error.message || 'Failed to add service');
    } finally {
      setLoading(false);
    }
  };

  const handleStep4Submit = async () => {
    setLoading(true);
    try {
      await api.updateProfile({});
      analytics.track('onboarding_complete', { skillCount: skills.length });
      posthog.capture('onboarding_completed', { skillCount: skills.length });
      safeLocalStorage.removeItem('hp_onboarding_pending');
      const careerIntent = getApplyIntent();
      if (careerIntent) {
        try {
          await api.submitCareerApplication({ positionId: careerIntent.positionId, positionTitle: careerIntent.positionTitle || careerIntent.positionId, about: `Excited to contribute as a ${careerIntent.positionTitle || careerIntent.positionId}.`, availability: 'flexible' });
          clearApplyIntent();
        } catch (err) {
          console.error('Auto-submit application failed:', err);
          clearApplyIntent();
        }
      }
      const onboardingListingIntent = getListingApplyIntent();
      if (onboardingListingIntent) { clearListingApplyIntent(); navigate(`/listings/${onboardingListingIntent.listingId}`); return; }
      navigate('/dashboard');
    } catch (error: any) {
      setError(error.message || 'Failed to complete onboarding');
    } finally {
      setLoading(false);
    }
  };

  const getLinkedInVerifyUrl = async () => {
    try { const { url } = await api.getLinkedInVerifyUrl(); window.open(url, '_blank'); } catch (error: any) { toast.error(error.message || 'Failed to get LinkedIn URL'); }
  };

  const getGitHubVerifyUrl = async () => {
    try { const { url } = await api.getGitHubVerifyUrl(); window.open(url, '_blank'); } catch (error: any) { toast.error(error.message || 'Failed to get GitHub URL'); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col">
      <SEO title="Complete Your Profile" noindex />
      <div className="bg-white border-b border-slate-200 px-4 py-4 shadow-sm">
        <div className="max-w-2xl mx-auto"><p className="text-sm font-medium text-slate-600">{t('onboarding.title')} • Step {step} of 4</p></div>
      </div>
      <div className="bg-white px-4 py-4 border-b border-slate-200">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between gap-2">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex-1 flex items-center gap-2">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all ${s < step ? 'bg-green-500 text-white' : s === step ? 'bg-orange-500 text-white ring-2 ring-orange-300' : 'bg-slate-200 text-slate-600'}`}>
                  {s < step ? '✓' : s}
                </div>
                {s < 4 && <div className={`flex-1 h-1 transition-all ${s < step ? 'bg-green-500' : 'bg-slate-200'}`} />}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-2 text-xs text-slate-600"><span>Identity</span><span>Skills</span><span>Service</span><span>Verify</span></div>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-2xl">
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 sm:p-8">
            {step === 1 && <Step1 name={name} setName={setName} bio={bio} setBio={setBio} location={location} setLocation={setLocation} locationLat={locationLat} setLocationLat={setLocationLat} locationLng={locationLng} setLocationLng={setLocationLng} neighborhood={neighborhood} setNeighborhood={setNeighborhood} photoPreview={photoPreview} setPhotoPreview={setPhotoPreview} photoInputRef={photoInputRef} onPhotoChange={handlePhotoChange} oauthPhotoUrl={oauthPhotoUrl} onNext={handleStep1Submit} isLoading={loading} error={error} setError={setError} />}
            {step === 2 && <Step2 skills={skills} toggleSkill={toggleSkill} customSkill={customSkill} setCustomSkill={setCustomSkill} addCustomSkill={addCustomSkill} skillSearch={skillSearch} setSkillSearch={setSkillSearch} expandedCategories={expandedCategories} toggleCategory={toggleCategory} degree={degree} setDegree={setDegree} field={field} setField={setField} institution={institution} setInstitution={setInstitution} country={country} setCountry={setCountry} languages={languages} toggleLanguage={toggleLanguage} cvInputRef={cvInputRef} onCVChange={handleCVChange} onNext={handleStep2Submit} isLoading={loading} error={error} setError={setError} />}
            {step === 3 && <Step3 serviceTitle={serviceTitle} setServiceTitle={setServiceTitle} serviceCategory={serviceCategory} setServiceCategory={setServiceCategory} serviceDescription={serviceDescription} setServiceDescription={setServiceDescription} servicePrice={servicePrice} setServicePrice={setServicePrice} serviceCurrency={serviceCurrency} setServiceCurrency={setServiceCurrency} serviceUnit={serviceUnit} setServiceUnit={setServiceUnit} onNext={handleStep3Submit} onSkip={() => setStep(4)} isLoading={loading} error={error} setError={setError} />}
            {step === 4 && <Step4 emailVerified={emailVerified} onLinkedInConnect={getLinkedInVerifyUrl} onGitHubConnect={getGitHubVerifyUrl} onNext={handleStep4Submit} onSkip={handleStep4Submit} isLoading={loading} error={error} />}
          </div>
          {step > 1 && <button onClick={() => setStep(step - 1)} className="w-full mt-4 text-sm text-slate-600 hover:text-slate-900 font-medium">← Back to previous step</button>}
        </div>
      </div>
    </div>
  );
}

function Step1({ name, setName, bio, setBio, location, setLocation, setLocationLat, setLocationLng, setNeighborhood, photoPreview, setPhotoPreview, photoInputRef, onPhotoChange, oauthPhotoUrl, onNext, isLoading, error, setError }: any) {
  return (
    <><h2 className="text-2xl font-bold text-slate-900 mb-2">Let's get to know you</h2><p className="text-slate-600 mb-6">Start building your profile with your basics</p>
    {error && <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
    <div className="mb-6"><label className="block text-sm font-medium text-slate-700 mb-2">Profile Photo</label>
    {photoPreview || oauthPhotoUrl ? (
      <div className="flex items-center gap-4"><img src={photoPreview || oauthPhotoUrl || ''} alt="preview" className="w-20 h-20 rounded-full object-cover border-2 border-orange-200" />
      <div className="flex flex-col gap-2"><button type="button" onClick={() => photoInputRef.current?.click()} className="text-sm font-medium text-orange-600 hover:text-orange-700">Change photo</button>
      {photoPreview && <button type="button" onClick={() => { setPhotoPreview(null); if (photoInputRef.current) photoInputRef.current.value = ''; }} className="text-xs font-medium text-slate-500 hover:text-slate-700">Remove</button>}</div></div>
    ) : (
      <button type="button" onClick={() => photoInputRef.current?.click()} className="w-full px-4 py-8 border-2 border-dashed border-slate-300 rounded-lg text-center hover:border-orange-400 hover:bg-orange-50"><div className="text-3xl mb-2">📷</div><p className="text-sm font-medium text-slate-700">Click to upload photo</p><p className="text-xs text-slate-500">or drag and drop</p></button>
    )}
    <input ref={photoInputRef} type="file" accept="image/*" onChange={onPhotoChange} className="hidden" /></div>
    <div className="mb-4"><label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
    <input id="name" type="text" value={name} onChange={(e) => { setName(e.target.value); setError(''); }} placeholder="John Doe" autoComplete="name" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500" /></div>
    <div className="mb-4"><label htmlFor="bio" className="block text-sm font-medium text-slate-700 mb-1">Short Bio</label>
    <textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value.slice(0, 500))} placeholder="Tell us a bit about yourself..." maxLength={500} rows={3} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500" />
    <p className="text-xs text-slate-500 mt-1">{bio.length}/500 characters</p></div>
    <div className="mb-6"><label htmlFor="location-input" className="block text-sm font-medium text-slate-700 mb-1">Location (Optional)</label>
    <LocationAutocomplete id="location-input" value={location} onChange={(loc: string, lat?: number, lng?: number, nbhd?: string) => {
      setLocation(loc);
      if (lat != null && lng != null) { setLocationLat(lat); setLocationLng(lng); setNeighborhood(nbhd || ''); } else { setLocationLat(undefined); setLocationLng(undefined); setNeighborhood(''); }
    }} placeholder="City or address" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500" /></div>
    <div className="space-y-3"><button onClick={onNext} disabled={isLoading} className="w-full py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors">{isLoading ? 'Saving...' : 'Continue to Skills'}</button>
    <p className="text-xs text-slate-500 text-center">✨ You're 25% complete!</p></div></>
  );
}

function Step2({ skills, toggleSkill, customSkill, setCustomSkill, addCustomSkill, skillSearch, setSkillSearch, expandedCategories, toggleCategory, degree, setDegree, field, setField, institution, setInstitution, country, setCountry, languages, toggleLanguage, cvInputRef, onCVChange, onNext, isLoading, error, setError }: any) {
  return (
    <><h2 className="text-2xl font-bold text-slate-900 mb-2">What can you do?</h2><p className="text-slate-600 mb-6">Select your skills and share your background</p>
    {error && <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
    <div className="mb-6"><label className="block text-sm font-medium text-slate-700 mb-2">Skills</label>
    {skills.length > 0 && <div className="mb-3 flex flex-wrap gap-2">{skills.map((skill: string) => <button key={skill} onClick={() => toggleSkill(skill)} className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-orange-500 text-white hover:bg-orange-600">{skill}<span className="text-orange-200 ml-0.5">&times;</span></button>)}</div>}
    <div className="relative mb-3"><input type="text" value={skillSearch} onChange={(e) => setSkillSearch(e.target.value)} placeholder="Search skills..." className="w-full px-3 py-2 pl-9 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500" />
    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg></div>
    {skillSearch.trim() ? (
      <div className="mb-3">{(() => {
        const query = skillSearch.toLowerCase();
        const matches = SKILL_SUGGESTIONS.filter((s: string) => s.toLowerCase().includes(query) && !skills.includes(s));
        if (matches.length === 0) return <p className="text-xs text-slate-400 mb-2">No matching skills</p>;
        return <div className="flex flex-wrap gap-2">{matches.slice(0, 12).map((skill: string) => <button key={skill} onClick={() => { toggleSkill(skill); setSkillSearch(''); }} className="px-3 py-1.5 rounded-full text-sm font-medium bg-slate-100 text-slate-700 hover:bg-orange-100 hover:text-orange-700">+ {skill}</button>)}</div>;
      })()}</div>
    ) : (
      <><div className="mb-3"><p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Popular</p>
      <div className="flex flex-wrap gap-2">{POPULAR_SKILLS.filter((s: string) => !skills.includes(s)).slice(0, 8).map((skill: string) => <button key={skill} onClick={() => toggleSkill(skill)} className="px-3 py-1.5 rounded-full text-sm font-medium bg-slate-100 text-slate-700 hover:bg-orange-100 hover:text-orange-700">{skill}</button>)}</div></div>
      <div className="space-y-1"><p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Browse</p>
      {Object.entries(SKILL_CATEGORIES).map(([category, categorySkills]) => {
        const isExpanded = expandedCategories.has(category);
        const selectedInCategory = categorySkills.filter((s: string) => skills.includes(s)).length;
        return (
          <div key={category}><button type="button" onClick={() => toggleCategory(category)} className="flex items-center gap-2 w-full text-left py-1.5 group">
          <span className="text-xs text-slate-400 transition-transform" style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>▸</span>
          <span className="text-xs font-semibold text-slate-500 uppercase group-hover:text-slate-700">{category}</span>
          {selectedInCategory > 0 ? <span className="text-xs text-orange-600 font-medium">{selectedInCategory} selected</span> : <span className="text-xs text-slate-400">{categorySkills.length}</span>}</button>
          {isExpanded && <div className="flex flex-wrap gap-2 mt-1 mb-2 pl-4">{categorySkills.map((skill: string) => <button key={skill} onClick={() => toggleSkill(skill)} className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${skills.includes(skill) ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{skill}</button>)}</div>}</div>
        );
      })}</div></>
    )}
    <div className="flex gap-2 mt-3"><input type="text" value={customSkill} onChange={(e) => setCustomSkill(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addCustomSkill()} placeholder="Add custom skill..." className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm" />
    <button onClick={addCustomSkill} disabled={!customSkill.trim()} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 disabled:opacity-50">Add</button></div></div>
    <div className="mb-6"><label className="block text-sm font-medium text-slate-700 mb-2">Languages (Optional)</label>
    <div className="flex flex-wrap gap-2">{TOP_LANGUAGES.map((lang: string) => <button key={lang} onClick={() => toggleLanguage(lang)} className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${languages.includes(lang) ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{lang}</button>)}</div></div>
    <div className="mb-6"><label className="block text-sm font-medium text-slate-700 mb-2">Education (Optional)</label>
    <div className="grid grid-cols-2 gap-2 mb-2"><input type="text" value={degree} onChange={(e) => setDegree(e.target.value)} placeholder="Degree (e.g. Bachelor)" className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
    <input type="text" value={field} onChange={(e) => setField(e.target.value)} placeholder="Field (e.g. Computer Science)" className="px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
    <div className="grid grid-cols-2 gap-2"><input type="text" value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="Institution" className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
    <input type="text" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Country" className="px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div></div>
    <div className="mb-6"><label className="block text-sm font-medium text-slate-700 mb-2">CV (Optional)</label>
    <button type="button" onClick={() => cvInputRef.current?.click()} className="w-full px-4 py-2 border-2 border-dashed border-slate-300 rounded-lg text-sm text-slate-600 hover:border-orange-400 hover:bg-orange-50">📄 Upload CV to auto-fill</button>
    <input ref={cvInputRef} type="file" accept=".pdf,.doc,.docx" onChange={onCVChange} className="hidden" /></div>
    <div className="space-y-3"><button onClick={() => { if (skills.length === 0) { setError('Select at least one skill'); return; } setError(''); onNext(); }} disabled={isLoading} className="w-full py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 disabled:opacity-50">{isLoading ? 'Saving...' : 'Continue to Service'}</button>
    <p className="text-xs text-slate-500 text-center">✨ You're 50% complete!</p></div></>
  );
}

function Step3({ serviceTitle, setServiceTitle, serviceCategory, setServiceCategory, serviceDescription, setServiceDescription, servicePrice, setServicePrice, serviceCurrency, setServiceCurrency, serviceUnit, setServiceUnit, onNext, onSkip, isLoading, error, setError }: any) {
  return (
    <><h2 className="text-2xl font-bold text-slate-900 mb-2">Offer your first service</h2><p className="text-slate-600 mb-6">Let people know what you're selling</p>
    {error && <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
    <div className="mb-4"><label htmlFor="service-title" className="block text-sm font-medium text-slate-700 mb-1">Service Title</label>
    <input id="service-title" type="text" value={serviceTitle} onChange={(e) => setServiceTitle(e.target.value)} placeholder="e.g. Social Media Management" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500" /></div>
    <div className="mb-4"><label htmlFor="service-category" className="block text-sm font-medium text-slate-700 mb-1">Category</label>
    <select id="service-category" value={serviceCategory} onChange={(e) => setServiceCategory(e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500">
    <option value="">Select a category...</option>{POPULAR_SERVICE_CATEGORIES.map((cat: string) => <option key={cat} value={cat}>{cat}</option>)}</select></div>
    <div className="mb-4"><label htmlFor="service-desc" className="block text-sm font-medium text-slate-700 mb-1">Description</label>
    <textarea id="service-desc" value={serviceDescription} onChange={(e) => setServiceDescription(e.target.value)} placeholder="What will you deliver?" rows={3} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500" /></div>
    <div className="mb-6 grid grid-cols-3 gap-2"><div><label htmlFor="price" className="block text-sm font-medium text-slate-700 mb-1">Price</label>
    <input id="price" type="number" value={servicePrice} onChange={(e) => setServicePrice(e.target.value)} placeholder="50" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500" /></div>
    <div><label htmlFor="currency" className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
    <select id="currency" value={serviceCurrency} onChange={(e) => setServiceCurrency(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"><option value="USD">USD</option><option value="EUR">EUR</option><option value="GBP">GBP</option></select></div>
    <div><label htmlFor="unit" className="block text-sm font-medium text-slate-700 mb-1">Unit</label>
    <select id="unit" value={serviceUnit} onChange={(e) => setServiceUnit(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"><option value="per hour">per hour</option><option value="per task">per task</option><option value="fixed">fixed</option><option value="negotiable">negotiable</option></select></div></div>
    <div className="space-y-3"><button onClick={() => { if (!serviceTitle.trim() || !serviceCategory.trim()) { setError('Service title and category are required'); return; } setError(''); onNext(); }} disabled={isLoading} className="w-full py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 disabled:opacity-50">{isLoading ? 'Creating...' : 'Create Service & Continue'}</button>
    <button onClick={onSkip} className="w-full py-3 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200">Skip for now</button>
    <p className="text-xs text-slate-500 text-center">✨ You're 75% complete!</p></div></>
  );
}

function Step4({ emailVerified, onLinkedInConnect, onGitHubConnect, onNext, onSkip, isLoading, error }: any) {
  return (
    <><h2 className="text-2xl font-bold text-slate-900 mb-2">Build trust</h2><p className="text-slate-600 mb-6">Connect your accounts to boost credibility</p>
    {error && <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
    <div className="space-y-3 mb-6">
    <div className="p-4 border border-slate-200 rounded-lg flex items-center justify-between bg-slate-50"><div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-full flex items-center justify-center ${emailVerified ? 'bg-green-100 text-green-600' : 'bg-slate-200 text-slate-600'}`}>{emailVerified ? '✓' : '📧'}</div>
    <div><p className="font-medium text-slate-900">Email Verification</p><p className="text-xs text-slate-600">{emailVerified ? 'Verified' : 'Check your email'}</p></div></div>{emailVerified && <span className="text-xs font-medium text-green-600">Connected</span>}</div>
    <div className="p-4 border border-slate-200 rounded-lg flex items-center justify-between bg-slate-50"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-200 text-slate-600">🔗</div>
    <div><p className="font-medium text-slate-900">LinkedIn</p><p className="text-xs text-slate-600">Verify your profile</p></div></div>
    <button onClick={onLinkedInConnect} className="text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1 rounded">Connect</button></div>
    <div className="p-4 border border-slate-200 rounded-lg flex items-center justify-between bg-slate-50"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-200 text-slate-600">👨‍💻</div>
    <div><p className="font-medium text-slate-900">GitHub</p><p className="text-xs text-slate-600">Showcase your code</p></div></div>
    <button onClick={onGitHubConnect} className="text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-100 px-3 py-1 rounded">Connect</button></div>
    <div className="p-4 border border-slate-200 rounded-lg flex items-center justify-between bg-slate-50"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-200 text-slate-600">💳</div>
    <div><p className="font-medium text-slate-900">Crypto Wallet</p><p className="text-xs text-slate-600">Add in dashboard</p></div></div></div></div>
    <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg"><p className="text-sm font-medium text-slate-900 mb-2">Your profile is <span className="text-orange-600 font-bold">90%</span> complete! 🚀</p>
    <div className="w-full h-2 bg-orange-200 rounded-full overflow-hidden"><div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: '90%' }} /></div></div>
    <div className="space-y-3"><button onClick={onNext} disabled={isLoading} className="w-full py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 disabled:opacity-50">{isLoading ? 'Completing...' : '🎉 Go to Dashboard'}</button>
    <button onClick={onSkip} className="w-full py-3 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200">Skip verification</button></div></>
  );
}

export { SKILL_SUGGESTIONS };
