#!/bin/bash
# Boot-time USB speaker setup. Hardware mixer at 100%, then VOLUME_BOOST on top.
# PipeWire/WirePlumber when that is the running server; ALSA softvol otherwise.
set -u

CONF=/etc/hive-kiosk/kiosk.conf
VOLUME_BOOST="200%"
if [ -f "$CONF" ]; then
  # shellcheck source=kiosk.conf
  source "$CONF"
fi

boost_number() {
  local raw=${VOLUME_BOOST%%%}
  case "$raw" in
    ''|*[!0-9]*) printf '%s\n' 200 ;;
    *) printf '%s\n' "$raw" ;;
  esac
}

usb_card() {
  aplay -l 2>/dev/null | awk '
    /^card / {
      card=$2
      sub(":", "", card)
      line=$0
    }
    /[Uu][Ss][Bb]/ && card != "" { print card; exit }
  '
}

set_alsa_mixer_full() {
  local card=$1
  local ctrl
  while IFS= read -r ctrl; do
    [ -n "$ctrl" ] || continue
    amixer -c "$card" sset "$ctrl" "100%" unmute >/dev/null 2>&1 || \
      amixer -c "$card" sset "$ctrl" unmute >/dev/null 2>&1 || true
  done < <(amixer -c "$card" scontrols 2>/dev/null | sed -n "s/^Simple mixer control '\\([^']*\\)'.*/\\1/p")
}

pipewire_running() {
  if command -v wpctl >/dev/null 2>&1 && wpctl status >/dev/null 2>&1; then
    return 0
  fi
  if command -v pactl >/dev/null 2>&1 && pactl info 2>/dev/null | grep -qi 'pipewire'; then
    return 0
  fi
  return 1
}

usb_sink() {
  if ! command -v pactl >/dev/null 2>&1; then
    return 1
  fi
  pactl list short sinks 2>/dev/null | awk 'BEGIN{IGNORECASE=1} /usb/ { print $2; exit }'
}

apply_pipewire() {
  local card sink pct
  card=$(usb_card || true)
  sink=$(usb_sink || true)
  if [ -z "$card" ] && [ -z "$sink" ]; then
    return 1
  fi
  if [ -n "$card" ]; then
    set_alsa_mixer_full "$card"
  fi
  pct=$(boost_number)
  if [ -n "$sink" ]; then
    pactl set-default-sink "$sink" || true
    # Hardware mixer is already 100%. This is the extra software boost.
    pactl set-sink-mute "$sink" 0 || true
    pactl set-sink-volume "$sink" "${pct}%" || return 1
    echo "PipeWire USB sink $sink at ${pct}% (mixer 100% where present)."
    return 0
  fi
  if command -v wpctl >/dev/null 2>&1; then
    wpctl set-mute @DEFAULT_AUDIO_SINK@ 0 || true
    wpctl set-volume @DEFAULT_AUDIO_SINK@ "${pct}%" || return 1
    echo "PipeWire default sink at ${pct}%."
    return 0
  fi
  return 1
}

write_asound_softvol() {
  local card=$1
  local db
  db=$(awk -v p="$(boost_number)" 'BEGIN {
    if (p < 100) p = 100
    printf "%.2f", 20 * log(p / 100) / log(10)
  }')
  cat > /etc/asound.conf << EOF
# Managed by hive-audio.sh. Hardware card stays at 100%; softvol is the boost.
pcm.hive_usb {
  type hw
  card $card
  device 0
}
pcm.hive_boost {
  type softvol
  slave.pcm "hive_usb"
  control {
    name "HiveBoost"
    card $card
  }
  max_dB $db
}
pcm.!default {
  type plug
  slave.pcm "hive_boost"
}
ctl.!default {
  type hw
  card $card
}
EOF
  # Open the control once so amixer can set it, then push it to the top of the range.
  timeout 2 speaker-test -D hive_boost -c 2 -l 1 -t sine >/dev/null 2>&1 || true
  amixer -c "$card" sset HiveBoost "100%" >/dev/null 2>&1 || true
}

apply_alsa() {
  local card
  card=$(usb_card || true)
  if [ -z "$card" ]; then
    return 1
  fi
  set_alsa_mixer_full "$card"
  if [ "$(boost_number)" -gt 100 ]; then
    write_asound_softvol "$card"
  fi
  echo "ALSA USB card $card mixer at 100% with softvol boost ${VOLUME_BOOST}."
  return 0
}

try_once() {
  if pipewire_running; then
    apply_pipewire
    return $?
  fi
  apply_alsa
}

attempt=0
while [ "$attempt" -lt 15 ]; do
  if try_once; then
    exit 0
  fi
  attempt=$((attempt + 1))
  sleep 2
done

echo "No USB speaker found after waiting. Volume was not changed." >&2
exit 0
