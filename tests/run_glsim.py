"""Launch GLSim with the Windows compatibility shim used by AuditMatch tests."""

from __future__ import annotations

from gltest.direct import loader
from windows_compat import install


install()
loader._make_contract_proxy = lambda instance: instance


if __name__ == "__main__":
    from glsim.__main__ import main

    main()
