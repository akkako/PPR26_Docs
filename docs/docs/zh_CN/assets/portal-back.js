/*
 * 在文档站头部插入「返回工具中心」按钮，位置在主题切换按钮左侧。
 *
 * 为什么用脚本插入而不是改主题模板：Material 的 header 是内置 partial，覆写整个
 * header.html 会随版本升级失配；这里复用 Material 自己的类名（md-header__button
 * md-icon），外观与主题切换按钮完全一致，也不依赖具体版本。
 *
 * 两个语言站点各自带一份（与 assets/ 下的 logo 一样按目录镜像），内容完全一致。
 */
(function () {
    "use strict";

    /* 工具入口在站点根：线上页面形如 /PPR26_Docs/docs/zh_CN/…，本地镜像形如
       /docs/site/zh_CN/…（此时站点根就是 “/”）。 */
    function portalUrl() {
        var matched = location.pathname.match(/^(.*?)\/docs\/(?:zh_CN|en)\//);
        return matched ? matched[1] + "/" : "/";
    }

    function insert() {
        var palette = document.querySelector('.md-header__button[for^="__palette"]');
        if (!palette || document.querySelector(".js-portal-back")) {
            return;
        }

        var isEnglish = (document.documentElement.lang || "").toLowerCase().indexOf("en") === 0;
        var label = isEnglish ? "Back to Tools" : "返回工具中心";

        var link = document.createElement("a");
        link.className = "md-header__button md-icon js-portal-back";
        link.href = portalUrl();
        link.title = label;
        link.setAttribute("aria-label", label);
        link.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">'
            + '<path d="M20,11V13H8L13.5,18.5L12.08,19.92L4.16,12L12.08,4.08L13.5,5.5L8,11H20Z"/>'
            + "</svg>";

        palette.parentElement.insertBefore(link, palette);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", insert);
    } else {
        insert();
    }
})();
