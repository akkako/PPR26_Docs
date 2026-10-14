# Self-Test Script

Use it to quickly verify that the device functions normally after deployment or maintenance. This page provides Python self-test scripts **for both AT and SCPI modes**; they check, in order, device information, resistance setting, limits, output state, temperature, and user calibration readback, and print a `PASS` / `FAIL` summary.

!!! tip "When to use"
    Quick troubleshooting when bringing up a new device, after a firmware upgrade, or when something seems wrong.

## Self-Test Items

| Item | Description |
| ------ | ---- |
| Connection and identification | Response, model, serial number format, firmware version |
| Resistance setting | Setpoint is set and read back consistently |
| Compensation mode | Set and read back |
| Limits | Set MIN/MAX and enable; an out-of-range setting should be rejected and the value stays unchanged |
| Output state | Open, short, back to normal |
| Temperature | Read the current temperature |
| User calibration | Read the calibration count, date, and current dataset (read-only, no modification) |

## Self-Test Script

Same-named scripts ship with each release: `ppr26_selftest_at.py` (AT) and `ppr26_selftest_scpi.py` (SCPI), see [Tool Downloads and Usage](../../software/downloads.md). They are written on top of the `ppr26_at.py` / `ppr26_scpi.py` wrapper library and, at the end, **automatically write back** the original limits, limits enabled, and compensation mode.

The versions below are **standalone versions that do not depend on the wrapper library**; they need only `pyserial` or `pyvisa` and can be copied and used directly. Their checks of limits, limits enabled, and compensation mode **temporarily rewrite these settings, and they are saved** (retained after power-off); if you need to keep the original state, record the original values first and write them back after the self-test.

=== "AT (USB CDC)"

    ```python
    #!/usr/bin/env python3
    """PPR26 self-test script (AT mode).

    Usage:
        python ppr26_selftest_at.py
        python ppr26_selftest_at.py -p COM12
    Exit code: 0 all passed; 1 there are failed items.
    """

    import argparse
    import sys
    import time

    import serial
    from serial.tools import list_ports

    SN_CHARS = set("0123456789ABCDEF")


    def find_ppr26():
        for p in list_ports.comports():
            if p.vid == 0xFFFE:
                return p.device
        raise RuntimeError("PPR26 not found; make sure the device is in AT mode")


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
            raise TimeoutError("timed out waiting for a response")

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


    class Checker:
        def __init__(self):
            self.passed = 0
            self.failed = 0

        def check(self, name, cond, detail=""):
            if cond:
                self.passed += 1
                print(f"  [PASS] {name:<28} {detail}")
            else:
                self.failed += 1
                print(f"  [FAIL] {name:<28} {detail}")


    def run(dev, ck):
        dev.cmd("AT")
        ck.check("Connection (AT)", True)

        sn = dev.query("AT+DEV.SN?", "DEV.SN")
        ck.check("Serial number 24-digit hex", len(sn) == 24 and set(sn) <= SN_CHARS, sn)
        ck.check("Model == PPR26", dev.query("AT+DEV.MODEL?", "DEV.MODEL") == "PPR26")
        ck.check("Firmware version non-empty", bool(dev.query("AT+DEV.FWVER?", "DEV.FWVER")))

        dev.cmd("AT+RES.LIMIT=0")
        dev.cmd("AT+RES.SP=523000")
        ck.check("Setpoint write/readback", dev.query("AT+RES.SP?", "RES.SP") == "523000")

        dev.cmd("AT+RES.COMP=2")
        ck.check("Compensation mode == 2", dev.query("AT+RES.COMP?", "RES.COMP") == "2")

        dev.cmd("AT+RES.MAX=1000000")
        dev.cmd("AT+RES.MIN=5000")
        dev.cmd("AT+RES.LIMIT=1")
        dev.cmd("AT+RES.SP=100000")
        rejected = False
        try:
            dev.cmd("AT+RES.SP=2000000")
        except IOError:
            rejected = True
        ck.check("Out-of-range setting rejected", rejected)
        ck.check("Value unchanged after out-of-range", dev.query("AT+RES.SP?", "RES.SP") == "100000")
        dev.cmd("AT+RES.LIMIT=0")

        dev.cmd("AT+RES.OPEN=1")
        ck.check("Open -> PV=inf", dev.query("AT+RES.PV?", "RES.PV") == "inf")
        dev.cmd("AT+RES.OPEN=0")
        dev.cmd("AT+RES.SHORT=1")
        ck.check("Short state", dev.query("AT+RES.SHORT?", "RES.SHORT") == "1")
        dev.cmd("AT+RES.SHORT=0")

        temp = dev.query("AT+DEV.TEMP?", "DEV.TEMP")
        ck.check("Temperature readable", temp.lstrip("-").isdigit(), f"{temp} (0.1℃)")

        ck.check("Calibration count readable", dev.query("AT+CALI.COUNT?", "CALI.COUNT").isdigit())
        ck.check("Calibration dataset readable", dev.query("AT+CALI.SEL?", "CALI.SEL") in ("0", "1"))
        date = dev.query("AT+CALI.DATE?", "CALI.DATE")
        ck.check("Calibration date readable", True, date or "(not filled)")


    def main():
        parser = argparse.ArgumentParser(description="PPR26 self-test script (AT)")
        parser.add_argument("-p", "--port", help="serial port, e.g. COM12 (auto-detected if omitted)")
        args = parser.parse_args()

        dev = PPR26(args.port or find_ppr26())
        ck = Checker()
        try:
            run(dev, ck)
        finally:
            dev.close()

        print(f"Result: {ck.passed} passed, {ck.failed} failed")
        return 1 if ck.failed else 0


    if __name__ == "__main__":
        sys.exit(main())
    ```

