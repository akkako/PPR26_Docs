# SCPI Python 编程示例

使用 SCPI 与 PPR26 进行通信，需要先配置 PPR26 工作在 USB-TMC 模式，此时 PC 端枚举设备为 USB TMC 设备。

!!! warning "注意事项"
    USB TMC 设备需要安装对应驱动，否则在 USB 枚举时会报错没有驱动程序。

    本文推荐使用 NI-VISA，后续示例使用 NI-VISA 后端编写。

具体的 SCPI 指令表，请参考[SCPI 命令远程编程参考](reference_scpi.md)。

本文的 Python 示例代码使用 `pyvisa` 库进行 USB TMC 通信。
