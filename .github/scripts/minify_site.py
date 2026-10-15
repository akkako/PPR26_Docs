#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""发布目录精简：把组装好的 site/ 处理成适合分发的形式（只在部署流程里跑，源码保持可读）。

处理内容：

1. **JS / ES 模块 / CSS** —— 用 esbuild 压缩：去注释、去空白、局部变量改名。
   上游已经压缩过的 `*.min.js` / `*.min.css` 跳过，不重复处理。
   注意必须显式 `--charset=utf8`：esbuild 默认把非 ASCII 字符转成 ``\\uXXXX`` 转义，
   中文字符串反而会变大。
2. **HTML** —— 去掉注释；`<pre>` / `<textarea>` / `<script>` / `<style>` 内部原样保留
   （代码块与内联脚本不能动）。标签之间的空白**不**压缩：Markdown 生成的页面里
   inline-block 元素（图标按钮等）之间的空白会影响排版，省下的那点体积 gzip 也能吃掉。
3. **JSON**（search_index.json）—— 紧凑序列化，数据等价，体积约 -30%。
4. **sourcemap** —— 删除 `*.map`：只有打开开发者工具才会请求，普通浏览不会下载。
5. **引用加内容哈希** —— HTML 里的本地 `.js/.mjs/.css` 引用与 JS 里的相对模块引用
   都写成 `?v=<内容哈希前 8 位>`，部署后浏览器不会拿到旧缓存
   （GitHub Pages 的 `Cache-Control: max-age=600`，不带哈希时最多会有 10 分钟的旧版本窗口）。
6. 打印处理前后的体积（原始 + gzip）对比，CI 日志里能直接看到省了多少。

用法：

    python .github/scripts/minify_site.py site
    python .github/scripts/minify_site.py site --esbuild ./node_modules/.bin/esbuild

esbuild 查找顺序：`--esbuild` 参数 > 环境变量 `ESBUILD` > `PATH` > 当前目录
`node_modules/.bin/esbuild` > `node_modules/@esbuild/*/esbuild[.exe]`。
找不到就直接报错退出，避免"静默地发一份没压缩的产物"。
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys

# 上游已压缩的文件：跳过（重复压缩没有收益，还可能惹麻烦）
MINIFIED_RE = re.compile(r"\.min\.(?:js|css)$", re.IGNORECASE)
JS_EXTS = (".js", ".mjs")
CSS_EXTS = (".css",)
WEB_EXTS = JS_EXTS + CSS_EXTS

# HTML：先"藏起"这些区域，注释只在它们之外删
PROTECT_RE = re.compile(r"(?is)<(pre|textarea|script|style)\b.*?</\1\s*>")
COMMENT_RE = re.compile(r"(?s)<!--(?!\[if).*?-->")
TRAILING_WS_RE = re.compile(r"[ \t]+\n")

ASSET_RE = re.compile(r"""(?P<head>\b(?:src|href)\s*=\s*)(?P<q>["'])(?P<url>[^"']+)(?P=q)""")
# import ... from "./x.mjs" / import("./x.js") —— 相对模块引用
SPEC_RE = re.compile(r"""(?P<head>\bfrom\s*|\bimport\s*\(\s*)(?P<q>["'])(?P<url>\.{1,2}/[^"']+)(?P=q)""")
EXTERNAL_RE = re.compile(r"^(?:[a-zA-Z][a-zA-Z0-9+.\-]*:|//|#|data:|javascript:)")


# --------------------------------------------------------------------------- #
# 工具查找
# --------------------------------------------------------------------------- #
def find_esbuild(explicit: str | None) -> str | None:
    candidates = [explicit, os.environ.get("ESBUILD")]
    candidates.append(shutil.which("esbuild"))
    local = os.path.join(os.getcwd(), "node_modules", ".bin", "esbuild")
    candidates.append(local if os.path.exists(local) else None)
    vendor = os.path.join(os.getcwd(), "node_modules", "@esbuild")
    if os.path.isdir(vendor):
        for name in sorted(os.listdir(vendor)):
            for binary in ("esbuild", "esbuild.exe"):
                path = os.path.join(vendor, name, binary)
                if os.path.exists(path):
                    candidates.append(path)
    for candidate in candidates:
        if candidate and (shutil.which(candidate) or os.path.exists(candidate)):
            return candidate
    return None


def find_node(explicit: str | None) -> str | None:
    for candidate in (explicit, os.environ.get("NODE"), shutil.which("node")):
        if candidate and (shutil.which(candidate) or os.path.exists(candidate)):
            return candidate
    return None


