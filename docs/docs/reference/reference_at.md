# AT 命令参考

## 设备连接参数配置

PPR26 在 USB-CDC 模式下免驱，可使用 AT 指令进行编程。PC 端串口参数配置为：

| 波特率 | 数据位 | 校验位 | 停止位 |
| ------ | ------ | ------ | ------ |
| 115200 | 8      | None   | 1      |

用户可以通过串口上位机在 PC 端控制设备输出、执行用户校准以及查看设备信息。

本文示例采用如下记法（`>` 为发送内容，`<` 为设备返回内容，不随命令发送）：

```text
> AT+DEV.MODEL?
< +DEV.MODEL=PPR26
```

## 通用规则

### 命令类型

| 类型     | 命令格式            | 说明                   |
| -------- | ------------------- | ---------------------- |
| 测试命令 | `AT+<命令名称>=?`   | 查询参数帮助及取值范围 |
| 查询命令 | `AT+<命令名称>?`    | 返回当前参数值         |
| 设置命令 | `AT+<命令名称>=<…>` | 设置参数并执行         |
| 执行命令 | `AT+<命令名称>`     | 执行无参数命令         |

- 并非每条命令都具备上述四种类型；请以各命令的“命令形式”为准。
- 命令**区分大小写**，命令名须使用大写（例如 `AT+RES.SP`）。
- 参数以 `,` 分隔，最多 8 个，每个最长 64 字节；数值参数支持十进制与 `0x` 十六进制。
- 单条命令长度不超过 256 字节。
- 命令以 `<CR>`、`<LF>` 或 `<CR><LF>` 结束。

### 通用响应

| 响应                 | 说明                                              |
| -------------------- | ------------------------------------------------- |
| `+<命令>=<值>`       | 查询结果                                          |
| `OK`                 | 设置/执行成功                                     |
| `ERROR`              | 参数错误、越界、不支持的调用类型或未知命令        |
| `[TQS ] AT+<命令>=…` | `=?` 参数帮助（`T`=Test、`Q`=Query、`S`=Set）      |

- 每条应答以 `<CR><LF>` 结束。
- 未知命令、大小写不符或形式非法的命令均返回 `ERROR`；空行不产生应答。

### 单位与约定

- 阻值相关参数与返回值统一为**毫欧（mΩ）整数**，内部为 64 位整数。
- 阻值有效范围：**5 Ω ~ 4 MΩ**（`5000` ~ `4000000000` mΩ）。
- 温度统一为 **0.1 ℃** 整数（例如 `291` 表示 29.1 ℃）。
- 超量程只返回 `ERROR`，不改变当前值。

---

## 设备信息命令

### `AT` — 连接测试

- **命令形式**：`AT`（执行）
- **参数**：无
- **返回**：`OK`
- **说明**：用于检测设备在线与串口联通。

**示例**

```text
> AT
< OK
```

### `AT+DEV.SN?` — 序列号

- **命令形式**：`AT+DEV.SN?`（查询）
- **参数**：无
- **返回**：`+DEV.SN=<序列号>`，24 个大写十六进制字符。
- **说明**：序列号来自芯片唯一 ID，与 USB 描述符及 SCPI 的序列号一致。

**示例**

```text
> AT+DEV.SN?
< +DEV.SN=87043057485172710671FF49
```

### `AT+DEV.MODEL?` — 型号

- **命令形式**：`AT+DEV.MODEL?`（查询）
- **参数**：无
- **返回**：`+DEV.MODEL=PPR26`

**示例**

```text
> AT+DEV.MODEL?
< +DEV.MODEL=PPR26
```

### `AT+DEV.PROD?` — 生产日期

- **命令形式**：`AT+DEV.PROD?`（查询）
- **参数**：无
- **返回**：`+DEV.PROD=<YY-WW>`，年（两位）与周（两位）。

**示例**

```text
> AT+DEV.PROD?
< +DEV.PROD=26-09
```

### `AT+DEV.HWVER?` — 硬件版本

- **命令形式**：`AT+DEV.HWVER?`（查询）
- **参数**：无
- **返回**：`+DEV.HWVER=<0..6>`

**示例**

```text
> AT+DEV.HWVER?
< +DEV.HWVER=0
```

### `AT+DEV.FWVER?` — 固件版本

- **命令形式**：`AT+DEV.FWVER?`（查询）
- **参数**：无
- **返回**：`+DEV.FWVER=<版本字符串>`

**示例**

```text
> AT+DEV.FWVER?
< +DEV.FWVER=FW 1.0.0
```

### `AT+DEV.POWERON?` — 上电次数

- **命令形式**：`AT+DEV.POWERON?`（查询）
- **参数**：无
- **返回**：`+DEV.POWERON=<次数>`

**示例**

