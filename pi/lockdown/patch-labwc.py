#!/usr/bin/env python3
"""Point labwc shortcuts at a no-op and drop the desktop right-click menu.

Copies are edited in place. Fullscreen (F11) is left alone.
"""
import sys
import xml.etree.ElementTree as ET

BLOCKED = ("A-F4", "C-w", "C-q", "C-A-t", "A-Tab", "A-grave")


def noop_keybind(parent, key):
    for node in list(parent.findall("keybind")):
        if node.get("key") == key:
            parent.remove(node)
    bind = ET.SubElement(parent, "keybind", {"key": key})
    action = ET.SubElement(bind, "action", {"name": "Execute"})
    command = ET.SubElement(action, "command")
    command.text = "true"


def strip_root_menu(mouse):
    for context in list(mouse.findall("context")):
        if context.get("name") != "Root":
            continue
        for bind in list(context.findall("mousebind")):
            for action in list(bind.findall("action")):
                if action.get("name") == "ShowMenu":
                    bind.remove(action)
            if len(list(bind)) == 0:
                context.remove(bind)


def main():
    if len(sys.argv) != 2:
        print("usage: patch-labwc.py rc.xml", file=sys.stderr)
        return 1
    path = sys.argv[1]
    tree = ET.parse(path)
    root = tree.getroot()
    keyboard = root.find("keyboard")
    if keyboard is None:
        keyboard = ET.SubElement(root, "keyboard")
    for key in BLOCKED:
        noop_keybind(keyboard, key)
    mouse = root.find("mouse")
    if mouse is None:
        mouse = ET.SubElement(root, "mouse")
    strip_root_menu(mouse)
    tree.write(path, encoding="unicode", xml_declaration=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
