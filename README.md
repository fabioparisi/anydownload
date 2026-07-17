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

## Install

One command:

```bash
curl -fsSL https://raw.githubusercontent.com/fabioparisi/anydownload/main/install.sh | bash
```

It clones the repo to `~/anydownload`, installs `yt-dlp`/`ffmpeg` via Homebrew if missing, registers the native host, and opens `chrome://extensions` plus the folder in Finder. Then there is **one click Chrome refuses to automate**:

> In the `chrome://extensions` tab: enable **Developer mode** (top right) → **Load unpacked** → select the `anydownload` folder that just opened in Finder.

Done — right-click any video to test. No extension ID to copy, no reload: the `key` field in `manifest.json` pins the extension to the same ID (`eagdongheofjndbgdefbjhfiejannkok`) on every machine, so the native host is pre-authorized before the extension even loads.

Already cloned it yourself? Just run `./install.sh` from the folder — same thing, no arguments.

## Install (AI agent — Claude Code, Codex, etc.)

Just tell your agent:

> Install https://github.com/fabioparisi/anydownload following the AGENT INSTALL steps in its README.

Nothing else to paste: the agent runs everything itself. If it has GUI control (computer use), the install can be fully hands-free; otherwise you'll be asked for one click at the end.

<details>
<summary><b>AGENT INSTALL — exact steps for an LLM agent</b></summary>

Everything is automated except one GUI click that Chrome does not allow scripting.

1. **Run the installer** (idempotent — safe to re-run):

   ```bash
   curl -fsSL https://raw.githubusercontent.com/fabioparisi/anydownload/main/install.sh | bash
   ```

   It clones to `~/anydownload` (a permanent location — Chrome loads the extension from there forever, so never use a temp dir), installs `yt-dlp`/`ffmpeg` via Homebrew if missing, registers the native messaging host for the fixed extension ID `eagdongheofjndbgdefbjhfiejannkok` (pinned by the `key` field in `manifest.json` — do NOT ask the user for an ID), and opens `chrome://extensions` and the folder in Finder.

2. **Verify the host works** without Chrome:

   ```bash
   cd ~/anydownload && python3 -c "
   import json,struct,subprocess
   d=json.dumps({'url':'ftp://x','format':'best'}).encode()
   p=subprocess.run(['./host/anydownload_host.py'],input=struct.pack('<I',len(d))+d,capture_output=True)
   n,=struct.unpack('<I',p.stdout[:4]);print(json.loads(p.stdout[4:4+n]))
   "
   ```

   Expected: `{'ok': False, 'error': 'invalid request'}` — that means the stdio protocol is alive.

3. **Load the extension.** This is a GUI action in Chrome that cannot be scripted via CLI or DOM (`chrome://extensions` is off-limits to extensions and AppleScript). Two paths:

   - **You have desktop GUI control** (computer-use tools that can click inside Chrome): do it yourself. Focus the `chrome://extensions` tab that step 1 opened, enable the **Developer mode** toggle (top right) if off, click **Load unpacked**, then in the native file dialog press **Cmd+Shift+G**, type `~/anydownload`, press **Enter** to jump there and **Enter** again to select the folder. Verify the AnyDownload card appears with ID `eagdongheofjndbgdefbjhfiejannkok`.
   - **No GUI control** (or clicks in browsers are restricted): ask the user for this one click — in the `chrome://extensions` tab that just opened: **Developer mode** on (top right) → **Load unpacked** → select the `anydownload` folder that just opened in Finder.

   Either way, no reload is needed afterwards — the native host is already authorized for the pinned ID.

4. **Tell the user to test**: right-click any video → **AnyDownload ▸ Download (best quality)**. The file lands in `~/Downloads` and a Chrome notification confirms completion.

Troubleshooting:
- Notification says "Native host not reachable" → re-run step 1, then check that `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.anydownload.ytdlp.json` exists and points at an existing `anydownload_host.py`.
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
