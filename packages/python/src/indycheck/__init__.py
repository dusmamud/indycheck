"""indycheck — offline Indian ID validator (pure-Python mirror).

This module mirrors the Rust core in crates/indycheck/src/ exactly:
same validators, same order of checks, same stable ``code`` values, same
``reason_en`` / ``reason_hi`` strings, same ``parsed`` shapes (see
shared/spec.md). Behaviour is defined by shared/test-vectors.json
together with the Rust code; as of the last check the two agree on all
245 vectors (verified by emulating the Rust source over the file), so
the vector test asserts every entry directly with no exceptions.
If the Rust side drifts again, that test fails loudly instead of
silently picking a side.

The 12 validators are: mobile, PAN, Aadhaar, GSTIN, IFSC, UPI, PIN
code, TAN, CIN, LLPIN, Voter ID / EPIC and vehicle registration.
TAN, CIN, LLPIN, Voter ID, vehicle and IFSC have no public checksum:
only their format is checked (say so wherever these are documented).
``validate_*_with_options`` exists only where the Rust core has it —
mobile, PAN, Aadhaar and GSTIN (options.rs); the other validators take
no options in Rust either. ``format_pan`` / ``format_gstin`` return
``str | None`` and ``mask_pan`` / ``mask_mobile`` return a plain string
(``""`` when the format is invalid), exactly like the Rust functions —
unlike the legacy ``format_mobile`` / ``mask_aadhaar`` wrappers, which
keep returning the validation dict for backwards compatibility.
The ``generate_*`` functions produce mock test data only: syntactically
valid, never a real issued ID — see generate.rs and the README.

Notes on the Rust contract reproduced here:
- Success code is ``VALID`` (not ``OK``). The full code set is:
  VALID, EMPTY, INVALID_LENGTH, INVALID_FORMAT, INVALID_CHECKSUM,
  INVALID_FIRST_DIGIT, INVALID_STATE_CODE, INVALID_ENTITY,
  INVALID_HANDLE, UNKNOWN_TYPE. ``INVALID_TYPE`` (non-string input) and
  ``SOME_INVALID`` (validate_many batch result) exist only in the
  JS/Python wrappers — Rust takes ``&str`` and returns a bare list for
  batches.
- ``reason_hi`` is Roman-script Hinglish in the Rust core (e.g.
  "PAN khaali hai"), not Devanagari — reproduced verbatim, even though
  spec.md calls it Devanagari Hindi.
- PAN entity checking is lenient by design (pan.rs, spec.md): the 4th
  character is reported in ``parsed`` (entity name, or "Unknown" when it
  is not in the published list) and the PAN is still format-valid.
  The canonical example ABCDE1234F is valid with entity "Unknown"
  (4th char D). ``INVALID_ENTITY`` is a reserved stable code, not
  emitted in v0.1.
- ``detect`` returns the Rust detect string ("pan" | "aadhaar" |
  "gstin" | "ifsc" | "upi" | "mobile" | "pincode" | "tan" | "cin" |
  "llpin" | "voter" | "vehicle" | "unknown") in
  ``parsed["type"]``. It is shape-based, not validity-based, and its
  order is fixed by lib.rs: ``@`` -> upi first; then a Verhoeff-valid
  12-digit number -> aadhaar (including spaced / hyphenated Aadhaar,
  digits-only); then any normalisable mobile -> mobile; then CIN
  (21 chars); then by length (15 -> gstin, 12 digits -> aadhaar,
  11 IFSC-pattern -> ifsc, 10 PAN-pattern -> pan, 10 TAN-pattern ->
  tan, 10 voter-pattern -> voter, 10 digits -> mobile,
  7 LLPIN-pattern -> llpin, 6 digits -> pincode); then formatted
  mobiles, then PAN / TAN / voter / IFSC / LLPIN patterns, then
  vehicle. Note the code's order, not spec.md's one-line summary of it.
- ``format_mobile`` returns the validate_mobile result
  (``parsed["normalized"]`` is the 10-digit string, Rust's
  ``format_mobile`` return). ``mask_aadhaar`` returns the
  validate_aadhaar result (``parsed["masked"]``). Unlike the Rust
  ``mask_aadhaar`` string function — which masks any 12-digit string,
  even one with a bad checksum — the JS/Python mask_aadhaar only
  succeeds for a fully valid Aadhaar number.
- UPI handle list, GSTIN state names (incl. 25/26) and PAN entity
  names are copied verbatim from crates/indycheck/src/data.rs and
  pan.rs (note: B -> "BODY", H -> "HUF", A -> "AOP").

Honest limits: format + checksum only. Nothing here checks a number
against UIDAI, NSDL / Income Tax, GSTN, a bank, or any other live
database. A ``valid: True`` result means "well-formed and
checksum-correct", not "this ID really exists / belongs to this person".

Every validator returns ``{"valid", "code", "reason_en", "reason_hi",
"parsed"}`` and never raises on bad input.
"""

__version__ = "0.1.0"

import random

__all__ = [
    "validate_mobile",
    "validate_pan",
    "validate_aadhaar",
    "validate_gstin",
    "validate_ifsc",
    "validate_upi",
    "validate_pincode",
    "validate_tan",
    "validate_cin",
    "validate_llpin",
    "validate_voter_id",
    "validate_epic",
    "validate_vehicle",
    "validate_vehicle_registration",
    "validate_mobile_with_options",
    "validate_pan_with_options",
    "validate_aadhaar_with_options",
    "validate_gstin_with_options",
    "format_mobile",
    "format_mobile_with_options",
    "format_pan",
    "format_gstin",
    "mask_aadhaar",
    "mask_pan",
    "mask_mobile",
    "generate_pan",
    "generate_aadhaar",
    "generate_gstin",
    "generate_mobile",
    "default_options",
    "strict_options",
    "lenient_options",
    "no_spaces_hyphens_options",
    "detect",
    "detect_type",
    "validate_many",
    "mask_aadhaar_string",
    "UPI_HANDLES",
    "PAN_ENTITY_TYPES",
    "GSTIN_STATE_NAMES",
    "DEFAULT_OPTIONS",
    # camelCase aliases, for parity with the JS package
    "validateMobile",
    "validatePan",
    "validateAadhaar",
    "validateGstin",
    "validateIfsc",
    "validateUpi",
    "validatePincode",
    "validateTan",
    "validateCin",
    "validateLlpin",
    "validateVoterId",
    "validateEpic",
    "validateVehicle",
    "validateVehicleRegistration",
    "validateMobileWithOptions",
    "validatePanWithOptions",
    "validateAadhaarWithOptions",
    "validateGstinWithOptions",
    "formatMobile",
    "formatMobileWithOptions",
    "formatPan",
    "formatGstin",
    "maskAadhaar",
    "maskPan",
    "maskMobile",
    "generatePan",
    "generateAadhaar",
    "generateGstin",
    "generateMobile",
    "defaultOptions",
    "strictOptions",
    "lenientOptions",
    "noSpacesHyphensOptions",
    "detectType",
    "validateMany",
]

# ---------------------------------------------------------------------------
# Shared tables — verbatim from crates/indycheck/src/data.rs and pan.rs
# ---------------------------------------------------------------------------

