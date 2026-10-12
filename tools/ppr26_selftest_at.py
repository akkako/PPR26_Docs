#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""PPR26 功能自检脚本（AT 模式）。

用法::

    python ppr26_selftest_at.py            # 按 VID 0xFFFE 自动查找串口
    python ppr26_selftest_at.py -p COM12   # 指定串口

退出码：``0`` 全部通过；``1`` 存在失败项。

检查项：连接与识别、阻值设置、补偿模式、限值（含越界拒绝）、输出状态、温度、
用户校准（只读）。限值、限值使能与补偿模式属于**会被保存**的设置，脚本会先记录
原值并在结束时写回；设定阻值与输出状态为运行态，不写入存储。
"""

import argparse
import sys

from ppr26_at import PPR26_AT, PPR26Error

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


def run(dev, ck):
    print("[设备信息]")
    model = dev.get_model()
    ck.check("连接与识别", bool(model), model)
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
    dev.set_compensation(2)
    comp = dev.get_compensation()
    ck.check("设置并回读 == 2", comp == 2, str(comp))

    print("[限值]")
    dev.set_min_limit(100000)
    dev.set_max_limit(200000)
    dev.set_limit_enable(1)
    ck.check("限值使能", dev.get_limit_enable() == 1)
    ck.check("MIN/MAX 回读", dev.get_min_limit() == 100000 and dev.get_max_limit() == 200000,
             "100000 .. 200000 mΩ")
    before = dev.get_resistance()
    rejected = False
    try:
        dev.set_resistance(5000)          # 量程内，但超出限值
    except PPR26Error:
        rejected = True
    ck.check("越界设置被拒绝", rejected and dev.get_resistance() == before,
             "值保持 {}".format(dev.get_resistance()))
    dev.set_resistance(150000)
    ck.check("限值内设置成功", dev.get_resistance() == 150000, "150000 mΩ")
    dev.set_limit_enable(0)

    print("[输出状态]")
    dev.set_open(True)
    ck.check("开路", dev.get_open() == 1)
    dev.set_open(False)
    dev.set_short(True)
    ck.check("短路", dev.get_short() == 1)
    dev.exit_open_short()
    ck.check("恢复正常", dev.get_open() == 0 and dev.get_short() == 0)

    print("[温度]")
    temp = dev.get_temperature()
    ck.check("温度可读", -400 <= temp <= 1500, "{} (0.1℃)".format(temp))

    print("[用户校准（只读）]")
    ck.check("校准次数可读", dev.get_cali_count() >= 0, str(dev.get_cali_count()))
    selected = dev.get_cali_selected()
    ck.check("校准数据集可读", selected in (0, 1), "0=USER 1=FACTORY" if selected == 1 else "0=USER")
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


def main():
    if hasattr(sys.stdout, "reconfigure"):   # 控制台编码不支持时避免抛异常
        sys.stdout.reconfigure(errors="replace")

    parser = argparse.ArgumentParser(description="PPR26 功能自检（AT 模式）")
    parser.add_argument("-p", "--port", default=None,
                        help="串口名（默认按 VID 0xFFFE 自动查找）")
    parser.add_argument("-t", "--timeout", type=float, default=1.0,
                        help="单条命令超时秒数（默认 1.0）")
    args = parser.parse_args()

    ck = Checker()
    try:
        with PPR26_AT(args.port, timeout=args.timeout) as dev:
            print("端口 {}（型号 {}）".format(dev.comport, dev.get_model()))
            run(dev, ck)
    except PPR26Error as exc:
        print("ERROR: {}".format(exc))
        return 1

    print("\n结果：{} 通过，{} 失败".format(ck.passed, ck.failed))
    return 1 if ck.failed else 0


if __name__ == "__main__":
    sys.exit(main())
