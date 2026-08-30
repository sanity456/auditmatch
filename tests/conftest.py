"""Shared AuditMatch direct-mode fixtures."""

from pathlib import Path

import pytest

from tests.windows_compat import install


CONTRACT_PATH = Path(__file__).resolve().parents[1] / "contracts" / "audit_match.py"
install()


@pytest.fixture(autouse=True)
def hardened_direct_mode(request):
    if "direct_vm" not in request.fixturenames:
        yield
        return
    direct_vm = request.getfixturevalue("direct_vm")
    direct_vm.check_pickling = True
    direct_vm.strict_mocks = True
    yield


@pytest.fixture
def contract(direct_vm, direct_deploy, direct_alice):
    direct_vm.sender = direct_alice
    direct_vm.warp("2026-08-26T12:00:00Z")
    return direct_deploy(str(CONTRACT_PATH), 1, sdk_version="v0.2.16")
