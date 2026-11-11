# Contributing to indycheck

Thanks for helping! A few rules keep the project honest and consistent.

## The one rule that matters

**The Rust core is the only place validation logic lives.**
`crates/indycheck` owns every rule, checksum and error string.
WASM, Python, napi, UniFFI and FFI bindings are thin translators — they
never re-implement a validator. The TS wrapper in `packages/js` and the
Python wrapper in `packages/python` mirror the core and must stay in
lockstep with it.

## Before you change a validator

1. Add cases to `shared/test-vectors.json` first — valid *and* invalid.
   Every language runs the same vectors; if a binding diverges, tests fail.
2. Update `shared/spec.md` (error codes, `parsed` shape, honest limits).
3. Update the docs (`website/src/content/docs/`) and playground examples.
4. Run the full loop:
   ```bash
   cargo fmt --all
   cargo clippy --workspace --all-targets   # must be 0 warnings
   cargo test --workspace
   cd packages/js && npm test
   cd website && npm run build
   ```

## What not to do

- Never claim KYC / real verification. `valid: true` means
  *"well-formed"*, nothing more. PAN and IFSC have no public checksum —
  format only. Say so wherever you document them.
- Never add a network call, database, or API key to the core. It is
  offline by design.
- Never commit real PAN/Aadhaar/GSTIN numbers. Use the generators in
  `generate.rs` for test data, and label it TEST DATA ONLY.
- Never hand-edit generated glue (`crates/indycheck-wasm/pkg/`,
  `.d.ts` files, UniFFI-generated code, maturin wheels).

## Releases

One version everywhere (semver, lockstep). `release-plz` handles
crates.io; npm/PyPI follow the same version. See `CHANGELOG.md`.

## Code of conduct

Be kind, be precise, cite sources for checksum/format claims.
