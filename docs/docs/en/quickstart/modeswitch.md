# Communication Mode Switching

PPR26 has two communication modes, used with different host tools and in different scenarios:

| Mode     | Protocol stack                | PC enumeration                        | Common host tools                                         |
| -------- | ----------------------------- | ------------------------------------- | --------------------------------------------------------- |
| **AT**   | Custom AT commands (USB CDC)  | USB serial port (virtual serial port) | Serial tools, `pyserial`, [Serial Console (Web)](../software/webui_serial.md) |
| **SCPI** | SCPI commands (USB TMC)       | USB TMC device                        | NI‑VISA / `pyvisa`, SCPI-compliant instrument software    |

- The factory default is **AT mode**.
- AT mode (USB CDC) is usually driver-free; SCPI mode (USB TMC) requires a driver to be installed (NI‑VISA recommended).

## How to Determine the Current Mode

The mode can be distinguished by the device type enumerated on the PC:

| Mode           | Enumeration result              | Identifier (VID:PID) |
| -------------- | ------------------------------- | -------------------- |
| AT             | USB serial device (COMx)        | `FFFE:FFFE`          |
| SCPI           | USB Test and Measurement Device | `FFFE:FFFF`          |
| DFU bootloader | `PPR26 WinUSB DFU` (firmware upgrade only) | `FFFE:FFFD` |

## Switching Methods

### Method 1: Software Command (Run-Time Switching, Recommended)

In the **current mode**, simply send the corresponding switch command; no power cycle is needed:

=== "AT → SCPI"

    ```text
    AT+SYS.PROT=1
    ```

=== "SCPI → AT"

    ```text
    SYST:PROT AT
    ```

- The switch is a **run-time switch**: the device disconnects and reconnects USB (D+) and then re-enumerates using the new protocol.
- The current connection is dropped after the switch command is executed; this is normal. Wait for the device to re-enumerate, then reconnect with a host tool for the corresponding protocol.
- The switch result is saved; **the last selected mode is retained after a power cycle**.

!!! tip "Tip"
    You can also switch in the corresponding Python script: in AT mode, use `pyserial` to send `AT+SYS.PROT=1`; in SCPI mode, use `pyvisa` to send `SYST:PROT AT`.

### Method 2: Rear-Panel DFU Button

The **DFU button** on the device **rear panel** acts differently in the two states:

| How it is used                                  | Effect                                                     |
| ----------------------------------------------- | ---------------------------------------------------------- |
| **Long-press for about 3 seconds while running** | Switch between AT and SCPI (same as the software command in Method 1) |
| **Hold the button while applying power**        | Enter **DFU bootloader mode**, used for firmware upgrade   |

!!! warning "Caution"
    - Long-pressing while running switches the protocol as a run-time switch; USB disconnects and reconnects, and DFU mode is not entered.
    - DFU mode is entered only by **holding the button at power-on/reset**; DFU mode is used only for firmware upgrade and cannot be used for communication. For the upgrade procedure, see the [Firmware Upgrade Guide](./fwupgrade.md).

### Method 3: Entering DFU with a Communication Command (No Button)

When the device is in a communication mode, you can also enter DFU mode directly with a command (the device automatically restarts and re-enumerates as a DFU device):

=== "AT Mode"

    ```text
    AT+DEV.DFU
    ```

=== "SCPI Mode"

    ```text
    SYST:DFU
    ```

After the command is executed, the device immediately disconnects USB, so **whether the device re-enumerates as `PPR26 WinUSB DFU` is the criterion for success**. For details, see `AT+DEV.DFU` in the [AT Command Reference](../reference/at.md) and `SYST:DFU` in the [SCPI Command Reference](../reference/scpi.md).

## Connecting After a Switch

After the switch is complete, reconnect using the new protocol:

- **AT mode**: Use a serial tool or `pyserial`; the serial parameters are `115200 / 8 / None / 1`, and commands are terminated with a newline. See the [AT Command Reference](../reference/at.md) and the [AT Python Example](../reference/python_at.md).
- **SCPI mode**: Use NI‑VISA / `pyvisa`; the resource string looks like `USB0::0xFFFE::0xFFFF::<serial number>::0::INSTR`, and commands are terminated with a newline `<LF>`. See the [SCPI Command Reference](../reference/scpi.md) and the [SCPI Python Example](../reference/python_scpi.md).

## FAQ

**Device not found after switching?**

During the switch, the device disconnects and re-enumerates; please wait and refresh the device list in the host tool. If it is still not found:

- Confirm that the device has enumerated using the new protocol (USB serial port for AT, USB TMC device for SCPI).
- SCPI mode requires a driver to be installed (NI‑VISA recommended); otherwise the device may fail to open because the driver is missing.
- Close other programs that may be using the device, or unplug and replug the USB cable.

**Long-pressing the button does not enter DFU?**

Long-pressing while running **switches the protocol**; to enter DFU, **hold the button while applying power** (disconnect power first, hold the button, then apply power, and then release it), or use the `AT+DEV.DFU` / `SYST:DFU` command. See the [Firmware Upgrade Guide](./fwupgrade.md).

**Device not visible in the web serial console?**

The web serial console supports **AT mode** only; if the device is in SCPI mode, switch it back to AT mode first.
