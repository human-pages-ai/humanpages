# Auto-Detect Browser & Direct Extension Download

**Status:** Planned
**Priority:** Low (UX improvement)
**Motivation:** Reduce friction in the MetaMask wallet setup flow by skipping the generic MetaMask page and sending users directly to the correct extension download for their browser.

---

## Overview

Currently, when a user needs to install MetaMask, we link them to the MetaMask website where they have to figure out which browser extension to download. This adds an unnecessary step and potential drop-off point.

Instead, we should auto-detect the user's browser via `navigator.userAgent` and deep-link them directly to the correct web store listing:

| Browser | Store URL |
|---------|-----------|
| Chrome / Brave / Edge (Chromium) | Chrome Web Store |
| Firefox | Firefox Add-ons |
| Safari | Not supported (show message) |
| Mobile | App Store / Google Play |

---

## Design

### Detection Logic

Use `navigator.userAgent` (with fallback to `navigator.userAgentData` for Chromium browsers) to determine the browser:

- **Chrome / Brave / Edge / Opera** → Chrome Web Store (all Chromium-based share the same extension)
- **Firefox** → Firefox Add-ons
- **Safari / unsupported** → Show message explaining MetaMask isn't available, suggest alternative browsers
- **Mobile (iOS)** → Apple App Store
- **Mobile (Android)** → Google Play Store

### UX Flow

**Current:**
1. User clicks "Install MetaMask"
2. Lands on metamask.io/download
3. User finds their browser
4. Clicks through to extension store
5. Installs

**Proposed:**
1. User clicks "Install MetaMask"
2. Goes directly to their browser's extension store listing
3. Installs

For unsupported browsers, show an inline message with links to all supported options instead of redirecting.

---

## Frontend Changes

- [ ] Add browser detection utility (`utils/browserDetect.ts`)
- [ ] Update MetaMask install button/link to use dynamic URL
- [ ] Handle unsupported browser case with helpful fallback message
- [ ] Test across Chrome, Firefox, Brave, Edge, Safari, mobile browsers

---

## Implementation Notes

- Keep it simple: a single utility function that returns the correct URL
- No backend changes needed
- Consider caching the detection result since `userAgent` doesn't change mid-session

---

## Open Questions

1. **Should we support other wallets?** If we add WalletConnect or Coinbase Wallet later, same pattern applies.
2. **Brave Wallet:** Brave has a built-in wallet — should we detect Brave and offer to use the native wallet instead of MetaMask?
