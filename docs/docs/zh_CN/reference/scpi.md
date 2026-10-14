# SCPI 命令参考

## 相关信息

### 仪器驱动程序

本仪器使用 **USB TMC**（USBTMC）通信，推荐安装 **NI-VISA** 驱动库以建立仪器通信。

设备在 USB TMC 模式下的 VID:PID 为 `0xFFFE:0xFFFF`，资源形如
`USB0::0xFFFE::0xFFFF::<序列号>::0::INSTR`。

!!! note "资源串"
    NI-VISA 的自动探测**可能列不出本设备**，请优先在程序中**显式指定资源串**，不要只依赖 `list_resources()` 的自动搜索结果。

### 上位机与脚本

本仪器提供基于 Python 的用户校准与测试脚本，可参考：[校准脚本](scripts/calibration.md)、[测试脚本](scripts/test.md)。

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

长格式也可以只写一部分，只要包含完整的大写部分：`RES`、`RESI` …… `RESISTANCE` 都合法。

### 查询

在关键字后加 `?` 构成查询（如 `RES?`）。必须在发送下一条命令前读回所有查询结果，否则会因 Query Interrupted 丢失数据。

### 分隔符与终止符

- 冒号 `:` 分隔关键字层级；空格分隔关键字与其参数。
- 分号 `;` 可在同一消息中分隔多条命令，例如 `OUTP NORM;RES 523000`。
- 命令字符串必须以换行 `<LF>`（`\n`）结尾；`<CR><LF>` 也可接受。
- 单词符（字符串参数内容）区分大小写；命令助记符不区分大小写。
- 单条消息的输入缓冲区为 **512 字节**，超长内容会被丢弃并使命令解析失败。

### 参数类型

| 类型       | 说明                                       |
| ---------- | ------------------------------------------ |
| `<NR1>`    | 十进制整数（阻值单位 **mΩ**）              |
| `<bool>`   | `0` / `1` / `OFF` / `ON`，查询返回 `0`/`1` |
| `<str>`    | 字符串，**必须**使用双引号                 |
| `<离散值>` | 枚举助记符，如 `NORMal`、`SHORt`           |

- 阻值统一使用**毫欧（mΩ）**整数，有效范围 **5 Ω ~ 4 MΩ**。
- 数值参数只接受 `<NR1>` 十进制整数（可带 `+`/`-`）：**不支持** `0x…` 前缀，也**不支持** `OHM / KOHM / MOHM` 等单位后缀，小数与指数形式会被拒绝。
- 字符串参数内容最长 64 字节，超长返回 `-912`。
- 温度查询返回的是**带双引号的字符串**（如 `"29.1"`），不是 `<NR2>` 数值。
- 下文示例中 `→` 表示查询返回内容。

---

## 通用命令（IEEE 488.2）

### `*IDN?` — 识别查询

- **命令形式**：`*IDN?`
- **返回**：`<厂商>,<型号>,<序列号>,<固件版本>`
- **示例**：

  ```text
  *IDN?
  → akaInstruments,PPR26,0123456789ABCDEF01234567,FW 1.0.0
  ```

### `*RST` — 复位

- **命令形式**：`*RST`
- **说明**：恢复默认配置（步进、限值及限值使能、补偿模式），并把输出置为**开路**、设定阻值回到默认 5 Ω；**不清除**校准数据、**不改变**通信协议与当前数据集选择、**不清空**上电统计。恢复后的配置项会立即写入非易失存储。
- **示例**：`*RST`

### `*SAV` — 保存设置

- **命令形式**：`*SAV`
- **说明**：把配置项（步进值、限值及使能、补偿模式、通信协议、数据集选择）写入非易失存储；这些项在设置时也已立即保存，`*SAV` 相当于再确认一次。设定阻值与输出状态属于运行态，**不在其中**（重新上电后为开路 + 默认设定值 5 Ω）。

!!! note "配置默认值与上电状态"
    - 配置项出厂默认：补偿模式 `PREC`、步进 `1000` mΩ（1 Ω）、限值使能 `0`、限值范围即满量程（5 Ω ~ 4 MΩ）、通信协议 `AT`、数据集 `USER`；`*RST` 会恢复到这些值（协议与数据集选择除外）。
    - 输出状态与设定值不保存：每次上电恒为 `OPEN`（开路）+ 设定值 5 Ω。

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

### 进入固件升级模式 `SYSTem:DFU`

