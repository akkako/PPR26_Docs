# AT Command Reference

## Device Connection Parameters

In USB-CDC mode the PPR26 requires no driver and can be programmed with AT commands. The PC-side serial port parameters are configured as follows:

| Baud rate | Data bits | Parity | Stop bits |
| ------ | ------ | ------ | ------ |
| 115200 | 8      | None   | 1      |

Using a serial console on the PC, you can control the device output, perform user calibration, and view device information.

The examples in this document use the following notation (`>` marks what is sent, `<` marks what the device returns and is not sent with the command):

```text
> AT+DEV.MODEL?
< +DEV.MODEL=PPR26
```

## General Rules

### Command Types

| Type     | Command format            | Notes                   |
| -------- | ------------------- | ---------------------- |
| Test command | `AT+<command name>=?`   | Query parameter help and value range |
| Query command | `AT+<command name>?`    | Return the current parameter value         |
| Set command | `AT+<command name>=<…>` | Set parameters and execute         |
| Execute command | `AT+<command name>`     | Execute a command with no parameters         |

- Not every command has all four types; refer to each command's "Command forms".
- Commands are **case-sensitive**, and command names must be uppercase (e.g. `AT+RES.SP`).
- Parameters are separated by `,`, at most 8 of them, each up to 64 bytes long; numeric parameters accept decimal and `0x` hexadecimal (unsigned, with the exception of `AT+CALI.VAL`, which is parsed as signed).
- A single command must not exceed 256 bytes; exceeding this returns `OVERFLOW`.
- Commands end with `<CR>`, `<LF>`, or `<CR><LF>`.
- The test form `=?` is valid only for commands that declare it; for commands with a query form only (`AT+DEV.*`, `AT+RES.PV`, `AT+CALI.COUNT`, `AT+CALI.TEMP`), using `=?` returns `ERROR`.

### Common Responses

| Response             | Notes                                              |
| -------------------- | ------------------------------------------------- |
| `+<command>=<value>` | Query result                                          |
| `OK`                 | Set/execute succeeded                                     |
| `ERROR`              | Parameter error, out of range, unsupported call type, or unknown command        |
| `OVERFLOW`           | A single command exceeds 256 bytes                             |
| `[TQS ] AT+<command>=…` | `=?` parameter help (`T`=Test, `Q`=Query, `S`=Set)      |

- Every response ends with `<CR><LF>` and contains no extra bytes.
- Unknown commands, commands with incorrect case, or commands with an illegal form all return `ERROR`; an empty line produces no response.

### Units and Conventions

- Resistance-related parameters and return values are all **milliohm (mΩ) integers**; internally they are 64-bit integers and are output in decimal.
- Valid resistance range: **5 Ω ~ 4 MΩ** (`5000` ~ `4000000000` mΩ).
- Temperature is always a **0.1 °C** integer (e.g. `291` means 29.1 °C).
- Out of range returns `ERROR` only; the current value is not changed, and the output is not automatically switched to short or open.
- On each power-on the output is **open**, and `AT+RES.PV?` then returns `inf`.

### Persistence

- **Saved** (written to non-volatile storage immediately after setting, retained after power-off): protocol, step size, limits (`MIN` / `MAX`) and limits enabled, compensation mode, dataset selection, power-on statistics.
- **Not saved** (valid only for the current power-on session): setpoint `AT+RES.SP`, output state `AT+RES.SHORT` / `AT+RES.OPEN`, relay bitmap `AT+RES.NETW`, plus calibration enable `AT+CALI.ENAB` and calibration gear `AT+CALI.GEAR`. After a power cycle the device is **open + default setpoint 5 Ω**.
- **Calibration data** is saved only during calibration write operations: `AT+CALI.SAVE`, `AT+CALI.LOCK=1`, and setting the user password; selecting a dataset does not write calibration data.
- Factory defaults of the configuration items: compensation mode `2` (Precise), step size `1000` mΩ (1 Ω), limits enabled `0`, limit range is the full scale (5 Ω ~ 4 MΩ); the dataset defaults to `USER`.

---

## Device Information Commands

### `AT` — Connection test

- **Command forms**: `AT` (execute)
- **Parameters**: None
- **Returns**: `OK`
- **Notes**: Used to check that the device is online and the serial link is up.

**Example**

```text
> AT
< OK
```

### `AT+DEV.SN?` — Serial number (SN)

