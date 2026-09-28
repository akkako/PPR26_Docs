/**
 * PPR26 WinUSB Bootloader WebUI
 *
 */

const VID = 0xFFFE;
const PID = 0xFFFD;
const MAGIC_NUMBER = 0x0D000721;
const PROGRAM_DATA_MAX_LEN = 61;
const PACKET_SIZE = 64;

/*!< application image layout */
const APP_HEADER_SIZE = 512;          // 512-byte firmware header
const APP_FLASH_SIZE = 46080;         // total application region (header + payload)
const PACKET_REQ_ID = 0x01;
const PACKET_RSP_ID = 0x02;

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
        upgrade_hint: "请选择待升级固件",

        // INFO_COMMANDS labels
        info_vendor: "供应商",
        info_device_model: "设备型号",
        info_device_sn: "设备序列号",
        info_manufacture_date: "制造日期 (YY-WW)",
        info_hardware_version: "硬件版本 (0-6)",
        info_bootloader_version: "Bootloader版本",
        info_firmware_version: "固件版本",
        info_bootloader_build_time: "Bootloader编译时间",
        info_firmware_build_time: "固件编译时间",
        info_page_buffer_size: "页缓冲区大小",

        // Error messages
        err_no_webusb: "当前浏览器不支持 WebUSB，请使用 Chrome/Edge 109+",
        err_no_device_selected: "未选择设备",
        err_no_device_found: "未找到匹配的 USB 设备",
        err_not_connected: "设备未连接",
        err_open_failed: "打开设备失败: ",
        err_claim_failed: "占用设备接口失败，请关闭其他占用程序后重试: ",
        err_response_timeout: "设备响应超时",
        err_response_invalid: "设备响应数据无效",
        err_ping_response: "Ping 响应命令错误",
        err_magic_mismatch: "Magic 不匹配: ",
        err_packet_too_large: "数据包过大: ",
        err_cmd_mismatch: "响应命令不匹配: ",
        err_file_too_small: "固件文件过小: ",
        err_file_too_large: "固件文件过大: ",

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
        log_initialized: "WebUSB 上位机已加载",
        log_api_ok: "WebUSB 接口可用（navigator.usb），设备过滤 0xFFFE:0xD",
        log_api_missing: "未检测到 navigator.usb，请改用 Chrome/Edge 并通过 http://localhost 或 https 打开",
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
        upgrade_hint: "Select the upgrade firmware",

        // INFO_COMMANDS labels
        info_vendor: "Vendor",
        info_device_model: "Device Model",
        info_device_sn: "Device SN",
        info_manufacture_date: "Manufacture Date (YY-WW)",
        info_hardware_version: "Hardware Version (0-6)",
        info_bootloader_version: "Bootloader Version",
        info_firmware_version: "Firmware Version",
        info_bootloader_build_time: "Bootloader Build Time",
        info_firmware_build_time: "Firmware Build Time",
        info_page_buffer_size: "Page Buffer Size",

        // Error messages
        err_no_webusb: "WebUSB is not supported in your browser. Please use Chrome/Edge 109+",
        err_no_device_selected: "No device selected",
        err_no_device_found: "No matching USB device found",
        err_not_connected: "Device not connected",
        err_open_failed: "Failed to open device: ",
        err_claim_failed: "Failed to claim interface, close other programs using it and retry: ",
        err_response_timeout: "Device response timeout",
        err_response_invalid: "Invalid device response",
        err_ping_response: "Ping response command error",
        err_magic_mismatch: "Magic mismatch: ",
        err_packet_too_large: "Packet too large: ",
        err_cmd_mismatch: "Unexpected response command: ",
        err_file_too_small: "Firmware file too small: ",
        err_file_too_large: "Firmware file too large: ",

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
        log_initialized: "WebUSB Bootloader loaded",
        log_api_ok: "WebUSB available (navigator.usb), filtering 0xFFFE:0xFFFD",
        log_api_missing: "navigator.usb is unavailable; use Chrome/Edge over http://localhost or https",
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

class WinUsbBootloader {
    constructor() {
        this.device = null;
        this.inEp = null;
        this.outEp = null;
    }

    isConnected() {
        return this.device !== null && this.device.opened;
    }

    async open() {
        if (!navigator.usb) {
            throw new Error(t("err_no_webusb"));
        }

        let device;
        try {
            device = await navigator.usb.requestDevice({
                filters: [{ vendorId: VID, productId: PID }]
            });
        } catch (e) {
            // Chrome rejects requestDevice() with NotFoundError when the user
            // cancels the chooser or when no connected device matches VID/PID.
            if (e && e.name === "NotFoundError") {
                throw new Error(t("err_no_device_found"));
            }
            throw e;
        }

        if (!device) {
            throw new Error(t("err_no_device_selected"));
        }

        this.device = device;

        try {
            if (!device.opened) {
                await device.open();
            }
            if (device.configuration === null) {
                await device.selectConfiguration(1);
            }
            await device.claimInterface(0);
        } catch (e) {
            throw new Error(t("err_claim_failed") + e.message);
        }

        const alt = device.configuration.interfaces[0].alternates[0];
        const epOut = alt.endpoints.find(ep => ep.direction === "out");
        const epIn = alt.endpoints.find(ep => ep.direction === "in");
        if (!epOut || !epIn) {
            throw new Error(t("err_open_failed") + "endpoints not found");
        }
        this.outEp = epOut.endpointNumber;
        this.inEp = epIn.endpointNumber;
    }

