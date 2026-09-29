# 用户校准脚本

PPR26 支持用户自行校准，用于修正输出阻值的偏差。本页给出可直接使用的 Python 校准脚本（**AT 与 SCPI 两种模式**），并说明校准流程与注意事项。

!!! warning "注意"
    校准不当会降低输出精度与可靠性，请在具备参考标准（如高精度数字万用表）的情况下进行。本文脚本仅操作用户校准数据。

## 校准原理

设备按**档位**分别保存校准阻值，上位机逐档测量实际输出，并把实测阻值写入对应档位：

| 档位      | 含义                       |
| --------- | -------------------------- |
| `0`..`25` | 单路电阻（闭合对应继电器） |
| `26`      | 串联短路                   |
| `27`      | 直接短路                   |

## 使用前提

- **参考仪表**：分辨率与精度应优于目标精度一个数量级。
- 设备充分预热，环境温度稳定。
- 关闭其它占用设备的程序。
- 依赖：
  - AT 模式（USB CDC）：`pip install pyserial`
  - SCPI 模式（USB TMC）：安装 NI‑VISA 驱动，`pip install pyvisa`

## 校准流程

两种模式的命令对照：

| 步骤 | AT 命令 | SCPI 命令 |
| ---- | ------- | --------- |
| 1. 进入校准模式 | `AT+CALI.ENAB=1` | `CAL:ENAB 1` |
| 2. 解锁 | `AT+CALI.UNL=<password>` | `CAL:USER:UNL "<password>"` |
| 3. 逐档写入 | `AT+CALI.GEAR=n` → `AT+CALI.VAL=<实测 mΩ>` | `CAL:USER:GEAR n` → `CAL:USER:VAL <实测 mΩ>` |
| 4. 日期 / 备注 | `AT+CALI.DATE=...` / `AT+CALI.STR=...` | `CAL:USER:DATE "..."` / `CAL:USER:STR "..."` |
| 5. 保存 | `AT+CALI.SAVE` | `CAL:USER:SAVE` |
| 6. 退出 | `AT+CALI.ENAB=0` | `CAL:ENAB 0` |

!!! note "写保护"
    `VAL` / `DATE` / `STR` / `SAVE` 需在**已使能**（`ENAB=1`）且**未锁定**时才能写入；否则返回错误。未设密码时解锁命令可用空密码。

## 校准脚本

将下方脚本分别保存为 `ppr26_calibrate.py`（AT）或 `ppr26_calibrate_scpi.py`（SCPI）。`MEASURED` 为逐档实测结果（`{档位: 实测阻值(mΩ)}`），未列出的档位不会被写入。

=== "AT（USB CDC）"

    ```python
    #!/usr/bin/env python3
    """PPR26 用户校准脚本（AT 模式）。

    用法：
        python ppr26_calibrate.py                    # 使用脚本内 MEASURED 表
        python ppr26_calibrate.py -p COM12           # 指定串口
        python ppr26_calibrate.py --password 1234    # 指定用户密码（未设为空）
        python ppr26_calibrate.py --export out.csv   # 导出各档位当前值
    """

    import argparse
    import csv
    import datetime
    import sys
    import time

    import serial
    from serial.tools import list_ports

    # {档位: 实测阻值(mΩ)}：由参考仪表逐档测量得到
    MEASURED = {
        # 0: 100,
        # 1: 200,
        # 27: 8,
    }

    GEAR_NUM = 28


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


    def calibrate(dev, measured, password):
        """把逐档实测阻值写入用户校准数据并保存。"""
        dev.cmd("AT+CALI.ENAB=1")
        dev.cmd("AT+CALI.UNL=" + password)
        for gear, mohm in sorted(measured.items()):
            dev.cmd(f"AT+CALI.GEAR={gear}")
            dev.cmd(f"AT+CALI.VAL={int(mohm)}")
        dev.cmd("AT+CALI.DATE=" + datetime.date.today().isoformat())
        dev.cmd("AT+CALI.STR=user-cal")
        dev.cmd("AT+CALI.SAVE")
        dev.cmd("AT+CALI.ENAB=0")
        print("已写入 {} 个档位，校准次数 = {}".format(
            len(measured), dev.query("AT+CALI.COUNT?", "CALI.COUNT")))


    def export(dev, path):
        """导出各档位当前校准值到 CSV。"""
        rows = []
        for gear in range(GEAR_NUM):
            dev.cmd(f"AT+CALI.GEAR={gear}")
            rows.append((gear, int(dev.query("AT+CALI.VAL?", "CALI.VAL"))))
        with open(path, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.writer(f)
            writer.writerow(["gear", "resistance_mohm"])
            writer.writerows(rows)
        print(f"已导出到 {path}")


    def main():
        parser = argparse.ArgumentParser(description="PPR26 用户校准脚本（AT）")
        parser.add_argument("-p", "--port", help="串口，如 COM12（省略则自动探测）")
        parser.add_argument("--password", default="", help="用户校准密码（默认为空）")
        parser.add_argument("--export", metavar="CSV", help="导出各档位当前值到 CSV 后退出")
        args = parser.parse_args()

        dev = PPR26(args.port or find_ppr26())
        try:
            dev.cmd("AT")
            if args.export:
                export(dev, args.export)
                return 0
            if not MEASURED:
                print("请先在脚本中填写 MEASURED（{档位: 实测阻值 mΩ}）")
                return 1
            calibrate(dev, MEASURED, args.password)
            return 0
        finally:
            dev.close()


    if __name__ == "__main__":
        sys.exit(main())
    ```