- **Command forms**: `AT+DEV.SN?` (query)
- **Parameters**: None
- **Returns**: `+DEV.SN=<serial number>`, 24 uppercase hexadecimal characters.
- **Notes**: The serial number is the device's unique identifier and matches the serial number in the USB descriptors as well as the serial number returned by `SYST:INFO:SN?` on the SCPI side.

**Example**

```text
> AT+DEV.SN?
< +DEV.SN=0123456789ABCDEF01234567
```

### `AT+DEV.MODEL?` — Model

- **Command forms**: `AT+DEV.MODEL?` (query)
- **Parameters**: None
- **Returns**: `+DEV.MODEL=PPR26`

**Example**

```text
> AT+DEV.MODEL?
< +DEV.MODEL=PPR26
```

### `AT+DEV.PROD?` — Production date

- **Command forms**: `AT+DEV.PROD?` (query)
- **Parameters**: None
- **Returns**: `+DEV.PROD=<YY-WW>`, year (two digits) and week (two digits).

**Example**

```text
> AT+DEV.PROD?
< +DEV.PROD=26-09
```

### `AT+DEV.HWVER?` — Hardware version

- **Command forms**: `AT+DEV.HWVER?` (query)
- **Parameters**: None
- **Returns**: `+DEV.HWVER=<0..6>`

**Example**

```text
> AT+DEV.HWVER?
< +DEV.HWVER=0
```

### `AT+DEV.FWVER?` — Firmware version

- **Command forms**: `AT+DEV.FWVER?` (query)
- **Parameters**: None
- **Returns**: `+DEV.FWVER=<version string>`

**Example**

```text
> AT+DEV.FWVER?
< +DEV.FWVER=FW 1.0.0
```

### `AT+DEV.POWERON?` — Power-on count

- **Command forms**: `AT+DEV.POWERON?` (query)
- **Parameters**: None
- **Returns**: `+DEV.POWERON=<count>`

**Example**

```text
> AT+DEV.POWERON?
< +DEV.POWERON=12
```

### `AT+DEV.UPTIME?` — Cumulative power-on time

- **Command forms**: `AT+DEV.UPTIME?` (query)
- **Parameters**: None
- **Returns**: `+DEV.UPTIME=<minutes>`, in minutes, never reset to zero.

**Example**

```text
> AT+DEV.UPTIME?
< +DEV.UPTIME=345
```

### `AT+DEV.DFU` — Enter firmware upgrade mode

- **Command forms**: `AT+DEV.DFU` (execute)
- **Parameters**: None
- **Returns**: `OK`
- **Notes**: Puts the device into **DFU (firmware upgrade) mode** without pressing any button: after the device returns `OK`, it automatically disconnects USB and restarts, then re-enumerates as `PPR26 WinUSB DFU` (`0xFFFE:0xFFFD`), waiting for the host tool to perform the upgrade.
- **Caution**: The device disconnects immediately, so the `OK` response may not reach the host tool in time; **use whether the device re-enumerates as a DFU device as the criterion for success**. After the upgrade completes or after a power cycle, the device returns to normal operation. For upgrade steps, see [Firmware Upgrade Guide](../quickstart/fwupgrade.md).

**Example**

```text
> AT+DEV.DFU
< OK
```

---

## Temperature Measurement Commands

The device has an on-board NTC temperature sensor for monitoring the internal temperature of the device. The temperature unit is **0.1 °C**.

### `AT+DEV.TEMP?` — Current temperature

- **Command forms**: `AT+DEV.TEMP?` (query)
- **Parameters**: None
- **Returns**: `+DEV.TEMP=<temperature×10>`, e.g. `291` means 29.1 °C.

**Example**

```text
> AT+DEV.TEMP?
< +DEV.TEMP=291
```

### `AT+DEV.TSTAT?` — Temperature statistics

- **Command forms**: `AT+DEV.TSTAT?` (query)
- **Parameters**: None
- **Returns**: `+DEV.TSTAT=<current>,<minimum>,<average>,<maximum>,<sample count>`
  (the first four are 0.1 °C integers; the last is an integer)
- **Notes**: Statistics accumulate since power-on or since the last `AT+DEV.TCLR`.

**Example**

```text
> AT+DEV.TSTAT?
< +DEV.TSTAT=291,290,291,293,1250
```

### `AT+DEV.TCLR` — Clear temperature statistics

