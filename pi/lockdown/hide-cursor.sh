#!/bin/bash
# Install a 1px transparent cursor and select it for the kiosk session.
# A bad cursor image must not abort the install.
set -euo pipefail

theme=/usr/share/icons/hive-blank
workdir=$(mktemp -d)
cleanup() { rm -rf "$workdir"; }
trap cleanup EXIT

# 1x1 fully transparent PNG (filter 0, RGBA 0,0,0,0).
blank_png_b64="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII="
printf '%s\n' "$blank_png_b64" | base64 -d > "$workdir/blank.png"
printf '%s\n' "1 0 0 blank.png" > "$workdir/blank.cursor"

warn_skip() {
  echo "warning: $* Continuing without a blank cursor." >&2
  exit 0
}

if ! command -v xcursorgen >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update || warn_skip "apt-get update failed."
  apt-get install -y x11-apps || warn_skip "could not install xcursorgen."
fi
if ! command -v xcursorgen >/dev/null 2>&1; then
  warn_skip "xcursorgen is not installed."
fi

mkdir -p "$theme/cursors"
if ! (cd "$workdir" && xcursorgen blank.cursor "$theme/cursors/left_ptr"); then
  warn_skip "xcursorgen failed."
fi

name=""
for name in arrow default hand hand1 hand2 pointer text xterm top_left_arrow left_ptr_watch watch ibeam cross plus; do
  ln -sfn left_ptr "$theme/cursors/$name"
done
printf '%s\n' "[Icon Theme]" "Name=hive-blank" "Comment=Hidden kiosk cursor" > "$theme/index.theme"

write_env_file() {
  local env_file=$1
  mkdir -p "$(dirname "$env_file")"
  touch "$env_file"
  grep -v '^XCURSOR_THEME=' "$env_file" | grep -v '^XCURSOR_SIZE=' > "$env_file.tmp" || true
  printf '%s\n' "XCURSOR_THEME=hive-blank" "XCURSOR_SIZE=1" >> "$env_file.tmp"
  mv "$env_file.tmp" "$env_file"
}

user_name=${1:-uscillaaa}
home_dir=$(getent passwd "$user_name" | cut -d: -f6 || true)
if [ -z "$home_dir" ]; then
  echo "No home for $user_name; cursor theme is installed system-wide only." >&2
  exit 0
fi

# labwc reads this file. Wayfire uses the same variables from its environment file.
write_env_file "$home_dir/.config/labwc/environment"
write_env_file "$home_dir/.config/wayfire/environment"
chown -R "$user_name:$user_name" "$home_dir/.config/labwc" "$home_dir/.config/wayfire"
echo "Blank cursor theme installed."
