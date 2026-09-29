# 功能自检脚本

用于在部署或维护后快速验证设备功能是否正常。本页给出 **AT 与 SCPI 两种模式**的 Python 自检脚本，按顺序检查设备信息、阻值设置、限值、输出状态、温度与用户校准读取，并输出 `PASS` / `FAIL` 汇总。

!!! tip "适用场景"
    新设备上手、升级固件后、或出现异常时的快速排查。

## 自检项

| 检查项 | 说明 |
| ------ | ---- |
| 连接与识别 | 应答、型号、序列号格式、固件版本 |
| 阻值设置 | 设置阻值并回读一致 |
| 补偿模式 | 设置并回读 |
| 限值 | 设置 MIN/MAX 并使能；越界设置应被拒绝且值不变 |
| 输出状态 | 开路、短路、恢复正常 |
| 温度 | 读取当前温度 |
| 用户校准 | 读取校准次数与日期（只读，不修改） |

## 自检脚本

将下方脚本分别保存为 `ppr26_selftest.py`（AT）或 `ppr26_selftest_scpi.py`（SCPI）。脚本只做只读检查与可恢复的设置，不会修改用户校准数据。

=== "AT（USB CDC）"

    ```python
    #!/usr/bin/env python3
    """PPR26 功能自检脚本（AT 模式）。

    用法：
        python ppr26_selftest.py
        python ppr26_selftest.py -p COM12
    退出码：0 全部通过；1 存在失败项。
    """

    import argparse
    import sys
    import time

    import serial
    from serial.tools import list_ports

    SN_CHARS = set("0123456789ABCDEF")


    def find_ppr26():
        for p in list_ports.comports():
            if p.vid == 0xFFFE:
                return p.device
        raise RuntimeError("未找到 PPR26，请确认设备处于 AT 模式")


    class PPR26:
        def __init__(self, port, timeout=1.0):
            self.ser = serial.Serial(port, 115200, timeout=timeout)
            self.timeout = timeout

        def close(self):
            self.ser.close()

        def _read_line(self, deadline):
            while time.monotonic() < deadline:
                line = self.ser.readline().decode("ascii", "replace").strip()
                if line:
                    return line
            raise TimeoutError("等待响应超时")

        def cmd(self, text):
            self.ser.reset_input_buffer()
            self.ser.write((text + "\r\n").encode("ascii"))
            deadline = time.monotonic() + self.timeout
            while True:
                line = self._read_line(deadline)
                if line == "OK":
                    return True
                if line == "ERROR":
                    raise IOError(f"{text} -> ERROR")

        def query(self, text, name):
            self.ser.reset_input_buffer()
            self.ser.write((text + "\r\n").encode("ascii"))
            prefix = "+" + name + "="
            deadline = time.monotonic() + self.timeout
            while True:
                line = self._read_line(deadline)
                if line == "ERROR":
                    raise IOError(f"{text} -> ERROR")
                if line.startswith(prefix):
                    return line[len(prefix):]


    class Checker:
        def __init__(self):
            self.passed = 0
            self.failed = 0

        def check(self, name, cond, detail=""):
            if cond:
                self.passed += 1
                print(f"  [PASS] {name:<28} {detail}")
            else:
                self.failed += 1
                print(f"  [FAIL] {name:<28} {detail}")


    def run(dev, ck):
        dev.cmd("AT")
        ck.check("连接 (AT)", True)

        sn = dev.query("AT+DEV.SN?", "DEV.SN")
        ck.check("序列号 24 位 hex", len(sn) == 24 and set(sn) <= SN_CHARS, sn)
        ck.check("型号 == PPR26", dev.query("AT+DEV.MODEL?", "DEV.MODEL") == "PPR26")
        ck.check("固件版本非空", bool(dev.query("AT+DEV.FWVER?", "DEV.FWVER")))

        dev.cmd("AT+RES.LIMIT=0")
        dev.cmd("AT+RES.SP=523000")
        ck.check("阻值设置/回读", dev.query("AT+RES.SP?", "RES.SP") == "523000")

        dev.cmd("AT+RES.COMP=2")
        ck.check("补偿模式 == 2", dev.query("AT+RES.COMP?", "RES.COMP") == "2")

        dev.cmd("AT+RES.MAX=1000000")
        dev.cmd("AT+RES.MIN=5000")
        dev.cmd("AT+RES.LIMIT=1")
        dev.cmd("AT+RES.SP=100000")
        rejected = False
        try:
            dev.cmd("AT+RES.SP=2000000")
        except IOError:
            rejected = True
        ck.check("越界设置被拒绝", rejected)
        ck.check("越界后值不变", dev.query("AT+RES.SP?", "RES.SP") == "100000")
        dev.cmd("AT+RES.LIMIT=0")

        dev.cmd("AT+RES.OPEN=1")
        ck.check("开路 -> PV=inf", dev.query("AT+RES.PV?", "RES.PV") == "inf")
        dev.cmd("AT+RES.OPEN=0")
        dev.cmd("AT+RES.SHORT=1")
        ck.check("短路状态", dev.query("AT+RES.SHORT?", "RES.SHORT") == "1")
        dev.cmd("AT+RES.SHORT=0")

        temp = dev.query("AT+DEV.TEMP?", "DEV.TEMP")
        ck.check("温度可读", temp.lstrip("-").isdigit(), f"{temp} (0.1℃)")

        ck.check("校准次数可读", dev.query("AT+CALI.COUNT?", "CALI.COUNT").isdigit())
        ck.check("校准日期可读", dev.query("AT+CALI.DATE?", "CALI.DATE") is not None)


    def main():
        parser = argparse.ArgumentParser(description="PPR26 功能自检脚本（AT）")
        parser.add_argument("-p", "--port", help="串口，如 COM12（省略则自动探测）")
        args = parser.parse_args()

        dev = PPR26(args.port or find_ppr26())
        ck = Checker()
        try:
            run(dev, ck)
        finally:
            dev.close()

        print(f"结果：{ck.passed} 通过，{ck.failed} 失败")
        return 1 if ck.failed else 0


    if __name__ == "__main__":
        sys.exit(main())
    ```

