#!/usr/bin/env bash
# Run on Aaron's Mac. Copies this repo's Pi files and drives both setup phases.
# Usage: ./pi/install-from-mac.sh [user@host]
# KEEP_SSH=1 leaves SSH enabled at the end.
set -euo pipefail

TARGET=${1:-uscillaaa@192.168.1.198}
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
REMOTE=hive-kiosk

SSH_BASE=(
  -o ConnectTimeout=8
  -o ServerAliveInterval=15
  -o StrictHostKeyChecking=accept-new
)

echo "==> Target ${TARGET}"

ssh_cmd() {
  # The remote command is the arguments this function was given.
  # shellcheck disable=SC2029
  ssh "${SSH_BASE[@]}" "$@"
}

copy_files() {
  echo "==> Copying pi/, bridge.py, and hive-bridge.service to ${TARGET}:~/${REMOTE}/"
  ssh_cmd "$TARGET" "mkdir -p ~/${REMOTE}"
  scp "${SSH_BASE[@]}" -r \
    "$REPO_DIR/pi" \
    "$REPO_DIR/bridge.py" \
    "$REPO_DIR/hive-bridge.service" \
    "${TARGET}:~/${REMOTE}/"
}

wait_for_ssh() {
  local i
  echo "==> Waiting for ${TARGET} to answer SSH"
  i=1
  while [ "$i" -le 40 ]; do
    if ssh_cmd -o ConnectTimeout=5 "$TARGET" "echo HIVE_KIOSK_UP" >/dev/null 2>&1; then
      echo "==> SSH is back."
      return 0
    fi
    i=$((i + 1))
    sleep 5
  done
  echo "The Pi did not come back on SSH." >&2
  return 1
}

echo "==> Step 1: copy files"
copy_files

echo "==> Step 2: phase 1 (turn the overlay off if it is on, then reboot)"
echo "    Type the current sudo password if the Pi asks for it."
set +e
ssh -t "${SSH_BASE[@]}" "$TARGET" "sudo bash ~/${REMOTE}/pi/setup.sh phase1"
phase1_rc=$?
set -e

if [ "$phase1_rc" -eq 0 ]; then
  echo "==> Phase 1 did not reboot. The overlay was already off."
elif [ "$phase1_rc" -eq 255 ]; then
  echo "==> Phase 1 is rebooting the Pi."
  sleep 12
  i=0
  while [ "$i" -lt 12 ]; do
    if ! ssh_cmd -o ConnectTimeout=5 "$TARGET" "echo still-up" >/dev/null 2>&1; then
      break
    fi
    i=$((i + 1))
    sleep 5
  done
  wait_for_ssh
else
  echo "Phase 1 failed (ssh exit ${phase1_rc})." >&2
  exit 1
fi

echo "==> Step 3: copy files again (the first copy was wiped if the overlay was on)"
copy_files

echo "==> Step 4: phase 2 (packages, password, kiosk, overlay, reboot)"
echo "    If sudo asks, type the current password."
echo "    Then type a new password for uscillaaa twice. This script does not store it."
if [ "${KEEP_SSH:-0}" = "1" ]; then
  echo "    KEEP_SSH=1: SSH stays on."
else
  echo "    SSH is turned off at the end. The screen should come up as the kiosk after reboot."
fi

set +e
ssh -t "${SSH_BASE[@]}" "$TARGET" "sudo KEEP_SSH=${KEEP_SSH:-0} bash ~/${REMOTE}/pi/setup.sh phase2"
phase2_rc=$?
set -e

if [ "$phase2_rc" -ne 0 ] && [ "$phase2_rc" -ne 255 ]; then
  echo "Phase 2 failed (ssh exit ${phase2_rc})." >&2
  exit 1
fi

echo "DONE"