```text
> AT+DEV.POWERON?
< +DEV.POWERON=12
```

### `AT+DEV.UPTIME?` — 累计通电时间

- **命令形式**：`AT+DEV.UPTIME?`（查询）
- **参数**：无
- **返回**：`+DEV.UPTIME=<分钟>`，单位分钟，永不清零。

**示例**

```text
> AT+DEV.UPTIME?
< +DEV.UPTIME=345
```

---

## 温度测量命令

设备板载 NTC 温度传感器，用于监测设备内部温度。温度单位为 **0.1 ℃**。

### `AT+DEV.TEMP?` — 当前温度

- **命令形式**：`AT+DEV.TEMP?`（查询）
- **参数**：无
- **返回**：`+DEV.TEMP=<温度×10>`，例如 `291` 表示 29.1 ℃。

**示例**

```text
> AT+DEV.TEMP?
< +DEV.TEMP=291
```

### `AT+DEV.TSTAT?` — 温度统计

- **命令形式**：`AT+DEV.TSTAT?`（查询）
- **参数**：无
- **返回**：`+DEV.TSTAT=<当前>,<最低>,<平均>,<最高>,<采样次数>`
  （前四项为 0.1 ℃ 整数，末项为整数）
- **说明**：统计自开机或上次 `AT+DEV.TCLR` 起累计。

**示例**

```text
> AT+DEV.TSTAT?
< +DEV.TSTAT=291,290,291,293,1250
```

### `AT+DEV.TCLR` — 清空温度统计

- **命令形式**：`AT+DEV.TCLR`（执行）
- **参数**：无
- **返回**：`OK`
- **说明**：清空最高/最低/平均/采样次数，重新开始统计。

**示例**

```text
> AT+DEV.TCLR
< OK
```

---

## 系统命令

### `AT+SYS.PROT` — 通信协议

- **命令形式**：`AT+SYS.PROT?`（查询） / `AT+SYS.PROT=<0|1>`（设置） / `AT+SYS.PROT=?`（测试）
- **参数**：`0` = AT（USB CDC），`1` = SCPI（USB TMC）
- **返回**：查询返回 `+SYS.PROT=<0|1>`
- **说明**：设置后**保存并运行时切换**：设备断开/重连 USB 后按新协议重新枚举，**不复位 MCU**。切换期间当前连接会中断。

**示例**

```text
> AT+SYS.PROT?
< +SYS.PROT=0

> AT+SYS.PROT=1
< OK
```

---

## 输出与电阻命令

阻值单位统一为 mΩ。以下命令的 `=?` 形式返回参数帮助（含当前允许范围）。

### `AT+RES.SP` — 设定阻值

- **命令形式**：`AT+RES.SP?`（查询） / `AT+RES.SP=<mΩ>`（设置） / `AT+RES.SP=?`（测试）
- **参数**：`<mΩ>` 阻值，范围 **5000 ~ 4000000000**（5 Ω ~ 4 MΩ）
- **返回**：查询返回 `+RES.SP=<mΩ>`
- **说明**：
  - 限值使能（`AT+RES.LIMIT=1`）时，设定值须落在 `[RES.MIN, RES.MAX]` 内。
  - 设置成功后输出状态变为电阻网络输出（NORM）。
  - 越界返回 `ERROR` 且保持原值。

**示例**

```text
> AT+RES.SP=523000
< OK

> AT+RES.SP?
< +RES.SP=523000
```

### `AT+RES.PV?` — 当前估测阻值

- **命令形式**：`AT+RES.PV?`（查询）
- **参数**：无
- **返回**：`+RES.PV=<mΩ>`；开路时返回 `+RES.PV=inf`；短路时返回短路校准值。

**示例**

```text
> AT+RES.PV?
< +RES.PV=523000
```

### `AT+RES.COMP` — 补偿模式

- **命令形式**：`AT+RES.COMP?`（查询） / `AT+RES.COMP=<模式>`（设置） / `AT+RES.COMP=?`（测试）
- **参数**：`0` = 不补偿、`1` = 附近值、`2` = 多档位最佳
- **返回**：查询返回 `+RES.COMP=<0|1|2>`

**示例**

```text
> AT+RES.COMP=2
< OK

> AT+RES.COMP?
< +RES.COMP=2
```

### `AT+RES.STEP` — 步进值

- **命令形式**：`AT+RES.STEP?`（查询） / `AT+RES.STEP=<mΩ>`（设置） / `AT+RES.STEP=?`（测试）
- **参数**：`<mΩ>` 步进值，任意非负
- **返回**：查询返回 `+RES.STEP=<mΩ>`

**示例**

```text
> AT+RES.STEP=10000
< OK

> AT+RES.STEP?
< +RES.STEP=10000
```

