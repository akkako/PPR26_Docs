/**
 * PPR26 NTC Simulator WebUI
 *
 * 把 PPR26 当热敏电阻模拟器用：按 NTC 模型（B 值法 / Steinhart-Hart / CSV 数据）
 * 把温度换算成阻值并下发到设备，也支持由阻值反解温度、按温度步进、显示曲线。
 *
 * - 温度→阻值的算法在随页携带的 ntc.mjs（ES 模块）里，与 ref/ 里的 Python 参考
 *   实现做过 919 个数值的交叉验证；本文件只负责界面与 AT 交互。
 * - WebSerial + AT 命令；设备须工作在 AT 模式（VID 0xFFFE / PID 0xFFFE）。
 * - 风格 / 主题 / 语言与 webui/portal、webui/serial、webui/bootloader 保持一致。
 *
 * 操作语义（见文档页 software/webui_ntcsim.md）：
 *   温度框+「计算」、步进 −/+  → 更新模拟点；「自动设置」勾选时同时下发
 *   曲线点击、阻值「填入温度」  → 只更新模拟点与目标值，从不下发
 *   「应用」                    → 总是按当前模拟点下发 AT+RES.SP
 */

import * as ntc from "./ntc.mjs";

const VID = 0xFFFE;
const PID_AT = 0xFFFE;
const BAUDRATE = 115200;
const CMD_TIMEOUT_MS = 3000;

/* 设备阻值范围：5 Ω … 4 MΩ（mΩ，64 位） */
const RES_MIN_MOHM = 5000;
const RES_MAX_MOHM = 4000000000;

/* 温度范围与步进的输入限制（可改，仅用于界面校验） */
const TEMP_LIMIT_MIN_C = -100;
const TEMP_LIMIT_MAX_C = 300;

/* 内部温度轮询间隔（只读 AT+DEV.TEMP?） */
const TEMP_POLL_MS = 5000;

const LS_AUTO_APPLY = "ntcsim_auto_apply";        // 控制台「自动设置」是否下发
const LS_CURVE_APPLY = "ntcsim_curve_apply";      // 曲线选点是否自动下发

// ------------------------------------------------------------------
// I18N
// ------------------------------------------------------------------

const I18N = {
    zh: {
        page_title: "PPR26 NTC 模拟器",
        toggle_theme: "切换主题",
        toggle_lang: "切换语言",
        btn_back: "返回工具中心",

        /* 连接 */
        btn_connect: "连接设备",
        btn_disconnect: "断开",
        status_disconnected: "未连接",
        status_connecting: "连接中…",
        status_connected: "已连接",

        /* 设备信息条 */
        info_model: "型号",
        info_sn: "序列号",
        info_fw: "固件",
        info_hw: "硬件",
        info_temp: "内部温度",
        info_output: "输出",
        state_normal: "正常",
        state_open: "开路",
        state_short: "短路",

        /* 模型 */
        title_model: "NTC 模型",
        title_limits: "设备限值窗口",
        label_limit_enable: "启用限值",
        label_min_ohm: "最小阻值",
        label_max_ohm: "最大阻值",
        btn_write_limits: "写入限制值",
        msg_limits_order: "最小阻值不能大于最大阻值",
        msg_limits_written: "已写入限值：{0} … {1}",
        msg_limit_enabled: "已启用限值（超出窗口的设定值会被拒绝）",
        msg_limit_disabled: "已关闭限值",
        msg_limits_need_device: "未连接设备：限值是设备端设置，请先连接",
        mode_beta: "B 值法",
        mode_sh: "SH 方程",
        mode_csv: "导入 CSV",
        beta_tab_direct: "直填 R25/B",
        beta_tab_two: "两点反算",
        beta_tab_lsq: "多点拟合",
        beta_lsq_hint: "填入 2 个以上标定点（推荐 5 个以上）做最小二乘拟合。",
        sh_tab_direct: "直填 A/B/C",
        sh_tab_points: "标定点拟合",
        label_coeff_a: "A",
        label_coeff_b: "B",
        label_coeff_c: "C",
        title_sh_a: "1/T 的常数项（约 7e-4）",
        title_sh_b: "ln R 的系数（约 2.8e-4）",
        title_sh_c: "(ln R)³ 的系数（约 3e-8）",
        sh_direct_hint: "1/T = A + B·ln R + C·(ln R)³（T 开尔文，R 欧姆）。",
        sh_hint: "填入 3 个以上标定点：正好 3 点用闭式解，多于 3 点用最小二乘。",
        label_r25: "R25（Ω）",
        label_b_value: "B（K）",
        label_t1: "T1（℃）",
        label_r1: "R1（Ω）",
        label_t2: "T2（℃）",
        label_r2: "R2（Ω）",
        label_point_t: "温度（℃）",
        label_point_r: "阻值（Ω）",
        btn_add_point: "＋ 增加标定点",
        title_remove_point: "删除该点",
        csv_drop_hint: "或将文件拖到此处",
        btn_csv_pick: "选择 CSV 文件",
        csv_mode_interp: "原始数据插值",
        csv_mode_fit: "转换为 SH 拟合",
        csv_hint: "两列：温度(℃), 电阻(Ω)；支持逗号/分号/制表符分隔，可用 # 注释与表头行。",
        csv_loaded: "已载入 {0} 个点，范围 {1} … {2} ℃。",
        csv_failed: "CSV 解析失败：{0}",
        csv_no_points: "没有解析到有效数据行（需要两列：温度, 电阻）。",

        /* 控制台 */
        title_console: "温度控制台",
        label_sim_temp: "当前模拟温度",
        mini_target: "目标：",
        mini_sp: "SP：",
        mini_pv: "PV：",
        mini_tp: "TP：",
        title_mini_target: "模型算出的理论阻值（即下发的值）",
        title_sp: "设备回读的设定值",
        title_pv: "设备估测的实际输出阻值",
        title_tp: "PV 折算出的温度",
        label_temp: "温度（℃）",
        btn_calc: "计算",
        btn_apply: "应用",
        label_auto_apply: "自动设置（计算/步进后直接下发）",
        label_step_size: "步长（℃）",
        btn_step_down: "− 步进",
        btn_step_up: "＋ 步进",
        label_r2t: "阻值 → 温度（Ω）",
        btn_fill_temp: "填入温度",
        value_inf: "开路",
        value_out_of_data: "超出数据范围",

        /* 曲线 */
        title_curve: "温度-阻值曲线",
        label_range: "温度范围（℃）",
        label_log_axis: "对数阻值轴",
        label_curve_auto_apply: "自动设置",
        title_curve_auto_apply: "勾选后：在曲线上选点（单击，或拖拽松手）会直接下发；不勾选：只更新温度，需手动点「应用」。",
        legend_current: "当前设定点",
        legend_pv: "设备 PV",
        legend_window: "允许窗口",

        /* 日志 */
        title_log: "AT 日志",
        log_header_hint: "AT 命令收发记录",
        btn_clear_log: "清空",

        /* 提示信息 */
        msg_model_invalid: "模型无效：",
        msg_bad_temp: "温度输入无效",
        msg_bad_number: "数值输入无效",
        msg_temp_clamped: "温度已限制在设定范围内",
        msg_temp_clamped_to_range: "该温度对应的阻值超出设备能输出的范围（5 Ω ~ 4 MΩ），已夹到边界",
        msg_temp_clamped_to_limit: "该温度对应的阻值超出设备限值窗口，已夹到窗口边界",
        msg_step_invalid: "步长必须为正数",
        msg_not_connected_calc_only: "未连接设备：已计算，未下发",
        msg_nothing_calculated: "还没有可下发的目标阻值，请先点「计算」",
        msg_applied: "已下发设定值",
        msg_out_of_range: "阻值超出设备量程 {0}…{1}",
        msg_out_of_limit: "阻值超出设备限值窗口 {0}…{1}（RES.LIMIT=1）",
        msg_r2t_invalid: "阻值输入无效",
        msg_r2t_failed: "反解失败：",
        msg_no_model: "当前没有可用模型，请检查左侧参数",
        msg_need_two_points: "至少需要 2 个有效标定点（温度与阻值都要填）",
        msg_need_three_points: "至少需要 3 个有效标定点（温度与阻值都要填）",
        msg_out_of_data_range: "超出标定数据范围 {0}…{1} ℃（插值模式不外推）",
        msg_monotonic_bad: "警告：模型不单调，请检查标定点",
        msg_residual: "残差",

        /* 日志 */
        log_ready: "NTC 模拟器已加载（未连接也可换算）",
        log_unsupported: "未检测到 navigator.serial，请改用 Chrome/Edge 并通过 https 或 http://localhost 打开",
        log_connecting: "正在选择设备…",
        log_connected: "设备已连接",
        log_disconnected: "设备已断开",
        log_unexpected: "收到非预期响应:",
        log_auto_apply_on: "自动设置已开启：计算/步进会直接下发",
        log_curve_apply_on: "曲线「自动设置」已开启：选点（松手）会直接下发",
        log_curve_apply_off: "曲线「自动设置」已关闭：选点只更新温度，需手动点「应用」",
        log_auto_apply_off: "自动设置已关闭：需手动点「应用」下发",

        /* 错误 */
        err_no_webserial: "当前浏览器不支持 WebSerial，请使用 Chrome / Edge 109+，并通过 https 或 http://localhost 打开",
        err_no_device_selected: "未选择设备",
        err_no_device_found: "未找到 PPR26 串口设备（请确认设备已工作在 AT 模式）",
        err_not_connected: "设备未连接",
        err_open_failed: "打开串口失败: ",
        err_timeout: "设备响应超时",
        err_device_error: "设备返回 ERROR（参数越界或当前状态不允许）",
        err_overflow: "命令过长，设备返回 OVERFLOW",
        err_device_wrong_mode: "设备不在 AT 模式，请切换后重试",

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
        page_title: "PPR26 NTC Simulator",
        toggle_theme: "Toggle Theme",
        toggle_lang: "Toggle Language",
        btn_back: "Back to Tools",

        /* Connect */
        btn_connect: "Connect Device",
        btn_disconnect: "Disconnect",
        status_disconnected: "Disconnected",
        status_connecting: "Connecting...",
        status_connected: "Connected",

        /* Device info strip */
        info_model: "Model",
        info_sn: "S/N",
        info_fw: "FW",
        info_hw: "HW",
        info_temp: "Internal temp",
        info_output: "Output",
        state_normal: "Normal",
        state_open: "Open",
        state_short: "Short",

        /* Model */
        title_model: "NTC Model",
        title_limits: "Device Limit Window",
        label_limit_enable: "Enable limits",
        label_min_ohm: "Minimum",
        label_max_ohm: "Maximum",
        btn_write_limits: "Write limits",
        msg_limits_order: "Minimum must not exceed maximum",
        msg_limits_written: "Limits written: {0} ... {1}",
        msg_limit_enabled: "Limits enabled (setpoints outside the window will be rejected)",
        msg_limit_disabled: "Limits disabled",
        msg_limits_need_device: "Not connected: limits live in the device, connect first",
        mode_beta: "B-value",
        mode_sh: "Steinhart-Hart",
        mode_csv: "CSV",
        beta_tab_direct: "R25 + B",
        beta_tab_two: "2 points",
        beta_tab_lsq: "Multi-point",
        beta_lsq_hint: "Enter 2+ calibration points (5+ recommended) for a least-squares fit.",
        sh_tab_direct: "A + B + C",
        sh_tab_points: "Fit points",
        label_coeff_a: "A",
        label_coeff_b: "B",
        label_coeff_c: "C",
        title_sh_a: "Constant term of 1/T (about 7e-4)",
        title_sh_b: "Coefficient of ln R (about 2.8e-4)",
        title_sh_c: "Coefficient of (ln R)^3 (about 3e-8)",
        sh_direct_hint: "1/T = A + B*ln R + C*(ln R)^3  (T in kelvin, R in ohm).",
        sh_hint: "Enter 3+ calibration points: exactly 3 use the closed form, more use least squares.",
        label_r25: "R25 (ohm)",
        label_b_value: "B (K)",
        label_t1: "T1 (C)",
        label_r1: "R1 (ohm)",
        label_t2: "T2 (C)",
        label_r2: "R2 (ohm)",
        label_point_t: "Temp (C)",
        label_point_r: "Resistance (ohm)",
        btn_add_point: "+ Add point",
        title_remove_point: "Remove this point",
        csv_drop_hint: "or drop the file here",
        btn_csv_pick: "Choose CSV file",
        csv_mode_interp: "Interpolate",
        csv_mode_fit: "Fit to SH",
        csv_hint: "Two columns: temperature (C), resistance (ohm); comma/semicolon/tab separated, '#' comments and a header row are fine.",
        csv_loaded: "Loaded {0} points, range {1} ... {2} C.",
        csv_failed: "CSV parse failed: {0}",
        csv_no_points: "No valid data rows found (need two columns: temperature, resistance).",

        /* Console */
        title_console: "Temperature Console",
        label_sim_temp: "Simulated temperature",
        mini_target: "Target: ",
        mini_sp: "SP: ",
        mini_pv: "PV: ",
        mini_tp: "TP: ",
        title_mini_target: "Theoretical resistance from the model (what gets sent)",
        title_sp: "Setpoint read back from the device",
        title_pv: "Device estimate of the actual output",
        title_tp: "Temperature the PV corresponds to",
        label_temp: "Temperature (C)",
        btn_calc: "Calculate",
        btn_apply: "Apply",
        label_auto_apply: "Auto apply (send right after calculate / step)",
        label_step_size: "Step (C)",
        btn_step_down: "- Step",
        btn_step_up: "+ Step",
        label_r2t: "Resistance -> temperature (ohm)",
        btn_fill_temp: "Use as temperature",
        value_inf: "Open",
        value_out_of_data: "out of data range",

        /* Curve */
        title_curve: "Temperature-Resistance Curve",
        label_range: "Temp range (C)",
        label_log_axis: "Log resistance axis",
        label_curve_auto_apply: "Auto apply",
        title_curve_auto_apply: "When checked, selecting a point on the curve (click, or drag and release) is sent immediately; when unchecked it only updates the temperature - press Apply to send.",
        legend_current: "Current setpoint",
        legend_pv: "Device PV",
        legend_window: "Allowed window",

        /* Log */
        title_log: "AT Log",
        log_header_hint: "AT command trace",
        btn_clear_log: "Clear",

        /* Messages */
        msg_model_invalid: "Invalid model: ",
        msg_bad_temp: "Invalid temperature",
        msg_bad_number: "Invalid number",
        msg_temp_clamped: "Temperature clamped to the configured range",
        msg_temp_clamped_to_range: "This temperature is outside what the device can output (5 ohm .. 4 Mohm); clamped to the boundary",
        msg_temp_clamped_to_limit: "This temperature is outside the device limit window; clamped to the window boundary",
        msg_step_invalid: "Step size must be positive",
        msg_not_connected_calc_only: "Not connected: computed only, nothing sent",
        msg_nothing_calculated: "No target yet - press Calculate first",
        msg_applied: "Setpoint sent",
        msg_out_of_range: "Resistance is outside the device range {0}...{1}",
        msg_out_of_limit: "Resistance is outside the device limit window {0}...{1} (RES.LIMIT=1)",
        msg_r2t_invalid: "Invalid resistance",
        msg_r2t_failed: "Inverse conversion failed: ",
        msg_no_model: "No usable model - check the parameters on the left",
        msg_need_two_points: "At least 2 valid calibration points are required (temperature and resistance)",
        msg_need_three_points: "At least 3 valid calibration points are required (temperature and resistance)",
        msg_out_of_data_range: "Outside the calibration data range {0}...{1} C (interpolation does not extrapolate)",
        msg_monotonic_bad: "Warning: the model is not monotonic - check the points",
        msg_residual: "Residual",

        /* Log */
        log_ready: "NTC simulator loaded (works without a device)",
        log_unsupported: "navigator.serial is unavailable; use Chrome/Edge over https or http://localhost",
        log_connecting: "Selecting a device...",
        log_connected: "Device connected",
        log_disconnected: "Device disconnected",
        log_unexpected: "Unexpected response:",
        log_auto_apply_on: "Auto apply on: calculate/step will send immediately",
        log_curve_apply_on: "Curve Auto apply on: releasing a selection sends it immediately",
        log_curve_apply_off: "Curve Auto apply off: a selection only updates the temperature - press Apply to send",
        log_auto_apply_off: "Auto apply off: press Apply to send",

        /* Errors */
        err_no_webserial: "WebSerial is not supported. Use Chrome / Edge 109+ over https or http://localhost",
        err_no_device_selected: "No device selected",
        err_no_device_found: "No PPR26 serial device found (make sure the device is in AT mode)",
        err_not_connected: "Device not connected",
        err_open_failed: "Failed to open serial port: ",
        err_timeout: "Device response timeout",
        err_device_error: "Device returned ERROR (out of range or not allowed now)",
        err_overflow: "Command too long; device returned OVERFLOW",
        err_device_wrong_mode: "Device is not in AT mode, please switch and retry",

        /* Firmware version check (against firmware/VERSION; notice + auto DFU only when the device is older) */
        fw_modal_title: "Firmware version mismatch",
        fw_modal_text: "The device runs firmware {0}; the latest release is {1}. The versions do not match - please upgrade the firmware first.",
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
        log_fw_newer: "Device firmware {0} is newer than the published release ({1}) - most likely a development build; no notice shown",
        log_fw_uncomparable: "Cannot compare firmware versions (device {0}, site {1}); no notice shown",
        log_dfu_sent: "AT+DEV.DFU sent; the device disconnects and reboots into DFU mode",
        log_dfu_failed: "Failed to send AT+DEV.DFU: ",
    }
};

