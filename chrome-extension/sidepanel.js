// ─── Config ───
const DEFAULTS = { apiUrl: 'https://humanpages.ai', apiKey: '' };
const SPAM_WARN_DAYS = 7;

let config = { ...DEFAULTS };
let groups = [];
let currentIndex = 0;
let adCache = {};
let sessionPosted = 0;
let totalPosted = 0;
let totalGroups = 0;
let allAds = []; // cached ad copies for the add-group form

// ─── Keyword → Ad Number mapping ───
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

// ─── Keyword → Country/City mapping ───
const COUNTRY_KEYWORD_MAP = [
  // Countries
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
  // Broad region fallbacks
  { keywords: ['africa', 'african'], country: 'Africa' },
  { keywords: ['asia', 'asian'], country: 'Asia' },
  { keywords: ['latin.?america', 'latam'], country: 'Latin America' },
  { keywords: ['europe', 'european'], country: 'Europe' },
];

// ─── DOM refs ───
const $ = (id) => document.getElementById(id);

const els = {
  // Clock
  clockSection: $('clockSection'),
  clockDot: $('clockDot'),
  clockStatusText: $('clockStatusText'),
  clockElapsed: $('clockElapsed'),
  clockTodayHours: $('clockTodayHours'),
  clockToggleBtn: $('clockToggleBtn'),
  // Auth
  authError: $('authError'),
  openSettings: $('openSettings'),
  progressBar: $('progressBar'),
  progressText: $('progressText'),
  sessionText: $('sessionText'),
  progressFill: $('progressFill'),
  filterTaskType: $('filterTaskType'),
  filterLanguage: $('filterLanguage'),
  filterCountry: $('filterCountry'),
  filterCampaign: $('filterCampaign'),
  loading: $('loading'),
  emptyState: $('emptyState'),
  groupCard: $('groupCard'),
  groupType: $('groupType'),
  groupLang: $('groupLang'),
  groupCountry: $('groupCountry'),
  groupCampaign: $('groupCampaign'),
  groupPosition: $('groupPosition'),
  groupName: $('groupName'),
  spamWarning: $('spamWarning'),
  spamText: $('spamText'),
  groupUrl: $('groupUrl'),
  adNumber: $('adNumber'),
  adTitle: $('adTitle'),
  adBody: $('adBody'),
  copyBtn: $('copyBtn'),
  replySection: $('replySection'),
  replyScore: $('replyScore'),
  replyBody: $('replyBody'),
  copyReplyBtn: $('copyReplyBtn'),
  adSection: $('adSection'),
  notesInput: $('notesInput'),
  btnPosted: $('btnPosted'),
  btnJoined: $('btnJoined'),
  btnSkip: $('btnSkip'),
  btnReject: $('btnReject'),
  // Add Group form
  addGroupSection: $('addGroupSection'),
  addGroupToggle: $('addGroupToggle'),
  addGroupChevron: $('addGroupChevron'),
  addGroupBody: $('addGroupBody'),
  addUrl: $('addUrl'),
  addName: $('addName'),
  addLanguage: $('addLanguage'),
  addAd: $('addAd'),
  addCountry: $('addCountry'),
  addCampaign: $('addCampaign'),
  addGroupBtn: $('addGroupBtn'),
  addResult: $('addResult'),
};

// ─── API helper ───
async function apiFetch(path, options = {}) {
  const url = `${config.apiUrl}/api/admin/posting${path}`;
  const headers = { 'Content-Type': 'application/json', ...options.headers };

  if (config.apiKey) {
    headers['X-Admin-API-Key'] = config.apiKey;
  }

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401 || res.status === 403) {
    showAuthError();
    throw new Error('Authentication failed');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}

