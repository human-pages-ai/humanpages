import { Link } from 'react-router-dom';

interface WizardModuleTileProps {
  title: string;
  stepId: string;
  children: React.ReactNode;
  isEmpty?: boolean;
}

export default function WizardModuleTile({
  title,
  stepId,
  children,
  isEmpty = false,
}: WizardModuleTileProps) {
  return (
    <div className="bg-white rounded-lg shadow border border-slate-200 p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          {title}
        </h3>
        <Link
          to={`/onboarding?step=${stepId}`}
          className="text-sm font-medium text-blue-600 hover:text-blue-500"
        >
          Edit
        </Link>
      </div>

      <div className={isEmpty ? 'text-sm text-gray-400 italic' : 'text-sm text-gray-900'}>
        {children}
      </div>
    </div>
  );
}
