# Serial Console (Web)

The web serial console communicates with the PPR26 directly through the browser, with **no software installation required**. It can be used to quickly set the output resistance, configure resistance limits and step size, switch the open/short state, and view device information.

URL: <https://akkako.github.io/PPR26_Docs/serial/>

!!! note "Requirements"
    - Browser: **Chrome / Edge 109 or later** (WebSerial support required).
    - The device must be in **AT mode** (USB CDC virtual serial port); for how to switch, see [Communication Mode Switching](../quickstart/modeswitch.md).

## Before You Start

1. Put the device in AT mode: the device enumerates as a serial port device over USB CDC, and the operating system normally has a built-in driver, so no manual installation is required.
2. Close other programs that may occupy the serial port (other serial tools, Python scripts, another browser tab, etc.).
3. Open <https://akkako.github.io/PPR26_Docs/serial/> in Chrome or Edge.

## Connecting the Device

1. Click **Connect Device**.
2. Select PPR26 in the device list that appears (the device's VID:PID is `0xFFFE:0xFFFE`).
3. After a successful connection, the status shows **Connected**, and the page automatically reads and displays the device information and the current resistance state.

!!! tip "Device not listed?"
    - Make sure the device is in **AT mode**: devices in SCPI mode (USB TMC) and DFU mode **will not** appear in the serial port list.
    - Make sure the device is connected to the computer via USB and that no other program is occupying the serial port.
    - Open the page over `https://` or the local `http://localhost`; at other addresses (for example `http://` with a LAN IP), the browser disables WebSerial.

Click **←** in the page header to return to [PPR26 Tools](https://akkako.github.io/PPR26_Docs/); the two buttons at the upper right are for **switching the light/dark theme** and the **Chinese/English UI**, and the settings are saved locally in the browser.

## Firmware Version Check

After a successful connection, the console compares the device firmware with the latest version published on the site (line 1 of `firmware/VERSION`). **The notice appears only when the device firmware is older than the published release:**

| Case | Behaviour |
| ---- | --------- |
| Versions match | Normal use; the log records `Firmware version matches the latest release (FW x.y.z)` |
| Device is older | A **non-dismissable** notice appears showing both versions, and the tool **sends `AT+DEV.DFU` automatically** to switch the device into DFU mode |
| Device is newer | No notice (likely a development build; no upgrade needed) — only a line in the log |
| Versions cannot be compared | No notice — only a warning in the log |

### Automatic DFU Entry

When the device firmware is older than the published release, the console sends `AT+DEV.DFU` as soon as the notice appears, so the rear-panel DFU button is never needed:

1. The notice shows "Switching the device to DFU mode...".
2. The device drops off the USB bus and re-enumerates as a DFU device (`PPR26 WinUSB DFU`, `0xFFFE:0xFFFD`); the serial port disappears and the page returns to **Disconnected**. This is expected: the device reboots immediately and the `OK` reply may not make it back, so the console treats **the serial port going away** as the success criterion.
3. The notice turns green ("AT+DEV.DFU sent"); click **Go to Upgrade** and the upgrade tool will find a device already in DFU mode.

If the device rejects the command (for example very old firmware without DFU support), the notice shows the failure reason; enter DFU manually as described in the [Firmware Upgrade Guide](../quickstart/fwupgrade.md).

The command is sent at most once per connection. When the device firmware is **newer** than the published release (a development build), neither the notice nor DFU mode is triggered, so a unit under development is never rebooted.

!!! warning "This notice cannot be dismissed"
    The mismatch notice has **no close button**: clicking the backdrop outside it and pressing `ESC` do nothing, and the device cannot be operated further without upgrading. This is deliberate — firmware that does not match the current documentation/tools can behave differently from what is described here.

    There is exactly one way out: upgrade to the latest version and reconnect; if the device has already been upgraded, click **Check Again** in the notice (it re-reads `AT+DEV.FWVER?` and compares again) and it clears itself. **Go to Upgrade** opens the [Bootloader Upgrade Tool](https://akkako.github.io/PPR26_Docs/bootloader/).

!!! note "When the latest version is unavailable"
    Reading the version requires access to this site. If the read fails, a warning is written to the log and the check is skipped — it is never reported as a mismatch.

## User Interface

| Area | Content |
| ---- | ---- |
| **Connect** | Connect / Disconnect / Refresh buttons and connection status |
| **Resistance** | Current **Setpoint** and **Estimated** values, setpoint input, step size input, and step buttons |
| **Limits** | Enable limits switch, minimum and maximum resistance |
| **Output State** | Normal / Open / Short three-state switching |
| **Device Info** | Model, serial number, firmware version, hardware version, production date, compensation mode, applied calibration set, protocol |
| **Log** | Log of traffic between the host tool and the device, useful for troubleshooting |

!!! note "When device data is read"
    The device configuration (output state, setpoint, step size, minimum/maximum limits, etc.) is **read only once, when the connection succeeds**; after that, each operation **sends only the command for that operation**. The only exception is the **estimated resistance**: it cannot be computed locally, so it is read back once more after every output change (setting the resistance, a step, open/short/return to normal). If the device state is changed by other means, click **Refresh** to read all information again.

## Operations

### Setting the Output Resistance

1. Enter a value in the **Resistance → Set value** input box and select a unit (**Ω / kΩ / MΩ**) from the drop-down list on the right; decimals are supported (resolution 1 mΩ).
2. Click **Set**; the device switches to that resistance immediately, and the display area above updates accordingly.

The settable resistance range is **5 Ω ~ 4 MΩ**; if resistance limits are enabled, the value must also fall between the configured minimum and maximum resistances, otherwise the operation is rejected with a message.

### Step Increment and Decrement

1. Set the step size in the **Step** input box (the unit can likewise be Ω / kΩ / MΩ), and click **Set** to save it to the device.
2. Click **− Step** / **+ Step**; the setpoint is decreased or increased by one step. The host tool clamps the result to the allowed range (if it goes out of range, it is set to the boundary value before being sent; no out-of-range command is sent).
3. When the step size is 0, both buttons are disabled.

### Setting Resistance Limits

1. After you check **Enable limits**, the setpoint must fall between the minimum and maximum resistances.
2. Enter values and units in the **Minimum** / **Maximum** input boxes and click **Set** for each to write them to the device. The minimum resistance must not be greater than the maximum resistance.

### Open / Short

In the **Output State** section, click the corresponding button:

- **Open**: the output is high impedance (the estimated value shows "Open").
- **Short**: the output is directly shorted.
- **Normal**: exits open/short and returns to the current **Setpoint**.

Entering open or short does **not change** the setpoint; setting a new resistance directly also returns to normal state automatically.

## Device Info Fields

| Field | Description |
| ---- | ---- |
| Model | Device model, e.g. `PPR26` |
| Serial number | 24-digit hexadecimal device serial number |
| Firmware version / Hardware version | Current application firmware version and hardware version |
| Production date | Format `YY-WW` (last two digits of the year - week number) |
| Compensation mode | Fitting method for the output resistance: `Uncalibrated (UNCAL)` / `Nearby (NEARBY)` / `Precise (PRECISE)` |
| Applied calibration set | Currently effective calibration data: `User (USER)` or `Factory (FACTORY)` (display only on the web page, cannot be changed) |
| Protocol | Current communication protocol, normally `AT` |

## FAQ

**Clicking "Connect Device" does nothing, or it says it is not supported?**

Use Chrome / Edge 109+, and make sure the page is opened over `https://` or the local `http://localhost`. Other browsers (such as Safari and Firefox) do not provide WebSerial.

**PPR26 is not in the device list?**

1. Make sure the device is in AT mode (in SCPI / DFU mode it will not appear in the serial port list).
2. Close other programs occupying the serial port, then click "Connect Device" again.
3. Unplug and replug the USB cable, then try again.

**It says "Failed to open the serial port", or the operation times out?**

This is usually because the serial port is occupied by another program or another browser tab. Close those programs/tabs, refresh the page, and connect again.

**Setting the resistance fails?**

This means the entered value is outside the allowed range (5 Ω ~ 4 MΩ), or outside the currently enabled minimum/maximum limits. Check the input and the limit settings.

**What do `ERROR` and `OVERFLOW` in the log mean?**

- `ERROR`: the device rejected this command, usually because a parameter is out of range or the current state does not allow it (for example, setting limits when limits are not enabled, or an out-of-range resistance).
- `OVERFLOW`: a received command line was too long and exceeded the device buffer. The commands generated by this page are all very short, so this should not normally occur.

Correct the input as prompted and try again; a command that times out without a response is discarded and does not affect subsequent operations.

**What happens if I unplug the USB cable?**

The page automatically returns to the "Disconnected" state and indicates that the device has been disconnected; plug the cable back in and click "Connect Device" again.

## Limitations

- Only **AT mode** is supported; in SCPI mode, use a SCPI host tool.
- **Persistence**: the step size, the minimum/maximum limits and the limits-enable flag, and the compensation mode are saved to the device (retained across power cycles); **the setpoint and the open/short state are not saved** — after the device is powered on again it is open + the default setpoint of 5 Ω, so set them again if needed.
- Only basic resistance control is provided; calibration operations are **not supported** (for calibration, use the dedicated host tool).
- The page **reads the device configuration once on connection** and only sends the corresponding command on each operation (no periodic polling); click **Refresh** when you need to read it again.
- After an output change (setting the resistance, a step, open/short/return to normal), the "Estimated" resistance is read back once; the other configuration items are not read back automatically, so click **Refresh** when needed.
