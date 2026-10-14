/**
 * PPR26 Serial Console WebUI
 *
 * WebSerial + AT commands only (USB CDC). Works only when the device is in
 * AT mode: the AT/CDC firmware enumerates as VID 0xFFFE / PID 0xFFFE, while
 * SCPI (TMC) uses PID 0xFFFF and DFU uses PID 0xFFFD, so the port filter
 * below hides every non-AT mode automatically.
 *
 * Style / i18n / theme follow webui/portal and webui/bootloader.
 */

const VID = 0xFFFE;
const PID_AT = 0xFFFE;
const BAUDRATE = 115200;
const CMD_TIMEOUT_MS = 3000;

/* Resistance range of the device: 5 Ohm .. 4 MOhm (mOhm, 64-bit). */
const RES_MIN_MOHM = 5000;
const RES_MAX_MOHM = 4000000000;

const CALI_SET_USER = 0;

// ------------------------------------------------------------------
// I18N
// ------------------------------------------------------------------

const I18N = {
    zh: {
        page_title: "PPR26 串口上位机",
        toggle_theme: "切换主题",
        toggle_lang: "切换语言",
        btn_back: "返回工具中心",

        title_connect: "连接",
        btn_connect: "连接设备",
        btn_disconnect: "断开",
        btn_refresh: "刷新",
        status_disconnected: "未连接",
        status_connecting: "连接中…",
        status_connected: "已连接",
        connect_hint: "需要 Chrome / Edge 109+，通过 https 或 http://localhost 打开。设备须工作在 AT 模式（USB CDC），并请先关闭其它占用串口的程序。",

        title_resistance: "阻值控制",
        label_sp: "设定阻值",
        label_pv: "实际估测",
        label_set_resistance: "设定阻值",
        label_step: "步进值",
        btn_set: "设置",
        btn_step_down: "− 单步",
        btn_step_up: "+ 单步",

        title_limits: "阻值限制",
        label_limit_enable: "启用限值",
        label_min: "最小阻值",
        label_max: "最大阻值",

        title_output: "输出状态",
        state_normal: "正常",
        state_open: "开路",
        state_short: "短路",

        title_device_info: "设备信息",
        info_model: "型号",
        info_sn: "序列号",
        info_fw: "固件版本",
        info_hw: "硬件版本",
        info_prod: "生产日期",
        info_comp: "补偿模式",
        info_cali_set: "应用校准数据集",
        info_protocol: "通信协议",

        comp_0: "不补偿 (UNCAL)",
        comp_1: "附近最佳 (NEARBY)",
        comp_2: "多档位最佳 (PRECISE)",
        cali_0: "用户校准 (USER)",
        cali_1: "出厂校准 (FACTORY)",
        proto_0: "AT",
        proto_1: "SCPI",
        value_inf: "开路",

        title_log: "日志",
        btn_clear_log: "清空",

        err_no_webserial: "当前浏览器不支持 WebSerial，请使用 Chrome / Edge 109+，并通过 https 或 http://localhost 打开",
        err_no_device_selected: "未选择设备",
        err_no_device_found: "未找到 PPR26 串口设备（请确认设备已工作在 AT 模式）",
        err_not_connected: "设备未连接",
        err_open_failed: "打开串口失败: ",
        err_timeout: "设备响应超时",
        err_device_error: "设备返回 ERROR（参数越界或当前状态不允许）",
        err_overflow: "命令过长，设备返回 OVERFLOW",
        err_value_invalid: "输入格式无效",
        err_value_precision: "精度超过 1 mΩ，请减少小数位",
        err_value_range: "超出允许范围: ",
        err_limit_range: "超出限值范围: ",
        err_device_wrong_mode: "设备不在 AT 模式，请切换后重试",

        log_ready: "WebSerial 上位机已加载",
        log_unsupported: "未检测到 navigator.serial，请改用 Chrome/Edge 并通过 https 或 http://localhost 打开",
        log_connecting: "正在选择设备…",
        log_connected: "设备已连接",
        log_disconnected: "设备已断开",
        log_please_connect: "请先连接设备",
        log_unexpected: "收到非预期响应:",

        /* 固件版本检查（连接后与 firmware/VERSION 比对；设备更旧时提示并自动进入 DFU） */
        fw_modal_title: "固件版本不一致",
        fw_modal_text: "当前设备固件版本为 {0}，最新发布版本为 {1}。版本不一致，请先升级固件。",
        fw_modal_note: "此提示无法关闭：升级到最新版本后重新连接（或点击重新检测）即自动解除。",
        fw_modal_upgrade: "前往升级",
        fw_modal_recheck: "重新检测",
        fw_dfu_sending: "正在让设备进入 DFU 模式…",
        fw_dfu_sent: "已发送 AT+DEV.DFU：设备断开并重启为 DFU 模式，接下来点击「前往升级」。",
        fw_dfu_failed: "自动进入 DFU 失败: ",
        fw_recheck_disconnected: "设备未连接：请先连接设备，或直接前往升级页面。",
        fw_recheck_in_dfu: "设备已进入 DFU 模式（串口已断开）：请点击「前往升级」继续。",
        err_version_invalid: "VERSION 文件格式无效（第一行应为固件版本号）",
        log_fw_latest: "最新固件版本: {0}",
        log_fw_latest_unknown: "未获取到最新固件版本（{0}），本次跳过固件版本检查",
        log_fw_match: "固件版本与最新发布版本一致（{0}）",
        log_fw_mismatch: "固件版本不一致：设备 {0}，最新 {1}",
        log_fw_newer: "设备固件 {0} 比站点发布版本 {1} 更新（可能是开发版本），无需升级，未提示",
        log_fw_uncomparable: "无法比较固件版本：设备 {0}，站点 {1}，未提示",
        log_dfu_sent: "已发送 AT+DEV.DFU，设备将断开并重启为 DFU 模式",
        log_dfu_failed: "发送 AT+DEV.DFU 失败: ",
    },
    en: {
        page_title: "PPR26 Serial Console",
        toggle_theme: "Toggle Theme",
        toggle_lang: "Toggle Language",
        btn_back: "Back to Tools",

        title_connect: "Connect",
        btn_connect: "Connect Device",
        btn_disconnect: "Disconnect",
        btn_refresh: "Refresh",
        status_disconnected: "Disconnected",
        status_connecting: "Connecting...",
        status_connected: "Connected",
        connect_hint: "Requires Chrome / Edge 109+ over https or http://localhost. The device must be in AT mode (USB CDC); close other programs using the port first.",

        title_resistance: "Resistance",
        label_sp: "Setpoint",
        label_pv: "Estimated",
        label_set_resistance: "Set value",
        label_step: "Step",
        btn_set: "Set",
        btn_step_down: "− Step",
        btn_step_up: "+ Step",

        title_limits: "Limits",
        label_limit_enable: "Enable limits",
        label_min: "Minimum",
        label_max: "Maximum",

        title_output: "Output State",
        state_normal: "Normal",
        state_open: "Open",
        state_short: "Short",

        title_device_info: "Device Info",
        info_model: "Model",
        info_sn: "Serial number",
        info_fw: "Firmware version",
        info_hw: "Hardware version",
        info_prod: "Production date",
        info_comp: "Compensation mode",
        info_cali_set: "Applied calibration set",
        info_protocol: "Protocol",

        comp_0: "Uncalibrated (UNCAL)",
        comp_1: "Nearby (NEARBY)",
        comp_2: "Precise (PRECISE)",
        cali_0: "User (USER)",
        cali_1: "Factory (FACTORY)",
        proto_0: "AT",
        proto_1: "SCPI",
        value_inf: "Open",

        title_log: "Log",
        btn_clear_log: "Clear",

        err_no_webserial: "WebSerial is not supported. Use Chrome / Edge 109+ over https or http://localhost",
        err_no_device_selected: "No device selected",
        err_no_device_found: "No PPR26 serial device found (make sure the device is in AT mode)",
        err_not_connected: "Device not connected",
        err_open_failed: "Failed to open serial port: ",
        err_timeout: "Device response timeout",
        err_device_error: "Device returned ERROR (out of range or not allowed now)",
        err_overflow: "Command too long; device returned OVERFLOW",
        err_value_invalid: "Invalid input format",
        err_value_precision: "Precision finer than 1 mOhm; reduce decimals",
        err_value_range: "Out of allowed range: ",
        err_limit_range: "Out of the configured limits: ",
        err_device_wrong_mode: "Device is not in AT mode, please switch and retry",

        log_ready: "WebSerial console loaded",
        log_unsupported: "navigator.serial is unavailable; use Chrome/Edge over https or http://localhost",
        log_connecting: "Selecting a device...",
        log_connected: "Device connected",
        log_disconnected: "Device disconnected",
        log_please_connect: "Please connect the device first",
        log_unexpected: "Unexpected response:",

        /* Firmware version check (against firmware/VERSION; notice + auto DFU only when the device is older) */
        fw_modal_title: "Firmware version mismatch",
        fw_modal_text: "The device runs firmware {0}; the latest release is {1}. The versions do not match — please upgrade the firmware first.",
        fw_modal_note: "This notice cannot be dismissed: it disappears after upgrading to the latest version and reconnecting (or clicking Check Again).",
        fw_modal_upgrade: "Go to Upgrade",
        fw_modal_recheck: "Check Again",
        fw_dfu_sending: "Switching the device to DFU mode...",
        fw_dfu_sent: "AT+DEV.DFU sent: the device disconnects and reboots into DFU mode; next, click \"Go to Upgrade\".",
        fw_dfu_failed: "Automatic DFU entry failed: ",
        fw_recheck_disconnected: "Device not connected: connect the device first, or go straight to the upgrade page.",
        fw_recheck_in_dfu: "The device is in DFU mode (the serial port is gone): click \"Go to Upgrade\" to continue.",
        err_version_invalid: "Invalid VERSION file (line 1 must be the firmware version)",
        log_fw_latest: "Latest firmware version: {0}",
        log_fw_latest_unknown: "Latest firmware version unavailable ({0}); skipping the version check",
        log_fw_match: "Firmware version matches the latest release ({0})",
        log_fw_mismatch: "Firmware version mismatch: device {0}, latest {1}",
        log_fw_newer: "Device firmware {0} is newer than the published release ({1}) — most likely a development build; no notice shown",
        log_fw_uncomparable: "Cannot compare firmware versions (device {0}, site {1}); no notice shown",
        log_dfu_sent: "AT+DEV.DFU sent; the device disconnects and reboots into DFU mode",
        log_dfu_failed: "Failed to send AT+DEV.DFU: ",
    }
};

