#!/bin/bash
# One-command installer for AnyDownload (macOS / Google Chrome).
# Works from inside a clone OR standalone:
#   curl -fsSL https://raw.githubusercontent.com/fabioparisi/anydownload/main/install.sh | bash
set -euo pipefail

REPO="https://github.com/fabioparisi/anydownload.git"
# Fixed by the "key" field in manifest.json — same ID on every machine, so no
# copy-the-extension-ID step is ever needed.
EXT_ID="eagdongheofjndbgdefbjhfiejannkok"
HOST_NAME="com.anydownload.ytdlp"
TARGET_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"

# 1. Locate or fetch the repo (curl|bash lands in the else branch)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-.}")" 2>/dev/null && pwd)"
if [ -n "$SCRIPT_DIR" ] && [ -f "$SCRIPT_DIR/manifest.json" ]; then
  DIR="$SCRIPT_DIR"
else
  DIR="$HOME/anydownload"
  if [ -d "$DIR/.git" ]; then
    git -C "$DIR" pull --ff-only >/dev/null || true
  else
    git clone --depth 1 "$REPO" "$DIR"
  fi
fi

# 2. Dependencies
for bin in yt-dlp ffmpeg; do
  if ! command -v "$bin" >/dev/null && [ ! -x "/opt/homebrew/bin/$bin" ] && [ ! -x "/usr/local/bin/$bin" ]; then
    if command -v brew >/dev/null; then
      echo "Installing $bin…"
      brew install "$bin"
    else
      echo "Missing $bin and Homebrew. Install Homebrew (https://brew.sh) or $bin manually, then re-run." >&2
      exit 1
    fi
  fi
done

# 3. Register the native messaging host
chmod +x "$DIR/host/anydownload_host.py"
mkdir -p "$TARGET_DIR"
cat > "$TARGET_DIR/$HOST_NAME.json" <<EOF
{
  "name": "$HOST_NAME",
  "description": "yt-dlp bridge for the AnyDownload extension",
  "path": "$DIR/host/anydownload_host.py",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://$EXT_ID/"]
}
EOF

# 4. Open everything the last manual click needs
open "$DIR" 2>/dev/null || true
osascript -e 'tell application "Google Chrome" to activate' \
          -e 'tell application "Google Chrome" to open location "chrome://extensions/"' 2>/dev/null || true

echo ""
echo "Native host registered. One click left (Chrome does not allow automating it):"
echo "  In the chrome://extensions tab that just opened:"
echo "  1. Turn on 'Developer mode' (top right) if it's off."
echo "  2. Click 'Load unpacked' and pick the folder that just opened in Finder:"
echo "     $DIR"
echo ""
echo "Done — right-click any video to test. No extension ID, no reload needed."
