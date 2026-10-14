# Host Tools Guide

PPR26 provides two host tools for device control and firmware upgrade.

## Web-Based Tools

Used directly in a browser, no installation required:

| Tool | Address | Description |
| ---- | ---- | ---- |
| PPR26 Tools | <https://akkako.github.io/PPR26_Docs/> | Entry point for all online tools |
| Bootloader Upgrade Tool | <https://akkako.github.io/PPR26_Docs/bootloader/> | Upgrade firmware over WebUSB |
| Serial Console | <https://akkako.github.io/PPR26_Docs/serial/> | Set resistance, limits, and output state over WebSerial (requires AT mode) |

- Requires Chrome / Edge 109+.
- For detailed firmware upgrade steps, see [Firmware Upgrade Guide](../quickstart/fwupgrade.md).
- For how to use the serial console, see [Serial Console (Web)](webui_serial.md).

## Python Host Tools

The Python host tools can query device information, control the resistance, and upgrade firmware, and are suitable for scripting / batch operation. Two forms are provided:

- **Windows executable**: download the latest [PPR26_Bootloader.exe](https://github.com/akkako/PPR26_Docs/releases/latest/download/PPR26_Bootloader.exe) directly (dependencies bundled, runs as-is)
- **Python scripts**: `winusb_bootloader.py` (firmware upgrade), `ppr26_at.py` (AT command wrapper library), `ppr26_scpi.py` (SCPI command wrapper library), `ppr26_selftest_at.py` / `ppr26_selftest_scpi.py` (AT / SCPI self-test); the wrapper libraries can also be run directly to print device information and output state

For downloads and detailed usage, see [Tool Downloads and Usage](downloads.md).

Using the Python scripts requires Python 3.8+, plus `pyusb`, `pyserial`, and `pyvisa`:

```bash
pip install pyusb pyserial pyvisa
```

Common commands:

```bash
python winusb_bootloader.py --info                       # Query device information (DFU mode)
python winusb_bootloader.py --upgrade PPR26_APP_pack.bin # One-click upgrade
python ppr26_at.py                                       # Read device information and output state (AT mode)
python ppr26_scpi.py                                     # Read device information and output state (SCPI mode)
python ppr26_selftest_at.py                                 # Self-test (AT mode)
```

In the device information, the manufacture date format is `YY-WW` and the hardware version is a single digit `0`-`6`.

For detailed commands and example output, see [Firmware Upgrade Guide](../quickstart/fwupgrade.md); for a programming example in AT mode, see [AT Python Example](../reference/python_at.md).