let currentLang = "zh";

function t(key) {
    return (I18N[currentLang] && I18N[currentLang][key]) || key;
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
    renderInfo();
    renderValues();   // “开路”等提示文本随语言切换更新
    renderFwModal();  // 版本不一致提示按当前语言重绘
    // 连接状态文本不参与 data-i18n 批量替换，按当前语言重新渲染。
    setConnected(dev.isOpen());
}

function initLang() {
    currentLang = localStorage.getItem("lang") || "zh";
    applyLang();
}

function toggleLang() {
    currentLang = currentLang === "zh" ? "en" : "zh";
    localStorage.setItem("lang", currentLang);
    applyLang();
}

function initTheme() {
    const saved = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.setAttribute("data-theme", saved || (prefersDark ? "dark" : "light"));
}

function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
}

// ------------------------------------------------------------------
// 固件版本检查（站点 firmware/VERSION）
// ------------------------------------------------------------------

/* VERSION 第一行是最新固件版本号，第二行是固件文件名（升级页面用）。
   先试部署后的相对路径（/serial/ → /firmware/），再试直接用仓库根提供静态
   文件时的路径（/webui/serial/ → /firmware/），本地调试两种服务方式都能用。 */
const FW_DIRS = ["../firmware/", "../../firmware/"];

let latestVersion = null;   // 取不到最新版本时跳过检查，只记日志
let fwMismatch = null;      // { device, latest, deviceAhead }：语言切换时按当前语言重绘
let dfuRequested = false;   // 本次连接是否已自动发过 AT+DEV.DFU（避免重复重启）