let currentLang = "zh";

function t(key) {
    return (I18N[currentLang] && I18N[currentLang][key]) || key;
}

/** 模板占位替换：t("csv_loaded") 之类带 {0}/{1} 的文案 */
function tf(key, ...args) {
    let text = t(key);
    args.forEach((value, index) => {
        text = text.replace("{" + index + "}", value);
    });
    return text;
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
    // 动态内容按当前语言重绘（模型摘要里的模式名等文案带语言，需重建）
    renderPointsTable(elShPointsTable);
    renderPointsTable(elBetaPoints);
    renderCsvSummary();
    buildModel();
    renderInfoStrip();
    renderReadouts();
    renderLimits();
    renderCurve();
    renderFwModal();
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
    renderCurve();   // 曲线颜色取自 CSS 变量，主题切换后重绘
}

// ------------------------------------------------------------------
// 固件版本检查（站点 firmware/VERSION）——与 webui/serial 同一实现
// ------------------------------------------------------------------

const FW_DIRS = ["../firmware/", "../../firmware/"];

let latestVersion = null;
let fwMismatch = null;
let dfuRequested = false;

const elFwModal = document.getElementById("fwModal");
const elFwModalText = document.getElementById("fwModalText");
const elFwModalDfu = document.getElementById("fwModalDfu");
const elFwModalStatus = document.getElementById("fwModalStatus");

function parseVersionFile(text) {
    const lines = String(text).split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line !== "" && !line.startsWith("#"));
    if (lines.length === 0) {
        throw new Error(t("err_version_invalid"));
    }
    return lines[0];
}

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
            log(tf("log_fw_latest", latestVersion));
            return latestVersion;
        } catch (e) {
            errors.push(e.message);
        }
    }
    log(tf("log_fw_latest_unknown", errors.join("; ")), "warn");
    return null;
}

