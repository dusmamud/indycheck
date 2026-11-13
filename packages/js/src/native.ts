/**
 * indycheck — optional native (napi-rs) backend.
 *
 * Same public API as the pure-TypeScript mirror in `./index`, but the
 * validation itself runs in the compiled Rust core through the
 * napi-rs addon in `crates/indycheck-napi` instead of the TypeScript
 * re-implementation. The addon is optional: when it is not built (or
 * cannot be loaded) every function below falls back to `./index`
 * silently, so the package works with no native code at all.
 *
 * How it loads: `isNativeAvailable()` tries, in order,
 *  1. `INDYCHECK_NATIVE_PATH` — a path to the addon's `index.js` (or
 *     directly to a `.node` file), when the env var is set;
 *  2. `crates/indycheck-napi/index.js` relative to this file (works
 *     from both `src/` under vitest and `dist/`);
 *  3. the same path found by walking up from the current working
 *     directory to a repo checkout;
 *  4. the published platform package `indycheck-napi-<platform>`
 *     (e.g. `indycheck-napi-linux-x64-gnu`), installed as an
 *     optionalDependency of this package — this is the step that
 *     makes the PUBLISHED package load the native addon; steps 2–3
 *     only exist inside a repo checkout.
 * The `.node` binary itself is never committed to the repo — build it
 * with `npm run build` in `crates/indycheck-napi` (see its README).
 *
 * Shape note: the Rust wrappers return JSON strings (see
 * `crates/indycheck-napi/src/lib.rs`); they are parsed here into the
 * same `{ valid, code, reason_en, reason_hi, parsed }` objects the
 * TypeScript implementation returns. `detect` in Rust returns only
 * the type string ("pan" | "aadhaar" | ... | "unknown"), so the
 * `ValidationResult<DetectParsed>` shape is rebuilt here from the
 * native type + the matching native validator, exactly like
 * `detect` in `./index`. `validateMany` in Rust returns a bare
 * `ValidationResult[]` (one per input, in order); the
 * `input` / `type` / totals wrapper is rebuilt here with the same
 * `VALID` / `SOME_INVALID` codes and reason strings as `./index`.
 * The `*WithOptions` variants have no native equivalent (the Rust
 * core's options live behind different entry points), so they always
 * use the TypeScript implementation.
 *
 * Every function here never throws on bad input, like `./index`.
 */

import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type {
  AadhaarParsed,
  CinParsed,
  DetectParsed,
  GstinParsed,
  IfscParsed,
  LlpinParsed,
  MobileParsed,
  PincodeParsed,
  TanParsed,
  UpiParsed,
  ValidateManyItemResult,
  ValidateManyParsed,
  ValidationResult,
  VehicleParsed,
  VoterParsed,
} from "./index";
import * as tsImpl from "./index";
import type { PanParsed } from "./index";

// ---------------------------------------------------------------------------
// Loading the addon (lazy, cached, never throws)
// ---------------------------------------------------------------------------

/** Raw napi-rs binding: validators return JSON strings, `detect`
 *  returns the type string, formatters/masks/generators are plain. */
interface NativeBinding {
  validatePan(input: string): string;
  validateAadhaar(input: string): string;
  validateGstin(input: string): string;
  validateIfsc(input: string): string;
  validateUpi(input: string): string;
  validateMobile(input: string): string;
  validatePincode(input: string): string;
  validateTan(input: string): string;
  validateCin(input: string): string;
  validateLlpin(input: string): string;
  validateVoterId(input: string): string;
  validateVehicle(input: string): string;
  detect(input: string): string;
  validateMany(inputs: string[]): string;
  formatMobile(input: string): string | null;
  formatPan(input: string): string | null;
  formatGstin(input: string): string | null;
  maskPan(input: string): string;
  maskMobile(input: string): string;
  generatePan(entity: string): string;
  generateAadhaar(): string;
  generateGstin(stateCode: string): string;
  generateMobile(): string;
}

const nativeRequire = createRequire(join(process.cwd(), "package.json"));

