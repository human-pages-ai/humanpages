import { useState, useEffect } from 'react';

/** Simulated progress bar — fast to 60%, slow to 85%, then crawls */
function useSimulatedProgress(): number {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const tick = () => {
      const elapsed = (Date.now() - start) / 1000;
      let p: number;
      if (elapsed < 5) p = (elapsed / 5) * 60;
      else if (elapsed < 20) p = 60 + ((elapsed - 5) / 15) * 25;
      else p = Math.min(85 + (elapsed - 20) * 0.1, 95);
      setProgress(Math.round(p));
    };
    const id = setInterval(tick, 200);
    tick();
    return () => clearInterval(id);
  }, []);
  return progress;
}

/** Full-size animated progress bar shown on CV upload step */
export function CvProcessingBar() {
  const progress = useSimulatedProgress();
  return (
    <div className="p-6 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 border-3 border-blue-200 border-t-blue-500 rounded-full animate-spin flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-700">Analyzing your CV...</p>
          <p className="text-xs text-slate-500 mt-0.5">Extracting skills, experience, and education</p>
        </div>
        <span className="text-xs font-semibold text-blue-600 tabular-nums flex-shrink-0">{progress}%</span>
      </div>
      <div className="w-full h-2 bg-blue-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-[width] duration-300 ease-out"
          style={{ width: `${progress}%` }}
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="CV analysis progress"
        />
      </div>
    </div>
  );
}

/** Compact progress bar shown at top of subsequent steps while CV is still processing */
export function CompactCvProcessingBar() {
  const progress = useSimulatedProgress();
  return (
    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg animate-pulse">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-4 h-4 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin flex-shrink-0" />
        <p className="text-xs font-medium text-slate-700 flex-1">Analyzing CV... {progress}%</p>
      </div>
      <div className="w-full h-1.5 bg-blue-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-[width] duration-300 ease-out"
          style={{ width: `${progress}%` }}
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="CV analysis progress"
        />
      </div>
    </div>
  );
}
