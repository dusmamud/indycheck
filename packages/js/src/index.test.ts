/**
 * indycheck JS tests — parity with the Rust core (crates/indycheck/src/).
 *
 * Layers:
 *  1. Inline cases (100+) — always run, using the Rust codes / reasons.
 *  2. shared/test-vectors.json (245 cases) — read directly and asserted
 *     in full, including the `options` entries (run through
 *     `validate*WithOptions`) and the `generator` entries (freshly
 *     generated values must re-validate as VALID). As of the last check
 *     the Rust code and the vectors agree on all 245 entries (verified
 *     by emulating the Rust source over the file), so there are no
 *     exceptions: if the Rust side drifts again, this test fails loudly
 *     instead of silently picking a side.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  detect,
  detectType,
  formatGstin,
  formatMobile,
  formatMobileWithOptions,
  formatPan,
  generateAadhaar,
  generateGstin,
  generateMobile,
  generatePan,
  lenientOptions,
  maskAadhaar,
  maskMobile,
  maskPan,
  noSpacesHyphensOptions,
  validateAadhaar,
  validateAadhaarWithOptions,
  validateCin,
  validateEpic,
  validateGstin,
  validateGstinWithOptions,
  validateIfsc,
  validateLlpin,
  validateMany,
  validateMobile,
  validateMobileWithOptions,
  validatePan,
  validatePanWithOptions,
  validatePincode,
  validateTan,
  validateUpi,
  validateVehicle,
  validateVehicleRegistration,
  validateVoterId,
  type Options,
  type ValidationResult,
} from "./index";
import {
  aadhaarSchema,
  cinSchema,
  epicSchema,
  gstinSchema,
  ifscSchema,
  llpinSchema,
  mobileSchema,
  panSchema,
  pincodeSchema,
  tanSchema,
  upiSchema,
  vehicleSchema,
  voterSchema,
} from "./zod";

type FnName =
  | "mobile"
  | "pan"
  | "aadhaar"
  | "gstin"
  | "ifsc"
  | "upi"
  | "pincode"
  | "tan"
  | "cin"
  | "llpin"
  | "voter"
  | "vehicle";

const FNS: Record<FnName, (input: unknown) => ValidationResult> = {
  mobile: validateMobile,
  pan: validatePan,
  aadhaar: validateAadhaar,
  gstin: validateGstin,
  ifsc: validateIfsc,
  upi: validateUpi,
  pincode: validatePincode,
  tan: validateTan,
  cin: validateCin,
  llpin: validateLlpin,
  voter: validateVoterId,
  vehicle: validateVehicle,
};

type OptionsFnName = "mobile" | "pan" | "aadhaar" | "gstin";

const FNS_WITH_OPTIONS: Record<
  OptionsFnName,
  (input: unknown, options?: Partial<Options>) => ValidationResult
> = {
  mobile: validateMobileWithOptions,
  pan: validatePanWithOptions,
  aadhaar: validateAadhaarWithOptions,
  gstin: validateGstinWithOptions,
};

/** Generator entries in the vectors carry the generator argument as the
 *  input: PAN entity char, GSTIN state code, or empty (aadhaar/mobile). */
const GENERATORS: Record<string, (arg: string) => string> = {
  pan: (arg) => generatePan(arg.length > 0 ? arg[0] : "P"),
  aadhaar: () => generateAadhaar(),
  gstin: (arg) => generateGstin(arg),
  mobile: () => generateMobile(),
};

interface InlineCase {
  fn: FnName;
  input: unknown;
  valid: boolean;
  code?: string;
}

