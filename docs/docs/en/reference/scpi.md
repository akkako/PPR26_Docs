# SCPI Command Reference

## Related Information

### Instrument Driver

This instrument communicates over **USB TMC** (USBTMC). Installing the **NI-VISA** driver library is recommended to establish instrument communication.

In USB TMC mode, the device's VID:PID is `0xFFFE:0xFFFF`, and the resource looks like
`USB0::0xFFFE::0xFFFF::<serial>::0::INSTR`.

!!! note "Resource string"
    NI-VISA auto-detection **may not list this device**. Prefer to **specify the resource string explicitly** in your program; do not rely solely on the results of the `list_resources()` auto-search.

### Host Tools and Scripts

This instrument provides Python-based user calibration and test scripts; see: [Calibration Script](scripts/calibration.md), [Test Script](scripts/test.md).

### Programming Example

This instrument provides a Python-based programming example: [SCPI Python Example](./python_scpi.md).

## Introduction to the SCPI Language

This instrument follows the rules and conventions of the current SCPI version (see `SYSTem:VERSion?`). SCPI commands fall into two categories:

- **Subsystem commands**: perform specific instrument functions and are organized in a tree hierarchy, for example:

  ```text
  OUTPut
      [:STATe] NORMal|SHORt|OPEN
  RESIstance
      [:LEVel][:IMMediate][:AMPLitude] <value>
      :LIMit
          :MINimum <value>
  ```

- **IEEE-488.2 common commands**: start with `*` and are 3 characters long, used for reset, self-test, and status operations, for example `*IDN?`, `*RST`.

### Keywords

Keywords (headers) are **case-insensitive**. The short form is the uppercase part, the long form is the complete word, and the two are equivalent. For example, both `OUTP` and `OUTPUT` are accepted; `OUT` is invalid.

A long form may also be written only in part, as long as it includes the complete uppercase part: `RES`, `RESI` ... `RESISTANCE` are all valid.

### Queries

Appending `?` to a keyword forms a query (such as `RES?`). All query results must be read back before sending the next command; otherwise data is lost due to Query Interrupted.

### Separators and Terminators

- The colon `:` separates keyword levels; a space separates a keyword from its parameters.
- The semicolon `;` can separate multiple commands within one message, for example `OUTP NORM;RES 523000`.
- A command string must end with a line feed `<LF>` (`\n`); `<CR><LF>` is also accepted.
- String literals (the content of string parameters) are case-sensitive; command mnemonics are case-insensitive.
- The input buffer for a single message is **512 bytes**; overly long content is discarded and causes command parsing to fail.

### Parameter Types

| Type       | Description                                       |
| ---------- | ------------------------------------------------- |
| `<NR1>`    | Decimal integer (resistance unit is **mΩ**)       |
| `<bool>`   | `0` / `1` / `OFF` / `ON`, queries return `0`/`1`  |
| `<str>`    | String, **must** use double quotes                |
| `<discrete>` | Enumerated mnemonic, such as `NORMal`, `SHORt`    |

- Resistance is always expressed as an integer in **milliohms (mΩ)**; the valid range is **5 Ω ~ 4 MΩ**.
- Numeric parameters accept only `<NR1>` decimal integers (optionally with `+`/`-`): the `0x...` prefix is **not supported**, nor are unit suffixes such as `OHM / KOHM / MOHM`; decimal and exponential forms are rejected.
- String parameter content may be up to 64 bytes; longer content returns `-912`.
- Temperature queries return a **double-quoted string** (such as `"29.1"`), not an `<NR2>` numeric value.
- In the examples below, `→` denotes the content returned by a query.

---

## Common Commands (IEEE 488.2)

### `*IDN?` — Identification query

- **Command forms**: `*IDN?`
- **Returns**: `<manufacturer>,<model>,<serial number>,<firmware version>`
- **Example**:

  ```text
  *IDN?
  → akaInstruments,PPR26,0123456789ABCDEF01234567,FW 1.0.0
  ```

### `*RST` — Reset

