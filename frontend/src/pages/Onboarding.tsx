import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { analytics } from '../lib/analytics';

const SKILL_SUGGESTIONS = [
  'photography', 'videography', 'delivery', 'driving', 'research',
  'data-entry', 'translation', 'transcription', 'mystery-shopping',
  'event-staffing', 'moving-help', 'pet-care', 'errands', 'notary',
];

const EQUIPMENT_SUGGESTIONS = [
  'car', 'bike', 'drone', 'camera', 'smartphone', 'laptop',
  'tools', 'van', 'motorcycle',
];

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form state
  const [contactMethod, setContactMethod] = useState<'email' | 'telegram'>('email');
  const [contactValue, setContactValue] = useState('');
  const [location, setLocation] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [customSkill, setCustomSkill] = useState('');
  const [equipment, setEquipment] = useState<string[]>([]);
  const [minRate, setMinRate] = useState('');
  const [rateType, setRateType] = useState<'HOURLY' | 'FLAT_TASK' | 'NEGOTIABLE'>('NEGOTIABLE');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const data = await api.getProfile();
      analytics.identify(data.id);

      // Pre-fill if already set
      if (data.contactEmail) {
        setContactMethod('email');
        setContactValue(data.contactEmail);
      } else if (data.telegram) {
        setContactMethod('telegram');
        setContactValue(data.telegram);
      }
      if (data.location) setLocation(data.location);
      if (data.skills?.length) setSkills(data.skills);
      if (data.equipment?.length) setEquipment(data.equipment);
      if (data.minRateUsdc) setMinRate(data.minRateUsdc.toString());
      if (data.rateType) setRateType(data.rateType);
    } catch (error) {
      console.error('Failed to load profile:', error);
      navigate('/login');
    }
  };

  const handleStep1 = async () => {
    if (!contactValue.trim()) return;

    setLoading(true);
    try {
      const updates = contactMethod === 'email'
        ? { contactEmail: contactValue }
        : { telegram: contactValue };

      await api.updateProfile(updates);
      analytics.track('onboarding_step_1', { contactMethod });
      setStep(2);
    } catch (error) {
      console.error('Failed to save contact:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStep2 = async () => {
    if (!location.trim() || skills.length === 0) return;

    setLoading(true);
    try {
      await api.updateProfile({ location, skills });
      analytics.track('onboarding_step_2', { skillCount: skills.length });
      setStep(3);
    } catch (error) {
      console.error('Failed to save skills/location:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStep3 = async () => {
    setLoading(true);
    try {
      const updates: any = { equipment };
      if (minRate) updates.minRateUsdc = parseFloat(minRate);
      updates.rateType = rateType;

      await api.updateProfile(updates);
      analytics.track('onboarding_step_3');
      completeOnboarding();
    } catch (error) {
      console.error('Failed to save rate:', error);
    } finally {
      setLoading(false);
    }
  };

  const completeOnboarding = () => {
    analytics.track('onboarding_complete');
    navigate('/welcome');
  };

  const skipToEnd = () => {
    analytics.track('onboarding_skip', { fromStep: step });
    navigate('/dashboard');
  };

  const toggleSkill = (skill: string) => {
    setSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  const addCustomSkill = () => {
    if (customSkill.trim() && !skills.includes(customSkill.trim())) {
      setSkills([...skills, customSkill.trim()]);
      setCustomSkill('');
    }
  };

  const toggleEquipment = (item: string) => {
    setEquipment((prev) =>
      prev.includes(item) ? prev.filter((e) => e !== item) : [...prev, item]
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Progress bar */}
      <div className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700">Complete your profile</span>
            <span className="text-sm text-slate-500">Step {step} of 3</span>
          </div>
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-lg">
          {/* Step 1: Contact Method */}
          {step === 1 && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                How should clients reach you?
              </h2>
              <p className="text-slate-600 mb-6">
                This is how AI agents and businesses will contact you about jobs.
              </p>

              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setContactMethod('email')}
                  className={`flex-1 py-2 px-4 rounded-lg border-2 font-medium transition-colors ${
                    contactMethod === 'email'
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  Email
                </button>
                <button
                  onClick={() => setContactMethod('telegram')}
                  className={`flex-1 py-2 px-4 rounded-lg border-2 font-medium transition-colors ${
                    contactMethod === 'telegram'
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  Telegram
                </button>
              </div>

              <input
                type={contactMethod === 'email' ? 'email' : 'text'}
                value={contactValue}
                onChange={(e) => setContactValue(e.target.value)}
                placeholder={contactMethod === 'email' ? 'you@example.com' : '@username'}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />

              <button
                onClick={handleStep1}
                disabled={loading || !contactValue.trim()}
                className="w-full mt-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Saving...' : 'Continue'}
              </button>
            </div>
          )}

          {/* Step 2: Skills & Location */}
          {step === 2 && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                What can you do?
              </h2>
              <p className="text-slate-600 mb-6">
                Select your skills so agents can find you for the right jobs.
              </p>

              {/* Location */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Your location
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g., San Francisco, CA"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Skills */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Your skills (select all that apply)
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {SKILL_SUGGESTIONS.map((skill) => (
                    <button
                      key={skill}
                      onClick={() => toggleSkill(skill)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        skills.includes(skill)
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {skill}
                    </button>
                  ))}
                </div>

                {/* Custom skill input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customSkill}
                    onChange={(e) => setCustomSkill(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addCustomSkill()}
                    placeholder="Add custom skill..."
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                  <button
                    onClick={addCustomSkill}
                    disabled={!customSkill.trim()}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>

                {/* Selected skills */}
                {skills.length > 0 && (
                  <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                    <span className="text-sm text-blue-700 font-medium">
                      Selected: {skills.join(', ')}
                    </span>
                  </div>
                )}
              </div>

              <button
                onClick={handleStep2}
                disabled={loading || !location.trim() || skills.length === 0}
                className="w-full mt-4 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Saving...' : 'Continue'}
              </button>
            </div>
          )}

          {/* Step 3: Rate & Equipment (Optional) */}
          {step === 3 && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                Set your rate
              </h2>
              <p className="text-slate-600 mb-6">
                Help agents filter by budget. This is optional.
              </p>

              {/* Rate */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Minimum rate (USDC)
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                    <input
                      type="number"
                      value={minRate}
                      onChange={(e) => setMinRate(e.target.value)}
                      placeholder="0"
                      min="0"
                      className="w-full pl-8 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <select
                    value={rateType}
                    onChange={(e) => setRateType(e.target.value as any)}
                    className="px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="HOURLY">per hour</option>
                    <option value="FLAT_TASK">per task</option>
                    <option value="NEGOTIABLE">negotiable</option>
                  </select>
                </div>
              </div>

              {/* Equipment */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Equipment you have (optional)
                </label>
                <div className="flex flex-wrap gap-2">
                  {EQUIPMENT_SUGGESTIONS.map((item) => (
                    <button
                      key={item}
                      onClick={() => toggleEquipment(item)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        equipment.includes(item)
                          ? 'bg-green-600 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleStep3}
                disabled={loading}
                className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Complete Profile'}
              </button>

              <button
                onClick={completeOnboarding}
                className="w-full mt-3 py-3 text-slate-600 font-medium hover:text-slate-800"
              >
                Skip for now
              </button>
            </div>
          )}

          {/* Skip link */}
          {step < 3 && (
            <button
              onClick={skipToEnd}
              className="w-full mt-4 text-sm text-slate-500 hover:text-slate-700"
            >
              Skip setup and go to dashboard
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
