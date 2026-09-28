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
const CMD_TIMEOUT_MS = 1500;

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
        comp_1: "线性 (LINEAR)",
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
        comp_1: "Linear (LINEAR)",
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
    if (mohm >= 1e9) {
        unit = "MΩ";
        div = 1e9;
    } else if (mohm >= 1e6) {
        unit = "kΩ";
        div = 1e6;
    }
    let text = (mohm / div).toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
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
        this.pending = null;
        this.buffer = "";
        this.decoder = new TextDecoder();
        this.chain = Promise.resolve();
        this.manualClose = false;
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
        this.pending = null;
        this.buffer = "";
        this.chain = Promise.resolve();
        this._startReadLoop();
    }

    async disconnect() {
        const port = this.port;
        this.port = null;
        this.manualClose = true;

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
                if (this.port === null && !this.manualClose && this.onDisconnect) {
                    this.onDisconnect();
                }
            }
        })();
    }

    _onLine(line) {
        if (line === "") return;
        log(line, "rx");

        if (this.pending) {
            const p = this.pending;
            this.pending = null;
            clearTimeout(p.timer);
            p.resolve(line);
            return;
        }
        if (this.onLine) {
            this.onLine(line);
            return;
        }
        this.lines.push(line);
    }

    _waitLine(timeoutMs) {
        if (this.lines.length) {
            return Promise.resolve(this.lines.shift());
        }
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending = null;
                reject(new Error(t("err_timeout")));
            }, timeoutMs);
            this.pending = { resolve, timer };
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
        await this._write(cmd);

        const deadline = Date.now() + CMD_TIMEOUT_MS;
        for (;;) {
            const line = await this._waitLine(Math.max(1, deadline - Date.now()));
            if (line === "ERROR") {
                throw new Error(t("err_device_error"));
            }
            if (queryName) {
                const prefix = "+" + queryName + "=";
                if (line.startsWith(prefix)) {
                    return line.slice(prefix.length);
                }
                continue;
            }
            if (line === "OK") {
                return "";
            }
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

function log(message, type = "info") {
    const now = new Date().toLocaleTimeString();
    const prefix = { error: "[ERR]", ok: "[OK ]", tx: "[TX ]", rx: "[RX ]" }[type] || "[INF]";
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
    document.getElementById("btnConnect").disabled = connected;
    CONTROLS.forEach(el => { if (el) el.disabled = !connected; });
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
}

async function guarded(action) {
    if (!dev.isOpen()) {
        log(t("log_please_connect"), "error");
        return;
    }
    try {
        await action();
    } catch (e) {
        log(e.message, "error");
    }
}

// ---------------- events ----------------

document.getElementById("themeToggle").addEventListener("click", toggleTheme);
document.getElementById("langToggle").addEventListener("click", toggleLang);

document.getElementById("btnConnect").addEventListener("click", () => guarded(async () => {
    log(t("log_connecting"));
    elStatus.textContent = t("status_connecting");
    setConnected(false);
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
    }

    setConnected(true);
    log(t("log_connected"), "ok");
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
    // Setting a resistance leaves the open/short state (firmware behavior).
    deviceState = await dev.readState();
    syncInputsFromState();
}));

document.getElementById("btnSetStep").addEventListener("click", () => guarded(async () => {
    const mohm = parseInput(elInputStep, elUnitStep);
    if (mohm < 0 || mohm > RES_MAX_MOHM) {
        throw new Error(t("err_value_range") + "0 ~ " + formatOhm(RES_MAX_MOHM));
    }
    await dev.setStep(mohm);
    deviceState = await dev.readState();
    syncInputsFromState();
}));

elChkLimit.addEventListener("change", () => guarded(async () => {
    const wanted = elChkLimit.checked;
    try {
        await dev.setLimitEnable(wanted);
    } catch (e) {
        elChkLimit.checked = !wanted;
        throw e;
    }
    deviceState = await dev.readState();
    syncInputsFromState();
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
    deviceState = await dev.readState();
    syncInputsFromState();
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
    deviceState = await dev.readState();
    syncInputsFromState();
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
    deviceState = await dev.readState();
    syncInputsFromState();
}

elBtnStepDown.addEventListener("click", () => guarded(() => stepBy(-1)));
elBtnStepUp.addEventListener("click", () => guarded(() => stepBy(1)));

stateButtons.forEach(btn => btn.addEventListener("click", () => guarded(async () => {
    const target = btn.dataset.state;
    if (target === "open") {
        await dev.setOpen(true);
    } else if (target === "short") {
        await dev.setShort(true);
    } else {
        // Restore: the firmware applies RES.SP again (and clears the other flag).
        if (deviceState && deviceState.short) {
            await dev.setShort(false);
        } else if (deviceState && deviceState.open) {
            await dev.setOpen(false);
        }
    }
    deviceState = await dev.readState();
    syncInputsFromState();
})));

document.getElementById("btnClearLog").addEventListener("click", () => {
    elLog.textContent = "";
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