- **Command forms**: `*RST`
- **Notes**: Restores the default configuration (step size, limits and limits enabled, compensation mode), sets the output to **open** and returns the setpoint to the default 5 Ω; it does **not clear** calibration data, does **not change** the protocol or the current dataset selection, and does **not reset** the power-on statistics. The restored configuration items are written to non-volatile storage immediately.
- **Example**: `*RST`

### `*SAV` — Save settings

- **Command forms**: `*SAV`
- **Notes**: Writes the configuration items (step size, limits and enable flag, compensation mode, protocol, dataset selection) to non-volatile storage; these items are also saved immediately when set, so `*SAV` simply confirms them once more. The setpoint and output state are runtime values and are **not included** (after a power cycle the output is open + the default setpoint 5 Ω).

!!! note "Configuration defaults and power-on state"
    - Factory defaults of the configuration items: compensation mode `PREC`, step size `1000` mΩ (1 Ω), limits enabled `0`, limit range equal to full scale (5 Ω ~ 4 MΩ), protocol `AT`, dataset `USER`; `*RST` restores these values (except the protocol and dataset selection).
    - The output state and setpoint are not saved: at every power-on they are always `OPEN` (open) + setpoint 5 Ω.

### `*CLS` — Clear status

- **Command forms**: `*CLS`
- **Notes**: Clears the status registers and the error queue.

### `*ESE[?]` — Standard event status enable

- **Command forms**: `*ESE <NR1>` / `*ESE?`
- **Parameters**: `<NR1>` enable bit mask
- **Returns**: queries return `<NR1>`

### `*ESR?` — Standard event status register

- **Command forms**: `*ESR?`
- **Returns**: `<NR1>`

### `*OPC` / `*OPC?` — Operation complete

- **Command forms**: `*OPC` / `*OPC?`
- **Returns**: `*OPC?` returns `1`

### `*SRE[?]` — Service request enable

- **Command forms**: `*SRE <NR1>` / `*SRE?`
- **Returns**: queries return `<NR1>`

### `*STB?` — Status byte

- **Command forms**: `*STB?`
- **Returns**: `<NR1>`

### `*TST?` — Self-test

- **Command forms**: `*TST?`
- **Returns**: `0` indicates pass

### `*WAI` — Wait

- **Command forms**: `*WAI`

---

## SYSTem Subsystem

### Communication Protocol `SYSTem:PROTocol`

- **Command forms**: `SYST:PROT {AT|SCPI}` / `SYST:PROT?`
- **Parameters**: `AT` (USB CDC), `SCPI` (USB TMC)
- **Returns**: queries return `AT` / `SCPI`
- **Notes**: Saved when set and **switched at runtime**: the device disconnects/reconnects USB and re-enumerates, without resetting the MCU.

**Example**

```text
SYST:PROT?
→ SCPI
```

### Entering Firmware Upgrade Mode `SYSTem:DFU`

- **Command forms**: `SYST:DFU`
- **Parameters**: none
- **Returns**: none (the device disconnects USB right after the command executes)
- **Notes**: The device can enter **DFU (firmware upgrade) mode** **without pressing the button**: it automatically disconnects USB and restarts, then re-enumerates as `PPR26 WinUSB DFU` (`0xFFFE:0xFFFD`), waiting for the host tool to perform the upgrade.
- **Caution**: Because the device disconnects immediately, **use whether the device re-enumerates as a DFU device as the success criterion**; after the upgrade completes or after a power cycle, it returns to normal operation. For upgrade steps, see [Firmware Upgrade Guide](../quickstart/fwupgrade.md).

**Example**

```text
SYST:DFU
```

### Compensation Mode `SYSTem:COMPensate`

- **Command forms**: `SYST:COMP {UNCAL|NEAR|PREC}` / `SYST:COMP?`
- **Parameters**: `UNCAL` (Uncalibrated), `NEAR`/`NEARby` (Nearby), `PREC`/`PRECise` (Precise, default)
- **Returns**: queries return `UNCAL` / `NEARBY` / `PRECISE`
- **Notes**: Defaults to `PREC`; after a change it **takes effect the next time a resistance value (`RES`) is set**, and the setting is saved. Both `NEAR` and `PREC` use the calibration data of the current dataset (`CAL:SEL`), while `UNCAL` performs no compensation; when a calibration value is 0, `NEAR` degrades to a nominal mapping and `PREC` outputs approximately gear `0`.
- **Errors**: illegal discrete value → `-224`

