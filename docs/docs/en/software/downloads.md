# Tool Downloads and Usage

PPR26 provides two kinds of host tool: a web version (no installation required, see [Firmware Upgrade Guide](../quickstart/fwupgrade.md)) and Python command-line tools. This page describes how to download and use the Python tools.

## Download

After the host tool code is updated, GitHub Actions automatically builds and publishes a Windows (Win32) version with PyInstaller. The following links **always point to the latest build** of the binary files:

[Download PPR26_Bootloader.exe (Latest)](https://github.com/akkako/PPR26_Docs/releases/latest/download/PPR26_Bootloader.exe){ .md-button .md-button--primary }
[Download Full Package (Latest)](https://github.com/akkako/PPR26_Docs/releases/latest/download/PPR26_Bootloader_win32.zip){ .md-button }

| File | Description |
| ---- | ---- |
| `PPR26_Bootloader.exe` | Windows executable (32-bit, libusb bundled, recommended) |
| `PPR26_Bootloader_win32.zip` | Archive with the executable + all Python scripts + libusb |
| `winusb_bootloader.py` | Firmware upgrade script (cross-platform, requires `pyusb` installed separately) |
| `ppr26_at.py` | AT command wrapper library + read-only information query command line (AT mode, requires `pyserial`) |
| `ppr26_scpi.py` | SCPI command wrapper library + read-only information query command line (SCPI mode, requires `pyvisa`) |
| `ppr26_selftest_at.py` | Self-test script (AT mode, requires `pyserial`) |
| `ppr26_selftest_scpi.py` | Self-test script (SCPI mode, requires `pyvisa`) |
| `requirements.txt` | Python dependencies (`pyserial` + `pyusb` + `pyvisa`) |
| `libusb-1.0.dll` | libusb backend required to use the Python scripts on Windows (32-bit) |

Direct download links (always point to the latest version):

- [PPR26_Bootloader.exe](https://github.com/akkako/PPR26_Docs/releases/latest/download/PPR26_Bootloader.exe)
- [PPR26_Bootloader_win32.zip](https://github.com/akkako/PPR26_Docs/releases/latest/download/PPR26_Bootloader_win32.zip)
- [winusb_bootloader.py](https://github.com/akkako/PPR26_Docs/releases/latest/download/winusb_bootloader.py)
- [ppr26_at.py](https://github.com/akkako/PPR26_Docs/releases/latest/download/ppr26_at.py)
- [ppr26_scpi.py](https://github.com/akkako/PPR26_Docs/releases/latest/download/ppr26_scpi.py)
- [ppr26_selftest_at.py](https://github.com/akkako/PPR26_Docs/releases/latest/download/ppr26_selftest_at.py)
- [ppr26_selftest_scpi.py](https://github.com/akkako/PPR26_Docs/releases/latest/download/ppr26_selftest_scpi.py)
- [requirements.txt](https://github.com/akkako/PPR26_Docs/releases/latest/download/requirements.txt)
- [libusb-1.0.dll](https://github.com/akkako/PPR26_Docs/releases/latest/download/libusb-1.0.dll)

## Using the Executable (Windows, Recommended)

1. Download `PPR26_Bootloader.exe` (or `PPR26_Bootloader_win32.zip` and extract it).
2. Put the device into DFU mode: disconnect power from the instrument, hold down the DFU upgrade button on the **rear panel**, reconnect power, and then release it; alternatively, you can enter without the button by sending `AT+DEV.DFU` (AT) or `SYST:DFU` (SCPI) in communication mode.
3. Run the following in a command line (PowerShell / CMD):

    ```bat
    PPR26_Bootloader.exe --info
    PPR26_Bootloader.exe --upgrade PPR26_APP_pack.bin
    ```

    Running without arguments prints the help information.

## Using the Python Scripts

Requirements: Python 3.8+, `pyusb`, `pyserial`, and `pyvisa`; on Windows, the upgrade script also needs `libusb-1.0.dll` (recommended to place it in the same directory as the script).

```bash
pip install pyusb pyserial pyvisa

python winusb_bootloader.py --info
python winusb_bootloader.py --upgrade PPR26_APP_pack.bin
```

## AT Command Script (AT Mode)

When the device is in AT mode (USB CDC), you can use `ppr26_at.py` to query device information and output state:

```bash
python ppr26_at.py            # Auto-detect the serial port by VID 0xFFFE
python ppr26_at.py -p COM12   # Specify the serial port
```

The script is also an importable wrapper library that wraps all AT commands:

```python
from ppr26_at import PPR26_AT

with PPR26_AT("COM12") as dev:
    print(dev.get_model(), dev.get_serial_number())
    dev.set_resistance(523000)      # 523000 mΩ = 523 Ω
    print(dev.get_resistance_pv())
```

For more communication examples, see [AT Python Example](../reference/python_at.md).

## SCPI Command Script (SCPI Mode)

When the device is in SCPI mode (USB TMC), you can use `ppr26_scpi.py` to query device information and output state:

```bash
python ppr26_scpi.py            # Auto-detect the resource by VID:PID 0xFFFE:0xFFFF
python ppr26_scpi.py -b @py     # Use the pyvisa-py backend (when NI-VISA is not installed)
```

The script is also an importable wrapper library that wraps all SCPI commands; after a write command, it can automatically check the error queue:

```python
from ppr26_scpi import PPR26_SCPI

with PPR26_SCPI() as dev:
    print(dev.get_idn(), dev.get_temperature(), "℃")
    dev.set_resistance(523000)              # 523000 mΩ = 523 Ω
    dev.write_checked("SYST:COMP PREC")     # Write and check SYST:ERR?
```

For more communication examples, see [SCPI Python Example](../reference/python_scpi.md).

## Self-Test Script

`ppr26_selftest_at.py` (AT) and `ppr26_selftest_scpi.py` (SCPI) check, in order, connection and identification, resistance setting,
compensation mode, limits (including rejection of out-of-range values), output state, temperature, and user calibration (read-only):

```bash
python ppr26_selftest_at.py              # AT mode, auto-detect the serial port
python ppr26_selftest_scpi.py         # SCPI mode, auto-detect the resource
```

At startup the script records the original values of the limits, the limits-enable flag, and the compensation mode, and writes them back at the end; exit code `0` means that everything passed.
Descriptions of the check items and a standalone version that does not depend on the above wrapper libraries are given in [Self-Test Script](../reference/scripts/test.md).

## Common Commands

| Command | Description |
| ---- | ---- |
| `--info` | Query device information |
| `--upgrade FILE` | One-click upgrade (erase → program → verify → jump) |
| `--program FILE` | Program the firmware only |
| `--check` | Verify application integrity |
| `--jump` | Jump to the application |
| `--sn SN` | Select by serial number when multiple devices are present |
| `--vid / --pid` | Custom VID / PID (default `0xFFFE` / `0xFFFD`) |

In the device information, the manufacture date format is `YY-WW` (for example, `26-09` means week 9 of 2026), and the hardware version is a single digit `0`-`6`.

!!! warning "Firmware file"
    For upgrades, use the `*_pack.bin` firmware file released with the version; do **not** use `.hex` or other unpackaged files.

For the complete firmware upgrade procedure, see [Firmware Upgrade Guide](../quickstart/fwupgrade.md).
