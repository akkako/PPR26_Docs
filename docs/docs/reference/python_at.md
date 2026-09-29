# AT Python 编程示例

使用 AT 指令与 PPR26 通信，需要先配置 PPR26 工作在 **USB-CDC 模式**，此时 PC 端枚举为 USB CDC 虚拟串口设备。

!!! tip "提示信息"
    使用 USB CDC 连接 PC，操作系统通常内置驱动，不需要手动安装驱动。

本文使用 `pyserial` 库进行 USB CDC 通信。完整的 AT 指令表见 [AT 命令参考](at.md)。

## 环境准备

```bash
pip install pyserial
```

- 串口参数：`115200`、`8` 数据位、无校验、`1` 停止位。
- 每条命令以 `\r\n` 结束；设备以 `OK` / `ERROR` 结束应答。

## 连接设备

设备在 USB CDC 模式下的 VID:PID 为 `0xFFFE:0xFFFE`，可据此自动查找串口：

```python
from serial.tools import list_ports

def find_ppr26():
    for p in list_ports.comports():
        if p.vid == 0xFFFE:
            return p.device
    raise RuntimeError("未找到 PPR26，请确认设备处于 AT 模式")
```

## 基础收发封装

下面的类封装了“发送命令 / 发送查询”两个基本操作，后文示例均基于它：

```python
import time
import serial

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
        """发送设置/执行命令，成功返回 True，失败抛异常。"""
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
        """发送查询命令，返回 +<name>=<value> 中的 value。"""
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
```

## 常用操作

### 连接测试与设备信息

```python
dev = PPR26(find_ppr26())

dev.cmd("AT")                                  # 连接测试
print("型号  :", dev.query("AT+DEV.MODEL?", "DEV.MODEL"))
print("序列号:", dev.query("AT+DEV.SN?", "DEV.SN"))
print("固件  :", dev.query("AT+DEV.FWVER?", "DEV.FWVER"))
print("硬件  :", dev.query("AT+DEV.HWVER?", "DEV.HWVER"))
print("生产日:", dev.query("AT+DEV.PROD?", "DEV.PROD"))
print("上电数:", dev.query("AT+DEV.POWERON?", "DEV.POWERON"))
print("通电(分):", dev.query("AT+DEV.UPTIME?", "DEV.UPTIME"))
```

### 温度测量

温度单位为 **0.1 ℃**（`291` 表示 29.1 ℃）。

```python
temp = int(dev.query("AT+DEV.TEMP?", "DEV.TEMP")) / 10.0
print(f"当前温度: {temp:.1f} ℃")

cur, tmin, tavg, tmax, count = dev.query("AT+DEV.TSTAT?", "DEV.TSTAT").split(",")
print(f"统计: 当前={int(cur)/10:.1f} 最低={int(tmin)/10:.1f} "
      f"平均={int(tavg)/10:.1f} 最高={int(tmax)/10:.1f} 次数={count}")

dev.cmd("AT+DEV.TCLR")                          # 清空统计
```

### 设置输出阻值

阻值单位为 **毫欧（mΩ）**，范围 **5 Ω ~ 4 MΩ**。

```python
dev.cmd("AT+RES.SP=523000")                     # 523 Ω
print("设定值(mΩ):", dev.query("AT+RES.SP?", "RES.SP"))
print("估测值(mΩ):", dev.query("AT+RES.PV?", "RES.PV"))
```

### 输出状态（开路 / 短路 / 恢复正常）

```python
dev.cmd("AT+RES.OPEN=1")                        # 开路（PV 返回 inf）
dev.cmd("AT+RES.SHORT=1")                       # 直接短路
dev.cmd("AT+RES.SHORT=0")
dev.cmd("AT+RES.OPEN=0")                        # 恢复正常（回到设定阻值）
```

### 步进值与补偿模式

> AT 模式下没有 UP/DOWN 命令，步进值用于上位机本地计算。

```python
dev.cmd("AT+RES.STEP=10000")                    # 步进 10 Ω
step = int(dev.query("AT+RES.STEP?", "RES.STEP"))
sp = int(dev.query("AT+RES.SP?", "RES.SP"))
dev.cmd(f"AT+RES.SP={sp + step}")               # 手动 +1 步

dev.cmd("AT+RES.COMP=2")                        # 0=不补偿 1=附近值 2=多档位最佳
```

### 限制值（最小 / 最大阻值、限值使能）

