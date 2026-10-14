# Specifications

PPR26 is a precision programmable resistance box that outputs programmable resistance with a relay network, and supports USB control and user calibration.

## Resistance Output

| Item | Description |
| ---- | ---- |
| Output range | 5 Ω ~ 4 MΩ |
| Setpoint resolution | 1 mΩ |
| Output mode | Resistance network output (NORM), open, short |
| Power-on default | Open + default setpoint 5 Ω |
| Compensation mode | Uncalibrated (UNCAL) / Nearby (NEARBY) / Precise (PRECISE) (default: Precise) |
| Retained across power cycles | Step size, limits and enable flag, compensation mode, communication protocol, and dataset selection are saved; **the setpoint and output state are not saved** |

## Communication Interfaces

| Item | Description |
| ---- | ---- |
| AT mode | USB CDC virtual serial port, usually driver-free, `115200 / 8 / None / 1` |
| SCPI mode | USB TMC, driver installation required (NI‑VISA recommended) |
| Firmware upgrade | USB (DFU bootloader mode), can be entered with the rear panel DFU button or a command |

See [Communication Mode Switching](../quickstart/modeswitch.md) for switching communication modes.

## Electrical and Mechanical

| Item | Description |
| ---- | ---- |
| Power supply | USB-powered, max. approx. 2.5 W (500 mA) |
| Output terminals | Front-panel 4 mm banana jacks, 2 × Sense + 2 × Output, not polarity-sensitive |
| Data interface | Rear-panel USB-B |
| Panel | Rear panel: power LED, DFU button |

## Temperature Measurement

An onboard NTC temperature sensor allows you to query the current, maximum, minimum, and average temperature via AT / SCPI (resolution 0.1 °C).

## Accuracy

Every unit is fully accuracy-tested before it leaves the factory and ships with a **factory accuracy test
report** (format shown below).

| Item | Description |
| ---- | ---- |
| Factory accuracy | **±(0.1% × setpoint + 1 Ω)** |
| Test range | 10 Ω ~ 4 MΩ, log-uniform setpoints (20 per decade, 113 points), rounded to 1 Ω |
| Measurement | 4-wire, 6½-digit DMM (e.g. Agilent 34410A) |
| Pass criterion | Every test point inside the tolerance |

The tolerance is a curve: the absolute term (1 Ω) dominates at the low end and the percentage term (0.1%)
at the high end — about ±1.01 Ω (±10.1%) at 10 Ω, ±2 Ω (±0.2%) at 1 kΩ, and ±101 Ω (±0.101%) at 100 kΩ.

!!! warning "Accuracy degrades over time — recalibration is required"
    The factory accuracy is the specification **as shipped**. Two effects make the error grow over time:

    - **Relay contact resistance drift**: this dominates the low-resistance error (every output carries
      roughly 1~2 Ω of chain series resistance); re-measuring the same setpoint minutes later already
      shifts the whole curve by tens of mΩ.
    - **Calibration scale drift**: above 1 kΩ there is a residual proportional to the resistance, which
      moves with temperature and ageing.

    Recalibrate **every 12 months** (more often if low-resistance accuracy matters). Recalibration is done
    with the [calibration script](../reference/scripts/calibration.md) and a sufficiently accurate
    reference DMM; it corrects both the contact series resistance and the scale residual. The verification
    measurement is described in the [accuracy test script](../reference/scripts/accuracy.md).

### Factory accuracy report (format example)

The report ships with the device and contains the following. The data below is from the factory test of
one PPR26, **with serial numbers and similar identifiers removed**.

**① Device and test information**

| Field | Example value |
| ---- | ---- |
| Model | PPR26 |
| Serial number | *(removed in this example)* |
| Firmware / hardware version | FW 1.0.0 / HW 5 |
| Production date | *(removed in this example)* |
| Test date | 2026-10-14 |
| Reference meter | Agilent 34410A (*SN removed*), 4-wire |
| Device temperature | 28.7 °C |

**② Test setup**

| Item | Value |
| ---- | ---- |
| Sweep range | 10 Ω ~ 4 MΩ, log-uniform, rounded to 1 Ω |
| Test points | 113 (20 per decade) |
| Per point | Settle 5 s, 8 readings averaged, NPLC 10 |
| Acceptance limit | ±(0.1% × setpoint + 1 Ω) |

**③ Result summary**

| Range | Relative error | Absolute error bound | Verdict |
| ---- | ---- | ---- | ---- |
| 10 ~ 100 Ω | −1.77% ~ +0.38% | 0.47 Ω | Pass (quantisation steps at the low end) |
| 100 Ω ~ 1 kΩ | −0.29% ~ +0.29% | 0.64 Ω | Pass |
| 1 k ~ 10 kΩ | −0.055% ~ −0.001% | 1.74 Ω | Pass |
| 10 k ~ 100 kΩ | −0.032% ~ +0.046% | 28.8 Ω | Pass |
| 100 kΩ ~ 4 MΩ | −0.014% ~ +0.017% | 277 Ω | Pass |

**Verdict: pass** — 113/113 points inside ±(0.1% + 1 Ω); the worst point is 224 Ω
(−0.64 Ω = −0.29%, where the limit is ±1.22 Ω, i.e. 53% of the tolerance budget used).

**④ Accuracy distribution plot**

![PPR26 accuracy distribution example](../assets/accuracy_example.png)

**⑤ Notes**

- Blue dots are the DMM measurement and the red dashed curves are the acceptance limit ±(0.1% + 1 Ω):
  every point inside the curves means the unit passes.
- The large *relative* errors at the low end (10 ~ 100 Ω) are 1 Ω quantisation steps; the absolute error
  stays within the 1 Ω limit. See the [accuracy test script](../reference/scripts/accuracy.md) for how to
  read this.
- The figure in the report is generated from the test CSV, so it can be reproduced with the
  [accuracy test script](../reference/scripts/accuracy.md).

!!! note "Note"
    Complete specifications are subject to the actual product and the accompanying test report.
