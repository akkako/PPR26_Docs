# 参考文档

本节汇总 PPR26 的命令参考、编程示例与脚本说明，供上位机开发与自动化测试使用。

## 命令参考

- [**AT 命令参考**](at.md) —— USB CDC（AT）模式下的全部指令。
- [**SCPI 命令参考**](scpi.md) —— USB TMC（SCPI）模式下的全部指令。

## 编程示例

- [**AT Python 编程示例**](python_at.md) —— 使用 `pyserial` 的完整操作流程。
- [**SCPI Python 编程示例**](python_scpi.md) —— 使用 `pyvisa`（NI‑VISA）的完整操作流程。

## 脚本参考

- [**脚本参考**](scripts/index.md) —— 用户校准与测试脚本说明。

!!! tip "通信模式"
    PPR26 支持 AT（USB CDC）与 SCPI（USB TMC）两种模式，切换方法见[通信模式切换](../quickstart/modeswitch.md)。
