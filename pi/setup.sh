#!/bin/bash
# Idempotent kiosk setup. Run on the Pi with sudo.
#   phase1  overlay on  -> disable overlay, reboot
#   phase2  overlay off -> install, set password, lock down, enable overlay, reboot
#   (no arg) do whichever phase matches the overlay
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

PHASE=${1:-auto}
USER_NAME=$(hive_user)
HOME_DIR=$(getent passwd "$USER_NAME" | cut -d: -f6 || true)

require_root

if [ -z "$HOME_DIR" ] || [ ! -d "$HOME_DIR" ]; then
  echo "User ${USER_NAME} has no home directory. Create that account in Raspberry Pi Imager first." >&2
  exit 1
fi

# shellcheck disable=SC1091
source "$SCRIPT_DIR/kiosk.conf"

prompt_new_password() {
  local first second
  if [ -t 0 ]; then
    read -r -s -p "New password for ${USER_NAME}: " first
    printf '\n'
    read -r -s -p "Repeat new password: " second
    printf '\n'
  else
    echo "Send the new password on stdin, then repeat it on the next line." >&2
    IFS= read -r first || true
    IFS= read -r second || true
  fi
  if [ -z "$first" ] || [ "$first" != "$second" ]; then
    echo "Passwords were empty or did not match. The account was not changed." >&2
    exit 1
  fi
  printf '%s:%s\n' "$USER_NAME" "$first" | chpasswd
  unset first second
  echo "Password updated for ${USER_NAME}."
}

verify_blocked_hosts() {
  local host
  local -a hosts
  read -r -a hosts <<< "${BLOCKED_HOSTS}"
  for host in "${hosts[@]}"; do
    if ! grep -F -q "\"${host}\"" "$SCRIPT_DIR/chromium-policy.json"; then
      echo "BLOCKED_HOSTS entry ${host} is missing from chromium-policy.json" >&2
      exit 1
    fi
  done
}

install_packages() {
  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  apt-get install -y \
    unattended-upgrades \
    alsa-utils \
    python3-flask \
    python3-flask-cors \
    python3-requests \
    ca-certificates
  if ! apt-get install -y chromium; then
    apt-get install -y chromium-browser
  fi
  if ! command -v wpctl >/dev/null 2>&1; then
    apt-get install -y wireplumber pipewire-pulse || true
  fi
}

install_policy() {
  verify_blocked_hosts
  install -d /etc/chromium/policies/managed
  install -d /etc/chromium-browser/policies/managed
  install -m 644 "$SCRIPT_DIR/chromium-policy.json" /etc/chromium/policies/managed/hive-kiosk.json
  install -m 644 "$SCRIPT_DIR/chromium-policy.json" /etc/chromium-browser/policies/managed/hive-kiosk.json
}

install_audio() {
  install -d /etc/hive-kiosk
  install -m 644 "$SCRIPT_DIR/kiosk.conf" /etc/hive-kiosk/kiosk.conf
  install -m 755 "$SCRIPT_DIR/audio.sh" /usr/local/sbin/hive-audio.sh
  install -m 644 "$SCRIPT_DIR/hive-audio.service" /etc/systemd/system/hive-audio.service
  if [ -d /usr/share/wireplumber/main.lua.d ]; then
    install -d /etc/wireplumber/main.lua.d
    install -m 644 "$SCRIPT_DIR/wireplumber-usb.lua" /etc/wireplumber/main.lua.d/51-hive-usb-speaker.lua
  fi
  if [ -d /usr/share/wireplumber/wireplumber.conf.d ] || [ -d /usr/share/wireplumber/scripts ]; then
    install -d /etc/wireplumber/wireplumber.conf.d
    install -m 644 "$SCRIPT_DIR/wireplumber-usb.conf" /etc/wireplumber/wireplumber.conf.d/51-hive-usb-speaker.conf
  fi
  systemctl enable hive-audio.service
}

