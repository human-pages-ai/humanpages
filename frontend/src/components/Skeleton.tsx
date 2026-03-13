/**
 * Reusable skeleton/shimmer components for loading states
 * Uses Tailwind's animate-pulse for smooth loading animation
 */

/**
 * SkeletonLine - A single line shimmer
 * @param className - Custom width/height/spacing classes
 */
export function SkeletonLine({ className = 'w-full h-4' }: { className?: string }) {
  return <div className={`bg-slate-200 rounded animate-pulse ${className}`} />;
}

/**
 * SkeletonCard - A card-shaped skeleton with multiple lines
 * Useful for preview content sections
 */
export function SkeletonCard() {
  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-4">
      <SkeletonLine className="w-3/4 h-6" />
      <div className="space-y-2">
        <SkeletonLine className="w-full h-4" />
        <SkeletonLine className="w-5/6 h-4" />
        <SkeletonLine className="w-4/5 h-4" />
      </div>
      <SkeletonLine className="w-1/3 h-8 mt-4" />
    </div>
  );
}

/**
 * SkeletonAvatar - A circular skeleton for profile photos
 * @param size - Size class (default: w-16 h-16)
 */
export function SkeletonAvatar({ size = 'w-16 h-16' }: { size?: string } = {}) {
  return <div className={`${size} bg-slate-200 rounded-full animate-pulse`} />;
}

/**
 * SkeletonText - Multiple lines of text (paragraph placeholder)
 * @param lines - Number of lines to display (default: 3)
 */
export function SkeletonText({ lines = 3 }: { lines?: number } = {}) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine
          key={i}
          className={i === lines - 1 ? 'w-4/5 h-4' : 'w-full h-4'}
        />
      ))}
    </div>
  );
}

/**
 * SkeletonTab - Skeleton for tab navigation
 */
export function SkeletonTab() {
  return (
    <div className="flex gap-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <SkeletonLine key={i} className="w-24 h-8" />
      ))}
    </div>
  );
}

/**
 * SkeletonDashboard - Full dashboard loading skeleton
 * Shows status header, tabs, and multiple card placeholders
 */
export function SkeletonDashboard() {
  return (
    <div className="space-y-4">
      {/* Status header placeholder */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="space-y-3">
          <SkeletonLine className="w-1/2 h-6" />
          <SkeletonLine className="w-3/4 h-4" />
        </div>
      </div>

      {/* Tab bar placeholder */}
      <SkeletonTab />

      {/* Card placeholders */}
      {Array.from({ length: 3 }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
