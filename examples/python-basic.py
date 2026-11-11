"""indycheck — Python example.

Run from the repo root, no install needed:

    python3 examples/python-basic.py

Or after installing:  pip install ./packages/python
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "packages" / "python" / "src"))

from indycheck import (
    detect,
    generate_pan,
    mask_aadhaar,
    validate_aadhaar,
    validate_gstin,
    validate_mobile,
    validate_pan,
    validate_vehicle,
)

print(validate_pan("XYZCP1234A"))  # valid: 4th char C = Company
# "ABCDE1234F" is also valid, with parsed["entity"] "Unknown" — its 4th
# character (D) is not in the published entity list (P, C, H, F, A, T,
# B, L, J, G), but that does not make the PAN invalid.
print(validate_mobile("+91 98765 43210"))
print(validate_aadhaar("234567890124"))
print(validate_gstin("27AAPFU0939F1ZV"))
print(mask_aadhaar("234567890124"))
print(detect("SBIN0001234"))
# New in v0.1 (expanded scope): vehicle registration — format only,
# no checksum, like TAN / CIN / LLPIN / Voter ID.
print(validate_vehicle("DL01AB1234"))
print(validate_vehicle("DL 01 AB 1234"))  # spaces/hyphens are stripped
# Generators are TEST DATA ONLY: syntactically valid, never a real ID.
print(generate_pan("P"))  # e.g. "XKQPW4821M" — use only in tests/demos
print(validate_pan(generate_pan("C")))  # a generated PAN re-validates