=== "SCPI (USB TMC)"

    ```python
    #!/usr/bin/env python3
    """PPR26 self-test script (SCPI / USB TMC mode).

    Usage:
        python ppr26_selftest_scpi.py
        python ppr26_selftest_scpi.py -r "USB0::0xFFFE::0xFFFF::<SN>::0::INSTR"
    Exit code: 0 all passed; 1 there are failed items.
    """

    import argparse
    import sys

    import pyvisa

    rm = pyvisa.ResourceManager("@ivi")
    SN_CHARS = set("0123456789ABCDEF")


    def find_ppr26():
        for r in rm.list_resources():
            up = r.upper()
            if "0XFFFE" in up and "0XFFFF" in up:
                return r
        raise RuntimeError("PPR26 not found; make sure the device is in SCPI/TMC mode")


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


    class Checker:
        def __init__(self):
            self.passed = 0
            self.failed = 0

        def check(self, name, cond, detail=""):
            if cond:
                self.passed += 1
                print(f"  [PASS] {name:<28} {detail}")
            else:
                self.failed += 1
                print(f"  [FAIL] {name:<28} {detail}")


    def is_num(text):
        try:
            float(text)
            return True
        except ValueError:
            return False


    def run(dev, ck):
        ck.check("Connection (*IDN?)", "PPR26" in dev.query("*IDN?"))

        sn = dev.query("SYST:INFO:SN?")
        ck.check("Serial number 24-digit hex", len(sn) == 24 and set(sn) <= SN_CHARS, sn)
        ck.check("Model == PPR26", dev.query("SYST:INFO:MOD?") == "PPR26")
        ck.check("Firmware version non-empty", bool(dev.query("SYST:INFO:FVER?")))

        dev.write_checked("RES:LIM:STAT 0")
        dev.write_checked("RES 523000")
        ck.check("Setpoint write/readback", dev.query("RES?") == "523000")

        dev.write_checked("SYST:COMP PREC")
        ck.check("Compensation mode == PRECISE", dev.query("SYST:COMP?") == "PRECISE")

        dev.write_checked("RES:LIM:MAX 1000000")
        dev.write_checked("RES:LIM:MIN 5000")
        dev.write_checked("RES:LIM:STAT 1")
        dev.write_checked("RES 100000")
        dev.write("RES 2000000")
        err = dev.error()
        ck.check("Out-of-range setting rejected", not err.startswith("0,"), err)
        ck.check("Value unchanged after out-of-range", dev.query("RES?") == "100000")
        dev.write_checked("RES:LIM:STAT 0")

        dev.write_checked("OUTP OPEN")
        ck.check("Open state", dev.query("OUTP?") == "OPEN")
        dev.write_checked("OUTP SHOR")
        ck.check("Short state", dev.query("OUTP?") == "SHOR")
        dev.write_checked("OUTP NORM")

        temp = dev.query("SYST:TEMP?")
        ck.check("Temperature readable", is_num(temp), temp)

        ck.check("Calibration count readable", dev.query("CAL:USER:COUN?").isdigit())
        ck.check("Calibration dataset readable", dev.query("CAL:SEL?").upper() in ("USER", "FACTORY"))
        date = dev.query("CAL:USER:DATE?")
        ck.check("Calibration date readable", True, date or "(not filled)")


    def main():
        parser = argparse.ArgumentParser(description="PPR26 self-test script (SCPI)")
        parser.add_argument("-r", "--resource", help="VISA resource (auto-detected if omitted)")
        args = parser.parse_args()

        dev = PPR26(args.resource or find_ppr26())
        ck = Checker()
        try:
            print("Identity:", dev.query("*IDN?"))
            run(dev, ck)
        finally:
            dev.close()

        print(f"Result: {ck.passed} passed, {ck.failed} failed")
        return 1 if ck.failed else 0


    if __name__ == "__main__":
        sys.exit(main())
    ```

