# SCPI 命令参考

## 相关信息

### 仪器驱动程序

本仪器使用 **USB TMC**（USBTMC）通信，推荐安装 **NI-VISA** 驱动库以建立仪器通信。

### 上位机与脚本

本仪器提供基于 Python 的用户校准与测试脚本，可参考：[校准脚本](./script_calibration.md)、[测试脚本](./script_test.md)。

### 编程示例

本仪器提供基于 Python 的编程示例：[SCPI Python 编程示例](./python_scpi.md)。

## SCPI 语言简介

本仪器遵守当前 SCPI 版本的规则和约定（请参见 `SYSTem:VERSion?`）。SCPI 命令分为两类：

- **子系统命令**：执行特定仪器功能，按树状层次组织，例如：

  ```text
  OUTPut
      [:STATe] NORMal|SHORt|OPEN
  RESIstance
      [:LEVel][:IMMediate][:AMPLitude] <值>
      :LIMit
          :MINimum <值>
  ```

- **IEEE‑488.2 通用命令**：以 `*` 开头、长度为 3 个字符，用于复位、自检与状态操作，例如 `*IDN?`、`*RST`。

### 关键字

关键字（标题）**大小写不敏感**，短格式为大写部分、长格式为完整单词，两者等价。例如 `OUTP` 与 `OUTPUT` 均可，`OUT` 无效。

### 查询

在关键字后加 `?` 构成查询（如 `RES?`）。必须在发送下一条命令前读回所有查询结果，否则会因 Query Interrupted 丢失数据。

### 分隔符与终止符

- 冒号 `:` 分隔关键字层级；空格分隔关键字与其参数。
- 分号 `;` 可在同一消息中分隔多条命令，例如 `OUTP NORM;RES 523000`。
- 命令字符串必须以换行 `<LF>`（`\n`）结尾；`<CR><LF>` 也可接受。

### 参数类型

| 类型       | 说明                                       |
| ---------- | ------------------------------------------ |
| `<NR1>`    | 十进制整数（阻值单位 **mΩ**）              |
| `<NR2>`    | 带小数的十进制数（温度单位 ℃）            |
| `<bool>`   | `0` / `1` / `OFF` / `ON`，查询返回 `0`/`1` |
| `<str>`    | 字符串，建议使用双引号                     |
| `<离散值>` | 枚举助记符，如 `NORMal`、`SHORt`           |

> 阻值统一使用**毫欧（mΩ）**整数，有效范围 **5 Ω ~ 4 MΩ**，不使用 `OHM/KOHM/MOHM` 单位后缀。
> 下文示例中 `→` 表示查询返回内容。

---

## 通用命令（IEEE 488.2）

### `*IDN?` — 识别查询

- **命令形式**：`*IDN?`
- **返回**：`<厂商>,<型号>,<序列号>,<固件版本>`
- **示例**：

  ```text
  *IDN?
  → akaInstruments,PPR26,87043057485172710671FF49,FW 1.0.0
  ```

### `*RST` — 复位

- **命令形式**：`*RST`
- **说明**：恢复设置区默认值（阻值、限值、步进、补偿模式、输出状态、协议），**不清除**校准数据。
- **示例**：`*RST`

### `*SAV` — 保存设置

- **命令形式**：`*SAV`
- **说明**：将当前设置保存到非易失存储。

### `*CLS` — 清除状态

- **命令形式**：`*CLS`
- **说明**：清除状态寄存器与错误队列。

### `*ESE[?]` — 标准事件状态使能

- **命令形式**：`*ESE <NR1>` / `*ESE?`
- **参数**：`<NR1>` 使能位掩码
- **返回**：查询返回 `<NR1>`

### `*ESR?` — 标准事件状态寄存器

- **命令形式**：`*ESR?`
- **返回**：`<NR1>`

### `*OPC` / `*OPC?` — 操作完成

- **命令形式**：`*OPC` / `*OPC?`
- **返回**：`*OPC?` 返回 `1`

### `*SRE[?]` — 服务请求使能

- **命令形式**：`*SRE <NR1>` / `*SRE?`
- **返回**：查询返回 `<NR1>`

### `*STB?` — 状态字节

- **命令形式**：`*STB?`
- **返回**：`<NR1>`

### `*TST?` — 自检

- **命令形式**：`*TST?`
- **返回**：`0` 表示通过

### `*WAI` — 等待

- **命令形式**：`*WAI`

---

## SYSTem 子系统

### 通信协议 `SYSTem:PROTocol`