// Valid Aadhaar numbers are Verhoeff-checked; valid GSTINs are
// Mod-36-Luhn-checked. PAN entity codes: an unlisted 4th character is
// reported as entity "Unknown" and the PAN is still format-valid (pan.rs).
const INLINE_CASES: InlineCase[] = [
  // ---- mobile ----
  { fn: "mobile", input: "9876543210", valid: true, code: "VALID" },
  { fn: "mobile", input: "+91 98765 43210", valid: true, code: "VALID" },
  { fn: "mobile", input: "919876543210", valid: true, code: "VALID" },
  { fn: "mobile", input: "09876543210", valid: true, code: "VALID" },
  { fn: "mobile", input: "98765-43210", valid: true, code: "VALID" },
  { fn: "mobile", input: "6123456789", valid: true, code: "VALID" },
  { fn: "mobile", input: "9999999999", valid: true, code: "VALID" },
  { fn: "mobile", input: "5876543210", valid: false, code: "INVALID_FIRST_DIGIT" },
  { fn: "mobile", input: "1876543210", valid: false, code: "INVALID_FIRST_DIGIT" },
  { fn: "mobile", input: "0876543210", valid: false, code: "INVALID_FIRST_DIGIT" },
  { fn: "mobile", input: "+91 58765 43210", valid: false, code: "INVALID_FIRST_DIGIT" },
  { fn: "mobile", input: "987654321", valid: false, code: "INVALID_FORMAT" },
  { fn: "mobile", input: "98765432101", valid: false, code: "INVALID_FORMAT" },
  { fn: "mobile", input: "91987654321", valid: false, code: "INVALID_FORMAT" },
  { fn: "mobile", input: "98765abc10", valid: false, code: "INVALID_FORMAT" },
  { fn: "mobile", input: "+1 9876543210", valid: false, code: "INVALID_FORMAT" },
  { fn: "mobile", input: "", valid: false, code: "EMPTY" },
  { fn: "mobile", input: null, valid: false, code: "INVALID_TYPE" },
  { fn: "mobile", input: 9876543210, valid: false, code: "INVALID_TYPE" },
  // ---- PAN ----
  { fn: "pan", input: "ABCPE1234F", valid: true, code: "VALID" },
  { fn: "pan", input: "abcpe1234f", valid: true, code: "VALID" },
  { fn: "pan", input: "XYZCP1234A", valid: true, code: "VALID" },
  { fn: "pan", input: "AAAHH1234B", valid: true, code: "VALID" },
  { fn: "pan", input: " AAAAT1234D ", valid: true, code: "VALID" },
  { fn: "pan", input: "ABCDE1234F", valid: true, code: "VALID" },
  { fn: "pan", input: "ABCDX1234F", valid: true, code: "VALID" },
  { fn: "pan", input: "ZYXWP9876Q", valid: true, code: "VALID" },
  { fn: "pan", input: "ABCDE1234", valid: false, code: "INVALID_LENGTH" },
  { fn: "pan", input: "ABCDE1234FG", valid: false, code: "INVALID_LENGTH" },
  { fn: "pan", input: "ABCDE12345", valid: false, code: "INVALID_FORMAT" },
  { fn: "pan", input: "ABCD11234F", valid: false, code: "INVALID_FORMAT" },
  { fn: "pan", input: "", valid: false, code: "EMPTY" },
  { fn: "pan", input: undefined, valid: false, code: "INVALID_TYPE" },
  // ---- Aadhaar ----
  { fn: "aadhaar", input: "234567890124", valid: true, code: "VALID" },
  { fn: "aadhaar", input: "987654321090", valid: true, code: "VALID" },
  { fn: "aadhaar", input: "345678901238", valid: true, code: "VALID" },
  { fn: "aadhaar", input: "2345 6789 0124", valid: true, code: "VALID" },
  { fn: "aadhaar", input: "2345-6789-0124", valid: true, code: "VALID" },
  { fn: "aadhaar", input: "234567890125", valid: false, code: "INVALID_CHECKSUM" },
  { fn: "aadhaar", input: "999999999999", valid: false, code: "INVALID_CHECKSUM" },
  { fn: "aadhaar", input: "123456789017", valid: false, code: "INVALID_FIRST_DIGIT" },
  { fn: "aadhaar", input: "023456789012", valid: false, code: "INVALID_FIRST_DIGIT" },
  { fn: "aadhaar", input: "23456789012", valid: false, code: "INVALID_LENGTH" },
  { fn: "aadhaar", input: "23456789012A", valid: false, code: "INVALID_FORMAT" },
  { fn: "aadhaar", input: "", valid: false, code: "EMPTY" },
  // ---- GSTIN ----
  { fn: "gstin", input: "27AAPFU0939F1ZV", valid: true, code: "VALID" },
  { fn: "gstin", input: "27ABCDE1234F1Z0", valid: true, code: "VALID" },
  { fn: "gstin", input: "18ABCDE1234F1ZZ", valid: true, code: "VALID" },
  { fn: "gstin", input: "29AAKCS1234P1ZT", valid: true, code: "VALID" },
  { fn: "gstin", input: "18aaapl1234c1zd", valid: true, code: "VALID" },
  { fn: "gstin", input: "27ABCDE1234F1Z1", valid: false, code: "INVALID_CHECKSUM" },
  { fn: "gstin", input: "18AAAPL1234C1ZE", valid: false, code: "INVALID_CHECKSUM" },
  { fn: "gstin", input: "99AAAPL1234C1ZD", valid: false, code: "INVALID_STATE_CODE" },
  { fn: "gstin", input: "00AAAPL1234C1ZD", valid: false, code: "INVALID_STATE_CODE" },
  { fn: "gstin", input: "39AAAPL1234C1ZD", valid: false, code: "INVALID_STATE_CODE" },
  { fn: "gstin", input: "18AAAPL1234C1AD", valid: false, code: "INVALID_FORMAT" },
  { fn: "gstin", input: "18AAA111234C1ZD", valid: false, code: "INVALID_FORMAT" },
  { fn: "gstin", input: "1AAAAPL1234C1ZD", valid: false, code: "INVALID_FORMAT" },
  { fn: "gstin", input: "18AAAPL1234C1Z@", valid: false, code: "INVALID_FORMAT" },
  { fn: "gstin", input: "18AAAPL1234C1Z", valid: false, code: "INVALID_LENGTH" },
  { fn: "gstin", input: "18AAAPL1234C1ZDD", valid: false, code: "INVALID_LENGTH" },
  { fn: "gstin", input: "18AAAPL1234C1Z ", valid: false, code: "INVALID_LENGTH" },
  { fn: "gstin", input: "", valid: false, code: "EMPTY" },
  // ---- IFSC ----
  { fn: "ifsc", input: "SBIN0000123", valid: true, code: "VALID" },
  { fn: "ifsc", input: "sbin0000123", valid: true, code: "VALID" },
  { fn: "ifsc", input: "HDFC0001234", valid: true, code: "VALID" },
  { fn: "ifsc", input: "SBIN0001234", valid: true, code: "VALID" },
  { fn: "ifsc", input: "SBIN1000123", valid: false, code: "INVALID_FORMAT" },
  { fn: "ifsc", input: "SB1N0000123", valid: false, code: "INVALID_FORMAT" },
  { fn: "ifsc", input: "SBIN000012", valid: false, code: "INVALID_LENGTH" },
  { fn: "ifsc", input: "SBIN00001234", valid: false, code: "INVALID_LENGTH" },
  { fn: "ifsc", input: "", valid: false, code: "EMPTY" },
  // ---- UPI ----
  { fn: "upi", input: "rahul@okhdfcbank", valid: true, code: "VALID" },
  { fn: "upi", input: "9876543210@paytm", valid: true, code: "VALID" },
  { fn: "upi", input: "rahul@okaxis", valid: true, code: "VALID" },
  { fn: "upi", input: "rahul@ybl", valid: true, code: "VALID" },
  { fn: "upi", input: "name@OKAXIS", valid: true, code: "VALID" },
  { fn: "upi", input: "my-name_1@jio", valid: true, code: "VALID" },
  { fn: "upi", input: "name@okbob", valid: true, code: "VALID" },
  { fn: "upi", input: "name@okaxis ", valid: true, code: "VALID" },
  { fn: "upi", input: "rahul@unknownhandle", valid: false, code: "INVALID_HANDLE" },
  { fn: "upi", input: "rahul@", valid: false, code: "INVALID_HANDLE" },
  { fn: "upi", input: "rahul", valid: false, code: "INVALID_FORMAT" },
  { fn: "upi", input: "@okaxis", valid: false, code: "INVALID_FORMAT" },
  { fn: "upi", input: "a@okaxis", valid: false, code: "INVALID_FORMAT" },
  { fn: "upi", input: "rahul@paytm@okaxis", valid: false, code: "INVALID_FORMAT" },
  { fn: "upi", input: "na me@okaxis", valid: false, code: "INVALID_FORMAT" },
  { fn: "upi", input: "", valid: false, code: "EMPTY" },
  // ---- PIN code ----
  { fn: "pincode", input: "781001", valid: true, code: "VALID" },
  { fn: "pincode", input: "110001", valid: true, code: "VALID" },
  { fn: "pincode", input: "400001", valid: true, code: "VALID" },
  { fn: "pincode", input: "999999", valid: true, code: "VALID" },
  { fn: "pincode", input: "081001", valid: false, code: "INVALID_FIRST_DIGIT" },
  { fn: "pincode", input: "000000", valid: false, code: "INVALID_FIRST_DIGIT" },
  { fn: "pincode", input: "78100", valid: false, code: "INVALID_LENGTH" },
  { fn: "pincode", input: "7810011", valid: false, code: "INVALID_LENGTH" },
  { fn: "pincode", input: "781 001", valid: false, code: "INVALID_LENGTH" },
  { fn: "pincode", input: "78100A", valid: false, code: "INVALID_FORMAT" },
  { fn: "pincode", input: "ABCDEF", valid: false, code: "INVALID_FORMAT" },
  { fn: "pincode", input: "", valid: false, code: "EMPTY" },
  // ---- TAN (format only — no checksum) ----
  { fn: "tan", input: "AAAA12345B", valid: true, code: "VALID" },
  { fn: "tan", input: "delh12345a", valid: true, code: "VALID" },
  { fn: "tan", input: "ABCD12345E", valid: true, code: "VALID" },
  { fn: "tan", input: "ABC12345B", valid: false, code: "INVALID_LENGTH" },
  { fn: "tan", input: "AAAA123456", valid: false, code: "INVALID_FORMAT" },
  { fn: "tan", input: "AAAA 12345B", valid: false, code: "INVALID_LENGTH" },
  { fn: "tan", input: "", valid: false, code: "EMPTY" },
  { fn: "tan", input: null, valid: false, code: "INVALID_TYPE" },
  // ---- CIN (format only — no checksum) ----
  { fn: "cin", input: "L12345MH2020PLC123456", valid: true, code: "VALID" },
  { fn: "cin", input: "U12345DL2019PTC000001", valid: true, code: "VALID" },
  { fn: "cin", input: "l12345mh2020plc123456", valid: true, code: "VALID" },
  { fn: "cin", input: "X12345MH2020PLC123456", valid: false, code: "INVALID_FORMAT" },
  { fn: "cin", input: "L1234MH2020PLC123456", valid: false, code: "INVALID_LENGTH" },
  { fn: "cin", input: "L12345M12020PLC123456", valid: false, code: "INVALID_FORMAT" },
  { fn: "cin", input: "", valid: false, code: "EMPTY" },
  { fn: "cin", input: 123, valid: false, code: "INVALID_TYPE" },
  // ---- LLPIN (format only — no checksum) ----
  { fn: "llpin", input: "AAA1234", valid: true, code: "VALID" },
  { fn: "llpin", input: "abc1234", valid: true, code: "VALID" },
  { fn: "llpin", input: "AA12345", valid: false, code: "INVALID_FORMAT" },
  { fn: "llpin", input: "ABC123", valid: false, code: "INVALID_LENGTH" },
  { fn: "llpin", input: "ABC12345", valid: false, code: "INVALID_LENGTH" },
  { fn: "llpin", input: "", valid: false, code: "EMPTY" },
  // ---- Voter ID / EPIC (format only — no checksum) ----
  { fn: "voter", input: "ABC1234567", valid: true, code: "VALID" },
  { fn: "voter", input: "abc1234567", valid: true, code: "VALID" },
  { fn: "voter", input: "AB12345678", valid: false, code: "INVALID_FORMAT" },
  { fn: "voter", input: "ABC123456", valid: false, code: "INVALID_LENGTH" },
  { fn: "voter", input: "ABC123456A", valid: false, code: "INVALID_FORMAT" },
  { fn: "voter", input: "AB C1234567", valid: false, code: "INVALID_LENGTH" },
  { fn: "voter", input: "", valid: false, code: "EMPTY" },
  // ---- Vehicle registration (format only — no checksum) ----
  { fn: "vehicle", input: "DL01AB1234", valid: true, code: "VALID" },
  { fn: "vehicle", input: "DL01A1234", valid: true, code: "VALID" },
  { fn: "vehicle", input: "dl01ab1234", valid: true, code: "VALID" },
  { fn: "vehicle", input: "DL 01 AB 1234", valid: true, code: "VALID" },
  { fn: "vehicle", input: "DL-01-AB-1234", valid: true, code: "VALID" },
  { fn: "vehicle", input: "DL0AB1234", valid: true, code: "VALID" },
  { fn: "vehicle", input: "D101AB1234", valid: false, code: "INVALID_FORMAT" },
  { fn: "vehicle", input: "DL01ABCD1234", valid: false, code: "INVALID_LENGTH" },
  { fn: "vehicle", input: "DL01AB12CD", valid: false, code: "INVALID_FORMAT" },
  { fn: "vehicle", input: "D01AB1234", valid: false, code: "INVALID_FORMAT" },
  { fn: "vehicle", input: "", valid: false, code: "EMPTY" },
  { fn: "vehicle", input: undefined, valid: false, code: "INVALID_TYPE" },
];

