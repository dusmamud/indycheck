# indycheck — API Specification (v0.1.0)

Offline Indian ID validator. Pure Rust core, no network, no database.
Every function returns `ValidationResult` and never panics on bad input.

## Result type

```rust
pub struct ValidationResult {
    pub valid: bool,
    pub code: String,       // stable error code, see below
    pub reason_en: String,  // human-readable reason (English)
    pub reason_hi: String,  // human-readable reason (Devanagari Hindi)
    pub parsed: Option<serde_json::Value>, // extracted fields on success
}
```

JSON serialisation omits `parsed` when it is `None`.

## Functions (`indycheck` crate, `src/lib.rs`)

### Core validators (v0.1)

| Function | Input | `parsed` on success |
|---|---|---|
| `validate_mobile(input)` | 10 digits, first digit 6–9; accepts `+91` / `91` / `0` prefix, spaces and hyphens | `{"normalized": "9876543210"}` |
| `format_mobile(input) -> Option<String>` | as above | normalised 10-digit string, or `None` |
| `validate_pan(input)` | `^[A-Z]{5}[0-9]{4}[A-Z]$`, upper-cased first; 4th char is the entity code | `{"entity": "Individual", "entity_code": "P"}` |
| `validate_aadhaar(input)` | 12 digits, first digit 2–9, Verhoeff checksum (spaces/hyphens stripped) | `{"masked": "XXXX XXXX 0124"}` |
| `mask_aadhaar(input) -> String` | 12-digit Aadhaar | `"XXXX XXXX 1234"`; **empty string on invalid format** (documented — a non-empty result is not proof of validity) |
| `validate_gstin(input)` | 15 chars: 2-digit state code + PAN + entity char + `Z` + Mod-36 Luhn check digit | `{"state": "Assam", "state_code": "18", "pan": "ABCDE1234F"}` |
| `validate_ifsc(input)` | `^[A-Z]{4}0[A-Z0-9]{6}$` | `{"bank_code": "SBIN", "branch_code": "000123"}` |
| `validate_upi(input)` | `name@handle`, handle from the maintained list in `src/data.rs` (30+ handles) | `{"handle": "okaxis"}` |
| `validate_pincode(input)` | 6 digits, first digit 1–9 | `{"pincode": "781001"}` |
| `validate_tan(input)` | 4 letters + 5 digits + 1 letter (format only, no checksum) | `{"tan": "AAAA12345B"}` |
| `validate_cin(input)` | 21 chars: `L`/`U` + 5 digits + 2 letters + 4 digits + 3 letters + 6 digits (format only, no checksum) | `{"cin": "…", "listing": "Listed", "industry_code": "12345", "state_code": "MH", "year": "2020", "company_type": "PLC", "registration_number": "123456"}` |
| `validate_llpin(input)` | 3 letters + 4 digits (format only, no checksum) | `{"llpin": "AAA1234"}` |
| `validate_voter_id(input)` / `validate_epic(input)` | 3 letters + 7 digits (format only, no checksum) | `{"epic": "ABC1234567"}` |
| `validate_vehicle(input)` / `validate_vehicle_registration(input)` | e.g. `DL01AB1234` / `DL01A1234` (format only, no checksum) | `{"registration": "DL01AB1234", "state_code": "DL", "district": "01", "series": "AB", "number": "1234"}` |
| `detect(input) -> String` | any string | `"pan" \| "aadhaar" \| "gstin" \| "ifsc" \| "upi" \| "mobile" \| "pincode" \| "tan" \| "cin" \| "llpin" \| "voter" \| "vehicle" \| "unknown"` — GSTIN before PAN, Aadhaar before mobile (by length), UPI by `@` |
| `validate_many(inputs: &[String]) -> Vec<ValidationResult>` | batch; detects then validates each | per-item results |

PAN entity codes (4th character): `P` Individual, `C` Company, `H` HUF,
`F` Firm, `A` AOP, `T` Trust, `B` BODY, `L` Local Authority,
`J` Artificial Juridical Person, `G` Government. An unlisted 4th character
is reported as entity `"Unknown"` and the PAN is still format-valid — the
canonical format example `ABCDE1234F` itself has 4th character `D`, which
is not in the published entity list. `INVALID_ENTITY` is therefore a
reserved stable code, not emitted in v0.1.

GSTIN state codes: 01–38, full table in `crates/indycheck/src/data.rs`
(01 Jammu and Kashmir … 18 Assam … 27 Maharashtra … 38 Ladakh).

### Options (`src/options.rs`)

```rust
pub struct Options {
    pub strict: bool,               // default true
    pub allow_spaces_hyphens: bool, // default true
    pub normalise_plus91: bool,     // default true
    pub uppercase: bool,            // default true
}
```

- `Options::default()` / `Options::strict()` — the behaviour of the simple
  `validate_*` functions (every rule enforced).
- `Options::lenient()` — format only: first-digit and checksum checks are
  skipped (Aadhaar Verhoeff, GSTIN Mod-36, mobile first digit). State-code
  and structural checks still apply.
- `Options::no_spaces_hyphens()` — spaces/hyphens become `INVALID_FORMAT`.
- `normalise_plus91: false` — a mobile must be a bare 10-digit number.
- `uppercase: false` — lower-case letters fail the format check instead of
  being upper-cased first.

`validate_*_with_options(input, options)` exists for mobile, PAN, Aadhaar
and GSTIN. The simple `validate_*` functions are `*_with_options(input,
Options::default())`.

### format_* / mask_*