function renderFwModal() {
    elFwModalText.textContent = fwMismatch
        ? tf("fw_modal_text", fwMismatch.device, fwMismatch.latest)
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

function setDfuLine(kind, text) {
    elFwModalDfu.textContent = text;
    elFwModalDfu.className = kind ? `modal-dfu ${kind}` : "modal-dfu";
}

/**
 * 版本不一致时自动让设备进入 DFU 模式（AT+DEV.DFU）。
 * 设备回 OK 后立即断开并重启为 DFU 设备，OK 可能来不及送达，所以以串口是否断开
 * 作为成功判据：只有设备仍在线且明确报错时才算失败。
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
            setDfuLine("ok", t("fw_dfu_sent"));
            log(t("log_dfu_sent"), "ok");
        }
    }
}

/** 只有设备固件比发布版本旧时才弹出不可关闭的提示（并自动进入 DFU）。 */
async function checkFirmwareVersion() {
    if (!latestVersion) {
        await loadLatestVersion();
    }
    const deviceVersion = deviceInfo ? deviceInfo.fw : null;
    if (!latestVersion || !deviceVersion) {
        return;
    }

    const order = compareVersions(deviceVersion, latestVersion);

    if (order !== -1) {
        fwMismatch = null;
        dfuRequested = false;
        elFwModalStatus.textContent = "";
        setDfuLine("", "");
        elFwModal.hidden = true;
        if (order === 0) {
            log(tf("log_fw_match", latestVersion), "ok");
        } else if (order === 1) {
            log(tf("log_fw_newer", deviceVersion, latestVersion));
        } else {
            log(tf("log_fw_uncomparable", deviceVersion, latestVersion), "warn");
        }
        return;
    }

    fwMismatch = { device: deviceVersion, latest: latestVersion };
    renderFwModal();
    elFwModal.hidden = false;
    log(tf("log_fw_mismatch", deviceVersion, latestVersion), "error");
    await enterDfuMode();
}

// ------------------------------------------------------------------
// 数值解析 / 格式化（与 serial 页同一约定）
// ------------------------------------------------------------------

/** 文本按给定单位解析为整数 mΩ；格式不合法或细于 1 mΩ 时返回 null。 */
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

/** 整数 mΩ -> 显示文本，自动选 Ω/kΩ/MΩ。 */
function formatOhm(mohm) {
    if (mohm === null || mohm === undefined || Number.isNaN(mohm)) return "--";
    let unit = "Ω";
    let div = 1000;
    let decimals = 3;
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

/** 残差等小量显示：0 附近给 "<0.001"，其余给 "≤x.xxx"（单位 mK，由调用方拼接） */
function formatMilliK(valueK) {
    const mk = valueK * 1000;
    if (Math.abs(mk) < 0.0005) return "<0.001";
    return "≤" + mk.toFixed(3);
}

/** 汇总用的短数字：4 位有效数字（如 3435、7.08e-4） */
function shortNum(value, digits = 4) {
    if (!Number.isFinite(value)) return "--";
    return Number(value.toPrecision(digits)).toString();
}

/** 汇总用的短阻值：4 位有效数字 + 自动单位（如 248.3 kΩ） */
function shortOhm(mohm) {
    if (mohm === null || mohm === undefined || !Number.isFinite(Number(mohm))) return "--";
    const value = Number(mohm);
    const abs = Math.abs(value);
    if (abs >= 1e9) return shortNum(value / 1e9) + " MΩ";
    if (abs >= 1e6) return shortNum(value / 1e6) + " kΩ";
    return shortNum(value / 1e3) + " Ω";
}

/**
 * 解析十进制数（允许负号、小数与科学计数法；逗号可作小数点）。
 * SH 的 A/B/C 系数天然是指数写法（如 3.2e-8），因此必须接受 e/E 记法。
 */
function parseTemp(text) {
    const s = String(text).trim().replace(",", ".");
    if (!/^-?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(s)) return null;
    const value = Number(s);
    return Number.isFinite(value) ? value : null;
}

/** 解析正数（步长、阻值等；同样接受科学计数法） */
function parsePositive(text) {
    return parseTemp(text);
}

function wrapError(message, type = "error") {
    log(message, type);
    return new Error(message);
}

// ------------------------------------------------------------------
// 串口通信（与 serial 页同一实现：单命令在飞、超时后 drain）
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
        this.desynced = false;
        this.lastLineAt = 0;
        this.onLine = null;
        this.onDisconnect = null;
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

    _failWaiters() {
        const waiters = this.waiters;
        this.waiters = [];
        for (const waiter of waiters) {
            clearTimeout(waiter.timer);
            waiter.reject(new Error(t("err_not_connected")));
        }
    }

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
                this.desynced = true;
                this.lines = [];
                reject(new Error(t("err_timeout")));
            }, timeoutMs);
            this.waiters.push(waiter);
        });
    }

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

    // ---------------- 本页用到的命令 ----------------

    async ping() {
        return this.command("AT");
    }

    async readInfo() {
        const info = {};
        info.model = await this.query("AT+DEV.MODEL?", "DEV.MODEL");
        info.sn = await this.query("AT+DEV.SN?", "DEV.SN");
        info.fw = await this.query("AT+DEV.FWVER?", "DEV.FWVER");
        info.hw = await this.query("AT+DEV.HWVER?", "DEV.HWVER");
        info.protocol = parseInt(await this.query("AT+SYS.PROT?", "SYS.PROT"), 10);
        return info;
    }

    async readState() {
        const state = {};
        state.sp = parseInt(await this.query("AT+RES.SP?", "RES.SP"), 10);
        const pvRaw = await this.query("AT+RES.PV?", "RES.PV");
        state.pv = (pvRaw.toLowerCase() === "inf") ? "inf" : parseInt(pvRaw, 10);
        state.limitEnable = parseInt(await this.query("AT+RES.LIMIT?", "RES.LIMIT"), 10) !== 0;
        state.min = parseInt(await this.query("AT+RES.MIN?", "RES.MIN"), 10);
        state.max = parseInt(await this.query("AT+RES.MAX?", "RES.MAX"), 10);
        state.open = parseInt(await this.query("AT+RES.OPEN?", "RES.OPEN"), 10) !== 0;
        state.short = parseInt(await this.query("AT+RES.SHORT?", "RES.SHORT"), 10) !== 0;
        return state;
    }

    readTemperatureC() {
        return this.query("AT+DEV.TEMP?", "DEV.TEMP").then(raw => parseInt(raw, 10) / 10);
    }

    /** 只回读设定值与实际估测（改变输出后使用，避免多余的总线往返） */
    async readSetpoint() {
        const state = {};
        state.sp = parseInt(await this.query("AT+RES.SP?", "RES.SP"), 10);
        const pvRaw = await this.query("AT+RES.PV?", "RES.PV");
        state.pv = (pvRaw.toLowerCase() === "inf") ? "inf" : parseInt(pvRaw, 10);
        return state;
    }

    setResistance(mohm) {
        return this.command("AT+RES.SP=" + mohm);
    }

    setMin(mohm) {
        return this.command("AT+RES.MIN=" + mohm);
    }

    setMax(mohm) {
        return this.command("AT+RES.MAX=" + mohm);
    }

    setLimit(on) {
        return this.command("AT+RES.LIMIT=" + (on ? 1 : 0));
    }
}

// ------------------------------------------------------------------
// 模型层
// ------------------------------------------------------------------

/**
 * CSV 原始数据插值模型：在 ln R ↔ 1/T 变量对里做线性插值（与文档、LUT 同一口径）。
 * 数据范围外拒绝外推——这是"标定点插值"的固有边界，不做外推猜测。
 */
class CsvInterpModel {
    constructor(points) {
        const sorted = points.slice().sort((a, b) => a[0] - b[0]);
        // 同温度重复点：保留最后一个（后写覆盖）
        this.points = [];
        for (const point of sorted) {
            if (this.points.length && point[0] === this.points[this.points.length - 1][0]) {
                this.points[this.points.length - 1] = point;
            } else {
                this.points.push(point);
            }
        }
        if (this.points.length < 2) {
            throw new Error(t("csv_no_points"));
        }
        this.invT = this.points.map(([tC]) => 1 / ntc.cToK(tC));
        this.lnR = this.points.map(([, r]) => Math.log(r));
        this.dataMinC = this.points[0][0];
        this.dataMaxC = this.points[this.points.length - 1][0];
        // 单调性：阻值应随温度严格递减
        this.monotonic = this.lnR.every((value, index) => index === 0 || value < this.lnR[index - 1]);
    }

    /**
     * 二分定位 value 落在哪两个相邻点之间。
     * 数据按温度升序排列，因此 1/T 与 ln R 数组都是**递减**的（increasing=false）。
     */
    _bracket(value, array, increasing) {
        const last = array.length - 1;
        if (increasing) {
            if (value < array[0] || value > array[last]) return null;
        } else {
            if (value > array[0] || value < array[last]) return null;
        }
        let lo = 0;
        let hi = last;
        while (hi - lo > 1) {
            const mid = (lo + hi) >> 1;
            const inside = increasing ? array[mid] <= value : array[mid] >= value;
            if (inside) lo = mid;
            else hi = mid;
        }
        return [lo, hi];
    }

    resistance(tC) {
        const target = 1 / ntc.cToK(tC);
        const pair = this._bracket(target, this.invT, false);
        if (!pair) {
            throw new Error(tf("msg_out_of_data_range",
                this.dataMinC.toFixed(2), this.dataMaxC.toFixed(2)));
        }
        const [lo, hi] = pair;
        const frac = (target - this.invT[lo]) / (this.invT[hi] - this.invT[lo]);
        return Math.exp(this.lnR[lo] + frac * (this.lnR[hi] - this.lnR[lo]));
    }

    temperature(rOhm) {
        const target = Math.log(rOhm);
        const pair = this._bracket(target, this.lnR, false);
        if (!pair) {
            throw new Error(tf("msg_out_of_data_range",
                this.dataMinC.toFixed(2), this.dataMaxC.toFixed(2)));
        }
        const [lo, hi] = pair;
        const frac = (target - this.lnR[lo]) / (this.lnR[hi] - this.lnR[lo]);
        return ntc.kToC(1 / (this.invT[lo] + frac * (this.invT[hi] - this.invT[lo])));
    }
}

/* 界面状态 */
const ui = {
    mode: "beta",             // beta | sh | csv
    betaSub: "direct",        // direct | two | lsq
    shSub: "direct",          // direct（直填 A/B/C）| points（标定点拟合）
    csvSub: "interp",         // interp | fit
    shPoints: [[0, 28443.5], [25, 10000], [85, 1451.3]],
    betaPoints: [[0, 28443.5], [25, 10000], [50, 4112.3], [85, 1451.3], [100, 984.5]],
    csvPoints: null,
    csvName: "",
    model: null,              // ntc 模型实例
    modelError: "",
    modelInfo: [],            // [label, value] 摘要行
    simTempC: 25,
    targetMohm: null,
    sendMohm: null,
    appliedMohm: null,
    r2tTempC: null,
    // 说明：设备原样存储整数 mΩ（不按 AT+RES.STEP 取整），实际输出由继电器网络
    // 合成，因此页面不下发取整，只把设备回读的 PV 与折算温度显示出来。
};

let deviceInfo = null;
let deviceState = null;
let deviceTempC = null;
let connecting = false;
let tempTimer = 0;
let curveDragging = false; // 是否正在曲线上拖拽选点

const dev = new Ppr26Serial();

// ------------------------------------------------------------------
// DOM 引用
// ------------------------------------------------------------------