function bindingCandidates(): string[] {
  const envPath = process.env.INDYCHECK_NATIVE_PATH;
  // An explicit path is authoritative: if it cannot be loaded, the
  // addon is treated as absent (TypeScript fallback) instead of
  // silently loading a different binary. Normalise it first: a path
  // containing `..` segments is not resolved by require() (it fails
  // with "Cannot find module"), so collapse it with resolve().
  if (envPath) return [resolve(envPath)];
  const candidates: string[] = [];
  // CommonJS: relative to this file (dist/ or src/ under packages/js).
  if (typeof __dirname !== "undefined") {
    candidates.push(
      join(__dirname, "..", "..", "..", "crates", "indycheck-napi", "index.js"),
    );
  }
  // Walk up from the working directory to a repo checkout (covers
  // vitest, where __dirname is not defined, and `npm test` from anywhere).
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    candidates.push(join(dir, "crates", "indycheck-napi", "index.js"));
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return [...new Set(candidates)].filter((c) => existsSync(c));
}

let binding: NativeBinding | null = null;
let attempted = false;

/** Require a candidate (file path or package name) and keep it only
 *  when it looks like the napi-rs binding; never throws. */
function tryLoad(specifier: string, req: NodeRequire): NativeBinding | null {
  try {
    const mod = req(specifier) as Partial<NativeBinding>;
    if (
      mod &&
      typeof mod.validatePan === "function" &&
      typeof mod.validateVehicle === "function" &&
      typeof mod.detect === "function" &&
      typeof mod.validateMany === "function"
    ) {
      return mod as NativeBinding;
    }
  } catch {
    // Not built / not loadable here — try the next candidate.
  }
  return null;
}

// A require anchored at this file (CommonJS dist) so the platform
// package resolves from the published install's node_modules — the
// platform package is a sibling of this package there. Under vitest
// (no __filename) fall back to the CWD-anchored require.
const selfRequire =
  typeof __filename !== "undefined"
    ? createRequire(__filename)
    : nativeRequire;

/** `true` when this Linux host uses musl libc (Alpine etc.). Same
 *  check as the napi-rs generated loader in
 *  `crates/indycheck-napi/index.js`. */
function isMusl(): boolean {
  if (!process.report || typeof process.report.getReport !== "function") {
    try {
      const lddPath = nativeRequire("child_process")
        .execSync("which ldd")
        .toString()
        .trim();
      return readFileSync(lddPath, "utf8").includes("musl");
    } catch {
      return true;
    }
  }
  // @types/node types getReport() as returning `object` (no header
  // field), so cast to the shape the runtime actually provides.
  const report = process.report.getReport() as unknown as {
    header: { glibcVersionRuntime?: string };
  };
  const { glibcVersionRuntime } = report.header;
  return !glibcVersionRuntime;
}

/** The published platform-package name for this host, or null when
 *  no platform package is published for it (e.g. arm64 Linux). */
function platformPackageName(): string | null {
  const { platform, arch } = process;
  if (platform === "linux" && arch === "x64") {
    return isMusl()
      ? "indycheck-napi-linux-x64-musl"
      : "indycheck-napi-linux-x64-gnu";
  }
  if (platform === "darwin" && arch === "arm64")
    return "indycheck-napi-darwin-arm64";
  if (platform === "darwin" && arch === "x64")
    return "indycheck-napi-darwin-x64";
  if (platform === "win32" && arch === "x64")
    return "indycheck-napi-win32-x64-msvc";
  return null;
}

function loadBinding(): NativeBinding | null {
  if (attempted) return binding;
  attempted = true;
  for (const candidate of bindingCandidates()) {
    const loaded = tryLoad(candidate, nativeRequire);
    if (loaded !== null) {
      binding = loaded;
      break;
    }
  }
  // Published install: no repo checkout, so try the platform package
  // installed as an optionalDependency of this package.
  if (binding === null) {
    const platformPkg = platformPackageName();
    if (platformPkg !== null) {
      binding = tryLoad(platformPkg, selfRequire);
    }
  }
  return binding;
}

/** `true` when the native addon loaded and can be used. */
export function isNativeAvailable(): boolean {
  return loadBinding() !== null;
}

/** Which backend the functions below are currently using. */
export function backend(): "native" | "typescript" {
  return loadBinding() !== null ? "native" : "typescript";
}

// ---------------------------------------------------------------------------
// Call helpers
// ---------------------------------------------------------------------------

/** Rust `ValidationResult::err` omits `parsed` from the JSON entirely
 *  (serde `skip_serializing_if`), while the TS mirror sets it to
 *  `null` — normalise so both backends return identical shapes. */