=== "SCPI（USB TMC）"

    ```python
    #!/usr/bin/env python3
    """PPR26 功能自检脚本（SCPI / USB TMC 模式）。

    用法：
        python ppr26_selftest_scpi.py
        python ppr26_selftest_scpi.py -r "USB0::0xFFFE::0xFFFF::<SN>::0::INSTR"
    退出码：0 全部通过；1 存在失败项。
    """

    import argparse
    import sys

    import pyvisa

    rm = pyvisa.ResourceManager("@ivi")
    SN_CHARS = set("0123456789ABCDEF")


    def find_ppr26():
        for r in rm.list_resources():
            up = r.upper()
            if "0XFFFE" in up and "0XFFFF" in up:
                return r
        raise RuntimeError("未找到 PPR26，请确认设备处于 SCPI/TMC 模式")


    class PPR26:
        def __init__(self, resource, timeout_ms=2000):
            self.inst = rm.open_resource(resource)
            self.inst.timeout = timeout_ms
            self.inst.write_termination = "\n"
            self.inst.read_termination = "\n"

        def close(self):
            self.inst.close()

        def write(self, cmd):
            self.inst.write(cmd)

        def query(self, cmd):
            return self.inst.query(cmd).strip().strip('"')

        def error(self):
            return self.inst.query("SYST:ERR?").strip()

        def write_checked(self, cmd):
            self.inst.write(cmd)
            err = self.error()
            if not err.startswith("0,"):
                raise IOError(f"{cmd} -> {err}")


    class Checker:
        def __init__(self):
            self.passed = 0
            self.failed = 0

        def check(self, name, cond, detail=""):
            if cond:
                self.passed += 1
                print(f"  [PASS] {name:<28} {detail}")
            else:
                self.failed += 1
                print(f"  [FAIL] {name:<28} {detail}")


    def is_num(text):
        try:
            float(text)
            return True
        except ValueError:
            return False


    def run(dev, ck):
        ck.check("连接 (*IDN?)", "PPR26" in dev.query("*IDN?"))

        sn = dev.query("SYST:INFO:SN?")
        ck.check("序列号 24 位 hex", len(sn) == 24 and set(sn) <= SN_CHARS, sn)
        ck.check("型号 == PPR26", dev.query("SYST:INFO:MOD?") == "PPR26")
        ck.check("固件版本非空", bool(dev.query("SYST:INFO:FVER?")))

        dev.write_checked("RES:LIM:STAT 0")
        dev.write_checked("RES 523000")
        ck.check("阻值设置/回读", dev.query("RES?") == "523000")

        dev.write_checked("SYST:COMP PREC")
        ck.check("补偿模式 == PRECISE", dev.query("SYST:COMP?") == "PRECISE")

        dev.write_checked("RES:LIM:MAX 1000000")
        dev.write_checked("RES:LIM:MIN 5000")
        dev.write_checked("RES:LIM:STAT 1")
        dev.write_checked("RES 100000")
        dev.write("RES 2000000")
        err = dev.error()
        ck.check("越界设置被拒绝", not err.startswith("0,"), err)
        ck.check("越界后值不变", dev.query("RES?") == "100000")
        dev.write_checked("RES:LIM:STAT 0")

        dev.write_checked("OUTP OPEN")
        ck.check("开路状态", dev.query("OUTP?") == "OPEN")
        dev.write_checked("OUTP SHOR")
        ck.check("短路状态", dev.query("OUTP?") == "SHOR")
        dev.write_checked("OUTP NORM")

        temp = dev.query("SYST:TEMP?")
        ck.check("温度可读", is_num(temp), temp)

        ck.check("校准次数可读", dev.query("CAL:USER:COUN?").isdigit())
        ck.check("校准日期可读", dev.query("CAL:USER:DATE?") is not None)


    def main():
        parser = argparse.ArgumentParser(description="PPR26 功能自检脚本（SCPI）")
        parser.add_argument("-r", "--resource", help="VISA 资源（省略则自动探测）")
        args = parser.parse_args()

        dev = PPR26(args.resource or find_ppr26())
        ck = Checker()
        try:
            print("识别:", dev.query("*IDN?"))
            run(dev, ck)
        finally:
            dev.close()

        print(f"结果：{ck.passed} 通过，{ck.failed} 失败")
        return 1 if ck.failed else 0


    if __name__ == "__main__":
        sys.exit(main())
    ```