- **Command forms**: `AT+DEV.TCLR` (execute)
- **Parameters**: None
- **Returns**: `OK`
- **Notes**: Clears the maximum/minimum/average/sample count and restarts the statistics.

**Example**

```text
> AT+DEV.TCLR
< OK
```

---

## System Commands

### `AT+SYS.PROT` — Protocol

- **Command forms**: `AT+SYS.PROT?` (query) / `AT+SYS.PROT=<0|1>` (set) / `AT+SYS.PROT=?` (test)
- **Parameters**: `0` = AT (USB CDC), `1` = SCPI (USB TMC)
- **Returns**: The query returns `+SYS.PROT=<0|1>`
- **Notes**: After setting, the change is **saved and switched at runtime**: after the device disconnects/reconnects USB it re-enumerates under the new protocol, **without resetting the MCU**. The current connection is interrupted during the switch.

**Example**

```text
> AT+SYS.PROT?
< +SYS.PROT=0

> AT+SYS.PROT=1
< OK
```

---

## Output and Resistance Commands

Resistance values are always in mΩ. The `=?` form of the commands below returns parameter help (some commands also print the value range).

### `AT+RES.SP` — Setpoint (SP)

- **Command forms**: `AT+RES.SP?` (query) / `AT+RES.SP=<mΩ>` (set) / `AT+RES.SP=?` (test)
- **Parameters**: `<mΩ>` resistance, range **5000 ~ 4000000000** (5 Ω ~ 4 MΩ)
- **Returns**: The query returns `+RES.SP=<mΩ>`
- **Notes**:
  - With limits enabled (`AT+RES.LIMIT=1`), the setpoint must fall within `[RES.MIN, RES.MAX]`.
  - After a successful set, the output state changes to resistance network output (NORM).
  - Out of range returns `ERROR` and the original value is kept.
  - The setpoint is **valid only for the current power-on session**: the device does not write it to non-volatile storage, and after a power cycle it returns to the default value of 5 Ω; if needed, set it again after power-on.

**Example**

```text
> AT+RES.SP=523000
< OK

> AT+RES.SP?
< +RES.SP=523000
```

### `AT+RES.PV?` — Current estimated resistance (PV)

- **Command forms**: `AT+RES.PV?` (query)
- **Parameters**: None
- **Returns**: `+RES.PV=<mΩ>`; when open it returns `+RES.PV=inf`; when shorted it returns the short calibration value of the current dataset (`AT+CALI.SEL`).
- **Notes**: The return value is calculated according to the **actual output state** (shared with the SCPI side): an open output returns `inf`, a short output returns the short calibration value, and a resistance network output returns the resistance estimated with compensation for the current dataset. The initial output at every power-on is open, so the first query after boot is usually `inf`.

**Example**

```text
> AT+RES.PV?
< +RES.PV=523000
```

### `AT+RES.COMP` — Compensation mode

- **Command forms**: `AT+RES.COMP?` (query) / `AT+RES.COMP=<mode>` (set) / `AT+RES.COMP=?` (test)
- **Parameters**: `0` = Uncalibrated (UNCAL), `1` = Nearby (NEARBY), `2` = Precise (PREC, default)
- **Returns**: The query returns `+RES.COMP=<0|1|2>`
- **Notes**: The compensation mode is saved and retained after power-off; changes take effect **at the next `AT+RES.SP`**. `1` / `2` depend on the calibration data of the current dataset: when the calibration value is 0, `1` degrades to nominal mapping and `2` outputs approximately gear 0, while `0` is unaffected.

**Example**

```text
> AT+RES.COMP=2
< OK

> AT+RES.COMP?
< +RES.COMP=2
```

### `AT+RES.STEP` — Step size

- **Command forms**: `AT+RES.STEP?` (query) / `AT+RES.STEP=<mΩ>` (set) / `AT+RES.STEP=?` (test)
- **Parameters**: `<mΩ>` step size, any non-negative integer (no upper limit); a negative value returns `ERROR` (the original value is kept)
- **Returns**: The query returns `+RES.STEP=<mΩ>`
- **Notes**: The step size is saved and retained after power-off.

**Example**

```text
> AT+RES.STEP=10000
< OK

> AT+RES.STEP?
< +RES.STEP=10000
```

### `AT+RES.LIMIT` — Limits enabled

