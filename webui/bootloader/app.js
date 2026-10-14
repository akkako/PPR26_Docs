/**
 * PPR26 WinUSB Bootloader WebUI
 *
 */

const VID = 0xFFFE;
const PID = 0xFFFD;
const MAGIC_NUMBER = 0x0D000721;
const PROGRAM_DATA_MAX_LEN = 61;
const PACKET_SIZE = 64;

// Application image size limits (public protocol constants)
const APP_HEADER_SIZE = 512;          // 512-byte firmware header
const APP_FLASH_SIZE = 46080;         // total application region (header + payload)
const PACKET_REQ_ID = 0x01;
const PACKET_RSP_ID = 0x02;
// Jump request has no response packet; wait for the host to see the disconnect.
const JUMP_SETTLE_MS = 300;

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
        btn_upgrade: "一键升级",
        btn_clear_log: "清空",
        status_disconnected: "未连接",
        status_connected: "已连接",
        upgrade_hint: "无需手动选择文件：按 firmware/VERSION 指定的最新发布版本自动加载（需要能访问本站点）。",
        fw_loading: "正在加载最新固件…",
        fw_none: "固件未加载",
        fw_ready: "最新固件 {0} · {1}（{2}）",
        fw_unavailable: "无法加载固件: ",
        fw_is_latest: "（已是最新）",
        fw_needs_upgrade: "（可升级到 {0}）",

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
        err_bad_page_size: "设备返回的页缓冲区大小无效: ",
        err_file_hint: "（固件应为随版本发布的 *_pack.bin 镜像）",
        err_file_too_small: "固件文件过小: ",
        err_file_too_large: "固件文件过大: ",
        err_fw_fetch: "获取固件失败: ",
        err_version_invalid: "VERSION 文件格式无效（第一行版本号、第二行固件文件名）",
        err_fw_name_invalid: "VERSION 中的固件文件名无效: ",

        // Log messages
        log_busy: "正在执行其它操作，请稍候",
        log_connected: "设备已连接并响应 Ping",
        log_connect_failed: "连接失败: ",
        log_please_connect: "请先连接设备",
        log_read_failed: "读取 {0} 失败: ",
        log_start_upgrade: "开始{0}...",
        log_verifying: "校验中...",
        log_verify_failed: "固件校验失败，请确认站点 firmware/ 下的固件镜像完整（*_pack.bin）",
        log_upgrade_success: "{0}成功，正在跳转...",
        log_jumped: "已跳转运行，设备断开",
        log_upgrade_failed: "{0}失败: ",
        log_fw_loaded: "已加载最新固件 {0} · {1}",
        log_fw_load_failed: "固件加载失败: ",
        log_verifying_app: "正在校验应用...",
        log_app_verify_failed: "应用校验失败，无法退出DFU模式",
        log_app_verify_success: "校验成功，正在跳转应用...",
        log_exit_dfu_failed: "退出DFU失败: ",
        log_device_disconnected: "设备已断开",
        log_initialized: "WebUSB 上位机已加载",
        log_api_ok: "WebUSB 接口可用（navigator.usb），设备过滤 0xFFFE:0xFFFD",
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
        btn_upgrade: "One-Click Upgrade",
        btn_clear_log: "Clear",
        status_disconnected: "Disconnected",
        status_connected: "Connected",
        upgrade_hint: "No file dialog: the latest release named in firmware/VERSION is loaded automatically (requires access to this site).",
        fw_loading: "Loading the latest firmware...",
        fw_none: "Firmware not loaded",
        fw_ready: "Latest firmware {0} · {1} ({2})",
        fw_unavailable: "Firmware unavailable: ",
        fw_is_latest: " (up to date)",
        fw_needs_upgrade: " (can upgrade to {0})",

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
        err_bad_page_size: "Invalid page buffer size from device: ",
        err_file_hint: " (the firmware must be a released *_pack.bin image)",
        err_file_too_small: "Firmware file too small: ",
        err_file_too_large: "Firmware file too large: ",
        err_fw_fetch: "Failed to fetch firmware: ",
        err_version_invalid: "Invalid VERSION file (line 1 = version, line 2 = firmware file name)",
        err_fw_name_invalid: "Invalid firmware file name in VERSION: ",

        // Log messages
        log_busy: "Another operation is in progress, please wait",
        log_connected: "Device connected and responding to Ping",
        log_connect_failed: "Connection failed: ",
        log_please_connect: "Please connect device first",
        log_read_failed: "Failed to read {0}: ",
        log_start_upgrade: "Starting {0}...",
        log_verifying: "Verifying...",
        log_verify_failed: "Firmware verification failed; check that the image under firmware/ is a complete *_pack.bin",
        log_upgrade_success: "{0} successful, jumping...",
        log_jumped: "Jumped to application, device disconnected",
        log_upgrade_failed: "{0} failed: ",
        log_fw_loaded: "Latest firmware loaded: {0} · {1}",
        log_fw_load_failed: "Firmware load failed: ",
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
    // 连接状态与固件信息不参与 data-i18n 批量替换，按当前语言重新渲染。
    setConnected(bl.isConnected());
    renderFirmwareInfo();
}

