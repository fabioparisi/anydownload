const HOST = "com.anydownload.ytdlp";

// tabId -> media info reported by the content script on last right-click
const mediaUnderCursor = new Map();

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === "media-under-cursor" && sender.tab) {
    mediaUnderCursor.set(sender.tab.id, msg.media);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => mediaUnderCursor.delete(tabId));

const MENUS = [
  ["open", "Open media in new tab"],
  ["copy", "Copy media URL"],
  ["dl-best", "Download (best quality)"],
  ["dl-mp4", "Download as MP4"],
  ["dl-mp3", "Extract audio (MP3)"],
];

// Reverse "video" search = reverse image search on the current frame.
// The frame is copied to the clipboard and the engine's paste-ready page opens.
const ENGINES = [
  ["search-lens", "Google Lens", "https://lens.google.com/"],
  ["search-yandex", "Yandex Images", "https://yandex.com/images/"],
  ["search-bing", "Bing Visual Search", "https://www.bing.com/visualsearch"],
  ["search-tineye", "TinEye", "https://tineye.com/"],
];

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: "parent", title: "AnyDownload", contexts: ["all"] });
  for (const [id, title] of MENUS) {
    chrome.contextMenus.create({ id, parentId: "parent", title, contexts: ["all"] });
  }
  chrome.contextMenus.create({ id: "search", parentId: "parent", title: "Search video frame in…", contexts: ["all"] });
  for (const [id, title] of ENGINES) {
    chrome.contextMenus.create({ id, parentId: "search", title, contexts: ["all"] });
  }
});

function resolveUrl(info, tab) {
  const m = mediaUnderCursor.get(tab?.id);
  // A real media src beats everything. blob: URLs are useless outside the page,
  // so for those we hand the page URL to yt-dlp and let it find the stream.
  const src = info.srcUrl || m?.src;
  if (src && !src.startsWith("blob:")) return src;
  return info.linkUrl || m?.pageUrl || info.pageUrl || tab?.url || null;
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const engine = ENGINES.find(([id]) => id === info.menuItemId);
  if (engine) return searchFrame(tab, engine[2]);
  const url = resolveUrl(info, tab);
  if (!url) return notify("AnyDownload", "No media or URL found here.");
  switch (info.menuItemId) {
    case "open":
      openBest(info, tab, url);
      break;
    case "copy":
      copyToClipboard(tab, url);
      break;
    case "dl-best":
      download(url, "best");
      break;
    case "dl-mp4":
      download(url, "mp4");
      break;
    case "dl-mp3":
      download(url, "mp3");
      break;
  }
});

function copyToClipboard(tab, text) {
  chrome.tabs
    .sendMessage(tab.id, { type: "copy", text })
    .then((r) => notify("AnyDownload", r?.ok ? "URL copied." : text))
    .catch(() => notify("AnyDownload", text));
}

function download(url, format) {
  notify("AnyDownload", `Sending to yt-dlp (${format})…`);
  const port = chrome.runtime.connectNative(HOST);
  let gotReply = false;
  port.onMessage.addListener((msg) => {
    gotReply = true;
    if (msg.ok) {
      notify("Download complete", msg.file || url);
    } else {
      notify("Download failed", (msg.error || "unknown error").slice(0, 300));
    }
  });
  port.onDisconnect.addListener(() => {
    if (!gotReply) {
      const err = chrome.runtime.lastError?.message || "no response";
      notify("AnyDownload", `Native host not reachable (${err}). Run install.sh and reload the extension.`);
    }
  });
  port.postMessage({ action: "download", url, format });
}

