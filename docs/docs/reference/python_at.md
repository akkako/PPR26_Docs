# AT Python 编程示例

使用 AT 指令与 PPR26 进行通信，需要先配置 PPR26 工作在 USB-CDC 模式，此时 PC 端枚举设备为 USB CDC 虚拟串口设备。

!!! tip "提示信息"
    使用 USB CDC 连接 PC，操作系统通常内置驱动，不需要手动安装驱动。

具体的 AT 指令表，请参考[AT 命令远程编程参考](reference_at.md)。

本文的 Python 示例代码使用 `pyserial` 库进行 USB CDC 通信。
