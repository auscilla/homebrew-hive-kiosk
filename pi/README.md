# Raspberry Pi kiosk setup

Target machine: hostname `kiosk`, user `uscillaaa`, address `192.168.1.198`, Raspberry Pi OS 64-bit, Wi-Fi only. The root filesystem uses an overlay (tmpfs on a read-only root), so a normal install disappears on reboot until the overlay is turned off.

Chromium opens the live kiosk at `https://auscilla.github.io/homebrew-hive-kiosk/`.

With the overlay on, package upgrades vanish at the next reboot. `update.sh` turns the overlay off, upgrades, turns it back on, and reboots. Run that from a keyboard on the Pi, or leave SSH on with `KEEP_SSH=1`.

## Install from Aaron's Mac

One command per step. The Pi is on the store Wi-Fi and SSH is still on.

1. Check that the Pi answers.

   ```bash
   ping -c 3 192.168.1.198
   ```

   You should see three replies from `192.168.1.198`.

2. Confirm SSH, then leave.

   ```bash
   ssh uscillaaa@192.168.1.198
   ```

   You get a shell prompt. Type `exit`.

3. Save a backup on the Mac before anything changes.

   ```bash
   ssh uscillaaa@192.168.1.198 'sudo tar czf - /etc /home/uscillaaa' > ~/pi-backup-2026-11-18.tgz
   ```

   The command finishes quietly. `ls -lh ~/pi-backup-2026-11-18.tgz` shows a file that is not empty. If the overlay is already on, this backup is the merged view. Restore it only after the overlay is off (see Rollback).

4. Clone this branch.

   ```bash
   git clone -b cursor/pi-setup-and-pin-fixes https://github.com/auscilla/homebrew-hive-kiosk.git ~/hive-kiosk && cd ~/hive-kiosk
   ```

   The shell ends in `~/hive-kiosk`.

5. Install. This reboots the Pi twice and takes about 10–15 minutes. It is safe to run again if a reboot interrupted the last try.

   ```bash
   ./pi/install-from-mac.sh uscillaaa@192.168.1.198
   ```

   You should see `Overlay is on` (or `Overlay is already off. Skipping the first reboot.` if you are rerunning after phase 1). When a reboot happens, the next lines are `Waiting until SSH stops`, `SSH has stopped`, `SSH is back`, and `Boot id changed (... -> ...)`. A dropped SSH session is expected. The script does not treat that as "the overlay was already off."

   Then it asks for the current sudo password, then a new password for `uscillaaa` twice. The password is typed into SSH. It is not written into a file. After the second reboot it waits for a new boot id again, turns SSH off, and prints `DONE`. To leave SSH on, use `KEEP_SSH=1 ./pi/install-from-mac.sh uscillaaa@192.168.1.198` instead.

6. Look at the screen. It should be the Homebrew Hive kiosk in full screen, cursor hidden, with no desktop panel.

7. SSH should now be refused.

   ```bash
   ssh uscillaaa@192.168.1.198
   ```

   The connection is refused or times out. That off switch is applied after the new boot is confirmed. The overlay is already on, so a later reboot starts SSH again. To keep it off across reboots, turn the overlay off, run `sudo raspi-config nonint do_ssh 1`, turn the overlay back on, and reboot.

## Fresh Pi

Use Raspberry Pi Imager with Raspberry Pi OS 64-bit (desktop). In the imager settings (the gear), set:

- hostname `kiosk`
- user `uscillaaa` and a temporary password
- the store Wi-Fi network and country US
- SSH enabled

Boot it, find it at `192.168.1.198` (or the address the router gives it), then start at step 1 above. Pass that address to `install-from-mac.sh` if it is not `192.168.1.198`.

## Updates

```bash
sudo bash /home/uscillaaa/hive-kiosk/pi/update.sh
```

Or, after SSH is off, from a local keyboard: Ctrl+Alt+F2, log in, run the same command. If the overlay is on, the script turns it off and reboots. Run it again after that reboot: it upgrades, turns the overlay back on, and reboots. Running it again from either state is safe.

## Rollback

On the Pi keyboard: Ctrl+Alt+F2, log in as `uscillaaa`, then:

```bash
sudo raspi-config nonint disable_overlayfs
sudo raspi-config nonint do_ssh 0
sudo reboot
```

From the Mac, once SSH works, restore the backup onto the writable root (overlay off):

```bash
ssh uscillaaa@192.168.1.198 'sudo tar xzf - -C /' < ~/pi-backup-2026-11-18.tgz
```

Then reboot. To put the overlay back: `sudo raspi-config nonint enable_overlayfs` and reboot.
