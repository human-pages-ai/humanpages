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

  return (
    <span className={`${sizeClasses[size]} font-bold tracking-tight ${className}`}>
      <span className="text-slate-900">human</span><span className="text-blue-600">pages</span><span className="text-orange-500">.ai</span>
    </span>
  );
}
