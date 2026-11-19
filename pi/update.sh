#!/bin/bash
# OS updates that must survive the read-only overlay. Safe to run again.
# Overlay on: turn it off and reboot. Run this script again after the reboot.
# Overlay off: apt full-upgrade, turn the overlay back on, reboot.
# Use a keyboard, or KEEP_SSH=1 so SSH is still up for the second run.
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
if [ -f "$SCRIPT_DIR/common.sh" ]; then
  # shellcheck source=common.sh
  source "$SCRIPT_DIR/common.sh"
elif [ -f /usr/local/lib/hive-kiosk/common.sh ]; then
  # shellcheck source=common.sh
  source /usr/local/lib/hive-kiosk/common.sh
else
  echo "common.sh is missing." >&2
  exit 1
fi

require_root

if overlay_active; then
  echo "Overlay is on. Disabling it and rebooting."
  echo "After the Pi is back, run this script again. It will upgrade and turn the overlay back on."
  raspi_disable_overlay
  sync
  reboot
fi

echo "Overlay is off. Running apt full-upgrade."
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get -y \
  -o Dpkg::Options::=--force-confdef \
  -o Dpkg::Options::=--force-confold \
  full-upgrade
disable_overlay_apt
raspi_enable_overlay
sync
reboot