**Example**

```text
SYST:COMP PREC
SYST:COMP?
→ PRECISE
```

### Temperature Measurement `SYSTem:TEMPerature`

- **Command forms**:
  - `SYST:TEMP?` current temperature
  - `SYST:TEMP:AVER?` average temperature
  - `SYST:TEMP:MIN?` minimum temperature
  - `SYST:TEMP:MAX?` maximum temperature
  - `SYST:TEMP:RES` clear statistics
- **Returns**: queries return a **double-quoted string** (degrees Celsius), for example `"29.1"`
- **Notes**: Statistics accumulate since power-on or the last `SYST:TEMP:RES`. Temperature is returned as a string rather than an `<NRf>` value, so the host tool must handle it as a string when reading (strip the quotes before conversion).

**Example**

```text
SYST:TEMP?
→ "29.1"

SYST:TEMP:MAX?
→ "30.2"
```

### Device Information `SYSTem:INFOrmation`

| Command           | Parameters | Returns | Notes                            |
| ----------------- | ---- | ------- | -------------------------------- |
| `SYST:INFO:SN?`   | none   | `<str>` | Serial number (24 uppercase hexadecimal characters)  |
| `SYST:INFO:MOD?`  | none   | `<str>` | Model (`PPR26`)                  |
| `SYST:INFO:MAN?`  | none   | `<str>` | Production date `YY-WW`          |
| `SYST:INFO:HVER?` | none   | `<str>` | Hardware version `0`-`6`         |
| `SYST:INFO:FVER?` | none   | `<str>` | Firmware version                 |
| `SYST:INFO:POW?`  | none   | `<NR1>` | Power-on count                   |
| `SYST:INFO:TIME?` | none   | `<NR1>` | Cumulative power-on time (minutes) |

!!! warning "Mnemonic spelling"
    The third-level mnemonics must be spelled as in the table above: `MFD?` / `HWV?` / `FWV?` / `PWR?` are **not** valid commands and return `-113` (Undefined header); use `MAN?` / `HVER?` / `FVER?` / `POW?` instead.

While the application is running, no Bootloader version query is provided (`SYST:INFO:FVER?` returns the version string of the current application firmware); the Bootloader version can be read by the upgrade tool in DFU mode.

**Example**

```text
SYST:INFO:MOD?
→ PPR26
```

### Errors and Version

- `SYST:ERR?` — pops and returns the **earliest** entry in the error queue, in the format `<error code>,"<error message>"`; returns `0,"No error"` when there are no errors.
- `SYST:ERR:COUN?` — number of errors in the error queue.
- `SYST:VERS?` — SCPI version number (this instrument returns `1999.0`).

**Example**

```text
SYST:ERR?
→ 0,"No error"
```

---

## STATus Subsystem

Status registers are used to query the operating status of the instrument. The command forms are as follows:

| Command                           | Parameters | Returns | Notes               |
| --------------------------------- | --------- | ------- | ------------------- |
| `STAT:OPER?`                      | none       | `<NR1>` | Operation status event        |
| `STAT:OPER:COND?`                 | none       | `<NR1>` | Operation status condition        |
| `STAT:OPER:ENAB <NR1>` / `?`      | `<NR1>`   | `<NR1>` | Operation status enable        |
| `STAT:QUES?`                      | none       | `<NR1>` | Questionable status event        |
| `STAT:QUES:COND?`                 | none       | `<NR1>` | Questionable status condition        |
| `STAT:QUES:ENAB <NR1>` / `?`      | `<NR1>`   | `<NR1>` | Questionable status enable        |
| `STAT:PRES`                       | none       | none    | Status preset            |

---

## OUTPut Subsystem

### Output State `OUTPut[:STATe]`

