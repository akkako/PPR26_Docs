#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""PPR26 功能自检脚本（SCPI 模式 / USB TMC）。

用法::

    python ppr26_selftest_scpi.py                                   # 自动查找资源
    python ppr26_selftest_scpi.py -r "USB0::0xFFFE::0xFFFF::<SN>::0::INSTR"
    python ppr26_selftest_scpi.py -b @py                            # 使用 pyvisa-py

退出码：``0`` 全部通过；``1`` 存在失败项。

检查项：连接与识别、阻值设置、补偿模式、限值（含越界拒绝）、输出状态、温度、
用户校准（只读）。限值、限值使能与补偿模式属于**会被保存**的设置，脚本会先记录
原值并在结束时写回；设定阻值与输出状态为运行态，不写入存储。
"""

import argparse
import sys

from ppr26_scpi import PPR26_SCPI, PPR26CommandError, PPR26Error

SN_CHARS = set("0123456789ABCDEF")


class Checker:
    def __init__(self):
        self.passed = 0
        self.failed = 0

    def check(self, name, cond, detail=""):
        if cond:
            self.passed += 1
            print("  [PASS] {:<28} {}".format(name, detail))
        else:
            self.failed += 1
            print("  [FAIL] {:<28} {}".format(name, detail))
        return bool(cond)


def drain_errors(dev):
    """清空错误队列，返回被丢弃的错误条数。"""
    dropped = 0
    while dev.error_count():
        dev.error()
        dropped += 1
    return dropped


def run(dev, ck):
    print("[设备信息]")
    idn = dev.get_idn()
    ck.check("连接与识别", bool(idn), idn)
    model = dev.get_model()
    ck.check("型号 == PPR26", model == "PPR26", model)
    sn = dev.get_serial_number()
    ck.check("序列号 24 位 hex", len(sn) == 24 and set(sn) <= SN_CHARS, sn)
    fw = dev.get_firmware_version()
    ck.check("固件版本非空", bool(fw), fw)

    # 记录会被保存的设置，自检结束后写回
    original = {
        "compensation": dev.get_compensation(),
        "min_limit": dev.get_min_limit(),
        "max_limit": dev.get_max_limit(),
        "limit_enable": dev.get_limit_enable(),
    }

    print("[阻值设置]")
    dev.set_resistance(523000)
    ck.check("设定/回读一致", dev.get_resistance() == 523000, "523000 mΩ")

    print("[补偿模式]")
    dev.set_compensation("PREC")
    comp = dev.get_compensation()
    ck.check("设置并回读 == PRECISE", comp == "PRECISE", comp)

    print("[限值]")
    dev.set_min_limit(100000)
    dev.set_max_limit(200000)
    dev.set_limit_enable(1)
    ck.check("限值使能", dev.get_limit_enable() == 1)
    ck.check("MIN/MAX 回读", dev.get_min_limit() == 100000 and dev.get_max_limit() == 200000,
             "100000 .. 200000 mΩ")
    before = dev.get_resistance()
    code = None
    try:
        dev.set_resistance(5000)          # 量程内，但超出限值
    except PPR26CommandError as exc:
        code = exc.code
    ck.check("越界设置被拒绝", code is not None and dev.get_resistance() == before,
             "错误码 {}，值保持 {}".format(code, dev.get_resistance()))
    dev.set_resistance(150000)
    ck.check("限值内设置成功", dev.get_resistance() == 150000, "150000 mΩ")
    dev.set_limit_enable(0)

    print("[输出状态]")
    dev.set_output("OPEN")
    ck.check("开路", dev.get_output() == "OPEN", dev.get_output())
    dev.set_output("SHOR")
    ck.check("短路", dev.get_output() == "SHOR", dev.get_output())
    dev.set_output("NORM")
    ck.check("恢复正常", dev.get_output() == "NORM", dev.get_output())

    print("[温度]")
    temp = dev.get_temperature()
    ck.check("温度可读", -40.0 <= temp <= 150.0, "{} ℃".format(temp))

    print("[用户校准（只读）]")
    ck.check("校准次数可读", dev.get_cali_count() >= 0, str(dev.get_cali_count()))
    selected = dev.get_cali_selected()
    ck.check("校准数据集可读", selected in ("USER", "FACTORY"), selected)
    ck.check("校准日期可读", bool(dev.get_cali_date()), dev.get_cali_date())

    # 写回原设置
    print("[恢复原设置]")
    try:
        dev.set_compensation(original["compensation"])
        dev.set_min_limit(original["min_limit"])
        dev.set_max_limit(original["max_limit"])
        dev.set_limit_enable(original["limit_enable"])
    except PPR26Error as exc:
        ck.check("设置已恢复", False, "写回失败：{}".format(exc))
        print("      请手动写回：comp={} limit={} MIN={} MAX={}".format(
            original["compensation"], original["limit_enable"],
            original["min_limit"], original["max_limit"]))
        return
    restored = (dev.get_compensation() == original["compensation"]
                and dev.get_min_limit() == original["min_limit"]
                and dev.get_max_limit() == original["max_limit"]
                and dev.get_limit_enable() == original["limit_enable"])
    ck.check("设置已恢复", restored,
             "comp={} limit={} MIN={} MAX={}".format(
                 dev.get_compensation(), dev.get_limit_enable(),
                 dev.get_min_limit(), dev.get_max_limit()))

    left = drain_errors(dev)
    ck.check("错误队列已清空", left == 0, "残留 {} 条".format(left))


def main():
    if hasattr(sys.stdout, "reconfigure"):   # 控制台编码不支持时避免抛异常
        sys.stdout.reconfigure(errors="replace")

    parser = argparse.ArgumentParser(description="PPR26 功能自检（SCPI 模式）")
    parser.add_argument("-r", "--resource", default=None,
                        help="VISA 资源名（默认按 VID:PID 0xFFFE:0xFFFF 自动查找）")
    parser.add_argument("-b", "--backend", default="@ivi",
                        help="VISA 后端：@ivi = NI-VISA（默认）；@py = pyvisa-py")
    parser.add_argument("-t", "--timeout", type=float, default=2.0,
                        help="单条命令超时秒数（默认 2.0）")
    args = parser.parse_args()

    ck = Checker()
    try:
        with PPR26_SCPI(args.resource, timeout=args.timeout, backend=args.backend) as dev:
            print("资源 {}（型号 {}）".format(dev.resource, dev.get_model()))
            drain_errors(dev)
            run(dev, ck)
    except PPR26Error as exc:
        print("ERROR: {}".format(exc))
        return 1

    print("\n结果：{} 通过，{} 失败".format(ck.passed, ck.failed))
    return 1 if ck.failed else 0


if __name__ == "__main__":
    sys.exit(main())
