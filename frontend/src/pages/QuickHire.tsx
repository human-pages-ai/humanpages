import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';
import { analytics } from '../lib/analytics';
import SEO from '../components/SEO';
import Logo from '../components/Logo';
import LanguageSwitcher from '../components/LanguageSwitcher';
import Footer from '../components/Footer';

interface HumanCard {
  id: string;
  displayName?: string;
  username?: string;
  skills: string[];
  profilePhotoUrl?: string;
  isAvailable: boolean;
  reputation?: {
    avgRating: number;
    reviewCount: number;
    jobsCompleted: number;
  };
  services: Array<{
    priceMin?: number;
    priceUnit?: string;
  }>;
}

const SKILL_TEMPLATES: Record<string, string> = {
  'Translation': 'I need a document translated',
  'Data Labeling': 'I need data labeled for ML training',
  'Content Writing': 'I need content written for my website',
  'Design': 'I need a design created',
  'QA Testing': 'I need software tested for bugs',
  'Customer Support': 'I need customer support handled',
  'Social Media': 'I need help managing social media',
  'Research': 'I need research completed',
};

export default function QuickHire() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Step state
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState('');
  const [timeline, setTimeline] = useState('');
  const [selectedSkill, setSelectedSkill] = useState('');
  const [humans, setHumans] = useState<HumanCard[]>([]);
  const [loadingHumans, setLoadingHumans] = useState(false);

  // Redirect if not logged in
  if (!user) {
    navigate('/login');
    return null;
  }

  const handleSkillChip = (skill: string) => {
    analytics.track('quickhire_skill_selected', { skill });
    setDescription(SKILL_TEMPLATES[skill]);
    setSelectedSkill(skill);
  };

  const handleNextFromStep1 = () => {
    if (!description.trim()) {
      toast.error('Please describe what you need done');
      return;
    }
    analytics.track('quickhire_step1_completed', { description: description.substring(0, 50) });
    setStep(2);
  };

  const handleNextFromStep2 = () => {
    if (!budget || !timeline) {
      toast.error('Please select budget and timeline');
      return;
    }
    analytics.track('quickhire_step2_completed', { budget, timeline });
    searchHumans();
  };

  const searchHumans = async () => {
    setLoadingHumans(true);
    try {
      // Use the skill or first word of description as search query
      const query = selectedSkill || description.split(' ')[0];
      const result = await api.getListings({
        skill: query,
        limit: 6,
      });

      // Transform listing response to human cards
      if (result.listings && Array.isArray(result.listings)) {
        // For now, use mock data since listings are jobs, not humans
        // In production, would need a /api/humans/search endpoint
        setHumans([]);
        toast.success('No freelancers found with that skill. Try browsing all freelancers.');
        setStep(3);
      }
    } catch (error: any) {
      // Fallback: show empty state
      setHumans([]);
      toast.error('Unable to search freelancers');
      setStep(3);
    } finally {
      setLoadingHumans(false);
    }
  };

  const handleHire = async (humanId: string) => {
    analytics.track('quickhire_hire_clicked', { humanId, budget, timeline });
    toast.success('Hire request sent!');
    navigate('/dashboard?tab=jobs');
  };

  const formatBudgetLabel = (val: string): string => {
    const map: Record<string, string> = {
      '25': '$25',
      '50': '$50',
      '100': '$100',
      '250': '$250',
      '500': '$500',
      '1000+': '$1000+',
    };
    return map[val] || val;
  };

  const formatTimelineLabel = (val: string): string => {
    const map: Record<string, string> = {
      'today': 'Today',
      'week': 'This week',
      'month': 'This month',
      'flexible': 'No rush',
    };
    return map[val] || val;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <SEO
        title="Quick Hire - Find Freelancers Fast"
        description="Find and hire freelancers in 3 simple steps"
        path="/quick-hire"
      />

      {/* Nav bar */}
      <nav className="bg-white shadow">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="whitespace-nowrap">
            <button onClick={() => navigate('/')} className="hover:opacity-75">
              <Logo />
            </button>
          </h1>
          <div className="flex items-center gap-4 whitespace-nowrap">
            <LanguageSwitcher />
            <button
              onClick={() => navigate('/dashboard')}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              {t('nav.dashboard')}
            </button>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-12">
        {/* Step indicator */}
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-2">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
              step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
            }`}>
              1
            </div>
            <span className={step >= 1 ? 'text-gray-900 font-medium' : 'text-gray-500'}>
              What you need
            </span>
          </div>
          <div className={`flex-1 h-1 mx-4 ${step >= 2 ? 'bg-blue-600' : 'bg-gray-200'}`} />
          <div className="flex items-center gap-2">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
              step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
            }`}>
              2
            </div>
            <span className={step >= 2 ? 'text-gray-900 font-medium' : 'text-gray-500'}>
              Budget & timeline
            </span>
          </div>
          <div className={`flex-1 h-1 mx-4 ${step >= 3 ? 'bg-blue-600' : 'bg-gray-200'}`} />
          <div className="flex items-center gap-2">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
              step >= 3 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
            }`}>
              3
            </div>
            <span className={step >= 3 ? 'text-gray-900 font-medium' : 'text-gray-500'}>
              Choose someone
            </span>
          </div>
        </div>

        {/* Step 1: What do you need? */}
        {step === 1 && (
          <div className="bg-white rounded-lg shadow p-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">What do you need?</h2>
            <p className="text-gray-600 mb-6">Describe the work you want done</p>

            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="E.g., I need a 1000-word blog post about digital marketing trends"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 mb-6 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={5}
            />

            <p className="text-sm text-gray-600 mb-4">Quick suggestions:</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-8">
              {Object.keys(SKILL_TEMPLATES).map((skill) => (
                <button
                  key={skill}
                  onClick={() => handleSkillChip(skill)}
                  className={`px-3 py-2 rounded-full text-sm font-medium transition-all ${
                    selectedSkill === skill
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {skill}
                </button>
              ))}
            </div>

            <button
              onClick={handleNextFromStep1}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors"
            >
              Continue
            </button>
          </div>
        )}

        {/* Step 2: Budget & Timeline */}
        {step === 2 && (
          <div className="bg-white rounded-lg shadow p-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">Budget & Timeline</h2>

            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">How much can you spend?</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {['25', '50', '100', '250', '500', '1000+'].map((val) => (
                  <button
                    key={val}
                    onClick={() => setBudget(val)}
                    className={`py-3 px-4 rounded-lg font-semibold transition-all ${
                      budget === val
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                    }`}
                  >
                    {formatBudgetLabel(val)}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">When do you need it?</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {['today', 'week', 'month', 'flexible'].map((val) => (
                  <button
                    key={val}
                    onClick={() => setTimeline(val)}
                    className={`py-3 px-4 rounded-lg font-semibold transition-all ${
                      timeline === val
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                    }`}
                  >
                    {formatTimelineLabel(val)}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setStep(1)}
                className="flex-1 bg-gray-200 text-gray-900 py-3 rounded-lg font-bold hover:bg-gray-300 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleNextFromStep2}
                disabled={loadingHumans}
                className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loadingHumans ? 'Searching...' : 'Find Freelancers'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Choose someone */}
        {step === 3 && (
          <div className="bg-white rounded-lg shadow p-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Choose someone</h2>
            <p className="text-gray-600 mb-8">
              Budget: {formatBudgetLabel(budget)} • Timeline: {formatTimelineLabel(timeline)}
            </p>

            {humans.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600 mb-6">
                  No freelancers found. Browse all available freelancers or create a job post instead.
                </p>
                <div className="flex gap-4">
                  <button
                    onClick={() => navigate('/listings')}
                    className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors"
                  >
                    Browse All Freelancers
                  </button>
                  <button
                    onClick={() => setStep(2)}
                    className="flex-1 bg-gray-200 text-gray-900 py-3 rounded-lg font-bold hover:bg-gray-300 transition-colors"
                  >
                    Back
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {humans.map((human) => (
                    <div
                      key={human.id}
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-shadow"
                    >
                      <div className="flex gap-4 mb-4">
                        {human.profilePhotoUrl && (
                          <img
                            src={human.profilePhotoUrl}
                            alt={human.displayName}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        )}
                        <div>
                          <h3 className="font-bold text-gray-900">{human.displayName || 'Unnamed'}</h3>
                          {human.reputation && (
                            <div className="flex items-center gap-1 text-sm text-gray-600">
                              <span>★ {human.reputation.avgRating.toFixed(1)}</span>
                              <span>({human.reputation.reviewCount})</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="mb-4">
                        <p className="text-sm text-gray-600 mb-2">
                          {human.skills.slice(0, 3).join(', ')}
                        </p>
                        <div className="flex items-center gap-2 mb-3">
                          {human.isAvailable && (
                            <span className="inline-block px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
                              Available
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleHire(human.id)}
                        className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 transition-colors"
                      >
                        Hire
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setStep(2)}
                  className="w-full bg-gray-200 text-gray-900 py-3 rounded-lg font-bold hover:bg-gray-300 transition-colors"
                >
                  Back
                </button>
              </>
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
