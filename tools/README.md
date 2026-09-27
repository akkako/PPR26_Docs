# PPR26 Python 上位机

本目录存放 PPR26 的 Python 命令行升级工具 `winusb_bootloader.py`，用于设备信息查询与固件升级。

## 直接使用脚本

```bash
pip install -r requirements.txt
python winusb_bootloader.py --info
python winusb_bootloader.py --upgrade PPR26_APP_pack.bin
```

Windows 下 `pyusb` 需要 `libusb-1.0.dll`，可放在脚本同目录（发布页提供 32 位版本）。

## 使用打包好的可执行文件

上位机代码更新后由 GitHub Actions 自动用 PyInstaller 构建 Windows（Win32）版本并发布，以下链接始终指向最新构建：

- [PPR26_Bootloader.exe](https://github.com/akkako/PPR26_Docs/releases/latest/download/PPR26_Bootloader.exe)（可执行文件）
- [PPR26_Bootloader_win32.zip](https://github.com/akkako/PPR26_Docs/releases/latest/download/PPR26_Bootloader_win32.zip)（完整压缩包）

## 文档

使用教程与下载说明见在线文档：[工具下载与使用](https://akkako.github.io/PPR26_Docs/docs/software/downloads/)。
