/**
 * indycheck — offline Indian ID validator (pure-TypeScript mirror).
 *
 * This file mirrors the Rust core in crates/indycheck/src/ exactly:
 * same validators, same order of checks, same stable `code` values, same
 * `reason_en` / `reason_hi` strings, same `parsed` shapes (see
 * shared/spec.md). Behaviour is defined by shared/test-vectors.json
 * together with the Rust code; as of the last check the two agree on all
 * 245 vectors (verified by emulating the Rust source over the file), so
 * the vector test below asserts every entry directly with no exceptions.
 * If the Rust side drifts again, that test fails loudly instead of
 * silently picking a side.
 *
 * The 12 validators are: mobile, PAN, Aadhaar, GSTIN, IFSC, UPI, PIN
 * code, TAN, CIN, LLPIN, Voter ID / EPIC and vehicle registration.
 * TAN, CIN, LLPIN, Voter ID, vehicle and IFSC have no public checksum:
 * only their format is checked (say so wherever these are documented).
 * `validate*WithOptions` exists only where the Rust core has it — mobile,
 * PAN, Aadhaar and GSTIN (options.rs); the other validators take no
 * options in Rust either. `formatPan` / `formatGstin` return
 * `string | null` and `maskPan` / `maskMobile` return a plain string
 * ("" when the format is invalid), exactly like the Rust functions —
 * unlike the legacy `formatMobile` / `maskAadhaar` wrappers, which keep
 * returning a `ValidationResult` for backwards compatibility.
 * The `generate*` functions produce mock test data only: syntactically
 * valid, never a real issued ID — see generate.rs and the README.
 *
 * Notes on the Rust contract reproduced here:
 * - Success code is `VALID` (not `OK`). The full code set is:
 *   VALID, EMPTY, INVALID_LENGTH, INVALID_FORMAT, INVALID_CHECKSUM,
 *   INVALID_FIRST_DIGIT, INVALID_STATE_CODE, INVALID_ENTITY,
 *   INVALID_HANDLE, UNKNOWN_TYPE. `INVALID_TYPE` (non-string input) and
 *   `SOME_INVALID` (validateMany batch result) exist only in the JS/Python
 *   wrappers — Rust takes `&str` and returns a bare `Vec` for batches.
 * - `reason_hi` is Roman-script Hinglish in the Rust core (e.g.
 *   "PAN khaali hai"), not Devanagari — reproduced verbatim, even though
 *   spec.md calls it Devanagari Hindi.
 * - PAN entity checking is lenient by design (pan.rs, spec.md): the 4th
 *   character is reported in `parsed` (entity name, or "Unknown" when it
 *   is not in the published list) and the PAN is still format-valid.
 *   The canonical example ABCDE1234F is valid with entity "Unknown"
 *   (4th char D). `INVALID_ENTITY` is a reserved stable code, not
 *   emitted in v0.1.
 * - `detect` returns the Rust detect string ("pan" | "aadhaar" | "gstin" |
 *   "ifsc" | "upi" | "mobile" | "pincode" | "tan" | "cin" | "llpin" |
 *   "voter" | "vehicle" | "unknown") in `parsed.type`.
 *   It is shape-based, not validity-based: detection can succeed while
 *   validation of the same input fails. Its order is fixed by lib.rs:
 *   `@` -> upi first; then a Verhoeff-valid 12-digit number -> aadhaar
 *   (including spaced / hyphenated Aadhaar, digits-only); then any
 *   normalisable mobile -> mobile; then CIN (21 chars); then by length
 *   (15 -> gstin, 12 digits -> aadhaar, 11 IFSC-pattern -> ifsc,
 *   10 PAN-pattern -> pan, 10 TAN-pattern -> tan, 10 voter-pattern ->
 *   voter, 10 digits -> mobile, 7 LLPIN-pattern -> llpin, 6 digits ->
 *   pincode); then formatted mobiles, then PAN / TAN / voter / IFSC /
 *   LLPIN patterns, then vehicle. Note the code's order, not spec.md's
 *   one-line summary of it.
 * - `formatMobile` returns the validateMobile result (parsed.normalized
 *   is the 10-digit string, Rust's `format_mobile` return). `maskAadhaar`
 *   returns the validateAadhaar result (parsed.masked). Unlike the Rust
 *   `mask_aadhaar` string function — which masks any 12-digit string,
 *   even one with a bad checksum — the JS/Python maskAadhaar only
 *   succeeds for a fully valid Aadhaar number.
 * - UPI handle list, GSTIN state names (incl. 25/26) and PAN entity
 *   names are copied verbatim from crates/indycheck/src/data.rs and
 *   pan.rs (note: B -> "BODY", H -> "HUF", A -> "AOP").
 *
 * Honest limits: format + checksum only. Nothing here checks a number
 * against UIDAI, NSDL / Income Tax, GSTN, a bank, or any other live
 * database. A `valid: true` result means "well-formed and checksum-correct",
 * not "this ID really exists / belongs to this person".
 *
 * Every validator returns `{ valid, code, reason_en, reason_hi, parsed }`
 * and never throws on bad input.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ValidationResult<TParsed = unknown> {
  valid: boolean;
  code: string;
  reason_en: string;
  reason_hi: string;
  parsed: TParsed | null;
}

/** Validation options — verbatim from crates/indycheck/src/options.rs.
 *  All fields default to `true`. Only mobile, PAN, Aadhaar and GSTIN
 *  have `validate*WithOptions` variants in the Rust core; the other
 *  validators take no options. */
export interface Options {
  /** Enforce every rule, including first-digit rules and checksums.
   *  `false` skips those (format only). */
  strict: boolean;
  /** Strip spaces and hyphens before validating; `false` makes any
   *  space or hyphen an INVALID_FORMAT error. */
  allow_spaces_hyphens: boolean;
  /** A mobile may carry a `+91` / `91` / `0` prefix; `false` accepts
   *  only a bare 10-digit number. */
  normalise_plus91: boolean;
  /** Upper-case letter input before validating; `false` makes a
   *  lower-case letter fail the format check instead. */
  uppercase: boolean;
}

/** parsed shapes follow shared/spec.md exactly. */
export interface MobileParsed {
  normalized: string;
}

export interface PanParsed {
  entity: string;
  entity_code: string;
}

export interface AadhaarParsed {
  masked: string;
}

export interface GstinParsed {
  state: string;
  state_code: string;
  pan: string;
}

export interface IfscParsed {
  bank_code: string;
  branch_code: string;
}

export interface UpiParsed {
  handle: string;
}

export interface PincodeParsed {
  pincode: string;
}

export interface TanParsed {
  tan: string;
}

export interface CinParsed {
  cin: string;
  listing: string;
  industry_code: string;
  state_code: string;
  year: string;
  company_type: string;
  registration_number: string;
}

export interface LlpinParsed {
  llpin: string;
}

export interface VoterParsed {
  epic: string;
}

export interface VehicleParsed {
  registration: string;
  series_type: "state" | "bharat";
  state_code?: string;
  district?: string;
  series: string;
  number: string;
  year?: string;
  suffix?: string;
}

export interface DetectParsed {
  type: string | null;
  value: string | null;
  result: ValidationResult | null;
}

export interface ValidateManyItemResult {
  input: unknown;
  type: string | null;
  valid: boolean;
  code: string;
  reason_en: string;
  reason_hi: string;
  parsed: unknown;
}

export interface ValidateManyParsed {
  results: ValidateManyItemResult[];
  total: number;
  validCount: number;
  invalidCount: number;
}

// ---------------------------------------------------------------------------
// Shared tables — verbatim from crates/indycheck/src/data.rs and pan.rs
// ---------------------------------------------------------------------------

