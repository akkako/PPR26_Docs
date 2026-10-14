# Accuracy Test

This page describes how to measure the PPR26 **setpoint error** (setpoint vs measured value),
for factory testing, incoming inspection or an annual re-check. The sweep is **read-only** with
respect to the device: it never touches the calibration store.

## Requirements

| Item | Requirement |
| ---- | ---- |
| Device | PPR26 in **AT mode** (USB CDC virtual serial port) |
| Reference meter | 6½-digit or better DMM, e.g. HP / Agilent 34401A / 34410A / 34411A |
| Wiring | 4-wire: DMM 4W terminals to the PPR26 front-panel Sense / Output terminals (polarity does not matter) |
| Acceptance limit | Factory specification **±(0.05% × setpoint + 1 Ω)**, see [Specifications](../../datasheet/index.md) |

!!! warning "The reference meter sets the ceiling on what you can measure"
    To verify a limit like ±(0.05% + 1 Ω), the reference meter itself must be clearly better than the
    limit under test (a third of it or less is a common rule). A 34410A is specified for
    0.0035% (reading) + 0.0009% (range) on 4-wire resistance over one year, which leaves plenty of margin.

## Method

1. **Log-uniform setpoints**: by default 50 points per decade from 10 Ω to 4 MΩ, both endpoints included.
   Every setpoint is then **rounded to a whole ohm** — the step the device itself declares
   (`AT+RES.STEP` = 1000 mΩ). Asking for a fractional value means asking the device to represent a value
   it does not have, and whatever it does with the remainder lands in the measured error, where it cannot
   be told apart from the resistance network's own error.
2. **Point by point**: write the setpoint → put the DMM on the smallest range that fits → wait for the
   relays to settle → average several readings. Settling is done by *discarding readings* rather than
   sleeping: a plain sleep lets the DMM go idle, and the first reading afterwards is far worse.
3. **Record the error**: absolute (mΩ / Ω) and relative (% / ppm) error are printed live and written to a
   CSV, together with the device's own estimate (`AT+RES.PV?`) for comparison.

`Ctrl+C` stops the sweep and still writes the points collected so far to the CSV (`# Result,cancelled`).

## Test script

The script below is a **standalone version**: it needs only `pyserial` (device) and `pyvisa` (DMM), with no
other wrapper library, and can be copied and used as is. Its CSV columns match the engineering toolchain,
so the file can be plotted directly.

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""PPR26 accuracy test: setpoint vs measured value (10 ohm .. 4 Mohm).

Sweeps log-uniform setpoints, measures the actual output resistance with a DMM at every
point, and writes absolute/relative error to a CSV.  The sweep is read-only with respect to
the device (the calibration store is never touched), and the CSV can be plotted directly.

Usage:
    python ppr26_accuracy_test.py --dry-run                 # list the setpoints, no hardware
    python ppr26_accuracy_test.py -p COM12 --dmm "USB0::0x0957::0x0607::MY53009844::0::INSTR"
    python ppr26_accuracy_test.py --per-decade 50 --settle 3 --averages 8