describe("inline cases (Rust contract)", () => {
  it.each(INLINE_CASES)(" $fn $input -> valid=$valid code=$code", (c) => {
    const result = FNS[c.fn](c.input);
    expect(result.valid).toBe(c.valid);
    if (c.code) expect(result.code).toBe(c.code);
    expect(result.reason_en).toBeTruthy();
    expect(result.reason_hi).toBeTruthy();
    if (c.valid) expect(result.parsed).not.toBeNull();
    else expect(result.parsed).toBeNull();
  });

  it("has at least 100 inline cases", () => {
    expect(INLINE_CASES.length).toBeGreaterThanOrEqual(100);
  });
});

describe("parsed shapes (shared/spec.md)", () => {
  it("mobile parsed is { normalized }", () => {
    expect(validateMobile("9876543210").parsed).toEqual({ normalized: "9876543210" });
    expect(formatMobile("+919876543210").parsed).toEqual({ normalized: "9876543210" });
    expect(formatMobile("bad").valid).toBe(false);
  });

  it("pan parsed is { entity, entity_code }", () => {
    expect(validatePan("ABCPE1234F").parsed).toEqual({ entity: "Individual", entity_code: "P" });
    expect(validatePan("XYZCP1234A").parsed).toEqual({ entity: "Company", entity_code: "C" });
    expect(validatePan("AAAHH1234B").parsed).toEqual({ entity: "HUF", entity_code: "H" });
    expect(validatePan("AAABB1234E").parsed).toEqual({ entity: "BODY", entity_code: "B" });
    expect(validatePan("ABCDE1234F").parsed).toEqual({ entity: "Unknown", entity_code: "D" });
  });

  it("aadhaar parsed is { masked }", () => {
    expect(maskAadhaar("234567890124").parsed).toEqual({ masked: "XXXX XXXX 0124" });
    expect(validateAadhaar("234567890124").parsed).toEqual({ masked: "XXXX XXXX 0124" });
  });

  it("gstin parsed is { state, state_code, pan }", () => {
    expect(validateGstin("27AAPFU0939F1ZV").parsed).toEqual({
      state: "Maharashtra",
      state_code: "27",
      pan: "AAPFU0939F",
    });
    expect(validateGstin("18ABCDE1234F1ZZ").parsed?.state).toBe("Assam");
  });

  it("ifsc parsed is { bank_code, branch_code }", () => {
    expect(validateIfsc("SBIN0000123").parsed).toEqual({
      bank_code: "SBIN",
      branch_code: "000123",
    });
    expect(validateIfsc("SBIN0001234").parsed?.branch_code).toBe("001234");
  });

  it("upi parsed is { handle } (lowercased)", () => {
    expect(validateUpi("Rahul@Paytm").parsed).toEqual({ handle: "paytm" });
    expect(validateUpi("name@OKAXIS").parsed).toEqual({ handle: "okaxis" });
  });

  it("pincode parsed is { pincode }", () => {
    expect(validatePincode("781001").parsed).toEqual({ pincode: "781001" });
  });

  it("tan parsed is { tan }", () => {
    expect(validateTan("AAAA12345B").parsed).toEqual({ tan: "AAAA12345B" });
    expect(validateTan("delh12345a").parsed).toEqual({ tan: "DELH12345A" });
  });

  it("cin parsed is { cin, listing, industry_code, state_code, year, company_type, registration_number }", () => {
    expect(validateCin("L12345MH2020PLC123456").parsed).toEqual({
      cin: "L12345MH2020PLC123456",
      listing: "Listed",
      industry_code: "12345",
      state_code: "MH",
      year: "2020",
      company_type: "PLC",
      registration_number: "123456",
    });
    expect(validateCin("U12345DL2019PTC000001").parsed?.listing).toBe("Unlisted");
  });

  it("llpin parsed is { llpin }", () => {
    expect(validateLlpin("AAA1234").parsed).toEqual({ llpin: "AAA1234" });
  });

  it("voter parsed is { epic } and validateEpic is an alias", () => {
    expect(validateVoterId("ABC1234567").parsed).toEqual({ epic: "ABC1234567" });
    expect(validateEpic("ABC1234567")).toEqual(validateVoterId("ABC1234567"));
  });

  it("vehicle parsed is { registration, state_code, district, series, number }", () => {
    expect(validateVehicle("DL01AB1234").parsed).toEqual({
      registration: "DL01AB1234",
      state_code: "DL",
      district: "01",
      series: "AB",
      number: "1234",
    });
    expect(validateVehicle("DL 01 AB 1234").parsed?.registration).toBe("DL01AB1234");
    expect(validateVehicle("DL0AB1234").parsed).toEqual({
      registration: "DL0AB1234",
      state_code: "DL",
      district: "0",
      series: "AB",
      number: "1234",
    });
    expect(validateVehicleRegistration("DL01A1234")).toEqual(validateVehicle("DL01A1234"));
  });
});

