# 上位机使用指南

PPR26 提供两种上位机工具用于设备控制与固件升级。

## 网页版工具

通过浏览器直接使用，无需安装：

| 工具 | 地址 | 说明 |
| ---- | ---- | ---- |
| 工具中心 | <https://akkako.github.io/PPR26_Docs/> | 所有在线工具的入口 |
| Bootloader 升级工具 | <https://akkako.github.io/PPR26_Docs/bootloader/> | 通过 WebUSB 升级固件 |

- 需要 Chrome / Edge 109+。
- 固件升级步骤详见[固件升级指南](../quickstart/fwupgrade.md)。

## Python 上位机

Python 上位机脚本随版本发布提供，可完成设备信息查询与固件升级，适合脚本化 / 批量操作。依赖 Python 3.8+ 与 `pyusb`：

```bash
pip install pyusb
```

常用命令：

```bash
python winusb_bootloader.py --info                       # 查询设备信息
python winusb_bootloader.py --upgrade PPR26_APP_pack.bin # 一键升级
```

设备信息中的制造日期格式为 `YY-WW`，硬件版本为单个数字 `0`-`6`。

详细的命令与输出示例见[固件升级指南](../quickstart/fwupgrade.md)。
