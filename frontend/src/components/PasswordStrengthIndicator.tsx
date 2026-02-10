import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

interface PasswordStrengthIndicatorProps {
  password: string;
}

interface StrengthCheck {
  key: string;
  label: string;
  met: boolean;
}

function getStrength(password: string): { level: number; checks: StrengthCheck[] } {
  const checks: StrengthCheck[] = [
    { key: 'minLength', label: 'passwordStrength.minLength', met: password.length >= 8 },
    { key: 'uppercase', label: 'passwordStrength.uppercase', met: /[A-Z]/.test(password) },
    { key: 'lowercase', label: 'passwordStrength.lowercase', met: /[a-z]/.test(password) },
    { key: 'number', label: 'passwordStrength.number', met: /[0-9]/.test(password) },
    { key: 'special', label: 'passwordStrength.special', met: /[^A-Za-z0-9]/.test(password) },
  ];

  const metCount = checks.filter(c => c.met).length;

  return { level: metCount, checks };
}

const strengthColors = ['bg-red-500', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-lime-500', 'bg-green-500'];
const strengthLabels = [
  'passwordStrength.veryWeak',
  'passwordStrength.veryWeak',
  'passwordStrength.weak',
  'passwordStrength.fair',
  'passwordStrength.strong',
  'passwordStrength.veryStrong',
];

export default function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  const { t } = useTranslation();
  const { level, checks } = useMemo(() => getStrength(password), [password]);

  if (!password) return null;

  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i < level ? strengthColors[level] : 'bg-gray-200'
            }`}
          />
        ))}
      </div>
      <p className={`text-xs font-medium ${level <= 2 ? 'text-red-600' : level <= 3 ? 'text-yellow-600' : 'text-green-600'}`}>
        {t(strengthLabels[level])}
      </p>
      <ul className="space-y-0.5">
        {checks.map((check) => (
          <li key={check.key} className={`text-xs flex items-center gap-1.5 ${check.met ? 'text-green-600' : 'text-gray-400'}`}>
            {check.met ? (
              <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <circle cx="10" cy="10" r="4" />
              </svg>
            )}
            {t(check.label)}
          </li>
        ))}
      </ul>
    </div>
  );
}

export { getStrength };
