# PPR26 Python 上位机

本目录存放 PPR26 的 Python 上位机脚本，均通过 USB 直接与设备通信。

| 脚本 | 用途 | 模式 | 依赖 |
| ---- | ---- | ---- | ---- |
| `winusb_bootloader.py` | 固件升级、设备信息查询 | DFU（WinUSB） | `pyusb`（Windows 还需 `libusb-1.0.dll`） |
| `ppr26_at.py` | AT 指令封装库 + 只读信息查询命令行 | AT（USB CDC） | `pyserial` |
| `ppr26_scpi.py` | SCPI 指令封装库 + 只读信息查询命令行 | SCPI（USB TMC） | `pyvisa` + VISA 后端 |
| `ppr26_selftest_at.py` | 功能自检 | AT（USB CDC） | `pyserial` |
| `ppr26_selftest_scpi.py` | 功能自检 | SCPI（USB TMC） | `pyvisa` + VISA 后端 |

## 安装依赖

```bash
pip install -r requirements.txt
```

- Windows 下用 `pyusb` 还需要 `libusb-1.0.dll`，可放在脚本同目录（[发布页](https://github.com/akkako/PPR26_Docs/releases/latest/download/libusb-1.0.dll)提供 32 位版本）。
- SCPI 需要 VISA 后端：安装 NI-VISA，或 `pip install pyvisa-py` 后用 `--backend @py` 指定纯 Python 后端。

## 固件升级（DFU 模式）

```bash
python winusb_bootloader.py --info
python winusb_bootloader.py --upgrade PPR26_APP_pack.bin
```

## AT 指令封装库（AT 模式）

`ppr26_at.py` 封装了全部 AT 指令，阻值单位统一为 mΩ：

```python
from ppr26_at import PPR26_AT

with PPR26_AT("COM12") as dev:          # 省略端口时按 VID 0xFFFE 自动查找
    print(dev.get_model(), dev.get_serial_number(), dev.get_firmware_version())
    dev.set_resistance(523000)          # 523000 mΩ = 523 Ω
    print(dev.get_resistance_pv(), "mΩ")
```

也可直接运行，打印设备信息与当前输出状态（只读，不修改设置）：

```bash
python ppr26_at.py            # 自动查找串口
python ppr26_at.py -p COM12   # 指定串口
```

## SCPI 指令封装库（SCPI 模式）

`ppr26_scpi.py` 封装了全部 SCPI 指令，写入后自动检查错误队列：

```python
from ppr26_scpi import PPR26_SCPI

with PPR26_SCPI() as dev:               # 省略资源名时按 VID:PID 自动查找
    print(dev.get_idn(), dev.get_temperature(), "℃")
    dev.set_resistance(523000)
    dev.write_checked("SYST:COMP PREC")  # 写命令 + 检查 SYST:ERR?
```

同样可直接运行（只读）：

```bash
python ppr26_scpi.py
python ppr26_scpi.py -r "USB0::0xFFFE::0xFFFF::<SN>::0::INSTR"
python ppr26_scpi.py -b @py             # 使用 pyvisa-py 后端
```

## 功能自检（AT / SCPI）

按文档「功能自检脚本」的检查项依次验证设备：连接与识别、阻值设置、补偿模式、限值（含越界拒绝）、
输出状态、温度、用户校准（只读）。脚本会先记录限值、限值使能与补偿模式的原值，结束时写回。

```bash
python ppr26_selftest_at.py                # AT：自动查找串口
python ppr26_selftest_at.py -p COM12
python ppr26_selftest_scpi.py           # SCPI：自动查找资源
python ppr26_selftest_scpi.py -b @py    # 使用 pyvisa-py 后端
```

退出码 `0` 表示全部通过，`1` 表示存在失败项。

## 使用打包好的可执行文件

上位机代码更新后由 GitHub Actions 自动用 PyInstaller 构建 Windows（Win32）版本并发布，以下链接始终指向最新构建：

- [PPR26_Bootloader.exe](https://github.com/akkako/PPR26_Docs/releases/latest/download/PPR26_Bootloader.exe)（可执行文件）
- [PPR26_Bootloader_win32.zip](https://github.com/akkako/PPR26_Docs/releases/latest/download/PPR26_Bootloader_win32.zip)（完整压缩包：可执行文件 + 全部 Python 脚本 + libusb）

## 文档

使用教程与下载说明见在线文档：[工具下载与使用](https://akkako.github.io/PPR26_Docs/docs/software/downloads/)。
