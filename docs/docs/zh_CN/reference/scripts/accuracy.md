# 精度测试脚本

本页说明如何测量 PPR26 的**设定值误差**（设定值 vs 实测值），用于出厂检验、到货验收与年度复检。
测试全程**只读**设备，不会改动标定数据。

## 测试条件

| 项目 | 要求 |
| ---- | ---- |
| 设备 | PPR26，工作在 **AT 模式**（USB CDC 虚拟串口） |
| 参考表 | 6½ 位以上数字表，如 HP / Agilent 34401A / 34410A / 34411A |
| 接线 | 四线：数字表 4W 端接 PPR26 前面板的 Sense / Output 端子（不区分极性） |
| 判定标准 | 出厂指标 **±(0.1% × 设定值 + 1 Ω)**，见[设备规格](../../datasheet/index.md) |

!!! warning "参考表决定了测量结果的上限"
    要验证 ±(0.1% + 1 Ω) 这样的指标，参考表自身的准确度应明显优于被测容限（一般取 1/3 以下）。
    34410A 在四线电阻模式下的 1 年准确度为 0.0035%（读值）+ 0.0009%（量程）量级，余量充足。

## 测试方法

1. **对数均匀取点**：默认从 10 Ω 到 4 MΩ、每十倍 50 点，两端点各取一次。
   取点后**四舍五入到整数欧姆** —— 设备自己声明的设定步进是 1 Ω（`AT+RES.STEP` = 1000 mΩ），
   下发带小数的阻值等于要求设备表示一个它没有的值，那部分取整误差会混进测量结果里，
   与电阻网络的真实误差分不开。
2. **逐点测量**：下发设定值 → 数字表切到能容纳该值的最小量程 → 等待继电器稳定 → 多次读数取平均。
   等待稳定用「丢弃读数」而不是 `sleep`：单纯 sleep 会让数字表进入空闲，
   之后第一次读数会明显变差。
3. **记录误差**：绝对误差（mΩ / Ω）与相对误差（% / ppm）逐点打印并写入 CSV，
   同时记录设备自身的估测值（`AT+RES.PV?`）便于对照。

`Ctrl+C` 会中断扫描，但仍会把已测得的点写入 CSV（`# Result,cancelled`）。

## 测试脚本

下面的脚本是**独立版本**：只用 `pyserial`（设备）与 `pyvisa`（数字表），不依赖其它封装库，
可直接复制使用。输出 CSV 的列名与工程工具链一致，可直接用于绘图。

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""PPR26 精度测试：设定值 vs 实测值（10 Ω ~ 4 MΩ）。

扫描对数均匀分布的设定点，逐点用数字表测量实际输出阻值，计算绝对/相对误差并写入 CSV。
测试全程只读设备（不改标定数据），CSV 可直接交给绘图脚本画精度分布图。

用法：
    python ppr26_accuracy_test.py --dry-run                 # 只看取点，不连设备
    python ppr26_accuracy_test.py -p COM12 --dmm "USB0::0x0957::0x0607::MY53009844::0::INSTR"
    python ppr26_accuracy_test.py --per-decade 50 --settle 3 --averages 8

依赖：pyserial（PPR26）、pyvisa + VISA 后端（数字表）。
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

RES_MIN_MOHM = 5000                          # 5 Ω
RES_MAX_MOHM = 4000000000                    # 4 MΩ
#: 设定点取整步长。设备自己声明的设定步进是 AT+RES.STEP = 1000 mΩ，
#: 下发带小数的阻值等于要求设备表示一个它没有的值，取整误差会混进测量结果。
ROUND_QUANTUM_OHM = 1.0
#: 数字表的电阻量程（34401A/34410A 系列）：取能容纳设定值的最小量程。
DMM_RANGES_OHM = [100, 1000, 10000, 100000, 1000000, 10000000, 100000000]
DMM_OVERFLOW = 9.0e36                        # 34401A/34410A 溢出读数


class TestError(RuntimeError):
    """设备、数字表或参数错误。"""


# --------------------------------------------------------------------------- #
# 取点
# --------------------------------------------------------------------------- #
def log_points(start_ohm, stop_ohm, per_decade):
    """对数均匀取点，包含两端点：相邻点之比为 10**(1/per_decade)。"""
    if start_ohm <= 0 or stop_ohm <= 0:
        raise TestError("起止值必须为正")
    if stop_ohm <= start_ohm:
        raise TestError("终止值必须大于起始值")
    if per_decade <= 0:
        raise TestError("per-decade 必须为正")
    steps = max(1, int(round(math.log10(stop_ohm / start_ohm) * per_decade)))
    ratio = stop_ohm / start_ohm
    return [start_ohm * ratio ** (i / float(steps)) for i in range(steps + 1)]


