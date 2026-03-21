import { useTranslation } from 'react-i18next';
import { analytics } from '../../lib/analytics';

export type DashboardTab = 'jobs' | 'listings' | 'profile' | 'payments' | 'settings' | 'privacy';

interface Props {
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  pendingJobCount: number;
}

const TABS: { key: DashboardTab; labelKey: string; icon: JSX.Element }[] = [
  {
    key: 'profile',
    labelKey: 'dashboard.profile.title',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
  {
    key: 'jobs',
    labelKey: 'dashboard.jobs.title',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    key: 'listings',
    labelKey: 'listings.title',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    key: 'payments',
    labelKey: 'dashboard.wallets.paymentSetupTitle',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
  },
  {
    key: 'settings',
    labelKey: 'dashboard.boostYourProfile',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    key: 'privacy',
    labelKey: 'dashboard.privacy',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
  },
];

export default function DashboardTabs({ activeTab, onTabChange, pendingJobCount }: Props) {
  const { t } = useTranslation();

  return (
    <div className="border-b border-gray-200">
      <nav className="-mb-px flex gap-1 overflow-x-auto" aria-label="Dashboard tabs">
        {TABS.map(({ key, labelKey, icon }) => {
          const isActive = activeTab === key;
          const label = t(labelKey);

          return (
            <button
              key={key}
              onClick={() => { analytics.track('dashboard_tab_changed', { tab: key }); onTabChange(key); }}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                isActive
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              aria-selected={isActive}
              role="tab"
            >
              {icon}
              <span className="hidden sm:inline">{label}</span>
              {key === 'jobs' && pendingJobCount > 0 && (
                <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 min-w-[1.25rem]">
                  {pendingJobCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