// ─── Clock API helper ───
async function clockApiFetch(path, options = {}) {
  const url = `${config.apiUrl}/api/admin/time-tracking${path}`;
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (config.apiKey) {
    headers['X-Admin-API-Key'] = config.apiKey;
  }
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── Clock state ───
let clockedIn = false;
let clockInTime = null;
let clockElapsedInterval = null;

function startElapsedTimer() {
  stopElapsedTimer();
  const update = () => {
    if (!clockInTime) return;
    const diff = Math.floor((Date.now() - new Date(clockInTime).getTime()) / 1000);
    const h = Math.floor(diff / 3600).toString().padStart(2, '0');
    const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
    const s = (diff % 60).toString().padStart(2, '0');
    els.clockElapsed.textContent = `${h}:${m}:${s}`;
  };
  update();
  clockElapsedInterval = setInterval(update, 1000);
}

function stopElapsedTimer() {
  if (clockElapsedInterval) {
    clearInterval(clockElapsedInterval);
    clockElapsedInterval = null;
  }
  els.clockElapsed.textContent = '';
}

function updateClockUI() {
  els.clockDot.className = clockedIn ? 'clock-dot clock-dot-in' : 'clock-dot clock-dot-out';
  els.clockStatusText.textContent = clockedIn ? 'Clocked In' : 'Clocked Out';
  els.clockToggleBtn.textContent = clockedIn ? 'Clock Out' : 'Clock In';
  els.clockToggleBtn.className = clockedIn
    ? 'clock-toggle-btn clock-btn-out'
    : 'clock-toggle-btn clock-btn-in';

  if (clockedIn) {
    startElapsedTimer();
  } else {
    stopElapsedTimer();
  }
}

async function fetchClockStatus() {
  try {
    const data = await clockApiFetch('/status');
    clockedIn = data.clockedIn;
    clockInTime = data.since;
    updateClockUI();
    els.clockSection.hidden = false;
  } catch {
    // Non-critical — hide clock section
  }
}

async function fetchTodayHours() {
  try {
    const data = await clockApiFetch('/summary');
    els.clockTodayHours.textContent = `Today: ${data.today.hours}h`;
  } catch {
    // Non-critical
  }
}

async function toggleClock() {
  els.clockToggleBtn.disabled = true;
  try {
    if (clockedIn) {
      await clockApiFetch('/clock-out', { method: 'POST', body: JSON.stringify({}) });
      clockedIn = false;
      clockInTime = null;
    } else {
      const data = await clockApiFetch('/clock-in', { method: 'POST' });
      clockedIn = true;
      clockInTime = data.since;
    }
    updateClockUI();
    fetchTodayHours();
  } catch (err) {
    // If already clocked in/out, just refresh status
    await fetchClockStatus();
  } finally {
    els.clockToggleBtn.disabled = false;
  }
}

els.clockToggleBtn.addEventListener('click', toggleClock);

// ─── Auth error ───
function showAuthError() {
  // Only show if there's genuinely no API key configured
  if (!config.apiKey) {
    els.authError.hidden = false;
  }
}
function hideAuthError() {
  els.authError.hidden = true;
}

// ─── Load config ───
async function loadConfig() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULTS, (items) => {
      config = items;
      resolve();
    });
  });
}

// ─── Fetch groups ───
async function fetchGroups() {
  els.loading.hidden = false;
  els.emptyState.hidden = true;
  els.groupCard.hidden = true;
  hideAuthError();

  try {
    const params = new URLSearchParams({ status: 'PENDING', limit: '100' });
    const taskType = els.filterTaskType.value;
    const language = els.filterLanguage.value;
    const country = els.filterCountry.value;
    const campaign = els.filterCampaign.value.trim();

    if (taskType) params.set('taskType', taskType);
    if (language) params.set('language', language);
    if (country) params.set('country', country);
    if (campaign) params.set('campaign', campaign);

    const data = await apiFetch(`/groups?${params}`);
    groups = data.groups;
    totalGroups = data.pagination.total;
    currentIndex = 0;

    // Also fetch stats for the progress bar
    await fetchStats();
    updateProgress();

    els.loading.hidden = true;

    if (groups.length === 0) {
      els.emptyState.hidden = false;
    } else {
      showCurrentGroup();
    }
  } catch (err) {
    els.loading.hidden = true;
    if (!err.message.includes('Authentication')) {
      els.emptyState.hidden = false;
      els.emptyState.querySelector('.empty-title').textContent = 'Error';
      els.emptyState.querySelector('.empty-sub').textContent = err.message;
    }
  }
}

// ─── Fetch stats ───
async function fetchStats() {
  try {
    // Use the groups endpoint to count posted vs total
    const allParams = new URLSearchParams({ limit: '1' });
    const taskType = els.filterTaskType.value;
    if (taskType) allParams.set('taskType', taskType);

    const postedParams = new URLSearchParams({ status: 'POSTED', limit: '1' });
    if (taskType) postedParams.set('taskType', taskType);

    const [allData, postedData] = await Promise.all([
      apiFetch(`/groups?${allParams}`),
      apiFetch(`/groups?${postedParams}`),
    ]);

    totalGroups = allData.pagination.total;
    totalPosted = postedData.pagination.total;
  } catch {
    // Stats are non-critical
  }
}

