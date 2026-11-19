#!/bin/bash
# Finish the kiosk fix from the Pi's text console. SSH is left off.
# No password is set or requested by this script.
#   curl -fsSL https://raw.githubusercontent.com/auscilla/homebrew-hive-kiosk/cursor/pi-setup-and-pin-fixes/pi/fix-local.sh | sudo bash
set -euo pipefail

TARBALL="https://codeload.github.com/auscilla/homebrew-hive-kiosk/tar.gz/refs/heads/cursor/pi-setup-and-pin-fixes"
PI_DIR=/var/lib/hive-kiosk/pi
STATE=/var/lib/hive-kiosk/fix-state
UNIT_NAME=hive-fix-continue.service

if [ "$(id -u)" -ne 0 ]; then
  echo "Run with sudo." >&2
  exit 1
fi

bootstrap() {
  local tmp top dir
  tmp=$(mktemp -d)
  echo "Downloading the kiosk scripts."
  curl -fsSL "$TARBALL" -o "$tmp/src.tgz"
  tar -xzf "$tmp/src.tgz" -C "$tmp"
  top=""
  for dir in "$tmp"/homebrew-hive-kiosk-*; do
    if [ -d "$dir/pi" ]; then
      top=$dir
      break
    fi
  done
  if [ -z "$top" ] || [ ! -f "$top/pi/fix-local.sh" ]; then
    echo "Could not unpack the kiosk scripts." >&2
    exit 1
  fi
  exec bash "$top/pi/fix-local.sh"
}

self=${BASH_SOURCE[0]:-}
if [ "${1:-}" != "--continue" ] && [ ! -f "$self" ]; then
  bootstrap
fi

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

root_ro_mounted() {
  [ -d /media/root-ro ] && findmnt -n /media/root-ro >/dev/null 2>&1
}

write_unit() {
  local dest=$1
  cat > "$dest" << 'EOF'
[Unit]
Description=Continue Homebrew Hive local fix
After=local-fs.target
ConditionPathExists=/var/lib/hive-kiosk/fix-state

[Service]
Type=oneshot
ExecStart=/var/lib/hive-kiosk/pi/fix-local.sh --continue
TimeoutStartSec=infinity

[Install]
WantedBy=multi-user.target
EOF
}

install_under() {
  local root=$1
  local src=$2
  mkdir -p "$root/var/lib/hive-kiosk" "$root/etc/systemd/system/multi-user.target.wants"
  rm -rf "$root/var/lib/hive-kiosk/pi"
  cp -a "$src" "$root/var/lib/hive-kiosk/pi"
  chmod 755 "$root/var/lib/hive-kiosk/pi/fix-local.sh" \
    "$root/var/lib/hive-kiosk/pi/verify.sh" \
    "$root/var/lib/hive-kiosk/pi/lockdown/hide-cursor.sh"
  write_unit "$root/etc/systemd/system/$UNIT_NAME"
  ln -sfn "../$UNIT_NAME" "$root/etc/systemd/system/multi-user.target.wants/$UNIT_NAME"
  printf '%s\n' apply > "$root/var/lib/hive-kiosk/fix-state"
}

persist_tree() {
  local src=$1
  install_under "" "$src"
  if root_ro_mounted; then
    mount -o remount,rw /media/root-ro
    install_under /media/root-ro "$src"
    mount -o remount,ro /media/root-ro
  fi
}

remove_unit() {
  rm -f "/etc/systemd/system/multi-user.target.wants/$UNIT_NAME"
  rm -f "/etc/systemd/system/$UNIT_NAME"
  rm -f "$STATE"
  if root_ro_mounted; then
    mount -o remount,rw /media/root-ro
    rm -f "/media/root-ro/etc/systemd/system/multi-user.target.wants/$UNIT_NAME"
    rm -f "/media/root-ro/etc/systemd/system/$UNIT_NAME"
    rm -f "/media/root-ro/var/lib/hive-kiosk/fix-state"
    mount -o remount,ro /media/root-ro || true
  fi
  systemctl daemon-reload || true
}

capture_verify() {
  VERIFY_TEXT=$(bash "$PI_DIR/verify.sh" || true)
  printf '%s\n' "Homebrew Hive fix verify" "$VERIFY_TEXT" > /dev/tty1 || true
  printf '%s\n' "$VERIFY_TEXT" | logger -t hive-fix || true
}

write_verify_file() {
  local cmd
  cmd=$(cmdline_file || true)
  if [ -z "$cmd" ]; then
    echo "No cmdline file. Verify stayed on the screen and in the journal." >&2
    return 0
  fi
  mount -o remount,rw "$(dirname "$cmd")"
  {
    printf '%s\n' "$VERIFY_TEXT"
    echo
    echo "# after enable_overlayfs"
    grep -o 'overlayroot=[^ ]*' "$cmd" || true
  } > "$(dirname "$cmd")/hive-verify.txt"
}

strip_text_boot() {
  local cmd
  cmd=$(cmdline_file || true)
  if [ -z "$cmd" ] || ! grep -q 'systemd.unit=multi-user.target' "$cmd"; then
    return 0
  fi
  mount -o remount,rw "$(dirname "$cmd")"
  sed -i 's/ systemd.unit=multi-user.target//g' "$cmd"
  if ! grep -q 'overlayroot=tmpfs' "$cmd"; then
    echo "FAILED: ${cmd} lost overlayroot=tmpfs while removing the text-console boot override." >&2
    exit 1
  fi
}

apply_fixes() {
  local rc_xml=/home/uscillaaa/.config/labwc/rc.xml
  export DEBIAN_FRONTEND=noninteractive
  bash "$PI_DIR/lockdown/hide-cursor.sh" uscillaaa || true
  if [ -f "$rc_xml" ]; then
    python3 "$PI_DIR/lockdown/patch-labwc.py" "$rc_xml" || true
  fi
  disable_overlay_apt
}

continue_fix() {
  if [ ! -f "$STATE" ] || [ "$(cat "$STATE")" != "apply" ]; then
    echo "No fix is waiting to continue."
    exit 0
  fi
  if overlay_active; then
    echo "Overlay is still on. Disabling it and rebooting. The fix continues by itself."
    raspi_disable_overlay
    sync
    reboot
  fi
  echo "Overlay is off. Applying the cursor, upgrade-timer, and lockdown fixes."
  apply_fixes
  capture_verify
  raspi_enable_overlay
  strip_text_boot
  write_verify_file
  remove_unit
  sync
  echo "Rebooting into the kiosk."
  reboot
}

begin_fix() {
  echo "Installing the fix scripts. SSH is not changed."
  persist_tree "$SCRIPT_DIR"
  if overlay_active; then
    echo "Overlay is on. Disabling it and rebooting. The fix continues by itself."
    raspi_disable_overlay
    sync
    reboot
  fi
  exec bash "$PI_DIR/fix-local.sh" --continue
}

if [ "${1:-}" = "--continue" ]; then
  continue_fix
else
  begin_fix
fi
