/**
 * PPR26 HID Bootloader WebUI
 *
 * Implements the protocol defined in Bootloader_Protocol.md using WebHID.
 */

const VID = 0xFFFE;
const PID = 0xFFFF;
const MAGIC_NUMBER = 0x0D000721;
const PROGRAM_DATA_MAX_LEN = 61;
const REPORT_SIZE = 64;

const CMD_PING = 0x00;
const CMD_GET_VENDOR_NAME = 0x01;
const CMD_GET_DEVICE_MODEL = 0x02;
const CMD_GET_DEVICE_SN = 0x03;
const CMD_GET_MANUFACTURE_DATE = 0x04;
const CMD_GET_HARDWARE_VERSION = 0x05;
const CMD_GET_BOOTLOADER_VERSION = 0x06;
const CMD_GET_FIRMWARE_VERSION = 0x07;
const CMD_GET_BOOTLOADER_COMPILE_TIME = 0x08;
const CMD_GET_FIRMWARE_COMPILE_TIME = 0x09;
const CMD_GET_PROGRAM_INFO = 0x0A;
const CMD_ERASE_APPLICATION = 0x0B;
const CMD_START_PROGRAM = 0x0C;
const CMD_SEND_PROGRAM_DATA = 0x0D;
const CMD_CHECK_APPLICATION = 0x0E;
const CMD_JUMP_APPLICATION = 0x0F;
const CMD_ERROR = 0xFF;

// ------------------------------------------------------------------
// I18N
// ------------------------------------------------------------------

