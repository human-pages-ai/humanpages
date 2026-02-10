import { useState, ReactNode } from 'react';

interface Props {
  title: string;
  subtitle?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  id?: string;
  badge?: ReactNode;
}

export default function CollapsibleSection({ title, subtitle, children, defaultOpen = false, id, badge }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div id={id}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-1 py-2 text-left group"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3 min-w-0">
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform duration-200 flex-shrink-0 ${open ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide group-hover:text-gray-700 transition-colors">{title}</h2>
              {badge}
            </div>
            {!open && subtitle && (
              <p className="text-xs text-gray-400 mt-0.5 truncate">{subtitle}</p>
            )}
          </div>
        </div>
      </button>

      {open && (
        <div className="mt-2 space-y-4">
          {children}
        </div>
      )}
    </div>
  );
}
