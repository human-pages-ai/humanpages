import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import Link from '../components/LocalizedLink';
import LanguageSwitcher from '../components/LanguageSwitcher';
import Logo from '../components/Logo';
import SEO from '../components/SEO';
import Footer from '../components/Footer';
import { SOCIAL_URLS } from '../lib/social';
import { api } from '../lib/api';
import type { Listing } from '../components/dashboard/types';
import {
  CameraIcon,
  MagnifyingGlassIcon,
  PhoneIcon,
  TruckIcon,
  WrenchScrewdriverIcon,
  BuildingStorefrontIcon,
  UserPlusIcon,
  BoltIcon,
  BanknotesIcon,
  EyeSlashIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-slate-200 last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full py-4 flex justify-between items-center text-left"
      >
        <span className="font-medium text-slate-900">{q}</span>
        <svg
          className={`w-5 h-5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <p className="pb-4 text-slate-600">{a}</p>}
    </div>
  );
}

/** Shared tick hook — drives the rotating headline */
function useHeroTick() {
  const [tick, setTick] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setTick((prev) => prev + 1);
        setVisible(true);
      }, 350);
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  return { tick, visible };
}

/** Cycling "AI agents can't ___" headline */
function RotatingHeadline({ tick, visible }: { tick: number; visible: boolean }) {
  const { t } = useTranslation();
  const phrases = t('landing.hero.rotatingPhrases', { returnObjects: true }) as string[];
  const prefix = t('landing.hero.rotatingPrefix');
  const phrase = Array.isArray(phrases) ? phrases[tick % phrases.length] : '';

  return (
    <span className="block">
      <span>{prefix}</span>
      <span
        className={`inline-block transition-all duration-300 ${
          visible
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-2'
        }`}
      >
        <span className="text-blue-600">{phrase}</span>
      </span>
    </span>
  );
}

/** Parse **bold** markers into segments */
function parseBold(str: string): { text: string; bold: boolean }[] {
  const segs: { text: string; bold: boolean }[] = [];
  const parts = str.split(/\*\*(.*?)\*\*/);
  for (let i = 0; i < parts.length; i++) {
    if (parts[i]) segs.push({ text: parts[i], bold: i % 2 === 1 });
  }
  return segs;
}

/** Mock AI chat — types in input, sends, AI "thinks" then streams, interactive follow-ups */
function MockChatConversation() {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Follow-up state
  const [completedFU, setCompletedFU] = useState<number[]>([]);
  const [activeFU, setActiveFU] = useState<number | null>(null);
  const [fuPhase, setFuPhase] = useState(-1); // -1 idle, 0 typing-input, 1 sent, 2 thinking, 3 streaming
  const [fuCharIdx, setFuCharIdx] = useState(0);

  // --- Speeds ---
  const USER_SPEED = 50; // ms per char — human typing
  const AI_SPEED = 20;   // ms per char — AI streaming

  // --- User questions ---
  const q1 = t('chat.q1');
  const q2 = t('chat.q2');
  const q3 = t('chat.q3');

  // --- AI responses ---
  const r1Segs = parseBold(t('chat.a1'));
  const r1Len = r1Segs.reduce((n, s) => n + s.text.length, 0);

  const r2Text = t('chat.a2');

  const r3Segs = parseBold(t('chat.a3'));
  const r3Len = r3Segs.reduce((n, s) => n + s.text.length, 0);

  // --- Follow-up Q&As (triggered by suggestion clicks) ---
  const FOLLOW_UPS = [
    { q: t('chat.fu1q'), segs: parseBold(t('chat.fu1a')) },
    { q: t('chat.fu2q'), segs: parseBold(t('chat.fu2a')) },
    { q: t('chat.fu3q'), segs: parseBold(t('chat.fu3a')) },
    { q: t('chat.fu4q'), segs: parseBold(t('chat.fu4a')) },
    { q: t('chat.fu5q'), segs: parseBold(t('chat.fu5a')) },
    { q: t('chat.fu6q'), segs: parseBold(t('chat.fu6a')) },
    { q: t('chat.fu7q'), segs: parseBold(t('chat.fu7a')) },
  ];

  /*
   * Step machine — user types in input, message sends, AI thinks then streams.
   *  0  → 500ms   → 1   start typing Q1 in input
   *  1  → typing   → 2   Q1 sent to chat
   *  2  → 600ms   → 3   thinking
   *  3  → 1500ms  → 4   stream R1
   *  4  → stream   → 5   done R1
   *  5  → 1000ms  → 6   type Q2
   *  6  → typing   → 7   Q2 sent
   *  7  → 600ms   → 8   thinking
   *  8  → 2000ms  → 9   stream R2
   *  9  → stream   → 10  done R2
   * 10  → 1000ms  → 11  type Q3
   * 11  → typing   → 12  Q3 sent
   * 12  → 600ms   → 13  thinking
   * 13  → 1200ms  → 14  stream R3
   * 14  → stream   → 15  suggestions
   */
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    switch (step) {
      case 0:  t = setTimeout(() => { setCharIdx(0); setStep(1); }, 500); break;
      case 1:  // typing Q1 in input
        if (charIdx < q1.length) t = setTimeout(() => setCharIdx(i => i + 1), USER_SPEED);
        else t = setTimeout(() => setStep(2), 300);
        break;
      case 2:  t = setTimeout(() => setStep(3), 600); break;
      case 3:  t = setTimeout(() => { setCharIdx(0); setStep(4); }, 1500); break;
      case 4:  // streaming R1
        if (charIdx < r1Len) t = setTimeout(() => setCharIdx(i => i + 1), AI_SPEED);
        else t = setTimeout(() => setStep(5), 800);
        break;
      case 5:  t = setTimeout(() => { setCharIdx(0); setStep(6); }, 1000); break;
      case 6:  // typing Q2 in input
        if (charIdx < q2.length) t = setTimeout(() => setCharIdx(i => i + 1), USER_SPEED);
        else t = setTimeout(() => setStep(7), 300);
        break;
      case 7:  t = setTimeout(() => setStep(8), 600); break;
      case 8:  t = setTimeout(() => { setCharIdx(0); setStep(9); }, 2000); break;
      case 9:  // streaming R2
        if (charIdx < r2Text.length) t = setTimeout(() => setCharIdx(i => i + 1), AI_SPEED);
        else t = setTimeout(() => setStep(10), 800);
        break;
      case 10: t = setTimeout(() => { setCharIdx(0); setStep(11); }, 1000); break;
      case 11: // typing Q3 in input
        if (charIdx < q3.length) t = setTimeout(() => setCharIdx(i => i + 1), USER_SPEED);
        else t = setTimeout(() => setStep(12), 300);
        break;
      case 12: t = setTimeout(() => setStep(13), 600); break;
      case 13: t = setTimeout(() => { setCharIdx(0); setStep(14); }, 1200); break;
      case 14: // streaming R3
        if (charIdx < r3Len) t = setTimeout(() => setCharIdx(i => i + 1), AI_SPEED);
        else t = setTimeout(() => setStep(15), 300);
        break;
    }
    return () => clearTimeout(t);
  }, [step, charIdx]);

  // --- Follow-up animation ---
  useEffect(() => {
    if (activeFU === null || fuPhase < 0) return;
    let t: ReturnType<typeof setTimeout>;
    const fu = FOLLOW_UPS[activeFU];
    const aLen = fu.segs.reduce((n, s) => n + s.text.length, 0);
    switch (fuPhase) {
      case 0: // typing in input
        if (fuCharIdx < fu.q.length) t = setTimeout(() => setFuCharIdx(i => i + 1), USER_SPEED);
        else t = setTimeout(() => setFuPhase(1), 300);
        break;
      case 1: // sent, pause
        t = setTimeout(() => setFuPhase(2), 600);
        break;
      case 2: // thinking
        t = setTimeout(() => { setFuCharIdx(0); setFuPhase(3); }, 1500);
        break;
      case 3: // streaming
        if (fuCharIdx < aLen) t = setTimeout(() => setFuCharIdx(i => i + 1), AI_SPEED);
        else {
          const idx = activeFU;
          setCompletedFU(prev => [...prev, idx]);
          setActiveFU(null);
          setFuPhase(-1);
        }
        break;
    }
    return () => clearTimeout(t);
  }, [activeFU, fuPhase, fuCharIdx]);

  // --- Auto-scroll ---
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [step, charIdx, fuPhase, fuCharIdx, completedFU.length]);

  // --- Render helpers ---

  const cursor = (
    <span
      className="inline-block w-[3px] h-4 bg-slate-500 ml-0.5 align-text-bottom"
      style={{ animation: 'blink 1s step-end infinite' }}
    />
  );

  type Seg = { text: string; bold: boolean };
  const segLen = (segs: Seg[]) => segs.reduce((n, s) => n + s.text.length, 0);

  const renderSegs = (segs: Seg[], chars: number, showCur: boolean) => {
    let left = chars;
    return (
      <>
        {segs.map((seg, i) => {
          if (left <= 0) return null;
          const vis = seg.text.slice(0, left);
          left -= seg.text.length;
          return seg.bold
            ? <strong key={i} className="text-slate-900">{vis}</strong>
            : <span key={i}>{vis}</span>;
        })}
        {showCur && cursor}
      </>
    );
  };

  const renderR2 = (chars: number, showCur: boolean) => {
    const text = r2Text.slice(0, chars);
    const lines = text.split('\n');
    return (
      <div className="space-y-1.5">
        {lines.map((line, i) => {
          const isLast = i === lines.length - 1 && showCur;
          if (i === 0) return <p key={i}>{line}{isLast && cursor}</p>;
          return (
            <div key={i} className="flex items-start gap-2">
              <svg className="w-4 h-4 text-green-500 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              <span>{line}{isLast && cursor}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const aiAvatar = (
    <div className="w-7 h-7 rounded-full bg-slate-800 flex-shrink-0 flex items-center justify-center mt-0.5">
      <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2l1.5 8.5L22 12l-8.5 1.5L12 22l-1.5-8.5L2 12l8.5-1.5z" />
      </svg>
    </div>
  );

  const userAvatar = (
    <div className="w-7 h-7 rounded-full bg-blue-600 flex-shrink-0 flex items-center justify-center mt-0.5">
      <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
      </svg>
    </div>
  );

  const thinkingBubble = (
    <div className="chat-msg flex gap-2.5">
      {aiAvatar}
      <div className="flex items-center gap-2 py-1">
        <div className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-blue-500 animate-spin" />
        <span className="text-sm text-slate-400 italic">{t('chat.thinking')}</span>
      </div>
    </div>
  );

  // --- Computed: what's being typed in the input field ---
  const inputText =
    step === 1 ? q1.slice(0, charIdx) :
    step === 6 ? q2.slice(0, charIdx) :
    step === 11 ? q3.slice(0, charIdx) :
    (activeFU !== null && fuPhase === 0) ? FOLLOW_UPS[activeFU].q.slice(0, fuCharIdx) :
    '';

  // --- Computed: show suggestions when idle ---
  const usedIdxs = new Set(completedFU);
  const availableFU = FOLLOW_UPS.map((fu, i) => ({ ...fu, idx: i })).filter(f => !usedIdxs.has(f.idx)).slice(0, 3);
  const showSuggestions = step >= 15 && activeFU === null && availableFU.length > 0;

  const handleSuggestion = (idx: number) => {
    setActiveFU(idx);
    setFuPhase(0);
    setFuCharIdx(0);
  };

  return (
    <div className="relative w-full max-w-lg mx-auto">
      <style>{`
        @keyframes chatSlide { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        .chat-msg { animation: chatSlide 0.25s ease-out both; }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        .chat-scroll::-webkit-scrollbar { width: 4px; }
        .chat-scroll::-webkit-scrollbar-thumb { background: rgba(148,163,184,0.4); border-radius: 4px; }
        .chat-scroll::-webkit-scrollbar-track { background: transparent; }
      `}</style>
      {/* Glow */}
      <div className="absolute -inset-4 bg-gradient-to-br from-blue-100 via-transparent to-violet-100 rounded-3xl blur-2xl opacity-60" />
      <div className="relative bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
        {/* Header */}
        <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l1.5 8.5L22 12l-8.5 1.5L12 22l-1.5-8.5L2 12l8.5-1.5z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-slate-900">{t('chat.headerName')}</p>
        </div>

        {/* Scrollable messages */}
        <div ref={scrollRef} className="chat-scroll px-4 py-3 space-y-3 bg-[#fafafa] max-h-[380px] overflow-y-auto">

          {/* ── Q1 (appears after typing in input) ── */}
          {step >= 2 && (
            <div className="chat-msg flex gap-2.5">
              {userAvatar}
              <div>
                <p className="text-xs font-medium text-slate-500">{t('chat.you')}</p>
                <p className="text-base text-slate-800 mt-0.5">{q1}</p>
              </div>
            </div>
          )}

          {/* Thinking 1 */}
          {step === 3 && thinkingBubble}

          {/* ── A1 ── */}
          {step >= 4 && (
            <div className={step === 4 ? 'chat-msg flex gap-2.5' : 'flex gap-2.5'}>
              {aiAvatar}
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-500">{t('chat.headerName')}</p>
                <p className="text-base text-slate-700 mt-0.5 leading-relaxed">
                  {step === 4 ? renderSegs(r1Segs, charIdx, true) : renderSegs(r1Segs, r1Len, false)}
                </p>
              </div>
            </div>
          )}

          {/* ── Q2 ── */}
          {step >= 7 && (
            <div className="chat-msg flex gap-2.5">
              {userAvatar}
              <div>
                <p className="text-xs font-medium text-slate-500">{t('chat.you')}</p>
                <p className="text-base text-slate-800 mt-0.5">{q2}</p>
              </div>
            </div>
          )}

          {/* Thinking 2 */}
          {step === 8 && thinkingBubble}

          {/* ── A2 (benefits) ── */}
          {step >= 9 && (
            <div className={step === 9 ? 'chat-msg flex gap-2.5' : 'flex gap-2.5'}>
              {aiAvatar}
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-500">{t('chat.headerName')}</p>
                <div className="text-base text-slate-700 mt-0.5 leading-relaxed">
                  {step === 9 ? renderR2(charIdx, true) : renderR2(r2Text.length, false)}
                </div>
              </div>
            </div>
          )}

          {/* ── Q3 ── */}
          {step >= 12 && (
            <div className="chat-msg flex gap-2.5">
              {userAvatar}
              <div>
                <p className="text-xs font-medium text-slate-500">{t('chat.you')}</p>
                <p className="text-base text-slate-800 mt-0.5">{q3}</p>
              </div>
            </div>
          )}

          {/* Thinking 3 */}
          {step === 13 && thinkingBubble}

          {/* ── A3 ── */}
          {step >= 14 && (
            <div className={step === 14 ? 'chat-msg flex gap-2.5' : 'flex gap-2.5'}>
              {aiAvatar}
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-500">{t('chat.headerName')}</p>
                <p className="text-base text-slate-700 mt-0.5 leading-relaxed">
                  {step === 14 ? renderSegs(r3Segs, charIdx, true) : renderSegs(r3Segs, r3Len, false)}
                </p>
              </div>
            </div>
          )}

          {/* ── Completed follow-ups ── */}
          {completedFU.flatMap(idx => [
            <div key={`fu-q-${idx}`} className="flex gap-2.5">
              {userAvatar}
              <div>
                <p className="text-xs font-medium text-slate-500">{t('chat.you')}</p>
                <p className="text-base text-slate-800 mt-0.5">{FOLLOW_UPS[idx].q}</p>
              </div>
            </div>,
            <div key={`fu-a-${idx}`} className="flex gap-2.5">
              {aiAvatar}
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-500">{t('chat.headerName')}</p>
                <p className="text-base text-slate-700 mt-0.5 leading-relaxed">
                  {renderSegs(FOLLOW_UPS[idx].segs, segLen(FOLLOW_UPS[idx].segs), false)}
                </p>
              </div>
            </div>,
          ])}

          {/* ── Active follow-up ── */}
          {activeFU !== null && fuPhase >= 1 && (
            <div className="chat-msg flex gap-2.5">
              {userAvatar}
              <div>
                <p className="text-xs font-medium text-slate-500">{t('chat.you')}</p>
                <p className="text-base text-slate-800 mt-0.5">{FOLLOW_UPS[activeFU].q}</p>
              </div>
            </div>
          )}
          {activeFU !== null && fuPhase === 2 && thinkingBubble}
          {activeFU !== null && fuPhase >= 3 && (
            <div className="chat-msg flex gap-2.5">
              {aiAvatar}
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-500">{t('chat.headerName')}</p>
                <p className="text-base text-slate-700 mt-0.5 leading-relaxed">
                  {renderSegs(FOLLOW_UPS[activeFU].segs, fuCharIdx, true)}
                </p>
              </div>
            </div>
          )}

          {/* ── Learn more suggestions ── */}
          {showSuggestions && (
            <div className="chat-msg pt-2 pb-1">
              <p className="text-xs font-medium text-slate-400 mb-2">{t('chat.learnMore')}</p>
              <div className="flex flex-wrap gap-1.5">
                {availableFU.map(fu => (
                  <button
                    key={fu.idx}
                    onClick={() => handleSuggestion(fu.idx)}
                    className="px-3 py-1.5 text-sm font-medium bg-white border border-slate-200 rounded-full text-blue-600 hover:bg-blue-50 hover:border-blue-200 transition-colors cursor-pointer"
                  >
                    {fu.q}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Live input field — shows text being typed, then clears on send */}
        <div className="px-3 pb-3 pt-2 bg-[#fafafa] border-t border-slate-100">
          <div className="flex items-center gap-2 px-3 py-2.5 bg-white rounded-xl border border-slate-200">
            {inputText ? (
              <span className="text-base text-slate-800 flex-1">
                {inputText}{cursor}
              </span>
            ) : (
              <span className="text-base text-slate-400 flex-1">{t('chat.inputPlaceholder')}</span>
            )}
            <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${inputText ? 'bg-slate-800' : 'bg-slate-100'}`}>
              <svg className={`w-3.5 h-3.5 ${inputText ? 'text-white' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Stats + Featured profiles from /api/humans/featured */
function FeaturedSection() {
  const { t } = useTranslation();
  const [data, setData] = useState<{
    stats: { verifiedHumans: number; withSkills: number; countries: number };
    featured: Array<{ id: string; name: string; location?: string; skills: string[]; bio?: string; profilePhotoUrl?: string }>;
  } | null>(null);

  useEffect(() => {
    fetch('/api/humans/featured')
      .then(r => r.json())
      .then(d => { if (d.stats) setData(d); })
      .catch(() => {});
  }, []);

  if (!data) return null;

  const { stats, featured } = data;

  return (
    <section className="py-16 bg-white px-4">
      <div className="max-w-5xl mx-auto">
        {/* Stats counters */}
        <div className="grid grid-cols-2 gap-6 mb-12 max-w-md mx-auto">
          <div className="text-center">
            <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900">{stats.withSkills.toLocaleString()}+</p>
            <p className="text-sm text-slate-500 mt-1">{t('landing.stats.withSkills', { defaultValue: 'Skills listed' })}</p>
          </div>
          <div className="text-center">
            <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900">{stats.countries}</p>
            <p className="text-sm text-slate-500 mt-1">{t('landing.stats.countries', { defaultValue: 'Countries' })}</p>
          </div>
        </div>

        {/* Featured profiles */}
        {featured.length > 0 && (
          <>
            <h2 className="text-lg sm:text-2xl md:text-3xl font-bold text-center text-slate-900 mb-8">
              {t('landing.featured.title', { defaultValue: 'Real people, ready to work' })}
            </h2>
            <div className="flex flex-wrap justify-center gap-4">
              {featured.map((h) => (
                <Link
                  key={h.id}
                  to={`/humans/${h.id}`}
                  className="group p-3 sm:p-4 rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all text-center min-w-0 w-[calc(50%-0.5rem)] md:w-[calc(25%-0.75rem)]"
                >
                  {h.profilePhotoUrl ? (
                    <img
                      src={h.profilePhotoUrl}
                      alt={h.name}
                      className="w-16 h-16 rounded-full mx-auto mb-3 object-cover ring-2 ring-slate-100 group-hover:ring-blue-200 transition-all"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full mx-auto mb-3 bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xl">
                      {(h.name || '?').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <h3 className="font-medium text-slate-900 text-sm truncate">{h.name}</h3>
                  {h.location && (
                    <p className="text-xs text-slate-400 mt-0.5 truncate">{h.location}</p>
                  )}
                  <div className="flex flex-wrap justify-center gap-1 mt-2">
                    {h.skills.slice(0, 2).map((s) => (
                      <span key={s} className="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">{s}</span>
                    ))}
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

/** Live listing cards fetched from the API */
function LiveListingCards() {
  const { t } = useTranslation();
  const [listings, setListings] = useState<Listing[]>([]);

  useEffect(() => {
    api.getListings({ limit: 3 })
      .then(data => { if (data.listings?.length) setListings(data.listings); })
      .catch(() => {});
  }, []);

  if (!listings.length) return null;

  return (
    <>
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        {listings.map((card) => (
          <Link
            key={card.id}
            to={`/listings/${card.id}`}
            className={`block p-5 rounded-xl border transition-shadow hover:shadow-md ${
              card.isPro ? 'border-amber-200 bg-amber-50/30' : 'border-slate-200 bg-white'
            }`}
          >
            <div className="flex items-start justify-between gap-2 min-w-0">
              <h3 className="font-medium text-slate-900 min-w-0 break-words">{card.title}</h3>
              {card.isPro && (
                <span className="shrink-0 text-xs font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">PRO</span>
              )}
            </div>
            <p className="text-2xl font-bold text-green-600 mt-2">${card.budgetUsdc} <span className="text-sm font-normal text-slate-400">USDC</span></p>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {card.requiredSkills.slice(0, 4).map((s) => (
                <span key={s} className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md">{s}</span>
              ))}
              {card.requiredSkills.length > 4 && (
                <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-400 rounded-md">+{card.requiredSkills.length - 4}</span>
              )}
            </div>
            <div className="flex items-center justify-between mt-3">
              <p className="text-xs text-slate-400">{card.agent?.name || t('common.agent')}</p>
              {card._count && <p className="text-xs text-slate-400">{card._count.applications} {t('landing.jobBoard.applicants', { defaultValue: 'applicants' })}</p>}
            </div>
          </Link>
        ))}
      </div>

      <div className="text-center">
        <Link
          to="/listings"
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/25"
        >
          {t('landing.jobBoard.browseCta')}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </Link>
      </div>
    </>
  );
}

/** Mockup of a job offer notification */
function JobOfferMockup() {
  return (
    <div className="relative w-full max-w-sm mx-auto">
      <div className="absolute -inset-4 bg-gradient-to-br from-green-100 via-transparent to-blue-100 rounded-3xl blur-2xl opacity-60" />
      <div className="relative bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
        <div className="px-6 py-5">
          <div className="flex items-center gap-2 mb-3">
            <BoltIcon className="w-5 h-5 text-amber-500" />
            <span className="text-sm font-medium text-amber-600">New job offer</span>
          </div>
          <h3 className="font-semibold text-slate-900">Photograph 5 storefronts</h3>
          <p className="text-sm text-slate-500 mt-1">Brooklyn, NY — 5 exterior photos needed for a local business directory update.</p>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-2xl font-bold text-slate-900">$150</span>
            <span className="text-xs text-slate-400">one-time task</span>
          </div>
          <div className="mt-4 flex gap-2">
            <div className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg text-center">Accept</div>
            <div className="flex-1 py-2 bg-slate-100 text-slate-600 text-sm font-medium rounded-lg text-center">Decline</div>
          </div>
          <p className="text-xs text-slate-400 mt-3 text-center">From: agent-47x · Paid on completion</p>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const { t } = useTranslation();
  const heroTick = useHeroTick();

  const TASKS = [
    { icon: CameraIcon, title: t('landing.tasks.photography'), description: t('landing.tasks.photographyDesc') },
    { icon: MagnifyingGlassIcon, title: t('landing.tasks.research'), description: t('landing.tasks.researchDesc') },
    { icon: PhoneIcon, title: t('landing.tasks.phoneCalls'), description: t('landing.tasks.phoneCallsDesc') },
    { icon: TruckIcon, title: t('landing.tasks.deliveries'), description: t('landing.tasks.deliveriesDesc') },
    { icon: WrenchScrewdriverIcon, title: t('landing.tasks.handyman'), description: t('landing.tasks.handymanDesc') },
    { icon: BuildingStorefrontIcon, title: t('landing.tasks.mysteryShopping'), description: t('landing.tasks.mysteryShoppingDesc') },
  ];

  const BENEFITS = [
    { title: t('landing.benefits.findWork'), description: t('landing.benefits.findWorkDesc') },
    { title: t('landing.benefits.keepEarnings'), description: t('landing.benefits.keepEarningsDesc') },
    { title: t('landing.benefits.oneProfile'), description: t('landing.benefits.oneProfileDesc') },
  ];

  const TRUST_ITEMS = [
    { icon: BanknotesIcon, text: t('landing.trust.dataPrivacy') },
    { icon: EyeSlashIcon, text: t('landing.trust.visibility') },
    { icon: ChatBubbleLeftRightIcon, text: t('landing.trust.contact') },
  ];

  const FAQS = [
    { q: t('landing.faq.whatIs'), a: t('landing.faq.whatIsAnswer') },
    { q: t('landing.faq.howHired'), a: t('landing.faq.howHiredAnswer') },
    { q: t('landing.faq.howPaid'), a: t('landing.faq.howPaidAnswer') },
    { q: t('landing.faq.available'), a: t('landing.faq.availableAnswer') },
    { q: t('landing.faq.free'), a: t('landing.faq.freeAnswer') },
  ];

  const HOW_IT_WORKS = [
    { icon: UserPlusIcon, title: t('landing.howItWorks.step1Title'), description: t('landing.howItWorks.step1Desc') },
    { icon: BoltIcon, title: t('landing.howItWorks.step2Title'), description: t('landing.howItWorks.step2Desc') },
    { icon: BanknotesIcon, title: t('landing.howItWorks.step3Title'), description: t('landing.howItWorks.step3Desc') },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <SEO
        path="/"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Organization",
          "name": "Human Pages",
          "alternateName": "HumanPages.ai",
          "url": "https://humanpages.ai",
          "logo": "https://humanpages.ai/logo-192.png",
          "description": "The marketplace where AI agents hire humans for real-world tasks. Photography, deliveries, research, and more — zero platform fees.",
          "foundingDate": "2025",
          "sameAs": [...SOCIAL_URLS],
          "contactPoint": {
            "@type": "ContactPoint",
            "contactType": "customer support",
            "url": "https://humanpages.ai/about",
            "availableLanguage": ["English", "Spanish", "French", "Portuguese", "Chinese", "Hindi", "Vietnamese", "Turkish", "Thai", "Filipino"]
          },
          "areaServed": "Worldwide",
          "knowsAbout": ["AI agents", "freelance marketplace", "gig economy", "human-AI collaboration", "real-world tasks"]
        }}
      />
      <SEO
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Service",
          "name": "Human Pages AI-to-Human Task Marketplace",
          "provider": {
            "@type": "Organization",
            "name": "Human Pages",
            "url": "https://humanpages.ai"
          },
          "description": "AI agents discover and hire verified humans for real-world tasks including photography, deliveries, research, phone calls, handyman work, and mystery shopping. Humans list their skills for free and keep 100% of their earnings.",
          "serviceType": "AI-to-Human Task Marketplace",
          "areaServed": "Worldwide",
          "audience": {
            "@type": "Audience",
            "audienceType": "Freelancers, gig workers, and AI agent developers"
          },
          "offers": [
            {
              "@type": "Offer",
              "name": "Free Listing",
              "price": "0",
              "priceCurrency": "USD",
              "description": "List your skills for free. No platform fees — keep 100% of your earnings."
            },
            {
              "@type": "Offer",
              "name": "Pro Agent Activation",
              "price": "5",
              "priceCurrency": "USD",
              "description": "Enhanced API access for AI agents with higher rate limits and 60-day activation."
            }
          ],
          "hasOfferCatalog": {
            "@type": "OfferCatalog",
            "name": "Task Categories",
            "itemListElement": [
              { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Photography" } },
              { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Deliveries & Pickups" } },
              { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Research & Surveys" } },
              { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Phone Calls" } },
              { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Handyman Work" } },
              { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Mystery Shopping" } }
            ]
          }
        }}
      />
      <SEO
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": FAQS.map(faq => ({
            "@type": "Question",
            "name": faq.q,
            "acceptedAnswer": {
              "@type": "Answer",
              "text": faq.a
            }
          }))
        }}
      />
      <SEO
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://humanpages.ai/" },
            { "@type": "ListItem", "position": 2, "name": "Job Board", "item": "https://humanpages.ai/listings" },
            { "@type": "ListItem", "position": 3, "name": "Developers", "item": "https://humanpages.ai/dev" },
            { "@type": "ListItem", "position": 4, "name": "Blog", "item": "https://humanpages.ai/blog" }
          ]
        }}
      />
      <SEO
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "WebApplication",
          "name": "Human Pages",
          "url": "https://humanpages.ai",
          "applicationCategory": "BusinessApplication",
          "operatingSystem": "Web",
          "description": "AI-to-human marketplace where AI agents discover and hire verified humans for real-world tasks. Zero platform fees, direct USDC payments.",
          "offers": {
            "@type": "Offer",
            "price": "0",
            "priceCurrency": "USD",
            "description": "Free to list — humans keep 100% of earnings"
          }
        }}
      />

      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
          <Link to="/"><Logo /></Link>
          <div className="flex items-center gap-4 md:gap-6">
            <Link to="/" className="text-sm font-medium text-slate-900 hidden sm:inline">
              {t('nav.humans')}
            </Link>
            <Link to="/dev" className="text-sm text-slate-500 hover:text-slate-700 hidden sm:inline">
              {t('nav.developers')}
            </Link>
            <Link to="/listings" className="text-sm text-slate-500 hover:text-slate-700 hidden sm:inline">
              {t('nav.jobBoard')}
            </Link>
            <Link to="/blog" className="text-sm text-slate-500 hover:text-slate-700 hidden sm:inline">
              {t('nav.blog')}
            </Link>
            <LanguageSwitcher />
            <Link
              to="/signup"
              className="px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors whitespace-nowrap"
            >
              {t('nav.startProfile')}
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="py-10 md:py-24 px-4 bg-white overflow-hidden">
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-2 gap-6 md:gap-16 items-center">
              {/* Left: copy */}
              <div>
                <span className="inline-flex items-center px-3 py-1 bg-blue-50 text-blue-700 text-sm font-medium rounded-full mb-4">
                  {t('landing.hero.tagline')}
                </span>
                <h1 className="text-xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 leading-tight">
                  <RotatingHeadline tick={heroTick.tick} visible={heroTick.visible} />
                  <span className="block mt-1">{t('landing.hero.titleLine2Rotating')}</span>
                  <span className="hidden sm:block mt-2 text-sm sm:text-base md:text-lg lg:text-xl font-medium text-slate-500">
                    {t('landing.hero.h1Keyword')}
                  </span>
                </h1>
                <p className="mt-3 md:mt-4 text-base sm:text-lg md:text-xl text-slate-600">
                  {t('landing.hero.subtitle')}
                </p>
                <p className="hidden sm:block mt-3 text-sm text-slate-500 italic">
                  {t('landing.hero.example')}
                </p>
                <div className="mt-6 md:mt-8 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 sm:gap-4">
                  <Link
                    to="/signup"
                    className="inline-block px-4 sm:px-6 md:px-8 py-3 sm:py-3.5 md:py-4 bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-600 transition-colors text-base sm:text-lg shadow-lg shadow-orange-500/25 text-center"
                  >
                    {t('landing.hero.cta')}
                  </Link>
                  <Link
                    to="/listings"
                    className="hidden sm:inline-block px-6 sm:px-8 py-3 sm:py-4 border-2 border-slate-300 text-slate-700 font-semibold rounded-lg hover:border-slate-400 hover:bg-slate-50 transition-colors text-base sm:text-lg text-center"
                  >
                    {t('landing.hero.browseListings')}
                  </Link>
                </div>
                <div className="mt-3">
                  <span className="inline-flex items-center px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-full">
                    {t('landing.hero.ctaBadge')}
                  </span>
                </div>
                <p className="hidden sm:block mt-4 text-slate-400 text-sm">
                  {t('landing.hero.flow')}
                </p>
              </div>
              {/* Right: ChatGPT conversation mockup */}
              <div className="hidden md:block">
                <MockChatConversation />
              </div>
            </div>
          </div>
        </section>

        {/* How it works — 3-step visual */}
        <section className="py-16 bg-slate-50 px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-lg sm:text-2xl md:text-3xl font-bold text-center text-slate-900 mb-12">
              {t('landing.howItWorks.title')}
            </h2>
            <div className="grid md:grid-cols-3 gap-8 relative">
              {/* Connector line (desktop) */}
              <div className="hidden md:block absolute top-12 left-[16.7%] right-[16.7%] h-0.5 bg-gradient-to-r from-blue-200 via-blue-300 to-blue-200" />
              {HOW_IT_WORKS.map((step, i) => (
                <div key={i} className="relative text-center">
                  <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-white border-2 border-blue-100 shadow-sm mb-4 relative z-10">
                    <step.icon className="w-10 h-10 text-blue-600" />
                  </div>
                  <div className="absolute -top-2 -right-2 md:top-0 md:right-auto md:left-1/2 md:ml-8 w-6 h-6 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center z-20">
                    {i + 1}
                  </div>
                  <h3 className="font-semibold text-slate-900 text-lg">{step.title}</h3>
                  <p className="mt-2 text-slate-600 text-sm">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Stats + Featured Profiles */}
        <FeaturedSection />

        {/* Job Board showcase */}
        <section className="py-16 bg-slate-50 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <span className="inline-flex items-center px-3 py-1 bg-green-50 text-green-700 text-sm font-medium rounded-full mb-4">
                {t('listings.title')}
              </span>
              <h2 className="text-lg sm:text-2xl md:text-3xl font-bold text-slate-900">
                {t('landing.jobBoard.title')}
              </h2>
              <p className="mt-3 text-slate-600 max-w-2xl mx-auto">
                {t('landing.jobBoard.subtitle')}
              </p>
            </div>

            <LiveListingCards />
          </div>
        </section>

        {/* Job offer mockup + example */}
        <section className="py-16 bg-slate-50 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <JobOfferMockup />
              </div>
              <div>
                <h2 className="text-lg sm:text-2xl md:text-3xl font-bold text-slate-900">
                  {t('landing.tasks.title')}
                </h2>
                <p className="mt-2 text-slate-600 mb-6">
                  {t('landing.tasks.subtitle')}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {TASKS.map((task) => (
                    <div
                      key={task.title}
                      className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex-shrink-0 w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
                        <task.icon className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-medium text-slate-900 text-sm">{task.title}</h3>
                        <p className="text-xs text-slate-500 leading-relaxed">{task.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Why list — benefits */}
        <section className="py-16 px-4 bg-white">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-lg sm:text-2xl md:text-3xl font-bold text-center text-slate-900 mb-12">
              {t('landing.benefits.title')}
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              {BENEFITS.map((benefit, i) => (
                <div key={i} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center mb-4">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-slate-900 text-lg">{benefit.title}</h3>
                  <p className="mt-2 text-slate-600 text-sm">{benefit.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Mid CTA — early mover (hidden) */}
        <section className="py-16 bg-gradient-to-r from-blue-600 to-blue-700 px-4 hidden">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-white">
              {t('landing.cta.ready')}
            </h2>
            <p className="mt-3 text-blue-100 text-lg">
              {t('landing.cta.createListing')}
            </p>
            <Link
              to="/signup"
              className="mt-8 inline-block px-8 py-4 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors shadow-lg"
            >
              {t('landing.hero.cta')}
            </Link>
          </div>
        </section>

        {/* Trust & Controls */}
        <section className="py-16 px-4 bg-white">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-lg sm:text-2xl md:text-3xl font-bold text-center text-slate-900 mb-12">
              {t('landing.trust.title')}
            </h2>
            <div className="grid md:grid-cols-3 gap-4">
              {TRUST_ITEMS.map((item, i) => (
                <div key={i} className="flex flex-col items-center text-center p-6 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-3">
                    <item.icon className="w-6 h-6 text-blue-600" />
                  </div>
                  <p className="text-slate-700 text-sm">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-16 bg-slate-50 px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-lg sm:text-2xl md:text-3xl font-bold text-center text-slate-900 mb-12">
              {t('landing.faq.title')}
            </h2>
            <div className="bg-white rounded-xl border border-slate-200 px-6 shadow-sm">
              {FAQS.map((faq, i) => (
                <FAQItem key={i} q={faq.q} a={faq.a} />
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA (hidden) */}
        <section className="py-16 px-4 bg-white hidden">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-lg sm:text-2xl md:text-3xl font-bold text-slate-900">
              {t('landing.cta.startGetting')}
            </h2>
            <p className="mt-2 text-slate-600">
              {t('landing.cta.letOpportunities')}
            </p>
            <Link
              to="/signup"
              className="mt-6 inline-block px-6 sm:px-8 py-3 sm:py-4 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/25"
            >
              {t('landing.hero.cta')}
            </Link>
          </div>
        </section>
      </main>

      <Footer />

      {/* Sticky Mobile CTA (hidden) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 p-4 bg-white/80 backdrop-blur-md border-t border-slate-200 md:hidden safe-area-pb hidden">
        <Link
          to="/signup"
          className="block w-full text-center px-6 py-3.5 bg-orange-500 text-white text-lg font-bold rounded-xl hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/30"
        >
          {t('landing.hero.cta')}
        </Link>
      </div>

      {/* Spacer for mobile sticky CTA */}
      <div className="h-24 md:hidden" />
    </div>
  );
}