const elStatus = document.getElementById("connStatus");
const elInfoStrip = document.getElementById("infoStrip");
const elLog = document.getElementById("logOutput");
const elLogBody = document.getElementById("logBody");
const elLogToggle = document.getElementById("btnLogToggle");
const elLogToggleIcon = document.getElementById("logToggleIcon");
const elLogCount = document.getElementById("logCount");
const elModelTabs = document.getElementById("modelTabs");
const elBetaTabs = document.getElementById("betaTabs");
const elCsvTabs = document.getElementById("csvTabs");
const elPanelBeta = document.getElementById("panelBeta");
const elPanelSh = document.getElementById("panelSh");
const elPanelCsv = document.getElementById("panelCsv");
const elBetaDirect = document.getElementById("betaDirect");
const elBetaTwo = document.getElementById("betaTwo");
const elBetaLsq = document.getElementById("betaLsq");
const elBetaPoints = document.getElementById("betaPoints");
const elShTabs = document.getElementById("shTabs");
const elShDirect = document.getElementById("shDirect");
const elShPoints = document.getElementById("shPoints");
const elShPointsTable = document.getElementById("shPointsTable");
const elModelSummary = document.getElementById("modelSummary");
const elCsvSummary = document.getElementById("csvSummary");
const elCsvDrop = document.getElementById("csvDrop");
const elCsvFile = document.getElementById("csvFile");
const elInputTemp = document.getElementById("inputTemp");
const elSimTempBig = document.getElementById("simTempBig");
const elInputStepC = document.getElementById("inputStepC");
const elChkAuto = document.getElementById("chkAuto");
const elInputR = document.getElementById("inputR");
const elUnitR = document.getElementById("unitR");
const elRToTReadout = document.getElementById("rToTReadout");
const elTargetR = document.getElementById("targetR");
const elSpR = document.getElementById("spR");
const elPvR = document.getElementById("pvR");
const elPvTemp = document.getElementById("pvTemp");
const elPvDelta = document.getElementById("pvDelta");
const elChkLimitEnable = document.getElementById("chkLimitEnable");
const elInputMin = document.getElementById("inputMin");
const elUnitMin = document.getElementById("unitMin");
const elInputMax = document.getElementById("inputMax");
const elUnitMax = document.getElementById("unitMax");
const elBtnWriteLimits = document.getElementById("btnWriteLimits");
const elRangeMin = document.getElementById("rangeMin");
const elRangeMax = document.getElementById("rangeMax");
const elChkLogAxis = document.getElementById("chkLogAxis");
const elChkCurveApply = document.getElementById("chkCurveApply");
const elCurve = document.getElementById("curve");
const elCurveWrap = document.getElementById("curveWrap");
const elCurveTip = document.getElementById("curveTip");

const SVG_NS = "http://www.w3.org/2000/svg";

// ------------------------------------------------------------------
// 日志
// ------------------------------------------------------------------

let logLines = 0;

function log(message, type = "info") {
    const now = new Date().toLocaleTimeString();
    const prefix = { error: "[ERR]", ok: "[OK ]", tx: "[TX ]", rx: "[RX ]", warn: "[WRN]" }[type] || "[INF]";
    elLog.textContent += now + " " + prefix + " " + message + "\n";
    elLog.scrollTop = elLog.scrollHeight;
    logLines += 1;
    elLogCount.textContent = "(" + logLines + ")";
}

// ------------------------------------------------------------------
// 模型构建
// ------------------------------------------------------------------

function readPoints(container) {
    const rows = container.querySelectorAll("tbody tr");
    const points = [];
    rows.forEach(row => {
        const inputs = row.querySelectorAll("input[type=text]");
        const tC = parseTemp(inputs[0].value);
        const rOhm = parsePositive(inputs[1].value);
        if (tC !== null && rOhm !== null && rOhm > 0) {
            points.push([tC, rOhm]);
        }
    });
    return points;
}

/** 由界面参数构建当前模型；失败时 ui.model = null 并记录原因。 */
function buildModel() {
    ui.model = null;
    ui.modelError = "";
    ui.modelInfo = [];

    try {
        if (ui.mode === "beta") {
            if (ui.betaSub === "direct") {
                const r25 = parsePositive(document.getElementById("inR25").value);
                const b = parsePositive(document.getElementById("inBeta").value);
                if (r25 === null || b === null) throw new Error(t("msg_bad_number"));
                const model = new ntc.BetaModel(r25, b);
                ui.model = model;
                ui.modelInfo = [
                    t("mode_beta") + " · R25 " + shortOhm(r25 * 1000) + " · B " + shortNum(b) + " K",
                ];
            } else if (ui.betaSub === "two") {
                const t1 = parseTemp(document.getElementById("inT1").value);
                const r1 = parsePositive(document.getElementById("inR1").value);
                const t2 = parseTemp(document.getElementById("inT2").value);
                const r2 = parsePositive(document.getElementById("inR2").value);
                if (t1 === null || r1 === null || t2 === null || r2 === null) {
                    throw new Error(t("msg_bad_number"));
                }
                const model = ntc.betaFromTwoPoints([t1, r1], [t2, r2]);
                ui.model = model;
                ui.modelInfo = [
                    t("beta_tab_two") + " · R25 " + shortOhm(model.r25 * 1000)
                    + " · B " + shortNum(model.b) + " K",
                ];
            } else {
                const points = readPoints(elBetaPoints);
                if (points.length < 2) throw new Error(t("msg_need_two_points"));
                const result = ntc.fitBeta(points, { weights: "t" });
                ui.model = result.model;
                ui.modelInfo = [
                    t("beta_tab_lsq") + " " + points.length + " 点 · R25 "
                    + shortOhm(result.model.r25 * 1000) + " · B " + shortNum(result.model.b) + " K",
                    t("msg_residual") + " " + formatMilliK(result.maxAbsC) + " mK",
                ];
            }
        } else if (ui.mode === "sh") {
            if (ui.shSub === "direct") {
                const a = parseTemp(document.getElementById("inShA").value);
                const b = parseTemp(document.getElementById("inShB").value);
                const c = parseTemp(document.getElementById("inShC").value);
                if (a === null || b === null || c === null) throw new Error(t("msg_bad_number"));
                const model = new ntc.SteinhartHartModel(a, b, c);
                ui.model = model;
                ui.modelInfo = [
                    t("sh_tab_direct") + " · A " + shortNum(a) + " · B " + shortNum(b)
                    + " · C " + shortNum(c),
                ];
            } else {
                const points = readPoints(elShPointsTable);
                if (points.length < 3) throw new Error(t("msg_need_three_points"));
                const result = ntc.fitSteinhartHart(points, { weights: "t" });
                ui.model = result.model;
                ui.modelInfo = [
                    t("mode_sh") + " · A " + shortNum(result.model.a) + " · B " + shortNum(result.model.b)
                    + " · C " + shortNum(result.model.c),
                    t("msg_residual") + " " + formatMilliK(result.maxAbsC) + " mK",
                ];
            }
        } else {
            if (!ui.csvPoints || ui.csvPoints.length < 2) {
                throw new Error(t("csv_no_points"));
            }
            if (ui.csvSub === "fit" && ui.csvPoints.length < 3) {
                throw new Error(t("msg_need_three_points"));
            }
            if (ui.csvSub === "interp") {
                const model = new CsvInterpModel(ui.csvPoints);
                ui.model = model;
                ui.modelInfo = [
                    t("csv_mode_interp") + " " + model.points.length + " 点 · "
                    + shortNum(model.dataMinC) + "…" + shortNum(model.dataMaxC) + " ℃",
                ];
                if (!model.monotonic) {
                    ui.modelInfo.push(t("msg_monotonic_bad"));
                }
            } else {
                const result = ntc.fitSteinhartHart(ui.csvPoints, { weights: "t" });
                ui.model = result.model;
                ui.modelInfo = [
                    t("csv_mode_fit") + " · A " + shortNum(result.model.a)
                    + " · B " + shortNum(result.model.b) + " · C " + shortNum(result.model.c),
                    t("msg_residual") + " " + formatMilliK(result.maxAbsC) + " mK",
                ];
            }
        }

        // 通用摘要：R25 与温度范围端点阻值（端点越界时只显示提示，不影响模型可用性）
        if (ui.model) {
            const safeOhm = (tC) => {
                try {
                    const r = ui.model.resistance(tC);
                    return Number.isFinite(r) && r > 0 ? shortOhm(r * 1000) : t("value_out_of_data");
                } catch (e) {
                    return t("value_out_of_data");
                }
            };
            const [tMin, tMax] = currentRange();
            ui.modelInfo.push(shortNum(tMin) + "…" + shortNum(tMax) + " ℃ · "
                + safeOhm(tMin) + " … " + safeOhm(tMax));
            if (!isMonotonic(ui.model, tMin, tMax)) {
                ui.modelInfo.push(t("msg_monotonic_bad"));
            }
        }
    } catch (e) {
        ui.model = null;
        ui.modelError = e.message;
        ui.modelInfo = [t("msg_model_invalid") + e.message];
    }

    renderModelSummary();
    return ui.model;
}

/** 检查模型在该温度范围内是否"阻值随温度单调递减"（人工输入系数时能立刻发现错误） */
function isMonotonic(model, tMinC, tMaxC, samples = 48) {
    let prev = null;
    for (let i = 0; i < samples; i++) {
        const tC = tMaxC - ((tMaxC - tMinC) * i) / (samples - 1);   // 由高温到低温，阻值应递增
        let r;
        try {
            r = model.resistance(tC);
        } catch (e) {
            return true;   // 取不到值（例如 CSV 数据范围之外）不判定
        }
        if (!Number.isFinite(r) || r <= 0) return true;
        if (prev !== null && r <= prev) return false;
        prev = r;
    }
    return true;
}

function renderModelSummary() {
    if (!elModelSummary) return;
    elModelSummary.innerHTML = ui.modelInfo.map(line => escapeHtml(line)).join("<br>");
}

function escapeHtml(text) {
    return String(text).replace(/[&<>"]/g, ch => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;"
    }[ch]));
}

// ------------------------------------------------------------------
// 标定点表组件
// ------------------------------------------------------------------

/**
 * 可编辑的 (温度, 阻值) 表格：增行、删行、改动即回调。
 * 重绘（如切换语言）时沿用原始输入文本，避免把用户正在输入的内容格式化掉；
 * 首次调用传入初始点，之后只传 container 即可沿用。
 */
function renderPointsTable(container, points, options = {}) {
    if (!container) return;
    if (points) {
        container._points = points;
        container._raw = points.map(([tC, rOhm]) => [String(tC), String(rOhm)]);
    }
    if (!container._raw) container._raw = [];
    if (Object.keys(options).length) container._opts = options;
    const opts = container._opts || { minRows: 2, onChange: null };
    const store = container._raw;

    container.innerHTML = "";
    const table = document.createElement("table");
    table.className = "points-table";

    const head = document.createElement("thead");
    head.innerHTML = "<tr><th>" + escapeHtml(t("label_point_t")) + "</th><th>"
        + escapeHtml(t("label_point_r")) + "</th><th></th></tr>";
    table.appendChild(head);

    const body = document.createElement("tbody");
    store.forEach((rowValues, index) => {
        const tr = document.createElement("tr");
        rowValues.forEach((text, fieldIndex) => {
            const td = document.createElement("td");
            const input = document.createElement("input");
            input.type = "text";
            input.inputMode = "decimal";
            input.autocomplete = "off";
            input.spellcheck = false;
            input.value = text;
            input.addEventListener("input", () => {
                store[index][fieldIndex] = input.value;
                if (opts.onChange) opts.onChange();
            });
            td.appendChild(input);
            tr.appendChild(td);
        });
        const tdActions = document.createElement("td");
        tdActions.className = "actions";
        const del = document.createElement("button");
        del.className = "row-del";
        del.type = "button";
        del.textContent = "✕";
        del.title = t("title_remove_point");
        del.addEventListener("click", () => {
            if (store.length <= (opts.minRows || 1)) return;
            store.splice(index, 1);
            renderPointsTable(container);
            if (opts.onChange) opts.onChange();
        });
        tdActions.appendChild(del);
        tr.appendChild(tdActions);
        body.appendChild(tr);
    });
    table.appendChild(body);
    container.appendChild(table);

    const foot = document.createElement("div");
    foot.className = "points-foot";
    const add = document.createElement("button");
    add.className = "btn tiny";
    add.type = "button";
    add.textContent = t("btn_add_point");
    add.addEventListener("click", () => {
        const last = store[store.length - 1] || ["25", "10000"];
        store.push([last[0], last[1]]);
        renderPointsTable(container);
        if (opts.onChange) opts.onChange();
    });
    foot.appendChild(add);
    container.appendChild(foot);
}
// ------------------------------------------------------------------
// 曲线
// ------------------------------------------------------------------