function normalizeResult<T>(r: ValidationResult<T>): ValidationResult<T> {
  if (r.parsed === undefined) r.parsed = null;
  return r;
}

/** Run a native call that returns a JSON `ValidationResult`; on any
 *  failure (missing addon, bad JSON) use the TypeScript fallback. */
function callJson<T>(
  fn: (b: NativeBinding) => string,
  fallback: () => ValidationResult<T>,
): ValidationResult<T> {
  const b = loadBinding();
  if (b === null) return fallback();
  try {
    return normalizeResult(JSON.parse(fn(b)) as ValidationResult<T>);
  } catch {
    return fallback();
  }
}

/** Run a native call returning a plain value; fall back on any failure. */
function callPlain<T>(fn: (b: NativeBinding) => T, fallback: () => T): T {
  const b = loadBinding();
  if (b === null) return fallback();
  try {
    return fn(b);
  } catch {
    return fallback();
  }
}

/** Native validator for a `detect` type string, or null for "unknown". */
function validateByNativeType(
  b: NativeBinding,
  type: string,
  input: string,
): ValidationResult | null {
  let json: string | null;
  switch (type) {
    case "pan":
      json = b.validatePan(input);
      break;
    case "aadhaar":
      json = b.validateAadhaar(input);
      break;
    case "gstin":
      json = b.validateGstin(input);
      break;
    case "ifsc":
      json = b.validateIfsc(input);
      break;
    case "upi":
      json = b.validateUpi(input);
      break;
    case "mobile":
      json = b.validateMobile(input);
      break;
    case "pincode":
      json = b.validatePincode(input);
      break;
    case "tan":
      json = b.validateTan(input);
      break;
    case "cin":
      json = b.validateCin(input);
      break;
    case "llpin":
      json = b.validateLlpin(input);
      break;
    case "voter":
      json = b.validateVoterId(input);
      break;
    case "vehicle":
      json = b.validateVehicle(input);
      break;
    default:
      return null;
  }
  return normalizeResult(JSON.parse(json) as ValidationResult);
}

// ---------------------------------------------------------------------------
// Validators — native when available, TypeScript otherwise
// ---------------------------------------------------------------------------

export function validatePan(input: unknown): ValidationResult<PanParsed> {
  if (typeof input !== "string") return tsImpl.validatePan(input);
  return callJson<PanParsed>((b) => b.validatePan(input), () => tsImpl.validatePan(input));
}

export function validateAadhaar(input: unknown): ValidationResult<AadhaarParsed> {
  if (typeof input !== "string") return tsImpl.validateAadhaar(input);
  return callJson<AadhaarParsed>((b) => b.validateAadhaar(input), () =>
    tsImpl.validateAadhaar(input),
  );
}

export function validateGstin(input: unknown): ValidationResult<GstinParsed> {
  if (typeof input !== "string") return tsImpl.validateGstin(input);
  return callJson<GstinParsed>((b) => b.validateGstin(input), () => tsImpl.validateGstin(input));
}

export function validateIfsc(input: unknown): ValidationResult<IfscParsed> {
  if (typeof input !== "string") return tsImpl.validateIfsc(input);
  return callJson<IfscParsed>((b) => b.validateIfsc(input), () => tsImpl.validateIfsc(input));
}

export function validateUpi(input: unknown): ValidationResult<UpiParsed> {
  if (typeof input !== "string") return tsImpl.validateUpi(input);
  return callJson<UpiParsed>((b) => b.validateUpi(input), () => tsImpl.validateUpi(input));
}

export function validateMobile(input: unknown): ValidationResult<MobileParsed> {
  if (typeof input !== "string") return tsImpl.validateMobile(input);
  return callJson<MobileParsed>((b) => b.validateMobile(input), () =>
    tsImpl.validateMobile(input),
  );
}

export function validatePincode(input: unknown): ValidationResult<PincodeParsed> {
  if (typeof input !== "string") return tsImpl.validatePincode(input);
  return callJson<PincodeParsed>((b) => b.validatePincode(input), () =>
    tsImpl.validatePincode(input),
  );
}