- **Command forms**: `AT+RES.LIMIT?` (query) / `AT+RES.LIMIT=<0|1>` (set) / `AT+RES.LIMIT=?` (test)
- **Parameters**: `0` = off, `1` = enabled
- **Returns**: The query returns `+RES.LIMIT=<0|1>`
- **Notes**: Once enabled, the setpoint must fall within `[RES.MIN, RES.MAX]`; the enable state is saved and retained after power-off.

**Example**

```text
> AT+RES.LIMIT=1
< OK

> AT+RES.LIMIT?
< +RES.LIMIT=1
```

### `AT+RES.NETW` — Relay network

- **Command forms**: `AT+RES.NETW?` (query) / `AT+RES.NETW=<mask>` (set) / `AT+RES.NETW=?` (test)
- **Parameters**: `<mask>` 26-bit relay bitmap, range `0` ~ `67108863` (`2^26 - 1`)
- **Returns**: The query returns `+RES.NETW=<mask>`
- **Notes**: Directly applies a 26-bit relay bitmap (bypassing the compensation algorithm) and rewrites the setpoint to the simulated resistance corresponding to the bitmap, with the output state set to **resistance network output** (`NORM`); used for production testing and calibration. After execution, the setpoint and output state are **valid only for the current session** (not written to non-volatile storage); **the bitmap itself is not saved either**, and after a power cycle the device is open + default setpoint 5 Ω.

**Example**

```text
> AT+RES.NETW=0
< OK
```

### `AT+RES.MAX` — Maximum resistance limit

- **Command forms**: `AT+RES.MAX?` (query) / `AT+RES.MAX=<mΩ>` (set) / `AT+RES.MAX=?` (test)
- **Parameters**: `<mΩ>`, range 5 Ω ~ 4 MΩ
- **Returns**: The query returns `+RES.MAX=<mΩ>`
- **Notes**: Must satisfy `RES.MIN ≤ RES.MAX`, otherwise `ERROR` is returned; the setting is saved and retained after power-off. Setting a limit does **not** automatically enable limit checking (requires `AT+RES.LIMIT=1`).

**Example**

```text
> AT+RES.MAX=1000000
< OK
```

### `AT+RES.MIN` — Minimum resistance limit

- **Command forms**: `AT+RES.MIN?` (query) / `AT+RES.MIN=<mΩ>` (set) / `AT+RES.MIN=?` (test)
- **Parameters**: `<mΩ>`, range 5 Ω ~ 4 MΩ
- **Returns**: The query returns `+RES.MIN=<mΩ>`
- **Notes**: Must satisfy `RES.MIN ≤ RES.MAX`, otherwise `ERROR` is returned; the setting is saved and retained after power-off. Setting a limit does **not** automatically enable limit checking (requires `AT+RES.LIMIT=1`).

**Example**

```text
> AT+RES.MIN=5000
< OK
```

### `AT+RES.SHORT` / `AT+RES.OPEN` — Short / open

- **Command forms**: `AT+RES.SHORT?`/`AT+RES.OPEN?` (query) / `AT+RES.SHORT=<0|1>`/`AT+RES.OPEN=<0|1>` (set) / `=?` (test)
- **Parameters**: `1` = enter short/open, `0` = return to the current setpoint (`AT+RES.SP`)
- **Returns**: The query returns `<0|1>`
- **Notes**: The short/open state is **shared** with the SCPI side (`OUTPut`); besides this command, `AT+RES.SP` and `AT+RES.NETW` also switch the output back to resistance network output, and `AT+CALI.GEAR=26` / `27` directly drive the short path. The output state is **not retained across power cycles** — the initial output at every power-on is always **open**, and the resistance must be set again or `AT+RES.OPEN=0` / `AT+RES.SHORT=0` sent to return to resistance network output.

**Example**

```text
> AT+RES.OPEN=1
< OK

> AT+RES.PV?
< +RES.PV=inf
```

---

## Calibration Commands

The device stores two sets of calibration data; `AT+CALI.SEL` determines which set is currently in effect (used for output) as well as the target dataset for subsequent edits:

| Dataset | Notes |
| ------ | ---- |
| `USER` (`0`) | **User calibration**, the default dataset; users can calibrate and modify it themselves |
| `FACTORY` (`1`) | **Factory calibration**, written at the factory; no user modification method is provided |

!!! note "Factory data is not affected by user calibration"
    The factory calibration dataset is **locked** by default, and the factory password needed to unlock it is not made public; therefore, operating on the user dataset following the procedure in this document **does not modify or overwrite the factory calibration data**. If you need to recalibrate, operate on the `USER` dataset.