const elFwModal = document.getElementById("fwModal");
const elFwModalText = document.getElementById("fwModalText");
const elFwModalDfu = document.getElementById("fwModalDfu");
const elFwModalStatus = document.getElementById("fwModalStatus");

/** VERSION 文件解析：空行与 `#` 开头的注释行忽略，第一行是版本号。 */
function parseVersionFile(text) {
    const lines = String(text).split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line !== "" && !line.startsWith("#"));
    if (lines.length === 0) {
        throw new Error(t("err_version_invalid"));
    }
    return lines[0];
}

/** 读取站点上的最新固件版本号（firmware/VERSION 第一行）。 */
async function loadLatestVersion() {
    const errors = [];
    for (const dir of FW_DIRS) {
        try {
            const resp = await fetch(dir + "VERSION", { cache: "no-store" });
            if (!resp.ok) {
                errors.push(`${dir}VERSION HTTP ${resp.status}`);
                continue;
            }
            latestVersion = parseVersionFile(await resp.text());
            log(t("log_fw_latest").replace("{0}", latestVersion));
            return latestVersion;
        } catch (e) {
            errors.push(e.message);
        }
    }
    log(t("log_fw_latest_unknown").replace("{0}", errors.join("; ")), "warn");
    return null;
}

function renderFwModal() {
    elFwModalText.textContent = fwMismatch
        ? t("fw_modal_text").replace("{0}", fwMismatch.device).replace("{1}", fwMismatch.latest)
        : "";
}

/**
 * 比较两个版本号：1 = a 更新，-1 = a 更旧，0 = 相同，null = 无法比较。
 * 只取数字段比较，因此 "FW 1.0.1" 与 "1.0.1" 等价，"FW 1.0.10" 大于 "FW 1.0.9"。
 */
function compareVersions(a, b) {
    const parse = text => {
        const match = String(text || "").match(/\d+(?:\.\d+)*/);
        return match ? match[0].split(".").map(Number) : null;
    };
    const va = parse(a);
    const vb = parse(b);
    if (!va || !vb) return null;
    for (let i = 0; i < Math.max(va.length, vb.length); i++) {
        const x = va[i] || 0;
        const y = vb[i] || 0;
        if (x !== y) return x > y ? 1 : -1;
    }
    return 0;
}

/** 提示框内的 DFU 状态行："" = 进行中，ok = 已进入，err = 失败。 */
function setDfuLine(kind, text) {
    elFwModalDfu.textContent = text;
    elFwModalDfu.className = kind ? `modal-dfu ${kind}` : "modal-dfu";
}

/**
 * 版本不一致时自动让设备进入 DFU 模式（AT+DEV.DFU），省去按后面板按键。
 *
 * 设备回 OK 后立即断开 USB 并重启为 DFU 设备，OK 可能来不及送达上位机，
 * 所以**以串口是否断开作为成功判据**：断开（含等待 OK 超时）都算已进入 DFU，
 * 只有设备仍在线且明确报错时才算失败。
 */
async function enterDfuMode() {
    if (dfuRequested || !dev.isOpen()) return;
    dfuRequested = true;
    setDfuLine("", t("fw_dfu_sending"));
    try {
        await dev.command("AT+DEV.DFU");
        setDfuLine("ok", t("fw_dfu_sent"));
        log(t("log_dfu_sent"), "ok");
    } catch (e) {
        if (dev.isOpen()) {
            setDfuLine("err", t("fw_dfu_failed") + e.message);
            log(t("log_dfu_failed") + e.message, "error");
        } else {
            // 串口已随重启断开：这就是 DFU 切换成功的表现。
            setDfuLine("ok", t("fw_dfu_sent"));
            log(t("log_dfu_sent"), "ok");
        }
    }
}

/**
 * 连接成功（以及手动刷新）后比对设备固件与站点最新发布版本。
 * **只有设备固件比发布版本旧**时才弹出不可关闭的提示（并自动进入 DFU 模式）；
 * 版本一致、设备更新（开发版本）、版本号无法比较时都不打扰用户，只记日志。
 */