install_kiosk_session() {
  install -m 755 "$SCRIPT_DIR/kiosk-launch.sh" /usr/local/bin/hive-kiosk
  install -d /etc/systemd/user
  install -m 644 "$SCRIPT_DIR/kiosk.service" /etc/systemd/user/kiosk.service
  loginctl enable-linger "$USER_NAME" || true

  install -d "$HOME_DIR/.config/labwc"
  {
    if [ -f /etc/xdg/labwc/autostart ]; then
      grep -E 'kanshi' /etc/xdg/labwc/autostart || true
    fi
    cat "$SCRIPT_DIR/lockdown/autostart"
  } > "$HOME_DIR/.config/labwc/autostart"
  chmod 755 "$HOME_DIR/.config/labwc/autostart"

  if [ -f /etc/xdg/labwc/rc.xml ]; then
    cp /etc/xdg/labwc/rc.xml "$HOME_DIR/.config/labwc/rc.xml"
  elif [ ! -f "$HOME_DIR/.config/labwc/rc.xml" ]; then
    printf '%s\n' '<?xml version="1.0"?>' '<labwc_config>' '</labwc_config>' > "$HOME_DIR/.config/labwc/rc.xml"
  fi
  python3 "$SCRIPT_DIR/lockdown/patch-labwc.py" "$HOME_DIR/.config/labwc/rc.xml"

  if command -v wayfire >/dev/null 2>&1 && ! command -v labwc >/dev/null 2>&1; then
    local ini="$HOME_DIR/.config/wayfire.ini"
    touch "$ini"
    if ! grep -q 'HIVE_KIOSK_LOCKDOWN' "$ini"; then
      printf '\n# HIVE_KIOSK_LOCKDOWN\n' >> "$ini"
      cat "$SCRIPT_DIR/lockdown/wayfire.ini.snippet" >> "$ini"
    fi
  fi

  bash "$SCRIPT_DIR/lockdown/hide-cursor.sh" "$USER_NAME" || echo "Blank cursor was not installed. The kiosk still runs." >&2
  chown -R "$USER_NAME:$USER_NAME" "$HOME_DIR/.config/labwc" "$HOME_DIR/.config/systemd" 2>/dev/null || \
    chown -R "$USER_NAME:$USER_NAME" "$HOME_DIR/.config/labwc"

  # 1 disables blanking. On labwc this removes swayidle from the autostart we just wrote.
  raspi-config nonint do_blanking 1 || true
  systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target || true
}

install_bridge() {
  install -m 644 -o "$USER_NAME" -g "$USER_NAME" "$REPO_DIR/bridge.py" "$HOME_DIR/bridge.py"
  install -m 644 "$REPO_DIR/hive-bridge.service" /etc/systemd/system/hive-bridge.service
  systemctl daemon-reload
  systemctl enable hive-bridge.service
  systemctl restart hive-bridge.service
}

phase1() {
  if ! overlay_active; then
    echo "Phase 1: overlay is already off. Not rebooting."
    exit 0
  fi
  echo "Phase 1: overlay is on. Disabling it and rebooting."
  raspi_disable_overlay
  sync
  echo "HIVE_KIOSK_PHASE1_REBOOT"
  reboot
}

phase2() {
  if overlay_active; then
    echo "Phase 2 needs a writable root. Run: sudo bash $SCRIPT_DIR/setup.sh phase1" >&2
    exit 1
  fi
  echo "Phase 2: installing the kiosk on a writable root."
  prompt_new_password
  if id pi >/dev/null 2>&1; then
    passwd -l pi
    echo "Locked the default pi account."
  fi

  install_packages
  install -d /etc/hive-kiosk
  install -m 644 "$SCRIPT_DIR/kiosk.conf" /etc/hive-kiosk/kiosk.conf
  install_policy
  install_audio
  install_kiosk_session
  install_bridge

  raspi-config nonint do_hostname "$HOSTNAME"
  raspi-config nonint do_wifi_country "$WIFI_COUNTRY"
  if [ -e /etc/init.d/lightdm ]; then
    if ! SUDO_USER="$USER_NAME" raspi-config nonint do_boot_behaviour B4; then
      echo "Desktop autologin was not set. The Pi may already boot to the desktop." >&2
    fi
  else
    echo "lightdm is not installed, so desktop autologin was left as the image set it." >&2
  fi
  if [ -f /etc/lightdm/lightdm.conf ]; then
    sed -i "s/^#\\?autologin-user=.*/autologin-user=${USER_NAME}/" /etc/lightdm/lightdm.conf
  fi

  write_state phase2 || true
  # SSH stays up across this reboot so the Mac can read the new boot id.
  # install-from-mac.sh turns SSH off after that check unless KEEP_SSH=1.
  disable_overlay_apt
  raspi_enable_overlay
  sync
  echo "HIVE_KIOSK_PHASE2_REBOOT"
  reboot
}

case "$PHASE" in
  phase1) phase1 ;;
  phase2) phase2 ;;
  auto)
    if overlay_active; then
      phase1
    else
      phase2
    fi
    ;;
  *)
    echo "Usage: sudo bash setup.sh [phase1|phase2]" >&2
    exit 1
    ;;
esac
