/**
 * Self-contained landing page HTML for /gpt-setup/go
 *
 * Mobile-first, tap-driven design that handles:
 *   - Desktop Chrome/Safari/Firefox: clipboard API + window.open in same gesture
 *   - iOS Safari: contentEditable textarea fallback for copy
 *   - Android Chrome: clipboard API with user gesture requirement
 *   - Facebook/Instagram in-app browser: user-select:all + Web Share API fallback
 *   - Older browsers: execCommand('copy') fallback
 *
 * MCP connectors require GPT desktop, so mobile users get instructions
 * to open GPT on their computer + a way to send the URL to themselves.
 *
 * Security: mcpUrl is escaped to prevent XSS via </script> injection.
 * Accessibility: WCAG AA compliant — focus indicators, ARIA, contrast, touch targets.
 */

/** Escape a string for safe embedding in a <script> block (prevents </script> XSS). */
function escapeForScript(str: string): string {
  return JSON.stringify(str)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

/** Escape HTML special characters for safe embedding in attributes/content. */
function escapeHtmlAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function getGptSetupGoHtml(mcpUrl: string, frontendUrl: string): string {
  const safeUrl = escapeHtmlAttr(mcpUrl);
  const safeFrontendUrl = escapeHtmlAttr(frontendUrl);
  const scriptUrl = escapeForScript(mcpUrl);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Connect Human Pages to GPT</title>
  <meta name="description" content="One-click setup for Human Pages MCP connector in GPT">
  <meta name="theme-color" content="#1e293b">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <meta property="og:title" content="Connect Human Pages to GPT">
  <meta property="og:description" content="Add Human Pages to your GPT in seconds">
  <meta property="og:url" content="${safeFrontendUrl}/gpt-setup/go">
  <meta property="og:type" content="website">
  <meta property="og:image" content="${safeFrontendUrl}/og-gpt-setup.png">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="Connect Human Pages to GPT">
  <meta name="twitter:description" content="Add Human Pages to your GPT in seconds">
  <meta name="twitter:image" content="${safeFrontendUrl}/og-gpt-setup.png">
  <link rel="canonical" href="${safeFrontendUrl}/gpt-setup/go">
  <link rel="icon" href="${safeFrontendUrl}/favicon.ico">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f172a;color:#f8fafc;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px}
    main{max-width:480px;width:100%}
    .card{padding:40px 28px;background:#1e293b;border-radius:20px;border:1px solid #334155;text-align:center;box-shadow:0 25px 50px rgba(0,0,0,.4);animation:fadeIn .4s ease-out}
    @keyframes fadeIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
    @media(max-width:500px){.card{padding:32px 20px;border-radius:16px}}
    @media(max-width:360px){.card{padding:24px 16px}}
    h1{font-size:24px;font-weight:700;margin-bottom:6px}
    @media(min-width:500px){h1{font-size:28px}}
    .subtitle{color:#94a3b8;font-size:14px;margin-bottom:28px}
    .url-box{background:#0f172a;border:2px solid #334155;border-radius:12px;padding:14px 16px;font-family:'SF Mono',Monaco,'Courier New',monospace;font-size:14px;color:#f97316;word-break:break-all;margin-bottom:20px;position:relative;cursor:pointer;transition:border-color .2s;-webkit-user-select:all;user-select:all;min-height:48px}
    @media(max-width:360px){.url-box{font-size:12px;padding:12px 12px}}
    .url-box:hover,.url-box:focus{border-color:#f97316;outline:none}
    .url-box.copied{border-color:#16a34a}
    .copied-badge{position:absolute;top:-10px;right:12px;background:#16a34a;color:#fff;font-size:11px;font-weight:600;padding:2px 10px;border-radius:99px;opacity:0;transition:opacity .3s;pointer-events:none;will-change:opacity}
    .copied-badge.show{opacity:1}
    .steps{text-align:left;background:#0f172a;border-radius:12px;padding:16px 20px;margin-bottom:24px;list-style:none;counter-reset:step}
    .step{display:flex;gap:12px;padding:8px 0;font-size:14px;color:#cbd5e1;align-items:center}
    @media(max-width:360px){.step{gap:8px;font-size:13px;padding:6px 0}}
    .step-num{flex-shrink:0;width:28px;height:28px;border-radius:50%;background:#f97316;color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center}
    .step.done .step-num{background:#16a34a}
    .btn-row{display:flex;flex-direction:column;gap:10px;margin-bottom:12px}
    @media(min-width:500px){.btn-row{flex-direction:row;justify-content:center}}
    .btn{display:flex;align-items:center;justify-content:center;padding:14px 24px;border-radius:12px;font-size:15px;font-weight:600;text-decoration:none;transition:all .15s;cursor:pointer;border:none;min-height:48px;-webkit-tap-highlight-color:transparent;color:#fff}
    .btn:focus-visible{outline:3px solid #f97316;outline-offset:2px}
    .btn-primary{background:#f97316;flex:1}
    .btn-primary:hover{background:#ea580c}
    .btn-primary:active{transform:scale(.97)}
    .btn-secondary{background:#334155;color:#e2e8f0;flex:1}
    .btn-secondary:hover{background:#475569}
    .btn-secondary:active{transform:scale(.97)}
    .btn-success{background:#16a34a !important}
    .btn:disabled{opacity:.7;cursor:wait}
    .toast{position:fixed;bottom:max(24px,env(safe-area-inset-bottom,0px));left:50%;transform:translateX(-50%) translateY(80px);background:#16a34a;color:#fff;padding:12px 24px;border-radius:12px;font-size:14px;font-weight:600;opacity:0;transition:all .3s;pointer-events:none;z-index:10;white-space:nowrap;box-shadow:0 8px 24px rgba(0,0,0,.3);will-change:transform}
    .toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
    .mobile-note{display:none;margin-top:16px;padding:12px 16px;background:rgba(249,115,22,.06);border:1px solid #475569;border-radius:10px;font-size:13px;color:#94a3b8;line-height:1.6}
    .mobile-note strong{color:#e2e8f0}
    .share-btn{display:none;width:100%}
    .manual{margin-top:20px;font-size:13px;color:#8b97ad}
    .manual a{color:#f97316;text-decoration:none}
    .manual a:hover{text-decoration:underline}
    .manual a:focus-visible{outline:2px solid #f97316;outline-offset:2px;border-radius:2px}
    .logo{font-size:32px;margin-bottom:12px}
    .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0}
  </style>
</head>
<body>
  <main>
    <div class="card">
      <div class="logo" role="img" aria-label="Handshake">&#x1F91D;</div>
      <h1>Connect Human Pages</h1>
      <p class="subtitle">MCP Server for GPT</p>

      <div class="url-box" id="urlBox"
           role="button" tabindex="0"
           aria-label="MCP server URL. Click to copy to clipboard."
           onclick="copyUrl()"
           onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();copyUrl()}">
        ${safeUrl}
        <span class="copied-badge" id="copiedBadge" aria-live="polite">Copied!</span>
      </div>

      <ol class="steps" aria-label="Setup steps">
        <li class="step" id="step1">
          <span class="step-num" aria-hidden="true">1</span>
          <span>Copy the MCP server URL above</span>
        </li>
        <li class="step" id="step2">
          <span class="step-num" aria-hidden="true">2</span>
          <span>In GPT: Settings &rarr; Apps &rarr; Create</span>
        </li>
        <li class="step" id="step3">
          <span class="step-num" aria-hidden="true">3</span>
          <span>Paste the URL, select OAuth &mdash; done!</span>
        </li>
      </ol>

      <!-- Desktop: copy + open in one click -->
      <div class="btn-row" id="desktopBtns">
        <button class="btn btn-primary" id="mainBtn"
                aria-label="Copy MCP URL to clipboard and open GPT in a new tab"
                onclick="copyAndOpen()">
          Copy URL &amp; Open GPT &rarr;
        </button>
        <button class="btn btn-secondary"
                aria-label="Copy MCP URL to clipboard"
                onclick="copyUrl()">
          Copy URL Only
        </button>
      </div>

      <!-- Mobile: copy button + note about desktop -->
      <div class="btn-row" id="mobileBtns" style="display:none">
        <button class="btn btn-primary" id="mobileCopyBtn"
                aria-label="Copy MCP URL to clipboard"
                onclick="copyUrl()">
          Copy MCP URL
        </button>
      </div>
      <div class="btn-row">
        <button class="btn btn-secondary share-btn" id="shareBtn"
                aria-label="Share MCP URL via your device's share menu"
                onclick="shareUrl()">
          Send URL to Yourself
        </button>
      </div>
      <div class="mobile-note" id="mobileNote">
        MCP connectors work in <strong>GPT on desktop</strong>. Open <strong>chatgpt.com</strong> on your computer, go to <strong>Settings &rarr; Apps &rarr; Create</strong>, and paste the URL.
      </div>

      <div class="manual">
        Need help? <a href="${safeFrontendUrl}/en/gpt-setup" rel="noopener">Full setup guide</a>
      </div>
    </div>

    <noscript>
      <div style="text-align:center;margin-top:20px;color:#f97316;font-size:14px">
        JavaScript is needed for copy buttons. You can still select and copy the URL above manually.
        <a href="${safeFrontendUrl}/en/gpt-setup" style="color:#f97316;text-decoration:underline">View setup guide</a>
      </div>
    </noscript>
  </main>

  <div class="toast" id="toast" role="status" aria-live="polite"></div>

  <script>
    var MCP_URL = ${scriptUrl};

    // Detect environment
    var isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    var isInAppBrowser = /FBAN|FBAV|Instagram|Line\\/|Twitter|Snapchat/i.test(navigator.userAgent);
    var hasClipboardAPI = !!(navigator.clipboard && navigator.clipboard.writeText);
    var hasShareAPI = !!navigator.share;

    // Show correct UI for mobile vs desktop
    if (isMobile || isInAppBrowser) {
      document.getElementById('desktopBtns').style.display = 'none';
      document.getElementById('mobileBtns').style.display = 'flex';
      document.getElementById('mobileNote').style.display = 'block';
      if (hasShareAPI) {
        document.getElementById('shareBtn').style.display = 'flex';
      }
    }

    function showToast(msg) {
      var t = document.getElementById('toast');
      t.textContent = msg;
      t.classList.add('show');
      setTimeout(function() { t.classList.remove('show'); }, 2500);
    }

    function markCopied() {
      var badge = document.getElementById('copiedBadge');
      badge.classList.add('show');
      document.getElementById('urlBox').classList.add('copied');
      document.getElementById('step1').classList.add('done');

      // Transform desktop button to just "Open GPT"
      var mainBtn = document.getElementById('mainBtn');
      if (mainBtn && !mainBtn.dataset.transformed) {
        mainBtn.dataset.transformed = '1';
        mainBtn.innerHTML = 'Open GPT \\u2192';
        mainBtn.setAttribute('aria-label', 'Open GPT in a new tab');
        mainBtn.onclick = function() { window.open('https://chatgpt.com', '_blank', 'noopener'); };
        mainBtn.classList.add('btn-success');
      }
      // Transform mobile button to show success
      var mobileBtn = document.getElementById('mobileCopyBtn');
      if (mobileBtn) {
        mobileBtn.innerHTML = '\\u2713 Copied! Tap to copy again';
        mobileBtn.classList.add('btn-success');
        setTimeout(function() {
          mobileBtn.innerHTML = 'Copy MCP URL';
          mobileBtn.classList.remove('btn-success');
        }, 3000);
      }

      setTimeout(function() { badge.classList.remove('show'); }, 3000);
    }

    function copyUrl() {
      if (hasClipboardAPI) {
        navigator.clipboard.writeText(MCP_URL).then(function() {
          markCopied();
          showToast('\\u2713 URL copied to clipboard');
        }).catch(function(err) {
          if (err && err.name === 'NotAllowedError') {
            showToast('Clipboard blocked \\u2014 long-press the URL to copy');
          } else {
            fallbackCopy();
          }
        });
      } else {
        fallbackCopy();
      }
    }

    function fallbackCopy() {
      try {
        var ta = document.createElement('textarea');
        ta.value = MCP_URL;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
        document.body.appendChild(ta);

        // iOS Safari needs contentEditable + range selection
        if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
          ta.contentEditable = 'true';
          ta.readOnly = false;
          var range = document.createRange();
          range.selectNodeContents(ta);
          var sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
          ta.setSelectionRange(0, 999999);
        } else {
          ta.select();
        }

        var ok = document.execCommand('copy');
        document.body.removeChild(ta);

        if (ok) {
          markCopied();
          showToast('\\u2713 URL copied to clipboard');
        } else {
          showToast('Select the URL above and copy manually');
        }
      } catch(e) {
        showToast('Select the URL above and copy manually');
      }
    }

    // Desktop: copy + open GPT in a single user gesture (avoids popup blocker)
    function copyAndOpen() {
      var btn = document.getElementById('mainBtn');
      if (btn) { btn.disabled = true; btn.innerHTML = 'Copying...'; }

      function openGpt() {
        if (btn) { btn.disabled = false; }
        markCopied();
        showToast('\\u2713 Copied! Opening GPT...');
        setTimeout(function() {
          window.open('https://chatgpt.com', '_blank', 'noopener');
        }, 250);
      }

      if (hasClipboardAPI) {
        navigator.clipboard.writeText(MCP_URL).then(openGpt).catch(function() {
          fallbackCopy();
          if (btn) { btn.disabled = false; }
          window.open('https://chatgpt.com', '_blank', 'noopener');
        });
      } else {
        fallbackCopy();
        if (btn) { btn.disabled = false; }
        window.open('https://chatgpt.com', '_blank', 'noopener');
      }
    }

    // Mobile: use Web Share API to send URL to self (email, notes, messages)
    function shareUrl() {
      if (hasShareAPI) {
        navigator.share({
          title: 'Human Pages MCP URL',
          text: 'Paste this in GPT Settings > Apps > Create:\\n' + MCP_URL
        }).catch(function(err) {
          if (err && err.name !== 'AbortError') {
            showToast('Share failed \\u2014 copy the URL instead');
          }
        });
      }
    }
  </script>
</body>
</html>`;
}