function initLang() {
    const saved = localStorage.getItem("lang");
    currentLang = saved || "zh";   // 与页面静态中文一致；用户切换后记住偏好
    applyLang();
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
            // 打开/占用失败时释放设备，避免接口一直被本页占用。
            try {
                await device.close();
            } catch (ignored) {
                /* device already gone */
            }
            this.device = null;
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
        if (resp[1] < 5) throw new Error(t("err_response_invalid"));
        const magic = (resp[3] | (resp[4] << 8) | (resp[5] << 16) | (resp[6] << 24)) >>> 0;
        if (magic !== MAGIC_NUMBER) throw new Error(t("err_magic_mismatch") + magic.toString(16));
        return magic;
    }

    async getString(cmd, timeoutMs = 1000) {
        const resp = await this._transaction(cmd, new Uint8Array(0), timeoutMs);
        if (resp[1] < 1) throw new Error(t("err_response_invalid"));
        const len = resp[1] - 1;
        if (len <= 0) return "";
        const bytes = resp.slice(3, 3 + len);
        const nullIndex = bytes.indexOf(0);
        const strBytes = nullIndex >= 0 ? bytes.slice(0, nullIndex) : bytes;
        return new TextDecoder().decode(strBytes);
    }

    async getProgramInfo() {
        const resp = await this._transaction(CMD_GET_PROGRAM_INFO, new Uint8Array(0), 1000);
        if (resp[1] < 5) throw new Error(t("err_response_invalid"));
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
        if (resp[1] < 2) throw new Error(t("err_response_invalid"));
        return resp[3] === 0x01;
    }

    async jumpApplication() {
        const packet = new Uint8Array(PACKET_SIZE);
        packet[0] = PACKET_REQ_ID;
        packet[1] = 0x01;
        packet[2] = CMD_JUMP_APPLICATION;
        await this.device.transferOut(this.outEp, packet);
        // 固件不回复跳转请求：反初始化 USB 后拉低 D+ 让主机看到断开，等待识别完成。
        await new Promise(resolve => setTimeout(resolve, JUMP_SETTLE_MS));
    }
}

// ------------------------------------------------------------------
// UI
// ------------------------------------------------------------------

const bl = new WinUsbBootloader();
let busy = false;   // true while an upgrade / exit-DFU dialog owns the device

const elStatus = document.getElementById("connStatus");
const elInfoCard = document.getElementById("deviceInfoCard");
const elInfoList = document.getElementById("infoList");
const elFileInfo = document.getElementById("fileInfo");
const elBtnUpgrade = document.getElementById("btnUpgrade");
const elBtnExitDfu = document.getElementById("btnExitDfu");
const elProgressBar = document.getElementById("progressBar");
const elProgressText = document.getElementById("progressText");
const elLog = document.getElementById("logOutput");

/* 固件来源：站点上的 firmware/VERSION —— 第一行版本号，第二行固件文件名
   （与该文件同目录）。先试部署后的相对路径（/bootloader/ → /firmware/），
   再试直接用仓库根提供静态文件时的路径（/webui/bootloader/ → /firmware/），
   本地调试两种服务方式都能用。 */
const FW_DIRS = ["../firmware/", "../../firmware/"];
const FW_NAME_RE = /^[A-Za-z0-9._-]+$/;

let firmware = null;          // { version, name, image }；加载成功前不允许升级
let firmwareLoading = false;
let firmwareError = "";

function log(message, type = "info") {
    const now = new Date().toLocaleTimeString();
    const prefix = type === "error" ? "[ERR]" : type === "ok" ? "[OK ]" : "[INF]";
    elLog.textContent += `${now} ${prefix} ${message}\n`;
    elLog.scrollTop = elLog.scrollHeight;
}

/** 版本号比较用：忽略大小写、多余空白，以及设备上报的 "FW " 前缀。 */
function normalizeVersion(text) {
    return String(text || "").trim().replace(/\s+/g, " ").toUpperCase().replace(/^FW\s*/, "");
}

/** VERSION 文件解析：空行与 `#` 开头的注释行忽略。 */
function parseVersionFile(text) {
    const lines = String(text).split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line !== "" && !line.startsWith("#"));
    if (lines.length < 2) {
        throw new Error(t("err_version_invalid"));
    }
    if (!FW_NAME_RE.test(lines[1])) {
        throw new Error(t("err_fw_name_invalid") + lines[1]);
    }
    return { version: lines[0], name: lines[1] };
}

async function fetchOk(url) {
    const resp = await fetch(url, { cache: "no-store" });
    if (!resp.ok) {
        throw new Error(t("err_fw_fetch") + url + " HTTP " + resp.status);
    }
    return resp;
}