- **命令形式**：`SYST:DFU`
- **参数**：无
- **返回**：无（命令执行后设备随即断开 USB）
- **说明**：**无需按键**即可让设备进入 **DFU（固件升级）模式**：设备自动断开 USB 并重启，随后以 `PPR26 WinUSB DFU`（`0xFFFE:0xFFFD`）重新枚举，等待上位机升级。
- **注意**：由于设备随即断开，**以设备是否重新枚举为 DFU 设备作为成功判据**；升级完成或重新上电后回到正常运行。升级步骤见[固件升级指南](../quickstart/fwupgrade.md)。

**示例**

```text
SYST:DFU
```

### 补偿模式 `SYSTem:COMPensate`

- **命令形式**：`SYST:COMP {UNCAL|NEAR|PREC}` / `SYST:COMP?`
- **参数**：`UNCAL`（不补偿）、`NEAR`/`NEARby`（附近最佳）、`PREC`/`PRECise`（多档位最佳，默认）
- **返回**：查询返回 `UNCAL` / `NEARBY` / `PRECISE`
- **说明**：默认 `PREC`；修改后**下次设置阻值（`RES`）时生效**，设置会被保存。`NEAR` 与 `PREC` 都会使用当前数据集（`CAL:SEL`）的校准数据，`UNCAL` 不做补偿；校准值为 0 时 `NEAR` 退化为标称映射、`PREC` 输出近似 `0` 档。
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
- **返回**：查询返回**带双引号的字符串**（摄氏度），例如 `"29.1"`
- **说明**：统计自开机或上次 `SYST:TEMP:RES` 起累计。温度返回的是字符串而非 `<NRf>` 数值，上位机读取时需按字符串处理（去掉引号后再转换）。

**示例**

```text
SYST:TEMP?
→ "29.1"

SYST:TEMP:MAX?
→ "30.2"
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

!!! warning "助记符拼写"
    第三级助记符必须按上表拼写：`MFD?` / `HWV?` / `FWV?` / `PWR?` 都**不是**合法命令，会返回 `-113`（Undefined header），应写成 `MAN?` / `HVER?` / `FVER?` / `POW?`。

应用运行期间不提供 Bootloader 版本查询（`SYST:INFO:FVER?` 返回的是当前应用固件的版本字符串）；Bootloader 版本可在 DFU 模式下由升级工具读取。

**示例**

```text
SYST:INFO:MOD?
→ PPR26
```

### 错误与版本

- `SYST:ERR?` — 弹出并返回错误队列中**最早**的一条，格式 `<错误码>,"<错误信息>"`；无错误时返回 `0,"No error"`。
- `SYST:ERR:COUN?` — 错误队列中的错误个数。
- `SYST:VERS?` — SCPI 版本号（本机返回 `1999.0`）。

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
- **说明**：输出状态与 AT 侧（`AT+RES.SHORT` / `AT+RES.OPEN`）**共用**；除本命令外，发送 `RES` 或 `RES:NETW` 也会把输出切回 `NORM`，校准时的 `CAL:USER:GEAR 26` / `27` 会直接驱动短路通路。输出状态**不跨上电保持**——每次上电的初始输出恒为 `OPEN`（开路）并应用到继电器，需重新发送 `RES` 或 `OUTP NORM` 才回到电阻网络输出。
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
  - `MIN` / `MAX`：当前允许范围的**最小/最大值**（把设定值取到范围端点）
  - `UP` / `DOWN`：当前值 ± `RES:STEP`；运算结果超出允许范围时**不改变当前值**并报 `-902`（设备不做边界钳位）
- **返回**：查询返回 `<NR1>` 当前设定值（mΩ）
- **说明**：限值使能时，设定值须落在 `[RES:LIM:MIN, RES:LIM:MAX]`；越界返回错误且保持原值。设置成功后输出状态变为 `NORM`（电阻网络输出）。设定值**只在本次通电会话内有效**：设备不把它写入非易失存储，重新上电后回到默认值 5 Ω；需要时请在开机后重新设置（`*SAV` 也不保存设定值）。
- **错误**：越界 → `-902`

**示例**

```text
RES 523000
RES?
→ 523000