### `AT+RES.LIMIT` — 限值使能

- **命令形式**：`AT+RES.LIMIT?`（查询） / `AT+RES.LIMIT=<0|1>`（设置） / `AT+RES.LIMIT=?`（测试）
- **参数**：`0` = 关闭、`1` = 使能
- **返回**：查询返回 `+RES.LIMIT=<0|1>`
- **说明**：使能后，设定阻值必须落在 `[RES.MIN, RES.MAX]` 内。

**示例**

```text
> AT+RES.LIMIT=1
< OK

> AT+RES.LIMIT?
< +RES.LIMIT=1
```

### `AT+RES.NETW` — 继电器网络

- **命令形式**：`AT+RES.NETW?`（查询） / `AT+RES.NETW=<mask>`（设置） / `AT+RES.NETW=?`（测试）
- **参数**：`<mask>` 26 位继电器位图，范围 `0` ~ `67108863`（`2^26 - 1`）
- **返回**：查询返回 `+RES.NETW=<mask>`
- **说明**：直接操作继电器网络，绕过补偿算法，并同步更新估测值；用于产测/校准。

**示例**

```text
> AT+RES.NETW=0
< OK
```

### `AT+RES.MAX` — 最大阻值限制

- **命令形式**：`AT+RES.MAX?`（查询） / `AT+RES.MAX=<mΩ>`（设置） / `AT+RES.MAX=?`（测试）
- **参数**：`<mΩ>`，范围 5 Ω ~ 4 MΩ
- **返回**：查询返回 `+RES.MAX=<mΩ>`
- **说明**：须满足 `RES.MIN ≤ RES.MAX`，否则返回 `ERROR`。

**示例**

```text
> AT+RES.MAX=1000000
< OK
```

### `AT+RES.MIN` — 最小阻值限制

- **命令形式**：`AT+RES.MIN?`（查询） / `AT+RES.MIN=<mΩ>`（设置） / `AT+RES.MIN=?`（测试）
- **参数**：`<mΩ>`，范围 5 Ω ~ 4 MΩ
- **返回**：查询返回 `+RES.MIN=<mΩ>`
- **说明**：须满足 `RES.MIN ≤ RES.MAX`，否则返回 `ERROR`。

**示例**

```text
> AT+RES.MIN=5000
< OK
```

### `AT+RES.SHORT` / `AT+RES.OPEN` — 短路 / 开路

- **命令形式**：`AT+RES.SHORT?`/`AT+RES.OPEN?`（查询） / `AT+RES.SHORT=<0|1>`/`AT+RES.OPEN=<0|1>`（设置） / `=?`（测试）
- **参数**：`1` = 进入短路/开路，`0` = 恢复到当前设定阻值（`AT+RES.SP`）
- **返回**：查询返回 `<0|1>`
- **说明**：短路/开路只能通过本命令设置。

**示例**

```text
> AT+RES.OPEN=1
< OK

> AT+RES.PV?
< +RES.PV=inf
```

---

## 用户校准命令

PPR26 使用一套**用户校准数据**修正输出精度，用户可自行校准，校准数据独立保存。

!!! warning "注意"
    校准不当会降低输出精度与可靠性，请在具备参考标准的情况下进行。

### 校准流程与写保护

写入校准数据（`VAL` / `DATE` / `STR` / `SAVE`）前必须满足：

1. 已进入校准模式：`AT+CALI.ENAB=1`；
2. 用户数据集未锁定（已设置密码时需先 `AT+CALI.UNL` 解锁）。

查询命令不受上述限制；违反写保护时返回 `ERROR`。

### `AT+CALI.ENAB` — 校准使能

- **命令形式**：`AT+CALI.ENAB?`（查询） / `AT+CALI.ENAB=<0|1>`（设置） / `AT+CALI.ENAB=?`（测试）
- **参数**：`0` = 退出校准模式、`1` = 进入校准模式
- **返回**：查询返回 `+CALI.ENAB=<0|1>`
- **说明**：写入校准数据的前置条件，**不持久化**（掉电后为 `0`）。

**示例**

```text
> AT+CALI.ENAB=1
< OK
```

### `AT+CALI.PASS` — 用户密码

- **命令形式**：`AT+CALI.PASS?`（查询） / `AT+CALI.PASS=<string>`（设置） / `AT+CALI.PASS=?`（测试）
- **参数**：`<string>` 密码，最长 64 字节；空字符串表示清除密码（清除后默认解锁）
- **返回**：查询返回 `+CALI.PASS=<0|1>`（是否已设密码，不返回明文）
- **说明**：设置密码后校准数据默认锁定；解锁需使用 `AT+CALI.UNL`。

**示例**

```text
> AT+CALI.PASS=1234
< OK

> AT+CALI.PASS?
< +CALI.PASS=1
```

