#!/bin/bash
# Installs the yt-dlp native messaging host for the Media Tools extension (macOS / Google Chrome).
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
HOST_NAME="com.mediatools.ytdlp"
TARGET_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"

for bin in yt-dlp ffmpeg; do
  if ! command -v "$bin" >/dev/null && [ ! -x "/opt/homebrew/bin/$bin" ] && [ ! -x "/usr/local/bin/$bin" ]; then
    echo "Missing $bin. Install it first:  brew install yt-dlp ffmpeg" >&2
    exit 1
  fi
done

EXT_ID="${1:-}"
if [ -z "$EXT_ID" ]; then
  echo "Load the extension first: chrome://extensions -> Developer mode -> Load unpacked -> this folder."
  read -rp "Paste the extension ID shown on its card: " EXT_ID
fi

chmod +x "$DIR/host/media_tools_host.py"
mkdir -p "$TARGET_DIR"
cat > "$TARGET_DIR/$HOST_NAME.json" <<EOF
{
  "name": "$HOST_NAME",
  "description": "yt-dlp bridge for the Media Tools extension",
  "path": "$DIR/host/media_tools_host.py",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://$EXT_ID/"]
}
EOF

echo "Installed: $TARGET_DIR/$HOST_NAME.json"
echo "Reload the extension in chrome://extensions and you're done."