/**
 * 夹取并在必要时给出原因（供输入路径写日志用）：
 * 返回值 reason 为 "" （无需夹取）、"limit"（被设备限值窗口限制）或 "hardware"（被硬件量程限制）。
 */
function clampWithReason(tC) {
    const clamped = clampToAllowedWindow(tC);
    if (clamped === tC) return { tC: tC, reason: "" };
    let reason = "hardware";
    try {
        const mohm = Math.round(ui.model.resistance(tC) * 1000);
        if (mohm >= RES_MIN_MOHM && mohm <= RES_MAX_MOHM) reason = "limit";
    } catch (e) {
        /* 取不到阻值就按硬件量程处理 */
    }
    return { tC: clamped, reason: reason };
}

/** dR/dT（Ω/℃），由模型数值微分得到（NTC 为负值） */
function resistanceSlopeOhmPerC(tC, h = 0.01) {
    try {
        return (ui.model.resistance(tC + h) - ui.model.resistance(tC - h)) / (2 * h);
    } catch (e) {
        return 0;
    }
}

/**
 * 设备实际允许的阻值窗口（mΩ）：
 *   硬件绝对量程 5 Ω ~ 4 MΩ **始终生效**（超出就设不了，必须限制）；
 *   设备限值窗口（启用限值时）再往里收一层。
 */
function allowedWindowMohm() {
    let lo = RES_MIN_MOHM;
    let hi = RES_MAX_MOHM;
    if (deviceState && deviceState.limitEnable) {
        lo = Math.max(lo, deviceState.min);
        hi = Math.min(hi, deviceState.max);
    }
    return [lo, hi];
}

/**
 * 把温度夹到"阻值落在允许窗口内"的最近点（绝对量程始终参与，限值窗口启用时再叠加）。
 *
 * 不能只取边界温度：温度要四舍五入到 1 mK（与温度框一致）、目标阻值还要取整到整数 mΩ，
 * 两次取整都可能把结果挤到窗口外一点点（例如 MIN=50 kΩ 时算出 49.999931 kΩ）。
 * 因此这里在窗口内侧做一次收敛校验——按"最终下发的整数 mΩ 是否在窗口内"判据，
 * 从 1 mΩ 余量开始逐步放大，直到满足为止（余量折算成温度最多几十 mK，用户看不出来）。
 */
function clampToAllowedWindow(tC) {
    if (!ui.model) return tC;
    let r;
    try {
        r = ui.model.resistance(tC);
    } catch (e) {
        return tC;
    }
    if (!Number.isFinite(r)) return tC;

    const [minMohm, maxMohm] = allowedWindowMohm();
    const minOhm = minMohm / 1000;
    const maxOhm = maxMohm / 1000;
    if (r >= minOhm && r <= maxOhm) return tC;

    const resistanceTooBig = r > maxOhm;          // 阻值偏大 → 需要降低阻值 → 温度升高
    let bound;
    try {
        bound = ui.model.temperature(resistanceTooBig ? maxOhm : minOhm);
    } catch (e) {
        return tC;
    }
    if (!Number.isFinite(bound)) return tC;

    const slope = Math.abs(resistanceSlopeOhmPerC(bound));
    if (!(slope > 0)) return Number(bound.toFixed(3));
    const sign = resistanceTooBig ? 1 : -1;       // 往窗口内侧走的方向

    let marginOhm = 0.001;                        // 先留 1 mΩ 余量，不够再放大
    for (let i = 0; i < 20; i++) {
        // 每次至少走 1 mK（温度框的显示精度），否则取整后可能原地不动
        const stepC = Math.max(marginOhm / slope, 0.001);
        const candidate = Number((bound + sign * stepC).toFixed(3));
        let mohm;
        try {
            mohm = Math.round(ui.model.resistance(candidate) * 1000);
        } catch (e) {
            return Number(bound.toFixed(3));
        }
        if (mohm >= minMohm && mohm <= maxMohm) return candidate;
        marginOhm *= 4;
    }
    return Number(bound.toFixed(3));
}

function currentRange() {
    let lo = parseTemp(elRangeMin.value);
    let hi = parseTemp(elRangeMax.value);
    if (lo === null) lo = -40;
    if (hi === null) hi = 125;
    if (!(lo >= TEMP_LIMIT_MIN_C)) lo = TEMP_LIMIT_MIN_C;
    if (!(hi <= TEMP_LIMIT_MAX_C)) hi = TEMP_LIMIT_MAX_C;
    if (hi - lo < 1) hi = lo + 1;
    return [lo, hi];
}

function curveColors() {
    const cs = getComputedStyle(document.documentElement);
    const pick = (name, fallback) => (cs.getPropertyValue(name) || "").trim() || fallback;
    return {
        accent: pick("--accent", "#3b82f6"),
        success: pick("--success", "#16a34a"),
        border: pick("--border", "#e0e2e6"),
        text: pick("--text", "#1f2329"),
        text2: pick("--text-2", "#5c6370"),
        surface: pick("--surface", "#ffffff"),
    };
}

/** 采样模型曲线：返回 [{tC, rOhm}]，跳过模型无效/越界的点 */
function sampleCurve(model, tMin, tMax, count = 200) {
    const samples = [];
    for (let i = 0; i < count; i++) {
        const tC = tMin + (tMax - tMin) * i / (count - 1);
        try {
            const r = model.resistance(tC);
            if (Number.isFinite(r) && r > 0) samples.push([tC, r]);
        } catch (e) {
            /* 该温度点模型不可用（如 CSV 数据范围外）：跳过 */
        }
    }
    return samples;
}