| Function | Behaviour |
|---|---|
| `format_mobile(input) -> Option<String>` | normalised 10-digit number, or `None` |
| `format_pan(input) -> Option<String>` | upper-cased, spaces/hyphens stripped, `Some` only when the PAN pattern matches |
| `format_gstin(input) -> Option<String>` | upper-cased, spaces/hyphens stripped, `Some` only when the GSTIN structure (state code, PAN part, `Z`) is in place — the check digit is NOT verified here |
| `mask_aadhaar(input) -> String` | `"XXXX XXXX 1234"`, or `""` on invalid format |
| `mask_pan(input) -> String` | `"ABCDE****F"`, or `""` on invalid format |
| `mask_mobile(input) -> String` | `"******3210"`, or `""` on invalid format |

A non-empty mask result is **not** proof of validity — use the matching
`validate_*` for that.

### Mock generators (`src/generate.rs`) — TEST DATA ONLY

```rust
generate_pan(entity: char) -> String       // e.g. generate_pan('P')
generate_aadhaar() -> String               // 12 digits, valid Verhoeff digit
generate_gstin(state_code: &str) -> String // e.g. generate_gstin("18"); unknown code falls back to "18"
generate_mobile() -> String                // 10 digits, first digit 6-9
```

**Warning: generated values are syntactically valid, not real issued IDs.**
They pass this library's own validators but were never issued by UIDAI,
Income Tax, GSTN or anyone else. Use them only in tests, demos and form
previews — never present them as a real person's ID. Generators are
intentionally unseeded: each call may return a different value.

### CLI (`crates/indycheck/src/bin/indycheck.rs`)

```text
indycheck validate <type> <value>   # prints a ValidationResult as JSON
indycheck detect <value>            # prints {"input": ..., "type": ...}
indycheck generate <type> [arg]     # prints {"type": ..., "value": ...}
```

Types for validate: `pan, aadhaar, gstin, ifsc, upi, mobile, pincode, tan,
cin, llpin, voter, vehicle`. Types for generate: `pan [entity-char],
aadhaar, gstin [state-code], mobile`. Exit codes: 0 = valid/success,
1 = invalid input, 2 = usage error. No extra dependencies — plain
`std::env::args` parsing. Run with
`cargo run -p indycheck -- validate pan ABCDE1234F`.

## Error codes (stable strings)

| Code | Meaning |
|---|---|
| `VALID` | input is valid |
| `EMPTY` | input is empty / only whitespace |
| `INVALID_LENGTH` | wrong length for the type |
| `INVALID_FORMAT` | wrong shape / characters for the type |
| `INVALID_CHECKSUM` | checksum failed (Aadhaar Verhoeff, GSTIN Mod-36) |
| `INVALID_FIRST_DIGIT` | first digit outside the allowed range |
| `INVALID_STATE_CODE` | GSTIN state code not in 01–38 |
| `INVALID_ENTITY` | reserved in v0.1 — an unlisted PAN entity code is reported as `"Unknown"` instead (see above) |
| `INVALID_HANDLE` | UPI handle not in the maintained list, or missing |
| `UNKNOWN_TYPE` | `detect`/`validate_many` could not identify the input |

## Honest limits — read this before using the library

- **Format + checksum only.** A `valid: true` result means the string is
  well-formed (and, where one exists, its checksum passes). It does **not**
  mean the ID exists or belongs to anyone.
- **No live verification.** This library never contacts UIDAI, NSDL / Income
  Tax, GSTN or RBI. Real verification needs those authorities.
- **PAN has no public checksum.** Only format and entity code are checked.
- **IFSC has no checksum.** Only format is checked; a format-valid IFSC
  does not prove the branch exists (that needs the RBI list).
- **PIN code has no checksum.** Only format is checked.
- **TAN, CIN, LLPIN, Voter ID and vehicle registration numbers have no
  public checksum.** Only format is checked. The vehicle state-code letters
  are not checked against a list of states.
- **UPI handles** are a maintained list of common handles; a listed handle
  does not prove a particular UPI ID exists, and a new handle may be missing.
- **Aadhaar examples in tests are format examples only** (e.g.
  `234567890124`, generated with a correct Verhoeff check digit). They are
  not real Aadhaar numbers. Never use real personal IDs in tests or examples.

## Checksums implemented

- **Aadhaar — Verhoeff** (`src/verhoeff.rs`): standard D / P / INV tables.
- **GSTIN — Mod-36 Luhn** (`src/luhn36.rs`): alphabet `0-9A-Z`, factor
  alternates 2, 1 from the rightmost of the first 14 characters,
  `check = (36 - (sum % 36)) % 36`.

## Test vectors

`shared/test-vectors.json` — 245 cases covering valid + invalid inputs for
all 12 types, `detect`/batch behaviour, `Options` cases (each entry carries
an `"options"` object and is run through `validate_*_with_options`), and
generator cases (each entry carries a `"generator"` field; the test
generates fresh values and validates them). The integration tests in
`crates/indycheck/tests/integration.rs` run every vector.

## Phase 2 (not in v0.1)

- `crates/indycheck-napi` — Node.js bindings: Rust wrappers exist, but
  npm packaging (`package.json`, build config, published package) is not
  finished.
- `crates/indycheck-uniffi` / `crates/indycheck-ffi` — UniFFI (Kotlin/Swift)
  and C FFI bindings: scaffolds only, excluded from workspace members.
- Zod (TypeScript) and Pydantic (Python) schema integrations: use the
  published JSON result shape (`ValidationResult`) as the contract; native
  schema packages are not part of v0.1.
- `wasm-opt` is disabled for the WASM crate (`wasm-opt = false` in
  `crates/indycheck-wasm/Cargo.toml`) because the binaryen download is
  unavailable in sandboxed builds; the `.wasm` output is unoptimised.
