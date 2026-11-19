# Shared helpers for setup.sh and update.sh. Source this file; do not execute it.
# shellcheck shell=bash

hive_user() {
  printf '%s\n' "uscillaaa"
}

# 0 from get_overlay_now means the overlay is on. findmnt is the fallback.
overlay_active() {
  local now fstype
  if command -v raspi-config >/dev/null 2>&1; then
    now=$(raspi-config nonint get_overlay_now 2>/dev/null || true)
    now=$(printf '%s' "$now" | tr -d '[:space:]')
    if [ "$now" = "0" ]; then
      return 0
    fi
    if [ "$now" = "1" ]; then
      return 1
    fi
  fi
  fstype=$(findmnt -n -o FSTYPE / 2>/dev/null || true)
  if [ "$fstype" = "overlay" ]; then
    return 0
  fi
  return 1
}

boot_dir() {
  if [ -f /boot/firmware/cmdline.txt ] || [ -f /boot/firmware/config.txt ]; then
    printf '%s\n' /boot/firmware
    return 0
  fi
  if [ -f /boot/cmdline.txt ] || [ -f /boot/config.txt ]; then
    printf '%s\n' /boot
    return 0
  fi
  return 1
}

mount_boot_rw() {
  local dir
  dir=$(boot_dir) || return 0
  mount -o remount,rw "$dir" 2>/dev/null || true
}

# Only call this when the overlay is off. Never mounts a lower root.
write_state() {
  local phase=$1
  if overlay_active; then
    echo "Not writing /var/lib/hive-kiosk while the overlay is on." >&2
    return 0
  fi
  mkdir -p /var/lib/hive-kiosk
  printf 'phase=%s\nupdated=%s\n' "$phase" "$(date -Is 2>/dev/null || date)" > /var/lib/hive-kiosk/state
  chmod 644 /var/lib/hive-kiosk/state
}

raspi_disable_overlay() {
  mount_boot_rw
  if raspi-config nonint disable_overlayfs; then
    return 0
  fi
  echo "disable_overlayfs failed; trying do_overlayfs 1" >&2
  raspi-config nonint do_overlayfs 1
}

raspi_enable_overlay() {
  mount_boot_rw
  if raspi-config nonint enable_overlayfs; then
    return 0
  fi
  echo "enable_overlayfs failed; trying do_overlayfs 0" >&2
  raspi-config nonint do_overlayfs 0
}

require_root() {
  if [ "$(id -u)" -ne 0 ]; then
    echo "Run this with sudo." >&2
    exit 1
  fi
}