function renderCurve() {
    if (!elCurve || !elCurveWrap) return;
    const colors = curveColors();
    const width = Math.max(320, elCurveWrap.clientWidth || 520);
    // 高度随卡片可用空间自适应（不低于 260px）
    const height = Math.max(260, Math.round(elCurveWrap.clientHeight || 300));
    const margin = { l: 56, r: 14, t: 12, b: 28 };

    elCurve.setAttribute("viewBox", `0 0 ${width} ${height}`);
    elCurve.setAttribute("width", width);
    elCurve.setAttribute("height", height);
    while (elCurve.firstChild) elCurve.removeChild(elCurve.firstChild);

    const [tMin, tMax] = currentRange();
    const samples = ui.model ? sampleCurve(ui.model, tMin, tMax) : [];

    // Y 轴范围：取模型采样与设备限值窗口的并集
    let values = samples.map(sample => sample[1]);
    if (deviceState && deviceState.limitEnable !== undefined) {
        values = values.concat([deviceState.min / 1000, deviceState.max / 1000]);
    }
    if (!values.length) values = [1, 1e6];
    let rLo = Math.min(...values);
    let rHi = Math.max(...values);
    if (!(rLo > 0)) rLo = 1;
    if (!(rHi > rLo)) rHi = rLo * 10;

    const logAxis = elChkLogAxis.checked;
    if (logAxis) {
        rLo = Math.pow(10, Math.floor(Math.log10(rLo)));
        rHi = Math.pow(10, Math.ceil(Math.log10(rHi)));
        if (rHi / rLo < 10) rHi = rLo * 10;
    } else {
        rLo = 0;
        rHi = rHi * 1.05;
    }

    const plotW = width - margin.l - margin.r;
    const plotH = height - margin.t - margin.b;
    const xOf = (tC) => margin.l + ((tC - tMin) / (tMax - tMin)) * plotW;
    const yOf = (r) => {
        if (logAxis) {
            const frac = (Math.log10(rHi) - Math.log10(r)) / (Math.log10(rHi) - Math.log10(rLo));
            return margin.t + frac * plotH;
        }
        return margin.t + (1 - (r - rLo) / (rHi - rLo)) * plotH;
    };

    const add = (tag, attrs, text) => {
        const el = document.createElementNS(SVG_NS, tag);
        for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
        if (text !== undefined) el.textContent = text;
        elCurve.appendChild(el);
        return el;
    };

    // 允许窗口阴影（设备 RES.LIMIT=1 时的 [MIN, MAX]）
    if (deviceState && deviceState.limitEnable) {
        const yTop = Math.max(margin.t, yOf(deviceState.max / 1000));
        const yBottom = Math.min(margin.t + plotH, yOf(deviceState.min / 1000));
        if (yBottom > yTop) {
            add("rect", {
                x: margin.l, y: yTop, width: plotW, height: yBottom - yTop,
                fill: colors.accent, opacity: 0.16,
            });
        }
    }

    // 网格与刻度
    const tickFont = 10;
    if (logAxis) {
        for (let decade = Math.round(Math.log10(rLo)); decade <= Math.round(Math.log10(rHi)); decade++) {
            const r = Math.pow(10, decade);
            const y = yOf(r);
            add("line", { x1: margin.l, y1: y, x2: margin.l + plotW, y2: y, stroke: colors.border, "stroke-width": 1 });
            add("text", {
                x: margin.l - 6, y: y + 3, "text-anchor": "end",
                "font-size": tickFont, fill: colors.text2,
            }, formatOhm(r * 1000));
        }
    } else {
        for (let i = 0; i <= 4; i++) {
            const r = rLo + (rHi - rLo) * i / 4;
            const y = yOf(r);
            add("line", { x1: margin.l, y1: y, x2: margin.l + plotW, y2: y, stroke: colors.border, "stroke-width": 1 });
            add("text", {
                x: margin.l - 6, y: y + 3, "text-anchor": "end",
                "font-size": tickFont, fill: colors.text2,
            }, formatOhm(r * 1000));
        }
    }

    // X 轴刻度：等分 4 段
    for (let i = 0; i <= 4; i++) {
        const tC = tMin + (tMax - tMin) * i / 4;
        const x = xOf(tC);
        add("line", { x1: x, y1: margin.t, x2: x, y2: margin.t + plotH, stroke: colors.border, "stroke-width": 1 });
        add("text", {
            x: x, y: margin.t + plotH + 16, "text-anchor": "middle",
            "font-size": tickFont, fill: colors.text2,
        }, tC.toFixed(0) + " ℃");
    }

    // 模型曲线
    if (samples.length >= 2) {
        const points = samples.map(([tC, r]) => xOf(tC).toFixed(2) + "," + yOf(r).toFixed(2)).join(" ");
        add("polyline", {
            points, fill: "none", stroke: colors.accent, "stroke-width": 2,
            "stroke-linejoin": "round",
        });
    }

    // 当前设定点 / 设备 PV
    if (ui.model && ui.targetMohm !== null && Number.isFinite(ui.targetMohm)) {
        const cx = xOf(Math.min(Math.max(ui.simTempC, tMin), tMax));
        const cy = yOf(ui.targetMohm / 1000);
        add("circle", { cx, cy, r: 5, fill: colors.accent });
        add("text", {
            x: cx + 8, y: cy - 6, "font-size": 11, fill: colors.text,
        }, ui.simTempC.toFixed(2) + " ℃ / " + formatOhm(ui.targetMohm));
    }
    if (deviceState && deviceState.pv !== "inf" && Number.isFinite(deviceState.pv)) {
        let pvTempC = null;
        try {
            pvTempC = ui.model ? ui.model.temperature(deviceState.pv / 1000) : null;
        } catch (e) {
            pvTempC = null;
        }
        if (pvTempC !== null && Number.isFinite(pvTempC)) {
            const cx = xOf(Math.min(Math.max(pvTempC, tMin), tMax));
            const cy = yOf(deviceState.pv / 1000);
            add("circle", { cx, cy, r: 4.5, fill: "none", stroke: colors.success, "stroke-width": 2 });
        }
    }

    // ---------------- 交互：悬停读数 / 单击设点 / 左键拖拽平移 ----------------
    const tip = elCurveTip;
    const hoverLine = add("line", {
        x1: 0, y1: margin.t, x2: 0, y2: margin.t + plotH,
        stroke: colors.accent, "stroke-width": 1, "stroke-dasharray": "3 3", opacity: 0,
    });

    const pointerTempC = (event) => {
        const rect = elCurve.getBoundingClientRect();
        const scale = rect.width / width;
        const x = (event.clientX - rect.left) / scale;
        const frac = (x - margin.l) / plotW;
        if (frac < 0 || frac > 1) return null;
        return tMin + frac * (tMax - tMin);
    };

    const updateHover = (event) => {
        const tC = pointerTempC(event);
        let rOhm = null;
        if (tC !== null && ui.model) {
            try {
                rOhm = ui.model.resistance(tC);
            } catch (e) {
                rOhm = null;
            }
        }
        if (tC === null || rOhm === null || !Number.isFinite(rOhm)) {
            tip.hidden = true;
            hoverLine.setAttribute("opacity", 0);
            return;
        }
        hoverLine.setAttribute("x1", xOf(tC));
        hoverLine.setAttribute("x2", xOf(tC));
        hoverLine.setAttribute("opacity", 0.6);
        tip.hidden = false;
        tip.textContent = tC.toFixed(2) + " ℃ · " + formatOhm(rOhm * 1000);
        const wrapRect = elCurveWrap.getBoundingClientRect();
        tip.style.left = Math.min(Math.max(event.clientX - wrapRect.left + 10, 4), wrapRect.width - 120) + "px";
        tip.style.top = Math.max(event.clientY - wrapRect.top - 34, 4) + "px";
    };

    // 设置模拟点：光标位置的温度写入温度框并只更新本地模拟点（不下发）
    const setPointAt = (event) => {
        let tC = pointerTempC(event);
        if (tC === null) return;
        tC = clampToAllowedWindow(tC);  // 夹到设备可输出的范围内（绝对量程 + 限值窗口）
        elInputTemp.value = tC.toFixed(3);
        doCalc({ noApply: true });     // 只更新模拟点，大字温度保持绿色
    };

    elCurve.onpointerdown = (event) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;   // 只处理鼠标左键
        elCurve.setPointerCapture(event.pointerId);
        curveDragging = true;
        elCurve.classList.add("dragging");
        tip.hidden = true;
        setPointAt(event);             // 按下即选点
    };

    elCurve.onpointermove = (event) => {
        if (curveDragging) {
            setPointAt(event);         // 拖拽选点：模拟点跟着光标横向移动
            return;
        }
        updateHover(event);
    };

    elCurve.onpointerup = async (event) => {
        if (!curveDragging) return;
        curveDragging = false;
        elCurve.classList.remove("dragging");
        try {
            elCurve.releasePointerCapture(event.pointerId);
        } catch (e) {
            /* 指针已释放 */
        }
        setPointAt(event);             // 松手时以最终位置为准
        // 勾选了曲线旁的「自动设置」才下发；拖拽时只在松手这一次下发，避免连着驱动设备
        if (elChkCurveApply.checked) {
            await applyTarget();
        }
    };

    elCurve.onpointercancel = () => {
        curveDragging = false;
        elCurve.classList.remove("dragging");
    };

    elCurve.onpointerleave = () => {
        if (curveDragging) return;     // 拖拽中（指针已捕获）不隐藏读数
        tip.hidden = true;
        hoverLine.setAttribute("opacity", 0);
    };
}

// ------------------------------------------------------------------
// 控制台动作
// ------------------------------------------------------------------

function updateBigValue() {
    elSimTempBig.textContent = ui.simTempC.toFixed(3) + " ℃";
    // 颜色表示是否已下发：绿色 = 仅本地计算，红色 = 已下发到设备（端子已生效）
    const applied = ui.appliedMohm !== null && ui.sendMohm !== null
        && ui.appliedMohm === ui.sendMohm;
    elSimTempBig.classList.toggle("applied", applied);
    elSimTempBig.classList.toggle("pending", !applied);
}

function renderReadouts() {
    elTargetR.textContent = formatOhm(ui.targetMohm);
    // 四项始终显示（固定两行），避免内容增减导致下方控件上下移动
    const state = deviceState;
    if (state) {
        elSpR.textContent = formatOhm(state.sp);
        elPvR.textContent = state.pv === "inf" ? t("value_inf") : formatOhm(state.pv);

        if (state.pv === "inf") {
            elPvTemp.textContent = "--";
            elPvDelta.textContent = "";
        } else if (ui.model) {
            try {
                const pvTempC = ui.model.temperature(state.pv / 1000);
                elPvTemp.textContent = pvTempC.toFixed(3) + " ℃";
                const raw = pvTempC - ui.simTempC;
                // 偏差小到显示不出来（<0.5 mK）就不显示，避免"(+0.000 ℃)"这类噪声
                elPvDelta.textContent = Math.abs(raw) < 0.0005
                    ? ""
                    : "(" + (raw >= 0 ? "+" : "") + raw.toFixed(3) + " ℃)";
            } catch (e) {
                elPvTemp.textContent = "--";
                elPvDelta.textContent = "";
            }
        }
    } else {
        elSpR.textContent = "--";
        elPvR.textContent = "--";
        elPvTemp.textContent = "--";
        elPvDelta.textContent = "";
    }

    updateBigValue();

    if (ui.r2tTempC === null) {
        ui.r2tTempC = computeR2T();
    }
    elRToTReadout.textContent = ui.r2tTempC === null
        ? "--"
        : "= " + ui.r2tTempC.toFixed(3) + " ℃";
}

function renderInfoStrip() {
    if (!elInfoStrip) return;
    const chips = [];
    const chip = (labelKey, value, muted = false) =>
        '<span class="chip"><span class="chip-label">' + escapeHtml(t(labelKey)) + '</span>'
        + '<span class="chip-value' + (muted ? " muted" : "") + '">' + escapeHtml(value) + "</span></span>";

    chips.push(chip("info_model", deviceInfo ? deviceInfo.model : "--", !deviceInfo));
    chips.push(chip("info_sn", deviceInfo ? deviceInfo.sn : "--", !deviceInfo));
    chips.push(chip("info_fw", deviceInfo ? deviceInfo.fw : "--", !deviceInfo));
    chips.push(chip("info_hw", deviceInfo ? deviceInfo.hw : "--", !deviceInfo));
    chips.push(chip("info_temp", deviceTempC === null ? "--" : deviceTempC.toFixed(1) + " ℃", deviceTempC === null));
    chips.push(chip("info_output", outputStateName(), !deviceState));
    elInfoStrip.innerHTML = chips.join("");
}

/** 限值输入框按单位填充（尽量保持整数，便于阅读） */
function fillLimitInput(elInput, elUnit, mohm) {
    let unit = "1000";
    let div = 1000;
    if (mohm !== null && mohm % 1000000000 === 0) {
        unit = "1000000000";
        div = 1e9;
    } else if (mohm !== null && mohm % 1000000 === 0) {
        unit = "1000000";
        div = 1e6;
    }
    elUnit.value = unit;
    elInput.value = mohm === null ? "" : String(mohm / div);
}

/**
 * 限值窗口控件：连接时显示设备当前值并可写入；未连接时置灰（限值是设备端设置）。
 * 写入后由 refreshDeviceState() 回读，曲线阴影与"应用"时的校验都会跟着更新。
 */
function renderLimits() {
    if (!elChkLimitEnable) return;
    const connected = dev.isOpen();
    const state = deviceState;
    for (const el of [elChkLimitEnable, elInputMin, elUnitMin, elInputMax, elUnitMax, elBtnWriteLimits]) {
        el.disabled = !connected;
    }
    if (connected && state) {
        elChkLimitEnable.checked = !!state.limitEnable;
        fillLimitInput(elInputMin, elUnitMin, state.min);
        fillLimitInput(elInputMax, elUnitMax, state.max);
    } else {
        elChkLimitEnable.checked = false;
        elInputMin.value = "";
        elInputMax.value = "";
    }
}

/** 写入 MIN/MAX 到设备（顺序按方向选，保证任何时刻 MIN ≤ MAX） */
async function writeLimits() {
    if (!dev.isOpen()) {
        log(t("msg_limits_need_device"), "warn");
        return;
    }
    const min = parseOhmToMilli(elInputMin.value, Number(elUnitMin.value));
    const max = parseOhmToMilli(elInputMax.value, Number(elUnitMax.value));
    if (min === null || max === null) {
        log(t("msg_bad_number"), "warn");
        return;
    }
    if (min > max) {
        log(t("msg_limits_order"), "warn");
        return;
    }
    if (min < RES_MIN_MOHM || max > RES_MAX_MOHM) {
        log(tf("msg_out_of_range", formatOhm(RES_MIN_MOHM), formatOhm(RES_MAX_MOHM)), "warn");
        return;
    }
    try {
        if (deviceState && min > deviceState.max) {
            await dev.setMax(max);
            await dev.setMin(min);
        } else {
            await dev.setMin(min);
            await dev.setMax(max);
        }
        await refreshDeviceState();
        log(tf("msg_limits_written", formatOhm(min), formatOhm(max)), "ok");
    } catch (e) {
        log(e.message, "error");
    }
}