Dependencies: pyserial (PPR26), pyvisa + a VISA backend (DMM).
"""

import argparse
import csv
import datetime
import math
import statistics
import sys
import time

import serial
from serial.tools import list_ports

import pyvisa

RES_MIN_MOHM = 5000                          # 5 ohm
RES_MAX_MOHM = 4000000000                    # 4 Mohm
#: Setpoint rounding quantum.  The device declares a 1000 mohm setpoint step
#: (AT+RES.STEP), so asking for a fractional value means asking for something the
#: box has to reconcile internally -- and that rounding ends up in the measurement.
ROUND_QUANTUM_OHM = 1.0
#: DMM resistance ranges (34401A/34410A series): the smallest one that fits the setpoint.
DMM_RANGES_OHM = [100, 1000, 10000, 100000, 1000000, 10000000, 100000000]
DMM_OVERFLOW = 9.0e36                        # 34401A/34410A overflow reading


class TestError(RuntimeError):
    """Device, DMM or argument error."""


# --------------------------------------------------------------------------- #
# Setpoints
# --------------------------------------------------------------------------- #
def log_points(start_ohm, stop_ohm, per_decade):
    """Log-uniform setpoints, both endpoints included: neighbours are 10**(1/n) apart."""
    if start_ohm <= 0 or stop_ohm <= 0:
        raise TestError("start/stop must be positive")
    if stop_ohm <= start_ohm:
        raise TestError("stop must be greater than start")
    if per_decade <= 0:
        raise TestError("per-decade must be positive")
    steps = max(1, int(round(math.log10(stop_ohm / start_ohm) * per_decade)))
    ratio = stop_ohm / start_ohm
    return [start_ohm * ratio ** (i / float(steps)) for i in range(steps + 1)]


def round_points(points, quantum_ohm=ROUND_QUANTUM_OHM):
    """Snap to whole ohms and drop repeats.

    A log sweep is denser than 1 ohm at the low end (from 10 ohm at 50 points per
    decade the first few steps are less than 1 ohm apart), so rounding collapses
    neighbours.  Duplicates are dropped and the caller reports how many.
    """
    out, seen = [], set()
    for value in points:
        snapped = round(value / quantum_ohm) * quantum_ohm
        if snapped <= 0.0:
            continue
        key = round(snapped, 6)
        if key in seen:
            continue
        seen.add(key)
        out.append(snapped)
    return out


def to_mohm(ohm):
    return int(round(float(ohm) * 1000.0))


def fmt_ohm(value):
    if abs(value) >= 1.0e6:
        return "{:.6f} MOhm".format(value / 1.0e6)
    if abs(value) >= 1.0e3:
        return "{:.6f} kOhm".format(value / 1.0e3)
    return "{:.6f} Ohm".format(value)


def fmt_duration(seconds):
    if seconds < 0 or seconds != seconds:
        return "--:--"
    seconds = int(round(seconds))
    return "{:d}:{:02d}:{:02d}".format(seconds // 3600, (seconds % 3600) // 60, seconds % 60)


def best_range(ohm):
    """Smallest DMM range that can hold this setpoint."""
    for rng in DMM_RANGES_OHM:
        if ohm <= rng:
            return rng
    return DMM_RANGES_OHM[-1]


# --------------------------------------------------------------------------- #
# PPR26 (AT mode)
# --------------------------------------------------------------------------- #
class PPR26:
    """Only the few AT commands this test needs -- no other wrapper library."""

    def __init__(self, port=None, timeout=1.0):
        self.port = port or self.find_port()
        self.ser = serial.Serial(self.port, 115200, timeout=timeout)

    @staticmethod
    def find_port():
        ports = list(list_ports.comports())
        hits = [p.device for p in ports if p.vid == 0xFFFE]
        if len(hits) == 1:
            return hits[0]
        if not hits:
            raise TestError("no PPR26 found (no serial port with VID 0xFFFE); "
                            "make sure the device is in AT mode and pass -p")
        raise TestError("several candidate ports: {}; pick one with -p".format(", ".join(hits)))

    def close(self):
        self.ser.close()

    def _command(self, line, expect_reply=True):
        self.ser.reset_input_buffer()
        self.ser.write((line + "\n").encode("ascii"))
        if not expect_reply:
            return ""
        reply = self.ser.readline().decode("ascii", "replace").strip()
        if not reply:
            raise TestError("{} got no reply (timeout)".format(line))
        if reply in ("ERROR", "OVERFLOW"):
            raise TestError("{} -> {}".format(line, reply))
        return reply

    def _query_value(self, line):
        return self._command(line).split("=", 1)[1]

    def set_resistance(self, mohm):
        if not RES_MIN_MOHM <= int(mohm) <= RES_MAX_MOHM:
            raise TestError("setpoint {} mohm out of range".format(mohm))
        self._command("AT+RES.SP={}".format(int(mohm)))

    def resistance_pv(self):
        value = self._query_value("AT+RES.PV?")
        return float("inf") if value.lower() == "inf" else float(value)

    def info(self):
        def q(cmd):
            try:
                return self._query_value(cmd)
            except Exception:
                return "?"

        try:
            temperature = float(q("AT+DEV.TEMP?")) / 10.0
        except Exception:
            temperature = float("nan")
        return {
            "model": q("AT+DEV.MODEL?"),
            "sn": q("AT+DEV.SN?"),
            "firmware": q("AT+DEV.FWVER?"),
            "hardware": q("AT+DEV.HWVER?"),
            "temperature_c": temperature,
        }


# --------------------------------------------------------------------------- #
# DMM (VISA)
# --------------------------------------------------------------------------- #
class Dmm:
    """Resistance measurement on an HP/Agilent 34401A / 34410A / 34411A (4-wire or 2-wire)."""

    def __init__(self, resource=None, timeout_ms=10000):
        self.rm = pyvisa.ResourceManager()
        self.resource = resource or self._find_resource()
        self.inst = self.rm.open_resource(self.resource)
        self.inst.timeout = timeout_ms
        self.inst.write_termination = "\n"
        self.inst.read_termination = "\n"
        fields = [f.strip() for f in self.inst.query("*IDN?").split(",")]
        self.model = fields[1] if len(fields) > 1 else "?"
        self.sn = fields[2] if len(fields) > 2 else ""

    def _find_resource(self):
        """Auto-detect the DMM: prefer Agilent/Keysight (0x0957 in the VISA resource string)."""
        usb = [r for r in self.rm.list_resources() if "USB" in r.upper()]
        hits = [r for r in usb if "0x0957" in r.lower()]
        if len(hits) == 1:
            return hits[0]
        if not hits and len(usb) == 1:
            return usb[0]
        if not hits and not usb:
            raise TestError("no DMM found; select one with --dmm")
        raise TestError("several candidate instruments: {}; pick one with --dmm".format(
            ", ".join(hits or usb)))

    def close(self):
        self.inst.close()

    def configure(self, mode="4w", nplc=10.0, range_ohm=None):
        func = "FRES" if mode == "4w" else "RES"
        self.inst.write("CONF:{}".format(func))
        self.inst.write("SENS:{}:NPLC {:.1f}".format(func, nplc))
        if range_ohm:
            self.inst.write("SENS:{}:RANG {:.0f}".format(func, range_ohm))
            self.inst.write("SENS:{}:RANG:AUTO OFF".format(func))

    def read_ohm(self):
        return float(self.inst.query("READ?").strip())

    def settle(self, seconds, mode="4w"):
        """Wait for the relays by *discarding readings*.

        A plain sleep lets the DMM go idle and the first reading afterwards is far
        worse; continuous readings also keep the auto-zero loop converged.
        """
        deadline = time.monotonic() + max(0.0, seconds)
        while True:
            self.read_ohm()
            if time.monotonic() >= deadline:
                return

    def measure(self, count, mode="4w", range_ohm=None, nplc=10.0, settle_s=0.0):
        """Average ``count`` readings; returns (mean, stdev, samples, actual range)."""
        func = "FRES" if mode == "4w" else "RES"
        count = max(1, int(count))
        readings = []
        bumped = False
        while len(readings) < count:
            value = self.read_ohm()
            if value >= DMM_OVERFLOW:
                if bumped:
                    raise TestError("DMM overflow (range {:.0f} ohm)".format(range_ohm or 0))
                # Did not fit the selected range: step up one decade and redo this point.
                bumped = True
                range_ohm = (range_ohm or best_range(1.0)) * 10.0
                self.configure(mode=mode, nplc=nplc, range_ohm=range_ohm)
                self.settle(settle_s, mode=mode)
                readings = []
                continue
            readings.append(value)
        actual_range = float(self.inst.query("SENS:{}:RANG?".format(func)).strip())
        mean = statistics.fmean(readings)
        stdev = statistics.stdev(readings) if len(readings) > 1 else 0.0
        return mean, stdev, len(readings), actual_range


# --------------------------------------------------------------------------- #
# CSV (column names compatible with the plotting script)
# --------------------------------------------------------------------------- #
COLUMNS = [
    "index", "setpoint_ohm", "setpoint_mohm",
    "device_pv_mohm", "device_pv_error_mohm", "device_pv_rel_pct", "device_pv_rel_ppm",
    "measured_ohm", "measured_mohm", "abs_error_ohm", "abs_error_mohm",
    "rel_error_pct", "rel_error_ppm", "stdev_mohm", "stderr_ppm",
    "samples", "range_ohm", "elapsed_s",
]


def write_csv(path, rows, meta, notes=()):
    def cell(value, spec):
        return "" if value is None else spec.format(value)

    with open(path, "w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        for key in sorted(meta):
            writer.writerow(["# " + str(key), meta[key]])
        for note in notes:
            writer.writerow(["# Note", note])
        writer.writerow(COLUMNS)
        for r in rows:
            writer.writerow([
                r["index"],
                "{:.9g}".format(r["setpoint_ohm"]), r["setpoint_mohm"],
                cell(r["device_pv_mohm"], "{:.0f}"),
                cell(r["device_pv_error_mohm"], "{:.6f}"),
                cell(r["device_pv_rel_pct"], "{:.6f}"),
                cell(r["device_pv_rel_ppm"], "{:.3f}"),
                "{:.9g}".format(r["measured_ohm"]), "{:.6f}".format(r["measured_mohm"]),
                "{:.9g}".format(r["abs_error_ohm"]), "{:.6f}".format(r["abs_error_mohm"]),
                "{:.6f}".format(r["rel_error_pct"]), "{:.3f}".format(r["rel_error_ppm"]),
                "{:.6f}".format(r["stdev_mohm"]), "{:.3f}".format(r["stderr_ppm"]),
                r["samples"], "{:.0f}".format(r["range_ohm"]), "{:.2f}".format(r["elapsed_s"]),
            ])
    return path


def output_name(sn, stamp):
    safe = "".join(c for c in str(sn) if c.isalnum() or c in "-_") or "unknown"
    return "error_{}_{}.csv".format(stamp, safe)


# --------------------------------------------------------------------------- #
# Main
# --------------------------------------------------------------------------- #
def print_header(args, info, points, sample_note=""):
    print("PPR26 accuracy test (setpoint vs measured)")
    print("  device    : {}  SN {}  FW {}  HW {}".format(
        info.get("model", "?"), info.get("sn", "?"),
        info.get("firmware", "?"), info.get("hardware", "?")))
    print("  dev temp  : {:.1f} C".format(info.get("temperature_c", float("nan"))))
    print("  range     : {} .. {}".format(fmt_ohm(points[0]), fmt_ohm(points[-1])))
    print("  points    : {}{}".format(len(points), sample_note))
    print("  per point : settle {:.1f} s, {} readings averaged, NPLC {}, {}-wire"
          .format(args.settle, args.averages, args.nplc, args.mode[0]))
    print()
    print("{:>7} {:>7} {:>15} {:>15} {:>13} {:>12} {:>10} {:>9}".format(
        "point", "done", "set", "measured", "abs err", "rel err", "stdev", "eta"))
    print("-" * 100)


def sweep(dev, dmm, points, args):
    """Drive every setpoint and collect one row per point."""
    rows = []
    total = len(points)
    t_start = time.monotonic()
    for index, target_ohm in enumerate(points, 1):
        sp_mohm = to_mohm(target_ohm)
        if not RES_MIN_MOHM <= sp_mohm <= RES_MAX_MOHM:
            print("  {:>5}/{}  SKIP {} (out of range)".format(index, total, fmt_ohm(target_ohm)))
            continue

        t_point = time.monotonic()
        dev.set_resistance(sp_mohm)
        requested_ohm = sp_mohm / 1000.0

        # Select the range before the settle wait: the settling readings also give
        # the DMM's auto-zero loop time to converge.
        rng = best_range(requested_ohm)
        dmm.configure(mode=args.mode, nplc=args.nplc, range_ohm=rng)
        dmm.settle(args.settle, mode=args.mode)
        try:
            measured, stdev, samples, actual_range = dmm.measure(
                args.averages, mode=args.mode, range_ohm=rng,
                nplc=args.nplc, settle_s=args.settle)
        except Exception as exc:
            print("  {:>5}/{}  measurement failed at {}: {}".format(
                index, total, fmt_ohm(requested_ohm), exc))
            continue

        abs_err = measured - requested_ohm
        rel_pct = abs_err / requested_ohm * 100.0

        # The device's own estimate (AT+RES.PV?); the difference from the measured
        # value is exactly the part the calibration table cannot see.
        try:
            pv = dev.resistance_pv()
            if pv == float("inf"):
                pv = None
        except Exception:
            pv = None
        pv_err = None if pv is None else pv - sp_mohm

        elapsed = time.monotonic() - t_point
        rows.append({
            "index": index,
            "setpoint_ohm": requested_ohm, "setpoint_mohm": sp_mohm,
            "device_pv_mohm": pv,
            "device_pv_error_mohm": pv_err,
            "device_pv_rel_pct": None if pv_err is None else pv_err / float(sp_mohm) * 100.0,
            "device_pv_rel_ppm": None if pv_err is None else pv_err / float(sp_mohm) * 1.0e6,
            "measured_ohm": measured, "measured_mohm": measured * 1000.0,
            "abs_error_ohm": abs_err, "abs_error_mohm": abs_err * 1000.0,
            "rel_error_pct": rel_pct, "rel_error_ppm": rel_pct * 1.0e4,
            "stdev_mohm": stdev * 1000.0,
            "stderr_ppm": stdev / math.sqrt(samples) / requested_ohm * 1.0e6,
            "samples": samples, "range_ohm": actual_range, "elapsed_s": elapsed,
        })

        eta = (time.monotonic() - t_start) / index * (total - index)
        print("  {:>5}/{}  {:>15} {:>15.6f} {:>+13.4f} {:>+11.4f}% {:>10.4f} {:>9}".format(
            index, total, fmt_ohm(requested_ohm), measured, abs_err * 1000.0, rel_pct,
            stdev * 1000.0, fmt_duration(eta)))
    return rows


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="PPR26 accuracy test: sweep setpoints and measure the actual "
                    "resistance with a DMM, logging the error.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter)
    parser.add_argument("-p", "--port", default=None,
                        help="PPR26 serial port (auto-detected by VID 0xFFFE when omitted)")
    parser.add_argument("--dmm", default=None,
                        help="DMM VISA resource string (auto-detected when omitted)")
    parser.add_argument("--start", type=float, default=10.0, help="first setpoint (ohm)")
    parser.add_argument("--stop", type=float, default=4.0e6, help="last setpoint (ohm)")
    parser.add_argument("--per-decade", type=float, default=50.0, help="points per decade")
    parser.add_argument("--settle", type=float, default=3.0,
                        help="relay settling wait per point (s)")
    parser.add_argument("--averages", type=int, default=8, help="readings per point")
    parser.add_argument("--nplc", type=float, default=10.0,
                        help="DMM integration time (power-line cycles)")
    parser.add_argument("--mode", choices=("4w", "2w"), default="4w", help="4-wire / 2-wire")
    parser.add_argument("--out", default=None,
                        help="CSV output path (default error_<timestamp>_<SN>.csv)")
    parser.add_argument("--dry-run", action="store_true",
                        help="print the setpoint list without touching any hardware")
    args = parser.parse_args(argv)

    raw = log_points(args.start, args.stop, args.per_decade)
    points = round_points(raw)
    merged = len(raw) - len(points)

    if args.dry_run:
        print("setpoints (log-uniform, rounded to 1 ohm): {} points, {} .. {}".format(
            len(points), fmt_ohm(points[0]), fmt_ohm(points[-1])))
        if merged:
            print("NOTE: {} points collapsed onto a neighbour after rounding".format(merged))
        for i, value in enumerate(points, 1):
            print("  {:>4}  {}".format(i, fmt_ohm(value)))
        return 0

    note = "({:g} per decade, rounded to 1 ohm{})".format(
        args.per_decade, ", {} merged".format(merged) if merged else "")
    stamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")

    dev = dmm = None
    info, rows = {}, []
    result = "complete"
    try:
        dev = PPR26(args.port)
        info = dev.info()
        dmm = Dmm(args.dmm)
        print_header(args, info, points, sample_note=note)
        try:
            rows = sweep(dev, dmm, points, args)
        except KeyboardInterrupt:
            result = "cancelled"
            print("\ninterrupted: saving the {} points measured so far".format(len(rows)))
    except KeyboardInterrupt:
        result = "cancelled"
    except Exception as exc:
        print("ERROR: {}".format(exc))
        return 1
    finally:
        if dmm is not None:
            dmm.close()
        if dev is not None:
            dev.close()

    meta = {
        "Averages": args.averages,
        "DMM": getattr(dmm, "model", ""),
        "DMM SN": getattr(dmm, "sn", ""),
        "Device": info.get("model", ""),
        "Device SN": info.get("sn", ""),
        "Device temp C": "{:.1f}".format(info.get("temperature_c", float("nan"))),
        "Firmware": info.get("firmware", ""),
        "Hardware": info.get("hardware", ""),
        "Mode": args.mode,
        "NPLC": float(args.nplc),
        "Per decade": float(args.per_decade),
        "Points": len(rows),
        "Result": result,
        "Settle s": float(args.settle),
        "Start ohm": float(args.start),
        "Stop ohm": float(args.stop),
        "Timestamp": datetime.datetime.now().isoformat(timespec="seconds"),
    }
    path = args.out or output_name(meta["Device SN"] or "unknown", stamp)
    write_csv(path, rows, meta, notes=[
        "abs_error = measured - setpoint (requested AT+RES.SP value)",
        "rel_error_pct = abs_error / setpoint * 100",
        "device_pv_mohm is AT+RES.PV?, the device's own estimate (not the DMM)",
    ])

    if rows:
        worst = max(rows, key=lambda r: abs(r["rel_error_pct"]))
        print()
        print("result: {} points, worst {:.4f}% at {}".format(
            len(rows), worst["rel_error_pct"], fmt_ohm(worst["setpoint_ohm"])))
    print("CSV: {}".format(path))
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

## Arguments

| Argument | Default | Description |
| ---- | ---- | ---- |
| `-p, --port` | auto | PPR26 serial port (auto-detected by VID `0xFFFE`) |
| `--dmm` | auto | DMM VISA resource string (auto-detects an Agilent/Keysight USB instrument) |
| `--start` / `--stop` | 10 / 4e6 | Sweep range (Ω) |
| `--per-decade` | 50 | Points per factor of ten |
| `--settle` | 3.0 | Relay settling wait per point (s) |
| `--averages` | 8 | Readings per point (averaged) |
| `--nplc` | 10 | DMM integration time (power-line cycles): slower but more accurate |
| `--mode` | `4w` | `4w` four-wire / `2w` two-wire |
| `--out` | — | CSV output path (default `error_<timestamp>_<SN>.csv`) |
| `--dry-run` | — | Print the setpoint list only, no hardware |

Common combinations:

```bash
python ppr26_accuracy_test.py --dry-run                     # check the setpoints first (no hardware)
python ppr26_accuracy_test.py --per-decade 8 --settle 2 --averages 5   # quick sweep (46 points, ~3 min)
python ppr26_accuracy_test.py                               # full run (276 points, ~25 min)
```

## CSV output

The file starts with `# key,value` metadata (device model/SN, firmware, reference meter, mode, per-point
settings, timestamp), followed by the data table:

| Column | Meaning |
| ---- | ---- |
| `setpoint_ohm` / `setpoint_mohm` | Setpoint (the integer mΩ actually written to the device) |
| `device_pv_mohm` | `AT+RES.PV?`, the **device's own estimate** (not the DMM reading) |
| `device_pv_error_mohm` | `device_pv − setpoint`: how much error the device thinks it made |
| `measured_ohm` / `measured_mohm` | DMM measurement, averaged |
| `abs_error_ohm` / `abs_error_mohm` | Absolute error = measured − setpoint |
| `rel_error_pct` / `rel_error_ppm` | **Relative error = absolute error / setpoint × 100** |
| `stdev_mohm` / `stderr_ppm` | Standard deviation of the readings / relative standard error of the mean |
| `samples` / `range_ohm` / `elapsed_s` | Readings taken / DMM range / time spent on the point |

## Reading the result

Plot the CSV as setpoint (log X) against relative error (Y) and overlay the acceptance limit; a glance then
shows whether the unit passes. The limit is **a curve**: `±(0.05% × setpoint + 1 Ω)` converts to the Y-axis
percentage as `0.05 + 0.1 × 1000/x` — at 10 Ω the absolute term is worth 10%, at 1 kΩ only 0.1%, and above
that the percentage term dominates and the curve flattens to ±0.05%. **The low end is judged on absolute
accuracy, the high end on relative accuracy** — one curve says both.

The example data in this documentation (see the factory report example in
[Specifications](../../datasheet/index.md)) can be re-plotted directly:

```python
import csv
import matplotlib.pyplot as plt

rows = [r for r in csv.reader(open("error_xxx.csv", encoding="utf-8"))
        if r and r[0] and r[0][0].isdigit()]
cols = ["index", "setpoint_ohm", "setpoint_mohm", "device_pv_mohm",
        "device_pv_error_mohm", "device_pv_rel_pct", "device_pv_rel_ppm",
        "measured_ohm", "measured_mohm", "abs_error_ohm", "abs_error_mohm",
        "rel_error_pct", "rel_error_ppm", "stdev_mohm", "stderr_ppm",
        "samples", "range_ohm", "elapsed_s"]
data = [dict(zip(cols, r)) for r in rows]
x = [float(r["setpoint_ohm"]) for r in data]
y = [float(r["rel_error_pct"]) for r in data]

fig, ax = plt.subplots(figsize=(11, 6))
ax.set_xscale("log")
ax.set_yscale("symlog", linthresh=0.001)      # the error crosses zero, so a signed log axis
ax.set_ylim(-10, 10)                          # fixed ±10% window, comparable across units
ax.axhline(0, color="k", lw=0.8)
ax.plot(x, y, "o-", ms=3, lw=1, label="measured")
for sign in (1, -1):                          # acceptance limit: ±(0.05% x setpoint + 1 ohm)
    ax.plot(x, [sign * (0.05 + 1000.0 / v) for v in x], "r--", lw=1,
            label="tolerance ±(0.05% + 1 Ω)" if sign > 0 else None)
ax.set_xlabel("Setpoint (ohm, log scale)")
ax.set_ylabel("Relative error (%)")
ax.legend()
plt.show()
```

What to look at:

- **Are the measured points inside the red tolerance curve?** Inside means it passes; the tooling labels
  any point that falls outside.
- **Large errors at the low end are quantisation steps, not a fault**: the device builds its output as a
  subset sum of 26 resistors, so the smallest increment is about 1 Ω — at 10 Ω the worst case can be
  ±0.5 Ω, which looks large as a percentage (a few %) while staying inside the ±1 Ω absolute limit.
  `AT+RES.PV?` reports the value it actually reached, so the device "knows it is off" there.
- **The gap between the device PV and the measurement**: PV is computed from the calibration table, so the
  difference is the part the table cannot see (relay contact resistance, thermal drift) — and therefore
  the part that recalibration can fix.
- **Re-measuring the same unit later will drift**: contact resistance relaxes with time (mΩ-level changes
  are visible within minutes), which is why periodic recalibration is required — see
  [Specifications](../../datasheet/index.md).

!!! tip "Quick health check"
    To confirm the device works without producing a full accuracy report, use the
    [self-test script](test.md); to judge whether it meets the factory accuracy specification, use the
    accuracy test on this page.