async function checkFirmwareVersion() {
    if (!latestVersion) {
        await loadLatestVersion();
    }
    const deviceVersion = deviceInfo ? deviceInfo.fw : null;
    if (!latestVersion || !deviceVersion) {
        return;   // 任一侧拿不到版本号就不判断，避免误报
    }

    const order = compareVersions(deviceVersion, latestVersion);

    if (order !== -1) {
        // 一致 / 设备更新 / 无法比较：清除提示，不进入 DFU。
        fwMismatch = null;
        dfuRequested = false;
        elFwModalStatus.textContent = "";
        setDfuLine("", "");
        elFwModal.hidden = true;
        if (order === 0) {
            log(t("log_fw_match").replace("{0}", latestVersion), "ok");
        } else if (order === 1) {
            log(t("log_fw_newer").replace("{0}", deviceVersion).replace("{1}", latestVersion));
        } else {
            log(t("log_fw_uncomparable")
                .replace("{0}", deviceVersion).replace("{1}", latestVersion), "warn");
        }
        return;
    }

    // 设备更旧：弹出提示，并自动发送 AT+DEV.DFU。
    fwMismatch = { device: deviceVersion, latest: latestVersion };
    renderFwModal();
    elFwModal.hidden = false;
    log(t("log_fw_mismatch").replace("{0}", deviceVersion).replace("{1}", latestVersion), "error");
    await enterDfuMode();
}

// ------------------------------------------------------------------
// Value helpers
// ------------------------------------------------------------------

/**
 * Parse a decimal text in the given unit into an integer number of mOhm.
 * Returns null when the text is malformed or finer than 1 mOhm.
 * factor is mOhm per unit (1000 / 1e6 / 1e9, always a power of ten).
 */
function parseOhmToMilli(text, factor) {
    const s = String(text).trim().replace(",", ".");
    if (!/^\d+(\.\d+)?$/.test(s)) return null;

    const parts = s.split(".");
    const intPart = parts[0];
    const fracPart = parts[1] || "";
    const digits = intPart + fracPart;
    const exp = (String(factor).length - 1) - fracPart.length;

    if (exp >= 0) {
        return Number(digits) * Math.pow(10, exp);
    }

    const drop = -exp;
    if (drop >= digits.length) return null;
    const kept = digits.slice(0, digits.length - drop);
    const dropped = digits.slice(digits.length - drop);
    if (/[^0]/.test(dropped)) return null;
    return Number(kept || "0");
}

/** Format an integer mOhm value for display, auto-scaling the unit. */
function formatOhm(mohm) {
    if (mohm === null || mohm === undefined || Number.isNaN(mohm)) return "--";
    let unit = "Ω";
    let div = 1000;
    let decimals = 3;   // 每个量级保留 1 mΩ 分辨率
    if (mohm >= 1e9) {
        unit = "MΩ";
        div = 1e9;
        decimals = 9;
    } else if (mohm >= 1e6) {
        unit = "kΩ";
        div = 1e6;
        decimals = 6;
    }
    let text = (mohm / div).toFixed(decimals).replace(/0+$/, "").replace(/\.$/, "");
    if (text === "") text = "0";
    return text + " " + unit;
}

function wrapError(message, type = "error") {
    log(message, type);
    return new Error(message);
}

// ------------------------------------------------------------------
// Serial transport
// ------------------------------------------------------------------

class Ppr26Serial {
    constructor() {
        this.port = null;
        this.reader = null;
        this.readLoop = null;
        this.lines = [];
        this.waiters = [];
        this.buffer = "";
        this.decoder = new TextDecoder();
        this.chain = Promise.resolve();
        this.manualClose = false;
        this.desynced = false;    // set after a timeout: drain before the next command
        this.lastLineAt = 0;      // timestamp of the last received line
        this.onLine = null;       // optional hook for unsolicited lines
        this.onDisconnect = null; // called when the port goes away
    }

    isOpen() {
        return this.port !== null;
    }

    async connect() {
        if (!navigator.serial) {
            throw wrapError(t("err_no_webserial"));
        }

        let port;
        try {
            port = await navigator.serial.requestPort({
                filters: [{ usbVendorId: VID, usbProductId: PID_AT }]
            });
        } catch (e) {
            // Chrome rejects requestPort() with NotFoundError when the user
            // cancels the chooser or when no connected device matches.
            if (e && e.name === "NotFoundError") {
                throw wrapError(t("err_no_device_found"));
            }
            throw e;
        }
        if (!port) {
            throw wrapError(t("err_no_device_selected"));
        }

        try {
            await port.open({ baudRate: BAUDRATE });
        } catch (e) {
            throw wrapError(t("err_open_failed") + (e && e.message ? e.message : e));
        }

        this.port = port;
        this.lines = [];
        this.waiters = [];
        this.buffer = "";
        this.chain = Promise.resolve();
        this._startReadLoop();
    }

    async disconnect() {
        const port = this.port;
        this.port = null;
        this.manualClose = true;
        this._failWaiters();

        if (this.reader) {
            try {
                await this.reader.cancel();
            } catch (e) {
                /* already gone */
            }
        }
        if (this.readLoop) {
            try {
                await this.readLoop;
            } catch (e) {
                /* handled inside the loop */
            }
        }
        if (port) {
            try {
                await port.close();
            } catch (e) {
                /* device already unplugged */
            }
        }
        this.manualClose = false;
    }