!!! warning "Caution"
    Improper calibration degrades output accuracy and reliability; perform calibration only when a reference standard is available.

### Calibration Procedure and Write Protection

Before calibration data can be written (`VAL` / `DATE` / `STR` / `SAVE`), the following must be satisfied:

1. Calibration mode has been entered: `AT+CALI.ENAB=1`;
2. The target dataset is not locked (if a password has been set on the user dataset, unlock it first with `AT+CALI.UNL`).

Query commands are not subject to the above restrictions; violating write protection returns `ERROR`. The **exception** is modifying or clearing the user password (`AT+CALI.PASS`), which only requires the dataset to be unlocked and is unrelated to `ENAB`.

> AT and SCPI share the same calibration data and the same lock/unlock determination: calibrate on either side, then switch to the other side to read it.

### `AT+CALI.SEL` — Calibration dataset

- **Command forms**: `AT+CALI.SEL?` (query) / `AT+CALI.SEL=<0|1>` (set) / `AT+CALI.SEL=?` (test)
- **Parameters**: `0` = `USER` (user calibration), `1` = `FACTORY` (factory calibration)
- **Returns**: The query returns `+CALI.SEL=<0|1>`
- **Notes**: The selected dataset determines both which set of data the device uses to output resistance and the edit target of subsequent `AT+CALI.*` commands; the selection is **saved immediately** in the device configuration items (stored separately from the calibration data), is retained after power-off, and **does not change the calibration data itself** (switching datasets writes no calibration values).

**Example**

```text
> AT+CALI.SEL=0
< OK

> AT+CALI.SEL?
< +CALI.SEL=0
```

### `AT+CALI.ENAB` — Calibration enable

- **Command forms**: `AT+CALI.ENAB?` (query) / `AT+CALI.ENAB=<0|1>` (set) / `AT+CALI.ENAB=?` (test)
- **Parameters**: `0` = exit calibration mode, `1` = enter calibration mode
- **Returns**: The query returns `+CALI.ENAB=<0|1>`
- **Notes**: A prerequisite for writing calibration data; **not persistent** (it is `0` after power-off).

**Example**

```text
> AT+CALI.ENAB=1
< OK
```

### `AT+CALI.PASS` — User password

- **Command forms**: `AT+CALI.PASS?` (query) / `AT+CALI.PASS=<string>` (set) / `AT+CALI.PASS=?` (test)
- **Parameters**: `<string>` password, up to 64 bytes; an empty string clears the password (the dataset is unlocked by default after clearing)
- **Returns**: The query returns `+CALI.PASS=<0|1>` (whether a password has been set; the plaintext is not returned)
- **Notes**: Valid only for the `USER` dataset — when `FACTORY` is selected (`AT+CALI.SEL=1`), both the query and the set return `ERROR`; setting a non-empty password also puts the dataset into the **locked** state, while an empty string clears the password and unlocks it. **Modifying or clearing the password requires the dataset to be currently unlocked** (use `AT+CALI.UNL` to unlock), otherwise `ERROR` is returned.

**Example**

```text
> AT+CALI.PASS=1234
< OK

> AT+CALI.PASS?
< +CALI.PASS=1
```

### `AT+CALI.UNL` — Unlock

- **Command forms**: `AT+CALI.UNL=<password>` (set) / `AT+CALI.UNL=?` (test)
- **Parameters**: `<password>` user password; when the `USER` dataset password is empty, it can be unlocked directly (`AT+CALI.UNL=`)
- **Returns**: `OK` / `ERROR` (`ERROR` is returned when the password is wrong)
- **Notes**: Acts on the dataset selected by `AT+CALI.SEL`; the `FACTORY` dataset provides no unlock method available to users. The unlocked state is **valid only for the current power-on session** (`UNL` itself is not written to storage): to have the unlocked state persist after power-off, perform an operation that writes calibration data (e.g. `AT+CALI.SAVE` after calibration) while unlocked; otherwise, after a power cycle the dataset is still in the locked state saved last time.

**Example**

```text
> AT+CALI.UNL=1234
< OK
```

### `AT+CALI.LOCK` — Lock