- **Command forms**: `OUTP {NORM|SHOR|OPEN}` / `OUTP?`
- **Parameters**: `NORM`/`NORMal` (resistance network output), `SHOR`/`SHORt` (direct short), `OPEN` (open)
- **Returns**: queries return `NORM` / `SHOR` / `OPEN`
- **Notes**: The output state is **shared** with the AT side (`AT+RES.SHORT` / `AT+RES.OPEN`); besides this command, sending `RES` or `RES:NETW` also switches the output back to `NORM`, and during calibration `CAL:USER:GEAR 26` / `27` directly drives the short path. The output state is **not retained across power cycles** — at every power-on the initial output is always `OPEN` (open) and is applied to the relays; `RES` or `OUTP NORM` must be sent again to return to resistance network output.
- **Errors**: illegal discrete value → `-224`

**Example**

```text
OUTP NORM
OUTP?
→ NORM
```

---

## RESIstance Subsystem

### Setpoint `RESistance[:LEVel][:IMMediate][:AMPLitude]`

- **Command forms**: `RES <NR1>|MIN|MAX|UP|DOWN` / `RES?`
- **Parameters**:
  - `<NR1>`: resistance value (mΩ), range 5 Ω ~ 4 MΩ
  - `MIN` / `MAX`: **minimum/maximum value** of the currently allowed range (set the value to the range endpoint)
  - `UP` / `DOWN`: current value ± `RES:STEP`; if the result falls outside the allowed range, the **current value is not changed** and `-902` is reported (the device does not clamp at the boundaries)
- **Returns**: queries return `<NR1>`, the current setpoint (mΩ)
- **Notes**: When limits are enabled, the setpoint must fall within `[RES:LIM:MIN, RES:LIM:MAX]`; an out-of-range value returns an error and the previous value is kept. After a successful set, the output state becomes `NORM` (resistance network output). The setpoint is **valid only for the current power-on session**: the device does not write it to non-volatile storage, so after a power cycle it returns to the default value 5 Ω; set it again after power-on if needed (`*SAV` does not save the setpoint either).
- **Errors**: out of range → `-902`

**Example**

```text
RES 523000
RES?
→ 523000

RES:STEP 10000
RES UP
RES?
→ 533000
```

### Step Size `RESistance[:LEVel][:IMMediate]:STEP[:INCRement]`

- **Command forms**: `RES:STEP <NR1>|MIN|MAX` / `RES:STEP?`
- **Parameters**: `<NR1>` step size (mΩ); `MIN` = `5000`, `MAX` = `4000000000`
- **Returns**: queries return `<NR1>`
- **Errors**: negative value → `-913`
- **Notes**: The step size is saved and retained across power cycles.

**Example**

```text
RES:STEP 10000
RES:STEP?
→ 10000
```

### Resistance Limits `RESistance:LIMit:MINimum` / `MAXimum`

- **Command forms**: `RES:LIM:MIN <NR1>` / `RES:LIM:MIN?`; `RES:LIM:MAX <NR1>` / `RES:LIM:MAX?`
- **Parameters**: `<NR1>` limit (mΩ), range 5 Ω ~ 4 MΩ
- **Returns**: queries return `<NR1>`
- **Notes**: Limits are saved and retained across power cycles; setting limits does **not** automatically enable limit checking (requires `RES:LIM:STAT 1`).
- **Errors**: `MIN > MAX` → `-900`; `MAX < MIN` → `-901`; outside the hardware range → `-913`

**Example**

```text
RES:LIM:MAX 1000000
RES:LIM:MIN 5000
RES:LIM:MIN?
→ 5000
```

### Limits Enabled `RESistance:LIMit[:STATe]`

- **Command forms**: `RES:LIM:STAT <bool>` / `RES:LIM:STAT?`; `RES:LIM` is a short form of the same command (`RES:LIM 1` is equivalent to `RES:LIM:STAT 1`)
- **Parameters**: `<bool>` `0`=off, `1`=enabled
- **Returns**: queries return `0` / `1`
- **Notes**: Once enabled, the setpoint must fall within the limits; setting `RES:LIM:MIN` / `RES:LIM:MAX` does **not** automatically enable limits. The enable state is saved and retained across power cycles.

