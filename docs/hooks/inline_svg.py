"""把 SVG 示例图内联进页面，并套上「在新窗口打开矢量原图」的链接。

matplotlib 导出的 SVG 必须**内联**到 HTML 里才能跟随页面主题：用 `<img>` 引用时
它是一个独立文档，读不到页面的 CSS 变量（`currentColor`、`--md-typeset-a-color` 等），
手动切换深浅色时也不会重绘；但也正因为不是 `<img>`，Material 的图片灯箱（glightbox）
不会作用于它，所以这里把图包在一个链接里 —— 点击在新标签页打开原图，可任意放大。

注意注入时机：在 **on_page_content**（markdown 渲染之后）替换。若放在 on_page_markdown，
SVG 会被当作 markdown 继续处理，块内的换行会被转成 `<br />`、段落被包进 `<p>`，破坏结构。

页面中写占位符即可（路径相对本语言的内容目录，即 docs_dir）：

    <!-- svg:assets/accuracy_example.svg -->
"""

import posixpath
from pathlib import Path

MARKER = "<!-- svg:"


def on_page_content(html, page, config, files):
    if MARKER not in html:
        return html

    docs_dir = Path(config.docs_dir)
    page_dir = posixpath.dirname(page.file.src_path.replace("\\", "/"))
    out = []
    for line in html.splitlines():
        stripped = line.strip()
        if stripped.startswith(MARKER) and stripped.endswith("-->"):
            rel = stripped[len(MARKER):-3].strip()
            svg = (docs_dir / rel).read_text(encoding="utf-8").strip()
            href = posixpath.relpath(rel, page_dir or ".")
            out.append(
                # display:block 让整张图都是可点击区域（inline 链接的命中区只有一行高）；
                # color:inherit 让 SVG 内的 currentColor 取页面正文颜色而不是链接色
                # （否则坐标轴文字会变蓝）
                f'<a class="ppr26-acc-figure" href="{href}" target="_blank" '
                f'rel="noopener" style="display:block;color:inherit">{svg}</a>'
            )
            continue
        out.append(line)
    return "\n".join(out)