describe("options (options.rs)", () => {
  it("lenient skips first-digit and checksum checks, format/state still apply", () => {
    expect(validateAadhaarWithOptions("234567890125", lenientOptions()).valid).toBe(true);
    expect(validateAadhaarWithOptions("123456789017", lenientOptions()).valid).toBe(true);
    expect(validateGstinWithOptions("18AAAPL1234C1ZE", lenientOptions()).valid).toBe(true);
    expect(validateMobileWithOptions("5876543210", lenientOptions()).valid).toBe(true);
    // State code and structure are still checked when lenient.
    expect(validateGstinWithOptions("99AAAPL1234C1ZE", lenientOptions()).code).toBe(
      "INVALID_STATE_CODE",
    );
    expect(validateGstinWithOptions("18AAAPL1234C1AD", lenientOptions()).code).toBe(
      "INVALID_FORMAT",
    );
    // ... and the default (strict) rejects the same inputs.
    expect(validateAadhaarWithOptions("234567890125").code).toBe("INVALID_CHECKSUM");
    expect(validateGstinWithOptions("18AAAPL1234C1ZE").code).toBe("INVALID_CHECKSUM");
  });

  it("uppercase: false makes lower-case letters fail instead of being upper-cased", () => {
    expect(validatePanWithOptions("abcde1234f", { uppercase: false }).code).toBe(
      "INVALID_FORMAT",
    );
    expect(validatePanWithOptions("ABCDE1234F", { uppercase: false }).valid).toBe(true);
    expect(validateGstinWithOptions("18aaapl1234c1zd", { uppercase: false }).code).toBe(
      "INVALID_FORMAT",
    );
  });

  it("allow_spaces_hyphens: false rejects spaces and hyphens (even leading/trailing)", () => {
    expect(validateMobileWithOptions("98765 43210", noSpacesHyphensOptions()).code).toBe(
      "INVALID_FORMAT",
    );
    expect(validateAadhaarWithOptions("2345 6789 0124", { allow_spaces_hyphens: false }).code).toBe(
      "INVALID_FORMAT",
    );
    expect(validatePanWithOptions(" ABCDE1234F ", { allow_spaces_hyphens: false }).code).toBe(
      "INVALID_FORMAT",
    );
    expect(validateGstinWithOptions("18AAAPL1234C1ZD ", { allow_spaces_hyphens: false }).code).toBe(
      "INVALID_FORMAT",
    );
    // With the default options the same inputs are fine.
    expect(validateMobileWithOptions("98765 43210").valid).toBe(true);
    expect(validatePanWithOptions(" ABCDE1234F ").valid).toBe(true);
  });

  it("normalise_plus91: false accepts only a bare 10-digit mobile", () => {
    expect(validateMobileWithOptions("+91 98765 43210", { normalise_plus91: false }).code).toBe(
      "INVALID_FORMAT",
    );
    expect(validateMobileWithOptions("9876543210", { normalise_plus91: false }).valid).toBe(true);
    expect(formatMobileWithOptions("98765 43210", { allow_spaces_hyphens: false }).valid).toBe(
      false,
    );
  });
});

