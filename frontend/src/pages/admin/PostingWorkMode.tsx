import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../lib/api';
import CompactClock from '../../components/admin/CompactClock';
import type { PostingGroup, PostingGroupStatus, AdCopy, TaskType } from '../../types/admin';

// ─── Constants ───

const SPAM_WARN_DAYS = 7;

const TASK_TYPE_OPTIONS: { value: TaskType | ''; label: string }[] = [
  { value: '', label: 'All Types' },
  { value: 'fb_post', label: 'FB Post' },
  { value: 'yt_comment', label: 'YouTube Comment' },
  { value: 'yt_reply', label: 'YouTube Reply' },
  { value: 'blog_comment', label: 'Blog Comment' },
];

const TASK_TYPE_COLORS: Record<string, string> = {
  fb_post: 'bg-blue-100 text-blue-800',
  yt_comment: 'bg-red-100 text-red-800',
  yt_reply: 'bg-orange-100 text-orange-800',
  blog_comment: 'bg-purple-100 text-purple-800',
};

const TASK_TYPE_LABELS: Record<string, string> = {
  fb_post: 'FB Post',
  yt_comment: 'YT Comment',
  yt_reply: 'YT Reply',
  blog_comment: 'Blog Comment',
};

const LANG_FLAGS: Record<string, string> = {
  en: '\u{1F1FA}\u{1F1F8}', es: '\u{1F1EA}\u{1F1F8}', pt: '\u{1F1E7}\u{1F1F7}', fr: '\u{1F1EB}\u{1F1F7}',
  de: '\u{1F1E9}\u{1F1EA}', it: '\u{1F1EE}\u{1F1F9}', tl: '\u{1F1F5}\u{1F1ED}', vi: '\u{1F1FB}\u{1F1F3}',
  th: '\u{1F1F9}\u{1F1ED}', hi: '\u{1F1EE}\u{1F1F3}', zh: '\u{1F1E8}\u{1F1F3}', ar: '\u{1F1F8}\u{1F1E6}',
  tr: '\u{1F1F9}\u{1F1F7}', id: '\u{1F1EE}\u{1F1E9}',
};

// ─── Keyword auto-suggest maps (ported from Chrome extension) ───

const AD_KEYWORD_MAP = [
  { keywords: ['freelanc', 'upwork', 'fiverr', 'gig', 'self-employ', 'independ', 'contractor'], adNumber: 109 },
  { keywords: ['tech', 'developer', 'software', 'engineer', 'programming', 'coding', 'devops', 'fullstack', 'frontend', 'backend', 'data.?sci'], adNumber: 101 },
  { keywords: ['design', 'graphic', 'ui', 'ux', 'creative', 'illustrat', 'photoshop', 'figma', 'canva'], adNumber: 102 },
  { keywords: ['market', 'seo', 'social.?media', 'content', 'digital.?market', 'growth', 'brand', 'ads', 'ppc', 'copywrite'], adNumber: 103 },
  { keywords: ['writ', 'blog', 'author', 'journal', 'editor', 'copy'], adNumber: 104 },
  { keywords: ['virtual.?assist', '\\bva\\b', 'admin.?assist', 'executive.?assist'], adNumber: 105 },
  { keywords: ['hr', 'human.?resource', 'recruit', 'hiring', 'talent', 'headhunt', 'staffing'], adNumber: 106 },
  { keywords: ['mom', 'parent', 'sahm', 'wahm', 'working.?mom', 'working.?parent', 'family'], adNumber: 107 },
  { keywords: ['startup', 'entrepreneur', 'founder', 'solopreneur', 'small.?bus', 'bootstrap'], adNumber: 108 },
  { keywords: ['video', 'youtube', 'editor', 'filmmaker', 'vlog', 'motion', 'animation'], adNumber: 110 },
  { keywords: ['account', 'bookkeep', 'financ', 'tax', 'cpa', 'audit'], adNumber: 111 },
  { keywords: ['job', 'career', 'employ', 'hire', 'work', 'remote', 'resume', 'cv', 'interview'], adNumber: 100 },
];

const FALLBACK_AD_NUMBER = 100;

