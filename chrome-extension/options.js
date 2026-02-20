const DEFAULTS = {
  apiUrl: 'https://humanpages.ai',
  apiKey: '',
};

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get(DEFAULTS, (items) => {
    document.getElementById('apiUrl').value = items.apiUrl;
    document.getElementById('apiKey').value = items.apiKey;
  });
});

function saveSettings() {
  return new Promise((resolve) => {
    const apiUrl = document.getElementById('apiUrl').value.replace(/\/+$/, '') || DEFAULTS.apiUrl;
    const apiKey = document.getElementById('apiKey').value.trim();

    chrome.storage.sync.set({ apiUrl, apiKey }, () => {
      // Clean up legacy jwtToken from old installs
      chrome.storage.sync.remove('jwtToken');
      resolve({ apiUrl, apiKey });
    });
  });
}

document.getElementById('save').addEventListener('click', async () => {
  await saveSettings();
  const msg = document.getElementById('savedMsg');
  msg.classList.add('show');
  setTimeout(() => msg.classList.remove('show'), 2000);
});

document.getElementById('testBtn').addEventListener('click', async () => {
  const result = document.getElementById('testResult');
  const apiKey = document.getElementById('apiKey').value.trim();

  if (!apiKey) {
    result.className = 'error';
    result.textContent = 'Please enter an API key first.';
    result.style.display = 'block';
    return;
  }

  // Save first, then test — so the sidepanel picks up the key immediately
  const saved = await saveSettings();

  result.className = 'loading';
  result.textContent = 'Saving & testing connection...';
  result.style.display = 'block';

  try {
    const res = await fetch(`${saved.apiUrl}/api/admin/posting/groups?status=PENDING&limit=1`, {
      headers: { 'X-Admin-API-Key': saved.apiKey },
    });

    if (res.ok) {
      result.className = 'success';
      result.textContent = 'Connected successfully!';
    } else if (res.status === 401 || res.status === 403) {
      result.className = 'error';
      result.textContent = 'Invalid API key';
    } else {
      result.className = 'error';
      result.textContent = `Server error (HTTP ${res.status})`;
    }
  } catch (err) {
    result.className = 'error';
    result.textContent = `Connection failed: ${err.message}`;
  }
});
