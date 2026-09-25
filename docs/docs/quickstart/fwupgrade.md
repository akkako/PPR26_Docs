# 固件升级指南

PPR26 使用 USB HID 进行固件升级，在 Windows，Linux，macOS 上均为免驱支持。

固件升级需要使用专用上位机，本仪器提供两种不同的上位机升级工具，分别为：

1. WebHID 实现的 WebUI 上位机（具有图形界面，使用简单，适用于绝大多数使用场景）
2. 基于 python 的升级脚本（命令行实现）

对于大多数用户，推荐使用 WebUI 上位机：[PPR26 HID DFU WebUI](https://github.com/akkako/PPR26/tree/main/software/hidboot_webui)

## 通过 WebUI 升级

### 步骤 1：进入仪器的 DFU 模式

断开仪器的电源，按住仪器前面板上的 DFU 升级按键，重新接入电源后，再松开按键。

### 步骤 2：打开 WebUI 升级网页

点击[PPR26 HID DFU WebUI](https://github.com/akkako/PPR26/tree/main/software/hidboot_webui)进入 WebUI 升级网页。

### 步骤 3：连接设备

点击 WebUI 的连接设备按键，并在浏览器弹出的选择框中选择 `PPR26 HID DFU`。

点击连接按键，此时应显示 `已连接` 状态。

!!! warning "注意事项"
    如果选择框中没有对应设备，或者连接失败，请检查设备连接和供电情况，以及设备是否进入 DFU 模式。

### 步骤 4：检查设备信息

连接成功后，在设备信息栏中将显示相关信息：

| 信息条目           | 信息示例                 |
| ------------------ | ------------------------ |
| 供应商             | akaInstruments           |
| 设备型号           | PPR26                    |
| 设备序列号         | 8704305548517271066FFF49 |
| 制造日期           | 2026-07-25               |
| 硬件版本           | FEEFFFFF                 |
| Bootloader版本     | BL 1.0.0                |
| 固件版本           | FW 1.0.5                |
| Bootloader编译时间 | 2026-07-27 14:20:23     |
| 固件编译时间       | 2026-07-27 13:03:09     |

### 步骤 5：选择待升级固件文件

在升级框中，点击选择固件按键，并在弹出的对话框中选择待升级的固件文件。

### 步骤 6：执行固件升级

选择待升级固件后，点击一键升级按键，即可自动完成升级流程。

升级完成后，仪器将自动退出 DFU 模式。

## 通过 python 脚本升级

### 步骤 1：下载 python 脚本

使用 git 克隆此仓库：[PPR26 HID DFU Tool](https://github.com/akkako/PPR26)

```bash
git clone https://github.com/akkako/PPR26
```

### 步骤 2：安装所需依赖

升级脚本需要 Python 3.8+ 和 `hidapi>=0.14.0` 的 python 库依赖。

通过以下命令安装依赖：

```bash
pip install -r requirements.txt
```
!!! tip "信息提示"
    在 Windows 上，该工具使用系统原生 HID 驱动，通常无需额外安装 USB 驱动。

### 步骤 3：进入仪器的 DFU 模式

断开仪器的电源，按住仪器前面板上的 DFU 升级按键，重新接入电源后，再松开按键。

### 步骤 4：执行升级脚本

#### 帮助说明

帮助命令为：

```bash
python hid_bootloader.py --help
```


```text
usage: hid_bootloader.py [-h] [--vid VID] [--pid PID] [--sn SN] [--info] [--program FILE] [--check] [--jump]
                         [--upgrade FILE]

PPR26 HID bootloader host tool

options:
  -h, --help      show this help message and exit
  --vid VID       USB VID
  --pid PID       USB PID
  --sn SN         Device serial number
  --info          Read and display device info
  --program FILE  Program a firmware file with bootloader header
  --check         Check application integrity
  --jump          Jump to application
  --upgrade FILE  One-key upgrade: info -> erase -> program -> check -> jump
```

!!! tip "信息提示"
    通常只需要使用 `--info` 参数和 `--upgrade FILE` 参数即可完成升级。

#### 查询设备信息

查询设备信息的命令为：

```bash
python hid_bootloader.py --info
```

执行结果示例：

```text
> python hid_bootloader.py --info

Connected to akaInstruments PPR26 HID DFU (SN: 8704305548517271066FFF49)
Pinging device...
Device responded.

Device information:
  Vendor:               akaInstruments
  Device Model:         PPR26
  Device SN:            8704305548517271066FFF49
  Manufacture Date:     2026-07-25
  Hardware Version:     FFFFFFFF
  Bootloader Version:   BL 1.0.0
  Firmware Version:     FW v1.0.5
  Bootloader Build Time:2026-07-27 16:20:03
  Firmware Build Time:  2026-07-27 16:24:55
```

#### 执行固件升级

固件升级命令为：

```bash
python hid_bootloader.py --upgrade app.bin
```

将 `app.bin` 替换为待升级的固件，执行此命令将自动完成擦除，编程，校验，跳转的全部流程。

如果有多个设备同时连接，可以通过 `--sn` 参数指定 SN 升级单台设备。

```bash
python hid_bootloader.py --sn 8704305548517271066FFF49 --upgrade app.bin
```

升级成功输出示例：

```text
> python hid_bootloader.py --upgrade .\PPR26_APP_v1.0.5.bin

Connected to akaInstruments PPR26 HID DFU (SN: 8704305548517271066FFF49)
Pinging device...
Device responded.

Device information:
  Vendor:               akaInstruments
  Device Model:         PPR26
  Device SN:            8704305548517271066FFF49
  Manufacture Date:     2026-07-25
  Hardware Version:     FFFFFFFF
  Bootloader Version:   BL 1.0.0
  Firmware Version:     FW v1.0.5
  Bootloader Build Time:2026-07-27 16:20:03
  Firmware Build Time:  2026-07-27 16:24:55

Programming firmware image (17264 bytes)...
Erasing application...
Programming 17264 bytes in 1024-byte pages...
  1024/17264 bytes programmed
  2048/17264 bytes programmed
  3072/17264 bytes programmed
  4096/17264 bytes programmed
  5120/17264 bytes programmed
  6144/17264 bytes programmed
  7168/17264 bytes programmed
  8192/17264 bytes programmed
  9216/17264 bytes programmed
  10240/17264 bytes programmed
  11264/17264 bytes programmed
  12288/17264 bytes programmed
  13312/17264 bytes programmed
  14336/17264 bytes programmed
  15360/17264 bytes programmed
  16384/17264 bytes programmed
  17264/17264 bytes programmed
Programming finished.

Checking application...
Application check: PASS

Jumping to application...
Device disconnected.
```