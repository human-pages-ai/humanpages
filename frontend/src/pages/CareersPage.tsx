import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import Link from '../components/LocalizedLink';
import Logo from '../components/Logo';
import SEO from '../components/SEO';
import Footer from '../components/Footer';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useAuth } from '../hooks/useAuth';
import { setApplyIntent, getApplyIntent, clearApplyIntent } from '../lib/applyIntent';
import { analytics } from '../lib/analytics';
import { api } from '../lib/api';
import { POSITIONS, CATEGORIES, GENERAL_APPLICATION, type Position, type Category } from '../data/positions';
import {
  GlobeAltIcon,
  ClockIcon,
  RocketLaunchIcon,
  AcademicCapIcon,
  SparklesIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  XMarkIcon,
  UserCircleIcon,
  DocumentCheckIcon,
  HandThumbUpIcon,
  LinkIcon,
} from '@heroicons/react/24/outline';
import { safeLocalStorage, safeSessionStorage } from '../lib/safeStorage';

// ─── Inline SVG Illustrations ────────────────────────────────────────────────

function HeroIllustration() {
  return (
    <svg viewBox="0 0 480 320" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full max-w-lg" aria-hidden="true">
      <ellipse cx="240" cy="160" rx="220" ry="140" fill="#EFF6FF" />
      <ellipse cx="160" cy="200" rx="80" ry="60" fill="#DBEAFE" opacity="0.6" />
      <ellipse cx="340" cy="120" rx="70" ry="50" fill="#FFF7ED" opacity="0.7" />
      <circle cx="240" cy="150" r="70" stroke="#3B82F6" strokeWidth="2" fill="none" opacity="0.3" />
      <ellipse cx="240" cy="150" rx="70" ry="25" stroke="#3B82F6" strokeWidth="1.5" fill="none" opacity="0.2" />
      <line x1="240" y1="80" x2="240" y2="220" stroke="#3B82F6" strokeWidth="1.5" opacity="0.2" />
      <circle cx="110" cy="120" r="18" fill="#F97316" opacity="0.9" />
      <circle cx="110" cy="112" r="8" fill="#FFF" />
      <rect x="104" y="122" width="12" height="14" rx="4" fill="#FFF" opacity="0.8" />
      <line x1="110" y1="150" x2="190" y2="150" stroke="#F97316" strokeWidth="2" strokeDasharray="4 4" opacity="0.5" />
      <circle cx="370" cy="130" r="18" fill="#3B82F6" opacity="0.9" />
      <circle cx="370" cy="122" r="8" fill="#FFF" />
      <rect x="364" y="132" width="12" height="14" rx="4" fill="#FFF" opacity="0.8" />
      <line x1="370" y1="160" x2="290" y2="155" stroke="#3B82F6" strokeWidth="2" strokeDasharray="4 4" opacity="0.5" />
      <circle cx="200" cy="240" r="18" fill="#10B981" opacity="0.9" />
      <circle cx="200" cy="232" r="8" fill="#FFF" />
      <rect x="194" y="242" width="12" height="14" rx="4" fill="#FFF" opacity="0.8" />
      <line x1="200" y1="220" x2="230" y2="180" stroke="#10B981" strokeWidth="2" strokeDasharray="4 4" opacity="0.5" />
      <circle cx="310" cy="230" r="18" fill="#8B5CF6" opacity="0.9" />
      <circle cx="310" cy="222" r="8" fill="#FFF" />
      <rect x="304" y="232" width="12" height="14" rx="4" fill="#FFF" opacity="0.8" />
      <line x1="310" y1="212" x2="260" y2="175" stroke="#8B5CF6" strokeWidth="2" strokeDasharray="4 4" opacity="0.5" />
      <path d="M230 145 L240 135 L250 145 L240 155 Z" fill="#F97316" opacity="0.8" />
      <circle cx="240" cy="145" r="4" fill="#FFF" />
      <rect x="80" y="180" width="10" height="10" rx="2" fill="#3B82F6" opacity="0.3" transform="rotate(15 85 185)" />
      <rect x="380" y="80" width="8" height="8" rx="2" fill="#F97316" opacity="0.3" transform="rotate(-10 384 84)" />
      <circle cx="150" cy="80" r="4" fill="#10B981" opacity="0.4" />
      <circle cx="350" cy="230" r="3" fill="#F97316" opacity="0.4" />
    </svg>
  );
}

