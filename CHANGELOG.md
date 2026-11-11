# Changelog

All notable changes to indycheck are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
All crates, npm and PyPI packages share one version in lockstep.

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