export const PAN_ENTITY_TYPES: Record<string, string> = {
  A: "AOP",
  B: "BODY",
  C: "Company",
  F: "Firm",
  G: "Government",
  H: "HUF",
  J: "Artificial Juridical Person",
  L: "Local Authority",
  P: "Individual",
  T: "Trust",
};

export const GSTIN_STATE_NAMES: Record<string, string> = {
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
};

/** Common UPI handles, verbatim from crates/indycheck/src/data.rs. */
export const UPI_HANDLES: string[] = [
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
];

// ---------------------------------------------------------------------------
// Result helpers (never throw)
// ---------------------------------------------------------------------------

function ok<T>(reason_en: string, reason_hi: string, parsed: T): ValidationResult<T> {
  return { valid: true, code: "VALID", reason_en, reason_hi, parsed };
}

function fail<T = unknown>(
  code: string,
  reason_en: string,
  reason_hi: string,
  parsed: T | null = null,
): ValidationResult<T> {
  return { valid: false, code, reason_en, reason_hi, parsed };
}

/** JS/Python-only code: the Rust core takes &str, so it has no equivalent. */
function invalidType<T = unknown>(): ValidationResult<T> {
  return fail("INVALID_TYPE", "Input must be a string.", "Input string hona chahiye.");
}

function empty<T = unknown>(reason_en: string, reason_hi: string): ValidationResult<T> {
  return fail("EMPTY", reason_en, reason_hi);
}

/** ASCII-only upper-casing (Rust's to_ascii_uppercase; avoids e.g. ß -> SS). */
function asciiUpper(s: string): string {
  return s.replace(/[a-z]/g, (c) => c.toUpperCase());
}

function charsOf(s: string): string[] {
  return [...s];
}

function isAsciiAlpha(c: string): boolean {
  return (c >= "A" && c <= "Z") || (c >= "a" && c <= "z");
}

function isAsciiDigit(c: string): boolean {
  return c >= "0" && c <= "9";
}

function isAsciiAlnum(c: string): boolean {
  return isAsciiAlpha(c) || isAsciiDigit(c);
}

/** Coerce an unknown input to a trimmed string, or return null + the reason to use. */
function asString(input: unknown): { value: string | null; error: ValidationResult | null } {
  if (typeof input !== "string") return { value: null, error: invalidType() };
  const value = input.trim();
  if (value === "") return { value: null, error: null };
  return { value, error: null };
}

// ---------------------------------------------------------------------------
// Options — verbatim from options.rs
// ---------------------------------------------------------------------------

export const DEFAULT_OPTIONS: Options = {
  strict: true,
  allow_spaces_hyphens: true,
  normalise_plus91: true,
  uppercase: true,
};

/** Strict validation (the default): every rule enforced. */
export function defaultOptions(): Options {
  return { ...DEFAULT_OPTIONS };
}

/** Lenient validation: format only — first-digit and checksum checks
 *  are skipped. */
export function lenientOptions(): Options {
  return { ...DEFAULT_OPTIONS, strict: false };
}

/** Start from the defaults and turn off space/hyphen tolerance. */
export function noSpacesHyphensOptions(): Options {
  return { ...DEFAULT_OPTIONS, allow_spaces_hyphens: false };
}

/** Merge a partial options object onto the defaults. */
function resolveOptions(options?: Partial<Options>): Options {
  return { ...DEFAULT_OPTIONS, ...(options ?? {}) };
}

/** Rust `spaces_hyphens_ok`: rejects spaces/hyphens/tabs in the raw
 *  input when the option forbids them. Note this checks the raw input,
 *  so leading/trailing whitespace counts too. */
function spacesHyphensOk(input: string, options: Options): boolean {
  return (
    options.allow_spaces_hyphens ||
    (!input.includes(" ") && !input.includes("-") && !input.includes("\t"))
  );
}

/** Rust `maybe_uppercase`: trims, then upper-cases when the option says so. */
function maybeUppercase(input: string, options: Options): string {
  const trimmed = input.trim();
  return options.uppercase ? asciiUpper(trimmed) : trimmed;
}

/** Rust `strip_spaces_hyphens`: strips whitespace and hyphens when the
 *  option allows it, otherwise returns the input unchanged. */
function stripSpacesHyphens(input: string, options: Options): string {
  if (!options.allow_spaces_hyphens) return input;
  return [...input].filter((c) => !/\s/.test(c) && c !== "-").join("");
}

// ---------------------------------------------------------------------------
// Verhoeff (Aadhaar checksum) — tables verbatim from verhoeff.rs
// ---------------------------------------------------------------------------

const VERHOEFF_D: number[][] = [
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
];

const VERHOEFF_P: number[][] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 0, 1, 3, 2, 4, 9, 6, 7, 5],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

function verhoeffValid(digits: string): boolean {
  let c = 0;
  const reversed = charsOf(digits).reverse();
  for (let i = 0; i < reversed.length; i++) {
    c = VERHOEFF_D[c][VERHOEFF_P[i % 8][Number(reversed[i])]];
  }
  return c === 0;
}

const VERHOEFF_INV: number[] = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9];

/** Rust `verhoeff::verify_digit`: the check digit for a digit base
 *  (the check digit occupies position 0, so base digits start at 1). */
function verhoeffVerifyDigit(base: string): string {
  let c = 0;
  const reversed = charsOf(base).reverse();
  for (let i = 0; i < reversed.length; i++) {
    c = VERHOEFF_D[c][VERHOEFF_P[(i + 1) % 8][Number(reversed[i])]];
  }
  return String(VERHOEFF_INV[c]);
}

// ---------------------------------------------------------------------------
// GSTIN Mod-36 Luhn (alphabet 0-9A-Z) — verbatim from luhn36.rs
// ---------------------------------------------------------------------------

const GSTIN_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function gstinCheckDigit(first14: string): string | null {
  if (charsOf(first14).length !== 14) return null;
  let factor = 2;
  let sum = 0;
  for (const c of charsOf(first14).reverse()) {
    const code = GSTIN_ALPHABET.indexOf(c);
    if (code < 0) return null;
    const product = code * factor;
    sum += Math.floor(product / 36) + (product % 36);
    factor = factor === 2 ? 1 : 2;
  }
  const check = (36 - (sum % 36)) % 36;
  return GSTIN_ALPHABET[check];
}

function gstinCheckDigitValid(gstin: string): boolean {
  const chars = charsOf(gstin);
  if (chars.length !== 15) return false;
  const expected = gstinCheckDigit(chars.slice(0, 14).join(""));
  return expected !== null && expected === chars[14];
}

// ---------------------------------------------------------------------------
// Mobile — verbatim from mobile.rs
// ---------------------------------------------------------------------------

/** Rust `normalize_mobile`: strips whitespace + hyphens, one leading '+',
 *  then a 91 / 0 prefix only when the rest is exactly 10 digits. */
function normalizeMobile(input: string): string | null {
  return normalizeMobileWithOptions(input, DEFAULT_OPTIONS);
}

/** Same as `normalizeMobile`, with caller-controlled `Options`.
 *  With `normalise_plus91: false` only a bare 10-digit number is accepted;
 *  with `allow_spaces_hyphens: false` any space or hyphen rejects the input. */
function normalizeMobileWithOptions(input: string, options: Options): string | null {
  let cleaned: string;
  if (options.allow_spaces_hyphens) {
    cleaned = input
      .trim()
      .split("")
      .filter((c) => !/\s/.test(c) && c !== "-")
      .join("");
  } else {
    if ([...input].some((c) => /\s/.test(c) || c === "-")) return null;
    cleaned = input.trim();
  }
  if (!options.normalise_plus91) {
    if (cleaned.length === 10 && charsOf(cleaned).every(isAsciiDigit)) return cleaned;
    return null;
  }
  const withoutPlus = cleaned.startsWith("+") ? cleaned.slice(1) : cleaned;
  let digits = withoutPlus;
  if (withoutPlus.startsWith("91") && withoutPlus.slice(2).length === 10) {
    digits = withoutPlus.slice(2);
  } else if (withoutPlus.startsWith("0") && withoutPlus.slice(1).length === 10) {
    digits = withoutPlus.slice(1);
  }
  if (digits.length === 10 && charsOf(digits).every(isAsciiDigit)) return digits;
  return null;
}

