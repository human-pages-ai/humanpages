// Hidden: CV upload feature disabled - component renders nothing
export default function CvUpload() {
  return null;

  /*
  // Original implementation (commented out):
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [parseProgress, setParseProgress] = useState(0);

  const cvUploaded = !!profile.cvParsedAt;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.includes('pdf') && !file.type.includes('word') && !file.name.endsWith('.docx') && !file.name.endsWith('.pdf')) {
      toast.error('Please upload a PDF or Word document');
      return;
    }

    const MAX_SIZE_MB = 5;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`File too large. Maximum size is ${MAX_SIZE_MB}MB.`);
      return;
    }

    setUploading(true);
    setParseProgress(0);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setParseProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      await api.uploadCV(file);

      clearInterval(progressInterval);
      setParseProgress(100);

      toast.success('CV uploaded and analyzed successfully!');
      onUpload?.();

      setTimeout(() => {
        setParseProgress(0);
      }, 1000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to upload CV');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  if (cvUploaded) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              CV uploaded
            </h3>
            <div className="mt-1 text-sm text-gray-600">
              {profile.cvParsedAt && new Date(profile.cvParsedAt).toLocaleDateString()}
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-xs text-blue-600">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>CV verified — boosts your visibility and trust score</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-6">
      <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">CV upload</h3>

      <div
        onClick={handleClick}
        className="border-2 border-dashed border-gray-300 rounded-lg p-4 sm:p-6 md:p-8 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={handleFileChange}
          disabled={uploading}
          className="hidden"
        />

        {uploading && parseProgress > 0 && parseProgress < 100 ? (
          <div className="space-y-3">
            <div className="inline-block w-12 h-12 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
            <p className="text-sm font-medium text-gray-700">Analyzing your CV...</p>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${parseProgress}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-2 sm:space-y-3">
            <svg className="mx-auto h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
            <p className="text-xs sm:text-sm font-medium text-gray-700">
              {uploading ? 'Uploading...' : 'Click to upload or drag and drop'}
            </p>
            <p className="text-xs text-gray-500">PDF or Word document</p>
            <p className="text-xs text-gray-400 mt-1 sm:mt-2">
              AI fills your profile automatically + boosts your credibility
            </p>
          </div>
        )}
      </div>
    </div>
  );
  */
}