function TeamIllustration() {
  return (
    <svg viewBox="0 0 400 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full max-w-md mx-auto" aria-hidden="true">
      <rect x="20" y="20" width="360" height="160" rx="16" fill="#F8FAFC" />
      <path d="M120 100 C160 70, 200 70, 240 100" stroke="#3B82F6" strokeWidth="2" fill="none" strokeDasharray="6 3" />
      <path d="M240 100 C280 130, 200 130, 160 100" stroke="#F97316" strokeWidth="2" fill="none" strokeDasharray="6 3" />
      <circle cx="100" cy="100" r="24" fill="#EFF6FF" stroke="#3B82F6" strokeWidth="2" />
      <circle cx="100" cy="92" r="9" fill="#3B82F6" />
      <path d="M86 108 C86 102, 114 102, 114 108" fill="#3B82F6" opacity="0.6" />
      <circle cx="200" cy="80" r="24" fill="#FFF7ED" stroke="#F97316" strokeWidth="2" />
      <circle cx="200" cy="72" r="9" fill="#F97316" />
      <path d="M186 88 C186 82, 214 82, 214 88" fill="#F97316" opacity="0.6" />
      <circle cx="300" cy="100" r="24" fill="#F0FDF4" stroke="#10B981" strokeWidth="2" />
      <circle cx="300" cy="92" r="9" fill="#10B981" />
      <path d="M286 108 C286 102, 314 102, 314 108" fill="#10B981" opacity="0.6" />
      <path d="M155 82 L160 76 L165 82 L160 88 Z" fill="#FBBF24" opacity="0.7" />
      <path d="M245 82 L250 76 L255 82 L250 88 Z" fill="#FBBF24" opacity="0.7" />
      <text x="200" y="155" textAnchor="middle" fill="#64748B" fontSize="12" fontFamily="system-ui">Learn together, grow together</text>
    </svg>
  );
}

// ─── Small Components ────────────────────────────────────────────────────────

function PerksInfographic() {
  const perks = [
    { icon: <GlobeAltIcon className="w-6 h-6" />, label: 'Work from\nanywhere', color: 'text-blue-600 bg-blue-50' },
    { icon: <ClockIcon className="w-6 h-6" />, label: 'Any time\nzone', color: 'text-orange-500 bg-orange-50' },
    { icon: <RocketLaunchIcon className="w-6 h-6" />, label: 'Growth\nopportunities', color: 'text-emerald-600 bg-emerald-50' },
    { icon: <AcademicCapIcon className="w-6 h-6" />, label: 'Learn from\nexperts', color: 'text-purple-600 bg-purple-50' },
    { icon: <SparklesIcon className="w-6 h-6" />, label: 'Results over\nresumes', color: 'text-pink-600 bg-pink-50' },
  ];

  return (
    <div className="flex flex-wrap justify-center gap-4 md:gap-8">
      {perks.map((p, i) => (
        <div key={i} className="flex flex-col items-center gap-2 w-28">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center ${p.color} transition-transform hover:scale-110`}>
            {p.icon}
          </div>
          <span className="text-xs text-center text-slate-600 font-medium whitespace-pre-line leading-tight">{p.label}</span>
        </div>
      ))}
    </div>
  );
}

function ProcessSteps() {
  const steps = [
    { icon: <UserCircleIcon className="w-6 h-6" />, title: 'Create a profile', desc: '30 seconds with Google or LinkedIn', color: 'bg-blue-50 text-blue-600' },
    { icon: <DocumentCheckIcon className="w-6 h-6" />, title: 'Answer 1 question', desc: 'What excites you about the role?', color: 'bg-orange-50 text-orange-500' },
    { icon: <HandThumbUpIcon className="w-6 h-6" />, title: 'We\'ll be in touch', desc: 'We review every application personally', color: 'bg-emerald-50 text-emerald-600' },
  ];

  return (
    <div className="flex flex-col md:flex-row items-center gap-4 md:gap-0">
      {steps.map((s, i) => (
        <div key={i} className="flex items-center">
          <div className="flex flex-col items-center text-center w-48">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${s.color} mb-2`}>
              {s.icon}
            </div>
            <div className="text-sm font-semibold text-slate-900">{s.title}</div>
            <div className="text-xs text-slate-500 mt-0.5">{s.desc}</div>
          </div>
          {i < steps.length - 1 && (
            <ArrowRightIcon className="w-5 h-5 text-slate-300 hidden md:block mx-2 shrink-0" />
          )}
        </div>
      ))}
    </div>
  );
}