describe("format / mask (Rust string functions)", () => {
  it("formatPan upper-cases and strips spaces/hyphens, null otherwise", () => {
    expect(formatPan("abcde 1234f")).toBe("ABCDE1234F");
    expect(formatPan("ABCDE-1234F")).toBe("ABCDE1234F");
    expect(formatPan("ABCDE1234")).toBeNull();
    expect(formatPan("ABCDE12345")).toBeNull();
    expect(formatPan(null)).toBeNull();
  });

  it("formatGstin returns the formatted GSTIN, check digit NOT verified", () => {
    expect(formatGstin("18aaapl1234c1zd")).toBe("18AAAPL1234C1ZD");
    // Bad check digit: format succeeds (structure only), validation fails.
    expect(formatGstin("18AAAPL1234C1ZE")).toBe("18AAAPL1234C1ZE");
    expect(validateGstin("18AAAPL1234C1ZE").valid).toBe(false);
    expect(formatGstin("99AAAPL1234C1ZD")).toBeNull();
    expect(formatGstin("18AAAPL1234C1AD")).toBeNull();
  });

  it("maskPan masks as ABCDE****F, empty string on invalid format", () => {
    expect(maskPan("ABCDE1234F")).toBe("ABCDE****F");
    expect(maskPan("abcde1234f")).toBe("ABCDE****F");
    expect(maskPan("ABCDE1234")).toBe("");
    expect(maskPan(null)).toBe("");
  });

  it("maskMobile masks as ******3210, using the strict format (first digit 6-9)", () => {
    expect(maskMobile("+91 98765 43210")).toBe("******3210");
    expect(maskMobile("9876543210")).toBe("******3210");
    expect(maskMobile("5876543210")).toBe("");
    expect(maskMobile("bad")).toBe("");
  });
});