**Example**

```text
RES:LIM:STAT 1
RES:LIM:STAT?
→ 1
```

### Relay Network `RESistance:NETWork`

- **Command forms**: `RES:NETW <NR1>` / `RES:NETW?`
- **Parameters**: `<NR1>` 26-bit relay bitmap, range `0` ~ `67108863`
- **Returns**: queries return `<NR1>`
- **Notes**: Directly applies the 26-bit relay bitmap (bypassing the compensation algorithm) and rewrites the setpoint to the emulated resistance corresponding to that bitmap, with the output state set to `NORM`; used for production testing and calibration. After execution, the setpoint and output state are **valid only for the current session** (not written to non-volatile storage); the **bitmap itself is also not saved**, and after a power cycle the device is open + the default setpoint 5 Ω. On the AT side, `AT+RES.NETW` behaves the same.
- **Errors**: out of range → `-913`

**Example**

```text
RES:NETW 0
RES:NETW?
→ 0
```

---

## Calibration Commands

The device stores two sets of calibration data; `CAL:SEL` determines which set is currently active (used for output) and the target dataset for subsequent edits:

| Dataset | Notes |
| ------ | ---- |
| `USER` | **User calibration**, the default dataset; the user can calibrate and modify it |
| `FACTORY` | **Factory calibration**, written at the factory; no user modification method is provided |

!!! note "Factory data is not affected by user calibration"
    The factory calibration dataset is **locked** by default, and the factory password required to unlock it is not provided publicly; therefore, following the procedure in this document to operate on the user dataset **will not modify or overwrite the factory calibration data**. If recalibration is needed, operate on the `USER` dataset.

!!! warning "Caution"
    Improper calibration reduces output accuracy and reliability; perform it only when a reference standard is available.

Writing calibration data (`VAL`/`DATE`/`STR`/`SAVE`) requires both: calibration mode entered (`CAL:ENAB 1`) **and** the target dataset unlocked; otherwise `-907` is returned. The **exception** is modifying or clearing the user password (`CAL:USER:PASS`), which only requires the dataset to be unlocked and is independent of `ENAB`. Reading calibration data is unrestricted.

### Select Dataset `CALibration:SELect`

- **Command forms**: `CAL:SEL {USER|FACT}` / `CAL:SEL?`
- **Parameters**: `USER` (user calibration), `FACT`/`FACTORY` (factory calibration)
- **Returns**: queries return `USER` / `FACTORY`
- **Notes**: The selected dataset determines both which set of data the device uses to output resistance and the edit target of subsequent `CAL:*` commands; the selection is saved and retained across power cycles, and **does not alter the calibration data itself** (switching datasets writes no calibration values).

**Example**

```text
CAL:SEL USER
CAL:SEL?
→ USER
```

### Calibration Enable `CALibration:ENABle`

- **Command forms**: `CAL:ENAB <bool>` / `CAL:ENAB?`
- **Parameters**: `<bool>` `0`=exit, `1`=enter calibration mode
- **Returns**: queries return `0` / `1`
- **Notes**: A precondition for writing calibration data; **not persisted**.

**Example**

```text
CAL:ENAB 1
CAL:ENAB?
→ 1
```

### User Password `CALibration:USER:PASSword`

- **Command forms**: `CAL:USER:PASS <str>` / `CAL:USER:PASS?`
- **Parameters**: `<str>` password, up to 64 bytes; setting a non-empty password also sets the dataset to **locked**, while an empty string (`""`) clears the password and unlocks
- **Returns**: queries return `0` / `1` (whether a password is set; the plaintext is not returned)
- **Errors**: too long → `-916`; dataset already locked → `-907`
- **Notes**: Valid only for the `USER` dataset; modifying or clearing the password **requires the dataset to be unlocked** (first unlock with `CAL:USER:UNL`), but is **independent of `CAL:ENAB`** — this is an exception to write protection. The password and lock state are saved together with the calibration data.