- **命令形式**：`SYST:PROT {AT|SCPI}` / `SYST:PROT?`
- **参数**：`AT`（USB CDC）、`SCPI`（USB TMC）
- **返回**：查询返回 `AT` / `SCPI`
- **说明**：设置后保存并**运行时切换**：设备断开/重连 USB 后重新枚举，不复位 MCU。

**示例**

```text
SYST:PROT?
→ SCPI
```

### 补偿模式 `SYSTem:COMPensate`

- **命令形式**：`SYST:COMP {UNCAL|LIN|PREC}` / `SYST:COMP?`
- **参数**：`UNCAL`（不补偿）、`LIN`/`LINear`（附近值）、`PREC`/`PRECise`（多档位最佳）
- **返回**：查询返回 `UNCAL` / `LINEAR` / `PRECISE`
- **错误**：非法离散值 → `-224`

**示例**

```text
SYST:COMP PREC
SYST:COMP?
→ PRECISE
```

### 温度测量 `SYSTem:TEMPerature`

- **命令形式**：
  - `SYST:TEMP?` 当前温度
  - `SYST:TEMP:AVER?` 平均温度
  - `SYST:TEMP:MIN?` 最低温度
  - `SYST:TEMP:MAX?` 最高温度
  - `SYST:TEMP:RES` 清空统计
- **返回**：查询返回 `<NR2>` 摄氏度
- **说明**：统计自开机或上次 `SYST:TEMP:RES` 起累计。

**示例**

```text
SYST:TEMP?
→ 29.1

SYST:TEMP:MAX?
→ 30.2
```

### 设备信息 `SYSTem:INFOrmation`

| 命令              | 参数 | 返回    | 说明                             |
| ----------------- | ---- | ------- | -------------------------------- |
| `SYST:INFO:SN?`   | 无   | `<str>` | 序列号（24 个大写十六进制字符）  |
| `SYST:INFO:MOD?`  | 无   | `<str>` | 型号（`PPR26`）                  |
| `SYST:INFO:MAN?`  | 无   | `<str>` | 生产日期 `YY-WW`                 |
| `SYST:INFO:HVER?` | 无   | `<str>` | 硬件版本 `0`-`6`                 |
| `SYST:INFO:FVER?` | 无   | `<str>` | 固件版本                         |
| `SYST:INFO:POW?`  | 无   | `<NR1>` | 上电次数                         |
| `SYST:INFO:TIME?` | 无   | `<NR1>` | 累计通电时间（分钟）             |

**示例**

```text
SYST:INFO:MOD?
→ PPR26
```

### 错误与版本

- `SYST:ERR?` — 弹出并返回错误队列中最早的一条，格式 `<错误码>,"<错误信息>"`；无错误时返回 `0,"No error"`。
- `SYST:ERR:COUN?` — 错误队列中的错误个数。
- `SYST:VERS?` — SCPI 版本号。

**示例**

```text
SYST:ERR?
→ 0,"No error"
```

---

## STATus 子系统

状态寄存器用于查询仪器运行状态。命令形式如下：

| 命令                              | 参数      | 返回    | 说明                |
| --------------------------------- | --------- | ------- | ------------------- |
| `STAT:OPER?`                      | 无        | `<NR1>` | 操作状态事件        |
| `STAT:OPER:COND?`                 | 无        | `<NR1>` | 操作状态条件        |
| `STAT:OPER:ENAB <NR1>` / `?`      | `<NR1>`   | `<NR1>` | 操作状态使能        |
| `STAT:QUES?`                      | 无        | `<NR1>` | 可疑状态事件        |
| `STAT:QUES:COND?`                 | 无        | `<NR1>` | 可疑状态条件        |
| `STAT:QUES:ENAB <NR1>` / `?`      | `<NR1>`   | `<NR1>` | 可疑状态使能        |
| `STAT:PRES`                       | 无        | 无      | 状态预置            |

---

## OUTPut 子系统

### 输出状态 `OUTPut[:STATe]`

- **命令形式**：`OUTP {NORM|SHOR|OPEN}` / `OUTP?`
- **参数**：`NORM`/`NORMal`（电阻网络输出）、`SHOR`/`SHORt`（直接短路）、`OPEN`（开路）
- **返回**：查询返回 `NORM` / `SHOR` / `OPEN`
- **说明**：短路/开路**只能**通过本命令设置。
- **错误**：非法离散值 → `-224`

**示例**

```text
OUTP NORM
OUTP?
→ NORM
```

---

## RESIstance 子系统

### 设定阻值 `RESistance[:LEVel][:IMMediate][:AMPLitude]`

