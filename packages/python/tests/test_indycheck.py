"""Tests for the indycheck Python package — parity with the Rust core.

Mirrors packages/js/src/index.test.ts: inline cases (Rust codes /
reasons), parsed shapes from shared/spec.md, Rust detect() semantics,
Options cases, format/mask helpers, generators, and
shared/test-vectors.json (254 cases), asserted in full — including the
``options`` entries (run through ``validate_*_with_options``) and the
``generator`` entries (freshly generated values must re-validate as
VALID). As of the last check the Rust code and the vectors agree on all
254 entries (verified by emulating the Rust source over the file), so
there are no exceptions: if the Rust side drifts again, that test
fails loudly.
"""
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from indycheck import (  # noqa: E402
    detect,
    detect_type,
    format_gstin,
    format_mobile,
    format_mobile_with_options,
    format_pan,
    generate_aadhaar,
    generate_gstin,
    generate_mobile,
    generate_pan,
    lenient_options,
    mask_aadhaar,
    mask_aadhaar_string,
    mask_mobile,
    mask_pan,
    no_spaces_hyphens_options,
    validate_aadhaar,
    validate_aadhaar_with_options,
    validate_cin,
    validate_epic,
    validate_gstin,
    validate_gstin_with_options,
    validate_ifsc,
    validate_llpin,
    validate_many,
    validate_mobile,
    validate_mobile_with_options,
    validate_pan,
    validate_pan_with_options,
    validate_pincode,
    validate_tan,
    validate_upi,
    validate_vehicle,
    validate_vehicle_registration,
    validate_voter_id,
)