**Example**

```text
CAL:USER:PASS "1234"
CAL:USER:PASS?
→ 1
```

### Unlock `CALibration:USER:UNLock`

- **Command forms**: `CAL:USER:UNL <str>`
- **Parameters**: `<str>` user password, **required**; when the password is empty, an empty string `""` must be written; **a bare command returns `-109`** (missing parameter)
- **Errors**: wrong password → `-915`; missing parameter → `-109`
- **Notes**: The unlocked state is **valid only within the current session** (`UNL` itself is not written to storage); to keep it unlocked after power-off, perform an operation after unlocking that writes calibration data (for example `CAL:USER:SAV`); otherwise, after a power cycle the lock state remains the last saved one.

**Example**

```text
CAL:USER:UNL "1234"
CAL:USER:UNL ""        # when no password is set
```

### Lock `CALibration:USER:LOCK`

- **Command forms**: `CAL:USER:LOCK <bool>` / `CAL:USER:LOCK?`
- **Parameters**: `<bool>` `1`=lock; `0` is a no-op only when **not locked**
- **Returns**: queries return `0` / `1`
- **Errors**: executing `CAL:USER:LOCK 0` while locked → `-907`
- **Notes**: **Unlocking is possible only via `CAL:USER:UNL` + password**; `LOCK 0` cannot unlock. `CAL:USER:LOCK 1` immediately writes the lock state to the calibration data, where it is retained across power cycles.

**Example**

```text
CAL:USER:LOCK 1
CAL:USER:LOCK?
→ 1
```

### Calibration Gear `CALibration:USER:GEAR`

- **Command forms**: `CAL:USER:GEAR <NR1>` / `CAL:USER:GEAR?`
- **Parameters**: `<NR1>`, range `0`..`27` (see the table below); the corresponding relays are also applied when set
- **Returns**: queries return `<NR1>`
- **Errors**: out of range → `-905`

| Gear      | Meaning                       |
| --------- | -------------------------- |
| `0`..`25` | Single resistance path (close the corresponding relay) |
| `26`      | Series short                   |
| `27`      | Direct short                   |

**Example**

```text
CAL:USER:GEAR 0
CAL:USER:GEAR?
→ 0
```

### Gear Resistance Value `CALibration:USER:VALue`

- **Command forms**: `CAL:USER:VAL <NR1>` / `CAL:USER:VAL?`
- **Parameters**: `<NR1>` measured resistance of the current gear (mΩ)
- **Returns**: queries return `<NR1>`
- **Notes**: Subject to write protection (requires `CAL:ENAB 1` and unlocked).

**Example**

```text
CAL:USER:VAL 5230
CAL:USER:VAL?
→ 5230
```

### Calibration Count `CALibration:USER:COUNt?`

- **Command forms**: `CAL:USER:COUN?`
- **Returns**: `<NR1>` calibration count; incremented by 1 on each `CAL:USER:SAVE`.

**Example**

```text
CAL:USER:COUN?
→ 3
```

### Calibration Date `CALibration:USER:DATE`

- **Command forms**: `CAL:USER:DATE <str>` / `CAL:USER:DATE?`
- **Parameters**: `<str>` date string, up to 64 bytes; an empty string clears it
- **Returns**: queries return `<str>` (a double-quoted string)
- **Errors**: too long → `-912`

**Example**

```text
CAL:USER:DATE "2026-09-29"
CAL:USER:DATE?
→ "2026-09-29"
```

### Calibration Note `CALibration:USER:STRing`

- **Command forms**: `CAL:USER:STR <str>` / `CAL:USER:STR?`
- **Parameters**: `<str>` note string, up to 64 bytes; an empty string clears it
- **Returns**: queries return `<str>` (a double-quoted string)
- **Errors**: too long → `-912`

**Example**

```text
CAL:USER:STR "user-cal"
CAL:USER:STR?
→ "user-cal"
```

### Calibration Temperature `CALibration:USER:TEMPerature?`

