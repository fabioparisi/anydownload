const HOST = "com.mediatools.ytdlp";

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

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: "parent", title: "Media Tools", contexts: ["all"] });
  for (const [id, title] of MENUS) {
    chrome.contextMenus.create({ id, parentId: "parent", title, contexts: ["all"] });
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
  const url = resolveUrl(info, tab);
  if (!url) return notify("Media Tools", "No media or URL found here.");
  switch (info.menuItemId) {
    case "open":
      chrome.tabs.create({ url });
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
    .then((r) => notify("Media Tools", r?.ok ? "URL copied." : text))
    .catch(() => notify("Media Tools", text));
}

function download(url, format) {
  notify("Media Tools", `Sending to yt-dlp (${format})…`);
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
      notify("Media Tools", `Native host not reachable (${err}). Run install.sh and reload the extension.`);
    }
  });
  port.postMessage({ action: "download", url, format });
}

function notify(title, message) {
  chrome.notifications.create({ type: "basic", iconUrl: "icon.png", title, message });
}
