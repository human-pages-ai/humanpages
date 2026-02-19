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

document.getElementById('save').addEventListener('click', () => {
  const apiUrl = document.getElementById('apiUrl').value.replace(/\/+$/, '') || DEFAULTS.apiUrl;
  const apiKey = document.getElementById('apiKey').value.trim();

  chrome.storage.sync.set({ apiUrl, apiKey }, () => {
    // Clean up legacy jwtToken from old installs
    chrome.storage.sync.remove('jwtToken');
    const msg = document.getElementById('savedMsg');
    msg.classList.add('show');
    setTimeout(() => msg.classList.remove('show'), 2000);
  });
});

document.getElementById('testBtn').addEventListener('click', async () => {
  const result = document.getElementById('testResult');
  const apiUrl = document.getElementById('apiUrl').value.replace(/\/+$/, '') || DEFAULTS.apiUrl;
  const apiKey = document.getElementById('apiKey').value.trim();

  if (!apiKey) {
    result.className = 'error';
    result.textContent = 'Please enter an API key first.';
    result.style.display = 'block';
    return;
  }

  result.className = 'loading';
  result.textContent = 'Testing connection...';
  result.style.display = 'block';

  try {
    const res = await fetch(`${apiUrl}/api/admin/posting/groups?status=PENDING&limit=1`, {
      headers: { 'X-Admin-API-Key': apiKey },
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
