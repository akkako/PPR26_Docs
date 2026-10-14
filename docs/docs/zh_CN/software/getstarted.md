# 上位机使用指南

PPR26 提供两种上位机工具用于设备控制与固件升级。

## 网页版工具

通过浏览器直接使用，无需安装：

| 工具 | 地址 | 说明 |
| ---- | ---- | ---- |
| 工具中心 | <https://akkako.github.io/PPR26_Docs/> | 所有在线工具的入口 |
| Bootloader 升级工具 | <https://akkako.github.io/PPR26_Docs/bootloader/> | 通过 WebUSB 升级固件 |
| 串口上位机 | <https://akkako.github.io/PPR26_Docs/serial/> | 通过 WebSerial 设置阻值、限值与输出状态（需 AT 模式） |
| NTC 模拟器 | <https://akkako.github.io/PPR26_Docs/ntcsim/> | 把 PPR26 当热敏电阻：按模型把温度换算成阻值并下发（需 AT 模式） |

- 需要 Chrome / Edge 109+。
- 固件升级步骤详见[固件升级指南](../quickstart/fwupgrade.md)。
- 串口上位机使用方法详见[串口上位机（网页版）](webui_serial.md)。
- NTC 模拟器使用方法详见 [NTC 模拟器（网页版）](webui_ntcsim.md)。

## Python 上位机

Python 上位机可完成设备信息查询、阻值控制与固件升级，适合脚本化 / 批量操作。提供两种形式：

- **Windows 可执行文件**：直接下载最新版 [PPR26_Bootloader.exe](https://github.com/akkako/PPR26_Docs/releases/latest/download/PPR26_Bootloader.exe)（内置依赖，直接运行）
- **Python 脚本**：`winusb_bootloader.py`（固件升级）、`ppr26_at.py`（AT 指令封装库）、`ppr26_scpi.py`（SCPI 指令封装库）、`ppr26_selftest_at.py` / `ppr26_selftest_scpi.py`（AT / SCPI 功能自检）；封装库也可直接运行，打印设备信息与输出状态

下载与详细用法见[工具下载与使用](downloads.md)。

使用 Python 脚本需要 Python 3.8+，以及 `pyusb`、`pyserial`、`pyvisa`：

```bash
pip install pyusb pyserial pyvisa
```

常用命令：

```bash
python winusb_bootloader.py --info                       # 查询设备信息（DFU 模式）
python winusb_bootloader.py --upgrade PPR26_APP_pack.bin # 一键升级
python ppr26_at.py                                       # 读取设备信息与输出状态（AT 模式）
python ppr26_scpi.py                                     # 读取设备信息与输出状态（SCPI 模式）
python ppr26_selftest_at.py                                 # 功能自检（AT 模式）
```

设备信息中的制造日期格式为 `YY-WW`，硬件版本为单个数字 `0`-`6`。

详细的命令与输出示例见[固件升级指南](../quickstart/fwupgrade.md)；AT 模式下的编程示例见 [AT Python 编程示例](../reference/python_at.md)。
