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

The device ships with an **accuracy test report**; refer to the report for detailed specifications.

!!! note "Note"
    Complete specifications are subject to the actual product and the accompanying test report.
