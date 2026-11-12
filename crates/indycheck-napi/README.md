# indycheck-napi — native Node.js bindings

Node.js bindings for indycheck, built with [napi-rs](https://napi.rs/).
Thin wrappers over the Rust core in `crates/indycheck` — every validator
calls the core and returns its result as a JSON string, so the Node
package and the Rust crate can never drift apart. No validation logic
is duplicated here.

## Build

```sh
npm install          # installs @napi-rs/cli (devDependency)
npm run build        # release build -> indycheck-napi.linux-x64-gnu.node
npm run build:debug  # debug build (faster, for development)
```

`napi build` also generates `index.js` (platform-aware loader) and
`index.d.ts` from the `#[napi]` functions in `src/lib.rs` — both are
committed, like in any napi-rs project. The compiled `.node` binary is
**not** committed (see `.gitignore`); build it locally or in CI.

Requires a Rust toolchain (MSRV 1.85, same as the core crate) and
Node.js 18+.

## Use from the JS package

`packages/js/src/native.ts` is the optional native backend for the
`indycheck` npm package: it loads `index.js` from this crate when the
binary is present and falls back to the pure-TypeScript implementation
otherwise. Nothing else in `packages/js` depends on this crate.

```sh
# From packages/js:
npm run native:build   # builds this crate
npm test               # runs packages/js/src/native.test.ts too
```

## API

Each `validate_*` function takes a string and returns a JSON string
with the same shape the JS package returns:

```json
{ "valid": true, "code": "VALID", "reason_en": "...", "reason_hi": "...", "parsed": { ... } }
```

Available: `validate_pan`, `validate_aadhaar`, `validate_gstin`,
`validate_ifsc`, `validate_upi`, `validate_mobile`, `validate_pincode`,
`validate_tan`, `validate_cin`, `validate_llpin`, `validate_voter_id`,
`validate_vehicle` (state format and Bharat `YYBH####XX` series, e.g.
`22BH1234AA`), `detect` (returns the type string: `"pan" | "aadhaar" |
... | "vehicle" | "unknown"`), `validate_many` (JSON array of results,
one per input, in order), plus `format_mobile`, `format_pan`,
`format_gstin`, `mask_aadhaar`, `mask_pan`, `mask_mobile`,
`generate_pan`, `generate_aadhaar`, `generate_gstin`,
`generate_mobile`.

Generators produce mock test data only — syntactically valid, never a
real issued ID.

## Publishing

This crate has `publish = false`: it is never published to crates.io
on its own. Only the core `indycheck` crate is published.
