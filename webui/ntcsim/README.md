# PPR26 NTC 模拟器（webui/ntcsim）

把 PPR26 当作**热敏电阻模拟器**使用的网页上位机：按 NTC 模型（B 值法 / Steinhart-Hart /
CSV 数据）把温度换算成阻值并下发到设备，也支持由阻值反解温度、按温度步进、查看温度-阻值曲线。

- 使用说明（正文）：<https://akkako.github.io/PPR26_Docs/docs/zh_CN/software/webui_ntcsim/>
- 工具地址：<https://akkako.github.io/PPR26_Docs/ntcsim/>

## 文件

| 文件 | 说明 |
| ---- | ---- |
| `index.html` / `style.css` / `app.js` | 页面本体（三栏布局；逻辑、i18n、主题、曲线都在 app.js） |
| `ntc.mjs` | 温度 ↔ 阻值算法模块（ES 模块，来自 `ref/ntc_conversion.mjs`，字节一致） |
| `resistor_box_logo.svg` | 与其它页面共用的图标副本（每页自带一份是 webui 的约定） |

## 关于 ntc.mjs（副本来源与校验）

`ntc.mjs` 是本地研究目录 `ref/` 里算法模块的副本（`ref/` 被 .gitignore 忽略，不能作为
部署依赖，因此按 webui「每个页面自包含」的约定复制一份）。它实现了 B 值法、
Steinhart-Hart、4 项 ln R 多项式、最小二乘拟合、闭式反解与查表工具。

副本若被改动，可用参考实现（Python）做数值回归：

```bash
# 与 Python 参考实现逐值比对（919 个数值 + C 查表数值）
python ref/ntc_verify_js.py --module webui/ntcsim/ntc.mjs

# 浏览器端功能回归（页面自检 + 交互 + AT 命令序列）
python ref/ntc_verify_ntcsim.py
```

## 本地调试

页面的固件版本检查会读取 `../firmware/VERSION`，因此要**从仓库根目录**起静态服务，
而不是只服务本目录。仓库里带了现成的脚本（已修正 `.mjs` 的 MIME 并镜像发布布局）：

```bash
python ref/serve_webui.py                 # 默认 127.0.0.1:8000
# 发布布局（与线上路径一致，推荐）：http://127.0.0.1:8000/ntcsim/
# 仓库布局（源码路径）：            http://127.0.0.1:8000/webui/ntcsim/
```

注意两点：

- ES 模块必须经 http(s) 提供，`file://` 直接打开会被浏览器拒绝；
- 静态服务器必须把 `.mjs` 映射为 JavaScript 类型（Python 3.11 自带的 `http.server`
  不认识 `.mjs`，会返回 `application/octet-stream`，Chromium 会拒绝加载模块）；
  `ref/serve_webui.py` 与 `ref/ntc_verify_ntcsim.py` 里都有一份正确的服务实现。

只按源码路径访问（`/webui/ntcsim/`）时工具中心的入口卡片会自动改用上一级链接，
两种访问方式都能点通。
