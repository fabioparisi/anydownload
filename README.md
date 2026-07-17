# AnyDownload

Right-click any **video or audio** in Chrome — even when it's buried under overlays or the site blocks the context menu — and open it, copy its real URL, or download it with **yt-dlp**.

Inspired by [dessant/search-by-image](https://github.com/dessant/search-by-image), but for media instead of images: like Search by Image, it adds a single entry to the right-click menu that expands into a submenu of actions.

## What it does

Right-click on (or near) any player and you get:

```
Right-click menu
└── AnyDownload ▸
    ├── Open media in new tab
    ├── Copy media URL
    ├── Download (best quality)
    ├── Download as MP4
    ├── Extract audio (MP3)
    └── Search video frame in… ▸
        ├── Google Lens
        ├── Yandex Images
        ├── Bing Visual Search
        └── TinEye
```

- Finds the `<video>`/`<audio>` element under the cursor with `elementsFromPoint()` + `composedPath()`, so overlays, custom controls and Shadow DOM don't hide it.
- Re-enables the native context menu on sites that block right-click (only when media is actually under the cursor).
- Direct `.mp4`/`.mp3` sources are used as-is; `blob:` and MSE streams fall back to handing the **page URL** to yt-dlp, which resolves the real stream for any of its [thousands of supported sites](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md).
- Downloads land in `~/Downloads`, with a Chrome notification on completion.
- **Reverse video search**: no public search engine accepts a video as a query, so AnyDownload does what actually works — it screenshots the current frame of the player under the cursor, copies it to your clipboard, and opens the chosen image engine so you can paste it (Cmd+V). Great for finding the original source, a higher-resolution version, or the full video (Yandex is usually the strongest at tracing video frames back to their source).

Chrome extensions can't run local programs directly, so downloads go through a tiny [Native Messaging](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging) host (stdlib-only Python, ~80 lines) that runs `yt-dlp` with the URL passed as a plain argument — never through a shell.

## Requirements

- macOS, Google Chrome
- `yt-dlp` and `ffmpeg`: `brew install yt-dlp ffmpeg`
- Python 3 (the system one is fine — the host uses only the standard library)

## Install (human)

1. Clone this repo:

   ```bash
   git clone https://github.com/fabioparisi/anydownload.git
   cd anydownload
   ```

2. Open `chrome://extensions` → enable **Developer mode** (top right) → **Load unpacked** → select the cloned folder.
3. Copy the extension ID shown on the AnyDownload card (a 32-letter string), then:

   ```bash
   ./install.sh <EXTENSION_ID>
   ```

4. Back in `chrome://extensions`, hit the reload arrow on the AnyDownload card. Done — right-click any video to test.

`install.sh` writes the native-host manifest to `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.anydownload.ytdlp.json`, pointing at `host/anydownload_host.py` and allowed only for your extension ID.

## Install (AI agent — Claude Code, Codex, etc.)

Paste this to your agent:

> Install https://github.com/fabioparisi/anydownload following the AGENT INSTALL steps in its README.

<details>
<summary><b>AGENT INSTALL — exact steps for an LLM agent</b></summary>

Follow these steps in order. Steps 1–2 and 5 are shell commands you run yourself; steps 3–4 need the user because loading an unpacked extension is a GUI action in Chrome.

1. **Check prerequisites** (install any that are missing):

   ```bash
   command -v yt-dlp || brew install yt-dlp
   command -v ffmpeg || brew install ffmpeg
   ```

2. **Clone the repo** somewhere permanent — NOT a temp dir. Chrome loads the extension and the native host from this folder forever, so if it gets deleted the tool breaks:

   ```bash
   git clone https://github.com/fabioparisi/anydownload.git ~/anydownload
   ```

3. **Ask the user to load the extension** (you cannot do this step): tell them to open `chrome://extensions`, enable **Developer mode** (toggle, top right), click **Load unpacked**, and select the cloned `anydownload` folder.

4. **Get the extension ID**: ask the user to copy the ID shown on the AnyDownload card (32 lowercase letters, e.g. `abcdefghijklmnopqrstuvwxyzabcdef`). There is no reliable way to read an unpacked extension's ID from disk — the user's copy-paste is the correct path, just ask for it.

5. **Register the native messaging host** with the ID from step 4:

   ```bash
   cd ~/anydownload && ./install.sh <EXTENSION_ID>
   ```

   Expected output: `Installed: ~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.anydownload.ytdlp.json`

6. **Verify the host works** without Chrome (should print an "invalid request" error object — that means the stdio protocol is alive):

   ```bash
   python3 -c "
   import json,struct,subprocess
   d=json.dumps({'url':'ftp://x','format':'best'}).encode()
   p=subprocess.run(['./host/anydownload_host.py'],input=struct.pack('<I',len(d))+d,capture_output=True)
   n,=struct.unpack('<I',p.stdout[:4]);print(json.loads(p.stdout[4:4+n]))
   "
   ```

   Expected: `{'ok': False, 'error': 'invalid request'}`

7. **Tell the user to reload the extension** (reload arrow on the AnyDownload card in `chrome://extensions`) and test: right-click any video → **AnyDownload ▸ Download (best quality)**. The file lands in `~/Downloads` and a Chrome notification confirms completion.

Troubleshooting:
- Notification says "Native host not reachable" → the extension ID in `com.anydownload.ytdlp.json` doesn't match, or the extension wasn't reloaded after `install.sh`. Re-run step 5 with the correct ID, then reload.
- Download fails on a specific site → run `yt-dlp <page-url>` manually in a terminal to see the real error; usually it's a site yt-dlp doesn't support or DRM.

</details>

## Limits

- **No DRM.** Widevine/EME streams (Netflix, Prime Video, etc.) are out of scope — this tool doesn't and won't bypass content protection. Use it for public media, your own content, or media you're authorized to save.
- Live streams work only as well as yt-dlp handles them for that site.
- macOS/Chrome paths are hardcoded in `install.sh`; Linux/Chromium users need to adjust the `NativeMessagingHosts` directory ([paths here](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging#native-messaging-host-location)).

## Files

| File | Role |
|---|---|
| `manifest.json` | MV3 extension manifest |
| `content.js` | Finds media under the cursor, unblocks right-click |
| `background.js` | Context menus, notifications, talks to the native host |
| `host/anydownload_host.py` | Runs yt-dlp, replies over stdio |
| `install.sh` | Registers the native host for your extension ID |

## License

MIT