- **Command forms**: `CAL:USER:TEMP?`
- **Returns**: a **double-quoted string** (degrees Celsius), the temperature recorded at the most recent `SAVE`.

**Example**

```text
CAL:USER:TEMP?
→ "29.5"
```

### Save Calibration Data `CALibration:USER:SAVe`

- **Command forms**: `CAL:USER:SAVE`
- **Notes**: Saves the calibration data of the current gear: increments the calibration count by 1, records the temperature, and persists it to storage. Subject to write protection (requires `CAL:ENAB 1` and unlocked).
- **Errors**: not enabled or locked → `-907`; save failed → `-908`

**Example**

```text
CAL:USER:SAVE
```

---

## Error Codes

Command errors or execution errors enter the error queue and can be read out one by one with `SYST:ERR?`; the readback format is `<code>,"<message>"`.

Standard errors (the subset whose text this instrument can read back):

| Code | Meaning                 | Typical trigger                 |
| ---- | ----------------------- | ------------------------------- |
| -100 | Command error           | Command parsing failed          |
| -109 | Missing parameter       | A command that requires a parameter was given none (such as a bare `CAL:USER:UNL`) |
| -113 | Undefined header        | Undefined or misspelled command |
| -131 | Invalid suffix          | Illegal command suffix          |
| -224 | Illegal parameter value | Illegal discrete value or parameter value |

!!! note "Untranslated error codes"
    This instrument does not provide text for the following codes, which are displayed as `Unknown error` when read back: `-222` (Data out of range), `-240` (Hardware error), `-363` (Input buffer overrun), etc.; the device does not push these codes either, so refer to the codes in the table above and the device-specific errors below.

Device-specific errors:

| Code | Meaning                                  | Trigger scenario                             |
| ---- | ---------------------------------------- | -------------------------------------------- |
| -900 | Resistance limit minimum exceeds maximum | `RES:LIM:MIN` > `RES:LIM:MAX`                |
| -901 | Resistance limit maximum below minimum   | `RES:LIM:MAX` < `RES:LIM:MIN`                |
| -902 | Resistance value out of limit range      | Resistance/step crosses the currently allowed range |
| -903 | Resistance step size too large           | Reserved                                     |
| -904 | Calibration mode not set                 | Reserved                                     |
| -905 | Calibration mode invalid                 | `CAL:*:GEAR` out of range (such as 28)       |
| -906 | Calibration data invalid                 | Reserved                                     |
| -907 | Calibration locked or not in setup mode  | Writing calibration while the calibration mode is not enabled; dataset locked; changing the password while locked; executing `LOCK 0` while locked |
| -908 | Calibration save failed                  | Reserved (saving calibration data failed)    |
| -909 | Compensation mode invalid                | Illegal compensation mode value              |
| -910 | Output mode invalid                      | Illegal output mode value                    |
| -911 | Temperature sensor error                 | Reserved                                     |
| -912 | String parameter too long                | String parameter exceeds 64 bytes            |
| -913 | Value out of allowed range               | Negative `RES:STEP` value, limit outside the hardware range, etc. |
| -914 | Calibration data corrupted               | Reserved                                     |
| -915 | Password incorrect                       | Wrong unlock password                        |
| -916 | Password too long                        | Password exceeds 64 bytes                    |

---

## Typical Workflow

```text
*IDN?
SYST:COMP PREC
RES:LIM:MAX 1000000
RES:LIM:MIN 5000
RES:LIM:STAT 1
RES 523000
RES?
OUTP NORM
SYST:INFO:SN?
SYST:TEMP?

CAL:SEL USER
CAL:ENAB 1
CAL:USER:UNL "1234"
CAL:USER:GEAR 0
CAL:USER:VAL 5230
CAL:USER:DATE "2026-09-29"
CAL:USER:STR "user-cal"
CAL:USER:SAVE
CAL:ENAB 0

RES:LIM:STAT 0      # restore limits enable (the setting is saved)
*RST                # restore the default configuration (protocol, dataset selection, and power-on statistics unchanged)
*SAV                # confirm the save once more
SYST:ERR?           # check the error queue
```
