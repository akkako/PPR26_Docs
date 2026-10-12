#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""PPR26 SCPI 指令的 Python 封装（上位机脚本库）。

对应 PPR26 的 SCPI 指令集（完整指令表见在线文档「SCPI 命令参考」）。
所有阻值单位统一为 **mΩ（毫欧）整数**。

依赖 ``pyvisa``，以及一个 VISA 后端（NI-VISA，或纯 Python 的 ``pyvisa-py``）::

    pip install pyvisa pyvisa-py

基本用法::

    from ppr26_scpi import PPR26_SCPI, PPR26Error

    with PPR26_SCPI() as dev:                     # 不传资源名时自动查找
        print(dev.get_idn())
        dev.set_resistance(523000)                # 523000 mΩ = 523 Ω
        print(dev.get_resistance(), "mΩ", dev.get_output())
        dev.set_output("NORM")                    # NORM / SHOR / OPEN

约定与错误处理：
  * SCPI 查询直接返回数据本身；
  * 温度类查询返回**带引号的字符串**（摄氏度），本库已转换为 ``float``；
  * 设备不主动上报错误，需读取错误队列 ``SYST:ERR?``；``write_checked()``
    在写入后自动读取一次错误队列，非 ``0`` 时抛 :class:`PPR26CommandError`；
  * 连接/通信失败抛 :class:`PPR26ScpiError`，超时抛 :class:`PPR26TimeoutError`；
  * 以上均继承 :class:`PPR26Error`，便于统一 ``except``。
