import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Profile } from './types';
import WizardModuleTile from './WizardModuleTile';
import { ChipList } from './ChipList';
import { formatTimezone } from '../../lib/formatTimezone';
import { VouchCard } from '../shared/VouchCard';

interface ProfileTilesGridProps {
  profile: Profile;
  telegramStatus?: {
    connected: boolean;
    botAvailable: boolean;
    botUsername?: string;
  } | null;
}

export function ProfileTilesGrid({ profile, telegramStatus }: ProfileTilesGridProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      {/* Wizard Module Tiles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* 1. Notifications & Connect */}
        <WizardModuleTile
          title={t('dashboard.tiles.notifications.title')}
          stepId="connect"
          icon="🔔"
          color="blue"
          isEmpty={!profile.pushNotifications && !telegramStatus?.connected && !profile.whatsapp}
          emptyHint={t('dashboard.tiles.notifications.emptyHint')}
        >
          <div className="space-y-2">
            <div>
              <span className="text-gray-500 text-xs">{t('dashboard.tiles.notifications.push')}:</span>{' '}
              <span className={`text-sm font-medium ${profile.pushNotifications ? 'text-green-600' : 'text-gray-400'}`}>
                {profile.pushNotifications ? t('common.enabled') : t('common.disabled')}
              </span>
            </div>
            <div>
              <span className="text-gray-500 text-xs">{t('dashboard.tiles.notifications.telegram')}:</span>{' '}
              {telegramStatus?.connected ? (
                <span className="text-sm text-green-600 font-medium">✓ Connected</span>
              ) : (
                <Link to="/dashboard?tab=settings" className="text-orange-500 text-xs font-medium hover:text-orange-600">+ Connect</Link>
              )}
            </div>
            <div>
              <span className="text-gray-500 text-xs">{t('dashboard.tiles.notifications.whatsapp')}:</span>{' '}
              {profile.whatsapp ? (
                <span className="text-sm text-green-600 font-medium">✓ Connected</span>
              ) : (
                <Link to="/dashboard?tab=settings" className="text-orange-500 text-xs font-medium hover:text-orange-600">+ Connect</Link>
              )}
            </div>
          </div>
        </WizardModuleTile>

        {/* 2. Skills */}
        <WizardModuleTile
          title={t('dashboard.tiles.skills.title')}
          stepId="skills"
          icon="⚡"
          color="purple"
          isEmpty={!profile.skills || profile.skills.length === 0}
          emptyHint={t('dashboard.tiles.skills.emptyHint')}
        >
          {profile.skills && profile.skills.length > 0 ? (
            <ChipList items={profile.skills} color="blue" />
          ) : null}
        </WizardModuleTile>

        {/* 3. Equipment */}
        <WizardModuleTile
          title={t('dashboard.tiles.equipment.title')}
          stepId="equipment"
          icon="🔧"
          color="amber"
          isEmpty={!profile.equipment || profile.equipment.length === 0}
          emptyHint={t('dashboard.tiles.equipment.emptyHint')}
        >
          {profile.equipment && profile.equipment.length > 0 ? (
            <ChipList items={profile.equipment} color="amber" showCategory={true} />
          ) : null}
        </WizardModuleTile>

        {/* 4. Location */}
        <WizardModuleTile
          title={t('dashboard.tiles.location.title')}
          stepId="location"
          icon="📍"
          color="green"
          isEmpty={!profile.location && !profile.timezone}
          emptyHint={t('dashboard.tiles.location.emptyHint')}
        >
          <div className="space-y-2">
            <div>
              <span className="text-gray-500 text-xs">{t('dashboard.tiles.location.title')}:</span>{' '}
              <span className={`text-sm font-medium ${profile.location ? 'text-gray-900' : 'text-gray-400'}`}>
                {profile.location ? (
                  profile.locationGranularity === 'neighborhood' && profile.neighborhood
                    ? `${profile.neighborhood}, ${profile.location}`
                    : profile.location
                ) : '—'}
              </span>
            </div>
            <div>
              <span className="text-gray-500 text-xs">Timezone:</span>{' '}
              <span className={`text-sm font-medium ${profile.timezone ? 'text-gray-900' : 'text-gray-400'}`}>
                {profile.timezone ? `${formatTimezone(profile.timezone)}${profile.locationLat === undefined ? ` ${t('dashboard.tiles.location.autoDetected')}` : ''}` : '—'}
              </span>
              {profile.timezone && profile.locationLat === undefined && (
                <span className="text-xs text-orange-600 ml-1">{t('dashboard.tiles.location.verifyAccuracy')}</span>
              )}
            </div>
          </div>
        </WizardModuleTile>

        {/* 5. Education & Experience */}
        <WizardModuleTile
          title={t('dashboard.tiles.education.title')}
          stepId="education"
          icon="🎓"
          color="indigo"
          isEmpty={(!profile.education || profile.education.length === 0) && !profile.yearsOfExperience}
          emptyHint={t('dashboard.tiles.education.emptyHint')}
        >
          <div className="space-y-2">
            <div>
              <span className="text-gray-500 text-xs">{t('dashboard.tiles.education.yearsLabel')}:</span>
              {profile.yearsOfExperience != null && profile.yearsOfExperience > 0 ? (
                <span className="text-sm font-medium text-gray-900 block">{profile.yearsOfExperience} {profile.yearsOfExperience === 1 ? t('common.year') : t('common.years')}</span>
              ) : (
                <span className="text-sm text-orange-600 block">{t('dashboard.tiles.education.addExperience')}</span>
              )}
            </div>
            <div>
              <span className="text-gray-500 text-xs">{t('dashboard.tiles.education.educationLabel')}:</span>
              {profile.education && profile.education.length > 0 ? (
                <div className="space-y-1 mt-1">
                  {profile.education.map((edu) => (
                    <div key={edu.id} className="text-xs min-w-0">
                      <span className="font-medium text-gray-900 truncate block">{edu.institution}</span>
                      {edu.degree && <span className="text-gray-600 truncate block">{edu.degree}</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-sm text-orange-600 block">{t('dashboard.tiles.education.addEducation')}</span>
              )}
            </div>
          </div>
        </WizardModuleTile>

        {/* 6. Services */}
        <WizardModuleTile
          title={t('dashboard.tiles.services.title')}
          stepId="services"
          icon="💼"
          color="teal"
          isEmpty={!profile.services || profile.services.length === 0}
          emptyHint={t('dashboard.tiles.services.emptyHint')}
        >
          {profile.services && profile.services.length > 0 ? (
            <div className="space-y-2">
              {profile.services.map((service) => (
                <div key={service.id} className="text-xs min-w-0">
                  <span className="font-medium text-gray-900 truncate block">{service.title}</span>
                  {service.priceMin && (
                    <span className="text-gray-600 ml-2">
                      {service.priceCurrency || 'USD'} {service.priceMin} {service.priceUnit || 'flat'}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : null}
        </WizardModuleTile>

        {/* 7. Availability */}
        <WizardModuleTile
          title={t('dashboard.tiles.availability.title')}
          stepId="availability"
          icon="📅"
          color="orange"
          isEmpty={!profile.workType && profile.weeklyCapacityHours == null}
          emptyHint={t('dashboard.tiles.availability.emptyHint')}
        >
          <div className="space-y-2">
            <div>
              <span className="text-gray-500 text-xs">{t('dashboard.tiles.availability.workTypeLabel')}:</span>{' '}
              <span className={`text-sm font-medium ${profile.workType ? 'text-gray-900' : 'text-gray-400'}`}>
                {profile.workType ? t(`profile.workType.${profile.workType}`, profile.workType) : '—'}
              </span>
            </div>
            <div>
              <span className="text-gray-500 text-xs">{t('dashboard.tiles.availability.weeklyHoursLabel')}:</span>{' '}
              <span className={`text-sm font-medium ${profile.weeklyCapacityHours !== null ? 'text-gray-900' : 'text-gray-400'}`}>
                {profile.weeklyCapacityHours !== null ? (profile.weeklyCapacityHours === 0 ? t('profile.weeklyHours.flexible') : t('profile.weeklyHours.format', { hours: profile.weeklyCapacityHours })) : '—'}
              </span>
            </div>
          </div>
        </WizardModuleTile>

        {/* 8. Verification & Social */}
        <WizardModuleTile
          title={t('dashboard.tiles.verification.title')}
          stepId="verification"
          icon="✅"
          color="green"
          isEmpty={!profile.linkedinVerified && !profile.githubVerified && !profile.humanityVerified}
          emptyHint={t('dashboard.tiles.verification.emptyHint')}
        >
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-xs">LinkedIn:</span>
              {profile.linkedinVerified ? (
                <span className="text-sm text-green-600 font-medium">✓ {t('common.verified')}</span>
              ) : profile.linkedinUrl ? (
                <span className="text-sm text-orange-500 font-medium">{t('dashboard.tiles.verification.pending')}</span>
              ) : (
                <span className="text-sm text-gray-400">—</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-xs">GitHub:</span>
              {profile.githubVerified ? (
                <span className="text-sm text-green-600 font-medium">✓ {t('common.verified')}</span>
              ) : profile.githubUrl ? (
                <span className="text-sm text-orange-500 font-medium">{t('dashboard.tiles.verification.pending')}</span>
              ) : (
                <span className="text-sm text-gray-400">—</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-xs">{t('dashboard.tiles.verification.humanity')}:</span>
              {profile.humanityVerified ? (
                <span className="text-sm text-green-600 font-medium">✓ {t('common.verified')}</span>
              ) : (
                <span className="text-sm text-gray-400">—</span>
              )}
            </div>
          </div>
        </WizardModuleTile>

      </div>

      {/* Share Profile Link — using VouchCard for consistency */}
      <div className="bg-white rounded-lg shadow border border-slate-200 p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">{t('dashboard.share.title')}</h2>
        <VouchCard
          username={profile.username}
          userId={profile.id}
          vouchCount={0}
          vouchTarget={10}
        />
      </div>
    </div>
  );
}