- **命令形式**：`RES <NR1>|MIN|MAX|UP|DOWN` / `RES?`
- **参数**：
  - `<NR1>`：阻值（mΩ），范围 5 Ω ~ 4 MΩ
  - `MIN` / `MAX`：当前允许范围的最小/最大值
  - `UP` / `DOWN`：当前值 ± `RES:STEP`
- **返回**：查询返回 `<NR1>` 当前设定值（mΩ）
- **说明**：限值使能时，设定值须落在 `[RES:LIM:MIN, RES:LIM:MAX]`；越界返回错误且保持原值。
- **错误**：越界 → `-902`

**示例**

```text
RES 523000
RES?
→ 523000

RES UP
RES?
→ 533000
```

### 步进值 `RESistance[:LEVel][:IMMediate]:STEP[:INCRement]`

- **命令形式**：`RES:STEP <NR1>|MIN|MAX` / `RES:STEP?`
- **参数**：`<NR1>` 步进值（mΩ）；`MIN` / `MAX` 取范围端点
- **返回**：查询返回 `<NR1>`
- **错误**：负值 → `-913`

**示例**

```text
RES:STEP 10000
RES:STEP?
→ 10000
```

### 阻值限值 `RESistance:LIMit:MINimum` / `MAXimum`

- **命令形式**：`RES:LIM:MIN <NR1>` / `RES:LIM:MIN?`；`RES:LIM:MAX <NR1>` / `RES:LIM:MAX?`
- **参数**：`<NR1>` 限值（mΩ），范围 5 Ω ~ 4 MΩ
- **返回**：查询返回 `<NR1>`
- **错误**：`MIN > MAX` → `-900`；`MAX < MIN` → `-901`；超出硬件范围 → `-913`

**示例**

```text
RES:LIM:MAX 1000000
RES:LIM:MIN 5000
RES:LIM:MIN?
→ 5000
```

### 限值使能 `RESistance:LIMit[:STATe]`

- **命令形式**：`RES:LIM:STAT <bool>` / `RES:LIM:STAT?`
- **参数**：`<bool>` `0`=关闭、`1`=使能
- **返回**：查询返回 `0` / `1`
- **说明**：使能后设定阻值必须落在限值内。

**示例**

```text
RES:LIM:STAT 1
RES:LIM:STAT?
→ 1
```

### 继电器网络 `RESistance:NETWork`

- **命令形式**：`RES:NETW <NR1>` / `RES:NETW?`
- **参数**：`<NR1>` 26 位继电器位图，范围 `0` ~ `67108863`
- **返回**：查询返回 `<NR1>`
- **说明**：直接操作继电器网络，绕过补偿算法，并同步更新估测值；用于产测/校准。
- **错误**：超出范围 → `-913`

**示例**

```text
RES:NETW 0
RES:NETW?
→ 0
```

---

## 校准命令（用户校准）

PPR26 使用一套**用户校准数据**修正输出精度，用户可自行校准，校准数据独立保存。

!!! warning "注意"
    校准不当会降低输出精度与可靠性，请在具备参考标准的情况下进行。设备另有一套仅供出厂使用的校准数据，不对外开放，也不会被用户校准命令修改。

### 校准使能 `CALibration:ENABle`

- **命令形式**：`CAL:ENAB <bool>` / `CAL:ENAB?`
- **参数**：`<bool>` `0`=退出、`1`=进入校准模式
- **返回**：查询返回 `0` / `1`
- **说明**：写入校准数据的前置条件，**不持久化**。

**示例**

```text
CAL:ENAB 1
CAL:ENAB?
→ 1
```

### 用户密码 `CALibration:USER:PASSword`

- **命令形式**：`CAL:USER:PASS <str>` / `CAL:USER:PASS?`
- **参数**：`<str>` 密码，最长 64 字节；空字符串表示清除（默认解锁）
- **返回**：查询返回 `0` / `1`（是否已设密码，不返回明文）
- **错误**：超长 → `-916`

**示例**

```text
CAL:USER:PASS "1234"
CAL:USER:PASS?
→ 1
```

### 解锁 `CALibration:USER:UNLock`

- **命令形式**：`CAL:USER:UNL <str>`
- **参数**：`<str>` 用户密码；密码为空时可直接解锁
- **错误**：密码错误 → `-915`

**示例**

```text
CAL:USER:UNL "1234"
```

### 锁定 `CALibration:USER:LOCK`

- **命令形式**：`CAL:USER:LOCK <bool>` / `CAL:USER:LOCK?`
- **参数**：`<bool>` `1`=锁定、`0`=解锁
- **返回**：查询返回 `0` / `1`

**示例**

```text
CAL:USER:LOCK 1
CAL:USER:LOCK?
→ 1
```