// Open the highest-quality stream, not whatever variant the player happened to
// be using: ask yt-dlp to resolve the best tab-playable URL from the page,
// fall back to the raw src if the host is unreachable or the site unsupported.
function openBest(info, tab, fallbackUrl) {
  const m = mediaUnderCursor.get(tab?.id);
  const sourceUrl = info.linkUrl || m?.pageUrl || info.pageUrl || tab?.url || fallbackUrl;
  notify("AnyDownload", "Resolving best quality…");
  const port = chrome.runtime.connectNative(HOST);
  let done = false;
  port.onMessage.addListener((msg) => {
    done = true;
    openStream(msg.ok && msg.url ? msg.url : fallbackUrl);
  });
  port.onDisconnect.addListener(() => {
    if (!done) openStream(fallbackUrl);
  });
  port.postMessage({ action: "geturl", url: sourceUrl });
}

// HLS playlists can't play in a plain tab — route them to the bundled player.
function openStream(url) {
  const target = /\.m3u8($|\?)/.test(url)
    ? chrome.runtime.getURL(`player.html?src=${encodeURIComponent(url)}`)
    : url;
  chrome.tabs.create({ url: target });
}

async function searchFrame(tab, engineUrl) {
  try {
    const m = mediaUnderCursor.get(tab.id);
    const shot = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
    const frame = m?.rect ? await crop(shot, m.rect, m.dpr || 1) : shot;
    // Copy BEFORE opening the tab (clipboard writes need the page focused):
    // it's the manual fallback if the auto-paste below doesn't take.
    await chrome.tabs.sendMessage(tab.id, { type: "copy-image", dataUrl: frame }).catch(() => null);
    const newTab = await chrome.tabs.create({ url: engineUrl });
    injectFrameOnLoad(newTab.id, frame);
    notify("AnyDownload", "Searching the frame — if nothing loads, press Cmd+V (it's in the clipboard).");
  } catch (e) {
    notify("AnyDownload", `Frame capture failed: ${String(e).slice(0, 200)}`);
  }
}

// Once the engine page loads, feed it the frame as a synthetic paste event —
// same mechanism the engines use for a real Cmd+V. Two attempts, because some
// pages attach their paste listeners late.
function injectFrameOnLoad(tabId, dataUrl) {
  const listener = (id, changeInfo) => {
    if (id !== tabId || changeInfo.status !== "complete") return;
    chrome.tabs.onUpdated.removeListener(listener);
    for (const delay of [1000, 3000]) {
      setTimeout(() => {
        chrome.scripting
          .executeScript({ target: { tabId }, world: "MAIN", func: pasteFrame, args: [dataUrl] })
          .catch(() => {});
      }, delay);
    }
  };
  chrome.tabs.onUpdated.addListener(listener);
}

// Runs in the engine page. Decodes the PNG without fetch() so strict CSPs
// (Google) can't block it, then dispatches a paste carrying the file.
function pasteFrame(dataUrl) {
  if (window.__anydownloadPasted) return;
  const b64 = dataUrl.split(",")[1];
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const file = new File([bytes], "frame.png", { type: "image/png" });
  const dt = new DataTransfer();
  dt.items.add(file);
  const ev = new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true });
  (document.activeElement || document.body).dispatchEvent(ev);
  if (ev.defaultPrevented) window.__anydownloadPasted = true;
}

// Crop the viewport screenshot down to the media element's box (CSS px * devicePixelRatio).
async function crop(dataUrl, rect, dpr) {
  const bmp = await createImageBitmap(await (await fetch(dataUrl)).blob());
  const x = Math.max(0, rect.x * dpr);
  const y = Math.max(0, rect.y * dpr);
  const w = Math.max(1, Math.min(rect.width * dpr, bmp.width - x));
  const h = Math.max(1, Math.min(rect.height * dpr, bmp.height - y));
  const canvas = new OffscreenCanvas(w, h);
  canvas.getContext("2d").drawImage(bmp, x, y, w, h, 0, 0, w, h);
  const blob = await canvas.convertToBlob({ type: "image/png" });
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}

function notify(title, message) {
  chrome.notifications.create({ type: "basic", iconUrl: "icon.png", title, message });
}