/** Rust `format_mobile_with_options` as a plain string: the normalised
 *  10-digit number, or `null`. Lenient options skip the first-digit
 *  (6-9) rule. */
function formatMobileString(input: string, options: Options): string | null {
  const normalized = normalizeMobileWithOptions(input, options);
  if (normalized === null) return null;
  if (!options.strict || /^[6-9]/.test(normalized)) return normalized;
  return null;
}

export function validateMobile(input: unknown): ValidationResult<MobileParsed> {
  return validateMobileWithOptions(input);
}

/** Same as `validateMobile`, with caller-controlled `Options`.
 *  With `strict: false` the first-digit rule is skipped (format only). */
export function validateMobileWithOptions(
  input: unknown,
  options?: Partial<Options>,
): ValidationResult<MobileParsed> {
  try {
    if (typeof input !== "string") return invalidType<MobileParsed>();
    const opts = resolveOptions(options);
    if (input.trim() === "") {
      return empty<MobileParsed>("Mobile number is empty", "Mobile number khaali hai");
    }
    const normalized = normalizeMobileWithOptions(input, opts);
    if (normalized === null) {
      return fail(
        "INVALID_FORMAT",
        "Mobile number must be 10 digits, optionally with +91, 91 or 0 prefix",
        "Mobile number 10 digit ka hona chahiye, +91, 91 ya 0 ke saath bhi chalega",
      );
    }
    if (opts.strict && !/^[6-9]/.test(normalized)) {
      return fail(
        "INVALID_FIRST_DIGIT",
        "Indian mobile numbers start with 6, 7, 8 or 9",
        "Bharat ke mobile number 6, 7, 8 ya 9 se shuru hote hain",
      );
    }
    return ok("Mobile number format is valid", "Mobile number ka format sahi hai", {
      normalized,
    });
  } catch {
    return invalidType<MobileParsed>();
  }
}

export function formatMobile(input: unknown): ValidationResult<MobileParsed> {
  // Same contract as validateMobile; `parsed.normalized` is the 10-digit
  // string (Rust `format_mobile` returns exactly that, or None).
  return validateMobile(input);
}

export function formatMobileWithOptions(
  input: unknown,
  options?: Partial<Options>,
): ValidationResult<MobileParsed> {
  return validateMobileWithOptions(input, options);
}

/** Masks a mobile number as `******3210` (6 asterisks + last 4 digits).
 *  Returns an empty string when the input is not a valid-format mobile
 *  number. A non-empty result is not proof of validity. */
export function maskMobile(input: unknown): string {
  if (typeof input !== "string") return "";
  const normalized = formatMobileString(input, DEFAULT_OPTIONS);
  return normalized === null ? "" : `******${normalized.slice(6)}`;
}

// ---------------------------------------------------------------------------
// PAN — verbatim from pan.rs
// ---------------------------------------------------------------------------

export function validatePan(input: unknown): ValidationResult<PanParsed> {
  return validatePanWithOptions(input);
}

/** Same as `validatePan`, with caller-controlled `Options`.
 *  For PAN, `strict`/`lenient` make no difference (there is no checksum or
 *  first-digit rule to skip); `uppercase` and `allow_spaces_hyphens` do. */
export function validatePanWithOptions(
  input: unknown,
  options?: Partial<Options>,
): ValidationResult<PanParsed> {
  try {
    if (typeof input !== "string") return invalidType<PanParsed>();
    const opts = resolveOptions(options);
    if (input.trim() === "") {
      return empty<PanParsed>("PAN is empty", "PAN khaali hai");
    }
    if (!spacesHyphensOk(input, opts)) {
      return fail(
        "INVALID_FORMAT",
        "PAN must not contain spaces or hyphens with these options",
        "In options ke saath PAN me space ya hyphen nahi hona chahiye",
      );
    }
    const upper = stripSpacesHyphens(maybeUppercase(input, opts), opts);
    if (!opts.uppercase && charsOf(upper).some((c) => c >= "a" && c <= "z")) {
      return fail(
        "INVALID_FORMAT",
        "PAN must be upper-case with these options",
        "In options ke saath PAN upper-case me hona chahiye",
      );
    }
    if (charsOf(upper).length !== 10) {
      return fail(
        "INVALID_LENGTH",
        "PAN must be exactly 10 characters",
        "PAN bilkul 10 character ka hona chahiye",
      );
    }
    const chars = charsOf(upper);
    const formatOk =
      chars.slice(0, 5).every(isAsciiAlpha) &&
      chars.slice(5, 9).every(isAsciiDigit) &&
      isAsciiAlpha(chars[9]);
    if (!formatOk) {
      return fail(
        "INVALID_FORMAT",
        "PAN format must be 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F). PAN has no public checksum, so only the format is checked",
        "PAN ka format 5 akshar, 4 digit, 1 akshar hona chahiye (jaise ABCDE1234F). PAN ka koi public checksum nahi hai, isliye sirf format check hota hai",
      );
    }
    // An unlisted 4th character is reported as entity "Unknown" and the
    // PAN is still format-valid (pan.rs). INVALID_ENTITY is a reserved
    // stable code, not emitted in v0.1.
    const entity = PAN_ENTITY_TYPES[chars[3]] ?? "Unknown";
    return ok(
      "PAN format is valid. PAN has no public checksum, so this only checks the format",
      "PAN ka format sahi hai. PAN ka koi public checksum nahi hai, isliye sirf format check hua hai",
      { entity, entity_code: chars[3] },
    );
  } catch {
    return invalidType<PanParsed>();
  }
}

/** Formats a PAN: upper-cases it and strips spaces/hyphens.
 *  Returns `"ABCDE1234F"` when the result matches the PAN pattern,
 *  otherwise `null`. */
export function formatPan(input: unknown): string | null {
  if (typeof input !== "string") return null;
  try {
    const upper = stripSpacesHyphens(maybeUppercase(input, DEFAULT_OPTIONS), DEFAULT_OPTIONS);
    return isPanPattern(upper) ? upper : null;
  } catch {
    return null;
  }
}

/** Masks a PAN as `ABCDE****F` (first 5 chars, 4 asterisks, last char).
 *  Returns an empty string when the input is not a valid-format PAN.
 *  A non-empty result is not proof of validity — use `validatePan`. */
export function maskPan(input: unknown): string {
  const pan = formatPan(input);
  return pan === null ? "" : `${pan.slice(0, 5)}****${pan.slice(9)}`;
}

// ---------------------------------------------------------------------------
// Aadhaar — verbatim from aadhaar.rs
// ---------------------------------------------------------------------------

export function maskAadhaarString(input: string): string {
  const cleaned = input
    .trim()
    .split("")
    .filter((c) => !/\s/.test(c) && c !== "-")
    .join("");
  if (charsOf(cleaned).length !== 12 || !charsOf(cleaned).every(isAsciiDigit)) return "";
  return `XXXX XXXX ${cleaned.slice(8)}`;
}

export function validateAadhaar(input: unknown): ValidationResult<AadhaarParsed> {
  return validateAadhaarWithOptions(input);
}

/** Same as `validateAadhaar`, with caller-controlled `Options`.
 *  With `strict: false` the first-digit and Verhoeff checksum checks are
 *  skipped (12 digits only). With `allow_spaces_hyphens: false`, spaces
 *  or hyphens in the input are an `INVALID_FORMAT` error. */
