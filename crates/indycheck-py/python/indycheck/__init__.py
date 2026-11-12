"""indycheck — offline Indian ID validator (native Rust core via PyO3).

Re-exports everything from the compiled extension module
(``indycheck.indycheck``). The pure-Python mirror in
``packages/python/src/indycheck/`` is a separate, equivalent
implementation used for tests — this package always runs the native
code. Optional helpers live in ``indycheck.pydantic`` (Pydantic v2,
``pip install 'indycheck[pydantic]'``).
"""

from .indycheck import *

__doc__ = indycheck.__doc__
if hasattr(indycheck, "__all__"):
    __all__ = indycheck.__all__
