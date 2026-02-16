interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function Logo({ size = 'md', className = '' }: LogoProps) {
  const sizeClasses = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-3xl',
  };

  const iconSizes = { sm: 20, md: 24, lg: 32 };
  const s = iconSizes[size];

  return (
    <span className={`inline-flex items-center gap-1.5 ${sizeClasses[size]} font-bold ${className}`}>
      <svg width={s} height={s} viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0" aria-hidden="true">
        <rect width="512" height="512" rx="102" fill="#1e293b"/>
        <path d="M 140 78 L 140 432" stroke="#e2e8f0" strokeWidth="58" strokeLinecap="round" fill="none"/>
        <path d="M 140 260 C 140 260 192 190 270 190 C 346 190 364 254 364 294 L 364 432" stroke="#e2e8f0" strokeWidth="58" strokeLinecap="round" fill="none"/>
        <circle cx="406" cy="406" r="56" fill="#1e293b"/>
        <circle cx="406" cy="406" r="46" fill="#2563eb"/>
        <path d="M 385 406 L 399 420 L 428 391" stroke="#fff" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      </svg>
      <span className="text-slate-900">human</span>
      <span className="text-blue-600">pages</span>
      <span className="text-slate-400">.ai</span>
    </span>
  );
}
