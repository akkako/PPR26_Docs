# AT Python Example

To communicate with the PPR26 using AT commands, first configure the PPR26 to work in **USB-CDC mode**; the PC then enumerates it as a USB CDC virtual serial port device.

!!! tip "Tip"
    When connecting to a PC over USB CDC, the operating system usually has a built-in driver, so no manual driver installation is required.

This page uses the `pyserial` library for USB CDC communication. For the complete AT command reference, see [AT Command Reference](at.md).

!!! tip "Ready-made wrapper library"
    The [`ppr26_at.py`](https://github.com/akkako/PPR26_Docs/releases/latest/download/ppr26_at.py) shipped with each release already wraps all AT commands (including range checking and exception handling) and can be imported directly; the examples on this page explain the communication details so you can trim them as needed. For download and usage, see [Tool Downloads and Usage](../software/downloads.md).

## Environment Setup

```bash
pip install pyserial
```

- Serial parameters: `115200`, `8` data bits, no parity, `1` stop bit.
- Each command ends with `\r\n`; the device ends its response with `OK` / `ERROR` (a command longer than 256 bytes returns `OVERFLOW`).

## Connecting the Device

In USB CDC mode the device VID:PID is `0xFFFE:0xFFFE`, which can be used to find the serial port automatically:

```python
from serial.tools import list_ports

def find_ppr26():
    for p in list_ports.comports():
        if p.vid == 0xFFFE:
            return p.device
    raise RuntimeError("PPR26 not found, make sure the device is in AT mode")
```

## Basic Send/Receive Wrapper

The class below wraps the two basic operations "send command / send query"; all later examples are built on it:

```python
import time
import serial

class PPR26:
    def __init__(self, port, timeout=1.0):
        self.ser = serial.Serial(port, 115200, timeout=timeout)
        self.timeout = timeout

    def close(self):
        self.ser.close()

    def _read_line(self, deadline):
        while time.monotonic() < deadline:
            line = self.ser.readline().decode("ascii", "replace").strip()
            if line:
                return line
        raise TimeoutError("Timed out waiting for a response")

    def cmd(self, text):
        """Send a set/execute command; return True on success, raise on failure."""
        self.ser.reset_input_buffer()
        self.ser.write((text + "\r\n").encode("ascii"))
        deadline = time.monotonic() + self.timeout
        while True:
            line = self._read_line(deadline)
            if line == "OK":
                return True
            if line == "ERROR":
                raise IOError(f"{text} -> ERROR")

    def query(self, text, name):
        """Send a query command; return the value from +<name>=<value>."""
        self.ser.reset_input_buffer()
        self.ser.write((text + "\r\n").encode("ascii"))
        prefix = "+" + name + "="
        deadline = time.monotonic() + self.timeout
        while True:
            line = self._read_line(deadline)
            if line == "ERROR":
                raise IOError(f"{text} -> ERROR")
            if line.startswith(prefix):
                return line[len(prefix):]
```

## Common Operations

### Connection Test and Device Information

```python
dev = PPR26(find_ppr26())

dev.cmd("AT")                                  # Connection test
print("Model      :", dev.query("AT+DEV.MODEL?", "DEV.MODEL"))
print("SN         :", dev.query("AT+DEV.SN?", "DEV.SN"))
print("Firmware   :", dev.query("AT+DEV.FWVER?", "DEV.FWVER"))
print("Hardware   :", dev.query("AT+DEV.HWVER?", "DEV.HWVER"))
print("Prod date  :", dev.query("AT+DEV.PROD?", "DEV.PROD"))
print("Power-ons  :", dev.query("AT+DEV.POWERON?", "DEV.POWERON"))
print("Uptime(min):", dev.query("AT+DEV.UPTIME?", "DEV.UPTIME"))
```

### Temperature Measurement

The temperature unit is **0.1 °C** (`291` means 29.1 °C).

```python
temp = int(dev.query("AT+DEV.TEMP?", "DEV.TEMP")) / 10.0
print(f"Current temperature: {temp:.1f} ℃")

cur, tmin, tavg, tmax, count = dev.query("AT+DEV.TSTAT?", "DEV.TSTAT").split(",")
print(f"Statistics: current={int(cur)/10:.1f} min={int(tmin)/10:.1f} "
      f"avg={int(tavg)/10:.1f} max={int(tmax)/10:.1f} count={count}")

dev.cmd("AT+DEV.TCLR")                          # Clear statistics
```

### Entering DFU Mode (Firmware Upgrade)

```python
dev.cmd("AT+DEV.DFU")                           # The device replies OK first, then disconnects USB and re-enumerates as a DFU device
```

The device **returns `OK` first and then disconnects**, but this `OK` often does not reach the host tool in time, so the call may end with a timeout exception — this is normal; the success criterion is **whether the device re-enumerates as `PPR26 WinUSB DFU`**. If necessary, catch and ignore that timeout. For upgrade steps, see [Firmware Upgrade Guide](../quickstart/fwupgrade.md).

### Setting the Output Resistance

The resistance unit is **milliohms (mΩ)**; the range is **5 Ω ~ 4 MΩ**.

```python
dev.cmd("AT+RES.SP=523000")                     # 523 Ω
print("Setpoint (mΩ):", dev.query("AT+RES.SP?", "RES.SP"))
print("Estimated resistance (mΩ):", dev.query("AT+RES.PV?", "RES.PV"))
```

### Output State (Open / Short / Return to Normal)

```python
dev.cmd("AT+RES.OPEN=1")                        # Open (PV returns inf)
dev.cmd("AT+RES.SHORT=1")                       # Direct short
dev.cmd("AT+RES.SHORT=0")
dev.cmd("AT+RES.OPEN=0")                        # Return to normal (back to the setpoint)
```

### Step Size and Compensation Mode

> In AT mode there are no UP/DOWN commands; the step size is used for local calculations in the host tool.

```python
dev.cmd("AT+RES.STEP=10000")                    # Step 10 Ω
step = int(dev.query("AT+RES.STEP?", "RES.STEP"))
sp = int(dev.query("AT+RES.SP?", "RES.SP"))
dev.cmd(f"AT+RES.SP={sp + step}")               # Manually advance one step

dev.cmd("AT+RES.COMP=2")                        # 0=Uncalibrated 1=Nearby 2=Precise
```

### Limits (Minimum / Maximum Resistance, Limits Enabled)

```python
dev.cmd("AT+RES.MIN=5000")                      # 5 Ω
dev.cmd("AT+RES.MAX=1000000")                   # 1 kΩ
dev.cmd("AT+RES.LIMIT=1")                       # Enable limits: the setpoint must be within [MIN, MAX]

# Values outside the limits return ERROR and leave the current value unchanged
try:
    dev.cmd("AT+RES.SP=2000000")
except IOError as e:
    print("Set rejected:", e)
```

### User Password

The password is at most 64 bytes; setting a password also puts the user dataset into the **locked** state (an empty string clears the password and unlocks it), and the dataset must be unlocked before calibration data can be written. Password commands are valid only for the `USER` dataset: select it first with `AT+CALI.SEL=0`; when `FACTORY` is selected, both reads and writes return `ERROR`.

```python
dev.cmd("AT+CALI.PASS=1234")                    # Set the password (empty string = clear and unlock)
print("Password set:", dev.query("AT+CALI.PASS?", "CALI.PASS"))   # 0/1
```

### User Calibration

User calibration procedure: **select the user dataset → enter calibration mode → (unlock) → write the measured resistance gear by gear → fill in the date/note → save → exit calibration mode**.

Writes (`VAL`/`DATE`/`STR`/`SAVE`) require: `AT+CALI.ENAB=1` and an unlocked user dataset; changing or clearing the password only requires the dataset to be unlocked (independent of `ENAB`). The unlocked state is valid only in the current power-on session; to make it persist across power cycles, run `AT+CALI.SAVE` once after unlocking.

!!! note "Two calibration datasets"
    The device stores two sets of data: **user calibration** (`USER`, `AT+CALI.SEL=0`) and **factory calibration** (`FACTORY`, `AT+CALI.SEL=1`); `AT+CALI.SEL` determines which set the device uses for output. Factory calibration data is locked by default and there is no user method to modify it, so user calibration never affects factory data; use the user dataset for routine calibration.

```python
CALI_GEAR_NUM = 28   # 0..25 single resistor, 26 series short, 27 direct short

dev.cmd("AT+CALI.SEL=0")                        # Select the user dataset (0=USER, 1=FACTORY)
dev.cmd("AT+CALI.ENAB=1")                       # Enter calibration mode
dev.cmd("AT+CALI.UNL=1234")                     # Unlock (use AT+CALI.UNL= when no password is set)

# measurements: {gear: measured resistance (mΩ)}, obtained by measuring each gear with the reference instrument
measurements = {0: 100, 1: 200, 26: 50, 27: 8}
for gear, mohm in measurements.items():
    dev.cmd(f"AT+CALI.GEAR={gear}")             # Select the gear (also switches the relays)
    dev.cmd(f"AT+CALI.VAL={mohm}")              # Write the measured value for this gear

dev.cmd("AT+CALI.DATE=2026-09-29")
dev.cmd("AT+CALI.STR=user-cal")

print("Calibration count (before save):", dev.query("AT+CALI.COUNT?", "CALI.COUNT"))
dev.cmd("AT+CALI.SAVE")                         # Save: calibration count +1, record temperature, write to storage
print("Calibration count (after save):", dev.query("AT+CALI.COUNT?", "CALI.COUNT"))
print("Temperature at calibration:", dev.query("AT+CALI.TEMP?", "CALI.TEMP"), "℃")

dev.cmd("AT+CALI.ENAB=0")                       # Exit calibration mode
```

!!! warning "Caution"
    Improper calibration will degrade output accuracy and reliability; measure each gear with a reference standard before writing the values.

## Complete Example Script

```python
import time
import serial
from serial.tools import list_ports


def find_ppr26():
    for p in list_ports.comports():
        if p.vid == 0xFFFE:
            return p.device
    raise RuntimeError("PPR26 not found, make sure the device is in AT mode")


class PPR26:
    def __init__(self, port, timeout=1.0):
        self.ser = serial.Serial(port, 115200, timeout=timeout)
        self.timeout = timeout

    def close(self):
        self.ser.close()

    def _read_line(self, deadline):
        while time.monotonic() < deadline:
            line = self.ser.readline().decode("ascii", "replace").strip()
            if line:
                return line
        raise TimeoutError("Timed out waiting for a response")

    def cmd(self, text):
        self.ser.reset_input_buffer()
        self.ser.write((text + "\r\n").encode("ascii"))
        deadline = time.monotonic() + self.timeout
        while True:
            line = self._read_line(deadline)
            if line == "OK":
                return True
            if line == "ERROR":
                raise IOError(f"{text} -> ERROR")

    def query(self, text, name):
        self.ser.reset_input_buffer()
        self.ser.write((text + "\r\n").encode("ascii"))
        prefix = "+" + name + "="
        deadline = time.monotonic() + self.timeout
        while True:
            line = self._read_line(deadline)
            if line == "ERROR":
                raise IOError(f"{text} -> ERROR")
            if line.startswith(prefix):
                return line[len(prefix):]


def main():
    dev = PPR26(find_ppr26())
    try:
        # Device information
        dev.cmd("AT")
        print("Model      :", dev.query("AT+DEV.MODEL?", "DEV.MODEL"))
        print("SN         :", dev.query("AT+DEV.SN?", "DEV.SN"))
        print("Temperature:", int(dev.query("AT+DEV.TEMP?", "DEV.TEMP")) / 10.0, "℃")

        # Resistance limits
        dev.cmd("AT+RES.MIN=5000")
        dev.cmd("AT+RES.MAX=1000000")
        dev.cmd("AT+RES.LIMIT=1")

        # Output
        dev.cmd("AT+RES.COMP=2")
        dev.cmd("AT+RES.SP=523000")
        print("Setpoint (mΩ):", dev.query("AT+RES.SP?", "RES.SP"))
        print("Estimated resistance (mΩ):", dev.query("AT+RES.PV?", "RES.PV"))

        dev.cmd("AT+RES.OPEN=1")
        dev.cmd("AT+RES.OPEN=0")

        # User calibration
        dev.cmd("AT+CALI.ENAB=1")
        dev.cmd("AT+CALI.UNL=1234")
        for gear, mohm in {0: 100, 1: 200, 27: 8}.items():
            dev.cmd(f"AT+CALI.GEAR={gear}")
            dev.cmd(f"AT+CALI.VAL={mohm}")
        dev.cmd("AT+CALI.DATE=2026-09-29")
        dev.cmd("AT+CALI.SAVE")
        dev.cmd("AT+CALI.ENAB=0")
    finally:
        dev.close()


if __name__ == "__main__":
    main()
```

## Notes

- Resistance-related commands always use mΩ; out-of-range values return `ERROR` and leave the current value unchanged.
- **Persistence**: the protocol, step size, limits and enable flag, compensation mode, dataset selection, and power-on statistics are saved (written immediately when set); the **setpoint** (`AT+RES.SP`), the **output state** (`AT+RES.OPEN`/`AT+RES.SHORT`), and the relay bitmap (`AT+RES.NETW`) are runtime state and are not written to storage — after a power cycle the device is open + the default setpoint 5 Ω.
- Writing calibration data requires `AT+CALI.ENAB=1` and an unlocked user dataset; changing/clearing the password only requires the dataset to be unlocked.
- `AT+SYS.PROT=1` switches to SCPI mode and re-enumerates USB; after that, use PyVISA for communication.
- A single command must not exceed 256 bytes; parameters are at most 64 bytes long.
