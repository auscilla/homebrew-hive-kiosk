#!/usr/bin/env bash
# Run on Aaron's Mac. Safe to run again if a reboot interrupted the last try.
# Usage: ./pi/install-from-mac.sh [user@host]
# KEEP_SSH=1 leaves SSH enabled after the final reboot.
set -euo pipefail

TARGET=${1:-uscillaaa@192.168.1.198}
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
REMOTE=hive-kiosk

SSH_BASE=(
  -o ConnectTimeout=5
  -o ServerAliveInterval=5
  -o StrictHostKeyChecking=accept-new
)

echo "==> Target ${TARGET}"

ssh_cmd() {
  # The remote command is the arguments this function was given.
  # shellcheck disable=SC2029
  ssh "${SSH_BASE[@]}" "$@"
}

trim() {
  printf '%s' "$1" | tr -d '[:space:]'
}

copy_files() {
  local attempt
  attempt=1
  while [ "$attempt" -le 3 ]; do
    echo "==> Copying pi/, bridge.py, and hive-bridge.service (attempt ${attempt} of 3)"
    if ssh_cmd "$TARGET" "mkdir -p ~/${REMOTE}" \
      && scp "${SSH_BASE[@]}" -r \
        "$REPO_DIR/pi" \
        "$REPO_DIR/bridge.py" \
        "$REPO_DIR/hive-bridge.service" \
        "${TARGET}:~/${REMOTE}/"; then
      return 0
    fi
    echo "Copy failed." >&2
    attempt=$((attempt + 1))
    sleep 5
  done
  echo "Could not copy files after 3 tries." >&2
  return 1
}

read_boot_id() {
  local id
  id=$(ssh_cmd "$TARGET" "cat /proc/sys/kernel/random/boot_id")
  trim "$id"
}

# 0 when raspi-config says the overlay is on, 1 when it is off.
remote_overlay_on() {
  local now fstype
  now=$(ssh_cmd "$TARGET" "raspi-config nonint get_overlay_now" 2>/dev/null || true)
  now=$(trim "$now")
  if [ "$now" = "0" ]; then
    return 0
  fi
  if [ "$now" = "1" ]; then
    return 1
  fi
  fstype=$(ssh_cmd "$TARGET" "findmnt -n -o FSTYPE /" 2>/dev/null || true)
  fstype=$(trim "$fstype")
  if [ "$fstype" = "overlay" ]; then
    return 0
  fi
  echo "Could not tell if the overlay is on (get_overlay_now='${now}', findmnt='${fstype}')." >&2
  return 2
}

# After a reboot command: wait until SSH drops, then until it returns, then
# require a new boot id. The reboot command's own exit code is not used.
wait_for_new_boot() {
  local old_id=$1
  local deadline new_id
  echo "==> Waiting until SSH stops (up to 3 minutes). A dropped connection is expected."
  deadline=$((SECONDS + 180))
  while [ "$SECONDS" -lt "$deadline" ]; do
    if ! ssh_cmd "$TARGET" "echo up" >/dev/null 2>&1; then
      echo "==> SSH has stopped."
      break
    fi
    sleep 2
  done

  if ssh_cmd "$TARGET" "echo up" >/dev/null 2>&1; then
    new_id=$(read_boot_id || true)
    if [ -n "$new_id" ] && [ "$new_id" != "$old_id" ]; then
      echo "==> Boot id changed (${old_id} -> ${new_id})."
      return 0
    fi
    echo "SSH kept answering and the boot id did not change (still ${old_id}). The Pi did not reboot. Stopped." >&2
    return 1
  fi

  echo "==> Waiting until SSH answers again (up to 5 minutes)."
  deadline=$((SECONDS + 300))
  while [ "$SECONDS" -lt "$deadline" ]; do
    if ssh_cmd "$TARGET" "echo up" >/dev/null 2>&1; then
      echo "==> SSH is back."
      break
    fi
    sleep 3
  done

  if ! ssh_cmd "$TARGET" "echo up" >/dev/null 2>&1; then
    echo "The Pi did not come back on SSH within 5 minutes. Stopped." >&2
    return 1
  fi

  new_id=$(read_boot_id)
  if [ -z "$new_id" ] || [ "$new_id" = "$old_id" ]; then
    echo "The boot id did not change (still ${old_id}). The Pi did not reboot. Stopped." >&2
    return 1
  fi
  echo "==> Boot id changed (${old_id} -> ${new_id})."
}

run_remote_reboot() {
  local script=$1
  # ssh -t so sudo and the password prompt have a terminal.
  # Exit status is ignored: reboot often closes SSH with 255, and sometimes
  # the client still sees 0 if the Pi has not dropped the session yet.
  set +e
  ssh -t "${SSH_BASE[@]}" "$TARGET" "$script"
  set -e
}

echo "==> Checking whether the overlay is on"
set +e
remote_overlay_on
overlay_rc=$?
set -e
if [ "$overlay_rc" -eq 2 ]; then
  exit 1
fi
if [ "$overlay_rc" -eq 0 ]; then
  old_boot=$(read_boot_id)
  echo "==> Overlay is on (boot id ${old_boot})."
  echo "==> Copying setup files, then phase 1 will turn the overlay off and reboot."
  copy_files
  echo "    Type the current sudo password if the Pi asks. SSH will drop. That is expected."
  run_remote_reboot "sudo bash ~/${REMOTE}/pi/setup.sh phase1"
  wait_for_new_boot "$old_boot"
  set +e
  remote_overlay_on
  overlay_rc=$?
  set -e
  if [ "$overlay_rc" -ne 1 ]; then
    echo "The overlay is still on after the reboot. Stopped." >&2
    exit 1
  fi
  echo "==> Overlay is off."
else
  echo "==> Overlay is already off. Skipping the first reboot."
fi

echo "==> Copying files onto the writable root"
copy_files

old_boot=$(read_boot_id)
echo "==> Phase 2 (install, password, overlay, reboot). Boot id now ${old_boot}."
echo "    If sudo asks, type the current password."
echo "    Then type a new password for uscillaaa twice. This script does not store it."
run_remote_reboot "sudo KEEP_SSH=${KEEP_SSH:-0} bash ~/${REMOTE}/pi/setup.sh phase2"
wait_for_new_boot "$old_boot"

echo "==> Post-boot verify"
ssh_cmd "$TARGET" "bash ~/${REMOTE}/pi/verify.sh" || echo "Verify script could not be run." >&2

if [ "${KEEP_SSH:-0}" = "1" ]; then
  echo "==> KEEP_SSH=1, so SSH stays on."
else
  echo "==> Turning SSH off now that the new boot is confirmed."
  set +e
  ssh -t "${SSH_BASE[@]}" "$TARGET" "sudo raspi-config nonint do_ssh 1"
  ssh_rc=$?
  set -e
  if [ "$ssh_rc" -ne 0 ] && [ "$ssh_rc" -ne 255 ]; then
    echo "Could not turn SSH off (ssh exit ${ssh_rc})." >&2
    exit 1
  fi
fi

echo "DONE"