const COUNTRY_KEYWORD_MAP = [
  { keywords: ['philippines', 'filipino', 'pinoy', 'pinay', 'pilipinas', 'manila', 'cebu', 'davao', 'makati', 'quezon'], country: 'Philippines' },
  { keywords: ['nigeria', 'nigerian', 'naija', 'lagos', 'abuja'], country: 'Nigeria' },
  { keywords: ['vietnam', 'vietnamese', 'hanoi', 'saigon', 'ho.?chi.?minh'], country: 'Vietnam' },
  { keywords: ['mexico', 'mexican', 'mexic', 'cdmx', 'guadalajara', 'monterrey'], country: 'Mexico' },
  { keywords: ['india', 'indian', 'mumbai', 'delhi', 'bangalore', 'bengaluru', 'hyderabad', 'chennai', 'kolkata', 'pune'], country: 'India' },
  { keywords: ['pakistan', 'pakistani', 'karachi', 'lahore', 'islamabad'], country: 'Pakistan' },
  { keywords: ['bangladesh', 'bangladeshi', 'dhaka', 'chittagong'], country: 'Bangladesh' },
  { keywords: ['kenya', 'kenyan', 'nairobi', 'mombasa'], country: 'Kenya' },
  { keywords: ['south.?africa', 'johannesburg', 'cape.?town', 'durban', 'pretoria'], country: 'South Africa' },
  { keywords: ['ghana', 'ghanaian', 'accra', 'kumasi'], country: 'Ghana' },
  { keywords: ['egypt', 'egyptian', 'cairo', 'alexandria'], country: 'Egypt' },
  { keywords: ['turkey', 'turkish', 'istanbul', 'ankara', 'izmir', 'turkiye'], country: 'Turkey' },
  { keywords: ['indonesia', 'indonesian', 'jakarta', 'bali', 'surabaya'], country: 'Indonesia' },
  { keywords: ['thailand', 'thai', 'bangkok', 'chiang.?mai', 'phuket'], country: 'Thailand' },
  { keywords: ['brazil', 'brazilian', 'brasil', 'sao.?paulo', 'rio'], country: 'Brazil' },
  { keywords: ['colombia', 'colombian', 'bogota', 'medellin', 'cali'], country: 'Colombia' },
  { keywords: ['argentina', 'argentin', 'buenos.?aires'], country: 'Argentina' },
  { keywords: ['canada', 'canadian', 'toronto', 'vancouver', 'montreal', 'calgary', 'ottawa'], country: 'Canada' },
  { keywords: ['australia', 'australian', 'aussie', 'sydney', 'melbourne', 'brisbane', 'perth'], country: 'Australia' },
  { keywords: ['uk', 'united.?kingdom', 'british', 'london', 'manchester', 'birmingham', 'scotland', 'wales', 'england'], country: 'UK' },
  { keywords: ['usa', 'united.?states', 'america', 'new.?york', 'los.?angeles', 'chicago', 'houston', 'phoenix', 'dallas', 'san.?francisco', 'seattle', 'austin', 'denver', 'boston', 'atlanta', 'miami'], country: 'USA' },
  { keywords: ['germany', 'german', 'berlin', 'munich', 'hamburg', 'frankfurt'], country: 'Germany' },
  { keywords: ['france', 'french', 'paris', 'lyon', 'marseille'], country: 'France' },
  { keywords: ['spain', 'spanish', 'madrid', 'barcelona', 'valencia'], country: 'Spain' },
  { keywords: ['italy', 'italian', 'rome', 'milan', 'naples'], country: 'Italy' },
  { keywords: ['netherlands', 'dutch', 'amsterdam', 'rotterdam'], country: 'Netherlands' },
  { keywords: ['poland', 'polish', 'warsaw', 'krakow'], country: 'Poland' },
  { keywords: ['romania', 'romanian', 'bucharest'], country: 'Romania' },
  { keywords: ['ukraine', 'ukrainian', 'kyiv', 'kiev'], country: 'Ukraine' },
  { keywords: ['japan', 'japanese', 'tokyo', 'osaka'], country: 'Japan' },
  { keywords: ['korea', 'korean', 'seoul', 'busan'], country: 'South Korea' },
  { keywords: ['singapore', 'singaporean'], country: 'Singapore' },
  { keywords: ['malaysia', 'malaysian', 'kuala.?lumpur'], country: 'Malaysia' },
  { keywords: ['dubai', 'uae', 'abu.?dhabi', 'emirates'], country: 'UAE' },
  { keywords: ['saudi', 'riyadh', 'jeddah'], country: 'Saudi Arabia' },
  { keywords: ['israel', 'israeli', 'tel.?aviv', 'jerusalem'], country: 'Israel' },
  { keywords: ['africa', 'african'], country: 'Africa' },
  { keywords: ['asia', 'asian'], country: 'Asia' },
  { keywords: ['latin.?america', 'latam'], country: 'Latin America' },
  { keywords: ['europe', 'european'], country: 'Europe' },
];