// ─── Update progress UI ───
function updateProgress() {
  els.progressBar.hidden = false;
  const pending = totalGroups - totalPosted;
  els.progressText.textContent = `${totalPosted} / ${totalGroups} posted`;
  els.sessionText.textContent = sessionPosted > 0 ? `${sessionPosted} this session` : '';
  const pct = totalGroups > 0 ? (totalPosted / totalGroups) * 100 : 0;
  els.progressFill.style.width = `${pct}%`;
}

// ─── Show current group ───
async function showCurrentGroup() {
  if (currentIndex >= groups.length) {
    // Fetched page exhausted — try loading more
    await fetchGroups();
    return;
  }

  const group = groups[currentIndex];
  els.groupCard.hidden = false;
  els.emptyState.hidden = true;

  // Meta badges
  const TYPE_LABELS = { fb_post: 'FB Post', yt_comment: 'YT Comment', blog_comment: 'Blog Comment' };
  els.groupType.textContent = TYPE_LABELS[group.taskType] || group.taskType;
  els.groupLang.textContent = group.language.toUpperCase();
  els.groupCountry.textContent = group.country;
  if (group.campaign) {
    els.groupCampaign.textContent = group.campaign;
    els.groupCampaign.hidden = false;
  } else {
    els.groupCampaign.hidden = true;
  }

  // Position
  els.groupPosition.textContent = `${currentIndex + 1} of ${groups.length}`;

  // Name & URL
  els.groupName.textContent = group.name;
  els.groupUrl.href = group.url;
  els.groupUrl.textContent = group.taskType === 'yt_comment' ? 'Open Video in New Tab' : 'Open Group in New Tab';

  // Anti-spam check
  if (group.datePosted) {
    const posted = new Date(group.datePosted);
    const daysSince = Math.floor((Date.now() - posted.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince < SPAM_WARN_DAYS) {
      els.spamWarning.hidden = false;
      els.spamText.textContent = `Last posted ${daysSince === 0 ? 'today' : daysSince + 'd ago'} — may be flagged as spam`;
    } else {
      els.spamWarning.hidden = true;
    }
  } else {
    els.spamWarning.hidden = true;
  }

  // For yt_comment tasks: parse STEP 1 / STEP 2 notes format
  const isYtComment = group.taskType === 'yt_comment';

  if (isYtComment && group.notes) {
    const notesText = group.notes.trim();

    // Parse STEP 1 / STEP 2 format
    const step1Match = notesText.match(/STEP\s*1:\s*\n([\s\S]*?)(?=\n\s*\nSTEP\s*2:|$)/i);
    const step2Match = notesText.match(/STEP\s*2:\s*\n([\s\S]*?)$/i);

    const step1Text = step1Match ? step1Match[1].trim() : notesText.trim();
    const step2Text = step2Match ? step2Match[1].trim() : null;

    els.replySection.hidden = false;
    els.replyScore.textContent = group.priority ? `Score ${group.priority}/10` : '';

    // Show step 1 — relabel the existing button
    els.copyReplyBtn.textContent = 'Copy Step 1';
    els.copyReplyBtn.classList.remove('copied');
    // Store step 1 text in dataset for copy handler
    els.copyReplyBtn.dataset.stepText = step1Text;

    // Create or update step 2 button
    let step2Btn = document.getElementById('copyStep2Btn');
    if (step2Text) {
      if (!step2Btn) {
        step2Btn = document.createElement('button');
        step2Btn.id = 'copyStep2Btn';
        step2Btn.className = 'copy-btn';
        els.copyReplyBtn.parentNode.insertBefore(step2Btn, els.copyReplyBtn.nextSibling);
        step2Btn.addEventListener('click', () => {
          const text = step2Btn.dataset.stepText;
          if (text) copyToClipboard(text, step2Btn, 'Copy Step 2');
        });
      }
      step2Btn.textContent = 'Copy Step 2';
      step2Btn.classList.remove('copied');
      step2Btn.dataset.stepText = step2Text;
      step2Btn.hidden = false;

      // Show both steps in the reply body for readability
      els.replyBody.textContent = `STEP 1:\n${step1Text}\n\nSTEP 2:\n${step2Text}`;
    } else {
      if (step2Btn) step2Btn.hidden = true;
      els.replyBody.textContent = step1Text;
    }
  } else {
    els.replySection.hidden = true;
    const step2Btn = document.getElementById('copyStep2Btn');
    if (step2Btn) step2Btn.hidden = true;
  }

  // Ad copy
  const adId = group.adId;
  els.adNumber.textContent = group.ad ? `Ad #${group.ad.adNumber} (${group.ad.language})` : '';

  try {
    let ad = adCache[adId];
    if (!ad) {
      ad = await apiFetch(`/ads/${adId}`);
      adCache[adId] = ad;
    }
    els.adTitle.textContent = ad.title;
    els.adBody.textContent = ad.body;
  } catch {
    els.adTitle.textContent = 'Failed to load ad copy';
    els.adBody.textContent = '';
  }

  // For yt_comment: hide Copy Ad Text (ad body is instructions only)
  els.copyBtn.hidden = isYtComment;
  if (!isYtComment) {
    els.copyBtn.textContent = 'Copy Ad Text';
    els.copyBtn.classList.remove('copied');
  }

  // Clear notes (for yt_comment don't show raw notes in the input)
  els.notesInput.value = isYtComment ? '' : (group.notes || '');

  // Enable buttons
  setButtonsEnabled(true);
}

// ─── Generic copy helper ───
async function copyToClipboard(text, btn, defaultLabel) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
  btn.textContent = 'Copied!';
  btn.classList.add('copied');
  setTimeout(() => {
    btn.textContent = defaultLabel;
    btn.classList.remove('copied');
  }, 2000);
}

