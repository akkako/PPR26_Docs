# 工具下载与使用

PPR26 提供两种上位机：网页版（无需安装，见 [固件升级指南](../quickstart/fwupgrade.md)）与 Python 命令行工具。本页提供 Python 工具的下载与使用说明。

## 下载

上位机代码更新后，GitHub Actions 会自动用 PyInstaller 构建 Windows（Win32）版本并发布。以下链接**始终指向最新构建**的二进制文件：

[下载 PPR26_Bootloader.exe（最新）](https://github.com/akkako/PPR26_Docs/releases/latest/download/PPR26_Bootloader.exe){ .md-button .md-button--primary }
[下载完整压缩包（最新）](https://github.com/akkako/PPR26_Docs/releases/latest/download/PPR26_Bootloader_win32.zip){ .md-button }

| 文件 | 说明 |
| ---- | ---- |
| `PPR26_Bootloader.exe` | Windows 可执行文件（32 位，已内置 libusb，推荐） |
| `PPR26_Bootloader_win32.zip` | 可执行文件 + 全部 Python 脚本 + libusb 的压缩包 |
| `winusb_bootloader.py` | 固件升级脚本（跨平台，需自行安装 `pyusb`） |
| `ppr26_at.py` | AT 指令封装库 + 只读信息查询命令行（AT 模式，需 `pyserial`） |
| `ppr26_scpi.py` | SCPI 指令封装库 + 只读信息查询命令行（SCPI 模式，需 `pyvisa`） |
| `ppr26_selftest_at.py` | 功能自检脚本（AT 模式，需 `pyserial`） |
| `ppr26_selftest_scpi.py` | 功能自检脚本（SCPI 模式，需 `pyvisa`） |
| `requirements.txt` | Python 依赖（`pyserial` + `pyusb` + `pyvisa`） |
| `libusb-1.0.dll` | Windows 下使用 Python 脚本所需的 libusb 后端（32 位） |

直接下载链接（始终指向最新版本）：

- [PPR26_Bootloader.exe](https://github.com/akkako/PPR26_Docs/releases/latest/download/PPR26_Bootloader.exe)
- [PPR26_Bootloader_win32.zip](https://github.com/akkako/PPR26_Docs/releases/latest/download/PPR26_Bootloader_win32.zip)
- [winusb_bootloader.py](https://github.com/akkako/PPR26_Docs/releases/latest/download/winusb_bootloader.py)
- [ppr26_at.py](https://github.com/akkako/PPR26_Docs/releases/latest/download/ppr26_at.py)
- [ppr26_scpi.py](https://github.com/akkako/PPR26_Docs/releases/latest/download/ppr26_scpi.py)
- [ppr26_selftest_at.py](https://github.com/akkako/PPR26_Docs/releases/latest/download/ppr26_selftest_at.py)
- [ppr26_selftest_scpi.py](https://github.com/akkako/PPR26_Docs/releases/latest/download/ppr26_selftest_scpi.py)
- [requirements.txt](https://github.com/akkako/PPR26_Docs/releases/latest/download/requirements.txt)
- [libusb-1.0.dll](https://github.com/akkako/PPR26_Docs/releases/latest/download/libusb-1.0.dll)

## 使用可执行文件（Windows，推荐）

1. 下载 `PPR26_Bootloader.exe`（或 `PPR26_Bootloader_win32.zip` 并解压）。
2. 让设备进入 DFU 模式：断开仪器电源，按住**后面板**上的 DFU 升级按键，重新接入电源后再松开；也可在通信模式下发送 `AT+DEV.DFU`（AT）或 `SYST:DFU`（SCPI）免按键进入。
3. 在命令行（PowerShell / CMD）中运行：

    ```bat
    PPR26_Bootloader.exe --info
    PPR26_Bootloader.exe --upgrade PPR26_APP_pack.bin
    ```

    不加参数运行会打印帮助信息。

## 使用 Python 脚本

环境要求：Python 3.8+、`pyusb`、`pyserial` 与 `pyvisa`；Windows 下升级脚本还需 `libusb-1.0.dll`（建议与脚本放在同一目录）。

```bash
pip install pyusb pyserial pyvisa

python winusb_bootloader.py --info
python winusb_bootloader.py --upgrade PPR26_APP_pack.bin
```

## AT 指令脚本（AT 模式）

设备工作在 AT 模式（USB CDC）时，可用 `ppr26_at.py` 查询设备信息与输出状态：

```bash
python ppr26_at.py            # 按 VID 0xFFFE 自动查找串口
python ppr26_at.py -p COM12   # 指定串口
```

该脚本同时是可导入的封装库，封装了全部 AT 指令：

```python
from ppr26_at import PPR26_AT

with PPR26_AT("COM12") as dev:
    print(dev.get_model(), dev.get_serial_number())
    dev.set_resistance(523000)      # 523000 mΩ = 523 Ω
    print(dev.get_resistance_pv())
```

更多通信示例见 [AT Python 编程示例](../reference/python_at.md)。

## SCPI 指令脚本（SCPI 模式）

设备工作在 SCPI 模式（USB TMC）时，可用 `ppr26_scpi.py` 查询设备信息与输出状态：

```bash
python ppr26_scpi.py            # 按 VID:PID 0xFFFE:0xFFFF 自动查找资源
python ppr26_scpi.py -b @py     # 使用 pyvisa-py 后端（未安装 NI-VISA 时）
```

该脚本同时是可导入的封装库，封装了全部 SCPI 指令，写命令后可自动检查错误队列：

```python
from ppr26_scpi import PPR26_SCPI

with PPR26_SCPI() as dev:
    print(dev.get_idn(), dev.get_temperature(), "℃")
    dev.set_resistance(523000)              # 523000 mΩ = 523 Ω
    dev.write_checked("SYST:COMP PREC")     # 写入并检查 SYST:ERR?
```

更多通信示例见 [SCPI Python 编程示例](../reference/python_scpi.md)。

## 功能自检脚本

`ppr26_selftest_at.py`（AT）与 `ppr26_selftest_scpi.py`（SCPI）按顺序检查连接与识别、阻值设置、
补偿模式、限值（含越界拒绝）、输出状态、温度与用户校准（只读）：

```bash
python ppr26_selftest_at.py              # AT 模式，自动查找串口
python ppr26_selftest_scpi.py         # SCPI 模式，自动查找资源
```

脚本会先记录限值、限值使能与补偿模式的原值并在结束时写回，退出码 `0` 表示全部通过。
检查项说明与不依赖上述封装库的独立版本见[功能自检脚本](../reference/scripts/test.md)。

## 常用命令

| 命令 | 说明 |
| ---- | ---- |
| `--info` | 查询设备信息 |
| `--upgrade FILE` | 一键升级（擦除 → 烧录 → 校验 → 跳转） |
| `--program FILE` | 仅烧录固件 |
| `--check` | 校验应用完整性 |
| `--jump` | 跳转到应用 |
| `--sn SN` | 多台设备时按序列号选择 |
| `--vid / --pid` | 自定义 VID / PID（默认 `0xFFFE` / `0xFFFD`） |

设备信息中的制造日期格式为 `YY-WW`（例如 `26-09` 表示 2026 年第 9 周），硬件版本为单个数字 `0`-`6`。

!!! warning "固件文件"
    升级请使用随版本发布的 `*_pack.bin` 固件文件，**不要**使用 `.hex` 或其它未经打包的文件。

固件升级的完整步骤见[固件升级指南](../quickstart/fwupgrade.md)。