## 输出示例

```text
  [PASS] 连接 (AT)
  [PASS] 序列号 24 位 hex             87043057485172710671FF49
  [PASS] 型号 == PPR26
  [PASS] 固件版本非空                 FW 1.0.0
  [PASS] 阻值设置/回读                523000
  [PASS] 补偿模式 == 2
  [PASS] 越界设置被拒绝
  [PASS] 越界后值不变                 100000
  [PASS] 开路 -> PV=inf
  [PASS] 短路状态
  [PASS] 温度可读                     29.1 (0.1℃)
  [PASS] 校准次数可读
  [PASS] 校准日期可读
结果：13 通过，0 失败
```

## 命令对照

| 检查项 | AT | SCPI |
| ------ | -- | ---- |
| 型号 | `AT+DEV.MODEL?` | `SYST:INFO:MOD?` |
| 序列号 | `AT+DEV.SN?` | `SYST:INFO:SN?` |
| 固件版本 | `AT+DEV.FWVER?` | `SYST:INFO:FVER?` |
| 设定阻值 | `AT+RES.SP=…` / `AT+RES.SP?` | `RES …` / `RES?` |
| 补偿模式 | `AT+RES.COMP` | `SYST:COMP` |
| 限值 | `AT+RES.MIN/MAX/LIMIT` | `RES:LIM:MIN/MAX/STAT` |
| 开路 / 短路 | `AT+RES.OPEN/SHORT` | `OUTP OPEN` / `OUTP SHOR` |
| 温度 | `AT+DEV.TEMP?` | `SYST:TEMP?` |
| 校准次数 / 日期 | `AT+CALI.COUNT?` / `AT+CALI.DATE?` | `CAL:USER:COUN?` / `CAL:USER:DATE?` |

更多命令见 [AT 命令参考](../at.md) 与 [SCPI 命令参考](../scpi.md)；两种协议的 Python 通信封装见 [AT Python 编程示例](../python_at.md) 与 [SCPI Python 编程示例](../python_scpi.md)。