// ─── Copy ad text ───
els.copyBtn.addEventListener('click', () => {
  const text = els.adBody.textContent;
  if (text) copyToClipboard(text, els.copyBtn, 'Copy Ad Text');
});

// ─── Copy step 1 (or legacy reply) ───
els.copyReplyBtn.addEventListener('click', () => {
  // Use stored step text if available, fall back to replyBody content
  const text = els.copyReplyBtn.dataset.stepText || els.replyBody.textContent;
  const label = els.copyReplyBtn.textContent.startsWith('Copy Step') ? 'Copy Step 1' : 'Copy Reply';
  if (text) copyToClipboard(text, els.copyReplyBtn, label);
});

// ─── Action buttons ───
function setButtonsEnabled(enabled) {
  els.btnPosted.disabled = !enabled;
  els.btnJoined.disabled = !enabled;
  els.btnSkip.disabled = !enabled;
  els.btnReject.disabled = !enabled;
}

async function markGroup(status) {
  if (currentIndex >= groups.length) return;

  const group = groups[currentIndex];
  setButtonsEnabled(false);

  try {
    const body = { status };
    const notes = els.notesInput.value.trim();
    if (notes) body.notes = notes;

    await apiFetch(`/groups/${group.id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });

    if (status === 'POSTED') {
      sessionPosted++;
      totalPosted++;
    }

    // Advance to next group
    currentIndex++;
    updateProgress();

    if (currentIndex >= groups.length) {
      // Try fetching more
      await fetchGroups();
    } else {
      showCurrentGroup();
    }
  } catch (err) {
    setButtonsEnabled(true);
    if (!err.message.includes('Authentication')) {
      alert(`Failed to update: ${err.message}`);
    }
  }
}

els.btnPosted.addEventListener('click', () => markGroup('POSTED'));
els.btnJoined.addEventListener('click', () => markGroup('JOINED'));
els.btnSkip.addEventListener('click', () => markGroup('SKIPPED'));
els.btnReject.addEventListener('click', () => markGroup('REJECTED'));

// ─── Filters ───
function onFilterChange() {
  adCache = {};
  fetchGroups();
}

els.filterTaskType.addEventListener('change', onFilterChange);
els.filterLanguage.addEventListener('change', onFilterChange);
els.filterCountry.addEventListener('change', onFilterChange);

let campaignDebounce;
els.filterCampaign.addEventListener('input', () => {
  clearTimeout(campaignDebounce);
  campaignDebounce = setTimeout(onFilterChange, 500);
});

// ─── Populate filter dropdowns from data ───
async function populateFilters() {
  try {
    // Fetch a big batch to discover available languages/countries
    const params = new URLSearchParams({ status: 'PENDING', limit: '100' });
    const taskType = els.filterTaskType.value;
    if (taskType) params.set('taskType', taskType);

    const data = await apiFetch(`/groups?${params}`);
    const languages = new Set();
    const countries = new Set();

    for (const g of data.groups) {
      languages.add(g.language);
      countries.add(g.country);
    }

    // Language dropdown
    const langSelect = els.filterLanguage;
    const currentLang = langSelect.value;
    langSelect.innerHTML = '<option value="">All Languages</option>';
    for (const lang of [...languages].sort()) {
      const opt = document.createElement('option');
      opt.value = lang;
      opt.textContent = lang.toUpperCase();
      langSelect.appendChild(opt);
    }
    langSelect.value = currentLang;

    // Country dropdown
    const countrySelect = els.filterCountry;
    const currentCountry = countrySelect.value;
    countrySelect.innerHTML = '<option value="">All Countries</option>';
    for (const country of [...countries].sort()) {
      const opt = document.createElement('option');
      opt.value = country;
      opt.textContent = country;
      countrySelect.appendChild(opt);
    }
    countrySelect.value = currentCountry;
  } catch {
    // Non-critical
  }
}

// ─── Settings link ───
els.openSettings.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

// ─── Add Group: keyword matching ───
function matchAdNumber(slug) {
  const text = slug.toLowerCase();
  for (const entry of AD_KEYWORD_MAP) {
    for (const kw of entry.keywords) {
      if (new RegExp(kw, 'i').test(text)) {
        return entry.adNumber;
      }
    }
  }
  return FALLBACK_AD_NUMBER;
}

function matchCountry(slug) {
  const text = slug.toLowerCase();
  for (const entry of COUNTRY_KEYWORD_MAP) {
    for (const kw of entry.keywords) {
      if (new RegExp(kw, 'i').test(text)) {
        return entry.country;
      }
    }
  }
  return 'Global';
}

function slugFromUrl(url) {
  try {
    const match = url.match(/facebook\.com\/groups\/([^/?#]+)/);
    return match ? match[1] : '';
  } catch {
    return '';
  }
}

function nameFromSlug(slug) {
  return slug
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

// ─── Add Group: toggle collapse ───
els.addGroupToggle.addEventListener('click', () => {
  els.addGroupBody.classList.toggle('collapsed');
  els.addGroupChevron.classList.toggle('open');
});

// ─── Add Group: load ads for dropdown ───
async function loadAdsForForm() {
  try {
    const data = await apiFetch('/ads');
    allAds = data.ads || [];
    updateAdDropdown();
  } catch {
    // Non-critical — dropdown will be empty
  }
}

function updateAdDropdown() {
  const lang = els.addLanguage.value;
  const slug = slugFromUrl(els.addUrl.value);
  const suggestedAdNumber = matchAdNumber(slug);

  // Filter ads by selected language
  const filtered = allAds.filter((ad) => ad.language === lang);

  els.addAd.innerHTML = '';
  let bestMatch = null;

  for (const ad of filtered) {
    const opt = document.createElement('option');
    opt.value = ad.id;
    opt.textContent = `#${ad.adNumber} — ${ad.title}`;
    els.addAd.appendChild(opt);

    if (ad.adNumber === suggestedAdNumber && !bestMatch) {
      bestMatch = ad.id;
    }
  }

  // If no exact match, try the fallback ad number
  if (!bestMatch) {
    const fallback = filtered.find((ad) => ad.adNumber === FALLBACK_AD_NUMBER);
    if (fallback) bestMatch = fallback.id;
  }

  // Select the best match, or first available
  if (bestMatch) {
    els.addAd.value = bestMatch;
  }
}

// Re-filter ads when language changes
els.addLanguage.addEventListener('change', updateAdDropdown);

// ─── Add Group: detect tab URL ───
async function detectTabUrl() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) return;

    const slug = slugFromUrl(tab.url);
    if (slug) {
      // Auto-fill and expand the form when on a FB group page
      els.addUrl.value = tab.url.split('?')[0];
      els.addName.value = nameFromSlug(slug);
      els.addCountry.value = matchCountry(slug);
      els.addGroupBody.classList.remove('collapsed');
      els.addGroupChevron.classList.add('open');
      updateAdDropdown();
    }
  } catch {
    // Non-critical — form stays collapsed, user can still open manually
  }
}

