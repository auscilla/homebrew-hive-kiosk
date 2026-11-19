-- Prefer a USB speaker over HDMI. Loaded by WirePlumber 0.4 (main.lua.d).
rule = {
  matches = {
    {
      { "node.name", "matches", "alsa_output.usb-*" },
    },
  },
  apply_properties = {
    ["priority.session"] = 2100,
    ["priority.driver"] = 2100,
  },
}
table.insert(alsa_monitor.rules, rule)
