# Shared helpers for setup.sh and update.sh. Source this file; do not execute it.
# shellcheck shell=bash

hive_user() {
  printf '%s\n' "uscillaaa"
}

overlay_active() {
  if grep -q 'overlayroot=tmpfs' /proc/cmdline 2>/dev/null; then
    return 0
  fi
  if grep -q 'boot=overlay' /proc/cmdline 2>/dev/null; then
    return 0
  fi
  if findmnt -n -o FSTYPE / 2>/dev/null | grep -qx 'overlay'; then
    return 0
  fi
  if command -v raspi-config >/dev/null 2>&1; then
    local now
    now=$(raspi-config nonint get_overlay_now 2>/dev/null || true)
    if [ "$now" = "0" ]; then
      return 0
    fi
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

# Echo a directory where writes survive the overlay. "/" when the overlay is off.
# When the overlay is on, mount the real root device (from the kernel cmdline)
# on /mnt/hive-lower. Caller must umount_real_root when finished.
mount_real_root() {
  if ! overlay_active; then
    printf '%s\n' /
    return 0
  fi
  local spec dev mnt
  spec=$(sed -n 's/.*[[:space:]]root=\([^[:space:]]*\).*/\1/p; s/^root=\([^[:space:]]*\).*/\1/p' /proc/cmdline | head -n 1)
  if [ -z "$spec" ]; then
    echo "Could not find root= on the kernel command line." >&2
    return 1
  fi
  if [ -b "$spec" ]; then
    dev=$spec
  else
    dev=$(findfs "$spec" 2>/dev/null || true)
  fi
  if [ -z "$dev" ] || [ ! -b "$dev" ]; then
    echo "Could not resolve the real root device ($spec)." >&2
    return 1
  fi
  mnt=/mnt/hive-lower
  mkdir -p "$mnt"
  if ! findmnt -n "$mnt" >/dev/null 2>&1; then
    mount -o rw "$dev" "$mnt"
  fi
  printf '%s\n' "$mnt"
}

umount_real_root() {
  if findmnt -n /mnt/hive-lower >/dev/null 2>&1; then
    sync
    umount /mnt/hive-lower || true
  fi
}

# Copy one file onto the persistent root (and the live tree when they differ).
persist_file() {
  local dest=$1
  local src=$2
  local root
  root=$(mount_real_root)
  mkdir -p "$root$(dirname "$dest")"
  cp "$src" "$root$dest"
  if [ "$root" != / ]; then
    mkdir -p "$(dirname "$dest")"
    cp "$src" "$dest"
  fi
}

write_state() {
  local phase=$1
  local root dir
  root=$(mount_real_root) || root=/
  dir="$root/var/lib/hive-kiosk"
  mkdir -p "$dir"
  printf 'phase=%s\nupdated=%s\n' "$phase" "$(date -Is 2>/dev/null || date)" > "$dir/state"
  chmod 644 "$dir/state"
  if [ "$root" != / ]; then
    mkdir -p /var/lib/hive-kiosk
    cp "$dir/state" /var/lib/hive-kiosk/state
  fi
}

state_phase() {
  local root f
  root=$(mount_real_root 2>/dev/null || true)
  if [ -n "$root" ] && [ -f "$root/var/lib/hive-kiosk/state" ]; then
    f="$root/var/lib/hive-kiosk/state"
  elif [ -f /var/lib/hive-kiosk/state ]; then
    f=/var/lib/hive-kiosk/state
  else
    printf '%s\n' ""
    return 0
  fi
  sed -n 's/^phase=//p' "$f" | head -n 1
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

schedule_reboot() {
  local delay=${1:-5}
  if command -v systemd-run >/dev/null 2>&1 && systemd-run --unit="hive-kiosk-reboot-$$" --on-active="${delay}s" /sbin/reboot; then
    return 0
  fi
  # shellcheck disable=SC2329
  nohup sh -c "sleep $delay; /sbin/reboot || reboot" >/dev/null 2>&1 &
  disown || true
}

require_root() {
  if [ "$(id -u)" -ne 0 ]; then
    echo "Run this with sudo." >&2
    exit 1
  fi
}
