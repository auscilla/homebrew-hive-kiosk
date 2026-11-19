# Raspberry Pi kiosk setup

Target machine: hostname `kiosk`, user `uscillaaa`, address `192.168.1.198`, Raspberry Pi OS 64-bit, Wi-Fi only. The root filesystem uses an overlay (tmpfs on a read-only root), so a normal install disappears on reboot until the overlay is turned off.

Chromium opens the live kiosk at `https://auscilla.github.io/homebrew-hive-kiosk/`.

With the overlay on, package upgrades vanish at the next reboot, so the apt timers only waste RAM. When the overlay is enabled, the installer disables `apt-daily-upgrade.timer`, `apt-daily.timer`, and `unattended-upgrades`. OS updates happen through `pi/update.sh` (disable overlay, reboot, full-upgrade, enable overlay, reboot). Run that from a keyboard on the Pi, or leave SSH on with `KEEP_SSH=1`.

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

## Fix a Pi that already finished, with SSH off

The lockdown does not bind Ctrl+Alt+F1 through Ctrl+Alt+F12, so a text console stays available. Kiosk guests still cannot log in without the account password.

1. On the Pi keyboard, press Ctrl+Alt+F2.
2. Type `uscillaaa` and press Enter.
3. Type the password and press Enter.
4. Paste this and press Enter. It does not change the password or turn SSH on.

   ```bash
   curl -fsSL https://raw.githubusercontent.com/auscilla/homebrew-hive-kiosk/cursor/pi-setup-and-pin-fixes/pi/fix-local.sh | sudo bash
   ```

5. Type the password again when sudo asks, and press Enter.

You should see `Installing the fix scripts. SSH is not changed.` If the overlay is on, the next line is `Overlay is on. Disabling it and rebooting. The fix continues by itself.` The Pi reboots with no more typing. After that boot it prints the upgrade-timer line, runs the read-only checks, prints `Confirmed overlayroot=tmpfs`, then `Rebooting into the kiosk.` About 10 minutes, one or two reboots. The same check output is on the screen, in the journal (`journalctl -t hive-fix`), and in `/boot/firmware/hive-verify.txt`.

Ctrl+Alt+F1 or Ctrl+Alt+F7 goes back to the kiosk picture if you switched away.

If Ctrl+Alt+F2 does nothing on a Pi that was locked down before this fix, power it off, put the SD card in the Mac, and on the boot partition add `systemd.unit=multi-user.target` to the end of the single line in `cmdline.txt`. Boot, log in on the text console, and run the curl command above. The fix removes that token before the last reboot so the kiosk desktop comes back.

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
