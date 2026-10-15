# NTC Simulator (Web)

The web NTC simulator uses the PPR26 as a **thermistor**: it converts a temperature into a
resistance with the NTC model you choose and applies it to the device, and it can also convert a
resistance back to a temperature, step the temperature up/down, and plot the
temperature-resistance curve. **No installation required**, and everything still works — except
applying values — without a device.

URL: <https://akkako.github.io/PPR26_Docs/ntcsim/>

!!! note "Requirements"
    - Browser: **Chrome / Edge 109 or newer**; any modern browser works for calculations and the curve.
    - To apply resistances the device must be in **AT mode** — see [Switching Communication Modes](../quickstart/modeswitch.md).
    - The device can output **5 ohm .. 4 Mohm**; values outside that range are not sent (the reason goes to the AT log).

## Before You Start

1. Decide on the NTC parameters to emulate: R25 and B from a datasheet, a few calibration points, or a CSV data file.
2. If you will apply values: put the device in AT mode and close any other program that uses the port.
3. Open <https://akkako.github.io/PPR26_Docs/ntcsim/> in Chrome or Edge.

The two buttons at the top right switch the **light/dark theme** and the **Chinese/English UI**; both
are stored locally and shared with the other web tools. The **←** button returns to the
[Tools Center](https://akkako.github.io/PPR26_Docs/).

## Connecting

1. Click **Connect Device**.
2. Pick the PPR26 from the device list.
3. The status turns to **Connected**, and the device details and internal temperature appear on the same row.

!!! tip "Device not listed?"
    - Make sure the device is in **AT mode**: devices in other modes do not appear in the port list.
    - Check that the device is plugged in and that no other program (serial tool, Python script, another browser tab) holds the port.
    - Open the page over `https://` or `http://localhost` — other origins disable serial access.

The device **does not remember the last setpoint**: after a power cycle or a reconnect the output is
open and the setpoint is back at its default. With **Auto apply** enabled, the page re-sends the
current simulated point right after connecting.

## Firmware Version Check

After connecting, if the device firmware is older than the current release, the page shows a
**non-dismissable** notice and switches the device into upgrade mode for you. Just follow these steps:

1. The device disconnects and restarts as an upgrade device — the page returning to "Disconnected"
   and the port disappearing from the list are both normal;
2. Click **Go to Upgrade** in the notice and follow the upgrade tool;
3. Reconnect the device afterwards and the notice disappears; if you already upgraded and the notice
   is still there, click **Check Again** to re-verify.

When the firmware matches the release — or the device is newer (e.g. a development build) — **no notice
appears** and you can use the page normally. For the full description see [Serial Console (Web)](webui_serial.md).

## Screen Layout

The page has three columns (narrow screens stack them into two columns / one column):

| Area | Content |
| ---- | ---- |
| **Top (connect row)** | Connect / Disconnect and status, plus the device details on the same row: model / serial / firmware / hardware, **internal temperature**, output state (wraps when narrow) |
| **Left · NTC Model** | Three modelling methods (pick one; B-value and SH each have "enter parameters / fit points" sub-methods), parameter fields and calibration-point table, CSV import; **parameter cards** for the active model at the bottom |
| **Left · Device Limit Window** | Enable limits, minimum/maximum resistance, write limits — see [Device Limit Window](#device-limit-window) |
| **Middle · Temperature Console** | Simulated temperature (large), the four readouts below it (Target / SP / PV / TP), temperature input with Calculate/Apply, Auto apply, temperature stepping, resistance-to-temperature |
| **Right · Curve** | Temperature-resistance curve, markers for the simulated point and the device's actual value, allowed-window band; hover readout, click or drag to pick a point, plus the "Log resistance axis" and "Auto apply" switches |
| **Bottom · AT Log** | Collapsed by default. The page shows no message text at all; expand this when you need to know why something did not happen |

## Choosing an NTC Model (pick one of three)

Only one modelling method is active at a time; switching updates the curve and all conversions.

### B-value

For datasheets, with three input methods (sub-tabs; only the selected one is shown):

| Sub-method | What you enter | Notes |
| ---- | ---- | ---- |
| **Enter R25/B** | R25 (resistance at 25 C) and B (e.g. 3435 K) | The two standard datasheet parameters |
| **From 2 points** | Two (temperature, resistance) pairs | The model is defined by these two points |
| **Multi-point fit** | 2+ calibration points | More points are more robust; 5+ recommended. The panel shows the residual per point |

### Steinhart-Hart

| Sub-method | What you enter | Notes |
| ---- | ---- | ---- |
| **A + B + C** | The three coefficients | Use vendor coefficients or ones you fitted elsewhere (scientific notation such as `3.2e-8` can be pasted directly) |
| **Fit points** | 3+ calibration points | More points are more robust; 5+ recommended. The panel shows the residual per point |

The coefficients follow `1/T = A + B*ln R + C*(ln R)^3` (T in kelvin, R in ohm); the hover tips on the
three inputs show typical magnitudes. The **residual** tells you how far the model is from your
calibration data: mK-level residuals mean a very good fit, while clearly larger ones usually mean a
wrong point (mismatched temperature and resistance, or duplicated temperatures). A **not monotonic**
warning in the summary means the coefficients need checking.

### Import CSV

Pick or drop a data file, then choose one of two ways to use it:

| Sub-mode | Description |
| ---- | ---- |
| **Interpolate raw data** (default) | Converts directly from your data points with no fit error; **temperatures outside the data range cannot be converted** |
| **Fit as SH equation** | Derives one coefficient set from the same data, which can then cover a wider temperature range |

The CSV format is forgiving:

- Two columns per row: `temperature (C), resistance (ohm)`;
- Comma, semicolon or tab separators;
- Lines starting with `#` are ignored; header and other non-numeric rows are skipped automatically;
- At least 2 data points (3+ for the SH fit).

Example:

```csv
# 10k NTC calibration data
t_c,r_ohm
0,28443.5
25,10000
50,4112.3
85,1451.3
100,984.5
```

### Current Model Parameters

The bottom of the left column shows the active model as a grid of **parameter cards** — one value per
card, so you can verify the model at a glance:

| Card | Content |
| ---- | ---- |
| **R25** / **B** (or **A / B / C**) | The model parameters currently in effect |
| Two cards named after the range ends, e.g. **-40 C** / **125 C** | The resistance at both ends of the temperature range (follows the range fields live) |
| **Points** / **Residual** | Number of calibration points and the fit residual in the fitting sub-methods (mK level means a very good fit) |
| **Check** | Shown full-width when the coefficients are not monotonic or the parameters are invalid |

Numbers are shown with 4 significant digits so the magnitude is readable at a glance; the full values
are in the input fields and the readouts.

## Temperature and Resistance

### Semantics (read this table first)

| Action | Updates the simulated point | Sends to the device |
| ---- | ---- | ---- |
| Enter a temperature and click **Calculate** (or press Enter) | yes | **when Auto apply is on** |
| **- Step** / **+ Step** (step size is editable) | yes | **when Auto apply is on** |
| Scroll the mouse wheel over the curve (+1 step up / -1 step down) | yes | **when Auto apply is on** |
| Click / drag on the curve to pick a point | yes | **when the curve's Auto apply is checked**, on release |
| **Use as temperature** (from a resistance) | yes | no (updates only) |
| **Apply** | no | **always sends** the current target |

**Auto apply** (on by default) decides whether Calculate/Step also send the value; when it is off,
every send requires pressing **Apply**. The switch is remembered in the browser.

!!! tip "The colour of the large temperature is the send status"
    **Green = computed locally only** (nothing has been sent; the terminals are unchanged);
    **red = already sent** (the device is outputting that resistance). Picking a point on the curve
    (unless the curve's Auto apply is checked) and the resistance-to-temperature conversion only update
    the local point, so the value stays green; pressing Calculate / Step / Apply — or picking a point
    with the curve's Auto apply checked — turns it red. One glance tells "computed" from "sent".

!!! note "The page shows no message text at all"
    Everything — including *why* something did not happen (invalid input, out of range, outside the
    limit window, device rejection, not connected) — goes only to the collapsed **AT log** at the
    bottom. The UI stays clean; expand the log when you need to diagnose.

### Applying the Resistance of a Temperature

1. Type a temperature (e.g. `85`) and click **Calculate** (or press Enter).
2. The small readout row under the simulated temperature gives four values: **Target** (the resistance
   the model computed), **SP** (the device's setpoint), **PV** (the device's estimate of its actual
   output) and **TP** (the temperature that PV corresponds to). The block always occupies two rows, so
   changing values never shift the buttons below.
3. With **Auto apply** on, step 1 already sent it; otherwise press **Apply**.

Two limits decide what can be output, and **the simulated point always stays within what the device
can really output**:

- The **hardware range (5 ohm .. 4 Mohm) always applies**: when the resistance for a temperature falls
  outside it, the simulated point is clamped to the boundary (e.g. a 20 ohm model asked for 125 C can
  only go to about 66 C / 5 ohm), and the AT log records why;
- The **device limit window** (once limits are enabled — see [Device Limit Window](#device-limit-window))
  narrows it further, with the same rule;
- With no device connected the page only computes locally (the large temperature stays green).

### Stepping the Temperature

1. Set the **step size** (default 1.0 C; smaller values such as 0.1 are fine).
2. **- Step** / **+ Step** move the temperature by that step and (with Auto apply on) send it.
3. At the range boundary the value **stops at the boundary** (a line is written to the log) — no
   out-of-range command is ever sent.

### Resistance to Temperature

Enter a resistance in **Resistance -> temperature** (unit selectable: ohm / kohm / Mohm):

- The corresponding temperature is shown live as you type;
- **Use as temperature** adopts it as the simulated point (nothing is sent; press **Calculate** or
  **Apply** afterwards).

### Target Value vs. What the Device Actually Outputs

The device can only output **discrete** resistance values, so what you request and what you get differ
slightly. The page therefore shows both:

- **Target**: the resistance the model computed, and what gets sent;
- **PV** and **TP**: the device's estimate of its actual output and the temperature that corresponds to.

Measured reference (10 kohm / B25/85 = 3435 K model, 4-wire, 6 readings averaged):

| Simulated | Requested | Measured | Error | Temperature equivalent |
| ---- | ---- | ---- | ---- | ---- |
| 0 C | 28.704290 kohm | 28.700147 kohm | -4.14 ohm | +0.003 C |
| 25 C | 10.000000 kohm | 10.000618 kohm | +0.62 ohm | -0.002 C |
| 50 C | 4.101190 kohm | 4.099628 kohm | -1.56 ohm | +0.012 C |
| 85 C | 1.451347 kohm | 1.450563 kohm | -0.78 ohm | +0.020 C |
| 100 C | 987.037 ohm | 986.393 ohm | -0.64 ohm | +0.026 C |
| 125 C | 553.740 ohm | 553.358 ohm | -0.38 ohm | +0.032 C |

All of these are within the device's own accuracy specification, and the temperature equivalent is at
most about 0.03 C. **The lower the resistance, the more visible the same absolute deviation becomes in
temperature** — that is a limit of the device itself, not a calculation error; the PV / TP values tell
you the actual result.

## The Curve

- **X axis**: temperature (default -40 .. 125 C; editable at the top right of the curve card);
- **Y axis**: resistance, **logarithmic** by default (NTC resistance spans decades); uncheck to switch to linear;
- **Blue line**: the current model (in CSV interpolation mode only the data range is drawn);
- **Filled dot ●**: the current simulated point (temperature and target resistance);
- **Hollow dot ○**: where the device's actual output is (shown once connected, so the deviation is visible);
- **Shaded band ▓**: the device's allowed window (shown once limits are enabled — see the next section);
- **Hover**: a (temperature, resistance) readout for that position (it disappears when you move away);
- **Mouse wheel**: one notch up **increases** the temperature by one step, one notch down
  **decreases** it (same semantics as the -/+ Step buttons, bound by the step size and the temperature
  range; the page does not scroll while the pointer is over the chart);
- **Click**: sets that temperature as the simulated point; **hold the left button and drag**: the
  simulated point follows the cursor horizontally, and releasing finalises it.
  Whether it is sent is controlled by **Auto apply** at the top right of the curve card: when
  **checked**, releasing sends it immediately (a drag sends only once, on release, so the device is
  never driven continuously); when **unchecked** (the default) it only updates the temperature — press
  **Apply** or **Calculate** to send.
  A picked point is clamped to **what the device can really output** (the hardware range 5 ohm ..
  4 Mohm always applies, the limit window narrows it further), so a picked point is **guaranteed to be
  accepted** by the device;
- **Height**: the curve adapts to the card size; text inside the chart cannot be selected, so dragging
  only moves the simulated point.

## Device Limit Window

This card (below the model card) brings the device's resistance limit window into the page:

| Control | Effect |
| ---- | ---- |
| **Enable limits** | Ticking or clearing takes effect immediately. Once enabled, setpoints outside the window are **rejected by the device** |
| **Minimum / Maximum** | The window bounds, with a unit selector (ohm / kohm / Mohm) |
| **Write limits** | Writes both bounds to the device (minimum must not exceed maximum) |

Steps: enter minimum and maximum -> click **Write limits** -> tick **Enable limits** when you want the
restriction to take effect.

Notes:

- **Limits are stored in the device and survive power cycles** (the setpoint is not). Clear the switch
  when you no longer need limits, and write the range back to 5 ohm .. 4 Mohm if you like.
- The window is shown **directly on the curve**: a shaded band marks the allowed region, so you can see
  at a glance whether the simulated point is inside it.
- A simulated point outside the window is blocked before it is sent (no command that would be rejected
  is ever issued); the reason goes to the AT log.
- These controls are unavailable while no device is connected — limits live in the device and cannot be
  changed offline.

## AT Log

The **AT Log** at the bottom is collapsed by default. Expanded, it shows every exchange with the device
plus all the "why it did not happen" explanations (invalid input, out of range, outside the limit
window, device rejection, not connected). Expand it when you need to diagnose.

## Troubleshooting

**Can I use it without a device?**

Yes. Modelling, conversions, stepping, the curve and the inverse conversion all work offline; only
*sending* needs a connection. Without a device, **Calculate** / Step just compute locally and the large
temperature stays green.

**I pressed Calculate but the device did not change.**

Look at the colour of the large temperature first: **green means it was only computed, not sent**.
Check whether **Auto apply** is on (if not, press **Apply**), then expand the AT log to see whether the
value was rejected.

**"Outside the device range" / "outside the limit window"**

The result is outside what the device can output (5 ohm .. 4 Mohm), or outside the limit window you
set. Adjust the temperature range, check the model parameters, or change the limit window.

**"Outside the calibration data range"**

CSV is in *Interpolate raw data* mode, which only works inside the data's temperature range. Use
**Fit as SH equation** for a wider range (extrapolation is indicative only).

**PV differs from the target resistance.**

The device can only output discrete resistance values, so there is an inherent difference from what you
request. The **TP** line shows that difference folded into temperature; it is more visible at low
resistances, where the absolute error dominates.

**B-value or Steinhart-Hart?**

The two can cross-check each other: start with the datasheet R25/B, then fit with SH once you have
calibration data and compare the residuals. As a rule of thumb: B-value for in-range work at modest
accuracy; SH (or a CSV fit) when you need a wide temperature span or higher accuracy.

**Are settings lost when I switch language/theme?**

No. Theme, language and the Auto apply switch are stored in the browser and shared with the other web
tools.

## Limitations

- **AT mode only**; use an SCPI host tool in SCPI mode.
- The temperature shown on the page is a **simulated value**, not a device measurement; the device's own
  internal temperature is in the top info row.
- Setpoints and open/short states are **not stored**: after a power cycle the output is open and the
  setpoint is back at its default; reconnect and send again (with Auto apply the page does it for you).
- The **device limit window is stored in the device** and survives power cycles; this page only writes
  it and never restores defaults on its own.
- Model parameters (R25/B, A/B/C, calibration points, CSV data) **live in the page only** — reloading
  restores the defaults. Keep the parameters in a file for long-term use.
- Device details are read when connecting; the internal temperature keeps refreshing; other settings
  follow your actions.
- Wiring and contact resistance are outside the conversion; mind the lead resistance at low resistances
  (below ~100 ohm).
- The device can only output **5 ohm .. 4 Mohm** (hardware range): when a conversion falls outside it,
  the page clamps the simulated point to the boundary, so you can never pick a value the device cannot
  produce.