    async close() {
        if (this.device) {
            const dev = this.device;
            this.device = null;
            this.inEp = null;
            this.outEp = null;
            try {
                await dev.close();
            } catch (e) {
                /* device already gone */
            }
        }
    }

    _withTimeout(promise, timeoutMs) {
        let timer;
        const timeout = new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error(t("err_response_timeout"))), timeoutMs);
        });
        return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
    }

    async _transaction(cmd, payload = new Uint8Array(0), timeoutMs = 5000) {
        if (!this.isConnected()) {
            throw new Error(t("err_not_connected"));
        }

        const packet = new Uint8Array(PACKET_SIZE);
        packet[0] = PACKET_REQ_ID;
        packet[1] = 1 + payload.length;
        packet[2] = cmd;
        packet.set(payload, 3);

        await this.device.transferOut(this.outEp, packet);

        const result = await this._withTimeout(
            this.device.transferIn(this.inEp, PACKET_SIZE), timeoutMs);

        if (result.status !== "ok" || !result.data || result.data.byteLength < 3) {
            throw new Error(t("err_response_invalid"));
        }

        const data = new Uint8Array(result.data.buffer, result.data.byteOffset, result.data.byteLength);
        if (data[0] !== PACKET_RSP_ID || data[2] === CMD_ERROR) {
            throw new Error(t("err_response_invalid"));
        }
        if (data[2] !== cmd) {
            throw new Error(t("err_cmd_mismatch") +
                `0x${data[2].toString(16).padStart(2, "0")} != 0x${cmd.toString(16).padStart(2, "0")}`);
        }
        return data;
    }

    async ping() {
        const resp = await this._transaction(CMD_PING, new Uint8Array(0), 1000);
        if (resp[2] !== CMD_PING) throw new Error(t("err_ping_response"));
        const magic = (resp[3] | (resp[4] << 8) | (resp[5] << 16) | (resp[6] << 24)) >>> 0;
        if (magic !== MAGIC_NUMBER) throw new Error(t("err_magic_mismatch") + magic.toString(16));
        return magic;
    }

    async getString(cmd, timeoutMs = 1000) {
        const resp = await this._transaction(cmd, new Uint8Array(0), timeoutMs);
        const len = resp[1] - 1;
        if (len <= 0) return "";
        const bytes = resp.slice(3, 3 + len);
        const nullIndex = bytes.indexOf(0);
        const strBytes = nullIndex >= 0 ? bytes.slice(0, nullIndex) : bytes;
        return new TextDecoder().decode(strBytes);
    }

    async getProgramInfo() {
        const resp = await this._transaction(CMD_GET_PROGRAM_INFO, new Uint8Array(0), 1000);
        return (resp[3] | (resp[4] << 8) | (resp[5] << 16) | (resp[6] << 24)) >>> 0;
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
        return resp[3] === 0x01;
    }

    async jumpApplication() {
        const packet = new Uint8Array(PACKET_SIZE);
        packet[0] = PACKET_REQ_ID;
        packet[1] = 0x01;
        packet[2] = CMD_JUMP_APPLICATION;
        await this.device.transferOut(this.outEp, packet);
    }
}

// ------------------------------------------------------------------
// UI
// ------------------------------------------------------------------

const bl = new WinUsbBootloader();

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
        await bl.close();
        setConnected(false);
        setProgress(0, 0);
        log(t("log_jumped"), "ok");
    } catch (e) {
        log(t("log_upgrade_failed").replace("{0}", label) + e.message, "error");
        setProgress(0, 0);
    }
}

function validateImageSize(size) {
    if (size < APP_HEADER_SIZE) {
        throw new Error(t("err_file_too_small") + `${size} < ${APP_HEADER_SIZE}`);
    }
    if (size > APP_FLASH_SIZE) {
        throw new Error(t("err_file_too_large") + `${size} > ${APP_FLASH_SIZE}`);
    }
}

async function upgradeFile() {
    const file = elFile.files[0];
    if (!file) return log(t("log_no_file"), "error");

    try {
        const arrayBuffer = await file.arrayBuffer();
        const image = new Uint8Array(arrayBuffer);
        validateImageSize(image.length);
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
        await bl.close();
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
    if (!file) {
        elFileInfo.textContent = t("file_not_selected");
        return;
    }
    elFileInfo.textContent = `${file.name} (${formatFileSize(file.size)})`;
    try {
        validateImageSize(file.size);
    } catch (e) {
        elFileInfo.textContent += ` — ${e.message}`;
    }
});

navigator.usb?.addEventListener("disconnect", async (e) => {
    if (e.device === bl.device) {
        setConnected(false);
        log(t("log_device_disconnected"), "error");
        await bl.close();
    }
});

initTheme();
initLang();
log(t("log_initialized"));
if (navigator.usb) {
    log(t("log_api_ok"));
} else {
    log(t("log_api_missing"), "error");
}