/** 启用/关闭限值：直接写设备，失败则回退勾选状态（与串口上位机同一行为） */
async function toggleLimitEnable() {
    if (!dev.isOpen()) {
        elChkLimitEnable.checked = false;
        log(t("msg_limits_need_device"), "warn");
        return;
    }
    const want = elChkLimitEnable.checked;
    elChkLimitEnable.disabled = true;
    try {
        await dev.setLimit(want);
        await refreshDeviceState();
        log(want ? t("msg_limit_enabled") : t("msg_limit_disabled"), "ok");
    } catch (e) {
        elChkLimitEnable.checked = !want;   // 设备拒绝时回退显示
        log(e.message, "error");
    } finally {
        elChkLimitEnable.disabled = !dev.isOpen();
    }
}

function outputStateName() {
    if (!deviceState) return "--";
    if (deviceState.short) return t("state_short");
    if (deviceState.open) return t("state_open");
    return t("state_normal");
}

/** 设备限值/量程校验：返回错误文案，通过则返回 null。 */
function checkAllowed(mohm) {
    if (!(mohm >= RES_MIN_MOHM && mohm <= RES_MAX_MOHM)) {
        return tf("msg_out_of_range", formatOhm(RES_MIN_MOHM), formatOhm(RES_MAX_MOHM));
    }
    if (deviceState && deviceState.limitEnable
        && (mohm < deviceState.min || mohm > deviceState.max)) {
        return tf("msg_out_of_limit", formatOhm(deviceState.min), formatOhm(deviceState.max));
    }
    return null;
}

/**
 * 计算目标阻值（并更新模拟点）。
 * @param {object} options { noApply: 只计算不下发（曲线点击 / 阻值反解用） }
 *
 * 界面上不显示任何消息：结果由大字温度颜色（红=已下发、绿=仅本地）与 SP/PV/TP 数值体现，
 * 失败原因一律写入 AT 日志。
 */
async function doCalc({ noApply = false } = {}) {
    const tC = parseTemp(elInputTemp.value);
    if (tC === null) {
        log(t("msg_bad_temp"), "warn");
        return null;
    }

    const [rangeLo, rangeHi] = currentRange();
    let clamped = false;
    let value = tC;
    if (value < rangeLo) {
        value = rangeLo;
        clamped = true;
    } else if (value > rangeHi) {
        value = rangeHi;
        clamped = true;
    }

    buildModel();
    if (!ui.model) {
        log(t("msg_no_model"), "warn");
        return null;
    }

    // 换算结果超出设备能输出的范围时，把温度夹到边界（与曲线选点同一套规则），
    // 保证模拟点始终是设备真的能输出的值
    const clampedByWindow = clampWithReason(value);
    if (clampedByWindow.reason) {
        value = clampedByWindow.tC;
        elInputTemp.value = value.toFixed(3);
        log(t(clampedByWindow.reason === "limit"
            ? "msg_temp_clamped_to_limit"
            : "msg_temp_clamped_to_range"), "warn");
    }

    let rOhm;
    try {
        rOhm = ui.model.resistance(value);
    } catch (e) {
        log(t("msg_model_invalid") + e.message, "warn");
        return null;
    }
    if (!Number.isFinite(rOhm) || rOhm <= 0) {
        log(t("msg_model_invalid") + t("msg_bad_number"), "warn");
        return null;
    }

    ui.simTempC = value;
    elInputTemp.value = value.toFixed(3);
    updateBigValue();

    // 目标阻值按整数 mΩ 下发（设备以此为单位存储），不做步进取整：
    // 设备会自行选择最接近的可达阻值，回读 PV 反映实际值。
    ui.targetMohm = Math.round(rOhm * 1000);
    ui.sendMohm = ui.targetMohm;
    renderReadouts();
    renderCurve();

    if (clamped) {
        log(t("msg_temp_clamped"), "warn");      // 只记日志，界面不出现任何文字
    }

    if (noApply) {
        return ui.sendMohm;                      // 曲线点击 / 阻值反解：只更新模拟点
    }

    if (elChkAuto.checked) {
        await applyTarget();
    }
    // 未勾选自动设置时只计算（大字温度保持绿色表示未下发）
    return ui.sendMohm;
}

/** 下发当前目标阻值（要求 3 的"一键设置"与要求 4 的步进共用）。 */
async function applyTarget() {
    buildModel();
    if (!ui.model) {
        log(t("msg_no_model"), "warn");
        return false;
    }
    if (ui.sendMohm === null) {
        log(t("msg_nothing_calculated"), "warn");
        return false;
    }

    const problem = checkAllowed(ui.sendMohm);
    if (problem) {
        log(problem, "warn");
        return false;
    }

    if (!dev.isOpen()) {
        log(t("msg_not_connected_calc_only") + " " + formatOhm(ui.sendMohm), "warn");
        return false;
    }

    try {
        await dev.setResistance(ui.sendMohm);
        ui.appliedMohm = ui.sendMohm;
        await refreshSetpoint();
        log(t("msg_applied") + " " + formatOhm(ui.sendMohm), "ok");
        return true;
    } catch (e) {
        log(e.message, "error");
        return false;
    }
}

/** 按配置的步长走一步（大按钮）：步长无效时只提示，不改动模拟点。 */
async function stepByConfigured(sign) {
    const step = parsePositive(elInputStepC.value);
    if (step === null || !(step > 0)) {
        log(t("msg_step_invalid"), "warn");
        return;
    }
    await stepBy(sign * step);
}

/** 按给定的温度增量走一步。 */
async function stepBy(deltaC) {
    if (!Number.isFinite(deltaC) || deltaC === 0) {
        log(t("msg_step_invalid"), "warn");
        return;
    }
    const [rangeLo, rangeHi] = currentRange();
    let next = ui.simTempC + deltaC;
    let clamped = false;
    if (next < rangeLo) {
        next = rangeLo;
        clamped = true;
    } else if (next > rangeHi) {
        next = rangeHi;
        clamped = true;
    }
    elInputTemp.value = next.toFixed(3);
    if (clamped) {
        // 步进被边界截断：只记日志（界面不显示任何文字）
        log(t("msg_temp_clamped"), "warn");
    }
    await doCalc();
}

/** 由阻值输入框反解温度（模型/输入无效时返回 null，不抛异常） */
function computeR2T() {
    const mohm = parseOhmToMilli(elInputR.value, Number(elUnitR.value));
    if (mohm === null || !ui.model) return null;
    try {
        const tC = ui.model.temperature(mohm / 1000);
        return Number.isFinite(tC) ? tC : null;
    } catch (e) {
        return null;
    }
}

/** 阻值 → 温度（要求 2）：只更新模拟点，不下发。 */
function fillTempFromResistance() {
    const mohm = parseOhmToMilli(elInputR.value, Number(elUnitR.value));
    if (mohm === null) {
        log(t("msg_r2t_invalid"), "warn");
        ui.r2tTempC = null;
        renderReadouts();
        return;
    }
    buildModel();
    if (!ui.model) {
        log(t("msg_no_model"), "warn");
        return;
    }
    try {
        const tC = ui.model.temperature(mohm / 1000);
        ui.r2tTempC = tC;
        elInputTemp.value = tC.toFixed(3);
        renderReadouts();
        doCalc({ noApply: true });   // 只更新模拟点，不下发
    } catch (e) {
        ui.r2tTempC = null;
        renderReadouts();
        log(t("msg_r2t_failed") + e.message, "warn");
    }
}

// ------------------------------------------------------------------
// CSV 导入
// ------------------------------------------------------------------

/** 解析 CSV 文本 -> [[tC, rOhm], ...]，容忍分隔符/注释/表头。 */
function parseCsvPoints(text) {
    const points = [];
    const lines = String(text).split(/\r?\n/);
    const splitter = (line) => {
        if (line.includes(";")) return line.split(";");
        if (line.includes("\t")) return line.split("\t");
        return line.split(",");
    };
    for (const raw of lines) {
        const line = raw.trim();
        if (line === "" || line.startsWith("#")) continue;
        const parts = splitter(line).map(part => part.trim());
        if (parts.length < 2) continue;
        const tC = parseTemp(parts[0]);
        const rOhm = parsePositive(parts[1]);
        if (tC === null || rOhm === null || !(rOhm > 0)) continue;   // 表头等非数据行
        points.push([tC, rOhm]);
    }
    return points;
}

function loadCsvText(text, name) {
    let points;
    try {
        points = parseCsvPoints(text);
    } catch (e) {
        log(tf("csv_failed", e.message), "warn");
        return;
    }
    if (points.length < 2) {
        log(t("csv_no_points"), "warn");
        return;
    }
    ui.csvPoints = points;
    ui.csvName = name || "";
    ui.r2tTempC = null;
    renderCsvSummary();
    buildModel();
    renderReadouts();
    renderCurve();
    log(tf("csv_loaded", points.length,
        points[0][0].toFixed(2), points[points.length - 1][0].toFixed(2)), "ok");
}

function renderCsvSummary() {
    if (!elCsvSummary) return;
    if (!ui.csvPoints) {
        elCsvSummary.textContent = "";
        return;
    }
    const list = ui.csvPoints;
    elCsvSummary.textContent = tf("csv_loaded", list.length,
        list[0][0].toFixed(2), list[list.length - 1][0].toFixed(2))
        + (ui.csvName ? "\n" + ui.csvName : "")
        + "\n" + list.slice(0, 4).map(([tC, r]) => tC.toFixed(2) + " ℃  " + formatOhm(r * 1000)).join("\n")
        + (list.length > 4 ? "\n…" : "");
}

async function handleCsvFile(file) {
    if (!file) return;
    try {
        const text = await file.text();
        loadCsvText(text, file.name);
    } catch (e) {
        log(tf("csv_failed", e.message), "warn");
    }
}

// ------------------------------------------------------------------
// 连接
// ------------------------------------------------------------------

function setConnected(connected) {
    if (connected) {
        elStatus.textContent = t("status_connected");
        elStatus.classList.add("connected");
    } else {
        elStatus.textContent = t("status_disconnected");
        elStatus.classList.remove("connected");
    }
    document.getElementById("btnConnect").disabled = connected || connecting;
    document.getElementById("btnDisconnect").disabled = !connected;
    if (!connected) {
        deviceInfo = null;
        deviceState = null;
        deviceTempC = null;
        ui.appliedMohm = null;
        if (tempTimer) {
            clearInterval(tempTimer);
            tempTimer = 0;
        }
    }
    renderInfoStrip();
    renderReadouts();
    renderLimits();
    renderCurve();
}

