#!/bin/bash
# Replace the live Chromium policy so YouTube embeds are allowed, then restart Chromium.
# Run as root, with no arguments. Safe to run again.
set -euo pipefail

if [ "$#" -ne 0 ]; then
  echo "Usage: sudo bash hotfix-policy.sh" >&2
  exit 1
fi

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root." >&2
  exit 1
fi

url="https://raw.githubusercontent.com/auscilla/homebrew-hive-kiosk/cursor/pi-setup-and-pin-fixes/pi/chromium-policy.json"
tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT

curl -fsSL "$url" -o "$tmp"
python3 -m json.tool "$tmp" >/dev/null

install_policy() {
  local dest=$1
  mkdir -p "$(dirname "$dest")"
  install -m 644 "$tmp" "$dest"
}

if [ -d /media/root-ro ] && findmnt -n /media/root-ro >/dev/null 2>&1; then
  mount -o remount,rw /media/root-ro
  install_policy /media/root-ro/etc/chromium/policies/managed/hive-kiosk.json
  install_policy /media/root-ro/etc/chromium-browser/policies/managed/hive-kiosk.json
  mount -o remount,ro /media/root-ro
fi

install_policy /etc/chromium/policies/managed/hive-kiosk.json
install_policy /etc/chromium-browser/policies/managed/hive-kiosk.json

sync

# The kiosk service restarts Chromium after this process exits.
pkill -f chromium || true

echo "DONE"
