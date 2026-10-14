/**
 * PPR26 工具中心入口页
 * 主题与语言切换，界面风格与 webui 保持一致。
 */

const I18N = {
    zh: {
        toggle_theme: "切换主题",
        toggle_lang: "切换语言",
        app_title: "PPR26 工具中心",
        entry_title: "功能入口",
        entry_desc: "选择一个功能开始使用：",
        entry_docs: "在线文档",
        entry_docs_desc: "查看 PPR26 设备规格、快速上手与参考文档",
        entry_bootloader: "Bootloader 升级工具",
        entry_bootloader_desc: "通过 WebUSB 连接设备并升级固件",
        entry_serial: "AT 串口上位机",
        entry_serial_desc: "通过 WebSerial 在浏览器中控制 PPR26 设备（AT 模式）",
        entry_ntcsim: "NTC 模拟器",
        entry_ntcsim_desc: "把 PPR26 当作热敏电阻：按 B 值法 / Steinhart-Hart / CSV 数据把温度换算成阻值并下发",
    },
    en: {
        toggle_theme: "Toggle Theme",
        toggle_lang: "Toggle Language",
        app_title: "PPR26 Tools",
        entry_title: "Entries",
        entry_desc: "Choose a tool to get started:",
        entry_docs: "Documentation",
        entry_docs_desc: "Specifications, quick start and reference for PPR26",
        entry_bootloader: "Bootloader Upgrade Tool",
        entry_bootloader_desc: "Connect via WebUSB and upgrade firmware",
        entry_serial: "AT Serial Console",
        entry_serial_desc: "Control PPR26 in the browser over WebSerial (AT mode)",
        entry_ntcsim: "NTC Simulator",
        entry_ntcsim_desc: "Use PPR26 as a thermistor: convert temperature to resistance (B-value / Steinhart-Hart / CSV) and apply it",
    }
};

// 文档站点分中英文两套，入口链接随界面语言切换（与文档站点目录一致）
const DOCS_ENTRY = {
    zh: "docs/zh_CN/",
    en: "docs/en/",
};

/**
 * 本地调试时的路径适配。
 *
 * 发布布局：入口页在站点根，工具在 /serial/、/ntcsim/ 等，文档在 /docs/<lang>/；
 * 仓库布局：从仓库根起静态服务时，入口页在 /webui/portal/，工具在 /webui/<tool>/，
 *           文档在 /docs/site/<lang>/（本地 mkdocs build 的输出）。
 *
 * 这里按当前路径判断所处布局，把相对链接补成正确的一级；两种访问方式都能点通。
 */
const IN_REPO_LAYOUT = location.pathname.includes("/webui/portal");
const DOCS_ENTRY_LOCAL = {
    zh: "../../docs/site/zh_CN/",
    en: "../../docs/site/en/",
};

/** 工具卡片：发布布局下是相对同级目录，仓库布局下是上一级目录 */
function resolveToolLinks() {
    const prefix = IN_REPO_LAYOUT ? "../" : "";
    document.querySelectorAll(".entry-item[href]").forEach(el => {
        const href = el.getAttribute("href");
        if (/^(bootloader|serial|ntcsim)\/$/.test(href)) {
            el.setAttribute("href", prefix + href);
        }
    });
}

let currentLang = "zh";

function t(key) {
    return I18N[currentLang][key] || key;
}

function applyLang() {
    document.querySelectorAll("[data-i18n]").forEach(el => {
        el.textContent = t(el.getAttribute("data-i18n"));
    });
    document.querySelectorAll("[data-i18n-title]").forEach(el => {
        el.setAttribute("title", t(el.getAttribute("data-i18n-title")));
    });
    const langBtn = document.getElementById("langToggle");
    if (langBtn) langBtn.textContent = currentLang === "zh" ? "EN" : "中";
    const docsEntry = document.getElementById("docsEntry");
    if (docsEntry) {
        const table = IN_REPO_LAYOUT ? DOCS_ENTRY_LOCAL : DOCS_ENTRY;
        docsEntry.setAttribute("href", table[currentLang]);
    }
    document.documentElement.setAttribute("lang", currentLang);
}

function initLang() {
    const saved = localStorage.getItem("lang");
    currentLang = saved || "zh";
    applyLang();
}

function toggleLang() {
    currentLang = currentLang === "zh" ? "en" : "zh";
    localStorage.setItem("lang", currentLang);
    applyLang();
}

// ------------------------------------------------------------------
// Theme
// ------------------------------------------------------------------

function initTheme() {
    const saved = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = saved || (prefersDark ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", theme);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
}

// ------------------------------------------------------------------
// Events
// ------------------------------------------------------------------

document.getElementById("themeToggle").addEventListener("click", toggleTheme);
document.getElementById("langToggle").addEventListener("click", toggleLang);

initTheme();
resolveToolLinks();
initLang();
