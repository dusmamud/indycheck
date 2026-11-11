# indycheck (Python)

Offline Indian ID validator — mobile, PAN, Aadhaar, GSTIN, IFSC, UPI, PIN code, TAN, CIN, LLPIN, Voter ID / EPIC and vehicle registration. Format + checksum only, no network, no government database.

```bash
pip install indycheck
```

```python
from indycheck import validate_pan, validate_mobile, validate_tan, generate_pan

validate_pan("ABCPE1234F")          # {"valid": True, "code": "VALID", "parsed": {"entity": "Individual", ...}}
validate_mobile("+91 98765 43210")  # {"valid": True, "parsed": {"normalized": "9876543210"}}
validate_tan("AAAA12345B")          # {"valid": True, "parsed": {"tan": "AAAA12345B"}}
generate_pan("P")                   # e.g. "XKQPW4821M" — mock test data only, never a real PAN
```

Every validator returns `{"valid", "code", "reason_en", "reason_hi", "parsed"}`
and never raises on bad input. `reason_hi` is Roman-script Hinglish,
exactly as the Rust core returns it. camelCase aliases
(`validatePan`, `validateMobile`, …) are also exported for parity with
the JS package.

## Validators (12)

| Function | Checks | `parsed` on success |
|---|---|---|
| `validate_mobile` | 10 digits, first digit 6–9; `+91` / `91` / `0` prefix, spaces and hyphens allowed | `{"normalized": ...}` |
| `validate_pan` | `^[A-Z]{5}[0-9]{4}[A-Z]$` | `{"entity": ..., "entity_code": ...}` |
| `validate_aadhaar` | 12 digits, first digit 2–9, Verhoeff checksum | `{"masked": ...}` |
| `validate_gstin` | 15 chars: state code + PAN + entity char + `Z` + Mod-36 check digit | `{"state": ..., "state_code": ..., "pan": ...}` |
| `validate_ifsc` | `^[A-Z]{4}0[A-Z0-9]{6}$` — format only, no checksum | `{"bank_code": ..., "branch_code": ...}` |
| `validate_upi` | `name@handle`, handle from a built-in list | `{"handle": ...}` |
| `validate_pincode` | 6 digits, first digit 1–9 | `{"pincode": ...}` |
| `validate_tan` | 4 letters + 5 digits + 1 letter — format only, no checksum | `{"tan": ...}` |
| `validate_cin` | 21 chars: `L`/`U` + 5 digits + 2 letters + 4 digits + 3 letters + 6 digits — format only, no checksum | `{"cin": ..., "listing": ..., "industry_code": ..., "state_code": ..., "year": ..., "company_type": ..., "registration_number": ...}` |
| `validate_llpin` | 3 letters + 4 digits — format only, no checksum | `{"llpin": ...}` |
| `validate_voter_id` / `validate_epic` | 3 letters + 7 digits — format only, no checksum | `{"epic": ...}` |
| `validate_vehicle` / `validate_vehicle_registration` | e.g. `DL01AB1234`, `DL01A1234` — format only, no checksum | `{"registration": ..., "state_code": ..., "district": ..., "series": ..., "number": ...}` |

Also available: `detect` (the Rust detect string in `parsed["type"]`)
and `validate_many`. Optional Pydantic helpers live in
`indycheck.pydantic` and only require Pydantic when you actually use
them (`pip install indycheck[pydantic]`): `pan_annotated`,
`tan_annotated`, `cin_annotated`, `llpin_annotated`, `voter_annotated` /
`epic_annotated`, `vehicle_annotated`, …

## Options

`validate_mobile_with_options`, `validate_pan_with_options`,
`validate_aadhaar_with_options` and `validate_gstin_with_options`
take an optional partial options dict (`{"strict",
"allow_spaces_hyphens", "normalise_plus91", "uppercase"}`, all
defaulting to `True`):

```python
from indycheck import validate_mobile_with_options, lenient_options

validate_mobile_with_options("5876543210", lenient_options())  # valid: first-digit rule skipped
validate_mobile_with_options("+91 98765 43210", {"normalise_plus91": False})  # INVALID_FORMAT
validate_pan_with_options("abcde1234f", {"uppercase": False})  # INVALID_FORMAT
```

Helpers: `default_options()`, `strict_options()`,
`lenient_options()` (format only — skips first-digit and checksum
checks) and `no_spaces_hyphens_options()`. The other validators have
no options variants, in the Rust core either.

## Format / mask

```python
from indycheck import format_pan, format_gstin, mask_pan, mask_mobile

format_pan("abcde 1234f")      # "ABCDE1234F" (None when the pattern does not match)
format_gstin("18aaapl1234c1zd")  # "18AAAPL1234C1ZD" — check digit NOT verified here
mask_pan("ABCDE1234F")         # "ABCDE****F"
mask_mobile("+91 98765 43210")  # "******3210"
```

`format_mobile` and `mask_aadhaar` keep their older behaviour and
return the validation dict (same as `validate_mobile` /
`validate_aadhaar`). A non-empty mask result is **not** proof of
validity — use the matching `validate_*` for that.

## Generators — TEST DATA ONLY

```python
from indycheck import generate_pan, generate_aadhaar, generate_gstin, generate_mobile

generate_pan("C")      # syntactically valid PAN, entity Company (unknown char -> "P")
generate_aadhaar()     # 12 digits, correct Verhoeff check digit
generate_gstin("18")   # syntactically valid GSTIN for Assam (unknown code -> "18")
generate_mobile()      # 10 digits, first digit 6-9
```

**Warning: generated values are syntactically valid, not real issued
IDs.** They pass this library's own validators but were never issued
by UIDAI, Income Tax, GSTN or anyone else. Use them only in tests,
demos and form previews — never present them as a real person's ID.
Generators are intentionally unseeded: each call may return a
different value.

Note: PAN entity reporting is lenient — the 4th character is reported in
`parsed["entity"]`, or `"Unknown"` when it is not in the published entity
list (P, C, H, F, A, T, B, L, J, G), and the PAN is still format-valid.
So `ABCDE1234F` is valid with entity `"Unknown"`, not an error.

## Honest limits

- **Format + checksum only.** `valid: True` means the value is
  well-formed and its checksum is correct — not that the ID exists or
  belongs to anyone.
- No checks against UIDAI (Aadhaar), NSDL / Income Tax (PAN), GSTN
  (GSTIN), any bank (IFSC), or any UPI provider. This package makes no
  network requests at all.
- **PAN, IFSC, TAN, CIN, LLPIN, Voter ID and vehicle registration
  numbers have no public checksum.** Only their format is checked.
  The vehicle state-code letters are not checked against a list of
  states, and a format-valid vehicle number does not prove the vehicle
  exists.
- IFSC validation is format-only: it cannot tell you whether a branch
  code really exists.
- UPI validation checks the handle against a built-in list of common
  handles; a new or rare handle may be reported as unknown.
