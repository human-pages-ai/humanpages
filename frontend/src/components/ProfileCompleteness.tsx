import { useTranslation } from 'react-i18next';

interface Wallet {
  id?: string;
  network: string;
  address: string;
  label?: string;
}

interface Service {
  id?: string;
  title: string;
  description: string;
  category: string;
  priceMin?: string | number | null;
  priceUnit?: 'HOURLY' | 'FLAT_TASK' | 'NEGOTIABLE' | null;
  isActive: boolean;
}

interface Profile {
  id: string;
  name: string;
  email: string;
  bio?: string;
  location?: string;
  skills: string[];
  contactEmail?: string;
  telegram?: string;
  isAvailable: boolean;
  wallets: Wallet[];
  services: Service[];
}

interface ProfileCompletenessProps {
  profile: Profile;
  onEditProfile?: (field?: string) => void;
  onAddService?: () => void;
}

interface CompletionItem {
  labelKey: string;
  complete: boolean;
  weight: number;
  actionType: 'editProfile' | 'addService';
  fieldId?: string; // DOM id to scroll to
}

export default function ProfileCompleteness({ profile, onEditProfile, onAddService }: ProfileCompletenessProps) {
  const { t } = useTranslation();

  const items: CompletionItem[] = [
    {
      labelKey: 'name',
      complete: Boolean(profile.name && profile.name.trim().length > 0),
      weight: 15,
      actionType: 'editProfile',
      fieldId: 'profile-name',
    },
    {
      labelKey: 'bio',
      complete: Boolean(profile.bio && profile.bio.trim().length > 0),
      weight: 20,
      actionType: 'editProfile',
      fieldId: 'profile-bio',
    },
    {
      labelKey: 'location',
      complete: Boolean(profile.location && profile.location.trim().length > 0),
      weight: 15,
      actionType: 'editProfile',
      fieldId: 'profile-location',
    },
    {
      labelKey: 'contactEmail',
      complete: Boolean(profile.contactEmail && profile.contactEmail.trim().length > 0),
      weight: 15,
      actionType: 'editProfile',
      fieldId: 'profile-contact-email',
    },
    {
      labelKey: 'skills',
      complete: profile.skills && profile.skills.length > 0,
      weight: 20,
      actionType: 'editProfile',
      fieldId: 'profile-skills',
    },
    {
      labelKey: 'services',
      complete: profile.services?.some(s => s.isActive) ?? false,
      weight: 15,
      actionType: 'addService',
    },
  ];

  const getLabel = (key: string): string => {
    const labels: Record<string, string> = {
      name: t('common.name'),
      bio: t('dashboard.profile.bio'),
      location: t('dashboard.profile.location'),
      contactEmail: t('dashboard.profile.contactEmail'),
      skills: t('dashboard.profile.skills'),
      services: t('dashboard.services.title'),
    };
    return labels[key] || key;
  };

  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  const completedWeight = items.reduce((sum, item) => sum + (item.complete ? item.weight : 0), 0);
  const percentage = Math.round((completedWeight / totalWeight) * 100);

  const missingItems = items.filter(item => !item.complete);

  const handleItemClick = (item: CompletionItem) => {
    if (item.actionType === 'addService') {
      onAddService?.();
    } else if (item.actionType === 'editProfile') {
      onEditProfile?.(item.fieldId);
    }
  };

  if (percentage === 100) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">{t('onboarding.title')}</h2>
        <span className="text-2xl font-bold text-indigo-600">{percentage}%</span>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
        <div
          className="bg-indigo-600 h-3 rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {missingItems.length > 0 && (
        <div className="space-y-2">
          <ul className="space-y-1">
            {missingItems.map((item, index) => (
              <li key={index} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-gray-600">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  {getLabel(item.labelKey)}
                </span>
                <button
                  onClick={() => handleItemClick(item)}
                  className="text-indigo-600 hover:text-indigo-500 text-xs"
                >
                  {t('common.add')}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
