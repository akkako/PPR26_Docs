# Host Tools

PPR26 provides two kinds of host tool, web-based and Python, for device control and firmware upgrade.

## Web-Based Tools (No Installation)

| Tool | Address | Description |
| ---- | ---- | ---- |
| PPR26 Tools | <https://akkako.github.io/PPR26_Docs/> | Entry point for all online tools |
| Bootloader Upgrade Tool | <https://akkako.github.io/PPR26_Docs/bootloader/> | Upgrade firmware over WebUSB |
| Serial Console | <https://akkako.github.io/PPR26_Docs/serial/> | Set resistance, limits, and output state (requires AT mode) |

- Requires Chrome / Edge 109+.
- For how to use the serial console, see [Serial Console (Web)](webui_serial.md).

## Python Tools

For device information queries and firmware upgrade, suitable for scripting / batch operation. For downloads, commands, and upgrade steps, see [Tool Downloads and Usage](downloads.md).

## Page Index

| Page | Content |
| ---- | ---- |
| [Host Tools Guide](getstarted.md) | Overview of the web-based and Python host tools |
| [Serial Console (Web)](webui_serial.md) | Set resistance, limits, and output state in the browser |
| [Tool Downloads and Usage](downloads.md) | Python tool downloads, commands, and upgrade steps |

!!! tip "Related documentation"
    - Communication modes and switching: [Communication Mode Switching](../quickstart/modeswitch.md)
    - Firmware upgrade steps: [Firmware Upgrade Guide](../quickstart/fwupgrade.md)