export function validateTan(input: unknown): ValidationResult<TanParsed> {
  if (typeof input !== "string") return tsImpl.validateTan(input);
  return callJson<TanParsed>((b) => b.validateTan(input), () => tsImpl.validateTan(input));
}

export function validateCin(input: unknown): ValidationResult<CinParsed> {
  if (typeof input !== "string") return tsImpl.validateCin(input);
  return callJson<CinParsed>((b) => b.validateCin(input), () => tsImpl.validateCin(input));
}

export function validateLlpin(input: unknown): ValidationResult<LlpinParsed> {
  if (typeof input !== "string") return tsImpl.validateLlpin(input);
  return callJson<LlpinParsed>((b) => b.validateLlpin(input), () => tsImpl.validateLlpin(input));
}

export function validateVoterId(input: unknown): ValidationResult<VoterParsed> {
  if (typeof input !== "string") return tsImpl.validateVoterId(input);
  return callJson<VoterParsed>((b) => b.validateVoterId(input), () =>
    tsImpl.validateVoterId(input),
  );
}

/** Alias for `validateVoterId`: EPIC is the name printed on the card. */
export function validateEpic(input: unknown): ValidationResult<VoterParsed> {
  return validateVoterId(input);
}

export function validateVehicle(input: unknown): ValidationResult<VehicleParsed> {
  if (typeof input !== "string") return tsImpl.validateVehicle(input);
  return callJson<VehicleParsed>((b) => b.validateVehicle(input), () =>
    tsImpl.validateVehicle(input),
  );
}

/** Alias for `validateVehicle`. */
export function validateVehicleRegistration(input: unknown): ValidationResult<VehicleParsed> {
  return validateVehicle(input);
}

// ---------------------------------------------------------------------------
// detect / validateMany — shapes rebuilt from the native primitives
// ---------------------------------------------------------------------------

/** The Rust `detect` string for a trimmed input. */
export function detectType(input: string): string {
  const b = loadBinding();
  if (b === null) return tsImpl.detectType(input);
  try {
    return b.detect(input);
  } catch {
    return tsImpl.detectType(input);
  }
}

export function detect(input: unknown): ValidationResult<DetectParsed> {
  if (typeof input !== "string") return tsImpl.detect(input);
  const b = loadBinding();
  if (b === null) return tsImpl.detect(input);
  try {
    const type = b.detect(input);
    const trimmed = input.trim();
    if (type === "unknown") {
      return {
        valid: false,
        code: "UNKNOWN_TYPE",
        reason_en: "Could not detect the type of this input",
        reason_hi: "Is input ka type pehchana nahi ja saka",
        parsed: { type: "unknown", value: trimmed, result: null },
      };
    }
    const result = validateByNativeType(b, type, input);
    if (result === null) return tsImpl.detect(input);
    return {
      valid: result.valid,
      code: result.code,
      reason_en: result.reason_en,
      reason_hi: result.reason_hi,
      parsed: { type, value: trimmed, result },
    };
  } catch {
    return tsImpl.detect(input);
  }
}

export function validateMany(inputs: unknown): ValidationResult<ValidateManyParsed> {
  if (!Array.isArray(inputs) || inputs.length === 0) {
    return tsImpl.validateMany(inputs);
  }
  if (!inputs.every((item) => typeof item === "string")) {
    // Typed `{ value, type }` entries and non-strings are a
    // TypeScript-wrapper feature — the native batch takes strings only.
    return tsImpl.validateMany(inputs);
  }
  const b = loadBinding();
  if (b === null) return tsImpl.validateMany(inputs);
  try {
    const results = JSON.parse(b.validateMany(inputs as string[])) as ValidationResult[];
    const items: ValidateManyItemResult[] = (inputs as string[]).map((item, i) => {
      const result = normalizeResult(results[i]);
      const type = b.detect(item);
      return {
        input: item,
        type: type === "unknown" ? null : type,
        valid: result.valid,
        code: result.code,
        reason_en: result.reason_en,
        reason_hi: result.reason_hi,
        parsed: result.parsed,
      };
    });
    const validCount = items.filter((r) => r.valid).length;
    const invalidCount = items.length - validCount;
    const parsed: ValidateManyParsed = {
      results: items,
      total: items.length,
      validCount,
      invalidCount,
    };
    if (invalidCount === 0) {
      return {
        valid: true,
        code: "VALID",
        reason_en: "All inputs are valid.",
        reason_hi: "Saare input sahi hain.",
        parsed,
      };
    }
    return {
      valid: false,
      code: "SOME_INVALID",
      reason_en: "Some inputs are invalid.",
      reason_hi: "Kuch input galat hain.",
      parsed,
    };
  } catch {
    return tsImpl.validateMany(inputs);
  }
}

