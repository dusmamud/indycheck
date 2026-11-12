/**
 * indycheck native-backend tests — napi-rs addon in crates/indycheck-napi.
 *
 * These tests only run when the addon is built (`npm run build` in
 * crates/indycheck-napi); otherwise the whole suite is skipped and the
 * pure-TypeScript tests in index.test.ts still cover the same behaviour.
 * Every case here asserts the native result equals the TypeScript
 * result, so a drift between the Rust core and the TS mirror fails
 * loudly. The `.node` binary is never committed — only the sources,
 * package.json, build config and this test.
 */
import { describe, expect, it } from "vitest";
import {
  backend,
  detect,
  isNativeAvailable,
  validateAadhaar,
  validateGstin,
  validateMany,
  validateMobile,
  validatePan,
  validateVehicle,
} from "./native";
import * as ts from "./index";

const native = isNativeAvailable();

describe.skipIf(!native)("indycheck native backend (napi-rs)", () => {
  it("loads the addon", () => {
    expect(isNativeAvailable()).toBe(true);
    expect(backend()).toBe("native");
  });

  it("validates PAN", () => {
    const result = validatePan("ABCDE1234F");
    expect(result).toEqual(ts.validatePan("ABCDE1234F"));
    expect(result.valid).toBe(true);
    expect(result.code).toBe("VALID");
    expect(result.parsed?.entity).toBe("Unknown");
  });

  it("validates Aadhaar", () => {
    const result = validateAadhaar("234567890124");
    expect(result).toEqual(ts.validateAadhaar("234567890124"));
    expect(result.valid).toBe(true);
    expect(result.parsed?.masked).toBe("XXXX XXXX 0124");
  });

  it("validates GSTIN", () => {
    const result = validateGstin("18AAAPL1234C1ZD");
    expect(result).toEqual(ts.validateGstin("18AAAPL1234C1ZD"));
    expect(result.valid).toBe(true);
    expect(result.parsed?.state).toBe("Assam");
  });

  it("validates mobile", () => {
    const result = validateMobile("+91 98765 43210");
    expect(result).toEqual(ts.validateMobile("+91 98765 43210"));
    expect(result.valid).toBe(true);
    expect(result.parsed?.normalized).toBe("9876543210");
  });

  it("validates a Bharat (BH) series vehicle number", () => {
    const result = validateVehicle("22BH1234AA");
    expect(result).toEqual(ts.validateVehicle("22BH1234AA"));
    expect(result.valid).toBe(true);
    expect(result.code).toBe("VALID");
    expect(result.parsed?.series_type).toBe("bharat");
    expect(result.parsed?.year).toBe("22");
    expect(result.parsed?.number).toBe("1234");
    expect(result.parsed?.suffix).toBe("AA");
  });

  it("validates a state-format vehicle number", () => {
    const result = validateVehicle("DL01AB1234");
    expect(result).toEqual(ts.validateVehicle("DL01AB1234"));
    expect(result.valid).toBe(true);
    expect(result.parsed?.series_type).toBe("state");
    expect(result.parsed?.state_code).toBe("DL");
  });

  it("detects a BH number as a vehicle", () => {
    const result = detect("22BH1234AA");
    expect(result).toEqual(ts.detect("22BH1234AA"));
    expect(result.valid).toBe(true);
    expect(result.parsed?.type).toBe("vehicle");
    expect(result.parsed?.result?.valid).toBe(true);
  });

  it("validates many inputs in one batch", () => {
    const inputs = ["ABCDE1234F", "9876543210", "22BH1234AA", "not-an-id"];
    const result = validateMany(inputs);
    expect(result).toEqual(ts.validateMany(inputs));
    expect(result.valid).toBe(false);
    expect(result.code).toBe("SOME_INVALID");
    expect(result.parsed?.total).toBe(4);
    expect(result.parsed?.validCount).toBe(3);
    expect(result.parsed?.invalidCount).toBe(1);
    expect(result.parsed?.results.map((r) => r.type)).toEqual([
      "pan",
      "mobile",
      "vehicle",
      null,
    ]);
  });

  it("agrees with the TypeScript mirror on every shared test vector", () => {
    // Cheap spot-parity: run the same inputs through both backends.
    // Full 254-vector parity already lives in index.test.ts for the TS
    // side; here the point is that the native side matches it.
    const inputs = [
      "ABCDE1234F",
      "234567890124",
      "18AAAPL1234C1ZD",
      "SBIN0000123",
      "name@okaxis",
      "9876543210",
      "781001",
      "ABCD12345E",
      "L12345MH2020PLC123456",
      "AAA1234",
      "ABC1234567",
      "DL01AB1234",
      "22BH1234AA",
      "garbage",
      "",
    ];
    for (const input of inputs) {
      expect(detect(input)).toEqual(ts.detect(input));
      expect(validateMany([input])).toEqual(ts.validateMany([input]));
    }
  });
});
