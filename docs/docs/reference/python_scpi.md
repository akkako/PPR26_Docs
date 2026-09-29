# SCPI Python 编程示例

使用 SCPI 与 PPR26 通信，需要先配置 PPR26 工作在 **USB-TMC 模式**，此时 PC 端枚举为 USB TMC 设备。

!!! warning "注意事项"
    USB TMC 设备需要安装对应驱动，否则在 USB 枚举时会报错没有驱动程序。

    本文推荐使用 **NI-VISA**，后续示例均使用 NI-VISA 后端编写。

本文使用 `pyvisa` 库进行 USB TMC 通信。完整的 SCPI 指令表见 [SCPI 命令参考](scpi.md)。

## 环境准备

1. 安装 **NI-VISA** 驱动（NI 官网下载）。
2. 安装 `pyvisa`：

   ```bash
   pip install pyvisa
   ```

- 传输为 USBTMC，命令以换行 `<LF>`（`\n`）结束。
- 设备在 USB TMC 模式下的 VID:PID 为 `0xFFFE:0xFFFF`，资源形如
  `USB0::0xFFFE::0xFFFF::<序列号>::0::INSTR`。

## 连接设备

```python
import pyvisa

rm = pyvisa.ResourceManager("@ivi")     # 指定使用 NI-VISA 后端

def find_ppr26():
    for r in rm.list_resources():
        up = r.upper()
        if "0XFFFE" in up and "0XFFFF" in up:
            return r
    raise RuntimeError("未找到 PPR26，请确认设备处于 SCPI/TMC 模式")
```

## 基础收发封装

下面的类封装了“发送命令 / 发送查询 / 读取错误队列”，后文示例均基于它：

```python
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
        """读取错误队列队首，无错误时返回 '0,"No error"'。"""
        return self.inst.query("SYST:ERR?").strip()

    def write_checked(self, cmd):
        """发送命令并在出错时抛出异常。"""
        self.inst.write(cmd)
        err = self.error()
        if not err.startswith("0,"):
            raise IOError(f"{cmd} -> {err}")
```

## 常用操作

### 识别与设备信息

```python
dev = PPR26(find_ppr26())

print("识别:", dev.query("*IDN?"))            # akaInstruments,PPR26,<SN>,<FW>
print("型号  :", dev.query("SYST:INFO:MOD?"))
print("序列号:", dev.query("SYST:INFO:SN?"))
print("固件  :", dev.query("SYST:INFO:FVER?"))
print("硬件  :", dev.query("SYST:INFO:HVER?"))
print("生产日:", dev.query("SYST:INFO:MAN?"))
print("上电数:", dev.query("SYST:INFO:POW?"))
print("通电(分):", dev.query("SYST:INFO:TIME?"))
```

### 温度测量

温度单位为 ℃（0.1 ℃ 分辨率）。

```python
print("当前温度:", dev.query("SYST:TEMP?"), "℃")
print("平均温度:", dev.query("SYST:TEMP:AVER?"), "℃")
print("最低温度:", dev.query("SYST:TEMP:MIN?"), "℃")
print("最高温度:", dev.query("SYST:TEMP:MAX?"), "℃")
dev.write("SYST:TEMP:RES")                     # 清空统计
```

### 设置输出阻值

阻值单位为 **毫欧（mΩ）**，范围 **5 Ω ~ 4 MΩ**。命令关键字大小写不敏感。

```python
dev.write_checked("RES 523000")                # 523 Ω
print("设定(mΩ):", dev.query("RES?"))

dev.write_checked("RES:STEP 10000")            # 步进 10 Ω
dev.write_checked("RES UP")                    # 当前值 + 步进
dev.write_checked("RES DOWN")                  # 当前值 - 步进
print("设定(mΩ):", dev.query("RES?"))
```

### 输出状态（正常 / 开路 / 短路）

```python
dev.write_checked("OUTP NORM")                 # 电阻网络输出
dev.write_checked("OUTP OPEN")                 # 开路
dev.write_checked("OUTP SHOR")                 # 直接短路
print("输出状态:", dev.query("OUTP?"))         # NORM / OPEN / SHOR
```

### 限制值（最小 / 最大阻值、限值使能）

```python
dev.write_checked("RES:LIM:MAX 1000000")       # 1 kΩ
dev.write_checked("RES:LIM:MIN 5000")          # 5 Ω
dev.write_checked("RES:LIM:STAT 1")            # 使能限值

# 超出限值会报错并进入错误队列，且不改变当前值
dev.inst.write("RES 2000000")
print("错误:", dev.error())                    # 例如 -902,"Resistance value out of limit range"
```

