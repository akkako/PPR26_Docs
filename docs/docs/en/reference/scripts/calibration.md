# User Calibration Script

PPR26 supports user calibration, which corrects the deviation of the output resistance. This page provides ready-to-use Python calibration scripts (**for both AT and SCPI modes**) and explains the calibration procedure and cautions.

!!! warning "Caution"
    Improper calibration reduces output accuracy and reliability; perform it only when a reference standard (such as a high-accuracy digital multimeter) is available. The scripts on this page operate only on user calibration data (select the `USER` dataset first).

## Calibration Principle

The device stores calibration resistance values separately by **gear**; the host tool measures the actual output gear by gear and writes the measured resistance into the corresponding gear:

| Gear      | Meaning                                          |
| --------- | ------------------------------------------------ |
| `0`..`25` | Single resistor (closes the corresponding relay) |
| `26`      | Series short                                     |
| `27`      | Direct short                                     |

## Prerequisites

- **Reference instrument**: resolution and accuracy should be one order of magnitude better than the target accuracy.
- Let the device warm up fully and keep the ambient temperature stable.
- Close other programs that occupy the device.
- Dependencies:
  - AT mode (USB CDC): `pip install pyserial`
  - SCPI mode (USB TMC): install the NI‑VISA driver, `pip install pyvisa`

## Calibration Procedure

Command reference for the two modes:

| Step | AT command | SCPI command |
| ---- | ---------- | ------------ |
| 0. Select the user dataset | `AT+CALI.SEL=0` | `CAL:SEL USER` |
| 1. Enter calibration mode | `AT+CALI.ENAB=1` | `CAL:ENAB 1` |
| 2. Unlock | `AT+CALI.UNL=<password>` | `CAL:USER:UNL "<password>"` |
| 3. Write gear by gear | `AT+CALI.GEAR=n` → `AT+CALI.VAL=<measured mΩ>` | `CAL:USER:GEAR n` → `CAL:USER:VAL <measured mΩ>` |
| 4. Date / note | `AT+CALI.DATE=...` / `AT+CALI.STR=...` | `CAL:USER:DATE "..."` / `CAL:USER:STR "..."` |
| 5. Save | `AT+CALI.SAVE` | `CAL:USER:SAVE` |
| 6. Exit | `AT+CALI.ENAB=0` | `CAL:ENAB 0` |

!!! note "The dataset selection is saved"
    `AT+CALI.SEL` / `CAL:SEL` selects the dataset that is **currently in effect and accepts edits**; the selection is **saved immediately** (retained after power-off) and determines which set of data the device uses to output resistance:

    - Before exporting or writing, select `USER` first (`AT+CALI.SEL=0` / `CAL:SEL USER`);
    - At the end of the script, restore the selection to the original dataset, otherwise the device will keep outputting according to the new selection;
    - If `FACTORY` is currently selected, read commands in AT mode also return **factory data**; do not write in that state.

!!! note "Write protection"
    `VAL` / `DATE` / `STR` / `SAVE` can only be written when calibration is **enabled** (`ENAB=1`) and **not locked**; otherwise they return an error (`-907` for SCPI). Setting or clearing the user password (`AT+CALI.PASS` / `CAL:USER:PASS`) is the exception: it only requires the dataset to be **not locked**, regardless of `ENAB`, and the `USER` dataset must be selected first. When no password is set, the unlock command accepts an empty password: for AT write `AT+CALI.UNL=`, for SCPI you must write an empty string `CAL:USER:UNL ""` (a bare command returns `-109` for a missing parameter).

!!! note "Two calibration datasets"
    The device also has a set of **factory calibration** data (`AT+CALI.SEL=1` / `CAL:SEL FACT` switches it into effect), for which no user modification method is provided. It is **locked** by default, and the factory password required to unlock it is not disclosed; therefore, as long as `USER` stays selected, **user calibration does not affect factory data**. The scripts in this page operate only on user calibration data.

## Calibration Script

Save the scripts below as `ppr26_calibrate.py` (AT) or `ppr26_calibrate_scpi.py` (SCPI) respectively. `MEASURED` holds the measured result for each gear (`{gear: measured resistance (mΩ)}`); gears not listed are not written.