function StatsBar() {
  const stats = [
    { value: '100%', label: 'Remote' },
    { value: '10+', label: 'Countries' },
    { value: '0', label: 'CVs Required' },
    { value: '∞', label: 'Growth Potential' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
      {stats.map((s, i) => (
        <div key={i} className="text-center">
          <div className="text-2xl md:text-3xl font-bold text-white">{s.value}</div>
          <div className="text-xs text-slate-400 mt-1">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

function TeamQuote({ quote, name, role }: { quote: string; name: string; role: string }) {
  return (
    <blockquote className="bg-white rounded-2xl border border-slate-200 p-6">
      <p className="text-slate-600 text-sm italic leading-relaxed mb-4">"{quote}"</p>
      <footer className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-100 to-orange-100 flex items-center justify-center text-sm font-bold text-slate-600">
          {name.split(' ').map(n => n[0]).join('')}
        </div>
        <div>
          <div className="text-sm font-medium text-slate-900">{name}</div>
          <div className="text-xs text-slate-500">{role}</div>
        </div>
      </footer>
    </blockquote>
  );
}

// ─── Referral Share Section (post-apply success) ─────────────────────────────

function ReferralShareSection({ referralCode }: { referralCode: string | null }) {
  const [copied, setCopied] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 500);
    return () => clearTimeout(timer);
  }, []);

  if (!referralCode) return null;

  const referralUrl = `${window.location.origin}/signup?ref=${referralCode}`;

  const shareMessages = {
    whatsapp: `Hey! Just applied to this really cool platform where AI agents actually hire people for real-world tasks. Thought you might be into it too 👀\n\n${referralUrl}`,
    facebook: `Just discovered this platform where AI agents hire real humans for tasks — and I just applied to join. Pretty wild concept, check it out if you're curious!`,
    linkedin: `Came across an interesting new platform — HumanPages connects AI agents with real people for tasks that need a human touch. Just applied, and thought my network might find it worth a look.`,
  };

  const shareLinks = {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(shareMessages.whatsapp)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralUrl)}&quote=${encodeURIComponent(shareMessages.facebook)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(referralUrl)}`,
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      analytics.track('careers_referral_copy', { source: 'apply_success' });
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard may fail in some contexts */ }
  };

  const handleShare = (platform: string) => {
    analytics.track('careers_referral_share', { platform, source: 'apply_success' });
  };

  return (
    <div
      className={`mt-6 pt-6 border-t border-slate-100 transition-all duration-500 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
    >
      <div className="space-y-4">
        {/* Header */}
        <div className="text-center space-y-1">
          <p className="text-sm font-semibold text-slate-900">Know someone who'd be a great fit?</p>
          <p className="text-xs text-slate-500">Share your link and earn credits when friends sign up</p>
        </div>

        {/* Copy link */}
        <div className="bg-blue-50/70 rounded-xl p-3 space-y-2">
          <div className="flex gap-2">
            <div className="flex-1 min-w-0 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-600 font-mono truncate">
              {referralUrl}
            </div>
            <button
              onClick={handleCopy}
              className={`shrink-0 px-3 py-2 text-xs font-medium rounded-lg transition-all duration-150 flex items-center gap-1.5 ${
                copied
                  ? 'bg-emerald-500 text-white'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {copied ? (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy
                </>
              )}
            </button>
          </div>
        </div>

        {/* Social share buttons */}
        <div className="grid grid-cols-3 gap-2">
          <a
            href={shareLinks.whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => handleShare('whatsapp')}
            className="flex items-center justify-center gap-1.5 p-2.5 rounded-lg border border-slate-200 hover:bg-emerald-50 hover:border-emerald-200 transition-colors group"
          >
            <svg className="w-4 h-4 text-slate-500 group-hover:text-emerald-600 transition-colors" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            <span className="text-xs text-slate-600 group-hover:text-emerald-700">WhatsApp</span>
          </a>
          <a
            href={shareLinks.facebook}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => handleShare('facebook')}
            className="flex items-center justify-center gap-1.5 p-2.5 rounded-lg border border-slate-200 hover:bg-blue-50 hover:border-blue-200 transition-colors group"
          >
            <svg className="w-4 h-4 text-slate-500 group-hover:text-blue-600 transition-colors" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
            <span className="text-xs text-slate-600 group-hover:text-blue-700">Facebook</span>
          </a>
          <a
            href={shareLinks.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => handleShare('linkedin')}
            className="flex items-center justify-center gap-1.5 p-2.5 rounded-lg border border-slate-200 hover:bg-sky-50 hover:border-sky-200 transition-colors group"
          >
            <svg className="w-4 h-4 text-slate-500 group-hover:text-sky-700 transition-colors" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
            <span className="text-xs text-slate-600 group-hover:text-sky-800">LinkedIn</span>
          </a>
        </div>

        {/* Reward tiers — compact */}
        <div className="bg-gradient-to-br from-emerald-50/80 to-emerald-50/30 rounded-xl p-3">
          <p className="text-[10px] font-medium text-emerald-800 uppercase tracking-wider mb-2">Reward milestones</p>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-1">
              <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                <span className="text-[9px] font-bold text-white">10</span>
              </div>
              <span className="text-[11px] text-slate-700">credits / signup</span>
            </div>
            <div className="w-px h-4 bg-slate-200" />
            <div className="flex items-center gap-1.5 flex-1 justify-center">
              <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                <span className="text-[9px] font-bold text-white">+50</span>
              </div>
              <span className="text-[11px] text-slate-700">at 10 referrals</span>
            </div>
            <div className="w-px h-4 bg-slate-200" />
            <div className="flex items-center gap-1.5 flex-1 justify-end">
              <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center shrink-0">
                <span className="text-[9px] font-bold text-white">+500</span>
              </div>
              <span className="text-[11px] text-slate-700">at 100 referrals</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Apply Modal ─────────────────────────────────────────────────────────────

type ApplyStep = 'intro' | 'form' | 'success';

interface ApplyModalProps {
  position: Position | null;
  onClose: () => void;
}

function ApplyModal({ position, onClose }: ApplyModalProps) {
  const { user, loginWithLinkedIn, loginWithGoogle } = useAuth();
  const [step, setStep] = useState<ApplyStep>('intro');
  const [formData, setFormData] = useState({ about: '', portfolio: '', availability: 'flexible' });
  const [submitting, setSubmitting] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const firstFocusRef = useRef<HTMLButtonElement>(null);

  // Set correct step when position/user changes
  useEffect(() => {
    if (position) {
      setStep(user ? 'form' : 'intro');
      setFormData({ about: '', portfolio: '', availability: 'flexible' });
    }
  }, [position, user]);

  // Fetch referral code when success step is reached
  useEffect(() => {
    if (step === 'success' && user) {
      api.getProfile()
        .then((profile) => {
          if (profile.referralCode) {
            setReferralCode(profile.referralCode);
          }
        })
        .catch(() => { /* silently fail — referral section just won't show */ });
    }
  }, [step, user]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (position) {
      document.body.style.overflow = 'hidden';
      // Focus first interactive element after render
      requestAnimationFrame(() => firstFocusRef.current?.focus());
      return () => { document.body.style.overflow = ''; };
    }
  }, [position]);

  // Close on ESC
  useEffect(() => {
    if (!position) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, position]);

  // Focus trap
  useEffect(() => {
    if (!position || !modalRef.current) return;
    const modal = modalRef.current;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusable = modal.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [position, step]);

  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  if (!position) return null;

  const handleSubmit = async () => {
    setSubmitting(true);
    analytics.track('careers_apply_submit', { position: position.id, availability: formData.availability });
    try {
      await api.submitCareerApplication({
        positionId: position.id,
        positionTitle: position.title,
        about: formData.about,
        portfolioUrl: formData.portfolio || undefined,
        availability: formData.availability,
        utmSource: safeSessionStorage.getItem('utm_source') || undefined,
      });
      setStep('success');
    } catch (err: any) {
      // If duplicate application, still show success (they already applied)
      if (err?.message?.includes('Unique constraint')) {
        setStep('success');
      } else {
        analytics.track('careers_apply_submit', { position: position.id, error: err?.message, failed: true });
        // Stay on form step so user can retry
      }
    } finally {
      setSubmitting(false);
    }
  };

  const charCount = formData.about.length;
  const charLimit = 500;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4 animate-in fade-in"
      onClick={handleBackdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="apply-modal-title"
    >
      <div
        ref={modalRef}
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              {position.icon}
            </div>
            <div>
              <h3 id="apply-modal-title" className="font-semibold text-slate-900">{position.title}</h3>
              <span className="text-xs text-slate-500">{position.tag} · Remote</span>
            </div>
          </div>
          <button ref={step === 'intro' ? firstFocusRef : undefined} onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-50 transition-colors" aria-label="Close">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {/* Step: Intro (not logged in) */}
          {step === 'intro' && (
            <div className="space-y-5">
              <p className="text-slate-600 text-sm">
                Sign up in seconds to apply. Your skills will be matched automatically.
              </p>
              {/* LinkedIn — PRIMARY */}
              <button
                onClick={() => {
                  setApplyIntent(position.id, position.title);
                  analytics.track('careers_apply_signup_redirect', { position: position.id, method: 'linkedin' });
                  loginWithLinkedIn();
                }}
                className="w-full py-3 px-4 rounded-xl text-white font-semibold bg-[#0A66C2] hover:bg-[#004182] shadow-lg shadow-blue-600/20 transition-all hover:shadow-blue-600/30 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                Continue with LinkedIn
              </button>
              {/* Google — secondary */}
              <button
                onClick={() => {
                  setApplyIntent(position.id, position.title);
                  analytics.track('careers_apply_signup_redirect', { position: position.id, method: 'google' });
                  loginWithGoogle();
                }}
                className="w-full py-3 px-4 rounded-xl text-slate-700 font-semibold bg-white border border-slate-200 hover:bg-slate-50 shadow-sm transition-all hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-300 flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Continue with Google
              </button>
              <p className="text-center text-sm text-slate-500">
                Already have an account?{' '}
                <Link
                  to="/login"
                  onClick={() => setApplyIntent(position.id, position.title)}
                  className="text-blue-600 hover:text-blue-500 font-medium"
                >
                  Sign in
                </Link>
              </p>
            </div>
          )}

          {/* Step: Application Form (logged in) */}
          {step === 'form' && (
            <div className="space-y-5">
              <p className="text-slate-600 text-sm">
                Almost there! Tell us a bit about yourself. No formal CV needed — just be you.
              </p>
              <div>
                <label htmlFor="apply-about" className="block text-sm font-medium text-slate-700 mb-1">
                  What excites you about this role? <span className="text-red-400">*</span>
                </label>
                <textarea
                  ref={step === 'form' ? firstFocusRef as any : undefined}
                  id="apply-about"
                  value={formData.about}
                  onChange={(e) => {
                    if (e.target.value.length <= charLimit) {
                      setFormData({ ...formData, about: e.target.value });
                    }
                  }}
                  rows={3}
                  placeholder="A couple sentences is perfect..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none"
                />
                <div className="flex justify-end mt-1">
                  <span className={`text-xs ${charCount > charLimit * 0.9 ? 'text-orange-500' : 'text-slate-400'}`}>
                    {charCount}/{charLimit}
                  </span>
                </div>
              </div>
              <div>
                <label htmlFor="apply-portfolio" className="block text-sm font-medium text-slate-700 mb-1">
                  Link to your work <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  id="apply-portfolio"
                  type="url"
                  value={formData.portfolio}
                  onChange={(e) => setFormData({ ...formData, portfolio: e.target.value })}
                  placeholder="Portfolio, GitHub, social profile..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Availability
                </label>
                <div className="flex gap-2">
                  {['Flexible', 'Part-time', 'Full-time'].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setFormData({ ...formData, availability: opt.toLowerCase() })}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        formData.availability === opt.toLowerCase()
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={handleSubmit}
                disabled={submitting || !formData.about.trim()}
                className="w-full py-3 px-4 rounded-xl text-white font-semibold bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-lg shadow-orange-500/25 transition-all hover:shadow-orange-500/40 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-orange-500/25"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Submitting...
                  </span>
                ) : (
                  <>Submit Application <ArrowRightIcon className="w-4 h-4 inline ml-2" /></>
                )}
              </button>
            </div>
          )}

          {/* Step: Success */}
          {step === 'success' && (
            <div className="text-center space-y-4 py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
                <CheckCircleIcon className="w-10 h-10 text-emerald-500" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900">Application received!</h3>
              <p className="text-slate-600 text-sm max-w-sm mx-auto">
                We review every application personally and will be in touch soon. In the meantime, complete your profile — it helps you stand out.
              </p>
              <div className="flex flex-col gap-2 pt-2">
                <Link
                  to="/dashboard"
                  className="py-2.5 px-4 rounded-xl text-white font-medium bg-blue-600 hover:bg-blue-700 transition-colors text-center text-sm"
                >
                  Complete My Profile
                </Link>
                <button onClick={onClose} className="py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors">
                  Browse more positions
                </button>
              </div>

              {/* Referral sharing — slides in after success */}
              <ReferralShareSection referralCode={referralCode} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Position Card ───────────────────────────────────────────────────────────

function PositionCard({ position, onApply, referralCode }: { position: Position; onApply: (p: Position) => void; referralCode?: string }) {
  const [linkCopied, setLinkCopied] = useState(false);

  const copyApplyLink = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const base = `${window.location.origin}/careers/apply/${position.id}`;
    const url = referralCode ? `${base}?ref=${referralCode}` : base;
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true);
      analytics.track('careers_copy_apply_link', { position: position.id, hasRef: !!referralCode });
      setTimeout(() => setLinkCopied(false), 2000);
    });
  }, [position.id, referralCode]);

  return (
    <div
      id={`position-${position.id}`}
      className="group bg-white rounded-2xl border border-slate-200 hover:border-blue-200 hover:shadow-lg transition-all duration-300 overflow-hidden flex flex-col"
    >
      <div className="p-6 flex-1">
        <div className="flex items-start justify-between mb-3">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
            {position.icon}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyApplyLink}
              title="Copy apply link"
              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            >
              {linkCopied ? (
                <CheckCircleIcon className="w-4 h-4 text-emerald-500" />
              ) : (
                <LinkIcon className="w-4 h-4" />
              )}
            </button>
            <span className="text-xs font-medium text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full">
              {position.tag}
            </span>
          </div>
        </div>
        <h3 className="text-lg font-semibold text-slate-900 mb-1">{position.title}</h3>
        <p className="text-sm text-slate-500 mb-4">{position.tagline}</p>
        <ul className="space-y-2">
          {position.bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
              <CheckCircleIcon className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="px-6 pb-6 pt-2">
        <button
          onClick={() => {
            analytics.track('careers_apply_click', { position: position.id });
            onApply(position);
          }}
          className="w-full py-3 px-4 rounded-xl text-white font-semibold bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-md shadow-orange-500/20 transition-all hover:shadow-lg hover:shadow-orange-500/30 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 active:translate-y-0"
        >
          Apply Now
          <ArrowRightIcon className="w-4 h-4 inline ml-2" />
        </button>
      </div>
    </div>
  );
}

// ─── Category Filter ─────────────────────────────────────────────────────────

function CategoryFilter({ active, onChange, counts }: {
  active: Category;
  onChange: (c: Category) => void;
  counts: Record<Category, number>;
}) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {CATEGORIES.map((cat) => (
        <button
          key={cat}
          onClick={() => onChange(cat)}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
            active === cat
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white text-slate-600 border border-slate-200 hover:border-blue-200 hover:text-blue-600'
          }`}
        >
          {cat}
          <span className={`ml-1.5 text-xs ${active === cat ? 'text-blue-200' : 'text-slate-400'}`}>
            {counts[cat]}
          </span>
        </button>
      ))}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function CareersPage() {
  const { user, loginWithLinkedIn, loginWithGoogle } = useAuth();
  const { positionId: routePositionId } = useParams<{ positionId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [activeCategory, setActiveCategory] = useState<Category>('All');
  const [userReferralCode, setUserReferralCode] = useState<string | null>(null);
  const positionsRef = useRef<HTMLDivElement>(null);

  // Fetch referral code for logged-in users (lightweight, no side-effects)
  useEffect(() => {
    if (user) {
      api.getReferralCode()
        .then(({ referralCode }) => {
          if (referralCode) setUserReferralCode(referralCode);
        })
        .catch(() => { /* silently fail */ });
    }
  }, [user]);

  // Category counts
  const categoryCounts = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = cat === 'All' ? POSITIONS.length : POSITIONS.filter(p => p.category === cat).length;
    return acc;
  }, {} as Record<Category, number>);

  const filteredPositions = activeCategory === 'All'
    ? POSITIONS
    : POSITIONS.filter(p => p.category === activeCategory);

  // Handle deep links, referral capture, and apply intent on mount
  useEffect(() => {
    // Capture referral code from ?ref= FIRST (before any navigation)
    const ref = searchParams.get('ref');
    if (ref) {
      safeLocalStorage.setItem('referrer_id', ref);
    }

    const utmSource = searchParams.get('utm_source');
    if (utmSource) {
      safeSessionStorage.setItem('utm_source', utmSource);
    }

    // 1. Check route param (deep link: /careers/apply/software-engineer)
    if (routePositionId) {
      const allPositions = [...POSITIONS, GENERAL_APPLICATION];
      const match = allPositions.find((p) => p.id === routePositionId);
      if (match) {
        setSelectedPosition(match);
        analytics.track('careers_deeplink_landed', {
          positionId: routePositionId,
          hasRef: !!ref,
        });
        // Clean URL to /careers after ref is captured
        navigate('/careers', { replace: true });
        return;
      }
    }

    // 2. Check localStorage (survives OAuth, onboarding, refreshes)
    const intent = getApplyIntent();
    if (intent) {
      const match = POSITIONS.find((p) => p.id === intent.positionId);
      if (match) {
        setSelectedPosition(match);
        clearApplyIntent();
        return;
      }
    }

    // 3. Fallback: check URL param (legacy links like /careers?apply=software-engineer)
    const params = new URLSearchParams(window.location.search);
    const applyId = params.get('apply');
    if (applyId) {
      const match = POSITIONS.find((p) => p.id === applyId);
      if (match) {
        setSelectedPosition(match);
        params.delete('apply');
        const newSearch = params.toString();
        window.history.replaceState({}, '', window.location.pathname + (newSearch ? `?${newSearch}` : ''));
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleApply = useCallback((position: Position) => {
    setSelectedPosition(position);
  }, []);

  const scrollToPositions = useCallback(() => {
    positionsRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return (
    <main className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      <SEO
        title="Careers"
        description="Join HumanPages — the AI-to-human marketplace. No CVs required. Work from anywhere, any time zone. We believe in results, not resumes."
        path="/careers"
        ogImage="https://humanpages.ai/api/og/careers"
      />

      {/* Nav */}
      <nav className="w-full flex items-center justify-between px-4 md:px-8 py-4 bg-white/80 backdrop-blur-sm border-b border-slate-100 sticky top-0 z-40">
        <Link to="/"><Logo size="md" /></Link>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <button
            onClick={scrollToPositions}
            className="hidden sm:inline-flex px-4 py-2 rounded-lg text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 transition-colors"
          >
            Apply Now
          </button>
        </div>
      </nav>

      {/* ═══ Hero ═══ */}
      <section className="px-4 pt-16 pb-12 md:pt-24 md:pb-16">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center gap-8 md:gap-12">
          <div className="flex-1 text-center md:text-left">
            <div className="inline-block mb-4 px-3 py-1 rounded-full bg-orange-50 text-orange-600 text-xs font-semibold tracking-wide uppercase">
              {POSITIONS.length} open roles · Remote worldwide
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 leading-tight mb-4">
              Build the future of{' '}
              <span className="text-blue-600">human-AI</span>{' '}
              work
            </h1>
            <p className="text-lg text-slate-600 mb-6 max-w-xl">
              HumanPages is the marketplace where AI agents hire real humans for real tasks. We're growing fast and looking for curious, driven people worldwide — we care about what you can do, not what's on your CV.
            </p>
            <div className="flex flex-col gap-3 justify-center md:justify-start items-center md:items-start">
              <button
                onClick={scrollToPositions}
                className="px-6 py-3 rounded-xl text-white font-semibold bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg shadow-blue-600/25 transition-all hover:shadow-blue-600/40 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 active:translate-y-0"
              >
                Apply to Open Roles
                <ArrowRightIcon className="w-4 h-4 inline ml-2" />
              </button>
              {!user && (
                <div className="flex flex-col items-center md:items-start gap-2 mt-1">
                  <span className="text-xs text-slate-400">Or sign up in 10 seconds:</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setApplyIntent('general', 'General Application');
                        analytics.track('careers_hero_signup', { method: 'linkedin' });
                        loginWithLinkedIn();
                      }}
                      className="px-4 py-2 rounded-lg text-white text-sm font-medium bg-[#0A66C2] hover:bg-[#004182] transition-colors flex items-center gap-1.5"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                      LinkedIn
                    </button>
                    <button
                      onClick={() => {
                        setApplyIntent('general', 'General Application');
                        analytics.track('careers_hero_signup', { method: 'google' });
                        loginWithGoogle();
                      }}
                      className="px-4 py-2 rounded-lg text-slate-600 text-sm font-medium bg-white border border-slate-200 hover:bg-slate-50 transition-colors flex items-center gap-1.5"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                      Google
                    </button>
                  </div>
                </div>
              )}
              {user && <span className="text-sm text-slate-400">2-minute application · No CV needed</span>}
            </div>
          </div>
          <div className="flex-1 flex justify-center">
            <HeroIllustration />
          </div>
        </div>
      </section>

      {/* ═══ Equal Opportunity Banner ═══ */}
      <section className="px-4 pb-12">
        <div className="max-w-4xl mx-auto bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-8 md:p-10 text-center text-white">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">Results, not resumes</h2>
          <p className="text-slate-300 max-w-2xl mx-auto mb-8">
            We're an equal opportunity company. No degree requirements, no years-of-experience filters. We read every application carefully — if you care about the work and show up ready to learn, you belong here. Freelance or full-time, any time zone, any capacity.
          </p>
          <StatsBar />
        </div>
      </section>

      {/* ═══ Open Positions (moved up — first actionable section after trust banner) ═══ */}
      <section ref={positionsRef} className="px-4 pb-16 scroll-mt-24">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-slate-900 mb-3">Open Positions</h2>
            <p className="text-slate-500 max-w-lg mx-auto mb-6">
              Find your fit. Every role is remote-first and open to people worldwide.
            </p>
            <CategoryFilter active={activeCategory} onChange={setActiveCategory} counts={categoryCounts} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPositions.map((pos) => (
              <PositionCard key={pos.id} position={pos} onApply={handleApply} referralCode={userReferralCode ?? undefined} />
            ))}
            {/* Apply Anyway — always shown as the last card, visually differentiated */}
            <div
              id="position-general"
              className="group bg-gradient-to-br from-slate-50 to-blue-50/50 rounded-2xl border-2 border-dashed border-blue-200 hover:border-blue-400 hover:shadow-lg transition-all duration-300 overflow-hidden flex flex-col"
            >
              <div className="p-6 flex-1">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                    {GENERAL_APPLICATION.icon}
                  </div>
                  <span className="text-xs font-medium text-blue-500 bg-blue-50 px-2.5 py-1 rounded-full">
                    {GENERAL_APPLICATION.tag}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-1">Don't see your role?</h3>
                <p className="text-sm text-slate-500 mb-4">{GENERAL_APPLICATION.tagline}</p>
                <ul className="space-y-2">
                  {GENERAL_APPLICATION.bullets.map((b, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                      <CheckCircleIcon className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="px-6 pb-6 pt-2">
                <button
                  onClick={() => {
                    analytics.track('careers_apply_click', { position: 'general' });
                    handleApply(GENERAL_APPLICATION);
                  }}
                  className="w-full py-3 px-4 rounded-xl text-white font-semibold bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-md shadow-orange-500/20 transition-all hover:shadow-lg hover:shadow-orange-500/30 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 active:translate-y-0"
                >
                  Apply Anyway
                  <ArrowRightIcon className="w-4 h-4 inline ml-2" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ How to Apply (Process visualization — below positions for those who need convincing) ═══ */}
      <section className="px-4 pb-12">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Applying takes 2 minutes</h2>
          <p className="text-slate-500 mb-8">No cover letter. No resume upload. Just tell us why you're excited.</p>
          <ProcessSteps />
        </div>
      </section>

      {/* ═══ Perks Infographic ═══ */}
      <section className="px-4 pb-16">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-8">Why people love working here</h2>
          <PerksInfographic />
        </div>
      </section>

      {/* ═══ Team Culture ═══ */}
      <section className="px-4 pb-16">
        <div className="max-w-4xl mx-auto bg-white rounded-2xl border border-slate-200 p-8 md:p-10">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-slate-900 mb-3">Learn from the best, teach what you know</h2>
              <p className="text-slate-600 mb-4">
                Our team includes seasoned engineers, marketers, and builders who love sharing what they've learned. When you join, you'll work alongside people who are invested in your growth — and who want to learn from you too.
              </p>
              <p className="text-slate-600">
                We run weekly knowledge-sharing sessions, pair on real projects, and believe the best ideas come from unexpected places. Your background doesn't define your potential here — your curiosity does.
              </p>
            </div>
            <div className="flex-1">
              <TeamIllustration />
            </div>
          </div>
        </div>
      </section>

      {/* ═══ Team Quotes — hidden until team members approve ═══ */}
      {false && (
      <section className="px-4 pb-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 mb-6 text-center">From the team</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <TeamQuote
              quote="I joined with no startup experience and they gave me real responsibility from day one. They actually mean it when they say results over resumes."
              name="Angel"
              role="Virtual Assistant"
            />
            <TeamQuote
              quote="The flexibility is real — I set my own schedule and work on my own terms. What matters is that things get done."
              name="Mikee"
              role="Virtual Assistant"
            />
            <TeamQuote
              quote="I've grown so much since joining. Everyone shares openly and you're always learning something new."
              name="Ash"
              role="Virtual Assistant"
            />
          </div>
        </div>
      </section>
      )}

      <Footer />

      {/* ═══ Sticky Mobile Apply Bar ═══ */}
      <div className="fixed bottom-0 inset-x-0 z-30 md:hidden bg-white/95 backdrop-blur-sm border-t border-slate-200 px-4 py-3 safe-area-pb">
        <button
          onClick={scrollToPositions}
          className="w-full py-3 px-4 rounded-xl text-white font-semibold bg-gradient-to-r from-orange-500 to-orange-600 shadow-lg shadow-orange-500/25 active:translate-y-0 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
        >
          Apply to Open Roles
          <span className="ml-2 text-orange-200 text-sm font-normal">2 min</span>
        </button>
      </div>

      {/* Apply Modal */}
      <ApplyModal position={selectedPosition} onClose={() => setSelectedPosition(null)} />
    </main>
  );
}