const I18N = {
    zh: {
        // HTML static text
        toggle_theme: "切换主题",
        toggle_lang: "切换语言",
        title_connect: "连接",
        title_device_info: "设备信息",
        title_upgrade: "升级",
        title_log: "日志",
        btn_connect: "连接设备",
        btn_exit_dfu: "退出DFU",
        btn_refresh_info: "刷新信息",
        btn_select_file: "选择固件",
        btn_upgrade: "一键升级",
        btn_clear_log: "清空",
        file_not_selected: "未选择文件",
        status_disconnected: "未连接",
        status_connected: "已连接",

        // INFO_COMMANDS labels
        info_vendor: "供应商",
        info_device_model: "设备型号",
        info_device_sn: "设备序列号",
        info_manufacture_date: "制造日期",
        info_hardware_version: "硬件版本",
        info_bootloader_version: "Bootloader版本",
        info_firmware_version: "固件版本",
        info_bootloader_build_time: "Bootloader编译时间",
        info_firmware_build_time: "固件编译时间",
        info_page_buffer_size: "页缓冲区大小",

        // Error messages
        err_no_webhid: "当前浏览器不支持 WebHID，请使用 Chrome/Edge 109+",
        err_no_device_selected: "未选择设备",
        err_not_connected: "设备未连接",
        err_response_timeout: "设备响应超时",
        err_ping_response: "Ping 响应命令错误",
        err_magic_mismatch: "Magic 不匹配: ",
        err_packet_too_large: "数据包过大: ",

        // Log messages
        log_connected: "设备已连接并响应 Ping",
        log_connect_failed: "连接失败: ",
        log_please_connect: "请先连接设备",
        log_read_failed: "读取 {0} 失败: ",
        log_start_upgrade: "开始{0}...",
        log_verifying: "校验中...",
        log_verify_failed: "固件校验失败",
        log_upgrade_success: "{0}成功，正在跳转...",
        log_jumped: "已跳转运行，设备断开",
        log_upgrade_failed: "{0}失败: ",
        log_no_file: "请先选择固件文件",
        log_file_error: "处理文件失败: ",
        log_verifying_app: "正在校验应用...",
        log_app_verify_failed: "应用校验失败，无法退出DFU模式",
        log_app_verify_success: "校验成功，正在跳转应用...",
        log_exit_dfu_failed: "退出DFU失败: ",
        log_device_disconnected: "设备已断开",
        log_initialized: "WebHID 上位机已加载",
    },
    en: {
        // HTML static text
        toggle_theme: "Toggle Theme",
        toggle_lang: "Toggle Language",
        title_connect: "Connect",
        title_device_info: "Device Info",
        title_upgrade: "Upgrade",
        title_log: "Log",
        btn_connect: "Connect Device",
        btn_exit_dfu: "Exit DFU",
        btn_refresh_info: "Refresh Info",
        btn_select_file: "Select Firmware",
        btn_upgrade: "One-Click Upgrade",
        btn_clear_log: "Clear",
        file_not_selected: "No file selected",
        status_disconnected: "Disconnected",
        status_connected: "Connected",

        // INFO_COMMANDS labels
        info_vendor: "Vendor",
        info_device_model: "Device Model",
        info_device_sn: "Device SN",
        info_manufacture_date: "Manufacture Date",
        info_hardware_version: "Hardware Version",
        info_bootloader_version: "Bootloader Version",
        info_firmware_version: "Firmware Version",
        info_bootloader_build_time: "Bootloader Build Time",
        info_firmware_build_time: "Firmware Build Time",
        info_page_buffer_size: "Page Buffer Size",

        // Error messages
        err_no_webhid: "WebHID is not supported in your browser. Please use Chrome/Edge 109+",
        err_no_device_selected: "No device selected",
        err_not_connected: "Device not connected",
        err_response_timeout: "Device response timeout",
        err_ping_response: "Ping response command error",
        err_magic_mismatch: "Magic mismatch: ",
        err_packet_too_large: "Packet too large: ",

        // Log messages
        log_connected: "Device connected and responding to Ping",
        log_connect_failed: "Connection failed: ",
        log_please_connect: "Please connect device first",
        log_read_failed: "Failed to read {0}: ",
        log_start_upgrade: "Starting {0}...",
        log_verifying: "Verifying...",
        log_verify_failed: "Firmware verification failed",
        log_upgrade_success: "{0} successful, jumping...",
        log_jumped: "Jumped to application, device disconnected",
        log_upgrade_failed: "{0} failed: ",
        log_no_file: "Please select firmware file first",
        log_file_error: "File processing failed: ",
        log_verifying_app: "Verifying application...",
        log_app_verify_failed: "Application verification failed, cannot exit DFU mode",
        log_app_verify_success: "Verification successful, jumping to application...",
        log_exit_dfu_failed: "Exit DFU failed: ",
        log_device_disconnected: "Device disconnected",
        log_initialized: "WebHID Bootloader loaded",
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
    langBtn.textContent = currentLang === "zh" ? "EN" : "中";
    document.documentElement.setAttribute("lang", currentLang);
}

function initLang() {
    const saved = localStorage.getItem("lang");
    currentLang = saved || "en";
    applyLang();
    elFileInfo.textContent = t("file_not_selected");
}

function toggleLang() {
    currentLang = currentLang === "zh" ? "en" : "zh";
    localStorage.setItem("lang", currentLang);
    applyLang();
}

const INFO_COMMANDS = [
    { cmd: CMD_GET_VENDOR_NAME, label: "info_vendor" },
    { cmd: CMD_GET_DEVICE_MODEL, label: "info_device_model" },
    { cmd: CMD_GET_DEVICE_SN, label: "info_device_sn" },
    { cmd: CMD_GET_MANUFACTURE_DATE, label: "info_manufacture_date" },
    { cmd: CMD_GET_HARDWARE_VERSION, label: "info_hardware_version" },
    { cmd: CMD_GET_BOOTLOADER_VERSION, label: "info_bootloader_version" },
    { cmd: CMD_GET_FIRMWARE_VERSION, label: "info_firmware_version" },
    { cmd: CMD_GET_BOOTLOADER_COMPILE_TIME, label: "info_bootloader_build_time" },
    { cmd: CMD_GET_FIRMWARE_COMPILE_TIME, label: "info_firmware_build_time" },
    { cmd: CMD_GET_PROGRAM_INFO, label: "info_page_buffer_size" },
];

class HidBootloader {
    constructor() {
        this.device = null;
        this.pending = null;
    }

    isConnected() {
        return this.device !== null && this.device.opened;
    }

    async open() {
        if (!navigator.hid) {
            throw new Error(t("err_no_webhid"));
        }

        const devices = await navigator.hid.requestDevice({
            filters: [{ vendorId: VID, productId: PID }]
        });

        if (devices.length === 0) {
            throw new Error(t("err_no_device_selected"));
        }

        this.device = devices[0];
        this.device.oninputreport = (e) => this._onInputReport(e);

        if (!this.device.opened) {
            await this.device.open();
        }
    }

    close() {
        if (this.device) {
            this.device.close();
            this.device = null;
        }
    }

    _onInputReport(e) {
        if (e.reportId !== 0x02) return;

        const data = new Uint8Array(e.data.buffer, e.data.byteOffset, e.data.byteLength);

        if (this.pending) {
            const { resolve, timer } = this.pending;
            this.pending = null;
            clearTimeout(timer);
            resolve(data);
        }
    }

    async _transaction(cmd, payload = new Uint8Array(0), timeoutMs = 5000) {
        if (!this.isConnected()) {
            throw new Error(t("err_not_connected"));
        }

        const report = new Uint8Array(REPORT_SIZE - 1); // without report id
        report[0] = 1 + payload.length;
        report[1] = cmd;
        report.set(payload, 2);

        const responsePromise = new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending = null;
                reject(new Error(t("err_response_timeout")));
            }, timeoutMs);
            this.pending = { resolve, reject, timer };
        });

        try {
            await this.device.sendReport(0x01, report);
        } catch (e) {
            if (this.pending) {
                clearTimeout(this.pending.timer);
                this.pending = null;
            }
            throw e;
        }

        return responsePromise;
    }

    async ping() {
        const resp = await this._transaction(CMD_PING, new Uint8Array(0), 1000);
        if (resp[1] !== CMD_PING) throw new Error(t("err_ping_response"));
        const magic = (resp[2] | (resp[3] << 8) | (resp[4] << 16) | (resp[5] << 24)) >>> 0;
        if (magic !== MAGIC_NUMBER) throw new Error(t("err_magic_mismatch") + magic.toString(16));
        return magic;
    }

    async getString(cmd, timeoutMs = 1000) {
        const resp = await this._transaction(cmd, new Uint8Array(0), timeoutMs);
        const len = resp[0] - 1;
        if (len <= 0) return "";
        const bytes = resp.slice(2, 2 + len);
        const nullIndex = bytes.indexOf(0);
        const strBytes = nullIndex >= 0 ? bytes.slice(0, nullIndex) : bytes;
        return new TextDecoder().decode(strBytes);
    }

    async getProgramInfo() {
        const resp = await this._transaction(CMD_GET_PROGRAM_INFO, new Uint8Array(0), 1000);
        return (resp[2] | (resp[3] << 8) | (resp[4] << 16) | (resp[5] << 24)) >>> 0;
    }

    async eraseApplication() {
        await this._transaction(CMD_ERASE_APPLICATION, new Uint8Array(0), 3000);
    }

    async sendProgramData(data) {
        if (data.length > PROGRAM_DATA_MAX_LEN) {
            throw new Error(t("err_packet_too_large") + `${data.length} > ${PROGRAM_DATA_MAX_LEN}`);
        }
        await this._transaction(CMD_SEND_PROGRAM_DATA, data, 1000);
    }

    async startProgram() {
        await this._transaction(CMD_START_PROGRAM, new Uint8Array(0), 1000);
    }

    async checkApplication() {
        const resp = await this._transaction(CMD_CHECK_APPLICATION, new Uint8Array(0), 2000);
        return resp[2] === 0x01;
    }

    async jumpApplication() {
        const report = new Uint8Array(REPORT_SIZE - 1);
        report[0] = 0x01;
        report[1] = CMD_JUMP_APPLICATION;
        await this.device.sendReport(0x01, report);
    }
}

