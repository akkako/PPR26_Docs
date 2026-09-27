# 固件升级指南

PPR26 通过 USB 进行固件升级，在 Windows、Linux、macOS 上均免驱支持（设备携带 WCID 描述符，Windows 会自动绑定 WinUSB 驱动）。

固件升级需要使用专用上位机，本仪器提供两种升级工具：

1. 网页版 WebUI 上位机（图形界面，使用简单，推荐绝大多数场景）
2. 基于 Python 的命令行升级脚本

对于大多数用户，推荐使用网页版：

- 在线地址：[PPR26 Bootloader 升级工具](https://akkako.github.io/PPR26_Docs/bootloader/)

## 通过 WebUI 升级

### 步骤 1：进入仪器的 DFU 模式

断开仪器的电源，按住仪器前面板上的 DFU 升级按键，重新接入电源后，再松开按键。

### 步骤 2：打开 WebUI 升级网页

使用 Chrome / Edge 109+ 打开 [PPR26 Bootloader 升级工具](https://akkako.github.io/PPR26_Docs/bootloader/)。

### 步骤 3：连接设备

点击 WebUI 的 **连接设备** 按键，并在浏览器弹出的选择框中选择 `PPR26 WinUSB DFU`。

连接成功后，页面会显示 `已连接` 状态。

!!! warning "注意事项"
    如果选择框中没有对应设备，或者连接失败，请检查设备连接和供电情况，以及设备是否进入 DFU 模式。

### 步骤 4：检查设备信息

连接成功后，在设备信息栏中将显示相关信息：

| 信息条目 | 信息示例 |
| -------- | -------- |
| 供应商 | akaInstruments |
| 设备型号 | PPR26 |
| 设备序列号 | 8704305548517271066FFF49 |
| 制造日期 | 26-09 |
| 硬件版本 | 0 |
| Bootloader版本 | BL 1.0.0 |
| 固件版本 | FW v1.0.5 |
| Bootloader编译时间 | 2026-09-27 13:07:47 |
| 固件编译时间 | 2026-09-27 13:03:09 |

!!! info "信息说明"
    制造日期格式为 `YY-WW`，表示生产年份后两位与生产周数，例如 `26-09` 表示 2026 年第 9 周；硬件版本为单个数字 `0`-`6`。

### 步骤 5：选择待升级固件文件

在升级框中，点击 **选择固件** 按键，并在弹出的对话框中选择随版本发布的固件文件（`*_pack.bin`）。

!!! warning "注意"
    请选择随版本发布的 `*_pack.bin` 固件文件，不要选择 `.hex` 或其它未经打包的文件。

### 步骤 6：执行固件升级

选择待升级固件后，点击 **一键升级** 按键，即可自动完成升级流程。

升级完成后，仪器将自动退出 DFU 模式并运行新固件。

## 通过 Python 脚本升级

!!! info "说明"
    Python 脚本随版本发布提供，需要 Python 3.8+ 与 `pyusb` 依赖（Windows 下通常无需额外安装 USB 驱动）。

### 步骤 1：安装依赖

```bash
pip install pyusb
```

### 步骤 2：进入仪器的 DFU 模式

断开仪器的电源，按住仪器前面板上的 DFU 升级按键，重新接入电源后，再松开按键。

### 步骤 3：执行升级脚本

帮助说明：

```bash
python winusb_bootloader.py --help
```

```text
usage: winusb_bootloader.py [-h] [--vid VID] [--pid PID] [--sn SN] [--info]
                            [--program FILE] [--check] [--jump] [--upgrade FILE]

PPR26 WinUSB bootloader host tool

options:
  -h, --help      show this help message and exit
  --vid VID       USB VID
  --pid PID       USB PID
  --sn SN         Device serial number
  --info          Read and display device info
  --program FILE  Program a firmware image (*_pack.bin)
  --check         Check application integrity
  --jump          Jump to application
  --upgrade FILE  One-key upgrade: info -> erase -> program -> check -> jump
```

!!! tip "信息提示"
    通常只需要使用 `--info` 参数和 `--upgrade FILE` 参数即可完成升级。

#### 查询设备信息

```bash
python winusb_bootloader.py --info
```

执行结果示例：

```text
> python winusb_bootloader.py --info

Connected to akaInstruments PPR26 WinUSB DFU (SN: 8704305548517271066FFF49)
Pinging device...
Device responded.

Device information:
  Vendor:               akaInstruments
  Device Model:         PPR26
  Device SN:            8704305548517271066FFF49
  Manufacture Date:     26-09  (YY-WW)
  Hardware Version:     0  (0-6)
  Bootloader Version:   BL 1.0.0
  Firmware Version:     FW v1.0.5
  Bootloader Build Time:2026-09-27 13:07:47
  Firmware Build Time:  2026-09-27 13:03:09
```

#### 执行固件升级

```bash
python winusb_bootloader.py --upgrade PPR26_APP_pack.bin
```

将 `PPR26_APP_pack.bin` 替换为随版本发布的固件文件，执行此命令将自动完成擦除、编程、校验、跳转的全部流程。

如果有多个设备同时连接，可以通过 `--sn` 参数指定 SN，升级单台设备：

```bash
python winusb_bootloader.py --sn 8704305548517271066FFF49 --upgrade PPR26_APP_pack.bin
```

## 常见问题

### 网页版提示要连接 HID 设备

浏览器加载了旧版缓存的页面。请强制刷新（Windows：`Ctrl + F5`；macOS：`Cmd + Shift + R`）或清除站点数据后重试，并使用 Chrome / Edge 109+。

### 设备列表中找不到设备

- 确认设备已进入 DFU 模式。
- 本工具只支持新版 WinUSB Bootloader 设备。
- 关闭可能占用设备的其它程序，或重新插拔设备。

### 升级校验失败

请确认选择的是随版本发布的 `*_pack.bin` 固件文件，而不是其它来源或未经打包的文件。
