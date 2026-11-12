# Changelog

All notable changes to indycheck are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
All crates, npm and PyPI packages share one version in lockstep.

## [Unreleased]

### Added
- CLI: `indycheck update` prints the installed version, checks crates.io
  for a newer one (via `curl`, falling back to `cargo search`) and prints
  the `cargo install indycheck --force` command. It never installs
  anything by itself and still exits 0 when offline.
- Generators: `generate_vehicle()` (state format, e.g. `DL01AB1234`) and
  `generate_vehicle_bharat()` (Bharat format, e.g. `22BH1234AA`) in the
  Rust core, JS package, Python package and WASM bindings; `indycheck
  generate vehicle` / `generate vehicle-bharat` in the CLI.
- npm Trusted Publishing: new `.github/workflows/npm.yml` publishes to
  npm via GitHub OIDC (`npm publish --provenance`) — no token, no staged
  publish, no passkey approval. The trusted publisher must be added once
  on npmjs.com (package Settings > Trusted Publishers > GitHub Actions,
  repo `dusmamud/indycheck`, workflow `npm.yml`).

### Changed
- Python bindings: PyO3 upgraded 0.22 → 0.30; `indycheck-py` now builds
  on Rust edition 2024 like every other crate (the old edition-2021
  override is gone).
- WASM workflow: installs `wasm-opt` (Binaryen) so wasm-pack optimizes
  the playground WASM instead of silently skipping that step.
- Docs: the Test-data generators page no longer claims a `generate(type)`
  dispatcher or `generateIfsc` / `generateUpi` / `generatePincode` /
  `generateTan` / `generateCin` / `generateLlpin` / `generateEpic`
  helpers — those never existed in the package. Only the five real
  generators are documented, with examples that use the real API.

## [0.2.1] - 2026-11-12

### Fixed
- Python wheel: validators no longer throw `TypeError` on non-string input
  (`None`, `int`, ...) — they return a `ValidationResult` with code
  `INVALID_TYPE`, like the JS wrapper always did.
- Python wheel: `validate_*_with_options` and the `Options` class now exist
  (`default_options()`, `lenient_options()`, `no_spaces_hyphens_options()`),
  matching the Rust core and JS package.
- Python wheel: `generate_pan()` and `generate_gstin()` work with no
  argument (defaults: entity `P` / state code `18`).
- Python wheel: `indycheck.pydantic` now ships in the wheel, with a
  `pydantic` extra (`pip install 'indycheck[pydantic]'`). Added the missing
  `validate_epic` / `validate_vehicle_registration` aliases the module needs.
- README Rust snippet: `validate_pan_with_options(..., &opts)` did not
  compile — the options argument is by value, not a reference.

### Added
- CLI: `indycheck --version` (also `version` and `-V`) prints
  `indycheck <version>`.

## [0.2.0] - 2026-11-12

### Added
- Bharat (BH) series vehicle numbers are now accepted: `22BH1234AA`
  (`YYBH####XX` — registration year 21+, `BH`, 4-digit number 0001-9999,
  2 suffix letters excluding `I`/`O`). `validate_vehicle` returns
  `series_type: "bharat"` with `year`/`suffix` in `parsed`; state-format
  numbers now also return `series_type: "state"`. Mirrored in the JS and
  Python wrappers; 9 new test vectors (254 total).

## [0.1.2] - 2026-11-12

### Fixed
- `rust-version` is now inherited by the core crate, so crates.io shows
  the minimum supported Rust version (1.85) instead of blank.
- First release published via crates.io Trusted Publishing (GitHub OIDC)
  instead of a long-lived API token.

## [0.1.1] - 2026-11-12

### Fixed
- crates.io page had no README: core crate now sets
  `readme = "../../README.md"`, plus `keywords` and `categories`, so the
  README renders on crates.io.
- Rust edition upgraded 2021 -> 2024 (`rust-version = "1.85"`). No API
  change; all tests still pass.

## [0.1.0] - 2026-11-11

### Added
- Rust core (`indycheck` crate): offline validators for mobile, PAN, Aadhaar
  (Verhoeff), GSTIN (Mod-36 Luhn), IFSC, UPI, PIN code, TAN, CIN, LLPIN,
  Voter ID (EPIC) and vehicle registration.
- `ValidationResult { valid, code, reason_en, reason_hi, parsed }` — never
  throws on bad input; stable machine-readable error codes.
- Options (`strict` / `lenient`, `allow_spaces_hyphens`,
  `normalise_plus91`, `uppercase`) and `validate_*_with_options`.
- `format_pan`, `format_gstin`, `format_mobile`, `mask_pan`,
  `mask_mobile`, `mask_aadhaar` (UIDAI-style `XXXX XXXX 0124`).
- `detect` (auto-detect) and `validate_many` (bulk batch).
- Mock test-data generators (`generate_pan`, `generate_aadhaar`,
  `generate_gstin`, `generate_mobile`) — syntactically valid test data
  only, never real IDs.
- CLI binary: `indycheck validate <type> <value>`, `detect`, `generate`.
- WASM bindings (`indycheck-wasm`, wasm-pack) and Python bindings
  (PyO3 + maturin, abi3 wheel).
- TypeScript wrapper + Zod schemas (`packages/js`); Python wrapper +
  Pydantic v2 types (`packages/python`).
- `shared/test-vectors.json`: 245 cases — the contract every language
  must pass. `shared/spec.md`: full API + error-code spec.
- Website: Astro 5 + Starlight docs, landing page and in-browser WASM
  playground (25 pages, Pagefind search, sitemap).
- CI: fmt → clippy (0 warnings) → cargo test (3 OS) + WASM + Python
  wheel + website build workflows; release-plz for crates.io.

### Known limitations (v0.1)
- PAN, IFSC, TAN, CIN, LLPIN, Voter ID and vehicle registration have no
  public checksum — format only. This is format + checksum validation,
  **not** KYC verification; no UIDAI/NSDL/GSTN connection.
- Bharat-series vehicle numbers (`22BH1234AA`) are not accepted in v0.1 —
  the vehicle validator requires a 2-letter state code first.
- napi-rs npm packaging, UniFFI (Kotlin/Swift) and Go C-API bindings are
  Phase 2/3 scaffolds, not shipped in v0.1. See `shared/spec.md`.