### 补偿模式与继电器网络

```python
dev.write_checked("SYST:COMP PREC")            # UNCAL / LIN / PREC
print("补偿模式:", dev.query("SYST:COMP?"))    # UNCAL / LINEAR / PRECISE

dev.write_checked("RES:NETW 0")                # 26 位继电器位图 0..67108863
print("继电器网络:", dev.query("RES:NETW?"))
```

### 用户密码

密码最长 64 字节；设置密码后用户校准数据默认锁定，需解锁后才能写入。

```python
dev.write_checked('CAL:USER:PASS "1234"')      # 设置密码（空字符串=清除并解锁）
print("是否已设密码:", dev.query("CAL:USER:PASS?"))   # 0 / 1
dev.write_checked('CAL:USER:UNL "1234"')       # 解锁
```

### 用户校准

用户校准流程：**进入校准模式 → （解锁）→ 逐档写入实测阻值 → 填写日期/备注 → 保存 → 退出校准模式**。

写入（`VAL`/`DATE`/`STR`/`SAVE`）需满足：`CAL:ENAB 1` 且用户数据集未锁定。

```python
dev.write_checked("CAL:ENAB 1")                # 进入校准模式
dev.write_checked('CAL:USER:UNL "1234"')       # 解锁（未设密码时用 CAL:USER:UNL ""）

# measurements：{档位: 实测阻值(mΩ)}，由参考仪表逐档测量得到
measurements = {0: 100, 1: 200, 26: 50, 27: 8}
for gear, mohm in measurements.items():
    dev.write_checked(f"CAL:USER:GEAR {gear}")  # 选择档位（同时切换继电器）
    dev.write_checked(f"CAL:USER:VAL {mohm}")   # 写入该档位实测值

dev.write_checked('CAL:USER:DATE "2026-09-29"')
dev.write_checked('CAL:USER:STR "user-cal"')

print("校准次数(保存前):", dev.query("CAL:USER:COUN?"))
dev.write_checked("CAL:USER:SAVE")              # 保存：次数 +1、记录温度、落盘
print("校准次数(保存后):", dev.query("CAL:USER:COUN?"))
print("校准时温度:", dev.query("CAL:USER:TEMP?"), "℃")

dev.write_checked("CAL:ENAB 0")                 # 退出校准模式
```

!!! warning "注意"
    校准不当会降低输出精度与可靠性，请使用参考标准逐档测量后再写入。

## 完整示例脚本

```python
import pyvisa

rm = pyvisa.ResourceManager("@ivi")


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


def main():
    dev = PPR26(find_ppr26())
    try:
        print("识别  :", dev.query("*IDN?"))
        print("温度  :", dev.query("SYST:TEMP?"), "℃")

        # 阻值限制
        dev.write_checked("RES:LIM:MAX 1000000")
        dev.write_checked("RES:LIM:MIN 5000")
        dev.write_checked("RES:LIM:STAT 1")

        # 输出
        dev.write_checked("SYST:COMP PREC")
        dev.write_checked("OUTP NORM")
        dev.write_checked("RES 523000")
        print("设定(mΩ):", dev.query("RES?"))

        dev.write_checked("OUTP OPEN")
        dev.write_checked("OUTP NORM")

        # 用户校准
        dev.write_checked("CAL:ENAB 1")
        dev.write_checked('CAL:USER:UNL "1234"')
        for gear, mohm in {0: 100, 1: 200, 27: 8}.items():
            dev.write_checked(f"CAL:USER:GEAR {gear}")
            dev.write_checked(f"CAL:USER:VAL {mohm}")
        dev.write_checked('CAL:USER:DATE "2026-09-29"')
        dev.write_checked("CAL:USER:SAVE")
        dev.write_checked("CAL:ENAB 0")
    finally:
        dev.close()


if __name__ == "__main__":
    main()
```

## 注意事项

- 阻值相关命令的单位一律为 mΩ；越界返回错误码且不改变当前值。
- 写入校准数据前须 `CAL:ENAB 1` 且用户数据集未锁定。
- 出错时设备不会主动上报，需读取错误队列 `SYST:ERR?`；建议在设置命令后检查一次。
- `SYST:PROT AT` 会切换到 AT 模式并重新枚举 USB，之后需改用 `pyserial` 通信。
- 同一 VISA 资源同一时刻只能被一个程序占用，避免多进程并发访问。
