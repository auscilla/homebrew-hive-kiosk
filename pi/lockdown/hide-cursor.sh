#!/bin/bash
# Install a 1px transparent cursor theme and select it for labwc.
set -euo pipefail

theme=/usr/share/icons/hive-blank
workdir=$(mktemp -d)
cleanup() { rm -rf "$workdir"; }
trap cleanup EXIT

python3 - "$workdir/blank.png" << 'PY'
import struct
import sys
import zlib

path = sys.argv[1]
# 1x1 transparent PNG.
raw = b"\x00\x00\x00\x00\x00"
def chunk(tag, data):
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
png = b"\x89PNG\r\n\x1a\n"
png += chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 6, 0, 0, 0))
png += chunk(b"IDAT", zlib.compress(raw))
png += chunk(b"IEND", b"")
open(path, "wb").write(png)
PY

cfg="$workdir/blank.cursor"
printf '1 0 0 blank.png\n' > "$cfg"

if ! command -v xcursorgen >/dev/null 2>&1; then
  apt-get install -y x11-apps
fi

mkdir -p "$theme/cursors"
xcursorgen "$cfg" "$theme/cursors/left_ptr"
for name in arrow default hand pointer text xterm; do
  cp "$theme/cursors/left_ptr" "$theme/cursors/$name"
done
printf '%s\n' "[Icon Theme]" "Name=hive-blank" "Comment=Hidden kiosk cursor" > "$theme/index.theme"

user_name=${1:-uscillaaa}
home_dir=$(getent passwd "$user_name" | cut -d: -f6 || true)
if [ -z "$home_dir" ]; then
  echo "No home for $user_name; cursor theme is installed system-wide only." >&2
  exit 0
fi
env_file="$home_dir/.config/labwc/environment"
mkdir -p "$(dirname "$env_file")"
touch "$env_file"
grep -v '^XCURSOR_THEME=' "$env_file" | grep -v '^XCURSOR_SIZE=' > "$env_file.tmp" || true
printf '%s\n' "XCURSOR_THEME=hive-blank" "XCURSOR_SIZE=1" >> "$env_file.tmp"
mv "$env_file.tmp" "$env_file"
chown -R "$user_name:$user_name" "$home_dir/.config/labwc"
echo "Blank cursor theme installed."