"""

import warnings

try:
    import pyvisa
except ImportError as exc:  # pragma: no cover
    raise ImportError("pyvisa is required: pip install pyvisa") from exc


# --------------------------------------------------------------------------- #
# 异常
# --------------------------------------------------------------------------- #
class PPR26Error(Exception):
    """PPR26 相关错误基类。"""


class PPR26ScpiError(PPR26Error):
    """VISA 连接 / 通信失败。"""


class PPR26TimeoutError(PPR26Error):
    """等待响应超时。"""


class PPR26CommandError(PPR26Error):
    """设备错误队列返回非 0 错误码。"""

    def __init__(self, code, message, command=None):
        self.code = code
        self.message = message
        self.command = command
        text = "{} -> error {}: {}".format(command, code, message) if command \
            else "error {}: {}".format(code, message)
        super(PPR26CommandError, self).__init__(text)


class PPR26ResponseError(PPR26Error):
    """响应格式不符合预期。"""


# --------------------------------------------------------------------------- #
# 常量
# --------------------------------------------------------------------------- #
RES_MIN_MOHM = 5000            # 5 Ω
RES_MAX_MOHM = 4000000000      # 4 MΩ
CALI_GEAR_MIN = 0
CALI_GEAR_MAX = 27             # 0..25 单路 / 26 串联短路 / 27 直接短路

CALI_SET_USER = "USER"
CALI_SET_FACTORY = "FACT"

COMP_UNCAL = "UNCAL"
COMP_NEAR = "NEAR"
COMP_PREC = "PREC"
COMP_MODES = (COMP_UNCAL, COMP_NEAR, COMP_PREC)
#: 命令参数与查询返回值都接受（``SYST:COMP?`` 返回 PRECISE / NEARBY）
COMP_ALIASES = {
    "UNCAL": COMP_UNCAL, "UNCALIBRATED": COMP_UNCAL,
    "NEAR": COMP_NEAR, "NEARBY": COMP_NEAR,
    "PREC": COMP_PREC, "PRECISE": COMP_PREC,
}
COMP_CODES = {"UNCAL": 0, "NEARBY": 1, "PRECISE": 2}

OUTPUT_MODES = ("NORM", "SHOR", "OPEN")
PROTOCOL_AT = "AT"
PROTOCOL_SCPI = "SCPI"

VID_PPR26 = 0xFFFE
PID_PPR26_SCPI = 0xFFFF


def _check_range(name, value, lo, hi):
    if not isinstance(value, int):
        raise ValueError("{} must be an integer (mOhm)".format(name))
    if value < lo or value > hi:
        raise ValueError(
            "{} out of range: {} not in [{}, {}]".format(name, value, lo, hi)
        )
    return value


def _check_choice(name, value, choices):
    text = str(value)
    for choice in choices:
        if text.upper() == choice:
            return choice
    raise ValueError("{} must be one of {}".format(name, ", ".join(choices)))


def _quote(text):
    """SCPI 字符串参数：必须用双引号包裹。"""
    if not isinstance(text, str):
        raise ValueError("string parameter must be a str")
    return '"{}"'.format(text.replace('"', '""'))


def _unquote(text):
    text = text.strip()
    if len(text) >= 2 and text[0] == '"' and text[-1] == '"':
        return text[1:-1].replace('""', '"')
    return text


def _match_resource(resources):
    """在资源列表里挑出 PPR26（兼容十六进制与十进制 VID:PID 两种写法）。"""
    for resource in resources:
        upper = resource.upper()
        hex_match = ("0XFFFE" in upper and "0XFFFF" in upper)
        dec_match = ("::{}::".format(VID_PPR26) in resource
                     and "::{}::".format(PID_PPR26_SCPI) in resource)
        if hex_match or dec_match:
            return resource
    return None


def find_ppr26(backend="@ivi"):
    """按 VID:PID 自动查找 PPR26 的 VISA 资源名。

    先让指定后端列出资源；若它没有列出 USB 设备（部分 NI-VISA 安装不枚举 USB TMC
    设备，但按资源名仍可打开），再用纯 Python 的 ``@py`` 后端做一次发现。
    十六进制（``USB0::0xFFFE::0xFFFF::...``）与十进制（``USB0::65534::65535::...``）
    两种写法都能被 NI-VISA 打开。
    """
    errors = []
    for probe in (backend, "@py"):
        if probe is None:
            continue
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")   # 忽略后端发现阶段的告警
                manager = pyvisa.ResourceManager(probe)
                resources = manager.list_resources()
        except Exception as exc:  # pragma: no cover - 取决于本机 VISA 安装
            errors.append("{}: {}".format(probe, exc))
            continue
        found = _match_resource(resources)
        if found:
            return found
        if probe == backend:
            errors.append("{}: 未列出 PPR26".format(probe))
    raise PPR26ScpiError(
        "未找到 PPR26，请确认设备处于 SCPI（USB TMC）模式"
        + ("（{}）".format("；".join(errors)) if errors else "")
    )


# --------------------------------------------------------------------------- #
# 主类
# --------------------------------------------------------------------------- #
class PPR26_SCPI:
    """PPR26 SCPI 封装（USB TMC）。阻值单位一律 mΩ。"""

    def __init__(self, resource=None, timeout=2.0, backend="@ivi"):
        """``resource`` 为空时按 VID:PID 自动查找；``timeout`` 单位秒。"""
        self.backend = backend
        self.resource = resource
        self.timeout = float(timeout)
        self.inst = None
        self.manager = None

    # ---------------------------------------------------------------- 连接 --
    def open(self, resource=None, timeout=None):
        """打开 VISA 资源（未指定资源名时自动查找）。

        失败抛 :class:`PPR26ScpiError`。
        """
        if self.inst is not None:
            return self
        if resource is not None:
            self.resource = resource
        if timeout is not None:
            self.timeout = float(timeout)
        if not self.resource:
            self.resource = find_ppr26(self.backend)

        try:
            self.manager = pyvisa.ResourceManager(self.backend)
            self.inst = self.manager.open_resource(self.resource)
            self.inst.timeout = int(self.timeout * 1000)
            self.inst.write_termination = "\n"
            self.inst.read_termination = "\n"
        except PPR26Error:
            raise
        except Exception as exc:
            self.inst = None
            raise PPR26ScpiError(
                "cannot open VISA resource {}: {}".format(self.resource, exc)
            ) from exc
        return self

    def close(self):
        """关闭 VISA 会话（幂等）。"""
        inst, self.inst = self.inst, None
        manager, self.manager = self.manager, None
        if inst is not None:
            try:
                inst.close()
            except Exception:
                pass
        if manager is not None:
            try:
                manager.close()
            except Exception:
                pass

    def __enter__(self):
        return self.open()

    def __exit__(self, exc_type, exc, tb):
        self.close()
        return False

    def _require_open(self):
        if self.inst is None:
            raise PPR26ScpiError("VISA resource is not open")

    # ------------------------------------------------------------ 底层收发 --
    def write(self, command):
        """写入一条命令（不读取响应）。"""
        self._require_open()
        try:
            self.inst.write(command)
        except Exception as exc:
            self._raise_io(command, exc)
        return True

    def query(self, command):
        """发送查询并返回字符串结果（自动去掉引号与首尾空白）。"""
        self._require_open()
        try:
            return _unquote(self.inst.query(command))
        except Exception as exc:
            self._raise_io(command, exc)

    def _raise_io(self, command, exc):
        name = getattr(exc, "abbreviation", "") or type(exc).__name__
        if "TMO" in str(name).upper() or "TIMEOUT" in str(name).upper():
            raise PPR26TimeoutError(
                "timeout waiting response of {}".format(command)
            ) from exc
        raise PPR26ScpiError("{} -> {}".format(command, exc)) from exc

    def _query_int(self, command):
        raw = self.query(command)
        try:
            return int(raw, 0)
        except ValueError as exc:
            raise PPR26ResponseError(
                "{} -> invalid response: {!r}".format(command, raw)
            ) from exc

    def _query_float(self, command):
        raw = self.query(command)
        try:
            return float(raw)
        except ValueError as exc:
            raise PPR26ResponseError(
                "{} -> invalid response: {!r}".format(command, raw)
            ) from exc

    def _write_bool_checked(self, command, enable, name):
        if isinstance(enable, bool):
            value = 1 if enable else 0
        elif enable in (0, 1):
            value = int(enable)
        else:
            raise ValueError("{} must be 0/1 or bool".format(name))
        return self.write_checked("{} {}".format(command, value))

    # ------------------------------------------------------------ 错误队列 --
    def error(self):
        """弹出并返回错误队列中最早的一条，返回 ``(code, message)``。"""
        raw = self.query("SYST:ERR?")
        code_text, _, message = raw.partition(",")
        try:
            code = int(code_text.strip(), 0)
        except ValueError as exc:
            raise PPR26ResponseError(
                "SYST:ERR? -> invalid response: {!r}".format(raw)
            ) from exc
        return code, _unquote(message)

    def error_count(self):
        """错误队列中的错误个数。"""
        return self._query_int("SYST:ERR:COUN?")

    def check_error(self, command=None):
        """读取错误队列，非 0 时抛 :class:`PPR26CommandError`。"""
        code, message = self.error()
        if code != 0:
            raise PPR26CommandError(code, message, command)
        return True

    def write_checked(self, command):
        """写入命令并立即检查错误队列。"""
        self.write(command)
        return self.check_error(command)

    # ------------------------------------------------------------ 设备信息 --
    def get_idn(self):
        """``*IDN?`` 识别查询。"""
        return self.query("*IDN?")

    def get_model(self):
        """型号（``PPR26``）。"""
        return self.query("SYST:INFO:MOD?")

    def get_serial_number(self):
        """序列号（24 个大写十六进制字符）。"""
        return self.query("SYST:INFO:SN?")

    def get_manufacture_date(self):
        """生产日期（``YY-WW``，如 ``26-09``）。"""
        return self.query("SYST:INFO:MAN?")

    def get_hardware_version(self):
        """硬件版本（``0``-``6``）。"""
        return self.query("SYST:INFO:HVER?")

    def get_firmware_version(self):
        """固件版本字符串。"""
        return self.query("SYST:INFO:FVER?")

    def get_power_on_count(self):
        """上电次数。"""
        return self._query_int("SYST:INFO:POW?")

    def get_uptime_minutes(self):
        """累计通电时间（分钟）。"""
        return self._query_int("SYST:INFO:TIME?")

    # ---------------------------------------------------------------- 温度 --
    def get_temperature(self):
        """当前温度（℃，``float``）。"""
        return self._query_float("SYST:TEMP?")

    def get_temperature_average(self):
        """平均温度（℃）。"""
        return self._query_float("SYST:TEMP:AVER?")

    def get_temperature_minimum(self):
        """最低温度（℃）。"""
        return self._query_float("SYST:TEMP:MIN?")

    def get_temperature_maximum(self):
        """最高温度（℃）。"""
        return self._query_float("SYST:TEMP:MAX?")

    def clear_temperature_stats(self):
        """清空温度统计。"""
        return self.write_checked("SYST:TEMP:RES")

    # ------------------------------------------------------------ 状态寄存器 --
    def get_operation_status(self):
        """操作状态事件寄存器。"""
        return self._query_int("STAT:OPER?")

    def get_operation_condition(self):
        """操作状态条件寄存器。"""
        return self._query_int("STAT:OPER:COND?")

    def set_operation_enable(self, value):
        """操作状态使能寄存器。"""
        return self.write_checked("STAT:OPER:ENAB {}".format(int(value)))

    def get_operation_enable(self):
        return self._query_int("STAT:OPER:ENAB?")

    def get_questionable_status(self):
        """可疑状态事件寄存器。"""
        return self._query_int("STAT:QUES?")

    def get_questionable_condition(self):
        """可疑状态条件寄存器。"""
        return self._query_int("STAT:QUES:COND?")

    def set_questionable_enable(self, value):
        """可疑状态使能寄存器。"""
        return self.write_checked("STAT:QUES:ENAB {}".format(int(value)))

    def get_questionable_enable(self):
        return self._query_int("STAT:QUES:ENAB?")

    def preset_status(self):
        """状态预置（``STAT:PRES``）。"""
        return self.write_checked("STAT:PRES")

    def get_status_byte(self):
        """``*STB?`` 状态字节。"""
        return self._query_int("*STB?")

    def clear_status(self):
        """``*CLS`` 清除状态。"""
        return self.write_checked("*CLS")

    def self_test(self):
        """``*TST?`` 自检，返回结果码（0 = 通过）。"""
        return self._query_int("*TST?")

    def wait(self):
        """``*WAI`` 等待操作完成。"""
        return self.write_checked("*WAI")

    def operation_complete(self):
        """``*OPC?`` 等待并确认操作完成。"""
        return self._query_int("*OPC?")

    def reset(self):
        """``*RST`` 恢复配置区默认值（协议、数据集选择与上电统计不变）。"""
        return self.write_checked("*RST")

    def save(self):
        """``*SAV`` 保存可保存的设置（不含设定阻值与输出状态）。"""
        return self.write_checked("*SAV")

    # ------------------------------------------------------------ 阻值输出 --
    def set_resistance(self, mohm):
        """设定输出阻值（mΩ）。越界/超出限值时返回错误。"""
        _check_range("resistance", int(mohm), RES_MIN_MOHM, RES_MAX_MOHM)
        return self.write_checked("RES {}".format(int(mohm)))

    def get_resistance(self):
        """查询设定阻值（mΩ）。"""
        return self._query_int("RES?")

    def resistance_min(self):
        """设定值取最小档（``RES MIN``）。"""
        return self.write_checked("RES MIN")

    def resistance_max(self):
        """设定值取最大档（``RES MAX``）。"""
        return self.write_checked("RES MAX")

    def resistance_up(self):
        """设定值 + 步进值（``RES UP``）。"""
        return self.write_checked("RES UP")

    def resistance_down(self):
        """设定值 − 步进值（``RES DOWN``）。"""
        return self.write_checked("RES DOWN")

    def set_step(self, mohm):
        """设定步进值（mΩ，非负）。"""
        value = int(mohm)
        if value < 0:
            raise ValueError("step must not be negative")
        return self.write_checked("RES:STEP {}".format(value))

    def get_step(self):
        """查询步进值（mΩ）。"""
        return self._query_int("RES:STEP?")

    def set_min_limit(self, mohm):
        """设定最小阻值限制（mΩ）。"""
        _check_range("min_limit", int(mohm), RES_MIN_MOHM, RES_MAX_MOHM)
        return self.write_checked("RES:LIM:MIN {}".format(int(mohm)))

    def get_min_limit(self):
        """查询最小阻值限制（mΩ）。"""
        return self._query_int("RES:LIM:MIN?")

    def set_max_limit(self, mohm):
        """设定最大阻值限制（mΩ）。"""
        _check_range("max_limit", int(mohm), RES_MIN_MOHM, RES_MAX_MOHM)
        return self.write_checked("RES:LIM:MAX {}".format(int(mohm)))

    def get_max_limit(self):
        """查询最大阻值限制（mΩ）。"""
        return self._query_int("RES:LIM:MAX?")

    def set_limit_enable(self, enable):
        """阻值限值使能 0/1（会被保存）。"""
        return self._write_bool_checked("RES:LIM:STAT", enable, "limit_enable")

    def get_limit_enable(self):
        """查询限值使能（0/1）。"""
        return self._query_int("RES:LIM:STAT?")

    def set_network(self, mask):
        """直接设置继电器网络位图（0 .. 2^26-1），更新设定值；不写入存储。"""
        value = int(mask)
        if value < 0 or value >= (1 << 26):
            raise ValueError("network mask must be in [0, 2^26)")
        return self.write_checked("RES:NETW {}".format(value))

    def get_network(self):
        """查询当前继电器网络位图。"""
        return self._query_int("RES:NETW?")

    def set_output(self, mode):
        """输出状态：``NORM``（设定阻值）/ ``SHOR``（短路）/ ``OPEN``（开路）。"""
        mode = _check_choice("output", mode, OUTPUT_MODES)
        return self.write_checked("OUTP {}".format(mode))

    def get_output(self):
        """查询输出状态（``NORM`` / ``SHOR`` / ``OPEN``）。"""
        return self.query("OUTP?").upper()

    def set_normal(self):
        """输出设定阻值。"""
        return self.set_output("NORM")

    def set_short(self):
        """输出短路。"""
        return self.set_output("SHOR")

    def set_open(self):
        """输出开路。"""
        return self.set_output("OPEN")

    # ------------------------------------------------------------ 补偿模式 --
    def set_compensation(self, mode):
        """补偿模式：``UNCAL`` / ``NEAR`` / ``PREC``（也可传 0/1/2）。

        参数接受 ``SYST:COMP?`` 的返回值（``UNCAL`` / ``NEARBY`` / ``PRECISE``），
        因此 ``dev.set_compensation(dev.get_compensation())`` 可直接写回。
        修改后**下次设置阻值时生效**，设置会被保存。
        """
        if isinstance(mode, int) and not isinstance(mode, bool):
            if mode < 0 or mode > 2:
                raise ValueError("compensation must be 0/1/2")
            mode = COMP_MODES[mode]
        text = str(mode).strip().upper()
        if text not in COMP_ALIASES:
            raise ValueError(
                "compensation must be one of {}, 0/1/2".format(", ".join(COMP_MODES))
            )
        return self.write_checked("SYST:COMP {}".format(COMP_ALIASES[text]))

    def get_compensation(self):
        """查询补偿模式（``UNCAL`` / ``NEARBY`` / ``PRECISE``）。"""
        return self.query("SYST:COMP?").upper()

    def get_compensation_code(self):
        """查询补偿模式并转换为 0/1/2。"""
        text = self.get_compensation()
        if text not in COMP_CODES:
            raise PPR26ResponseError(
                "SYST:COMP? -> invalid response: {!r}".format(text)
            )
        return COMP_CODES[text]

    # ------------------------------------------------------- 协议与 DFU --
    def get_protocol(self):
        """查询通信协议（``AT`` / ``SCPI``）。"""
        return self.query("SYST:PROT?").upper()

    def set_protocol(self, protocol):
        """切换通信协议（``AT`` / ``SCPI``）。设备随后断开并重新枚举。"""
        protocol = _check_choice("protocol", protocol, (PROTOCOL_AT, PROTOCOL_SCPI))
        try:
            self.write("SYST:PROT {}".format(protocol))
        except PPR26Error:
            # 设备可能来不及回包就断开，忽略
            pass
        self.close()
        return True

    def enter_dfu(self):
        """进入 DFU（固件升级）模式：设备断开 USB 并重启为 DFU 设备。

        应以设备是否重新枚举为 DFU（VID:PID ``0xFFFE:0xFFFD``）作为成功判据。
        """
        try:
            self.write("SYST:DFU")
        except PPR26Error:
            pass
        self.close()
        return True

    # ====================================================================== #
    # 校准 (CAL:*)
    # ====================================================================== #
    def cali_select(self, dataset):
        """选择校准数据集：``USER`` / ``FACT``。"""
        dataset = _check_choice("dataset", dataset, (CALI_SET_USER, CALI_SET_FACTORY))
        return self.write_checked("CAL:SEL {}".format(dataset))

    def get_cali_selected(self):
        """查询当前校准数据集（``USER`` / ``FACTORY``）。"""
        return self.query("CAL:SEL?").upper()

    def cali_enable(self, enable):
        """校准使能 0/1（写校准数据的前置条件）。"""
        return self._write_bool_checked("CAL:ENAB", enable, "cali_enable")

    def get_cali_enable(self):
        """查询校准使能（0/1）。"""
        return self._query_int("CAL:ENAB?")

    def cali_set_user_password(self, password):
        """设置用户校准密码（空字符串 ``""`` 表示不锁）。"""
        return self.write_checked("CAL:USER:PASS {}".format(_quote(password)))

    def cali_user_password_set(self):
        """查询用户密码是否已设置（0/1，不返回明文）。"""
        return self._query_int("CAL:USER:PASS?")

    def cali_unlock(self, password):
        """解锁用户校准数据集。"""
        return self.write_checked("CAL:USER:UNL {}".format(_quote(password)))

    def cali_lock(self, enable):
        """锁定/解锁用户数据集（0=解锁 1=锁定）。"""
        return self._write_bool_checked("CAL:USER:LOCK", enable, "cali_lock")

    def get_cali_locked(self):
        """查询用户数据集锁定状态（0/1）。"""
        return self._query_int("CAL:USER:LOCK?")

    def cali_gear(self, gear):
        """设置校准档位 0..27（并应用对应继电器）。"""
        if not isinstance(gear, int) or gear < CALI_GEAR_MIN or gear > CALI_GEAR_MAX:
            raise ValueError("gear must be {}..{}".format(CALI_GEAR_MIN, CALI_GEAR_MAX))
        return self.write_checked("CAL:USER:GEAR {}".format(gear))

    def get_cali_gear(self):
        """查询当前校准档位（0..27）。"""
        return self._query_int("CAL:USER:GEAR?")

    def cali_set_value(self, mohm):
        """写入当前档位的校准阻值（mΩ）。需已使能且未锁定。"""
        value = int(mohm)
        if value < 0:
            raise ValueError("cali value must not be negative")
        return self.write_checked("CAL:USER:VAL {}".format(value))

    def get_cali_value(self):
        """查询当前档位的校准阻值（mΩ）。"""
        return self._query_int("CAL:USER:VAL?")

    def get_cali_count(self):
        """校准次数（每次 ``CAL:USER:SAVE`` 加 1）。"""
        return self._query_int("CAL:USER:COUN?")

    def cali_set_date(self, date):
        """设置校准日期字符串（≤64 字节）。"""
        return self.write_checked("CAL:USER:DATE {}".format(_quote(date)))

    def get_cali_date(self):
        """查询校准日期字符串。"""
        return self.query("CAL:USER:DATE?")

    def cali_set_string(self, text):
        """设置校准备注字符串（≤64 字节）。"""
        return self.write_checked("CAL:USER:STR {}".format(_quote(text)))

    def get_cali_string(self):
        """查询校准备注字符串。"""
        return self.query("CAL:USER:STR?")

    def get_cali_temperature(self):
        """查询最近一次保存校准数据时记录的温度（℃）。"""
        return self._query_float("CAL:USER:TEMP?")

    def cali_save(self):
        """保存校准数据（次数加 1）。"""
        return self.write_checked("CAL:USER:SAVE")


# --------------------------------------------------------------------------- #
# 命令行用法：python ppr26_scpi.py [-r "USB0::0xFFFE::0xFFFF::<SN>::0::INSTR"]
# --------------------------------------------------------------------------- #
def _show(label, value, width=20):
    print("  {:<{width}}: {}".format(label, value, width=width))


def _main(argv=None):
    import argparse
    import sys

    if hasattr(sys.stdout, "reconfigure"):   # 控制台编码不支持时避免抛异常
        sys.stdout.reconfigure(errors="replace")

    parser = argparse.ArgumentParser(
        description="读取 PPR26 设备信息与输出状态（SCPI 模式，只读）")
    parser.add_argument("-r", "--resource", default=None,
                        help="VISA 资源名（默认按 VID:PID 0xFFFE:0xFFFF 自动查找）")
    parser.add_argument("-b", "--backend", default="@ivi",
                        help="VISA 后端：@ivi = NI-VISA（默认）；@py = pyvisa-py")
    parser.add_argument("-t", "--timeout", type=float, default=2.0,
                        help="单条命令超时秒数（默认 2.0）")
    args = parser.parse_args(argv)

    try:
        with PPR26_SCPI(args.resource, timeout=args.timeout, backend=args.backend) as dev:
            print("=" * 52)
            print("Device information")
            print("-" * 52)
            _show("resource", dev.resource)
            _show("idn", dev.get_idn())
            _show("model", dev.get_model())
            _show("serial", dev.get_serial_number())
            _show("firmware", dev.get_firmware_version())
            _show("hardware", dev.get_hardware_version())
            _show("production date", dev.get_manufacture_date())
            _show("power-on count", dev.get_power_on_count())
            _show("uptime (minutes)", dev.get_uptime_minutes())
            _show("temperature (C)", dev.get_temperature())
            _show("protocol", dev.get_protocol())
            print("-" * 52)
            print("Resistance state")
            print("-" * 52)
            _show("set (mOhm)", dev.get_resistance())
            _show("output", dev.get_output())
            _show("compensation", dev.get_compensation())
            _show("limit enable", dev.get_limit_enable())
            _show("min limit (mOhm)", dev.get_min_limit())
            _show("max limit (mOhm)", dev.get_max_limit())
            _show("step (mOhm)", dev.get_step())
            _show("relay network", dev.get_network())
            print("-" * 52)
            print("Calibration")
            print("-" * 52)
            _show("dataset", dev.get_cali_selected())
            _show("count", dev.get_cali_count())
            _show("date", dev.get_cali_date())
    except PPR26Error as exc:
        print("ERROR: {}".format(exc))
        return 1
    return 0


if __name__ == "__main__":
    import sys

    sys.exit(_main())