RES:STEP 10000
RES UP
RES?
→ 533000
```

### 步进值 `RESistance[:LEVel][:IMMediate]:STEP[:INCRement]`

- **命令形式**：`RES:STEP <NR1>|MIN|MAX` / `RES:STEP?`
- **参数**：`<NR1>` 步进值（mΩ）；`MIN` = `5000`、`MAX` = `4000000000`
- **返回**：查询返回 `<NR1>`
- **错误**：负值 → `-913`
- **说明**：步进值会被保存，断电后保持。

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
- **说明**：限值会被保存，断电后保持；设置限值**不会**自动使能限值判定（需 `RES:LIM:STAT 1`）。
- **错误**：`MIN > MAX` → `-900`；`MAX < MIN` → `-901`；超出硬件范围 → `-913`

**示例**

```text
RES:LIM:MAX 1000000
RES:LIM:MIN 5000
RES:LIM:MIN?
→ 5000
```

### 限值使能 `RESistance:LIMit[:STATe]`

- **命令形式**：`RES:LIM:STAT <bool>` / `RES:LIM:STAT?`；`RES:LIM` 是同一命令的短形式（`RES:LIM 1` 与 `RES:LIM:STAT 1` 等价）
- **参数**：`<bool>` `0`=关闭、`1`=使能
- **返回**：查询返回 `0` / `1`
- **说明**：使能后设定阻值必须落在限值内；设置 `RES:LIM:MIN` / `RES:LIM:MAX` **不会**自动使能限值。使能状态会被保存，断电后保持。

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
- **说明**：直接应用 26 位继电器位图（绕过补偿算法），并把设定值改写为该位图对应的仿真阻值、输出状态置为 `NORM`，用于产测与校准。执行后的设定值与输出状态**只在本次会话有效**（不写非易失存储）；**位图本身也不保存**，重新上电后设备为开路 + 默认设定值 5 Ω。AT 侧 `AT+RES.NETW` 行为相同。
- **错误**：超出范围 → `-913`

**示例**

```text
RES:NETW 0
RES:NETW?
→ 0
```

---

## 校准命令

设备保存两套校准数据，`CAL:SEL` 决定当前生效（用于输出）以及后续编辑的目标数据集：

| 数据集 | 说明 |
| ------ | ---- |
| `USER` | **用户校准**，默认数据集，用户可自行校准与修改 |
| `FACTORY` | **出厂校准**，出厂时写入，不提供用户修改方法 |

!!! note "出厂数据不会被用户校准影响"
    出厂校准数据集默认处于**锁定**状态，解锁所需的出厂口令不对外提供；因此按本文流程操作用户数据集，**不会修改或覆盖出厂校准数据**。如需重新校准，请对 `USER` 数据集操作。

!!! warning "注意"
    校准不当会降低输出精度与可靠性，请在具备参考标准的情况下进行。

写入校准数据（`VAL`/`DATE`/`STR`/`SAVE`）必须同时满足：已进入校准模式（`CAL:ENAB 1`）**且**目标数据集未锁定，否则返回 `-907`；**例外**是修改或清除用户密码（`CAL:USER:PASS`），它只要求数据集未锁定，与 `ENAB` 无关。读取校准数据不受限制。

### 选择数据集 `CALibration:SELect`

- **命令形式**：`CAL:SEL {USER|FACT}` / `CAL:SEL?`
- **参数**：`USER`（用户校准）、`FACT`/`FACTORY`（出厂校准）
- **返回**：查询返回 `USER` / `FACTORY`
- **说明**：所选数据集同时决定设备按哪套数据输出阻值，以及后续 `CAL:*` 命令的编辑目标；选择结果会被保存、断电后保持，且**不会改动校准数据本身**（切换数据集不写入任何校准值）。

**示例**

```text
CAL:SEL USER
CAL:SEL?
→ USER
```

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
- **参数**：`<str>` 密码，最长 64 字节；设置非空密码会同时把数据集置为**锁定**，空字符串（`""`）表示清除密码并解锁
- **返回**：查询返回 `0` / `1`（是否已设密码，不返回明文）
- **错误**：超长 → `-916`；数据集已锁定 → `-907`
- **说明**：仅对 `USER` 数据集有效；修改或清除密码**要求数据集未锁定**（需先 `CAL:USER:UNL` 解锁），但**与 `CAL:ENAB` 无关**——这是写保护的一个例外。密码与锁定状态随校准数据一起保存。

**示例**

```text
CAL:USER:PASS "1234"
CAL:USER:PASS?
→ 1
```

### 解锁 `CALibration:USER:UNLock`

- **命令形式**：`CAL:USER:UNL <str>`
- **参数**：`<str>` 用户密码，**必填**；密码为空时必须写空字符串 `""`，**裸命令会返回 `-109`**（缺参数）
- **错误**：密码错误 → `-915`；缺少参数 → `-109`
- **说明**：解锁状态**只在本次会话内有效**（`UNL` 本身不写入存储）；如需断电后保持解锁，请在解锁后执行一次会写入校准数据的操作（例如 `CAL:USER:SAV`），否则重新上电后仍是上次保存的锁定状态。

**示例**

```text
CAL:USER:UNL "1234"
CAL:USER:UNL ""        # 未设置密码时
```

### 锁定 `CALibration:USER:LOCK`

- **命令形式**：`CAL:USER:LOCK <bool>` / `CAL:USER:LOCK?`
- **参数**：`<bool>` `1`=锁定；`0` 仅在**未锁定**时为空操作
- **返回**：查询返回 `0` / `1`
- **错误**：已锁定时执行 `CAL:USER:LOCK 0` → `-907`
- **说明**：**解锁只能通过 `CAL:USER:UNL` + 密码**，`LOCK 0` 不能解锁。`CAL:USER:LOCK 1` 会立即把锁定状态写入校准数据，断电后保持。

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
- **返回**：查询返回 `<str>`（带双引号的字符串）
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
- **返回**：查询返回 `<str>`（带双引号的字符串）
- **错误**：超长 → `-912`

**示例**

```text
CAL:USER:STR "user-cal"
CAL:USER:STR?
→ "user-cal"
```

### 校准时温度 `CALibration:USER:TEMPerature?`

- **命令形式**：`CAL:USER:TEMP?`
- **返回**：**带双引号的字符串**（摄氏度），为最近一次 `SAVE` 时记录的温度。

**示例**

```text
CAL:USER:TEMP?
→ "29.5"
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