    _startReadLoop() {
        this.reader = this.port.readable.getReader();
        this.readLoop = (async () => {
            try {
                for (;;) {
                    const { value, done } = await this.reader.read();
                    if (done) break;
                    this.buffer += this.decoder.decode(value, { stream: true });
                    let index;
                    while ((index = this.buffer.indexOf("\n")) >= 0) {
                        const line = this.buffer.slice(0, index).replace(/\r$/, "");
                        this.buffer = this.buffer.slice(index + 1);
                        this._onLine(line);
                    }
                }
            } catch (e) {
                /* port closed or unplugged */
            } finally {
                try {
                    this.reader.releaseLock();
                } catch (e) {
                    /* ignore */
                }
                this.reader = null;
                // 读循环结束：手动断开时由 disconnect() 收尾（manualClose=true），
                // 否则说明设备被拔出 / 复位 / 切到 DFU、SCPI 模式。
                if (!this.manualClose && this.port !== null) {
                    this.port = null;
                    this.buffer = "";
                    this._failWaiters();
                    if (this.onDisconnect) {
                        this.onDisconnect();
                    }
                }
            }
        })();
    }

    _onLine(line) {
        if (line === "") return;
        log(line, "rx");
        this.lastLineAt = Date.now();

        // Each waiter owns its own timer; the oldest one consumes the line.
        const waiter = this.waiters.shift();
        if (waiter) {
            clearTimeout(waiter.timer);
            waiter.resolve(line);
            return;
        }
        if (this.onLine) {
            this.onLine(line);
            return;
        }
        this.lines.push(line);
    }

    /** Reject pending transactions (port closed or device gone). */
    _failWaiters() {
        const waiters = this.waiters;
        this.waiters = [];
        for (const waiter of waiters) {
            clearTimeout(waiter.timer);
            waiter.reject(new Error(t("err_not_connected")));
        }
    }

    /** Wait until the port stays quiet for quietMs, then drop buffered lines. */
    _drain(quietMs = 200, maxMs = 1500) {
        const deadline = Date.now() + maxMs;
        return new Promise((resolve) => {
            const check = () => {
                if (Date.now() - this.lastLineAt >= quietMs || Date.now() >= deadline) {
                    this.lines = [];
                    resolve();
                } else {
                    setTimeout(check, 20);
                }
            };
            check();
        });
    }

    _waitLine(timeoutMs) {
        if (this.lines.length) {
            return Promise.resolve(this.lines.shift());
        }
        return new Promise((resolve, reject) => {
            const waiter = { resolve, reject, timer: 0 };
            waiter.timer = setTimeout(() => {
                const index = this.waiters.indexOf(waiter);
                if (index >= 0) {
                    this.waiters.splice(index, 1);
                }
                // 超时后设备仍可能迟到回一条：标记失步，
                // 下一条命令发送前先等串口安静并丢弃残留行。
                this.desynced = true;
                this.lines = [];
                reject(new Error(t("err_timeout")));
            }, timeoutMs);
            this.waiters.push(waiter);
        });
    }

    /** Serialize all transactions: one command in flight at a time. */
    _enqueue(fn) {
        const run = this.chain.then(fn, fn);
        this.chain = run.catch(() => { });
        return run;
    }

    async _write(cmd) {
        log(cmd, "tx");
        const writer = this.port.writable.getWriter();
        try {
            await writer.write(new TextEncoder().encode(cmd + "\r\n"));
        } finally {
            writer.releaseLock();
        }
    }

    async _transaction(cmd, queryName) {
        if (!this.isOpen()) {
            throw new Error(t("err_not_connected"));
        }

        // Drop stale lines so a previous timeout cannot desync this command.
        this.lines = [];
        if (this.desynced) {
            await this._drain();
            this.desynced = false;
        }
        await this._write(cmd);

        const deadline = Date.now() + CMD_TIMEOUT_MS;
        for (;;) {
            let line;
            try {
                line = await this._waitLine(Math.max(1, deadline - Date.now()));
            } catch (e) {
                // Name the command so a failing transaction is unambiguous.
                throw new Error(t("err_timeout") + " [" + cmd + "]");
            }
            if (line === "ERROR") {
                throw new Error(t("err_device_error") + " [" + cmd + "]");
            }
            if (line === "OVERFLOW") {
                throw new Error(t("err_overflow") + " [" + cmd + "]");
            }
            if (queryName) {
                const prefix = "+" + queryName + "=";
                if (line.startsWith(prefix)) {
                    return line.slice(prefix.length);
                }
                log(t("log_unexpected") + " " + line, "warn");
                continue;
            }
            if (line === "OK") {
                return "";
            }
            log(t("log_unexpected") + " " + line, "warn");
        }
    }

    command(cmd) {
        return this._enqueue(() => this._transaction(cmd, null));
    }

    query(cmd, name) {
        return this._enqueue(() => this._transaction(cmd, name));
    }

    // ---------------- convenience ----------------

    async ping() {
        return this.command("AT");
    }

    async readInfo() {
        const info = {};
        info.model = await this.query("AT+DEV.MODEL?", "DEV.MODEL");
        info.sn = await this.query("AT+DEV.SN?", "DEV.SN");
        info.fw = await this.query("AT+DEV.FWVER?", "DEV.FWVER");
        info.hw = await this.query("AT+DEV.HWVER?", "DEV.HWVER");
        info.prod = await this.query("AT+DEV.PROD?", "DEV.PROD");
        info.comp = parseInt(await this.query("AT+RES.COMP?", "RES.COMP"), 10);
        info.cali = parseInt(await this.query("AT+CALI.SEL?", "CALI.SEL"), 10);
        info.protocol = parseInt(await this.query("AT+SYS.PROT?", "SYS.PROT"), 10);
        return info;
    }

