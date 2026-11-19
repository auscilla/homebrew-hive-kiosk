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

# get_bootro_now prints 0 when the boot partition is mounted read-only.
boot_is_ro() {
  local now
  now=$(raspi-config nonint get_bootro_now 2>/dev/null || true)
  now=$(printf '%s' "$now" | tr -d '[:space:]')
  [ "$now" = "0" ]
}

cmdline_file() {
  local dir
  dir=$(boot_dir) || return 1
  printf '%s\n' "$dir/cmdline.txt"
}

# disable_bootro first when the boot mount is ro, then remount it writable
# before any cmdline or config edit.
prepare_boot_rw() {
  HIVE_BOOT_WAS_RO=0
  if boot_is_ro; then
    HIVE_BOOT_WAS_RO=1
    raspi-config nonint disable_bootro || echo "disable_bootro failed. Remounting /boot/firmware read-write anyway." >&2
  fi
  if [ -d /boot/firmware ]; then
    mount -o remount,rw /boot/firmware
  elif [ -d /boot ]; then
    mount -o remount,rw /boot
  else
    echo "No /boot/firmware or /boot partition to remount." >&2
    return 1
  fi
}

restore_boot_ro_if_needed() {
  if [ "${HIVE_BOOT_WAS_RO:-0}" = "1" ]; then
    raspi-config nonint enable_bootro || echo "Could not re-enable the boot read-only fstab flag." >&2
  fi
}

# With overlayroot on, upgrades go to tmpfs and are lost at reboot, so the timer only wastes RAM.
disable_overlay_apt() {
  echo "With overlayroot on, upgrades go to tmpfs and are lost at reboot, so the timer only wastes RAM. Disabling apt-daily-upgrade.timer, apt-daily.timer, and unattended-upgrades. OS updates happen through pi/update.sh (disable overlay, reboot, full-upgrade, enable overlay, reboot)."
  systemctl disable --now apt-daily-upgrade.timer apt-daily.timer unattended-upgrades || true
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
  local cmd
  prepare_boot_rw
  if ! raspi-config nonint disable_overlayfs; then
    echo "disable_overlayfs failed; trying do_overlayfs 1" >&2
    raspi-config nonint do_overlayfs 1
  fi
  cmd=$(cmdline_file)
  if grep -q 'overlayroot=tmpfs' "$cmd"; then
    echo "FAILED: ${cmd} still contains overlayroot=tmpfs. The overlay was not disabled." >&2
    exit 1
  fi
  restore_boot_ro_if_needed
}

raspi_enable_overlay() {
  local cmd
  prepare_boot_rw
  if ! raspi-config nonint enable_overlayfs; then
    echo "enable_overlayfs failed; trying do_overlayfs 0" >&2
    raspi-config nonint do_overlayfs 0
  fi
  cmd=$(cmdline_file)
  if ! grep -q 'overlayroot=tmpfs' "$cmd"; then
    echo "FAILED: ${cmd} does not contain overlayroot=tmpfs. The overlay was not enabled." >&2
    exit 1
  fi
  echo "Confirmed overlayroot=tmpfs in ${cmd}."
  restore_boot_ro_if_needed
}

require_root() {
  if [ "$(id -u)" -ne 0 ]; then
    echo "Run this with sudo." >&2
    exit 1
  fi
}