function matchAdNumber(text: string): number {
  const lower = text.toLowerCase();
  for (const entry of AD_KEYWORD_MAP) {
    for (const kw of entry.keywords) {
      if (new RegExp(kw, 'i').test(lower)) return entry.adNumber;
    }
  }
  return FALLBACK_AD_NUMBER;
}

function matchCountry(text: string): string {
  const lower = text.toLowerCase();
  for (const entry of COUNTRY_KEYWORD_MAP) {
    for (const kw of entry.keywords) {
      if (new RegExp(kw, 'i').test(lower)) return entry.country;
    }
  }
  return 'Global';
}

function slugFromUrl(url: string): string {
  try {
    const match = url.match(/facebook\.com\/groups\/([^/?#]+)/);
    return match ? match[1] : '';
  } catch {
    return '';
  }
}

function nameFromSlug(slug: string): string {
  return slug.replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim();
}

// ─── Component ───

export default function PostingWorkMode() {
  // Queue state
  const [groups, setGroups] = useState<PostingGroup[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [sessionPosted, setSessionPosted] = useState(0);
  const [totalPosted, setTotalPosted] = useState(0);
  const [totalGroups, setTotalGroups] = useState(0);

  // Filters
  const [filterTaskType, setFilterTaskType] = useState('');
  const [filterLanguage, setFilterLanguage] = useState('');
  const [filterCountry, setFilterCountry] = useState('');
  const [filterCampaign, setFilterCampaign] = useState('');
  const [availableLanguages, setAvailableLanguages] = useState<string[]>([]);
  const [availableCountries, setAvailableCountries] = useState<string[]>([]);

  // Ad cache
  const adCacheRef = useRef<Record<string, AdCopy>>({});
  const [currentAd, setCurrentAd] = useState<AdCopy | null>(null);

  // Notes
  const [notes, setNotes] = useState('');

  // Copy states
  const [copiedAd, setCopiedAd] = useState(false);
  const [copiedReply, setCopiedReply] = useState(false);

  // Add to Queue form
  const [addOpen, setAddOpen] = useState(false);
  const [addUrl, setAddUrl] = useState('');
  const [addName, setAddName] = useState('');
  const [addLanguage, setAddLanguage] = useState('en');
  const [addCountry, setAddCountry] = useState('Global');
  const [addCampaign, setAddCampaign] = useState('');
  const [addAdId, setAddAdId] = useState('');
  const [allAds, setAllAds] = useState<AdCopy[]>([]);
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addResult, setAddResult] = useState<{ message: string; isError: boolean } | null>(null);

  // ─── Fetch groups ───
  const fetchGroups = useCallback(async () => {
    setLoading(true);
    setFetchError('');
    try {
      const params: Record<string, string> = { status: 'PENDING', limit: '100' };
      if (filterTaskType) params.taskType = filterTaskType;
      if (filterLanguage) params.language = filterLanguage;
      if (filterCountry) params.country = filterCountry;
      if (filterCampaign) params.campaign = filterCampaign;

      // Primary fetch — must succeed
      const pendingRes = await api.getPostingGroups(params as any);
      setGroups(pendingRes.groups);
      setCurrentIndex(0);

      // Discover available languages/countries for filter dropdowns
      const langs = new Set<string>();
      const countries = new Set<string>();
      for (const g of pendingRes.groups) {
        langs.add(g.language);
        countries.add(g.country);
      }
      setAvailableLanguages([...langs].sort());
      setAvailableCountries([...countries].sort());

      // Secondary counts — non-blocking (don't break the page if these fail)
      Promise.all([
        api.getPostingGroups({ status: 'POSTED', limit: 1, taskType: filterTaskType || undefined } as any),
        api.getPostingGroups({ limit: 1, taskType: filterTaskType || undefined } as any),
      ]).then(([postedRes, allRes]) => {
        setTotalPosted(postedRes.pagination.total);
        setTotalGroups(allRes.pagination.total);
      }).catch(() => {});
    } catch (err: any) {
      setFetchError(err?.message || 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [filterTaskType, filterLanguage, filterCountry, filterCampaign]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  // Load ads for add-to-queue form
  useEffect(() => {
    api.getAdCopies().then((res) => setAllAds(res.ads)).catch(() => {});
  }, []);

  // ─── Load ad copy for current group ───
  const currentGroup = groups[currentIndex] ?? null;

  useEffect(() => {
    if (!currentGroup) { setCurrentAd(null); return; }
    const adId = currentGroup.adId;
    if (adCacheRef.current[adId]) {
      setCurrentAd(adCacheRef.current[adId]);
      return;
    }
    api.getAdCopy(adId).then((ad) => {
      adCacheRef.current[adId] = ad;
      setCurrentAd(ad);
    }).catch(() => setCurrentAd(null));
  }, [currentGroup?.adId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset notes when group changes
  useEffect(() => {
    if (!currentGroup) return;
    const isYt = currentGroup.taskType === 'yt_comment' || currentGroup.taskType === 'yt_reply';
    setNotes(isYt ? '' : (currentGroup.notes || ''));
  }, [currentGroup?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Actions ───
  const markGroup = async (status: PostingGroupStatus) => {
    if (!currentGroup) return;
    setActionLoading(true);
    try {
      const data: Record<string, string | null> = { status };
      if (notes.trim()) data.notes = notes.trim();
      await api.updatePostingGroup(currentGroup.id, data);

      if (status === 'POSTED') {
        setSessionPosted((p) => p + 1);
        setTotalPosted((p) => p + 1);
      }

      const nextIndex = currentIndex + 1;
      if (nextIndex >= groups.length) {
        await fetchGroups();
      } else {
        setCurrentIndex(nextIndex);
      }
    } catch {
      // ignore
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Copy helpers ───
  const copyText = (text: string, setter: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  // ─── YT reply parsing ───
  const isYt = currentGroup?.taskType === 'yt_comment' || currentGroup?.taskType === 'yt_reply';
  let replyContext = '';
  let replyBody = '';
  if (isYt && currentGroup?.notes) {
    if (currentGroup.taskType === 'yt_reply') {
      const findMatch = currentGroup.notes.match(/FIND COMMENT:\s*\n([\s\S]*?)(?=\n\s*\nYOUR REPLY:)/i);
      const replyMatch = currentGroup.notes.match(/YOUR REPLY:\s*\n([\s\S]*?)$/i);
      replyContext = findMatch ? 'Find and reply to: ' + findMatch[1].trim() : '';
      replyBody = replyMatch ? replyMatch[1].trim() : currentGroup.notes;
    } else {
      replyBody = currentGroup.notes.trim();
    }
  }

  // ─── Spam warning ───
  let spamWarning = '';
  if (currentGroup?.datePosted) {
    const daysSince = Math.floor((Date.now() - new Date(currentGroup.datePosted).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince < SPAM_WARN_DAYS) {
      spamWarning = daysSince === 0 ? 'Last posted today — may be flagged as spam' : `Last posted ${daysSince}d ago — may be flagged as spam`;
    }
  }

  // ─── Progress ───
  const progressPct = totalGroups > 0 ? (totalPosted / totalGroups) * 100 : 0;

  // ─── Add group: auto-suggest on URL change ───
  const onAddUrlChange = (url: string) => {
    setAddUrl(url);
    const slug = slugFromUrl(url);
    if (slug) {
      if (!addName.trim()) setAddName(nameFromSlug(slug));
      setAddCountry(matchCountry(slug));
    }
  };

  // Filtered ads for the add-group dropdown
  const filteredAds = allAds.filter((ad) => ad.language === addLanguage);

  // Auto-select best ad when filteredAds or addUrl changes
  useEffect(() => {
    if (filteredAds.length === 0) { setAddAdId(''); return; }
    const slug = slugFromUrl(addUrl);
    const suggested = matchAdNumber(slug);
    const match = filteredAds.find((ad) => ad.adNumber === suggested);
    const fallback = filteredAds.find((ad) => ad.adNumber === FALLBACK_AD_NUMBER);
    setAddAdId(match?.id || fallback?.id || filteredAds[0].id);
  }, [addLanguage, addUrl, filteredAds.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddGroup = async () => {
    if (!addUrl.trim() || !addName.trim()) {
      setAddResult({ message: 'URL and name are required.', isError: true });
      return;
    }
    if (!addAdId) {
      setAddResult({ message: 'Please select an ad copy.', isError: true });
      return;
    }

    setAddSubmitting(true);
    try {
      const payload: Record<string, string> = {
        name: addName.trim(),
        url: addUrl.trim(),
        adId: addAdId,
        language: addLanguage,
        country: addCountry.trim() || 'Global',
        taskType: 'fb_post',
      };
      if (addCampaign.trim()) payload.campaign = addCampaign.trim();

      const result = await api.createPostingGroup(payload as any);

      if (result.skipped > 0 && result.created === 0) {
        setAddResult({ message: 'Already in queue — skipped.', isError: true });
      } else {
        setAddResult({ message: `Added "${addName.trim()}" to queue!`, isError: false });
        setAddName('');
        setAddCountry('Global');
        setAddCampaign('');
        fetchGroups();
      }
    } catch (err: any) {
      setAddResult({ message: `Failed: ${err.message}`, isError: true });
    } finally {
      setAddSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Clock */}
      <CompactClock />

      {/* Progress bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">{totalPosted} / {totalGroups} posted</span>
          {sessionPosted > 0 && (
            <span className="text-xs text-green-600 font-medium">{sessionPosted} this session</span>
          )}
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-green-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <select
          className="border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
          value={filterTaskType}
          onChange={(e) => { setFilterTaskType(e.target.value); adCacheRef.current = {}; }}
        >
          {TASK_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <select
          className="border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
          value={filterLanguage}
          onChange={(e) => setFilterLanguage(e.target.value)}
        >
          <option value="">All Languages</option>
          {availableLanguages.map((l) => (
            <option key={l} value={l}>{(LANG_FLAGS[l] || '')} {l.toUpperCase()}</option>
          ))}
        </select>
        <select
          className="border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
          value={filterCountry}
          onChange={(e) => setFilterCountry(e.target.value)}
        >
          <option value="">All Countries</option>
          {availableCountries.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Campaign"
          className="border border-gray-300 rounded-md px-2.5 py-1.5 text-sm w-36"
          value={filterCampaign}
          onChange={(e) => setFilterCampaign(e.target.value)}
        />
      </div>

      {/* Task Card */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading tasks...</div>
      ) : fetchError ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <h3 className="text-lg font-semibold text-red-700 mb-1">Failed to load tasks</h3>
          <p className="text-sm text-red-600 mb-3">{fetchError}</p>
          <button
            onClick={fetchGroups}
            className="px-4 py-2 text-sm font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200"
          >
            Retry
          </button>
        </div>
      ) : !currentGroup ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
          <h3 className="text-lg font-semibold text-gray-700 mb-1">All caught up!</h3>
          <p className="text-sm text-gray-500">No pending tasks match your filters.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {/* Badges + position */}
          <div className="px-5 pt-4 pb-3 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-medium rounded px-2 py-0.5 ${TASK_TYPE_COLORS[currentGroup.taskType] || 'bg-gray-100 text-gray-800'}`}>
                {TASK_TYPE_LABELS[currentGroup.taskType] || currentGroup.taskType}
              </span>
              <span className="text-xs bg-gray-100 text-gray-700 rounded px-2 py-0.5">
                {LANG_FLAGS[currentGroup.language] || ''} {currentGroup.language.toUpperCase()}
              </span>
              <span className="text-xs bg-gray-100 text-gray-700 rounded px-2 py-0.5">
                {currentGroup.country}
              </span>
              {currentGroup.campaign && (
                <span className="text-xs bg-indigo-100 text-indigo-700 rounded px-2 py-0.5">
                  {currentGroup.campaign}
                </span>
              )}
            </div>
            <span className="text-xs text-gray-500">{currentIndex + 1} of {groups.length}</span>
          </div>

          {/* Group name + link */}
          <div className="px-5 py-3">
            <h3 className="text-base font-semibold text-gray-900 mb-1">{currentGroup.name}</h3>
            <a
              href={currentGroup.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
            >
              {isYt ? 'Open Video in New Tab' : 'Open in New Tab'} &rarr;
            </a>
          </div>

          {/* Spam warning */}
          {spamWarning && (
            <div className="mx-5 mb-3 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-xs text-yellow-800">
              {spamWarning}
            </div>
          )}

          {/* YouTube reply/comment section */}
          {isYt && (replyContext || replyBody) && (
            <div className="mx-5 mb-3 bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-600 uppercase">
                  {currentGroup.taskType === 'yt_reply' ? 'YouTube Reply' : 'YouTube Comment'}
                </span>
              </div>
              {replyContext && (
                <p className="text-xs text-gray-500 mb-2 italic">{replyContext}</p>
              )}
              <pre className="text-sm whitespace-pre-wrap text-gray-900 mb-2">{replyBody}</pre>
              <button
                onClick={() => copyText(replyBody, setCopiedReply)}
                className={`px-3 py-1 text-xs rounded font-medium ${
                  copiedReply ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {copiedReply ? 'Copied!' : 'Copy'}
              </button>
            </div>
          )}

          {/* Ad copy section */}
          {!isYt && (
            <div className="mx-5 mb-3 bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-600 uppercase">
                  {currentAd ? `Ad #${currentAd.adNumber} (${currentAd.language})` : 'Ad Copy'}
                </span>
              </div>
              {currentAd ? (
                <>
                  <p className="text-sm font-medium text-gray-900 mb-1">{currentAd.title}</p>
                  <pre className="text-sm whitespace-pre-wrap text-gray-700 mb-2 max-h-48 overflow-y-auto">{currentAd.body}</pre>
                  <button
                    onClick={() => copyText(currentAd.body, setCopiedAd)}
                    className={`px-3 py-1 text-xs rounded font-medium ${
                      copiedAd ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {copiedAd ? 'Copied!' : 'Copy Ad Text'}
                  </button>
                </>
              ) : (
                <p className="text-sm text-gray-400">Loading ad...</p>
              )}
            </div>
          )}

          {/* Notes */}
          <div className="px-5 pb-3">
            <input
              type="text"
              placeholder="Notes (optional)"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Action buttons */}
          <div className="px-5 pb-4 grid grid-cols-4 gap-2">
            <button
              onClick={() => markGroup('POSTED')}
              disabled={actionLoading}
              className="px-3 py-2.5 rounded-lg text-sm font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
            >
              Posted
            </button>
            <button
              onClick={() => markGroup('JOINED')}
              disabled={actionLoading}
              className="px-3 py-2.5 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              Awaiting
            </button>
            <button
              onClick={() => markGroup('SKIPPED')}
              disabled={actionLoading}
              className="px-3 py-2.5 rounded-lg text-sm font-semibold text-gray-700 bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
            >
              Skip
            </button>
            <button
              onClick={() => markGroup('REJECTED')}
              disabled={actionLoading}
              className="px-3 py-2.5 rounded-lg text-sm font-semibold text-white bg-red-500 hover:bg-red-600 disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        </div>
      )}

      {/* Add to Queue (collapsible) */}
      <div className="mt-4 bg-white border border-gray-200 rounded-xl overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
          onClick={() => setAddOpen(!addOpen)}
        >
          <span>Add to Queue</span>
          <span className="text-gray-400">{addOpen ? '\u25B2' : '\u25BC'}</span>
        </button>
        {addOpen && (
          <div className="px-5 pb-4 border-t border-gray-100 space-y-3 pt-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">URL</label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm"
                placeholder="https://facebook.com/groups/..."
                value={addUrl}
                onChange={(e) => onAddUrlChange(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm"
                placeholder="Group name"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Language</label>
                <select
                  className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm"
                  value={addLanguage}
                  onChange={(e) => setAddLanguage(e.target.value)}
                >
                  {Object.entries(LANG_FLAGS).map(([code, flag]) => (
                    <option key={code} value={code}>{flag} {code.toUpperCase()}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Country</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm"
                  value={addCountry}
                  onChange={(e) => setAddCountry(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Ad Copy</label>
              <select
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm"
                value={addAdId}
                onChange={(e) => setAddAdId(e.target.value)}
              >
                {filteredAds.length === 0 && <option value="">No ads for this language</option>}
                {filteredAds.map((ad) => (
                  <option key={ad.id} value={ad.id}>#{ad.adNumber} — {ad.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Campaign (optional)</label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm"
                value={addCampaign}
                onChange={(e) => setAddCampaign(e.target.value)}
              />
            </div>
            <button
              onClick={handleAddGroup}
              disabled={addSubmitting}
              className="w-full px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50"
            >
              {addSubmitting ? 'Adding...' : 'Add to Queue'}
            </button>
            {addResult && (
              <div className={`text-sm rounded-md px-3 py-2 ${addResult.isError ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                {addResult.message}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