### 校准档位 `CALibration:USER:GEAR`

- **命令形式**：`CAL:USER:GEAR <NR1>` / `CAL:USER:GEAR?`
- **参数**：`<NR1>`，范围 `0`..`27`（见下表）；设置时同时应用对应继电器
- **返回**：查询返回 `<NR1>`
- **错误**：超出范围 → `-905`

| 档位      | 含义                       |
| --------- | -------------------------- |
| `0`..`25` | 单路电阻（闭合对应继电器） |
| `26`      | 串联短路                   |
| `27`      | 直接短路                   |

**示例**

```text
CAL:USER:GEAR 0
CAL:USER:GEAR?
→ 0
```

### 档位阻值 `CALibration:USER:VALue`

- **命令形式**：`CAL:USER:VAL <NR1>` / `CAL:USER:VAL?`
- **参数**：`<NR1>` 当前档位的实测阻值（mΩ）
- **返回**：查询返回 `<NR1>`
- **说明**：受写保护约束（需 `CAL:ENAB 1` 且未锁定）。

**示例**

```text
CAL:USER:VAL 5230
CAL:USER:VAL?
→ 5230
```

### 校准次数 `CALibration:USER:COUNt?`

- **命令形式**：`CAL:USER:COUN?`
- **返回**：`<NR1>` 校准次数；每次 `CAL:USER:SAVE` 加 1。

**示例**

```text
CAL:USER:COUN?
→ 3
```

### 校准日期 `CALibration:USER:DATE`

- **命令形式**：`CAL:USER:DATE <str>` / `CAL:USER:DATE?`
- **参数**：`<str>` 日期字符串，最长 64 字节；空字符串表示清除
- **返回**：查询返回 `<str>`
- **错误**：超长 → `-912`

**示例**

```text
CAL:USER:DATE "2026-09-29"
CAL:USER:DATE?
→ "2026-09-29"
```

### 校准备注 `CALibration:USER:STRing`

- **命令形式**：`CAL:USER:STR <str>` / `CAL:USER:STR?`
- **参数**：`<str>` 备注字符串，最长 64 字节；空字符串表示清除
- **返回**：查询返回 `<str>`
- **错误**：超长 → `-912`

**示例**

```text
CAL:USER:STR "user-cal"
CAL:USER:STR?
→ "user-cal"
```

### 校准时温度 `CALibration:USER:TEMPerature?`

- **命令形式**：`CAL:USER:TEMP?`
- **返回**：`<NR2>` 摄氏度，为最近一次 `SAVE` 时记录的温度。

**示例**

```text
CAL:USER:TEMP?
→ 29.5
```

### 保存校准数据 `CALibration:USER:SAVe`

- **命令形式**：`CAL:USER:SAVE`
- **说明**：保存当前档位校准数据，校准次数 +1、记录温度并落盘。受写保护约束（需 `CAL:ENAB 1` 且未锁定）。
- **错误**：未使能或已锁定 → `-907`；保存失败 → `-908`

**示例**

```text
CAL:USER:SAVE
```

---

## 错误码

命令错误或执行错误会进入错误队列，可用 `SYST:ERR?` 依次读出。

标准错误（节选）：

| 码   | 含义                    |
| ---- | ----------------------- |
| -109 | Missing parameter       |
| -113 | Undefined header        |
| -222 | Data out of range       |
| -224 | Illegal parameter value |
| -363 | Input buffer overrun    |

设备自定义错误：

| 码   | 含义                                     |
| ---- | ---------------------------------------- |
| -900 | Resistance limit minimum exceeds maximum |
| -901 | Resistance limit maximum below minimum   |
| -902 | Resistance value out of limit range      |
| -903 | Resistance step size too large           |
| -904 | Calibration mode not set                 |
| -905 | Calibration mode invalid                 |
| -906 | Calibration data invalid                 |
| -907 | Calibration locked or not in setup mode  |
| -908 | Calibration save failed                  |
| -909 | Compensation mode invalid                |
| -910 | Output mode invalid                      |
| -911 | Temperature sensor error                 |
| -912 | String parameter too long                |
| -913 | Value out of allowed range               |
| -914 | Calibration data corrupted               |
| -915 | Password incorrect                       |
| -916 | Password too long                        |

---

## 典型流程示例

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

CAL:ENAB 1
CAL:USER:UNL "1234"
CAL:USER:GEAR 0
CAL:USER:VAL 5230
CAL:USER:DATE "2026-09-29"
CAL:USER:STR "user-cal"
CAL:USER:SAVE
CAL:ENAB 0
```
