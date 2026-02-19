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

// ─── DOM refs ───
const $ = (id) => document.getElementById(id);

const els = {
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
  notesInput: $('notesInput'),
  btnPosted: $('btnPosted'),
  btnSkip: $('btnSkip'),
  btnReject: $('btnReject'),
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

// ─── Auth error ───
function showAuthError() {
  els.authError.hidden = false;
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

  // Reset copy button
  els.copyBtn.textContent = 'Copy Ad Text';
  els.copyBtn.classList.remove('copied');

  // Clear notes
  els.notesInput.value = group.notes || '';

  // Enable buttons
  setButtonsEnabled(true);
}

// ─── Copy ad text ───
els.copyBtn.addEventListener('click', async () => {
  const text = els.adBody.textContent;
  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);
    els.copyBtn.textContent = 'Copied!';
    els.copyBtn.classList.add('copied');
    setTimeout(() => {
      els.copyBtn.textContent = 'Copy Ad Text';
      els.copyBtn.classList.remove('copied');
    }, 2000);
  } catch {
    // Fallback
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    els.copyBtn.textContent = 'Copied!';
    els.copyBtn.classList.add('copied');
    setTimeout(() => {
      els.copyBtn.textContent = 'Copy Ad Text';
      els.copyBtn.classList.remove('copied');
    }, 2000);
  }
});

// ─── Action buttons ───
function setButtonsEnabled(enabled) {
  els.btnPosted.disabled = !enabled;
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

// ─── Init ───
async function init() {
  await loadConfig();

  if (!config.apiKey) {
    showAuthError();
    els.loading.hidden = true;
    return;
  }

  await populateFilters();
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