def round_points(points, quantum_ohm=ROUND_QUANTUM_OHM):
    """四舍五入到整数欧姆并去掉重复值。

    对数取点在低阻端会密于 1 Ω（10 Ω 起每十倍 50 点时，前几步间距不到 1 Ω），
    取整后会有若干点撞在一起，这里丢弃重复值，调用方打印被合并的点数。
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
    """能容纳该设定值的最小数字表量程。"""
    for rng in DMM_RANGES_OHM:
        if ohm <= rng:
            return rng
    return DMM_RANGES_OHM[-1]


# --------------------------------------------------------------------------- #
# PPR26（AT 模式）
# --------------------------------------------------------------------------- #
class PPR26:
    """只用本测试需要的几条 AT 指令，不依赖其它封装库。"""

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
            raise TestError("未找到 PPR26（没有 VID 0xFFFE 的串口），"
                            "请确认设备处于 AT 模式并用 -p 指定串口")
        raise TestError("发现多个候选串口：{}，请用 -p 指定".format(", ".join(hits)))

    def close(self):
        self.ser.close()

    def _command(self, line, expect_reply=True):
        self.ser.reset_input_buffer()
        self.ser.write((line + "\n").encode("ascii"))
        if not expect_reply:
            return ""
        reply = self.ser.readline().decode("ascii", "replace").strip()
        if not reply:
            raise TestError("{} 无应答（超时）".format(line))
        if reply in ("ERROR", "OVERFLOW"):
            raise TestError("{} -> {}".format(line, reply))
        return reply

    def _query_value(self, line):
        return self._command(line).split("=", 1)[1]

    def set_resistance(self, mohm):
        if not RES_MIN_MOHM <= int(mohm) <= RES_MAX_MOHM:
            raise TestError("设定值 {} mΩ 越界".format(mohm))
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
# 数字表（VISA）
# --------------------------------------------------------------------------- #
class Dmm:
    """HP/Agilent 34401A / 34410A / 34411A 的电阻测量（4 线或 2 线）。"""

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
        """自动查找数字表：优先 Agilent/Keysight（VISA 资源串里带 0x0957）。"""
        usb = [r for r in self.rm.list_resources() if "USB" in r.upper()]
        hits = [r for r in usb if "0x0957" in r.lower()]
        if len(hits) == 1:
            return hits[0]
        if not hits and len(usb) == 1:
            return usb[0]
        if not hits and not usb:
            raise TestError("未找到数字表，请用 --dmm 指定 VISA 资源串")
        raise TestError("发现多个候选仪器：{}，请用 --dmm 指定".format(
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
        """用「丢弃读数」等待继电器稳定。

        单纯 sleep 会让数字表进入空闲，之后第一次读数会明显变差；
        持续读数还能让自动调零环保持收敛。
        """
        deadline = time.monotonic() + max(0.0, seconds)
        while True:
            self.read_ohm()
            if time.monotonic() >= deadline:
                return

    def measure(self, count, mode="4w", range_ohm=None, nplc=10.0, settle_s=0.0):
        """取 count 次读数求平均，返回 (均值, 标准差, 实际量程)。"""
        func = "FRES" if mode == "4w" else "RES"
        count = max(1, int(count))
        readings = []
        bumped = False
        while len(readings) < count:
            value = self.read_ohm()
            if value >= DMM_OVERFLOW:
                if bumped:
                    raise TestError("数字表溢出（量程 {:.0f} Ω）".format(range_ohm or 0))
                # 超出所选量程：升一档，重新稳定后从头测这个点。
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
# CSV（列名与绘图脚本兼容）
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
# 主流程
# --------------------------------------------------------------------------- #
def print_header(args, info, points, sample_note=""):
    print("PPR26 精度测试（设定值 vs 实测值）")
    print("  设备      : {}  SN {}  FW {}  HW {}".format(
        info.get("model", "?"), info.get("sn", "?"),
        info.get("firmware", "?"), info.get("hardware", "?")))
    print("  设备温度  : {:.1f} C".format(info.get("temperature_c", float("nan"))))
    print("  扫描范围  : {} .. {}".format(fmt_ohm(points[0]), fmt_ohm(points[-1])))
    print("  测试点数  : {}{}".format(len(points), sample_note))
    print("  每点参数  : 稳定 {:.1f} s，{} 次读数平均，NPLC {}，{} 线"
          .format(args.settle, args.averages, args.nplc, args.mode[0]))
    print()
    print("{:>7} {:>7} {:>15} {:>15} {:>13} {:>12} {:>10} {:>9}".format(
        "点", "进度", "设定", "实测", "绝对误差", "相对误差", "标准差", "剩余"))
    print("-" * 100)


def sweep(dev, dmm, points, args):
    """逐点设置阻值并测量，返回每个点的一行记录。"""
    rows = []
    total = len(points)
    t_start = time.monotonic()
    for index, target_ohm in enumerate(points, 1):
        sp_mohm = to_mohm(target_ohm)
        if not RES_MIN_MOHM <= sp_mohm <= RES_MAX_MOHM:
            print("  {:>5}/{}  跳过 {}（超出量程）".format(index, total, fmt_ohm(target_ohm)))
            continue

        t_point = time.monotonic()
        dev.set_resistance(sp_mohm)
        requested_ohm = sp_mohm / 1000.0

        # 先切量程再等稳定：稳定期间的读数也顺便让自动调零收敛。
        rng = best_range(requested_ohm)
        dmm.configure(mode=args.mode, nplc=args.nplc, range_ohm=rng)
        dmm.settle(args.settle, mode=args.mode)
        try:
            measured, stdev, samples, actual_range = dmm.measure(
                args.averages, mode=args.mode, range_ohm=rng,
                nplc=args.nplc, settle_s=args.settle)
        except Exception as exc:
            print("  {:>5}/{}  测量失败 {}：{}".format(
                index, total, fmt_ohm(requested_ohm), exc))
            continue

        abs_err = measured - requested_ohm
        rel_pct = abs_err / requested_ohm * 100.0

        # 设备自己的估测值（AT+RES.PV?）：与实测的差值就是标定表看不见的那部分。
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
        description="PPR26 精度测试：扫描设定值，用数字表测出实际阻值并记录误差。",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter)
    parser.add_argument("-p", "--port", default=None,
                        help="PPR26 串口（省略则按 VID 0xFFFE 自动查找）")
    parser.add_argument("--dmm", default=None, help="数字表 VISA 资源串（省略则自动查找）")
    parser.add_argument("--start", type=float, default=10.0, help="起始设定值（Ω）")
    parser.add_argument("--stop", type=float, default=4.0e6, help="终止设定值（Ω）")
    parser.add_argument("--per-decade", type=float, default=50.0, help="每十倍取点数")
    parser.add_argument("--settle", type=float, default=3.0, help="每点继电器稳定等待（s）")
    parser.add_argument("--averages", type=int, default=8, help="每点读数次数")
    parser.add_argument("--nplc", type=float, default=10.0, help="数字表积分时间（工频周期数）")
    parser.add_argument("--mode", choices=("4w", "2w"), default="4w", help="四线 / 两线测量")
    parser.add_argument("--out", default=None,
                        help="CSV 输出路径（省略则为 error_<时间戳>_<SN>.csv）")
    parser.add_argument("--dry-run", action="store_true", help="只打印取点，不连接设备")
    args = parser.parse_args(argv)

    raw = log_points(args.start, args.stop, args.per_decade)
    points = round_points(raw)
    merged = len(raw) - len(points)

    if args.dry_run:
        print("取点（对数均匀，取整到 1 Ω）：{} 点，{} .. {}".format(
            len(points), fmt_ohm(points[0]), fmt_ohm(points[-1])))
        if merged:
            print("NOTE: 取整后 {} 个点与相邻点重合被合并".format(merged))
        for i, value in enumerate(points, 1):
            print("  {:>4}  {}".format(i, fmt_ohm(value)))
        return 0

    note = "（每十倍 {:g} 点，取整到 1 Ω{}）".format(
        args.per_decade, "，合并 {} 点".format(merged) if merged else "")
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
            print("\n已中断：仅保存已测得的 {} 个点".format(len(rows)))
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
        print("结果：{} 点，最差 {:.4f}% @ {}".format(
            len(rows), worst["rel_error_pct"], fmt_ohm(worst["setpoint_ohm"])))
    print("CSV：{}".format(path))
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

## 参数

| 参数 | 默认 | 说明 |
| ---- | ---- | ---- |
| `-p, --port` | 自动 | PPR26 串口（按 VID `0xFFFE` 自动查找） |
| `--dmm` | 自动 | 数字表 VISA 资源串（省略时自动查找 Agilent/Keysight USB 仪器） |
| `--start` / `--stop` | 10 / 4e6 | 扫描范围（Ω） |
| `--per-decade` | 50 | 每 10 倍取多少个点 |
| `--settle` | 3.0 | 每点继电器稳定等待（s） |
| `--averages` | 8 | 每点读数次数（求平均） |
| `--nplc` | 10 | 数字表积分时间（工频周期数），越大越准也越慢 |
| `--mode` | `4w` | `4w` 四线 / `2w` 两线 |
| `--out` | — | CSV 输出路径（默认 `error_<时间戳>_<SN>.csv`） |
| `--dry-run` | — | 只打印取点列表，不连接设备 |

常用组合：

```bash
python ppr26_accuracy_test.py --dry-run                     # 先看取点（不连设备）
python ppr26_accuracy_test.py --per-decade 8 --settle 2 --averages 5   # 快速摸底（46 点，约 3 分钟）
python ppr26_accuracy_test.py                               # 完整测试（276 点，约 25 分钟）
```

## 输出 CSV

文件开头是 `# 键,值` 元数据（设备型号/SN、固件、参考表、模式、每点参数、时间戳等），随后是数据表：

| 列 | 含义 |
| ---- | ---- |
| `setpoint_ohm` / `setpoint_mohm` | 设定值（实际下发的整数 mΩ） |
| `device_pv_mohm` | `AT+RES.PV?`，**设备自己的估测值**（不是数字表读数） |
| `device_pv_error_mohm` | `device_pv − setpoint`，设备以为自己做了多少误差 |
| `measured_ohm` / `measured_mohm` | 数字表实测平均值 |
| `abs_error_ohm` / `abs_error_mohm` | 绝对误差 = 实测 − 设定 |
| `rel_error_pct` / `rel_error_ppm` | **相对误差 = 绝对误差 / 设定值 × 100** |
| `stdev_mohm` / `stderr_ppm` | 该点多次采样的标准差 / 平均值自身的相对标准误 |
| `samples` / `range_ohm` / `elapsed_s` | 采样次数 / 数字表量程 / 该点耗时 |

## 结果判读

把 CSV 画成「横轴设定值（对数）、纵轴相对误差」的分布图，并在同一张图上叠加判定容限曲线
即可一眼看出是否合格。容限是**一条曲线**：`±(0.1% × 设定值 + 1 Ω)` 换算成纵轴的百分比就是
`0.1 + 100/x` —— 10 Ω 处绝对项折合 10%（合计 10.1%），1 kΩ 处绝对项 0.1%（合计 0.2%），
再往上百分比项主导，曲线压平到 ±0.1%。**低阻端看绝对精度、高阻端看相对精度**，一条曲线把两件事说清。

用本文档示例数据（见[设备规格](../../datasheet/index.md)中的出厂报告示例）可以直接复现这张图：

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
ax.set_yscale("symlog", linthresh=0.001)      # 数据跨零，必须用带符号对数轴
ax.set_ylim(-10, 10)                          # 固定 ±10% 窗口，便于不同设备之间比较
ax.axhline(0, color="k", lw=0.8)
ax.plot(x, y, "o", ms=4, label="measured")
for sign in (1, -1):                          # 判定容限：±(0.1% x 设定值 + 1 Ω)
    ax.plot(x, [sign * (0.1 + 100.0 / v) for v in x], "r--", lw=1,
            label="tolerance ±(0.1% + 1 Ω)" if sign > 0 else None)
ax.set_xlabel("Setpoint (ohm, log scale)")
ax.set_ylabel("Relative error (%)")
ax.legend()
plt.show()
```

判读要点：

- **蓝色实测点是否落在红色容限曲线以内**：落在以内即合格；超出的点会被标注出来。
- **低阻段的大误差是量化台阶，不是故障**：设备内部用 26 只电阻的子集和去凑目标值，
  最小增量约 1 Ω，10 Ω 处最坏可能差 ±0.5 Ω —— 相对误差看起来很大（百分之几），
  但绝对误差仍在 ±1 Ω 的容限内。`AT+RES.PV?` 会如实报告它实际凑到的值，
  所以这一段「设备知道自己不准」。
- **设备 PV 与实测的差值**：PV 由标定表算出，两者之差是标定表看不见的部分
  （继电器触点串联电阻、温漂），也就是重新校准能修的部分。
- **同一台设备隔一段时间复测会有漂移**：触点电阻会随时间弛豫（分钟量级即可见 mΩ 级变化），
  这也是需要定期重新校准的原因，见[设备规格](../../datasheet/index.md)。

!!! tip "快速自检"
    只想确认设备工作正常、不需要完整精度报告时，用[功能自检脚本](test.md)即可；
    需要判断是否满足出厂精度指标时，用本页的精度测试脚本。