    async readState() {
        const state = {};
        state.sp = parseInt(await this.query("AT+RES.SP?", "RES.SP"), 10);
        const pvRaw = await this.query("AT+RES.PV?", "RES.PV");
        state.pv = (pvRaw.toLowerCase() === "inf") ? "inf" : parseInt(pvRaw, 10);
        state.step = parseInt(await this.query("AT+RES.STEP?", "RES.STEP"), 10);
        state.limitEnable = parseInt(await this.query("AT+RES.LIMIT?", "RES.LIMIT"), 10) !== 0;
        state.min = parseInt(await this.query("AT+RES.MIN?", "RES.MIN"), 10);
        state.max = parseInt(await this.query("AT+RES.MAX?", "RES.MAX"), 10);
        state.open = parseInt(await this.query("AT+RES.OPEN?", "RES.OPEN"), 10) !== 0;
        state.short = parseInt(await this.query("AT+RES.SHORT?", "RES.SHORT"), 10) !== 0;
        return state;
    }

    setResistance(mohm) {
        return this.command("AT+RES.SP=" + mohm);
    }

    setStep(mohm) {
        return this.command("AT+RES.STEP=" + mohm);
    }

    setLimitEnable(on) {
        return this.command("AT+RES.LIMIT=" + (on ? 1 : 0));
    }

    setMin(mohm) {
        return this.command("AT+RES.MIN=" + mohm);
    }

    setMax(mohm) {
        return this.command("AT+RES.MAX=" + mohm);
    }

    /* Firmware semantics: setting one state clears the other, and =0 restores
       the output to the current RES.SP setpoint. */
    setOpen(on) {
        return this.command("AT+RES.OPEN=" + (on ? 1 : 0));
    }

    setShort(on) {
        return this.command("AT+RES.SHORT=" + (on ? 1 : 0));
    }
}

// ------------------------------------------------------------------
// UI
// ------------------------------------------------------------------

const dev = new Ppr26Serial();

const elStatus = document.getElementById("connStatus");
const elLog = document.getElementById("logOutput");
const elInfoList = document.getElementById("infoList");
const elSpDisplay = document.getElementById("spDisplay");
const elPvDisplay = document.getElementById("pvDisplay");
const elInputSp = document.getElementById("inputSp");
const elUnitSp = document.getElementById("unitSp");
const elInputStep = document.getElementById("inputStep");
const elUnitStep = document.getElementById("unitStep");
const elChkLimit = document.getElementById("chkLimit");
const elInputMin = document.getElementById("inputMin");
const elUnitMin = document.getElementById("unitMin");
const elInputMax = document.getElementById("inputMax");
const elUnitMax = document.getElementById("unitMax");
const elBtnStepDown = document.getElementById("btnStepDown");
const elBtnStepUp = document.getElementById("btnStepUp");
const stateButtons = Array.from(document.querySelectorAll(".seg-btn"));

const CONTROLS = [
    "btnDisconnect", "btnRefresh", "btnSetSp", "btnSetStep",
    "btnSetMin", "btnSetMax", "chkLimit", "inputSp", "unitSp",
    "inputStep", "unitStep", "inputMin", "unitMin", "inputMax", "unitMax",
    "btnStepDown", "btnStepUp"
].map(id => document.getElementById(id));

let deviceInfo = null;
let deviceState = null;
let connecting = false;

function log(message, type = "info") {
    const now = new Date().toLocaleTimeString();
    const prefix = { error: "[ERR]", ok: "[OK ]", tx: "[TX ]", rx: "[RX ]", warn: "[WRN]" }[type] || "[INF]";
    elLog.textContent += now + " " + prefix + " " + message + "\n";
    elLog.scrollTop = elLog.scrollHeight;
}

function setConnected(connected) {
    if (connected) {
        elStatus.textContent = t("status_connected");
        elStatus.classList.add("connected");
    } else {
        elStatus.textContent = t("status_disconnected");
        elStatus.classList.remove("connected");
    }
    document.getElementById("btnConnect").disabled = connected || connecting;
    CONTROLS.forEach(el => { if (el) el.disabled = !connected; });
    stateButtons.forEach(btn => { btn.disabled = !connected; });
    if (!connected) {
        deviceInfo = null;
        deviceState = null;
        renderInfo();
        renderValues();
        renderStateButtons("normal");
        elInfoList.innerHTML = "";
    }
}

function renderInfo() {
    if (!elInfoList) return;
    const rows = [];
    if (deviceInfo) {
        const compKey = "comp_" + deviceInfo.comp;
        const caliKey = "cali_" + deviceInfo.cali;
        const protoKey = "proto_" + deviceInfo.protocol;
        rows.push(["info_model", deviceInfo.model]);
        rows.push(["info_sn", deviceInfo.sn]);
        rows.push(["info_fw", deviceInfo.fw]);
        rows.push(["info_hw", deviceInfo.hw]);
        rows.push(["info_prod", deviceInfo.prod]);
        rows.push(["info_comp", t(compKey)]);
        rows.push(["info_cali_set", t(caliKey)]);
        rows.push(["info_protocol", t(protoKey)]);
    }
    elInfoList.innerHTML = "";
    rows.forEach(([labelKey, value]) => {
        const dt = document.createElement("dt");
        dt.textContent = t(labelKey);
        const dd = document.createElement("dd");
        dd.textContent = value;
        elInfoList.appendChild(dt);
        elInfoList.appendChild(dd);
    });
}