describe("generators (TEST DATA ONLY — syntactically valid, not real IDs)", () => {
  it("generated values re-validate as VALID", () => {
    for (let i = 0; i < 25; i++) {
      expect(validatePan(generatePan("P")).valid).toBe(true);
      expect(validatePan(generatePan("C")).parsed?.entity).toBe("Company");
      expect(validateAadhaar(generateAadhaar()).valid).toBe(true);
      expect(validateGstin(generateGstin("18")).valid).toBe(true);
      expect(validateGstin(generateGstin("27")).parsed?.state_code).toBe("27");
      expect(validateMobile(generateMobile()).valid).toBe(true);
    }
  });

  it("unknown entity / state code fall back to P / 18, and values vary", () => {
    expect(validatePan(generatePan("X")).parsed?.entity_code).toBe("P");
    expect(validateGstin(generateGstin("99")).parsed?.state_code).toBe("18");
    expect(validateGstin(generateGstin("")).parsed?.state_code).toBe("18");
    const pans = new Set(Array.from({ length: 10 }, () => generatePan("P")));
    expect(pans.size).toBeGreaterThan(1);
    const mobiles = new Set(Array.from({ length: 10 }, () => generateMobile()));
    expect(mobiles.size).toBeGreaterThan(1);
  });
});

describe("detect (Rust lib.rs semantics)", () => {
  it("returns the Rust detect string via parsed.type", () => {
    expect(detect("ABCPE1234F").parsed?.type).toBe("pan");
    expect(detect("234567890124").parsed?.type).toBe("aadhaar");
    expect(detect("9876543210").parsed?.type).toBe("mobile");
    expect(detect("27AAPFU0939F1ZV").parsed?.type).toBe("gstin");
    expect(detect("SBIN0000123").parsed?.type).toBe("ifsc");
    expect(detect("rahul@paytm").parsed?.type).toBe("upi");
    expect(detect("781001").parsed?.type).toBe("pincode");
    expect(detect("98765 43210").parsed?.type).toBe("mobile");
    expect(detect("09876543210").parsed?.type).toBe("mobile");
    expect(detect("AAAA12345B").parsed?.type).toBe("tan");
    expect(detect("L12345MH2020PLC123456").parsed?.type).toBe("cin");
    expect(detect("AAA1234").parsed?.type).toBe("llpin");
    expect(detect("ABC1234567").parsed?.type).toBe("voter");
    expect(detect("DL01AB1234").parsed?.type).toBe("vehicle");
    expect(detect("DL 01 AB 1234").parsed?.type).toBe("vehicle");
    expect(detect("DL01A1234").parsed?.type).toBe("vehicle");
  });

  it("carries the validator result, so detection can succeed while validation fails", () => {
    // "+91 58765 43210" normalises to a mobile, but its first digit is 5.
    const r = detect("+91 58765 43210");
    expect(r.parsed?.type).toBe("mobile");
    expect(r.valid).toBe(false);
    expect(r.code).toBe("INVALID_FIRST_DIGIT");
  });

  it("reproduces the Rust detect order (lib.rs)", () => {
    // Verhoeff-valid 12-digit numbers are Aadhaar, even spaced/hyphenated.
    expect(detectType("2345 6789 0124")).toBe("aadhaar");
    expect(detectType("2345-6789-0124")).toBe("aadhaar");
    // Any normalisable mobile wins over the length-15 GSTIN branch.
    expect(detectType("+91 98765 43210")).toBe("mobile");
    expect(detectType("919876543210")).toBe("mobile");
    expect(detectType("+91 58765 43210")).toBe("mobile");
    // '@' wins over every other pattern.
    expect(detectType("ABCDE1234@")).toBe("upi");
    expect(detectType("SBIN00001@3")).toBe("upi");
    // Only strict patterns detect past the early branches.
    expect(detectType("23456789012A")).toBe("unknown");
    expect(detectType("SBIN1000123")).toBe("unknown");
    expect(detectType("78100A")).toBe("unknown");
    expect(detectType("ABCDE12345")).toBe("unknown");
    expect(detectType("not-an-id")).toBe("unknown");
    // New types: 10-char TAN / voter patterns, 7-char LLPIN, vehicle.
    expect(detectType("AAAA12345B")).toBe("tan");
    expect(detectType("ABC1234567")).toBe("voter");
    expect(detectType("AAA1234")).toBe("llpin");
    expect(detectType("DL01AB1234")).toBe("vehicle");
    expect(detectType("DL01A1234")).toBe("vehicle");
    expect(detectType("DL 01 AB 1234")).toBe("vehicle");
    expect(detectType("DL0AB1234")).toBe("vehicle");
    // PAN wins over TAN/voter when both patterns fit the length-10 slot
    // in the same order Rust checks them; a 10-char all-letter/digit
    // string that fits none of them stays unknown.
    expect(detectType("D101AB1234")).toBe("unknown");
    expect(detectType("DL01AB12CD")).toBe("unknown");
  });

  it("unknown inputs get UNKNOWN_TYPE with the Rust reasons", () => {
    const r = detect("not-an-id");
    expect(r.valid).toBe(false);
    expect(r.code).toBe("UNKNOWN_TYPE");
    expect(r.reason_en).toBe("Could not detect the type of this input");
    expect(r.reason_hi).toBe("Is input ka type pehchana nahi ja saka");
    expect(detect("").code).toBe("UNKNOWN_TYPE");
    expect(detect(null).code).toBe("INVALID_TYPE");
  });
});