### `AT+CALI.UNL` — 解锁

- **命令形式**：`AT+CALI.UNL=<password>`（设置） / `AT+CALI.UNL=?`（测试）
- **参数**：`<password>` 用户密码；密码为空时可直接解锁（`AT+CALI.UNL=`）
- **返回**：`OK` / `ERROR`（密码错误时返回 `ERROR`）

**示例**

```text
> AT+CALI.UNL=1234
< OK
```

### `AT+CALI.LOCK` — 锁定

- **命令形式**：`AT+CALI.LOCK?`（查询） / `AT+CALI.LOCK=<0|1>`（设置） / `AT+CALI.LOCK=?`（测试）
- **参数**：`0` = 解锁、`1` = 锁定
- **返回**：查询返回 `+CALI.LOCK=<0|1>`

**示例**

```text
> AT+CALI.LOCK=1
< OK
```

### `AT+CALI.GEAR` — 校准档位

- **命令形式**：`AT+CALI.GEAR?`（查询） / `AT+CALI.GEAR=<0..27>`（设置） / `AT+CALI.GEAR=?`（测试）
- **参数**：`<0..27>`，含义见下表；设置时同时应用对应继电器
- **返回**：查询返回 `+CALI.GEAR=<0..27>`
- **说明**：档位为会话状态，不持久化。

| 档位      | 含义                       |
| --------- | -------------------------- |
| `0`..`25` | 单路电阻（闭合对应继电器） |
| `26`      | 串联短路                   |
| `27`      | 直接短路                   |

**示例**

```text
> AT+CALI.GEAR=0
< OK
```

### `AT+CALI.VAL` — 当前档位校准阻值

- **命令形式**：`AT+CALI.VAL?`（查询） / `AT+CALI.VAL=<mΩ>`（设置） / `AT+CALI.VAL=?`（测试）
- **参数**：`<mΩ>` 当前档位的实测阻值
- **返回**：查询返回 `+CALI.VAL=<mΩ>`
- **说明**：受写保护约束（需 `ENAB=1` 且未锁定）。

**示例**

```text
> AT+CALI.VAL=5230
< OK
```

### `AT+CALI.DATE` — 校准日期

- **命令形式**：`AT+CALI.DATE?`（查询） / `AT+CALI.DATE=<string>`（设置） / `AT+CALI.DATE=?`（测试）
- **参数**：`<string>` 日期字符串，最长 64 字节；空字符串表示清除
- **返回**：查询返回 `+CALI.DATE=<string>`
- **说明**：受写保护约束。

**示例**

```text
> AT+CALI.DATE=2026-09-29
< OK
```

### `AT+CALI.STR` — 校准备注

- **命令形式**：`AT+CALI.STR?`（查询） / `AT+CALI.STR=<string>`（设置） / `AT+CALI.STR=?`（测试）
- **参数**：`<string>` 备注字符串，最长 64 字节；空字符串表示清除
- **返回**：查询返回 `+CALI.STR=<string>`
- **说明**：受写保护约束。

**示例**

```text
> AT+CALI.STR=user-cal
< OK
```

### `AT+CALI.COUNT?` — 校准次数

- **命令形式**：`AT+CALI.COUNT?`（查询）
- **返回**：`+CALI.COUNT=<次数>`；每次 `AT+CALI.SAVE` 加 1。

**示例**

```text
> AT+CALI.COUNT?
< +CALI.COUNT=3
```

### `AT+CALI.TEMP?` — 校准时温度快照

- **命令形式**：`AT+CALI.TEMP?`（查询）
- **返回**：`+CALI.TEMP=<℃>`（0.1 ℃ 分辨率），为最近一次 `SAVE` 时记录的温度。

**示例**

```text
> AT+CALI.TEMP?
< +CALI.TEMP=29.5
```

### `AT+CALI.SAVE` — 保存校准数据

- **命令形式**：`AT+CALI.SAVE`（执行）
- **参数**：无
- **返回**：`OK` / `ERROR`
- **说明**：保存当前档位的校准数据，校准次数 +1、记录温度并落盘。受写保护约束（需 `ENAB=1` 且未锁定）。

**示例**

```text
> AT+CALI.SAVE
< OK
```

---

## 典型流程示例

```text
AT
AT+DEV.MODEL?
AT+DEV.TEMP?

AT+RES.LIMIT=0
AT+RES.COMP=2
AT+RES.SP=523000
AT+RES.PV?

AT+CALI.ENAB=1
AT+CALI.UNL=1234
AT+CALI.GEAR=0
AT+CALI.VAL=5230
AT+CALI.DATE=2026-09-29
AT+CALI.STR=user-cal
AT+CALI.SAVE
AT+CALI.ENAB=0
```