// Re-suggest ad when URL is manually edited
let urlDebounce;
els.addUrl.addEventListener('input', () => {
  clearTimeout(urlDebounce);
  urlDebounce = setTimeout(() => {
    const slug = slugFromUrl(els.addUrl.value);
    if (slug) {
      if (!els.addName.value.trim()) {
        els.addName.value = nameFromSlug(slug);
      }
      els.addCountry.value = matchCountry(slug);
    }
    updateAdDropdown();
  }, 300);
});

// Listen for tab switches and URL changes
chrome.tabs.onActivated.addListener(() => detectTabUrl());
chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
  if (changeInfo.url || changeInfo.status === 'complete') {
    detectTabUrl();
  }
});

// ─── Add Group: submit ───
function showAddResult(message, isError) {
  els.addResult.hidden = false;
  els.addResult.textContent = message;
  els.addResult.className = `add-result ${isError ? 'error' : 'success'}`;
  if (!isError) {
    setTimeout(() => { els.addResult.hidden = true; }, 4000);
  }
}

els.addGroupBtn.addEventListener('click', async () => {
  const url = els.addUrl.value.trim();
  const name = els.addName.value.trim();
  const adId = els.addAd.value;
  const language = els.addLanguage.value;
  const country = els.addCountry.value.trim() || 'Global';
  const campaign = els.addCampaign.value.trim();

  if (!url || !name) {
    showAddResult('URL and name are required.', true);
    return;
  }
  if (!adId) {
    showAddResult('Please select an ad copy.', true);
    return;
  }

  els.addGroupBtn.disabled = true;
  els.addGroupBtn.textContent = 'Adding...';

  try {
    const payload = { name, url, adId, language, country, taskType: 'fb_post' };
    if (campaign) payload.campaign = campaign;

    const result = await apiFetch('/groups', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (result.skipped > 0 && result.created === 0) {
      showAddResult('Already in queue — skipped.', true);
      return;
    }

    showAddResult(`Added "${name}" to queue!`, false);

    // Reset form fields (keep URL and language)
    els.addName.value = '';
    els.addCountry.value = 'Global';
    els.addCampaign.value = '';

    // Refresh the queue below
    fetchGroups();
  } catch (err) {
    showAddResult(`Failed: ${err.message}`, true);
  } finally {
    els.addGroupBtn.disabled = false;
    els.addGroupBtn.textContent = 'Add to Queue';
  }
});

// ─── Update banner ───
async function checkUpdateBanner() {
  try {
    const { updateAvailable } = await chrome.storage.local.get('updateAvailable');
    const banner = document.getElementById('updateBanner');
    const versionEl = document.getElementById('updateVersion');
    if (updateAvailable) {
      versionEl.textContent = `v${updateAvailable}`;
      banner.hidden = false;
    } else {
      banner.hidden = true;
    }
  } catch {
    // Non-critical
  }
}

document.getElementById('updateBtn').addEventListener('click', async () => {
  const btn = document.getElementById('updateBtn');
  btn.disabled = true;
  btn.textContent = 'Downloading...';

  try {
    const url = `${config.apiUrl}/api/admin/posting/extension/download`;
    const headers = {};
    if (config.apiKey) headers['X-Admin-API-Key'] = config.apiKey;

    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error('Download failed');

    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = 'human-pages-extension.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);

    // Show step 2
    document.getElementById('updateStep1').hidden = true;
    document.getElementById('updateStep2').hidden = false;
  } catch {
    btn.textContent = 'Download failed';
    setTimeout(() => {
      btn.textContent = 'Download Update';
      btn.disabled = false;
    }, 3000);
  }
});

document.getElementById('reloadBtn').addEventListener('click', () => {
  chrome.runtime.reload();
});

// Listen for update flag changes from background
chrome.storage.onChanged.addListener((changes) => {
  if (changes.updateAvailable) {
    checkUpdateBanner();
  }
});

// ─── Init ───
async function init() {
  await loadConfig();

  if (!config.apiKey) {
    showAuthError();
    els.loading.hidden = true;
    return;
  }

  // Load clock status, ads for add-group form, and detect current tab in parallel
  await Promise.all([
    fetchClockStatus(),
    fetchTodayHours(),
    loadAdsForForm(),
    detectTabUrl(),
    populateFilters(),
    checkUpdateBanner(),
  ]);

  await fetchGroups();
}

// Re-init when config changes
chrome.storage.onChanged.addListener((changes) => {
  if (changes.apiUrl || changes.apiKey) {
    loadConfig().then(() => {
      hideAuthError();
      init();
    });
  }
});

init();