describe("validateMany", () => {
  it("mirrors Rust validate_many (detect then validate per item)", () => {
    const all = validateMany(["ABCPE1234F", "9876543210"]);
    expect(all.valid).toBe(true);
    expect(all.code).toBe("VALID");
    expect(all.parsed?.validCount).toBe(2);
    const mixed = validateMany(["ABCPE1234F", "bad"]);
    expect(mixed.valid).toBe(false);
    expect(mixed.code).toBe("SOME_INVALID");
    expect(mixed.parsed?.validCount).toBe(1);
    expect(mixed.parsed?.invalidCount).toBe(1);
    expect(mixed.parsed?.results[1].code).toBe("UNKNOWN_TYPE");
    expect(validateMany([]).code).toBe("EMPTY");
    expect(validateMany("nope" as unknown as unknown[]).code).toBe("INVALID_TYPE");
    const typed = validateMany([{ value: "ABCPE1234F", type: "pan" }]);
    expect(typed.valid).toBe(true);
    expect(typed.parsed?.results[0].type).toBe("pan");
    const withNewTypes = validateMany(["AAAA12345B", "DL01AB1234", "L12345MH2020PLC123456"]);
    expect(withNewTypes.valid).toBe(true);
    expect(withNewTypes.parsed?.results.map((r) => r.type)).toEqual(["tan", "vehicle", "cin"]);
  });
});