=== "AT (USB CDC)"

    ```python
    #!/usr/bin/env python3
    """PPR26 user calibration script (AT mode).

    Usage:
        python ppr26_calibrate.py                    # use the MEASURED table in the script
        python ppr26_calibrate.py -p COM12           # specify the serial port
        python ppr26_calibrate.py --password 1234    # specify the user password (empty if not set)
        python ppr26_calibrate.py --export out.csv   # export the current value of each gear
    """

    import argparse
    import csv
    import datetime
    import sys
    import time

    import serial
    from serial.tools import list_ports

    # {gear: measured resistance (mΩ)}: obtained by measuring each gear with the reference instrument
    MEASURED = {
        # 0: 100,
        # 1: 200,
        # 27: 8,
    }

    GEAR_NUM = 28


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


    def calibrate(dev, measured, password):
        """Write the measured resistance of each gear into the user calibration data and save it."""
        dev.cmd("AT+CALI.SEL=0")            # select the user dataset
        dev.cmd("AT+CALI.ENAB=1")
        dev.cmd("AT+CALI.UNL=" + password)
        for gear, mohm in sorted(measured.items()):
            dev.cmd(f"AT+CALI.GEAR={gear}")
            dev.cmd(f"AT+CALI.VAL={int(mohm)}")
        dev.cmd("AT+CALI.DATE=" + datetime.date.today().isoformat())
        dev.cmd("AT+CALI.STR=user-cal")
        dev.cmd("AT+CALI.SAVE")
        dev.cmd("AT+CALI.ENAB=0")
        print("Wrote {} gears, calibration count = {}".format(
            len(measured), dev.query("AT+CALI.COUNT?", "CALI.COUNT")))


    def export(dev, path):
        """Export the current calibration value of each gear to CSV."""
        rows = []
        for gear in range(GEAR_NUM):
            dev.cmd(f"AT+CALI.GEAR={gear}")
            rows.append((gear, int(dev.query("AT+CALI.VAL?", "CALI.VAL"))))
        with open(path, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.writer(f)
            writer.writerow(["gear", "resistance_mohm"])
            writer.writerows(rows)
        print(f"Exported to {path}")


    def main():
        parser = argparse.ArgumentParser(description="PPR26 user calibration script (AT)")
        parser.add_argument("-p", "--port", help="serial port, e.g. COM12 (auto-detected if omitted)")
        parser.add_argument("--password", default="", help="user calibration password (empty by default)")
        parser.add_argument("--export", metavar="CSV", help="export the current value of each gear to CSV and exit")
        args = parser.parse_args()

        dev = PPR26(args.port or find_ppr26())
        try:
            dev.cmd("AT")
            if args.export:
                export(dev, args.export)
                return 0
            if not MEASURED:
                print("Please fill in MEASURED in the script first ({gear: measured resistance mΩ})")
                return 1
            calibrate(dev, MEASURED, args.password)
            return 0
        finally:
            dev.close()


    if __name__ == "__main__":
        sys.exit(main())
    ```

=== "SCPI (USB TMC)"

    ```python
    #!/usr/bin/env python3
    """PPR26 user calibration script (SCPI / USB TMC mode).

    Usage:
        python ppr26_calibrate_scpi.py
        python ppr26_calibrate_scpi.py -r "USB0::0xFFFE::0xFFFF::<SN>::0::INSTR"
        python ppr26_calibrate_scpi.py --password 1234
        python ppr26_calibrate_scpi.py --export out.csv
    """

    import argparse
    import csv
    import datetime
    import sys

    import pyvisa

    rm = pyvisa.ResourceManager("@ivi")

    # {gear: measured resistance (mΩ)}: obtained by measuring each gear with the reference instrument
    MEASURED = {
        # 0: 100,
        # 1: 200,
        # 27: 8,
    }

    GEAR_NUM = 28


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


    def calibrate(dev, measured, password):
        """Write the measured resistance of each gear into the user calibration data and save it."""
        dev.write_checked("CAL:SEL USER")   # select the user dataset
        dev.write_checked("CAL:ENAB 1")
        dev.write_checked('CAL:USER:UNL "{}"'.format(password))
        for gear, mohm in sorted(measured.items()):
            dev.write_checked(f"CAL:USER:GEAR {gear}")
            dev.write_checked(f"CAL:USER:VAL {int(mohm)}")
        dev.write_checked('CAL:USER:DATE "{}"'.format(datetime.date.today().isoformat()))
        dev.write_checked('CAL:USER:STR "user-cal"')
        dev.write_checked("CAL:USER:SAVE")
        dev.write_checked("CAL:ENAB 0")
        print("Wrote {} gears, calibration count = {}".format(
            len(measured), dev.query("CAL:USER:COUN?")))


    def export(dev, path):
        """Export the current calibration value of each gear to CSV."""
        rows = []
        for gear in range(GEAR_NUM):
            dev.write_checked(f"CAL:USER:GEAR {gear}")
            rows.append((gear, int(dev.query("CAL:USER:VAL?"))))
        with open(path, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.writer(f)
            writer.writerow(["gear", "resistance_mohm"])
            writer.writerows(rows)
        print(f"Exported to {path}")


    def main():
        parser = argparse.ArgumentParser(description="PPR26 user calibration script (SCPI)")
        parser.add_argument("-r", "--resource", help="VISA resource (auto-detected if omitted)")
        parser.add_argument("--password", default="", help="user calibration password (empty by default)")
        parser.add_argument("--export", metavar="CSV", help="export the current value of each gear to CSV and exit")
        args = parser.parse_args()

        dev = PPR26(args.resource or find_ppr26())
        try:
            print("Identity:", dev.query("*IDN?"))
            if args.export:
                export(dev, args.export)
                return 0
            if not MEASURED:
                print("Please fill in MEASURED in the script first ({gear: measured resistance mΩ})")
                return 1
            calibrate(dev, MEASURED, args.password)
            return 0
        finally:
            dev.close()


    if __name__ == "__main__":
        sys.exit(main())
    ```

## Notes

- Gears not listed in `MEASURED` keep their original values unchanged.
- `--export` reads the current value gear by gear: querying a gear's resistance requires switching relays (`AT+CALI.GEAR` / `CAL:USER:GEAR` **actually drive the relays**), so the resistance at the output terminals changes during export; disconnect the load under test first. Export only reads calibration data and does not modify the stored contents.
- The script switches the dataset selection (and saves it immediately), so before and after running, confirm that the device has the expected dataset selected (recording it with `AT+CALI.SEL?` / `CAL:SEL?` and restoring it afterwards is recommended).
- After saving, the calibration count increases by 1, and the temperature at that moment is recorded (AT: `AT+CALI.TEMP?`; SCPI: `CAL:USER:TEMP?`).
- After writing calibration data, exit calibration mode (`ENAB=0`); the unlock state itself is not written to storage, so if you want the unlock state to be retained after power-off, run `SAVE` once after unlocking.
- After writing, re-measure the key gears to confirm that the output matches the target.
- For command details, see the [AT Command Reference](../at.md) and the [SCPI Command Reference](../scpi.md).
