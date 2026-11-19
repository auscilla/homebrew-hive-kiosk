#!/bin/bash
# Apply OS updates that must survive the read-only overlay.
# Overlay on: disable it, reboot, continue, full-upgrade, enable overlay, reboot.
# Run from a keyboard, or with KEEP_SSH=1 so you can reconnect after the first reboot.
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
trap 'umount_real_root' EXIT

install_continuation() {
  local root=$1
  install -d "$root/usr/local/sbin" "$root/usr/local/lib/hive-kiosk" "$root/etc/systemd/system/multi-user.target.wants" "$root/var/lib/hive-kiosk"
  install -m 755 "$SCRIPT_DIR/update.sh" "$root/usr/local/sbin/hive-update.sh"
  install -m 644 "$SCRIPT_DIR/common.sh" "$root/usr/local/lib/hive-kiosk/common.sh"
  install -m 644 "$SCRIPT_DIR/hive-update.service" "$root/etc/systemd/system/hive-kiosk-update.service"
  ln -sfn ../hive-kiosk-update.service "$root/etc/systemd/system/multi-user.target.wants/hive-kiosk-update.service"
  : > "$root/var/lib/hive-kiosk/update-pending"
  if [ "$root" = / ]; then
    systemctl daemon-reload
    systemctl enable hive-kiosk-update.service
  fi
}

copy_boot_backup() {
  local dest
  dest=$(boot_dir) || return 0
  mount_boot_rw
  install -d "$dest/hive-kiosk"
  install -m 755 "$SCRIPT_DIR/update.sh" "$dest/hive-kiosk/update.sh"
  install -m 644 "$SCRIPT_DIR/common.sh" "$dest/hive-kiosk/common.sh"
}

run_upgrade() {
  if overlay_active; then
    echo "The overlay is still on, so apt changes would disappear at reboot." >&2
    echo "Run: sudo bash $0" >&2
    exit 1
  fi
  echo "Running apt full-upgrade on a writable root."
  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  apt-get -y \
    -o Dpkg::Options::=--force-confdef \
    -o Dpkg::Options::=--force-confold \
    full-upgrade
  rm -f /var/lib/hive-kiosk/update-pending
  systemctl disable hive-kiosk-update.service 2>/dev/null || true
  rm -f /etc/systemd/system/multi-user.target.wants/hive-kiosk-update.service
  echo "Re-enabling the overlay and rebooting."
  raspi_enable_overlay
  sync
  umount_real_root || true
  reboot
}

prepare_reboot() {
  local root
  echo "Overlay is on. Disabling it so this upgrade is still there after reboot."
  copy_boot_backup || true
  if root=$(mount_real_root); then
    install_continuation "$root"
    echo "A one-shot service will continue the upgrade after reboot."
  else
    echo "Could not mount the real root." >&2
    echo "After reboot, run: sudo bash $(boot_dir)/hive-kiosk/update.sh --continue" >&2
    echo "Use a keyboard, or KEEP_SSH=1 if SSH is still on." >&2
  fi
  raspi_disable_overlay
  sync
  umount_real_root || true
  echo "Rebooting into a writable root."
  reboot
}

if [ "${1:-}" = "--continue" ]; then
  run_upgrade
fi

if overlay_active; then
  prepare_reboot
else
  run_upgrade
fi