// ------------------------------------------------------------------
// UI
// ------------------------------------------------------------------

const bl = new HidBootloader();

const elStatus = document.getElementById("connStatus");
const elInfoCard = document.getElementById("deviceInfoCard");
const elInfoList = document.getElementById("infoList");
const elFile = document.getElementById("fwFile");
const elFileInfo = document.getElementById("fileInfo");
const elBtnUpgrade = document.getElementById("btnUpgrade");
const elBtnExitDfu = document.getElementById("btnExitDfu");
const elProgressBar = document.getElementById("progressBar");
const elProgressText = document.getElementById("progressText");
const elLog = document.getElementById("logOutput");

function log(message, type = "info") {
    const now = new Date().toLocaleTimeString();
    const prefix = type === "error" ? "[ERR]" : type === "ok" ? "[OK ]" : "[INF]";
    elLog.textContent += `${now} ${prefix} ${message}\n`;
    elLog.scrollTop = elLog.scrollHeight;
}

function setConnected(connected) {
    if (connected) {
        elStatus.textContent = t("status_connected");
        elStatus.classList.add("connected");
        elInfoCard.hidden = false;
        elBtnUpgrade.disabled = false;
        elBtnExitDfu.disabled = false;
    } else {
        elStatus.textContent = t("status_disconnected");
        elStatus.classList.remove("connected");
        elInfoCard.hidden = true;
        elBtnUpgrade.disabled = true;
        elBtnExitDfu.disabled = true;
    }
}

function setProgress(value, total, text = "") {
    if (total > 0) {
        elProgressBar.hidden = false;
        elProgressBar.value = value;
        elProgressBar.max = total;
        elProgressText.textContent = text || `${value}/${total}`;
    } else {
        elProgressBar.hidden = true;
        elProgressText.textContent = text;
    }
}

