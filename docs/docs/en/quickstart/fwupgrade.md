# Firmware Upgrade Guide

PPR26 firmware upgrade is performed over USB and is driver-free on Windows, Linux, and macOS (Windows automatically uses the WinUSB driver).

Firmware upgrade requires a dedicated host tool. This instrument provides two upgrade tools:

1. The web-based WebUI host tool (graphical interface, easy to use, recommended for the vast majority of scenarios)
2. A Python-based command-line upgrade script

For most users, the web version is recommended:

- Online address: [PPR26 Bootloader Upgrade Tool](https://akkako.github.io/PPR26_Docs/bootloader/)

## Upgrading via the WebUI

### Step 1: Enter DFU Mode on the Instrument

Disconnect power from the instrument, hold the DFU upgrade button on the instrument **rear panel**, reapply power, and then release the button.

!!! tip "Entering DFU without the button"
    When the device is in AT mode, you can send `AT+DEV.DFU`; when it is in SCPI mode, you can send `SYST:DFU`. The device automatically restarts and enters DFU mode, with no button operation required. For details, see the [AT Command Reference](../reference/at.md) and the [SCPI Command Reference](../reference/scpi.md).

### Step 2: Open the WebUI Upgrade Page

Open the [PPR26 Bootloader Upgrade Tool](https://akkako.github.io/PPR26_Docs/bootloader/) with Chrome / Edge 109+.

### Step 3: Connect the Device

Click the WebUI's **Connect Device** button and select `PPR26 WinUSB DFU` in the selection dialog that pops up in the browser.

After a successful connection, the page shows the `Connected` status.

!!! warning "Caution"
    If the corresponding device is not present in the selection dialog, or the connection fails, check the device connection and power supply, and whether the device has entered DFU mode.

### Step 4: Check the Device Information

After a successful connection, the relevant information is displayed in the device information section:

| Info item             | Example value            |
| --------------------- | ------------------------ |
| Vendor                | akaInstruments           |
| Device model          | PPR26                    |
| Device serial number  | 0123456789ABCDEF01234567 |
| Manufacture date      | 26-09                    |
| Hardware version      | 0                        |
| Bootloader version    | BL 1.0.0                 |
| Firmware version      | FW 1.0.0                 |
| Bootloader build time | 2026-09-27 13:07:47      |
| Firmware build time   | 2026-09-27 13:03:09      |

!!! info "Note"
    The manufacture date format is `YY-WW`, which represents the last two digits of the production year and the production week; for example, `26-09` means week 9 of 2026. The hardware version is a single digit, `0`-`6`.

### Step 5: Select the Firmware File to Upgrade

In the upgrade area, click the **Select Firmware** button and choose the firmware file shipped with the release (`*_pack.bin`) in the dialog that appears.

!!! warning "Caution"
    Select the `*_pack.bin` firmware file shipped with the release; do not select `.hex` or other files that have not been packaged.

### Step 6: Perform the Firmware Upgrade

After selecting the firmware to upgrade, click the **One-Click Upgrade** button, and the upgrade process completes automatically.

When the upgrade is complete, the instrument automatically exits DFU mode and runs the new firmware.

## Upgrading via the Python Script

!!! info "Note"
    You can directly download the latest [PPR26_Bootloader.exe](https://github.com/akkako/PPR26_Docs/releases/latest/download/PPR26_Bootloader.exe) or [PPR26_Bootloader_win32.zip](https://github.com/akkako/PPR26_Docs/releases/latest/download/PPR26_Bootloader_win32.zip); for more files, see [Tool Downloads and Usage](../software/downloads.md). The executable has its dependencies built in and is recommended for direct use; using the Python script requires Python 3.8+ and `pyusb` (on Windows, `libusb-1.0.dll` is also required, and is provided on the release page).

### Step 1: Prepare the Tools

- Using the executable: download `PPR26_Bootloader.exe` and run it directly.
- Using the Python script: install the dependencies, and make sure `libusb-1.0.dll` is in the same directory as the script on Windows.

```bash
pip install pyusb
```

### Step 2: Enter DFU Mode on the Instrument

Disconnect power from the instrument, hold the DFU upgrade button on the instrument **rear panel**, reapply power, and then release the button (you can also enter without the button using `AT+DEV.DFU` / `SYST:DFU`).

### Step 3: Run the Upgrade Script

Help text:

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

!!! tip "Tip"
    Usually, you only need the `--info` option and the `--upgrade FILE` option to complete the upgrade.

#### Querying Device Information

```bash
python winusb_bootloader.py --info
```

Example output:

```text
> python winusb_bootloader.py --info

Connected to akaInstruments PPR26 WinUSB DFU (SN: 0123456789ABCDEF01234567)
Pinging device...
Device responded.

Device information:
  Vendor:               akaInstruments
  Device Model:         PPR26
  Device SN:            0123456789ABCDEF01234567
  Manufacture Date:     26-09  (YY-WW)
  Hardware Version:     0  (0-6)
  Bootloader Version:   BL 1.0.0
  Firmware Version:     FW 1.0.0
  Bootloader Build Time:2026-09-27 13:07:47
  Firmware Build Time:  2026-09-27 13:03:09
```

#### Performing the Firmware Upgrade

```bash
python winusb_bootloader.py --upgrade PPR26_APP_pack.bin
```

Replace `PPR26_APP_pack.bin` with the firmware file shipped with the release; running this command automatically completes the entire flow of erase, programming, verification, and jump.

If multiple devices are connected at the same time, you can specify the SN with the `--sn` option to upgrade a single device:

```bash
python winusb_bootloader.py --sn 0123456789ABCDEF01234567 --upgrade PPR26_APP_pack.bin
```

## FAQ

### Device Not Found in the Device List

- Confirm that the device has entered DFU mode.
- This tool supports WinUSB Bootloader devices only.
- If the browser prompts you to connect to another type of device, an old cached page has been loaded: force refresh (Windows: `Ctrl + F5`; macOS: `Cmd + Shift + R`) or clear the site data and retry, and use Chrome / Edge 109+.
- Close other programs that may be using the device, or unplug and replug the device.

### Upgrade Check Fails

Make sure you have selected the `*_pack.bin` firmware file shipped with the release, not a file from another source or a file that has not been packaged.
