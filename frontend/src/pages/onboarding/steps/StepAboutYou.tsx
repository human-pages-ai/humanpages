import LocationAutocomplete from '../../../components/LocationAutocomplete';

interface StepAboutYouProps {
  name: string;
  setName: (v: string) => void;
  bio: string;
  setBio: (v: string) => void;
  location: string;
  setLocation: (v: string) => void;
  setLocationLat: (v: number | undefined) => void;
  setLocationLng: (v: number | undefined) => void;
  setNeighborhood: (v: string) => void;
  photoPreview: string | null;
  photoInputRef: React.RefObject<HTMLInputElement>;
  onPhotoChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPhotoRemove: () => void;
  oauthPhotoUrl: string | null;
  cvUploaded: boolean;
  cvData: any;
  onNext: () => void;
  error: string;
  setError: (v: string) => void;
}

export function StepAboutYou({
  name, setName, bio, setBio,
  location, setLocation, setLocationLat, setLocationLng, setNeighborhood,
  photoPreview, photoInputRef, onPhotoChange, onPhotoRemove,
  oauthPhotoUrl, cvUploaded, cvData,
  onNext, error, setError,
}: StepAboutYouProps) {
  return (
    <>
      <h2 data-step-heading tabIndex={-1} className="text-xl sm:text-2xl font-bold text-slate-900 mb-2 outline-none">About You</h2>
      <p className="text-slate-600 mb-6">Complete your profile information</p>

      {cvUploaded && cvData && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold flex-shrink-0 text-sm">✓</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-green-800">CV analyzed</p>
              <p className="text-xs text-green-600">Your information has been pre-filled below</p>
            </div>
          </div>
        </div>
      )}

      {error && <div role="alert" tabIndex={-1} className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 outline-none">{error}</div>}

      {/* Photo */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-700 mb-2">Profile Photo</label>
        {photoPreview || oauthPhotoUrl ? (
          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
            <img src={photoPreview || oauthPhotoUrl || ''} alt="Profile photo preview" loading="lazy" className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border-2 border-orange-200" onError={(e) => { (e.target as HTMLImageElement).src = ''; (e.target as HTMLImageElement).alt = 'Photo failed to load'; }} />
            <div className="flex flex-row sm:flex-col gap-3 sm:gap-2">
              <button type="button" onClick={() => photoInputRef.current?.click()} className="text-sm font-medium text-orange-600 hover:text-orange-700 py-1">Change photo</button>
              <button type="button" onClick={onPhotoRemove} className="text-xs font-medium text-slate-500 hover:text-slate-700 py-1">Remove</button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => photoInputRef.current?.click()} aria-label="Upload profile photo" className="w-full px-4 py-5 sm:py-8 border-2 border-dashed border-slate-300 rounded-lg text-center hover:border-orange-400 hover:bg-orange-50 active:bg-orange-50">
            <div className="text-3xl mb-2" aria-hidden="true">📷</div>
            <p className="text-sm font-medium text-slate-700">Click to upload photo</p>
            <p className="text-xs text-slate-500">JPG, PNG — max 5MB</p>
          </button>
        )}
        <input ref={photoInputRef} type="file" accept="image/*" onChange={onPhotoChange} className="hidden" />
      </div>

      {/* Name */}
      <div className="mb-4">
        <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">Full Name <span className="text-red-500">*</span></label>
        <input id="name" type="text" value={name} onChange={(e) => { setName(e.target.value.slice(0, 100)); setError(''); }} onBlur={(e) => { setName(e.target.value.trim()); }} maxLength={100} placeholder="John Doe" autoComplete="name" className="w-full px-3 sm:px-4 py-2.5 sm:py-2 border border-slate-300 rounded-lg text-base sm:text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500" />
      </div>

      {/* Bio */}
      <div className="mb-4">
        <label htmlFor="bio" className="block text-sm font-medium text-slate-700 mb-1">Short Bio</label>
        <textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value.slice(0, 500))} placeholder="Tell us a bit about yourself..." maxLength={500} rows={2} aria-describedby="bio-count" className="w-full px-4 py-2 border border-slate-300 rounded-lg text-base sm:text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500" />
        <p id="bio-count" className={`text-xs mt-1 ${bio.length >= 480 ? 'text-red-500 font-medium' : bio.length >= 400 ? 'text-orange-600 font-medium' : 'text-slate-400'}`}>{bio.length}/500 characters{bio.length === 0 && ' — a good bio helps you stand out'}</p>
      </div>

      {/* Location */}
      <div className="mb-6">
        <label htmlFor="location-input" className="block text-sm font-medium text-slate-700 mb-1">Location (Optional)</label>
        <LocationAutocomplete
          id="location-input"
          value={location}
          onChange={(loc: string, lat?: number, lng?: number, nbhd?: string) => {
            setLocation(loc);
            if (lat != null && lng != null) { setLocationLat(lat); setLocationLng(lng); setNeighborhood(nbhd || ''); } else { setLocationLat(undefined); setLocationLng(undefined); setNeighborhood(''); }
          }}
          placeholder="City or address"
          className="w-full px-4 py-2.5 sm:py-2 border border-slate-300 rounded-lg text-base sm:text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
        />
      </div>

      <div className="space-y-3">
        <button type="button" onClick={onNext} className="w-full py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 active:bg-orange-700 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-500">Continue to Skills</button>
        <p className="text-xs text-slate-500 text-center">Step 5 of 7</p>
      </div>
    </>
  );
}
