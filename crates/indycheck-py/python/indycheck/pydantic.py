"""Optional Pydantic helpers for indycheck.

Pydantic is **never** required to import or use the main ``indycheck``
package. This module imports cleanly without Pydantic installed; the
helpers below raise an informative ``ImportError`` only when actually
called without Pydantic, and return real ``Annotated`` types when
Pydantic v2 is available.

Usage (requires ``pip install indycheck[pydantic]``)::

    from pydantic import BaseModel
    from indycheck.pydantic import pan_annotated, mobile_annotated

    class Signup(BaseModel):
        pan: pan_annotated()
        mobile: mobile_annotated()
"""

from indycheck import (
    validate_aadhaar,
    validate_cin,
    validate_epic,
    validate_gstin,
    validate_ifsc,
    validate_llpin,
    validate_mobile,
    validate_pan,
    validate_pincode,
    validate_tan,
    validate_upi,
    validate_vehicle,
    validate_voter_id,
)

__all__ = [
    "pan_annotated",
    "aadhaar_annotated",
    "gstin_annotated",
    "ifsc_annotated",
    "upi_annotated",
    "mobile_annotated",
    "pincode_annotated",
    "tan_annotated",
    "cin_annotated",
    "llpin_annotated",
    "voter_annotated",
    "epic_annotated",
    "vehicle_annotated",
    "vehicle_registration_annotated",
]


def _annotated(validator, name):
    """Build ``Annotated[str, ...]`` for *validator*, or raise helpfully."""
    try:
        from typing import Annotated

        from pydantic import AfterValidator
    except ImportError as exc:  # pragma: no cover - depends on env
        raise ImportError(
            "indycheck Pydantic helpers need Pydantic v2: "
            "pip install 'indycheck[pydantic]'"
        ) from exc

    def _check(value):
        result = validator(value)
        if not result["valid"]:
            raise ValueError(
                f"{result['reason_en']} / {result['reason_hi']}"
            )
        return value

    return Annotated[str, AfterValidator(_check)]


def pan_annotated():
    """``Annotated[str, ...]`` accepting only a valid PAN."""
    return _annotated(validate_pan, "pan")


def aadhaar_annotated():
    """``Annotated[str, ...]`` accepting only a valid Aadhaar number."""
    return _annotated(validate_aadhaar, "aadhaar")


def gstin_annotated():
    """``Annotated[str, ...]`` accepting only a valid GSTIN."""
    return _annotated(validate_gstin, "gstin")


def ifsc_annotated():
    """``Annotated[str, ...]`` accepting only a valid IFSC (format only)."""
    return _annotated(validate_ifsc, "ifsc")


def upi_annotated():
    """``Annotated[str, ...]`` accepting only a valid UPI ID."""
    return _annotated(validate_upi, "upi")


def mobile_annotated():
    """``Annotated[str, ...]`` accepting only a valid Indian mobile number."""
    return _annotated(validate_mobile, "mobile")


def pincode_annotated():
    """``Annotated[str, ...]`` accepting only a valid PIN code."""
    return _annotated(validate_pincode, "pincode")


def tan_annotated():
    """``Annotated[str, ...]`` accepting only a valid TAN (format only —
    TAN has no public checksum)."""
    return _annotated(validate_tan, "tan")


def cin_annotated():
    """``Annotated[str, ...]`` accepting only a valid CIN (format only —
    CIN has no public checksum)."""
    return _annotated(validate_cin, "cin")


def llpin_annotated():
    """``Annotated[str, ...]`` accepting only a valid LLPIN (format
    only — LLPIN has no public checksum)."""
    return _annotated(validate_llpin, "llpin")


def voter_annotated():
    """``Annotated[str, ...]`` accepting only a valid Voter ID / EPIC
    number (format only — Voter ID has no public checksum)."""
    return _annotated(validate_voter_id, "voter")


def epic_annotated():
    """Alias for ``voter_annotated``: EPIC is the name printed on the card."""
    return _annotated(validate_epic, "epic")


def vehicle_annotated():
    """``Annotated[str, ...]`` accepting only a valid vehicle
    registration number (format only — registration numbers have no
    public checksum)."""
    return _annotated(validate_vehicle, "vehicle")


def vehicle_registration_annotated():
    """Alias for ``vehicle_annotated``."""
    return _annotated(validate_vehicle, "vehicle")