# --------------------------------------------------------------------------- #
# 各类处理
# --------------------------------------------------------------------------- #
def minify_js_css(esbuild: str, path: str) -> None:
    """就地压缩一个 JS/CSS 文件（esbuild 先读完整文件再写，直接同名输出是安全的）。"""
    tmp = path + ".tmp-minify"
    try:
        subprocess.run(
            [esbuild, path, "--minify", "--charset=utf8", "--target=es2020",
             "--legal-comments=none", "--log-level=warning", "--outfile=" + tmp],
            check=True, capture_output=True, text=True)
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.remove(tmp)


def strip_html_comments(text: str) -> str:
    stash: list[str] = []

    def keep(match: re.Match) -> str:
        stash.append(match.group(0))
        return "\x00%d\x00" % (len(stash) - 1)

    protected = PROTECT_RE.sub(keep, text)          # <pre>/<script>/... 先藏起来
    protected = COMMENT_RE.sub("", protected)       # 只删它们之外的注释
    protected = TRAILING_WS_RE.sub("\n", protected)  # 注释留下的行尾空白
    return re.sub(r"\x00(\d+)\x00", lambda m: stash[int(m.group(1))], protected)


def compact_json(path: str) -> None:
    with open(path, encoding="utf-8") as handle:
        raw = handle.read()
    data = json.loads(raw)                          # 解析失败直接抛错，不动原文件
    compact = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    with open(path, "w", encoding="utf-8", newline="\n") as handle:
        handle.write(compact)


def _hashed_url(base_dir: str, url: str) -> str:
    """给相对引用的本地 js/mjs/css 加上（或刷新）?v=<内容哈希>；不适用时原样返回。"""
    if not url or EXTERNAL_RE.match(url):
        return url
    target, hash_sep, fragment = url.partition("#")
    target, query_sep, _query = target.partition("?")
    if not target.lower().endswith(WEB_EXTS):
        return url
    if MINIFIED_RE.search(target):
        return url
    full = os.path.normpath(os.path.join(base_dir, target))
    if not os.path.isfile(full):
        return url
    with open(full, "rb") as handle:
        digest = hashlib.sha1(handle.read()).hexdigest()[:8]
    suffix = ("#" + fragment) if hash_sep else ""
    return "%s?v=%s%s" % (target, digest, suffix)


def add_content_hashes(root: str) -> int:
    """HTML 的资源引用与 JS 的相对模块引用都带上内容哈希，返回改动的引用条数。"""
    changed = 0
    for current, _dirs, files in os.walk(root):
        for name in files:
            path = os.path.join(current, name)
            ext = os.path.splitext(name)[1].lower()
            if ext == ".html":
                pattern, encoding = ASSET_RE, "utf-8"
            elif ext in JS_EXTS:
                pattern, encoding = SPEC_RE, "utf-8"
            else:
                continue
            with open(path, encoding=encoding) as handle:
                text = handle.read()

            def rewrite(match: re.Match, _dir=current) -> str:
                nonlocal changed
                url = match.group("url")
                new_url = _hashed_url(_dir, url)
                if new_url == url:
                    return match.group(0)
                changed += 1
                return "%s%s%s%s" % (match.group("head"), match.group("q"),
                                     new_url, match.group("q"))

            new_text = pattern.sub(rewrite, text)
            if new_text != text:
                with open(path, "w", encoding=encoding, newline="") as handle:
                    handle.write(new_text)
    return changed


# --------------------------------------------------------------------------- #
# 体积统计
# --------------------------------------------------------------------------- #
def gzip_len(path: str) -> int:
    with open(path, "rb") as handle:
        return len(gzip.compress(handle.read(), 6))


def survey(root: str) -> dict[str, tuple[int, int, int]]:
    """{扩展名: (文件数, 原始字节, gzip 字节)}"""
    stats: dict[str, list[int]] = {}
    for current, _dirs, files in os.walk(root):
        for name in files:
            path = os.path.join(current, name)
            ext = os.path.splitext(name)[1].lower() or "(无扩展名)"
            entry = stats.setdefault(ext, [0, 0, 0])
            entry[0] += 1
            entry[1] += os.path.getsize(path)
            entry[2] += gzip_len(path)
    return {ext: tuple(v) for ext, v in stats.items()}


def human(size: int) -> str:
    return "%.1f KB" % (size / 1024.0)