FNS = {
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

FNS_WITH_OPTIONS = {
    "mobile": validate_mobile_with_options,
    "pan": validate_pan_with_options,
    "aadhaar": validate_aadhaar_with_options,
    "gstin": validate_gstin_with_options,
}

# Generator entries in the vectors carry the generator argument as the
# input: PAN entity char, GSTIN state code, or empty (aadhaar/mobile).
GENERATORS = {
    "pan": lambda arg: generate_pan(arg[0] if arg else "P"),
    "aadhaar": lambda arg: generate_aadhaar(),
    "gstin": lambda arg: generate_gstin(arg),
    "mobile": lambda arg: generate_mobile(),
}

# PAN examples: an unlisted 4th character is reported as entity
# "Unknown" and the PAN is still format-valid (pan.rs).
INLINE_CASES = [
    # mobile
    ("mobile", "9876543210", True, "VALID"),
    ("mobile", "+91 98765 43210", True, "VALID"),
    ("mobile", "919876543210", True, "VALID"),
    ("mobile", "09876543210", True, "VALID"),
    ("mobile", "98765-43210", True, "VALID"),
    ("mobile", "6123456789", True, "VALID"),
    ("mobile", "5876543210", False, "INVALID_FIRST_DIGIT"),
    ("mobile", "0876543210", False, "INVALID_FIRST_DIGIT"),
    ("mobile", "+91 58765 43210", False, "INVALID_FIRST_DIGIT"),
    ("mobile", "987654321", False, "INVALID_FORMAT"),
    ("mobile", "98765432101", False, "INVALID_FORMAT"),
    ("mobile", "91987654321", False, "INVALID_FORMAT"),
    ("mobile", "98765abc10", False, "INVALID_FORMAT"),
    ("mobile", "+1 9876543210", False, "INVALID_FORMAT"),
    ("mobile", "", False, "EMPTY"),
    ("mobile", None, False, "INVALID_TYPE"),
    ("mobile", 9876543210, False, "INVALID_TYPE"),
    # PAN
    ("pan", "ABCPE1234F", True, "VALID"),
    ("pan", "abcpe1234f", True, "VALID"),
    ("pan", "XYZCP1234A", True, "VALID"),
    ("pan", "AAAHH1234B", True, "VALID"),
    ("pan", "ABCDE1234F", True, "VALID"),
    ("pan", "ABCDX1234F", True, "VALID"),
    ("pan", "ZYXWP9876Q", True, "VALID"),
    ("pan", "ABCDE1234", False, "INVALID_LENGTH"),
    ("pan", "ABCDE1234FG", False, "INVALID_LENGTH"),
    ("pan", "ABCDE12345", False, "INVALID_FORMAT"),
    ("pan", "ABCD11234F", False, "INVALID_FORMAT"),
    ("pan", "", False, "EMPTY"),
    # Aadhaar
    ("aadhaar", "234567890124", True, "VALID"),
    ("aadhaar", "987654321090", True, "VALID"),
    ("aadhaar", "2345 6789 0124", True, "VALID"),
    ("aadhaar", "2345-6789-0124", True, "VALID"),
    ("aadhaar", "234567890125", False, "INVALID_CHECKSUM"),
    ("aadhaar", "999999999999", False, "INVALID_CHECKSUM"),
    ("aadhaar", "123456789017", False, "INVALID_FIRST_DIGIT"),
    ("aadhaar", "023456789012", False, "INVALID_FIRST_DIGIT"),
    ("aadhaar", "23456789012", False, "INVALID_LENGTH"),
    ("aadhaar", "23456789012A", False, "INVALID_FORMAT"),
    # GSTIN
    ("gstin", "27AAPFU0939F1ZV", True, "VALID"),
    ("gstin", "27ABCDE1234F1Z0", True, "VALID"),
    ("gstin", "18ABCDE1234F1ZZ", True, "VALID"),
    ("gstin", "29AAKCS1234P1ZT", True, "VALID"),
    ("gstin", "18aaapl1234c1zd", True, "VALID"),
    ("gstin", "27ABCDE1234F1Z1", False, "INVALID_CHECKSUM"),
    ("gstin", "18AAAPL1234C1ZE", False, "INVALID_CHECKSUM"),
    ("gstin", "99AAAPL1234C1ZD", False, "INVALID_STATE_CODE"),
    ("gstin", "00AAAPL1234C1ZD", False, "INVALID_STATE_CODE"),
    ("gstin", "18AAAPL1234C1AD", False, "INVALID_FORMAT"),
    ("gstin", "18AAA111234C1ZD", False, "INVALID_FORMAT"),
    ("gstin", "1AAAAPL1234C1ZD", False, "INVALID_FORMAT"),
    ("gstin", "18AAAPL1234C1Z@", False, "INVALID_FORMAT"),
    ("gstin", "18AAAPL1234C1Z", False, "INVALID_LENGTH"),
    ("gstin", "18AAAPL1234C1ZDD", False, "INVALID_LENGTH"),
    ("gstin", "18AAAPL1234C1Z ", False, "INVALID_LENGTH"),
    ("gstin", "", False, "EMPTY"),
    # IFSC
    ("ifsc", "SBIN0000123", True, "VALID"),
    ("ifsc", "sbin0000123", True, "VALID"),
    ("ifsc", "HDFC0001234", True, "VALID"),
    ("ifsc", "SBIN1000123", False, "INVALID_FORMAT"),
    ("ifsc", "SB1N0000123", False, "INVALID_FORMAT"),
    ("ifsc", "SBIN000012", False, "INVALID_LENGTH"),
    ("ifsc", "SBIN00001234", False, "INVALID_LENGTH"),
    ("ifsc", "", False, "EMPTY"),
    # UPI
    ("upi", "rahul@okhdfcbank", True, "VALID"),
    ("upi", "9876543210@paytm", True, "VALID"),
    ("upi", "rahul@okaxis", True, "VALID"),
    ("upi", "name@OKAXIS", True, "VALID"),
    ("upi", "my-name_1@jio", True, "VALID"),
    ("upi", "name@okbob", True, "VALID"),
    ("upi", "rahul@unknownhandle", False, "INVALID_HANDLE"),
    ("upi", "rahul@", False, "INVALID_HANDLE"),
    ("upi", "rahul", False, "INVALID_FORMAT"),
    ("upi", "@okaxis", False, "INVALID_FORMAT"),
    ("upi", "a@okaxis", False, "INVALID_FORMAT"),
    ("upi", "rahul@paytm@okaxis", False, "INVALID_FORMAT"),
    ("upi", "na me@okaxis", False, "INVALID_FORMAT"),
    ("upi", "", False, "EMPTY"),
    # PIN code
    ("pincode", "781001", True, "VALID"),
    ("pincode", "110001", True, "VALID"),
    ("pincode", "999999", True, "VALID"),
    ("pincode", "081001", False, "INVALID_FIRST_DIGIT"),
    ("pincode", "000000", False, "INVALID_FIRST_DIGIT"),
    ("pincode", "78100", False, "INVALID_LENGTH"),
    ("pincode", "7810011", False, "INVALID_LENGTH"),
    ("pincode", "781 001", False, "INVALID_LENGTH"),
    ("pincode", "78100A", False, "INVALID_FORMAT"),
    ("pincode", "ABCDEF", False, "INVALID_FORMAT"),
    ("pincode", "", False, "EMPTY"),
    # TAN (format only — no checksum)
    ("tan", "AAAA12345B", True, "VALID"),
    ("tan", "delh12345a", True, "VALID"),
    ("tan", "ABCD12345E", True, "VALID"),
    ("tan", "ABC12345B", False, "INVALID_LENGTH"),
    ("tan", "AAAA123456", False, "INVALID_FORMAT"),
    ("tan", "AAAA 12345B", False, "INVALID_LENGTH"),
    ("tan", "", False, "EMPTY"),
    ("tan", None, False, "INVALID_TYPE"),
    # CIN (format only — no checksum)
    ("cin", "L12345MH2020PLC123456", True, "VALID"),
    ("cin", "U12345DL2019PTC000001", True, "VALID"),
    ("cin", "l12345mh2020plc123456", True, "VALID"),
    ("cin", "X12345MH2020PLC123456", False, "INVALID_FORMAT"),
    ("cin", "L1234MH2020PLC123456", False, "INVALID_LENGTH"),
    ("cin", "L12345M12020PLC123456", False, "INVALID_FORMAT"),
    ("cin", "", False, "EMPTY"),
    ("cin", 123, False, "INVALID_TYPE"),
    # LLPIN (format only — no checksum)
    ("llpin", "AAA1234", True, "VALID"),
    ("llpin", "abc1234", True, "VALID"),
    ("llpin", "AA12345", False, "INVALID_FORMAT"),
    ("llpin", "ABC123", False, "INVALID_LENGTH"),
    ("llpin", "ABC12345", False, "INVALID_LENGTH"),
    ("llpin", "", False, "EMPTY"),
    # Voter ID / EPIC (format only — no checksum)
    ("voter", "ABC1234567", True, "VALID"),
    ("voter", "abc1234567", True, "VALID"),
    ("voter", "AB12345678", False, "INVALID_FORMAT"),
    ("voter", "ABC123456", False, "INVALID_LENGTH"),
    ("voter", "ABC123456A", False, "INVALID_FORMAT"),
    ("voter", "AB C1234567", False, "INVALID_LENGTH"),
    ("voter", "", False, "EMPTY"),
    # Vehicle registration (format only — no checksum)
    ("vehicle", "DL01AB1234", True, "VALID"),
    ("vehicle", "DL01A1234", True, "VALID"),
    ("vehicle", "dl01ab1234", True, "VALID"),
    ("vehicle", "DL 01 AB 1234", True, "VALID"),
    ("vehicle", "DL-01-AB-1234", True, "VALID"),
    ("vehicle", "DL0AB1234", True, "VALID"),
    ("vehicle", "D101AB1234", False, "INVALID_FORMAT"),
    ("vehicle", "DL01ABCD1234", False, "INVALID_LENGTH"),
    ("vehicle", "DL01AB12CD", False, "INVALID_FORMAT"),
    ("vehicle", "D01AB1234", False, "INVALID_FORMAT"),
    ("vehicle", "", False, "EMPTY"),
    ("vehicle", None, False, "INVALID_TYPE"),
]


@pytest.mark.parametrize("fn_name,input,valid,code", INLINE_CASES)
def test_inline_cases(fn_name, input, valid, code):
    result = FNS[fn_name](input)
    assert result["valid"] is valid
    assert result["code"] == code
    assert result["reason_en"]
    assert result["reason_hi"]
    if valid:
        assert result["parsed"] is not None
    else:
        assert result["parsed"] is None


def test_inline_case_count():
    assert len(INLINE_CASES) >= 100


def test_parsed_shapes():
    assert validate_mobile("9876543210")["parsed"] == {"normalized": "9876543210"}
    assert format_mobile("+919876543210")["parsed"] == {"normalized": "9876543210"}
    assert format_mobile("bad")["valid"] is False
    assert validate_pan("ABCPE1234F")["parsed"] == {
        "entity": "Individual", "entity_code": "P",
    }
    assert validate_pan("XYZCP1234A")["parsed"] == {
        "entity": "Company", "entity_code": "C",
    }
    assert validate_pan("AAABB1234E")["parsed"] == {
        "entity": "BODY", "entity_code": "B",
    }
    assert validate_pan("ABCDE1234F")["parsed"] == {
        "entity": "Unknown", "entity_code": "D",
    }
    assert mask_aadhaar("234567890124")["parsed"] == {"masked": "XXXX XXXX 0124"}
    assert validate_gstin("27AAPFU0939F1ZV")["parsed"] == {
        "state": "Maharashtra", "state_code": "27", "pan": "AAPFU0939F",
    }
    assert validate_gstin("18ABCDE1234F1ZZ")["parsed"]["state"] == "Assam"
    assert validate_ifsc("SBIN0000123")["parsed"] == {
        "bank_code": "SBIN", "branch_code": "000123",
    }
    assert validate_upi("Rahul@Paytm")["parsed"] == {"handle": "paytm"}
    assert validate_pincode("781001")["parsed"] == {"pincode": "781001"}
    # Rust mask_aadhaar masks any 12-digit string; the Python mask_aadhaar
    # only succeeds for a fully valid number (see module docstring).
    assert mask_aadhaar_string("234567890125") == "XXXX XXXX 0125"
    assert mask_aadhaar_string("123") == ""
    assert validate_tan("AAAA12345B")["parsed"] == {"tan": "AAAA12345B"}
    assert validate_tan("delh12345a")["parsed"] == {"tan": "DELH12345A"}
    assert validate_cin("L12345MH2020PLC123456")["parsed"] == {
        "cin": "L12345MH2020PLC123456",
        "listing": "Listed",
        "industry_code": "12345",
        "state_code": "MH",
        "year": "2020",
        "company_type": "PLC",
        "registration_number": "123456",
    }
    assert validate_cin("U12345DL2019PTC000001")["parsed"]["listing"] == "Unlisted"
    assert validate_llpin("AAA1234")["parsed"] == {"llpin": "AAA1234"}
    assert validate_voter_id("ABC1234567")["parsed"] == {"epic": "ABC1234567"}
    assert validate_epic("ABC1234567") == validate_voter_id("ABC1234567")
    assert validate_vehicle("DL01AB1234")["parsed"] == {
        "registration": "DL01AB1234",
        "series_type": "state",
        "state_code": "DL",
        "district": "01",
        "series": "AB",
        "number": "1234",
    }
    assert validate_vehicle("DL 01 AB 1234")["parsed"]["registration"] == "DL01AB1234"
    assert validate_vehicle("DL0AB1234")["parsed"] == {
        "registration": "DL0AB1234",
        "series_type": "state",
        "state_code": "DL",
        "district": "0",
        "series": "AB",
        "number": "1234",
    }
    assert validate_vehicle_registration("DL01A1234") == validate_vehicle("DL01A1234")
    # Bharat (BH) series: YYBH####XX.
    assert validate_vehicle("22BH1234AA")["parsed"] == {
        "registration": "22BH1234AA",
        "series_type": "bharat",
        "year": "22",
        "series": "BH",
        "number": "1234",
        "suffix": "AA",
    }
    assert validate_vehicle("22 BH 1234 AA")["valid"]
    assert validate_vehicle("22bh1234aa")["valid"]
    assert validate_vehicle("20BH1234AA")["code"] == "INVALID_FORMAT"
    assert validate_vehicle("22BH0000AA")["code"] == "INVALID_FORMAT"
    assert validate_vehicle("22BH1234AI")["code"] == "INVALID_FORMAT"
    assert validate_vehicle("22BH1234AO")["code"] == "INVALID_FORMAT"
    assert validate_vehicle("22BH1234A")["code"] == "INVALID_FORMAT"
    assert detect("22BH1234AA")["parsed"]["type"] == "vehicle"


def test_options():
    # Lenient skips first-digit and checksum checks; format/state still apply.
    assert validate_aadhaar_with_options("234567890125", lenient_options())["valid"] is True
    assert validate_aadhaar_with_options("123456789017", lenient_options())["valid"] is True
    assert validate_gstin_with_options("18AAAPL1234C1ZE", lenient_options())["valid"] is True
    assert validate_mobile_with_options("5876543210", lenient_options())["valid"] is True
    assert validate_gstin_with_options("99AAAPL1234C1ZE", lenient_options())["code"] == "INVALID_STATE_CODE"
    assert validate_gstin_with_options("18AAAPL1234C1AD", lenient_options())["code"] == "INVALID_FORMAT"
    # ... and the default (strict) rejects the same inputs.
    assert validate_aadhaar_with_options("234567890125")["code"] == "INVALID_CHECKSUM"
    assert validate_gstin_with_options("18AAAPL1234C1ZE")["code"] == "INVALID_CHECKSUM"
    # uppercase: False makes lower-case letters fail instead of being upper-cased.
    assert validate_pan_with_options("abcde1234f", {"uppercase": False})["code"] == "INVALID_FORMAT"
    assert validate_pan_with_options("ABCDE1234F", {"uppercase": False})["valid"] is True
    assert validate_gstin_with_options("18aaapl1234c1zd", {"uppercase": False})["code"] == "INVALID_FORMAT"
    # allow_spaces_hyphens: False rejects spaces and hyphens (even leading/trailing).
    assert validate_mobile_with_options("98765 43210", no_spaces_hyphens_options())["code"] == "INVALID_FORMAT"
    assert validate_aadhaar_with_options("2345 6789 0124", {"allow_spaces_hyphens": False})["code"] == "INVALID_FORMAT"
    assert validate_pan_with_options(" ABCDE1234F ", {"allow_spaces_hyphens": False})["code"] == "INVALID_FORMAT"
    assert validate_gstin_with_options("18AAAPL1234C1ZD ", {"allow_spaces_hyphens": False})["code"] == "INVALID_FORMAT"
    # With the default options the same inputs are fine.
    assert validate_mobile_with_options("98765 43210")["valid"] is True
    assert validate_pan_with_options(" ABCDE1234F ")["valid"] is True
    # normalise_plus91: False accepts only a bare 10-digit mobile.
    assert validate_mobile_with_options("+91 98765 43210", {"normalise_plus91": False})["code"] == "INVALID_FORMAT"
    assert validate_mobile_with_options("9876543210", {"normalise_plus91": False})["valid"] is True
    assert format_mobile_with_options("98765 43210", {"allow_spaces_hyphens": False})["valid"] is False


def test_format_and_mask():
    assert format_pan("abcde 1234f") == "ABCDE1234F"
    assert format_pan("ABCDE-1234F") == "ABCDE1234F"
    assert format_pan("ABCDE1234") is None
    assert format_pan("ABCDE12345") is None
    assert format_pan(None) is None
    assert format_gstin("18aaapl1234c1zd") == "18AAAPL1234C1ZD"
    # Bad check digit: format succeeds (structure only), validation fails.
    assert format_gstin("18AAAPL1234C1ZE") == "18AAAPL1234C1ZE"
    assert validate_gstin("18AAAPL1234C1ZE")["valid"] is False
    assert format_gstin("99AAAPL1234C1ZD") is None
    assert format_gstin("18AAAPL1234C1AD") is None
    assert mask_pan("ABCDE1234F") == "ABCDE****F"
    assert mask_pan("abcde1234f") == "ABCDE****F"
    assert mask_pan("ABCDE1234") == ""
    assert mask_pan(None) == ""
    assert mask_mobile("+91 98765 43210") == "******3210"
    assert mask_mobile("9876543210") == "******3210"
    assert mask_mobile("5876543210") == ""
    assert mask_mobile("bad") == ""


def test_generators():
    # TEST DATA ONLY — syntactically valid, not real IDs.
    for _ in range(25):
        assert validate_pan(generate_pan("P"))["valid"] is True
        assert validate_pan(generate_pan("C"))["parsed"]["entity"] == "Company"
        assert validate_aadhaar(generate_aadhaar())["valid"] is True
        assert validate_gstin(generate_gstin("18"))["valid"] is True
        assert validate_gstin(generate_gstin("27"))["parsed"]["state_code"] == "27"
        assert validate_mobile(generate_mobile())["valid"] is True
    # Unknown entity / state code fall back to P / 18, and values vary.
    assert validate_pan(generate_pan("X"))["parsed"]["entity_code"] == "P"
    assert validate_gstin(generate_gstin("99"))["parsed"]["state_code"] == "18"
    assert validate_gstin(generate_gstin(""))["parsed"]["state_code"] == "18"
    assert len({generate_pan("P") for _ in range(10)}) > 1
    assert len({generate_mobile() for _ in range(10)}) > 1


def test_detect():
    assert detect("ABCPE1234F")["parsed"]["type"] == "pan"
    assert detect("234567890124")["parsed"]["type"] == "aadhaar"
    assert detect("9876543210")["parsed"]["type"] == "mobile"
    assert detect("27AAPFU0939F1ZV")["parsed"]["type"] == "gstin"
    assert detect("SBIN0000123")["parsed"]["type"] == "ifsc"
    assert detect("rahul@paytm")["parsed"]["type"] == "upi"
    assert detect("781001")["parsed"]["type"] == "pincode"
    assert detect("98765 43210")["parsed"]["type"] == "mobile"
    assert detect("AAAA12345B")["parsed"]["type"] == "tan"
    assert detect("L12345MH2020PLC123456")["parsed"]["type"] == "cin"
    assert detect("AAA1234")["parsed"]["type"] == "llpin"
    assert detect("ABC1234567")["parsed"]["type"] == "voter"
    assert detect("DL01AB1234")["parsed"]["type"] == "vehicle"
    assert detect("DL 01 AB 1234")["parsed"]["type"] == "vehicle"
    assert detect("DL01A1234")["parsed"]["type"] == "vehicle"
    # Detection can succeed while validation fails: "+91 58765 43210"
    # normalises to a mobile, but its first digit is 5.
    r = detect("+91 58765 43210")
    assert r["parsed"]["type"] == "mobile"
    assert r["valid"] is False
    assert r["code"] == "INVALID_FIRST_DIGIT"


def test_detect_rust_order():
    # Verhoeff-valid 12-digit numbers are Aadhaar, even spaced/hyphenated.
    assert detect_type("2345 6789 0124") == "aadhaar"
    assert detect_type("2345-6789-0124") == "aadhaar"
    # Any normalisable mobile wins over the length-15 GSTIN branch.
    assert detect_type("+91 98765 43210") == "mobile"
    assert detect_type("919876543210") == "mobile"
    assert detect_type("+91 58765 43210") == "mobile"
    # '@' wins over every other pattern.
    assert detect_type("ABCDE1234@") == "upi"
    assert detect_type("SBIN00001@3") == "upi"
    # Only strict patterns detect past the early branches.
    assert detect_type("23456789012A") == "unknown"
    assert detect_type("SBIN1000123") == "unknown"
    assert detect_type("78100A") == "unknown"
    assert detect_type("ABCDE12345") == "unknown"
    assert detect_type("not-an-id") == "unknown"
    # New types: 10-char TAN / voter patterns, 7-char LLPIN, vehicle.
    assert detect_type("AAAA12345B") == "tan"
    assert detect_type("ABC1234567") == "voter"
    assert detect_type("AAA1234") == "llpin"
    assert detect_type("DL01AB1234") == "vehicle"
    assert detect_type("DL01A1234") == "vehicle"
    assert detect_type("DL 01 AB 1234") == "vehicle"
    assert detect_type("DL0AB1234") == "vehicle"
    assert detect_type("D101AB1234") == "unknown"
    assert detect_type("DL01AB12CD") == "unknown"
    r = detect("not-an-id")
    assert r["valid"] is False
    assert r["code"] == "UNKNOWN_TYPE"
    assert r["reason_en"] == "Could not detect the type of this input"
    assert r["reason_hi"] == "Is input ka type pehchana nahi ja saka"
    assert detect("")["code"] == "UNKNOWN_TYPE"
    assert detect(None)["code"] == "INVALID_TYPE"


def test_validate_many():
    all_ok = validate_many(["ABCPE1234F", "9876543210"])
    assert all_ok["valid"] is True
    assert all_ok["code"] == "VALID"
    assert all_ok["parsed"]["validCount"] == 2
    mixed = validate_many(["ABCPE1234F", "bad"])
    assert mixed["valid"] is False
    assert mixed["code"] == "SOME_INVALID"
    assert mixed["parsed"]["validCount"] == 1
    assert mixed["parsed"]["invalidCount"] == 1
    assert mixed["parsed"]["results"][1]["code"] == "UNKNOWN_TYPE"
    assert validate_many([])["code"] == "EMPTY"
    assert validate_many("nope")["code"] == "INVALID_TYPE"
    typed = validate_many([{"value": "ABCPE1234F", "type": "pan"}])
    assert typed["valid"] is True
    assert typed["parsed"]["results"][0]["type"] == "pan"
    with_new_types = validate_many(["AAAA12345B", "DL01AB1234", "L12345MH2020PLC123456"])
    assert with_new_types["valid"] is True
    assert [r["type"] for r in with_new_types["parsed"]["results"]] == ["tan", "vehicle", "cin"]


def test_never_raises():
    for bad in (None, 42, {}, [], True, object()):
        for fn in FNS.values():
            assert fn(bad)["valid"] is False
        assert detect(bad)["valid"] is False
        assert format_mobile(bad)["valid"] is False
        assert mask_aadhaar(bad)["valid"] is False


def test_pydantic_module_imports_without_pydantic():
    import indycheck.pydantic as pydantic_helpers

    assert hasattr(pydantic_helpers, "pan_annotated")
    assert hasattr(pydantic_helpers, "tan_annotated")
    assert hasattr(pydantic_helpers, "cin_annotated")
    assert hasattr(pydantic_helpers, "llpin_annotated")
    assert hasattr(pydantic_helpers, "voter_annotated")
    assert hasattr(pydantic_helpers, "epic_annotated")
    assert hasattr(pydantic_helpers, "vehicle_annotated")
    try:
        import pydantic  # noqa: F401
    except ImportError:
        with pytest.raises(ImportError, match="Pydantic"):
            pydantic_helpers.pan_annotated()
    else:
        from pydantic import BaseModel, ValidationError

        class Model(BaseModel):
            pan: pydantic_helpers.pan_annotated()
            tan: pydantic_helpers.tan_annotated()
            vehicle: pydantic_helpers.vehicle_annotated()

        assert Model(
            pan="ABCPE1234F", tan="AAAA12345B", vehicle="DL01AB1234"
        ).vehicle == "DL01AB1234"
        with pytest.raises(ValidationError):
            Model(pan="ABCDE1234", tan="AAAA12345B", vehicle="DL01AB1234")
        with pytest.raises(ValidationError):
            Model(pan="ABCPE1234F", tan="AAAA123456", vehicle="DL01AB1234")


def test_shared_test_vectors():
    vectors_path = Path(__file__).resolve().parents[3] / "shared" / "test-vectors.json"
    if not vectors_path.exists():
        pytest.skip("shared/test-vectors.json not written yet — inline cases are the contract")
    vectors = json.loads(vectors_path.read_text(encoding="utf-8"))
    assert len(vectors) == 254
    failures = []
    for v in vectors:
        if "generator" in v:
            # Freshly generated values must re-validate as VALID.
            value = GENERATORS[v["type"]](v["input"])
            result = FNS[v["type"]](value)
        elif "options" in v:
            result = FNS_WITH_OPTIONS[v["type"]](v["input"], v["options"])
        else:
            result = FNS[v["type"]](v["input"])
        if (result["valid"], result["code"]) != (v["valid"], v["code"]):
            failures.append(
                f"{v['type']} {v['input']!r}: expected valid={v['valid']} "
                f"code={v['code']}, got valid={result['valid']} code={result['code']}"
            )
        if v.get("detect"):
            got = detect_type(v["input"])
            if got != v["type"]:
                failures.append(
                    f"detect {v['input']!r}: expected {v['type']}, got {got}"
                )
        if result["valid"] and (not result["reason_en"] or not result["reason_hi"]):
            failures.append(f"empty reason for {v['input']!r}")
    assert failures == []
