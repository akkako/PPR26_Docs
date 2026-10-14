"""多语言站点：让语言切换器指向「当前页面对应的另一种语言页面」。

Material 只支持在 extra.alternate 中写死静态链接，因此这里在每个页面渲染前改写 link：

* 当前语言：指向本页自身（左上角站点标题也走同一地址）；
* 另一种语言：若对方存在同名页面则指向对应页面，否则退回对方首页，避免出现 404。

extra.alternate 中每一项包含（见 mkdocs.yml）：

    name —— 切换器中显示的语言名
    lang —— 语言代码（输出为 hreflang）
    home —— 该语言站点首页，固定不变，用于兜底与拼接对应页面地址
    link —— 实际渲染的链接，由本钩子按当前页面改写
    dir  —— 该语言内容所在目录名（docs/ 下），用于判断对应页面是否存在
"""

from pathlib import Path


def on_page_context(context, page, config, nav):
    alternates = config.extra.get("alternate") or []
    current_dir = Path(config.docs_dir).name

    for entry in alternates:
        home = entry.get("home")
        if not home:
            continue
        if entry.get("dir") == current_dir:
            entry["link"] = f"{home}{page.url}"
            continue
        counterpart = Path(config.docs_dir).parent / entry["dir"] / page.file.src_path
        entry["link"] = f"{home}{page.url}" if counterpart.exists() else home

    return context