function renderValues() {
    if (!deviceState) {
        elSpDisplay.textContent = "--";
        elPvDisplay.textContent = "--";
        return;
    }
    elSpDisplay.textContent = formatOhm(deviceState.sp);
    elPvDisplay.textContent = (deviceState.pv === "inf") ? t("value_inf") : formatOhm(deviceState.pv);
}

function renderStateButtons(active) {
    stateButtons.forEach(btn => {
        btn.classList.toggle("active", btn.dataset.state === active);
    });
}

function currentStateName(state) {
    if (!state) return "normal";
    if (state.short) return "short";
    if (state.open) return "open";
    return "normal";
}

/** Fill the inputs from the last known device state. */
function syncInputsFromState() {
    if (!deviceState) return;
    elInputSp.value = String(deviceState.sp / 1000);
    elUnitSp.value = "1000";
    elInputStep.value = String(deviceState.step / 1000);
    elUnitStep.value = "1000";
    elInputMin.value = String(deviceState.min / 1000);
    elUnitMin.value = "1000";
    elInputMax.value = String(deviceState.max / 1000);
    elUnitMax.value = "1000";
    elChkLimit.checked = deviceState.limitEnable;
    elBtnStepDown.disabled = deviceState.step <= 0;
    elBtnStepUp.disabled = deviceState.step <= 0;
    renderStateButtons(currentStateName(deviceState));
    renderValues();
}

function limitRange() {
    if (deviceState && deviceState.limitEnable) {
        return [deviceState.min, deviceState.max];
    }
    return [RES_MIN_MOHM, RES_MAX_MOHM];
}

/**
 * Update the locally cached device state after a successful operation.
 *
 * Device settings are read once on connect (and on manual refresh); a write
 * only sends the command for the item being changed and then patches the cache,
 * so no extra traffic is generated and the input fields are not rewritten.
 */
function applyLocalState(patch) {
    if (!deviceState) return;
    Object.assign(deviceState, patch);
    renderValues();
    renderStateButtons(currentStateName(deviceState));
    const noStep = deviceState.step <= 0;
    elBtnStepDown.disabled = noStep;
    elBtnStepUp.disabled = noStep;
}

/**
 * Read back the present (estimated) resistance — the single value that cannot
 * be derived locally after an output change. One command per operation.
 */
async function refreshPv() {
    if (!deviceState) return;
    const pvRaw = await dev.query("AT+RES.PV?", "RES.PV");
    deviceState.pv = (pvRaw.toLowerCase() === "inf") ? "inf" : parseInt(pvRaw, 10);
    renderValues();
}

function parseInput(inputEl, unitEl) {
    const raw = String(inputEl.value).trim().replace(",", ".");
    if (!/^\d+(\.\d+)?$/.test(raw)) {
        throw new Error(t("err_value_invalid"));
    }
    const mohm = parseOhmToMilli(raw, Number(unitEl.value));
    if (mohm === null) {
        throw new Error(t("err_value_precision"));
    }
    if (!Number.isSafeInteger(mohm)) {
        throw new Error(t("err_value_invalid"));
    }
    return mohm;
}

async function refreshAll() {
    deviceInfo = await dev.readInfo();
    deviceState = await dev.readState();
    renderInfo();
    syncInputsFromState();
    await checkFirmwareVersion();
}

/** Run an action and report exceptions to the log. */
async function run(action) {
    try {
        await action();
    } catch (e) {
        log(e.message, "error");
    }
}

/** Same as run(), but only when a device is already connected. */
async function guarded(action) {
    if (!dev.isOpen()) {
        log(t("log_please_connect"), "error");
        return;
    }
    await run(action);
}

// ---------------- events ----------------

document.getElementById("themeToggle").addEventListener("click", toggleTheme);
document.getElementById("langToggle").addEventListener("click", toggleLang);

// The connect action must NOT use guarded(): no device is open yet.
document.getElementById("btnConnect").addEventListener("click", () => run(async () => {
    if (connecting) return;   // 忽略连接过程中的重复点击
    connecting = true;
    dfuRequested = false;     // 新的一次连接：允许再次自动进入 DFU
    log(t("log_connecting"));
    setConnected(false);
    elStatus.textContent = t("status_connecting");
    try {
        await dev.connect();
        await dev.ping();
        const protocol = parseInt(await dev.query("AT+SYS.PROT?", "SYS.PROT"), 10);
        if (protocol !== 0) {
            throw new Error(t("err_device_wrong_mode"));
        }
    } catch (e) {
        try {
            await dev.disconnect();
        } catch (ignored) {
            /* ignore cleanup errors */
        }
        setConnected(false);
        throw e;
    } finally {
        connecting = false;
        setConnected(dev.isOpen());
    }

    log(t("log_connected"), "ok");
    // 连接已建立：读取配置失败只记录日志，不拆掉连接。
    await refreshAll();
}));

document.getElementById("btnDisconnect").addEventListener("click", () => guarded(async () => {
    await dev.disconnect();
    setConnected(false);
    log(t("log_disconnected"));
}));

document.getElementById("btnRefresh").addEventListener("click", () => guarded(async () => {
    await refreshAll();
    log(t("btn_refresh"), "ok");
}));

document.getElementById("btnSetSp").addEventListener("click", () => guarded(async () => {
    const mohm = parseInput(elInputSp, elUnitSp);
    const [lo, hi] = limitRange();
    if (mohm < RES_MIN_MOHM || mohm > RES_MAX_MOHM) {
        throw new Error(t("err_value_range") + formatOhm(RES_MIN_MOHM) + " ~ " + formatOhm(RES_MAX_MOHM));
    }
    if (mohm < lo || mohm > hi) {
        throw new Error(t("err_limit_range") + formatOhm(lo) + " ~ " + formatOhm(hi));
    }
    await dev.setResistance(mohm);
    // Only this command (plus one read-back of the actual value) is sent; a
    // successful set also returns the output to NORMAL on the device.
    applyLocalState({ sp: mohm, open: false, short: false });
    await refreshPv();
}));