=== "SCPI（USB TMC）"

    ```python
    #!/usr/bin/env python3
    """PPR26 用户校准脚本（SCPI / USB TMC 模式）。

    用法：
        python ppr26_calibrate_scpi.py
        python ppr26_calibrate_scpi.py -r "USB0::0xFFFE::0xFFFF::<SN>::0::INSTR"
        python ppr26_calibrate_scpi.py --password 1234
        python ppr26_calibrate_scpi.py --export out.csv
    """

    import argparse
    import csv
    import datetime
    import sys

    import pyvisa

    rm = pyvisa.ResourceManager("@ivi")

    # {档位: 实测阻值(mΩ)}：由参考仪表逐档测量得到
    MEASURED = {
        # 0: 100,
        # 1: 200,
        # 27: 8,
    }

    GEAR_NUM = 28


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


    def calibrate(dev, measured, password):
        """把逐档实测阻值写入用户校准数据并保存。"""
        dev.write_checked("CAL:ENAB 1")
        dev.write_checked('CAL:USER:UNL "{}"'.format(password))
        for gear, mohm in sorted(measured.items()):
            dev.write_checked(f"CAL:USER:GEAR {gear}")
            dev.write_checked(f"CAL:USER:VAL {int(mohm)}")
        dev.write_checked('CAL:USER:DATE "{}"'.format(datetime.date.today().isoformat()))
        dev.write_checked('CAL:USER:STR "user-cal"')
        dev.write_checked("CAL:USER:SAVE")
        dev.write_checked("CAL:ENAB 0")
        print("已写入 {} 个档位，校准次数 = {}".format(
            len(measured), dev.query("CAL:USER:COUN?")))


    def export(dev, path):
        """导出各档位当前校准值到 CSV。"""
        rows = []
        for gear in range(GEAR_NUM):
            dev.write_checked(f"CAL:USER:GEAR {gear}")
            rows.append((gear, int(dev.query("CAL:USER:VAL?"))))
        with open(path, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.writer(f)
            writer.writerow(["gear", "resistance_mohm"])
            writer.writerows(rows)
        print(f"已导出到 {path}")


    def main():
        parser = argparse.ArgumentParser(description="PPR26 用户校准脚本（SCPI）")
        parser.add_argument("-r", "--resource", help="VISA 资源（省略则自动探测）")
        parser.add_argument("--password", default="", help="用户校准密码（默认为空）")
        parser.add_argument("--export", metavar="CSV", help="导出各档位当前值到 CSV 后退出")
        args = parser.parse_args()

        dev = PPR26(args.resource or find_ppr26())
        try:
            print("识别:", dev.query("*IDN?"))
            if args.export:
                export(dev, args.export)
                return 0
            if not MEASURED:
                print("请先在脚本中填写 MEASURED（{档位: 实测阻值 mΩ}）")
                return 1
            calibrate(dev, MEASURED, args.password)
            return 0
        finally:
            dev.close()


    if __name__ == "__main__":
        sys.exit(main())
    ```

## 说明

- 未在 `MEASURED` 中列出的档位保持原值不变。
- 保存后校准次数加 1，并记录当时的温度（AT：`AT+CALI.TEMP?`；SCPI：`CAL:USER:TEMP?`）。
- 写入后建议复测关键档位，确认输出与目标一致。
- 命令细节见 [AT 命令参考](../at.md) 与 [SCPI 命令参考](../scpi.md)。
