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

5. Install. This reboots the Pi twice and takes about 10–15 minutes.

   ```bash
   ./pi/install-from-mac.sh uscillaaa@192.168.1.198
   ```

   You will be asked for the current sudo password, then a new password for `uscillaaa` twice. The password is typed into SSH. It is not written into a file. The script prints step lines and ends with `DONE`. To keep SSH for the update script, use `KEEP_SSH=1 ./pi/install-from-mac.sh uscillaaa@192.168.1.198` instead.

6. Look at the screen. It should be the Homebrew Hive kiosk in full screen, cursor hidden, with no desktop panel.

7. SSH should now be refused.

   ```bash
   ssh uscillaaa@192.168.1.198
   ```

   The connection is refused or times out.

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

Or, after SSH is off, from a local keyboard: Ctrl+Alt+F2, log in, run the same command. The script turns the overlay off, reboots, runs `apt full-upgrade`, turns the overlay back on, and reboots. If the automatic continue step does not run, after the first reboot run:

```bash
sudo bash /boot/firmware/hive-kiosk/update.sh --continue
```

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