def print_report(before, after) -> None:
    print("\n%-10s %6s %12s %12s %12s %8s" % (
        "类型", "文件", "原始→压缩", "gzip→gzip", "gzip 节省", "原始占比"))
    print("-" * 70)
    for ext in sorted(set(before) | set(after), key=lambda e: -before.get(e, (0, 0, 0))[2]):
        b = before.get(ext, (0, 0, 0))
        a = after.get(ext, (0, 0, 0))
        saving = "" if not b[2] else "%d%%" % round(100 * (b[2] - a[2]) / b[2])
        ratio = "" if not b[1] else "%d%%" % round(100 * a[1] / b[1])
        print("%-10s %6s %12s %12s %12s %8s" % (
            ext, "%d→%d" % (b[0], a[0]),
            "%s→%s" % (human(b[1]), human(a[1])),
            "%s→%s" % (human(b[2]), human(a[2])), saving, ratio))
    tb = (sum(v[1] for v in before.values()), sum(v[2] for v in before.values()))
    ta = (sum(v[1] for v in after.values()), sum(v[2] for v in after.values()))
    print("-" * 70)
    print("%-10s %6s %12s %12s %12s %8s" % (
        "合计", "", "%s→%s" % (human(tb[0]), human(ta[0])),
        "%s→%s" % (human(tb[1]), human(ta[1])),
        "%d%%" % round(100 * (tb[1] - ta[1]) / tb[1]), "%d%%" % round(100 * ta[0] / tb[0])))


# --------------------------------------------------------------------------- #
# 主流程
# --------------------------------------------------------------------------- #
def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="把发布目录处理成适合分发的形式。")
    parser.add_argument("site", help="组装好的发布目录（就地处理）")
    parser.add_argument("--esbuild", default=None, help="esbuild 可执行文件路径")
    parser.add_argument("--node", default=None, help="node 可执行文件路径（用于压缩后的语法自检）")
    parser.add_argument("--no-hash", action="store_true", help="不加资源内容哈希")
    args = parser.parse_args(argv)

    root = os.path.abspath(args.site)
    if not os.path.isdir(root):
        print("目录不存在：%s" % root, file=sys.stderr)
        return 2

    esbuild = find_esbuild(args.esbuild)
    if not esbuild:
        print("找不到 esbuild：请用 --esbuild 指定，或先 npm install esbuild。", file=sys.stderr)
        return 2
    node = find_node(args.node)
    print("站点目录：%s" % root)
    print("esbuild：%s%s" % (esbuild, "" if node else "（未找到 node，跳过语法自检）"))

    before = survey(root)

    targets = []
    for current, _dirs, files in os.walk(root):
        for name in files:
            path = os.path.join(current, name)
            ext = os.path.splitext(name)[1].lower()
            if ext in WEB_EXTS and not MINIFIED_RE.search(name):
                targets.append(path)
    for index, path in enumerate(sorted(targets), 1):
        minify_js_css(esbuild, path)
        print("  [%3d/%d] %s" % (index, len(targets), os.path.relpath(path, root)))

    if node:
        failed = []
        for path in sorted(targets):
            if not path.lower().endswith(JS_EXTS):
                continue
            result = subprocess.run([node, "--check", path], capture_output=True, text=True)
            if result.returncode != 0:
                failed.append((path, result.stderr.strip().splitlines()[:1]))
        if failed:
            for path, err in failed:
                print("压缩后语法检查失败：%s %s" % (path, err), file=sys.stderr)
            return 1
        print("压缩后语法自检：%d 个 JS 文件全部通过" % sum(1 for p in targets if p.lower().endswith(JS_EXTS)))

    html_count = json_count = map_count = 0
    for current, _dirs, files in os.walk(root):
        for name in files:
            path = os.path.join(current, name)
            ext = os.path.splitext(name)[1].lower()
            if ext == ".html":
                with open(path, encoding="utf-8") as handle:
                    text = handle.read()
                new_text = strip_html_comments(text)
                if new_text != text:
                    with open(path, "w", encoding="utf-8", newline="") as handle:
                        handle.write(new_text)
                    html_count += 1
            elif ext == ".json":
                compact_json(path)
                json_count += 1
            elif ext == ".map" or name.endswith(".map"):
                os.remove(path)
                map_count += 1
    print("HTML 去注释：%d 个；JSON 紧凑化：%d 个；删除 sourcemap：%d 个" % (
        html_count, json_count, map_count))

    if args.no_hash:
        print("按参数要求：跳过资源内容哈希")
    else:
        print("资源引用加内容哈希：%d 处" % add_content_hashes(root))

    print_report(before, survey(root))
    return 0


if __name__ == "__main__":
    sys.exit(main())
