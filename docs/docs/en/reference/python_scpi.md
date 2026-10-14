# SCPI Python Example

To communicate with the PPR26 using SCPI, first configure the PPR26 to work in **USB-TMC mode**; the PC then enumerates it as a USB TMC device.

!!! warning "Caution"
    USB TMC devices require the corresponding driver; otherwise USB enumeration fails because no driver is available.

    This page recommends **NI-VISA**; the examples below are all written against the NI-VISA backend.

This page uses the `pyvisa` library for USB TMC communication. For the complete SCPI command reference, see [SCPI Command Reference](scpi.md).

!!! tip "Scripts provided with each release"
    The `ppr26_scpi.py` shipped with each release already wraps all SCPI commands covered on this page (it checks the error queue automatically after each write) and can be run directly to print device information and output state; a SCPI self-test script, `ppr26_selftest_scpi.py`, is provided as well. See [Tool Downloads and Usage](../software/downloads.md).

## Environment Setup

1. Install the **NI-VISA** driver (download it from the NI website).
2. Install `pyvisa`:

   ```bash
   pip install pyvisa
   ```

- The transport is USBTMC and commands end with a line feed `<LF>` (`\n`).
- In USB TMC mode the device VID:PID is `0xFFFE:0xFFFF`; the resource string looks like
  `USB0::0xFFFE::0xFFFF::<serial>::0::INSTR`.

## Connecting the Device

```python
import pyvisa

rm = pyvisa.ResourceManager("@ivi")     # Use the NI-VISA backend

def find_ppr26():
    for r in rm.list_resources():
        up = r.upper()
        if "0XFFFE" in up and "0XFFFF" in up:
            return r
    raise RuntimeError("PPR26 not found, make sure the device is in SCPI/TMC mode")
```