// ---------------------------------------------------------------------------
// Format / mask — same contracts as ./index
// ---------------------------------------------------------------------------

export function formatMobile(input: unknown): ValidationResult<MobileParsed> {
  // Same contract as validateMobile (see ./index).
  return validateMobile(input);
}

export function formatPan(input: unknown): string | null {
  if (typeof input !== "string") return tsImpl.formatPan(input);
  return callPlain<string | null>((b) => b.formatPan(input), () => tsImpl.formatPan(input));
}

export function formatGstin(input: unknown): string | null {
  if (typeof input !== "string") return tsImpl.formatGstin(input);
  return callPlain<string | null>((b) => b.formatGstin(input), () => tsImpl.formatGstin(input));
}

export function maskAadhaar(input: unknown): ValidationResult<AadhaarParsed> {
  // Same contract as validateAadhaar (see ./index) — NOT the Rust
  // `mask_aadhaar` string function, which masks any 12-digit string.
  return validateAadhaar(input);
}

export function maskPan(input: unknown): string {
  if (typeof input !== "string") return tsImpl.maskPan(input);
  return callPlain<string>((b) => b.maskPan(input), () => tsImpl.maskPan(input));
}

export function maskMobile(input: unknown): string {
  if (typeof input !== "string") return tsImpl.maskMobile(input);
  return callPlain<string>((b) => b.maskMobile(input), () => tsImpl.maskMobile(input));
}

// ---------------------------------------------------------------------------
// Mock test-data generators — TEST DATA ONLY, never real issued IDs
// ---------------------------------------------------------------------------

export function generatePan(entity?: unknown): string {
  const code =
    typeof entity === "string" && entity.length > 0 ? entity : "P";
  return callPlain<string>((b) => b.generatePan(code), () => tsImpl.generatePan(entity));
}

export function generateAadhaar(): string {
  return callPlain<string>((b) => b.generateAadhaar(), () => tsImpl.generateAadhaar());
}

export function generateGstin(stateCode?: unknown): string {
  const code = typeof stateCode === "string" ? stateCode : "18";
  return callPlain<string>((b) => b.generateGstin(code), () => tsImpl.generateGstin(stateCode));
}

export function generateMobile(): string {
  return callPlain<string>((b) => b.generateMobile(), () => tsImpl.generateMobile());
}

// ---------------------------------------------------------------------------
// Options variants — no native equivalent; always TypeScript
// ---------------------------------------------------------------------------

export const validateMobileWithOptions = tsImpl.validateMobileWithOptions;
export const validatePanWithOptions = tsImpl.validatePanWithOptions;
export const validateAadhaarWithOptions = tsImpl.validateAadhaarWithOptions;
export const validateGstinWithOptions = tsImpl.validateGstinWithOptions;
export const formatMobileWithOptions = tsImpl.formatMobileWithOptions;
export const defaultOptions = tsImpl.defaultOptions;
export const lenientOptions = tsImpl.lenientOptions;
export const noSpacesHyphensOptions = tsImpl.noSpacesHyphensOptions;

export default {
  backend,
  isNativeAvailable,
  validateMobile,
  validatePan,
  validateAadhaar,
  validateGstin,
  validateIfsc,
  validateUpi,
  validatePincode,
  validateTan,
  validateCin,
  validateLlpin,
  validateVoterId,
  validateEpic,
  validateVehicle,
  validateVehicleRegistration,
  validateMobileWithOptions,
  validatePanWithOptions,
  validateAadhaarWithOptions,
  validateGstinWithOptions,
  formatMobile,
  formatMobileWithOptions,
  formatPan,
  formatGstin,
  maskAadhaar,
  maskPan,
  maskMobile,
  generatePan,
  generateAadhaar,
  generateGstin,
  generateMobile,
  defaultOptions,
  lenientOptions,
  noSpacesHyphensOptions,
  detect,
  detectType,
  validateMany,
};
