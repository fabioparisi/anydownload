# Media Tools

Right-click any **video or audio** in Chrome — even when it's buried under overlays or the site blocks the context menu — and open it, copy its real URL, or download it with **yt-dlp**.

Inspired by [dessant/search-by-image](https://github.com/dessant/search-by-image), but for media instead of images.

## What it does

Right-click on (or near) any player:

```
Media Tools
├── Open media in new tab
├── Copy media URL
├── Download (best quality)
├── Download as MP4
└── Extract audio (MP3)
```

- Finds the `<video>`/`<audio>` element under the cursor with `elementsFromPoint()` + `composedPath()`, so overlays, custom controls and Shadow DOM don't hide it.
- Re-enables the native context menu on sites that block right-click (only when media is actually under the cursor).
- Direct `.mp4`/`.mp3` sources are used as-is; `blob:` and MSE streams fall back to handing the **page URL** to yt-dlp, which resolves the real stream for any of its [thousands of supported sites](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md).
- Downloads land in `~/Downloads`, with a Chrome notification on completion.

Chrome extensions can't run local programs directly, so downloads go through a tiny [Native Messaging](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging) host (stdlib-only Python, ~80 lines) that runs `yt-dlp` with the URL passed as a plain argument — never through a shell.

## Requirements

- macOS, Google Chrome
- `yt-dlp` and `ffmpeg`: `brew install yt-dlp ffmpeg`
- Python 3 (the system one is fine — the host uses only the standard library)

## Install

1. Clone this repo.
2. `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select the repo folder.
3. Copy the extension ID shown on the card, then:

   ```bash
   ./install.sh <EXTENSION_ID>
   ```

4. Reload the extension. Done.

`install.sh` just writes the native-host manifest to `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/` pointing at `host/media_tools_host.py`, allowed only for your extension ID.

## Limits

- **No DRM.** Widevine/EME streams (Netflix, Prime Video, etc.) are out of scope — this tool doesn't and won't bypass content protection. Use it for public media, your own content, or media you're authorized to save.
- Live streams work only as well as yt-dlp handles them for that site.
- macOS/Chrome paths are hardcoded in `install.sh`; Linux/Chromium users need to adjust the `NativeMessagingHosts` directory.

## Files

| File | Role |
|---|---|
| `manifest.json` | MV3 extension manifest |
| `content.js` | Finds media under the cursor, unblocks right-click |
| `background.js` | Context menus, notifications, talks to the native host |
| `host/media_tools_host.py` | Runs yt-dlp, replies over stdio |
| `install.sh` | Registers the native host for your extension ID |

## License

MIT