document.getElementById("btnSetStep").addEventListener("click", () => guarded(async () => {
    const mohm = parseInput(elInputStep, elUnitStep);
    if (mohm < 0 || mohm > RES_MAX_MOHM) {
        throw new Error(t("err_value_range") + "0 ~ " + formatOhm(RES_MAX_MOHM));
    }
    await dev.setStep(mohm);
    applyLocalState({ step: mohm });
}));

elChkLimit.addEventListener("change", () => guarded(async () => {
    const wanted = elChkLimit.checked;
    try {
        await dev.setLimitEnable(wanted);
    } catch (e) {
        elChkLimit.checked = !wanted;
        throw e;
    }
    applyLocalState({ limitEnable: wanted });
}));

document.getElementById("btnSetMin").addEventListener("click", () => guarded(async () => {
    const mohm = parseInput(elInputMin, elUnitMin);
    if (mohm < RES_MIN_MOHM || mohm > RES_MAX_MOHM) {
        throw new Error(t("err_value_range") + formatOhm(RES_MIN_MOHM) + " ~ " + formatOhm(RES_MAX_MOHM));
    }
    if (deviceState && mohm > deviceState.max) {
        throw new Error(t("err_limit_range") + formatOhm(RES_MIN_MOHM) + " ~ " + formatOhm(deviceState.max));
    }
    await dev.setMin(mohm);
    applyLocalState({ min: mohm });
}));

document.getElementById("btnSetMax").addEventListener("click", () => guarded(async () => {
    const mohm = parseInput(elInputMax, elUnitMax);
    if (mohm < RES_MIN_MOHM || mohm > RES_MAX_MOHM) {
        throw new Error(t("err_value_range") + formatOhm(RES_MIN_MOHM) + " ~ " + formatOhm(RES_MAX_MOHM));
    }
    if (deviceState && mohm < deviceState.min) {
        throw new Error(t("err_limit_range") + formatOhm(deviceState.min) + " ~ " + formatOhm(RES_MAX_MOHM));
    }
    await dev.setMax(mohm);
    applyLocalState({ max: mohm });
}));

async function stepBy(direction) {
    if (!deviceState) return;
    if (deviceState.step <= 0) return;
    const [lo, hi] = limitRange();
    let target = deviceState.sp + direction * deviceState.step;
    if (target < lo) target = lo;
    if (target > hi) target = hi;
    if (target < RES_MIN_MOHM) target = RES_MIN_MOHM;
    if (target > RES_MAX_MOHM) target = RES_MAX_MOHM;
    await dev.setResistance(target);
    applyLocalState({ sp: target, open: false, short: false });
    await refreshPv();
}

elBtnStepDown.addEventListener("click", () => guarded(() => stepBy(-1)));
elBtnStepUp.addEventListener("click", () => guarded(() => stepBy(1)));

stateButtons.forEach(btn => btn.addEventListener("click", () => guarded(async () => {
    const target = btn.dataset.state;
    let sent = false;
    if (target === "open") {
        await dev.setOpen(true);
        applyLocalState({ open: true, short: false });
        sent = true;
    } else if (target === "short") {
        await dev.setShort(true);
        applyLocalState({ open: false, short: true });
        sent = true;
    } else {
        // Restore: the firmware applies RES.SP again (and clears the other flag).
        if (deviceState && deviceState.short) {
            await dev.setShort(false);
            applyLocalState({ open: false, short: false });
            sent = true;
        } else if (deviceState && deviceState.open) {
            await dev.setOpen(false);
            applyLocalState({ open: false, short: false });
            sent = true;
        }
    }
    if (sent) {
        await refreshPv();
    }
})));

document.getElementById("btnClearLog").addEventListener("click", () => {
    elLog.textContent = "";
});

// 版本不一致提示里的“重新检测”：重新读取设备固件版本再比对一次；
// 一致则提示自动消失，否则保持显示（该提示没有关闭按钮）。
document.getElementById("fwModalRecheck").addEventListener("click", async () => {
    if (!dev.isOpen() || !deviceInfo) {
        // 自动进 DFU 后串口会消失，这里给一句对应的提示而不是泛泛的“未连接”。
        elFwModalStatus.textContent = t(dfuRequested ? "fw_recheck_in_dfu" : "fw_recheck_disconnected");
        return;
    }
    elFwModalStatus.textContent = "";
    try {
        deviceInfo.fw = await dev.query("AT+DEV.FWVER?", "DEV.FWVER");
        renderInfo();
        await checkFirmwareVersion();
    } catch (e) {
        // 设备可能在提示弹出后被拔掉；错误显示在提示框内（日志被提示框挡住）。
        elFwModalStatus.textContent = e.message;
    }
});

dev.onDisconnect = () => {
    setConnected(false);
    log(t("log_disconnected"), "error");
};

// ---------------- init ----------------

initTheme();
initLang();
setConnected(false);
log(t("log_ready"));
if (!navigator.serial) {
    log(t("log_unsupported"), "error");
    document.getElementById("btnConnect").disabled = true;
}
// 提前取回最新固件版本，连接后即可直接比对（失败只记日志，连接时再试）。
loadLatestVersion();
