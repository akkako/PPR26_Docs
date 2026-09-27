# PPR26 文档中心

本仓库为 PPR26 文档与在线工具源码仓库，通过 GitHub Actions 部署到 GitHub Pages。

访问 [PPR26 工具中心](https://akkako.github.io/PPR26_Docs/) 可从入口页选择以下功能：

- 在线文档：[https://akkako.github.io/PPR26_Docs/docs/](https://akkako.github.io/PPR26_Docs/docs/)
- Bootloader 升级工具：[https://akkako.github.io/PPR26_Docs/bootloader/](https://akkako.github.io/PPR26_Docs/bootloader/)
- 串口上位机控制工具（建设中）：[https://akkako.github.io/PPR26_Docs/serial/](https://akkako.github.io/PPR26_Docs/serial/)

## 目录结构

```
docs/              MkDocs 文档源码
webui/             网页上位机源码
  bootloader/      Bootloader 升级工具（部署到 /bootloader/）
  portal/          工具中心入口页（部署到站点根目录）
  serial/          串口上位机占位页
.github/workflows/ GitHub Actions 部署工作流
```

推送至 `main` 分支后，GitHub Actions 会自动构建并部署。