async function connect() {
    try {
        await bl.open();
        await bl.ping();
        setConnected(true);
        log(t("log_connected"));
        await refreshInfo();
    } catch (e) {
        log(t("log_connect_failed") + e.message, "error");
        setConnected(false);
    }
}

async function refreshInfo() {
    if (!bl.isConnected()) {
        log(t("log_please_connect"), "error");
        return;
    }

    elInfoList.innerHTML = "";

    for (const item of INFO_COMMANDS) {
            try {
                let value;
                if (item.cmd === CMD_GET_PROGRAM_INFO) {
                    value = `${await bl.getProgramInfo()} bytes`;
                } else {
                    value = await bl.getString(item.cmd);
                }
                const dt = document.createElement("dt");
                dt.textContent = t(item.label);
                const dd = document.createElement("dd");
                dd.textContent = value;
                elInfoList.appendChild(dt);
                elInfoList.appendChild(dd);
            } catch (e) {
                log(t("log_read_failed").replace("{0}", t(item.label)) + e.message, "error");
            }
        }
}

async function runUpgrade(image, label) {
    if (!bl.isConnected()) return log(t("log_please_connect"), "error");

    try {
        const pageSize = await bl.getProgramInfo();
        log(t("log_start_upgrade").replace("{0}", label));
        setProgress(0, image.length);

        await bl.eraseApplication();

        for (let pageOffset = 0; pageOffset < image.length; pageOffset += pageSize) {
            const page = image.slice(pageOffset, pageOffset + pageSize);
            for (let subOffset = 0; subOffset < page.length; subOffset += PROGRAM_DATA_MAX_LEN) {
                const chunk = page.slice(subOffset, subOffset + PROGRAM_DATA_MAX_LEN);
                await bl.sendProgramData(chunk);
            }
            await bl.startProgram();
            const progress = Math.min(pageOffset + pageSize, image.length);
            setProgress(progress, image.length);
        }

        setProgress(image.length, image.length, t("log_verifying"));
        const ok = await bl.checkApplication();
        if (!ok) {
            setProgress(0, 0);
            log(t("log_verify_failed"), "error");
            return;
        }

        log(t("log_upgrade_success").replace("{0}", label), "ok");
        await bl.jumpApplication();
        setConnected(false);
        setProgress(0, 0);
        log(t("log_jumped"), "ok");
    } catch (e) {
        log(t("log_upgrade_failed").replace("{0}", label) + e.message, "error");
        setProgress(0, 0);
    }
}

async function upgradeFile() {
    const file = elFile.files[0];
    if (!file) return log(t("log_no_file"), "error");

    try {
        const arrayBuffer = await file.arrayBuffer();
        const image = new Uint8Array(arrayBuffer);
        await runUpgrade(image, t("btn_upgrade"));
    } catch (e) {
        log(t("log_file_error") + e.message, "error");
    }
}

async function exitDfu() {
    if (!bl.isConnected()) return log(t("log_please_connect"), "error");

    try {
        log(t("log_verifying_app"));
        const ok = await bl.checkApplication();
        if (!ok) {
            log(t("log_app_verify_failed"), "error");
            return;
        }

        log(t("log_app_verify_success"), "ok");
        await bl.jumpApplication();
        setConnected(false);
        log(t("log_jumped"), "ok");
    } catch (e) {
        log(t("log_exit_dfu_failed") + e.message, "error");
    }
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

document.getElementById("btnConnect").addEventListener("click", connect);
document.getElementById("btnExitDfu").addEventListener("click", exitDfu);
document.getElementById("btnRefreshInfo").addEventListener("click", refreshInfo);
document.getElementById("btnUpgrade").addEventListener("click", upgradeFile);
document.getElementById("btnClearLog").addEventListener("click", () => {
    elLog.textContent = "";
});
document.getElementById("themeToggle").addEventListener("click", toggleTheme);
document.getElementById("langToggle").addEventListener("click", toggleLang);

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

elFile.addEventListener("change", () => {
    const file = elFile.files[0];
    if (file) {
        elFileInfo.textContent = `${file.name} (${formatFileSize(file.size)})`;
    } else {
        elFileInfo.textContent = t("file_not_selected");
    }
});

navigator.hid?.addEventListener("disconnect", (e) => {
    if (e.device === bl.device) {
        setConnected(false);
        log(t("log_device_disconnected"), "error");
    }
});

initTheme();
initLang();
log(t("log_initialized"));