export function validateAadhaarWithOptions(
  input: unknown,
  options?: Partial<Options>,
): ValidationResult<AadhaarParsed> {
  try {
    if (typeof input !== "string") return invalidType<AadhaarParsed>();
    const opts = resolveOptions(options);
    if (input.trim() === "") {
      return empty<AadhaarParsed>("Aadhaar number is empty", "Aadhaar number khaali hai");
    }
    if (!spacesHyphensOk(input, opts)) {
      return fail(
        "INVALID_FORMAT",
        "Aadhaar number must not contain spaces or hyphens with these options",
        "In options ke saath Aadhaar number me space ya hyphen nahi hona chahiye",
      );
    }
    const cleaned = stripSpacesHyphens(input.trim(), opts);
    if (charsOf(cleaned).length !== 12) {
      return fail(
        "INVALID_LENGTH",
        "Aadhaar number must be exactly 12 digits",
        "Aadhaar number bilkul 12 digit ka hona chahiye",
      );
    }
    if (!charsOf(cleaned).every(isAsciiDigit)) {
      return fail(
        "INVALID_FORMAT",
        "Aadhaar number must contain only digits",
        "Aadhaar number me sirf digit hone chahiye",
      );
    }
    if (opts.strict && !/^[2-9]/.test(cleaned)) {
      return fail(
        "INVALID_FIRST_DIGIT",
        "Aadhaar number must start with 2-9",
        "Aadhaar number 2 se 9 ke beech wale digit se shuru hona chahiye",
      );
    }
    if (opts.strict && !verhoeffValid(cleaned)) {
      return fail(
        "INVALID_CHECKSUM",
        "Aadhaar checksum is invalid (Verhoeff check failed)",
        "Aadhaar ka checksum galat hai (Verhoeff check fail hua)",
      );
    }
    return ok(
      "Aadhaar number format and checksum are valid",
      "Aadhaar number ka format aur checksum sahi hai",
      { masked: maskAadhaarString(cleaned) },
    );
  } catch {
    return invalidType<AadhaarParsed>();
  }
}

export function maskAadhaar(input: unknown): ValidationResult<AadhaarParsed> {
  // Same contract as validateAadhaar; `parsed.masked` is the result.
  // (Differs from Rust `mask_aadhaar`, which masks any 12-digit string.)
  return validateAadhaar(input);
}

// ---------------------------------------------------------------------------
// GSTIN — verbatim from gstin.rs
// ---------------------------------------------------------------------------

export function validateGstin(input: unknown): ValidationResult<GstinParsed> {
  return validateGstinWithOptions(input);
}

/** Same as `validateGstin`, with caller-controlled `Options`.
 *  With `strict: false` the Mod-36 check-digit check is skipped (format
 *  and state code still checked). With `allow_spaces_hyphens: false`,
 *  spaces or hyphens in the input are an `INVALID_FORMAT` error. */
export function validateGstinWithOptions(
  input: unknown,
  options?: Partial<Options>,
): ValidationResult<GstinParsed> {
  try {
    if (typeof input !== "string") return invalidType<GstinParsed>();
    const opts = resolveOptions(options);
    if (input.trim() === "") {
      return empty<GstinParsed>("GSTIN is empty", "GSTIN khaali hai");
    }
    if (!spacesHyphensOk(input, opts)) {
      return fail(
        "INVALID_FORMAT",
        "GSTIN must not contain spaces or hyphens with these options",
        "In options ke saath GSTIN me space ya hyphen nahi hona chahiye",
      );
    }
    const upper = stripSpacesHyphens(maybeUppercase(input, opts), opts);
    if (!opts.uppercase && charsOf(upper).some((c) => c >= "a" && c <= "z")) {
      return fail(
        "INVALID_FORMAT",
        "GSTIN must be upper-case with these options",
        "In options ke saath GSTIN upper-case me hona chahiye",
      );
    }
    if (charsOf(upper).length !== 15) {
      return fail(
        "INVALID_LENGTH",
        "GSTIN must be exactly 15 characters",
        "GSTIN bilkul 15 character ka hona chahiye",
      );
    }
    const chars = charsOf(upper);
    if (!chars.slice(0, 2).every(isAsciiDigit)) {
      return fail(
        "INVALID_FORMAT",
        "GSTIN must start with a 2-digit state code",
        "GSTIN 2 digit ke state code se shuru hona chahiye",
      );
    }
    const stateCode = chars.slice(0, 2).join("");
    const state = GSTIN_STATE_NAMES[stateCode];
    if (!state) {
      return fail(
        "INVALID_STATE_CODE",
        "GSTIN state code is not a valid Indian state code (01-38)",
        "GSTIN ka state code sahi nahi hai (01-38 ke beech hona chahiye)",
      );
    }
    const pan = chars.slice(2, 12).join("");
    const panChars = charsOf(pan);
    const panFormatOk =
      panChars.slice(0, 5).every(isAsciiAlpha) &&
      panChars.slice(5, 9).every(isAsciiDigit) &&
      isAsciiAlpha(panChars[9]);
    if (!panFormatOk) {
      return fail(
        "INVALID_FORMAT",
        "GSTIN characters 3-12 must be a PAN in 5 letters, 4 digits, 1 letter format",
        "GSTIN ke 3 se 12 tak ke character PAN format me hone chahiye (5 akshar, 4 digit, 1 akshar)",
      );
    }
    if (!isAsciiAlnum(chars[12])) {
      return fail(
        "INVALID_FORMAT",
        "GSTIN 13th character must be a letter or digit (entity number)",
        "GSTIN ka 13th character akshar ya digit hona chahiye",
      );
    }
    if (chars[13] !== "Z") {
      return fail(
        "INVALID_FORMAT",
        "GSTIN 14th character must be Z",
        "GSTIN ka 14th character Z hona chahiye",
      );
    }
    if (!isAsciiAlnum(chars[14])) {
      return fail(
        "INVALID_FORMAT",
        "GSTIN 15th character must be a letter or digit (check digit)",
        "GSTIN ka 15th character akshar ya digit hona chahiye",
      );
    }
    if (opts.strict && !gstinCheckDigitValid(upper)) {
      return fail(
        "INVALID_CHECKSUM",
        "GSTIN check digit is invalid (Mod-36 Luhn check failed)",
        "GSTIN ka check digit galat hai (Mod-36 Luhn check fail hua)",
      );
    }
    return ok("GSTIN format, state code and check digit are valid", "GSTIN ka format, state code aur check digit sahi hai", {
      state,
      state_code: stateCode,
      pan,
    });
  } catch {
    return invalidType<GstinParsed>();
  }
}

/** Formats a GSTIN: upper-cases it and strips spaces/hyphens.
 *  Returns the formatted GSTIN when its structure is in place (state
 *  code, PAN part and `Z`); the check digit is NOT verified here —
 *  so a `formatGstin` result can still fail `validateGstin`.
 *  Returns `null` otherwise. */
