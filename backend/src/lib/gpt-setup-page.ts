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
 */

export function getGptSetupGoHtml(mcpUrl: string, frontendUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Connect Human Pages to GPT</title>
  <meta name="description" content="One-click setup for Human Pages MCP connector in GPT">
  <meta property="og:title" content="Connect Human Pages to GPT">
  <meta property="og:description" content="Add Human Pages to your GPT in seconds">
  <meta property="og:url" content="${frontendUrl}/gpt-setup/go">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f172a;color:#f8fafc;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px}
    .card{max-width:480px;width:100%;padding:40px 28px;background:#1e293b;border-radius:20px;border:1px solid #334155;text-align:center;box-shadow:0 25px 50px rgba(0,0,0,.4)}
    @media(max-width:500px){.card{padding:32px 20px;border-radius:16px}}
    h1{font-size:24px;font-weight:700;margin-bottom:6px}
    @media(min-width:500px){h1{font-size:28px}}
    .subtitle{color:#94a3b8;font-size:14px;margin-bottom:28px}
    .url-box{background:#0f172a;border:2px solid #334155;border-radius:12px;padding:14px 16px;font-family:'SF Mono',Monaco,'Courier New',monospace;font-size:13px;color:#f97316;word-break:break-all;margin-bottom:20px;position:relative;cursor:pointer;transition:border-color .2s;-webkit-user-select:all;user-select:all}
    .url-box.copied{border-color:#16a34a}
    .copied-badge{position:absolute;top:-10px;right:12px;background:#16a34a;color:#fff;font-size:11px;font-weight:600;padding:2px 10px;border-radius:99px;opacity:0;transition:opacity .3s;pointer-events:none}
    .copied-badge.show{opacity:1}
    .steps{text-align:left;background:#0f172a;border-radius:12px;padding:16px 20px;margin-bottom:24px}
    .step{display:flex;gap:12px;padding:8px 0;font-size:14px;color:#cbd5e1}
    .step-num{flex-shrink:0;width:24px;height:24px;border-radius:50%;background:#f97316;color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center}
    .step.done .step-num{background:#16a34a}
    .btn-row{display:flex;flex-direction:column;gap:10px;margin-bottom:16px}
    @media(min-width:500px){.btn-row{flex-direction:row;justify-content:center}}
    .btn{display:flex;align-items:center;justify-content:center;padding:14px 24px;border-radius:12px;font-size:15px;font-weight:600;text-decoration:none;transition:all .15s;cursor:pointer;border:none;min-height:48px;-webkit-tap-highlight-color:transparent}
    .btn-primary{background:#f97316;color:#fff;flex:1}
    .btn-primary:hover{background:#ea580c}
    .btn-primary:active{transform:scale(.97)}
    .btn-secondary{background:#334155;color:#e2e8f0;flex:1}
    .btn-secondary:hover{background:#475569}
    .btn-secondary:active{transform:scale(.97)}
    .btn-success{background:#16a34a !important}
    .toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(80px);background:#16a34a;color:#fff;padding:12px 24px;border-radius:12px;font-size:14px;font-weight:600;opacity:0;transition:all .3s;pointer-events:none;z-index:10;white-space:nowrap;box-shadow:0 8px 24px rgba(0,0,0,.3)}
    .toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
    .mobile-note{display:none;margin-top:16px;padding:12px 16px;background:rgba(249,115,22,.08);border:1px solid #475569;border-radius:10px;font-size:13px;color:#94a3b8;line-height:1.6}
    .mobile-note strong{color:#e2e8f0}
    .share-btn{display:none;width:100%}
    .manual{margin-top:20px;font-size:13px;color:#64748b}
    .manual a{color:#f97316;text-decoration:none}
    .manual a:hover{text-decoration:underline}
    .logo{font-size:32px;margin-bottom:12px}
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">&#x1F91D;</div>
    <h1>Connect Human Pages</h1>
    <p class="subtitle">MCP Server for GPT</p>

    <div class="url-box" id="urlBox" onclick="copyUrl()">
      ${mcpUrl}
      <span class="copied-badge" id="copiedBadge">Copied!</span>
    </div>

    <div class="steps">
      <div class="step" id="step1">
        <span class="step-num">1</span>
        <span>Copy the MCP server URL above</span>
      </div>
      <div class="step" id="step2">
        <span class="step-num">2</span>
        <span>In GPT: Settings &rarr; Apps &rarr; Create</span>
      </div>
      <div class="step" id="step3">
        <span class="step-num">3</span>
        <span>Paste the URL, select OAuth &mdash; done!</span>
      </div>
    </div>

    <!-- Desktop: copy + open in one click -->
    <div class="btn-row" id="desktopBtns">
      <button class="btn btn-primary" id="mainBtn" onclick="copyAndOpen()">
        Copy URL &amp; Open GPT &rarr;
      </button>
      <button class="btn btn-secondary" onclick="copyUrl()">
        Copy URL Only
      </button>
    </div>

    <!-- Mobile: copy button + note about desktop -->
    <div class="btn-row" id="mobileBtns" style="display:none">
      <button class="btn btn-primary" id="mobileCopyBtn" onclick="copyUrl()">
        Copy MCP URL
      </button>
    </div>
    <div class="btn-row">
      <button class="btn btn-secondary share-btn" id="shareBtn" onclick="shareUrl()">
        Send URL to Yourself
      </button>
    </div>
    <div class="mobile-note" id="mobileNote">
      MCP connectors work in <strong>GPT on desktop</strong>. Open <strong>chatgpt.com</strong> on your computer, go to <strong>Settings &rarr; Apps &rarr; Create</strong>, and paste the URL.
    </div>

    <div class="manual">
      Need help? <a href="${frontendUrl}/en/gpt-setup">Full setup guide</a>
    </div>
  </div>

  <div class="toast" id="toast"></div>

  <script>
    var MCP_URL = ${JSON.stringify(mcpUrl)};

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
      if (mainBtn) {
        mainBtn.innerHTML = 'Open GPT \\u2192';
        mainBtn.onclick = function() { window.open('https://chatgpt.com', '_blank', 'noopener'); };
        mainBtn.classList.add('btn-success');
      }
      // Transform mobile button to show success
      var mobileBtn = document.getElementById('mobileCopyBtn');
      if (mobileBtn) {
        mobileBtn.innerHTML = '\\u2713 Copied! Tap to copy again';
        mobileBtn.classList.add('btn-success');
        // Reset after 3s so they can copy again
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
        }).catch(function() {
          fallbackCopy();
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
          showToast('Long-press the URL above to copy');
        }
      } catch(e) {
        showToast('Long-press the URL above to copy');
      }
    }

    // Desktop: copy + open GPT in a single user gesture (avoids popup blocker)
    function copyAndOpen() {
      if (hasClipboardAPI) {
        navigator.clipboard.writeText(MCP_URL).then(function() {
          markCopied();
          showToast('\\u2713 Copied! Opening GPT...');
          // Slight delay so toast is visible before tab switch
          setTimeout(function() {
            window.open('https://chatgpt.com', '_blank', 'noopener');
          }, 300);
        }).catch(function() {
          fallbackCopy();
          window.open('https://chatgpt.com', '_blank', 'noopener');
        });
      } else {
        fallbackCopy();
        window.open('https://chatgpt.com', '_blank', 'noopener');
      }
    }

    // Mobile: use Web Share API to send URL to self (email, notes, messages)
    function shareUrl() {
      if (hasShareAPI) {
        navigator.share({
          title: 'Human Pages MCP URL',
          text: 'Paste this in GPT Settings > Apps > Create:\\n' + MCP_URL
        }).catch(function() {});
      }
    }
  </script>
</body>
</html>`;
}
