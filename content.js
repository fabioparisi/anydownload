// Tracks the media element under the pointer at right-click time, even when the
// site covers the player with overlays or blocks the context menu entirely.

function findMedia(x, y, path) {
  // composedPath() pierces shadow DOM; elementsFromPoint() pierces overlays.
  const candidates = [...(path || []), ...document.elementsFromPoint(x, y)];
  for (const el of candidates) {
    if (!(el instanceof Element)) continue;
    if (el.matches("video, audio")) return el;
    if (el.shadowRoot) {
      const inner = el.shadowRoot.querySelector("video, audio");
      if (inner) return inner;
    }
    const inner = el.querySelector?.("video, audio");
    if (inner) return inner;
  }
  return null;
}

window.addEventListener(
  "contextmenu",
  (e) => {
    const media = findMedia(e.clientX, e.clientY, e.composedPath());
    let info = null;
    if (media) {
      const r = media.getBoundingClientRect();
      info = {
        kind: media.tagName.toLowerCase(),
        src: media.currentSrc || media.src || null,
        pageUrl: location.href,
        rect: { x: r.x, y: r.y, width: r.width, height: r.height },
        dpr: window.devicePixelRatio || 1,
      };
    }
    try {
      chrome.runtime.sendMessage({ type: "media-under-cursor", media: info });
    } catch (_) {
      // extension was reloaded; ignore
    }
    if (media) {
      // Neutralize site handlers that block the native context menu,
      // but only when there is actually media under the cursor.
      e.stopImmediatePropagation();
    }
  },
  true
);

// Used by the background worker for clipboard fallback.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "copy") {
    navigator.clipboard
      .writeText(msg.text)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }
  if (msg.type === "copy-image") {
    fetch(msg.dataUrl)
      .then((r) => r.blob())
      .then((b) => navigator.clipboard.write([new ClipboardItem({ "image/png": b })]))
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }
});