PAN_ENTITY_TYPES = {
    "A": "AOP",
    "B": "BODY",
    "C": "Company",
    "F": "Firm",
    "G": "Government",
    "H": "HUF",
    "J": "Artificial Juridical Person",
    "L": "Local Authority",
    "P": "Individual",
    "T": "Trust",
}

GSTIN_STATE_NAMES = {
    "01": "Jammu and Kashmir",
    "02": "Himachal Pradesh",
    "03": "Punjab",
    "04": "Chandigarh",
    "05": "Uttarakhand",
    "06": "Haryana",
    "07": "Delhi",
    "08": "Rajasthan",
    "09": "Uttar Pradesh",
    "10": "Bihar",
    "11": "Sikkim",
    "12": "Arunachal Pradesh",
    "13": "Nagaland",
    "14": "Manipur",
    "15": "Mizoram",
    "16": "Tripura",
    "17": "Meghalaya",
    "18": "Assam",
    "19": "West Bengal",
    "20": "Jharkhand",
    "21": "Odisha",
    "22": "Chhattisgarh",
    "23": "Madhya Pradesh",
    "24": "Gujarat",
    "25": "Daman and Diu and Dadra and Nagar Haveli",
    "26": "Dadra and Nagar Haveli and Daman and Diu",
    "27": "Maharashtra",
    "28": "Andhra Pradesh",
    "29": "Karnataka",
    "30": "Goa",
    "31": "Lakshadweep",
    "32": "Kerala",
    "33": "Tamil Nadu",
    "34": "Puducherry",
    "35": "Andaman and Nicobar Islands",
    "36": "Telangana",
    "37": "Andhra Pradesh",
    "38": "Ladakh",
}

# Common UPI handles, verbatim from crates/indycheck/src/data.rs.
UPI_HANDLES = [
    "paytm",
    "okaxis",
    "okhdfcbank",
    "okicici",
    "oksbi",
    "okbizaxis",
    "ybl",
    "axl",
    "ibl",
    "upi",
    "jio",
    "aubank",
    "freecharge",
    "amazonpay",
    "okbob",
    "okpnb",
    "okciti",
    "barodampay",
    "cnrb",
    "idfcfirst",
    "kvb",
    "rbl",
    "sbi",
    "hdfc",
    "icici",
    "axis",
    "kotak",
    "yesbank",
    "indus",
    "federal",
    "okyes",
    "payzapp",
    "slice",
    "gpay",
    "phonepe",
    "bhim",
]

# ---------------------------------------------------------------------------
# Optional Rust extension (maturin-built). If it is present, the pure-Python
# functions below are still used as the fallback and for parity; the
# extension is only consulted when a caller explicitly asks via
# ``_rust`` — the public API always goes through the mirror so behaviour
# stays identical across installs with and without the compiled core.
# ---------------------------------------------------------------------------

_rust = None
for _candidate in ("indycheck._rust", "indycheck._indycheck", "_indycheck"):
    try:
        import importlib

        _rust = importlib.import_module(_candidate)
        break
    except ImportError:
        continue


def _ok(reason_en, reason_hi, parsed):
    return {"valid": True, "code": "VALID", "reason_en": reason_en,
            "reason_hi": reason_hi, "parsed": parsed}


def _fail(code, reason_en, reason_hi, parsed=None):
    return {"valid": False, "code": code, "reason_en": reason_en,
            "reason_hi": reason_hi, "parsed": parsed}


def _invalid_type():
    """JS/Python-only code: the Rust core takes &str, so it has no equivalent."""
    return _fail("INVALID_TYPE", "Input must be a string.",
                 "Input string hona chahiye.")


def _as_string(value):
    """Return (trimmed str, None) or (None, error result).

    Empty input returns (None, None): callers report it with their own
    EMPTY reason strings, exactly as the Rust functions do.
    """
    if not isinstance(value, str):
        return None, _invalid_type()
    trimmed = value.strip()
    if trimmed == "":
        return None, None
    return trimmed, None


def _ascii_upper(text):
    """ASCII-only upper-casing (Rust's to_ascii_uppercase)."""
    return "".join(chr(ord(c) - 32) if "a" <= c <= "z" else c for c in text)


def _is_ascii_alpha(c):
    return ("A" <= c <= "Z") or ("a" <= c <= "z")


def _is_ascii_digit(c):
    return "0" <= c <= "9"


def _is_ascii_alnum(c):
    return _is_ascii_alpha(c) or _is_ascii_digit(c)


def _strip_spaces_hyphens(text):
    return "".join(c for c in text if not c.isspace() and c != "-")


# ---------------------------------------------------------------------------
# Options — verbatim from options.rs. All fields default to True. Only
# mobile, PAN, Aadhaar and GSTIN have validate_*_with_options variants
# in the Rust core; the other validators take no options.
# ---------------------------------------------------------------------------

DEFAULT_OPTIONS = {
    "strict": True,
    "allow_spaces_hyphens": True,
    "normalise_plus91": True,
    "uppercase": True,
}


def default_options():
    """Strict validation (the default): every rule enforced."""
    return dict(DEFAULT_OPTIONS)


def strict_options():
    """Alias for ``default_options`` (``Options::strict()`` in Rust)."""
    return dict(DEFAULT_OPTIONS)


def lenient_options():
    """Lenient validation: format only — first-digit and checksum checks
    are skipped."""
    return {"strict": False, "allow_spaces_hyphens": True,
            "normalise_plus91": True, "uppercase": True}


def no_spaces_hyphens_options():
    """Start from the defaults and turn off space/hyphen tolerance."""
    return {"strict": True, "allow_spaces_hyphens": False,
            "normalise_plus91": True, "uppercase": True}


def _resolve_options(options):
    """Merge a partial options dict onto the defaults."""
    resolved = dict(DEFAULT_OPTIONS)
    if options:
        for key in ("strict", "allow_spaces_hyphens", "normalise_plus91",
                    "uppercase"):
            if key in options and options[key] is not None:
                resolved[key] = bool(options[key])
    return resolved


def _spaces_hyphens_ok(value, options):
    """Rust ``spaces_hyphens_ok``: rejects spaces/hyphens/tabs in the raw
    input when the option forbids them. This checks the raw input, so
    leading/trailing whitespace counts too."""
    return (
        options["allow_spaces_hyphens"]
        or (" " not in value and "-" not in value and "\t" not in value)
    )


def _maybe_uppercase(value, options):
    """Rust ``maybe_uppercase``: trims, then upper-cases when the option
    says so."""
    trimmed = value.strip()
    return _ascii_upper(trimmed) if options["uppercase"] else trimmed


def _strip_spaces_hyphens_with_options(value, options):
    """Rust ``strip_spaces_hyphens``: strips whitespace and hyphens when
    the option allows it, otherwise returns the input unchanged."""
    if not options["allow_spaces_hyphens"]:
        return value
    return _strip_spaces_hyphens(value)


# ---------------------------------------------------------------------------
# Verhoeff (Aadhaar checksum) — tables verbatim from verhoeff.rs
# ---------------------------------------------------------------------------

