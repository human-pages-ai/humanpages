// Open side panel when the extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

// Enable side panel on all URLs
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// ─── Update checker ───
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

async function checkForUpdate() {
  try {
    const { apiUrl, apiKey } = await chrome.storage.sync.get({ apiUrl: 'https://humanpages.ai', apiKey: '' });
    if (!apiKey) return;

    const res = await fetch(`${apiUrl}/api/admin/posting/extension/version`, {
      headers: { 'X-Admin-API-Key': apiKey },
    });
    if (!res.ok) return;

    const remote = await res.json();
    const manifest = chrome.runtime.getManifest();

    if (remote.version && remote.version !== manifest.version) {
      // New version available
      chrome.storage.local.set({ updateAvailable: remote.version });
      chrome.action.setBadgeText({ text: '!' });
      chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
    } else {
      chrome.storage.local.remove('updateAvailable');
      chrome.action.setBadgeText({ text: '' });
    }
  } catch {
    // Silent fail — update check is non-critical
  }
}

// Check on startup and periodically
checkForUpdate();
setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);

// Also check when config changes (new API key etc.)
chrome.storage.onChanged.addListener((changes) => {
  if (changes.apiUrl || changes.apiKey) {
    checkForUpdate();
  }
});
