#!/bin/bash
# Read-only checks. Prints each command, then its result. Does not change the Pi.
set +e

echo "findmnt / -no FSTYPE,SOURCE"
findmnt / -no FSTYPE,SOURCE

echo "grep -o 'overlayroot=[^ ]*' /boot/firmware/cmdline.txt"
grep -o 'overlayroot=[^ ]*' /boot/firmware/cmdline.txt

echo "findmnt /boot/firmware -no OPTIONS"
findmnt /boot/firmware -no OPTIONS

echo "systemctl is-enabled unattended-upgrades apt-daily-upgrade.timer"
systemctl is-enabled unattended-upgrades apt-daily-upgrade.timer

echo "ls /usr/share/icons/hive-blank/cursors/left_ptr"
ls /usr/share/icons/hive-blank/cursors/left_ptr

echo "systemctl is-active kiosk.service"
kiosk_user=uscillaaa
kiosk_uid=$(id -u "$kiosk_user" 2>/dev/null)
if [ -n "$kiosk_uid" ] && [ -S "/run/user/${kiosk_uid}/bus" ]; then
  sudo -u "$kiosk_user" XDG_RUNTIME_DIR="/run/user/${kiosk_uid}" systemctl --user is-active kiosk.service
else
  systemctl is-active kiosk.service
fi

echo "systemctl is-enabled ssh"
systemctl is-enabled ssh

exit 0