## Example Output

```text
  [PASS] Connection (AT)
  [PASS] Serial number 24-digit hex   0123456789ABCDEF01234567
  [PASS] Model == PPR26
  [PASS] Firmware version non-empty   FW 1.0.0
  [PASS] Setpoint write/readback      523000
  [PASS] Compensation mode == 2
  [PASS] Out-of-range setting rejected
  [PASS] Value unchanged after out-of-range 100000
  [PASS] Open -> PV=inf
  [PASS] Short state
  [PASS] Temperature readable         29.1 (0.1℃)
  [PASS] Calibration count readable
  [PASS] Calibration dataset readable 0
  [PASS] Calibration date readable    2026-09-29
Result: 14 passed, 0 failed
```

## Command Reference

| Item | AT | SCPI |
| ------ | -- | ---- |
| Model | `AT+DEV.MODEL?` | `SYST:INFO:MOD?` |
| Serial number | `AT+DEV.SN?` | `SYST:INFO:SN?` |
| Firmware version | `AT+DEV.FWVER?` | `SYST:INFO:FVER?` |
| Setpoint (SP) | `AT+RES.SP=…` / `AT+RES.SP?` | `RES …` / `RES?` |
| Compensation mode | `AT+RES.COMP` | `SYST:COMP` |
| Limits | `AT+RES.MIN/MAX/LIMIT` | `RES:LIM:MIN/MAX/STAT` |
| Open / short | `AT+RES.OPEN/SHORT` | `OUTP OPEN` / `OUTP SHOR` |
| Temperature | `AT+DEV.TEMP?` | `SYST:TEMP?` |
| Calibration count / date / dataset | `AT+CALI.COUNT?` / `AT+CALI.DATE?` / `AT+CALI.SEL?` | `CAL:USER:COUN?` / `CAL:USER:DATE?` / `CAL:SEL?` |

For more commands, see the [AT Command Reference](../at.md) and the [SCPI Command Reference](../scpi.md); for the Python communication wrappers of the two protocols, see the [AT Python Example](../python_at.md) and the [SCPI Python Example](../python_scpi.md).
