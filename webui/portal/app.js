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
        entry_serial: "串口上位机",
        entry_serial_desc: "通过 WebSerial 在浏览器中控制 PPR26 设备（AT 模式）",
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
        entry_serial: "Serial Console",
        entry_serial_desc: "Control PPR26 in the browser over WebSerial (AT mode)",
    }
};

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
initLang();