```python
dev.cmd("AT+RES.MIN=5000")                      # 5 Ω
dev.cmd("AT+RES.MAX=1000000")                   # 1 kΩ
dev.cmd("AT+RES.LIMIT=1")                       # 使能限值：设定值须落在 [MIN, MAX]

# 超出限值会返回 ERROR，且不改变当前值
try:
    dev.cmd("AT+RES.SP=2000000")
except IOError as e:
    print("设置被拒绝:", e)
```

### 用户密码

密码最长 64 字节；设置密码后用户校准数据默认锁定，需解锁后才能写入。

```python
dev.cmd("AT+CALI.PASS=1234")                    # 设置密码（空字符串=清除并解锁）
print("是否已设密码:", dev.query("AT+CALI.PASS?", "CALI.PASS"))   # 0/1
```

### 用户校准

用户校准流程：**进入校准模式 → （解锁）→ 逐档写入实测阻值 → 填写日期/备注 → 保存 → 退出校准模式**。

写入（`VAL`/`DATE`/`STR`/`SAVE`）需满足：`AT+CALI.ENAB=1` 且用户数据集未锁定。

```python
CALI_GEAR_NUM = 28   # 0..25 单路电阻，26 串联短路，27 直接短路

dev.cmd("AT+CALI.ENAB=1")                       # 进入校准模式
dev.cmd("AT+CALI.UNL=1234")                     # 解锁（未设密码时用 AT+CALI.UNL=）

# measurements：{档位: 实测阻值(mΩ)}，由参考仪表逐档测量得到
measurements = {0: 100, 1: 200, 26: 50, 27: 8}
for gear, mohm in measurements.items():
    dev.cmd(f"AT+CALI.GEAR={gear}")             # 选择档位（同时切换继电器）
    dev.cmd(f"AT+CALI.VAL={mohm}")              # 写入该档位实测值

dev.cmd("AT+CALI.DATE=2026-09-29")
dev.cmd("AT+CALI.STR=user-cal")

print("校准次数(保存前):", dev.query("AT+CALI.COUNT?", "CALI.COUNT"))
dev.cmd("AT+CALI.SAVE")                         # 保存：次数 +1、记录温度、落盘
print("校准次数(保存后):", dev.query("AT+CALI.COUNT?", "CALI.COUNT"))
print("校准时温度:", dev.query("AT+CALI.TEMP?", "CALI.TEMP"), "℃")

dev.cmd("AT+CALI.ENAB=0")                       # 退出校准模式
```

!!! warning "注意"
    校准不当会降低输出精度与可靠性，请使用参考标准逐档测量后再写入。

## 完整示例脚本

```python
import time
import serial
from serial.tools import list_ports


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


def main():
    dev = PPR26(find_ppr26())
    try:
        # 设备信息
        dev.cmd("AT")
        print("型号  :", dev.query("AT+DEV.MODEL?", "DEV.MODEL"))
        print("序列号:", dev.query("AT+DEV.SN?", "DEV.SN"))
        print("温度  :", int(dev.query("AT+DEV.TEMP?", "DEV.TEMP")) / 10.0, "℃")

        # 阻值限制
        dev.cmd("AT+RES.MIN=5000")
        dev.cmd("AT+RES.MAX=1000000")
        dev.cmd("AT+RES.LIMIT=1")

        # 输出
        dev.cmd("AT+RES.COMP=2")
        dev.cmd("AT+RES.SP=523000")
        print("设定(mΩ):", dev.query("AT+RES.SP?", "RES.SP"))
        print("估测(mΩ):", dev.query("AT+RES.PV?", "RES.PV"))

        dev.cmd("AT+RES.OPEN=1")
        dev.cmd("AT+RES.OPEN=0")

        # 用户校准
        dev.cmd("AT+CALI.ENAB=1")
        dev.cmd("AT+CALI.UNL=1234")
        for gear, mohm in {0: 100, 1: 200, 27: 8}.items():
            dev.cmd(f"AT+CALI.GEAR={gear}")
            dev.cmd(f"AT+CALI.VAL={mohm}")
        dev.cmd("AT+CALI.DATE=2026-09-29")
        dev.cmd("AT+CALI.SAVE")
        dev.cmd("AT+CALI.ENAB=0")
    finally:
        dev.close()


if __name__ == "__main__":
    main()
```

## 注意事项

- 阻值相关命令的单位一律为 mΩ；越界返回 `ERROR` 且不改变当前值。
- 写入校准数据前须 `AT+CALI.ENAB=1` 且用户数据集未锁定。
- `AT+SYS.PROT=1` 会切换到 SCPI 模式并重新枚举 USB，之后需改用 PyVISA 通信。
- 单条命令不超过 256 字节；参数最长 64 字节。