命令错误或执行错误会进入错误队列，可用 `SYST:ERR?` 依次读出，回读格式为 `<码>,"<信息>"`。

标准错误（本机可回读文本的部分）：

| 码   | 含义                    | 典型触发                        |
| ---- | ----------------------- | ------------------------------- |
| -100 | Command error           | 命令解析失败                    |
| -109 | Missing parameter       | 需要参数的命令未给参数（如裸 `CAL:USER:UNL`） |
| -113 | Undefined header        | 未定义/拼写错误的命令           |
| -131 | Invalid suffix          | 非法的命令后缀                  |
| -224 | Illegal parameter value | 非法离散值或参数值              |

!!! note "未翻译的错误码"
    本机未提供下列代码的文本，回读时显示为 `Unknown error`：`-222`（Data out of range）、`-240`（Hardware error）、`-363`（Input buffer overrun）等；设备也不会推送这些代码，请以上表中的代码与下方设备自定义错误为准。

设备自定义错误：

| 码   | 含义                                     | 触发场景                                     |
| ---- | ---------------------------------------- | -------------------------------------------- |
| -900 | Resistance limit minimum exceeds maximum | `RES:LIM:MIN` > `RES:LIM:MAX`                |
| -901 | Resistance limit maximum below minimum   | `RES:LIM:MAX` < `RES:LIM:MIN`                |
| -902 | Resistance value out of limit range      | 阻值/步进越过当前允许范围                    |
| -903 | Resistance step size too large           | 预留                                         |
| -904 | Calibration mode not set                 | 预留                                         |
| -905 | Calibration mode invalid                 | `CAL:*:GEAR` 越界（如 28）                   |
| -906 | Calibration data invalid                 | 预留                                         |
| -907 | Calibration locked or not in setup mode  | 未使能校准模式时写校准、数据集已锁定、锁定态改密码、已锁定执行 `LOCK 0` |
| -908 | Calibration save failed                  | 预留（保存校准数据失败）                     |
| -909 | Compensation mode invalid                | 补偿模式取值非法                             |
| -910 | Output mode invalid                      | 输出模式取值非法                             |
| -911 | Temperature sensor error                 | 预留                                         |
| -912 | String parameter too long                | 字符串参数超过 64 字节                       |
| -913 | Value out of allowed range               | `RES:STEP` 负值、限值越出硬件量程等          |
| -914 | Calibration data corrupted               | 预留                                         |
| -915 | Password incorrect                       | 解锁密码错误                                 |
| -916 | Password too long                        | 密码超过 64 字节                             |

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

CAL:SEL USER
CAL:ENAB 1
CAL:USER:UNL "1234"
CAL:USER:GEAR 0
CAL:USER:VAL 5230
CAL:USER:DATE "2026-09-29"
CAL:USER:STR "user-cal"
CAL:USER:SAVE
CAL:ENAB 0

RES:LIM:STAT 0      # 还原限值使能（设置会被保存）
*RST                # 恢复默认配置（协议、数据集选择与上电统计不变）
*SAV                # 再确认保存一次
SYST:ERR?           # 检查错误队列
```