!!! tip "When auto-detection does not find the device"
    NI-VISA's auto-detection **may not list this device**. If `find_ppr26()` does not find a resource, open the device directly with an **explicit resource string**:

    ```python
    dev = PPR26("USB0::0xFFFE::0xFFFF::<serial>::0::INSTR")
    ```

    Here `<serial>` is the device serial number (24 hexadecimal digits; look it up with `SYST:INFO:SN?` or the upgrade tool's `--info`).

## Basic Send/Receive Wrapper

The class below wraps "send command / send query / read the error queue"; all later examples are built on it:

```python
class PPR26:
    def __init__(self, resource, timeout_ms=2000):
        self.inst = rm.open_resource(resource)
        self.inst.timeout = timeout_ms
        self.inst.write_termination = "\n"
        self.inst.read_termination = "\n"

    def close(self):
        self.inst.close()

    def write(self, cmd):
        self.inst.write(cmd)

    def query(self, cmd):
        return self.inst.query(cmd).strip().strip('"')

    def error(self):
        """Read the head of the error queue; returns '0,"No error"' when there are no errors."""
        return self.inst.query("SYST:ERR?").strip()

    def write_checked(self, cmd):
        """Send a command and raise an exception on error."""
        self.inst.write(cmd)
        err = self.error()
        if not err.startswith("0,"):
            raise IOError(f"{cmd} -> {err}")
```

## Common Operations

### Identification and Device Information

```python
dev = PPR26(find_ppr26())

print("ID         :", dev.query("*IDN?"))            # akaInstruments,PPR26,<SN>,<FW>
print("Model      :", dev.query("SYST:INFO:MOD?"))
print("SN         :", dev.query("SYST:INFO:SN?"))
print("Firmware   :", dev.query("SYST:INFO:FVER?"))
print("Hardware   :", dev.query("SYST:INFO:HVER?"))
print("Prod date  :", dev.query("SYST:INFO:MAN?"))
print("Power-ons  :", dev.query("SYST:INFO:POW?"))
print("Uptime(min):", dev.query("SYST:INFO:TIME?"))
```

### Temperature Measurement

The temperature unit is °C (0.1 °C resolution).

```python
print("Current temperature:", dev.query("SYST:TEMP?"), "℃")
print("Average temperature:", dev.query("SYST:TEMP:AVER?"), "℃")
print("Minimum temperature:", dev.query("SYST:TEMP:MIN?"), "℃")
print("Maximum temperature:", dev.query("SYST:TEMP:MAX?"), "℃")
dev.write("SYST:TEMP:RES")                     # Clear statistics
```

### Entering DFU Mode (Firmware Upgrade)

```python
dev.write("SYST:DFU")                          # The device disconnects USB immediately and re-enumerates as a DFU device
```

Because the device disconnects immediately, the command has no readable response; the success criterion is **whether the device re-enumerates as `PPR26 WinUSB DFU`**. For upgrade steps, see [Firmware Upgrade Guide](../quickstart/fwupgrade.md).

### Setting the Output Resistance

The resistance unit is **milliohms (mΩ)**; the range is **5 Ω ~ 4 MΩ**. Command keywords are case-insensitive.

```python
dev.write_checked("RES 523000")                # 523 Ω
print("Setpoint (mΩ):", dev.query("RES?"))

dev.write_checked("RES:STEP 10000")            # Step 10 Ω
dev.write_checked("RES UP")                    # Current value + step
dev.write_checked("RES DOWN")                  # Current value - step
print("Setpoint (mΩ):", dev.query("RES?"))
```

### Output State (Normal / Open / Short)

```python
dev.write_checked("OUTP NORM")                 # Resistance network output
dev.write_checked("OUTP OPEN")                 # Open
dev.write_checked("OUTP SHOR")                 # Direct short
print("Output state:", dev.query("OUTP?"))     # NORM / OPEN / SHOR
```

### Limits (Minimum / Maximum Resistance, Limits Enabled)

```python
dev.write_checked("RES:LIM:MAX 1000000")       # 1 kΩ
dev.write_checked("RES:LIM:MIN 5000")          # 5 Ω
dev.write_checked("RES:LIM:STAT 1")            # Enable limits

# Values outside the limits raise an error and enter the error queue, and the current value is unchanged
dev.inst.write("RES 2000000")
print("Error:", dev.error())                    # e.g. -902,"Resistance value out of limit range"
```

### Compensation Mode and Relay Network

```python
dev.write_checked("SYST:COMP PREC")            # UNCAL / NEAR / PREC
print("Compensation mode:", dev.query("SYST:COMP?"))    # UNCAL / NEARBY / PRECISE

dev.write_checked("RES:NETW 0")                # 26-bit relay bitmap 0..67108863
print("Relay network:", dev.query("RES:NETW?"))
```

### User Password

The password is at most 64 bytes; setting a password also puts the user dataset into the **locked** state (an empty string clears the password and unlocks it), and the dataset must be unlocked before calibration data can be written. Password commands are valid only for the `USER` dataset. Setting/clearing the password only requires the dataset to be unlocked and is independent of `CAL:ENAB`.

```python
dev.write_checked('CAL:USER:PASS "1234"')      # Set the password (empty string = clear and unlock)
print("Password set:", dev.query("CAL:USER:PASS?"))   # 0 / 1
dev.write_checked('CAL:USER:UNL "1234"')       # Unlock
```

### User Calibration

User calibration procedure: **select the user dataset → enter calibration mode → (unlock) → write the measured resistance gear by gear → fill in the date/note → save → exit calibration mode**.

Writes (`VAL`/`DATE`/`STR`/`SAVE`) require: `CAL:ENAB 1` and an unlocked user dataset; changing or clearing the password only requires the dataset to be unlocked (independent of `CAL:ENAB`). The unlocked state is valid only in the current power-on session; to make it persist across power cycles, run `CAL:USER:SAV` once after unlocking.

!!! note "Two calibration datasets"
    The device stores two sets of data: **user calibration** (`USER`) and **factory calibration** (`FACTORY`); `CAL:SEL` determines which set the device uses for output. Factory calibration data is locked by default and there is no user method to modify it, so user calibration never affects factory data; use the user dataset for routine calibration.

```python
dev.write_checked("CAL:SEL USER")              # Select the user dataset (USER / FACT)
dev.write_checked("CAL:ENAB 1")                # Enter calibration mode
dev.write_checked('CAL:USER:UNL "1234"')       # Unlock (use CAL:USER:UNL "" when no password is set)

# measurements: {gear: measured resistance (mΩ)}, obtained by measuring each gear with the reference instrument
measurements = {0: 100, 1: 200, 26: 50, 27: 8}
for gear, mohm in measurements.items():
    dev.write_checked(f"CAL:USER:GEAR {gear}")  # Select the gear (also switches the relays)
    dev.write_checked(f"CAL:USER:VAL {mohm}")   # Write the measured value for this gear

dev.write_checked('CAL:USER:DATE "2026-09-29"')
dev.write_checked('CAL:USER:STR "user-cal"')

print("Calibration count (before save):", dev.query("CAL:USER:COUN?"))
dev.write_checked("CAL:USER:SAVE")              # Save: calibration count +1, record temperature, write to storage
print("Calibration count (after save):", dev.query("CAL:USER:COUN?"))
print("Temperature at calibration:", dev.query("CAL:USER:TEMP?"), "℃")

dev.write_checked("CAL:ENAB 0")                 # Exit calibration mode
```

!!! warning "Caution"
    Improper calibration will degrade output accuracy and reliability; measure each gear with a reference standard before writing the values.

## Complete Example Script

```python
import pyvisa

rm = pyvisa.ResourceManager("@ivi")


def find_ppr26():
    for r in rm.list_resources():
        up = r.upper()
        if "0XFFFE" in up and "0XFFFF" in up:
            return r
    raise RuntimeError("PPR26 not found, make sure the device is in SCPI/TMC mode")


class PPR26:
    def __init__(self, resource, timeout_ms=2000):
        self.inst = rm.open_resource(resource)
        self.inst.timeout = timeout_ms
        self.inst.write_termination = "\n"
        self.inst.read_termination = "\n"

    def close(self):
        self.inst.close()

    def write(self, cmd):
        self.inst.write(cmd)

    def query(self, cmd):
        return self.inst.query(cmd).strip().strip('"')

    def error(self):
        return self.inst.query("SYST:ERR?").strip()

    def write_checked(self, cmd):
        self.inst.write(cmd)
        err = self.error()
        if not err.startswith("0,"):
            raise IOError(f"{cmd} -> {err}")


def main():
    dev = PPR26(find_ppr26())
    try:
        print("ID         :", dev.query("*IDN?"))
        print("Temperature:", dev.query("SYST:TEMP?"), "℃")

        # Resistance limits
        dev.write_checked("RES:LIM:MAX 1000000")
        dev.write_checked("RES:LIM:MIN 5000")
        dev.write_checked("RES:LIM:STAT 1")

        # Output
        dev.write_checked("SYST:COMP PREC")
        dev.write_checked("OUTP NORM")
        dev.write_checked("RES 523000")
        print("Setpoint (mΩ):", dev.query("RES?"))

        dev.write_checked("OUTP OPEN")
        dev.write_checked("OUTP NORM")

        # User calibration
        dev.write_checked("CAL:ENAB 1")
        dev.write_checked('CAL:USER:UNL "1234"')
        for gear, mohm in {0: 100, 1: 200, 27: 8}.items():
            dev.write_checked(f"CAL:USER:GEAR {gear}")
            dev.write_checked(f"CAL:USER:VAL {mohm}")
        dev.write_checked('CAL:USER:DATE "2026-09-29"')
        dev.write_checked("CAL:USER:SAVE")
        dev.write_checked("CAL:ENAB 0")
    finally:
        dev.close()


if __name__ == "__main__":
    main()
```

## Notes

- Resistance-related commands always use mΩ; out-of-range values return an error code and leave the current value unchanged.
- **Persistence**: the protocol, step size, limits and enable flag, compensation mode, dataset selection, and power-on statistics are saved (written immediately when set); the **setpoint** (`RES`), the **output state** (`OUTP`), and the relay bitmap (`RES:NETW`) are runtime state and are not written to storage — after a power cycle the device is open + the default setpoint 5 Ω; `*SAV` does not save the setpoint either.
- Writing calibration data requires `CAL:ENAB 1` and an unlocked user dataset; changing/clearing the password only requires the dataset to be unlocked.
- On error the device does not report spontaneously; read the error queue with `SYST:ERR?`. It is recommended to check once after each set command.
- `SYST:PROT AT` switches to AT mode and re-enumerates USB; after that, use `pyserial` for communication.
- A given VISA resource can only be used by one program at a time; avoid concurrent access from multiple processes.
