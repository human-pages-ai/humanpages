import { useState } from 'react';
import { CvProcessingBar } from '../components/CvProcessingBar';

interface StepCvUploadProps {
  cvInputRef: React.RefObject<HTMLInputElement>;
  onCVChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onProcessFile: (file: File) => void;
  cvProcessing: boolean;
  cvUploaded: boolean;
  cvData: any;
  onReupload: () => void;
  onNext: () => void;
  onSkip: () => void;
  error: string;
}

export function StepCvUpload({ cvInputRef, onCVChange, onProcessFile, cvProcessing, cvUploaded, cvData, onReupload, onNext, onSkip: _onSkip, error }: StepCvUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  return (
    <>
      <h2 data-step-heading tabIndex={-1} className="text-xl sm:text-2xl font-bold text-slate-900 mb-2 outline-none">Let's get started</h2>
      <p className="text-slate-600 mb-6">Upload your CV to quickly auto-fill your profile</p>

      {error && <div role="alert" tabIndex={-1} className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 outline-none">{error}</div>}

      {cvUploaded && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-blue-600">📄</span>
            <p className="font-medium text-blue-900">CV already uploaded</p>
          </div>
          <p className="text-sm text-blue-700 mb-3">Your CV has already been analyzed and your profile was pre-filled with the extracted data.</p>
          <button type="button" onClick={onReupload} className="text-sm text-orange-600 hover:text-orange-700 font-medium">Upload a different CV</button>
        </div>
      )}

      <div className="mb-8">
        {cvUploaded ? (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold flex-shrink-0">&#10003;</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-green-800">CV analyzed successfully!</p>
                <p className="text-xs text-green-600">Your profile has been auto-filled. Continue to review it.</p>
              </div>
              <button type="button" onClick={onReupload} className="text-xs font-medium text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-300 px-2.5 py-1.5 rounded transition-colors flex-shrink-0 w-full sm:w-auto text-center">Upload different CV</button>
            </div>
            {cvData && (
              <div className="mt-2 pt-2 border-t border-green-200 grid grid-cols-1 min-[320px]:grid-cols-2 sm:grid-cols-3 gap-1.5 text-xs text-green-700">
                {(cvData.skills?.explicit?.length || 0) + (cvData.skills?.inferred?.length || 0) > 0 && (
                  <span>{(cvData.skills.explicit?.length || 0) + (cvData.skills.inferred?.length || 0)} skills</span>
                )}
                {cvData.workExperience?.length > 0 && <span>{cvData.workExperience.length} jobs</span>}
                {cvData.education?.length > 0 && <span>{cvData.education.length} education</span>}
                {cvData.certificates?.length > 0 && <span>{cvData.certificates.length} certificates</span>}
                {cvData.languages?.length > 0 && <span>{cvData.languages.length} languages</span>}
                {(cvData.linkedinUrl || cvData.githubUrl || cvData.websiteUrl) && <span>social links</span>}
                {cvData.suggestedServices?.length > 0 && <span>{cvData.suggestedServices.length} service ideas</span>}
              </div>
            )}
          </div>
        ) : cvProcessing ? (
          <CvProcessingBar />
        ) : (
          <div
            onDragEnter={() => setDragActive(true)}
            onDragLeave={() => setDragActive(false)}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive(true); }}
            onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); const file = e.dataTransfer.files?.[0]; if (file) onProcessFile(file); }}
          >
            <button type="button" onClick={() => cvInputRef.current?.click()} aria-label="Upload your CV (PDF or Word document)" className={`w-full p-8 sm:p-10 border-3 border-dashed rounded-lg transition-colors text-center ${dragActive ? 'border-orange-500 bg-orange-100' : 'border-orange-300 bg-orange-50 hover:bg-orange-100 hover:border-orange-400 active:bg-orange-100'}`}>
              <div className="text-4xl mb-3" aria-hidden="true">📄</div>
              <p className="text-lg font-bold text-orange-700 mb-1">Upload your CV</p>
              <p className="text-sm text-orange-600 mb-3">PDF or Word document</p>
              <p className="text-xs text-orange-500">From your device, Google Drive, or Dropbox</p>
            </button>
          </div>
        )}
        <input ref={cvInputRef} type="file" accept=".pdf,.docx,.doc,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={onCVChange} className="hidden" />
      </div>

      <div className="flex items-center justify-between gap-3 mt-6">
        <button type="button" onClick={_onSkip} className="text-sm font-medium text-slate-600 hover:text-slate-900 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 active:bg-slate-100 transition-colors">
          Skip for now
        </button>
        <button type="button" onClick={onNext} disabled={!cvUploaded && !cvProcessing} className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors shadow-lg focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-500 ${cvUploaded || cvProcessing ? 'bg-orange-500 text-white hover:bg-orange-600 active:bg-orange-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`} aria-label="Next step">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
    </>
  );
}