- **Command forms**: `AT+CALI.LOCK?` (query) / `AT+CALI.LOCK=<0|1>` (set) / `AT+CALI.LOCK=?` (test)
- **Parameters**: `1` = lock; `0` is a no-op only when **unlocked**
- **Returns**: The query returns `+CALI.LOCK=<0|1>`
- **Notes**: **Unlocking is possible only through `AT+CALI.UNL` + password**; executing `AT+CALI.LOCK=0` while locked returns `ERROR`. `AT+CALI.LOCK=1` immediately writes the locked state to the calibration data, and it is retained after power-off.

**Example**

```text
> AT+CALI.LOCK=1
< OK

> AT+CALI.LOCK?
< +CALI.LOCK=1
```

### `AT+CALI.GEAR` — Calibration gear

- **Command forms**: `AT+CALI.GEAR?` (query) / `AT+CALI.GEAR=<0..27>` (set) / `AT+CALI.GEAR=?` (test)
- **Parameters**: `<0..27>`, meaning as in the table below; setting it also applies the corresponding relay
- **Returns**: The query returns `+CALI.GEAR=<0..27>`
- **Notes**: The gear is session state and is not persistent.

| Gear      | Meaning                       |
| --------- | -------------------------- |
| `0`..`25` | Single resistance (closes the corresponding relay) |
| `26`      | Series short                   |
| `27`      | Direct short                   |

**Example**

```text
> AT+CALI.GEAR=0
< OK
```

### `AT+CALI.VAL` — Current gear calibration resistance

- **Command forms**: `AT+CALI.VAL?` (query) / `AT+CALI.VAL=<mΩ>` (set) / `AT+CALI.VAL=?` (test)
- **Parameters**: `<mΩ>` measured resistance of the current gear
- **Returns**: The query returns `+CALI.VAL=<mΩ>`
- **Notes**: Subject to write protection (requires `ENAB=1` and unlocked).

**Example**

```text
> AT+CALI.VAL=5230
< OK
```

### `AT+CALI.DATE` — Calibration date

- **Command forms**: `AT+CALI.DATE?` (query) / `AT+CALI.DATE=<string>` (set) / `AT+CALI.DATE=?` (test)
- **Parameters**: `<string>` date string, up to 64 bytes; an empty string clears it
- **Returns**: The query returns `+CALI.DATE=<string>`
- **Notes**: Subject to write protection (requires `ENAB=1` and unlocked).

**Example**

```text
> AT+CALI.DATE=2026-09-29
< OK
```

### `AT+CALI.STR` — Calibration note

- **Command forms**: `AT+CALI.STR?` (query) / `AT+CALI.STR=<string>` (set) / `AT+CALI.STR=?` (test)
- **Parameters**: `<string>` note string, up to 64 bytes; an empty string clears it
- **Returns**: The query returns `+CALI.STR=<string>`
- **Notes**: Subject to write protection (requires `ENAB=1` and unlocked).

**Example**

```text
> AT+CALI.STR=user-cal
< OK
```

### `AT+CALI.COUNT?` — Calibration count

- **Command forms**: `AT+CALI.COUNT?` (query)
- **Returns**: `+CALI.COUNT=<count>`; incremented by 1 on each `AT+CALI.SAVE`.

**Example**

```text
> AT+CALI.COUNT?
< +CALI.COUNT=3
```

### `AT+CALI.TEMP?` — Temperature snapshot at calibration

- **Command forms**: `AT+CALI.TEMP?` (query)
- **Returns**: `+CALI.TEMP=<°C>` (0.1 °C resolution), the temperature recorded at the most recent `SAVE`.

**Example**

```text
> AT+CALI.TEMP?
< +CALI.TEMP=29.5
```

### `AT+CALI.SAVE` — Save calibration data

- **Command forms**: `AT+CALI.SAVE` (execute)
- **Parameters**: None
- **Returns**: `OK` / `ERROR`
- **Notes**: Saves the calibration data of the current gear, increments the calibration count by 1, records the temperature, and writes to storage. Subject to write protection (requires `ENAB=1` and unlocked).

**Example**

```text
> AT+CALI.SAVE
< OK
```

---

## Typical Workflow

```text
AT
AT+DEV.MODEL?
AT+DEV.TEMP?

AT+RES.LIMIT=0
AT+RES.COMP=2
AT+RES.SP=523000
AT+RES.PV?

AT+CALI.SEL=0
AT+CALI.ENAB=1
AT+CALI.UNL=1234
AT+CALI.GEAR=0
AT+CALI.VAL=5230
AT+CALI.DATE=2026-09-29
AT+CALI.STR=user-cal
AT+CALI.SAVE
AT+CALI.ENAB=0
```
