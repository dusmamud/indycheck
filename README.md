# indycheck

Offline Indian ID validator — one Rust core, every language.

[![CI](https://github.com/dusmamud/indycheck/actions/workflows/ci.yml/badge.svg)](https://github.com/dusmamud/indycheck/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Rust](https://img.shields.io/badge/rust-stable-orange.svg)](https://www.rust-lang.org/)

**indycheck** validates, formats, masks and decodes Indian identifiers — **offline, zero network calls, zero runtime dependencies in the core**. One Rust core ships to Rust, JavaScript/TypeScript (WASM), Python (PyO3), and later Kotlin/Swift (UniFFI) and Go (C API), so every language returns the *same* answer for the *same* input.

## What it validates

| ID | Check | Checksum? |
|---|---|---|
| Mobile | 10 digits, starts 6–9, `+91`/`91`/`0` normalisation | — |
| PAN | 5 letters + 4 digits + 1 letter, 4th char = entity type | **No public checksum exists** — format only |
| Aadhaar | 12 digits, first digit 2–9 | **Verhoeff** (UIDAI algorithm) |
| GSTIN | 15 chars: state code + PAN + `Z` + check digit | **Mod-36 Luhn** |
| IFSC | 4 letters + `0` + 6 alphanumeric | **No checksum exists** — format only |
| UPI | `name@handle` against a maintained handle list | — |
| PIN code | 6 digits, first 1–9 | — |
| TAN | 4 letters + 5 digits + 1 letter | **No checksum** — format only |
| CIN | 21 chars, company identity number | **No checksum** — format only |
| LLPIN | 3 letters + 4 digits | **No checksum** — format only |
| Voter ID (EPIC) | 3 letters + 7 digits | **No checksum** — format only |
| Vehicle registration | e.g. `DL01AB1234`, Bharat series `22BH1234AA` | **No checksum** — format only |

Every validator returns a `ValidationResult` — never throws on bad input:

```json
{ "valid": true, "code": "VALID", "reason_en": "PAN format is valid. PAN has no public checksum, so this only checks the format", "reason_hi": "PAN ka format sahi hai. PAN ka koi public checksum nahi hai, isliye sirf format check hua hai", "parsed": { "entity": "Individual", "entity_code": "P" } }
```

## Honest limits — read this first

**indycheck is format + checksum validation only. It is NOT KYC verification.**

- It does **not** connect to UIDAI, NSDL, GSTN, or any government API.
- It cannot confirm a document is genuine, active, or belongs to anyone.
- A `valid: true` result means *"this string is well-formed"* — nothing more.
- PAN and IFSC have no publicly documented checksum, so only structure is checked.
- Never use it to claim an identity is verified. See [SECURITY.md](SECURITY.md).

## Install

```bash
# Rust
cargo add indycheck

# JavaScript / TypeScript (WASM)
npm install indycheck

# Python
pip install indycheck
```

## Quick start

```rust
use indycheck::{validate_pan, validate_gstin, validate_aadhaar};

let pan = validate_pan("ABCDE1234F");
assert!(pan.valid); // entity: Unknown (4th char D is not a published entity code)

let gstin = validate_gstin("18ABCDE1234F1ZZ"); // state 18 = Assam
assert!(gstin.valid);
assert_eq!(gstin.parsed["state"], "Assam");

let aadhaar = validate_aadhaar("234567890124");
assert!(aadhaar.valid);
```

```js
import { validatePan, validateGstin, maskAadhaar } from "indycheck";

validatePan("ABCDE1234F"); // { valid: true, code: "VALID", ... }
maskAadhaar("234567890124"); // "XXXX XXXX 0124"
```

```python
from indycheck import validate_pan, validate_gstin

validate_pan("ABCDE1234F")["valid"]  # True
validate_gstin("18ABCDE1234F1ZZ")["parsed"]["state"]  # "Assam"
```

## More control

```rust
use indycheck::{Options, validate_pan_with_options};

let opts = Options::lenient(); // skip checksum checks, allow spaces/hyphens
let r = validate_pan_with_options("abcde 1234 f", &opts);
```

- **Options:** `strict` / `lenient`, `allow_spaces_hyphens`, `normalise_plus91`, `uppercase` — see [docs](https://indycheck.dev/docs/options/).
- **Format & mask:** `format_pan`, `format_gstin`, `format_mobile`, `mask_pan` (`ABCDE****F`), `mask_mobile` (`******3210`), `mask_aadhaar` (`XXXX XXXX 0124`).
- **Auto-detect:** `detect("18ABCDE1234F1ZZ")` → `"gstin"`.
- **Bulk:** `validate_many(&[...])` — one call for thousands of values (fast across the WASM/FFI boundary).
- **Test data:** `generate_pan()`, `generate_aadhaar()`, `generate_gstin("18")`, `generate_mobile()` — **syntactically valid test data only, never real IDs**.
- **CLI:** `cargo run -p indycheck -- validate pan ABCDE1234F` — see [CLI docs](website/src/content/docs/cli.mdx).

## Framework integrations

- **TypeScript:** Zod schemas in `packages/js/src/zod.ts` (`panSchema`, `aadhaarSchema`, `gstinSchema`, …), React Hook Form / Yup compatible.
- **Python:** Pydantic v2 types in `packages/python/src/indycheck/pydantic.py` (optional, lazy import).

## Docs & playground

- Docs: <https://indycheck.dev/docs/>
- Live playground (in-browser, real WASM, no server): <https://indycheck.dev/playground>

## Project structure

```
indycheck/
├── crates/indycheck/        # pure Rust core — the only place validation logic lives
├── crates/indycheck-wasm/   # wasm-bindgen → npm
├── crates/indycheck-py/     # PyO3 + maturin → PyPI
├── crates/indycheck-napi/   # napi-rs → npm (Phase 2 packaging)
├── crates/indycheck-uniffi/ # UniFFI → Kotlin/Swift (Phase 3, scaffold)
├── crates/indycheck-ffi/    # C API → Go (last, scaffold)
├── packages/js/             # TS wrapper + Zod
├── packages/python/         # thin Python wrapper + Pydantic
├── shared/test-vectors.json # 245 cases — the contract every language must pass
├── shared/spec.md           # API + error-code spec
└── website/                 # Astro 5 + Starlight docs + landing + playground
```

The contract: `shared/test-vectors.json` is run by Rust, Python and JS. If a binding diverges, the tests fail.

## Development

```bash
cargo fmt --all
cargo clippy --workspace --all-targets   # 0 warnings
cargo test --workspace                   # 54 tests
wasm-pack build --target web --manifest-path crates/indycheck-wasm/Cargo.toml
python3 -m maturin build --manifest-path crates/indycheck-py/pyproject.toml
cd website && npm install && npm run build
```

See [CONTRIBUTING.md](CONTRIBUTING.md) and [shared/spec.md](shared/spec.md).

## Changelog

See [CHANGELOG.md](CHANGELOG.md). Releases use [release-plz](https://release-plz.ieni.dev/) for crates.io; npm/PyPI follow the same version in lockstep (semver).

## License

MIT — see [LICENSE](LICENSE). Author: dusmamud.
