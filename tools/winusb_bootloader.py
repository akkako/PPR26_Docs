#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
WinUSB bootloader host tool for PPR26.

Communicates with the bootloader over its vendor-specific WinUSB bulk
interface (class 0xFF). The wire format is unchanged from the previous HID
version: every transfer is a fixed 64-byte packet whose first byte is 0x01 for
requests and 0x02 for responses (formerly the HID report id).

IMPORTANT: the bootloader always AES-128-CTR decrypts the incoming stream in
`xboot_program_data()`. The image passed to --program/--upgrade must therefore
be the *encrypted* packed image produced by firmware/application/pack.py
(`*_pack.bin`). A raw application `.bin` (or a `--no-encrypt` plaintext image)
will be decrypted into garbage and fail CheckApplication.

Reference:
    doc_develop/firmware/bootloader_protocol.md
"""

import sys
import time
import struct
import argparse
from pathlib import Path

try:
    import usb.core
    import usb.util
except ImportError:
    print("Error: 'pyusb' module not found. Install with: pip install pyusb")
    sys.exit(1)


VID = 0xFFFE
PID = 0xFFFD
PACKET_SIZE = 64
PROGRAM_DATA_MAX_LEN = 61  # max payload bytes per SendProgramData packet

CMD_PING = 0x00
CMD_GET_VENDOR_NAME = 0x01
CMD_GET_DEVICE_MODEL = 0x02
CMD_GET_DEVICE_SN = 0x03
CMD_GET_MANUFACTURE_DATE = 0x04
CMD_GET_HARDWARE_VERSION = 0x05
CMD_GET_BOOTLOADER_VERSION = 0x06
CMD_GET_FIRMWARE_VERSION = 0x07
CMD_GET_BOOTLOADER_COMPILE_TIME = 0x08
CMD_GET_FIRMWARE_COMPILE_TIME = 0x09
CMD_GET_PROGRAM_INFO = 0x0A
CMD_ERASE_APPLICATION = 0x0B
CMD_START_PROGRAM = 0x0C
CMD_SEND_PROGRAM_DATA = 0x0D
CMD_CHECK_APPLICATION = 0x0E
CMD_JUMP_APPLICATION = 0x0F
CMD_ERROR = 0xFF

MAGIC_NUMBER = 0x0D000721

APP_HEADER_SIZE = 512                 # XBOOT_APP_HEADER_SIZE
APP_FLASH_SIZE = 46080                # XBOOT_APP_FLASH_SIZE = 0x0800F400 - 0x08004000


class WinUsbBootloaderError(Exception):
    pass


def build_request(cmd: int, data: bytes = b"") -> bytes:
    """Build a 64-byte WinUSB request packet."""
    if len(data) > PROGRAM_DATA_MAX_LEN:
        raise ValueError("request data too long")
    pkt = bytearray(PACKET_SIZE)
    pkt[0] = 0x01  # packet id (request)
    pkt[1] = 1 + len(data)  # data length (command byte + payload)
    pkt[2] = cmd
    pkt[3:3 + len(data)] = data
    return bytes(pkt)


class WinUsbBootloader:
    def __init__(self, vid=VID, pid=PID, serial_number=None):
        self.vid = vid
        self.pid = pid
        self.dev = None
        self.ep_in = None
        self.ep_out = None
        self.serial_number = serial_number

    def open(self):
        devices = list(usb.core.find(find_all=True, idVendor=self.vid, idProduct=self.pid) or [])
        if not devices:
            raise WinUsbBootloaderError(f"No WinUSB device found (VID={self.vid:04X}, PID={self.pid:04X})")

        target = None
        if self.serial_number:
            for d in devices:
                try:
                    sn = usb.util.get_string(d, d.iSerialNumber)
                except Exception:
                    sn = None
                if sn == self.serial_number:
                    target = d
                    break
            if target is None:
                raise WinUsbBootloaderError(f"Device with serial number '{self.serial_number}' not found")
        else:
            target = devices[0]

        self.dev = target

        try:
            self.dev.set_configuration()
        except usb.core.USBError:
            # Already configured by another client; continue.
            pass

        cfg = self.dev.get_active_configuration()
        intf = cfg[(0, 0)]

        # On Linux, detach any kernel driver that claimed the interface.
        try:
            if self.dev.is_kernel_driver_active(intf.bInterfaceNumber):
                self.dev.detach_kernel_driver(intf.bInterfaceNumber)
        except (NotImplementedError, usb.core.USBError):
            pass

        usb.util.claim_interface(self.dev, intf.bInterfaceNumber)

        self.ep_out = usb.util.find_descriptor(
            intf,
            custom_match=lambda e: usb.util.endpoint_direction(e.bEndpointAddress) == usb.util.ENDPOINT_OUT,
        )
        self.ep_in = usb.util.find_descriptor(
            intf,
            custom_match=lambda e: usb.util.endpoint_direction(e.bEndpointAddress) == usb.util.ENDPOINT_IN,
        )
        if self.ep_out is None or self.ep_in is None:
            raise WinUsbBootloaderError("Bulk IN/OUT endpoints not found on interface 0")

        try:
            product = usb.util.get_string(self.dev, self.dev.iProduct)
            manufacturer = usb.util.get_string(self.dev, self.dev.iManufacturer)
        except Exception:
            product = manufacturer = "unknown"
        try:
            sn = usb.util.get_string(self.dev, self.dev.iSerialNumber)
        except Exception:
            sn = "N/A"

        print(f"Connected to {manufacturer} {product} (SN: {sn})")

    def close(self):
        if self.dev:
            try:
                usb.util.dispose_resources(self.dev)
            except Exception:
                pass
            self.dev = None
            self.ep_in = None
            self.ep_out = None

    def _send_request(self, cmd: int, data: bytes = b""):
        pkt = build_request(cmd, data)
        self.dev.write(self.ep_out.bEndpointAddress, pkt, timeout=1000)

    def _read_response(self, timeout_ms: int = 500) -> bytes:
        deadline = time.time() + timeout_ms / 1000.0
        while True:
            remaining = deadline - time.time()
            if remaining <= 0:
                raise WinUsbBootloaderError("Response timeout")
            try:
                data = self.dev.read(self.ep_in.bEndpointAddress, PACKET_SIZE,
                                     timeout=max(1, int(remaining * 1000)))
            except usb.core.USBTimeoutError:
                continue
            if data:
                return bytes(data)

    def _transaction(self, cmd: int, data: bytes = b"", timeout_ms: int = 500) -> bytes:
        self._send_request(cmd, data)
        resp = self._read_response(timeout_ms)
        if len(resp) < 3:
            raise WinUsbBootloaderError("Response too short")
        if resp[0] != 0x02:
            raise WinUsbBootloaderError(f"Invalid response packet id: {resp[0]:02X}")
        if resp[2] == CMD_ERROR:
            raise WinUsbBootloaderError(f"Device returned error for command {cmd:02X}")
        if resp[2] != cmd:
            raise WinUsbBootloaderError(f"Unexpected response command: {resp[2]:02X}, expected {cmd:02X}")
        return resp

    def ping(self) -> int:
        resp = self._transaction(CMD_PING, timeout_ms=500)
        if resp[1] < 5:
            raise WinUsbBootloaderError("Ping response too short")
        magic = struct.unpack("<I", bytes(resp[3:7]))[0]
        if magic != MAGIC_NUMBER:
            raise WinUsbBootloaderError(f"Magic number mismatch: {magic:08X} != {MAGIC_NUMBER:08X}")
        return magic

    def get_string(self, cmd: int, timeout_ms: int = 500) -> str:
        resp = self._transaction(cmd, timeout_ms=timeout_ms)
        data_len = resp[1]
        if data_len < 1:
            return ""
        str_len = data_len - 1
        raw = bytes(resp[3:3 + str_len])
        # Stop at first null terminator if present
        idx = raw.find(b"\x00")
        if idx >= 0:
            raw = raw[:idx]
        return raw.decode("ascii", errors="replace")

    def get_program_info(self) -> int:
        resp = self._transaction(CMD_GET_PROGRAM_INFO, timeout_ms=500)
        if resp[1] < 5:
            raise WinUsbBootloaderError("GetProgramInfo response too short")
        return struct.unpack("<I", bytes(resp[3:7]))[0]

    def erase_application(self):
        self._transaction(CMD_ERASE_APPLICATION, timeout_ms=2000)

    def send_program_data(self, data: bytes):
        if len(data) > PROGRAM_DATA_MAX_LEN:
            raise ValueError(f"program data sub-packet must be <= {PROGRAM_DATA_MAX_LEN} bytes")
        self._transaction(CMD_SEND_PROGRAM_DATA, data, timeout_ms=500)

    def start_program(self):
        # The firmware commit erases the target flash page and then programs it,
        # so allow more than the minimum 100 ms documented for the happy path.
        self._transaction(CMD_START_PROGRAM, timeout_ms=1000)

    def check_application(self) -> bool:
        resp = self._transaction(CMD_CHECK_APPLICATION, timeout_ms=1000)
        if resp[1] < 2:
            raise WinUsbBootloaderError("CheckApplication response too short")
        return resp[3] == 0x01

    def jump_application(self):
        self._send_request(CMD_JUMP_APPLICATION)
        # Device does not reply; wait a short while for disconnect
        time.sleep(0.2)

    def print_device_info(self):
        print(f"  Vendor:               {self.get_string(CMD_GET_VENDOR_NAME)}")
        print(f"  Device Model:         {self.get_string(CMD_GET_DEVICE_MODEL)}")
        print(f"  Device SN:            {self.get_string(CMD_GET_DEVICE_SN)}")
        print(f"  Manufacture Date:     {self.get_string(CMD_GET_MANUFACTURE_DATE)}  (YY-WW)")
        print(f"  Hardware Version:     {self.get_string(CMD_GET_HARDWARE_VERSION)}  (0-6)")
        print(f"  Bootloader Version:   {self.get_string(CMD_GET_BOOTLOADER_VERSION)}")
        print(f"  Firmware Version:     {self.get_string(CMD_GET_FIRMWARE_VERSION)}")
        print(f"  Bootloader Build Time:{self.get_string(CMD_GET_BOOTLOADER_COMPILE_TIME)}")
        print(f"  Firmware Build Time:  {self.get_string(CMD_GET_FIRMWARE_COMPILE_TIME)}")
        print(f"  Page Buffer Size:     {self.get_program_info()} bytes")


def load_firmware_image(path: Path) -> bytes:
    """Read the packed firmware image and sanity-check its size.

    The bootloader decrypts the stream itself, so the file must be the encrypted
    output of pack.py. Only its length can be validated here (the 512-byte header
    is encrypted on the wire).
    """
    image = path.read_bytes()
    if len(image) < APP_HEADER_SIZE:
        raise WinUsbBootloaderError(
            f"Firmware file too small: {len(image)} bytes "
            f"(expected at least {APP_HEADER_SIZE}-byte header). "
            f"Did you pass the encrypted '*_pack.bin' produced by pack.py?")
    if len(image) > APP_FLASH_SIZE:
        raise WinUsbBootloaderError(
            f"Firmware file too large: {len(image)} bytes "
            f"(application region is {APP_FLASH_SIZE} bytes)")
    return image


def program_firmware(bl: WinUsbBootloader, image: bytes):
    """Program a complete firmware image (header + raw firmware) into the device."""
    page_size = bl.get_program_info()
    print(f"Erasing application...")
    bl.erase_application()
    print(f"Programming {len(image)} bytes in {page_size}-byte pages...")

    for page_offset in range(0, len(image), page_size):
        page = image[page_offset:page_offset + page_size]
        for sub_offset in range(0, len(page), PROGRAM_DATA_MAX_LEN):
            chunk = page[sub_offset:sub_offset + PROGRAM_DATA_MAX_LEN]
            bl.send_program_data(chunk)
        bl.start_program()
        progress = min(page_offset + page_size, len(image))
        print(f"  {progress}/{len(image)} bytes programmed")

    print("Programming finished.")


def main():
    parser = argparse.ArgumentParser(description="PPR26 WinUSB bootloader host tool")
    parser.add_argument("--vid", type=lambda x: int(x, 0), default=VID, help="USB VID")
    parser.add_argument("--pid", type=lambda x: int(x, 0), default=PID, help="USB PID")
    parser.add_argument("--sn", default=None, help="Device serial number")
    parser.add_argument("--info", action="store_true", help="Read and display device info")
    parser.add_argument("--program", type=Path, metavar="FILE",
                        help="Program an encrypted packed image (*_pack.bin from pack.py)")
    parser.add_argument("--check", action="store_true", help="Check application integrity")
    parser.add_argument("--jump", action="store_true", help="Jump to application")
    parser.add_argument("--upgrade", type=Path, metavar="FILE",
                        help="One-key upgrade: info -> erase -> program -> check -> jump "
                             "(FILE = encrypted *_pack.bin from pack.py)")
    args = parser.parse_args()

    if args.upgrade and (args.info or args.program or args.check or args.jump):
        parser.error("--upgrade cannot be used with --info, --program, --check, or --jump")

    if not (args.info or args.program or args.check or args.jump or args.upgrade):
        parser.error("at least one of --info, --program, --check, --jump, --upgrade is required")

    bl = WinUsbBootloader(vid=args.vid, pid=args.pid, serial_number=args.sn)
    bl.open()
    try:
        print("Pinging device...")
        bl.ping()
        print("Device responded.")

        if args.info:
            print("\nDevice information:")
            bl.print_device_info()

        if args.program:
            image = load_firmware_image(args.program)
            print(f"\nProgramming firmware image ({len(image)} bytes)...")
            program_firmware(bl, image)

        if args.check:
            print("\nChecking application...")
            ok = bl.check_application()
            print(f"Application check: {'PASS' if ok else 'FAIL'}")
            if not ok:
                raise WinUsbBootloaderError("Application verification failed")

        if args.jump:
            print("\nJumping to application...")
            bl.jump_application()
            print("Device disconnected.")

        if args.upgrade:
            image = load_firmware_image(args.upgrade)

            print("\nDevice information:")
            bl.print_device_info()

            print(f"\nProgramming firmware image ({len(image)} bytes)...")
            program_firmware(bl, image)

            print("\nChecking application...")
            ok = bl.check_application()
            print(f"Application check: {'PASS' if ok else 'FAIL'}")
            if not ok:
                raise WinUsbBootloaderError("Application verification failed")

            print("\nJumping to application...")
            bl.jump_application()
            print("Device disconnected.")

    finally:
        bl.close()


if __name__ == "__main__":
    try:
        main()
    except WinUsbBootloaderError as e:
        print(f"Error: {e}")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\nAborted.")
        sys.exit(1)