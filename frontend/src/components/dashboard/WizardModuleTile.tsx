import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface WizardModuleTileProps {
  title: string;
  stepId: string;
  icon: string;
  color: 'blue' | 'green' | 'orange' | 'purple' | 'amber' | 'rose' | 'teal' | 'indigo' | 'slate';
  children: React.ReactNode;
  isEmpty?: boolean;
  emptyHint?: string;
}

const colorMap = {
  blue:   { bg: 'bg-blue-50',   border: 'border-blue-200',   icon: 'bg-blue-100 text-blue-600',   accent: 'text-blue-600' },
  green:  { bg: 'bg-green-50',  border: 'border-green-200',  icon: 'bg-green-100 text-green-600',  accent: 'text-green-600' },
  orange: { bg: 'bg-orange-50', border: 'border-orange-200', icon: 'bg-orange-100 text-orange-600', accent: 'text-orange-600' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-200', icon: 'bg-purple-100 text-purple-600', accent: 'text-purple-600' },
  amber:  { bg: 'bg-amber-50',  border: 'border-amber-200',  icon: 'bg-amber-100 text-amber-600',  accent: 'text-amber-600' },
  rose:   { bg: 'bg-rose-50',   border: 'border-rose-200',   icon: 'bg-rose-100 text-rose-600',   accent: 'text-rose-600' },
  teal:   { bg: 'bg-teal-50',   border: 'border-teal-200',   icon: 'bg-teal-100 text-teal-600',   accent: 'text-teal-600' },
  indigo: { bg: 'bg-indigo-50', border: 'border-indigo-200', icon: 'bg-indigo-100 text-indigo-600', accent: 'text-indigo-600' },
  slate:  { bg: 'bg-slate-50',  border: 'border-slate-200',  icon: 'bg-slate-100 text-slate-600',  accent: 'text-slate-600' },
};

export default function WizardModuleTile({
  title,
  stepId,
  icon,
  color,
  children,
  isEmpty = false,
  emptyHint = 'Add this to boost discovery',
}: WizardModuleTileProps) {
  const { t } = useTranslation();
  const c = colorMap[color];

  return (
    <div className={`rounded-xl border p-3 sm:p-4 ${isEmpty ? 'bg-white border-slate-200' : `${c.bg} ${c.border}`}`}>
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm ${isEmpty ? 'bg-slate-100' : c.icon}`}>
          {icon}
        </div>
        <h3 className={`text-sm font-semibold flex-1 min-w-0 truncate ${isEmpty ? 'text-slate-400' : 'text-slate-800'}`}>
          {title}
        </h3>
        <Link
          to={`/onboarding?step=${stepId}`}
          className={`text-xs font-medium ${isEmpty ? 'text-orange-500 hover:text-orange-600' : `${c.accent} hover:opacity-80`}`}
        >
          {isEmpty ? t('dashboard.wizardTile.addButton') : t('dashboard.wizardTile.editButton')}
        </Link>
      </div>

      <div>
        {isEmpty ? (
          <div className="flex items-center gap-3 p-3 border-2 border-dashed border-slate-200 rounded-lg bg-slate-50/50">
            <span className="text-xl text-slate-300">+</span>
            <div>
              <p className="text-sm text-slate-500">{emptyHint}</p>
            </div>
          </div>
        ) : (
          <div className="text-sm text-slate-700">{children}</div>
        )}
      </div>
    </div>
  );
}
