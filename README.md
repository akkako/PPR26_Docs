<p align="center">
  <img src="docs/docs/assets/resistor_box_logo.svg" alt="PPR26" width="120" />
</p>

# PPR26 文档中心

本仓库为 PPR26 文档与在线工具源码仓库，通过 GitHub Actions 部署到 GitHub Pages。

访问 [PPR26 工具中心](https://akkako.github.io/PPR26_Docs/) 可从入口页选择以下功能：

- 在线文档：[https://akkako.github.io/PPR26_Docs/docs/](https://akkako.github.io/PPR26_Docs/docs/)
- Bootloader 升级工具：[https://akkako.github.io/PPR26_Docs/bootloader/](https://akkako.github.io/PPR26_Docs/bootloader/)
- 串口上位机控制工具（建设中）：[https://akkako.github.io/PPR26_Docs/serial/](https://akkako.github.io/PPR26_Docs/serial/)
- Python 工具下载（最新构建）：[PPR26_Bootloader.exe](https://github.com/akkako/PPR26_Docs/releases/latest/download/PPR26_Bootloader.exe) / [PPR26_Bootloader_win32.zip](https://github.com/akkako/PPR26_Docs/releases/latest/download/PPR26_Bootloader_win32.zip)

## 目录结构

```
docs/              MkDocs 文档源码
webui/             网页上位机源码
  bootloader/      Bootloader 升级工具（部署到 /bootloader/）
  portal/          工具中心入口页（部署到站点根目录）
  serial/          串口上位机占位页
tools/             Python 上位机脚本（对外发布）
.github/workflows/
  deploy-docs.yml  构建 MkDocs 并部署到 GitHub Pages
  build-tools.yml  用 PyInstaller 打包 Python 工具（Win32）并发布 Release
```

推送至 `main` 分支后：

- `deploy-docs.yml` 自动构建并部署文档与网页工具；
- `build-tools.yml` 自动打包 Python 上位机（Windows 32 位）并创建 Release，产物见 [Releases](https://github.com/akkako/PPR26_Docs/releases/latest)。
