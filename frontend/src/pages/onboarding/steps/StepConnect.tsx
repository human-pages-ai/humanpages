import { useEffect, useRef } from 'react';
import { api } from '../../../lib/api';
import { isInAppBrowser } from '../utils';
import { WhatsAppSection } from '../components/WhatsAppSection';
import type { TelegramState } from '../types';

interface StepConnectProps {
  whatsappNumber: string;
  setWhatsappNumber: (v: string) => void;
  smsNumber?: string;
  setSmsNumber?: (v: string) => void;
  telegramStatus: TelegramState['telegramStatus'];
  setTelegramStatus: (v: TelegramState['telegramStatus']) => void;
  telegramLinkUrl: string | null;
  setTelegramLinkUrl: (v: string | null) => void;
  telegramLoading: boolean;
  setTelegramLoading: (v: boolean) => void;
  onNext: () => void;
  onSkip: () => void;
  error: string;
}

export function StepConnect({
  whatsappNumber, setWhatsappNumber,
  smsNumber, setSmsNumber,
  telegramStatus, setTelegramStatus,
  telegramLinkUrl, setTelegramLinkUrl,
  telegramLoading, setTelegramLoading,
  onNext, onSkip, error,
}: StepConnectProps) {
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    api.getTelegramStatus().then(status => setTelegramStatus(status)).catch(() => {
      // Initial status check failed — user may not have bot available
    });
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps — runs only on mount to fetch initial telegram status

  const handleConnectTelegram = async () => {
    setTelegramLoading(true);
    try {
      const result = await api.linkTelegram();
      setTelegramLinkUrl(result.linkUrl);
      if (isInAppBrowser()) {
        window.location.href = result.linkUrl;
      } else {
        window.open(result.linkUrl, '_blank');
      }
      // Clear any existing poll before starting a new one
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
      pollRef.current = setInterval(async () => {
        try {
          const status = await api.getTelegramStatus();
          setTelegramStatus(status);
          if (status.connected && pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        } catch {
          // Poll attempt failed — will retry in next interval
        }
      }, 3000);
    } catch {
      // Link URL generation failed — will be caught and displayed to user
    } finally {
      setTelegramLoading(false);
    }
  };

  return (
    <>
      <h2 data-step-heading tabIndex={-1} className="text-xl sm:text-2xl font-bold text-slate-900 mb-2 outline-none">Stay Connected</h2>
      <p className="text-slate-600 mb-6">Get notified instantly when agents want to hire you</p>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm" role="alert">{error}</div>}

      {/* Urgency banner */}
      <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <div className="flex gap-3">
          <svg className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <div>
            <p className="text-sm font-semibold text-amber-800">Agents are more likely to hire you if you respond fast</p>
            <p className="text-xs text-amber-700 mt-1">Connect Telegram or WhatsApp to receive instant job notifications and never miss an opportunity.</p>
          </div>
        </div>
      </div>

      {/* Telegram Section */}
      <div className="mb-6 p-4 border border-slate-200 rounded-lg">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
            <svg className="w-6 h-6 text-blue-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18 1.897-.962 6.502-1.359 8.627-.168.9-.5 1.201-.82 1.23-.697.064-1.226-.461-1.901-.903-1.056-.692-1.653-1.123-2.678-1.799-1.185-.781-.417-1.21.258-1.911.177-.184 3.247-2.977 3.307-3.23.007-.032.015-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.139-5.062 3.345-.479.329-.913.489-1.302.481-.428-.008-1.252-.241-1.865-.44-.751-.244-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.015 3.333-1.386 4.025-1.627 4.477-1.635.099-.002.321.023.465.141.121.1.154.234.169.337.015.102.034.331.019.51z"/></svg>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-slate-900">Telegram</h3>
            <p className="text-xs text-slate-500">Receive job offers via our HumanPages bot</p>
          </div>
          {telegramStatus?.connected && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              Connected
            </span>
          )}
        </div>
        {telegramStatus?.connected ? (
          <p className="text-sm text-green-700 bg-green-50 rounded-lg p-3">You're connected to Telegram! You'll receive instant notifications for new job offers.</p>
        ) : (
          <>
            <button type="button" onClick={handleConnectTelegram} disabled={telegramLoading} className="w-full py-2.5 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 active:bg-blue-700 disabled:opacity-50 transition-colors text-sm">
              {telegramLoading ? 'Connecting...' : 'Connect Telegram'}
            </button>
            {telegramLinkUrl && (
              <div className="mt-2 p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
                <p>Didn't open? <a href={telegramLinkUrl} target="_blank" rel="noopener noreferrer" className="underline font-medium" onClick={(e) => { if (isInAppBrowser()) { e.preventDefault(); window.location.href = telegramLinkUrl!; } }}>Click here to connect on Telegram</a>.</p>
                <p className="mt-1">After clicking <strong>Start</strong> in Telegram, we'll detect the connection automatically. {window.location.hostname === 'localhost' && <span className="text-blue-500">(Note: auto-detection requires a public URL — in local dev, deploy or use a tunnel like ngrok.)</span>}</p>
                {window.location.hostname === 'localhost' && telegramLinkUrl && (
                  <p className="mt-2 pt-2 border-t border-blue-200">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const codeMatch = telegramLinkUrl.match(/start=([A-F0-9]+)/i);
                          if (!codeMatch) {
                            alert('Could not extract code from URL');
                            return;
                          }
                          const code = codeMatch[1];
                          const response = await api.devSimulateTelegramConnection(code);
                          if (response.success) {
                            setTelegramStatus({ connected: true, botAvailable: true });
                          }
                        } catch (err) {
                          alert('Simulation failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
                        }
                      }}
                      className="underline font-medium hover:text-blue-900"
                    >
                      Simulate Connection (dev mode)
                    </button>
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <WhatsAppSection whatsappNumber={whatsappNumber} setWhatsappNumber={setWhatsappNumber} smsNumber={smsNumber} setSmsNumber={setSmsNumber} />

      <div className="space-y-3">
        <button type="button" onClick={onNext} className="w-full py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 active:bg-orange-700 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-500">Continue</button>
        <button type="button" onClick={onSkip} className="w-full py-3 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 active:bg-slate-300">Skip for now</button>
        <p className="text-xs text-slate-500 text-center">Step 2 of 7</p>
      </div>
    </>
  );
}
