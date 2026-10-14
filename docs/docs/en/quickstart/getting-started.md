# Getting Started

## Packing List

When you purchase the PPR26 Programmable Resistor kit, the package should contain the following items:

| Item | Quantity | Description |
| ---- | ---- | ---- |
| USB-A to USB-B cable | 1 | For power supply and data communication |
| PPR26 Programmable Resistor | 1 | The instrument itself |
| Two-wire banana jack to alligator clip cable | 1 | For connecting the output |
| User manual | 1 | Brief usage instructions; for details, scan the QR code to navigate to this online documentation |
| Accuracy test report | 1 | Accuracy test report after factory calibration |

## Connecting to a PC

Connect the PPR26 to a PC with the included USB-A to USB-B data cable. The PPR26 only requires a maximum of 2.5W of power, so it can be powered entirely by the PC.

After power is connected, the green power LED on the rear panel lights up.

!!! warning "Caution"
    Do not use a USB extension cable. The PPR26 draws a maximum current of 500mA; excessive cable resistance causes too large a supply voltage drop, and the device may not work properly.

## Front Panel

The front panel of the device has two Sense terminals and two Output terminals; polarity does not matter, and the connector type is a 4mm banana jack.

## Rear Panel

From left to right, the rear panel of the device has the USB-B power and data interface, the power LED, and the DFU mode button.

## Getting Started

After connecting the PPR26 to a PC, you can get started in the following ways:

- **Web serial console** (no installation required, AT mode required): see [Serial Console (Web)](../software/webui_serial.md).
- **Python programming**: see [AT Python Example](../reference/python_at.md) and [SCPI Python Example](../reference/python_scpi.md).

For an explanation of communication modes and how to switch them, see [Communication Mode Switching](modeswitch.md); for firmware upgrade, see [Firmware Upgrade Guide](fwupgrade.md).
