<p align="center">
  <img src="docs/docs/zh_CN/assets/resistor_box_logo.svg" alt="PPR26" width="120" />
</p>

# PPR26 文档中心

本仓库为 PPR26 文档与在线工具源码仓库，通过 GitHub Actions 部署到 GitHub Pages。

访问 [PPR26 工具中心](https://akkako.github.io/PPR26_Docs/) 可从入口页选择以下功能：

- 在线文档（中文）：[https://akkako.github.io/PPR26_Docs/docs/zh_CN/](https://akkako.github.io/PPR26_Docs/docs/zh_CN/)
- Documentation (English): [https://akkako.github.io/PPR26_Docs/docs/en/](https://akkako.github.io/PPR26_Docs/docs/en/)
- 文档入口（按浏览器语言自动跳转）：[https://akkako.github.io/PPR26_Docs/docs/](https://akkako.github.io/PPR26_Docs/docs/)
- Bootloader 升级工具：[https://akkako.github.io/PPR26_Docs/bootloader/](https://akkako.github.io/PPR26_Docs/bootloader/)
- 串口上位机控制工具：[https://akkako.github.io/PPR26_Docs/serial/](https://akkako.github.io/PPR26_Docs/serial/)
- Python 升级工具下载：[PPR26_Bootloader.exe](https://github.com/akkako/PPR26_Docs/releases/latest/download/PPR26_Bootloader.exe) / [PPR26_Bootloader_win32.zip](https://github.com/akkako/PPR26_Docs/releases/latest/download/PPR26_Bootloader_win32.zip)

## 目录结构

```
docs/              MkDocs 文档源码
  index.html       文档入口页（按浏览器语言跳转到 zh_CN/ 或 en/）
  mkdocs.yml       中文站点配置（docs_dir: docs/zh_CN）
  mkdocs.en.yml    英文站点配置（INHERIT 自 mkdocs.yml，docs_dir: docs/en）
  hooks/           构建钩子（语言切换器的按页跳转）
  docs/zh_CN/      中文文档（含各自的 assets/，即主题 Logo）
  docs/en/         英文文档（与中文目录结构镜像）
webui/             网页上位机源码
  bootloader/      Bootloader 升级工具（固件自动从站点 firmware/ 加载）
  portal/          工具中心入口页
  serial/          串口上位机（WebSerial 网页版，连接后校验固件版本）
firmware/          设备固件
  VERSION          第一行=最新版本号，第二行=固件文件名（与 VERSION 同目录）
  *.bin            随版本发布的固件镜像（*_pack.bin）
tools/             Python 上位机脚本
.github/workflows/
  deploy-docs.yml  构建 MkDocs 并部署到 GitHub Pages（含 firmware/）
  build-tools.yml  用 PyInstaller 打包 Python 工具（Win32）并发布 Release
```

`firmware/VERSION` 是**固件版本的唯一出处**：升级页面（`/bootloader/`）据此自动加载固件
（无需选择文件），串口上位机（`/serial/`）连接设备后据此比对 `AT+DEV.FWVER?`，
版本不一致时弹出不可关闭的升级提示。发布新固件时：把镜像放进 `firmware/`，
并把 `VERSION` 的两行改成新的版本号与文件名。

文档为两套独立站点、各自构建（`mkdocs build -f docs/mkdocs.yml` / `-f docs/mkdocs.en.yml`），
部署后分别位于 `/docs/zh_CN/` 与 `/docs/en/`，两站右上角可互相切换（当前页对应页，见 `docs/hooks/`）。
两棵目录树的**相对链接保持一致**（如 `../reference/at.md`），因此新增或修改中文页面时，请把同样的改动
同步到 `en/` 下的同名文件；对方语言缺少该页面时，语言切换器会自动退回对方首页而不是产生 404。

推送至 `main` 分支后：

- `deploy-docs.yml` 自动构建并部署文档与网页工具；
- `build-tools.yml` 自动打包 Python 上位机（Windows 32 位）并创建 Release，产物见 [Releases](https://github.com/akkako/PPR26_Docs/releases/latest)。
