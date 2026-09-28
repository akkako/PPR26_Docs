# 工具下载与使用

PPR26 提供两种上位机：网页版（无需安装，见 [固件升级指南](../quickstart/fwupgrade.md)）与 Python 命令行工具。本页提供 Python 工具的下载与使用说明。

## 下载

上位机代码更新后，GitHub Actions 会自动用 PyInstaller 构建 Windows（Win32）版本并发布。以下链接**始终指向最新构建**的二进制文件：

[下载 PPR26_Bootloader.exe（最新）](https://github.com/akkako/PPR26_Docs/releases/latest/download/PPR26_Bootloader.exe){ .md-button .md-button--primary }
[下载完整压缩包（最新）](https://github.com/akkako/PPR26_Docs/releases/latest/download/PPR26_Bootloader_win32.zip){ .md-button }

| 文件 | 说明 |
| ---- | ---- |
| `PPR26_Bootloader.exe` | Windows 可执行文件（32 位，已内置 libusb，推荐） |
| `PPR26_Bootloader_win32.zip` | 可执行文件 + Python 脚本 + libusb 的压缩包 |
| `winusb_bootloader.py` | Python 脚本（跨平台，需自行安装 `pyusb`） |
| `libusb-1.0.dll` | Windows 下使用 Python 脚本所需的 libusb 后端（32 位） |

直接下载链接（始终指向最新版本）：

- [PPR26_Bootloader.exe](https://github.com/akkako/PPR26_Docs/releases/latest/download/PPR26_Bootloader.exe)
- [PPR26_Bootloader_win32.zip](https://github.com/akkako/PPR26_Docs/releases/latest/download/PPR26_Bootloader_win32.zip)
- [winusb_bootloader.py](https://github.com/akkako/PPR26_Docs/releases/latest/download/winusb_bootloader.py)
- [libusb-1.0.dll](https://github.com/akkako/PPR26_Docs/releases/latest/download/libusb-1.0.dll)

## 使用可执行文件（Windows，推荐）

1. 下载 `PPR26_Bootloader.exe`（或 `PPR26_Bootloader_win32.zip` 并解压）。
2. 让设备进入 DFU 模式：断开仪器电源，按住前面板上的 DFU 升级按键，重新接入电源后再松开。
3. 在命令行（PowerShell / CMD）中运行：

    ```bat
    PPR26_Bootloader.exe --info
    PPR26_Bootloader.exe --upgrade PPR26_APP_pack.bin
    ```

    不加参数运行会打印帮助信息。

## 使用 Python 脚本

环境要求：Python 3.8+ 与 `pyusb`；Windows 下脚本还需 `libusb-1.0.dll`（建议与脚本放在同一目录）。

```bash
pip install pyusb

python winusb_bootloader.py --info
python winusb_bootloader.py --upgrade PPR26_APP_pack.bin
```

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
