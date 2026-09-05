"""Cross-platform compatibility fixes for genlayer-test 0.29.2 direct mode."""

from __future__ import annotations

import os
import sys
import tempfile


def install() -> None:
    """Keep contract-visible message time synchronized with ``direct_vm.warp``.

    genlayer-test 0.29.2 refreshes sender and origin after the SDK has loaded,
    but it does not refresh ``gl.message_raw["datetime"]``. As a result, a
    post-deployment warp changes ``VMContext._datetime`` without changing the
    timestamp observed by contract code. The Windows stdin compatibility path
    remains conditional; the datetime synchronization is required everywhere.
    """

    from gltest.direct import loader
    from gltest.direct.vm import VMContext

    if getattr(loader, "_auditmatch_direct_compat", False):
        return

    if sys.platform == "win32":

        def inject_message_to_fd0(vm):
            from genlayer.py import calldata
            from genlayer.py.types import Address

            sender = Address(vm.sender) if isinstance(vm.sender, bytes) else vm.sender
            contract = (
                Address(vm._contract_address)
                if isinstance(vm._contract_address, bytes)
                else vm._contract_address
            )
            origin = Address(vm.origin) if isinstance(vm.origin, bytes) else vm.origin
            encoded = calldata.encode(
                {
                    "contract_address": contract,
                    "sender_address": sender,
                    "origin_address": origin,
                    "stack": [],
                    "value": vm._value,
                    "datetime": vm._datetime,
                    "is_init": False,
                    "chain_id": vm._chain_id,
                    "entry_kind": 0,
                    "entry_data": b"",
                    "entry_stage_data": None,
                }
            )
            fd, path = tempfile.mkstemp()
            try:
                os.write(fd, encoded)
                os.lseek(fd, 0, os.SEEK_SET)
                vm._original_stdin_fd = os.dup(0)
                os.dup2(fd, 0)
                vm._auditmatch_stdin_path = path
            finally:
                os.close(fd)

        original_cleanup = VMContext._cleanup_after_deactivate

        def cleanup_after_deactivate(vm):
            path = getattr(vm, "_auditmatch_stdin_path", None)
            try:
                original_cleanup(vm)
            finally:
                if path:
                    try:
                        os.unlink(path)
                    except FileNotFoundError:
                        pass
                    vm._auditmatch_stdin_path = None

        loader._inject_message_to_fd0 = inject_message_to_fd0
        VMContext._cleanup_after_deactivate = cleanup_after_deactivate

    original_refresh = VMContext._refresh_gl_message

    def refresh_gl_message(vm):
        original_refresh(vm)
        module = sys.modules.get("genlayer.gl")
        if module is not None and getattr(module, "message_raw", None) is not None:
            module.message_raw["datetime"] = vm._datetime

    VMContext._refresh_gl_message = refresh_gl_message
    loader._auditmatch_direct_compat = True
