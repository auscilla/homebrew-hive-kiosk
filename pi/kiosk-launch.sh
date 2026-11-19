#!/bin/bash
# Chromium kiosk. Restart is handled by kiosk.service (Restart=always).
set -euo pipefail

CONF=/etc/hive-kiosk/kiosk.conf
if [ ! -f "$CONF" ]; then
  echo "Missing $CONF" >&2
  exit 1
fi
# shellcheck source=kiosk.conf
source "$CONF"

if [ -z "${KIOSK_URL:-}" ]; then
  echo "KIOSK_URL is empty in $CONF" >&2
  exit 1
fi

browser=""
for candidate in chromium chromium-browser; do
  if command -v "$candidate" >/dev/null 2>&1; then
    browser=$(command -v "$candidate")
    break
  fi
done
if [ -z "$browser" ]; then
  echo "chromium is not installed" >&2
  exit 1
fi

profile="${HOME}/.config/hive-chromium"
mkdir -p "$profile/Default"
pref="$profile/Default/Preferences"
if [ -f "$pref" ]; then
  sed -i \
    -e 's/"exited_cleanly":false/"exited_cleanly":true/' \
    -e 's/"exit_type":"[^"]*"/"exit_type":"Normal"/' \
    "$pref" || true
fi

args=(
  --kiosk
  --noerrdialogs
  --disable-session-crashed-bubble
  --autoplay-policy=no-user-gesture-required
  --disable-infobars
  --no-first-run
  --disable-translate
  --check-for-update-interval=31536000
  --start-maximized
  --user-data-dir="$profile"
)

# Fullscreen stays available (no --disable-features that turns it off).
if [ -n "${WAYLAND_DISPLAY:-}" ]; then
  args+=(--ozone-platform=wayland --enable-features=UseOzonePlatform)
fi

exec "$browser" "${args[@]}" "$KIOSK_URL"
