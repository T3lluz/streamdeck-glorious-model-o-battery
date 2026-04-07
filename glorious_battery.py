#!/usr/bin/env python3
"""
Read battery from Glorious mice via HID feature reports.

- Wired Model O/O- (PID 0x0036): gloriousctl protocol — report 0x05, command 0x1D,
  prefer USB interface 1.
- Model O Wireless dongle (PID 0x2022): korkje/mow on USB interface 2.
- Same mouse on USB cable (PID 0x2011): same mow report; when active, treat as on USB power
  (Charging if level < 100%), matching mow's wired CLI behavior.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time

import hid

VID = 0x258A
# Wired O/O-, Model O 2 wired (mow), Model O Wireless dongle.
DEFAULT_PIDS = (0x0036, 0x2011, 0x2022)

# sinowealth / gloriousctl (wired Model O, Model D, …)
REPORT_ID = 0x05
CMD_BATTERY = 0x1D
FEATURE_RESP_MIN = 8

# korkje/mow — Model O Wireless / O 2
MOW_PIDS = frozenset((0x2022, 0x2011))
# USB cable to PC (wired mode). mow treats this as always on USB power when active — not the 2.4 GHz dongle.
MOW_WIRED_USB_PID = 0x2011
MOW_REPORT_ID = 0
MOW_REPORT_LEN = 65
# Byte 1 markers (see mow src/report/battery.rs)
_MOW_MARKERS = (0xA1, 0xA4, 0xA2, 0xA0, 0xA3)


def _bar(level: int, width: int = 10) -> str:
    filled = max(0, min(width, round((level / 100) * width)))
    return "[" + ("#" * filled) + ("-" * (width - filled)) + "]"


def _iface_sort_key(info: dict, pid: int) -> tuple:
    """Prefer the HID interface that actually accepts vendor feature reports."""
    n = info.get("interface_number")
    if pid in MOW_PIDS:
        if n == 2:
            return (0, 0)
        if n == -1 or n is None:
            return (2, 0)
        return (1, int(n))
    # gloriousctl wired mice
    if n == 1:
        return (0, 0)
    if n == -1 or n is None:
        return (2, 0)
    return (1, int(n))


def _collect_entries(vid: int, pids: tuple[int, ...]) -> list[dict]:
    seen: set[bytes | str] = set()
    out: list[dict] = []
    for pid in pids:
        for info in hid.enumerate(vid, pid):
            path = info.get("path")
            if not path or path in seen:
                continue
            seen.add(path)
            out.append(info)
    return out


def _try_sinowealth_battery(dev: hid.device) -> tuple[int, bool, int, str | None] | None:
    """gloriousctl-style: level, charging, voltage_mV, status_override (None = use charging bool)."""
    req = [REPORT_ID, CMD_BATTERY, 0, 0, 0, 0]
    try:
        dev.send_feature_report(req)
    except OSError:
        return None

    try:
        resp = dev.get_feature_report(REPORT_ID, FEATURE_RESP_MIN)
    except OSError:
        return None

    if len(resp) < 6:
        return None
    if int(resp[1]) != CMD_BATTERY:
        return None

    level = int(resp[2])
    charging = bool(resp[3] & 0x01)
    mv = int(resp[4]) | (int(resp[5]) << 8)
    if level > 100:
        return None
    level = max(0, min(100, level))
    return level, charging, mv, None


def _mow_status(resp: list[int] | bytes, pid: int, level: int) -> tuple[str, bool]:
    """
    Interpret mow battery response. Returns (status label, charging).

    For PID 0x2011 (mouse on USB cable), mow's CLI always labels output as charging while
    active — the device is on USB power. The 2.4 GHz dongle (0x2022) does not get that rule.
    """
    if len(resp) < 9:
        return "Unknown", False
    if int(resp[6]) != 0x83:
        return "Unknown", False
    b1 = int(resp[1])
    try:
        idx = _MOW_MARKERS.index(b1)
    except ValueError:
        return "Unknown", False
    if idx == 0:
        if pid == MOW_WIRED_USB_PID:
            if level < 100:
                return "Charging", True
            return "Full", False
        return "Discharging", False
    if idx == 1:
        return "Asleep", False
    if idx == 3:
        return "Waking", False
    return "Unknown", False


def _try_mow_battery(dev: hid.device, pid: int) -> tuple[int, bool, int, str | None] | None:
    """korkje/mow-style Model O Wireless / O 2 (65-byte feature report, report ID 0)."""
    buf = [0] * MOW_REPORT_LEN
    buf[3] = 0x02
    buf[4] = 0x02
    buf[6] = 0x83
    try:
        dev.send_feature_report(buf)
    except OSError:
        return None

    time.sleep(0.05)

    try:
        resp = dev.get_feature_report(MOW_REPORT_ID, MOW_REPORT_LEN)
    except OSError:
        return None

    if len(resp) < 9:
        return None
    if int(resp[6]) != 0x83:
        return None

    level = int(resp[8])
    if level == 0:
        level = 1
    if level > 100:
        return None
    label, chg_hint = _mow_status(resp, pid, level)
    return level, chg_hint, 0, label


def _open_and_read(info: dict) -> tuple[hid.device, tuple[int, bool, int, str | None], str] | None:
    """Returns (device, (level, charging, mv, status_override), protocol_name) or None."""
    path = info.get("path")
    pid = int(info.get("product_id") or 0)
    if not path:
        return None
    dev = hid.device()
    try:
        dev.open_path(path)
    except OSError:
        return None

    protocols: list[tuple[str, object]] = []
    if pid in MOW_PIDS:
        protocols.append(("mow", lambda d: _try_mow_battery(d, pid)))
        protocols.append(("sinowealth", _try_sinowealth_battery))
    else:
        protocols.append(("sinowealth", _try_sinowealth_battery))
        protocols.append(("mow", lambda d: _try_mow_battery(d, pid)))

    for name, fn in protocols:
        try:
            parsed = fn(dev)
        except OSError:
            parsed = None
        if parsed is not None:
            return dev, parsed, name

    try:
        dev.close()
    except Exception:
        pass
    return None


def read_battery(*, pids: tuple[int, ...]) -> dict:
    """
    Poll the mouse once. Returns a dict suitable for --json / Stream Deck.
    On success: ok, level, charging, status, proto, mv, product, pid (hex string).
    On failure: ok, error, error_code.
    """
    entries = _collect_entries(VID, pids)
    entries.sort(
        key=lambda i: (
            _iface_sort_key(i, int(i.get("product_id") or 0)),
            str(i.get("path")),
        )
    )

    if not entries:
        return {
            "ok": False,
            "error": (
                f"No HID interface for VID=0x{VID:04x}; tried PIDs "
                + ", ".join(f"0x{p:04x}" for p in pids)
            ),
            "error_code": "not_found",
        }

    for info in entries:
        opened = _open_and_read(info)
        if opened is None:
            continue
        dev, parsed, proto = opened
        try:
            level, charging, mv, status_override = parsed
            status_text = status_override or ("Charging" if charging else "Discharging")
            charging_out = bool(charging) or (status_override == "Charging")
            pid = int(info.get("product_id") or 0)
            product = str(info.get("product_string") or "Glorious mouse")
            return {
                "ok": True,
                "level": level,
                "charging": charging_out,
                "status": status_text,
                "proto": proto,
                "mv": mv,
                "product": product,
                "pid": f"0x{pid:04x}",
            }
        finally:
            try:
                dev.close()
            except Exception:
                pass

    return {
        "ok": False,
        "error": "Device found but battery query failed on every interface (close Glorious CORE, try Admin).",
        "error_code": "no_response",
    }


def cmd_list(vid: int) -> int:
    rows: list[dict] = []
    for info in hid.enumerate(vid, 0):
        rows.append(info)
    if not rows:
        print(f"No HID devices with VID=0x{vid:04x} (is the dongle or cable plugged in?)")
        return 1
    print(f"HID devices with VID=0x{vid:04x}:\n")
    for info in sorted(
        rows,
        key=lambda i: (
            i.get("product_id", 0),
            _iface_sort_key(i, int(i.get("product_id") or 0)),
            str(i.get("path")),
        ),
    ):
        pid = info.get("product_id", 0)
        iface = info.get("interface_number")
        prod = info.get("product_string") or "?"
        manu = info.get("manufacturer_string") or "?"
        usage = info.get("usage")
        usage_page = info.get("usage_page")
        print(
            f"  PID=0x{pid:04x}  IFace={iface!s:>3}  "
            f"usage_page={usage_page} usage={usage}  {manu} / {prod}"
        )
    print(
        "\nModel O Wireless: dongle PID 0x2022 (interface 2); USB cable PID 0x2011 (charging inferred when active).\n"
        "Classic wired Model O/O- is usually PID 0x0036 (interface 1, gloriousctl protocol).\n"
        "Run without --pid to try common PIDs automatically."
    )
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Read Glorious mouse battery via HID.")
    parser.add_argument(
        "--list",
        action="store_true",
        help="List all HID devices with Glorious VID (find your PID / interface).",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Print a single JSON object on stdout (for Stream Deck / scripts).",
    )
    parser.add_argument(
        "--pid",
        type=str,
        default=os.environ.get("GLORIOUS_PID", ""),
        help="USB PID (hex), e.g. 2022 for Model O Wireless. Default: try 0036 and 2022.",
    )
    args = parser.parse_args()

    if args.list:
        return cmd_list(VID)

    if args.pid:
        try:
            pids = (int(args.pid.strip().replace("0x", ""), 16),)
        except ValueError:
            print("ERROR: --pid must be hex, e.g. 2022 or 0x2022")
            return 1
    else:
        pids = DEFAULT_PIDS

    if args.json:
        result = read_battery(pids=pids)
        print(json.dumps(result))
        return 0 if result.get("ok") else 1

    result = read_battery(pids=pids)
    if not result.get("ok"):
        print(result.get("error", "Unknown error"))
        if result.get("error_code") == "not_found":
            print("Run:  python glorious_battery.py --list")
        return 1

    level = result["level"]
    charging = result["charging"]
    mv = result["mv"]
    status_text = result["status"]
    product = result["product"]
    pid = result["pid"]

    print(f"Found: {product} (VID=0x{VID:04x}, PID={pid})")
    print()
    print(f"Battery: {level}%")
    print(f"Status:  {status_text}")
    if mv > 0:
        print(f"Voltage: {mv / 1000.0:.2f} V")
    else:
        print("Voltage: --")
    print(_bar(level))
    print()
    print(f"RAW:{level}")
    print(f"CHARGING:{1 if charging else 0}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