_VERHOEFF_D = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
    [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
    [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
    [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
    [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
    [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
    [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
    [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
    [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
]

_VERHOEFF_P = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
    [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
    [8, 0, 1, 3, 2, 4, 9, 6, 7, 5],
    [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
    [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
    [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
    [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
]


def _verhoeff_valid(digits):
    c = 0
    for i, ch in enumerate(reversed(digits)):
        c = _VERHOEFF_D[c][_VERHOEFF_P[i % 8][int(ch)]]
    return c == 0


_VERHOEFF_INV = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9]


def _verhoeff_verify_digit(base):
    """Rust ``verhoeff::verify_digit``: the check digit for a digit base
    (the check digit occupies position 0, so base digits start at 1)."""
    c = 0
    for i, ch in enumerate(reversed(base)):
        c = _VERHOEFF_D[c][_VERHOEFF_P[(i + 1) % 8][int(ch)]]
    return str(_VERHOEFF_INV[c])


# ---------------------------------------------------------------------------
# GSTIN Mod-36 Luhn (alphabet 0-9A-Z) — verbatim from luhn36.rs
# ---------------------------------------------------------------------------

_GSTIN_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"


def _gstin_check_digit(first14):
    if len(first14) != 14:
        return None
    factor = 2
    total = 0
    for ch in reversed(first14):
        code = _GSTIN_ALPHABET.find(ch)
        if code < 0:
            return None
        product = code * factor
        total += product // 36 + product % 36
        factor = 1 if factor == 2 else 2
    return _GSTIN_ALPHABET[(36 - (total % 36)) % 36]


def _gstin_check_digit_valid(gstin):
    if len(gstin) != 15:
        return False
    expected = _gstin_check_digit(gstin[:14])
    return expected is not None and expected == gstin[14]


# ---------------------------------------------------------------------------
# Mobile — verbatim from mobile.rs
# ---------------------------------------------------------------------------

def _normalize_mobile(value):
    """Rust ``normalize_mobile``: strips whitespace + hyphens, one leading
    '+', then a 91 / 0 prefix only when the rest is exactly 10 digits."""
    return _normalize_mobile_with_options(value, DEFAULT_OPTIONS)


def _normalize_mobile_with_options(value, options):
    """Same as ``_normalize_mobile``, with caller-controlled options.
    With ``normalise_plus91: False`` only a bare 10-digit number is
    accepted; with ``allow_spaces_hyphens: False`` any space or hyphen
    rejects the input."""
    if options["allow_spaces_hyphens"]:
        cleaned = _strip_spaces_hyphens(value.strip())
    else:
        if any(c.isspace() or c == "-" for c in value):
            return None
        cleaned = value.strip()
    if not options["normalise_plus91"]:
        if len(cleaned) == 10 and cleaned.isascii() and cleaned.isdigit():
            return cleaned
        return None
    without_plus = cleaned[1:] if cleaned.startswith("+") else cleaned
    digits = without_plus
    if without_plus.startswith("91") and len(without_plus[2:]) == 10:
        digits = without_plus[2:]
    elif without_plus.startswith("0") and len(without_plus[1:]) == 10:
        digits = without_plus[1:]
    if len(digits) == 10 and digits.isascii() and digits.isdigit():
        return digits
    return None


def _format_mobile_string(value, options):
    """Rust ``format_mobile_with_options`` as a plain string: the
    normalised 10-digit number, or ``None``. Lenient options skip the
    first-digit (6-9) rule."""
    normalized = _normalize_mobile_with_options(value, options)
    if normalized is None:
        return None
    if not options["strict"] or normalized[0] in "6789":
        return normalized
    return None


def validate_mobile(value):
    return validate_mobile_with_options(value)


def validate_mobile_with_options(value, options=None):
    """Same as ``validate_mobile``, with caller-controlled options.
    With ``strict: False`` the first-digit rule is skipped (format only)."""
    try:
        opts = _resolve_options(options)
        if not isinstance(value, str):
            return _invalid_type()
        if value.strip() == "":
            return _fail("EMPTY", "Mobile number is empty", "Mobile number khaali hai")
        normalized = _normalize_mobile_with_options(value, opts)
        if normalized is None:
            return _fail(
                "INVALID_FORMAT",
                "Mobile number must be 10 digits, optionally with +91, 91 or 0 prefix",
                "Mobile number 10 digit ka hona chahiye, +91, 91 ya 0 ke saath bhi chalega",
            )
        if opts["strict"] and normalized[0] not in "6789":
            return _fail(
                "INVALID_FIRST_DIGIT",
                "Indian mobile numbers start with 6, 7, 8 or 9",
                "Bharat ke mobile number 6, 7, 8 ya 9 se shuru hote hain",
            )
        return _ok("Mobile number format is valid", "Mobile number ka format sahi hai",
                   {"normalized": normalized})
    except Exception:
        return _invalid_type()


def format_mobile(value):
    """Same contract as validate_mobile; ``parsed["normalized"]`` is the
    10-digit string (Rust ``format_mobile`` returns exactly that, or None)."""
    return validate_mobile(value)


def format_mobile_with_options(value, options=None):
    """Same contract as ``validate_mobile_with_options``; see
    ``format_mobile``."""
    return validate_mobile_with_options(value, options)


def mask_mobile(value):
    """Masks a mobile number as ``******3210`` (6 asterisks + last 4
    digits). Returns ``""`` when the input is not a valid-format mobile
    number. A non-empty result is not proof of validity."""
    if not isinstance(value, str):
        return ""
    normalized = _format_mobile_string(value, DEFAULT_OPTIONS)
    return f"******{normalized[6:]}" if normalized is not None else ""


# ---------------------------------------------------------------------------
# PAN — verbatim from pan.rs
# ---------------------------------------------------------------------------

def validate_pan(value):
    return validate_pan_with_options(value)


def validate_pan_with_options(value, options=None):
    """Same as ``validate_pan``, with caller-controlled options.
    For PAN, ``strict``/lenient make no difference (there is no checksum
    or first-digit rule to skip); ``uppercase`` and
    ``allow_spaces_hyphens`` do."""
    try:
        opts = _resolve_options(options)
        if not isinstance(value, str):
            return _invalid_type()
        if value.strip() == "":
            return _fail("EMPTY", "PAN is empty", "PAN khaali hai")
        if not _spaces_hyphens_ok(value, opts):
            return _fail(
                "INVALID_FORMAT",
                "PAN must not contain spaces or hyphens with these options",
                "In options ke saath PAN me space ya hyphen nahi hona chahiye",
            )
        upper = _strip_spaces_hyphens_with_options(_maybe_uppercase(value, opts), opts)
        if not opts["uppercase"] and any("a" <= c <= "z" for c in upper):
            return _fail(
                "INVALID_FORMAT",
                "PAN must be upper-case with these options",
                "In options ke saath PAN upper-case me hona chahiye",
            )
        if len(upper) != 10:
            return _fail(
                "INVALID_LENGTH",
                "PAN must be exactly 10 characters",
                "PAN bilkul 10 character ka hona chahiye",
            )
        chars = list(upper)
        format_ok = (
            all(_is_ascii_alpha(c) for c in chars[:5])
            and all(_is_ascii_digit(c) for c in chars[5:9])
            and _is_ascii_alpha(chars[9])
        )
        if not format_ok:
            return _fail(
                "INVALID_FORMAT",
                "PAN format must be 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F). PAN has no public checksum, so only the format is checked",
                "PAN ka format 5 akshar, 4 digit, 1 akshar hona chahiye (jaise ABCDE1234F). PAN ka koi public checksum nahi hai, isliye sirf format check hota hai",
            )
        # An unlisted 4th character is reported as entity "Unknown" and
        # the PAN is still format-valid (pan.rs). INVALID_ENTITY is a
        # reserved stable code, not emitted in v0.1.
        entity = PAN_ENTITY_TYPES.get(chars[3], "Unknown")
        return _ok(
            "PAN format is valid. PAN has no public checksum, so this only checks the format",
            "PAN ka format sahi hai. PAN ka koi public checksum nahi hai, isliye sirf format check hua hai",
            {"entity": entity, "entity_code": chars[3]},
        )
    except Exception:
        return _invalid_type()


def format_pan(value):
    """Formats a PAN: upper-cases it and strips spaces/hyphens.
    Returns ``"ABCDE1234F"`` when the result matches the PAN pattern,
    otherwise ``None``."""
    if not isinstance(value, str):
        return None
    upper = _strip_spaces_hyphens_with_options(
        _maybe_uppercase(value, DEFAULT_OPTIONS), DEFAULT_OPTIONS)
    return upper if _is_pan_pattern(upper) else None


def mask_pan(value):
    """Masks a PAN as ``ABCDE****F`` (first 5 chars, 4 asterisks, last
    char). Returns ``""`` when the input is not a valid-format PAN.
    A non-empty result is not proof of validity — use ``validate_pan``."""
    pan = format_pan(value)
    return f"{pan[:5]}****{pan[9:]}" if pan is not None else ""


# ---------------------------------------------------------------------------
# Aadhaar — verbatim from aadhaar.rs
# ---------------------------------------------------------------------------

def mask_aadhaar_string(value):
    """Rust ``mask_aadhaar``: masks any 12-digit string, else ``""``."""
    cleaned = _strip_spaces_hyphens(value.strip())
    if len(cleaned) != 12 or not cleaned.isdigit():
        return ""
    return f"XXXX XXXX {cleaned[8:]}"


def validate_aadhaar(value):
    return validate_aadhaar_with_options(value)


def validate_aadhaar_with_options(value, options=None):
    """Same as ``validate_aadhaar``, with caller-controlled options.
    With ``strict: False`` the first-digit and Verhoeff checksum checks
    are skipped (12 digits only). With ``allow_spaces_hyphens: False``,
    spaces or hyphens in the input are an ``INVALID_FORMAT`` error."""
    try:
        opts = _resolve_options(options)
        if not isinstance(value, str):
            return _invalid_type()
        if value.strip() == "":
            return _fail("EMPTY", "Aadhaar number is empty", "Aadhaar number khaali hai")
        if not _spaces_hyphens_ok(value, opts):
            return _fail(
                "INVALID_FORMAT",
                "Aadhaar number must not contain spaces or hyphens with these options",
                "In options ke saath Aadhaar number me space ya hyphen nahi hona chahiye",
            )
        cleaned = _strip_spaces_hyphens_with_options(value.strip(), opts)
        if len(cleaned) != 12:
            return _fail(
                "INVALID_LENGTH",
                "Aadhaar number must be exactly 12 digits",
                "Aadhaar number bilkul 12 digit ka hona chahiye",
            )
        if not cleaned.isdigit() or not cleaned.isascii():
            return _fail(
                "INVALID_FORMAT",
                "Aadhaar number must contain only digits",
                "Aadhaar number me sirf digit hone chahiye",
            )
        if opts["strict"] and cleaned[0] not in "23456789":
            return _fail(
                "INVALID_FIRST_DIGIT",
                "Aadhaar number must start with 2-9",
                "Aadhaar number 2 se 9 ke beech wale digit se shuru hona chahiye",
            )
        if opts["strict"] and not _verhoeff_valid(cleaned):
            return _fail(
                "INVALID_CHECKSUM",
                "Aadhaar checksum is invalid (Verhoeff check failed)",
                "Aadhaar ka checksum galat hai (Verhoeff check fail hua)",
            )
        return _ok(
            "Aadhaar number format and checksum are valid",
            "Aadhaar number ka format aur checksum sahi hai",
            {"masked": mask_aadhaar_string(cleaned)},
        )
    except Exception:
        return _invalid_type()


def mask_aadhaar(value):
    """Same contract as validate_aadhaar; ``parsed["masked"]`` is the result.
    (Differs from Rust ``mask_aadhaar``, which masks any 12-digit string.)"""
    return validate_aadhaar(value)


# ---------------------------------------------------------------------------
# GSTIN — verbatim from gstin.rs
# ---------------------------------------------------------------------------

def validate_gstin(value):
    return validate_gstin_with_options(value)


def validate_gstin_with_options(value, options=None):
    """Same as ``validate_gstin``, with caller-controlled options.
    With ``strict: False`` the Mod-36 check-digit check is skipped
    (format and state code still checked). With
    ``allow_spaces_hyphens: False``, spaces or hyphens in the input are
    an ``INVALID_FORMAT`` error."""
    try:
        opts = _resolve_options(options)
        if not isinstance(value, str):
            return _invalid_type()
        if value.strip() == "":
            return _fail("EMPTY", "GSTIN is empty", "GSTIN khaali hai")
        if not _spaces_hyphens_ok(value, opts):
            return _fail(
                "INVALID_FORMAT",
                "GSTIN must not contain spaces or hyphens with these options",
                "In options ke saath GSTIN me space ya hyphen nahi hona chahiye",
            )
        upper = _strip_spaces_hyphens_with_options(_maybe_uppercase(value, opts), opts)
        if not opts["uppercase"] and any("a" <= c <= "z" for c in upper):
            return _fail(
                "INVALID_FORMAT",
                "GSTIN must be upper-case with these options",
                "In options ke saath GSTIN upper-case me hona chahiye",
            )
        if len(upper) != 15:
            return _fail(
                "INVALID_LENGTH",
                "GSTIN must be exactly 15 characters",
                "GSTIN bilkul 15 character ka hona chahiye",
            )
        chars = list(upper)
        if not all(_is_ascii_digit(c) for c in chars[:2]):
            return _fail(
                "INVALID_FORMAT",
                "GSTIN must start with a 2-digit state code",
                "GSTIN 2 digit ke state code se shuru hona chahiye",
            )
        state_code = "".join(chars[:2])
        state = GSTIN_STATE_NAMES.get(state_code)
        if state is None:
            return _fail(
                "INVALID_STATE_CODE",
                "GSTIN state code is not a valid Indian state code (01-38)",
                "GSTIN ka state code sahi nahi hai (01-38 ke beech hona chahiye)",
            )
        pan = "".join(chars[2:12])
        pan_chars = list(pan)
        pan_format_ok = (
            all(_is_ascii_alpha(c) for c in pan_chars[:5])
            and all(_is_ascii_digit(c) for c in pan_chars[5:9])
            and _is_ascii_alpha(pan_chars[9])
        )
        if not pan_format_ok:
            return _fail(
                "INVALID_FORMAT",
                "GSTIN characters 3-12 must be a PAN in 5 letters, 4 digits, 1 letter format",
                "GSTIN ke 3 se 12 tak ke character PAN format me hone chahiye (5 akshar, 4 digit, 1 akshar)",
            )
        if not _is_ascii_alnum(chars[12]):
            return _fail(
                "INVALID_FORMAT",
                "GSTIN 13th character must be a letter or digit (entity number)",
                "GSTIN ka 13th character akshar ya digit hona chahiye",
            )
        if chars[13] != "Z":
            return _fail(
                "INVALID_FORMAT",
                "GSTIN 14th character must be Z",
                "GSTIN ka 14th character Z hona chahiye",
            )
        if not _is_ascii_alnum(chars[14]):
            return _fail(
                "INVALID_FORMAT",
                "GSTIN 15th character must be a letter or digit (check digit)",
                "GSTIN ka 15th character akshar ya digit hona chahiye",
            )
        if opts["strict"] and not _gstin_check_digit_valid(upper):
            return _fail(
                "INVALID_CHECKSUM",
                "GSTIN check digit is invalid (Mod-36 Luhn check failed)",
                "GSTIN ka check digit galat hai (Mod-36 Luhn check fail hua)",
            )
        return _ok(
            "GSTIN format, state code and check digit are valid",
            "GSTIN ka format, state code aur check digit sahi hai",
            {"state": state, "state_code": state_code, "pan": pan},
        )
    except Exception:
        return _invalid_type()


def format_gstin(value):
    """Formats a GSTIN: upper-cases it and strips spaces/hyphens.
    Returns the formatted GSTIN when its structure is in place (state
    code, PAN part and ``Z``); the check digit is NOT verified here —
    so a ``format_gstin`` result can still fail ``validate_gstin``.
    Returns ``None`` otherwise."""
    if not isinstance(value, str):
        return None
    result = validate_gstin_with_options(value, lenient_options())
    if not result["valid"]:
        return None
    return _strip_spaces_hyphens_with_options(
        _maybe_uppercase(value, DEFAULT_OPTIONS), DEFAULT_OPTIONS)


# ---------------------------------------------------------------------------
# IFSC — verbatim from ifsc.rs
# ---------------------------------------------------------------------------

def validate_ifsc(value):
    try:
        text, err = _as_string(value)
        if err is not None:
            return err
        if text is None:
            return _fail("EMPTY", "IFSC is empty", "IFSC khaali hai")
        upper = _ascii_upper(text)
        if len(upper) != 11:
            return _fail(
                "INVALID_LENGTH",
                "IFSC must be exactly 11 characters",
                "IFSC bilkul 11 character ka hona chahiye",
            )
        chars = list(upper)
        format_ok = (
            all(_is_ascii_alpha(c) for c in chars[:4])
            and chars[4] == "0"
            and all(_is_ascii_alnum(c) for c in chars[5:])
        )
        if not format_ok:
            return _fail(
                "INVALID_FORMAT",
                "IFSC format must be 4 letters, 0, then 6 letters/digits (e.g. SBIN0000123). IFSC has no checksum, so only the format is checked",
                "IFSC ka format 4 akshar, 0, phir 6 akshar/digit hona chahiye (jaise SBIN0000123). IFSC ka koi checksum nahi hai, isliye sirf format check hota hai",
            )
        return _ok(
            "IFSC format is valid. IFSC has no checksum, so this only checks the format",
            "IFSC ka format sahi hai. IFSC ka koi checksum nahi hai, isliye sirf format check hua hai",
            {"bank_code": "".join(chars[:4]), "branch_code": "".join(chars[5:])},
        )
    except Exception:
        return _invalid_type()


# ---------------------------------------------------------------------------
# UPI — verbatim from upi.rs
# ---------------------------------------------------------------------------

def validate_upi(value):
    try:
        text, err = _as_string(value)
        if err is not None:
            return err
        if text is None:
            return _fail("EMPTY", "UPI ID is empty", "UPI ID khaali hai")
        trimmed = text
        parts = trimmed.split("@")
        if len(parts) != 2:
            return _fail(
                "INVALID_FORMAT",
                "UPI ID must be in name@handle format (e.g. name@okaxis)",
                "UPI ID name@handle format me hona chahiye (jaise name@okaxis)",
            )
        name, handle = parts
        if len(name) < 2 or len(name) > 50:
            return _fail(
                "INVALID_FORMAT",
                "UPI name must be 2-50 characters long",
                "UPI name 2 se 50 character ka hona chahiye",
            )
        if not all(_is_ascii_alnum(c) or c in ".-_" for c in name):
            return _fail(
                "INVALID_FORMAT",
                "UPI name may only contain letters, digits, dot, hyphen or underscore",
                "UPI name me sirf akshar, digit, dot, hyphen ya underscore ho sakte hain",
            )
        if handle == "":
            return _fail(
                "INVALID_HANDLE",
                "UPI handle is missing after @",
                "UPI handle @ ke baad khaali hai",
            )
        if handle.lower() not in UPI_HANDLES:
            return _fail(
                "INVALID_HANDLE",
                "UPI handle is not a known handle",
                "UPI handle jaana-pehchana handle nahi hai",
            )
        return _ok("UPI ID format is valid", "UPI ID ka format sahi hai",
                   {"handle": handle.lower()})
    except Exception:
        return _invalid_type()


# ---------------------------------------------------------------------------
# PIN code — verbatim from pincode.rs
# ---------------------------------------------------------------------------

def validate_pincode(value):
    try:
        text, err = _as_string(value)
        if err is not None:
            return err
        if text is None:
            return _fail("EMPTY", "PIN code is empty", "PIN code khaali hai")
        trimmed = text
        if len(trimmed) != 6:
            return _fail(
                "INVALID_LENGTH",
                "PIN code must be exactly 6 digits",
                "PIN code bilkul 6 digit ka hona chahiye",
            )
        if not trimmed.isdigit() or not trimmed.isascii():
            return _fail(
                "INVALID_FORMAT",
                "PIN code must contain only digits",
                "PIN code me sirf digit hone chahiye",
            )
        if trimmed[0] not in "123456789":
            return _fail(
                "INVALID_FIRST_DIGIT",
                "PIN code must start with 1-9",
                "PIN code 1 se 9 ke beech wale digit se shuru hona chahiye",
            )
        return _ok("PIN code format is valid", "PIN code ka format sahi hai",
                   {"pincode": trimmed})
    except Exception:
        return _invalid_type()


# ---------------------------------------------------------------------------
# TAN — verbatim from tan.rs
# ---------------------------------------------------------------------------

def validate_tan(value):
    try:
        text, err = _as_string(value)
        if err is not None:
            return err
        if text is None:
            return _fail("EMPTY", "TAN is empty", "TAN khaali hai")
        upper = _ascii_upper(text)
        if len(upper) != 10:
            return _fail(
                "INVALID_LENGTH",
                "TAN must be exactly 10 characters",
                "TAN bilkul 10 character ka hona chahiye",
            )
        chars = list(upper)
        format_ok = (
            all(_is_ascii_alpha(c) for c in chars[:4])
            and all(_is_ascii_digit(c) for c in chars[4:9])
            and _is_ascii_alpha(chars[9])
        )
        if not format_ok:
            return _fail(
                "INVALID_FORMAT",
                "TAN format must be 4 letters, 5 digits, 1 letter (e.g. ABCD12345E). TAN has no checksum, so only the format is checked",
                "TAN ka format 4 akshar, 5 digit, 1 akshar hona chahiye (jaise ABCD12345E). TAN ka koi checksum nahi hai, isliye sirf format check hota hai",
            )
        return _ok(
            "TAN format is valid. TAN has no checksum, so this only checks the format",
            "TAN ka format sahi hai. TAN ka koi checksum nahi hai, isliye sirf format check hua hai",
            {"tan": upper},
        )
    except Exception:
        return _invalid_type()


# ---------------------------------------------------------------------------
# CIN — verbatim from cin.rs
# ---------------------------------------------------------------------------

def validate_cin(value):
    try:
        text, err = _as_string(value)
        if err is not None:
            return err
        if text is None:
            return _fail("EMPTY", "CIN is empty", "CIN khaali hai")
        upper = _ascii_upper(text)
        if len(upper) != 21:
            return _fail(
                "INVALID_LENGTH",
                "CIN must be exactly 21 characters",
                "CIN bilkul 21 character ka hona chahiye",
            )
        chars = list(upper)
        listing_ok = chars[0] in ("L", "U")
        format_ok = (
            all(_is_ascii_digit(c) for c in chars[1:6])
            and all(_is_ascii_alpha(c) for c in chars[6:8])
            and all(_is_ascii_digit(c) for c in chars[8:12])
            and all(_is_ascii_alpha(c) for c in chars[12:15])
            and all(_is_ascii_digit(c) for c in chars[15:21])
        )
        if not listing_ok:
            return _fail(
                "INVALID_FORMAT",
                "CIN must start with L (listed) or U (unlisted)",
                "CIN L (listed) ya U (unlisted) se shuru hona chahiye",
            )
        if not format_ok:
            return _fail(
                "INVALID_FORMAT",
                "CIN format must be L/U + 5 digits + 2 letters + 4 digits + 3 letters + 6 digits (e.g. L12345MH2020PLC123456). CIN has no checksum, so only the format is checked",
                "CIN ka format L/U + 5 digit + 2 akshar + 4 digit + 3 akshar + 6 digit hona chahiye (jaise L12345MH2020PLC123456). CIN ka koi checksum nahi hai, isliye sirf format check hota hai",
            )
        listing = "Listed" if chars[0] == "L" else "Unlisted"
        return _ok(
            "CIN format is valid. CIN has no checksum, so this only checks the format",
            "CIN ka format sahi hai. CIN ka koi checksum nahi hai, isliye sirf format check hua hai",
            {
                "cin": upper,
                "listing": listing,
                "industry_code": "".join(chars[1:6]),
                "state_code": "".join(chars[6:8]),
                "year": "".join(chars[8:12]),
                "company_type": "".join(chars[12:15]),
                "registration_number": "".join(chars[15:21]),
            },
        )
    except Exception:
        return _invalid_type()


# ---------------------------------------------------------------------------
# LLPIN — verbatim from llpin.rs
# ---------------------------------------------------------------------------

def validate_llpin(value):
    try:
        text, err = _as_string(value)
        if err is not None:
            return err
        if text is None:
            return _fail("EMPTY", "LLPIN is empty", "LLPIN khaali hai")
        upper = _ascii_upper(text)
        if len(upper) != 7:
            return _fail(
                "INVALID_LENGTH",
                "LLPIN must be exactly 7 characters",
                "LLPIN bilkul 7 character ka hona chahiye",
            )
        chars = list(upper)
        format_ok = (
            all(_is_ascii_alpha(c) for c in chars[:3])
            and all(_is_ascii_digit(c) for c in chars[3:])
        )
        if not format_ok:
            return _fail(
                "INVALID_FORMAT",
                "LLPIN format must be 3 letters followed by 4 digits (e.g. AAA1234). LLPIN has no checksum, so only the format is checked",
                "LLPIN ka format 3 akshar phir 4 digit hona chahiye (jaise AAA1234). LLPIN ka koi checksum nahi hai, isliye sirf format check hota hai",
            )
        return _ok(
            "LLPIN format is valid. LLPIN has no checksum, so this only checks the format",
            "LLPIN ka format sahi hai. LLPIN ka koi checksum nahi hai, isliye sirf format check hua hai",
            {"llpin": upper},
        )
    except Exception:
        return _invalid_type()


# ---------------------------------------------------------------------------
# Voter ID / EPIC — verbatim from voter.rs
# ---------------------------------------------------------------------------

def validate_voter_id(value):
    try:
        text, err = _as_string(value)
        if err is not None:
            return err
        if text is None:
            return _fail("EMPTY", "Voter ID is empty", "Voter ID khaali hai")
        upper = _ascii_upper(text)
        if len(upper) != 10:
            return _fail(
                "INVALID_LENGTH",
                "Voter ID must be exactly 10 characters",
                "Voter ID bilkul 10 character ka hona chahiye",
            )
        chars = list(upper)
        format_ok = (
            all(_is_ascii_alpha(c) for c in chars[:3])
            and all(_is_ascii_digit(c) for c in chars[3:])
        )
        if not format_ok:
            return _fail(
                "INVALID_FORMAT",
                "Voter ID format must be 3 letters followed by 7 digits (e.g. ABC1234567). Voter ID has no checksum, so only the format is checked",
                "Voter ID ka format 3 akshar phir 7 digit hona chahiye (jaise ABC1234567). Voter ID ka koi checksum nahi hai, isliye sirf format check hua hai",
            )
        return _ok(
            "Voter ID format is valid. Voter ID has no checksum, so this only checks the format",
            "Voter ID ka format sahi hai. Voter ID ka koi checksum nahi hai, isliye sirf format check hua hai",
            {"epic": upper},
        )
    except Exception:
        return _invalid_type()


def validate_epic(value):
    """Alias for ``validate_voter_id``: EPIC is the name printed on the card."""
    return validate_voter_id(value)


# ---------------------------------------------------------------------------
# Vehicle registration — verbatim from vehicle.rs
# ---------------------------------------------------------------------------

def validate_vehicle(value):
    try:
        text, err = _as_string(value)
        if err is not None:
            return err
        # Unlike _as_string's plain trim, vehicle strips spaces/hyphens
        # anywhere in the string (vehicle.rs filters them before checking).
        cleaned = _strip_spaces_hyphens(_ascii_upper(text if text is not None else ""))
        if cleaned == "":
            return _fail(
                "EMPTY",
                "Vehicle registration number is empty",
                "Vehicle registration number khaali hai",
            )
        chars = list(cleaned)
        if len(chars) < 8 or len(chars) > 10:
            return _fail(
                "INVALID_LENGTH",
                "Vehicle registration number must be 8-10 characters (e.g. DL01AB1234)",
                "Vehicle registration number 8 se 10 character ka hona chahiye (jaise DL01AB1234)",
            )
        if not all(_is_ascii_alpha(c) for c in chars[:2]):
            return _fail(
                "INVALID_FORMAT",
                "Vehicle registration number must start with 2 state-code letters (e.g. DL01AB1234)",
                "Vehicle registration number 2 state-code akshar se shuru hona chahiye (jaise DL01AB1234)",
            )
        # Parse: district digits (1-2), series letters (1-2), number digits (1-4).
        i = 2
        district_start = i
        while i < len(chars) and _is_ascii_digit(chars[i]) and i - district_start < 2:
            i += 1
        district = "".join(chars[district_start:i])
        series_start = i
        while i < len(chars) and _is_ascii_alpha(chars[i]) and i - series_start < 2:
            i += 1
        series = "".join(chars[series_start:i])
        number_start = i
        while i < len(chars) and _is_ascii_digit(chars[i]) and i - number_start < 4:
            i += 1
        number = "".join(chars[number_start:i])
        format_ok = district != "" and series != "" and number != "" and i == len(chars)
        if not format_ok:
            return _fail(
                "INVALID_FORMAT",
                "Vehicle registration format must be state letters + district digits + series letters + number digits (e.g. DL01AB1234). Registration numbers have no checksum, so only the format is checked",
                "Vehicle registration ka format state akshar + district digit + series akshar + number digit hona chahiye (jaise DL01AB1234). Registration number ka koi checksum nahi hai, isliye sirf format check hota hai",
            )
        state_code = "".join(chars[:2])
        return _ok(
            "Vehicle registration format is valid. Registration numbers have no checksum, so this only checks the format",
            "Vehicle registration ka format sahi hai. Registration number ka koi checksum nahi hai, isliye sirf format check hua hai",
            {"registration": cleaned, "state_code": state_code,
             "district": district, "series": series, "number": number},
        )
    except Exception:
        return _invalid_type()


def validate_vehicle_registration(value):
    """Alias for ``validate_vehicle``."""
    return validate_vehicle(value)


# ---------------------------------------------------------------------------
# Mock test-data generators — verbatim from generate.rs
#
# TEST DATA ONLY — syntactically valid, not real issued IDs. Every value
# produced here passes this library's own validators, but it was never
# issued by any authority (UIDAI, Income Tax, GSTN, …) and must never be
# presented as a real person's ID. Use them only in tests, demos and
# form previews. The generator is intentionally not seeded and not
# reproducible: each call may return a different value.
# ---------------------------------------------------------------------------

def _random_letter():
    return chr(ord("A") + random.randrange(26))


def _random_digit():
    return str(random.randrange(10))


def _random_digit_range(low, high):
    return str(random.randrange(low, high + 1))


def generate_pan(entity="P"):
    """Generates a syntactically valid PAN for the given entity character
    (``P``, ``C``, ``H``, ``F``, ``A``, ``T``, ``B``, ``L``, ``J`` or
    ``G``). An unknown entity character falls back to ``P`` (Individual).
    TEST DATA ONLY — not a real issued PAN."""
    code = "P"
    if isinstance(entity, str) and len(entity) > 0:
        first = _ascii_upper(entity[0])
        if first in PAN_ENTITY_TYPES:
            code = first
    return (
        _random_letter() + _random_letter() + _random_letter() + code
        + _random_letter() + _random_digit() + _random_digit()
        + _random_digit() + _random_digit() + _random_letter()
    )


def generate_aadhaar():
    """Generates a syntactically valid 12-digit Aadhaar number (first
    digit 2-9, correct Verhoeff check digit).
    TEST DATA ONLY — not a real issued Aadhaar number."""
    base = _random_digit_range(2, 9)
    for _ in range(10):
        base += _random_digit()
    return base + _verhoeff_verify_digit(base)


def generate_gstin(state_code="18"):
    """Generates a syntactically valid GSTIN for the given 2-digit state
    code (e.g. ``"18"`` for Assam). An unknown state code falls back to
    ``"18"``. TEST DATA ONLY — not a real issued GSTIN."""
    code = state_code if isinstance(state_code, str) and state_code in GSTIN_STATE_NAMES else "18"
    pan = generate_pan("P")
    entity_char = "1" if random.random() < 0.5 else "2"
    first14 = f"{code}{pan}{entity_char}Z"
    check = _gstin_check_digit(first14) or "0"
    return first14 + check


def generate_mobile():
    """Generates a syntactically valid Indian mobile number (10 digits,
    first digit 6-9). TEST DATA ONLY — not a real person's number."""
    mobile = _random_digit_range(6, 9)
    for _ in range(9):
        mobile += _random_digit()
    return mobile


# ---------------------------------------------------------------------------
# detect / validate_many — detect verbatim from lib.rs
# ---------------------------------------------------------------------------

_VALIDATORS = {
    "mobile": validate_mobile,
    "pan": validate_pan,
    "aadhaar": validate_aadhaar,
    "gstin": validate_gstin,
    "ifsc": validate_ifsc,
    "upi": validate_upi,
    "pincode": validate_pincode,
    "tan": validate_tan,
    "cin": validate_cin,
    "llpin": validate_llpin,
    "voter": validate_voter_id,
    "vehicle": validate_vehicle,
}


def _is_pan_pattern(text):
    chars = list(text)
    return (
        len(chars) == 10
        and all(_is_ascii_alpha(c) for c in chars[:5])
        and all(_is_ascii_digit(c) for c in chars[5:9])
        and _is_ascii_alpha(chars[9])
    )


def _is_ifsc_pattern(text):
    chars = list(text)
    return (
        len(chars) == 11
        and all(_is_ascii_alpha(c) for c in chars[:4])
        and chars[4] == "0"
        and all(_is_ascii_alnum(c) for c in chars[5:])
    )


def _is_tan_pattern(text):
    chars = list(text)
    return (
        len(chars) == 10
        and all(_is_ascii_alpha(c) for c in chars[:4])
        and all(_is_ascii_digit(c) for c in chars[4:9])
        and _is_ascii_alpha(chars[9])
    )


def _is_voter_pattern(text):
    chars = list(text)
    return (
        len(chars) == 10
        and all(_is_ascii_alpha(c) for c in chars[:3])
        and all(_is_ascii_digit(c) for c in chars[3:])
    )


def _is_cin_pattern(text):
    chars = list(text)
    return (
        len(chars) == 21
        and chars[0] in ("L", "U")
        and all(_is_ascii_digit(c) for c in chars[1:6])
        and all(_is_ascii_alpha(c) for c in chars[6:8])
        and all(_is_ascii_digit(c) for c in chars[8:12])
        and all(_is_ascii_alpha(c) for c in chars[12:15])
        and all(_is_ascii_digit(c) for c in chars[15:21])
    )


def _is_llpin_pattern(text):
    chars = list(text)
    return (
        len(chars) == 7
        and all(_is_ascii_alpha(c) for c in chars[:3])
        and all(_is_ascii_digit(c) for c in chars[3:])
    )


def _is_vehicle_pattern(text):
    # Cheap structural check used only by detect(); the real validation
    # (district/series/number parsing) lives in validate_vehicle.
    cleaned = _strip_spaces_hyphens(text)
    return validate_vehicle(cleaned)["valid"]


def detect_type(value):
    """The Rust ``detect`` string for a string input (lib.rs order)."""
    trimmed = value.strip()
    if trimmed == "":
        return "unknown"
    if "@" in trimmed:
        return "upi"
    upper = _ascii_upper(trimmed)
    length = len(trimmed)
    all_digits = trimmed.isdigit() and trimmed.isascii()
    # A Verhoeff-valid 12-digit number is an Aadhaar even if it also looks
    # like a 91-prefixed mobile; otherwise a normalisable mobile wins over
    # the length-15 GSTIN branch (e.g. "+91 98765 43210" is 15 chars long).
    if length == 12 and all_digits and _verhoeff_valid(trimmed):
        return "aadhaar"
    # Spaced / hyphenated Aadhaar, e.g. "2345 6789 0124".
    digits_only = "".join(c for c in trimmed if _is_ascii_digit(c))
    if len(digits_only) == 12 and _verhoeff_valid(digits_only):
        return "aadhaar"
    if _normalize_mobile(trimmed) is not None:
        return "mobile"
    # CIN is 21 chars and unambiguous by length.
    if length == 21 and _is_cin_pattern(upper):
        return "cin"
    if length == 15:
        return "gstin"
    if length == 12 and all_digits:
        return "aadhaar"
    if length == 11 and _is_ifsc_pattern(upper):
        return "ifsc"
    if length == 10 and _is_pan_pattern(upper):
        return "pan"
    if length == 10 and _is_tan_pattern(upper):
        return "tan"
    if length == 10 and _is_voter_pattern(upper):
        return "voter"
    if length == 10 and all_digits:
        return "mobile"
    if length == 7 and _is_llpin_pattern(upper):
        return "llpin"
    if length == 6 and all_digits:
        return "pincode"
    # Formatted mobiles such as "+91 98765 43210" are longer than 10 chars.
    if _format_mobile_string(trimmed, DEFAULT_OPTIONS) is not None:
        return "mobile"
    if _is_pan_pattern(upper):
        return "pan"
    if _is_tan_pattern(upper):
        return "tan"
    if _is_voter_pattern(upper):
        return "voter"
    if _is_ifsc_pattern(upper):
        return "ifsc"
    if _is_llpin_pattern(upper):
        return "llpin"
    if _is_vehicle_pattern(upper):
        return "vehicle"
    return "unknown"


def detect(value):
    try:
        if not isinstance(value, str):
            return _fail("INVALID_TYPE", "Input must be a string.",
                         "Input string hona chahiye.",
                         {"type": None, "value": None, "result": None})
        trimmed = value.strip()
        type_name = detect_type(value)
        if type_name == "unknown":
            return _fail("UNKNOWN_TYPE",
                         "Could not detect the type of this input",
                         "Is input ka type pehchana nahi ja saka",
                         {"type": "unknown", "value": trimmed, "result": None})
        result = _VALIDATORS[type_name](value)
        return {"valid": result["valid"], "code": result["code"],
                "reason_en": result["reason_en"], "reason_hi": result["reason_hi"],
                "parsed": {"type": type_name, "value": trimmed, "result": result}}
    except Exception:
        return _fail("INVALID_TYPE", "Input must be a string.",
                     "Input string hona chahiye.",
                     {"type": None, "value": None, "result": None})


def validate_many(values):
    try:
        if not isinstance(values, list):
            return _fail("INVALID_TYPE", "Input must be a string.",
                         "Input string hona chahiye.",
                         {"results": [], "total": 0, "validCount": 0, "invalidCount": 0})
        if len(values) == 0:
            return _fail("EMPTY", "Input is empty.", "Input khaali hai.",
                         {"results": [], "total": 0, "validCount": 0, "invalidCount": 0})
        # Mirrors Rust ``validate_many``: each input is detected, then
        # validated with the matching validator. An undetectable input gets
        # UNKNOWN_TYPE with the Rust reason strings.
        results = []
        for item in values:
            if (isinstance(item, dict) and "value" in item
                    and isinstance(item.get("type"), str)
                    and item["type"] in _VALIDATORS):
                type_name = item["type"]
                result = _VALIDATORS[type_name](item["value"])
            elif isinstance(item, str):
                detected = detect_type(item)
                type_name = None if detected == "unknown" else detected
                result = (
                    _fail("UNKNOWN_TYPE",
                          "Could not detect the type of this input",
                          "Is input ka type pehchana nahi ja saka")
                    if detected == "unknown"
                    else _VALIDATORS[detected](item)
                )
            else:
                type_name = None
                result = _invalid_type()
            results.append({
                "input": item,
                "type": type_name,
                "valid": result["valid"],
                "code": result["code"],
                "reason_en": result["reason_en"],
                "reason_hi": result["reason_hi"],
                "parsed": result["parsed"],
            })
        valid_count = sum(1 for r in results if r["valid"])
        invalid_count = len(results) - valid_count
        parsed = {"results": results, "total": len(results),
                  "validCount": valid_count, "invalidCount": invalid_count}
        if invalid_count == 0:
            return _ok("All inputs are valid.", "Saare input sahi hain.", parsed)
        # Wrapper-only code: the Rust core returns a bare list for batches.
        return _fail("SOME_INVALID", "Some inputs are invalid.",
                     "Kuch input galat hain.", parsed)
    except Exception:
        return _fail("INVALID_TYPE", "Input must be a string.",
                     "Input string hona chahiye.",
                     {"results": [], "total": 0, "validCount": 0, "invalidCount": 0})


# camelCase aliases (parity with the JS package)
validateMobile = validate_mobile
validatePan = validate_pan
validateAadhaar = validate_aadhaar
validateGstin = validate_gstin
validateIfsc = validate_ifsc
validateUpi = validate_upi
validatePincode = validate_pincode
validateTan = validate_tan
validateCin = validate_cin
validateLlpin = validate_llpin
validateVoterId = validate_voter_id
validateEpic = validate_epic
validateVehicle = validate_vehicle
validateVehicleRegistration = validate_vehicle_registration
validateMobileWithOptions = validate_mobile_with_options
validatePanWithOptions = validate_pan_with_options
validateAadhaarWithOptions = validate_aadhaar_with_options
validateGstinWithOptions = validate_gstin_with_options
formatMobile = format_mobile
formatMobileWithOptions = format_mobile_with_options
formatPan = format_pan
formatGstin = format_gstin
maskAadhaar = mask_aadhaar
maskPan = mask_pan
maskMobile = mask_mobile
generatePan = generate_pan
generateAadhaar = generate_aadhaar
generateGstin = generate_gstin
generateMobile = generate_mobile
defaultOptions = default_options
strictOptions = strict_options
lenientOptions = lenient_options
noSpacesHyphensOptions = no_spaces_hyphens_options
detectType = detect_type
validateMany = validate_many
