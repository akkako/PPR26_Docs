#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""PPR26 AT 指令的 Python 封装（上位机脚本库）。

对应 PPR26 的 AT 指令集（完整指令表见在线文档「AT 命令参考」）。
所有阻值单位统一为 **mΩ（毫欧）整数**。

基本用法::

    from ppr26_at import PPR26_AT, PPR26Error

    with PPR26_AT("COM12") as dev:
        print(dev.get_model(), dev.get_serial_number(), dev.get_firmware_version())
        dev.set_resistance(523000)          # 523000 mΩ = 523 Ω
        print(dev.get_resistance(), "mOhm")
        dev.set_open(False)                 # 退出开路/短路，回到设定值

约定与错误处理（所有对外消息均为英文）：
  * 查询返回 ``+CMD=value``，设置/执行返回 ``OK`` 或 ``ERROR``；
  * 设备返回 ``ERROR`` 抛 :class:`PPR26CommandError`；
  * 超时未收到完整响应抛 :class:`PPR26TimeoutError`；
  * 响应格式不符抛 :class:`PPR26ResponseError`；
  * 串口打开/读写失败抛 :class:`PPR26SerialError`；
  * 以上均继承 :class:`PPR26Error`，便于统一 ``except``。
"""

import time

try:
    import serial
except ImportError as exc:  # pragma: no cover
    raise ImportError("pyserial is required: pip install pyserial") from exc


# --------------------------------------------------------------------------- #
# 异常
# --------------------------------------------------------------------------- #
class PPR26Error(Exception):
    """PPR26 相关错误基类。"""


class PPR26SerialError(PPR26Error):
    """串口打开 / 读写失败。"""


class PPR26TimeoutError(PPR26Error):
    """等待响应超时。"""


class PPR26CommandError(PPR26Error):
    """设备返回 ERROR / OVERFLOW。"""


class PPR26ResponseError(PPR26Error):
    """响应格式不符合预期。"""


# --------------------------------------------------------------------------- #
# 常量
# --------------------------------------------------------------------------- #
RES_MIN_MOHM = 5000            # 5 Ω
RES_MAX_MOHM = 4000000000      # 4 MΩ
CALI_GEAR_MIN = 0
CALI_GEAR_MAX = 27             # 0..25 单路 / 26 串联短路 / 27 直接短路
CALI_SET_USER = 0
CALI_SET_FACTORY = 1

PROTOCOL_AT = 0
PROTOCOL_SCPI = 1


def _check_range(name, value, lo, hi):
    if not isinstance(value, int):
        raise ValueError("{} must be an integer (mOhm)".format(name))
    if value < lo or value > hi:
        raise ValueError(
            "{} out of range: {} not in [{}, {}]".format(name, value, lo, hi)
        )
    return value


def _check_bool(name, value):
    if isinstance(value, bool):
        return 1 if value else 0
    if value in (0, 1):
        return int(value)
    raise ValueError("{} must be 0/1 or bool".format(name))


def find_ppr26():
    """按 USB VID 自动查找 PPR26 的 AT 串口，返回串口名。"""
    from serial.tools import list_ports

    for port in list_ports.comports():
        if port.vid == 0xFFFE:
            return port.device
    raise PPR26SerialError("未找到 PPR26，请确认设备处于 AT 模式")


# --------------------------------------------------------------------------- #
# 主类
# --------------------------------------------------------------------------- #
class PPR26_AT:
    """PPR26 AT 串口封装。阻值单位一律 mΩ。"""

    BAUDRATE = 115200

    def __init__(self, comport=None, timeout=1.0):
        """timeout 为单条命令等待响应的秒数。"""
        self.comport = comport
        self.timeout = float(timeout)
        self.ser = None
        self.isopen = False

    # ---------------------------------------------------------------- 串口 --
    def open(self, comport=None, timeout=None):
        """打开串口（未指定端口时按 VID ``0xFFFE`` 自动查找）。

        失败抛 :class:`PPR26SerialError`。
        """
        if self.isopen:
            return
        if comport is not None:
            self.comport = comport
        if timeout is not None:
            self.timeout = float(timeout)
        if not self.comport:
            self.comport = find_ppr26()

        try:
            self.ser = serial.Serial(
                port=self.comport,
                baudrate=self.BAUDRATE,
                bytesize=8,
                parity="N",
                stopbits=1,
                timeout=self.timeout,
            )
        except (serial.SerialException, OSError, ValueError) as exc:
            self.ser = None
            self.isopen = False
            raise PPR26SerialError(
                "cannot open serial port {}: {}".format(self.comport, exc)
            ) from exc

        self.isopen = True
        self._flush()
        return self

    def close(self):
        """关闭串口（幂等）。"""
        if self.ser is not None:
            try:
                self.ser.close()
            except Exception:
                pass
        self.ser = None
        self.isopen = False

    def reopen(self, comport=None, timeout=5.0):
        """等待并重新打开串口（协议切换后设备会重新枚举）。"""
        comport = comport or self.comport
        deadline = time.monotonic() + float(timeout)
        last = None
        while time.monotonic() < deadline:
            try:
                self.open(comport)
                return True
            except PPR26Error as exc:
                last = exc
                time.sleep(0.2)
        raise PPR26SerialError("cannot reopen {}: {}".format(comport, last))

    def __enter__(self):
        if not self.isopen:
            self.open()
        return self

    def __exit__(self, exc_type, exc, tb):
        self.close()
        return False

    # ------------------------------------------------------------ 底层收发 --
    def _require_open(self):
        if self.ser is None or not self.isopen:
            raise PPR26SerialError("serial port is not open")

    def _flush(self):
        try:
            self.ser.reset_input_buffer()
            self.ser.reset_output_buffer()
        except Exception:
            pass

    def write(self, cmd):
        """写入一条原始命令（自动补 ``\\r\\n``），不等待响应。"""
        self._require_open()
        if isinstance(cmd, bytes):
            data = cmd
        else:
            if not cmd.endswith("\n"):
                cmd += "\r\n"
            data = cmd.encode("ascii")
        try:
            self.ser.write(data)
            self.ser.flush()
        except (serial.SerialException, OSError) as exc:
            raise PPR26SerialError("serial write failed: {}".format(exc)) from exc

    def _read_line(self, deadline):
        """读取一行（跳过空行），超时抛 :class:`PPR26TimeoutError`。

        串口超时只在 :meth:`open` 时设置一次：Windows 下每次改动 ``timeout``
        都会下发一次 SET_LINE_CODING，命令间隔很短时可能导致串口进入失效状态
        （``SetCommState`` 报 error 31），因此这里不再逐行调整超时。
        """
        while True:
            if deadline - time.monotonic() <= 0:
                raise PPR26TimeoutError("timeout waiting for a response")
            try:
                raw = self.ser.readline()
            except (serial.SerialException, OSError) as exc:
                raise PPR26SerialError("serial read failed: {}".format(exc)) from exc
            if not raw:
                raise PPR26TimeoutError("timeout waiting for a response")
            line = raw.decode("ascii", errors="replace").strip("\r\n")
            if line:
                return line

    def _transact(self, cmd, query=False, name=None):
        """发送命令并等待响应。

        * query=False：等待 ``OK``，返回 None；
        * query=True ：等待 ``+<name>=value``，返回 value 字符串。
        """
        self._write_and_check_overrun(cmd)

        deadline = time.monotonic() + self.timeout
        while True:
            line = self._read_line(deadline)

            if line == "ERROR":
                raise PPR26CommandError("{} -> ERROR".format(cmd.strip()))
            if line == "OVERFLOW":
                raise PPR26CommandError("{} -> OVERFLOW".format(cmd.strip()))

            if not query:
                if line == "OK":
                    return None
                # 其它行（如帮助文本）忽略，继续等 OK
                continue

            if line.startswith("+"):
                got_name, sep, value = line[1:].partition("=")
                if sep and (name is None or got_name == name):
                    return value
                continue  # 非目标响应，忽略
            # 其它行忽略，继续读

    def _write_and_check_overrun(self, cmd):
        self._require_open()
        if isinstance(cmd, str) and len(cmd) > 256:
            raise ValueError("command too long (>256)")
        self._flush()
        self.write(cmd)

    # ------------------------------------------------------------ 便捷封装 --
    def _cmd(self, cmd):
        """执行/设置类命令，期望 OK。"""
        return self._transact(cmd, query=False)

    def _query(self, cmd, name):
        """查询类命令，返回字符串值。"""
        return self._transact(cmd, query=True, name=name)

    def _query_int(self, cmd, name):
        value = self._query(cmd, name)
        try:
            return int(value, 0)
        except ValueError as exc:
            raise PPR26ResponseError(
                "{} -> not an integer: {!r}".format(cmd.strip(), value)
            ) from exc

    def _query_float(self, cmd, name):
        value = self._query(cmd, name)
        try:
            return float(value)
        except ValueError as exc:
            raise PPR26ResponseError(
                "{} -> not a number: {!r}".format(cmd.strip(), value)
            ) from exc

    # ====================================================================== #
    # 设备信息 (AT+DEV.*)
    # ====================================================================== #
    def ping(self):
        """连通性测试：发送 ``AT``，成功返回 True。"""
        self._cmd("AT")
        return True

    def get_serial_number(self):
        """序列号（24 个大写十六进制字符）。"""
        return self._query("AT+DEV.SN?", "DEV.SN")

    def get_model(self):
        """型号。"""
        return self._query("AT+DEV.MODEL?", "DEV.MODEL")

    def get_production_date(self):
        """生产日期 ``YY-WW``。"""
        return self._query("AT+DEV.PROD?", "DEV.PROD")

    def get_hardware_version(self):
        """硬件版本 ``0``..``6``（字符串）。"""
        return self._query("AT+DEV.HWVER?", "DEV.HWVER")

    def get_firmware_version(self):
        """APP 版本字符串。"""
        return self._query("AT+DEV.FWVER?", "DEV.FWVER")

    def get_power_on_count(self):
        """上电次数。"""
        return self._query_int("AT+DEV.POWERON?", "DEV.POWERON")

    def get_uptime_minutes(self):
        """累计通电时间（分钟）。"""
        return self._query_int("AT+DEV.UPTIME?", "DEV.UPTIME")

    def get_temperature(self):
        """读取板载 NTC 温度（0.1 ℃ 整数，如 ``291`` = 29.1 ℃）。"""
        return self._query_int("AT+DEV.TEMP?", "DEV.TEMP")

    def get_temperature_stats(self):
        """读取温度统计，返回 ``(当前, 最低, 平均, 最高, 次数)``（0.1 ℃）。"""
        raw = self._query("AT+DEV.TSTAT?", "DEV.TSTAT")
        parts = raw.split(",")
        if len(parts) != 5:
            raise PPR26ResponseError(
                "AT+DEV.TSTAT? -> invalid response: {!r}".format(raw)
            )
        try:
            return tuple(int(item, 0) for item in parts)
        except ValueError as exc:
            raise PPR26ResponseError(
                "AT+DEV.TSTAT? -> invalid response: {!r}".format(raw)
            ) from exc

    def clear_temperature_stats(self):
        """清空温度统计。"""
        return self._cmd("AT+DEV.TCLR")

    def enter_dfu(self):
        """进入 DFU（Bootloader）模式：设备先返回 OK，随后断开 USB 并软复位。

        该 OK 常常来不及送达上位机，因此调用可能以超时异常结束（已忽略）；
        应以设备是否重新枚举为 DFU（VID:PID ``0xFFFE:0xFFFD``）作为成功判据。
        """
        try:
            self._cmd("AT+DEV.DFU")
        except PPR26Error:
            pass
        self.close()
        return True

    # ====================================================================== #
    # 电阻设置 (AT+RES.*)，单位均为 mΩ
    # ====================================================================== #
    def set_resistance(self, mohm):
        """设定输出阻值（mΩ）。超范围/超出限值时设备返回 ERROR。"""
        _check_range("resistance", int(mohm), RES_MIN_MOHM, RES_MAX_MOHM)
        return self._cmd("AT+RES.SP={}".format(int(mohm)))

    def get_resistance(self):
        """查询设定阻值（mΩ）。"""
        return self._query_int("AT+RES.SP?", "RES.SP")

    def get_resistance_pv(self):
        """查询实际估测阻值（mΩ）；开路状态返回 ``float('inf')``。"""
        value = self._query("AT+RES.PV?", "RES.PV")
        if value.lower() == "inf":
            return float("inf")
        try:
            return int(value, 0)
        except ValueError as exc:
            raise PPR26ResponseError(
                "AT+RES.PV? -> invalid response: {!r}".format(value)
            ) from exc

    def set_step(self, mohm):
        """设定步进值（mΩ，非负）。"""
        value = int(mohm)
        if value < 0:
            raise ValueError("step must not be negative")
        return self._cmd("AT+RES.STEP={}".format(value))

    def get_step(self):
        """查询步进值（mΩ）。"""
        return self._query_int("AT+RES.STEP?", "RES.STEP")

    def set_compensation(self, mode):
        """补偿模式：0=不补偿 1=附近最佳 2=多档位最佳。"""
        if mode not in (0, 1, 2):
            raise ValueError("compensation must be 0/1/2")
        return self._cmd("AT+RES.COMP={}".format(mode))

    def get_compensation(self):
        """查询补偿模式（0/1/2）。"""
        return self._query_int("AT+RES.COMP?", "RES.COMP")

    def set_limit_enable(self, enable):
        """阻值限值使能 0/1。"""
        return self._cmd("AT+RES.LIMIT={}".format(_check_bool("limit_enable", enable)))

    def get_limit_enable(self):
        """查询限值使能（0/1）。"""
        return self._query_int("AT+RES.LIMIT?", "RES.LIMIT")

    def set_max_limit(self, mohm):
        """设定最大阻值限制（mΩ，5 Ω..4 MΩ）。"""
        _check_range("max_limit", int(mohm), RES_MIN_MOHM, RES_MAX_MOHM)
        return self._cmd("AT+RES.MAX={}".format(int(mohm)))

    def get_max_limit(self):
        """查询最大阻值限制（mΩ）。"""
        return self._query_int("AT+RES.MAX?", "RES.MAX")

    def set_min_limit(self, mohm):
        """设定最小阻值限制（mΩ，5 Ω..4 MΩ）。"""
        _check_range("min_limit", int(mohm), RES_MIN_MOHM, RES_MAX_MOHM)
        return self._cmd("AT+RES.MIN={}".format(int(mohm)))

    def get_min_limit(self):
        """查询最小阻值限制（mΩ）。"""
        return self._query_int("AT+RES.MIN?", "RES.MIN")

    def set_network(self, mask):
        """直接设置继电器网络位图（0 .. 2^26-1），更新设定值；位图与设定值都不落盘。"""
        value = int(mask)
        if value < 0 or value >= (1 << 26):
            raise ValueError("network mask must be in [0, 2^26)")
        return self._cmd("AT+RES.NETW={}".format(value))

    def get_network(self):
        """查询当前继电器网络位图。"""
        return self._query_int("AT+RES.NETW?", "RES.NETW")

    def set_short(self, enable):
        """短路控制：1=进入短路，0=恢复到设定阻值。"""
        return self._cmd("AT+RES.SHORT={}".format(_check_bool("short", enable)))

    def get_short(self):
        """查询短路状态（0/1）。"""
        return self._query_int("AT+RES.SHORT?", "RES.SHORT")

    def set_open(self, enable):
        """开路控制：1=进入开路，0=恢复到设定阻值。"""
        return self._cmd("AT+RES.OPEN={}".format(_check_bool("open", enable)))

    def get_open(self):
        """查询开路状态（0/1）。"""
        return self._query_int("AT+RES.OPEN?", "RES.OPEN")

    def exit_open_short(self):
        """退出短路/开路，恢复到设定阻值。"""
        self.set_short(0)
        self.set_open(0)
        return True

    # 旧脚本方法名兼容 ------------------------------------------------------ #
    def set_resistance_max_limit(self, mohm):
        return self.set_max_limit(mohm)

    def set_resistance_min_limit(self, mohm):
        return self.set_min_limit(mohm)

    def set_resistance_open(self, enable):
        return self.set_open(enable)

    def set_resistance_short(self, enable):
        return self.set_short(enable)

    # ====================================================================== #
    # 通信协议 (AT+SYS.PROT)
    # ====================================================================== #
    def get_protocol(self):
        """查询协议：0=AT 1=SCPI。"""
        return self._query_int("AT+SYS.PROT?", "SYS.PROT")

    def set_protocol(self, protocol, wait_reopen=True, reopen_timeout=5.0):
        """切换通信协议（0=AT 1=SCPI）。设备随后断开并重新枚举。

        切换后原串口句柄失效，本方法会先关闭串口；若目标是 AT(0) 且
        ``wait_reopen`` 为真，会在 ``reopen_timeout`` 秒内尝试重新打开。
        切到 SCPI(1) 后 CDC 串口消失（变为 USBTMC），请改用 SCPI 上位机。
        """
        if protocol not in (PROTOCOL_AT, PROTOCOL_SCPI):
            raise ValueError("protocol must be 0 (AT) or 1 (SCPI)")
        try:
            self._cmd("AT+SYS.PROT={}".format(protocol))
        except PPR26Error:
            # 设备可能来不及回 OK 就断开，忽略
            pass
        self.close()
        if protocol == PROTOCOL_AT and wait_reopen:
            return self.reopen(timeout=reopen_timeout)
        return True

    # ====================================================================== #
    # 校准 (AT+CALI.*)
    # ====================================================================== #
    def cali_select(self, dataset):
        """选择校准数据集：0=USER 1=FACTORY（同时决定输出与后续编辑目标）。"""
        if dataset not in (CALI_SET_USER, CALI_SET_FACTORY):
            raise ValueError("dataset must be 0 (USER) or 1 (FACTORY)")
        return self._cmd("AT+CALI.SEL={}".format(dataset))

    def get_cali_selected(self):
        """查询当前校准数据集（0/1）。"""
        return self._query_int("AT+CALI.SEL?", "CALI.SEL")

    def cali_enable(self, enable):
        """校准使能 0/1（写操作前置条件，不持久化）。"""
        return self._cmd("AT+CALI.ENAB={}".format(_check_bool("cali_enable", enable)))

    def get_cali_enable(self):
        """查询校准使能（0/1）。"""
        return self._query_int("AT+CALI.ENAB?", "CALI.ENAB")

    def cali_set_user_password(self, password):
        """设置用户校准密码（仅 USER 集；空字符串=不锁）。"""
        if not isinstance(password, str):
            raise ValueError("password must be a string")
        if len(password.encode("utf-8")) > 64:
            raise ValueError("password must be at most 64 bytes")
        return self._cmd("AT+CALI.PASS={}".format(password))

    def cali_user_password_set(self):
        """查询用户密码是否已设置（0/1）。仅 USER 集有效。"""
        return self._query_int("AT+CALI.PASS?", "CALI.PASS")

    def cali_unlock(self, password):
        """解锁当前数据集（使用对应数据集的口令）。"""
        if not isinstance(password, str):
            raise ValueError("password must be a string")
        return self._cmd("AT+CALI.UNL={}".format(password))

    def cali_lock(self, enable):
        """锁定/解锁当前数据集（0=解锁 1=锁定）。"""
        return self._cmd("AT+CALI.LOCK={}".format(_check_bool("cali_lock", enable)))

    def get_cali_locked(self):
        """查询当前数据集锁定状态（0/1）。"""
        return self._query_int("AT+CALI.LOCK?", "CALI.LOCK")

    def cali_gear(self, gear):
        """设置校准档位 0..27（并应用对应继电器）。"""
        if not isinstance(gear, int) or gear < CALI_GEAR_MIN or gear > CALI_GEAR_MAX:
            raise ValueError("gear must be {}..{}".format(CALI_GEAR_MIN, CALI_GEAR_MAX))
        return self._cmd("AT+CALI.GEAR={}".format(gear))

    def get_cali_gear(self):
        """查询当前校准档位（0..27）。"""
        return self._query_int("AT+CALI.GEAR?", "CALI.GEAR")

    def cali_set_value(self, mohm):
        """写入当前档位的校准阻值（mΩ）。需已使能且未锁定。"""
        value = int(mohm)
        if value < 0:
            raise ValueError("cali value must not be negative")
        return self._cmd("AT+CALI.VAL={}".format(value))

    def get_cali_value(self):
        """查询当前档位的校准阻值（mΩ）。"""
        return self._query_int("AT+CALI.VAL?", "CALI.VAL")

    def cali_set_date(self, date):
        """设置校准日期字符串（≤64 字节）。"""
        if not isinstance(date, str):
            raise ValueError("date must be a string")
        if len(date.encode("utf-8")) > 64:
            raise ValueError("date must be at most 64 bytes")
        return self._cmd("AT+CALI.DATE={}".format(date))

    def get_cali_date(self):
        """查询校准日期字符串。"""
        return self._query("AT+CALI.DATE?", "CALI.DATE")

    def cali_set_string(self, text):
        """设置校准备注字符串（≤64 字节）。"""
        if not isinstance(text, str):
            raise ValueError("string must be a string")
        if len(text.encode("utf-8")) > 64:
            raise ValueError("string must be at most 64 bytes")
        return self._cmd("AT+CALI.STR={}".format(text))

    def get_cali_string(self):
        """查询校准备注字符串。"""
        return self._query("AT+CALI.STR?", "CALI.STR")

    def get_cali_count(self):
        """查询校准次数。"""
        return self._query_int("AT+CALI.COUNT?", "CALI.COUNT")

    def get_cali_temp(self):
        """查询校准时温度快照（℃）。"""
        return self._query_float("AT+CALI.TEMP?", "CALI.TEMP")

    def cali_save(self):
        """保存当前校准数据集（次数+1、记录温度、落盘）。"""
        return self._cmd("AT+CALI.SAVE")

    # 校准流程辅助 ---------------------------------------------------------- #
    def cali_begin(self, dataset, password=None):
        """开始校准：选集 → 使能 →（可选）解锁。"""
        self.cali_select(dataset)
        self.cali_enable(1)
        if password is not None:
            self.cali_unlock(password)
        return True

    def cali_set_gear_value(self, gear, mohm):
        """校准一步：设置档位并写入该档位阻值（mΩ）。"""
        self.cali_gear(gear)
        self.cali_set_value(mohm)
        return True

    def cali_end(self):
        """结束校准：保存当前数据集。"""
        return self.cali_save()

    # 旧脚本方法名兼容 ------------------------------------------------------ #
    def cali_apply(self, gear):
        return self.cali_gear(gear)

    def cali_update_data(self, mohm):
        return self.cali_set_value(mohm)

    def cali_update_date(self, date):
        return self.cali_set_date(str(date))

    def cali_data_save(self):
        return self.cali_save()


# --------------------------------------------------------------------------- #
# 命令行用法：python ppr26_at.py [-p COM12]
# --------------------------------------------------------------------------- #
def _show(label, value, width=20):
    print("  {:<{width}}: {}".format(label, value, width=width))


def _main(argv=None):
    import argparse
    import sys

    if hasattr(sys.stdout, "reconfigure"):   # 控制台编码不支持时避免抛异常
        sys.stdout.reconfigure(errors="replace")

    parser = argparse.ArgumentParser(
        description="读取 PPR26 设备信息与输出状态（AT 模式，只读）")
    parser.add_argument("-p", "--port", default=None,
                        help="串口名（默认按 VID 0xFFFE 自动查找）")
    parser.add_argument("-t", "--timeout", type=float, default=1.0,
                        help="单条命令超时秒数（默认 1.0）")
    args = parser.parse_args(argv)

    try:
        port = args.port or find_ppr26()
        with PPR26_AT(port, timeout=args.timeout) as dev:
            print("=" * 52)
            print("Device information")
            print("-" * 52)
            _show("port", dev.comport)
            _show("model", dev.get_model())
            _show("serial", dev.get_serial_number())
            _show("firmware", dev.get_firmware_version())
            _show("hardware", dev.get_hardware_version())
            _show("production date", dev.get_production_date())
            _show("power-on count", dev.get_power_on_count())
            _show("uptime (minutes)", dev.get_uptime_minutes())
            _show("protocol", dev.get_protocol())
            print("-" * 52)
            print("Resistance state")
            print("-" * 52)
            _show("set (mOhm)", dev.get_resistance())
            _show("present (mOhm)", dev.get_resistance_pv())
            _show("compensation", dev.get_compensation())
            _show("limit enable", dev.get_limit_enable())
            _show("min limit (mOhm)", dev.get_min_limit())
            _show("max limit (mOhm)", dev.get_max_limit())
            _show("step (mOhm)", dev.get_step())
            _show("relay network", dev.get_network())
            _show("short state", dev.get_short())
            _show("open state", dev.get_open())
    except PPR26Error as exc:
        print("ERROR: {}".format(exc))
        return 1
    return 0


if __name__ == "__main__":
    import sys

    sys.exit(_main())