/** 按 VERSION 取回最新固件镜像；失败只记录原因，按钮保持禁用。 */
async function loadLatestFirmware() {
    firmwareLoading = true;
    firmwareError = "";
    renderFirmwareInfo();
    refreshControls();
    try {
        let meta = null;
        let dir = null;
        let lastError = null;
        for (const candidate of FW_DIRS) {
            try {
                meta = parseVersionFile(await (await fetchOk(candidate + "VERSION")).text());
                dir = candidate;
                break;
            } catch (e) {
                lastError = e;
            }
        }
        if (dir === null) {
            throw lastError;
        }
        const image = new Uint8Array(await (await fetchOk(dir + meta.name)).arrayBuffer());
        validateImageSize(image.length);
        firmware = { version: meta.version, name: meta.name, image };
        log(t("log_fw_loaded").replace("{0}", meta.version).replace("{1}", meta.name), "ok");
    } catch (e) {
        firmware = null;
        firmwareError = e.message;
        log(t("log_fw_load_failed") + e.message, "error");
    } finally {
        firmwareLoading = false;
        renderFirmwareInfo();
        refreshControls();
    }
}

function setConnected(connected) {
    if (connected) {
        elStatus.textContent = t("status_connected");
        elStatus.classList.add("connected");
        elInfoCard.hidden = false;
    } else {
        elStatus.textContent = t("status_disconnected");
        elStatus.classList.remove("connected");
        elInfoCard.hidden = true;
    }
    refreshControls();
}

/** 按钮可用性 = 连接状态 × 固件是否已加载 × 是否正在执行操作。 */
function refreshControls() {
    const connected = bl.isConnected();
    document.getElementById("btnConnect").disabled = connected || busy;
    document.getElementById("btnRefreshInfo").disabled = !connected || busy;
    elBtnExitDfu.disabled = !connected || busy;
    elBtnUpgrade.disabled = !connected || busy || firmware === null;
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

/** 升级 / 退出 DFU 期间禁用全部按钮：协议要求一问一答，命令流不得交叉。 */
function setBusy(value) {
    busy = value;
    refreshControls();
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
        await bl.close();
        setConnected(false);
    }
}

async function refreshInfo() {
    if (busy) return log(t("log_busy"), "error");
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
                // 固件版本标注与站点发布版本的关系，避免升错版本。
                if (item.cmd === CMD_GET_FIRMWARE_VERSION && value && firmware) {
                    value += normalizeVersion(value) === normalizeVersion(firmware.version)
                        ? t("fw_is_latest")
                        : t("fw_needs_upgrade").replace("{0}", firmware.version);
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
    if (busy) return log(t("log_busy"), "error");

    setBusy(true);
    try {
        const pageSize = await bl.getProgramInfo();
        if (!Number.isInteger(pageSize) || pageSize <= 0 || pageSize > APP_FLASH_SIZE) {
            throw new Error(t("err_bad_page_size") + pageSize);
        }
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
    } finally {
        setBusy(false);
    }
}

function validateImageSize(size) {
    if (size < APP_HEADER_SIZE) {
        throw new Error(t("err_file_too_small") + `${size} < ${APP_HEADER_SIZE}` + t("err_file_hint"));
    }
    if (size > APP_FLASH_SIZE) {
        throw new Error(t("err_file_too_large") + `${size} > ${APP_FLASH_SIZE}` + t("err_file_hint"));
    }
}

async function upgradeLatest() {
    if (!bl.isConnected()) return log(t("log_please_connect"), "error");
    if (busy) return log(t("log_busy"), "error");

    // 页面加载时没取到固件（例如当时断网）就在这里再试一次。
    if (!firmware) {
        await loadLatestFirmware();
        if (!firmware) return;
    }

    await runUpgrade(firmware.image, `${t("btn_upgrade")} ${firmware.version}`);
}

async function exitDfu() {
    if (!bl.isConnected()) return log(t("log_please_connect"), "error");
    if (busy) return log(t("log_busy"), "error");

    setBusy(true);
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
    } finally {
        setBusy(false);
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
document.getElementById("btnUpgrade").addEventListener("click", upgradeLatest);
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

/** 升级区显示的固件来源：站点 firmware/VERSION 指向的版本。 */
function renderFirmwareInfo() {
    let text;
    let warn = false;
    if (firmwareLoading) {
        text = t("fw_loading");
    } else if (firmware) {
        text = t("fw_ready")
            .replace("{0}", firmware.version)
            .replace("{1}", firmware.name)
            .replace("{2}", formatFileSize(firmware.image.length));
    } else {
        warn = true;
        text = firmwareError ? t("fw_unavailable") + firmwareError : t("fw_none");
    }
    elFileInfo.textContent = text;
    elFileInfo.classList.toggle("warn", warn);
}

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
// 自动加载 firmware/VERSION 指定的最新固件（不需要用户选择文件）。
loadLatestFirmware();