# SCPI 命令参考

## 相关信息

### 仪器驱动程序

本仪器使用 NI-VISA 驱动程序，请先安装 NI-VISA 驱动库以建立仪器通信。

### 仪器上位机与脚本

本仪器提供了基于 Python 的上位机软件，快速上手可以参考：[上位机使用指南](../software/getstarted.md)。

本仪器提供了基于 Python 的用户自校准和测试脚本，可以参考：[校准脚本](./script_calibration.md)，[测试脚本](./script_test.md)。

### 仪器编程示例

本仪器提供了基于 Pyhton 的编程示例，快速入门可以参考：[SCPI Python 编程示例](./python_scpi.md)。

## SCPI 语言简介

### 命令类型

本仪器遵守当前 SCPI 版本的规则和约定（请参见 [SYSTem:VERSion?](#SYSTem:VERSion?)）。

SCPI( 可编程仪器的标准命令) 是一种基于 ASCII 的仪器命令语言，设计用于测试和测量仪器。SCPI 包含两种类型的命令，通用命令和子系统命令。

#### 子系统命令

子系统命令执行特定的仪器功能。它们由按字母顺序排列的命令组成，这些命令扩展到分层结构中根下的一个或多个级别，也称为树系统。在此结构中，相关命令归组于共用结点或根下，这样就形成了子系统。下面列出了 OUTPut 子系统的一部分，用以说明树系统。注意，为了便于清楚说明，某些 [可选] 命令也包括在内。

```text
OUTPut
    [:STATe] OFF|0|ON|1
    :PON
        :STATe RST|RCL0
    :PROTection
        :CLEar
```

#### IEEE-488.2 通用命令

IEEE-488.2 标准定义了一组通用命令，可执行重置、自检以及状态操作等功能。通用命令始终以星号 (`*`) 开始，长度为 3 个字符，并且可能包括一个或多个参数。命令关键字与第一个参数由空格分隔。使用分号 (`;`) 可分隔多个命令。

### 关键字

关键字，也称为标题，是仪器识别的说明。通用命令也是关键字。

`OUTPut` 是根关键字，`PROTection` 是第二级关键字，`CLEar` 是第三级关键字。冒号 (`:`) 用于分隔关键字级别。

按照命令语法，大多数命令（和某些参数）都以大小写字母混合的方式表示。大写字母表示命令的缩写。对于较短的程序行，可以发送缩写格式的命令。如果要获得较好的程序可读性，可以发送长格式的命令。

在上述示例中，`OUTP` 和 `OUTPUT` 都是可接受的格式。可以使用大写或小写字母。因此，`OUTPUT`、`outp` 和 `Outp` 都是可接受的。诸如 `OUT` 的其他格式无效，并且会产生错误。

### 查询

在关键字后面加一个问号 (`?`) 可将其变成一个查询 (例如：`VOLTage?`、`VOLTage:TRIGgered?`)。如果查询包含参数，那么将查询指示器放置在最后关键字的末尾、参数的前面。在查询指示器和第一个参数之间插入一个空格。

您可以查询大多数参数的编程设定值。例如，您可以通过发送以下命令查询电压设置：

```text
VOLTage?
```

也可以查询最小或最大允许电压设置，方式是发送以下命令：

```text
VOLTage?MIN
VOLTage?MAX
```

在发送另一个命令至仪器之前，必须读回所有查询的结果。否则，将会发生 Query Interrupted 的错误并丢失未返回的数据。

### 命令分隔符和终止符

#### 分隔符

冒号 (`:`) 用于分隔关键字级别。必须使用空格将命令参数与其对应的关键字分隔开来。请注意 `STATe` 和 `*RST` 参数之间的空格。

```text
OUTPut:PON:STATe RST
```

分号 (`;`) 可用于分隔同一子系统中的命令。这样即可在同一消息字符串中发送多个子系统命令。例如，发送下列命令字符串：

```text
OUTPut:STATe ON;PON:STATe RST
```

与发送以下命令的作用相同：

```text
OUTPut ON
OUTPut:PON:STATe RST
```

注意，分号跟随在分层树结构的隐含路径后。在上例中，可选的 `:STATe` 关键字必须跟随在 `OUTput` 关键字后，才能将命令解析器放置在层次结构的第二级别。这样可以在分号后使用 `PON` 关键字，因为 `PON` 是第二级关键字。

您也可以将不同子系统命令合并在同一消息字符串中。在这种情况下，您必须使用冒号将命令解析器返回至根级才能访问另一个子系统。例如，您可以通过使用如下根说明符，清除输出保护并检查一条消息中的操作条件寄存器的状态：

```text
OUTPut:PROTection:CLEar;:STATus:OPERation:CONDition?
```

#### 终止符

发送到仪器的命令字符串必须以一个换行 (`<NL>`) 字符结尾。可以将 IEEE-488 EOI (结束或标识) 消息解释为 `<NL>` 字符，并用来代替 `<NL>` 字符终止命令字符串。一个回车符后跟一个换行符 (`<CR><NL>`) 也是可接受的。命令字符串终止始终将当前的 SCPI 命令路径重置到根级。

### 语法惯例

- 尖括号 (`< >`) 表示必须为括号内的参数指定一个值。例如，在 `VOLTage <值>` 命令语法中，`<值>` 参数包含在尖括号内。方括号不会随命令字符串一起发送。您必须为该参数指定一个值 (例如：`VOLTage 50V`) ，除非您选择语法中的另一个选项 (例如：`VOLTage MAX`) 。
- 竖条 (`|`) 隔开给定命令字符串的多个参数选择。例如，`OUTPut:PON:STATe` 命令中的 `RST|RCL0` 表示您可以指定 `RST` 或 `RCL0`。竖条不随命令字符串发送。
- 方括号 (`[ ]`) 中包含一些语法元素，例如节点和参数。这表示该元素可选且可以省略。方括号不随命令字符串发送。方括号内的任何关键字均为可选且可以省略。但是，如果您要将多个命令合并在如前面所述的相同消息字符串中，则必须包含这些可选命令才能将命令解析器置于层次结构的正确层级上。

### 参数类型

SCPI 语言定义了命令和查询所使用的几种数据格式。

#### 数值参数

要求使用数值参数的命令支持所有常用的十进制数字表示法，包括可选符号、小数点和科学记数法等。如果命令只接受某些特定值，仪器会自动将输入数值参数四舍五入为可接受的值。下面这条命令要求为电压值使用数值参数：

```text
[SOURce:]VOLTage 50V|MIN|MAX
```

注意数值参数的特殊值 (如 `MINimum` 和 `MAXimum`) 也是可接受的。不用选择特定的电压参数值，可以用 `MIN` 参数将电压设置为允许的最小值，或用 `MAX` 参数将电压设置为允许的最大值。

您也可以发送带有数值参数的工程单位后缀 (例如，`V` 表示伏特，`A` 表示安培，`W` 表示瓦特)。所有参数值都使用基本单位。

#### 离散参数

离散参数用于对包含有限个参数值的设置进行编程设定( 例如 `IMMediate`、`EXTernal` 或 `BUS`) 。就像命令关键字一样，它们也可以有短格式和长格式。可以使用大写或小写字母。查询响应始终返回全部为大写字母的短格式。例如对于显示屏设置，下面这条命令要求使用离散参数：

```text
VOLTage:MODE FIXed|STEP
```

#### 布尔参数

布尔参数代表一个真或假的二进制条件。对于假条件，仪器将接受 `OFF` 或 `0`。对于真条件，仪器将接受 `ON` 或 `1`。当查询布尔设置时，仪器始终返回 `0` 或 `1`。例如下面的命令要求使用布尔参数：

```text
OUTput OFF|0|ON|1
```

#### ASCII 字符串参数

字符串参数实际上可包含所有 ASCII 字符集。字符串必须以配对的引号开始和结尾；可以用单引号或双引号。引号分隔符也可以作为字符串的一部分，只需键入两次并且不在中间添加任何字符。例如下面这条命令使用了字符串参数：

```text
CALibrate:DATE "12/12/12"
```

### 设备清除

设备清除是一条 IEEE-488 低级总线消息，可用于将仪器返回到响应状态。不同的编程语言和 IEEE-488 接口卡通过其特有的命令提供对该功能的访问权限。当收到设备清除信息时，状态寄存器、错误队列以及所有配置状态都保持不变。

设备清除执行以下操作：

- 如果正在测量，则其被中止。
- 仪器返回到触发空闲状态。
- 清除仪器的输入和输出缓冲区。
- 仪器准备好接受新的命令字符串。

!!!warning "注意"
    ABORt 命令是中止仪器操作的建议方法。

## 子系统命令

### 校准命令

校准命令用于校准仪器。

!!!warning "注意"
    校准之前，请参见 [校准部分](#验证与校准)。校准不当可能降低精度和可靠性。

#### CALibrate:COUNt?

返回已校准设备的次数。在以下情况下，计数会按一定的增量增大：保存校准数据 (包括日期) 、更改管理员密码、使用内部校准开关重置管理员密码或更新仪器固件。

| 参数 | 典型返回值 |
| ---- | ---------- |
| (无) | 校准计数   |

示例：

返回校准计数：

```text
CAL:COUN?
```

#### CALibrate:DATA <值>

#### CALibrate:DATE <"日期">

#### CALibrate:DATE?

#### CALibrate:PASSword <密码>

#### CALibrate:SAVE

#### CALibrate:STATe 0|OFF|1|ON [,<密码>]

#### CALibrate:STATe?

#### CALibrate:LEVel <校准档位>

### 状态命令

状态命令可用于随时确定仪器的操作条件。仪器包含三组状态寄存器；操作、可疑和标准事件。操作和可疑状态组均由条件、使能和事件寄存器以及 NTR 和 PTR 滤波器组成。

也可使用通用命令对仪器状态进行编程设定：本主题结尾处讨论的 `*CLS`、`*ESE`、`*ESR?`、`*OPC`、`*OPC?`、`*SRE`、`*STB?` 和 `*WAI`。通用命令控制其他状态功能，如服务请求使能寄存器和状态字节寄存器。 请参阅状态教程了解详细信息。

#### STATus:OPERation[:EVENt]?

#### STATus:OPERation:CONDition?

#### STATus:OPERation:ENABle <值>

#### STATus:OPERation:ENABle?

#### STATus:OPERation:NTRansition <值>

#### STATus:OPERation:NTRansition?

#### STATus:OPERation:PTRansition <值>

#### STATus:OPERation:PTRansition?

#### STATus:PRESet

#### STATus:QUEStionable[:EVENt]?

#### STATus:QUEStionable:CONDition?

#### STATus:QUEStionable:ENABle <值>

#### STATus:QUEStionable:ENABle?

#### STATus:QUEStionable:NTRansition <值>

#### STATus:QUEStionable:NTRansition?

#### STATus:QUEStionable:PTRansition <值>

#### STATus:QUEStionable:PTRansition?

#### *ESE <值>

#### *ESE?

#### *ESR?

#### *OPC

#### *OPC?

#### *SRE <值>

#### *SRE?

#### *STB?

#### *WAI

## 命令摘要

本章将归纳出用于设定程控电阻的 SCPI 命令，如果需要有关每一个命令更详尽的资料，请参阅后续独立章节。

> 本手册使用如下方式来表示 SCPI 命令的语法：
>
> 方括号（\[\]）表示选件的关键字或参数
>
> 大括号（{}）中为命令字符串的参数
>
> 尖括号（<>）表示必须以一个数值取代括弧中的参数，不可省略

## SYSTem 子系统

## CALibration 子系统

## RESIstance 子系统

## OUTput 子系统

    // 命令格式：SYSTem:TEMPerature[:IMMediate]?
    // 命令参数：无
    // 返回参数：<NR2></nr2> 当前测量温度，单位为摄氏度
    // 功能描述：获取仪器内部温度传感器实时温度测量值

    // 命令格式：SYSTem:TEMPerature:AVERage?
    // 命令参数：无
    // 返回参数：<NR2></nr2> 平均温度，单位为摄氏度
    // 功能描述：获取仪器内部温度传感器测量的平均温度，从仪器开机或者 SYSTem:TEMPerature:RESet 命令执行之后开始统计

    // 命令格式：SYSTem:TEMPerature:MINimum?
    // 命令参数：无
    // 返回参数：<NR2></nr2> 最低温度，单位为摄氏度
    // 功能描述：获取仪器内部温度传感器测量的最低温度，从仪器开机或者 SYSTem:TEMPerature:RESet 命令执行之后开始统计

    // 命令格式：SYSTem:TEMPerature:MAXimum?
    // 命令参数：无
    // 返回参数：<NR2></nr2> 最高温度，单位为摄氏度
    // 功能描述：获取仪器内部温度传感器测量的最高温度，从仪器开机或者 SYSTem:TEMPerature:RESet 命令执行之后开始统计

    // 命令格式：SYSTem:TEMPerature:RESet
    // 命令参数：无
    // 返回参数：无
    // 功能描述：重新开始统计仪器内部温度传感器统计值

    // 命令格式：SYSTem:COMPensate:MODE<discrete></discrete>
    // 命令参数：<discrete></discrete> {LINear | PRECise | UNCALibrate}
    // 返回参数：无
    // 功能描述：设置输出电阻校准数据补偿算法

    // 命令格式：SYSTem:COMPensate:MODE?
    // 命令参数：无
    // 返回参数：<discrete></discrete> {LINear | PRECise | UNCALibrate}
    // 功能描述：读取输出电阻校准数据补偿算法

校准指令

    // 命令格式：[:]CALibration:COUNt?
    // 命令参数：无
    // 返回参数：<NR1></nr1> 十进制整数 校准次数
    // 功能描述：查询当前校准参数配置的校准次数

    // 命令格式：[:]CALibration:TEMPerature?
    // 功能描述：查询当前校准配置校准时的温度
    // 命令参数：无
    // 返回参数：<NR2></nr2> 摄氏度

    // 命令格式：[:]CALibration:DATE<string></string>
    // 功能描述：设置当前校准配置的校准日期
    // 命令参数：<string></string> 校准日期字符串，最长 32 字节
    // 返回参数：无

    // 命令格式：[:]CALibration:DATE?
    // 功能描述：查询当前校准配置的校准日期
    // 命令参数：无
    // 返回参数：<string></string> 校准日期字符串，最长 32 字节

    // 命令格式：[:]CALibration:STRing<string></string>
    // 功能描述：设置校准信息附带字符串（可用于存储校准人信息等）
    // 命令参数：<string></string> 校准信息附带字符串，最长 32 字节
    // 返回参数：无

    // 命令格式：[:]CALibration:STRing?
    // 功能描述：查询当前校准信息附带字符串
    // 命令参数：无
    // 返回参数：<string></string> 校准信息附带字符串，最长 32 字节

    // 命令格式：[:]CALibration:SAVe<string></string>
    // 功能描述：保存当前校准参数
    // 命令参数：无
    // 返回参数：无

    // 命令格式：[:]CALibration:SETup
    // 功能描述：进入校准模式
    // 命令参数：无
    // 返回参数：无

    // 命令格式：[:]CALibration:SETup?
    // 功能描述：检查仪器是否进入校准模式
    // 命令参数：无
    // 返回参数：<boolean></boolean> 是否进入校准模式

    // 命令格式：[:]CALibration[:STATe]<NR1></nr1>
    // 功能描述：设置校准模式组态
    // 命令参数：<NR1></nr1> 校准模式组态，范围 0-30
    // 返回参数：无

    // 命令格式：[:]CALibration[:STATe]?
    // 功能描述：查询当前校准模式组态
    // 命令参数：无
    // 返回参数：<NR1></nr1> 校准模式组态，范围 0-30

    // 命令格式：[:]CALibration:VALue<NR1></nr1>
    // 功能描述：设置当前校准模式组态下的校准数据
    // 命令参数：<NR1></nr1> 校准数据（电阻阻值，单位 mOhm）
    // 返回参数：无

    // 命令格式：[:]CALibration:VALue?
    // 功能描述：查询当前校准模式组态下的校准数据
    // 命令参数：无
    // 返回参数：<NR1></nr1> 校准数据（电阻阻值，单位 mOhm）

输出指令：

    // 命令格式：[:]OUTput[:STATe]<discrete></discrete>
    // 命令参数：<discrete></discrete> {SHORT | OPEN | NORMal}
    // 返回参数：无
    // 功能描述：设置程控电阻输出状态：短路 | 开路 | 电阻网络输出

    // 命令格式：[:]OUTput[:STATe]?
    // 命令参数：无
    // 返回参数：<discrete></discrete> {SHORT | OPEN | NORMal}
    // 功能描述：获取当前程控电阻输出状态

电阻控制指令：

    // 命令格式：[:Source:]RESIstance:LIMit:MINimum<NR1></nr1>
    // 命令参数：<NR1></nr1> 设置输出电阻最小值限制，范围为 [5 Ohm, 4 MOhm]
    // 返回参数：无
    // 功能描述：设置输出电阻最小值限制

    // 命令格式：[:Source:]RESIstance:LIMit:MINimum?
    // 命令参数：无
    // 返回参数：<NR1></nr1> 设置输出电阻最小值限制
    // 功能描述：查询输出电阻最小值限制

    // 命令格式：[:Source:]RESIstance:LIMit:MAXimum<NR1></nr1>
    // 命令参数：<NR1></nr1> 设置输出电阻最大值限制，范围为 [5 Ohm, 4 MOhm]
    // 返回参数：无
    // 功能描述：设置输出电阻最大值限制

    // 命令格式：[:Source:]RESIstance:LIMit:MAXimum?
    // 命令参数：无
    // 返回参数：<NR1></nr1> 设置输出电阻最大值限制
    // 功能描述：查询输出电阻最大值限制

    // 命令格式：[:Source:]RESIstance:LIMit[:STATe]<boolean></boolean>
    // 命令参数：<boolean></boolean> {0|1|ON|OFF} 输出电阻限制使能
    // 返回参数：无
    // 功能描述：设置输出电阻限制使能模式

    // 命令格式：[:Source:]RESIstance:LIMit:[:STATe]?
    // 命令参数：无
    // 返回参数：<boolean></boolean> {0|1} 输出电阻限制使能状态
    // 功能描述：查询输出电阻限制使能模式

    // 命令格式：[:SOURce:]RESIstance[:LEVel][:IMMediate][:AMPLitude]<NR1></nr1>
    // 命令参数：<NR1></nr1> {电阻值|MINimum|MAXimum|UP|DOWN} 设置电阻阻值，单位欧姆
    // 返回参数：无
    // 功能描述：设置程控电阻设定的电阻值，范围为 []，可以使用 MIN 和 MAX 来作为电阻设定的参数
    //          可以使用 UP 和 DOWN 在当前电阻设定的基础上进行增大或者减小
    //          步进值需要先使用 RESI:STEP 命令进行设置
    //          如果变化后的值超出了范围，将返回一个超出数据范围的错误信息

    // 命令格式：[:SOURce:]RESIstance[:LEVel][:IMMediate][:AMPLitude]?
    // 命令参数：
    // 返回参数：<NR1></nr1> 当前设定输出电阻阻值，单位欧姆
    // 功能描述：查询当前设定输出电阻阻值

    // 命令格式：[:SOURce:]RESIstance[:LEVel][:IMMediate]:STEP[:INCRement]<NR1></nr1>
	// 命令参数：<NR1></nr1> {电阻值|MINimum|MAXimum} 输出电阻步进增量值，单位欧姆
    // 返回参数：无
    // 功能描述：设置输出电阻步进增量值

    // 命令格式：[:SOURce:]RESIstance[:LEVel][:IMMediate]:STEP[:INCRement]?
	// 命令参数：无
    // 返回参数：<NR1></nr1> 输出电阻步进增量值，单位欧姆
    // 功能描述：查询输出电阻步进增量值

错误定义

    // 标准SCPI错误码 (-100 ~ -199: 命令错误)
    // -100 Command error
    // -101 Invalid character
    // -102 Syntax error
    // -103 Invalid separator
    // -104 Data type error
    // -108 Parameter not allowed
    // -109 Missing parameter
    // -113 Undefined header
    // -121 Invalid character in number
    // -124 Too many digits
    // -131 Invalid suffix
    // -141 Invalid character data
    // -144 Character data too long
    // -151 Invalid string data
    // -161 Invalid block data
    // -171 Invalid expression

    // 标准SCPI错误码 (-200 ~ -299: 执行错误)
    // -201 Invalid while in local
    // -202 Settings lost due to RTL
    // -221 Settings conflict
    // -222 Data out of range
    // -224 Illegal parameter value
    // -230 Data corrupt or stale
    // -240 Hardware error
    // -241 Hardware missing

    // 标准SCPI错误码 (-300 ~ -399: 设备特定错误)
    // -300 Device specific error

    // 自定义错误码 (-900 ~ -999: 设备特定错误)
    // 错误码: -900
    // 错误信息: Resistance limit minimum exceeds maximum
    // 说明: 电阻最小值限制大于最大值

    // 错误码: -901
    // 错误信息: Resistance limit maximum below minimum
    // 说明: 电阻最大值限制小于最小值

    // 错误码: -902
    // 错误信息: Resistance value out of limit range
    // 说明: 电阻值超出限制范围

    // 错误码: -903
    // 错误信息: Resistance step size too large
    // 说明: 电阻步进值过大

    // 错误码: -904
    // 错误信息: Calibration mode not set
    // 说明: 校准模式未设置

    // 错误码: -905
    // 错误信息: Calibration mode invalid
    // 说明: 校准模式无效

    // 错误码: -906
    // 错误信息: Calibration data invalid
    // 说明: 校准数据无效

    // 错误码: -907
    // 错误信息: Calibration not in setup mode
    // 说明: 校准未在设置模式下

    // 错误码: -908
    // 错误信息: Calibration save failed
    // 说明: 校准保存失败

    // 错误码: -909
    // 错误信息: Compensation mode invalid
    // 说明: 补偿模式无效

    // 错误码: -910
    // 错误信息: Output mode invalid
    // 说明: 输出模式无效

    // 错误码: -911
    // 错误信息: Temperature sensor error
    // 说明: 温度传感器错误

    // 错误码: -912
    // 错误信息: String parameter too long
    // 说明: 字符串参数过长

    // 错误码: -913
    // 错误信息: Value out of allowed range
    // 说明: 值超出允许范围

    // 错误码: -914
    // 错误信息: Calibration data corrupted
    // 说明: 校准数据损坏
