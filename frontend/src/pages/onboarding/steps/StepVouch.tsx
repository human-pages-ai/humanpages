interface StepVouchProps {
  username: string;
  setUsername: (v: string) => void;
  onNext: () => void;
  onSkip: () => void;
  error: string;
}

export function StepVouch({
  username,
  setUsername,
  onNext,
  onSkip,
  error,
}: StepVouchProps) {
  const profileUrl = `humanpages.ai/user/${username}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(`https://${profileUrl}`);
      // Show feedback (could integrate with toast)
      alert('Profile link copied to clipboard!');
    } catch {
      // Fallback if clipboard API fails
      alert('Failed to copy link');
    }
  };

  const handleShareWhatsApp = () => {
    const text = `Check out my profile on HumanPages: https://${profileUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleShareTelegram = () => {
    const text = `Check out my profile on HumanPages: https://${profileUrl}`;
    window.open(`https://t.me/share/url?url=${encodeURIComponent(profileUrl)}&text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <>
      <h2 data-step-heading tabIndex={-1} className="text-xl sm:text-2xl font-bold text-slate-900 mb-2 outline-none">Build Trust</h2>
      <p className="text-slate-600 mb-6">People who know your work can vouch for you. This builds trust with agents and helps you get hired faster.</p>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm" role="alert">{error}</div>}

      {/* Vouch Progress */}
      <div className="mb-6 p-4 border border-slate-200 rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-slate-700">Vouches Received</p>
          <span className="text-2xl font-bold text-orange-500">0/10</span>
        </div>
        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
          <div className="h-full bg-orange-500" style={{ width: '0%' }}></div>
        </div>
        <p className="text-xs text-slate-500 mt-2">Share your profile and ask colleagues to vouch for you</p>
      </div>

      {/* Username Input */}
      <div className="mb-6">
        <label htmlFor="username" className="block text-sm font-medium text-slate-700 mb-1">Your profile link</label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600">humanpages.ai/user/</span>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value.slice(0, 50).replace(/\s+/g, '-').toLowerCase())}
            placeholder="your-username"
            className="flex-1 px-3 py-2.5 sm:py-2 border border-slate-300 rounded-lg text-base sm:text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
        </div>
        <p className="text-xs text-slate-500 mt-2">Alphanumeric and hyphens only</p>
      </div>

      {/* Share Buttons */}
      <div className="mb-6 space-y-2">
        <button
          type="button"
          onClick={handleCopyLink}
          className="w-full py-2.5 bg-blue-50 text-blue-700 font-medium rounded-lg hover:bg-blue-100 active:bg-blue-200 border border-blue-200 transition-colors text-sm flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
          Copy Profile Link
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleShareWhatsApp}
            className="py-2.5 bg-green-50 text-green-700 font-medium rounded-lg hover:bg-green-100 active:bg-green-200 border border-green-200 transition-colors text-sm flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12.031 6.172c-3.173 0-5.469 1.654-5.469 5.4 0 1.065.264 2.078.744 2.922.426.842.94 1.5 1.524 1.996.609.54 1.431 1.074 2.331 1.447.678.276 1.355.519 2.037.625.849.148 1.392.3 1.541.465.11.123.119.289.02.435l-.823 1.506c-.149.257-.505.27-.775.124-.545-.363-1.487-1.045-2.05-1.784-.39-.516-.698-1.166-.90-2.05-.226-.887-.06-1.652.562-2.047.528-.36 1.497-.638 2.088-.132.4.29.406.77.203 1.124-.206.354-.534.566-.926.66-.278.06-.515-.21-.602-.052-.081.146-.281.129-.464-.066-.503-.588-.368-1.55.251-2.763.532-1.022 1.75-1.554 2.920-.3.727.822 1.212 1.522 1.489 2.565.276 1.044.178 2.3-.542 2.972-.623.606-1.623.945-2.6 1.022-.928.074-1.707-.236-2.251-.656-.543-.418-.914-.993-1.122-1.637-.209-.644-.232-1.417-.08-2.196.152-.78.463-1.588.936-2.407.473-.819.704-1.533.704-2.135 0-1.067-.374-1.962-1.122-2.684-.748-.722-1.854-1.084-3.32-1.084zm15.969 0c3.173 0 5.469 1.654 5.469 5.4 0 1.065-.264 2.078-.744 2.922-.426.842-.94 1.5-1.524 1.996-.609.54-1.431 1.074-2.331 1.447-.678.276-1.355.519-2.037.625-.849.148-1.392.3-1.541.465-.11.123-.119.289-.02.435l.823 1.506c.149.257.505.27.775.124.545-.363 1.487-1.045 2.05-1.784.39-.516.698-1.166.90-2.05.226-.887.06-1.652-.562-2.047-.528-.36-1.497-.638-2.088-.132-.4.29-.406.77-.203 1.124.206.354.534.566.926.66.278.06.515-.21.602-.052.081.146.281.129.464-.066.503-.588.368-1.55-.251-2.763-.532-1.022-1.75-1.554-2.92-.3-.727.822-1.212 1.522-1.489 2.565-.276 1.044-.178 2.3.542 2.972.623.606 1.623.945 2.6 1.022.928.074 1.707-.236 2.251-.656.543-.418.914-.993 1.122-1.637.209-.644.232-1.417.08-2.196-.152-.78-.463-1.588-.936-2.407-.473-.819-.704-1.533-.704-2.135 0-1.067.374-1.962 1.122-2.684.748-.722 1.854-1.084 3.32-1.084z"/></svg>
            WhatsApp
          </button>
          <button
            type="button"
            onClick={handleShareTelegram}
            className="py-2.5 bg-blue-50 text-blue-700 font-medium rounded-lg hover:bg-blue-100 active:bg-blue-200 border border-blue-200 transition-colors text-sm flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18 1.897-.962 6.502-1.359 8.627-.168.9-.5 1.201-.82 1.23-.697.064-1.226-.461-1.901-.903-1.056-.692-1.653-1.123-2.678-1.799-1.185-.781-.417-1.21.258-1.911.177-.184 3.247-2.977 3.307-3.23.007-.032.015-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.139-5.062 3.345-.479.329-.913.489-1.302.481-.428-.008-1.252-.241-1.865-.44-.751-.244-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.015 3.333-1.386 4.025-1.627 4.477-1.635.099-.002.321.023.465.141.121.1.154.234.169.337.015.102.034.331.019.51z"/></svg>
            Telegram
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <button type="button" onClick={onNext} className="w-full py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 active:bg-orange-700 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-500">Continue</button>
        <button type="button" onClick={onSkip} className="w-full py-3 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 active:bg-slate-300">Skip for now</button>
      </div>
    </>
  );
}