export function formatGstin(input: unknown): string | null {
  if (typeof input !== "string") return null;
  try {
    const result = validateGstinWithOptions(input, lenientOptions());
    if (!result.valid) return null;
    return stripSpacesHyphens(maybeUppercase(input, DEFAULT_OPTIONS), DEFAULT_OPTIONS);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// IFSC — verbatim from ifsc.rs
// ---------------------------------------------------------------------------

export function validateIfsc(input: unknown): ValidationResult<IfscParsed> {
  try {
    const { value, error } = asString(input);
    if (error) return error as ValidationResult<IfscParsed>;
    if (value === null) {
      return empty<IfscParsed>("IFSC is empty", "IFSC khaali hai");
    }
    const upper = asciiUpper(value);
    if (charsOf(upper).length !== 11) {
      return fail(
        "INVALID_LENGTH",
        "IFSC must be exactly 11 characters",
        "IFSC bilkul 11 character ka hona chahiye",
      );
    }
    const chars = charsOf(upper);
    const formatOk =
      chars.slice(0, 4).every(isAsciiAlpha) &&
      chars[4] === "0" &&
      chars.slice(5).every(isAsciiAlnum);
    if (!formatOk) {
      return fail(
        "INVALID_FORMAT",
        "IFSC format must be 4 letters, 0, then 6 letters/digits (e.g. SBIN0000123). IFSC has no checksum, so only the format is checked",
        "IFSC ka format 4 akshar, 0, phir 6 akshar/digit hona chahiye (jaise SBIN0000123). IFSC ka koi checksum nahi hai, isliye sirf format check hota hai",
      );
    }
    return ok(
      "IFSC format is valid. IFSC has no checksum, so this only checks the format",
      "IFSC ka format sahi hai. IFSC ka koi checksum nahi hai, isliye sirf format check hua hai",
      { bank_code: chars.slice(0, 4).join(""), branch_code: chars.slice(5).join("") },
    );
  } catch {
    return invalidType<IfscParsed>();
  }
}

// ---------------------------------------------------------------------------
// UPI — verbatim from upi.rs
// ---------------------------------------------------------------------------

export function validateUpi(input: unknown): ValidationResult<UpiParsed> {
  try {
    const { value, error } = asString(input);
    if (error) return error as ValidationResult<UpiParsed>;
    if (value === null) {
      return empty<UpiParsed>("UPI ID is empty", "UPI ID khaali hai");
    }
    const trimmed = value;
    const parts = trimmed.split("@");
    if (parts.length !== 2) {
      return fail(
        "INVALID_FORMAT",
        "UPI ID must be in name@handle format (e.g. name@okaxis)",
        "UPI ID name@handle format me hona chahiye (jaise name@okaxis)",
      );
    }
    const [name, handle] = parts;
    if (charsOf(name).length < 2 || charsOf(name).length > 50) {
      return fail(
        "INVALID_FORMAT",
        "UPI name must be 2-50 characters long",
        "UPI name 2 se 50 character ka hona chahiye",
      );
    }
    if (
      !charsOf(name).every(
        (c) => isAsciiAlnum(c) || c === "." || c === "-" || c === "_",
      )
    ) {
      return fail(
        "INVALID_FORMAT",
        "UPI name may only contain letters, digits, dot, hyphen or underscore",
        "UPI name me sirf akshar, digit, dot, hyphen ya underscore ho sakte hain",
      );
    }
    if (handle === "") {
      return fail(
        "INVALID_HANDLE",
        "UPI handle is missing after @",
        "UPI handle @ ke baad khaali hai",
      );
    }
    if (!UPI_HANDLES.includes(handle.toLowerCase())) {
      return fail(
        "INVALID_HANDLE",
        "UPI handle is not a known handle",
        "UPI handle jaana-pehchana handle nahi hai",
      );
    }
    return ok("UPI ID format is valid", "UPI ID ka format sahi hai", {
      handle: handle.toLowerCase(),
    });
  } catch {
    return invalidType<UpiParsed>();
  }
}

// ---------------------------------------------------------------------------
// PIN code — verbatim from pincode.rs
// ---------------------------------------------------------------------------

export function validatePincode(input: unknown): ValidationResult<PincodeParsed> {
  try {
    const { value, error } = asString(input);
    if (error) return error as ValidationResult<PincodeParsed>;
    if (value === null) {
      return empty<PincodeParsed>("PIN code is empty", "PIN code khaali hai");
    }
    const trimmed = value;
    if (charsOf(trimmed).length !== 6) {
      return fail(
        "INVALID_LENGTH",
        "PIN code must be exactly 6 digits",
        "PIN code bilkul 6 digit ka hona chahiye",
      );
    }
    if (!charsOf(trimmed).every(isAsciiDigit)) {
      return fail(
        "INVALID_FORMAT",
        "PIN code must contain only digits",
        "PIN code me sirf digit hone chahiye",
      );
    }
    if (!/^[1-9]/.test(trimmed)) {
      return fail(
        "INVALID_FIRST_DIGIT",
        "PIN code must start with 1-9",
        "PIN code 1 se 9 ke beech wale digit se shuru hona chahiye",
      );
    }
    return ok("PIN code format is valid", "PIN code ka format sahi hai", {
      pincode: trimmed,
    });
  } catch {
    return invalidType<PincodeParsed>();
  }
}

// ---------------------------------------------------------------------------
// TAN — verbatim from tan.rs
// ---------------------------------------------------------------------------

export function validateTan(input: unknown): ValidationResult<TanParsed> {
  try {
    const { value, error } = asString(input);
    if (error) return error as ValidationResult<TanParsed>;
    if (value === null) {
      return empty<TanParsed>("TAN is empty", "TAN khaali hai");
    }
    const upper = asciiUpper(value);
    if (charsOf(upper).length !== 10) {
      return fail(
        "INVALID_LENGTH",
        "TAN must be exactly 10 characters",
        "TAN bilkul 10 character ka hona chahiye",
      );
    }
    const chars = charsOf(upper);
    const formatOk =
      chars.slice(0, 4).every(isAsciiAlpha) &&
      chars.slice(4, 9).every(isAsciiDigit) &&
      isAsciiAlpha(chars[9]);
    if (!formatOk) {
      return fail(
        "INVALID_FORMAT",
        "TAN format must be 4 letters, 5 digits, 1 letter (e.g. ABCD12345E). TAN has no checksum, so only the format is checked",
        "TAN ka format 4 akshar, 5 digit, 1 akshar hona chahiye (jaise ABCD12345E). TAN ka koi checksum nahi hai, isliye sirf format check hota hai",
      );
    }
    return ok(
      "TAN format is valid. TAN has no checksum, so this only checks the format",
      "TAN ka format sahi hai. TAN ka koi checksum nahi hai, isliye sirf format check hua hai",
      { tan: upper },
    );
  } catch {
    return invalidType<TanParsed>();
  }
}

// ---------------------------------------------------------------------------
// CIN — verbatim from cin.rs
// ---------------------------------------------------------------------------

export function validateCin(input: unknown): ValidationResult<CinParsed> {
  try {
    const { value, error } = asString(input);
    if (error) return error as ValidationResult<CinParsed>;
    if (value === null) {
      return empty<CinParsed>("CIN is empty", "CIN khaali hai");
    }
    const upper = asciiUpper(value);
    if (charsOf(upper).length !== 21) {
      return fail(
        "INVALID_LENGTH",
        "CIN must be exactly 21 characters",
        "CIN bilkul 21 character ka hona chahiye",
      );
    }
    const chars = charsOf(upper);
    const listingOk = chars[0] === "L" || chars[0] === "U";
    const formatOk =
      chars.slice(1, 6).every(isAsciiDigit) &&
      chars.slice(6, 8).every(isAsciiAlpha) &&
      chars.slice(8, 12).every(isAsciiDigit) &&
      chars.slice(12, 15).every(isAsciiAlpha) &&
      chars.slice(15, 21).every(isAsciiDigit);
    if (!listingOk) {
      return fail(
        "INVALID_FORMAT",
        "CIN must start with L (listed) or U (unlisted)",
        "CIN L (listed) ya U (unlisted) se shuru hona chahiye",
      );
    }
    if (!formatOk) {
      return fail(
        "INVALID_FORMAT",
        "CIN format must be L/U + 5 digits + 2 letters + 4 digits + 3 letters + 6 digits (e.g. L12345MH2020PLC123456). CIN has no checksum, so only the format is checked",
        "CIN ka format L/U + 5 digit + 2 akshar + 4 digit + 3 akshar + 6 digit hona chahiye (jaise L12345MH2020PLC123456). CIN ka koi checksum nahi hai, isliye sirf format check hota hai",
      );
    }
    const listing = chars[0] === "L" ? "Listed" : "Unlisted";
    return ok(
      "CIN format is valid. CIN has no checksum, so this only checks the format",
      "CIN ka format sahi hai. CIN ka koi checksum nahi hai, isliye sirf format check hua hai",
      {
        cin: upper,
        listing,
        industry_code: chars.slice(1, 6).join(""),
        state_code: chars.slice(6, 8).join(""),
        year: chars.slice(8, 12).join(""),
        company_type: chars.slice(12, 15).join(""),
        registration_number: chars.slice(15, 21).join(""),
      },
    );
  } catch {
    return invalidType<CinParsed>();
  }
}

// ---------------------------------------------------------------------------
// LLPIN — verbatim from llpin.rs
// ---------------------------------------------------------------------------

export function validateLlpin(input: unknown): ValidationResult<LlpinParsed> {
  try {
    const { value, error } = asString(input);
    if (error) return error as ValidationResult<LlpinParsed>;
    if (value === null) {
      return empty<LlpinParsed>("LLPIN is empty", "LLPIN khaali hai");
    }
    const upper = asciiUpper(value);
    if (charsOf(upper).length !== 7) {
      return fail(
        "INVALID_LENGTH",
        "LLPIN must be exactly 7 characters",
        "LLPIN bilkul 7 character ka hona chahiye",
      );
    }
    const chars = charsOf(upper);
    const formatOk =
      chars.slice(0, 3).every(isAsciiAlpha) && chars.slice(3).every(isAsciiDigit);
    if (!formatOk) {
      return fail(
        "INVALID_FORMAT",
        "LLPIN format must be 3 letters followed by 4 digits (e.g. AAA1234). LLPIN has no checksum, so only the format is checked",
        "LLPIN ka format 3 akshar phir 4 digit hona chahiye (jaise AAA1234). LLPIN ka koi checksum nahi hai, isliye sirf format check hota hai",
      );
    }
    return ok(
      "LLPIN format is valid. LLPIN has no checksum, so this only checks the format",
      "LLPIN ka format sahi hai. LLPIN ka koi checksum nahi hai, isliye sirf format check hua hai",
      { llpin: upper },
    );
  } catch {
    return invalidType<LlpinParsed>();
  }
}

// ---------------------------------------------------------------------------
// Voter ID / EPIC — verbatim from voter.rs
// ---------------------------------------------------------------------------

export function validateVoterId(input: unknown): ValidationResult<VoterParsed> {
  try {
    const { value, error } = asString(input);
    if (error) return error as ValidationResult<VoterParsed>;
    if (value === null) {
      return empty<VoterParsed>("Voter ID is empty", "Voter ID khaali hai");
    }
    const upper = asciiUpper(value);
    if (charsOf(upper).length !== 10) {
      return fail(
        "INVALID_LENGTH",
        "Voter ID must be exactly 10 characters",
        "Voter ID bilkul 10 character ka hona chahiye",
      );
    }
    const chars = charsOf(upper);
    const formatOk =
      chars.slice(0, 3).every(isAsciiAlpha) && chars.slice(3).every(isAsciiDigit);
    if (!formatOk) {
      return fail(
        "INVALID_FORMAT",
        "Voter ID format must be 3 letters followed by 7 digits (e.g. ABC1234567). Voter ID has no checksum, so only the format is checked",
        "Voter ID ka format 3 akshar phir 7 digit hona chahiye (jaise ABC1234567). Voter ID ka koi checksum nahi hai, isliye sirf format check hua hai",
      );
    }
    return ok(
      "Voter ID format is valid. Voter ID has no checksum, so this only checks the format",
      "Voter ID ka format sahi hai. Voter ID ka koi checksum nahi hai, isliye sirf format check hua hai",
      { epic: upper },
    );
  } catch {
    return invalidType<VoterParsed>();
  }
}

/** Alias for `validateVoterId`: EPIC is the name printed on the card. */
export function validateEpic(input: unknown): ValidationResult<VoterParsed> {
  return validateVoterId(input);
}

// ---------------------------------------------------------------------------
// Vehicle registration — verbatim from vehicle.rs
// ---------------------------------------------------------------------------

export function validateVehicle(input: unknown): ValidationResult<VehicleParsed> {
  try {
    const { value, error } = asString(input);
    if (error) return error as ValidationResult<VehicleParsed>;
    // Unlike asString's plain trim, vehicle strips spaces/hyphens
    // anywhere in the string (vehicle.rs filters them before checking).
    const cleaned = [...asciiUpper(value ?? "")].filter((c) => !/\s/.test(c) && c !== "-").join("");
    if (cleaned === "") {
      return empty<VehicleParsed>(
        "Vehicle registration number is empty",
        "Vehicle registration number khaali hai",
      );
    }
    const chars = charsOf(cleaned);
    if (chars.length < 8 || chars.length > 10) {
      return fail(
        "INVALID_LENGTH",
        "Vehicle registration number must be 8-10 characters (e.g. DL01AB1234)",
        "Vehicle registration number 8 se 10 character ka hona chahiye (jaise DL01AB1234)",
      );
    }
    // Bharat (BH) series: YYBH####XX — starts with 2 digits (the year),
    // so it must be checked before the state format (2 leading letters).
    if (chars.slice(0, 2).every(isAsciiDigit)) {
      return validateBharat(cleaned, chars);
    }
    if (!chars.slice(0, 2).every(isAsciiAlpha)) {
      return fail(
        "INVALID_FORMAT",
        "Vehicle registration number must start with 2 state-code letters (e.g. DL01AB1234)",
        "Vehicle registration number 2 state-code akshar se shuru hona chahiye (jaise DL01AB1234)",
      );
    }
    // Parse: district digits (1-2), series letters (1-2), number digits (1-4).
    let i = 2;
    const districtStart = i;
    while (i < chars.length && isAsciiDigit(chars[i]) && i - districtStart < 2) i++;
    const district = chars.slice(districtStart, i).join("");
    const seriesStart = i;
    while (i < chars.length && isAsciiAlpha(chars[i]) && i - seriesStart < 2) i++;
    const series = chars.slice(seriesStart, i).join("");
    const numberStart = i;
    while (i < chars.length && isAsciiDigit(chars[i]) && i - numberStart < 4) i++;
    const number = chars.slice(numberStart, i).join("");
    const formatOk = district !== "" && series !== "" && number !== "" && i === chars.length;
    if (!formatOk) {
      return fail(
        "INVALID_FORMAT",
        "Vehicle registration format must be state letters + district digits + series letters + number digits (e.g. DL01AB1234). Registration numbers have no checksum, so only the format is checked",
        "Vehicle registration ka format state akshar + district digit + series akshar + number digit hona chahiye (jaise DL01AB1234). Registration number ka koi checksum nahi hai, isliye sirf format check hota hai",
      );
    }
    const stateCode = chars.slice(0, 2).join("");
    return ok(
      "Vehicle registration format is valid. Registration numbers have no checksum, so this only checks the format",
      "Vehicle registration ka format sahi hai. Registration number ka koi checksum nahi hai, isliye sirf format check hua hai",
      { registration: cleaned, series_type: "state", state_code: stateCode, district, series, number },
    );
  } catch {
    return invalidType<VehicleParsed>();
  }
}

/** Bharat (BH) series: `YYBH####XX` — called only when the cleaned input starts with digits. */
function validateBharat(cleaned: string, chars: string[]): ValidationResult<VehicleParsed> {
  const notBharat = (en: string, hi: string): ValidationResult<VehicleParsed> =>
    fail("INVALID_FORMAT", en, hi);
  const shapeOk =
    chars.length === 10 &&
    chars[2] === "B" &&
    chars[3] === "H" &&
    chars.slice(4, 8).every(isAsciiDigit) &&
    chars.slice(8, 10).every(isAsciiAlpha);
  if (!shapeOk) {
    return notBharat(
      "Vehicle registration number must start with 2 state-code letters (e.g. DL01AB1234), or be a Bharat series number (e.g. 22BH1234AA)",
      "Vehicle registration number 2 state-code akshar se shuru hona chahiye (jaise DL01AB1234), ya Bharat series number hona chahiye (jaise 22BH1234AA)",
    );
  }
  const year = chars.slice(0, 2).join("");
  if (Number(year) < 21) {
    return notBharat(
      "Bharat (BH) series numbers start from 2021 — the year must be 21 or later (e.g. 22BH1234AA)",
      "Bharat (BH) series number 2021 se shuru hue hain — saal 21 ya usse baad ka hona chahiye (jaise 22BH1234AA)",
    );
  }
  const number = chars.slice(4, 8).join("");
  if (number === "0000") {
    return notBharat(
      "Bharat (BH) series number must be 0001-9999 (e.g. 22BH1234AA)",
      "Bharat (BH) series number 0001 se 9999 ke beech hona chahiye (jaise 22BH1234AA)",
    );
  }
  const suffix = chars.slice(8, 10).join("");
  if (suffix.includes("I") || suffix.includes("O")) {
    return notBharat(
      "Bharat (BH) series suffix letters cannot be I or O (e.g. 22BH1234AA)",
      "Bharat (BH) series ke aakhiri akshar I ya O nahi ho sakte (jaise 22BH1234AA)",
    );
  }
  return ok(
    "Bharat (BH) series vehicle registration format is valid. Registration numbers have no checksum, so this only checks the format",
    "Bharat (BH) series vehicle registration ka format sahi hai. Registration number ka koi checksum nahi hai, isliye sirf format check hua hai",
    { registration: cleaned, series_type: "bharat", year, series: "BH", number, suffix },
  );
}

/** Alias for `validateVehicle`. */
export function validateVehicleRegistration(input: unknown): ValidationResult<VehicleParsed> {
  return validateVehicle(input);
}

// ---------------------------------------------------------------------------
// Mock test-data generators — verbatim from generate.rs
//
// TEST DATA ONLY — syntactically valid, not real issued IDs. Every value
// produced here passes this library's own validators, but it was never
// issued by any authority (UIDAI, Income Tax, GSTN, …) and must never be
// presented as a real person's ID. Use them only in tests, demos and
// form previews. The generator is intentionally not seeded and not
// reproducible: each call may return a different value.
// ---------------------------------------------------------------------------

function randomLetter(): string {
  return String.fromCharCode(65 + Math.floor(Math.random() * 26));
}

function randomDigit(): string {
  return String(Math.floor(Math.random() * 10));
}

function randomDigitRange(low: number, high: number): string {
  return String(low + Math.floor(Math.random() * (high - low + 1)));
}

/** A letter excluding `I` and `O` (they look like digits on a plate). */
function randomLetterNoIO(): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  return letters[Math.floor(Math.random() * letters.length)];
}

const VEHICLE_STATE_CODES = [
  "DL", "MH", "UP", "KA", "TN", "GJ", "RJ", "WB", "KL", "PB", "HR", "AP", "TS", "MP", "BR",
];

/** Generates a syntactically valid PAN for the given entity character
 *  (`P`, `C`, `H`, `F`, `A`, `T`, `B`, `L`, `J` or `G`).
 *  An unknown entity character falls back to `P` (Individual).
 *  TEST DATA ONLY — not a real issued PAN. */
export function generatePan(entity?: unknown): string {
  let code = "P";
  if (typeof entity === "string" && entity.length > 0) {
    const first = asciiUpper(entity[0]);
    if (PAN_ENTITY_TYPES[first] !== undefined) code = first;
  }
  return (
    randomLetter() +
    randomLetter() +
    randomLetter() +
    code +
    randomLetter() +
    randomDigit() +
    randomDigit() +
    randomDigit() +
    randomDigit() +
    randomLetter()
  );
}

/** Generates a syntactically valid 12-digit Aadhaar number (first digit
 *  2-9, correct Verhoeff check digit).
 *  TEST DATA ONLY — not a real issued Aadhaar number. */
export function generateAadhaar(): string {
  let base = randomDigitRange(2, 9);
  for (let i = 0; i < 10; i++) base += randomDigit();
  return base + verhoeffVerifyDigit(base);
}

/** Generates a syntactically valid GSTIN for the given 2-digit state code
 *  (e.g. `"18"` for Assam). An unknown state code falls back to `"18"`.
 *  TEST DATA ONLY — not a real issued GSTIN. */
export function generateGstin(stateCode?: unknown): string {
  let code = "18";
  if (typeof stateCode === "string" && GSTIN_STATE_NAMES[stateCode] !== undefined) {
    code = stateCode;
  }
  const pan = generatePan("P");
  const entityChar = Math.random() < 0.5 ? "1" : "2";
  const first14 = `${code}${pan}${entityChar}Z`;
  const check = gstinCheckDigit(first14) ?? "0";
  return first14 + check;
}

/** Generates a syntactically valid Indian mobile number (10 digits,
 *  first digit 6-9). TEST DATA ONLY — not a real person's number. */
export function generateMobile(): string {
  let mobile = randomDigitRange(6, 9);
  for (let i = 0; i < 9; i++) mobile += randomDigit();
  return mobile;
}

/** Generates a syntactically valid state-format vehicle registration
 *  number (`DL01AB1234`: state code + district + series + number).
 *  TEST DATA ONLY — not a real issued registration number. */
export function generateVehicle(): string {
  const state = VEHICLE_STATE_CODES[Math.floor(Math.random() * VEHICLE_STATE_CODES.length)];
  const district = String(1 + Math.floor(Math.random() * 99)).padStart(2, "0");
  const seriesLength = Math.random() < 0.5 ? 1 : 2;
  let series = "";
  for (let i = 0; i < seriesLength; i++) series += randomLetterNoIO();
  const number = String(1 + Math.floor(Math.random() * 9999)).padStart(4, "0");
  return `${state}${district}${series}${number}`;
}

/** Generates a syntactically valid Bharat (BH) series vehicle number
 *  (`22BH1234AA`: year 21-26, `BH`, number 0001-9999, suffix without
 *  `I`/`O`). TEST DATA ONLY — not a real issued registration number. */
export function generateVehicleBharat(): string {
  const year = String(21 + Math.floor(Math.random() * 6)).padStart(2, "0");
  const number = String(1 + Math.floor(Math.random() * 9999)).padStart(4, "0");
  const suffix = randomLetterNoIO() + randomLetterNoIO();
  return `${year}BH${number}${suffix}`;
}

// ---------------------------------------------------------------------------
// detect / validateMany — detect verbatim from lib.rs
// ---------------------------------------------------------------------------

type ValidatorFn = (input: unknown) => ValidationResult;

const VALIDATORS: Record<string, ValidatorFn> = {
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

function isPanPattern(s: string): boolean {
  const chars = charsOf(s);
  return (
    chars.length === 10 &&
    chars.slice(0, 5).every(isAsciiAlpha) &&
    chars.slice(5, 9).every(isAsciiDigit) &&
    isAsciiAlpha(chars[9])
  );
}

function isIfscPattern(s: string): boolean {
  const chars = charsOf(s);
  return (
    chars.length === 11 &&
    chars.slice(0, 4).every(isAsciiAlpha) &&
    chars[4] === "0" &&
    chars.slice(5).every(isAsciiAlnum)
  );
}

function isTanPattern(s: string): boolean {
  const chars = charsOf(s);
  return (
    chars.length === 10 &&
    chars.slice(0, 4).every(isAsciiAlpha) &&
    chars.slice(4, 9).every(isAsciiDigit) &&
    isAsciiAlpha(chars[9])
  );
}

function isVoterPattern(s: string): boolean {
  const chars = charsOf(s);
  return (
    chars.length === 10 &&
    chars.slice(0, 3).every(isAsciiAlpha) &&
    chars.slice(3).every(isAsciiDigit)
  );
}

function isCinPattern(s: string): boolean {
  const chars = charsOf(s);
  return (
    chars.length === 21 &&
    (chars[0] === "L" || chars[0] === "U") &&
    chars.slice(1, 6).every(isAsciiDigit) &&
    chars.slice(6, 8).every(isAsciiAlpha) &&
    chars.slice(8, 12).every(isAsciiDigit) &&
    chars.slice(12, 15).every(isAsciiAlpha) &&
    chars.slice(15, 21).every(isAsciiDigit)
  );
}

function isLlpinPattern(s: string): boolean {
  const chars = charsOf(s);
  return (
    chars.length === 7 &&
    chars.slice(0, 3).every(isAsciiAlpha) &&
    chars.slice(3).every(isAsciiDigit)
  );
}

function isVehiclePattern(s: string): boolean {
  // Cheap structural check used only by detect(); the real validation
  // (district/series/number parsing) lives in validateVehicle.
  const cleaned = [...s].filter((c) => !/\s/.test(c) && c !== "-").join("");
  return validateVehicle(cleaned).valid;
}

/** The Rust `detect` string for a trimmed input (lib.rs order). */
export function detectType(input: string): string {
  const trimmed = input.trim();
  if (trimmed === "") return "unknown";
  if (trimmed.includes("@")) return "upi";
  const upper = asciiUpper(trimmed);
  const len = charsOf(trimmed).length;
  const allDigits = charsOf(trimmed).every(isAsciiDigit);
  // A Verhoeff-valid 12-digit number is an Aadhaar even if it also looks
  // like a 91-prefixed mobile; otherwise a normalisable mobile wins over
  // the length-15 GSTIN branch (e.g. "+91 98765 43210" is 15 chars long).
  if (len === 12 && allDigits && verhoeffValid(trimmed)) return "aadhaar";
  // Spaced / hyphenated Aadhaar, e.g. "2345 6789 0124".
  const digitsOnly = charsOf(trimmed).filter(isAsciiDigit).join("");
  if (charsOf(digitsOnly).length === 12 && verhoeffValid(digitsOnly)) return "aadhaar";
  if (normalizeMobile(trimmed) !== null) return "mobile";
  // CIN is 21 chars and unambiguous by length.
  if (len === 21 && isCinPattern(upper)) return "cin";
  switch (len) {
    case 15:
      return "gstin";
    case 12:
      if (allDigits) return "aadhaar";
      break;
    case 11:
      if (isIfscPattern(upper)) return "ifsc";
      break;
    case 10:
      if (isPanPattern(upper)) return "pan";
      if (isTanPattern(upper)) return "tan";
      if (isVoterPattern(upper)) return "voter";
      if (allDigits) return "mobile";
      break;
    case 7:
      if (isLlpinPattern(upper)) return "llpin";
      break;
    case 6:
      if (allDigits) return "pincode";
      break;
    default:
      break;
  }
  // Formatted mobiles such as "+91 98765 43210" are longer than 10 chars.
  if (formatMobileString(trimmed, DEFAULT_OPTIONS) !== null) return "mobile";
  if (isPanPattern(upper)) return "pan";
  if (isTanPattern(upper)) return "tan";
  if (isVoterPattern(upper)) return "voter";
  if (isIfscPattern(upper)) return "ifsc";
  if (isLlpinPattern(upper)) return "llpin";
  if (isVehiclePattern(upper)) return "vehicle";
  return "unknown";
}

export function detect(input: unknown): ValidationResult<DetectParsed> {
  try {
    if (typeof input !== "string") {
      return fail<DetectParsed>("INVALID_TYPE", "Input must be a string.", "Input string hona chahiye.", {
        type: null,
        value: null,
        result: null,
      });
    }
    const trimmed = input.trim();
    const type = detectType(input);
    if (type === "unknown") {
      return fail<DetectParsed>(
        "UNKNOWN_TYPE",
        "Could not detect the type of this input",
        "Is input ka type pehchana nahi ja saka",
        { type: "unknown", value: trimmed, result: null },
      );
    }
    const result = VALIDATORS[type](input);
    return {
      valid: result.valid,
      code: result.code,
      reason_en: result.reason_en,
      reason_hi: result.reason_hi,
      parsed: { type, value: trimmed, result },
    };
  } catch {
    return fail<DetectParsed>("INVALID_TYPE", "Input must be a string.", "Input string hona chahiye.", {
      type: null,
      value: null,
      result: null,
    });
  }
}

export function validateMany(inputs: unknown): ValidationResult<ValidateManyParsed> {
  try {
    if (!Array.isArray(inputs)) {
      return fail<ValidateManyParsed>(
        "INVALID_TYPE",
        "Input must be a string.",
        "Input string hona chahiye.",
        { results: [], total: 0, validCount: 0, invalidCount: 0 },
      );
    }
    if (inputs.length === 0) {
      return fail<ValidateManyParsed>("EMPTY", "Input is empty.", "Input khaali hai.", {
        results: [],
        total: 0,
        validCount: 0,
        invalidCount: 0,
      });
    }
    // Mirrors Rust `validate_many`: each input is detected, then validated
    // with the matching validator. An undetectable input gets UNKNOWN_TYPE
    // with the Rust reason strings.
    const results: ValidateManyItemResult[] = inputs.map((item) => {
      let result: ValidationResult;
      let type: string | null;
      if (
        item !== null &&
        typeof item === "object" &&
        "value" in (item as Record<string, unknown>) &&
        typeof (item as Record<string, unknown>).type === "string" &&
        ((item as Record<string, unknown>).type as string) in VALIDATORS
      ) {
        const typed = item as { value: unknown; type: string };
        type = typed.type;
        result = VALIDATORS[typed.type](typed.value);
      } else if (typeof item === "string") {
        const detected = detectType(item);
        type = detected === "unknown" ? null : detected;
        result =
          detected === "unknown"
            ? fail(
                "UNKNOWN_TYPE",
                "Could not detect the type of this input",
                "Is input ka type pehchana nahi ja saka",
              )
            : VALIDATORS[detected](item);
      } else {
        type = null;
        result = invalidType();
      }
      return {
        input: item,
        type,
        valid: result.valid,
        code: result.code,
        reason_en: result.reason_en,
        reason_hi: result.reason_hi,
        parsed: result.parsed,
      };
    });
    const validCount = results.filter((r) => r.valid).length;
    const invalidCount = results.length - validCount;
    const parsed: ValidateManyParsed = { results, total: results.length, validCount, invalidCount };
    if (invalidCount === 0) {
      return ok("All inputs are valid.", "Saare input sahi hain.", parsed);
    }
    // Wrapper-only code: the Rust core returns a bare Vec for batches.
    return fail<ValidateManyParsed>(
      "SOME_INVALID",
      "Some inputs are invalid.",
      "Kuch input galat hain.",
      parsed,
    );
  } catch {
    return fail<ValidateManyParsed>(
      "INVALID_TYPE",
      "Input must be a string.",
      "Input string hona chahiye.",
      { results: [], total: 0, validCount: 0, invalidCount: 0 },
    );
  }
}

export default {
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
  generateVehicle,
  generateVehicleBharat,
  defaultOptions,
  lenientOptions,
  noSpacesHyphensOptions,
  detect,
  detectType,
  validateMany,
  UPI_HANDLES,
  PAN_ENTITY_TYPES,
  GSTIN_STATE_NAMES,
};
