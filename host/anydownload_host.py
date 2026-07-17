#!/usr/bin/env python3
"""Native messaging host for the AnyDownload Chrome extension.

Reads one length-prefixed JSON message from stdin, runs yt-dlp,
writes one length-prefixed JSON reply to stdout. Stdlib only.
"""
import json
import os
import struct
import subprocess
import sys

FORMATS = {
    "best": [],
    "mp4": ["--merge-output-format", "mp4",
            "-f", "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/b"],
    "mp3": ["-x", "--audio-format", "mp3"],
}

# Chrome launches this host with a minimal PATH, so probe common locations.
SEARCH_DIRS = ("/opt/homebrew/bin", "/usr/local/bin", "/usr/bin")


def which(name):
    for d in SEARCH_DIRS:
        p = os.path.join(d, name)
        if os.path.isfile(p):
            return p
    return name


def read_msg():
    raw = sys.stdin.buffer.read(4)
    if len(raw) < 4:
        sys.exit(0)
    (n,) = struct.unpack("<I", raw)
    return json.loads(sys.stdin.buffer.read(n))


def send(obj):
    data = json.dumps(obj).encode()
    sys.stdout.buffer.write(struct.pack("<I", len(data)) + data)
    sys.stdout.buffer.flush()


def main():
    msg = read_msg()
    url = msg.get("url", "")
    fmt = msg.get("format", "best")
    if not url.startswith(("http://", "https://")) or fmt not in FORMATS:
        send({"ok": False, "error": "invalid request"})
        return

    cmd = [
        which("yt-dlp"),
        "--no-playlist",
        "--ffmpeg-location", which("ffmpeg"),
        "-P", os.path.expanduser("~/Downloads"),
        "--no-simulate",
        "--print", "after_move:filepath",
        *FORMATS[fmt],
        url,  # passed as a plain argv element, never through a shell
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode == 0:
        lines = [l for l in proc.stdout.strip().splitlines() if l]
        send({"ok": True, "file": lines[-1] if lines else ""})
    else:
        send({"ok": False, "error": proc.stderr[-500:] or "yt-dlp failed"})


if __name__ == "__main__":
    main()
