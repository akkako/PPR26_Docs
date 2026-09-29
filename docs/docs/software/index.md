# 上位机

PPR26 提供网页版与 Python 两类上位机工具，用于设备控制与固件升级。

## 网页版工具（免安装）

| 工具 | 地址 | 说明 |
| ---- | ---- | ---- |
| 工具中心 | <https://akkako.github.io/PPR26_Docs/> | 所有在线工具的入口 |
| Bootloader 升级工具 | <https://akkako.github.io/PPR26_Docs/bootloader/> | 通过 WebUSB 升级固件 |
| 串口上位机 | <https://akkako.github.io/PPR26_Docs/serial/> | 设置阻值、限值与输出状态（需 AT 模式） |

- 需要 Chrome / Edge 109+。
- 串口上位机的使用方法见[串口上位机（网页版）](webui_serial.md)。

## Python 工具

用于设备信息查询与固件升级，适合脚本化 / 批量操作。下载、命令与升级步骤见[工具下载与使用](downloads.md)。

## 页面索引

| 页面 | 内容 |
| ---- | ---- |
| [上位机使用指南](getstarted.md) | 网页版与 Python 上位机总览 |
| [串口上位机（网页版）](webui_serial.md) | 在浏览器中设置阻值、限值与输出状态 |
| [工具下载与使用](downloads.md) | Python 工具下载、命令与升级步骤 |

!!! tip "相关文档"
    - 通信模式与切换：[通信模式切换](../quickstart/modeswitch.md)
    - 固件升级步骤：[固件升级指南](../quickstart/fwupgrade.md)