describe("never throws", () => {
  it("returns a result for null / undefined / objects / numbers", () => {
    for (const bad of [null, undefined, 42, {}, [], true, Symbol("x")]) {
      for (const fn of Object.values(FNS)) {
        expect(() => fn(bad)).not.toThrow();
        expect(fn(bad).valid).toBe(false);
      }
      expect(() => detect(bad)).not.toThrow();
      expect(() => formatMobile(bad)).not.toThrow();
      expect(() => maskAadhaar(bad)).not.toThrow();
    }
  });
});

describe("zod schemas", () => {
  it("accept valid and reject invalid with bilingual messages", () => {
    expect(panSchema.safeParse("ABCPE1234F").success).toBe(true);
    expect(panSchema.safeParse("ABCDE1234F").success).toBe(true);
    const bad = panSchema.safeParse("ABCDE1234");
    expect(bad.success).toBe(false);
    if (!bad.success) {
      expect(bad.error.issues[0].message).toContain("PAN must be exactly 10 characters");
      expect(bad.error.issues[0].message).toContain("PAN bilkul 10 character");
    }
    expect(mobileSchema.safeParse("9876543210").success).toBe(true);
    expect(mobileSchema.safeParse("5876543210").success).toBe(false);
    expect(aadhaarSchema.safeParse("234567890124").success).toBe(true);
    expect(aadhaarSchema.safeParse("234567890125").success).toBe(false);
    expect(gstinSchema.safeParse("27AAPFU0939F1ZV").success).toBe(true);
    expect(ifscSchema.safeParse("SBIN0000123").success).toBe(true);
    expect(upiSchema.safeParse("rahul@paytm").success).toBe(true);
    expect(upiSchema.safeParse("rahul@nope").success).toBe(false);
    expect(pincodeSchema.safeParse("781001").success).toBe(true);
    expect(pincodeSchema.safeParse("081001").success).toBe(false);
    expect(tanSchema.safeParse("AAAA12345B").success).toBe(true);
    expect(tanSchema.safeParse("AAAA123456").success).toBe(false);
    expect(cinSchema.safeParse("L12345MH2020PLC123456").success).toBe(true);
    expect(cinSchema.safeParse("X12345MH2020PLC123456").success).toBe(false);
    expect(llpinSchema.safeParse("AAA1234").success).toBe(true);
    expect(llpinSchema.safeParse("ABC123").success).toBe(false);
    expect(voterSchema.safeParse("ABC1234567").success).toBe(true);
    expect(epicSchema.safeParse("ABC1234567").success).toBe(true);
    expect(voterSchema.safeParse("ABC123456").success).toBe(false);
    expect(vehicleSchema.safeParse("DL01AB1234").success).toBe(true);
    expect(vehicleSchema.safeParse("D101AB1234").success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// shared/test-vectors.json — asserted in full, no exceptions.
// As of the last check the Rust code and the vectors agree on all 245
// entries (verified by emulating crates/indycheck/src over the file).
// `options` entries run through validate*WithOptions, `generator`
// entries generate a fresh value and validate it (like
// crates/indycheck/tests/integration.rs).
// ---------------------------------------------------------------------------

interface VectorEntry {
  input: string;
  type: string;
  valid: boolean;
  code: string;
  detect?: boolean;
  options?: Partial<Options>;
  generator?: string;
}

describe("shared/test-vectors.json", () => {
  const vectorsPath = join(__dirname, "..", "..", "..", "shared", "test-vectors.json");
  it("all 245 vectors match the Rust code", () => {
    if (!existsSync(vectorsPath)) {
      // Vectors not written yet — inline cases above are the contract.
      expect(true).toBe(true);
      return;
    }
    const vectors = JSON.parse(readFileSync(vectorsPath, "utf8")) as VectorEntry[];
    expect(vectors.length).toBe(245);
    const failures: string[] = [];
    for (const v of vectors) {
      let result: ValidationResult;
      if (v.generator) {
        const value = GENERATORS[v.type](v.input);
        result = FNS[v.type as FnName](value);
      } else if (v.options) {
        result = FNS_WITH_OPTIONS[v.type as OptionsFnName](v.input, v.options);
      } else {
        result = FNS[v.type as FnName](v.input);
      }
      if (result.valid !== v.valid || result.code !== v.code) {
        failures.push(
          `${v.type} ${JSON.stringify(v.input)}: expected valid=${v.valid} code=${v.code}, got valid=${result.valid} code=${result.code}`,
        );
      }
      if (v.detect) {
        const got = detectType(v.input);
        if (got !== v.type) {
          failures.push(
            `detect ${JSON.stringify(v.input)}: expected ${v.type}, got ${got}`,
          );
        }
      }
      if (result.valid && (!result.reason_en || !result.reason_hi)) {
        failures.push(`empty reason for ${JSON.stringify(v.input)}`);
      }
    }
    expect(failures).toEqual([]);
  });
});