async function refreshDeviceInfo() {
    deviceInfo = await dev.readInfo();
    renderInfoStrip();
}

async function refreshDeviceState() {
    deviceState = await dev.readState();
    renderInfoStrip();
    renderReadouts();
    renderCurve();
}

/**
 * 改变输出后只回读设定值/实际估测，其余状态（限值等）保持不变。
 * 设备语义（已在实机验证）：成功设置阻值会把输出从开路/短路切回正常，
 * 因此这里顺带把 open/short 标记清掉，不必再读两条命令。
 */
async function refreshSetpoint() {
    if (!deviceState) {
        await refreshDeviceState();
        return;
    }
    const patch = await dev.readSetpoint();
    deviceState = { ...deviceState, ...patch, open: false, short: false };
    renderInfoStrip();
    renderReadouts();
    renderCurve();
}

async function refreshDeviceTemp() {
    try {
        deviceTempC = await dev.readTemperatureC();
        renderInfoStrip();
    } catch (e) {
        /* 读取失败（例如设备忙）不打扰用户，下一轮再试 */
    }
}

async function connectDevice() {
    if (connecting) return;
    connecting = true;
    document.getElementById("btnConnect").disabled = true;
    log(t("log_connecting"));
    elStatus.textContent = t("status_connecting");
    try {
        await dev.connect();
        await dev.ping();
        const protocol = parseInt(await dev.query("AT+SYS.PROT?", "SYS.PROT"), 10);
        if (protocol !== 0) {
            throw new Error(t("err_device_wrong_mode"));
        }
        log(t("log_connected"), "ok");
        await refreshDeviceInfo();
        await refreshDeviceState();
        await refreshDeviceTemp();
        if (!tempTimer) {
            tempTimer = setInterval(refreshDeviceTemp, TEMP_POLL_MS);
        }
        await checkFirmwareVersion();

        // 设定值不落 flash（上电/重连后设备处于开路、默认 5 Ω）：按自动设置状态补发
        if (elChkAuto.checked && ui.sendMohm !== null) {
            await applyTarget();
        }
    } catch (e) {
        log(e.message, "error");
        try {
            await dev.disconnect();
        } catch (inner) {
            /* ignore */
        }
    } finally {
        connecting = false;
        setConnected(dev.isOpen());
    }
}

async function disconnectDevice() {
    try {
        await dev.disconnect();
    } finally {
        log(t("log_disconnected"));
        setConnected(false);
    }
}

// ------------------------------------------------------------------
// 事件绑定
// ------------------------------------------------------------------

function bindEvents() {
    document.getElementById("themeToggle").addEventListener("click", toggleTheme);
    document.getElementById("langToggle").addEventListener("click", toggleLang);
    document.getElementById("btnConnect").addEventListener("click", connectDevice);
    document.getElementById("btnDisconnect").addEventListener("click", disconnectDevice);

    // 模型模式切换（三选一，只显示一种）
    elModelTabs.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-mode]");
        if (!button) return;
        ui.mode = button.dataset.mode;
        elModelTabs.querySelectorAll("button").forEach(btn =>
            btn.classList.toggle("active", btn === button));
        elPanelBeta.hidden = ui.mode !== "beta";
        elPanelSh.hidden = ui.mode !== "sh";
        elPanelCsv.hidden = ui.mode !== "csv";
        buildModel();
        renderCurve();
    });

    // B 值法子方式（三选一）
    elBetaTabs.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-sub]");
        if (!button) return;
        ui.betaSub = button.dataset.sub;
        elBetaTabs.querySelectorAll("button").forEach(btn =>
            btn.classList.toggle("active", btn === button));
        elBetaDirect.hidden = ui.betaSub !== "direct";
        elBetaTwo.hidden = ui.betaSub !== "two";
        elBetaLsq.hidden = ui.betaSub !== "lsq";
        buildModel();
        renderCurve();
    });

    // SH 子方式（直填系数 / 标定点拟合）
    elShTabs.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-sub]");
        if (!button) return;
        ui.shSub = button.dataset.sub;
        elShTabs.querySelectorAll("button").forEach(btn =>
            btn.classList.toggle("active", btn === button));
        elShDirect.hidden = ui.shSub !== "direct";
        elShPoints.hidden = ui.shSub !== "points";
        buildModel();
        renderCurve();
    });

    // 手填 SH 系数
    for (const id of ["inShA", "inShB", "inShC"]) {
        document.getElementById(id).addEventListener("input", () => {
            if (ui.mode === "sh") {
                buildModel();
                renderCurve();
            }
        });
    }

    // CSV 子模式（插值 / 转 SH 拟合）
    elCsvTabs.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-sub]");
        if (!button) return;
        ui.csvSub = button.dataset.sub;
        elCsvTabs.querySelectorAll("button").forEach(btn =>
            btn.classList.toggle("active", btn === button));
        buildModel();
        renderCurve();
    });

    // B 值法参数变化
    for (const id of ["inR25", "inBeta", "inT1", "inR1", "inT2", "inR2"]) {
        document.getElementById(id).addEventListener("input", () => {
            if (ui.mode === "beta") {
                buildModel();
                renderCurve();
            }
        });
    }

    // 标定点表：SH 与 B 值法多点拟合共用组件
    renderPointsTable(elShPointsTable, ui.shPoints, {
        minRows: 3,
        onChange: () => {
            buildModel();
            renderCurve();
        },
    });
    renderPointsTable(elBetaPoints, ui.betaPoints, {
        minRows: 2,
        onChange: () => {
            buildModel();
            renderCurve();
        },
    });

    // CSV
    document.getElementById("btnCsvPick").addEventListener("click", () => elCsvFile.click());
    elCsvFile.addEventListener("change", () => {
        if (elCsvFile.files && elCsvFile.files[0]) handleCsvFile(elCsvFile.files[0]);
    });
    elCsvDrop.addEventListener("dragover", (event) => {
        event.preventDefault();
        elCsvDrop.classList.add("dragover");
    });
    elCsvDrop.addEventListener("dragleave", () => elCsvDrop.classList.remove("dragover"));
    elCsvDrop.addEventListener("drop", (event) => {
        event.preventDefault();
        elCsvDrop.classList.remove("dragover");
        const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
        if (file) handleCsvFile(file);
    });

    // 控制台
    document.getElementById("btnCalc").addEventListener("click", () => doCalc());
    document.getElementById("btnApply").addEventListener("click", () => applyTarget());
    elInputTemp.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            doCalc();
        }
    });
    document.getElementById("btnStepDown").addEventListener("click", () => stepByConfigured(-1));
    document.getElementById("btnStepUp").addEventListener("click", () => stepByConfigured(1));
    document.getElementById("btnFillTemp").addEventListener("click", fillTempFromResistance);
    elInputR.addEventListener("input", () => {
        // 输入阻值时实时给出反解温度（只显示，不改模拟点）
        ui.r2tTempC = computeR2T();
        renderReadouts();
    });
    elUnitR.addEventListener("change", () => {
        elInputR.dispatchEvent(new Event("input"));
    });

    elChkAuto.addEventListener("change", () => {
        localStorage.setItem(LS_AUTO_APPLY, elChkAuto.checked ? "1" : "0");
        log(elChkAuto.checked ? t("log_auto_apply_on") : t("log_auto_apply_off"));
    });

    // 设备限值窗口
    elChkLimitEnable.addEventListener("change", toggleLimitEnable);
    elBtnWriteLimits.addEventListener("click", writeLimits);
    for (const el of [elInputMin, elInputMax]) {
        el.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                event.preventDefault();
                writeLimits();
            }
        });
    }

    // 曲线范围与坐标轴
    for (const el of [elRangeMin, elRangeMax]) {
        el.addEventListener("input", () => {
            buildModel();
            renderCurve();
        });
    }
    elChkLogAxis.addEventListener("change", renderCurve);
    elChkCurveApply.addEventListener("change", () => {
        localStorage.setItem(LS_CURVE_APPLY, elChkCurveApply.checked ? "1" : "0");
        log(elChkCurveApply.checked ? t("log_curve_apply_on") : t("log_curve_apply_off"));
    });

    // 日志抽屉
    elLogToggle.addEventListener("click", () => {
        const show = elLogBody.hidden;
        elLogBody.hidden = !show;
        elLogToggleIcon.textContent = show ? "▾" : "▸";
    });
    document.getElementById("btnClearLog").addEventListener("click", () => {
        elLog.textContent = "";
        logLines = 0;
        elLogCount.textContent = "";
    });

    // 固件提示框：重新检测
    document.getElementById("fwModalRecheck").addEventListener("click", async () => {
        if (!dev.isOpen()) {
            elFwModalStatus.textContent = dfuRequested
                ? t("fw_recheck_in_dfu") : t("fw_recheck_disconnected");
            return;
        }
        elFwModalStatus.textContent = "";
        try {
            deviceInfo = await dev.readInfo();
            renderInfoStrip();
            await checkFirmwareVersion();
        } catch (e) {
            elFwModalStatus.textContent = e.message;
        }
    });

    // 尺寸变化时重绘曲线（去抖）。ResizeObserver 覆盖"卡片被等高拉伸"这类变化，
    // 只在尺寸真的变了时重绘，避免布局回环。
    let resizeTimer = 0;
    window.addEventListener("resize", () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(renderCurve, 120);
    });
    if (typeof ResizeObserver !== "undefined") {
        let lastSize = "";
        const observer = new ResizeObserver(() => {
            const size = elCurveWrap.clientWidth + "x" + elCurveWrap.clientHeight;
            if (size === lastSize) return;
            lastSize = size;
            renderCurve();
        });
        observer.observe(elCurveWrap);
    }
}

// ------------------------------------------------------------------
// 初始化
// ------------------------------------------------------------------

function init() {
    initTheme();

    elChkAuto.checked = localStorage.getItem(LS_AUTO_APPLY) !== "0";
    elChkCurveApply.checked = localStorage.getItem(LS_CURVE_APPLY) === "1";   // 默认不勾选
    elModelTabs.querySelector('button[data-mode="beta"]').classList.add("active");
    elBetaTabs.querySelector('button[data-sub="direct"]').classList.add("active");
    elShTabs.querySelector('button[data-sub="direct"]').classList.add("active");
    elCsvTabs.querySelector('button[data-sub="interp"]').classList.add("active");

    dev.onDisconnect = () => {
        setConnected(false);
        log(t("log_disconnected"), "error");
    };

    bindEvents();
    initLang();          // 内部会重绘标定点表/摘要/曲线

    buildModel();
    ui.simTempC = parseTemp(elInputTemp.value) ?? 25;
    updateBigValue();
    doCalc({ noApply: true });

    if (!navigator.serial) {
        log(t("log_unsupported"), "warn");
    } else {
        log(t("log_ready"));
    }
    loadLatestVersion();
}

init();
